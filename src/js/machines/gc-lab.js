/**
 * The harness every collector is judged by, and the oracle that judges it.
 *
 * One trace, replayed against any collector, producing four numbers that are
 * the whole subject: **pause distribution**, **throughput**, **peak memory**
 * and **floating garbage**. Reporting them together is the point — every
 * collector in this milestone wins one of them and loses another, and a table
 * with one column is an advertisement rather than a measurement.
 *
 * **The unit.** One work unit is one object touched by the collector: marked,
 * swept, copied, counted or scanned out of a remembered set. Mutator work is
 * one unit per trace event plus whatever the barrier charges. Everything is
 * denominated in that one unit so the columns can be added, and the unit is
 * stated because a pause measured in objects and a pause measured in bytes
 * rank the same two collectors differently.
 *
 * **The oracle runs at every collection, not at the end.** Before a collector
 * is allowed to touch the heap, `HeapSim.reachable` computes the live set by a
 * breadth-first walk that shares no code with any collector. Afterwards the
 * reclaimed set is split three ways: objects that were unreachable (correct),
 * objects that were reachable (`wrong`, which must be zero for every collector
 * at every collection), and unreachable objects left behind (`floating`, which
 * is allowed and is exactly the price incremental and generational designs
 * pay). A collector with a non-zero `wrong` is broken however good its pause
 * distribution looks, and that check is the reason this file exists.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.GcLab = api;
}(this, function (root) {
  'use strict';

  const HeapSim = pick('HeapSim', '../machines/heap-sim.js');
  const GcRefcount = pick('GcRefcount', '../algorithms/gc-refcount.js');
  const GcMarkSweep = pick('GcMarkSweep', '../algorithms/gc-mark-sweep.js');
  const GcCopying = pick('GcCopying', '../algorithms/gc-copying.js');
  const GcBarriers = pick('GcBarriers', '../algorithms/gc-barriers.js');
  const GcIncremental = pick('GcIncremental', '../algorithms/gc-incremental.js');
  const GcRegions = pick('GcRegions', '../algorithms/gc-regions.js');

  function pick(name, file) {
    if (root && root[name]) return root[name];
    return require(file);
  }

  const MODES = [
    { id: 'refcount', name: 'reference counting', family: 'counting',
      about: 'a count per object, adjusted on every store; zero frees at once' },
    { id: 'refcount-cycles', name: 'counting + cycle collection', family: 'counting',
      about: 'the same, with trial deletion run over the candidates' },
    { id: 'mark-sweep', name: 'stop-the-world mark-sweep', family: 'tracing',
      about: 'mark from the roots, sweep the rest, one pause the size of the heap' },
    { id: 'mark-compact', name: 'mark-compact', family: 'tracing',
      about: 'the same mark, then slide the survivors together' },
    { id: 'copying', name: 'semi-space copying', family: 'copying',
      about: 'copy the live objects out; cost is proportional to survivors' },
    { id: 'generational', name: 'generational copying', family: 'copying',
      about: 'collect the nursery only, with a write barrier finding the rest' },
    { id: 'incremental', name: 'incremental marking', family: 'concurrent',
      about: 'the mark broken into slices the program runs between' },
    { id: 'regions', name: 'region evacuation', family: 'regions',
      about: 'collect the regions with the most garbage per byte copied' }
  ];

  function modeOf(id) {
    return MODES.find(function (row) { return row.id === id; }) || MODES[2];
  }

  /* ------------------------------------------------------------- settings */

  function settingsFor(options) {
    const given = options || {};

    return { mode: given.mode || 'mark-sweep',
      capacity: given.capacity === undefined ? 3072 : given.capacity,
      nursery: given.nursery === undefined ? 1024 : given.nursery,
      slice: given.slice === undefined ? 8 : given.slice,
      barrier: given.barrier || 'card',
      cardBytes: given.cardBytes === undefined ? 128 : given.cardBytes,
      promoteAfter: given.promoteAfter === undefined ? 2 : given.promoteAfter,
      regionBytes: given.regionBytes === undefined ? 256 : given.regionBytes,
      budget: given.budget === undefined ? 512 : given.budget,
      policy: given.policy || 'garbage-first',
      candidates: given.candidates === undefined ? 32 : given.candidates,
      incrementalBarrier: given.incrementalBarrier || 'update' };
  }

  /* ------------------------------------------------------------- the drivers
   *
   * Every collector is reached through the same five calls, so the replay
   * loop below has no idea which one it is driving. Adding a design means
   * adding a driver, not editing the loop — and it is what lets the
   * comparison table run eight of them over one trace.
   */

  function driverFor(settings) {
    const table = { refcount: countingDriver, 'refcount-cycles': countingDriver,
      'mark-sweep': tracingDriver, 'mark-compact': tracingDriver,
      copying: copyingDriver, generational: generationalDriver,
      incremental: incrementalDriver, regions: regionDriver };

    return (table[settings.mode] || tracingDriver)(settings);
  }

  /** Counting: no pause to speak of, and a cycle it cannot see without help. */
  function countingDriver(settings) {
    const state = GcRefcount.create({ cycles: settings.mode === 'refcount-cycles' });

    return { state: state,
      /* The work charged is the REAL counting traffic, including the cascade
         a decrement to zero sets off, rather than a flat two per store. A
         flat charge hides the one case reference counting is criticised for:
         dropping the head of a long list frees the whole list at that store,
         and the "no pause" claim is false for exactly that write. */
      store: function (heap, event) {
        const freed = [];
        const before = traffic(state);

        GcRefcount.store(heap, state, event, freed);
        HeapSim.store(heap, event.from, event.index, event.to);
        return { work: 1 + traffic(state) - before, reclaimed: freed };
      },
      roots: function (heap, event) {
        const freed = [];
        const before = traffic(state);

        GcRefcount.roots(heap, state, event.roots, freed);
        return { work: 1 + traffic(state) - before, reclaimed: freed };
      },
      /* A cycle collector is triggered by the CANDIDATE count, not by the
         heap filling: the whole reason it exists is that a reference counter
         never notices the memory is gone, so waiting for a size threshold
         waits for a signal that may never arrive. CPython counts allocations
         for the same reason. */
      due: function (heap) {
        return settings.mode === 'refcount-cycles'
          && state.candidates.size >= settings.candidates;
      },
      collect: function (heap) {
        const out = GcRefcount.collectCycles(heap, state);

        return { work: out.work, reclaimed: out.reclaimed,
          note: out.groups + ' candidate subgraphs, ' + out.work + ' objects examined' };
      } };
  }

  /** Tracing: one pause, and its length is the whole heap. */
  function tracingDriver(settings) {
    const state = GcMarkSweep.create({ compact: settings.mode === 'mark-compact' });

    return { state: state,
      store: plainStore,
      roots: plainRoots,
      due: function (heap, size) { return heap.bytes + size > settings.capacity; },
      collect: function (heap, why) {
        const out = GcMarkSweep.collect(heap, state, why);

        return { work: out.work, reclaimed: out.reclaimed,
          note: out.visited + ' marked, ' + out.moved + ' moved' };
      } };
  }

  /** Copying: cost is the survivors, and the dead cost nothing at all. */
  function copyingDriver(settings) {
    const state = GcCopying.create({});

    return { state: state,
      store: plainStore,
      roots: plainRoots,
      due: function (heap, size) { return heap.bytes + size > settings.capacity; },
      collect: function (heap, why) {
        const out = GcCopying.collect(heap, state, why);

        return { work: out.work, reclaimed: out.reclaimed,
          note: out.survivors + ' survivors, ' + out.copied + ' bytes copied' };
      } };
  }

  /**
   * Generational: a nursery pause plus a write barrier, and a full copy when
   * the old generation itself fills. The barrier's remembered set is handed
   * to the minor collection as extra roots — miss one and a live young object
   * is freed, which is the bug `wrong` exists to catch.
   */
  function generationalDriver(settings) {
    const state = GcCopying.create({ generational: true,
      promoteAfter: settings.promoteAfter });
    const barrier = GcBarriers.create({ kind: settings.barrier,
      cardBytes: settings.cardBytes, promoteAfter: settings.promoteAfter });

    return { state: state, barrier: barrier,
      store: function (heap, event) {
        GcBarriers.store(heap, barrier, event);
        HeapSim.store(heap, event.from, event.index, event.to);
        return { work: 1 + GcBarriers.costOf(barrier.kind), reclaimed: [] };
      },
      roots: plainRoots,
      due: function (heap, size) {
        return youngBytes(heap, settings) + size > settings.nursery
          || heap.bytes + size > settings.capacity;
      },
      collect: function (heap, why) { return minorOrMajor(heap, state, barrier, settings, why); },
      report: function () {
        return { stores: barrier.stores, filtered: barrier.filtered,
          recorded: barrier.recorded, cost: barrier.cost, kind: barrier.kind,
          scanned: state.scanned || 0, promoted: state.promoted,
          copied: state.copied, minor: state.minor, major: state.major };
      } };
  }

  function youngBytes(heap, settings) {
    let total = 0;

    heap.cells.forEach(function (cell) {
      if (cell.age < settings.promoteAfter) total += cell.size;
    });
    return total;
  }

  function minorOrMajor(heap, state, barrier, settings, why) {
    if (heap.bytes > settings.capacity) return majorCopy(heap, state, barrier, why);
    const extra = GcBarriers.extraRoots(heap, barrier);

    heap.remembered = extra.roots;
    state.scanned = (state.scanned || 0) + extra.scanned;
    state.precision = extra.precision;
    const out = GcCopying.minorCollect(heap, state, why);

    GcBarriers.refresh(heap, barrier, extra.roots, out.promotedIds);
    return { work: out.work + extra.scanned, reclaimed: out.reclaimed,
      note: 'minor — ' + out.survivors + ' survivors, ' + extra.scanned
        + ' scanned for ' + extra.roots.length + ' roots' };
  }

  /**
   * A full copy traces the whole live heap, so re-recording every survivor
   * costs nothing the pause has not already spent — which is why the major
   * collection is the one place a barrier record can be rebuilt from scratch.
   */
  function majorCopy(heap, state, barrier, why) {
    const full = GcCopying.fullCopy(heap, state, why);

    GcBarriers.refresh(heap, barrier, full.survivorIds, []);
    return { work: full.work, reclaimed: full.reclaimed,
      note: 'major — ' + full.survivors + ' survivors of ' + full.before };
  }

  /**
   * Incremental: marking is begun when the heap fills and advanced one slice
   * per event, so every pause is one slice rather than one heap. Everything
   * allocated while a mark is running is shaded black — allocate-black, which
   * is what stops a newborn object from being swept by the cycle that did not
   * know about it, and is a second source of floating garbage.
   */
  function incrementalDriver(settings) {
    const state = GcIncremental.create({ barrier: settings.incrementalBarrier,
      slice: settings.slice });

    return { state: state, incremental: true,
      /* The barrier is charged for the check AND for the objects it shades,
         because those are the two halves of what it costs and only the
         second one differs between designs. A flat charge per store makes
         every barrier cost the same, which reports a difference of zero for
         a choice that has one. */
      store: function (heap, event) {
        const before = state.shaded;

        GcIncremental.store(heap, state, event);
        return { work: 1 + (state.marking ? 1 : 0) + (state.shaded - before),
          reclaimed: [] };
      },
      roots: plainRoots,
      born: function (heap, id) {
        const cell = heap.cells.get(id);

        if (state.marking && cell) cell.colour = 'black';
      },
      due: function (heap, size) {
        return !state.marking && heap.bytes + size > settings.capacity;
      },
      collect: function (heap) {
        GcIncremental.begin(heap, state);
        heap.roots.forEach(function (id) { GcIncremental.shade(heap, state, id); });
        return { work: heap.roots.length, reclaimed: [],
          note: 'marking begun over ' + heap.cells.size + ' objects' };
      },
      tick: function (heap) {
        if (!state.marking) return null;
        const out = GcIncremental.step(heap, state, settings.slice);

        if (state.marking) return { work: out.scanned, reclaimed: [], note: 'slice' };
        const done = GcIncremental.finish(heap, state);

        return { work: out.scanned + heap.cells.size, reclaimed: done.reclaimed,
          note: 'mark ended after ' + done.slices + ' slices' };
      } };
  }

  /**
   * Regions: the pause is a budget rather than a consequence. The collection
   * set is chosen to fit inside it, so the pause is bounded by construction
   * and what varies is how much comes back.
   */
  function regionDriver(settings) {
    const state = GcRegions.create({ regionBytes: settings.regionBytes,
      budget: settings.budget, policy: settings.policy });

    return { state: state,
      store: plainStore,
      roots: plainRoots,
      due: function (heap, size) { return heap.bytes + size > settings.capacity; },
      collect: function (heap) {
        const live = HeapSim.reachable(heap, heap.roots);

        GcRegions.partition(heap, state);
        const rows = GcRegions.census(heap, live);
        const chosen = GcRegions.select(rows, settings.budget, settings.policy);
        const out = GcRegions.evacuate(heap, state, chosen.regions, live);

        return { work: out.work, reclaimed: out.freed,
          note: chosen.regions.length + ' of ' + rows.length + ' regions, '
            + out.copied + ' bytes copied' };
      } };
  }

  function traffic(state) {
    return state.increments + state.decrements;
  }

  function plainStore(heap, event) {
    HeapSim.store(heap, event.from, event.index, event.to);
    return { work: 1, reclaimed: [] };
  }

  function plainRoots(heap, event) {
    heap.roots = event.roots.slice();
    return { work: 1, reclaimed: [] };
  }

  /* --------------------------------------------------------------- the run */

  /**
   * Replay a trace against one collector. Every collection is bracketed by
   * the oracle: the live set before, the reclaimed set after, and the three
   * way split between them.
   */
  function replay(trace, options) {
    const settings = settingsFor(options);
    const driver = driverFor(settings);
    const heap = HeapSim.makeHeap({ capacity: settings.capacity });
    const run = { settings: settings, mode: modeOf(settings.mode),
      pauses: [], mutator: 0, barrier: 0, wrong: [], samples: [],
      immediate: 0, allocFailed: 0, worstStep: 0, steps: [] };

    trace.events.forEach(function (event) { applyEvent(heap, driver, run, event); });
    return finish(heap, driver, run, trace);
  }

  function applyEvent(heap, driver, run, event) {
    run.mutator += 1;
    if (event.kind === 'alloc') return applyAlloc(heap, driver, run, event);
    if (event.kind === 'store') return applyStep(heap, driver, run, driver.store(heap, event));
    if (event.kind === 'roots') return applyStep(heap, driver, run, driver.roots(heap, event));
    return null;
  }

  function applyAlloc(heap, driver, run, event) {
    if (driver.due(heap, event.size)) pause(heap, driver, run, event.at, 'allocation');
    if (heap.bytes + event.size > heap.capacity * 4) { run.allocFailed += 1; return null; }
    HeapSim.allocate(heap, event);
    if (driver.born) driver.born(heap, event.id);
    run.samples.push({ at: event.at, bytes: heap.bytes, cells: heap.cells.size });
    return applyStep(heap, driver, run, { work: 1, reclaimed: [] });
  }

  /**
   * The work a mutator step charged, the objects a counting collector freed
   * inside it, and — for an incremental collector — the slice of marking that
   * runs between two program steps.
   */
  function applyStep(heap, driver, run, out) {
    run.barrier += out.work - 1;
    run.immediate += out.reclaimed.length;
    /* The worst SINGLE mutator step, which is where the "reference counting
       has no pause" claim goes wrong: dropping the head of a long list frees
       the whole list at that one store. A collector with no collections can
       still have a worst case, and this is where to find it. */
    if (out.work > run.worstStep) run.worstStep = out.work;
    if (out.work > 2) run.steps.push({ work: out.work, freed: out.reclaimed.length });
    if (!driver.tick) return null;
    const slice = driver.tick(heap);

    if (slice) record(heap, run, slice, run.mutator, 'slice');
    return null;
  }

  function pause(heap, driver, run, at, why) {
    const live = HeapSim.reachable(heap, heap.roots);
    const before = heap.bytes;
    const out = driver.collect(heap, why);

    record(heap, run, out, at, why, { live: live, before: before });
  }

  /**
   * The oracle check, and the only place in the milestone that is allowed to
   * decide what "live" means. `wrong` must be empty for every collector at
   * every collection; `floating` may not be, and is the number the concurrent
   * and generational designs are actually trading pause time for.
   */
  function record(heap, run, out, at, why, context) {
    const live = context ? context.live : null;
    const reclaimed = new Set(out.reclaimed);
    const wrong = live ? out.reclaimed.filter(function (id) { return live.has(id); }) : [];

    wrong.forEach(function (id) { run.wrong.push({ at: at, id: id, why: why }); });
    run.pauses.push({ at: at, why: why, work: out.work, note: out.note || '',
      reclaimed: out.reclaimed.length, wrong: wrong.length,
      floating: live ? countFloating(heap, live, reclaimed) : 0,
      bytes: heap.bytes, before: context ? context.before : heap.bytes });
  }

  function countFloating(heap, live, reclaimed) {
    let total = 0;

    heap.cells.forEach(function (cell, id) {
      if (!live.has(id) && !reclaimed.has(id)) total += 1;
    });
    return total;
  }

  function finish(heap, driver, run, trace) {
    const works = run.pauses.map(function (row) { return row.work; });
    const gc = works.reduce(function (sum, value) { return sum + value; }, 0);
    const left = HeapSim.unreachable(heap, heap.roots);
    const mutator = run.mutator + run.barrier;

    return { mode: run.mode, settings: run.settings, pauses: run.pauses,
      collections: run.pauses.length, gcWork: gc, mutatorWork: mutator,
      programWork: run.mutator,
      barrierWork: run.barrier, immediate: run.immediate,
      throughput: run.mutator + run.barrier + gc
        ? run.mutator / (run.mutator + run.barrier + gc) : 1,
      peak: heap.peak, finalBytes: heap.bytes, finalCells: heap.cells.size,
      span: heap.next,
      allocatedBytes: trace.bytes, allocations: trace.allocations,
      uncollected: left.length, uncollectedBytes: bytesOf(heap, left),
      floatingPeak: peakOf(run.pauses, 'floating'),
      worstStep: run.worstStep, bigSteps: run.steps,
      wrong: run.wrong, correct: run.wrong.length === 0,
      allocFailed: run.allocFailed, samples: run.samples,
      report: driver.report ? driver.report() : null,
      distribution: distribution(works) };
  }

  /**
   * Two different numbers, both of which get called "floating garbage" and
   * mean opposite things. `floatingPeak` is the worst case of dead objects a
   * COLLECTION left behind — the price of a design that does not trace the
   * whole heap. `uncollected` is what is dead at the end of the run, which
   * for a reference counter is its leaked cycles and for a tracing collector
   * is mostly just garbage the next collection has not reached yet.
   */
  function peakOf(pauses, field) {
    return pauses.reduce(function (most, row) { return Math.max(most, row[field]); }, 0);
  }

  function bytesOf(heap, ids) {
    return ids.reduce(function (sum, id) {
      const cell = heap.cells.get(id);

      return sum + (cell ? cell.size : 0);
    }, 0);
  }

  /* --------------------------------------------------------- the histogram */

  /**
   * A pause distribution, never an average. The mean of a bimodal pause set —
   * which is what every generational collector produces — describes no pause
   * that ever happened, and the p99 is the number a latency budget is written
   * against.
   */
  function distribution(works) {
    if (!works.length) {
      return { count: 0, p50: 0, p90: 0, p99: 0, max: 0, min: 0, mean: 0,
        total: 0, buckets: [] };
    }
    const sorted = works.slice().sort(function (a, b) { return a - b; });
    const total = sorted.reduce(function (sum, value) { return sum + value; }, 0);

    return { count: sorted.length, p50: percentile(sorted, 0.5),
      p90: percentile(sorted, 0.9), p99: percentile(sorted, 0.99),
      max: sorted[sorted.length - 1], min: sorted[0],
      mean: total / sorted.length, total: total,
      buckets: buckets(sorted) };
  }

  function percentile(sorted, fraction) {
    const at = Math.min(sorted.length - 1,
      Math.max(0, Math.ceil(fraction * sorted.length) - 1));

    return sorted[at];
  }

  function buckets(sorted, count) {
    const width = Math.max(1, Math.ceil(sorted[sorted.length - 1] / (count || 8)));
    const rows = [];

    for (let at = 0; at < (count || 8); at += 1) {
      rows.push({ from: at * width, to: (at + 1) * width, count: 0 });
    }
    sorted.forEach(function (value) {
      const at = Math.min(rows.length - 1, Math.floor(value / width));

      rows[at].count += 1;
    });
    return rows;
  }

  /* ------------------------------------------------------------ comparisons */

  /** Every design over one trace, which is the only fair way to rank them. */
  function compare(trace, options, modes) {
    return (modes || MODES.map(function (row) { return row.id; })).map(function (id) {
      const run = replay(trace, Object.assign({}, options || {}, { mode: id }));

      return { mode: id, name: run.mode.name, about: run.mode.about,
        collections: run.collections, p50: run.distribution.p50,
        p90: run.distribution.p90, p99: run.distribution.p99,
        max: run.distribution.max, mean: run.distribution.mean,
        gcWork: run.gcWork, throughput: run.throughput, peak: run.peak,
        uncollected: run.uncollected, uncollectedBytes: run.uncollectedBytes,
        floatingPeak: run.floatingPeak, barrierWork: run.barrierWork,
        immediate: run.immediate, correct: run.correct, wrong: run.wrong.length,
        worstStep: run.worstStep, report: run.report };
    });
  }

  /**
   * The generational claim, measured: hold the live set roughly fixed and
   * vary the heap the collector is allowed to fill. A copying collector's
   * work per collection should not move, because it copies survivors; a
   * mark-sweep collector's should, because it sweeps the heap.
   */
  function heapSizeSweep(trace, sizes, modes) {
    const rows = [];

    sizes.forEach(function (capacity) {
      (modes || ['mark-sweep', 'copying']).forEach(function (mode) {
        const run = replay(trace, { mode: mode, capacity: capacity,
          nursery: Math.max(256, Math.floor(capacity / 3)) });

        rows.push({ capacity: capacity, mode: mode, collections: run.collections,
          gcWork: run.gcWork, perCollection: run.collections
            ? run.gcWork / run.collections : 0,
          p99: run.distribution.p99, peak: run.peak, correct: run.correct });
      });
    });
    return rows;
  }

  /**
   * One dial swept with everything else held fixed. Every sweep in this
   * milestone goes through here, so a row from the nursery sweep and a row
   * from the card sweep are the same measurement of the same trace and can
   * be put in one sentence.
   */
  function sweep(trace, field, values, options) {
    return values.map(function (value) {
      const given = Object.assign({}, options || {});

      given[field] = value;
      const run = replay(trace, given);

      return { value: value, field: field, mode: run.settings.mode,
        collections: run.collections, gcWork: run.gcWork,
        barrierWork: run.barrierWork, throughput: run.throughput,
        p50: run.distribution.p50, p99: run.distribution.p99,
        max: run.distribution.max, mean: run.distribution.mean,
        peak: run.peak, uncollected: run.uncollected,
        floatingPeak: run.floatingPeak, correct: run.correct,
        wrong: run.wrong.length,
        minor: run.pauses.filter(function (row) {
          return row.note.indexOf('minor') === 0;
        }).length,
        major: run.pauses.filter(function (row) {
          return row.note.indexOf('major') === 0;
        }).length };
    });
  }

  /** Heap occupancy over the run, which is the shape people recognise. */
  function occupancy(run, points) {
    const samples = run.samples;
    const stride = Math.max(1, Math.floor(samples.length / (points || 120)));

    return samples.filter(function (row, at) { return at % stride === 0; });
  }

  return { MODES: MODES, modeOf: modeOf, replay: replay, compare: compare,
    heapSizeSweep: heapSizeSweep, occupancy: occupancy, sweep: sweep,
    distribution: distribution, settingsFor: settingsFor };
}));

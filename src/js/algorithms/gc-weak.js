/**
 * Weak references, finalisers, and the resource the collector cannot see.
 *
 * A reference strength is an instruction to the collector about what to do
 * when the only thing pointing at an object is this reference:
 *
 * - **strong** — keep the object. This is every ordinary field;
 * - **weak** — clear the reference and reclaim the object. A weak map entry
 *   disappears when its key does, which is what makes a cache a cache rather
 *   than a leak;
 * - **soft** — keep it while there is room, clear it under pressure. A
 *   policy, not an invariant, and the reason soft references are unreliable
 *   for correctness;
 * - **phantom** — the object is already unreachable and already unresurrectable;
 *   the reference exists only to tell you it is gone, which is the safe
 *   version of a finaliser.
 *
 * Finalisation is the part to be suspicious of. A finaliser runs at an
 * unspecified time, in an unspecified order, on a thread you did not choose,
 * and it can store `this` somewhere and make the object reachable again —
 * RESURRECTION, which is why an object with a finaliser survives at least two
 * collection cycles. The failure this module reproduces is the one that
 * reaches production: a scarce non-memory resource (a file handle) held by an
 * object awaiting finalisation, exhausted while the heap is nearly empty, so
 * nothing ever triggers a collection to release it.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.GcWeak = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const STRENGTHS = [
    { id: 'strong', name: 'strong', keeps: 'always', clearedWhen: 'never' },
    { id: 'soft', name: 'soft', keeps: 'while there is room',
      clearedWhen: 'the heap is under pressure' },
    { id: 'weak', name: 'weak', keeps: 'nothing',
      clearedWhen: 'the referent is unreachable by strong references' },
    { id: 'phantom', name: 'phantom', keeps: 'nothing',
      clearedWhen: 'after the referent is finalised and cannot be resurrected' }
  ];

  function create(options) {
    const settings = options || {};

    return { refs: [], queue: [], finalised: [], resurrected: [],
      pressure: settings.pressure === undefined ? 0.8 : settings.pressure,
      cleared: 0, cycles: 0 };
  }

  function reference(state, holder, strength, target) {
    const row = { id: state.refs.length, holder: holder, strength: strength,
      target: target, cleared: false };

    state.refs.push(row);
    return row;
  }

  /* ------------------------------------------------------- the strong set */

  /**
   * Reachability that ignores every non-strong reference. This is the whole
   * definition: a weak reference is one the tracer does not follow, and
   * everything else about weak maps and caches follows from that single
   * omission.
   */
  function stronglyReachable(heap, state) {
    const weak = weakEdges(state);
    const live = new Set();
    const queue = heap.roots.slice();

    while (queue.length) {
      const id = queue.shift();

      if (live.has(id) || !heap.cells.has(id)) continue;
      live.add(id);
      heap.cells.get(id).refs.forEach(function (child, index) {
        if (child === null || child === undefined) return;
        if (weak.has(id + ':' + index)) return;
        queue.push(child);
      });
    }
    return live;
  }

  function weakEdges(state) {
    const edges = new Set();

    state.refs.forEach(function (row) {
      if (row.strength === 'strong') return;
      if (row.strength === 'soft' && !row.underPressure) return;
      edges.add(row.holder + ':' + row.index);
    });
    return edges;
  }

  /**
   * Register a weak edge by position, because the collector clears a SLOT,
   * not an object. Two weak references to the same object are cleared
   * independently, and a strong reference elsewhere keeps it alive through
   * both.
   */
  function weaken(state, holder, index, strength) {
    const row = { id: state.refs.length, holder: holder, index: index,
      strength: strength || 'weak', cleared: false, underPressure: false };

    state.refs.push(row);
    return row;
  }

  /* ------------------------------------------------------- the collection */

  /**
   * One cycle, in the order the specification requires and for the reason it
   * requires it: determine strong reachability, clear the weak references to
   * everything unreachable, THEN run finalisers. Clearing before finalising
   * is what stops a finaliser from resurrecting an object that a weak
   * reference has already been told is gone.
   */
  function collect(heap, state, options) {
    const settings = options || {};
    const live = stronglyReachable(heap, state);
    const cleared = clearWeak(heap, state, live);
    /* Finalisers run for objects queued by an EARLIER cycle, and only then
       are newly unreachable ones queued. That ordering is what makes a
       finalisable object cost two collections: one to notice it and hand it
       to the finaliser, one to confirm it is still unreachable and free it.
       Doing both in one cycle would free an object whose finaliser had just
       resurrected it. */
    const ran = state.queue.slice();
    const resurrected = runFinalisers(heap, state, ran, settings.finaliser);
    const queued = pending(heap, state, live, settings);
    const held = finaliserReachable(heap, state, resurrected);

    return finishCycle(heap, state, { live: live, cleared: cleared, ran: ran,
      queued: queued, resurrected: resurrected, held: held });
  }

  function finishCycle(heap, state, run) {
    const reclaimed = [];

    heap.cells.forEach(function (cell, id) {
      if (run.live.has(id) || run.resurrected.indexOf(id) !== -1) return;
      if (state.queue.indexOf(id) !== -1 || run.held.has(id)) return;
      reclaimed.push(id);
    });
    reclaimed.forEach(function (id) { drop(heap, id); });
    state.cycles += 1;
    return { cleared: run.cleared, finalised: run.ran, queued: state.queue.length,
      resurrected: run.resurrected, reclaimed: reclaimed, live: run.live.size,
      awaiting: run.queued, retainedByFinalisers: run.held.size };
  }

  /**
   * Everything reachable FROM the finalisation queue, or from an object a
   * finaliser has just resurrected, is kept.
   *
   * The first version of this collector freed those, which produced a
   * resurrected object holding a reference to a block that no longer
   * existed — a dangling pointer in a managed runtime, produced by the
   * collector. The rule real runtimes state is that an object awaiting
   * finalisation is finaliser-reachable and so is everything it points at,
   * and this is why one forgotten finaliser can retain an entire subgraph
   * rather than one object.
   */
  function finaliserReachable(heap, state, resurrected) {
    const held = new Set();
    const queue = state.queue.concat(resurrected);

    while (queue.length) {
      const id = queue.shift();

      if (held.has(id) || !heap.cells.has(id)) continue;
      held.add(id);
      heap.cells.get(id).refs.forEach(function (child) {
        if (child !== null && child !== undefined) queue.push(child);
      });
    }
    return held;
  }

  function clearWeak(heap, state, live) {
    const cleared = [];

    state.refs.forEach(function (row) {
      const cell = heap.cells.get(row.holder);
      const target = cell ? cell.refs[row.index] : null;

      if (row.strength === 'strong' || row.cleared) return;
      if (target === null || target === undefined) return;
      if (live.has(target)) return;
      cell.refs[row.index] = null;
      row.cleared = true;
      state.cleared += 1;
      cleared.push({ holder: row.holder, index: row.index, target: target,
        strength: row.strength });
    });
    return cleared;
  }

  /**
   * Objects with a finaliser that have just become unreachable. They are
   * queued rather than freed, which is the extra cycle every finalisable
   * object costs — and the window in which whatever it holds is still held.
   */
  function pending(heap, state, live, settings) {
    const rows = [];

    heap.cells.forEach(function (cell, id) {
      if (live.has(id) || cell.finalised) return;
      if (!cell.finaliser && !(settings.finalisable || []).includes(id)) return;
      if (state.queue.indexOf(id) !== -1) return;
      rows.push(id);
    });
    rows.forEach(function (id) { state.queue.push(id); });
    return rows;
  }

  /**
   * A finaliser runs AT MOST ONCE, and the object leaves the queue whether or
   * not it resurrected itself.
   *
   * The first version left resurrected objects queued, so the finaliser ran
   * again on the next cycle and again on the one after — a resurrection loop
   * that keeps an object alive forever and calls its cleanup repeatedly. Real
   * runtimes mark the object finalised at the first call and never look
   * again, which means a resurrected object is never cleaned up at all. That
   * is a worse outcome than a leak and it is why resurrection is a defect
   * rather than a feature.
   */
  function runFinalisers(heap, state, queued, finaliser) {
    const resurrected = [];

    queued.forEach(function (id) {
      const cell = heap.cells.get(id);
      const at = state.queue.indexOf(id);

      if (at !== -1) state.queue.splice(at, 1);
      if (!cell || cell.finalised) return;
      cell.finalised = true;
      state.finalised.push(id);
      if (!finaliser || finaliser(heap, id) !== true) return;
      resurrected.push(id);
      state.resurrected.push(id);
    });
    return resurrected;
  }

  function drop(heap, id) {
    const cell = heap.cells.get(id);

    if (!cell) return;
    heap.cells.delete(id);
    heap.bytes -= cell.size;
    heap.freed += cell.size;
  }

  /* ---------------------------------------------------------- two fixtures */

  /**
   * A cache keyed on objects, built twice: once with strong entries and once
   * with weak ones. The keys are held from the roots and then half of them
   * are dropped, which is what happens to a session object when a request
   * finishes.
   *
   * With strong entries nothing is reclaimed, because the cache is reachable
   * and the cache reaches the keys — the map is keeping alive exactly the
   * things it was built to be indexed by. That is not a subtle bug; it is the
   * commonest managed-language leak there is, and the only difference between
   * it and a working cache is the strength of one reference.
   */
  function cacheScenario(makeHeap, strength, options) {
    const settings = options || {};
    const entries = settings.entries === undefined ? 12 : settings.entries;
    const heap = makeHeap();
    const state = create({});

    buildCache(heap, state, entries, strength);
    if (settings.pressure) {
      state.refs.forEach(function (row) { row.underPressure = true; });
    }
    heap.roots = rootsAfterDrop(entries, settings.keep === undefined ? 0.5 : settings.keep);
    const before = heap.cells.size;
    const out = collect(heap, state, {});

    return { strength: strength, entries: entries, before: before,
      pressure: Boolean(settings.pressure),
      cleared: out.cleared.length, reclaimed: out.reclaimed.length,
      live: heap.cells.size, bytes: heap.bytes };
  }

  /** Cache is object 0; keys are 1..n; values are n+1..2n. */
  function buildCache(heap, state, entries, strength) {
    for (let id = 0; id <= entries * 2; id += 1) {
      heap.cells.set(id, { id: id, size: 24, refs: [], colour: 'white', age: 0,
        count: 0, kind: 'record', address: id * 24 });
      heap.bytes += 24;
    }
    for (let at = 0; at < entries; at += 1) {
      heap.cells.get(0).refs[at] = at + 1;
      heap.cells.get(at + 1).refs[0] = entries + at + 1;
      if (strength !== 'strong') weaken(state, 0, at, strength);
    }
  }

  function rootsAfterDrop(entries, keep) {
    const roots = [0];

    for (let at = 1; at <= Math.round(entries * keep); at += 1) roots.push(at);
    return roots;
  }

  /**
   * Resurrection, and the extra cycle it costs everything else.
   *
   * The finaliser stores `this` somewhere reachable, so the object it was
   * called on is alive again after being declared dead. A runtime that allows
   * this must therefore give every finalisable object at least two cycles —
   * one to find it and run the finaliser, one to decide whether it is really
   * gone — and it must never run the finaliser twice, or a resurrected
   * object would be finalised again on the next pass.
   */
  function resurrectionScenario(makeHeap, options) {
    const settings = options || {};
    const heap = makeHeap();
    const state = create({});
    const rows = [];

    ['keeper', 'doomed', 'held-by-doomed'].forEach(function (name, id) {
      heap.cells.set(id, { id: id, size: 24, refs: [], colour: 'white', age: 0, count: 0,
        kind: 'record', name: name, address: id * 24, finaliser: id === 1 });
      heap.bytes += 24;
    });
    heap.cells.get(1).refs[0] = 2;
    heap.roots = [0];
    return runCycles(heap, state, rows, Boolean(settings.resurrect));
  }

  function runCycles(heap, state, rows, resurrect) {
    const finaliser = function (target, id) {
      if (!resurrect) return false;
      target.cells.get(0).refs[0] = id;
      return true;
    };

    for (let cycle = 1; cycle <= 3; cycle += 1) {
      const out = collect(heap, state, { finaliser: finaliser });

      rows.push({ cycle: cycle, finalised: out.finalised.length,
        resurrected: out.resurrected.length, reclaimed: out.reclaimed.length,
        live: heap.cells.size, queued: out.queued });
    }
    return { rows: rows, resurrect: resurrect, live: heap.cells.size,
      finalised: state.finalised.length, twice: countTwice(state.finalised) };
  }

  function countTwice(finalised) {
    const seen = new Set();
    let twice = 0;

    finalised.forEach(function (id) {
      if (seen.has(id)) twice += 1;
      seen.add(id);
    });
    return twice;
  }

  /* ------------------------------------------------- the handle exhaustion */

  /**
   * The production failure, run rather than described. Each iteration opens a
   * handle and drops the object holding it. The handle is released by the
   * finaliser, the finaliser runs only when a collection happens, and a
   * collection happens only when memory runs low — which it does not, because
   * the objects are tiny. Memory is fine and the process dies of file
   * descriptors.
   *
   * `close` decides which version runs: with explicit closing the handle is
   * released at the drop and the limit is never approached, which is the
   * entire argument for `try`-with-resources over finalisers.
   */
  function handleScenario(options) {
    const settings = options || {};
    const state = { limit: settings.limit === undefined ? 16 : settings.limit,
      objectBytes: settings.objectBytes || 16,
      heapLimit: settings.heapLimit === undefined ? 4096 : settings.heapLimit,
      close: Boolean(settings.close), open: 0, peakHandles: 0, collections: 0,
      bytes: 0, opened: 0, released: 0, failedAt: 0, rows: [] };

    for (let at = 1; at <= (settings.iterations || 64) && !state.failedAt; at += 1) {
      handleStep(state, at);
    }
    return report(state);
  }

  function handleStep(state, at) {
    state.opened += 1;
    state.open += 1;
    state.bytes += state.objectBytes;
    state.peakHandles = Math.max(state.peakHandles, state.open);
    if (state.close) { state.open -= 1; state.released += 1; }
    if (state.bytes >= state.heapLimit) sweepHandles(state);
    if (state.open > state.limit) state.failedAt = at;
    state.rows.push({ at: at, open: state.open, bytes: state.bytes,
      collections: state.collections });
  }

  /** A collection releases every queued handle, and only memory triggers one. */
  function sweepHandles(state) {
    state.released += state.open;
    state.open = 0;
    state.bytes = 0;
    state.collections += 1;
  }

  function report(state) {
    return { close: state.close, limit: state.limit, opened: state.opened,
      released: state.released, peakHandles: state.peakHandles,
      collections: state.collections, failedAt: state.failedAt,
      exhausted: state.failedAt > 0, bytes: state.bytes, rows: state.rows };
  }

  return { STRENGTHS: STRENGTHS, create: create, reference: reference,
    weaken: weaken, stronglyReachable: stronglyReachable, collect: collect,
    clearWeak: clearWeak, handleScenario: handleScenario,
    cacheScenario: cacheScenario, resurrectionScenario: resurrectionScenario };
}));

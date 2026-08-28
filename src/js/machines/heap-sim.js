/**
 * The simulated heap, and the traces the collectors are judged on.
 *
 * Two things here, and the first is what makes the rest of the milestone
 * honest.
 *
 * **A real trace from a real program.** `record()` runs a Berugo program
 * through M30's VM one instruction at a time and, after every step, walks the
 * frames that exist at that moment. New objects are allocations, changed
 * references are pointer stores, and the objects directly held by the frames
 * are the root set. Nothing is invented: the roots are the ones a precise
 * collector would get from M30's stack maps, and the object graph is the one
 * the program actually built.
 *
 * **A liveness oracle that is not the collector.** At any point in the trace,
 * the live set is "reachable from the current roots", computed by a plain
 * breadth-first walk that shares no code with any collector. Every collector
 * in this milestone is checked against it — the set it reclaims must be
 * exactly the unreachable set, and a single live object freed is a failure
 * rather than a statistic. That is the same oracle discipline M29 applied to
 * every analysis, applied here to the one bug a garbage collector must never
 * have.
 *
 * Synthetic traces exist beside the recorded ones because the generational
 * hypothesis is a claim about scale, and a seventeen-object program cannot
 * measure it.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.HeapSim = api;
}(this, function (root) {
  'use strict';

  const berugo = root && root.Berugo ? root.Berugo : null;
  const base = './berugo/';
  const IrLower = pick('IrLower', 'ir-lower.js');
  const Bytecode = pick('Bytecode', 'bytecode.js');
  const Vm = pick('Vm', 'vm.js');
  const Random = root && root.Random ? root.Random : require('../utils/random.js');

  function pick(name, file) {
    if (berugo && berugo[name]) return berugo[name];
    return require(base + file);
  }

  /** A header plus one word per reference. Every collector pays the header. */
  const HEADER_BYTES = 8;
  const WORD_BYTES = 8;

  /* ------------------------------------------------------- reading a value */

  const FIELDS = {
    record: function (value) { return Object.keys(value.fields).map(function (name) {
      return value.fields[name];
    }); },
    array: function (value) { return value.items; },
    irclosure: function (value) { return value.captures; },
    ctor: function (value) { return value.args || []; }
  };

  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && typeof value.v === 'string'
      && Boolean(FIELDS[value.v]);
  }

  function referencesOf(value) {
    return FIELDS[value.v](value).filter(isObject);
  }

  function sizeOf(value) {
    return HEADER_BYTES + FIELDS[value.v](value).length * WORD_BYTES;
  }

  /* ------------------------------------------------------- recording a trace */

  /**
   * The roots a precise collector would be handed: every object directly held
   * by a live frame's registers, slots, operand stack or scratch temporaries.
   * That is the same walk 30.9's stack map describes statically, done
   * dynamically so the trace needs no compiler cooperation of its own.
   */
  function rootsOf(state) {
    const found = [];

    state.frames.forEach(function (frame) {
      (frame.registers || []).forEach(function (value) { if (isObject(value)) found.push(value); });
      frame.slots.forEach(function (value) { if (isObject(value)) found.push(value); });
      frame.temps.forEach(function (value) { if (isObject(value)) found.push(value); });
      frame.stack.forEach(function (value) { if (isObject(value)) found.push(value); });
    });
    return found;
  }

  function makeRecorder() {
    return { ids: new Map(), objects: [], events: [], next: 0, edges: new Map() };
  }

  function idFor(recorder, value, site, at) {
    if (recorder.ids.has(value)) return recorder.ids.get(value);
    const id = recorder.next;

    recorder.next += 1;
    recorder.ids.set(value, id);
    recorder.objects.push({ id: id, kind: value.v, size: sizeOf(value), site: site, bornAt: at });
    recorder.events.push({ at: at, kind: 'alloc', id: id, size: sizeOf(value),
      site: site, objectKind: value.v });
    recorder.edges.set(id, []);
    return id;
  }

  /** The instruction that has just run, which is where the allocation happened. */
  function siteOf(state) {
    const frame = state.frames[state.frames.length - 1];

    if (!frame) return { fn: '', at: -1, origin: '' };
    const inst = frame.chunk.code[frame.pc - 1];

    return { fn: frame.chunk.name, at: frame.pc - 1,
      origin: inst ? inst.origin || '' : '' };
  }

  function sweepGraph(recorder, roots, site, at) {
    const queue = roots.slice();
    const seen = new Set();

    while (queue.length) {
      const value = queue.shift();
      const id = idFor(recorder, value, site, at);

      if (seen.has(id)) continue;
      seen.add(id);
      recordEdges(recorder, value, id, site, at);
      referencesOf(value).forEach(function (child) { queue.push(child); });
    }
    return seen;
  }

  function recordEdges(recorder, value, id, site, at) {
    const now = referencesOf(value).map(function (child) {
      return idFor(recorder, child, site, at);
    });
    const before = recorder.edges.get(id) || [];

    if (before.join(',') === now.join(',')) return;
    now.forEach(function (target, index) {
      if (before[index] === target) return;
      recorder.events.push({ at: at, kind: 'store', from: id, index: index, to: target });
    });
    recorder.edges.set(id, now);
  }

  /**
   * Run the program one instruction at a time and reconstruct the heap from
   * what the frames hold. This is quadratic in the heap and is exactly the
   * right cost for a teaching trace of a few hundred objects; the synthetic
   * generator is what scales.
   */
  function record(source, options) {
    const settings = options || {};
    const program = IrLower.compile(source).program;
    const state = Vm.makeState(Bytecode.compile(program, { mode: 'register' }),
      { budget: settings.budget || 200000 });
    const recorder = makeRecorder();
    let steps = 0;

    Vm.startFrame(state, state.chunks[state.main], [], []);
    try {
      steps = drive(state, recorder, settings.limit || 20000);
    } catch (problem) {
      recorder.error = String(problem.message || problem);
    }
    return finishTrace(recorder, source, steps);
  }

  function drive(state, recorder, limit) {
    let steps = 0;

    while (!state.done && steps < limit) {
      Vm.step(state);
      steps += 1;
      const site = siteOf(state);
      const roots = rootsOf(state);
      const ids = Array.from(sweepGraph(recorder, roots, site, steps));

      recorder.events.push({ at: steps, kind: 'roots',
        roots: Array.from(new Set(roots.map(function (value) {
          return recorder.ids.get(value);
        }))).sort(function (a, b) { return a - b; }), live: ids.length });
    }
    return steps;
  }

  function finishTrace(recorder, source, steps) {
    return { source: source, steps: steps, error: recorder.error || '',
      objects: recorder.objects, events: recorder.events,
      allocations: recorder.objects.length,
      bytes: recorder.objects.reduce(function (sum, row) { return sum + row.size; }, 0),
      sites: siteTable(recorder.objects) };
  }

  /** Allocation attributed to the construct that made it, which is the lever. */
  function siteTable(objects) {
    const bySite = new Map();

    objects.forEach(function (row) {
      const key = row.site.fn + ':' + row.site.at + ' ' + row.site.origin;

      if (!bySite.has(key)) bySite.set(key, { site: key, origin: row.site.origin, count: 0, bytes: 0 });
      bySite.get(key).count += 1;
      bySite.get(key).bytes += row.size;
    });
    return Array.from(bySite.values()).sort(function (a, b) { return b.bytes - a.bytes; });
  }

  /* -------------------------------------------------------- synthetic traces */

  /**
   * The generational hypothesis is a claim about scale, and a recorded trace
   * of a teaching program has too few objects to test it. This generator
   * takes a survival rate and a shape and produces a trace with the same
   * event vocabulary, so every collector and every metric works unchanged.
   */
  function synthetic(options) {
    const settings = options || {};
    const rng = Random.seeded(settings.seed || 1);
    const state = makeGenerator(settings);

    seedRetained(state);
    for (let at = 1; at <= state.count; at += 1) syntheticStep(state, rng, at);
    return { source: 'synthetic', steps: state.count, error: '',
      objects: state.objects, events: state.events,
      allocations: state.objects.length, retained: state.retained, leaked: state.leaked,
      bytes: state.objects.reduce(function (sum, row) { return sum + row.size; }, 0),
      sites: siteTable(state.objects) };
  }

  function makeGenerator(settings) {
    return { events: [], objects: [], next: 0, roots: [], spine: [], slots: [],
      registers: [], count: settings.count || 400,
      survival: settings.survival === undefined ? 0.1 : settings.survival,
      cycles: settings.cycles === undefined ? 0 : settings.cycles,
      leak: settings.leak === undefined ? 0 : settings.leak,
      leakHead: null, leakSlot: null, leaked: 0,
      retained: settings.retained === undefined ? 48 : settings.retained,
      rootSlots: settings.rootSlots || 8 };
  }

  /**
   * The long-lived structure, and the reason it is a FIXED number of slots.
   *
   * Two versions of this generator were wrong before this one. The first
   * linked every survivor into an object that was itself a rotating root
   * slot, so the holder was overwritten a few steps later and took its whole
   * subtree with it: the measured survival curve read 0.000 at every window
   * for every setting of the dial from 0 to 0.5, and a generational
   * hypothesis demo that cannot show the hypothesis holding cannot show it
   * failing either. The second let survivors accumulate without limit, so the
   * live set grew past any heap the collectors were given and every design
   * degenerated into collecting on almost every allocation — which is a real
   * phenomenon, and not the one the dial is supposed to control.
   *
   * A bounded set of retained slots is what a real program has: a cache, a
   * session table, a registry. A survivor overwrites one at random, so the
   * live set reaches a steady state and `survival` controls how fast objects
   * pass through it rather than how fast the heap grows.
   */
  function seedRetained(state) {
    const holders = Math.max(1, Math.ceil(state.retained / 3));

    state.roots.push(0);
    for (let at = 0; at < holders; at += 1) allocateHolder(state, at, holders);
    /* The leak list gets a slot of its own, taken out of the rotation. If it
       shared the bounded set, an eviction would drop the whole list and the
       "unbounded cache" would quietly bound itself. */
    if (state.leak > 0) state.leakSlot = state.slots.shift();
    state.registers.length = 0;
    emitRoots(state, 0);
  }

  /** Each holder keeps three data slots and one slot for the next holder. */
  function allocateHolder(state, at, holders) {
    const size = HEADER_BYTES + 4 * WORD_BYTES;
    const site = { fn: 'synthetic', at: 0, origin: 'retained' };
    const id = state.next;

    state.next += 1;
    state.objects.push({ id: id, kind: 'record', size: size, bornAt: 0, site: site });
    state.events.push({ at: 0, kind: 'alloc', id: id, size: size, site: site,
      objectKind: 'record' });
    hold(state, id, 0);
    state.spine.push(id);
    if (at > 0) state.events.push({ at: 0, kind: 'store', from: state.spine[at - 1],
      index: 3, to: id });
    state.registers.length = 0;
    for (let slot = 0; slot < 3 && state.slots.length < state.retained; slot += 1) {
      state.slots.push({ holder: id, index: slot });
    }
    return holders;
  }

  function syntheticStep(state, rng, at) {
    const id = allocateSynthetic(state, rng, at);

    if (rng.next() < state.cycles) return makeCycle(state, rng, id, at);
    if (state.leakSlot && rng.next() < state.leak) leakOne(state, id, at);
    else if (rng.next() < state.survival) retain(state, rng, id, at);
    else rotateRoot(state, rng, id);
    state.registers.length = 0;
    return emitRoots(state, at);
  }

  function allocateSynthetic(state, rng, at) {
    const size = HEADER_BYTES + (1 + Math.floor(rng.next() * 4)) * WORD_BYTES;
    const site = { fn: 'synthetic', at: at % 7, origin: 'alloc' + (at % 7) };
    const id = state.next;

    state.next += 1;
    state.objects.push({ id: id, kind: 'record', size: size, bornAt: at, site: site });
    state.events.push({ at: at, kind: 'alloc', id: id, size: size, site: site,
      objectKind: 'record' });
    hold(state, id, at);
    return id;
  }

  /**
   * The register holding a value that has been allocated and not yet stored
   * anywhere, published as a root immediately.
   *
   * Without it the trace is not a possible program. An object is unreachable
   * between its allocation and the store that links it, and a collection
   * triggered by the NEXT allocation would be entitled to free it — which is
   * exactly what happened: the sixteen-holder retained spine is built before
   * any roots event, so a collector with a small nursery collected during the
   * construction, found an empty root set, and freed the whole structure. The
   * run then looked correct at every collection (nothing reachable was ever
   * freed) and ended with a third of the live set, because every later store
   * into the deleted spine was silently dropped. A real frame holds the value
   * in a register, and a register is a root.
   */
  function hold(state, id, at) {
    state.registers.push(id);
    emitRoots(state, at);
  }

  /**
   * A survivor takes one retained slot, and whatever was in that slot becomes
   * unreachable at that instant. That is the eviction every bounded cache
   * performs, and it is what keeps the live set flat.
   */
  function retain(state, rng, id, at) {
    const slot = state.slots[Math.floor(rng.next() * state.slots.length)];

    state.events.push({ at: at, kind: 'store', from: slot.holder, index: slot.index, to: id });
  }

  /**
   * The unbounded cache: every leaked object is pushed onto a list whose head
   * is held from a permanent slot, so nothing is ever evicted and the
   * retained set grows without limit. This is a listener list nobody
   * deregisters from, a memo table with no eviction, a thread-local nobody
   * clears — the same shape every time, and the collector is right about all
   * of it, which is why no collector can help.
   */
  function leakOne(state, id, at) {
    if (state.leakHead !== null) {
      state.events.push({ at: at, kind: 'store', from: id, index: 0, to: state.leakHead });
    }
    state.events.push({ at: at, kind: 'store', from: state.leakSlot.holder,
      index: state.leakSlot.index, to: id });
    state.leakHead = id;
    state.leaked += 1;
  }

  /** Root slot 0 holds the retained spine and is never reused; the rest rotate. */
  function rotateRoot(state, rng, id) {
    const slot = state.roots.length < state.rootSlots
      ? state.roots.length
      : 1 + Math.floor(rng.next() * (state.rootSlots - 1));

    state.roots[slot] = id;
  }

  /**
   * Two objects pointing at each other, held from a rotating root slot. When
   * the slot is overwritten the pair is unreachable and both counts are still
   * 1, so a reference counter leaks it and a tracing collector does not. That
   * difference is the whole of 31.2 and it has to be IN the trace, not
   * described beside it.
   */
  function makeCycle(state, rng, id, at) {
    const partner = allocateSynthetic(state, rng, at);

    state.events.push({ at: at, kind: 'store', from: id, index: 0, to: partner });
    state.events.push({ at: at, kind: 'store', from: partner, index: 0, to: id });
    rotateRoot(state, rng, id);
    state.registers.length = 0;
    return emitRoots(state, at);
  }

  function emitRoots(state, at) {
    const rows = state.roots.slice();

    state.registers.forEach(function (id) {
      if (rows.indexOf(id) === -1) rows.push(id);
    });
    state.events.push({ at: at, kind: 'roots',
      roots: rows.sort(function (a, b) { return a - b; }), live: 0 });
    return null;
  }

  /* ------------------------------------------------------------- the heap */

  /**
   * The heap the collectors work on. Objects are ids with a size, a list of
   * outgoing references and whatever per-collector state that collector
   * needs — a mark bit, an age, a forwarding address, a region. Keeping all
   * of that in one record rather than in each collector is what lets the
   * comparison table run four designs over one trace.
   */
  function makeHeap(options) {
    const settings = options || {};

    return { cells: new Map(), roots: [], bytes: 0, next: 0,
      capacity: settings.capacity || 4096, allocated: 0, freed: 0,
      peak: 0, collections: 0, log: [] };
  }

  /**
   * Allocation is a bump: the object gets the next address and the pointer
   * moves by its size. A real address rather than a derived one matters in
   * two places — the fragmentation strip in 31.3, where holes have to be
   * where the freed objects actually were, and the card table in 31.4, whose
   * whole model is "one byte per fixed span of the heap". The first version
   * of this file derived an address from the object id, which overlaps as
   * soon as an object is larger than the stride, and a heap whose objects
   * overlap has no fragmentation to measure.
   */
  function allocate(heap, row) {
    heap.cells.set(row.id, { id: row.id, size: row.size, site: row.site,
      kind: row.objectKind || row.kind, refs: [], colour: 'white', age: 0,
      address: heap.next, forwarded: null, region: 0, count: 0, bornAt: row.at || 0 });
    heap.next += row.size;
    heap.bytes += row.size;
    heap.allocated += row.size;
    heap.peak = Math.max(heap.peak, heap.bytes);
    return heap.cells.get(row.id);
  }

  function store(heap, from, index, to) {
    const cell = heap.cells.get(from);

    if (!cell) return null;
    while (cell.refs.length <= index) cell.refs.push(null);
    cell.refs[index] = to;
    return cell;
  }

  function free(heap, id) {
    const cell = heap.cells.get(id);

    if (!cell) return 0;
    heap.cells.delete(id);
    heap.bytes -= cell.size;
    heap.freed += cell.size;
    return cell.size;
  }

  /**
   * Replay a trace into a heap with NO collector running, up to a point. That
   * is the heap a stop-the-world collection is handed, and it is what every
   * section that wants to look at one collection rather than a whole run
   * starts from.
   */
  function build(trace, upto, options) {
    const heap = makeHeap(options);
    const limit = upto === undefined ? trace.events.length : upto;

    trace.events.slice(0, limit).forEach(function (event) {
      if (event.kind === 'alloc') { allocate(heap, event); return; }
      if (event.kind === 'store') { store(heap, event.from, event.index, event.to); return; }
      if (event.kind === 'roots') heap.roots = event.roots.slice();
    });
    return heap;
  }

  /**
   * A deep copy, so one heap can be handed to several collectors and each of
   * them gets the same starting point. Comparing two collectors on two
   * different heaps measures the heaps.
   */
  function clone(heap) {
    const copy = makeHeap({ capacity: heap.capacity });

    heap.cells.forEach(function (cell, id) {
      copy.cells.set(id, Object.assign({}, cell, { refs: cell.refs.slice() }));
    });
    copy.roots = heap.roots.slice();
    copy.bytes = heap.bytes;
    copy.next = heap.next;
    copy.allocated = heap.allocated;
    copy.freed = heap.freed;
    copy.peak = heap.peak;
    return copy;
  }

  /**
   * A heap dump: the trace replayed to a point, with everything unreachable
   * dropped. That is what a snapshot tool gives you and it is why a snapshot
   * cannot show you garbage — the collector runs first, so a heap dump is a
   * picture of what is RETAINED, and the only question it can answer is which
   * reference is doing the retaining.
   */
  function snapshot(trace, upto, options) {
    const heap = build(trace, upto, options);
    const live = reachable(heap, heap.roots);

    Array.from(heap.cells.keys()).forEach(function (id) {
      if (!live.has(id)) free(heap, id);
    });
    return heap;
  }

  /* ------------------------------------------------------------ the oracle */

  /**
   * Reachability from the roots, by a plain breadth-first walk that shares no
   * code with any collector. This is the only thing in the milestone that is
   * allowed to be the definition of "live", and everything else is checked
   * against it.
   */
  function reachable(heap, roots) {
    const live = new Set();
    const queue = (roots || heap.roots).slice();

    while (queue.length) {
      const id = queue.shift();

      if (live.has(id) || !heap.cells.has(id)) continue;
      live.add(id);
      heap.cells.get(id).refs.forEach(function (child) {
        if (child !== null && child !== undefined) queue.push(child);
      });
    }
    return live;
  }

  function unreachable(heap, roots) {
    const live = reachable(heap, roots);

    return Array.from(heap.cells.keys()).filter(function (id) { return !live.has(id); });
  }

  /** Live bytes now, which is the number a collector's cost should track. */
  function liveBytes(heap, roots) {
    let total = 0;

    reachable(heap, roots).forEach(function (id) { total += heap.cells.get(id).size; });
    return total;
  }

  return {
    HEADER_BYTES: HEADER_BYTES, WORD_BYTES: WORD_BYTES,
    isObject: isObject, referencesOf: referencesOf, sizeOf: sizeOf,
    record: record, synthetic: synthetic, siteTable: siteTable,
    makeHeap: makeHeap, allocate: allocate, store: store, free: free,
    build: build, clone: clone, snapshot: snapshot,
    reachable: reachable, unreachable: unreachable, liveBytes: liveBytes
  };
}));

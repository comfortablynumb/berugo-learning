/**
 * Copying and generational collection.
 *
 * Cheney's algorithm is the whole of semi-space copying and it is three
 * facts. Allocation is a pointer bump, because free space is always one
 * contiguous run. Collection copies the LIVE objects to the other space, so
 * its cost is proportional to what survives rather than to the heap. And the
 * to-space itself is the work list — the scan pointer chases the allocation
 * pointer — so no auxiliary mark stack exists to overflow.
 *
 * The generational hypothesis is the empirical claim that most objects die
 * young, and it turns that cost model into a strategy: collect only the
 * nursery, where almost nothing survives, and almost nothing gets copied.
 * `survivalCurve` measures the hypothesis on the trace at hand rather than
 * quoting it, because a workload that violates it turns the same design into
 * the worst one available.
 *
 * The price is the write barrier. An old object pointing at a young one is a
 * root for a nursery collection, and finding those without scanning the old
 * generation is what remembered sets and card tables are for — which is
 * `gc-barriers.js`, next door.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.GcCopying = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function create(options) {
    const settings = options || {};

    return { name: settings.generational ? 'generational copying' : 'semi-space copying',
      about: settings.generational
        ? 'collect the nursery alone, promoting what survives'
        : 'copy the survivors to the other space; allocation is a pointer bump',
      generational: Boolean(settings.generational),
      nursery: settings.nursery === undefined ? 512 : settings.nursery,
      promoteAfter: settings.promoteAfter === undefined ? 2 : settings.promoteAfter,
      copied: 0, promoted: 0, minor: 0, major: 0 };
  }

  /* ------------------------------------------------------------- Cheney */

  /**
   * Copy the reachable objects into a fresh space, breadth-first, with the
   * to-space acting as its own queue. A forwarding address in the old cell is
   * what makes a second visit cheap and is why the algorithm needs no mark
   * bit at all: "already copied" and "here is where it went" are one field.
   */
  function cheney(heap, roots, filter) {
    const run = { moved: new Map(), order: [], scanned: new Set(), bytes: 0, external: 0 };

    roots.forEach(function (id) { enterRoot(heap, run, id, filter); });
    drain(heap, run, filter);
    return { moved: run.order, bytes: run.bytes, external: run.external,
      scanned: run.order.length + run.external };
  }

  /**
   * A root OUTSIDE the collected generation is scanned but never copied, and
   * getting that distinction wrong is the whole of the generational bug.
   *
   * The first version of this function ran every root through the same filter
   * as every other object, so an old root — the program's long-lived
   * container, or an entry handed over from the remembered set — was rejected
   * and therefore never scanned. Its young children were unreachable to the
   * collector and were freed while live: 16 live objects lost, with all three
   * barrier settings producing the identical failure, which is what said the
   * barrier was not the problem. An old object is not collected here; its
   * references into the nursery still have to be followed.
   */
  function enterRoot(heap, run, id, filter) {
    const cell = heap.cells.get(id);

    if (!cell) return;
    if (!filter || filter(cell)) { run.bytes += forward(heap, run, id, filter); return; }
    if (run.scanned.has(id)) return;
    run.scanned.add(id);
    run.external += 1;
    cell.refs.forEach(function (child) {
      if (child === null || child === undefined) return;
      run.bytes += forward(heap, run, child, filter);
    });
  }

  function drain(heap, run, filter) {
    let scan = 0;

    while (scan < run.order.length) {
      const cell = heap.cells.get(run.order[scan]);

      scan += 1;
      /* In this model an object keeps its identity across a copy, so the
         pointer fix-up every real Cheney collector performs here — rewrite
         each reference to the forwarding address — is the identity. The
         forwarding map still exists, because "already copied" and "where it
         went" are one field and that is the algorithm's whole trick. */
      cell.refs.forEach(function (child) {
        if (child === null || child === undefined) return;
        run.bytes += forward(heap, run, child, filter);
      });
    }
  }

  function forward(heap, run, id, filter) {
    const cell = heap.cells.get(id);

    if (!cell || run.moved.has(id)) return 0;
    run.moved.set(id, id);
    if (filter && !filter(cell)) return 0;
    run.order.push(id);
    return cell.size;
  }

  /* ------------------------------------------------------------ collection */

  function collect(heap, state, why) {
    if (!state.generational) return fullCopy(heap, state, why);
    return minorCollect(heap, state, why);
  }

  function fullCopy(heap, state, why) {
    const before = heap.cells.size;
    const out = cheney(heap, heap.roots.slice(), null);
    const survivors = new Set(out.moved);
    const reclaimed = [];

    heap.cells.forEach(function (cell, id) { if (!survivors.has(id)) reclaimed.push(id); });
    reclaimed.forEach(function (id) { drop(heap, id); });
    state.copied += out.bytes;
    state.major += 1;
    return { why: why, reclaimed: reclaimed, work: out.moved.length + out.scanned,
      copied: out.bytes, promoted: 0, promotedIds: [], survivorIds: out.moved,
      survivors: survivors.size, before: before, generation: 'full' };
  }

  /**
   * A minor collection traces only the young objects, and its roots are the
   * program's roots PLUS every old object that points into the nursery.
   * Missing one of those is the classic generational bug: an object that is
   * genuinely reachable, from a generation the collector did not look at,
   * gets freed. The remembered set is the whole answer and it is passed in.
   */
  function minorCollect(heap, state, why) {
    const young = function (cell) { return cell.age < state.promoteAfter; };
    const extra = heap.remembered ? Array.from(heap.remembered) : [];
    const roots = heap.roots.concat(extra);
    const out = cheney(heap, roots, young);
    const survivors = new Set(out.moved);
    const reclaimed = [];

    heap.cells.forEach(function (cell, id) {
      if (!young(cell) || survivors.has(id)) return;
      reclaimed.push(id);
    });
    reclaimed.forEach(function (id) { drop(heap, id); });
    return finishMinor(heap, state, why, { survivors: survivors, out: out,
      reclaimed: reclaimed });
  }

  function finishMinor(heap, state, why, run) {
    const promotedIds = [];
    let promoted = 0;

    run.survivors.forEach(function (id) {
      const cell = heap.cells.get(id);

      if (!cell) return;
      cell.age += 1;
      if (cell.age !== state.promoteAfter) return;
      promoted += cell.size;
      promotedIds.push(id);
    });
    state.copied += run.out.bytes;
    state.promoted += promoted;
    state.minor += 1;
    return { why: why, reclaimed: run.reclaimed,
      work: run.out.moved.length + run.out.scanned,
      copied: run.out.bytes, promoted: promoted, promotedIds: promotedIds,
      survivorIds: run.out.moved, survivors: run.survivors.size,
      external: run.out.external, generation: 'nursery' };
  }

  function drop(heap, id) {
    const cell = heap.cells.get(id);

    if (!cell) return;
    heap.cells.delete(id);
    heap.bytes -= cell.size;
    heap.freed += cell.size;
  }

  /* ------------------------------------------------------- the hypothesis */

  /**
   * The weak generational hypothesis, measured rather than quoted: of the
   * objects allocated in each window of the trace, how many are still
   * reachable a window later. A workload where that number is high turns the
   * generational design from the best available into the worst, because every
   * minor collection copies nearly everything it touches.
   */
  function survivalCurve(trace, windows) {
    const count = windows || 8;
    const size = Math.max(1, Math.ceil(trace.steps / count));
    const rows = [];

    for (let window = 0; window < count; window += 1) {
      rows.push(windowRow(trace, window, size));
    }
    return rows.filter(function (row) { return row.allocated > 0; });
  }

  /**
   * The horizon IS the measurement, and it has to be said out loud. "Still
   * live at the end of the window" is the fraction a minor collection over a
   * nursery of that size actually copies, and it is the number the
   * generational cost model wants. "Still live a window later" is a different
   * and equally true number, always smaller, and quoting one while meaning
   * the other is how a survival rate ends up disagreeing with the collector
   * measured beside it. Both are reported.
   */
  function windowRow(trace, window, size) {
    const from = window * size;
    const to = from + size;
    const born = trace.objects.filter(function (row) {
      return row.bornAt >= from && row.bornAt < to;
    });
    const atEnd = liveAt(trace, to);
    const later = liveAt(trace, to + size);
    const survivors = born.filter(function (row) { return atEnd.has(row.id); });
    const held = born.filter(function (row) { return later.has(row.id); });

    return { window: window, from: from, to: to, allocated: born.length,
      survived: survivors.length, stillLater: held.length,
      rate: born.length ? survivors.length / born.length : 0,
      rateLater: born.length ? held.length / born.length : 0,
      bytes: born.reduce(function (sum, row) { return sum + row.size; }, 0),
      survivorBytes: survivors.reduce(function (sum, row) { return sum + row.size; }, 0) };
  }

  /** Reachable at a point in the trace, replayed from the events. */
  function liveAt(trace, at) {
    const edges = new Map();
    let roots = [];

    trace.events.forEach(function (event) {
      if (event.at > at) return;
      if (event.kind === 'alloc') edges.set(event.id, []);
      if (event.kind === 'store') setEdge(edges, event);
      if (event.kind === 'roots') roots = event.roots;
    });
    return walk(edges, roots);
  }

  function setEdge(edges, event) {
    const refs = edges.get(event.from) || [];

    while (refs.length <= event.index) refs.push(null);
    refs[event.index] = event.to;
    edges.set(event.from, refs);
  }

  function walk(edges, roots) {
    const live = new Set();
    const queue = roots.slice();

    while (queue.length) {
      const id = queue.shift();

      if (live.has(id) || !edges.has(id)) continue;
      live.add(id);
      edges.get(id).forEach(function (child) {
        if (child !== null && child !== undefined) queue.push(child);
      });
    }
    return live;
  }

  return { create: create, cheney: cheney, collect: collect,
    fullCopy: fullCopy, minorCollect: minorCollect,
    survivalCurve: survivalCurve, liveAt: liveAt };
}));

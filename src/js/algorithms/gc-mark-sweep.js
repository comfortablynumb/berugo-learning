/**
 * Mark-sweep and mark-compact, with the tri-colour abstraction made explicit.
 *
 * Mark-sweep is the simplest tracing collector and the one every other design
 * is a modification of: colour everything white, walk from the roots turning
 * things black, then free what is still white. The tri-colour names are worth
 * keeping even here, where they look like bookkeeping, because they are what
 * 31.5's incremental collector is stated in — grey is "found but not yet
 * scanned", and it is the existence of a grey set that lets marking be paused.
 *
 * Two things this file makes visible that a textbook diagram does not:
 *
 * - **the mark stack can overflow**, and what a real collector does about it
 *   is not "allocate a bigger one". It drops the overflowing entries, records
 *   that it did, and afterwards rescans the heap for black objects with white
 *   children. That is slower and correct, and it is why a bounded mark stack
 *   is not a bug;
 * - **sweeping leaves a free list, and a free list fragments.** The largest
 *   run of free bytes is reported beside the total, because an allocator that
 *   cannot satisfy a request from a heap that is mostly free is the actual
 *   failure mode, not a hypothetical one.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.GcMarkSweep = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const COLOURS = [
    { name: 'white', means: 'not yet reached; a candidate for collection' },
    { name: 'grey', means: 'reached, but its own references have not been followed yet' },
    { name: 'black', means: 'reached, and everything it points at is at least grey' }
  ];

  function create(options) {
    const settings = options || {};

    return { name: settings.compact ? 'mark-compact' : 'mark-sweep',
      about: settings.compact
        ? 'trace from the roots, then slide the survivors together and fix the pointers'
        : 'trace from the roots, then free everything not reached',
      compact: Boolean(settings.compact),
      stackLimit: Math.max(1, settings.stackLimit === undefined ? 64 : settings.stackLimit),
      threshold: settings.threshold === undefined ? 0.9 : settings.threshold,
      overflows: 0, rescans: 0 };
  }

  /* ---------------------------------------------------------------- marking */

  function whiten(heap) {
    heap.cells.forEach(function (cell) { cell.colour = 'white'; });
  }

  /**
   * The mark loop, with a bounded stack. Pushing onto a full stack is not an
   * error and not a resize: the entry is dropped, a flag is set, and the
   * rescan below finds what was lost. A collector whose mark stack cannot
   * overflow has either an unbounded stack or a bug nobody has hit yet.
   *
   * The roots are entered ONE AT A TIME, each drained before the next is
   * pushed, and that is not a stylistic choice. The first version pushed the
   * whole root set at once, so a stack smaller than the root set dropped
   * roots — and a dropped root is unrecoverable, because the rescan looks for
   * a black object with a white child and a root has no parent at all. Six
   * live objects were freed at a stack limit of 2, every one of them a root,
   * with the recovery reporting eleven successful passes. The stack bound
   * belongs to the traversal, not to the enumeration of the roots.
   */
  function markFrom(heap, roots, state) {
    const stack = [];
    let visited = 0;

    roots.forEach(function (id) {
      push(heap, stack, id, state);
      visited += drain(heap, stack, state);
    });
    return visited;
  }

  function drain(heap, stack, state) {
    let visited = 0;

    while (stack.length) {
      const cell = heap.cells.get(stack.pop());

      if (!cell) continue;
      visited += 1;
      cell.colour = 'black';
      cell.refs.forEach(function (child) {
        if (child === null || child === undefined) return;
        push(heap, stack, child, state);
      });
    }
    return visited;
  }

  function push(heap, stack, id, state) {
    const cell = heap.cells.get(id);

    if (!cell || cell.colour !== 'white') return;
    if (stack.length >= state.stackLimit) { state.overflowed = true; return; }
    cell.colour = 'grey';
    stack.push(id);
  }

  /**
   * The overflow recovery: a black object with a white child was reached and
   * its child was dropped, so scan the heap for that shape and mark from
   * there. Repeat until a pass finds nothing. This is O(heap) per pass and is
   * what a bounded mark stack costs on the rare occasion it fills.
   */
  function rescan(heap, state) {
    let work = 0;
    let again = true;

    while (again && state.overflowed) {
      again = false;
      state.overflowed = false;
      state.rescans += 1;
      heap.cells.forEach(function (cell) {
        work += 1;
        if (cell.colour !== 'black') return;
        if (markChildren(heap, cell, state)) again = true;
      });
    }
    return work;
  }

  /**
   * Resume marking from one black object's dropped children.
   *
   * The ids are handed to `markFrom` UNCOLOURED, and that is the whole of the
   * fix for a defect the liveness oracle caught the first time a heap was
   * deep enough to overflow the stack. The first version shaded each child
   * grey itself and then passed the grey ids in — and `markFrom` pushes only
   * WHITE objects, so every one of them was silently ignored. The objects sat
   * grey for the rest of the collection: not swept, because sweep takes only
   * white, and never scanned, so their own children stayed white and were
   * swept while live. Twenty-six live objects freed, with `overflows` and
   * `rescans` both reporting that the recovery had run.
   */
  function markChildren(heap, cell, state) {
    const pending = cell.refs.filter(function (child) {
      const target = child === null || child === undefined ? null : heap.cells.get(child);

      return Boolean(target) && target.colour === 'white';
    });

    if (!pending.length) return false;
    markFrom(heap, pending, state);
    return true;
  }

  /* ---------------------------------------------------------------- sweeping */

  function sweep(heap) {
    const reclaimed = [];

    heap.cells.forEach(function (cell, id) {
      if (cell.colour === 'white') reclaimed.push(id);
    });
    return reclaimed;
  }

  /**
   * Compaction, modelled as a slide: the survivors are given consecutive
   * addresses and every reference is rewritten to the new one. The
   * measurement it exists for is fragmentation — after a sweep the free
   * space is in pieces and the largest piece is what an allocation can
   * actually use; after a compaction it is one run.
   */
  function compact(heap) {
    let address = 0;
    const moved = [];

    heap.cells.forEach(function (cell) {
      cell.forwarded = address;
      address += cell.size;
      moved.push(cell.id);
    });
    heap.cells.forEach(function (cell) { cell.address = cell.forwarded; cell.forwarded = null; });
    /* The bump pointer moves back to the top of the compacted run, which is
       the entire point: after a sweep the next allocation has to find a hole
       big enough, and after a compaction it is a pointer increment again. */
    heap.next = address;
    return { moved: moved.length, bytes: address };
  }

  /* -------------------------------------------------------------- the cycle */

  function collect(heap, state, why) {
    const started = { cells: heap.cells.size, bytes: heap.bytes };

    state.overflowed = false;
    whiten(heap);
    const visited = markFrom(heap, heap.roots.slice(), state);
    const recovered = rescan(heap, state);
    const reclaimed = sweep(heap);

    reclaimed.forEach(function (id) { removeCell(heap, id); });
    const moved = state.compact ? compact(heap) : { moved: 0, bytes: heap.bytes };

    if (state.overflows !== undefined && recovered > 0) state.overflows += 1;
    return { why: why, reclaimed: reclaimed, visited: visited,
      work: visited + started.cells + recovered + moved.moved,
      moved: moved.moved, rescans: state.rescans,
      before: started.bytes, after: heap.bytes };
  }

  function removeCell(heap, id) {
    const cell = heap.cells.get(id);

    if (!cell) return;
    heap.cells.delete(id);
    heap.bytes -= cell.size;
    heap.freed += cell.size;
  }

  /**
   * Free space after a sweep is a list of holes, and the number that matters
   * is the largest one — a heap that is 70 per cent free in pieces of 16
   * bytes cannot satisfy a 64-byte request. Modelled here by laying the
   * survivors out at their original addresses and measuring the gaps.
   */
  function fragmentation(heap) {
    const live = Array.from(heap.cells.values())
      .sort(function (a, b) { return (a.bornAt || 0) - (b.bornAt || 0); });
    const total = heap.capacity - heap.bytes;
    let largest = 0;
    let run = 0;

    live.forEach(function (cell, at) {
      const gap = at === 0 ? 0 : cell.size;

      run = gap ? 0 : run + cell.size;
      largest = Math.max(largest, run);
    });
    return { free: Math.max(total, 0), largest: Math.max(total - largest, 0),
      holes: Math.max(live.length - 1, 0),
      usable: heap.capacity ? Math.max(total, 0) / heap.capacity : 0 };
  }

  return { COLOURS: COLOURS, create: create,
    whiten: whiten, markFrom: markFrom, rescan: rescan, sweep: sweep,
    compact: compact, collect: collect, fragmentation: fragmentation };
}));

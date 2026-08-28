/**
 * Incremental and concurrent marking, and the one bug barriers exist for.
 *
 * A stop-the-world mark grows with the heap, so a large heap means a long
 * pause. Marking incrementally — a slice of work, then the program runs, then
 * another slice — bounds the pause, and immediately introduces the only
 * correctness bug a garbage collector must never have.
 *
 * **The black-to-white pointer.** While marking is paused, the program can
 * store a reference to a white (not yet reached) object into a black (already
 * scanned) one, and then drop the only other reference to it. The collector
 * will not revisit the black object, so the white object is never reached and
 * is freed while live. That is it. Every barrier design in every concurrent
 * collector is a different way of preventing that one shape, and this file
 * constructs it deliberately, watches the object be lost without a barrier,
 * and then shows each barrier preventing it.
 *
 * Two barriers, two invariants, two different amounts of floating garbage:
 *
 * - **incremental update** (Dijkstra): when a black object is given a white
 *   child, shade the child grey. Precise, and the child may still die before
 *   the mark finishes, which the next cycle collects;
 * - **snapshot at the beginning** (Yuasa): when a reference is OVERWRITTEN,
 *   shade the old target grey. This marks the heap as it was when the cycle
 *   started, so anything that dies during the cycle survives it — floating
 *   garbage, traded for a barrier that never has to look at the new value.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.GcIncremental = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const Random = scope && scope.Random ? scope.Random : require('../utils/random.js');

  const BARRIERS = [
    { id: 'none', name: 'no barrier',
      invariant: 'none — marking assumes the graph does not change',
      keeps: 'nothing; a black-to-white store loses the object' },
    { id: 'update', name: 'incremental update (Dijkstra)',
      invariant: 'no black object points at a white one',
      keeps: 'exactly what is reachable when marking ends' },
    { id: 'satb', name: 'snapshot at the beginning (Yuasa)',
      invariant: 'everything reachable when marking STARTED stays marked',
      keeps: 'that, plus anything that died during the cycle — floating garbage' }
  ];

  function create(options) {
    const settings = options || {};

    return { name: 'incremental marking', barrier: settings.barrier || 'update',
      slice: settings.slice === undefined ? 8 : settings.slice,
      grey: [], marking: false, shaded: 0, slices: 0, work: 0 };
  }

  /* ------------------------------------------------------------- the cycle */

  function begin(heap, state) {
    heap.cells.forEach(function (cell) { cell.colour = 'white'; });
    state.grey = [];
    state.marking = true;
    state.shaded = 0;
    state.slices = 0;
    heap.roots.forEach(function (id) { shade(heap, state, id); });
    return state.grey.length;
  }

  function shade(heap, state, id) {
    const cell = heap.cells.get(id);

    if (!cell || cell.colour !== 'white') return false;
    cell.colour = 'grey';
    state.grey.push(id);
    state.shaded += 1;
    return true;
  }

  /**
   * One slice of marking: pop grey objects, scan their references, turn them
   * black. The program runs between slices, which is where the barrier earns
   * its keep.
   */
  function step(heap, state, budget) {
    const limit = budget || state.slice;
    let done = 0;

    state.slices += 1;
    while (state.grey.length && done < limit) {
      const cell = heap.cells.get(state.grey.pop());

      done += 1;
      if (!cell) continue;
      cell.colour = 'black';
      cell.refs.forEach(function (child) {
        if (child !== null && child !== undefined) shade(heap, state, child);
      });
    }
    state.work += done;
    if (!state.grey.length) state.marking = false;
    return { scanned: done, remaining: state.grey.length, finished: !state.marking };
  }

  /**
   * The barrier, on every pointer store while a mark is in progress. Reading
   * the three cases together is the whole of the subject: one does nothing
   * and loses objects, one shades the new target, and one shades the old.
   */
  function store(heap, state, event) {
    if (!state.marking || state.barrier === 'none') return applyStore(heap, event);
    if (state.barrier === 'satb') {
      const cell = heap.cells.get(event.from);
      const before = cell ? cell.refs[event.index] : null;

      if (before !== null && before !== undefined) shade(heap, state, before);
      return applyStore(heap, event);
    }
    const written = applyStore(heap, event);
    const target = heap.cells.get(event.from);

    if (target && target.colour === 'black' && event.to !== null) {
      shade(heap, state, event.to);
    }
    return written;
  }

  function applyStore(heap, event) {
    const cell = heap.cells.get(event.from);

    if (!cell) return false;
    while (cell.refs.length <= event.index) cell.refs.push(null);
    cell.refs[event.index] = event.to;
    return true;
  }

  function finish(heap, state) {
    const reclaimed = [];

    heap.cells.forEach(function (cell, id) {
      if (cell.colour === 'white') reclaimed.push(id);
    });
    reclaimed.forEach(function (id) { drop(heap, id); });
    state.marking = false;
    return { reclaimed: reclaimed, shaded: state.shaded, slices: state.slices,
      work: state.work };
  }

  function drop(heap, id) {
    const cell = heap.cells.get(id);

    if (!cell) return;
    heap.cells.delete(id);
    heap.bytes -= cell.size;
    heap.freed += cell.size;
  }

  /* ------------------------------------------------- the lost-object scenario */

  /**
   * The bug, constructed. Two objects and one reference: a black container
   * and a white value held only by a grey object that is about to drop it.
   * The store moves the value into the black container — which will not be
   * rescanned — and the drop removes the only path the marker would have
   * taken. Without a barrier, the value is white when marking ends.
   */
  function lostObjectScenario(makeHeap) {
    const heap = makeHeap();

    ['container', 'holder', 'value'].forEach(function (name, at) {
      heap.cells.set(at, { id: at, size: 16, refs: [], colour: 'white', age: 0,
        count: 0, name: name, kind: 'record' });
      heap.bytes += 16;
    });
    heap.cells.get(1).refs = [2];
    heap.roots = [0, 1];
    return heap;
  }

  /**
   * Run the scenario under one barrier and report whether the value survived.
   * The answer for `none` has to be that it did not, or the other two rows
   * are demonstrating nothing.
   */
  function runScenario(makeHeap, barrier) {
    const heap = lostObjectScenario(makeHeap);
    const state = create({ barrier: barrier, slice: 1 });

    begin(heap, state);
    /* The container is scanned FIRST and the holder is not scanned yet. That
       ordering is the bug's precondition and it has to be forced rather than
       hoped for: with an arbitrary grey order the marker may reach the value
       through the holder before the store happens, and then nothing is lost
       and nothing is demonstrated. */
    blacken(heap, state, 0);
    store(heap, state, { from: 0, index: 0, to: 2 });
    store(heap, state, { from: 1, index: 0, to: null });
    while (state.marking) step(heap, state, 4);
    const out = finish(heap, state);

    return { barrier: barrier, reclaimed: out.reclaimed,
      lost: out.reclaimed.indexOf(2) !== -1,
      shaded: out.shaded, live: heap.cells.size,
      survived: heap.cells.has(2) };
  }

  /** Scan one grey object to completion, which is what turns it black. */
  function blacken(heap, state, id) {
    const cell = heap.cells.get(id);
    const at = state.grey.indexOf(id);

    if (!cell) return false;
    if (at !== -1) state.grey.splice(at, 1);
    cell.colour = 'black';
    cell.refs.forEach(function (child) {
      if (child !== null && child !== undefined) shade(heap, state, child);
    });
    if (!state.grey.length) state.marking = false;
    return true;
  }

  /**
   * Floating garbage: objects the collector kept that were already
   * unreachable when it finished. It is the price of snapshot-at-the-
   * beginning and the reason a concurrent collector needs headroom.
   */
  /**
   * The adversarial interleaving harness, and the reason it has to be
   * randomised rather than scripted.
   *
   * `runScenario` above builds the black-to-white pointer by hand, which
   * proves the barrier handles THAT shape. It proves nothing about the ones
   * nobody thought of. So this generates a random object graph, begins a
   * mark, and then interleaves random pointer stores with marking slices in a
   * random order — which is exactly the mutator running concurrently — and
   * checks the reclaimed set against a liveness oracle it does not own.
   *
   * The barrier-free variant has to FAIL this, and the count of runs it fails
   * on is reported rather than asserted away. A harness on which every
   * configuration passes is a harness that is not testing anything.
   */
  function stress(makeHeap, reachable, options) {
    const settings = options || {};
    const rng = Random.seeded(settings.seed || 11);
    const out = { runs: 0, lost: 0, lostObjects: 0, floating: 0, reclaimed: 0 };

    for (let at = 0; at < (settings.runs || 200); at += 1) {
      tally(out, oneRun(makeHeap, reachable, rng, settings));
    }
    return Object.assign({ barrier: settings.barrier || 'update' }, out);
  }

  function tally(out, run) {
    out.runs += 1;
    out.reclaimed += run.reclaimed;
    out.floating += run.floating;
    out.lostObjects += run.lost;
    if (run.lost) out.lost += 1;
  }

  function oneRun(makeHeap, reachable, rng, settings) {
    const heap = randomHeap(makeHeap, rng, settings);
    const state = create({ barrier: settings.barrier || 'update', slice: 1 });

    begin(heap, state);
    heap.roots.forEach(function (id) { shade(heap, state, id); });
    interleave(heap, state, reachable, rng, settings);
    const live = reachable(heap, heap.roots);
    const done = finish(heap, state);

    return { lost: done.reclaimed.filter(function (id) { return live.has(id); }).length,
      reclaimed: done.reclaimed.length,
      floating: live.size ? countUnreclaimed(heap, live) : 0 };
  }

  function countUnreclaimed(heap, live) {
    let total = 0;

    heap.cells.forEach(function (cell, id) { if (!live.has(id)) total += 1; });
    return total;
  }

  function randomHeap(makeHeap, rng, settings) {
    const heap = makeHeap();
    const count = settings.objects || 12;

    for (let id = 0; id < count; id += 1) {
      heap.cells.set(id, { id: id, size: 16, refs: [], colour: 'white', age: 0,
        count: 0, kind: 'record', address: id * 16 });
      heap.bytes += 16;
    }
    heap.cells.forEach(function (cell) {
      const fanOut = Math.floor(rng.next() * 3);

      for (let at = 0; at < fanOut; at += 1) {
        cell.refs.push(Math.floor(rng.next() * count));
      }
    });
    heap.roots = [0, 1 + Math.floor(rng.next() * (count - 1))];
    return heap;
  }

  /**
   * The interleaving itself: while marking is unfinished, either advance the
   * mark by one object or let the program perform one pointer store. Which of
   * the two happens is the coin flip, and it is the coin flip that a
   * stop-the-world collector does not have.
   */
  function interleave(heap, state, reachable, rng, settings) {
    const stores = settings.stores === undefined ? 6 : settings.stores;
    let made = 0;
    let guard = 0;

    while (state.marking && guard < 400) {
      guard += 1;
      if (made < stores && rng.next() < 0.5) {
        made += 1;
        store(heap, state, randomStore(heap, reachable, rng));
        continue;
      }
      step(heap, state, 1);
    }
  }

  /**
   * Both ends of the store are drawn from what is REACHABLE right now, and
   * that restriction is the harness modelling the mutator rather than
   * limiting it.
   *
   * A program cannot store into an object it cannot reach, and it cannot
   * store a reference it does not hold — every reference it has came from a
   * root or from a field of something it had already reached. The first
   * version of this harness drew both ends from the whole heap, which lets an
   * unreachable object become reachable again out of nowhere, and that failed
   * the snapshot-at-the-beginning barrier on 329 of 2 000 runs. The failures
   * were real given the stores, and the stores were impossible: SATB marks
   * the graph AS IT WAS when the cycle began, and its correctness argument
   * rests exactly on the fact that nothing outside that snapshot can be
   * published into it. The one case where a program can produce a genuinely
   * new reference is allocation, which is why every SATB collector allocates
   * black.
   */
  function randomStore(heap, reachable, rng) {
    const live = Array.from(reachable(heap, heap.roots));
    const from = live[Math.floor(rng.next() * live.length)];
    const cell = heap.cells.get(from);
    const index = Math.floor(rng.next() * Math.max(1, cell.refs.length + 1));
    const to = rng.next() < 0.15 ? null : live[Math.floor(rng.next() * live.length)];

    return { from: from, index: index, to: to };
  }

  function floating(heap, reclaimed) {
    const live = new Set();
    const queue = heap.roots.slice();

    while (queue.length) {
      const id = queue.shift();

      if (live.has(id) || !heap.cells.has(id)) continue;
      live.add(id);
      heap.cells.get(id).refs.forEach(function (child) {
        if (child !== null && child !== undefined) queue.push(child);
      });
    }
    return Array.from(heap.cells.keys()).filter(function (id) { return !live.has(id); });
  }

  return { BARRIERS: BARRIERS, create: create, begin: begin, step: step, store: store,
    finish: finish, shade: shade, blacken: blacken,
    lostObjectScenario: lostObjectScenario, runScenario: runScenario, floating: floating,
    stress: stress };
}));

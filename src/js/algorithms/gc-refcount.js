/**
 * Reference counting, and the cycle it cannot see.
 *
 * The whole design is one rule — every pointer store increments the new
 * target and decrements the old one, and a count reaching zero frees the
 * object immediately — and the whole of its reputation follows from two
 * consequences of that rule.
 *
 * **It reclaims immediately**, which is why a language that wants a
 * destructor to run at a predictable moment (Swift, CPython, C++'s
 * `shared_ptr`) reaches for it. There is no pause because there is no
 * collection: the work is spread evenly over every pointer write.
 *
 * **It cannot collect a cycle.** Two objects pointing at each other keep each
 * other's count above zero forever, whether or not anything else can reach
 * them. Trial deletion is the standard fix and is implemented here: subtract
 * the internal references from a candidate subgraph and see whether anything
 * is left over. It is a tracing collector wearing a different hat, which is
 * the honest way to describe every production reference-counting system.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.GcRefcount = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function create(options) {
    const settings = options || {};

    return { name: settings.deferred ? 'deferred reference counting' : 'reference counting',
      about: settings.deferred
        ? 'root stores are not counted; a periodic scan reconciles them'
        : 'every pointer store adjusts a count, and zero frees immediately',
      deferred: Boolean(settings.deferred),
      cycles: settings.cycles !== false,
      increments: 0, decrements: 0, immediate: 0, candidates: new Set() };
  }

  /* --------------------------------------------------------- the count rule */

  function retain(heap, state, id) {
    const cell = heap.cells.get(id);

    if (!cell) return;
    cell.count += 1;
    state.increments += 1;
    state.candidates.delete(id);
  }

  /**
   * A decrement to zero frees immediately and decrements the children, which
   * can cascade. A decrement to something above zero makes the object a
   * CANDIDATE for the cycle collector — because losing a reference is the
   * only way a cycle can become garbage, so nothing else needs examining.
   */
  function release(heap, state, id, reclaimed) {
    const cell = heap.cells.get(id);

    if (!cell) return;
    cell.count -= 1;
    state.decrements += 1;
    if (cell.count > 0) { if (state.cycles) state.candidates.add(id); return; }
    state.candidates.delete(id);
    freeCell(heap, state, id, reclaimed);
  }

  function freeCell(heap, state, id, reclaimed) {
    const cell = heap.cells.get(id);

    if (!cell) return;
    const children = cell.refs.slice();

    heap.cells.delete(id);
    heap.bytes -= cell.size;
    heap.freed += cell.size;
    state.immediate += 1;
    if (reclaimed) reclaimed.push(id);
    children.forEach(function (child) {
      if (child !== null && child !== undefined) release(heap, state, child, reclaimed);
    });
  }

  function store(heap, state, event, reclaimed) {
    const cell = heap.cells.get(event.from);
    const before = cell ? cell.refs[event.index] : null;

    if (event.to !== null && event.to !== undefined) retain(heap, state, event.to);
    if (before !== null && before !== undefined && before !== event.to) {
      release(heap, state, before, reclaimed);
    }
  }

  /**
   * Roots are counted too, so a value leaving the last frame that held it is
   * a decrement like any other. Deferred counting is the optimisation that
   * skips exactly these — most counting traffic is roots — at the price of a
   * periodic scan to reconcile, which is where its pause comes from.
   */
  function roots(heap, state, next, reclaimed) {
    const before = new Set(heap.roots);
    const after = new Set(next);

    after.forEach(function (id) { if (!before.has(id)) retain(heap, state, id); });
    before.forEach(function (id) { if (!after.has(id)) release(heap, state, id, reclaimed); });
    heap.roots = Array.from(after);
  }

  /* -------------------------------------------------------- trial deletion */

  /**
   * Bacon and Rajan's synchronous cycle collection, in its simplest form.
   * For each candidate, walk the subgraph it can reach and subtract the
   * references that come from INSIDE that subgraph. Anything left with a
   * positive count is referenced from outside and the whole subgraph is
   * live; if nothing is, the subgraph is a cycle nobody else can reach and
   * every object in it is garbage.
   */
  function collectCycles(heap, state) {
    const reclaimed = [];
    const examined = [];

    Array.from(state.candidates).forEach(function (id) {
      if (!heap.cells.has(id)) { state.candidates.delete(id); return; }
      const group = subgraph(heap, id);

      examined.push(group.size);
      if (externallyReferenced(heap, group)) return;
      group.forEach(function (member) {
        if (!heap.cells.has(member)) return;
        reclaimed.push(member);
        dropCell(heap, member);
      });
    });
    state.candidates.clear();
    return { reclaimed: reclaimed, groups: examined.length,
      work: examined.reduce(function (sum, size) { return sum + size; }, 0) };
  }

  function subgraph(heap, id) {
    const group = new Set();
    const queue = [id];

    while (queue.length) {
      const here = queue.shift();

      if (group.has(here) || !heap.cells.has(here)) continue;
      group.add(here);
      heap.cells.get(here).refs.forEach(function (child) {
        if (child !== null && child !== undefined) queue.push(child);
      });
    }
    return group;
  }

  /**
   * The trial: subtract every reference that originates inside the group. A
   * remaining count means somebody outside — a root, or an object not in the
   * group — still points at it.
   */
  function externallyReferenced(heap, group) {
    const internal = new Map();

    group.forEach(function (id) { internal.set(id, 0); });
    group.forEach(function (id) {
      heap.cells.get(id).refs.forEach(function (child) {
        if (internal.has(child)) internal.set(child, internal.get(child) + 1);
      });
    });
    let external = false;

    group.forEach(function (id) {
      if (heap.cells.get(id).count - internal.get(id) > 0) external = true;
      if (heap.roots.indexOf(id) !== -1) external = true;
    });
    return external;
  }

  function dropCell(heap, id) {
    const cell = heap.cells.get(id);

    if (!cell) return;
    heap.cells.delete(id);
    heap.bytes -= cell.size;
    heap.freed += cell.size;
  }

  /* -------------------------------------------------------- the two fixtures */

  /**
   * The cascade, which is the exception to "reference counting has no pause".
   *
   * A list of n nodes held by one root. Dropping that one reference takes the
   * head's count to zero, which frees it, which decrements its child, which
   * frees it, all the way down — n objects freed at ONE pointer store. The
   * work is spread evenly over every write until it very much is not, and a
   * runtime that promises predictable reclamation is promising this too.
   */
  function cascade(makeHeap, length) {
    const heap = makeHeap();
    const state = create({ cycles: false });

    for (let at = 0; at < length; at += 1) {
      heap.cells.set(at, { id: at, size: 16, refs: [], colour: 'white', age: 0,
        count: at === 0 ? 1 : 1, kind: 'record' });
      heap.bytes += 16;
      if (at > 0) heap.cells.get(at - 1).refs = [at];
    }
    heap.roots = [0];
    return dropHead(heap, state, length);
  }

  function dropHead(heap, state, length) {
    const reclaimed = [];
    const before = state.decrements;

    roots(heap, state, [], reclaimed);
    return { length: length, reclaimed: reclaimed.length,
      decrements: state.decrements - before, remaining: heap.cells.size,
      work: state.decrements - before };
  }

  /**
   * The cycle, stepped. Two objects pointing at each other, both held from a
   * root; the root is dropped and neither count reaches zero. The rows are
   * what the visualiser draws, and the last one is the leak.
   */
  function cycleScenario(makeHeap) {
    const heap = makeHeap();
    const state = create({ cycles: true });
    const rows = [];

    ['a', 'b', 'outside'].forEach(function (name, at) {
      heap.cells.set(at, { id: at, size: 24, refs: [], colour: 'white', age: 0,
        count: 0, name: name, kind: 'record' });
      heap.bytes += 24;
    });
    return runCycle(heap, state, rows);
  }

  function runCycle(heap, state, rows) {
    step(heap, state, rows, 'root holds a', function () { roots(heap, state, [0], []); });
    step(heap, state, rows, 'a.next = b', function () {
      store(heap, state, { from: 0, index: 0, to: 1 }, []);
      heap.cells.get(0).refs[0] = 1;
    });
    step(heap, state, rows, 'b.prev = a — the cycle closes', function () {
      store(heap, state, { from: 1, index: 0, to: 0 }, []);
      heap.cells.get(1).refs[0] = 0;
    });
    step(heap, state, rows, 'the root is dropped', function () { roots(heap, state, [2], []); });
    return { heap: heap, state: state, rows: rows,
      leaked: leaked(heap), candidates: Array.from(state.candidates) };
  }

  function step(heap, state, rows, label, act) {
    act();
    rows.push({ step: label, counts: [0, 1, 2].map(function (id) {
      const cell = heap.cells.get(id);

      return cell ? cell.count : null;
    }), live: heap.cells.size, unreachable: leaked(heap).length });
  }

  /* ----------------------------------------------------------- observations */

  /** Counting traffic per pointer store, which is the throughput cost. */
  function traffic(state) {
    const total = state.increments + state.decrements;

    return { increments: state.increments, decrements: state.decrements, total: total,
      immediate: state.immediate };
  }

  /** Objects with a positive count that nothing can reach: leaked cycles. */
  function leaked(heap) {
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

  return { create: create, retain: retain, release: release, store: store, roots: roots,
    collectCycles: collectCycles, subgraph: subgraph,
    cascade: cascade, cycleScenario: cycleScenario,
    externallyReferenced: externallyReferenced, traffic: traffic, leaked: leaked };
}));

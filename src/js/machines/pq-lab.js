/**
 * One harness for every priority queue in M05.
 *
 * A heap is anything with { name, push, pop, peek, size, checkInvariants,
 * stats, resetStats }, optionally with meld and decreaseKey. The lab builds an
 * operation mix once and replays *the same mix* against each implementation,
 * checking every pop against a sorted reference, so a comparison is a property
 * of the family rather than of the machine.
 *
 * The mixes matter as much as the structures, and each one exists to make a
 * different family look good: push-heavy favours the implicit heap, meld-heavy
 * is the case an array heap cannot do at all, and decrease-key-heavy is the
 * Dijkstra shape that Fibonacci heaps were designed for.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.PqLab = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const MIXES = ['push-heavy', 'balanced', 'pop-heavy', 'decrease-key', 'meld-heavy'];

  /** Builds the operation list. Every entry is { op, key, id } and nothing in
   *  the replay loop knows which mix produced it. */
  function operations(options) {
    const settings = options || {};
    const count = settings.count || 10000;
    const rng = settings.rng;
    const span = settings.span || 1000000;
    const kind = settings.kind || 'balanced';

    const shares = {
      'push-heavy': { push: 0.9, pop: 0.1, decrease: 0 },
      balanced: { push: 0.5, pop: 0.5, decrease: 0 },
      'pop-heavy': { push: 0.35, pop: 0.65, decrease: 0 },
      'decrease-key': { push: 0.25, pop: 0.15, decrease: 0.6 },
      'meld-heavy': { push: 0.5, pop: 0.5, decrease: 0 }
    }[kind] || { push: 0.5, pop: 0.5, decrease: 0 };

    const out = [];
    const live = [];
    let next = 0;

    for (let i = 0; i < count; i += 1) {
      const roll = rng.next();
      if (!live.length || roll < shares.push) {
        const id = 'n' + next;
        next += 1;
        const key = rng.int(span);
        live.push({ id: id, key: key });
        out.push({ op: 'push', key: key, id: id });
        continue;
      }
      if (roll < shares.push + shares.decrease) {
        const at = rng.int(live.length);
        const target = live[at];
        const key = Math.max(0, target.key - 1 - rng.int(Math.max(1, target.key)));
        target.key = key;
        out.push({ op: 'decreaseKey', key: key, id: target.id });
        continue;
      }
      /* A pop removes whatever the heap says is smallest, so the reference
         list has to drop the same one - the replay does that, not this. */
      out.push({ op: 'pop' });
      live.sort(function (a, b) { return a.key - b.key; });
      live.shift();
    }
    return out;
  }

  function applyOne(heap, step, reference) {
    if (step.op === 'push') {
      heap.push(step.key, step.id);
      reference.set(step.id, step.key);
      return null;
    }
    if (step.op === 'decreaseKey') {
      if (!heap.decreaseKey) return null;
      heap.decreaseKey(step.id, step.key);
      reference.set(step.id, step.key);
      return null;
    }

    const top = heap.pop();
    if (!reference.size) return top === undefined ? null : 'popped from an empty heap';
    let best = null;
    reference.forEach(function (key, id) {
      if (best === null || key < best.key) best = { id: id, key: key };
    });
    reference.delete(top.id);
    return top.key === best.key ? null : 'popped ' + top.key + ', the smallest was ' + best.key;
  }

  /** Replays the mix against one heap, checking invariants along the way. */
  function replay(options) {
    const heap = options.heap;
    const steps = options.operations;
    const checkEvery = options.checkEvery || 0;
    const reference = new Map();
    const errors = [];

    heap.resetStats();
    const started = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();

    for (let i = 0; i < steps.length && errors.length < 3; i += 1) {
      const mismatch = applyOne(heap, steps[i], reference);
      if (mismatch) errors.push('step ' + i + ': ' + mismatch);
      if (checkEvery && i % checkEvery === 0) {
        const invariants = heap.checkInvariants();
        if (!invariants.ok) errors.push('step ' + i + ': ' + invariants.errors[0]);
      }
    }

    /* Drain, and require the remaining keys to come out sorted. */
    const drained = [];
    while (heap.size()) drained.push(heap.pop().key);
    for (let i = 1; i < drained.length; i += 1) {
      if (drained[i] < drained[i - 1]) {
        errors.push('the drain came out unsorted at position ' + i);
        break;
      }
    }
    if (drained.length !== reference.size) {
      errors.push('drained ' + drained.length + ' keys, the reference holds ' + reference.size);
    }

    const elapsed = (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()) - started;
    return {
      name: heap.name,
      ok: errors.length === 0,
      errors: errors,
      stats: heap.stats(),
      elapsedMs: elapsed,
      drained: drained.length
    };
  }

  function compare(options) {
    return (options.builders || []).map(function (builder) {
      return replay({
        heap: builder.create(),
        operations: options.operations,
        checkEvery: options.checkEvery || 0
      });
    });
  }

  /** A meld workload: build k separate heaps and fold them together, which is
   *  the operation an array heap has to do in O(n). */
  function meldRun(builder, options) {
    const settings = options || {};
    const pieces = settings.pieces || 16;
    const each = settings.each || 1000;
    const rng = settings.rng;

    const heaps = [];
    for (let piece = 0; piece < pieces; piece += 1) {
      const heap = builder.create();
      for (let i = 0; i < each; i += 1) heap.push(rng.int(1000000), 'p' + piece + '-' + i);
      heaps.push(heap);
    }

    const target = heaps[0];
    target.resetStats();
    for (let piece = 1; piece < pieces; piece += 1) target.meld(heaps[piece]);

    const drained = [];
    while (target.size()) drained.push(target.pop().key);
    let sorted = true;
    for (let i = 1; i < drained.length; i += 1) {
      if (drained[i] < drained[i - 1]) { sorted = false; break; }
    }

    return {
      name: target.name,
      ok: sorted && drained.length === pieces * each,
      merged: drained.length,
      stats: target.stats()
    };
  }

  /* ------------------------------------------------------------- Dijkstra */

  /** A grid graph with random edge weights: enough structure to make the
   *  decrease-key pattern realistic without needing M13's graph machinery. */
  function gridGraph(options) {
    const settings = options || {};
    const side = settings.side || 100;
    const rng = settings.rng;
    const nodes = side * side;
    const adjacency = new Array(nodes);

    for (let i = 0; i < nodes; i += 1) adjacency[i] = [];
    for (let row = 0; row < side; row += 1) {
      for (let col = 0; col < side; col += 1) {
        const from = row * side + col;
        if (col + 1 < side) {
          const weight = 1 + rng.int(100);
          adjacency[from].push({ to: from + 1, weight: weight });
          adjacency[from + 1].push({ to: from, weight: weight });
        }
        if (row + 1 < side) {
          const weight = 1 + rng.int(100);
          adjacency[from].push({ to: from + side, weight: weight });
          adjacency[from + side].push({ to: from, weight: weight });
        }
      }
    }
    return { nodes: nodes, adjacency: adjacency, edges: adjacency.reduce(function (n, list) { return n + list.length; }, 0) };
  }

  /** Dijkstra, in the two shapes the sections compare.
   *
   *  `indexed` keeps one entry per node and calls decreaseKey, which needs a
   *  handle map and gives a queue bounded by V. `lazy` pushes a duplicate on
   *  every improvement and skips stale entries on the way out, which needs
   *  nothing from the queue and lets it grow to E. */
  function dijkstra(graph, source, builder, mode) {
    const queue = builder.create();
    const distance = new Array(graph.nodes).fill(Infinity);
    const done = new Array(graph.nodes).fill(false);
    let pushes = 0;
    let stale = 0;
    let maxQueue = 0;
    let settled = 0;

    distance[source] = 0;
    queue.push(0, source);
    pushes += 1;

    while (queue.size()) {
      maxQueue = Math.max(maxQueue, queue.size());
      const top = queue.pop();
      const node = top.id;

      if (mode === 'lazy') {
        if (done[node]) { stale += 1; continue; }
        if (top.key > distance[node]) { stale += 1; continue; }
      }
      done[node] = true;
      settled += 1;

      graph.adjacency[node].forEach(function (edge) {
        const candidate = distance[node] + edge.weight;
        if (candidate >= distance[edge.to]) return;
        const first = distance[edge.to] === Infinity;
        distance[edge.to] = candidate;

        if (mode === 'lazy' || first) {
          queue.push(candidate, edge.to);
          pushes += 1;
          return;
        }
        queue.decreaseKey(edge.to, candidate);
      });
    }

    return {
      name: queue.name,
      mode: mode,
      distance: distance,
      settled: settled,
      pushes: pushes,
      stale: stale,
      maxQueue: maxQueue,
      stats: queue.stats()
    };
  }

  return {
    MIXES: MIXES,
    operations: operations,
    replay: replay,
    compare: compare,
    meldRun: meldRun,
    gridGraph: gridGraph,
    dijkstra: dijkstra
  };
}));

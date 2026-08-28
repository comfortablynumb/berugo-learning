/**
 * Graded exercises for weak references, avoidance and diagnosis (M31.7-M31.9).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'weak-references': [{
      id: 'weak-then-finalise',
      title: 'Clear the weak references before the finalisers run',
      prompt: 'A heap is { cells: { id: { refs: [], finaliser, finalised } }, roots: [], ' +
        'weak: [{ holder, index }], queue: [] }. Write stronglyReachable(heap) returning the ' +
        'ids reachable WITHOUT following any registered weak slot, and collect(heap) which — ' +
        'in this order — clears the weak slots whose target is not strongly reachable, runs ' +
        'the finalisers for anything queued by an EARLIER cycle, queues the newly unreachable ' +
        'finalisable objects, and frees whatever is left that is neither reachable nor ' +
        'reachable from the queue. Return { cleared, finalised, queued, reclaimed }. The ' +
        'starter follows weak edges when it computes reachability, so a weak reference keeps ' +
        'its referent alive and is never cleared.',
      entry: 'lab',
      starter: [
        'function isWeak(heap, id, index) {',
        '  return heap.weak.some(function (row) {',
        '    return row.holder === id && row.index === index;',
        '  });',
        '}',
        '',
        'function stronglyReachable(heap) {',
        '  const live = [];',
        '  const queue = heap.roots.slice();',
        '',
        '  while (queue.length) {',
        '    const id = queue.shift();',
        '',
        '    if (live.indexOf(id) !== -1 || !heap.cells[id]) continue;',
        '    live.push(id);',
        '    // Every edge is followed, weak or not, so a weak reference keeps',
        '    // its referent alive and there is nothing left to clear.',
        '    heap.cells[id].refs.forEach(function (child) {',
        '      if (child !== null && child !== undefined) queue.push(child);',
        '    });',
        '  }',
        '  return live;',
        '}',
        '',
        'function reachableFrom(heap, seeds) {',
        '  const held = [];',
        '  const queue = seeds.slice();',
        '',
        '  while (queue.length) {',
        '    const id = queue.shift();',
        '',
        '    if (held.indexOf(id) !== -1 || !heap.cells[id]) continue;',
        '    held.push(id);',
        '    heap.cells[id].refs.forEach(function (child) {',
        '      if (child !== null && child !== undefined) queue.push(child);',
        '    });',
        '  }',
        '  return held;',
        '}',
        '',
        'function collect(heap) {',
        '  const live = stronglyReachable(heap);',
        '  const cleared = [];',
        '  const finalised = heap.queue.slice();',
        '',
        '  heap.weak.forEach(function (row) {',
        '    const cell = heap.cells[row.holder];',
        '    const target = cell ? cell.refs[row.index] : null;',
        '',
        '    if (target === null || target === undefined) return;',
        '    if (live.indexOf(target) !== -1) return;',
        '    cell.refs[row.index] = null;',
        '    cleared.push(target);',
        '  });',
        '  finalised.forEach(function (id) {',
        '    if (heap.cells[id]) heap.cells[id].finalised = true;',
        '  });',
        '  heap.queue = [];',
        '  return finish(heap, live, cleared, finalised);',
        '}',
        '',
        'function finish(heap, live, cleared, finalised) {',
        '  const queued = [];',
        '',
        '  Object.keys(heap.cells).map(Number).forEach(function (id) {',
        '    const cell = heap.cells[id];',
        '',
        '    if (live.indexOf(id) !== -1 || cell.finalised || !cell.finaliser) return;',
        '    queued.push(id);',
        '  });',
        '  heap.queue = heap.queue.concat(queued);',
        '  const held = reachableFrom(heap, heap.queue);',
        '  const reclaimed = Object.keys(heap.cells).map(Number).filter(function (id) {',
        '    return live.indexOf(id) === -1 && held.indexOf(id) === -1;',
        '  });',
        '',
        '  reclaimed.forEach(function (id) { delete heap.cells[id]; });',
        '  return { cleared: cleared, finalised: finalised, queued: queued,',
        '    reclaimed: reclaimed };',
        '}',
        '',
        'function lab() {',
        '  return { isWeak: isWeak, stronglyReachable: stronglyReachable, collect: collect };',
        '}'
      ].join('\n'),
      solution: [
        'function isWeak(heap, id, index) {',
        '  return heap.weak.some(function (row) {',
        '    return row.holder === id && row.index === index;',
        '  });',
        '}',
        '',
        '// The whole definition of a weak reference: an edge the tracer skips.',
        'function stronglyReachable(heap) {',
        '  const live = [];',
        '  const queue = heap.roots.slice();',
        '',
        '  while (queue.length) {',
        '    const id = queue.shift();',
        '',
        '    if (live.indexOf(id) !== -1 || !heap.cells[id]) continue;',
        '    live.push(id);',
        '    heap.cells[id].refs.forEach(function (child, index) {',
        '      if (child === null || child === undefined) return;',
        '      if (isWeak(heap, id, index)) return;',
        '      queue.push(child);',
        '    });',
        '  }',
        '  return live;',
        '}',
        '',
        'function reachableFrom(heap, seeds) {',
        '  const held = [];',
        '  const queue = seeds.slice();',
        '',
        '  while (queue.length) {',
        '    const id = queue.shift();',
        '',
        '    if (held.indexOf(id) !== -1 || !heap.cells[id]) continue;',
        '    held.push(id);',
        '    heap.cells[id].refs.forEach(function (child) {',
        '      if (child !== null && child !== undefined) queue.push(child);',
        '    });',
        '  }',
        '  return held;',
        '}',
        '',
        '/* The order is the specification: clear weak references first, so a',
        '   finaliser cannot resurrect an object a weak reference has already',
        '   been told is gone. Then run the finalisers queued by an EARLIER',
        '   cycle, which is what makes a finalisable object cost two. */',
        'function collect(heap) {',
        '  const live = stronglyReachable(heap);',
        '  const cleared = [];',
        '  const finalised = heap.queue.slice();',
        '',
        '  heap.weak.forEach(function (row) {',
        '    const cell = heap.cells[row.holder];',
        '    const target = cell ? cell.refs[row.index] : null;',
        '',
        '    if (target === null || target === undefined) return;',
        '    if (live.indexOf(target) !== -1) return;',
        '    cell.refs[row.index] = null;',
        '    cleared.push(target);',
        '  });',
        '  finalised.forEach(function (id) {',
        '    if (heap.cells[id]) heap.cells[id].finalised = true;',
        '  });',
        '  heap.queue = [];',
        '  return finish(heap, live, cleared, finalised);',
        '}',
        '',
        'function finish(heap, live, cleared, finalised) {',
        '  const queued = [];',
        '',
        '  Object.keys(heap.cells).map(Number).forEach(function (id) {',
        '    const cell = heap.cells[id];',
        '',
        '    if (live.indexOf(id) !== -1 || cell.finalised || !cell.finaliser) return;',
        '    queued.push(id);',
        '  });',
        '  heap.queue = heap.queue.concat(queued);',
        '  const held = reachableFrom(heap, heap.queue);',
        '  const reclaimed = Object.keys(heap.cells).map(Number).filter(function (id) {',
        '    return live.indexOf(id) === -1 && held.indexOf(id) === -1;',
        '  });',
        '',
        '  reclaimed.forEach(function (id) { delete heap.cells[id]; });',
        '  return { cleared: cleared, finalised: finalised, queued: queued,',
        '    reclaimed: reclaimed };',
        '}',
        '',
        'function lab() {',
        '  return { isWeak: isWeak, stronglyReachable: stronglyReachable, collect: collect };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'a weak reference is cleared exactly when its referent becomes unreachable',
          assert: function (lab, api) {
            const parts = lab();
            const heap = { roots: [0], queue: [],
              weak: [{ holder: 0, index: 0 }],
              cells: {
                0: { refs: [1, 2], finaliser: false, finalised: false },
                1: { refs: [], finaliser: false, finalised: false },
                2: { refs: [], finaliser: false, finalised: false }
              } };
            const out = parts.collect(heap);

            api.assert.deepEqual(out.cleared, [1], 'the weak slot was cleared');
            api.assert.deepEqual(out.reclaimed, [1], 'and its referent reclaimed');
            api.assert.ok(heap.cells[2], 'the strong reference kept object 2 alive');
            api.assert.equal(heap.cells[0].refs[0], null, 'the slot really is empty now');
          }
        },
        {
          name: 'a second strong reference stops the weak one from clearing',
          assert: function (lab, api) {
            const parts = lab();
            const heap = { roots: [0], queue: [],
              weak: [{ holder: 0, index: 0 }],
              cells: {
                0: { refs: [1, 2], finaliser: false, finalised: false },
                1: { refs: [], finaliser: false, finalised: false },
                2: { refs: [1], finaliser: false, finalised: false }
              } };
            const out = parts.collect(heap);

            api.assert.equal(out.cleared.length, 0, 'object 1 is still strongly reachable');
            api.assert.ok(heap.cells[1], 'so it is not reclaimed');
          }
        },
        {
          name: 'a finalisable object costs two cycles and keeps its children across both',
          assert: function (lab, api) {
            const parts = lab();
            const heap = { roots: [0], queue: [], weak: [], cells: {
              0: { refs: [], finaliser: false, finalised: false },
              1: { refs: [2], finaliser: true, finalised: false },
              2: { refs: [], finaliser: false, finalised: false }
            } };
            const first = parts.collect(heap);

            api.assert.deepEqual(first.queued, [1], 'cycle one queues it');
            api.assert.equal(first.reclaimed.length, 0, 'and frees nothing');
            api.assert.ok(heap.cells[2], 'including the object it references');

            const second = parts.collect(heap);

            api.assert.deepEqual(second.finalised, [1], 'cycle two runs the finaliser');
            api.assert.equal(second.reclaimed.length, 2, 'and frees both');

            const third = parts.collect(heap);

            api.assert.equal(third.finalised.length, 0, 'a finaliser runs at most once');
          }
        }
      ]
    }],

    'avoiding-the-collector': [{
      id: 'allocation-rate',
      title: 'Compute the same answer with a tenth of the allocations',
      prompt: 'Write run(values, alloc) which returns { total, count } where `total` is the sum ' +
        'of the values and `count` is how many of them are even. Every object your code ' +
        'creates must be passed through `alloc(object)`, which records it and returns it — ' +
        'that is the instrumented heap, and it is how the grader counts. The starter boxes ' +
        'each value and rebuilds the accumulator on every iteration, so it allocates two ' +
        'objects per element. Get to at most one tenth of that without changing what the ' +
        'function returns.',
      entry: 'lab',
      starter: [
        'function run(values, alloc) {',
        '  let acc = alloc({ total: 0, count: 0 });',
        '',
        '  values.forEach(function (value) {',
        '    // One box per element, and a fresh accumulator on every iteration.',
        '    const boxed = alloc({ value: value, even: value % 2 === 0 });',
        '',
        '    acc = alloc({ total: acc.total + boxed.value,',
        '      count: acc.count + (boxed.even ? 1 : 0) });',
        '  });',
        '  return acc;',
        '}',
        '',
        'function lab() {',
        '  return { run: run };',
        '}'
      ].join('\n'),
      solution: [
        'function run(values, alloc) {',
        '  let total = 0;',
        '  let count = 0;',
        '',
        '  /* Nothing in the loop needs to be an object: the two accumulators are',
        '     numbers, so the only allocation is the one result the caller asked',
        '     for. That is the whole of the technique — not "stop using objects"',
        '     but "stop building one per iteration". */',
        '  values.forEach(function (value) {',
        '    total += value;',
        '    if (value % 2 === 0) count += 1;',
        '  });',
        '  return alloc({ total: total, count: count });',
        '}',
        '',
        'function lab() {',
        '  return { run: run };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the answer is unchanged',
          assert: function (lab, api) {
            const parts = lab();
            const values = [];

            for (let at = 1; at <= 50; at += 1) values.push(at);
            const seen = [];
            const out = parts.run(values, function (object) {
              seen.push(object);
              return object;
            });

            api.assert.equal(out.total, 1275, 'the sum of 1 to 50');
            api.assert.equal(out.count, 25, 'and the count of even values');
          }
        },
        {
          name: 'the allocation count is at most a tenth of the starter',
          assert: function (lab, api) {
            const parts = lab();
            const values = [];

            for (let at = 1; at <= 200; at += 1) values.push(at);
            let allocations = 0;
            const out = parts.run(values, function (object) {
              allocations += 1;
              return object;
            });
            const starter = 2 * values.length + 1;

            api.assert.equal(out.total, 20100, 'the answer still holds at 200 values');
            api.assert.ok(allocations <= Math.floor(starter / 10),
              'allocated ' + allocations + ', budget ' + Math.floor(starter / 10));
          }
        },
        {
          name: 'the allocation count does not grow with the input',
          assert: function (lab, api) {
            const parts = lab();
            const counts = [];

            [50, 100, 400].forEach(function (size) {
              const values = [];

              for (let at = 1; at <= size; at += 1) values.push(at);
              let allocations = 0;

              parts.run(values, function (object) {
                allocations += 1;
                return object;
              });
              counts.push(allocations);
            });
            api.assert.equal(counts[0], counts[2],
              'a slope in the allocation curve is what a growing cost looks like: ' +
              counts.join(', '));
          }
        }
      ]
    }],

    'diagnosing-gc': [{
      id: 'retained-and-stable',
      title: 'Find the retaining reference, then stop the heap growing',
      prompt: 'Two pieces. Write retained(graph, id) where graph is { nodes: { id: { size, ' +
        'refs } }, roots: [] }, returning the bytes freed if `id` became unreachable — that ' +
        'is the size of everything `id` dominates, and the way to get it is to recompute ' +
        'reachability with `id` removed. Then write makeState() and handle(state, item) which ' +
        'returns the running total of the items seen and must keep the retained set bounded: ' +
        'the starter pushes every item onto a list nothing empties, which is the unbounded ' +
        'cache, and its retained set grows without limit while its answers stay correct.',
      entry: 'lab',
      starter: [
        'function reachable(graph, without) {',
        '  const live = [];',
        '  const queue = graph.roots.slice();',
        '',
        '  while (queue.length) {',
        '    const id = queue.shift();',
        '',
        '    if (id === without) continue;',
        '    if (live.indexOf(id) !== -1 || !graph.nodes[id]) continue;',
        '    live.push(id);',
        '    graph.nodes[id].refs.forEach(function (child) { queue.push(child); });',
        '  }',
        '  return live;',
        '}',
        '',
        'function bytes(graph, ids) {',
        '  return ids.reduce(function (sum, id) { return sum + graph.nodes[id].size; }, 0);',
        '}',
        '',
        'function retained(graph, id) {',
        '  // Only the node itself is counted, so everything it dominates is',
        '  // invisible and every row of the report looks equally unimportant.',
        '  return graph.nodes[id] ? graph.nodes[id].size : 0;',
        '}',
        '',
        'function makeState() {',
        '  return { total: 0, seen: [] };',
        '}',
        '',
        'function handle(state, item) {',
        '  // Every item is kept forever. The answers are right and the heap is not.',
        '  state.seen.push(item);',
        '  state.total += item;',
        '  return state.total;',
        '}',
        '',
        'function lab() {',
        '  return { reachable: reachable, bytes: bytes, retained: retained,',
        '    makeState: makeState, handle: handle };',
        '}'
      ].join('\n'),
      solution: [
        'function reachable(graph, without) {',
        '  const live = [];',
        '  const queue = graph.roots.slice();',
        '',
        '  while (queue.length) {',
        '    const id = queue.shift();',
        '',
        '    if (id === without) continue;',
        '    if (live.indexOf(id) !== -1 || !graph.nodes[id]) continue;',
        '    live.push(id);',
        '    graph.nodes[id].refs.forEach(function (child) { queue.push(child); });',
        '  }',
        '  return live;',
        '}',
        '',
        'function bytes(graph, ids) {',
        '  return ids.reduce(function (sum, id) { return sum + graph.nodes[id].size; }, 0);',
        '}',
        '',
        '/* Retained size is what a heap dump can tell you and an object list',
        '   cannot: recompute reachability with the reference gone, and the',
        '   difference is the memory that would come back. */',
        'function retained(graph, id) {',
        '  if (!graph.nodes[id]) return 0;',
        '  const before = reachable(graph, null);',
        '  const after = reachable(graph, id);',
        '',
        '  return bytes(graph, before) - bytes(graph, after);',
        '}',
        '',
        'function makeState() {',
        '  return { total: 0, seen: [] };',
        '}',
        '',
        '/* The running total needs no history at all, so nothing is retained.',
        '   The fix for an unbounded cache is a bound or nothing, and here the',
        '   answer never depended on the list. */',
        'function handle(state, item) {',
        '  state.total += item;',
        '  return state.total;',
        '}',
        '',
        'function lab() {',
        '  return { reachable: reachable, bytes: bytes, retained: retained,',
        '    makeState: makeState, handle: handle };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'retained size counts everything the object dominates',
          assert: function (lab, api) {
            const parts = lab();
            const graph = { roots: [0], nodes: {
              0: { size: 10, refs: [1] },
              1: { size: 20, refs: [2, 3] },
              2: { size: 30, refs: [] },
              3: { size: 40, refs: [] }
            } };

            api.assert.equal(parts.retained(graph, 1), 90,
              'object 1 dominates 2 and 3, so dropping it returns 20 + 30 + 40');
            api.assert.equal(parts.retained(graph, 2), 30,
              'a leaf retains only itself');
          }
        },
        {
          name: 'a shared object is dominated by neither holder',
          assert: function (lab, api) {
            const parts = lab();
            const graph = { roots: [0], nodes: {
              0: { size: 10, refs: [1, 2] },
              1: { size: 20, refs: [3] },
              2: { size: 20, refs: [3] },
              3: { size: 100, refs: [] }
            } };

            api.assert.equal(parts.retained(graph, 1), 20,
              'dropping one holder returns nothing extra, because the other still points at 3');
            api.assert.equal(parts.retained(graph, 0), 150,
              'and dropping the object that dominates all of them returns everything');
          }
        },
        {
          name: 'the answers are unchanged and the retained set stops growing',
          assert: function (lab, api) {
            const parts = lab();

            function totalAfter(count) {
              const state = parts.makeState();
              let last = 0;

              for (let at = 1; at <= count; at += 1) last = parts.handle(state, at);
              return { last: last, state: state };
            }

            const small = totalAfter(100);
            const large = totalAfter(4000);

            api.assert.equal(small.last, 5050, 'the running total is still right at 100');
            api.assert.equal(large.last, 8002000, 'and at 4 000');

            function held(state) {
              return JSON.stringify(state).length;
            }

            api.assert.ok(held(large.state) < held(small.state) * 2,
              'the state grew from ' + held(small.state) + ' to ' + held(large.state) +
              ' bytes over a fortyfold longer run');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));

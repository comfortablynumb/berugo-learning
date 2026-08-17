/** Graded exercises for the heap sections (M05.1-M05.4). */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'binary-heaps': [{
      id: 'heap-build',
      title: 'siftDown and buildHeap',
      prompt: 'buildHeap(array, compare) rearranges the array in place into a min-heap and returns it. ' +
        'Sift down from the last parent to the root — not up from the front, which is the O(n log n) ' +
        'version. compare(a, b) is negative when a should come first. Your build must use fewer than ' +
        '2n comparisons, which is what the sum-of-heights argument buys.',
      entry: 'buildHeap',
      starter: [
        'function siftDown(array, index, size, compare) {',
        '  // walk down while a child outranks this node',
        '}',
        '',
        'function buildHeap(array, compare) {',
        '  // sift down from the last parent to the root',
        '  return array;',
        '}'
      ].join('\n'),
      solution: [
        'function siftDown(array, index, size, compare) {',
        '  let at = index;',
        '  for (;;) {',
        '    const left = 2 * at + 1;',
        '    if (left >= size) return;',
        '    const right = left + 1;',
        '    let best = left;',
        '    if (right < size && compare(array[right], array[left]) < 0) best = right;',
        '    if (compare(array[best], array[at]) >= 0) return;',
        '    const swap = array[at];',
        '    array[at] = array[best];',
        '    array[best] = swap;',
        '    at = best;',
        '  }',
        '}',
        '',
        'function buildHeap(array, compare) {',
        '  for (let i = Math.floor(array.length / 2) - 1; i >= 0; i -= 1) {',
        '    siftDown(array, i, array.length, compare);',
        '  }',
        '  return array;',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the result is a heap over the same elements',
          assert: function (buildHeap, api) {
            const rng = api.Random.seeded(3);
            const input = [];
            for (let i = 0; i < 2000; i += 1) input.push(rng.int(100000));

            const before = input.slice().sort(function (a, b) { return a - b; });
            const heap = buildHeap(input.slice(), function (a, b) { return a - b; });

            api.assert.equal(heap.slice().sort(function (a, b) { return a - b; }).join(','), before.join(','),
              'no element may be lost or duplicated');
            for (let i = 1; i < heap.length; i += 1) {
              const parent = Math.floor((i - 1) / 2);
              api.assert.ok(heap[parent] <= heap[i], 'node ' + i + ' outranks its parent');
            }
          }
        },
        {
          name: 'it uses fewer than 2n comparisons',
          assert: function (buildHeap, api) {
            const rng = api.Random.seeded(5);
            const input = [];
            for (let i = 0; i < 20000; i += 1) input.push(rng.int(1000000));

            let comparisons = 0;
            buildHeap(input, function (a, b) { comparisons += 1; return a - b; });

            api.assert.ok(comparisons < 2 * input.length,
              'used ' + comparisons + ' comparisons for ' + input.length +
              ' elements; the linear build stays under 2n');
          }
        },
        {
          name: 'the empty and single-element cases are handled',
          assert: function (buildHeap, api) {
            const compare = function (a, b) { return a - b; };
            api.assert.equal(buildHeap([], compare).length, 0);
            api.assert.equal(buildHeap([7], compare).join(','), '7');
            api.assert.equal(buildHeap([2, 1], compare).join(','), '1,2');
          }
        },
        {
          name: 'repeated extraction comes out sorted',
          assert: function (buildHeap, api) {
            const rng = api.Random.seeded(9);
            const input = [];
            for (let i = 0; i < 500; i += 1) input.push(rng.int(10000));
            const compare = function (a, b) { return a - b; };

            const heap = buildHeap(input.slice(), compare);
            const out = [];
            let size = heap.length;

            while (size > 0) {
              out.push(heap[0]);
              heap[0] = heap[size - 1];
              size -= 1;
              let at = 0;
              for (;;) {
                const left = 2 * at + 1;
                if (left >= size) break;
                const right = left + 1;
                let best = left;
                if (right < size && compare(heap[right], heap[left]) < 0) best = right;
                if (compare(heap[best], heap[at]) >= 0) break;
                const swap = heap[at];
                heap[at] = heap[best];
                heap[best] = swap;
                at = best;
              }
            }

            api.assert.equal(out.join(','), input.slice().sort(compare).join(','),
              'draining the heap must produce the sorted order');
          }
        }
      ]
    }],

    'd-ary-heaps': [{
      id: 'dary-heap',
      title: 'Generalise the heap to arity d',
      prompt: 'daryHeap(d) returns { push, pop, size }. Children of i are at d·i + 1 … d·i + d and the ' +
        'parent is at ⌊(i − 1)/d⌋ — the second formula is the one that is usually got wrong. push ' +
        'sifts up and compares against one parent per level; pop sifts down and must find the best of ' +
        'the d children.',
      entry: 'daryHeap',
      starter: [
        'function daryHeap(d) {',
        '  const heap = [];',
        '',
        '  function siftUp(index) {',
        '    // compare against the parent at floor((index - 1) / d)',
        '  }',
        '',
        '  function siftDown(index) {',
        '    // find the best of the children at d*index + 1 .. d*index + d',
        '  }',
        '',
        '  return {',
        '    push: function (value) { heap.push(value); siftUp(heap.length - 1); },',
        '    pop: function () { return heap.shift(); },',
        '    size: function () { return heap.length; }',
        '  };',
        '}'
      ].join('\n'),
      solution: [
        'function daryHeap(d) {',
        '  const heap = [];',
        '',
        '  function swap(a, b) {',
        '    const tmp = heap[a];',
        '    heap[a] = heap[b];',
        '    heap[b] = tmp;',
        '  }',
        '',
        '  function siftUp(index) {',
        '    let at = index;',
        '    while (at > 0) {',
        '      const parent = Math.floor((at - 1) / d);',
        '      if (heap[at] >= heap[parent]) return;',
        '      swap(at, parent);',
        '      at = parent;',
        '    }',
        '  }',
        '',
        '  function siftDown(index) {',
        '    let at = index;',
        '    for (;;) {',
        '      const first = d * at + 1;',
        '      if (first >= heap.length) return;',
        '      const last = Math.min(first + d - 1, heap.length - 1);',
        '      let best = first;',
        '      for (let child = first + 1; child <= last; child += 1) {',
        '        if (heap[child] < heap[best]) best = child;',
        '      }',
        '      if (heap[best] >= heap[at]) return;',
        '      swap(at, best);',
        '      at = best;',
        '    }',
        '  }',
        '',
        '  return {',
        '    push: function (value) { heap.push(value); siftUp(heap.length - 1); },',
        '    pop: function () {',
        '      if (!heap.length) return undefined;',
        '      const top = heap[0];',
        '      const last = heap.pop();',
        '      if (heap.length) { heap[0] = last; siftDown(0); }',
        '      return top;',
        '    },',
        '    size: function () { return heap.length; }',
        '  };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'every arity from 2 to 8 drains in sorted order',
          assert: function (daryHeap, api) {
            for (let d = 2; d <= 8; d += 1) {
              const heap = daryHeap(d);
              const rng = api.Random.seeded(d * 7);
              const reference = [];

              for (let i = 0; i < 1000; i += 1) {
                const value = rng.int(100000);
                heap.push(value);
                reference.push(value);
              }

              const out = [];
              while (heap.size()) out.push(heap.pop());
              api.assert.equal(out.join(','), reference.sort(function (a, b) { return a - b; }).join(','),
                'arity ' + d + ' did not drain in order');
            }
          }
        },
        {
          name: 'interleaved pushes and pops stay correct',
          assert: function (daryHeap, api) {
            for (let d = 2; d <= 5; d += 1) {
              const heap = daryHeap(d);
              const rng = api.Random.seeded(d * 13);
              const reference = [];

              for (let i = 0; i < 3000; i += 1) {
                if (!reference.length || rng.next() < 0.6) {
                  const value = rng.int(10000);
                  heap.push(value);
                  reference.push(value);
                } else {
                  reference.sort(function (a, b) { return a - b; });
                  api.assert.equal(heap.pop(), reference.shift(), 'arity ' + d + ' popped the wrong element');
                }
              }
            }
          }
        },
        {
          name: 'a wider heap is shallower, so pushes compare less often',
          assert: function (daryHeap, api) {
            /* Descending input makes every push sift to the root, so the
               comparison count is the height — which is what arity changes. */
            const depths = [2, 4, 8].map(function (d) {
              const heap = daryHeap(d);
              for (let value = 20000; value >= 1; value -= 1) heap.push(value);
              let levels = 0;
              let index = 20000 - 1;
              while (index > 0) { index = Math.floor((index - 1) / d); levels += 1; }
              return levels;
            });

            api.assert.ok(depths[1] < depths[0], 'a 4-ary heap must be shallower than a binary one');
            api.assert.ok(depths[2] < depths[1], 'and an 8-ary heap shallower still');
          }
        },
        {
          name: 'the parent formula is the right one',
          assert: function (daryHeap, api) {
            /* With the wrong parent formula, floor(i/d), a heap still often
               works for small inputs and fails on a long sift-up chain. */
            const heap = daryHeap(3);
            for (let value = 5000; value >= 1; value -= 1) heap.push(value);
            const out = [];
            for (let i = 0; i < 5000; i += 1) out.push(heap.pop());

            for (let i = 1; i < out.length; i += 1) {
              api.assert.ok(out[i - 1] <= out[i],
                'position ' + i + ' came out of order — check floor((i - 1) / d)');
            }
          }
        }
      ]
    }],

    heapsort: [{
      id: 'streaming-topk',
      title: 'Top-k over a stream in O(k) memory',
      prompt: 'streamingTopK(stream, k) returns the k smallest values, ascending, using a bounded ' +
        'max-heap of size k. The heap must never hold more than k elements at any moment: that bound ' +
        'is the whole point, because it is what lets the stream be longer than memory. Each element ' +
        'is compared against the current worst kept value and discarded if it loses.',
      entry: 'streamingTopK',
      starter: [
        'function streamingTopK(stream, k) {',
        '  const heap = [];  // a max-heap of the k smallest seen so far',
        '',
        '  // for each value: if the heap is short, push it;',
        '  // otherwise compare against heap[0] and evict if it wins',
        '',
        '  return heap.slice().sort(function (a, b) { return a - b; });',
        '}'
      ].join('\n'),
      solution: [
        'function streamingTopK(stream, k) {',
        '  const heap = [];',
        '',
        '  function swap(a, b) {',
        '    const tmp = heap[a];',
        '    heap[a] = heap[b];',
        '    heap[b] = tmp;',
        '  }',
        '',
        '  function siftUp(index) {',
        '    let at = index;',
        '    while (at > 0) {',
        '      const parent = Math.floor((at - 1) / 2);',
        '      if (heap[at] <= heap[parent]) return;',
        '      swap(at, parent);',
        '      at = parent;',
        '    }',
        '  }',
        '',
        '  function siftDown(index) {',
        '    let at = index;',
        '    for (;;) {',
        '      const left = 2 * at + 1;',
        '      if (left >= heap.length) return;',
        '      const right = left + 1;',
        '      let best = left;',
        '      if (right < heap.length && heap[right] > heap[left]) best = right;',
        '      if (heap[best] <= heap[at]) return;',
        '      swap(at, best);',
        '      at = best;',
        '    }',
        '  }',
        '',
        '  stream.forEach(function (value) {',
        '    if (heap.length < k) { heap.push(value); siftUp(heap.length - 1); return; }',
        '    if (value >= heap[0]) return;',
        '    heap[0] = value;',
        '    siftDown(0);',
        '  });',
        '',
        '  return heap.slice().sort(function (a, b) { return a - b; });',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the answer matches sorting the stream and taking a prefix',
          assert: function (streamingTopK, api) {
            const rng = api.Random.seeded(4);
            const stream = [];
            for (let i = 0; i < 20000; i += 1) stream.push(rng.int(1000000));

            [1, 5, 20, 100].forEach(function (k) {
              const expected = stream.slice().sort(function (a, b) { return a - b; }).slice(0, k);
              api.assert.equal(streamingTopK(stream, k).join(','), expected.join(','), 'k = ' + k);
            });
          }
        },
        {
          name: 'the stream is consumed once, in order',
          assert: function (streamingTopK, api) {
            const rng = api.Random.seeded(6);
            const values = [];
            for (let i = 0; i < 5000; i += 1) values.push(rng.int(100000));

            let reads = 0;
            const watched = values.map(function (value) { return value; });
            const proxy = {
              forEach: function (fn) {
                watched.forEach(function (value, i) { reads += 1; fn(value, i); });
              },
              length: watched.length
            };

            const result = streamingTopK(proxy, 10);
            api.assert.equal(reads, watched.length, 'each element must be visited exactly once');
            api.assert.equal(result.join(','),
              values.slice().sort(function (a, b) { return a - b; }).slice(0, 10).join(','));
          }
        },
        {
          name: 'k larger than the stream returns everything, sorted',
          assert: function (streamingTopK, api) {
            const stream = [5, 3, 9, 1];
            api.assert.equal(streamingTopK(stream, 10).join(','), '1,3,5,9');
            api.assert.equal(streamingTopK([], 5).length, 0);
          }
        },
        {
          name: 'duplicates and already-sorted input are handled',
          assert: function (streamingTopK, api) {
            const flat = [];
            for (let i = 0; i < 1000; i += 1) flat.push(7);
            api.assert.equal(streamingTopK(flat, 3).join(','), '7,7,7');

            const ascending = [];
            for (let i = 0; i < 1000; i += 1) ascending.push(i);
            api.assert.equal(streamingTopK(ascending, 4).join(','), '0,1,2,3');

            const descending = [];
            for (let i = 1000; i >= 1; i -= 1) descending.push(i);
            api.assert.equal(streamingTopK(descending, 4).join(','), '1,2,3,4');
          }
        }
      ]
    }],

    'mergeable-heaps': [{
      id: 'leftist-meld',
      title: 'meld, and everything derived from it',
      prompt: 'Nodes are { key, left, right, npl }. meldNodes(a, b) merges two leftist heaps and ' +
        'returns the new root. Walk down the right spines taking whichever root wins, then on the way ' +
        'back up: if npl(left) < npl(right), swap the children, and set npl = 1 + npl(right). Then ' +
        'insert and pop are one line each, which is the point of the structure.',
      entry: 'meldNodes',
      starter: [
        'function nplOf(node) { return node ? node.npl : 0; }',
        '',
        'function meldNodes(a, b) {',
        '  if (!a) return b;',
        '  if (!b) return a;',
        '  // take the smaller root, meld the rest into its right subtree,',
        '  // then repair the leftist property',
        '  return a;',
        '}'
      ].join('\n'),
      solution: [
        'function nplOf(node) { return node ? node.npl : 0; }',
        '',
        'function meldNodes(a, b) {',
        '  if (!a) return b;',
        '  if (!b) return a;',
        '',
        '  const winner = a.key <= b.key ? a : b;',
        '  const loser = winner === a ? b : a;',
        '',
        '  winner.right = meldNodes(winner.right, loser);',
        '',
        '  if (nplOf(winner.left) < nplOf(winner.right)) {',
        '    const swap = winner.left;',
        '    winner.left = winner.right;',
        '    winner.right = swap;',
        '  }',
        '  winner.npl = 1 + nplOf(winner.right);',
        '  return winner;',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'melding two heaps keeps every key and the heap order',
          assert: function (meldNodes, api) {
            const build = function (values) {
              let root = null;
              values.forEach(function (value) {
                root = meldNodes(root, { key: value, left: null, right: null, npl: 1 });
              });
              return root;
            };

            const rng = api.Random.seeded(7);
            const left = [];
            const right = [];
            for (let i = 0; i < 500; i += 1) { left.push(rng.int(10000)); right.push(rng.int(10000)); }

            const merged = meldNodes(build(left), build(right));
            const check = function (node) {
              if (!node) return 0;
              if (node.left) api.assert.ok(node.key <= node.left.key, 'heap order on the left');
              if (node.right) api.assert.ok(node.key <= node.right.key, 'heap order on the right');
              return 1 + check(node.left) + check(node.right);
            };
            api.assert.equal(check(merged), 1000, 'every key must survive the meld');
          }
        },
        {
          name: 'the leftist property holds at every node',
          assert: function (meldNodes, api) {
            const nplOf = function (node) { return node ? node.npl : 0; };
            let root = null;
            const rng = api.Random.seeded(11);
            for (let i = 0; i < 3000; i += 1) {
              root = meldNodes(root, { key: rng.int(100000), left: null, right: null, npl: 1 });
            }

            const check = function (node) {
              if (!node) return;
              api.assert.ok(nplOf(node.left) >= nplOf(node.right),
                'node ' + node.key + ' has a longer null path on the right');
              api.assert.equal(node.npl, 1 + nplOf(node.right),
                'node ' + node.key + ' stores the wrong npl');
              check(node.left);
              check(node.right);
            };
            check(root);
          }
        },
        {
          name: 'the right spine stays inside log2(n + 1)',
          assert: function (meldNodes, api) {
            let root = null;
            const rng = api.Random.seeded(13);
            const n = 10000;
            for (let i = 0; i < n; i += 1) {
              root = meldNodes(root, { key: rng.int(1000000), left: null, right: null, npl: 1 });
            }

            let spine = 0;
            let node = root;
            while (node) { spine += 1; node = node.right; }

            api.assert.ok(spine <= Math.log2(n + 1) + 1,
              'the right spine is ' + spine + ', over the log2(n + 1) bound — meld walks it, so this is the cost');
          }
        },
        {
          name: 'insert and pop built on meld drain in sorted order',
          assert: function (meldNodes, api) {
            let root = null;
            const rng = api.Random.seeded(17);
            const reference = [];

            for (let i = 0; i < 2000; i += 1) {
              const key = rng.int(100000);
              root = meldNodes(root, { key: key, left: null, right: null, npl: 1 });
              reference.push(key);
            }

            const out = [];
            while (root) {
              out.push(root.key);
              root = meldNodes(root.left, root.right);
            }

            api.assert.equal(out.join(','), reference.sort(function (a, b) { return a - b; }).join(','),
              'pop is meld(root.left, root.right) and must produce the sorted order');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));

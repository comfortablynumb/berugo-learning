/**
 * Graded exercises for bin packing, external memory and cache-obliviousness (M21.4-M21.6).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'bin-packing': [{
      id: 'first-fit-decreasing',
      title: 'First-fit-decreasing, and the arrival order it removes',
      prompt: 'pack(items, capacity) must place every item into bins of the given capacity and ' +
        'return an array of bins, each an array of the item SIZES it holds, in the order they ' +
        'were placed. Sort a copy of the items largest first, then place each in the earliest ' +
        'bin it fits in, opening a new bin when none does. Do not mutate the input array. The ' +
        'tests check the packing is valid, that it beats plain first-fit on the ' +
        'sevenths-thirds-halves family, and that it stays inside 11/9·OPT + 6/9 against exact ' +
        'optima on small instances. The starter is next-fit, which looks only at the last bin ' +
        'opened and is 2-competitive.',
      entry: 'pack',
      starter: [
        'function pack(items, capacity) {',
        '  // Next-fit: one open bin, O(1) per item, and up to twice the optimum.',
        '  const bins = [];',
        '  let current = null;',
        '  let load = 0;',
        '',
        '  items.forEach(function (size) {',
        '    if (current === null || load + size > capacity + 1e-9) {',
        '      current = [];',
        '      bins.push(current);',
        '      load = 0;',
        '    }',
        '    current.push(size);',
        '    load += size;',
        '  });',
        '  return bins;',
        '}'
      ].join('\n'),
      solution: [
        'function pack(items, capacity) {',
        '  const sorted = items.slice().sort(function (a, b) { return b - a; });',
        '  const bins = [];',
        '  const loads = [];',
        '',
        '  sorted.forEach(function (size) {',
        '    let placed = false;',
        '',
        '    for (let i = 0; i < bins.length && !placed; i += 1) {',
        '      if (loads[i] + size <= capacity + 1e-9) {',
        '        bins[i].push(size);',
        '        loads[i] += size;',
        '        placed = true;',
        '      }',
        '    }',
        '    if (!placed) {',
        '      bins.push([size]);',
        '      loads.push(size);',
        '    }',
        '  });',
        '  return bins;',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'it packs every item without exceeding a bin',
          assert: function (pack, api) {
            const rng = api.Random.seeded(7);
            const items = [];

            for (let i = 0; i < 120; i += 1) items.push(0.05 + rng.next() * 0.55);
            const before = items.slice();
            const bins = pack(items, 1);
            const flat = [];

            bins.forEach(function (bin) {
              let load = 0;

              bin.forEach(function (size) {
                load += size;
                flat.push(size);
              });
              api.assert.atMost(load, 1 + 1e-9, 'a bin holds more than its capacity');
            });
            api.assert.equal(flat.length, 120, 'every item must be placed exactly once');
            api.assert.equal(items.join(','), before.join(','), 'the input array must not be mutated');
          }
        },
        {
          name: 'it beats first-fit on the sevenths-thirds-halves family',
          assert: function (pack, api) {
            const groups = 24;
            const items = [];

            for (let i = 0; i < groups; i += 1) items.push(1 / 7 + 0.0001);
            for (let i = 0; i < groups; i += 1) items.push(1 / 3 + 0.0001);
            for (let i = 0; i < groups; i += 1) items.push(1 / 2 + 0.0001);

            const bins = pack(items, 1).length;

            api.assert.atLeast(bins, groups, 'no packing can use fewer bins than the optimum of ' + groups);
            api.assert.equal(bins, groups,
              'first-fit uses 40 bins here against an optimum of 24; sorted, the family packs perfectly');
          }
        },
        {
          name: 'it stays inside 11/9 of the exact optimum on small instances',
          assert: function (pack, api) {
            function optimum(items, capacity) {
              const loads = [];
              let best = items.length;

              function place(index) {
                if (loads.length >= best) return;

                if (index === items.length) {
                  best = Math.min(best, loads.length);
                  return;
                }
                for (let i = 0; i < loads.length; i += 1) {
                  if (loads[i] + items[index] <= capacity + 1e-9) {
                    loads[i] += items[index];
                    place(index + 1);
                    loads[i] -= items[index];
                  }
                }
                loads.push(items[index]);
                place(index + 1);
                loads.pop();
              }
              place(0);
              return best;
            }
            let worst = 0;

            for (let t = 0; t < 15; t += 1) {
              const rng = api.Random.seeded(t * 31 + 3);
              const items = [];

              for (let i = 0; i < 11; i += 1) items.push(0.1 + rng.next() * 0.5);
              const sorted = items.slice().sort(function (a, b) { return b - a; });
              const opt = optimum(sorted, 1);

              worst = Math.max(worst, pack(items, 1).length / opt);
            }
            api.assert.atMost(worst, 11 / 9 + 6 / 9 / 4,
              'the worst ratio against exact optima must respect (11/9)*OPT + 6/9');
          }
        },
        {
          name: 'it wastes less than next-fit on a uniform workload',
          assert: function (pack, api) {
            const rng = api.Random.seeded(19);
            const items = [];

            for (let i = 0; i < 200; i += 1) items.push(0.05 + rng.next() * 0.55);
            const bins = pack(items, 1).length;
            let total = 0;

            items.forEach(function (size) { total += size; });
            const lower = Math.ceil(total - 1e-9);

            api.assert.atMost(bins / lower, 1.05,
              'next-fit measures 1.27 against the lower bound here; sorting must land inside 1.05');
          }
        }
      ]
    }],

    'external-memory': [{
      id: 'external-merge-sort',
      title: 'External merge sort, inside an enforced memory budget',
      prompt: 'sortCost(records, memory, block) must return { runs, fanOut, passes, transfers } ' +
        'for an external merge sort of `records` records with `memory` records of RAM and ' +
        '`block` records per transfer. A run is one memory-full sorted and written, so there are ' +
        'ceil(records/memory) of them. The merge holds one block per input run plus one for ' +
        'output, so the fan-out is floor(memory/block) − 1. Each pass reads and writes every ' +
        'block once, costing 2·ceil(records/block), and there is one run-building pass plus ' +
        'ceil(log_fanOut(runs)) merge passes. Return `passes` as the MERGE pass count only. The ' +
        'starter forgets the output buffer, which is a real block and costs a whole pass at ' +
        'small memory.',
      entry: 'sortCost',
      starter: [
        'function sortCost(records, memory, block) {',
        '  // The output buffer is a real block too - this fan-out is one too high.',
        '  const runs = Math.ceil(records / memory);',
        '  const fanOut = Math.floor(memory / block);',
        '  const passes = runs <= 1 ? 0 : Math.ceil(Math.log(runs) / Math.log(fanOut));',
        '',
        '  return {',
        '    runs: runs,',
        '    fanOut: fanOut,',
        '    passes: passes,',
        '    transfers: 2 * Math.ceil(records / block) * (1 + passes)',
        '  };',
        '}'
      ].join('\n'),
      solution: [
        'function sortCost(records, memory, block) {',
        '  const runs = Math.ceil(records / memory);',
        '  const fanOut = Math.max(2, Math.floor(memory / block) - 1);',
        '  const passes = runs <= 1',
        '    ? 0',
        '    : Math.ceil(Math.log(runs) / Math.log(fanOut) - 1e-9);',
        '',
        '  return {',
        '    runs: runs,',
        '    fanOut: fanOut,',
        '    passes: passes,',
        '    transfers: 2 * Math.ceil(records / block) * (1 + passes)',
        '  };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'it reproduces the four measured configurations exactly',
          assert: function (sortCost, api) {
            const cases = [
              { m: 64, b: 16, runs: 128, fanOut: 3, passes: 5, transfers: 6144 },
              { m: 128, b: 16, runs: 64, fanOut: 7, passes: 3, transfers: 4096 },
              { m: 256, b: 32, runs: 32, fanOut: 7, passes: 2, transfers: 1536 },
              { m: 1024, b: 64, runs: 8, fanOut: 15, passes: 1, transfers: 512 }
            ];

            cases.forEach(function (c) {
              const got = sortCost(8192, c.m, c.b);
              const label = 'M=' + c.m + ' B=' + c.b + ': ';

              api.assert.equal(got.runs, c.runs, label + 'the initial run count is ceil(N/M)');
              api.assert.equal(got.fanOut, c.fanOut, label + 'the fan-out holds one block per run plus output');
              api.assert.equal(got.passes, c.passes, label + 'the merge pass count');
              api.assert.equal(got.transfers, c.transfers, label + 'the measured transfer count');
            });
          }
        },
        {
          name: 'it charges nothing extra when the data already fits in memory',
          assert: function (sortCost, api) {
            const got = sortCost(1000, 4096, 64);

            api.assert.equal(got.runs, 1, 'a single run means no merging at all');
            api.assert.equal(got.passes, 0, 'there are no merge passes when there is one run');
            api.assert.equal(got.transfers, 2 * Math.ceil(1000 / 64),
              'the cost is one read and one write of the data');
          }
        },
        {
          name: 'more memory removes passes in discrete jumps, never smoothly',
          assert: function (sortCost, api) {
            const seen = [];

            [256, 512, 1024, 2048, 4096].forEach(function (m) {
              seen.push(sortCost(1e6, m, 64).passes);
            });
            for (let i = 1; i < seen.length; i += 1) {
              api.assert.atMost(seen[i], seen[i - 1],
                'more memory must never increase the pass count');
            }
            api.assert.atLeast(seen[0] - seen[seen.length - 1], 1,
              'over a 16x memory range the pass count must fall by at least one');
            let plateau = false;

            for (let i = 1; i < seen.length; i += 1) {
              if (seen[i] === seen[i - 1]) plateau = true;
            }
            api.assert.equal(plateau, true,
              'the pass count must plateau somewhere - a doubling that changes nothing is the point');
          }
        },
        {
          name: 'the transfer count is 2*(N/B) per pass, run building included',
          assert: function (sortCost, api) {
            [[100000, 512, 32], [50000, 1024, 64], [8192, 64, 16]].forEach(function (c) {
              const got = sortCost(c[0], c[1], c[2]);
              const perPass = 2 * Math.ceil(c[0] / c[2]);

              api.assert.equal(got.transfers, perPass * (1 + got.passes),
                'N=' + c[0] + ': every pass reads and writes every block exactly once');
            });
          }
        }
      ]
    }],

    'cache-oblivious': [{
      id: 'veb-layout',
      title: 'The van Emde Boas layout, over heap indices',
      prompt: 'vebOrder(height) must return the van Emde Boas layout of a complete binary tree ' +
        'of that height as an array of HEAP indices (1-based, root 1, children 2i and 2i+1), ' +
        'where position p of the array holds the heap index of the node stored at offset p. ' +
        'Split the tree by height: a top subtree of height ceil(h/2) rooted at the same node, ' +
        'then its 2^ceil(h/2) bottom subtrees of height floor(h/2), each laid out recursively ' +
        'and placed contiguously after the top. A tree of height 1 is one node. The trap is ' +
        'offsets: a subtree of a complete binary tree does NOT occupy a contiguous index range, ' +
        'so the recursion has to carry the heap index of each subtree root. The starter is level ' +
        'order, which is what the offset version silently degenerates into.',
      entry: 'vebOrder',
      starter: [
        'function vebOrder(height) {',
        '  // Level order: the arrangement the vEB layout is meant to beat.',
        '  const order = [];',
        '',
        '  for (let i = 1; i < Math.pow(2, height); i += 1) order.push(i);',
        '  return order;',
        '}'
      ].join('\n'),
      solution: [
        'function vebOrder(height) {',
        '  function layout(root, h, out) {',
        '    if (h <= 0) return;',
        '',
        '    if (h === 1) {',
        '      out.push(root);',
        '      return;',
        '    }',
        '    const top = Math.ceil(h / 2);',
        '    const bottom = h - top;',
        '',
        '    layout(root, top, out);',
        '',
        '    const roots = [root];',
        '',
        '    for (let level = 0; level < top; level += 1) {',
        '      const next = [];',
        '',
        '      roots.forEach(function (node) {',
        '        next.push(node * 2);',
        '        next.push(node * 2 + 1);',
        '      });',
        '      roots.length = 0;',
        '      next.forEach(function (node) { roots.push(node); });',
        '    }',
        '    roots.forEach(function (node) { layout(node, bottom, out); });',
        '  }',
        '  const out = [];',
        '',
        '  layout(1, height, out);',
        '  return out;',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'it is a permutation of every node, root first',
          assert: function (vebOrder, api) {
            [1, 2, 3, 4, 5, 8].forEach(function (h) {
              const order = vebOrder(h);
              const nodes = Math.pow(2, h) - 1;
              const seen = {};

              api.assert.equal(order.length, nodes, 'height ' + h + ': every node must appear once');
              order.forEach(function (idx) { seen[idx] = (seen[idx] || 0) + 1; });
              for (let i = 1; i <= nodes; i += 1) {
                api.assert.equal(seen[i], 1, 'height ' + h + ': heap index ' + i + ' must appear exactly once');
              }
              api.assert.equal(order[0], 1, 'height ' + h + ': the root is stored first');
            });
          }
        },
        {
          name: 'it is not level order once the split has anything to do',
          assert: function (vebOrder, api) {
            const order = vebOrder(5);
            const level = [];

            for (let i = 1; i < 32; i += 1) level.push(i);
            api.assert.equal(order.join(',') === level.join(','), false,
              'a vEB layout that equals level order is the offset bug, not a layout');
            api.assert.equal(order[1], 2, 'the top subtree of height 3 comes first: 1, 2, 3, ...');
            api.assert.equal(order[2], 3, 'the top subtree of height 3 comes first: 1, 2, 3, ...');
            api.assert.equal(order[3], 4, 'the first bottom subtree is rooted at heap index 4');
          }
        },
        {
          name: 'the top subtree occupies a contiguous prefix',
          assert: function (vebOrder, api) {
            [4, 6, 8].forEach(function (h) {
              const order = vebOrder(h);
              const top = Math.ceil(h / 2);
              const size = Math.pow(2, top) - 1;
              const prefix = order.slice(0, size).slice().sort(function (a, b) { return a - b; });

              for (let i = 0; i < size; i += 1) {
                api.assert.equal(prefix[i], i + 1,
                  'height ' + h + ': the first ' + size + ' slots hold the top subtree, heap indices 1..' + size);
              }
            });
          }
        },
        {
          name: 'a root-to-leaf path is more local than in level order',
          assert: function (vebOrder, api) {
            const height = 12;
            const order = vebOrder(height);
            const slot = {};

            order.forEach(function (idx, pos) { slot[idx] = pos; });

            function spread(layout) {
              let worst = 0;

              for (let leaf = Math.pow(2, height - 1); leaf < Math.pow(2, height); leaf += 37) {
                const blocks = {};
                let node = leaf;

                while (node >= 1) {
                  blocks[Math.floor(layout[node] / 16)] = true;
                  node = Math.floor(node / 2);
                }
                worst = Math.max(worst, Object.keys(blocks).length);
              }
              return worst;
            }
            const level = {};

            for (let i = 1; i < Math.pow(2, height); i += 1) level[i] = i - 1;
            api.assert.atMost(spread(slot), spread(level) - 2,
              'a path must touch fewer 16-node blocks than in level order - that is the whole point');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));

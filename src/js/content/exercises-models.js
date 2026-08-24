/**
 * Graded exercises for streaming, work and span, and cost models (M21.7-M21.9).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'streaming-model': [{
      id: 'reservoir-sampling',
      title: 'A uniform sample of a stream nobody can rewind',
      prompt: 'sample(stream, k, rng) must return a uniform random sample of k items from the ' +
        'stream, in ONE pass, holding at most k items at a time — you may not copy the stream or ' +
        'use its length except through iteration. Keep the first k items; then for the item at ' +
        'index i (zero-based, i ≥ k) draw j = floor(rng.next() * (i + 1)) and, if j < k, replace ' +
        'slot j with it. That gives every item probability exactly k/n of surviving. Return fewer ' +
        'than k items only when the stream is shorter than k. The starter keeps the first k, ' +
        'which holds the right amount of memory and samples nothing.',
      entry: 'sample',
      starter: [
        'function sample(stream, k, rng) {',
        '  // The right space and the wrong distribution: later items can never appear.',
        '  return stream.slice(0, k);',
        '}'
      ].join('\n'),
      solution: [
        'function sample(stream, k, rng) {',
        '  const held = [];',
        '',
        '  stream.forEach(function (item, i) {',
        '    if (i < k) {',
        '      held.push(item);',
        '      return;',
        '    }',
        '    const j = Math.floor(rng.next() * (i + 1));',
        '',
        '    if (j < k) held[j] = item;',
        '  });',
        '  return held;',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'it returns k items, every one of them from the stream',
          assert: function (sample, api) {
            const stream = [];

            for (let i = 0; i < 50; i += 1) stream.push('item-' + i);
            const got = sample(stream, 8, api.Random.seeded(3));

            api.assert.equal(got.length, 8, 'the sample holds exactly k items');
            got.forEach(function (item) {
              api.assert.equal(stream.indexOf(item) >= 0, true, item + ' is not from the stream');
            });
          }
        },
        {
          name: 'a stream shorter than k comes back whole',
          assert: function (sample, api) {
            const got = sample(['a', 'b', 'c'], 10, api.Random.seeded(5));

            api.assert.equal(got.length, 3, 'there is nothing else to sample');
            api.assert.equal(got.slice().sort().join(','), 'a,b,c', 'every item survives');
          }
        },
        {
          name: 'every item appears about k/n of the time, not just the early ones',
          assert: function (sample, api) {
            const n = 20;
            const k = 5;
            const trials = 400;
            const stream = [];
            const counts = [];

            for (let i = 0; i < n; i += 1) {
              stream.push(i);
              counts.push(0);
            }
            for (let t = 0; t < trials; t += 1) {
              sample(stream, k, api.Random.seeded(t * 37 + 11)).forEach(function (item) {
                counts[item] += 1;
              });
            }
            const expected = trials * k / n;

            counts.forEach(function (count, i) {
              api.assert.atLeast(count, expected * 0.6,
                'item ' + i + ' appeared ' + count + ' times against an expected ' + expected);
              api.assert.atMost(count, expected * 1.4,
                'item ' + i + ' appeared ' + count + ' times against an expected ' + expected);
            });
          }
        },
        {
          name: 'the last item of a long stream can be sampled at all',
          assert: function (sample, api) {
            const stream = [];

            for (let i = 0; i < 1000; i += 1) stream.push(i);
            let seen = 0;

            for (let t = 0; t < 200; t += 1) {
              if (sample(stream, 10, api.Random.seeded(t * 53 + 7)).indexOf(999) >= 0) seen += 1;
            }
            api.assert.atLeast(seen, 1,
              'the final item has probability k/n of surviving; a prefix sampler never returns it');
          }
        }
      ]
    }],

    'work-and-span': [{
      id: 'work-and-span-of-a-graph',
      title: 'Work, span and the speed-up ceiling, read off a dependency graph',
      prompt: 'analyse(nodes) takes an array where nodes[i] is the array of indices node i ' +
        'depends on — every dependency points to a LOWER index — and must return ' +
        '{ work, span, parallelism }. The work is the number of nodes, since each is one ' +
        'operation. The span is the length of the longest chain of dependent nodes: a node with ' +
        'no dependencies has depth 1, and otherwise its depth is one more than the deepest thing ' +
        'it depends on. The parallelism is work divided by span. The starter assumes the graph is ' +
        'a chain, which is what "inherently sequential" would mean if it were true.',
      entry: 'analyse',
      starter: [
        'function analyse(nodes) {',
        '  // Assumes every node waits for the one before it.',
        '  return {',
        '    work: nodes.length,',
        '    span: nodes.length,',
        '    parallelism: 1',
        '  };',
        '}'
      ].join('\n'),
      solution: [
        'function analyse(nodes) {',
        '  const depth = [];',
        '  let span = 0;',
        '',
        '  nodes.forEach(function (deps, i) {',
        '    let deepest = 0;',
        '',
        '    deps.forEach(function (d) {',
        '      if (depth[d] > deepest) deepest = depth[d];',
        '    });',
        '    depth[i] = deepest + 1;',
        '    if (depth[i] > span) span = depth[i];',
        '  });',
        '  return {',
        '    work: nodes.length,',
        '    span: span,',
        '    parallelism: span === 0 ? 0 : nodes.length / span',
        '  };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'a chain has span equal to its work',
          assert: function (analyse, api) {
            const nodes = [[]];

            for (let i = 1; i < 256; i += 1) nodes.push([i - 1]);
            const got = analyse(nodes);

            api.assert.equal(got.work, 256, 'every node is one operation');
            api.assert.equal(got.span, 256, 'a chain of 256 has a critical path of 256');
            api.assert.closeTo(got.parallelism, 1, 1e-9, 'a chain has no parallelism at all');
          }
        },
        {
          name: 'independent nodes have a span of one',
          assert: function (analyse, api) {
            const nodes = [];

            for (let i = 0; i < 64; i += 1) nodes.push([]);
            const got = analyse(nodes);

            api.assert.equal(got.span, 1, '64 independent operations take one step');
            api.assert.closeTo(got.parallelism, 64, 1e-9, 'the parallelism is the node count');
          }
        },
        {
          name: 'a reduction tree over 256 leaves has a span of log n plus one',
          assert: function (analyse, api) {
            const nodes = [];
            let level = [];

            for (let i = 0; i < 256; i += 1) {
              nodes.push([]);
              level.push(i);
            }
            while (level.length > 1) {
              const next = [];

              for (let i = 0; i < level.length; i += 2) {
                nodes.push([level[i], level[i + 1]]);
                next.push(nodes.length - 1);
              }
              level = next;
            }
            const got = analyse(nodes);

            api.assert.equal(got.work, 511, '256 leaves and 255 internal nodes');
            api.assert.equal(got.span, 9, 'eight levels of combining above the leaves');
            api.assert.closeTo(got.parallelism, 511 / 9, 1e-9,
              'the parallelism is work over span, and it is a ceiling on any speed-up');
          }
        },
        {
          name: 'a node waits for the deepest of its dependencies, not the last',
          assert: function (analyse, api) {
            const nodes = [[], [0], [1], [2], [], [3, 4]];
            const got = analyse(nodes);

            api.assert.equal(got.work, 6, 'six operations');
            api.assert.equal(got.span, 5,
              'the path 0-1-2-3-5 is length 5; taking the last dependency instead would say 2');
          }
        }
      ]
    }],

    'choosing-a-cost-model': [{
      id: 'bytes-per-byte',
      title: 'Bytes fetched per byte used, measured rather than argued',
      prompt: 'walk(config) takes { elements, stride, lineElements, cacheLines, passes } and must ' +
        'simulate `passes` traversals of an array of `elements` doubles, touching every `stride`-th ' +
        'element, against a fully associative LRU cache of `cacheLines` lines holding ' +
        '`lineElements` doubles each. A double is 8 bytes. Return { accesses, misses, ' +
        'bytesFetched, bytesUsed }, where bytesFetched is misses × lineElements × 8 and bytesUsed ' +
        'is accesses × 8. The element at index i sits in line floor(i / lineElements). The ' +
        'starter charges a miss per access, which is the model that cannot tell a sequential scan ' +
        'from a random probe.',
      entry: 'walk',
      starter: [
        'function walk(config) {',
        '  // No lines and no cache: every access is a miss, and a scan looks like a random probe.',
        '  let accesses = 0;',
        '',
        '  for (let p = 0; p < config.passes; p += 1) {',
        '    for (let i = 0; i < config.elements; i += config.stride) accesses += 1;',
        '  }',
        '  return {',
        '    accesses: accesses,',
        '    misses: accesses,',
        '    bytesFetched: accesses * config.lineElements * 8,',
        '    bytesUsed: accesses * 8',
        '  };',
        '}'
      ].join('\n'),
      solution: [
        'function walk(config) {',
        '  const resident = [];',
        '  let accesses = 0;',
        '  let misses = 0;',
        '',
        '  function touch(line) {',
        '    const at = resident.indexOf(line);',
        '',
        '    if (at >= 0) {',
        '      resident.splice(at, 1);',
        '      resident.push(line);',
        '      return;',
        '    }',
        '    misses += 1;',
        '    resident.push(line);',
        '    if (resident.length > config.cacheLines) resident.shift();',
        '  }',
        '  for (let p = 0; p < config.passes; p += 1) {',
        '    for (let i = 0; i < config.elements; i += config.stride) {',
        '      accesses += 1;',
        '      touch(Math.floor(i / config.lineElements));',
        '    }',
        '  }',
        '  return {',
        '    accesses: accesses,',
        '    misses: misses,',
        '    bytesFetched: misses * config.lineElements * 8,',
        '    bytesUsed: accesses * 8',
        '  };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'a sequential scan misses once per line and wastes nothing',
          assert: function (walk, api) {
            const got = walk({ elements: 4096, stride: 1, lineElements: 8, cacheLines: 512, passes: 1 });

            api.assert.equal(got.accesses, 4096, 'every element is touched');
            api.assert.equal(got.misses, 512, 'one miss per cache line: 4096 / 8');
            api.assert.equal(got.bytesFetched, 32768, '512 lines of 64 bytes');
            api.assert.equal(got.bytesUsed, 32768, '4096 doubles');
            api.assert.closeTo(got.bytesFetched / got.bytesUsed, 1, 1e-9,
              'a scan fetches exactly what it uses - the compulsory minimum');
          }
        },
        {
          name: 'a stride of one line misses on every access',
          assert: function (walk, api) {
            const got = walk({ elements: 4096, stride: 8, lineElements: 8, cacheLines: 512, passes: 1 });

            api.assert.equal(got.accesses, 512, 'one access per line');
            api.assert.equal(got.misses, 512, 'and every one of them misses');
            api.assert.closeTo(got.misses / got.accesses, 1, 1e-9, 'a 100% miss rate');
            api.assert.closeTo(got.bytesFetched / got.bytesUsed, 8, 1e-9,
              '64 bytes fetched for every 8 used');
          }
        },
        {
          name: 'the miss rate saturates - a wider stride does not make it worse',
          assert: function (walk, api) {
            const wide = walk({ elements: 4096, stride: 64, lineElements: 8, cacheLines: 512, passes: 1 });

            api.assert.equal(wide.accesses, 64, 'one access per 64 elements');
            api.assert.equal(wide.misses, 64, 'still every access');
            api.assert.closeTo(wide.bytesFetched / wide.bytesUsed, 8, 1e-9,
              'still 8x - once the stride exceeds a line, nothing changes');
          }
        },
        {
          name: 'a second pass over a resident array is free',
          assert: function (walk, api) {
            const fits = walk({ elements: 512, stride: 1, lineElements: 8, cacheLines: 512, passes: 4 });

            api.assert.equal(fits.accesses, 2048, 'four passes of 512 elements');
            api.assert.equal(fits.misses, 64, 'only the first pass misses: 512 / 8 lines');

            const spills = walk({ elements: 8192, stride: 1, lineElements: 8, cacheLines: 512, passes: 4 });

            api.assert.equal(spills.misses, 4096,
              'a working set twice the cache re-misses on every pass under LRU');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));

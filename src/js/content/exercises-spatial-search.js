/**
 * Graded exercises for the range-structure, vector and broad-phase sections
 * (M08.7-M08.9).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'range-structures': [{
      id: 'lazy-segment-tree',
      title: 'Range add, range min, and the push convention',
      prompt: 'makeLazyTree(values) must return { rangeAdd, rangeMin }. rangeAdd(from, to, delta) adds delta to ' +
        'every element in the inclusive range; rangeMin(from, to) returns the smallest element in it. Use lazy ' +
        'propagation: a pending add waits at the node it covers and is pushed to the children only when a ' +
        'traversal descends past it. The convention that decides correctness is which value the pending add has ' +
        'already been applied to - get it backwards and the structure is right whenever a range happens to align ' +
        'with a node boundary, which is every example you would write by hand and none of 20 000 random ones.',
      entry: 'makeLazyTree',
      starter: [
        'function makeLazyTree(values) {',
        '  const n = values.length;',
        '  const size = 4 * Math.max(1, n);',
        '  const tree = new Float64Array(size);',
        '  const lazy = new Float64Array(size);',
        '',
        '  function build(node, lo, hi) {',
        '    if (lo === hi) { tree[node] = values[lo]; return; }',
        '    const mid = (lo + hi) >> 1;',
        '    build(node * 2, lo, mid);',
        '    build(node * 2 + 1, mid + 1, hi);',
        '    tree[node] = Math.min(tree[node * 2], tree[node * 2 + 1]);',
        '  }',
        '',
        '  if (n) build(1, 0, n - 1);',
        '',
        '  function push(node) {',
        '    if (!lazy[node]) return;',
        '    lazy[node * 2] += lazy[node];',
        '    lazy[node * 2 + 1] += lazy[node];',
        '    lazy[node] = 0;',
        '  }',
        '',
        '  // the reversed convention: the pending add is recorded but the',
        '  // node\'s own stored minimum is never updated with it',
        '  function applyAdd(span, range, delta) {',
        '    if (range.to < span.lo || range.from > span.hi) return;',
        '    if (range.from <= span.lo && span.hi <= range.to) { lazy[span.node] += delta; return; }',
        '    push(span.node);',
        '    const mid = (span.lo + span.hi) >> 1;',
        '    applyAdd({ node: span.node * 2, lo: span.lo, hi: mid }, range, delta);',
        '    applyAdd({ node: span.node * 2 + 1, lo: mid + 1, hi: span.hi }, range, delta);',
        '    tree[span.node] = Math.min(tree[span.node * 2], tree[span.node * 2 + 1]);',
        '  }',
        '',
        '  function descend(span, range) {',
        '    if (range.to < span.lo || range.from > span.hi) return Infinity;',
        '    if (range.from <= span.lo && span.hi <= range.to) return tree[span.node];',
        '    push(span.node);',
        '    const mid = (span.lo + span.hi) >> 1;',
        '    return Math.min(',
        '      descend({ node: span.node * 2, lo: span.lo, hi: mid }, range),',
        '      descend({ node: span.node * 2 + 1, lo: mid + 1, hi: span.hi }, range)',
        '    );',
        '  }',
        '',
        '  return {',
        '    rangeAdd: function (from, to, delta) {',
        '      applyAdd({ node: 1, lo: 0, hi: n - 1 }, { from: from, to: to }, delta);',
        '    },',
        '    rangeMin: function (from, to) {',
        '      return descend({ node: 1, lo: 0, hi: n - 1 }, { from: from, to: to });',
        '    }',
        '  };',
        '}'
      ].join('\n'),
      solution: [
        'function makeLazyTree(values) {',
        '  const n = values.length;',
        '  const size = 4 * Math.max(1, n);',
        '  const tree = new Float64Array(size);',
        '  const lazy = new Float64Array(size);',
        '',
        '  function build(node, lo, hi) {',
        '    if (lo === hi) { tree[node] = values[lo]; return; }',
        '    const mid = (lo + hi) >> 1;',
        '    build(node * 2, lo, mid);',
        '    build(node * 2 + 1, mid + 1, hi);',
        '    tree[node] = Math.min(tree[node * 2], tree[node * 2 + 1]);',
        '  }',
        '',
        '  if (n) build(1, 0, n - 1);',
        '',
        '  // the convention: tree[node] is ALREADY correct for its own subtree,',
        '  // and lazy[node] is what the children have not been told yet',
        '  function push(node) {',
        '    if (!lazy[node]) return;',
        '    tree[node * 2] += lazy[node];',
        '    lazy[node * 2] += lazy[node];',
        '    tree[node * 2 + 1] += lazy[node];',
        '    lazy[node * 2 + 1] += lazy[node];',
        '    lazy[node] = 0;',
        '  }',
        '',
        '  function applyAdd(span, range, delta) {',
        '    if (range.to < span.lo || range.from > span.hi) return;',
        '    if (range.from <= span.lo && span.hi <= range.to) {',
        '      tree[span.node] += delta;',
        '      lazy[span.node] += delta;',
        '      return;',
        '    }',
        '    push(span.node);',
        '    const mid = (span.lo + span.hi) >> 1;',
        '    applyAdd({ node: span.node * 2, lo: span.lo, hi: mid }, range, delta);',
        '    applyAdd({ node: span.node * 2 + 1, lo: mid + 1, hi: span.hi }, range, delta);',
        '    tree[span.node] = Math.min(tree[span.node * 2], tree[span.node * 2 + 1]);',
        '  }',
        '',
        '  function descend(span, range) {',
        '    if (range.to < span.lo || range.from > span.hi) return Infinity;',
        '    if (range.from <= span.lo && span.hi <= range.to) return tree[span.node];',
        '    push(span.node);',
        '    const mid = (span.lo + span.hi) >> 1;',
        '    return Math.min(',
        '      descend({ node: span.node * 2, lo: span.lo, hi: mid }, range),',
        '      descend({ node: span.node * 2 + 1, lo: mid + 1, hi: span.hi }, range)',
        '    );',
        '  }',
        '',
        '  return {',
        '    rangeAdd: function (from, to, delta) {',
        '      applyAdd({ node: 1, lo: 0, hi: n - 1 }, { from: from, to: to }, delta);',
        '    },',
        '    rangeMin: function (from, to) {',
        '      return descend({ node: 1, lo: 0, hi: n - 1 }, { from: from, to: to });',
        '    }',
        '  };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: '20 000 mixed operations agree with a plain-array replay',
          assert: function (makeLazyTree, api) {
            const random = api.rng;
            const values = [];
            for (let i = 0; i < 512; i += 1) values.push(random.int(1000));

            const tree = makeLazyTree(values);
            const truth = values.slice();
            let mismatches = 0;

            for (let step = 0; step < 20000; step += 1) {
              const a = random.int(512);
              const b = random.int(512);
              const from = Math.min(a, b);
              const to = Math.max(a, b);

              if (random.next() < 0.5) {
                const delta = random.int(41) - 20;
                tree.rangeAdd(from, to, delta);
                for (let i = from; i <= to; i += 1) truth[i] += delta;
                continue;
              }

              let best = Infinity;
              for (let i = from; i <= to; i += 1) best = Math.min(best, truth[i]);
              if (tree.rangeMin(from, to) !== best) mismatches += 1;
            }

            api.assert.equal(mismatches, 0, mismatches + ' range minima were wrong');
          }
        },
        {
          name: 'a range that does not align with any node boundary is still right',
          assert: function (makeLazyTree, api) {
            const values = [];
            for (let i = 0; i < 16; i += 1) values.push(100 + i);

            const tree = makeLazyTree(values);
            tree.rangeAdd(3, 11, -50);

            api.assert.equal(tree.rangeMin(0, 15), 53, 'the minimum is now at index 3');
            api.assert.equal(tree.rangeMin(0, 2), 100, 'outside the update nothing moved');
            api.assert.equal(tree.rangeMin(12, 15), 112, 'and nothing moved on the right either');
            api.assert.equal(tree.rangeMin(5, 7), 55);
          }
        },
        {
          name: 'overlapping updates accumulate',
          assert: function (makeLazyTree, api) {
            const values = [];
            for (let i = 0; i < 32; i += 1) values.push(0);

            const tree = makeLazyTree(values);
            tree.rangeAdd(0, 31, 5);
            tree.rangeAdd(8, 23, 5);
            tree.rangeAdd(12, 19, 5);

            api.assert.equal(tree.rangeMin(12, 19), 15, 'three updates cover the middle');
            api.assert.equal(tree.rangeMin(8, 11), 10, 'two cover the shoulders');
            api.assert.equal(tree.rangeMin(0, 7), 5, 'one covers the ends');
            api.assert.equal(tree.rangeMin(0, 31), 5);
          }
        },
        {
          name: 'it is a tree, not a loop over the range',
          assert: function (makeLazyTree, api) {
            const values = new Array(200000).fill(1000);
            const tree = makeLazyTree(values);

            // a linear implementation does 200 000 x 4 000 element visits here
            for (let step = 0; step < 4000; step += 1) {
              tree.rangeAdd(0, 199999, -1);
              tree.rangeMin(0, 199999);
            }

            api.assert.equal(tree.rangeMin(0, 199999), 1000 - 4000);
            api.assert.equal(tree.rangeMin(12345, 12345), 1000 - 4000);
          }
        }
      ]
    }],

    'vector-search': [{
      id: 'hnsw-greedy-search',
      title: 'Greedy search over a prebuilt proximity graph',
      prompt: 'makeSearch(graph) must return { search, stats }. The graph is an array of ' +
        '{ id, v, links } where links holds the ids of that node\'s neighbours. search(query, k, ef) returns the ' +
        'k nearest nodes as { id, distance } sorted ascending, using a best-first walk: keep a candidate list ' +
        'and a result list of size ef, repeatedly take the nearest unexpanded candidate, and stop when the ' +
        'nearest candidate is further than the worst result you are keeping. Never visit a node twice. Distance ' +
        'is squared Euclidean. stats() returns { distanceComputations }. The grading is a recall floor at a ' +
        'stated ef, because an approximate index has no exact answer to be compared against.',
      entry: 'makeSearch',
      starter: [
        'function makeSearch(graph) {',
        '  let distanceComputations = 0;',
        '  const byId = new Map();',
        '  graph.forEach(function (node) { byId.set(node.id, node); });',
        '',
        '  function distance(a, b) {',
        '    distanceComputations += 1;',
        '    let total = 0;',
        '    for (let i = 0; i < a.length; i += 1) { const d = a[i] - b[i]; total += d * d; }',
        '    return total;',
        '  }',
        '',
        '  return {',
        '    search: function (query, k, ef) {',
        '      // greedy descent with no beam: it stops at the first local minimum',
        '      let current = graph[0];',
        '      let best = distance(current.v, query);',
        '      let moved = true;',
        '      while (moved) {',
        '        moved = false;',
        '        current.links.forEach(function (id) {',
        '          const other = byId.get(id);',
        '          const d = distance(other.v, query);',
        '          if (d < best) { best = d; current = other; moved = true; }',
        '        });',
        '      }',
        '      return [{ id: current.id, distance: best }].slice(0, k);',
        '    },',
        '    stats: function () { return { distanceComputations: distanceComputations }; }',
        '  };',
        '}'
      ].join('\n'),
      solution: [
        'function makeSearch(graph) {',
        '  let distanceComputations = 0;',
        '  const byId = new Map();',
        '  graph.forEach(function (node) { byId.set(node.id, node); });',
        '',
        '  function distance(a, b) {',
        '    distanceComputations += 1;',
        '    let total = 0;',
        '    for (let i = 0; i < a.length; i += 1) { const d = a[i] - b[i]; total += d * d; }',
        '    return total;',
        '  }',
        '',
        '  // ef is in the tens, so a sorted array beats a heap and keeps the',
        '  // pruning bound - the worst kept result - at a known index',
        '  function insertSorted(list, entry) {',
        '    let at = list.length;',
        '    while (at > 0 && list[at - 1].distance > entry.distance) at -= 1;',
        '    list.splice(at, 0, entry);',
        '  }',
        '',
        '  return {',
        '    search: function (query, k, ef) {',
        '      const beam = Math.max(k, ef || k);',
        '      const start = graph[0];',
        '      const visited = new Set([start.id]);',
        '      const first = { id: start.id, distance: distance(start.v, query) };',
        '      const candidates = [first];',
        '      const results = [first];',
        '',
        '      while (candidates.length) {',
        '        const nearest = candidates.shift();',
        '        if (results.length >= beam && nearest.distance > results[results.length - 1].distance) break;',
        '',
        '        const links = byId.get(nearest.id).links;',
        '        for (let i = 0; i < links.length; i += 1) {',
        '          if (visited.has(links[i])) continue;',
        '          visited.add(links[i]);',
        '          const entry = { id: links[i], distance: distance(byId.get(links[i]).v, query) };',
        '          const worst = results.length ? results[results.length - 1].distance : Infinity;',
        '          if (results.length >= beam && entry.distance >= worst) continue;',
        '          insertSorted(candidates, entry);',
        '          insertSorted(results, entry);',
        '          if (results.length > beam) results.pop();',
        '        }',
        '      }',
        '',
        '      return results.slice(0, k);',
        '    },',
        '    stats: function () { return { distanceComputations: distanceComputations }; }',
        '  };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'recall at k = 10 clears 90% at ef = 50',
          assert: function (makeSearch, api) {
            const random = api.rng;
            const dims = 8;
            const vectors = [];
            for (let i = 0; i < 800; i += 1) {
              const v = [];
              for (let d = 0; d < dims; d += 1) v.push(random.next());
              vectors.push({ id: i, v: v });
            }

            function distance(a, b) {
              let total = 0;
              for (let i = 0; i < a.length; i += 1) { const d = a[i] - b[i]; total += d * d; }
              return total;
            }

            // a plain symmetric k-NN graph, which is enough to be navigable
            const links = vectors.map(function () { return new Set(); });
            vectors.forEach(function (node, i) {
              const scored = vectors.map(function (other, j) {
                return { j: j, d: distance(node.v, other.v) };
              }).sort(function (a, b) { return a.d - b.d; }).slice(1, 9);
              scored.forEach(function (entry) {
                links[i].add(vectors[entry.j].id);
                links[entry.j].add(node.id);
              });
            });

            const graph = vectors.map(function (node, i) {
              return { id: node.id, v: node.v, links: Array.from(links[i]) };
            });

            const searcher = makeSearch(graph);
            let found = 0;
            const queries = 40;
            for (let q = 0; q < queries; q += 1) {
              const query = [];
              for (let d = 0; d < dims; d += 1) query.push(random.next());

              const truth = vectors.map(function (node) {
                return { id: node.id, d: distance(node.v, query) };
              }).sort(function (a, b) { return a.d - b.d; }).slice(0, 10)
                .map(function (entry) { return entry.id; });

              const returned = searcher.search(query, 10, 50).map(function (entry) { return entry.id; });
              const truthSet = new Set(truth);
              returned.forEach(function (id) { if (truthSet.has(id)) found += 1; });
            }

            const recall = found / (queries * 10);
            api.assert.atLeast(recall, 0.9, 'recall at ef = 50 was ' + (recall * 100).toFixed(1) + '%');
          }
        },
        {
          name: 'the results are k of them, sorted, with real distances',
          assert: function (makeSearch, api) {
            const graph = [];
            for (let i = 0; i < 60; i += 1) {
              graph.push({ id: i, v: [i, 0], links: [] });
            }
            graph.forEach(function (node, i) {
              if (i > 0) node.links.push(i - 1);
              if (i < 59) node.links.push(i + 1);
            });

            const results = makeSearch(graph).search([30.2, 0], 5, 30);
            api.assert.equal(results.length, 5, 'exactly k results');
            for (let i = 1; i < results.length; i += 1) {
              api.assert.ok(results[i].distance >= results[i - 1].distance, 'results must be sorted ascending');
            }
            api.assert.equal(results[0].id, 30, 'the nearest node on a line is the obvious one');
            api.assert.closeTo(results[0].distance, 0.04, 1e-9, 'the distance is squared Euclidean');
          }
        },
        {
          name: 'the beam is what escapes a local minimum',
          assert: function (makeSearch, api) {
            // a line of nodes with a dip near the start: a pure greedy walk
            // settles in the dip and never reaches the true minimum at the end
            const graph = [];
            for (let i = 0; i < 40; i += 1) {
              const y = i === 5 ? -3 : (i >= 35 ? -10 : 0);
              graph.push({ id: i, v: [i, y], links: [] });
            }
            graph.forEach(function (node, i) {
              if (i > 0) node.links.push(i - 1);
              if (i < 39) node.links.push(i + 1);
            });

            const results = makeSearch(graph).search([39, -10], 1, 64);
            api.assert.equal(results[0].id, 39, 'a wide enough beam walks past the dip at node 5');
          }
        },
        {
          name: 'no node is expanded twice',
          assert: function (makeSearch, api) {
            const graph = [];
            for (let i = 0; i < 100; i += 1) graph.push({ id: i, v: [i % 10, Math.floor(i / 10)], links: [] });
            graph.forEach(function (node, i) {
              [i - 1, i + 1, i - 10, i + 10].forEach(function (j) {
                if (j >= 0 && j < 100) node.links.push(j);
              });
            });

            const searcher = makeSearch(graph);
            searcher.search([4.5, 4.5], 5, 100);
            api.assert.atMost(searcher.stats().distanceComputations, 100,
              'with ef = 100 every node is reachable, but each must be measured once');
          }
        }
      ]
    }],

    'broad-phase': [{
      id: 'sweep-and-prune',
      title: 'Sweep and prune with an incremental re-sort',
      prompt: 'makeSweep() must return { pairs, stats }. pairs(bodies) takes an array of ' +
        '{ id, x, y, r } and returns the ids of every touching pair as "a:b" strings with a < b numerically ' +
        'ordered - exactly the set an all-pairs test returns. Sort the bodies by their low x edge with an ' +
        'insertion sort *over the previous frame\'s order*, then for each body scan forward only while the next ' +
        'body\'s low edge is at or before this one\'s high edge. stats() returns { tests, swaps }, where a test ' +
        'is a pair you actually measured. Both are graded: the pair set must be exact, and the swap count after ' +
        'the first frame is the whole justification for using an insertion sort.',
      entry: 'makeSweep',
      starter: [
        'function makeSweep() {',
        '  let tests = 0;',
        '  let swaps = 0;',
        '',
        '  return {',
        '    pairs: function (bodies) {',
        '      // all pairs: correct, and not a broad phase',
        '      const out = [];',
        '      for (let i = 0; i < bodies.length; i += 1) {',
        '        for (let j = i + 1; j < bodies.length; j += 1) {',
        '          tests += 1;',
        '          const dx = bodies[i].x - bodies[j].x;',
        '          const dy = bodies[i].y - bodies[j].y;',
        '          const reach = bodies[i].r + bodies[j].r;',
        '          if (dx * dx + dy * dy <= reach * reach) {',
        '            const a = Math.min(bodies[i].id, bodies[j].id);',
        '            const b = Math.max(bodies[i].id, bodies[j].id);',
        '            out.push(a + \':\' + b);',
        '          }',
        '        }',
        '      }',
        '      return out;',
        '    },',
        '    stats: function () { return { tests: tests, swaps: swaps }; }',
        '  };',
        '}'
      ].join('\n'),
      solution: [
        'function makeSweep() {',
        '  let order = null;',
        '  let tests = 0;',
        '  let swaps = 0;',
        '',
        '  return {',
        '    pairs: function (bodies) {',
        '      if (!order || order.length !== bodies.length) {',
        '        order = bodies.map(function (body, index) { return index; });',
        '      }',
        '',
        '      // insertion sort over the PREVIOUS frame\'s order: between two',
        '      // frames almost nothing has changed places, so this is O(n)',
        '      for (let i = 1; i < order.length; i += 1) {',
        '        const current = order[i];',
        '        const key = bodies[current].x - bodies[current].r;',
        '        let j = i - 1;',
        '        while (j >= 0 && bodies[order[j]].x - bodies[order[j]].r > key) {',
        '          order[j + 1] = order[j];',
        '          j -= 1;',
        '          swaps += 1;',
        '        }',
        '        order[j + 1] = current;',
        '      }',
        '',
        '      const out = [];',
        '      for (let i = 0; i < order.length; i += 1) {',
        '        const a = bodies[order[i]];',
        '        for (let j = i + 1; j < order.length; j += 1) {',
        '          const b = bodies[order[j]];',
        '          // the early exit is the whole algorithm',
        '          if (b.x - b.r > a.x + a.r) break;',
        '          tests += 1;',
        '          const dx = a.x - b.x;',
        '          const dy = a.y - b.y;',
        '          const reach = a.r + b.r;',
        '          if (dx * dx + dy * dy <= reach * reach) {',
        '            out.push(Math.min(a.id, b.id) + \':\' + Math.max(a.id, b.id));',
        '          }',
        '        }',
        '      }',
        '      return out;',
        '    },',
        '    stats: function () { return { tests: tests, swaps: swaps }; }',
        '  };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the pair set equals an all-pairs test on every one of 60 frames',
          assert: function (makeSweep, api) {
            const random = api.rng;
            const bodies = [];
            for (let i = 0; i < 250; i += 1) {
              const angle = random.next() * Math.PI * 2;
              bodies.push({
                id: i,
                x: 6 + random.next() * 788, y: 6 + random.next() * 588,
                vx: Math.cos(angle) * 60, vy: Math.sin(angle) * 60, r: 7
              });
            }

            const sweep = makeSweep();
            for (let frame = 0; frame < 60; frame += 1) {
              const found = sweep.pairs(bodies).slice().sort();
              const truth = [];
              for (let i = 0; i < bodies.length; i += 1) {
                for (let j = i + 1; j < bodies.length; j += 1) {
                  const dx = bodies[i].x - bodies[j].x;
                  const dy = bodies[i].y - bodies[j].y;
                  const reach = bodies[i].r + bodies[j].r;
                  if (dx * dx + dy * dy <= reach * reach) {
                    truth.push(Math.min(bodies[i].id, bodies[j].id) + ':' + Math.max(bodies[i].id, bodies[j].id));
                  }
                }
              }
              api.assert.deepEqual(found, truth.sort(), 'frame ' + frame);

              bodies.forEach(function (body) {
                body.x += body.vx / 30;
                body.y += body.vy / 30;
                if (body.x - body.r < 0) { body.x = body.r; body.vx = -body.vx; }
                if (body.x + body.r > 800) { body.x = 800 - body.r; body.vx = -body.vx; }
                if (body.y - body.r < 0) { body.y = body.r; body.vy = -body.vy; }
                if (body.y + body.r > 600) { body.y = 600 - body.r; body.vy = -body.vy; }
              });
            }
          }
        },
        {
          name: 'it tests far fewer pairs than all pairs',
          assert: function (makeSweep, api) {
            const random = api.rng;
            const bodies = [];
            for (let i = 0; i < 250; i += 1) {
              const angle = random.next() * Math.PI * 2;
              bodies.push({
                id: i,
                x: 6 + random.next() * 788, y: 6 + random.next() * 588,
                vx: Math.cos(angle) * 60, vy: Math.sin(angle) * 60, r: 7
              });
            }

            const sweep = makeSweep();
            for (let frame = 0; frame < 30; frame += 1) {
              sweep.pairs(bodies);
              bodies.forEach(function (body) {
                body.x += body.vx / 30;
                body.y += body.vy / 30;
                if (body.x - body.r < 0 || body.x + body.r > 800) body.vx = -body.vx;
                if (body.y - body.r < 0 || body.y + body.r > 600) body.vy = -body.vy;
              });
            }

            const perFrame = sweep.stats().tests / 30;
            api.assert.atMost(perFrame, 6000,
              'all pairs is 31 125 per frame; a sorted sweep must be far under it, and measured ' + perFrame.toFixed(0));
          }
        },
        {
          name: 'the sort exploits temporal coherence after the first frame',
          assert: function (makeSweep, api) {
            const random = api.rng;
            const bodies = [];
            for (let i = 0; i < 250; i += 1) {
              bodies.push({ id: i, x: 6 + random.next() * 788, y: 6 + random.next() * 588, r: 7 });
            }

            const sweep = makeSweep();
            sweep.pairs(bodies);
            const afterFirst = sweep.stats().swaps;
            api.assert.atLeast(afterFirst, 5000, 'the first frame really is a full sort of a random order');

            for (let frame = 0; frame < 20; frame += 1) {
              bodies.forEach(function (body) { body.x += 0.5; });
              sweep.pairs(bodies);
            }

            const later = (sweep.stats().swaps - afterFirst) / 20;
            api.assert.atMost(later, 40,
              'a nearly sorted frame must cost almost nothing, and measured ' + later.toFixed(1) + ' swaps');
          }
        },
        {
          name: 'bodies far apart on the sweep axis are never measured',
          assert: function (makeSweep, api) {
            const bodies = [
              { id: 0, x: 0, y: 0, r: 1 },
              { id: 1, x: 1.5, y: 0, r: 1 },
              { id: 2, x: 500, y: 0, r: 1 },
              { id: 3, x: 501.5, y: 0, r: 1 }
            ];

            const sweep = makeSweep();
            const found = sweep.pairs(bodies).slice().sort();
            api.assert.deepEqual(found, ['0:1', '2:3']);
            api.assert.atMost(sweep.stats().tests, 3,
              'the pair (1, 2) is 498 units apart and must be skipped by the early exit');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));

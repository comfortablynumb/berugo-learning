/**
 * Graded exercises for spanning trees and tree path queries (M13.9-M13.10).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'minimum-spanning-trees': [{
      id: 'boruvka-component-merging',
      title: 'Borůvka, and the tie-break that keeps it acyclic',
      prompt: 'boruvka(n, edges) must return { weight, chosen } for an UNDIRECTED weighted graph: the ' +
        'total weight of a minimum spanning forest and the ids — indices into `edges` — of the edges ' +
        'in it, sorted ascending. Each round, every component finds its own cheapest outgoing edge and ' +
        'they all merge at once; the component count at least halves per round, so there are at most ' +
        'log2 n rounds. Two things must be right. Ties must be broken CONSISTENTLY — by edge id here — ' +
        'or two components can pick different copies of the same-weight edge between them and the ' +
        'merge makes a cycle. And the edge between two components is chosen by BOTH of them, so it ' +
        'must be added once: the starter adds every choice it is handed, which double-counts exactly ' +
        'those edges.',
      entry: 'boruvka',
      starter: [
        'function boruvka(n, edges) {',
        '  const parent = new Array(n);',
        '  for (let v = 0; v < n; v += 1) parent[v] = v;',
        '',
        '  function find(v) {',
        '    let at = v;',
        '    while (parent[at] !== at) { parent[at] = parent[parent[at]]; at = parent[at]; }',
        '    return at;',
        '  }',
        '',
        '  const chosen = [];',
        '  let weight = 0;',
        '  let components = n;',
        '',
        '  while (components > 1) {',
        '    const best = {};',
        '    edges.forEach(function (edge, id) {',
        '      const a = find(edge.from);',
        '      const b = find(edge.to);',
        '      if (a === b) return;',
        '      [a, b].forEach(function (side) {',
        '        const current = best[side];',
        '        if (current && (current.weight < edge.weight ||',
        '            (current.weight === edge.weight && current.id < id))) return;',
        '        best[side] = { weight: edge.weight, id: id, from: edge.from, to: edge.to };',
        '      });',
        '    });',
        '',
        '    let merged = 0;',
        '    Object.keys(best).forEach(function (key) {',
        '      const edge = best[key];',
        '      // every choice is taken, so the edge between two components',
        '      // is added twice — once from each side',
        '      chosen.push(edge.id);',
        '      weight += edge.weight;',
        '      const a = find(edge.from);',
        '      const b = find(edge.to);',
        '      if (a === b) return;',
        '      parent[a] = b;',
        '      components -= 1;',
        '      merged += 1;',
        '    });',
        '    if (merged === 0) break;',
        '  }',
        '  return { weight: weight, chosen: chosen.sort(function (a, b) { return a - b; }) };',
        '}'
      ].join('\n'),
      solution: [
        'function boruvka(n, edges) {',
        '  const parent = new Array(n);',
        '  for (let v = 0; v < n; v += 1) parent[v] = v;',
        '',
        '  function find(v) {',
        '    let at = v;',
        '    while (parent[at] !== at) { parent[at] = parent[parent[at]]; at = parent[at]; }',
        '    return at;',
        '  }',
        '',
        '  const chosen = [];',
        '  const taken = {};',
        '  let weight = 0;',
        '  let components = n;',
        '',
        '  while (components > 1) {',
        '    const best = {};',
        '    edges.forEach(function (edge, id) {',
        '      const a = find(edge.from);',
        '      const b = find(edge.to);',
        '      if (a === b) return;',
        '      [a, b].forEach(function (side) {',
        '        const current = best[side];',
        '        // ties broken by edge id, consistently, from both sides',
        '        if (current && (current.weight < edge.weight ||',
        '            (current.weight === edge.weight && current.id < id))) return;',
        '        best[side] = { weight: edge.weight, id: id, from: edge.from, to: edge.to };',
        '      });',
        '    });',
        '',
        '    let merged = 0;',
        '    Object.keys(best).forEach(function (key) {',
        '      const edge = best[key];',
        '      if (taken[edge.id]) return;',
        '      const a = find(edge.from);',
        '      const b = find(edge.to);',
        '      if (a === b) return;',
        '      parent[a] = b;',
        '      taken[edge.id] = true;',
        '      chosen.push(edge.id);',
        '      weight += edge.weight;',
        '      components -= 1;',
        '      merged += 1;',
        '    });',
        '    if (merged === 0) break;',
        '  }',
        '  return { weight: weight, chosen: chosen.sort(function (a, b) { return a - b; }) };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the weight matches Kruskal, including on duplicate weights',
          assert: function (boruvka, api) {
            function kruskal(n, edges) {
              const order = edges.map(function (edge, id) {
                return { from: edge.from, to: edge.to, weight: edge.weight, id: id };
              }).sort(function (a, b) { return a.weight - b.weight || a.id - b.id; });
              const parent = new Array(n);

              for (let v = 0; v < n; v += 1) parent[v] = v;

              function find(v) {
                let at = v;

                while (parent[at] !== at) { parent[at] = parent[parent[at]]; at = parent[at]; }
                return at;
              }
              let total = 0;

              order.forEach(function (edge) {
                const a = find(edge.from);
                const b = find(edge.to);

                if (a === b) return;
                parent[a] = b;
                total += edge.weight;
              });
              return total;
            }

            [3, 8, 1000].forEach(function (range) {
              for (let trial = 0; trial < 8; trial += 1) {
                const n = 30;
                const edges = [];

                for (let v = 1; v < n; v += 1) {
                  edges.push({ from: api.rng.int(v), to: v, weight: 1 + api.rng.int(range) });
                }

                for (let i = 0; i < 50; i += 1) {
                  const a = api.rng.int(n);
                  const b = api.rng.int(n);

                  if (a === b) continue;
                  edges.push({ from: a, to: b, weight: 1 + api.rng.int(range) });
                }
                const got = boruvka(n, edges);

                api.assert.equal(got.weight, kruskal(n, edges),
                  'weights drawn from 1 to ' + range + ', trial ' + trial +
                    ': the invariant is the total weight, and it must match');
              }
            });
          }
        },
        {
          name: 'the chosen edges form a spanning tree, not a multiset with a cycle',
          assert: function (boruvka, api) {
            for (let trial = 0; trial < 10; trial += 1) {
              const n = 26;
              const edges = [];

              for (let v = 1; v < n; v += 1) {
                edges.push({ from: api.rng.int(v), to: v, weight: 1 + api.rng.int(4) });
              }

              for (let i = 0; i < 40; i += 1) {
                const a = api.rng.int(n);
                const b = api.rng.int(n);

                if (a === b) continue;
                edges.push({ from: a, to: b, weight: 1 + api.rng.int(4) });
              }
              const got = boruvka(n, edges);

              api.assert.equal(got.chosen.length, n - 1,
                'a connected graph of ' + n + ' vertices spans with exactly ' + (n - 1) +
                  ' edges; ' + got.chosen.length + ' means an edge was counted from both sides');
              const parent = new Array(n);

              for (let v = 0; v < n; v += 1) parent[v] = v;

              function find(v) {
                let at = v;

                while (parent[at] !== at) { parent[at] = parent[parent[at]]; at = parent[at]; }
                return at;
              }
              let total = 0;

              got.chosen.forEach(function (id) {
                const edge = edges[id];
                const a = find(edge.from);
                const b = find(edge.to);

                api.assert.notEqual(a, b,
                  'edge ' + id + ' closes a cycle, so the result is not a tree');
                parent[a] = b;
                total += edge.weight;
              });
              api.assert.equal(total, got.weight,
                'the reported weight must be the sum of the reported edges');
            }
          }
        },
        {
          name: 'a graph where every weight is the same still produces a tree',
          assert: function (boruvka, api) {
            const n = 40;
            const edges = [];

            for (let v = 1; v < n; v += 1) edges.push({ from: v - 1, to: v, weight: 7 });

            for (let i = 0; i < 60; i += 1) {
              const a = api.rng.int(n);
              const b = api.rng.int(n);

              if (a === b) continue;
              edges.push({ from: a, to: b, weight: 7 });
            }
            const got = boruvka(n, edges);

            api.assert.equal(got.chosen.length, n - 1, 'still exactly n − 1 edges');
            api.assert.equal(got.weight, 7 * (n - 1),
              'every spanning tree of an all-equal graph weighs the same, and this is it');
          }
        }
      ]
    }],

    'tree-path-queries': [{
      id: 'binary-lifting',
      title: 'binary lifting: LCA and k-th ancestor in O(log n)',
      prompt: 'answerQueries(n, edges, queries) must root an undirected tree at vertex 0 and answer a ' +
        'list of queries, returning { answers, steps }. A query is either { type: "lca", a, b } — the ' +
        'lowest common ancestor of a and b — or { type: "ancestor", v, k } — the k-th ancestor of v, or ' +
        '-1 if it does not exist. `steps` counts every table jump or parent hop the QUERIES perform ' +
        '(not the preprocessing). The starter climbs one parent at a time, which is correct and costs ' +
        'the depth of the tree per query — fine on a shallow tree and hopeless on a chain of 20 000. ' +
        'Build up[k][v], the 2^k-th ancestor, by squaring: up[k][v] = up[k-1][up[k-1][v]]. Level the ' +
        'two nodes using the binary representation of their depth difference, then jump both by the ' +
        'largest power that keeps them APART — what is left is one step below the answer.',
      entry: 'answerQueries',
      starter: [
        'function answerQueries(n, edges, queries) {',
        '  const adjacency = [];',
        '  for (let v = 0; v < n; v += 1) adjacency.push([]);',
        '  edges.forEach(function (edge) {',
        '    adjacency[edge.from].push(edge.to);',
        '    adjacency[edge.to].push(edge.from);',
        '  });',
        '',
        '  const parent = new Array(n).fill(-1);',
        '  const depth = new Array(n).fill(0);',
        '  const seen = new Array(n).fill(false);',
        '  const stack = [0];',
        '  seen[0] = true;',
        '  while (stack.length) {',
        '    const v = stack.pop();',
        '    adjacency[v].forEach(function (to) {',
        '      if (seen[to]) return;',
        '      seen[to] = true;',
        '      parent[to] = v;',
        '      depth[to] = depth[v] + 1;',
        '      stack.push(to);',
        '    });',
        '  }',
        '',
        '  let steps = 0;',
        '  const answers = queries.map(function (query) {',
        '    if (query.type === "ancestor") {',
        '      let at = query.v;',
        '      for (let i = 0; i < query.k; i += 1) {',
        '        if (at === -1) return -1;',
        '        at = parent[at];',
        '        steps += 1;',
        '      }',
        '      return at;',
        '    }',
        '    let x = query.a;',
        '    let y = query.b;',
        '    while (depth[x] > depth[y]) { x = parent[x]; steps += 1; }',
        '    while (depth[y] > depth[x]) { y = parent[y]; steps += 1; }',
        '    while (x !== y) { x = parent[x]; y = parent[y]; steps += 2; }',
        '    return x;',
        '  });',
        '  return { answers: answers, steps: steps };',
        '}'
      ].join('\n'),
      solution: [
        'function answerQueries(n, edges, queries) {',
        '  const adjacency = [];',
        '  for (let v = 0; v < n; v += 1) adjacency.push([]);',
        '  edges.forEach(function (edge) {',
        '    adjacency[edge.from].push(edge.to);',
        '    adjacency[edge.to].push(edge.from);',
        '  });',
        '',
        '  const parent = new Array(n).fill(-1);',
        '  const depth = new Array(n).fill(0);',
        '  const seen = new Array(n).fill(false);',
        '  const stack = [0];',
        '  seen[0] = true;',
        '  while (stack.length) {',
        '    const v = stack.pop();',
        '    adjacency[v].forEach(function (to) {',
        '      if (seen[to]) return;',
        '      seen[to] = true;',
        '      parent[to] = v;',
        '      depth[to] = depth[v] + 1;',
        '      stack.push(to);',
        '    });',
        '  }',
        '',
        '  const levels = Math.max(1, Math.ceil(Math.log2(Math.max(2, n))) + 1);',
        '  const up = [parent.slice()];',
        '  for (let k = 1; k < levels; k += 1) {',
        '    const previous = up[k - 1];',
        '    const row = new Array(n).fill(-1);',
        '    for (let v = 0; v < n; v += 1) {',
        '      if (previous[v] === -1) continue;',
        '      row[v] = previous[previous[v]];',
        '    }',
        '    up.push(row);',
        '  }',
        '',
        '  let steps = 0;',
        '',
        '  function ancestor(node, k) {',
        '    let at = node;',
        '    let remaining = k;',
        '    for (let bit = 0; remaining > 0 && at !== -1; bit += 1) {',
        '      if ((remaining & 1) === 1) {',
        '        if (bit >= levels) return -1;',
        '        at = up[bit][at];',
        '        steps += 1;',
        '      }',
        '      remaining >>= 1;',
        '    }',
        '    return at === undefined ? -1 : at;',
        '  }',
        '',
        '  const answers = queries.map(function (query) {',
        '    if (query.type === "ancestor") return ancestor(query.v, query.k);',
        '    let x = query.a;',
        '    let y = query.b;',
        '    if (depth[x] < depth[y]) { const t = x; x = y; y = t; }',
        '    x = ancestor(x, depth[x] - depth[y]);',
        '    if (x === y) return x;',
        '    for (let k = levels - 1; k >= 0; k -= 1) {',
        '      steps += 1;',
        '      if (up[k][x] === -1 || up[k][x] === up[k][y]) continue;',
        '      x = up[k][x];',
        '      y = up[k][y];',
        '    }',
        '    return up[0][x];',
        '  });',
        '  return { answers: answers, steps: steps };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the answers match a naive climb on random trees',
          assert: function (answerQueries, api) {
            for (let trial = 0; trial < 8; trial += 1) {
              const n = 120;
              const edges = [];

              for (let v = 1; v < n; v += 1) edges.push({ from: api.rng.int(v), to: v });

              const parent = new Array(n).fill(-1);
              const depth = new Array(n).fill(0);

              for (let v = 1; v < n; v += 1) {
                const edge = edges[v - 1];

                parent[edge.to] = edge.from;
                depth[edge.to] = depth[edge.from] + 1;
              }

              const queries = [];

              for (let q = 0; q < 60; q += 1) {
                queries.push({ type: 'lca', a: api.rng.int(n), b: api.rng.int(n) });
              }
              const got = answerQueries(n, edges, queries);

              queries.forEach(function (query, i) {
                let x = query.a;
                let y = query.b;

                while (depth[x] > depth[y]) x = parent[x];

                while (depth[y] > depth[x]) y = parent[y];

                while (x !== y) { x = parent[x]; y = parent[y]; }
                api.assert.equal(got.answers[i], x,
                  'trial ' + trial + ', query ' + i + ': lca(' + query.a + ', ' + query.b + ')');
              });
            }
          }
        },
        {
          name: 'k-th ancestor matches a k-step climb, including past the root',
          assert: function (answerQueries, api) {
            for (let trial = 0; trial < 8; trial += 1) {
              const n = 100;
              const edges = [];

              for (let v = 1; v < n; v += 1) edges.push({ from: api.rng.int(v), to: v });
              const parent = new Array(n).fill(-1);

              for (let v = 1; v < n; v += 1) parent[edges[v - 1].to] = edges[v - 1].from;

              const queries = [];

              for (let q = 0; q < 60; q += 1) {
                queries.push({ type: 'ancestor', v: api.rng.int(n), k: api.rng.int(30) });
              }
              const got = answerQueries(n, edges, queries);

              queries.forEach(function (query, i) {
                let at = query.v;

                for (let step = 0; step < query.k; step += 1) {
                  if (at === -1) break;
                  at = parent[at];
                }
                api.assert.equal(got.answers[i], at,
                  'trial ' + trial + ', query ' + i + ': ancestor ' + query.k + ' of ' + query.v);
              });
            }
          }
        },
        {
          name: 'a chain of 20 000 costs a logarithmic number of steps per query',
          assert: function (answerQueries, api) {
            const n = 20000;
            const edges = [];

            for (let v = 1; v < n; v += 1) edges.push({ from: v - 1, to: v });
            const queries = [];

            for (let q = 0; q < 200; q += 1) {
              queries.push({ type: 'lca', a: api.rng.int(n), b: api.rng.int(n) });
            }
            const got = answerQueries(n, edges, queries);

            queries.forEach(function (query, i) {
              api.assert.equal(got.answers[i], Math.min(query.a, query.b),
                'on a chain rooted at 0 the ancestor is the shallower of the two');
            });
            api.assert.atMost(got.steps, 60 * queries.length,
              'a naive climb costs up to ' + n + ' steps per query on this shape; binary lifting ' +
                'should cost a few dozen. It cost ' + got.steps + ' for ' + queries.length + ' queries');
          }
        },
        {
          name: 'the root and same-node cases are handled',
          assert: function (answerQueries, api) {
            const edges = [
              { from: 0, to: 1 }, { from: 0, to: 2 }, { from: 1, to: 3 }, { from: 1, to: 4 },
              { from: 2, to: 5 }
            ];
            const got = answerQueries(6, edges, [
              { type: 'lca', a: 3, b: 4 },
              { type: 'lca', a: 3, b: 5 },
              { type: 'lca', a: 3, b: 3 },
              { type: 'lca', a: 0, b: 5 },
              { type: 'ancestor', v: 3, k: 0 },
              { type: 'ancestor', v: 3, k: 2 },
              { type: 'ancestor', v: 3, k: 9 }
            ]);

            api.assert.deepEqual(got.answers, [1, 0, 3, 0, 3, 0, -1],
              'siblings, cousins, a node with itself, the root as an ancestor, k = 0, ' +
                'and a k that walks off the top');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));

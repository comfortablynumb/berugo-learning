/**
 * Graded exercises for heuristic search and route planning (M13.7-M13.8).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'heuristic-search': [{
      id: 'astar-with-reopening',
      title: 'A* with a pluggable heuristic, and the reopen check that is not optional',
      prompt: 'astar(n, edges, query, heuristic) must return { cost, path, expanded } for a DIRECTED ' +
        'weighted graph. `query` is { source, target } and `heuristic` is an array with one lower-bound ' +
        'estimate per vertex. Order the queue by f = g + h, and when a node is popped whose recorded ' +
        'distance has since fallen, expand it AGAIN — that is the reopen check. The starter skips it: ' +
        'it closes each node once and never revisits, which is correct only when the heuristic is ' +
        'consistent (h(u) <= w(u,v) + h(v) on every edge). With a heuristic that is admissible and ' +
        'inconsistent it returns a longer path and reports nothing unusual. Count every expansion, ' +
        'including reopenings, in `expanded`.',
      entry: 'astar',
      starter: [
        'function astar(n, edges, query, heuristic) {',
        '  const adjacency = [];',
        '  for (let v = 0; v < n; v += 1) adjacency.push([]);',
        '  edges.forEach(function (edge) {',
        '    adjacency[edge.from].push({ to: edge.to, weight: edge.weight });',
        '  });',
        '',
        '  const g = new Array(n).fill(Infinity);',
        '  const parent = new Array(n).fill(-1);',
        '  const closed = new Array(n).fill(false);',
        '  const heap = [{ key: heuristic[query.source], node: query.source }];',
        '  g[query.source] = 0;',
        '  let expanded = 0;',
        '',
        '  while (heap.length) {',
        '    heap.sort(function (a, b) { return a.key - b.key; });',
        '    const top = heap.shift();',
        '    // a closed node is never looked at again, whatever h does',
        '    if (closed[top.node]) continue;',
        '    closed[top.node] = true;',
        '    expanded += 1;',
        '    if (top.node === query.target) break;',
        '',
        '    adjacency[top.node].forEach(function (link) {',
        '      const candidate = g[top.node] + link.weight;',
        '      if (candidate >= g[link.to]) return;',
        '      g[link.to] = candidate;',
        '      parent[link.to] = top.node;',
        '      heap.push({ key: candidate + heuristic[link.to], node: link.to });',
        '    });',
        '  }',
        '',
        '  if (g[query.target] === Infinity) {',
        '    return { cost: Infinity, path: null, expanded: expanded };',
        '  }',
        '  const path = [];',
        '  let at = query.target;',
        '  while (at !== -1) { path.push(at); at = parent[at]; }',
        '  path.reverse();',
        '  return { cost: g[query.target], path: path, expanded: expanded };',
        '}'
      ].join('\n'),
      solution: [
        'function astar(n, edges, query, heuristic) {',
        '  const adjacency = [];',
        '  for (let v = 0; v < n; v += 1) adjacency.push([]);',
        '  edges.forEach(function (edge) {',
        '    adjacency[edge.from].push({ to: edge.to, weight: edge.weight });',
        '  });',
        '',
        '  const g = new Array(n).fill(Infinity);',
        '  const parent = new Array(n).fill(-1);',
        '  const closed = new Array(n).fill(false);',
        '  const heap = [{ key: heuristic[query.source], node: query.source }];',
        '  g[query.source] = 0;',
        '  let expanded = 0;',
        '',
        '  while (heap.length) {',
        '    heap.sort(function (a, b) { return a.key - b.key; });',
        '    const top = heap.shift();',
        '    const current = g[top.node] + heuristic[top.node];',
        '',
        '    // a stale duplicate left by a later, cheaper push is bookkeeping;',
        '    // an entry whose key matches the current f is a genuine reopening',
        '    if (closed[top.node] && top.key > current + 1e-9) continue;',
        '    closed[top.node] = true;',
        '    expanded += 1;',
        '    if (top.node === query.target) break;',
        '',
        '    adjacency[top.node].forEach(function (link) {',
        '      const candidate = g[top.node] + link.weight;',
        '      if (candidate >= g[link.to]) return;',
        '      g[link.to] = candidate;',
        '      parent[link.to] = top.node;',
        '      heap.push({ key: candidate + heuristic[link.to], node: link.to });',
        '    });',
        '  }',
        '',
        '  if (g[query.target] === Infinity) {',
        '    return { cost: Infinity, path: null, expanded: expanded };',
        '  }',
        '  const path = [];',
        '  let at = query.target;',
        '  while (at !== -1) { path.push(at); at = parent[at]; }',
        '  path.reverse();',
        '  return { cost: g[query.target], path: path, expanded: expanded };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'an admissible but inconsistent heuristic still returns the optimal path',
          assert: function (astar, api) {
            /* s=0, a=1, c=2, g=3.  s->a costs 4, s->c costs 1, c->a costs 1,
               a->g costs 10.  The optimum is 0->2->1->3 at 12.
               h = [0, 0, 11, 0] never overestimates (d(2,3) is exactly 11) and
               is inconsistent at 2->1: 11 > 1 + 0.  A* pops a at f = 4, closes
               it at g = 4, and only later finds g = 2 through c. */
            const edges = [
              { from: 0, to: 1, weight: 4 },
              { from: 0, to: 2, weight: 1 },
              { from: 2, to: 1, weight: 1 },
              { from: 1, to: 3, weight: 10 }
            ];
            const run = astar(4, edges, { source: 0, target: 3 }, [0, 0, 11, 0]);

            api.assert.equal(run.cost, 12,
              'the optimum is 0 -> 2 -> 1 -> 3 at 12; closing vertex 1 at g = 4 and never ' +
                'reopening it returns 14 instead, with nothing raised');
            api.assert.deepEqual(run.path, [0, 2, 1, 3], 'and the path must be the cheap one');
          }
        },
        {
          name: 'with h = 0 the cost matches Dijkstra on random graphs',
          assert: function (astar, api) {
            function dijkstra(n, edges, source) {
              const adjacency = [];

              for (let v = 0; v < n; v += 1) adjacency.push([]);
              edges.forEach(function (edge) {
                adjacency[edge.from].push({ to: edge.to, weight: edge.weight });
              });
              const distance = new Array(n).fill(Infinity);
              const done = new Array(n).fill(false);

              distance[source] = 0;

              for (;;) {
                let best = -1;

                for (let v = 0; v < n; v += 1) {
                  if (done[v] || distance[v] === Infinity) continue;

                  if (best === -1 || distance[v] < distance[best]) best = v;
                }

                if (best === -1) break;
                done[best] = true;
                adjacency[best].forEach(function (link) {
                  const candidate = distance[best] + link.weight;

                  if (candidate >= distance[link.to]) return;
                  distance[link.to] = candidate;
                });
              }
              return distance;
            }

            for (let trial = 0; trial < 10; trial += 1) {
              const n = 26;
              const edges = [];
              const seen = {};

              for (let i = 0; i < 70; i += 1) {
                const from = api.rng.int(n);
                const to = api.rng.int(n);
                const key = from + '>' + to;

                if (from === to || seen[key]) continue;
                seen[key] = true;
                edges.push({ from: from, to: to, weight: 1 + api.rng.int(20) });
              }
              const zero = new Array(n).fill(0);
              const truth = dijkstra(n, edges, 0);

              for (let target = 1; target < n; target += 1) {
                const run = astar(n, edges, { source: 0, target: target }, zero);

                api.assert.equal(run.cost, truth[target],
                  'trial ' + trial + ', target ' + target + ' with a zero heuristic');
              }
            }
          }
        },
        {
          name: 'a stronger heuristic expands fewer nodes for the same answer',
          assert: function (astar, api) {
            /* A unit-cost grid, where the Manhattan distance is exact. */
            const side = 14;
            const n = side * side;
            const edges = [];

            for (let r = 0; r < side; r += 1) {
              for (let c = 0; c < side; c += 1) {
                const v = r * side + c;

                if (c + 1 < side) {
                  edges.push({ from: v, to: v + 1, weight: 1 });
                  edges.push({ from: v + 1, to: v, weight: 1 });
                }

                if (r + 1 < side) {
                  edges.push({ from: v, to: v + side, weight: 1 });
                  edges.push({ from: v + side, to: v, weight: 1 });
                }
              }
            }
            /* Both ends on the same row. Corner to corner would be the wrong
               query: on a uniform grid EVERY monotone staircase ties, so every
               cell lies on a shortest path and an exact heuristic still expands
               all of them. */
            const middle = Math.floor(side / 2);
            const source = middle * side;
            const target = middle * side + side - 1;
            const manhattan = [];

            for (let v = 0; v < n; v += 1) {
              manhattan.push(Math.abs(side - 1 - (v % side)) + Math.abs(middle - Math.floor(v / side)));
            }
            const blind = astar(n, edges, { source: source, target: target }, new Array(n).fill(0));
            const guided = astar(n, edges, { source: source, target: target }, manhattan);

            api.assert.equal(guided.cost, blind.cost, 'an exact heuristic cannot change the cost');
            api.assert.ok(guided.expanded < blind.expanded / 3,
              'the Manhattan heuristic is exact here and the only shortest paths run along one row, ' +
                'so it should expand far fewer than the ' + blind.expanded +
                ' a blind search needs; it expanded ' + guided.expanded);
          }
        },
        {
          name: 'the returned path costs the returned cost',
          assert: function (astar, api) {
            for (let trial = 0; trial < 8; trial += 1) {
              const n = 24;
              const edges = [];
              const seen = {};

              for (let i = 0; i < 60; i += 1) {
                const from = api.rng.int(n);
                const to = api.rng.int(n);
                const key = from + '>' + to;

                if (from === to || seen[key]) continue;
                seen[key] = true;
                edges.push({ from: from, to: to, weight: 1 + api.rng.int(15) });
              }
              const run = astar(n, edges, { source: 0, target: n - 1 }, new Array(n).fill(0));

              if (run.path === null) continue;
              let total = 0;

              for (let i = 0; i + 1 < run.path.length; i += 1) {
                let best = Infinity;

                edges.forEach(function (edge) {
                  if (edge.from !== run.path[i] || edge.to !== run.path[i + 1]) return;
                  best = Math.min(best, edge.weight);
                });
                api.assert.ok(best < Infinity,
                  run.path[i] + ' -> ' + run.path[i + 1] + ' is not an edge');
                total += best;
              }
              api.assert.equal(total, run.cost,
                'trial ' + trial + ': the path re-walks to ' + total + ' against a reported ' + run.cost);
            }
          }
        }
      ]
    }],

    'route-planning': [{
      id: 'contraction-witness-search',
      title: 'node contraction, and the witness search that decides every shortcut',
      prompt: 'contractGraph(n, edges) must contract the vertices of an UNDIRECTED weighted graph in ' +
        'index order — 0 first, then 1, and so on — and return the shortcuts it had to add, as an ' +
        'array of { from, to, weight }. Contracting v means: for every pair of its neighbours u and w ' +
        'that are NOT yet contracted, ask whether the remaining graph still gets from u to w for at ' +
        'most cost(u,v) + cost(v,w). If it does, that path is the witness and no shortcut is needed. ' +
        'If it does not, the shortcut must be added or the distance is lost forever. The starter\'s ' +
        'witness search walks through vertices that have already been contracted — vertices that no ' +
        'longer exist — so it finds witnesses that are not there, skips necessary shortcuts, and ' +
        'produces a hierarchy that is the right size, builds in the right time, and answers a few ' +
        'pairs in a thousand incorrectly.',
      entry: 'contractGraph',
      starter: [
        'function contractGraph(n, edges) {',
        '  const out = [];',
        '  for (let v = 0; v < n; v += 1) out.push(new Map());',
        '',
        '  function relax(map, key, weight) {',
        '    const current = map.get(key);',
        '    if (current !== undefined && current <= weight) return;',
        '    map.set(key, weight);',
        '  }',
        '',
        '  edges.forEach(function (edge) {',
        '    relax(out[edge.from], edge.to, edge.weight);',
        '    relax(out[edge.to], edge.from, edge.weight);',
        '  });',
        '',
        '  const contracted = new Array(n).fill(false);',
        '  const shortcuts = [];',
        '',
        '  function hasWitness(source, target, banned, limit) {',
        '    const best = new Map();',
        '    const heap = [{ key: 0, node: source }];',
        '    best.set(source, 0);',
        '    while (heap.length) {',
        '      heap.sort(function (a, b) { return a.key - b.key; });',
        '      const top = heap.shift();',
        '      if (top.key > limit) return false;',
        '      if (top.node === target) return true;',
        '      if (best.get(top.node) < top.key) continue;',
        '      out[top.node].forEach(function (weight, to) {',
        '        // contracted vertices are GONE, and this forgets that',
        '        if (to === banned) return;',
        '        const candidate = top.key + weight;',
        '        if (candidate > limit) return;',
        '        const current = best.get(to);',
        '        if (current !== undefined && current <= candidate) return;',
        '        best.set(to, candidate);',
        '        heap.push({ key: candidate, node: to });',
        '      });',
        '    }',
        '    return false;',
        '  }',
        '',
        '  for (let v = 0; v < n; v += 1) {',
        '    const live = [];',
        '    out[v].forEach(function (weight, to) { if (!contracted[to]) live.push(to); });',
        '    for (let i = 0; i < live.length; i += 1) {',
        '      for (let j = i + 1; j < live.length; j += 1) {',
        '        const u = live[i];',
        '        const w = live[j];',
        '        const through = out[v].get(u) + out[v].get(w);',
        '        if (hasWitness(u, w, v, through)) continue;',
        '        relax(out[u], w, through);',
        '        relax(out[w], u, through);',
        '        shortcuts.push({ from: u, to: w, weight: through });',
        '      }',
        '    }',
        '    contracted[v] = true;',
        '  }',
        '  return shortcuts;',
        '}'
      ].join('\n'),
      solution: [
        'function contractGraph(n, edges) {',
        '  const out = [];',
        '  for (let v = 0; v < n; v += 1) out.push(new Map());',
        '',
        '  function relax(map, key, weight) {',
        '    const current = map.get(key);',
        '    if (current !== undefined && current <= weight) return;',
        '    map.set(key, weight);',
        '  }',
        '',
        '  edges.forEach(function (edge) {',
        '    relax(out[edge.from], edge.to, edge.weight);',
        '    relax(out[edge.to], edge.from, edge.weight);',
        '  });',
        '',
        '  const contracted = new Array(n).fill(false);',
        '  const shortcuts = [];',
        '',
        '  function hasWitness(source, target, banned, limit) {',
        '    const best = new Map();',
        '    const heap = [{ key: 0, node: source }];',
        '    best.set(source, 0);',
        '    while (heap.length) {',
        '      heap.sort(function (a, b) { return a.key - b.key; });',
        '      const top = heap.shift();',
        '      if (top.key > limit) return false;',
        '      if (top.node === target) return true;',
        '      if (best.get(top.node) < top.key) continue;',
        '      out[top.node].forEach(function (weight, to) {',
        '        // the witness must be a path in the REMAINING graph',
        '        if (to === banned || contracted[to]) return;',
        '        const candidate = top.key + weight;',
        '        if (candidate > limit) return;',
        '        const current = best.get(to);',
        '        if (current !== undefined && current <= candidate) return;',
        '        best.set(to, candidate);',
        '        heap.push({ key: candidate, node: to });',
        '      });',
        '    }',
        '    return false;',
        '  }',
        '',
        '  for (let v = 0; v < n; v += 1) {',
        '    const live = [];',
        '    out[v].forEach(function (weight, to) { if (!contracted[to]) live.push(to); });',
        '    for (let i = 0; i < live.length; i += 1) {',
        '      for (let j = i + 1; j < live.length; j += 1) {',
        '        const u = live[i];',
        '        const w = live[j];',
        '        const through = out[v].get(u) + out[v].get(w);',
        '        if (hasWitness(u, w, v, through)) continue;',
        '        relax(out[u], w, through);',
        '        relax(out[w], u, through);',
        '        shortcuts.push({ from: u, to: w, weight: through });',
        '      }',
        '    }',
        '    contracted[v] = true;',
        '  }',
        '  return shortcuts;',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'upward queries match Dijkstra on every pair of a weighted grid',
          assert: function (contractGraph, api) {
            function allDistances(n, edges) {
              const adjacency = [];

              for (let v = 0; v < n; v += 1) adjacency.push([]);
              edges.forEach(function (edge) {
                adjacency[edge.from].push({ to: edge.to, weight: edge.weight });
                adjacency[edge.to].push({ to: edge.from, weight: edge.weight });
              });
              const out = [];

              for (let source = 0; source < n; source += 1) {
                const distance = new Array(n).fill(Infinity);
                const done = new Array(n).fill(false);

                distance[source] = 0;

                for (;;) {
                  let best = -1;

                  for (let v = 0; v < n; v += 1) {
                    if (done[v] || distance[v] === Infinity) continue;

                    if (best === -1 || distance[v] < distance[best]) best = v;
                  }

                  if (best === -1) break;
                  done[best] = true;
                  adjacency[best].forEach(function (link) {
                    if (distance[best] + link.weight >= distance[link.to]) return;
                    distance[link.to] = distance[best] + link.weight;
                  });
                }
                out.push(distance);
              }
              return out;
            }

            function upward(n, all) {
              const up = [];

              for (let v = 0; v < n; v += 1) up.push([]);
              all.forEach(function (edge) {
                const low = Math.min(edge.from, edge.to);
                const high = Math.max(edge.from, edge.to);

                up[low].push({ to: high, weight: edge.weight });
              });
              return up;
            }

            function upwardSearch(up, source) {
              const best = new Map();
              const heap = [{ key: 0, node: source }];

              best.set(source, 0);

              while (heap.length) {
                heap.sort(function (a, b) { return a.key - b.key; });
                const top = heap.shift();

                if (best.get(top.node) < top.key) continue;
                up[top.node].forEach(function (link) {
                  const candidate = top.key + link.weight;
                  const current = best.get(link.to);

                  if (current !== undefined && current <= candidate) return;
                  best.set(link.to, candidate);
                  heap.push({ key: candidate, node: link.to });
                });
              }
              return best;
            }

            const side = 5;
            const n = side * side;
            const edges = [];

            for (let r = 0; r < side; r += 1) {
              for (let c = 0; c < side; c += 1) {
                const v = r * side + c;

                if (c + 1 < side) edges.push({ from: v, to: v + 1, weight: 1 + api.rng.int(9) });

                if (r + 1 < side) edges.push({ from: v, to: v + side, weight: 1 + api.rng.int(9) });
              }
            }
            const shortcuts = contractGraph(n, edges);
            const up = upward(n, edges.concat(shortcuts));
            const truth = allDistances(n, edges);
            let wrong = 0;

            for (let s = 0; s < n; s += 1) {
              const forward = upwardSearch(up, s);

              for (let t = 0; t < n; t += 1) {
                if (s === t) continue;
                const backward = upwardSearch(up, t);
                let got = Infinity;

                forward.forEach(function (value, node) {
                  const other = backward.get(node);

                  if (other === undefined) return;
                  got = Math.min(got, value + other);
                });

                if (got === truth[s][t] || Math.abs(got - truth[s][t]) < 1e-9) continue;
                wrong += 1;
              }
            }
            api.assert.equal(wrong, 0,
              wrong + ' of ' + (n * (n - 1)) + ' pairs disagree with Dijkstra — a witness search ' +
                'that walks through already-contracted vertices skips necessary shortcuts');
          }
        },
        {
          name: 'a path and a clique need no shortcuts at all',
          assert: function (contractGraph, api) {
            const pathEdges = [];

            for (let v = 1; v < 12; v += 1) pathEdges.push({ from: v - 1, to: v, weight: 1 + v });
            api.assert.equal(contractGraph(12, pathEdges).length, 0,
              'contracting an end of a path leaves one neighbour, so there is no pair to shortcut');

            const cliqueEdges = [];

            for (let a = 0; a < 6; a += 1) {
              for (let b = a + 1; b < 6; b += 1) cliqueEdges.push({ from: a, to: b, weight: 1 });
            }
            api.assert.equal(contractGraph(6, cliqueEdges).length, 0,
              'every pair is already joined directly at cost 1, so every witness exists');
          }
        },
        {
          name: 'upward queries match Dijkstra on a random weighted graph',
          assert: function (contractGraph, api) {
            function allDistances(n, edges) {
              const adjacency = [];

              for (let v = 0; v < n; v += 1) adjacency.push([]);
              edges.forEach(function (edge) {
                adjacency[edge.from].push({ to: edge.to, weight: edge.weight });
                adjacency[edge.to].push({ to: edge.from, weight: edge.weight });
              });
              const out = [];

              for (let source = 0; source < n; source += 1) {
                const distance = new Array(n).fill(Infinity);
                const done = new Array(n).fill(false);

                distance[source] = 0;

                for (;;) {
                  let best = -1;

                  for (let v = 0; v < n; v += 1) {
                    if (done[v] || distance[v] === Infinity) continue;

                    if (best === -1 || distance[v] < distance[best]) best = v;
                  }

                  if (best === -1) break;
                  done[best] = true;
                  adjacency[best].forEach(function (link) {
                    if (distance[best] + link.weight >= distance[link.to]) return;
                    distance[link.to] = distance[best] + link.weight;
                  });
                }
                out.push(distance);
              }
              return out;
            }

            for (let trial = 0; trial < 3; trial += 1) {
              const n = 18;
              const edges = [];
              const seen = {};

              for (let i = 0; i < 45; i += 1) {
                const a = api.rng.int(n);
                const b = api.rng.int(n);

                if (a === b) continue;
                const key = Math.min(a, b) + '-' + Math.max(a, b);

                if (seen[key]) continue;
                seen[key] = true;
                edges.push({ from: a, to: b, weight: 1 + api.rng.int(12) });
              }
              const shortcuts = contractGraph(n, edges);
              const up = [];

              for (let v = 0; v < n; v += 1) up.push([]);
              edges.concat(shortcuts).forEach(function (edge) {
                const low = Math.min(edge.from, edge.to);
                const high = Math.max(edge.from, edge.to);

                up[low].push({ to: high, weight: edge.weight });
              });

              function search(source) {
                const best = new Map();
                const heap = [{ key: 0, node: source }];

                best.set(source, 0);

                while (heap.length) {
                  heap.sort(function (x, y) { return x.key - y.key; });
                  const top = heap.shift();

                  if (best.get(top.node) < top.key) continue;
                  up[top.node].forEach(function (link) {
                    const candidate = top.key + link.weight;
                    const current = best.get(link.to);

                    if (current !== undefined && current <= candidate) return;
                    best.set(link.to, candidate);
                    heap.push({ key: candidate, node: link.to });
                  });
                }
                return best;
              }

              const truth = allDistances(n, edges);

              for (let s = 0; s < n; s += 1) {
                const forward = search(s);

                for (let t = 0; t < n; t += 1) {
                  if (s === t) continue;
                  const backward = search(t);
                  let got = Infinity;

                  forward.forEach(function (value, node) {
                    const other = backward.get(node);

                    if (other === undefined) return;
                    got = Math.min(got, value + other);
                  });
                  const agree = got === truth[s][t] || Math.abs(got - truth[s][t]) < 1e-9;

                  api.assert.ok(agree,
                    'trial ' + trial + ', pair ' + s + ' -> ' + t + ': the hierarchy says ' + got +
                      ' and Dijkstra says ' + truth[s][t]);
                }
              }
            }
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));

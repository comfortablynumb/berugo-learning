/**
 * Graded exercises for minimum-cost flow and bipartite matching (M14.4-M14.5).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'min-cost-flow': [{
      id: 'successive-shortest-paths',
      title: 'One unit at a time, along the path that is actually cheapest',
      prompt: 'minCostFlow(n, edges, source, sink) must return { value, cost } for a DIRECTED ' +
        'network whose arcs carry `capacity` and `cost`: the maximum flow value, and the least ' +
        'total cost among all flows of that value. Send one augmenting path at a time along the ' +
        'CHEAPEST residual route, using Bellman-Ford so that the negative-cost backward arcs are ' +
        'handled. The trap is the backward arc\'s cost: pushing f along an arc of cost c creates a ' +
        'residual arc of cost −c, because undoing that push refunds what it charged. The starter ' +
        'gives the backward arc cost 0, which makes undoing free, so the search never reroutes and ' +
        'the reported cost is too high.',
      entry: 'minCostFlow',
      starter: [
        'function minCostFlow(n, edges, source, sink) {',
        '  const to = [];',
        '  const cap = [];',
        '  const cost = [];',
        '  const out = [];',
        '  for (let v = 0; v < n; v += 1) out.push([]);',
        '  edges.forEach(function (edge) {',
        '    out[edge.from].push(to.length); to.push(edge.to);',
        '    cap.push(edge.capacity); cost.push(edge.cost);',
        '    out[edge.to].push(to.length); to.push(edge.from);',
        '    cap.push(0); cost.push(0);   // undoing a push is free',
        '  });',
        '',
        '  let value = 0;',
        '  let total = 0;',
        '  for (;;) {',
        '    const dist = new Array(n).fill(Infinity);',
        '    const came = new Array(n).fill(-1);',
        '    const prev = new Array(n).fill(-1);',
        '    dist[source] = 0;',
        '    for (let round = 0; round < n; round += 1) {',
        '      let changed = false;',
        '      for (let v = 0; v < n; v += 1) {',
        '        if (dist[v] === Infinity) continue;',
        '        for (let i = 0; i < out[v].length; i += 1) {',
        '          const arc = out[v][i];',
        '          if (cap[arc] <= 0 || dist[v] + cost[arc] >= dist[to[arc]]) continue;',
        '          dist[to[arc]] = dist[v] + cost[arc];',
        '          came[to[arc]] = arc; prev[to[arc]] = v; changed = true;',
        '        }',
        '      }',
        '      if (!changed) break;',
        '    }',
        '    if (dist[sink] === Infinity) break;',
        '    let push = Infinity;',
        '    for (let at = sink; at !== source; at = prev[at]) push = Math.min(push, cap[came[at]]);',
        '    for (let at = sink; at !== source; at = prev[at]) {',
        '      cap[came[at]] -= push; cap[came[at] ^ 1] += push;',
        '      total += push * cost[came[at]];',
        '    }',
        '    value += push;',
        '  }',
        '  return { value: value, cost: total };',
        '}'
      ].join('\n'),
      solution: [
        'function minCostFlow(n, edges, source, sink) {',
        '  const to = [];',
        '  const cap = [];',
        '  const cost = [];',
        '  const out = [];',
        '  for (let v = 0; v < n; v += 1) out.push([]);',
        '  edges.forEach(function (edge) {',
        '    out[edge.from].push(to.length); to.push(edge.to);',
        '    cap.push(edge.capacity); cost.push(edge.cost);',
        '    out[edge.to].push(to.length); to.push(edge.from);',
        '    cap.push(0); cost.push(-edge.cost);   // undoing refunds what the push charged',
        '  });',
        '',
        '  let value = 0;',
        '  let total = 0;',
        '  for (;;) {',
        '    const dist = new Array(n).fill(Infinity);',
        '    const came = new Array(n).fill(-1);',
        '    const prev = new Array(n).fill(-1);',
        '    dist[source] = 0;',
        '    for (let round = 0; round < n; round += 1) {',
        '      let changed = false;',
        '      for (let v = 0; v < n; v += 1) {',
        '        if (dist[v] === Infinity) continue;',
        '        for (let i = 0; i < out[v].length; i += 1) {',
        '          const arc = out[v][i];',
        '          if (cap[arc] <= 0 || dist[v] + cost[arc] >= dist[to[arc]]) continue;',
        '          dist[to[arc]] = dist[v] + cost[arc];',
        '          came[to[arc]] = arc; prev[to[arc]] = v; changed = true;',
        '        }',
        '      }',
        '      if (!changed) break;',
        '    }',
        '    if (dist[sink] === Infinity) break;',
        '    let push = Infinity;',
        '    for (let at = sink; at !== source; at = prev[at]) push = Math.min(push, cap[came[at]]);',
        '    for (let at = sink; at !== source; at = prev[at]) {',
        '      cap[came[at]] -= push; cap[came[at] ^ 1] += push;',
        '      total += push * cost[came[at]];',
        '    }',
        '    value += push;',
        '  }',
        '  return { value: value, cost: total };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'a network where an early cheap hop must be undone costs 43, not 45',
          assert: function (minCostFlow, api) {
            const edges = [
              { from: 0, to: 1, capacity: 3, cost: 3 },
              { from: 1, to: 2, capacity: 1, cost: 2 },
              { from: 2, to: 3, capacity: 2, cost: 2 },
              { from: 1, to: 3, capacity: 3, cost: 6 },
              { from: 0, to: 2, capacity: 2, cost: 6 }
            ];
            const got = minCostFlow(4, edges, 0, 3);

            api.assert.equal(got.value, 5, 'five units can reach the sink');
            api.assert.equal(got.cost, 43,
              'the first path takes 0-1-2-3 because it is cheapest; a later unit is better off ' +
                'taking 0-2-3 and pushing that first unit onto 1-3 instead. Without a refund on ' +
                'the backward arc the search cannot see that trade and settles for 45');
          }
        },
        {
          name: 'the cost matches an exhaustive assignment search',
          assert: function (minCostFlow, api) {
            function bestAssignment(matrix) {
              const size = matrix.length;
              let best = Infinity;

              function walk(row, used, sum) {
                if (sum >= best) return;

                if (row === size) { best = sum; return; }

                for (let c = 0; c < size; c += 1) {
                  if (used.indexOf(c) !== -1) continue;
                  used.push(c);
                  walk(row + 1, used, sum + matrix[row][c]);
                  used.pop();
                }
              }
              walk(0, [], 0);
              return best;
            }

            for (let trial = 0; trial < 6; trial += 1) {
              const size = 5;
              const matrix = [];

              for (let r = 0; r < size; r += 1) {
                const row = [];

                for (let c = 0; c < size; c += 1) row.push(1 + api.rng.int(20));
                matrix.push(row);
              }
              const edges = [];
              const source = 2 * size;
              const sink = source + 1;

              for (let r = 0; r < size; r += 1) {
                edges.push({ from: source, to: r, capacity: 1, cost: 0 });
              }

              for (let r = 0; r < size; r += 1) {
                for (let c = 0; c < size; c += 1) {
                  edges.push({ from: r, to: size + c, capacity: 1, cost: matrix[r][c] });
                }
              }

              for (let c = 0; c < size; c += 1) {
                edges.push({ from: size + c, to: sink, capacity: 1, cost: 0 });
              }
              const got = minCostFlow(sink + 1, edges, source, sink);

              api.assert.equal(got.value, size, 'every worker must be assigned');
              api.assert.equal(got.cost, bestAssignment(matrix),
                'trial ' + trial + ': the flow optimum must equal the best permutation');
            }
          }
        },
        {
          name: 'the marginal cost never falls, which is why one unit at a time is correct',
          assert: function (minCostFlow, api) {
            for (let trial = 0; trial < 5; trial += 1) {
              const size = 4;
              const source = 2 * size;
              const sink = source + 1;
              const matrix = [];

              for (let r = 0; r < size; r += 1) {
                const row = [];

                for (let c = 0; c < size; c += 1) row.push(1 + api.rng.int(15));
                matrix.push(row);
              }
              const costs = [];

              for (let limit = 1; limit <= size; limit += 1) {
                const edges = [{ from: source, to: sink, capacity: 0, cost: 0 }];
                const gate = sink + 1;

                edges.push({ from: source, to: gate, capacity: limit, cost: 0 });

                for (let r = 0; r < size; r += 1) {
                  edges.push({ from: gate, to: r, capacity: 1, cost: 0 });
                }

                for (let r = 0; r < size; r += 1) {
                  for (let c = 0; c < size; c += 1) {
                    edges.push({ from: r, to: size + c, capacity: 1, cost: matrix[r][c] });
                  }
                }

                for (let c = 0; c < size; c += 1) {
                  edges.push({ from: size + c, to: sink, capacity: 1, cost: 0 });
                }
                const got = minCostFlow(gate + 1, edges, source, sink);

                api.assert.equal(got.value, limit, 'the gate arc caps the value at ' + limit);
                costs.push(got.cost);
              }

              for (let i = 2; i < costs.length; i += 1) {
                api.assert.ok(costs[i] - costs[i - 1] >= costs[i - 1] - costs[i - 2],
                  'trial ' + trial + ': marginal costs ' + costs.join(', ') +
                    ' must never fall — convexity is the correctness argument for the greedy');
              }
            }
          }
        }
      ]
    }],

    'bipartite-matching': [{
      id: 'koenig-vertex-cover',
      title: 'Koenig\'s cover, and the half of the alternating set that is the wrong half',
      prompt: 'koenigCover(left, right, edges) must return { size, cover } for a bipartite graph ' +
        'given as a count of left vertices, a count of right vertices and edges `{ from, to }` with ' +
        '`from` on the left. `size` is the maximum matching size and `cover` is ' +
        '`{ left: [...], right: [...] }`, both sorted ascending, forming a MINIMUM VERTEX COVER — a ' +
        'set of vertices touching every edge. Find a maximum matching by augmenting paths, then ' +
        'let Z be everything reachable by alternating paths starting from the UNMATCHED left ' +
        'vertices — free edges going right, matched edges coming back left. Koenig\'s cover is the ' +
        'left vertices NOT in Z together with the right vertices that ARE. The starter takes the ' +
        'other half of each side, which is a perfectly reasonable-looking set of exactly the wrong ' +
        'vertices.',
      entry: 'koenigCover',
      starter: [
        'function koenigCover(left, right, edges) {',
        '  const adjacency = [];',
        '  for (let v = 0; v < left; v += 1) adjacency.push([]);',
        '  edges.forEach(function (edge) { adjacency[edge.from].push(edge.to); });',
        '',
        '  const matchLeft = new Array(left).fill(-1);',
        '  const matchRight = new Array(right).fill(-1);',
        '',
        '  function augment(v, seen) {',
        '    for (let i = 0; i < adjacency[v].length; i += 1) {',
        '      const r = adjacency[v][i];',
        '      if (seen[r]) continue;',
        '      seen[r] = true;',
        '      if (matchRight[r] === -1 || augment(matchRight[r], seen)) {',
        '        matchRight[r] = v; matchLeft[v] = r; return true;',
        '      }',
        '    }',
        '    return false;',
        '  }',
        '  let size = 0;',
        '  for (let v = 0; v < left; v += 1) {',
        '    if (!augment(v, new Array(right).fill(false))) continue;',
        '    size += 1;',
        '  }',
        '',
        '  const leftSeen = new Array(left).fill(false);',
        '  const rightSeen = new Array(right).fill(false);',
        '  const queue = [];',
        '  for (let v = 0; v < left; v += 1) {',
        '    if (matchLeft[v] !== -1) continue;',
        '    leftSeen[v] = true; queue.push(v);',
        '  }',
        '  let head = 0;',
        '  while (head < queue.length) {',
        '    const v = queue[head]; head += 1;',
        '    for (let i = 0; i < adjacency[v].length; i += 1) {',
        '      const r = adjacency[v][i];',
        '      if (rightSeen[r] || matchLeft[v] === r) continue;',
        '      rightSeen[r] = true;',
        '      const back = matchRight[r];',
        '      if (back === -1 || leftSeen[back]) continue;',
        '      leftSeen[back] = true; queue.push(back);',
        '    }',
        '  }',
        '',
        '  const cover = { left: [], right: [] };',
        '  // the reached left vertices and the unreached right ones',
        '  leftSeen.forEach(function (flag, v) { if (flag) cover.left.push(v); });',
        '  rightSeen.forEach(function (flag, r) { if (!flag) cover.right.push(r); });',
        '  return { size: size, cover: cover };',
        '}'
      ].join('\n'),
      solution: [
        'function koenigCover(left, right, edges) {',
        '  const adjacency = [];',
        '  for (let v = 0; v < left; v += 1) adjacency.push([]);',
        '  edges.forEach(function (edge) { adjacency[edge.from].push(edge.to); });',
        '',
        '  const matchLeft = new Array(left).fill(-1);',
        '  const matchRight = new Array(right).fill(-1);',
        '',
        '  function augment(v, seen) {',
        '    for (let i = 0; i < adjacency[v].length; i += 1) {',
        '      const r = adjacency[v][i];',
        '      if (seen[r]) continue;',
        '      seen[r] = true;',
        '      if (matchRight[r] === -1 || augment(matchRight[r], seen)) {',
        '        matchRight[r] = v; matchLeft[v] = r; return true;',
        '      }',
        '    }',
        '    return false;',
        '  }',
        '  let size = 0;',
        '  for (let v = 0; v < left; v += 1) {',
        '    if (!augment(v, new Array(right).fill(false))) continue;',
        '    size += 1;',
        '  }',
        '',
        '  const leftSeen = new Array(left).fill(false);',
        '  const rightSeen = new Array(right).fill(false);',
        '  const queue = [];',
        '  for (let v = 0; v < left; v += 1) {',
        '    if (matchLeft[v] !== -1) continue;',
        '    leftSeen[v] = true; queue.push(v);',
        '  }',
        '  let head = 0;',
        '  while (head < queue.length) {',
        '    const v = queue[head]; head += 1;',
        '    for (let i = 0; i < adjacency[v].length; i += 1) {',
        '      const r = adjacency[v][i];',
        '      if (rightSeen[r] || matchLeft[v] === r) continue;',
        '      rightSeen[r] = true;',
        '      const back = matchRight[r];',
        '      if (back === -1 || leftSeen[back]) continue;',
        '      leftSeen[back] = true; queue.push(back);',
        '    }',
        '  }',
        '',
        '  const cover = { left: [], right: [] };',
        '  // the left vertices the alternating search did NOT reach, and the right ones it did',
        '  leftSeen.forEach(function (flag, v) { if (!flag) cover.left.push(v); });',
        '  rightSeen.forEach(function (flag, r) { if (flag) cover.right.push(r); });',
        '  return { size: size, cover: cover };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the cover touches every edge',
          assert: function (koenigCover, api) {
            for (let trial = 0; trial < 10; trial += 1) {
              const side = 10;
              const edges = [];
              const seen = {};

              for (let a = 0; a < side; a += 1) {
                for (let i = 0; i < 3; i += 1) {
                  const b = api.rng.int(side);
                  const key = a + '>' + b;

                  if (seen[key]) continue;
                  seen[key] = true;
                  edges.push({ from: a, to: b });
                }
              }
              const got = koenigCover(side, side, edges);
              const inLeft = {};
              const inRight = {};

              got.cover.left.forEach(function (v) { inLeft[v] = true; });
              got.cover.right.forEach(function (r) { inRight[r] = true; });
              edges.forEach(function (edge) {
                api.assert.ok(inLeft[edge.from] || inRight[edge.to],
                  'trial ' + trial + ': edge ' + edge.from + '-' + edge.to +
                    ' is touched by neither side of the cover');
              });
            }
          }
        },
        {
          name: 'the cover has exactly the size of the maximum matching',
          assert: function (koenigCover, api) {
            function kuhn(left, right, edges) {
              const adjacency = [];

              for (let v = 0; v < left; v += 1) adjacency.push([]);
              edges.forEach(function (edge) { adjacency[edge.from].push(edge.to); });
              const matchLeft = new Array(left).fill(-1);
              const matchRight = new Array(right).fill(-1);

              function tryFrom(v, seen) {
                for (let i = 0; i < adjacency[v].length; i += 1) {
                  const r = adjacency[v][i];

                  if (seen[r]) continue;
                  seen[r] = true;

                  if (matchRight[r] === -1 || tryFrom(matchRight[r], seen)) {
                    matchRight[r] = v;
                    matchLeft[v] = r;
                    return true;
                  }
                }
                return false;
              }
              let size = 0;

              for (let v = 0; v < left; v += 1) {
                if (!tryFrom(v, new Array(right).fill(false))) continue;
                size += 1;
              }
              return size;
            }

            for (let trial = 0; trial < 10; trial += 1) {
              const side = 9;
              const edges = [];
              const seen = {};

              for (let a = 0; a < side; a += 1) {
                for (let i = 0; i < 2 + api.rng.int(3); i += 1) {
                  const b = api.rng.int(side);
                  const key = a + '>' + b;

                  if (seen[key]) continue;
                  seen[key] = true;
                  edges.push({ from: a, to: b });
                }
              }
              const got = koenigCover(side, side, edges);
              const truth = kuhn(side, side, edges);

              api.assert.equal(got.size, truth, 'trial ' + trial + ': the matching size must match Kuhn');
              api.assert.equal(got.cover.left.length + got.cover.right.length, truth,
                'Koenig says the minimum vertex cover has exactly the matching size; ' +
                  'this cover has ' + (got.cover.left.length + got.cover.right.length));
            }
          }
        },
        {
          name: 'on an unbalanced graph the cover is the small side, not the large one',
          assert: function (koenigCover, api) {
            const edges = [];

            for (let a = 0; a < 8; a += 1) {
              edges.push({ from: a, to: 0 });
              edges.push({ from: a, to: 1 });
            }
            const got = koenigCover(8, 2, edges);

            api.assert.equal(got.size, 2, 'only two right vertices exist, so the matching is 2');
            api.assert.equal(got.cover.left.length + got.cover.right.length, 2,
              'two right vertices cover all 16 edges; a cover naming left vertices instead ' +
                'needs eight of them and is not minimum');
            api.assert.equal(got.cover.left.length, 0,
              'every left vertex is reachable from an unmatched one, so none of them is in the cover');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));

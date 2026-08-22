/**
 * Graded exercises for maximum flow, minimum cut and push-relabel (M14.1-M14.3).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'maximum-flow': [{
      id: 'residual-back-edge',
      title: 'The back edge, and the 1 999 that looks like an answer',
      prompt: 'maxFlow(n, edges, source, sink) must return { value, flow } for a DIRECTED network: ' +
        'the maximum flow value, and `flow` as an array parallel to `edges` giving the amount ' +
        'carried by each one. Find augmenting paths by depth-first search — take the first residual ' +
        'arc out of each vertex — and push the bottleneck along each. The whole exercise is one ' +
        'detail: pushing f along an arc must leave `capacity − f` available forward AND `f` ' +
        'available BACKWARD, on an arc that does not exist in `edges`. The starter omits the ' +
        'backward arc, which does not make it slower — it makes it wrong, by one unit in two ' +
        'thousand, while reporting a perfectly valid flow.',
      entry: 'maxFlow',
      starter: [
        'function maxFlow(n, edges, source, sink) {',
        '  // residual capacity of each input arc, and nothing else',
        '  const residual = edges.map(function (edge) { return edge.capacity; });',
        '  const out = [];',
        '  for (let v = 0; v < n; v += 1) out.push([]);',
        '  edges.forEach(function (edge, id) { out[edge.from].push(id); });',
        '',
        '  let value = 0;',
        '  for (;;) {',
        '    const seen = new Array(n).fill(false);',
        '    const next = new Array(n).fill(0);',
        '    const path = [];',
        '    const stack = [source];',
        '    seen[source] = true;',
        '    while (stack.length && stack[stack.length - 1] !== sink) {',
        '      const at = stack[stack.length - 1];',
        '      if (next[at] >= out[at].length) { stack.pop(); path.pop(); continue; }',
        '      const id = out[at][next[at]];',
        '      next[at] += 1;',
        '      if (residual[id] <= 0 || seen[edges[id].to]) continue;',
        '      seen[edges[id].to] = true;',
        '      path.push(id);',
        '      stack.push(edges[id].to);',
        '    }',
        '    if (!stack.length) break;',
        '',
        '    let bottleneck = Infinity;',
        '    path.forEach(function (id) { bottleneck = Math.min(bottleneck, residual[id]); });',
        '    path.forEach(function (id) { residual[id] -= bottleneck; });',
        '    value += bottleneck;',
        '  }',
        '  return { value: value,',
        '    flow: edges.map(function (edge, id) { return edge.capacity - residual[id]; }) };',
        '}'
      ].join('\n'),
      solution: [
        'function maxFlow(n, edges, source, sink) {',
        '  // two residual arcs per input arc: 2*id forward, 2*id+1 backward',
        '  const to = [];',
        '  const residual = [];',
        '  const out = [];',
        '  for (let v = 0; v < n; v += 1) out.push([]);',
        '  edges.forEach(function (edge, id) {',
        '    to.push(edge.to);',
        '    residual.push(edge.capacity);',
        '    out[edge.from].push(2 * id);',
        '    to.push(edge.from);',
        '    residual.push(0);',
        '    out[edge.to].push(2 * id + 1);',
        '  });',
        '',
        '  let value = 0;',
        '  for (;;) {',
        '    const seen = new Array(n).fill(false);',
        '    const next = new Array(n).fill(0);',
        '    const path = [];',
        '    const stack = [source];',
        '    seen[source] = true;',
        '    while (stack.length && stack[stack.length - 1] !== sink) {',
        '      const at = stack[stack.length - 1];',
        '      if (next[at] >= out[at].length) { stack.pop(); path.pop(); continue; }',
        '      const arc = out[at][next[at]];',
        '      next[at] += 1;',
        '      if (residual[arc] <= 0 || seen[to[arc]]) continue;',
        '      seen[to[arc]] = true;',
        '      path.push(arc);',
        '      stack.push(to[arc]);',
        '    }',
        '    if (!stack.length) break;',
        '',
        '    let bottleneck = Infinity;',
        '    path.forEach(function (arc) { bottleneck = Math.min(bottleneck, residual[arc]); });',
        '    path.forEach(function (arc) {',
        '      residual[arc] -= bottleneck;',
        '      residual[arc ^ 1] += bottleneck;   // the backward arc IS the algorithm',
        '    });',
        '    value += bottleneck;',
        '  }',
        '  return { value: value,',
        '    flow: edges.map(function (edge, id) { return residual[2 * id + 1]; }) };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the classic four-vertex network returns 2 000, not 1 999',
          assert: function (maxFlow, api) {
            const edges = [
              { from: 0, to: 1, capacity: 1000 },
              { from: 0, to: 2, capacity: 1000 },
              { from: 1, to: 2, capacity: 1 },
              { from: 1, to: 3, capacity: 1000 },
              { from: 2, to: 3, capacity: 1000 }
            ];
            const got = maxFlow(4, edges, 0, 3);

            api.assert.equal(got.value, 2000,
              'a search that takes the middle arc first strands 999 units on each side; ' +
                'without a backward arc there is no way to move them');
          }
        },
        {
          name: 'the value matches an independent implementation on random networks',
          assert: function (maxFlow, api) {
            function reference(n, edges, source, sink) {
              const to = [];
              const cap = [];
              const out = [];

              for (let v = 0; v < n; v += 1) out.push([]);
              edges.forEach(function (edge) {
                out[edge.from].push(to.length);
                to.push(edge.to);
                cap.push(edge.capacity);
                out[edge.to].push(to.length);
                to.push(edge.from);
                cap.push(0);
              });
              let total = 0;

              for (;;) {
                const came = new Array(n).fill(-1);
                const prev = new Array(n).fill(-1);
                const queue = [source];
                let head = 0;

                came[source] = -2;

                while (head < queue.length) {
                  const at = queue[head];

                  head += 1;
                  out[at].forEach(function (arc) {
                    if (came[to[arc]] !== -1 || cap[arc] <= 0) return;
                    came[to[arc]] = arc;
                    prev[to[arc]] = at;
                    queue.push(to[arc]);
                  });
                }

                if (came[sink] === -1) break;
                let push = Infinity;

                for (let at = sink; at !== source; at = prev[at]) {
                  push = Math.min(push, cap[came[at]]);
                }

                for (let at = sink; at !== source; at = prev[at]) {
                  cap[came[at]] -= push;
                  cap[came[at] ^ 1] += push;
                }
                total += push;
              }
              return total;
            }

            for (let trial = 0; trial < 12; trial += 1) {
              const n = 10;
              const edges = [];

              for (let v = 1; v < n; v += 1) {
                edges.push({ from: api.rng.int(v), to: v, capacity: 1 + api.rng.int(12) });
              }

              for (let i = 0; i < 16; i += 1) {
                const a = api.rng.int(n - 1);
                const b = 1 + api.rng.int(n - 1);

                if (a === b) continue;
                edges.push({ from: a, to: b, capacity: 1 + api.rng.int(12) });
              }
              const got = maxFlow(n, edges, 0, n - 1);

              api.assert.equal(got.value, reference(n, edges, 0, n - 1),
                'trial ' + trial + ': the value must match a residual implementation');
            }
          }
        },
        {
          name: 'the returned flow respects capacity and conserves at every middle vertex',
          assert: function (maxFlow, api) {
            for (let trial = 0; trial < 8; trial += 1) {
              const n = 9;
              const edges = [];

              for (let v = 1; v < n; v += 1) {
                edges.push({ from: api.rng.int(v), to: v, capacity: 1 + api.rng.int(9) });
              }

              for (let i = 0; i < 12; i += 1) {
                const a = api.rng.int(n - 1);
                const b = 1 + api.rng.int(n - 1);

                if (a === b) continue;
                edges.push({ from: a, to: b, capacity: 1 + api.rng.int(9) });
              }
              const got = maxFlow(n, edges, 0, n - 1);
              const balance = new Array(n).fill(0);

              got.flow.forEach(function (amount, id) {
                api.assert.ok(amount >= 0 && amount <= edges[id].capacity,
                  'arc ' + id + ' carries ' + amount + ' against a capacity of ' +
                    edges[id].capacity);
                balance[edges[id].from] -= amount;
                balance[edges[id].to] += amount;
              });

              for (let v = 1; v < n - 1; v += 1) {
                api.assert.equal(balance[v], 0,
                  'vertex ' + v + ' is out of balance by ' + balance[v] +
                    '; conservation is half the definition of a flow');
              }
              api.assert.equal(balance[n - 1], got.value,
                'the net inflow at the sink must be the reported value');
            }
          }
        }
      ]
    }],

    'minimum-cut': [{
      id: 'cut-from-the-residual',
      title: 'The cut is read off the residual graph, and only arcs leaving it count',
      prompt: 'minCut(n, edges, source, sink) must return { capacity, side } for a DIRECTED ' +
        'network: the minimum cut capacity, and `side` as a sorted array of the vertices on the ' +
        'source side. Compute a maximum flow first, then take everything still reachable from the ' +
        'source in the RESIDUAL graph — remembering that a residual arc runs backward along any arc ' +
        'carrying flow. The capacity of the cut is the sum of the original capacities of arcs going ' +
        'FROM the set TO its complement, and nothing else: an arc coming back into the set carries ' +
        'no cost. The starter sums both directions, which produces a number larger than the flow.',
      entry: 'minCut',
      starter: [
        'function minCut(n, edges, source, sink) {',
        '  const to = [];',
        '  const residual = [];',
        '  const out = [];',
        '  for (let v = 0; v < n; v += 1) out.push([]);',
        '  edges.forEach(function (edge) {',
        '    out[edge.from].push(to.length); to.push(edge.to); residual.push(edge.capacity);',
        '    out[edge.to].push(to.length); to.push(edge.from); residual.push(0);',
        '  });',
        '',
        '  for (;;) {',
        '    const came = new Array(n).fill(-1);',
        '    const prev = new Array(n).fill(-1);',
        '    const queue = [source];',
        '    let head = 0;',
        '    came[source] = -2;',
        '    while (head < queue.length) {',
        '      const at = queue[head]; head += 1;',
        '      for (let i = 0; i < out[at].length; i += 1) {',
        '        const arc = out[at][i];',
        '        if (came[to[arc]] !== -1 || residual[arc] <= 0) continue;',
        '        came[to[arc]] = arc; prev[to[arc]] = at; queue.push(to[arc]);',
        '      }',
        '    }',
        '    if (came[sink] === -1) break;',
        '    let push = Infinity;',
        '    for (let at = sink; at !== source; at = prev[at]) push = Math.min(push, residual[came[at]]);',
        '    for (let at = sink; at !== source; at = prev[at]) {',
        '      residual[came[at]] -= push; residual[came[at] ^ 1] += push;',
        '    }',
        '  }',
        '',
        '  const seen = new Array(n).fill(false);',
        '  const queue = [source];',
        '  seen[source] = true;',
        '  while (queue.length) {',
        '    const at = queue.pop();',
        '    for (let i = 0; i < out[at].length; i += 1) {',
        '      const arc = out[at][i];',
        '      if (seen[to[arc]] || residual[arc] <= 0) continue;',
        '      seen[to[arc]] = true; queue.push(to[arc]);',
        '    }',
        '  }',
        '  let capacity = 0;',
        '  edges.forEach(function (edge) {',
        '    // every arc with one endpoint inside and one outside is counted',
        '    if (seen[edge.from] !== seen[edge.to]) capacity += edge.capacity;',
        '  });',
        '  const side = [];',
        '  seen.forEach(function (flag, v) { if (flag) side.push(v); });',
        '  return { capacity: capacity, side: side };',
        '}'
      ].join('\n'),
      solution: [
        'function minCut(n, edges, source, sink) {',
        '  const to = [];',
        '  const residual = [];',
        '  const out = [];',
        '  for (let v = 0; v < n; v += 1) out.push([]);',
        '  edges.forEach(function (edge) {',
        '    out[edge.from].push(to.length); to.push(edge.to); residual.push(edge.capacity);',
        '    out[edge.to].push(to.length); to.push(edge.from); residual.push(0);',
        '  });',
        '',
        '  for (;;) {',
        '    const came = new Array(n).fill(-1);',
        '    const prev = new Array(n).fill(-1);',
        '    const queue = [source];',
        '    let head = 0;',
        '    came[source] = -2;',
        '    while (head < queue.length) {',
        '      const at = queue[head]; head += 1;',
        '      for (let i = 0; i < out[at].length; i += 1) {',
        '        const arc = out[at][i];',
        '        if (came[to[arc]] !== -1 || residual[arc] <= 0) continue;',
        '        came[to[arc]] = arc; prev[to[arc]] = at; queue.push(to[arc]);',
        '      }',
        '    }',
        '    if (came[sink] === -1) break;',
        '    let push = Infinity;',
        '    for (let at = sink; at !== source; at = prev[at]) push = Math.min(push, residual[came[at]]);',
        '    for (let at = sink; at !== source; at = prev[at]) {',
        '      residual[came[at]] -= push; residual[came[at] ^ 1] += push;',
        '    }',
        '  }',
        '',
        '  const seen = new Array(n).fill(false);',
        '  const queue = [source];',
        '  seen[source] = true;',
        '  while (queue.length) {',
        '    const at = queue.pop();',
        '    for (let i = 0; i < out[at].length; i += 1) {',
        '      const arc = out[at][i];',
        '      if (seen[to[arc]] || residual[arc] <= 0) continue;',
        '      seen[to[arc]] = true; queue.push(to[arc]);',
        '    }',
        '  }',
        '  let capacity = 0;',
        '  edges.forEach(function (edge) {',
        '    // only arcs LEAVING the source side are paid for',
        '    if (seen[edge.from] && !seen[edge.to]) capacity += edge.capacity;',
        '  });',
        '  const side = [];',
        '  seen.forEach(function (flag, v) { if (flag) side.push(v); });',
        '  return { capacity: capacity, side: side };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the cut capacity equals the maximum flow value',
          assert: function (minCut, api) {
            function maxFlowValue(n, edges, source, sink) {
              const to = [];
              const cap = [];
              const out = [];

              for (let v = 0; v < n; v += 1) out.push([]);
              edges.forEach(function (edge) {
                out[edge.from].push(to.length); to.push(edge.to); cap.push(edge.capacity);
                out[edge.to].push(to.length); to.push(edge.from); cap.push(0);
              });
              let total = 0;

              for (;;) {
                const came = new Array(n).fill(-1);
                const prev = new Array(n).fill(-1);
                const queue = [source];
                let head = 0;

                came[source] = -2;

                while (head < queue.length) {
                  const at = queue[head];

                  head += 1;
                  out[at].forEach(function (arc) {
                    if (came[to[arc]] !== -1 || cap[arc] <= 0) return;
                    came[to[arc]] = arc; prev[to[arc]] = at; queue.push(to[arc]);
                  });
                }

                if (came[sink] === -1) break;
                let push = Infinity;

                for (let at = sink; at !== source; at = prev[at]) push = Math.min(push, cap[came[at]]);

                for (let at = sink; at !== source; at = prev[at]) {
                  cap[came[at]] -= push; cap[came[at] ^ 1] += push;
                }
                total += push;
              }
              return total;
            }

            for (let trial = 0; trial < 12; trial += 1) {
              const n = 10;
              const edges = [];

              for (let v = 1; v < n; v += 1) {
                edges.push({ from: api.rng.int(v), to: v, capacity: 1 + api.rng.int(12) });
              }

              for (let i = 0; i < 14; i += 1) {
                const a = api.rng.int(n - 1);
                const b = 1 + api.rng.int(n - 1);

                if (a === b) continue;
                edges.push({ from: a, to: b, capacity: 1 + api.rng.int(12) });
              }
              const got = minCut(n, edges, 0, n - 1);

              api.assert.equal(got.capacity, maxFlowValue(n, edges, 0, n - 1),
                'trial ' + trial + ': max-flow min-cut is an equality, not an inequality — ' +
                  'an arc coming back into the source side costs nothing');
            }
          }
        },
        {
          name: 'the source is inside the set, the sink is outside, and nothing else is required',
          assert: function (minCut, api) {
            for (let trial = 0; trial < 8; trial += 1) {
              const n = 8;
              const edges = [];

              for (let v = 1; v < n; v += 1) {
                edges.push({ from: api.rng.int(v), to: v, capacity: 1 + api.rng.int(6) });
              }

              for (let i = 0; i < 10; i += 1) {
                const a = api.rng.int(n - 1);
                const b = 1 + api.rng.int(n - 1);

                if (a === b) continue;
                edges.push({ from: a, to: b, capacity: 1 + api.rng.int(6) });
              }
              const got = minCut(n, edges, 0, n - 1);

              api.assert.ok(got.side.indexOf(0) !== -1, 'the source must be on the source side');
              api.assert.ok(got.side.indexOf(n - 1) === -1,
                'the sink must not be; if it is, the residual search found an augmenting path ' +
                  'and the flow was not maximum');

              for (let i = 1; i < got.side.length; i += 1) {
                api.assert.ok(got.side[i] > got.side[i - 1], 'the side must be sorted ascending');
              }
            }
          }
        },
        {
          name: 'on a graph needing a reroute the cut is 6, not 8',
          assert: function (minCut, api) {
            const edges = [
              { from: 0, to: 1, capacity: 3 },
              { from: 0, to: 2, capacity: 3 },
              { from: 1, to: 2, capacity: 5 },
              { from: 1, to: 3, capacity: 3 },
              { from: 2, to: 3, capacity: 3 }
            ];
            const got = minCut(4, edges, 0, 3);

            api.assert.equal(got.capacity, 6,
              'the two arcs out of the source are the cut; the middle arc points back into the ' +
                'source side from vertex 2 and must not be charged');
          }
        }
      ]
    }],

    'push-relabel': [{
      id: 'preflow-and-heights',
      title: 'Draining the preflow, including the excess that has to go home',
      prompt: 'pushRelabel(n, edges, source, sink) must return { value, active } for a DIRECTED ' +
        'network: the maximum flow value, and `active` — the number of vertices still holding ' +
        'positive excess when the run finishes, which must be 0. Saturate every arc out of the ' +
        'source, set h(source) = n, and repeatedly take an active vertex: push along any residual ' +
        'arc to a neighbour exactly one lower, or relabel to one above the lowest residual ' +
        'neighbour. The trap is that excess which cannot reach the sink must be pushed BACK to the ' +
        'source, and that needs heights above n — the starter treats any vertex that climbs past n ' +
        'as stuck and abandons it, which leaves a preflow whose value still looks right.',
      entry: 'pushRelabel',
      starter: [
        'function pushRelabel(n, edges, source, sink) {',
        '  const to = [];',
        '  const residual = [];',
        '  const out = [];',
        '  for (let v = 0; v < n; v += 1) out.push([]);',
        '  edges.forEach(function (edge) {',
        '    out[edge.from].push(to.length); to.push(edge.to); residual.push(edge.capacity);',
        '    out[edge.to].push(to.length); to.push(edge.from); residual.push(0);',
        '  });',
        '',
        '  const height = new Array(n).fill(0);',
        '  const excess = new Array(n).fill(0);',
        '  height[source] = n;',
        '  out[source].forEach(function (arc) {',
        '    const amount = residual[arc];',
        '    if (amount <= 0) return;',
        '    residual[arc] -= amount; residual[arc ^ 1] += amount;',
        '    excess[to[arc]] += amount; excess[source] -= amount;',
        '  });',
        '',
        '  for (;;) {',
        '    let at = -1;',
        '    for (let v = 0; v < n; v += 1) {',
        '      if (v === source || v === sink || excess[v] <= 0) continue;',
        '      // anything that has climbed past n is treated as stuck and left alone',
        '      if (height[v] > n) continue;',
        '      at = v; break;',
        '    }',
        '    if (at === -1) break;',
        '    let lowest = Infinity;',
        '    let pushed = false;',
        '    for (let i = 0; i < out[at].length; i += 1) {',
        '      const arc = out[at][i];',
        '      if (residual[arc] <= 0) continue;',
        '      if (height[at] === height[to[arc]] + 1) {',
        '        const amount = Math.min(excess[at], residual[arc]);',
        '        residual[arc] -= amount; residual[arc ^ 1] += amount;',
        '        excess[at] -= amount; excess[to[arc]] += amount;',
        '        pushed = true; break;',
        '      }',
        '      lowest = Math.min(lowest, height[to[arc]]);',
        '    }',
        '    if (!pushed && lowest !== Infinity) height[at] = lowest + 1;',
        '  }',
        '  let active = 0;',
        '  for (let v = 0; v < n; v += 1) {',
        '    if (v === source || v === sink || excess[v] <= 0) continue;',
        '    active += 1;',
        '  }',
        '  return { value: excess[sink], active: active };',
        '}'
      ].join('\n'),
      solution: [
        'function pushRelabel(n, edges, source, sink) {',
        '  const to = [];',
        '  const residual = [];',
        '  const out = [];',
        '  for (let v = 0; v < n; v += 1) out.push([]);',
        '  edges.forEach(function (edge) {',
        '    out[edge.from].push(to.length); to.push(edge.to); residual.push(edge.capacity);',
        '    out[edge.to].push(to.length); to.push(edge.from); residual.push(0);',
        '  });',
        '',
        '  const height = new Array(n).fill(0);',
        '  const excess = new Array(n).fill(0);',
        '  height[source] = n;',
        '  out[source].forEach(function (arc) {',
        '    const amount = residual[arc];',
        '    if (amount <= 0) return;',
        '    residual[arc] -= amount; residual[arc ^ 1] += amount;',
        '    excess[to[arc]] += amount; excess[source] -= amount;',
        '  });',
        '',
        '  const queue = [];',
        '  for (let v = 0; v < n; v += 1) {',
        '    if (v === source || v === sink || excess[v] <= 0) continue;',
        '    queue.push(v);',
        '  }',
        '  let head = 0;',
        '  while (head < queue.length) {',
        '    const at = queue[head];',
        '    head += 1;',
        '    if (head > 8 * n * n * n) break;',
        '    while (excess[at] > 0) {',
        '      let lowest = Infinity;',
        '      let pushed = false;',
        '      for (let i = 0; i < out[at].length && excess[at] > 0; i += 1) {',
        '        const arc = out[at][i];',
        '        if (residual[arc] <= 0) continue;',
        '        if (height[at] === height[to[arc]] + 1) {',
        '          const amount = Math.min(excess[at], residual[arc]);',
        '          const target = to[arc];',
        '          residual[arc] -= amount; residual[arc ^ 1] += amount;',
        '          excess[at] -= amount;',
        '          if (excess[target] === 0 && target !== source && target !== sink) queue.push(target);',
        '          excess[target] += amount;',
        '          pushed = true;',
        '        } else {',
        '          lowest = Math.min(lowest, height[to[arc]]);',
        '        }',
        '      }',
        '      if (excess[at] <= 0) break;',
        '      if (pushed) continue;',
        '      if (lowest === Infinity) break;',
        '      // heights above n are exactly how excess finds its way home',
        '      height[at] = lowest + 1;',
        '    }',
        '  }',
        '  let active = 0;',
        '  for (let v = 0; v < n; v += 1) {',
        '    if (v === source || v === sink || excess[v] <= 0) continue;',
        '    active += 1;',
        '  }',
        '  return { value: excess[sink], active: active };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'no vertex is left holding excess',
          assert: function (pushRelabel, api) {
            for (let trial = 0; trial < 8; trial += 1) {
              const n = 8;
              const edges = [];

              for (let v = 1; v < n; v += 1) {
                edges.push({ from: api.rng.int(v), to: v, capacity: 1 + api.rng.int(9) });
              }

              for (let i = 0; i < 10; i += 1) {
                const a = api.rng.int(n - 1);
                const b = 1 + api.rng.int(n - 1);

                if (a === b) continue;
                edges.push({ from: a, to: b, capacity: 1 + api.rng.int(9) });
              }
              const got = pushRelabel(n, edges, 0, n - 1);

              api.assert.equal(got.active, 0,
                'trial ' + trial + ': ' + got.active + ' vertices still hold excess, so the ' +
                  'result is a preflow rather than a flow — and its value looks entirely normal');
            }
          }
        },
        {
          name: 'the value matches an augmenting-path implementation',
          assert: function (pushRelabel, api) {
            function reference(n, edges, source, sink) {
              const to = [];
              const cap = [];
              const out = [];

              for (let v = 0; v < n; v += 1) out.push([]);
              edges.forEach(function (edge) {
                out[edge.from].push(to.length); to.push(edge.to); cap.push(edge.capacity);
                out[edge.to].push(to.length); to.push(edge.from); cap.push(0);
              });
              let total = 0;

              for (;;) {
                const came = new Array(n).fill(-1);
                const prev = new Array(n).fill(-1);
                const queue = [source];
                let head = 0;

                came[source] = -2;

                while (head < queue.length) {
                  const at = queue[head];

                  head += 1;
                  out[at].forEach(function (arc) {
                    if (came[to[arc]] !== -1 || cap[arc] <= 0) return;
                    came[to[arc]] = arc; prev[to[arc]] = at; queue.push(to[arc]);
                  });
                }

                if (came[sink] === -1) break;
                let push = Infinity;

                for (let at = sink; at !== source; at = prev[at]) push = Math.min(push, cap[came[at]]);

                for (let at = sink; at !== source; at = prev[at]) {
                  cap[came[at]] -= push; cap[came[at] ^ 1] += push;
                }
                total += push;
              }
              return total;
            }

            for (let trial = 0; trial < 10; trial += 1) {
              const n = 9;
              const edges = [];

              for (let v = 1; v < n; v += 1) {
                edges.push({ from: api.rng.int(v), to: v, capacity: 1 + api.rng.int(9) });
              }

              for (let i = 0; i < 12; i += 1) {
                const a = api.rng.int(n - 1);
                const b = 1 + api.rng.int(n - 1);

                if (a === b) continue;
                edges.push({ from: a, to: b, capacity: 1 + api.rng.int(9) });
              }
              api.assert.equal(pushRelabel(n, edges, 0, n - 1).value,
                reference(n, edges, 0, n - 1),
                'trial ' + trial + ': push-relabel and augmenting paths must agree');
            }
          }
        },
        {
          name: 'a dead end forces excess back to the source, which needs a height above n',
          assert: function (pushRelabel, api) {
            const edges = [
              { from: 0, to: 1, capacity: 10 },
              { from: 0, to: 2, capacity: 10 },
              { from: 1, to: 3, capacity: 4 },
              { from: 2, to: 4, capacity: 10 }
            ];
            const got = pushRelabel(5, edges, 0, 3);

            api.assert.equal(got.value, 4, 'only 4 units can reach the sink');
            api.assert.equal(got.active, 0,
              'vertex 2 and vertex 4 are flooded and cannot reach the sink at all, so their ' +
                'excess has to climb back over the source at height n');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));

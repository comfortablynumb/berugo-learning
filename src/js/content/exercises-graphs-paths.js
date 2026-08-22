/**
 * Graded exercises for connectivity and shortest paths (M13.4-M13.6).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'bridges-and-cuts': [{
      id: 'bridges-with-parallel-edges',
      title: 'bridge finding that survives a redundant link',
      prompt: 'findBridges(n, edges) must return the ids — indices into `edges` — of every bridge in ' +
        'an UNDIRECTED graph, sorted ascending. The graph may contain parallel edges: two entries ' +
        'joining the same pair. That is the whole exercise. A depth-first walk meets the edge it ' +
        'arrived on a second time from the other end and must ignore that sighting, and the starter ' +
        'ignores it by asking "is this neighbour my parent?" — which also ignores a genuine SECOND link ' +
        'to that parent, and a second link is exactly what stops the first being a bridge. Skip by edge ' +
        'ID instead. Use the lowlink test: tree edge (u, v) is a bridge exactly when low[v] > disc[u]. ' +
        'Walk iteratively; a chain is a legitimate input.',
      entry: 'findBridges',
      starter: [
        'function findBridges(n, edges) {',
        '  const adjacency = [];',
        '  for (let v = 0; v < n; v += 1) adjacency.push([]);',
        '  edges.forEach(function (edge, id) {',
        '    adjacency[edge.from].push({ to: edge.to, id: id });',
        '    adjacency[edge.to].push({ to: edge.from, id: id });',
        '  });',
        '',
        '  const disc = new Array(n).fill(-1);',
        '  const low = new Array(n).fill(0);',
        '  const bridges = [];',
        '  let timer = 0;',
        '',
        '  for (let source = 0; source < n; source += 1) {',
        '    if (disc[source] !== -1) continue;',
        '    disc[source] = timer; low[source] = timer; timer += 1;',
        '    const frames = [{ node: source, parent: -1, cursor: 0, edgeIn: -1 }];',
        '',
        '    while (frames.length) {',
        '      const frame = frames[frames.length - 1];',
        '      const v = frame.node;',
        '',
        '      if (frame.cursor < adjacency[v].length) {',
        '        const link = adjacency[v][frame.cursor];',
        '        frame.cursor += 1;',
        '',
        '        // skipping by PARENT VERTEX also skips a parallel edge',
        '        if (link.to === frame.parent) continue;',
        '',
        '        if (disc[link.to] === -1) {',
        '          disc[link.to] = timer; low[link.to] = timer; timer += 1;',
        '          frames.push({ node: link.to, parent: v, cursor: 0, edgeIn: link.id });',
        '          continue;',
        '        }',
        '        if (disc[link.to] < low[v]) low[v] = disc[link.to];',
        '        continue;',
        '      }',
        '      frames.pop();',
        '',
        '      if (!frames.length) continue;',
        '      const above = frames[frames.length - 1].node;',
        '      if (low[v] < low[above]) low[above] = low[v];',
        '      if (low[v] > disc[above]) bridges.push(frame.edgeIn);',
        '    }',
        '  }',
        '  return bridges.sort(function (a, b) { return a - b; });',
        '}'
      ].join('\n'),
      solution: [
        'function findBridges(n, edges) {',
        '  const adjacency = [];',
        '  for (let v = 0; v < n; v += 1) adjacency.push([]);',
        '  edges.forEach(function (edge, id) {',
        '    adjacency[edge.from].push({ to: edge.to, id: id });',
        '    adjacency[edge.to].push({ to: edge.from, id: id });',
        '  });',
        '',
        '  const disc = new Array(n).fill(-1);',
        '  const low = new Array(n).fill(0);',
        '  const bridges = [];',
        '  let timer = 0;',
        '',
        '  for (let source = 0; source < n; source += 1) {',
        '    if (disc[source] !== -1) continue;',
        '    disc[source] = timer; low[source] = timer; timer += 1;',
        '    const frames = [{ node: source, cursor: 0, edgeIn: -1 }];',
        '',
        '    while (frames.length) {',
        '      const frame = frames[frames.length - 1];',
        '      const v = frame.node;',
        '',
        '      if (frame.cursor < adjacency[v].length) {',
        '        const link = adjacency[v][frame.cursor];',
        '        frame.cursor += 1;',
        '',
        '        // skip by EDGE ID: a second, different link to the parent',
        '        // has a different id and must be seen',
        '        if (link.id === frame.edgeIn) continue;',
        '',
        '        if (disc[link.to] === -1) {',
        '          disc[link.to] = timer; low[link.to] = timer; timer += 1;',
        '          frames.push({ node: link.to, cursor: 0, edgeIn: link.id });',
        '          continue;',
        '        }',
        '        if (disc[link.to] < low[v]) low[v] = disc[link.to];',
        '        continue;',
        '      }',
        '      frames.pop();',
        '',
        '      if (!frames.length) continue;',
        '      const above = frames[frames.length - 1].node;',
        '      if (low[v] < low[above]) low[above] = low[v];',
        '      if (low[v] > disc[above]) bridges.push(frame.edgeIn);',
        '    }',
        '  }',
        '  return bridges.sort(function (a, b) { return a - b; });',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'a doubled link is not a bridge',
          assert: function (findBridges, api) {
            /* 0 and 1 joined twice, then 1-2. Removing either copy of 0-1
               leaves the other, so only edge 2 is a bridge. */
            const got = findBridges(3, [
              { from: 0, to: 1 }, { from: 0, to: 1 }, { from: 1, to: 2 }
            ]);

            api.assert.deepEqual(got, [2],
              'only 1-2 is a bridge; the doubled 0-1 is not, and tracking the parent VERTEX ' +
                'instead of the parent EDGE is what reports it as one');
          }
        },
        {
          name: 'the result matches a remove-and-recount oracle on random graphs',
          assert: function (findBridges, api) {
            function componentCount(n, edges, skip) {
              const parent = new Array(n);

              for (let v = 0; v < n; v += 1) parent[v] = v;

              function find(v) {
                let at = v;

                while (parent[at] !== at) { parent[at] = parent[parent[at]]; at = parent[at]; }
                return at;
              }

              edges.forEach(function (edge, id) {
                if (id === skip) return;
                const a = find(edge.from);
                const b = find(edge.to);

                if (a !== b) parent[a] = b;
              });
              const roots = {};

              for (let v = 0; v < n; v += 1) roots[find(v)] = true;
              return Object.keys(roots).length;
            }

            for (let trial = 0; trial < 10; trial += 1) {
              const n = 18;
              const edges = [];

              for (let i = 0; i < 22; i += 1) {
                const a = api.rng.int(n);
                const b = api.rng.int(n);

                if (a === b) continue;
                edges.push({ from: a, to: b });
              }
              const base = componentCount(n, edges, -1);
              const want = [];

              edges.forEach(function (edge, id) {
                if (componentCount(n, edges, id) <= base) return;
                want.push(id);
              });
              api.assert.deepEqual(findBridges(n, edges), want,
                'trial ' + trial + ': the lowlink answer must equal the removal oracle');
            }
          }
        },
        {
          name: 'a path is all bridges and a cycle is none',
          assert: function (findBridges, api) {
            const pathEdges = [];

            for (let v = 1; v < 40; v += 1) pathEdges.push({ from: v - 1, to: v });
            api.assert.equal(findBridges(40, pathEdges).length, 39,
              'every edge of a path is a bridge');

            const cycleEdges = [];

            for (let v = 1; v < 40; v += 1) cycleEdges.push({ from: v - 1, to: v });
            cycleEdges.push({ from: 39, to: 0 });
            api.assert.equal(findBridges(40, cycleEdges).length, 0,
              'a cycle has no bridge at all');
          }
        },
        {
          name: 'a chain of 60 000 vertices does not overflow the stack',
          assert: function (findBridges, api) {
            const n = 60000;
            const edges = [];

            for (let v = 1; v < n; v += 1) edges.push({ from: v - 1, to: v });
            api.assert.equal(findBridges(n, edges).length, n - 1,
              'every edge of a long chain is a bridge, and a recursive walk cannot survive this');
          }
        }
      ]
    }],

    'shortest-paths-basics': [{
      id: 'dijkstra-with-reconstruction',
      title: 'Dijkstra with a lazy heap and a path that adds up',
      prompt: 'shortestPath(n, edges, source, target) must return { distance, path, settled } for an ' +
        'UNDIRECTED graph with non-negative weights: `distance` is the array of distances from the ' +
        'source (Infinity where unreachable), `path` is the list of vertices from source to target ' +
        '(or null if unreachable), and `settled` is how many vertices were finalised. Use a binary ' +
        'heap with lazy deletion — push a new entry on every improvement and discard an entry whose ' +
        'key exceeds the vertex\'s current distance. The starter gets the distances right and records ' +
        'the parent only the FIRST time a vertex is reached, so a later, cheaper route improves the ' +
        'distance and leaves the path pointing at the old one. The result is a path that does not cost ' +
        'what the distance says it costs, and nothing in the run says so.',
      entry: 'shortestPath',
      starter: [
        'function shortestPath(n, edges, source, target) {',
        '  const adjacency = [];',
        '  for (let v = 0; v < n; v += 1) adjacency.push([]);',
        '  edges.forEach(function (edge) {',
        '    adjacency[edge.from].push({ to: edge.to, weight: edge.weight });',
        '    adjacency[edge.to].push({ to: edge.from, weight: edge.weight });',
        '  });',
        '',
        '  const distance = new Array(n).fill(Infinity);',
        '  const parent = new Array(n).fill(-1);',
        '  const done = new Array(n).fill(false);',
        '  const heap = [{ key: 0, node: source }];',
        '  distance[source] = 0;',
        '  let settled = 0;',
        '',
        '  while (heap.length) {',
        '    heap.sort(function (a, b) { return a.key - b.key; });',
        '    const top = heap.shift();',
        '    if (done[top.node]) continue;',
        '    done[top.node] = true;',
        '    settled += 1;',
        '',
        '    adjacency[top.node].forEach(function (link) {',
        '      const candidate = distance[top.node] + link.weight;',
        '      if (candidate >= distance[link.to]) return;',
        '      // the parent is only recorded the first time, which is the bug',
        '      if (parent[link.to] === -1) parent[link.to] = top.node;',
        '      distance[link.to] = candidate;',
        '      heap.push({ key: candidate, node: link.to });',
        '    });',
        '  }',
        '',
        '  if (distance[target] === Infinity) {',
        '    return { distance: distance, path: null, settled: settled };',
        '  }',
        '  const path = [];',
        '  let at = target;',
        '  while (at !== -1) { path.push(at); at = parent[at]; }',
        '  path.reverse();',
        '  return { distance: distance, path: path, settled: settled };',
        '}'
      ].join('\n'),
      solution: [
        'function shortestPath(n, edges, source, target) {',
        '  const adjacency = [];',
        '  for (let v = 0; v < n; v += 1) adjacency.push([]);',
        '  edges.forEach(function (edge) {',
        '    adjacency[edge.from].push({ to: edge.to, weight: edge.weight });',
        '    adjacency[edge.to].push({ to: edge.from, weight: edge.weight });',
        '  });',
        '',
        '  const distance = new Array(n).fill(Infinity);',
        '  const parent = new Array(n).fill(-1);',
        '  const done = new Array(n).fill(false);',
        '  const heap = [];',
        '  let settled = 0;',
        '',
        '  function push(key, node) {',
        '    heap.push({ key: key, node: node });',
        '    let i = heap.length - 1;',
        '    while (i > 0) {',
        '      const up = (i - 1) >> 1;',
        '      if (heap[up].key <= heap[i].key) break;',
        '      const t = heap[up]; heap[up] = heap[i]; heap[i] = t;',
        '      i = up;',
        '    }',
        '  }',
        '',
        '  function pop() {',
        '    const top = heap[0];',
        '    const last = heap.pop();',
        '    if (heap.length) {',
        '      heap[0] = last;',
        '      let i = 0;',
        '      for (;;) {',
        '        const l = 2 * i + 1;',
        '        const r = l + 1;',
        '        let best = i;',
        '        if (l < heap.length && heap[l].key < heap[best].key) best = l;',
        '        if (r < heap.length && heap[r].key < heap[best].key) best = r;',
        '        if (best === i) break;',
        '        const t = heap[best]; heap[best] = heap[i]; heap[i] = t;',
        '        i = best;',
        '      }',
        '    }',
        '    return top;',
        '  }',
        '',
        '  distance[source] = 0;',
        '  push(0, source);',
        '',
        '  while (heap.length) {',
        '    const top = pop();',
        '    if (done[top.node] || top.key > distance[top.node]) continue;',
        '    done[top.node] = true;',
        '    settled += 1;',
        '',
        '    adjacency[top.node].forEach(function (link) {',
        '      const candidate = distance[top.node] + link.weight;',
        '      if (candidate >= distance[link.to]) return;',
        '      distance[link.to] = candidate;',
        '      parent[link.to] = top.node;',
        '      push(candidate, link.to);',
        '    });',
        '  }',
        '',
        '  if (distance[target] === Infinity) {',
        '    return { distance: distance, path: null, settled: settled };',
        '  }',
        '  const path = [];',
        '  let at = target;',
        '  while (at !== -1) { path.push(at); at = parent[at]; }',
        '  path.reverse();',
        '  return { distance: distance, path: path, settled: settled };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the distances match Bellman-Ford on random weighted graphs',
          assert: function (shortestPath, api) {
            function bellmanFord(n, edges, source) {
              const distance = new Array(n).fill(Infinity);

              distance[source] = 0;

              for (let round = 0; round < n; round += 1) {
                let changed = false;

                edges.forEach(function (edge) {
                  if (distance[edge.from] + edge.weight < distance[edge.to]) {
                    distance[edge.to] = distance[edge.from] + edge.weight;
                    changed = true;
                  }

                  if (distance[edge.to] + edge.weight < distance[edge.from]) {
                    distance[edge.from] = distance[edge.to] + edge.weight;
                    changed = true;
                  }
                });

                if (!changed) break;
              }
              return distance;
            }

            for (let trial = 0; trial < 10; trial += 1) {
              const n = 30;
              const edges = [];

              for (let i = 0; i < 70; i += 1) {
                const a = api.rng.int(n);
                const b = api.rng.int(n);

                if (a === b) continue;
                edges.push({ from: a, to: b, weight: 1 + api.rng.int(20) });
              }
              const got = shortestPath(n, edges, 0, n - 1);
              const want = bellmanFord(n, edges, 0);

              for (let v = 0; v < n; v += 1) {
                api.assert.equal(got.distance[v], want[v],
                  'distance to ' + v + ' on trial ' + trial);
              }
            }
          }
        },
        {
          name: 'the returned path costs exactly the returned distance',
          assert: function (shortestPath, api) {
            for (let trial = 0; trial < 12; trial += 1) {
              const n = 30;
              const edges = [];

              for (let i = 0; i < 60; i += 1) {
                const a = api.rng.int(n);
                const b = api.rng.int(n);

                if (a === b) continue;
                edges.push({ from: a, to: b, weight: 1 + api.rng.int(20) });
              }
              const target = n - 1;
              const got = shortestPath(n, edges, 0, target);

              if (got.path === null) {
                api.assert.equal(got.distance[target], Infinity,
                  'a null path must mean an unreachable target');
                continue;
              }
              api.assert.equal(got.path[0], 0, 'the path starts at the source');
              api.assert.equal(got.path[got.path.length - 1], target, 'and ends at the target');
              let total = 0;

              for (let i = 0; i + 1 < got.path.length; i += 1) {
                let best = Infinity;

                edges.forEach(function (edge) {
                  const forward = edge.from === got.path[i] && edge.to === got.path[i + 1];
                  const back = edge.to === got.path[i] && edge.from === got.path[i + 1];

                  if (!forward && !back) return;
                  best = Math.min(best, edge.weight);
                });
                api.assert.ok(best < Infinity,
                  got.path[i] + '-' + got.path[i + 1] + ' is not an edge of the graph');
                total += best;
              }
              api.assert.equal(total, got.distance[target],
                'trial ' + trial + ': the path re-walks to ' + total + ' but the distance says ' +
                  got.distance[target] + ' — the parent pointer was not updated on a later improvement');
            }
          }
        },
        {
          name: 'every reachable vertex is settled exactly once',
          assert: function (shortestPath, api) {
            for (let trial = 0; trial < 6; trial += 1) {
              const n = 40;
              const edges = [];

              for (let v = 1; v < n; v += 1) {
                edges.push({ from: api.rng.int(v), to: v, weight: 1 + api.rng.int(9) });
              }
              const got = shortestPath(n, edges, 0, n - 1);

              api.assert.equal(got.settled, n,
                'the graph is connected by construction, so all ' + n + ' vertices settle once');
            }
          }
        }
      ]
    }],

    'negative-weights': [{
      id: 'negative-cycle-extraction',
      title: 'extracting the negative cycle, not merely detecting it',
      prompt: 'findNegativeCycle(n, edges) must return an array of vertices c0, c1, ... ck forming a ' +
        'DIRECTED cycle of negative total weight — every consecutive pair an edge, and ck → c0 an edge ' +
        'too — or null if no negative cycle is reachable from any vertex. Run Bellman-Ford from a ' +
        'virtual source at distance 0 to everything, and if an n-th round still improves an edge, walk ' +
        'the parent pointers back n times to land INSIDE the cycle (the vertex that improved may be ' +
        'downstream of it), then walk once more until a vertex repeats. The starter does all of that ' +
        'and returns the walk in parent order — which is the cycle traversed backwards, so every ' +
        'consecutive pair is the reverse of a real edge.',
      entry: 'findNegativeCycle',
      starter: [
        'function findNegativeCycle(n, edges) {',
        '  const distance = new Array(n).fill(0);',
        '  const parent = new Array(n).fill(-1);',
        '  let improved = -1;',
        '',
        '  for (let round = 0; round < n; round += 1) {',
        '    improved = -1;',
        '    edges.forEach(function (edge) {',
        '      if (distance[edge.from] + edge.weight >= distance[edge.to]) return;',
        '      distance[edge.to] = distance[edge.from] + edge.weight;',
        '      parent[edge.to] = edge.from;',
        '      improved = edge.to;',
        '    });',
        '    if (improved === -1) return null;',
        '  }',
        '',
        '  let at = improved;',
        '  for (let i = 0; i < n; i += 1) at = parent[at];',
        '',
        '  const walk = [];',
        '  const position = new Array(n).fill(-1);',
        '  let cursor = at;',
        '  while (position[cursor] === -1) {',
        '    position[cursor] = walk.length;',
        '    walk.push(cursor);',
        '    cursor = parent[cursor];',
        '  }',
        '  // parent order is the cycle traversed BACKWARDS',
        '  return walk.slice(position[cursor]);',
        '}'
      ].join('\n'),
      solution: [
        'function findNegativeCycle(n, edges) {',
        '  const distance = new Array(n).fill(0);',
        '  const parent = new Array(n).fill(-1);',
        '  let improved = -1;',
        '',
        '  for (let round = 0; round < n; round += 1) {',
        '    improved = -1;',
        '    edges.forEach(function (edge) {',
        '      if (distance[edge.from] + edge.weight >= distance[edge.to]) return;',
        '      distance[edge.to] = distance[edge.from] + edge.weight;',
        '      parent[edge.to] = edge.from;',
        '      improved = edge.to;',
        '    });',
        '    if (improved === -1) return null;',
        '  }',
        '',
        '  // n parent steps guarantee landing on the cycle rather than on a',
        '  // vertex merely downstream of it.',
        '  let at = improved;',
        '  for (let i = 0; i < n; i += 1) at = parent[at];',
        '',
        '  const walk = [];',
        '  const position = new Array(n).fill(-1);',
        '  let cursor = at;',
        '  while (position[cursor] === -1) {',
        '    position[cursor] = walk.length;',
        '    walk.push(cursor);',
        '    cursor = parent[cursor];',
        '  }',
        '  return walk.slice(position[cursor]).reverse();',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the returned cycle is a real cycle with negative total weight',
          assert: function (findNegativeCycle, api) {
            for (let trial = 0; trial < 10; trial += 1) {
              const n = 14;
              const edges = [];
              const seen = {};

              for (let i = 0; i < 30; i += 1) {
                const from = api.rng.int(n);
                const to = api.rng.int(n);
                const key = from + '>' + to;

                if (from === to || seen[key]) continue;
                seen[key] = true;
                edges.push({ from: from, to: to, weight: 1 + api.rng.int(9) });
              }
              /* a planted negative cycle of 3 to 5 vertices */
              const length = 3 + api.rng.int(3);
              const base = api.rng.int(n - length - 1);

              for (let i = 0; i < length; i += 1) {
                const from = base + i;
                const to = base + i + 1;

                if (seen[from + '>' + to]) {
                  edges.forEach(function (edge) {
                    if (edge.from !== from || edge.to !== to) return;
                    edge.weight = 1;
                  });
                } else {
                  seen[from + '>' + to] = true;
                  edges.push({ from: from, to: to, weight: 1 });
                }
              }
              const closing = { from: base + length, to: base, weight: -(length + 5) };

              if (seen[closing.from + '>' + closing.to]) {
                edges.forEach(function (edge) {
                  if (edge.from !== closing.from || edge.to !== closing.to) return;
                  edge.weight = closing.weight;
                });
              } else edges.push(closing);

              const cycle = findNegativeCycle(n, edges);
              api.assert.ok(cycle && cycle.length >= 2,
                'trial ' + trial + ': a negative cycle exists and must be returned');

              let total = 0;

              cycle.forEach(function (v, i) {
                const w = cycle[(i + 1) % cycle.length];
                let best = Infinity;

                edges.forEach(function (edge) {
                  if (edge.from !== v || edge.to !== w) return;
                  best = Math.min(best, edge.weight);
                });
                api.assert.ok(best < Infinity,
                  v + ' -> ' + w + ' is not an edge, so the reported cycle is not a cycle ' +
                    '(a parent walk returned in parent order is the cycle backwards)');
                total += best;
              });
              api.assert.ok(total < 0,
                'trial ' + trial + ': the cycle totals ' + total + ', which is not negative');
            }
          }
        },
        {
          name: 'a graph with no negative cycle returns null',
          assert: function (findNegativeCycle, api) {
            for (let trial = 0; trial < 8; trial += 1) {
              const n = 20;
              const edges = [];
              const potential = [];

              for (let v = 0; v < n; v += 1) potential.push(api.rng.int(16));
              const seen = {};

              for (let i = 0; i < 60; i += 1) {
                const from = api.rng.int(n);
                const to = api.rng.int(n);
                const key = from + '>' + to;

                if (from === to || seen[key]) continue;
                seen[key] = true;
                /* w = base - p[u] + p[v] makes edges negative and every cycle
                   still totals the sum of its bases, which is positive. */
                edges.push({ from: from, to: to,
                  weight: 1 + api.rng.int(20) - potential[from] + potential[to] });
              }
              api.assert.equal(findNegativeCycle(n, edges), null,
                'trial ' + trial + ': negative edges exist but no cycle can be negative');
            }
          }
        },
        {
          name: 'a three-vertex negative cycle comes back in edge direction',
          assert: function (findNegativeCycle, api) {
            const edges = [
              { from: 0, to: 1, weight: 1 },
              { from: 1, to: 2, weight: 1 },
              { from: 2, to: 0, weight: -5 },
              { from: 2, to: 3, weight: 4 }
            ];
            const cycle = findNegativeCycle(4, edges);

            api.assert.equal(cycle.length, 3, 'the cycle is 0, 1, 2 and nothing else');
            const present = {};

            edges.forEach(function (edge) { present[edge.from + '>' + edge.to] = true; });
            cycle.forEach(function (v, i) {
              const w = cycle[(i + 1) % cycle.length];

              api.assert.ok(present[v + '>' + w],
                v + ' -> ' + w + ' is not an edge — the walk was returned in parent order, ' +
                  'which traverses the cycle backwards');
            });
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));

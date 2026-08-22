/**
 * Graded exercises for the first graph sections (M13.1-M13.3).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'graph-representations': [{
      id: 'iterative-dfs-classification',
      title: 'iterative depth-first search with correct edge classification',
      prompt: 'classifyEdges(n, edges) must return { tree, back, forward, cross, maxDepth } for a ' +
        'DIRECTED graph given as an array of { from, to }. An edge (u, v) is a TREE edge if v is ' +
        'undiscovered, a BACK edge if v is discovered and not yet finished (still on the stack), a ' +
        'FORWARD edge if v is finished and was discovered after u, and a CROSS edge if v is finished ' +
        'and was discovered before u. The starter walks iteratively — which is what stops a long chain ' +
        'overflowing the stack — but calls every non-tree edge a back edge, which conflates "this is a ' +
        'cycle" with "I have been here before". Keep three colours and a discovery time per vertex, and ' +
        'report maxDepth as the largest number of frames held at once. Start a new search from every ' +
        'undiscovered vertex, so a disconnected graph is fully classified.',
      entry: 'classifyEdges',
      starter: [
        'function classifyEdges(n, edges) {',
        '  const adjacency = [];',
        '  for (let v = 0; v < n; v += 1) adjacency.push([]);',
        '  edges.forEach(function (edge) { adjacency[edge.from].push(edge.to); });',
        '',
        '  const seen = new Array(n).fill(false);',
        '  const counts = { tree: 0, back: 0, forward: 0, cross: 0 };',
        '  let maxDepth = 0;',
        '',
        '  for (let source = 0; source < n; source += 1) {',
        '    if (seen[source]) continue;',
        '    seen[source] = true;',
        '    const frames = [{ node: source, cursor: 0 }];',
        '',
        '    while (frames.length) {',
        '      if (frames.length > maxDepth) maxDepth = frames.length;',
        '      const frame = frames[frames.length - 1];',
        '',
        '      if (frame.cursor >= adjacency[frame.node].length) { frames.pop(); continue; }',
        '      const to = adjacency[frame.node][frame.cursor];',
        '      frame.cursor += 1;',
        '',
        '      if (!seen[to]) {',
        '        counts.tree += 1;',
        '        seen[to] = true;',
        '        frames.push({ node: to, cursor: 0 });',
        '        continue;',
        '      }',
        '      // everything already seen is called a back edge, which is wrong',
        '      counts.back += 1;',
        '    }',
        '  }',
        '  return { tree: counts.tree, back: counts.back, forward: counts.forward,',
        '    cross: counts.cross, maxDepth: maxDepth };',
        '}'
      ].join('\n'),
      solution: [
        'function classifyEdges(n, edges) {',
        '  const adjacency = [];',
        '  for (let v = 0; v < n; v += 1) adjacency.push([]);',
        '  edges.forEach(function (edge) { adjacency[edge.from].push(edge.to); });',
        '',
        '  const WHITE = 0;',
        '  const GREY = 1;',
        '  const BLACK = 2;',
        '  const colour = new Array(n).fill(WHITE);',
        '  const discovered = new Array(n).fill(-1);',
        '  const counts = { tree: 0, back: 0, forward: 0, cross: 0 };',
        '  let timer = 0;',
        '  let maxDepth = 0;',
        '',
        '  for (let source = 0; source < n; source += 1) {',
        '    if (colour[source] !== WHITE) continue;',
        '    colour[source] = GREY;',
        '    discovered[source] = timer;',
        '    timer += 1;',
        '    const frames = [{ node: source, cursor: 0 }];',
        '',
        '    while (frames.length) {',
        '      if (frames.length > maxDepth) maxDepth = frames.length;',
        '      const frame = frames[frames.length - 1];',
        '      const from = frame.node;',
        '',
        '      if (frame.cursor >= adjacency[from].length) {',
        '        colour[from] = BLACK;',
        '        frames.pop();',
        '        continue;',
        '      }',
        '      const to = adjacency[from][frame.cursor];',
        '      frame.cursor += 1;',
        '',
        '      if (colour[to] === WHITE) {',
        '        counts.tree += 1;',
        '        colour[to] = GREY;',
        '        discovered[to] = timer;',
        '        timer += 1;',
        '        frames.push({ node: to, cursor: 0 });',
        '        continue;',
        '      }',
        '',
        '      if (colour[to] === GREY) { counts.back += 1; continue; }',
        '',
        '      if (discovered[from] < discovered[to]) { counts.forward += 1; continue; }',
        '      counts.cross += 1;',
        '    }',
        '  }',
        '  return { tree: counts.tree, back: counts.back, forward: counts.forward,',
        '    cross: counts.cross, maxDepth: maxDepth };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the four classes match a recursive reference on random digraphs',
          assert: function (classifyEdges, api) {
            function reference(n, edges) {
              const adjacency = [];

              for (let v = 0; v < n; v += 1) adjacency.push([]);
              edges.forEach(function (edge) { adjacency[edge.from].push(edge.to); });
              const colour = new Array(n).fill(0);
              const discovered = new Array(n).fill(-1);
              const counts = { tree: 0, back: 0, forward: 0, cross: 0 };
              let timer = 0;

              function visit(from) {
                colour[from] = 1;
                discovered[from] = timer;
                timer += 1;
                adjacency[from].forEach(function (to) {
                  if (colour[to] === 0) { counts.tree += 1; visit(to); return; }

                  if (colour[to] === 1) { counts.back += 1; return; }

                  if (discovered[from] < discovered[to]) { counts.forward += 1; return; }
                  counts.cross += 1;
                });
                colour[from] = 2;
              }

              for (let v = 0; v < n; v += 1) {
                if (colour[v] !== 0) continue;
                visit(v);
              }
              return counts;
            }

            for (let trial = 0; trial < 12; trial += 1) {
              const n = 25;
              const edges = [];
              const seen = {};

              for (let i = 0; i < 70; i += 1) {
                const from = api.rng.int(n);
                const to = api.rng.int(n);
                const key = from + '>' + to;

                if (from === to || seen[key]) continue;
                seen[key] = true;
                edges.push({ from: from, to: to });
              }
              const got = classifyEdges(n, edges);
              const want = reference(n, edges);

              api.assert.equal(got.tree, want.tree, 'tree edges, trial ' + trial);
              api.assert.equal(got.back, want.back, 'back edges, trial ' + trial);
              api.assert.equal(got.forward, want.forward, 'forward edges, trial ' + trial);
              api.assert.equal(got.cross, want.cross, 'cross edges, trial ' + trial);
            }
          }
        },
        {
          name: 'every edge is classified exactly once',
          assert: function (classifyEdges, api) {
            for (let trial = 0; trial < 8; trial += 1) {
              const n = 30;
              const edges = [];
              const seen = {};

              for (let i = 0; i < 90; i += 1) {
                const from = api.rng.int(n);
                const to = api.rng.int(n);
                const key = from + '>' + to;

                if (from === to || seen[key]) continue;
                seen[key] = true;
                edges.push({ from: from, to: to });
              }
              const got = classifyEdges(n, edges);

              api.assert.equal(got.tree + got.back + got.forward + got.cross, edges.length,
                'the four classes must partition the ' + edges.length + ' edges, trial ' + trial);
            }
          }
        },
        {
          name: 'a chain of 60 000 vertices does not overflow the stack',
          assert: function (classifyEdges, api) {
            const n = 60000;
            const edges = [];

            for (let v = 1; v < n; v += 1) edges.push({ from: v - 1, to: v });
            const got = classifyEdges(n, edges);

            api.assert.equal(got.tree, n - 1, 'every edge of a chain is a tree edge');
            api.assert.equal(got.back + got.forward + got.cross, 0, 'a chain has no non-tree edge');
            api.assert.equal(got.maxDepth, n, 'the frame count is the chain length — that is the point');
          }
        },
        {
          name: 'a directed triangle with a chord shows all four classes',
          assert: function (classifyEdges, api) {
            /* 0->1->2->3, plus 3->1 (back), 0->2 (forward) and a separate
               component 4->5 with 5 reached again from 3 (cross). */
            const edges = [
              { from: 0, to: 1 }, { from: 1, to: 2 }, { from: 2, to: 3 },
              { from: 3, to: 1 }, { from: 0, to: 2 }, { from: 0, to: 4 },
              { from: 4, to: 5 }, { from: 3, to: 5 }
            ];
            const got = classifyEdges(6, edges);

            api.assert.equal(got.back, 1, '3->1 is the only back edge');
            api.assert.equal(got.forward, 1, '0->2 is the only forward edge');
            api.assert.equal(got.cross, 1, '3->5 points into a finished subtree');
            api.assert.equal(got.tree, 5, 'the rest are tree edges');
          }
        }
      ]
    }],

    'topological-order': [{
      id: 'kahn-with-cycle-extraction',
      title: 'a topological order, or the cycle that blocks it',
      prompt: 'topologicalOrder(n, edges) must return { order, cycle }. On an acyclic graph, `order` is ' +
        'an array of all n vertices with every edge pointing forwards, and `cycle` is null. On a cyclic ' +
        'graph, `order` is null and `cycle` is an array of vertices c0, c1, ... ck such that every ' +
        'consecutive pair IS a real edge and ck also has an edge back to c0. The starter runs Kahn\'s ' +
        'algorithm correctly and returns null for the cycle, which is the error message this section is ' +
        'about: the caller already suspected the answer. When the ready set empties with vertices left ' +
        'over, every remaining vertex still has an unmet dependency inside the remaining set — so ' +
        'following predecessors from any of them must repeat a vertex, and the repeated segment is ' +
        'the cycle.',
      entry: 'topologicalOrder',
      starter: [
        'function topologicalOrder(n, edges) {',
        '  const adjacency = [];',
        '  const indegree = new Array(n).fill(0);',
        '  for (let v = 0; v < n; v += 1) adjacency.push([]);',
        '  edges.forEach(function (edge) {',
        '    adjacency[edge.from].push(edge.to);',
        '    indegree[edge.to] += 1;',
        '  });',
        '',
        '  const ready = [];',
        '  for (let v = 0; v < n; v += 1) {',
        '    if (indegree[v] === 0) ready.push(v);',
        '  }',
        '',
        '  const order = [];',
        '  while (ready.length) {',
        '    const v = ready.pop();',
        '    order.push(v);',
        '    adjacency[v].forEach(function (to) {',
        '      indegree[to] -= 1;',
        '      if (indegree[to] === 0) ready.push(to);',
        '    });',
        '  }',
        '',
        '  if (order.length === n) return { order: order, cycle: null };',
        '  // a cycle blocked it, and we throw the evidence away',
        '  return { order: null, cycle: null };',
        '}'
      ].join('\n'),
      solution: [
        'function topologicalOrder(n, edges) {',
        '  const adjacency = [];',
        '  const incoming = [];',
        '  const indegree = new Array(n).fill(0);',
        '  for (let v = 0; v < n; v += 1) { adjacency.push([]); incoming.push([]); }',
        '  edges.forEach(function (edge) {',
        '    adjacency[edge.from].push(edge.to);',
        '    incoming[edge.to].push(edge.from);',
        '    indegree[edge.to] += 1;',
        '  });',
        '',
        '  const ready = [];',
        '  for (let v = 0; v < n; v += 1) {',
        '    if (indegree[v] === 0) ready.push(v);',
        '  }',
        '',
        '  const order = [];',
        '  const placed = new Array(n).fill(false);',
        '  while (ready.length) {',
        '    const v = ready.pop();',
        '    order.push(v);',
        '    placed[v] = true;',
        '    adjacency[v].forEach(function (to) {',
        '      indegree[to] -= 1;',
        '      if (indegree[to] === 0) ready.push(to);',
        '    });',
        '  }',
        '',
        '  if (order.length === n) return { order: order, cycle: null };',
        '',
        '  // Every unplaced vertex still has an unmet dependency among the',
        '  // unplaced ones, so walking predecessors must repeat a vertex.',
        '  let at = -1;',
        '  for (let v = 0; v < n; v += 1) {',
        '    if (!placed[v]) { at = v; break; }',
        '  }',
        '',
        '  const position = new Array(n).fill(-1);',
        '  const walk = [];',
        '  while (position[at] === -1) {',
        '    position[at] = walk.length;',
        '    walk.push(at);',
        '    let next = -1;',
        '    for (let i = 0; i < incoming[at].length; i += 1) {',
        '      if (placed[incoming[at][i]]) continue;',
        '      next = incoming[at][i];',
        '      break;',
        '    }',
        '    at = next;',
        '  }',
        '',
        '  // walk holds predecessors, so reversing the repeated segment puts',
        '  // the cycle back into edge direction.',
        '  const cycle = walk.slice(position[at]).reverse();',
        '  return { order: null, cycle: cycle };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'every edge points forwards in the returned order',
          assert: function (topologicalOrder, api) {
            for (let trial = 0; trial < 10; trial += 1) {
              const n = 40;
              const edges = [];
              const seen = {};

              for (let i = 0; i < 90; i += 1) {
                const a = api.rng.int(n);
                const b = api.rng.int(n);

                if (a === b) continue;
                const from = Math.min(a, b);
                const to = Math.max(a, b);
                const key = from + '>' + to;

                if (seen[key]) continue;
                seen[key] = true;
                edges.push({ from: from, to: to });
              }
              const run = topologicalOrder(n, edges);

              api.assert.equal(run.cycle, null, 'this graph is acyclic by construction');
              api.assert.equal(run.order.length, n, 'every vertex placed, trial ' + trial);
              const position = new Array(n).fill(-1);

              run.order.forEach(function (v, i) { position[v] = i; });
              edges.forEach(function (edge) {
                api.assert.ok(position[edge.from] < position[edge.to],
                  'edge ' + edge.from + '->' + edge.to + ' points backwards in the order');
              });
            }
          }
        },
        {
          name: 'a cyclic graph yields a genuine cycle, verified edge by edge',
          assert: function (topologicalOrder, api) {
            for (let trial = 0; trial < 10; trial += 1) {
              const n = 30;
              const edges = [];
              const seen = {};

              for (let i = 0; i < 50; i += 1) {
                const a = api.rng.int(n);
                const b = api.rng.int(n);

                if (a === b) continue;
                const key = Math.min(a, b) + '>' + Math.max(a, b);

                if (seen[key]) continue;
                seen[key] = true;
                edges.push({ from: Math.min(a, b), to: Math.max(a, b) });
              }
              /* one back edge, which is the only way a cycle appears here */
              const length = 3 + api.rng.int(5);
              const base = api.rng.int(n - length - 1);

              for (let i = 0; i < length; i += 1) {
                edges.push({ from: base + i, to: base + i + 1 });
              }
              edges.push({ from: base + length, to: base });

              const run = topologicalOrder(n, edges);
              api.assert.equal(run.order, null, 'no order can exist, trial ' + trial);
              api.assert.ok(run.cycle && run.cycle.length >= 2,
                'the cycle must be returned, not null — that is the whole exercise');

              const present = {};
              edges.forEach(function (edge) { present[edge.from + '>' + edge.to] = true; });
              run.cycle.forEach(function (v, i) {
                const w = run.cycle[(i + 1) % run.cycle.length];

                api.assert.ok(present[v + '>' + w],
                  v + '->' + w + ' is not an edge, so the reported cycle is not a cycle');
              });
            }
          }
        },
        {
          name: 'a two-vertex cycle is reported as two vertices',
          assert: function (topologicalOrder, api) {
            const run = topologicalOrder(4, [
              { from: 0, to: 1 }, { from: 1, to: 2 }, { from: 2, to: 1 }, { from: 2, to: 3 }
            ]);

            api.assert.equal(run.order, null, 'the graph is cyclic');
            api.assert.equal(run.cycle.length, 2, 'the cycle is exactly 1 and 2');
            const sorted = run.cycle.slice().sort(function (a, b) { return a - b; });

            api.assert.deepEqual(sorted, [1, 2], 'the cycle must be {1, 2}, not a path into it');
          }
        }
      ]
    }],

    'strongly-connected': [{
      id: 'tarjan-components',
      title: 'strongly connected components in one pass',
      prompt: 'stronglyConnected(n, edges) must return an array `component` of length n, where ' +
        'component[u] === component[v] exactly when u and v can reach each other along directed edges. ' +
        'The ids themselves are arbitrary — only the grouping is the answer, and the tests compare ' +
        'partitions rather than labels. The starter returns WEAKLY connected components: it ignores ' +
        'edge direction entirely, which produces a plausible partition that is wrong on every graph ' +
        'with a one-way edge. Implement Tarjan: a depth-first walk with a discovery index, a lowlink ' +
        'that may follow an edge to any vertex still on the component stack, and a pop when ' +
        'lowlink equals index. Walk iteratively — a chain of 100 000 vertices is a legitimate input.',
      entry: 'stronglyConnected',
      starter: [
        'function stronglyConnected(n, edges) {',
        '  const parent = new Array(n);',
        '  for (let v = 0; v < n; v += 1) parent[v] = v;',
        '',
        '  function find(v) {',
        '    while (parent[v] !== v) { parent[v] = parent[parent[v]]; v = parent[v]; }',
        '    return v;',
        '  }',
        '',
        '  // direction ignored, so this is weak connectivity, not strong',
        '  edges.forEach(function (edge) {',
        '    const a = find(edge.from);',
        '    const b = find(edge.to);',
        '    if (a !== b) parent[a] = b;',
        '  });',
        '',
        '  const label = {};',
        '  const component = new Array(n).fill(-1);',
        '  let next = 0;',
        '  for (let v = 0; v < n; v += 1) {',
        '    const rootOf = find(v);',
        '    if (label[rootOf] === undefined) { label[rootOf] = next; next += 1; }',
        '    component[v] = label[rootOf];',
        '  }',
        '  return component;',
        '}'
      ].join('\n'),
      solution: [
        'function stronglyConnected(n, edges) {',
        '  const adjacency = [];',
        '  for (let v = 0; v < n; v += 1) adjacency.push([]);',
        '  edges.forEach(function (edge) { adjacency[edge.from].push(edge.to); });',
        '',
        '  const index = new Array(n).fill(-1);',
        '  const low = new Array(n).fill(0);',
        '  const onStack = new Array(n).fill(false);',
        '  const component = new Array(n).fill(-1);',
        '  const pending = [];',
        '  let counter = 0;',
        '  let components = 0;',
        '',
        '  for (let source = 0; source < n; source += 1) {',
        '    if (index[source] !== -1) continue;',
        '    index[source] = counter;',
        '    low[source] = counter;',
        '    counter += 1;',
        '    pending.push(source);',
        '    onStack[source] = true;',
        '    const frames = [{ node: source, cursor: 0 }];',
        '',
        '    while (frames.length) {',
        '      const frame = frames[frames.length - 1];',
        '      const v = frame.node;',
        '',
        '      if (frame.cursor < adjacency[v].length) {',
        '        const w = adjacency[v][frame.cursor];',
        '        frame.cursor += 1;',
        '',
        '        if (index[w] === -1) {',
        '          index[w] = counter;',
        '          low[w] = counter;',
        '          counter += 1;',
        '          pending.push(w);',
        '          onStack[w] = true;',
        '          frames.push({ node: w, cursor: 0 });',
        '          continue;',
        '        }',
        '',
        '        if (onStack[w] && index[w] < low[v]) low[v] = index[w];',
        '        continue;',
        '      }',
        '      frames.pop();',
        '',
        '      if (frames.length) {',
        '        const above = frames[frames.length - 1].node;',
        '        if (low[v] < low[above]) low[above] = low[v];',
        '      }',
        '',
        '      if (low[v] !== index[v]) continue;',
        '      let w = -1;',
        '      do {',
        '        w = pending.pop();',
        '        onStack[w] = false;',
        '        component[w] = components;',
        '      } while (w !== v);',
        '      components += 1;',
        '    }',
        '  }',
        '  return component;',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the partition matches mutual reachability computed by brute force',
          assert: function (stronglyConnected, api) {
            function reachable(n, edges, source) {
              const adjacency = [];

              for (let v = 0; v < n; v += 1) adjacency.push([]);
              edges.forEach(function (edge) { adjacency[edge.from].push(edge.to); });
              const seen = new Array(n).fill(false);
              const queue = [source];

              seen[source] = true;

              while (queue.length) {
                const v = queue.shift();

                adjacency[v].forEach(function (to) {
                  if (seen[to]) return;
                  seen[to] = true;
                  queue.push(to);
                });
              }
              return seen;
            }

            for (let trial = 0; trial < 8; trial += 1) {
              const n = 22;
              const edges = [];
              const seenEdge = {};

              for (let i = 0; i < 55; i += 1) {
                const from = api.rng.int(n);
                const to = api.rng.int(n);
                const key = from + '>' + to;

                if (from === to || seenEdge[key]) continue;
                seenEdge[key] = true;
                edges.push({ from: from, to: to });
              }
              const component = stronglyConnected(n, edges);
              const reach = [];

              for (let v = 0; v < n; v += 1) reach.push(reachable(n, edges, v));

              for (let u = 0; u < n; u += 1) {
                for (let v = 0; v < n; v += 1) {
                  const mutual = reach[u][v] && reach[v][u];

                  api.assert.equal(component[u] === component[v], mutual,
                    'vertices ' + u + ' and ' + v + ' — mutual reachability is ' + mutual +
                      ' but the components say ' + (component[u] === component[v]) +
                      ' (trial ' + trial + ')');
                }
              }
            }
          }
        },
        {
          name: 'a vertex on no cycle is its own component',
          assert: function (stronglyConnected, api) {
            /* 0->1->2->0 is a cycle; 3 and 4 form a one-way chain out of it. */
            const component = stronglyConnected(5, [
              { from: 0, to: 1 }, { from: 1, to: 2 }, { from: 2, to: 0 },
              { from: 2, to: 3 }, { from: 3, to: 4 }
            ]);

            api.assert.equal(component[0], component[1], '0 and 1 are on a cycle together');
            api.assert.equal(component[1], component[2], '1 and 2 are on a cycle together');
            api.assert.notEqual(component[2], component[3], '3 cannot reach back to 2');
            api.assert.notEqual(component[3], component[4], '4 cannot reach back to 3');
          }
        },
        {
          name: 'the condensation is acyclic',
          assert: function (stronglyConnected, api) {
            for (let trial = 0; trial < 6; trial += 1) {
              const n = 26;
              const edges = [];
              const seenEdge = {};

              for (let i = 0; i < 60; i += 1) {
                const from = api.rng.int(n);
                const to = api.rng.int(n);
                const key = from + '>' + to;

                if (from === to || seenEdge[key]) continue;
                seenEdge[key] = true;
                edges.push({ from: from, to: to });
              }
              const component = stronglyConnected(n, edges);
              let count = 0;

              component.forEach(function (c) { count = Math.max(count, c + 1); });
              const indegree = new Array(count).fill(0);
              const out = [];

              for (let c = 0; c < count; c += 1) out.push([]);
              const seenPair = {};

              edges.forEach(function (edge) {
                const a = component[edge.from];
                const b = component[edge.to];

                if (a === b || seenPair[a + '>' + b]) return;
                seenPair[a + '>' + b] = true;
                out[a].push(b);
                indegree[b] += 1;
              });
              const ready = [];

              for (let c = 0; c < count; c += 1) {
                if (indegree[c] === 0) ready.push(c);
              }
              let placed = 0;

              while (ready.length) {
                const c = ready.pop();

                placed += 1;
                out[c].forEach(function (d) {
                  indegree[d] -= 1;

                  if (indegree[d] === 0) ready.push(d);
                });
              }
              api.assert.equal(placed, count,
                'the condensation must be a DAG; only ' + placed + ' of ' + count +
                  ' components could be placed (trial ' + trial + ')');
            }
          }
        },
        {
          name: 'a chain of 100 000 vertices does not overflow the stack',
          assert: function (stronglyConnected, api) {
            const n = 100000;
            const edges = [];

            for (let v = 1; v < n; v += 1) edges.push({ from: v - 1, to: v });
            const component = stronglyConnected(n, edges);
            const distinct = {};

            component.forEach(function (c) { distinct[c] = true; });
            api.assert.equal(Object.keys(distinct).length, n,
              'a one-way chain has no cycles, so every vertex is its own component');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));

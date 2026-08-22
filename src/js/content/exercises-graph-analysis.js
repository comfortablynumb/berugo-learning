/**
 * Graded exercises for colouring, layout and spectral methods (M14.8-M14.10).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'graph-coloring': [{
      id: 'degeneracy-ordering',
      title: 'Smallest-last, and the bound it is supposed to carry',
      prompt: 'degeneracyColouring(adjacency) must return { order, degeneracy, colour, colours } ' +
        'for an undirected graph given as an array of neighbour lists. Build the order by ' +
        'repeatedly removing a vertex of MINIMUM CURRENT degree — recording the degree it had when ' +
        'removed — then colour greedily in the REVERSE of that removal order, giving each vertex ' +
        'the lowest colour none of its already-coloured neighbours holds. `degeneracy` is the ' +
        'largest degree seen at removal, and the colouring must use at most degeneracy + 1 colours. ' +
        'The starter removes the minimum-degree vertex by ORIGINAL degree rather than current, which ' +
        'is a different order with a different — and larger — bound.',
      entry: 'degeneracyColouring',
      starter: [
        'function degeneracyColouring(adjacency) {',
        '  const n = adjacency.length;',
        '  const removed = new Array(n).fill(false);',
        '  const order = [];',
        '  let degeneracy = 0;',
        '',
        '  for (let step = 0; step < n; step += 1) {',
        '    let pick = -1;',
        '    for (let v = 0; v < n; v += 1) {',
        '      if (removed[v]) continue;',
        '      // the ORIGINAL degree, which never falls as neighbours are removed',
        '      if (pick === -1 || adjacency[v].length < adjacency[pick].length) pick = v;',
        '    }',
        '    let live = 0;',
        '    adjacency[pick].forEach(function (u) { if (!removed[u]) live += 1; });',
        '    degeneracy = Math.max(degeneracy, live);',
        '    removed[pick] = true;',
        '    order.push(pick);',
        '  }',
        '  order.reverse();',
        '',
        '  const colour = new Array(n).fill(-1);',
        '  order.forEach(function (v) {',
        '    const taken = {};',
        '    adjacency[v].forEach(function (u) { if (colour[u] !== -1) taken[colour[u]] = true; });',
        '    let pick = 0;',
        '    while (taken[pick]) pick += 1;',
        '    colour[v] = pick;',
        '  });',
        '  const used = {};',
        '  colour.forEach(function (c) { used[c] = true; });',
        '  return { order: order, degeneracy: degeneracy, colour: colour,',
        '    colours: Object.keys(used).length };',
        '}'
      ].join('\n'),
      solution: [
        'function degeneracyColouring(adjacency) {',
        '  const n = adjacency.length;',
        '  const removed = new Array(n).fill(false);',
        '  const degree = adjacency.map(function (list) { return list.length; });',
        '  const order = [];',
        '  let degeneracy = 0;',
        '',
        '  for (let step = 0; step < n; step += 1) {',
        '    let pick = -1;',
        '    for (let v = 0; v < n; v += 1) {',
        '      if (removed[v]) continue;',
        '      // the CURRENT degree, which falls as neighbours are removed',
        '      if (pick === -1 || degree[v] < degree[pick]) pick = v;',
        '    }',
        '    degeneracy = Math.max(degeneracy, degree[pick]);',
        '    removed[pick] = true;',
        '    adjacency[pick].forEach(function (u) { if (!removed[u]) degree[u] -= 1; });',
        '    order.push(pick);',
        '  }',
        '  order.reverse();',
        '',
        '  const colour = new Array(n).fill(-1);',
        '  order.forEach(function (v) {',
        '    const taken = {};',
        '    adjacency[v].forEach(function (u) { if (colour[u] !== -1) taken[colour[u]] = true; });',
        '    let pick = 0;',
        '    while (taken[pick]) pick += 1;',
        '    colour[v] = pick;',
        '  });',
        '  const used = {};',
        '  colour.forEach(function (c) { used[c] = true; });',
        '  return { order: order, degeneracy: degeneracy, colour: colour,',
        '    colours: Object.keys(used).length };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the colouring is proper and uses at most degeneracy + 1 colours',
          assert: function (degeneracyColouring, api) {
            for (let trial = 0; trial < 12; trial += 1) {
              const n = 24;
              const adjacency = [];
              const seen = {};

              for (let v = 0; v < n; v += 1) adjacency.push([]);

              for (let i = 0; i < 60; i += 1) {
                const a = api.rng.int(n);
                const b = api.rng.int(n);
                const key = Math.min(a, b) + '-' + Math.max(a, b);

                if (a === b || seen[key]) continue;
                seen[key] = true;
                adjacency[a].push(b);
                adjacency[b].push(a);
              }
              const got = degeneracyColouring(adjacency);

              adjacency.forEach(function (list, v) {
                list.forEach(function (u) {
                  api.assert.notEqual(got.colour[v], got.colour[u],
                    'vertices ' + v + ' and ' + u + ' are adjacent and share colour ' + got.colour[v]);
                });
              });
              api.assert.ok(got.colours <= got.degeneracy + 1,
                'trial ' + trial + ': ' + got.colours + ' colours against a degeneracy of ' +
                  got.degeneracy + '; smallest-last order is what makes the bound hold, and ' +
                  'the degree has to be the CURRENT one');
            }
          }
        },
        {
          name: 'the degeneracy matches a direct computation',
          assert: function (degeneracyColouring, api) {
            function trueDegeneracy(adjacency) {
              const n = adjacency.length;
              const degree = adjacency.map(function (list) { return list.length; });
              const gone = new Array(n).fill(false);
              let worst = 0;

              for (let step = 0; step < n; step += 1) {
                let pick = -1;

                for (let v = 0; v < n; v += 1) {
                  if (gone[v]) continue;

                  if (pick === -1 || degree[v] < degree[pick]) pick = v;
                }
                worst = Math.max(worst, degree[pick]);
                gone[pick] = true;
                adjacency[pick].forEach(function (u) { if (!gone[u]) degree[u] -= 1; });
              }
              return worst;
            }

            for (let trial = 0; trial < 10; trial += 1) {
              const n = 20;
              const adjacency = [];
              const seen = {};

              for (let v = 0; v < n; v += 1) adjacency.push([]);

              for (let i = 0; i < 45; i += 1) {
                const a = api.rng.int(n);
                const b = api.rng.int(n);
                const key = Math.min(a, b) + '-' + Math.max(a, b);

                if (a === b || seen[key]) continue;
                seen[key] = true;
                adjacency[a].push(b);
                adjacency[b].push(a);
              }
              api.assert.equal(degeneracyColouring(adjacency).degeneracy, trueDegeneracy(adjacency),
                'trial ' + trial + ': the degeneracy is the largest CURRENT degree at removal');
            }
          }
        },
        {
          name: 'a star of 30 leaves has degeneracy 1 and takes 2 colours, not 31',
          assert: function (degeneracyColouring, api) {
            const n = 31;
            const adjacency = [];

            for (let v = 0; v < n; v += 1) adjacency.push([]);

            for (let v = 1; v < n; v += 1) {
              adjacency[0].push(v);
              adjacency[v].push(0);
            }
            const got = degeneracyColouring(adjacency);

            api.assert.equal(got.degeneracy, 1,
              'every leaf is removed at degree 1 and the hub is removed last at degree 0');
            api.assert.equal(got.colours, 2,
              'the hub is coloured first in the reversed order, so all 30 leaves share one colour; ' +
                'the maximum degree here is 30, which is why the Δ + 1 bound is nearly useless');
          }
        }
      ]
    }],

    'graph-layout': [{
      id: 'force-step',
      title: 'One Fruchterman-Reingold iteration, and the cap that makes it terminate',
      prompt: 'forceStep(positions, edges, k, temperature) must return a NEW array of positions ' +
        'after one Fruchterman-Reingold iteration, leaving the input untouched. Every ordered pair ' +
        'of distinct vertices repels with magnitude `k·k/d` along the vector between them; every ' +
        'edge attracts its endpoints with magnitude `d·d/k`; then each vertex moves along its net ' +
        'displacement by `min(|displacement|, temperature)`. The cap is the whole of the ' +
        'termination argument: without it a pair that starts very close repels with unbounded force ' +
        'and the layout explodes. The starter applies the displacement directly, which is what ' +
        'everybody writes first.',
      entry: 'forceStep',
      starter: [
        'function forceStep(positions, edges, k, temperature) {',
        '  const n = positions.length;',
        '  const push = positions.map(function () { return { x: 0, y: 0 }; });',
        '',
        '  for (let v = 0; v < n; v += 1) {',
        '    for (let w = 0; w < n; w += 1) {',
        '      if (v === w) continue;',
        '      const dx = positions[v].x - positions[w].x;',
        '      const dy = positions[v].y - positions[w].y;',
        '      const d = Math.max(1e-9, Math.sqrt(dx * dx + dy * dy));',
        '      const force = (k * k) / d;',
        '      push[v].x += (dx / d) * force;',
        '      push[v].y += (dy / d) * force;',
        '    }',
        '  }',
        '  edges.forEach(function (edge) {',
        '    const dx = positions[edge.from].x - positions[edge.to].x;',
        '    const dy = positions[edge.from].y - positions[edge.to].y;',
        '    const d = Math.max(1e-9, Math.sqrt(dx * dx + dy * dy));',
        '    const force = (d * d) / k;',
        '    push[edge.from].x -= (dx / d) * force;',
        '    push[edge.from].y -= (dy / d) * force;',
        '    push[edge.to].x += (dx / d) * force;',
        '    push[edge.to].y += (dy / d) * force;',
        '  });',
        '',
        '  // move by the whole displacement; the temperature is surely just a scale',
        '  return positions.map(function (point, v) {',
        '    return { x: point.x + push[v].x, y: point.y + push[v].y };',
        '  });',
        '}'
      ].join('\n'),
      solution: [
        'function forceStep(positions, edges, k, temperature) {',
        '  const n = positions.length;',
        '  const push = positions.map(function () { return { x: 0, y: 0 }; });',
        '',
        '  for (let v = 0; v < n; v += 1) {',
        '    for (let w = 0; w < n; w += 1) {',
        '      if (v === w) continue;',
        '      const dx = positions[v].x - positions[w].x;',
        '      const dy = positions[v].y - positions[w].y;',
        '      const d = Math.max(1e-9, Math.sqrt(dx * dx + dy * dy));',
        '      const force = (k * k) / d;',
        '      push[v].x += (dx / d) * force;',
        '      push[v].y += (dy / d) * force;',
        '    }',
        '  }',
        '  edges.forEach(function (edge) {',
        '    const dx = positions[edge.from].x - positions[edge.to].x;',
        '    const dy = positions[edge.from].y - positions[edge.to].y;',
        '    const d = Math.max(1e-9, Math.sqrt(dx * dx + dy * dy));',
        '    const force = (d * d) / k;',
        '    push[edge.from].x -= (dx / d) * force;',
        '    push[edge.from].y -= (dy / d) * force;',
        '    push[edge.to].x += (dx / d) * force;',
        '    push[edge.to].y += (dy / d) * force;',
        '  });',
        '',
        '  return positions.map(function (point, v) {',
        '    const length = Math.max(1e-9, Math.sqrt(push[v].x * push[v].x + push[v].y * push[v].y));',
        '    // the cap IS the termination argument',
        '    const move = Math.min(length, temperature);',
        '    return { x: point.x + (push[v].x / length) * move,',
        '      y: point.y + (push[v].y / length) * move };',
        '  });',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'no vertex moves further than the temperature, and the input is untouched',
          assert: function (forceStep, api) {
            for (let trial = 0; trial < 8; trial += 1) {
              const n = 12;
              const positions = [];

              for (let v = 0; v < n; v += 1) {
                positions.push({ x: api.rng.next() * 2 - 1, y: api.rng.next() * 2 - 1 });
              }
              const before = positions.map(function (p) { return { x: p.x, y: p.y }; });
              const edges = [];

              for (let v = 1; v < n; v += 1) edges.push({ from: api.rng.int(v), to: v });
              const temperature = 0.1;
              const after = forceStep(positions, edges, Math.sqrt(1 / n), temperature);

              api.assert.equal(after.length, n, 'one position per vertex');
              after.forEach(function (point, v) {
                const dx = point.x - before[v].x;
                const dy = point.y - before[v].y;
                const moved = Math.sqrt(dx * dx + dy * dy);

                api.assert.ok(moved <= temperature + 1e-9,
                  'trial ' + trial + ': vertex ' + v + ' moved ' + moved.toFixed(4) +
                    ' against a temperature of ' + temperature +
                    '; the cap is what stops a close pair exploding');
              });
              positions.forEach(function (point, v) {
                api.assert.ok(Math.abs(point.x - before[v].x) < 1e-12 &&
                  Math.abs(point.y - before[v].y) < 1e-12,
                'the input array must not be mutated');
              });
            }
          }
        },
        {
          name: 'two coincident vertices are separated rather than sent to infinity',
          assert: function (forceStep, api) {
            const positions = [{ x: 0, y: 0 }, { x: 1e-12, y: 0 }, { x: 1, y: 1 }];
            const after = forceStep(positions, [{ from: 0, to: 2 }], 0.5, 0.1);

            after.forEach(function (point, v) {
              api.assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y),
                'vertex ' + v + ' left the plane: repulsion between coincident vertices is ' +
                  'enormous, and only the cap keeps the step finite');
              api.assert.ok(Math.abs(point.x) < 10 && Math.abs(point.y) < 10,
                'vertex ' + v + ' moved to ' + point.x.toFixed(2) + ', ' + point.y.toFixed(2) +
                  '; one step at temperature 0.1 cannot move anything that far');
            });
          }
        },
        {
          name: 'the same seed gives the same layout, twice',
          assert: function (forceStep, api) {
            const n = 10;
            const start = [];

            for (let v = 0; v < n; v += 1) {
              start.push({ x: Math.cos(v), y: Math.sin(v * 2) });
            }
            const edges = [];

            for (let v = 1; v < n; v += 1) edges.push({ from: v - 1, to: v });

            function run() {
              let positions = start.map(function (p) { return { x: p.x, y: p.y }; });

              for (let step = 0; step < 40; step += 1) {
                positions = forceStep(positions, edges, Math.sqrt(1 / n), 0.1 * (1 - step / 40));
              }
              return positions;
            }
            const first = run();
            const second = run();

            first.forEach(function (point, v) {
              api.assert.ok(Math.abs(point.x - second[v].x) < 1e-12 &&
                Math.abs(point.y - second[v].y) < 1e-12,
              'vertex ' + v + ' landed somewhere different on the second run; a layout that ' +
                'moves between builds is unusable in a diagram pipeline');
            });
          }
        }
      ]
    }],

    'spectral-methods': [{
      id: 'pagerank-dangling',
      title: 'PageRank, and the mass that has nowhere to go',
      prompt: 'pageRank(adjacency, damping, iterations) must return { rank, total } for a DIRECTED ' +
        'link graph given as an array of out-link lists: the stationary distribution of a walk that ' +
        'follows a uniformly chosen out-link with probability `damping` and teleports to a ' +
        'uniformly chosen page otherwise. Start from the uniform vector. The trap is a page with no ' +
        'out-links: it has nothing to divide its mass among, and unless that mass is redistributed ' +
        'uniformly over all n pages the vector stops summing to one. The starter drops it, which ' +
        'leaves a vector that still sorts into exactly the right order and is worthless as a set of ' +
        'numbers.',
      entry: 'pageRank',
      starter: [
        'function pageRank(adjacency, damping, iterations) {',
        '  const n = adjacency.length;',
        '  let rank = new Array(n).fill(1 / n);',
        '',
        '  for (let step = 0; step < iterations; step += 1) {',
        '    const next = new Array(n).fill(0);',
        '    for (let v = 0; v < n; v += 1) {',
        '      // a page with no out-links simply contributes nothing',
        '      if (adjacency[v].length === 0) continue;',
        '      const share = rank[v] / adjacency[v].length;',
        '      adjacency[v].forEach(function (w) { next[w] += share; });',
        '    }',
        '    for (let v = 0; v < n; v += 1) {',
        '      next[v] = damping * next[v] + (1 - damping) / n;',
        '    }',
        '    rank = next;',
        '  }',
        '  return { rank: rank, total: rank.reduce(function (a, b) { return a + b; }, 0) };',
        '}'
      ].join('\n'),
      solution: [
        'function pageRank(adjacency, damping, iterations) {',
        '  const n = adjacency.length;',
        '  let rank = new Array(n).fill(1 / n);',
        '',
        '  for (let step = 0; step < iterations; step += 1) {',
        '    const next = new Array(n).fill(0);',
        '    let dangling = 0;',
        '    for (let v = 0; v < n; v += 1) {',
        '      if (adjacency[v].length === 0) { dangling += rank[v]; continue; }',
        '      const share = rank[v] / adjacency[v].length;',
        '      adjacency[v].forEach(function (w) { next[w] += share; });',
        '    }',
        '    // the dangling mass is spread over every page, not discarded',
        '    const spread = dangling / n;',
        '    for (let v = 0; v < n; v += 1) {',
        '      next[v] = damping * (next[v] + spread) + (1 - damping) / n;',
        '    }',
        '    rank = next;',
        '  }',
        '  return { rank: rank, total: rank.reduce(function (a, b) { return a + b; }, 0) };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the vector sums to one even when a fifth of the pages link to nothing',
          assert: function (pageRank, api) {
            for (let trial = 0; trial < 8; trial += 1) {
              const n = 30;
              const dangling = 6;
              const adjacency = [];

              for (let v = 0; v < n; v += 1) adjacency.push([]);

              for (let v = dangling; v < n; v += 1) {
                for (let i = 0; i < 1 + api.rng.int(4); i += 1) {
                  const target = api.rng.int(n);

                  if (target === v || adjacency[v].indexOf(target) !== -1) continue;
                  adjacency[v].push(target);
                }
              }
              const got = pageRank(adjacency, 0.85, 200);

              api.assert.ok(Math.abs(got.total - 1) < 1e-9,
                'trial ' + trial + ': the vector holds ' + got.total.toFixed(6) +
                  ' of the probability. The ranking still looks perfect, which is exactly why ' +
                  'this bug survives');
            }
          }
        },
        {
          name: 'it matches a direct linear solve',
          assert: function (pageRank, api) {
            function solve(adjacency, damping) {
              const n = adjacency.length;
              const matrix = [];

              for (let i = 0; i < n; i += 1) {
                const row = new Array(n + 1).fill(0);

                row[i] = 1;
                row[n] = (1 - damping) / n;
                matrix.push(row);
              }

              for (let v = 0; v < n; v += 1) {
                const targets = adjacency[v].length ? adjacency[v] : null;

                if (targets === null) {
                  for (let w = 0; w < n; w += 1) matrix[w][v] -= damping / n;
                  continue;
                }
                targets.forEach(function (w) { matrix[w][v] -= damping / targets.length; });
              }

              for (let col = 0; col < n; col += 1) {
                let pivot = col;

                for (let r = col + 1; r < n; r += 1) {
                  if (Math.abs(matrix[r][col]) > Math.abs(matrix[pivot][col])) pivot = r;
                }
                const swap = matrix[col];

                matrix[col] = matrix[pivot];
                matrix[pivot] = swap;

                for (let r = 0; r < n; r += 1) {
                  if (r === col || Math.abs(matrix[col][col]) < 1e-15) continue;
                  const factor = matrix[r][col] / matrix[col][col];

                  for (let c = col; c <= n; c += 1) matrix[r][c] -= factor * matrix[col][c];
                }
              }
              const out = [];

              for (let i = 0; i < n; i += 1) out.push(matrix[i][n] / matrix[i][i]);
              return out;
            }

            for (let trial = 0; trial < 5; trial += 1) {
              const n = 14;
              const adjacency = [];

              for (let v = 0; v < n; v += 1) adjacency.push([]);

              for (let v = 3; v < n; v += 1) {
                for (let i = 0; i < 1 + api.rng.int(3); i += 1) {
                  const target = api.rng.int(n);

                  if (target === v || adjacency[v].indexOf(target) !== -1) continue;
                  adjacency[v].push(target);
                }
              }
              const got = pageRank(adjacency, 0.85, 400).rank;
              const truth = solve(adjacency, 0.85);

              got.forEach(function (value, v) {
                api.assert.ok(Math.abs(value - truth[v]) < 1e-6,
                  'trial ' + trial + ': page ' + v + ' scores ' + value.toFixed(8) +
                    ' against a linear solve giving ' + truth[v].toFixed(8));
              });
            }
          }
        },
        {
          name: 'with no dangling pages at all the two versions must still agree',
          assert: function (pageRank, api) {
            const n = 12;
            const adjacency = [];

            for (let v = 0; v < n; v += 1) adjacency.push([(v + 1) % n, (v + 5) % n]);
            const got = pageRank(adjacency, 0.85, 300);

            api.assert.ok(Math.abs(got.total - 1) < 1e-9,
              'a graph with no dangling page loses nothing, so the total is 1 either way');
            got.rank.forEach(function (value, v) {
              api.assert.ok(Math.abs(value - 1 / n) < 1e-6,
                'page ' + v + ' scores ' + value.toFixed(8) + ' on a vertex-transitive graph, ' +
                  'where every page must score exactly ' + (1 / n).toFixed(8));
            });
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));

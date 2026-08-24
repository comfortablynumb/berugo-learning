/**
 * Graded exercises for beyond NP, parameterised algorithms and metaheuristics (M20.4-M20.6).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'beyond-np': [{
      id: 'qbf-evaluator',
      title: 'A QBF evaluator by recursive quantifier expansion',
      prompt: 'evaluateQbf(qbf) must decide whether a quantified Boolean sentence is true. ' +
        '`qbf` is { variables, prefix, clauses }: `prefix` is one entry per variable in ' +
        'quantifier order, each { quantifier: "exists" | "forall", variable }, and `clauses` is ' +
        'an array of clauses of non-zero integers where +v means variable v positive. Descend ' +
        'the prefix: at an "exists" level the sentence is true when EITHER value works, and at ' +
        'a "forall" level only when BOTH do. When the prefix is exhausted every variable has a ' +
        'value and the answer is whether every clause is satisfied. Return { value, nodes } ' +
        'where `nodes` counts the recursive calls. The starter ignores the prefix and asks ' +
        'whether some assignment satisfies the clauses, which is plain SAT and a different ' +
        'question.',
      entry: 'evaluateQbf',
      starter: [
        'function evaluateQbf(qbf) {',
        '  // Plain SAT: true when SOME assignment works, whatever the prefix says.',
        '  const total = Math.pow(2, qbf.variables);',
        '  let nodes = 0;',
        '  for (let mask = 0; mask < total; mask += 1) {',
        '    nodes += 1;',
        '    let all = true;',
        '    for (let c = 0; c < qbf.clauses.length && all; c += 1) {',
        '      const clause = qbf.clauses[c];',
        '      let ok = false;',
        '      for (let i = 0; i < clause.length; i += 1) {',
        '        const literal = clause[i];',
        '        const value = ((mask >>> (Math.abs(literal) - 1)) & 1) === 1;',
        '        if (literal > 0 ? value : !value) { ok = true; break; }',
        '      }',
        '      if (!ok) all = false;',
        '    }',
        '    if (all) return { value: true, nodes: nodes };',
        '  }',
        '  return { value: false, nodes: nodes };',
        '}'
      ].join('\n'),
      solution: [
        'function evaluateQbf(qbf) {',
        '  const assignment = new Array(qbf.variables).fill(null);',
        '  let nodes = 0;',
        '',
        '  function satisfied() {',
        '    for (let c = 0; c < qbf.clauses.length; c += 1) {',
        '      const clause = qbf.clauses[c];',
        '      let ok = false;',
        '      for (let i = 0; i < clause.length; i += 1) {',
        '        const literal = clause[i];',
        '        const value = assignment[Math.abs(literal) - 1];',
        '        if (literal > 0 ? value === true : value === false) { ok = true; break; }',
        '      }',
        '      if (!ok) return false;',
        '    }',
        '    return true;',
        '  }',
        '',
        '  function descend(index) {',
        '    nodes += 1;',
        '    if (index === qbf.prefix.length) return satisfied();',
        '    const item = qbf.prefix[index];',
        '    const wantAll = item.quantifier === "forall";',
        '    let sawTrue = false;',
        '    for (let side = 0; side < 2; side += 1) {',
        '      assignment[item.variable - 1] = side === 0;',
        '      const outcome = descend(index + 1);',
        '      assignment[item.variable - 1] = null;',
        '      if (wantAll && !outcome) return false;',
        '      if (!wantAll && outcome) { sawTrue = true; break; }',
        '    }',
        '    return wantAll ? true : sawTrue;',
        '  }',
        '',
        '  return { value: descend(0), nodes: nodes };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the two matching games have opposite answers with identical clauses',
          assert: function (evaluateQbf, api) {
            for (let pairs = 1; pairs <= 4; pairs += 1) {
              const clauses = [];
              const forwards = [];
              const backwards = [];
              for (let i = 0; i < pairs; i += 1) {
                const x = 2 * i + 1;
                const y = 2 * i + 2;
                clauses.push([-x, y]);
                clauses.push([x, -y]);
                forwards.push({ quantifier: 'forall', variable: x });
                forwards.push({ quantifier: 'exists', variable: y });
                backwards.push({ quantifier: 'exists', variable: y });
                backwards.push({ quantifier: 'forall', variable: x });
              }
              const size = 2 * pairs;
              api.assert.equal(
                evaluateQbf({ variables: size, prefix: forwards, clauses: clauses }).value, true,
                pairs + ' rounds: for-all-then-exists must be TRUE');
              api.assert.equal(
                evaluateQbf({ variables: size, prefix: backwards, clauses: clauses }).value, false,
                pairs + ' rounds: exists-then-for-all must be FALSE');
            }
          }
        },
        {
          name: 'it agrees with a truth-table oracle on random prefixes',
          assert: function (evaluateQbf, api) {
            function oracle(qbf) {
              const total = Math.pow(2, qbf.variables);
              let table = new Array(total);
              for (let mask = 0; mask < total; mask += 1) {
                let all = true;
                for (let c = 0; c < qbf.clauses.length && all; c += 1) {
                  const clause = qbf.clauses[c];
                  let ok = false;
                  for (let i = 0; i < clause.length; i += 1) {
                    const literal = clause[i];
                    const value = ((mask >>> (Math.abs(literal) - 1)) & 1) === 1;
                    if (literal > 0 ? value : !value) { ok = true; break; }
                  }
                  if (!ok) all = false;
                }
                table[mask] = all;
              }
              for (let i = qbf.prefix.length - 1; i >= 0; i -= 1) {
                const item = qbf.prefix[i];
                const bit = 1 << (item.variable - 1);
                const next = new Array(table.length);
                for (let mask = 0; mask < table.length; mask += 1) {
                  const a = table[mask & ~bit];
                  const b = table[mask | bit];
                  next[mask] = item.quantifier === 'forall' ? (a && b) : (a || b);
                }
                table = next;
              }
              return table[0];
            }

            let trues = 0;
            let falses = 0;
            for (let t = 0; t < 30; t += 1) {
              const rng = api.Random.seeded(t * 19 + 11);
              const variables = 8;
              const clauses = [];
              for (let c = 0; c < 12; c += 1) {
                const used = {};
                const clause = [];
                while (clause.length < 3) {
                  const v = 1 + rng.int(variables);
                  if (used[v]) continue;
                  used[v] = true;
                  clause.push(rng.int(2) === 1 ? v : -v);
                }
                clauses.push(clause);
              }
              const prefix = [];
              for (let v = 1; v <= variables; v += 1) {
                prefix.push({ quantifier: rng.int(2) === 1 ? 'forall' : 'exists', variable: v });
              }
              const qbf = { variables: variables, prefix: prefix, clauses: clauses };
              const got = evaluateQbf(qbf);
              const truth = oracle(qbf);
              api.assert.equal(got.value, truth,
                'instance ' + t + ': expected ' + truth + ', got ' + got.value);
              if (truth) trues += 1; else falses += 1;
            }
            api.assert.atLeast(trues, 3, 'the sweep must contain true sentences');
            api.assert.atLeast(falses, 3, 'and false ones');
          }
        },
        {
          name: 'the prefix is honoured, not ignored — the same clauses give different answers',
          assert: function (evaluateQbf, api) {
            const clauses = [[1, 2], [-1, -2]];
            const allExists = [
              { quantifier: 'exists', variable: 1 }, { quantifier: 'exists', variable: 2 }
            ];
            const allForall = [
              { quantifier: 'forall', variable: 1 }, { quantifier: 'forall', variable: 2 }
            ];
            api.assert.equal(
              evaluateQbf({ variables: 2, prefix: allExists, clauses: clauses }).value, true,
              'some assignment satisfies both clauses');
            api.assert.equal(
              evaluateQbf({ variables: 2, prefix: allForall, clauses: clauses }).value, false,
              'not every assignment does, so the all-universal sentence is false');
            api.assert.atLeast(
              evaluateQbf({ variables: 2, prefix: allForall, clauses: clauses }).nodes, 3,
              'the evaluator must actually descend the prefix');
          }
        }
      ]
    }],

    'parameterised-algorithms': [{
      id: 'buss-kernelisation',
      title: 'The two kernelisation rules for vertex cover, applied to a fixed point',
      prompt: 'kernelise(graph, k) must shrink a vertex-cover instance without changing its ' +
        'answer. `graph` is { n, edges: [{ from, to }] }. Apply two rules until neither fires: ' +
        'any vertex whose degree among the surviving edges EXCEEDS k must be in every cover of ' +
        'size k, so commit it and reduce k by one; any vertex of degree zero is in no minimal ' +
        'cover, so drop it. If k reaches zero while edges remain, or if more than k² edges ' +
        'survive, the answer is NO. Return { decided, answer, forced, vertices, edges, k } ' +
        'where `forced` lists the committed vertices, `vertices` and `edges` count what ' +
        'survived, and `k` is the remaining budget. Set `decided` true only when the rules ' +
        'settled the question — with `answer` false for a NO and true when no edges remain. The ' +
        'starter returns the instance untouched, which is safe and useless.',
      entry: 'kernelise',
      starter: [
        'function kernelise(graph, k) {',
        '  // No rules applied: correct, and the kernel is the whole instance.',
        '  return { decided: false, answer: null, forced: [], vertices: graph.n,',
        '    edges: graph.edges.length, k: k };',
        '}'
      ].join('\n'),
      solution: [
        'function kernelise(graph, k) {',
        '  const alive = new Set();',
        '  for (let v = 0; v < graph.n; v += 1) alive.add(v);',
        '  const forced = [];',
        '  let budget = k;',
        '',
        '  function liveEdges() {',
        '    return graph.edges.filter(function (edge) {',
        '      return alive.has(edge.from) && alive.has(edge.to);',
        '    });',
        '  }',
        '',
        '  let moved = true;',
        '  while (moved) {',
        '    moved = false;',
        '    const edges = liveEdges();',
        '    const degree = new Map();',
        '    alive.forEach(function (v) { degree.set(v, 0); });',
        '    edges.forEach(function (edge) {',
        '      degree.set(edge.from, degree.get(edge.from) + 1);',
        '      degree.set(edge.to, degree.get(edge.to) + 1);',
        '    });',
        '',
        '    const isolated = [];',
        '    let high = null;',
        '    degree.forEach(function (count, vertex) {',
        '      if (count === 0) isolated.push(vertex);',
        '      if (count > budget && high === null) high = vertex;',
        '    });',
        '    if (isolated.length > 0) {',
        '      isolated.forEach(function (v) { alive.delete(v); });',
        '      moved = true;',
        '    }',
        '    if (high === null) continue;',
        '    if (budget <= 0) {',
        '      return { decided: true, answer: false, forced: forced, vertices: 0, edges: 0, k: 0 };',
        '    }',
        '    alive.delete(high);',
        '    forced.push(high);',
        '    budget -= 1;',
        '    moved = true;',
        '  }',
        '',
        '  const edges = liveEdges();',
        '  const touched = new Set();',
        '  edges.forEach(function (edge) { touched.add(edge.from); touched.add(edge.to); });',
        '  if (edges.length === 0) {',
        '    return { decided: true, answer: true, forced: forced, vertices: 0, edges: 0, k: budget };',
        '  }',
        '  if (budget <= 0 || edges.length > budget * budget) {',
        '    return { decided: true, answer: false, forced: forced, vertices: touched.size,',
        '      edges: edges.length, k: budget };',
        '  }',
        '  return { decided: false, answer: null, forced: forced, vertices: touched.size,',
        '    edges: edges.length, k: budget };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the kernel preserves the exact answer, checked against brute force',
          assert: function (kernelise, api) {
            function bruteCover(graph, k) {
              const total = Math.pow(2, graph.n);
              for (let mask = 0; mask < total; mask += 1) {
                let size = 0;
                for (let v = 0; v < graph.n; v += 1) { if ((mask >>> v) & 1) size += 1; }
                if (size > k) continue;
                let covers = true;
                for (let i = 0; i < graph.edges.length && covers; i += 1) {
                  const edge = graph.edges[i];
                  const a = (mask >>> edge.from) & 1;
                  const b = (mask >>> edge.to) & 1;
                  if (!a && !b) covers = false;
                }
                if (covers) return true;
              }
              return false;
            }

            for (let t = 0; t < 20; t += 1) {
              const rng = api.Random.seeded(t * 13 + 2);
              const n = 12;
              const seen = {};
              const edges = [];
              while (edges.length < 22) {
                const a = rng.int(n);
                const b = rng.int(n);
                if (a === b) continue;
                const key = Math.min(a, b) + '-' + Math.max(a, b);
                if (seen[key]) continue;
                seen[key] = true;
                edges.push({ from: a, to: b });
              }
              const graph = { n: n, edges: edges };
              for (let k = 0; k <= 10; k += 1) {
                const got = kernelise(graph, k);
                if (!got.decided) continue;
                api.assert.equal(got.answer, bruteCover(graph, k),
                  'instance ' + t + ' k=' + k + ': the rules decided it wrongly');
              }
            }
          }
        },
        {
          name: 'the surviving kernel obeys the k-squared bound',
          assert: function (kernelise, api) {
            for (let t = 0; t < 20; t += 1) {
              const rng = api.Random.seeded(t * 29 + 5);
              const hubs = 5;
              const leaves = 60;
              const n = hubs + leaves;
              const seen = {};
              const edges = [];
              function add(a, b) {
                if (a === b) return;
                const key = Math.min(a, b) + '-' + Math.max(a, b);
                if (seen[key]) return;
                seen[key] = true;
                edges.push({ from: a, to: b });
              }
              for (let h = 0; h < hubs; h += 1) {
                for (let l = 0; l < leaves; l += 1) {
                  if (rng.next() < 0.5) add(h, hubs + l);
                }
              }
              for (let e = 0; e < 10; e += 1) add(hubs + rng.int(leaves), hubs + rng.int(leaves));

              const got = kernelise({ n: n, edges: edges }, 9);
              if (got.decided) continue;
              api.assert.atMost(got.edges, got.k * got.k,
                'instance ' + t + ': an undecided kernel must satisfy edges <= k squared, got ' +
                  got.edges + ' against ' + (got.k * got.k));
            }
          }
        },
        {
          name: 'the kernel size stops depending on the instance size',
          assert: function (kernelise, api) {
            const sizes = [40, 80, 160, 320];
            const kernels = [];
            sizes.forEach(function (leaves) {
              const rng = api.Random.seeded(7);
              const hubs = 5;
              const n = hubs + leaves;
              const seen = {};
              const edges = [];
              function add(a, b) {
                if (a === b) return;
                const key = Math.min(a, b) + '-' + Math.max(a, b);
                if (seen[key]) return;
                seen[key] = true;
                edges.push({ from: a, to: b });
              }
              for (let h = 0; h < hubs; h += 1) {
                for (let l = 0; l < leaves; l += 1) {
                  if (rng.next() < 0.5) add(h, hubs + l);
                }
              }
              for (let e = 0; e < 8; e += 1) add(hubs + rng.int(leaves), hubs + rng.int(leaves));
              const got = kernelise({ n: n, edges: edges }, 10);
              kernels.push(got.edges);
            });
            api.assert.atMost(Math.max.apply(null, kernels), 30,
              'the kernel must stay small as n grows: ' + kernels.join(', '));
            api.assert.atMost(Math.max.apply(null, kernels), Math.min.apply(null, kernels) + 12,
              'and it must not grow with n: ' + kernels.join(', '));
          }
        }
      ]
    }],

    metaheuristics: [{
      id: 'annealing-for-tsp',
      title: 'Simulated annealing with a budget-aware cooling schedule',
      prompt: 'anneal(matrix, start, budget, rng, options) must improve a tour under a fixed ' +
        'evaluation budget. `matrix[i][j]` is the distance, `start` is a tour (an array of city ' +
        'indices), and `budget` is the number of candidate moves you may evaluate — not one ' +
        'more. Repeatedly pick a random 2-opt move, compute its delta from four table lookups, ' +
        'and accept it when the delta is negative or with probability e^(−Δ/T); then cool. ' +
        '`options.temperature` gives the starting temperature (default: the mean pairwise ' +
        'distance) and `options.cooling` the per-step factor (default: derived so the ' +
        'temperature falls a thousandfold across the budget). Return { tour, cost, evaluations, ' +
        'accepted } with the best tour seen, its length, the number of candidate moves ' +
        'evaluated and the number accepted. At temperature zero the acceptance test must ' +
        'degenerate to Δ < 0 exactly. The starter returns the input untouched.',
      entry: 'anneal',
      starter: [
        'function anneal(matrix, start, budget, rng, options) {',
        '  // No moves at all: a valid tour, and no search.',
        '  let cost = 0;',
        '  for (let i = 0; i < start.length; i += 1) {',
        '    cost += matrix[start[i]][start[(i + 1) % start.length]];',
        '  }',
        '  return { tour: start.slice(), cost: cost, evaluations: 0, accepted: 0 };',
        '}'
      ].join('\n'),
      solution: [
        'function anneal(matrix, start, budget, rng, options) {',
        '  const settings = options || {};',
        '  const n = start.length;',
        '',
        '  function tourCost(tour) {',
        '    let total = 0;',
        '    for (let i = 0; i < n; i += 1) total += matrix[tour[i]][tour[(i + 1) % n]];',
        '    return total;',
        '  }',
        '',
        '  function meanDistance() {',
        '    let total = 0;',
        '    let count = 0;',
        '    for (let i = 0; i < n; i += 1) {',
        '      for (let j = i + 1; j < n; j += 1) { total += matrix[i][j]; count += 1; }',
        '    }',
        '    return count === 0 ? 1 : total / count;',
        '  }',
        '',
        '  let temperature = settings.temperature === undefined ? meanDistance() : settings.temperature;',
        '  const cooling = settings.cooling === undefined',
        '    ? Math.pow(1e-3, 1 / Math.max(1, budget))',
        '    : settings.cooling;',
        '',
        '  let tour = start.slice();',
        '  let cost = tourCost(tour);',
        '  let best = tour.slice();',
        '  let bestCost = cost;',
        '  let evaluations = 0;',
        '  let accepted = 0;',
        '',
        '  while (evaluations < budget) {',
        '    evaluations += 1;',
        '    const i = rng.int(n - 1);',
        '    const j = i + 2 + rng.int(Math.max(1, n - i - 2));',
        '    if (j >= n) { temperature *= cooling; continue; }',
        '    const a = tour[i];',
        '    const b = tour[i + 1];',
        '    const c = tour[j];',
        '    const d = tour[(j + 1) % n];',
        '    const delta = matrix[a][c] + matrix[b][d] - matrix[a][b] - matrix[c][d];',
        '    const take = delta < 0 ||',
        '      (temperature > 0 && rng.next() < Math.exp(-delta / temperature));',
        '    if (take) {',
        '      const next = tour.slice();',
        '      let left = i + 1;',
        '      let right = j;',
        '      while (left < right) {',
        '        const swap = next[left];',
        '        next[left] = next[right];',
        '        next[right] = swap;',
        '        left += 1;',
        '        right -= 1;',
        '      }',
        '      tour = next;',
        '      cost += delta;',
        '      accepted += 1;',
        '      if (cost < bestCost) { bestCost = cost; best = tour.slice(); }',
        '    }',
        '    temperature *= cooling;',
        '  }',
        '  return { tour: best, cost: bestCost, evaluations: evaluations, accepted: accepted };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the tour stays valid and the reported cost matches it',
          assert: function (anneal, api) {
            for (let t = 0; t < 8; t += 1) {
              const rng = api.Random.seeded(t * 11 + 3);
              const n = 14;
              const points = [];
              for (let i = 0; i < n; i += 1) {
                points.push({ x: rng.next() * 100, y: rng.next() * 100 });
              }
              const matrix = [];
              for (let i = 0; i < n; i += 1) {
                const row = [];
                for (let j = 0; j < n; j += 1) {
                  row.push(Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y));
                }
                matrix.push(row);
              }
              const start = [];
              for (let i = 0; i < n; i += 1) start.push(i);

              const got = anneal(matrix, start, 4000, api.Random.seeded(t + 1), {});
              api.assert.equal(got.tour.length, n, 'instance ' + t + ': the tour must visit n cities');
              const seen = {};
              got.tour.forEach(function (city) { seen[city] = true; });
              api.assert.equal(Object.keys(seen).length, n,
                'instance ' + t + ': every city exactly once');
              let real = 0;
              for (let i = 0; i < n; i += 1) real += matrix[got.tour[i]][got.tour[(i + 1) % n]];
              api.assert.closeTo(got.cost, real, 1e-6,
                'instance ' + t + ': the reported cost must be the tour’s length');
            }
          }
        },
        {
          name: 'it respects the evaluation budget exactly, and beats the starting tour',
          assert: function (anneal, api) {
            for (let t = 0; t < 8; t += 1) {
              const rng = api.Random.seeded(t * 23 + 9);
              const n = 16;
              const points = [];
              for (let i = 0; i < n; i += 1) {
                points.push({ x: rng.next() * 100, y: rng.next() * 100 });
              }
              const matrix = [];
              for (let i = 0; i < n; i += 1) {
                const row = [];
                for (let j = 0; j < n; j += 1) {
                  row.push(Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y));
                }
                matrix.push(row);
              }
              const start = [];
              for (let i = 0; i < n; i += 1) start.push(i);
              let before = 0;
              for (let i = 0; i < n; i += 1) before += matrix[start[i]][start[(i + 1) % n]];

              const budget = 3000;
              const got = anneal(matrix, start, budget, api.Random.seeded(t * 5 + 2), {});
              api.assert.atMost(got.evaluations, budget,
                'instance ' + t + ': the budget is a ceiling, not a suggestion');
              api.assert.atLeast(got.evaluations, budget - 1,
                'instance ' + t + ': and it must actually be spent');
              api.assert.atMost(got.cost, before,
                'instance ' + t + ': the result must be at least as good as the start');
            }
          }
        },
        {
          name: 'temperature zero degenerates to hill climbing exactly',
          assert: function (anneal, api) {
            const rng = api.Random.seeded(31);
            const n = 18;
            const points = [];
            for (let i = 0; i < n; i += 1) {
              points.push({ x: rng.next() * 100, y: rng.next() * 100 });
            }
            const matrix = [];
            for (let i = 0; i < n; i += 1) {
              const row = [];
              for (let j = 0; j < n; j += 1) {
                row.push(Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y));
              }
              matrix.push(row);
            }
            const start = [];
            for (let i = 0; i < n; i += 1) start.push(i);

            const cold = anneal(matrix, start, 4000, api.Random.seeded(4), { temperature: 0 });
            let costs = [];
            let running = 0;
            for (let i = 0; i < n; i += 1) running += matrix[start[i]][start[(i + 1) % n]];
            costs.push(running);
            api.assert.atMost(cold.cost, costs[0],
              'hill climbing must not be worse than its start');

            const hot = anneal(matrix, start, 4000, api.Random.seeded(4),
              { temperature: 1e6, cooling: 1 });
            api.assert.atLeast(hot.accepted, cold.accepted,
              'a very hot schedule must accept at least as many moves as a cold one: ' +
                hot.accepted + ' against ' + cold.accepted);
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));

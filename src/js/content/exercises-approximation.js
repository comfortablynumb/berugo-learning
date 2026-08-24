/**
 * Graded exercises for LP relaxation, schemes and derandomisation (M19.7-M19.9).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'lp-relaxation': [{
      id: 'randomised-rounding-max-sat',
      title: 'Randomised rounding for MAX-SAT, and the derandomised fallback',
      prompt: 'solveMaxSat(formula, bias, rng) must satisfy clauses two ways and return the ' +
        'better. `formula` is { variables, clauses }, each clause an array of non-zero integers ' +
        'where +v means variable v is positive and −v means negated. `bias` is an array of ' +
        'probabilities, one per variable, from an LP relaxation. Compute three assignments: ' +
        '"coin" sets each variable true with probability ½; "rounded" sets variable i true with ' +
        'probability bias[i − 1]; "conditional" walks the variables in order and sets each to ' +
        'whichever value gives the larger expected number of satisfied clauses given the ' +
        'decisions so far, where the expectation of a partial assignment is the count of ' +
        'already-satisfied clauses plus 1 − 2^(−u) for each surviving clause with u undecided ' +
        'literals. Return { coin, rounded, conditional, best, expectation } with the four counts ' +
        'and the fully random expectation Σ(1 − 2^(−k)). The starter sets every variable true, ' +
        'which is a valid assignment and satisfies no negated clause.',
      entry: 'solveMaxSat',
      starter: [
        'function solveMaxSat(formula, bias, rng) {',
        '  const n = formula.variables;',
        '',
        '  function countSatisfied(assignment) {',
        '    let count = 0;',
        '    formula.clauses.forEach(function (clause) {',
        '      for (let i = 0; i < clause.length; i += 1) {',
        '        const value = assignment[Math.abs(clause[i]) - 1];',
        '        if (clause[i] > 0 ? value : !value) { count += 1; return; }',
        '      }',
        '    });',
        '    return count;',
        '  }',
        '',
        '  const allTrue = new Array(n).fill(true);   // one assignment, no thought',
        '  const score = countSatisfied(allTrue);',
        '  let expectation = 0;',
        '  formula.clauses.forEach(function (clause) {',
        '    expectation += 1 - Math.pow(2, -clause.length);',
        '  });',
        '  return { coin: score, rounded: score, conditional: score, best: score,',
        '    expectation: expectation };',
        '}'
      ].join('\n'),
      solution: [
        'function solveMaxSat(formula, bias, rng) {',
        '  const n = formula.variables;',
        '',
        '  function countSatisfied(assignment) {',
        '    let count = 0;',
        '    for (let c = 0; c < formula.clauses.length; c += 1) {',
        '      const clause = formula.clauses[c];',
        '      for (let i = 0; i < clause.length; i += 1) {',
        '        const value = assignment[Math.abs(clause[i]) - 1];',
        '        if (clause[i] > 0 ? value : !value) { count += 1; break; }',
        '      }',
        '    }',
        '    return count;',
        '  }',
        '',
        '  function partialExpectation(assignment) {',
        '    let out = 0;',
        '    for (let c = 0; c < formula.clauses.length; c += 1) {',
        '      const clause = formula.clauses[c];',
        '      let undecided = 0;',
        '      let satisfied = false;',
        '      for (let i = 0; i < clause.length; i += 1) {',
        '        const value = assignment[Math.abs(clause[i]) - 1];',
        '        if (value === null) { undecided += 1; continue; }',
        '        if (clause[i] > 0 ? value : !value) satisfied = true;',
        '      }',
        '      out += satisfied ? 1 : 1 - Math.pow(2, -undecided);',
        '    }',
        '    return out;',
        '  }',
        '',
        '  const coin = new Array(n);',
        '  for (let i = 0; i < n; i += 1) coin[i] = rng.int(2) === 1;',
        '',
        '  const rounded = new Array(n);',
        '  for (let i = 0; i < n; i += 1) rounded[i] = rng.next() < bias[i];',
        '',
        '  const walk = new Array(n).fill(null);',
        '  for (let i = 0; i < n; i += 1) {',
        '    walk[i] = true;',
        '    const ifTrue = partialExpectation(walk);',
        '    walk[i] = false;',
        '    const ifFalse = partialExpectation(walk);',
        '    walk[i] = ifTrue >= ifFalse;',
        '  }',
        '',
        '  let expectation = 0;',
        '  for (let c = 0; c < formula.clauses.length; c += 1) {',
        '    expectation += 1 - Math.pow(2, -formula.clauses[c].length);',
        '  }',
        '',
        '  const coinScore = countSatisfied(coin);',
        '  const roundedScore = countSatisfied(rounded);',
        '  const conditionalScore = countSatisfied(walk);',
        '',
        '  return { coin: coinScore, rounded: roundedScore, conditional: conditionalScore,',
        '    best: Math.max(coinScore, roundedScore, conditionalScore),',
        '    expectation: expectation };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the conditional walk always meets the random expectation',
          assert: function (solveMaxSat, api) {
            for (let t = 0; t < 40; t += 1) {
              const rng = api.Random.seeded(t * 13 + 5);
              const variables = 10;
              const clauses = [];
              for (let c = 0; c < 30; c += 1) {
                const width = 1 + rng.int(4);
                const used = {};
                const clause = [];
                while (clause.length < width) {
                  const v = 1 + rng.int(variables);
                  if (used[v]) continue;
                  used[v] = true;
                  clause.push(rng.int(2) === 1 ? v : -v);
                }
                clauses.push(clause);
              }
              const bias = [];
              for (let i = 0; i < variables; i += 1) bias.push(0.5);
              const got = solveMaxSat({ variables: variables, clauses: clauses }, bias,
                api.Random.seeded(t + 1));

              api.assert.atLeast(got.conditional, got.expectation - 1e-9,
                'instance ' + t + ': the walk gave ' + got.conditional +
                  ' against an expectation of ' + got.expectation);
            }
          }
        },
        {
          name: 'a coin flip only meets the expectation on average, not on every instance',
          assert: function (solveMaxSat, api) {
            const rng = api.Random.seeded(21);
            const variables = 12;
            const clauses = [];
            for (let c = 0; c < 40; c += 1) {
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
            const bias = [];
            for (let i = 0; i < variables; i += 1) bias.push(0.5);
            const formula = { variables: variables, clauses: clauses };

            let below = 0;
            let total = 0;
            for (let t = 0; t < 200; t += 1) {
              const got = solveMaxSat(formula, bias, api.Random.seeded(t * 7 + 3));
              total += got.coin;
              if (got.coin < got.expectation) below += 1;
            }
            api.assert.atLeast(below, 20,
              'some coin flips must fall below the expectation; only ' + below + ' of 200 did');
            api.assert.closeTo(total / 200,
              solveMaxSat(formula, bias, api.Random.seeded(1)).expectation, 1.5,
              'and the average over 200 draws must sit near it');
          }
        },
        {
          name: 'rounding towards an LP bias beats a coin flip when the bias is informative',
          assert: function (solveMaxSat, api) {
            const variables = 12;
            const clauses = [];
            /* Every clause is a single positive literal, so the optimal assignment is
               all-true and an LP would set every bias to 1. */
            for (let v = 1; v <= variables; v += 1) {
              clauses.push([v]);
              clauses.push([v]);
            }
            const bias = [];
            for (let i = 0; i < variables; i += 1) bias.push(1);
            const formula = { variables: variables, clauses: clauses };

            let roundedTotal = 0;
            let coinTotal = 0;
            for (let t = 0; t < 50; t += 1) {
              const got = solveMaxSat(formula, bias, api.Random.seeded(t * 11 + 9));
              roundedTotal += got.rounded;
              coinTotal += got.coin;
            }
            api.assert.equal(roundedTotal / 50, clauses.length,
              'a bias of 1 must satisfy every clause, every time');
            api.assert.atMost(coinTotal / 50, clauses.length * 0.7,
              'a coin flip satisfies about half of them, averaged ' + (coinTotal / 50));
          }
        },
        {
          name: 'every returned assignment count is achievable — best is the maximum of the three',
          assert: function (solveMaxSat, api) {
            for (let t = 0; t < 20; t += 1) {
              const rng = api.Random.seeded(t * 17 + 4);
              const variables = 8;
              const clauses = [];
              for (let c = 0; c < 20; c += 1) {
                const used = {};
                const clause = [];
                const width = 1 + rng.int(3);
                while (clause.length < width) {
                  const v = 1 + rng.int(variables);
                  if (used[v]) continue;
                  used[v] = true;
                  clause.push(rng.int(2) === 1 ? v : -v);
                }
                clauses.push(clause);
              }
              const bias = [];
              for (let i = 0; i < variables; i += 1) bias.push(rng.next());
              const formula = { variables: variables, clauses: clauses };
              const got = solveMaxSat(formula, bias, api.Random.seeded(t + 2));

              api.assert.equal(got.best, Math.max(got.coin, got.rounded, got.conditional),
                'best must be the maximum of the three counts');
              api.assert.atMost(got.best, clauses.length,
                'no assignment can satisfy more clauses than exist');
            }
          }
        }
      ]
    }],

    'approximation-schemes': [{
      id: 'knapsack-fptas',
      title: 'The knapsack FPTAS, and the divisor that decides whether it saves anything',
      prompt: 'knapsackFptas(items, capacity, epsilon) must return { value, weight, chosen, ' +
        'cells, scale }. When epsilon is 0, solve exactly. Otherwise set K = ε·P_max/n, replace ' +
        'each profit by floor(profit/K), and solve the scaled instance exactly — then report the ' +
        'TRUE profit and weight of the chosen items, never the scaled ones. Solve by the ' +
        'profit-indexed dynamic program: best[p] is the minimum weight achieving profit exactly ' +
        'p, initialised to Infinity with best[0] = 0, and updated for each item by walking p ' +
        'downwards. The answer is the largest p whose best[p] fits in the capacity. `cells` is ' +
        'the table size, items.length × (total scaled profit + 1), which is the quantity being ' +
        'traded for accuracy. The starter is density greedy: fast, and unbounded on the wrong ' +
        'instance.',
      entry: 'knapsackFptas',
      starter: [
        'function knapsackFptas(items, capacity, epsilon) {',
        '  // density greedy: sort by profit per unit weight and fill',
        '  const order = items.map(function (item, index) {',
        '    return { index: index, density: item.profit / item.weight };',
        '  }).sort(function (a, b) { return b.density - a.density; });',
        '',
        '  let weight = 0;',
        '  let value = 0;',
        '  const chosen = [];',
        '  order.forEach(function (entry) {',
        '    if (weight + items[entry.index].weight > capacity) return;',
        '    weight += items[entry.index].weight;',
        '    value += items[entry.index].profit;',
        '    chosen.push(entry.index);',
        '  });',
        '  return { value: value, weight: weight, chosen: chosen, cells: 0, scale: 1 };',
        '}'
      ].join('\n'),
      solution: [
        'function knapsackFptas(items, capacity, epsilon) {',
        '  const n = items.length;',
        '  let maxProfit = 0;',
        '  for (let i = 0; i < n; i += 1) maxProfit = Math.max(maxProfit, items[i].profit);',
        '',
        '  const scale = epsilon > 0 ? Math.max(epsilon * maxProfit / n, 1e-12) : 1;',
        '  const scaled = new Array(n);',
        '  for (let i = 0; i < n; i += 1) {',
        '    scaled[i] = epsilon > 0 ? Math.floor(items[i].profit / scale) : items[i].profit;',
        '  }',
        '',
        '  let total = 0;',
        '  for (let i = 0; i < n; i += 1) total += scaled[i];',
        '',
        '  const best = new Array(total + 1).fill(Infinity);',
        '  best[0] = 0;',
        '  const take = [];',
        '',
        '  for (let i = 0; i < n; i += 1) {',
        '    const row = new Array(total + 1).fill(false);',
        '    for (let p = total; p >= scaled[i]; p -= 1) {',
        '      const candidate = best[p - scaled[i]] + items[i].weight;',
        '      if (candidate >= best[p]) continue;',
        '      best[p] = candidate;',
        '      row[p] = true;',
        '    }',
        '    take.push(row);',
        '  }',
        '',
        '  let target = 0;',
        '  for (let p = total; p >= 0; p -= 1) { if (best[p] <= capacity) { target = p; break; } }',
        '',
        '  const chosen = [];',
        '  let p = target;',
        '  for (let i = n - 1; i >= 0 && p > 0; i -= 1) {',
        '    if (!take[i][p]) continue;',
        '    chosen.push(i);',
        '    p -= scaled[i];',
        '  }',
        '  chosen.reverse();',
        '',
        '  let value = 0;',
        '  let weight = 0;',
        '  for (let c = 0; c < chosen.length; c += 1) {',
        '    value += items[chosen[c]].profit;',
        '    weight += items[chosen[c]].weight;',
        '  }',
        '',
        '  return { value: value, weight: weight, chosen: chosen,',
        '    cells: n * (total + 1), scale: scale };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'it meets the (1 − ε) guarantee for ε in {0.5, 0.1, 0.01} on random instances',
          assert: function (knapsackFptas, api) {
            for (let t = 0; t < 12; t += 1) {
              const rng = api.Random.seeded(t * 23 + 7);
              const items = [];
              let totalWeight = 0;
              for (let i = 0; i < 14; i += 1) {
                const w = 1 + rng.int(500);
                items.push({ profit: w + 100, weight: w });
                totalWeight += w;
              }
              const capacity = Math.floor(totalWeight / 2);
              const exact = knapsackFptas(items, capacity, 0).value;

              [0.5, 0.1, 0.01].forEach(function (epsilon) {
                const got = knapsackFptas(items, capacity, epsilon);
                api.assert.atLeast(got.value, (1 - epsilon) * exact - 1e-9,
                  'instance ' + t + ' at eps=' + epsilon + ': got ' + got.value +
                    ', needed ' + ((1 - epsilon) * exact));
              });
            }
          }
        },
        {
          name: 'the answer is always feasible, at every ε',
          assert: function (knapsackFptas, api) {
            for (let t = 0; t < 12; t += 1) {
              const rng = api.Random.seeded(t * 31 + 3);
              const items = [];
              let totalWeight = 0;
              for (let i = 0; i < 12; i += 1) {
                const w = 1 + rng.int(200);
                items.push({ profit: 1 + rng.int(900), weight: w });
                totalWeight += w;
              }
              const capacity = Math.floor(totalWeight / 3);

              [0, 0.5, 0.2, 0.05].forEach(function (epsilon) {
                const got = knapsackFptas(items, capacity, epsilon);
                let weight = 0;
                let value = 0;
                got.chosen.forEach(function (i) {
                  weight += items[i].weight;
                  value += items[i].profit;
                });
                api.assert.atMost(weight, capacity,
                  'over capacity at eps=' + epsilon + ': ' + weight + ' > ' + capacity);
                api.assert.equal(got.weight, weight, 'the reported weight must be the true one');
                api.assert.equal(got.value, value, 'the reported value must be the TRUE profit');
              });
            }
          }
        },
        {
          name: 'the table shrinks as ε grows, and the scale crosses 1 where it stops helping',
          assert: function (knapsackFptas, api) {
            const rng = api.Random.seeded(5);
            const items = [];
            let totalWeight = 0;
            for (let i = 0; i < 20; i += 1) {
              const w = 1 + rng.int(1000);
              items.push({ profit: w + 100, weight: w });
              totalWeight += w;
            }
            const capacity = Math.floor(totalWeight / 2);
            const exact = knapsackFptas(items, capacity, 0);
            const loose = knapsackFptas(items, capacity, 0.5);
            const tight = knapsackFptas(items, capacity, 0.01);

            api.assert.atLeast(exact.cells, loose.cells * 5,
              'at eps=0.5 the table must be far smaller than the exact one: ' + loose.cells +
                ' against ' + exact.cells);
            api.assert.atLeast(loose.scale, 1, 'the divisor at eps=0.5 must exceed 1');
            api.assert.atMost(tight.scale, 1,
              'at eps=0.01 the divisor falls below 1, so the table grows: ' + tight.scale);
            api.assert.atLeast(tight.cells, exact.cells,
              'and the "approximate" table is then no smaller than the exact one');
          }
        },
        {
          name: 'it beats density greedy on the instance greedy is unbounded on',
          assert: function (knapsackFptas, api) {
            const capacity = 100;
            const items = [{ profit: 2, weight: 1 }, { profit: capacity, weight: capacity }];
            const got = knapsackFptas(items, capacity, 0.5);

            api.assert.equal(got.value, capacity,
              'the heavy item alone is optimal at ' + capacity + ', got ' + got.value);
            api.assert.atMost(got.weight, capacity, 'and it must fit');
          }
        }
      ]
    }],

    'derandomisation': [{
      id: 'conditional-expectation-max-cut',
      title: 'Derandomised MAX-CUT by conditional expectations',
      prompt: 'deterministicCut(n, edges) must produce a cut of at least |E|/2 on every input, ' +
        'with no randomness at all. Decide the vertices in order 0, 1, …, n − 1. With the first ' +
        'v vertices decided, the conditional expectation of the final cut is (the edges already ' +
        'cut) + (the edges with at least one undecided endpoint) / 2 — so the difference between ' +
        'putting v on side 0 and on side 1 is exactly the weight of its edges to already-decided ' +
        'vertices on each side. Take the larger, breaking ties either way. Return ' +
        '{ side, cut, bound, trace } where `side` is the 0/1 array, `cut` is the achieved cut, ' +
        '`bound` is |E|/2 and `trace` has one entry { vertex, ifZero, ifOne, chose, expectation } ' +
        'per vertex, with `expectation` the conditional expectation AFTER the decision. The ' +
        'starter alternates sides by vertex index, which is deterministic and meets no bound.',
      entry: 'deterministicCut',
      starter: [
        'function deterministicCut(n, edges) {',
        '  // alternate: even vertices left, odd vertices right',
        '  const side = [];',
        '  const trace = [];',
        '  for (let v = 0; v < n; v += 1) {',
        '    side.push(v % 2);',
        '    trace.push({ vertex: v, ifZero: 0, ifOne: 0, chose: v % 2, expectation: 0 });',
        '  }',
        '  let cut = 0;',
        '  edges.forEach(function (edge) {',
        '    if (side[edge.from] !== side[edge.to]) cut += 1;',
        '  });',
        '  return { side: side, cut: cut, bound: edges.length / 2, trace: trace };',
        '}'
      ].join('\n'),
      solution: [
        'function deterministicCut(n, edges) {',
        '  const adjacency = [];',
        '  for (let i = 0; i < n; i += 1) adjacency.push([]);',
        '  for (let e = 0; e < edges.length; e += 1) {',
        '    adjacency[edges[e].from].push(edges[e].to);',
        '    adjacency[edges[e].to].push(edges[e].from);',
        '  }',
        '',
        '  const side = new Array(n).fill(-1);',
        '  const trace = [];',
        '',
        '  function expectationAfter(decided) {',
        '    let sure = 0;',
        '    let halved = 0;',
        '    for (let e = 0; e < edges.length; e += 1) {',
        '      if (edges[e].from >= decided || edges[e].to >= decided) { halved += 1; continue; }',
        '      if (side[edges[e].from] !== side[edges[e].to]) sure += 1;',
        '    }',
        '    return sure + halved / 2;',
        '  }',
        '',
        '  for (let v = 0; v < n; v += 1) {',
        '    let toZero = 0;',
        '    let toOne = 0;',
        '    for (let i = 0; i < adjacency[v].length; i += 1) {',
        '      const u = adjacency[v][i];',
        '      if (side[u] === 0) toOne += 1;',
        '      if (side[u] === 1) toZero += 1;',
        '    }',
        '    side[v] = toOne >= toZero ? 1 : 0;',
        '    trace.push({ vertex: v, ifZero: toZero, ifOne: toOne, chose: side[v],',
        '      expectation: expectationAfter(v + 1) });',
        '  }',
        '',
        '  let cut = 0;',
        '  for (let e = 0; e < edges.length; e += 1) {',
        '    if (side[edges[e].from] !== side[edges[e].to]) cut += 1;',
        '  }',
        '  return { side: side, cut: cut, bound: edges.length / 2, trace: trace };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'it meets |E|/2 on every random fixture',
          assert: function (deterministicCut, api) {
            for (let t = 0; t < 40; t += 1) {
              const rng = api.Random.seeded(t * 37 + 2);
              const n = 8 + rng.int(9);
              const edges = [];
              const seen = {};
              for (let i = 0; i < n; i += 1) {
                for (let j = i + 1; j < n; j += 1) {
                  if (rng.next() >= 0.4) continue;
                  const key = i + '-' + j;
                  if (seen[key]) continue;
                  seen[key] = true;
                  edges.push({ from: i, to: j });
                }
              }
              if (edges.length === 0) continue;
              const got = deterministicCut(n, edges);

              api.assert.atLeast(got.cut, edges.length / 2,
                'instance ' + t + ': cut ' + got.cut + ' against a bound of ' + (edges.length / 2));
              api.assert.equal(got.bound, edges.length / 2, 'the reported bound must be |E|/2');
            }
          }
        },
        {
          name: 'the conditional expectation never falls along the walk',
          assert: function (deterministicCut, api) {
            for (let t = 0; t < 20; t += 1) {
              const rng = api.Random.seeded(t * 19 + 6);
              const n = 12;
              const edges = [];
              for (let i = 0; i < n; i += 1) {
                for (let j = i + 1; j < n; j += 1) {
                  if (rng.next() < 0.5) edges.push({ from: i, to: j });
                }
              }
              if (edges.length === 0) continue;
              const got = deterministicCut(n, edges);

              let previous = edges.length / 2;
              got.trace.forEach(function (step) {
                api.assert.atLeast(step.expectation, previous - 1e-9,
                  'the expectation fell at vertex ' + step.vertex + ': ' + step.expectation +
                    ' after ' + previous);
                previous = step.expectation;
              });
              api.assert.closeTo(previous, got.cut, 1e-9,
                'when everything is decided the expectation IS the cut');
            }
          }
        },
        {
          name: 'it beats the mean of 200 random assignments on every fixture',
          assert: function (deterministicCut, api) {
            for (let t = 0; t < 10; t += 1) {
              const rng = api.Random.seeded(t * 41 + 8);
              const n = 14;
              const edges = [];
              for (let i = 0; i < n; i += 1) {
                for (let j = i + 1; j < n; j += 1) {
                  if (rng.next() < 0.45) edges.push({ from: i, to: j });
                }
              }
              if (edges.length === 0) continue;
              const got = deterministicCut(n, edges);

              let total = 0;
              for (let s = 0; s < 200; s += 1) {
                const coin = api.Random.seeded(s * 7 + t + 1);
                const side = [];
                for (let v = 0; v < n; v += 1) side.push(coin.int(2));
                let cut = 0;
                edges.forEach(function (edge) {
                  if (side[edge.from] !== side[edge.to]) cut += 1;
                });
                total += cut;
              }
              api.assert.atLeast(got.cut, total / 200,
                'instance ' + t + ': deterministic ' + got.cut + ' against a random mean of ' +
                  (total / 200));
            }
          }
        },
        {
          name: 'on a complete bipartite graph it finds the maximum cut exactly',
          assert: function (deterministicCut, api) {
            [3, 4, 5].forEach(function (half) {
              const n = 2 * half;
              const edges = [];
              /* Vertices 0..half-1 on one side, half..n-1 on the other, every crossing
                 edge present: the maximum cut is all of them. */
              for (let i = 0; i < half; i += 1) {
                for (let j = half; j < n; j += 1) edges.push({ from: i, to: j });
              }
              const got = deterministicCut(n, edges);

              api.assert.equal(got.cut, edges.length,
                'K' + half + ',' + half + ' has a cut of every edge; got ' + got.cut +
                  ' of ' + edges.length);
            });
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));

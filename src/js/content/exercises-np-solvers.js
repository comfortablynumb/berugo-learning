/**
 * Graded exercises for solvers, hardness in practice and the workshop (M20.7-M20.9).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'using-solvers': [{
      id: 'colouring-to-cnf',
      title: 'Encode graph colouring into CNF, with the at-most-one form as a parameter',
      prompt: 'encodeColouring(graph, colours, options) must build a CNF that is satisfiable ' +
        'exactly when the graph has a proper colouring. `graph` is { n, edges: [{ from, to }] }. ' +
        'Use variable v·colours + c + 1 for "vertex v takes colour c" with c from 1 to colours. ' +
        'Every vertex needs exactly one colour and no edge may be monochromatic. ' +
        '`options.encoding` selects the at-most-one form: "pairwise" is one clause per pair of ' +
        'colours, and "sequential" is the Sinz counter, which allocates one fresh variable per ' +
        'colour after the first and costs three clause families. `options.symmetryBreaking` ' +
        'adds unit clauses fixing a greedily grown clique to colours 1, 2, 3, … Return ' +
        '{ variables, clauses, auxiliary, symmetryClauses }. The starter emits the edge ' +
        'constraints only, which every all-uncoloured assignment satisfies.',
      entry: 'encodeColouring',
      starter: [
        'function encodeColouring(graph, colours, options) {',
        '  // Edges only: nothing says a vertex must take a colour, so leaving every',
        '  // variable false satisfies the whole formula.',
        '  const clauses = [];',
        '  graph.edges.forEach(function (edge) {',
        '    for (let c = 1; c <= colours; c += 1) {',
        '      clauses.push([-(edge.from * colours + c), -(edge.to * colours + c)]);',
        '    }',
        '  });',
        '  return { variables: graph.n * colours, clauses: clauses, auxiliary: 0,',
        '    symmetryClauses: 0 };',
        '}'
      ].join('\n'),
      solution: [
        'function encodeColouring(graph, colours, options) {',
        '  const settings = options || {};',
        '  const counter = { next: graph.n * colours };',
        '  const clauses = [];',
        '  let auxiliary = 0;',
        '',
        '  function colourVar(v, c) { return v * colours + c; }',
        '',
        '  function atMostOne(literals) {',
        '    if (settings.encoding !== "sequential" || literals.length <= 1) {',
        '      for (let i = 0; i < literals.length; i += 1) {',
        '        for (let j = i + 1; j < literals.length; j += 1) {',
        '          clauses.push([-literals[i], -literals[j]]);',
        '        }',
        '      }',
        '      return;',
        '    }',
        '    const n = literals.length;',
        '    const s = [];',
        '    for (let i = 0; i < n - 1; i += 1) { counter.next += 1; s.push(counter.next); }',
        '    auxiliary += n - 1;',
        '    clauses.push([-literals[0], s[0]]);',
        '    clauses.push([-literals[n - 1], -s[n - 2]]);',
        '    for (let i = 1; i < n - 1; i += 1) {',
        '      clauses.push([-literals[i], s[i]]);',
        '      clauses.push([-s[i - 1], s[i]]);',
        '      clauses.push([-literals[i], -s[i - 1]]);',
        '    }',
        '  }',
        '',
        '  for (let v = 0; v < graph.n; v += 1) {',
        '    const literals = [];',
        '    for (let c = 1; c <= colours; c += 1) literals.push(colourVar(v, c));',
        '    clauses.push(literals.slice());',
        '    atMostOne(literals);',
        '  }',
        '  graph.edges.forEach(function (edge) {',
        '    for (let c = 1; c <= colours; c += 1) {',
        '      clauses.push([-colourVar(edge.from, c), -colourVar(edge.to, c)]);',
        '    }',
        '  });',
        '',
        '  let symmetryClauses = 0;',
        '  if (settings.symmetryBreaking) {',
        '    const adjacency = [];',
        '    for (let v = 0; v < graph.n; v += 1) adjacency.push(new Set());',
        '    graph.edges.forEach(function (edge) {',
        '      adjacency[edge.from].add(edge.to);',
        '      adjacency[edge.to].add(edge.from);',
        '    });',
        '    const order = [];',
        '    for (let v = 0; v < graph.n; v += 1) order.push(v);',
        '    order.sort(function (a, b) { return adjacency[b].size - adjacency[a].size; });',
        '    const clique = [];',
        '    order.forEach(function (v) {',
        '      const joins = clique.every(function (u) { return adjacency[v].has(u); });',
        '      if (joins) clique.push(v);',
        '    });',
        '    clique.slice(0, colours).forEach(function (v, index) {',
        '      clauses.push([colourVar(v, index + 1)]);',
        '      symmetryClauses += 1;',
        '    });',
        '  }',
        '  return { variables: counter.next, clauses: clauses, auxiliary: auxiliary,',
        '    symmetryClauses: symmetryClauses };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the encoding agrees with a direct colouring search, both encodings',
          assert: function (encodeColouring, api) {
            /* A small DPLL rather than a mask sweep: the sequential encoding
               adds auxiliary variables, and 2^25 masks is both slow and — when
               a cap silently returns null — a source of false "satisfiable". */
            function solve(formula) {
              const assignment = new Array(formula.variables).fill(0);
              function value(literal) {
                const v = assignment[Math.abs(literal) - 1];
                if (v === 0) return 0;
                return (literal > 0) === (v === 1) ? 1 : -1;
              }
              function propagate(trail) {
                let moved = true;
                while (moved) {
                  moved = false;
                  for (let c = 0; c < formula.clauses.length; c += 1) {
                    const clause = formula.clauses[c];
                    let open = 0;
                    let unit = 0;
                    let satisfied = false;
                    for (let i = 0; i < clause.length; i += 1) {
                      const v = value(clause[i]);
                      if (v === 1) { satisfied = true; break; }
                      if (v === 0) { open += 1; unit = clause[i]; }
                    }
                    if (satisfied) continue;
                    if (open === 0) return false;
                    if (open > 1) continue;
                    assignment[Math.abs(unit) - 1] = unit > 0 ? 1 : -1;
                    trail.push(Math.abs(unit) - 1);
                    moved = true;
                  }
                }
                return true;
              }
              function search() {
                const trail = [];
                if (!propagate(trail)) {
                  while (trail.length) assignment[trail.pop()] = 0;
                  return false;
                }
                let next = 0;
                for (let i = 0; i < assignment.length; i += 1) {
                  if (assignment[i] === 0) { next = i + 1; break; }
                }
                if (next === 0) return true;
                for (let side = 0; side < 2; side += 1) {
                  assignment[next - 1] = side === 0 ? 1 : -1;
                  trail.push(next - 1);
                  if (search()) return true;
                  assignment[next - 1] = 0;
                  trail.pop();
                }
                while (trail.length) assignment[trail.pop()] = 0;
                return false;
              }
              return search() ? assignment.slice() : null;
            }
            function colourable(graph, colours) {
              const assignment = new Array(graph.n).fill(-1);
              function walk(v) {
                if (v === graph.n) return true;
                for (let c = 0; c < colours; c += 1) {
                  let ok = true;
                  for (let i = 0; i < graph.edges.length && ok; i += 1) {
                    const edge = graph.edges[i];
                    if (edge.from === v && assignment[edge.to] === c) ok = false;
                    if (edge.to === v && assignment[edge.from] === c) ok = false;
                  }
                  if (!ok) continue;
                  assignment[v] = c;
                  if (walk(v + 1)) return true;
                  assignment[v] = -1;
                }
                return false;
              }
              return walk(0);
            }

            for (let t = 0; t < 10; t += 1) {
              const rng = api.Random.seeded(t * 7 + 1);
              const n = 5;
              const edges = [];
              for (let a = 0; a < n; a += 1) {
                for (let b = a + 1; b < n; b += 1) {
                  if (rng.next() < 0.55) edges.push({ from: a, to: b });
                }
              }
              const graph = { n: n, edges: edges };
              [2, 3].forEach(function (colours) {
                const truth = colourable(graph, colours);
                ['pairwise', 'sequential'].forEach(function (encoding) {
                  const built = encodeColouring(graph, colours, { encoding: encoding });
                  const found = solve(built);
                  api.assert.equal(found !== null, truth,
                    'instance ' + t + ' colours ' + colours + ' encoding ' + encoding +
                      ': expected ' + truth);
                });
              });
            }
          }
        },
        {
          name: 'a satisfying assignment decodes to a proper colouring',
          assert: function (encodeColouring, api) {
            /* A small DPLL rather than a mask sweep: the sequential encoding
               adds auxiliary variables, and 2^25 masks is both slow and — when
               a cap silently returns null — a source of false "satisfiable". */
            function solve(formula) {
              const assignment = new Array(formula.variables).fill(0);
              function value(literal) {
                const v = assignment[Math.abs(literal) - 1];
                if (v === 0) return 0;
                return (literal > 0) === (v === 1) ? 1 : -1;
              }
              function propagate(trail) {
                let moved = true;
                while (moved) {
                  moved = false;
                  for (let c = 0; c < formula.clauses.length; c += 1) {
                    const clause = formula.clauses[c];
                    let open = 0;
                    let unit = 0;
                    let satisfied = false;
                    for (let i = 0; i < clause.length; i += 1) {
                      const v = value(clause[i]);
                      if (v === 1) { satisfied = true; break; }
                      if (v === 0) { open += 1; unit = clause[i]; }
                    }
                    if (satisfied) continue;
                    if (open === 0) return false;
                    if (open > 1) continue;
                    assignment[Math.abs(unit) - 1] = unit > 0 ? 1 : -1;
                    trail.push(Math.abs(unit) - 1);
                    moved = true;
                  }
                }
                return true;
              }
              function search() {
                const trail = [];
                if (!propagate(trail)) {
                  while (trail.length) assignment[trail.pop()] = 0;
                  return false;
                }
                let next = 0;
                for (let i = 0; i < assignment.length; i += 1) {
                  if (assignment[i] === 0) { next = i + 1; break; }
                }
                if (next === 0) return true;
                for (let side = 0; side < 2; side += 1) {
                  assignment[next - 1] = side === 0 ? 1 : -1;
                  trail.push(next - 1);
                  if (search()) return true;
                  assignment[next - 1] = 0;
                  trail.pop();
                }
                while (trail.length) assignment[trail.pop()] = 0;
                return false;
              }
              return search() ? assignment.slice() : null;
            }

            const graph = { n: 5, colours: 3, edges: [{ from: 0, to: 1 }, { from: 1, to: 2 },
              { from: 2, to: 3 }, { from: 3, to: 4 }, { from: 4, to: 0 }] };
            const built = encodeColouring(graph, 3, { encoding: 'pairwise' });
            const model = solve(built);
            api.assert.equal(model !== null, true, 'a 5-cycle is 3-colourable');

            const colouring = [];
            for (let v = 0; v < graph.n; v += 1) {
              let found = -1;
              for (let c = 1; c <= 3; c += 1) {
                if (model[v * 3 + c - 1] === 1) {
                  api.assert.equal(found, -1, 'vertex ' + v + ' must take exactly one colour');
                  found = c;
                }
              }
              api.assert.equal(found !== -1, true, 'vertex ' + v + ' must take a colour');
              colouring.push(found);
            }
            graph.edges.forEach(function (edge) {
              api.assert.equal(colouring[edge.from] === colouring[edge.to], false,
                'edge ' + edge.from + '-' + edge.to + ' must not be monochromatic');
            });
          }
        },
        {
          name: 'symmetry breaking adds unit clauses and keeps the answer',
          assert: function (encodeColouring, api) {
            /* A small DPLL rather than a mask sweep: the sequential encoding
               adds auxiliary variables, and 2^25 masks is both slow and — when
               a cap silently returns null — a source of false "satisfiable". */
            function solve(formula) {
              const assignment = new Array(formula.variables).fill(0);
              function value(literal) {
                const v = assignment[Math.abs(literal) - 1];
                if (v === 0) return 0;
                return (literal > 0) === (v === 1) ? 1 : -1;
              }
              function propagate(trail) {
                let moved = true;
                while (moved) {
                  moved = false;
                  for (let c = 0; c < formula.clauses.length; c += 1) {
                    const clause = formula.clauses[c];
                    let open = 0;
                    let unit = 0;
                    let satisfied = false;
                    for (let i = 0; i < clause.length; i += 1) {
                      const v = value(clause[i]);
                      if (v === 1) { satisfied = true; break; }
                      if (v === 0) { open += 1; unit = clause[i]; }
                    }
                    if (satisfied) continue;
                    if (open === 0) return false;
                    if (open > 1) continue;
                    assignment[Math.abs(unit) - 1] = unit > 0 ? 1 : -1;
                    trail.push(Math.abs(unit) - 1);
                    moved = true;
                  }
                }
                return true;
              }
              function search() {
                const trail = [];
                if (!propagate(trail)) {
                  while (trail.length) assignment[trail.pop()] = 0;
                  return false;
                }
                let next = 0;
                for (let i = 0; i < assignment.length; i += 1) {
                  if (assignment[i] === 0) { next = i + 1; break; }
                }
                if (next === 0) return true;
                for (let side = 0; side < 2; side += 1) {
                  assignment[next - 1] = side === 0 ? 1 : -1;
                  trail.push(next - 1);
                  if (search()) return true;
                  assignment[next - 1] = 0;
                  trail.pop();
                }
                while (trail.length) assignment[trail.pop()] = 0;
                return false;
              }
              return search() ? assignment.slice() : null;
            }

            /* K4 asked for 3 colours is a NO; asked for 4 it is a YES. Symmetry
               breaking must not change either answer. */
            const k4 = { n: 4, edges: [{ from: 0, to: 1 }, { from: 0, to: 2 }, { from: 0, to: 3 },
              { from: 1, to: 2 }, { from: 1, to: 3 }, { from: 2, to: 3 }] };
            [[3, false], [4, true]].forEach(function (item) {
              const colours = item[0];
              const expected = item[1];
              const plain = encodeColouring(k4, colours, { encoding: 'pairwise' });
              const broken = encodeColouring(k4, colours,
                { encoding: 'pairwise', symmetryBreaking: true });
              api.assert.equal(solve(plain) !== null, expected,
                colours + ' colours without symmetry breaking');
              api.assert.equal(solve(broken) !== null, expected,
                colours + ' colours with symmetry breaking must give the same answer');
              api.assert.atLeast(broken.symmetryClauses, 3,
                'a clique of 4 must contribute at least 3 unit clauses at ' + colours + ' colours');
              api.assert.atLeast(broken.clauses.length, plain.clauses.length + 3,
                'the extra clauses must actually be in the formula');
            });
          }
        },
        {
          name: 'the sequential encoding is smaller in clauses and larger in variables',
          assert: function (encodeColouring, api) {
            const graph = { n: 6, edges: [{ from: 0, to: 1 }, { from: 1, to: 2 }] };
            const pairwise = encodeColouring(graph, 12, { encoding: 'pairwise' });
            const sequential = encodeColouring(graph, 12, { encoding: 'sequential' });

            api.assert.equal(pairwise.auxiliary, 0, 'pairwise introduces no variables');
            api.assert.atLeast(sequential.auxiliary, 6 * 11,
              'the sequential counter needs colours − 1 variables per vertex');
            api.assert.atMost(sequential.clauses.length, pairwise.clauses.length,
              'at twelve colours the counter must be the smaller formula: ' +
                sequential.clauses.length + ' against ' + pairwise.clauses.length);
          }
        }
      ]
    }],

    'hardness-in-practice': [{
      id: 'restart-wrapper',
      title: 'A restart wrapper around a stochastic solver, and the cutoff that helps',
      prompt: 'withRestarts(solve, cutoff, cap, seeds) must run a stochastic solver under a ' +
        'restart strategy and report the distribution. `solve(seed, maxFlips)` returns ' +
        '{ found, flips } and is the given solver — call it, do not reimplement it. For each ' +
        'seed in `seeds`, run attempts until one succeeds or the total flips reach `cap`, ' +
        'charging every attempt at most `cutoff` flips and never letting the total exceed ' +
        '`cap`. Use seed for the first attempt of a trial and seed·100003 + attempt·17 + 3 for ' +
        'later ones, so the first attempt matches an unrestarted run exactly. Return ' +
        '{ solved, restarts, median, mean, worst, totals } where `totals` is one number per ' +
        'seed. A cutoff of zero or one at least as large as `cap` means no restarts at all. ' +
        'The starter runs one attempt per seed with no cutoff, which is the baseline.',
      entry: 'withRestarts',
      starter: [
        'function withRestarts(solve, cutoff, cap, seeds) {',
        '  // One attempt per seed, no cutoff: the no-restart baseline.',
        '  const totals = [];',
        '  let solved = 0;',
        '  seeds.forEach(function (seed) {',
        '    const run = solve(seed, cap);',
        '    if (run.found) solved += 1;',
        '    totals.push(run.flips);',
        '  });',
        '  const sorted = totals.slice().sort(function (a, b) { return a - b; });',
        '  let sum = 0;',
        '  totals.forEach(function (v) { sum += v; });',
        '  return { solved: solved, restarts: 0, median: sorted[Math.floor(sorted.length / 2)],',
        '    mean: sum / totals.length, worst: sorted[sorted.length - 1], totals: totals };',
        '}'
      ].join('\n'),
      solution: [
        'function withRestarts(solve, cutoff, cap, seeds) {',
        '  const totals = [];',
        '  let solved = 0;',
        '  let restarts = 0;',
        '  const limit = cutoff > 0 ? cutoff : cap;',
        '',
        '  seeds.forEach(function (seed) {',
        '    let spent = 0;',
        '    let attempt = 0;',
        '    let done = false;',
        '    while (spent < cap && !done) {',
        '      const useSeed = attempt === 0 ? seed : seed * 100003 + attempt * 17 + 3;',
        '      const run = solve(useSeed, Math.min(limit, cap - spent));',
        '      spent += run.flips;',
        '      attempt += 1;',
        '      done = run.found;',
        '    }',
        '    restarts += attempt - 1;',
        '    if (done) solved += 1;',
        '    totals.push(spent);',
        '  });',
        '',
        '  const sorted = totals.slice().sort(function (a, b) { return a - b; });',
        '  let sum = 0;',
        '  totals.forEach(function (v) { sum += v; });',
        '  return { solved: solved, restarts: restarts,',
        '    median: sorted[Math.floor(sorted.length / 2)], mean: sum / totals.length,',
        '    worst: sorted[sorted.length - 1], totals: totals };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'a cutoff above the median cuts the tail and barely moves the median',
          assert: function (withRestarts, api) {
            /* A synthetic heavy-tailed solver: most seeds finish quickly, a few
               take a very long time, and the flip count is deterministic in the
               seed so both columns see the same stream. */
            function solve(seed, maxFlips) {
              const rng = api.Random.seeded(seed);
              const draw = rng.next();
              const need = draw < 0.85 ? 40 + Math.floor(rng.next() * 60)
                : 900 + Math.floor(rng.next() * 3000);
              if (need <= maxFlips) return { found: true, flips: need };
              return { found: false, flips: maxFlips };
            }
            const seeds = [];
            for (let s = 1; s <= 120; s += 1) seeds.push(s);

            const plain = withRestarts(solve, 0, 20000, seeds);
            const cut = withRestarts(solve, 200, 20000, seeds);

            api.assert.equal(plain.solved, seeds.length, 'the baseline must solve every seed');
            api.assert.equal(cut.solved, seeds.length, 'and so must the restart strategy');
            api.assert.atMost(cut.mean, plain.mean * 0.8,
              'restarting must cut the mean substantially: ' + cut.mean + ' against ' + plain.mean);
            api.assert.atMost(cut.worst, plain.worst,
              'and it must cut the worst case: ' + cut.worst + ' against ' + plain.worst);
            api.assert.atLeast(cut.restarts, 5, 'it must actually have restarted');
          }
        },
        {
          name: 'a cutoff below the body of the distribution makes things worse',
          assert: function (withRestarts, api) {
            function solve(seed, maxFlips) {
              const rng = api.Random.seeded(seed);
              const draw = rng.next();
              const need = draw < 0.85 ? 40 + Math.floor(rng.next() * 60)
                : 900 + Math.floor(rng.next() * 3000);
              if (need <= maxFlips) return { found: true, flips: need };
              return { found: false, flips: maxFlips };
            }
            const seeds = [];
            for (let s = 1; s <= 120; s += 1) seeds.push(s);

            const plain = withRestarts(solve, 0, 20000, seeds);
            const tooShort = withRestarts(solve, 20, 20000, seeds);

            api.assert.atLeast(tooShort.mean, plain.mean,
              'a cutoff below every run must not help: ' + tooShort.mean + ' against ' + plain.mean);
            api.assert.atLeast(tooShort.restarts, 200,
              'and it must burn a great many restarts doing it: ' + tooShort.restarts);
          }
        },
        {
          name: 'the cap is respected and the first attempt matches the unrestarted run',
          assert: function (withRestarts, api) {
            const calls = [];
            function solve(seed, maxFlips) {
              calls.push({ seed: seed, maxFlips: maxFlips });
              const need = seed % 7 === 0 ? 50 : 5000;
              if (need <= maxFlips) return { found: true, flips: need };
              return { found: false, flips: maxFlips };
            }
            const seeds = [7, 14, 3];
            const got = withRestarts(solve, 100, 450, seeds);

            got.totals.forEach(function (total, index) {
              api.assert.atMost(total, 450,
                'seed ' + seeds[index] + ' spent ' + total + ', above the cap of 450');
            });
            api.assert.equal(calls[0].seed, 7,
              'the first attempt of the first trial must use the seed itself');
            api.assert.atMost(calls[0].maxFlips, 100,
              'and it must be charged at most the cutoff');
            api.assert.equal(got.solved, 2, 'seeds 7 and 14 finish; seed 3 never does');
          }
        }
      ]
    }],

    'reduction-workshop': [{
      id: 'roster-validator',
      title: 'Validate a produced roster against every stated requirement',
      prompt: 'validateRoster(spec, schedule) must check a finished schedule against the ' +
        'requirements directly, in the requirements’ own terms. `spec` is { nurses, days, ' +
        'shifts, demand, maxShifts, restWindow } where `shifts` is an array of names and ' +
        '`demand[s]` is the headcount required on shift s every day. `schedule[nurse][day]` is ' +
        'a shift index, or −1 for a rest day. Check five things and report each separately: ' +
        'every cell is a valid shift index or −1; every (day, shift) has exactly its demand; no ' +
        'nurse works a "day" shift the morning after a "night" shift; no nurse exceeds ' +
        'maxShifts over the horizon; and every window of restWindow consecutive days contains ' +
        'at least one rest day for every nurse. Return { satisfied, checks } where `checks` is ' +
        'one entry per requirement, each { id, ok, failures } with `failures` the count. The ' +
        'starter reports everything as holding, which is a validator that validates nothing.',
      entry: 'validateRoster',
      starter: [
        'function validateRoster(spec, schedule) {',
        '  // Says yes to everything, including a roster that leaves every shift empty.',
        '  const ids = ["cells", "demand", "no-day-after-night", "workload", "rest"];',
        '  return {',
        '    satisfied: true,',
        '    checks: ids.map(function (id) { return { id: id, ok: true, failures: 0 }; })',
        '  };',
        '}'
      ].join('\n'),
      solution: [
        'function validateRoster(spec, schedule) {',
        '  const checks = [];',
        '',
        '  function record(id, failures) {',
        '    checks.push({ id: id, ok: failures === 0, failures: failures });',
        '  }',
        '',
        '  let badCells = 0;',
        '  for (let nurse = 0; nurse < spec.nurses; nurse += 1) {',
        '    const row = schedule[nurse] || [];',
        '    if (row.length !== spec.days) { badCells += 1; continue; }',
        '    for (let day = 0; day < spec.days; day += 1) {',
        '      const shift = row[day];',
        '      if (!Number.isInteger(shift) || shift < -1 || shift >= spec.shifts.length) {',
        '        badCells += 1;',
        '      }',
        '    }',
        '  }',
        '  record("cells", badCells);',
        '',
        '  let demandFailures = 0;',
        '  for (let day = 0; day < spec.days; day += 1) {',
        '    for (let s = 0; s < spec.shifts.length; s += 1) {',
        '      let count = 0;',
        '      for (let nurse = 0; nurse < spec.nurses; nurse += 1) {',
        '        if (schedule[nurse] && schedule[nurse][day] === s) count += 1;',
        '      }',
        '      if (count !== spec.demand[s]) demandFailures += 1;',
        '    }',
        '  }',
        '  record("demand", demandFailures);',
        '',
        '  const night = spec.shifts.indexOf("night");',
        '  const dayShift = spec.shifts.indexOf("day");',
        '  let sequenceFailures = 0;',
        '  if (night !== -1 && dayShift !== -1) {',
        '    for (let nurse = 0; nurse < spec.nurses; nurse += 1) {',
        '      const row = schedule[nurse] || [];',
        '      for (let day = 0; day + 1 < spec.days; day += 1) {',
        '        if (row[day] === night && row[day + 1] === dayShift) sequenceFailures += 1;',
        '      }',
        '    }',
        '  }',
        '  record("no-day-after-night", sequenceFailures);',
        '',
        '  let workloadFailures = 0;',
        '  for (let nurse = 0; nurse < spec.nurses; nurse += 1) {',
        '    const row = schedule[nurse] || [];',
        '    let worked = 0;',
        '    for (let day = 0; day < spec.days; day += 1) { if (row[day] >= 0) worked += 1; }',
        '    if (worked > spec.maxShifts) workloadFailures += 1;',
        '  }',
        '  record("workload", workloadFailures);',
        '',
        '  let restFailures = 0;',
        '  for (let nurse = 0; nurse < spec.nurses; nurse += 1) {',
        '    const row = schedule[nurse] || [];',
        '    for (let start = 0; start + spec.restWindow <= spec.days; start += 1) {',
        '      let rested = false;',
        '      for (let day = start; day < start + spec.restWindow; day += 1) {',
        '        if (row[day] < 0) rested = true;',
        '      }',
        '      if (!rested) restFailures += 1;',
        '    }',
        '  }',
        '  record("rest", restFailures);',
        '',
        '  return {',
        '    satisfied: checks.every(function (check) { return check.ok; }),',
        '    checks: checks',
        '  };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'a correct roster passes every check',
          assert: function (validateRoster, api) {
            const spec = { nurses: 6, days: 6, shifts: ['day', 'evening', 'night'],
              demand: [1, 1, 1], maxShifts: 3, restWindow: 3 };
            /* Alternate days: three nurses work the odd days and three the even
               ones, so nobody works two days running. That satisfies the rest
               window by construction and makes a night-then-day pair
               impossible, which is what a fixture for "everything holds" has to
               do rather than merely look plausible. */
            const schedule = [
              [-1, 0, -1, 0, -1, 0],
              [-1, 1, -1, 1, -1, 1],
              [-1, 2, -1, 2, -1, 2],
              [0, -1, 0, -1, 0, -1],
              [1, -1, 1, -1, 1, -1],
              [2, -1, 2, -1, 2, -1]
            ];
            const got = validateRoster(spec, schedule);
            api.assert.equal(got.satisfied, true,
              'this roster satisfies every requirement; failures: ' +
                got.checks.filter(function (c) { return !c.ok; })
                  .map(function (c) { return c.id; }).join(', '));
            api.assert.atLeast(got.checks.length, 5, 'every requirement must be reported');
          }
        },
        {
          name: 'each requirement fails on its own, and only its own check reports it',
          assert: function (validateRoster, api) {
            const spec = { nurses: 6, days: 6, shifts: ['day', 'evening', 'night'],
              demand: [1, 1, 1], maxShifts: 3, restWindow: 3 };
            const good = [
              [-1, 0, -1, 0, -1, 0],
              [-1, 1, -1, 1, -1, 1],
              [-1, 2, -1, 2, -1, 2],
              [0, -1, 0, -1, 0, -1],
              [1, -1, 1, -1, 1, -1],
              [2, -1, 2, -1, 2, -1]
            ];

            function copy(rows) { return rows.map(function (row) { return row.slice(); }); }

            const shortDemand = copy(good);
            shortDemand[0][1] = -1;
            let got = validateRoster(spec, shortDemand);
            api.assert.equal(got.satisfied, false, 'an uncovered shift must fail');
            api.assert.equal(got.checks.filter(function (c) { return c.id === 'demand'; })[0].ok,
              false, 'and it must be the demand check that says so');

            const overworked = copy(good);
            overworked[3][1] = 0;
            overworked[0][1] = -1;
            got = validateRoster(spec, overworked);
            api.assert.equal(got.satisfied, false, 'a broken roster must fail somewhere');

            const badCell = copy(good);
            badCell[1][1] = 9;
            got = validateRoster(spec, badCell);
            api.assert.equal(got.checks.filter(function (c) { return c.id === 'cells'; })[0].ok,
              false, 'a shift index outside the palette must be caught');
          }
        },
        {
          name: 'the night-then-day rule and the rest window are checked separately',
          assert: function (validateRoster, api) {
            const spec = { nurses: 3, days: 4, shifts: ['day', 'evening', 'night'],
              demand: [1, 1, 1], maxShifts: 4, restWindow: 4 };
            /* Nurse 0 works nights on day 0 and days on day 1, and nurse 2 works
               nights on day 1 and days on day 2: two violations of the sequence
               rule, and nobody rests in the window of 4. */
            const schedule = [
              [2, 0, 1, 0],
              [0, 1, 2, 1],
              [1, 2, 0, 2]
            ];
            const got = validateRoster(spec, schedule);
            const byId = {};
            got.checks.forEach(function (check) { byId[check.id] = check; });

            api.assert.equal(byId['no-day-after-night'].ok, false,
              'nurses 0 and 2 both work nights then days');
            api.assert.equal(byId['no-day-after-night'].failures, 2,
              'exactly two such violations, counted rather than flagged');
            api.assert.equal(byId.rest.ok, false, 'no nurse has a rest day in the window');
            api.assert.equal(byId.rest.failures, 3, 'one failure per nurse');
            api.assert.equal(byId.demand.ok, true, 'the demand is met on every shift');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));

/**
 * Graded exercises for decision problems, reductions and the SAT zoo (M20.1-M20.3).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'decision-problems': [{
      id: 'certificate-verifiers',
      title: 'Three verifiers that reject malformed certificates as firmly as wrong ones',
      prompt: 'verify(problem, instance, certificate) must check a certificate in polynomial ' +
        'time and count its own steps. `problem` is one of "hamiltonian", "subset-sum" or ' +
        '"colouring". For "hamiltonian", `instance` is { n, edges: [{ from, to }] } and the ' +
        'certificate is an array of n vertex indices forming a cycle. For "subset-sum", ' +
        '`instance` is { numbers, target } and the certificate is an array of indices whose ' +
        'numbers sum to the target. For "colouring", `instance` is { n, edges, colours } and ' +
        'the certificate is an array of n colour numbers in 0..colours−1 with no edge ' +
        'monochromatic. Return { accepted, reason, steps }: `reason` is null on acceptance and ' +
        'a non-empty string otherwise, and `steps` must stay linear in the instance — the tests ' +
        'measure it. A malformed certificate (wrong length, a repeated entry, an index or ' +
        'colour out of range, or anything that is not an array) must be REJECTED, never thrown ' +
        'and never accepted. The starter accepts everything, which is a verifier that means ' +
        'nothing.',
      entry: 'verify',
      starter: [
        'function verify(problem, instance, certificate) {',
        '  // Accepts anything at all, which is exactly the bug this exercise is about.',
        '  return { accepted: true, reason: null, steps: 1 };',
        '}'
      ].join('\n'),
      solution: [
        'function verify(problem, instance, certificate) {',
        '  const state = { steps: 0 };',
        '',
        '  function reject(reason) { return { accepted: false, reason: reason, steps: state.steps }; }',
        '  function accept() { return { accepted: true, reason: null, steps: state.steps }; }',
        '',
        '  function isPermutation(list, n) {',
        '    if (!Array.isArray(list) || list.length !== n) return false;',
        '    const seen = new Array(n).fill(false);',
        '    for (let i = 0; i < n; i += 1) {',
        '      state.steps += 1;',
        '      const v = list[i];',
        '      if (!Number.isInteger(v) || v < 0 || v >= n || seen[v]) return false;',
        '      seen[v] = true;',
        '    }',
        '    return true;',
        '  }',
        '',
        '  function edgeSet(edges) {',
        '    const set = new Set();',
        '    edges.forEach(function (edge) {',
        '      set.add(edge.from + ":" + edge.to);',
        '      set.add(edge.to + ":" + edge.from);',
        '    });',
        '    return set;',
        '  }',
        '',
        '  if (problem === "hamiltonian") {',
        '    if (!isPermutation(certificate, instance.n)) {',
        '      return reject("the certificate must list every vertex exactly once");',
        '    }',
        '    const set = edgeSet(instance.edges);',
        '    for (let i = 0; i < certificate.length; i += 1) {',
        '      state.steps += 1;',
        '      const from = certificate[i];',
        '      const to = certificate[(i + 1) % certificate.length];',
        '      if (!set.has(from + ":" + to)) return reject("no edge " + from + "-" + to);',
        '    }',
        '    return accept();',
        '  }',
        '',
        '  if (problem === "subset-sum") {',
        '    if (!Array.isArray(certificate)) return reject("the certificate must be a list of indices");',
        '    const used = new Set();',
        '    let total = 0;',
        '    for (let i = 0; i < certificate.length; i += 1) {',
        '      state.steps += 1;',
        '      const index = certificate[i];',
        '      if (!Number.isInteger(index) || index < 0 || index >= instance.numbers.length) {',
        '        return reject("index " + index + " is out of range");',
        '      }',
        '      if (used.has(index)) return reject("index " + index + " appears twice");',
        '      used.add(index);',
        '      total += instance.numbers[index];',
        '    }',
        '    if (total !== instance.target) {',
        '      return reject("the subset sums to " + total + ", not " + instance.target);',
        '    }',
        '    return accept();',
        '  }',
        '',
        '  if (!Array.isArray(certificate) || certificate.length !== instance.n) {',
        '    return reject("the certificate must give a colour to every vertex");',
        '  }',
        '  for (let v = 0; v < instance.n; v += 1) {',
        '    state.steps += 1;',
        '    const colour = certificate[v];',
        '    if (!Number.isInteger(colour) || colour < 0 || colour >= instance.colours) {',
        '      return reject("colour " + colour + " is outside the palette");',
        '    }',
        '  }',
        '  for (let i = 0; i < instance.edges.length; i += 1) {',
        '    state.steps += 1;',
        '    const edge = instance.edges[i];',
        '    if (certificate[edge.from] === certificate[edge.to]) {',
        '      return reject("edge " + edge.from + "-" + edge.to + " is monochromatic");',
        '    }',
        '  }',
        '  return accept();',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'a valid certificate is accepted for all three problems',
          assert: function (verify, api) {
            const cycle = { n: 5, edges: [{ from: 0, to: 1 }, { from: 1, to: 2 },
              { from: 2, to: 3 }, { from: 3, to: 4 }, { from: 4, to: 0 }] };
            api.assert.equal(verify('hamiltonian', cycle, [0, 1, 2, 3, 4]).accepted, true,
              'the cycle 0-1-2-3-4 must verify');
            api.assert.equal(verify('subset-sum', { numbers: [3, 9, 8, 4, 5], target: 17 },
              [1, 2]).accepted, true, '9 + 8 = 17 must verify');
            api.assert.equal(verify('colouring',
              { n: 4, colours: 3, edges: [{ from: 0, to: 1 }, { from: 1, to: 2 },
                { from: 2, to: 3 }] }, [0, 1, 0, 1]).accepted, true,
              'a proper colouring must verify');
          }
        },
        {
          name: 'a wrong certificate is rejected with a reason',
          assert: function (verify, api) {
            const cycle = { n: 5, edges: [{ from: 0, to: 1 }, { from: 1, to: 2 },
              { from: 2, to: 3 }, { from: 3, to: 4 }, { from: 4, to: 0 }] };
            const cases = [
              ['hamiltonian', cycle, [0, 2, 1, 3, 4]],
              ['subset-sum', { numbers: [3, 9, 8, 4, 5], target: 17 }, [0, 1]],
              ['colouring', { n: 4, colours: 3, edges: [{ from: 0, to: 1 }] }, [2, 2, 0, 1]]
            ];
            cases.forEach(function (item) {
              const got = verify(item[0], item[1], item[2]);
              api.assert.equal(got.accepted, false, item[0] + ': a wrong certificate must be rejected');
              api.assert.equal(typeof got.reason === 'string' && got.reason.length > 0, true,
                item[0] + ': a rejection must carry a reason');
            });
          }
        },
        {
          name: 'a malformed certificate is rejected rather than thrown or accepted',
          assert: function (verify, api) {
            const cycle = { n: 5, edges: [{ from: 0, to: 1 }, { from: 1, to: 2 },
              { from: 2, to: 3 }, { from: 3, to: 4 }, { from: 4, to: 0 }] };
            const sum = { numbers: [3, 9, 8, 4, 5], target: 17 };
            const colour = { n: 4, colours: 3, edges: [{ from: 0, to: 1 }] };
            const cases = [
              ['hamiltonian', cycle, [0, 1, 2]],
              ['hamiltonian', cycle, [0, 1, 2, 3, 3]],
              ['hamiltonian', cycle, 'not an array'],
              ['hamiltonian', cycle, [0, 1, 2, 3, 99]],
              ['subset-sum', sum, [0, 0]],
              ['subset-sum', sum, [0, 77]],
              ['subset-sum', sum, null],
              ['colouring', colour, [0, 1, 2]],
              ['colouring', colour, [0, 1, 9, 1]],
              ['colouring', colour, undefined]
            ];
            cases.forEach(function (item, index) {
              let got = null;
              try {
                got = verify(item[0], item[1], item[2]);
              } catch (error) {
                api.assert.equal(true, false,
                  'case ' + index + ' (' + item[0] + ') threw instead of rejecting: ' + error.message);
              }
              api.assert.equal(got.accepted, false,
                'case ' + index + ' (' + item[0] + ') is malformed and must be rejected');
            });
          }
        },
        {
          name: 'verification stays linear as the instance grows',
          assert: function (verify, api) {
            const counts = [];
            [8, 16, 32, 64].forEach(function (n) {
              const edges = [];
              for (let v = 0; v < n; v += 1) edges.push({ from: v, to: (v + 1) % n });
              const order = [];
              for (let v = 0; v < n; v += 1) order.push(v);
              const got = verify('hamiltonian', { n: n, edges: edges }, order);
              api.assert.equal(got.accepted, true, 'the ring of ' + n + ' must verify');
              counts.push(got.steps);
            });
            for (let i = 1; i < counts.length; i += 1) {
              api.assert.atMost(counts[i], counts[i - 1] * 3,
                'doubling n must not more than triple the step count: ' + counts.join(', '));
            }
            api.assert.atLeast(counts[3], counts[0],
              'the step count must actually depend on the instance: ' + counts.join(', '));
          }
        }
      ]
    }],

    reductions: [{
      id: 'sat-to-independent-set',
      title: 'The 3-SAT to independent set reduction, with the answer mapped back',
      prompt: 'reduce(formula) must build the independent-set instance and return the map back. ' +
        '`formula` is { variables, clauses }, each clause an array of non-zero integers where ' +
        '+v means variable v positive and −v means negated. Build one vertex per literal ' +
        'OCCURRENCE, numbered clause by clause in order; join every pair of vertices in the ' +
        'same clause, and every pair of vertices in DIFFERENT clauses whose literals are ' +
        'complementary. Return { graph: { n, edges: [{ from, to }] }, target, nodes, ' +
        'toAssignment } where `target` is the clause count, `nodes[i]` is { clause, literal } ' +
        'for vertex i, and toAssignment(chosen) turns an array of vertex indices into an array ' +
        'of `variables` booleans by setting each chosen literal true (variables no chosen ' +
        'vertex mentions may be either value). The starter returns an empty graph, which is ' +
        'trivially solvable and maps back to nothing.',
      entry: 'reduce',
      starter: [
        'function reduce(formula) {',
        '  // No vertices and no edges: every instance looks satisfiable, and the map back',
        '  // has nothing to say.',
        '  return {',
        '    graph: { n: 0, edges: [] },',
        '    target: 0,',
        '    nodes: [],',
        '    toAssignment: function () { return new Array(formula.variables).fill(true); }',
        '  };',
        '}'
      ].join('\n'),
      solution: [
        'function reduce(formula) {',
        '  const nodes = [];',
        '  formula.clauses.forEach(function (clause, c) {',
        '    clause.forEach(function (literal) {',
        '      nodes.push({ clause: c, literal: literal });',
        '    });',
        '  });',
        '',
        '  const edges = [];',
        '  for (let i = 0; i < nodes.length; i += 1) {',
        '    for (let j = i + 1; j < nodes.length; j += 1) {',
        '      const sameClause = nodes[i].clause === nodes[j].clause;',
        '      const opposite = nodes[i].literal === -nodes[j].literal;',
        '      if (!sameClause && !opposite) continue;',
        '      edges.push({ from: i, to: j });',
        '    }',
        '  }',
        '',
        '  return {',
        '    graph: { n: nodes.length, edges: edges },',
        '    target: formula.clauses.length,',
        '    nodes: nodes,',
        '    toAssignment: function (chosen) {',
        '      const assignment = new Array(formula.variables).fill(false);',
        '      chosen.forEach(function (index) {',
        '        const literal = nodes[index].literal;',
        '        assignment[Math.abs(literal) - 1] = literal > 0;',
        '      });',
        '      return assignment;',
        '    }',
        '  };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the target instance has the right shape',
          assert: function (reduce, api) {
            const formula = { variables: 3, clauses: [[1, 2, 3], [-1, 2, -3], [1, -2, 3]] };
            const built = reduce(formula);
            api.assert.equal(built.graph.n, 9, 'one vertex per literal occurrence');
            api.assert.equal(built.target, 3, 'the target size is the clause count');
            let inside = 0;
            built.graph.edges.forEach(function (edge) {
              if (built.nodes[edge.from].clause === built.nodes[edge.to].clause) inside += 1;
            });
            api.assert.equal(inside, 9, 'three triangles is nine within-clause edges');
          }
        },
        {
          name: 'a satisfiable formula gives an independent set of the target size, and it maps back',
          assert: function (reduce, api) {
            function search(graph, size) {
              const adjacency = [];
              for (let i = 0; i < graph.n; i += 1) adjacency.push(new Set());
              graph.edges.forEach(function (edge) {
                adjacency[edge.from].add(edge.to);
                adjacency[edge.to].add(edge.from);
              });
              const chosen = [];
              function walk(start) {
                if (chosen.length === size) return chosen.slice();
                for (let v = start; v < graph.n; v += 1) {
                  let ok = true;
                  for (let i = 0; i < chosen.length; i += 1) {
                    if (adjacency[chosen[i]].has(v)) { ok = false; break; }
                  }
                  if (!ok) continue;
                  chosen.push(v);
                  const found = walk(v + 1);
                  if (found) return found;
                  chosen.pop();
                }
                return null;
              }
              return walk(0);
            }

            for (let t = 0; t < 12; t += 1) {
              const rng = api.Random.seeded(t * 17 + 3);
              const variables = 5;
              const clauses = [];
              for (let c = 0; c < 8; c += 1) {
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
              const formula = { variables: variables, clauses: clauses };
              const built = reduce(formula);
              const found = search(built.graph, built.target);
              api.assert.equal(found !== null, true,
                'instance ' + t + ': this formula is satisfiable, so the set must exist');

              const assignment = built.toAssignment(found);
              formula.clauses.forEach(function (clause, index) {
                const satisfied = clause.some(function (literal) {
                  const value = assignment[Math.abs(literal) - 1];
                  return literal > 0 ? value : !value;
                });
                api.assert.equal(satisfied, true,
                  'instance ' + t + ': clause ' + index + ' must be satisfied by the mapped assignment');
              });
            }
          }
        },
        {
          name: 'an unsatisfiable formula gives an instance with no set of the target size',
          assert: function (reduce, api) {
            const clauses = [];
            for (let mask = 0; mask < 8; mask += 1) {
              clauses.push([(mask & 1) ? -1 : 1, (mask & 2) ? -2 : 2, (mask & 4) ? -3 : 3]);
            }
            const built = reduce({ variables: 3, clauses: clauses });

            const adjacency = [];
            for (let i = 0; i < built.graph.n; i += 1) adjacency.push(new Set());
            built.graph.edges.forEach(function (edge) {
              adjacency[edge.from].add(edge.to);
              adjacency[edge.to].add(edge.from);
            });
            const chosen = [];
            function walk(start) {
              if (chosen.length === built.target) return true;
              for (let v = start; v < built.graph.n; v += 1) {
                let ok = true;
                for (let i = 0; i < chosen.length; i += 1) {
                  if (adjacency[chosen[i]].has(v)) { ok = false; break; }
                }
                if (!ok) continue;
                chosen.push(v);
                if (walk(v + 1)) return true;
                chosen.pop();
              }
              return false;
            }
            api.assert.equal(walk(0), false,
              'all eight clauses over three variables are unsatisfiable, so no set of size 8 exists');
          }
        }
      ]
    }],

    'sat-zoo': [{
      id: 'horn-sat-propagation',
      title: 'Horn-SAT by unit propagation, in time linear in the formula',
      prompt: 'hornSat(formula) must decide a Horn formula by propagation alone and return the ' +
        'minimal model. `formula` is { variables, clauses }, each clause an array of non-zero ' +
        'integers, and every clause has AT MOST ONE positive literal. Start with every variable ' +
        'false. Repeatedly look for a clause that is not yet satisfied: if it has a positive ' +
        'literal, that literal is forced, so set it true and continue; if it has none, the ' +
        'formula is unsatisfiable. Return { satisfiable, assignment, steps } where `assignment` ' +
        'is an array of `variables` booleans (null when unsatisfiable) and `steps` counts the ' +
        'clause visits. The model you return must be MINIMAL: turning any true variable false ' +
        'must break some clause. The starter sets everything true, which satisfies every ' +
        'requirement clause and no contradiction clause, and is never minimal.',
      entry: 'hornSat',
      starter: [
        'function hornSat(formula) {',
        '  // Everything true satisfies (not A or B) for every requirement, and nothing else.',
        '  const assignment = new Array(formula.variables).fill(true);',
        '  return { satisfiable: true, assignment: assignment, steps: formula.clauses.length };',
        '}'
      ].join('\n'),
      solution: [
        'function hornSat(formula) {',
        '  const assignment = new Array(formula.variables).fill(false);',
        '  let steps = 0;',
        '  let moved = true;',
        '',
        '  function satisfied(clause) {',
        '    for (let i = 0; i < clause.length; i += 1) {',
        '      const literal = clause[i];',
        '      const value = assignment[Math.abs(literal) - 1];',
        '      if (literal > 0 ? value : !value) return true;',
        '    }',
        '    return false;',
        '  }',
        '',
        '  while (moved) {',
        '    moved = false;',
        '    for (let c = 0; c < formula.clauses.length; c += 1) {',
        '      steps += 1;',
        '      const clause = formula.clauses[c];',
        '      if (satisfied(clause)) continue;',
        '      let positive = 0;',
        '      for (let i = 0; i < clause.length; i += 1) {',
        '        if (clause[i] > 0) { positive = clause[i]; break; }',
        '      }',
        '      if (positive === 0) {',
        '        return { satisfiable: false, assignment: null, steps: steps };',
        '      }',
        '      assignment[positive - 1] = true;',
        '      moved = true;',
        '    }',
        '  }',
        '  return { satisfiable: true, assignment: assignment, steps: steps };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'it agrees with brute force on every Horn instance, both answers',
          assert: function (hornSat, api) {
            function brute(formula) {
              const total = Math.pow(2, formula.variables);
              for (let mask = 0; mask < total; mask += 1) {
                let all = true;
                for (let c = 0; c < formula.clauses.length && all; c += 1) {
                  const clause = formula.clauses[c];
                  let ok = false;
                  for (let i = 0; i < clause.length; i += 1) {
                    const literal = clause[i];
                    const value = ((mask >>> (Math.abs(literal) - 1)) & 1) === 1;
                    if (literal > 0 ? value : !value) { ok = true; break; }
                  }
                  if (!ok) all = false;
                }
                if (all) return true;
              }
              return false;
            }

            let yes = 0;
            let no = 0;
            for (let t = 0; t < 40; t += 1) {
              const rng = api.Random.seeded(t * 23 + 5);
              const variables = 9;
              const clauses = [[1]];
              for (let v = 2; v <= variables; v += 1) {
                const count = 1 + rng.int(2);
                for (let d = 0; d < count; d += 1) clauses.push([-(1 + rng.int(v - 1)), v]);
              }
              if (t % 2 === 1) {
                clauses.push([-1, -variables]);
                clauses.push([variables]);
              }
              const formula = { variables: variables, clauses: clauses };
              const got = hornSat(formula);
              const truth = brute(formula);
              api.assert.equal(got.satisfiable, truth,
                'instance ' + t + ': expected ' + truth + ', got ' + got.satisfiable);
              if (truth) yes += 1; else no += 1;
            }
            api.assert.atLeast(yes, 10, 'the sweep must contain satisfiable instances');
            api.assert.atLeast(no, 10, 'the sweep must contain unsatisfiable ones');
          }
        },
        {
          name: 'the model it returns is minimal — nothing is true that was not forced',
          assert: function (hornSat, api) {
            for (let t = 0; t < 15; t += 1) {
              const rng = api.Random.seeded(t * 31 + 7);
              const variables = 10;
              const clauses = [[1]];
              for (let v = 2; v <= variables; v += 1) {
                const count = 1 + rng.int(2);
                for (let d = 0; d < count; d += 1) clauses.push([-(1 + rng.int(v - 1)), v]);
              }
              const formula = { variables: variables, clauses: clauses };
              const got = hornSat(formula);
              api.assert.equal(got.satisfiable, true, 'instance ' + t + ' is satisfiable');

              function countSatisfied(assignment) {
                let count = 0;
                clauses.forEach(function (clause) {
                  for (let i = 0; i < clause.length; i += 1) {
                    const literal = clause[i];
                    const value = assignment[Math.abs(literal) - 1];
                    if (literal > 0 ? value : !value) { count += 1; return; }
                  }
                });
                return count;
              }
              api.assert.equal(countSatisfied(got.assignment), clauses.length,
                'instance ' + t + ': every clause must be satisfied');

              for (let v = 0; v < variables; v += 1) {
                if (got.assignment[v] !== true) continue;
                const flipped = got.assignment.slice();
                flipped[v] = false;
                api.assert.equal(countSatisfied(flipped) < clauses.length, true,
                  'instance ' + t + ': variable ' + (v + 1) + ' was set true without being forced');
              }
            }
          }
        },
        {
          name: 'empty and trivially contradictory clause sets',
          assert: function (hornSat, api) {
            api.assert.equal(hornSat({ variables: 3, clauses: [] }).satisfiable, true,
              'no clauses is satisfiable');
            api.assert.equal(hornSat({ variables: 1, clauses: [[1], [-1]] }).satisfiable, false,
              'x and not-x cannot both hold');
            api.assert.equal(
              hornSat({ variables: 2, clauses: [[1], [-1, 2], [-2]] }).satisfiable, false,
              'x forces y, and not-y forbids it');
          }
        },
        {
          name: 'the cost stays linear in the formula rather than exponential in the variables',
          assert: function (hornSat, api) {
            const counts = [];
            [10, 20, 40, 80].forEach(function (variables) {
              const clauses = [[1]];
              for (let v = 2; v <= variables; v += 1) clauses.push([-(v - 1), v]);
              const got = hornSat({ variables: variables, clauses: clauses });
              api.assert.equal(got.satisfiable, true, 'the chain of ' + variables + ' is satisfiable');
              counts.push(got.steps);
            });
            for (let i = 1; i < counts.length; i += 1) {
              api.assert.atMost(counts[i], counts[i - 1] * 6,
                'doubling the formula must not blow the step count up: ' + counts.join(', '));
            }
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));

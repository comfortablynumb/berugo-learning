/**
 * Graded exercises for general matching and 2-SAT (M14.6-M14.7).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'general-matching': [{
      id: 'hungarian-assignment',
      title: 'The cheapest perfect assignment, and the certificate that proves it',
      prompt: 'assign(matrix) must return { cost, assignment, rowDual, colDual } for a square cost ' +
        'matrix: the cheapest perfect assignment, the column chosen for each row, and the two ' +
        'potentials. Any correct method is fine — the Hungarian algorithm, or repeated ' +
        'shortest-augmenting-path with potentials — but the duals must satisfy ' +
        '`matrix[i][j] − rowDual[i] − colDual[j] >= 0` everywhere and `= 0` on every chosen cell, ' +
        'because that pair of facts is what proves the answer optimal without appealing to the ' +
        'algorithm. The starter takes the cheapest remaining cell in each row, which produces a ' +
        'valid permutation, a plausible total and duals that certify nothing.',
      entry: 'assign',
      starter: [
        'function assign(matrix) {',
        '  const size = matrix.length;',
        '  const used = new Array(size).fill(false);',
        '  const assignment = new Array(size).fill(-1);',
        '  let cost = 0;',
        '  for (let r = 0; r < size; r += 1) {',
        '    let best = -1;',
        '    for (let c = 0; c < size; c += 1) {',
        '      if (used[c]) continue;',
        '      if (best === -1 || matrix[r][c] < matrix[r][best]) best = c;',
        '    }',
        '    used[best] = true;',
        '    assignment[r] = best;',
        '    cost += matrix[r][best];',
        '  }',
        '  // the row minimum as a potential, and nothing on the columns',
        '  const rowDual = matrix.map(function (row) { return Math.min.apply(null, row); });',
        '  const colDual = new Array(size).fill(0);',
        '  return { cost: cost, assignment: assignment, rowDual: rowDual, colDual: colDual };',
        '}'
      ].join('\n'),
      solution: [
        'function assign(matrix) {',
        '  const size = matrix.length;',
        '  // 1-indexed duals, the standard Hungarian formulation',
        '  const u = new Array(size + 1).fill(0);',
        '  const v = new Array(size + 1).fill(0);',
        '  const owner = new Array(size + 1).fill(0);',
        '  const way = new Array(size + 1).fill(0);',
        '',
        '  for (let row = 1; row <= size; row += 1) {',
        '    owner[0] = row;',
        '    let column = 0;',
        '    const slack = new Array(size + 1).fill(Infinity);',
        '    const done = new Array(size + 1).fill(false);',
        '    do {',
        '      done[column] = true;',
        '      const inRow = owner[column];',
        '      let delta = Infinity;',
        '      let next = 0;',
        '      for (let j = 1; j <= size; j += 1) {',
        '        if (done[j]) continue;',
        '        const value = matrix[inRow - 1][j - 1] - u[inRow] - v[j];',
        '        if (value < slack[j]) { slack[j] = value; way[j] = column; }',
        '        if (slack[j] < delta) { delta = slack[j]; next = j; }',
        '      }',
        '      for (let j = 0; j <= size; j += 1) {',
        '        if (done[j]) { u[owner[j]] += delta; v[j] -= delta; }',
        '        else slack[j] -= delta;',
        '      }',
        '      column = next;',
        '    } while (owner[column] !== 0);',
        '    do {',
        '      const previous = way[column];',
        '      owner[column] = owner[previous];',
        '      column = previous;',
        '    } while (column);',
        '  }',
        '',
        '  const assignment = new Array(size).fill(-1);',
        '  for (let j = 1; j <= size; j += 1) {',
        '    if (owner[j] === 0) continue;',
        '    assignment[owner[j] - 1] = j - 1;',
        '  }',
        '  let cost = 0;',
        '  assignment.forEach(function (column, row) { cost += matrix[row][column]; });',
        '  return { cost: cost, assignment: assignment,',
        '    rowDual: u.slice(1), colDual: v.slice(1) };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the cost matches an exhaustive permutation search',
          assert: function (assign, api) {
            function best(matrix) {
              const size = matrix.length;
              let lowest = Infinity;

              function walk(row, used, sum) {
                if (sum >= lowest) return;

                if (row === size) { lowest = sum; return; }

                for (let c = 0; c < size; c += 1) {
                  if (used.indexOf(c) !== -1) continue;
                  used.push(c);
                  walk(row + 1, used, sum + matrix[row][c]);
                  used.pop();
                }
              }
              walk(0, [], 0);
              return lowest;
            }

            for (let trial = 0; trial < 8; trial += 1) {
              const size = 3 + api.rng.int(4);
              const matrix = [];

              for (let r = 0; r < size; r += 1) {
                const row = [];

                for (let c = 0; c < size; c += 1) row.push(1 + api.rng.int(20));
                matrix.push(row);
              }
              const got = assign(matrix);

              api.assert.equal(got.cost, best(matrix),
                'trial ' + trial + ' at size ' + size +
                  ': taking the cheapest remaining cell in each row is not an approximation, ' +
                  'it is a different algorithm with no bound');
            }
          }
        },
        {
          name: 'the duals certify the answer: no negative reduced cost, zero on every chosen cell',
          assert: function (assign, api) {
            for (let trial = 0; trial < 8; trial += 1) {
              const size = 5;
              const matrix = [];

              for (let r = 0; r < size; r += 1) {
                const row = [];

                for (let c = 0; c < size; c += 1) row.push(1 + api.rng.int(30));
                matrix.push(row);
              }
              const got = assign(matrix);

              for (let r = 0; r < size; r += 1) {
                for (let c = 0; c < size; c += 1) {
                  const reduced = matrix[r][c] - got.rowDual[r] - got.colDual[c];

                  api.assert.ok(reduced >= -1e-9,
                    'cell (' + r + ',' + c + ') has reduced cost ' + reduced +
                      '; a negative one means the potentials prove nothing');
                }
                const chosen = matrix[r][got.assignment[r]] - got.rowDual[r] -
                  got.colDual[got.assignment[r]];

                api.assert.ok(Math.abs(chosen) < 1e-9,
                  'the chosen cell in row ' + r + ' has reduced cost ' + chosen +
                    '; it must be exactly zero, or the dual total does not equal the assignment cost');
              }
            }
          }
        },
        {
          name: 'the assignment is a permutation, and its cost is the sum it claims',
          assert: function (assign, api) {
            for (let trial = 0; trial < 6; trial += 1) {
              const size = 6;
              const matrix = [];

              for (let r = 0; r < size; r += 1) {
                const row = [];

                for (let c = 0; c < size; c += 1) row.push(1 + api.rng.int(15));
                matrix.push(row);
              }
              const got = assign(matrix);
              const used = {};
              let total = 0;

              got.assignment.forEach(function (column, row) {
                api.assert.ok(column >= 0 && column < size, 'row ' + row + ' has no column');
                api.assert.ok(!used[column], 'column ' + column + ' is used twice');
                used[column] = true;
                total += matrix[row][column];
              });
              api.assert.equal(total, got.cost, 'the reported cost must be the sum of the chosen cells');
            }
          }
        }
      ]
    }],

    'two-sat': [{
      id: 'implication-graph-solve',
      title: 'Both arcs per clause, and the order the components come in',
      prompt: 'solveTwoSat(variables, clauses) must return { satisfiable, assignment } where each ' +
        'clause is a pair of literals encoded as `2*v` for the variable and `2*v + 1` for its ' +
        'negation. Build the implication graph — every clause contributes BOTH `¬a → b` and ' +
        '`¬b → a` — find its strongly connected components, report unsatisfiable when any variable ' +
        'shares a component with its own negation, and otherwise return an assignment read off the ' +
        'condensation order. The starter adds only the first implication of each clause, which is ' +
        'half of every clause: the components stop meaning anything and it reports satisfiable on ' +
        'formulas that are not.',
      entry: 'solveTwoSat',
      starter: [
        'function solveTwoSat(variables, clauses) {',
        '  const n = 2 * variables;',
        '  const out = [];',
        '  const back = [];',
        '  for (let v = 0; v < n; v += 1) { out.push([]); back.push([]); }',
        '  clauses.forEach(function (clause) {',
        '    // only the first implication; the contrapositive is surely redundant',
        '    out[clause[0] ^ 1].push(clause[1]);',
        '    back[clause[1]].push(clause[0] ^ 1);',
        '  });',
        '',
        '  const order = [];',
        '  const seen = new Array(n).fill(false);',
        '  for (let start = 0; start < n; start += 1) {',
        '    if (seen[start]) continue;',
        '    const stack = [[start, 0]];',
        '    seen[start] = true;',
        '    while (stack.length) {',
        '      const top = stack[stack.length - 1];',
        '      if (top[1] >= out[top[0]].length) { order.push(top[0]); stack.pop(); continue; }',
        '      const next = out[top[0]][top[1]];',
        '      top[1] += 1;',
        '      if (seen[next]) continue;',
        '      seen[next] = true;',
        '      stack.push([next, 0]);',
        '    }',
        '  }',
        '',
        '  const component = new Array(n).fill(-1);',
        '  let count = 0;',
        '  for (let i = order.length - 1; i >= 0; i -= 1) {',
        '    if (component[order[i]] !== -1) continue;',
        '    const stack = [order[i]];',
        '    component[order[i]] = count;',
        '    while (stack.length) {',
        '      const at = stack.pop();',
        '      back[at].forEach(function (previous) {',
        '        if (component[previous] !== -1) return;',
        '        component[previous] = count;',
        '        stack.push(previous);',
        '      });',
        '    }',
        '    count += 1;',
        '  }',
        '',
        '  const assignment = [];',
        '  for (let v = 0; v < variables; v += 1) {',
        '    if (component[2 * v] === component[2 * v + 1]) {',
        '      return { satisfiable: false, assignment: null };',
        '    }',
        '    assignment.push(component[2 * v] > component[2 * v + 1]);',
        '  }',
        '  return { satisfiable: true, assignment: assignment };',
        '}'
      ].join('\n'),
      solution: [
        'function solveTwoSat(variables, clauses) {',
        '  const n = 2 * variables;',
        '  const out = [];',
        '  const back = [];',
        '  for (let v = 0; v < n; v += 1) { out.push([]); back.push([]); }',
        '  clauses.forEach(function (clause) {',
        '    // both arcs, always: the contrapositive is half the clause',
        '    out[clause[0] ^ 1].push(clause[1]);',
        '    back[clause[1]].push(clause[0] ^ 1);',
        '    out[clause[1] ^ 1].push(clause[0]);',
        '    back[clause[0]].push(clause[1] ^ 1);',
        '  });',
        '',
        '  const order = [];',
        '  const seen = new Array(n).fill(false);',
        '  for (let start = 0; start < n; start += 1) {',
        '    if (seen[start]) continue;',
        '    const stack = [[start, 0]];',
        '    seen[start] = true;',
        '    while (stack.length) {',
        '      const top = stack[stack.length - 1];',
        '      if (top[1] >= out[top[0]].length) { order.push(top[0]); stack.pop(); continue; }',
        '      const next = out[top[0]][top[1]];',
        '      top[1] += 1;',
        '      if (seen[next]) continue;',
        '      seen[next] = true;',
        '      stack.push([next, 0]);',
        '    }',
        '  }',
        '',
        '  const component = new Array(n).fill(-1);',
        '  let count = 0;',
        '  for (let i = order.length - 1; i >= 0; i -= 1) {',
        '    if (component[order[i]] !== -1) continue;',
        '    const stack = [order[i]];',
        '    component[order[i]] = count;',
        '    while (stack.length) {',
        '      const at = stack.pop();',
        '      back[at].forEach(function (previous) {',
        '        if (component[previous] !== -1) return;',
        '        component[previous] = count;',
        '        stack.push(previous);',
        '      });',
        '    }',
        '    count += 1;',
        '  }',
        '',
        '  const assignment = [];',
        '  for (let v = 0; v < variables; v += 1) {',
        '    if (component[2 * v] === component[2 * v + 1]) {',
        '      return { satisfiable: false, assignment: null };',
        '    }',
        '    // Kosaraju numbers components in topological order, so LATER wins',
        '    assignment.push(component[2 * v] > component[2 * v + 1]);',
        '  }',
        '  return { satisfiable: true, assignment: assignment };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the verdict matches an exhaustive assignment search',
          assert: function (solveTwoSat, api) {
            function brute(variables, clauses) {
              const total = Math.pow(2, variables);

              for (let mask = 0; mask < total; mask += 1) {
                const values = [];

                for (let v = 0; v < variables; v += 1) values.push(((mask >> v) & 1) === 1);
                const holds = function (lit) {
                  return (lit & 1) === 1 ? !values[lit >> 1] : values[lit >> 1];
                };
                const ok = clauses.every(function (clause) {
                  return holds(clause[0]) || holds(clause[1]);
                });

                if (ok) return true;
              }
              return false;
            }

            for (let trial = 0; trial < 30; trial += 1) {
              const variables = 8;
              const clauses = [];
              const count = 6 + api.rng.int(14);

              for (let i = 0; i < count; i += 1) {
                const a = api.rng.int(variables);
                let b = api.rng.int(variables);

                if (b === a) b = (a + 1) % variables;
                clauses.push([2 * a + api.rng.int(2), 2 * b + api.rng.int(2)]);
              }
              api.assert.equal(solveTwoSat(variables, clauses).satisfiable,
                brute(variables, clauses),
                'trial ' + trial + ' with ' + count + ' clauses: half a clause makes the ' +
                  'components meaningless, and the error is always towards reporting satisfiable');
            }
          }
        },
        {
          name: 'a satisfiable verdict comes with an assignment that breaks no clause',
          assert: function (solveTwoSat, api) {
            for (let trial = 0; trial < 25; trial += 1) {
              const variables = 10;
              const clauses = [];

              for (let i = 0; i < 12; i += 1) {
                const a = api.rng.int(variables);
                let b = api.rng.int(variables);

                if (b === a) b = (a + 1) % variables;
                clauses.push([2 * a + api.rng.int(2), 2 * b + api.rng.int(2)]);
              }
              const got = solveTwoSat(variables, clauses);

              if (!got.satisfiable) continue;
              api.assert.equal(got.assignment.length, variables, 'one value per variable');
              clauses.forEach(function (clause, id) {
                const holds = function (lit) {
                  return (lit & 1) === 1 ? !got.assignment[lit >> 1] : got.assignment[lit >> 1];
                };

                api.assert.ok(holds(clause[0]) || holds(clause[1]),
                  'trial ' + trial + ': clause ' + id + ' is not satisfied by the returned ' +
                    'assignment, so the graph was right and the read-out was not');
              });
            }
          }
        },
        {
          name: 'a forced contradiction is reported as unsatisfiable',
          assert: function (solveTwoSat, api) {
            // (x0) and (not x0), as the unit clauses (l or l)
            const got = solveTwoSat(3, [[0, 0], [1, 1], [2, 4]]);

            api.assert.equal(got.satisfiable, false,
              'forcing x0 true and x0 false puts both literals in one component; ' +
                'a solver that adds only one arc per clause misses it entirely');
            api.assert.equal(got.assignment, null, 'no assignment exists to return');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));

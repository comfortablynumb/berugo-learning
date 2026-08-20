/**
 * Graded exercises for the structured-search paradigm sections (M11.4-M11.6).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    matroids: [{
      id: 'generic-greedy-and-exchange',
      title: 'the generic greedy algorithm, and the checker that decides whether it is right',
      prompt: 'matroidToolkit() must return { greedy, checkExchange }. greedy(ground, isIndependent, ' +
        'weightOf) is the generic algorithm: sort the ground set by weight descending and keep each element ' +
        'that leaves the chosen set independent, returning { chosen, weight }. checkExchange(ground, ' +
        'isIndependent) decides whether the family satisfies the exchange property, returning ' +
        '{ holds, witness } where witness is { smaller, larger } — two independent sets with |smaller| < ' +
        '|larger| such that no element of larger can be added to smaller. Enumerate the 2^n subsets to find ' +
        'the independent ones, then search the pairs. The starter\'s greedy takes the lightest elements ' +
        'first and its checker only inspects sets that differ by exactly one element.',
      entry: 'matroidToolkit',
      starter: [
        'function matroidToolkit() {',
        '  // lightest first: a maximal independent set, and not the heaviest one',
        '  function greedy(ground, isIndependent, weightOf) {',
        '    const order = ground.slice().sort(function (a, b) { return weightOf(a) - weightOf(b); });',
        '    const chosen = [];',
        '    let weight = 0;',
        '    order.forEach(function (element) {',
        '      if (!isIndependent(chosen.concat([element]))) return;',
        '      chosen.push(element);',
        '      weight += weightOf(element);',
        '    });',
        '    return { chosen: chosen, weight: weight };',
        '  }',
        '',
        '  // only pairs differing by one element, which misses most violations',
        '  function checkExchange(ground, isIndependent) {',
        '    for (let i = 0; i < ground.length; i += 1) {',
        '      for (let j = 0; j < ground.length; j += 1) {',
        '        if (i === j) continue;',
        '        const smaller = [ground[i]];',
        '        const larger = [ground[i], ground[j]];',
        '        if (!isIndependent(smaller) || !isIndependent(larger)) continue;',
        '        if (!isIndependent(smaller.concat([ground[j]]))) {',
        '          return { holds: false, witness: { smaller: smaller, larger: larger } };',
        '        }',
        '      }',
        '    }',
        '    return { holds: true, witness: null };',
        '  }',
        '',
        '  return { greedy: greedy, checkExchange: checkExchange };',
        '}'
      ].join('\n'),
      solution: [
        'function matroidToolkit() {',
        '  function membersOf(mask, ground) {',
        '    const out = [];',
        '    for (let i = 0; i < ground.length; i += 1) {',
        '      if (mask & (1 << i)) out.push(ground[i]);',
        '    }',
        '    return out;',
        '  }',
        '',
        '  function popcount(mask) {',
        '    let n = mask;',
        '    let total = 0;',
        '    while (n) { n &= n - 1; total += 1; }',
        '    return total;',
        '  }',
        '',
        '  // heaviest first: this is the whole algorithm, and it is Kruskal when',
        '  // the oracle is acyclicity',
        '  function greedy(ground, isIndependent, weightOf) {',
        '    const order = ground.slice().sort(function (a, b) { return weightOf(b) - weightOf(a); });',
        '    const chosen = [];',
        '    let weight = 0;',
        '    order.forEach(function (element) {',
        '      if (!isIndependent(chosen.concat([element]))) return;',
        '      chosen.push(element);',
        '      weight += weightOf(element);',
        '    });',
        '    return { chosen: chosen, weight: weight };',
        '  }',
        '',
        '  function checkExchange(ground, isIndependent) {',
        '    const independent = [];',
        '    const seen = new Set();',
        '    for (let mask = 0; mask < (1 << ground.length); mask += 1) {',
        '      if (!isIndependent(membersOf(mask, ground))) continue;',
        '      independent.push(mask);',
        '      seen.add(mask);',
        '    }',
        '',
        '    // every ordered pair with |A| < |B|, not only the adjacent ones',
        '    for (let i = 0; i < independent.length; i += 1) {',
        '      for (let j = 0; j < independent.length; j += 1) {',
        '        const a = independent[i];',
        '        const b = independent[j];',
        '        if (popcount(a) >= popcount(b)) continue;',
        '',
        '        let extendable = false;',
        '        for (let bit = 0; bit < ground.length; bit += 1) {',
        '          if (!(b & (1 << bit)) || (a & (1 << bit))) continue;',
        '          if (seen.has(a | (1 << bit))) { extendable = true; break; }',
        '        }',
        '        if (!extendable) {',
        '          return {',
        '            holds: false,',
        '            witness: { smaller: membersOf(a, ground), larger: membersOf(b, ground) }',
        '          };',
        '        }',
        '      }',
        '    }',
        '    return { holds: true, witness: null };',
        '  }',
        '',
        '  return { greedy: greedy, checkExchange: checkExchange };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'greedy over the graphic matroid reproduces the maximum spanning forest',
          assert: function (matroidToolkit, api) {
            const random = api.rng;
            const tools = matroidToolkit();
            const vertices = 6;

            function acyclic(edges) {
              const parent = [];
              for (let i = 0; i < vertices; i += 1) parent.push(i);
              function find(x) {
                let root = x;
                while (parent[root] !== root) root = parent[root];
                return root;
              }
              for (let i = 0; i < edges.length; i += 1) {
                const a = find(edges[i].from);
                const b = find(edges[i].to);
                if (a === b) return false;
                parent[a] = b;
              }
              return true;
            }

            for (let trial = 0; trial < 25; trial += 1) {
              const edges = [];
              for (let i = 0; i < 12; i += 1) {
                const from = random.int(vertices);
                let to = random.int(vertices);
                if (to === from) to = (to + 1) % vertices;
                edges.push({ id: i, from: from, to: to, weight: 1 + random.int(30) });
              }

              let best = 0;
              for (let mask = 0; mask < (1 << edges.length); mask += 1) {
                const members = [];
                let weight = 0;
                for (let i = 0; i < edges.length; i += 1) {
                  if (!(mask & (1 << i))) continue;
                  members.push(edges[i]);
                  weight += edges[i].weight;
                }
                if (weight > best && acyclic(members)) best = weight;
              }

              const got = tools.greedy(edges, acyclic, function (edge) { return edge.weight; });
              api.assert.equal(got.weight, best, 'trial ' + trial);
            }
          }
        },
        {
          name: 'the checker accepts the uniform and partition matroids',
          assert: function (matroidToolkit, api) {
            const tools = matroidToolkit();
            const ground = [0, 1, 2, 3, 4, 5];

            [1, 2, 3, 4].forEach(function (k) {
              const verdict = tools.checkExchange(ground, function (set) { return set.length <= k; });
              api.assert.equal(verdict.holds, true, 'uniform matroid with k = ' + k);
              api.assert.equal(verdict.witness, null, 'no witness for a matroid');
            });

            const quotas = { 0: 1, 1: 2 };
            const partition = tools.checkExchange(ground, function (set) {
              const counts = {};
              for (let i = 0; i < set.length; i += 1) {
                const group = set[i] % 2;
                counts[group] = (counts[group] || 0) + 1;
                if (counts[group] > quotas[group]) return false;
              }
              return true;
            });
            api.assert.equal(partition.holds, true, 'partition matroid');
          }
        },
        {
          name: 'the checker rejects matchings, with a witness that really fails',
          assert: function (matroidToolkit, api) {
            const tools = matroidToolkit();
            const edges = [
              { id: 0, from: 0, to: 1 }, { id: 1, from: 1, to: 2 }, { id: 2, from: 2, to: 3 }
            ];

            function isMatching(set) {
              const used = new Set();
              for (let i = 0; i < set.length; i += 1) {
                if (used.has(set[i].from) || used.has(set[i].to)) return false;
                used.add(set[i].from);
                used.add(set[i].to);
              }
              return true;
            }

            const verdict = tools.checkExchange(edges, isMatching);
            api.assert.equal(verdict.holds, false, 'matchings are not a matroid');
            api.assert.ok(verdict.witness, 'a witness must be returned');

            const smaller = verdict.witness.smaller;
            const larger = verdict.witness.larger;
            api.assert.ok(smaller.length < larger.length, 'the witness sets must differ in size');
            api.assert.equal(isMatching(smaller), true, 'the smaller set must be independent');
            api.assert.equal(isMatching(larger), true, 'the larger set must be independent');

            larger.forEach(function (element) {
              if (smaller.indexOf(element) !== -1) return;
              api.assert.equal(isMatching(smaller.concat([element])), false,
                'the witness claims no element of larger extends smaller, but one does');
            });
          }
        },
        {
          name: 'greedy is optimal exactly where the checker says it is',
          assert: function (matroidToolkit, api) {
            const tools = matroidToolkit();
            const edges = [
              { id: 0, from: 0, to: 1, weight: 2 },
              { id: 1, from: 1, to: 2, weight: 3 },
              { id: 2, from: 2, to: 3, weight: 2 }
            ];

            function isMatching(set) {
              const used = new Set();
              for (let i = 0; i < set.length; i += 1) {
                if (used.has(set[i].from) || used.has(set[i].to)) return false;
                used.add(set[i].from);
                used.add(set[i].to);
              }
              return true;
            }

            const got = tools.greedy(edges, isMatching, function (edge) { return edge.weight; });
            api.assert.equal(got.weight, 3,
              'greedy takes the weight-3 middle edge first and then nothing fits');
            api.assert.equal(tools.checkExchange(edges, isMatching).holds, false,
              'and the checker predicted exactly that, before the weights were chosen');
          }
        }
      ]
    }],

    backtracking: [{
      id: 'sudoku-propagation',
      title: 'propagation on top of a naive solver, with the undo kept exact',
      prompt: 'solveSudoku(puzzle) takes an 81-character string ("." or "0" for empty) and returns ' +
        '{ grid, nodes }: the solved grid as an array of 81 digits, and the number of nodes the search ' +
        'visited — one per call to your recursive helper. The starter takes the first empty cell and tries ' +
        'its legal digits, which is correct and visits 49 559 nodes on the hard fixture. Add two things: ' +
        'choose the empty cell with the fewest legal digits, and after each assignment fill in every cell ' +
        'that is forced, repeatedly, until nothing more follows. The undo is the part that has to be right ' +
        '— record what propagation filled and clear exactly those cells, never a recomputation of what ' +
        '"should" have been filled.',
      entry: 'solveSudoku',
      starter: [
        'function solveSudoku(puzzle) {',
        '  const grid = String(puzzle).replace(/[^0-9.]/g, "").split("").map(function (c) {',
        '    return c === "." || c === "0" ? 0 : Number(c);',
        '  });',
        '  let nodes = 0;',
        '',
        '  const peers = [];',
        '  for (let cell = 0; cell < 81; cell += 1) {',
        '    const row = Math.floor(cell / 9);',
        '    const column = cell % 9;',
        '    const boxRow = Math.floor(row / 3) * 3;',
        '    const boxColumn = Math.floor(column / 3) * 3;',
        '    const set = new Set();',
        '    for (let i = 0; i < 9; i += 1) {',
        '      set.add(row * 9 + i);',
        '      set.add(i * 9 + column);',
        '      set.add((boxRow + Math.floor(i / 3)) * 9 + boxColumn + (i % 3));',
        '    }',
        '    set.delete(cell);',
        '    peers.push(Array.from(set));',
        '  }',
        '',
        '  function legal(cell) {',
        '    const used = new Set();',
        '    peers[cell].forEach(function (peer) { if (grid[peer]) used.add(grid[peer]); });',
        '    const out = [];',
        '    for (let digit = 1; digit <= 9; digit += 1) if (!used.has(digit)) out.push(digit);',
        '    return out;',
        '  }',
        '',
        '  // first empty cell, no lookahead',
        '  function descend() {',
        '    nodes += 1;',
        '    let cell = -1;',
        '    for (let i = 0; i < 81; i += 1) { if (!grid[i]) { cell = i; break; } }',
        '    if (cell === -1) return true;',
        '',
        '    const digits = legal(cell);',
        '    for (let i = 0; i < digits.length; i += 1) {',
        '      grid[cell] = digits[i];',
        '      if (descend()) return true;',
        '      grid[cell] = 0;',
        '    }',
        '    return false;',
        '  }',
        '',
        '  descend();',
        '  return { grid: grid, nodes: nodes };',
        '}'
      ].join('\n'),
      solution: [
        'function solveSudoku(puzzle) {',
        '  const grid = String(puzzle).replace(/[^0-9.]/g, "").split("").map(function (c) {',
        '    return c === "." || c === "0" ? 0 : Number(c);',
        '  });',
        '  let nodes = 0;',
        '',
        '  const peers = [];',
        '  for (let cell = 0; cell < 81; cell += 1) {',
        '    const row = Math.floor(cell / 9);',
        '    const column = cell % 9;',
        '    const boxRow = Math.floor(row / 3) * 3;',
        '    const boxColumn = Math.floor(column / 3) * 3;',
        '    const set = new Set();',
        '    for (let i = 0; i < 9; i += 1) {',
        '      set.add(row * 9 + i);',
        '      set.add(i * 9 + column);',
        '      set.add((boxRow + Math.floor(i / 3)) * 9 + boxColumn + (i % 3));',
        '    }',
        '    set.delete(cell);',
        '    peers.push(Array.from(set));',
        '  }',
        '',
        '  function legal(cell) {',
        '    const used = new Set();',
        '    peers[cell].forEach(function (peer) { if (grid[peer]) used.add(grid[peer]); });',
        '    const out = [];',
        '    for (let digit = 1; digit <= 9; digit += 1) if (!used.has(digit)) out.push(digit);',
        '    return out;',
        '  }',
        '',
        '  // minimum remaining values: branch where there is least to branch on',
        '  function chooseCell() {',
        '    let best = null;',
        '    for (let cell = 0; cell < 81; cell += 1) {',
        '      if (grid[cell]) continue;',
        '      const digits = legal(cell);',
        '      if (!best || digits.length < best.digits.length) best = { cell: cell, digits: digits };',
        '      if (best.digits.length === 0) return best;',
        '    }',
        '    return best;',
        '  }',
        '',
        '  // fill everything forced, and return the list so the undo is a replay',
        '  function propagate() {',
        '    const filled = [];',
        '    let changed = true;',
        '    while (changed) {',
        '      changed = false;',
        '      for (let cell = 0; cell < 81; cell += 1) {',
        '        if (grid[cell]) continue;',
        '        const digits = legal(cell);',
        '        if (digits.length === 0) return { filled: filled, wiped: true };',
        '        if (digits.length > 1) continue;',
        '        grid[cell] = digits[0];',
        '        filled.push(cell);',
        '        changed = true;',
        '      }',
        '    }',
        '    return { filled: filled, wiped: false };',
        '  }',
        '',
        '  function unfill(filled) {',
        '    filled.forEach(function (cell) { grid[cell] = 0; });',
        '  }',
        '',
        '  function descend() {',
        '    nodes += 1;',
        '    const choice = chooseCell();',
        '    if (!choice) return true;',
        '',
        '    for (let i = 0; i < choice.digits.length; i += 1) {',
        '      grid[choice.cell] = choice.digits[i];',
        '      const propagated = propagate();',
        '      if (!propagated.wiped && descend()) return true;',
        '      unfill(propagated.filled);',
        '      grid[choice.cell] = 0;',
        '    }',
        '    return false;',
        '  }',
        '',
        '  propagate();',
        '  descend();',
        '  return { grid: grid, nodes: nodes };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'it solves the fixtures, and the grids are valid',
          assert: function (solveSudoku, api) {
            const puzzles = [
              '530070000600195000098000060800060003400803001700020006060000280000419005000080079',
              '1....7.9..3..2...8..96..5....53..9...1..8...26....4...3......1..4......7..7...3..',
              '8..........36......7..9.2...5...7.......457.....1...3...1....68..85...1..9....4..'
            ];

            puzzles.forEach(function (puzzle, index) {
              const solved = solveSudoku(puzzle).grid;
              api.assert.equal(solved.length, 81, 'puzzle ' + index + ' returns 81 cells');

              for (let cell = 0; cell < 81; cell += 1) {
                api.assert.ok(solved[cell] >= 1 && solved[cell] <= 9,
                  'puzzle ' + index + ' cell ' + cell + ' is ' + solved[cell]);
              }
              for (let unit = 0; unit < 9; unit += 1) {
                const row = new Set();
                const column = new Set();
                const box = new Set();
                for (let i = 0; i < 9; i += 1) {
                  row.add(solved[unit * 9 + i]);
                  column.add(solved[i * 9 + unit]);
                  const boxRow = Math.floor(unit / 3) * 3 + Math.floor(i / 3);
                  const boxColumn = (unit % 3) * 3 + (i % 3);
                  box.add(solved[boxRow * 9 + boxColumn]);
                }
                api.assert.equal(row.size, 9, 'puzzle ' + index + ' row ' + unit);
                api.assert.equal(column.size, 9, 'puzzle ' + index + ' column ' + unit);
                api.assert.equal(box.size, 9, 'puzzle ' + index + ' box ' + unit);
              }
            });
          }
        },
        {
          name: 'the clues are untouched',
          assert: function (solveSudoku, api) {
            const puzzle = '8..........36......7..9.2...5...7.......457.....1...3...1....68..85...1..9....4..';
            const clues = puzzle.split('').map(function (c) { return c === '.' ? 0 : Number(c); });
            const solved = solveSudoku(puzzle).grid;

            clues.forEach(function (value, cell) {
              if (!value) return;
              api.assert.equal(solved[cell], value, 'clue at cell ' + cell + ' was overwritten');
            });
          }
        },
        {
          name: 'the hard fixture costs a small fraction of the naive node count',
          assert: function (solveSudoku, api) {
            const hard = '8..........36......7..9.2...5...7.......457.....1...3...1....68..85...1..9....4..';
            const run = solveSudoku(hard);

            api.assert.atMost(run.nodes, 5000,
              'the first-empty-cell solver visits 49 559 nodes here; MRV with propagation reaches 929. Got ' +
                run.nodes);
            api.assert.atLeast(run.nodes, 1, 'the search has to run');
          }
        },
        {
          name: 'the undo is exact: an already-solved grid is returned unchanged',
          assert: function (solveSudoku, api) {
            const complete = '534678912672195348198342567859761423426853791713924856961537284287419635345286179';
            const run = solveSudoku(complete);

            api.assert.equal(run.grid.join(''), complete, 'a complete grid must come back identical');
            api.assert.atMost(run.nodes, 3, 'and it needs no search at all');

            const nearly = '53467891267219534819834256785976142342685379171392485696153728428741963534528617.';
            const finished = solveSudoku(nearly).grid;
            api.assert.equal(finished[80], 9, 'the single empty cell is forced to 9');
          }
        }
      ]
    }],

    'branch-and-bound': [{
      id: 'knapsack-relaxation-bound',
      title: 'the fractional bound, and the proof that it did not lose the optimum',
      prompt: 'knapsack(items, capacity) returns { value, nodes }: the best total value of a subset fitting ' +
        'in the capacity, and the number of search nodes visited. Search depth-first over take/skip ' +
        'decisions on items sorted by value density, and prune any subtree whose *best possible* completion ' +
        'cannot beat the best solution found so far. The bound to use is the fractional relaxation: fill the ' +
        'remaining capacity greedily by density and allow the last item to be cut. It never underestimates, ' +
        'which is what makes the pruning sound — a bound that is even slightly too low discards the optimum ' +
        'and nothing anywhere notices. The starter has no bound at all and enumerates the whole tree.',
      entry: 'knapsack',
      starter: [
        'function knapsack(items, capacity) {',
        '  const sorted = items.slice().sort(function (a, b) {',
        '    return (b.value / b.weight) - (a.value / a.weight);',
        '  });',
        '  let best = 0;',
        '  let nodes = 0;',
        '',
        '  // every subset, with no bound and therefore no pruning',
        '  function descend(at, taken, room) {',
        '    nodes += 1;',
        '    if (taken > best) best = taken;',
        '    if (at === sorted.length) return;',
        '    if (sorted[at].weight <= room) {',
        '      descend(at + 1, taken + sorted[at].value, room - sorted[at].weight);',
        '    }',
        '    descend(at + 1, taken, room);',
        '  }',
        '',
        '  descend(0, 0, capacity);',
        '  return { value: best, nodes: nodes };',
        '}'
      ].join('\n'),
      solution: [
        'function knapsack(items, capacity) {',
        '  const sorted = items.slice().sort(function (a, b) {',
        '    return (b.value / b.weight) - (a.value / a.weight);',
        '  });',
        '  let best = 0;',
        '  let nodes = 0;',
        '',
        '  // the LP optimum of this subtree: greedy by density with the last item',
        '  // cut. No integral completion can beat it, so it is a safe ceiling.',
        '  function bound(at, taken, room) {',
        '    let total = taken;',
        '    let remaining = room;',
        '    for (let i = at; i < sorted.length && remaining > 0; i += 1) {',
        '      if (sorted[i].weight <= remaining) {',
        '        total += sorted[i].value;',
        '        remaining -= sorted[i].weight;',
        '      } else {',
        '        total += sorted[i].value * (remaining / sorted[i].weight);',
        '        remaining = 0;',
        '      }',
        '    }',
        '    return total;',
        '  }',
        '',
        '  function descend(at, taken, room) {',
        '    nodes += 1;',
        '    if (taken > best) best = taken;',
        '    if (at === sorted.length) return;',
        '    if (bound(at, taken, room) <= best) return;',
        '',
        '    // the take branch first, so an incumbent exists as early as possible',
        '    if (sorted[at].weight <= room) {',
        '      descend(at + 1, taken + sorted[at].value, room - sorted[at].weight);',
        '    }',
        '    descend(at + 1, taken, room);',
        '  }',
        '',
        '  descend(0, 0, capacity);',
        '  return { value: best, nodes: nodes };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'it agrees with exhaustive enumeration on 60 random instances',
          assert: function (knapsack, api) {
            const random = api.rng;

            for (let trial = 0; trial < 60; trial += 1) {
              const count = 4 + random.int(11);
              const items = [];
              let total = 0;
              for (let i = 0; i < count; i += 1) {
                const weight = 1 + random.int(30);
                items.push({ id: i, value: 1 + random.int(60), weight: weight });
                total += weight;
              }
              const capacity = Math.max(1, Math.round(total * (0.2 + random.next() * 0.6)));

              let best = 0;
              for (let mask = 0; mask < (1 << count); mask += 1) {
                let weight = 0;
                let value = 0;
                for (let i = 0; i < count; i += 1) {
                  if (!(mask & (1 << i))) continue;
                  weight += items[i].weight;
                  value += items[i].value;
                }
                if (weight <= capacity && value > best) best = value;
              }

              api.assert.equal(knapsack(items, capacity).value, best,
                'trial ' + trial + ' with ' + count + ' items and capacity ' + capacity);
            }
          }
        },
        {
          name: 'the edge cases do not need a special path',
          assert: function (knapsack, api) {
            api.assert.equal(knapsack([], 50).value, 0, 'no items');
            api.assert.equal(knapsack([{ id: 0, value: 10, weight: 5 }], 0).value, 0, 'no capacity');
            api.assert.equal(knapsack([{ id: 0, value: 10, weight: 50 }], 5).value, 0, 'nothing fits');
            api.assert.equal(knapsack([{ id: 0, value: 10, weight: 5 }], 5).value, 10, 'exactly one fits');
            api.assert.equal(
              knapsack([{ id: 0, value: 3, weight: 2 }, { id: 1, value: 4, weight: 3 }], 5).value, 7,
              'both fit');
          }
        },
        {
          name: 'the bound prunes: far fewer nodes than the 2^n tree',
          assert: function (knapsack, api) {
            const random = api.rng;
            const items = [];
            let total = 0;
            for (let i = 0; i < 22; i += 1) {
              const weight = 5 + random.int(45);
              items.push({ id: i, value: 10 + random.int(90), weight: weight });
              total += weight;
            }
            const capacity = Math.round(total * 0.4);

            const run = knapsack(items, capacity);
            api.assert.atMost(run.nodes, 20000,
              'the unbounded tree has 8 388 607 nodes at 22 items; a relaxation bound reaches about 70. Got ' +
                run.nodes);
            api.assert.atLeast(run.value, 1, 'and it still finds a solution');
          }
        },
        {
          name: 'the bound is admissible: it never loses the optimum, even when pruning hard',
          assert: function (knapsack, api) {
            const random = api.rng;

            for (let trial = 0; trial < 25; trial += 1) {
              const count = 12 + random.int(5);
              const items = [];
              let total = 0;
              for (let i = 0; i < count; i += 1) {
                const weight = 10 + random.int(10);
                items.push({ id: i, value: 100 + random.int(5), weight: weight });
                total += weight;
              }
              const capacity = Math.round(total / 2);

              let best = 0;
              for (let mask = 0; mask < (1 << count); mask += 1) {
                let weight = 0;
                let value = 0;
                for (let i = 0; i < count; i += 1) {
                  if (!(mask & (1 << i))) continue;
                  weight += items[i].weight;
                  value += items[i].value;
                }
                if (weight <= capacity && value > best) best = value;
              }

              api.assert.equal(knapsack(items, capacity).value, best,
                'near-identical densities, trial ' + trial + ' — the case a loose bound gets wrong');
            }
          }
        }
      ]
    }]
  });
}(typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : null)));

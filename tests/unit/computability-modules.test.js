/**
 * Property tests for the M26 computability modules.
 *
 * The governing rule of this milestone is that a limit is only worth stating
 * once the thing it limits has been run. Every machine is checked against a
 * definition written from the LANGUAGE rather than from the machine; every
 * model equivalence is demonstrated by executing the same function in each; and
 * the halting construction is run against arbitrary candidate deciders rather
 * than argued about.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const BASE = path.join(__dirname, '..', '..', 'src', 'js');
const TuringMachine = require(path.join(BASE, 'machines', 'turing-machine.js'));
const ModelZoo = require(path.join(BASE, 'machines', 'model-zoo.js'));
const Undecidability = require(path.join(BASE, 'algorithms', 'undecidability.js'));
const SpaceBounded = require(path.join(BASE, 'algorithms', 'space-bounded.js'));

/* --------------------------------------------------------- Turing machines */

/** Every string over an alphabet up to a length, including the empty one. */
function strings(alphabet, maxLength) {
  const out = [''];
  let level = [''];

  for (let length = 0; length < maxLength; length += 1) {
    const next = [];

    level.forEach(function (prefix) {
      alphabet.forEach(function (symbol) { next.push(prefix + symbol); });
    });
    next.forEach(function (text) { out.push(text); });
    level = next;
  }
  return out;
}

test('the aⁿbⁿcⁿ machine agrees with the language over every string up to length 7',
  function () {
    const machine = TuringMachine.anbncn();
    const inLanguage = function (word) {
      if (!/^a*b*c*$/.test(word)) return false;
      const counts = ['a', 'b', 'c'].map(function (symbol) {
        return word.split('').filter(function (c) { return c === symbol; }).length;
      });

      return counts[0] === counts[1] && counts[1] === counts[2];
    };
    const words = strings(['a', 'b', 'c'], 7);

    assert.equal(words.length, 3280, 'every string up to length 7 over three symbols');
    words.forEach(function (word) {
      const outcome = TuringMachine.run(machine, word, { budget: 5000, traceLimit: 0 });

      assert.ok(outcome.halted, 'did not halt on "' + word + '"');
      assert.equal(outcome.accepted, inLanguage(word),
        'disagreement on "' + (word || 'the empty string') + '"');
    });
  });

test('the order phase is what rejects a correctly-counted but wrongly-ordered string',
  function () {
    const machine = TuringMachine.anbncn();

    /* Every one of these has equal counts and the wrong order — exactly the
       family the first version of this machine accepted. */
    ['abcabc', 'acb', 'bca', 'cba', 'bacbac', 'abcabcabc'].forEach(function (word) {
      const outcome = TuringMachine.run(machine, word, { budget: 5000, traceLimit: 0 });

      assert.ok(!outcome.accepted, 'accepted "' + word + '", which is not in the language');
    });
  });

test('the palindrome machine agrees with reversal over every binary string up to length 8',
  function () {
    const machine = TuringMachine.palindrome();
    const words = strings(['0', '1'], 8);

    assert.equal(words.length, 511);
    words.forEach(function (word) {
      const outcome = TuringMachine.run(machine, word, { budget: 5000, traceLimit: 0 });

      assert.ok(outcome.halted, 'did not halt on "' + word + '"');
      assert.equal(outcome.accepted, word === word.split('').reverse().join(''),
        'disagreement on "' + (word || 'the empty string') + '"');
    });
  });

test('increment and doubling compute the arithmetic they claim to', function () {
  for (let value = 0; value < 32; value += 1) {
    const input = value.toString(2);
    const outcome = TuringMachine.run(TuringMachine.increment(), input,
      { budget: 5000, traceLimit: 0 });
    const result = outcome.tape.replace(/_/g, '');

    assert.equal(parseInt(result, 2), value + 1,
      'increment of ' + input + ' gave ' + result);
  }
  for (let n = 0; n <= 8; n += 1) {
    const outcome = TuringMachine.run(TuringMachine.doubler(), '1'.repeat(n),
      { budget: 20000, traceLimit: 0 });
    const ones = (outcome.tape.match(/1/g) || []).length;

    assert.ok(outcome.halted, 'doubling did not halt at n = ' + n);
    assert.equal(ones, 2 * n, 'doubling ' + n + ' gave ' + ones);
  }
});

test('a budget exhaustion is a third outcome, and it is stable', function () {
  [10, 100, 500, 2000].forEach(function (budget) {
    const outcome = TuringMachine.run(TuringMachine.looper(), '1011',
      { budget: budget, traceLimit: 0 });

    assert.equal(outcome.outcome, 'budget',
      'at a budget of ' + budget + ' the looper must report `budget`, not `rejected`');
    assert.ok(!outcome.accepted);
    assert.ok(!outcome.halted, 'and it must not claim to have halted');
    assert.equal(outcome.steps, budget, 'it must use the whole budget');
  });
  assert.ok(!TuringMachine.haltsWithin(TuringMachine.looper(), '1011', 5000));
  assert.ok(TuringMachine.haltsWithin(TuringMachine.increment(), '1011', 50));
});

test('a machine round-trips through its encoding', function () {
  Object.keys(TuringMachine.programs()).forEach(function (name) {
    const machine = TuringMachine.programs()[name]();
    const decoded = TuringMachine.decode(TuringMachine.encode(machine));

    assert.equal(decoded.transitions.length, machine.transitions.length,
      name + ': transition count changed');
    ['1011', 'aaabbbccc', '101', ''].forEach(function (input) {
      const before = TuringMachine.run(machine, input, { budget: 4000, traceLimit: 0 });
      const after = TuringMachine.run(decoded, input, { budget: 4000, traceLimit: 0 });

      assert.equal(after.outcome, before.outcome, name + ' on "' + input + '"');
      assert.equal(after.tape, before.tape, name + ' tape on "' + input + '"');
    });
  });
});

/* ------------------------------------------------------------- the models */

test('one function computed in three models gives one answer', function () {
  const doubling = ModelZoo.doubling();

  for (let n = 0; n <= 10; n += 1) {
    const counter = ModelZoo.runCounter(doubling.counter, [n, 0]);
    const ram = ModelZoo.runRam(doubling.ram, [n, 0]);
    const turing = TuringMachine.run(TuringMachine.doubler(), '1'.repeat(n),
      { budget: 20000, traceLimit: 0 });

    assert.equal(counter.output[1], 2 * n, 'counter machine at n = ' + n);
    assert.equal(ram.output[1], 2 * n, 'RAM at n = ' + n);
    assert.equal((turing.tape.match(/1/g) || []).length, 2 * n, 'Turing machine at n = ' + n);
  }
});

test('the three models have three different cost curves', function () {
  const doubling = ModelZoo.doubling();
  const rows = [1, 2, 4, 6, 8, 10].map(function (n) {
    return {
      n: n,
      ram: ModelZoo.runRam(doubling.ram, [n, 0]).steps,
      counter: ModelZoo.runCounter(doubling.counter, [n, 0]).steps,
      turing: TuringMachine.run(TuringMachine.doubler(), '1'.repeat(n),
        { budget: 20000, traceLimit: 0 }).steps
    };
  });

  rows.forEach(function (row) {
    assert.equal(row.ram, 2, 'the RAM is constant at 2 steps, at n = ' + row.n);
    assert.equal(row.counter, 3 * row.n + 1,
      'the counter machine is 3n + 1, at n = ' + row.n);
    assert.equal(row.turing, 2 * row.n * row.n + 4 * row.n + 2,
      'the Turing machine is 2n² + 4n + 2, at n = ' + row.n);
  });
});

test('addition agrees between the counter machine and the RAM', function () {
  const addition = ModelZoo.addition();

  for (let x = 0; x <= 6; x += 1) {
    for (let y = 0; y <= 6; y += 1) {
      assert.equal(ModelZoo.runCounter(addition.counter, [x, y]).output[0], x + y,
        'counter machine on ' + x + ' + ' + y);
      assert.equal(ModelZoo.runRam(addition.ram, [x, y]).output[0], x + y,
        'RAM on ' + x + ' + ' + y);
    }
  }
});

test('SKI reduction gives the combinators their advertised behaviour', function () {
  const cases = [
    ['Ix', 'x'], ['Kxy', 'x'], ['SKKx', 'x'], ['SIIx', 'xx'],
    ['S(K(SI))Kxy', 'yx'], ['KIxy', 'y']
  ];

  cases.forEach(function (pair) {
    const outcome = ModelZoo.runSki(ModelZoo.ski(pair[0]), 4000);

    assert.equal(outcome.outcome, 'halted', pair[0] + ' did not reach a normal form');
    assert.equal(outcome.output, pair[1],
      pair[0] + ' reduced to ' + outcome.output + ', expected ' + pair[1]);
  });
});

test('Rule 90 is XOR of its neighbours, checked cell by cell', function () {
  const width = 21;
  let seed = '';

  for (let i = 0; i < width; i += 1) seed += i === 10 ? '1' : '0';
  const run = ModelZoo.runCellular(90, seed, 8);

  for (let g = 1; g < run.rows.length; g += 1) {
    const previous = run.rows[g - 1];

    run.rows[g].forEach(function (cell, i) {
      const left = previous[(i - 1 + width) % width];
      const right = previous[(i + 1) % width];

      assert.equal(cell, left ^ right,
        'generation ' + g + ', cell ' + i + ': rule 90 must be the XOR of the neighbours');
    });
  }
});

test('the rule table has eight entries and the rule number is its bits', function () {
  [30, 90, 110, 184].forEach(function (rule) {
    const table = ModelZoo.ruleTable(rule);

    assert.equal(table.length, 8);
    const recovered = table.reduce(function (total, bit, i) {
      return total + bit * Math.pow(2, i);
    }, 0);

    assert.equal(recovered, rule, 'the table must encode rule ' + rule);
  });
});

/* ------------------------------------------------------- undecidability */

test('the diagonal construction defeats 200 arbitrary deciders', function () {
  for (let i = 0; i < 200; i += 1) {
    const decider = function (source) {
      return ((i * 2654435761 + source.length * 7) % 3) === 0 ? 'halts' : 'loops';
    };
    const outcome = Undecidability.defeat(decider);

    assert.ok(outcome.contradiction, 'decider ' + i + ' was not contradicted');
    assert.notEqual(outcome.oracleSaid, outcome.actuallyDoes,
      'decider ' + i + ': the verdicts must differ');
  }
  ['heuristicDecider', 'optimisticDecider', 'pessimisticDecider'].forEach(function (name) {
    assert.ok(Undecidability.defeat(Undecidability[name]()).contradiction,
      name + ' was not contradicted');
  });
});

test('the diagonal machine differs from every row at its own column', function () {
  const behaviour = function (i, j) {
    let h = ((i + 1) * 0x9e3779b1) ^ ((j + 1) * 0x85ebca6b);

    h = Math.imul(h ^ (h >>> 15), 0xc2b2ae35);
    h ^= h >>> 13;
    return ((h >>> 0) % 2 === 0) ? 'loops' : 'halts';
  };

  [3, 6, 10].forEach(function (size) {
    const table = Undecidability.diagonalTable(behaviour, size);
    const machine = Undecidability.diagonalMachine(behaviour, size);

    assert.equal(table.length, size);
    assert.equal(machine.row.length, size);
    machine.differences.forEach(function (difference, i) {
      assert.equal(difference.column, i, 'the difference must be at the diagonal cell');
      assert.notEqual(difference.itDoes, difference.weDo,
        'row ' + i + ' and the constructed machine must disagree at column ' + i);
      assert.equal(table[i].cells[i], difference.itDoes);
      assert.equal(machine.row[i], difference.weDo);
    });
    /* A table of constant rows makes the diagonal look like a coincidence. */
    table.forEach(function (row) {
      assert.equal(new Set(row.cells).size, 2,
        'every row must show both outcomes, or the picture teaches nothing');
    });
  });
});

test('Rice’s condition is applied mechanically, and both escapes are distinguished',
  function () {
    const rows = Undecidability.classify();

    assert.equal(rows.length, 10);
    rows.forEach(function (row) {
      const expected = !(row.semantic && !row.trivial);

      assert.equal(row.decidable, expected,
        row.name + ': decidable exactly when not (semantic and non-trivial)');
      if (!row.decidable) {
        assert.ok(row.reason.indexOf('Rice') !== -1, row.name + ': the reason must name Rice');
      } else if (!row.semantic) {
        assert.ok(row.reason.indexOf('syntactic') !== -1, row.name + ': syntactic escape');
      } else {
        assert.ok(row.reason.indexOf('trivial') !== -1, row.name + ': trivial escape');
      }
    });
    assert.equal(rows.filter(function (r) { return !r.decidable; }).length, 4);
    assert.equal(rows.filter(function (r) { return r.decidable && !r.semantic; }).length, 4);
    assert.equal(rows.filter(function (r) { return r.decidable && r.semantic; }).length, 2);
  });

test('every reduction includes the original source and states both halves', function () {
  const source = 'while (x > 0) { x = step(x); }';

  Undecidability.REDUCTIONS.forEach(function (entry, i) {
    const reduction = Undecidability.reduce(i, source);

    assert.ok(reduction.transformed.indexOf('while (x > 0)') !== -1,
      entry.target + ': the transformed program must contain the original');
    assert.ok(reduction.equivalence.length > 20,
      entry.target + ': the equivalence must be stated');
    assert.ok(reduction.consequence.length > 20,
      entry.target + ': the consequence must be stated');
  });
  assert.equal(Undecidability.REDUCTIONS.length, 5);
});

/* --------------------------------------------------------- space bounds */

test('BFS and Savitch agree on every graph and size', function () {
  const builders = SpaceBounded.graphs();

  Object.keys(builders).forEach(function (name) {
    for (let n = 4; n <= 10; n += 1) {
      const graph = builders[name](n);
      const result = SpaceBounded.compare(graph, 0, n - 1);

      assert.ok(result.agree,
        name + ' at n = ' + n + ': BFS said ' + result.rows[0].reachable +
          ' and Savitch said ' + result.rows[1].reachable);
    }
  });
});

test('Savitch holds three indices per level and releases them', function () {
  for (let n = 4; n <= 12; n += 1) {
    const result = SpaceBounded.savitch(SpaceBounded.path(n), 0, n - 1);
    const bits = SpaceBounded.indexBits(n);
    const bound = 3 * bits * Math.ceil(Math.log2(Math.max(2, n)));

    assert.ok(result.peakBits <= bound,
      'at n = ' + n + ' the peak was ' + result.peakBits + ' against a bound of ' + bound);
    assert.ok(result.peakBits > 0, 'the meter must count something');
    assert.equal(result.levels, Math.ceil(Math.log2(Math.max(2, n))));
  }
});

test('the space advantage arrives, and the time cost arrives faster', function () {
  const growth = [8, 64, 256, 1024].map(function (n) {
    const bfs = SpaceBounded.breadthFirst(SpaceBounded.path(n), 0, n - 1);
    const bits = SpaceBounded.indexBits(n);
    const bound = 3 * bits * Math.ceil(Math.log2(n));

    return { n: n, bfs: bfs.peakBits, bound: bound };
  });

  assert.deepEqual(growth.map(function (row) { return row.bfs; }), [24, 384, 2048, 10240]);
  assert.deepEqual(growth.map(function (row) { return row.bound; }), [27, 108, 192, 300]);
  assert.ok(growth[0].bfs < growth[0].bound, 'BFS is still cheaper at 8 vertices');
  assert.ok(growth[3].bfs > 30 * growth[3].bound, 'and 30× more expensive at 1 024');

  const twelve = SpaceBounded.compare(SpaceBounded.path(12), 0, 11);

  assert.ok(twelve.timeRatio > 700,
    'Savitch pays hundreds of times the work at twelve vertices, got ' + twelve.timeRatio);
});

test('the memory meter releases what it holds', function () {
  const gauge = SpaceBounded.meter();
  const releaseA = gauge.hold(10);
  const releaseB = gauge.hold(20);

  assert.equal(gauge.held(), 30);
  assert.equal(gauge.peak(), 30);
  releaseB();
  assert.equal(gauge.held(), 10);
  assert.equal(gauge.peak(), 30, 'the peak is a high-water mark and does not fall');
  const releaseC = gauge.hold(5);

  assert.equal(gauge.held(), 15);
  assert.equal(gauge.peak(), 30, 'and a smaller later allocation does not raise it');
  releaseA();
  releaseC();
  assert.equal(gauge.held(), 0, 'everything held must be released');
  assert.equal(gauge.allocations(), 3);
});

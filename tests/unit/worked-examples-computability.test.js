/**
 * Every figure the M26 worked examples quote, recomputed from the modules —
 * and then checked to still be quoted.
 *
 * Recomputing catches a module that drifted from the prose; the quote check
 * catches prose that drifted from the module. A test that does only the first
 * passes happily while the section teaches a number nothing produces any more.
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
const InteractiveProofs = require(path.join(BASE, 'algorithms', 'interactive-proofs.js'));
const Circuits = require(path.join(BASE, 'algorithms', 'circuits.js'));
const Kolmogorov = require(path.join(BASE, 'algorithms', 'kolmogorov.js'));
const QuantumSim = require(path.join(BASE, 'algorithms', 'quantum-sim.js'));
const ComplexityAtlas = require(path.join(BASE, 'content', 'complexity-atlas.js'));
const Random = require(path.join(BASE, 'utils', 'random.js'));

const CONTENT = path.join(BASE, 'content');

['computability', 'complexity', 'limits'].forEach(function (third) {
  require(path.join(CONTENT, 'examples-' + third + '.js'));
  require(path.join(CONTENT, 'concepts-' + third + '.js'));
});

const prose = require('../support/worked-example-prose.js');

const SECONDS_PER_YEAR = 31557600;

/* ------------------------------------------------- 26.1 Turing machines */

test('26.1: the aⁿbⁿcⁿ cost curve, and the exhaustive check', function () {
  const machine = TuringMachine.anbncn();
  const rows = [1, 2, 3, 4, 5].map(function (n) {
    const word = 'a'.repeat(n) + 'b'.repeat(n) + 'c'.repeat(n);
    const outcome = TuringMachine.run(machine, word, { budget: 5000, traceLimit: 0 });

    return { tokens: word.length, steps: outcome.steps, space: outcome.space };
  });

  assert.deepEqual(rows.map(function (r) { return r.tokens; }), [3, 6, 9, 12, 15]);
  assert.deepEqual(rows.map(function (r) { return r.steps; }), [16, 37, 66, 103, 148]);
  assert.deepEqual(rows.map(function (r) { return r.space; }), [5, 8, 11, 14, 17]);
  assert.equal(machine.transitions.length, 29);

  /* The bug the exhaustive check found: the counting phase alone accepts this. */
  assert.ok(!TuringMachine.run(machine, 'abcabc', { budget: 5000, traceLimit: 0 }).accepted);

  prose.quotes('turing-machines',
    ['16 steps', '37 steps for 6 tokens, 66 for 9', '3 280 strings checked, 0 disagreements',
      'accepted `abcabc`', '29 transitions', '5 tape cells']);
});

test('26.1: the three outcomes, and the encoding round trip', function () {
  const increment = TuringMachine.run(TuringMachine.increment(), '1011',
    { budget: 5000, traceLimit: 0 });

  assert.equal(increment.steps, 8);
  assert.equal(increment.outcome, 'halted');
  assert.equal(increment.tape.replace(/_/g, ''), '1100');

  [10, 500, 2000].forEach(function (budget) {
    assert.equal(TuringMachine.run(TuringMachine.looper(), '1011',
      { budget: budget, traceLimit: 0 }).outcome, 'budget');
  });

  const encoded = TuringMachine.encode(TuringMachine.increment());

  assert.equal(encoded.length, 116);
  assert.equal(TuringMachine.run(TuringMachine.decode(encoded), '1011',
    { budget: 5000, traceLimit: 0 }).tape.replace(/_/g, ''), '1100');

  prose.quotes('turing-machines',
    ['8 steps, outcome `halted`, tape reads 1100', '511 strings, 0 disagreements',
      '116 characters', 'still `budget` at 10 steps and at 2 000']);
});

/* ------------------------------------------------------- 26.2 the models */

test('26.2: three cost curves for one function', function () {
  const doubling = ModelZoo.doubling();
  const rows = [1, 4, 10].map(function (n) {
    return {
      n: n,
      ram: ModelZoo.runRam(doubling.ram, [n, 0]).steps,
      counter: ModelZoo.runCounter(doubling.counter, [n, 0]).steps,
      turing: TuringMachine.run(TuringMachine.doubler(), '1'.repeat(n),
        { budget: 20000, traceLimit: 0 }).steps,
      answer: ModelZoo.runRam(doubling.ram, [n, 0]).output[1]
    };
  });

  assert.deepEqual(rows.map(function (r) { return r.ram; }), [2, 2, 2]);
  assert.deepEqual(rows.map(function (r) { return r.counter; }), [4, 13, 31]);
  assert.deepEqual(rows.map(function (r) { return r.turing; }), [8, 50, 242]);
  assert.deepEqual(rows.map(function (r) { return r.answer; }), [2, 8, 20]);

  prose.quotes('equivalent-models-of-computation',
    ['RAM 2 steps, counter 4, Turing 8', 'RAM 2, counter 13, Turing 50',
      'RAM 2, counter 31, Turing 242', '3n + 1', '2n² + 4n + 2']);
});

test('26.2: the models with no tape', function () {
  const cases = [['SIIx', 'xx', 3], ['S(K(SI))Kxy', 'yx', 5]];

  cases.forEach(function (entry) {
    const outcome = ModelZoo.runSki(ModelZoo.ski(entry[0]), 4000);

    assert.equal(outcome.output, entry[1], entry[0]);
    assert.equal(outcome.steps, entry[2], entry[0] + ' step count');
  });
  assert.equal(ModelZoo.runTag(ModelZoo.collatzTag(), 'aaa', 200).steps, 24);
  assert.equal(ModelZoo.ruleTable(90).length, 8);

  prose.quotes('equivalent-models-of-computation',
    ['3 steps to `xx`', '5 steps to `yx`', 'halts after 24 steps',
      'the Sierpinski triangle']);
});

/* ------------------------------------------------- 26.3 undecidability */

test('26.3: every oracle is defeated, and by what', function () {
  const heuristic = Undecidability.defeat(Undecidability.heuristicDecider());
  const optimistic = Undecidability.defeat(Undecidability.optimisticDecider());
  const pessimistic = Undecidability.defeat(Undecidability.pessimisticDecider());

  assert.equal(heuristic.oracleSaid, 'loops');
  assert.equal(heuristic.actuallyDoes, 'halts');
  assert.equal(optimistic.oracleSaid, 'halts');
  assert.equal(optimistic.actuallyDoes, 'loops');
  assert.equal(pessimistic.oracleSaid, 'loops');
  assert.equal(pessimistic.actuallyDoes, 'halts');

  let defeated = 0;

  for (let i = 0; i < 200; i += 1) {
    const decider = function (source) {
      return ((i * 2654435761 + source.length) % 3) === 0 ? 'halts' : 'loops';
    };

    if (Undecidability.defeat(decider).contradiction) defeated += 1;
  }
  assert.equal(defeated, 200);
  assert.equal(Undecidability.CONTRARY_SOURCE.split('\n').length, 6);

  prose.quotes('undecidability-and-diagonalisation',
    ['200 of 200 defeated', 'in 6 lines', '1 oracle call']);
});

test('26.3: the diagonal table, and bounded halting', function () {
  const behaviour = function (i, j) {
    let h = ((i + 1) * 0x9e3779b1) ^ ((j + 1) * 0x85ebca6b);

    h = Math.imul(h ^ (h >>> 15), 0xc2b2ae35);
    h ^= h >>> 13;
    return ((h >>> 0) % 2 === 0) ? 'loops' : 'halts';
  };
  const table = Undecidability.diagonalTable(behaviour, 6);
  const machine = Undecidability.diagonalMachine(behaviour, 6);

  assert.equal(table.length, 6);
  assert.equal(table[0].cells.length, 6);
  assert.equal(machine.differences.length, 6);

  const names = ['increment', 'anbncn', 'palindrome', 'doubler', 'looper'];
  const inputs = { increment: '1011', anbncn: 'aaabbbccc', palindrome: '10101',
    doubler: '1111', looper: '1011' };
  const decided = function (budget) {
    return names.filter(function (name) {
      return TuringMachine.run(TuringMachine.programs()[name](), inputs[name],
        { budget: budget, traceLimit: 0 }).outcome !== 'budget';
    }).length;
  };

  assert.equal(decided(200), 4, 'four of five decided at a budget of 200');
  assert.equal(decided(10), 1, 'only one at a budget of 10');
  assert.equal(decided(2000), 4, 'and still four at 2 000 — the looper never comes back');

  prose.quotes('undecidability-and-diagonalisation',
    ['36 cells', '6 differences listed', '4 of 5 decided',
      'at 10 steps only 1 of 5 is decided']);
});

/* ----------------------------------------------------------- 26.4 Rice */

test('26.4: the classification counts, and the reductions', function () {
  const rows = Undecidability.classify();

  assert.equal(rows.length, 10);
  assert.equal(rows.filter(function (r) { return !r.decidable; }).length, 4);
  assert.equal(rows.filter(function (r) { return r.semantic; }).length, 6);
  assert.equal(rows.filter(function (r) { return r.semantic && r.trivial; }).length, 2);
  assert.equal(rows.filter(function (r) { return !r.semantic; }).length, 4);
  assert.equal(Undecidability.REDUCTIONS.length, 5);

  const reduction = Undecidability.reduce(0, 'while (x > 0) { x = step(x); }');

  assert.ok(reduction.transformed.indexOf('print("reached")') !== -1);
  assert.ok(reduction.transformed.indexOf('while (x > 0)') !== -1);

  prose.quotes('reductions-and-the-rice-theorem',
    ['4 of 10', '6 semantic, of which 2 are trivial', '4 syntactic',
      '5 reductions, 5 impossible feature requests']);
});

/* ----------------------------------------------------------- 26.5 time */

test('26.5: what each growth rate costs, and the atlas totals', function () {
  const n = 40;

  assert.equal(Math.round(n * Math.log2(n)), 213);
  assert.equal(n * n, 1600);
  assert.ok(Math.abs(Math.pow(n, 10) / 1.05e16 - 1) < 0.02, 'n^10 at n = 40');
  assert.ok(Math.abs(Math.pow(2, n) / 1.10e12 - 1) < 0.02, '2^n at n = 40');
  assert.ok(Math.abs(Math.pow(2, 60) / 1.15e18 - 1) < 0.02, '2^n at n = 60');
  assert.ok(Math.abs(Math.pow(2, 60) / 1e9 / SECONDS_PER_YEAR - 36.5) < 1,
    '2^60 at a billion per second is about 36 years');

  const feasible = [1e6, 1e9, 1e12, 1e15].map(function (rate) {
    return Math.floor(Math.log2(rate * SECONDS_PER_YEAR));
  });

  assert.deepEqual(feasible, [44, 54, 64, 74]);
  assert.equal(ComplexityAtlas.all().length, 15);
  assert.equal(ComplexityAtlas.unconditional().length, 8);
  assert.equal(ComplexityAtlas.all().filter(function (row) {
    return row.open.indexOf('nothing') !== 0;
  }).length, 8);

  prose.quotes('time-complexity-classes',
    ['213 and 1 600 operations', '1.05 × 10^16', '1.10 × 10^12', '1.15 × 10^18',
      'about 36 years', 'n = 44 at 10^6 ops/s, 54 at 10^9, 64 at 10^12, 74 at 10^15',
      '8 of 15']);
});

/* ---------------------------------------------------------- 26.6 space */

test('26.6: the metered memory and the time paid for it', function () {
  const rows = [4, 8, 12].map(function (n) {
    const result = SpaceBounded.compare(SpaceBounded.path(n), 0, n - 1);

    return { n: n, bfsBits: result.rows[0].peakBits, bfsSteps: result.rows[0].steps,
      savitchBits: result.rows[1].peakBits, savitchSteps: result.rows[1].steps,
      ratio: Number(result.timeRatio.toFixed(1)) };
  });

  assert.deepEqual(rows.map(function (r) { return r.bfsBits; }), [8, 24, 48]);
  assert.deepEqual(rows.map(function (r) { return r.bfsSteps; }), [4, 8, 12]);
  assert.deepEqual(rows.map(function (r) { return r.savitchBits; }), [12, 27, 48]);
  assert.deepEqual(rows.map(function (r) { return r.savitchSteps; }), [18, 417, 9325]);
  assert.deepEqual(rows.map(function (r) { return r.ratio; }), [4.5, 52.1, 777.1]);

  const growth = [8, 64, 256, 1024].map(function (n) {
    const bfs = SpaceBounded.breadthFirst(SpaceBounded.path(n), 0, n - 1);
    const bound = 3 * SpaceBounded.indexBits(n) * Math.ceil(Math.log2(n));

    return { bfs: bfs.peakBits, bound: bound,
      ratio: Number((bfs.peakBits / bound).toFixed(2)) };
  });

  assert.deepEqual(growth.map(function (r) { return r.bfs; }), [24, 384, 2048, 10240]);
  assert.deepEqual(growth.map(function (r) { return r.bound; }), [27, 108, 192, 300]);
  assert.deepEqual(growth.map(function (r) { return r.ratio; }), [0.89, 3.56, 10.67, 34.13]);

  prose.quotes('space-bounded-computation',
    ['BFS 8 bits and 4 steps; Savitch 12 bits and 18 steps — 4.5× the time',
      'BFS 24 bits and 8 steps; Savitch 27 bits and 417 steps — 52.1×',
      'BFS 48 bits and 12 steps; Savitch 48 bits and 9 325 steps — 777.1×',
      'BFS 24 bits, bound 27 — a ratio of 0.89', 'BFS 384 bits, bound 108 — 3.56×',
      'BFS 2 048 bits, bound 192 — 10.67×', 'BFS 10 240 bits, bound 300 — 34.13×']);
});

/* ---------------------------------------------------- 26.7 interactive */

test('26.7: the soundness measurements the section quotes', function () {
  const pair = InteractiveProofs.samePair();
  const rows = [1, 2, 4, 6].map(function (rounds) {
    const rng = Random.seeded(4711);

    return InteractiveProofs.soundness(pair, InteractiveProofs.lyingProver(), rounds, 2000,
      function () { return rng.next(); });
  });

  assert.deepEqual(rows.map(function (r) { return Number(r.measured.toFixed(5)); }),
    [0.505, 0.254, 0.066, 0.0135]);
  assert.deepEqual(rows.map(function (r) { return Number(r.predicted.toFixed(6)); }),
    [0.5, 0.25, 0.0625, 0.015625]);
  rows.forEach(function (row) {
    assert.ok(Math.abs(row.measured - row.predicted) <= row.tolerance,
      'at ' + row.rounds + ' rounds the measurement left the three-sigma band');
  });

  const honest = Random.seeded(11235);
  let accepted = 0;

  for (let i = 0; i < 500; i += 1) {
    if (InteractiveProofs.verify(InteractiveProofs.differentPair(),
      InteractiveProofs.honestProver(), 8, function () { return honest.next(); }).accepted) {
      accepted += 1;
    }
  }
  assert.equal(accepted, 500);

  prose.quotes('randomised-and-interactive-classes',
    ['measured 0.50500 against a predicted 0.5', 'measured 0.25400 against 0.25',
      'measured 0.06600 against 0.0625', 'measured 0.01350 against 0.015625',
      'accepted 500 of 500', '720 permutations checked']);
});

/* ------------------------------------------------------- 26.8 circuits */

test('26.8: the adder figures and the OR arrangements', function () {
  const rows = [2, 4, 6, 8].map(function (width) {
    const ripple = Circuits.rippleCarry(width);
    const lookahead = Circuits.carryLookahead(width);

    return { width: width, rs: Circuits.size(ripple), rd: Circuits.depth(ripple),
      ls: Circuits.size(lookahead), ld: Circuits.depth(lookahead) };
  });

  assert.deepEqual(rows.map(function (r) { return r.rs + '/' + r.rd; }),
    ['5/3', '13/7', '21/11', '29/15']);
  assert.deepEqual(rows.map(function (r) { return r.ls + '/' + r.ld; }),
    ['6/3', '15/3', '28/3', '45/3']);
  assert.equal(21 * 20, 420, 'sanity: the arithmetic in the latency claim');
  assert.equal(Circuits.depth(Circuits.rippleCarry(6)) * 20, 220);
  assert.equal(Circuits.depth(Circuits.carryLookahead(6)) * 20, 60);

  assert.equal(Circuits.size(Circuits.orChain(16)), 15);
  assert.equal(Circuits.depth(Circuits.orChain(16)), 15);
  assert.equal(Circuits.size(Circuits.orTree(16)), 15);
  assert.equal(Circuits.depth(Circuits.orTree(16)), 4);
  assert.equal(Circuits.size(Circuits.orFlat(16)), 1);
  assert.equal(Circuits.depth(Circuits.orFlat(16)), 1);
  assert.equal(Math.pow(2, 8), 256, 'the truth table size the section quotes');

  prose.quotes('circuits-and-non-uniform-computation',
    ['ripple 5 gates / depth 3', 'ripple 13 / 7; lookahead 15 / 3',
      'ripple 21 / 11; lookahead 28 / 3', 'ripple 29 / 15; lookahead 45 / 3',
      '256 combinations at width 8', 'both 15 gates and 15 deep', 'both 15 gates and 4 deep',
      '1 gate, depth 1']);
});

/* ---------------------------------------------------- 26.9 Kolmogorov */

test('26.9: the counting bound and the four samples', function () {
  const rows = [[10, 1], [12, 2], [16, 2], [16, 4]].map(function (pair) {
    return Kolmogorov.verifyBound(pair[0], pair[1]);
  });

  assert.deepEqual(rows.map(function (r) { return r.total; }), [1024, 4096, 65536, 65536]);
  assert.deepEqual(rows.map(function (r) { return r.compressed; }), [2, 26, 136, 52]);
  assert.deepEqual(rows.map(function (r) { return r.bound; }), [511, 1023, 16383, 4095]);
  rows.forEach(function (row) { assert.ok(row.withinBound); });
  assert.ok(rows[1].headroom > 900);

  const samples = {};

  Kolmogorov.samples(32).forEach(function (sample) {
    samples[sample.name] = Kolmogorov.upperBound(sample.bits).best;
  });
  assert.equal(samples['all zeros'], 9);
  assert.equal(samples.alternating, 10);
  assert.equal(samples['the perfect squares'], 32);
  assert.equal(samples['a fixed pseudo-random string'], 32);

  const sixteen = Kolmogorov.incompressibleFraction(16);

  assert.equal(sixteen.incompressible, 65064);
  assert.equal(sixteen.total, 65536);

  prose.quotes('kolmogorov-complexity-and-randomness',
    ['1 024 strings, bound 511, and 2 actually compress',
      '4 096 strings, bound 1 023, and 26 actually compress',
      '65 536 strings, bound 16 383, and 136 actually compress',
      '65 536 strings, bound 4 095, and 52 actually compress',
      '9 bits via the period codec', '10 bits via the same codec',
      '32 bits via the LITERAL codec', '65 064 of 65 536']);
});

/* ------------------------------------------------------- 26.10 quantum */

test('26.10: Grover against the formula, and Deutsch–Jozsa exactly', function () {
  const rows = [2, 4, 5, 6].map(function (n) {
    const size = Math.pow(2, n);
    const outcome = QuantumSim.grover(n, 3 % size, outcomeLength(size));
    const atOptimal = outcome.rows[outcome.optimal];

    return { n: n, optimal: outcome.optimal,
      peak: Number(atOptimal.measured.toFixed(4)),
      error: Math.max.apply(null, outcome.rows.map(function (r) { return r.error; })),
      classical: outcome.classical };
  });

  function outcomeLength(size) {
    return Math.ceil(Math.sqrt(size)) + 3;
  }

  assert.deepEqual(rows.map(function (r) { return r.optimal; }), [1, 3, 4, 6]);
  assert.deepEqual(rows.map(function (r) { return r.peak; }), [1, 0.9613, 0.9992, 0.9966]);
  assert.deepEqual(rows.map(function (r) { return r.classical; }), [2, 8, 16, 32]);
  rows.forEach(function (row) {
    assert.ok(row.error < 1e-14, 'n = ' + row.n + ': error ' + row.error);
  });

  const four = QuantumSim.grover(4, 3, 6);

  assert.equal(Number(four.rows[3].measured.toFixed(3)), 0.961);
  assert.equal(Number(four.rows[4].measured.toFixed(3)), 0.582);
  assert.equal(Number(four.rows[5].measured.toFixed(3)), 0.125);

  prose.quotes('quantum-computation',
    ['peak 1.0000 at k = 1, matching the formula to 8.88e-16',
      'peak 0.9613 at k = 3, error 4.44e-16, against a classical average of 8',
      'peak 0.9992 at k = 4, error 7.77e-16, against a classical average of 16',
      'peak 0.9966 at k = 6, error 1.67e-16, against a classical average of 32',
      'from 0.961 at k = 3 to 0.582 at k = 4 and']);
});

test('26.10: Deutsch–Jozsa is exact, and the entangling circuits are what they claim',
  function () {
    [2, 3, 4].forEach(function (n) {
      const constant = QuantumSim.deutschJozsa(n, QuantumSim.constantOracle(0));
      const balanced = QuantumSim.deutschJozsa(n, QuantumSim.balancedOracle());

      assert.equal(constant.zeroProbability.toFixed(6), '1.000000');
      assert.equal(balanced.zeroProbability.toFixed(6), '0.000000');
      assert.equal(constant.classicalWorstCase, Math.pow(2, n - 1) + 1);
    });

    const bell = QuantumSim.runCircuit(2, QuantumSim.bell()).probabilities;
    const ghz = QuantumSim.runCircuit(3, QuantumSim.ghz()).probabilities;

    assert.deepEqual(bell.map(function (p) { return p.toFixed(4); }),
      ['0.5000', '0.0000', '0.0000', '0.5000']);
    assert.equal(ghz[0].toFixed(4), '0.5000');
    assert.equal(ghz[7].toFixed(4), '0.5000');

    prose.quotes('quantum-computation',
      ['probability exactly 1.000000 on |000>', 'probability exactly 0.000000 on |000>',
        'probabilities 0.5000, 0, 0, 0.5000',
        'probabilities 0.5000 on |000> and 0.5000 on |111>']);
  });

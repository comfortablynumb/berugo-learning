/**
 * Property tests for the M26 complexity modules — interactive proofs,
 * circuits, Kolmogorov complexity and the quantum simulator.
 *
 * Each of these has an independent reference the implementation is checked
 * against rather than trusted: the soundness bound is measured over thousands
 * of runs, circuit correctness is checked over every input, the counting bound
 * is verified by brute force, and every quantum amplitude is compared to a
 * closed form.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const BASE = path.join(__dirname, '..', '..', 'src', 'js');
const InteractiveProofs = require(path.join(BASE, 'algorithms', 'interactive-proofs.js'));
const Circuits = require(path.join(BASE, 'algorithms', 'circuits.js'));
const Kolmogorov = require(path.join(BASE, 'algorithms', 'kolmogorov.js'));
const QuantumSim = require(path.join(BASE, 'algorithms', 'quantum-sim.js'));
const ComplexityAtlas = require(path.join(BASE, 'content', 'complexity-atlas.js'));
const Random = require(path.join(BASE, 'utils', 'random.js'));

/* ------------------------------------------------------ interactive proofs */

test('the fixture pair really differs and the lying pair really does not', function () {
  const different = InteractiveProofs.differentPair();
  const same = InteractiveProofs.samePair();

  assert.ok(!InteractiveProofs.isomorphic(different.left, different.right),
    'a six-cycle and two triangles must not be isomorphic');
  assert.ok(InteractiveProofs.isomorphic(same.left, same.right),
    'the same graph permuted must be isomorphic to itself');

  const degrees = function (graph) {
    return graph.matrix.map(function (row) {
      return row.reduce(function (a, b) { return a + b; }, 0);
    }).sort().join(',');
  };

  assert.equal(degrees(different.left), degrees(different.right),
    'the honest pair must have identical degree sequences, or counting would separate them');
});

test('an honest prover on a true claim is never rejected', function () {
  const pair = InteractiveProofs.differentPair();
  const rng = Random.seeded(11235);
  const draw = function () { return rng.next(); };

  for (let trial = 0; trial < 500; trial += 1) {
    const outcome = InteractiveProofs.verify(pair, InteractiveProofs.honestProver(), 8, draw);

    assert.ok(outcome.accepted, 'completeness failed at trial ' + trial);
    assert.equal(outcome.trace.length, 8);
  }
});

test('the soundness error matches 2^-k, measured over thousands of runs', function () {
  const pair = InteractiveProofs.samePair();

  [1, 2, 3, 4, 5, 6].forEach(function (rounds) {
    /* A fresh seed per row so the figures are reproducible rather than
       dependent on how many rows ran before. */
    const rng = Random.seeded(4711);
    const outcome = InteractiveProofs.soundness(pair, InteractiveProofs.lyingProver(),
      rounds, 2000, function () { return rng.next(); });

    assert.ok(Math.abs(outcome.measured - outcome.predicted) <= outcome.tolerance,
      'at ' + rounds + ' rounds: measured ' + outcome.measured.toFixed(5) +
        ', predicted ' + outcome.predicted.toFixed(5) +
        ', tolerance ' + outcome.tolerance.toFixed(5));
  });
});

test('a deterministic liar fares exactly as badly as a guessing one', function () {
  const pair = InteractiveProofs.samePair();

  [1, 2, 3, 4].forEach(function (rounds) {
    const rng = Random.seeded(99991);
    const outcome = InteractiveProofs.soundness(pair, InteractiveProofs.stubbornProver(),
      rounds, 2000, function () { return rng.next(); });

    assert.ok(Math.abs(outcome.measured - outcome.predicted) <= outcome.tolerance,
      'the verifier’s coin is what decides, not the prover’s strategy — at ' + rounds +
        ' rounds measured ' + outcome.measured.toFixed(5));
  });
});

test('a permutation preserves the graph and changes the labelling', function () {
  const base = InteractiveProofs.differentPair().left;
  const rng = Random.seeded(7);

  for (let trial = 0; trial < 50; trial += 1) {
    const order = InteractiveProofs.randomOrder(base.n, function () { return rng.next(); });
    const permuted = InteractiveProofs.permute(base, order);

    assert.equal(permuted.edges.length, base.edges.length,
      'a relabelling cannot change the edge count');
    assert.ok(InteractiveProofs.isomorphic(permuted, base),
      'a permuted graph is isomorphic to the original, by construction');
  }
});

/* --------------------------------------------------------------- circuits */

test('every circuit family computes its function on every input, at every width', function () {
  const references = Circuits.references();
  const families = Circuits.families();
  const pairs = [
    ['orChain', references.or], ['orTree', references.or], ['orFlat', references.or],
    ['parityChain', references.parity], ['parityTree', references.parity]
  ];

  pairs.forEach(function (pair) {
    [2, 4, 8].forEach(function (n) {
      const circuit = families[pair[0]](n);

      assert.ok(Circuits.computes(circuit, n, pair[1]()),
        pair[0] + ' is wrong at width ' + n);
    });
  });
  [2, 3, 4, 5, 6].forEach(function (width) {
    ['rippleCarry', 'carryLookahead'].forEach(function (name) {
      const circuit = families[name](width);

      assert.ok(Circuits.computes(circuit, 2 * width, references.carry(width)),
        name + ' is wrong at width ' + width);
    });
  });
});

test('the size and depth figures the section quotes', function () {
  const rows = [2, 4, 6, 8].map(function (width) {
    const ripple = Circuits.rippleCarry(width);
    const lookahead = Circuits.carryLookahead(width);

    return { width: width, rippleSize: Circuits.size(ripple),
      rippleDepth: Circuits.depth(ripple), lookaheadSize: Circuits.size(lookahead),
      lookaheadDepth: Circuits.depth(lookahead) };
  });

  assert.deepEqual(rows.map(function (r) { return r.rippleSize; }), [5, 13, 21, 29]);
  assert.deepEqual(rows.map(function (r) { return r.rippleDepth; }), [3, 7, 11, 15]);
  assert.deepEqual(rows.map(function (r) { return r.lookaheadSize; }), [6, 15, 28, 45]);
  assert.deepEqual(rows.map(function (r) { return r.lookaheadDepth; }), [3, 3, 3, 3],
    'lookahead depth is constant in the width — that is the whole trade');
});

test('a tree and a chain have the same size and different depth', function () {
  [2, 4, 8, 16].forEach(function (n) {
    const chain = Circuits.orChain(n);
    const tree = Circuits.orTree(n);
    const flat = Circuits.orFlat(n);

    assert.equal(Circuits.size(chain), n - 1, 'an OR over n bits needs n − 1 two-input gates');
    assert.equal(Circuits.size(tree), n - 1, 'and the tree needs the same');
    assert.equal(Circuits.depth(chain), n - 1, 'the chain is linear');
    assert.equal(Circuits.depth(tree), Math.ceil(Math.log2(n)), 'the tree is logarithmic');
    assert.equal(Circuits.size(flat), 1, 'unbounded fan-in needs one gate');
    assert.equal(Circuits.depth(flat), 1, 'at depth 1, which is what AC⁰ buys');
  });
});

test('PARITY and OR are indistinguishable with bounded fan-in', function () {
  [2, 4, 8, 16].forEach(function (n) {
    assert.equal(Circuits.size(Circuits.parityChain(n)), Circuits.size(Circuits.orChain(n)));
    assert.equal(Circuits.depth(Circuits.parityChain(n)), Circuits.depth(Circuits.orChain(n)));
    assert.equal(Circuits.size(Circuits.parityTree(n)), Circuits.size(Circuits.orTree(n)));
    assert.equal(Circuits.depth(Circuits.parityTree(n)), Circuits.depth(Circuits.orTree(n)));
  });
});

test('the layer view groups gates that can fire together', function () {
  const layers = Circuits.layers(Circuits.orTree(8));

  assert.deepEqual(layers.map(function (level) { return level.length; }), [8, 4, 2, 1],
    'eight inputs, then four gates, then two, then one');
  assert.equal(layers.length - 1, Circuits.depth(Circuits.orTree(8)),
    'the number of gate levels is the depth');
});

/* --------------------------------------------------------- Kolmogorov */

test('the counting bound holds at every size, checked exhaustively', function () {
  [[10, 1], [10, 2], [12, 1], [12, 2], [12, 3], [14, 2]].forEach(function (pair) {
    const outcome = Kolmogorov.verifyBound(pair[0], pair[1]);

    assert.equal(outcome.total, Math.pow(2, pair[0]));
    assert.equal(outcome.bound, Math.pow(2, pair[0] - pair[1]) - 1);
    assert.ok(outcome.withinBound,
      'at n = ' + pair[0] + ', k = ' + pair[1] + ': ' + outcome.compressed +
        ' strings compressed against a bound of ' + outcome.bound);
    assert.ok(outcome.headroom > 0, 'real codecs never saturate the ceiling');
  });
});

test('no string is ever described in more bits than it has', function () {
  for (let n = 4; n <= 12; n += 2) {
    for (let mask = 0; mask < Math.pow(2, n); mask += 1) {
      const bits = mask.toString(2).padStart(n, '0');
      const outcome = Kolmogorov.upperBound(bits);

      assert.ok(outcome.best <= n,
        'the literal encoding is always available, so "' + bits + '" cannot cost ' +
          outcome.best + ' bits');
    }
  }
});

test('over 99 per cent of strings resist every codec', function () {
  [8, 10, 12, 14].forEach(function (n) {
    const outcome = Kolmogorov.incompressibleFraction(n);

    assert.ok(outcome.fraction > 0.99,
      'at n = ' + n + ' only ' + (outcome.fraction * 100).toFixed(1) + '% resisted');
    assert.ok(outcome.fraction < 1,
      'and some do compress — all zeros and the alternating string at least');
  });
});

test('the samples measure where a reader would predict, and one deliberately does not',
  function () {
    const samples = Kolmogorov.samples(32);
    const byName = {};

    samples.forEach(function (sample) {
      byName[sample.name] = Kolmogorov.upperBound(sample.bits);
    });
    assert.equal(byName['all zeros'].best, 9);
    assert.equal(byName['all zeros'].codec, 'periodic');
    assert.equal(byName.alternating.best, 10);
    assert.equal(byName['the perfect squares'].best, 32,
      'a one-line rule that no codec here finds — the whole point of the section');
    assert.equal(byName['the perfect squares'].codec, 'literal');
    assert.equal(byName['a fixed pseudo-random string'].best, 32);
  });

/* ------------------------------------------------------------- quantum */

test('every Grover amplitude matches the closed form', function () {
  [2, 3, 4, 5, 6].forEach(function (n) {
    const size = Math.pow(2, n);
    const outcome = QuantumSim.grover(n, 3 % size, Math.ceil(Math.sqrt(size)) + 3);

    outcome.rows.forEach(function (row) {
      assert.ok(row.error < 1e-12,
        'n = ' + n + ', k = ' + row.iteration + ': measured ' + row.measured +
          ' against a predicted ' + row.predicted);
      assert.ok(Math.abs(row.norm - 1) < 1e-12,
        'the total probability must stay at 1, got ' + row.norm);
    });
  });
});

test('the peak is at the predicted iteration, and the over-rotation is real', function () {
  const expectations = { 2: 1, 3: 2, 4: 3, 5: 4, 6: 6 };

  Object.keys(expectations).forEach(function (key) {
    const n = Number(key);
    const size = Math.pow(2, n);
    const outcome = QuantumSim.grover(n, 3 % size, expectations[key] + 3);

    assert.equal(outcome.optimal, expectations[key],
      'round(pi/4 * sqrt(' + size + ') - 0.5) is ' + expectations[key]);
    const atOptimal = outcome.rows[expectations[key]];

    assert.ok(atOptimal.measured > 0.9,
      'at n = ' + n + ' the marked probability at the optimum is ' + atOptimal.measured);
    assert.ok(outcome.rows[0].measured < 0.3,
      'and it started at 1/N');
    if (expectations[key] + 2 < outcome.rows.length) {
      assert.ok(outcome.rows[expectations[key] + 2].measured < atOptimal.measured,
        'two past the optimum it must FALL — Grover is a rotation');
    }
  });
});

test('Deutsch–Jozsa is exact rather than probabilistic', function () {
  [2, 3, 4].forEach(function (n) {
    [0, 1].forEach(function (value) {
      const outcome = QuantumSim.deutschJozsa(n, QuantumSim.constantOracle(value));

      assert.ok(Math.abs(outcome.zeroProbability - 1) < 1e-12,
        'a constant oracle must leave all the amplitude on the zero state');
      assert.equal(outcome.verdict, 'constant');
    });
    const balanced = QuantumSim.deutschJozsa(n, QuantumSim.balancedOracle());

    assert.ok(Math.abs(balanced.zeroProbability) < 1e-12,
      'a balanced oracle must leave none of it there');
    assert.equal(balanced.verdict, 'balanced');
    assert.equal(balanced.queries, 1);
    assert.equal(balanced.classicalWorstCase, Math.pow(2, n - 1) + 1);
  });
});

test('the entangling circuits produce the distributions they claim', function () {
  const bell = QuantumSim.runCircuit(2, QuantumSim.bell());

  assert.ok(Math.abs(bell.probabilities[0] - 0.5) < 1e-12);
  assert.ok(Math.abs(bell.probabilities[3] - 0.5) < 1e-12);
  assert.ok(bell.probabilities[1] < 1e-12 && bell.probabilities[2] < 1e-12,
    'a Bell pair puts no amplitude on the disagreeing outcomes');

  const ghz = QuantumSim.runCircuit(3, QuantumSim.ghz());

  assert.ok(Math.abs(ghz.probabilities[0] - 0.5) < 1e-12);
  assert.ok(Math.abs(ghz.probabilities[7] - 0.5) < 1e-12);
  for (let i = 1; i < 7; i += 1) {
    assert.ok(ghz.probabilities[i] < 1e-12, 'GHZ leaves nothing on outcome ' + i);
  }

  const identity = QuantumSim.runCircuit(1, QuantumSim.selfInverse());

  assert.ok(Math.abs(identity.probabilities[0] - 1) < 1e-12,
    'two Hadamards are the identity, which is reversibility in its smallest form');
});

/* ---------------------------------------------------------------- atlas */

test('the atlas keeps its four columns separate and complete', function () {
  const rows = ComplexityAtlas.all();

  assert.equal(rows.length, 15);
  rows.forEach(function (row) {
    assert.ok(row.classes.length > 0, row.problem + ': no class');
    assert.ok(row.best.length > 5, row.problem + ': no best known algorithm');
    assert.ok(row.lower.length > 5, row.problem + ': no lower bound entry');
    assert.ok(row.open.length > 3, row.problem + ': nothing said about what is open');
    assert.ok(typeof row.unconditional === 'boolean', row.problem + ': no unconditional flag');
  });
  assert.equal(ComplexityAtlas.unconditional().length, 8);
});

test('class lookup matches exactly, so a negation is not read as a membership', function () {
  const npComplete = ComplexityAtlas.byClass('NP-complete').map(function (row) {
    return row.problem;
  });

  assert.ok(npComplete.indexOf('Boolean satisfiability (SAT)') !== -1);
  assert.ok(npComplete.indexOf('Graph isomorphism') === -1,
    'graph isomorphism carries "not known to be NP-complete" and must not be listed under it');
  assert.equal(ComplexityAtlas.byClass('BQP').length, 2);
});

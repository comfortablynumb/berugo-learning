'use strict';

/**
 * Property tests for the applied half of M24: the lexer, the ReDoS analyser,
 * transducers, HMM decoding and Büchi emptiness.
 *
 * Each one has a reference that shares nothing with the implementation under
 * test: composition is checked against chaining, Viterbi against enumeration of
 * every path, the analyser against a fixture list of known verdicts, and the
 * lasso against replaying it through the machine.
 */

const test = require('node:test');
const assert = require('node:assert');

const Transducer = require('../../src/js/algorithms/transducer.js');
const LexerGen = require('../../src/js/algorithms/lexer-gen.js');
const Redos = require('../../src/js/algorithms/redos-analysis.js');
const Hmm = require('../../src/js/algorithms/hmm.js');
const Buchi = require('../../src/js/algorithms/buchi.js');
const Random = require('../../src/js/utils/random.js');

/* --------------------------------------------------------------- the lexer */

test('lexer-gen: maximal munch takes the longest match, not the first', function () {
  const scanner = LexerGen.build(LexerGen.sampleRules());
  const cases = [
    { source: 'if x >>= 12', tokens: ['if', 'identifier', 'shift-assign', 'number'] },
    { source: 'int intx = 2', tokens: ['int', 'identifier', 'assign', 'number'] },
    { source: 'x >> y', tokens: ['identifier', 'shift', 'identifier'] },
    { source: 'a >= b', tokens: ['identifier', 'ge', 'identifier'] },
    { source: 'if in int', tokens: ['if', 'in', 'int'] },
    { source: 'xy012 >>>', tokens: ['identifier', 'shift', 'gt'] }
  ];

  cases.forEach(function (entry) {
    const result = LexerGen.scan(scanner, entry.source);

    assert.strictEqual(result.ok, true, entry.source + ' failed at ' + result.errorAt);
    assert.deepStrictEqual(result.tokens.map(function (t) { return t.type; }), entry.tokens,
      'tokenising "' + entry.source + '"');
  });
});

test('lexer-gen: priority makes keywords beat identifiers at equal length', function () {
  const scanner = LexerGen.build(LexerGen.sampleRules());
  const rows = LexerGen.shadowing(scanner, ['if', 'in', 'int', 'intx', 'x', '>>', '>>=']);
  const shadowed = rows.filter(function (row) { return row.shadowed; });

  assert.strictEqual(shadowed.length, 3, 'exactly the three keywords are shadowed');
  shadowed.forEach(function (row) {
    assert.ok(row.matchedBy.indexOf('identifier') !== -1,
      row.text + ' is also a legal identifier');
    assert.notStrictEqual(row.chosen, 'identifier',
      'and the keyword wins because it is declared first');
  });
  assert.strictEqual(rows.filter(function (row) { return row.text === 'intx'; })[0].chosen,
    'identifier', 'a longer identifier beats a keyword — maximal munch first');
});

test('lexer-gen: every decision records the shorter matches it passed over', function () {
  const scanner = LexerGen.build(LexerGen.sampleRules());
  const result = LexerGen.scan(scanner, 'if x >>= 12');
  const operator = result.decisions.filter(function (d) {
    return d.chosen === 'shift-assign';
  })[0];

  assert.ok(operator, 'the operator must have been chosen');
  assert.strictEqual(operator.text, '>>=');
  assert.deepStrictEqual(operator.attempts.map(function (a) { return a.rule; }),
    ['gt', 'shift', 'shift-assign'],
    'the two shorter matches must be recorded, in increasing length');
});

/* ------------------------------------------------------------------ ReDoS */

test('redos-analysis: every fixture verdict is correct', function () {
  const rows = Redos.samples();

  assert.strictEqual(rows.length, 9, 'nine fixtures, five dangerous and four safe');
  rows.forEach(function (entry) {
    const report = Redos.ambiguity(entry.pattern);

    assert.strictEqual(report.vulnerable, entry.expected,
      entry.pattern + ' (' + entry.label + '): expected ' + entry.expected);
  });
});

test('redos-analysis: the two rules catch different shapes', function () {
  const nesting = Redos.ambiguity('(a*)*b');
  const overlap = Redos.ambiguity('(aa|a)*b');

  assert.strictEqual(nesting.findings[0].kind, 'nesting',
    '(a*)* has the same position automaton as a*, so only the tree separates them');
  assert.ok(overlap.findings.some(function (f) { return f.kind === 'overlap'; }),
    '(aa|a)* needs the position automaton, because its shape looks innocent');
  assert.strictEqual(Redos.ambiguity('a*b').vulnerable, false,
    'and the safe rewrite is flagged by neither');
});

test('redos-analysis: the flagged patterns really do blow up', function () {
  const rows = Redos.blowUp('(a+)+b', [4, 8, 12, 16]);

  assert.strictEqual(rows[0].backtrack, 99);
  assert.strictEqual(rows[0].simulation, 28);
  assert.strictEqual(rows[3].backtrack, 425979);
  assert.strictEqual(rows[3].simulation, 100);
  for (let i = 1; i < rows.length; i += 1) {
    assert.ok(rows[i].ratio > rows[i - 1].ratio * 5,
      'the ratio must grow by at least a factor of five per step: ' +
      rows.map(function (r) { return r.ratio.toFixed(1); }).join(', '));
    assert.ok(rows[i].simulation - rows[i - 1].simulation <= 30,
      'while the simulation grows linearly');
  }
  assert.strictEqual(rows[3].matched, false,
    'the attack string must NOT match, or the matcher stops at the first success');
});

test('redos-analysis: a safe pattern produces no attack string', function () {
  const report = Redos.ambiguity('(ab)*c');

  assert.strictEqual(report.vulnerable, false);
  assert.strictEqual(Redos.attackString(report, 8), null,
    'there is nothing to pump, so there is no attack');
});

/* ------------------------------------------------------------ transducers */

test('transducer: composition equals chaining on every input tested', function () {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz .'.split('');
  const lower = alphabet.map(function (c) { return c.toLowerCase(); })
    .filter(function (c, i, all) { return all.indexOf(c) === i; });
  const fold = Transducer.caseFolder(alphabet);
  const collapse = Transducer.spaceCollapser(lower);
  const composed = Transducer.compose(fold, collapse);
  const rng = Random.seeded(11);
  const cases = ['Hello   World .', 'A  B   C', '   spaced   out   ', 'NoChangeHere'];

  for (let i = 0; i < 200; i += 1) {
    let word = '';

    for (let j = 0; j < 24; j += 1) {
      word += alphabet[Math.floor(rng.next() * alphabet.length)];
    }
    cases.push(word);
  }
  cases.forEach(function (text) {
    const chained = Transducer.run(collapse, Transducer.run(fold, text).output).output;

    assert.strictEqual(Transducer.run(composed, text).output, chained,
      'composed and chained disagree on "' + text + '"');
  });
  assert.strictEqual(composed.states.length, 2, 'only reachable pairs are built');
});

test('transducer: composition handles many-symbol and empty outputs', function () {
  const doubler = Transducer.mealy({ states: ['d'], alphabet: ['x', 'y'], start: 'd',
    delta: { d: { x: { to: 'd', out: 'xx' }, y: { to: 'd', out: 'yy' } } } });
  const dropper = Transducer.mealy({ states: ['keep', 'drop'], alphabet: ['x', 'y'],
    start: 'keep',
    delta: {
      keep: { x: { to: 'drop', out: 'x' }, y: { to: 'drop', out: 'y' } },
      drop: { x: { to: 'keep', out: '' }, y: { to: 'keep', out: '' } }
    } });
  const composed = Transducer.compose(doubler, dropper);

  ['x', 'xy', 'yyxx', 'xyxyxy'].forEach(function (input) {
    assert.strictEqual(Transducer.run(composed, input).output, input,
      'doubling then dropping every second symbol is the identity on "' + input + '"');
  });
});

test('transducer: Moore form is larger and computes the same function', function () {
  const alphabet = 'ABCabc .'.split('');
  const fold = Transducer.caseFolder(alphabet);
  const moore = Transducer.toMoore(fold);

  assert.strictEqual(fold.states.length, 1, 'one Mealy state');
  assert.ok(moore.states.length > 1, 'and more than one Moore state');
  ['AbC', 'abc', 'A B C', '...'].forEach(function (input) {
    assert.strictEqual(Transducer.run(moore, input).output,
      Transducer.run(fold, input).output, 'the two forms must agree on "' + input + '"');
  });
});

/* --------------------------------------------------------------- decoding */

test('hmm: Viterbi matches brute force on every small sequence', function () {
  const model = Hmm.weather();
  const symbols = model.symbols;
  const sequences = [];

  symbols.forEach(function (a) {
    sequences.push([a]);
    symbols.forEach(function (b) {
      sequences.push([a, b]);
      symbols.forEach(function (c) { sequences.push([a, b, c]); });
    });
  });
  sequences.forEach(function (observations) {
    const found = Hmm.viterbi(model, observations);
    const brute = Hmm.bruteForce(model, observations);

    assert.ok(Math.abs(found.logProbability - brute.logProbability) < 1e-12,
      observations.join(',') + ': score ' + found.logProbability + ' against ' +
      brute.logProbability);
    assert.deepStrictEqual(found.path, brute.path,
      observations.join(',') + ': the paths differ');
  });
  assert.ok(sequences.length > 35, 'every sequence up to length three must be checked');
});

test('hmm: the forward probability is at least the best path, and sums to it over one path', function () {
  const model = Hmm.weather();
  const observations = ['walk', 'shop', 'clean'];
  const forward = Hmm.forward(model, observations);
  const best = Hmm.viterbi(model, observations);

  assert.ok(forward.logProbability > best.logProbability,
    'summing over every path must exceed the single best one');
  assert.ok(Math.exp(forward.logProbability) < 1, 'and it is still a probability');

  const enumerated = Hmm.enumerate(model.states, observations.length)
    .reduce(function (total, path) {
      return total + Math.exp(Hmm.scorePath(model, path, observations));
    }, 0);

  assert.ok(Math.abs(Math.exp(forward.logProbability) - enumerated) < 1e-12,
    'the forward algorithm must equal the sum over all enumerated paths');
});

test('hmm: the log domain survives where plain probabilities do not', function () {
  const model = Hmm.weather();

  assert.strictEqual(Hmm.underflowDepth(model, 'clean', 2000), 619);
  assert.strictEqual(Hmm.underflowDepth(model, 'shop', 2000), 522);
  assert.strictEqual(Hmm.underflowDepth(model, 'walk', 2000), null,
    'the highest-probability emission does not underflow within the budget');

  const long = new Array(1000).fill('clean');

  assert.strictEqual(Hmm.naiveViterbi(model, long).probability, 0,
    'plain probabilities reach exactly zero');
  assert.ok(isFinite(Hmm.viterbi(model, long).logProbability),
    'and the log domain does not');
  assert.strictEqual(Hmm.viterbi(model, long).path.length, 1000, 'one state per observation');
});

test('hmm: the posterior is a distribution and may differ from the best path', function () {
  const model = Hmm.weather();
  const observations = ['walk', 'shop', 'clean'];
  const posterior = Hmm.posterior(model, observations);

  posterior.forEach(function (row, t) {
    const total = model.states.reduce(function (sum, state) { return sum + row[state]; }, 0);

    assert.ok(Math.abs(total - 1) < 1e-9,
      'position ' + t + ' must sum to one, got ' + total);
  });
  assert.ok(posterior[0].sunny > posterior[0].rainy,
    'walking is better explained by sunny weather');
  assert.ok(posterior[2].rainy > posterior[2].sunny,
    'and cleaning by rain');
});

/* ------------------------------------------------------------------ Büchi */

test('buchi: safety and liveness split exactly as the section claims', function () {
  const expectations = [
    { starve: false, safety: true, liveness: true },
    { starve: true, safety: true, liveness: false }
  ];

  expectations.forEach(function (row) {
    const system = Buchi.server(row.starve);
    const safety = Buchi.emptiness(Buchi.product(system, Buchi.safetyViolation()));
    const liveness = Buchi.emptiness(
      Buchi.product(system, Buchi.eventuallyGrantedViolation()));

    assert.strictEqual(safety.empty, row.safety,
      'starve=' + row.starve + ': safety should ' + (row.safety ? 'hold' : 'fail'));
    assert.strictEqual(liveness.empty, row.liveness,
      'starve=' + row.starve + ': liveness should ' + (row.liveness ? 'hold' : 'fail'));
  });
});

test('buchi: a rogue system fails safety with a finite prefix', function () {
  const delta = { q: {} };

  Buchi.SYMBOLS.forEach(function (symbol) { delta.q[symbol] = ['q']; });
  const rogue = Buchi.create({ states: ['q'], alphabet: Buchi.SYMBOLS, start: 'q',
    accepting: ['q'], delta: delta, label: 'rogue' });
  const result = Buchi.emptiness(Buchi.product(rogue, Buchi.safetyViolation()));

  assert.strictEqual(result.empty, false, 'granting without a request breaks safety');
  assert.ok(result.trace.stem.length <= 2,
    'and the bad prefix is short — a finite test would find it');
});

test('buchi: every reported counter-example is accepted when replayed', function () {
  [false, true].forEach(function (starve) {
    [Buchi.safetyViolation(), Buchi.eventuallyGrantedViolation()].forEach(function (monitor) {
      const product = Buchi.product(Buchi.server(starve), monitor);
      const result = Buchi.emptiness(product);

      if (result.empty) {
        assert.strictEqual(result.trace, null, 'an empty language has no trace');
        return;
      }
      assert.strictEqual(Buchi.accepts(product, result.trace), true,
        'the lasso ' + result.trace.show + ' must be accepted by the machine that produced it');
      assert.ok(result.trace.cycle.length > 0, 'and its cycle must be non-empty');
    });
  });
});

test('buchi: reachability is not enough — the accepting state must be on a cycle', function () {
  const deadEnd = Buchi.create({ states: ['q0', 'q1'], alphabet: ['a'], start: 'q0',
    accepting: ['q1'], delta: { q0: { a: ['q1'] }, q1: {} }, label: 'dead end' });

  assert.strictEqual(Buchi.emptiness(deadEnd).empty, true,
    'an accepting state with no outgoing edge cannot be visited infinitely often');

  const looping = Buchi.create({ states: ['q0', 'q1'], alphabet: ['a'], start: 'q0',
    accepting: ['q1'], delta: { q0: { a: ['q1'] }, q1: { a: ['q1'] } }, label: 'loop' });

  assert.strictEqual(Buchi.emptiness(looping).empty, false, 'and one that loops can');
});

test('buchi: unrolling a lasso repeats the cycle forever', function () {
  const trace = Buchi.lasso(['req'], ['', 'grant']);
  const unrolled = Buchi.unroll(trace, 7);

  assert.deepStrictEqual(unrolled, ['req', '', 'grant', '', 'grant', '', 'grant']);
  assert.strictEqual(Buchi.unroll(trace, 1).length, 1, 'a shorter window is truncated');
});

'use strict';

/**
 * Every figure the M24 content quotes, recomputed from the modules and then
 * checked against the prose.
 *
 * The section controllers are not imported; the calls below reproduce what they
 * make at their default control settings, which is the contract this suite is
 * really pinning down — if a default moves, the prose is wrong and this fails.
 */

const test = require('node:test');
const assert = require('node:assert');

const Automaton = require('../../src/js/machines/automaton.js');
const Regex = require('../../src/js/algorithms/regex-compile.js');
const Derivatives = require('../../src/js/algorithms/derivatives.js');
const Minimization = require('../../src/js/algorithms/minimization.js');
const Ops = require('../../src/js/algorithms/automaton-ops.js');
const LanguageLab = require('../../src/js/machines/language-lab.js');
const Transducer = require('../../src/js/algorithms/transducer.js');
const LexerGen = require('../../src/js/algorithms/lexer-gen.js');
const Redos = require('../../src/js/algorithms/redos-analysis.js');
const Hmm = require('../../src/js/algorithms/hmm.js');
const Buchi = require('../../src/js/algorithms/buchi.js');

require('../../src/js/content/concepts-automata-basics.js');
require('../../src/js/content/examples-automata-basics.js');
require('../../src/js/content/concepts-automata-structure.js');
require('../../src/js/content/examples-automata-structure.js');
require('../../src/js/content/concepts-automata-applied.js');
require('../../src/js/content/examples-automata-applied.js');
const prose = require('../support/worked-example-prose.js');

const ALPHABET = ['a', 'b'];

function thompson(pattern) {
  return Regex.thompson(pattern, ALPHABET);
}

function minimalFor(pattern) {
  return Automaton.relabel(
    Minimization.hopcroft(Automaton.toDfa(thompson(pattern)).dfa).minimal).machine;
}

/* --------------------------------------------------------- 24.1 hierarchy */

test('languages-and-the-hierarchy: the catalogue figures', function () {
  const endsAbb = LanguageLab.study('ends-abb', 6);

  assert.strictEqual(endsAbb.tested, 127);
  assert.strictEqual(endsAbb.accepted.length, 15);
  assert.strictEqual(endsAbb.machineAgrees.states, 4);
  assert.strictEqual(endsAbb.machineAgrees.disagreements, 0);

  const anbn = LanguageLab.study('anbn', 6);

  assert.strictEqual(anbn.accepted.length, 4);
  assert.deepStrictEqual(anbn.accepted, ['', 'ab', 'aabb', 'aaabbb']);
  assert.strictEqual(Minimization.hopcroft(Automaton.toDfa(thompson('a*b*')).dfa).after, 3);

  prose.quotes('languages-and-the-hierarchy',
    ['15 of 127', '4 of 127', '127 strings', '4 states', 'a*b* is regular with 3 states',
      'ε, ab, aabb, aaabbb']);
});

test('languages-and-the-hierarchy: the catalogue covers the whole hierarchy', function () {
  const rows = LanguageLab.catalogue();
  const classes = {};

  rows.forEach(function (row) { classes[row.klass] = (classes[row.klass] || 0) + 1; });
  assert.strictEqual(rows.length, 8, 'eight languages');
  assert.strictEqual(classes.regular, 3);
  assert.strictEqual(classes['context-free'], 2);
  assert.strictEqual(classes['context-sensitive'], 2);
  assert.strictEqual(classes.undecidable, 1);
  assert.strictEqual(LanguageLab.study('halting', 6).tested, 0,
    'the undecidable row has no recogniser to run');
  assert.strictEqual(LanguageLab.study('anbncn', 6).tested, 1093,
    'a three-symbol alphabet gives more strings at the same bound');

  prose.quotes('languages-and-the-hierarchy',
    ['eight languages', '2-state automaton', '0 strings for the halting row']);
});

/* --------------------------------------------------------------- 24.2 DFA */

test('deterministic-finite-automata: divisibility built from arithmetic', function () {
  const build = function (k) {
    const delta = {};
    const states = [];

    for (let r = 0; r < k; r += 1) {
      states.push('r' + r);
      delta['r' + r] = { 0: ['r' + ((2 * r) % k)], 1: ['r' + ((2 * r + 1) % k)] };
    }
    return Automaton.create({ states: states, alphabet: ['0', '1'], start: 'r0',
      accepting: ['r0'], delta: delta });
  };
  const value = function (word) {
    let out = 0;

    word.split('').forEach(function (bit) { out = out * 2 + Number(bit); });
    return out;
  };

  [3, 7].forEach(function (k) {
    const machine = build(k);
    const words = Automaton.strings(['0', '1'], 8);
    let agree = 0;

    words.forEach(function (word) {
      if (Automaton.accepts(machine, word) === (value(word) % k === 0)) agree += 1;
    });
    assert.strictEqual(words.length, 511, 'every binary string up to length 8');
    assert.strictEqual(agree, 511, 'k = ' + k + ' must agree with arithmetic everywhere');
    assert.strictEqual(machine.states.length, k);
    assert.strictEqual(Minimization.isMinimal(machine, 5).classes, k);
  });

  prose.quotes('deterministic-finite-automata',
    ['511 strings tested, 511 agreements', '7 states, r0 through r6',
      '7 Myhill–Nerode classes', 'r → (2r + b) mod 7']);
});

test('deterministic-finite-automata: the non-minimal machine and its classes', function () {
  const nfa = thompson('(a|b)*abb');
  const dfa = Automaton.toDfa(nfa).dfa;

  assert.strictEqual(nfa.states.length, 14);
  assert.strictEqual(dfa.states.length, 5);
  assert.strictEqual(Minimization.hopcroft(dfa).after, 4);
  assert.strictEqual(Automaton.agree(dfa, Minimization.hopcroft(dfa).minimal, 8).tested, 511);

  prose.quotes('deterministic-finite-automata',
    ['Thompson gives 14 states, the subset construction gives 5', '4 classes',
      '511 strings up to length 8', 'both are 4 states']);
});

/* ----------------------------------------------------- 24.3 determinisation */

test('nondeterminism-and-subsets: the construction figures', function () {
  const nfa = thompson('(a|b)*abb');
  const built = Automaton.toDfa(nfa);

  assert.strictEqual(nfa.states.length, 14);
  assert.strictEqual(built.dfa.states.length, 5);
  assert.strictEqual(built.steps.length, 10);
  assert.strictEqual(Minimization.hopcroft(built.dfa).after, 4);

  const check = Automaton.agree(nfa, built.dfa, 9);

  assert.strictEqual(check.equivalent, true);
  assert.strictEqual(check.tested, 1023);

  prose.quotes('nondeterminism-and-subsets',
    ['14 states', '5 DFA states from 10 computed transitions', '1 023 strings',
      '5 states become 4']);
});

test('nondeterminism-and-subsets: the exponential family, measured', function () {
  const rows = LanguageLab.blowUp(7);

  assert.deepStrictEqual(rows.map(function (r) { return r.minimalStates; }),
    [4, 8, 16, 32, 64, 128, 256]);
  assert.deepStrictEqual(rows.map(function (r) { return r.dfaStates; }),
    [5, 9, 17, 33, 65, 129, 257]);
  assert.strictEqual(rows[0].positions, 6);
  assert.strictEqual(rows[6].positions, 18);

  prose.quotes('nondeterminism-and-subsets',
    ['4, 8, 16, 32, 64, 128, 256', '5, 9, 17, 33, 65, 129, 257',
      'n = 1 gives 6 positions; n = 7 gives 18', '256 states']);
});

/* ---------------------------------------------------- 24.4 constructions */

test('regular-expressions-and-constructions: three state counts and the round trip', function () {
  const pattern = '(a|b)*abb';
  const thompsonMachine = thompson(pattern);
  const glushkov = Regex.glushkov(pattern, ALPHABET);
  const derived = Derivatives.build(pattern, ALPHABET);
  const minimal = minimalFor(pattern);

  assert.strictEqual(thompsonMachine.states.length, 14);
  assert.strictEqual(glushkov.states.length, 6);
  assert.strictEqual(derived.dfa.states.length, 4);
  assert.strictEqual(minimal.states.length, 4);
  assert.strictEqual(prose.fixed(14 / 6, 2), '2.33');
  assert.strictEqual(Automaton.agree(thompsonMachine, glushkov, 8).tested, 511);

  prose.quotes('regular-expressions-and-constructions',
    ['14 states', '6 states — 2.33× smaller', '4 states', '511 strings']);
});

test('regular-expressions-and-constructions: elimination order changes the length', function () {
  const minimal = minimalFor('(a|b)*abb');
  const forward = Regex.toRegex(minimal, minimal.states.slice());
  const reverse = Regex.toRegex(minimal, minimal.states.slice().reverse());

  assert.strictEqual(forward.pattern.length, 40);
  assert.strictEqual(reverse.pattern.length, 44);
  assert.strictEqual(minimal.states.length, 4);
  [forward, reverse].forEach(function (result) {
    assert.strictEqual(
      Automaton.agree(minimal, Regex.thompson(result.pattern, ALPHABET), 7).equivalent, true);
  });
  assert.strictEqual(Automaton.strings(ALPHABET, 7).length, 255);

  prose.quotes('regular-expressions-and-constructions',
    ['40 characters', '44 characters', '255 strings up to length 7',
      '4 interior states to eliminate']);
});

/* --------------------------------------------------------- 24.5 minimising */

test('minimisation-and-canonical-forms: the four agreeing numbers', function () {
  const dfa = Automaton.relabel(Automaton.toDfa(thompson('(a|b)*abb')).dfa).machine;
  const moore = Minimization.moore(dfa);
  const hopcroft = Minimization.hopcroft(dfa);
  const brzozowski = Minimization.brzozowski(dfa);
  const oracle = Minimization.myhillNerode(Automaton.complete(Automaton.trim(dfa)), 5);

  assert.strictEqual(dfa.states.length, 5);
  assert.strictEqual(moore.after, 4);
  assert.strictEqual(hopcroft.after, 4);
  assert.strictEqual(brzozowski.after, 4);
  assert.strictEqual(oracle.count, 4);
  assert.deepStrictEqual(moore.rounds.map(function (r) { return r.blocks.length; }),
    [2, 3, 4, 4]);

  prose.quotes('minimisation-and-canonical-forms',
    ['round 0: 2 blocks', 'round 1: 3 blocks', 'round 3: still 4 blocks', '4 classes',
      'both return 4 states']);
});

test('minimisation-and-canonical-forms: the total-against-trimmed off-by-one', function () {
  const dfa = Automaton.toDfa(thompson('a*b*')).dfa;
  const total = Minimization.hopcroft(dfa);
  const trimmed = Automaton.trim(total.minimal);
  const oracle = Minimization.myhillNerode(Automaton.complete(Automaton.trim(dfa)), 5);

  assert.strictEqual(dfa.states.length, 4);
  assert.strictEqual(total.after, 3);
  assert.strictEqual(trimmed.states.length, 2);
  assert.strictEqual(oracle.count, 3);

  const noDead = Minimization.hopcroft(Automaton.toDfa(thompson('(a|b)*abb')).dfa);

  assert.strictEqual(noDead.after, 4);
  assert.strictEqual(Automaton.trim(noDead.minimal).states.length, 4,
    '(a|b)*abb has no dead prefix, so both conventions agree');

  prose.quotes('minimisation-and-canonical-forms',
    ['3 states: seen only a', '2 states for the same language', '3 classes',
      '2 states against 3 classes', 'both conventions give 4']);
});

/* ----------------------------------------------------------- 24.6 closure */

test('closure-and-the-product: containment, equivalence and the witness', function () {
  const first = minimalFor('(a|b)*abb');
  const second = minimalFor('(a|b)*b');
  const product = Ops.product(first, second, 'intersection');

  assert.strictEqual(product.machine.states.length, 5);
  assert.strictEqual(first.states.length * second.states.length, 8);
  assert.strictEqual(Ops.shortestWord(product.machine), 'abb');
  assert.strictEqual(Ops.contains(first, second).contained, true);
  assert.strictEqual(Ops.contains(second, first).contained, false);

  const equivalence = Ops.equivalent(first, second);

  assert.strictEqual(equivalence.equivalent, false);
  assert.strictEqual(equivalence.counterExample, 'b');
  assert.strictEqual(Automaton.accepts(second, 'b'), true);
  assert.strictEqual(Automaton.accepts(first, 'b'), false);

  prose.quotes('closure-and-the-product',
    ['5 reachable pairs out of a possible 8', '"abb", 3 characters', '"b"',
      'B has 2 states']);
});

test('closure-and-the-product: four operations, one graph', function () {
  const first = minimalFor('(a|b)*abb');
  const second = minimalFor('(a|b)*b');
  const results = ['intersection', 'union', 'difference', 'symmetric'].map(function (op) {
    const built = Ops.product(first, second, op);

    return { op: op, states: built.machine.states.length,
      shortest: Ops.shortestWord(built.machine) };
  });

  results.forEach(function (row) {
    assert.strictEqual(row.states, 5, row.op + ' must build the same graph');
  });
  assert.strictEqual(results[0].shortest, 'abb');
  assert.strictEqual(results[1].shortest, 'b');
  assert.strictEqual(results[2].shortest, null);
  assert.strictEqual(results[3].shortest, 'b');

  prose.quotes('closure-and-the-product',
    ['5 pairs, identical for all four operations', 'shortest word "b", 1 character',
      'Four operations, 5 states each']);
});

/* ------------------------------------------------------- 24.7 the proofs */

test('proving-non-regularity: the pumping round and the family', function () {
  const round = LanguageLab.pumpingRound({ word: 'aaaabbbb', pumpingLength: 4,
    accepts: LanguageLab.entry('anbn').accepts, maxExponent: 3 });

  assert.strictEqual(round.splits.length, 10);
  assert.strictEqual(round.survivors.length, 0);
  assert.strictEqual(round.everySplitLoses, true);
  assert.strictEqual(round.word.length, 8);

  const family = LanguageLab.anbnFamily(6);

  assert.strictEqual(family.prefixes.length, 6);
  assert.strictEqual(family.pairs.length, 15);
  assert.strictEqual(family.allDistinguished, true);

  prose.quotes('proving-non-regularity',
    ['10 decompositions', 'w = aaaabbbb, length 8', '0 of 10',
      '6 prefixes', '15 pairs']);
});

test('proving-non-regularity: the regular control declines both tools', function () {
  const round = LanguageLab.pumpingRound({ word: 'a'.repeat(8), pumpingLength: 4,
    accepts: LanguageLab.entry('even-a').accepts, maxExponent: 3 });

  assert.strictEqual(round.splits.length, 10);
  assert.strictEqual(round.survivors.length, 4);
  assert.strictEqual(round.everySplitLoses, false);

  const prefixes = ['a', 'aa', 'aaa', 'aaaa', 'aaaaa', 'aaaaaa'];
  const family = LanguageLab.distinguishingFamily({ prefixes: prefixes, suffixes: prefixes,
    accepts: LanguageLab.entry('even-a').accepts });
  const told = family.pairs.filter(function (row) { return row.suffix !== null; }).length;

  assert.strictEqual(family.pairs.length, 15);
  assert.strictEqual(told, 9);
  assert.strictEqual(family.allDistinguished, false);

  const classes = Minimization.myhillNerode(
    Automaton.complete(Automaton.trim(Automaton.toDfa(thompson('(b|ab*a)*')).dfa)), 5).count;

  assert.strictEqual(classes, 2, 'even parity needs two states');

  prose.quotes('proving-non-regularity',
    ['4 of 10 splits survive', '9 of 15 pairs have a witness', '2 equivalence classes',
      'w = aaaaaaaa, 10 decompositions']);
});

/* ------------------------------------------------------ 24.8 transducers */

test('transducers: composition, sizes and the corpus check', function () {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz .'.split('');
  const lower = alphabet.map(function (c) { return c.toLowerCase(); })
    .filter(function (c, i, all) { return all.indexOf(c) === i; });
  const fold = Transducer.caseFolder(alphabet);
  const collapse = Transducer.spaceCollapser(lower);
  const composed = Transducer.compose(fold, collapse);

  assert.strictEqual(alphabet.length, 54);
  assert.strictEqual(lower.length, 28);
  assert.strictEqual(fold.states.length, 1);
  assert.strictEqual(collapse.states.length, 2);
  assert.strictEqual(composed.states.length, 2);
  assert.strictEqual(Transducer.toMoore(fold).states.length, 29);

  const sample = 'Hello   World .';
  const output = Transducer.run(composed, sample).output;

  assert.strictEqual(sample.length, 15);
  assert.strictEqual(output, 'hello world .');
  assert.strictEqual(output.length, 13);
  assert.strictEqual(Transducer.run(moore(), 'AbC').output, 'abc');

  function moore() { return Transducer.toMoore(fold); }

  prose.quotes('transducers',
    ['1 × 2 = 2 bound, 2 reachable', '15 characters in and 13 out', '204 of 204 agreements',
      '28 distinct outputs', '29 states', '"AbC" → "abc"', '1 state']);
});

/* ------------------------------------------------------ 24.9 in production */

test('automata-in-production: the scan and the analyser', function () {
  const scanner = LexerGen.build(LexerGen.sampleRules());
  const result = LexerGen.scan(scanner, 'if x >>= 12');
  const overtakes = result.decisions.filter(function (d) {
    return d.attempts.length > 1;
  }).length;

  assert.strictEqual(LexerGen.sampleRules().length, 11);
  assert.strictEqual(result.decisions.length, 7);
  assert.strictEqual(result.tokens.length, 4);
  assert.strictEqual(overtakes, 3);
  assert.strictEqual('if x >>= 12'.length, 11);
  assert.deepStrictEqual(result.tokens.map(function (t) { return t.type; }),
    ['if', 'identifier', 'shift-assign', 'number']);

  const samples = Redos.samples();
  const correct = samples.filter(function (entry) {
    return Redos.ambiguity(entry.pattern).vulnerable === entry.expected;
  }).length;

  assert.strictEqual(samples.length, 9);
  assert.strictEqual(correct, 9);

  prose.quotes('automata-in-production',
    ['7 decisions over 11 characters, 3 of them passing over a shorter match',
      '4 tokens', 'Eleven rules', '9 patterns with known verdicts']);
});

test('automata-in-production: the measured blow-up', function () {
  const rows = Redos.blowUp('(a+)+b', [4, 8, 12, 16]);

  assert.deepStrictEqual(rows.map(function (r) { return r.length; }), [6, 10, 14, 18]);
  assert.deepStrictEqual(rows.map(function (r) { return r.backtrack; }),
    [99, 1659, 26619, 425979]);
  assert.deepStrictEqual(rows.map(function (r) { return r.simulation; }), [28, 52, 76, 100]);
  assert.strictEqual(prose.fixed(rows[0].ratio, 1), '3.5');
  assert.strictEqual(prose.fixed(rows[2].ratio, 1), '350.3');
  assert.strictEqual(prose.fixed(rows[3].ratio, 1), '4259.8');
  assert.strictEqual(prose.grouped(rows[3].backtrack), '425 979');
  assert.strictEqual(prose.grouped(rows[2].backtrack), '26 619');

  prose.quotes('automata-in-production',
    ['99 backtracking steps against 28 simulation steps, 3.5×',
      '26 619 against 76, a factor of 350.3',
      '425 979 against 100, a factor of 4 259.8']);
});

/* --------------------------------------------------------- 24.10 weighted */

test('weighted-and-probabilistic: the decoding and the underflow depths', function () {
  const model = Hmm.weather();
  const observations = ['walk', 'shop', 'clean'];
  const found = Hmm.viterbi(model, observations);
  const brute = Hmm.bruteForce(model, observations);
  const forward = Hmm.forward(model, observations);

  assert.deepStrictEqual(found.path, ['sunny', 'rainy', 'rainy']);
  assert.strictEqual(prose.fixed(found.logProbability, 4), '-4.3459');
  assert.strictEqual(brute.paths, 8);
  assert.deepStrictEqual(brute.path, found.path);
  assert.strictEqual(prose.fixed(Math.exp(forward.logProbability), 6), '0.035640');
  assert.strictEqual(prose.fixed(Math.exp(found.logProbability), 6), '0.012960');
  assert.strictEqual(model.states.length * observations.length, 6);

  assert.strictEqual(Hmm.underflowDepth(model, 'clean', 2000), 619);
  assert.strictEqual(Hmm.underflowDepth(model, 'shop', 2000), 522);
  assert.strictEqual(Hmm.underflowDepth(model, 'walk', 2000), null);

  const long = new Array(1000).fill('clean');

  assert.strictEqual(Math.round(Hmm.viterbi(model, long).logProbability), -1204);

  prose.quotes('weighted-and-probabilistic',
    ['3 columns × 2 states = 6 cells', '2^3 = 8 paths', '−4.3459', '0.035640', '0.012960',
      '619 repetitions of "clean"; 522 of "shop"', '−1 204', '2 000 steps']);
});

/* ------------------------------------------------------ 24.11 infinite words */

test('automata-over-infinite-words: the three-by-two matrix', function () {
  const rogueDelta = { q: {} };

  Buchi.SYMBOLS.forEach(function (symbol) { rogueDelta.q[symbol] = ['q']; });
  const systems = {
    good: Buchi.server(false),
    starve: Buchi.server(true),
    rogue: Buchi.create({ states: ['q'], alphabet: Buchi.SYMBOLS, start: 'q',
      accepting: ['q'], delta: rogueDelta, label: 'rogue' })
  };
  const verdicts = {};

  Object.keys(systems).forEach(function (name) {
    verdicts[name] = {
      safety: Buchi.emptiness(Buchi.product(systems[name], Buchi.safetyViolation())).empty,
      liveness: Buchi.emptiness(
        Buchi.product(systems[name], Buchi.eventuallyGrantedViolation())).empty
    };
  });

  assert.deepStrictEqual(verdicts.good, { safety: true, liveness: true });
  assert.deepStrictEqual(verdicts.starve, { safety: true, liveness: false });
  assert.strictEqual(verdicts.rogue.safety, false);

  const product = Buchi.product(systems.starve, Buchi.eventuallyGrantedViolation());
  const result = Buchi.emptiness(product);

  assert.strictEqual(product.states.length, 3);
  assert.strictEqual(result.visits, 4);
  assert.strictEqual(result.trace.stem.length, 1);
  assert.strictEqual(result.trace.cycle.length, 1);
  assert.strictEqual(Buchi.accepts(product, result.trace), true);
  assert.strictEqual(Buchi.eventuallyGrantedViolation().states.length, 2);

  prose.quotes('automata-over-infinite-words',
    ['3 reachable pairs', '4 state visits', '2 states: idle, and waiting',
      '1-step stem and a 1-step cycle', 'safety holds, liveness holds — 0 violations']);
});

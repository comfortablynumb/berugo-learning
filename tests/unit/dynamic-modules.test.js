'use strict';

/**
 * Property tests for the M32.9-M32.11 modules.
 *
 * The race detectors are judged by an oracle that enumerates every schedule
 * rather than by each other, the fuzzer is judged by whether its findings
 * survive re-running, and the specification checker is judged by replaying its
 * own counter-examples. Nothing here asserts that a module agrees with itself.
 */

const test = require('node:test');
const assert = require('node:assert');

const RaceDetect = require('../../src/js/algorithms/race-detect.js');
const RaceOracle = require('../../src/js/machines/race-oracle.js');
const Fuzzer = require('../../src/js/algorithms/fuzzer.js');
const FuzzTarget = require('../../src/js/machines/fuzz-target.js');
const SpecDsl = require('../../src/js/machines/spec-dsl.js');
const DynamicTemplate = require('../../src/js/sections/dynamic-analysis-template.js');
const SpecTemplate = require('../../src/js/sections/specifying-systems-template.js');

function locationsOf(rows) {
  return RaceOracle.unique(rows.map(function (row) { return row.location; }));
}

function difference(list, other) {
  return list.filter(function (name) { return other.indexOf(name) === -1; });
}

function judge(name, states) {
  const fixture = DynamicTemplate.TRACES[name];
  const truth = RaceOracle.races(fixture.trace, {});
  const hb = locationsOf(RaceDetect.happensBefore(fixture.trace).races);
  const ls = locationsOf(RaceDetect.lockset(fixture.trace, { states: states }).reports);

  return { name: name, truth: truth, real: truth.locations, hb: hb, ls: ls,
    hbFalse: difference(hb, truth.locations), lsFalse: difference(ls, truth.locations),
    hbMissed: difference(truth.locations, hb), lsMissed: difference(truth.locations, ls) };
}

const NAMES = Object.keys(DynamicTemplate.TRACES);

test('races: the oracle is exhaustive on every fixture', function () {
  NAMES.forEach(function (name) {
    const row = judge(name, 'naive');

    assert.strictEqual(row.truth.exhausted, true,
      name + ': a truncated enumeration proves nothing');
    assert.ok(row.truth.states > 0, name + ': the oracle explored something');
  });
});

/* The direction that matters. A false positive costs ten minutes; a missed
   race is the bug the tool exists to find, so it is asserted for both
   algorithms on every fixture rather than for the one that motivated it. */
test('races: neither detector misses a race the oracle can produce', function () {
  ['naive', 'eraser'].forEach(function (states) {
    NAMES.forEach(function (name) {
      const row = judge(name, states);

      assert.deepStrictEqual(row.hbMissed, [], name + '/' + states + ': happens-before missed one');
      assert.deepStrictEqual(row.lsMissed, [], name + '/' + states + ': the lockset missed one');
    });
  });
});

test('races: happens-before reports nothing the schedules cannot produce', function () {
  const rows = NAMES.map(function (name) { return judge(name, 'naive'); });
  const real = rows.reduce(function (sum, row) { return sum + row.real.length; }, 0);
  const wrong = rows.reduce(function (sum, row) { return sum + row.hbFalse.length; }, 0);

  assert.strictEqual(real, 3, 'three of the seven fixtures can really race');
  assert.strictEqual(wrong, 0, 'and vector clocks report none of the impossible ones');
});

test('races: Eraser state machine removes three of the four lockset false positives',
  function () {
    const naive = NAMES.map(function (name) { return judge(name, 'naive'); })
      .reduce(function (sum, row) { return sum + row.lsFalse.length; }, 0);
    const eraser = NAMES.map(function (name) { return judge(name, 'eraser'); })
      .reduce(function (sum, row) { return sum + row.lsFalse.length; }, 0);

    assert.strictEqual(naive, 4, 'the plain algorithm reports four impossible races');
    assert.strictEqual(eraser, 1, 'and the state machine leaves one');
    assert.deepStrictEqual(judge('published', 'eraser').lsFalse, ['queue'],
      'the survivor is the location a fork made safe, which no lockset can see');
  });

/* ------------------------------------------------------------------ fuzzing */

function bracketTarget(oracles) {
  return function (input) { return FuzzTarget.brackets(input, { oracles: oracles }); };
}

test('fuzzing: an extra oracle is the difference between one finding and two', function () {
  const crash = Fuzzer.run(bracketTarget(['crash']),
    { iterations: 1200, seed: 7, seeds: ['()', '[]'] });
  const both = Fuzzer.run(bracketTarget(['crash', 'differential']),
    { iterations: 1200, seed: 7, seeds: ['()', '[]'] });

  assert.strictEqual(crash.executions, both.executions, 'the same executions either way');
  assert.strictEqual(crash.crashes.length, 1, 'crashes alone find the planted crash');
  assert.strictEqual(both.crashes.length, 2, 'and a differential also finds the wrong answer');
  assert.ok(both.crashes.some(function (row) {
    return row.verdict === 'differential' && row.input === '[)';
  }), 'which is `[)` — two characters, no exception');
});

test('fuzzing: the planted defects really are defects', function () {
  assert.strictEqual(FuzzTarget.counted('[)'), true, 'depth counting accepts it');
  assert.strictEqual(FuzzTarget.stacked('[)'), false, 'and a stack does not');
  assert.throws(function () { FuzzTarget.counted('((((((('); },
    'and deep nesting really throws');
});

test('fuzzing: shrinking keeps the verdict and reduces the input', function () {
  const target = bracketTarget(['crash', 'differential']);
  const run = Fuzzer.run(target, { iterations: 1200, seed: 7, seeds: ['()', '[]'] });

  run.crashes.forEach(function (row) {
    const shrunk = Fuzzer.shrink(target, row.input, {});

    assert.ok(shrunk.to <= shrunk.from, 'a shrink never grows the input');
    assert.strictEqual(target(shrunk.input).verdict, row.verdict,
      'and the smaller input must fail the same way');
  });
});

test('fuzzing: minimisation keeps every edge', function () {
  const run = Fuzzer.run(FuzzTarget.frontEnd,
    { iterations: 1200, seed: 7, seeds: ['let x = 1;', 'fn f(a) { return a; }'] });
  const out = Fuzzer.minimise(run.corpus);

  assert.ok(out.after <= out.before, 'the corpus does not grow');
  assert.deepStrictEqual(out.coverage, run.coverage,
    'and total coverage is unchanged — a minimisation that loses an edge has lost a test');
});

/* The two defects this loop found are fixed; the assertion is that they stay
   fixed, which is what a regression corpus is for. */
test('fuzzing: the inputs that once crashed the front end no longer do', function () {
  ['let:', 'l = match 1;', '{=', 'match =;', 'let x =match  1;'].forEach(function (input) {
    const out = FuzzTarget.frontEnd(input);

    assert.strictEqual(out.verdict, 'ok', input + ' should be reported, not raised');
  });
});

/* ----------------------------------------------------------- specification */

test('specifications: two-phase commit blocks once the crash is modelled', function () {
  const broken = SpecDsl.check(SpecDsl.twoPhaseCommit({ crash: true }), {});
  const safe = SpecDsl.check(SpecDsl.twoPhaseCommit({ crash: false }), {});

  assert.strictEqual(broken.violated, true, 'the blocking scenario is reachable');
  assert.strictEqual(broken.at, 4, 'in four steps');
  assert.strictEqual(broken.broken.name, 'no participant is stuck', 'and it is named');
  assert.strictEqual(broken.replay.ok, true, 'the trace replays against the specification');
  assert.strictEqual(safe.violated, false, 'with no failure modelled the model is spotless');
});

test('specifications: the state counts the section quotes', function () {
  const rows = ['twoPhase', 'twoPhaseSafe', 'retry', 'retryKeyed'].map(function (name) {
    const spec = SpecTemplate.SPECS[name].build(SpecDsl);

    return { name: name, states: SpecDsl.states(spec, {}), check: SpecDsl.check(spec, {}) };
  });
  const by = {};

  rows.forEach(function (row) { by[row.name] = row; });
  assert.strictEqual(by.twoPhase.states.reachable, 19, 'nineteen reachable with the crash');
  assert.strictEqual(by.twoPhaseSafe.states.reachable, 10, 'ten without it');
  assert.strictEqual(by.twoPhase.states.total, 256, 'of the 256 the variables allow');
  assert.strictEqual(by.retry.check.at, 5, 'the retry applies twice in five steps');
  assert.strictEqual(by.retryKeyed.check.violated, false, 'and the keyed variant does not');
  assert.strictEqual(by.retry.states.reachable, by.retryKeyed.states.reachable,
    'the fix is about which transitions exist, not about the size of the space');
});

test('specifications: an invariant whose premise never holds is never violated', function () {
  const spec = { name: 'vacuous', vars: ['a', 'b'], init: { a: false, b: false },
    actions: [{ name: 'set a', when: ['!a'], then: { a: true } }],
    invariants: [{ name: 'b implies a', when: ['b'], require: ['a'] }] };
  const out = SpecDsl.check(spec, {});

  assert.strictEqual(out.violated, false, 'b is never set');
  assert.strictEqual(out.states, 2, 'over the two reachable states');
});

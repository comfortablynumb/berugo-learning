'use strict';

/**
 * Every figure the M32.9-M32.11 content quotes, recomputed and then checked
 * against the prose.
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

require('../../src/js/content/concepts-program-dynamic.js');
require('../../src/js/content/examples-program-dynamic.js');
const prose = require('../support/worked-example-prose.js');

function locationsOf(rows) {
  return RaceOracle.unique(rows.map(function (row) { return row.location; }));
}

function difference(list, other) {
  return list.filter(function (name) { return other.indexOf(name) === -1; });
}

function tally(states) {
  return Object.keys(DynamicTemplate.TRACES).reduce(function (into, name) {
    const trace = DynamicTemplate.TRACES[name].trace;
    const truth = RaceOracle.races(trace, {}).locations;
    const hb = locationsOf(RaceDetect.happensBefore(trace).races);
    const ls = locationsOf(RaceDetect.lockset(trace, { states: states }).reports);

    into.real += truth.length;
    into.hbFalse += difference(hb, truth).length;
    into.lsFalse += difference(ls, truth).length;
    into.hbMissed += difference(truth, hb).length;
    into.lsMissed += difference(truth, ls).length;
    return into;
  }, { real: 0, hbFalse: 0, lsFalse: 0, hbMissed: 0, lsMissed: 0 });
}

test('dynamic analysis: the seven-fixture tally', function () {
  const naive = tally('naive');
  const eraser = tally('eraser');

  assert.strictEqual(Object.keys(DynamicTemplate.TRACES).length, 7, 'seven traces');
  assert.strictEqual(naive.real, 3, 'three of them can really race');
  assert.strictEqual(naive.hbFalse, 0, 'happens-before reports nothing impossible');
  assert.strictEqual(naive.hbMissed, 0, 'and misses nothing');
  assert.strictEqual(naive.lsFalse, 4, 'the plain lockset reports four impossible ones');
  assert.strictEqual(eraser.lsFalse, 1, 'and Eraser leaves one');

  prose.quotes('dynamic-analysis',
    ['3 of the 7 traces can race', '3 found, 0 false positives, 0 missed',
      '4 locations reported that no schedule can race', '3 found, 1 false positive']);
});

test('dynamic analysis: the two traces a lockset cannot tell apart', function () {
  const apart = RaceOracle.races(DynamicTemplate.TRACES.differentLocks.trace, {});
  const handover = RaceOracle.races(DynamicTemplate.TRACES.handover.trace, {});

  assert.strictEqual(apart.states, 25, 'the different-locks trace takes 25 schedule states');
  assert.deepStrictEqual(apart.locations, ['balance'], 'and balance can race');
  assert.strictEqual(handover.states, 7, 'the handover trace takes 7');
  assert.deepStrictEqual(handover.locations, [], 'and nothing in it can race');

  const states = Object.keys(DynamicTemplate.TRACES).map(function (name) {
    return RaceOracle.races(DynamicTemplate.TRACES[name].trace, {}).states;
  });

  assert.strictEqual(Math.min.apply(null, states), 5, 'the smallest fixture is 5 states');
  assert.strictEqual(Math.max.apply(null, states), 25, 'and the largest is 25');

  prose.quotes('dynamic-analysis',
    ['25 schedule states', '7 schedule states', '5 to 25 schedule states']);
});

/* --------------------------------------------------------------- fuzzing */

function bracketRun(oracles) {
  return Fuzzer.run(function (input) {
    return FuzzTarget.brackets(input, { oracles: oracles });
  }, { iterations: 1200, seed: 7, seeds: ['()', '[]'] });
}

test('fuzzing: the bracket target under both oracle sets', function () {
  const crash = bracketRun(['crash']);
  const both = bracketRun(['crash', 'differential']);
  const target = function (input) {
    return FuzzTarget.brackets(input, { oracles: ['crash', 'differential'] });
  };

  assert.strictEqual(both.executions, 1202, '1 202 executions');
  assert.strictEqual(crash.crashes.length, 1, 'one finding with crashes alone');
  assert.strictEqual(both.crashes.length, 2, 'two with a differential');
  assert.strictEqual(both.edges, 16, '16 distinct behaviours covered');
  assert.strictEqual(both.corpus.length, 10, 'and 10 inputs kept');

  const wrong = both.crashes.filter(function (row) {
    return row.verdict === 'differential';
  })[0];
  const crashed = both.crashes.filter(function (row) { return row.verdict === 'crash'; })[0];

  assert.strictEqual(wrong.input, '[)', 'the wrong answer is two characters');
  assert.strictEqual(wrong.count, 71, 'reached 71 times');
  assert.strictEqual(crashed.count, 69, 'and the crash 69 times');
  assert.strictEqual(Fuzzer.shrink(target, crashed.input, {}).from, 9, 'the crash was 9 bytes');
  assert.strictEqual(Fuzzer.shrink(target, crashed.input, {}).to, 7, 'and shrinks to 7');

  prose.quotes('coverage-guided-fuzzing',
    ['1 202 executions, 1 finding', '2 findings', '9 bytes to 7', '71 inputs', '69 reached',
      '10 inputs kept of 1 202 run, covering 16 distinct behaviours']);
});

test('fuzzing: the front-end run and its minimisation', function () {
  const run = Fuzzer.run(FuzzTarget.frontEnd,
    { iterations: 1200, seed: 7, seeds: ['let x = 1;', 'fn f(a) { return a; }'] });
  const out = Fuzzer.minimise(run.corpus);

  assert.strictEqual(run.executions, 1202, '1 202 executions');
  assert.strictEqual(run.edges, 60, '60 distinct behaviours');
  assert.strictEqual(run.corpus.length, 24, '24 inputs kept');
  assert.strictEqual(out.after, 22, 'minimised to 22');
  assert.strictEqual(out.bytesBefore, 473, 'from 473 bytes');
  assert.strictEqual(out.bytesAfter, 423, 'to 423');
  assert.strictEqual(out.coverage.length, 60, 'with the same 60 edges');

  prose.quotes('coverage-guided-fuzzing',
    ['1 202 executions, 60 distinct behaviours, 24 inputs kept',
      '24 inputs down to 22, and 473 bytes down to 423', '60 edges before, 60 after']);
});

/* --------------------------------------------------------- specification */

test('specifications: the four models the section checks', function () {
  const rows = {};

  ['twoPhase', 'twoPhaseSafe', 'retry', 'retryKeyed'].forEach(function (name) {
    const spec = SpecTemplate.SPECS[name].build(SpecDsl);

    rows[name] = { spec: spec, states: SpecDsl.states(spec, {}),
      check: SpecDsl.check(spec, {}) };
  });

  assert.strictEqual(rows.twoPhase.spec.vars.length, 8, 'eight variables');
  assert.strictEqual(rows.twoPhase.spec.actions.length, 8, 'and eight actions');
  assert.strictEqual(rows.twoPhase.states.reachable, 19, '19 reachable of 256');
  assert.strictEqual(rows.twoPhase.states.edges.length, 36, 'and 36 transitions');
  assert.strictEqual(rows.twoPhase.check.at, 4, 'broken in four steps');
  assert.strictEqual(rows.twoPhaseSafe.states.reachable, 10, '10 reachable without the crash');
  assert.strictEqual(rows.twoPhaseSafe.states.edges.length, 14, 'and 14 transitions');
  assert.strictEqual(rows.twoPhaseSafe.check.violated, false, 'and it is clean');
  assert.strictEqual(rows.retry.states.reachable, 8, 'the retry reaches 8 of 64');
  assert.strictEqual(rows.retry.states.edges.length, 8, 'over 8 transitions');
  assert.strictEqual(rows.retry.check.at, 5, 'and applies twice in five steps');
  assert.strictEqual(rows.retryKeyed.check.violated, false, 'the keyed variant is clean');

  const trace = rows.twoPhase.check.trace.map(function (row) { return row.action; });

  assert.deepStrictEqual(trace, ['init', 'coordinator sends prepare',
    'participant 1 votes yes', 'the coordinator fails', 'participant 1 is blocked'],
  'and the trace is the blocking scenario, in the spec\'s own words');

  prose.quotes('specifying-systems',
    ['10 reachable states, 14 transitions', '19 reachable states of the 256',
      '8 reachable states of 64', '8 transitions', '4 steps']);
});

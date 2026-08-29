'use strict';

/**
 * Every figure the M32.1-M32.4 content quotes, recomputed from the modules and
 * then checked against the prose.
 *
 * The section controllers are not imported; the calls below reproduce what
 * they make at their default control settings, which is the contract this
 * suite is really pinning down - if a default moves, the prose is wrong and
 * this fails.
 */

const test = require('node:test');
const assert = require('node:assert');

const StaticLab = require('../../src/js/machines/static-lab.js');
const Taint = require('../../src/js/algorithms/taint.js');
const TaintOracle = require('../../src/js/machines/taint-oracle.js');
const Symbolic = require('../../src/js/algorithms/symbolic-exec.js');

require('../../src/js/content/concepts-program-analysis.js');
require('../../src/js/content/concepts-program-taint.js');
require('../../src/js/content/examples-program-analysis.js');
require('../../src/js/content/examples-program-taint.js');
const prose = require('../support/worked-example-prose.js');

const LOOP = 'let x = 0;\nlet n = 10;\nwhile (x < n) { x = x + 2; }\nlet r = x;';
const NESTED = 'let i = 0;\nlet t = 0;\nwhile (i < 5) { let j = 0; '
  + 'while (j < 3) { t = t + 1; j = j + 1; } i = i + 1; }\nlet r = t;';
const BIG = 'let x = 0;\nlet n = 1000;\nwhile (x < n) { x = x + 2; }\nlet r = x;';

function levels(source) {
  const compiled = StaticLab.compile(source);
  const run = StaticLab.observe(compiled.fn, {});
  const rows = {};

  [['sign', 'sign', true], ['parity', 'parity', true], ['widen', 'interval', false],
    ['narrow', 'interval', true]].forEach(function (level) {
    const analysis = StaticLab.analyse(compiled.fn,
      { domain: level[1], narrow: level[2] });

    rows[level[0]] = StaticLab.precision(analysis, run);
  });
  return { run: run, rows: rows };
}

/* ------------------------------------------------- 32.1 foundations */

test('foundations: the counting loop at four precisions', function () {
  const study = levels(LOOP);

  assert.strictEqual(study.run.steps, 13, 'the run visits 13 blocks');
  assert.strictEqual(study.run.observations.length, 26, 'two snapshots per visit');
  assert.strictEqual(study.rows.sign.total, 15, '15 claims are reached');
  assert.strictEqual(study.rows.sign.exact, 8, 'sign is exact on 8 of them');
  assert.strictEqual(study.rows.sign.unbounded, 7, 'and says nothing on 7');
  assert.strictEqual(study.rows.parity.exact, 11, 'parity is exact on 11');
  assert.strictEqual(study.rows.parity.unbounded, 0, 'and never reaches its top here');
  assert.strictEqual(study.rows.widen.exact, 8, 'intervals with widening alone: 8 exact');
  assert.strictEqual(study.rows.widen.unbounded, 5, 'and 5 saying nothing');
  assert.strictEqual(study.rows.narrow.exact, 8, 'narrowing keeps 8 exact');
  assert.strictEqual(study.rows.narrow.unbounded, 0, 'and recovers every unbounded claim');

  const sound = StaticLab.soundness(
    StaticLab.analyse(StaticLab.compile(LOOP).fn, { domain: 'interval' }), study.run);

  assert.strictEqual(sound.observations, 51, '51 numeric values are checked');
  assert.strictEqual(sound.violations.length, 0, 'and none of them is outside its claim');

  prose.quotes('static-analysis-foundations',
    ['13 block visits', '26 snapshots', '51 observed', '15 claims', '8 exact', '11 exact',
      '7 at the top of the lattice', '5 saying nothing', '0 saying nothing']);
});

test('foundations: the nested loop collapses to almost nothing', function () {
  const study = levels(NESTED);

  assert.strictEqual(study.rows.sign.total, 39, '39 claims are reached');
  assert.strictEqual(study.rows.sign.exact, 3, 'sign is exact on 3');
  assert.strictEqual(study.rows.sign.unbounded, 36, 'and says nothing on 36');
  assert.strictEqual(study.rows.parity.exact, 3, 'parity matches it');
  assert.strictEqual(study.rows.parity.unbounded, 36, 'exactly');
  assert.strictEqual(study.rows.widen.exact, 7, 'widening alone: 7 exact, 32 at the top');
  assert.strictEqual(study.rows.widen.unbounded, 32, 'as quoted');
  assert.strictEqual(study.rows.narrow.exact, 11, 'narrowing recovers 4 more');
  assert.strictEqual(study.rows.narrow.unbounded, 28, 'leaving 28 saying nothing');

  const sound = StaticLab.soundness(
    StaticLab.analyse(StaticLab.compile(NESTED).fn, { domain: 'interval' }), study.run);

  assert.strictEqual(sound.observations, 312, '312 values behind the verdict');
  assert.strictEqual(sound.violations.length, 0, 'and no violation among them');

  prose.quotes('static-analysis-foundations',
    ['39 claims', '312 observed values', '3 of 39', '36 of 39', '7 of 39', '32 at the top',
      '11 of 39', '28 at the top']);
});

/* ----------------------------------------- 32.2 abstract interpretation */

function ascending(analysis) {
  return analysis.rounds.filter(function (row) { return row.pass === 'widen'; }).length;
}

test('abstract interpretation: rounds with and without widening', function () {
  const expected = { 10: 8, 50: 28, 100: 53, 200: 103 };

  Object.keys(expected).forEach(function (bound) {
    const fn = StaticLab.compile('let x = 0;\nlet n = ' + bound +
      ';\nwhile (x < n) { x = x + 2; }\nlet r = x;').fn;

    assert.strictEqual(ascending(StaticLab.analyse(fn,
      { domain: 'interval', widen: false, narrow: false })), expected[bound],
    'join-only rounds at a bound of ' + bound);
    assert.strictEqual(ascending(StaticLab.analyse(fn, { domain: 'interval' })), 3,
      'widening is 3 rounds at every bound');
  });

  const header = StaticLab.analyse(StaticLab.compile(LOOP).fn, { domain: 'interval' })
    .blocks.filter(function (block) { return block.header; })[0];

  assert.strictEqual(header.entry['@0'], '[0, 11]', 'and the answer is the same either way');
  prose.quotes('abstract-interpretation',
    ['8, 28, 53 and 103 rounds', '3 rounds at every one of them', '[0, 11]']);
});

test('abstract interpretation: the budgeted run is refuted by the programme', function () {
  const compiled = StaticLab.compile(BIG);
  const run = StaticLab.observe(compiled.fn, {});
  const capped = StaticLab.analyse(compiled.fn,
    { domain: 'interval', widen: false, narrow: false });
  const widened = StaticLab.analyse(compiled.fn, { domain: 'interval' });

  assert.strictEqual(capped.converged, false, 'it never reached a fixpoint');
  assert.strictEqual(ascending(capped), 200, 'having used all 200 rounds');
  assert.strictEqual(capped.blocks.filter(function (block) {
    return block.header;
  })[0].entry['@0'], '[0, 398]', 'and it claims [0, 398] at the header');

  const sound = StaticLab.soundness(capped, run);

  assert.strictEqual(sound.observations, 4011, '4 011 observed values');
  assert.strictEqual(sound.violations.length, 1207, '1 207 of them outside the claim');

  const good = StaticLab.soundness(widened, run);

  assert.strictEqual(good.violations.length, 0, 'widening is sound on the same run');
  assert.strictEqual(StaticLab.precision(widened, run).exact, 8, 'with 8 of 15 exact');
  assert.strictEqual(widened.blocks.filter(function (block) {
    return block.header;
  })[0].entry['@0'], '[0, 1001]', 'and claims [0, 1001]');

  prose.quotes('abstract-interpretation',
    ['[0, 398]', '1 207', '4 011', '[0, 1001]', '8 of 15 claims exact', '1 003 blocks']);
});

/* ------------------------------------------------- 32.3 taint analysis */

const PRELUDE = [
  'fn readParam(k) { return k + 1; }',
  'fn escape(v) { return v * 2; }',
  'fn query(s) { return s; }',
  'fn log(v) { return 0; }',
  'fn wrap(v) { return v + 1; }',
  ''
].join('\n');

const FIXTURES = {
  direct: 'let raw = readParam(7);\nlet safe = escape(raw);\nlet a = query(raw);\n'
    + 'let b = query(safe);\nlet r = a + b;',
  record: 'let raw = readParam(7);\nlet clean = 5;\nlet box = { bad: raw, good: clean };\n'
    + 'let a = query(box.good);\nlet b = query(box.bad);\nlet r = a + b;',
  array: 'let raw = readParam(7);\nlet clean = 5;\nlet arr = [raw, clean];\n'
    + 'let r = query(arr[1]);'
};

function taintStudy(name, fields) {
  const compiled = StaticLab.compile(PRELUDE + FIXTURES[name]);
  const main = compiled.program.functions.filter(function (fn) {
    return fn.name === 'main';
  })[0];
  const policy = Object.assign(Taint.defaultPolicy(), { fields: fields });

  return { main: main, policy: policy,
    analysis: Taint.analyse(main, { policy: policy }),
    observed: TaintOracle.run(compiled.program, { policy: policy }) };
}

test('taint: the record fixture, both precisions, against the run', function () {
  const insensitive = taintStudy('record', 'insensitive');
  const sensitive = taintStudy('record', 'sensitive');

  assert.strictEqual(insensitive.analysis.findings.length, 2, '2 findings field-insensitively');
  assert.strictEqual(sensitive.analysis.findings.length, 1, '1 field-sensitively');
  assert.strictEqual(insensitive.observed.reached, 2, '2 sink calls executed');
  assert.strictEqual(insensitive.observed.tainted, 1, '1 of them really received taint');
  assert.strictEqual(insensitive.analysis.findings[0].hops, 7, 'the path is 7 hops long');

  ['insensitive', 'sensitive'].forEach(function (fields) {
    const array = taintStudy('array', fields);

    assert.strictEqual(array.analysis.findings.length, 1, 'the array reports 1 either way');
    assert.strictEqual(array.observed.tainted, 0, 'and the value that arrives is clean');
  });

  prose.quotes('taint-analysis',
    ['2 findings', '1 finding', '2 sink calls executed', '7 hops']);
});

test('taint: the policy sweep on the direct fixture', function () {
  const study = taintStudy('direct', 'insensitive');
  const rows = {};

  Taint.policySweep(study.main, study.policy).forEach(function (row) {
    rows[row.change] = row;
  });
  assert.strictEqual(rows['the declared policy'].findings, 1, '1 finding declared');
  assert.strictEqual(study.observed.tainted, 1, 'and the run confirms it');
  assert.strictEqual(rows['one source undeclared'].findings, 0, 'undeclaring a source: 0');
  assert.strictEqual(rows['one sanitiser undeclared'].findings, 2, 'a sanitiser: 2');
  assert.strictEqual(rows['one sink undeclared'].findings, 0, 'a sink: 0');

  prose.quotes('taint-analysis',
    ['0 findings — a change of -1', '2 findings — a change of +1', 'from 1 to 0',
      'from 1 to 2']);
});

/* --------------------------------------------- 32.4 symbolic execution */

function ladder(k) {
  const body = [];

  for (let at = 1; at <= k; at += 1) {
    body.push('  if (a > ' + at + ') { r = r + ' + at + '; } else { r = r - ' + at + '; }');
  }
  return 'fn ladder(a) {\n  let r = 0;\n' + body.join('\n') + '\n  return r;\n}\n'
    + 'let z = ladder(0);';
}

function functionNamed(source, name) {
  return StaticLab.compile(source).program.functions.filter(function (fn) {
    return fn.name === name;
  })[0];
}

test('symbolic execution: the ladder, leaf by leaf', function () {
  const seen = [];

  [1, 3, 5, 7].forEach(function (branches) {
    const fn = functionNamed(ladder(branches), 'ladder');
    const run = Symbolic.execute(fn, { names: ['a'], paths: 400, depth: 80, decide: 'linear' });

    seen.push({ branches: branches, paths: run.paths.length, feasible: run.feasible,
      dead: run.paths.filter(function (path) { return path.verdict === 'unsat'; }).length });
  });

  assert.deepStrictEqual(seen.map(function (row) { return row.paths; }), [2, 8, 32, 128],
    'the tree doubles per branch');
  assert.deepStrictEqual(seen.map(function (row) { return row.feasible; }), [2, 4, 6, 8],
    'and the reachable part grows by one');
  assert.strictEqual(seen[3].dead, 120, '120 of the 128 leaves are proved impossible');
  assert.strictEqual(seen[2].dead, 26, 'and 26 of the 32');

  prose.quotes('symbolic-execution',
    ['128 leaves', '120', '2, 4, 8, 16, 32, 64, 128 leaves', '26']);
});

test('symbolic execution: three fixtures, every input executed', function () {
  const classify = functionNamed('fn classify(a, b) {\n  let r = 0;\n'
    + '  if (a > 10) { if (b < 0) { r = 1; } else { r = 2; } } else { r = 3; }\n'
    + '  return r;\n}\nlet z = classify(1, 2);', 'classify');
  const guard = functionNamed('fn guard(a) {\n  let r = 0;\n'
    + '  if (a > 10) { if (a < 5) { r = 1; } else { r = 2; } } else { r = 3; }\n'
    + '  return r;\n}\nlet z = guard(0);', 'guard');
  const scale = functionNamed('fn scale(a, b) {\n  let p = a * b;\n  let r = 0;\n'
    + '  if (p > 20) { r = 1; } else { r = 2; }\n  return r;\n}\nlet z = scale(2, 3);', 'scale');

  const first = Symbolic.execute(classify, { names: ['a', 'b'], decide: 'linear' });
  const firstCheck = StaticLab.verifyPaths(classify, first.paths, { names: ['a', 'b'] });

  assert.strictEqual(first.paths.length, 3, 'classify has 3 leaves');
  assert.strictEqual(firstCheck.reached, 3, 'all 3 inputs reach their path');
  assert.strictEqual(coverage(firstCheck), 7, 'covering all 7 blocks');

  const second = Symbolic.execute(guard, { names: ['a'], decide: 'linear' });
  const secondCheck = StaticLab.verifyPaths(guard, second.paths, { names: ['a'] });

  assert.strictEqual(second.feasible, 2, 'guard has 2 reachable leaves');
  assert.strictEqual(second.paths.length - second.feasible, 1, 'and 1 impossible one');
  assert.strictEqual(coverage(secondCheck), 6, 'reaching 6 of the 7 blocks');

  const third = Symbolic.execute(scale, { names: ['a', 'b'], decide: 'linear' });
  const thirdCheck = StaticLab.verifyPaths(scale, third.paths, { names: ['a', 'b'] });

  assert.strictEqual(third.paths.length, 2, 'scale forks once');
  assert.strictEqual(thirdCheck.reached, 1, 'and only 1 of 2 inputs reaches its path');
  assert.strictEqual(coverage(thirdCheck), 3, 'leaving 3 of 4 blocks reached');

  prose.quotes('symbolic-execution',
    ['3 of 3', '7 of 7', '6 of 7', '1 of 2', '3 of 4']);
});

function coverage(check) {
  const seen = {};

  check.rows.forEach(function (row) {
    row.visited.forEach(function (block) { seen[block] = true; });
  });
  return Object.keys(seen).length;
}

test('symbolic execution: the budget is enforced and reported', function () {
  const fn = functionNamed(ladder(7), 'ladder');
  const run = Symbolic.execute(fn, { names: ['a'], paths: 64, depth: 24, decide: 'linear' });
  const check = StaticLab.verifyPaths(fn, run.paths, { names: ['a'] });

  assert.strictEqual(run.paths.length, 64, 'the 64-path budget was enforced');
  assert.strictEqual(run.truncated, 1, '1 path was abandoned');
  assert.strictEqual(fn.blocks.length, 22, 'the function has 22 blocks');
  assert.strictEqual(coverage(check), 21, 'and the inputs reach 21 of them');

  prose.quotes('symbolic-execution', ['64-path budget', '1 of 22 blocks unreached']);
});

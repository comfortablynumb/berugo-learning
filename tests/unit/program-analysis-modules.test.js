'use strict';

/**
 * Property tests for the M32.1-M32.4 analysers.
 *
 * Every one of them is checked against something that does not share its
 * implementation: the abstract interpreter against a concrete run of the same
 * programme, the taint analysis against a dynamic taint oracle, and the
 * symbolic executor against the concrete execution of the inputs it generated.
 * A static analyser cannot be tested by asserting its own output, because the
 * assertion is then a copy of the bug.
 */

const test = require('node:test');
const assert = require('node:assert');

const StaticLab = require('../../src/js/machines/static-lab.js');
const Abstract = require('../../src/js/algorithms/abstract-interp.js');
const Taint = require('../../src/js/algorithms/taint.js');
const TaintOracle = require('../../src/js/machines/taint-oracle.js');
const Symbolic = require('../../src/js/algorithms/symbolic-exec.js');

const PROGRAMS = {
  counting: 'let x = 0;\nlet n = 10;\nwhile (x < n) { x = x + 2; }\nlet r = x;',
  large: 'let x = 0;\nlet n = 1000;\nwhile (x < n) { x = x + 2; }\nlet r = x;',
  nested: 'let i = 0;\nlet t = 0;\nwhile (i < 5) { let j = 0; '
    + 'while (j < 3) { t = t + 1; j = j + 1; } i = i + 1; }\nlet r = t;',
  branch: 'let a = 4;\nlet b = 0;\nif (a > 2) { b = a - 1; } else { b = 0 - a; }\nlet r = b;',
  straight: 'let a = 3;\nlet b = 4;\nlet c = a * b;\nlet r = c - 2;'
};

function ascending(analysis) {
  return analysis.rounds.filter(function (row) { return row.pass === 'widen'; }).length;
}

/* ---------------------------------------------------- abstract interpretation */

test('abstract interpretation: every domain is sound on every fixture', function () {
  Object.keys(PROGRAMS).forEach(function (name) {
    const compiled = StaticLab.compile(PROGRAMS[name]);
    const run = StaticLab.observe(compiled.fn, {});

    ['interval', 'sign', 'parity'].forEach(function (domain) {
      const analysis = StaticLab.analyse(compiled.fn, { domain: domain });
      const out = StaticLab.soundness(analysis, run);

      assert.strictEqual(out.violations.length, 0,
        domain + ' is unsound on ' + name + ': ' + JSON.stringify(out.violations[0]));
      assert.ok(out.observations > 0, 'a soundness verdict with no observations is not one');
    });
  });
});

test('abstract interpretation: widening terminates in a constant number of rounds', function () {
  const rounds = [10, 50, 100, 200, 400, 1000].map(function (bound) {
    const fn = StaticLab.compile('let x = 0;\nlet n = ' + bound +
      ';\nwhile (x < n) { x = x + 2; }\nlet r = x;').fn;

    return ascending(StaticLab.analyse(fn, { domain: 'interval' }));
  });

  assert.deepStrictEqual(rounds, [3, 3, 3, 3, 3, 3],
    'the cost of widening must not depend on the programme being analysed');
});

test('abstract interpretation: the join alone costs one round per iteration', function () {
  [[10, 8], [50, 28], [100, 53], [200, 103]].forEach(function (pair) {
    const fn = StaticLab.compile('let x = 0;\nlet n = ' + pair[0] +
      ';\nwhile (x < n) { x = x + 2; }\nlet r = x;').fn;
    const analysis = StaticLab.analyse(fn, { domain: 'interval', widen: false, narrow: false });

    assert.strictEqual(ascending(analysis), pair[1],
      'join-only rounds at a bound of ' + pair[0]);
    assert.strictEqual(analysis.converged, true, 'and it does converge at this bound');
  });
});

/* A budget is not an approximation: the state it leaves is BELOW the fixpoint,
   which is the one direction that is unsound. The test asserts the run refutes
   it, so the claim in the prose is a measurement rather than an argument. */
test('abstract interpretation: an unconverged analysis is unsound, and says it did not converge',
  function () {
    const compiled = StaticLab.compile(PROGRAMS.large);
    const run = StaticLab.observe(compiled.fn, {});
    const capped = StaticLab.analyse(compiled.fn,
      { domain: 'interval', widen: false, narrow: false });

    assert.strictEqual(capped.converged, false, 'it ran out of rounds still changing');
    assert.strictEqual(ascending(capped), capped.cap, 'having used the whole budget');
    const out = StaticLab.soundness(capped, run);

    assert.ok(out.violations.length > 500,
      'the run refutes the unconverged claim, found ' + out.violations.length);
    assert.strictEqual(StaticLab.analyse(compiled.fn, { domain: 'interval' }).converged, true,
      'and widening reaches a real fixpoint on the same programme');
  });

test('abstract interpretation: narrowing only ever replaces an infinite bound', function () {
  const interval = Abstract.DOMAINS.interval;

  assert.deepStrictEqual(interval.narrow({ lo: 0, hi: Abstract.INF }, { lo: 5, hi: 11 }),
    { lo: 0, hi: 11 }, 'an infinite bound may become finite');
  assert.deepStrictEqual(interval.narrow({ lo: 0, hi: 11 }, { lo: 5, hi: 20 }),
    { lo: 0, hi: 11 }, 'a finite bound must not move, or the chain re-opens');
});

test('abstract interpretation: widening only throws away a bound that moved', function () {
  const interval = Abstract.DOMAINS.interval;

  assert.deepStrictEqual(interval.widen({ lo: 0, hi: 0 }, { lo: 0, hi: 2 }),
    { lo: 0, hi: Abstract.INF }, 'the upper bound moved');
  assert.deepStrictEqual(interval.widen({ lo: 0, hi: 4 }, { lo: 0, hi: 4 }),
    { lo: 0, hi: 4 }, 'nothing moved, so nothing is lost');
});

/* ------------------------------------------------------------ taint analysis */

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
    + 'let r = query(arr[1]);',
  backedge: 'let t = 0;\nlet u = 0;\nlet i = 0;\n'
    + 'while (i < 3) { u = t; t = readParam(i); i = i + 1; }\nlet r = query(u);',
  branchy: 'let raw = readParam(7);\nlet v = 0;\n'
    + 'if (raw > 3) { v = escape(raw); } else { v = raw; }\nlet r = query(v);',
  ignores: 'let raw = readParam(7);\nlet z = log(raw);\nlet r = query(z);'
};

function taintStudy(name, fields) {
  const compiled = StaticLab.compile(PRELUDE + FIXTURES[name]);
  const main = compiled.program.functions.filter(function (fn) {
    return fn.name === 'main';
  })[0];
  const policy = Object.assign(Taint.defaultPolicy(), { fields: fields || 'insensitive' });

  return { main: main, policy: policy,
    analysis: Taint.analyse(main, { policy: policy }),
    observed: TaintOracle.run(compiled.program, { policy: policy }) };
}

/* The direction that matters. A false positive costs an engineer ten minutes;
   a missed flow is the failure the tool exists to prevent, so it is asserted
   on every fixture rather than on the one that motivated it. */
test('taint: nothing that really arrived tainted goes unreported, on any fixture', function () {
  Object.keys(FIXTURES).forEach(function (name) {
    ['insensitive', 'sensitive'].forEach(function (fields) {
      const study = taintStudy(name, fields);
      const flagged = {};

      study.analysis.findings.forEach(function (row) { flagged[row.span.start] = true; });
      study.observed.sinks.forEach(function (hit) {
        if (!hit.tainted) return;
        assert.ok(flagged[hit.span.start],
          name + '/' + fields + ': a tainted value reached a sink nobody reported');
      });
    });
  });
});

test('taint: the oracle really executed the fixtures it is judging', function () {
  Object.keys(FIXTURES).forEach(function (name) {
    const study = taintStudy(name);

    assert.ok(study.observed.reached > 0, name + ': the run reached no sink at all');
    assert.strictEqual(study.observed.gaveUp, null,
      name + ': the oracle gave up on ' + study.observed.gaveUp);
  });
});

test('taint: field sensitivity removes the record false positive and not the array one',
  function () {
    const insensitive = taintStudy('record', 'insensitive');
    const sensitive = taintStudy('record', 'sensitive');

    assert.strictEqual(insensitive.analysis.findings.length, 2, 'both fields are reported');
    assert.strictEqual(sensitive.analysis.findings.length, 1, 'only the tainted field is');
    assert.strictEqual(insensitive.observed.tainted, 1, 'and the run says one of them is real');

    ['insensitive', 'sensitive'].forEach(function (fields) {
      const array = taintStudy('array', fields);

      assert.strictEqual(array.analysis.findings.length, 1,
        'the array is one location under ' + fields);
      assert.strictEqual(array.observed.tainted, 0, 'and the value that arrives is clean');
    });
  });

test('taint: a flow that arrives on a back edge needs a second round', function () {
  const study = taintStudy('backedge');

  assert.ok(study.analysis.rounds >= 2, 'the fixpoint took more than one sweep');
  assert.strictEqual(study.analysis.findings.length, 1, 'and the flow is reported');
  assert.strictEqual(study.observed.tainted, 1, 'the run agrees it really arrives');
});

test('taint: the policy sweep prices both failure directions', function () {
  const study = taintStudy('direct');
  const rows = Taint.policySweep(study.main, study.policy);
  const byChange = {};

  rows.forEach(function (row) { byChange[row.change] = row; });
  assert.strictEqual(byChange['the declared policy'].findings, 1, 'the baseline');
  assert.strictEqual(byChange['one source undeclared'].delta, -1, 'silently fewer');
  assert.strictEqual(byChange['one sanitiser undeclared'].delta, 1, 'noisily more');
  assert.strictEqual(byChange['one sink undeclared'].delta, -1, 'silently fewer again');
});

/* ------------------------------------------------------- symbolic execution */

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

/* The claim of the technique is reachability, so the test executes the inputs
   rather than counting them. A model that satisfies the path condition and
   then takes a different path means the condition does not describe the path. */
test('symbolic execution: every generated input reaches the path it was generated for',
  function () {
    const fn = functionNamed('fn classify(a, b) {\n  let r = 0;\n'
      + '  if (a > 10) { if (b < 0) { r = 1; } else { r = 2; } } else { r = 3; }\n'
      + '  return r;\n}\nlet z = classify(1, 2);', 'classify');
    const run = Symbolic.execute(fn, { names: ['a', 'b'], decide: 'linear' });
    const check = StaticLab.verifyPaths(fn, run.paths, { names: ['a', 'b'] });

    assert.strictEqual(run.paths.length, 3, 'three leaves');
    assert.strictEqual(check.checked, 3, 'three inputs to verify');
    assert.deepStrictEqual(check.missed, [], 'every input followed its own path');
  });

test('symbolic execution: the tree doubles and the reachable part does not', function () {
  [[1, 2, 2], [3, 8, 4], [5, 32, 6], [7, 128, 8]].forEach(function (row) {
    const fn = functionNamed(ladder(row[0]), 'ladder');
    const run = Symbolic.execute(fn, { names: ['a'], paths: 400, depth: 80, decide: 'linear' });
    const dead = run.paths.filter(function (path) { return path.verdict === 'unsat'; }).length;

    assert.strictEqual(run.paths.length, row[1], row[0] + ' branches make ' + row[1] + ' leaves');
    assert.strictEqual(run.feasible, row[2], 'of which ' + row[2] + ' are reachable');
    assert.strictEqual(dead, row[1] - row[2], 'and the rest are PROVED impossible');
  });
});

/* A decision procedure may only report unsat when it can produce the
   contradiction. This checks the other side: every leaf it called unsat really
   has no integer solution in a range the search would have found one in. */
test('symbolic execution: an unsat verdict survives a brute-force search', function () {
  const fn = functionNamed(ladder(5), 'ladder');
  const run = Symbolic.execute(fn, { names: ['a'], paths: 400, depth: 80, decide: 'linear' });
  let checked = 0;

  run.paths.filter(function (path) { return path.verdict === 'unsat'; })
    .forEach(function (path) {
      for (let a = -60; a <= 60; a += 1) {
        const model = { a: a };
        const satisfied = path.constraints.every(function (row) {
          return Symbolic.holds(row, model);
        });

        assert.strictEqual(satisfied, false, 'a = ' + a + ' satisfies a leaf called impossible');
      }
      checked += 1;
    });
  assert.strictEqual(checked, 26, 'and there were 26 of them to check');
});

test('symbolic execution: a bounded search reports unknown where a theory reports unsat',
  function () {
    const fn = functionNamed(ladder(5), 'ladder');
    const search = Symbolic.execute(fn, { names: ['a'], paths: 400, depth: 80 });
    const decided = Symbolic.execute(fn,
      { names: ['a'], paths: 400, depth: 80, decide: 'linear' });

    assert.strictEqual(search.feasible, decided.feasible, 'the same leaves are reachable');
    assert.strictEqual(search.paths.filter(function (path) {
      return path.verdict === 'unknown';
    }).length, 26, 'the search can only say it found nothing');
    assert.strictEqual(decided.paths.filter(function (path) {
      return path.verdict === 'unsat';
    }).length, 26, 'the theory solver proves it');
  });

test('symbolic execution: a value outside the fragment is opaque, not approximated', function () {
  const fn = functionNamed('fn scale(a, b) {\n  let p = a * b;\n  let r = 0;\n'
    + '  if (p > 20) { r = 1; } else { r = 2; }\n  return r;\n}\nlet z = scale(2, 3);', 'scale');
  const run = Symbolic.execute(fn, { names: ['a', 'b'], decide: 'linear' });
  const check = StaticLab.verifyPaths(fn, run.paths, { names: ['a', 'b'] });

  assert.ok(run.paths.some(function (path) {
    return path.condition.join(' ').indexOf('opaque') !== -1;
  }), 'the product left the affine fragment and was marked rather than guessed');
  assert.strictEqual(check.missed.length, 1,
    'and one of the two generated inputs does not reach its path, which is the honest failure');
});

test('symbolic execution: the executor reports what it abandoned', function () {
  const fn = functionNamed(ladder(7), 'ladder');
  const run = Symbolic.execute(fn, { names: ['a'], paths: 64, depth: 24, decide: 'linear' });

  assert.strictEqual(run.paths.length, 64, 'the budget was enforced');
  assert.ok(run.truncated > 0, 'and the abandoned paths are counted rather than hidden');
});

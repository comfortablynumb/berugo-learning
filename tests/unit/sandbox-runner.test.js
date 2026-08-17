'use strict';

const test = require('node:test');
const assert = require('node:assert');

const Sandbox = require('../../src/js/core/sandbox.js');
const { createRunner, createInlineBackend } = require('../../src/js/core/runner.js');

function run(request) {
  return Sandbox.execute(request, function () {});
}

test('sandbox: a syntax error is reported as a compile failure, not a crash', function () {
  const result = run({ code: 'function broken( {', entry: 'broken' });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.stage, 'compile');
  assert.match(result.error.message, /.+/);
});

test('sandbox: a missing entry names the function the learner must define', function () {
  const result = run({ code: 'const x = 1;', entry: 'solve' });
  assert.strictEqual(result.stage, 'entry');
  assert.strictEqual(result.error.name, 'MissingEntry');
  assert.match(result.error.message, /solve/);
});

test('sandbox: host globals are shadowed inside compiled code', function () {
  const probe = "function peek() { return [typeof require, typeof document, typeof localStorage, " +
    "typeof fetch, typeof process].join(','); }";
  const result = run({ code: probe, entry: 'peek', mode: 'run' });

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.logs[0].text, '→ undefined,undefined,undefined,undefined,undefined');
});

test('sandbox: shadowing is hygiene, not isolation - globalThis still reaches out', function () {
  // Pinned deliberately. The worker is the isolation boundary; the inline
  // backend runs in the host realm and must never be described as a sandbox.
  const result = run({
    code: 'function peek() { return typeof globalThis; }', entry: 'peek', mode: 'run'
  });
  assert.strictEqual(result.logs[0].text, '→ object');
});

test('sandbox: console output is captured with its level', function () {
  const result = run({
    code: 'function go() { log("hello", 42); log.warn("careful"); log.error("bad"); }',
    entry: 'go',
    mode: 'run'
  });

  assert.deepStrictEqual(result.logs.slice(0, 3).map(function (l) { return [l.level, l.text]; }), [
    ['log', 'hello 42'],
    ['warn', 'careful'],
    ['error', 'bad']
  ]);
});

test('sandbox: tests run against the learner function and report per-test outcomes', function () {
  const result = run({
    code: 'function double(n) { return n * 2; }',
    entry: 'double',
    mode: 'grade',
    tests: [
      { name: 'doubles', src: 'function (fn, api) { api.assert.equal(fn(2), 4); }' },
      { name: 'fails loudly', src: 'function (fn, api) { api.assert.equal(fn(2), 5, "on purpose"); }' }
    ]
  });

  assert.strictEqual(result.total, 2);
  assert.strictEqual(result.passedCount, 1);
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.tests[0].passed, true);
  assert.match(result.tests[1].message, /on purpose: expected 5, got 4/);
});

test('sandbox: a throwing test fails that test only', function () {
  const result = run({
    code: 'function f() { return 1; }',
    entry: 'f',
    mode: 'grade',
    tests: [
      { name: 'explodes', src: 'function () { throw new Error("kaboom"); }' },
      { name: 'still runs', src: 'function (fn, api) { api.assert.equal(fn(), 1); }' }
    ]
  });

  assert.strictEqual(result.tests[0].passed, false);
  assert.match(result.tests[0].message, /kaboom/);
  assert.strictEqual(result.tests[1].passed, true);
});

test('sandbox: instrumented operations are counted, not estimated', function () {
  const result = run({
    code: 'function sortish(values) { for (let i = 0; i < values.length - 1; i += 1) ' +
      'if (ops.cmp(values[i], values[i + 1]) > 0) ops.swap(values, i, i + 1); return values; }',
    entry: 'sortish',
    mode: 'run',
    args: [[3, 1, 2]]
  });

  assert.strictEqual(result.metrics.cmp, 2, 'two comparisons for three elements');
  assert.strictEqual(result.metrics.swap, 2, '[3,1,2] needs both adjacent swaps');
  assert.strictEqual(result.metrics.read, 4, 'each swap reads two slots');
  assert.strictEqual(result.metrics.write, 4, 'and writes two');
  assert.ok(result.metrics.total >= 3);
});

test('sandbox: the step budget stops a runaway instrumented loop', function () {
  const result = run({
    code: 'function spin() { for (;;) ops.count("tick"); }',
    entry: 'spin',
    mode: 'run',
    opsLimit: 1000
  });

  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.error.name, 'StepBudgetExceeded');
});

test('sandbox: the same seed produces the same run', function () {
  const request = { code: 'function draw() { return [rng.int(1000), rng.int(1000)]; }', entry: 'draw', mode: 'run', seed: 42 };
  const a = run(request);
  const b = run(request);
  const c = run(Object.assign({}, request, { seed: 43 }));

  assert.deepStrictEqual(a.logs[0].text, b.logs[0].text, 'same seed, same values');
  assert.notDeepStrictEqual(a.logs[0].text, c.logs[0].text, 'a different seed differs');
});

test('runner: the inline backend admits it enforces no timeout', async function () {
  const runner = createRunner({ backend: createInlineBackend({ sandbox: Sandbox }) });
  const result = await runner.run({ code: 'function f() { return 1; }', entry: 'f', mode: 'run' });

  assert.strictEqual(runner.backendName, 'inline');
  assert.strictEqual(runner.enforcesTimeout, false);
  assert.strictEqual(result.warnings.length, 2);
  assert.match(result.warnings[0], /no wall-clock timeout/);
  assert.match(result.warnings[1], /host realm/);
});

test('runner: hooks receive logs and the final result', async function () {
  const runner = createRunner({ backend: createInlineBackend({ sandbox: Sandbox }) });
  const logs = [];
  let done = null;

  await runner.run(
    { code: 'function f() { log("a"); log("b"); return 1; }', entry: 'f', mode: 'run' },
    { onLog: function (m) { logs.push(m.text); }, onDone: function (r) { done = r; } }
  );

  assert.deepStrictEqual(logs.slice(0, 2), ['a', 'b']);
  assert.strictEqual(done.ok, true);
});

test('runner: a worker-style backend that overruns yields a timeout result', async function () {
  const stubBackend = {
    name: 'stub',
    enforcesTimeout: true,
    run: function (request, onMessage, timeoutMs) {
      return Promise.resolve({
        ok: false, stage: 'timeout', timedOut: true, tests: [], logs: [], metrics: {},
        passedCount: 0, total: 0, durationMs: timeoutMs,
        error: { name: 'Timeout', message: 'run exceeded ' + timeoutMs + ' ms and was terminated' }
      });
    },
    dispose: function () {}
  };

  const runner = createRunner({ backend: stubBackend, timeoutMs: 250 });
  const result = await runner.run({ code: 'function f() { while (true) {} }', entry: 'f' });

  assert.strictEqual(result.timedOut, true);
  assert.strictEqual(result.stage, 'timeout');
  assert.match(result.error.message, /250 ms/);
});

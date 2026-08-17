'use strict';

const test = require('node:test');
const assert = require('node:assert');

const Random = require('../../src/js/utils/random.js');
const Assert = require('../../src/js/utils/assert.js');
const Ops = require('../../src/js/utils/ops-counter.js');
const Format = require('../../src/js/utils/format.js');
const Helpers = require('../../src/js/utils/helpers.js');
const JsHighlight = require('../../src/js/utils/js-highlight.js');

test('random: the same seed replays exactly, a different seed does not', function () {
  const a = Random.seeded(7);
  const b = Random.seeded(7);
  const c = Random.seeded(8);

  const first = Array.from({ length: 20 }, function () { return a.next(); });
  const second = Array.from({ length: 20 }, function () { return b.next(); });
  const third = Array.from({ length: 20 }, function () { return c.next(); });

  assert.deepStrictEqual(first, second);
  assert.notDeepStrictEqual(first, third);
});

test('random: int stays in range and is close to uniform', function () {
  const rng = Random.seeded(11);
  const buckets = new Array(7).fill(0);
  const draws = 70000;

  for (let i = 0; i < draws; i += 1) {
    const value = rng.int(7);
    assert.ok(value >= 0 && value < 7, 'in range');
    buckets[value] += 1;
  }

  const expected = draws / 7;
  const chiSquared = buckets.reduce(function (acc, observed) {
    return acc + Math.pow(observed - expected, 2) / expected;
  }, 0);

  // 6 degrees of freedom, p = 0.001 -> 22.46. A biased modulo mapping fails this.
  assert.ok(chiSquared < 22.46, 'chi-squared was ' + chiSquared.toFixed(2));
});

test('random: shuffle is a permutation and does not mutate its input', function () {
  const rng = Random.seeded(3);
  const source = Helpers.range(50);
  const shuffled = rng.shuffle(source);

  assert.notDeepStrictEqual(shuffled, source, 'order changed');
  assert.deepStrictEqual(shuffled.slice().sort(function (a, b) { return a - b; }), source);
  assert.deepStrictEqual(source, Helpers.range(50), 'input untouched');
});

test('assert: failures carry the expected and the actual value', function () {
  const error = Assert.throws(function () { Assert.equal(41, 42, 'answer'); });
  assert.match(error.message, /answer: expected 42, got 41/);
  assert.strictEqual(error.name, 'AssertionError');
});

test('assert: closeTo respects its tolerance, deepEqual compares structure', function () {
  Assert.closeTo(0.1 + 0.2, 0.3, 1e-12);
  Assert.throws(function () { Assert.closeTo(0.35, 0.3, 1e-12); });
  Assert.deepEqual({ a: [1, 2] }, { a: [1, 2] });
  Assert.throws(function () { Assert.deepEqual({ a: 1 }, { a: 2 }); });
});

test('assert: show truncates long arrays instead of flooding the verdict', function () {
  const text = Assert.show(Helpers.range(100));
  assert.ok(text.length < 120, 'truncated');
  assert.match(text, /…\+88/);
});

test('ops: counts what passes through it and enforces the step budget', function () {
  const ops = Ops.createOps({ limit: 10 });

  ops.cmp(1, 2);
  ops.cmp(2, 1);
  assert.strictEqual(ops.snapshot().cmp, 2);
  assert.strictEqual(ops.total, 2);

  assert.throws(function () {
    for (let i = 0; i < 100; i += 1) ops.count('tick');
  }, /StepBudgetExceeded|step budget/);
});

test('ops: the instrumented view counts reads and writes separately', function () {
  const ops = Ops.createOps({});
  const view = ops.view([5, 6, 7]);

  view.set(0, view.get(2));

  const snapshot = ops.snapshot();
  assert.strictEqual(snapshot.read, 1);
  assert.strictEqual(snapshot.write, 1);
  assert.deepStrictEqual(view.raw(), [7, 6, 7]);
});

test('ops: cmp returns a three-way ordering', function () {
  const ops = Ops.createOps({});
  assert.strictEqual(ops.cmp(1, 2), -1);
  assert.strictEqual(ops.cmp(2, 2), 0);
  assert.strictEqual(ops.cmp(3, 2), 1);
});

test('format: every measured figure carries its unit', function () {
  assert.strictEqual(Format.duration(0.4), '400 µs');
  assert.strictEqual(Format.duration(12.345), '12.3 ms');
  assert.strictEqual(Format.duration(2500), '2.50 s');
  assert.strictEqual(Format.bytes(2048), '2.0 KB');
  assert.strictEqual(Format.percent(0.4567, 2), '45.67%');
  assert.strictEqual(Format.ratio(200, 50), '4.00×');
  assert.match(Format.perRun(3.2, 15), /median of 15/);
  assert.strictEqual(Format.duration(NaN), '—', 'a missing measurement is not zero');
});

test('helpers: escapeHtml neutralises every injection character', function () {
  assert.strictEqual(
    Helpers.escapeHtml('<img src=x onerror="alert(1)">&\'"'),
    '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&amp;&#39;&quot;'
  );
  assert.strictEqual(Helpers.escapeHtml(null), '');
});

test('helpers: median and mad describe a bimodal sample honestly', function () {
  const values = [1, 1, 1, 100, 100, 100];
  assert.strictEqual(Helpers.median(values), 50.5);
  assert.strictEqual(Helpers.mad(values), 49.5, 'a large MAD is the signal that the mean lies');
  assert.ok(Number.isNaN(Helpers.median([])));
});

test('js-highlight: escapes markup while tagging tokens', function () {
  const html = JsHighlight.highlight('const a = "<b>"; // note');

  assert.match(html, /<span class="tok-key">const<\/span>/);
  assert.match(html, /<span class="tok-str">"&lt;b&gt;"<\/span>/, 'string contents are escaped');
  assert.match(html, /<span class="tok-com">\/\/ note<\/span>/);
  assert.ok(html.indexOf('<b>') === -1, 'no raw markup survives');
});

test('js-highlight: an unterminated string does not swallow the rest of the file', function () {
  const html = JsHighlight.highlight('const a = "oops\nconst b = 2;');
  assert.match(html, /tok-key">const<\/span>[\s\S]*tok-key">const<\/span>/);
});

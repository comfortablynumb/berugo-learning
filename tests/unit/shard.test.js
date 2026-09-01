/**
 * The audit shard split.
 *
 * A sharding bug does not fail loudly — it audits fewer sections and stays
 * green, which is the failure this repository has been bitten by often enough
 * to write a test for the partition rather than for the arithmetic. So the
 * central assertion is a partition over the *real* curriculum at every shard
 * count CI might plausibly use: every section in exactly one shard, and the
 * union in curriculum order.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');

const { shardOf } = require('../support/shard.js');
const Curriculum = require('../../src/js/core/curriculum.js');

const COUNTS = [1, 2, 3, 4, 5, 8, 13];

function unionOf(items, total) {
  const seen = [];

  for (let part = 1; part <= total; part += 1) {
    shardOf(items, part + '/' + total).forEach(function (item) { seen.push(item); });
  }
  return seen;
}

test('the shards of the real curriculum partition it, at every plausible count', function () {
  const ids = Curriculum.sections().map(function (section) { return section.id; });

  COUNTS.forEach(function (total) {
    const seen = unionOf(ids, total);

    assert.strictEqual(seen.length, ids.length, total + ' shards cover every section once');
    assert.strictEqual(new Set(seen).size, ids.length, total + ' shards do not overlap');
    assert.deepStrictEqual(seen.slice().sort(), ids.slice().sort(), total + ' shards lose nothing');
  });
});

test('shards stay within one section of each other in size', function () {
  const ids = Curriculum.sections().map(function (section) { return section.id; });

  COUNTS.forEach(function (total) {
    const sizes = [];

    for (let part = 1; part <= total; part += 1) sizes.push(shardOf(ids, part + '/' + total).length);
    assert.ok(Math.max.apply(null, sizes) - Math.min.apply(null, sizes) <= 1,
      'balanced at ' + total + ': ' + sizes.join(','));
  });
});

test('round-robin interleaves, so no shard is one milestone', function () {
  const first = shardOf(['a', 'b', 'c', 'd', 'e', 'f'], '1/3');

  assert.deepStrictEqual(first, ['a', 'd'], 'takes every third item, not the first third');
});

test('more shards than items leaves the extra shards empty rather than failing', function () {
  assert.deepStrictEqual(shardOf(['a', 'b'], '3/4'), []);
});

test('anything that is not a shard spec is not a shard', function () {
  assert.strictEqual(shardOf(['a'], undefined), null, 'no argument audits everything');
  assert.strictEqual(shardOf(['a'], ''), null, 'an empty argument audits everything');
  assert.strictEqual(shardOf(['a'], 'heapsort'), null, 'a section id is a filter, not a shard');
  assert.strictEqual(shardOf(['a'], '1/'), null, 'a half-written spec is not silently a shard');
});

test('a shard outside its range is an error, not an empty pass', function () {
  assert.throws(function () { shardOf(['a', 'b'], '0/2'); }, /out of range/);
  assert.throws(function () { shardOf(['a', 'b'], '3/2'); }, /out of range/);
  assert.throws(function () { shardOf(['a', 'b'], '1/0'); }, /no parts/);
});

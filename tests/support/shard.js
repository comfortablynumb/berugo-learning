'use strict';

/**
 * Splitting an audit across parallel runners.
 *
 * The render audit is the long pole of the suite by a wide margin — booting
 * the app costs about two seconds and then each of the 366 sections costs a
 * couple more, so the fixed cost is nothing and the per-section cost is
 * everything. That is the shape that shards well: N runners each pay the boot
 * once and take a fraction of the sections.
 *
 * The split is ROUND-ROBIN rather than contiguous blocks, and that is the only
 * interesting decision here. Sections are in curriculum order, so contiguous
 * blocks would put one milestone's ten sections — which tend to be alike in
 * cost, because they share a simulator — entirely inside one shard. Round-robin
 * interleaves the tracks, so every shard gets a mix.
 *
 * The property that actually matters is that the shards *partition*: every
 * section in exactly one. A sharding bug does not fail, it silently audits
 * less, which is the worst way for a check to break. `shard.test.js` asserts
 * the partition over a range of sizes rather than trusting the arithmetic.
 */

const SHARD = /^(\d+)\/(\d+)$/;

/**
 * @param {Array} items ordered items to divide
 * @param {string} [spec] "i/n", 1-based; anything else (or nothing) means all
 * @returns {Array|null} the shard's items, or null if `spec` is not a shard
 */
function shardOf(items, spec) {
  const parsed = SHARD.exec(spec || '');

  if (!parsed) return null;

  const index = Number(parsed[1]) - 1;
  const total = Number(parsed[2]);

  if (total < 1) throw new Error('shard: "' + spec + '" has no parts');
  if (index < 0 || index >= total) throw new Error('shard: "' + spec + '" is out of range');

  return items.filter(function (item, position) { return position % total === index; });
}

module.exports = { shardOf: shardOf };

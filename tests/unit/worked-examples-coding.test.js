'use strict';

/**
 * Every figure the M22.1-M22.4 content quotes, recomputed from the harnesses
 * and then checked against the prose.
 *
 * The section controllers are not imported; the calls below reproduce what
 * they make at their default control settings, which is the contract this
 * suite is really pinning down - if a default moves, the prose is wrong and
 * this fails.
 */

const test = require('node:test');
const assert = require('node:assert');

const CodingLab = require('../../src/js/machines/coding-lab.js');

require('../../src/js/content/concepts-coding.js');
require('../../src/js/content/examples-coding.js');
require('../../src/js/content/concepts-dictionaries.js');
require('../../src/js/content/examples-dictionaries.js');
const prose = require('../support/worked-example-prose.js');

/* --------------------------------------------------------- 22.1 entropy */

test('information-and-entropy: the profile at the demo default', function () {
  const study = CodingLab.entropyStudy({ corpus: 'English text', size: 3000, maxOrder: 4 });

  assert.strictEqual(study.bytes, 3000);
  assert.strictEqual(study.distinct, 30);
  assert.strictEqual(prose.fixed(study.rows[0].bits, 4), '4.5623');
  assert.strictEqual(prose.fixed(study.rows[1].bits, 4), '1.9578');
  assert.strictEqual(prose.fixed(study.rows[2].bits, 4), '0.6345');
  assert.strictEqual(prose.fixed(study.rows[3].bits, 4), '0.2235');
  assert.strictEqual(prose.fixed(study.rows[4].bits, 4), '0.1225');
  assert.strictEqual(study.rows[0].floorBytes, 1711);
  assert.strictEqual(study.rows[2].floorBytes, 238);
  assert.strictEqual(prose.fixed(study.rows[1].perContext, 1), '100.0');
  assert.strictEqual(prose.fixed(study.rows[4].perContext, 1), '17.0');

  prose.quotes('information-and-entropy',
    ['4.5623', '1.9578', '0.6345', '0.2235', '0.1225', '1 711', '238', '30', '3 000']);
});

test('information-and-entropy: the order-2 estimate on random bytes is memorisation', function () {
  const rows = CodingLab.entropyByCorpus({ size: 3000 });
  const random = rows.filter(function (row) { return row.corpus === 'random bytes'; })[0];
  const logs = rows.filter(function (row) { return row.corpus === 'JSON logs'; })[0];
  const unusable = rows.filter(function (row) { return row.perContext < 5; });

  assert.strictEqual(prose.fixed(random.order0, 3), '7.936');
  assert.strictEqual(prose.fixed(random.order2, 3), '0.036');
  assert.strictEqual(random.contexts, 2944);
  assert.strictEqual(prose.fixed(random.perContext, 1), '1.0');
  assert.strictEqual(unusable.length, 3, 'three of the seven corpora fail the reliability check');
  assert.strictEqual(rows.length, 7);
  assert.strictEqual(prose.fixed(logs.redundancy, 3), '4.219');

  prose.quotes('information-and-entropy',
    ['0.036', '2 944', '1.0', '3 of its 7', '7.936', '4.219']);
});

test('information-and-entropy: the estimator against six closed forms', function () {
  const check = CodingLab.estimatorCheck({ length: 20000 });
  const worst = check.rows.reduce(function (most, row) {
    return row.error > most.error ? row : most;
  }, check.rows[0]);

  assert.strictEqual(check.rows.length, 6);
  assert.strictEqual(prose.fixed(worst.error, 4), '0.0110');
  assert.ok(/Markov 8/.test(worst.source), 'the worst row is the 8-state chain');
  assert.strictEqual(prose.fixed(check.rows[0].measured, 4), '1.0000');
  assert.strictEqual(prose.fixed(check.rows[2].truth, 4), '0.4690');
  assert.strictEqual(prose.fixed(check.rows[2].measured, 4), '0.4780');
  assert.strictEqual(prose.fixed(check.rows[4].truth, 4), '1.0389');
  assert.strictEqual(prose.fixed(check.rows[4].measured, 4), '1.0348');

  prose.quotes('information-and-entropy',
    ['0.0110', '1.0000', '0.4690', '0.4780', '1.0389', '1.0348', '20 000']);
});

/* --------------------------------------------------------- 22.2 Huffman */

test('prefix-codes-and-huffman: the code, its gap and its Kraft sum', function () {
  const study = CodingLab.huffmanStudy({ corpus: 'English text', size: 3000 });

  assert.strictEqual(prose.fixed(study.bitsPerSymbol, 4), '4.6173');
  assert.strictEqual(prose.fixed(study.entropy, 4), '4.5623');
  assert.strictEqual(prose.fixed(study.overEntropy, 4), '0.0550');
  assert.strictEqual(prose.fixed(study.bitsPerSymbol / study.entropy, 4), '1.0121');
  assert.strictEqual(prose.fixed(study.kraft, 4), '1.0000');
  assert.strictEqual(study.alphabet, 30);
  assert.strictEqual(study.roundTrip, true);

  const space = study.codes.filter(function (row) { return row.label === 'space'; })[0];

  assert.strictEqual(space.code, '000');
  assert.strictEqual(prose.fixed(space.waste, 2), '0.53');

  prose.quotes('prefix-codes-and-huffman',
    ['4.6173', '4.5623', '0.0550', '1.0121', '1.0000', '30', '0.53']);
});

test('prefix-codes-and-huffman: the skew sweep pins Huffman at one bit', function () {
  const sweep = CodingLab.skewSweep({});
  const row = function (share) {
    return sweep.filter(function (entry) { return entry.share === share; })[0];
  };

  sweep.forEach(function (entry) {
    assert.strictEqual(prose.fixed(entry.huffmanBits, 4), '1.0000',
      'Huffman must be exactly one bit at every skew');
  });
  assert.strictEqual(prose.fixed(row(0.5).entropy, 4), '1.0000');
  assert.strictEqual(prose.fixed(row(0.1).entropy, 4), '0.4690');
  assert.strictEqual(prose.fixed(row(0.01).entropy, 4), '0.0808');
  assert.strictEqual(prose.fixed(row(0.001).entropy, 4), '0.0114');
  assert.strictEqual(prose.fixed(row(0.01).waste, 2), '12.38');
  assert.strictEqual(prose.fixed(row(0.001).waste, 2), '87.66');
  assert.strictEqual(prose.fixed(row(0.1).waste, 2), '2.13');

  prose.quotes('prefix-codes-and-huffman',
    ['0.4690', '0.0808', '0.0114', '12.38', '87.66', '2.13']);
});

test('prefix-codes-and-huffman: the table cost, three ways', function () {
  const study = CodingLab.huffmanStudy({ corpus: 'English text', size: 3000 });

  assert.strictEqual(study.table.treeBits, 299);
  assert.strictEqual(study.table.canonicalBits, 1024);
  assert.strictEqual(study.table.runLengthBits, 178);
  assert.strictEqual(study.table.runLengthBytes, 23);
  assert.strictEqual(study.table.best, 'run-length');
  assert.strictEqual(study.table.canonicalWins, false,
    'at this density the plain canonical form LOSES to the explicit tree');
  assert.strictEqual(prose.fixed(study.table.density * 100, 1), '11.7');

  prose.quotes('prefix-codes-and-huffman', ['299', '1 024', '178', '23', '11.7%']);
});

/* ---------------------------------------------- 22.3 arithmetic and ANS */

test('arithmetic-coding-and-ans: three coders against the information content', function () {
  const study = CodingLab.arithmeticStudy({ corpus: 'English text', size: 3000 });

  assert.strictEqual(study.arithmetic.bits, 13688);
  assert.strictEqual(prose.fixed(study.idealBits, 1), '13687.0');
  assert.strictEqual(prose.fixed(study.arithmetic.overIdeal, 2), '1.03');
  assert.strictEqual(study.arithmetic.roundTrip, true);
  assert.strictEqual(study.rans.bits, 13712);
  assert.strictEqual(prose.fixed(study.rans.overIdeal, 1), '25.0');
  assert.strictEqual(study.rans.roundTrip, true);
  assert.strictEqual(study.huffman.bits, 13852);
  assert.strictEqual(prose.fixed(study.huffman.overIdeal, 1), '165.0');
  assert.strictEqual(study.arithmetic.maxPending, 10);
  assert.strictEqual(prose.fixed(study.adaptive.bitsPerSymbol, 4), '4.5971');

  prose.quotes('arithmetic-coding-and-ans',
    ['13 688', '13 687.0', '1.03', '13 712', '25.0', '13 852', '165.0', '10', '4.5971']);
});

test('arithmetic-coding-and-ans: the interval walk for one short word', function () {
  const walk = CodingLab.intervalWalk('bananas');
  const last = walk.steps[walk.steps.length - 1];

  assert.strictEqual(walk.steps.length, 7);
  assert.strictEqual(last.width.toExponential(2), '1.31e-4');
  assert.strictEqual(prose.fixed(last.bits, 2), '12.90');
  assert.strictEqual(walk.bits, 14);
  for (let i = 1; i < walk.steps.length; i += 1) {
    assert.ok(walk.steps[i].width < walk.steps[i - 1].width,
      'every symbol must narrow the interval');
  }

  prose.quotes('arithmetic-coding-and-ans', ['1.31e-4', '12.90', '14 bits']);
});

/* ---------------------------------------------------- 22.4 dictionaries */

test('dictionary-compression: the depth ladder at the demo default', function () {
  const study = CodingLab.dictionaryStudy({ corpus: 'mixed prose', size: 6000 });
  const at = function (depth) {
    return study.depths.filter(function (row) { return row.depth === depth; })[0];
  };

  assert.strictEqual(study.bytes, 6000);
  assert.strictEqual(at(1).bytes, 3985);
  assert.strictEqual(prose.fixed(at(1).ratio, 3), '1.506');
  assert.strictEqual(prose.fixed(at(1).comparisonsPerByte, 2), '0.22');
  assert.strictEqual(at(4).bytes, 3615);
  assert.strictEqual(prose.fixed(at(4).ratio, 3), '1.660');
  assert.strictEqual(at(64).bytes, 3245);
  assert.strictEqual(prose.fixed(at(64).ratio, 3), '1.849');
  assert.strictEqual(prose.fixed(at(64).comparisonsPerByte, 2), '2.28');
  assert.strictEqual(at(1).matchedBytes, 5648);
  assert.strictEqual(at(64).matchedBytes, 5668);
  assert.strictEqual(at(1).matches, 1305);
  assert.strictEqual(at(64).matches, 1044);
  assert.strictEqual(prose.fixed(at(64).comparisonsPerByte / at(1).comparisonsPerByte, 1), '10.5');
  assert.strictEqual(prose.fixed((at(64).ratio / at(1).ratio - 1) * 100, 1), '22.8');

  prose.quotes('dictionary-compression',
    ['3 985', '1.506', '0.22', '3 615', '1.660', '3 245', '1.849', '2.28', '5 648', '5 668',
      '1 305', '1 044', '10.5', '22.8%']);
});

test('dictionary-compression: the window sweep and the two families', function () {
  const study = CodingLab.dictionaryStudy({ corpus: 'mixed prose', size: 6000 });
  const window = function (size) {
    return study.windows.filter(function (row) { return row.window === size; })[0];
  };

  assert.strictEqual(prose.fixed(window(64).ratio, 3), '1.163');
  assert.strictEqual(prose.fixed(window(256).ratio, 3), '1.426');
  assert.strictEqual(prose.fixed(window(1024).ratio, 3), '1.728');
  assert.strictEqual(prose.fixed(window(4096).ratio, 3), '1.838');

  assert.strictEqual(study.base.bytes, 3265);
  assert.strictEqual(prose.fixed(study.base.ratio, 3), '1.838');
  assert.strictEqual(study.base.matches, 1051);
  assert.strictEqual(study.base.literals, 333);
  assert.strictEqual(prose.fixed(study.base.matchedBytes / study.bytes * 100, 1), '94.5');
  assert.strictEqual(study.lazy.bytes, 3121);
  assert.strictEqual(prose.fixed(study.lazy.ratio, 3), '1.922');
  assert.strictEqual(prose.fixed((study.lazy.gain - 1) * 100, 2), '4.61');
  assert.strictEqual(study.lzw.bytes, 2811);
  assert.strictEqual(prose.fixed(study.lzw.ratio, 3), '2.134');
  assert.strictEqual(study.lzw.entries, 1873);
  assert.strictEqual(study.lzw.codeBits, 12);
  assert.ok(study.lzw.ratio > study.lazy.ratio,
    'LZW beats a bare LZSS here, and the prose says so rather than explaining it away');
  assert.strictEqual(prose.fixed(study.lzw.ratio / study.lazy.ratio, 2), '1.11');
  assert.ok(study.base.roundTrip && study.lazy.roundTrip && study.lzw.roundTrip);

  prose.quotes('dictionary-compression',
    ['1.163', '1.426', '1.728', '1.838', '3 265', '1 051', '333', '94.5%', '3 121', '1.922',
      '4.61', '2 811', '2.134', '1 873', '1.11']);
});

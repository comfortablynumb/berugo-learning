'use strict';

/**
 * Every figure the M22.5-M22.11 content quotes, recomputed from the harnesses
 * and then checked against the prose.
 *
 * The section controllers are not imported; the calls below reproduce what
 * they make at their default control settings, which is the contract this
 * suite is really pinning down - if a default moves, the prose is wrong and
 * this fails.
 */

const test = require('node:test');
const assert = require('node:assert');

const CodecLab = require('../../src/js/machines/codec-lab.js');
const CodingLab = require('../../src/js/machines/coding-lab.js');
const LossyLab = require('../../src/js/machines/lossy-lab.js');
const ColumnarLab = require('../../src/js/machines/columnar-lab.js');
const IntegrityLab = require('../../src/js/machines/integrity-lab.js');

require('../../src/js/content/concepts-dictionaries.js');
require('../../src/js/content/examples-dictionaries.js');
require('../../src/js/content/concepts-media.js');
require('../../src/js/content/examples-media.js');
require('../../src/js/content/concepts-integrity.js');
require('../../src/js/content/examples-integrity.js');
const prose = require('../support/worked-example-prose.js');

function ratioOf(row, name) {
  return row.codecs.filter(function (codec) { return codec.name.indexOf(name) === 0; })[0].ratio;
}

function corpusRow(bake, name) {
  return bake.rows.filter(function (row) { return row.corpus === name; })[0];
}

/* ------------------------------------------------ 22.5 general codecs */

test('general-purpose-codecs: the bake-off, and the winner changing', function () {
  const bake = CodecLab.bakeOff({ size: 3000 });

  assert.strictEqual(bake.rows.length, 7, 'seven corpora');
  const english = corpusRow(bake, 'English text');
  const logs = corpusRow(bake, 'JSON logs');
  const prosaic = corpusRow(bake, 'mixed prose');
  const random = corpusRow(bake, 'random bytes');

  assert.strictEqual(prose.fixed(ratioOf(english, 'DEFLATE'), 3), '15.625');
  assert.strictEqual(prose.fixed(ratioOf(english, 'LZSS'), 3), '13.453');
  assert.strictEqual(prose.fixed(ratioOf(english, 'Huffman'), 3), '1.710');
  assert.strictEqual(prose.fixed(ratioOf(logs, 'DEFLATE'), 3), '24.793');
  assert.strictEqual(prose.fixed(ratioOf(logs, 'LZSS'), 3), '21.583');
  assert.strictEqual(prose.fixed(ratioOf(prosaic, 'BWT'), 3), '2.841');
  assert.strictEqual(prose.fixed(ratioOf(prosaic, 'DEFLATE'), 3), '2.027');
  assert.strictEqual(prose.fixed(ratioOf(prosaic, 'LZSS'), 3), '1.740');
  assert.strictEqual(prose.fixed(ratioOf(random, 'DEFLATE'), 3), '0.998');
  assert.strictEqual(prose.fixed(ratioOf(random, 'LZSS'), 3), '0.889');

  const winners = {};

  bake.rows.forEach(function (row) {
    const best = row.codecs.reduce(function (winner, codec) {
      return codec.ratio > winner.ratio ? codec : winner;
    }, row.codecs[0]);

    winners[best.name] = true;
  });
  assert.strictEqual(Object.keys(winners).length, 2, 'two different codecs win at least one');

  prose.quotes('general-purpose-codecs',
    ['15.625', '13.453', '1.710', '24.793', '21.583', '2.841', '2.027', '1.740', '0.998',
      '0.889']);
});

test('general-purpose-codecs: every round-trip verified, including the degenerate inputs', function () {
  const bake = CodecLab.bakeOff({ size: 3000 });
  const edges = CodecLab.edgeCases();
  let checked = 0;
  let passed = 0;

  bake.rows.concat(edges).forEach(function (row) {
    row.codecs.forEach(function (codec) {
      checked += 1;
      if (codec.roundTrip) passed += 1;
    });
  });
  assert.strictEqual(checked, 66, 'seven corpora plus four edge cases, six codecs each');
  assert.strictEqual(passed, 66, 'every codec must decode its own output');

  const skew = edges.filter(function (entry) { return entry.name.indexOf('99/1') >= 0; })[0];
  const identical = edges.filter(function (entry) {
    return entry.name.indexOf('all identical') >= 0;
  })[0];

  assert.strictEqual(skew.codecs[0].bits, 1033, 'Huffman on a 99/1 source');
  assert.strictEqual(skew.codecs[1].bits, 106, 'the arithmetic coder on the same');
  assert.strictEqual(identical.codecs[0].bits, 1026, 'Huffman on a zero-entropy source');
  assert.strictEqual(identical.codecs[1].bits, 14, 'and the arithmetic coder on it');
  assert.strictEqual(edges[0].codecs[0].bits, 0, 'empty input produces empty output');

  prose.quotes('general-purpose-codecs', ['66 of 66', '1 033', '106', '1 026', '14']);
});

test('general-purpose-codecs: the block decision and the stored-block bound', function () {
  const blocks = CodecLab.blockStudy({ size: 3000 });
  const stored = blocks.filter(function (row) { return row.choice === 'stored'; });

  assert.strictEqual(blocks[0].overhead, 5, 'five bytes per stored block');
  assert.strictEqual(stored.length, 2, 'both incompressible corpora choose stored');
  stored.forEach(function (row) {
    assert.ok(row.corpus === 'random bytes' || row.corpus === 'already compressed',
      'and only those: ' + row.corpus);
  });
  blocks.forEach(function (row) {
    assert.strictEqual(row.roundTrip, true, row.corpus + ' failed to round-trip');
  });
  assert.strictEqual(corpusRow({ rows: [] }, 'x') === undefined, true);

  prose.quotes('general-purpose-codecs', ['five bytes', 'stored block']);
});

/* ------------------------------------------------- 22.6 context models */

test('context-modelling: the plain model turns around and PPM does not', function () {
  const study = CodingLab.contextStudy({ corpus: 'English text', size: 1500, maxOrder: 4 });
  const order = function (k) {
    return study.orders.filter(function (row) { return row.order === k; })[0];
  };

  assert.strictEqual(study.alphabet, 30);
  assert.strictEqual(prose.fixed(order(0).bitsPerSymbol, 4), '4.6176');
  assert.strictEqual(prose.fixed(order(1).bitsPerSymbol, 4), '3.1377');
  assert.strictEqual(prose.fixed(order(2).bitsPerSymbol, 4), '3.0088');
  assert.strictEqual(prose.fixed(order(3).bitsPerSymbol, 4), '3.0775');
  assert.strictEqual(prose.fixed(order(4).bitsPerSymbol, 4), '3.1418');
  assert.ok(order(3).bitsPerSymbol > order(2).bitsPerSymbol,
    'the plain model must get WORSE past order 2 — that is the finding');
  assert.strictEqual(prose.fixed(order(1).perContext, 1), '48.4');
  assert.strictEqual(prose.fixed(order(2).perContext, 1), '13.4');
  assert.strictEqual(prose.fixed(order(4).perContext, 1), '8.3');
  assert.strictEqual(order(4).contexts, 180);

  prose.quotes('context-modelling',
    ['4.6176', '3.1377', '3.0088', '3.0775', '3.1418', '48.4', '13.4', '8.3', '180']);
});

test('context-modelling: PPM keeps improving, and the mixture beats the best order', function () {
  const study = CodingLab.contextStudy({ corpus: 'English text', size: 1500, maxOrder: 4 });
  const ppm = function (k) {
    return study.ppm.filter(function (row) { return row.maxOrder === k; })[0];
  };

  assert.strictEqual(prose.fixed(ppm(1).bitsPerSymbol, 4), '2.4656');
  assert.strictEqual(prose.fixed(ppm(2).bitsPerSymbol, 4), '1.4576');
  assert.strictEqual(prose.fixed(ppm(3).bitsPerSymbol, 4), '1.1604');
  assert.strictEqual(prose.fixed(ppm(4).bitsPerSymbol, 4), '1.1009');
  assert.strictEqual(prose.fixed(ppm(4).escapesPerSymbol, 4), '0.1027');
  assert.strictEqual(prose.fixed(ppm(1).escapesPerSymbol, 4), '0.0727');
  assert.strictEqual(prose.fixed(ppm(4).bitsPerSymbol / 3.1418, 3), '0.350');

  const best = study.orders.reduce(function (winner, row) {
    return row.bitsPerSymbol < winner.bitsPerSymbol ? row : winner;
  }, study.orders[0]);

  assert.strictEqual(prose.fixed(study.mixed.bitsPerSymbol, 3), '2.996');
  assert.ok(study.mixed.bitsPerSymbol < best.bitsPerSymbol,
    'the mixture must beat the best single order');
  const dominant = study.mixed.weights.indexOf(Math.max.apply(null, study.mixed.weights));

  assert.strictEqual(study.mixed.orders[dominant], 2, 'order 2 ends up carrying the prediction');
  assert.strictEqual(prose.fixed(study.mixed.weights[dominant] * 100, 1), '76.6');

  prose.quotes('context-modelling',
    ['2.4656', '1.4576', '1.1604', '1.1009', '0.1027', '0.0727', '0.350', '2.996', '0.2500',
      '76.6%']);
});

/* ------------------------------------------------------ 22.7 transform */

test('transform-compression: the transform changes the entropy by nothing at all', function () {
  const study = CodingLab.transformStudy({ corpus: 'English text', size: 2000 });
  const stage = function (name) {
    return study.stages.filter(function (row) { return row.name === name; })[0];
  };

  assert.strictEqual(prose.fixed(stage('input').bits, 4), '4.5612');
  assert.strictEqual(prose.fixed(stage('after BWT').bits, 4), '4.5612');
  assert.strictEqual(stage('after BWT').bits, stage('input').bits,
    'not merely equal to four places — identical, because it is a permutation');
  assert.strictEqual(prose.fixed(stage('after MTF').bits, 4), '0.7405');
  assert.strictEqual(prose.fixed(stage('after RLE').bits, 4), '4.0861');
  assert.strictEqual(stage('input').bytes, 1141);
  assert.strictEqual(stage('after MTF').bytes, 186);
  assert.strictEqual(stage('after RLE').bytes, 151);
  assert.strictEqual(stage('after RLE').length, 294);
  assert.strictEqual(prose.fixed(stage('input').bits / stage('after MTF').bits, 2), '6.16');
  assert.strictEqual(prose.fixed(study.zeroShare * 100, 1), '92.6');
  assert.strictEqual(study.roundTrip, true);

  prose.quotes('transform-compression',
    ['4.5612', '0.7405', '4.0861', '1 141', '186', '151', '294', '6.16', '92.6%']);
});

test('transform-compression: the block sweep', function () {
  const study = CodingLab.transformStudy({ corpus: 'English text', size: 2000 });
  const block = function (size) {
    return study.blocks.filter(function (row) { return row.block === size; })[0];
  };

  assert.strictEqual(prose.fixed(block(64).ratio, 3), '1.739');
  assert.strictEqual(prose.fixed(block(256).ratio, 3), '2.079');
  assert.strictEqual(prose.fixed(block(1024).ratio, 3), '6.024');
  assert.strictEqual(prose.fixed(block(4096).ratio, 3), '10.753');
  assert.strictEqual(prose.fixed(block(64).zeroShare * 100, 1), '10.1');
  assert.strictEqual(prose.fixed(block(256).zeroShare * 100, 1), '40.8');
  assert.strictEqual(prose.fixed(block(1024).zeroShare * 100, 1), '85.2');
  assert.strictEqual(prose.fixed(block(4096).zeroShare * 100, 1), '92.6');

  prose.quotes('transform-compression',
    ['1.739', '2.079', '6.024', '10.753', '10.1%', '40.8%', '85.2%']);
});

/* ------------------------------------------------------------ 22.8 lossy */

test('lossy-compression: the quality ladder', function () {
  const study = LossyLab.qualityStudy({ size: 64 });
  const at = function (quality) {
    return study.rows.filter(function (row) { return row.quality === quality; })[0];
  };

  assert.strictEqual(at(10).bytes, 225);
  assert.strictEqual(prose.fixed(at(10).ratio, 2), '18.20');
  assert.strictEqual(prose.fixed(at(10).db, 2), '27.21');
  assert.strictEqual(prose.fixed(at(10).ssim, 4), '0.8207');
  assert.strictEqual(at(10).nonZero, 168);
  assert.strictEqual(at(50).bytes, 537);
  assert.strictEqual(prose.fixed(at(50).ratio, 2), '7.63');
  assert.strictEqual(prose.fixed(at(50).db, 2), '32.09');
  assert.strictEqual(prose.fixed(at(50).ssim, 4), '0.9420');
  assert.strictEqual(at(50).nonZero, 449);
  assert.strictEqual(at(90).bytes, 1063);
  assert.strictEqual(prose.fixed(at(90).db, 2), '41.71');
  assert.strictEqual(prose.fixed(at(90).ssim, 4), '0.9936');
  assert.strictEqual(at(100).bytes, 1820);
  assert.strictEqual(prose.fixed(at(100).db, 2), '66.62');
  assert.ok(at(100).db !== Infinity, 'quality 100 is not lossless');
  assert.strictEqual(at(100).nonZero, 1395);
  assert.strictEqual(at(10).coefficients, 4096);

  prose.quotes('lossy-compression',
    ['225', '18.20', '27.21', '0.8207', '168', '537', '7.63', '32.09', '0.9420', '449',
      '1 063', '41.71', '0.9936', '1 820', '66.62', '1 395', '4 096']);
});

test('lossy-compression: aligned re-encoding is a fixed point, shifted is not', function () {
  const study = LossyLab.generationStudy({ size: 64, quality: 50, rounds: 6 });

  assert.strictEqual(study.aligned[0].changed, 3341);
  study.aligned.slice(1).forEach(function (row) {
    assert.strictEqual(row.changed, 0,
      'aligned round ' + row.round + ' must change nothing');
    assert.strictEqual(prose.fixed(row.db, 2), '32.09', 'and the PSNR must not move');
  });
  assert.strictEqual(prose.fixed(study.shifted[0].db, 2), '34.16');
  assert.strictEqual(prose.fixed(study.shifted[1].db, 2), '31.23');
  assert.strictEqual(prose.fixed(study.shifted[4].db, 2), '30.67');
  assert.strictEqual(prose.fixed(study.shifted[4].ssim, 4), '0.8872');
  study.shifted.forEach(function (row) {
    assert.ok(row.changed > 0, 'a shifted re-encode must keep changing pixels');
  });

  prose.quotes('lossy-compression', ['3 341', '34.16', '31.23', '30.67', '0.8872']);
});

/* --------------------------------------------------------- 22.9 columnar */

test('domain-specific-compression: the integer columns and what sorting is worth', function () {
  const columns = ColumnarLab.integerStudy({ count: 2000, seed: 11 });
  const column = function (name) {
    return columns.filter(function (row) { return row.column === name; })[0];
  };
  const bytesOf = function (row, encoding) {
    return row.rows.filter(function (entry) { return entry.name === encoding; })[0].bytes;
  };
  const sorted = column('timestamps (sorted)');
  const shuffled = column('timestamps (shuffled)');

  assert.strictEqual(bytesOf(sorted, 'raw 64-bit'), 16000);
  assert.strictEqual(bytesOf(sorted, 'varint'), 10000);
  assert.strictEqual(bytesOf(sorted, 'delta + varint'), 2004);
  assert.strictEqual(bytesOf(sorted, 'delta + bit-packed'), 8000);
  assert.strictEqual(bytesOf(sorted, 'delta + frame-of-reference'), 1278);
  assert.strictEqual(bytesOf(sorted, 'delta + Simple-8b'), 1080);
  assert.strictEqual(bytesOf(shuffled, 'delta + varint'), 3961);
  assert.strictEqual(bytesOf(shuffled, 'delta + frame-of-reference'), 3836);
  assert.strictEqual(bytesOf(shuffled, 'delta + Simple-8b'), 3864);
  assert.strictEqual(bytesOf(sorted, 'varint'), bytesOf(shuffled, 'varint'),
    'a plain varint is order-blind, which makes the comparison fair');

  const sorting = ColumnarLab.sortingStudy({ count: 2000, seed: 11 });
  const best = sorting.rows.reduce(function (most, row) {
    return row.gain > most.gain ? row : most;
  }, sorting.rows[0]);

  assert.strictEqual(prose.fixed(best.gain, 2), '3.59');
  assert.strictEqual(best.name, 'delta + Simple-8b');
  assert.strictEqual(best.sortedBytes, 1080);
  assert.strictEqual(best.shuffledBytes, 3880);

  prose.quotes('domain-specific-compression',
    ['16 000', '10 000', '2 004', '8 000', '1 278', '1 080', '3 961', '3 836', '3 864', '3.59']);
});

test('domain-specific-compression: Gorilla tracks the moving mantissa bits', function () {
  const rows = ColumnarLab.floatStudy({ count: 2000 });
  const series = function (name) {
    return rows.filter(function (row) { return row.name === name; })[0];
  };

  assert.strictEqual(prose.fixed(series('random walk, full precision').ratio, 2), '1.32');
  assert.strictEqual(prose.fixed(series('rounded to 0.1').ratio, 2), '9.23');
  assert.strictEqual(prose.fixed(series('rounded to 1').ratio, 2), '59.93');
  assert.strictEqual(prose.fixed(series('monotone counter').ratio, 2), '6.16');
  assert.strictEqual(prose.fixed(series('constant').ratio, 2), '62.02');
  assert.strictEqual(prose.fixed(series('uniform noise').ratio, 2), '1.34');
  assert.strictEqual(series('rounded to 0.1').bytes, 1733);
  assert.strictEqual(prose.fixed(series('random walk, full precision').bitsPerValue, 2), '48.33');
  assert.strictEqual(prose.fixed(series('rounded to 0.1').bitsPerValue, 2), '6.93');
  rows.forEach(function (row) {
    assert.strictEqual(row.exact, true, row.name + ' did not round-trip exactly');
  });

  prose.quotes('domain-specific-compression',
    ['1.32', '9.23', '59.93', '62.02', '1.34', '1 733', '48.33', '6.93', '6 of 6']);
});

/* ------------------------------------------------------- 22.10 detection */

test('checksums-and-crc: the detection table and the published vectors', function () {
  const detect = IntegrityLab.detectionStudy({});
  const row = function (name) {
    return detect.rows.filter(function (entry) { return entry.name === name; })[0];
  };

  detect.rows.forEach(function (entry) {
    assert.strictEqual(prose.fixed(entry.single * 100, 1), '100.0',
      entry.name + ' missed a single-bit flip');
  });
  assert.strictEqual(prose.fixed(row('byte sum').double * 100, 1), '95.1');
  assert.strictEqual(prose.fixed(row('parity').double * 100, 1), '0.0');
  assert.strictEqual(prose.fixed(row('Internet checksum').double * 100, 1), '97.3');
  assert.strictEqual(prose.fixed(row('byte sum').reorder * 100, 1), '0.0');
  assert.strictEqual(prose.fixed(row('Internet checksum').reorder * 100, 1), '50.3');
  assert.strictEqual(prose.fixed(row('Fletcher-16').reorder * 100, 1), '99.2');
  assert.strictEqual(prose.fixed(row('CRC-32').reorder * 100, 1), '100.0');

  const vectors = IntegrityLab.vectorCheck();

  assert.strictEqual(vectors.length, 5);
  vectors.forEach(function (entry) {
    assert.strictEqual(entry.matches, true, 'vector "' + entry.input + '" did not match');
  });
  assert.strictEqual(vectors[3].table.toString(16), 'cbf43926');

  prose.quotes('checksums-and-crc',
    ['100.0%', '95.1%', '0.0%', '97.3%', '50.3%', '99.2%', '5 of 5', 'cbf43926']);
});

test('checksums-and-crc: the burst search and the forgery', function () {
  const bursts = IntegrityLab.burstStudy({ maxLength: 34, exhaustiveTo: 9 });
  const row = function (name) {
    return bursts.rows.filter(function (entry) { return entry.name === name; })[0];
  };

  assert.strictEqual(row('byte sum').noneMissed, 8);
  assert.strictEqual(row('byte sum').firstMiss, 9);
  assert.strictEqual(prose.fixed(row('byte sum').firstMissRate * 100, 2), '99.22');
  assert.strictEqual(row('Internet checksum').noneMissed, 16);
  assert.strictEqual(row('Internet checksum').firstMiss, 17);
  assert.strictEqual(prose.fixed(row('Internet checksum').firstMissRate * 100, 2), '98.44');
  assert.strictEqual(prose.fixed(row('Fletcher-16').firstMissRate * 100, 2), '99.80');
  assert.strictEqual(row('CRC-32').firstMiss, null, 'CRC-32 misses nothing in range');
  assert.strictEqual(row('CRC-32').noneMissed, 34);
  assert.strictEqual(row('CRC-32').guaranteed, 9,
    'the exhaustive search stops at 9 by construction');

  const forge = IntegrityLab.forgeryStudy({});

  assert.strictEqual(forge.found, true);
  assert.strictEqual(forge.suffixBytes, 4);
  assert.strictEqual(forge.matches, true);

  prose.quotes('checksums-and-crc',
    ['99.22%', '98.44%', '99.80%', '9 bits', '34 bits', '4 appended bytes', '17']);
});

/* ------------------------------------------------------ 22.11 correction */

test('error-correction: Hamming and SECDED, checked exhaustively', function () {
  const study = IntegrityLab.hammingStudy();

  assert.strictEqual(study.singleCorrected, 112);
  assert.strictEqual(study.singleTrials, 112);
  assert.strictEqual(study.doubleDetected, 448);
  assert.strictEqual(study.doubleTrials, 448);
  assert.strictEqual(study.dataWords, 16);
  study.syndromes.forEach(function (entry) {
    assert.strictEqual(entry.syndrome, entry.flipped,
      'the syndrome must equal the flipped position');
  });

  prose.quotes('error-correction', ['112 of 112', '448 of 448', '16']);
});

test('error-correction: the limits, observed rather than cited', function () {
  const rs = IntegrityLab.reedSolomonStudy({ k: 10, parity: 6 });
  const erasures = IntegrityLab.erasureStudy({ k: 10, parity: 6 });

  assert.strictEqual(rs.n, 16);
  assert.strictEqual(rs.limit, 3);
  rs.rows.forEach(function (row) {
    if (row.errors === 0) {
      assert.strictEqual(row.status, 'clean');
      return;
    }
    if (row.withinLimit) {
      assert.strictEqual(row.status, 'corrected', row.errors + ' errors should be corrected');
      assert.strictEqual(row.recovered, true);
      return;
    }
    assert.strictEqual(row.status, 'beyond-limit', row.errors + ' errors must be refused');
  });
  const repaired = erasures.rows.filter(function (row) { return row.repaired; });

  assert.strictEqual(repaired.length, 7, 'zero through six erasures, all repaired');
  assert.strictEqual(erasures.rows[7].repaired, false, 'the seventh is refused');
  assert.strictEqual(repaired.length - 1, rs.limit * 2,
    'erasures are worth exactly twice as much parity as errors');

  prose.quotes('error-correction', ['6 erasures', '10 data symbols', 'beyond-limit']);
});

test('error-correction: erasure coding against replication, with the rebuild cost', function () {
  const rows = IntegrityLab.durabilityStudy({});
  const scheme = function (name) {
    return rows.filter(function (row) { return row.name === name; })[0];
  };

  assert.strictEqual(prose.fixed(scheme('3× replication').storage, 2), '3.00');
  assert.strictEqual(scheme('3× replication').tolerates, 2);
  assert.strictEqual(scheme('3× replication').reconstructReads, 1);
  assert.strictEqual(prose.fixed(scheme('RS(14, 10)').storage, 2), '1.40');
  assert.strictEqual(scheme('RS(14, 10)').tolerates, 4);
  assert.strictEqual(scheme('RS(14, 10)').reconstructReads, 10);
  assert.strictEqual(prose.fixed(scheme('RS(12, 8)').storage, 2), '1.50');
  assert.strictEqual(scheme('RS(12, 8)').tolerates, 4);
  assert.strictEqual(scheme('RS(12, 8)').reconstructReads, 8);
  assert.strictEqual(prose.fixed(scheme('RS(14, 10)').storageAgainstThree * 100, 0), '47');

  prose.quotes('error-correction', ['1.40×', '3.00×', '10', '47%']);
});

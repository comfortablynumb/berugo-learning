'use strict';

/**
 * Property tests for the M22.8-M22.11 modules: the lossy pipeline, the integer
 * and float codecs, the checksums and the error-correcting codes.
 *
 * Two of these are exhaustive rather than sampled, because the whole space is
 * small enough: every single-bit and every double-bit error over the Hamming
 * code space, and every burst up to a length the search can finish. Where a
 * search is sampled the test says so, which is the same discipline the demo
 * applies.
 */

const test = require('node:test');
const assert = require('node:assert');

const Lossy = require('../../src/js/algorithms/lossy-codec.js');
const Codecs = require('../../src/js/algorithms/integer-codecs.js');
const Checksums = require('../../src/js/algorithms/checksums.js');
const Ecc = require('../../src/js/algorithms/ecc.js');
const Random = require('../../src/js/utils/random.js');

function bytesOf(text) {
  const out = [];

  for (let i = 0; i < text.length; i += 1) out.push(text.charCodeAt(i) & 0xff);
  return out;
}

/* ------------------------------------------------------------ 22.8 lossy */

test('the DCT inverts itself to floating-point precision', function () {
  const rng = Random.seeded(3);

  for (let trial = 0; trial < 20; trial += 1) {
    const block = [];

    for (let i = 0; i < 64; i += 1) block.push(Math.round(rng.next() * 255) - 128);
    const back = Lossy.idct(Lossy.dct(block));
    let worst = 0;

    back.forEach(function (value, i) { worst = Math.max(worst, Math.abs(value - block[i])); });
    assert.ok(worst < 1e-9, 'trial ' + trial + ': the transform is reversible, worst ' + worst);
  }
});

test('a flat block has all its energy in the DC coefficient', function () {
  const coefficients = Lossy.dct(new Array(64).fill(50));

  assert.ok(Math.abs(coefficients[0]) > 100, 'the DC term carries the block mean');
  coefficients.slice(1).forEach(function (value, i) {
    assert.ok(Math.abs(value) < 1e-9, 'AC coefficient ' + (i + 1) + ' should be zero');
  });
});

test('quality maps monotonically to size and to both distortion measures', function () {
  const image = Lossy.testImage(48, 48);
  const rows = Lossy.qualitySweep(image, [10, 25, 50, 75, 90]);

  for (let i = 1; i < rows.length; i += 1) {
    assert.ok(rows[i].bytes > rows[i - 1].bytes,
      'quality ' + rows[i].quality + ' must cost more than ' + rows[i - 1].quality);
    assert.ok(rows[i].db >= rows[i - 1].db - 1e-9, 'and must not be noisier');
    assert.ok(rows[i].ssim >= rows[i - 1].ssim - 1e-9, 'nor less structurally faithful');
    assert.ok(rows[i].nonZero >= rows[i - 1].nonZero, 'and must keep more coefficients');
  }
  assert.ok(rows[rows.length - 1].ssim <= 1 + 1e-9, 'SSIM cannot exceed one');
});

test('quality 100 is not lossless, and the demo reports a finite PSNR', function () {
  const image = Lossy.testImage(48, 48);
  const row = Lossy.qualitySweep(image, [100])[0];

  assert.ok(row.db !== Infinity, 'the transform is floating point and rounds back to integers');
  assert.ok(row.db > 50, 'though it should be very high: ' + row.db.toFixed(2) + ' dB');
  assert.ok(row.mse > 0, 'so the mean squared error is not zero');
});

test('aligned re-encoding reaches a fixed point and a shifted one does not', function () {
  const image = Lossy.testImage(48, 48);
  const aligned = Lossy.generationLoss(image, { quality: 50, rounds: 5 });
  const shifted = Lossy.generationLoss(image, { quality: 50, rounds: 5, shift: 3 });

  assert.ok(aligned[0].changed > 0, 'the first encode must change something');
  aligned.slice(1).forEach(function (row) {
    assert.strictEqual(row.changed, 0,
      'round ' + row.round + ' changed ' + row.changed + ' pixels on an aligned re-encode');
  });
  const moving = shifted.filter(function (row) { return row.changed > 0; });

  assert.strictEqual(moving.length, shifted.length, 'a shifted re-encode must keep changing');
  assert.ok(shifted[shifted.length - 1].db < shifted[0].db,
    'and it must degrade: ' + shifted[0].db.toFixed(2) + ' to ' +
    shifted[shifted.length - 1].db.toFixed(2) + ' dB');
});

/* ------------------------------------------------------- 22.9 columnar */

test('delta and zigzag are exactly invertible', function () {
  const rng = Random.seeded(11);
  const values = [];
  let at = 0;

  for (let i = 0; i < 500; i += 1) {
    at += Math.floor(rng.next() * 40) - 20;
    values.push(at);
  }
  assert.deepStrictEqual(Codecs.undelta(Codecs.delta(values)), values, 'delta must invert');
  values.forEach(function (value) {
    assert.strictEqual(Codecs.unzigzag(Codecs.zigzag(value)), value,
      'zigzag must invert at ' + value);
    assert.ok(Codecs.zigzag(value) >= 0, 'and it must produce a non-negative integer');
  });
});

test('sorting a column is worth more than the encoding choice', function () {
  const rng = Random.seeded(13);
  const sorted = [];
  let at = 1700000000;

  for (let i = 0; i < 2000; i += 1) {
    at += 1 + Math.floor(rng.next() * 4);
    sorted.push(at);
  }
  const shuffled = sorted.slice();

  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng.next() * (i + 1));
    const held = shuffled[i];

    shuffled[i] = shuffled[j];
    shuffled[j] = held;
  }
  const encode = function (values) {
    return Codecs.simple8b(Codecs.delta(values).map(Codecs.zigzag)).bytes;
  };
  const gain = encode(shuffled) / encode(sorted);

  assert.ok(gain > 2, 'the same encoder on the same values must differ by more than 2×: ' +
    gain.toFixed(2));
  assert.strictEqual(Codecs.varint(sorted).bytes, Codecs.varint(shuffled).bytes,
    'a plain varint does not care about order, which is what makes the comparison fair');
});

test('frame-of-reference and Simple-8b survive an outlier that ruins bit-packing', function () {
  const values = new Array(512).fill(3);

  values[100] = 1 << 20;
  const packed = Codecs.bitPack(values).bytes;
  const frame = Codecs.frameOfReference(values, 128).bytes;
  const simple = Codecs.simple8b(values).bytes;

  assert.ok(frame < packed / 2, 'a per-block width must beat one width for everything');
  assert.ok(simple < packed / 2, 'and so must a per-word one');
  assert.strictEqual(Codecs.bitPack(values).width, 21,
    'bit-packing sizes everything by the outlier');
});

test('Gorilla is lossless, and its ratio tracks the moving mantissa bits', function () {
  const rng = Random.seeded(17);
  const walk = [];
  const rounded = [];
  let a = 72.5;

  for (let i = 0; i < 2000; i += 1) {
    a += (rng.next() - 0.5) * 0.05;
    walk.push(a);
    rounded.push(Math.round(a * 10) / 10);
  }
  [walk, rounded, new Array(1000).fill(42), []].forEach(function (series, i) {
    const back = Codecs.gorillaRoundTrip(series);

    assert.strictEqual(back.length, series.length, 'case ' + i + ': length changed');
    back.forEach(function (value, at) {
      assert.strictEqual(value, series[at], 'case ' + i + ': value ' + at + ' is not exact');
    });
  });
  assert.ok(Codecs.gorilla(rounded).ratio > Codecs.gorilla(walk).ratio * 3,
    'rounding to the measured precision must be worth a large factor');
  assert.ok(Codecs.gorilla(new Array(1000).fill(42)).ratio > 30,
    'a constant series costs about one control bit per value');
});

/* ----------------------------------------------------- 22.10 detection */

test('CRC-32 matches the published check values, both implementations', function () {
  const cases = [
    { input: '', expect: 0x00000000 },
    { input: 'a', expect: 0xe8b7be43 },
    { input: 'abc', expect: 0x352441c2 },
    { input: '123456789', expect: 0xcbf43926 },
    { input: 'The quick brown fox jumps over the lazy dog', expect: 0x414fa339 }
  ];

  cases.forEach(function (entry) {
    const bytes = bytesOf(entry.input);

    assert.strictEqual(Checksums.crc32(bytes), entry.expect >>> 0,
      'table-driven CRC of "' + entry.input.slice(0, 20) + '"');
    assert.strictEqual(Checksums.crc32Bitwise(bytes), entry.expect >>> 0,
      'bit-at-a-time CRC of "' + entry.input.slice(0, 20) + '"');
  });
});

test('every detector catches every single-bit flip, and only some catch swaps', function () {
  const bytes = bytesOf('the quick brown fox jumps over the lazy dog');
  const single = Checksums.singleBitStudy(bytes);
  const reorder = Checksums.reorderStudy(bytes, 500);

  single.forEach(function (row) {
    assert.strictEqual(row.rate, 1, row.name + ' missed a single-bit flip');
  });
  const rateOf = function (rows, name) {
    return rows.filter(function (row) { return row.name === name; })[0].rate;
  };

  assert.strictEqual(rateOf(reorder, 'byte sum'), 0,
    'a commutative sum cannot see a permutation');
  assert.strictEqual(rateOf(reorder, 'parity'), 0, 'nor can parity');
  assert.ok(rateOf(reorder, 'Fletcher-16') > 0.9, 'the second accumulator fixes it');
  assert.strictEqual(rateOf(reorder, 'CRC-32'), 1, 'and CRC catches all of them here');
});

test('the burst guarantee holds where the search is exhaustive', function () {
  const bytes = bytesOf('the quick brown fox jumps over the lazy dog. pack my box.');
  const study = Checksums.burstStudy(bytes, 20, 9);
  const rowOf = function (name) {
    return study.filter(function (row) { return row.name === name; })[0];
  };

  assert.strictEqual(rowOf('parity').guaranteed, 1, 'parity is perfect only at one bit');
  assert.strictEqual(rowOf('byte sum').guaranteed, 8, 'a byte sum survives to its own width');
  assert.strictEqual(rowOf('CRC-32').guaranteed, 9,
    'the exhaustive search stops at 9 by construction, not because CRC fails');
  assert.ok(rowOf('CRC-32').noneMissed >= 20,
    'and nothing is missed across the sampled range either');
  const firstMiss = rowOf('byte sum').rows.filter(function (row) {
    return row.trials > 0 && row.rate < 1;
  })[0];

  assert.strictEqual(firstMiss.length, 9,
    'the first failure is where a burst can span two bytes');
  assert.strictEqual(firstMiss.exhaustive, true,
    'and that row was searched exhaustively, so it is a fact rather than a sample');
});

test('a CRC forges in a linear solve, which is the point', function () {
  const bytes = bytesOf('a message an attacker would like to replace');
  const target = Checksums.crc32(bytesOf('something else entirely'));
  const forged = Checksums.forgeSuffix(bytes, target);

  assert.ok(forged !== null, 'the system is solvable and must be solved');
  assert.strictEqual(forged.length, bytes.length + 4, 'four appended bytes suffice');
  assert.strictEqual(Checksums.crc32(forged), target >>> 0,
    'and the CRC now equals a chosen value exactly');
});

/* ---------------------------------------------------- 22.11 correction */

test('Hamming corrects every single-bit error over the whole code space', function () {
  let corrected = 0;

  for (let word = 0; word < 16; word += 1) {
    const bits = [(word >> 3) & 1, (word >> 2) & 1, (word >> 1) & 1, word & 1];
    const code = Ecc.hammingEncode(bits);

    assert.strictEqual(Ecc.hammingDecode(code).syndrome, 0, 'a clean word has syndrome zero');
    for (let at = 0; at < 7; at += 1) {
      const bad = code.slice();

      bad[at] ^= 1;
      const decoded = Ecc.hammingDecode(bad);

      assert.strictEqual(decoded.syndrome, at + 1,
        'the syndrome must be the one-based position of the flipped bit');
      assert.deepStrictEqual(decoded.data, bits, 'and the data must come back');
      corrected += 1;
    }
  }
  assert.strictEqual(corrected, 112, '16 words × 7 positions');
});

test('SECDED detects every double-bit error rather than miscorrecting it', function () {
  let detected = 0;
  let trials = 0;

  for (let word = 0; word < 16; word += 1) {
    const bits = [(word >> 3) & 1, (word >> 2) & 1, (word >> 1) & 1, word & 1];
    const code = Ecc.secdedEncode(bits);

    assert.strictEqual(Ecc.secdedDecode(code).status, 'clean', 'a clean word is clean');
    for (let a = 0; a < 8; a += 1) {
      for (let b = a + 1; b < 8; b += 1) {
        const bad = code.slice();

        bad[a] ^= 1;
        bad[b] ^= 1;
        trials += 1;
        if (Ecc.secdedDecode(bad).status === 'double-error') detected += 1;
      }
    }
  }
  assert.strictEqual(trials, 448, '16 words × 28 pairs');
  assert.strictEqual(detected, 448, 'every double error must be reported, not corrected');
});

test('GF(256) arithmetic obeys the field axioms', function () {
  for (let a = 1; a < 256; a += 1) {
    assert.strictEqual(Ecc.gfMul(a, Ecc.gfInverse(a)), 1, a + ' has no inverse');
    assert.strictEqual(Ecc.gfDiv(Ecc.gfMul(a, 7), 7), a, 'division must undo multiplication');
  }
  assert.strictEqual(Ecc.gfMul(0, 200), 0, 'zero absorbs');
  assert.strictEqual(Ecc.gfMul(3, 7), Ecc.gfMul(7, 3), 'multiplication commutes');
});

test('Reed–Solomon corrects to its limit and refuses past it', function () {
  const rng = Random.seeded(19);
  const data = [];

  for (let i = 0; i < 10; i += 1) data.push(1 + Math.floor(rng.next() * 254));
  const parity = 6;
  const codeword = Ecc.rsEncode(data, parity);

  assert.strictEqual(codeword.length, data.length + parity, 'systematic encoding');
  assert.deepStrictEqual(codeword.slice(0, data.length), data, 'the data passes through unchanged');
  assert.ok(Ecc.syndromes(codeword, parity).every(function (value) { return value === 0; }),
    'a clean codeword has an all-zero syndrome');

  for (let errors = 1; errors <= parity / 2; errors += 1) {
    const bad = codeword.slice();

    for (let i = 0; i < errors; i += 1) bad[(i * 3) % bad.length] ^= 0x5a + i;
    const decoded = Ecc.rsDecode(bad, parity);

    assert.strictEqual(decoded.status, 'corrected', errors + ' errors should be correctable');
    assert.deepStrictEqual(decoded.data, data, 'and the data must be exact');
  }
  const beyond = codeword.slice();

  for (let i = 0; i < parity / 2 + 1; i += 1) beyond[(i * 2) % beyond.length] ^= 0x33 + i;
  assert.strictEqual(Ecc.rsDecode(beyond, parity).status, 'beyond-limit',
    'past the limit the decoder must refuse rather than return a wrong codeword');
});

test('erasures are repairable to exactly the parity count', function () {
  const rng = Random.seeded(23);
  const data = [];

  for (let i = 0; i < 10; i += 1) data.push(1 + Math.floor(rng.next() * 254));
  const parity = 6;
  const codeword = Ecc.rsEncode(data, parity);

  for (let count = 1; count <= parity; count += 1) {
    const damaged = codeword.slice();
    const positions = [];

    for (let i = 0; i < count; i += 1) {
      positions.push(i * 2);
      damaged[i * 2] = 0;
    }
    const repaired = Ecc.rsRepairErasures(damaged, parity, positions);

    assert.ok(repaired.repaired, count + ' erasures should be repairable');
    assert.deepStrictEqual(repaired.repaired, codeword, 'and repaired exactly');
  }
  const tooMany = [];

  for (let i = 0; i <= parity; i += 1) tooMany.push(i * 2);
  assert.strictEqual(Ecc.rsRepairErasures(codeword, parity, tooMany).repaired, null,
    'one more erasure than parity symbols must be refused');
});

test('the durability table trades storage against reconstruction reads', function () {
  const rows = Ecc.durabilityTable([
    { kind: 'replication', name: '3x', copies: 3 },
    { kind: 'erasure', name: 'RS(12,8)', n: 12, k: 8 },
    { kind: 'erasure', name: 'RS(14,10)', n: 14, k: 10 }
  ]);
  const replication = rows[0];
  const wide = rows[2];

  assert.strictEqual(replication.storage, 3);
  assert.strictEqual(replication.reconstructReads, 1, 'replication rebuilds from one copy');
  assert.ok(wide.storage < replication.storage / 2, 'the erasure code must halve the storage');
  assert.ok(wide.tolerates > replication.tolerates, 'while tolerating more losses');
  assert.strictEqual(wide.reconstructReads, 10, 'and it pays k reads to rebuild one fragment');
});

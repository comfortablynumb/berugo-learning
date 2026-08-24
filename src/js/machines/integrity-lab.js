/**
 * The integrity bench: which corruptions each detector catches, and what a
 * correcting code costs.
 *
 * Both halves are searches rather than quotations. The detection table flips
 * every single bit, every pair it has budget for, every burst up to a stated
 * length and every byte swap, and reports the fraction caught — so "CRC detects
 * all bursts shorter than its degree" arrives as a column of 100.0% produced by
 * an exhaustive search, with the row where the search stopped being exhaustive
 * marked as such.
 *
 * The correction half is the same discipline: Hamming is checked against EVERY
 * single-bit error and EVERY double-bit error over the whole 16-word code
 * space, and Reed–Solomon is corrupted at rising error counts until it fails,
 * so the correction limit is observed rather than cited.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.IntegrityLab = api;
}(this, function (root) {
  'use strict';

  const Checksums = root && root.Checksums ? root.Checksums
    : require('../algorithms/checksums.js');
  const Ecc = root && root.Ecc ? root.Ecc : require('../algorithms/ecc.js');
  const Random = root && root.Random ? root.Random : require('../utils/random.js');

  const MESSAGE = 'the quick brown fox jumps over the lazy dog. pack my box with five dozen.';

  function messageBytes(options) {
    const settings = options || {};
    const text = settings.message === undefined ? MESSAGE : settings.message;
    const out = [];

    for (let i = 0; i < text.length; i += 1) out.push(text.charCodeAt(i) & 0xff);
    return out;
  }

  /* -------------------------------------------------- 22.10 detection */

  /** Published CRC-32 test vectors, checked rather than assumed. */
  function vectorCheck() {
    const cases = [
      { input: '', expect: 0x00000000 },
      { input: 'a', expect: 0xe8b7be43 },
      { input: 'abc', expect: 0x352441c2 },
      { input: '123456789', expect: 0xcbf43926 },
      { input: 'The quick brown fox jumps over the lazy dog', expect: 0x414fa339 }
    ];

    return cases.map(function (entry) {
      const bytes = messageBytes({ message: entry.input });
      const table = Checksums.crc32(bytes);
      const bitwise = Checksums.crc32Bitwise(bytes);

      return {
        input: entry.input === '' ? '(empty)' : entry.input,
        expected: entry.expect >>> 0, table: table, bitwise: bitwise,
        matches: table === (entry.expect >>> 0) && bitwise === table
      };
    });
  }

  /** Every error model, every detector, in one table. */
  function detectionStudy(options) {
    const settings = options || {};
    const bytes = messageBytes(settings);
    const single = Checksums.singleBitStudy(bytes);
    const double = Checksums.doubleBitStudy(bytes, settings.doubleLimit || 4000);
    const reorder = Checksums.reorderStudy(bytes, settings.reorderLimit || 1500);

    return {
      bytes: bytes.length, bits: bytes.length * 8,
      rows: single.map(function (row, i) {
        return {
          name: row.name, width: row.bits,
          single: row.rate, singleTrials: row.trials,
          double: double[i].rate, doubleTrials: double[i].trials,
          reorder: reorder[i].rate, reorderTrials: reorder[i].trials
        };
      })
    };
  }

  /** The burst guarantee, searched. */
  function burstStudy(options) {
    const settings = options || {};
    const bytes = messageBytes(settings);
    const maxLength = settings.maxLength === undefined ? 34 : settings.maxLength;
    const exhaustiveTo = settings.exhaustiveTo === undefined ? 10 : settings.exhaustiveTo;
    const study = Checksums.burstStudy(bytes, maxLength, exhaustiveTo);

    return {
      bytes: bytes.length, maxLength: maxLength, exhaustiveTo: exhaustiveTo,
      rows: study.map(function (row) {
        const firstMiss = row.rows.filter(function (entry) {
          return entry.trials > 0 && entry.rate < 1;
        })[0];

        return {
          name: row.name, width: row.bits,
          guaranteed: row.guaranteed, noneMissed: row.noneMissed,
          firstMiss: firstMiss ? firstMiss.length : null,
          firstMissRate: firstMiss ? firstMiss.rate : null,
          lengths: row.rows.map(function (entry) {
            return { length: entry.length, rate: entry.rate, exhaustive: entry.exhaustive };
          })
        };
      })
    };
  }

  /**
   * The forgery: a CRC is a public, invertible function, so four appended bytes
   * make it come out to whatever the attacker wants. This is not a weakness in
   * CRC — it is outside what CRC promises — and demonstrating it is the fastest
   * way to stop it being used as an integrity check.
   */
  function forgeryStudy(options) {
    const settings = options || {};
    const bytes = messageBytes(settings);
    const target = Checksums.crc32(messageBytes({ message: 'a completely different message' }));
    const forged = Checksums.forgeSuffix(bytes.slice(0, 24), target);

    return {
      target: target >>> 0,
      found: forged !== null,
      suffixBytes: forged ? forged.length - 24 : null,
      forgedCrc: forged ? Checksums.crc32(forged) : null,
      matches: forged ? Checksums.crc32(forged) === target : false
    };
  }

  /* ------------------------------------------------- 22.11 correction */

  /** Every data word, every single-bit error and every double-bit error. */
  function hammingStudy() {
    let singleCorrected = 0;
    let singleTrials = 0;
    let doubleDetected = 0;
    let doubleTrials = 0;
    const syndromes = [];

    for (let word = 0; word < 16; word += 1) {
      const bits = [(word >> 3) & 1, (word >> 2) & 1, (word >> 1) & 1, word & 1];
      const code = Ecc.hammingEncode(bits);
      const secded = Ecc.secdedEncode(bits);

      for (let at = 0; at < 7; at += 1) {
        const bad = code.slice();

        bad[at] ^= 1;
        const decoded = Ecc.hammingDecode(bad);

        singleTrials += 1;
        if (decoded.data.join('') === bits.join('') && decoded.syndrome === at + 1) {
          singleCorrected += 1;
        }
        if (word === 5) syndromes.push({ flipped: at + 1, syndrome: decoded.syndrome });
      }
      doubleTrials += countDoubles(secded, bits);
      doubleDetected += countDetected(secded);
    }
    return {
      dataWords: 16, singleTrials: singleTrials, singleCorrected: singleCorrected,
      doubleTrials: doubleTrials, doubleDetected: doubleDetected,
      syndromes: syndromes,
      rate: 4 / 7, secdedRate: 4 / 8
    };
  }

  function countDoubles(secded) {
    return secded.length * (secded.length - 1) / 2;
  }

  function countDetected(secded) {
    let detected = 0;

    for (let a = 0; a < secded.length; a += 1) {
      for (let b = a + 1; b < secded.length; b += 1) {
        const bad = secded.slice();

        bad[a] ^= 1;
        bad[b] ^= 1;
        if (Ecc.secdedDecode(bad).status === 'double-error') detected += 1;
      }
    }
    return detected;
  }

  /**
   * Reed–Solomon corrupted at rising error counts. The row where it stops
   * correcting is the correction limit, observed; the row after it is where a
   * decoder without a limit check would confidently return the wrong codeword.
   */
  function reedSolomonStudy(options) {
    const settings = options || {};
    const k = settings.k === undefined ? 10 : settings.k;
    const parity = settings.parity === undefined ? 6 : settings.parity;
    const rng = Random.seeded(settings.seed === undefined ? 4 : settings.seed);
    const data = [];

    for (let i = 0; i < k; i += 1) data.push(1 + Math.floor(rng.next() * 254));
    const codeword = Ecc.rsEncode(data, parity);
    const limit = Math.floor(parity / 2);
    const rows = [];

    for (let errors = 0; errors <= limit + 2; errors += 1) {
      rows.push(corruptRow({ codeword: codeword, data: data, parity: parity }, errors));
    }
    return { n: codeword.length, k: k, parity: parity, limit: limit,
      erasureLimit: parity, rows: rows, codeword: codeword, data: data };
  }

  function corruptRow(context, errors) {
    const bad = context.codeword.slice();

    for (let i = 0; i < errors; i += 1) bad[(i * 3) % bad.length] ^= 0x5a + i;
    const decoded = Ecc.rsDecode(bad, context.parity);

    return {
      errors: errors, status: decoded.status,
      recovered: decoded.data ? decoded.data.join(',') === context.data.join(',') : false,
      withinLimit: errors <= Math.floor(context.parity / 2)
    };
  }

  /** Erasures: positions known to be wrong, repairable up to n − k of them —
   *  twice what unknown errors allow. */
  function erasureStudy(options) {
    const study = reedSolomonStudy(options);
    const rows = [];

    for (let count = 0; count <= study.parity + 1; count += 1) {
      const damaged = study.codeword.slice();
      const positions = [];

      for (let i = 0; i < count; i += 1) {
        positions.push((i * 2) % study.n);
        damaged[(i * 2) % study.n] = 0;
      }
      const repaired = Ecc.rsRepairErasures(damaged, study.parity, positions);

      rows.push({ erasures: count,
        repaired: repaired.repaired
          ? repaired.repaired.join(',') === study.codeword.join(',') : false,
        reason: repaired.reason,
        withinLimit: count <= study.parity });
    }
    return { n: study.n, k: study.k, parity: study.parity, rows: rows };
  }

  /** Erasure coding against replication, at equal loss tolerance. */
  function durabilityStudy(options) {
    const settings = options || {};
    const schemes = settings.schemes || [
      { kind: 'replication', name: '2× replication', copies: 2 },
      { kind: 'replication', name: '3× replication', copies: 3 },
      { kind: 'erasure', name: 'RS(9, 6)', n: 9, k: 6 },
      { kind: 'erasure', name: 'RS(14, 10)', n: 14, k: 10 },
      { kind: 'erasure', name: 'RS(12, 8)', n: 12, k: 8 }
    ];
    const rows = Ecc.durabilityTable(schemes);
    const baseline = rows.filter(function (row) { return row.name === '3× replication'; })[0];

    return rows.map(function (row) {
      return Object.assign({}, row, {
        storageAgainstThree: row.storage / baseline.storage,
        toleratesAgainstThree: row.tolerates - baseline.tolerates
      });
    });
  }

  return {
    MESSAGE: MESSAGE, messageBytes: messageBytes,
    vectorCheck: vectorCheck, detectionStudy: detectionStudy, burstStudy: burstStudy,
    forgeryStudy: forgeryStudy,
    hammingStudy: hammingStudy, reedSolomonStudy: reedSolomonStudy,
    erasureStudy: erasureStudy, durabilityStudy: durabilityStudy
  };
}));

/**
 * Error detection: what each checksum actually promises.
 *
 * A checksum is a claim about which CORRUPTIONS it will catch, and the claims
 * differ enormously. A one's-complement sum — the Internet checksum, still in
 * every TCP and UDP header — cannot see two bytes swapped, because addition is
 * commutative, and cannot see a word changing by +1 while another changes by
 * −1. Fletcher and Adler fix the ordering blindness by keeping a running sum of
 * the running sum. CRC is different in kind: it is polynomial division over
 * GF(2), and it comes with proved guarantees — all single-bit errors, all
 * double-bit errors within a bound, all odd numbers of bit errors when the
 * polynomial has the right factor, and ALL bursts shorter than its degree.
 *
 * Bursts are why CRC survives. The errors that hardware actually produces are
 * not independent single-bit flips — they are scratches on a disc, a run of
 * symbols lost to interference, a whole sector reading back wrong — and a burst
 * shorter than the polynomial degree is caught with certainty rather than with
 * probability. This module verifies that exhaustively rather than quoting it.
 *
 * None of them detects an ADVERSARY. Every function here is public and
 * invertible: given a message and a target checksum, appending four chosen
 * bytes makes any CRC come out to any value. That is not a weakness in the
 * design, it is outside what the design promises, and confusing it with a
 * cryptographic hash is the failure this section exists to prevent.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.Checksums = api;
}(this, function () {
  'use strict';

  /* ---------------------------------------------------------- the simple */

  /** A plain byte sum, kept because its failures are the clearest. */
  function byteSum(bytes) {
    let sum = 0;

    bytes.forEach(function (byte) { sum = (sum + byte) & 0xff; });
    return sum;
  }

  /** Parity: one bit, catches every odd number of bit flips and nothing else. */
  function parity(bytes) {
    let bits = 0;

    bytes.forEach(function (byte) {
      let value = byte;

      while (value) {
        bits ^= value & 1;
        value >>>= 1;
      }
    });
    return bits;
  }

  /** The Internet checksum: one's-complement sum of 16-bit words, folded. */
  function internet(bytes) {
    let sum = 0;

    for (let i = 0; i < bytes.length; i += 2) {
      sum += (bytes[i] << 8) + (i + 1 < bytes.length ? bytes[i + 1] : 0);
      sum = (sum & 0xffff) + (sum >>> 16);
    }
    return (~sum) & 0xffff;
  }

  /** Fletcher-16: two running sums, so order matters. */
  function fletcher16(bytes) {
    let low = 0;
    let high = 0;

    bytes.forEach(function (byte) {
      low = (low + byte) % 255;
      high = (high + low) % 255;
    });
    return (high << 8) | low;
  }

  /** Adler-32, as used by zlib: Fletcher with a prime modulus. */
  function adler32(bytes) {
    let a = 1;
    let b = 0;

    bytes.forEach(function (byte) {
      a = (a + byte) % 65521;
      b = (b + a) % 65521;
    });
    return ((b * 65536) + a) >>> 0;
  }

  /* -------------------------------------------------------------- CRC-32 */

  const CRC32_POLYNOMIAL = 0xedb88320;

  /**
   * The table-driven form: precompute the remainder of every byte value, then
   * one lookup and one XOR per input byte. Slicing-by-8 extends the same idea
   * to eight tables and processes a word at a time, which is where the
   * throughput of a modern CRC comes from — that and the hardware instruction.
   */
  function crcTable(polynomial) {
    const table = new Array(256);

    for (let n = 0; n < 256; n += 1) {
      let c = n;

      for (let k = 0; k < 8; k += 1) {
        c = (c & 1) ? ((polynomial ^ (c >>> 1)) >>> 0) : (c >>> 1);
      }
      table[n] = c >>> 0;
    }
    return table;
  }

  const TABLE = crcTable(CRC32_POLYNOMIAL);

  function crc32(bytes) {
    let crc = 0xffffffff;

    for (let i = 0; i < bytes.length; i += 1) {
      crc = (TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8)) >>> 0;
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  /** The bit-at-a-time version, kept so the table can be checked against the
   *  definition rather than against itself. */
  function crc32Bitwise(bytes) {
    let crc = 0xffffffff;

    for (let i = 0; i < bytes.length; i += 1) {
      crc = (crc ^ bytes[i]) >>> 0;
      for (let bit = 0; bit < 8; bit += 1) {
        crc = (crc & 1) ? ((CRC32_POLYNOMIAL ^ (crc >>> 1)) >>> 0) : (crc >>> 1);
      }
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  /* ------------------------------------------------------- error models */

  const DETECTORS = [
    { name: 'byte sum', bits: 8, fn: byteSum },
    { name: 'parity', bits: 1, fn: parity },
    { name: 'Internet checksum', bits: 16, fn: internet },
    { name: 'Fletcher-16', bits: 16, fn: fletcher16 },
    { name: 'Adler-32', bits: 32, fn: adler32 },
    { name: 'CRC-32', bits: 32, fn: crc32 }
  ];

  function flipBit(bytes, at) {
    const copy = bytes.slice();

    copy[at >> 3] ^= 1 << (at & 7);
    return copy;
  }

  /** A burst of `length` bits starting at `at`, with the given pattern. The
   *  first and last bits of a burst are flipped by definition — a burst of
   *  length k is an error confined to a window of k bits whose ends moved. */
  function burst(bytes, at, pattern, length) {
    const copy = bytes.slice();

    for (let i = 0; i < length; i += 1) {
      const bit = (i === 0 || i === length - 1) ? 1 : ((pattern >> (i - 1)) & 1);

      if (bit) copy[(at + i) >> 3] ^= 1 << ((at + i) & 7);
    }
    return copy;
  }

  function swapBytes(bytes, a, b) {
    const copy = bytes.slice();
    const held = copy[a];

    copy[a] = copy[b];
    copy[b] = held;
    return copy;
  }

  /* --------------------------------------------------------- the study */

  /** Every single-bit flip in a message, against every detector. */
  function singleBitStudy(bytes) {
    return DETECTORS.map(function (detector) {
      const original = detector.fn(bytes);
      let caught = 0;

      for (let at = 0; at < bytes.length * 8; at += 1) {
        if (detector.fn(flipBit(bytes, at)) !== original) caught += 1;
      }
      return { name: detector.name, bits: detector.bits, caught: caught,
        trials: bytes.length * 8, rate: caught / (bytes.length * 8) };
    });
  }

  /** Two bit flips, chosen to include the pairs a commutative sum misses. */
  function doubleBitStudy(bytes, limit) {
    const cap = limit === undefined ? 4000 : limit;

    return DETECTORS.map(function (detector) {
      const original = detector.fn(bytes);
      let caught = 0;
      let trials = 0;
      const total = bytes.length * 8;

      for (let a = 0; a < total && trials < cap; a += 1) {
        for (let b = a + 1; b < total && trials < cap; b += 1) {
          trials += 1;
          const corrupted = flipBit(flipBit(bytes, a), b);

          if (detector.fn(corrupted) !== original) caught += 1;
        }
      }
      return { name: detector.name, bits: detector.bits, caught: caught,
        trials: trials, rate: trials === 0 ? 0 : caught / trials };
    });
  }

  /**
   * Bursts up to a stated length, at every position, and — up to a length the
   * search can actually finish — with every interior pattern.
   *
   * This is the guarantee CRC is chosen for, and the distinction between the
   * two columns is the honest part. Verifying "every burst of length 32 is
   * detected" exhaustively would need 2^30 patterns per position; the search
   * below is exhaustive to `exhaustiveTo` bits and samples 64 patterns beyond
   * it, and each row says which it was. `guaranteed` counts only the
   * exhaustively verified prefix, so it is a fact about this search rather than
   * a restatement of the theorem.
   */
  function burstStudy(bytes, maxLength, exhaustiveTo) {
    const limit = maxLength === undefined ? 33 : maxLength;
    const full = exhaustiveTo === undefined ? 12 : exhaustiveTo;

    return DETECTORS.map(function (detector) {
      const context = { bytes: bytes, detector: detector,
        original: detector.fn(bytes), exhaustiveTo: full };
      const rows = [];

      for (let length = 1; length <= limit; length += 1) rows.push(burstRow(context, length));
      return { name: detector.name, bits: detector.bits, rows: rows,
        guaranteed: longestPerfect(rows, true),
        noneMissed: longestPerfect(rows, false) };
    });
  }

  function burstRow(context, length) {
    const exhaustive = length <= context.exhaustiveTo;
    const interior = Math.max(0, length - 2);
    const patterns = exhaustive ? Math.pow(2, interior) : 64;
    const total = context.bytes.length * 8;
    let caught = 0;
    let trials = 0;

    for (let at = 0; at + length <= total; at += exhaustive ? 7 : 1) {
      for (let pattern = 0; pattern < patterns; pattern += 1) {
        trials += 1;
        const corrupted = burst(context.bytes, at, pattern, length);

        if (context.detector.fn(corrupted) !== context.original) caught += 1;
      }
    }
    return { length: length, caught: caught, trials: trials, exhaustive: exhaustive,
      rate: trials === 0 ? 0 : caught / trials };
  }

  /** The longest burst length at which nothing at all got through, optionally
   *  counting only the rows whose pattern search was exhaustive. */
  function longestPerfect(rows, exhaustiveOnly) {
    let best = 0;

    rows.forEach(function (row) {
      if (row.length !== best + 1) return;
      if (exhaustiveOnly && !row.exhaustive) return;
      if (row.trials > 0 && row.rate === 1) best = row.length;
    });
    return best;
  }

  /** Reordering: two bytes swapped, which a commutative sum cannot see. */
  function reorderStudy(bytes, limit) {
    const cap = limit === undefined ? 2000 : limit;

    return DETECTORS.map(function (detector) {
      const original = detector.fn(bytes);
      let caught = 0;
      let trials = 0;

      for (let a = 0; a < bytes.length && trials < cap; a += 1) {
        for (let b = a + 1; b < bytes.length && trials < cap; b += 1) {
          if (bytes[a] === bytes[b]) continue;
          trials += 1;
          if (detector.fn(swapBytes(bytes, a, b)) !== original) caught += 1;
        }
      }
      return { name: detector.name, bits: detector.bits, caught: caught,
        trials: trials, rate: trials === 0 ? 0 : caught / trials };
    });
  }

  /**
   * A forgery, solved rather than searched. CRC-32 is AFFINE in its input: for
   * a fixed prefix, crc(prefix || s) = crc(prefix || 0) XOR L(s) where L is
   * linear over GF(2). So the four bytes that force any target are the solution
   * of a 32-by-32 linear system, found with 33 CRC evaluations and a Gaussian
   * elimination — not a search, and not slow.
   *
   * That is the point. "The checksum matches" is not an integrity claim,
   * because the function is public and invertible and an attacker can hit any
   * value in microseconds.
   */
  function forgeSuffix(bytes, target) {
    const base = crc32(bytes.concat([0, 0, 0, 0]));
    const columns = [];

    for (let bit = 0; bit < 32; bit += 1) {
      const suffix = [0, 0, 0, 0];

      suffix[bit >> 3] = 1 << (bit & 7);
      columns.push((crc32(bytes.concat(suffix)) ^ base) >>> 0);
    }
    const solution = solveGf2(columns, (target ^ base) >>> 0);

    if (solution === null) return null;
    const suffix = [0, 0, 0, 0];

    for (let bit = 0; bit < 32; bit += 1) {
      if ((solution >>> bit) & 1) suffix[bit >> 3] |= 1 << (bit & 7);
    }
    return bytes.concat(suffix);
  }

  /** Solve sum of chosen columns = value, over GF(2), by elimination. */
  function solveGf2(columns, value) {
    const rows = columns.map(function (column, bit) {
      return { column: column >>> 0, mask: (1 << bit) >>> 0 };
    });
    let target = value >>> 0;
    let answer = 0;

    for (let bit = 31; bit >= 0; bit -= 1) {
      const pivot = rows.filter(function (row) {
        return ((row.column >>> bit) & 1) === 1;
      })[0];

      if (!pivot) continue;
      rows.forEach(function (row) {
        if (row === pivot || ((row.column >>> bit) & 1) === 0) return;
        row.column = (row.column ^ pivot.column) >>> 0;
        row.mask = (row.mask ^ pivot.mask) >>> 0;
      });
      if ((target >>> bit) & 1) {
        target = (target ^ pivot.column) >>> 0;
        answer = (answer ^ pivot.mask) >>> 0;
      }
      pivot.column = 0;
    }
    return target === 0 ? answer >>> 0 : null;
  }

  return {
    CRC32_POLYNOMIAL: CRC32_POLYNOMIAL, DETECTORS: DETECTORS,
    byteSum: byteSum, parity: parity, internet: internet,
    fletcher16: fletcher16, adler32: adler32,
    crcTable: crcTable, crc32: crc32, crc32Bitwise: crc32Bitwise,
    flipBit: flipBit, burst: burst, swapBytes: swapBytes,
    singleBitStudy: singleBitStudy, doubleBitStudy: doubleBitStudy,
    burstStudy: burstStudy, reorderStudy: reorderStudy, forgeSuffix: forgeSuffix
  };
}));

/**
 * Error correction: paying storage to not lose data.
 *
 * Detection says something is wrong; correction repairs it without asking for a
 * retransmission, which is the only option when there is nobody to ask — a
 * scratched disc, a cosmic ray in a DRAM cell, a QR code with a coffee ring on
 * it, a storage node that is simply gone.
 *
 * Hamming's construction is the clean introduction: place parity bits at the
 * powers of two, each covering the positions whose index has that bit set, and
 * the syndrome — the parities recomputed — reads out the INDEX of the flipped
 * bit in binary. One extra overall parity bit makes it SECDED: single error
 * correct, double error detect, which is exactly what ECC memory does.
 *
 * Reed–Solomon works over symbols rather than bits and over a finite field
 * rather than the integers. n symbols carry k of data, and any k of them
 * suffice to recover everything, so it corrects up to ⌊(n−k)/2⌋ unknown errors
 * or repairs up to n−k known ERASURES. The erasure case is the one that matters
 * in storage, because a missing disc announces itself, and it is why every
 * large object store uses erasure coding: the same durability as three-way
 * replication at about 1.5× storage instead of 3×.
 *
 * The cost nobody mentions is on the read path. Replication reads one copy;
 * erasure coding reconstructs a lost fragment by reading k fragments from k
 * different machines, so a single failure turns one read into k reads across
 * the network. This module reports that amplification alongside the storage
 * saving, because choosing on storage alone is how a cluster ends up
 * reconstruct-bound.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.Ecc = api;
}(this, function () {
  'use strict';

  /* ------------------------------------------------------------- Hamming */

  /**
   * Hamming(7,4): four data bits at positions 3, 5, 6, 7 and parity at 1, 2, 4.
   * Positions are one-based because that is what makes the syndrome work — the
   * parity bit at position 2^i covers every position whose index has bit i set,
   * so the failing parities spell the bad position's index.
   */
  function hammingEncode(dataBits) {
    const code = new Array(8).fill(0);
    const positions = [3, 5, 6, 7];

    dataBits.forEach(function (bit, i) { code[positions[i]] = bit & 1; });
    code[1] = code[3] ^ code[5] ^ code[7];
    code[2] = code[3] ^ code[6] ^ code[7];
    code[4] = code[5] ^ code[6] ^ code[7];
    return code.slice(1);
  }

  /** The syndrome IS the index of the flipped bit, in binary, and zero when
   *  nothing is wrong. That is the whole elegance of the construction. */
  function hammingSyndrome(received) {
    const code = [0].concat(received);
    const s1 = code[1] ^ code[3] ^ code[5] ^ code[7];
    const s2 = code[2] ^ code[3] ^ code[6] ^ code[7];
    const s4 = code[4] ^ code[5] ^ code[6] ^ code[7];

    return s1 + 2 * s2 + 4 * s4;
  }

  function hammingDecode(received) {
    const syndrome = hammingSyndrome(received);
    const corrected = received.slice();

    if (syndrome !== 0) corrected[syndrome - 1] ^= 1;
    return {
      syndrome: syndrome,
      corrected: corrected,
      data: [corrected[2], corrected[4], corrected[5], corrected[6]],
      repaired: syndrome !== 0
    };
  }

  /** SECDED: one more parity over the whole word, so a double error shows as
   *  "syndrome non-zero but overall parity even" and is reported rather than
   *  miscorrected into a third error. */
  function secdedEncode(dataBits) {
    const code = hammingEncode(dataBits);
    let overall = 0;

    code.forEach(function (bit) { overall ^= bit; });
    return code.concat([overall]);
  }

  function secdedDecode(received) {
    const body = received.slice(0, 7);
    const syndrome = hammingSyndrome(body);
    let overall = 0;

    received.forEach(function (bit) { overall ^= bit; });
    if (syndrome === 0 && overall === 0) return { status: 'clean', data: hammingDecode(body).data };
    if (overall === 1) {
      const fixed = hammingDecode(body);

      return { status: 'corrected', data: fixed.data, syndrome: syndrome };
    }
    return { status: 'double-error', data: null, syndrome: syndrome };
  }

  /* ------------------------------------------------------------- GF(256) */

  const EXP = new Array(512);
  const LOG = new Array(256);

  (function buildTables() {
    let x = 1;

    for (let i = 0; i < 255; i += 1) {
      EXP[i] = x;
      LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d;
    }
    for (let i = 255; i < 512; i += 1) EXP[i] = EXP[i - 255];
    LOG[0] = 0;
  }());

  function gfMul(a, b) {
    if (a === 0 || b === 0) return 0;
    return EXP[LOG[a] + LOG[b]];
  }

  function gfDiv(a, b) {
    if (b === 0) throw new Error('ecc: division by zero in GF(256)');
    if (a === 0) return 0;
    return EXP[(LOG[a] + 255 - LOG[b]) % 255];
  }

  function gfPow(a, n) {
    if (a === 0) return 0;
    return EXP[(LOG[a] * n) % 255];
  }

  function gfInverse(a) {
    return EXP[255 - LOG[a]];
  }

  /* -------------------------------------------------------- Reed–Solomon */

  /** The generator polynomial (x − α⁰)(x − α¹)…, whose roots are what the
   *  syndrome tests for. */
  function generator(parity) {
    let poly = [1];

    for (let i = 0; i < parity; i += 1) poly = polyMul(poly, [1, gfPow(2, i)]);
    return poly;
  }

  function polyMul(a, b) {
    const out = new Array(a.length + b.length - 1).fill(0);

    a.forEach(function (x, i) {
      b.forEach(function (y, j) { out[i + j] ^= gfMul(x, y); });
    });
    return out;
  }

  function polyEval(poly, x) {
    let value = 0;

    poly.forEach(function (coefficient) { value = gfMul(value, x) ^ coefficient; });
    return value;
  }

  /** Systematic encoding: the data is copied through unchanged and the parity
   *  is the remainder of dividing it by the generator. */
  function rsEncode(data, parity) {
    const gen = generator(parity);
    const buffer = data.concat(new Array(parity).fill(0));

    for (let i = 0; i < data.length; i += 1) {
      const coefficient = buffer[i];

      if (coefficient === 0) continue;
      for (let j = 1; j < gen.length; j += 1) {
        buffer[i + j] ^= gfMul(gen[j], coefficient);
      }
    }
    return data.concat(buffer.slice(data.length));
  }

  /** The syndrome: evaluate the received word at each root. All zero means no
   *  detectable error. */
  function syndromes(received, parity) {
    const out = [];

    for (let i = 0; i < parity; i += 1) out.push(polyEval(received, gfPow(2, i)));
    return out;
  }

  /**
   * Erasure decoding by Gaussian elimination over GF(256). Erasures are
   * positions KNOWN to be wrong, so there is no locating to do and up to n − k
   * of them can be repaired — twice what unknown errors allow, which is the
   * whole reason storage systems care about the distinction.
   */
  function rsRepairErasures(received, parity, erasures) {
    if (erasures.length > parity) {
      return { repaired: null, reason: 'more erasures than parity symbols' };
    }
    const rows = [];

    for (let i = 0; i < erasures.length; i += 1) {
      const x = gfPow(2, i);
      const row = erasures.map(function (position) {
        return gfPow(x, received.length - 1 - position);
      });
      const known = knownValue(received, erasures, x);

      rows.push({ row: row, value: known });
    }
    const solution = solve(rows, erasures.length);

    if (!solution) return { repaired: null, reason: 'singular system' };
    const out = received.slice();

    erasures.forEach(function (position, i) { out[position] = solution[i]; });
    return { repaired: out, reason: null };
  }

  /** What the surviving symbols contribute at this root; the unknowns have to
   *  make up the difference, which is the right-hand side. */
  function knownValue(received, erasures, x) {
    const missing = new Set(erasures);
    let value = 0;

    received.forEach(function (symbol, position) {
      if (missing.has(position)) return;
      value ^= gfMul(symbol, gfPow(x, received.length - 1 - position));
    });
    return value;
  }

  /** Gaussian elimination in GF(256): the same algorithm as over the reals,
   *  with XOR for subtraction and no floating point to lose precision to. */
  function solve(rows, size) {
    const matrix = rows.map(function (entry) { return entry.row.concat([entry.value]); });

    for (let column = 0; column < size; column += 1) {
      let pivot = -1;

      for (let r = column; r < size && pivot < 0; r += 1) {
        if (matrix[r][column] !== 0) pivot = r;
      }
      if (pivot < 0) return null;
      const held = matrix[column];

      matrix[column] = matrix[pivot];
      matrix[pivot] = held;
      const inverse = gfInverse(matrix[column][column]);

      for (let c = column; c <= size; c += 1) {
        matrix[column][c] = gfMul(matrix[column][c], inverse);
      }
      for (let r = 0; r < size; r += 1) {
        if (r === column || matrix[r][column] === 0) continue;
        const factor = matrix[r][column];

        for (let c = column; c <= size; c += 1) {
          matrix[r][c] ^= gfMul(factor, matrix[column][c]);
        }
      }
    }
    return matrix.map(function (row) { return row[size]; });
  }

  /**
   * Error decoding: locate the bad positions by brute force over small
   * parameters, then repair them as erasures. A real decoder uses
   * Berlekamp–Massey and Chien search; this finds the same answer and makes the
   * CORRECTION LIMIT visible, which is the thing worth seeing — at t + 1 errors
   * the decoder does not merely fail, it can confidently produce the wrong
   * codeword, and that is reported here rather than hidden.
   */
  function rsDecode(received, parity) {
    const syndrome = syndromes(received, parity);

    if (syndrome.every(function (value) { return value === 0; })) {
      return { status: 'clean', data: received.slice(0, received.length - parity), errors: 0 };
    }
    const limit = Math.floor(parity / 2);

    for (let count = 1; count <= limit; count += 1) {
      const found = searchPositions(received, parity, count);

      if (found) {
        return { status: 'corrected', data: found.slice(0, received.length - parity),
          errors: count };
      }
    }
    return { status: 'beyond-limit', data: null, errors: null, limit: limit };
  }

  /** Every set of `count` positions, repaired as erasures and checked. */
  function searchPositions(received, parity, count) {
    const n = received.length;
    const indices = [];

    for (let i = 0; i < count; i += 1) indices.push(i);
    for (;;) {
      const attempt = rsRepairErasures(received, parity, indices.slice());

      if (attempt.repaired && syndromes(attempt.repaired, parity)
        .every(function (value) { return value === 0; })) {
        return attempt.repaired;
      }
      let at = count - 1;

      while (at >= 0 && indices[at] === n - count + at) at -= 1;
      if (at < 0) return null;
      indices[at] += 1;
      for (let i = at + 1; i < count; i += 1) indices[i] = indices[i - 1] + 1;
    }
  }

  /* ------------------------------------------------- erasure vs replication */

  /**
   * Storage overhead and read amplification for the same nominal durability.
   * Replication survives r − 1 losses at r× storage; an (n, k) code survives
   * n − k at n/k× storage — and pays k reads to reconstruct one lost fragment.
   */
  function durabilityTable(schemes) {
    return schemes.map(function (scheme) {
      if (scheme.kind === 'replication') {
        return { name: scheme.name, storage: scheme.copies, tolerates: scheme.copies - 1,
          readAmplification: 1, reconstructReads: 1, kind: 'replication' };
      }
      return {
        name: scheme.name, storage: scheme.n / scheme.k, tolerates: scheme.n - scheme.k,
        readAmplification: 1, reconstructReads: scheme.k, kind: 'erasure',
        n: scheme.n, k: scheme.k
      };
    });
  }

  return {
    hammingEncode: hammingEncode, hammingSyndrome: hammingSyndrome,
    hammingDecode: hammingDecode, secdedEncode: secdedEncode, secdedDecode: secdedDecode,
    gfMul: gfMul, gfDiv: gfDiv, gfPow: gfPow, gfInverse: gfInverse,
    generator: generator, polyMul: polyMul, polyEval: polyEval,
    rsEncode: rsEncode, syndromes: syndromes, rsRepairErasures: rsRepairErasures,
    rsDecode: rsDecode, durabilityTable: durabilityTable
  };
}));

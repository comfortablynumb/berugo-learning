/**
 * Kolmogorov complexity: the length of the shortest program that prints the
 * string, and why almost every string has none shorter than itself.
 *
 * K is uncomputable, so nothing here computes it. What is computable, and what
 * this module does, is two things that together carry the whole idea:
 *
 *   1. An UPPER bound. Any codec that compresses a string to m bits proves
 *      K(s) ≤ m + c, where c is the decoder's own size. Several codecs run
 *      here and the best is reported — an upper bound is all any compressor
 *      has ever offered.
 *   2. The COUNTING argument, checked exhaustively. There are 2^n strings of
 *      length n and only 2^(n−k) − 1 possible descriptions shorter than n − k,
 *      so at most that many strings can compress by k bits. That is a pigeonhole
 *      argument with no cleverness in it at all, and it is why "a compressor
 *      that shrinks every input" is not an ambitious claim but an impossible
 *      one.
 *
 * The counting bound is verified by brute force over every string of length up
 * to 16 rather than asserted, because it is precisely the kind of claim that
 * sounds obviously true and is easy to state slightly wrong.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.Kolmogorov = api;
}(this, function () {
  'use strict';

  /* ---------------------------------------------------------------- codecs */

  /** Run-length encoding, in bits: a run costs one symbol plus a 4-bit count. */
  function runLength(bits) {
    let runs = 0;
    let i = 0;

    while (i < bits.length) {
      let length = 1;

      while (i + length < bits.length && bits[i + length] === bits[i] && length < 15) {
        length += 1;
      }
      runs += 1;
      i += length;
    }
    return { bits: runs * 5, name: 'run-length', detail: runs + ' runs at 5 bits each' };
  }

  /**
   * A period encoder: if the string is a repetition of a block, the block plus
   * the block length is a description. This is the codec that catches
   * `010101…`, which run-length does not.
   */
  function periodic(bits) {
    for (let period = 1; period <= bits.length / 2; period += 1) {
      let matches = true;

      for (let i = period; i < bits.length && matches; i += 1) {
        if (bits[i] !== bits[i % period]) matches = false;
      }
      if (matches) {
        return { bits: period + 8, name: 'periodic',
          detail: 'a ' + period + '-bit block repeated, plus 8 bits for the length' };
      }
    }
    return { bits: bits.length + 8, name: 'periodic', detail: 'no period found' };
  }

  /**
   * A dictionary encoder in the Lempel–Ziv spirit: emit a new phrase whenever
   * one is not already in the dictionary, and charge for the index plus the
   * extending bit.
   */
  function dictionary(bits) {
    const seen = { '': true };
    const phrases = [];
    let current = '';

    bits.split('').forEach(function (bit) {
      current += bit;
      if (seen[current]) return;
      seen[current] = true;
      phrases.push(current);
      current = '';
    });
    if (current) phrases.push(current);
    const indexBits = Math.max(1, Math.ceil(Math.log2(Math.max(2, phrases.length))));

    return { bits: phrases.length * (indexBits + 1), name: 'dictionary',
      detail: phrases.length + ' phrases at ' + (indexBits + 1) + ' bits each' };
  }

  /** The literal encoding, which is always available and is the thing every
   *  other codec has to beat. */
  function literal(bits) {
    return { bits: bits.length, name: 'literal', detail: 'the string itself' };
  }

  const CODECS = [literal, runLength, periodic, dictionary];

  /**
   * The best upper bound any of the codecs gives, which is the honest form of
   * "the complexity of this string". It is an upper bound and it is called
   * one, because the true value is not computable and a number presented
   * without that qualifier is a lie about what was measured.
   */
  function upperBound(bits) {
    const results = CODECS.map(function (codec) { return codec(bits); });
    const best = results.reduce(function (a, b) { return b.bits < a.bits ? b : a; });

    return { length: bits.length, best: best.bits, codec: best.name, detail: best.detail,
      saved: bits.length - best.bits, results: results,
      ratio: bits.length === 0 ? 1 : best.bits / bits.length };
  }

  /* ---------------------------------------------------- the counting bound */

  /**
   * How many strings of length n can a code compress to fewer than n − k bits?
   *
   * At most 2^(n−k) − 1, because that is how many binary strings of length
   * strictly less than n − k there are, and a decodable code cannot map two
   * inputs to the same description. The result is a hard ceiling with no
   * assumptions about the code at all.
   */
  function countingBound(n, k) {
    return Math.pow(2, n - k) - 1;
  }

  /**
   * The bound checked exhaustively: run every string of length n through the
   * codecs and count how many actually compress by k bits or more. The count
   * must not exceed the bound, and the gap between them is the interesting
   * part — real codecs come nowhere near saturating it.
   */
  function verifyBound(n, k) {
    const total = Math.pow(2, n);
    let compressed = 0;

    for (let mask = 0; mask < total; mask += 1) {
      const bits = mask.toString(2).padStart(n, '0');

      if (upperBound(bits).best <= n - k) compressed += 1;
    }
    const bound = countingBound(n, k);

    return { n: n, k: k, total: total, compressed: compressed, bound: bound,
      withinBound: compressed <= bound,
      fraction: compressed / total,
      headroom: bound - compressed };
  }

  /**
   * The fraction of strings of length n that compress by even one bit. The
   * counting argument says at most half; the measurement says far fewer, which
   * is the version worth quoting because it is about real codecs.
   */
  function incompressibleFraction(n) {
    const total = Math.pow(2, n);
    let compressible = 0;

    for (let mask = 0; mask < total; mask += 1) {
      const bits = mask.toString(2).padStart(n, '0');

      if (upperBound(bits).best < n) compressible += 1;
    }
    return { n: n, total: total, compressible: compressible,
      incompressible: total - compressible,
      fraction: (total - compressible) / total,
      ceiling: 0.5 };
  }

  /* -------------------------------------------------------------- fixtures */

  /** Strings whose complexity a reader can predict, so the measurement can be
   *  checked against intuition rather than only against itself. */
  function samples(length) {
    const n = length || 32;
    const out = [];
    let alternating = '';
    let zeros = '';
    let counting = '';

    for (let i = 0; i < n; i += 1) {
      alternating += i % 2 ? '1' : '0';
      zeros += '0';
      /* Bit i is 1 exactly when i is a perfect square — a rule with a
         one-line description and no period at all, so every codec here
         reports it as incompressible. That gap between the true complexity
         and the measured bound IS the section. */
      counting += Number.isInteger(Math.sqrt(i)) ? '1' : '0';
    }
    out.push({ name: 'all zeros', bits: zeros, expect: 'tiny — one run' });
    out.push({ name: 'alternating', bits: alternating, expect: 'tiny — period 2' });
    out.push({ name: 'the perfect squares', bits: counting,
      expect: 'a one-line rule, and no codec here finds it' });
    out.push({ name: 'a fixed pseudo-random string', bits: pseudoRandom(n),
      expect: 'incompressible by every codec here, and it has a 20-character description' });
    return out;
  }

  /**
   * A string produced by a short rule that none of the codecs can see. Its
   * true complexity is small — this function IS its description — and every
   * measurement will report it as incompressible, which is the whole point:
   * an upper bound is not the value.
   */
  function pseudoRandom(n) {
    let state = 2463534242;
    let out = '';

    for (let i = 0; i < n; i += 1) {
      state ^= state << 13;
      state >>>= 0;
      state ^= state >>> 17;
      state ^= state << 5;
      state >>>= 0;
      out += (state & 1) ? '1' : '0';
    }
    return out;
  }

  /* -------------------------------------------------------- the statements */

  /** The claims the section makes, each with the reason it holds and what it
   *  is used for outside the theory. */
  const CLAIMS = [
    { claim: 'K depends on the language only up to a constant',
      why: 'An interpreter for one language written in another is a fixed-size program, so ' +
        'K_A(s) ≤ K_B(s) + |interpreter|.',
      use: 'It is why K is a property of the string rather than of the toolchain.' },
    { claim: 'K is not computable',
      why: 'A program that computes K could find the shortest string with K above a bound — ' +
        'and that program is itself a short description of it. Berry’s paradox, formalised.',
      use: 'It is why every compressor reports an upper bound and none reports the value.' },
    { claim: 'Most strings are incompressible',
      why: 'Counting: at most 2^(n−k) − 1 descriptions are shorter than n − k, out of 2^n ' +
        'strings.',
      use: 'It is why "compresses everything" is impossible rather than merely unachieved.' },
    { claim: 'Compression is bounded below by entropy',
      why: 'Shannon’s source coding theorem: no code beats the entropy rate on average.',
      use: 'M22 measures exactly this, and K is the single-string version of it.' },
    { claim: 'The shortest explanation generalises best',
      why: 'Minimum description length: the model plus the data-given-the-model is a code, and ' +
        'the shortest total code is the best trade of fit against complexity.',
      use: 'It is what "Occam’s razor" means when it is made precise, and what regularisation ' +
        'approximates.' }
  ];

  return {
    CODECS: CODECS, CLAIMS: CLAIMS,
    literal: literal, runLength: runLength, periodic: periodic, dictionary: dictionary,
    upperBound: upperBound, countingBound: countingBound, verifyBound: verifyBound,
    incompressibleFraction: incompressibleFraction, samples: samples,
    pseudoRandom: pseudoRandom
  };
}));

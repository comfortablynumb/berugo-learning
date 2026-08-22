/**
 * Rolling hashes: matching by fingerprint, and the fingerprints that collide.
 *
 * The hash of a window is a polynomial in the base, so sliding it one place is
 * two multiplications and two additions rather than a rescan. That makes
 * matching a stream of hash comparisons with a verification only on a hit -
 * and the whole design hinges on how often a hit is spurious.
 *
 * With a FIXED base and modulus the fingerprint is a public function, and a
 * birthday search over about sqrt(modulus) random strings finds two that
 * collide - a second of work, no cleverness required. Repeat one of them and
 * the matcher verifies every window and finds nothing. Randomising the base
 * per run is the fix, because the colliding pair was a solution for one base
 * only, and the section measures both.
 *
 * Content-defined chunking is the same rolling hash pointed at a different
 * question - not "where is this pattern" but "where should this file be cut" -
 * and it is why rsync transfers only what changed.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.RabinKarp = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  function random() {
    if (typeof module !== 'undefined' && module.exports) return require('../utils/random.js');
    return scope.Random;
  }

  function emptyReport() {
    return { comparisons: 0, alignments: 0, shifts: 0, skipped: 0,
      preprocessing: 0, states: 0, hashHits: 0, spurious: 0, rolls: 0 };
  }

  const DEFAULT_MODULUS = 1000003;
  const DEFAULT_BASE = 257;

  /** `base^(m-1) mod modulus`, for removing the leading term. */
  function power(base, exponent, modulus) {
    let result = 1;

    for (let i = 0; i < exponent; i += 1) result = (result * base) % modulus;
    return result;
  }

  function hashOf(text, start, length, base, modulus) {
    let value = 0;

    for (let i = 0; i < length; i += 1) {
      value = (value * base + text.charCodeAt(start + i)) % modulus;
    }
    return value;
  }

  /**
   * The scan. Every hash hit is verified character by character, so a
   * collision costs a comparison run and never a wrong answer - the algorithm
   * is Monte Carlo only if the verification is skipped, which nobody should do
   * and everybody has seen done.
   */
  function search(text, pattern, options) {
    const settings = options || {};
    const report = settings.report || emptyReport();
    const positions = [];

    if (pattern.length === 0 || pattern.length > text.length) {
      return { positions: positions, report: report };
    }
    const base = settings.base || DEFAULT_BASE;
    const modulus = settings.modulus || DEFAULT_MODULUS;
    const m = pattern.length;
    const lead = power(base, m - 1, modulus);
    const target = hashOf(pattern, 0, m, base, modulus);
    let window = hashOf(text, 0, m, base, modulus);

    report.preprocessing += 2 * m;

    for (let start = 0; start + m <= text.length; start += 1) {
      report.alignments += 1;

      if (window === target) {
        report.hashHits += 1;

        if (verifyAt(text, pattern, start, report)) positions.push(start);
        else report.spurious += 1;
      }

      if (start + m >= text.length) break;
      window = roll(window, text.charCodeAt(start), text.charCodeAt(start + m),
        { base: base, modulus: modulus, lead: lead });
      report.rolls += 1;
    }
    return { positions: positions, report: report, base: base, modulus: modulus };
  }

  function verifyAt(text, pattern, start, report) {
    for (let i = 0; i < pattern.length; i += 1) {
      report.comparisons += 1;

      if (text[start + i] !== pattern[i]) return false;
    }
    return true;
  }

  /** Drop the leading term, shift, append. Two multiplications and an add. */
  function roll(value, outgoing, incoming, context) {
    let next = (value - outgoing * context.lead) % context.modulus;

    next = (next * context.base + incoming) % context.modulus;
    return next < 0 ? next + context.modulus : next;
  }

  /* ------------------------------------------------------- the adversary */

  /**
   * Two different strings with the same fingerprint, found by a birthday
   * search. A modulus of about a million has about a million residues, so
   * roughly sqrt(M) - a thousand or so - random strings are enough to find a
   * pair, and the search costs milliseconds. That is the whole argument
   * against a hard-coded base and modulus: the attacker does not have to be
   * clever, only patient for one second.
   */
  function collisionPair(length, options) {
    const settings = options || {};
    const base = settings.base || DEFAULT_BASE;
    const modulus = settings.modulus || DEFAULT_MODULUS;
    const rng = random().seeded(settings.seed || 1);
    const seen = new Map();
    const limit = settings.limit || 20000;
    /* A shared prefix makes each spurious verification cost more than one
       comparison, which is what turns a defeated filter into quadratic work. */
    const prefix = settings.prefix === undefined ? 'match' : settings.prefix;

    for (let examined = 1; examined <= limit; examined += 1) {
      const candidate = prefix + randomWord(rng, Math.max(1, length - prefix.length),
        settings.alphabet || 'abcdefghijklmnopqrstuvwxyz');
      const value = hashOf(candidate, 0, candidate.length, base, modulus);
      const previous = seen.get(value);

      if (previous !== undefined && previous !== candidate) {
        return { a: previous, b: candidate, hash: value, examined: examined,
          expected: Math.round(Math.sqrt(modulus)) };
      }
      seen.set(value, candidate);
    }
    return { a: null, b: null, examined: limit, expected: Math.round(Math.sqrt(modulus)) };
  }

  function randomWord(rng, length, alphabet) {
    let out = '';

    for (let i = 0; i < length; i += 1) out += alphabet[rng.int(alphabet.length)];
    return out;
  }

  /**
   * The attack, and the one-line defence. A text built by repeating the second
   * half of a colliding pair makes every aligned window hash to the pattern's
   * fingerprint, so every window is verified in full and the matcher does the
   * quadratic work it exists to avoid. Randomising the base per run breaks the
   * pair, because the pair was a solution for one base only.
   */
  function attackRun(options) {
    const settings = options || {};
    const length = settings.length || 16;
    const pair = collisionPair(length, { seed: settings.seed || 1 });

    if (!pair.a) return { built: false, examined: pair.examined, expected: pair.expected };
    const text = pair.b.repeat(settings.repeats || 200);
    const fixed = search(text, pair.a, { base: DEFAULT_BASE, modulus: DEFAULT_MODULUS });
    const rng = random().seeded((settings.seed || 1) + 77);
    const spurious = [];

    for (let trial = 0; trial < (settings.trials || 20); trial += 1) {
      spurious.push(search(text, pair.a,
        { base: 131 + 2 * rng.int(400), modulus: DEFAULT_MODULUS }).report.spurious);
    }
    const clean = search(text, pair.a, { base: 1000003 % 97, modulus: 999999937 });

    return { built: true, pattern: pair.a, block: pair.b, hash: pair.hash,
      examined: pair.examined, expected: pair.expected,
      textLength: text.length, fixedSpurious: fixed.report.spurious,
      fixedComparisons: fixed.report.comparisons,
      randomisedWorst: Math.max.apply(null, spurious),
      randomisedTotal: spurious.reduce(function (a, b) { return a + b; }, 0),
      widerModulus: clean.report.spurious, trials: spurious.length };
  }

  /* ---------------------------------------------- content-defined chunking */

  /**
   * Cut wherever the rolling hash of the last `window` bytes has enough low
   * zero bits. Because the boundary depends on the CONTENT of the window and
   * not on the offset, inserting a byte moves one boundary and leaves every
   * other chunk byte-identical - which is the entire reason rsync and every
   * modern backup tool transfer so little.
   */
  function chunk(text, options) {
    const settings = options || {};
    const window = settings.window || 16;
    const mask = (1 << (settings.bits || 6)) - 1;
    const base = settings.base || DEFAULT_BASE;
    const modulus = settings.modulus || DEFAULT_MODULUS;
    const minimum = settings.minimum || 8;
    const boundaries = [];

    if (text.length <= window) return { boundaries: [text.length], chunks: [text] };
    const lead = power(base, window - 1, modulus);
    let value = hashOf(text, 0, window, base, modulus);
    let last = 0;

    for (let at = window; at < text.length; at += 1) {
      if ((value & mask) === 0 && at - last >= minimum) {
        boundaries.push(at);
        last = at;
      }
      value = roll(value, text.charCodeAt(at - window), text.charCodeAt(at),
        { base: base, modulus: modulus, lead: lead });
    }
    boundaries.push(text.length);
    return { boundaries: boundaries, chunks: sliceAt(text, boundaries) };
  }

  function sliceAt(text, boundaries) {
    const out = [];
    let from = 0;

    boundaries.forEach(function (at) {
      out.push(text.slice(from, at));
      from = at;
    });
    return out;
  }

  /**
   * Insert a byte and count how many chunks survive unchanged, against a
   * fixed-size chunker on the same edit. The fixed-size one loses everything
   * after the insertion point; the content-defined one loses one chunk.
   */
  function insertionRun(text, options) {
    const settings = options || {};
    const at = settings.at === undefined ? Math.floor(text.length / 3) : settings.at;
    const edited = text.slice(0, at) + (settings.insert || 'X') + text.slice(at);
    const before = chunk(text, settings);
    const after = chunk(edited, settings);
    const shared = sharedChunks(before.chunks, after.chunks);
    const size = settings.fixed || 32;
    const fixedBefore = fixedChunks(text, size);
    const fixedAfter = fixedChunks(edited, size);

    return { chunksBefore: before.chunks.length, chunksAfter: after.chunks.length,
      shared: shared, sharedFraction: shared / before.chunks.length,
      fixedBefore: fixedBefore.length, fixedAfter: fixedAfter.length,
      fixedShared: sharedChunks(fixedBefore, fixedAfter),
      meanChunk: text.length / before.chunks.length };
  }

  function fixedChunks(text, size) {
    const out = [];

    for (let at = 0; at < text.length; at += size) out.push(text.slice(at, at + size));
    return out;
  }

  /** How many chunks of the first list appear in the second, counting
   *  multiplicity - which is what a deduplicating store actually asks. */
  function sharedChunks(before, after) {
    const counts = {};

    after.forEach(function (piece) { counts[piece] = (counts[piece] || 0) + 1; });
    let shared = 0;

    before.forEach(function (piece) {
      if (!counts[piece]) return;
      counts[piece] -= 1;
      shared += 1;
    });
    return shared;
  }

  return {
    emptyReport: emptyReport, DEFAULT_BASE: DEFAULT_BASE, DEFAULT_MODULUS: DEFAULT_MODULUS,
    hashOf: hashOf, roll: roll, power: power, search: search,
    collisionPair: collisionPair, attackRun: attackRun,
    chunk: chunk, insertionRun: insertionRun, sharedChunks: sharedChunks, fixedChunks: fixedChunks
  };
}));

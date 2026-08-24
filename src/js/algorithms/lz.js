/**
 * Dictionary compression: the past as the dictionary.
 *
 * LZ77 replaces a repeat with a pointer backwards — (distance, length) — and
 * that is the whole idea. Everything that makes one LZ implementation better
 * than another is MATCH FINDING: how hard it looks for the longest repeat, and
 * how much CPU it will spend to find it. "Level 9" in gzip, zstd or brotli is
 * almost never a different algorithm; it is the same algorithm searching
 * harder, and this module makes that measurable by exposing the search depth as
 * a parameter and reporting both ratio and comparisons.
 *
 * Two decisions matter and both are here:
 *
 * - The WINDOW is how far back a pointer can reach. A bigger window finds more
 *   matches and costs memory in the decoder as well as the encoder, which is
 *   why formats fix it in the header rather than leaving it to the encoder.
 * - LAZY MATCHING asks, after finding a match at position i, whether a longer
 *   one starts at i + 1; if so it emits a literal and takes the better match.
 *   It is a one-symbol lookahead and it is worth a few per cent for a constant
 *   factor of work.
 *
 * LZ78 and LZW build an explicit dictionary instead, adding one entry per
 * token. LZW is what GIF and Unix compress used; it needs no distance field at
 * all, which made it cheap in 1984 and makes it worse than LZ77 now.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.Lz = api;
}(this, function () {
  'use strict';

  const MIN_MATCH = 3;

  function defaults(options) {
    const settings = options || {};

    return {
      window: settings.window === undefined ? 4096 : settings.window,
      lookahead: settings.lookahead === undefined ? 258 : settings.lookahead,
      depth: settings.depth === undefined ? 16 : settings.depth,
      lazy: settings.lazy === undefined ? false : settings.lazy,
      minMatch: settings.minMatch === undefined ? MIN_MATCH : settings.minMatch
    };
  }

  /* ------------------------------------------------------- hash chains */

  /**
   * The match finder every real LZ77 uses: a hash of the next three bytes
   * indexes a chain of earlier positions with the same three bytes, walked
   * newest first and cut off after `depth` links. The cut-off is the
   * compression level: it bounds the work per position and therefore bounds
   * the match quality.
   */
  function chains(data, minMatch) {
    return { heads: new Map(), previous: new Int32Array(data.length).fill(-1),
      minMatch: minMatch };
  }

  function keyAt(data, at, minMatch) {
    let key = 0;

    for (let i = 0; i < minMatch && at + i < data.length; i += 1) {
      key = (key * 257 + data[at + i]) % 1048573;
    }
    return key;
  }

  function insert(state, data, at) {
    const key = keyAt(data, at, state.minMatch);
    const head = state.heads.has(key) ? state.heads.get(key) : -1;

    state.previous[at] = head;
    state.heads.set(key, at);
  }

  /** Longest match at `at`, searching at most `depth` chain links. */
  function findMatch(state, data, at, settings) {
    const key = keyAt(data, at, state.minMatch);
    let candidate = state.heads.has(key) ? state.heads.get(key) : -1;
    let best = { length: 0, distance: 0 };
    let links = 0;
    const limit = Math.min(data.length - at, settings.lookahead);

    while (candidate >= 0 && links < settings.depth) {
      if (at - candidate > settings.window) break;
      links += 1;
      const length = matchLength(data, candidate, at, limit);

      if (length > best.length) {
        best = { length: length, distance: at - candidate };
        if (length >= limit) break;
      }
      candidate = state.previous[candidate];
    }
    return { match: best, links: links };
  }

  function matchLength(data, from, at, limit) {
    let length = 0;

    while (length < limit && data[from + length] === data[at + length]) length += 1;
    return length;
  }

  /* ------------------------------------------------------------- LZSS */

  /**
   * LZSS is LZ77 with a flag bit per token, so a match that would not pay for
   * itself is emitted as a literal instead. Plain LZ77 emits a (distance,
   * length, next) triple for every position and therefore EXPANDS
   * incompressible data; LZSS costs one bit per literal instead.
   */
  function compress(data, options) {
    const settings = defaults(options);
    const state = chains(data, settings.minMatch);
    const tokens = [];
    let at = 0;
    let comparisons = 0;

    while (at < data.length) {
      const found = findMatch(state, data, at, settings);

      comparisons += found.links;
      const step = emitAt({ data: data, state: state, tokens: tokens },
        { at: at, found: found, settings: settings });

      comparisons += step.comparisons;
      at += step.advance;
    }
    return summarise(tokens, data, comparisons, settings);
  }

  /**
   * One position: take the match, or - with lazy matching on - look one byte
   * ahead first and prefer a longer match starting there, emitting a literal.
   */
  function emitAt(context, step) {
    const settings = step.settings;
    const at = step.at;
    let match = step.found.match;
    let comparisons = 0;

    if (settings.lazy && match.length >= settings.minMatch && at + 1 < context.data.length) {
      const next = findMatch(context.state, context.data, at + 1, settings);

      comparisons = next.links;
      if (next.match.length > match.length) match = { length: 0, distance: 0 };
    }
    if (match.length < settings.minMatch) {
      context.tokens.push({ kind: 'literal', value: context.data[at] });
      insert(context.state, context.data, at);
      return { advance: 1, comparisons: comparisons };
    }
    context.tokens.push({ kind: 'match', distance: match.distance, length: match.length, at: at });
    for (let i = 0; i < match.length; i += 1) insert(context.state, context.data, at + i);
    return { advance: match.length, comparisons: comparisons };
  }

  /**
   * The token stream costed the way a real format does: a literal is a flag
   * plus a byte, a match is a flag plus a distance and a length. Reporting a
   * token count rather than a bit count is the standard way an LZ demo
   * overstates its ratio, so this reports bits.
   */
  function summarise(tokens, data, comparisons, settings) {
    const distanceBits = Math.max(1, Math.ceil(Math.log2(settings.window)));
    const lengthBits = Math.max(1, Math.ceil(Math.log2(settings.lookahead)));
    let literals = 0;
    let matches = 0;
    let matchedBytes = 0;
    let bits = 0;

    tokens.forEach(function (token) {
      if (token.kind === 'literal') {
        literals += 1;
        bits += 9;
        return;
      }
      matches += 1;
      matchedBytes += token.length;
      bits += 1 + distanceBits + lengthBits;
    });
    return {
      tokens: tokens, literals: literals, matches: matches, matchedBytes: matchedBytes,
      bits: bits, bytes: Math.ceil(bits / 8), comparisons: comparisons,
      inputBytes: data.length,
      ratio: data.length === 0 ? 1 : data.length / Math.ceil(bits / 8),
      settings: settings
    };
  }

  /** Decompression is the cheap half, which is the whole shape of LZ: an
   *  overlapping copy is legal and is how run-length encoding falls out. */
  function decompress(tokens) {
    const out = [];

    tokens.forEach(function (token) {
      if (token.kind === 'literal') {
        out.push(token.value);
        return;
      }
      const from = out.length - token.distance;

      for (let i = 0; i < token.length; i += 1) out.push(out[from + i]);
    });
    return out;
  }

  /* --------------------------------------------------------- LZ78 / LZW */

  /**
   * LZW: the dictionary starts as the alphabet and grows by one entry per
   * token, so no distance is ever transmitted. The decoder rebuilds the same
   * dictionary from the same tokens - including the famous case where a code
   * arrives one step before its dictionary entry exists, which is handled by
   * the `previous + previous[0]` rule below rather than by an error.
   */
  function lzwCompress(data, alphabetSize) {
    const size = alphabetSize === undefined ? 256 : alphabetSize;
    const dictionary = new Map();
    let next = size;
    const codes = [];
    let current = '';

    for (let i = 0; i < data.length; i += 1) {
      const candidate = current === '' ? String(data[i]) : current + ',' + data[i];

      if (current === '' || dictionary.has(candidate)) {
        current = candidate;
        continue;
      }
      codes.push(codeFor(dictionary, current, size));
      dictionary.set(candidate, next);
      next += 1;
      current = String(data[i]);
    }
    if (current !== '') codes.push(codeFor(dictionary, current, size));
    const codeBits = Math.max(1, Math.ceil(Math.log2(next)));

    return { codes: codes, entries: next - size, codeBits: codeBits,
      bits: codes.length * codeBits, bytes: Math.ceil(codes.length * codeBits / 8),
      inputBytes: data.length,
      ratio: data.length === 0 ? 1 : data.length / Math.max(1, Math.ceil(codes.length * codeBits / 8)) };
  }

  function codeFor(dictionary, key, size) {
    if (dictionary.has(key)) return dictionary.get(key);
    return Number(key);
  }

  function lzwDecompress(codes, alphabetSize) {
    const size = alphabetSize === undefined ? 256 : alphabetSize;
    const dictionary = [];

    for (let i = 0; i < size; i += 1) dictionary.push([i]);
    const out = [];
    let previous = null;

    codes.forEach(function (code) {
      let entry;

      if (code < dictionary.length) entry = dictionary[code].slice();
      else entry = previous.concat([previous[0]]);
      entry.forEach(function (byte) { out.push(byte); });
      if (previous) dictionary.push(previous.concat([entry[0]]));
      previous = entry;
    });
    return out;
  }

  /** A sweep over search depth: the compression-level ladder, measured. */
  function depthSweep(data, depths, options) {
    return depths.map(function (depth) {
      const result = compress(data, Object.assign({}, options || {}, { depth: depth }));

      return { depth: depth, bytes: result.bytes, ratio: result.ratio,
        comparisons: result.comparisons, matches: result.matches,
        matchedBytes: result.matchedBytes,
        comparisonsPerByte: data.length === 0 ? 0 : result.comparisons / data.length };
    });
  }

  /** A sweep over window size, which is the decoder's memory as well. */
  function windowSweep(data, windows, options) {
    return windows.map(function (size) {
      const result = compress(data, Object.assign({}, options || {}, { window: size }));

      return { window: size, bytes: result.bytes, ratio: result.ratio,
        matches: result.matches, comparisons: result.comparisons };
    });
  }

  return {
    MIN_MATCH: MIN_MATCH, defaults: defaults,
    chains: chains, insert: insert, findMatch: findMatch, matchLength: matchLength,
    compress: compress, decompress: decompress,
    lzwCompress: lzwCompress, lzwDecompress: lzwDecompress,
    depthSweep: depthSweep, windowSweep: windowSweep
  };
}));

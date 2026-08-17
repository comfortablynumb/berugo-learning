/**
 * The Burrows-Wheeler transform and the FM-index built on it.
 *
 * The transform sorts every rotation of `text$` and takes the last column. It
 * is reversible, which is surprising, and the reason is the **LF mapping**:
 * the i-th occurrence of a character c in the last column is the same
 * occurrence as the i-th c in the first column. The first column is just the
 * sorted characters, so it never has to be stored - a count table `C[c]` (how
 * many characters sort before c) plus a rank structure over the last column is
 * enough to walk the original string backwards, one character per step.
 *
 * That same machinery is a *search index*. Backward search takes the pattern
 * right to left and maintains the suffix-array range of rows prefixed by the
 * suffix of the pattern read so far:
 *
 *     first = C[c] + rank(c, first)
 *     last  = C[c] + rank(c, last)
 *
 * Each step is two rank queries, so counting occurrences of a pattern of
 * length m costs O(m) - independent of the text length, and without ever
 * reconstructing the text. The index *is* the compressed text, which is why a
 * read aligner can search a 3-gigabase genome in a couple of gigabytes.
 *
 * Two rank implementations are here because the choice is the section's point:
 * `scan` walks the last column (O(n) per query, no space) and `sampled`
 * stores a checkpoint every `blockSize` positions (O(blockSize) per query,
 * `alphabet · n / blockSize` integers of space). The block size is the dial
 * between the two, and it is the same dial a real FM-index exposes.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Bwt = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  /* A character that sorts before every printable one, so row 0 of the sorted
     matrix is always the sentinel's rotation and the LF walk has a fixed
     starting point. Built with fromCharCode so the source carries no
     control character and no escape sequence. */
  const SENTINEL = String.fromCharCode(1);

  function newStats() {
    return { rankQueries: 0, rankSteps: 0, backwardSteps: 0, lfSteps: 0, checkpoints: 0 };
  }

  /** The rotation matrix, for short inputs only - it is O(n²) characters and
   *  exists so the demo can show what the transform is defined as before the
   *  suffix-array shortcut replaces it. */
  function rotations(text) {
    const rows = [];
    for (let i = 0; i < text.length; i += 1) rows.push(text.slice(i) + text.slice(0, i));
    return rows.slice().sort();
  }

  /** The transform. The suffix array gives it directly: row i of the sorted
   *  rotation matrix is the suffix starting at sa[i], so its last character is
   *  the one just before that suffix. */
  function transform(input, suffixArrayOf) {
    if (input.indexOf(SENTINEL) !== -1) {
      throw new Error('bwt: the input already contains the sentinel character');
    }
    const text = input + SENTINEL;
    const sa = suffixArrayOf(text);
    let last = '';
    for (let i = 0; i < sa.length; i += 1) {
      last += text[(sa[i] - 1 + text.length) % text.length];
    }
    return { last: last, sa: sa, text: text };
  }

  /** Characters in sorted order with the count of everything before each: the
   *  first column, stored as a table of size |alphabet| rather than of size n. */
  function countTable(last) {
    const tally = new Map();
    for (let i = 0; i < last.length; i += 1) {
      tally.set(last[i], (tally.get(last[i]) || 0) + 1);
    }
    const symbols = Array.from(tally.keys()).sort();
    const before = new Map();
    let sum = 0;
    symbols.forEach(function (symbol) {
      before.set(symbol, sum);
      sum += tally.get(symbol);
    });
    return { symbols: symbols, before: before, tally: tally };
  }

  /** rank(c, i) = occurrences of c in last[0 .. i). Two backends. */
  function makeRank(last, mode, blockSize, stats) {
    if (mode !== 'sampled') {
      return {
        mode: 'scan',
        bytes: 0,
        query: function (symbol, upTo) {
          stats.rankQueries += 1;
          let count = 0;
          for (let i = 0; i < upTo; i += 1) {
            stats.rankSteps += 1;
            if (last[i] === symbol) count += 1;
          }
          return count;
        }
      };
    }

    const symbols = Array.from(new Set(last.split(''))).sort();
    const index = new Map();
    symbols.forEach(function (symbol, at) { index.set(symbol, at); });

    const blocks = Math.floor(last.length / blockSize) + 1;
    const checkpoints = new Array(blocks * symbols.length).fill(0);
    const running = new Array(symbols.length).fill(0);

    for (let i = 0; i < last.length; i += 1) {
      if (i % blockSize === 0) {
        for (let s = 0; s < symbols.length; s += 1) checkpoints[(i / blockSize) * symbols.length + s] = running[s];
      }
      running[index.get(last[i])] += 1;
    }

    return {
      mode: 'sampled',
      blockSize: blockSize,
      bytes: checkpoints.length * 4,
      checkpoints: checkpoints.length,
      query: function (symbol, upTo) {
        stats.rankQueries += 1;
        const at = index.get(symbol);
        if (at === undefined) return 0;
        const block = Math.floor(upTo / blockSize);
        stats.checkpoints += 1;
        let count = checkpoints[block * symbols.length + at];
        for (let i = block * blockSize; i < upTo; i += 1) {
          stats.rankSteps += 1;
          if (last[i] === symbol) count += 1;
        }
        return count;
      }
    };
  }

  /** The FM-index: the last column, the count table, a rank structure, and a
   *  sampled suffix array so a match can report *where* as well as how many. */
  function fmIndex(input, options) {
    const settings = options || {};
    const stats = newStats();
    const built = transform(input, settings.suffixArrayOf);
    const last = built.last;
    const counts = countTable(last);
    const rank = makeRank(last, settings.rank || 'sampled', settings.blockSize || 32, stats);
    const sampleEvery = settings.sampleEvery || 16;

    const samples = new Map();
    built.sa.forEach(function (at, row) {
      if (at % sampleEvery === 0) samples.set(row, at);
    });

    /** One LF step: which row holds the rotation one character earlier. */
    function lf(row) {
      stats.lfSteps += 1;
      const symbol = last[row];
      return counts.before.get(symbol) + rank.query(symbol, row);
    }

    /** Walk LF from row 0 to recover the text - the transform's inverse, in
     *  O(n) rank queries and without the matrix. */
    function inverse() {
      let row = 0;
      const out = new Array(last.length - 1);
      /* Row 0 is the sentinel's rotation, so last[0] is the final character of
         the text. Read first, then step - stepping first drops it. */
      for (let i = last.length - 2; i >= 0; i -= 1) {
        out[i] = last[row];
        row = lf(row);
      }
      return out.join('');
    }

    /** Backward search: the suffix-array range of rows prefixed by `pattern`. */
    function rangeOf(pattern) {
      let first = 0;
      let lastRow = last.length;

      for (let i = pattern.length - 1; i >= 0; i -= 1) {
        stats.backwardSteps += 1;
        const symbol = pattern[i];
        if (!counts.before.has(symbol)) return { first: 0, last: 0, count: 0 };
        first = counts.before.get(symbol) + rank.query(symbol, first);
        lastRow = counts.before.get(symbol) + rank.query(symbol, lastRow);
        if (first >= lastRow) return { first: 0, last: 0, count: 0 };
      }
      return { first: first, last: lastRow, count: lastRow - first };
    }

    function count(pattern) {
      return pattern.length ? rangeOf(pattern).count : 0;
    }

    /** Where a row's suffix starts: walk LF until a sampled row is hit, then
     *  add the number of steps. This is why the sampled array is a space dial
     *  and not a correctness one. */
    function locateRow(row) {
      let at = row;
      let steps = 0;
      while (!samples.has(at)) {
        at = lf(at);
        steps += 1;
        if (steps > last.length) throw new Error('bwt: the LF walk did not terminate');
      }
      return samples.get(at) + steps;
    }

    function locate(pattern) {
      const range = rangeOf(pattern);
      const out = [];
      for (let row = range.first; row < range.last; row += 1) out.push(locateRow(row));
      return out.sort(function (a, b) { return a - b; });
    }

    /** Runs in the last column: what makes the transform compressible. English
     *  and log text run heavily; random text does not. */
    function runs() {
      let total = 1;
      for (let i = 1; i < last.length; i += 1) if (last[i] !== last[i - 1]) total += 1;
      return total;
    }

    function checkInvariants() {
      const errors = [];
      if (inverse() !== input) errors.push('the transform does not round-trip');
      if (last.length !== input.length + 1) errors.push('the last column is the wrong length');

      const sortedLast = last.split('').sort().join('');
      const firstColumn = built.text.split('').sort().join('');
      if (sortedLast !== firstColumn) errors.push('the last column is not a permutation of the text');

      /* Every row must be reachable by LF exactly once: LF is a bijection. */
      const hit = new Array(last.length).fill(0);
      for (let row = 0; row < last.length; row += 1) hit[lf(row)] += 1;
      if (hit.some(function (n) { return n !== 1; })) errors.push('LF is not a bijection over the rows');

      return { ok: errors.length === 0, errors: errors.slice(0, 5) };
    }

    return {
      name: 'fm-index-' + rank.mode,
      input: input,
      last: last,
      sa: built.sa,
      firstColumn: function () { return built.text.split('').sort().join(''); },
      counts: counts,
      rankMode: rank.mode,
      rankBytes: rank.bytes,
      sampleEvery: sampleEvery,
      lf: lf,
      inverse: inverse,
      rangeOf: rangeOf,
      count: count,
      locate: locate,
      runs: runs,
      /* The last column plus the rank checkpoints plus the sampled array. */
      bytes: function () { return last.length + rank.bytes + samples.size * 4; },
      bytesPerChar: function () {
        return (last.length + rank.bytes + samples.size * 4) / Math.max(1, input.length);
      },
      checkInvariants: checkInvariants,
      stats: function () { return Object.assign({ length: last.length }, stats); },
      resetStats: function () { Object.keys(stats).forEach(function (key) { stats[key] = 0; }); }
    };
  }

  return {
    SENTINEL: SENTINEL,
    rotations: rotations,
    transform: transform,
    countTable: countTable,
    fmIndex: fmIndex,
    newStats: newStats
  };
}));

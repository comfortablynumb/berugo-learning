/**
 * Approximate matching: bitap, banded DP, and the prefilter that decides the
 * throughput of the whole thing.
 *
 * Bitap keeps the whole state of the match as bits in a machine word: bit j of
 * the state is set when the first j+1 pattern characters match ending here.
 * One shift and one OR advance every position at once, so a 32-character
 * pattern costs the same as a 1-character one - and a 33-character pattern
 * costs twice as much, because the word ran out. That cliff is the entire
 * design constraint of `agrep`-style tools and it is worth seeing rather than
 * reading about.
 *
 * The banded DP is the other half: full edit distance is O(nm), but if the
 * answer is known to be at most k then only a band of width 2k+1 around the
 * diagonal can contain it, and everything outside is unreachable. The band is
 * a correct restriction, not a heuristic - which is what separates it from the
 * q-gram prefilter below, which is a heuristic and says so.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ApproximateMatch = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const WORD_BITS = 32;

  function emptyReport() {
    return { comparisons: 0, cells: 0, words: 0, candidates: 0, verified: 0,
      rejected: 0, positions: 0 };
  }

  /**
   * Exact bitap (Shift-Or). `mask[c]` has a 0 at every position where the
   * pattern holds c; the state starts all-ones and a 0 in bit j means "the
   * first j+1 characters match ending here". A match is a 0 in bit m-1.
   */
  function bitapExact(text, pattern, options) {
    const report = (options || {}).report || emptyReport();
    const m = pattern.length;
    const positions = [];

    if (m === 0 || m > WORD_BITS) return { positions: positions, report: report, refused: m > WORD_BITS };
    const mask = maskFor(pattern);
    let state = ~0;

    for (let i = 0; i < text.length; i += 1) {
      report.words += 1;
      report.comparisons += 1;
      state = (state << 1) | (mask[text[i]] === undefined ? ~0 : mask[text[i]]);

      if ((state & (1 << (m - 1))) !== 0) continue;
      positions.push(i - m + 1);
    }
    return { positions: positions, report: report, refused: false };
  }

  function maskFor(pattern) {
    const mask = {};

    for (let i = 0; i < pattern.length; i += 1) {
      if (mask[pattern[i]] === undefined) mask[pattern[i]] = ~0;
      mask[pattern[i]] &= ~(1 << i);
    }
    return mask;
  }

  /**
   * Bitap with up to k errors (Wu-Manber): one state word per error level,
   * each the intersection of four terms - match, substitution, insertion and
   * deletion - taken from itself and from the level below. The cost is k+1
   * words per character, which is why the algorithm is called bit-PARALLEL
   * rather than bit-magic: the parallelism is over pattern positions, not over
   * error counts.
   */
  function bitapFuzzy(text, pattern, k, options) {
    const report = (options || {}).report || emptyReport();
    const m = pattern.length;
    const positions = [];

    if (m === 0 || m > WORD_BITS) return { positions: positions, report: report, refused: m > WORD_BITS };
    const mask = maskFor(pattern);
    const state = [];

    for (let level = 0; level <= k; level += 1) state.push(~0 << level);

    for (let i = 0; i < text.length; i += 1) {
      const symbol = mask[text[i]] === undefined ? ~0 : mask[text[i]];
      /* Wu-Manber needs BOTH the previous character's word at this level and
         the previous level's word at both characters, so the old row has to be
         kept whole rather than carried one value at a time. */
      const before = state.slice();

      state[0] = (before[0] << 1) | symbol;
      report.words += 1;

      for (let level = 1; level <= k; level += 1) {
        state[level] = ((before[level] << 1) | symbol)   // match
          & (before[level - 1] << 1)                     // substitution
          & (state[level - 1] << 1)                      // insertion
          & before[level - 1];                           // deletion
        report.words += 1;
      }
      report.comparisons += 1;

      if ((state[k] & (1 << (m - 1))) !== 0) continue;
      positions.push(i);
    }
    return { positions: positions, report: report, refused: false };
  }

  /* ------------------------------------------------------------ banded DP */

  /**
   * Edit distance with a cutoff. Only the cells within k of the diagonal can
   * hold a value at most k, so the rest are never computed - and the answer is
   * exact whenever it is at most k, and reported as "> k" otherwise. That
   * honesty is the point: a banded run that returns a number above the band is
   * returning an artefact of the band.
   */
  function bandedDistance(a, b, k, options) {
    const report = (options || {}).report || emptyReport();

    if (Math.abs(a.length - b.length) > k) {
      return { distance: k + 1, exact: false, report: report, refused: true };
    }
    let previous = new Array(b.length + 1).fill(k + 1);
    let current = new Array(b.length + 1).fill(k + 1);

    for (let j = 0; j <= Math.min(b.length, k); j += 1) previous[j] = j;

    for (let i = 1; i <= a.length; i += 1) {
      const from = Math.max(1, i - k);
      const to = Math.min(b.length, i + k);

      current = new Array(b.length + 1).fill(k + 1);

      if (i <= k) current[0] = i;

      for (let j = from; j <= to; j += 1) {
        report.cells += 1;
        report.comparisons += 1;
        const substitution = previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);

        current[j] = Math.min(substitution, previous[j] + 1, current[j - 1] + 1);
      }
      previous = current;
    }
    const distance = previous[b.length];

    return { distance: Math.min(distance, k + 1), exact: distance <= k,
      report: report, refused: false };
  }

  /** The full O(nm) grid, as the oracle. */
  function editDistance(a, b, options) {
    const report = (options || {}).report || emptyReport();
    let previous = [];

    for (let j = 0; j <= b.length; j += 1) previous.push(j);

    for (let i = 1; i <= a.length; i += 1) {
      const current = [i];

      for (let j = 1; j <= b.length; j += 1) {
        report.cells += 1;
        current.push(Math.min(previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
          previous[j] + 1, current[j - 1] + 1));
      }
      previous = current;
    }
    return { distance: previous[b.length], report: report };
  }

  /**
   * Every end position whose best alignment with the pattern costs at most k,
   * by DP with a free start - the reference the bit-parallel version is
   * checked against.
   */
  function searchByDp(text, pattern, k, options) {
    const report = (options || {}).report || emptyReport();
    const m = pattern.length;
    const positions = [];
    let previous = new Array(m + 1).fill(0);

    for (let j = 0; j <= m; j += 1) previous[j] = j;

    for (let i = 1; i <= text.length; i += 1) {
      const current = [0];

      for (let j = 1; j <= m; j += 1) {
        report.cells += 1;
        current.push(Math.min(previous[j - 1] + (text[i - 1] === pattern[j - 1] ? 0 : 1),
          previous[j] + 1, current[j - 1] + 1));
      }
      previous = current;

      if (previous[m] > k) continue;
      positions.push(i - 1);
    }
    return { positions: positions, report: report };
  }

  /* ---------------------------------------------------------- prefiltering */

  /**
   * The q-gram lemma: a pattern of length m and a match within k errors must
   * share at least `m - q + 1 - k·q` q-grams with it. When that count is
   * positive it is a genuine filter with no false negatives; when it is zero
   * or below, the filter admits everything and is pure overhead - which is a
   * condition on q, k and m that every implementation should check and most
   * do not.
   */
  function qgramThreshold(m, q, k) {
    return { threshold: m - q + 1 - k * q, usable: m - q + 1 - k * q > 0, q: q, k: k, m: m };
  }

  function qgramsOf(text, q) {
    const out = new Map();

    for (let i = 0; i + q <= text.length; i += 1) {
      const gram = text.substr(i, q);

      out.set(gram, (out.get(gram) || 0) + 1);
    }
    return out;
  }

  /**
   * Filter then verify. The candidate count and the result count are both
   * reported, because candidates-per-result is the number that decides the
   * throughput of every matching pipeline and the verifier's speed is not.
   */
  function filteredSearch(text, pattern, k, options) {
    const settings = options || {};
    const report = settings.report || emptyReport();
    const q = settings.q || 3;
    const m = pattern.length;
    const rule = qgramThreshold(m, q, k);
    const wanted = qgramsOf(pattern, q);
    const positions = [];
    const window = m + k;

    for (let start = 0; start + m - k <= text.length; start += 1) {
      report.positions += 1;
      const shared = sharedGrams(text.substr(start, window), wanted, q);

      if (rule.usable && shared < rule.threshold) { report.rejected += 1; continue; }
      report.candidates += 1;
      const best = bestSuffixDistance(text.substr(start, window), pattern, k, report);

      if (best > k) continue;
      report.verified += 1;
      positions.push(start);
    }
    return { positions: positions, report: report, rule: rule,
      selectivity: report.candidates / Math.max(1, report.positions) };
  }

  function sharedGrams(window, wanted, q) {
    const have = qgramsOf(window, q);
    let shared = 0;

    wanted.forEach(function (count, gram) {
      shared += Math.min(count, have.get(gram) || 0);
    });
    return shared;
  }

  /** The cheapest alignment of the pattern against a prefix of the window. */
  function bestSuffixDistance(window, pattern, k, report) {
    let best = k + 1;

    for (let length = Math.max(1, pattern.length - k);
      length <= Math.min(window.length, pattern.length + k); length += 1) {
      const run = bandedDistance(window.slice(0, length), pattern, k, { report: report });

      best = Math.min(best, run.distance);
    }
    return best;
  }

  return {
    emptyReport: emptyReport, WORD_BITS: WORD_BITS,
    bitapExact: bitapExact, bitapFuzzy: bitapFuzzy, maskFor: maskFor,
    bandedDistance: bandedDistance, editDistance: editDistance, searchByDp: searchByDp,
    qgramThreshold: qgramThreshold, qgramsOf: qgramsOf, filteredSearch: filteredSearch
  };
}));

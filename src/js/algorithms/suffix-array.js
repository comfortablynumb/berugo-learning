/**
 * Suffix arrays: the sorted list of a string's suffix start positions, plus
 * the LCP array that makes it as powerful as a suffix tree.
 *
 * Three constructions are here on purpose, because the section is about what
 * they cost rather than about having one that works:
 *
 *   - `naive`    — sort the suffixes with string comparison. O(n² log n) in
 *                  the worst case because each comparison is O(n), and it is
 *                  here only as the reference the other two are checked
 *                  against.
 *   - `doubling` — Manber and Myers: sort by the first character, then use the
 *                  ranks to sort by the first 2, 4, 8 … characters. log n
 *                  rounds, each a sort of pairs, so O(n log² n) with a
 *                  comparison sort and O(n log n) with a radix sort. The rank
 *                  table after each round is what the demo shows, because that
 *                  table *is* the algorithm.
 *   - `sais`     — Nong, Zhang and Chan: classify each position as S or L,
 *                  place the LMS substrings by induced sorting, recurse on the
 *                  reduced string, then induce the full order twice. Linear,
 *                  and the construction every real implementation uses.
 *
 * Kasai's LCP walk is the other half. It computes lcp[i] in amortised O(1) by
 * going through the suffixes in *text* order rather than array order: dropping
 * the first character of a suffix can shorten its LCP with its neighbour by at
 * most one, so the counter only ever falls by one per step and rises to at
 * most n overall.
 *
 * The pattern search is a binary search over the array, O(m log n), and it is
 * what a suffix array is actually used for.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SuffixArray = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function newStats() {
    return { comparisons: 0, rounds: 0, charComparisons: 0, lcpSteps: 0, buckets: 0, recursions: 0, inducedPasses: 0 };
  }

  /* ------------------------------------------------------------- naive */

  function naive(text, stats) {
    const order = [];
    for (let i = 0; i < text.length; i += 1) order.push(i);

    order.sort(function (a, b) {
      stats.comparisons += 1;
      const left = text.slice(a);
      const right = text.slice(b);
      stats.charComparisons += Math.min(left.length, right.length);
      if (left < right) return -1;
      return left > right ? 1 : 0;
    });
    return order;
  }

  /* ---------------------------------------------------------- doubling */

  /** One round: re-rank by the pair (rank[i], rank[i + step]). */
  function rerank(order, rank, step, stats) {
    const next = new Array(rank.length).fill(0);
    const keyOf = function (i) { return i + step < rank.length ? rank[i + step] : -1; };

    for (let i = 1; i < order.length; i += 1) {
      const a = order[i - 1];
      const b = order[i];
      stats.comparisons += 1;
      const same = rank[a] === rank[b] && keyOf(a) === keyOf(b);
      next[b] = next[a] + (same ? 0 : 1);
    }
    return next;
  }

  /** Manber-Myers prefix doubling. `trace` collects the rank table after each
   *  round, which is the only way to see what the algorithm is doing. */
  function doubling(text, stats, trace) {
    const n = text.length;
    const order = [];
    for (let i = 0; i < n; i += 1) order.push(i);

    let rank = new Array(n);
    for (let i = 0; i < n; i += 1) rank[i] = text.charCodeAt(i);

    order.sort(function (a, b) { stats.comparisons += 1; return rank[a] - rank[b]; });
    rank = rerank(order, rank, 0, stats);

    for (let step = 1; step < n; step *= 2) {
      stats.rounds += 1;
      const keyOf = function (i) { return i + step < n ? rank[i + step] : -1; };

      order.sort(function (a, b) {
        stats.comparisons += 1;
        if (rank[a] !== rank[b]) return rank[a] - rank[b];
        return keyOf(a) - keyOf(b);
      });
      rank = rerank(order, rank, step, stats);

      if (trace) trace.push({ step: step * 2, order: order.slice(), rank: rank.slice() });
      if (rank[order[n - 1]] === n - 1) break;
    }
    return order;
  }

  /* -------------------------------------------------------------- SA-IS */

  /** Position i is S-type when suffix i sorts before suffix i + 1, L-type
   *  otherwise. The last position is S by convention (the sentinel). */
  function classify(values) {
    const n = values.length;
    const isS = new Array(n).fill(false);
    isS[n - 1] = true;

    for (let i = n - 2; i >= 0; i -= 1) {
      if (values[i] < values[i + 1]) isS[i] = true;
      else if (values[i] > values[i + 1]) isS[i] = false;
      else isS[i] = isS[i + 1];
    }
    return isS;
  }

  /** An LMS position is an S-type whose predecessor is L-type: the left end of
   *  an LMS substring, and the seed the whole induction grows from. */
  function isLms(isS, i) {
    return i > 0 && isS[i] && !isS[i - 1];
  }

  function bucketSizes(values, alphabet) {
    const sizes = new Array(alphabet).fill(0);
    values.forEach(function (value) { sizes[value] += 1; });
    return sizes;
  }

  function bucketHeads(sizes) {
    const heads = new Array(sizes.length).fill(0);
    let sum = 0;
    for (let i = 0; i < sizes.length; i += 1) { heads[i] = sum; sum += sizes[i]; }
    return heads;
  }

  function bucketTails(sizes) {
    const tails = new Array(sizes.length).fill(0);
    let sum = 0;
    for (let i = 0; i < sizes.length; i += 1) { sum += sizes[i]; tails[i] = sum - 1; }
    return tails;
  }

  /** The two induced passes: L-types left to right from the bucket heads, then
   *  S-types right to left from the bucket tails. Both read what the previous
   *  pass wrote, which is why placing the LMS seeds correctly is enough. */
  function induce(values, isS, sa, sizes) {
    const heads = bucketHeads(sizes);
    for (let i = 0; i < sa.length; i += 1) {
      const at = sa[i] - 1;
      if (sa[i] > 0 && !isS[at]) { sa[heads[values[at]]] = at; heads[values[at]] += 1; }
    }

    const tails = bucketTails(sizes);
    for (let i = sa.length - 1; i >= 0; i -= 1) {
      const at = sa[i] - 1;
      if (sa[i] > 0 && isS[at]) { sa[tails[values[at]]] = at; tails[values[at]] -= 1; }
    }
  }

  function lmsEqual(values, isS, a, b) {
    if (a === values.length - 1 || b === values.length - 1) return a === b;
    for (let i = 0; ; i += 1) {
      const endA = i > 0 && isLms(isS, a + i);
      const endB = i > 0 && isLms(isS, b + i);
      if (endA && endB) return true;
      if (endA !== endB || values[a + i] !== values[b + i]) return false;
      if (isS[a + i] !== isS[b + i]) return false;
    }
  }

  /** SA-IS over an integer array whose last element is a unique smallest
   *  sentinel. Returns the suffix array of that array. */
  function saisOn(values, alphabet, stats) {
    stats.recursions += 1;
    const n = values.length;
    const isS = classify(values);
    const sizes = bucketSizes(values, alphabet);

    const lms = [];
    for (let i = 1; i < n; i += 1) if (isLms(isS, i)) lms.push(i);

    const sa = new Array(n).fill(-1);
    let tails = bucketTails(sizes);
    for (let i = lms.length - 1; i >= 0; i -= 1) { sa[tails[values[lms[i]]]] = lms[i]; tails[values[lms[i]]] -= 1; }
    stats.inducedPasses += 1;
    induce(values, isS, sa, sizes);

    /* Name the LMS substrings by their induced order; equal names mean the
       reduced problem is not yet solvable and has to recurse. */
    const named = new Array(n).fill(-1);
    let name = 0;
    let previous = -1;

    sa.forEach(function (at) {
      if (!isLms(isS, at)) return;
      if (previous >= 0 && !lmsEqual(values, isS, previous, at)) name += 1;
      else if (previous < 0) name = 0;
      named[at] = name;
      previous = at;
    });

    const reduced = lms.map(function (at) { return named[at]; });
    let order;

    if (name + 1 === lms.length) {
      order = new Array(lms.length);
      reduced.forEach(function (value, i) { order[value] = i; });
    } else {
      order = saisOn(reduced.concat([]), name + 1, stats);
    }

    sa.fill(-1);
    tails = bucketTails(sizes);
    for (let i = order.length - 1; i >= 0; i -= 1) {
      const at = lms[order[i]];
      sa[tails[values[at]]] = at;
      tails[values[at]] -= 1;
    }
    stats.inducedPasses += 1;
    induce(values, isS, sa, sizes);
    return sa;
  }

  /** SA-IS over a string. A sentinel smaller than every character is appended
   *  and its position dropped from the result. */
  function sais(text, stats) {
    if (!text.length) return [];

    const codes = [];
    let max = 0;
    for (let i = 0; i < text.length; i += 1) {
      const code = text.charCodeAt(i) + 1;
      codes.push(code);
      if (code > max) max = code;
    }
    codes.push(0);

    const sa = saisOn(codes, max + 1, stats);
    return sa.slice(1);
  }

  /* --------------------------------------------------------------- LCP */

  /** Kasai: walk the suffixes in text order and carry the match length. It can
   *  fall by at most one per step, so the total work is O(n) however many
   *  characters match. */
  function kasai(text, sa, stats) {
    const n = text.length;
    const rank = new Array(n).fill(0);
    sa.forEach(function (at, i) { rank[at] = i; });

    const lcp = new Array(n).fill(0);
    let carried = 0;

    for (let i = 0; i < n; i += 1) {
      if (rank[i] === 0) { carried = 0; continue; }
      const previous = sa[rank[i] - 1];
      while (i + carried < n && previous + carried < n && text[i + carried] === text[previous + carried]) {
        stats.lcpSteps += 1;
        carried += 1;
      }
      stats.lcpSteps += 1;
      lcp[rank[i]] = carried;
      if (carried > 0) carried -= 1;
    }
    return lcp;
  }

  /* ------------------------------------------------------------- build */

  function build(text, options) {
    const settings = options || {};
    const method = settings.method || 'sais';
    const stats = newStats();
    const trace = settings.trace ? [] : null;

    let sa;
    if (method === 'naive') sa = naive(text, stats);
    else if (method === 'doubling') sa = doubling(text, stats, trace);
    else sa = sais(text, stats);

    const lcp = kasai(text, sa, stats);

    /** The number of distinct substrings, which is the identity every suffix
     *  structure in this milestone has to agree on:
     *  n(n+1)/2 − Σ lcp. */
    function distinctSubstrings() {
      const total = text.length * (text.length + 1) / 2;
      return total - lcp.reduce(function (sum, value) { return sum + value; }, 0);
    }

    /** The longest repeated substring is the largest LCP entry. */
    function longestRepeated() {
      let best = 0;
      let at = 0;
      lcp.forEach(function (value, i) { if (value > best) { best = value; at = i; } });
      return best ? text.slice(sa[at], sa[at] + best) : '';
    }

    /** Binary search for the range of suffixes starting with `pattern`. */
    function rangeOf(pattern) {
      const probe = function (wantUpper) {
        let low = 0;
        let high = sa.length;
        while (low < high) {
          const mid = (low + high) >> 1;
          const suffix = text.substr(sa[mid], pattern.length);
          stats.comparisons += 1;
          const before = wantUpper ? suffix <= pattern : suffix < pattern;
          if (before) low = mid + 1;
          else high = mid;
        }
        return low;
      };
      const first = probe(false);
      const last = probe(true);
      return { first: first, last: last, count: last - first };
    }

    function occurrences(pattern) {
      if (!pattern.length) return [];
      const range = rangeOf(pattern);
      return sa.slice(range.first, range.last).slice().sort(function (a, b) { return a - b; });
    }

    function checkInvariants() {
      const errors = [];
      const seen = new Set(sa);

      if (sa.length !== text.length) errors.push('the array holds ' + sa.length + ' of ' + text.length + ' suffixes');
      if (seen.size !== sa.length) errors.push('the array repeats a start position');

      for (let i = 1; i < sa.length; i += 1) {
        if (text.slice(sa[i - 1]) > text.slice(sa[i])) {
          errors.push('suffixes ' + sa[i - 1] + ' and ' + sa[i] + ' are out of order at rank ' + i);
          break;
        }
      }
      for (let i = 1; i < sa.length; i += 1) {
        const a = text.slice(sa[i - 1], sa[i - 1] + lcp[i]);
        const b = text.slice(sa[i], sa[i] + lcp[i]);
        if (a !== b) { errors.push('lcp[' + i + '] = ' + lcp[i] + ' but the prefixes differ'); break; }
        if (text[sa[i - 1] + lcp[i]] !== undefined && text[sa[i - 1] + lcp[i]] === text[sa[i] + lcp[i]]) {
          errors.push('lcp[' + i + '] = ' + lcp[i] + ' is short: the next characters also match');
          break;
        }
      }
      return { ok: errors.length === 0, errors: errors.slice(0, 5) };
    }

    return {
      name: 'suffix-array-' + method,
      method: method,
      text: text,
      sa: sa,
      lcp: lcp,
      trace: trace || [],
      rangeOf: rangeOf,
      occurrences: occurrences,
      distinctSubstrings: distinctSubstrings,
      longestRepeated: longestRepeated,
      /* Bytes per character: 4 for the array, 4 for the LCP, 1 for the text. */
      bytesPerChar: function () { return 9; },
      checkInvariants: checkInvariants,
      stats: function () { return Object.assign({ length: text.length }, stats); }
    };
  }

  return {
    build: build,
    naive: naive,
    doubling: doubling,
    sais: sais,
    kasai: kasai,
    classify: classify,
    isLms: isLms,
    newStats: newStats
  };
}));

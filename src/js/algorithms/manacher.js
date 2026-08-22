/**
 * Palindromes: Manacher's mirror, and the palindromic tree.
 *
 * Manacher is the Z-window argument again. Keep the palindrome that reaches
 * furthest right; a position inside it has a mirror whose radius is already
 * known, so the only work is extending past the right edge - and because that
 * edge never moves left, the total extension over the whole run is at most n.
 *
 * The odd/even problem is solved by interleaving a separator, which turns
 * every even-length palindrome of the original into an odd-length one of the
 * transformed string. That trick costs a factor of two in memory and removes
 * an entire duplicate implementation, which is the trade every textbook makes
 * and almost no hand-rolled version does.
 *
 * The eertree is the other structure: a tree whose every node is a distinct
 * palindromic substring, built online in linear time, with TWO roots because
 * the empty string and a "length -1" sentinel are both needed to make the
 * extension rule uniform.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Manacher = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function emptyReport() {
    return { comparisons: 0, extensions: 0, mirrorReuse: 0, positions: 0,
      states: 0, suffixFollows: 0 };
  }

  const SEPARATOR = String.fromCharCode(1);

  /** `abc` becomes `#a#b#c#`, built rather than written so the source carries
   *  no control character. */
  function interleave(text) {
    return SEPARATOR + text.split('').join(SEPARATOR) + SEPARATOR;
  }

  /**
   * The radius array over the interleaved string. `radius[i]` is how far the
   * palindrome centred at i reaches, and `radius[i]` in the transformed string
   * is exactly the LENGTH of the palindrome in the original - which is the
   * reason the transform is worth its factor of two.
   */
  function radii(text, options) {
    const settings = options || {};
    const report = settings.report || emptyReport();
    const s = interleave(text);
    const n = s.length;
    const radius = new Array(n).fill(0);
    const trace = settings.trace ? [] : null;
    let centre = 0;
    let right = 0;

    for (let i = 0; i < n; i += 1) {
      report.positions += 1;
      const mirror = 2 * centre - i;
      const reused = i < right ? Math.min(right - i, radius[mirror]) : 0;

      radius[i] = reused;

      if (reused > 0) report.mirrorReuse += 1;
      let extended = 0;

      while (i - radius[i] - 1 >= 0 && i + radius[i] + 1 < n &&
        s[i - radius[i] - 1] === s[i + radius[i] + 1]) {
        report.comparisons += 1;
        report.extensions += 1;
        radius[i] += 1;
        extended += 1;
      }
      report.comparisons += 1;

      if (i + radius[i] > right) { centre = i; right = i + radius[i]; }

      if (!trace) continue;
      trace.push({ at: i, reused: reused, extended: extended, radius: radius[i],
        centre: centre, right: right });
    }
    return { radius: radius, transformed: s, report: report, trace: trace };
  }

  /** Every maximal palindrome as `{ start, length }` over the ORIGINAL string. */
  function palindromes(text, options) {
    const run = radii(text, options);
    const out = [];

    run.radius.forEach(function (r, i) {
      if (r === 0) return;
      out.push({ start: (i - r) / 2, length: r });
    });
    return { list: out, radius: run.radius, report: run.report,
      longest: out.reduce(function (best, entry) {
        return entry.length > best.length ? entry : best;
      }, { start: 0, length: 0 }) };
  }

  /** Expand around every centre: O(n²), and the only oracle that owes the
   *  mirror argument nothing. */
  function palindromesByBruteForce(text) {
    const out = [];

    for (let centre = 0; centre < text.length; centre += 1) {
      out.push(expandFrom(text, centre, centre));
      out.push(expandFrom(text, centre, centre + 1));
    }
    return out.filter(function (entry) { return entry.length > 0; });
  }

  function expandFrom(text, left, right) {
    let a = left;
    let b = right;

    while (a >= 0 && b < text.length && text[a] === text[b]) { a -= 1; b += 1; }
    return { start: a + 1, length: b - a - 1 };
  }

  /** How many palindromic substrings there are, counting multiplicity: the
   *  sum of ceil(radius / 2) over the interleaved centres. */
  function countSubstrings(text) {
    const run = radii(text, {});
    let total = 0;

    run.radius.forEach(function (r) { total += Math.floor((r + 1) / 2); });
    return total;
  }

  function countByBruteForce(text) {
    let total = 0;

    for (let i = 0; i < text.length; i += 1) {
      for (let j = i; j < text.length; j += 1) {
        const piece = text.slice(i, j + 1);

        if (piece !== piece.split('').reverse().join('')) continue;
        total += 1;
      }
    }
    return total;
  }

  /* ------------------------------------------------------------ eertree */

  /**
   * The palindromic tree. Node 0 has length -1 and node 1 has length 0; the
   * imaginary node is what makes "add a character on both sides" work
   * uniformly for the first character of an odd palindrome, and removing it
   * means special-casing every odd length by hand.
   */
  function eertree(text, options) {
    const report = (options || {}).report || emptyReport();
    const nodes = [{ length: -1, link: 0, next: {}, count: 0 },
      { length: 0, link: 0, next: {}, count: 0 }];
    let suffix = 1;

    for (let i = 0; i < text.length; i += 1) {
      suffix = extendEertree(nodes, text, i, { suffix: suffix, report: report });
      nodes[suffix].count += 1;
    }

    for (let id = nodes.length - 1; id >= 2; id -= 1) {
      nodes[nodes[id].link].count += nodes[id].count;
    }
    report.states = nodes.length;
    return { nodes: nodes, distinct: nodes.length - 2, report: report };
  }

  function extendEertree(nodes, text, i, context) {
    const report = context.report;
    let at = context.suffix;

    while (true) {
      report.suffixFollows += 1;
      const length = nodes[at].length;

      if (i - length - 1 >= 0 && text[i - length - 1] === text[i]) break;
      at = nodes[at].link;
    }

    if (nodes[at].next[text[i]] !== undefined) return nodes[at].next[text[i]];
    const created = nodes.length;

    nodes.push({ length: nodes[at].length + 2, link: 1, next: {}, count: 0 });
    nodes[created].link = linkFor(nodes, text, i, at);
    nodes[at].next[text[i]] = created;
    return created;
  }

  /** The new node's suffix link: the longest proper palindromic suffix, found
   *  by continuing down the chain from the node that created it. */
  function linkFor(nodes, text, i, from) {
    if (nodes[nodes.length - 1].length === 1) return 1;
    let at = nodes[from].link;

    while (true) {
      const length = nodes[at].length;

      if (i - length - 1 >= 0 && text[i - length - 1] === text[i]) break;
      at = nodes[at].link;
    }
    const candidate = nodes[at].next[text[i]];

    return candidate === undefined ? 1 : candidate;
  }

  /** Every distinct palindromic substring, by definition. */
  function distinctByBruteForce(text) {
    const seen = new Set();

    for (let i = 0; i < text.length; i += 1) {
      for (let j = i; j < text.length; j += 1) {
        const piece = text.slice(i, j + 1);

        if (piece !== piece.split('').reverse().join('')) continue;
        seen.add(piece);
      }
    }
    return seen.size;
  }

  return {
    emptyReport: emptyReport, SEPARATOR: SEPARATOR, interleave: interleave,
    radii: radii, palindromes: palindromes, palindromesByBruteForce: palindromesByBruteForce,
    countSubstrings: countSubstrings, countByBruteForce: countByBruteForce,
    eertree: eertree, distinctByBruteForce: distinctByBruteForce
  };
}));

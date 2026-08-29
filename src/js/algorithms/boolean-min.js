/**
 * BooleanMin - from a truth table to the smallest two-level circuit, and a
 * check that it really is the smallest.
 *
 * Quine-McCluskey is the algorithm everybody is taught after Karnaugh maps,
 * and the two halves of it are different problems. Finding the PRIME
 * IMPLICANTS - the product terms that cannot be made any more general - is
 * mechanical merging and always terminates with the same answer. Choosing a
 * minimum-cost SUBSET of them that covers every minterm is set cover, which is
 * NP-hard, and the essential-implicant rule plus a greedy pass is what
 * everybody actually ships.
 *
 * So the greedy answer is checked rather than trusted: `minimumCover` searches
 * every subset of the primes for the cheapest cover, which is exponential in
 * the prime count and exact. On four and five variables that is affordable and
 * it is the only way to say "minimal" and mean it.
 *
 * Don't-cares are minterms the specification does not constrain. They may be
 * used to make an implicant larger and they do not have to be covered - that
 * asymmetry is the whole reason they help, and getting it backwards produces
 * a circuit that is correct and larger than it needs to be.
 *
 * The hazard analysis at the end is the other reason two-level minimisation is
 * not the end of the story: a minimal sum of products can have a static-1
 * hazard exactly where two adjacent minterms are covered by different terms,
 * and the fix is to ADD a redundant term - which a minimiser will remove
 * again unless it is told not to.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BooleanMin = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  /* A term is a string over {0,1,-} with one character per variable, most
     significant first: "1-0" is a AND not c, for variables a, b, c. */

  function termOf(mask, bits) {
    let text = '';

    for (let at = bits - 1; at >= 0; at -= 1) text += ((mask >> at) & 1) ? '1' : '0';
    return text;
  }

  function onesIn(term) {
    return term.split('').filter(function (ch) { return ch === '1'; }).length;
  }

  /** Two terms merge when they differ in exactly one position, and the
   *  result has a dash there. */
  function merge(left, right) {
    let at = -1;

    for (let index = 0; index < left.length; index += 1) {
      if (left[index] === right[index]) continue;
      if (at !== -1) return null;
      at = index;
    }
    if (at === -1) return null;
    return left.slice(0, at) + '-' + left.slice(at + 1);
  }

  function covers(term, mask, bits) {
    for (let at = 0; at < term.length; at += 1) {
      if (term[at] === '-') continue;
      const bit = (mask >> (bits - 1 - at)) & 1;

      if ((term[at] === '1' ? 1 : 0) !== bit) return false;
    }
    return true;
  }

  function coveredBy(term, all, bits) {
    return all.filter(function (mask) { return covers(term, mask, bits); });
  }

  /* ------------------------------------------------- the prime implicants */

  /**
   * Merge repeatedly by ones-count groups until nothing merges. A term that
   * never merged with anything is prime; a term that merged is subsumed by
   * the larger one it produced.
   */
  function primeImplicants(minterms, dontCares, bits) {
    const all = minterms.concat(dontCares || []);
    let current = unique(all.map(function (mask) { return termOf(mask, bits); }));
    const primes = {};

    while (current.length) {
      const used = {};
      const next = [];

      current.forEach(function (left) {
        current.forEach(function (right) {
          if (onesIn(right) !== onesIn(left) + 1) return;
          const merged = merge(left, right);

          if (!merged) return;
          used[left] = true;
          used[right] = true;
          next.push(merged);
        });
      });
      current.forEach(function (term) { if (!used[term]) primes[term] = true; });
      current = unique(next);
    }
    return Object.keys(primes).sort();
  }

  function unique(list) {
    const seen = {};

    list.forEach(function (item) { seen[item] = true; });
    return Object.keys(seen);
  }

  /* ---------------------------------------------------------- the cover */

  function chart(primes, minterms, bits) {
    return primes.map(function (term) {
      return { term: term, covers: coveredBy(term, minterms, bits) };
    });
  }

  /**
   * A prime implicant is ESSENTIAL when some minterm is covered by it and by
   * nothing else. Those are forced, and taking them first is what makes the
   * remaining search small.
   */
  function essentialOf(rows, minterms) {
    const chosen = {};

    minterms.forEach(function (mask) {
      const owners = rows.filter(function (row) {
        return row.covers.indexOf(mask) !== -1;
      });

      if (owners.length === 1) chosen[owners[0].term] = true;
    });
    return Object.keys(chosen).sort();
  }

  function stillUncovered(rows, minterms, chosen) {
    const done = {};

    rows.filter(function (row) { return chosen.indexOf(row.term) !== -1; })
      .forEach(function (row) {
        row.covers.forEach(function (mask) { done[mask] = true; });
      });
    return minterms.filter(function (mask) { return !done[mask]; });
  }

  /** Cost is the literal count, because that is what the gates cost: a term
   *  with three literals is a three-input AND. */
  function costOf(terms) {
    return terms.reduce(function (sum, term) {
      return sum + term.split('').filter(function (ch) { return ch !== '-'; }).length;
    }, 0);
  }

  /**
   * The greedy answer: essentials first, then repeatedly take the prime that
   * covers the most of what is left. This is what a textbook exercise
   * produces and it is not guaranteed minimal.
   */
  function greedyCover(minterms, dontCares, bits) {
    const primes = primeImplicants(minterms, dontCares, bits);
    const rows = chart(primes, minterms, bits);
    const chosen = essentialOf(rows, minterms);
    let left = stillUncovered(rows, minterms, chosen);

    while (left.length) {
      const best = bestFor(rows, left, chosen);

      if (!best) break;
      chosen.push(best);
      left = stillUncovered(rows, minterms, chosen);
    }
    return { terms: chosen.sort(), primes: primes, chart: rows,
      essential: essentialOf(rows, minterms), cost: costOf(chosen),
      complete: left.length === 0 };
  }

  function bestFor(rows, left, chosen) {
    let best = null;
    let score = 0;

    rows.forEach(function (row) {
      if (chosen.indexOf(row.term) !== -1) return;
      const gain = row.covers.filter(function (mask) {
        return left.indexOf(mask) !== -1;
      }).length;

      if (gain > score) { score = gain; best = row.term; }
    });
    return best;
  }

  /**
   * The exact answer, by searching every subset of the primes. Exponential in
   * the prime count and the only way to say "minimal" honestly - the greedy
   * cover above is checked against this, and where they differ the difference
   * is reported rather than explained away.
   */
  function minimumCover(minterms, dontCares, bits, options) {
    const settings = options || {};
    const primes = primeImplicants(minterms, dontCares, bits);
    const rows = chart(primes, minterms, bits);

    if (primes.length > (settings.limit || 18)) {
      return { terms: null, skipped: true, primes: primes.length };
    }
    const total = Math.pow(2, primes.length);
    let best = null;

    for (let mask = 1; mask < total; mask += 1) {
      const pick = primes.filter(function (term, at) { return (mask >> at) & 1; });

      if (stillUncovered(rows, minterms, pick).length) continue;
      if (best === null || better(pick, best)) best = pick;
    }
    return { terms: best ? best.slice().sort() : null, skipped: false,
      cost: best ? costOf(best) : 0, primes: primes.length, searched: total };
  }

  function better(candidate, best) {
    if (candidate.length !== best.length) return candidate.length < best.length;
    return costOf(candidate) < costOf(best);
  }

  /* ------------------------------------------------------ presentation */

  function showTerm(term, names) {
    const parts = [];

    term.split('').forEach(function (ch, at) {
      if (ch === '-') return;
      parts.push(ch === '1' ? names[at] : 'not ' + names[at]);
    });
    return parts.length ? parts.join(' and ') : '1';
  }

  function expression(terms, names) {
    if (!terms || !terms.length) return '0';
    return terms.map(function (term) { return showTerm(term, names); }).join(' or ');
  }

  /* --------------------------------------------------------- the hazards */

  /**
   * A static-1 hazard lives where two ADJACENT minterms - differing in one
   * variable, both producing 1 - are covered by different product terms and by
   * no common one. As that variable changes, one term switches off before the
   * other switches on, and the output dips. The fix is the redundant term that
   * covers the pair, which is exactly the term a minimiser removed.
   */
  function hazards(terms, minterms, bits) {
    const set = {};
    const found = [];

    minterms.forEach(function (mask) { set[mask] = true; });
    minterms.forEach(function (mask) {
      for (let bit = 0; bit < bits; bit += 1) {
        const other = mask ^ (1 << bit);

        if (!set[other] || other < mask) continue;
        const shared = terms.filter(function (term) {
          return covers(term, mask, bits) && covers(term, other, bits);
        });

        if (shared.length) continue;
        found.push({ from: mask, to: other, variable: bits - 1 - bit,
          fix: fixFor(mask, other, bits) });
      }
    });
    return found;
  }

  function fixFor(mask, other, bits) {
    let text = '';

    for (let at = bits - 1; at >= 0; at -= 1) {
      const left = (mask >> at) & 1;
      const right = (other >> at) & 1;

      text += left === right ? String(left) : '-';
    }
    return text;
  }

  /* ------------------------------------------------------- the truth table */

  /** Evaluate a cover, so a minimisation can be checked against the function
   *  it was derived from rather than against another minimisation. */
  function evaluate(terms, mask, bits) {
    return terms.some(function (term) { return covers(term, mask, bits); }) ? 1 : 0;
  }

  function agrees(terms, minterms, dontCares, bits) {
    const wanted = {};
    const skip = {};
    const total = Math.pow(2, bits);

    minterms.forEach(function (mask) { wanted[mask] = true; });
    (dontCares || []).forEach(function (mask) { skip[mask] = true; });
    for (let mask = 0; mask < total; mask += 1) {
      if (skip[mask]) continue;
      if (evaluate(terms, mask, bits) !== (wanted[mask] ? 1 : 0)) {
        return { ok: false, at: mask, expected: wanted[mask] ? 1 : 0 };
      }
    }
    return { ok: true, checked: total - Object.keys(skip).length };
  }

  return { termOf: termOf, merge: merge, covers: covers, coveredBy: coveredBy,
    primeImplicants: primeImplicants, chart: chart, essentialOf: essentialOf,
    greedyCover: greedyCover, minimumCover: minimumCover, costOf: costOf,
    showTerm: showTerm, expression: expression, hazards: hazards,
    evaluate: evaluate, agrees: agrees, onesIn: onesIn };
}));

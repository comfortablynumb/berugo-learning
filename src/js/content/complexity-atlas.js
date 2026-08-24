/**
 * A curated atlas of problems, their known class membership, the best known
 * algorithm, the best known lower bound, and what is actually open.
 *
 * The point of separating those four columns is that they are constantly
 * conflated. "SAT is exponential" is false as stated — no superpolynomial
 * lower bound is known for SAT, and the exponential is the best known
 * ALGORITHM, not a proved limit. "Sorting is n log n" is true only in the
 * comparison model and false for integers in a word RAM. Being precise about
 * which of the four you are quoting is what makes a complexity claim credible,
 * and this file is arranged so that imprecision is hard.
 *
 * The `unconditional` flag is the one to look for: it marks the handful of
 * separations that are proved outright rather than resting on "unless P = NP".
 */
(function (root) {
  'use strict';

  const ATLAS = [
    {
      problem: 'Sorting by comparisons',
      classes: ['P'],
      best: 'O(n log n) — merge sort, heapsort',
      lower: 'Omega(n log n), PROVED in the comparison model by an information argument',
      unconditional: true,
      open: 'nothing — this one is settled, and only within the comparison model',
      note: 'Radix sort beats it for integers, which is not a contradiction: it is a ' +
        'different model where a key can be indexed rather than only compared.'
    },
    {
      problem: 'Matrix multiplication',
      classes: ['P'],
      best: 'O(n^2.371) — Alman, Duan, Williams, Xu, Zhou (2024)',
      lower: 'Omega(n²), trivially — the output has n² entries',
      unconditional: true,
      open: 'whether the true exponent is 2; the gap has narrowed for fifty years',
      note: 'Every improvement since Strassen has been galactic — the constants make them ' +
        'slower than the cubic algorithm on any real matrix.'
    },
    {
      problem: 'Integer factoring',
      classes: ['NP', 'co-NP', 'BQP'],
      best: 'sub-exponential — the general number field sieve',
      lower: 'none known; not even superpolynomial',
      unconditional: false,
      open: 'whether it is in P; it is in NP ∩ co-NP, which is evidence it is NOT NP-complete',
      note: 'Shor puts it in BQP, which is why RSA is the headline casualty of quantum ' +
        'computing and AES is not.'
    },
    {
      problem: 'Primality testing',
      classes: ['P'],
      best: 'polynomial — AKS (2002); Miller–Rabin in practice',
      lower: 'none tight',
      unconditional: true,
      open: 'nothing about membership; the practical algorithms are still randomised',
      note: 'It was in co-RP for decades before AKS, and everyone still uses Miller–Rabin ' +
        'because a deterministic guarantee is not worth the constant.'
    },
    {
      problem: 'Boolean satisfiability (SAT)',
      classes: ['NP-complete'],
      best: 'exponential in the worst case; modern solvers handle millions of clauses',
      lower: 'none superpolynomial is proved — this is the point',
      unconditional: false,
      open: 'P versus NP itself; also the strong exponential time hypothesis',
      note: '"SAT is exponential" names the best known ALGORITHM, not a proved bound. Nobody ' +
        'has ruled out a polynomial one.'
    },
    {
      problem: 'Graph isomorphism',
      classes: ['NP', 'not known to be NP-complete'],
      best: 'quasi-polynomial — Babai (2015, corrected 2017)',
      lower: 'none known',
      unconditional: false,
      open: 'whether it is in P; it is one of very few natural problems in NP with neither ' +
        'a polynomial algorithm nor an NP-completeness proof',
      note: 'Its NON-isomorphism is the interactive-proof example in this milestone, precisely ' +
        'because no short certificate is known.'
    },
    {
      problem: 'Quantified Boolean formulas (QBF)',
      classes: ['PSPACE-complete'],
      best: 'exponential time, polynomial space',
      lower: 'none superpolynomial in time',
      unconditional: false,
      open: 'P versus PSPACE',
      note: 'The canonical PSPACE-complete problem, and the reason generalised board games ' +
        'land in that class: alternating quantifiers are alternating players.'
    },
    {
      problem: 'Directed graph reachability',
      classes: ['NL-complete'],
      best: 'linear time and linear space (BFS); log² space by Savitch',
      lower: 'Omega(log n) space, trivially',
      unconditional: false,
      open: 'whether L = NL',
      note: 'The UNDIRECTED version was put in L by Reingold in 2004, which was a surprise ' +
        'and does not obviously extend.'
    },
    {
      problem: 'PARITY by constant-depth circuits',
      classes: ['NC¹', 'NOT in AC⁰'],
      best: 'linear size, logarithmic depth with bounded fan-in',
      lower: 'exponential size for constant depth — PROVED by Håstad (1986)',
      unconditional: true,
      open: 'nothing here; it is one of the few unconditional circuit lower bounds',
      note: 'Almost every other circuit lower bound anyone wants is blocked by the ' +
        'natural-proofs barrier.'
    },
    {
      problem: 'Halting',
      classes: ['recognisable, not decidable'],
      best: 'no algorithm; bounded halting is decidable and is what tools use',
      lower: 'undecidable — proved by diagonalisation',
      unconditional: true,
      open: 'nothing — this is settled and has been since 1936',
      note: 'Every timeout and fuel counter in production software is the bounded version ' +
        'standing in for the unbounded one.'
    },
    {
      problem: 'Program equivalence',
      classes: ['neither recognisable nor co-recognisable'],
      best: 'no algorithm; approximations everywhere',
      lower: 'undecidable by Rice’s theorem',
      unconditional: true,
      open: 'nothing',
      note: 'It is why a compiler cannot verify its own optimisations in general, and why ' +
        'translation validation checks one run rather than the transformation.'
    },
    {
      problem: 'Kolmogorov complexity of a string',
      classes: ['not computable'],
      best: 'upper bounds only — every compressor is one',
      lower: 'uncomputable, by a formalised Berry paradox',
      unconditional: true,
      open: 'nothing about computability',
      note: 'Which is why a compression ratio is evidence and never a measurement of ' +
        'complexity.'
    },
    {
      problem: 'Unstructured search over N items',
      classes: ['P for the query model', 'BQP'],
      best: 'N/2 expected classically; sqrt(N) by Grover',
      lower: 'Omega(sqrt(N)) quantum queries — PROVED, so Grover is optimal',
      unconditional: true,
      open: 'nothing about the query bound',
      note: 'The optimality proof is why quantum computers do not brute-force NP: the ' +
        'speed-up is quadratic and cannot be improved.'
    },
    {
      problem: 'Travelling salesman (decision version)',
      classes: ['NP-complete'],
      best: 'exponential; Held–Karp is O(n² 2ⁿ), and solvers do far better in practice',
      lower: 'none superpolynomial',
      unconditional: false,
      open: 'P versus NP; also whether a 2^o(n) algorithm exists',
      note: 'The metric version has a 3/2 approximation (Christofides) and the general one ' +
        'has none within any factor, unless P = NP.'
    },
    {
      problem: 'Linear programming',
      classes: ['P'],
      best: 'polynomial — ellipsoid (1979), interior point in practice',
      lower: 'none tight',
      unconditional: false,
      open: 'whether a strongly polynomial algorithm exists — Smale’s ninth problem',
      note: 'Simplex is exponential in the worst case and the fastest thing in practice, ' +
        'which is the standard warning about worst-case analysis.'
    }
  ];

  /** The class tower, with the containments and which of them are strict. */
  const TOWER = [
    { name: 'L', contains: 'NL', strict: 'unknown' },
    { name: 'NL', contains: 'P', strict: 'unknown' },
    { name: 'P', contains: 'NP', strict: 'unknown — the famous one' },
    { name: 'NP', contains: 'PSPACE', strict: 'unknown' },
    { name: 'PSPACE', contains: 'EXPTIME', strict: 'unknown' },
    { name: 'EXPTIME', contains: 'EXPSPACE', strict: 'unknown' },
    { name: 'P vs EXPTIME', contains: '—',
      strict: 'STRICT, by the time hierarchy theorem' },
    { name: 'L vs PSPACE', contains: '—',
      strict: 'STRICT, by the space hierarchy theorem' },
    { name: 'NL vs PSPACE', contains: '—', strict: 'STRICT, since NL ⊆ log² space by Savitch' }
  ];

  function all() { return ATLAS.slice(); }

  function unconditional() {
    return ATLAS.filter(function (entry) { return entry.unconditional; });
  }

  /** Exact match on a class label, not a substring: graph isomorphism carries
   *  "not known to be NP-complete", and a substring test would list it under
   *  NP-complete — the opposite of what the entry says. */
  function byClass(name) {
    return ATLAS.filter(function (entry) {
      return entry.classes.indexOf(name) !== -1;
    });
  }

  function names() {
    return ATLAS.map(function (entry) { return entry.problem; });
  }

  const api = { ATLAS: ATLAS, TOWER: TOWER, all: all, unconditional: unconditional,
    byClass: byClass, names: names };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ComplexityAtlas = api;
}(typeof window !== 'undefined' ? window : null));

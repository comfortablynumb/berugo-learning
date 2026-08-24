/**
 * Interactive proofs, with the soundness error measured over many runs rather
 * than quoted from the theorem.
 *
 * The graph-non-isomorphism protocol is the right example because the claim it
 * verifies — "these two graphs are NOT isomorphic" — has no short certificate
 * anybody knows how to write. A verifier that could check it alone would be
 * solving a problem not known to be in NP. Interaction plus randomness gets it
 * anyway, and the mechanism is one line: pick a graph at random, scramble it,
 * and ask the prover which one it came from. An honest prover always knows; a
 * lying prover — one whose graphs really are isomorphic — cannot tell, so it
 * guesses, and is caught with probability one half per round.
 *
 * That is the pattern under zero-knowledge proofs, verifiable computation and
 * rollups: a weak verifier checks a claim it could never compute, and the cost
 * of being wrong falls by half each round.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.InteractiveProofs = api;
}(this, function () {
  'use strict';

  /* --------------------------------------------------------------- graphs */

  /** A graph as an adjacency matrix, which is what makes permuting it cheap. */
  function graph(n, edges, label) {
    const matrix = [];

    for (let i = 0; i < n; i += 1) {
      matrix.push([]);
      for (let j = 0; j < n; j += 1) matrix[i].push(0);
    }
    (edges || []).forEach(function (edge) {
      matrix[edge[0]][edge[1]] = 1;
      matrix[edge[1]][edge[0]] = 1;
    });
    return { n: n, matrix: matrix, edges: (edges || []).slice(), label: label || null };
  }

  /** Relabel the vertices by a permutation, which changes the picture and not
   *  the graph. */
  function permute(input, order) {
    const matrix = [];

    for (let i = 0; i < input.n; i += 1) {
      matrix.push([]);
      for (let j = 0; j < input.n; j += 1) {
        matrix[i].push(input.matrix[order[i]][order[j]]);
      }
    }
    return { n: input.n, matrix: matrix, edges: edgesOf(matrix), label: 'permuted' };
  }

  function edgesOf(matrix) {
    const out = [];

    for (let i = 0; i < matrix.length; i += 1) {
      for (let j = i + 1; j < matrix.length; j += 1) {
        if (matrix[i][j]) out.push([i, j]);
      }
    }
    return out;
  }

  function key(input) {
    return input.matrix.map(function (row) { return row.join(''); }).join('|');
  }

  function randomOrder(n, rng) {
    const order = [];

    for (let i = 0; i < n; i += 1) order.push(i);
    for (let i = n - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      const swap = order[i];

      order[i] = order[j];
      order[j] = swap;
    }
    return order;
  }

  /**
   * Are two graphs isomorphic? Brute force over permutations, which is fine at
   * the sizes here and is the reason the demo stays at six or seven vertices —
   * the verifier is supposed to be weak, and the ORACLE that checks the
   * verifier is allowed to be slow.
   */
  function isomorphic(left, right) {
    if (left.n !== right.n) return false;
    const order = [];

    for (let i = 0; i < left.n; i += 1) order.push(i);
    return searchIsomorphism(left, right, order, 0);
  }

  function searchIsomorphism(left, right, order, at) {
    if (at === order.length) return key(permute(left, order)) === key(right);
    for (let i = at; i < order.length; i += 1) {
      const swap = order[at];

      order[at] = order[i];
      order[i] = swap;
      if (searchIsomorphism(left, right, order, at + 1)) return true;
      order[i] = order[at];
      order[at] = swap;
    }
    return false;
  }

  /* --------------------------------------------------------- the protocol */

  /**
   * One round. The verifier picks a graph at random, permutes it, and asks
   * which it was. It accepts the round only if the answer is right.
   *
   * The verifier does no isomorphism testing at all — that is the point. It
   * permutes, it compares one answer to one remembered bit, and its whole cost
   * is O(n²).
   */
  function round(pair, prover, rng) {
    const choice = rng() < 0.5 ? 0 : 1;
    const source = choice === 0 ? pair.left : pair.right;
    const challenge = permute(source, randomOrder(source.n, rng));
    const answer = prover(challenge, pair, rng);

    return { choice: choice, answer: answer, correct: answer === choice,
      challenge: key(challenge) };
  }

  /**
   * Run k rounds and accept only if every one is correct. The soundness error
   * is 2^-k, and the demo measures it over many runs rather than quoting it.
   */
  function verify(pair, prover, rounds, rng) {
    const trace = [];

    for (let i = 0; i < rounds; i += 1) {
      const outcome = round(pair, prover, rng);

      trace.push(outcome);
      if (!outcome.correct) {
        return { accepted: false, rounds: i + 1, trace: trace,
          caught: true, error: Math.pow(0.5, rounds) };
      }
    }
    return { accepted: true, rounds: rounds, trace: trace, caught: false,
      error: Math.pow(0.5, rounds) };
  }

  /* ---------------------------------------------------------- the provers */

  /**
   * The honest prover: it can solve graph isomorphism, so it simply tests the
   * challenge against the left graph and answers correctly every time. It is
   * unbounded, which is the model — a prover may be as powerful as it likes.
   */
  function honestProver() {
    return function (challenge, pair) {
      return isomorphic(challenge, pair.left) ? 0 : 1;
    };
  }

  /**
   * The lying prover: it claims two ISOMORPHIC graphs are not isomorphic. It
   * cannot tell which one the challenge came from — because both answers are
   * true — so whatever strategy it uses, it is guessing, and it is caught with
   * probability one half per round.
   */
  function lyingProver() {
    return function (challenge, pair, rng) {
      return rng() < 0.5 ? 0 : 1;
    };
  }

  /** A lying prover that always answers 0, to show that a deterministic
   *  strategy fares no better — it is right exactly half the time because the
   *  verifier's coin is what decides. */
  function stubbornProver() {
    return function () { return 0; };
  }

  /* --------------------------------------------------------- measurement */

  /**
   * The acceptance criterion made runnable: run the protocol many times
   * against a dishonest prover and compare the measured acceptance rate to
   * 2^-k. Anything that matches to within sampling noise confirms the
   * soundness bound; anything that does not is a bug in the verifier.
   */
  function soundness(pair, prover, rounds, trials, rng) {
    let accepted = 0;

    for (let i = 0; i < trials; i += 1) {
      if (verify(pair, prover, rounds, rng).accepted) accepted += 1;
    }
    return { trials: trials, rounds: rounds, accepted: accepted,
      measured: accepted / trials, predicted: Math.pow(0.5, rounds),
      /* Three standard deviations of a binomial with p = 2^-k; outside this
         band the verifier is wrong rather than unlucky. */
      tolerance: 3 * Math.sqrt(Math.pow(0.5, rounds) * (1 - Math.pow(0.5, rounds)) / trials) };
  }

  /* ------------------------------------------------------------ fixtures */

  /** Two graphs that really are different: a six-cycle and two triangles.
   *  Same vertex and edge counts, different structure. */
  function differentPair() {
    return {
      left: graph(6, [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0]], 'a six-cycle'),
      right: graph(6, [[0, 1], [1, 2], [2, 0], [3, 4], [4, 5], [5, 3]], 'two triangles'),
      claim: 'these graphs are NOT isomorphic', honest: true
    };
  }

  /** Two graphs that are the same graph drawn twice — the claim is false, and
   *  the protocol has to catch it. */
  function samePair() {
    const base = graph(6, [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0]], 'a six-cycle');

    return { left: base, right: permute(base, [3, 0, 4, 1, 5, 2]),
      claim: 'these graphs are NOT isomorphic (a lie)', honest: false };
  }

  /** The class table this section is about. */
  const CLASSES = [
    { name: 'RP', errors: 'one-sided: never accepts a false claim',
      amplify: 'repeat k times; error 2^-k', example: 'polynomial identity testing' },
    { name: 'co-RP', errors: 'one-sided the other way: never rejects a true claim',
      amplify: 'repeat k times', example: 'primality, before AKS made it deterministic' },
    { name: 'ZPP', errors: 'never wrong; the RUNNING TIME is random',
      amplify: 'RP ∩ co-RP — run both and wait', example: 'Las Vegas algorithms generally' },
    { name: 'BPP', errors: 'two-sided, bounded below 1/2 by a constant',
      amplify: 'majority of k runs; error falls exponentially by Chernoff',
      example: 'the class most people mean by "efficient randomised"' },
    { name: 'IP', errors: 'interactive: a prover and a randomised verifier',
      amplify: 'more rounds; soundness 2^-k',
      example: 'graph non-isomorphism — and IP = PSPACE' },
    { name: 'PCP', errors: 'a proof the verifier reads only a few bits of',
      amplify: 'the PCP theorem: 3 bits and constant error, for every NP language',
      example: 'the reason approximation is hard for so many problems' }
  ];

  return {
    graph: graph, permute: permute, isomorphic: isomorphic, key: key,
    randomOrder: randomOrder, round: round, verify: verify, soundness: soundness,
    honestProver: honestProver, lyingProver: lyingProver, stubbornProver: stubbornProver,
    differentPair: differentPair, samePair: samePair, CLASSES: CLASSES
  };
}));

/**
 * Turning "in expectation" into "always".
 *
 * A random assignment cuts half the edges of any graph in expectation, so some
 * assignment cuts at least half - that is the probabilistic method, and on its
 * own it is a proof of existence with no algorithm attached. Two constructions
 * turn it into one, and they are different in kind:
 *
 *   - the method of CONDITIONAL EXPECTATIONS walks the decisions one at a
 *     time, and at each step takes the branch whose conditional expectation is
 *     at least the current one. The expectation never falls below its starting
 *     value, and when every variable is decided the expectation IS the answer,
 *     so the answer is at least |E|/2. There is no randomness left anywhere,
 *     and the resulting code is a greedy algorithm whose correctness proof is
 *     the expectation argument rather than an exchange argument.
 *   - a SMALL SAMPLE SPACE replaces full independence with pairwise
 *     independence. The MAX-CUT expectation only needs each EDGE's two
 *     endpoints to be independent, never three vertices at once - so a family
 *     of 2^k = O(n) assignments in which any two coordinates are independent
 *     has the same average, and enumerating all of them finds one at least as
 *     good. Exponentially many coin flips become log n of them, and then none.
 *
 * The second construction is the one worth internalising, because it is the
 * general shape: find out how much independence the analysis actually uses,
 * then build the smallest family that supplies it. k-wise independent families
 * are how that is done at scale, and `independenceProfile` measures a family's
 * pairwise agreement against the triple-wise agreement it does NOT have.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Derandomize = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  /* ------------------------------------------------------------- MAX-CUT */

  function cutValue(graph, side) {
    let cut = 0;
    graph.edges.forEach(function (edge) {
      if (side[edge.from] !== side[edge.to]) cut += edge.weight === undefined ? 1 : edge.weight;
    });
    return cut;
  }

  function totalWeight(graph) {
    let total = 0;
    graph.edges.forEach(function (edge) {
      total += edge.weight === undefined ? 1 : edge.weight;
    });
    return total;
  }

  /** One coin per vertex - the algorithm the expectation argument is about. */
  function randomCut(graph, rng) {
    const side = new Array(graph.n);
    for (let v = 0; v < graph.n; v += 1) side[v] = rng.int(2);
    return { cut: cutValue(graph, side), side: side, expected: totalWeight(graph) / 2 };
  }

  /**
   * The conditional-expectation walk. With vertices 0..v-1 decided, the
   * conditional expectation of the cut is (edges already cut) + (edges with an
   * undecided endpoint)/2, so the difference between the two branches for v is
   * exactly the weight of its decided neighbours on each side. Taking the
   * larger keeps the expectation from falling, and the trace records both
   * branch values so the argument can be read off the table.
   */
  function conditionalExpectationCut(graph) {
    const side = new Array(graph.n).fill(-1);
    const adjacency = adjacencyOf(graph);
    const trace = [];
    const start = totalWeight(graph) / 2;

    for (let v = 0; v < graph.n; v += 1) {
      let toZero = 0;
      let toOne = 0;
      adjacency[v].forEach(function (entry) {
        if (side[entry.to] === 0) toOne += entry.weight;
        if (side[entry.to] === 1) toZero += entry.weight;
      });
      side[v] = toOne >= toZero ? 1 : 0;
      trace.push({ vertex: v, ifZero: toZero, ifOne: toOne, chose: side[v],
        expectation: expectationGiven(graph, side, v + 1) });
    }
    return { cut: cutValue(graph, side), side: side, trace: trace,
      startingExpectation: start, bound: start, meetsBound: cutValue(graph, side) >= start };
  }

  /** E[cut | the first `decided` vertices are fixed]. */
  function expectationGiven(graph, side, decided) {
    let sure = 0;
    let halved = 0;

    graph.edges.forEach(function (edge) {
      const w = edge.weight === undefined ? 1 : edge.weight;
      if (edge.from >= decided || edge.to >= decided) { halved += w; return; }
      if (side[edge.from] !== side[edge.to]) sure += w;
    });
    return sure + halved / 2;
  }

  function adjacencyOf(graph) {
    const out = [];
    for (let i = 0; i < graph.n; i += 1) out.push([]);
    graph.edges.forEach(function (edge) {
      const w = edge.weight === undefined ? 1 : edge.weight;
      out[edge.from].push({ to: edge.to, weight: w });
      out[edge.to].push({ to: edge.from, weight: w });
    });
    return out;
  }

  /* ------------------------------------------- pairwise independent space */

  /**
   * The family {XOR of the seed bits in S : S a non-empty subset of [k]}.
   * Any single coordinate is uniform, any two are independent, and no three
   * are - the parity of three coordinates whose index sets XOR to zero is
   * always zero. That is precisely enough for MAX-CUT and precisely not
   * enough for anything needing a triple.
   */
  function pairwiseFamily(n) {
    let k = 1;
    while ((1 << k) - 1 < n) k += 1;
    const masks = [];
    for (let s = 1; s < (1 << k) && masks.length < n; s += 1) masks.push(s);

    return { bits: k, size: 1 << k, masks: masks,
      assignment: function (seed) {
        return masks.map(function (mask) { return parityOf(mask & seed); });
      } };
  }

  function parityOf(value) {
    let v = value;
    let bit = 0;
    while (v > 0) { bit ^= v & 1; v >>>= 1; }
    return bit;
  }

  /**
   * Enumerate the whole sample space and keep the best cut. The average over
   * the space is exactly |E|/2 by pairwise independence, so the best is at
   * least that - and the space has O(n) points rather than 2^n.
   */
  function enumerateSmallSpace(graph) {
    const family = pairwiseFamily(graph.n);
    let best = -1;
    let bestSeed = 0;
    let total = 0;

    for (let seed = 0; seed < family.size; seed += 1) {
      const cut = cutValue(graph, family.assignment(seed));
      total += cut;
      if (cut > best) { best = cut; bestSeed = seed; }
    }
    return { cut: best, seed: bestSeed, points: family.size, bits: family.bits,
      averageOverSpace: total / family.size, bound: totalWeight(graph) / 2,
      side: family.assignment(bestSeed), fullSpace: Math.pow(2, graph.n) };
  }

  /**
   * How independent the family actually is. Every pair of coordinates hits
   * each of the four patterns exactly a quarter of the time; some triples hit
   * only four of the eight. The worst deviation in each is the measurement.
   */
  function independenceProfile(family) {
    const n = Math.min(family.masks.length, 12);
    const points = [];
    for (let seed = 0; seed < family.size; seed += 1) points.push(family.assignment(seed));
    const pairs = worstDeviation(points, n, 2);
    const triples = worstDeviation(points, n, 3);

    return { pairwiseWorst: pairs.worst, pairwiseAt: pairs.at,
      tripleWorst: triples.worst, tripleAt: triples.at,
      points: family.size, coordinates: n };
  }

  function worstDeviation(points, n, arity) {
    const patterns = 1 << arity;
    let worst = 0;
    let at = null;
    const indices = new Array(arity).fill(0);

    function walk(depth, start) {
      if (depth === arity) {
        const counts = new Array(patterns).fill(0);
        points.forEach(function (point) {
          let code = 0;
          for (let d = 0; d < arity; d += 1) code = (code << 1) | point[indices[d]];
          counts[code] += 1;
        });
        const expected = points.length / patterns;
        counts.forEach(function (c) {
          const deviation = Math.abs(c - expected) / points.length;
          if (deviation > worst) { worst = deviation; at = indices.slice(); }
        });
        return;
      }
      for (let i = start; i < n; i += 1) { indices[depth] = i; walk(depth + 1, i + 1); }
    }
    walk(0, 0);
    return { worst: worst, at: at };
  }

  /* ------------------------------------------------------------- MAX-SAT */

  /** A random assignment satisfies a clause of length k with probability
   *  1 - 2^-k, so the expectation is Σ(1 - 2^-k) - at least m/2 always. */
  function randomAssignmentSat(formula, rng) {
    const assignment = new Array(formula.variables);
    for (let i = 0; i < formula.variables; i += 1) assignment[i] = rng.int(2) === 1;
    return { satisfied: countSatisfied(formula, assignment), assignment: assignment,
      expected: expectedSatisfied(formula) };
  }

  function expectedSatisfied(formula) {
    let out = 0;
    formula.clauses.forEach(function (clause) {
      out += 1 - Math.pow(2, -clause.length);
    });
    return out;
  }

  function countSatisfied(formula, assignment) {
    let count = 0;
    formula.clauses.forEach(function (clause) {
      for (let i = 0; i < clause.length; i += 1) {
        const literal = clause[i];
        const value = assignment[Math.abs(literal) - 1];
        if (literal > 0 ? value : !value) { count += 1; return; }
      }
    });
    return count;
  }

  /**
   * Conditional expectations on MAX-SAT: set each variable to whichever value
   * gives the larger expected number of satisfied clauses, given the
   * decisions already made. The expectation for a partial assignment is the
   * number of already-satisfied clauses plus, for each surviving clause,
   * 1 - 2^-(undecided literals).
   */
  function conditionalExpectationSat(formula) {
    const assignment = new Array(formula.variables).fill(null);
    const trace = [];

    for (let i = 0; i < formula.variables; i += 1) {
      assignment[i] = true;
      const ifTrue = partialExpectation(formula, assignment);
      assignment[i] = false;
      const ifFalse = partialExpectation(formula, assignment);
      assignment[i] = ifTrue >= ifFalse;
      trace.push({ variable: i + 1, ifTrue: ifTrue, ifFalse: ifFalse, chose: assignment[i] });
    }
    return { satisfied: countSatisfied(formula, assignment), assignment: assignment,
      trace: trace, bound: expectedSatisfied(formula),
      meetsBound: countSatisfied(formula, assignment) >= expectedSatisfied(formula) - 1e-9 };
  }

  function partialExpectation(formula, assignment) {
    let out = 0;

    formula.clauses.forEach(function (clause) {
      let undecided = 0;
      let satisfied = false;
      for (let i = 0; i < clause.length; i += 1) {
        const literal = clause[i];
        const value = assignment[Math.abs(literal) - 1];
        if (value === null || value === undefined) { undecided += 1; continue; }
        if (literal > 0 ? value : !value) satisfied = true;
      }
      out += satisfied ? 1 : 1 - Math.pow(2, -undecided);
    });
    return out;
  }

  /** Random k-SAT, the standard fixture: m clauses of k distinct literals. */
  function randomFormula(options) {
    const settings = options || {};
    const rng = settings.rng;
    const variables = settings.variables === undefined ? 12 : settings.variables;
    const clauses = [];
    const width = settings.width === undefined ? 3 : settings.width;

    for (let c = 0; c < (settings.clauses === undefined ? 40 : settings.clauses); c += 1) {
      const used = new Set();
      const clause = [];
      while (clause.length < width) {
        const v = 1 + rng.int(variables);
        if (used.has(v)) continue;
        used.add(v);
        clause.push(rng.int(2) === 1 ? v : -v);
      }
      clauses.push(clause);
    }
    return { variables: variables, clauses: clauses };
  }

  return {
    cutValue: cutValue, totalWeight: totalWeight, randomCut: randomCut,
    conditionalExpectationCut: conditionalExpectationCut, expectationGiven: expectationGiven,
    pairwiseFamily: pairwiseFamily, enumerateSmallSpace: enumerateSmallSpace,
    independenceProfile: independenceProfile, parityOf: parityOf,
    randomAssignmentSat: randomAssignmentSat, conditionalExpectationSat: conditionalExpectationSat,
    countSatisfied: countSatisfied, expectedSatisfied: expectedSatisfied,
    partialExpectation: partialExpectation, randomFormula: randomFormula
  };
}));

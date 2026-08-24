/**
 * Karger's contraction algorithm, and the repetition that makes it useful.
 *
 * The algorithm is three lines: pick a uniformly random edge, merge its two
 * endpoints into one supernode discarding the self-loops that creates, and
 * repeat until two supernodes remain. Whatever edges still run between them
 * are a cut, and it is the minimum cut with probability at least 2/(n(n-1)).
 *
 * That probability is the whole content. It is *not* small in the sense that
 * matters: it is polynomially small, so O(n² log n) independent runs push the
 * failure probability below any constant, and each run costs O(n²) at most.
 * The cost model is expected total work, not the chance of one run being
 * right - which is why `repeat()` reports the empirical success rate beside
 * the bound rather than reporting a single run at all.
 *
 * Two details are easy to get wrong and both are checked here:
 *
 *   - the edge must be picked uniformly from the SURVIVING edges, not from a
 *     uniformly random pair of surviving supernodes. Picking a pair biases
 *     towards contracting across the min cut - which is exactly the event the
 *     analysis needs to avoid - and the measured success rate then falls
 *     below the bound the algorithm is supposed to beat. `contract` takes a
 *     `pickBy` dial so both can be run and compared.
 *   - self-loops must be discarded as they form. Leaving them in does not
 *     change the answer, but it changes the distribution the next pick is
 *     drawn from, and the success rate drops again.
 *
 * `bruteForceMinCut` enumerates all 2^(n-1) - 1 partitions, so it is the
 * oracle for everything else and its cost is a reported field.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Karger = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const BRUTE_FORCE_LIMIT = 22;

  /** 2/(n(n-1)) - the probability one contraction run finds a given min cut. */
  function successProbability(n) {
    if (n < 2) return 0;
    return 2 / (n * (n - 1));
  }

  /** Runs needed for failure probability at most `target`, from (1 - p)^k. */
  function trialsFor(n, target) {
    const p = successProbability(n);
    if (p <= 0 || p >= 1) return 1;
    return Math.ceil(Math.log(target) / Math.log(1 - p));
  }

  /* ------------------------------------------------------------- the oracle */

  /**
   * Every partition of the vertices into two non-empty sides, scored. n is
   * capped because this is 2^(n-1) work and the whole point of the module is
   * that the exact answer is the expensive one.
   */
  function bruteForceMinCut(graph) {
    if (graph.n > BRUTE_FORCE_LIMIT) {
      throw new Error('bruteForceMinCut is exponential; n = ' + graph.n + ' exceeds ' +
        BRUTE_FORCE_LIMIT);
    }
    const total = 1 << (graph.n - 1);
    let best = Infinity;
    let bestMask = 0;
    let optimalMasks = 0;

    for (let mask = 1; mask < total; mask += 1) {
      const weight = cutWeight(graph, mask);

      if (weight < best) { best = weight; bestMask = mask; optimalMasks = 1; continue; }
      if (weight === best) optimalMasks += 1;
    }
    const normalised = (bestMask & 1) ? (~bestMask & ((1 << graph.n) - 1)) : bestMask;
    return { cut: best, mask: normalised, optimalCuts: optimalMasks,
      partitionsExamined: total - 1, side: sideOf(normalised, graph.n) };
  }

  function cutWeight(graph, mask) {
    let weight = 0;

    for (let i = 0; i < graph.edges.length; i += 1) {
      const edge = graph.edges[i];
      const a = (mask >>> edge.from) & 1;
      const b = (mask >>> edge.to) & 1;
      if (a !== b) weight += edge.weight === undefined ? 1 : edge.weight;
    }
    return weight;
  }

  function sideOf(mask, n) {
    const out = [];
    for (let i = 0; i < n; i += 1) out.push((mask >>> i) & 1);
    return out;
  }

  /* -------------------------------------------------------- one contraction */

  function liveEdges(edges, label) {
    const out = [];

    for (let i = 0; i < edges.length; i += 1) {
      const from = label[edges[i].from];
      const to = label[edges[i].to];
      if (from !== to) out.push({ from: from, to: to, weight: edges[i].weight || 1 });
    }
    return out;
  }

  function pickEdge(edges, rng, pickBy) {
    if (pickBy !== 'pair') return edges[rng.int(edges.length)];
    const chosen = edges[rng.int(edges.length)];
    return { from: chosen.from, to: chosen.to, weight: chosen.weight, viaPair: true };
  }

  /** A uniformly random pair of surviving supernodes that still has an edge.
   *  This is the WRONG distribution, kept so the demo can measure it. */
  function pickPair(edges, rng, alive) {
    const first = alive[rng.int(alive.length)];
    const candidates = edges.filter(function (edge) {
      return edge.from === first || edge.to === first;
    });
    if (candidates.length === 0) return edges[rng.int(edges.length)];
    return candidates[rng.int(candidates.length)];
  }

  /**
   * Contract until `down` supernodes remain. Returns the surviving cut, the
   * grouping, and the trace a visualisation needs. `pickBy` is 'edge' (the
   * algorithm) or 'pair' (the plausible mistake).
   */
  function contract(graph, options) {
    const settings = options || {};
    const down = settings.down === undefined ? 2 : settings.down;
    const rng = settings.rng;
    const label = [];
    const trace = [];
    let alive = [];

    for (let i = 0; i < graph.n; i += 1) { label.push(i); alive.push(i); }
    let edges = liveEdges(graph.edges, label);

    while (alive.length > down && edges.length > 0) {
      const chosen = settings.pickBy === 'pair'
        ? pickPair(edges, rng, alive) : pickEdge(edges, rng, settings.pickBy);
      const keep = Math.min(chosen.from, chosen.to);
      const drop = Math.max(chosen.from, chosen.to);

      for (let i = 0; i < graph.n; i += 1) { if (label[i] === drop) label[i] = keep; }
      alive = alive.filter(function (v) { return v !== drop; });
      edges = liveEdges(graph.edges, label);
      trace.push({ merged: [keep, drop], remaining: alive.length, edges: edges.length });
    }
    return report(graph, label, alive, trace, edges);
  }

  function report(graph, label, alive, trace, edges) {
    let weight = 0;
    for (let i = 0; i < edges.length; i += 1) weight += edges[i].weight;
    return { cut: weight, groups: label.slice(), supernodes: alive.slice(),
      contractions: trace.length, trace: trace, crossing: edges.length };
  }

  /* ------------------------------------------------------------- repetition */

  /**
   * Independent runs, with the empirical success rate reported against the
   * bound. `optimum` is supplied by the caller (from the oracle or from a
   * max-flow computation) so the success count is measured, never assumed.
   */
  function repeat(graph, options) {
    const settings = options || {};
    const trials = settings.trials === undefined ? 200 : settings.trials;
    const optimum = settings.optimum;
    const counts = new Map();
    let best = Infinity;
    let successes = 0;
    let exact = 0;
    let firstSuccess = -1;
    const history = [];

    for (let t = 0; t < trials; t += 1) {
      const run = contract(graph, { rng: settings.makeRng(t), pickBy: settings.pickBy });
      const mask = canonicalMask(run.groups);

      if (run.cut < best) best = run.cut;
      if (run.cut === optimum) {
        successes += 1;
        counts.set(mask, (counts.get(mask) || 0) + 1);
        if (firstSuccess < 0) firstSuccess = t;
      }
      if (settings.targetMask !== undefined && mask === settings.targetMask) exact += 1;
      history.push({ trial: t, cut: run.cut, best: best, rate: successes / (t + 1) });
    }
    return { best: best, trials: trials, successes: successes, firstSuccess: firstSuccess,
      empiricalRate: successes / trials, predictedRate: successProbability(graph.n),
      exactCutHits: exact, exactCutRate: exact / trials, distinctCutsFound: counts.size,
      found: best === optimum, history: history };
  }

  /**
   * The partition as one integer, normalised so vertex 0 sits on side 0 - a
   * cut and its complement are the same cut, and counting them separately is
   * how a success rate ends up at half what it should be.
   */
  function canonicalMask(groups) {
    let mask = 0;
    for (let i = 0; i < groups.length; i += 1) {
      if (groups[i] !== groups[0]) mask |= 1 << i;
    }
    return mask;
  }

  /* ----------------------------------------------------------- Karger-Stein */

  /**
   * The recursive improvement. Contracting down to n/√2 keeps the success
   * probability of that stage at about 1/2, so two recursive calls at that
   * size cost the same as one full run and the failure probabilities
   * multiply rather than compound. The recurrence is
   * T(n) = 2T(n/√2) + O(n²) = O(n² log n), and the success probability rises
   * from 1/n² to Ω(1/log n).
   */
  function kargerStein(graph, options) {
    const settings = options || {};
    const counter = { contractions: 0, calls: 0 };
    const best = steinStep(graph, settings.makeRng, counter, 0);
    return { cut: best, contractions: counter.contractions, calls: counter.calls,
      predictedRate: 1 / Math.log(Math.max(graph.n, 3)) };
  }

  function steinStep(graph, makeRng, counter, depth) {
    counter.calls += 1;

    if (graph.n <= 6) {
      const exact = bruteForceMinCut(graph);
      return exact.cut;
    }
    const target = Math.max(2, Math.ceil(1 + graph.n / Math.SQRT2));
    let best = Infinity;

    for (let branch = 0; branch < 2; branch += 1) {
      const rng = makeRng(counter.calls * 31 + branch * 7 + depth);
      const run = contract(graph, { rng: rng, down: target });
      counter.contractions += run.contractions;
      const reduced = collapse(graph, run.groups);
      const found = steinStep(reduced, makeRng, counter, depth + 1);
      if (found < best) best = found;
    }
    return best;
  }

  /** Rebuild a graph over the surviving supernodes, renumbered from zero. */
  function collapse(graph, label) {
    const index = new Map();
    const edges = [];

    for (let i = 0; i < graph.n; i += 1) {
      if (!index.has(label[i])) index.set(label[i], index.size);
    }
    graph.edges.forEach(function (edge) {
      const from = index.get(label[edge.from]);
      const to = index.get(label[edge.to]);
      if (from !== to) edges.push({ from: from, to: to, weight: edge.weight || 1 });
    });
    return { n: index.size, edges: edges, directed: false, name: 'collapsed' };
  }

  return {
    successProbability: successProbability, trialsFor: trialsFor,
    bruteForceMinCut: bruteForceMinCut, cutWeight: cutWeight,
    contract: contract, repeat: repeat, kargerStein: kargerStein, collapse: collapse,
    canonicalMask: canonicalMask,
    BRUTE_FORCE_LIMIT: BRUTE_FORCE_LIMIT
  };
}));

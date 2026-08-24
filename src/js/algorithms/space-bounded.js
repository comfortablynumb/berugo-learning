/**
 * Space-bounded computation, with the working memory MEASURED rather than
 * claimed.
 *
 * The interesting fact about space is that it can be reused and time cannot,
 * and the cleanest demonstration is graph reachability. BFS answers it in
 * linear time and linear space — it stores a visited set. Savitch's recursive
 * midpoint search answers the same question in O(log² n) space and pays for it
 * in time, by re-deriving what BFS would have remembered.
 *
 * Both implementations here carry a `peak` counter that is incremented as
 * memory is actually taken and decremented as it is released, so the demo
 * reports what the algorithm used rather than what its asymptotic label says.
 * That distinction matters: a "log-space" implementation with an accidental
 * memo table is a perfectly ordinary linear-space algorithm wearing a label.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.SpaceBounded = api;
}(this, function () {
  'use strict';

  /* ------------------------------------------------------------- accounting */

  /**
   * A memory meter. `hold(bits)` takes memory and returns a release function,
   * so the peak is the real high-water mark of concurrently held state rather
   * than a total.
   */
  function meter() {
    const state = { held: 0, peak: 0, allocations: 0 };

    return {
      hold: function (bits) {
        state.held += bits;
        state.allocations += 1;
        state.peak = Math.max(state.peak, state.held);
        return function () { state.held -= bits; };
      },
      peak: function () { return state.peak; },
      held: function () { return state.held; },
      allocations: function () { return state.allocations; }
    };
  }

  /** A vertex index costs ceil(log2 n) bits, which is the unit every claim in
   *  this section is denominated in. */
  function indexBits(n) {
    return Math.max(1, Math.ceil(Math.log2(Math.max(2, n))));
  }

  /* ------------------------------------------------------------------ BFS */

  /**
   * The ordinary answer: a visited set and a queue. Linear time, and linear
   * space because the visited set holds up to n vertex indices at once.
   */
  function breadthFirst(graph, from, to) {
    const gauge = meter();
    const bits = indexBits(graph.n);
    const visited = {};
    const queue = [from];
    const releases = [gauge.hold(bits)];
    let steps = 0;

    visited[from] = true;
    while (queue.length) {
      const current = queue.shift();

      steps += 1;
      if (current === to) break;
      (graph.edges[current] || []).forEach(function (next) {
        if (visited[next]) return;
        visited[next] = true;
        releases.push(gauge.hold(bits));
        queue.push(next);
      });
    }
    const found = Boolean(visited[to]);

    return { reachable: found, steps: steps, peakBits: gauge.peak(),
      visited: Object.keys(visited).length, algorithm: 'breadth-first search' };
  }

  /* ------------------------------------------------------------- Savitch */

  /**
   * Savitch's recursive midpoint search: is `to` reachable from `from` in at
   * most 2^k steps? Guess a midpoint, and recurse on both halves with half the
   * budget. Nothing is stored except the recursion stack, which is k frames
   * deep and holds three vertex indices each — O(log² n) bits in total.
   *
   * The cost is time: each level tries every midpoint, so the work is n^log n
   * rather than linear. The demo counts both, and the trade is the section.
   */
  function savitch(graph, from, to) {
    const gauge = meter();
    const bits = indexBits(graph.n);
    const levels = Math.ceil(Math.log2(Math.max(2, graph.n)));
    const state = { steps: 0, cap: 4000000, overflow: false };
    const reachable = canReach({ graph: graph, gauge: gauge, bits: bits, state: state },
      from, to, levels);

    return { reachable: reachable, steps: state.steps, peakBits: gauge.peak(),
      levels: levels, overflow: state.overflow,
      algorithm: 'Savitch recursive midpoint' };
  }

  /**
   * True when `to` is reachable from `from` in at most 2^budget steps. The
   * three held indices are `from`, `to` and the midpoint — one frame's worth
   * of memory, released on the way out, which is what makes the peak
   * proportional to the DEPTH rather than to the work.
   */
  function canReach(context, from, to, budget) {
    context.state.steps += 1;
    if (context.state.steps > context.state.cap) {
      context.state.overflow = true;
      return false;
    }
    if (from === to) return true;
    if (budget === 0) {
      return (context.graph.edges[from] || []).indexOf(to) !== -1;
    }
    const release = context.gauge.hold(context.bits * 3);

    for (let mid = 0; mid < context.graph.n; mid += 1) {
      if (canReach(context, from, mid, budget - 1)
        && canReach(context, mid, to, budget - 1)) {
        release();
        return true;
      }
    }
    release();
    return false;
  }

  /* --------------------------------------------------------------- graphs */

  function create(n, edgeList, label) {
    const edges = {};

    for (let i = 0; i < n; i += 1) edges[i] = [];
    (edgeList || []).forEach(function (edge) { edges[edge[0]].push(edge[1]); });
    return { n: n, edges: edges, edgeList: (edgeList || []).slice(), label: label || null };
  }

  /** A path graph: the worst case for Savitch's depth and the best for BFS. */
  function path(n) {
    const edges = [];

    for (let i = 0; i + 1 < n; i += 1) edges.push([i, i + 1]);
    return create(n, edges, 'a path of ' + n + ' vertices');
  }

  /** A path with a dead-end branch off every vertex, so BFS visits more than
   *  it needs and the visited-set cost is visible. */
  function bushy(n) {
    const edges = [];
    let next = n;

    for (let i = 0; i + 1 < n; i += 1) {
      edges.push([i, i + 1]);
      edges.push([i, next]);
      next += 1;
    }
    return create(next, edges, 'a path of ' + n + ' with a dead end at each step');
  }

  /** Two components, so the answer is "no" and both algorithms must exhaust
   *  their search rather than stopping early. */
  function split(n) {
    const edges = [];

    for (let i = 0; i + 1 < n; i += 1) {
      if (i + 1 === Math.floor(n / 2)) continue;
      edges.push([i, i + 1]);
    }
    return create(n, edges, 'two components of ' + Math.floor(n / 2));
  }

  function graphs() {
    return { path: path, bushy: bushy, split: split };
  }

  /* ------------------------------------------------------------ comparison */

  /**
   * Both algorithms on one graph, with the memory each actually held. This is
   * the table the section is about, and the columns to read together are
   * `peakBits` and `steps` — one goes down as the other goes up.
   */
  function compare(graph, from, to) {
    const bfs = breadthFirst(graph, from, to);
    const rec = savitch(graph, from, to);

    return {
      agree: bfs.reachable === rec.reachable || rec.overflow,
      rows: [bfs, rec],
      bound: indexBits(graph.n) * Math.ceil(Math.log2(Math.max(2, graph.n))) * 3,
      spaceRatio: rec.peakBits === 0 ? 0 : bfs.peakBits / rec.peakBits,
      timeRatio: bfs.steps === 0 ? 0 : rec.steps / bfs.steps
    };
  }

  /** The class table this section is really about. */
  const CLASSES = [
    { name: 'L', definition: 'deterministic log space',
      canonical: 'undirected reachability (Reingold, 2004)',
      note: 'A constant number of pointers into the input, and nothing else.' },
    { name: 'NL', definition: 'nondeterministic log space',
      canonical: 'DIRECTED reachability — the complete problem for the class',
      note: 'NL = coNL by Immerman–Szelepcsényi, which no one expected.' },
    { name: 'P', definition: 'deterministic polynomial time',
      canonical: 'linear programming, matching, 2-SAT',
      note: 'L ⊆ NL ⊆ P, and every containment is open.' },
    { name: 'PSPACE', definition: 'polynomial space, any amount of time',
      canonical: 'quantified Boolean formulas, generalised chess and Go',
      note: 'PSPACE = NPSPACE by Savitch — nondeterminism buys nothing here.' },
    { name: 'EXPTIME', definition: 'exponential time',
      canonical: 'generalised chess with a move bound',
      note: 'P ⊊ EXPTIME by the time hierarchy theorem — one of the few we can prove.' }
  ];

  return {
    meter: meter, indexBits: indexBits, breadthFirst: breadthFirst, savitch: savitch,
    canReach: canReach, create: create, path: path, bushy: bushy, split: split,
    graphs: graphs, compare: compare, CLASSES: CLASSES
  };
}));

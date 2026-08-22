/**
 * The Hungarian algorithm for weighted bipartite matching, and Edmonds's
 * blossom algorithm for general graphs.
 *
 * These are the two places the bipartite story stops being enough. The
 * Hungarian algorithm is min-cost perfect matching on a square cost matrix in
 * O(n³), maintaining a dual potential per row and column exactly as min-cost
 * flow does - the same reweighting, in yet another disguise.
 *
 * **Blossoms are where "just extend the bipartite algorithm" stops working,
 * and the reason is worth being able to state.** An alternating path in a
 * bipartite graph alternates sides, so its parity is fixed by the bipartition.
 * An odd cycle has no bipartition, so a vertex on it can be reached by both an
 * even-length and an odd-length alternating path, and the search has to treat
 * it as both at once. Edmonds's answer is to contract the whole odd cycle - a
 * *blossom* - into a single pseudo-vertex, find the augmenting path in the
 * contracted graph, and lift it back.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.WeightedMatching = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function emptyReport() {
    return { phases: 0, relabels: 0, comparisons: 0, augmentingPaths: 0,
      blossomsContracted: 0, edgesExamined: 0 };
  }

  /* ------------------------------------------------------- Hungarian */

  function hungarianState(size) {
    return {
      rowDual: new Array(size + 1).fill(0),
      colDual: new Array(size + 1).fill(0),
      owner: new Array(size + 1).fill(0),
      way: new Array(size + 1).fill(0)
    };
  }

  /** Grow the alternating tree from one row until it reaches a free column,
   *  lifting the duals by the smallest slack each time it stalls. */
  function hungarianPhase(matrix, state, row, report) {
    const size = matrix.length;
    const slack = new Array(size + 1).fill(Infinity);
    const used = new Array(size + 1).fill(false);
    let column = 0;

    state.owner[0] = row;

    do {
      used[column] = true;
      const inRow = state.owner[column];
      let delta = Infinity;
      let best = 0;

      for (let j = 1; j <= size; j += 1) {
        if (used[j]) continue;
        report.comparisons += 1;
        const value = matrix[inRow - 1][j - 1] - state.rowDual[inRow] - state.colDual[j];

        if (value < slack[j]) { slack[j] = value; state.way[j] = column; }

        if (slack[j] >= delta) continue;
        delta = slack[j];
        best = j;
      }

      for (let j = 0; j <= size; j += 1) {
        if (used[j]) {
          state.rowDual[state.owner[j]] += delta;
          state.colDual[j] -= delta;
        } else slack[j] -= delta;
      }
      report.relabels += 1;
      column = best;
    } while (state.owner[column] !== 0);
    return column;
  }

  /** Walk the alternating tree back, flipping the assignment as it goes. */
  function hungarianAugment(state, column) {
    let at = column;

    do {
      const previous = state.way[at];

      state.owner[at] = state.owner[previous];
      at = previous;
    } while (at);
  }

  /**
   * Minimum-cost perfect matching on a square cost matrix. Row and column
   * duals satisfy `rowDual[i] + colDual[j] <= cost[i][j]` throughout, and the
   * final assignment is tight on every chosen cell - which is the certificate,
   * and is checkable independently of how it was produced.
   */
  function hungarian(matrix, options) {
    const report = (options || {}).report || emptyReport();
    const size = matrix.length;
    const state = hungarianState(size);

    for (let row = 1; row <= size; row += 1) {
      report.phases += 1;
      hungarianAugment(state, hungarianPhase(matrix, state, row, report));
      report.augmentingPaths += 1;
    }
    const assignment = new Array(size).fill(-1);

    for (let j = 1; j <= size; j += 1) {
      if (state.owner[j] === 0) continue;
      assignment[state.owner[j] - 1] = j - 1;
    }
    const cost = assignment.reduce(function (sum, column, row) {
      return sum + matrix[row][column];
    }, 0);
    return { assignment: assignment, cost: cost, rowDual: state.rowDual,
      colDual: state.colDual, report: report };
  }

  /**
   * The duals are a *proof*: every cell is at least the sum of its two duals,
   * every chosen cell is exactly that, and the dual total therefore equals the
   * assignment cost. A wrong assignment cannot satisfy all three.
   */
  function checkHungarian(matrix, run) {
    const size = matrix.length;
    let violated = 0;
    let slackOnChosen = 0;

    for (let i = 0; i < size; i += 1) {
      for (let j = 0; j < size; j += 1) {
        const slack = matrix[i][j] - run.rowDual[i + 1] - run.colDual[j + 1];

        if (slack < -1e-9) violated += 1;
      }
      const chosen = matrix[i][run.assignment[i]] -
        run.rowDual[i + 1] - run.colDual[run.assignment[i] + 1];

      if (Math.abs(chosen) > 1e-9) slackOnChosen += 1;
    }
    const perfect = new Set(run.assignment).size === size;
    return { violated: violated, slackOnChosen: slackOnChosen, perfect: perfect,
      valid: violated === 0 && slackOnChosen === 0 && perfect };
  }

  /* --------------------------------------------------------- blossom */

  function blossomState(n) {
    return { match: new Array(n).fill(-1), parent: new Array(n).fill(-1),
      base: new Array(n).fill(0), queue: [], inQueue: new Array(n).fill(false),
      blossom: new Array(n).fill(false) };
  }

  /** The lowest common ancestor of two vertices in the alternating forest,
   *  walking by base rather than by vertex - which is what makes an already
   *  contracted blossom behave as one node. */
  function alternatingLca(state, a, b) {
    const seen = new Array(state.base.length).fill(false);
    let at = a;

    for (;;) {
      at = state.base[at];
      seen[at] = true;

      if (state.match[at] === -1) break;
      at = state.parent[state.match[at]];
    }
    at = b;

    for (;;) {
      at = state.base[at];

      if (seen[at]) return at;
      at = state.parent[state.match[at]];
    }
  }

  /** Mark every vertex on the odd cycle between `v` and the blossom base. */
  function markPath(state, v, base, child) {
    let at = v;
    let previous = child;

    while (state.base[at] !== base) {
      state.blossom[state.base[at]] = true;
      state.blossom[state.base[state.match[at]]] = true;
      state.parent[at] = previous;
      previous = state.match[at];
      at = state.parent[state.match[at]];
    }
  }

  /** Contract the odd cycle through (u, v) into its base, re-queueing every
   *  vertex it swallowed because each is now reachable by an even path. */
  function contract(state, u, v, n) {
    const base = alternatingLca(state, u, v);

    state.blossom.fill(false);
    markPath(state, u, base, v);
    markPath(state, v, base, u);

    for (let i = 0; i < n; i += 1) {
      if (!state.blossom[state.base[i]]) continue;
      state.base[i] = base;

      if (state.inQueue[i]) continue;
      state.inQueue[i] = true;
      state.queue.push(i);
    }
  }

  /** One breadth-first search for an augmenting path from `root`. */
  function findAugmenting(adjacency, root, state, report) {
    const n = adjacency.length;

    state.parent.fill(-1);
    state.inQueue.fill(false);

    for (let i = 0; i < n; i += 1) state.base[i] = i;
    state.queue = [root];
    state.inQueue[root] = true;

    while (state.queue.length) {
      const u = state.queue.shift();

      for (let i = 0; i < adjacency[u].length; i += 1) {
        const v = adjacency[u][i];

        report.edgesExamined += 1;

        if (state.base[u] === state.base[v] || state.match[u] === v) continue;

        if (v === root || (state.match[v] !== -1 && state.parent[state.match[v]] !== -1)) {
          contract(state, u, v, n);
          report.blossomsContracted += 1;
          continue;
        }

        if (state.parent[v] !== -1) continue;
        state.parent[v] = u;

        if (state.match[v] === -1) return v;
        state.inQueue[state.match[v]] = true;
        state.queue.push(state.match[v]);
      }
    }
    return -1;
  }

  /** Flip the alternating path the parent pointers describe. */
  function flipPath(state, endpoint) {
    let v = endpoint;

    while (v !== -1) {
      const parent = state.parent[v];
      const next = state.match[parent];

      state.match[v] = parent;
      state.match[parent] = v;
      v = next;
    }
  }

  /**
   * Maximum cardinality matching on a general graph. `adjacency` is an array
   * of neighbour lists; the result is a `match` array where match[v] is v's
   * partner or -1.
   */
  function blossomMatching(adjacency, options) {
    const report = (options || {}).report || emptyReport();
    const n = adjacency.length;
    const state = blossomState(n);

    for (let v = 0; v < n; v += 1) {
      if (state.match[v] !== -1) continue;
      const endpoint = findAugmenting(adjacency, v, state, report);

      if (endpoint === -1) continue;
      flipPath(state, endpoint);
      report.augmentingPaths += 1;
    }
    const size = state.match.filter(function (p) { return p !== -1; }).length / 2;
    return { match: state.match, size: size, report: report };
  }

  /** Every partner real, mutual, and nobody used twice. */
  function checkGeneralMatching(adjacency, match) {
    const neighbours = adjacency.map(function (list) { return new Set(list); });
    let bogus = 0;
    let inconsistent = 0;

    match.forEach(function (partner, v) {
      if (partner === -1) return;

      if (!neighbours[v].has(partner)) bogus += 1;

      if (match[partner] !== v) inconsistent += 1;
    });
    return { bogus: bogus, inconsistent: inconsistent,
      valid: bogus === 0 && inconsistent === 0 };
  }

  /** Brute force over every pairing, for the small graphs a test can afford.
   *  It is the only oracle that owes nothing to Edmonds. */
  function matchingByBruteForce(adjacency) {
    const n = adjacency.length;
    const neighbours = adjacency.map(function (list) { return new Set(list); });
    let best = 0;

    const search = function (v, used, size) {
      if (v >= n) { best = Math.max(best, size); return; }

      if (used[v]) { search(v + 1, used, size); return; }
      search(v + 1, used, size);

      for (let w = v + 1; w < n; w += 1) {
        if (used[w] || !neighbours[v].has(w)) continue;
        used[v] = true;
        used[w] = true;
        search(v + 1, used, size + 1);
        used[v] = false;
        used[w] = false;
      }
    };

    search(0, new Array(n).fill(false), 0);
    return best;
  }

  return {
    emptyReport: emptyReport,
    hungarian: hungarian, checkHungarian: checkHungarian,
    blossomMatching: blossomMatching, checkGeneralMatching: checkGeneralMatching,
    matchingByBruteForce: matchingByBruteForce
  };
}));

/**
 * Disjoint set union: union by rank or size, path compression, and rollback.
 *
 * Two independent ideas, and the bound needs both. Union by rank keeps the
 * tree shallow by never hanging a taller tree under a shorter one, giving
 * O(log n) alone. Path compression flattens every path it walks, giving
 * O(log n) amortised alone. Together they give O(α(n)) amortised, where α is
 * the inverse Ackermann function - below 5 for any n that fits in this
 * universe, which is why "effectively constant" is the honest description and
 * "constant" is not.
 *
 * The rollback variant is here because it is the trap: path compression
 * rewrites parents that the union never touched, so there is no bounded undo
 * record. A structure that must roll back (offline dynamic connectivity,
 * divide-and-conquer over time) has to give compression up and keep union by
 * rank only, which is O(log n) per operation and still fine.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Dsu = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const STRATEGIES = ['none', 'compression', 'splitting', 'halving'];

  function newStats() {
    return {
      finds: 0, unions: 0, merged: 0, pointerWrites: 0, nodeVisits: 0, rollbacks: 0
    };
  }

  /** The two settings that cannot be combined, checked once and loudly: a
   *  compressing find rewrites parents that no union recorded, so there is
   *  nothing for undo() to restore. */
  function settingsFor(options) {
    const settings = options || {};
    const compress = settings.compress === undefined ? 'compression' : settings.compress;
    const rollback = Boolean(settings.rollback);

    if (STRATEGIES.indexOf(compress) === -1) {
      throw new Error('dsu: unknown compression strategy "' + compress + '"');
    }
    if (rollback && compress !== 'none') {
      throw new Error('dsu: rollback needs compress:"none" - a compressing find rewrites parents that no undo record captured');
    }
    return {
      size: settings.size || 0,
      compress: compress,
      byRank: settings.byRank === undefined ? true : Boolean(settings.byRank),
      rollback: rollback
    };
  }

  function create(options) {
    const settings = settingsFor(options);
    const n = settings.size;
    const compress = settings.compress;
    const byRank = settings.byRank;
    const trackRollback = settings.rollback;

    const parent = new Array(n);
    const rank = new Array(n).fill(0);
    const weight = new Array(n).fill(1);
    for (let i = 0; i < n; i += 1) parent[i] = i;

    let components = n;
    let stats = newStats();
    const journal = [];

    /** Plain walk to the root, no rewriting. */
    function rootOf(x) {
      let node = x;
      while (parent[node] !== node) {
        stats.nodeVisits += 1;
        node = parent[node];
      }
      return node;
    }

    /** Full path compression: a second pass points every node on the path
     *  straight at the root. */
    function findCompressing(x) {
      const top = rootOf(x);
      let node = x;
      while (parent[node] !== top) {
        const next = parent[node];
        parent[node] = top;
        stats.pointerWrites += 1;
        node = next;
      }
      return top;
    }

    /** Path splitting: every node points at its grandparent, in one pass. */
    function findSplitting(x) {
      let node = x;
      while (parent[node] !== node) {
        stats.nodeVisits += 1;
        const next = parent[node];
        parent[node] = parent[next];
        if (parent[node] !== next) stats.pointerWrites += 1;
        node = next;
      }
      return node;
    }

    /** Path halving: the same, skipping every other node. */
    function findHalving(x) {
      let node = x;
      while (parent[node] !== node) {
        stats.nodeVisits += 1;
        const grand = parent[parent[node]];
        if (grand !== parent[node]) { parent[node] = grand; stats.pointerWrites += 1; }
        node = parent[node];
      }
      return node;
    }

    function find(x) {
      stats.finds += 1;
      if (compress === 'compression') return findCompressing(x);
      if (compress === 'splitting') return findSplitting(x);
      if (compress === 'halving') return findHalving(x);
      return rootOf(x);
    }

    function orderRoots(a, b) {
      if (byRank) return rank[a] < rank[b] ? [b, a] : [a, b];
      return weight[a] < weight[b] ? [b, a] : [a, b];
    }

    /** Returns true when two different components were joined. The journal
     *  entry is exactly what has to be undone: one parent and one rank. */
    function union(x, y) {
      stats.unions += 1;
      const a = find(x);
      const b = find(y);
      if (a === b) {
        if (trackRollback) journal.push(null);
        return false;
      }

      const pair = orderRoots(a, b);
      const keep = pair[0];
      const attach = pair[1];

      if (trackRollback) journal.push({ child: attach, root: keep, rank: rank[keep], weight: weight[keep] });

      parent[attach] = keep;
      stats.pointerWrites += 1;
      weight[keep] += weight[attach];
      if (byRank && rank[keep] === rank[attach]) rank[keep] += 1;
      components -= 1;
      stats.merged += 1;
      return true;
    }

    /** Undoes the last union. Only possible because no find rewrote anything. */
    function undo() {
      if (!trackRollback) throw new Error('dsu: this instance was not created with rollback');
      if (!journal.length) return false;

      const entry = journal.pop();
      stats.rollbacks += 1;
      if (!entry) return false;

      parent[entry.child] = entry.child;
      rank[entry.root] = entry.rank;
      weight[entry.root] = entry.weight;
      components += 1;
      return true;
    }

    function connected(x, y) {
      return find(x) === find(y);
    }

    /** The forest as parent links plus the depth of each node, for the view. */
    function forest() {
      const depth = new Array(n).fill(0);
      for (let i = 0; i < n; i += 1) {
        let node = i;
        let steps = 0;
        while (parent[node] !== node) { node = parent[node]; steps += 1; }
        depth[i] = steps;
      }
      return { parent: parent.slice(), depth: depth, rank: rank.slice(), weight: weight.slice() };
    }

    function maxDepth() {
      return forest().depth.reduce(function (best, value) { return Math.max(best, value); }, 0);
    }

    function checkInvariants() {
      const errors = [];
      let roots = 0;
      for (let i = 0; i < n; i += 1) {
        if (parent[i] === i) roots += 1;
        if (parent[i] < 0 || parent[i] >= n) errors.push('node ' + i + ' points outside the set');
      }
      if (roots !== components) errors.push('found ' + roots + ' roots but the count says ' + components);

      for (let i = 0; i < n; i += 1) {
        let node = i;
        let steps = 0;
        while (parent[node] !== node && steps <= n) { node = parent[node]; steps += 1; }
        if (steps > n) { errors.push('a cycle is reachable from ' + i); break; }
      }
      return { ok: errors.length === 0, errors: errors };
    }

    return {
      name: 'dsu-' + compress + (byRank ? '-rank' : '-size'),
      find: find,
      union: union,
      undo: undo,
      connected: connected,
      components: function () { return components; },
      size: function () { return n; },
      componentSize: function (x) { return weight[find(x)]; },
      forest: forest,
      maxDepth: maxDepth,
      journalLength: function () { return journal.length; },
      snapshot: function () { return { parent: parent.slice(), rank: rank.slice() }; },
      checkInvariants: checkInvariants,
      stats: function () { return Object.assign({ components: components, maxDepth: maxDepth() }, stats); },
      resetStats: function () { stats = newStats(); }
    };
  }

  /** α(n) as the practical staircase: the smallest k with A(k, ·) past n. The
   *  point of the table is that the answer is 4 for every real input. */
  function inverseAckermann(n) {
    if (n <= 2) return 1;
    if (n <= 4) return 2;
    if (n <= 16) return 3;
    if (n <= 65536) return 4;
    return 5;
  }

  return { create: create, inverseAckermann: inverseAckermann, STRATEGIES: STRATEGIES, newStats: newStats };
}));

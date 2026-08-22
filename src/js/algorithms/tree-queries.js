/**
 * Rooting, Euler tours, lowest common ancestors and heavy-light
 * decomposition - the toolkit for asking questions about paths in a tree.
 *
 * Three LCA implementations are here because they occupy three different
 * points on the same trade, and a section that shows only one is showing a
 * preference rather than a decision:
 *
 *   naive climb      O(1) build, O(depth) query. Unbeatable when you ask a
 *                    handful of questions, and it is the oracle for the
 *                    other two.
 *   binary lifting   O(n log n) build, O(log n) query, and it answers the
 *                    *k-th ancestor* question the others cannot.
 *   sparse table     O(n log n) build over the Euler tour, O(1) query - the
 *                    fastest queries available, and it answers only LCA.
 *
 * Heavy-light decomposition is the general answer to "range queries on tree
 * paths", and its O(log n) bound comes from a counting argument worth being
 * able to state rather than cite: a *light* edge leads to a child whose
 * subtree is at most half its parent's, so a root-to-leaf path crosses at
 * most log₂n of them - and every chain change costs exactly one light edge.
 * `chainsOnPath` reports the count so the bound is a measurement.
 *
 * Every walk here is iterative, for the reason the rest of M13 is: a path of
 * a million nodes is a legitimate tree.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.TreeQueries = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function emptyReport() {
    return { buildSteps: 0, querySteps: 0, jumps: 0, chains: 0, segments: 0, maxDepth: 0 };
  }

  /* ------------------------------------------------------------- rooting */

  /**
   * Parent, depth, subtree size and a discovery order, iteratively. The order
   * walked backwards is a valid child-before-parent order, which every
   * aggregate below relies on.
   */
  function rootTree(adjacency, source, options) {
    const report = (options || {}).report || emptyReport();
    const n = adjacency.length;
    const parent = new Array(n).fill(-1);
    const depth = new Array(n).fill(0);
    const size = new Array(n).fill(1);
    const order = [];
    const seen = new Array(n).fill(false);
    const stack = [source];

    seen[source] = true;

    while (stack.length) {
      const node = stack.pop();
      order.push(node);
      report.buildSteps += 1;
      report.maxDepth = Math.max(report.maxDepth, depth[node]);
      adjacency[node].forEach(function (edge) {
        if (seen[edge.to]) return;
        seen[edge.to] = true;
        parent[edge.to] = node;
        depth[edge.to] = depth[node] + 1;
        stack.push(edge.to);
      });
    }

    for (let i = order.length - 1; i > 0; i -= 1) {
      const node = order[i];
      size[parent[node]] += size[node];
    }
    return { parent: parent, depth: depth, size: size, order: order, root: source, report: report };
  }

  /* ------------------------------------------------------- the naive climb */

  /** Lift the deeper node to the shallower one, then step both up together.
   *  O(depth) per query, and it is the oracle the other two are checked
   *  against - which is the only reason to keep it. */
  function naiveLca(rooted, a, b, options) {
    const report = (options || {}).report || emptyReport();
    let x = a;
    let y = b;

    while (rooted.depth[x] > rooted.depth[y]) { x = rooted.parent[x]; report.querySteps += 1; }

    while (rooted.depth[y] > rooted.depth[x]) { y = rooted.parent[y]; report.querySteps += 1; }

    while (x !== y) {
      x = rooted.parent[x];
      y = rooted.parent[y];
      report.querySteps += 2;
    }
    return x;
  }

  function naiveAncestor(rooted, node, k) {
    let at = node;

    for (let i = 0; i < k; i += 1) {
      if (at === -1) return -1;
      at = rooted.parent[at];
    }
    return at;
  }

  /* ------------------------------------------------------ binary lifting */

  /**
   * `up[k][v]` is v's 2^k-th ancestor. Every ancestor distance is a sum of
   * distinct powers of two, so the k-th ancestor is at most log₂n jumps -
   * and that generality is what binary lifting buys over the sparse table,
   * which answers only LCA.
   */
  function buildLifting(rooted, options) {
    const report = (options || {}).report || emptyReport();
    const n = rooted.parent.length;
    const levels = Math.max(1, Math.ceil(Math.log2(Math.max(2, n))) + 1);
    const up = [rooted.parent.slice()];

    for (let k = 1; k < levels; k += 1) {
      const previous = up[k - 1];
      const row = new Array(n).fill(-1);

      for (let v = 0; v < n; v += 1) {
        report.buildSteps += 1;

        if (previous[v] === -1) continue;
        row[v] = previous[previous[v]];
      }
      up.push(row);
    }
    return { up: up, levels: levels, depth: rooted.depth, cells: levels * n, report: report };
  }

  function kthAncestor(lifting, node, k, options) {
    const report = (options || {}).report || emptyReport();
    let at = node;
    let remaining = k;

    for (let bit = 0; remaining > 0 && at !== -1; bit += 1) {
      if ((remaining & 1) === 1) { at = lifting.up[bit][at]; report.jumps += 1; }
      remaining >>= 1;
    }
    return at;
  }

  /** LCA by lifting: level the two nodes, then jump both by the largest power
   *  of two that keeps them apart. What is left is one step below the answer. */
  function liftingLca(lifting, a, b, options) {
    const report = (options || {}).report || emptyReport();
    let x = a;
    let y = b;

    if (lifting.depth[x] < lifting.depth[y]) { const t = x; x = y; y = t; }
    x = kthAncestor(lifting, x, lifting.depth[x] - lifting.depth[y], { report: report });

    if (x === y) return x;

    for (let k = lifting.levels - 1; k >= 0; k -= 1) {
      report.jumps += 1;

      if (lifting.up[k][x] === -1 || lifting.up[k][x] === lifting.up[k][y]) continue;
      x = lifting.up[k][x];
      y = lifting.up[k][y];
    }
    return lifting.up[0][x];
  }

  /**
   * The same walk as `liftingLca`, recording every jump. A counter cannot show
   * what makes binary lifting work: that levelling the two nodes is the binary
   * representation of the depth difference, and that the descent deliberately
   * stops one step short so the answer is the parent of where it stopped.
   */
  function liftingTrace(lifting, a, b) {
    const steps = [];
    let x = a;
    let y = b;

    if (lifting.depth[x] < lifting.depth[y]) { const t = x; x = y; y = t; }
    let gap = lifting.depth[x] - lifting.depth[y];

    for (let bit = 0; gap > 0; bit += 1) {
      if ((gap & 1) === 1) {
        steps.push({ phase: 'level', jump: 1 << bit, from: x, to: lifting.up[bit][x] });
        x = lifting.up[bit][x];
      }
      gap >>= 1;
    }

    if (x === y) return { steps: steps, lca: x, deep: a, shallow: b };

    for (let k = lifting.levels - 1; k >= 0; k -= 1) {
      if (lifting.up[k][x] === -1 || lifting.up[k][x] === lifting.up[k][y]) continue;
      steps.push({ phase: 'together', jump: 1 << k, from: x, to: lifting.up[k][x], other: y });
      x = lifting.up[k][x];
      y = lifting.up[k][y];
    }
    steps.push({ phase: 'final', jump: 1, from: x, to: lifting.up[0][x] });
    return { steps: steps, lca: lifting.up[0][x], deep: a, shallow: b };
  }

  /* --------------------------------------------------- Euler tour + sparse */

  /**
   * The Euler tour visits a node again every time the walk returns to it, so
   * the LCA of two nodes is the shallowest node between their first
   * appearances - a range-minimum query, which a sparse table answers in O(1).
   */
  function eulerTour(adjacency, source, options) {
    const report = (options || {}).report || emptyReport();
    const n = adjacency.length;
    const tour = [];
    const depths = [];
    const first = new Array(n).fill(-1);
    const seen = new Array(n).fill(false);
    const stack = [{ node: source, cursor: 0, depth: 0 }];

    seen[source] = true;

    while (stack.length) {
      const frame = stack[stack.length - 1];

      if (first[frame.node] === -1) {
        first[frame.node] = tour.length;
        tour.push(frame.node);
        depths.push(frame.depth);
        report.buildSteps += 1;
      }

      if (frame.cursor >= adjacency[frame.node].length) {
        stack.pop();

        if (!stack.length) break;
        tour.push(stack[stack.length - 1].node);
        depths.push(stack[stack.length - 1].depth);
        continue;
      }
      const edge = adjacency[frame.node][frame.cursor];
      frame.cursor += 1;

      if (seen[edge.to]) continue;
      seen[edge.to] = true;
      stack.push({ node: edge.to, cursor: 0, depth: frame.depth + 1 });
    }
    return { tour: tour, depths: depths, first: first, report: report };
  }

  /** Sparse table over the tour depths: O(n log n) cells, O(1) queries, and
   *  it answers nothing but LCA. */
  function buildSparse(euler, options) {
    const report = (options || {}).report || emptyReport();
    const m = euler.tour.length;
    const levels = Math.max(1, Math.floor(Math.log2(Math.max(1, m))) + 1);
    const table = [[]];

    for (let i = 0; i < m; i += 1) table[0].push(i);

    for (let k = 1; k < levels; k += 1) {
      const span = 1 << k;
      const row = [];

      for (let i = 0; i + span <= m; i += 1) {
        report.buildSteps += 1;
        const left = table[k - 1][i];
        const right = table[k - 1][i + (span >> 1)];
        row.push(euler.depths[left] <= euler.depths[right] ? left : right);
      }
      table.push(row);
    }
    return { table: table, euler: euler, levels: levels, cells: m * levels, report: report };
  }

  function sparseLca(sparse, a, b, options) {
    const report = (options || {}).report || emptyReport();
    let low = sparse.euler.first[a];
    let high = sparse.euler.first[b];

    if (low > high) { const t = low; low = high; high = t; }
    const span = high - low + 1;
    const k = Math.floor(Math.log2(span));
    report.querySteps += 1;
    const left = sparse.table[k][low];
    const right = sparse.table[k][high - (1 << k) + 1];
    const best = sparse.euler.depths[left] <= sparse.euler.depths[right] ? left : right;
    return sparse.euler.tour[best];
  }

  /** Distance through the LCA: depth(a) + depth(b) − 2·depth(lca). */
  function distance(rooted, lca, a, b) {
    return rooted.depth[a] + rooted.depth[b] - 2 * rooted.depth[lca];
  }

  /* ----------------------------------------------- heavy-light decomposition */

  /**
   * Each node's heaviest child continues its chain; every other child starts
   * a new one. Because a light edge halves the subtree size, a root-to-leaf
   * path crosses at most log₂n light edges - and a path query therefore
   * decomposes into at most O(log n) contiguous chain ranges.
   */
  function heavyLight(adjacency, rooted, options) {
    const report = (options || {}).report || emptyReport();
    const n = adjacency.length;
    const heavy = new Array(n).fill(-1);

    rooted.order.slice().reverse().forEach(function (node) {
      let best = -1;

      adjacency[node].forEach(function (edge) {
        if (edge.to === rooted.parent[node]) return;

        if (best !== -1 && rooted.size[edge.to] <= rooted.size[best]) return;
        best = edge.to;
      });
      heavy[node] = best;
      report.buildSteps += 1;
    });

    const head = new Array(n).fill(-1);
    const position = new Array(n).fill(-1);
    let counter = 0;

    rooted.order.forEach(function (node) {
      if (head[node] !== -1) return;
      let at = node;
      const chainHead = rooted.parent[node] !== -1 && heavy[rooted.parent[node]] === node
        ? head[rooted.parent[node]] : node;

      while (at !== -1) {
        head[at] = chainHead;
        position[at] = counter;
        counter += 1;
        at = heavy[at];
      }
    });
    report.chains = countChains(head);
    return { heavy: heavy, head: head, position: position, chains: report.chains, report: report };
  }

  function countChains(head) {
    const seen = new Set();

    head.forEach(function (h) { seen.add(h); });
    return seen.size;
  }

  /**
   * The path from a to b as a list of contiguous ranges in the chain
   * ordering. The *length of this list* is the O(log n) claim, so it is
   * returned rather than described.
   */
  function chainsOnPath(hld, rooted, a, b, options) {
    const report = (options || {}).report || emptyReport();
    const segments = [];
    let x = a;
    let y = b;

    while (hld.head[x] !== hld.head[y]) {
      report.querySteps += 1;

      if (rooted.depth[hld.head[x]] < rooted.depth[hld.head[y]]) { const t = x; x = y; y = t; }
      segments.push({ from: hld.position[hld.head[x]], to: hld.position[x], chain: hld.head[x] });
      x = rooted.parent[hld.head[x]];
    }
    const low = Math.min(hld.position[x], hld.position[y]);
    const high = Math.max(hld.position[x], hld.position[y]);

    segments.push({ from: low, to: high, chain: hld.head[x] });
    report.segments = segments.length;
    return { segments: segments, count: segments.length, lca: rooted.depth[x] <= rooted.depth[y] ? x : y,
      report: report };
  }

  /** The union of the segments must be exactly the vertices on the path -
   *  the check that separates a working decomposition from a plausible one. */
  function verifySegments(hld, rooted, a, b, segments) {
    const covered = new Set();

    segments.forEach(function (segment) {
      for (let p = segment.from; p <= segment.to; p += 1) covered.add(p);
    });
    const onPath = new Set();
    const lca = naiveLca(rooted, a, b, {});
    let at = a;

    while (at !== lca) { onPath.add(hld.position[at]); at = rooted.parent[at]; }
    at = b;

    while (at !== lca) { onPath.add(hld.position[at]); at = rooted.parent[at]; }
    onPath.add(hld.position[lca]);

    if (covered.size !== onPath.size) return { valid: false, covered: covered.size, onPath: onPath.size };
    let same = true;

    onPath.forEach(function (p) { if (!covered.has(p)) same = false; });
    return { valid: same, covered: covered.size, onPath: onPath.size };
  }

  /* ------------------------------------------------------------ generators */

  /** Shapes whose LCA behaviour differs: a path is depth n, a star is depth
   *  1, a caterpillar is in between, and a random tree is logarithmic. */
  function shapedTree(kind, n, random) {
    const edges = [];

    for (let v = 1; v < n; v += 1) {
      if (kind === 'path') edges.push({ from: v - 1, to: v, weight: 1 });
      else if (kind === 'star') edges.push({ from: 0, to: v, weight: 1 });
      else if (kind === 'caterpillar') edges.push({ from: Math.floor((v - 1) / 2), to: v, weight: 1 });
      else if (kind === 'binary') edges.push({ from: (v - 1) >> 1, to: v, weight: 1 });
      else edges.push({ from: random ? random.int(v) : v - 1, to: v, weight: 1 });
    }
    return { n: n, edges: edges, directed: false, name: kind };
  }

  return {
    emptyReport: emptyReport, rootTree: rootTree,
    naiveLca: naiveLca, naiveAncestor: naiveAncestor,
    buildLifting: buildLifting, kthAncestor: kthAncestor, liftingLca: liftingLca,
    liftingTrace: liftingTrace,
    eulerTour: eulerTour, buildSparse: buildSparse, sparseLca: sparseLca, distance: distance,
    heavyLight: heavyLight, chainsOnPath: chainsOnPath, verifySegments: verifySegments,
    shapedTree: shapedTree
  };
}));

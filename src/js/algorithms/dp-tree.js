/**
 * DP over trees, and rerooting - the technique that turns "run it from every
 * node" into one downward pass and one upward pass.
 *
 * Rerooting is the tree analogue of prefix sums, and the analogy is exact.
 * Computing the answer for root r means combining the contributions of r's
 * children; computing it for every r means each node needs "all my children
 * except this one", which is a prefix/suffix product over the child list. Do
 * it naively and it is O(deg²) per node, which on a star is O(n²) - the exact
 * cost the technique claims to remove. `prefixSuffix` is therefore not an
 * implementation detail, and the demo counts combines so the difference is
 * measured rather than asserted.
 *
 * Two things here exist because they are the usual failures:
 *
 *   - **Every traversal is iterative.** A path graph of 100 000 nodes is a
 *     recursion 100 000 deep, and the sections replay trees that large. This
 *     is the same rule `bst.js` learned in M04.
 *   - **`sumOfDistances` has a brute-force reference that runs a BFS from
 *     every node.** A rerooting bug produces a plausible array of distances,
 *     usually right at the root it was computed from and wrong everywhere
 *     else, which is invisible without the n-BFS comparison.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.DpTree = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function emptyReport() {
    return { states: 0, transitions: 0, combines: 0, maxDepth: 0, passes: 0 };
  }

  /* ------------------------------------------------------------ the tree */

  /** Adjacency from an edge list. Trees here are undirected; the root is a
   *  choice made by the traversal, which is the whole point of rerooting. */
  function adjacencyFrom(n, edges) {
    const adjacency = [];

    for (let i = 0; i < n; i += 1) adjacency.push([]);
    edges.forEach(function (edge) {
      adjacency[edge[0]].push(edge[1]);
      adjacency[edge[1]].push(edge[0]);
    });
    return adjacency;
  }

  /**
   * A traversal order and a parent array, computed iteratively. `order` is a
   * valid child-to-parent evaluation order when walked backwards, which is
   * what every function below relies on instead of recursing.
   */
  function rootAt(adjacency, source, report) {
    const parent = new Array(adjacency.length).fill(-1);
    const depth = new Array(adjacency.length).fill(0);
    const order = [];
    const stack = [source];
    const seen = new Array(adjacency.length).fill(false);

    seen[source] = true;

    while (stack.length) {
      const node = stack.pop();
      order.push(node);

      if (report) report.maxDepth = Math.max(report.maxDepth, depth[node]);
      adjacency[node].forEach(function (next) {
        if (seen[next]) return;
        seen[next] = true;
        parent[next] = node;
        depth[next] = depth[node] + 1;
        stack.push(next);
      });
    }
    return { order: order, parent: parent, depth: depth };
  }

  /* ------------------------------------------------- classic rooted tree DP */

  /**
   * Maximum-weight independent set on a tree: each node is taken or not, and
   * taking it forbids its children. Two values per node, settled child first.
   */
  function independentSet(adjacency, weights, options) {
    const settings = options || {};
    const report = settings.report || emptyReport();
    const rooted = rootAt(adjacency, settings.root || 0, report);
    const take = new Array(adjacency.length).fill(0);
    const skip = new Array(adjacency.length).fill(0);

    report.passes += 1;

    for (let i = rooted.order.length - 1; i >= 0; i -= 1) {
      const node = rooted.order[i];
      report.states += 1;
      take[node] = weights[node];

      adjacency[node].forEach(function (child) {
        if (child === rooted.parent[node]) return;
        report.transitions += 2;
        report.combines += 1;
        take[node] += skip[child];
        skip[node] += Math.max(take[child], skip[child]);
      });
    }
    const source = settings.root || 0;
    return { value: Math.max(take[source], skip[source]), take: take, skip: skip, report: report };
  }

  /** Subtree sizes and subtree sums, the two aggregates every other tree DP
   *  in the milestone is built from. */
  function subtreeAggregates(adjacency, values, options) {
    const settings = options || {};
    const report = settings.report || emptyReport();
    const rooted = rootAt(adjacency, settings.root || 0, report);
    const size = new Array(adjacency.length).fill(1);
    const sum = values.slice();

    report.passes += 1;

    for (let i = rooted.order.length - 1; i >= 0; i -= 1) {
      const node = rooted.order[i];
      const up = rooted.parent[node];
      report.states += 1;

      if (up === -1) continue;
      report.transitions += 2;
      report.combines += 1;
      size[up] += size[node];
      sum[up] += sum[node];
    }
    return { size: size, sum: sum, order: rooted.order, parent: rooted.parent, report: report };
  }

  /**
   * The diameter, by the two-pass BFS argument: the farthest node from
   * anywhere is an endpoint of some diameter. Included because it is the one
   * tree "DP" that is not a DP, and the section says so.
   */
  function diameter(adjacency, options) {
    const report = (options || {}).report || emptyReport();

    function farthest(source) {
      const rooted = rootAt(adjacency, source, report);
      let best = source;

      rooted.order.forEach(function (node) {
        report.states += 1;

        if (rooted.depth[node] > rooted.depth[best]) best = node;
      });
      return { node: best, distance: rooted.depth[best] };
    }
    report.passes += 2;
    const a = farthest(0);
    const b = farthest(a.node);
    return { length: b.distance, endpoints: [a.node, b.node], report: report };
  }

  /* -------------------------------------------------------------- rerooting */

  /**
   * The sum of distances from *every* node, in two passes.
   *
   * Down: `below[v]` is the total distance from v to everything in its
   * subtree. Up: moving the root from a parent to a child moves `size[child]`
   * nodes one step closer and the other `n - size[child]` one step further, so
   * `answer[child] = answer[parent] + n - 2·size[child]`. That single line is
   * the rerooting, and it is why the whole thing is O(n).
   */
  function sumOfDistances(adjacency, options) {
    const settings = options || {};
    const report = settings.report || emptyReport();
    const n = adjacency.length;
    const rooted = rootAt(adjacency, 0, report);
    const size = new Array(n).fill(1);
    const below = new Array(n).fill(0);

    report.passes += 2;

    for (let i = rooted.order.length - 1; i > 0; i -= 1) {
      const node = rooted.order[i];
      const up = rooted.parent[node];
      report.states += 1;
      report.combines += 1;
      size[up] += size[node];
      below[up] += below[node] + size[node];
    }

    const answer = new Array(n).fill(0);
    answer[0] = below[0];
    rooted.order.forEach(function (node) {
      if (node === 0) return;
      report.transitions += 1;
      answer[node] = answer[rooted.parent[node]] + n - 2 * size[node];
    });
    return { answer: answer, size: size, below: below, report: report };
  }

  /**
   * The reference: a BFS from every node. O(n²), which is exactly what
   * rerooting exists to avoid - so this is only ever called on the small
   * trees the tests and demos use.
   */
  function sumOfDistancesBruteForce(adjacency) {
    return adjacency.map(function (ignored, source) {
      const rooted = rootAt(adjacency, source, null);
      return rooted.depth.reduce(function (a, b) { return a + b; }, 0);
    });
  }

  /**
   * The general rerooting, over any monoid the caller supplies. The
   * prefix/suffix arrays are what keep it linear: "every child but this one"
   * is `prefix[k-1] combined with suffix[k+1]`, computed once per node rather
   * than once per (node, child) pair.
   *
   * `combines` is reported so the O(n) claim is a measurement. Recomputing
   * "all but one" by looping is O(deg²), and on a star that is the whole
   * quadratic cost back again.
   */
  function reroot(adjacency, monoid, options) {
    const settings = options || {};
    const report = settings.report || emptyReport();
    const n = adjacency.length;
    const rooted = rootAt(adjacency, 0, report);
    const down = new Array(n).fill(null);

    report.passes += 2;

    for (let i = rooted.order.length - 1; i >= 0; i -= 1) {
      const node = rooted.order[i];
      report.states += 1;
      let value = monoid.identity();

      adjacency[node].forEach(function (child) {
        if (child === rooted.parent[node]) return;
        report.combines += 1;
        value = monoid.combine(value, monoid.lift(down[child], child, node));
      });
      down[node] = monoid.finish(value, node);
    }
    return { down: down, answer: rerootUp(adjacency, monoid, rooted, down, report), report: report };
  }

  /** The upward pass: `fromParent[node]` is the answer for the component
   *  hanging off `node` through its parent. */
  function rerootUp(adjacency, monoid, rooted, down, report) {
    const answer = new Array(adjacency.length).fill(null);
    const fromParent = new Array(adjacency.length).fill(null);

    fromParent[0] = monoid.identity();
    rooted.order.forEach(function (node) {
      const children = adjacency[node].filter(function (c) { return c !== rooted.parent[node]; });
      const parts = children.map(function (child) {
        report.combines += 1;
        return monoid.lift(down[child], child, node);
      });
      const outside = node === 0 ? monoid.identity()
        : monoid.lift(fromParent[node], rooted.parent[node], node);
      const around = prefixSuffix(parts, outside, monoid, report);
      answer[node] = monoid.finish(around.total, node);

      children.forEach(function (child, k) {
        fromParent[child] = monoid.finish(around.without[k], node);
      });
    });
    return answer;
  }

  /**
   * `without[k]` is every part except the k-th, combined with `outside`, in
   * O(deg) rather than O(deg²). This is the prefix/suffix trick, and it is the
   * only reason rerooting is linear on a star.
   */
  function prefixSuffix(parts, outside, monoid, report) {
    const prefix = [monoid.identity()];
    const suffix = new Array(parts.length + 1).fill(null);

    parts.forEach(function (part, k) {
      report.combines += 1;
      prefix.push(monoid.combine(prefix[k], part));
    });
    suffix[parts.length] = monoid.identity();

    for (let k = parts.length - 1; k >= 0; k -= 1) {
      report.combines += 1;
      suffix[k] = monoid.combine(parts[k], suffix[k + 1]);
    }
    const without = parts.map(function (ignored, k) {
      report.combines += 2;
      return monoid.combine(outside, monoid.combine(prefix[k], suffix[k + 1]));
    });
    return { total: monoid.combine(outside, prefix[parts.length]), without: without };
  }

  /** The distance monoid, as a worked instance of the general interface:
   *  a subtree contributes (count, total distance), and hanging it one edge
   *  further away adds its count to the total. */
  function distanceMonoid() {
    return {
      identity: function () { return { count: 0, total: 0 }; },
      combine: function (a, b) { return { count: a.count + b.count, total: a.total + b.total }; },
      lift: function (value, ignoredChild, ignoredParent) {
        return { count: value.count, total: value.total + value.count };
      },
      finish: function (value, ignoredNode) { return { count: value.count + 1, total: value.total }; }
    };
  }

  /* ---------------------------------------------------------- generators */

  /** The three shapes whose rerooting costs differ: a path (deep, thin), a
   *  star (shallow, one huge degree) and a random tree. The star is the one
   *  that exposes a quadratic "all but one". */
  function shapedTree(kind, n, random) {
    const edges = [];

    for (let i = 1; i < n; i += 1) {
      if (kind === 'path') edges.push([i - 1, i]);
      else if (kind === 'star') edges.push([0, i]);
      else if (kind === 'caterpillar') edges.push([Math.floor((i - 1) / 2), i]);
      else edges.push([random ? random.int(i) : 0, i]);
    }
    return { n: n, edges: edges, adjacency: adjacencyFrom(n, edges) };
  }

  return {
    emptyReport: emptyReport, adjacencyFrom: adjacencyFrom, rootAt: rootAt,
    independentSet: independentSet, subtreeAggregates: subtreeAggregates, diameter: diameter,
    sumOfDistances: sumOfDistances, sumOfDistancesBruteForce: sumOfDistancesBruteForce,
    reroot: reroot, prefixSuffix: prefixSuffix, distanceMonoid: distanceMonoid,
    shapedTree: shapedTree
  };
}));

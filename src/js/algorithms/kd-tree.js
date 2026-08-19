/**
 * k-d tree: alternating axis-aligned splits *at data points*, which is what
 * makes it balanced on any distribution - unlike a quadtree, whose shape
 * follows the coordinates rather than the data.
 *
 * Points are `{ id, p: [x, y, ...] }`. The dimension count is read from the
 * first point, so the same module serves the 2-D demo and the high-dimensional
 * degradation measurement in 8.8 with no special case.
 *
 * Nearest-neighbour search is the reason this file exists and the reason it is
 * easy to get wrong. The descent finds *a* candidate quickly by going to the
 * leaf the query falls in; that candidate is very often not the nearest, and
 * only the backtrack - re-examining the far side of every split whose plane is
 * closer than the best distance so far - makes the answer correct. A tree with
 * the backtrack deleted still returns a plausible point, which is why the test
 * for this compares against brute force over thousands of queries rather than
 * eyeballing one.
 *
 * `pruneWith` chooses the bound the backtrack uses:
 *   'plane'  the classic |q[axis] − split| - one subtraction, weaker
 *   'box'    the distance to the subtree's bounding box - tighter, and the
 *            difference between them is measured rather than asserted.
 *
 * `boundFor` takes the *parent* node rather than the far child on purpose.
 * Reading the split value off the far child is the bug that signature exists
 * to prevent: a leaf has no split value, the subtraction yields NaN, every
 * comparison against NaN is false, and the backtrack silently stops exactly at
 * the leaves that hold the answer.
 *
 * Deletion is a tombstone. Removing a point properly means re-finding a
 * replacement from the subtree along the same axis, which is O(n^(1-1/d)) and
 * rebalances nothing; every production k-d tree marks and rebuilds instead, so
 * that is what is implemented, and the cost of *not* rebuilding is reported.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.KdTree = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function emptyStats() {
    return {
      queries: 0, nodesVisited: 0, nodesPruned: 0, leavesVisited: 0,
      distanceComputations: 0, tombstonesVisited: 0, results: 0
    };
  }

  function distanceSquared(a, b) {
    let total = 0;
    for (let i = 0; i < a.length; i += 1) {
      const d = a[i] - b[i];
      total += d * d;
    }
    return total;
  }

  function boxOfPoints(points, dims) {
    const min = new Array(dims).fill(Infinity);
    const max = new Array(dims).fill(-Infinity);
    points.forEach(function (point) {
      for (let axis = 0; axis < dims; axis += 1) {
        if (point.p[axis] < min[axis]) min[axis] = point.p[axis];
        if (point.p[axis] > max[axis]) max[axis] = point.p[axis];
      }
    });
    return { min: min, max: max };
  }

  function boxDistanceSquared(box, query) {
    let total = 0;
    for (let axis = 0; axis < query.length; axis += 1) {
      const d = Math.max(box.min[axis] - query[axis], 0, query[axis] - box.max[axis]);
      total += d * d;
    }
    return total;
  }

  function boxOverlaps(box, rect) {
    for (let axis = 0; axis < box.min.length; axis += 1) {
      if (box.min[axis] > rect.max[axis] || box.max[axis] < rect.min[axis]) return false;
    }
    return true;
  }

  function inBox(point, rect) {
    for (let axis = 0; axis < point.length; axis += 1) {
      if (point[axis] < rect.min[axis] || point[axis] > rect.max[axis]) return false;
    }
    return true;
  }

  /* --------------------------------------------------------- construction */

  /** Hoare-style quickselect on one axis: the median in linear expected time,
   *  which is what keeps the build at O(n log n) rather than O(n log² n). */
  function selectNth(points, axis, target, counter) {
    let low = 0;
    let high = points.length - 1;

    while (low < high) {
      const pivot = points[(low + high) >> 1].p[axis];
      let i = low;
      let j = high;
      while (i <= j) {
        /* The failing comparison is counted too: a build cost that omits the
           test that ends each scan under-reports by one per scan, and the
           worked example quotes this number. */
        for (;;) { counter.comparisons += 1; if (points[i].p[axis] >= pivot) break; i += 1; }
        for (;;) { counter.comparisons += 1; if (points[j].p[axis] <= pivot) break; j -= 1; }
        if (i <= j) {
          const tmp = points[i];
          points[i] = points[j];
          points[j] = tmp;
          i += 1;
          j -= 1;
        }
      }
      if (target <= j) high = j;
      else if (target >= i) low = i;
      else break;
    }

    return points[target];
  }

  function widestAxis(box) {
    let axis = 0;
    let widest = -Infinity;
    for (let i = 0; i < box.min.length; i += 1) {
      const width = box.max[i] - box.min[i];
      if (width > widest) { widest = width; axis = i; }
    }
    return axis;
  }

  function build(points, options) {
    const settings = options || {};
    const list = points.slice();
    const dims = settings.dims || (list.length ? list[0].p.length : 2);
    const leafSize = Math.max(1, Math.floor(settings.leafSize || 8));
    const axisRule = settings.axis === 'widest' ? 'widest' : 'cycle';
    const counter = { comparisons: 0, nodes: 0 };
    const tree = list.length ? partition(list, 0, counter) : null;
    let stats = emptyStats();
    let live = list.length;

    function partition(slice, depth, tally) {
      const box = boxOfPoints(slice, dims);
      tally.nodes += 1;
      if (slice.length <= leafSize) return { leaf: true, points: slice, box: box, depth: depth };

      const axis = axisRule === 'widest' ? widestAxis(box) : depth % dims;
      const mid = slice.length >> 1;
      const median = selectNth(slice, axis, mid, tally);

      return {
        leaf: false,
        axis: axis,
        value: median.p[axis],
        depth: depth,
        box: box,
        left: partition(slice.slice(0, mid), depth + 1, tally),
        right: partition(slice.slice(mid), depth + 1, tally)
      };
    }

    /* ------------------------------------------------------- k nearest */

    /** A sorted array beats a heap below a few dozen neighbours and keeps the
     *  worst distance - the pruning bound - at a known index. */
    function offer(best, k, candidate) {
      if (best.length === k && candidate.distance >= best[best.length - 1].distance) return;
      let at = best.length;
      while (at > 0 && best[at - 1].distance > candidate.distance) at -= 1;
      best.splice(at, 0, candidate);
      if (best.length > k) best.pop();
    }

    function worst(best, k) {
      return best.length < k ? Infinity : best[best.length - 1].distance;
    }

    function scanLeaf(node, query, state) {
      stats.leavesVisited += 1;
      for (let i = 0; i < node.points.length; i += 1) {
        const point = node.points[i];
        if (point.deleted) { stats.tombstonesVisited += 1; continue; }
        stats.distanceComputations += 1;
        offer(state.best, state.k, { point: point, distance: distanceSquared(point.p, query) });
      }
    }

    /** The bound on anything in `far`, measured from the *parent's* plane -
     *  see the module header for why the signature insists on the parent. */
    function boundFor(far, query, parent, state) {
      /* 'descent' is the tree with the backtrack deleted, kept because the
         section's whole claim is that it returns a plausible wrong answer
         rather than failing. An infinite bound prunes the far side always, so
         the search is exactly the descent to one leaf. */
      if (state.pruneWith === 'descent') return Infinity;
      if (state.pruneWith === 'box') return boxDistanceSquared(far.box, query);
      const delta = query[parent.axis] - parent.value;
      return delta * delta;
    }

    function descend(node, query, state) {
      stats.nodesVisited += 1;
      if (node.leaf) return scanLeaf(node, query, state);

      const goLeft = query[node.axis] < node.value;
      const near = goLeft ? node.left : node.right;
      const far = goLeft ? node.right : node.left;
      descend(near, query, state);

      const bound = boundFor(far, query, node, state);
      if (bound < worst(state.best, state.k)) descend(far, query, state);
      else stats.nodesPruned += 1;
      return null;
    }

    function kNearest(query, k, pruneWith) {
      const state = {
        best: [], k: Math.max(1, Math.floor(k || 1)),
        pruneWith: pruneWith || settings.pruneWith || 'plane'
      };
      stats.queries += 1;
      if (!tree) return [];
      descend(tree, query, state);
      stats.results += state.best.length;
      return state.best.map(function (entry) {
        return { point: entry.point, distance: Math.sqrt(entry.distance) };
      });
    }

    function nearest(query, pruneWith) {
      return kNearest(query, 1, pruneWith)[0] || null;
    }

    /* ---------------------------------------------------------- ranges */

    function queryBox(rect) {
      const out = [];
      stats.queries += 1;
      if (tree) collect(tree, rect, out);
      stats.results += out.length;
      return out;
    }

    function collect(node, rect, out) {
      if (!boxOverlaps(node.box, rect)) { stats.nodesPruned += 1; return; }
      stats.nodesVisited += 1;
      if (node.leaf) {
        stats.leavesVisited += 1;
        for (let i = 0; i < node.points.length; i += 1) {
          const point = node.points[i];
          if (point.deleted) { stats.tombstonesVisited += 1; continue; }
          stats.distanceComputations += 1;
          if (inBox(point.p, rect)) out.push(point);
        }
        return;
      }
      collect(node.left, rect, out);
      collect(node.right, rect, out);
    }

    function queryRange(rect) {
      return queryBox({ min: [rect.minX, rect.minY], max: [rect.maxX, rect.maxY] });
    }

    function queryRadius(centre, radius) {
      const query = centre.p || [centre.x, centre.y];
      const rect = { min: query.map(function (v) { return v - radius; }), max: query.map(function (v) { return v + radius; }) };
      return queryBox(rect).filter(function (point) {
        return distanceSquared(point.p, query) <= radius * radius;
      });
    }

    /* --------------------------------------------------------- deletion */

    function remove(point) {
      if (point.deleted) return false;
      point.deleted = true;
      live -= 1;
      return true;
    }

    function shape() {
      const totals = { nodes: 0, leaves: 0, maxDepth: 0, largestLeaf: 0, tombstones: list.length - live };
      if (tree) measure(tree, totals);
      return Object.assign(totals, {
        points: list.length,
        live: live,
        dims: dims,
        buildComparisons: counter.comparisons,
        bytes: totals.nodes * 40 + list.length * (8 * dims + 16)
      });
    }

    function measure(node, totals) {
      totals.nodes += 1;
      if (node.depth > totals.maxDepth) totals.maxDepth = node.depth;
      if (node.leaf) {
        totals.leaves += 1;
        if (node.points.length > totals.largestLeaf) totals.largestLeaf = node.points.length;
        return;
      }
      measure(node.left, totals);
      measure(node.right, totals);
    }

    /** Every splitting plane, clipped to its subtree's box, for drawing. */
    function planes(limit) {
      const out = [];
      const stack = tree ? [tree] : [];
      while (stack.length && out.length < (limit || 4000)) {
        const node = stack.pop();
        if (node.leaf) continue;
        out.push({ axis: node.axis, value: node.value, depth: node.depth, box: node.box });
        stack.push(node.left);
        stack.push(node.right);
      }
      return out;
    }

    function checkInvariants() {
      const problems = [];
      if (tree) verify(tree, problems);
      return { ok: !problems.length, problems: problems };
    }

    function verify(node, problems) {
      if (node.leaf) return;
      const left = collectPoints(node.left);
      const right = collectPoints(node.right);
      left.forEach(function (point) {
        if (point.p[node.axis] > node.value) problems.push('left point past the split at depth ' + node.depth);
      });
      right.forEach(function (point) {
        if (point.p[node.axis] < node.value) problems.push('right point before the split at depth ' + node.depth);
      });
      verify(node.left, problems);
      verify(node.right, problems);
    }

    function collectPoints(node) {
      if (node.leaf) return node.points;
      return collectPoints(node.left).concat(collectPoints(node.right));
    }

    /* The shared index interface, assembled in its own function so the
       factory body stays under the size limit and readable. */
    function handle() {
      return {
        nearest: nearest,
        kNearest: kNearest,
        queryBox: queryBox,
        queryRange: queryRange,
        queryRadius: queryRadius,
        remove: remove,
        planes: planes,
        shape: shape,
        checkInvariants: checkInvariants,
        points: function () { return list; },
        dims: dims,
        size: function () { return live; },
        /* `candidatesTested` is the name every other index in the milestone uses
           for "points the query actually looked at", and it is the same quantity
           here. Exposing it under both names is what lets one harness table
           compare a k-d tree with a grid without a special case. */
        stats: function () {
          return Object.assign({}, stats, { candidatesTested: stats.distanceComputations });
        },
        resetStats: function () { stats = emptyStats(); }
      };
    }

    return handle();
  }

  return { build: build, distanceSquared: distanceSquared, boxDistanceSquared: boxDistanceSquared };
}));

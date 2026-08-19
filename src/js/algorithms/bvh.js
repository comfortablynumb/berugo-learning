/**
 * Bounding volume hierarchy: a binary tree of boxes over primitives, and the
 * structure a ray tracer actually traverses.
 *
 * The difference from a k-d tree is which thing gets partitioned. A k-d tree
 * splits *space*, so a primitive straddling the plane must be referenced from
 * both sides; a BVH splits the *primitive list*, so every primitive appears
 * exactly once and the boxes are allowed to overlap instead. That is why a BVH
 * refits in place when the scene animates - the topology stays valid, only the
 * boxes grow - and why a k-d tree does not.
 *
 * Two builders, and the whole section is the gap between them:
 *   'median' split the widest axis at the median centroid. Balanced, ignores
 *            the geometry, and produces boxes that overlap badly.
 *   'sah'    the surface-area heuristic - pick the split minimising
 *
 *              Ct + (A(L)/A(P))·N(L)·Ci + (A(R)/A(P))·N(R)·Ci
 *
 *            which is an *estimate of expected traversal cost* under the
 *            assumption that the chance a uniformly random ray hits a box is
 *            proportional to its surface area. It is a cost model, not a rule
 *            of thumb, and writing the estimate down is what makes the build
 *            decision arguable rather than tuned.
 *
 * The traversal is an explicit stack. Recursion here is a real hazard: a scene
 * loads once and is traversed millions of times, so the per-ray call overhead
 * is the whole budget, and a degenerate scene builds a deep tree.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Bvh = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const TRAVERSAL_COST = 1;
  const INTERSECT_COST = 2;
  const EPSILON = 1e-9;

  function emptyStats() {
    return { rays: 0, nodesVisited: 0, nodesPruned: 0, primitivesTested: 0, hits: 0 };
  }

  function emptyBox() {
    return { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  }

  function includeBox(box, other) {
    for (let axis = 0; axis < 3; axis += 1) {
      if (other.min[axis] < box.min[axis]) box.min[axis] = other.min[axis];
      if (other.max[axis] > box.max[axis]) box.max[axis] = other.max[axis];
    }
    return box;
  }

  function boxOf(primitives) {
    const box = emptyBox();
    primitives.forEach(function (primitive) { includeBox(box, primitive); });
    return box;
  }

  function surfaceArea(box) {
    const dx = Math.max(0, box.max[0] - box.min[0]);
    const dy = Math.max(0, box.max[1] - box.min[1]);
    const dz = Math.max(0, box.max[2] - box.min[2]);
    return 2 * (dx * dy + dy * dz + dz * dx);
  }

  function widestAxis(box) {
    let axis = 0;
    let widest = -Infinity;
    for (let i = 0; i < 3; i += 1) {
      const width = box.max[i] - box.min[i];
      if (width > widest) { widest = width; axis = i; }
    }
    return axis;
  }

  /** A triangle carries its own box and centroid so the builder never has to
   *  know what a primitive is. */
  function triangle(id, points) {
    const box = emptyBox();
    points.forEach(function (point) {
      for (let axis = 0; axis < 3; axis += 1) {
        if (point[axis] < box.min[axis]) box.min[axis] = point[axis];
        if (point[axis] > box.max[axis]) box.max[axis] = point[axis];
      }
    });
    return {
      id: id,
      points: points,
      min: box.min,
      max: box.max,
      centroid: [0, 1, 2].map(function (axis) { return (box.min[axis] + box.max[axis]) / 2; })
    };
  }

  /* --------------------------------------------------------- ray tests */

  /**
   * The slab method. The axis-parallel case is handled explicitly rather than
   * left to IEEE arithmetic: with direction 0 and the origin exactly on a slab
   * plane, (min − o) · ∞ is 0 · ∞ = NaN, every comparison against NaN is false,
   * and the box silently reports a miss. That is the classic BVH bug, and it
   * only shows up on axis-aligned scenes - which is most scenes.
   */
  function rayBox(ray, box, tMax) {
    let near = 0;
    let far = tMax;

    for (let axis = 0; axis < 3; axis += 1) {
      if (Math.abs(ray.direction[axis]) < EPSILON) {
        if (ray.origin[axis] < box.min[axis] || ray.origin[axis] > box.max[axis]) return null;
        continue;
      }
      const inverse = 1 / ray.direction[axis];
      let entry = (box.min[axis] - ray.origin[axis]) * inverse;
      let exit = (box.max[axis] - ray.origin[axis]) * inverse;
      if (entry > exit) { const swap = entry; entry = exit; exit = swap; }
      if (entry > near) near = entry;
      if (exit < far) far = exit;
      if (near > far) return null;
    }

    return near;
  }

  function subtract(a, b) {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  }

  function cross(a, b) {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  }

  function dot(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  }

  /** Möller-Trumbore, in its plain form: no precomputation, one division. */
  function rayTriangle(ray, primitive) {
    const edge1 = subtract(primitive.points[1], primitive.points[0]);
    const edge2 = subtract(primitive.points[2], primitive.points[0]);
    const pvec = cross(ray.direction, edge2);
    const determinant = dot(edge1, pvec);
    if (Math.abs(determinant) < EPSILON) return null;

    const inverse = 1 / determinant;
    const tvec = subtract(ray.origin, primitive.points[0]);
    const u = dot(tvec, pvec) * inverse;
    if (u < 0 || u > 1) return null;

    const qvec = cross(tvec, edge1);
    const v = dot(ray.direction, qvec) * inverse;
    if (v < 0 || u + v > 1) return null;

    const t = dot(edge2, qvec) * inverse;
    return t > EPSILON ? t : null;
  }

  /* ----------------------------------------------------------- builders */

  function medianSplit(primitives, box) {
    const axis = widestAxis(box);
    const sorted = primitives.slice().sort(function (a, b) { return a.centroid[axis] - b.centroid[axis]; });
    const mid = sorted.length >> 1;
    return { axis: axis, left: sorted.slice(0, mid), right: sorted.slice(mid), cost: null };
  }

  function binsFor(primitives, axis, count) {
    const bins = [];
    for (let i = 0; i < count; i += 1) bins.push({ box: emptyBox(), count: 0 });
    let low = Infinity;
    let high = -Infinity;
    primitives.forEach(function (primitive) {
      if (primitive.centroid[axis] < low) low = primitive.centroid[axis];
      if (primitive.centroid[axis] > high) high = primitive.centroid[axis];
    });
    if (high - low < EPSILON) return null;

    const scale = count / (high - low);
    primitives.forEach(function (primitive) {
      const index = Math.min(count - 1, Math.floor((primitive.centroid[axis] - low) * scale));
      bins[index].count += 1;
      includeBox(bins[index].box, primitive);
    });
    return { bins: bins, low: low, scale: scale };
  }

  /** Sweeps the bin boundaries once from each end, so every candidate split
   *  costs O(1) after two linear passes rather than O(n) each. */
  function bestBinnedSplit(binned, parentArea) {
    const bins = binned.bins;
    const count = bins.length;
    const leftBox = emptyBox();
    const prefix = [];
    let leftCount = 0;

    for (let i = 0; i < count - 1; i += 1) {
      includeBox(leftBox, bins[i].box);
      leftCount += bins[i].count;
      prefix.push({ area: surfaceArea(leftBox), count: leftCount });
    }

    const rightBox = emptyBox();
    let rightCount = 0;
    let best = null;

    for (let i = count - 1; i > 0; i -= 1) {
      includeBox(rightBox, bins[i].box);
      rightCount += bins[i].count;
      const left = prefix[i - 1];
      if (!left.count || !rightCount) continue;
      const cost = TRAVERSAL_COST + INTERSECT_COST *
        (left.area * left.count + surfaceArea(rightBox) * rightCount) / parentArea;
      if (!best || cost < best.cost) best = { cost: cost, boundary: i };
    }

    return best;
  }

  function sahSplit(primitives, box, bins) {
    const parentArea = surfaceArea(box);
    let best = null;

    for (let axis = 0; axis < 3; axis += 1) {
      const binned = binsFor(primitives, axis, bins);
      if (!binned) continue;
      const candidate = bestBinnedSplit(binned, parentArea);
      if (candidate && (!best || candidate.cost < best.cost)) {
        best = { cost: candidate.cost, axis: axis, binned: binned, boundary: candidate.boundary };
      }
    }

    if (!best) return null;
    const left = [];
    const right = [];
    primitives.forEach(function (primitive) {
      const index = Math.min(bins - 1, Math.floor((primitive.centroid[best.axis] - best.binned.low) * best.binned.scale));
      (index < best.boundary ? left : right).push(primitive);
    });
    return { axis: best.axis, left: left, right: right, cost: best.cost };
  }

  function build(primitives, options) {
    const settings = options || {};
    const strategy = settings.strategy === 'sah' ? 'sah' : 'median';
    const leafSize = Math.max(1, Math.floor(settings.leafSize || 4));
    const bins = Math.max(4, Math.floor(settings.bins || 12));
    const counters = { nodes: 0, splitsEvaluated: 0, leavesByCost: 0 };
    const tree = primitives.length ? partition(primitives, 0) : null;
    let stats = emptyStats();

    function partition(list, depth) {
      const box = boxOf(list);
      counters.nodes += 1;
      if (list.length <= leafSize) return { leaf: true, primitives: list, box: box, depth: depth };

      const split = strategy === 'sah' ? sahSplit(list, box, bins) : medianSplit(list, box);
      counters.splitsEvaluated += 1;
      if (!split || !split.left.length || !split.right.length) {
        return { leaf: true, primitives: list, box: box, depth: depth };
      }
      /* The SAH's other half: if no split beats leaving the primitives in one
         leaf, leave them. A builder that always splits produces a deeper tree
         that is measurably slower to traverse. */
      if (strategy === 'sah' && split.cost >= INTERSECT_COST * list.length) {
        counters.leavesByCost += 1;
        return { leaf: true, primitives: list, box: box, depth: depth };
      }

      return {
        leaf: false, axis: split.axis, box: box, depth: depth,
        left: partition(split.left, depth + 1),
        right: partition(split.right, depth + 1)
      };
    }

    /** Explicit stack, nearest child first, with the far child skipped when
     *  its entry distance is already past the closest hit found. */
    function intersect(ray) {
      stats.rays += 1;
      if (!tree) return { hit: null, t: Infinity };
      const stack = [tree];
      let closest = { hit: null, t: ray.tMax === undefined ? Infinity : ray.tMax };

      while (stack.length) {
        const node = stack.pop();
        const entry = rayBox(ray, node.box, closest.t);
        if (entry === null) { stats.nodesPruned += 1; continue; }
        stats.nodesVisited += 1;

        if (node.leaf) { testLeaf(ray, node, closest); continue; }
        const first = ray.direction[node.axis] >= 0 ? node.left : node.right;
        const second = first === node.left ? node.right : node.left;
        stack.push(second);
        stack.push(first);
      }

      if (closest.hit) stats.hits += 1;
      return closest;
    }

    function testLeaf(ray, node, closest) {
      for (let i = 0; i < node.primitives.length; i += 1) {
        stats.primitivesTested += 1;
        const t = rayTriangle(ray, node.primitives[i]);
        if (t !== null && t < closest.t) { closest.t = t; closest.hit = node.primitives[i]; }
      }
    }

    /** Refit after the primitives move: same topology, bigger boxes. The
     *  number that matters is how much the root grew, because that is the
     *  fraction of the scene every ray now has to enter. */
    function refit() {
      const before = tree ? surfaceArea(tree.box) : 0;
      if (tree) refitNode(tree);
      const after = tree ? surfaceArea(tree.box) : 0;
      return { before: before, after: after, growth: before ? after / before : 1 };
    }

    function refitNode(node) {
      if (node.leaf) { node.box = boxOf(node.primitives); return node.box; }
      const box = emptyBox();
      includeBox(box, refitNode(node.left));
      includeBox(box, refitNode(node.right));
      node.box = box;
      return box;
    }

    /** The tree's own SAH cost: what the build was optimising, evaluated. */
    function cost() {
      if (!tree) return 0;
      const rootArea = surfaceArea(tree.box);
      return accumulate(tree, rootArea);
    }

    function accumulate(node, rootArea) {
      const weight = surfaceArea(node.box) / rootArea;
      if (node.leaf) return weight * INTERSECT_COST * node.primitives.length;
      return weight * TRAVERSAL_COST + accumulate(node.left, rootArea) + accumulate(node.right, rootArea);
    }

    function shape() {
      const totals = { nodes: 0, leaves: 0, maxDepth: 0, largestLeaf: 0, overlap: 0 };
      if (tree) measure(tree, totals);
      return Object.assign(totals, {
        primitives: primitives.length,
        strategy: strategy,
        sahCost: cost(),
        leavesByCost: counters.leavesByCost,
        rootArea: tree ? surfaceArea(tree.box) : 0,
        bytes: totals.nodes * 56 + primitives.length * 8
      });
    }

    function measure(node, totals) {
      totals.nodes += 1;
      if (node.depth > totals.maxDepth) totals.maxDepth = node.depth;
      if (node.leaf) {
        totals.leaves += 1;
        if (node.primitives.length > totals.largestLeaf) totals.largestLeaf = node.primitives.length;
        return;
      }
      const both = emptyBox();
      includeBox(both, node.left.box);
      includeBox(both, node.right.box);
      totals.overlap += surfaceArea(node.left.box) + surfaceArea(node.right.box) - surfaceArea(both);
      measure(node.left, totals);
      measure(node.right, totals);
    }

    function boxes(limit) {
      const out = [];
      const stack = tree ? [tree] : [];
      while (stack.length && out.length < (limit || 8000)) {
        const node = stack.pop();
        out.push({ box: node.box, depth: node.depth, leaf: !!node.leaf, count: node.leaf ? node.primitives.length : 0 });
        if (!node.leaf) { stack.push(node.left); stack.push(node.right); }
      }
      return out;
    }

    return {
      intersect: intersect,
      refit: refit,
      cost: cost,
      shape: shape,
      boxes: boxes,
      root: function () { return tree; },
      strategy: strategy,
      size: function () { return primitives.length; },
      stats: function () { return Object.assign({}, stats); },
      resetStats: function () { stats = emptyStats(); }
    };
  }

  /** Brute force over the same primitives, so every hit has an oracle. */
  function bruteForce(primitives) {
    let tested = 0;
    return {
      intersect: function (ray) {
        let closest = { hit: null, t: ray.tMax === undefined ? Infinity : ray.tMax };
        primitives.forEach(function (primitive) {
          tested += 1;
          const t = rayTriangle(ray, primitive);
          if (t !== null && t < closest.t) { closest.t = t; closest.hit = primitive; }
        });
        return closest;
      },
      stats: function () { return { primitivesTested: tested }; }
    };
  }

  return {
    build: build,
    bruteForce: bruteForce,
    triangle: triangle,
    rayBox: rayBox,
    rayTriangle: rayTriangle,
    surfaceArea: surfaceArea,
    boxOf: boxOf,
    TRAVERSAL_COST: TRAVERSAL_COST,
    INTERSECT_COST: INTERSECT_COST
  };
}));

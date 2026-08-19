/**
 * Quadtrees, loose quadtrees and the octree that is the same thing in three
 * dimensions.
 *
 * The structure is recursive subdivision of *space*, not of the data: a node
 * owns a square, and when it holds more than `capacity` items it splits into
 * four children of a quarter the area each. That is what separates it from a
 * k-d tree, which splits at a data point, and it is also the source of every
 * problem it has - the tree's shape follows the coordinates, so a cluster
 * makes a deep thin path and an empty region makes nodes that hold nothing.
 *
 * Two things here are correctness requirements rather than optimisations:
 *
 *   `maxDepth`  coincident points never separate, so a split-until-one-per-leaf
 *               rule recurses until the stack dies. The depth cap plus a leaf
 *               bucket that is allowed to overflow is the fix, and it is why
 *               `capacity` is a *soft* limit here.
 *   `looseness` an item with extent does not fit in any child once it straddles
 *               a boundary. Storing it at the parent is correct; inflating each
 *               node's box by a factor first is what pushes most of those items
 *               back down, and is why a loose quadtree suits moving objects.
 *
 * Every query reports nodes visited and nodes pruned, so pruning is a number
 * rather than a claim.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Quadtree = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function emptyStats() {
    return { queries: 0, nodesVisited: 0, nodesPruned: 0, candidatesTested: 0, results: 0, inserts: 0, splits: 0 };
  }

  function boxOf(item) {
    if (item.minX !== undefined) {
      return { minX: item.minX, minY: item.minY, maxX: item.maxX, maxY: item.maxY };
    }
    return { minX: item.x, minY: item.y, maxX: item.x, maxY: item.y };
  }

  function overlaps(a, b) {
    return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
  }

  function contains(outer, inner) {
    return outer.minX <= inner.minX && outer.maxX >= inner.maxX &&
      outer.minY <= inner.minY && outer.maxY >= inner.maxY;
  }

  function inflate(box, factor) {
    if (factor === 1) return box;
    const halfX = ((box.maxX - box.minX) / 2) * (factor - 1);
    const halfY = ((box.maxY - box.minY) / 2) * (factor - 1);
    return {
      minX: box.minX - halfX, minY: box.minY - halfY,
      maxX: box.maxX + halfX, maxY: box.maxY + halfY
    };
  }

  function quadrants(box) {
    const midX = (box.minX + box.maxX) / 2;
    const midY = (box.minY + box.maxY) / 2;
    return [
      { minX: box.minX, minY: box.minY, maxX: midX, maxY: midY },
      { minX: midX, minY: box.minY, maxX: box.maxX, maxY: midY },
      { minX: box.minX, minY: midY, maxX: midX, maxY: box.maxY },
      { minX: midX, minY: midY, maxX: box.maxX, maxY: box.maxY }
    ];
  }

  function distanceSquared(item, centre) {
    const box = boxOf(item);
    const dx = Math.max(box.minX - centre.x, 0, centre.x - box.maxX);
    const dy = Math.max(box.minY - centre.y, 0, centre.y - box.maxY);
    return dx * dx + dy * dy;
  }

  function create(options) {
    const settings = options || {};
    const bounds = settings.bounds || { minX: 0, minY: 0, maxX: 1000, maxY: 1000 };
    const capacity = Math.max(1, Math.floor(settings.capacity || 8));
    const maxDepth = Math.max(1, Math.floor(settings.maxDepth || 12));
    const looseness = Math.max(1, settings.looseness || 1);
    const root = makeNode(bounds, 0);
    /* Anything the root's box does not contain is held here and scanned by
       every query. A silently dropped out-of-bounds item is the one quadtree
       bug a brute-force oracle catches only when the generator happens to
       produce one, so it is handled rather than assumed away. */
    const outside = [];
    let stats = emptyStats();
    let count = 0;

    function makeNode(box, depth) {
      return { box: box, loose: inflate(box, looseness), depth: depth, items: [], children: null };
    }

    function split(node) {
      node.children = quadrants(node.box).map(function (box) { return makeNode(box, node.depth + 1); });
      stats.splits += 1;
      const held = node.items;
      node.items = [];
      held.forEach(function (item) { placeIn(node, item, boxOf(item)); });
    }

    /** One level of placement: into the single child that swallows it whole,
     *  otherwise here. A point always fits somewhere; a box may not. */
    function placeIn(node, item, box) {
      if (node.children) {
        for (let i = 0; i < 4; i += 1) {
          if (contains(node.children[i].loose, box)) return insertInto(node.children[i], item, box);
        }
      }
      node.items.push(item);
      return node;
    }

    function insertInto(node, item, box) {
      const placed = placeIn(node, item, box);
      if (placed !== node) return placed;
      if (node.children || node.items.length <= capacity || node.depth >= maxDepth) return node;
      split(node);
      return node;
    }

    function insert(item) {
      const box = boxOf(item);
      stats.inserts += 1;
      count += 1;
      if (!contains(root.loose, box)) { outside.push(item); return root; }
      return insertInto(root, item, box);
    }

    function insertAll(list) {
      list.forEach(insert);
      return count;
    }

    /** The traversal both queries share: `test` decides whether a node's box
     *  can hold anything, `keep` decides whether an item qualifies. */
    function walk(node, test, keep, out) {
      if (!test(node.loose)) { stats.nodesPruned += 1; return; }
      stats.nodesVisited += 1;

      for (let i = 0; i < node.items.length; i += 1) {
        stats.candidatesTested += 1;
        if (keep(node.items[i])) out.push(node.items[i]);
      }

      if (!node.children) return;
      for (let i = 0; i < 4; i += 1) walk(node.children[i], test, keep, out);
    }

    function scanOutside(keep, out) {
      for (let i = 0; i < outside.length; i += 1) {
        stats.candidatesTested += 1;
        if (keep(outside[i])) out.push(outside[i]);
      }
    }

    function queryRange(rect) {
      const out = [];
      const keep = function (item) { return overlaps(boxOf(item), rect); };
      stats.queries += 1;
      scanOutside(keep, out);
      walk(root,
        function (box) { return overlaps(box, rect); },
        keep,
        out);
      stats.results += out.length;
      return out;
    }

    function queryRadius(centre, radius) {
      const rect = {
        minX: centre.x - radius, minY: centre.y - radius,
        maxX: centre.x + radius, maxY: centre.y + radius
      };
      const out = [];
      const keep = function (item) { return distanceSquared(item, centre) <= radius * radius; };
      stats.queries += 1;
      scanOutside(keep, out);
      walk(root,
        function (box) { return overlaps(box, rect); },
        keep,
        out);
      stats.results += out.length;
      return out;
    }

    function shape() {
      const totals = { nodes: 0, leaves: 0, emptyLeaves: 0, maxDepth: 0, largestLeaf: 0, itemsAtInternal: 0 };
      visit(root, totals);
      return Object.assign(totals, {
        items: count,
        bytes: totals.nodes * 48 + count * 24,
        bytesPerItem: count ? (totals.nodes * 48 + count * 24) / count : 0
      });
    }

    function visit(node, totals) {
      totals.nodes += 1;
      if (node.depth > totals.maxDepth) totals.maxDepth = node.depth;
      if (!node.children) {
        totals.leaves += 1;
        if (!node.items.length) totals.emptyLeaves += 1;
        if (node.items.length > totals.largestLeaf) totals.largestLeaf = node.items.length;
        return;
      }
      totals.itemsAtInternal += node.items.length;
      for (let i = 0; i < 4; i += 1) visit(node.children[i], totals);
    }

    /** Every node's box, for drawing the subdivision. */
    function snapshot(limit) {
      const cap = limit || 20000;
      const out = [];
      const stack = [root];
      while (stack.length && out.length < cap) {
        const node = stack.pop();
        out.push({ box: node.box, depth: node.depth, count: node.items.length, leaf: !node.children });
        if (node.children) for (let i = 0; i < 4; i += 1) stack.push(node.children[i]);
      }
      return out;
    }

    function checkInvariants() {
      const problems = [];
      checkNode(root, problems);
      return { ok: !problems.length, problems: problems };
    }

    function checkNode(node, problems) {
      node.items.forEach(function (item) {
        if (!contains(node.loose, boxOf(item))) problems.push('item outside its node at depth ' + node.depth);
      });
      if (!node.children) {
        if (node.items.length > capacity && node.depth < maxDepth) {
          problems.push('leaf over capacity at depth ' + node.depth + ' that could still split');
        }
        return;
      }
      for (let i = 0; i < 4; i += 1) checkNode(node.children[i], problems);
    }

    return {
      insert: insert,
      insertAll: insertAll,
      queryRange: queryRange,
      queryRadius: queryRadius,
      shape: shape,
      snapshot: snapshot,
      checkInvariants: checkInvariants,
      capacity: capacity,
      maxDepth: maxDepth,
      looseness: looseness,
      bounds: bounds,
      size: function () { return count; },
      stats: function () { return Object.assign({}, stats); },
      resetStats: function () { stats = emptyStats(); }
    };
  }

  /* ------------------------------------------------------------- octree */

  /**
   * The three-dimensional case, kept deliberately small: eight children, the
   * same depth cap, the same overflowing bucket. The point of having it at all
   * is the memory column - a node costs twice as many pointers and the fan-out
   * doubles the branching, so the same point count in three dimensions builds a
   * shallower tree with far more nodes.
   */
  function octree(options) {
    const settings = options || {};
    const bounds = settings.bounds || { min: [0, 0, 0], max: [1000, 1000, 1000] };
    const capacity = Math.max(1, Math.floor(settings.capacity || 8));
    const maxDepth = Math.max(1, Math.floor(settings.maxDepth || 10));
    const root = { box: bounds, depth: 0, items: [], children: null };
    let stats = emptyStats();
    let count = 0;

    function childBox(box, index) {
      const mid = [0, 1, 2].map(function (axis) { return (box.min[axis] + box.max[axis]) / 2; });
      const min = [0, 1, 2].map(function (axis) { return (index >> axis) & 1 ? mid[axis] : box.min[axis]; });
      const max = [0, 1, 2].map(function (axis) { return (index >> axis) & 1 ? box.max[axis] : mid[axis]; });
      return { min: min, max: max };
    }

    function childIndex(box, point) {
      let index = 0;
      for (let axis = 0; axis < 3; axis += 1) {
        const mid = (box.min[axis] + box.max[axis]) / 2;
        if (point.p[axis] >= mid) index |= (1 << axis);
      }
      return index;
    }

    function split(node) {
      node.children = [];
      for (let i = 0; i < 8; i += 1) {
        node.children.push({ box: childBox(node.box, i), depth: node.depth + 1, items: [], children: null });
      }
      stats.splits += 1;
      const held = node.items;
      node.items = [];
      held.forEach(function (item) { node.children[childIndex(node.box, item)].items.push(item); });
    }

    function insert(item) {
      let node = root;
      count += 1;
      stats.inserts += 1;
      while (node.children) node = node.children[childIndex(node.box, item)];
      node.items.push(item);
      if (node.items.length > capacity && node.depth < maxDepth) split(node);
      return node;
    }

    function boxOverlaps(box, rect) {
      for (let axis = 0; axis < 3; axis += 1) {
        if (box.min[axis] > rect.max[axis] || box.max[axis] < rect.min[axis]) return false;
      }
      return true;
    }

    function inRect(point, rect) {
      for (let axis = 0; axis < 3; axis += 1) {
        if (point.p[axis] < rect.min[axis] || point.p[axis] > rect.max[axis]) return false;
      }
      return true;
    }

    function queryBox(rect) {
      const out = [];
      const stack = [root];
      stats.queries += 1;
      while (stack.length) {
        const node = stack.pop();
        if (!boxOverlaps(node.box, rect)) { stats.nodesPruned += 1; continue; }
        stats.nodesVisited += 1;
        for (let i = 0; i < node.items.length; i += 1) {
          stats.candidatesTested += 1;
          if (inRect(node.items[i], rect)) out.push(node.items[i]);
        }
        if (node.children) for (let i = 0; i < 8; i += 1) stack.push(node.children[i]);
      }
      stats.results += out.length;
      return out;
    }

    function shape() {
      const totals = { nodes: 0, leaves: 0, emptyLeaves: 0, maxDepth: 0, largestLeaf: 0 };
      const stack = [root];
      while (stack.length) {
        const node = stack.pop();
        totals.nodes += 1;
        if (node.depth > totals.maxDepth) totals.maxDepth = node.depth;
        if (node.children) { for (let i = 0; i < 8; i += 1) stack.push(node.children[i]); continue; }
        totals.leaves += 1;
        if (!node.items.length) totals.emptyLeaves += 1;
        if (node.items.length > totals.largestLeaf) totals.largestLeaf = node.items.length;
      }
      return Object.assign(totals, { items: count, bytes: totals.nodes * 80 + count * 32 });
    }

    return {
      insert: insert,
      insertAll: function (list) { list.forEach(insert); return count; },
      queryBox: queryBox,
      shape: shape,
      size: function () { return count; },
      stats: function () { return Object.assign({}, stats); },
      resetStats: function () { stats = emptyStats(); }
    };
  }

  return { create: create, octree: octree, quadrants: quadrants, inflate: inflate };
}));

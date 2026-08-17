/**
 * Scapegoat trees: balance by rebuilding, with no per-node metadata at all.
 *
 * Every other family in M04 stores something on the node - a height, a colour,
 * a priority, a subtree size. A scapegoat tree stores nothing: a node is
 * exactly a key, a value and two children. Balance is kept by two rules
 * instead. An insertion that lands deeper than log_{1/α}(n) walks back up
 * until it finds the node whose subtree is more than α-heavy on one side -
 * the scapegoat - and rebuilds that subtree perfectly balanced in linear time.
 * A deletion rebuilds the whole tree once the live count falls below α times
 * the high-water mark.
 *
 * The rebuild is O(size of the subtree), and the amortised cost per operation
 * is still O(log n): the credit argument is the same shape as the doubling
 * array's in M01.3. It is the right strategy when nodes are large, when they
 * live on disk, or when rotations would need locks.
 */
(function (root, factory) {
  const api = factory(root && root.Bst ? root.Bst : (typeof require === 'function' ? require('./bst.js') : null));
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Scapegoat = api;
}(typeof window !== 'undefined' ? window : null, function (Bst) {
  'use strict';

  function newStats() {
    return Object.assign(Bst.newStats(), {
      rebuilds: 0, rebuiltNodes: 0, deepInserts: 0, fullRebuilds: 0
    });
  }

  /** Builds a perfectly balanced tree from a sorted node list, in one pass. */
  function buildBalanced(nodes, lo, hi) {
    if (lo > hi) return null;
    const mid = (lo + hi) >> 1;
    const node = nodes[mid];
    node.left = buildBalanced(nodes, lo, mid - 1);
    node.right = buildBalanced(nodes, mid + 1, hi);
    return node;
  }

  function flatten(node) {
    const out = [];
    const stack = [];
    let current = node;
    while (current || stack.length) {
      while (current) { stack.push(current); current = current.left; }
      current = stack.pop();
      out.push(current);
      current = current.right;
    }
    return out;
  }

  function create(options) {
    const settings = options || {};
    const compare = settings.compare || Bst.compareKeys;
    const alpha = settings.alpha || 0.65;
    let root = null;
    let count = 0;
    let maxCount = 0;
    let stats = newStats();

    function cmp(a, b) {
      stats.comparisons += 1;
      return compare(a, b);
    }

    function depthLimit() {
      return Math.floor(Math.log(Math.max(1, count)) / Math.log(1 / alpha));
    }

    function rebuild(node) {
      const nodes = flatten(node);
      stats.rebuilds += 1;
      stats.rebuiltNodes += nodes.length;
      return buildBalanced(nodes, 0, nodes.length - 1);
    }

    /** Walks back up the insertion path until a child is more than α of its
     *  parent's subtree, computing sizes as it goes - which is affordable
     *  precisely because the sibling subtrees it measures are the small ones. */
    function findAndRebuild(path, sides) {
      let childSize = 1;
      for (let i = path.length - 1; i >= 0; i -= 1) {
        const node = path[i];
        const sibling = sides[i] === 'left' ? node.right : node.left;
        const nodeSize = childSize + 1 + Bst.size(sibling);

        if (childSize > alpha * nodeSize) {
          const rebuilt = rebuild(node);
          if (i === 0) root = rebuilt;
          else path[i - 1][sides[i - 1]] = rebuilt;
          return true;
        }
        childSize = nodeSize;
      }
      return false;
    }

    function insert(key, value) {
      stats.inserts += 1;
      if (!root) { root = Bst.createNode(key, value); count = 1; maxCount = 1; return true; }

      const path = [];
      const sides = [];
      let node = root;

      for (;;) {
        stats.nodeVisits += 1;
        const order = cmp(key, node.key);
        if (order === 0) { node.value = value; return false; }
        const side = order < 0 ? 'left' : 'right';
        path.push(node);
        sides.push(side);
        if (!node[side]) { node[side] = Bst.createNode(key, value); break; }
        node = node[side];
      }

      count += 1;
      maxCount = Math.max(maxCount, count);
      if (path.length > depthLimit()) {
        stats.deepInserts += 1;
        findAndRebuild(path, sides);
      }
      return true;
    }

    function attach(parent, side, child) {
      if (!parent) root = child;
      else parent[side] = child;
    }

    /** Ordinary BST deletion. The tree is allowed to decay until the live
     *  count drops below α of its high-water mark, and then it is rebuilt
     *  whole - one linear pass paying for the deletions that caused it. */
    function remove(key) {
      stats.removes += 1;
      let parent = null;
      let side = null;
      let node = root;

      while (node) {
        stats.nodeVisits += 1;
        const order = cmp(key, node.key);
        if (order === 0) break;
        parent = node;
        side = order < 0 ? 'left' : 'right';
        node = node[side];
      }
      if (!node) return false;

      unlink(node, parent, side);
      count -= 1;
      if (count < alpha * maxCount) {
        stats.fullRebuilds += 1;
        root = count ? rebuild(root) : null;
        maxCount = count;
      }
      return true;
    }

    function unlink(node, parent, side) {
      if (!node.left || !node.right) {
        attach(parent, side, node.left || node.right);
        return;
      }
      let successorParent = node;
      let successor = node.right;
      let successorSide = 'right';
      while (successor.left) {
        successorParent = successor;
        successor = successor.left;
        successorSide = 'left';
      }
      node.key = successor.key;
      node.value = successor.value;
      successorParent[successorSide] = successor.right;
    }

    function findNode(key) {
      let node = root;
      while (node) {
        stats.nodeVisits += 1;
        const order = cmp(key, node.key);
        if (order === 0) return node;
        node = order < 0 ? node.left : node.right;
      }
      return null;
    }

    /** The guarantee is the depth bound, not a per-node balance factor: a
     *  scapegoat tree is allowed to be locally lopsided between rebuilds. */
    function checkInvariants() {
      const errors = Bst.checkOrder(root, compare);
      const limit = depthLimit() + 1;
      const measured = Bst.height(root);
      if (count && measured > limit) {
        errors.push('height ' + measured + ' exceeds the α bound of ' + limit);
      }
      if (Bst.size(root) !== count) errors.push('node count disagrees with size');
      return { ok: errors.length === 0, errors: errors };
    }

    return {
      name: 'scapegoat',
      insert: insert,
      remove: remove,
      has: function (key) { stats.finds += 1; return findNode(key) !== null; },
      get: function (key) { stats.finds += 1; const node = findNode(key); return node ? node.value : undefined; },
      keys: function () { return Bst.inOrder(root); },
      range: function (lo, hi) { return Bst.rangeOf(root, lo, hi, compare); },
      size: function () { return count; },
      height: function () { return Bst.height(root); },
      heightBound: function () { return depthLimit() + 1; },
      alpha: function () { return alpha; },
      root: function () { return root; },
      snapshot: function (options) { return Bst.snapshot(root, options); },
      checkInvariants: checkInvariants,
      stats: function () {
        return Object.assign({ height: Bst.height(root), size: count, maxCount: maxCount }, stats);
      },
      resetStats: function () { stats = newStats(); }
    };
  }

  return { create: create, newStats: newStats, buildBalanced: buildBalanced, flatten: flatten };
}));

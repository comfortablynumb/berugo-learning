/**
 * Splay trees: no balance rule at all, and a restructuring on every access.
 *
 * The single operation is `splay(node)`, which rotates the node to the root in
 * pairs: zig when it is a child of the root, zig-zig when the node and its
 * parent are on the same side, zig-zag when they are not. Doing the pairs in
 * that specific order is what halves the depth of everything on the path -
 * repeatedly rotating a node with its parent (the naive "move to root") does
 * not, and gives no amortised bound.
 *
 * The bound is O(log n) amortised by the potential Φ = Σ log(size of subtree),
 * with two properties no balanced tree has: the working-set property, so a
 * small hot set costs O(log of that set), and static optimality. The price is
 * that a read is a write, which is where the structure stops being usable.
 */
(function (root, factory) {
  const api = factory(root && root.Bst ? root.Bst : (typeof require === 'function' ? require('./bst.js') : null));
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Splay = api;
}(typeof window !== 'undefined' ? window : null, function (Bst) {
  'use strict';

  function newStats() {
    return Object.assign(Bst.newStats(), { zig: 0, zigzig: 0, zigzag: 0, splays: 0 });
  }

  function create(options) {
    const settings = options || {};
    const compare = settings.compare || Bst.compareKeys;
    let root = null;
    let count = 0;
    let stats = newStats();

    function cmp(a, b) {
      stats.comparisons += 1;
      return compare(a, b);
    }

    function makeNode(key, value, parent) {
      const node = Bst.createNode(key, value);
      node.parent = parent;
      return node;
    }

    /** Rotates `node` above its parent, repairing both parent links. */
    function rotateUp(node) {
      const parent = node.parent;
      const grand = parent.parent;
      stats.rotations += 1;

      if (parent.left === node) {
        parent.left = node.right;
        if (node.right) node.right.parent = parent;
        node.right = parent;
      } else {
        parent.right = node.left;
        if (node.left) node.left.parent = parent;
        node.left = parent;
      }

      parent.parent = node;
      node.parent = grand;
      if (!grand) root = node;
      else if (grand.left === parent) grand.left = node;
      else grand.right = node;
    }

    /** The three cases. zig-zig rotates the *parent* first, which is the whole
     *  difference between splaying and naive move-to-root. */
    function splay(node) {
      if (!node) return null;
      stats.splays += 1;

      while (node.parent) {
        const parent = node.parent;
        const grand = parent.parent;

        if (!grand) {
          stats.zig += 1;
          rotateUp(node);
        } else if ((parent.left === node) === (grand.left === parent)) {
          stats.zigzig += 1;
          rotateUp(parent);
          rotateUp(node);
        } else {
          stats.zigzag += 1;
          rotateUp(node);
          rotateUp(node);
        }
      }
      return node;
    }

    /** Descends to `key`, or to the last node visited when it is absent. */
    function descend(key) {
      let node = root;
      let last = null;
      while (node) {
        stats.nodeVisits += 1;
        last = node;
        const order = cmp(key, node.key);
        if (order === 0) return { node: node, last: last };
        node = order < 0 ? node.left : node.right;
      }
      return { node: null, last: last };
    }

    function has(key) {
      stats.finds += 1;
      const found = descend(key);
      splay(found.node || found.last);
      return found.node !== null;
    }

    function insert(key, value) {
      stats.inserts += 1;
      if (!root) { root = makeNode(key, value, null); count = 1; return true; }

      let node = root;
      for (;;) {
        stats.nodeVisits += 1;
        const order = cmp(key, node.key);
        if (order === 0) { node.value = value; splay(node); return false; }
        const side = order < 0 ? 'left' : 'right';
        if (!node[side]) {
          node[side] = makeNode(key, value, node);
          count += 1;
          splay(node[side]);
          return true;
        }
        node = node[side];
      }
    }

    /** Splay the target to the root, drop it, then splay the largest key of
     *  the left subtree to that subtree's root so the right subtree can hang
     *  off it with no comparisons at all. */
    function remove(key) {
      stats.removes += 1;
      const found = descend(key);
      splay(found.node || found.last);
      if (!found.node) return false;

      const left = root.left;
      const right = root.right;
      if (left) left.parent = null;
      if (right) right.parent = null;

      if (!left) root = right;
      else {
        let biggest = left;
        while (biggest.right) biggest = biggest.right;
        root = left;
        splay(biggest);
        root.right = right;
        if (right) right.parent = root;
      }
      count -= 1;
      return true;
    }

    function checkInvariants() {
      const errors = Bst.checkOrder(root, compare);
      if (root && root.parent) errors.push('the root has a parent');

      const stack = root ? [root] : [];
      while (stack.length) {
        const node = stack.pop();
        if (node.left) {
          if (node.left.parent !== node) errors.push('left child of ' + node.key + ' has a stale parent');
          stack.push(node.left);
        }
        if (node.right) {
          if (node.right.parent !== node) errors.push('right child of ' + node.key + ' has a stale parent');
          stack.push(node.right);
        }
      }
      if (Bst.size(root) !== count) errors.push('node count disagrees with size');
      return { ok: errors.length === 0, errors: errors };
    }

    return {
      name: 'splay',
      insert: insert,
      remove: remove,
      has: has,
      get: function (key) {
        stats.finds += 1;
        const found = descend(key);
        splay(found.node || found.last);
        return found.node ? found.node.value : undefined;
      },
      keys: function () { return Bst.inOrder(root); },
      range: function (lo, hi) { return Bst.rangeOf(root, lo, hi, compare); },
      size: function () { return count; },
      height: function () { return Bst.height(root); },
      rootKey: function () { return root ? root.key : null; },
      root: function () { return root; },
      snapshot: function (options) { return Bst.snapshot(root, options); },
      checkInvariants: checkInvariants,
      stats: function () { return Object.assign({ height: Bst.height(root), size: count }, stats); },
      resetStats: function () { stats = newStats(); }
    };
  }

  return { create: create, newStats: newStats };
}));

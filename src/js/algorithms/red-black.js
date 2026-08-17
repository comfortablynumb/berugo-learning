/**
 * Red-black trees, with parent pointers and no sentinel.
 *
 * The five invariants are the whole structure: every node is red or black, the
 * root is black, every leaf (a null child) counts as black, a red node has no
 * red child, and every path from a node down to a leaf passes the same number
 * of black nodes. Together they bound the height at 2·log₂(n + 1), because the
 * longest path can at worst alternate red and black while the shortest is all
 * black.
 *
 * Deletion is written in the no-sentinel form, so the fixup carries the
 * (node, parent) pair explicitly - the node being fixed can be null, and
 * without a sentinel there is nothing to ask for its parent. That is the whole
 * reason CLRS uses one; carrying the pair costs a parameter and removes a
 * shared mutable node from the structure.
 */
(function (root, factory) {
  const api = factory(root && root.Bst ? root.Bst : (typeof require === 'function' ? require('./bst.js') : null));
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.RedBlack = api;
}(typeof window !== 'undefined' ? window : null, function (Bst) {
  'use strict';

  function isRed(node) {
    return Boolean(node && node.red);
  }

  function newStats() {
    return Object.assign(Bst.newStats(), { recolours: 0, insertFixups: 0, deleteFixups: 0 });
  }

  /** A new node is always red: adding a black one would change the black
   *  height of one path and break invariant five immediately. */
  function makeNode(key, value, parent) {
    const node = Bst.createNode(key, value);
    node.parent = parent;
    node.red = true;
    return node;
  }

  function minimum(node) {
    let current = node;
    while (current.left) current = current.left;
    return current;
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

    function replaceInParent(node, pivot) {
      pivot.parent = node.parent;
      if (!node.parent) root = pivot;
      else if (node.parent.left === node) node.parent.left = pivot;
      else node.parent.right = pivot;
      node.parent = pivot;
    }

    function rotateLeftAt(node) {
      stats.rotations += 1;
      const pivot = node.right;
      node.right = pivot.left;
      if (pivot.left) pivot.left.parent = node;
      replaceInParent(node, pivot);
      pivot.left = node;
      return pivot;
    }

    function rotateRightAt(node) {
      stats.rotations += 1;
      const pivot = node.left;
      node.left = pivot.right;
      if (pivot.right) pivot.right.parent = node;
      replaceInParent(node, pivot);
      pivot.right = node;
      return pivot;
    }

    function recolour(node, red) {
      stats.recolours += 1;
      node.red = red;
    }

    /** One step of the insert fixup on the side where the parent is a left
     *  child. Returns the node to continue from. */
    function fixupInsertLeft(node) {
      const grand = node.parent.parent;
      const uncle = grand.right;
      if (isRed(uncle)) {
        recolour(node.parent, false);
        recolour(uncle, false);
        recolour(grand, true);
        return grand;
      }
      let current = node;
      if (current === current.parent.right) {
        current = current.parent;
        rotateLeftAt(current);
      }
      recolour(current.parent, false);
      recolour(grand, true);
      rotateRightAt(grand);
      return current;
    }

    function fixupInsertRight(node) {
      const grand = node.parent.parent;
      const uncle = grand.left;
      if (isRed(uncle)) {
        recolour(node.parent, false);
        recolour(uncle, false);
        recolour(grand, true);
        return grand;
      }
      let current = node;
      if (current === current.parent.left) {
        current = current.parent;
        rotateRightAt(current);
      }
      recolour(current.parent, false);
      recolour(grand, true);
      rotateLeftAt(grand);
      return current;
    }

    /** Restores "no red node has a red child" after inserting a red node. The
     *  recolouring case moves the problem two levels up; the rotating cases
     *  end it. */
    function insertFixup(node) {
      let current = node;
      while (current.parent && current.parent.red) {
        stats.insertFixups += 1;
        current = current.parent === current.parent.parent.left
          ? fixupInsertLeft(current)
          : fixupInsertRight(current);
      }
      recolour(root, false);
    }

    function insert(key, value) {
      stats.inserts += 1;
      if (!root) { root = makeNode(key, value, null); root.red = false; count = 1; return true; }

      let node = root;
      for (;;) {
        stats.nodeVisits += 1;
        const order = cmp(key, node.key);
        if (order === 0) { node.value = value; return false; }
        const side = order < 0 ? 'left' : 'right';
        if (!node[side]) {
          node[side] = makeNode(key, value, node);
          count += 1;
          insertFixup(node[side]);
          return true;
        }
        node = node[side];
      }
    }

    /* ------------------------------------------------------------- deletion */

    function transplant(target, replacement) {
      if (!target.parent) root = replacement;
      else if (target === target.parent.left) target.parent.left = replacement;
      else target.parent.right = replacement;
      if (replacement) replacement.parent = target.parent;
    }

    /** The double-black fixup, left side. Returns the next (node, parent). */
    function fixupDeleteLeft(node, parent) {
      let sibling = parent.right;
      if (isRed(sibling)) {
        recolour(sibling, false);
        recolour(parent, true);
        rotateLeftAt(parent);
        sibling = parent.right;
      }
      if (!isRed(sibling.left) && !isRed(sibling.right)) {
        recolour(sibling, true);
        return { node: parent, parent: parent.parent };
      }
      if (!isRed(sibling.right)) {
        if (sibling.left) recolour(sibling.left, false);
        recolour(sibling, true);
        rotateRightAt(sibling);
        sibling = parent.right;
      }
      sibling.red = parent.red;
      recolour(parent, false);
      if (sibling.right) recolour(sibling.right, false);
      rotateLeftAt(parent);
      return { node: root, parent: null };
    }

    function fixupDeleteRight(node, parent) {
      let sibling = parent.left;
      if (isRed(sibling)) {
        recolour(sibling, false);
        recolour(parent, true);
        rotateRightAt(parent);
        sibling = parent.left;
      }
      if (!isRed(sibling.left) && !isRed(sibling.right)) {
        recolour(sibling, true);
        return { node: parent, parent: parent.parent };
      }
      if (!isRed(sibling.left)) {
        if (sibling.right) recolour(sibling.right, false);
        recolour(sibling, true);
        rotateLeftAt(sibling);
        sibling = parent.left;
      }
      sibling.red = parent.red;
      recolour(parent, false);
      if (sibling.left) recolour(sibling.left, false);
      rotateRightAt(parent);
      return { node: root, parent: null };
    }

    function deleteFixup(start, startParent) {
      let node = start;
      let parent = startParent;
      while (node !== root && !isRed(node)) {
        stats.deleteFixups += 1;
        const step = node === parent.left
          ? fixupDeleteLeft(node, parent)
          : fixupDeleteRight(node, parent);
        node = step.node;
        parent = step.parent;
      }
      if (node) recolour(node, false);
    }

    /** Splices the node out and reports which node was physically removed,
     *  the child that took its place, and that child's parent. */
    function splice(target) {
      if (!target.left || !target.right) {
        const child = target.left || target.right;
        transplant(target, child);
        return { removed: target, child: child, parent: target.parent };
      }

      const successor = minimum(target.right);
      const child = successor.right;
      const parent = successor.parent === target ? successor : successor.parent;

      if (successor.parent !== target) {
        transplant(successor, successor.right);
        successor.right = target.right;
        successor.right.parent = successor;
      }
      transplant(target, successor);
      successor.left = target.left;
      successor.left.parent = successor;
      successor.red = target.red;
      return { removed: successor, child: child, parent: parent };
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

    function remove(key) {
      stats.removes += 1;
      const target = findNode(key);
      if (!target) return false;

      const wasRed = (!target.left || !target.right) ? target.red : minimum(target.right).red;
      const result = splice(target);
      count -= 1;
      if (!wasRed && root) deleteFixup(result.child, result.parent);
      if (root) root.red = false;
      return true;
    }

    /* ----------------------------------------------------------- invariants */

    function blackHeightFrom(node) {
      let black = 1;
      let current = node;
      while (current) {
        if (!current.red) black += 1;
        current = current.left;
      }
      return black;
    }

    function checkNode(node, errors) {
      if (node.red && (isRed(node.left) || isRed(node.right))) {
        errors.push('red node ' + node.key + ' has a red child');
      }
      if (node.left && node.left.parent !== node) errors.push('left child of ' + node.key + ' has a stale parent');
      if (node.right && node.right.parent !== node) errors.push('right child of ' + node.key + ' has a stale parent');
    }

    /** All five rules. The black-height rule is checked by computing it for
     *  every leaf path and requiring one value. */
    function checkInvariants() {
      const errors = Bst.checkOrder(root, compare);
      if (root && root.red) errors.push('the root is red');
      if (root && root.parent) errors.push('the root has a parent');

      const heights = new Set();
      const stack = root ? [{ node: root, black: 0 }] : [];
      while (stack.length) {
        const frame = stack.pop();
        const node = frame.node;
        const black = frame.black + (node.red ? 0 : 1);
        checkNode(node, errors);
        if (!node.left) heights.add(black + 1);
        else stack.push({ node: node.left, black: black });
        if (!node.right) heights.add(black + 1);
        else stack.push({ node: node.right, black: black });
      }

      if (heights.size > 1) {
        errors.push('black height differs between paths: ' + Array.from(heights).join(', '));
      }
      return { ok: errors.length === 0, errors: errors };
    }

    /** The 2-3-4 node a black node forms with its red children - the mapping
     *  that makes the colour rules stop looking arbitrary. */
    function nodes234() {
      const out = [];
      const stack = root ? [root] : [];
      while (stack.length) {
        const node = stack.pop();
        if (node.red) continue;
        const keys = [node.key];
        if (isRed(node.left)) keys.unshift(node.left.key);
        if (isRed(node.right)) keys.push(node.right.key);
        out.push({ keys: keys, degree: keys.length + 1 });
        [node.left, node.right].forEach(function (child) {
          if (!child) return;
          if (child.red) {
            if (child.left) stack.push(child.left);
            if (child.right) stack.push(child.right);
            return;
          }
          stack.push(child);
        });
      }
      return out;
    }

    /** The public surface, assembled in one place. */
    function publicApi() {
      return {
        name: 'red-black',
        insert: insert,
        remove: remove,
        has: function (key) { stats.finds += 1; return findNode(key) !== null; },
        get: function (key) { stats.finds += 1; const node = findNode(key); return node ? node.value : undefined; },
        keys: function () { return Bst.inOrder(root); },
        range: function (lo, hi) { return Bst.rangeOf(root, lo, hi, compare); },
        size: function () { return count; },
        height: function () { return Bst.height(root); },
        heightBound: function () { return 2 * Math.log2(count + 1); },
        blackHeight: function () { return root ? blackHeightFrom(root) - 1 : 0; },
        nodes234: nodes234,
        root: function () { return root; },
        snapshot: function (options) {
          return Bst.snapshot(root, Object.assign({
            annotate: function (node) { return node.red ? 'red' : 'black'; }
          }, options || {}));
        },
        checkInvariants: checkInvariants,
        stats: function () { return Object.assign({ height: Bst.height(root), size: count }, stats); },
        resetStats: function () { stats = newStats(); }
        };
    }

    return publicApi();
  }

  return { create: create, isRed: isRed, newStats: newStats };
}));

/**
 * AVL trees: balance by height, rebalanced on the way back up.
 *
 * The invariant is the strictest of the practical families - the two subtrees
 * of every node differ in height by at most one - which is why an AVL tree is
 * the shallowest and why it does the most rotation work. Insertion needs at
 * most one rotation (single or double) because the subtree it rebalances gets
 * its old height back; deletion can need one at every level, because it does
 * not.
 *
 * Both operations descend recording the path, then walk it back up, so a tree
 * of any height costs no stack. `singleRotations` and `doubleRotations` are
 * counted separately: the demo's whole point is that the two are not the same
 * amount of work.
 */
(function (root, factory) {
  const api = factory(root && root.Bst ? root.Bst : (typeof require === 'function' ? require('./bst.js') : null));
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Avl = api;
}(typeof window !== 'undefined' ? window : null, function (Bst) {
  'use strict';

  function newStats() {
    return Object.assign(Bst.newStats(), { singleRotations: 0, doubleRotations: 0, rebalances: 0 });
  }

  function heightOf(node) {
    return node ? node.height : 0;
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

    function makeNode(key, value) {
      const node = Bst.createNode(key, value);
      node.height = 1;
      return node;
    }

    function update(node) {
      node.height = 1 + Math.max(heightOf(node.left), heightOf(node.right));
      return node;
    }

    function balanceOf(node) {
      return heightOf(node.left) - heightOf(node.right);
    }

    function rotateLeftAt(node) {
      const pivot = Bst.rotateLeft(node);
      update(pivot.left);
      return update(pivot);
    }

    function rotateRightAt(node) {
      const pivot = Bst.rotateRight(node);
      update(pivot.right);
      return update(pivot);
    }

    /** The four cases. LL and RR need one rotation; LR and RL need the inner
     *  one first, which is what makes them double. */
    function rebalance(node) {
      update(node);
      const balance = balanceOf(node);
      if (balance > 1) {
        if (balanceOf(node.left) < 0) {
          node.left = rotateLeftAt(node.left);
          stats.doubleRotations += 1;
          stats.rotations += 2;
        } else {
          stats.singleRotations += 1;
          stats.rotations += 1;
        }
        stats.rebalances += 1;
        return rotateRightAt(node);
      }
      if (balance < -1) {
        if (balanceOf(node.right) > 0) {
          node.right = rotateRightAt(node.right);
          stats.doubleRotations += 1;
          stats.rotations += 2;
        } else {
          stats.singleRotations += 1;
          stats.rotations += 1;
        }
        stats.rebalances += 1;
        return rotateLeftAt(node);
      }
      return node;
    }

    /** Walks the recorded path back to the root, rebalancing and reattaching.
     *  `sides[i]` is the branch taken from `path[i]`. */
    function unwind(path, sides) {
      for (let i = path.length - 1; i >= 0; i -= 1) {
        const fixed = rebalance(path[i]);
        if (i === 0) root = fixed;
        else path[i - 1][sides[i - 1]] = fixed;
      }
    }

    function insert(key, value) {
      stats.inserts += 1;
      if (!root) { root = makeNode(key, value); count = 1; return true; }

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
        if (!node[side]) { node[side] = makeNode(key, value); count += 1; break; }
        node = node[side];
      }

      unwind(path, sides);
      return true;
    }

    /** Records the path to `key`, extending it to the in-order successor when
     *  the target has two children. Returns the node actually unlinked. */
    function locateForRemoval(key, path, sides) {
      let node = root;
      while (node) {
        stats.nodeVisits += 1;
        const order = cmp(key, node.key);
        if (order === 0) break;
        const side = order < 0 ? 'left' : 'right';
        path.push(node);
        sides.push(side);
        node = node[side];
      }
      if (!node) return null;
      if (!node.left || !node.right) return node;

      path.push(node);
      sides.push('right');
      let successor = node.right;
      while (successor.left) {
        path.push(successor);
        sides.push('left');
        successor = successor.left;
      }
      node.key = successor.key;
      node.value = successor.value;
      return successor;
    }

    function remove(key) {
      stats.removes += 1;
      const path = [];
      const sides = [];
      const node = locateForRemoval(key, path, sides);
      if (!node) return false;

      const replacement = node.left || node.right;
      if (!path.length) root = replacement;
      else path[path.length - 1][sides[sides.length - 1]] = replacement;

      count -= 1;
      unwind(path, sides);
      return true;
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

    /** Ordering, plus the two things only an AVL tree can get wrong: a stored
     *  height that disagrees with the children, and a balance factor of two. */
    function checkInvariants() {
      const errors = Bst.checkOrder(root, compare);
      const stack = root ? [root] : [];

      while (stack.length) {
        const node = stack.pop();
        const expected = 1 + Math.max(heightOf(node.left), heightOf(node.right));
        if (node.height !== expected) {
          errors.push('node ' + node.key + ' stores height ' + node.height + ', children say ' + expected);
        }
        const balance = balanceOf(node);
        if (balance > 1 || balance < -1) {
          errors.push('node ' + node.key + ' has balance factor ' + balance);
        }
        if (node.left) stack.push(node.left);
        if (node.right) stack.push(node.right);
      }
      return { ok: errors.length === 0, errors: errors };
    }

    /** h < 1.4404 · log₂(n + 2) − 0.328, the classic Fibonacci-tree bound. */
    function heightBound() {
      return 1.4404 * Math.log2(count + 2) - 0.328;
    }

    return {
      name: 'avl',
      insert: insert,
      remove: remove,
      has: function (key) { stats.finds += 1; return findNode(key) !== null; },
      get: function (key) { stats.finds += 1; const node = findNode(key); return node ? node.value : undefined; },
      keys: function () { return Bst.inOrder(root); },
      range: function (lo, hi) { return Bst.rangeOf(root, lo, hi, compare); },
      size: function () { return count; },
      height: function () { return heightOf(root); },
      heightBound: heightBound,
      balanceOf: balanceOf,
      root: function () { return root; },
      snapshot: function (options) {
        return Bst.snapshot(root, Object.assign({
          annotate: function (node) { return String(balanceOf(node)); }
        }, options || {}));
      },
      checkInvariants: checkInvariants,
      stats: function () { return Object.assign({ height: heightOf(root), size: count }, stats); },
      resetStats: function () { stats = newStats(); }
    };
  }

  return { create: create, newStats: newStats, heightOf: heightOf };
}));

/**
 * Augmented search trees: one balanced tree, and a field recipe.
 *
 * The whole theory of augmentation is one rule: a field can be maintained if
 * it is computable from the node itself and the same field on its two
 * children. That rule is literally the `compute(node, left, right)` signature
 * below - a field that needs to look further than one level down cannot be
 * kept correct through a rotation, and so cannot be augmented at all.
 *
 * Three fields are supplied, and they are the three classic structures:
 *   size    → order-statistic tree: select(k) and rank(key)
 *   sum     → range-sum tree: sum over a key range in O(log n)
 *   maxEnd  → interval tree: stab(point), which prunes whole subtrees
 *
 * Balance is AVL, and `augment` runs on every node whose children changed -
 * including both nodes of every rotation, in the right order. Getting that
 * order wrong is the bug this design exists to make impossible.
 */
(function (root, factory) {
  const api = factory(root && root.Bst ? root.Bst : (typeof require === 'function' ? require('./bst.js') : null));
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AugmentedTree = api;
}(typeof window !== 'undefined' ? window : null, function (Bst) {
  'use strict';

  function sizeOf(node) { return node ? node.size : 0; }
  function sumOf(node) { return node ? node.sum : 0; }
  function maxEndOf(node) { return node ? node.maxEnd : -Infinity; }
  function heightOf(node) { return node ? node.height : 0; }

  /** The field catalogue. Each entry is exactly the augmentation rule. */
  const FIELDS = {
    size: {
      name: 'size',
      compute: function (node) { return 1 + sizeOf(node.left) + sizeOf(node.right); }
    },
    sum: {
      name: 'sum',
      compute: function (node) { return Number(node.value || 0) + sumOf(node.left) + sumOf(node.right); }
    },
    maxEnd: {
      name: 'maxEnd',
      compute: function (node) {
        return Math.max(node.end === undefined ? node.key : node.end,
          maxEndOf(node.left), maxEndOf(node.right));
      }
    }
  };

  function newStats() {
    return Object.assign(Bst.newStats(), { augmentations: 0, prunedSubtrees: 0 });
  }

  function create(options) {
    const settings = options || {};
    const compare = settings.compare || Bst.compareKeys;
    const fields = (settings.fields || ['size', 'sum', 'maxEnd']).map(function (name) { return FIELDS[name]; });
    let root = null;
    let count = 0;
    let stats = newStats();

    function cmp(a, b) {
      stats.comparisons += 1;
      return compare(a, b);
    }

    /** Recomputes height and every configured field from the children. */
    function augment(node) {
      node.height = 1 + Math.max(heightOf(node.left), heightOf(node.right));
      fields.forEach(function (field) { node[field.name] = field.compute(node); });
      stats.augmentations += 1;
      return node;
    }

    function makeNode(key, value, end) {
      const node = Bst.createNode(key, value);
      node.end = end === undefined ? key : end;
      return augment(node);
    }

    function rotateLeftAt(node) {
      const pivot = Bst.rotateLeft(node);
      stats.rotations += 1;
      augment(pivot.left);
      return augment(pivot);
    }

    function rotateRightAt(node) {
      const pivot = Bst.rotateRight(node);
      stats.rotations += 1;
      augment(pivot.right);
      return augment(pivot);
    }

    function rebalance(node) {
      augment(node);
      const balance = heightOf(node.left) - heightOf(node.right);
      if (balance > 1) {
        if (heightOf(node.left.left) < heightOf(node.left.right)) node.left = rotateLeftAt(node.left);
        return rotateRightAt(node);
      }
      if (balance < -1) {
        if (heightOf(node.right.right) < heightOf(node.right.left)) node.right = rotateRightAt(node.right);
        return rotateLeftAt(node);
      }
      return node;
    }

    function unwind(path, sides) {
      for (let i = path.length - 1; i >= 0; i -= 1) {
        const fixed = rebalance(path[i]);
        if (i === 0) root = fixed;
        else path[i - 1][sides[i - 1]] = fixed;
      }
    }

    function insert(key, value, end) {
      stats.inserts += 1;
      if (!root) { root = makeNode(key, value, end); count = 1; return true; }

      const path = [];
      const sides = [];
      let node = root;

      for (;;) {
        stats.nodeVisits += 1;
        const order = cmp(key, node.key);
        if (order === 0) {
          node.value = value;
          if (end !== undefined) node.end = end;
          augment(node);
          unwind(path, sides);
          return false;
        }
        const side = order < 0 ? 'left' : 'right';
        path.push(node);
        sides.push(side);
        if (!node[side]) { node[side] = makeNode(key, value, end); count += 1; break; }
        node = node[side];
      }

      unwind(path, sides);
      return true;
    }

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
      while (successor.left) { path.push(successor); sides.push('left'); successor = successor.left; }
      node.key = successor.key;
      node.value = successor.value;
      node.end = successor.end;
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

    /* ------------------------------------------------------------- queries */

    /** The k-th smallest key, 1-based. One descent, no scanning. */
    function select(k) {
      let node = root;
      let remaining = k;
      while (node) {
        stats.nodeVisits += 1;
        const leftSize = sizeOf(node.left);
        if (remaining === leftSize + 1) return node.key;
        if (remaining <= leftSize) { node = node.left; continue; }
        remaining -= leftSize + 1;
        node = node.right;
      }
      return undefined;
    }

    /** How many keys are at or below `key`. */
    function rank(key) {
      let node = root;
      let seen = 0;
      while (node) {
        stats.nodeVisits += 1;
        const order = cmp(key, node.key);
        if (order < 0) { node = node.left; continue; }
        seen += sizeOf(node.left) + 1;
        if (order === 0) return seen;
        node = node.right;
      }
      return seen;
    }

    /** Every interval containing `point`. A subtree whose maxEnd is below the
     *  point cannot contain one, so it is skipped whole - that pruning is the
     *  entire value of the augmentation. */
    function stab(point) {
      const out = [];
      const stack = root ? [root] : [];
      while (stack.length) {
        const node = stack.pop();
        if (maxEndOf(node) < point) { stats.prunedSubtrees += 1; continue; }
        stats.nodeVisits += 1;
        if (node.key <= point && point <= node.end) out.push({ start: node.key, end: node.end });
        if (node.left) stack.push(node.left);
        if (node.right && node.key <= point) stack.push(node.right);
      }
      return out;
    }

    /** Sum of values over [lo, hi]. A subtree entirely inside the range
     *  contributes its stored `sum` and is not descended into at all — which
     *  is what makes this O(log n) rather than O(range). A version that walks
     *  every node in the range is correct and pointless: the augmentation is
     *  there precisely to avoid that walk. */
    function rangeSum(lo, hi, node, lowBound, highBound) {
      const current = node === undefined ? root : node;
      if (!current) return 0;
      stats.nodeVisits += 1;

      const low = lowBound === undefined ? null : lowBound;
      const high = highBound === undefined ? null : highBound;
      const wholeAbove = low !== null && cmp(low, lo) >= 0;
      const wholeBelow = high !== null && cmp(high, hi) <= 0;

      if (wholeAbove && wholeBelow) {
        stats.prunedSubtrees += 1;
        return sumOf(current);
      }
      if ((low !== null && cmp(low, hi) > 0) || (high !== null && cmp(high, lo) < 0)) return 0;

      const here = (cmp(current.key, lo) >= 0 && cmp(current.key, hi) <= 0) ? Number(current.value || 0) : 0;
      return here +
        rangeSum(lo, hi, current.left, low, current.key) +
        rangeSum(lo, hi, current.right, current.key, high);
    }

    function checkInvariants() {
      const errors = Bst.checkOrder(root, compare);
      const stack = root ? [root] : [];
      while (stack.length) {
        const node = stack.pop();
        fields.forEach(function (field) {
          const expected = field.compute(node);
          if (node[field.name] !== expected) {
            errors.push('node ' + node.key + ' stores ' + field.name + ' ' + node[field.name] + ', children say ' + expected);
          }
        });
        const balance = heightOf(node.left) - heightOf(node.right);
        if (balance > 1 || balance < -1) errors.push('node ' + node.key + ' has balance factor ' + balance);
        if (node.left) stack.push(node.left);
        if (node.right) stack.push(node.right);
      }
      return { ok: errors.length === 0, errors: errors };
    }

    return {
      name: 'augmented',
      insert: insert,
      remove: remove,
      has: function (key) { stats.finds += 1; return findNode(key) !== null; },
      get: function (key) { stats.finds += 1; const node = findNode(key); return node ? node.value : undefined; },
      keys: function () { return Bst.inOrder(root); },
      range: function (lo, hi) { return Bst.rangeOf(root, lo, hi, compare); },
      select: select,
      rank: rank,
      stab: stab,
      rangeSum: function (lo, hi) { return rangeSum(lo, hi); },
      fields: function () { return fields.map(function (field) { return field.name; }); },
      size: function () { return count; },
      height: function () { return heightOf(root); },
      root: function () { return root; },
      snapshot: function (options) {
        return Bst.snapshot(root, Object.assign({
          annotate: function (node) {
            return fields.map(function (field) { return field.name + '=' + node[field.name]; }).join(' ');
          }
        }, options || {}));
      },
      checkInvariants: checkInvariants,
      stats: function () { return Object.assign({ height: heightOf(root), size: count }, stats); },
      resetStats: function () { stats = newStats(); }
    };
  }

  return { create: create, FIELDS: FIELDS, newStats: newStats };
}));

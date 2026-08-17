/**
 * Treaps: a BST by key and a heap by a random priority, at the same time.
 *
 * The two orders together pin the shape: for a given set of (key, priority)
 * pairs there is exactly one treap. Since the priorities are random, that
 * shape is the shape of a BST built by inserting the keys in random order -
 * expected height about 3·log₂ n - and no balance bookkeeping exists at all.
 *
 * Everything is built from `split` and `merge`, which is the reason to reach
 * for a treap: insert, delete, range extraction and concatenation are four
 * lines each once those two exist. They recurse, and the recursion depth is
 * the tree height, which is the O(log n) the structure is there to provide.
 */
(function (root, factory) {
  const api = factory(root && root.Bst ? root.Bst : (typeof require === 'function' ? require('./bst.js') : null));
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Treap = api;
}(typeof window !== 'undefined' ? window : null, function (Bst) {
  'use strict';

  function newStats() {
    return Object.assign(Bst.newStats(), { splits: 0, merges: 0, linkWrites: 0 });
  }

  /** The priority is a function of the key and the seed, not of a draw from a
   *  sequence. That is what makes the shape depend on the key set alone: draw
   *  priorities in insertion order instead and the same keys inserted sorted
   *  and shuffled produce different trees, which is precisely the property a
   *  treap exists to remove. */
  function priorityFor(key, seed) {
    const text = String(key);
    let hash = (seed >>> 0) ^ 0x9e3779b9;
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    hash ^= hash >>> 16;
    hash = Math.imul(hash, 0x85ebca6b) >>> 0;
    hash ^= hash >>> 13;
    hash = Math.imul(hash, 0xc2b2ae35) >>> 0;
    hash ^= hash >>> 16;
    return (hash >>> 0) / 4294967296;
  }

  function create(options) {
    const settings = options || {};
    const compare = settings.compare || Bst.compareKeys;
    const seed = settings.seed === undefined ? 1 : settings.seed;
    const priorityOf = settings.priorityOf || function (key) { return priorityFor(key, seed); };
    let root = null;
    let count = 0;
    let stats = newStats();

    function cmp(a, b) {
      stats.comparisons += 1;
      return compare(a, b);
    }

    function makeNode(key, value) {
      const node = Bst.createNode(key, value);
      node.priority = priorityOf(key);
      return node;
    }

    /** Everything with a key below `key` goes left; the rest goes right. */
    function split(node, key) {
      if (!node) return { left: null, right: null };
      stats.splits += 1;
      stats.nodeVisits += 1;

      if (cmp(node.key, key) < 0) {
        const parts = split(node.right, key);
        node.right = parts.left;
        stats.linkWrites += 1;
        return { left: node, right: parts.right };
      }
      const parts = split(node.left, key);
      node.left = parts.right;
      stats.linkWrites += 1;
      return { left: parts.left, right: node };
    }

    /** Every key in `left` must be below every key in `right`. The higher
     *  priority wins the root, which is what keeps the heap order. */
    function merge(left, right) {
      if (!left) return right;
      if (!right) return left;
      stats.merges += 1;
      stats.nodeVisits += 1;

      if (left.priority > right.priority) {
        left.right = merge(left.right, right);
        stats.linkWrites += 1;
        return left;
      }
      right.left = merge(left, right.left);
      stats.linkWrites += 1;
      return right;
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

    function insert(key, value) {
      stats.inserts += 1;
      const existing = findNode(key);
      if (existing) { existing.value = value; return false; }

      const parts = split(root, key);
      root = merge(merge(parts.left, makeNode(key, value)), parts.right);
      count += 1;
      return true;
    }

    /** Keys at or below `key` go left. The inclusive companion to `split`,
     *  which avoids having to invent "the next key after this one" for a
     *  closed range. */
    function splitUpTo(node, key) {
      if (!node) return { left: null, right: null };
      stats.splits += 1;
      stats.nodeVisits += 1;

      if (cmp(node.key, key) <= 0) {
        const parts = splitUpTo(node.right, key);
        node.right = parts.left;
        stats.linkWrites += 1;
        return { left: node, right: parts.right };
      }
      const parts = splitUpTo(node.left, key);
      node.left = parts.right;
      stats.linkWrites += 1;
      return { left: parts.left, right: node };
    }

    /** Deletion is one merge: the node's two subtrees are already split around
     *  it, and merge picks whichever root has the higher priority. */
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

      const joined = merge(node.left, node.right);
      if (!parent) root = joined;
      else parent[side] = joined;
      count -= 1;
      return true;
    }

    /** Lifts [lo, hi] out as its own treap and gives it back, leaving the
     *  remainder joined. This is the operation that makes a treap a rope. */
    function extract(lo, hi) {
      const low = split(root, lo);
      const high = splitUpTo(low.right, hi);
      const middle = high.left;
      root = merge(low.left, high.right);
      count = Bst.size(root);
      return { keys: Bst.inOrder(middle), size: Bst.size(middle), root: middle };
    }

    function checkInvariants() {
      const errors = Bst.checkOrder(root, compare);
      const stack = root ? [root] : [];
      while (stack.length) {
        const node = stack.pop();
        [node.left, node.right].forEach(function (child) {
          if (!child) return;
          if (child.priority > node.priority) {
            errors.push('child ' + child.key + ' outranks parent ' + node.key + ' on priority');
          }
          stack.push(child);
        });
      }
      if (Bst.size(root) !== count) errors.push('node count disagrees with size');
      return { ok: errors.length === 0, errors: errors };
    }

    return {
      name: 'treap',
      insert: insert,
      remove: remove,
      has: function (key) { stats.finds += 1; return findNode(key) !== null; },
      get: function (key) { stats.finds += 1; const node = findNode(key); return node ? node.value : undefined; },
      keys: function () { return Bst.inOrder(root); },
      range: function (lo, hi) { return Bst.rangeOf(root, lo, hi, compare); },
      extract: extract,
      size: function () { return count; },
      height: function () { return Bst.height(root); },
      heightBound: function () { return 3 * Math.log2(Math.max(2, count)); },
      root: function () { return root; },
      splitAt: function (key) { const parts = split(root, key); root = merge(parts.left, parts.right); return parts; },
      snapshot: function (options) {
        return Bst.snapshot(root, Object.assign({
          annotate: function (node) { return node.priority.toFixed(3); }
        }, options || {}));
      },
      checkInvariants: checkInvariants,
      stats: function () { return Object.assign({ height: Bst.height(root), size: count }, stats); },
      resetStats: function () { stats = newStats(); }
    };
  }

  return { create: create, newStats: newStats, priorityFor: priorityFor };
}));

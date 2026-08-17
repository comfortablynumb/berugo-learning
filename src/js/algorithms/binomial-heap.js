/**
 * Binomial heaps: a forest of trees whose merge is binary addition.
 *
 * A binomial tree of order k has exactly 2^k nodes and is two trees of order
 * k − 1 with one hung under the other. So a heap of n elements holds one tree
 * per set bit of n — 13 elements is 1101 in binary, which is a B₃, a B₂ and a
 * B₀ — and merging two heaps is adding two binary numbers, with two trees of
 * the same order carrying into one of the next order.
 *
 * That is the whole structure, and it is why meld is O(log n): there are only
 * log n orders, and each one carries at most once. The same reading explains
 * insert, which is adding 1 and therefore O(1) amortised with the same
 * carry-propagation argument the binary counter uses in M01.3.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BinomialHeap = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function minFirst(a, b) {
    if (a < b) return -1;
    return a > b ? 1 : 0;
  }

  function newStats() {
    return {
      comparisons: 0, links: 0, carries: 0, nodeTouches: 0,
      pushes: 0, pops: 0, melds: 0
    };
  }

  function create(options) {
    const settings = options || {};
    const compare = settings.compare || minFirst;
    /* roots[k] holds the tree of order k, or null. The array is literally the
       binary representation of the size. */
    let roots = [];
    let count = 0;
    let stats = newStats();

    function cmp(a, b) {
      stats.comparisons += 1;
      return compare(a, b);
    }

    function makeNode(key, id) {
      return { key: key, id: id, children: [], order: 0 };
    }

    /** Linking two trees of order k gives one of order k + 1: the loser
     *  becomes the newest child of the winner. */
    function link(a, b) {
      stats.links += 1;
      const winner = cmp(a.key, b.key) <= 0 ? a : b;
      const loser = winner === a ? b : a;
      winner.children.push(loser);
      winner.order += 1;
      return winner;
    }

    /** Adding one tree of order k into the forest, carrying while the slot is
     *  occupied — which is exactly binary addition. */
    function addTree(tree) {
      let carry = tree;
      let order = tree.order;

      while (carry) {
        stats.nodeTouches += 1;
        if (!roots[order]) { roots[order] = carry; return; }
        stats.carries += 1;
        const existing = roots[order];
        roots[order] = null;
        carry = link(existing, carry);
        order += 1;
      }
    }

    function push(key, id) {
      stats.pushes += 1;
      addTree(makeNode(key, id === undefined ? key : id));
      count += 1;
      return count;
    }

    function minRoot() {
      let best = -1;
      for (let order = 0; order < roots.length; order += 1) {
        if (!roots[order]) continue;
        stats.nodeTouches += 1;
        if (best === -1 || cmp(roots[order].key, roots[best].key) < 0) best = order;
      }
      return best;
    }

    /** Removing the minimum root promotes its children, which are trees of
     *  every order below it — so the forest gains log n trees and the merge
     *  is one pass of binary addition. */
    function pop() {
      const at = minRoot();
      if (at === -1) return undefined;
      stats.pops += 1;

      const tree = roots[at];
      roots[at] = null;
      tree.children.forEach(function (child) { addTree(child); });
      count -= 1;
      return { key: tree.key, id: tree.id };
    }

    function meld(other) {
      stats.melds += 1;
      other.forest().forEach(function (tree) { if (tree) addTree(tree); });
      count += other.size();
      other.clear();
      return count;
    }

    function treeSize(node) {
      let total = 1;
      node.children.forEach(function (child) { total += treeSize(child); });
      return total;
    }

    /** The forest read as a binary number: one tree per set bit of the size. */
    function orders() {
      return roots.map(function (tree, order) {
        return tree ? { order: order, size: Math.pow(2, order) } : null;
      }).filter(Boolean);
    }

    function checkInvariants() {
      const errors = [];
      let total = 0;

      roots.forEach(function (tree, order) {
        if (!tree) return;
        if (tree.order !== order) errors.push('a tree of order ' + tree.order + ' sits in slot ' + order);
        if (treeSize(tree) !== Math.pow(2, order)) {
          errors.push('the order-' + order + ' tree holds ' + treeSize(tree) + ' nodes, not ' + Math.pow(2, order));
        }
        total += treeSize(tree);

        const stack = [tree];
        while (stack.length) {
          const node = stack.pop();
          if (node.children.length !== node.order) {
            errors.push('node ' + node.id + ' has ' + node.children.length + ' children for order ' + node.order);
          }
          node.children.forEach(function (child, i) {
            if (compare(child.key, node.key) < 0) errors.push('child ' + child.id + ' outranks parent ' + node.id);
            if (child.order !== i) errors.push('child ' + i + ' of ' + node.id + ' has order ' + child.order);
            stack.push(child);
          });
        }
      });

      if (total !== count) errors.push('the forest holds ' + total + ' nodes, size says ' + count);

      const bits = orders().map(function (entry) { return entry.order; }).sort(function (a, b) { return a - b; });
      const fromBits = bits.reduce(function (sum, order) { return sum + Math.pow(2, order); }, 0);
      if (fromBits !== count) {
        errors.push('the tree orders spell ' + fromBits + ' in binary, size says ' + count);
      }
      return { ok: errors.length === 0, errors: errors };
    }

    /** The public surface, assembled in one place. */
    function publicApi() {
      return {
        name: 'binomial-heap',
        push: push,
        pop: pop,
        peek: function () {
          const at = minRoot();
          return at === -1 ? undefined : { key: roots[at].key, id: roots[at].id };
        },
        meld: meld,
        size: function () { return count; },
        height: function () { return roots.length; },
        trees: function () { return orders().length; },
        orders: orders,
        binary: function () { return count.toString(2); },
        forest: function () { return roots.slice(); },
        clear: function () { roots = []; count = 0; },
        checkInvariants: checkInvariants,
        stats: function () { return Object.assign({ size: count, trees: orders().length }, stats); },
        resetStats: function () { stats = newStats(); }
      };
    }

    return publicApi();
  }

  return { create: create, newStats: newStats, minFirst: minFirst };
}));

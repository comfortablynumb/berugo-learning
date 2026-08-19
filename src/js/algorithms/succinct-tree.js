/**
 * Trees stored as bit strings, and sequences stored as a stack of them.
 *
 * A pointer tree costs a node object plus a child array per node - call it 40
 * to 60 bytes in a real runtime. The information-theoretic minimum for an
 * ordinal tree of n nodes is about 2n *bits*. LOUDS and balanced parentheses
 * both hit it, and navigation becomes rank and select rather than pointer
 * dereferences.
 *
 *   LOUDS  "10" then, for every node in breadth-first order, one 1 per child
 *          followed by a 0. Node v's children are described in the block that
 *          starts just past the v-th zero, and the k-th one in the whole
 *          string is node k. firstChild, nextSibling and parent are then two
 *          rank/select calls each.
 *   BP     '(' on the way down and ')' on the way up, in depth-first order.
 *          Subtree size and depth fall out immediately; the price is that
 *          navigation needs `findClose`, which is only O(1) with a
 *          range-min-max tree. The one here scans, and says so.
 *
 * A wavelet tree is the same idea applied to a sequence over an alphabet: at
 * each level a bit vector records which half of the alphabet each symbol went
 * to, and recursing on rank turns access, rank-of-symbol and range-quantile
 * into O(log σ) bit-vector operations over n log σ bits.
 */
(function (root, factory) {
  const api = factory(root, typeof require === 'function' ? require : null);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SuccinctTree = api;
}(typeof window !== 'undefined' ? window : null, function (scope, requireFn) {
  'use strict';

  function bitVector() {
    if (scope && scope.BitVector) return scope.BitVector;
    return requireFn ? requireFn('./bit-vector.js') : null;
  }

  function emptyStats() {
    return { operations: 0, rankCalls: 0, selectCalls: 0, scanSteps: 0 };
  }

  /** The reference the succinct forms are checked against: an ordinary
   *  pointer tree of `{ value, children }`. */
  function pointerTree(node) {
    let count = 0;
    const order = [];
    (function walk(current) {
      count += 1;
      order.push(current);
      current.children.forEach(walk);
    }(node));
    return {
      root: node,
      size: count,
      preorder: order,
      bytes: count * 48,
      levelOrder: function () {
        const out = [];
        const queue = [node];
        while (queue.length) {
          const current = queue.shift();
          out.push(current);
          current.children.forEach(function (child) { queue.push(child); });
        }
        return out;
      }
    };
  }

  /* ------------------------------------------------------------- LOUDS */

  function louds(tree) {
    const nodes = pointerTree(tree).levelOrder();
    const index = new Map();
    nodes.forEach(function (node, i) { index.set(node, i + 1); });

    const bits = [1, 0];
    nodes.forEach(function (node) {
      node.children.forEach(function () { bits.push(1); });
      bits.push(0);
    });

    const vector = bitVector().create(bits);
    let stats = emptyStats();

    function degree(v) {
      stats.operations += 1;
      stats.selectCalls += 2;
      return vector.select0(v + 1) - vector.select0(v) - 1;
    }

    /** The k-th child of v, 1-based; null if there is none. */
    function child(v, k) {
      stats.operations += 1;
      stats.selectCalls += 1;
      const position = vector.select0(v) + k;
      if (position >= vector.length || !vector.get(position)) return null;
      stats.rankCalls += 1;
      return vector.rank1(position) + 1;
    }

    function firstChild(v) {
      return child(v, 1);
    }

    function nextSibling(v) {
      stats.operations += 1;
      stats.selectCalls += 1;
      const position = vector.select1(v);
      if (position + 1 >= vector.length || !vector.get(position + 1)) return null;
      stats.rankCalls += 1;
      return vector.rank1(position + 1) + 1;
    }

    function parent(v) {
      if (v <= 1) return null;
      stats.operations += 1;
      stats.selectCalls += 1;
      stats.rankCalls += 1;
      return vector.rank0(vector.select1(v));
    }

    function valueOf(v) {
      return nodes[v - 1].value;
    }

    function shape() {
      const bitsUsed = vector.length;
      return {
        nodes: nodes.length,
        bits: bitsUsed,
        bitsPerNode: nodes.length ? bitsUsed / nodes.length : 0,
        rawBytes: vector.shape().rawBytes,
        indexBytes: vector.shape().indexBytes,
        totalBytes: vector.shape().rawBytes + vector.shape().indexBytes,
        pointerBytes: nodes.length * 48,
        valueBytes: nodes.length * 8
      };
    }

    return {
      kind: 'louds',
      size: nodes.length,
      root: 1,
      degree: degree,
      child: child,
      firstChild: firstChild,
      nextSibling: nextSibling,
      parent: parent,
      value: valueOf,
      bits: function () { return bits.slice(); },
      shape: shape,
      stats: function () { return Object.assign({}, stats); },
      resetStats: function () { stats = emptyStats(); }
    };
  }

  /* --------------------------------------------------- balanced parentheses */

  /**
   * Depth-first, '(' down and ')' up. Subtree size is (close − open + 1) / 2
   * and depth is the excess, both immediate. `findClose` here is a scan, which
   * is the honest simple implementation: making it O(1) needs a range-min-max
   * tree, and saying "BP navigation is constant time" without one is quoting a
   * structure you did not build.
   */
  function parentheses(tree) {
    const bits = [];
    const values = [];

    (function walk(node) {
      bits.push(1);
      values.push(node.value);
      node.children.forEach(walk);
      bits.push(0);
    }(tree));

    const vector = bitVector().create(bits);
    let stats = emptyStats();

    function findClose(open) {
      stats.operations += 1;
      let excess = 0;
      for (let i = open; i < bits.length; i += 1) {
        stats.scanSteps += 1;
        excess += bits[i] ? 1 : -1;
        if (excess === 0) return i;
      }
      return -1;
    }

    function subtreeSize(open) {
      return (findClose(open) - open + 1) / 2;
    }

    function depthAt(position) {
      stats.operations += 1;
      stats.rankCalls += 2;
      return vector.rank1(position + 1) - vector.rank0(position + 1);
    }

    function firstChild(open) {
      stats.operations += 1;
      return bits[open + 1] ? open + 1 : null;
    }

    function nextSibling(open) {
      const close = findClose(open);
      return bits[close + 1] ? close + 1 : null;
    }

    function preorderValues() {
      const out = [];
      for (let i = 0; i < bits.length; i += 1) {
        if (bits[i]) out.push(values[vector.rank1(i)]);
      }
      return out;
    }

    function shape() {
      return {
        nodes: values.length,
        bits: bits.length,
        bitsPerNode: values.length ? bits.length / values.length : 0,
        rawBytes: vector.shape().rawBytes,
        indexBytes: vector.shape().indexBytes,
        totalBytes: vector.shape().rawBytes + vector.shape().indexBytes,
        pointerBytes: values.length * 48
      };
    }

    return {
      kind: 'balanced-parentheses',
      size: values.length,
      root: 0,
      findClose: findClose,
      subtreeSize: subtreeSize,
      depthAt: depthAt,
      firstChild: firstChild,
      nextSibling: nextSibling,
      preorderValues: preorderValues,
      value: function (open) { return values[vector.rank1(open)]; },
      bits: function () { return bits.slice(); },
      shape: shape,
      stats: function () { return Object.assign({}, stats); },
      resetStats: function () { stats = emptyStats(); }
    };
  }

  /* -------------------------------------------------------- wavelet tree */

  function wavelet(sequence, options) {
    const settings = options || {};
    const alphabet = Math.max(2, settings.alphabet || (Math.max.apply(null, sequence) + 1));
    let stats = emptyStats();
    let vectors = 0;
    let bits = 0;

    function build(items, lo, hi) {
      if (lo === hi) return { leaf: true, lo: lo, count: items.length };
      const mid = Math.floor((lo + hi) / 2);
      const marks = items.map(function (symbol) { return symbol > mid ? 1 : 0; });
      const left = items.filter(function (symbol) { return symbol <= mid; });
      const right = items.filter(function (symbol) { return symbol > mid; });
      vectors += 1;
      bits += marks.length;
      return {
        leaf: false, lo: lo, hi: hi, mid: mid,
        vector: bitVector().create(marks.length ? marks : [0], { length: marks.length }),
        left: build(left, lo, mid),
        right: build(right, mid + 1, hi)
      };
    }

    const root = build(sequence, 0, alphabet - 1);

    function access(index) {
      stats.operations += 1;
      let node = root;
      let at = index;
      while (!node.leaf) {
        stats.rankCalls += 1;
        const goRight = node.vector.get(at) === 1;
        const ones = node.vector.rank1(at);
        at = goRight ? ones : at - ones;
        node = goRight ? node.right : node.left;
      }
      return node.lo;
    }

    /** How many occurrences of `symbol` in [0, index). */
    function rank(symbol, index) {
      stats.operations += 1;
      let node = root;
      let at = index;
      while (!node.leaf) {
        stats.rankCalls += 1;
        const ones = node.vector.rank1(at);
        if (symbol > node.mid) { at = ones; node = node.right; }
        else { at = at - ones; node = node.left; }
      }
      return at;
    }

    /** The k-th smallest symbol in [from, to], 1-based - the query a wavelet
     *  tree exists for. */
    function quantile(from, to, k) {
      stats.operations += 1;
      let node = root;
      let lo = from;
      let hi = to + 1;
      let rank = k;

      while (!node.leaf) {
        stats.rankCalls += 2;
        const onesBefore = node.vector.rank1(lo);
        const onesWithin = node.vector.rank1(hi) - onesBefore;
        const zerosWithin = (hi - lo) - onesWithin;
        if (rank <= zerosWithin) {
          lo = lo - onesBefore;
          hi = hi - (onesBefore + onesWithin);
          node = node.left;
        } else {
          rank -= zerosWithin;
          lo = onesBefore;
          hi = onesBefore + onesWithin;
          node = node.right;
        }
      }
      return node.lo;
    }

    function shape() {
      const levels = Math.ceil(Math.log2(alphabet));
      return {
        length: sequence.length,
        alphabet: alphabet,
        levels: levels,
        vectors: vectors,
        bits: bits,
        bitsPerSymbol: sequence.length ? bits / sequence.length : 0,
        bound: levels,
        rawBytes: sequence.length * 4,
        bytes: Math.ceil(bits / 8)
      };
    }

    return {
      access: access,
      rank: rank,
      quantile: quantile,
      shape: shape,
      stats: function () { return Object.assign({}, stats); },
      resetStats: function () { stats = emptyStats(); }
    };
  }

  return { pointerTree: pointerTree, louds: louds, parentheses: parentheses, wavelet: wavelet };
}));

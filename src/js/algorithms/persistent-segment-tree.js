/**
 * A segment tree where an update returns a *new root* instead of mutating the
 * old one, and every root ever returned stays queryable.
 *
 * The mechanism is path copying and nothing else: an update rebuilds the
 * root-to-leaf path - ⌈log₂ n⌉ + 1 nodes - and points the new nodes at the old
 * siblings. Two consecutive versions therefore share everything except one
 * path, which is what makes "keep every version" cost O(log n) per version
 * rather than O(n).
 *
 * The second constructor is the one worth knowing. Build one version per
 * *prefix* of an array, over the value domain rather than the index domain,
 * and the difference between version r and version l−1 is a segment tree
 * counting exactly the values in positions [l, r]. Descending that difference
 * answers "the k-th smallest value in this range" in O(log n) - a query no
 * monoid can express and that M08's merge-sort tree paid O(log² n) and
 * O(n log n) memory for.
 *
 * This is also the structure under snapshot isolation and time-travel queries:
 * MVCC is persistence plus a garbage collector that drops versions nobody can
 * still reach.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.PersistentSegmentTree = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function emptyStats() {
    return { updates: 0, queries: 0, nodesAllocated: 0, nodesVisited: 0, descents: 0 };
  }

  function create(values, options) {
    const settings = options || {};
    const n = Math.max(1, values.length);
    const stats = emptyStats();
    const roots = [];

    function makeNode(sum, left, right) {
      stats.nodesAllocated += 1;
      return { sum: sum, left: left, right: right };
    }

    function build(lo, hi) {
      if (lo === hi) return makeNode(values[lo] || 0, null, null);
      const mid = (lo + hi) >> 1;
      const left = build(lo, mid);
      const right = build(mid + 1, hi);
      return makeNode(left.sum + right.sum, left, right);
    }

    roots.push(build(0, n - 1));

    /** One path rebuilt, every sibling shared. The new nodes are exactly the
     *  ones whose stored sum changed. */
    function assign(node, span, index, value) {
      if (span.lo === span.hi) return makeNode(value, null, null);
      const mid = (span.lo + span.hi) >> 1;
      if (index <= mid) {
        const left = assign(node.left, { lo: span.lo, hi: mid }, index, value);
        return makeNode(left.sum + node.right.sum, left, node.right);
      }
      const right = assign(node.right, { lo: mid + 1, hi: span.hi }, index, value);
      return makeNode(node.left.sum + right.sum, node.left, right);
    }

    function update(index, value, version) {
      const at = versionOf(version);
      stats.updates += 1;
      roots.push(assign(roots[at], { lo: 0, hi: n - 1 }, index, value));
      return roots.length - 1;
    }

    function versionOf(version) {
      const at = version === undefined ? roots.length - 1 : version;
      if (at < 0 || at >= roots.length) throw new RangeError('PersistentSegmentTree: no version ' + version);
      return at;
    }

    function rangeSum(from, to, version) {
      stats.queries += 1;
      return descend(roots[versionOf(version)], { lo: 0, hi: n - 1 }, { from: from, to: to });
    }

    function descend(node, span, range) {
      stats.nodesVisited += 1;
      if (!node || range.to < span.lo || range.from > span.hi) return 0;
      if (range.from <= span.lo && span.hi <= range.to) return node.sum;
      const mid = (span.lo + span.hi) >> 1;
      return descend(node.left, { lo: span.lo, hi: mid }, range) +
        descend(node.right, { lo: mid + 1, hi: span.hi }, range);
    }

    /** Every distinct node reachable from any version - the number that says
     *  whether the sharing is real. */
    function shape() {
      const seen = new Set();
      roots.forEach(function (node) { collect(node, seen); });
      return {
        size: n,
        versions: roots.length - 1,
        distinctNodes: seen.size,
        nodesAllocated: stats.nodesAllocated,
        nodesPerUpdate: stats.updates ? (stats.nodesAllocated - (2 * n - 1)) / stats.updates : 0,
        depthBound: Math.ceil(Math.log2(n)) + 1,
        bytes: seen.size * 32,
        bytesIfCopied: (roots.length) * (2 * n - 1) * 32
      };
    }

    function collect(node, seen) {
      if (!node || seen.has(node)) return;
      seen.add(node);
      collect(node.left, seen);
      collect(node.right, seen);
    }

    return {
      update: update,
      rangeSum: rangeSum,
      shape: shape,
      versions: function () { return roots.length - 1; },
      size: function () { return n; },
      stats: function () { return Object.assign({}, stats); },
      resetStats: function () { Object.assign(stats, emptyStats()); },
      label: settings.label || 'persistent segment tree'
    };
  }

  /* ------------------------------------------------- k-th smallest in range */

  /**
   * One version per prefix, over the value domain. Version i counts the values
   * in positions [0, i); subtracting version l from version r+1 node by node
   * gives the counts for [l, r] without building anything, which is why the
   * query is a single O(log domain) descent.
   */
  function prefixCounts(values, options) {
    const settings = options || {};
    const domain = Math.max(1, settings.domain || (Math.max.apply(null, values) + 1));
    const stats = emptyStats();
    const roots = [null];

    function makeNode(count, left, right) {
      stats.nodesAllocated += 1;
      return { count: count, left: left, right: right };
    }

    function add(node, span, value) {
      const count = (node ? node.count : 0) + 1;
      if (span.lo === span.hi) return makeNode(count, null, null);
      const mid = (span.lo + span.hi) >> 1;
      if (value <= mid) return makeNode(count, add(node && node.left, { lo: span.lo, hi: mid }, value), node && node.right);
      return makeNode(count, node && node.left, add(node && node.right, { lo: mid + 1, hi: span.hi }, value));
    }

    values.forEach(function (value) {
      roots.push(add(roots[roots.length - 1], { lo: 0, hi: domain - 1 }, value));
    });

    function countOf(node) {
      return node ? node.count : 0;
    }

    /** k is 1-based: kthSmallest(l, r, 1) is the minimum of the range. */
    function kthSmallest(from, to, k) {
      stats.queries += 1;
      let older = roots[from];
      let newer = roots[to + 1];
      let lo = 0;
      let hi = domain - 1;
      let rank = k;

      while (lo < hi) {
        stats.descents += 1;
        const leftCount = countOf(newer && newer.left) - countOf(older && older.left);
        const mid = (lo + hi) >> 1;
        if (rank <= leftCount) {
          newer = newer && newer.left;
          older = older && older.left;
          hi = mid;
        } else {
          rank -= leftCount;
          newer = newer && newer.right;
          older = older && older.right;
          lo = mid + 1;
        }
      }

      return lo;
    }

    function countBelow(from, to, value) {
      stats.queries += 1;
      return walk(roots[to + 1], roots[from], { lo: 0, hi: domain - 1 }, value);
    }

    function walk(newer, older, span, value) {
      if (span.lo >= value) return 0;
      if (span.hi < value) return countOf(newer) - countOf(older);
      const mid = (span.lo + span.hi) >> 1;
      return walk(newer && newer.left, older && older.left, { lo: span.lo, hi: mid }, value) +
        walk(newer && newer.right, older && older.right, { lo: mid + 1, hi: span.hi }, value);
    }

    function shape() {
      const seen = new Set();
      roots.forEach(function (node) { collect(node, seen); });
      return {
        size: values.length,
        domain: domain,
        versions: roots.length - 1,
        distinctNodes: seen.size,
        nodesAllocated: stats.nodesAllocated,
        nodesPerValue: values.length ? stats.nodesAllocated / values.length : 0,
        depthBound: Math.ceil(Math.log2(domain)) + 1,
        bytes: seen.size * 32
      };
    }

    function collect(node, seen) {
      if (!node || seen.has(node)) return;
      seen.add(node);
      collect(node.left, seen);
      collect(node.right, seen);
    }

    return {
      kthSmallest: kthSmallest,
      countBelow: countBelow,
      shape: shape,
      domain: domain,
      size: function () { return values.length; },
      stats: function () { return Object.assign({}, stats); },
      resetStats: function () { Object.assign(stats, emptyStats()); }
    };
  }

  return { create: create, prefixCounts: prefixCounts };
}));

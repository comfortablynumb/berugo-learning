/**
 * One-dimensional range structures: prefix sums, Fenwick trees, segment trees
 * with and without lazy propagation, sparse tables, sqrt decomposition and a
 * merge-sort tree.
 *
 * Six structures over one array, and the point of putting them in one file is
 * that the choice between them is decided in about ten seconds by two
 * questions: does the operation have an inverse, and does the array change?
 *
 *   inverse + static      prefix sums          O(1) query, no updates at all
 *   inverse + point update Fenwick             smallest and fastest, sums only
 *   any monoid            segment tree         min, max, gcd, matrices, ...
 *   any monoid + range update  lazy segment tree
 *   idempotent + static   sparse table         O(1) query, O(n log n) memory
 *   anything at all       sqrt decomposition   O(√n), and trivial to modify
 *
 * Every structure counts the array slots it touches per operation, because
 * "O(log n)" hides a factor of four between a Fenwick tree and a segment tree
 * and that factor is the entire reason competitive programmers reach for the
 * smaller one.
 *
 * The segment tree also exposes `decomposition`, which is the list of
 * *canonical nodes* a query range breaks into. That list is the structure's
 * whole idea: any interval, however awkward, is the disjoint union of at most
 * 2·log n stored nodes.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.RangeStructures = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const MONOIDS = {
    sum: { id: 'sum', identity: 0, combine: function (a, b) { return a + b; }, idempotent: false },
    min: { id: 'min', identity: Infinity, combine: function (a, b) { return a < b ? a : b; }, idempotent: true },
    max: { id: 'max', identity: -Infinity, combine: function (a, b) { return a > b ? a : b; }, idempotent: true },
    gcd: { id: 'gcd', identity: 0, combine: gcd, idempotent: true }
  };

  function gcd(a, b) {
    let x = Math.abs(a);
    let y = Math.abs(b);
    while (y) { const t = x % y; x = y; y = t; }
    return x;
  }

  function emptyStats() {
    return { updates: 0, queries: 0, slotsTouched: 0, comparisons: 0 };
  }

  function monoidFor(name) {
    const monoid = MONOIDS[name || 'sum'];
    if (!monoid) throw new Error('RangeStructures: unknown monoid "' + name + '"');
    return monoid;
  }

  /* ------------------------------------------------------- prefix sums */

  /**
   * The baseline, and the structure whose limit motivates all the others: a
   * query is two array reads, and a single point update invalidates every
   * prefix after it, so an update is O(n).
   */
  function prefixSums(values) {
    const sums = new Float64Array(values.length + 1);
    const data = Float64Array.from(values);
    let stats = emptyStats();

    function rebuild() {
      for (let i = 0; i < data.length; i += 1) sums[i + 1] = sums[i] + data[i];
    }

    rebuild();

    return {
      kind: 'prefix-sums',
      add: function (index, delta) {
        stats.updates += 1;
        data[index] += delta;
        stats.slotsTouched += data.length - index;
        for (let i = index; i < data.length; i += 1) sums[i + 1] = sums[i] + data[i];
      },
      rangeSum: function (from, to) {
        stats.queries += 1;
        stats.slotsTouched += 2;
        return sums[to + 1] - sums[from];
      },
      bytes: function () { return (sums.length + data.length) * 8; },
      size: function () { return data.length; },
      stats: function () { return Object.assign({}, stats); },
      resetStats: function () { stats = emptyStats(); }
    };
  }

  /* ----------------------------------------------------------- Fenwick */

  /**
   * Fenwick (binary indexed) tree. One array of n+1 numbers - no children, no
   * padding to a power of two - where slot i covers the i & −i values ending
   * at i. `i & −i` isolates the lowest set bit, and that single expression is
   * the whole structure: it is both the length of the range a slot covers and
   * the step to the next slot.
   *
   * It only supports operations with an inverse, because a prefix query is a
   * sum of slots and a range query is one prefix minus another. There is no
   * Fenwick tree for min.
   */
  function fenwick(values) {
    const n = values.length;
    const tree = new Float64Array(n + 1);
    const data = Float64Array.from(values);
    let stats = emptyStats();

    function build() {
      for (let i = 1; i <= n; i += 1) {
        tree[i] += data[i - 1];
        const parent = i + (i & -i);
        if (parent <= n) tree[parent] += tree[i];
      }
    }

    build();

    function add(index, delta) {
      stats.updates += 1;
      data[index] += delta;
      for (let i = index + 1; i <= n; i += i & -i) { tree[i] += delta; stats.slotsTouched += 1; }
    }

    function prefix(index) {
      let total = 0;
      for (let i = index + 1; i > 0; i -= i & -i) { total += tree[i]; stats.slotsTouched += 1; }
      return total;
    }

    function rangeSum(from, to) {
      stats.queries += 1;
      return prefix(to) - (from > 0 ? prefix(from - 1) : 0);
    }

    /**
     * The bit trick: descend the implicit tree by trying each power of two
     * from the top, which finds the smallest index whose prefix reaches
     * `target` in one pass instead of a binary search with a prefix query per
     * step. Only valid when every value is non-negative.
     */
    function findKth(target) {
      stats.queries += 1;
      let position = 0;
      let remaining = target;
      let step = 1 << Math.floor(Math.log2(Math.max(1, n)));

      while (step > 0) {
        const next = position + step;
        if (next <= n && tree[next] < remaining) {
          position = next;
          remaining -= tree[next];
          stats.slotsTouched += 1;
        }
        step >>= 1;
      }

      return position;
    }

    return {
      kind: 'fenwick',
      add: add,
      prefix: prefix,
      rangeSum: rangeSum,
      findKth: findKth,
      bytes: function () { return (n + 1) * 8; },
      size: function () { return n; },
      stats: function () { return Object.assign({}, stats); },
      resetStats: function () { stats = emptyStats(); }
    };
  }

  /* ------------------------------------------------------ segment tree */

  function segmentTree(values, options) {
    const settings = options || {};
    const monoid = monoidFor(settings.monoid);
    const n = values.length;
    const tree = new Array(4 * Math.max(1, n)).fill(monoid.identity);
    let stats = emptyStats();

    function build(node, lo, hi) {
      if (lo === hi) { tree[node] = values[lo]; return; }
      const mid = (lo + hi) >> 1;
      build(node * 2, lo, mid);
      build(node * 2 + 1, mid + 1, hi);
      tree[node] = monoid.combine(tree[node * 2], tree[node * 2 + 1]);
    }

    if (n) build(1, 0, n - 1);

    function update(index, value) {
      stats.updates += 1;
      assign({ node: 1, lo: 0, hi: n - 1 }, index, value);
    }

    function assign(span, index, value) {
      stats.slotsTouched += 1;
      if (span.lo === span.hi) { tree[span.node] = value; return; }
      const mid = (span.lo + span.hi) >> 1;
      if (index <= mid) assign({ node: span.node * 2, lo: span.lo, hi: mid }, index, value);
      else assign({ node: span.node * 2 + 1, lo: mid + 1, hi: span.hi }, index, value);
      tree[span.node] = monoid.combine(tree[span.node * 2], tree[span.node * 2 + 1]);
    }

    function query(from, to) {
      stats.queries += 1;
      return descend({ node: 1, lo: 0, hi: n - 1 }, from, to);
    }

    function descend(span, from, to) {
      stats.slotsTouched += 1;
      if (to < span.lo || from > span.hi) return monoid.identity;
      if (from <= span.lo && span.hi <= to) return tree[span.node];
      const mid = (span.lo + span.hi) >> 1;
      return monoid.combine(
        descend({ node: span.node * 2, lo: span.lo, hi: mid }, from, to),
        descend({ node: span.node * 2 + 1, lo: mid + 1, hi: span.hi }, from, to)
      );
    }

    /** The canonical decomposition, as ranges rather than values: this is what
     *  the diagram draws, and its length is the query's real cost. */
    function decomposition(from, to) {
      const out = [];
      collect({ node: 1, lo: 0, hi: n - 1 }, from, to, out);
      return out;
    }

    function collect(span, from, to, out) {
      if (to < span.lo || from > span.hi) return;
      if (from <= span.lo && span.hi <= to) {
        out.push({ node: span.node, lo: span.lo, hi: span.hi, value: tree[span.node] });
        return;
      }
      const mid = (span.lo + span.hi) >> 1;
      collect({ node: span.node * 2, lo: span.lo, hi: mid }, from, to, out);
      collect({ node: span.node * 2 + 1, lo: mid + 1, hi: span.hi }, from, to, out);
    }

    return {
      kind: 'segment-tree',
      monoid: monoid.id,
      update: update,
      query: query,
      decomposition: decomposition,
      bytes: function () { return tree.length * 8; },
      size: function () { return n; },
      stats: function () { return Object.assign({}, stats); },
      resetStats: function () { stats = emptyStats(); }
    };
  }

  /* ------------------------------------------------- lazy segment tree */

  /**
   * Range add, range min. The lazy value on a node means "every element below
   * me has this much added and does not know it"; a node's stored minimum is
   * kept *already correct* for its own subtree, so a query that stops at the
   * node needs no push at all. Getting that convention backwards - storing a
   * minimum that still needs its own pending add applied - is the standard bug,
   * and it produces answers that are right whenever the ranges happen to align.
   */
  function lazySegmentTree(values) {
    const n = values.length;
    const size = 4 * Math.max(1, n);
    const tree = new Float64Array(size);
    const lazy = new Float64Array(size);
    let stats = emptyStats();

    function build(node, lo, hi) {
      if (lo === hi) { tree[node] = values[lo]; return; }
      const mid = (lo + hi) >> 1;
      build(node * 2, lo, mid);
      build(node * 2 + 1, mid + 1, hi);
      tree[node] = Math.min(tree[node * 2], tree[node * 2 + 1]);
    }

    if (n) build(1, 0, n - 1);

    function push(node) {
      if (!lazy[node]) return;
      [node * 2, node * 2 + 1].forEach(function (child) {
        tree[child] += lazy[node];
        lazy[child] += lazy[node];
      });
      lazy[node] = 0;
    }

    function rangeAdd(from, to, delta) {
      stats.updates += 1;
      applyAdd({ node: 1, lo: 0, hi: n - 1 }, { from: from, to: to }, delta);
    }

    function applyAdd(span, range, delta) {
      stats.slotsTouched += 1;
      if (range.to < span.lo || range.from > span.hi) return;
      if (range.from <= span.lo && span.hi <= range.to) {
        tree[span.node] += delta;
        lazy[span.node] += delta;
        return;
      }
      push(span.node);
      const mid = (span.lo + span.hi) >> 1;
      applyAdd({ node: span.node * 2, lo: span.lo, hi: mid }, range, delta);
      applyAdd({ node: span.node * 2 + 1, lo: mid + 1, hi: span.hi }, range, delta);
      tree[span.node] = Math.min(tree[span.node * 2], tree[span.node * 2 + 1]);
    }

    function rangeMin(from, to) {
      stats.queries += 1;
      return descend({ node: 1, lo: 0, hi: n - 1 }, { from: from, to: to });
    }

    function descend(span, range) {
      stats.slotsTouched += 1;
      if (range.to < span.lo || range.from > span.hi) return Infinity;
      if (range.from <= span.lo && span.hi <= range.to) return tree[span.node];
      push(span.node);
      const mid = (span.lo + span.hi) >> 1;
      return Math.min(
        descend({ node: span.node * 2, lo: span.lo, hi: mid }, range),
        descend({ node: span.node * 2 + 1, lo: mid + 1, hi: span.hi }, range)
      );
    }

    return {
      kind: 'lazy-segment-tree',
      rangeAdd: rangeAdd,
      rangeMin: rangeMin,
      bytes: function () { return size * 16; },
      size: function () { return n; },
      stats: function () { return Object.assign({}, stats); },
      resetStats: function () { stats = emptyStats(); }
    };
  }

  /* ------------------------------------------------------ sparse table */

  /**
   * O(1) queries by covering any range with two *overlapping* power-of-two
   * blocks. Overlapping is only allowed because the operation is idempotent -
   * min(a, a) = a - which is exactly why there is no sparse table for sums.
   */
  function sparseTable(values, options) {
    const settings = options || {};
    const monoid = monoidFor(settings.monoid || 'min');
    if (!monoid.idempotent) throw new Error('RangeStructures: a sparse table needs an idempotent operation');
    const n = values.length;
    const levels = Math.max(1, Math.floor(Math.log2(Math.max(1, n))) + 1);
    const table = [Array.from(values)];
    let stats = emptyStats();

    for (let level = 1; level < levels; level += 1) {
      const width = 1 << level;
      const row = new Array(Math.max(0, n - width + 1));
      for (let i = 0; i + width <= n; i += 1) {
        row[i] = monoid.combine(table[level - 1][i], table[level - 1][i + (width >> 1)]);
      }
      table.push(row);
    }

    function query(from, to) {
      stats.queries += 1;
      const level = Math.floor(Math.log2(to - from + 1));
      stats.slotsTouched += 2;
      return monoid.combine(table[level][from], table[level][to - (1 << level) + 1]);
    }

    return {
      kind: 'sparse-table',
      monoid: monoid.id,
      query: query,
      levels: levels,
      bytes: function () {
        return table.reduce(function (total, row) { return total + row.length * 8; }, 0);
      },
      size: function () { return n; },
      stats: function () { return Object.assign({}, stats); },
      resetStats: function () { stats = emptyStats(); }
    };
  }

  /* -------------------------------------------------- sqrt decomposition */

  /**
   * Blocks of √n with a cached aggregate each. It loses to every tree here on
   * paper and it is the one people actually write under time pressure, because
   * changing what it aggregates is two lines and there is no index arithmetic
   * to get wrong.
   */
  function sqrtBlocks(values, options) {
    const settings = options || {};
    const monoid = monoidFor(settings.monoid);
    const n = values.length;
    const width = Math.max(1, Math.floor(settings.blockSize || Math.ceil(Math.sqrt(Math.max(1, n)))));
    const data = Array.from(values);
    const blocks = new Array(Math.ceil(n / width)).fill(monoid.identity);
    let stats = emptyStats();

    function recompute(block) {
      let value = monoid.identity;
      const from = block * width;
      const to = Math.min(n, from + width);
      for (let i = from; i < to; i += 1) value = monoid.combine(value, data[i]);
      blocks[block] = value;
    }

    for (let block = 0; block < blocks.length; block += 1) recompute(block);

    function update(index, value) {
      stats.updates += 1;
      data[index] = value;
      stats.slotsTouched += width;
      recompute(Math.floor(index / width));
    }

    function query(from, to) {
      stats.queries += 1;
      let value = monoid.identity;
      let i = from;
      while (i <= to) {
        if (i % width === 0 && i + width - 1 <= to) {
          value = monoid.combine(value, blocks[i / width]);
          i += width;
        } else {
          value = monoid.combine(value, data[i]);
          i += 1;
        }
        stats.slotsTouched += 1;
      }
      return value;
    }

    return {
      kind: 'sqrt-blocks',
      monoid: monoid.id,
      blockSize: width,
      update: update,
      query: query,
      bytes: function () { return (n + blocks.length) * 8; },
      size: function () { return n; },
      stats: function () { return Object.assign({}, stats); },
      resetStats: function () { stats = emptyStats(); }
    };
  }

  /* ----------------------------------------------------- merge-sort tree */

  /**
   * A segment tree whose nodes store their range *sorted*. It answers "how
   * many values below x in this range" - an order statistic, which no monoid
   * can express, because the answer for a union is not a function of the two
   * halves' answers alone. The cost is O(n log n) memory and O(log² n) per
   * query: one binary search inside each canonical node.
   */
  function mergeSortTree(values) {
    const n = values.length;
    const tree = new Array(4 * Math.max(1, n));
    let stats = emptyStats();

    function build(node, lo, hi) {
      if (lo === hi) { tree[node] = [values[lo]]; return; }
      const mid = (lo + hi) >> 1;
      build(node * 2, lo, mid);
      build(node * 2 + 1, mid + 1, hi);
      tree[node] = merge(tree[node * 2], tree[node * 2 + 1]);
    }

    function merge(left, right) {
      const out = new Array(left.length + right.length);
      let i = 0;
      let j = 0;
      let k = 0;
      while (i < left.length && j < right.length) out[k++] = left[i] <= right[j] ? left[i++] : right[j++];
      while (i < left.length) out[k++] = left[i++];
      while (j < right.length) out[k++] = right[j++];
      return out;
    }

    if (n) build(1, 0, n - 1);

    function countBelow(sorted, value) {
      let low = 0;
      let high = sorted.length;
      while (low < high) {
        const mid = (low + high) >> 1;
        stats.comparisons += 1;
        if (sorted[mid] < value) low = mid + 1;
        else high = mid;
      }
      return low;
    }

    function countLessThan(from, to, value) {
      stats.queries += 1;
      return walk({ node: 1, lo: 0, hi: n - 1 }, { from: from, to: to }, value);
    }

    function walk(span, range, value) {
      stats.slotsTouched += 1;
      if (range.to < span.lo || range.from > span.hi) return 0;
      if (range.from <= span.lo && span.hi <= range.to) return countBelow(tree[span.node], value);
      const mid = (span.lo + span.hi) >> 1;
      return walk({ node: span.node * 2, lo: span.lo, hi: mid }, range, value) +
        walk({ node: span.node * 2 + 1, lo: mid + 1, hi: span.hi }, range, value);
    }

    return {
      kind: 'merge-sort-tree',
      countLessThan: countLessThan,
      bytes: function () {
        return tree.reduce(function (total, row) { return total + (row ? row.length * 8 : 0); }, 0);
      },
      size: function () { return n; },
      stats: function () { return Object.assign({}, stats); },
      resetStats: function () { stats = emptyStats(); }
    };
  }

  return {
    prefixSums: prefixSums,
    fenwick: fenwick,
    segmentTree: segmentTree,
    lazySegmentTree: lazySegmentTree,
    sparseTable: sparseTable,
    sqrtBlocks: sqrtBlocks,
    mergeSortTree: mergeSortTree,
    monoids: MONOIDS,
    gcd: gcd
  };
}));

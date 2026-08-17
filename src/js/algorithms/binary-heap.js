/**
 * The implicit heap: binary, d-ary and indexed, in one module.
 *
 * There is no node and no pointer. The tree is an array, the children of i are
 * at d·i + 1 … d·i + d, and the parent of i is at ⌊(i − 1)/d⌋ — so the shape
 * property is not maintained, it is a consequence of the array being dense.
 * That is the whole reason a heap is the fastest priority queue for the common
 * case: one contiguous allocation, no per-node overhead, and a sift that walks
 * a straight line through memory.
 *
 * Arity is a parameter rather than a constant because it is a real dial: a
 * larger d gives a shallower tree (fewer levels to sift up through) and more
 * comparisons per level on the way down. Which way that trades depends on the
 * operation mix, and `machines/pq-lab.js` measures it.
 *
 * The indexed variant adds the position map that makes decrease-key possible:
 * without it, finding the element to decrease is a linear scan and the whole
 * point of the operation is lost.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BinaryHeap = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function minFirst(a, b) {
    if (a < b) return -1;
    return a > b ? 1 : 0;
  }

  function newStats() {
    return {
      comparisons: 0, swaps: 0, siftDistance: 0, nodeTouches: 0,
      pushes: 0, pops: 0, decreaseKeys: 0, melds: 0, builds: 0
    };
  }

  function parentOf(index, arity) {
    return Math.floor((index - 1) / arity);
  }

  function firstChildOf(index, arity) {
    return arity * index + 1;
  }

  function create(options) {
    const settings = options || {};
    const arity = Math.max(2, settings.arity || 2);
    const compare = settings.compare || minFirst;
    const indexed = Boolean(settings.indexed);

    /* keys[i] is the priority at heap position i; ids[i] is the caller's
       handle for it, and positions maps a handle back to its slot. */
    const keys = [];
    const ids = [];
    const positions = indexed ? new Map() : null;
    let stats = newStats();

    function cmp(a, b) {
      stats.comparisons += 1;
      return compare(a, b);
    }

    function place(index, key, id) {
      keys[index] = key;
      ids[index] = id;
      if (indexed) positions.set(id, index);
    }

    function swap(a, b) {
      stats.swaps += 1;
      const key = keys[a];
      const id = ids[a];
      place(a, keys[b], ids[b]);
      place(b, key, id);
    }

    /** Walks a node up until its parent outranks it. */
    function siftUp(start) {
      let index = start;
      while (index > 0) {
        const parent = parentOf(index, arity);
        stats.nodeTouches += 1;
        if (cmp(keys[index], keys[parent]) >= 0) break;
        swap(index, parent);
        index = parent;
        stats.siftDistance += 1;
      }
      return index;
    }

    /** Finds the best child of `index`, or −1 when it has none. This is where
     *  the arity is paid for: d comparisons per level. */
    function bestChild(index) {
      const first = firstChildOf(index, arity);
      if (first >= keys.length) return -1;

      const last = Math.min(first + arity - 1, keys.length - 1);
      let best = first;
      for (let child = first + 1; child <= last; child += 1) {
        stats.nodeTouches += 1;
        if (cmp(keys[child], keys[best]) < 0) best = child;
      }
      return best;
    }

    /** Walks a node down while a child outranks it. */
    function siftDown(start) {
      let index = start;
      for (;;) {
        const child = bestChild(index);
        if (child === -1) return index;
        stats.nodeTouches += 1;
        if (cmp(keys[child], keys[index]) >= 0) return index;
        swap(index, child);
        index = child;
        stats.siftDistance += 1;
      }
    }

    function push(key, id) {
      stats.pushes += 1;
      const handle = id === undefined ? key : id;
      if (indexed && positions.has(handle)) throw new Error('binary-heap: duplicate handle ' + handle);
      place(keys.length, key, handle);
      return siftUp(keys.length - 1);
    }

    function pop() {
      if (!keys.length) return undefined;
      stats.pops += 1;

      const topKey = keys[0];
      const topId = ids[0];
      const lastKey = keys.pop();
      const lastId = ids.pop();
      if (indexed) positions.delete(topId);

      if (keys.length) {
        place(0, lastKey, lastId);
        siftDown(0);
      }
      return { key: topKey, id: topId };
    }

    /** Floyd's build: sift down from the last parent to the root. The reason
     *  it is O(n) and not O(n log n) is that most nodes are near the bottom
     *  and can barely sink - the sum of heights is n − log n − 1. */
    function build(items) {
      stats.builds += 1;
      keys.length = 0;
      ids.length = 0;
      if (indexed) positions.clear();

      items.forEach(function (item, i) {
        const key = item && item.key !== undefined ? item.key : item;
        const id = item && item.id !== undefined ? item.id : i;
        place(i, key, id);
      });

      for (let index = parentOf(keys.length - 1, arity); index >= 0; index -= 1) siftDown(index);
      return keys.length;
    }

    function decreaseKey(id, key) {
      if (!indexed) throw new Error('binary-heap: decreaseKey needs an indexed heap');
      stats.decreaseKeys += 1;

      const index = positions.get(id);
      if (index === undefined) return false;
      if (cmp(keys[index], key) <= 0) return false;

      keys[index] = key;
      siftUp(index);
      return true;
    }

    /** Melding two array heaps is not O(log n): the arrays are concatenated
     *  and rebuilt, which is O(n). Saying so is the point - this is the
     *  operation the mergeable families exist for. */
    function meld(other) {
      stats.melds += 1;
      const merged = keys.map(function (key, i) { return { key: key, id: ids[i] }; })
        .concat(other.entries());
      build(merged);
      return merged.length;
    }

    function checkInvariants() {
      const errors = [];
      for (let index = 1; index < keys.length; index += 1) {
        const parent = parentOf(index, arity);
        if (compare(keys[index], keys[parent]) < 0) {
          errors.push('node ' + index + ' outranks its parent ' + parent);
        }
      }
      if (indexed) {
        if (positions.size !== keys.length) {
          errors.push('the position map holds ' + positions.size + ' entries for ' + keys.length + ' nodes');
        }
        ids.forEach(function (id, index) {
          if (positions.get(id) !== index) errors.push('handle ' + id + ' maps to the wrong slot');
        });
      }
      return { ok: errors.length === 0, errors: errors };
    }

    /** The public surface, assembled in one place. */
    function publicApi() {
      return {
        name: 'heap-' + arity + (indexed ? '-indexed' : ''),
        arity: function () { return arity; },
        push: push,
        pop: pop,
        peek: function () { return keys.length ? { key: keys[0], id: ids[0] } : undefined; },
        build: build,
        meld: meld,
        decreaseKey: decreaseKey,
        has: function (id) { return indexed ? positions.has(id) : ids.indexOf(id) !== -1; },
        size: function () { return keys.length; },
        height: function () { return keys.length ? Math.floor(Math.log(keys.length) / Math.log(arity)) + 1 : 0; },
        keys: function () { return keys.slice(); },
        entries: function () { return keys.map(function (key, i) { return { key: key, id: ids[i] }; }); },
        checkInvariants: checkInvariants,
        stats: function () { return Object.assign({ size: keys.length, arity: arity }, stats); },
        resetStats: function () { stats = newStats(); }
      };
    }

    return publicApi();
  }

  /** Heapsort: build in place, then repeatedly swap the root to the end. The
   *  in-place property is why introsort falls back to it, and the scattered
   *  sift is why it is only the fallback. */
  function sort(values, options) {
    const settings = options || {};
    const compare = settings.compare || minFirst;
    /* A max-heap, so the largest lands at the end and the array comes out
       ascending without a second pass. */
    const heap = create({ arity: settings.arity || 2, compare: function (a, b) { return compare(b, a); } });
    heap.build(values.slice());

    const out = [];
    while (heap.size()) out.unshift(heap.pop().key);
    return { sorted: out, stats: heap.stats() };
  }

  /** Top-k over a stream: a bounded max-heap of the k smallest seen so far,
   *  so peak memory is k rather than n. */
  function topK(stream, k, options) {
    const settings = options || {};
    const compare = settings.compare || minFirst;
    const heap = create({ arity: settings.arity || 2, compare: function (a, b) { return compare(b, a); } });
    /* The gate comparison happens outside the heap, so it has to be counted
       here or the reported cost is a tenth of the truth: every element pays
       one comparison against the current k-th best, and only the ones that
       beat it pay for a pop and a push. */
    let gateComparisons = 0;
    let admitted = 0;

    stream.forEach(function (value) {
      if (heap.size() < k) { heap.push(value); admitted += 1; return; }
      gateComparisons += 1;
      if (compare(value, heap.peek().key) >= 0) return;
      heap.pop();
      heap.push(value);
      admitted += 1;
    });

    const out = [];
    while (heap.size()) out.unshift(heap.pop().key);
    return {
      values: out,
      stats: heap.stats(),
      gateComparisons: gateComparisons,
      admitted: admitted,
      totalComparisons: gateComparisons + heap.stats().comparisons,
      peak: k
    };
  }

  /** The sum-of-heights argument, tabulated. Nodes at height h number at most
   *  ⌈n / d^(h+1)⌉ and each can sink at most h levels, so the total work is
   *  Σ h·n/d^(h+1) — which converges to a constant times n, and that constant
   *  is why the build is linear. The leaves are height 0 and do no work at
   *  all, which is the half of the argument people forget.
   */
  function buildHeapWork(n, arity) {
    const d = arity || 2;
    const levels = Math.max(1, Math.ceil(Math.log(n + 1) / Math.log(d)));
    const rows = [];
    let total = 0;

    for (let height = 0; height < levels; height += 1) {
      const nodes = Math.ceil(n / Math.pow(d, height + 1));
      const work = nodes * height;
      total += work;
      rows.push({ height: height, nodes: nodes, sinks: height, work: work });
    }

    /* Σ h·x^h for x = 1/d sums to x/(1−x)², so the whole series is n/(d−1)·
       d/(d−1) = n·d/(d−1)². For d = 2 that is exactly n. */
    return { rows: rows, total: total, bound: n * d / Math.pow(d - 1, 2) };
  }

  return {
    create: create,
    sort: sort,
    topK: topK,
    buildHeapWork: buildHeapWork,
    newStats: newStats,
    parentOf: parentOf,
    firstChildOf: firstChildOf,
    minFirst: minFirst
  };
}));

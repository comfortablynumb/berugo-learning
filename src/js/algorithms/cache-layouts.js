/**
 * Cache-conscious layouts: the same search over three arrangements.
 *
 * The measure here is cache *misses*, not distinct lines. A single query
 * touches roughly log2(n) lines whatever the layout, so distinct lines shows
 * almost no difference and would teach the wrong thing. What differs is how
 * much of the structure stays resident across a stream of queries: the top of
 * an Eytzinger tree is a handful of contiguous lines that never get evicted,
 * while the equivalent levels of a sorted binary search are spread across the
 * whole array, one line each.
 *
 * So each layout runs its whole query stream through one cache (M36 refines
 * the model with associativity and prefetching) and reports misses per query.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.CacheLayouts = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const LINE_BYTES = 64;
  const KEY_BYTES = 4;

  function cacheSim() {
    if (scope && scope.CacheSim) return scope.CacheSim;
    return require('../machines/cache-sim.js');
  }

  /**
   * Records one query: comparisons made and the byte addresses read. The cache
   * is supplied by the caller and shared across queries, because residency
   * between queries is exactly the effect being measured.
   */
  function tracker(options) {
    const settings = options || {};
    const cache = settings.cache || cacheSim().create({ lines: settings.lines || 512 });
    const before = cache.stats().misses;
    const lines = new Set();
    let comparisons = 0;

    return {
      cache: cache,
      touch: function (address) {
        cache.access(address, KEY_BYTES);
        lines.add(Math.floor(address / LINE_BYTES));
      },
      compare: function () { comparisons += 1; },
      result: function () {
        return { comparisons: comparisons, cacheLines: lines.size, misses: cache.stats().misses - before };
      }
    };
  }

  /* ------------------------------------------------------------ sorted array */

  function sortedSearch(sorted, target, trace) {
    let lo = 0;
    let hi = sorted.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      trace.touch(mid * KEY_BYTES);
      trace.compare();
      if (sorted[mid] === target) return mid;
      if (sorted[mid] < target) lo = mid + 1; else hi = mid;
    }
    return -1;
  }

  /* --------------------------------------------------------------- eytzinger */

  /**
   * Breadth-first layout: node 1 is the root, children of i are 2i and 2i+1.
   * Index 0 is unused so the arithmetic stays branch-free.
   */
  function buildEytzinger(sorted) {
    const layout = new Array(sorted.length + 1).fill(0);
    let cursor = 0;

    function fill(index) {
      if (index > sorted.length) return;
      fill(2 * index);
      layout[index] = sorted[cursor];
      cursor += 1;
      fill(2 * index + 1);
    }

    fill(1);
    return layout;
  }

  function eytzingerSearch(layout, target, trace) {
    let index = 1;
    let candidate = -1;
    while (index < layout.length) {
      trace.touch(index * KEY_BYTES);
      trace.compare();
      if (layout[index] === target) { candidate = index; break; }
      index = 2 * index + (layout[index] < target ? 1 : 0);
    }
    return candidate;
  }

  /* ----------------------------------------------------------------- blocked */

  /**
   * A blocked layout stores B keys per node, so one line answers B
   * comparisons. The separators sit in their own small array - the same shape
   * as the internal level of a B-tree, and small enough to stay resident.
   */
  function buildBlocked(sorted, blockSize) {
    const B = blockSize || 16;
    const blocks = [];
    for (let start = 0; start < sorted.length; start += B) {
      blocks.push(sorted.slice(start, start + B));
    }
    const separators = blocks.map(function (block) { return block[block.length - 1]; });
    const base = Math.ceil((sorted.length * KEY_BYTES) / LINE_BYTES) * LINE_BYTES;
    return { blocks: blocks, separators: separators, blockSize: B, separatorBase: base };
  }

  /** Binary search over the separators, then a scan inside the one block. */
  function blockedSearch(structure, target, trace) {
    const separators = structure.separators;
    let lo = 0;
    let hi = separators.length - 1;

    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      trace.touch(structure.separatorBase + mid * KEY_BYTES);
      trace.compare();
      if (separators[mid] < target) lo = mid + 1; else hi = mid;
    }
    if (lo >= structure.blocks.length) return -1;

    return scanBlock({ structure: structure, blockIndex: lo, target: target, trace: trace });
  }

  function scanBlock(request) {
    const structure = request.structure;
    const block = structure.blocks[request.blockIndex];
    const base = request.blockIndex * structure.blockSize;

    for (let i = 0; i < block.length; i += 1) {
      request.trace.touch((base + i) * KEY_BYTES);
      request.trace.compare();
      if (block[i] === request.target) return base + i;
    }
    return -1;
  }

  /* ------------------------------------------------------------- comparison */

  function compare(options) {
    const n = options.n;
    const queries = options.queries || 200;
    const cacheLines = options.cacheLines || 512;
    const blockSize = options.blockSize || 16;

    const sorted = [];
    for (let i = 0; i < n; i += 1) sorted.push(i * 2);
    const eytzinger = buildEytzinger(sorted);
    const blocked = buildBlocked(sorted, blockSize);

    const targets = [];
    for (let q = 0; q < queries; q += 1) targets.push(options.rng.int(n) * 2);

    const searches = {
      sorted: function (target, trace) { return sortedSearch(sorted, target, trace); },
      eytzinger: function (target, trace) { return eytzingerSearch(eytzinger, target, trace); },
      blocked: function (target, trace) { return blockedSearch(blocked, target, trace); }
    };

    return {
      n: n,
      queries: queries,
      blockSize: blockSize,
      cacheBytes: cacheLines * LINE_BYTES,
      layouts: Object.keys(searches).map(function (name) {
        return measure({ name: name, search: searches[name], targets: targets, cacheLines: cacheLines });
      })
    };
  }

  function measure(request) {
    const cache = cacheSim().create({ lines: request.cacheLines, lineBytes: LINE_BYTES });
    const totals = { comparisons: 0, cacheLines: 0, misses: 0, found: 0 };

    request.targets.forEach(function (target) {
      const trace = tracker({ cache: cache });
      if (request.search(target, trace) >= 0) totals.found += 1;
      const result = trace.result();
      totals.comparisons += result.comparisons;
      totals.cacheLines += result.cacheLines;
      totals.misses += result.misses;
    });

    const queries = Math.max(1, request.targets.length);
    return {
      name: request.name,
      comparisonsPerQuery: totals.comparisons / queries,
      cacheLinesPerQuery: totals.cacheLines / queries,
      missesPerQuery: totals.misses / queries,
      foundRate: totals.found / queries,
      residentLines: cache.resident().length
    };
  }

  return {
    buildEytzinger: buildEytzinger,
    eytzingerSearch: eytzingerSearch,
    buildBlocked: buildBlocked,
    blockedSearch: blockedSearch,
    scanBlock: scanBlock,
    sortedSearch: sortedSearch,
    compare: compare,
    tracker: tracker,
    LINE_BYTES: LINE_BYTES,
    KEY_BYTES: KEY_BYTES
  };
}));

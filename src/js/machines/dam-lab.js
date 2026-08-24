/**
 * DamLab — I/O counts against the bounds, and misses against a tuned baseline.
 *
 * Two models and one discipline. In the external-memory model the prediction
 * is arithmetic — 2·(N/B)·(1 + passes) for a sort — so the measurement either
 * matches it or the implementation is holding more than M records somewhere.
 * The simulator refuses rather than warning, so a study that returns at all
 * has stayed inside its memory budget.
 *
 * In the cache-oblivious model there is no formula to match, so the reference
 * is a TUNED implementation: a tiled algorithm at the tile size that is best
 * for this cache. The claim is that the recursive version tracks it across
 * cache sizes without being told any of them, and the way to check it is to
 * sweep the cache and watch which column moves.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.DamLab = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const External = scope && scope.ExternalAlgorithms ? scope.ExternalAlgorithms
    : require('../algorithms/external-algorithms.js');
  const Oblivious = scope && scope.CacheOblivious ? scope.CacheOblivious
    : require('../algorithms/cache-oblivious.js');

  /* ------------------------------------------------------- 21.5 the DAM model */

  /**
   * External merge sort at several (M, B) settings, each against the closed
   * form. The `withinTenPercent` flag is the acceptance criterion stated as a
   * field, and the measured value is an exact match rather than an
   * approximation — which is what a correctly charged simulator produces.
   */
  function sortStudy(options) {
    const settings = options || {};
    const n = settings.n === undefined ? 8192 : settings.n;
    const configs = settings.configs || [
      { M: 64, B: 16 }, { M: 128, B: 16 }, { M: 256, B: 32 }, { M: 1024, B: 64 }
    ];

    return { n: n, rows: configs.map(function (config) {
      return sortRow(n, config, settings);
    }) };
  }

  function sortRow(n, config, settings) {
    const data = External.shuffled(n, settings.seed === undefined ? 7 : settings.seed);
    const disk = External.createDisk(data, config);
    const sorted = External.externalSort(disk);
    const bound = External.bounds(n, config.M, config.B);
    const stats = disk.stats();
    const ordered = sorted.order.every(function (value, i) {
      return i === 0 || sorted.order[i - 1] <= value;
    });

    return { M: config.M, B: config.B, runs: sorted.runs, passes: sorted.passes,
      fanOut: sorted.fanOut, transfers: stats.transfers, predicted: bound.sort,
      ratio: stats.transfers / bound.sort, peakHeld: stats.peakHeld, sorted: ordered,
      withinTenPercent: Math.abs(stats.transfers / bound.sort - 1) <= 0.1,
      scanBound: bound.scan, searchBound: bound.search };
  }

  /**
   * The three bounds side by side at one size, which is the table the section
   * exists to print: a scan is N/B, a sort is that times the pass count, and a
   * search is log_B N — three numbers that are not within constant factors of
   * one another.
   */
  function boundsTable(options) {
    const settings = options || {};
    const B = settings.B === undefined ? 64 : settings.B;
    const M = settings.M === undefined ? 4096 : settings.M;
    const sizes = settings.sizes === undefined ? [1e4, 1e5, 1e6, 1e7, 1e8] : settings.sizes;

    return { M: M, B: B, rows: sizes.map(function (n) {
      const bound = External.bounds(n, M, B);
      return { n: n, scan: bound.scan, sort: bound.sort, search: bound.search,
        passes: bound.mergePasses, fanOut: bound.fanOut,
        naive: n, naiveOverScan: n / bound.scan };
    }) };
  }

  /**
   * The join comparison, and the crossover. A nested loop costs one transfer
   * per row whatever the block size; sort-merge costs two sorts and two scans.
   * With a realistic M/B the sorts are one or two passes and the nested loop
   * loses by a growing factor, which is what the sweep shows.
   */
  function joinStudy(options) {
    const settings = options || {};
    const sizes = settings.sizes === undefined ? [2000, 8000, 32000, 128000] : settings.sizes;
    const config = { M: settings.M === undefined ? 8192 : settings.M,
      B: settings.B === undefined ? 64 : settings.B };

    return { config: config, rows: sizes.map(function (n) {
      const outer = External.randomKeys(n, n * 2, 3);
      const inner = External.randomKeys(n, n * 2, 4);
      const nested = External.nestedLoopJoin(outer, inner, config);
      const merge = External.sortMergeJoin(outer, inner, config);
      return { n: n, nested: nested.transfers, merge: merge.transfers,
        sortPart: merge.sortTransfers, walkPart: merge.walkTransfers,
        ratio: nested.transfers / merge.transfers, matches: merge.matches };
    }) };
  }

  /* ------------------------------------------- 21.6 cache-oblivious algorithms */

  /**
   * Transpose three ways across cache sizes. The tiled row is run at several
   * tile sizes and the BEST is reported as the tuned reference, because a
   * tuned implementation is one somebody chose the tile for — comparing
   * against an arbitrary tile would flatter the oblivious version.
   */
  function transposeStudy(options) {
    const settings = options || {};
    const n = settings.n === undefined ? 256 : settings.n;
    const lineBytes = settings.lineBytes === undefined ? 64 : settings.lineBytes;
    const caches = settings.caches === undefined ? [32, 128, 512, 2048] : settings.caches;
    const tiles = settings.tiles === undefined ? [4, 8, 16, 32, 64] : settings.tiles;

    return { n: n, lineBytes: lineBytes, tiles: tiles,
      rows: caches.map(function (lines) {
        return transposeRow(n, lines, lineBytes, tiles);
      }) };
  }

  function transposeRow(n, lines, lineBytes, tiles) {
    const a = Oblivious.matrix(n, 0, 8);
    const b = Oblivious.matrix(n, n * n * 8, 8);
    const make = function () { return Oblivious.cacheFor({ lines: lines, lineBytes: lineBytes }); };
    const pair = { from: a, to: b };
    const naive = Oblivious.transposeNaive(pair, make()).stats.misses;
    const tiled = tiles.map(function (tile) {
      return { tile: tile, misses: Oblivious.transposeTiled(pair, make(), tile).stats.misses };
    });
    const best = tiled.reduce(function (winner, row) {
      return row.misses < winner.misses ? row : winner;
    }, tiled[0]);
    const recursive = Oblivious.transposeRecursive(pair, make(), { cutoff: 1 }).stats.misses;

    return { lines: lines, kilobytes: lines * lineBytes / 1024, naive: naive, tiled: tiled,
      bestTile: best.tile, bestTiled: best.misses, recursive: recursive,
      obliviousPenalty: recursive / best.misses, naivePenalty: naive / best.misses };
  }

  /** The same comparison for matrix multiplication, where the tuned tile has
   *  a genuine optimum and the recursive version has no parameter at all. */
  function multiplyStudy(options) {
    const settings = options || {};
    const n = settings.n === undefined ? 64 : settings.n;
    const lineBytes = settings.lineBytes === undefined ? 64 : settings.lineBytes;
    const caches = settings.caches === undefined ? [32, 64, 256, 1024] : settings.caches;
    const tiles = settings.tiles === undefined ? [4, 8, 16, 32] : settings.tiles;

    return { n: n, lineBytes: lineBytes, tiles: tiles,
      rows: caches.map(function (lines) {
        return multiplyRow({ n: n, lines: lines, lineBytes: lineBytes }, tiles, settings);
      }) };
  }

  function multiplyRow(shape, tiles, settings) {
    const n = shape.n;
    const lines = shape.lines;
    const lineBytes = shape.lineBytes;
    const m = { a: Oblivious.matrix(n, 0, 8), b: Oblivious.matrix(n, n * n * 8, 8),
      c: Oblivious.matrix(n, 2 * n * n * 8, 8) };
    const make = function () { return Oblivious.cacheFor({ lines: lines, lineBytes: lineBytes }); };
    const naive = Oblivious.multiplyNaive(m, make()).stats.misses;
    const tiled = tiles.map(function (tile) {
      return { tile: tile, misses: Oblivious.multiplyTiled(m, make(), tile).stats.misses };
    });
    const best = tiled.reduce(function (winner, row) {
      return row.misses < winner.misses ? row : winner;
    }, tiled[0]);
    const recursive = Oblivious.multiplyRecursive(m, make(),
      { cutoff: settings.cutoff === undefined ? 8 : settings.cutoff }).stats.misses;

    return { lines: lines, kilobytes: lines * lineBytes / 1024, naive: naive, tiled: tiled,
      bestTile: best.tile, bestTiled: best.misses, recursive: recursive,
      obliviousPenalty: recursive / best.misses, naivePenalty: naive / best.misses };
  }

  /**
   * The van Emde Boas layout against level order and against a sorted array,
   * at rising tree heights. The comparison count is identical in every row —
   * only where the nodes sit changes — so the miss column is entirely about
   * layout.
   */
  function layoutStudy(options) {
    const settings = options || {};
    const heights = settings.heights === undefined ? [10, 12, 14, 16, 18] : settings.heights;
    const lines = settings.lines === undefined ? 64 : settings.lines;
    const queries = settings.queries === undefined ? 2000 : settings.queries;

    return { lines: lines, queries: queries, lineBytes: 64,
      nodesPerLine: 64 / (settings.elementBytes === undefined ? 8 : settings.elementBytes),
      rows: heights.map(function (height) {
        const run = function (kind) {
          return Oblivious.searchLayout({ height: height, kind: kind, lines: lines,
            queries: queries, elementBytes: settings.elementBytes });
        };
        const sorted = run('sorted');
        const inorder = run('inorder');
        const veb = run('veb');
        return { height: height, nodes: sorted.nodes,
          comparisons: sorted.comparisons / queries,
          levelOrder: sorted.missesPerQuery, sortedArray: inorder.missesPerQuery,
          veb: veb.missesPerQuery,
          predicted: Math.log(sorted.nodes) / Math.log(8),
          saving: inorder.missesPerQuery / veb.missesPerQuery };
      }) };
  }

  return {
    sortStudy: sortStudy, boundsTable: boundsTable, joinStudy: joinStudy,
    transposeStudy: transposeStudy, multiplyStudy: multiplyStudy, layoutStudy: layoutStudy
  };
}));

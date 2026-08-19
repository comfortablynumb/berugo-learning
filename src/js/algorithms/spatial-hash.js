/**
 * Uniform grid and spatial hash: the simplest spatial index there is, and the
 * fastest one whenever the data is evenly dense.
 *
 * Both modes bucket objects by the cell they fall in and answer a query by
 * scanning only the cells the query touches. They differ in how a cell
 * coordinate becomes a bucket:
 *
 *   `grid`  a bounded domain, direct-addressed - cell (cx, cy) is bucket
 *           cy·cols + cx. No hashing, no collisions, and memory proportional
 *           to the *area* whether or not anything is in it.
 *   `hash`  an unbounded domain - (cx, cy) is mixed into a fixed table. Memory
 *           is proportional to the objects, and two distant cells can share a
 *           bucket, so a query examines entries that are nowhere near it. Those
 *           are counted as `phantomCandidates`, because they are the price of
 *           the unbounded domain and they are otherwise invisible.
 *
 * An object bigger than a cell is inserted into every cell it overlaps, so a
 * query can meet it more than once; the result set is deduplicated by id and
 * the repeats are reported as `duplicateVisits`. That is the straddling
 * problem, and pretending it does not exist is how a grid starts returning
 * duplicates to its caller.
 *
 * Every query reports cells scanned, candidates tested and results returned.
 * The ratio of the middle to the last is the only number that says whether the
 * cell size is right.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SpatialHash = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const X_PRIME = 73856093;
  const Y_PRIME = 19349663;

  function mix(value) {
    let h = value >>> 0;
    h ^= h >>> 16;
    h = Math.imul(h, 0x85ebca6b) >>> 0;
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35) >>> 0;
    h ^= h >>> 16;
    return h >>> 0;
  }

  function emptyStats() {
    return {
      queries: 0,
      cellsScanned: 0,
      candidatesTested: 0,
      phantomCandidates: 0,
      duplicateVisits: 0,
      results: 0
    };
  }

  /** Points and boxes travel through one shape, so a query never branches. */
  function boxOf(item) {
    if (item.minX !== undefined) {
      return { minX: item.minX, minY: item.minY, maxX: item.maxX, maxY: item.maxY };
    }
    return { minX: item.x, minY: item.y, maxX: item.x, maxY: item.y };
  }

  function overlaps(box, rect) {
    return box.minX <= rect.maxX && box.maxX >= rect.minX &&
      box.minY <= rect.maxY && box.maxY >= rect.minY;
  }

  function withinRadius(item, centre, radius) {
    const box = boxOf(item);
    const dx = Math.max(box.minX - centre.x, 0, centre.x - box.maxX);
    const dy = Math.max(box.minY - centre.y, 0, centre.y - box.maxY);
    return dx * dx + dy * dy <= radius * radius;
  }

  function create(options) {
    const settings = options || {};
    const cellSize = Math.max(1e-9, settings.cellSize || 1);
    const mode = settings.mode === 'hash' ? 'hash' : 'grid';
    const bounds = settings.bounds || { minX: 0, minY: 0, maxX: 1000, maxY: 1000 };
    const cols = Math.max(1, Math.ceil((bounds.maxX - bounds.minX) / cellSize));
    const rows = Math.max(1, Math.ceil((bounds.maxY - bounds.minY) / cellSize));
    const bucketCount = mode === 'grid' ? cols * rows : Math.max(1, Math.floor(settings.buckets || 4096));
    const buckets = new Array(bucketCount);
    /* A grid covers exactly its bounds. Anything outside is held here and
       scanned by every query, rather than clamped onto the edge row - clamping
       makes two different cells share a bucket, which is the one thing the
       direct-addressed mode is supposed to be free of. */
    const outside = [];
    const seen = new Map();
    let stats = emptyStats();
    let items = 0;
    let placements = 0;
    let stamp = 0;

    function cellX(x) { return Math.floor((x - bounds.minX) / cellSize); }
    function cellY(y) { return Math.floor((y - bounds.minY) / cellSize); }

    /** In hash mode there is no edge, so every cell has a bucket; in grid mode
     *  a cell outside the domain has none and reports -1. */
    function bucketFor(cx, cy) {
      if (mode === 'grid') {
        if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) return -1;
        return cy * cols + cx;
      }
      return mix((Math.imul(cx, X_PRIME) ^ Math.imul(cy, Y_PRIME)) >>> 0) % bucketCount;
    }

    function place(item, cx, cy) {
      const index = bucketFor(cx, cy);
      if (index === -1) { if (outside.indexOf(item) === -1) outside.push(item); return; }
      if (!buckets[index]) buckets[index] = [];
      buckets[index].push({ cx: cx, cy: cy, item: item });
      placements += 1;
    }

    function insert(item) {
      const box = boxOf(item);
      const x0 = cellX(box.minX);
      const x1 = cellX(box.maxX);
      const y0 = cellY(box.minY);
      const y1 = cellY(box.maxY);

      for (let cy = y0; cy <= y1; cy += 1) {
        for (let cx = x0; cx <= x1; cx += 1) place(item, cx, cy);
      }

      items += 1;
      return item;
    }

    function insertAll(list) {
      list.forEach(insert);
      return items;
    }

    /** One scan of one cell, with the two kinds of wasted work counted apart. */
    function scanCell(cx, cy, collector) {
      const index = bucketFor(cx, cy);
      const bucket = index === -1 ? null : buckets[index];
      stats.cellsScanned += 1;
      if (!bucket) return;

      for (let i = 0; i < bucket.length; i += 1) {
        const entry = bucket[i];
        if (entry.cx !== cx || entry.cy !== cy) { stats.phantomCandidates += 1; continue; }
        if (seen.get(entry.item) === stamp) { stats.duplicateVisits += 1; continue; }
        seen.set(entry.item, stamp);
        stats.candidatesTested += 1;
        collector(entry.item);
      }
    }

    function sweep(rect, collector) {
      stamp += 1;
      stats.queries += 1;
      const x0 = cellX(rect.minX);
      const x1 = cellX(rect.maxX);
      const y0 = cellY(rect.minY);
      const y1 = cellY(rect.maxY);

      for (let cy = y0; cy <= y1; cy += 1) {
        for (let cx = x0; cx <= x1; cx += 1) scanCell(cx, cy, collector);
      }

      for (let i = 0; i < outside.length; i += 1) {
        stats.candidatesTested += 1;
        collector(outside[i]);
      }
    }

    function queryRange(rect) {
      const out = [];
      sweep(rect, function (item) { if (overlaps(boxOf(item), rect)) out.push(item); });
      stats.results += out.length;
      return out;
    }

    function queryRadius(centre, radius) {
      const rect = {
        minX: centre.x - radius, minY: centre.y - radius,
        maxX: centre.x + radius, maxY: centre.y + radius
      };
      const out = [];
      sweep(rect, function (item) { if (withinRadius(item, centre, radius)) out.push(item); });
      stats.results += out.length;
      return out;
    }

    /** The cells a query would touch, for drawing them. */
    function cellsFor(rect) {
      const out = [];
      for (let cy = cellY(rect.minY); cy <= cellY(rect.maxY); cy += 1) {
        for (let cx = cellX(rect.minX); cx <= cellX(rect.maxX); cx += 1) {
          out.push({
            cx: cx, cy: cy,
            minX: bounds.minX + cx * cellSize, minY: bounds.minY + cy * cellSize,
            maxX: bounds.minX + (cx + 1) * cellSize, maxY: bounds.minY + (cy + 1) * cellSize,
            count: (buckets[bucketFor(cx, cy)] || []).length
          });
        }
      }
      return out;
    }

    function occupancy() {
      let used = 0;
      let longest = 0;
      for (let i = 0; i < bucketCount; i += 1) {
        const length = buckets[i] ? buckets[i].length : 0;
        if (length) used += 1;
        if (length > longest) longest = length;
      }
      return {
        buckets: bucketCount,
        used: used,
        empty: bucketCount - used,
        longest: longest,
        placements: placements,
        meanPerUsed: used ? placements / used : 0,
        bytes: bucketCount * 8 + placements * 16
      };
    }

    return {
      mode: mode,
      cellSize: cellSize,
      cols: cols,
      rows: rows,
      insert: insert,
      insertAll: insertAll,
      queryRange: queryRange,
      queryRadius: queryRadius,
      cellsFor: cellsFor,
      occupancy: occupancy,
      size: function () { return items; },
      stats: function () { return Object.assign({}, stats); },
      resetStats: function () { stats = emptyStats(); }
    };
  }

  /**
   * What a uniform grid *should* cost, from density alone.
   *
   * A radius query scans every cell the query box touches, which is a square
   * of side 2r rounded out to whole cells, so the candidate count is the point
   * density times that area. Comparing this with the measured count is how you
   * find out that the data is not uniform - and on clustered data the measured
   * number is several times this one, which is exactly when a tree earns its
   * keep.
   */
  function expected(options) {
    const settings = options || {};
    const density = settings.count / settings.area;
    const cellSize = settings.cellSize;
    const radius = settings.radius;
    const cellsPerAxis = Math.ceil((2 * radius) / cellSize) + 1;
    const scannedArea = Math.pow(cellsPerAxis * cellSize, 2);

    return {
      density: density,
      cellsScanned: cellsPerAxis * cellsPerAxis,
      candidates: density * scannedArea,
      results: density * Math.PI * radius * radius,
      selectivity: (Math.PI * radius * radius) / scannedArea
    };
  }

  /**
   * The cell size that minimises work for a radius query.
   *
   * Too small and the query scans hundreds of nearly empty cells; too large
   * and each cell holds objects far outside the query. The scanned area is
   * ((2r rounded out to cells) + one cell)², which is minimised near c = r -
   * the rule of thumb "make the cell the query radius" written down.
   */
  function bestCellSize(options) {
    const settings = options || {};
    const radius = settings.radius;
    const steps = Math.max(4, Math.floor(settings.steps || 40));
    const rows = [];
    let best = null;

    for (let i = 1; i <= steps; i += 1) {
      const cellSize = (radius * 3 * i) / steps;
      const row = expected({
        count: settings.count, area: settings.area, cellSize: cellSize, radius: radius
      });
      row.cellSize = cellSize;
      row.work = row.cellsScanned + row.candidates;
      rows.push(row);
      if (!best || row.work < best.work) best = row;
    }

    return { rows: rows, best: best };
  }

  return { create: create, expected: expected, bestCellSize: bestCellSize };
}));

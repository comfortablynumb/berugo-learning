/**
 * One generator set, one brute-force oracle, one query runner - so every index
 * in M08 is measured the same way and every answer is checked.
 *
 * The rule this harness exists to enforce is that a spatial index is never
 * reported on its query cost alone. Every run carries the *exact* answer from
 * brute force alongside it, and a mismatch is a number in the result rather
 * than an exception, because a k-d tree with a broken backtrack returns a
 * plausible wrong point and nothing else in the system notices.
 *
 * The generators are deliberately unfriendly. Uniform data flatters a grid;
 * clustered data is what real data looks like; and collinear and coincident
 * points are the two inputs that turn a textbook quadtree into an infinite
 * recursion and a k-d tree into a linked list. An index that is only ever
 * measured on uniform points has not been measured.
 *
 * Nothing here touches the DOM.
 */
(function (root, factory) {
  const api = factory(root, typeof require === 'function' ? require : null);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SpatialLab = api;
}(typeof window !== 'undefined' ? window : null, function (scope, requireFn) {
  'use strict';

  function load(name, global) {
    if (scope && scope[global]) return scope[global];
    return requireFn ? requireFn(name) : null;
  }

  function Random() { return load('../utils/random.js', 'Random'); }
  function SpatialHash() { return load('../algorithms/spatial-hash.js', 'SpatialHash'); }
  function Quadtree() { return load('../algorithms/quadtree.js', 'Quadtree'); }
  function KdTree() { return load('../algorithms/kd-tree.js', 'KdTree'); }
  function RTree() { return load('../algorithms/r-tree.js', 'RTree'); }
  function Bvh() { return load('../algorithms/bvh.js', 'Bvh'); }

  const BOUNDS = { minX: 0, minY: 0, maxX: 1000, maxY: 1000 };

  function pointAt(id, x, y) {
    return { id: id, x: x, y: y, p: [x, y] };
  }

  function asRectangle(item) {
    if (item.minX !== undefined) return item;
    return { id: item.id, minX: item.x, minY: item.y, maxX: item.x, maxY: item.y, point: item };
  }

  /* -------------------------------------------------------- generators */

  const KINDS = {
    uniform: function (random, bounds) {
      return [
        bounds.minX + random.next() * (bounds.maxX - bounds.minX),
        bounds.minY + random.next() * (bounds.maxY - bounds.minY)
      ];
    },
    collinear: function (random, bounds) {
      const t = random.next();
      return [bounds.minX + t * (bounds.maxX - bounds.minX), bounds.minY + t * (bounds.maxY - bounds.minY)];
    }
  };

  function clamp(value, low, high) {
    return Math.min(high, Math.max(low, value));
  }

  function clusteredPoint(random, bounds, spread) {
    const centreX = bounds.minX + random.next() * (bounds.maxX - bounds.minX);
    const centreY = bounds.minY + random.next() * (bounds.maxY - bounds.minY);
    return [
      clamp(random.gaussian(centreX, spread), bounds.minX, bounds.maxX),
      clamp(random.gaussian(centreY, spread), bounds.minY, bounds.maxY)
    ];
  }

  /**
   * `clustered` puts every point in one of `clusters` gaussian blobs, which is
   * where a grid falls apart: the mean density is unchanged and the density a
   * query actually meets is twenty times it.
   */
  function points(options) {
    const settings = options || {};
    const count = Math.max(1, Math.floor(settings.count || 1000));
    const bounds = settings.bounds || BOUNDS;
    const kind = settings.kind || 'uniform';
    const random = Random().seeded(settings.seed || 1);
    const out = new Array(count);

    if (kind === 'clustered') return clusteredPoints({ count: count, bounds: bounds, random: random, spread: settings.spread });
    if (kind === 'coincident') return coincidentPoints({ count: count, bounds: bounds, random: random, distinct: settings.distinct });
    if (kind === 'grid') return gridPoints(count, bounds);

    const make = KINDS[kind];
    if (!make) throw new Error('SpatialLab: unknown point kind "' + kind + '"');
    for (let i = 0; i < count; i += 1) {
      const coords = make(random, bounds);
      out[i] = pointAt(i, coords[0], coords[1]);
    }
    return out;
  }

  function clusteredPoints(config) {
    const clusters = Math.max(1, Math.round(Math.sqrt(config.count) / 4));
    const spread = config.spread || (config.bounds.maxX - config.bounds.minX) / 60;
    const centres = [];
    for (let i = 0; i < clusters; i += 1) centres.push(clusteredPoint(config.random, config.bounds, 0));
    const out = new Array(config.count);

    for (let i = 0; i < config.count; i += 1) {
      const centre = centres[config.random.int(clusters)];
      out[i] = pointAt(i,
        clamp(config.random.gaussian(centre[0], spread), config.bounds.minX, config.bounds.maxX),
        clamp(config.random.gaussian(centre[1], spread), config.bounds.minY, config.bounds.maxY));
    }
    return out;
  }

  /** The quadtree killer: a handful of distinct locations, every point sitting
   *  exactly on one of them. No subdivision ever separates them. */
  function coincidentPoints(config) {
    const distinct = Math.max(1, Math.floor(config.distinct || 4));
    const sites = [];
    for (let i = 0; i < distinct; i += 1) sites.push(KINDS.uniform(config.random, config.bounds));
    const out = new Array(config.count);
    for (let i = 0; i < config.count; i += 1) {
      const site = sites[i % distinct];
      out[i] = pointAt(i, site[0], site[1]);
    }
    return out;
  }

  function gridPoints(count, bounds) {
    const side = Math.max(1, Math.round(Math.sqrt(count)));
    const stepX = (bounds.maxX - bounds.minX) / side;
    const stepY = (bounds.maxY - bounds.minY) / side;
    const out = [];
    for (let y = 0; y < side && out.length < count; y += 1) {
      for (let x = 0; x < side && out.length < count; x += 1) {
        out.push(pointAt(out.length, bounds.minX + (x + 0.5) * stepX, bounds.minY + (y + 0.5) * stepY));
      }
    }
    return out;
  }

  function rectangles(options) {
    const settings = options || {};
    const count = Math.max(1, Math.floor(settings.count || 1000));
    const bounds = settings.bounds || BOUNDS;
    const size = settings.size || 12;
    const spread = settings.kind === 'clustered';
    const centres = points({ count: count, bounds: bounds, seed: settings.seed || 1, kind: spread ? 'clustered' : 'uniform' });
    const random = Random().seeded((settings.seed || 1) + 977);

    return centres.map(function (centre, index) {
      const width = size * (0.4 + random.next() * 1.6);
      const height = size * (0.4 + random.next() * 1.6);
      return {
        id: index,
        minX: centre.x - width / 2, minY: centre.y - height / 2,
        maxX: centre.x + width / 2, maxY: centre.y + height / 2
      };
    });
  }

  function queries(options) {
    const settings = options || {};
    return points({
      count: settings.count || 200, bounds: settings.bounds || BOUNDS,
      seed: (settings.seed || 1) + 12345, kind: settings.kind || 'uniform'
    });
  }

  function windows(options) {
    const settings = options || {};
    const side = settings.side || 40;
    return queries(settings).map(function (centre) {
      return {
        id: centre.id,
        minX: centre.x - side / 2, minY: centre.y - side / 2,
        maxX: centre.x + side / 2, maxY: centre.y + side / 2
      };
    });
  }

  /* ------------------------------------------------------------ oracles */

  function bruteRadius(list, centre, radius) {
    return list.filter(function (point) {
      const dx = point.x - centre.x;
      const dy = point.y - centre.y;
      return dx * dx + dy * dy <= radius * radius;
    });
  }

  function bruteRange(list, rect) {
    return list.filter(function (item) {
      const box = item.minX === undefined
        ? { minX: item.x, minY: item.y, maxX: item.x, maxY: item.y }
        : item;
      return box.minX <= rect.maxX && box.maxX >= rect.minX && box.minY <= rect.maxY && box.maxY >= rect.minY;
    });
  }

  function bruteNearest(list, query, k) {
    const wanted = Math.max(1, Math.floor(k || 1));
    return list.map(function (point) {
      const dx = point.x - query.x;
      const dy = point.y - query.y;
      return { point: point, distance: Math.sqrt(dx * dx + dy * dy) };
    }).sort(function (a, b) { return a.distance - b.distance; }).slice(0, wanted);
  }

  /** Set difference by id, so an index returning duplicates is caught too. */
  function disagreement(found, expected) {
    const seen = new Map();
    found.forEach(function (item) { seen.set(item.id, (seen.get(item.id) || 0) + 1); });
    const truth = new Set(expected.map(function (item) { return item.id; }));
    let missing = 0;
    let extra = 0;
    let duplicated = 0;

    truth.forEach(function (id) { if (!seen.has(id)) missing += 1; });
    seen.forEach(function (times, id) {
      if (!truth.has(id)) extra += 1;
      if (times > 1) duplicated += times - 1;
    });

    return { missing: missing, extra: extra, duplicated: duplicated, ok: !missing && !extra && !duplicated };
  }

  /* ------------------------------------------------------- query runner */

  /**
   * Runs one index over one query set and reports the four numbers that make a
   * spatial index comparable: work done, work wasted, answers returned, and
   * answers wrong. `wrong` is always computed - the oracle is cheap next to
   * the honesty it buys.
   */
  function runQueries(options) {
    const settings = options || {};
    const index = settings.index;
    const list = settings.points;
    const radius = settings.radius;
    const centres = settings.queries;
    index.resetStats();
    let results = 0;
    let wrong = 0;
    let missing = 0;

    centres.forEach(function (centre) {
      const found = radius === undefined ? index.queryRange(centre) : index.queryRadius(centre, radius);
      const expected = radius === undefined ? bruteRange(list, centre) : bruteRadius(list, centre, radius);
      const verdict = disagreement(found, expected);
      if (!verdict.ok) wrong += 1;
      missing += verdict.missing;
      results += found.length;
    });

    const stats = index.stats();
    return Object.assign({}, stats, {
      queries: centres.length,
      results: results,
      resultsPerQuery: results / centres.length,
      wrong: wrong,
      missing: missing,
      candidatesPerResult: results ? stats.candidatesTested / results : Infinity,
      candidatesPerQuery: stats.candidatesTested / centres.length
    });
  }

  /* ------------------------------------------------------- 8.1 the grid */

  /**
   * The cell-size sweep. The measured minimum is the answer to "how big should
   * a cell be", and it lands near the query radius on uniform data and
   * somewhere else entirely on clustered data - which is the section's point.
   */
  function cellSweep(options) {
    const settings = options || {};
    const list = settings.points;
    const centres = settings.queries;
    const radius = settings.radius || 25;
    const bounds = settings.bounds || BOUNDS;
    const rows = [];

    (settings.cellSizes || [5, 10, 15, 20, 25, 35, 50, 75, 100, 150, 200]).forEach(function (cellSize) {
      const index = SpatialHash().create({ cellSize: cellSize, bounds: bounds, mode: settings.mode || 'grid' });
      index.insertAll(list);
      const run = runQueries({ index: index, points: list, queries: centres, radius: radius });
      const predicted = SpatialHash().expected({
        count: list.length, area: (bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY),
        cellSize: cellSize, radius: radius
      });
      rows.push(Object.assign(run, {
        cellSize: cellSize,
        occupancy: index.occupancy(),
        predictedCandidates: predicted.candidates,
        predictedCells: predicted.cellsScanned,
        work: run.cellsScanned / centres.length + run.candidatesPerQuery
      }));
    });

    let best = rows[0];
    rows.forEach(function (row) { if (row.work < best.work) best = row; });
    return { rows: rows, best: best, radius: radius };
  }

  /* --------------------------------------------------- 8.2-8.4 indexes */

  const BUILDERS = {
    grid: function (list, config) {
      const index = SpatialHash().create({ cellSize: config.cellSize || 25, bounds: config.bounds, mode: 'grid' });
      index.insertAll(list);
      return index;
    },
    hash: function (list, config) {
      const index = SpatialHash().create({
        cellSize: config.cellSize || 25, bounds: config.bounds, mode: 'hash',
        buckets: config.buckets || Math.max(64, list.length)
      });
      index.insertAll(list);
      return index;
    },
    quadtree: function (list, config) {
      const index = Quadtree().create({
        bounds: config.bounds, capacity: config.capacity || 8, maxDepth: config.maxDepth || 12
      });
      index.insertAll(list);
      return index;
    },
    kdtree: function (list, config) {
      return KdTree().build(list, { leafSize: config.leafSize || 8, pruneWith: config.pruneWith });
    },
    /* Points enter an R-tree as degenerate rectangles. Feeding it raw points
       leaves every MBR at NaN and every query empty, which looks like a
       pruning triumph until the oracle disagrees. */
    rtree: function (list, config) {
      const index = RTree().create({ maxEntries: config.maxEntries || 9, split: config.split || 'quadratic' });
      index.insertAll(list.map(asRectangle));
      return index;
    }
  };

  function buildIndex(kind, list, config) {
    const builder = BUILDERS[kind];
    if (!builder) throw new Error('SpatialLab: unknown index "' + kind + '"');
    return builder(list, config || { bounds: BOUNDS });
  }

  /**
   * The same points, the same queries, every index. Reported as candidates per
   * result rather than raw counts, because that is the number that is
   * comparable across structures with completely different node shapes.
   */
  function compareIndexes(options) {
    const settings = options || {};
    const list = settings.points;
    const centres = settings.queries;
    const config = { bounds: settings.bounds || BOUNDS, cellSize: settings.cellSize, capacity: settings.capacity };

    return (settings.kinds || ['grid', 'quadtree', 'kdtree']).map(function (kind) {
      const index = buildIndex(kind, list, config);
      const run = runQueries({ index: index, points: list, queries: centres, radius: settings.radius || 25 });
      return Object.assign(run, {
        kind: kind,
        shape: index.shape ? index.shape() : index.occupancy(),
        bytes: index.shape ? index.shape().bytes : index.occupancy().bytes
      });
    });
  }

  /* ------------------------------------------------ 8.3 nearest and dims */

  /**
   * Nearest-neighbour correctness, which is the property the whole section is
   * about: a tree with the backtrack removed still answers, and only a
   * comparison against brute force over many queries tells you it is lying.
   */
  function nearestRun(options) {
    const settings = options || {};
    const list = settings.points;
    const tree = KdTree().build(list, { leafSize: settings.leafSize || 8 });
    const centres = settings.queries;
    const k = Math.max(1, Math.floor(settings.k || 1));
    /* Verifying against brute force costs n log n per query and dwarfs the
       tree it is checking, so there are two modes. Without `reference` the
       oracle is brute force over a prefix of the queries - the test suite
       passes the whole set. With `reference` - the distances an already
       verified exact run produced - every query is checked for free, which is
       what lets the demo score the deliberately broken descent over its whole
       query set rather than a sample of it. */
    const reference = settings.reference || null;
    const checked = reference ? centres.length
      : (settings.verify === undefined ? centres.length : Math.min(centres.length, settings.verify));
    const distances = new Array(centres.length);
    tree.resetStats();
    let wrong = 0;
    let totalDistance = 0;

    centres.forEach(function (centre, index) {
      const found = tree.kNearest(centre.p, k, settings.pruneWith);
      distances[index] = found.map(function (entry) { return entry.distance; });
      totalDistance += found.length ? found[0].distance : 0;
      if (index >= checked) return;
      const truth = reference ? reference[index] : bruteNearest(list, centre, k).map(function (entry) {
        return entry.distance;
      });
      for (let i = 0; i < truth.length; i += 1) {
        if (distances[index][i] === undefined || Math.abs(distances[index][i] - truth[i]) > 1e-9) {
          wrong += 1;
          break;
        }
      }
    });

    const stats = tree.stats();
    return Object.assign({}, stats, {
      queries: centres.length,
      verified: checked,
      verifiedAgainst: reference ? 'an exact run' : 'brute force',
      distances: distances,
      wrong: wrong,
      k: k,
      shape: tree.shape(),
      pruneWith: settings.pruneWith || 'plane',
      meanNearest: totalDistance / centres.length,
      distancesPerQuery: stats.distanceComputations / centres.length,
      scanFraction: stats.distanceComputations / (centres.length * list.length)
    });
  }

  /**
   * The curse of dimensionality, measured: the fraction of the data a k-d tree
   * still has to touch as the dimension rises. It is a fraction rather than a
   * count so the numbers are comparable, and it climbs to essentially 1.
   */
  function dimensionSweep(options) {
    const settings = options || {};
    const count = Math.max(16, Math.floor(settings.count || 4000));
    const queryCount = Math.max(1, Math.floor(settings.queries || 50));

    return (settings.dims || [2, 4, 8, 16, 32, 64]).map(function (dims) {
      const random = Random().seeded((settings.seed || 1) + dims);
      const list = [];
      for (let i = 0; i < count; i += 1) {
        const v = [];
        for (let d = 0; d < dims; d += 1) v.push(random.next());
        list.push({ id: i, p: v });
      }
      const tree = KdTree().build(list, { leafSize: 8 });
      tree.resetStats();
      for (let q = 0; q < queryCount; q += 1) {
        const v = [];
        for (let d = 0; d < dims; d += 1) v.push(random.next());
        tree.nearest(v);
      }
      const stats = tree.stats();
      return {
        dims: dims,
        distancesPerQuery: stats.distanceComputations / queryCount,
        scanFraction: stats.distanceComputations / (queryCount * count),
        prunedPerQuery: stats.nodesPruned / queryCount,
        nodes: tree.shape().nodes
      };
    });
  }

  /* --------------------------------------------------------- 8.5 scenes */

  /** A triangle soup with a controllable clumpiness, so the SAH has something
   *  to be right about: on uniform triangles it barely beats a median split. */
  function scene(options) {
    const settings = options || {};
    const count = Math.max(1, Math.floor(settings.count || 2000));
    const random = Random().seeded(settings.seed || 1);
    const extent = settings.extent || 100;
    const size = settings.size || 2;
    const clumps = Math.max(1, Math.floor(settings.clumps || 1));
    const centres = [];

    for (let i = 0; i < clumps; i += 1) {
      centres.push([random.next() * extent, random.next() * extent, random.next() * extent]);
    }

    const out = [];
    for (let i = 0; i < count; i += 1) {
      const centre = centres[random.int(clumps)];
      const spread = clumps > 1 ? extent / (6 * Math.sqrt(clumps)) : extent / 2;
      const base = [0, 1, 2].map(function (axis) {
        return clamp(random.gaussian(centre[axis], spread), 0, extent);
      });
      out.push(Bvh().triangle(i, [0, 1, 2].map(function () {
        return base.map(function (value) { return value + (random.next() - 0.5) * size; });
      })));
    }
    return out;
  }

  function rays(options) {
    const settings = options || {};
    const count = Math.max(1, Math.floor(settings.count || 500));
    const extent = settings.extent || 100;
    const random = Random().seeded((settings.seed || 1) + 31);
    const out = [];

    for (let i = 0; i < count; i += 1) {
      const origin = [random.next() * extent, random.next() * extent, -extent];
      const target = [random.next() * extent, random.next() * extent, extent * 2];
      const delta = [0, 1, 2].map(function (axis) { return target[axis] - origin[axis]; });
      const length = Math.sqrt(delta.reduce(function (total, value) { return total + value * value; }, 0));
      out.push({ origin: origin, direction: delta.map(function (value) { return value / length; }) });
    }
    return out;
  }

  return {
    BOUNDS: BOUNDS,
    points: points,
    rectangles: rectangles,
    queries: queries,
    windows: windows,
    asRectangle: asRectangle,
    bruteRadius: bruteRadius,
    bruteRange: bruteRange,
    bruteNearest: bruteNearest,
    disagreement: disagreement,
    runQueries: runQueries,
    cellSweep: cellSweep,
    buildIndex: buildIndex,
    compareIndexes: compareIndexes,
    nearestRun: nearestRun,
    dimensionSweep: dimensionSweep,
    scene: scene,
    rays: rays
  };
}));

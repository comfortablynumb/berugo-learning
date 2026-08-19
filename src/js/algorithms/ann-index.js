/**
 * Approximate nearest neighbours in high dimensions: brute force, a VP-tree,
 * an IVF index and product quantisation.
 *
 * Every structure here answers the same query - the k nearest vectors - and
 * only the first is exact. That is the subject: past about ten dimensions an
 * exact tree stops pruning, because the volume of a ball of radius r is a
 * vanishing fraction of the cube that contains it and almost every subtree
 * ends up inside the search radius. A k-d tree in 64 dimensions visits
 * essentially every leaf, so it is a linear scan with pointer chasing added.
 *
 * Once exactness is gone, *recall* becomes the quantity that has to be
 * reported. An index that returns nine of the ten true neighbours is not
 * "slightly slower"; it is a different answer, and the only honest way to
 * describe it is a recall figure measured against brute force on the same
 * data. Every structure here therefore reports both its cost (distance
 * computations) and its recall, and the demo plots one against the other.
 *
 * Vectors are `{ id, v: [..] }`. The metric is squared Euclidean throughout -
 * monotone in Euclidean distance, so rankings are identical and no square root
 * is paid per comparison.
 */
(function (root, factory) {
  const api = factory(root, typeof require === 'function' ? require : null);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AnnIndex = api;
}(typeof window !== 'undefined' ? window : null, function (scope, requireFn) {
  'use strict';

  function randomLib() {
    if (scope && scope.Random) return scope.Random;
    return requireFn ? requireFn('../utils/random.js') : null;
  }

  function emptyStats() {
    return { queries: 0, distanceComputations: 0, nodesVisited: 0, nodesPruned: 0, listsProbed: 0 };
  }

  function distanceSquared(a, b) {
    let total = 0;
    for (let i = 0; i < a.length; i += 1) {
      const d = a[i] - b[i];
      total += d * d;
    }
    return total;
  }

  /** A sorted top-k. Below a few dozen neighbours this beats a heap and keeps
   *  the pruning bound - the worst kept distance - at a known index. */
  function topK(k) {
    const best = [];
    return {
      offer: function (id, distance) {
        if (best.length === k && distance >= best[best.length - 1].distance) return;
        let at = best.length;
        while (at > 0 && best[at - 1].distance > distance) at -= 1;
        best.splice(at, 0, { id: id, distance: distance });
        if (best.length > k) best.pop();
      },
      worst: function () { return best.length < k ? Infinity : best[best.length - 1].distance; },
      list: function () { return best; }
    };
  }

  /* --------------------------------------------------------- brute force */

  function bruteForce(vectors) {
    let stats = emptyStats();

    function search(query, k) {
      const best = topK(Math.max(1, k || 1));
      stats.queries += 1;
      vectors.forEach(function (vector) {
        stats.distanceComputations += 1;
        best.offer(vector.id, distanceSquared(vector.v, query));
      });
      return best.list();
    }

    return {
      kind: 'brute-force',
      search: search,
      bytes: function () { return vectors.length * (vectors[0] ? vectors[0].v.length * 8 : 0); },
      size: function () { return vectors.length; },
      stats: function () { return Object.assign({}, stats); },
      resetStats: function () { stats = emptyStats(); }
    };
  }

  /* ------------------------------------------------------------ VP-tree */

  /**
   * A vantage-point tree needs only a metric, not coordinates - which is the
   * reason to know it: it indexes edit distance, Jaccard, anything obeying the
   * triangle inequality. Each node picks a vantage point and the median radius
   * around it, and the triangle inequality prunes the outer half when
   * d(q, vp) + bound < radius (and the inner half symmetrically).
   */
  function vpTree(vectors, options) {
    const settings = options || {};
    const leafSize = Math.max(1, Math.floor(settings.leafSize || 8));
    const random = randomLib().seeded(settings.seed || 1);
    const counters = { nodes: 0, distanceComputations: 0 };
    const tree = vectors.length ? partition(vectors.slice()) : null;
    let stats = emptyStats();

    function partition(list) {
      counters.nodes += 1;
      if (list.length <= leafSize) return { leaf: true, points: list };

      const pivotAt = random.int(list.length);
      const vantage = list[pivotAt];
      const rest = list.filter(function (item, index) { return index !== pivotAt; });
      const scored = rest.map(function (item) {
        counters.distanceComputations += 1;
        return { item: item, distance: distanceSquared(item.v, vantage.v) };
      }).sort(function (a, b) { return a.distance - b.distance; });

      const mid = scored.length >> 1;
      return {
        leaf: false,
        vantage: vantage,
        radius: scored.length ? scored[mid].distance : 0,
        inner: scored.length ? partition(scored.slice(0, mid).map(pluck)) : null,
        outer: scored.length ? partition(scored.slice(mid).map(pluck)) : null
      };
    }

    function pluck(entry) { return entry.item; }

    function search(query, k) {
      const best = topK(Math.max(1, k || 1));
      stats.queries += 1;
      if (tree) descend(tree, query, best);
      return best.list();
    }

    function descend(node, query, best) {
      stats.nodesVisited += 1;
      if (node.leaf) {
        node.points.forEach(function (point) {
          stats.distanceComputations += 1;
          best.offer(point.id, distanceSquared(point.v, query));
        });
        return;
      }

      stats.distanceComputations += 1;
      const distance = distanceSquared(node.vantage.v, query);
      best.offer(node.vantage.id, distance);

      /* The bound is in *distance*, not squared distance, so the triangle
         inequality applies; squaring back keeps the comparison in one unit. */
      const bound = Math.sqrt(best.worst());
      const middle = Math.sqrt(node.radius);
      const here = Math.sqrt(distance);
      const first = here < middle ? node.inner : node.outer;
      const second = here < middle ? node.outer : node.inner;

      if (first) descend(first, query, best);
      if (!second) return;
      if (Math.abs(here - middle) <= bound) descend(second, query, best);
      else stats.nodesPruned += 1;
    }

    return {
      kind: 'vp-tree',
      search: search,
      shape: function () { return { nodes: counters.nodes, buildDistances: counters.distanceComputations }; },
      bytes: function () { return counters.nodes * 40 + vectors.length * (vectors[0] ? vectors[0].v.length * 8 : 0); },
      size: function () { return vectors.length; },
      stats: function () { return Object.assign({}, stats); },
      resetStats: function () { stats = emptyStats(); }
    };
  }

  /* ------------------------------------------------------------ k-means */

  /** Lloyd's algorithm with a seeded pick of distinct initial centres. Good
   *  enough for both the IVF partition and each product-quantiser subspace,
   *  and deliberately not k-means++: the demo has to be reproducible and the
   *  initialisation is not what the section is about. */
  function kmeans(points, options) {
    const settings = options || {};
    const clusters = Math.max(1, Math.min(points.length, Math.floor(settings.clusters || 8)));
    const iterations = Math.max(1, Math.floor(settings.iterations || 12));
    const random = randomLib().seeded(settings.seed || 1);
    const dims = points.length ? points[0].length : 0;
    const centres = random.shuffle(points).slice(0, clusters).map(function (point) { return point.slice(); });
    let assignment = new Int32Array(points.length);
    let moved = 0;

    for (let round = 0; round < iterations; round += 1) {
      moved = assign(points, centres, assignment);
      recentre(points, centres, assignment, dims);
      if (!moved) break;
    }

    return { centres: centres, assignment: assignment, clusters: clusters, converged: !moved };
  }

  function assign(points, centres, assignment) {
    let moved = 0;
    for (let i = 0; i < points.length; i += 1) {
      let bestAt = 0;
      let bestDistance = Infinity;
      for (let c = 0; c < centres.length; c += 1) {
        const distance = distanceSquared(points[i], centres[c]);
        if (distance < bestDistance) { bestDistance = distance; bestAt = c; }
      }
      if (assignment[i] !== bestAt) moved += 1;
      assignment[i] = bestAt;
    }
    return moved;
  }

  function recentre(points, centres, assignment, dims) {
    const sums = centres.map(function () { return new Float64Array(dims); });
    const counts = new Int32Array(centres.length);

    for (let i = 0; i < points.length; i += 1) {
      const c = assignment[i];
      counts[c] += 1;
      for (let d = 0; d < dims; d += 1) sums[c][d] += points[i][d];
    }

    for (let c = 0; c < centres.length; c += 1) {
      if (!counts[c]) continue;
      for (let d = 0; d < dims; d += 1) centres[c][d] = sums[c][d] / counts[c];
    }
  }

  /* ---------------------------------------------------------------- IVF */

  /**
   * Inverted file: partition the vectors by k-means, then search only the
   * `probe` nearest partitions. The recall failure is structural rather than
   * random - a true neighbour on the far side of a cell boundary is invisible
   * however many vectors the probed lists hold - which is why raising `probe`
   * helps and raising the list count alone does not.
   */
  function ivf(vectors, options) {
    const settings = options || {};
    const model = kmeans(vectors.map(function (item) { return item.v; }), {
      clusters: settings.lists || 32, iterations: settings.iterations || 12, seed: settings.seed || 1
    });
    const lists = model.centres.map(function () { return []; });
    vectors.forEach(function (vector, index) { lists[model.assignment[index]].push(vector); });
    let stats = emptyStats();

    function search(query, k, probe) {
      const wanted = Math.max(1, Math.min(lists.length, Math.floor(probe || 1)));
      const best = topK(Math.max(1, k || 1));
      stats.queries += 1;

      const ranked = model.centres.map(function (centre, index) {
        stats.distanceComputations += 1;
        return { index: index, distance: distanceSquared(centre, query) };
      }).sort(function (a, b) { return a.distance - b.distance; });

      ranked.slice(0, wanted).forEach(function (entry) {
        stats.listsProbed += 1;
        lists[entry.index].forEach(function (vector) {
          stats.distanceComputations += 1;
          best.offer(vector.id, distanceSquared(vector.v, query));
        });
      });

      return best.list();
    }

    return {
      kind: 'ivf',
      search: search,
      shape: function () {
        const sizes = lists.map(function (list) { return list.length; });
        return {
          lists: lists.length,
          largest: Math.max.apply(null, sizes),
          smallest: Math.min.apply(null, sizes),
          empty: sizes.filter(function (size) { return !size; }).length,
          converged: model.converged
        };
      },
      bytes: function () {
        const dims = vectors[0] ? vectors[0].v.length : 0;
        return vectors.length * dims * 8 + model.centres.length * dims * 8;
      },
      size: function () { return vectors.length; },
      stats: function () { return Object.assign({}, stats); },
      resetStats: function () { stats = emptyStats(); }
    };
  }

  /* ------------------------------------------------ product quantisation */

  /**
   * Split each vector into `parts` sub-vectors, cluster each subspace
   * separately, and store one byte per part instead of the coordinates. A
   * 64-dimensional float vector is 512 bytes; eight parts with 256 centroids
   * each is 8. The distance is then *asymmetric*: the query stays exact and
   * only the stored side is quantised, which costs one lookup table per query
   * and is far more accurate than quantising both sides.
   */
  function productQuantiser(vectors, options) {
    const settings = options || {};
    const dims = vectors.length ? vectors[0].v.length : 0;
    const parts = Math.max(1, Math.min(dims, Math.floor(settings.parts || 8)));
    const width = Math.ceil(dims / parts);
    /* One byte per part is the whole point, so the codebook cannot exceed 256
       entries: a 9-bit code would make the stored side wider than the saving. */
    const centroidCount = Math.max(2, Math.min(256, Math.floor(settings.centroids || 64)));
    const books = [];
    const codes = new Uint8Array(vectors.length * parts);
    let stats = emptyStats();

    function sliceOf(vector, part) {
      return Array.prototype.slice.call(vector, part * width, Math.min(dims, (part + 1) * width));
    }

    for (let part = 0; part < parts; part += 1) {
      const slices = vectors.map(function (vector) { return sliceOf(vector.v, part); });
      const model = kmeans(slices, {
        clusters: centroidCount, iterations: settings.iterations || 10, seed: (settings.seed || 1) + part
      });
      books.push(model.centres);
      for (let i = 0; i < vectors.length; i += 1) codes[i * parts + part] = model.assignment[i];
    }

    /** One table per query: distance from each query sub-vector to each
     *  centroid, so a candidate costs `parts` array reads and no arithmetic
     *  over the original dimension at all. */
    function tableFor(query) {
      const table = [];
      for (let part = 0; part < parts; part += 1) {
        const slice = sliceOf(query, part);
        table.push(books[part].map(function (centre) {
          stats.distanceComputations += 1;
          return distanceSquared(slice, centre);
        }));
      }
      return table;
    }

    function search(query, k) {
      const best = topK(Math.max(1, k || 1));
      const table = tableFor(query);
      stats.queries += 1;

      for (let i = 0; i < vectors.length; i += 1) {
        let total = 0;
        for (let part = 0; part < parts; part += 1) total += table[part][codes[i * parts + part]];
        best.offer(vectors[i].id, total);
      }

      return best.list();
    }

    return {
      kind: 'product-quantiser',
      search: search,
      parts: parts,
      centroids: centroidCount,
      bytesPerVector: parts,
      bytes: function () {
        return codes.length + books.reduce(function (total, book) {
          return total + book.length * book[0].length * 8;
        }, 0);
      },
      size: function () { return vectors.length; },
      stats: function () { return Object.assign({}, stats); },
      resetStats: function () { stats = emptyStats(); }
    };
  }

  /* --------------------------------------------------------------- recall */

  /**
   * Recall at k against an exact answer, plus the two numbers that make it
   * meaningful: how many distance computations bought it, and whether the top
   * result itself was right. A structure with 90% recall that misses the
   * nearest neighbour every time is a different product from one that misses
   * the tenth.
   */
  function recall(approximate, exact) {
    const truth = new Set(exact.map(function (entry) { return entry.id; }));
    const found = approximate.filter(function (entry) { return truth.has(entry.id); }).length;
    return {
      recall: exact.length ? found / exact.length : 1,
      found: found,
      wanted: exact.length,
      topHit: !!(approximate[0] && exact[0] && approximate[0].id === exact[0].id)
    };
  }

  return {
    bruteForce: bruteForce,
    vpTree: vpTree,
    ivf: ivf,
    productQuantiser: productQuantiser,
    kmeans: kmeans,
    recall: recall,
    distanceSquared: distanceSquared,
    topK: topK
  };
}));

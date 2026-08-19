/**
 * Vector search measured the only way that means anything: recall against
 * brute force, plotted against the work that bought it.
 *
 * Every index here is asked the same queries over the same vectors, and every
 * row carries three numbers - recall at k, distance computations per query,
 * and bytes. Reporting any one of them alone is how "the search got worse"
 * ships silently: an index tuned for latency at 70% recall looks excellent on
 * a latency dashboard and returns the wrong answer three times in ten.
 *
 * The vectors are clustered rather than uniform, because uniform vectors in
 * high dimensions are the case where *every* structure fails identically -
 * all pairwise distances concentrate, there is no nearest neighbour worth
 * finding, and a recall number measured there says nothing about a corpus of
 * embeddings, which is clustered by construction.
 */
(function (root, factory) {
  const api = factory(root, typeof require === 'function' ? require : null);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.VectorLab = api;
}(typeof window !== 'undefined' ? window : null, function (scope, requireFn) {
  'use strict';

  function load(name, global) {
    if (scope && scope[global]) return scope[global];
    return requireFn ? requireFn(name) : null;
  }

  function Random() { return load('../utils/random.js', 'Random'); }
  function AnnIndex() { return load('../algorithms/ann-index.js', 'AnnIndex'); }
  function Hnsw() { return load('../algorithms/hnsw.js', 'Hnsw'); }

  /** `clusters` gaussian blobs on the unit cube. `spread` is the dial that
   *  decides whether nearest-neighbour search is a meaningful question at all. */
  function vectors(options) {
    const settings = options || {};
    const count = Math.max(1, Math.floor(settings.count || 5000));
    const dims = Math.max(1, Math.floor(settings.dims || 32));
    const clusters = Math.max(1, Math.floor(settings.clusters || 24));
    const spread = settings.spread === undefined ? 0.12 : settings.spread;
    const random = Random().seeded(settings.seed || 1);
    const centres = [];

    for (let c = 0; c < clusters; c += 1) {
      const centre = new Array(dims);
      for (let d = 0; d < dims; d += 1) centre[d] = random.next();
      centres.push(centre);
    }

    const out = new Array(count);
    for (let i = 0; i < count; i += 1) {
      const centre = centres[random.int(clusters)];
      const v = new Array(dims);
      for (let d = 0; d < dims; d += 1) v[d] = centre[d] + random.gaussian(0, spread);
      out[i] = { id: i, v: v };
    }
    return out;
  }

  function queries(options) {
    const settings = options || {};
    return vectors({
      count: settings.count || 100, dims: settings.dims || 32,
      clusters: settings.clusters || 24, spread: settings.spread,
      seed: (settings.seed || 1) + 20001
    }).map(function (item) { return item.v; });
  }

  /** Exact answers once, reused by every scored run - the oracle is the most
   *  expensive thing in the file and recomputing it per index doubles nothing
   *  but the wait. */
  function truthFor(list, questions, k) {
    const exact = AnnIndex().bruteForce(list);
    return {
      index: exact,
      answers: questions.map(function (query) { return exact.search(query, k); }),
      distancesPerQuery: exact.stats().distanceComputations / questions.length
    };
  }

  function score(index, questions, truth, k) {
    index.resetStats();
    let recallTotal = 0;
    let topHits = 0;

    questions.forEach(function (query, i) {
      const found = index.search(query, k);
      const verdict = AnnIndex().recall(found, truth.answers[i]);
      recallTotal += verdict.recall;
      if (verdict.topHit) topHits += 1;
    });

    const stats = index.stats();
    return {
      kind: index.kind,
      recall: recallTotal / questions.length,
      topHitRate: topHits / questions.length,
      distancesPerQuery: stats.distanceComputations / questions.length,
      bytes: index.bytes(),
      bytesPerVector: index.bytes() / index.size()
    };
  }

  /**
   * The recall/latency curve for one index family. `ef` for HNSW, `probe` for
   * IVF: both are query-time dials, which is the property that makes them
   * usable - the same index serves a cheap request and an accurate one.
   */
  function sweep(options) {
    const settings = options || {};
    const list = settings.vectors;
    const questions = settings.queries;
    const k = Math.max(1, Math.floor(settings.k || 10));
    const truth = settings.truth || truthFor(list, questions, k);
    const index = settings.index;
    const dial = settings.dial || 'ef';

    return (settings.values || [8, 16, 32, 64, 128]).map(function (value) {
      index.resetStats();
      let recallTotal = 0;
      questions.forEach(function (query, i) {
        const found = dial === 'ef' ? index.search(query, k, value) : index.search(query, k, value);
        recallTotal += AnnIndex().recall(found, truth.answers[i]).recall;
      });
      const stats = index.stats();
      return {
        dial: dial,
        value: value,
        recall: recallTotal / questions.length,
        distancesPerQuery: stats.distanceComputations / questions.length,
        speedup: truth.distancesPerQuery / (stats.distanceComputations / questions.length)
      };
    });
  }

  /**
   * Every family on one corpus. The point of the table is that no column
   * orders it: brute force wins recall, product quantisation wins memory by
   * two orders of magnitude, and HNSW wins the only ratio anyone deploys on.
   */
  function compare(options) {
    const settings = options || {};
    const list = settings.vectors || vectors(settings);
    const questions = settings.queries || queries(settings);
    const k = Math.max(1, Math.floor(settings.k || 10));
    const truth = truthFor(list, questions, k);
    const built = build(list, settings);

    const rows = built.map(function (entry) {
      return Object.assign(score(entry.index, questions, truth, k), {
        label: entry.label,
        build: entry.build
      });
    });

    return {
      rows: rows,
      truth: truth,
      exactDistancesPerQuery: truth.distancesPerQuery,
      k: k,
      vectors: list.length,
      dims: list[0] ? list[0].v.length : 0
    };
  }

  function build(list, settings) {
    const out = [];
    out.push({ label: 'brute force (exact)', index: AnnIndex().bruteForce(list), build: 'none' });
    out.push({
      label: 'VP-tree (exact)', build: 'metric tree',
      index: AnnIndex().vpTree(list, { leafSize: settings.leafSize || 16, seed: settings.seed || 1 })
    });
    out.push({
      label: 'IVF, ' + (settings.lists || 64) + ' lists, probe ' + (settings.probe || 4), build: 'k-means',
      index: probeWrapper(AnnIndex().ivf(list, {
        lists: settings.lists || 64, seed: settings.seed || 1
      }), settings.probe || 4)
    });
    const quantiser = AnnIndex().productQuantiser(list, {
      parts: settings.parts || 8, centroids: settings.centroids || 64, seed: settings.seed || 1
    });
    out.push({
      label: 'product quantisation, ' + quantiser.bytesPerVector + ' bytes/vector', build: 'k-means per subspace',
      index: quantiser
    });
    out.push({
      label: 'the same codes, re-ranked ' + (settings.rerank || 10) + 'x', build: 'shortlist then exact',
      index: reranked(quantiser, list, settings.rerank || 10)
    });
    out.push({
      label: 'HNSW, M = ' + (settings.M || 8) + ', ef = ' + (settings.ef || 32), build: 'proximity graph',
      index: efWrapper(Hnsw().build(list, {
        M: settings.M || 8, efConstruction: settings.efConstruction || 48, seed: settings.seed || 1
      }), settings.ef || 32)
    });
    return out;
  }

  /** The two graph/list indexes take a third argument the scorer does not
   *  know about, so the default is bound here rather than leaked into every
   *  call site. */
  function probeWrapper(index, probe) {
    return Object.assign({}, index, {
      search: function (query, k, override) { return index.search(query, k, override || probe); }
    });
  }

  function efWrapper(index, ef) {
    return Object.assign({}, index, {
      search: function (query, k, override) { return index.search(query, k, override || ef); }
    });
  }

  /**
   * Retrieve a shortlist from an approximate index, then re-score it with the
   * exact vectors.
   *
   * This is not an optimisation, it is what makes a quantised index usable at
   * all: 8-byte codes recall 13.9% of the true top-10 on their own, and the
   * same codes fetching a hundred candidates and re-ranking them exactly
   * recall far more, for one pass over a hundred vectors. Reporting a
   * quantiser's recall without this stage describes a system nobody ships.
   */
  function reranked(index, vectors, factor) {
    const byId = new Map();
    vectors.forEach(function (vector) { byId.set(vector.id, vector); });
    const widen = Math.max(1, Math.floor(factor || 10));
    let extra = 0;

    return Object.assign({}, index, {
      kind: index.kind + ' + rerank',
      search: function (query, k) {
        const shortlist = index.search(query, k * widen);
        const scored = shortlist.map(function (entry) {
          extra += 1;
          return { id: entry.id, distance: AnnIndex().distanceSquared(byId.get(entry.id).v, query) };
        });
        scored.sort(function (a, b) { return a.distance - b.distance; });
        return scored.slice(0, k);
      },
      stats: function () {
        return Object.assign({}, index.stats(), {
          distanceComputations: index.stats().distanceComputations + extra
        });
      },
      /* Re-ranking needs the exact vectors, so the memory saving is gone
         unless they live somewhere slower than RAM. That is the real design:
         codes in memory, vectors on disk, one random read per shortlist entry.
         Reporting the code size alone here would be a lie by omission. */
      bytes: function () {
        const dims = vectors[0] ? vectors[0].v.length : 0;
        return index.bytes() + vectors.length * dims * 8;
      },
      resetStats: function () { extra = 0; index.resetStats(); }
    });
  }

  /**
   * The graph itself, projected to two dimensions for drawing. Principal
   * components would be better and are not the subject; the first two
   * coordinates are honest as long as the caption says so.
   */
  function layerView(index, layer) {
    return index.graph(layer).map(function (node) {
      return { id: node.id, x: node.v[0], y: node.v[1], links: node.links };
    });
  }

  return {
    vectors: vectors,
    queries: queries,
    truthFor: truthFor,
    score: score,
    sweep: sweep,
    compare: compare,
    probeWrapper: probeWrapper,
    efWrapper: efWrapper,
    reranked: reranked,
    layerView: layerView
  };
}));

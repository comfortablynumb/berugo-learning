/**
 * Cardinality, frequency, quantile, similarity and window comparisons - every
 * one of them a sketch measured against an exact reference on the same input.
 *
 * The shape is the same everywhere: build the exact answer, build the sketches,
 * feed both, then report predicted error and observed error next to the bytes
 * each one cost. A row that carries only the estimate is not a measurement, and
 * this milestone's review criterion rejects it.
 *
 * Nothing here touches the DOM.
 */
(function (root, factory) {
  const api = factory(root, typeof require === 'function' ? require : null);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SketchLab = api;
}(typeof window !== 'undefined' ? window : null, function (scope, requireFn) {
  'use strict';

  function load(name, global) {
    if (scope && scope[global]) return scope[global];
    return requireFn ? requireFn(name) : null;
  }

  const HyperLogLog = load('../algorithms/hyperloglog.js', 'HyperLogLog');
  const CountMin = load('../algorithms/count-min.js', 'CountMin');
  const QuantileSketches = load('../algorithms/quantile-sketches.js', 'QuantileSketches');
  const MinHashLsh = load('../algorithms/minhash-lsh.js', 'MinHashLsh');
  const WindowCounters = load('../algorithms/window-counters.js', 'WindowCounters');
  const StreamLab = load('./stream-lab.js', 'StreamLab');
  const Random = load('../utils/random.js', 'Random');

  /* ---------------------------------------------------------- cardinality */

  /**
   * One stream into one HLL, sampled as it goes, with the ±σ band the sketch
   * claims for itself drawn alongside the observed error. The sparse-to-dense
   * promotion is reported because it is visible in the memory column and
   * invisible in the answer.
   */
  function cardinalityTrack(options) {
    const settings = options || {};
    const items = settings.items;
    const sketch = HyperLogLog.create({ precision: settings.precision || 12, seed: settings.seed || 1 });
    const exact = StreamLab.distinctPrefix(items);
    const sigma = sketch.standardError();

    const points = StreamLab.errorSeries({
      items: items,
      sampleEvery: settings.sampleEvery,
      add: sketch.add,
      truthAt: function (index) { return exact[index]; },
      estimate: function () { return sketch.estimate(); },
      bound: function (index, truth) { return sigma * truth; }
    });

    return {
      sketch: sketch,
      points: points,
      sigma: sigma,
      distinct: exact[exact.length - 1],
      estimate: sketch.estimate(),
      raw: sketch.raw(),
      relativeError: (sketch.estimate() - exact[exact.length - 1]) / exact[exact.length - 1],
      histogram: sketch.histogram()
    };
  }

  /** Precision against memory and observed error, on one stream. */
  function precisionSweep(options) {
    const settings = options || {};
    const items = settings.items;
    const truth = new Set(items).size;

    return (settings.precisions || [8, 10, 12, 14]).map(function (precision) {
      const sketch = HyperLogLog.create({ precision: precision, seed: settings.seed || 1 });
      items.forEach(sketch.add);
      const estimate = sketch.estimate();
      return {
        precision: precision,
        registers: sketch.m(),
        sigma: sketch.standardError(),
        packedBytes: sketch.packedBytes(),
        estimate: estimate,
        truth: truth,
        relative: (estimate - truth) / truth,
        sigmas: Math.abs(estimate - truth) / (sketch.standardError() * truth)
      };
    });
  }

  /**
   * Per-shard sketches, merged, against the sketch of the whole stream. The
   * assertion is equality of the registers, not closeness of the estimates:
   * mergeability is an exact property and testing it approximately would hide
   * the bug where a merge silently drops a shard.
   */
  function mergeCheck(options) {
    const settings = options || {};
    const items = settings.items;
    const shardCount = Math.max(2, Math.floor(settings.shards || 4));
    const precision = settings.precision || 12;
    const whole = HyperLogLog.create({ precision: precision, seed: 1, dense: true });
    const shards = [];

    for (let i = 0; i < shardCount; i += 1) {
      shards.push(HyperLogLog.create({ precision: precision, seed: 1, dense: true }));
    }
    items.forEach(function (key, index) {
      whole.add(key);
      shards[index % shardCount].add(key);
    });

    const merged = HyperLogLog.merge(shards);
    return {
      shards: shards.map(function (sketch) { return sketch.estimate(); }),
      shardSum: shards.reduce(function (sum, sketch) { return sum + sketch.estimate(); }, 0),
      merged: merged.estimate(),
      whole: whole.estimate(),
      identical: HyperLogLog.sameRegisters(merged, whole),
      truth: new Set(items).size
    };
  }

  /**
   * The raw harmonic estimator against the corrected one, across the range
   * where they disagree.
   *
   * Below about 2.5m the raw estimator is badly biased - most registers are
   * still zero and αm²/Σ2^−M has nothing to work with - and linear counting on
   * the zero registers replaces it. Between roughly 2m and 5m *both* are off by
   * a few per cent, which is the gap HLL++ fills with an empirically tabulated
   * bias correction this implementation does not carry.
   */
  function correctionSweep(options) {
    const settings = options || {};
    const precision = settings.precision || 12;
    const m = Math.pow(2, precision);
    const points = (settings.multiples || [0.05, 0.1, 0.25, 0.5, 1, 1.5, 2, 2.5, 3, 4, 6, 10, 20])
      .map(function (multiple) { return Math.max(1, Math.round(m * multiple)); });

    return points.map(function (n) {
      const sketch = HyperLogLog.create({ precision: precision, seed: settings.seed || 1, dense: true });
      for (let i = 0; i < n; i += 1) sketch.add('u' + i);
      return {
        n: n,
        multiple: n / m,
        raw: sketch.raw(),
        corrected: sketch.estimate(),
        zeros: sketch.zeros(),
        rawError: (sketch.raw() - n) / n,
        correctedError: (sketch.estimate() - n) / n,
        usedLinearCounting: sketch.zeros() > 0 && sketch.raw() <= 2.5 * m
      };
    });
  }

  /* ------------------------------------------------------------ frequency */

  /**
   * Per-key truth against per-key estimate, for count-min with and without
   * conservative update and for count-sketch. The one-sided property is
   * checked here rather than asserted: `underCounts` must be zero for both
   * count-min columns and is routinely non-zero for count-sketch.
   */
  function frequencyScatter(options) {
    const settings = options || {};
    const stream = settings.stream;
    const width = settings.width || 512;
    const depth = settings.depth || 4;
    const seed = settings.seed || 1;

    const plain = CountMin.create({ width: width, depth: depth, seed: seed });
    const conservative = CountMin.create({ width: width, depth: depth, seed: seed, conservative: true });
    const signed = CountMin.countSketch({ width: width, depth: depth, seed: seed });

    stream.items.forEach(function (key) { plain.add(key); conservative.add(key); signed.add(key); });

    const points = [];
    let l2 = 0;
    stream.counts.forEach(function (truth, key) {
      l2 += truth * truth;
      points.push({
        key: key,
        truth: truth,
        plain: plain.estimate(key),
        conservative: conservative.estimate(key),
        signed: signed.estimate(key)
      });
    });

    return {
      points: points,
      bound: plain.errorBound(),
      l2Bound: signed.errorBound(Math.sqrt(l2)),
      epsilon: plain.epsilon(),
      delta: plain.delta(),
      bytes: plain.bytes(),
      total: plain.total(),
      summary: summarise(points)
    };
  }

  function summarise(points) {
    const columns = ['plain', 'conservative', 'signed'];
    const out = {};
    columns.forEach(function (column) {
      let worst = 0;
      let sum = 0;
      let under = 0;
      points.forEach(function (point) {
        const error = point[column] - point.truth;
        if (error < 0) under += 1;
        if (Math.abs(error) > Math.abs(worst)) worst = error;
        sum += Math.abs(error);
      });
      out[column] = { worst: worst, meanAbs: sum / points.length, underCounts: under };
    });
    return out;
  }

  /**
   * Heavy hitters three ways on one stream: count-min with a candidate heap,
   * space-saving, and the exact answer. Recall and the reported over-count are
   * what separate them; memory is what the choice is usually made on.
   */
  function heavyHitterCompare(options) {
    const settings = options || {};
    const stream = settings.stream;
    const fraction = settings.fraction || 0.01;
    const counters = settings.counters || 100;

    const cmHeap = CountMin.heavyHitters({
      width: settings.width || 512, depth: settings.depth || 4,
      seed: settings.seed || 1, fraction: fraction
    });
    const saving = WindowCounters.spaceSaving({ counters: counters });
    stream.items.forEach(function (key) { cmHeap.add(key); saving.add(key); });

    const threshold = fraction * stream.items.length;
    const truth = Array.from(stream.counts.entries())
      .filter(function (pair) { return pair[1] >= threshold; })
      .sort(function (a, b) { return b[1] - a[1]; });
    const truthKeys = new Set(truth.map(function (pair) { return pair[0]; }));

    const savingRows = saving.top();
    const reported = savingRows.filter(function (row) { return row.count >= threshold; });
    const certain = savingRows.filter(function (row) { return row.lower >= threshold; });

    return {
      threshold: threshold,
      truth: truth.map(function (pair) { return { key: pair[0], count: pair[1] }; }),
      countMin: reportRecall(cmHeap.top(), truthKeys, stream.counts),
      spaceSaving: reportRecall(reported, truthKeys, stream.counts),
      /* count − error ≥ threshold: the subset space-saving can *prove* is
         heavy. Reporting only `count ≥ threshold` inflates the answer with
         keys whose counter is mostly inherited from a key it replaced. */
      spaceSavingCertain: reportRecall(certain, truthKeys, stream.counts),
      countMinBytes: cmHeap.bytes(),
      spaceSavingBytes: saving.bytes(),
      guaranteedThreshold: saving.guaranteedThreshold()
    };
  }

  function reportRecall(rows, truthKeys, counts) {
    let found = 0;
    let worstOver = 0;
    rows.forEach(function (row) {
      const value = row.estimate === undefined ? row.count : row.estimate;
      if (truthKeys.has(row.key)) found += 1;
      worstOver = Math.max(worstOver, value - (counts.get(row.key) || 0));
    });
    return {
      reported: rows.length,
      found: found,
      recall: truthKeys.size ? found / truthKeys.size : 1,
      precision: rows.length ? found / rows.length : 1,
      worstOver: worstOver,
      rows: rows.slice(0, 12)
    };
  }

  /* ------------------------------------------------------------- quantiles */

  const QUANTILE_FAMILIES = [
    { id: 'reservoir', label: 'reservoir (Algorithm R)', build: function (o) { return QuantileSketches.reservoir({ size: o.reservoirSize, seed: o.seed }); } },
    { id: 't-digest', label: 't-digest', build: function (o) { return QuantileSketches.tDigest({ compression: o.compression }); } },
    { id: 'kll', label: 'KLL', build: function (o) { return QuantileSketches.kll({ k: o.k, seed: o.seed }); } },
    { id: 'ddsketch', label: 'DDSketch', build: function (o) { return QuantileSketches.ddSketch({ alpha: o.alpha }); } }
  ];

  /**
   * Every family on one latency stream, reported two ways. Value error is what
   * an SLO is written in; rank error is what a t-digest or a KLL actually
   * bounds. On a bimodal stream they disagree violently at the mode boundary,
   * and showing only one of them makes three of these four look broken.
   */
  function quantileCompare(options) {
    const settings = options || {};
    const values = settings.values;
    const quantiles = settings.quantiles || [0.5, 0.9, 0.99, 0.999];
    const exact = QuantileSketches.exact({});
    const sketches = QUANTILE_FAMILIES.map(function (family) {
      return { meta: family, sketch: family.build(settings) };
    });

    for (let i = 0; i < values.length; i += 1) {
      exact.add(values[i]);
      sketches.forEach(function (entry) { entry.sketch.add(values[i]); });
    }

    const rows = sketches.map(function (entry) {
      return {
        id: entry.meta.id,
        label: entry.meta.label,
        bytes: entry.sketch.bytes(),
        answers: quantiles.map(function (p) {
          const value = entry.sketch.quantile(p);
          const truth = exact.quantile(p);
          return {
            p: p,
            value: value,
            truth: truth,
            relative: truth ? (value - truth) / truth : 0,
            rank: exact.rankOf(value) / values.length - p
          };
        })
      };
    });

    return {
      rows: rows,
      quantiles: quantiles,
      exact: quantiles.map(function (p) { return { p: p, value: exact.quantile(p) }; }),
      exactBytes: exact.bytes(),
      count: values.length
    };
  }

  /**
   * Per-shard quantiles, averaged, against the true global quantile - and the
   * same shards as DDSketches, merged.
   *
   * The shards are deliberately *not* identical: one of them is degraded, which
   * is the only interesting case and the one every fleet eventually has. Over
   * statistically identical shards the average of the p99s happens to be close
   * to the global p99 and the dashboard looks fine; the moment one node is slow
   * the average understates the number the users are feeling, because a
   * quantile of a mixture is not a mixture of quantiles.
   *
   * Merging the sketches is a different operation and gets the right answer.
   */
  function shardQuantiles(options) {
    const settings = options || {};
    const shardCount = Math.max(2, Math.floor(settings.shards || 8));
    const perShardLength = Math.max(1000, Math.floor(settings.perShardLength || 25000));
    const p = settings.p === undefined ? 0.99 : settings.p;
    const alpha = settings.alpha || 0.01;
    const healthyShare = settings.healthyShare === undefined ? 0.05 : settings.healthyShare;
    const degradedShare = settings.degradedShare === undefined ? 0.6 : settings.degradedShare;

    const global = QuantileSketches.exact({});
    const merged = QuantileSketches.ddSketch({ alpha: alpha });
    const perShard = [];

    for (let shard = 0; shard < shardCount; shard += 1) {
      const share = shard === shardCount - 1 ? degradedShare : healthyShare;
      const values = StreamLab.latency({
        length: perShardLength, seed: (settings.seed || 1) + shard * 17, slowShare: share
      });
      const exact = QuantileSketches.exact({});
      const sketch = QuantileSketches.ddSketch({ alpha: alpha });

      for (let i = 0; i < values.length; i += 1) {
        exact.add(values[i]);
        sketch.add(values[i]);
        global.add(values[i]);
      }
      merged.mergeFrom(sketch);
      perShard.push({ shard: shard, slowShare: share, quantile: exact.quantile(p) });
    }

    const truth = global.quantile(p);
    const averaged = perShard.reduce(function (sum, row) { return sum + row.quantile; }, 0) / shardCount;

    return {
      p: p,
      shards: shardCount,
      perShard: perShard,
      averaged: averaged,
      averagedError: (averaged - truth) / truth,
      merged: merged.quantile(p),
      mergedError: (merged.quantile(p) - truth) / truth,
      truth: truth,
      alpha: alpha,
      degradedShare: degradedShare,
      healthyShare: healthyShare
    };
  }

  /* ------------------------------------------------------------ similarity */

  /**
   * Near-duplicate detection over a small corpus. Every pair's exact Jaccard is
   * computed, the MinHash estimate is compared against it, and the band index
   * is scored as a retrieval system: precision and recall against the pairs
   * genuinely above the threshold.
   */
  function deduplicate(options) {
    const settings = options || {};
    const documents = settings.documents;
    const length = settings.signatureLength || 128;
    const bands = settings.bands || 16;
    const rows = settings.rows || 8;
    const threshold = settings.threshold === undefined ? 0.7 : settings.threshold;

    const sets = documents.map(function (doc) { return MinHashLsh.shingles(doc.text, settings.shingle || 5); });
    const signatures = sets.map(function (set) {
      return MinHashLsh.signature({ tokens: set, length: bands * rows, seed: settings.seed || 1 }).values;
    });

    const index = MinHashLsh.bandIndex({ bands: bands, rows: rows });
    documents.forEach(function (doc, i) { index.add(doc.id, signatures[i]); });

    const truthPairs = new Set();
    const estimates = [];
    for (let i = 0; i < documents.length; i += 1) {
      for (let j = i + 1; j < documents.length; j += 1) {
        const exact = MinHashLsh.jaccard(sets[i], sets[j]);
        const estimate = MinHashLsh.estimateJaccard(signatures[i], signatures[j]);
        estimates.push({ a: documents[i].id, b: documents[j].id, exact: exact, estimate: estimate });
        if (exact >= threshold) truthPairs.add(documents[i].id + ' ' + documents[j].id);
      }
    }

    const candidates = index.pairs().map(function (pair) { return pair[0] + ' ' + pair[1]; });
    const hits = candidates.filter(function (key) { return truthPairs.has(key); });

    return {
      estimates: estimates,
      signatureLength: bands * rows,
      standardError: MinHashLsh.signatureError(bands * rows),
      worstEstimateError: estimates.reduce(function (worst, pair) {
        return Math.max(worst, Math.abs(pair.estimate - pair.exact));
      }, 0),
      candidates: candidates.length,
      truePairs: truthPairs.size,
      recall: truthPairs.size ? hits.length / truthPairs.size : 1,
      precision: candidates.length ? hits.length / candidates.length : 1,
      allPairs: documents.length * (documents.length - 1) / 2,
      curveThreshold: MinHashLsh.curveThreshold(bands, rows),
      curve: curvePoints(bands, rows)
    };
  }

  function curvePoints(bands, rows) {
    const out = [];
    for (let i = 0; i <= 50; i += 1) {
      const s = i / 50;
      out.push({ x: s, y: MinHashLsh.sCurve(s, bands, rows) });
    }
    return out;
  }

  /**
   * SimHash over the same corpus: Hamming distance against the cosine
   * similarity of the underlying token multisets. The point of putting it next
   * to MinHash is that it answers a *different* question - angle rather than
   * overlap - and the two rank a corpus differently.
   */
  function simhashCompare(options) {
    const settings = options || {};
    const documents = settings.documents;
    const bits = settings.bits || 64;
    const sets = documents.map(function (doc) {
      return MinHashLsh.shingles(doc.text, settings.shingle || 5);
    });
    const hashes = sets.map(function (set) {
      return MinHashLsh.simHash({ tokens: Array.from(set), bits: bits, seed: settings.seed || 1 });
    });

    const pairs = [];
    for (let i = 0; i < documents.length; i += 1) {
      for (let j = i + 1; j < documents.length; j += 1) {
        const distance = MinHashLsh.hamming(hashes[i], hashes[j]);
        pairs.push({
          a: documents[i].id,
          b: documents[j].id,
          distance: distance,
          cosineEstimate: MinHashLsh.cosineFromHamming(distance, bits),
          jaccard: MinHashLsh.jaccard(sets[i], sets[j])
        });
      }
    }

    return {
      bits: bits,
      pairs: pairs,
      bytesPerDocument: bits / 8,
      /* The distance below which a pair is called a duplicate, and what that
         costs in recall against the exact Jaccard threshold. */
      sweep: (settings.cutoffs || [4, 8, 12, 14, 16, 20, 24]).map(function (cutoff) {
        const flagged = pairs.filter(function (pair) { return pair.distance <= cutoff; });
        const truth = pairs.filter(function (pair) { return pair.jaccard >= (settings.threshold || 0.5); });
        const hits = flagged.filter(function (pair) { return pair.jaccard >= (settings.threshold || 0.5); });
        return {
          cutoff: cutoff,
          flagged: flagged.length,
          recall: truth.length ? hits.length / truth.length : 1,
          precision: flagged.length ? hits.length / flagged.length : 1
        };
      })
    };
  }

  /**
   * Random projection, and the distortion it actually produced against the
   * distortion Johnson-Lindenstrauss promised for that target dimension.
   * The lemma is a worst-case bound over all pairs and the measured worst is
   * usually well inside it, which is the useful thing to know before paying
   * for the dimensions the formula asks for.
   */
  function projectionCheck(options) {
    const settings = options || {};
    const points = Math.max(4, Math.floor(settings.points || 60));
    const dimensions = Math.max(2, Math.floor(settings.dimensions || 200));
    const epsilon = settings.epsilon || 0.3;
    const target = settings.target || MinHashLsh.jlDimension({ points: points, epsilon: epsilon });
    const rng = Random.seeded(settings.seed || 1);

    const vectors = [];
    for (let i = 0; i < points; i += 1) {
      const vector = new Float64Array(dimensions);
      for (let j = 0; j < dimensions; j += 1) vector[j] = rng.gaussian(0, 1);
      vectors.push(vector);
    }

    const projector = MinHashLsh.projection({ dimensions: dimensions, target: target, seed: settings.seed || 1 });
    const projected = vectors.map(projector.project);
    let worst = 0;
    let sum = 0;
    let pairs = 0;

    for (let i = 0; i < points; i += 1) {
      for (let j = i + 1; j < points; j += 1) {
        const before = MinHashLsh.distance(vectors[i], vectors[j]);
        const after = MinHashLsh.distance(projected[i], projected[j]);
        const distortion = Math.abs(after / before - 1);
        worst = Math.max(worst, distortion);
        sum += distortion;
        pairs += 1;
      }
    }

    return {
      points: points,
      dimensions: dimensions,
      target: target,
      epsilon: epsilon,
      worstDistortion: worst,
      meanDistortion: sum / pairs,
      pairs: pairs,
      compression: dimensions / target
    };
  }

  /* --------------------------------------------------------------- windows */

  /**
   * DGIM against an exact ring buffer over one bursty stream, at several
   * bucket budgets. The memory column is the point: the exact answer needs one
   * bit per position in the window and DGIM needs O(log² N).
   */
  function windowCompare(options) {
    const settings = options || {};
    const bits = settings.bits;
    const windowSize = settings.windowSize || 20000;
    const exact = WindowCounters.exactWindow({ windowSize: windowSize });
    const trackers = (settings.perSizes || [2, 4, 8]).map(function (perSize) {
      return { perSize: perSize, sketch: WindowCounters.dgim({ windowSize: windowSize, perSize: perSize }) };
    });

    const series = [];
    const worst = trackers.map(function () { return 0; });
    const every = Math.max(1, Math.floor(settings.sampleEvery || Math.ceil(bits.length / 120)));

    for (let i = 0; i < bits.length; i += 1) {
      exact.add(bits[i]);
      trackers.forEach(function (entry) { entry.sketch.add(bits[i]); });
      if (i < windowSize || i % every !== 0) continue;
      const truth = exact.estimate();
      const point = { n: i, truth: truth };
      trackers.forEach(function (entry, index) {
        const estimate = entry.sketch.estimate();
        point['p' + entry.perSize] = estimate;
        worst[index] = Math.max(worst[index], Math.abs(estimate - truth) / Math.max(1, truth));
      });
      series.push(point);
    }

    return {
      series: series,
      exactBits: exact.bits(),
      rows: trackers.map(function (entry, index) {
        return {
          perSize: entry.perSize,
          buckets: entry.sketch.bucketCount(),
          bits: entry.sketch.bits(),
          worstRelative: worst[index],
          statedBound: entry.sketch.relativeBound(),
          compression: exact.bits() / Math.max(1, entry.sketch.bits())
        };
      })
    };
  }

  /**
   * Space-saving, lossy counting and a decayed counter over one keyed stream,
   * against the exact top-k.
   *
   * The three answer subtly different questions and the table is arranged so
   * that is visible: space-saving over-estimates and knows by how much, lossy
   * counting under-estimates and knows by how much, and the decayed counter is
   * not answering "most frequent" at all - it is answering "most frequent
   * lately", which is usually what was wanted and never what was asked for.
   */
  function streamTopK(options) {
    const settings = options || {};
    const stream = settings.stream;
    const k = Math.max(1, Math.floor(settings.k || 10));
    const saving = WindowCounters.spaceSaving({ counters: settings.counters || 200 });
    const lossy = WindowCounters.lossyCounting({ epsilon: settings.epsilon || 0.0005 });
    const decayed = WindowCounters.decayedCounters({ halfLife: settings.halfLife || 20000 });

    stream.items.forEach(function (key, index) {
      saving.add(key);
      lossy.add(key);
      decayed.add(key);
      if (index % 100 === 99) decayed.tick(100);
    });

    const truth = exactTopK(stream.counts, k);
    const truthKeys = new Set(truth.map(function (row) { return row.key; }));
    const savingTop = saving.top(k);
    const lossyTop = lossy.top(settings.support || 0.001).slice(0, k);

    return {
      truth: truth,
      spaceSaving: {
        rows: savingTop,
        recall: overlap(savingTop, truthKeys) / Math.max(1, truth.length),
        worstOver: worstGap(savingTop, stream.counts, 1),
        monitored: saving.size(),
        bytes: saving.bytes(),
        guaranteedThreshold: saving.guaranteedThreshold(),
        replacements: saving.stats().replacements
      },
      lossy: {
        rows: lossyTop,
        recall: overlap(lossyTop, truthKeys) / Math.max(1, truth.length),
        worstUnder: worstGap(lossyTop, stream.counts, -1),
        monitored: lossy.size(),
        bytes: lossy.bytes(),
        errorBound: lossy.errorBound(),
        width: lossy.width()
      },
      decayed: {
        rows: decayed.top(k),
        halfLife: decayed.halfLife(),
        keys: decayed.size(),
        bytes: decayed.bytes()
      }
    };
  }

  function exactTopK(counts, k) {
    return Array.from(counts.entries())
      .sort(function (a, b) { return b[1] - a[1]; })
      .slice(0, k)
      .map(function (pair) { return { key: pair[0], count: pair[1] }; });
  }

  function overlap(rows, truthKeys) {
    return rows.reduce(function (total, row) { return total + (truthKeys.has(row.key) ? 1 : 0); }, 0);
  }

  function worstGap(rows, counts, sign) {
    return rows.reduce(function (worst, row) {
      const gap = sign * (row.count - (counts.get(row.key) || 0));
      return Math.max(worst, gap);
    }, 0);
  }

  return {
    cardinalityTrack: cardinalityTrack,
    precisionSweep: precisionSweep,
    mergeCheck: mergeCheck,
    correctionSweep: correctionSweep,
    frequencyScatter: frequencyScatter,
    heavyHitterCompare: heavyHitterCompare,
    quantileCompare: quantileCompare,
    shardQuantiles: shardQuantiles,
    deduplicate: deduplicate,
    simhashCompare: simhashCompare,
    projectionCheck: projectionCheck,
    windowCompare: windowCompare,
    streamTopK: streamTopK,
    QUANTILE_FAMILIES: QUANTILE_FAMILIES
  };
}));

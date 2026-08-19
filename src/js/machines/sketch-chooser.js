/**
 * The chooser, and the adversary.
 *
 * `recommend` states a question, a memory budget and an error tolerance, then
 * *measures* every candidate on the current stream rather than consulting a
 * table. That is the point: the trade-off table in the reference tab is a
 * summary of measurements, and a recommendation made from the summary rather
 * than from the measurement is how a sketch ends up in a system it does not
 * fit.
 *
 * `filterAttack` and `sketchAttack` are the other half of the section. Every
 * structure here is only as good as the assumption that keys are independent of
 * the hash, and an attacker who knows the seed can break that assumption
 * cheaply. Both attacks report how many candidates they had to examine, because
 * an attack that needs four million probes is a different threat from one that
 * needs four hundred.
 *
 * Nothing here touches the DOM.
 */
(function (root, factory) {
  const api = factory(root, typeof require === 'function' ? require : null);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SketchChooser = api;
}(typeof window !== 'undefined' ? window : null, function (scope, requireFn) {
  'use strict';

  function load(name, global) {
    if (scope && scope[global]) return scope[global];
    return requireFn ? requireFn(name) : null;
  }

  const BloomFilter = load('../algorithms/bloom-filter.js', 'BloomFilter');
  const CuckooFilter = load('../algorithms/cuckoo-filter.js', 'CuckooFilter');
  const QuotientFilter = load('../algorithms/quotient-filter.js', 'QuotientFilter');
  const HyperLogLog = load('../algorithms/hyperloglog.js', 'HyperLogLog');
  const CountMin = load('../algorithms/count-min.js', 'CountMin');
  const QuantileSketches = load('../algorithms/quantile-sketches.js', 'QuantileSketches');
  const WindowCounters = load('../algorithms/window-counters.js', 'WindowCounters');
  const StreamLab = load('./stream-lab.js', 'StreamLab');

  /* Every candidate declares its family, whether two of them merge, and a
     builder that returns { bytes, error, detail } after seeing the stream. */
  const QUESTIONS = {
    membership: {
      label: 'Is this key present?',
      metric: 'false-positive rate',
      candidates: [
        { id: 'bloom', label: 'Bloom filter, 1%', mergeable: 'same shape only', build: buildBloom(0.01) },
        { id: 'bloom-tight', label: 'Bloom filter, 0.1%', mergeable: 'same shape only', build: buildBloom(0.001) },
        { id: 'blocked', label: 'blocked Bloom, 1%', mergeable: 'same shape only', build: buildBlocked(0.01) },
        { id: 'cuckoo', label: 'cuckoo filter, 8-bit fingerprints', mergeable: 'no', build: buildCuckoo(8) },
        { id: 'quotient', label: 'quotient filter, r = 7', mergeable: 'yes', build: buildQuotient(7) },
        { id: 'exact', label: 'a Set of the keys', mergeable: 'yes', build: buildExactSet }
      ]
    },
    distinct: {
      label: 'How many distinct keys?',
      metric: 'relative error in the count',
      candidates: [
        { id: 'hll10', label: 'HyperLogLog, p = 10', mergeable: 'yes', build: buildHll(10) },
        { id: 'hll12', label: 'HyperLogLog, p = 12', mergeable: 'yes', build: buildHll(12) },
        { id: 'hll14', label: 'HyperLogLog, p = 14', mergeable: 'yes', build: buildHll(14) },
        { id: 'exact', label: 'a Set of the keys', mergeable: 'yes', build: buildExactSet }
      ]
    },
    frequency: {
      label: 'How often was this key seen?',
      metric: 'worst relative error over the top 100 keys',
      candidates: [
        { id: 'cm-small', label: 'count-min, 256 × 5', mergeable: 'yes', build: buildCountMin(256, false) },
        { id: 'cm-large', label: 'count-min, 2 048 × 5', mergeable: 'yes', build: buildCountMin(2048, false) },
        { id: 'cm-cons', label: 'count-min, 256 × 5, conservative', mergeable: 'no', build: buildCountMin(256, true) },
        { id: 'exact', label: 'a Map of key → count', mergeable: 'yes', build: buildExactMap }
      ]
    },
    heavy: {
      label: 'Which keys are hot?',
      metric: 'misses among the true top 20',
      candidates: [
        { id: 'ss50', label: 'space-saving, 50 counters', mergeable: 'approximately', build: buildSpaceSaving(50) },
        { id: 'ss200', label: 'space-saving, 200 counters', mergeable: 'approximately', build: buildSpaceSaving(200) },
        { id: 'ss1000', label: 'space-saving, 1 000 counters', mergeable: 'approximately', build: buildSpaceSaving(1000) },
        { id: 'exact', label: 'a Map, sorted at query time', mergeable: 'yes', build: buildExactTopK }
      ]
    }
  };

  /* ------------------------------------------------------------- builders */

  function buildBloom(target) {
    return function (context) {
      const shape = BloomFilter.optimalParams({ n: context.distinct, p: target });
      const filter = BloomFilter.create({ m: shape.m, k: shape.k, seed: context.seed });
      context.keys.forEach(filter.add);
      return filterResult(filter, context, 'k = ' + shape.k);
    };
  }

  function buildBlocked(target) {
    return function (context) {
      const shape = BloomFilter.optimalParams({ n: context.distinct, p: target });
      const filter = BloomFilter.blocked({ m: shape.m, k: shape.k, seed: context.seed, blockBits: 512 });
      context.keys.forEach(filter.add);
      return filterResult(filter, context, 'one 64-byte block per key');
    };
  }

  function buildCuckoo(bits) {
    return function (context) {
      const filter = CuckooFilter.create({
        capacity: Math.ceil(context.distinct / 0.94), bucketSize: 4,
        fingerprintBits: bits, seed: context.seed
      });
      context.keys.forEach(filter.add);
      return filterResult(filter, context, 'load ' + (filter.load() * 100).toFixed(1) + '%, deletes supported');
    };
  }

  function buildQuotient(bits) {
    return function (context) {
      const filter = QuotientFilter.create({
        quotientBits: Math.max(3, Math.ceil(Math.log2(context.distinct / 0.75))),
        remainderBits: bits, seed: context.seed
      });
      context.keys.forEach(filter.add);
      return filterResult(filter, context, 'one contiguous run per query');
    };
  }

  function filterResult(filter, context, detail) {
    const measured = StreamLab.measureFpr({ filter: filter, absent: context.absent });
    return {
      bytes: filter.bytes(),
      error: measured.rate,
      detail: detail,
      falseNegatives: StreamLab.falseNegatives({ filter: filter, present: context.keys })
    };
  }

  function buildExactSet(context) {
    const set = new Set();
    context.keys.forEach(function (key) { set.add(key); });
    return { bytes: estimateSetBytes(context.keys), error: 0, detail: 'exact, and never wrong', falseNegatives: 0 };
  }

  function buildHll(precision) {
    return function (context) {
      const sketch = HyperLogLog.create({ precision: precision, seed: context.seed });
      context.items.forEach(sketch.add);
      return {
        bytes: sketch.packedBytes(),
        error: Math.abs(sketch.estimate() - context.distinct) / context.distinct,
        detail: 'σ = ' + (sketch.standardError() * 100).toFixed(2) + '%, estimate ' +
          Math.round(sketch.estimate())
      };
    };
  }

  function buildCountMin(width, conservative) {
    return function (context) {
      const sketch = CountMin.create({ width: width, depth: 5, seed: context.seed, conservative: conservative });
      context.items.forEach(function (key) { sketch.add(key); });
      let worst = 0;
      context.top100.forEach(function (row) {
        worst = Math.max(worst, (sketch.estimate(row.key) - row.count) / row.count);
      });
      return {
        bytes: sketch.bytes(),
        error: worst,
        detail: 'ε·N = ' + Math.round(sketch.errorBound()) + ', never under-counts'
      };
    };
  }

  function buildSpaceSaving(counters) {
    return function (context) {
      const sketch = WindowCounters.spaceSaving({ counters: counters });
      context.items.forEach(function (key) { sketch.add(key); });
      const reported = new Set(sketch.top(20).map(function (row) { return row.key; }));
      const missed = context.top20.filter(function (row) { return !reported.has(row.key); }).length;
      return {
        bytes: sketch.bytes(),
        error: missed / Math.max(1, context.top20.length),
        detail: 'guaranteed above ' + Math.round(sketch.guaranteedThreshold()) + ' occurrences'
      };
    };
  }

  function buildExactMap(context) {
    return { bytes: estimateMapBytes(context.distinct), error: 0, detail: 'exact, and never wrong' };
  }

  function buildExactTopK(context) {
    return { bytes: estimateMapBytes(context.distinct), error: 0, detail: 'exact, and never wrong' };
  }

  /* A string key plus a hash-table slot. Deliberately generous rather than
     precise: the comparison is orders of magnitude, and pretending to know a
     JavaScript engine's per-entry overhead to the byte would be a fiction. */
  function estimateSetBytes(keys) {
    return keys.reduce(function (total, key) { return total + key.length * 2 + 40; }, 0);
  }

  function estimateMapBytes(distinct) {
    return distinct * 56;
  }

  /* ------------------------------------------------------------- chooser */

  function contextFor(options) {
    const settings = options || {};
    const stream = settings.stream || StreamLab.generate({
      kind: 'zipf', length: 200000, keys: 50000, skew: 1.1, seed: 5
    });
    const sorted = Array.from(stream.counts.entries())
      .sort(function (a, b) { return b[1] - a[1]; })
      .map(function (pair) { return { key: pair[0], count: pair[1] }; });

    return {
      items: stream.items,
      counts: stream.counts,
      keys: Array.from(stream.counts.keys()),
      distinct: stream.counts.size,
      absent: StreamLab.absentKeys({ count: settings.probes || 20000 }),
      top20: sorted.slice(0, 20),
      top100: sorted.slice(0, 100),
      seed: settings.seed === undefined ? 3 : settings.seed
    };
  }

  /**
   * Ranks the candidates for one question: everything that fits the budget and
   * meets the tolerance first, cheapest first; then everything that misses,
   * least-bad first. The verdict field says which of the two constraints was
   * the one that failed, because "no sketch fits" and "no sketch is accurate
   * enough" call for different next moves.
   */
  function recommend(options) {
    const settings = options || {};
    const question = QUESTIONS[settings.question] ? settings.question : 'membership';
    const spec = QUESTIONS[question];
    const context = contextFor(settings);
    const budget = settings.budget || 65536;
    const tolerance = settings.tolerance === undefined ? 0.01 : settings.tolerance;

    const rows = spec.candidates.map(function (candidate) {
      const result = candidate.build(context);
      const fits = result.bytes <= budget;
      const accurate = result.error <= tolerance;
      return {
        id: candidate.id,
        label: candidate.label,
        mergeable: candidate.mergeable,
        bytes: result.bytes,
        error: result.error,
        detail: result.detail,
        falseNegatives: result.falseNegatives,
        fits: fits,
        accurate: accurate,
        verdict: fits && accurate ? 'usable' : (fits ? 'too inaccurate' : (accurate ? 'too large' : 'too large and too inaccurate'))
      };
    });

    rows.sort(function (a, b) {
      const aOk = a.fits && a.accurate;
      const bOk = b.fits && b.accurate;
      if (aOk !== bOk) return aOk ? -1 : 1;
      if (aOk) return a.bytes - b.bytes;
      return a.error - b.error;
    });

    return {
      question: question,
      label: spec.label,
      metric: spec.metric,
      budget: budget,
      tolerance: tolerance,
      distinct: context.distinct,
      items: context.items.length,
      rows: rows,
      winner: rows[0] && rows[0].fits && rows[0].accurate ? rows[0] : null
    };
  }

  /* ------------------------------------------------------------ adversary */

  /**
   * Manufactures false positives against a filter whose seed is known.
   *
   * The search is trivial: probe keys until the filter says yes. The cost per
   * hit is 1/ε, which for a 1% filter is a hundred probes - so an attacker who
   * knows the seed can produce as many "present" answers as they like for the
   * price of arithmetic. The second half is the fix: the same key list is
   * tested against a filter built with a different seed, where it does no
   * better than chance.
   */
  function filterAttack(options) {
    const settings = options || {};
    const n = Math.max(16, Math.floor(settings.n || 5000));
    const target = settings.p || 0.01;
    const want = Math.max(1, Math.floor(settings.want || 50));
    const shape = BloomFilter.optimalParams({ n: n, p: target });

    const published = BloomFilter.create({ m: shape.m, k: shape.k, seed: settings.publishedSeed || 0 });
    const keyed = BloomFilter.create({ m: shape.m, k: shape.k, seed: settings.keyedSeed || 0x5f2a91c3 });
    for (let i = 0; i < n; i += 1) { published.add('key-' + i); keyed.add('key-' + i); }

    const search = StreamLab.searchKeys({
      accepts: published.has,
      count: want,
      budget: settings.budget || 400000,
      prefix: 'attack-'
    });
    const transferred = search.keys.filter(keyed.has).length;

    return {
      target: target,
      shape: shape,
      found: search.keys.length,
      examined: search.examined,
      perHit: search.perHit,
      exhausted: search.exhausted,
      expectedPerHit: 1 / Math.max(1e-9, published.predictedFpr()),
      transferred: transferred,
      expectedTransferred: search.keys.length * keyed.predictedFpr(),
      sample: search.keys.slice(0, 6)
    };
  }

  /**
   * The same idea against a count-min sketch: find keys that collide with a
   * victim in *every* row, so the minimum is contaminated and the estimate for
   * the victim can be driven up without ever sending the victim's key.
   *
   * The width is deliberately small, because the cost of the search is w^d and
   * the point is that it is finite. At w = 64 and d = 3 a hit costs about
   * 262 000 probes; at the 2 048 × 5 a real deployment uses it is 2^55, which
   * is the actual defence — that, and a seed the attacker does not have.
   */
  function sketchAttack(options) {
    const settings = options || {};
    const width = Math.max(8, Math.floor(settings.width || 64));
    const depth = Math.max(1, Math.floor(settings.depth || 3));
    const victim = settings.victim || 'victim';
    const sketch = CountMin.create({ width: width, depth: depth, seed: settings.seed || 0 });
    const victimColumns = sketch.columns(victim).join(',');

    const search = StreamLab.searchKeys({
      accepts: function (key) { return sketch.columns(key).join(',') === victimColumns; },
      count: settings.want || 6,
      budget: settings.budget || 2000000,
      prefix: 'collide-'
    });

    const honest = settings.honest || 100;
    for (let i = 0; i < honest; i += 1) sketch.add(victim);
    const before = sketch.estimate(victim);
    const perAttacker = settings.perAttacker || 5000;
    search.keys.forEach(function (key) {
      for (let i = 0; i < perAttacker; i += 1) sketch.add(key);
    });

    return {
      width: width,
      depth: depth,
      trueCount: honest,
      before: before,
      after: sketch.estimate(victim),
      inflation: sketch.estimate(victim) / Math.max(1, honest),
      found: search.keys.length,
      examined: search.examined,
      perHit: search.perHit,
      exhausted: search.exhausted,
      expectedPerHit: Math.pow(width, depth),
      productionCost: Math.pow(settings.productionWidth || 2048, settings.productionDepth || 5)
    };
  }

  return {
    recommend: recommend,
    filterAttack: filterAttack,
    sketchAttack: sketchAttack,
    questions: function () {
      return Object.keys(QUESTIONS).map(function (id) {
        return { id: id, label: QUESTIONS[id].label, metric: QUESTIONS[id].metric };
      });
    }
  };
}));

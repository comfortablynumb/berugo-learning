/**
 * The M07 harness: one stream, fed to a sketch and to an exact reference at
 * the same time.
 *
 * Every claim a sketch makes is a claim about the gap between those two, so
 * nothing in this milestone reports a sketch's answer alone. `errorSeries`
 * walks a stream, asks both, and returns predicted error and observed error
 * side by side - which is exactly what the milestone's review criterion asks
 * every demo to display.
 *
 * The generators are here rather than in the sections because the interesting
 * numbers are ratios between sketches on the *same* input: a Zipf stream drawn
 * twice from two call sites is two experiments, not one comparison.
 *
 * Nothing here touches the DOM.
 */
(function (root, factory) {
  const api = factory(root, typeof require === 'function' ? require : null);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.StreamLab = api;
}(typeof window !== 'undefined' ? window : null, function (scope, requireFn) {
  'use strict';

  function load(name, global) {
    if (scope && scope[global]) return scope[global];
    return requireFn ? requireFn(name) : null;
  }

  const Random = load('../utils/random.js', 'Random');

  /* ------------------------------------------------------------ generators */

  /** Zipf weights and an inverse-CDF sampler over `keys` distinct keys. */
  function zipf(options) {
    const keys = Math.max(1, Math.floor(options.keys));
    const skew = options.skew === undefined ? 1 : options.skew;
    const cdf = new Float64Array(keys);
    let sum = 0;

    for (let i = 0; i < keys; i += 1) { sum += Math.pow(i + 1, -skew); cdf[i] = sum; }
    for (let i = 0; i < keys; i += 1) cdf[i] /= sum;

    return function (rng) {
      const u = rng.next();
      let low = 0;
      let high = keys - 1;
      while (low < high) {
        const mid = (low + high) >>> 1;
        if (cdf[mid] < u) low = mid + 1; else high = mid;
      }
      return low;
    };
  }

  const DRAWS = {
    uniform: function (options) {
      const keys = options.keys;
      return function (rng) { return rng.int(keys); };
    },
    zipf: zipf,
    /* A population that drifts: the live key range slides forward, so keys
       seen early never return. This is the shape that breaks a sketch sized
       once for "the number of distinct keys". */
    sliding: function (options) {
      const keys = options.keys;
      const width = Math.max(1, Math.floor(keys / 10));
      return function (rng, index, length) {
        const start = Math.floor((index / length) * (keys - width));
        return start + rng.int(width);
      };
    },
    /* Almost all repeats of a tiny hot set, which makes a distinct-count
       sketch look accurate for the wrong reason. */
    duplicates: function (options) {
      const keys = options.keys;
      const hot = Math.max(1, Math.floor(keys / 200));
      return function (rng) { return rng.next() < 0.98 ? rng.int(hot) : rng.int(keys); };
    }
  };

  /**
   * A stream of string keys plus its exact profile. `counts` is the reference
   * every frequency claim is measured against and `distinct` the reference
   * every cardinality claim is measured against; a demo that reports one
   * without the other is reporting an estimate with nothing to check it.
   */
  function generate(options) {
    const settings = options || {};
    const length = Math.max(1, Math.floor(settings.length || 10000));
    const keys = Math.max(1, Math.floor(settings.keys || 1000));
    const kind = DRAWS[settings.kind] ? settings.kind : 'uniform';
    const prefix = settings.prefix === undefined ? 'key-' : settings.prefix;
    const rng = Random.seeded(settings.seed === undefined ? 1 : settings.seed);
    const draw = DRAWS[kind]({ keys: keys, skew: settings.skew });
    const items = new Array(length);
    const counts = new Map();

    for (let i = 0; i < length; i += 1) {
      const key = prefix + draw(rng, i, length);
      items[i] = key;
      counts.set(key, (counts.get(key) || 0) + 1);
    }

    return { items: items, counts: counts, distinct: counts.size, kind: kind, length: length };
  }

  /** Keys the stream never contains, for measuring a filter's false positives. */
  function absentKeys(options) {
    const count = Math.max(1, Math.floor(options.count || 1000));
    const prefix = options.prefix === undefined ? 'absent-' : options.prefix;
    const out = new Array(count);
    for (let i = 0; i < count; i += 1) out[i] = prefix + i;
    return out;
  }

  /**
   * A bimodal latency stream: a fast mode, a slow mode and a lognormal spread
   * on each. Quantile sketches are checked here rather than on a uniform
   * sample because the interesting failure - a p90 that lands in the gap
   * between the modes - cannot happen on a uniform one.
   */
  function latency(options) {
    const settings = options || {};
    const length = Math.max(1, Math.floor(settings.length || 100000));
    const slowShare = settings.slowShare === undefined ? 0.1 : settings.slowShare;
    const rng = Random.seeded(settings.seed === undefined ? 1 : settings.seed);
    const out = new Float64Array(length);

    for (let i = 0; i < length; i += 1) {
      out[i] = rng.next() < slowShare
        ? Math.exp(rng.gaussian(Math.log(settings.slowMs || 300), 0.7))
        : Math.exp(rng.gaussian(Math.log(settings.fastMs || 20), 0.4));
    }
    return out;
  }

  /**
   * A small corpus with planted near-duplicates: `groups` originals, each with
   * `perGroup` variants whose word-replacement rate rises across the group. So
   * every similarity from "identical" down to "unrelated" is present, which is
   * what a similarity threshold has to be tuned against - a corpus of exact
   * duplicates and unrelated documents makes every setting look correct.
   */
  function documents(options) {
    const settings = options || {};
    const groups = Math.max(1, Math.floor(settings.groups || 12));
    const perGroup = Math.max(1, Math.floor(settings.perGroup || 4));
    const words = Math.max(8, Math.floor(settings.words || 60));
    const rng = Random.seeded(settings.seed === undefined ? 1 : settings.seed);
    const vocabulary = load('./text-corpus.js', 'TextCorpus').words();
    const out = [];

    for (let group = 0; group < groups; group += 1) {
      const base = [];
      for (let i = 0; i < words; i += 1) base.push(vocabulary[rng.int(vocabulary.length)]);
      out.push({ id: 'd' + group + '-0', group: group, editRate: 0, text: base.join(' ') });

      for (let variant = 1; variant <= perGroup; variant += 1) {
        const rate = variant / (perGroup + 1);
        const copy = base.map(function (word) {
          return rng.next() < rate ? vocabulary[rng.int(vocabulary.length)] : word;
        });
        out.push({ id: 'd' + group + '-' + variant, group: group, editRate: rate, text: copy.join(' ') });
      }
    }
    return out;
  }

  /** A bursty 0/1 stream for the sliding-window counters. */
  function binary(options) {
    const settings = options || {};
    const length = Math.max(1, Math.floor(settings.length || 100000));
    const period = Math.max(2, Math.floor(settings.period || 9000));
    const base = settings.base === undefined ? 0.2 : settings.base;
    const swing = settings.swing === undefined ? 0.6 : settings.swing;
    const rng = Random.seeded(settings.seed === undefined ? 1 : settings.seed);
    const out = new Uint8Array(length);

    for (let i = 0; i < length; i += 1) {
      const phase = Math.sin(i / period);
      out[i] = rng.next() < base + swing * phase * phase ? 1 : 0;
    }
    return out;
  }

  /* --------------------------------------------------------- error tracking */

  /**
   * Feeds a stream to a sketch, sampling the estimate and the truth as it goes.
   * `truthAt(index)` and `estimate()` are supplied by the caller, so the same
   * walk serves a cardinality sketch, a frequency sketch and a filter.
   */
  function errorSeries(options) {
    const items = options.items;
    const every = Math.max(1, Math.floor(options.sampleEvery || Math.ceil(items.length / 60)));
    const points = [];

    for (let i = 0; i < items.length; i += 1) {
      options.add(items[i], i);
      if ((i + 1) % every !== 0 && i !== items.length - 1) continue;
      const truth = options.truthAt(i);
      const estimate = options.estimate(i);
      points.push({
        n: i + 1,
        truth: truth,
        estimate: estimate,
        error: estimate - truth,
        relative: truth ? (estimate - truth) / truth : 0,
        bound: options.bound ? options.bound(i, truth) : null
      });
    }
    return points;
  }

  /** The running distinct count, which is the reference an HLL is judged on. */
  function distinctPrefix(items) {
    const seen = new Set();
    const out = new Int32Array(items.length);
    for (let i = 0; i < items.length; i += 1) { seen.add(items[i]); out[i] = seen.size; }
    return out;
  }

  /** Measured false-positive rate, and the count behind it. */
  function measureFpr(options) {
    const filter = options.filter;
    const probes = options.absent;
    let hits = 0;
    probes.forEach(function (key) { if (filter.has(key)) hits += 1; });
    return { rate: hits / probes.length, hits: hits, probes: probes.length };
  }

  /** A filter must never say no to something it holds. This is that check. */
  function falseNegatives(options) {
    let missing = 0;
    options.present.forEach(function (key) { if (!options.filter.has(key)) missing += 1; });
    return missing;
  }

  /**
   * Searches for keys a predicate accepts, and reports how many it examined.
   *
   * The examined count is the point of returning it: an attack that needs 4
   * million candidates to manufacture 50 false positives is a different threat
   * from one that needs 400, and a search that runs out of budget must say so
   * rather than hand back a shorter list than was asked for.
   */
  function searchKeys(options) {
    const accepts = options.accepts;
    const want = Math.max(1, Math.floor(options.count || 10));
    const budget = Math.max(want, Math.floor(options.budget || 200000));
    const prefix = options.prefix === undefined ? 'probe-' : options.prefix;
    const found = [];
    const examinedAt = [];
    let examined = 0;

    while (found.length < want && examined < budget) {
      const key = prefix + examined;
      examined += 1;
      if (!accepts(key)) continue;
      found.push(key);
      examinedAt.push(examined);
    }

    return {
      keys: found,
      examined: examined,
      examinedAt: examinedAt,
      exhausted: found.length < want,
      perHit: found.length ? examined / found.length : Infinity
    };
  }

  return {
    zipf: zipf,
    generate: generate,
    absentKeys: absentKeys,
    latency: latency,
    binary: binary,
    documents: documents,
    errorSeries: errorSeries,
    distinctPrefix: distinctPrefix,
    measureFpr: measureFpr,
    falseNegatives: falseNegatives,
    searchKeys: searchKeys,
    kinds: function () { return Object.keys(DRAWS); }
  };
}));

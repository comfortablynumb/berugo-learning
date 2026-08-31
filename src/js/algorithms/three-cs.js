/**
 * ThreeCs - classifying every cache miss as compulsory, capacity or conflict,
 * by running three simulations at once.
 *
 * The classification is not a heuristic and it is not read off the miss rate:
 * each category is defined by what a DIFFERENT cache would have done with the
 * same access.
 *
 *   compulsory  the line has never been referenced before, so no cache of any
 *               size or organisation could have had it
 *   capacity    it missed in a fully associative cache of the same total size,
 *               so the working set does not fit and organisation is irrelevant
 *   conflict    it hit in that fully associative cache and missed in the real
 *               one, so the size was enough and the mapping was not
 *
 * The three are exhaustive and mutually exclusive by construction, so they sum
 * to the miss count exactly - and the test asserts that rather than trusting
 * it, because a classifier whose categories do not add up is a classifier with
 * a case it has not thought about.
 *
 * The decomposition earns its keep by pointing at different fixes. A high
 * conflict count is a layout problem: pad the array, change the stride, move
 * the allocation. A high capacity count is an algorithm problem: block the
 * loop so the working set fits. Reaching for the wrong one wastes a week, and
 * the miss rate alone cannot tell you which you have.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.ThreeCs = api;
}(this, function (root) {
  'use strict';

  const Cache = root && root.Memory && root.Memory.Cache ? root.Memory.Cache
    : require('../machines/memory/cache.js');

  const CATEGORIES = [
    { key: 'compulsory', name: 'compulsory',
      about: 'the first reference to this line; no cache could have had it',
      fix: 'nothing, except touching less data - or a prefetcher, which fetches it earlier '
        + 'rather than avoiding it' },
    { key: 'capacity', name: 'capacity',
      about: 'it missed even in a fully associative cache of the same size',
      fix: 'the working set does not fit: block or tile the loop so that it does' },
    { key: 'conflict', name: 'conflict',
      about: 'a fully associative cache of the same size would have hit',
      fix: 'the size was enough and the mapping was not: pad the array, change the stride, '
        + 'or raise the associativity' }
  ];

  /**
   * Build the two reference caches a classification needs: one fully
   * associative of the same total capacity, and the real one.
   *
   * The fully associative model has to have the same total capacity and the
   * same line size, or the comparison measures the difference between two
   * cache sizes rather than between two organisations.
   */
  function references(config) {
    const settings = Object.assign({}, Cache.DEFAULTS, config || {});
    const lines = settings.sets * settings.ways;

    return {
      real: Cache.create(settings),
      ideal: Cache.create(Object.assign({}, settings, { sets: 1, ways: lines,
        replacement: 'lru', name: 'fully associative' })),
      settings: settings
    };
  }

  function classify(trace, config) {
    const models = references(config);
    const seen = new Set();
    const counts = { compulsory: 0, capacity: 0, conflict: 0 };
    const timeline = [];

    (trace || []).forEach(function (entry, at) {
      const address = typeof entry === 'number' ? entry : entry.address;
      const write = typeof entry === 'object' && Boolean(entry.write);
      const line = Cache.lineOf(models.real, address);
      const ideal = Cache.access(models.ideal, { address: address, write: write });
      const real = Cache.access(models.real, { address: address, write: write });
      const first = !seen.has(line);

      seen.add(line);
      if (real.hit) return;
      const kind = first ? 'compulsory' : (ideal.hit ? 'conflict' : 'capacity');

      counts[kind] += 1;
      timeline.push({ at: at, address: address, line: line, kind: kind });
    });
    return report(models, counts, timeline);
  }

  function report(models, counts, timeline) {
    const real = Cache.summary(models.real);
    const total = counts.compulsory + counts.capacity + counts.conflict;

    return { counts: counts, misses: real.misses, total: total,
      reconciles: total === real.misses,
      accesses: real.accesses, hitRate: real.hitRate,
      rows: CATEGORIES.map(function (category) {
        return { key: category.key, name: category.name, about: category.about,
          fix: category.fix, misses: counts[category.key],
          share: real.misses ? counts[category.key] / real.misses : 0 };
      }),
      idealMisses: Cache.summary(models.ideal).misses,
      timeline: timeline, dominant: dominant(counts), settings: models.settings };
  }

  function dominant(counts) {
    return CATEGORIES.slice().sort(function (left, right) {
      return counts[right.key] - counts[left.key];
    })[0];
  }

  /**
   * The same trace against several associativities, which is the picture that
   * shows conflict misses disappearing while capacity misses do not move at
   * all - and is the reason the two categories are worth separating.
   */
  function sweepAssociativity(trace, config, ways) {
    const settings = Object.assign({}, Cache.DEFAULTS, config || {});
    const lines = settings.sets * settings.ways;

    return (ways || [1, 2, 4, 8, 16]).map(function (count) {
      const found = classify(trace, Object.assign({}, settings,
        { ways: count, sets: Math.max(1, Math.round(lines / count)) }));

      return { ways: count, compulsory: found.counts.compulsory,
        capacity: found.counts.capacity, conflict: found.counts.conflict,
        misses: found.misses, hitRate: found.hitRate };
    });
  }

  return { CATEGORIES: CATEGORIES, classify: classify, references: references,
    sweepAssociativity: sweepAssociativity };
}));

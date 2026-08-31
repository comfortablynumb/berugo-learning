/**
 * Prefetchers - guessing the next address, and the two numbers that decide
 * whether the guess was worth making.
 *
 * COVERAGE is the fraction of the misses the prefetcher removed. ACCURACY is
 * the fraction of its prefetches that were ever used. Almost every discussion
 * quotes the first and not the second, and the second is the one that decides
 * whether the thing is a net win: a wrong prefetch costs bandwidth, occupies a
 * miss register, and evicts a line that was going to be used. A prefetcher at
 * 50% accuracy is routinely net negative, and the harness here reports the
 * cycle effect so that case shows up as a loss rather than as a coverage
 * improvement to be pleased about.
 *
 * The three designs are the ones worth knowing:
 *
 *   next line   fetch the line after this one. Free, and right whenever the
 *               access is sequential, which is most of the time.
 *   stride      remember the last address and delta per program counter, and
 *               prefetch when the same delta repeats. A confidence counter
 *               stops it acting on a coincidence.
 *   stream      detect a direction and then run several lines ahead, which is
 *               what timeliness needs: a prefetch that arrives after the
 *               demand access has already stalled saved nothing.
 *
 * None of them can help a pointer chase, and that is not an implementation
 * gap: the next address is the value the current load returns, so there is
 * nothing to predict from. 36.6 measured what that costs.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.Prefetchers = api;
}(this, function (root) {
  'use strict';

  const Cache = root && root.Memory && root.Memory.Cache ? root.Memory.Cache
    : require('../machines/memory/cache.js');

  const KINDS = {
    none: { name: 'none', about: 'the baseline every other row is measured against' },
    nextLine: { name: 'next line',
      about: 'fetch line n+1 on every access to line n; no state at all' },
    stride: { name: 'stride',
      about: 'per-site last address and delta, with a confidence counter' },
    stream: { name: 'stream',
      about: 'a detected direction run several lines ahead, so it arrives in time' }
  };

  const DEFAULTS = { lineBytes: 64, degree: 1, distance: 4, confidence: 2 };

  /* ------------------------------------------------------------ designs */

  function create(kind, options) {
    const settings = Object.assign({}, DEFAULTS, options || {});

    return { kind: kind || 'none', settings: settings, table: {}, last: null,
      counters: { issued: 0, used: 0, late: 0 } };
  }

  function lineOf(prefetcher, address) {
    return Math.floor(address / prefetcher.settings.lineBytes);
  }

  /**
   * What this access suggests fetching. `site` stands in for a program
   * counter: a stride table is indexed by the instruction, not by the address,
   * because two loops interleaved in one array have two strides and one
   * address stream.
   */
  function suggest(prefetcher, access) {
    const line = lineOf(prefetcher, access.address);
    const bytes = prefetcher.settings.lineBytes;

    if (prefetcher.kind === 'nextLine') return [(line + 1) * bytes];
    if (prefetcher.kind === 'stride') return strideSuggest(prefetcher, access, line);
    if (prefetcher.kind === 'stream') return streamSuggest(prefetcher, line, bytes);
    return [];
  }

  /**
   * A confidence counter is the whole difference between a stride prefetcher
   * and a random-address generator. Two accesses define a delta; only a delta
   * that has repeated is worth acting on, because in a random access pattern
   * every pair of addresses also defines one.
   */
  function strideSuggest(prefetcher, access, line) {
    const site = access.site === undefined ? 0 : access.site;
    const entry = prefetcher.table[site];
    const bytes = prefetcher.settings.lineBytes;

    if (!entry) {
      prefetcher.table[site] = { line: line, delta: 0, confidence: 0 };
      return [];
    }
    const delta = line - entry.line;

    entry.confidence = delta === entry.delta && delta !== 0
      ? Math.min(3, entry.confidence + 1) : 0;
    entry.delta = delta;
    entry.line = line;
    if (entry.confidence < prefetcher.settings.confidence) return [];

    const out = [];

    for (let at = 1; at <= prefetcher.settings.degree; at += 1) {
      out.push((line + delta * at) * bytes);
    }
    return out;
  }

  /** A direction, then several lines ahead of it. The distance is what makes a
   *  prefetch timely: one line ahead arrives while the demand access is still
   *  waiting for it. */
  function streamSuggest(prefetcher, line, bytes) {
    const previous = prefetcher.last;

    prefetcher.last = line;
    if (previous === null) return [];
    const direction = Math.sign(line - previous);

    if (direction === 0) return [];
    const out = [];

    for (let at = 1; at <= prefetcher.settings.distance; at += 1) {
      out.push((line + direction * at) * bytes);
    }
    return out;
  }

  /* ------------------------------------------------------------ harness */

  /**
   * Run a trace with and without the prefetcher and report both the coverage
   * and what it cost.
   *
   * A prefetched line is installed in the cache but marked, so a later demand
   * access to it counts as USED. Prefetches that are never used are the ones
   * that cost bandwidth and evicted something, and they are counted
   * separately rather than folded into the hit rate.
   */
  function run(trace, kind, config) {
    const settings = config || {};
    const cache = Cache.create(settings.cache || {});
    const prefetcher = create(kind, settings.prefetcher || {});
    const pending = new Set();
    const counters = { demandMisses: 0, demandHits: 0, prefetched: 0, usedPrefetches: 0 };

    (trace || []).forEach(function (entry) {
      const found = Cache.access(cache, entry);
      const line = lineOf(prefetcher, entry.address);

      counters[found.hit ? 'demandHits' : 'demandMisses'] += 1;
      if (found.hit && pending.has(line)) {
        counters.usedPrefetches += 1;
        pending.delete(line);
      }
      issue(cache, prefetcher, pending, entry).forEach(function () {
        counters.prefetched += 1;
      });
    });
    return report(cache, prefetcher, counters, settings);
  }

  /** Issue the suggestions, skipping anything already resident: prefetching a
   *  line you already have is free and also pointless, and counting it as a
   *  prefetch flatters the accuracy figure. */
  function issue(cache, prefetcher, pending, entry) {
    const issued = [];

    suggest(prefetcher, entry).forEach(function (address) {
      if (address < 0) return;
      if (Cache.probe(cache, address).hit) return;
      Cache.access(cache, { address: address });
      pending.add(Math.floor(address / prefetcher.settings.lineBytes));
      prefetcher.counters.issued += 1;
      issued.push(address);
    });
    return issued;
  }

  function report(cache, prefetcher, counters, settings) {
    const baseline = settings.baseline;
    const summary = Cache.summary(cache);
    const covered = baseline ? Math.max(0, baseline.demandMisses - counters.demandMisses) : 0;

    return { kind: prefetcher.kind, name: KINDS[prefetcher.kind].name,
      demandMisses: counters.demandMisses, demandHits: counters.demandHits,
      prefetched: counters.prefetched, usedPrefetches: counters.usedPrefetches,
      accuracy: counters.prefetched ? counters.usedPrefetches / counters.prefetched : 0,
      coverage: baseline && baseline.demandMisses ? covered / baseline.demandMisses : 0,
      covered: covered,
      /* Every line the level below had to supply: the demand misses plus the
         prefetches, whether or not anybody wanted them. This is the number a
         coverage figure on its own hides. */
      traffic: counters.demandMisses + counters.prefetched,
      cache: summary };
  }

  /**
   * Every design against one trace, with the no-prefetcher row first so the
   * others have a baseline to be measured against.
   */
  function compare(trace, config) {
    const settings = config || {};
    const baseline = run(trace, 'none', settings);

    return Object.keys(KINDS).map(function (kind) {
      if (kind === 'none') return baseline;
      return run(trace, kind, Object.assign({}, settings, { baseline: baseline }));
    });
  }

  /**
   * Was it worth it? Coverage alone says yes far too often, so the verdict
   * weighs the misses removed against the traffic added.
   */
  function verdict(row, baseline) {
    if (!row.prefetched) return 'issued nothing at all';
    const extra = row.traffic - baseline.traffic;

    if (row.covered <= 0) {
      return 'removed no misses and added ' + extra + ' lines of traffic';
    }
    if (extra > row.covered) {
      return 'removed ' + row.covered + ' misses and added ' + extra
        + ' lines of traffic to do it - a net loss';
    }
    return 'removed ' + row.covered + ' misses for ' + Math.max(0, extra)
      + ' extra lines of traffic';
  }

  return { KINDS: KINDS, DEFAULTS: DEFAULTS, create: create, suggest: suggest,
    run: run, compare: compare, verdict: verdict };
}));

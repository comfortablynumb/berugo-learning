/**
 * OooCache - a small set-associative cache, built here because M36 needs one
 * and M37 is where it gets a milestone.
 *
 * It is deliberately minimal: sets, ways, LRU replacement, and a hit or a miss.
 * What it is NOT is a memory hierarchy - there is no second level, no write
 * policy worth the name and no coherence. M37 builds all of that; this exists
 * so that two things in M36 can be measured rather than described.
 *
 * The first is memory-level parallelism. An array traversal and a linked-list
 * traversal with identical instruction counts differ by a factor of several on
 * a real machine, and the reason is not the miss count - it is whether the
 * misses can overlap. Without a cache that reports a miss, that difference
 * cannot be shown at all.
 *
 * The second is the side channel. A cache is a shared structure whose state
 * depends on what was accessed, and whose timing reveals that state. That is
 * the whole mechanism behind Flush+Reload, and it needs a real tag array to
 * demonstrate rather than a story about one.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) {
    scope.Ooo = scope.Ooo || {};
    scope.Ooo.Cache = api;
  }
}(this, function () {
  'use strict';

  const DEFAULTS = { sets: 16, ways: 4, lineBytes: 64, hitCycles: 1, missCycles: 20 };

  function create(options) {
    const settings = Object.assign({}, DEFAULTS, options || {});
    const sets = [];

    for (let at = 0; at < settings.sets; at += 1) sets.push([]);
    return { settings: settings, sets: sets,
      counters: { hits: 0, misses: 0, evictions: 0, flushes: 0 } };
  }

  /** The line an address falls in, and the set that line maps to. A cache is
   *  this pair of divisions and nothing else. */
  function lineOf(cache, address) {
    return Math.floor((address >>> 0) / cache.settings.lineBytes);
  }

  function setOf(cache, address) {
    return lineOf(cache, address) % cache.settings.sets;
  }

  function find(cache, address) {
    const line = lineOf(cache, address);

    return cache.sets[setOf(cache, address)].filter(function (entry) {
      return entry.line === line;
    })[0] || null;
  }

  /**
   * Look up an address and update the replacement order.
   *
   * `probe` reports what would happen without changing anything, which is what
   * an attacker's timing measurement is: the whole point of Flush+Reload is
   * that reading a line tells you whether somebody else read it, so the
   * distinction between observing and disturbing has to exist in the model.
   */
  function probe(cache, address) {
    const entry = find(cache, address);

    return { hit: Boolean(entry), line: lineOf(cache, address),
      set: setOf(cache, address),
      cycles: entry ? cache.settings.hitCycles : cache.settings.missCycles };
  }

  function access(cache, address, options) {
    const settings = options || {};
    const set = cache.sets[setOf(cache, address)];
    const line = lineOf(cache, address);
    const found = probe(cache, address);

    if (found.hit) {
      cache.counters.hits += 1;
      touch(set, line, cache.counters.hits + cache.counters.misses);
      return found;
    }
    cache.counters.misses += 1;
    if (!settings.noFill) install(cache, set, line);
    return found;
  }

  function touch(set, line, at) {
    set.forEach(function (entry) {
      if (entry.line === line) entry.used = at;
    });
  }

  /** Least recently used, which is the policy every timing attack assumes and
   *  most real caches only approximate. */
  function install(cache, set, line) {
    const at = cache.counters.hits + cache.counters.misses;

    if (set.length >= cache.settings.ways) {
      let oldest = 0;

      set.forEach(function (entry, index) {
        if (entry.used < set[oldest].used) oldest = index;
      });
      set.splice(oldest, 1);
      cache.counters.evictions += 1;
    }
    set.push({ line: line, used: at });
  }

  /** Evict one line by address, which is what a flush instruction does and
   *  what the receiving half of Flush+Reload needs. */
  function flush(cache, address) {
    const line = lineOf(cache, address);
    const set = cache.sets[setOf(cache, address)];
    const before = set.length;

    for (let at = set.length - 1; at >= 0; at -= 1) {
      if (set[at].line === line) set.splice(at, 1);
    }
    if (set.length !== before) cache.counters.flushes += 1;
    return before !== set.length;
  }

  function flushAll(cache) {
    cache.sets.forEach(function (set) { set.length = 0; });
    cache.counters.flushes += 1;
  }

  /** Every line currently resident, which is what the demo draws and what a
   *  Prime+Probe attacker reconstructs one set at a time. */
  function resident(cache) {
    const out = [];

    cache.sets.forEach(function (set, index) {
      set.forEach(function (entry) {
        out.push({ set: index, line: entry.line, used: entry.used });
      });
    });
    return out;
  }

  function summary(cache) {
    const total = cache.counters.hits + cache.counters.misses;

    return { hits: cache.counters.hits, misses: cache.counters.misses,
      evictions: cache.counters.evictions, accesses: total,
      hitRate: total ? cache.counters.hits / total : 0,
      sets: cache.settings.sets, ways: cache.settings.ways,
      lineBytes: cache.settings.lineBytes,
      capacity: cache.settings.sets * cache.settings.ways * cache.settings.lineBytes };
  }

  return { DEFAULTS: DEFAULTS, create: create, access: access, probe: probe, flush: flush,
    flushAll: flushAll, resident: resident, summary: summary, lineOf: lineOf, setOf: setOf };
}));

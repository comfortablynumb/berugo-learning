/**
 * What to evict, and the one failure every modern policy is an answer to.
 *
 * A cache with a fixed capacity has to choose a victim on every miss, and the
 * choice is the whole design. Belady's rule — evict the item whose next use is
 * furthest away — is optimal and requires the future, so it exists only as a
 * ceiling to measure against. Everything shippable is a guess about the future
 * built from the past, and the policies differ entirely in which part of the
 * past they trust.
 *
 *   - **FIFO** trusts arrival order and nothing else. It is the control: any
 *     policy that cannot beat it is not paying for its bookkeeping.
 *   - **LRU** trusts recency. It is k-competitive against Belady with k the
 *     cache size, which is the best any deterministic policy can do — and that
 *     bound is attained by a loop just larger than the cache, where LRU gets
 *     ZERO hits and Belady gets nearly all of them.
 *   - **LFU** trusts frequency, which makes it immune to a scan and vulnerable
 *     to a stale favourite: an item hot last week keeps its count forever
 *     unless the counts decay.
 *   - **CLOCK** approximates LRU with one reference bit per entry and a moving
 *     hand, which is what an operating system can afford when "touch this
 *     page" has to be a hardware bit rather than a list splice.
 *
 * The failure they are all measured on is the SCAN. One pass over data larger
 * than the cache evicts the entire working set under LRU, FIFO and CLOCK alike,
 * and every serious cache since is an answer to that single problem — which is
 * why the adaptive policies live in their own module next door.
 *
 * Every policy here reports `hits`, `misses` and `evictions` and nothing else,
 * so a comparison table is a comparison rather than a collection of each
 * implementation's favourite statistic.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ReplacementPolicies = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const NAMES = ['fifo', 'lru', 'lfu', 'clock'];

  function newCounters() {
    return { accesses: 0, hits: 0, misses: 0, evictions: 0 };
  }

  function statsOf(counters, name, capacity) {
    return { name: name, capacity: capacity, accesses: counters.accesses,
      hits: counters.hits, misses: counters.misses, evictions: counters.evictions,
      hitRate: counters.accesses ? counters.hits / counters.accesses : 0 };
  }

  /* ------------------------------------------------------------------ FIFO */

  /** Evict the oldest arrival, whatever has happened since. */
  function fifo(capacity) {
    const resident = new Set();
    const order = [];
    const counters = newCounters();

    return {
      name: 'fifo',
      get: function (key) {
        counters.accesses += 1;
        if (resident.has(key)) { counters.hits += 1; return true; }
        counters.misses += 1;
        resident.add(key);
        order.push(key);
        if (resident.size > capacity) {
          resident.delete(order.shift());
          counters.evictions += 1;
        }
        return false;
      },
      stats: function () { return statsOf(counters, 'fifo', capacity); },
      state: function () { return { resident: order.slice() }; }
    };
  }

  /* ------------------------------------------------------------------- LRU */

  /**
   * A Map iterates in insertion order, so deleting and re-inserting a key
   * moves it to the most-recent end and the least-recent is always the first
   * key the iterator yields. That is the whole implementation.
   */
  function lru(capacity) {
    const resident = new Map();
    const counters = newCounters();

    return {
      name: 'lru',
      get: function (key) {
        counters.accesses += 1;
        if (resident.has(key)) {
          resident.delete(key);
          resident.set(key, true);
          counters.hits += 1;
          return true;
        }
        counters.misses += 1;
        resident.set(key, true);
        if (resident.size > capacity) {
          resident.delete(resident.keys().next().value);
          counters.evictions += 1;
        }
        return false;
      },
      stats: function () { return statsOf(counters, 'lru', capacity); },
      state: function () { return { resident: Array.from(resident.keys()) }; }
    };
  }

  /* ------------------------------------------------------------------- LFU */

  /**
   * Counts, with recency as the tie-break. The `decay` option halves every
   * count on a fixed stride, which is the difference between a cache that
   * adapts and one whose favourites from last week are unevictable — the
   * defect is real and the demo shows it, so the decay is off by default.
   */
  function lfu(capacity, options) {
    const settings = options || {};
    const counts = new Map();
    const seenAt = new Map();
    const counters = newCounters();
    const decayEvery = settings.decayEvery === undefined ? 0 : settings.decayEvery;

    return {
      name: settings.decayEvery ? 'lfu-decay' : 'lfu',
      get: function (key) {
        counters.accesses += 1;
        maybeDecay(counts, counters.accesses, decayEvery);
        seenAt.set(key, counters.accesses);
        if (counts.has(key)) {
          counts.set(key, counts.get(key) + 1);
          counters.hits += 1;
          return true;
        }
        counters.misses += 1;
        counts.set(key, 1);
        if (counts.size > capacity) evictLeastFrequent(counts, seenAt, counters);
        return false;
      },
      stats: function () {
        return statsOf(counters, settings.decayEvery ? 'lfu-decay' : 'lfu', capacity);
      },
      state: function () { return { counts: Array.from(counts.entries()) }; }
    };
  }

  function maybeDecay(counts, at, every) {
    if (!every || at % every !== 0) return;
    counts.forEach(function (value, key) { counts.set(key, Math.max(1, Math.floor(value / 2))); });
  }

  function evictLeastFrequent(counts, seenAt, counters) {
    let victim = null;

    counts.forEach(function (value, key) {
      if (victim === null) { victim = key; return; }
      const better = value < counts.get(victim) ||
        (value === counts.get(victim) && seenAt.get(key) < seenAt.get(victim));
      if (better) victim = key;
    });
    counts.delete(victim);
    seenAt.delete(victim);
    counters.evictions += 1;
  }

  /* ----------------------------------------------------------------- CLOCK */

  /**
   * One reference bit per slot and a hand that sweeps. On a miss the hand
   * advances, clearing bits as it goes, and takes the first slot whose bit is
   * already clear. It is LRU's approximation and it exists because setting a
   * bit is something a memory-management unit can do in hardware while
   * splicing a list is not.
   */
  function clock(capacity) {
    const slots = new Array(capacity).fill(null);
    const referenced = new Array(capacity).fill(false);
    const where = new Map();
    const counters = newCounters();
    const hand = { at: 0 };

    return {
      name: 'clock',
      get: function (key) {
        counters.accesses += 1;
        if (where.has(key)) {
          referenced[where.get(key)] = true;
          counters.hits += 1;
          return true;
        }
        counters.misses += 1;
        placeInClock(key, { slots: slots, referenced: referenced, where: where,
          counters: counters, hand: hand, capacity: capacity });
        return false;
      },
      stats: function () { return statsOf(counters, 'clock', capacity); },
      state: function () {
        return { slots: slots.slice(), referenced: referenced.slice(), hand: hand.at };
      }
    };
  }

  function placeInClock(key, cache) {
    while (true) {
      const at = cache.hand.at;
      cache.hand.at = (at + 1) % cache.capacity;
      if (cache.slots[at] === null) { occupy(key, at, cache); return; }
      if (cache.referenced[at]) { cache.referenced[at] = false; continue; }
      cache.where.delete(cache.slots[at]);
      cache.counters.evictions += 1;
      occupy(key, at, cache);
      return;
    }
  }

  function occupy(key, at, cache) {
    cache.slots[at] = key;
    cache.referenced[at] = false;
    cache.where.set(key, at);
  }

  /* --------------------------------------------------------------- Belady */

  /**
   * The optimal offline policy: evict the resident item whose next use is
   * furthest in the future, or one that is never used again. It needs the
   * whole trace, so it is a ceiling rather than an algorithm — and having the
   * ceiling is what turns "LRU got 61% of hits" into a statement with a
   * meaning.
   */
  function belady(trace, capacity) {
    const nextUse = buildNextUse(trace);
    const resident = new Set();
    const counters = newCounters();

    trace.forEach(function (key, at) {
      counters.accesses += 1;
      if (resident.has(key)) { counters.hits += 1; return; }
      counters.misses += 1;
      if (resident.size >= capacity) {
        resident.delete(furthestUse(resident, nextUse, at));
        counters.evictions += 1;
      }
      resident.add(key);
    });
    return statsOf(counters, 'belady', capacity);
  }

  /** One ascending list of positions per key, so "the next use after t" is a
   *  binary search rather than a scan of the remaining trace. */
  function buildNextUse(trace) {
    const chains = new Map();

    trace.forEach(function (key, at) {
      if (!chains.has(key)) chains.set(key, []);
      chains.get(key).push(at);
    });
    return { chains: chains, length: trace.length };
  }

  /**
   * The next use of each resident key AFTER position `at`, found by scanning
   * forward through the chain `nextUse` already threads. Rebuilding a full
   * per-key index on every miss is the obvious implementation and is
   * quadratic in the trace; this walks each key's own chain instead.
   */
  function furthestUse(resident, nextUse, at) {
    let victim = null;
    let best = -1;

    resident.forEach(function (key) {
      const when = nextUseOf(key, nextUse, at);
      if (when <= best) return;
      best = when;
      victim = key;
    });
    return victim;
  }

  function nextUseOf(key, nextUse, at) {
    const chain = nextUse.chains.get(key);
    let low = 0;
    let high = chain.length - 1;
    let answer = Infinity;

    while (low <= high) {
      const middle = (low + high) >> 1;
      if (chain[middle] > at) { answer = chain[middle]; high = middle - 1; continue; }
      low = middle + 1;
    }
    return answer;
  }

  /* ------------------------------------------------------------- the driver */

  /** Run one trace through one policy. The trace is an array of keys. */
  function replay(policy, trace) {
    trace.forEach(function (key) { policy.get(key); });
    return policy.stats();
  }

  function create(name, capacity, options) {
    if (name === 'fifo') return fifo(capacity);
    if (name === 'lfu') return lfu(capacity, options);
    if (name === 'lfu-decay') {
      return lfu(capacity, Object.assign({ decayEvery: 200 }, options));
    }
    if (name === 'clock') return clock(capacity);
    return lru(capacity);
  }

  return {
    NAMES: NAMES, create: create, replay: replay, statsOf: statsOf, newCounters: newCounters,
    fifo: fifo, lru: lru, lfu: lfu, clock: clock, belady: belady, buildNextUse: buildNextUse
  };
}));

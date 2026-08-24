/**
 * Three answers to the same failure: one scan evicts the whole working set.
 *
 * LRU, FIFO and CLOCK all treat "just touched" as "will be touched again", so
 * a single pass over data larger than the cache walks the working set out of
 * it one line at a time and the hit rate goes to zero for as long as the scan
 * lasts. Every cache design since is a response to that, and the three here
 * respond in three different ways.
 *
 *   - **ARC** keeps two lists — one for items seen once, one for items seen
 *     twice — and two *ghost* lists of keys recently evicted from each. A hit
 *     in a ghost list is evidence about which half is being starved, so ARC
 *     moves a target boundary towards it. Nothing is tuned; the workload moves
 *     the dial.
 *   - **2Q** reaches the same place with less machinery: a small FIFO queue
 *     for newcomers, a ghost queue of what fell out of it, and a main LRU that
 *     only admits keys seen a second time. A scan fills the FIFO and never
 *     touches the main cache.
 *   - **W-TinyLFU** admits by FREQUENCY rather than by recency. A candidate
 *     evicted from a small window must beat the main cache's next victim on an
 *     approximate frequency count before it is let in, so a scan's one-hit
 *     wonders lose every contest they enter.
 *
 * The frequency sketch is the interesting part of the third. It is a count-min
 * sketch of four-bit counters that HALVES every counter once the total number
 * of increments reaches a sample size, which is what keeps a favourite from
 * last week from being unevictable — the defect plain LFU has and does not fix.
 *
 * LIRS is deliberately absent. Its correctness rests on a stack-pruning
 * invariant that is fiddly to get right, and a partially correct LIRS produces
 * plausible hit rates on every trace anybody tries first. Shipping three
 * policies that are right beats shipping four where one is probably wrong.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AdaptiveCaches = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const NAMES = ['arc', 'two-queue', 'w-tinylfu'];

  function newCounters() {
    return { accesses: 0, hits: 0, misses: 0, evictions: 0 };
  }

  function statsOf(counters, name, capacity, extra) {
    return Object.assign({ name: name, capacity: capacity, accesses: counters.accesses,
      hits: counters.hits, misses: counters.misses, evictions: counters.evictions,
      hitRate: counters.accesses ? counters.hits / counters.accesses : 0 }, extra || {});
  }

  /* ---------------------------------------------------- an ordered key list */

  /** A Map used as an LRU list: insertion order is the order, and deleting
   *  then re-inserting moves a key to the most-recent end. */
  function list() {
    const items = new Map();

    return {
      has: function (key) { return items.has(key); },
      size: function () { return items.size; },
      push: function (key) { items.delete(key); items.set(key, true); },
      remove: function (key) { return items.delete(key); },
      oldest: function () { return items.keys().next().value; },
      shift: function () {
        const key = items.keys().next().value;
        items.delete(key);
        return key;
      },
      keys: function () { return Array.from(items.keys()); }
    };
  }

  /* ------------------------------------------------------------------- ARC */

  /**
   * Megiddo and Modha's adaptive replacement cache. `p` is the target size of
   * T1 — the recency half — and every ghost hit moves it. The whole point is
   * that the two ghost lists are *evidence*: a hit in B1 says recency was
   * starved, a hit in B2 says frequency was, and there is nothing to tune.
   */
  function arc(capacity) {
    const state = { t1: list(), t2: list(), b1: list(), b2: list(), p: 0,
      capacity: capacity, counters: newCounters(), adaptations: 0 };

    return {
      name: 'arc',
      get: function (key) { return arcGet(state, key); },
      stats: function () {
        return statsOf(state.counters, 'arc', capacity,
          { p: state.p, t1: state.t1.size(), t2: state.t2.size(), adaptations: state.adaptations });
      },
      state: function () {
        return { t1: state.t1.keys(), t2: state.t2.keys(), b1: state.b1.keys(),
          b2: state.b2.keys(), p: state.p };
      }
    };
  }

  function arcGet(state, key) {
    state.counters.accesses += 1;
    if (state.t1.has(key) || state.t2.has(key)) {
      state.t1.remove(key);
      state.t2.push(key);
      state.counters.hits += 1;
      return true;
    }
    state.counters.misses += 1;
    if (state.b1.has(key)) return arcGhostHit(state, key, 'b1');
    if (state.b2.has(key)) return arcGhostHit(state, key, 'b2');
    arcMiss(state, key);
    return false;
  }

  /** A hit in a ghost list is the adaptation signal, and the only one. */
  function arcGhostHit(state, key, which) {
    const b1 = Math.max(1, state.b1.size());
    const b2 = Math.max(1, state.b2.size());

    state.adaptations += 1;
    if (which === 'b1') state.p = Math.min(state.capacity, state.p + Math.max(1, b2 / b1));
    else state.p = Math.max(0, state.p - Math.max(1, b1 / b2));
    arcReplace(state, which === 'b2');
    state[which].remove(key);
    state.t2.push(key);
    return false;
  }

  function arcMiss(state, key) {
    const c = state.capacity;

    if (state.t1.size() + state.b1.size() === c) {
      if (state.t1.size() < c) { state.b1.shift(); arcReplace(state, false); }
      else { state.t1.shift(); state.counters.evictions += 1; }
    } else if (state.t1.size() + state.t2.size() + state.b1.size() + state.b2.size() >= c) {
      if (state.t1.size() + state.t2.size() + state.b1.size() + state.b2.size() >= 2 * c) {
        state.b2.shift();
      }
      arcReplace(state, false);
    }
    state.t1.push(key);
  }

  /** Take the victim from T1 when recency is over its target, else from T2;
   *  the evicted key becomes a ghost in the matching B list. */
  function arcReplace(state, inB2) {
    const overTarget = state.t1.size() > state.p ||
      (inB2 && state.t1.size() === state.p);

    if (state.t1.size() >= 1 && overTarget) {
      state.b1.push(state.t1.shift());
      state.counters.evictions += 1;
      return;
    }
    if (state.t2.size() === 0) return;
    state.b2.push(state.t2.shift());
    state.counters.evictions += 1;
  }

  /* ------------------------------------------------------------------- 2Q */

  /**
   * A small FIFO for newcomers, a ghost FIFO of what fell out of it, and a
   * main LRU that admits only on a SECOND sighting. A scan fills the small
   * queue, its keys expire into the ghost list unseen, and the main cache is
   * never touched — which is the whole design in one sentence.
   */
  function twoQueue(capacity, options) {
    const settings = options || {};
    const state = { in: list(), out: list(), main: list(),
      kin: Math.max(1, Math.round(capacity * (settings.inShare === undefined
        ? 0.25 : settings.inShare))),
      kout: Math.max(1, Math.round(capacity * (settings.outShare === undefined
        ? 0.5 : settings.outShare))),
      capacity: capacity, counters: newCounters(), promotions: 0 };

    state.kmain = Math.max(1, capacity - state.kin);
    return {
      name: 'two-queue',
      get: function (key) { return twoQueueGet(state, key); },
      stats: function () {
        return statsOf(state.counters, 'two-queue', capacity,
          { kin: state.kin, kout: state.kout, promotions: state.promotions });
      },
      state: function () {
        return { in: state.in.keys(), out: state.out.keys(), main: state.main.keys() };
      }
    };
  }

  function twoQueueGet(state, key) {
    state.counters.accesses += 1;
    if (state.main.has(key)) { state.main.push(key); state.counters.hits += 1; return true; }
    /* A hit in the FIFO does NOT move it: the queue is about age, not use. */
    if (state.in.has(key)) { state.counters.hits += 1; return true; }
    state.counters.misses += 1;
    if (state.out.has(key)) {
      state.out.remove(key);
      state.promotions += 1;
      pushBounded(state.main, key, state.kmain, state.counters);
      return false;
    }
    admitToIn(state, key);
    return false;
  }

  function admitToIn(state, key) {
    state.in.push(key);
    if (state.in.size() <= state.kin) return;
    const dropped = state.in.shift();
    state.counters.evictions += 1;
    state.out.push(dropped);
    if (state.out.size() > state.kout) state.out.shift();
  }

  function pushBounded(target, key, limit, counters) {
    target.push(key);
    if (target.size() <= limit) return;
    target.shift();
    counters.evictions += 1;
  }

  /* ------------------------------------------------------------ W-TinyLFU */

  /**
   * A count-min sketch of four-bit counters that halves everything once the
   * increment total reaches `sampleSize`. The halving is what separates this
   * from plain LFU: without it a key that was hot last week keeps its count
   * and becomes unevictable, and the decay is a shift rather than a scan of
   * live entries because the sketch has no key list to walk.
   */
  function frequencySketch(options) {
    const settings = options || {};
    const width = settings.width === undefined ? 1024 : settings.width;
    const depth = settings.depth === undefined ? 4 : settings.depth;
    const sampleSize = settings.sampleSize === undefined ? 10 * width : settings.sampleSize;
    const rows = [];
    const state = { additions: 0, resets: 0 };

    for (let d = 0; d < depth; d += 1) rows.push(new Uint8Array(width));
    return {
      increment: function (key) { return sketchIncrement(rows, state,
        { width: width, depth: depth, sampleSize: sampleSize, key: key }); },
      estimate: function (key) { return sketchEstimate(rows, key, width, depth); },
      resets: function () { return state.resets; }
    };
  }

  function hashOf(key, row, width) {
    let h = 2166136261 ^ (row * 0x9e3779b1);
    const text = String(key);

    for (let i = 0; i < text.length; i += 1) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    h ^= h >>> 15;
    h = Math.imul(h, 2246822507);
    h ^= h >>> 13;
    return (h >>> 0) % width;
  }

  function sketchIncrement(rows, state, control) {
    for (let d = 0; d < control.depth; d += 1) {
      const at = hashOf(control.key, d, control.width);
      if (rows[d][at] < 15) rows[d][at] += 1;
    }
    state.additions += 1;
    if (state.additions < control.sampleSize) return;
    for (let d = 0; d < control.depth; d += 1) {
      for (let i = 0; i < control.width; i += 1) rows[d][i] >>= 1;
    }
    state.additions = 0;
    state.resets += 1;
  }

  function sketchEstimate(rows, key, width, depth) {
    let best = 16;

    for (let d = 0; d < depth; d += 1) best = Math.min(best, rows[d][hashOf(key, d, width)]);
    return best;
  }

  /**
   * A 1% window LRU in front of a segmented main cache. A key evicted from the
   * window only enters the main cache if the sketch says it has been seen more
   * often than the main cache's next victim — so a scan's one-hit wonders are
   * refused admission rather than admitted and then evicted, which is what
   * makes the policy scan-resistant.
   */
  function windowTinyLfu(capacity, options) {
    const settings = options || {};
    const windowSize = Math.max(1, Math.round(capacity *
      (settings.windowShare === undefined ? 0.01 : settings.windowShare)));
    const state = { window: list(), probation: list(), protectedList: list(),
      sketch: frequencySketch(settings), counters: newCounters(),
      windowSize: windowSize, admitted: 0, rejected: 0,
      mainSize: Math.max(1, capacity - windowSize) };

    state.protectedSize = Math.max(1, Math.round(state.mainSize * 0.8));
    return {
      name: 'w-tinylfu',
      get: function (key) { return tinyLfuGet(state, key); },
      stats: function () {
        return statsOf(state.counters, 'w-tinylfu', capacity,
          { admitted: state.admitted, rejected: state.rejected, windowSize: windowSize,
            sketchResets: state.sketch.resets() });
      },
      state: function () {
        return { window: state.window.keys(), probation: state.probation.keys(),
          protected: state.protectedList.keys() };
      }
    };
  }

  function tinyLfuGet(state, key) {
    state.counters.accesses += 1;
    state.sketch.increment(key);
    if (state.window.has(key)) { state.window.push(key); state.counters.hits += 1; return true; }
    if (state.protectedList.has(key)) {
      state.protectedList.push(key);
      state.counters.hits += 1;
      return true;
    }
    if (state.probation.has(key)) { promoteToProtected(state, key); return true; }
    state.counters.misses += 1;
    admitToWindow(state, key);
    return false;
  }

  function promoteToProtected(state, key) {
    state.probation.remove(key);
    state.protectedList.push(key);
    state.counters.hits += 1;
    if (state.protectedList.size() <= state.protectedSize) return;
    state.probation.push(state.protectedList.shift());
    trimMain(state);
  }

  function admitToWindow(state, key) {
    state.window.push(key);
    if (state.window.size() <= state.windowSize) return;
    const candidate = state.window.shift();
    if (state.probation.size() + state.protectedList.size() < state.mainSize) {
      state.probation.push(candidate);
      state.admitted += 1;
      return;
    }
    contest(state, candidate);
  }

  /** The candidate must beat the main cache's next victim on frequency. A tie
   *  goes to the incumbent, which is what keeps a scan out. */
  function contest(state, candidate) {
    const victim = state.probation.size() > 0
      ? state.probation.oldest() : state.protectedList.oldest();

    if (victim === undefined) { state.probation.push(candidate); state.admitted += 1; return; }
    if (state.sketch.estimate(candidate) > state.sketch.estimate(victim)) {
      if (state.probation.size() > 0) state.probation.shift();
      else state.protectedList.shift();
      state.probation.push(candidate);
      state.admitted += 1;
      state.counters.evictions += 1;
      return;
    }
    state.rejected += 1;
    state.counters.evictions += 1;
  }

  function trimMain(state) {
    while (state.probation.size() + state.protectedList.size() > state.mainSize) {
      state.probation.shift();
      state.counters.evictions += 1;
    }
  }

  function create(name, capacity, options) {
    if (name === 'two-queue') return twoQueue(capacity, options);
    if (name === 'w-tinylfu') return windowTinyLfu(capacity, options);
    return arc(capacity);
  }

  return {
    NAMES: NAMES, create: create, list: list,
    arc: arc, twoQueue: twoQueue, windowTinyLfu: windowTinyLfu,
    frequencySketch: frequencySketch
  };
}));

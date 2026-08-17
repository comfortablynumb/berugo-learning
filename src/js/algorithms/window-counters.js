/**
 * Counting under a window and under decay: DGIM, the exponential histogram,
 * space-saving, lossy counting and a time-decayed counter.
 *
 * "How many ones in the last N" is the query with an impossibility proof
 * behind it: any exact answer needs Ω(N) bits, because the algorithm must be
 * able to distinguish every one of the 2^N possible windows. DGIM gives up
 * exactness and stores O(log² N) bits - bucket boundaries at powers of two,
 * with only the oldest bucket's contribution uncertain.
 *
 * "Top talkers right now" is the same shape of problem over a stream of keys.
 * Space-saving keeps m counters and never lets a new key start from zero: it
 * takes over the smallest counter and inherits its value as an error bound. So
 * every reported count is an over-estimate whose slack is known per key, and
 * every item with frequency above N/m is guaranteed to be in the table.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.WindowCounters = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  /* ------------------------------------------------- DGIM / exp. histogram */

  /**
   * Buckets of sizes 1, 2, 4, … each timestamped by its most recent one. At
   * most `perSize` buckets of any size survive; the oldest two of an overfull
   * size merge into one of the next size up, which is why the bucket count is
   * O(log N) and each timestamp is O(log N) bits.
   *
   * The estimate counts every bucket fully inside the window plus *half* of
   * the one that straddles the boundary, because that is the expected position
   * of the boundary inside it. DGIM is `perSize: 2`; larger values are the
   * exponential histogram, trading memory for a tighter bound.
   */
  function dgim(options) {
    const settings = options || {};
    const windowSize = Math.max(2, Math.floor(settings.windowSize || 1000));
    const perSize = Math.max(2, Math.floor(settings.perSize || 2));
    let buckets = [];                          // newest first
    let now = 0;
    let merges = 0;

    function expire() {
      buckets = buckets.filter(function (bucket) { return now - bucket.timestamp < windowSize; });
    }

    /**
     * Repair the "at most perSize buckets of any one size" invariant. Buckets
     * run newest-first with non-decreasing sizes, so an overfull run is a
     * contiguous span and the two to merge are its two oldest members. One
     * merge can overfill the next size up, so this repeats until stable - at
     * most O(log N) times, because there are only that many sizes.
     */
    function collapse() {
      let changed = true;
      while (changed) {
        changed = false;
        let i = 0;
        while (i < buckets.length) {
          const size = buckets[i].size;
          let j = i;
          while (j < buckets.length && buckets[j].size === size) j += 1;
          if (j - i > perSize) { mergeOldestTwo(j, size); changed = true; break; }
          i = j;
        }
      }
    }

    /** The merged bucket keeps the *newer* timestamp: it is the last one in it. */
    function mergeOldestTwo(runEnd, size) {
      buckets[runEnd - 2] = { size: size * 2, timestamp: buckets[runEnd - 2].timestamp };
      buckets.splice(runEnd - 1, 1);
      merges += 1;
    }

    function add(bit) {
      now += 1;
      if (bit) {
        buckets.unshift({ size: 1, timestamp: now });
        collapse();
      }
      expire();
      return now;
    }

    function estimate() {
      if (!buckets.length) return 0;
      let total = 0;
      for (let i = 0; i < buckets.length - 1; i += 1) total += buckets[i].size;
      return total + buckets[buckets.length - 1].size / 2;
    }

    /** The guarantee, stated for the current bucket layout rather than quoted. */
    function relativeBound() {
      if (buckets.length <= 1) return 0;
      const oldest = buckets[buckets.length - 1].size;
      let rest = 0;
      for (let i = 0; i < buckets.length - 1; i += 1) rest += buckets[i].size;
      return (oldest / 2) / Math.max(1, rest + oldest / 2);
    }

    return {
      kind: 'dgim',
      add: add,
      estimate: estimate,
      relativeBound: relativeBound,
      buckets: function () { return buckets.slice(); },
      bucketCount: function () { return buckets.length; },
      windowSize: function () { return windowSize; },
      perSize: function () { return perSize; },
      now: function () { return now; },
      /* size and timestamp are each O(log N) bits, so this is the real memory
         claim rather than "a handful of buckets". */
      bits: function () { return buckets.length * 2 * Math.ceil(Math.log2(windowSize + 1)); },
      stats: function () { return { merges: merges, buckets: buckets.length }; }
    };
  }

  /** The exact reference: a ring of the last N bits. */
  function exactWindow(options) {
    const windowSize = Math.max(2, Math.floor(options.windowSize || 1000));
    const ring = new Uint8Array(windowSize);
    let head = 0;
    let ones = 0;
    let seen = 0;

    return {
      kind: 'exact-window',
      add: function (bit) {
        if (seen >= windowSize) ones -= ring[head];
        ring[head] = bit ? 1 : 0;
        ones += ring[head];
        head = (head + 1) % windowSize;
        seen += 1;
      },
      estimate: function () { return ones; },
      bits: function () { return windowSize; },
      count: function () { return seen; }
    };
  }

  /* --------------------------------------------------------- space-saving */

  /**
   * Metwally, Agrawal and El Abbadi's Stream-Summary: entries live in buckets
   * of equal count, and the buckets form an ascending doubly-linked list, so
   * the minimum is the head and every update is O(1). A linear scan for the
   * minimum would be O(m) per miss, which is the difference between a sketch
   * and a demo that hangs.
   */
  function spaceSaving(options) {
    const settings = options || {};
    const capacity = Math.max(1, Math.floor(settings.counters || 100));
    const entries = new Map();
    let head = null;
    let total = 0;
    let replacements = 0;

    function insertBucketAfter(previous, value) {
      const bucket = { value: value, items: new Set(), prev: previous, next: previous ? previous.next : head };
      if (bucket.next) bucket.next.prev = bucket;
      if (previous) previous.next = bucket; else head = bucket;
      return bucket;
    }

    function bucketFor(from, value) {
      let cursor = from;
      while (cursor && cursor.value < value) {
        if (!cursor.next || cursor.next.value > value) return insertBucketAfter(cursor, value);
        cursor = cursor.next;
      }
      if (cursor && cursor.value === value) return cursor;
      if (!head || head.value > value) {
        const bucket = { value: value, items: new Set(), prev: null, next: head };
        if (head) head.prev = bucket;
        head = bucket;
        return bucket;
      }
      return insertBucketAfter(cursor, value);
    }

    function detach(entry) {
      const bucket = entry.bucket;
      bucket.items.delete(entry);
      if (bucket.items.size) return bucket;
      if (bucket.prev) bucket.prev.next = bucket.next; else head = bucket.next;
      if (bucket.next) bucket.next.prev = bucket.prev;
      return bucket.prev;
    }

    function place(entry, value) {
      const from = entry.bucket ? detach(entry) : null;
      const bucket = bucketFor(from || head, value);
      entry.count = value;
      entry.bucket = bucket;
      bucket.items.add(entry);
    }

    function add(key, count) {
      const amount = count === undefined ? 1 : count;
      total += amount;

      const existing = entries.get(key);
      if (existing) { place(existing, existing.count + amount); return existing; }

      if (entries.size < capacity) {
        const entry = { key: key, count: 0, error: 0, bucket: null };
        entries.set(key, entry);
        place(entry, amount);
        return entry;
      }

      const victim = head.items.values().next().value;
      entries.delete(victim.key);
      victim.key = key;
      victim.error = victim.count;
      place(victim, victim.count + amount);
      entries.set(key, victim);
      replacements += 1;
      return victim;
    }

    function top(k) {
      return Array.from(entries.values())
        .sort(function (a, b) { return b.count - a.count; })
        .slice(0, k === undefined ? entries.size : k)
        .map(function (entry) {
          return { key: entry.key, count: entry.count, error: entry.error, lower: entry.count - entry.error };
        });
    }

    return {
      kind: 'space-saving',
      add: add,
      top: top,
      estimate: function (key) { return entries.has(key) ? entries.get(key).count : 0; },
      errorOf: function (key) { return entries.has(key) ? entries.get(key).error : Infinity; },
      minimum: function () { return head ? head.value : 0; },
      capacity: function () { return capacity; },
      size: function () { return entries.size; },
      total: function () { return total; },
      /** Every key with frequency above this is guaranteed to be in the table. */
      guaranteedThreshold: function () { return total / capacity; },
      bytes: function () { return entries.size * 40; },
      stats: function () { return { replacements: replacements, monitored: entries.size }; }
    };
  }

  /* --------------------------------------------------------- lossy counting */

  /**
   * Manku and Motwani's lossy counting. The stream is cut into windows of
   * ⌈1/ε⌉ items; a key first seen in window b is stored with a handicap of
   * b − 1, and at every window boundary every key whose count plus handicap has
   * not reached the current window number is dropped. A key that survives has
   * been frequent since it arrived; a key that never reaches ε·N cannot.
   */
  function lossyCounting(options) {
    const settings = options || {};
    const epsilon = Math.min(0.5, Math.max(1e-6, settings.epsilon || 0.001));
    const width = Math.ceil(1 / epsilon);
    const table = new Map();
    let seen = 0;
    let bucket = 1;
    let evictions = 0;

    function add(key) {
      seen += 1;
      const entry = table.get(key);
      if (entry) entry.count += 1;
      else table.set(key, { count: 1, delta: bucket - 1 });

      if (seen % width !== 0) return;
      prune();
      bucket += 1;
    }

    function prune() {
      table.forEach(function (entry, key) {
        if (entry.count + entry.delta <= bucket) { table.delete(key); evictions += 1; }
      });
    }

    function top(support) {
      const threshold = (support - epsilon) * seen;
      return Array.from(table.entries())
        .filter(function (pair) { return pair[1].count >= threshold; })
        .map(function (pair) {
          return { key: pair[0], count: pair[1].count, lower: pair[1].count, upper: pair[1].count + pair[1].delta };
        })
        .sort(function (a, b) { return b.count - a.count; });
    }

    return {
      kind: 'lossy-counting',
      add: add,
      top: top,
      estimate: function (key) { return table.has(key) ? table.get(key).count : 0; },
      epsilon: function () { return epsilon; },
      width: function () { return width; },
      size: function () { return table.size; },
      total: function () { return seen; },
      /** Counts are under-estimates by at most εN, never over-estimates. */
      errorBound: function () { return epsilon * seen; },
      bytes: function () { return table.size * 40; },
      stats: function () { return { evictions: evictions, monitored: table.size, bucket: bucket }; }
    };
  }

  /* ------------------------------------------------------- decayed counters */

  /**
   * Exponentially decayed counts: every counter is multiplied by 2^(−Δt/H)
   * before an update, so an event's contribution halves every H ticks. Kept
   * lazily - a counter is only decayed when it is touched - so the cost is per
   * update rather than per tick, which is what makes it usable for millions of
   * keys.
   */
  function decayedCounters(options) {
    const settings = options || {};
    const halfLife = Math.max(1, settings.halfLife || 1000);
    const lambda = Math.LN2 / halfLife;
    const table = new Map();
    let now = 0;

    function decayed(entry, at) {
      return entry.value * Math.exp(-lambda * (at - entry.at));
    }

    function add(key, amount) {
      const value = amount === undefined ? 1 : amount;
      const entry = table.get(key);
      if (!entry) { table.set(key, { value: value, at: now }); return value; }
      entry.value = decayed(entry, now) + value;
      entry.at = now;
      return entry.value;
    }

    return {
      kind: 'decayed',
      add: add,
      tick: function (steps) { now += steps === undefined ? 1 : steps; return now; },
      estimate: function (key) {
        const entry = table.get(key);
        return entry ? decayed(entry, now) : 0;
      },
      top: function (k) {
        const out = [];
        table.forEach(function (entry, key) { out.push({ key: key, value: decayed(entry, now) }); });
        return out.sort(function (a, b) { return b.value - a.value; }).slice(0, k || out.length);
      },
      halfLife: function () { return halfLife; },
      size: function () { return table.size; },
      now: function () { return now; },
      bytes: function () { return table.size * 24; }
    };
  }

  return {
    dgim: dgim,
    exactWindow: exactWindow,
    spaceSaving: spaceSaving,
    lossyCounting: lossyCounting,
    decayedCounters: decayedCounters
  };
}));

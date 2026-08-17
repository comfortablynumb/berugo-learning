/**
 * Timing wheels: why kernels do not use a heap for timers.
 *
 * A heap gives O(log n) insert and O(log n) expiry. A timing wheel gives O(1)
 * insert, O(1) cancel and O(1) amortised expiry, and it does it by giving up
 * something a timeout can afford: precision. Time is quantised into ticks, a
 * timer is filed in the bucket for the tick it is due, and expiry is "walk one
 * bucket" rather than "search a structure".
 *
 * Two variants live here. The simple wheel has one array of buckets and stores
 * a rounds counter for timers further out than the wheel is wide - so a tick
 * touches every timer in the bucket, and a long-dated timer is touched once
 * per revolution. The hierarchical wheel instead keeps several wheels, each
 * covering `slots` times the span of the one below, and cascades entries down
 * a level when the lower wheel wraps. That is the Linux design, and the cost
 * of a long-dated timer becomes O(levels) rather than O(rounds).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.TimerWheel = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function newStats() {
    return {
      adds: 0, cancels: 0, ticks: 0, fired: 0,
      bucketTouches: 0, entryTouches: 0, cascades: 0, cascadedEntries: 0
    };
  }

  function create(options) {
    const settings = options || {};
    const slots = Math.max(2, settings.slots || 256);
    const levels = Math.max(1, settings.levels || 1);

    /* wheels[level][slot] is a list of entries. Level L covers slots^(L+1)
       ticks, so the whole structure spans slots^levels. */
    const wheels = [];
    for (let level = 0; level < levels; level += 1) {
      wheels.push(Array.from({ length: slots }, function () { return []; }));
    }

    const byId = new Map();
    let now = 0;
    let pending = 0;
    let stats = newStats();

    function spanOf(level) {
      return Math.pow(slots, level);
    }

    /** Which wheel a delay belongs on, and which slot of it. */
    function placementFor(due) {
      const delay = due - now;
      for (let level = 0; level < levels; level += 1) {
        if (delay < spanOf(level + 1) || level === levels - 1) {
          const slot = Math.floor(due / spanOf(level)) % slots;
          const rounds = levels === 1 ? Math.floor(delay / slots) : 0;
          return { level: level, slot: slot, rounds: rounds };
        }
      }
      return { level: levels - 1, slot: 0, rounds: 0 };
    }

    function add(delay, id) {
      stats.adds += 1;
      const due = now + Math.max(1, Math.floor(delay));
      const at = placementFor(due);
      const entry = { id: id, due: due, rounds: at.rounds, level: at.level, slot: at.slot };

      wheels[at.level][at.slot].push(entry);
      byId.set(id, entry);
      pending += 1;
      return entry;
    }

    /** Cancellation is a flag rather than a splice: removing from the middle
     *  of a bucket costs the bucket length, and a cancelled entry is dropped
     *  for free the next time its bucket is walked. */
    function cancel(id) {
      stats.cancels += 1;
      const entry = byId.get(id);
      if (!entry || entry.cancelled) return false;
      entry.cancelled = true;
      byId.delete(id);
      pending -= 1;
      return true;
    }

    /** Move everything in the current slot of `level` down to where it belongs
     *  now that the lower wheels have wrapped. */
    function cascade(level) {
      stats.cascades += 1;
      const slot = Math.floor(now / spanOf(level)) % slots;
      const bucket = wheels[level][slot];
      wheels[level][slot] = [];

      bucket.forEach(function (entry) {
        stats.cascadedEntries += 1;
        if (entry.cancelled) return;
        const at = placementFor(entry.due);
        entry.level = at.level;
        entry.slot = at.slot;
        entry.rounds = at.rounds;
        wheels[at.level][at.slot].push(entry);
      });
    }

    function tick() {
      stats.ticks += 1;
      now += 1;

      /* Cascade before firing: a higher wheel hands its entries down when the
         wheels below it have wrapped past this point. */
      for (let level = 1; level < levels; level += 1) {
        if (now % spanOf(level) === 0) cascade(level);
      }

      const slot = now % slots;
      const bucket = wheels[0][slot];
      stats.bucketTouches += 1;

      const kept = [];
      const fired = [];

      /* The decision is the due tick, not a rounds counter. A counter is the
         usual optimisation and it is off by a revolution when the delay is an
         exact multiple of the wheel width — the entry lands in the slot it was
         filed from, so the first visit to that slot IS the due tick. Comparing
         the due tick costs one comparison and cannot be wrong; `rounds` is
         kept only to report how many revolutions an entry has left. */
      bucket.forEach(function (entry) {
        stats.entryTouches += 1;
        if (entry.cancelled) return;
        if (entry.due > now) {
          entry.rounds = Math.floor((entry.due - now) / slots);
          kept.push(entry);
          return;
        }
        fired.push(entry.id);
        byId.delete(entry.id);
        pending -= 1;
      });

      wheels[0][slot] = kept;
      stats.fired += fired.length;
      return fired;
    }

    function checkInvariants() {
      const errors = [];
      let counted = 0;

      wheels.forEach(function (wheel, level) {
        wheel.forEach(function (bucket, slot) {
          bucket.forEach(function (entry) {
            if (entry.cancelled) return;
            counted += 1;
            if (entry.due <= now) errors.push('timer ' + entry.id + ' is overdue and still filed');
            if (level === 0 && entry.slot !== slot) errors.push('timer ' + entry.id + ' is in the wrong slot');
          });
        });
      });

      if (counted !== pending) errors.push('walked ' + counted + ' live timers, pending says ' + pending);
      return { ok: errors.length === 0, errors: errors };
    }

    function occupancy() {
      return wheels.map(function (wheel) {
        return wheel.reduce(function (total, bucket) { return total + bucket.length; }, 0);
      });
    }

    return {
      name: levels > 1 ? 'timer-wheel-' + levels + 'x' + slots : 'timer-wheel-' + slots,
      add: add,
      cancel: cancel,
      tick: tick,
      now: function () { return now; },
      pending: function () { return pending; },
      slots: function () { return slots; },
      levels: function () { return levels; },
      span: function () { return Math.pow(slots, levels); },
      occupancy: occupancy,
      checkInvariants: checkInvariants,
      stats: function () { return Object.assign({ pending: pending, now: now }, stats); },
      resetStats: function () { stats = newStats(); }
    };
  }

  /** The same API backed by a heap, so the demo can compare like with like. */
  function heapBacked(heapFactory) {
    const heap = heapFactory();
    let now = 0;
    const cancelled = new Set();
    let stats = newStats();
    let pending = 0;

    return {
      name: 'heap-timers',
      add: function (delay, id) {
        stats.adds += 1;
        pending += 1;
        heap.push(now + Math.max(1, Math.floor(delay)), id);
        return { id: id, due: now + delay };
      },
      cancel: function (id) {
        stats.cancels += 1;
        if (cancelled.has(id)) return false;
        cancelled.add(id);
        pending -= 1;
        return true;
      },
      tick: function () {
        stats.ticks += 1;
        now += 1;
        const fired = [];
        while (heap.size() && heap.peek().key <= now) {
          stats.entryTouches += 1;
          const top = heap.pop();
          if (cancelled.has(top.id)) { cancelled.delete(top.id); continue; }
          fired.push(top.id);
          pending -= 1;
        }
        stats.fired += fired.length;
        return fired;
      },
      now: function () { return now; },
      pending: function () { return pending; },
      heap: function () { return heap; },
      checkInvariants: function () { return { ok: true, errors: [] }; },
      stats: function () {
        return Object.assign({ pending: pending, now: now, comparisons: heap.stats().comparisons }, stats);
      },
      resetStats: function () { stats = newStats(); heap.resetStats(); }
    };
  }

  return { create: create, heapBacked: heapBacked, newStats: newStats };
}));

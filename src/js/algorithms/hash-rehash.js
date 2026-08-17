/**
 * Resizing, two ways, with the per-operation work recorded.
 *
 * A synchronous rehash is amortised O(1) and that is exactly the problem: the
 * amortised bound says nothing about the one insert that moved a million
 * entries, and that insert is your p99.9. Incremental rehash keeps both
 * tables alive and moves a fixed number of slots per operation, so the trace
 * is flat and the memory is doubled for the duration.
 *
 * Both tables are linear-probed, so a slot vacated by a migration or a delete
 * becomes DEAD rather than EMPTY. Emptying it would cut every probe chain
 * running through it, and during a migration that loses a key outright: it is
 * no longer reachable in the old table and not yet copied into the new one.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.HashRehash = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const EMPTY = 0;
  const FULL = 1;
  const DEAD = 2;                                     // migrated out, or deleted

  function create(options) {
    const settings = options || {};
    const hash = settings.hash;
    const mode = settings.mode || 'synchronous';       // synchronous | incremental
    const movePerOp = settings.movePerOp || 2;
    const maxLoad = settings.maxLoad || 0.7;

    let main = newTable(settings.capacity || 16);
    let old = null;                                     // non-null during migration
    let cursor = 0;
    let count = 0;
    let used = 0;                                       // slots of `main` that are not EMPTY
    const trace = [];
    const stats = { inserts: 0, lookups: 0, deletes: 0, resizes: 0, moved: 0, peakWork: 0 };

    /**
     * Walks the probe chain to the key, or to the first EMPTY slot. A DEAD slot
     * never stops the walk; it is only remembered, so an insert can reuse it
     * instead of extending the chain.
     */
    function slotIn(table, key) {
      const capacity = table.keys.length;
      let at = hash(key) % capacity;
      let work = 1;
      let dead = -1;

      while (table.state[at] !== EMPTY) {
        if (table.state[at] === FULL && table.keys[at] === key) return { at: at, work: work, dead: dead };
        if (table.state[at] === DEAD && dead < 0) dead = at;
        at = (at + 1) % capacity;
        work += 1;
      }
      return { at: at, work: work, dead: dead };
    }

    function set(key, value) {
      stats.inserts += 1;
      let work = migrateStep();

      if (old) {
        const found = slotIn(old, key);
        work += found.work;
        if (old.state[found.at] === FULL) { old.values[found.at] = value; return record(work); }
      }

      const target = slotIn(main, key);
      work += target.work;
      write(target, key, value);

      if (!old && (used / main.keys.length) > maxLoad) work += grow();
      return record(work);
    }

    /** Places a key in `main` at the slot the probe found, reusing a DEAD one if there was one. */
    function write(target, key, value) {
      const at = main.state[target.at] === FULL || target.dead < 0 ? target.at : target.dead;
      if (main.state[at] !== FULL) {
        count += 1;
        if (main.state[at] === EMPTY) used += 1;
        main.state[at] = FULL;
      }
      main.keys[at] = key;
      main.values[at] = value;
    }

    function get(key) {
      stats.lookups += 1;
      if (old) {
        const found = slotIn(old, key);
        if (old.state[found.at] === FULL) return old.values[found.at];
      }
      const target = slotIn(main, key);
      return main.state[target.at] === FULL ? main.values[target.at] : undefined;
    }

    function remove(key) {
      stats.deletes += 1;
      migrateStep();
      const table = removalTable(key);
      if (!table) return false;

      const found = slotIn(table.table, key);
      table.table.state[found.at] = DEAD;
      table.table.keys[found.at] = undefined;
      table.table.values[found.at] = undefined;
      count -= 1;
      return true;
    }

    function removalTable(key) {
      if (old) {
        const found = slotIn(old, key);
        if (old.state[found.at] === FULL) return { table: old };
      }
      const target = slotIn(main, key);
      return main.state[target.at] === FULL ? { table: main } : null;
    }

    /** Synchronous: move everything now. Incremental: just swap the tables. */
    function grow() {
      stats.resizes += 1;
      const previous = main;
      main = newTable(previous.keys.length * 2);
      used = 0;

      if (mode === 'incremental') { old = previous; cursor = 0; return 1; }

      let work = 0;
      for (let i = 0; i < previous.keys.length; i += 1) {
        if (previous.state[i] !== FULL) continue;
        const target = slotIn(main, previous.keys[i]);
        main.state[target.at] = FULL;
        main.keys[target.at] = previous.keys[i];
        main.values[target.at] = previous.values[i];
        used += 1;
        work += target.work;
        stats.moved += 1;
      }
      return work;
    }

    /** Moves at most `movePerOp` occupied slots out of the old table. */
    function migrateStep() {
      if (!old) return 0;
      let work = 0;
      let moved = 0;

      while (cursor < old.keys.length && moved < movePerOp) {
        if (old.state[cursor] === FULL) {
          const target = slotIn(main, old.keys[cursor]);
          main.state[target.at] = FULL;
          main.keys[target.at] = old.keys[cursor];
          main.values[target.at] = old.values[cursor];
          used += 1;
          old.state[cursor] = DEAD;            // not EMPTY: the chain must survive
          old.keys[cursor] = undefined;
          work += target.work;
          moved += 1;
          stats.moved += 1;
        }
        cursor += 1;
        work += 1;
      }

      if (cursor >= old.keys.length) old = null;
      return work;
    }

    function record(work) {
      trace.push(work);
      stats.peakWork = Math.max(stats.peakWork, work);
      return work;
    }

    return {
      name: mode + ' rehash',
      set: set,
      get: get,
      delete: remove,
      size: function () { return count; },
      capacity: function () { return main.keys.length + (old ? old.keys.length : 0); },
      migrating: function () { return Boolean(old); },
      trace: function () { return trace.slice(); },
      stats: function () {
        return Object.assign({}, stats, {
          load: count / main.keys.length,
          insertProbes: trace.reduce(function (a, b) { return a + b; }, 0),
          lookupProbes: 0,
          percentile: function (p) { return percentile(trace, p); }
        });
      }
    };
  }

  function newTable(capacity) {
    return {
      keys: new Array(capacity).fill(undefined),
      values: new Array(capacity).fill(undefined),
      state: new Uint8Array(capacity)
    };
  }

  function percentile(values, p) {
    if (!values.length) return 0;
    const sorted = values.slice().sort(function (a, b) { return a - b; });
    return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
  }

  /** Runs both modes over the same insert stream and returns the two traces. */
  function compare(options) {
    return ['synchronous', 'incremental'].map(function (mode) {
      const table = create({
        hash: options.hash, mode: mode,
        movePerOp: options.movePerOp || 2, capacity: options.capacity || 16
      });
      options.keys.forEach(function (key, i) { table.set(key, i); });

      const trace = table.trace();
      return {
        mode: mode,
        trace: trace,
        peak: table.stats().peakWork,
        median: percentile(trace, 0.5),
        p99: percentile(trace, 0.99),
        p999: percentile(trace, 0.999),
        total: trace.reduce(function (a, b) { return a + b; }, 0),
        allFound: options.keys.every(function (key, i) { return table.get(key) === i; })
      };
    });
  }

  return { create: create, compare: compare, percentile: percentile };
}));

/**
 * An insertion-ordered map with O(1) delete - the structure behind
 * JavaScript's own `Map`, and the reason iteration order is guaranteed there
 * and merely conventional on plain objects.
 *
 * Entries live in an append-only array; an index maps key to position. Delete
 * punches a hole rather than splicing, so it is O(1), and the array is
 * compacted when the holes outnumber the live entries. Without that
 * compaction the array grows without bound in a churn workload, which is the
 * bug this section exists to make visible.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.OrderedMap = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function create(options) {
    const settings = options || {};
    const compactAt = settings.compactAt === undefined ? 0.5 : settings.compactAt;

    let entries = [];                 // { key, value } or null for a hole
    const index = new Map();          // key -> position in entries
    let holes = 0;
    const stats = { sets: 0, deletes: 0, compactions: 0, entriesMoved: 0, peakEntries: 0 };

    function set(key, value) {
      stats.sets += 1;
      const at = index.get(key);
      if (at !== undefined) { entries[at].value = value; return false; }

      index.set(key, entries.length);
      entries.push({ key: key, value: value });
      stats.peakEntries = Math.max(stats.peakEntries, entries.length);
      return true;
    }

    function get(key) {
      const at = index.get(key);
      return at === undefined ? undefined : entries[at].value;
    }

    function remove(key) {
      const at = index.get(key);
      if (at === undefined) return false;

      stats.deletes += 1;
      entries[at] = null;
      index.delete(key);
      holes += 1;
      if (compactAt > 0 && holes > Math.max(8, entries.length * compactAt)) compact();
      return true;
    }

    /** Rebuild the array in order, dropping the holes and reindexing. */
    function compact() {
      const live = [];
      entries.forEach(function (entry) {
        if (!entry) return;
        index.set(entry.key, live.length);
        live.push(entry);
      });
      stats.entriesMoved += live.length;
      stats.compactions += 1;
      entries = live;
      holes = 0;
    }

    function keys() {
      const out = [];
      entries.forEach(function (entry) { if (entry) out.push(entry.key); });
      return out;
    }

    return {
      name: 'ordered map',
      set: set,
      get: get,
      delete: remove,
      keys: keys,
      forEach: function (visit) {
        entries.forEach(function (entry) { if (entry) visit(entry.value, entry.key); });
      },
      size: function () { return index.size; },
      capacity: function () { return Math.max(1, entries.length); },
      holes: function () { return holes; },
      slots: function () { return entries.length; },
      stats: function () {
        return Object.assign({}, stats, {
          holes: holes,
          slots: entries.length,
          wasted: entries.length ? holes / entries.length : 0,
          lookups: 0, inserts: stats.sets, insertProbes: stats.sets, lookupProbes: 0
        });
      }
    };
  }

  /**
   * The workload that separates the two: insert n, then delete and re-insert
   * forever. Without compaction the backing array grows linearly in the
   * number of deletes while the map size stays flat.
   */
  function churn(options) {
    const map = create({ compactAt: options.compactAt });
    const rounds = options.rounds || 10000;
    const live = options.liveKeys || 1000;

    for (let i = 0; i < live; i += 1) map.set('k' + i, i);
    for (let round = 0; round < rounds; round += 1) {
      map.delete('k' + (round % live));
      map.set('k' + (round % live), round);
    }

    return {
      size: map.size(),
      slots: map.slots(),
      growth: map.slots() / Math.max(1, map.size()),
      stats: map.stats(),
      ordered: map.keys().length === map.size()
    };
  }

  return { create: create, churn: churn };
}));

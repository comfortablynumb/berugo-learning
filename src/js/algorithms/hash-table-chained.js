/**
 * Separate chaining, with the treeify threshold real map implementations use.
 *
 * The bucket is a plain array until it reaches `treeifyAt` entries, at which
 * point it becomes a sorted array searched by binary search. That is not what
 * the JDK does internally (it uses a red-black tree), but it has the property
 * the mitigation exists for: the worst-case bucket goes from O(k) to O(log k),
 * so a flood of colliding keys stops being a denial of service.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.HashTableChained = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function create(options) {
    const settings = options || {};
    const hash = settings.hash;
    const treeifyAt = settings.treeifyAt || 0;         // 0 disables the mitigation
    const maxLoad = settings.maxLoad || 0.75;

    let buckets = new Array(settings.capacity || 16).fill(null);
    let count = 0;
    const stats = newStats();

    function slotOf(key) {
      return hash(key) % buckets.length;
    }

    function set(key, value) {
      const bucket = buckets[slotOf(key)] || (buckets[slotOf(key)] = { entries: [], tree: false });
      const at = locate(bucket, key, 'insertProbes');
      stats.inserts += 1;

      if (at >= 0) { bucket.entries[at].value = value; return false; }
      insertEntry(bucket, { key: key, value: value });
      count += 1;
      if (treeifyAt && !bucket.tree && bucket.entries.length >= treeifyAt) treeify(bucket);
      if (count / buckets.length > maxLoad) grow();
      return true;
    }

    function get(key) {
      const bucket = buckets[slotOf(key)];
      stats.lookups += 1;
      if (!bucket) { stats.lookupProbes += 1; return undefined; }
      const at = locate(bucket, key, 'lookupProbes');
      return at >= 0 ? bucket.entries[at].value : undefined;
    }

    function remove(key) {
      const bucket = buckets[slotOf(key)];
      stats.deletes += 1;
      if (!bucket) return false;
      const at = locate(bucket, key, 'lookupProbes');
      if (at < 0) return false;
      bucket.entries.splice(at, 1);
      count -= 1;
      return true;
    }

    /**
     * Linear for a list bucket, binary for a treeified one. The comparisons are
     * charged to the counter of the operation that asked for them - charging
     * them to both makes `lookupProbes / lookups` report the insert path as
     * well, which is how a chain of 2 000 comes out as 2 001 probes per lookup
     * instead of the 1 000.5 a chain of that length actually costs.
     */
    function locate(bucket, key, counter) {
      if (!bucket.tree) {
        for (let i = 0; i < bucket.entries.length; i += 1) {
          stats[counter] += 1;
          if (bucket.entries[i].key === key) return i;
        }
        stats[counter] += 1;
        return -1;
      }
      return binarySearch(bucket, key, counter);
    }

    function binarySearch(bucket, key, counter) {
      let lo = 0;
      let hi = bucket.entries.length - 1;
      while (lo <= hi) {
        const mid = (lo + hi) >>> 1;
        stats[counter] += 1;
        if (bucket.entries[mid].key === key) return mid;
        if (bucket.entries[mid].key < key) lo = mid + 1; else hi = mid - 1;
      }
      return -1;
    }

    function insertEntry(bucket, entry) {
      if (!bucket.tree) { bucket.entries.push(entry); return; }
      let at = bucket.entries.length;
      while (at > 0 && bucket.entries[at - 1].key > entry.key) at -= 1;
      bucket.entries.splice(at, 0, entry);
    }

    function treeify(bucket) {
      bucket.entries.sort(function (a, b) { return a.key < b.key ? -1 : a.key > b.key ? 1 : 0; });
      bucket.tree = true;
      stats.treeified += 1;
    }

    function grow() {
      const previous = buckets;
      buckets = new Array(previous.length * 2).fill(null);
      count = 0;
      stats.resizes += 1;
      previous.forEach(function (bucket) {
        if (!bucket) return;
        bucket.entries.forEach(function (entry) { set(entry.key, entry.value); });
      });
    }

    function occupancy() {
      return buckets.map(function (bucket) {
        return bucket ? { length: bucket.entries.length, tree: bucket.tree } : { length: 0, tree: false };
      });
    }

    return {
      name: 'chaining' + (treeifyAt ? ' (treeify at ' + treeifyAt + ')' : ''),
      set: set,
      get: get,
      delete: remove,
      size: function () { return count; },
      capacity: function () { return buckets.length; },
      occupancy: occupancy,
      stats: function () {
        const lengths = occupancy().map(function (b) { return b.length; });
        return Object.assign({}, stats, {
          maxChain: lengths.reduce(function (m, l) { return Math.max(m, l); }, 0),
          emptyBuckets: lengths.filter(function (l) { return l === 0; }).length,
          treeBuckets: occupancy().filter(function (b) { return b.tree; }).length
        });
      }
    };
  }

  function newStats() {
    return {
      inserts: 0, lookups: 0, deletes: 0,
      insertProbes: 0, lookupProbes: 0,
      resizes: 0, treeified: 0
    };
  }

  return { create: create };
}));

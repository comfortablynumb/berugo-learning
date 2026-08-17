/**
 * Three schemes that bound the *worst* probe rather than the average one:
 * Robin Hood, hopscotch and cuckoo hashing.
 *
 * Robin Hood does not reduce the mean probe count at all - it cannot, the
 * mean is fixed by the load factor. It redistributes: rich entries (found
 * early) give up their slot to poor ones (found late), which collapses the
 * variance. Tail latency is made of variance, which is why it is worth it.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.HashTableRobinHood = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  /* ---------------------------------------------------------- robin hood */

  function createRobinHood(options) {
    const settings = options || {};
    const hash = settings.hash;
    const maxLoad = settings.maxLoad || 0.9;

    let capacity = settings.capacity || 16;
    let slots = new Array(capacity).fill(null);
    let count = 0;
    const stats = newStats();

    function homeOf(key) { return hash(key) % capacity; }

    function distance(slotIndex, home) { return (slotIndex - home + capacity) % capacity; }

    function set(key, value) {
      stats.inserts += 1;
      if ((count + 1) / capacity > maxLoad) grow();

      let carry = { key: key, value: value, home: homeOf(key) };
      let index = carry.home;
      let travelled = 0;

      for (let i = 0; i < capacity; i += 1) {
        stats.insertProbes += 1;
        const resident = slots[index];

        if (!resident) { slots[index] = carry; count += 1; stats.maxInsertProbe = Math.max(stats.maxInsertProbe, travelled + 1); return true; }
        if (resident.key === carry.key) { resident.value = carry.value; return false; }

        if (distance(index, resident.home) < travelled) {
          slots[index] = carry;
          carry = resident;
          travelled = distance(index, resident.home);
          stats.displacements += 1;
        }
        index = (index + 1) % capacity;
        travelled += 1;
      }
      grow();
      return set(carry.key, carry.value);
    }

    /** The invariant lets a lookup stop early: nobody poorer sits further on. */
    function get(key) {
      stats.lookups += 1;
      const home = homeOf(key);

      for (let i = 0; i < capacity; i += 1) {
        const index = (home + i) % capacity;
        const resident = slots[index];
        stats.lookupProbes += 1;
        if (!resident) return undefined;
        if (resident.key === key) return resident.value;
        if (distance(index, resident.home) < i) return undefined;
      }
      return undefined;
    }

    function remove(key) {
      stats.deletes += 1;
      const home = homeOf(key);

      for (let i = 0; i < capacity; i += 1) {
        const index = (home + i) % capacity;
        const resident = slots[index];
        stats.lookupProbes += 1;
        if (!resident) return false;
        if (resident.key === key) { slots[index] = null; count -= 1; shiftBack(index); return true; }
        if (distance(index, resident.home) < i) return false;
      }
      return false;
    }

    /** No tombstones: pull the following displaced entries one slot back. */
    function shiftBack(hole) {
      let gap = hole;
      let cursor = (hole + 1) % capacity;

      while (slots[cursor] && distance(cursor, slots[cursor].home) > 0) {
        slots[gap] = slots[cursor];
        slots[cursor] = null;
        stats.shiftSteps += 1;
        gap = cursor;
        cursor = (cursor + 1) % capacity;
      }
    }

    function grow() {
      const previous = slots;
      capacity *= 2;
      slots = new Array(capacity).fill(null);
      count = 0;
      stats.resizes += 1;
      previous.forEach(function (entry) { if (entry) set(entry.key, entry.value); });
    }

    function distances() {
      const out = [];
      slots.forEach(function (entry, index) {
        if (entry) out.push(distance(index, entry.home));
      });
      return out;
    }

    return {
      name: 'robin hood',
      set: set,
      get: get,
      delete: remove,
      size: function () { return count; },
      capacity: function () { return capacity; },
      distances: distances,
      stats: function () { return Object.assign({}, stats, summarise(distances())); }
    };
  }

  /* -------------------------------------------------------------- cuckoo */

  /**
   * Two tables, two hashes, one guarantee: a lookup is exactly two probes.
   * Insertion pays for it - an eviction chain can loop, and the only fix is
   * to rehash with new seeds.
   */
  function createCuckoo(options) {
    const settings = options || {};
    const hash = settings.hash;
    const maxKicks = settings.maxKicks || 32;

    let capacity = settings.capacity || 16;
    let left = new Array(capacity).fill(null);
    let right = new Array(capacity).fill(null);
    let count = 0;
    let seed = settings.seed || 1;
    const stats = newStats();

    function h1(key) { return hash(key + '|' + seed) % capacity; }
    function h2(key) { return hash(key + '#' + (seed + 7)) % capacity; }

    function get(key) {
      stats.lookups += 1;
      stats.lookupProbes += 2;
      const a = left[h1(key)];
      if (a && a.key === key) return a.value;
      const b = right[h2(key)];
      return b && b.key === key ? b.value : undefined;
    }

    function set(key, value) {
      stats.inserts += 1;
      if (get(key) !== undefined) { place(key, value); return false; }
      if (insertWithKicks({ key: key, value: value }, [])) { count += 1; return true; }
      rebuild();
      return set(key, value);
    }

    function place(key, value) {
      const a = left[h1(key)];
      if (a && a.key === key) { a.value = value; return; }
      const b = right[h2(key)];
      if (b && b.key === key) b.value = value;
    }

    function insertWithKicks(entry, chain) {
      let carry = entry;
      for (let kick = 0; kick < maxKicks; kick += 1) {
        stats.insertProbes += 1;
        const a = h1(carry.key);
        if (!left[a]) { left[a] = carry; return true; }
        chain.push({ table: 'left', index: a, evicted: left[a].key });
        const displacedLeft = left[a];
        left[a] = carry;
        carry = displacedLeft;

        const b = h2(carry.key);
        if (!right[b]) { right[b] = carry; return true; }
        chain.push({ table: 'right', index: b, evicted: right[b].key });
        const displacedRight = right[b];
        right[b] = carry;
        carry = displacedRight;
        stats.displacements += 2;
      }
      stats.cycles += 1;
      stats.pending = carry;
      return false;
    }

    function rebuild() {
      const entries = [];
      left.concat(right).forEach(function (entry) { if (entry) entries.push(entry); });
      if (stats.pending) { entries.push(stats.pending); stats.pending = null; }

      capacity *= 2;
      seed += 1;
      left = new Array(capacity).fill(null);
      right = new Array(capacity).fill(null);
      count = 0;
      stats.resizes += 1;
      entries.forEach(function (entry) { if (insertWithKicks(entry, [])) count += 1; });
    }

    function remove(key) {
      stats.deletes += 1;
      const a = h1(key);
      if (left[a] && left[a].key === key) { left[a] = null; count -= 1; return true; }
      const b = h2(key);
      if (right[b] && right[b].key === key) { right[b] = null; count -= 1; return true; }
      return false;
    }

    /**
     * Distance means the same thing here as everywhere else in this file: how
     * many probes past the first one a lookup needs. A key in the left table
     * costs none, a key in the right table costs one, and there is no third
     * case - which is the whole guarantee.
     */
    function distances() {
      const out = [];
      left.forEach(function (entry) { if (entry) out.push(0); });
      right.forEach(function (entry) { if (entry) out.push(1); });
      return out;
    }

    return {
      name: 'cuckoo',
      set: set,
      get: get,
      delete: remove,
      size: function () { return count; },
      capacity: function () { return capacity * 2; },
      distances: distances,
      evictionChain: function (key) {
        const chain = [];
        insertWithKicks({ key: key, value: null }, chain);
        remove(key);
        return chain;
      },
      stats: function () {
        return Object.assign({}, stats, summarise(distances()), { maxLookupProbe: 2 });
      }
    };
  }

  /* ----------------------------------------------------------- hopscotch */

  /**
   * Every key lives within H slots of its home, so a lookup reads one
   * neighbourhood - typically one cache line. Insertion moves an empty slot
   * backwards into range, and gives up when it cannot.
   */
  function createHopscotch(options) {
    const settings = options || {};
    const hash = settings.hash;
    const H = settings.neighbourhood || 8;

    let capacity = settings.capacity || 32;
    let slots = new Array(capacity).fill(null);
    let count = 0;
    const stats = newStats();

    function homeOf(key) { return hash(key) % capacity; }

    function get(key) {
      stats.lookups += 1;
      const home = homeOf(key);
      for (let i = 0; i < H; i += 1) {
        stats.lookupProbes += 1;
        const entry = slots[(home + i) % capacity];
        if (entry && entry.key === key) return entry.value;
      }
      return undefined;
    }

    function set(key, value) {
      stats.inserts += 1;
      const home = homeOf(key);
      for (let i = 0; i < H; i += 1) {
        const at = (home + i) % capacity;
        if (slots[at] && slots[at].key === key) { slots[at].value = value; return false; }
      }

      let free = findFree(home);
      if (free < 0) { grow(); return set(key, value); }
      free = hopBack(free, home);
      if (free < 0) { grow(); return set(key, value); }

      slots[free] = { key: key, value: value, home: home };
      count += 1;
      return true;
    }

    function findFree(home) {
      for (let i = 0; i < capacity; i += 1) {
        const at = (home + i) % capacity;
        stats.insertProbes += 1;
        if (!slots[at]) return at;
      }
      return -1;
    }

    /** Drag the empty slot backwards until it lands inside the neighbourhood. */
    function hopBack(free, home) {
      let hole = free;
      while (((hole - home + capacity) % capacity) >= H) {
        let moved = false;
        for (let back = H - 1; back > 0 && !moved; back -= 1) {
          const candidate = (hole - back + capacity) % capacity;
          const entry = slots[candidate];
          stats.shiftSteps += 1;
          if (!entry || ((hole - entry.home + capacity) % capacity) >= H) continue;
          slots[hole] = entry;
          slots[candidate] = null;
          hole = candidate;
          moved = true;
        }
        if (!moved) return -1;
      }
      return hole;
    }

    function remove(key) {
      stats.deletes += 1;
      const home = homeOf(key);
      for (let i = 0; i < H; i += 1) {
        const at = (home + i) % capacity;
        if (slots[at] && slots[at].key === key) { slots[at] = null; count -= 1; return true; }
      }
      return false;
    }

    function grow() {
      const previous = slots;
      capacity *= 2;
      slots = new Array(capacity).fill(null);
      count = 0;
      stats.resizes += 1;
      previous.forEach(function (entry) { if (entry) set(entry.key, entry.value); });
    }

    function distances() {
      const out = [];
      slots.forEach(function (entry, index) {
        if (entry) out.push((index - entry.home + capacity) % capacity);
      });
      return out;
    }

    return {
      name: 'hopscotch',
      set: set,
      get: get,
      delete: remove,
      size: function () { return count; },
      capacity: function () { return capacity; },
      distances: distances,
      stats: function () { return Object.assign({}, stats, summarise(distances()), { neighbourhood: H }); }
    };
  }

  function summarise(distances) {
    if (!distances.length) return { meanDistance: 0, maxDistance: 0, varianceDistance: 0, p99Distance: 0 };
    const mean = distances.reduce(function (a, b) { return a + b; }, 0) / distances.length;
    const variance = distances.reduce(function (sum, d) {
      return sum + (d - mean) * (d - mean);
    }, 0) / distances.length;
    const sorted = distances.slice().sort(function (a, b) { return a - b; });

    return {
      meanDistance: mean,
      maxDistance: sorted[sorted.length - 1],
      varianceDistance: variance,
      p99Distance: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.99))]
    };
  }

  function newStats() {
    return {
      inserts: 0, lookups: 0, deletes: 0,
      insertProbes: 0, lookupProbes: 0,
      maxInsertProbe: 0, displacements: 0, shiftSteps: 0,
      resizes: 0, cycles: 0, pending: null
    };
  }

  return {
    createRobinHood: createRobinHood,
    createCuckoo: createCuckoo,
    createHopscotch: createHopscotch,
    summarise: summarise
  };
}));

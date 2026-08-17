/**
 * Open addressing: linear, quadratic and double hashing, with the two
 * deletion strategies side by side.
 *
 * Tombstones are the point of this module. They are correct and they never
 * go away on their own: a delete-heavy table degrades until something forces
 * a rehash, and the degradation is invisible in the size and the load factor.
 * Backward-shift deletion removes the entry properly, at the cost of a loop.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.HashTableOpen = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const EMPTY = 0;
  const FULL = 1;
  const TOMB = 2;

  const PROBES = {
    linear: function (i) { return i; },
    quadratic: function (i) { return (i * i + i) / 2; },
    double: null                                     // handled with a second hash
  };

  function create(options) {
    const settings = options || {};
    const hash = settings.hash;
    const probe = settings.probe || 'linear';
    const deletion = settings.deletion || 'tombstone';   // tombstone | backward-shift
    const maxLoad = settings.maxLoad || 0.7;

    let capacity = settings.capacity || 16;
    let keys = new Array(capacity).fill(undefined);
    let values = new Array(capacity).fill(undefined);
    let state = new Uint8Array(capacity);
    let count = 0;
    let tombstones = 0;
    const stats = newStats();

    function step(key, i) {
      if (probe !== 'double') return PROBES[probe](i);
      const second = (hash(key + '#2') % (capacity - 1)) + 1;
      return i * second;
    }

    function slot(key, i) {
      return (hash(key) + step(key, i)) % capacity;
    }

    function findSlot(key, counter) {
      let firstTomb = -1;
      for (let i = 0; i < capacity; i += 1) {
        const at = slot(key, i);
        stats[counter] += 1;
        if (state[at] === EMPTY) return { at: at, found: false, reuse: firstTomb, probes: i + 1 };
        if (state[at] === TOMB && firstTomb < 0) firstTomb = at;
        if (state[at] === FULL && keys[at] === key) return { at: at, found: true, reuse: -1, probes: i + 1 };
      }
      return { at: -1, found: false, reuse: firstTomb, probes: capacity };
    }

    function set(key, value) {
      stats.inserts += 1;
      const found = findSlot(key, 'insertProbes');
      stats.maxInsertProbe = Math.max(stats.maxInsertProbe, found.probes);

      if (found.found) { values[found.at] = value; return false; }
      const target = found.reuse >= 0 ? found.reuse : found.at;
      if (target < 0) { grow(); return set(key, value); }

      if (state[target] === TOMB) tombstones -= 1;
      keys[target] = key;
      values[target] = value;
      state[target] = FULL;
      count += 1;
      if ((count + tombstones) / capacity > maxLoad) grow();
      return true;
    }

    function get(key) {
      stats.lookups += 1;
      const found = findSlot(key, 'lookupProbes');
      stats.maxLookupProbe = Math.max(stats.maxLookupProbe, found.probes);
      return found.found ? values[found.at] : undefined;
    }

    function remove(key) {
      stats.deletes += 1;
      const found = findSlot(key, 'lookupProbes');
      if (!found.found) return false;

      count -= 1;
      if (deletion === 'backward-shift' && probe === 'linear') { backwardShift(found.at); return true; }
      state[found.at] = TOMB;
      keys[found.at] = undefined;
      values[found.at] = undefined;
      tombstones += 1;
      return true;
    }

    /**
     * Linear probing only: walk forward and pull back any entry whose home
     * slot is at or before the hole, so no probe sequence is ever broken and
     * no tombstone is needed.
     */
    function backwardShift(hole) {
      let gap = hole;
      let cursor = (hole + 1) % capacity;

      while (state[cursor] === FULL) {
        const home = hash(keys[cursor]) % capacity;
        const distanceToGap = (gap - home + capacity) % capacity;
        const distanceToCursor = (cursor - home + capacity) % capacity;
        stats.shiftSteps += 1;

        if (distanceToGap < distanceToCursor) {
          keys[gap] = keys[cursor];
          values[gap] = values[cursor];
          state[gap] = FULL;
          gap = cursor;
        }
        cursor = (cursor + 1) % capacity;
      }

      state[gap] = EMPTY;
      keys[gap] = undefined;
      values[gap] = undefined;
    }

    function grow() {
      const oldKeys = keys;
      const oldValues = values;
      const oldState = state;

      capacity *= 2;
      keys = new Array(capacity).fill(undefined);
      values = new Array(capacity).fill(undefined);
      state = new Uint8Array(capacity);
      count = 0;
      tombstones = 0;
      stats.resizes += 1;

      for (let i = 0; i < oldState.length; i += 1) {
        if (oldState[i] === FULL) set(oldKeys[i], oldValues[i]);
      }
    }

    function clusters() {
      const runs = [];
      let run = 0;
      for (let i = 0; i < capacity; i += 1) {
        if (state[i] === EMPTY) { if (run) runs.push(run); run = 0; } else run += 1;
      }
      if (run) runs.push(run);
      return runs;
    }

    return {
      name: probe + '/' + deletion,
      set: set,
      get: get,
      delete: remove,
      size: function () { return count; },
      capacity: function () { return capacity; },
      slots: function () { return Array.from(state); },
      probeWalk: function (key) {
        const walk = [];
        for (let i = 0; i < capacity; i += 1) {
          const at = slot(key, i);
          walk.push({ index: at, state: state[at] });
          if (state[at] === EMPTY || (state[at] === FULL && keys[at] === key)) break;
        }
        return walk;
      },
      stats: function () {
        const runs = clusters();
        return Object.assign({}, stats, {
          tombstones: tombstones,
          longestCluster: runs.reduce(function (m, r) { return Math.max(m, r); }, 0),
          clusters: runs.length,
          load: count / capacity,
          occupied: (count + tombstones) / capacity
        });
      }
    };
  }

  function newStats() {
    return {
      inserts: 0, lookups: 0, deletes: 0,
      insertProbes: 0, lookupProbes: 0,
      maxInsertProbe: 0, maxLookupProbe: 0,
      resizes: 0, shiftSteps: 0
    };
  }

  /** The textbook expectation for a successful/unsuccessful linear-probe search. */
  function expectedProbes(load, successful) {
    if (load >= 1) return Infinity;
    return successful
      ? 0.5 * (1 + 1 / (1 - load))
      : 0.5 * (1 + 1 / ((1 - load) * (1 - load)));
  }

  return { create: create, expectedProbes: expectedProbes, EMPTY: EMPTY, FULL: FULL, TOMB: TOMB };
}));

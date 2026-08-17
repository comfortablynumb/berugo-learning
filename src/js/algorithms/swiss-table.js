/**
 * A Swiss table: open addressing with a separate array of one-byte control
 * values, probed a group at a time.
 *
 * The 64-bit hash is split into H1 (which group to start at) and H2 (a 7-bit
 * tag stored in the control byte). A lookup compares a group of 16 tags at
 * once - one SSE instruction over 16 bytes in C++, a byte loop here - and
 * only touches the slot array for the tags that matched. A 64-byte cache line
 * holds four such groups, so the metadata for 64 slots arrives in one fetch.
 *
 * The JavaScript version cannot be as fast; the structure is the point, and
 * the group count per lookup is measurable.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SwissTable = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const GROUP = 16;
  const EMPTY = 0x80;                 // 1000_0000
  const DELETED = 0xfe;               // 1111_1110
  const TAG_MASK = 0x7f;

  /** Returns a bitmask of the lanes in `control` whose tag equals `tag`. */
  function matchTag(control, offset, tag) {
    let mask = 0;
    for (let lane = 0; lane < GROUP; lane += 1) {
      if (control[offset + lane] === tag) mask |= (1 << lane);
    }
    return mask;
  }

  function matchEmpty(control, offset) {
    let mask = 0;
    for (let lane = 0; lane < GROUP; lane += 1) {
      if (control[offset + lane] === EMPTY) mask |= (1 << lane);
    }
    return mask;
  }

  function matchFree(control, offset) {
    let mask = 0;
    for (let lane = 0; lane < GROUP; lane += 1) {
      const byte = control[offset + lane];
      if (byte === EMPTY || byte === DELETED) mask |= (1 << lane);
    }
    return mask;
  }

  function splitHash(value) {
    const h = value >>> 0;
    return { h1: h >>> 7, h2: h & TAG_MASK };
  }

  function create(options) {
    const settings = options || {};
    const hash = settings.hash;
    const maxLoad = settings.maxLoad || 0.875;

    let groups = Math.max(1, Math.ceil((settings.capacity || 32) / GROUP));
    let control = newControl(groups);
    let keys = new Array(groups * GROUP).fill(undefined);
    let values = new Array(groups * GROUP).fill(undefined);
    let count = 0;
    let deleted = 0;
    const stats = newStats();

    function probeGroups(request) {
      const split = splitHash(hash(request.key));
      let group = split.h1 % groups;
      for (let i = 0; i < groups; i += 1) {
        stats[request.groupCounter] += 1;
        const done = request.visit(group * GROUP, split.h2, i);
        if (done !== undefined) return done;
        group = (group + 1) % groups;
      }
      return undefined;
    }

    function get(key) {
      stats.lookups += 1;
      const at = findSlot(key, 'lookupProbes', 'lookupGroups');
      return at >= 0 ? values[at] : undefined;
    }

    function set(key, value) {
      stats.inserts += 1;
      const existing = findSlot(key, 'insertProbes', 'insertGroups');
      if (existing >= 0) { values[existing] = value; return false; }
      if ((count + deleted + 1) / (groups * GROUP) > maxLoad) grow();
      return insertFresh(key, value);
    }

    /**
     * Returns the slot index holding `key`, or -1. Only tags that match are
     * compared against the real key, which is the whole point of the control
     * array: a group of 16 is rejected without touching the slots at all.
     */
    function findSlot(key, counter, groupCounter) {
      const found = probeGroups({
        key: key,
        groupCounter: groupCounter,
        visit: function (offset, tag) {
          let mask = matchTag(control, offset, tag);
          while (mask) {
            const lane = lowestBit(mask);
            mask &= mask - 1;
            stats[counter] += 1;
            if (keys[offset + lane] === key) return offset + lane;
          }
          if (matchEmpty(control, offset)) return -1;
          return undefined;
        }
      });
      return found === undefined ? -1 : found;
    }

    function insertFresh(key, value) {
      const at = probeGroups({
        key: key,
        groupCounter: 'insertGroups',
        visit: function (offset, tag) {
          const mask = matchFree(control, offset);
          if (!mask) return undefined;
          const lane = lowestBit(mask);
          control[offset + lane] = tag;
          keys[offset + lane] = key;
          values[offset + lane] = value;
          return offset + lane;
        }
      });
      if (at === undefined) { grow(); return insertFresh(key, value); }
      count += 1;
      return true;
    }

    function remove(key) {
      stats.deletes += 1;
      const at = findSlot(key, 'lookupProbes', 'deleteGroups');
      if (at < 0) return false;
      control[at] = DELETED;
      keys[at] = undefined;
      values[at] = undefined;
      count -= 1;
      deleted += 1;
      return true;
    }

    function grow() {
      const oldControl = control;
      const oldKeys = keys;
      const oldValues = values;

      groups *= 2;
      control = newControl(groups);
      keys = new Array(groups * GROUP).fill(undefined);
      values = new Array(groups * GROUP).fill(undefined);
      count = 0;
      deleted = 0;
      stats.resizes += 1;

      for (let i = 0; i < oldControl.length; i += 1) {
        if (oldControl[i] !== EMPTY && oldControl[i] !== DELETED) insertFresh(oldKeys[i], oldValues[i]);
      }
    }

    return {
      name: 'swiss table',
      set: set,
      get: get,
      delete: remove,
      size: function () { return count; },
      capacity: function () { return groups * GROUP; },
      groups: function () { return groups; },
      control: function () { return Array.from(control); },
      stats: function () {
        return Object.assign({}, stats, {
          deleted: deleted,
          load: count / (groups * GROUP),
          groupProbes: stats.lookupGroups + stats.insertGroups + stats.deleteGroups,
          groupsPerLookup: stats.lookups ? stats.lookupGroups / stats.lookups : 0
        });
      }
    };
  }

  function newControl(groups) {
    const control = new Uint8Array(groups * GROUP);
    control.fill(EMPTY);
    return control;
  }

  function lowestBit(mask) {
    let lane = 0;
    let bits = mask;
    while (!(bits & 1)) { bits >>>= 1; lane += 1; }
    return lane;
  }

  function newStats() {
    return {
      inserts: 0, lookups: 0, deletes: 0,
      insertProbes: 0, lookupProbes: 0, resizes: 0,
      lookupGroups: 0, insertGroups: 0, deleteGroups: 0
    };
  }

  return {
    create: create,
    matchTag: matchTag,
    matchEmpty: matchEmpty,
    matchFree: matchFree,
    splitHash: splitHash,
    lowestBit: lowestBit,
    GROUP: GROUP,
    EMPTY: EMPTY,
    DELETED: DELETED,
    TAG_MASK: TAG_MASK
  };
}));

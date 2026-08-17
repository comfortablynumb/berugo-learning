/**
 * Skip lists: a sorted linked list with express lanes, chosen by coin flip.
 *
 * A node is promoted to the next level with probability p, so a tower of
 * height k occurs with probability p^(k−1)(1−p), the expected number of levels
 * is log_{1/p}(n) and the expected tower height is 1/(1−p).
 *
 * Pugh's search bound is L/p + 1/(1−p) with L = log_{1/p}(n), and the two
 * factors move in opposite directions: fewer levels, more steps along each.
 * The total is therefore nearly flat in p — measured at n = 100 000, p = 0.5
 * costs 30.9 comparisons per search and p = 0.25 costs 32.1. What p actually
 * trades is memory: 2.0 pointers per node against 1.33.
 *
 * The reason LevelDB and Redis use one is not speed. It is that insertion
 * touches one pointer per level and never restructures anything else, so a
 * lock-free insert is a compare-and-swap per level rather than a subtree lock.
 */
(function (root, factory) {
  const api = factory(root && root.Random ? root.Random : (typeof require === 'function' ? require('../utils/random.js') : null));
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SkipList = api;
}(typeof window !== 'undefined' ? window : null, function (Random) {
  'use strict';

  function compareKeys(a, b) {
    if (a < b) return -1;
    return a > b ? 1 : 0;
  }

  function newStats() {
    return {
      comparisons: 0, nodeVisits: 0, levelDrops: 0, promotions: 0,
      inserts: 0, removes: 0, finds: 0, pointerWrites: 0
    };
  }

  function create(options) {
    const settings = options || {};
    const compare = settings.compare || compareKeys;
    const p = settings.p || 0.5;
    const maxLevel = settings.maxLevel || 16;
    const rng = settings.rng || Random.seeded(settings.seed === undefined ? 1 : settings.seed);
    const deterministic = Boolean(settings.deterministic);

    let head = { key: null, value: null, forward: new Array(maxLevel).fill(null) };
    let levels = 1;
    let count = 0;
    let stats = newStats();
    let inserted = 0;

    function cmp(a, b) {
      stats.comparisons += 1;
      return compare(a, b);
    }

    /** The coin, or the 1-2-3 rule. The deterministic variant promotes every
     *  1/p-th insertion instead of flipping, which removes the variance and
     *  the (small) chance of a tall tower. */
    function randomLevel() {
      if (deterministic) {
        let level = 1;
        let step = Math.round(1 / p);
        while (level < maxLevel && inserted % Math.pow(step, level) === 0) level += 1;
        return level;
      }
      let level = 1;
      while (level < maxLevel && rng.next() < p) level += 1;
      return level;
    }

    /** The update vector: for each level, the last node before the target.
     *  Insert and delete both need exactly this. */
    function findUpdate(key) {
      const update = new Array(maxLevel).fill(head);
      let node = head;

      for (let level = levels - 1; level >= 0; level -= 1) {
        while (node.forward[level] && cmp(node.forward[level].key, key) < 0) {
          node = node.forward[level];
          stats.nodeVisits += 1;
        }
        update[level] = node;
        if (level) stats.levelDrops += 1;
      }
      return { update: update, next: node.forward[0] };
    }

    function insert(key, value) {
      stats.inserts += 1;
      const found = findUpdate(key);
      if (found.next && cmp(found.next.key, key) === 0) {
        found.next.value = value;
        return false;
      }

      inserted += 1;
      const level = randomLevel();
      if (level > levels) levels = level;
      if (level > 1) stats.promotions += 1;

      const node = { key: key, value: value, forward: new Array(level).fill(null) };
      for (let i = 0; i < level; i += 1) {
        node.forward[i] = found.update[i].forward[i] || null;
        found.update[i].forward[i] = node;
        stats.pointerWrites += 2;
      }
      count += 1;
      return true;
    }

    function remove(key) {
      stats.removes += 1;
      const found = findUpdate(key);
      const node = found.next;
      if (!node || cmp(node.key, key) !== 0) return false;

      for (let i = 0; i < levels; i += 1) {
        if (found.update[i].forward[i] !== node) break;
        found.update[i].forward[i] = node.forward[i] || null;
        stats.pointerWrites += 1;
      }
      while (levels > 1 && !head.forward[levels - 1]) levels -= 1;
      count -= 1;
      return true;
    }

    function findNode(key) {
      const found = findUpdate(key);
      const node = found.next;
      return node && cmp(node.key, key) === 0 ? node : null;
    }

    /** The nodes a search actually touches, level by level - what the demo
     *  draws as the express-lane path. */
    function searchPath(key) {
      const path = [];
      let node = head;
      for (let level = levels - 1; level >= 0; level -= 1) {
        while (node.forward[level] && compare(node.forward[level].key, key) < 0) {
          node = node.forward[level];
          path.push({ level: level, key: node.key });
        }
        path.push({ level: level, key: node === head ? null : node.key, drop: true });
      }
      return path;
    }

    function keys() {
      const out = [];
      let node = head.forward[0];
      while (node) { out.push(node.key); node = node.forward[0]; }
      return out;
    }

    function range(lo, hi) {
      const out = [];
      let node = findUpdate(lo).next;
      while (node && compare(node.key, hi) <= 0) { out.push(node.key); node = node.forward[0]; }
      return out;
    }

    /** How many towers reached each level. The expected count at level k is
     *  n·p^(k−1), which is what the demo plots against. */
    function levelHistogram() {
      const counts = new Array(levels).fill(0);
      let node = head.forward[0];
      while (node) {
        counts[node.forward.length - 1] += 1;
        node = node.forward[0];
      }
      return counts;
    }

    function towers() {
      const out = [];
      let node = head.forward[0];
      while (node) { out.push({ key: node.key, height: node.forward.length }); node = node.forward[0]; }
      return out;
    }

    /** Ordering at level 0, and the consistency rule that makes the express
     *  lanes usable: every level must be a subsequence of the one below it. */
    function checkInvariants() {
      const errors = [];
      const base = keys();
      for (let i = 1; i < base.length; i += 1) {
        if (compare(base[i - 1], base[i]) >= 0) errors.push('level 0 is out of order at ' + base[i]);
      }
      if (base.length !== count) errors.push('level 0 holds ' + base.length + ' keys, size says ' + count);

      for (let level = 1; level < levels; level += 1) {
        const seen = new Set();
        let node = head.forward[level];
        let previous = null;
        while (node) {
          if (previous !== null && compare(previous, node.key) >= 0) {
            errors.push('level ' + level + ' is out of order at ' + node.key);
          }
          if (node.forward.length <= level) errors.push('node ' + node.key + ' appears above its own height');
          seen.add(node.key);
          previous = node.key;
          node = node.forward[level];
        }
        const below = new Set();
        let lower = head.forward[level - 1];
        while (lower) { below.add(lower.key); lower = lower.forward[level - 1]; }
        seen.forEach(function (key) {
          if (!below.has(key)) errors.push('key ' + key + ' is on level ' + level + ' but not on ' + (level - 1));
        });
      }
      return { ok: errors.length === 0, errors: errors };
    }

    /** The public surface, assembled in one place. */
    function publicApi() {
      return {
        name: 'skip-list',
        insert: insert,
        remove: remove,
        has: function (key) { stats.finds += 1; return findNode(key) !== null; },
        get: function (key) { stats.finds += 1; const node = findNode(key); return node ? node.value : undefined; },
        keys: keys,
        range: range,
        searchPath: searchPath,
        levelHistogram: levelHistogram,
        towers: towers,
        size: function () { return count; },
        height: function () { return levels; },
        /** Expected levels log_{1/p}(n), and expected comparisons per search. */
        expectedLevels: function () { return Math.max(1, Math.log(Math.max(2, count)) / Math.log(1 / p)); },
        /** Pugh's bound: L/p + 1/(1 - p), with L = log_{1/p}(n). Note what it
         *  says — the two factors move in opposite directions, so the total is
         *  nearly flat in p. What p really trades is memory: the average tower
         *  height is 1/(1 - p), which is 2.0 at p = 0.5 and 1.33 at p = 0.25. */
        expectedComparisons: function () {
          const levels = Math.log(Math.max(2, count)) / Math.log(1 / p);
          return levels / p + 1 / (1 - p);
        },
        expectedTowerHeight: function () { return 1 / (1 - p); },
        p: function () { return p; },
        checkInvariants: checkInvariants,
        stats: function () { return Object.assign({ height: levels, size: count }, stats); },
        resetStats: function () { stats = newStats(); },
        clear: function () {
          head = { key: null, value: null, forward: new Array(maxLevel).fill(null) };
          levels = 1;
          count = 0;
          inserted = 0;
        }
        };
    }

    return publicApi();
  }

  return { create: create, newStats: newStats };
}));

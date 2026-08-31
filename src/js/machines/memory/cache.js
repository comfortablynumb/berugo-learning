/**
 * MemoryCache - one level of cache, with the policies that actually differ.
 *
 * This is the module M02's `cache-sim.js` is a simplification of, and both
 * exist on purpose. That one is fully associative with no write policy, which
 * is exactly right for the question it answers - does this data layout get
 * evicted - and its numbers are quoted in three sections. This one has the
 * organisation and the policies, because M37 is about the choices rather than
 * about whether a cache helps.
 *
 * The address decomposition is the whole of cache organisation and it is three
 * divisions:
 *
 *     offset = address mod lineBytes            which byte within the line
 *     index  = (address / lineBytes) mod sets   which set the line lives in
 *     tag    = address / lineBytes / sets       what distinguishes it there
 *
 * The index bits come from the MIDDLE of the address, and that single fact
 * explains most mysterious performance cliffs: two arrays whose addresses
 * differ by a multiple of `sets * lineBytes` land in the same set however far
 * apart they are in memory, so a stride aligned to a power of two can turn a
 * whole cache into one set.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) {
    scope.Memory = scope.Memory || {};
    scope.Memory.Cache = api;
  }
}(this, function (root) {
  'use strict';

  const Random = root && root.Random ? root.Random : require('../../utils/random.js');

  const REPLACEMENT = {
    lru: { name: 'true LRU', bits: 'log2(ways!) - one order per set',
      about: 'evict the line untouched longest; optimal-ish and expensive above four ways' },
    plru: { name: 'tree pseudo-LRU', bits: 'ways - 1 bits per set',
      about: 'a tree of "go the other way" bits; approximates LRU for a fraction of the state' },
    fifo: { name: 'first in, first out', bits: 'log2(ways) per set',
      about: 'evict the oldest arrival, whatever it has been doing since' },
    random: { name: 'random', bits: 'none',
      about: 'no state at all, and it is closer to LRU than people expect' },
    rrip: { name: 'RRIP', bits: '2 bits per line',
      about: 'insert predicting a distant re-reference, so a streaming line leaves first' }
  };

  const WRITE = {
    writeBack: 'a written line is marked dirty and written out only when evicted',
    writeThrough: 'every write goes to the next level as well as this one'
  };

  const ALLOCATE = {
    writeAllocate: 'a write miss fetches the line first, so later writes to it hit',
    noWriteAllocate: 'a write miss goes straight past; the line is never brought in'
  };

  const DEFAULTS = { sets: 64, ways: 8, lineBytes: 64, replacement: 'lru',
    write: 'writeBack', allocate: 'writeAllocate', hitCycles: 4, name: 'L1',
    seed: 5 };

  /* ------------------------------------------------------------- building */

  function create(options) {
    const settings = Object.assign({}, DEFAULTS, options || {});
    const sets = [];

    for (let at = 0; at < settings.sets; at += 1) {
      sets.push({ lines: [], plru: new Array(Math.max(1, settings.ways - 1)).fill(0) });
    }
    return { settings: settings, sets: sets, clock: 0,
      random: Random.seeded(settings.seed),
      counters: { accesses: 0, hits: 0, misses: 0, readMisses: 0, writeMisses: 0,
        evictions: 0, dirtyEvictions: 0, writeThroughs: 0, bypassed: 0 } };
  }

  function capacity(cache) {
    return cache.settings.sets * cache.settings.ways * cache.settings.lineBytes;
  }

  /* ------------------------------------------------- the three divisions */

  function lineOf(cache, address) {
    return Math.floor((address >>> 0) / cache.settings.lineBytes);
  }

  function decode(cache, address) {
    const line = lineOf(cache, address);

    return { offset: (address >>> 0) % cache.settings.lineBytes,
      index: line % cache.settings.sets,
      tag: Math.floor(line / cache.settings.sets), line: line };
  }

  function find(set, tag) {
    return set.lines.filter(function (row) { return row.tag === tag; })[0] || null;
  }

  /** What would happen, without changing anything. The three-Cs classifier and
   *  the microbenchmarks both need to ask without disturbing. */
  function probe(cache, address) {
    const parts = decode(cache, address);

    return { hit: Boolean(find(cache.sets[parts.index], parts.tag)), parts: parts };
  }

  /* ------------------------------------------------------- replacement */

  /**
   * Pseudo-LRU as a tree of bits: at each level, the bit says which half was
   * used least recently, so the victim is found by following ways-1 bits down
   * rather than by keeping an order over all of them. It is wrong sometimes -
   * that is what "pseudo" means - and the demo measures how often.
   */
  function plruVictim(set, ways) {
    let node = 0;
    let base = 0;
    let width = ways;

    while (width > 1) {
      const goRight = set.plru[node] === 0;

      base += goRight ? width / 2 : 0;
      node = 2 * node + (goRight ? 2 : 1);
      width /= 2;
    }
    return base;
  }

  /**
   * Touching a way points every bit on its path AWAY from it.
   *
   * The polarity is the whole algorithm and it is the easiest thing in the
   * file to get backwards: `plruVictim` walks right when a bit is 0, so a
   * touch that went right has to write 1 - "the victim is on the other side".
   * Writing 0 there instead points the search into the half just used, and the
   * policy becomes pseudo-MOST-recently-used. Nothing about that is visible in
   * a hit rate: it evicts one line per miss, it never overflows a set, and on
   * a sequential or random walk it scores within a per cent of LRU. What it
   * does is win the cyclic fixture LRU is supposed to lose (150 hits against
   * 0, by evicting the line it has just touched rather than the one it is
   * about to want) and lose the scan fixture, which is a plausible-looking
   * pair of results in both directions.
   */
  function plruTouch(set, way, ways) {
    let node = 0;
    let base = 0;
    let width = ways;

    while (width > 1) {
      const right = way >= base + width / 2;

      set.plru[node] = right ? 1 : 0;
      if (right) base += width / 2;
      node = 2 * node + (right ? 2 : 1);
      width /= 2;
    }
  }

  function victimIndex(cache, set) {
    const policy = cache.settings.replacement;
    const ways = cache.settings.ways;

    if (policy === 'random') return cache.random.int(ways);
    if (policy === 'plru' && isPowerOfTwo(ways)) return plruVictim(set, ways);
    if (policy === 'rrip') return rripVictim(set);
    return oldestBy(set, policy === 'fifo' ? 'inserted' : 'used');
  }

  function isPowerOfTwo(value) {
    return value > 0 && (value & (value - 1)) === 0;
  }

  function oldestBy(set, field) {
    let at = 0;

    set.lines.forEach(function (row, index) {
      if (row[field] < set.lines[at][field]) at = index;
    });
    return at;
  }

  /** Re-reference interval prediction: a new line is predicted to be used
   *  again far away, so a streaming line is the first out and a reused one has
   *  been promoted before its turn comes. */
  function rripVictim(set) {
    for (let round = 0; round < 4; round += 1) {
      for (let at = 0; at < set.lines.length; at += 1) {
        if (set.lines[at].rrpv >= 3) return at;
      }
      set.lines.forEach(function (row) { row.rrpv = Math.min(3, row.rrpv + 1); });
    }
    return 0;
  }

  /**
   * Update the replacement state for a way.
   *
   * `onHit` is the whole of RRIP and it is easy to lose: a HIT predicts a near
   * re-reference and resets the counter to 0, while an INSTALL predicts a
   * distant one and must leave the counter at the value it was inserted with.
   * Promoting on install too makes every line look freshly reused, so the
   * insertion policy has no effect at all and RRIP degenerates into LRU - which
   * is exactly what it did here, and the symptom was that the scan-resistance
   * fixture showed RRIP performing identically to the policy it exists to beat.
   */
  function touch(cache, set, way, onHit) {
    const line = set.lines[way];

    line.used = cache.clock;
    if (onHit && cache.settings.replacement === 'rrip') line.rrpv = 0;
    if (cache.settings.replacement === 'plru' && isPowerOfTwo(cache.settings.ways)) {
      plruTouch(set, way, cache.settings.ways);
    }
  }

  /* ------------------------------------------------------------- access */

  /**
   * One access. The return says everything the level above needs: whether it
   * hit, whether a dirty line has to be written out, and whether this write
   * has to be forwarded because the policy says so.
   *
   * A write miss under no-write-allocate is the interesting case: nothing is
   * installed at all, the write goes past, and the counter that records it is
   * separate - a demo that folds it into "misses" makes streaming writes look
   * like a cache problem when they are the one case the cache is right to
   * ignore.
   */
  function access(cache, request) {
    const write = Boolean(request.write);
    const parts = decode(cache, request.address);
    const set = cache.sets[parts.index];
    const existing = find(set, parts.tag);

    cache.clock += 1;
    cache.counters.accesses += 1;
    if (existing) return hit(cache, set, existing, write);
    cache.counters.misses += 1;
    cache.counters[write ? 'writeMisses' : 'readMisses'] += 1;
    if (write && cache.settings.allocate === 'noWriteAllocate') {
      cache.counters.bypassed += 1;
      cache.counters.writeThroughs += 1;
      return { hit: false, parts: parts, allocated: false, writeThrough: true,
        evicted: null };
    }
    return install(cache, set, parts, write);
  }

  function hit(cache, set, line, write) {
    cache.counters.hits += 1;
    touch(cache, set, set.lines.indexOf(line), true);
    if (!write) return { hit: true, parts: null, allocated: false, evicted: null };
    if (cache.settings.write === 'writeThrough') {
      cache.counters.writeThroughs += 1;
      return { hit: true, allocated: false, writeThrough: true, evicted: null };
    }
    line.dirty = true;
    return { hit: true, allocated: false, evicted: null };
  }

  function install(cache, set, parts, write) {
    const dirty = write && cache.settings.write === 'writeBack';
    let evicted = null;

    if (set.lines.length >= cache.settings.ways) {
      const at = victimIndex(cache, set);

      evicted = set.lines[at];
      set.lines.splice(at, 1);
      cache.counters.evictions += 1;
      if (evicted.dirty) cache.counters.dirtyEvictions += 1;
    }
    set.lines.push({ tag: parts.tag, dirty: dirty, used: cache.clock,
      inserted: cache.clock, rrpv: cache.settings.replacement === 'rrip' ? 2 : 0 });
    touch(cache, set, set.lines.length - 1, false);
    return { hit: false, parts: parts, allocated: true, evicted: evicted,
      writeThrough: write && cache.settings.write === 'writeThrough' };
  }

  /** Remove a line if it is here, and say whether it was dirty. An inclusive
   *  hierarchy needs this: evicting from a level must evict from every level
   *  above it, or the inclusion property it depends on is a lie. */
  function invalidate(cache, address) {
    const parts = decode(cache, address);
    const set = cache.sets[parts.index];
    const line = find(set, parts.tag);

    if (!line) return { found: false, dirty: false };
    set.lines.splice(set.lines.indexOf(line), 1);
    return { found: true, dirty: Boolean(line.dirty) };
  }

  /** Every resident line, which is what the set/way grid draws. */
  function resident(cache) {
    const out = [];

    cache.sets.forEach(function (set, index) {
      set.lines.forEach(function (row, way) {
        out.push({ set: index, way: way, tag: row.tag, dirty: row.dirty,
          used: row.used, rrpv: row.rrpv,
          line: row.tag * cache.settings.sets + index });
      });
    });
    return out;
  }

  function summary(cache) {
    const counters = cache.counters;

    return { name: cache.settings.name, accesses: counters.accesses,
      hits: counters.hits, misses: counters.misses,
      readMisses: counters.readMisses, writeMisses: counters.writeMisses,
      evictions: counters.evictions, dirtyEvictions: counters.dirtyEvictions,
      writeThroughs: counters.writeThroughs, bypassed: counters.bypassed,
      hitRate: counters.accesses ? counters.hits / counters.accesses : 0,
      missRate: counters.accesses ? counters.misses / counters.accesses : 0,
      capacity: capacity(cache), sets: cache.settings.sets, ways: cache.settings.ways,
      lineBytes: cache.settings.lineBytes, replacement: cache.settings.replacement,
      write: cache.settings.write, allocate: cache.settings.allocate,
      hitCycles: cache.settings.hitCycles,
      /* Traffic to the next level, in transactions. A write-through cache moves
         far more of it than its miss rate suggests, which is the whole reason
         write-back is nearly universal.
         The bypassed writes are subtracted because a write miss under
         no-write-allocate is ONE transaction, not two: nothing is fetched, the
         write simply goes past. Counting it as a line fill as well doubles the
         traffic of the one policy that exists to reduce it. */
      trafficOut: counters.misses - counters.bypassed + counters.dirtyEvictions +
        counters.writeThroughs };
  }

  return { DEFAULTS: DEFAULTS, REPLACEMENT: REPLACEMENT, WRITE: WRITE, ALLOCATE: ALLOCATE,
    create: create, access: access, probe: probe, invalidate: invalidate,
    decode: decode, lineOf: lineOf, resident: resident, summary: summary,
    capacity: capacity };
}));

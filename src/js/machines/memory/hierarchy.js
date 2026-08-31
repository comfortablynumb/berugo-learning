/**
 * MemoryHierarchy - several cache levels and a memory behind them, with the
 * inclusion policy that decides what a level below is allowed to assume.
 *
 * The hierarchy exists because of a ratio rather than a technology: SRAM is
 * fast and expensive per bit, DRAM is slow and cheap, and the gap between a
 * processor cycle and a memory access grew by two orders of magnitude while
 * nobody was looking. Every level is a bet that the next access is one the
 * level above has seen recently or sits next to something it has - temporal
 * and spatial locality, which is the only reason any of this works.
 *
 * Two things this model insists on, because both are usually glossed:
 *
 * The AMAT recursion is computed from the MEASURED miss rates rather than
 * assumed ones, so it can be compared against the cycles the replay actually
 * accumulated. A predicted average that never gets checked against a measured
 * one is a formula, not a model.
 *
 * Inclusion is enforced rather than described. In an inclusive hierarchy a
 * line evicted from L2 must be invalidated in L1, or the property the level
 * below depends on - "if it is not here it is nowhere above" - is a lie, and
 * every coherence argument built on it (M38) fails silently.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) {
    scope.Memory = scope.Memory || {};
    scope.Memory.Hierarchy = api;
  }
}(this, function (root) {
  'use strict';

  const Cache = root && root.Memory && root.Memory.Cache ? root.Memory.Cache
    : require('./cache.js');

  const INCLUSION = {
    inclusive: 'every line in a level is also in every level below it; an eviction below '
      + 'forces one above',
    exclusive: 'a line lives in exactly one level; a hit below moves it up and removes it there',
    nonInclusive: 'no rule either way, which is what most designs actually do'
  };

  /**
   * Order-of-magnitude figures for a large contemporary core. The point is the
   * ratios - a few cycles, a few tens, a few hundreds - and they have been
   * stable for twenty years even as the absolute numbers moved.
   */
  const PRESET = [
    { name: 'L1d', sets: 64, ways: 8, lineBytes: 64, hitCycles: 4, replacement: 'lru' },
    { name: 'L2', sets: 1024, ways: 8, lineBytes: 64, hitCycles: 14, replacement: 'lru' },
    { name: 'L3', sets: 8192, ways: 16, lineBytes: 64, hitCycles: 45, replacement: 'lru' }
  ];

  const DRAM_CYCLES = 250;

  function create(options) {
    const settings = options || {};
    const levels = (settings.levels || PRESET).map(function (level) {
      return Cache.create(level);
    });

    return { levels: levels, dramCycles: settings.dramCycles || DRAM_CYCLES,
      inclusion: settings.inclusion || 'inclusive',
      counters: { accesses: 0, cycles: 0, dramAccesses: 0, writebacks: 0,
        inclusionEvictions: 0 } };
  }

  /* ------------------------------------------------------------- access */

  /**
   * One access, walked down until it hits.
   *
   * The cycle count is the sum of the hit times of every level that had to be
   * asked, which is what a serial (rather than parallel-lookup) hierarchy
   * costs, and is the model the AMAT recursion assumes.
   */
  function access(hierarchy, request) {
    const write = Boolean(request.write);
    let cycles = 0;

    hierarchy.counters.accesses += 1;
    for (let at = 0; at < hierarchy.levels.length; at += 1) {
      const level = hierarchy.levels[at];

      cycles += level.settings.hitCycles;
      const found = Cache.access(level, { address: request.address, write: write });

      handleEviction(hierarchy, at, found);
      if (found.hit) {
        hierarchy.counters.cycles += cycles;
        return { level: at, name: level.settings.name, hit: true, cycles: cycles };
      }
      if (found.writeThrough) forwardWrite(hierarchy, at + 1, request.address);
      if (hierarchy.inclusion === 'exclusive' && at > 0) break;
    }
    cycles += hierarchy.dramCycles;
    hierarchy.counters.dramAccesses += 1;
    hierarchy.counters.cycles += cycles;
    return { level: hierarchy.levels.length, name: 'DRAM', hit: false, cycles: cycles };
  }

  /**
   * A dirty line leaving a level goes to the next one as a write, and under
   * inclusion a clean one leaving a level takes its copies above with it.
   *
   * The second half is the part that is easy to leave out and impossible to
   * notice: without it an inclusive hierarchy still returns correct data, its
   * hit rates barely move, and the invariant every coherence protocol in M38
   * is built on has quietly stopped holding.
   */
  function handleEviction(hierarchy, at, found) {
    if (!found.evicted) return;
    const address = lineAddress(hierarchy.levels[at], found.evicted, found.parts);

    if (found.evicted.dirty) {
      hierarchy.counters.writebacks += 1;
      forwardWrite(hierarchy, at + 1, address);
    }
    if (hierarchy.inclusion !== 'inclusive') return;
    for (let above = 0; above < at; above += 1) {
      const gone = Cache.invalidate(hierarchy.levels[above], address);

      if (!gone.found) continue;
      hierarchy.counters.inclusionEvictions += 1;
      if (gone.dirty) forwardWrite(hierarchy, at, address);
    }
  }

  /** The byte address a victim line started at, which is the tag and the set
   *  put back together. */
  function lineAddress(cache, victim, parts) {
    const set = parts ? parts.index : 0;

    return (victim.tag * cache.settings.sets + set) * cache.settings.lineBytes;
  }

  function forwardWrite(hierarchy, at, address) {
    if (at >= hierarchy.levels.length) return;
    const found = Cache.access(hierarchy.levels[at], { address: address, write: true });

    handleEviction(hierarchy, at, found);
  }

  /* ------------------------------------------------------------- replay */

  function replay(hierarchy, trace) {
    const spread = {};

    (trace || []).forEach(function (entry) {
      const found = access(hierarchy, entry);

      spread[found.name] = (spread[found.name] || 0) + 1;
    });
    return { spread: spread, summary: summary(hierarchy) };
  }

  /* ------------------------------------------------------------ the AMAT */

  /**
   * Average memory access time, recursively: a level costs its hit time plus,
   * on the fraction that misses, the whole cost of everything below it.
   *
   * Computed from the miss rates the run measured, so it can be checked
   * against the cycles the run accumulated. They should agree closely and not
   * exactly - the recursion averages over accesses that reached each level,
   * and writebacks add traffic the top-level access count never saw.
   */
  function amat(hierarchy) {
    const levels = hierarchy.levels.map(Cache.summary);
    let below = hierarchy.dramCycles;

    for (let at = levels.length - 1; at >= 0; at -= 1) {
      levels[at].amat = levels[at].hitCycles + levels[at].missRate * below;
      below = levels[at].amat;
    }
    return { levels: levels, amat: levels.length ? levels[0].amat : hierarchy.dramCycles };
  }

  function summary(hierarchy) {
    const found = amat(hierarchy);
    const counters = hierarchy.counters;

    return { levels: found.levels, amat: found.amat,
      accesses: counters.accesses, cycles: counters.cycles,
      measured: counters.accesses ? counters.cycles / counters.accesses : 0,
      dramAccesses: counters.dramAccesses, writebacks: counters.writebacks,
      inclusionEvictions: counters.inclusionEvictions,
      inclusion: hierarchy.inclusion, dramCycles: hierarchy.dramCycles };
  }

  /** Where a program's accesses were actually served from, which is the only
   *  honest answer to "is this program memory bound". */
  function distribution(hierarchy) {
    const found = summary(hierarchy);
    const rows = [];
    let remaining = found.accesses;

    found.levels.forEach(function (level) {
      rows.push({ name: level.name, served: level.hits, cycles: level.hitCycles,
        share: remaining ? level.hits / found.accesses : 0 });
      remaining -= level.hits;
    });
    rows.push({ name: 'DRAM', served: found.dramAccesses, cycles: hierarchy.dramCycles,
      share: found.accesses ? found.dramAccesses / found.accesses : 0 });
    return rows;
  }

  return { INCLUSION: INCLUSION, PRESET: PRESET, DRAM_CYCLES: DRAM_CYCLES,
    create: create, access: access, replay: replay, amat: amat, summary: summary,
    distribution: distribution };
}));

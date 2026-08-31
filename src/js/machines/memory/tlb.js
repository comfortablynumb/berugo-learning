/**
 * MemoryTlb - the translation buffer, the page-table walk behind it, and the
 * reach that is often the real limit.
 *
 * Every memory access on a machine with virtual memory is really two: one to
 * find out where the data is, and one to get it. The page table makes the
 * first of those several dependent accesses - four levels on a 64-bit machine,
 * each one a load whose address depends on the one before, which is the
 * pointer chase from 36.6 with nothing to overlap. The TLB is a cache of the
 * answers, and it is the only reason this is affordable.
 *
 * REACH is the number worth carrying away: entries times page size. A
 * 64-entry TLB over 4 KiB pages reaches 256 KiB, which is smaller than the L2
 * cache it sits in front of - so a workload whose data fits in cache can still
 * be translation-bound, and a profile that only looks at cache miss rates will
 * never say so. Huge pages fix exactly that and nothing else.
 *
 * The address-space identifier is the other half. Without one, a context
 * switch has to flush the whole buffer, and the cost of switching is then
 * paid in translation misses for thousands of accesses afterwards. With one,
 * two address spaces coexist - and the test that matters is that neither can
 * see the other's translations, because a TLB that leaked one would be a
 * memory-protection hole rather than a performance bug.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) {
    scope.Memory = scope.Memory || {};
    scope.Memory.Tlb = api;
  }
}(this, function () {
  'use strict';

  const PAGE_BYTES = 4096;
  const HUGE_BYTES = 2 * 1024 * 1024;

  const DEFAULTS = { entries: 64, pageBytes: PAGE_BYTES, levels: 4,
    walkCycles: 30, hitCycles: 1, hugePages: false };

  function create(options) {
    const settings = Object.assign({}, DEFAULTS, options || {});

    return { settings: settings, entries: new Map(), table: {}, asid: 0,
      counters: { accesses: 0, hits: 0, misses: 0, walks: 0, walkAccesses: 0,
        faults: 0, flushes: 0, evictions: 0 } };
  }

  function pageBytes(tlb) {
    return tlb.settings.hugePages ? HUGE_BYTES : tlb.settings.pageBytes;
  }

  /** Entries times page size: how much memory the buffer can describe at
   *  once, and the number that decides whether a workload is TLB-bound. */
  function reach(tlb) {
    return tlb.settings.entries * pageBytes(tlb);
  }

  function pageOf(tlb, address) {
    return Math.floor(address / pageBytes(tlb));
  }

  /** The key carries the address space, which is what makes a flush
   *  unnecessary on a context switch and what stops one process reading
   *  another's mapping. */
  function keyFor(asid, page) {
    return asid + ':' + page;
  }

  /* --------------------------------------------------------- the mapping */

  function map(tlb, virtualPage, physicalPage) {
    tlb.table[keyFor(tlb.asid, virtualPage)] = physicalPage;
  }

  /** A default identity-ish mapping so a demo can run without building a page
   *  table by hand: page n of space a lives at physical page n plus an offset
   *  per space, which is enough to prove two spaces do not collide. */
  function autoMap(tlb, virtualPage) {
    const key = keyFor(tlb.asid, virtualPage);

    if (tlb.table[key] === undefined) {
      tlb.table[key] = virtualPage + tlb.asid * 1000000;
    }
    return tlb.table[key];
  }

  /* ---------------------------------------------------------- translate */

  /**
   * Translate one address. A hit is a cycle; a miss is a walk, and the walk is
   * `levels` dependent memory accesses - which is why a TLB miss costs far
   * more than the "one extra access" people expect.
   */
  function translate(tlb, address, options) {
    const settings = options || {};
    const page = pageOf(tlb, address);
    const key = keyFor(tlb.asid, page);

    tlb.counters.accesses += 1;
    if (tlb.entries.has(key)) {
      const frame = tlb.entries.get(key);

      tlb.entries.delete(key);
      tlb.entries.set(key, frame);
      tlb.counters.hits += 1;
      return { hit: true, frame: frame, cycles: tlb.settings.hitCycles,
        physical: frame * pageBytes(tlb) + (address % pageBytes(tlb)) };
    }
    return walk(tlb, address, page, settings);
  }

  function walk(tlb, address, page, settings) {
    const key = keyFor(tlb.asid, page);
    const frame = settings.strict ? tlb.table[key] : autoMap(tlb, page);

    tlb.counters.misses += 1;
    tlb.counters.walks += 1;
    tlb.counters.walkAccesses += tlb.settings.levels;
    if (frame === undefined) {
      tlb.counters.faults += 1;
      return { hit: false, fault: true, frame: null,
        cycles: tlb.settings.walkCycles * tlb.settings.levels };
    }
    install(tlb, key, frame);
    return { hit: false, fault: false, frame: frame,
      cycles: tlb.settings.hitCycles + tlb.settings.walkCycles * tlb.settings.levels,
      physical: frame * pageBytes(tlb) + (address % pageBytes(tlb)) };
  }

  function install(tlb, key, frame) {
    if (tlb.entries.size >= tlb.settings.entries) {
      const oldest = tlb.entries.keys().next().value;

      tlb.entries.delete(oldest);
      tlb.counters.evictions += 1;
    }
    tlb.entries.set(key, frame);
  }

  /* ------------------------------------------------------ context switch */

  /**
   * Switch address space. With identifiers this costs nothing and the other
   * space's entries stay valid; without them the whole buffer goes, and every
   * translation afterwards is a walk.
   */
  function switchTo(tlb, asid, options) {
    const settings = options || {};

    tlb.asid = asid;
    if (settings.asids === false) {
      tlb.entries.clear();
      tlb.counters.flushes += 1;
    }
    return tlb.asid;
  }

  /** What the current space can see, which is the assertion that matters: a
   *  buffer that returned another space's frame would be a protection hole. */
  function visible(tlb) {
    const prefix = tlb.asid + ':';

    return Array.from(tlb.entries.keys()).filter(function (key) {
      return key.indexOf(prefix) === 0;
    });
  }

  function summary(tlb) {
    const counters = tlb.counters;

    return { entries: tlb.settings.entries, pageBytes: pageBytes(tlb),
      reach: reach(tlb), levels: tlb.settings.levels,
      hugePages: tlb.settings.hugePages,
      accesses: counters.accesses, hits: counters.hits, misses: counters.misses,
      hitRate: counters.accesses ? counters.hits / counters.accesses : 0,
      walks: counters.walks, walkAccesses: counters.walkAccesses,
      faults: counters.faults, flushes: counters.flushes,
      resident: tlb.entries.size };
  }

  /**
   * Walk a trace and total the translation cost, which is the number that
   * turns "the TLB is small" into "this workload spends a third of its time
   * finding out where its data is".
   */
  function replay(tlb, trace, options) {
    let cycles = 0;

    (trace || []).forEach(function (entry) {
      const address = typeof entry === 'number' ? entry : entry.address;

      cycles += translate(tlb, address, options).cycles;
    });
    return { cycles: cycles, summary: summary(tlb),
      perAccess: trace && trace.length ? cycles / trace.length : 0 };
  }

  return { PAGE_BYTES: PAGE_BYTES, HUGE_BYTES: HUGE_BYTES, DEFAULTS: DEFAULTS,
    create: create, translate: translate, replay: replay, map: map,
    switchTo: switchTo, visible: visible, reach: reach, pageOf: pageOf,
    pageBytes: pageBytes, summary: summary };
}));

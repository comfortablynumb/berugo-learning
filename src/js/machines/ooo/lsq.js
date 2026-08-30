/**
 * OooLsq - the load/store queue: forwarding, dependence speculation and the
 * miss status registers that let misses overlap.
 *
 * Memory is where out-of-order execution gets hard, and the reason is that a
 * load cannot know whether it depends on an older store until both addresses
 * are computed. A machine that waits for every older store to have an address
 * is correct and slow; one that lets loads go early is fast and occasionally
 * wrong, and has to be able to notice and undo. That choice is the whole of
 * memory dependence speculation.
 *
 * Stores never write memory before they commit. That is not an optimisation,
 * it is the precise-exception guarantee: a speculative store that reached
 * memory could not be taken back. So a store sits in the queue holding its
 * address and value, and a younger load reading the same address gets the value
 * forwarded from the queue rather than from memory.
 *
 * The miss status holding registers are the other half of the milestone's
 * headline result. A load that misses occupies one, and the number of them is
 * the hard limit on how many misses can be outstanding at once - which is why
 * an array traversal and a pointer chase with identical miss counts differ by
 * several times in cycles.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) {
    scope.Ooo = scope.Ooo || {};
    scope.Ooo.Lsq = api;
  }
}(this, function (root) {
  'use strict';

  const Cache = root && root.Ooo && root.Ooo.Cache ? root.Ooo.Cache : require('./cache.js');

  function create(options) {
    const settings = options || {};

    return { entries: [], capacity: settings.lsqSize || 16,
      mshrs: settings.mshrs === undefined ? 4 : settings.mshrs,
      outstanding: [], speculate: settings.memorySpeculation !== false,
      storeSets: {}, peakOutstanding: 0,
      counters: { loads: 0, stores: 0, forwarded: 0, waited: 0, misspeculations: 0,
        mshrStalls: 0, missCycles: 0 } };
  }

  function isFull(lsq) {
    return lsq.entries.length >= lsq.capacity;
  }

  function allocate(lsq, entry) {
    if (isFull(lsq)) return null;
    const record = { id: entry.id, kind: entry.kind, pc: entry.pc, address: null,
      value: null, resolved: false, completed: false, forwarded: false };

    lsq.entries.push(record);
    lsq.counters[entry.kind === 'load' ? 'loads' : 'stores'] += 1;
    return record;
  }

  function entryFor(lsq, id) {
    return lsq.entries.filter(function (row) { return row.id === id; })[0] || null;
  }

  /** Older means dispatched earlier, and the queue is kept in that order, so
   *  "older" is "before it in the array". */
  function olderThan(lsq, id) {
    const at = lsq.entries.findIndex(function (row) { return row.id === id; });

    return at <= 0 ? [] : lsq.entries.slice(0, at);
  }

  /**
   * Can this load go now?
   *
   * Conservatively: only when every older store has an address, because any of
   * them might turn out to be the same address. Speculatively: yes, unless the
   * store-set predictor says this load has aliased with an older store before.
   * The predictor is what makes the difference between waiting for every store
   * and waiting for the one that actually matters.
   */
  function loadMayIssue(lsq, id) {
    const older = olderThan(lsq, id).filter(function (row) {
      return row.kind === 'store';
    });
    const unresolved = older.filter(function (row) { return !row.resolved; });

    if (!unresolved.length) return { ok: true };
    if (!lsq.speculate) {
      lsq.counters.waited += 1;
      return { ok: false, reason: 'conservative ordering: ' + unresolved.length +
        ' older store(s) have no address yet' };
    }
    const load = entryFor(lsq, id);

    if (load && lsq.storeSets[load.pc]) {
      lsq.counters.waited += 1;
      return { ok: false, reason: 'the store-set predictor has seen this load alias before' };
    }
    return { ok: true, speculative: unresolved.length > 0 };
  }

  /** Store-to-load forwarding: the newest older store to the same address, if
   *  there is one. A load that finds one never touches memory at all. */
  function forwardFor(lsq, id, address) {
    const older = olderThan(lsq, id);
    let found = null;

    older.forEach(function (row) {
      if (row.kind !== 'store' || !row.resolved) return;
      if (row.address !== address) return;
      found = row;
    });
    if (!found) return null;
    lsq.counters.forwarded += 1;
    return { value: found.value, from: found.id };
  }

  /**
   * A store resolves its address, and any younger load that already read this
   * address speculatively was wrong.
   *
   * Detecting that is the whole cost of speculating: the queue has to be
   * searched on every store, and a hit means squashing the load and everything
   * after it. The store-set predictor then remembers this load, so it waits
   * next time.
   */
  function resolveStore(lsq, id, address, value) {
    const record = entryFor(lsq, id);

    if (!record) return [];
    record.address = address >>> 0;
    record.value = value | 0;
    record.resolved = true;

    const at = lsq.entries.indexOf(record);
    const offenders = lsq.entries.slice(at + 1).filter(function (row) {
      return row.kind === 'load' && row.completed && row.address === record.address &&
        !row.forwarded;
    });

    offenders.forEach(function (row) {
      lsq.storeSets[row.pc] = true;
      lsq.counters.misspeculations += 1;
    });
    return offenders;
  }

  function resolveLoad(lsq, id, address) {
    const record = entryFor(lsq, id);

    if (!record) return null;
    record.address = address >>> 0;
    record.resolved = true;
    return record;
  }

  /* ------------------------------------------------------------- the MSHRs */

  /**
   * Start a memory access, and say how long it takes.
   *
   * A hit is the cache's hit latency. A miss needs a miss status register, and
   * if they are all busy the access cannot start at all - which is the limit
   * that turns "how many misses can be in flight" from a property of the
   * program into a property of the machine.
   */
  function begin(lsq, cache, address, cycle) {
    const probe = Cache.probe(cache, address);

    if (probe.hit) {
      Cache.access(cache, address);
      return { ok: true, hit: true, cycles: probe.cycles };
    }
    if (lsq.outstanding.length >= lsq.mshrs) {
      lsq.counters.mshrStalls += 1;
      return { ok: false, reason: 'all ' + lsq.mshrs + ' miss registers are in use' };
    }
    Cache.access(cache, address);
    lsq.outstanding.push({ address: address >>> 0, until: cycle + probe.cycles });
    lsq.peakOutstanding = Math.max(lsq.peakOutstanding, lsq.outstanding.length);
    lsq.counters.missCycles += probe.cycles;
    return { ok: true, hit: false, cycles: probe.cycles };
  }

  function retire(lsq, cycle) {
    lsq.outstanding = lsq.outstanding.filter(function (row) { return row.until > cycle; });
    return lsq.outstanding.length;
  }

  /**
   * An access has finished executing.
   *
   * A store's value is the data it will write, recorded when its address
   * resolved; a load's is what it read. Letting completion overwrite either
   * with the instruction's destination-register value silently turns every
   * store into a store of zero - which is what happened, and what made a
   * recursive program return to address zero.
   */
  function complete(lsq, id, value) {
    const record = entryFor(lsq, id);

    if (!record) return;
    record.completed = true;
    if (record.kind === 'load' && value !== undefined) record.value = value | 0;
  }

  function release(lsq, id) {
    lsq.entries = lsq.entries.filter(function (row) { return row.id !== id; });
  }

  function squash(lsq, ids) {
    const set = new Set(ids);

    lsq.entries = lsq.entries.filter(function (row) { return !set.has(row.id); });
  }

  /** Memory-level parallelism: the average number of misses in flight while
   *  any were, which is the number that separates an array from a list. */
  function summary(lsq, cycles) {
    const counters = lsq.counters;

    return { loads: counters.loads, stores: counters.stores,
      forwarded: counters.forwarded, waited: counters.waited,
      misspeculations: counters.misspeculations, mshrStalls: counters.mshrStalls,
      mshrs: lsq.mshrs, peakOutstanding: lsq.peakOutstanding,
      speculate: lsq.speculate,
      storeSets: Object.keys(lsq.storeSets).length };
  }

  return { create: create, isFull: isFull, allocate: allocate, entryFor: entryFor,
    loadMayIssue: loadMayIssue, forwardFor: forwardFor, resolveStore: resolveStore,
    resolveLoad: resolveLoad, begin: begin, retire: retire, complete: complete,
    release: release, squash: squash, summary: summary, olderThan: olderThan };
}));

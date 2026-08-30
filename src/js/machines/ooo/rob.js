/**
 * OooRob - the reorder buffer, and the reason an out-of-order machine can
 * pretend to be sequential.
 *
 * Instructions finish in whatever order their operands allow and commit in the
 * order the program wrote them. Everything between those two moments is
 * speculative: a physical register holds the result, the reorder buffer holds
 * the bookkeeping, and nothing architectural has changed. Commit is the single
 * point where speculation becomes fact, which is what makes precise exceptions
 * possible on a machine with a hundred instructions in flight.
 *
 * It is also the structure that limits how far ahead the machine can run past a
 * cache miss. The load at the head cannot commit until it completes, and once
 * the buffer is full nothing new can be dispatched however ready it is - so the
 * window size is a hard bound on memory-level parallelism, and it is why
 * reorder buffers have grown from 40 entries to over 500.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) {
    scope.Ooo = scope.Ooo || {};
    scope.Ooo.Rob = api;
  }
}(this, function () {
  'use strict';

  function create(options) {
    const settings = options || {};

    return { entries: [], capacity: settings.capacity || 32,
      counters: { dispatched: 0, committed: 0, squashed: 0, fullStalls: 0 } };
  }

  function isFull(rob) {
    return rob.entries.length >= rob.capacity;
  }

  function dispatch(rob, entry) {
    if (isFull(rob)) { rob.counters.fullStalls += 1; return null; }
    entry.state = 'dispatched';
    rob.entries.push(entry);
    rob.counters.dispatched += 1;
    return entry;
  }

  function head(rob) {
    return rob.entries.length ? rob.entries[0] : null;
  }

  /** An instruction is ready to commit when it has finished executing. Nothing
   *  else matters - not whether younger instructions have finished, and not
   *  whether it was speculative, because if it reaches the head then every
   *  branch ahead of it resolved correctly. */
  function canCommit(rob) {
    const entry = head(rob);

    return Boolean(entry && entry.state === 'completed');
  }

  function commit(rob) {
    const entry = rob.entries.shift();

    entry.state = 'committed';
    rob.counters.committed += 1;
    return entry;
  }

  /**
   * Throw away everything younger than an entry.
   *
   * This is the mechanism behind both misprediction recovery and precise
   * exceptions, and it is the same mechanism because they are the same problem:
   * work that has been done and must be made never to have happened. The entry
   * itself survives, because a mispredicted branch still commits and a faulting
   * instruction still needs its address recorded.
   */
  function squashAfter(rob, id) {
    const at = rob.entries.findIndex(function (entry) { return entry.id === id; });

    if (at === -1) return [];
    const removed = rob.entries.splice(at + 1);

    removed.forEach(function (entry) { entry.state = 'squashed'; });
    rob.counters.squashed += removed.length;
    return removed;
  }

  /**
   * Throw away an entry AND everything younger than it.
   *
   * Misprediction recovery keeps the branch, because a mispredicted branch
   * still commits. A memory misspeculation does not: the instruction that was
   * wrong is the LOAD, it read a value a store had not written yet, and it has
   * to run again. Squashing from the entry before it is the same thing said
   * awkwardly, and it is wrong the moment that entry has already committed -
   * there is then nothing in the buffer with that id, nothing is squashed, and
   * the machine redirects fetch while leaving the bad load in place.
   */
  function squashInclusive(rob, id) {
    const at = rob.entries.findIndex(function (entry) { return entry.id === id; });

    if (at === -1) return [];
    const removed = rob.entries.splice(at);

    removed.forEach(function (entry) { entry.state = 'squashed'; });
    rob.counters.squashed += removed.length;
    return removed;
  }

  function squashAll(rob) {
    const removed = rob.entries.splice(0);

    removed.forEach(function (entry) { entry.state = 'squashed'; });
    rob.counters.squashed += removed.length;
    return removed;
  }

  /** Every instruction in flight, oldest first - the window the visualiser
   *  draws and the thing a reader is trying to see. */
  function window(rob) {
    return rob.entries.map(function (entry) {
      return { id: entry.id, pc: entry.pc, name: entry.name, state: entry.state,
        ready: entry.ready, port: entry.port, speculative: entry.speculative };
    });
  }

  function occupancy(rob) {
    return { used: rob.entries.length, capacity: rob.capacity,
      share: rob.capacity ? rob.entries.length / rob.capacity : 0 };
  }

  function summary(rob) {
    return { capacity: rob.capacity, dispatched: rob.counters.dispatched,
      committed: rob.counters.committed, squashed: rob.counters.squashed,
      fullStalls: rob.counters.fullStalls, inFlight: rob.entries.length };
  }

  return { create: create, isFull: isFull, dispatch: dispatch, head: head,
    canCommit: canCommit, commit: commit, squashAfter: squashAfter,
    squashInclusive: squashInclusive, squashAll: squashAll,
    window: window, occupancy: occupancy, summary: summary };
}));

/**
 * OooScheduler - the issue queue, the wakeup/select loop and the ports.
 *
 * Every cycle the scheduler does two things. Wakeup marks any waiting
 * instruction whose last operand has just arrived; select picks, from
 * everything now ready, as many as the ports can take. Both halves are on the
 * critical path of the machine and both get more expensive as the window and
 * the issue width grow - wakeup broadcasts a tag to every entry, and select is
 * a priority encoder over all of them.
 *
 * That cost is why issue width plateaued. Doubling the width roughly quadruples
 * the comparison logic in the select loop, and the returns fall off long before
 * the cost does, which is the shape the width explorer draws.
 *
 * Ports are the other half. A machine with four issue slots and one multiplier
 * cannot issue two multiplies in a cycle however ready they are, and a workload
 * that is all multiplies will not go faster on a wider machine. Port pressure
 * and dependence chains are the two answers to "why did widening not help",
 * and the demo distinguishes them.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) {
    scope.Ooo = scope.Ooo || {};
    scope.Ooo.Scheduler = api;
  }
}(this, function () {
  'use strict';

  /**
   * A small, realistic port mix: two general ALUs, one for memory, one for
   * branches. Every real machine's table looks like this and differs only in
   * the counts.
   *
   * `interval` is the initiation interval - how soon the port can accept the
   * NEXT instruction - and it is not the same thing as latency. A fully
   * pipelined unit takes a new operation every cycle however long its result
   * takes to appear, which is why a load with a two-cycle latency does not
   * halve the memory port's throughput. Conflating the two is a modelling
   * mistake with a very specific symptom: every port delivers half the
   * throughput it should, the machine saturates at an IPC near one whatever
   * the width, and the width-explorer curve then tells a true story about the
   * model and a false one about processors.
   */
  const PORTS = [
    { name: 'alu0', kinds: ['alu', 'system'], interval: 1, about: 'integer arithmetic, and the rare system instruction' },
    { name: 'alu1', kinds: ['alu'], interval: 1, about: 'a second integer unit' },
    { name: 'mem', kinds: ['load', 'store'], interval: 1, about: 'the one address-generation unit' },
    { name: 'branch', kinds: ['branch', 'jump'], interval: 1, about: 'branch resolution' }
  ];

  const LATENCY = { alu: 1, branch: 1, jump: 1, load: 2, store: 1, system: 1 };

  function create(options) {
    const settings = options || {};

    return { queue: [], width: settings.width || 4,
      capacity: settings.queueSize || 32,
      ports: (settings.ports || PORTS).map(function (port) {
        return { name: port.name, kinds: port.kinds, about: port.about,
          interval: port.interval || 1, freeAt: 0 };
      }),
      counters: { issued: 0, queueFullStalls: 0, portConflicts: 0, waitCycles: 0 } };
  }

  function isFull(scheduler) {
    return scheduler.queue.length >= scheduler.capacity;
  }

  function enqueue(scheduler, entry) {
    if (isFull(scheduler)) { scheduler.counters.queueFullStalls += 1; return false; }
    scheduler.queue.push(entry);
    return true;
  }

  /** Wakeup: an entry is ready when every source it is waiting on has been
   *  written. The physical register file's ready bits are the tags, so this is
   *  a read rather than a broadcast - the same information, cheaper to model
   *  and identical in effect. */
  function wakeup(scheduler, isReady) {
    scheduler.queue.forEach(function (entry) {
      if (entry.ready) return;
      entry.ready = entry.sources.every(function (source) { return isReady(source); });
      if (!entry.ready) scheduler.counters.waitCycles += 1;
    });
  }

  function portFor(scheduler, kind, cycle) {
    return scheduler.ports.filter(function (port) {
      return port.kinds.indexOf(kind) !== -1 && port.freeAt <= cycle;
    })[0] || null;
  }

  function hasPortFor(scheduler, kind) {
    return scheduler.ports.some(function (port) {
      return port.kinds.indexOf(kind) !== -1;
    });
  }

  /**
   * Select: oldest ready first, up to the issue width, and only where a port
   * is free.
   *
   * Oldest-first is not arbitrary. Picking the youngest ready instruction is
   * equally correct and much worse, because the oldest one is the most likely
   * to be blocking the reorder buffer's head and therefore the machine's
   * ability to commit anything at all.
   */
  function select(scheduler, cycle) {
    const chosen = [];

    for (let at = 0; at < scheduler.queue.length && chosen.length < scheduler.width; at += 1) {
      const entry = scheduler.queue[at];

      if (!entry.ready || entry.issuedAt !== undefined) continue;
      const port = portFor(scheduler, entry.kind, cycle);

      if (!port) { scheduler.counters.portConflicts += 1; continue; }
      port.freeAt = cycle + Math.max(1, port.interval);
      entry.port = port.name;
      entry.issuedAt = cycle;
      entry.completesAt = cycle + Math.max(1, entry.latency || 1);
      chosen.push(entry);
      scheduler.counters.issued += 1;
    }
    return chosen;
  }

  /** Anything that has finished executing this cycle. */
  function completed(scheduler, cycle) {
    return scheduler.queue.filter(function (entry) {
      return entry.issuedAt !== undefined && entry.completesAt <= cycle;
    });
  }

  function remove(scheduler, entries) {
    const ids = new Set(entries.map(function (entry) { return entry.id; }));

    scheduler.queue = scheduler.queue.filter(function (entry) {
      return !ids.has(entry.id);
    });
  }

  function squash(scheduler, ids) {
    const set = new Set(ids);

    scheduler.queue = scheduler.queue.filter(function (entry) {
      return !set.has(entry.id);
    });
  }

  /** Why nothing issued this cycle, which is the question the width explorer
   *  exists to answer. */
  function reasonFor(scheduler, cycle) {
    if (!scheduler.queue.length) return 'the queue is empty: nothing was dispatched';
    const ready = scheduler.queue.filter(function (entry) {
      return entry.ready && entry.issuedAt === undefined;
    });

    if (!ready.length) return 'every waiting instruction is short of an operand';
    return 'the ports for the ready instructions are all busy';
  }

  function summary(scheduler) {
    return { width: scheduler.width, capacity: scheduler.capacity,
      issued: scheduler.counters.issued,
      queueFullStalls: scheduler.counters.queueFullStalls,
      portConflicts: scheduler.counters.portConflicts,
      ports: scheduler.ports.map(function (port) {
        return { name: port.name, kinds: port.kinds, about: port.about,
          interval: port.interval };
      }) };
  }

  return { PORTS: PORTS, LATENCY: LATENCY, create: create, isFull: isFull, enqueue: enqueue,
    wakeup: wakeup, select: select, completed: completed, remove: remove, squash: squash,
    reasonFor: reasonFor, hasPortFor: hasPortFor, summary: summary };
}));

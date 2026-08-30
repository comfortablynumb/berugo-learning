/**
 * OooSmt - two threads on one core, and the arbitration that decides how the
 * core is divided between them.
 *
 * Simultaneous multithreading exists because a single thread cannot keep a
 * wide out-of-order core busy. The measurements in 36.1 say why: a dependence
 * chain leaves most issue slots empty and no amount of width fills them. A
 * second thread's instructions are independent of the first's by construction,
 * so they fit in exactly the holes the first one leaves - which is why SMT
 * helps throughput on stall-heavy code and helps nothing at all on code that
 * was already retiring four slots a cycle.
 *
 * Two real cores are run here rather than one core with a thread field, and
 * they SHARE the structures that a real design shares:
 *
 *   - the execution ports are one array, held by both schedulers, so a cycle
 *     in which one thread takes the memory port is a cycle in which the other
 *     cannot have it;
 *   - the reorder buffer is one budget, divided either statically (each thread
 *     gets half, whatever it does) or dynamically (whoever asks first);
 *   - the front end delivers to one thread per cycle, and which one is the
 *     fetch policy.
 *
 * The dynamic division is the interesting one and the reason the starvation
 * guard exists. A thread that misses in the cache holds its window entries for
 * twenty cycles doing nothing, and with a shared buffer it can hold all of
 * them - at which point the other thread cannot dispatch a single instruction
 * however ready it is. That is not a hypothetical: it is the failure mode that
 * made every shipping SMT design partition something.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) {
    scope.Ooo = scope.Ooo || {};
    scope.Ooo.Smt = api;
  }
}(this, function (root) {
  'use strict';

  const Assembler = root && root.Brv32 && root.Brv32.Assembler ? root.Brv32.Assembler
    : require('../brv32/assembler.js');

  function core() {
    return root && root.OooCore ? root.OooCore : require('../ooo-core.js');
  }

  /**
   * Which thread the front end serves this cycle.
   *
   * `roundRobin` is fair and ignorant. `icount` is Tullsen's answer and the one
   * that shipped: prefer the thread with the fewest instructions already in
   * flight, because a thread with many is either making progress or stuck, and
   * either way it does not need more. `priority` is here to be broken - it is
   * the configuration the starvation test exists to catch.
   */
  const POLICIES = {
    roundRobin: { name: 'round robin',
      about: 'alternate every cycle, regardless of what either thread is doing' },
    icount: { name: 'ICOUNT',
      about: 'serve whichever thread has the fewest instructions in flight' },
    priority: { name: 'strict priority',
      about: 'thread 0 always wins - included because it starves thread 1' }
  };

  const PARTITIONS = {
    shared: { name: 'shared', about: 'one window, first come first served' },
    partitioned: { name: 'partitioned', about: 'each thread gets a fixed half' }
  };

  /* -------------------------------------------------------------- building */

  function create(options) {
    const settings = options || {};
    const specs = settings.threads || [];
    const machine = { cycle: 0, threads: [], config: config(settings, specs.length),
      counters: { grants: 0, guardForced: 0 } };

    specs.forEach(function (spec, index) {
      machine.threads.push(context(spec, index, machine.config));
    });
    sharePorts(machine);
    return machine;
  }

  function config(settings, count) {
    return { width: settings.width || 4, policy: settings.policy || 'icount',
      partition: settings.partition || 'shared',
      guard: settings.guard === undefined ? 0 : settings.guard,
      rob: settings.capacity || 32, queue: settings.queueSize || 32, threads: count,
      cache: settings.cache || {}, shareCache: settings.shareCache !== false };
  }

  function context(spec, index, settings) {
    const image = spec.image || Assembler.assemble(spec.source, { origin: 0 }).bytes;
    const built = core().create(Object.assign({}, settings.cache,
      { image: image, entry: spec.entry || 0, width: settings.width,
        capacity: settings.rob, queueSize: settings.queue,
        physical: spec.physical || 64 }));

    return { name: spec.name || 'thread ' + index, index: index, core: built,
      done: false, finishedAt: null,
      counters: { grants: 0, starved: 0, longestStarve: 0, sinceGrant: 0 } };
  }

  /**
   * One array of ports and one cache, held by every thread.
   *
   * That is the whole of "the execution units are shared" and it is two
   * assignments. The cache is the sharing that matters twice over: it is where
   * SMT's throughput gain comes from when two threads touch the same data, and
   * it is the reason two threads on one core can read each other through
   * timing (36.8) in a way two threads on two cores cannot.
   */
  function sharePorts(machine) {
    if (!machine.threads.length) return;
    const first = machine.threads[0].core;

    machine.threads.forEach(function (thread) {
      thread.core.scheduler.ports = first.scheduler.ports;
      if (machine.config.shareCache) thread.core.cache = first.cache;
    });
  }

  /* ------------------------------------------------------------ one cycle */

  function live(machine) {
    return machine.threads.filter(function (thread) { return !thread.done; });
  }

  function inFlight(thread) {
    return thread.core.rob.entries.length + thread.core.history.length;
  }

  /**
   * Pick the thread that gets the front end this cycle.
   *
   * The starvation guard overrides the policy: a thread that has gone `guard`
   * cycles without a fetch slot takes the next one whatever the policy says.
   * Without it, strict priority never serves thread 1 at all, and a shared
   * window plus a stalling thread 0 can do the same thing to ICOUNT.
   */
  function chooseThread(machine) {
    const ready = live(machine);

    if (!ready.length) return null;
    const starving = ready.filter(function (thread) {
      return machine.config.guard > 0 && thread.counters.sinceGrant >= machine.config.guard;
    });

    if (starving.length) {
      machine.counters.guardForced += 1;
      return starving.sort(function (left, right) {
        return right.counters.sinceGrant - left.counters.sinceGrant;
      })[0];
    }
    return byPolicy(machine, ready);
  }

  function byPolicy(machine, ready) {
    if (machine.config.policy === 'priority') return ready[0];
    if (machine.config.policy === 'roundRobin') {
      return ready[machine.counters.grants % ready.length];
    }
    return ready.slice().sort(function (left, right) {
      return inFlight(left) - inFlight(right) || left.index - right.index;
    })[0];
  }

  /**
   * Set each thread's window budget for this cycle.
   *
   * Partitioned gives every thread the same fixed share whatever it is doing.
   * Shared gives a thread everything the others are not currently using, which
   * is better when the threads take turns and catastrophic when one of them
   * stops making progress while holding the buffer.
   */
  function budget(machine) {
    share(machine, machine.config.rob, function (thread) { return thread.core.rob; },
      function (rob) { return rob.entries.length; });
    share(machine, machine.config.queue,
      function (thread) { return thread.core.scheduler; },
      function (scheduler) { return scheduler.queue.length; });
  }

  /**
   * One structure, divided between the threads for this cycle.
   *
   * The reorder buffer and the issue queue are shared the same way and both
   * have to be, because they fill for different reasons: the buffer fills with
   * instructions waiting to commit and the queue with instructions waiting for
   * an operand. Partitioning only one of them leaves the other as the thing a
   * stalled thread monopolises, and the demo would then report a partitioning
   * control that changes almost nothing - which is a true statement about a
   * half-finished model rather than about the machine.
   */
  function share(machine, total, structureOf, usedOf) {
    const count = Math.max(1, machine.threads.length);

    machine.threads.forEach(function (thread) {
      const structure = structureOf(thread);

      if (machine.config.partition === 'partitioned') {
        structure.capacity = Math.max(1, Math.floor(total / count));
        return;
      }
      const others = machine.threads.reduce(function (sum, other) {
        return other === thread ? sum : sum + usedOf(structureOf(other));
      }, 0);

      structure.capacity = Math.max(1, total - others);
    });
  }

  /**
   * One cycle of the shared machine.
   *
   * The thread that won the front end runs at full width; every other thread
   * runs with its fetch and dispatch width set to zero, so it still commits,
   * completes and issues - the back end is not stopped, only the front end is.
   * The threads are stepped in a rotating order so that issue arbitration for
   * the shared ports does not permanently favour thread 0.
   */
  function step(machine) {
    const chosen = chooseThread(machine);

    budget(machine);
    machine.threads.forEach(function (thread) {
      const wins = thread === chosen;

      thread.core.config.width = wins ? machine.config.width : 0;
      /* A finished thread is not being starved. Counting its idle cycles as
         starvation makes the longest-wait figure a statement about which
         thread happened to finish first, which is exactly the number somebody
         would quote as evidence that the guard is not working. */
      if (thread.done) return;
      thread.counters.sinceGrant = wins ? 0 : thread.counters.sinceGrant + 1;
      if (wins) { thread.counters.grants += 1; machine.counters.grants += 1; }
      if (!wins) thread.counters.starved += 1;
      thread.counters.longestStarve = Math.max(thread.counters.longestStarve,
        thread.counters.sinceGrant);
    });
    order(machine).forEach(function (thread) {
      if (thread.done) return;
      core().step(thread.core);
      finishIfDone(machine, thread);
    });
    machine.cycle += 1;
    return chosen;
  }

  function order(machine) {
    const rotated = machine.threads.slice();
    const at = machine.cycle % Math.max(1, rotated.length);

    return rotated.slice(at).concat(rotated.slice(0, at));
  }

  function finishIfDone(machine, thread) {
    if (!thread.core.traps.taken.length) return;
    thread.done = true;
    thread.finishedAt = machine.cycle + 1;
  }

  function run(machine, options) {
    const settings = options || {};
    const budgetCycles = settings.cycles || 6000;

    while (machine.cycle < budgetCycles && live(machine).length) step(machine);
    return summary(machine);
  }

  /* -------------------------------------------------------------- reporting */

  function summary(machine) {
    const cycles = machine.cycle;
    const threads = machine.threads.map(function (thread) {
      return { name: thread.name, retired: thread.core.retired,
        ipc: cycles ? thread.core.retired / cycles : 0,
        finishedAt: thread.finishedAt, grants: thread.counters.grants,
        longestStarve: thread.counters.longestStarve,
        window: thread.core.rob.capacity,
        mispredicts: thread.core.counters.mispredicts };
    });
    const retired = threads.reduce(function (sum, row) { return sum + row.retired; }, 0);

    return { cycles: cycles, threads: threads, retired: retired,
      throughput: cycles ? retired / cycles : 0,
      policy: machine.config.policy, partition: machine.config.partition,
      guard: machine.config.guard, guardForced: machine.counters.guardForced,
      shareCache: machine.config.shareCache,
      starved: threads.filter(function (row) { return row.retired === 0; }).length };
  }

  /**
   * The number the whole debate is about: what each thread loses by sharing,
   * and what the pair gains.
   *
   * A single-thread run of each program is the baseline; the SMT run gives the
   * pair's total. Throughput up and single-thread latency down is the expected
   * shape, and a workload where it does not happen is the reason latency-
   * critical services turn SMT off.
   */
  function against(machine, alone) {
    const found = summary(machine);
    const rows = found.threads.map(function (row, index) {
      const solo = alone[index];

      return { name: row.name, alone: solo.cycles, shared: row.finishedAt || found.cycles,
        slowdown: solo.cycles ? (row.finishedAt || found.cycles) / solo.cycles : 0,
        aloneIpc: solo.ipc, sharedIpc: row.ipc, retired: row.retired };
    });
    const soloTime = alone.reduce(function (sum, row) { return sum + row.cycles; }, 0);

    return { rows: rows, cycles: found.cycles, sequential: soloTime,
      speedup: found.cycles ? soloTime / found.cycles : 0, summary: found };
  }

  return { POLICIES: POLICIES, PARTITIONS: PARTITIONS, create: create, step: step,
    run: run, summary: summary, against: against, inFlight: inFlight };
}));

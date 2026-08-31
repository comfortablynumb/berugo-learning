/**
 * MemoryDram - banks, row buffers and the scheduler, which is where the
 * "memory latency" number on a data sheet stops being the latency you get.
 *
 * A DRAM bank holds one row at a time in a sense amplifier called the row
 * buffer, and every access is one of three things:
 *
 *   row hit       the row is already open. Column access only: tCAS.
 *   row miss      no row is open. Activate then read: tRCD + tCAS.
 *   row conflict  a DIFFERENT row is open. Close it, activate, read:
 *                 tRP + tRCD + tCAS, which is roughly three times a hit.
 *
 * That third case is the one that matters, and it is why address interleaving
 * is a real design decision rather than a detail: spreading consecutive lines
 * across banks turns a sequential walk from a stream of conflicts in one bank
 * into a stream of hits spread over many.
 *
 * The scheduler is the other half. First-ready-first-come-first-served
 * reorders requests to prefer ones that hit the open row, which raises
 * throughput and can starve an unlucky request indefinitely - so the model
 * counts the worst wait as well as the average, because a policy that is fast
 * on average and unbounded in the tail is not a policy anyone can ship.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) {
    scope.Memory = scope.Memory || {};
    scope.Memory.Dram = api;
  }
}(this, function () {
  'use strict';

  /** Timing in cycles, in the ratios a real part has: activating a row and
   *  precharging one each cost about what reading a column does. */
  const TIMING = { tCAS: 15, tRCD: 15, tRP: 15 };

  const INTERLEAVE = {
    bankFirst: 'consecutive lines go to different banks, so a sequential walk spreads out',
    rowFirst: 'consecutive lines fill a row before moving on, so a walk hammers one bank'
  };

  const POLICIES = {
    fcfs: { name: 'FCFS', about: 'serve requests in arrival order, whatever they cost' },
    frfcfs: { name: 'FR-FCFS',
      about: 'prefer a request that hits the open row; among equals, oldest first' }
  };

  const DEFAULTS = { banks: 8, rowLines: 32, lineBytes: 64, policy: 'frfcfs',
    interleave: 'bankFirst', queue: 16, timing: TIMING };

  function create(options) {
    const settings = Object.assign({}, DEFAULTS, options || {},
      { timing: Object.assign({}, TIMING, (options || {}).timing) });
    const banks = [];

    for (let at = 0; at < settings.banks; at += 1) {
      banks.push({ open: null, freeAt: 0, activations: 0 });
    }
    return { settings: settings, banks: banks, queue: [], clock: 0, busUntil: 0,
      timeline: [],
      counters: { requests: 0, rowHits: 0, rowMisses: 0, rowConflicts: 0,
        cycles: 0, busyCycles: 0, worstWait: 0, served: 0 } };
  }

  /**
   * Which bank and row an address lands in.
   *
   * Bank-first interleaving puts the bank bits BELOW the row bits, so line n
   * and line n+1 are in different banks; row-first puts them above, so a whole
   * row fills before the next bank is touched. Everything about a sequential
   * walk's performance follows from that one choice.
   */
  function locate(dram, address) {
    const line = Math.floor(address / dram.settings.lineBytes);

    if (dram.settings.interleave === 'rowFirst') {
      const row = Math.floor(line / dram.settings.rowLines);

      return { bank: row % dram.settings.banks,
        row: Math.floor(row / dram.settings.banks), line: line };
    }
    const bank = line % dram.settings.banks;

    return { bank: bank, row: Math.floor(line / dram.settings.banks / dram.settings.rowLines),
      line: line };
  }

  function outcomeFor(bank, row) {
    if (bank.open === row) return 'rowHit';
    if (bank.open === null) return 'rowMiss';
    return 'rowConflict';
  }

  /** The outcome names are singular and the counters are plural, which is a
   *  one-character mismatch that silently reports every row-hit rate as zero:
   *  `counters[outcome] += 1` creates a new NaN property instead of touching
   *  the counter the summary reads. */
  const COUNTER = { rowHit: 'rowHits', rowMiss: 'rowMisses', rowConflict: 'rowConflicts' };

  function costOf(dram, outcome) {
    const timing = dram.settings.timing;

    if (outcome === 'rowHit') return timing.tCAS;
    if (outcome === 'rowMiss') return timing.tRCD + timing.tCAS;
    return timing.tRP + timing.tRCD + timing.tCAS;
  }

  /* --------------------------------------------------------- scheduling */

  function submit(dram, address) {
    const parts = locate(dram, address);

    dram.counters.requests += 1;
    dram.queue.push({ address: address, bank: parts.bank, row: parts.row,
      arrived: dram.clock, id: dram.counters.requests });
  }

  /**
   * Pick the next request.
   *
   * FCFS takes the oldest. FR-FCFS looks for one that hits an already-open row
   * and takes the oldest of those, falling back to the oldest overall - which
   * is the reordering that raises throughput and is also how a request in an
   * unlucky bank waits far longer than its arrival order suggests.
   */
  function choose(dram) {
    if (!dram.queue.length) return null;
    if (dram.settings.policy === 'fcfs') return dram.queue[0];
    const ready = dram.queue.filter(function (request) {
      return dram.banks[request.bank].open === request.row;
    });

    return ready.length ? ready[0] : dram.queue[0];
  }

  /**
   * Serve one request, with the banks overlapping and the data bus serialised.
   *
   * That split is where bank-level parallelism comes from and a model with a
   * single clock cannot show it. Opening a row in one bank happens while
   * another bank is transferring, so the activation and precharge time hides;
   * the transfer itself does not, because there is one bus. Serialising
   * everything makes eight banks behave exactly like one, and the
   * interleaving control - the whole point of the section - then does nothing.
   */
  function serve(dram) {
    const request = choose(dram);

    if (!request) return null;
    const bank = dram.banks[request.bank];
    const outcome = outcomeFor(bank, request.row);
    const cost = costOf(dram, outcome);
    const overlap = cost - dram.settings.timing.tCAS;
    const ready = Math.max(dram.clock, bank.freeAt) + overlap;
    const start = Math.max(ready, dram.busUntil);
    const end = start + dram.settings.timing.tCAS;

    dram.queue.splice(dram.queue.indexOf(request), 1);
    if (outcome !== 'rowHit') bank.activations += 1;
    bank.open = request.row;
    bank.freeAt = end;
    dram.busUntil = end;
    dram.clock = Math.max(dram.clock, request.arrived);
    dram.counters[COUNTER[outcome]] += 1;
    dram.counters.cycles += end - request.arrived;
    dram.counters.busyCycles = Math.max(dram.counters.busyCycles, end);
    dram.counters.served += 1;
    dram.counters.worstWait = Math.max(dram.counters.worstWait, end - request.arrived);
    dram.timeline.push({ id: request.id, bank: request.bank, row: request.row,
      outcome: outcome, start: start, end: end, wait: end - request.arrived });
    return dram.timeline[dram.timeline.length - 1];
  }

  /**
   * Run a trace: requests arrive in batches of the queue depth, and every
   * batch is drained before the next arrives. That is a coarse model of a
   * loaded memory controller and it is enough for the point - reordering only
   * has anything to reorder when several requests are outstanding, which is
   * why the policy does nothing at a queue depth of one.
   */
  function replay(dram, trace) {
    const depth = Math.max(1, dram.settings.queue);
    const rows = trace || [];

    for (let at = 0; at < rows.length; at += depth) {
      dram.clock = Math.max(dram.clock, dram.busUntil);
      rows.slice(at, at + depth).forEach(function (entry) {
        submit(dram, typeof entry === 'number' ? entry : entry.address);
      });
      while (dram.queue.length) serve(dram);
    }
    return summary(dram);
  }

  function summary(dram) {
    const counters = dram.counters;
    const served = Math.max(1, counters.served);

    return { requests: counters.requests, served: counters.served,
      rowHits: counters.rowHits, rowMisses: counters.rowMisses,
      rowConflicts: counters.rowConflicts,
      rowHitRate: counters.rowHits / served,
      cycles: counters.cycles, average: counters.cycles / served,
      elapsed: counters.busyCycles, worstWait: counters.worstWait,
      policy: dram.settings.policy, interleave: dram.settings.interleave,
      banks: dram.settings.banks, rowLines: dram.settings.rowLines,
      activations: dram.banks.reduce(function (sum, bank) {
        return sum + bank.activations;
      }, 0),
      /* Bandwidth in lines per thousand cycles of WALL time, not of summed
         service time. Dividing by the summed service time counts a request
         that waited in a queue as if it took the machine that long, and the
         resulting figure goes DOWN when the controller gets better at
         overlapping - which is the wrong direction for a bandwidth number. */
      throughput: counters.busyCycles ? 1000 * counters.served / counters.busyCycles : 0 };
  }

  return { TIMING: TIMING, INTERLEAVE: INTERLEAVE, POLICIES: POLICIES, DEFAULTS: DEFAULTS,
    create: create, locate: locate, submit: submit, serve: serve, replay: replay,
    summary: summary, costOf: costOf, outcomeFor: outcomeFor };
}));

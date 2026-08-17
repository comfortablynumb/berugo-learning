/**
 * A discrete-event simulation kernel, driven by whatever priority queue it is
 * handed.
 *
 * Simulated time does not advance in steps — it jumps to the timestamp of the
 * next event. That is the whole idea: nothing is computed for the intervals in
 * between, so a simulation of an hour costs the number of events rather than
 * the number of milliseconds. The priority queue is the clock, which is why
 * this kernel lives in the heaps milestone and gets reused by the scheduler,
 * network and distributed-systems milestones later.
 *
 * The queue is injected rather than chosen, so the same simulation can be run
 * on a binary heap, a pairing heap or a timer wheel and the difference is
 * visible in the operation counts rather than argued about.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.EventSim = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function newStats() {
    return { scheduled: 0, processed: 0, cancelled: 0, maxQueue: 0 };
  }

  function create(options) {
    const settings = options || {};
    const queue = settings.queue;
    if (!queue) throw new Error('event-sim: a priority queue must be supplied');

    const payloads = new Map();
    let now = 0;
    let sequence = 0;
    let stats = newStats();

    /** Ties are broken by insertion order, so a simulation is reproducible:
     *  two events at the same instant must not depend on heap internals. */
    function schedule(at, type, payload) {
      if (at < now) throw new Error('event-sim: cannot schedule into the past (' + at + ' < ' + now + ')');
      sequence += 1;
      const id = 'e' + sequence;
      payloads.set(id, { at: at, type: type, payload: payload, sequence: sequence });
      queue.push(at * 1e6 + sequence, id);
      stats.scheduled += 1;
      stats.maxQueue = Math.max(stats.maxQueue, queue.size());
      return id;
    }

    function cancel(id) {
      if (!payloads.has(id)) return false;
      payloads.get(id).cancelled = true;
      stats.cancelled += 1;
      return true;
    }

    /** Runs until the queue empties or the clock passes `until`. */
    function run(options2) {
      const settings2 = options2 || {};
      const until = settings2.until === undefined ? Infinity : settings2.until;
      const onEvent = settings2.onEvent || function () {};
      const limit = settings2.maxEvents || 1e7;

      while (queue.size() && stats.processed < limit) {
        const top = queue.peek();
        const event = payloads.get(top.id);
        if (event.at > until) break;

        queue.pop();
        payloads.delete(top.id);
        if (event.cancelled) continue;

        now = event.at;
        stats.processed += 1;
        onEvent({ at: event.at, type: event.type, payload: event.payload, schedule: schedule });
      }
      return { now: now, processed: stats.processed, pending: queue.size() };
    }

    return {
      schedule: schedule,
      cancel: cancel,
      run: run,
      now: function () { return now; },
      pending: function () { return queue.size(); },
      queue: function () { return queue; },
      stats: function () { return Object.assign({ now: now }, stats); },
      resetStats: function () { stats = newStats(); }
    };
  }

  /** An M/M/1 queue: exponential arrivals at rate λ, exponential service at
   *  rate μ, one server. It is the classic check on Little's law from M02.5 —
   *  L = λ·W should hold whatever the distributions, and here it can be
   *  measured rather than asserted. */
  function mm1(options) {
    const settings = options || {};
    const rng = settings.rng;
    const lambda = settings.lambda || 0.8;
    const mu = settings.mu || 1;
    const horizon = settings.horizon || 20000;

    const sim = create({ queue: settings.queue });
    const waiting = [];
    let busy = false;
    let served = 0;
    let totalTime = 0;
    let areaUnderQueue = 0;
    let lastAt = 0;
    let inSystem = 0;

    function exponential(rate) {
      return -Math.log(1 - rng.next()) / rate;
    }

    function accrue(at) {
      areaUnderQueue += inSystem * (at - lastAt);
      lastAt = at;
    }

    function onEvent(event) {
      accrue(event.at);

      if (event.type === 'arrival') {
        inSystem += 1;
        waiting.push(event.at);
        if (event.at + exponential(lambda) < horizon) {
          event.schedule(event.at + exponential(lambda), 'arrival', null);
        }
        if (!busy) {
          busy = true;
          event.schedule(event.at + exponential(mu), 'departure', null);
        }
        return;
      }

      inSystem -= 1;
      served += 1;
      totalTime += event.at - waiting.shift();
      if (waiting.length) event.schedule(event.at + exponential(mu), 'departure', null);
      else busy = false;
    }

    sim.schedule(exponential(lambda), 'arrival', null);
    sim.run({ until: horizon, onEvent: onEvent });
    accrue(horizon);

    const rho = lambda / mu;
    return {
      served: served,
      /* L from the time-average, W from the per-customer average. */
      meanInSystem: areaUnderQueue / horizon,
      meanTimeInSystem: served ? totalTime / served : 0,
      arrivalRate: served / horizon,
      utilisation: rho,
      predictedInSystem: rho / (1 - rho),
      predictedTimeInSystem: 1 / (mu - lambda),
      events: sim.stats().processed,
      maxQueue: sim.stats().maxQueue,
      queueStats: sim.queue().stats()
    };
  }

  return { create: create, mm1: mm1, newStats: newStats };
}));

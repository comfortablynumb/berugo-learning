/**
 * RaceOracle - which of the reported races can actually happen.
 *
 * A race detector reads one observed interleaving and reasons about the ones
 * that did not happen; this decides the question the other way, by running all
 * of them. The per-thread event sequences are taken from the trace as PROGRAM
 * ORDER, and every schedule consistent with the synchronisation is enumerated:
 * a lock may be held by one thread at a time, a forked thread runs only after
 * its fork, and a join waits.
 *
 * A race is then the operational thing rather than an inferred one: two
 * conflicting accesses to the same location, from different threads, at least
 * one of them a write, executed with nothing in between. If no schedule puts
 * them together, no execution of this program can.
 *
 * That makes it an oracle rather than another detector, and it is exhaustive
 * rather than sampled — which is only affordable because the fixtures are a
 * dozen events. It reports `exhausted` when the state budget stops it, because
 * a partial enumeration proves nothing in the direction that matters.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.RaceOracle = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const ACCESS = { read: true, write: true };

  /** Program order per thread, and the fork that lets a thread start. */
  function programOf(trace) {
    const threads = {};
    const startedBy = {};

    trace.forEach(function (event, at) {
      threads[event.thread] = threads[event.thread] || [];
      threads[event.thread].push({ op: event.op, target: event.target,
        thread: event.thread, at: at });
      if (event.op !== 'fork') return;
      startedBy[event.target] = event.thread;
      threads[event.target] = threads[event.target] || [];
    });
    return { threads: threads, startedBy: startedBy, names: Object.keys(threads).sort() };
  }

  function keyOf(state, program) {
    return program.names.map(function (name) { return state.at[name]; }).join(',') + '|' +
      Object.keys(state.locks).sort().map(function (lock) {
        return lock + ':' + state.locks[lock];
      }).join(',') + '|' + (state.last ? state.last.thread + ':' + state.last.at : '-');
  }

  function done(state, program, name) {
    return state.at[name] >= program.threads[name].length;
  }

  /** A thread may step when it has started, is not waiting on a lock somebody
   *  else holds, and is not blocked on a join. */
  function enabled(state, program, name) {
    if (done(state, program, name)) return null;
    if (program.startedBy[name] && !state.started[name]) return null;
    const event = program.threads[name][state.at[name]];

    if (event.op === 'acquire' && state.locks[event.target] !== undefined &&
      state.locks[event.target] !== name) return null;
    if (event.op === 'join' && !done(state, program, event.target)) return null;
    return event;
  }

  function advance(state, program, name, event) {
    const next = { at: Object.assign({}, state.at), locks: Object.assign({}, state.locks),
      started: Object.assign({}, state.started), last: event };

    next.at[name] += 1;
    if (event.op === 'acquire') next.locks[event.target] = name;
    if (event.op === 'release') delete next.locks[event.target];
    if (event.op === 'fork') next.started[event.target] = true;
    return next;
  }

  function conflict(before, event) {
    if (!before || !ACCESS[before.op] || !ACCESS[event.op]) return false;
    if (before.target !== event.target) return false;
    if (before.thread === event.thread) return false;
    return before.op === 'write' || event.op === 'write';
  }

  function initial(program) {
    const state = { at: {}, locks: {}, started: {}, last: null };

    program.names.forEach(function (name) {
      state.at[name] = 0;
      if (!program.startedBy[name]) state.started[name] = true;
    });
    return state;
  }

  /**
   * Every schedule, depth-first over the state graph with a visited set. The
   * budget is a real limit rather than a formality: without `exhausted` in the
   * report, a truncated search that found no race is indistinguishable from a
   * program that has none.
   */
  function races(trace, options) {
    const settings = options || {};
    const program = programOf(trace);
    const run = { seen: {}, found: {}, states: 0, budget: settings.states || 200000,
      program: program };

    walk(run, initial(program));
    return { races: Object.keys(run.found).map(function (key) { return run.found[key]; }),
      locations: unique(Object.keys(run.found).map(function (key) {
        return run.found[key].location;
      })), states: run.states, exhausted: run.states < run.budget,
      threads: program.names };
  }

  function walk(run, state) {
    const key = keyOf(state, run.program);

    if (run.seen[key] || run.states >= run.budget) return;
    run.seen[key] = true;
    run.states += 1;
    run.program.names.forEach(function (name) {
      const event = enabled(state, run.program, name);

      if (!event) return;
      record(run, state.last, event);
      walk(run, advance(state, run.program, name, event));
    });
  }

  function record(run, before, event) {
    if (!conflict(before, event)) return;
    const key = event.target + '/' + Math.min(before.at, event.at) + '/' +
      Math.max(before.at, event.at);

    run.found[key] = { location: event.target, first: before, second: event,
      why: before.thread + ' ' + before.op + 's and ' + event.thread + ' ' + event.op +
        's with nothing in between' };
  }

  function unique(list) {
    return Object.keys(list.reduce(function (into, name) {
      into[name] = true;
      return into;
    }, {})).sort();
  }

  return { races: races, programOf: programOf, conflict: conflict, unique: unique };
}));

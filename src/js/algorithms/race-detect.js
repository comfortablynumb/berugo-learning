/**
 * Data-race detection two ways: happens-before with vector clocks, and
 * locksets. They disagree, and the disagreement is the section.
 *
 * A race detector sees ONE interleaving — the one that happened — so the
 * useful question is not "did two accesses collide" but "were they ORDERED".
 * That is why happens-before is the right relation: two accesses to the same
 * location, at least one a write, from different threads, with no
 * happens-before edge between them, are a race whether or not they actually
 * overlapped in the observed run. A detector that only reported observed
 * overlaps would find almost nothing.
 *
 * **Vector clocks** implement that relation exactly. Each thread carries a
 * vector of the last event it knows about from every thread; a release stores
 * the clock on the lock and an acquire joins it in, which is what transfers
 * the ordering. Two accesses are ordered when one thread's clock dominated the
 * other at the time. FastTrack's optimisation — an epoch rather than a full
 * vector for the common case — is a constant-factor story on top of this and
 * is not what makes it correct.
 *
 * **Locksets** ask a different question: is there a lock held at every access
 * to this location. That is cheaper, needs no vector, and reports races that
 * cannot happen — a location protected by a lock in one phase and by
 * thread-confinement in another has an empty lockset and is reported. Eraser
 * shipped with a state machine to suppress the commonest of those, and the
 * false-positive profile is still the reason the technique lost.
 *
 * Both run over the same trace here, and the report is the two answers side by
 * side rather than a verdict.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.RaceDetect = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  /* --------------------------------------------------------- vector clocks */

  function zeroClock(threads) {
    const clock = {};

    threads.forEach(function (name) { clock[name] = 0; });
    return clock;
  }

  function copyClock(clock) {
    return Object.assign({}, clock);
  }

  /** Join: the pointwise maximum, which is how knowledge is transferred. */
  function join(into, other) {
    Object.keys(other).forEach(function (name) {
      into[name] = Math.max(into[name] || 0, other[name]);
    });
    return into;
  }

  /**
   * `a` happens before `b` when every component of `a` is at most `b`'s. The
   * check is the whole definition of the relation and it is why a vector is
   * needed rather than a counter: a single number cannot express that two
   * threads each know something the other does not.
   */
  function precedes(a, b) {
    return Object.keys(a).every(function (name) {
      return a[name] <= (b[name] || 0);
    });
  }

  /* ---------------------------------------------------------- the trace */

  /**
   * An event is `{ thread, op, target }` with `op` in read, write, acquire,
   * release, fork, join. That vocabulary is small and covers every
   * synchronisation the detector can see — which is the point: a detector
   * only knows about the orderings the runtime tells it about, and a
   * happens-before edge established by something it was not told about is
   * a false positive nobody can explain.
   */
  function threadsOf(trace) {
    const seen = {};

    trace.forEach(function (event) {
      seen[event.thread] = true;
      if (event.op === 'fork' || event.op === 'join') seen[event.target] = true;
    });
    return Object.keys(seen).sort();
  }

  function happensBefore(trace) {
    const threads = threadsOf(trace);
    const state = { clocks: {}, locks: {}, lastWrite: {}, lastReads: {},
      races: [], events: 0 };

    threads.forEach(function (name) {
      state.clocks[name] = zeroClock(threads);
      state.clocks[name][name] = 1;
    });
    trace.forEach(function (event, at) { stepEvent(state, event, at); });
    return { races: state.races, threads: threads, events: state.events,
      clocks: state.clocks };
  }

  function stepEvent(state, event, at) {
    state.events += 1;
    const clock = state.clocks[event.thread];

    if (event.op === 'acquire') { join(clock, state.locks[event.target] || {}); return; }
    if (event.op === 'release') {
      state.locks[event.target] = copyClock(clock);
      clock[event.thread] += 1;
      return;
    }
    if (event.op === 'fork') { forkInto(state, event, clock); return; }
    if (event.op === 'join') { joinInto(state, event, clock); return; }
    checkAccess(state, event, clock, at);
  }

  function forkInto(state, event, clock) {
    state.clocks[event.target] = join(copyClock(clock), state.clocks[event.target] || {});
    state.clocks[event.target][event.target] += 1;
    clock[event.thread] += 1;
  }

  function joinInto(state, event, clock) {
    join(clock, state.clocks[event.target] || {});
    clock[event.thread] += 1;
  }

  /**
   * A write races with any earlier unordered access; a read races only with an
   * earlier unordered WRITE. Getting that asymmetry wrong doubles the report
   * with read-read pairs, which are not races and which destroy the tool's
   * credibility faster than a missed bug does.
   */
  function checkAccess(state, event, clock, at) {
    const key = event.target;
    const previousWrite = state.lastWrite[key];

    if (previousWrite && previousWrite.thread !== event.thread
      && !precedes(previousWrite.clock, clock)) {
      state.races.push(raceRow(previousWrite, event, at, 'write'));
    }
    if (event.op === 'write') checkAgainstReads(state, event, clock, at);
    if (event.op === 'write') {
      state.lastWrite[key] = { thread: event.thread, clock: copyClock(clock), at: at };
      state.lastReads[key] = [];
      return;
    }
    state.lastReads[key] = (state.lastReads[key] || []).concat(
      [{ thread: event.thread, clock: copyClock(clock), at: at }]);
  }

  function checkAgainstReads(state, event, clock, at) {
    (state.lastReads[event.target] || []).forEach(function (row) {
      if (row.thread === event.thread || precedes(row.clock, clock)) return;
      state.races.push(raceRow(row, event, at, 'read'));
    });
  }

  function raceRow(earlier, event, at, kind) {
    return { location: event.target, first: earlier.thread, second: event.thread,
      firstAt: earlier.at, secondAt: at, kind: kind + '-' + event.op };
  }

  /* --------------------------------------------------------- the lockset */

  /**
   * Eraser's rule: every shared location has a candidate set of locks, which
   * starts as everything held at the first access and is intersected at every
   * later one. An empty set means no single lock protects the location, which
   * is reported as a race — and is why thread-confinement, initialisation
   * before publication and read-only-after-publication all produce false
   * positives.
   */
  function lockset(trace) {
    const state = { held: {}, candidates: {}, threads: {}, reports: [], events: 0 };

    trace.forEach(function (event, at) { stepLockset(state, event, at); });
    return { reports: state.reports, events: state.events,
      candidates: state.candidates };
  }

  function stepLockset(state, event, at) {
    state.events += 1;
    state.held[event.thread] = state.held[event.thread] || [];
    if (event.op === 'acquire') { state.held[event.thread].push(event.target); return; }
    if (event.op === 'release') {
      state.held[event.thread] = state.held[event.thread].filter(function (name) {
        return name !== event.target;
      });
      return;
    }
    if (event.op === 'fork' || event.op === 'join') return;
    updateCandidates(state, event, at);
  }

  function updateCandidates(state, event, at) {
    const key = event.target;
    const held = state.held[event.thread].slice();

    state.threads[key] = state.threads[key] || {};
    state.threads[key][event.thread] = true;
    if (state.candidates[key] === undefined) { state.candidates[key] = held; return; }
    state.candidates[key] = state.candidates[key].filter(function (name) {
      return held.indexOf(name) !== -1;
    });
    /* Only report once the location has been touched by more than one thread:
       a single-threaded location with no lock is not a race, and reporting it
       is the false positive Eraser's state machine exists to suppress. */
    if (state.candidates[key].length) return;
    if (Object.keys(state.threads[key]).length < 2) return;
    if (state.reports.some(function (row) { return row.location === key; })) return;
    state.reports.push({ location: key, at: at,
      threads: Object.keys(state.threads[key]),
      why: 'no lock is held at every access' });
  }

  /* ------------------------------------------------------- the comparison */

  /**
   * Both detectors over one trace, with the seeded answer beside them. A
   * detector is judged on two numbers rather than one: every seeded race
   * found, and nothing reported on a correctly synchronised location.
   */
  function compare(trace, seeded) {
    const hb = happensBefore(trace);
    const ls = lockset(trace);
    const hbLocations = unique(hb.races.map(function (row) { return row.location; }));
    const lsLocations = unique(ls.reports.map(function (row) { return row.location; }));
    const expected = (seeded || []).slice().sort();

    return { happensBefore: hb, lockset: ls,
      hbLocations: hbLocations, lsLocations: lsLocations,
      hbMissed: expected.filter(function (name) {
        return hbLocations.indexOf(name) === -1;
      }),
      hbFalse: hbLocations.filter(function (name) { return expected.indexOf(name) === -1; }),
      lsMissed: expected.filter(function (name) {
        return lsLocations.indexOf(name) === -1;
      }),
      lsFalse: lsLocations.filter(function (name) { return expected.indexOf(name) === -1; }),
      expected: expected };
  }

  function unique(rows) {
    return rows.filter(function (name, at) { return rows.indexOf(name) === at; }).sort();
  }

  return { zeroClock: zeroClock, copyClock: copyClock, join: join, precedes: precedes,
    threadsOf: threadsOf, happensBefore: happensBefore, lockset: lockset,
    compare: compare };
}));

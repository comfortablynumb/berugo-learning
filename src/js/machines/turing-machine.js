/**
 * A Turing machine, with a step budget that is not optional.
 *
 * The model is deliberately the textbook one: an infinite tape, a head that
 * moves one cell at a time, and a transition function from (state, symbol) to
 * (state, symbol, direction). Everything in this milestone is defined in terms
 * of it, so it is worth keeping recognisable rather than optimised.
 *
 * The step budget is the part that matters for a page that must not hang. A
 * Turing machine may run forever, and that is not a defect to be worked around
 * — it is the subject. So `run` returns one of three outcomes: `halted`,
 * `rejected`, or `budget`, and a caller that treats `budget` as a rejection is
 * making exactly the mistake section 26.3 is about. Bounded halting is
 * decidable; unbounded is not; and every timeout, fuel counter and step limit
 * in production software is that substitution.
 *
 * The tape is a sparse map from index to symbol rather than an array, so it is
 * genuinely two-way infinite and a machine that walks left from zero does not
 * need special handling.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.TuringMachine = api;
}(this, function () {
  'use strict';

  const BLANK = '_';
  const OUTCOMES = ['halted', 'rejected', 'budget'];

  /**
   * `transitions` is a flat list of { from, read, to, write, move } where
   * `move` is 'L', 'R' or 'S'. A missing entry is a rejection, which is the
   * standard convention and is why a machine needs no explicit reject state.
   */
  function create(config) {
    const table = {};

    (config.transitions || []).forEach(function (edge) {
      if (!table[edge.from]) table[edge.from] = {};
      table[edge.from][edge.read] = edge;
    });
    return {
      states: (config.states || Object.keys(table)).slice(),
      start: config.start,
      accepting: (config.accepting || []).slice(),
      blank: config.blank || BLANK,
      transitions: (config.transitions || []).slice(),
      table: table,
      label: config.label || null,
      tapes: config.tapes || 1
    };
  }

  /* --------------------------------------------------------------- the tape */

  function tapeFrom(input, blank) {
    const cells = {};

    String(input).split('').forEach(function (symbol, i) {
      if (symbol !== blank) cells[i] = symbol;
    });
    return { cells: cells, blank: blank, low: 0, high: Math.max(0, String(input).length - 1) };
  }

  function read(tape, at) {
    return tape.cells[at] === undefined ? tape.blank : tape.cells[at];
  }

  function write(tape, at, symbol) {
    if (symbol === tape.blank) delete tape.cells[at]; else tape.cells[at] = symbol;
    tape.low = Math.min(tape.low, at);
    tape.high = Math.max(tape.high, at);
  }

  /** The tape as a string, trimmed to the cells that have ever been touched. */
  function show(tape, at, width) {
    const span = width === undefined ? 24 : width;
    const from = Math.min(tape.low, at);
    const to = Math.max(tape.high, at);
    const out = [];

    for (let i = from; i <= to && out.length < span; i += 1) out.push(read(tape, i));
    return out.join('');
  }

  /* ------------------------------------------------------------- execution */

  /**
   * Run to a halt, a rejection, or the budget. The three outcomes are distinct
   * on purpose: reporting a budget exhaustion as a rejection is a lie about the
   * language, and it is the single easiest way to make a computability demo
   * teach the opposite of the truth.
   */
  function run(machine, input, options) {
    const settings = options || {};
    const budget = settings.budget === undefined ? 10000 : settings.budget;
    const tape = tapeFrom(input, machine.blank);
    const trace = [];
    const state = { at: 0, current: machine.start, steps: 0 };

    while (state.steps < budget) {
      if (trace.length < (settings.traceLimit === undefined ? 60 : settings.traceLimit)) {
        trace.push(snapshot(machine, tape, state));
      }
      const edge = (machine.table[state.current] || {})[read(tape, state.at)];

      if (!edge) return finish(machine, tape, state, trace, 'halted');
      write(tape, state.at, edge.write);
      state.at += edge.move === 'L' ? -1 : (edge.move === 'R' ? 1 : 0);
      state.current = edge.to;
      state.steps += 1;
    }
    return finish(machine, tape, state, trace, 'budget');
  }

  function finish(machine, tape, state, trace, outcome) {
    const accepted = outcome === 'halted'
      && machine.accepting.indexOf(state.current) !== -1;

    return {
      outcome: accepted ? 'halted' : (outcome === 'budget' ? 'budget' : 'rejected'),
      accepted: accepted, halted: outcome === 'halted',
      state: state.current, steps: state.steps, head: state.at,
      tape: show(tape, state.at, 200), cells: tape.cells, trace: trace,
      /* The visited span is the space the machine used, which is what the
         space-complexity section measures rather than asserts. */
      space: tape.high - tape.low + 1
    };
  }

  function snapshot(machine, tape, state) {
    return { step: state.steps, state: state.current, head: state.at,
      symbol: read(tape, state.at), tape: show(tape, state.at, 24) };
  }

  /** Accept only; a budget exhaustion is NOT an acceptance and NOT a
   *  rejection, so callers that need a boolean have to say which they mean. */
  function accepts(machine, input, budget) {
    return run(machine, input, { budget: budget }).accepted;
  }

  /**
   * The bounded halting problem, which IS decidable — this function is a
   * decider, and section 26.3 builds the argument that removing the bound
   * makes one impossible.
   */
  function haltsWithin(machine, input, steps) {
    return run(machine, input, { budget: steps, traceLimit: 0 }).halted;
  }

  /* -------------------------------------------------------------- encoding */

  /**
   * A machine as a string, which is what makes the universal machine and the
   * diagonal argument possible: a program is data. The encoding is readable
   * rather than minimal, because its purpose is to be looked at.
   */
  function encode(machine) {
    const parts = machine.transitions.map(function (edge) {
      return [edge.from, edge.read, edge.to, edge.write, edge.move].join(',');
    });

    return [machine.start, machine.accepting.join('+'), parts.join(';')].join('|');
  }

  function decode(text) {
    const parts = String(text).split('|');
    const transitions = parts[2] ? parts[2].split(';').map(function (row) {
      const fields = row.split(',');

      return { from: fields[0], read: fields[1], to: fields[2], write: fields[3],
        move: fields[4] };
    }) : [];

    return create({ start: parts[0], accepting: parts[1] ? parts[1].split('+') : [],
      transitions: transitions, label: 'decoded' });
  }

  /* ------------------------------------------------------------ ready-made */

  /** Binary increment: walk to the right end, then carry leftwards. */
  function increment() {
    return create({
      start: 'right', accepting: ['done'], label: 'binary increment',
      transitions: [
        { from: 'right', read: '0', to: 'right', write: '0', move: 'R' },
        { from: 'right', read: '1', to: 'right', write: '1', move: 'R' },
        { from: 'right', read: '_', to: 'carry', write: '_', move: 'L' },
        { from: 'carry', read: '1', to: 'carry', write: '0', move: 'L' },
        { from: 'carry', read: '0', to: 'done', write: '1', move: 'S' },
        { from: 'carry', read: '_', to: 'done', write: '1', move: 'S' }
      ]
    });
  }

  /**
   * `aⁿbⁿcⁿ`, the language that is not context-free and is decidable — the
   * whole point of the section. It crosses off one a, one b and one c per
   * sweep, which is why it is quadratic.
   */
  function anbncn() {
    return create({
      start: 'v0', accepting: ['accept'], label: 'aⁿbⁿcⁿ',
      transitions: [
        /* Phase one verifies the shape is a* b* c*. Without it the crossing-off
           loop below accepts `abcabc`, because marking one of each per sweep
           says nothing about the ORDER — a bug that only an exhaustive check
           over every string finds. */
        { from: 'v0', read: 'a', to: 'v0', write: 'a', move: 'R' },
        { from: 'v0', read: 'b', to: 'v1', write: 'b', move: 'R' },
        { from: 'v0', read: 'c', to: 'v2', write: 'c', move: 'R' },
        { from: 'v0', read: '_', to: 'rewind', write: '_', move: 'L' },
        { from: 'v1', read: 'b', to: 'v1', write: 'b', move: 'R' },
        { from: 'v1', read: 'c', to: 'v2', write: 'c', move: 'R' },
        { from: 'v1', read: '_', to: 'rewind', write: '_', move: 'L' },
        { from: 'v2', read: 'c', to: 'v2', write: 'c', move: 'R' },
        { from: 'v2', read: '_', to: 'rewind', write: '_', move: 'L' },
        { from: 'rewind', read: 'a', to: 'rewind', write: 'a', move: 'L' },
        { from: 'rewind', read: 'b', to: 'rewind', write: 'b', move: 'L' },
        { from: 'rewind', read: 'c', to: 'rewind', write: 'c', move: 'L' },
        { from: 'rewind', read: '_', to: 'scan', write: '_', move: 'R' },
        /* Phase two crosses off one a, one b and one c per sweep, which is why
           it is quadratic and why a finite automaton cannot do it. */
        { from: 'scan', read: 'a', to: 'findB', write: 'X', move: 'R' },
        { from: 'scan', read: 'X', to: 'scan', write: 'X', move: 'R' },
        { from: 'scan', read: 'Y', to: 'scan', write: 'Y', move: 'R' },
        { from: 'scan', read: 'Z', to: 'scan', write: 'Z', move: 'R' },
        { from: 'scan', read: '_', to: 'accept', write: '_', move: 'S' },
        { from: 'findB', read: 'a', to: 'findB', write: 'a', move: 'R' },
        { from: 'findB', read: 'Y', to: 'findB', write: 'Y', move: 'R' },
        { from: 'findB', read: 'b', to: 'findC', write: 'Y', move: 'R' },
        { from: 'findC', read: 'b', to: 'findC', write: 'b', move: 'R' },
        { from: 'findC', read: 'Z', to: 'findC', write: 'Z', move: 'R' },
        { from: 'findC', read: 'c', to: 'back', write: 'Z', move: 'L' },
        { from: 'back', read: 'a', to: 'back', write: 'a', move: 'L' },
        { from: 'back', read: 'b', to: 'back', write: 'b', move: 'L' },
        { from: 'back', read: 'Y', to: 'back', write: 'Y', move: 'L' },
        { from: 'back', read: 'Z', to: 'back', write: 'Z', move: 'L' },
        { from: 'back', read: 'X', to: 'scan', write: 'X', move: 'R' }
      ]
    });
  }

  /** A machine that never halts on any input — the honest witness for the
   *  budget outcome. */
  function looper() {
    return create({
      start: 'go', accepting: [], label: 'never halts',
      transitions: [
        { from: 'go', read: '0', to: 'go', write: '0', move: 'R' },
        { from: 'go', read: '1', to: 'go', write: '1', move: 'R' },
        { from: 'go', read: '_', to: 'go', write: '_', move: 'R' }
      ]
    });
  }

  /** Palindromes over {0, 1}: match the ends and work inwards. */
  function palindrome() {
    return create({
      start: 'read', accepting: ['accept'], label: 'binary palindromes',
      transitions: [
        { from: 'read', read: '0', to: 'find0', write: '_', move: 'R' },
        { from: 'read', read: '1', to: 'find1', write: '_', move: 'R' },
        { from: 'read', read: '_', to: 'accept', write: '_', move: 'S' },
        { from: 'find0', read: '0', to: 'find0', write: '0', move: 'R' },
        { from: 'find0', read: '1', to: 'find0', write: '1', move: 'R' },
        { from: 'find0', read: '_', to: 'match0', write: '_', move: 'L' },
        { from: 'find1', read: '0', to: 'find1', write: '0', move: 'R' },
        { from: 'find1', read: '1', to: 'find1', write: '1', move: 'R' },
        { from: 'find1', read: '_', to: 'match1', write: '_', move: 'L' },
        { from: 'match0', read: '0', to: 'rewind', write: '_', move: 'L' },
        { from: 'match0', read: '_', to: 'accept', write: '_', move: 'S' },
        { from: 'match1', read: '1', to: 'rewind', write: '_', move: 'L' },
        { from: 'match1', read: '_', to: 'accept', write: '_', move: 'S' },
        { from: 'rewind', read: '0', to: 'rewind', write: '0', move: 'L' },
        { from: 'rewind', read: '1', to: 'rewind', write: '1', move: 'L' },
        { from: 'rewind', read: '_', to: 'read', write: '_', move: 'R' }
      ]
    });
  }

  /**
   * Unary doubling: for each original `1`, append one mark at the far right,
   * then turn every mark back into a `1`. The two mark symbols exist so the
   * appended output is never mistaken for more input — which is exactly the
   * bug the first version had, and it grew the tape until the budget stopped
   * it rather than looping in place.
   */
  function doubler() {
    return create({
      start: 'find', accepting: ['done'], label: 'unary doubling',
      transitions: [
        { from: 'find', read: '1', to: 'toEnd', write: 'X', move: 'R' },
        { from: 'find', read: 'X', to: 'find', write: 'X', move: 'R' },
        { from: 'find', read: 'Y', to: 'find', write: 'Y', move: 'R' },
        { from: 'find', read: '_', to: 'restore', write: '_', move: 'L' },
        { from: 'toEnd', read: '1', to: 'toEnd', write: '1', move: 'R' },
        { from: 'toEnd', read: 'X', to: 'toEnd', write: 'X', move: 'R' },
        { from: 'toEnd', read: 'Y', to: 'toEnd', write: 'Y', move: 'R' },
        { from: 'toEnd', read: '_', to: 'back', write: 'Y', move: 'L' },
        { from: 'back', read: '1', to: 'back', write: '1', move: 'L' },
        { from: 'back', read: 'Y', to: 'back', write: 'Y', move: 'L' },
        { from: 'back', read: 'X', to: 'find', write: 'X', move: 'R' },
        { from: 'restore', read: 'X', to: 'restore', write: '1', move: 'L' },
        { from: 'restore', read: 'Y', to: 'restore', write: '1', move: 'L' },
        { from: 'restore', read: '1', to: 'restore', write: '1', move: 'L' },
        { from: 'restore', read: '_', to: 'done', write: '_', move: 'R' }
      ]
    });
  }

  function programs() {
    return { increment: increment, anbncn: anbncn, palindrome: palindrome,
      doubler: doubler, looper: looper };
  }

  /** Transitions as rows for a demo table. */
  function transitionRows(machine) {
    return machine.transitions.map(function (edge) {
      return { from: edge.from, read: edge.read, to: edge.to, write: edge.write,
        move: edge.move === 'L' ? 'left' : (edge.move === 'R' ? 'right' : 'stay') };
    });
  }

  return {
    BLANK: BLANK, OUTCOMES: OUTCOMES,
    create: create, run: run, accepts: accepts, haltsWithin: haltsWithin,
    encode: encode, decode: decode, transitionRows: transitionRows,
    programs: programs, increment: increment, anbncn: anbncn,
    palindrome: palindrome, doubler: doubler, looper: looper,
    tapeFrom: tapeFrom, read: read, write: write, show: show
  };
}));

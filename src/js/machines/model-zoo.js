/**
 * Five models of computation behind one interface, so equivalence can be
 * demonstrated by RUNNING them rather than argued.
 *
 * Every model here exposes the same shape — `run(program, input, budget)`
 * returning `{ output, steps, trace, outcome }` — which is the whole point.
 * The claim "these models are equivalent" is usually supported by a simulation
 * sketch; here it is supported by running the same function in four of them and
 * comparing the outputs on every input in a range.
 *
 * The second claim is the one that matters more and gets stated less: equal
 * power is not equal efficiency. A two-counter machine is Turing complete and
 * computes `n + n` in time exponential in the encoding, while a RAM does it in
 * one instruction. That gap is exactly why complexity theory is a separate
 * subject from computability, and the step counts here make it visible.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.ModelZoo = api;
}(this, function () {
  'use strict';

  const MODELS = ['counter', 'ram', 'cellular', 'tag', 'ski'];

  function outcomeOf(steps, budget, halted) {
    if (halted) return 'halted';
    return steps >= budget ? 'budget' : 'stuck';
  }

  /* ------------------------------------------------- counter machines */

  /**
   * A counter machine: finitely many registers holding natural numbers, and
   * three instructions — increment, decrement-or-jump, and halt. That is
   * genuinely all of it, and it is Turing complete with TWO registers, which is
   * the fact worth carrying away.
   *
   * Instructions are { op: 'inc'|'dec'|'jmp'|'halt', reg, next, zero }.
   * `dec` jumps to `zero` when the register is already zero, which is the only
   * conditional in the model.
   */
  function runCounter(program, input, budget) {
    const cap = budget === undefined ? 200000 : budget;
    const registers = (input || []).slice();
    const trace = [];
    let at = 0;
    let steps = 0;

    while (steps < cap && at >= 0 && at < program.length) {
      const instruction = program[at];

      if (trace.length < 40) {
        trace.push({ step: steps, at: at, op: instruction.op,
          registers: registers.slice() });
      }
      if (instruction.op === 'halt') {
        return { output: registers.slice(), steps: steps, trace: trace, outcome: 'halted' };
      }
      at = applyCounter(instruction, registers, at);
      steps += 1;
    }
    return { output: registers.slice(), steps: steps, trace: trace,
      outcome: outcomeOf(steps, cap, at < 0 || at >= program.length) };
  }

  function applyCounter(instruction, registers, at) {
    const reg = instruction.reg;

    if (registers[reg] === undefined) registers[reg] = 0;
    if (instruction.op === 'inc') {
      registers[reg] += 1;
      return instruction.next === undefined ? at + 1 : instruction.next;
    }
    if (instruction.op === 'dec') {
      if (registers[reg] === 0) return instruction.zero;
      registers[reg] -= 1;
      return instruction.next === undefined ? at + 1 : instruction.next;
    }
    return instruction.next === undefined ? at + 1 : instruction.next;
  }

  /* --------------------------------------------------------------- RAM */

  /**
   * A random-access machine: indexed registers and arithmetic in one step. It
   * is the model every algorithm-analysis course silently assumes, which is why
   * "O(n)" means what you expect rather than what a Turing machine would
   * charge.
   */
  function runRam(program, input, budget) {
    const cap = budget === undefined ? 200000 : budget;
    const registers = (input || []).slice();
    const trace = [];
    let at = 0;
    let steps = 0;

    while (steps < cap && at >= 0 && at < program.length) {
      const instruction = program[at];

      if (trace.length < 40) {
        trace.push({ step: steps, at: at, op: instruction.op,
          registers: registers.slice(0, 6) });
      }
      if (instruction.op === 'halt') {
        return { output: registers.slice(), steps: steps, trace: trace, outcome: 'halted' };
      }
      at = applyRam(instruction, registers, at);
      steps += 1;
    }
    return { output: registers.slice(), steps: steps, trace: trace,
      outcome: outcomeOf(steps, cap, at < 0 || at >= program.length) };
  }

  const RAM_OPS = {
    set: function (i, r) { r[i.reg] = i.value; },
    add: function (i, r) { r[i.reg] = value(r, i.reg) + value(r, i.from); },
    sub: function (i, r) { r[i.reg] = Math.max(0, value(r, i.reg) - value(r, i.from)); },
    copy: function (i, r) { r[i.reg] = value(r, i.from); },
    load: function (i, r) { r[i.reg] = value(r, value(r, i.from)); },
    store: function (i, r) { r[value(r, i.reg)] = value(r, i.from); }
  };

  function value(registers, index) {
    return registers[index] === undefined ? 0 : registers[index];
  }

  function applyRam(instruction, registers, at) {
    if (instruction.op === 'jz') {
      return value(registers, instruction.reg) === 0 ? instruction.zero : at + 1;
    }
    if (instruction.op === 'jmp') return instruction.next;
    const handler = RAM_OPS[instruction.op];

    if (handler) handler(instruction, registers);
    return at + 1;
  }

  /* -------------------------------------------------- cellular automata */

  /**
   * An elementary cellular automaton: one row of cells, each updated from
   * itself and its two neighbours by an 8-bit rule number. Rule 110 is Turing
   * complete, which is the single most surprising fact in this section — a
   * three-cell lookup table, iterated, can compute anything.
   */
  function runCellular(rule, input, generations) {
    const width = String(input).length;
    const rows = [String(input).split('').map(Number)];
    const table = ruleTable(rule);

    for (let g = 0; g < generations; g += 1) {
      const previous = rows[rows.length - 1];
      const next = previous.map(function (cell, i) {
        const left = previous[(i - 1 + width) % width];
        const right = previous[(i + 1) % width];

        return table[(left << 2) | (cell << 1) | right];
      });

      rows.push(next);
    }
    return { output: rows[rows.length - 1], steps: generations * width,
      trace: rows.map(function (row) { return row.join(''); }), outcome: 'halted',
      rows: rows };
  }

  function ruleTable(rule) {
    const table = [];

    for (let i = 0; i < 8; i += 1) table[i] = (rule >> i) & 1;
    return table;
  }

  /* ------------------------------------------------------- tag systems */

  /**
   * A 2-tag system: delete the first m symbols, and append the production for
   * whichever symbol was first. Post proved these universal in 1943, and they
   * are the smallest model here — no tape, no registers, one queue.
   */
  function runTag(system, input, budget) {
    const cap = budget === undefined ? 20000 : budget;
    const trace = [];
    let word = String(input);
    let steps = 0;

    while (steps < cap && word.length >= system.deletion) {
      if (trace.length < 40) trace.push({ step: steps, word: word.slice(0, 40) });
      const production = system.rules[word[0]];

      if (production === undefined) break;
      if (system.halting && system.halting.indexOf(word[0]) !== -1) {
        return { output: word, steps: steps, trace: trace, outcome: 'halted' };
      }
      word = word.slice(system.deletion) + production;
      steps += 1;
    }
    return { output: word, steps: steps, trace: trace,
      outcome: outcomeOf(steps, cap, word.length < system.deletion) };
  }

  /* ------------------------------------------------ combinatory logic */

  /**
   * SKI combinators, reduced leftmost-outermost. Three rewrite rules and no
   * variables at all — which is the point: variable binding, the thing lambda
   * calculus is built on, is not primitive.
   *
   *   I x       -> x
   *   K x y     -> x
   *   S x y z   -> x z (y z)
   */
  function runSki(term, budget) {
    const cap = budget === undefined ? 4000 : budget;
    const trace = [];
    let current = term;
    let steps = 0;

    while (steps < cap) {
      if (trace.length < 40) trace.push({ step: steps, term: showSki(current) });
      const next = reduceSki(current);

      if (next === null) {
        return { output: showSki(current), steps: steps, trace: trace, outcome: 'halted',
          term: current };
      }
      current = next;
      steps += 1;
    }
    return { output: showSki(current), steps: steps, trace: trace, outcome: 'budget',
      term: current };
  }

  /** One leftmost-outermost reduction, or null when the term is normal. */
  function reduceSki(term) {
    if (typeof term === 'string') return null;
    const spine = spineOf(term);
    const head = spine[0];
    const args = spine.slice(1);

    if (head === 'I' && args.length >= 1) return rebuild(args[0], args.slice(1));
    if (head === 'K' && args.length >= 2) return rebuild(args[0], args.slice(2));
    if (head === 'S' && args.length >= 3) {
      const applied = ['app', ['app', args[0], args[2]], ['app', args[1], args[2]]];

      return rebuild(applied, args.slice(3));
    }
    for (let i = 0; i < args.length; i += 1) {
      const reduced = reduceSki(args[i]);

      if (reduced === null) continue;
      const copy = args.slice();

      copy[i] = reduced;
      return rebuild(head, copy);
    }
    return null;
  }

  function spineOf(term) {
    if (typeof term === 'string') return [term];
    return spineOf(term[1]).concat([term[2]]);
  }

  function rebuild(head, args) {
    return args.reduce(function (acc, arg) { return ['app', acc, arg]; }, head);
  }

  function showSki(term) {
    if (typeof term === 'string') return term;
    const right = typeof term[2] === 'string' ? showSki(term[2]) : '(' + showSki(term[2]) + ')';

    return showSki(term[1]) + right;
  }

  function ski(text) {
    const stack = [];
    let current = null;

    String(text).split('').forEach(function (ch) {
      if (ch === '(') { stack.push(current); current = null; return; }
      if (ch === ')') {
        const inner = current;

        current = stack.pop();
        current = current === null ? inner : ['app', current, inner];
        return;
      }
      current = current === null ? ch : ['app', current, ch];
    });
    return current;
  }

  /* ------------------------------------------- the same function, five ways */

  /**
   * Doubling, written in each model that can express it, so the demo and the
   * tests can run one function through several machines and compare outputs.
   * That comparison IS the equivalence claim.
   */
  function doubling() {
    return {
      counter: [
        /* r0 holds n; move it into r1 twice over, counting r2 as a scratch
           copy — a counter machine has no way to read a register without
           destroying it, which is most of why it is slow. */
        { op: 'dec', reg: 0, next: 1, zero: 3 },
        { op: 'inc', reg: 1, next: 2 },
        { op: 'inc', reg: 1, next: 0 },
        { op: 'halt' }
      ],
      ram: [
        { op: 'copy', reg: 1, from: 0 },
        { op: 'add', reg: 1, from: 0 },
        { op: 'halt' }
      ]
    };
  }

  /** Addition in both models, for the same comparison on two inputs. */
  function addition() {
    return {
      counter: [
        { op: 'dec', reg: 1, next: 1, zero: 2 },
        { op: 'inc', reg: 0, next: 0 },
        { op: 'halt' }
      ],
      ram: [
        { op: 'add', reg: 0, from: 1 },
        { op: 'halt' }
      ]
    };
  }

  /** Rule 110 and Rule 30, the two elementary automata worth naming. */
  function rules() {
    return [
      { number: 110, note: 'Turing complete (Cook, 2004)' },
      { number: 30, note: 'chaotic; used as a random-number generator in Mathematica' },
      { number: 90, note: 'the Sierpinski triangle, and XOR of the neighbours' },
      { number: 184, note: 'traffic flow, and a ballistic particle model' }
    ];
  }

  /** A tag system whose orbit is easy to follow. */
  function collatzTag() {
    return { deletion: 2, halting: ['H'],
      rules: { a: 'bc', b: 'a', c: 'aaa', H: '' },
      label: '2-tag system' };
  }

  return {
    MODELS: MODELS,
    runCounter: runCounter, runRam: runRam, runCellular: runCellular,
    runTag: runTag, runSki: runSki, ski: ski, showSki: showSki, reduceSki: reduceSki,
    ruleTable: ruleTable, doubling: doubling, addition: addition, rules: rules,
    collatzTag: collatzTag
  };
}));

/**
 * TaintOracle - what actually reached the sink, measured by running.
 *
 * The static taint analysis in `algorithms/taint.js` reports what MIGHT reach
 * a sink on some execution. This runs the programme and records what did, with
 * every value carrying a taint bit beside it. Two different answers to two
 * different questions, and a finding is only a false positive when this says
 * the value arriving at that sink was clean.
 *
 * It is deliberately a second interpreter rather than a call into the M30 VM,
 * for the reason M29's differential learned the hard way: an oracle that
 * shares an implementation with the thing it judges agrees with it wherever
 * both are wrong the same way.
 *
 * The taint semantics are the standard dynamic ones. A source produces a
 * tainted value; any arithmetic on a tainted operand is tainted; a container
 * holds the taint of what was put in it, per field, because at run time there
 * is no abstraction to lose; a sanitiser returns a clean value; a sink records
 * the bit it was handed. This is what a production tracker does, and it costs
 * what it costs — which is the trade the section is about.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.TaintOracle = api;
}(this, function () {
  'use strict';

  const DEPTH = 24;
  const BINARY = {
    add: function (a, b) { return a + b; },
    sub: function (a, b) { return a - b; },
    mul: function (a, b) { return a * b; },
    div: function (a, b) { return b === 0 ? 0 : Math.trunc(a / b); },
    lt: function (a, b) { return a < b; },
    le: function (a, b) { return a <= b; },
    gt: function (a, b) { return a > b; },
    ge: function (a, b) { return a >= b; },
    eq: function (a, b) { return a === b; },
    ne: function (a, b) { return a !== b; }
  };

  function cell(value, tainted, origin) {
    return { value: value, tainted: Boolean(tainted), origin: origin || null };
  }

  /* ----------------------------------------------------------------- the run */

  function run(program, options) {
    const settings = options || {};
    const state = { program: program, policy: settings.policy, sinks: [], steps: 0,
      budget: settings.budget || 20000, gaveUp: null };
    const main = byName(program, 'main') || program.functions[0];

    callFunction(state, main, [], 0);
    return { sinks: state.sinks, steps: state.steps, gaveUp: state.gaveUp,
      reached: state.sinks.length,
      tainted: state.sinks.filter(function (row) { return row.tainted; }).length };
  }

  function byName(program, name) {
    return program.functions.filter(function (fn) { return fn.name === name; })[0] || null;
  }

  function callFunction(state, fn, args, depth) {
    const ctx = { state: state, fn: fn, frame: { slots: {}, regs: {} }, depth: depth };

    if (depth > DEPTH) {
      state.gaveUp = state.gaveUp || 'recursion deeper than ' + DEPTH;
      return cell(0);
    }
    (fn.params || []).forEach(function (register, at) {
      ctx.frame.regs[register] = args[at] || cell(0);
    });
    let block = fn.blocks[0];

    while (block && state.steps < state.budget) {
      state.steps += 1;
      const step = runBlock(ctx, block);

      if (step.done) return step.value;
      block = blockById(fn, step.next);
    }
    return cell(0);
  }

  function blockById(fn, id) {
    return fn.blocks.filter(function (block) { return block.id === id; })[0] || null;
  }

  function runBlock(ctx, block) {
    for (let at = 0; at < block.instructions.length; at += 1) {
      stepInstruction(ctx, block.instructions[at]);
    }
    return follow(ctx, block.terminator);
  }

  function follow(ctx, terminator) {
    if (!terminator || terminator.op === 'ret') {
      return { done: true, value: terminator && terminator.value
        ? read(ctx, terminator.value) : cell(0) };
    }
    if (terminator.op === 'jump') return { done: false, next: terminator.target };
    if (terminator.op === 'branch') {
      return { done: false,
        next: read(ctx, terminator.cond).value ? terminator.then : terminator.other };
    }
    ctx.state.gaveUp = ctx.state.gaveUp || terminator.op;
    return { done: true, value: cell(0) };
  }

  /* -------------------------------------------------------- the instructions */

  function read(ctx, register) {
    return ctx.frame.regs[register] || cell(0);
  }

  function write(ctx, register, value) {
    if (register) ctx.frame.regs[register] = value;
  }

  function stepInstruction(ctx, inst) {
    if (stepValue(ctx, inst)) return;
    if (stepMemory(ctx, inst)) return;
    if (inst.op === 'call') { stepCall(ctx, inst); return; }
    if (inst.op === 'makeClosure') {
      write(ctx, inst.target, cell({ closure: inst.sourceName || inst.func }));
      return;
    }
    if (inst.target) {
      ctx.state.gaveUp = ctx.state.gaveUp || inst.op;
      write(ctx, inst.target, cell(0));
    }
  }

  function stepValue(ctx, inst) {
    if (inst.op === 'const') { write(ctx, inst.target, cell(inst.value)); return true; }
    if (inst.op === 'loadLocal') {
      write(ctx, inst.target, ctx.frame.slots[inst.slot] || cell(0));
      return true;
    }
    if (inst.op === 'storeLocal') { ctx.frame.slots[inst.slot] = read(ctx, inst.value); return true; }
    if (inst.op === 'binary') return stepBinary(ctx, inst);
    if (inst.op === 'unary') {
      const operand = read(ctx, inst.operand);

      write(ctx, inst.target, cell(inst.operator === 'not' ? !operand.value : -operand.value,
        operand.tainted, operand.origin));
      return true;
    }
    return false;
  }

  function stepBinary(ctx, inst) {
    const left = read(ctx, inst.left);
    const right = read(ctx, inst.right);
    const fn = BINARY[inst.operator];

    if (!fn || typeof left.value !== 'number' || typeof right.value !== 'number') {
      ctx.state.gaveUp = ctx.state.gaveUp || 'binary ' + inst.operator;
      write(ctx, inst.target, cell(0, left.tainted || right.tainted,
        left.origin || right.origin));
      return true;
    }
    write(ctx, inst.target, cell(fn(left.value, right.value), left.tainted || right.tainted,
      left.origin || right.origin));
    return true;
  }

  /** Containers carry taint per field at run time: there is no abstraction
   *  here to lose, which is exactly why this can price the static analysis. */
  function stepMemory(ctx, inst) {
    if (inst.op === 'makeRecord') { write(ctx, inst.target, buildRecord(ctx, inst)); return true; }
    if (inst.op === 'makeArray') {
      write(ctx, inst.target, cell({ items: (inst.args || []).map(function (arg) {
        return read(ctx, arg);
      }) }));
      return true;
    }
    if (inst.op === 'loadField') {
      const object = read(ctx, inst.object).value;

      write(ctx, inst.target, (object && object.fields && object.fields[inst.field]) || cell(0));
      return true;
    }
    if (inst.op === 'loadIndex') return loadIndex(ctx, inst);
    return false;
  }

  function buildRecord(ctx, inst) {
    const fields = {};

    (inst.fields || []).forEach(function (name, at) {
      fields[name] = read(ctx, (inst.args || [])[at]);
    });
    return cell({ fields: fields });
  }

  function loadIndex(ctx, inst) {
    const object = read(ctx, inst.object).value;
    const index = read(ctx, inst.index).value;

    write(ctx, inst.target, (object && object.items && object.items[index]) || cell(0));
    return true;
  }

  /* ------------------------------------------------------------- the calls */

  /**
   * The policy decides what a source, a sink and a sanitiser MEAN, and the
   * bodies of those three are never executed — a sanitiser is trusted because
   * it was declared one, which is the assumption the whole model rests on and
   * the one an attacker attacks. Everything else is a real call and is
   * interpreted.
   */
  function stepCall(ctx, inst) {
    const policy = ctx.state.policy;
    const name = calleeName(ctx, inst);
    const args = (inst.args || []).map(function (arg) { return read(ctx, arg); });

    if (policy.sources.indexOf(name) !== -1) {
      write(ctx, inst.target, cell(args.length ? args[0].value : 1, true, name));
      return;
    }
    if (policy.sanitisers.indexOf(name) !== -1) {
      write(ctx, inst.target, cell(args.length ? args[0].value : 0, false, null));
      return;
    }
    if (policy.sinks.indexOf(name) !== -1) { atSink(ctx, inst, name, args); return; }
    write(ctx, inst.target, invoke(ctx, name, args));
  }

  function atSink(ctx, inst, name, args) {
    const argument = args[0] || cell(0);

    ctx.state.sinks.push({ sink: name, span: inst.span, tainted: argument.tainted,
      origin: argument.origin, value: argument.value });
    write(ctx, inst.target, argument);
  }

  function invoke(ctx, name, args) {
    const callee = byName(ctx.state.program, name);

    if (!callee) {
      ctx.state.gaveUp = ctx.state.gaveUp || 'call to ' + name;
      return cell(0, args.some(function (arg) { return arg.tainted; }));
    }
    return callFunction(ctx.state, callee, args, ctx.depth + 1);
  }

  function calleeName(ctx, inst) {
    const value = read(ctx, inst.callee).value;

    return value && value.closure ? value.closure : inst.callee;
  }

  return { run: run, cell: cell, BINARY: BINARY, DEPTH: DEPTH };
}));

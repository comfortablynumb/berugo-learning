/**
 * The JIT: tiering, profiling, speculation, on-stack replacement and
 * deoptimisation, over the same frames the VM uses.
 *
 * "Compiled" here means **closure compilation**: each bytecode instruction is
 * decoded once into a JavaScript closure, and running the function is then
 * calling those closures in order rather than switching on an opcode every
 * time. That is a real technique — it is how several production interpreters
 * get their baseline tier — and it is measurable, which matters more here
 * than emitting machine code nobody in a browser could run.
 *
 * The three things that make this a JIT rather than a faster interpreter are
 * all about **speculation**:
 *
 * - a profile records what each instruction actually saw;
 * - the optimising tier emits a fast path guarded by what the profile
 *   promised — `add` on two numbers is a `+`, not a dispatch through the
 *   arithmetic table;
 * - a guard that fails **deoptimises**: control returns to the interpreter at
 *   the same instruction, with the same frame, and the program continues.
 *
 * The invariant that makes deoptimisation safe is that **a guard is checked
 * before the instruction has changed anything**. Break it and a deopt resumes
 * an instruction that has already half-run, which is a miscompilation that
 * only appears on the rare input that fails the guard.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) {
    scope.Berugo = scope.Berugo || {};
    scope.Berugo.Jit = api;
  }
}(this, function (root) {
  'use strict';

  const berugo = root && root.Berugo ? root.Berugo : null;
  const Interp = berugo && berugo.Interp ? berugo.Interp : require('./interp.js');
  const Vm = berugo && berugo.Vm ? berugo.Vm : require('./vm.js');

  const TIERS = [
    { id: 0, name: 'interpreter', about: 'switch dispatch, no compilation cost' },
    { id: 1, name: 'baseline', about: 'one closure per instruction, decoded once' },
    { id: 2, name: 'optimising', about: 'guarded fast paths from the profile' }
  ];

  const DEFAULTS = { baselineAt: 20, optimiseAt: 200, osrAt: 60, budget: 400000 };

  function Deopt(pc, why) {
    this.pc = pc;
    this.why = why;
  }

  /* -------------------------------------------------------------- profiling */

  function kindOf(value) {
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'bool';
    if (typeof value === 'string') return 'string';
    if (!value || typeof value !== 'object') return 'other';
    return value.v || 'other';
  }

  /**
   * One record per instruction, holding the set of operand kinds it has seen.
   * A site that has only ever seen one kind is monomorphic and can be
   * speculated on; one that has seen several cannot, and the count is what
   *30.8 turns into an inline-cache state.
   */
  function profileFor(state, chunkName, pc) {
    const key = chunkName + ':' + pc;

    if (!state.profile[key]) state.profile[key] = { key: key, kinds: new Set(), samples: 0 };
    return state.profile[key];
  }

  function observe(state, chunkName, pc, values) {
    const record = profileFor(state, chunkName, pc);

    record.samples += 1;
    values.forEach(function (value) { record.kinds.add(kindOf(value)); });
    return record;
  }

  function monomorphic(record) {
    return Boolean(record) && record.kinds.size === 1;
  }

  /* ------------------------------------------------------------- compilation */

  /**
   * Decode once into closures. Everything that is not speculated on falls
   * back to the VM's own rule for that opcode, so the baseline tier is
   * exactly the interpreter minus the dispatch — which is the honest thing
   * for it to be, and it means a baseline bug is a dispatch bug rather than a
   * second implementation of every instruction.
   */
  function compile(chunk, options) {
    const settings = options || {};
    const rules = Object.assign({}, Vm.STACK_EXEC, Vm.REGISTER_EXEC);
    const guards = [];
    const ops = chunk.code.map(function (inst, pc) {
      const fast = settings.tier === 2 ? speculate(chunk, inst, pc, settings, guards) : null;

      if (fast) return fast;
      const rule = rules[inst.op];

      return function (state, frame) { rule(state, frame, inst); };
    });

    return { chunk: chunk, ops: ops, tier: settings.tier || 1, guards: guards,
      specialised: guards.length, instructions: ops.length };
  }

  /**
   * The only speculated instruction is arithmetic on two numbers, and that is
   * deliberate: it is where a dynamic language spends its dispatch, and one
   * specialisation is enough to make the mechanism — profile, guard, fast
   * path, deopt — concrete without a table of a dozen special cases that all
   * demonstrate the same thing.
   */
  const FAST = {
    add: function (a, b) { return a + b; },
    sub: function (a, b) { return a - b; },
    mul: function (a, b) { return a * b; },
    lt: function (a, b) { return a < b; },
    le: function (a, b) { return a <= b; },
    gt: function (a, b) { return a > b; },
    ge: function (a, b) { return a >= b; }
  };

  function speculate(chunk, inst, pc, settings, guards) {
    const record = (settings.profile || {})[chunk.name + ':' + pc];

    if (!monomorphic(record) || !record.kinds.has('number')) return null;
    const operator = chunk.constants[inst.k];
    const fast = FAST[operator];

    if (!fast) return null;
    if (inst.op === 'BINARY') return stackFast(pc, fast, guards, operator);
    if (inst.op === 'BINARY_R') return registerFast(inst, pc, fast, guards, operator);
    return null;
  }

  /** The guard runs before the pops, so a deopt resumes an untouched frame. */
  function stackFast(pc, fast, guards, operator) {
    guards.push({ pc: pc, why: 'both operands are numbers', operator: operator });
    return function (state, frame) {
      const top = frame.stack.length;
      const left = frame.stack[top - 2];
      const right = frame.stack[top - 1];

      if (typeof left !== 'number' || typeof right !== 'number') {
        throw new Deopt(pc, 'the guard on ' + operator + ' failed');
      }
      frame.stack.length = top - 2;
      frame.stack.push(fast(left, right));
    };
  }

  function registerFast(inst, pc, fast, guards, operator) {
    guards.push({ pc: pc, why: 'both operands are numbers', operator: operator });
    return function (state, frame) {
      const left = frame.registers[inst.a];
      const right = frame.registers[inst.b];

      if (typeof left !== 'number' || typeof right !== 'number') {
        throw new Deopt(pc, 'the guard on ' + operator + ' failed');
      }
      frame.registers[inst.d] = fast(left, right);
    };
  }

  /* ------------------------------------------------------------ the tiering */

  function makeState(compiled, options) {
    const settings = options || {};
    const base = Vm.makeState(compiled, { budget: settings.budget || DEFAULTS.budget });

    return Object.assign(base, {
      counters: {}, loopCounters: {}, tiers: {}, code: {}, profile: {},
      timeline: [], deopts: [], compiles: 0, fastPaths: 0, osr: 0,
      thresholds: Object.assign({}, DEFAULTS, settings.thresholds || {}),
      speculate: settings.speculate !== false });
  }

  function tierOf(state, name) {
    return state.tiers[name] === undefined ? 0 : state.tiers[name];
  }

  function note(state, name, tier, why) {
    state.tiers[name] = tier;
    state.timeline.push({ fn: name, tier: tier, at: state.dispatches, why: why,
      name: TIERS[tier].name });
  }

  /**
   * A function is compiled when its entry counter crosses a threshold, and
   * recompiled at the optimising tier when it crosses the second. The
   * profile that the second one speculates on is whatever the first two tiers
   * recorded — which is why warm-up is a real phase and not an artefact of
   * measurement: the optimising tier cannot exist until something has been
   * observed.
   */
  function onEnter(state, frame) {
    const name = frame.chunk.name;

    state.counters[name] = (state.counters[name] || 0) + 1;
    const count = state.counters[name];
    const tier = tierOf(state, name);

    if (tier === 0 && count >= state.thresholds.baselineAt) install(state, frame.chunk, 1);
    else if (tier === 1 && state.speculate && count >= state.thresholds.optimiseAt) {
      install(state, frame.chunk, 2);
    }
  }

  function install(state, chunk, tier) {
    state.code[chunk.name] = compile(chunk, { tier: tier, profile: state.profile });
    state.compiles += 1;
    state.fastPaths += state.code[chunk.name].specialised;
    note(state, chunk.name, tier, tier === 1 ? 'entry counter crossed'
      : 'hot, and the profile is monomorphic');
  }

  /**
   * On-stack replacement: a loop whose back edge is hot has to be moved into
   * compiled code WITHOUT waiting for the function to be re-entered, because
   * a program spending all its time in one loop never re-enters anything.
   * The transfer is the whole of the mechanism here — the compiled code runs
   * on the same frame, so the live values move because they never moved.
   */
  function onBackEdge(state, frame) {
    const name = frame.chunk.name;
    const count = (state.loopCounters[name] || 0) + 1;
    const tier = tierOf(state, name);

    state.loopCounters[name] = count;
    if (tier === 0 && count >= state.thresholds.osrAt) { transfer(state, frame, 1); return; }
    if (tier === 1 && state.speculate && count >= state.thresholds.optimiseAt
      && !blacklisted(state, name)) {
      transfer(state, frame, 2);
    }
  }

  function transfer(state, frame, tier) {
    install(state, frame.chunk, tier);
    state.osr += 1;
    state.timeline.push({ fn: frame.chunk.name, tier: tier, at: state.dispatches,
      why: 'OSR at a back edge', name: TIERS[tier].name + ' (OSR)' });
  }

  /**
   * Two deoptimisations from the same function and it stops being speculated
   * on. Without that, a program whose types really are polymorphic recompiles
   * and deoptimises on every pass through the loop, which costs more than the
   * interpreter it was trying to beat — and the symptom is a program that
   * gets slower the longer it runs. Every production engine has this rule.
   */
  function blacklisted(state, name) {
    return state.deopts.filter(function (row) { return row.fn === name; }).length >= 2;
  }

  /* --------------------------------------------------------------- running */

  function stepOnce(state) {
    const frame = state.frames[state.frames.length - 1];
    const inst = frame.chunk.code[frame.pc];
    const compiled = state.code[frame.chunk.name];

    if (!inst) throw new Error('ran off the end of ' + frame.chunk.name);
    record(state, frame, inst);
    if (!compiled) { Vm.step(state); return; }
    runCompiled(state, frame, inst, compiled);
  }

  function record(state, frame, inst) {
    if (inst.op === 'BINARY') {
      observe(state, frame.chunk.name, frame.pc,
        frame.stack.slice(frame.stack.length - 2));
    }
    if (inst.op === 'BINARY_R') {
      observe(state, frame.chunk.name, frame.pc,
        [frame.registers[inst.a], frame.registers[inst.b]]);
    }
    if (isBackEdge(frame, inst)) onBackEdge(state, frame);
  }

  function isBackEdge(frame, inst) {
    return (inst.op === 'JUMP' || inst.op === 'JUMP_R') && inst.target <= frame.pc;
  }

  function runCompiled(state, frame, inst, compiled) {
    const before = frame.pc;

    frame.pc += 1;
    state.dispatches += 1;
    state.compiledDispatches = (state.compiledDispatches || 0) + 1;
    if (state.dispatches > state.budget) throw new Error('step budget exhausted');
    try {
      compiled.ops[before](state, frame);
    } catch (problem) {
      if (!(problem instanceof Deopt)) throw problem;
      deoptimise(state, frame, problem, before);
    }
  }

  /**
   * Back to the interpreter, at the same instruction, on the same frame. The
   * program counter is rewound because the guard fired before anything
   * happened — and the function drops a tier so the same guard does not fire
   * on every iteration from here on.
   */
  function deoptimise(state, frame, problem, pc) {
    frame.pc = pc;
    delete state.code[frame.chunk.name];
    state.deopts.push({ fn: frame.chunk.name, pc: pc, why: problem.why,
      at: state.dispatches });
    note(state, frame.chunk.name, 0, problem.why);
    Vm.step(state);
  }

  function run(compiled, options) {
    const state = makeState(compiled, options);
    const chunk = state.chunks[state.main];

    if (!chunk) return Vm.observable(state, null, new Error('no main function'));
    const mainFrame = Vm.startFrame(state, chunk, [], []);

    return drive(state, mainFrame);
  }

  function drive(state, mainFrame) {
    const seen = new Set();

    try {
      while (!state.done) {
        const frame = state.frames[state.frames.length - 1];

        if (!seen.has(frame)) { seen.add(frame); onEnter(state, frame); }
        stepOnce(state);
      }
      return report(state, Vm.observable(state, mainFrame, null));
    } catch (problem) {
      return report(state, Vm.observable(state, mainFrame, problem));
    }
  }

  function report(state, observable) {
    return Object.assign(observable, {
      tiers: state.tiers, timeline: state.timeline, deopts: state.deopts,
      compiles: state.compiles, fastPaths: state.fastPaths, osr: state.osr,
      compiledDispatches: state.compiledDispatches || 0,
      profile: profileRows(state) });
  }

  function profileRows(state) {
    return Object.keys(state.profile).map(function (key) {
      const row = state.profile[key];

      return { site: key, samples: row.samples, kinds: Array.from(row.kinds).sort(),
        state: row.kinds.size === 1 ? 'monomorphic'
          : (row.kinds.size <= 4 ? 'polymorphic' : 'megamorphic') };
    }).sort(function (a, b) { return b.samples - a.samples; });
  }

  /* ------------------------------------------------------------- comparing */

  /**
   * The acceptance criterion for this section, run rather than asserted: a
   * program whose types change halfway must deoptimise and must still compute
   * what a never-compiled run computed. Reporting the deopt count beside the
   * agreement is what stops the check passing because nothing was ever
   * speculated on.
   */
  function differential(compiled, options) {
    const settings = options || {};
    const plain = Vm.run(compiled, { budget: settings.budget || DEFAULTS.budget });
    const jitted = run(compiled, settings);

    return { agree: same(plain, jitted), plain: plain, jit: jitted,
      deopts: jitted.deopts.length, compiles: jitted.compiles,
      fastPaths: jitted.fastPaths, osr: jitted.osr,
      why: same(plain, jitted) ? '' : difference(plain, jitted) };
  }

  function same(left, right) {
    return difference(left, right) === '';
  }

  function difference(left, right) {
    if (left.outcome !== right.outcome) return 'outcome ' + left.outcome + ' against ' + right.outcome;
    if (left.value !== right.value) return 'value ' + left.value + ' against ' + right.value;
    if (left.output.join(' ') !== right.output.join(' ')) return 'different output';
    if (left.bindings.join(' ') !== right.bindings.join(' ')) return 'different bindings';
    return '';
  }

  /** Tier transitions against the threshold, which is the warm-up curve. */
  function thresholdSweep(compiled, values) {
    return values.map(function (value) {
      const out = run(compiled, { thresholds: { baselineAt: value, optimiseAt: value * 4,
        osrAt: value * 3 } });

      return { threshold: value, compiles: out.compiles, deopts: out.deopts.length,
        osr: out.osr, dispatches: out.dispatches,
        compiled: out.compiledDispatches,
        share: out.dispatches ? out.compiledDispatches / out.dispatches : 0 };
    });
  }

  return {
    TIERS: TIERS, DEFAULTS: DEFAULTS, Deopt: Deopt,
    kindOf: kindOf, monomorphic: monomorphic, compile: compile,
    run: run, differential: differential, thresholdSweep: thresholdSweep,
    makeState: makeState, profileRows: profileRows
  };
}));

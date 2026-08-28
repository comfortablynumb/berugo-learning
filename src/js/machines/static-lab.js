/**
 * StaticLab - the harness every static analyser in M32 is judged by, and the
 * oracle that judges it.
 *
 * Named for what it does rather than for the milestone, because
 * `analysis-lab.js` is M18's and this project has already lost one section to
 * reusing a name without checking.
 *
 * A static analyser makes a claim about every execution, and there is exactly
 * one honest way to check it without a proof: run the program and see whether
 * anything it observed falls outside what the analyser said was possible. That
 * is what `observe` produces — a record of the concrete value of every local
 * at every program point — and what `soundness` checks against.
 *
 * The check is one-sided and that is the point. A dynamic oracle sees ONE run,
 * so it can prove an analyser unsound and can never prove one sound. Reporting
 * it the other way round — "no violations, therefore correct" — is the mistake
 * this file exists to make impossible: `soundness` reports `violations` and
 * `observations`, and a run with zero observations proves nothing at all.
 *
 * The concrete evaluator here is deliberately a SECOND implementation rather
 * than a call into M30's interpreter. A shared evaluator would agree with the
 * analyser wherever both are wrong the same way, which is the failure mode M29
 * documented when its differential shared one interpreter.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.StaticLab = api;
}(this, function (root) {
  'use strict';

  const IrLower = pick('IrLower', './berugo/ir-lower.js');
  const Cfg = pick('Cfg', './berugo/cfg.js');
  const Abstract = root && root.AbstractInterp
    ? root.AbstractInterp : require('../algorithms/abstract-interp.js');

  function pick(name, file) {
    if (root && root.Berugo && root.Berugo[name]) return root.Berugo[name];
    return require(file);
  }

  function compile(source) {
    const lowered = IrLower.compile(source);

    return { program: lowered.program, fn: lowered.program.functions[0],
      source: source, lowered: lowered };
  }

  /* ------------------------------------------------------- the concrete run */

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

  /**
   * A small evaluator over the same IR, recording the value of every local at
   * the entry of every block it reaches. It handles the arithmetic and control
   * flow the analysers reason about and gives up on anything else, which is
   * reported rather than hidden: an oracle that silently skipped the
   * interesting instruction would agree with everything.
   */
  function observe(fn, options) {
    const settings = options || {};
    const blocks = {};
    const run = { slots: Object.assign({}, settings.inputs || {}), regs: {},
      steps: 0, budget: settings.budget || 20000, observations: [],
      gaveUp: null };

    /* Parameters arrive in registers and are moved into slots by the first
       instructions of the entry block, so an input for a parameter has to be
       seeded there rather than in the slot it will end up in. */
    (fn.params || []).forEach(function (register, at) {
      const name = (settings.names || [])[at] || ('p' + at);

      if (settings.params && settings.params[name] !== undefined) {
        run.regs[register] = settings.params[name];
      }
    });
    fn.blocks.forEach(function (block) { blocks[block.id] = block; });
    let current = fn.blocks[0];

    while (current && run.steps < run.budget) {
      run.steps += 1;
      record(run, current.id);
      const next = runBlock(run, current);

      if (next === null) break;
      current = blocks[next];
    }
    return finishRun(run, fn);
  }

  function record(run, blockId) {
    run.observations.push({ block: blockId, slots: Object.assign({}, run.slots) });
  }

  function runBlock(run, block) {
    for (let at = 0; at < block.instructions.length; at += 1) {
      if (!stepInstruction(run, block.instructions[at])) return null;
    }
    return follow(run, block.terminator);
  }

  function stepInstruction(run, inst) {
    if (inst.op === 'const') { run.regs[inst.target] = inst.value; return true; }
    if (inst.op === 'loadLocal') { run.regs[inst.target] = run.slots[inst.slot]; return true; }
    if (inst.op === 'storeLocal') { run.slots[inst.slot] = run.regs[inst.value]; return true; }
    if (inst.op === 'binary') return stepBinary(run, inst);
    if (!inst.target) return true;
    run.gaveUp = run.gaveUp || inst.op;
    run.regs[inst.target] = undefined;
    return true;
  }

  function stepBinary(run, inst) {
    const fn = BINARY[inst.operator];

    if (!fn) { run.gaveUp = run.gaveUp || ('binary ' + inst.operator); return true; }
    const left = run.regs[inst.left];
    const right = run.regs[inst.right];

    if (typeof left !== 'number' || typeof right !== 'number') {
      run.gaveUp = run.gaveUp || 'a non-numeric operand';
      run.regs[inst.target] = undefined;
      return true;
    }
    run.regs[inst.target] = fn(left, right);
    return true;
  }

  function follow(run, terminator) {
    if (!terminator || terminator.op === 'ret') return null;
    if (terminator.op === 'jump') return terminator.target;
    if (terminator.op !== 'branch') { run.gaveUp = run.gaveUp || terminator.op; return null; }
    return run.regs[terminator.cond] ? terminator.then : terminator.other;
  }

  function finishRun(run, fn) {
    return { observations: run.observations, steps: run.steps,
      exhausted: run.steps >= run.budget, gaveUp: run.gaveUp,
      slots: run.slots, blocks: fn.blocks.length };
  }

  /* ------------------------------------------------------- the fixpoint */

  /**
   * The analysis itself: a worklist over the CFG in two passes. The first
   * WIDENS at every loop header, which terminates; the second NARROWS from the
   * result, which recovers what widening threw away wherever the branch
   * conditions constrain it. Reporting them as separate passes with separate
   * counters is the whole demonstration — one number would hide which operator
   * did what.
   */
  function analyse(fn, options) {
    const settings = options || {};
    const domain = Abstract.domainFor(settings.domain || 'interval');
    const graph = Cfg.build(fn);
    const headers = loopHeaders(fn, graph);
    const state = { entry: {}, exit: {}, rounds: [], widenings: 0, narrowings: 0,
      terminators: {} };

    fn.blocks.forEach(function (block) { state.terminators[block.id] = block.terminator; });
    state.entry[fn.blocks[0].id] = Abstract.emptyState();
    runPass(fn, graph, domain, headers, state, 'widen');
    if (settings.narrow !== false) runPass(fn, graph, domain, headers, state, 'narrow');
    return report(fn, domain, state, headers);
  }

  function loopHeaders(fn, graph) {
    const set = {};

    Cfg.backEdges(graph).forEach(function (edge) { set[edge.to] = true; });
    return set;
  }

  function runPass(fn, graph, domain, headers, state, mode) {
    const blocks = {};
    let changed = true;
    let round = 0;

    fn.blocks.forEach(function (block) { blocks[block.id] = block; });
    while (changed && round < 200) {
      changed = false;
      round += 1;
      fn.blocks.forEach(function (block) {
        if (visitBlock(graph, domain, headers, state, block, mode)) changed = true;
      });
      state.rounds.push({ pass: mode, round: round, changed: changed });
    }
  }

  function visitBlock(graph, domain, headers, state, block, mode) {
    const incoming = incomingState(graph, domain, state, block);

    if (!incoming) return false;
    const merged = mergeInto(domain, state.entry[block.id], incoming, headers[block.id], mode);

    if (Abstract.sameState(domain, state.entry[block.id], merged)) {
      if (state.exit[block.id]) return false;
    }
    if (headers[block.id]) countOperator(state, mode);
    state.entry[block.id] = merged;
    state.exit[block.id] = runTransfer(domain, merged, block);
    return true;
  }

  function countOperator(state, mode) {
    if (mode === 'widen') state.widenings += 1;
    else state.narrowings += 1;
  }

  /**
   * Widening is applied ONLY at loop headers. Applying it everywhere also
   * terminates and destroys precision at every merge, including the ones that
   * are not part of any cycle — which is a common way to make an interval
   * analysis useless while believing it is standard.
   */
  function mergeInto(domain, previous, incoming, isHeader, mode) {
    if (!previous) return incoming;
    /* The narrowing pass is a DESCENDING iteration: outside a loop header it
       replaces the block's state with the recomputed one rather than joining.
       Joining looks symmetrical with the ascending pass and undoes the whole
       point — the block after the loop kept [10, +∞] because it was joined
       with the value widening had already produced. */
    if (mode === 'narrow') {
      return isHeader ? Abstract.combineStates(domain, previous, incoming, 'narrow')
        : incoming;
    }
    if (!isHeader) return Abstract.joinStates(domain, previous, incoming);
    return Abstract.combineStates(domain, previous, incoming, 'widen');
  }

  function incomingState(graph, domain, state, block) {
    const preds = graph.preds[block.id] || [];

    if (!preds.length) return state.entry[block.id] || Abstract.emptyState();
    let merged = null;

    preds.forEach(function (from) {
      const edge = edgeState(domain, state, from, block.id);

      if (edge) merged = Abstract.joinStates(domain, merged, edge);
    });
    return merged;
  }

  function edgeState(domain, state, from, to) {
    const exit = state.exit[from];

    if (!exit) return null;
    const terminator = state.terminators[from];

    if (!terminator || terminator.op !== 'branch') return exit;
    return Abstract.refine(domain, exit, exit.compares[terminator.cond],
      terminator.then === to);
  }

  function runTransfer(domain, entry, block) {
    const state = Abstract.recordLoads(Abstract.cloneState(entry), block);

    block.instructions.forEach(function (inst) { Abstract.transfer(domain, state, inst); });
    return state;
  }

  function report(fn, domain, state, headers) {
    return { domain: domain.name, about: domain.about,
      rounds: state.rounds, widenings: state.widenings, narrowings: state.narrowings,
      headers: Object.keys(headers),
      blocks: fn.blocks.map(function (block) {
        return { id: block.id, header: Boolean(headers[block.id]),
          entry: showState(domain, state.entry[block.id]),
          exit: showState(domain, state.exit[block.id]) };
      }),
      entry: state.entry, exit: state.exit };
  }

  function showState(domain, value) {
    if (!value) return {};
    const rows = {};

    Object.keys(value.slots).sort().forEach(function (slot) {
      rows[slot] = domain.show(value.slots[slot]);
    });
    return rows;
  }

  /* ------------------------------------------------------- the soundness check */

  /**
   * Every observed value against the analyser's claim at that point. A
   * violation is a value the analyser said could not happen, which is
   * unsoundness and is a bug; the absence of violations is not soundness, and
   * the report says how many observations it is based on so that nobody can
   * read it as one.
   */
  function soundness(analysis, run, domain) {
    const chosen = domain || Abstract.domainFor(analysis.domain);
    const violations = [];
    let checked = 0;

    run.observations.forEach(function (row) {
      const entry = analysis.entry[row.block];

      if (!entry) return;
      Object.keys(row.slots).forEach(function (slot) {
        const value = row.slots[slot];

        if (typeof value !== 'number') return;
        checked += 1;
        const claim = Abstract.readSlot(chosen, entry, slot);

        if (chosen.contains(claim, value)) return;
        violations.push({ block: row.block, slot: slot, value: value,
          claim: chosen.show(claim) });
      });
    });
    return { violations: violations, observations: checked,
      sound: violations.length === 0,
      why: checked === 0 ? 'no observations, so this proves nothing'
        : checked + ' observed values, ' + violations.length + ' outside the claim' };
  }

  /**
   * Run each generated input and check it reaches the path it was generated
   * for. This is the acceptance criterion for symbolic execution and it is the
   * only thing that distinguishes a solver answer from a claim: the input is
   * executed, the blocks it visits are recorded, and the path's block list has
   * to be a prefix-consistent subset of them.
   */
  function verifyPaths(fn, paths, options) {
    const settings = options || {};
    const rows = paths.filter(function (path) { return path.verdict === 'sat'; })
      .map(function (path) { return verifyOne(fn, path, settings); });

    return { rows: rows, checked: rows.length,
      reached: rows.filter(function (row) { return row.reached; }).length,
      missed: rows.filter(function (row) { return !row.reached; }) };
  }

  function verifyOne(fn, path, settings) {
    const run = observe(fn, { params: path.model, names: settings.names || [] });
    const visited = run.observations.map(function (row) { return row.block; });
    const reached = path.blocks.every(function (id) {
      return visited.indexOf(id) !== -1;
    });

    return { model: path.model, wanted: path.blocks, visited: visited,
      reached: reached, condition: path.condition };
  }

  /**
   * Precision, measured as the gap between what the analyser said was possible
   * and what actually happened. A sound analyser's claim always contains the
   * observed values; the interesting number is how much MORE it contains,
   * because that is where the false positives come from.
   *
   * The two numbers are kept apart deliberately. Soundness is a property
   * ("nothing observed fell outside") and precision is a quantity ("the claim
   * was this much wider"), and a tool that reported one number for both would
   * let a useless analyser — everything is possible — look perfectly correct.
   */
  function precision(analysis, run, domain) {
    const chosen = domain || Abstract.domainFor(analysis.domain);
    const observed = {};

    run.observations.forEach(function (row) {
      Object.keys(row.slots).forEach(function (slot) {
        const value = row.slots[slot];

        if (typeof value !== 'number') return;
        const key = row.block + '/' + slot;

        observed[key] = observed[key] || { block: row.block, slot: slot,
          lo: value, hi: value, count: 0, values: {} };
        observed[key].lo = Math.min(observed[key].lo, value);
        observed[key].hi = Math.max(observed[key].hi, value);
        observed[key].values[value] = true;
        observed[key].count += 1;
      });
    });
    return summarise(analysis, chosen, observed);
  }

  function summarise(analysis, domain, observed) {
    const rows = Object.keys(observed).sort().map(function (key) {
      const row = observed[key];
      const claim = Abstract.readSlot(domain, analysis.entry[row.block] || {}, row.slot);

      return { block: row.block, slot: row.slot, claim: domain.show(claim),
        observedLo: row.lo, observedHi: row.hi,
        distinct: Object.keys(row.values).length,
        width: widthOf(domain, claim),
        observedWidth: row.hi - row.lo + 1,
        contains: domain.contains(claim, row.lo) && domain.contains(claim, row.hi) };
    });

    return { rows: rows,
      exact: rows.filter(function (row) {
        return row.width === row.observedWidth;
      }).length,
      unbounded: rows.filter(function (row) { return row.width === Infinity; }).length,
      unsound: rows.filter(function (row) { return !row.contains; }).length,
      total: rows.length };
  }

  /** An interval has a width; a sign or a parity has a size in the domain. */
  function widthOf(domain, claim) {
    if (domain.name !== 'interval') {
      return claim === domain.top() ? Infinity : 1;
    }
    if (claim === null) return 0;
    return claim.hi - claim.lo + 1;
  }

  return { compile: compile, observe: observe, analyse: analyse,
    soundness: soundness, precision: precision, loopHeaders: loopHeaders,
    BINARY: BINARY, verifyPaths: verifyPaths, widthOf: widthOf };
}));

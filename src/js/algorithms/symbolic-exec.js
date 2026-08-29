/**
 * Symbolic execution over Berugo IR, and the property that makes it different
 * from fuzzing.
 *
 * Run the program with symbols instead of values. A register holds an
 * expression rather than a number, a branch cannot be decided, and so the
 * execution FORKS: one path where the condition holds and one where it does
 * not, each carrying the accumulated PATH CONDITION that got it there. At a
 * leaf, solving that condition produces a concrete input which is guaranteed
 * to follow exactly this path — a test case with a proof of reachability
 * attached, which is qualitatively different from a fuzzer's "this input
 * happened to reach it".
 *
 * The cost is path explosion, and it is not a detail. A loop with a symbolic
 * bound has one path per iteration count, so the tree is unbounded and every
 * real tool bounds it somewhere: a depth limit, a fork limit, merging, or
 * summarising a function once instead of inlining it per path. This
 * implementation bounds depth and forks and REPORTS both, because a tool that
 * silently truncated its own search would report perfect coverage of the
 * paths it happened to look at.
 *
 * Values are affine: a constant plus a weighted sum of symbols. That covers
 * the arithmetic the language does on integers, and it is a stated fragment
 * rather than a hidden one — a multiplication of two symbols leaves the affine
 * world and the executor marks the value opaque instead of pretending.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SymbolicExec = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  /**
   * The linear theory solver from 32.6, resolved at CALL time rather than at
   * load time. index.html loads this file before the solver package, and a
   * module that reads a global the script order has not defined yet does not
   * fail loudly - it captures `undefined` and the feature is quietly missing.
   */
  function linearTheory() {
    if (scope && scope.Berugo && scope.Berugo.TheoryLinear) return scope.Berugo.TheoryLinear;
    if (typeof require === 'function') return require('../machines/solver/theories/linear.js');
    return null;
  }

  const OPPOSITE = { lt: 'ge', le: 'gt', gt: 'le', ge: 'lt', eq: 'ne', ne: 'eq' };

  /* ------------------------------------------------------- affine values */

  function constant(value) {
    return { constant: value, terms: {}, opaque: false };
  }

  function symbol(name) {
    const terms = {};

    terms[name] = 1;
    return { constant: 0, terms: terms, opaque: false };
  }

  function opaque() {
    return { constant: 0, terms: {}, opaque: true };
  }

  function combine(a, b, sign) {
    if (!a || !b || a.opaque || b.opaque) return opaque();
    const terms = Object.assign({}, a.terms);

    Object.keys(b.terms).forEach(function (name) {
      terms[name] = (terms[name] || 0) + sign * b.terms[name];
      if (terms[name] === 0) delete terms[name];
    });
    return { constant: a.constant + sign * b.constant, terms: terms, opaque: false };
  }

  /** Multiplication stays affine only when one side is a constant. */
  function multiply(a, b) {
    if (!a || !b || a.opaque || b.opaque) return opaque();
    if (!Object.keys(a.terms).length) return scale(b, a.constant);
    if (!Object.keys(b.terms).length) return scale(a, b.constant);
    return opaque();
  }

  function scale(value, factor) {
    const terms = {};

    Object.keys(value.terms).forEach(function (name) {
      if (value.terms[name] * factor !== 0) terms[name] = value.terms[name] * factor;
    });
    return { constant: value.constant * factor, terms: terms, opaque: false };
  }

  function show(value) {
    if (!value) return '?';
    if (value.opaque) return 'opaque';
    const parts = Object.keys(value.terms).sort().map(function (name) {
      const coefficient = value.terms[name];

      return (coefficient === 1 ? '' : (coefficient === -1 ? '-' : coefficient + '·')) + name;
    });

    if (value.constant !== 0 || !parts.length) parts.push(String(value.constant));
    return parts.join(' + ').replace(/\+ -/g, '- ');
  }

  function variablesOf(constraints) {
    const seen = {};

    constraints.forEach(function (row) {
      Object.keys(row.value.terms).forEach(function (name) { seen[name] = true; });
    });
    return Object.keys(seen).sort();
  }

  /* -------------------------------------------------- the path condition */

  /**
   * Every constraint is normalised to `expression <op> 0`, which makes the
   * solver one shape instead of six and makes the negation of a constraint a
   * substitution of the operator rather than a rearrangement.
   */
  function constraintOf(left, right, operator) {
    return { value: combine(left, right, -1), operator: operator,
      text: show(left) + ' ' + symbolFor(operator) + ' ' + show(right) };
  }

  function symbolFor(operator) {
    return { lt: '<', le: '<=', gt: '>', ge: '>=', eq: '=', ne: '!=' }[operator] || operator;
  }

  function negateConstraint(row) {
    return { value: row.value, operator: OPPOSITE[row.operator],
      text: 'not (' + row.text + ')' };
  }

  function holds(row, model) {
    if (row.value.opaque) return true;
    let total = row.value.constant;

    Object.keys(row.value.terms).forEach(function (name) {
      total += row.value.terms[name] * (model[name] === undefined ? 0 : model[name]);
    });
    return evaluate(total, row.operator);
  }

  function evaluate(total, operator) {
    if (operator === 'lt') return total < 0;
    if (operator === 'le') return total <= 0;
    if (operator === 'gt') return total > 0;
    if (operator === 'ge') return total >= 0;
    if (operator === 'eq') return total === 0;
    return total !== 0;
  }

  /* ------------------------------------------------------------ the solver
   *
   * A bounded integer search, and the bound is REPORTED rather than assumed
   * away. Within the box the answer is exact — every assignment is tried — and
   * outside it the answer is "unknown", never "unreachable". A symbolic
   * executor that reported an unsolved path as infeasible would be claiming
   * dead code that is merely out of reach of its solver, and that is the
   * failure people actually meet.
   */
  function solve(constraints, options) {
    const settings = options || {};
    const span = settings.span === undefined ? 12 : settings.span;
    const names = variablesOf(constraints);

    if (!names.length) {
      const empty = {};

      return constraints.every(function (row) { return holds(row, empty); })
        ? { verdict: 'sat', model: empty, tried: 1 }
        : { verdict: 'unsat', tried: 1 };
    }
    if (names.length > (settings.variables || 4)) {
      return refine({ verdict: 'unknown', tried: 0,
        why: names.length + ' symbols is past the search bound' }, constraints, settings);
    }
    return refine(searchBox(constraints, names, span), constraints, settings);
  }

  /**
   * A bounded search cannot tell "no solution" from "none within the box", so
   * on its own it reports `unknown` for both - which is the honest answer and
   * a useless one, because an infeasible path is dead code and worth knowing
   * about. With `decide: 'linear'` the path condition goes to the theory
   * solver, which eliminates variables and either PROVES it unsatisfiable or
   * says the constraints are satisfiable over the rationals and the missing
   * piece is an integer point.
   */
  function refine(answer, constraints, settings) {
    const theory = settings.decide ? linearTheory() : null;

    if (answer.verdict === 'sat' || !theory) return answer;
    const out = theory.decide(literalsFor(constraints));

    if (out.verdict === 'unsat') {
      return { verdict: 'unsat', tried: answer.tried, proof: 'linear elimination',
        why: out.why, stages: out.stages };
    }
    if (out.verdict !== 'sat') return Object.assign({}, answer, { theory: out.why });
    return Object.assign({}, answer, { rational: out.model,
      theory: 'satisfiable over the rationals; no integer point inside the box' });
  }

  /**
   * Opaque values carry no constraint and are dropped. That keeps the system
   * WEAKER than the path condition, so an unsat answer about the subset is
   * still an unsat answer about the whole - the direction that matters.
   */
  function literalsFor(constraints) {
    return constraints.filter(function (row) { return !row.value.opaque; })
      .map(function (row) {
        return { left: { terms: row.value.terms, constant: row.value.constant },
          right: { terms: {}, constant: 0 }, operator: row.operator };
      });
  }

  function searchBox(constraints, names, span) {
    const width = 2 * span + 1;
    const total = Math.pow(width, names.length);

    for (let mask = 0; mask < total; mask += 1) {
      const model = {};
      let rest = mask;

      names.forEach(function (name) {
        model[name] = (rest % width) - span;
        rest = Math.floor(rest / width);
      });
      if (constraints.every(function (row) { return holds(row, model); })) {
        return { verdict: 'sat', model: model, tried: mask + 1, span: span };
      }
    }
    return { verdict: 'unknown', tried: total, span: span,
      why: 'no assignment within ±' + span + ' satisfies the path condition' };
  }

  /* ------------------------------------------------------- the execution */

  const BINARY = { add: 1, sub: -1 };
  const COMPARE = { lt: 1, le: 1, gt: 1, ge: 1, eq: 1, ne: 1 };

  function execute(fn, options) {
    const settings = options || {};
    const blocks = {};
    const run = { paths: [], forks: 0, truncated: 0,
      maxDepth: settings.depth === undefined ? 12 : settings.depth,
      maxPaths: settings.paths === undefined ? 40 : settings.paths,
      span: settings.span, decide: settings.decide, symbols: [],
      names: settings.names || [] };

    fn.blocks.forEach(function (block) { blocks[block.id] = block; });
    walk(run, blocks, fn.blocks[0], initialState(fn, run), [], 0, []);
    return { paths: run.paths, forks: run.forks, truncated: run.truncated,
      feasible: run.paths.filter(function (row) { return row.verdict === 'sat'; }).length,
      symbols: run.symbols };
  }

  /**
   * The inputs are the function's PARAMETERS, seeded into the registers they
   * arrive in. Seeding the locals instead looks equivalent and is not: a local
   * is assigned before it is read, so the symbol is overwritten by the first
   * statement and every path condition comes out constant.
   */
  function initialState(fn, run) {
    const state = { slots: {}, regs: {} };

    (fn.params || []).forEach(function (register, at) {
      const label = run.names[at] || ('p' + at);

      state.regs[register] = symbol(label);
      run.symbols.push(label);
    });
    return state;
  }

  function walk(run, blocks, block, state, condition, depth, visited) {
    if (!block || depth > run.maxDepth || run.paths.length >= run.maxPaths) {
      run.truncated += 1;
      return;
    }
    const here = Object.assign({}, state,
      { slots: Object.assign({}, state.slots), regs: Object.assign({}, state.regs) });

    block.instructions.forEach(function (inst) { stepInstruction(here, inst); });
    followTerminator(run, blocks, block, here, condition, depth, visited.concat([block.id]));
  }

  function stepInstruction(state, inst) {
    if (inst.op === 'const') {
      state.regs[inst.target] = typeof inst.value === 'number'
        ? constant(inst.value) : opaque();
      return;
    }
    if (inst.op === 'loadLocal') {
      state.regs[inst.target] = state.slots[inst.slot] || opaque();
      return;
    }
    if (inst.op === 'storeLocal') {
      state.slots[inst.slot] = state.regs[inst.value] || opaque();
      return;
    }
    if (inst.op === 'binary') { stepBinary(state, inst); return; }
    if (inst.target) state.regs[inst.target] = opaque();
  }

  function stepBinary(state, inst) {
    const left = state.regs[inst.left];
    const right = state.regs[inst.right];

    if (BINARY[inst.operator]) {
      state.regs[inst.target] = combine(left, right, BINARY[inst.operator]);
      return;
    }
    if (inst.operator === 'mul') { state.regs[inst.target] = multiply(left, right); return; }
    if (COMPARE[inst.operator]) {
      state.regs[inst.target] = opaque();
      state.regs[inst.target].compare = constraintOf(left, right, inst.operator);
      return;
    }
    state.regs[inst.target] = opaque();
  }

  function followTerminator(run, blocks, block, state, condition, depth, visited) {
    const terminator = block.terminator;

    if (!terminator || terminator.op === 'ret') { finishPath(run, state, condition, visited); return; }
    if (terminator.op === 'jump') {
      walk(run, blocks, blocks[terminator.target], state, condition, depth + 1, visited);
      return;
    }
    if (terminator.op !== 'branch') { finishPath(run, state, condition, visited); return; }
    forkOn(run, blocks, terminator, state, condition, depth, visited);
  }

  function forkOn(run, blocks, terminator, state, condition, depth, visited) {
    const held = state.regs[terminator.cond];
    const compare = held && held.compare;

    run.forks += 1;
    if (!compare) {
      walk(run, blocks, blocks[terminator.then], state, condition, depth + 1, visited);
      walk(run, blocks, blocks[terminator.other], state, condition, depth + 1, visited);
      return;
    }
    walk(run, blocks, blocks[terminator.then], state, condition.concat([compare]),
      depth + 1, visited);
    walk(run, blocks, blocks[terminator.other],
      state, condition.concat([negateConstraint(compare)]), depth + 1, visited);
  }

  function finishPath(run, state, condition, visited) {
    if (run.paths.length >= run.maxPaths) { run.truncated += 1; return; }
    const answer = solve(condition, { span: run.span, decide: run.decide });

    run.paths.push({ condition: condition.map(function (row) { return row.text; }),
      constraints: condition, blocks: visited, verdict: answer.verdict,
      model: answer.model || null, tried: answer.tried || 0, why: answer.why || '' });
  }

  return { OPPOSITE: OPPOSITE, constant: constant, symbol: symbol, opaque: opaque,
    linearTheory: linearTheory, literalsFor: literalsFor, refine: refine,
    combine: combine, multiply: multiply, scale: scale, show: show,
    constraintOf: constraintOf, negateConstraint: negateConstraint, holds: holds,
    variablesOf: variablesOf, solve: solve, execute: execute };
}));

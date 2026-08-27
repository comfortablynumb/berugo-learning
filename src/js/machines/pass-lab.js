/**
 * The pass laboratory: run any pipeline over any program, verify after every
 * pass, and compare the result against the reference interpreter.
 *
 * The loop this file implements is the one Csmith and its descendants used to
 * find hundreds of bugs in production compilers: generate a program, compile
 * it, run it, compare, and — the part people skip — shrink the failure until
 * it fits on a screen. A found bug nobody can reduce is a found bug nobody
 * fixes, which is why the shrinker is here rather than in a note.
 *
 * Three gates run after every pass and each catches a different thing:
 *
 * - the **verifier**, which names the invariant a pass broke, at the pass that
 *   broke it, rather than leaving eleven passes to bisect by hand;
 * - the **SSA check**, which is the two invariants the verifier cannot state
 *   without a dominator tree;
 * - the **differential run**, which is the only one that can see a pass that
 *   produces perfectly valid IR computing the wrong thing.
 *
 * Phase ordering is the other thing this file makes visible. Running A then B
 * and B then A over the same program gives different code, and the counts are
 * reported rather than an order being declared best — because no fixed order
 * is optimal, which is why "-O2 made it slower" is a real bug report.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.PassLab = api;
}(this, function (root) {
  'use strict';

  const berugo = root && root.Berugo ? root.Berugo : null;
  const base = './berugo/';
  const Ir = pick('Ir', 'ir.js');
  const IrLower = pick('IrLower', 'ir-lower.js');
  const IrInterp = pick('IrInterp', 'ir-interp.js');
  const Ssa = pick('Ssa', 'ssa.js');
  const Cfg = pick('Cfg', 'cfg.js');
  const Scalar = pick('PassesScalar', 'passes-scalar.js');
  const Loop = pick('PassesLoop', 'passes-loop.js');
  const Spec = pick('Spec', 'spec.js');
  const Parser = pick('Parser', 'parser.js');
  const Resolve = pick('Resolve', 'resolve.js');

  function pick(name, file) {
    if (berugo && berugo[name]) return berugo[name];
    return require(base + file);
  }

  /* ---------------------------------------------------------- the pipeline */

  /**
   * Every pass, with what it does and which stage it belongs to. `ssa` marks
   * the passes that require SSA form, so a pipeline that runs one before
   * construction is a configuration error rather than a mystery.
   */
  const PASSES = {
    ssa: { stage: 'form', ssa: false, about: 'promote slots to registers, placing phi functions',
      run: function (fn) { return Object.assign({ pass: 'ssa' }, Ssa.construct(fn)); } },
    'copy-propagation': { stage: 'scalar', ssa: true, about: Scalar.PASSES['copy-propagation'].about,
      run: function (fn) { return Scalar.copyPropagation(fn); } },
    sccp: { stage: 'scalar', ssa: true, about: Scalar.PASSES.sccp.about,
      run: function (fn) { return Scalar.sccp(fn); } },
    'value-numbering': { stage: 'scalar', ssa: true, about: Scalar.PASSES['value-numbering'].about,
      run: function (fn) { return Scalar.valueNumbering(fn); } },
    peephole: { stage: 'scalar', ssa: true, about: Scalar.PASSES.peephole.about,
      run: function (fn) { return Scalar.peephole(fn); } },
    licm: { stage: 'loop', ssa: true, about: Loop.PASSES.licm.about,
      run: function (fn) { return Loop.licm(fn); } },
    'licm-naive': { stage: 'loop', ssa: true, about: Loop.PASSES['licm-naive'].about,
      run: function (fn) { return Loop.licm(fn, { naive: true }); } },
    'dead-code': { stage: 'scalar', ssa: true, about: Scalar.PASSES['dead-code'].about,
      run: function (fn) { return Scalar.deadCode(fn); } },
    simplify: { stage: 'cfg', ssa: false, about: 'drop unreachable blocks',
      run: function (fn) {
        const out = Cfg.removeUnreachable(fn);

        return { pass: 'simplify', changed: out.removed };
      } }
  };

  const DEFAULT = ['ssa', 'sccp', 'copy-propagation', 'value-numbering', 'peephole',
    'licm', 'dead-code'];

  function passNames() { return Object.keys(PASSES); }

  /* ------------------------------------------------------------- running */

  function compile(source, options) {
    const settings = options || {};
    const built = IrLower.compile(source, settings);

    return { source: source, program: built.program, errors: built.errors,
      core: built.core };
  }

  /**
   * Run a pipeline, gating after every pass. The report per pass carries the
   * instruction count before and after, what the pass claims it changed, and
   * whether all three gates still hold — so a failure names the pass rather
   * than the pipeline.
   */
  function run(source, pipeline, options) {
    const settings = options || {};
    const built = compile(source, settings);
    const baseline = IrInterp.run(built.program, settings);
    const state = { program: built.program, steps: [], baseline: baseline,
      settings: settings };

    (pipeline || DEFAULT).forEach(function (name) { runPass(state, name); });
    return finish(built, state);
  }

  /**
   * Counts are program-wide, not the first function's. A fixture with three
   * small functions reported the size of whichever one the lowering happened
   * to emit first, which is a number nobody can interpret and which moves when
   * a declaration is reordered.
   */
  function totalInstructions(program) {
    return program.functions.reduce(function (sum, fn) {
      return sum + Ir.instructionCount(fn);
    }, 0);
  }

  function runPass(state, name) {
    const pass = PASSES[name];
    const before = totalInstructions(state.program);

    if (!pass) throw new Error('no pass named ' + name);
    const reports = state.program.functions.map(function (fn) { return pass.run(fn); });

    state.steps.push(gate(state, name, reports, before));
  }

  function gate(state, name, reports, before) {
    const ssaForm = state.program.functions.some(function (fn) { return fn.ssa; });
    const verified = Ir.verifyProgram(state.program, { ssa: ssaForm });
    const dominance = ssaForm ? ssaCheck(state.program) : { ok: true, problems: [] };
    const outcome = IrInterp.run(state.program, state.settings);
    const compared = IrInterp.compare(state.baseline, outcome);

    return { pass: name, about: PASSES[name].about, stage: PASSES[name].stage,
      before: before, after: totalInstructions(state.program),
      changed: reports.reduce(function (sum, row) { return sum + (row.changed || 0); }, 0),
      reports: reports, verified: verified.ok, dominance: dominance.ok,
      agrees: compared.agree, why: compared.why,
      problems: verified.problems.concat(dominance.problems),
      ok: verified.ok && dominance.ok && compared.agree };
  }

  function ssaCheck(program) {
    const problems = [];

    program.functions.forEach(function (fn) {
      if (!fn.ssa) return;
      Ssa.check(fn).problems.forEach(function (problem) {
        problems.push(Object.assign({ fn: fn.name }, problem));
      });
    });
    return { ok: problems.length === 0, problems: problems };
  }

  function finish(built, state) {
    const failed = state.steps.filter(function (step) { return !step.ok; });

    return { source: built.source, program: state.program, steps: state.steps,
      baseline: state.baseline, ok: failed.length === 0, failed: failed,
      instructions: totalInstructions(state.program),
      firstFailure: failed.length ? failed[0] : null };
  }

  /* ------------------------------------------------------- phase ordering */

  /**
   * The same two passes in both orders. The instruction counts differ, and
   * neither order dominates on every program — which is the whole of the
   * phase-ordering problem, made concrete rather than asserted.
   */
  function ordering(source, a, b, options) {
    const first = run(source, ['ssa', a, b, 'dead-code'], options);
    const second = run(source, ['ssa', b, a, 'dead-code'], options);

    return { first: { order: [a, b], instructions: first.instructions, ok: first.ok },
      second: { order: [b, a], instructions: second.instructions, ok: second.ok },
      difference: first.instructions - second.instructions,
      same: first.instructions === second.instructions };
  }

  /* ------------------------------------------------------------ the suite */

  function suite(pipeline, options) {
    const rows = Spec.CONFORMANCE.map(function (program) {
      const out = run(program.source, pipeline, options);
      const first = out.steps.length ? out.steps[0].before : 0;

      return { id: program.id, before: first, after: out.instructions,
        removed: first - out.instructions,
        ratio: first ? out.instructions / first : 1,
        ok: out.ok, why: out.firstFailure ? failureText(out.firstFailure) : '' };
    });

    return { rows: rows, passed: rows.filter(function (row) { return row.ok; }).length,
      total: rows.length,
      before: rows.reduce(function (sum, row) { return sum + row.before; }, 0),
      after: rows.reduce(function (sum, row) { return sum + row.after; }, 0) };
  }

  function failureText(step) {
    if (!step.verified) return 'verifier: ' + step.problems[0].invariant;
    if (!step.dominance) return 'ssa: ' + step.problems[0].why;
    return 'behaviour: ' + step.why;
  }

  /* -------------------------------------------------------------- shrinking */

  /**
   * Reduce a failing program while it still fails. Three moves, cheapest
   * first: delete a whole statement, simplify a numeric literal towards zero,
   * and shorten an array. Each candidate is only kept if it STILL FAILS in the
   * same way — a shrinker that accepts a program failing for a different
   * reason has replaced the bug with another one, which is the mistake that
   * makes shrinkers untrustworthy.
   */
  function shrink(source, pipeline, options) {
    const settings = options || {};
    const original = failureOf(source, pipeline, settings);
    const state = { best: source, rounds: 0, tried: 0, accepted: 0 };

    if (!original) return { ok: false, why: 'this program does not fail', source: source };
    reduceUntilStable(state, original, pipeline, settings);
    return { ok: true, original: source, source: state.best,
      from: source.split('\n').length, to: state.best.split('\n').length,
      characters: state.best.length, was: source.length,
      rounds: state.rounds, tried: state.tried, accepted: state.accepted,
      failure: original };
  }

  /**
   * Greedy: take the first candidate that still fails, then recompute the
   * candidate list from the new program.
   *
   * Continuing through a list computed from the previous program applies stale
   * edits — a later candidate is the OLD text with one change, so accepting it
   * silently undoes the acceptance before it. That is why the first version
   * reduced twenty-four lines to twenty-four while reporting hundreds of
   * accepted candidates: it was making progress and throwing it away.
   */
  function reduceUntilStable(state, original, pipeline, settings) {
    let changed = true;

    while (changed && state.rounds < 400) {
      changed = false;
      state.rounds += 1;
      const next = firstReduction(state, original, pipeline, settings);

      if (!next) continue;
      state.best = next;
      state.accepted += 1;
      changed = true;
    }
  }

  function firstReduction(state, original, pipeline, settings) {
    const list = candidates(state.best);

    for (let i = 0; i < list.length; i += 1) {
      state.tried += 1;
      if (sameFailure(list[i], original, pipeline, settings)) return list[i];
    }
    return null;
  }

  function failureOf(source, pipeline, settings) {
    let out = null;

    try {
      out = run(source, pipeline, settings);
    } catch (error) {
      return { kind: 'threw', detail: error.message };
    }
    if (out.ok) return null;
    return { kind: out.firstFailure.verified ? 'behaviour' : 'verifier',
      pass: out.firstFailure.pass };
  }

  /**
   * A candidate is accepted only if it is still a VALID program and still
   * fails in the same way.
   *
   * Validity is not fussiness. Without it the shrinker happily deletes the
   * declaration of a variable the loop still uses, and the minimal repro is a
   * program that does not compile — which a compiler team dismisses in one
   * line, correctly, because a bug report about undefined behaviour is not a
   * bug report. This is the mistake that makes shrinkers untrusted, and it
   * costs one resolution per candidate to avoid.
   */
  function sameFailure(candidate, original, pipeline, settings) {
    if (!isValid(candidate)) return false;
    const found = failureOf(candidate, pipeline, settings);

    if (!found) return false;
    return found.kind === original.kind && found.pass === original.pass;
  }

  function isValid(source) {
    const parsed = Parser.parse(source);

    if (parsed.errors.length) return false;
    return Resolve.resolve(parsed.tree).errors.length === 0;
  }

  function candidates(source) {
    const lines = source.split('\n');

    return dropLines(lines).concat(simplifyNumbers(source), shortenArrays(source));
  }

  function dropLines(lines) {
    return lines.map(function (line, at) {
      return lines.filter(function (other, index) { return index !== at; }).join('\n');
    }).filter(function (text) { return text.trim().length; });
  }

  function simplifyNumbers(source) {
    const out = [];

    source.replace(/\b([0-9]+)\b/g, function (match, digits, at) {
      if (digits === '0') return match;
      out.push(source.slice(0, at) + '0' + source.slice(at + match.length));
      return match;
    });
    return out;
  }

  function shortenArrays(source) {
    const out = [];

    source.replace(/\[([^\]]+)\]/g, function (match, inner, at) {
      const parts = inner.split(',');

      if (parts.length < 2) return match;
      out.push(source.slice(0, at) + '[' + parts.slice(0, -1).join(',') + ']'
        + source.slice(at + match.length));
      return match;
    });
    return out;
  }

  /* ------------------------------------------------------------- reporting */

  function instructionRows(program) {
    return program.functions.map(function (fn) {
      return { name: fn.name, blocks: fn.blocks.length,
        instructions: Ir.instructionCount(fn), ssa: Boolean(fn.ssa),
        text: Ir.showFunction(fn) };
    });
  }

  return {
    PASSES: PASSES, DEFAULT: DEFAULT, passNames: passNames,
    compile: compile, run: run, ordering: ordering, suite: suite,
    shrink: shrink, candidates: candidates, failureOf: failureOf,
    instructionRows: instructionRows
  };
}));

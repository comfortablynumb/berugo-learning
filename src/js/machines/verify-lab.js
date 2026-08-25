/**
 * The verification bench: bounded checking of the obligations Hoare logic
 * produces, a fixture set of annotated programs, and the counterexample search
 * that turns "your invariant is wrong" into a state you can read.
 *
 * There is no SMT solver here, and pretending otherwise would be the one
 * dishonest thing this module could do. Instead every obligation is checked by
 * *enumeration* over a bounded domain: all values of every variable in a small
 * range. That is decisive when it fails — a counterexample is a counterexample
 * — and only suggestive when it passes, so every result carries the domain it
 * was checked over and the number of states it visited.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.VerifyLab = api;
}(this, function (root) {
  'use strict';

  const H = root && root.Hoare ? root.Hoare : require('../algorithms/hoare.js');

  /**
   * The domain includes negative values on purpose. Restricting it to naturals
   * silently proves invariants that are only true because nothing could go
   * below zero — `divisionNoBound` is exactly that program: it "verifies" over
   * [0, 6] and fails the moment the domain can express a negative remainder.
   */
  const DEFAULT_DOMAIN = { low: -2, high: 5 };

  /**
   * Check one formula by enumeration. Returns the first state that falsifies
   * it, the number of states visited, and the domain — so the claim is always
   * "valid over this many states", never a bare "valid".
   */
  function check(formula, domain, cap) {
    const range = domain || DEFAULT_DOMAIN;
    const names = H.variablesIn(formula, []);
    const limit = cap || 200000;
    const total = Math.pow(range.high - range.low + 1, names.length);
    const context = { names: names, range: range, formula: formula, visited: 0,
      counterexample: null, undefinedAt: null, truncated: total > limit };

    walk(context, {}, 0);
    return { valid: context.counterexample === null, visited: context.visited,
      counterexample: context.counterexample, undefinedAt: context.undefinedAt,
      variables: names, domain: range, space: total, truncated: context.truncated };
  }

  function walk(context, state, index) {
    if (context.counterexample !== null || context.visited > 200000) return;
    if (index === context.names.length) {
      testState(context, state);
      return;
    }
    for (let value = context.range.low; value <= context.range.high; value += 1) {
      const next = Object.assign({}, state);

      next[context.names[index]] = value;
      walk(context, next, index + 1);
      if (context.counterexample !== null) return;
    }
  }

  function testState(context, state) {
    const result = H.holds(context.formula, state);

    context.visited += 1;
    if (result === null) {
      context.undefinedAt = context.undefinedAt || Object.assign({}, state);
      return;
    }
    if (result === false) context.counterexample = Object.assign({}, state);
  }

  function showState(state) {
    if (state === null || state === undefined) return '—';
    return Object.keys(state).sort().map(function (name) {
      return name + ' = ' + state[name];
    }).join(', ');
  }

  /* ------------------------------------------------------------ programs */

  const E = { lit: H.lit, ref: H.ref, bin: H.binary };

  function sumProgram(invariantText) {
    const body = H.seq(H.assign('s', E.bin('+', E.ref('s'), E.ref('i'))),
      H.assign('i', E.bin('+', E.ref('i'), E.lit(1))));

    return { pre: H.compare('≥', E.ref('n'), E.lit(0)),
      command: H.seq(H.seq(H.assign('i', E.lit(0)), H.assign('s', E.lit(0))),
        H.loop(H.compare('<', E.ref('i'), E.ref('n')),
          invariantFor(invariantText), body)),
      post: H.compare('=', E.bin('*', E.lit(2), E.ref('s')),
        E.bin('*', E.ref('n'), E.bin('-', E.ref('n'), E.lit(1)))) };
  }

  /** The right invariant, and two plausible wrong ones. */
  function invariantFor(name) {
    const doubled = H.compare('=', E.bin('*', E.lit(2), E.ref('s')),
      E.bin('*', E.ref('i'), E.bin('-', E.ref('i'), E.lit(1))));

    if (name === 'correct') {
      return H.and(doubled, H.and(H.compare('≤', E.ref('i'), E.ref('n')),
        H.compare('≥', E.ref('i'), E.lit(0))));
    }
    if (name === 'noBound') return doubled;
    return H.and(H.compare('≥', E.ref('s'), E.lit(0)),
      H.compare('≤', E.ref('i'), E.ref('n')));
  }

  function divisionProgram(correct) {
    const body = H.seq(H.assign('r', E.bin('-', E.ref('r'), E.ref('y'))),
      H.assign('q', E.bin('+', E.ref('q'), E.lit(1))));
    const invariant = correct
      ? H.and(H.compare('=', E.ref('x'),
        E.bin('+', E.bin('*', E.ref('q'), E.ref('y')), E.ref('r'))),
      H.compare('≥', E.ref('r'), E.lit(0)))
      : H.compare('=', E.ref('x'),
        E.bin('+', E.bin('*', E.ref('q'), E.ref('y')), E.ref('r')));

    return { pre: H.and(H.compare('≥', E.ref('x'), E.lit(0)),
      H.compare('>', E.ref('y'), E.lit(0))),
    command: H.seq(H.seq(H.assign('q', E.lit(0)), H.assign('r', E.ref('x'))),
      H.loop(H.compare('≥', E.ref('r'), E.ref('y')), invariant, body)),
    post: H.and(H.compare('=', E.ref('x'),
      E.bin('+', E.bin('*', E.ref('q'), E.ref('y')), E.ref('r'))),
    H.and(H.compare('≥', E.ref('r'), E.lit(0)),
      H.compare('<', E.ref('r'), E.ref('y')))) };
  }

  function swapProgram(useTemp) {
    const command = useTemp
      ? H.seq(H.seq(H.assign('t', E.ref('x')), H.assign('x', E.ref('y'))),
        H.assign('y', E.ref('t')))
      : H.seq(H.assign('x', E.ref('y')), H.assign('y', E.ref('x')));

    return { pre: H.and(H.compare('=', E.ref('x'), E.ref('a')),
      H.compare('=', E.ref('y'), E.ref('b'))),
    command: command,
    post: H.and(H.compare('=', E.ref('x'), E.ref('b')),
      H.compare('=', E.ref('y'), E.ref('a'))) };
  }

  function maxProgram(correct) {
    const command = H.branch(H.compare('>', E.ref('x'), E.ref('y')),
      H.assign('m', E.ref('x')), H.assign('m', correct ? E.ref('y') : E.ref('x')));

    return { pre: H.TRUE, command: command,
      post: H.and(H.and(H.compare('≥', E.ref('m'), E.ref('x')),
        H.compare('≥', E.ref('m'), E.ref('y'))),
      H.or(H.compare('=', E.ref('m'), E.ref('x')),
        H.compare('=', E.ref('m'), E.ref('y')))) };
  }

  /** Nested conditionals with nothing else in them: the wp blow-up, measured. */
  function nestedProgram(depth) {
    let command = H.assign('z', E.ref('z'));

    for (let level = 0; level < depth; level += 1) {
      command = H.branch(H.compare('<', E.ref('v' + level), E.lit(3)),
        H.seq(H.assign('z', E.bin('+', E.ref('z'), E.lit(1))), command),
        H.seq(H.assign('z', E.bin('-', E.ref('z'), E.lit(1))), command));
    }
    return { pre: H.TRUE, command: command,
      post: H.compare('≥', E.ref('z'), E.lit(0)) };
  }

  const PROGRAMS = {
    swap: { build: function () { return swapProgram(true); },
      note: 'the three-assignment swap, with ghost variables a and b' },
    swapNoTemp: { build: function () { return swapProgram(false); },
      note: 'the same swap without the temporary — the classic bug' },
    max: { build: function () { return maxProgram(true); },
      note: 'a conditional, so wp splits into two implications' },
    maxWrong: { build: function () { return maxProgram(false); },
      note: 'the else branch assigns the wrong variable' },
    sum: { build: function () { return sumProgram('correct'); },
      note: 'sum of 0..n−1, invariant 2s = i(i−1) with the bounds on i' },
    sumNoBound: { build: function () { return sumProgram('noBound'); },
      note: 'the same invariant without i ≤ n — true, but too weak to exit with' },
    sumTooWeak: { build: function () { return sumProgram('weak'); },
      note: 'an invariant that is preserved but says nothing about the answer' },
    division: { build: function () { return divisionProgram(true); },
      note: 'division by repeated subtraction, invariant x = qy + r ∧ r ≥ 0' },
    divisionNoBound: { build: function () { return divisionProgram(false); },
      note: 'the same without r ≥ 0, which the postcondition needs' }
  };

  /* -------------------------------------------------------- the analysis */

  /** Every obligation of one program, each with its own verdict. */
  function verify(name, domain) {
    const program = PROGRAMS[name].build();
    const obligations = H.conditions(program.pre, program.command, program.post);
    const checked = obligations.map(function (obligation) {
      const result = check(obligation.formula, domain);

      return { name: obligation.name, reads: obligation.reads,
        formula: H.showFormula(obligation.formula, false),
        size: H.formulaSize(obligation.formula),
        valid: result.valid, visited: result.visited,
        counterexample: result.counterexample,
        counterexampleText: showState(result.counterexample),
        blame: result.counterexample
          ? H.blame(obligation.formula, result.counterexample) : '' };
    });

    return { program: name, note: PROGRAMS[name].note,
      source: H.showCommand(program.command, ''),
      pre: H.showFormula(program.pre, false), post: H.showFormula(program.post, false),
      obligations: checked, proved: checked.every(function (entry) { return entry.valid; }),
      failing: checked.filter(function (entry) { return !entry.valid; })
        .map(function (entry) { return entry.name; }),
      totalSize: checked.reduce(function (sum, entry) { return sum + entry.size; }, 0),
      states: checked.reduce(function (sum, entry) { return sum + entry.visited; }, 0) };
  }

  /**
   * Run the program on concrete inputs as well. A proof that fails should come
   * with an execution that goes wrong, and a proof that holds should have no
   * such execution in the bounded domain — the two checks are independent, and
   * disagreement between them means one of them is broken.
   */
  function test(name, domain) {
    const program = PROGRAMS[name].build();
    const range = domain || DEFAULT_DOMAIN;
    const inputs = H.variablesIn(program.pre, H.variablesIn(program.post, []));
    const context = { program: program, range: range, names: inputs, failures: [],
      runs: 0, nonTerminating: 0 };

    enumerateRuns(context, {}, 0);
    return { program: name, runs: context.runs, failures: context.failures,
      nonTerminating: context.nonTerminating,
      firstFailure: context.failures.length ? context.failures[0] : null,
      holds: context.failures.length === 0 };
  }

  function enumerateRuns(context, state, index) {
    if (context.runs > 40000 || context.failures.length > 3) return;
    if (index === context.names.length) {
      runOne(context, state);
      return;
    }
    for (let value = context.range.low; value <= context.range.high; value += 1) {
      const next = Object.assign({}, state);

      next[context.names[index]] = value;
      enumerateRuns(context, next, index + 1);
    }
  }

  function runOne(context, state) {
    if (H.holds(context.program.pre, state) !== true) return;
    context.runs += 1;
    const result = H.run(context.program.command, state, 4000);

    if (!result.terminated) {
      context.nonTerminating += 1;
      return;
    }
    if (H.holds(context.program.post, result.state) === true) return;
    context.failures.push({ start: showState(state), end: showState(result.state),
      steps: result.steps });
  }

  /** The blow-up: wp doubles with every nested conditional. */
  function blowupTable(maxDepth) {
    const rows = [];

    for (let depth = 1; depth <= (maxDepth || 6); depth += 1) {
      const program = nestedProgram(depth);
      const formula = H.wp(program.command, program.post, []);

      rows.push({ depth: depth, size: H.formulaSize(formula),
        text: depth <= 2 ? H.showFormula(formula, false) : '',
        ratio: rows.length === 0 ? 1 : H.formulaSize(formula) / rows[rows.length - 1].size });
    }
    return rows;
  }

  function programNames() { return Object.keys(PROGRAMS); }

  return {
    DEFAULT_DOMAIN: DEFAULT_DOMAIN, PROGRAMS: PROGRAMS, programNames: programNames,
    check: check, showState: showState, verify: verify, test: test,
    blowupTable: blowupTable, nestedProgram: nestedProgram,
    sumProgram: sumProgram, divisionProgram: divisionProgram,
    swapProgram: swapProgram, maxProgram: maxProgram
  };
}));

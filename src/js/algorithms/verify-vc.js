/**
 * Deductive verification: weakest preconditions, verification conditions, and
 * a solver that discharges them.
 *
 * The pipeline has three stages and each is a different kind of object. An
 * ANNOTATED PROGRAM carries preconditions, postconditions and loop invariants
 * that the compiler cannot infer. WEAKEST PRECONDITION reasoning turns it into
 * a list of VERIFICATION CONDITIONS, each a purely logical claim with no
 * program left in it — "given these assumptions, this must hold". And an SMT
 * solver discharges them, by showing the assumptions together with the
 * NEGATION of the goal are unsatisfiable.
 *
 * The last step is why a failed VC is useful. "Unsatisfiable" is a proof; but
 * "satisfiable" comes with a model, and that model is a concrete state in
 * which the program does the wrong thing. A verifier that only said yes or no
 * would be much harder to use than one that hands back the counter-example.
 *
 * Loops are where the annotation burden lives, and the three VCs a loop
 * generates say exactly why:
 *
 * - the invariant holds on ENTRY;
 * - the body PRESERVES it, given the invariant and the loop condition;
 * - the invariant and the negated condition imply what comes after.
 *
 * Nothing here infers an invariant. That is the honest position: invariant
 * inference is a research area, the abstract interpretation in 32.2 is one
 * approach to it, and a verifier that quietly weakened an invariant it could
 * not prove would be proving a different program.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.VerifyVc = api;
}(typeof window !== 'undefined' ? window : null, function (root) {
  'use strict';

  const Linear = pick('TheoryLinear', '../machines/solver/theories/linear.js');

  function pick(name, file) {
    if (root && root.Berugo && root.Berugo[name]) return root.Berugo[name];
    return require(file);
  }

  const OPPOSITE = { le: 'gt', lt: 'ge', ge: 'lt', gt: 'le', eq: 'ne', ne: 'eq' };

  /* --------------------------------------------------------- expressions */

  function affine(terms, constant) {
    return { terms: Object.assign({}, terms || {}), constant: constant || 0 };
  }

  function variable(name) {
    const terms = {};

    terms[name] = 1;
    return affine(terms, 0);
  }

  function number(value) {
    return affine({}, value);
  }

  function plus(a, b) {
    const terms = Object.assign({}, a.terms);

    Object.keys(b.terms).forEach(function (name) {
      terms[name] = (terms[name] || 0) + b.terms[name];
      if (terms[name] === 0) delete terms[name];
    });
    return affine(terms, a.constant + b.constant);
  }

  function times(value, factor) {
    const terms = {};

    Object.keys(value.terms).forEach(function (name) {
      if (value.terms[name] * factor !== 0) terms[name] = value.terms[name] * factor;
    });
    return affine(terms, value.constant * factor);
  }

  function minus(a, b) {
    return plus(a, times(b, -1));
  }

  /**
   * Substitution is the whole of the assignment rule. `wp(x := e, P)` is `P`
   * with every `x` replaced by `e`, and doing it on affine expressions is
   * arithmetic rather than syntax: scale `e` by `x`'s coefficient and add.
   */
  function substitute(value, name, replacement) {
    if (value.terms[name] === undefined) return affine(value.terms, value.constant);
    const coefficient = value.terms[name];
    const rest = affine(value.terms, value.constant);

    delete rest.terms[name];
    return plus(rest, times(replacement, coefficient));
  }

  function show(value) {
    const parts = Object.keys(value.terms).sort().map(function (name) {
      const c = value.terms[name];

      return (c === 1 ? '' : (c === -1 ? '-' : c + '·')) + name;
    });

    if (value.constant !== 0 || !parts.length) parts.push(String(value.constant));
    return parts.join(' + ').replace(/\+ -/g, '- ');
  }

  /* --------------------------------------------------------- conditions */

  function condition(left, operator, right) {
    return { left: left, operator: operator, right: right };
  }

  function negate(row) {
    return condition(row.left, OPPOSITE[row.operator], row.right);
  }

  function substituteIn(row, name, replacement) {
    return condition(substitute(row.left, name, replacement), row.operator,
      substitute(row.right, name, replacement));
  }

  function showCondition(row) {
    const symbols = { le: '<=', lt: '<', ge: '>=', gt: '>', eq: '=', ne: '!=' };

    return show(row.left) + ' ' + symbols[row.operator] + ' ' + show(row.right);
  }

  /* -------------------------------------------- weakest preconditions */

  /**
   * `wp(statement, goals)` for the straight-line constructs, returning the
   * goals rewritten backwards through the statement. Loops do not go through
   * here — they are cut at their invariant and generate their own VCs, which
   * is the only way to keep the process finite.
   */
  function wp(statement, goals) {
    if (!statement) return goals;
    if (statement.op === 'assign') {
      return goals.map(function (goal) {
        return substituteIn(goal, statement.name, statement.expr);
      });
    }
    if (statement.op === 'seq') {
      return statement.body.slice().reverse().reduce(function (into, step) {
        return wp(step, into);
      }, goals);
    }
    return goals;
  }

  /* ---------------------------------------------------- VC generation */

  /**
   * Walk the program collecting VCs. Every path through straight-line code
   * accumulates its assumptions; an `assert` becomes a VC over what has been
   * assumed so far; and a `while` is cut at its invariant into three.
   */
  function generate(program) {
    const run = { vcs: [], paths: 0 };

    walk(program.body, (program.requires || []).slice(), run, 'the precondition');
    return { vcs: run.vcs, paths: run.paths };
  }

  function walk(statements, assumptions, run, why) {
    let known = assumptions.slice();

    statements.forEach(function (statement) {
      known = step(statement, known, run, why);
    });
    run.paths += 1;
    return known;
  }

  function step(statement, known, run, why) {
    if (statement.op === 'assume') return known.concat([statement.cond]);
    if (statement.op === 'assert') {
      run.vcs.push({ name: statement.label || 'assertion',
        assumptions: known.slice(), goal: statement.cond, kind: 'assert' });
      return known.concat([statement.cond]);
    }
    if (statement.op === 'assign') return assignInto(statement, known);
    if (statement.op === 'if') return branchInto(statement, known, run, why);
    if (statement.op === 'while') return loopInto(statement, known, run);
    return known;
  }

  /**
   * An assignment rewrites the assumptions FORWARD by substituting the old
   * value out. Doing it this way rather than backwards keeps the assumption
   * list in program order, which is what makes a failing VC readable.
   */
  function assignInto(statement, known) {
    const fresh = statement.name + "'";

    return known.map(function (row) {
      return substituteIn(row, statement.name, variable(fresh));
    }).concat([condition(variable(statement.name), 'eq',
      substitute(statement.expr, statement.name, variable(fresh)))]);
  }

  function branchInto(statement, known, run, why) {
    walk(statement.then || [], known.concat([statement.cond]), run, why);
    walk(statement.other || [], known.concat([negate(statement.cond)]), run, why);
    return known.concat([]);
  }

  /**
   * The three loop VCs. Cutting the loop at its invariant is what makes
   * verification finite where execution is not, and it is also why the
   * invariant has to be written down: nothing here can invent one, and a
   * missing invariant does not produce a weaker proof, it produces no proof.
   */
  function loopInto(statement, known, run) {
    const invariant = statement.invariant || [];

    invariant.forEach(function (goal) {
      run.vcs.push({ name: 'the invariant holds on entry', assumptions: known.slice(),
        goal: goal, kind: 'entry' });
    });
    const inside = invariant.concat([statement.cond]);

    invariant.forEach(function (goal) {
      run.vcs.push({ name: 'the body preserves the invariant',
        assumptions: inside.slice(),
        goal: wp({ op: 'seq', body: statement.body || [] }, [goal])[0],
        kind: 'preserve' });
    });
    return invariant.concat([negate(statement.cond)]);
  }


  /* ------------------------------------------------- the integer witness */

  /**
   * The elimination procedure decides the RATIONALS, so a counter-example it
   * produces may be fractional - and a fractional state is not a state a
   * program can be in. Rounding each variable both ways and re-checking is a
   * cheap, one-sided answer to "does this failure survive the integers": a
   * witness found is a real refutation, and finding none proves nothing beyond
   * the neighbourhood it looked in, which is exactly what the report says.
   */
  function valueAt(expr, model) {
    let total = expr.constant || 0;

    Object.keys(expr.terms || {}).forEach(function (name) {
      total += expr.terms[name] * (model[name] === undefined ? 0 : model[name]);
    });
    return total;
  }

  function holdsAt(row, model) {
    const left = valueAt(row.left, model);
    const right = valueAt(row.right, model);

    if (row.operator === 'le') return left <= right;
    if (row.operator === 'lt') return left < right;
    if (row.operator === 'ge') return left >= right;
    if (row.operator === 'gt') return left > right;
    if (row.operator === 'eq') return left === right;
    return left !== right;
  }

  function refutes(vc, model) {
    return vc.assumptions.every(function (row) { return holdsAt(row, model); }) &&
      !holdsAt(vc.goal, model);
  }

  function integerWitness(vc, model) {
    const names = Object.keys(model || {});

    if (!names.length || names.length > 6) return null;
    const total = Math.pow(2, names.length);

    for (let mask = 0; mask < total; mask += 1) {
      const candidate = {};

      names.forEach(function (name, at) {
        candidate[name] = (mask >> at) & 1
          ? Math.ceil(model[name]) : Math.floor(model[name]);
      });
      if (refutes(vc, candidate)) return candidate;
    }
    return null;
  }

  /* ------------------------------------------------------ the discharge */

  /**
   * A VC is discharged by refuting its negation. `assumptions ∧ ¬goal` is
   * handed to the linear solver: UNSAT means the goal follows and the VC is
   * proved, SAT means it does not and the model is a state in which the
   * program is wrong. That asymmetry is the whole reason to use a solver
   * rather than a checker.
   */
  function discharge(vc) {
    const literals = vc.assumptions.concat([negate(vc.goal)]);
    const out = Linear.check(literals);

    if (!out.ok) {
      return { name: vc.name, kind: vc.kind, discharged: true,
        goal: showCondition(vc.goal), why: out.why || 'the negation is unsatisfiable',
        stages: out.stages };
    }
    /* A counter-example with a fraction in it is a refutation over the
       RATIONALS and not over the integers, and the difference is the whole
       gap between this solver and an integer one. `i < n` implies
       `i + 1 <= n` for integers and not for rationals, so a perfectly valid
       loop invariant fails here with n = 0.5. Reporting the counter-example
       as non-integral is the honest form: the VC is not discharged, and the
       reason is the theory rather than the program. */
    const witness = out.integral && !out.integral.integral
      ? integerWitness(vc, out.model) : null;

    return { name: vc.name, kind: vc.kind, discharged: false,
      goal: showCondition(vc.goal), model: out.model,
      integral: out.integral, witness: witness,
      rationalOnly: Boolean(out.integral && !out.integral.integral && !witness),
      why: whyFailed(out, witness) };
  }

  function whyFailed(out, witness) {
    if (witness) {
      return 'a state satisfying the assumptions makes the goal false, and rounding the '
        + 'counter-example gives an integer one';
    }
    if (out.integral && !out.integral.integral) {
      return 'the only counter-example found is fractional (' +
        out.integral.fractional.join(', ') + ') and no rounding of it refutes the goal, so the '
        + 'goal may well hold over the integers';
    }
    return 'a state satisfying the assumptions makes the goal false';
  }

  function verify(program) {
    const generated = generate(program);
    const rows = generated.vcs.map(discharge);

    return { vcs: rows, total: rows.length,
      discharged: rows.filter(function (row) { return row.discharged; }).length,
      failed: rows.filter(function (row) { return !row.discharged; }),
      rationalOnly: rows.filter(function (row) { return row.rationalOnly; }).length,
      genuine: rows.filter(function (row) {
        return !row.discharged && !row.rationalOnly;
      }),
      paths: generated.paths,
      verified: rows.every(function (row) { return row.discharged; }) };
  }

  return { OPPOSITE: OPPOSITE, affine: affine, variable: variable, number: number,
    plus: plus, minus: minus, times: times, substitute: substitute, show: show,
    condition: condition, negate: negate, substituteIn: substituteIn,
    valueAt: valueAt, holdsAt: holdsAt, integerWitness: integerWitness,
    showCondition: showCondition, wp: wp, generate: generate, discharge: discharge,
    verify: verify };
}));

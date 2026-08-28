/**
 * Linear real arithmetic, decided by Fourier–Motzkin elimination.
 *
 * The procedure is one idea repeated. To decide whether a set of linear
 * inequalities has a solution, pick a variable and eliminate it: every
 * constraint that bounds it from below is paired with every constraint that
 * bounds it from above, and each pair yields a new constraint on the remaining
 * variables saying "the lower bound does not exceed the upper bound". The
 * variable is gone and the system is equisatisfiable. Repeat until no
 * variables remain, and what is left is a set of constant inequalities that
 * either all hold or do not.
 *
 * This is a genuine decision procedure over the RATIONALS, which matters for
 * how its answers should be read. An UNSAT answer is a proof: no real
 * assignment exists, so no integer one does either. A SAT answer is a rational
 * model and may have no integer counterpart — `2x = 1` is satisfiable over the
 * rationals and not over the integers — so the model is checked and reported
 * with its denominators rather than silently rounded.
 *
 * The cost is that pairing lower with upper bounds squares the constraint
 * count at each elimination, so the system can grow doubly exponentially. That
 * is why nobody uses Fourier–Motzkin on large problems and why it is exactly
 * right here: the verification conditions in 32.8 have a handful of variables,
 * and a procedure whose answer is a derivation beats one whose answer is a
 * search over a box.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.Berugo = root.Berugo || {};
    root.Berugo.TheoryLinear = api;
  }
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const NAME = 'linear';
  const EPSILON = 1e-9;

  /**
   * A constraint is `sum(coefficient · variable) + constant <= 0`, which is
   * the one shape everything is normalised to. `<`, `>=` and `>` are rewritten
   * into it, and equality becomes two constraints, so the elimination has a
   * single case to handle rather than six.
   */
  function constraint(terms, constant, strict) {
    return { terms: Object.assign({}, terms), constant: constant,
      strict: Boolean(strict) };
  }

  function fromRelation(left, right, operator) {
    const terms = {};

    Object.keys(left.terms || {}).forEach(function (name) {
      terms[name] = (terms[name] || 0) + left.terms[name];
    });
    Object.keys(right.terms || {}).forEach(function (name) {
      terms[name] = (terms[name] || 0) - right.terms[name];
    });
    return orient(terms, (left.constant || 0) - (right.constant || 0), operator);
  }

  function orient(terms, constant, operator) {
    if (operator === 'le') return [constraint(terms, constant, false)];
    if (operator === 'lt') return [constraint(terms, constant, true)];
    if (operator === 'ge') return [constraint(negateTerms(terms), -constant, false)];
    if (operator === 'gt') return [constraint(negateTerms(terms), -constant, true)];
    if (operator === 'eq') {
      return [constraint(terms, constant, false),
        constraint(negateTerms(terms), -constant, false)];
    }
    return [];
  }

  function negateTerms(terms) {
    const out = {};

    Object.keys(terms).forEach(function (name) { out[name] = -terms[name]; });
    return out;
  }

  function variablesOf(rows) {
    const seen = {};

    rows.forEach(function (row) {
      Object.keys(row.terms).forEach(function (name) {
        if (Math.abs(row.terms[name]) > EPSILON) seen[name] = true;
      });
    });
    return Object.keys(seen).sort();
  }

  /* ------------------------------------------------------- the elimination */

  /**
   * Eliminate one variable. Constraints where its coefficient is zero pass
   * through; the rest are split by sign and combined pairwise. The combination
   * is strict when either parent is, which is the only place the difference
   * between `<` and `<=` has to be tracked.
   */
  function eliminate(rows, name) {
    const free = [];
    const lower = [];
    const upper = [];

    rows.forEach(function (row) {
      const coefficient = row.terms[name] || 0;

      if (Math.abs(coefficient) <= EPSILON) { free.push(row); return; }
      if (coefficient > 0) upper.push(normalise(row, name, coefficient));
      else lower.push(normalise(row, name, -coefficient));
    });
    return free.concat(pairs(lower, upper, name));
  }

  /** Scale so the coefficient of the eliminated variable is exactly ±1. */
  function normalise(row, name, magnitude) {
    const terms = {};

    Object.keys(row.terms).forEach(function (key) {
      terms[key] = row.terms[key] / magnitude;
    });
    return { terms: terms, constant: row.constant / magnitude, strict: row.strict };
  }

  function pairs(lower, upper, name) {
    const out = [];

    lower.forEach(function (low) {
      upper.forEach(function (high) {
        out.push(combine(low, high, name));
      });
    });
    return out;
  }

  function combine(low, high, name) {
    const terms = {};

    Object.keys(low.terms).concat(Object.keys(high.terms)).forEach(function (key) {
      if (key === name) return;
      terms[key] = (low.terms[key] || 0) + (high.terms[key] || 0);
      if (Math.abs(terms[key]) <= EPSILON) delete terms[key];
    });
    return { terms: terms, constant: low.constant + high.constant,
      strict: low.strict || high.strict };
  }

  /** With no variables left, a constraint is a number and either holds or does not. */
  function residual(rows) {
    for (let at = 0; at < rows.length; at += 1) {
      const row = rows[at];
      const holds = row.strict ? row.constant < -EPSILON : row.constant <= EPSILON;

      if (!holds) return { ok: false, at: at, constant: row.constant, strict: row.strict };
    }
    return { ok: true };
  }

  /* ---------------------------------------------------------- the decision */

  function decide(literals) {
    const rows = literals.reduce(function (into, row) {
      return into.concat(fromRelation(row.left, row.right, row.operator || 'le'));
    }, []);
    const names = variablesOf(rows);
    const stages = [{ variable: null, constraints: rows.length }];
    let current = rows;

    for (let at = 0; at < names.length; at += 1) {
      current = eliminate(current, names[at]);
      stages.push({ variable: names[at], constraints: current.length });
      if (current.length > 4000) {
        return { verdict: 'unknown', stages: stages,
          why: 'the elimination grew past 4 000 constraints' };
      }
    }
    return finish(rows, names, stages, residual(current));
  }

  function finish(rows, names, stages, verdict) {
    if (!verdict.ok) {
      return { verdict: 'unsat', stages: stages, at: verdict.at,
        why: 'eliminating every variable leaves ' + verdict.constant +
          (verdict.strict ? ' < 0' : ' <= 0') + ', which is false' };
    }
    return { verdict: 'sat', stages: stages, model: buildModel(rows, names) };
  }

  /**
   * Back-substitution: eliminate down to nothing, then choose a value for each
   * variable in reverse order, from the tightest bounds the remaining
   * constraints allow. A strict bound is met by stepping half a unit inside
   * it, which is why the model can carry halves and why an integer program
   * needs the integrality check below rather than a rounding.
   */
  function buildModel(rows, names) {
    const model = {};
    const stack = [rows];

    names.forEach(function (name, at) { stack.push(eliminate(stack[at], name)); });
    for (let at = names.length - 1; at >= 0; at -= 1) {
      model[names[at]] = chooseValue(stack[at], names[at], model);
    }
    return model;
  }

  function chooseValue(rows, name, model) {
    let low = -Infinity;
    let high = Infinity;

    rows.forEach(function (row) {
      const coefficient = row.terms[name] || 0;

      if (Math.abs(coefficient) <= EPSILON) return;
      const rest = residualValue(row, name, model);
      const bound = -rest / coefficient;

      if (coefficient > 0) high = Math.min(high, row.strict ? bound - 0.5 : bound);
      else low = Math.max(low, row.strict ? bound + 0.5 : bound);
    });
    return pickBetween(low, high);
  }

  function residualValue(row, name, model) {
    let total = row.constant;

    Object.keys(row.terms).forEach(function (key) {
      if (key === name) return;
      total += row.terms[key] * (model[key] === undefined ? 0 : model[key]);
    });
    return total;
  }

  function pickBetween(low, high) {
    if (low === -Infinity && high === Infinity) return 0;
    if (low === -Infinity) return Math.min(0, high);
    if (high === Infinity) return Math.max(0, low);
    return (low + high) / 2;
  }

  /**
   * The independent check, which is what makes a SAT answer worth anything:
   * substitute and evaluate, sharing no code with the elimination.
   */
  function checkModel(literals, model) {
    for (let at = 0; at < literals.length; at += 1) {
      const row = literals[at];
      const left = evaluate(row.left, model);
      const right = evaluate(row.right, model);

      if (!compare(left, right, row.operator || 'le')) {
        return { ok: false, at: at,
          why: 'constraint ' + at + ' fails at ' + left + ' vs ' + right };
      }
    }
    return { ok: true, checked: literals.length };
  }

  function evaluate(side, model) {
    let total = side.constant || 0;

    Object.keys(side.terms || {}).forEach(function (name) {
      total += side.terms[name] * (model[name] === undefined ? 0 : model[name]);
    });
    return total;
  }

  function compare(left, right, operator) {
    if (operator === 'le') return left <= right + EPSILON;
    if (operator === 'lt') return left < right - EPSILON;
    if (operator === 'ge') return left >= right - EPSILON;
    if (operator === 'gt') return left > right + EPSILON;
    return Math.abs(left - right) <= EPSILON;
  }

  /** A rational model is not an integer model, and the difference is reported. */
  function integral(model) {
    const fractional = Object.keys(model || {}).filter(function (name) {
      return Math.abs(model[name] - Math.round(model[name])) > EPSILON;
    });

    return { integral: fractional.length === 0, fractional: fractional };
  }

  function check(literals) {
    const out = decide(literals);

    if (out.verdict !== 'sat') {
      return { ok: false, theory: NAME, verdict: out.verdict, why: out.why,
        stages: out.stages, explanation: literals };
    }
    return { ok: true, theory: NAME, model: out.model, stages: out.stages,
      integral: integral(out.model) };
  }

  return { NAME: NAME, EPSILON: EPSILON, constraint: constraint,
    fromRelation: fromRelation, variablesOf: variablesOf, eliminate: eliminate,
    decide: decide, check: check, checkModel: checkModel, integral: integral };
}));

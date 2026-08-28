/**
 * The two checkers, and why they are a separate file.
 *
 * A solver that answers SAT and a solver that answers UNSAT are believable for
 * completely different reasons, and neither reason is "the solver said so".
 *
 * **SAT is cheap to check and there is no excuse for not doing it.** A model
 * is an assignment; a formula is satisfied when every clause contains a
 * satisfied literal. That is one pass, it shares no code with the search, and
 * it turns a claim into a verified fact.
 *
 * **UNSAT is the hard one, and it is where solver bugs hide.** "I searched
 * everywhere and found nothing" is exactly what a solver with a broken
 * conflict analysis says: it learns a clause the formula does not imply,
 * prunes away the satisfying assignment, and reports UNSAT with confidence.
 * The remedy the SAT community settled on is a proof: every learned clause is
 * logged, and a checker with no search in it verifies that each one is a
 * REVERSE UNIT PROPAGATION consequence of the clauses before it — assume the
 * clause is false, propagate, and require a conflict. The last clause is
 * empty, so the derivation ends at a contradiction from the original formula.
 *
 * The checker is deliberately naive. It propagates by scanning every clause,
 * which is quadratic and correct, and it is the only thing in the milestone
 * allowed to say a formula is unsatisfiable.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.Berugo = root.Berugo || {};
    root.Berugo.SatCheck = api;
  }
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  /** A DIMACS literal is satisfied when the model agrees with its sign. */
  function satisfied(literal, model) {
    const index = Math.abs(literal) - 1;
    const assigned = model[index];

    if (assigned === undefined) return false;
    return literal > 0 ? Boolean(assigned) : !assigned;
  }

  /**
   * Check a model against the formula, clause by clause, and name the first
   * clause it fails. Returning the clause rather than a boolean is the
   * difference between a test that says "wrong" and one that says where.
   */
  function checkModel(formula, model) {
    if (!model) return { ok: false, why: 'no model was produced' };
    for (let at = 0; at < formula.clauses.length; at += 1) {
      const clause = formula.clauses[at];
      const held = clause.some(function (literal) { return satisfied(literal, model); });

      if (!held) {
        return { ok: false, at: at, clause: clause,
          why: 'clause ' + at + ' has no satisfied literal under the model' };
      }
    }
    return { ok: true, checked: formula.clauses.length };
  }

  /* -------------------------------------------------------- unit propagation */

  /**
   * Propagate to a fixed point over a clause list under an assignment, by
   * scanning. No watches, no incrementality: this is the reference
   * implementation the solver's clever version has to agree with.
   */
  function propagate(clauses, assignment) {
    let changed = true;

    while (changed) {
      changed = false;
      for (let at = 0; at < clauses.length; at += 1) {
        const outcome = inspect(clauses[at], assignment);

        if (outcome.satisfied) continue;
        if (outcome.unassigned.length === 0) return { conflict: true, at: at };
        if (outcome.unassigned.length > 1) continue;
        assign(assignment, outcome.unassigned[0]);
        changed = true;
      }
    }
    return { conflict: false };
  }

  function inspect(clause, assignment) {
    const unassigned = [];
    let sat = false;

    clause.forEach(function (literal) {
      const value = assignment[Math.abs(literal) - 1];

      if (value === undefined) { unassigned.push(literal); return; }
      if (satisfied(literal, assignment)) sat = true;
    });
    return { satisfied: sat, unassigned: unassigned };
  }

  function assign(assignment, literal) {
    assignment[Math.abs(literal) - 1] = literal > 0;
  }

  /* ----------------------------------------------------------- DRAT checking */

  /**
   * Verify a proof clause by clause. Each one must be a reverse unit
   * propagation consequence: assume every literal false, propagate over the
   * clauses accumulated so far, and require a conflict. If one does not
   * follow, the proof is rejected and the index is reported — which is the
   * information a solver bug needs, because the first bad clause names the
   * conflict analysis that produced it.
   */
  function checkProof(formula, proof) {
    const accumulated = formula.clauses.map(function (row) { return row.slice(); });
    let checked = 0;

    for (let at = 0; at < proof.length; at += 1) {
      const clause = proof[at];
      const assignment = [];

      clause.forEach(function (literal) { assign(assignment, -literal); });
      const outcome = propagate(accumulated, assignment);

      if (!outcome.conflict) {
        return { ok: false, at: at, clause: clause, checked: checked,
          why: 'clause ' + at + ' is not implied by the clauses before it' };
      }
      accumulated.push(clause.slice());
      checked += 1;
      if (clause.length === 0) {
        return { ok: true, checked: checked, empty: true,
          why: 'the empty clause was derived, so the formula is unsatisfiable' };
      }
    }
    return { ok: false, checked: checked,
      why: 'the proof never derives the empty clause' };
  }

  /* ------------------------------------------------------ the brute oracle */

  /**
   * Every assignment, tried. Exponential and therefore useless above about
   * twenty variables, which is exactly why it is the right oracle for the
   * small instances: it settles satisfiability with no algorithm in it that
   * could be wrong in the same way the solver is.
   */
  function bruteForce(formula, limit) {
    const variables = formula.variables;

    if (variables > (limit || 20)) return { verdict: 'skipped', variables: variables };
    const total = Math.pow(2, variables);

    for (let mask = 0; mask < total; mask += 1) {
      const model = [];

      for (let at = 0; at < variables; at += 1) model.push(Boolean((mask >> at) & 1));
      if (checkModel(formula, model).ok) {
        return { verdict: 'sat', model: model, tried: mask + 1 };
      }
    }
    return { verdict: 'unsat', tried: total };
  }

  /** How many assignments satisfy the formula — the strictest oracle there is. */
  function countModels(formula, limit) {
    const variables = formula.variables;

    if (variables > (limit || 18)) return null;
    const total = Math.pow(2, variables);
    let count = 0;

    for (let mask = 0; mask < total; mask += 1) {
      const model = [];

      for (let at = 0; at < variables; at += 1) model.push(Boolean((mask >> at) & 1));
      if (checkModel(formula, model).ok) count += 1;
    }
    return count;
  }

  return { satisfied: satisfied, checkModel: checkModel, propagate: propagate,
    checkProof: checkProof, bruteForce: bruteForce, countModels: countModels };
}));

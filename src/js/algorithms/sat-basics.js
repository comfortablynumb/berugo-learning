/**
 * CNF, DPLL, and the polynomial islands inside an NP-complete problem.
 *
 * SAT is the reference NP-complete problem, and the useful engineering fact
 * about it is not the hardness result: it is that three large, common
 * fragments are solvable in linear or near-linear time, and a great deal of
 * real configuration logic lands inside them without anybody noticing.
 *
 *   - HORN-SAT: at most one positive literal per clause. Unit propagation
 *     alone decides it, in time linear in the formula. "Package A requires B
 *     and C" is the Horn clause (¬A ∨ B) ∧ (¬A ∨ C), which is why dependency
 *     resolution over pure requirements is fast and why adding a single
 *     "either X or Y" conflict clause changes the complexity class.
 *   - 2-SAT: two literals per clause, decided by strongly connected
 *     components of the implication graph (M14 builds that one).
 *   - XOR-SAT: parity constraints, decided by Gaussian elimination over GF(2).
 *
 * `dpll` is the classic backtracking search with unit propagation and the pure
 * literal rule, instrumented with decision, propagation and conflict counters
 * so the demos can price an encoding rather than time it. It is deliberately
 * *not* a modern CDCL solver: no clause learning, no watched literals, no
 * restarts. Those belong in M32, and the point here is that the difference
 * between this and a real solver is several orders of magnitude on structured
 * instances and almost nothing on random ones at the phase transition.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SatBasics = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const UNASSIGNED = 0;

  /* --------------------------------------------------------------- shapes */

  function createFormula(variables, clauses) {
    return { variables: variables, clauses: clauses.map(function (clause) {
      return clause.slice();
    }) };
  }

  function literalValue(literal, assignment) {
    const value = assignment[Math.abs(literal) - 1];
    if (value === UNASSIGNED) return UNASSIGNED;
    return (literal > 0) === (value === 1) ? 1 : -1;
  }

  /** Satisfied, falsified, or neither - and how many literals are still open. */
  function clauseState(clause, assignment) {
    let open = 0;
    let last = 0;

    for (let i = 0; i < clause.length; i += 1) {
      const value = literalValue(clause[i], assignment);
      if (value === 1) return { status: 'satisfied', open: 0, unit: 0 };
      if (value === UNASSIGNED) { open += 1; last = clause[i]; }
    }
    if (open === 0) return { status: 'falsified', open: 0, unit: 0 };
    return { status: open === 1 ? 'unit' : 'open', open: open, unit: last };
  }

  function countSatisfied(formula, assignment) {
    let count = 0;
    for (let c = 0; c < formula.clauses.length; c += 1) {
      if (clauseState(formula.clauses[c], assignment).status === 'satisfied') count += 1;
    }
    return count;
  }

  /** A boolean array becomes the ±1 array everything else here speaks. */
  function fromBooleans(values) {
    return values.map(function (value) { return value ? 1 : -1; });
  }

  function toBooleans(assignment) {
    return assignment.map(function (value) { return value === 1; });
  }

  /* ----------------------------------------------------------------- DPLL */

  function newStats() {
    return { decisions: 0, propagations: 0, conflicts: 0, pureLiterals: 0, nodes: 0 };
  }

  /**
   * Unit propagation: while some clause has exactly one open literal, that
   * literal is forced. Returns false on a conflict, and records every
   * assignment it made so the caller can undo them on backtrack.
   */
  function propagate(formula, assignment, trail, stats) {
    let moved = true;

    while (moved) {
      moved = false;
      for (let c = 0; c < formula.clauses.length; c += 1) {
        const state = clauseState(formula.clauses[c], assignment);
        if (state.status === 'falsified') { stats.conflicts += 1; return false; }
        if (state.status !== 'unit') continue;
        assign(state.unit, assignment, trail);
        stats.propagations += 1;
        moved = true;
      }
    }
    return true;
  }

  function assign(literal, assignment, trail) {
    assignment[Math.abs(literal) - 1] = literal > 0 ? 1 : -1;
    trail.push(Math.abs(literal) - 1);
  }

  function undoTo(assignment, trail, mark) {
    while (trail.length > mark) assignment[trail.pop()] = UNASSIGNED;
  }

  /**
   * A literal appearing in only one polarity across the surviving clauses can
   * be set that way with no loss: it can only help. Cheap, and it is what
   * makes DPLL fast on the highly polarised formulas that encodings produce.
   */
  function pureLiterals(formula, assignment) {
    const seen = new Map();

    formula.clauses.forEach(function (clause) {
      if (clauseState(clause, assignment).status === 'satisfied') return;
      clause.forEach(function (literal) {
        if (literalValue(literal, assignment) !== UNASSIGNED) return;
        const v = Math.abs(literal);
        const sign = literal > 0 ? 1 : -1;
        if (!seen.has(v)) { seen.set(v, sign); return; }
        if (seen.get(v) !== sign) seen.set(v, 0);
      });
    });
    const out = [];
    seen.forEach(function (sign, v) { if (sign !== 0) out.push(sign * v); });
    return out;
  }

  function firstUnassigned(assignment) {
    for (let i = 0; i < assignment.length; i += 1) {
      if (assignment[i] === UNASSIGNED) return i + 1;
    }
    return 0;
  }

  /**
   * DPLL with unit propagation and the pure literal rule. `budget` caps the
   * node count so a demo cannot hang; a run that exhausts it reports
   * `exhausted` rather than returning "unsatisfiable", because those are
   * completely different claims and conflating them is the classic way a
   * search tool starts lying.
   */
  function dpll(formula, options) {
    const settings = options || {};
    const stats = newStats();
    const assignment = new Array(formula.variables).fill(UNASSIGNED);
    const budget = settings.budget === undefined ? 200000 : settings.budget;
    const usePure = settings.pureLiteral !== false;
    const result = search(formula, assignment, stats, { budget: budget, pure: usePure });

    return { satisfiable: result === true, exhausted: result === 'exhausted',
      assignment: result === true ? assignment.slice() : null, stats: stats,
      clauses: formula.clauses.length, variables: formula.variables };
  }

  function search(formula, assignment, stats, control) {
    if (stats.nodes >= control.budget) return 'exhausted';
    stats.nodes += 1;
    const trail = [];

    if (!propagate(formula, assignment, trail, stats)) { undoTo(assignment, trail, 0); return false; }
    if (control.pure) {
      pureLiterals(formula, assignment).forEach(function (literal) {
        if (literalValue(literal, assignment) !== UNASSIGNED) return;
        assign(literal, assignment, trail);
        stats.pureLiterals += 1;
      });
    }
    const variable = firstUnassigned(assignment);
    if (variable === 0) {
      if (countSatisfied(formula, assignment) === formula.clauses.length) return true;
      undoTo(assignment, trail, 0);
      return false;
    }
    const outcome = branch(formula, assignment, stats, { control: control, variable: variable });
    if (outcome !== true) undoTo(assignment, trail, 0);
    return outcome;
  }

  function branch(formula, assignment, stats, context) {
    const variable = context.variable;

    for (let sign = 1; sign >= -1; sign -= 2) {
      const mark = [];
      assign(sign * variable, assignment, mark);
      stats.decisions += 1;
      const outcome = search(formula, assignment, stats, context.control);
      if (outcome === true) return true;
      undoTo(assignment, mark, 0);
      if (outcome === 'exhausted') return 'exhausted';
    }
    return false;
  }

  /* ------------------------------------------------------------- Horn-SAT */

  function isHorn(formula) {
    for (let c = 0; c < formula.clauses.length; c += 1) {
      let positives = 0;
      for (let i = 0; i < formula.clauses[c].length; i += 1) {
        if (formula.clauses[c][i] > 0) positives += 1;
      }
      if (positives > 1) return false;
    }
    return true;
  }

  /**
   * Horn-SAT by unit propagation alone: start with everything false, and
   * whenever a clause is falsified with a single positive literal open, set
   * that literal true. If a clause with no positive literal is falsified, the
   * formula is unsatisfiable. The result is the *minimal* model, which is what
   * a dependency resolver wants - the smallest set of packages that satisfies
   * every requirement.
   */
  function hornSat(formula) {
    const assignment = new Array(formula.variables).fill(-1);
    let steps = 0;
    let moved = true;

    while (moved) {
      moved = false;
      for (let c = 0; c < formula.clauses.length; c += 1) {
        steps += 1;
        const clause = formula.clauses[c];
        if (clauseState(clause, assignment).status === 'satisfied') continue;
        const positive = clause.filter(function (literal) { return literal > 0; });
        if (positive.length === 0) {
          return { satisfiable: false, assignment: null, steps: steps,
            conflictClause: c, minimal: true };
        }
        assignment[positive[0] - 1] = 1;
        moved = true;
      }
    }
    return { satisfiable: true, assignment: assignment.slice(), steps: steps,
      conflictClause: -1, minimal: true,
      trueCount: assignment.filter(function (v) { return v === 1; }).length };
  }

  /* ------------------------------------------------------------ the oracle */

  /** Every assignment, for checking everything else. 2ⁿ, so n stays small. */
  function bruteForce(formula) {
    const total = Math.pow(2, formula.variables);
    let examined = 0;

    for (let mask = 0; mask < total; mask += 1) {
      examined += 1;
      const assignment = new Array(formula.variables);
      for (let v = 0; v < formula.variables; v += 1) {
        assignment[v] = ((mask >>> v) & 1) ? 1 : -1;
      }
      if (countSatisfied(formula, assignment) === formula.clauses.length) {
        return { satisfiable: true, assignment: assignment, examined: examined, total: total };
      }
    }
    return { satisfiable: false, assignment: null, examined: examined, total: total };
  }

  /** The best assignment by satisfied-clause count - MAX-SAT by enumeration. */
  function bruteForceMax(formula) {
    const total = Math.pow(2, formula.variables);
    let best = -1;
    let bestAssignment = null;

    for (let mask = 0; mask < total; mask += 1) {
      const assignment = new Array(formula.variables);
      for (let v = 0; v < formula.variables; v += 1) {
        assignment[v] = ((mask >>> v) & 1) ? 1 : -1;
      }
      const satisfied = countSatisfied(formula, assignment);
      if (satisfied > best) { best = satisfied; bestAssignment = assignment; }
    }
    return { satisfied: best, assignment: bestAssignment, total: total };
  }

  /* ----------------------------------------------------------- conversions */

  /**
   * A clause of any width becomes a chain of 3-clauses linked by fresh
   * variables, which is the reduction that makes 3-SAT the standard hard
   * problem rather than SAT itself. Satisfiability is preserved exactly and
   * the size grows linearly.
   */
  function toThreeCnf(formula) {
    const clauses = [];
    let next = formula.variables;

    formula.clauses.forEach(function (clause) {
      if (clause.length <= 3) { clauses.push(clause.slice()); return; }
      let rest = clause.slice();
      while (rest.length > 3) {
        next += 1;
        clauses.push([rest[0], rest[1], next]);
        rest = [-next].concat(rest.slice(2));
      }
      clauses.push(rest);
    });
    return { formula: createFormula(next, clauses), added: next - formula.variables };
  }

  return {
    UNASSIGNED: UNASSIGNED, createFormula: createFormula,
    literalValue: literalValue, clauseState: clauseState, countSatisfied: countSatisfied,
    fromBooleans: fromBooleans, toBooleans: toBooleans,
    dpll: dpll, propagate: propagate, pureLiterals: pureLiterals, newStats: newStats,
    isHorn: isHorn, hornSat: hornSat,
    bruteForce: bruteForce, bruteForceMax: bruteForceMax, toThreeCnf: toThreeCnf
  };
}));

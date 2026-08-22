/**
 * 2-SAT: clauses as implications, satisfiability by strongly connected
 * components, and the assignment read straight off the condensation order.
 *
 * Every clause (a OR b) is two implications, `not a -> b` and `not b -> a`, so
 * a 2-CNF formula IS a directed graph on 2n literals. The formula is
 * unsatisfiable exactly when some variable shares a component with its own
 * negation - because then x implies not x and not x implies x - and when it is
 * satisfiable, taking each variable true iff its component comes *later* in
 * the condensation order gives a model.
 *
 * **The boundary is the interesting part.** 3-SAT is NP-complete and this is
 * linear, and the whole difference is that a two-literal clause has a
 * contrapositive that is again a two-literal clause. A three-literal clause
 * does not, so no implication graph captures it, and that is the cleanest
 * available intuition for where hardness begins.
 *
 * Literals are encoded as `2v` for x and `2v + 1` for not-x, so negation is
 * `literal ^ 1`.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.TwoSat = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  function modules() {
    if (typeof module !== 'undefined' && module.exports) {
      return { Core: require('./graph-core.js'), Scc: require('./scc.js') };
    }
    return { Core: scope.GraphCore, Scc: scope.Scc };
  }

  function emptyReport() {
    return { variables: 0, clauses: 0, implications: 0, components: 0,
      contradictions: 0, forcedTrue: 0, forcedFalse: 0 };
  }

  /** x is `2v`, not-x is `2v + 1`. */
  function literal(variable, positive) {
    return 2 * variable + (positive ? 0 : 1);
  }

  function negate(lit) { return lit ^ 1; }

  function describeLiteral(lit, names) {
    const name = names && names[lit >> 1] ? names[lit >> 1] : 'x' + (lit >> 1);
    return (lit & 1) === 1 ? 'not ' + name : name;
  }

  /* ------------------------------------------------- the implication graph */

  /**
   * One clause becomes two arcs, and the pair is not optional: dropping the
   * contrapositive leaves a graph whose components no longer mean anything,
   * and the solver then reports satisfiable on unsatisfiable formulas.
   */
  function implicationGraph(variables, clauses, options) {
    const report = (options || {}).report || emptyReport();
    const edges = [];

    report.variables = variables;
    report.clauses = clauses.length;
    clauses.forEach(function (clause) {
      edges.push({ from: negate(clause[0]), to: clause[1], weight: 1 });
      edges.push({ from: negate(clause[1]), to: clause[0], weight: 1 });
    });
    report.implications = edges.length;
    return modules().Core.createGraph(2 * variables, edges,
      { directed: true, name: 'implications' });
  }

  /* -------------------------------------------------------------- solving */

  /**
   * Tarjan gives the components in reverse topological order, so a component
   * with a *higher* index comes earlier in that order. Setting x true when
   * component(x) is later than component(not x) therefore respects every
   * implication.
   */
  function solve(variables, clauses, options) {
    const M = modules();
    const report = (options || {}).report || emptyReport();
    const graph = implicationGraph(variables, clauses, { report: report });
    const run = M.Scc.tarjan(M.Core.adjacencyList(graph), {});

    report.components = run.components.length;
    const contradictions = [];

    for (let v = 0; v < variables; v += 1) {
      if (run.component[2 * v] !== run.component[2 * v + 1]) continue;
      contradictions.push(v);
    }
    report.contradictions = contradictions.length;

    if (contradictions.length > 0) {
      return { satisfiable: false, assignment: null, contradictions: contradictions,
        graph: graph, component: run.component, report: report };
    }
    const assignment = [];

    for (let v = 0; v < variables; v += 1) {
      const value = run.component[2 * v] < run.component[2 * v + 1];

      assignment.push(value);

      if (value) report.forcedTrue += 1;
      else report.forcedFalse += 1;
    }
    return { satisfiable: true, assignment: assignment, contradictions: [],
      graph: graph, component: run.component, report: report };
  }

  /** Which clause, if any, the assignment fails. A model that satisfies every
   *  clause but one is indistinguishable from a correct one without this. */
  function violatedClauses(clauses, assignment) {
    const holds = function (lit) {
      const value = assignment[lit >> 1];

      return (lit & 1) === 1 ? !value : value;
    };
    const out = [];

    clauses.forEach(function (clause, id) {
      if (holds(clause[0]) || holds(clause[1])) return;
      out.push(id);
    });
    return out;
  }

  /* ---------------------------------------------------------- the oracle */

  /** Every assignment, tried. Exponential, and the only check that owes
   *  nothing to the implication graph. */
  function solveByBruteForce(variables, clauses) {
    const total = Math.pow(2, variables);

    for (let mask = 0; mask < total; mask += 1) {
      const assignment = [];

      for (let v = 0; v < variables; v += 1) assignment.push(((mask >> v) & 1) === 1);

      if (violatedClauses(clauses, assignment).length > 0) continue;
      return { satisfiable: true, assignment: assignment };
    }
    return { satisfiable: false, assignment: null };
  }

  /* ------------------------------------------------- the modelling idioms */

  /** "at most one of these is true", as pairwise clauses. Quadratic in the
   *  group size, which is why large groups need a different encoding. */
  function atMostOne(literals) {
    const clauses = [];

    for (let i = 0; i < literals.length; i += 1) {
      for (let j = i + 1; j < literals.length; j += 1) {
        clauses.push([negate(literals[i]), negate(literals[j])]);
      }
    }
    return clauses;
  }

  /** "exactly one" is at-most-one plus at-least-one, and the second half is
   *  a single clause only when the group has two members. */
  function exactlyOne(literals) {
    if (literals.length === 2) return atMostOne(literals).concat([[literals[0], literals[1]]]);
    return atMostOne(literals);
  }

  /** A forced literal is the clause (l OR l): the implication graph gets
   *  `not l -> l`, which makes any component containing not-l contradictory. */
  function force(lit) {
    return [[lit, lit]];
  }

  /** "if a then b", which is the clause (not a OR b). */
  function implies(a, b) {
    return [[negate(a), b]];
  }

  /* --------------------------------------------------- a scheduling model */

  /**
   * `tasks` each choose one of two slots; `conflicts` are pairs that must not
   * share a slot. Variable v is "task v takes its first slot", which is the
   * encoding that makes the problem 2-SAT at all - three slots would need
   * three-literal clauses and the whole approach collapses.
   */
  function schedulingModel(tasks, conflicts) {
    const clauses = [];

    conflicts.forEach(function (pair) {
      const a = pair[0];
      const b = pair[1];

      if (pair.slot === undefined || pair.slot === 0) {
        clauses.push([negate(literal(a, true)), negate(literal(b, true))]);
      }

      if (pair.slot === undefined || pair.slot === 1) {
        clauses.push([literal(a, true), literal(b, true)]);
      }
    });
    return { variables: tasks, clauses: clauses };
  }

  return {
    emptyReport: emptyReport, literal: literal, negate: negate,
    describeLiteral: describeLiteral, implicationGraph: implicationGraph,
    solve: solve, violatedClauses: violatedClauses, solveByBruteForce: solveByBruteForce,
    atMostOne: atMostOne, exactlyOne: exactlyOne, force: force, implies: implies,
    schedulingModel: schedulingModel
  };
}));

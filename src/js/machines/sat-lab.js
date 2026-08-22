/**
 * SatLab - the harness for 2-SAT and the boundary it sits on.
 *
 * Two jobs. The first is ordinary: generate instances, solve them by the
 * implication graph, and check every answer against an exhaustive assignment
 * search, reporting disagreements as a field. The second is the section's
 * whole argument: measure what happens when the same machinery is pointed at
 * three-literal clauses.
 *
 * That measurement is the honest way to say "2-SAT is polynomial and 3-SAT is
 * NP-complete". A three-literal clause has no faithful implication encoding -
 * `not a` implies `b or c`, and a disjunction is not a vertex - so the only
 * thing an implication graph can do with it is drop a literal, which makes the
 * constraint strictly stronger. `relaxationRun` counts how often that lies.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SatLab = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  function modules() {
    if (typeof module !== 'undefined' && module.exports) {
      return {
        TwoSat: require('../algorithms/two-sat.js'),
        Scc: require('../algorithms/scc.js'),
        Core: require('../algorithms/graph-core.js'),
        Random: require('../utils/random.js')
      };
    }
    return { TwoSat: scope.TwoSat, Scc: scope.Scc, Core: scope.GraphCore, Random: scope.Random };
  }

  const MODELS = ['scheduling', 'random', 'forced', 'at-most-one'];

  /* ------------------------------------------------------------ generation */

  /**
   * Four instance families, each making a different modelling idiom visible.
   * `scheduling` is the two-slot assignment problem the reduction lab ships;
   * `random` is the family the satisfiability threshold is about; `forced`
   * pins two variables and lets the implications propagate; `at-most-one` is
   * the pairwise encoding that turns a cardinality constraint into clauses.
   */
  function build(spec) {
    const settings = spec || {};
    const model = settings.model || 'scheduling';
    const random = modules().Random.seeded(settings.seed === undefined ? 1 : settings.seed);
    const variables = settings.variables || 8;

    if (model === 'random') return randomInstance(variables, settings.clauses || 10, random);

    if (model === 'forced') return forcedInstance(variables, settings.clauses || 10, random);

    if (model === 'at-most-one') return atMostOneInstance(variables, settings.clauses || 10);
    return schedulingInstance(variables, settings.clauses || 10, random);
  }

  function randomClause(variables, random) {
    const T = modules().TwoSat;
    const a = random.int(variables);
    let b = random.int(variables);

    if (b === a) b = (a + 1) % variables;
    return [T.literal(a, random.int(2) === 0), T.literal(b, random.int(2) === 0)];
  }

  function randomInstance(variables, count, random) {
    const clauses = [];

    for (let i = 0; i < count; i += 1) clauses.push(randomClause(variables, random));
    return { variables: variables, clauses: clauses, names: null, model: 'random' };
  }

  /** Two variables pinned by unit clauses, so the propagation is visible. */
  function forcedInstance(variables, count, random) {
    const T = modules().TwoSat;
    const base = randomInstance(variables, count, random);
    const clauses = T.force(T.literal(0, true))
      .concat(T.force(T.literal(1, false)))
      .concat(base.clauses);

    return { variables: variables, clauses: clauses, names: null, model: 'forced' };
  }

  /** "At most one of the first four" as pairwise clauses, plus a demand that
   *  at least one of them hold - which is satisfiable, and stops being so as
   *  soon as the group grows past what two-literal clauses can express. */
  function atMostOneInstance(variables, count) {
    const T = modules().TwoSat;
    const group = [];

    for (let v = 0; v < Math.min(4, variables); v += 1) group.push(T.literal(v, true));
    const clauses = T.atMostOne(group).concat([[group[0], group[1]]]);

    for (let v = 4; v + 1 < variables && clauses.length < count + group.length; v += 1) {
      clauses.push(T.implies(T.literal(v, true), T.literal(v + 1, true))[0]);
    }
    return { variables: variables, clauses: clauses, names: null, model: 'at-most-one' };
  }

  /** Tasks choosing between two slots; a conflict forbids sharing one. */
  function schedulingInstance(tasks, conflicts, random) {
    const pairs = [];
    const seen = {};

    for (let i = 0; i < conflicts * 2 && pairs.length < conflicts; i += 1) {
      const a = random.int(tasks);
      const b = random.int(tasks);
      const key = Math.min(a, b) + '-' + Math.max(a, b);

      if (a === b || seen[key]) continue;
      seen[key] = true;
      pairs.push([a, b]);
    }
    const model = modules().TwoSat.schedulingModel(tasks, pairs);
    const names = [];

    for (let v = 0; v < tasks; v += 1) names.push('task ' + v + ' in slot A');
    return { variables: model.variables, clauses: model.clauses, names: names,
      conflicts: pairs, model: 'scheduling' };
  }

  /* ------------------------------------------------------------------ runs */

  /**
   * Solve, check against the exhaustive oracle, and check the assignment
   * against the clauses themselves. Three separate things: the graph can be
   * right and the read-out wrong, and a satisfiable verdict with a broken
   * assignment is the failure mode that looks most like success.
   */
  function solveRun(instance) {
    const T = modules().TwoSat;
    const run = T.solve(instance.variables, instance.clauses, {});
    const truth = instance.variables <= 20
      ? T.solveByBruteForce(instance.variables, instance.clauses) : null;
    const violated = run.satisfiable ? T.violatedClauses(instance.clauses, run.assignment) : [];

    return { run: run, truth: truth, violated: violated,
      agrees: truth === null ? null : truth.satisfiable === run.satisfiable,
      valid: run.satisfiable ? violated.length === 0 : true };
  }

  /** The component each literal landed in, and the rule that reads a value
   *  off it. Rendering this is the only way the SCC step stops being magic. */
  function assignmentTable(instance, state) {
    const T = modules().TwoSat;
    const rows = [];

    for (let v = 0; v < instance.variables; v += 1) {
      const positive = state.run.component[2 * v];
      const negative = state.run.component[2 * v + 1];

      rows.push({ variable: v,
        name: T.describeLiteral(T.literal(v, true), instance.names),
        positiveComponent: positive, negativeComponent: negative,
        contradictory: positive === negative,
        value: state.run.assignment === null ? null : state.run.assignment[v] });
    }
    return rows;
  }

  /** Each clause as the two implications it really is. */
  function implicationRows(instance) {
    const T = modules().TwoSat;
    const rows = [];

    instance.clauses.forEach(function (clause, id) {
      rows.push({ id: id,
        clause: '(' + T.describeLiteral(clause[0], instance.names) + ' or ' +
          T.describeLiteral(clause[1], instance.names) + ')',
        first: T.describeLiteral(T.negate(clause[0]), instance.names) + ' → ' +
          T.describeLiteral(clause[1], instance.names),
        second: T.describeLiteral(T.negate(clause[1]), instance.names) + ' → ' +
          T.describeLiteral(clause[0], instance.names) });
    });
    return rows;
  }

  /**
   * Agreement with the oracle over a family, since one instance proves
   * nothing. The unsatisfiable count is reported too: a run in which every
   * instance is satisfiable checks only half the solver.
   */
  function agreementSweep(options) {
    const settings = options || {};
    const trials = settings.trials || 200;
    let disagreements = 0;
    let unsatisfiable = 0;
    let broken = 0;

    for (let seed = 1; seed <= trials; seed += 1) {
      const instance = build({ model: settings.model || 'random',
        variables: settings.variables || 10, clauses: settings.clauses || 20, seed: seed });
      const state = solveRun(instance);

      if (!state.run.satisfiable) unsatisfiable += 1;

      if (state.agrees === false) disagreements += 1;

      if (!state.valid) broken += 1;
    }
    return { trials: trials, disagreements: disagreements,
      unsatisfiable: unsatisfiable, broken: broken };
  }

  /**
   * The satisfiability threshold: at m/n below about 1 almost every random
   * 2-SAT instance is satisfiable, and above it almost none are. The
   * transition sharpens as n grows, which is the phenomenon, and it is why
   * "we tested it on random instances" is a statement about the ratio rather
   * than about the solver.
   */
  function thresholdSweep(options) {
    const settings = options || {};
    const variables = settings.variables || 40;
    const trials = settings.trials || 60;

    return (settings.ratios || [0.4, 0.7, 0.9, 1.0, 1.1, 1.3, 1.6, 2.0]).map(function (ratio) {
      let satisfiable = 0;

      for (let seed = 1; seed <= trials; seed += 1) {
        const instance = build({ model: 'random', variables: variables,
          clauses: Math.round(ratio * variables), seed: seed * 31 });

        if (!modules().TwoSat.solve(instance.variables, instance.clauses, {}).satisfiable) continue;
        satisfiable += 1;
      }
      return { ratio: ratio, clauses: Math.round(ratio * variables),
        satisfiable: satisfiable, trials: trials, rate: satisfiable / trials };
    });
  }

  /* ----------------------------------------------- the three-literal wall */

  function randomThreeClause(variables, random) {
    const T = modules().TwoSat;
    const chosen = [];

    while (chosen.length < 3) {
      const v = random.int(variables);

      if (chosen.indexOf(v) !== -1) continue;
      chosen.push(v);
    }
    return chosen.map(function (v) { return T.literal(v, random.int(2) === 0); });
  }

  /** Every assignment, tried, on three-literal clauses. The only oracle that
   *  owes nothing to the implication graph. */
  function threeSatByBruteForce(variables, clauses) {
    const T = modules().TwoSat;
    const total = Math.pow(2, variables);

    for (let mask = 0; mask < total; mask += 1) {
      const assignment = [];

      for (let v = 0; v < variables; v += 1) assignment.push(((mask >> v) & 1) === 1);
      const holds = function (lit) {
        return (lit & 1) === 1 ? !assignment[lit >> 1] : assignment[lit >> 1];
      };
      const ok = clauses.every(function (clause) { return clause.some(holds); });

      if (!ok) continue;
      return { satisfiable: true, assignment: assignment, T: T };
    }
    return { satisfiable: false, assignment: null };
  }

  /**
   * Drop one literal from every three-clause and solve the result as 2-SAT.
   * The relaxation is strictly *stronger*, so "satisfiable" is always
   * trustworthy and "unsatisfiable" is not. Counting how often the second case
   * fires is the measured form of "the implication graph cannot represent a
   * three-literal clause".
   */
  function relaxationRun(options) {
    const settings = options || {};
    const T = modules().TwoSat;
    const variables = settings.variables || 12;
    const trials = settings.trials || 200;
    let wrongUnsat = 0;
    let bothSat = 0;
    let bothUnsat = 0;
    let falseSat = 0;

    for (let seed = 1; seed <= trials; seed += 1) {
      const random = modules().Random.seeded(seed * 7 + 1);
      const clauses = [];

      for (let i = 0; i < (settings.clauses || variables * 3); i += 1) {
        clauses.push(randomThreeClause(variables, random));
      }
      const truth = threeSatByBruteForce(variables, clauses);
      const relaxed = T.solve(variables, clauses.map(function (clause) {
        return [clause[0], clause[1]];
      }), {});

      if (relaxed.satisfiable && truth.satisfiable) bothSat += 1;
      else if (!relaxed.satisfiable && !truth.satisfiable) bothUnsat += 1;
      else if (!relaxed.satisfiable && truth.satisfiable) wrongUnsat += 1;
      else falseSat += 1;
    }
    return { trials: trials, variables: variables, wrongUnsat: wrongUnsat,
      bothSat: bothSat, bothUnsat: bothUnsat, falseSat: falseSat };
  }

  return {
    MODELS: MODELS, modules: modules, build: build,
    solveRun: solveRun, assignmentTable: assignmentTable, implicationRows: implicationRows,
    agreementSweep: agreementSweep, thresholdSweep: thresholdSweep,
    relaxationRun: relaxationRun, threeSatByBruteForce: threeSatByBruteForce
  };
}));

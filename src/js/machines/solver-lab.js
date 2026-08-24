/**
 * SolverLab — what an encoding costs, and whether the model says what you meant.
 *
 * Two studies that belong together because they are the two halves of "call a
 * solver instead of writing an algorithm".
 *
 * The first (20.7) prices encodings. The same constraint written three ways
 * produces formulas of wildly different size, and the difference is arithmetic
 * rather than opinion: pairwise at-most-one over two thousand literals is
 * 1 999 000 clauses and the sequential counter is 5 996. On top of that sits symmetry
 * breaking, which on an unsatisfiable colouring instance is worth more than
 * every other choice in the file put together — six unit clauses in place of
 * a thousand-node search.
 *
 * The second (20.9) checks the model against the requirement. A schedule the
 * solver returns is decoded and then run through a checker written from the
 * REQUIREMENTS rather than from the model, so an encoding that has drifted
 * fails visibly instead of producing a plausible roster. The study also
 * reports what the model does not say at all — the preferences a Boolean
 * formula has no way to express — because a solver answering YES is not the
 * same as a roster anybody would accept.
 *
 * One measurement here has to be reported carefully and it is stated in the
 * section too: the bundled solver is DPLL, not CDCL. It branches on the first
 * unassigned variable, so the *auxiliary* variables an encoding introduces sit
 * after every decision variable and never change the shape of its search. The
 * clause counts differ enormously; the node counts, on this solver, often do
 * not. That is a limitation of the solver rather than a fact about encodings,
 * and printing the node column without saying so would be the overclaim.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.SolverLab = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const Random = scope && scope.Random ? scope.Random : require('../utils/random.js');
  const Sat = scope && scope.SatBasics ? scope.SatBasics : require('../algorithms/sat-basics.js');
  const Encodings = scope && scope.Encodings ? scope.Encodings
    : require('../algorithms/encodings.js');
  const Rostering = scope && scope.Rostering ? scope.Rostering
    : require('../algorithms/rostering.js');
  const Verifiers = scope && scope.NpVerifiers ? scope.NpVerifiers
    : require('../algorithms/np-verifiers.js');
  const GraphCore = scope && scope.GraphCore ? scope.GraphCore
    : require('../algorithms/graph-core.js');

  /* ------------------------------------------------- 20.7 what it costs */

  /**
   * At-most-one over n literals, priced exactly. No solving — this is the
   * table that decides whether a model fits in memory at all, and it is the
   * one people skip because "it is only a constraint".
   */
  function atMostOneScaling(options) {
    const settings = options || {};
    const sizes = settings.sizes === undefined ? [5, 20, 100, 500, 2000] : settings.sizes;

    return { groupSize: settings.groupSize === undefined ? 3 : settings.groupSize,
      rows: sizes.map(function (n) {
        return { n: n, encodings: Encodings.AT_MOST_ONE.map(function (encoding) {
          return priceEncoding(n, encoding, settings);
        }) };
      }) };
  }

  function priceEncoding(n, encoding, settings) {
    const counter = { next: n };
    const literals = [];

    for (let i = 1; i <= n; i += 1) literals.push(i);
    const built = Encodings.atMostOne(literals, counter, { encoding: encoding,
      groupSize: settings.groupSize === undefined ? 3 : settings.groupSize });
    return { encoding: encoding, clauses: built.clauses.length, auxiliary: built.auxiliary,
      literalsWritten: built.clauses.reduce(function (sum, clause) {
        return sum + clause.length;
      }, 0) };
  }

  /**
   * A colouring instance with a planted clique, asked for one colour fewer
   * than it needs — so the answer is NO and the solver has to prove it. That
   * is the case symmetry breaking is for: on a YES instance the search finds
   * an answer before the symmetry costs anything.
   */
  function colouringInstance(options) {
    const settings = options || {};
    const n = settings.n === undefined ? 18 : settings.n;
    const clique = settings.clique === undefined ? 7 : settings.clique;
    const graph = GraphCore.randomGraph(n, settings.m === undefined ? 60 : settings.m,
      Random.seeded(settings.seed === undefined ? 5 : settings.seed));
    const seen = new Set(graph.edges.map(function (edge) {
      return Math.min(edge.from, edge.to) + '-' + Math.max(edge.from, edge.to);
    }));

    for (let i = 0; i < clique; i += 1) {
      for (let j = i + 1; j < clique; j += 1) {
        const key = i + '-' + j;
        if (seen.has(key)) continue;
        seen.add(key);
        graph.edges.push({ from: i, to: j, weight: 1 });
      }
    }
    graph.name = 'planted-K' + clique;
    return { graph: graph, clique: clique };
  }

  /**
   * The same instance under six models — three at-most-one encodings, each
   * with and without symmetry breaking — solved by the bundled DPLL. Every row
   * must agree on the answer; a row that does not is an encoding bug and the
   * study says so rather than reporting a faster time.
   */
  function encodingStudy(options) {
    const settings = options || {};
    const built = colouringInstance(settings);
    const colours = settings.colours === undefined ? built.clique - 1 : settings.colours;
    const direct = Verifiers.searchColouring(built.graph, colours);
    const compared = Encodings.compareEncodings(built.graph, colours,
      { budget: settings.budget === undefined ? 4000000 : settings.budget,
        groupSize: settings.groupSize });

    return { graph: built.graph, clique: built.clique, colours: colours,
      direct: { found: direct.found, steps: direct.steps },
      rows: compared.rows.map(function (row) {
        return Object.assign({}, row, { agreesWithDirect: row.satisfiable === direct.found });
      }),
      agreed: compared.agreed && compared.rows.every(function (row) {
        return row.satisfiable === direct.found;
      }),
      symmetryGain: symmetryGain(compared.rows) };
  }

  function symmetryGain(rows) {
    const plain = rows.filter(function (row) { return !row.symmetryBreaking; });
    const broken = rows.filter(function (row) { return row.symmetryBreaking; });
    const mean = function (list) {
      return list.reduce(function (sum, row) { return sum + row.nodes; }, 0) / list.length;
    };

    return { without: mean(plain), with: mean(broken), factor: mean(plain) / mean(broken) };
  }

  /** The colour count swept from far below the chromatic number to above it,
   *  so the cost of proving NO and the cost of finding YES sit in one table. */
  function colourSweep(options) {
    const settings = options || {};
    const built = colouringInstance(settings);
    const rows = [];

    for (let colours = settings.from === undefined ? 3 : settings.from;
      colours <= (settings.to === undefined ? built.clique + 1 : settings.to); colours += 1) {
      [false, true].forEach(function (symmetry) {
        const model = Encodings.colouringToCnf(built.graph, colours,
          { encoding: 'pairwise', symmetryBreaking: symmetry });
        const solved = Sat.dpll(model.formula, { budget: settings.budget === undefined
          ? 4000000 : settings.budget });
        rows.push({ colours: colours, symmetryBreaking: symmetry,
          clauses: model.formula.clauses.length, satisfiable: solved.satisfiable,
          exhausted: solved.exhausted, nodes: solved.stats.nodes,
          conflicts: solved.stats.conflicts });
      });
    }
    return { clique: built.clique, graph: built.graph, rows: rows };
  }

  /* ------------------------------------------- 20.9 the reduction workshop */

  /**
   * Model, solve, decode, and then check the answer against the requirements
   * one at a time. The `checks` array is the deliverable: a roster that
   * satisfies the formula but fails a check is an encoding defect, and it is
   * the only kind of defect that a solver cannot report.
   */
  function rosterStudy(options) {
    const settings = options || {};
    const spec = Rostering.scenario(settings);
    const model = Rostering.encode(spec, settings);
    const started = Date.now();
    const solved = Sat.dpll(model.formula, { budget: settings.budget === undefined
      ? 400000 : settings.budget });
    const millis = Date.now() - started;

    if (!solved.satisfiable) {
      return { spec: spec, model: model, solved: solved, millis: millis, schedule: null,
        validation: null, feasible: false,
        note: solved.exhausted
          ? 'the solver ran out of node budget — that is not a proof of infeasibility, and treating it as one is the mistake this section is about'
          : 'no roster satisfies every hard constraint; the model cannot say which one to relax' };
    }
    const schedule = Rostering.decode(spec, solved.assignment);
    return { spec: spec, model: model, solved: solved, millis: millis, schedule: schedule,
      validation: Rostering.validate(spec, schedule), feasible: true, note: null };
  }

  /**
   * The same scenario with one requirement deliberately tightened at a time,
   * so the boundary between feasible and infeasible is a measured column. The
   * point is not the boundary: it is that the solver reports UNSAT with no
   * indication of which requirement caused it, which is the practical reason
   * an infeasibility diagnosis has to be built rather than read off.
   */
  function feasibilityFrontier(options) {
    const settings = options || {};
    const rows = [];

    /* A shorter horizon than the main study on purpose: this table runs five
       models and two of them are unsatisfiable, so it is priced by the runs
       that have to EXHAUST rather than by the ones that answer. */
    const frontier = { days: settings.days === undefined ? 6 : settings.days,
      demand: settings.demand === undefined ? [2, 1, 1] : settings.demand,
      maxShifts: settings.maxShifts === undefined ? 4 : settings.maxShifts,
      restWindow: settings.restWindow === undefined ? 3 : settings.restWindow,
      budget: settings.budget === undefined ? 40000 : settings.budget };

    (settings.nurseCounts === undefined ? [4, 5, 6, 7, 8] : settings.nurseCounts)
      .forEach(function (nurses) {
        const study = rosterStudy(Object.assign({}, settings, frontier, { nurses: nurses }));
        rows.push({ nurses: nurses, clauses: study.model.clauses,
          variables: study.model.variables, feasible: study.feasible,
          exhausted: study.solved.exhausted, nodes: study.solved.stats.nodes,
          millis: study.millis, capacity: nurses * study.spec.maxShifts,
          required: study.spec.days * study.spec.demand.reduce(function (a, b) {
            return a + b;
          }, 0),
          valid: study.validation === null ? null : study.validation.satisfied });
      });
    return { rows: rows };
  }

  /**
   * The requirement written down twice, and where the two disagree. Every
   * hard constraint is listed with the clause count that carries it; every
   * preference is listed with the reason a clause cannot carry it, and with
   * the number the roster actually achieved on it — so "not modelled" comes
   * with evidence rather than an apology.
   */
  function modelGap(options) {
    const study = rosterStudy(options || {});

    if (!study.feasible) return { study: study, hard: [], soft: [], stats: null };
    const stats = study.validation.stats;
    return { study: study,
      hard: study.model.groups.map(function (group) {
        const check = study.validation.checks.find(function (item) {
          return item.id === group.id;
        });
        return { id: group.id, text: group.text, clauses: group.clauses.length,
          auxiliary: group.auxiliary, checked: Boolean(check),
          ok: check ? check.ok : null, failures: check ? check.failureCount : null };
      }),
      soft: study.spec.soft.map(function (item) {
        return Object.assign({}, item, { achieved: achievedFor(item.id, stats) });
      }), stats: stats };
  }

  function achievedFor(id, stats) {
    if (id === 'weekend-fairness') {
      return 'weekend shifts per nurse ' + stats.weekend.join(', ') + ' — a spread of ' +
        stats.weekendSpread;
    }
    if (id === 'shift-continuity') {
      return 'night shifts per nurse ' + stats.nights.join(', ') + ' — a spread of ' +
        stats.nightSpread;
    }
    return 'shifts per nurse ' + stats.perNurse.join(', ') + ' — a spread of ' +
      stats.workedSpread;
  }

  return {
    atMostOneScaling: atMostOneScaling, priceEncoding: priceEncoding,
    colouringInstance: colouringInstance, encodingStudy: encodingStudy,
    colourSweep: colourSweep,
    rosterStudy: rosterStudy, feasibilityFrontier: feasibilityFrontier, modelGap: modelGap
  };
}));

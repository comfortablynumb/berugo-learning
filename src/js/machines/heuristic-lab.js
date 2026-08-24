/**
 * HeuristicLab — the budgeted tournament, and the runtime distribution.
 *
 * Two questions, one file, because they are the same question asked twice.
 *
 * The tournament (20.6) runs every metaheuristic on ONE instance under ONE
 * evaluation budget and records best-so-far against evaluations spent. The
 * harness refuses a run whose methods were given different budgets — not
 * warns, refuses — because an unequal budget is the single defect that makes
 * a metaheuristic comparison meaningless, and it is invisible in the results
 * table where it happens.
 *
 * The runtime study (20.8) runs ONE method on MANY instances and looks at the
 * shape of the cost distribution rather than its mean. Combinatorial search
 * has heavy-tailed runtimes: the median finishes quickly and the ninety-ninth
 * percentile is orders of magnitude worse, so a mean is dominated by runs
 * nobody will wait for. Restarts are the fix, and the reason they work is
 * arithmetic rather than luck — cutting off at the point where the hazard rate
 * stops rising converts an unbounded tail into a geometric one.
 *
 * The phase transition sits between the two. Random 3-SAT is trivially
 * satisfiable at a low clause-to-variable ratio and trivially unsatisfiable at
 * a high one; at the crossover near 4.27 both the satisfiable fraction and the
 * solve cost do something abrupt. That is a property of the DISTRIBUTION and
 * not of any instance, so it needs many seeds per ratio and a median rather
 * than a single run.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.HeuristicLab = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const Random = scope && scope.Random ? scope.Random : require('../utils/random.js');
  const Meta = scope && scope.Metaheuristics ? scope.Metaheuristics
    : require('../algorithms/metaheuristics.js');
  const Approx = scope && scope.Approximation ? scope.Approximation
    : require('../algorithms/approximation.js');
  const ApproxLab = scope && scope.ApproxLab ? scope.ApproxLab : require('./approx-lab.js');
  const Sat = scope && scope.SatBasics ? scope.SatBasics : require('../algorithms/sat-basics.js');
  const Generators = scope && scope.InstanceGenerators ? scope.InstanceGenerators
    : require('../algorithms/instance-generators.js');

  const EXACT_LIMIT = 15;

  /* ---------------------------------------------------- 20.6 the tournament */

  function cityPoints(options) {
    const settings = options || {};
    const rng = Random.seeded(settings.seed === undefined ? 7 : settings.seed);
    const n = settings.cities === undefined ? 30 : settings.cities;
    const out = [];

    for (let i = 0; i < n; i += 1) out.push({ x: rng.next() * 100, y: rng.next() * 100 });
    return out;
  }

  /**
   * Every method, same instance, same budget, same starting seed. `methods`
   * selects a subset; the default is all eight. The optimum is computed when
   * the instance is small enough for Held-Karp and reported as `null` when it
   * is not — an "optimality gap" against a best-known value is a different
   * quantity and labelling it the same way is how the literature ends up with
   * ratios below one.
   */
  function tournament(options) {
    const settings = options || {};
    const points = settings.points || cityPoints(settings);
    const problem = Meta.tspProblem(points);
    const budget = settings.budget === undefined ? 40000 : settings.budget;
    const seed = settings.methodSeed === undefined ? 11 : settings.methodSeed;
    const names = settings.methods || Meta.NAMES;
    const runs = names.map(function (name) { return runMethod(name, problem, budget, seed); });
    const optimum = problem.n <= EXACT_LIMIT ? ApproxLab.exactTsp(problem.matrix) : null;

    return { problem: problem, points: points, budget: budget, runs: runs,
      optimum: optimum === null ? null : optimum.length,
      lowerBound: Approx.minimumSpanningTree(problem.matrix).weight,
      christofides: Approx.christofides(problem.matrix).length,
      fair: runs.every(function (run) { return run.offered === budget; }),
      best: Math.min.apply(null, runs.map(function (run) { return run.cost; })) };
  }

  function runMethod(name, problem, total, seed) {
    const budget = Meta.createBudget(total);
    const rng = Random.seeded(seed);
    const started = Date.now();
    const detail = dispatch(name, problem, budget, rng);
    const tour = budget.bestTour();

    return { name: name, cost: budget.best(), spent: budget.spent(), offered: total,
      curve: Meta.sealCurve(budget), tour: tour, detail: detail,
      millis: Date.now() - started, valid: isTour(tour, problem.n),
      converged: budget.spent() < total };
  }

  function dispatch(name, problem, budget, rng) {
    if (name === 'nearest-neighbour') return Meta.nearestNeighbour(problem, budget);
    if (name === 'two-opt') return Meta.twoOpt(problem, budget, seedTour(problem, budget));
    if (name === 'or-opt') return Meta.orOpt(problem, budget, seedTour(problem, budget));
    if (name === 'annealing') {
      return Meta.annealing(problem, budget, rng, { start: seedTour(problem, budget) });
    }
    if (name === 'tabu') {
      return Meta.tabuSearch(problem, budget, rng, { start: seedTour(problem, budget) });
    }
    if (name === 'genetic') return Meta.geneticAlgorithm(problem, budget, rng);
    if (name === 'ant-colony') return Meta.antColony(problem, budget, rng);
    return Meta.grasp(problem, budget, rng);
  }

  function seedTour(problem, budget) {
    return Meta.nearestNeighbour(problem, budget).tour;
  }

  function isTour(tour, n) {
    if (tour === null || tour.length !== n) return false;
    return new Set(tour).size === n;
  }

  /**
   * The tournament on an instance small enough for Held-Karp, so the column
   * every method is scored against is the OPTIMUM rather than the best any of
   * them happened to find. Quoting a ratio against a best-known value and
   * calling it an optimality gap is how published ratios end up below one.
   */
  function exactComparison(options) {
    const settings = options || {};
    const points = cityPoints(Object.assign({ cities: EXACT_LIMIT }, settings));
    const run = tournament(Object.assign({}, settings, { points: points,
      budget: settings.budget === undefined ? 1500 : settings.budget }));

    return { optimum: run.optimum, budget: run.budget, points: points, fair: run.fair,
      rows: run.runs.map(function (entry) {
        return { name: entry.name, cost: entry.cost, spent: entry.spent,
          ratio: entry.cost / run.optimum, optimal: Math.abs(entry.cost - run.optimum) < 1e-9,
          valid: entry.valid };
      }) };
  }

  /**
   * The same comparison at several budgets. This is the column that changes
   * the ranking: local search wins at a small budget and stops improving,
   * annealing and tabu overtake it later, and reporting either half alone is
   * the standard overclaim in both directions.
   */
  function budgetSweep(options) {
    const settings = options || {};
    const points = settings.points || cityPoints(settings);
    const budgets = settings.budgets === undefined ? [2000, 10000, 40000, 160000] : settings.budgets;

    return { budgets: budgets, points: points,
      rows: budgets.map(function (budget) {
        const run = tournament(Object.assign({}, settings, { points: points, budget: budget }));
        return { budget: budget, best: run.best, fair: run.fair,
          costs: run.runs.map(function (entry) {
            return { name: entry.name, cost: entry.cost, spent: entry.spent,
              converged: entry.converged };
          }) };
      }) };
  }

  /** Annealing at several temperatures, including zero — where the acceptance
   *  test is `delta < 0` and the method IS hill climbing. */
  function coolingSweep(options) {
    const settings = options || {};
    const problem = Meta.tspProblem(settings.points || cityPoints(settings));
    const budget = settings.budget === undefined ? 40000 : settings.budget;
    const base = Meta.initialTemperature(problem);

    return { base: base, rows: (settings.factors === undefined ? [0, 0.05, 0.25, 1, 4]
      : settings.factors).map(function (factor) {
      const counter = Meta.createBudget(budget);
      const rng = Random.seeded(settings.methodSeed === undefined ? 11 : settings.methodSeed);
      const start = Meta.nearestNeighbour(problem, counter).tour;
      const run = Meta.annealing(problem, counter, rng,
        { start: start, temperature: base * factor });
      return { factor: factor, temperature: base * factor, cost: counter.best(),
        accepted: run.accepted, worseAccepted: run.worseAccepted,
        finalTemperature: run.finalTemperature, hillClimbing: factor === 0 };
    }) };
  }

  /* --------------------------------------------- 20.8 hardness in practice */

  /**
   * The phase transition, measured. For each clause-to-variable ratio, solve
   * `instances` random 3-SAT formulas and report the satisfiable fraction, the
   * MEDIAN node count and the worst. The median is the one the literature
   * plots and the mean is the one that misleads: at the crossover the mean is
   * dominated by a handful of runs a thousand times the median.
   */
  function phaseTransition(options) {
    const settings = options || {};
    const variables = settings.variables === undefined ? 44 : settings.variables;
    const instances = settings.instances === undefined ? 60 : settings.instances;
    const ratios = settings.ratios === undefined
      ? [1, 2, 3, 3.5, 4, 4.27, 4.5, 5, 6, 8] : settings.ratios;

    return { variables: variables, instances: instances,
      rows: ratios.map(function (ratio) {
        return ratioRow(ratio, variables, instances, settings);
      }) };
  }

  function ratioRow(ratio, variables, instances, settings) {
    const nodes = [];
    let satisfiable = 0;

    for (let seed = 1; seed <= instances; seed += 1) {
      const formula = Generators.randomKSat({ variables: variables, ratio: ratio,
        seed: seed * 101 + Math.round(ratio * 7) });
      const solved = Sat.dpll(formula, { budget: settings.budget === undefined
        ? 2000000 : settings.budget });
      if (solved.satisfiable) satisfiable += 1;
      nodes.push(solved.stats.nodes);
    }
    const sorted = nodes.slice().sort(function (a, b) { return a - b; });
    return { ratio: ratio, clauses: Math.round(variables * ratio),
      satisfiableFraction: satisfiable / instances, satisfiable: satisfiable,
      median: sorted[Math.floor(sorted.length / 2)], worst: sorted[sorted.length - 1],
      mean: nodes.reduce(function (a, b) { return a + b; }, 0) / nodes.length,
      quartile: sorted[Math.floor(sorted.length * 0.75)] };
  }

  /* ------------------------------------------------- stochastic local search */

  /**
   * WalkSAT: pick an unsatisfied clause, and with probability `noise` flip a
   * random variable in it, otherwise flip the one that breaks fewest clauses.
   * It is incomplete — it can never report UNSAT — which is exactly why the
   * restart question is interesting: an incomplete solver that has not found
   * an answer tells you nothing about whether to keep waiting.
   */
  function walkSat(formula, options) {
    const settings = options || {};
    const rng = settings.rng || Random.seeded(settings.seed === undefined ? 1 : settings.seed);
    const noise = settings.noise === undefined ? 0.5 : settings.noise;
    const maxFlips = settings.maxFlips === undefined ? 20000 : settings.maxFlips;
    const assignment = randomAssignment(formula, rng);
    let flips = 0;

    while (flips < maxFlips) {
      const unsatisfied = unsatisfiedClauses(formula, assignment);
      if (unsatisfied.length === 0) {
        return { found: true, flips: flips, assignment: assignment.slice() };
      }
      const clause = formula.clauses[unsatisfied[rng.int(unsatisfied.length)]];
      const variable = chooseFlip(formula, assignment, clause, { rng: rng, noise: noise });
      assignment[variable - 1] = -assignment[variable - 1];
      flips += 1;
    }
    return { found: false, flips: flips, assignment: null };
  }

  function randomAssignment(formula, rng) {
    const out = new Array(formula.variables);

    for (let v = 0; v < formula.variables; v += 1) out[v] = rng.int(2) === 1 ? 1 : -1;
    return out;
  }

  function unsatisfiedClauses(formula, assignment) {
    const out = [];

    for (let c = 0; c < formula.clauses.length; c += 1) {
      if (Sat.clauseState(formula.clauses[c], assignment).status !== 'satisfied') out.push(c);
    }
    return out;
  }

  function chooseFlip(formula, assignment, clause, control) {
    if (control.rng.next() < control.noise) {
      return Math.abs(clause[control.rng.int(clause.length)]);
    }
    let best = Math.abs(clause[0]);
    let bestBreak = Infinity;

    clause.forEach(function (literal) {
      const variable = Math.abs(literal);
      assignment[variable - 1] = -assignment[variable - 1];
      const broken = unsatisfiedClauses(formula, assignment).length;
      assignment[variable - 1] = -assignment[variable - 1];
      if (broken >= bestBreak) return;
      bestBreak = broken;
      best = variable;
    });
    return best;
  }

  /**
   * The runtime distribution of a stochastic solver on ONE instance, over many
   * seeds, and what a restart cutoff does to it. Two columns matter and they
   * disagree: total flips without restarts, and total flips with a cutoff.
   * The mean moves a long way and the median barely moves, which is the whole
   * argument.
   */
  function restartStudy(options) {
    const settings = options || {};
    const formula = settings.formula || Generators.plantedKSat({
      variables: settings.variables === undefined ? 100 : settings.variables,
      ratio: settings.ratio === undefined ? 4.2 : settings.ratio,
      seed: settings.instanceSeed === undefined ? 9 : settings.instanceSeed }).formula;
    const trials = settings.trials === undefined ? 40 : settings.trials;
    const cap = settings.cap === undefined ? 40000 : settings.cap;
    const plain = runTrials(formula, trials, { maxFlips: cap, noise: settings.noise });
    const cutoffs = settings.cutoffs === undefined ? [100, 300, 1000, 3000] : settings.cutoffs;

    return { formula: formula, trials: trials, cap: cap, plain: plain,
      rows: cutoffs.map(function (cutoff) {
        return withRestarts(formula, trials, cutoff, cap, settings.noise);
      }) };
  }

  function runTrials(formula, trials, control) {
    const flips = [];
    let solved = 0;

    for (let seed = 1; seed <= trials; seed += 1) {
      const run = walkSat(formula, { seed: trialSeed(seed, 0), maxFlips: control.maxFlips,
        noise: control.noise });
      if (run.found) solved += 1;
      flips.push(run.flips);
    }
    return Object.assign(summarise(flips), { solved: solved, trials: trials });
  }

  /** Trial `t`, attempt `a`. The first attempt of every trial is the SAME
   *  seed the no-restart run used, so the restart column and the plain column
   *  share their first draw — otherwise part of any difference between them is
   *  the seeds rather than the strategy. */
  function trialSeed(trial, attempt) {
    return attempt === 0 ? trial * 37 + 1 : trial * 100003 + attempt * 17 + 3;
  }

  /**
   * A restart strategy over the same random stream: a run that has not
   * finished by the cutoff is abandoned, its flips are charged, and a fresh
   * attempt starts. `cap` is the overall budget, so a strategy that never
   * finishes is reported as a lower solved count rather than as a fast one.
   */
  function withRestarts(formula, trials, cutoff, cap, noise) {
    const totals = [];
    let solved = 0;
    let restarts = 0;

    for (let seed = 1; seed <= trials; seed += 1) {
      let spent = 0;
      let attempt = 0;
      let done = false;
      while (spent < cap && !done) {
        const run = walkSat(formula, { seed: trialSeed(seed, attempt),
          maxFlips: Math.min(cutoff, cap - spent), noise: noise });
        spent += run.flips;
        attempt += 1;
        done = run.found;
      }
      restarts += attempt - 1;
      if (done) solved += 1;
      totals.push(spent);
    }
    return Object.assign(summarise(totals), { cutoff: cutoff, solved: solved, trials: trials,
      restarts: restarts });
  }

  function summarise(values) {
    const sorted = values.slice().sort(function (a, b) { return a - b; });
    const at = function (q) { return sorted[Math.min(sorted.length - 1,
      Math.floor(sorted.length * q))]; };

    return { median: at(0.5), p90: at(0.9), p99: at(0.99), worst: sorted[sorted.length - 1],
      mean: values.reduce(function (a, b) { return a + b; }, 0) / values.length,
      min: sorted[0], spread: sorted[sorted.length - 1] / Math.max(1, at(0.5)) };
  }

  return {
    EXACT_LIMIT: EXACT_LIMIT,
    cityPoints: cityPoints, tournament: tournament, budgetSweep: budgetSweep,
    exactComparison: exactComparison,
    coolingSweep: coolingSweep,
    phaseTransition: phaseTransition,
    walkSat: walkSat, restartStudy: restartStudy, summarise: summarise
  };
}));

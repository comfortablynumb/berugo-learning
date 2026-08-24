/**
 * Eight ways to attack a problem you cannot solve, under one budget.
 *
 * Every method here is a search over the same space with the same objective,
 * and the only honest way to compare them is to give each the same number of
 * OBJECTIVE EVALUATIONS and plot best-so-far against evaluations spent. A
 * comparison by "best result found" is a comparison of how long each author
 * was willing to wait, which is how most published metaheuristic comparisons
 * are done and why most of them mean nothing.
 *
 * So the budget is not advisory. `createBudget` hands out a counter, every
 * method spends from it, and a method that runs out stops mid-sweep rather
 * than finishing the pass it is on — because "just let it finish this
 * iteration" is a budget overrun with a good excuse. The counter also records
 * the best-so-far curve, so the interesting question — *how quickly* does each
 * method get to within 5% — has an answer rather than an anecdote.
 *
 * What separates the methods is entirely what they do about local optima:
 *
 *   - **2-opt and or-opt** do nothing. They stop at the first solution with no
 *     improving move and that is that. They are also the strongest thing in
 *     the table per evaluation spent, which is the result nobody expects.
 *   - **Annealing** accepts worsening moves with probability e^(−Δ/T) and
 *     cools. At T = 0 it *is* hill climbing, which the module exposes as a
 *     control rather than describing, so the degeneration can be observed.
 *   - **Tabu search** forbids reversing a recent move, so a local optimum is
 *     climbed out of by force rather than by luck, and the tenure is the dial.
 *   - **Genetic algorithms** keep a population and recombine. Order crossover
 *     is used because the naive one produces invalid tours, and repairing an
 *     invalid tour is where a GA's real cost usually hides.
 *   - **Ant colony optimisation** keeps the memory in the edges rather than in
 *     the solutions, which is the one genuinely different idea in the list.
 *   - **GRASP** restarts a randomised greedy construction and locally improves
 *     each one, so it is the control that says how much of a method's result
 *     is the method and how much is "run local search several times".
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.Metaheuristics = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const Approx = scope && scope.Approximation
    ? scope.Approximation : require('./approximation.js');

  const NAMES = ['nearest-neighbour', 'two-opt', 'or-opt', 'annealing', 'tabu', 'genetic',
    'ant-colony', 'grasp'];

  /* -------------------------------------------------------------- the budget */

  /**
   * The evaluation counter every method shares. `spend` returns false once the
   * budget is gone, and every loop in this file checks it — a method that
   * ignores the return value would silently overrun, which is the exact defect
   * the harness exists to prevent.
   */
  function createBudget(total, options) {
    const settings = options || {};
    const state = { total: total, spent: 0, best: Infinity, bestTour: null,
      curve: [], every: settings.every === undefined ? Math.max(1, Math.floor(total / 60)) : settings.every };

    return {
      spend: function (n) {
        state.spent += n === undefined ? 1 : n;
        return state.spent <= state.total;
      },
      exhausted: function () { return state.spent >= state.total; },
      offer: function (cost, tour) { return offerTo(state, cost, tour); },
      spent: function () { return state.spent; },
      remaining: function () { return Math.max(0, state.total - state.spent); },
      best: function () { return state.best; },
      bestTour: function () { return state.bestTour === null ? null : state.bestTour.slice(); },
      curve: function () { return state.curve.slice(); },
      total: total
    };
  }

  /** Record a candidate and, on the sampling stride, a curve point. */
  function offerTo(state, cost, tour) {
    if (cost < state.best) {
      state.best = cost;
      state.bestTour = tour === undefined || tour === null ? null : tour.slice();
    }
    const due = state.curve.length === 0 ||
      state.spent - state.curve[state.curve.length - 1].spent >= state.every;
    if (due) state.curve.push({ spent: state.spent, best: state.best });
    return state.best;
  }

  /** The final curve point, so every curve ends at the budget it was given. */
  function sealCurve(budget) {
    const curve = budget.curve();
    const last = curve[curve.length - 1];

    if (last && last.spent === budget.spent()) return curve;
    return curve.concat([{ spent: budget.spent(), best: budget.best() }]);
  }

  /* ------------------------------------------------------------- the problem */

  /** A TSP instance as the distance matrix plus the two costings every method
   *  needs: a whole tour, and the delta of a 2-opt move. */
  function tspProblem(points) {
    const matrix = Approx.distanceMatrix(points);

    return { n: points.length, points: points, matrix: matrix,
      cost: function (tour) { return Approx.tourLength(tour, matrix); } };
  }

  function twoOptDelta(matrix, tour, i, j) {
    const n = tour.length;
    const a = tour[i];
    const b = tour[(i + 1) % n];
    const c = tour[j];
    const d = tour[(j + 1) % n];

    if (a === c || b === c || a === d) return 0;
    return matrix[a][c] + matrix[b][d] - matrix[a][b] - matrix[c][d];
  }

  function applyTwoOpt(tour, i, j) {
    const out = tour.slice();
    let left = i + 1;
    let right = j;

    while (left < right) {
      const swap = out[left];
      out[left] = out[right];
      out[right] = swap;
      left += 1;
      right -= 1;
    }
    return out;
  }

  /* ---------------------------------------------------------- constructive */

  /** Always go to the nearest unvisited city. One pass, n² distance lookups,
   *  and typically 20-25% above optimal — the baseline everything beats. */
  function nearestNeighbour(problem, budget, options) {
    const settings = options || {};
    const start = settings.start === undefined ? 0 : settings.start;
    const visited = new Array(problem.n).fill(false);
    const tour = [start];

    visited[start] = true;
    while (tour.length < problem.n) {
      const from = tour[tour.length - 1];
      let best = -1;
      for (let v = 0; v < problem.n; v += 1) {
        if (visited[v]) continue;
        if (best === -1 || problem.matrix[from][v] < problem.matrix[from][best]) best = v;
      }
      visited[best] = true;
      tour.push(best);
    }
    budget.spend(problem.n);
    budget.offer(problem.cost(tour), tour);
    return { tour: tour, cost: problem.cost(tour) };
  }

  /**
   * A greedy construction with a randomised choice among the α best
   * candidates. α = 1 is nearest neighbour exactly; larger α buys the diversity
   * that makes restarting worth anything.
   */
  function greedyRandomised(problem, rng, alpha) {
    const visited = new Array(problem.n).fill(false);
    const tour = [rng.int(problem.n)];

    visited[tour[0]] = true;
    while (tour.length < problem.n) {
      const from = tour[tour.length - 1];
      const candidates = [];
      for (let v = 0; v < problem.n; v += 1) {
        if (!visited[v]) candidates.push({ v: v, d: problem.matrix[from][v] });
      }
      candidates.sort(function (a, b) { return a.d - b.d; });
      const pick = candidates[rng.int(Math.min(alpha, candidates.length))];
      visited[pick.v] = true;
      tour.push(pick.v);
    }
    return tour;
  }

  /* ------------------------------------------------------------ local search */

  /**
   * 2-opt: reverse the segment between two edges when doing so shortens the
   * tour. Each candidate move costs ONE evaluation because the delta is four
   * table lookups — charging a full tour costing would make local search look
   * n times more expensive than it is, and is the most common way a budgeted
   * comparison is rigged without anybody intending to.
   */
  function twoOpt(problem, budget, start, options) {
    const settings = options || {};
    const firstImprovement = settings.firstImprovement !== false;
    let tour = start.slice();
    let cost = problem.cost(tour);
    let improved = true;
    let moves = 0;

    budget.offer(cost, tour);
    while (improved && !budget.exhausted()) {
      improved = false;
      const step = sweepTwoOpt(problem, budget, tour, firstImprovement);
      if (step === null) break;
      tour = step.tour;
      cost += step.delta;
      moves += 1;
      improved = true;
      budget.offer(cost, tour);
    }
    return { tour: tour, cost: cost, moves: moves };
  }

  function sweepTwoOpt(problem, budget, tour, firstImprovement) {
    let best = null;

    for (let i = 0; i < tour.length - 1; i += 1) {
      for (let j = i + 2; j < tour.length; j += 1) {
        if (i === 0 && j === tour.length - 1) continue;
        if (!budget.spend()) return best;
        const delta = twoOptDelta(problem.matrix, tour, i, j);
        if (delta >= -1e-12) continue;
        if (best === null || delta < best.delta) best = { i: i, j: j, delta: delta };
        if (firstImprovement) return { tour: applyTwoOpt(tour, i, j), delta: delta };
      }
    }
    return best === null ? null : { tour: applyTwoOpt(tour, best.i, best.j), delta: best.delta };
  }

  /**
   * Or-opt: lift a segment of one to three cities and reinsert it elsewhere.
   * It reaches tours 2-opt cannot, because moving a short run is not a
   * reversal — and the two together are stronger than either, which is the
   * argument for designing a neighbourhood rather than picking one.
   */
  function orOpt(problem, budget, start, options) {
    const settings = options || {};
    const maxSegment = settings.maxSegment === undefined ? 3 : settings.maxSegment;
    let tour = start.slice();
    let cost = problem.cost(tour);
    let moves = 0;

    budget.offer(cost, tour);
    while (!budget.exhausted()) {
      const step = sweepOrOpt(problem, budget, tour, maxSegment);
      if (step === null) break;
      tour = step.tour;
      cost += step.delta;
      moves += 1;
      budget.offer(cost, tour);
    }
    return { tour: tour, cost: cost, moves: moves };
  }

  /** One candidate move costs one evaluation here too, and the cost is a
   *  six-term delta rather than a fresh tour costing — otherwise the same
   *  budget buys or-opt n times less search than it buys 2-opt, and the
   *  comparison measures the implementations rather than the neighbourhoods. */
  function sweepOrOpt(problem, budget, tour, maxSegment) {
    for (let length = 1; length <= maxSegment && length < tour.length - 1; length += 1) {
      for (let at = 0; at + length <= tour.length; at += 1) {
        const move = scanInsertions(problem, budget, tour, { at: at, length: length });
        if (move === null) return null;
        if (move.delta < -1e-12) return move;
      }
    }
    return null;
  }

  function scanInsertions(problem, budget, tour, segment) {
    const matrix = problem.matrix;
    const n = tour.length;
    const cut = tour.slice(segment.at, segment.at + segment.length);
    const rest = tour.slice(0, segment.at).concat(tour.slice(segment.at + segment.length));
    const prev = tour[(segment.at - 1 + n) % n];
    const next = tour[(segment.at + segment.length) % n];
    const removal = matrix[prev][next] - matrix[prev][cut[0]] - matrix[cut[cut.length - 1]][next];

    for (let insert = 0; insert < rest.length; insert += 1) {
      if (!budget.spend()) return null;
      const a = rest[(insert - 1 + rest.length) % rest.length];
      const b = rest[insert];
      if (a === prev && b === next) continue;
      const delta = removal + matrix[a][cut[0]] + matrix[cut[cut.length - 1]][b] - matrix[a][b];
      if (delta >= -1e-12) continue;
      return { tour: rest.slice(0, insert).concat(cut, rest.slice(insert)), delta: delta };
    }
    return { delta: 0 };
  }

  /* -------------------------------------------------------------- annealing */

  /**
   * Simulated annealing over the 2-opt neighbourhood. `temperature: 0`
   * degenerates to hill climbing exactly — the acceptance test becomes
   * `delta < 0` — and that is a control rather than a footnote so the
   * degeneration can be measured instead of believed.
   */
  function annealing(problem, budget, rng, options) {
    const settings = options || {};
    const state = { tour: settings.start ? settings.start.slice() : identityTour(problem.n),
      cooling: settings.cooling === undefined ? coolingFor(budget, settings) : settings.cooling,
      temperature: settings.temperature === undefined ? initialTemperature(problem) : settings.temperature,
      accepted: 0, worseAccepted: 0 };

    state.cost = problem.cost(state.tour);
    budget.offer(state.cost, state.tour);
    while (budget.spend()) {
      stepAnnealing(problem, budget, rng, state);
      state.temperature *= state.cooling;
    }
    return { tour: state.tour, cost: state.cost, accepted: state.accepted,
      worseAccepted: state.worseAccepted, finalTemperature: state.temperature };
  }

  function stepAnnealing(problem, budget, rng, state) {
    const n = state.tour.length;
    const i = rng.int(n - 1);
    const j = i + 2 + rng.int(Math.max(1, n - i - 2));

    if (j >= n) return;
    const delta = twoOptDelta(problem.matrix, state.tour, i, j);
    const accept = delta < 0 || (state.temperature > 0 &&
      rng.next() < Math.exp(-delta / state.temperature));

    if (!accept) return;
    state.tour = applyTwoOpt(state.tour, i, j);
    state.cost += delta;
    state.accepted += 1;
    if (delta > 0) state.worseAccepted += 1;
    budget.offer(state.cost, state.tour);
  }

  /**
   * The cooling rate has to be derived from the BUDGET, not fixed. A schedule
   * tuned for a million evaluations is a random walk when it is given a
   * thousand — the temperature never falls far enough to settle, and the
   * method reports its starting tour. That was measured before this function
   * existed: at 1 500 evaluations a fixed 0.9995 left annealing at exactly the
   * nearest-neighbour tour it started from. The rate here takes the
   * temperature down by `fall` (a thousandfold by default) across whatever
   * budget remains.
   */
  function coolingFor(budget, settings) {
    const steps = Math.max(1, budget.remaining ? budget.remaining() : budget.total);
    const fall = settings.fall === undefined ? 1e-3 : settings.fall;

    return Math.pow(fall, 1 / steps);
  }

  /** A starting temperature that accepts most moves: the mean edge length. */
  function initialTemperature(problem) {
    let total = 0;
    let count = 0;

    for (let i = 0; i < problem.n; i += 1) {
      for (let j = i + 1; j < problem.n; j += 1) { total += problem.matrix[i][j]; count += 1; }
    }
    return count === 0 ? 1 : total / count;
  }

  function identityTour(n) {
    const out = [];

    for (let i = 0; i < n; i += 1) out.push(i);
    return out;
  }

  /* ------------------------------------------------------------------ tabu */

  /**
   * Tabu search takes the best move in the neighbourhood even when it is
   * worse, and forbids reversing it for `tenure` iterations. The aspiration
   * criterion — take a tabu move anyway if it beats the best ever seen — is
   * not optional: without it the memory can forbid the move that finds the
   * answer, and the search stalls for no reason a log would explain.
   */
  function tabuSearch(problem, budget, rng, options) {
    const settings = options || {};
    const state = { tour: settings.start ? settings.start.slice() : identityTour(problem.n),
      tenure: settings.tenure === undefined ? 12 : settings.tenure,
      sample: settings.sample === undefined ? 40 : settings.sample,
      tabu: new Map(), iteration: 0, aspirations: 0, tabuBlocks: 0 };

    state.cost = problem.cost(state.tour);
    budget.offer(state.cost, state.tour);
    while (!budget.exhausted()) {
      const move = bestTabuMove(problem, budget, rng, state);
      if (move === null) break;
      state.tour = applyTwoOpt(state.tour, move.i, move.j);
      state.cost += move.delta;
      state.tabu.set(moveKey(move), state.iteration + state.tenure);
      state.iteration += 1;
      budget.offer(state.cost, state.tour);
    }
    return { tour: state.tour, cost: state.cost, iterations: state.iteration,
      aspirations: state.aspirations, tabuBlocks: state.tabuBlocks };
  }

  function moveKey(move) {
    return move.i + ':' + move.j;
  }

  function bestTabuMove(problem, budget, rng, state) {
    const n = state.tour.length;
    let best = null;

    for (let attempt = 0; attempt < state.sample; attempt += 1) {
      if (!budget.spend()) break;
      const i = rng.int(n - 1);
      const j = i + 2 + rng.int(Math.max(1, n - i - 2));
      if (j >= n || (i === 0 && j === n - 1)) continue;
      const delta = twoOptDelta(problem.matrix, state.tour, i, j);
      const move = { i: i, j: j, delta: delta };
      const forbidden = (state.tabu.get(moveKey(move)) || 0) > state.iteration;
      if (forbidden && state.cost + delta >= budget.best()) { state.tabuBlocks += 1; continue; }
      if (forbidden) state.aspirations += 1;
      if (best === null || delta < best.delta) best = move;
    }
    return best;
  }

  /* --------------------------------------------------------------- genetic */

  /**
   * Order crossover (OX): copy a slice of one parent, fill the rest in the
   * other parent's order skipping what is already present. The naive
   * one-point crossover on a permutation produces a tour visiting some cities
   * twice and others never, and the repair step it needs is where a genetic
   * algorithm's real cost lives — so it is not used here.
   */
  function geneticAlgorithm(problem, budget, rng, options) {
    const settings = options || {};
    const size = settings.population === undefined ? 30 : settings.population;
    const mutation = settings.mutation === undefined ? 0.2 : settings.mutation;
    let population = initialPopulation(problem, budget, rng, size);
    let generations = 0;

    while (!budget.exhausted()) {
      population = nextGeneration(problem, budget, rng, { population: population,
        mutation: mutation, elite: settings.elite === undefined ? 2 : settings.elite });
      generations += 1;
    }
    population.sort(function (a, b) { return a.cost - b.cost; });
    return { tour: population[0].tour, cost: population[0].cost, generations: generations,
      population: size };
  }

  function initialPopulation(problem, budget, rng, size) {
    const out = [];

    for (let i = 0; i < size; i += 1) {
      const tour = rng.shuffle(identityTour(problem.n));
      budget.spend();
      const cost = problem.cost(tour);
      budget.offer(cost, tour);
      out.push({ tour: tour, cost: cost });
    }
    return out;
  }

  function nextGeneration(problem, budget, rng, control) {
    const sorted = control.population.slice().sort(function (a, b) { return a.cost - b.cost; });
    const out = sorted.slice(0, control.elite);

    while (out.length < control.population.length) {
      if (!budget.spend()) break;
      const child = orderCrossover(tournament(sorted, rng), tournament(sorted, rng), rng);
      if (rng.next() < control.mutation) swapMutate(child, rng);
      const cost = problem.cost(child);
      budget.offer(cost, child);
      out.push({ tour: child, cost: cost });
    }
    return out;
  }

  function tournament(sorted, rng) {
    const a = rng.int(sorted.length);
    const b = rng.int(sorted.length);

    return sorted[Math.min(a, b)].tour;
  }

  function orderCrossover(a, b, rng) {
    const n = a.length;
    const from = rng.int(n);
    const to = from + 1 + rng.int(Math.max(1, n - from - 1));
    const child = new Array(n).fill(-1);
    const taken = new Set();

    for (let i = from; i < Math.min(to, n); i += 1) { child[i] = a[i]; taken.add(a[i]); }
    let write = 0;
    for (let i = 0; i < n; i += 1) {
      if (taken.has(b[i])) continue;
      while (child[write] !== -1) write += 1;
      child[write] = b[i];
    }
    return child;
  }

  function swapMutate(tour, rng) {
    const i = rng.int(tour.length);
    const j = rng.int(tour.length);
    const swap = tour[i];

    tour[i] = tour[j];
    tour[j] = swap;
  }

  /* ---------------------------------------------------------- ant colony */

  /**
   * The memory lives in the edges rather than in the solutions. Each ant walks
   * a tour choosing the next city with probability proportional to
   * pheromone^α · (1/distance)^β; then every edge evaporates and the tours lay
   * down deposits inversely proportional to their length. It is the only
   * method in the list whose state is not a set of candidate answers.
   */
  function antColony(problem, budget, rng, options) {
    const settings = options || {};
    const control = { ants: settings.ants === undefined ? 20 : settings.ants,
      alpha: settings.alpha === undefined ? 1 : settings.alpha,
      beta: settings.beta === undefined ? 3 : settings.beta,
      evaporation: settings.evaporation === undefined ? 0.15 : settings.evaporation,
      pheromone: initialPheromone(problem) };
    let rounds = 0;

    while (!budget.exhausted()) {
      const tours = [];
      for (let a = 0; a < control.ants && budget.spend(problem.n); a += 1) {
        const tour = walkAnt(problem, rng, control);
        const cost = problem.cost(tour);
        budget.offer(cost, tour);
        tours.push({ tour: tour, cost: cost });
      }
      if (tours.length === 0) break;
      depositPheromone(control, tours, problem.n);
      rounds += 1;
    }
    return { tour: budget.bestTour(), cost: budget.best(), rounds: rounds, ants: control.ants };
  }

  function initialPheromone(problem) {
    const out = [];

    for (let i = 0; i < problem.n; i += 1) out.push(new Array(problem.n).fill(1));
    return out;
  }

  function walkAnt(problem, rng, control) {
    const visited = new Array(problem.n).fill(false);
    const tour = [rng.int(problem.n)];

    visited[tour[0]] = true;
    while (tour.length < problem.n) {
      const next = chooseNext(problem, rng, control, tour[tour.length - 1], visited);
      visited[next] = true;
      tour.push(next);
    }
    return tour;
  }

  function chooseNext(problem, rng, control, from, visited) {
    const weights = [];
    let total = 0;

    for (let v = 0; v < problem.n; v += 1) {
      if (visited[v]) { weights.push(0); continue; }
      const distance = Math.max(1e-9, problem.matrix[from][v]);
      const weight = Math.pow(control.pheromone[from][v], control.alpha) *
        Math.pow(1 / distance, control.beta);
      weights.push(weight);
      total += weight;
    }
    let draw = rng.next() * total;
    for (let v = 0; v < weights.length; v += 1) {
      draw -= weights[v];
      if (draw <= 0 && weights[v] > 0) return v;
    }
    return weights.findIndex(function (w) { return w > 0; });
  }

  function depositPheromone(control, tours, n) {
    for (let i = 0; i < n; i += 1) {
      for (let j = 0; j < n; j += 1) control.pheromone[i][j] *= (1 - control.evaporation);
    }
    tours.forEach(function (entry) {
      const amount = 1 / Math.max(1e-9, entry.cost);
      entry.tour.forEach(function (city, index) {
        const next = entry.tour[(index + 1) % entry.tour.length];
        control.pheromone[city][next] += amount;
        control.pheromone[next][city] += amount;
      });
    });
  }

  /* ------------------------------------------------------------------ GRASP */

  /**
   * Greedy randomised construction, then local search, repeated. It is the
   * control the whole tournament needs: if a sophisticated method cannot beat
   * "restart a randomised greedy and run 2-opt", its sophistication is not
   * paying for itself.
   */
  function grasp(problem, budget, rng, options) {
    const settings = options || {};
    const alpha = settings.alpha === undefined ? 3 : settings.alpha;
    let restarts = 0;

    while (!budget.exhausted()) {
      const start = greedyRandomised(problem, rng, alpha);
      budget.spend(problem.n);
      budget.offer(problem.cost(start), start);
      twoOpt(problem, budget, start, settings);
      restarts += 1;
    }
    return { tour: budget.bestTour(), cost: budget.best(), restarts: restarts };
  }

  return {
    NAMES: NAMES,
    createBudget: createBudget, sealCurve: sealCurve,
    tspProblem: tspProblem, twoOptDelta: twoOptDelta, applyTwoOpt: applyTwoOpt,
    identityTour: identityTour, initialTemperature: initialTemperature,
    coolingFor: coolingFor,
    nearestNeighbour: nearestNeighbour, greedyRandomised: greedyRandomised,
    twoOpt: twoOpt, orOpt: orOpt,
    annealing: annealing, tabuSearch: tabuSearch, geneticAlgorithm: geneticAlgorithm,
    antColony: antColony, grasp: grasp,
    orderCrossover: orderCrossover
  };
}));

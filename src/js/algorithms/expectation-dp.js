/**
 * Expectation DP - and the moment it stops being a recursion.
 *
 * An expected-value recurrence over an acyclic state graph is an ordinary DP:
 * evaluate in topological order and each state is a weighted sum of states
 * already known. The instant a state can reach *itself* - a board with a
 * "miss a turn and stay put" square, a retry on failure, a random walk that
 * can step backwards - the recursion has no base case in that direction and a
 * naive memoised solver either recurses forever or, worse, returns whatever
 * partially-filled value happened to be in the memo.
 *
 * The fix is to stop thinking of it as a recursion. `E[s] = 1 + Σ p(s→t)·E[t]`
 * rearranged is `E[s] - Σ p(s→t)·E[t] = 1`, which is one row of a linear
 * system, and n states give n equations. Twenty lines of Gaussian elimination
 * answer what no amount of memoisation can.
 *
 * So this file ships both, and `solveExpectation` picks by *detecting* the
 * cycle rather than by being told: `topologicalOrder` returns null and the
 * solver switches to elimination, reporting which route it took. The two
 * agree exactly on acyclic inputs, which is the assertion that makes the
 * linear solver trustworthy on the cyclic ones where no other check exists.
 *
 * Monte Carlo is here as the third opinion. It is not a check on the algebra -
 * it is far too noisy for that - it is a check on the *model*: a transition
 * table that does not describe the game produces an exact answer to the wrong
 * question, and only simulating the game as described catches it. The
 * confidence interval is reported so "agrees" means something.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ExpectationDp = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function emptyReport() {
    return { states: 0, transitions: 0, pivots: 0, cyclic: false, method: 'none', trials: 0 };
  }

  /* ------------------------------------------------------- the state graph */

  /**
   * A chain is `{ states, transitions(state) -> [{ to, probability }],
   * absorbing(state) -> boolean, cost(state) -> number }`. `cost` defaults to
   * one step per move, which is the hitting-time question.
   */
  function normalise(chain) {
    return {
      states: chain.states,
      transitions: chain.transitions,
      absorbing: chain.absorbing,
      cost: chain.cost || function () { return 1; }
    };
  }

  /** Do the probabilities leaving each transient state sum to one? A chain
   *  whose rows do not sum to one is not a chain, and the expectation it
   *  produces is meaningless rather than merely wrong. */
  function checkStochastic(chain, options) {
    const model = normalise(chain);
    const tolerance = (options || {}).tolerance || 1e-9;
    const problems = [];

    model.states.forEach(function (state) {
      if (model.absorbing(state)) return;
      const total = model.transitions(state).reduce(function (sum, edge) {
        return sum + edge.probability;
      }, 0);

      if (Math.abs(total - 1) <= tolerance) return;
      problems.push({ state: state, total: total });
    });
    return { valid: problems.length === 0, problems: problems };
  }

  /** Kahn over the transient states only. Null means a cycle, which is the
   *  signal that a recursion cannot answer this chain. */
  function topologicalOrder(chain) {
    const model = normalise(chain);
    const index = new Map();

    model.states.forEach(function (state, i) { index.set(state, i); });
    const indegree = new Map();

    model.states.forEach(function (state) { indegree.set(state, 0); });
    model.states.forEach(function (state) {
      if (model.absorbing(state)) return;
      model.transitions(state).forEach(function (edge) {
        indegree.set(edge.to, (indegree.get(edge.to) || 0) + 1);
      });
    });
    const queue = model.states.filter(function (s) { return indegree.get(s) === 0; });
    const order = [];

    while (queue.length) {
      const state = queue.shift();
      order.push(state);

      if (model.absorbing(state)) continue;
      model.transitions(state).forEach(function (edge) {
        indegree.set(edge.to, indegree.get(edge.to) - 1);

        if (indegree.get(edge.to) === 0) queue.push(edge.to);
      });
    }
    return order.length === model.states.length ? order : null;
  }

  /* ------------------------------------------------------- the recursion */

  /** The acyclic case: evaluate in reverse topological order. Throws rather
   *  than looping if handed a cyclic chain, because returning a number here
   *  would be the failure this file exists to prevent. */
  function byRecursion(chain, options) {
    const report = (options || {}).report || emptyReport();
    const model = normalise(chain);
    const order = topologicalOrder(chain);

    if (order === null) throw new Error('expectation-dp: the chain has a cycle');
    const expected = new Map();

    report.method = 'recursion';

    for (let i = order.length - 1; i >= 0; i -= 1) {
      const state = order[i];
      report.states += 1;

      if (model.absorbing(state)) { expected.set(state, 0); continue; }
      let total = model.cost(state);

      model.transitions(state).forEach(function (edge) {
        report.transitions += 1;
        total += edge.probability * expected.get(edge.to);
      });
      expected.set(state, total);
    }
    return { expected: expected, report: report };
  }

  /* --------------------------------------------------------- the algebra */

  /**
   * The general case: one equation per transient state, solved by Gaussian
   * elimination with partial pivoting.
   *
   * Partial pivoting is not optional. A chain whose first transient state has
   * no self-loop puts a zero on the diagonal, and an unpivoted elimination
   * divides by it - producing Infinity and then NaN, which propagates through
   * the back-substitution and comes out as a table of NaNs rather than an
   * error at the point of failure.
   */
  function byElimination(chain, options) {
    const report = (options || {}).report || emptyReport();
    const model = normalise(chain);
    const transient = model.states.filter(function (s) { return !model.absorbing(s); });
    const index = new Map();

    transient.forEach(function (state, i) { index.set(state, i); });
    report.method = 'elimination';
    report.cyclic = true;
    const matrix = buildSystem(model, transient, index, report);
    const solution = gaussian(matrix, transient.length, report);
    const expected = new Map();

    model.states.forEach(function (state) { expected.set(state, 0); });
    transient.forEach(function (state, i) { expected.set(state, solution[i]); });
    return { expected: expected, report: report };
  }

  /** Row i is `E[i] - Σ p(i→j)·E[j] = cost(i)`, with absorbing targets
   *  contributing nothing because their expectation is zero. */
  function buildSystem(model, transient, index, report) {
    return transient.map(function (state, i) {
      const row = new Array(transient.length + 1).fill(0);
      report.states += 1;
      row[i] = 1;
      row[transient.length] = model.cost(state);

      model.transitions(state).forEach(function (edge) {
        report.transitions += 1;

        if (!index.has(edge.to)) return;
        row[index.get(edge.to)] -= edge.probability;
      });
      return row;
    });
  }

  function gaussian(matrix, n, report) {
    for (let column = 0; column < n; column += 1) {
      let pivot = column;

      for (let row = column + 1; row < n; row += 1) {
        if (Math.abs(matrix[row][column]) <= Math.abs(matrix[pivot][column])) continue;
        pivot = row;
      }
      const swap = matrix[column];
      matrix[column] = matrix[pivot];
      matrix[pivot] = swap;
      report.pivots += 1;

      if (Math.abs(matrix[column][column]) < 1e-12) continue;
      eliminateColumn(matrix, n, column);
    }
    return backSubstitute(matrix, n);
  }

  function eliminateColumn(matrix, n, column) {
    for (let row = column + 1; row < n; row += 1) {
      const factor = matrix[row][column] / matrix[column][column];

      if (factor === 0) continue;

      for (let k = column; k <= n; k += 1) matrix[row][k] -= factor * matrix[column][k];
    }
  }

  function backSubstitute(matrix, n) {
    const out = new Array(n).fill(0);

    for (let row = n - 1; row >= 0; row -= 1) {
      let value = matrix[row][n];

      for (let column = row + 1; column < n; column += 1) value -= matrix[row][column] * out[column];
      out[row] = Math.abs(matrix[row][row]) < 1e-12 ? Infinity : value / matrix[row][row];
    }
    return out;
  }

  /** The public entry: detect the cycle, then pick. The route taken is
   *  reported rather than assumed by the caller. */
  function solveExpectation(chain, options) {
    const report = (options || {}).report || emptyReport();
    const acyclic = topologicalOrder(chain) !== null;
    const run = acyclic ? byRecursion(chain, { report: report })
      : byElimination(chain, { report: report });
    return { expected: run.expected, acyclic: acyclic, method: report.method, report: report };
  }

  /* ------------------------------------------------------------ Monte Carlo */

  /**
   * Simulate the chain from `start`. The half-width reported is 1.96 standard
   * errors, so "the exact answer is inside the interval" is a claim with a
   * stated confidence rather than a vague agreement.
   */
  function monteCarlo(chain, start, random, options) {
    const settings = options || {};
    const report = settings.report || emptyReport();
    const model = normalise(chain);
    const trials = settings.trials || 20000;
    const cap = settings.maxSteps || 100000;
    let total = 0;
    let squares = 0;

    for (let trial = 0; trial < trials; trial += 1) {
      let state = start;
      let cost = 0;
      let steps = 0;

      while (!model.absorbing(state) && steps < cap) {
        cost += model.cost(state);
        state = pickNext(model.transitions(state), random.next());
        steps += 1;
        report.transitions += 1;
      }
      total += cost;
      squares += cost * cost;
    }
    report.trials = trials;
    const mean = total / trials;
    const variance = Math.max(0, squares / trials - mean * mean);
    const halfWidth = 1.96 * Math.sqrt(variance / trials);
    return { mean: mean, halfWidth: halfWidth, trials: trials,
      interval: [mean - halfWidth, mean + halfWidth], report: report };
  }

  function pickNext(edges, roll) {
    let cumulative = 0;

    for (let i = 0; i < edges.length; i += 1) {
      cumulative += edges[i].probability;

      if (roll < cumulative) return edges[i].to;
    }
    return edges[edges.length - 1].to;
  }

  /* -------------------------------------------------------------- the games */

  /**
   * A board of `size` squares rolled with a `faces`-sided die, where landing
   * past the end stays put - which is what makes it cyclic and is exactly the
   * rule the naive recursion cannot handle.
   *
   * `snakes` maps a square to the square it sends you to, so a snake back to
   * an earlier square adds a *genuine* cycle rather than only a self-loop.
   */
  function boardGame(options) {
    const settings = options || {};
    const size = settings.size || 20;
    const faces = settings.faces || 6;
    const snakes = settings.snakes || {};
    const states = [];

    for (let square = 0; square <= size; square += 1) states.push(square);

    return {
      size: size, faces: faces, snakes: snakes, states: states,
      absorbing: function (square) { return square === size; },
      transitions: function (square) {
        const out = [];

        for (let roll = 1; roll <= faces; roll += 1) {
          const landed = square + roll > size ? square : square + roll;
          out.push({ to: snakes[landed] === undefined ? landed : snakes[landed],
            probability: 1 / faces });
        }
        return out;
      }
    };
  }

  /**
   * The secretary problem's stopping rule, as an expectation over a threshold:
   * observe the first k, then take the first candidate better than all of
   * them. The optimum is near n/e, which the sweep finds rather than assumes.
   */
  function secretarySweep(n) {
    const rows = [];

    for (let k = 0; k < n; k += 1) rows.push({ k: k, probability: secretaryProbability(n, k) });
    let best = rows[0];

    rows.forEach(function (row) { if (row.probability > best.probability) best = row; });
    return { rows: rows, best: best, overE: n / Math.E, limit: 1 / Math.E };
  }

  /** P(best chosen) = (k/n)·Σ_{i=k+1..n} 1/(i-1), and k = 0 takes the first
   *  candidate, which wins exactly 1/n of the time. */
  function secretaryProbability(n, k) {
    if (k === 0) return 1 / n;
    let sum = 0;

    for (let i = k + 1; i <= n; i += 1) sum += 1 / (i - 1);
    return (k / n) * sum;
  }

  return {
    emptyReport: emptyReport, normalise: normalise, checkStochastic: checkStochastic,
    topologicalOrder: topologicalOrder,
    byRecursion: byRecursion, byElimination: byElimination, solveExpectation: solveExpectation,
    monteCarlo: monteCarlo, boardGame: boardGame,
    secretarySweep: secretarySweep, secretaryProbability: secretaryProbability
  };
}));

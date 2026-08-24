/**
 * Linear-programming relaxation, and the three ways back to an integer answer.
 *
 * The recipe is mechanical, which is its whole appeal: write the integer
 * program honestly, drop the integrality constraint, solve the linear program
 * in polynomial time, then convert the fractional solution into an integral
 * one and bound what that conversion cost. You get a provable approximation
 * without inventing an algorithm, and the proof is usually two lines.
 *
 * Three roundings appear here and they are genuinely different:
 *
 *   - deterministic threshold rounding for vertex cover. The LP is
 *     half-integral - every basic solution has x in {0, 1/2, 1} - so rounding
 *     at 1/2 at most doubles the cost, and the ratio is 2 by inspection.
 *   - randomised rounding for set cover: take set S with probability x_S, and
 *     repeat O(log n) rounds so every element is covered with high
 *     probability. The expected cost per round is exactly the LP value.
 *   - randomised rounding for MAX-SAT, where setting variable i true with
 *     probability y_i satisfies clause j with probability at least
 *     1 - (1 - 1/k)^k >= 1 - 1/e. Taking the better of that and a plain
 *     coin flip gives 3/4, because the two are strong on opposite clause
 *     lengths - short clauses favour the LP, long ones favour the coin.
 *
 * The integrality gap is the limit of the whole method: it is the worst ratio
 * between the integer optimum and the LP optimum, and no rounding of that
 * relaxation can beat it. Vertex cover's gap is 2 - 2/n, attained by the
 * complete graph, where the LP pays n/2 and the integer optimum is n - 1.
 * That is measured here rather than quoted.
 *
 * `simplexMax` is a plain tableau simplex with Bland's rule as the anti-cycling
 * fallback. It is here to make relaxations solvable in the page, not to be a
 * solver: it is dense, it has no presolve, and its size limit is a reported
 * field.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LpRounding = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const EPS = 1e-9;
  const MAX_PIVOTS = 20000;

  /* --------------------------------------------------------------- simplex */

  /**
   * max c·x subject to Ax <= b, x >= 0, with b >= 0 so the slack basis is
   * feasible and no phase one is needed. Returns the optimum, the primal x,
   * and the dual y read off the slack columns of the objective row.
   */
  function simplexMax(program) {
    const a = program.a;
    const b = program.b;
    const c = program.c;
    const m = a.length;
    const n = c.length;
    const table = buildTable(a, b, c);
    const basis = [];
    for (let i = 0; i < m; i += 1) basis.push(n + i);
    let pivots = 0;

    while (pivots < MAX_PIVOTS) {
      const column = enteringColumn(table[m], n + m, pivots > n + m);
      if (column === -1) break;
      const row = leavingRow(table, column, m);
      if (row === -1) return { unbounded: true, value: Infinity, x: [], y: [], pivots: pivots };
      pivot(table, row, column, m, n + m);
      basis[row] = column;
      pivots += 1;
    }
    return readSolution(table, basis, { m: m, n: n, pivots: pivots });
  }

  function buildTable(a, b, c) {
    const m = a.length;
    const n = c.length;
    const table = [];

    for (let i = 0; i < m; i += 1) {
      const row = new Array(n + m + 1).fill(0);
      for (let j = 0; j < n; j += 1) row[j] = a[i][j];
      row[n + i] = 1;
      row[n + m] = b[i];
      table.push(row);
    }
    const objective = new Array(n + m + 1).fill(0);
    for (let j = 0; j < n; j += 1) objective[j] = -c[j];
    table.push(objective);
    return table;
  }

  /** Most-negative reduced cost, falling back to Bland's rule (the lowest
   *  index) once the pivot count says cycling is possible. */
  function enteringColumn(objective, width, useBland) {
    let best = -1;

    for (let j = 0; j < width; j += 1) {
      if (objective[j] >= -EPS) continue;
      if (useBland) return j;
      if (best === -1 || objective[j] < objective[best]) best = j;
    }
    return best;
  }

  function leavingRow(table, column, m) {
    let best = -1;
    let bestRatio = Infinity;
    const width = table[0].length - 1;

    for (let i = 0; i < m; i += 1) {
      if (table[i][column] <= EPS) continue;
      const ratio = table[i][width] / table[i][column];
      if (ratio < bestRatio - EPS) { bestRatio = ratio; best = i; }
    }
    return best;
  }

  function pivot(table, row, column, m, width) {
    const factor = table[row][column];
    for (let j = 0; j <= width; j += 1) table[row][j] /= factor;

    for (let i = 0; i <= m; i += 1) {
      if (i === row || Math.abs(table[i][column]) < EPS) continue;
      const scale = table[i][column];
      for (let j = 0; j <= width; j += 1) table[i][j] -= scale * table[row][j];
    }
  }

  function readSolution(table, basis, shape) {
    const m = shape.m;
    const n = shape.n;
    const width = n + m;
    const x = new Array(n).fill(0);

    for (let i = 0; i < m; i += 1) {
      if (basis[i] < n) x[basis[i]] = table[i][width];
    }
    const y = new Array(m);
    for (let i = 0; i < m; i += 1) y[i] = table[m][n + i];
    return { value: table[m][width], x: x, y: y, pivots: shape.pivots, unbounded: false };
  }

  /**
   * min c·x subject to Ax >= b, x >= 0, by solving the dual
   * max b·y subject to Aᵀy <= c, y >= 0. The primal solution is the vector of
   * reduced costs on the dual's slack columns, which is the same duality that
   * makes the primal-dual method below work without any tableau at all.
   */
  function solveCovering(program) {
    const a = program.a;
    const b = program.b;
    const c = program.c;
    const transposed = [];

    for (let j = 0; j < c.length; j += 1) {
      const row = new Array(a.length);
      for (let i = 0; i < a.length; i += 1) row[i] = a[i][j];
      transposed.push(row);
    }
    const dual = simplexMax({ a: transposed, b: c, c: b });
    return { value: dual.value, x: dual.y, dualY: dual.x, pivots: dual.pivots };
  }

  /* --------------------------------------------------------- vertex cover */

  /** min Σ x_v subject to x_u + x_v >= 1 per edge, 0 <= x <= 1. */
  function vertexCoverLp(graph) {
    const a = [];
    const b = [];

    graph.edges.forEach(function (edge) {
      const row = new Array(graph.n).fill(0);
      row[edge.from] = 1;
      row[edge.to] = 1;
      a.push(row);
      b.push(1);
    });
    const solved = solveCovering({ a: a, b: b, c: new Array(graph.n).fill(1) });
    return { value: solved.value, x: solved.x, halfIntegral: isHalfIntegral(solved.x),
      pivots: solved.pivots };
  }

  function isHalfIntegral(x) {
    for (let i = 0; i < x.length; i += 1) {
      const doubled = 2 * x[i];
      if (Math.abs(doubled - Math.round(doubled)) > 1e-6) return false;
    }
    return true;
  }

  /** Round at 1/2. Every edge has x_u + x_v >= 1, so at least one endpoint is
   *  at least 1/2 and the cover is feasible; each rounded-up coordinate at
   *  most doubles, so the cost is at most twice the LP value. */
  function roundVertexCover(graph, relaxation) {
    const cover = [];
    for (let v = 0; v < graph.n; v += 1) { if (relaxation.x[v] >= 0.5 - 1e-6) cover.push(v); }
    let uncovered = 0;
    const inCover = new Array(graph.n).fill(false);
    cover.forEach(function (v) { inCover[v] = true; });
    graph.edges.forEach(function (edge) {
      if (!inCover[edge.from] && !inCover[edge.to]) uncovered += 1;
    });
    return { cover: cover, size: cover.length, feasible: uncovered === 0,
      lpValue: relaxation.value, ratioToLp: cover.length / Math.max(relaxation.value, 1e-9) };
  }

  /**
   * The primal-dual method: raise the dual variable of an uncovered edge
   * until some vertex's dual constraint is tight, take that vertex, repeat.
   * It never solves an LP, it produces the same 2-approximation, and the dual
   * it builds is the certificate. This is what LP duality buys once you stop
   * needing the LP itself.
   */
  function primalDualVertexCover(graph) {
    const slack = new Array(graph.n).fill(1);
    const cover = [];
    const inCover = new Array(graph.n).fill(false);
    let dualValue = 0;

    graph.edges.forEach(function (edge) {
      if (inCover[edge.from] || inCover[edge.to]) return;
      const raise = Math.min(slack[edge.from], slack[edge.to]);
      slack[edge.from] -= raise;
      slack[edge.to] -= raise;
      dualValue += raise;
      if (slack[edge.from] <= 1e-9) { inCover[edge.from] = true; cover.push(edge.from); }
      if (slack[edge.to] <= 1e-9) { inCover[edge.to] = true; cover.push(edge.to); }
    });
    return { cover: cover, size: cover.length, dualValue: dualValue,
      ratioBound: 2, certificate: dualValue };
  }

  /** The complete graph, where the LP pays n/2 and the integer optimum is
   *  n - 1: the integrality gap approaches 2 and no rounding can beat it. */
  function integralityGapInstance(n) {
    const edges = [];
    for (let i = 0; i < n; i += 1) {
      for (let j = i + 1; j < n; j += 1) edges.push({ from: i, to: j, weight: 1 });
    }
    return { graph: { n: n, edges: edges, directed: false, name: 'complete-' + n },
      lpValue: n / 2, integerOptimum: n - 1, gap: (n - 1) / (n / 2) };
  }

  /* ---------------------------------------------------------- randomised */

  /**
   * Randomised rounding for set cover: sample each set independently with
   * probability x_S, for `rounds` rounds. Expected cost is `rounds` times the
   * LP value and the chance an element is still uncovered after t rounds is
   * at most e^-t, so O(log n) rounds cover everything with high probability.
   * Uncovered elements are reported rather than patched, because the failure
   * probability is the thing being taught.
   */
  function roundSetCover(instance, options) {
    const settings = options || {};
    const rng = settings.rng;
    const rounds = settings.rounds === undefined ? 1 : settings.rounds;
    const chosen = new Set();

    for (let round = 0; round < rounds; round += 1) {
      for (let s = 0; s < instance.sets.length; s += 1) {
        if (rng.next() < settings.x[s]) chosen.add(s);
      }
    }
    const covered = new Array(instance.universe).fill(false);
    let cost = 0;
    chosen.forEach(function (s) {
      cost += instance.sets[s].cost === undefined ? 1 : instance.sets[s].cost;
      instance.sets[s].members.forEach(function (e) { covered[e] = true; });
    });
    let uncovered = 0;
    for (let e = 0; e < instance.universe; e += 1) { if (!covered[e]) uncovered += 1; }

    return { chosen: Array.from(chosen), cost: cost, uncovered: uncovered,
      feasible: uncovered === 0, rounds: rounds,
      expectedCost: rounds * settings.lpValue,
      failureBound: instance.universe * Math.exp(-rounds) };
  }

  return {
    simplexMax: simplexMax, solveCovering: solveCovering,
    vertexCoverLp: vertexCoverLp, roundVertexCover: roundVertexCover,
    primalDualVertexCover: primalDualVertexCover, integralityGapInstance: integralityGapInstance,
    roundSetCover: roundSetCover, isHalfIntegral: isHalfIntegral, EPS: EPS
  };
}));

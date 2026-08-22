'use strict';

/**
 * Property tests for the M14 modules, every one against an independent oracle.
 *
 * Flow, matching and colouring all fail the same way: they return a
 * well-formed answer that is slightly wrong, and no amount of "does it look
 * like a flow" catches that. So each family here is checked against something
 * that owes it nothing - a brute-force search, a second algorithm built on a
 * different idea, or a structural invariant computed from the answer rather
 * than alongside it.
 */

const test = require('node:test');
const assert = require('node:assert');

const MaxFlow = require('../../src/js/algorithms/max-flow.js');
const PushRelabel = require('../../src/js/algorithms/push-relabel.js');
const MinCostFlow = require('../../src/js/algorithms/min-cost-flow.js');
const Matching = require('../../src/js/algorithms/matching.js');
const Weighted = require('../../src/js/algorithms/weighted-matching.js');
const TwoSat = require('../../src/js/algorithms/two-sat.js');
const Coloring = require('../../src/js/algorithms/coloring.js');
const Layout = require('../../src/js/algorithms/layout.js');
const Spectral = require('../../src/js/algorithms/spectral.js');
const Centrality = require('../../src/js/algorithms/centrality.js');
const FlowLab = require('../../src/js/machines/flow-lab.js');
const MatchingLab = require('../../src/js/machines/matching-lab.js');
const SatLab = require('../../src/js/machines/sat-lab.js');
const AnalysisLab = require('../../src/js/machines/graph-analysis-lab.js');
const Random = require('../../src/js/utils/random.js');

/* ------------------------------------------------------------------ flow */

test('max flow: six algorithms agree on value, cut and validity across every shape', function () {
  FlowLab.SHAPES.forEach(function (shape) {
    for (let seed = 1; seed <= 4; seed += 1) {
      const graph = FlowLab.build({ shape: shape, seed: seed });
      const run = FlowLab.compareFlows(graph, {});

      assert.strictEqual(run.disagreements, 0, shape + ' seed ' + seed + ': value disagreement');
      assert.strictEqual(run.cutMismatches, 0, shape + ' seed ' + seed + ': a cut that is not tight');
      assert.strictEqual(run.invalid, 0, shape + ' seed ' + seed + ': an invalid flow');
    }
  });
});

test('max flow: every arc crossing the minimum cut is saturated', function () {
  for (let seed = 1; seed <= 6; seed += 1) {
    const graph = FlowLab.build({ shape: 'layered', seed: seed });
    const state = FlowLab.singleRun(graph, { algorithm: 'dinic' });
    /* `minCut` reports the source side as a boolean per vertex, not a list. */
    const inside = state.cut.side;
    let capacity = 0;

    state.flows.forEach(function (entry) {
      if (!inside[entry.from] || inside[entry.to]) return;
      assert.strictEqual(entry.flow, entry.capacity,
        'seed ' + seed + ': arc ' + entry.from + '->' + entry.to + ' crosses the cut with slack');
      capacity += entry.capacity;
    });
    assert.strictEqual(capacity, state.value, 'seed ' + seed + ': the cut does not equal the flow');
  }
});

test('max flow: path filling without a residual arc is wrong, not slow', function () {
  const graph = MaxFlow.backEdgeExample(1000);
  const greedy = MaxFlow.greedyNoResidual(graph, graph.source, graph.sink, {});
  const proper = MaxFlow.fordFulkerson(graph, graph.source, graph.sink, {});

  assert.strictEqual(proper.value, 2000);
  assert.strictEqual(greedy.value, 1999);
  let short = 0;

  for (let seed = 1; seed <= 20; seed += 1) {
    const network = FlowLab.build({ shape: 'layered', seed: seed });
    const rough = MaxFlow.greedyNoResidual(network, network.source, network.sink, {}).value;

    if (rough >= MaxFlow.dinic(network, network.source, network.sink, {}).value) continue;
    short += 1;
  }
  assert.ok(short > 0, 'the greedy must fall short on unarranged networks too');
});

test('push-relabel: heights stay valid and nothing is left active, under every setting', function () {
  ['fifo', 'highest'].forEach(function (rule) {
    for (let seed = 1; seed <= 5; seed += 1) {
      const graph = FlowLab.build({ shape: 'layered', seed: seed });

      FlowLab.heuristicSweep(graph, { rule: rule }).forEach(function (row) {
        const label = rule + ' seed ' + seed + ' gap=' + row.gap + ' global=' + row.globalRelabel;

        assert.strictEqual(row.heights.valid, true, label + ': the height invariant broke');
        assert.strictEqual(row.heights.stillActive, 0, label + ': a vertex is still holding excess');
        assert.strictEqual(row.value,
          MaxFlow.dinic(graph, graph.source, graph.sink, {}).value, label + ': wrong value');
      });
    }
  });
});

test('min-cost flow: the two methods agree, and the optimum is convex in the value', function () {
  for (let seed = 1; seed <= 4; seed += 1) {
    const random = Random.seeded(seed);
    const matrix = [];

    for (let r = 0; r < 5; r += 1) {
      const row = [];

      for (let c = 0; c < 5; c += 1) row.push(1 + random.int(20));
      matrix.push(row);
    }
    const network = MinCostFlow.assignmentNetwork(matrix);
    const ssp = MinCostFlow.successiveShortestPaths(network, network.source, network.sink, {});
    const cancel = MinCostFlow.cycleCancelling(network, network.source, network.sink, {});
    const truth = MatchingLab.bruteForceAssignment(matrix);

    assert.strictEqual(ssp.cost, truth.cost, 'seed ' + seed + ': successive shortest paths');
    assert.strictEqual(cancel.cost, truth.cost, 'seed ' + seed + ': cycle cancelling');
    assert.strictEqual(MinCostFlow.checkOptimal(ssp.network).optimal, true,
      'seed ' + seed + ': the residual of an optimal flow has a negative cycle');
    const costs = [];

    for (let limit = 1; limit <= 5; limit += 1) {
      costs.push(MinCostFlow.successiveShortestPaths(network, network.source, network.sink,
        { flowLimit: limit }).cost);
    }

    for (let i = 2; i < costs.length; i += 1) {
      assert.ok(costs[i] - costs[i - 1] >= costs[i - 1] - costs[i - 2],
        'seed ' + seed + ': marginal costs ' + costs.join(',') + ' are not convex');
    }
  }
});

/* -------------------------------------------------------------- matching */

test('bipartite matching: three methods agree and every result is a real matching', function () {
  MatchingLab.SHAPES.forEach(function (shape) {
    for (let seed = 1; seed <= 4; seed += 1) {
      const graph = MatchingLab.build({ shape: shape, seed: seed });
      const run = MatchingLab.compareMatchings(graph);

      assert.strictEqual(run.disagreements, 0, shape + ' seed ' + seed + ': size disagreement');
      assert.strictEqual(run.invalid, 0, shape + ' seed ' + seed + ': an invalid matching');
    }
  });
});

test('Koenig: the cover has the matching size and touches every edge', function () {
  MatchingLab.SHAPES.forEach(function (shape) {
    for (let seed = 1; seed <= 4; seed += 1) {
      const graph = MatchingLab.build({ shape: shape, seed: seed });
      const state = MatchingLab.structureRun(graph);

      assert.strictEqual(state.check.valid, true, shape + ' seed ' + seed + ': an uncovered edge');
      assert.strictEqual(state.cover.size, state.matching.size,
        shape + ' seed ' + seed + ': cover ' + state.cover.size + ' against matching ' +
          state.matching.size);
    }
  });
});

test('Hall: a witness really has fewer neighbours than members', function () {
  ['deficiency', 'unbalanced', 'sparse'].forEach(function (shape) {
    for (let seed = 1; seed <= 5; seed += 1) {
      const graph = MatchingLab.build({ shape: shape, seed: seed });
      const state = MatchingLab.structureRun(graph);

      if (!state.violator || !state.violator.violates) continue;
      assert.ok(state.violator.neighbours.length < state.violator.set.length,
        shape + ' seed ' + seed + ': the witness does not violate anything');
      const allowed = new Set(state.violator.neighbours);

      state.violator.set.forEach(function (a) {
        graph.edges.forEach(function (edge) {
          if (edge.from !== a) return;
          assert.ok(allowed.has(edge.to),
            shape + ' seed ' + seed + ': left ' + a + ' has a neighbour outside the witness set');
        });
      });
    }
  });
});

test('Gale-Shapley: stable both ways, and no proposer is ever worse off proposing', function () {
  for (let seed = 1; seed <= 6; seed += 1) {
    const run = MatchingLab.stableRun({ size: 8, seed: seed });

    assert.strictEqual(run.leftBlocking.length, 0, 'seed ' + seed + ': left-proposing is unstable');
    assert.strictEqual(run.rightBlocking.length, 0, 'seed ' + seed + ': right-proposing is unstable');
    assert.ok(run.leftRank <= run.rightRank,
      'seed ' + seed + ': the left side did worse proposing (' + run.leftRank + ' against ' +
        run.rightRank + ')');
    run.byLeft.matchLeft.forEach(function (partner, who) {
      const mine = run.left[who].indexOf(partner);
      const theirs = run.left[who].indexOf(run.byRight.matchRight[who]);

      assert.ok(mine <= theirs,
        'seed ' + seed + ': proposer ' + who + ' is worse off proposing, which the theorem forbids');
    });
  }
});

test('general matching: Edmonds equals brute force, and the shortcut sometimes does not', function () {
  for (let seed = 1; seed <= 30; seed += 1) {
    const adjacency = MatchingLab.generalGraph({ n: 12, m: 18, seed: seed });
    const run = MatchingLab.generalRun({ adjacency: adjacency });

    assert.strictEqual(run.optimal, true, 'seed ' + seed + ': Edmonds disagrees with brute force');
    assert.strictEqual(run.check.valid, true, 'seed ' + seed + ': an inconsistent matching');
  }
  /* The failure rate is the section's whole point, and it is low - so the
     assertion has to run over enough graphs to see it rather than over a
     handful that happen to be easy. */
  const rate = MatchingLab.naiveFailureRate({ n: 14, m: 24, trials: 60 });

  assert.ok(rate.short > 0,
    'the naive search must fall short somewhere in ' + rate.trials + ' random graphs');
  assert.ok(rate.short < rate.trials / 5,
    'and it must be RARE - a bug that fires often is a bug somebody finds');
});

test('general matching: the counter-example answers differently by neighbour order alone', function () {
  const failing = MatchingLab.generalRun({ adjacency: MatchingLab.oddCycleFixture('failing') });
  const sorted = MatchingLab.generalRun({ adjacency: MatchingLab.oddCycleFixture('sorted') });

  assert.strictEqual(failing.blossom.size, 3);
  assert.strictEqual(sorted.blossom.size, 3);
  assert.strictEqual(failing.naive.size, 2, 'the failing order must expose the bug');
  assert.strictEqual(sorted.naive.size, 3, 'the sorted order must hide it');
});

test('Hungarian: optimal against brute force, with a dual certificate that holds', function () {
  for (let size = 3; size <= 7; size += 1) {
    for (let seed = 1; seed <= 3; seed += 1) {
      const run = MatchingLab.assignmentRun({ size: size, seed: seed });

      assert.strictEqual(run.optimal, true, size + 'x' + size + ' seed ' + seed + ': not optimal');
      assert.strictEqual(run.check.valid, true, 'the dual certificate does not hold');
      assert.ok(run.greedy.cost >= run.run.cost, 'greedy cannot beat the optimum');
      assert.strictEqual(new Set(run.run.assignment).size, size, 'not a permutation');
    }
  }
});

/* ----------------------------------------------------------------- 2-SAT */

test('2-SAT: the verdict matches an exhaustive search on every instance family', function () {
  SatLab.MODELS.forEach(function (model) {
    for (let seed = 1; seed <= 8; seed += 1) {
      const instance = SatLab.build({ model: model, variables: 9, clauses: 12, seed: seed });
      const state = SatLab.solveRun(instance);

      assert.strictEqual(state.agrees, true, model + ' seed ' + seed + ': disagrees with the oracle');
      assert.strictEqual(state.valid, true, model + ' seed ' + seed + ': the assignment breaks a clause');
    }
  });
});

test('2-SAT: dropping the contrapositive makes the solver claim satisfiability it has not got', function () {
  let overclaimed = 0;

  for (let seed = 1; seed <= 60; seed += 1) {
    const instance = SatLab.build({ model: 'random', variables: 8, clauses: 18, seed: seed });
    const truth = TwoSat.solveByBruteForce(instance.variables, instance.clauses);
    const halfGraph = { n: 2 * instance.variables, directed: true,
      edges: instance.clauses.map(function (clause) {
        return { from: TwoSat.negate(clause[0]), to: clause[1], weight: 1 };
      }) };
    const Scc = require('../../src/js/algorithms/scc.js');
    const Core = require('../../src/js/algorithms/graph-core.js');
    const run = Scc.tarjan(Core.adjacencyList(halfGraph), {});
    let contradictions = 0;

    for (let v = 0; v < instance.variables; v += 1) {
      if (run.component[2 * v] !== run.component[2 * v + 1]) continue;
      contradictions += 1;
    }

    if (contradictions > 0 || truth.satisfiable) continue;
    overclaimed += 1;
  }
  assert.ok(overclaimed > 0,
    'a half-built implication graph must claim satisfiability somewhere in 60 instances');
});

test('2-SAT: relaxing a three-literal clause is never wrongly positive', function () {
  [10, 20, 30].forEach(function (clauses) {
    const run = SatLab.relaxationRun({ variables: 9, trials: 60, clauses: clauses });

    assert.strictEqual(run.falseSat, 0,
      clauses + ' clauses: dropping a literal only strengthens the constraint');
    assert.ok(run.checked === undefined || run.checked > 0);
  });
  const dense = SatLab.relaxationRun({ variables: 9, trials: 60, clauses: 30 });

  assert.ok(dense.wrongUnsat > 0, 'and it must be wrongly negative often enough to matter');
});

/* ------------------------------------------------------------- colouring */

test('colouring: every ordering is proper, and degeneracy order respects its bound', function () {
  AnalysisLab.SHAPES.forEach(function (shape) {
    for (let seed = 1; seed <= 3; seed += 1) {
      const instance = AnalysisLab.build({ shape: shape, n: 18, seed: seed });
      const run = AnalysisLab.colouringRun(instance, { exactLimit: 14 });

      assert.strictEqual(run.conflicts, 0, shape + ' seed ' + seed + ': an improper colouring');
      const degeneracyRow = run.rows.filter(function (row) { return row.name === 'degeneracy'; })[0];

      assert.ok(degeneracyRow.colours <= run.bound,
        shape + ' seed ' + seed + ': ' + degeneracyRow.colours + ' colours against a bound of ' +
          run.bound);
    }
  });
});

test('colouring: the clique number is a lower bound on the chromatic number', function () {
  for (let seed = 1; seed <= 6; seed += 1) {
    const instance = AnalysisLab.build({ shape: 'random', n: 14, seed: seed });
    const colouring = AnalysisLab.colouringRun(instance, { exactLimit: 16 });
    const cliques = AnalysisLab.cliqueRun(instance);

    assert.strictEqual(cliques.cliqueCheck.valid, true, 'seed ' + seed + ': not a clique');
    assert.strictEqual(cliques.independentCheck.valid, true, 'seed ' + seed + ': not independent');
    assert.ok(colouring.exact >= cliques.clique.length,
      'seed ' + seed + ': chromatic number ' + colouring.exact + ' below clique ' +
        cliques.clique.length);
    assert.strictEqual(cliques.cover + cliques.free.length, instance.adjacency.length,
      'seed ' + seed + ': cover plus independent set must be n');
  }
});

test('colouring: the pivot changes the work and never the cliques found', function () {
  for (let seed = 1; seed <= 5; seed += 1) {
    const instance = AnalysisLab.build({ shape: 'clustered', n: 16, seed: seed });
    const run = AnalysisLab.cliqueRun(instance);

    assert.strictEqual(run.pivoted.report.maximalCliques, run.plain.report.maximalCliques,
      'seed ' + seed + ': the pivot changed the answer');
    assert.strictEqual(run.pivoted.largest, run.plain.largest);
  }
});

test('colouring: an interval graph is coloured optimally by the left-endpoint sweep', function () {
  for (let seed = 1; seed <= 6; seed += 1) {
    const instance = AnalysisLab.build({ shape: 'interval', n: 14, seed: seed });
    const order = Coloring.leftEndpointOrder(instance.intervals);
    const run = Coloring.greedyColoring(instance.adjacency, order, {});

    assert.strictEqual(Coloring.checkColoring(instance.adjacency, run.colour).valid, true);
    assert.strictEqual(run.colours, Coloring.maxOverlap(instance.intervals),
      'seed ' + seed + ': greedy in left-endpoint order must use exactly the maximum overlap');
  }
});

test('register allocation: never invalid, and the spill count falls as registers rise', function () {
  for (let seed = 1; seed <= 5; seed += 1) {
    const instance = AnalysisLab.build({ shape: 'random', n: 20, seed: seed });
    let previous = Infinity;

    [2, 3, 4, 5, 6, 8].forEach(function (registers) {
      const run = AnalysisLab.chaitinRun(instance.adjacency, registers);

      assert.strictEqual(run.check.valid, true,
        'seed ' + seed + ' at ' + registers + ' registers: two neighbours share a register');
      assert.ok(run.spills <= previous,
        'seed ' + seed + ': spills rose from ' + previous + ' to ' + run.spills +
          ' when a register was added');
      previous = run.spills;
    });
  }
});

/* ---------------------------------------------------------------- layout */

test('layout: deterministic for a seed, and the final energy is below the first', function () {
  ['random', 'planar-grid', 'clustered'].forEach(function (shape) {
    const instance = AnalysisLab.build({ shape: shape, n: 20, seed: 1 });
    const first = AnalysisLab.energyCurve(instance, { steps: 80, seed: 3 });
    const second = AnalysisLab.energyCurve(instance, { steps: 80, seed: 3 });

    assert.deepStrictEqual(first.curve, second.curve, shape + ': the layout is not deterministic');
    assert.ok(first.last < first.first,
      shape + ': energy went from ' + first.first + ' to ' + first.last);
  });
});

test('layout: the descent is NOT monotone, which is what the cooling schedule implies', function () {
  const instance = AnalysisLab.build({ shape: 'random', n: 24, seed: 1 });
  const run = AnalysisLab.energyCurve(instance, { steps: 200, seed: 1 });

  assert.ok(run.rises > 0,
    'a temperature-capped finite step can overshoot; if this is ever 0 the claim in the ' +
      'section is wrong and the prose must change with it');
  assert.ok(run.rises < run.curve.length - 1, 'and it cannot rise on every step either');
});

test('layout: crossings are counted only between edges sharing no endpoint', function () {
  const positions = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }];

  assert.strictEqual(Layout.crossings(positions, [{ from: 0, to: 1 }, { from: 0, to: 2 }]), 0,
    'two edges meeting at a vertex are not a crossing');
  assert.strictEqual(Layout.crossings(positions, [{ from: 0, to: 3 }, { from: 1, to: 2 }]), 1,
    'the two diagonals of a square cross exactly once');
});

test('planarity: the counting bounds reject K5 and K3,3 by two different arguments', function () {
  const fixtures = AnalysisLab.kuratowskiFixtures();
  const k5 = AnalysisLab.planarityChecks(fixtures[0]);
  const k33 = AnalysisLab.planarityChecks(fixtures[1]);

  assert.strictEqual(k5.edges, 10);
  assert.strictEqual(k5.general, 9);
  assert.strictEqual(k5.failsGeneral, true, 'Euler must catch K5');
  assert.strictEqual(k33.edges, 9);
  assert.strictEqual(k33.general, 12);
  assert.strictEqual(k33.failsGeneral, false, 'Euler must MISS K3,3 — that is the point');
  assert.strictEqual(k33.bipartite, 8);
  assert.strictEqual(k33.failsBipartite, true, 'the bipartite bound must catch it');
});

/* -------------------------------------------------------------- spectral */

test('PageRank: power iteration matches a linear solve and conserves probability', function () {
  for (let seed = 1; seed <= 5; seed += 1) {
    const web = AnalysisLab.webGraph({ n: 25, seed: seed });
    const run = AnalysisLab.pageRankRun(web, {});

    assert.ok(Math.abs(run.goodTotal.total - 1) < 1e-9,
      'seed ' + seed + ': the vector holds ' + run.goodTotal.total);
    assert.ok(run.gap < 1e-8,
      'seed ' + seed + ': power iteration differs from the solve by ' + run.gap);
    assert.strictEqual(run.goodTotal.negative, 0, 'a probability cannot be negative');
    assert.ok(run.leakyTotal.total < 0.95,
      'seed ' + seed + ': dropping the dangling mass must actually leak');
  }
});

test('PageRank: dropping the dangling mass leaves the ranking untouched', function () {
  const search = AnalysisLab.leakSearch({ trials: 1500 });

  assert.ok(search.checked > 500, 'the search must actually find graphs with dangling pages');
  assert.strictEqual(search.inversions, 0,
    'the folk claim is that the ranking drifts; over ' + search.checked +
      ' link graphs it does not, and the section says so');
  assert.ok(search.worstLeak > 0.5, 'while the mass leak is severe');
});

test('spectral: the Fiedler value is zero exactly when the graph is disconnected', function () {
  const joined = AnalysisLab.build({ shape: 'clustered', n: 20, seed: 1 });
  const split = AnalysisLab.build({ shape: 'clustered', n: 20, seed: 1, connect: false, bridges: 0 });
  const a = Spectral.spectralBisection(joined.adjacency, {});
  const b = Spectral.spectralBisection(split.adjacency, {});

  assert.ok(a.eigenvalue > 1e-6, 'a connected graph has positive algebraic connectivity');
  assert.ok(b.eigenvalue < 1e-6, 'a disconnected one has none');
  assert.strictEqual(b.cut, 0, 'and the bisection of a disconnected graph cuts nothing');
});

test('centrality: Brandes agrees with path enumeration', function () {
  for (let seed = 1; seed <= 4; seed += 1) {
    const instance = AnalysisLab.build({ shape: 'random', n: 16, seed: seed });
    const brandes = Centrality.brandes(instance.adjacency, {}).score;
    const exact = Centrality.betweennessByEnumeration(instance.adjacency);

    brandes.forEach(function (value, v) {
      assert.ok(Math.abs(value - exact[v]) < 1e-9,
        'seed ' + seed + ': vertex ' + v + ' scores ' + value + ' against ' + exact[v]);
    });
  }
});

test('communities: Louvain recovers a planted partition and invents one from noise', function () {
  const planted = AnalysisLab.build({ shape: 'clustered', n: 24, seed: 1 });
  const found = AnalysisLab.communityRun(planted, {});

  assert.strictEqual(found.matches.rand, 1, 'the planted grouping must be recovered exactly');
  assert.ok(found.run.modularity > 0.5, 'and score well');
  const noise = AnalysisLab.build({ shape: 'random', n: 24, seed: 1 });
  const invented = AnalysisLab.communityRun(noise, {});

  assert.ok(invented.run.communities > 1,
    'Louvain returns communities on a graph that has none, which is the number to remember');
  assert.ok(invented.run.modularity > 0.15 && invented.run.modularity < 0.4,
    'and it scores around 0.25 — the floor to read every claim against');
});

/* ------------------------------------------------------------ reductions */

test('reductions: every named reduction round-trips against a direct solve', function () {
  const ReductionLab = require('../../src/js/machines/reduction-lab.js');

  ReductionLab.NAMES.forEach(function (name) {
    for (let seed = 1; seed <= 5; seed += 1) {
      const instance = ReductionLab.instanceFor(name, seed, {});
      const run = ReductionLab.run(name, instance);

      assert.strictEqual(run.valid, true, name + ' seed ' + seed + ': ' + run.note);
    }
  });
});

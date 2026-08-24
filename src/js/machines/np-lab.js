/**
 * NpLab — the studies behind 20.1 to 20.5, all of them measured on both sides.
 *
 * One discipline runs through every study here and it is the thing this
 * milestone is really about: **a hardness claim is a claim about the NO side.**
 * A backtracking search on a YES instance often finds the planted answer
 * immediately and looks fast; the same search on a NO instance has to exhaust
 * its space to say so. So every comparison in this file runs a YES instance
 * and a NO instance of the same size side by side, and the column that matters
 * is the second one.
 *
 * The second discipline is that the target of a reduction is solved by an
 * EXHAUSTIVE search, and that search is exponential. The reduction itself is
 * polynomial and finishes instantly on any instance a browser can hold; what
 * cannot be scaled up is the solve. Instances here are therefore tiny — five
 * variables, ten clauses — and the reason is a reported field rather than a
 * silent choice, because "the demo uses six variables" and "the demo is
 * cheating" look identical from outside.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.NpLab = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const Random = scope && scope.Random ? scope.Random : require('../utils/random.js');
  const Sat = scope && scope.SatBasics ? scope.SatBasics : require('../algorithms/sat-basics.js');
  const Verifiers = scope && scope.NpVerifiers ? scope.NpVerifiers
    : require('../algorithms/np-verifiers.js');
  const Generators = scope && scope.InstanceGenerators ? scope.InstanceGenerators
    : require('../algorithms/instance-generators.js');
  const Reductions = scope && scope.Reductions ? scope.Reductions
    : require('../algorithms/reductions.js');
  const Qbf = scope && scope.Qbf ? scope.Qbf : require('../algorithms/qbf.js');
  const Fpt = scope && scope.Fpt ? scope.Fpt : require('../algorithms/fpt.js');
  const GraphCore = scope && scope.GraphCore ? scope.GraphCore
    : require('../algorithms/graph-core.js');

  /* --------------------------------------- 20.1 certificates and searches */

  /**
   * Four problems, each with a YES instance carrying a planted certificate and
   * a NO instance carrying a structural obstruction. The verifier is run on
   * the certificate, on a corrupted copy of it and on a malformed one; the
   * search is run on both instances. Six columns, and the one that carries the
   * lesson is the search on the NO side.
   */
  function certificateStudy(options) {
    const settings = options || {};
    const size = settings.size === undefined ? 12 : settings.size;
    const seed = settings.seed === undefined ? 3 : settings.seed;

    return { size: size, seed: seed, rows: [
      hamiltonianRow(size, seed), subsetSumRow(size, seed),
      colouringRow(size, seed), cliqueRow(size, seed)
    ] };
  }

  function hamiltonianRow(size, seed) {
    const yes = Generators.hamiltonianGraph({ n: size, seed: seed });
    const no = Generators.nonHamiltonianGraph({ n: size, seed: seed });
    const corrupted = yes.cycle.slice();
    const swap = corrupted[0];

    corrupted[0] = corrupted[2];
    corrupted[2] = swap;
    return buildRow('hamiltonian', 'Hamiltonian cycle', {
      verify: Verifiers.verifyHamiltonian(yes.graph, yes.cycle),
      wrong: Verifiers.verifyHamiltonian(yes.graph, corrupted),
      malformed: Verifiers.verifyHamiltonian(yes.graph, yes.cycle.slice(0, size - 1)),
      searchYes: Verifiers.searchHamiltonian(yes.graph),
      searchNo: Verifiers.searchHamiltonian(no.graph),
      certificate: size + ' vertex indices', reason: no.reason,
      space: '(n − 1)! = ' + factorialText(size - 1) + ' orders'
    });
  }

  function subsetSumRow(size, seed) {
    const yes = Generators.subsetSumInstance({ count: size, seed: seed, bound: 5000 });
    const no = Generators.unsolvableSubsetSum({ count: size, seed: seed, bound: 5000 });
    const corrupted = yes.solution.slice(0, Math.max(1, yes.solution.length - 1));

    return buildRow('subset-sum', 'Subset sum', {
      verify: Verifiers.verifySubsetSum(yes, yes.solution),
      wrong: Verifiers.verifySubsetSum(yes, corrupted),
      malformed: Verifiers.verifySubsetSum(yes, yes.solution.concat([size + 40])),
      searchYes: Verifiers.searchSubsetSum(yes),
      searchNo: Verifiers.searchSubsetSum(no),
      certificate: yes.solution.length + ' indices', reason: no.reason,
      space: '2ⁿ = ' + Math.pow(2, size).toLocaleString('en-GB') + ' subsets'
    });
  }

  function colouringRow(size, seed) {
    const yes = Generators.colourableGraph({ n: size, seed: seed });
    const no = Generators.nonColourableGraph({ n: size, seed: seed });
    const corrupted = yes.colours.slice();

    corrupted[0] = (corrupted[0] + 1) % 3;
    return buildRow('colouring', '3-colouring', {
      verify: Verifiers.verifyColouring(yes.graph, yes.colours, 3),
      wrong: Verifiers.verifyColouring(yes.graph, corrupted, 3),
      malformed: Verifiers.verifyColouring(yes.graph, yes.colours.slice(0, size - 2), 3),
      searchYes: Verifiers.searchColouring(yes.graph, 3),
      searchNo: Verifiers.searchColouring(no.graph, 3),
      certificate: size + ' colours', reason: no.reason,
      space: '3ⁿ = ' + Math.pow(3, size).toLocaleString('en-GB') + ' assignments'
    });
  }

  /**
   * The NO instance is a DENSE random graph asked for a clique three sizes
   * above the one it has. A sparse graph is a NO instance the search refutes
   * in a few dozen steps, which measures the sparsity rather than the problem
   * — the first version of this row reported a search-to-verify ratio of 2.4.
   */
  function cliqueRow(size, seed) {
    const target = 5;
    const yes = Generators.cliqueGraph({ n: size + 6, size: target, seed: seed, density: 0.2 });
    const no = Generators.cliqueGraph({ n: size + 8, size: 2, seed: seed + 40, density: 0.5 });
    const corrupted = yes.clique.slice(0, target - 1).concat([(yes.clique[0] + 1) % (size + 6)]);

    return buildRow('clique', 'Clique of size ' + target, {
      verify: Verifiers.verifyClique(yes.graph, yes.clique, target),
      wrong: Verifiers.verifyClique(yes.graph, corrupted, target),
      malformed: Verifiers.verifyClique(yes.graph, yes.clique.slice(0, 3), target),
      searchYes: Verifiers.searchClique(yes.graph, target),
      searchNo: Verifiers.searchClique(no.graph, target + 3),
      certificate: target + ' vertex indices',
      reason: 'a graph at density 0.5 on ' + (size + 8) + ' vertices has no clique of size ' +
        (target + 3),
      space: 'C(n, k) vertex sets'
    });
  }

  function buildRow(id, label, parts) {
    return { id: id, label: label, certificate: parts.certificate, space: parts.space,
      reason: parts.reason,
      verifySteps: parts.verify.steps, verifyAccepted: parts.verify.accepted,
      wrongRejected: !parts.wrong.accepted, wrongReason: parts.wrong.reason,
      malformedRejected: !parts.malformed.accepted, malformedReason: parts.malformed.reason,
      searchYesSteps: parts.searchYes.steps, searchYesFound: parts.searchYes.found,
      searchNoSteps: parts.searchNo.steps, searchNoFound: parts.searchNo.found,
      ratioYes: parts.searchYes.steps / Math.max(1, parts.verify.steps),
      ratioNo: parts.searchNo.steps / Math.max(1, parts.verify.steps) };
  }

  function factorialText(n) {
    let value = 1;

    for (let i = 2; i <= n; i += 1) value *= i;
    return value.toExponential(2);
  }

  /**
   * The same problem at rising size, so "polynomial" and "exponential" are two
   * measured columns rather than two words. The verifier's cost is linear in
   * the instance; the search on the NO side is not.
   */
  function costSweep(options) {
    const settings = options || {};
    const rows = [];

    for (let n = settings.from === undefined ? 8 : settings.from;
      n <= (settings.to === undefined ? 15 : settings.to); n += 1) {
      const no = Generators.nonHamiltonianGraph({ n: n, seed: 4 });
      const yes = Generators.hamiltonianGraph({ n: n, seed: 4 });
      rows.push({ n: n, verify: Verifiers.verifyHamiltonian(yes.graph, yes.cycle).steps,
        searchYes: Verifiers.searchHamiltonian(yes.graph).steps,
        searchNo: Verifiers.searchHamiltonian(no.graph).steps });
    }
    return { rows: rows, growth: growthOf(rows) };
  }

  function growthOf(rows) {
    const ratios = [];

    for (let i = 1; i < rows.length; i += 1) {
      if (rows[i - 1].searchNo <= 0) continue;
      ratios.push(rows[i].searchNo / rows[i - 1].searchNo);
    }
    if (ratios.length === 0) return null;
    return ratios.reduce(function (a, b) { return a + b; }, 0) / ratios.length;
  }

  /* ------------------------------------------------------- 20.2 reductions */

  /**
   * One reduction, end to end: the source, the gadgets, the target, the target
   * solved, the answer mapped back and validated against the SOURCE. The last
   * step is the one that is usually missing and the only one that catches a
   * gadget of the wrong shape.
   */
  function reductionStudy(options) {
    const settings = options || {};
    const name = settings.name === undefined ? 'sat-to-independent-set' : settings.name;
    const source = sourceFor(name, settings);
    const started = { at: 0 };
    const result = Reductions.run(name, source.instance);

    return { name: name, source: source, result: result, started: started,
      gadgets: gadgetsFor(name, result), targetSize: targetSizeOf(result),
      valid: result.valid, agrees: result.agrees,
      answer: result.sourceSatisfiable ? 'YES' : 'NO' };
  }

  function sourceFor(name, settings) {
    const variables = settings.variables === undefined ? 5 : settings.variables;
    const clauses = settings.clauses === undefined ? 9 : settings.clauses;
    const seed = settings.seed === undefined ? 2 : settings.seed;

    if (name === 'vertex-cover-to-set-cover') {
      const graph = Generators.colourableGraph({ n: 8, seed: seed }).graph;
      /* The NO side of a vertex-cover instance is a budget too small to cover
         the graph, not a different graph — the source problem carries its own
         answer in the size bound, so that is the dial to move. */
      const size = settings.unsatisfiable ? 1 : (settings.size === undefined ? 5 : settings.size);
      return { kind: 'vertex-cover', instance: { graph: graph, size: size },
        describe: graph.n + ' vertices, ' + graph.edges.length + ' edges, budget ' + size };
    }
    if (name === 'subset-sum-to-partition') {
      const instance = settings.unsatisfiable
        ? Generators.unsolvableSubsetSum({ count: 10, seed: seed, bound: 400 })
        : Generators.subsetSumInstance({ count: 10, seed: seed, bound: 400 });
      return { kind: 'subset-sum', instance: instance,
        describe: instance.numbers.length + ' numbers, target ' + instance.target };
    }
    const formula = settings.unsatisfiable
      ? Sat.createFormula(3, unsatCore())
      : Generators.randomKSat({ variables: variables, clauses: clauses, seed: seed });
    return { kind: '3-sat', instance: formula,
      describe: formula.variables + ' variables, ' + formula.clauses.length + ' clauses' };
  }

  /** Every 3-clause over three variables: the cheapest unsatisfiable 3-CNF. */
  function unsatCore() {
    const clauses = [];

    for (let mask = 0; mask < 8; mask += 1) {
      clauses.push([mask & 1 ? -1 : 1, mask & 2 ? -2 : 2, mask & 4 ? -3 : 3]);
    }
    return clauses;
  }

  function targetSizeOf(result) {
    if (result.map.graph) {
      return { vertices: result.map.graph.n, edges: result.map.graph.edges.length,
        target: result.map.target };
    }
    if (result.map.sets) return { sets: result.map.sets.length, universe: result.map.universe };
    return { numbers: result.map.numbers.length };
  }

  /** The first few gadgets, as rows a table can show. */
  function gadgetsFor(name, result) {
    if (!result.map.nodes) return [];
    const byClause = new Map();

    result.map.nodes.forEach(function (node, index) {
      if (!byClause.has(node.clause)) byClause.set(node.clause, []);
      byClause.get(node.clause).push({ index: index, literal: node.literal });
    });
    return Array.from(byClause.entries()).map(function (entry) {
      return { clause: entry[0], vertices: entry[1] };
    });
  }

  /** Round-trip every reduction on the same source family, and report the
   *  four columns that make a round trip a check rather than a demonstration. */
  function reductionAudit(options) {
    const settings = options || {};
    const rows = [];

    Reductions.NAMES.forEach(function (name) {
      [false, true].forEach(function (unsatisfiable) {
        const study = reductionStudy(Object.assign({}, settings,
          { name: name, unsatisfiable: unsatisfiable }));
        rows.push({ name: name, answer: study.answer, agrees: study.agrees,
          valid: study.valid, solved: study.result.targetSolved,
          steps: study.result.steps, size: study.targetSize });
      });
    });
    return { rows: rows, allAgree: rows.every(function (row) { return row.agrees && row.valid; }) };
  }

  /* --------------------------------------------------------- 20.3 the zoo */

  /** The reduction chain as a graph the demo can draw, with the polynomial
   *  islands marked so they are visible as exceptions rather than omissions. */
  function reductionChain() {
    return { nodes: [
      { id: 'cook-levin', label: 'any NP problem', kind: 'root' },
      { id: 'sat', label: 'SAT', kind: 'complete' },
      { id: '3-sat', label: '3-SAT', kind: 'complete' },
      { id: 'independent-set', label: 'independent set', kind: 'complete' },
      { id: 'clique', label: 'clique', kind: 'complete' },
      { id: 'vertex-cover', label: 'vertex cover', kind: 'complete' },
      { id: 'set-cover', label: 'set cover', kind: 'complete' },
      { id: 'colouring', label: '3-colouring', kind: 'complete' },
      { id: 'subset-sum', label: 'subset sum', kind: 'complete' },
      { id: 'partition', label: 'partition', kind: 'complete' },
      { id: '2-sat', label: '2-SAT', kind: 'island' },
      { id: 'horn-sat', label: 'Horn-SAT', kind: 'island' },
      { id: 'xor-sat', label: 'XOR-SAT', kind: 'island' }
    ], edges: [
      { from: 'cook-levin', to: 'sat', via: 'Cook–Levin: encode the computation' },
      { from: 'sat', to: '3-sat', via: 'chain wide clauses through fresh variables' },
      { from: '3-sat', to: 'independent-set', via: 'a triangle per clause, edges between opposites' },
      { from: '3-sat', to: 'clique', via: 'the same graph, complemented' },
      { from: 'independent-set', to: 'vertex-cover', via: 'take the complement of the set' },
      { from: 'vertex-cover', to: 'set-cover', via: 'a set per vertex, an element per edge' },
      { from: '3-sat', to: 'colouring', via: 'a palette triangle and an OR gadget per clause' },
      { from: '3-sat', to: 'subset-sum', via: 'digits per variable and per clause' },
      { from: 'subset-sum', to: 'partition', via: 'two numbers that force the split' }
    ], islands: [
      { id: '2-sat', why: 'implication graph, strongly connected components — linear' },
      { id: 'horn-sat', why: 'unit propagation to a fixed point — linear' },
      { id: 'xor-sat', why: 'Gaussian elimination over GF(2) — cubic' }
    ] };
  }

  /**
   * Six clause families of comparable size, and the DPLL node count on each.
   * Horn is decided by propagation and never branches; random 3-SAT at the
   * critical ratio branches; the pigeonhole family branches catastrophically.
   * The variable count is held roughly fixed across the rows on purpose — the
   * differences here are structural, not size.
   */
  function islandStudy(options) {
    const settings = options || {};
    const variables = settings.variables === undefined ? 42 : settings.variables;
    const seed = settings.seed === undefined ? 3 : settings.seed;
    const holes = settings.holes === undefined ? 6 : settings.holes;

    return { variables: variables, seed: seed, holes: holes, rows: [
      islandRow('Horn — a requirements graph',
        Generators.hornInstance({ variables: variables, seed: seed }).formula, settings),
      islandRow('Horn with a contradiction',
        Generators.hornInstance({ variables: variables, seed: seed, contradictory: true }).formula,
        settings),
      islandRow('random 3-SAT below the threshold (ratio 2)',
        Generators.randomKSat({ variables: variables, ratio: 2, seed: seed }), settings),
      islandRow('random 3-SAT at the threshold (ratio 4.27)',
        Generators.randomKSat({ variables: variables, ratio: 4.27, seed: seed }), settings),
      islandRow('random 3-SAT above it (ratio 8)',
        Generators.randomKSat({ variables: variables, ratio: 8, seed: seed }), settings),
      islandRow('pigeonhole PHP(' + holes + ')', Generators.pigeonhole(holes).formula, settings)
    ] };
  }

  function islandRow(label, formula, settings) {
    const horn = Sat.isHorn(formula);
    const linear = horn ? Sat.hornSat(formula) : null;
    const dpll = Sat.dpll(formula, { budget: settings.budget === undefined
      ? 2000000 : settings.budget });

    return { label: label, horn: horn, variables: formula.variables,
      clauses: formula.clauses.length,
      linearSteps: linear === null ? null : linear.steps,
      satisfiable: dpll.satisfiable, exhausted: dpll.exhausted,
      nodes: dpll.stats.nodes, decisions: dpll.stats.decisions,
      propagations: dpll.stats.propagations, conflicts: dpll.stats.conflicts,
      agrees: linear === null || linear.satisfiable === dpll.satisfiable };
  }

  /** PHP at rising size: the clause count grows quadratically and the node
   *  count does not. The counter-example to "SAT solvers are fast now". */
  function pigeonholeSweep(options) {
    const settings = options || {};
    const rows = [];

    for (let holes = settings.from === undefined ? 3 : settings.from;
      holes <= (settings.to === undefined ? 8 : settings.to); holes += 1) {
      const built = Generators.pigeonhole(holes);
      const dpll = Sat.dpll(built.formula, { budget: settings.budget === undefined
        ? 4000000 : settings.budget });
      rows.push({ holes: holes, pigeons: built.pigeons, variables: built.formula.variables,
        clauses: built.formula.clauses.length, nodes: dpll.stats.nodes,
        conflicts: dpll.stats.conflicts, exhausted: dpll.exhausted,
        satisfiable: dpll.satisfiable });
    }
    return { rows: rows, growth: nodeGrowth(rows) };
  }

  function nodeGrowth(rows) {
    const ratios = [];

    for (let i = 1; i < rows.length; i += 1) {
      if (rows[i - 1].nodes <= 0 || rows[i].exhausted) continue;
      ratios.push(rows[i].nodes / rows[i - 1].nodes);
    }
    if (ratios.length === 0) return null;
    return ratios.reduce(function (a, b) { return a + b; }, 0) / ratios.length;
  }

  /* ------------------------------------------------------- 20.4 beyond NP */

  /**
   * The same matrix under three prefixes: all existential (plain SAT), one
   * alternation (Σ₂), and full alternation. Nothing changes except the
   * quantifiers, and the answer changes with them — which is the whole content
   * of "PSPACE is not NP unless something surprising is true".
   */
  function qbfStudy(options) {
    const settings = options || {};
    const variables = settings.variables === undefined ? 10 : settings.variables;
    const clauses = settings.clauses === undefined ? 22 : settings.clauses;
    const seed = settings.seed === undefined ? 5 : settings.seed;
    const patterns = settings.patterns === undefined ? ['E', 'EA', 'AE', 'EAE', 'AEAE'] : settings.patterns;

    return { variables: variables, clauses: clauses, seed: seed,
      rows: patterns.map(function (pattern) {
        return qbfRow(pattern, { variables: variables, clauses: clauses, seed: seed });
      }), games: gameRows(settings.pairs === undefined ? 4 : settings.pairs) };
  }

  function qbfRow(pattern, shape) {
    const qbf = Qbf.randomQbf({ variables: shape.variables, clauses: shape.clauses,
      pattern: pattern, seed: shape.seed });
    const evaluated = Qbf.evaluate(qbf);
    const oracle = Qbf.bruteForceQbf(qbf);
    const expansion = Qbf.expandUniversals(qbf, { cap: 12 });

    return { pattern: pattern, prefix: prefixText(qbf), value: evaluated.value,
      agrees: evaluated.value === oracle.value, nodes: evaluated.nodes,
      leaves: evaluated.leaves, prunes: evaluated.prunes,
      alternations: evaluated.alternations, universals: evaluated.universals,
      oracleEntries: oracle.entries, expansionCopies: expansion.copies,
      expansionClauses: expansion.clauses, expansionVariables: expansion.variables,
      asSat: Sat.dpll(Qbf.asSat(qbf)).satisfiable };
  }

  function prefixText(qbf) {
    return qbf.prefix.map(function (item) {
      return (item.quantifier === Qbf.FORALL ? '∀' : '∃') + 'x' + item.variable;
    }).join(' ');
  }

  /** The two games: ∀x ∃y (x ↔ y) is true, ∃y ∀x (x ↔ y) is false, and the
   *  clauses are identical. Nothing shows the quantifier order faster. */
  function gameRows(pairs) {
    const rows = [];

    for (let p = 1; p <= pairs; p += 1) {
      [Qbf.matchingGame(p), Qbf.swappedGame(p)].forEach(function (built, index) {
        const evaluated = Qbf.evaluate(built.qbf);
        rows.push({ pairs: p, order: index === 0 ? '∀ then ∃' : '∃ then ∀',
          value: evaluated.value, expected: built.value, nodes: evaluated.nodes,
          strategySize: Math.pow(2, p), reason: built.reason,
          asSat: Sat.dpll(Qbf.asSat(built.qbf)).satisfiable });
      });
    }
    return rows;
  }

  /* -------------------------------------------- 20.5 exact and parameterised */

  /**
   * Vertex cover four ways on the same instance: brute force, edge branching,
   * degree branching, and kernelisation followed by degree branching. Node
   * counts, kernel size and the answer, which must be the same in every row.
   */
  function vertexCoverStudy(options) {
    const settings = options || {};
    const graph = settings.graph || instanceGraph(settings);
    const k = settings.k === undefined ? Math.round(graph.n * 0.6) : settings.k;
    const budget = settings.budget === undefined ? 2000000 : settings.budget;
    const brute = graph.n <= 22 ? Fpt.bruteForceCover(graph, k) : null;
    const rows = [
      coverRow('edge branching', Fpt.branchAndReduce(graph, k, { rule: 'edge', reduce: false, budget: budget }), graph),
      coverRow('edge branching + rules', Fpt.branchAndReduce(graph, k, { rule: 'edge', budget: budget }), graph),
      coverRow('degree branching', Fpt.branchAndReduce(graph, k, { rule: 'degree', reduce: false, budget: budget }), graph),
      coverRow('degree branching + rules', Fpt.branchAndReduce(graph, k, { rule: 'degree', budget: budget }), graph)
    ];
    const kernelised = Fpt.kernelThenSearch(graph, k, { budget: budget });

    rows.push({ method: 'Buss kernel, then degree branching', found: kernelised.found,
      nodes: kernelised.nodes, size: kernelised.cover === null ? null : kernelised.cover.length,
      valid: kernelised.cover === null ? null : Fpt.coversAll(graph, kernelised.cover),
      kernelVertices: kernelised.kernel.vertices, kernelEdges: kernelised.kernel.edges });
    return { graph: graph, k: k, rows: rows, brute: brute,
      kernel: kernelised.kernel, agreed: rows.every(function (row) {
        return brute === null || row.found === brute.found;
      }) };
  }

  function coverRow(method, run, graph) {
    return { method: method, found: run.found, nodes: run.nodes, exhausted: run.exhausted,
      size: run.cover === null ? null : run.cover.length,
      valid: run.cover === null ? null : Fpt.coversAll(graph, run.cover) };
  }

  function instanceGraph(settings) {
    const n = settings.n === undefined ? 30 : settings.n;
    const m = settings.m === undefined ? 80 : settings.m;

    return GraphCore.randomGraph(n, m, Random.seeded(settings.seed === undefined ? 4 : settings.seed));
  }

  /**
   * Node count against k for both branching rules, with and without the
   * reduction rules. The measured base comes from `Fpt.branchingFactor`, and
   * the runs used for it are the NO runs only — a YES run stops at the first
   * answer and its node count measures luck.
   */
  function branchingSweep(options) {
    const settings = options || {};
    const graph = settings.graph || instanceGraph(settings);
    const from = settings.from === undefined ? 8 : settings.from;
    const to = settings.to === undefined ? 20 : settings.to;
    const step = settings.step === undefined ? 1 : settings.step;

    return { graph: graph, series: [
      sweepSeries(graph, 'edge', false, { from: from, to: to, step: step, budget: settings.budget }),
      sweepSeries(graph, 'edge', true, { from: from, to: to, step: step, budget: settings.budget }),
      sweepSeries(graph, 'degree', false, { from: from, to: to, step: step, budget: settings.budget }),
      sweepSeries(graph, 'degree', true, { from: from, to: to, step: step, budget: settings.budget })
    ] };
  }

  function sweepSeries(graph, rule, reduce, control) {
    const runs = [];

    for (let k = control.from; k <= control.to; k += control.step) {
      const run = Fpt.branchAndReduce(graph, k, { rule: rule, reduce: reduce,
        budget: control.budget === undefined ? 8000000 : control.budget });
      runs.push({ k: k, nodes: run.nodes, found: run.found, exhausted: run.exhausted });
    }
    const no = runs.filter(function (run) { return !run.found && !run.exhausted; });
    return { rule: rule, reduce: reduce, runs: runs,
      label: rule + (reduce ? ' + reduction rules' : ', no rules'),
      base: Fpt.branchingFactor(no).base, samples: no.length };
  }

  /**
   * Kernel size against k and against n. The point is that the kernel's size
   * stops depending on n — which is the fixed-parameter promise stated as a
   * measurement rather than as an asymptotic.
   */
  function kernelSweep(options) {
    const settings = options || {};
    const k = settings.k === undefined ? 12 : settings.k;
    const hubs = settings.hubs === undefined ? 6 : settings.hubs;
    const rows = [];

    (settings.sizes === undefined ? [40, 80, 160, 320, 640] : settings.sizes)
      .forEach(function (leaves) {
        const built = Generators.hubInstance({ hubs: hubs, leaves: leaves,
          extra: settings.extra === undefined ? 14 : settings.extra,
          seed: settings.seed === undefined ? 5 : settings.seed });
        const kernel = Fpt.bussKernel(built.graph, k);
        rows.push({ n: built.graph.n, edges: built.graph.edges.length,
          kernelVertices: kernel.vertices, kernelEdges: kernel.edges,
          forced: kernel.forced.length, decided: kernel.decided, answer: kernel.answer,
          bound: kernel.bound, reason: kernel.reason,
          shrink: built.graph.edges.length / Math.max(1, kernel.edges) });
      });
    return { k: k, rows: rows, hubs: hubs };
  }

  /** The treewidth DP against branch and reduce, on graphs of falling density
   *  — the parameter changes from answer size to width, and so does the cost. */
  function treewidthStudy(options) {
    const settings = options || {};
    const rows = [];

    (settings.densities === undefined ? [1.05, 1.3, 1.8, 2.5, 3.5] : settings.densities)
      .forEach(function (density) {
        const n = settings.n === undefined ? 22 : settings.n;
        const graph = GraphCore.randomGraph(n, Math.round(n * density),
          Random.seeded(settings.seed === undefined ? 8 : settings.seed));
        const dp = Fpt.coverByTreewidth(graph);
        const search = Fpt.branchAndReduce(graph, dp.size, { rule: 'degree', budget: 4000000 });
        rows.push({ density: density, n: n, edges: graph.edges.length, width: dp.width,
          bags: dp.bags, states: dp.states, size: dp.size, searchNodes: search.nodes,
          agrees: search.found && search.cover.length <= dp.size });
      });
    return { rows: rows, allAgree: rows.every(function (row) { return row.agrees; }) };
  }

  return {
    certificateStudy: certificateStudy, costSweep: costSweep,
    reductionStudy: reductionStudy, reductionAudit: reductionAudit, unsatCore: unsatCore,
    reductionChain: reductionChain, islandStudy: islandStudy,
    pigeonholeSweep: pigeonholeSweep,
    qbfStudy: qbfStudy, prefixText: prefixText,
    vertexCoverStudy: vertexCoverStudy, branchingSweep: branchingSweep,
    kernelSweep: kernelSweep, treewidthStudy: treewidthStudy,
    instanceGraph: instanceGraph
  };
}));

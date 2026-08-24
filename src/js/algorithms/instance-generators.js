/**
 * Instances built to have a known answer, and instances built to be hard.
 *
 * Two different jobs, and confusing them is how a demo ends up proving nothing.
 *
 * A generator with a PLANTED solution gives a YES instance whose answer is
 * known without solving it, so a verifier can be exercised and a search can be
 * scored. A generator with a STRUCTURAL obstruction gives a NO instance whose
 * answer is known for a reason - a K₄ subgraph is not 3-colourable, a degree-1
 * vertex cannot be on a cycle, a target with the wrong residue cannot be hit
 * by numbers sharing a factor - so a search can be forced to exhaust its space
 * without anybody waiting for a proof.
 *
 * The random 3-SAT generator is the third kind and the most interesting. At a
 * clause-to-variable ratio far below 4.27 almost every instance is satisfiable
 * and trivially so; far above it almost every instance is unsatisfiable and
 * trivially so; and at the crossover both the satisfiable fraction and the
 * solve time do something abrupt. That is a property of the *distribution*
 * rather than of any instance, which is why it needs a generator with a dial
 * rather than a fixture.
 *
 * The pigeonhole family is here because it is the standard counter-example to
 * "SAT solvers are fast now": PHP(n) has no polynomial resolution proof, so
 * every resolution-based solver - which is every CDCL solver - takes
 * exponential time on an instance a human reads in one sentence.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.InstanceGenerators = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const Random = scope && scope.Random ? scope.Random : require('../utils/random.js');
  const Sat = scope && scope.SatBasics ? scope.SatBasics : require('./sat-basics.js');

  /* ------------------------------------------------------------- random SAT */

  /** Uniform random k-SAT: m clauses of k distinct variables, signs uniform. */
  function randomKSat(options) {
    const settings = options || {};
    const rng = Random.seeded(settings.seed === undefined ? 1 : settings.seed);
    const variables = settings.variables === undefined ? 20 : settings.variables;
    const width = settings.width === undefined ? 3 : settings.width;
    const count = settings.clauses === undefined
      ? Math.round(variables * (settings.ratio === undefined ? 4.27 : settings.ratio))
      : settings.clauses;
    const clauses = [];

    for (let c = 0; c < count; c += 1) {
      const used = new Set();
      const clause = [];
      while (clause.length < width) {
        const v = 1 + rng.int(variables);
        if (used.has(v)) continue;
        used.add(v);
        clause.push(rng.int(2) === 1 ? v : -v);
      }
      clauses.push(clause);
    }
    return Sat.createFormula(variables, clauses);
  }

  /**
   * A satisfiable instance with a hidden assignment: every clause is
   * generated and then rejected unless the planted assignment satisfies it.
   * The result is biased - planted instances are easier than uniform
   * satisfiable ones at the same ratio - and the demo says so rather than
   * pretending otherwise.
   */
  function plantedKSat(options) {
    const settings = options || {};
    const rng = Random.seeded(settings.seed === undefined ? 1 : settings.seed);
    const variables = settings.variables === undefined ? 20 : settings.variables;
    const width = settings.width === undefined ? 3 : settings.width;
    const count = settings.clauses === undefined
      ? Math.round(variables * (settings.ratio === undefined ? 4.27 : settings.ratio))
      : settings.clauses;
    const planted = [];
    for (let v = 0; v < variables; v += 1) planted.push(rng.int(2) === 1 ? 1 : -1);
    const clauses = [];
    let attempts = 0;

    while (clauses.length < count && attempts < count * 100) {
      attempts += 1;
      const used = new Set();
      const clause = [];
      while (clause.length < width) {
        const v = 1 + rng.int(variables);
        if (used.has(v)) continue;
        used.add(v);
        clause.push(rng.int(2) === 1 ? v : -v);
      }
      if (Sat.clauseState(clause, planted).status !== 'satisfied') continue;
      clauses.push(clause);
    }
    return { formula: Sat.createFormula(variables, clauses), planted: planted, attempts: attempts };
  }

  /**
   * The pigeonhole principle as CNF: n + 1 pigeons into n holes. Satisfiable
   * only if a pigeon can share a hole, so every instance is unsatisfiable, and
   * every resolution-based solver needs exponentially many steps to say so.
   */
  function pigeonhole(holes) {
    const pigeons = holes + 1;
    const clauses = [];
    const index = function (pigeon, hole) { return pigeon * holes + hole + 1; };

    for (let p = 0; p < pigeons; p += 1) {
      const clause = [];
      for (let h = 0; h < holes; h += 1) clause.push(index(p, h));
      clauses.push(clause);
    }
    for (let h = 0; h < holes; h += 1) {
      for (let p = 0; p < pigeons; p += 1) {
        for (let q = p + 1; q < pigeons; q += 1) {
          clauses.push([-index(p, h), -index(q, h)]);
        }
      }
    }
    return { formula: Sat.createFormula(pigeons * holes, clauses), holes: holes, pigeons: pigeons,
      satisfiable: false };
  }

  /** A Horn formula: one positive literal per clause at most, which is what a
   *  requirements graph looks like once written down. */
  function hornInstance(options) {
    const settings = options || {};
    const rng = Random.seeded(settings.seed === undefined ? 3 : settings.seed);
    const variables = settings.variables === undefined ? 24 : settings.variables;
    const clauses = [[1]];

    for (let v = 2; v <= variables; v += 1) {
      const dependencies = 1 + rng.int(Math.min(3, v - 1));
      for (let d = 0; d < dependencies; d += 1) {
        clauses.push([-(1 + rng.int(v - 1)), v]);
      }
    }
    if (settings.contradictory) {
      clauses.push([-1, -variables]);
      clauses.push([variables]);
    }
    return { formula: Sat.createFormula(variables, clauses), variables: variables,
      satisfiable: !settings.contradictory };
  }

  /* ---------------------------------------------------------------- graphs */

  function emptyGraph(n, name) {
    return { n: n, edges: [], directed: false, name: name };
  }

  function addEdge(graph, from, to, seen) {
    const key = Math.min(from, to) + '-' + Math.max(from, to);
    if (from === to || seen.has(key)) return false;
    seen.add(key);
    graph.edges.push({ from: from, to: to, weight: 1 });
    return true;
  }

  /**
   * A graph with a planted Hamiltonian cycle plus random chords. The cycle is
   * a random permutation rather than 0, 1, 2, …, so a search cannot stumble on
   * it by trying vertices in order - which is exactly what made the first
   * version of this generator useless.
   */
  function hamiltonianGraph(options) {
    const settings = options || {};
    const rng = Random.seeded(settings.seed === undefined ? 1 : settings.seed);
    const n = settings.n === undefined ? 14 : settings.n;
    const graph = emptyGraph(n, 'hamiltonian');
    const seen = new Set();
    const order = rng.shuffle(rangeOf(n));

    for (let i = 0; i < n; i += 1) addEdge(graph, order[i], order[(i + 1) % n], seen);
    const extra = settings.chords === undefined ? Math.round(n / 2) : settings.chords;
    let attempts = 0;
    let added = 0;
    while (added < extra && attempts < extra * 40) {
      attempts += 1;
      if (addEdge(graph, rng.int(n), rng.int(n), seen)) added += 1;
    }
    return { graph: graph, cycle: order, hamiltonian: true, chords: added };
  }

  /**
   * A graph that provably has no Hamiltonian cycle, because one vertex has
   * degree 1 and a cycle needs degree 2 everywhere. The search must therefore
   * exhaust its space, which is the cost the certificate is contrasted with.
   */
  function nonHamiltonianGraph(options) {
    const settings = options || {};
    const rng = Random.seeded(settings.seed === undefined ? 2 : settings.seed);
    const n = settings.n === undefined ? 14 : settings.n;
    const built = hamiltonianGraph({ seed: settings.seed, n: n - 1,
      chords: settings.chords === undefined ? n : settings.chords });
    const graph = built.graph;
    graph.n = n;
    graph.name = 'non-hamiltonian';
    graph.edges.push({ from: n - 1, to: rng.int(n - 1), weight: 1 });
    return { graph: graph, cycle: null, hamiltonian: false,
      reason: 'vertex ' + (n - 1) + ' has degree 1, and a cycle needs degree 2 everywhere' };
  }

  function rangeOf(n) {
    const out = [];
    for (let i = 0; i < n; i += 1) out.push(i);
    return out;
  }

  /** A graph with a planted clique of the requested size, in random positions. */
  function cliqueGraph(options) {
    const settings = options || {};
    const rng = Random.seeded(settings.seed === undefined ? 5 : settings.seed);
    const n = settings.n === undefined ? 24 : settings.n;
    const size = settings.size === undefined ? 6 : settings.size;
    const density = settings.density === undefined ? 0.3 : settings.density;
    const graph = emptyGraph(n, 'planted-clique');
    const seen = new Set();

    for (let i = 0; i < n; i += 1) {
      for (let j = i + 1; j < n; j += 1) {
        if (rng.next() < density) addEdge(graph, i, j, seen);
      }
    }
    const members = rng.shuffle(rangeOf(n)).slice(0, size);
    for (let i = 0; i < members.length; i += 1) {
      for (let j = i + 1; j < members.length; j += 1) addEdge(graph, members[i], members[j], seen);
    }
    return { graph: graph, clique: members.slice().sort(function (a, b) { return a - b; }),
      size: size, density: density };
  }

  /**
   * A 3-colourable graph: colour the vertices first, then only ever add edges
   * between different colours. Nothing else can be added without destroying
   * the property, so the planted colouring is a certificate by construction.
   */
  function colourableGraph(options) {
    const settings = options || {};
    const rng = Random.seeded(settings.seed === undefined ? 7 : settings.seed);
    const n = settings.n === undefined ? 18 : settings.n;
    const density = settings.density === undefined ? 0.35 : settings.density;
    const colours = [];
    for (let v = 0; v < n; v += 1) colours.push(rng.int(3));
    const graph = emptyGraph(n, 'colourable');
    const seen = new Set();

    for (let i = 0; i < n; i += 1) {
      for (let j = i + 1; j < n; j += 1) {
        if (colours[i] === colours[j]) continue;
        if (rng.next() < density) addEdge(graph, i, j, seen);
      }
    }
    return { graph: graph, colours: colours, colourable: true };
  }

  /** The same graph with a K₄ bolted on: four mutually adjacent vertices need
   *  four colours, so no 3-colouring exists and the reason is one sentence. */
  function nonColourableGraph(options) {
    const settings = options || {};
    const built = colourableGraph(options);
    const graph = built.graph;
    const seen = new Set();
    graph.edges.forEach(function (edge) {
      seen.add(Math.min(edge.from, edge.to) + '-' + Math.max(edge.from, edge.to));
    });
    /* The obstruction goes on the LAST four vertices rather than the first.
       A backtracking search assigns vertices in order, so a K₄ at 0..3 is hit
       in six steps and the instance stops being a search problem at all. */
    const clique = [graph.n - 4, graph.n - 3, graph.n - 2, graph.n - 1];
    for (let i = 0; i < clique.length; i += 1) {
      for (let j = i + 1; j < clique.length; j += 1) addEdge(graph, clique[i], clique[j], seen);
    }
    graph.name = 'non-colourable';
    return { graph: graph, colours: null, colourable: false, obstruction: clique,
      reason: 'vertices ' + clique.join(', ') + ' are mutually adjacent, and a K₄ needs four colours' };
  }

  /* ------------------------------------------------------------ subset sum */

  /** A planted subset: the target is the sum of a hidden selection. */
  function subsetSumInstance(options) {
    const settings = options || {};
    const rng = Random.seeded(settings.seed === undefined ? 11 : settings.seed);
    const count = settings.count === undefined ? 20 : settings.count;
    const numbers = [];
    for (let i = 0; i < count; i += 1) numbers.push(1 + rng.int(settings.bound === undefined
      ? 100000 : settings.bound));
    const chosen = rng.shuffle(rangeOf(count)).slice(0, Math.max(2, Math.floor(count / 3)));
    let target = 0;
    chosen.forEach(function (i) { target += numbers[i]; });

    return { numbers: numbers, target: target,
      solution: chosen.slice().sort(function (a, b) { return a - b; }), solvable: true };
  }

  /**
   * Provably unsolvable, and provable in one line: every number is a multiple
   * of three and the target is not, so no subset can reach it. The search
   * still has to try all 2ⁿ, which is the point.
   */
  function unsolvableSubsetSum(options) {
    const settings = options || {};
    const built = subsetSumInstance(options);
    const numbers = built.numbers.map(function (value) { return value * 3; });
    let total = 0;
    numbers.forEach(function (value) { total += value; });

    return { numbers: numbers, target: Math.floor(total / 2) + 1 - (Math.floor(total / 2) % 3),
      solution: null, solvable: false,
      reason: 'every number is a multiple of 3 and the target is 1 more than one, so no subset can reach it' };
  }

  return {
    randomKSat: randomKSat, plantedKSat: plantedKSat, pigeonhole: pigeonhole,
    hornInstance: hornInstance,
    hamiltonianGraph: hamiltonianGraph, nonHamiltonianGraph: nonHamiltonianGraph,
    cliqueGraph: cliqueGraph, colourableGraph: colourableGraph,
    nonColourableGraph: nonColourableGraph,
    subsetSumInstance: subsetSumInstance, unsolvableSubsetSum: unsolvableSubsetSum,
    rangeOf: rangeOf
  };
}));

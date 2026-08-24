/**
 * Reductions, with the arrow pointing the way it actually points.
 *
 * A polynomial-time many-one reduction from A to B is a map f, computable in
 * polynomial time, such that x is a YES instance of A exactly when f(x) is a
 * YES instance of B. Written that way it reads as a proof device, and it is
 * one - if A is hard and A reduces to B then B is hard. It is also the more
 * useful thing: **a way to solve A by calling a solver for B**, which is what
 * most of this milestone is really about.
 *
 * The direction is the mistake everybody makes once. The arrow points from the
 * problem you want to SOLVE to the problem you can CALL. Reducing your problem
 * to SAT lets you use a SAT solver; reducing SAT to your problem proves your
 * problem is hard. Getting it backwards proves nothing at all, and the code
 * still runs.
 *
 * Every reduction here carries four pieces, and the fourth is the one that is
 * usually missing:
 *
 *   forward   - build the target instance from the source
 *   solve     - answer the target instance
 *   backward  - map the target's solution back to the source
 *   validate  - check the mapped-back answer against the SOURCE problem's own
 *               definition, not against the target's
 *
 * Without the last step a forward map with an off-by-one produces a target
 * instance that solves cleanly and maps back to something that is not a
 * solution to anything, and nothing notices. The `run` wrapper does all four
 * and reports the validation as a field.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.Reductions = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const Sat = scope && scope.SatBasics ? scope.SatBasics : require('./sat-basics.js');
  const Verifiers = scope && scope.NpVerifiers ? scope.NpVerifiers : require('./np-verifiers.js');

  /* ------------------------------------------------- 3-SAT to independent set */

  /**
   * One vertex per literal occurrence, so a 3-clause becomes a triangle.
   * Edges: inside each clause triangle (pick at most one literal per clause),
   * and between every pair of complementary literals (never satisfy x and ¬x
   * at once). The formula is satisfiable exactly when an independent set of
   * size m exists - one vertex per clause, and consistent.
   */
  function satToIndependentSet(formula) {
    const nodes = [];
    formula.clauses.forEach(function (clause, c) {
      clause.forEach(function (literal, i) {
        nodes.push({ clause: c, position: i, literal: literal });
      });
    });
    const edges = [];
    const gadgets = [];

    formula.clauses.forEach(function (clause, c) {
      const members = [];
      nodes.forEach(function (node, index) { if (node.clause === c) members.push(index); });
      gadgets.push({ clause: c, vertices: members.slice(), literals: clause.slice() });
      for (let i = 0; i < members.length; i += 1) {
        for (let j = i + 1; j < members.length; j += 1) {
          edges.push({ from: members[i], to: members[j], weight: 1, kind: 'clause' });
        }
      }
    });
    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        if (nodes[i].clause === nodes[j].clause) continue;
        if (nodes[i].literal !== -nodes[j].literal) continue;
        edges.push({ from: i, to: j, weight: 1, kind: 'conflict' });
      }
    }
    return { graph: { n: nodes.length, edges: edges, directed: false, name: 'independent-set' },
      nodes: nodes, gadgets: gadgets, target: formula.clauses.length, variables: formula.variables };
  }

  /** The independent set of size m becomes an assignment: each chosen vertex
   *  names a literal that must be true. Unmentioned variables are free. */
  function independentSetToAssignment(map, chosen) {
    const assignment = new Array(map.variables).fill(false);
    const forced = new Set();

    chosen.forEach(function (index) {
      const literal = map.nodes[index].literal;
      assignment[Math.abs(literal) - 1] = literal > 0;
      forced.add(Math.abs(literal));
    });
    return { assignment: assignment, forced: Array.from(forced).sort(function (a, b) {
      return a - b;
    }) };
  }

  /** Every independent set of the target size, by enumeration - the oracle. */
  function largestIndependentSet(graph, size) {
    const adjacency = [];
    for (let i = 0; i < graph.n; i += 1) adjacency.push(new Set());
    graph.edges.forEach(function (edge) {
      adjacency[edge.from].add(edge.to);
      adjacency[edge.to].add(edge.from);
    });
    const chosen = [];
    let steps = 0;

    function walk(start) {
      steps += 1;
      if (chosen.length === size) return chosen.slice();
      if (graph.n - start < size - chosen.length) return null;
      for (let v = start; v < graph.n; v += 1) {
        let ok = true;
        for (let i = 0; i < chosen.length; i += 1) {
          if (adjacency[chosen[i]].has(v)) { ok = false; break; }
        }
        if (!ok) continue;
        chosen.push(v);
        const found = walk(v + 1);
        if (found) return found;
        chosen.pop();
      }
      return null;
    }
    const found = walk(0);
    return { found: found !== null, set: found, steps: steps };
  }

  /* -------------------------------------------------------- 3-SAT to clique */

  /** The complement construction: join literals in DIFFERENT clauses that are
   *  not complementary, and look for a clique of size m. Same instance, read
   *  through the complement, which is the cleanest illustration that
   *  independent set and clique are the same problem twice. */
  function satToClique(formula) {
    const built = satToIndependentSet(formula);
    const present = new Set();
    built.graph.edges.forEach(function (edge) {
      present.add(edge.from + ':' + edge.to);
      present.add(edge.to + ':' + edge.from);
    });
    const edges = [];

    for (let i = 0; i < built.graph.n; i += 1) {
      for (let j = i + 1; j < built.graph.n; j += 1) {
        if (present.has(i + ':' + j)) continue;
        edges.push({ from: i, to: j, weight: 1, kind: 'compatible' });
      }
    }
    return { graph: { n: built.graph.n, edges: edges, directed: false, name: 'clique' },
      nodes: built.nodes, gadgets: built.gadgets, target: built.target,
      variables: built.variables, complementOf: built.graph };
  }

  /* ------------------------------------------- independent set to vertex cover */

  /** Complementation, and the reason the two problems are always quoted
   *  together: S is independent exactly when V \ S is a cover. */
  function independentSetToVertexCover(graph, size) {
    return { graph: graph, coverSize: graph.n - size,
      note: 'an independent set of ' + size + ' is the complement of a cover of ' +
        (graph.n - size) };
  }

  function complementSet(n, set) {
    const inSet = new Array(n).fill(false);
    set.forEach(function (v) { inSet[v] = true; });
    const out = [];
    for (let v = 0; v < n; v += 1) { if (!inSet[v]) out.push(v); }
    return out;
  }

  /* ------------------------------------------------ vertex cover to set cover */

  /** The universe is the edge set and each vertex is the set of edges it
   *  touches. A cover of k vertices is a set cover of cost k, exactly. */
  function vertexCoverToSetCover(graph) {
    const sets = [];
    for (let v = 0; v < graph.n; v += 1) sets.push({ members: [], cost: 1, vertex: v });
    graph.edges.forEach(function (edge, id) {
      sets[edge.from].members.push(id);
      sets[edge.to].members.push(id);
    });
    return { universe: graph.edges.length, sets: sets, vertices: graph.n };
  }

  function setCoverToVertexCover(map, chosen) {
    return chosen.map(function (index) { return map.sets[index].vertex; })
      .sort(function (a, b) { return a - b; });
  }

  /* --------------------------------------------------- subset sum to partition */

  /**
   * Given numbers S with total σ and target t, the partition instance is
   * S ∪ {σ + t, 2σ − t}. The two added numbers sum to 3σ, so the whole
   * multiset totals 4σ and each side of a balanced partition is 2σ. The two
   * added numbers cannot share a side - together they already exceed 2σ - so
   * one side is {σ + t} plus a subset summing to σ − t, and the other is
   * {2σ − t} plus its complement summing to t. That complement is the answer.
   */
  function subsetSumToPartition(instance) {
    let total = 0;
    instance.numbers.forEach(function (value) { total += value; });
    const added = [total + instance.target, 2 * total - instance.target];
    return { numbers: instance.numbers.concat(added), added: added, originalTotal: total,
      originalCount: instance.numbers.length, halfSum: (4 * total) / 2, target: instance.target };
  }

  /** The side NOT holding σ + t, minus the 2σ − t element, sums to t. */
  function partitionToSubsetSum(map, sideIndices) {
    const bigIndex = map.originalCount;
    const side = new Set(sideIndices);
    const withoutBig = side.has(bigIndex)
      ? complementSet(map.numbers.length, sideIndices) : sideIndices.slice();
    return withoutBig.filter(function (index) { return index < map.originalCount; })
      .sort(function (a, b) { return a - b; });
  }

  /** Exact partition by subset enumeration - the oracle for the round trip. */
  function findPartition(numbers) {
    let total = 0;
    numbers.forEach(function (value) { total += value; });
    if (total % 2 !== 0) return { found: false, side: null, steps: 0 };
    const half = total / 2;
    const limit = Math.pow(2, numbers.length);
    let steps = 0;

    for (let mask = 0; mask < limit; mask += 1) {
      steps += 1;
      let sum = 0;
      for (let i = 0; i < numbers.length; i += 1) { if ((mask >>> i) & 1) sum += numbers[i]; }
      if (sum !== half) continue;
      const side = [];
      for (let i = 0; i < numbers.length; i += 1) { if ((mask >>> i) & 1) side.push(i); }
      return { found: true, side: side, steps: steps };
    }
    return { found: false, side: null, steps: steps };
  }

  /* -------------------------------------------------- 3-SAT to 3-colouring */

  const BASE = 0;
  const TRUE_NODE = 1;
  const FALSE_NODE = 2;

  /**
   * A base triangle B–T–F fixes three colours. Each variable contributes a
   * pair x, ¬x joined to each other and to B, so the pair takes the T and F
   * colours in some order - that is the truth assignment. Each clause is two
   * OR gadgets in series, and the final output is joined to F and B so it is
   * forced to the T colour.
   *
   * The OR gadget is three vertices forming a triangle, two of them joined to
   * the inputs. If both inputs are T-coloured the output cannot be, and if
   * either is F-coloured the output can be - which is exactly disjunction.
   */
  function satToColouring(formula) {
    const state = { edges: [], labels: [], next: 0, gadgets: [] };
    addNode(state, 'base');
    addNode(state, 'TRUE');
    addNode(state, 'FALSE');
    link(state, BASE, TRUE_NODE);
    link(state, BASE, FALSE_NODE);
    link(state, TRUE_NODE, FALSE_NODE);

    const positive = [];
    const negative = [];
    for (let v = 1; v <= formula.variables; v += 1) {
      positive.push(addNode(state, 'x' + v));
      negative.push(addNode(state, '¬x' + v));
      link(state, positive[v - 1], negative[v - 1]);
      link(state, positive[v - 1], BASE);
      link(state, negative[v - 1], BASE);
    }
    const literalNode = function (literal) {
      return literal > 0 ? positive[literal - 1] : negative[-literal - 1];
    };
    formula.clauses.forEach(function (clause, index) {
      buildClause(state, clause.map(literalNode), index);
    });
    return { graph: { n: state.next, edges: state.edges, directed: false, name: '3-colouring' },
      labels: state.labels, positive: positive, negative: negative, gadgets: state.gadgets,
      variables: formula.variables, clauses: formula.clauses.length };
  }

  function addNode(state, label) {
    state.labels.push(label);
    state.next += 1;
    return state.next - 1;
  }

  function link(state, from, to) {
    state.edges.push({ from: from, to: to, weight: 1 });
  }

  /** Two OR gadgets in series, then the output forced to the TRUE colour. */
  function buildClause(state, inputs, index) {
    const first = orGadget(state, inputs[0], inputs[1], index);
    const second = orGadget(state, first, inputs.length > 2 ? inputs[2] : inputs[1], index);
    link(state, second, FALSE_NODE);
    link(state, second, BASE);
    state.gadgets.push({ clause: index, inputs: inputs.slice(), output: second });
    return second;
  }

  function orGadget(state, a, b, index) {
    const p = addNode(state, 'g' + index + 'a');
    const q = addNode(state, 'g' + index + 'b');
    const out = addNode(state, 'g' + index + 'out');
    link(state, a, p);
    link(state, b, q);
    link(state, p, q);
    link(state, p, out);
    link(state, q, out);
    return out;
  }

  /** A colouring becomes an assignment: variable v is true when its positive
   *  node shares a colour with the TRUE node. */
  function colouringToAssignment(map, colours) {
    const trueColour = colours[TRUE_NODE];
    const assignment = [];
    for (let v = 0; v < map.variables; v += 1) {
      assignment.push(colours[map.positive[v]] === trueColour);
    }
    return assignment;
  }

  /* -------------------------------------------------------------- the runner */

  const NAMES = ['sat-to-independent-set', 'sat-to-clique', 'sat-to-colouring',
    'vertex-cover-to-set-cover', 'subset-sum-to-partition'];

  /** Forward, solve, backward, and then validate against the SOURCE. */
  function run(name, source) {
    if (name === 'sat-to-independent-set') return runIndependentSet(source);
    if (name === 'sat-to-clique') return runClique(source);
    if (name === 'sat-to-colouring') return runColouring(source);
    if (name === 'vertex-cover-to-set-cover') return runSetCover(source);
    return runPartition(source);
  }

  function runIndependentSet(formula) {
    const map = satToIndependentSet(formula);
    const solved = largestIndependentSet(map.graph, map.target);
    const truth = Sat.bruteForce(formula);

    if (!solved.found) {
      return { name: 'sat-to-independent-set', map: map, targetSolved: false,
        sourceSatisfiable: truth.satisfiable, agrees: !truth.satisfiable,
        valid: !truth.satisfiable, steps: solved.steps, mapped: null };
    }
    const mapped = independentSetToAssignment(map, solved.set);
    const check = Verifiers.verifySat(formula, mapped.assignment);
    return { name: 'sat-to-independent-set', map: map, targetSolved: true,
      sourceSatisfiable: truth.satisfiable, agrees: truth.satisfiable,
      valid: check.accepted, reason: check.reason, steps: solved.steps,
      mapped: mapped.assignment, set: solved.set };
  }

  function runClique(formula) {
    const map = satToClique(formula);
    const solved = Verifiers.searchClique(map.graph, map.target);
    const truth = Sat.bruteForce(formula);

    if (!solved.found) {
      return { name: 'sat-to-clique', map: map, targetSolved: false,
        sourceSatisfiable: truth.satisfiable, agrees: !truth.satisfiable,
        valid: !truth.satisfiable, steps: solved.steps, mapped: null };
    }
    const mapped = independentSetToAssignment(map, solved.certificate);
    const check = Verifiers.verifySat(formula, mapped.assignment);
    return { name: 'sat-to-clique', map: map, targetSolved: true,
      sourceSatisfiable: truth.satisfiable, agrees: truth.satisfiable,
      valid: check.accepted, reason: check.reason, steps: solved.steps,
      mapped: mapped.assignment, set: solved.certificate };
  }

  function runColouring(formula) {
    const map = satToColouring(formula);
    const solved = Verifiers.searchColouring(map.graph, 3);
    const truth = Sat.bruteForce(formula);

    if (!solved.found) {
      return { name: 'sat-to-colouring', map: map, targetSolved: false,
        sourceSatisfiable: truth.satisfiable, agrees: !truth.satisfiable,
        valid: !truth.satisfiable, steps: solved.steps, mapped: null };
    }
    const assignment = colouringToAssignment(map, solved.certificate);
    const check = Verifiers.verifySat(formula, assignment);
    return { name: 'sat-to-colouring', map: map, targetSolved: true,
      sourceSatisfiable: truth.satisfiable, agrees: truth.satisfiable,
      valid: check.accepted, reason: check.reason, steps: solved.steps,
      mapped: assignment, colours: solved.certificate };
  }

  function runSetCover(source) {
    const map = vertexCoverToSetCover(source.graph);
    const chosen = greedyExactSetCover(map, source.size);
    if (chosen === null) {
      return { name: 'vertex-cover-to-set-cover', map: map, targetSolved: false,
        sourceSatisfiable: false, agrees: true, valid: true, steps: 0, mapped: null };
    }
    const cover = setCoverToVertexCover(map, chosen);
    const check = Verifiers.verifyVertexCover(source.graph, cover, source.size);
    return { name: 'vertex-cover-to-set-cover', map: map, targetSolved: true,
      sourceSatisfiable: true, agrees: true, valid: check.accepted, reason: check.reason,
      steps: map.sets.length, mapped: cover };
  }

  /** Every subfamily of at most `size` sets - the oracle for the round trip. */
  function greedyExactSetCover(map, size) {
    const total = Math.pow(2, map.sets.length);

    for (let mask = 1; mask < total; mask += 1) {
      let count = 0;
      for (let s = 0; s < map.sets.length; s += 1) { if ((mask >>> s) & 1) count += 1; }
      if (count > size) continue;
      const covered = new Array(map.universe).fill(false);
      for (let s = 0; s < map.sets.length; s += 1) {
        if (!((mask >>> s) & 1)) continue;
        map.sets[s].members.forEach(function (e) { covered[e] = true; });
      }
      let complete = true;
      for (let e = 0; e < map.universe; e += 1) { if (!covered[e]) complete = false; }
      if (!complete) continue;
      const chosen = [];
      for (let s = 0; s < map.sets.length; s += 1) { if ((mask >>> s) & 1) chosen.push(s); }
      return chosen;
    }
    return null;
  }

  function runPartition(instance) {
    const map = subsetSumToPartition(instance);
    const solved = findPartition(map.numbers);
    const truth = Verifiers.searchSubsetSum(instance);

    if (!solved.found) {
      return { name: 'subset-sum-to-partition', map: map, targetSolved: false,
        sourceSatisfiable: truth.found, agrees: !truth.found, valid: !truth.found,
        steps: solved.steps, mapped: null };
    }
    const indices = partitionToSubsetSum(map, solved.side);
    const check = Verifiers.verifySubsetSum(instance, indices);
    return { name: 'subset-sum-to-partition', map: map, targetSolved: true,
      sourceSatisfiable: truth.found, agrees: truth.found, valid: check.accepted,
      reason: check.reason, steps: solved.steps, mapped: indices, side: solved.side };
  }

  return {
    NAMES: NAMES, run: run,
    satToIndependentSet: satToIndependentSet, independentSetToAssignment: independentSetToAssignment,
    largestIndependentSet: largestIndependentSet,
    satToClique: satToClique,
    independentSetToVertexCover: independentSetToVertexCover, complementSet: complementSet,
    vertexCoverToSetCover: vertexCoverToSetCover, setCoverToVertexCover: setCoverToVertexCover,
    subsetSumToPartition: subsetSumToPartition, partitionToSubsetSum: partitionToSubsetSum,
    findPartition: findPartition,
    satToColouring: satToColouring, colouringToAssignment: colouringToAssignment,
    BASE: BASE, TRUE_NODE: TRUE_NODE, FALSE_NODE: FALSE_NODE
  };
}));

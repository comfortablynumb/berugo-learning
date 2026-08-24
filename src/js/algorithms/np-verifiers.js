/**
 * Certificates, verifiers, and the gap that defines NP.
 *
 * NP is the class of decision problems whose YES answers have a certificate a
 * polynomial-time verifier accepts. That is the definition worth carrying
 * around, because it is the one that explains what these problems have in
 * common in practice: **easy to check, hard to find**. Proof-of-work,
 * puzzle-based authentication and every verifiable-computation protocol exist
 * inside that gap.
 *
 * Every verifier here counts its own steps and every search counts its own,
 * so the demo can put the two costs in the same table rather than asserting
 * that one is smaller. On a 14-vertex Hamiltonian cycle instance the verifier
 * runs in a few dozen steps and the search runs in tens of thousands, and the
 * ratio grows without bound.
 *
 * Two details are load-bearing and easy to skip.
 *
 *   - A verifier must reject *malformed* certificates as firmly as wrong ones.
 *     A Hamiltonian certificate that repeats a vertex, or a subset-sum
 *     certificate with an out-of-range index, has to be a rejection rather
 *     than a crash or an accidental accept — otherwise "the verifier accepted"
 *     stops meaning anything.
 *   - NP is not closed under complement as far as anybody knows. There is no
 *     short certificate for "this formula is unsatisfiable", which is why the
 *     UNSAT side of every solver has to produce a resolution proof instead,
 *     and why that proof can be exponentially long.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.NpVerifiers = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function counter() {
    return { steps: 0 };
  }

  function reject(reason, steps) {
    return { accepted: false, reason: reason, steps: steps };
  }

  function accept(steps, extra) {
    return Object.assign({ accepted: true, reason: null, steps: steps }, extra || {});
  }

  /* ------------------------------------------------------ Hamiltonian cycle */

  function adjacencySet(graph) {
    const set = new Set();
    graph.edges.forEach(function (edge) {
      set.add(edge.from + ':' + edge.to);
      set.add(edge.to + ':' + edge.from);
    });
    return set;
  }

  /**
   * The certificate is a vertex order. Checking it is O(n): confirm it is a
   * permutation of every vertex, then walk it confirming each consecutive
   * pair - and the wrap-around - is an edge.
   */
  function verifyHamiltonian(graph, order) {
    const c = counter();
    if (!Array.isArray(order) || order.length !== graph.n) {
      return reject('the certificate must list every vertex exactly once', c.steps);
    }
    const seen = new Array(graph.n).fill(false);

    for (let i = 0; i < order.length; i += 1) {
      c.steps += 1;
      const v = order[i];
      if (!Number.isInteger(v) || v < 0 || v >= graph.n) return reject('vertex ' + v + ' is out of range', c.steps);
      if (seen[v]) return reject('vertex ' + v + ' appears twice', c.steps);
      seen[v] = true;
    }
    const edges = adjacencySet(graph);
    for (let i = 0; i < order.length; i += 1) {
      c.steps += 1;
      const from = order[i];
      const to = order[(i + 1) % order.length];
      if (!edges.has(from + ':' + to)) return reject('no edge ' + from + '–' + to, c.steps);
    }
    return accept(c.steps);
  }

  /** Every permutation fixing vertex 0, so (n−1)! orders at worst. */
  function searchHamiltonian(graph) {
    const c = counter();
    const edges = adjacencySet(graph);
    const path = [0];
    const used = new Array(graph.n).fill(false);
    used[0] = true;

    function walk() {
      c.steps += 1;
      if (path.length === graph.n) {
        return edges.has(path[path.length - 1] + ':0') ? path.slice() : null;
      }
      for (let v = 1; v < graph.n; v += 1) {
        if (used[v] || !edges.has(path[path.length - 1] + ':' + v)) continue;
        used[v] = true;
        path.push(v);
        const found = walk();
        if (found) return found;
        path.pop();
        used[v] = false;
      }
      return null;
    }
    const found = walk();
    return { found: found !== null, certificate: found, steps: c.steps };
  }

  /* ------------------------------------------------------------ subset sum */

  /** The certificate is a list of indices; checking it is one pass. */
  function verifySubsetSum(instance, indices) {
    const c = counter();
    if (!Array.isArray(indices)) return reject('the certificate must be a list of indices', c.steps);
    const seen = new Set();
    let total = 0;

    for (let i = 0; i < indices.length; i += 1) {
      c.steps += 1;
      const index = indices[i];
      if (!Number.isInteger(index) || index < 0 || index >= instance.numbers.length) {
        return reject('index ' + index + ' is out of range', c.steps);
      }
      if (seen.has(index)) return reject('index ' + index + ' appears twice', c.steps);
      seen.add(index);
      total += instance.numbers[index];
    }
    c.steps += 1;
    if (total !== instance.target) {
      return reject('the subset sums to ' + total + ', not ' + instance.target, c.steps);
    }
    return accept(c.steps, { sum: total });
  }

  /** 2ⁿ subsets, which is the search this whole section is contrasted with. */
  function searchSubsetSum(instance) {
    const c = counter();
    const total = Math.pow(2, instance.numbers.length);

    for (let mask = 0; mask < total; mask += 1) {
      c.steps += 1;
      let sum = 0;
      const indices = [];
      for (let i = 0; i < instance.numbers.length; i += 1) {
        if (!((mask >>> i) & 1)) continue;
        sum += instance.numbers[i];
        indices.push(i);
      }
      if (sum === instance.target) return { found: true, certificate: indices, steps: c.steps };
    }
    return { found: false, certificate: null, steps: c.steps };
  }

  /* ----------------------------------------------------------- 3-colouring */

  function verifyColouring(graph, colours, limit) {
    const c = counter();
    const k = limit === undefined ? 3 : limit;
    if (!Array.isArray(colours) || colours.length !== graph.n) {
      return reject('the certificate must give a colour to every vertex', c.steps);
    }
    for (let v = 0; v < graph.n; v += 1) {
      c.steps += 1;
      if (!Number.isInteger(colours[v]) || colours[v] < 0 || colours[v] >= k) {
        return reject('vertex ' + v + ' uses colour ' + colours[v] + ', outside 0..' + (k - 1), c.steps);
      }
    }
    for (let i = 0; i < graph.edges.length; i += 1) {
      c.steps += 1;
      const edge = graph.edges[i];
      if (colours[edge.from] === colours[edge.to]) {
        return reject('edge ' + edge.from + '–' + edge.to + ' is monochromatic', c.steps);
      }
    }
    return accept(c.steps, { coloursUsed: new Set(colours).size });
  }

  /** kⁿ assignments with pruning: the first vertex is fixed by symmetry. */
  function searchColouring(graph, limit) {
    const c = counter();
    const k = limit === undefined ? 3 : limit;
    const colours = new Array(graph.n).fill(-1);
    const adjacency = [];
    for (let i = 0; i < graph.n; i += 1) adjacency.push([]);
    graph.edges.forEach(function (edge) {
      adjacency[edge.from].push(edge.to);
      adjacency[edge.to].push(edge.from);
    });

    function walk(v) {
      c.steps += 1;
      if (v === graph.n) return true;
      const ceiling = v === 0 ? 1 : k;
      for (let colour = 0; colour < ceiling; colour += 1) {
        let clash = false;
        for (let i = 0; i < adjacency[v].length; i += 1) {
          if (colours[adjacency[v][i]] === colour) { clash = true; break; }
        }
        if (clash) continue;
        colours[v] = colour;
        if (walk(v + 1)) return true;
        colours[v] = -1;
      }
      return false;
    }
    const found = walk(0);
    return { found: found, certificate: found ? colours.slice() : null, steps: c.steps };
  }

  /* ---------------------------------------------------------------- clique */

  function verifyClique(graph, vertices, size) {
    const c = counter();
    if (!Array.isArray(vertices)) return reject('the certificate must be a vertex list', c.steps);
    c.steps += 1;
    if (vertices.length < size) {
      return reject('the clique has ' + vertices.length + ' vertices, fewer than ' + size, c.steps);
    }
    const seen = new Set();
    for (let i = 0; i < vertices.length; i += 1) {
      c.steps += 1;
      if (seen.has(vertices[i])) return reject('vertex ' + vertices[i] + ' appears twice', c.steps);
      seen.add(vertices[i]);
    }
    const edges = adjacencySet(graph);
    for (let i = 0; i < vertices.length; i += 1) {
      for (let j = i + 1; j < vertices.length; j += 1) {
        c.steps += 1;
        if (!edges.has(vertices[i] + ':' + vertices[j])) {
          return reject('vertices ' + vertices[i] + ' and ' + vertices[j] + ' are not adjacent', c.steps);
        }
      }
    }
    return accept(c.steps, { size: vertices.length });
  }

  function searchClique(graph, size) {
    const c = counter();
    const edges = adjacencySet(graph);
    const chosen = [];

    function walk(start) {
      c.steps += 1;
      if (chosen.length === size) return chosen.slice();
      for (let v = start; v < graph.n; v += 1) {
        let ok = true;
        for (let i = 0; i < chosen.length; i += 1) {
          if (!edges.has(chosen[i] + ':' + v)) { ok = false; break; }
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
    return { found: found !== null, certificate: found, steps: c.steps };
  }

  /* ---------------------------------------------------------- vertex cover */

  function verifyVertexCover(graph, vertices, size) {
    const c = counter();
    if (!Array.isArray(vertices)) return reject('the certificate must be a vertex list', c.steps);
    c.steps += 1;
    if (vertices.length > size) {
      return reject('the cover has ' + vertices.length + ' vertices, more than ' + size, c.steps);
    }
    const inCover = new Array(graph.n).fill(false);
    for (let i = 0; i < vertices.length; i += 1) {
      c.steps += 1;
      if (!Number.isInteger(vertices[i]) || vertices[i] < 0 || vertices[i] >= graph.n) {
        return reject('vertex ' + vertices[i] + ' is out of range', c.steps);
      }
      inCover[vertices[i]] = true;
    }
    for (let i = 0; i < graph.edges.length; i += 1) {
      c.steps += 1;
      const edge = graph.edges[i];
      if (!inCover[edge.from] && !inCover[edge.to]) {
        return reject('edge ' + edge.from + '–' + edge.to + ' is uncovered', c.steps);
      }
    }
    return accept(c.steps, { size: vertices.length });
  }

  /* ------------------------------------------------------------------ SAT */

  function verifySat(formula, assignment) {
    const c = counter();
    if (!Array.isArray(assignment) || assignment.length !== formula.variables) {
      return reject('the certificate must assign every variable', c.steps);
    }
    for (let i = 0; i < formula.clauses.length; i += 1) {
      const clause = formula.clauses[i];
      let satisfied = false;
      for (let j = 0; j < clause.length; j += 1) {
        c.steps += 1;
        const value = assignment[Math.abs(clause[j]) - 1];
        if (typeof value !== 'boolean') return reject('variable ' + Math.abs(clause[j]) + ' is unset', c.steps);
        if (clause[j] > 0 ? value : !value) { satisfied = true; break; }
      }
      if (!satisfied) return reject('clause ' + i + ' is unsatisfied', c.steps);
    }
    return accept(c.steps, { clauses: formula.clauses.length });
  }

  /* ------------------------------------------------------------- the table */

  const PROBLEMS = [
    { id: 'sat', label: 'Boolean satisfiability', certificate: 'one truth value per variable',
      verifyCost: 'O(total literals)', searchCost: '2ⁿ assignments' },
    { id: 'hamiltonian', label: 'Hamiltonian cycle', certificate: 'a vertex order',
      verifyCost: 'O(n)', searchCost: '(n − 1)! orders' },
    { id: 'subset-sum', label: 'Subset sum', certificate: 'a list of indices',
      verifyCost: 'O(n)', searchCost: '2ⁿ subsets' },
    { id: 'colouring', label: '3-colouring', certificate: 'a colour per vertex',
      verifyCost: 'O(n + m)', searchCost: '3ⁿ assignments' },
    { id: 'clique', label: 'Clique of size k', certificate: 'a vertex set',
      verifyCost: 'O(k²)', searchCost: 'C(n, k) sets' },
    { id: 'vertex-cover', label: 'Vertex cover of size k', certificate: 'a vertex set',
      verifyCost: 'O(n + m)', searchCost: 'C(n, k) sets' }
  ];

  return {
    PROBLEMS: PROBLEMS, adjacencySet: adjacencySet,
    verifyHamiltonian: verifyHamiltonian, searchHamiltonian: searchHamiltonian,
    verifySubsetSum: verifySubsetSum, searchSubsetSum: searchSubsetSum,
    verifyColouring: verifyColouring, searchColouring: searchColouring,
    verifyClique: verifyClique, searchClique: searchClique,
    verifyVertexCover: verifyVertexCover, verifySat: verifySat
  };
}));

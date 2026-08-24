/**
 * The encoding is the engineering, and the solver is a library call.
 *
 * For most NP-hard problems that turn up in industry the right move is to
 * write the problem down as clauses and hand it to a solver. The work is then
 * entirely in HOW you write it down, and the difference between two correct
 * encodings of the same constraint is routinely two orders of magnitude in
 * solve time. This module carries the three encodings everybody eventually
 * meets, all of them exact, so the difference can be measured rather than
 * argued about.
 *
 * The constraint is "at most one of these is true", which is the workhorse:
 * one colour per vertex, one shift per nurse, one machine per job.
 *
 *   - **Pairwise** — one clause per pair, ¬xᵢ ∨ ¬xⱼ. No new variables, and
 *     n(n−1)/2 clauses, which is fine at n = 5 and 500 000 clauses at n = 1 000.
 *   - **Commander** — split into groups, at-most-one inside each group, and a
 *     fresh "commander" variable per group that is true when that group holds
 *     the chosen literal. At-most-one is then applied to the commanders,
 *     recursively. Linear in clauses at the cost of some new variables.
 *   - **Sequential** (the ladder / Sinz encoding) — a chain of carry variables
 *     sᵢ meaning "one of x₁..xᵢ is true". 3n clauses and n new variables, and
 *     it is the one whose propagation is strongest: setting any xᵢ true
 *     propagates every other xⱼ false through the chain without a decision.
 *
 * The other half of the file is symmetry breaking, which is the trick that
 * makes graph colouring tractable in practice. A proper colouring stays proper
 * when the colours are permuted, so a solver that has refuted "vertex 0 is
 * red" will refute "vertex 0 is green" again from scratch — c! times over the
 * same search. Fixing the colours of one clique costs a handful of unit
 * clauses and deletes that entire factor.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.Encodings = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const Sat = scope && scope.SatBasics ? scope.SatBasics : require('./sat-basics.js');

  const AT_MOST_ONE = ['pairwise', 'commander', 'sequential'];

  /* ------------------------------------------------------- the constraint */

  /**
   * `counter` is a mutable `{ next }` holding the first unused variable index,
   * because every encoding that needs auxiliary variables has to allocate from
   * the same pool as the rest of the model. Returning a fresh numbering
   * instead is how two constraints end up sharing a variable that means two
   * different things.
   */
  function atMostOne(literals, counter, options) {
    const settings = options || {};
    const encoding = settings.encoding === undefined ? 'pairwise' : settings.encoding;

    if (literals.length <= 1) return { clauses: [], auxiliary: 0, encoding: encoding };
    if (encoding === 'commander') return commander(literals, counter, settings);
    if (encoding === 'sequential') return sequential(literals, counter);
    return pairwise(literals);
  }

  function pairwise(literals) {
    const clauses = [];

    for (let i = 0; i < literals.length; i += 1) {
      for (let j = i + 1; j < literals.length; j += 1) {
        clauses.push([-literals[i], -literals[j]]);
      }
    }
    return { clauses: clauses, auxiliary: 0, encoding: 'pairwise' };
  }

  /**
   * Sinz's sequential counter. sᵢ reads "at least one of x₁..xᵢ is true"; the
   * three clause families say that x₁ implies s₁, that sᵢ₋₁ implies sᵢ, and
   * that xᵢ and sᵢ₋₁ cannot both hold. 3n − 4 clauses and n − 1 new variables.
   */
  function sequential(literals, counter) {
    const n = literals.length;
    const s = [];
    const clauses = [];

    for (let i = 0; i < n - 1; i += 1) { counter.next += 1; s.push(counter.next); }
    clauses.push([-literals[0], s[0]]);
    clauses.push([-literals[n - 1], -s[n - 2]]);
    for (let i = 1; i < n - 1; i += 1) {
      clauses.push([-literals[i], s[i]]);
      clauses.push([-s[i - 1], s[i]]);
      clauses.push([-literals[i], -s[i - 1]]);
    }
    return { clauses: clauses, auxiliary: n - 1, encoding: 'sequential' };
  }

  /**
   * The commander encoding. Split the literals into groups of `groupSize`,
   * give each group a commander variable c, say the commander is true exactly
   * when one of its group is, and recurse on the commanders. Recursion is the
   * part that makes it linear; stopping after one level is the version most
   * write-ups give and it is still quadratic in the number of groups.
   */
  function commander(literals, counter, settings) {
    const size = settings.groupSize === undefined ? 3 : settings.groupSize;

    if (literals.length <= size) {
      return { clauses: pairwise(literals).clauses, auxiliary: 0, encoding: 'commander' };
    }
    const built = { clauses: [], auxiliary: 0 };
    const commanders = [];

    for (let at = 0; at < literals.length; at += size) {
      const group = literals.slice(at, at + size);
      counter.next += 1;
      const head = counter.next;
      built.auxiliary += 1;
      commanders.push(head);
      addGroup(built, group, head);
    }
    const above = commander(commanders, counter, settings);
    return { clauses: built.clauses.concat(above.clauses),
      auxiliary: built.auxiliary + above.auxiliary, encoding: 'commander' };
  }

  /** A commander is true when its group holds the chosen literal, and its
   *  group holds at most one — the two halves of the group's contract. */
  function addGroup(built, group, head) {
    pairwise(group).clauses.forEach(function (clause) { built.clauses.push(clause); });
    group.forEach(function (literal) { built.clauses.push([-literal, head]); });
    built.clauses.push([-head].concat(group));
  }

  /** At most one, plus the clause saying at least one. */
  function exactlyOne(literals, counter, options) {
    const built = atMostOne(literals, counter, options);

    return { clauses: built.clauses.concat([literals.slice()]), auxiliary: built.auxiliary,
      encoding: built.encoding };
  }

  /**
   * A sequential counter for "at most k of these", which is what a rostering
   * model needs and what nobody wants to write by hand. r[i][j] reads "at
   * least j of x₁..xᵢ are true"; the clause families are the same three ideas
   * one dimension up. O(n·k) clauses and O(n·k) variables.
   */
  function atMostK(literals, k, counter) {
    const n = literals.length;

    if (k >= n) return { clauses: [], auxiliary: 0, encoding: 'sequential-k' };
    if (k === 0) {
      return { clauses: literals.map(function (l) { return [-l]; }), auxiliary: 0,
        encoding: 'sequential-k' };
    }
    const r = allocateCounterGrid(n, k, counter);
    return { clauses: counterClauses(literals, k, r), auxiliary: (n - 1) * k,
      encoding: 'sequential-k' };
  }

  function allocateCounterGrid(n, k, counter) {
    const r = [];

    for (let i = 0; i < n - 1; i += 1) {
      const row = [];
      for (let j = 0; j < k; j += 1) { counter.next += 1; row.push(counter.next); }
      r.push(row);
    }
    return r;
  }

  function counterClauses(literals, k, r) {
    const n = literals.length;
    const clauses = [[-literals[0], r[0][0]]];

    for (let j = 1; j < k; j += 1) clauses.push([-r[0][j]]);
    for (let i = 1; i < n - 1; i += 1) {
      clauses.push([-literals[i], r[i][0]]);
      clauses.push([-r[i - 1][0], r[i][0]]);
      for (let j = 1; j < k; j += 1) {
        clauses.push([-literals[i], -r[i - 1][j - 1], r[i][j]]);
        clauses.push([-r[i - 1][j], r[i][j]]);
      }
      clauses.push([-literals[i], -r[i - 1][k - 1]]);
    }
    clauses.push([-literals[n - 1], -r[n - 2][k - 1]]);
    return clauses;
  }

  /**
   * At least k, by the same counter over the negated literals: "at least k of
   * these are true" is "at most n − k of them are false". Writing it that way
   * rather than as a second counter means one implementation to get right,
   * and the two constraints together give exactly-k.
   */
  function atLeastK(literals, k, counter) {
    const built = atMostK(literals.map(function (l) { return -l; }),
      literals.length - k, counter);

    return { clauses: built.clauses, auxiliary: built.auxiliary, encoding: 'sequential-k' };
  }

  /* ------------------------------------------------------ graph colouring */

  /**
   * One variable per (vertex, colour). The model is: every vertex gets exactly
   * one colour, and no edge has both endpoints in the same colour. Everything
   * interesting is in which at-most-one encoding the first half uses, which is
   * why it is a parameter.
   */
  function colouringToCnf(graph, colours, options) {
    const settings = options || {};
    const counter = { next: graph.n * colours };
    const clauses = [];
    let auxiliary = 0;

    for (let v = 0; v < graph.n; v += 1) {
      const built = exactlyOne(colourLiterals(v, colours), counter, settings);
      built.clauses.forEach(function (clause) { clauses.push(clause); });
      auxiliary += built.auxiliary;
    }
    graph.edges.forEach(function (edge) {
      for (let c = 1; c <= colours; c += 1) {
        clauses.push([-colourVar(edge.from, c, colours), -colourVar(edge.to, c, colours)]);
      }
    });
    const broken = settings.symmetryBreaking ? breakColourSymmetry(graph, colours) : [];
    return { formula: Sat.createFormula(counter.next, clauses.concat(broken)),
      colours: colours, auxiliary: auxiliary, symmetryClauses: broken.length,
      encoding: settings.encoding === undefined ? 'pairwise' : settings.encoding,
      structural: clauses.length };
  }

  function colourVar(vertex, colour, colours) {
    return vertex * colours + colour;
  }

  function colourLiterals(vertex, colours) {
    const out = [];

    for (let c = 1; c <= colours; c += 1) out.push(colourVar(vertex, c, colours));
    return out;
  }

  /**
   * Fix the colours of a greedily grown clique. Every vertex of a clique needs
   * a distinct colour, so assigning them 1, 2, 3, … in order rules out nothing
   * and deletes a factor of up to c! from the search space. This is the
   * cheapest large win available in a colouring model, and it is a handful of
   * unit clauses.
   */
  function breakColourSymmetry(graph, colours) {
    const clique = greedyClique(graph);
    const clauses = [];

    clique.slice(0, colours).forEach(function (vertex, index) {
      clauses.push([colourVar(vertex, index + 1, colours)]);
    });
    return clauses;
  }

  function greedyClique(graph) {
    const adjacency = [];

    for (let v = 0; v < graph.n; v += 1) adjacency.push(new Set());
    graph.edges.forEach(function (edge) {
      adjacency[edge.from].add(edge.to);
      adjacency[edge.to].add(edge.from);
    });
    const order = orderByDegree(adjacency, graph.n);
    const clique = [];

    order.forEach(function (v) {
      const joins = clique.every(function (u) { return adjacency[v].has(u); });
      if (joins) clique.push(v);
    });
    return clique;
  }

  function orderByDegree(adjacency, n) {
    const order = [];

    for (let v = 0; v < n; v += 1) order.push(v);
    return order.sort(function (a, b) { return adjacency[b].size - adjacency[a].size; });
  }

  /** Read a colouring back out of a satisfying assignment. A vertex with no
   *  true colour variable is a broken model rather than an uncoloured vertex,
   *  so it comes back as −1 and the caller must notice. */
  function decodeColouring(assignment, n, colours) {
    const out = [];

    for (let v = 0; v < n; v += 1) {
      let found = -1;
      for (let c = 1; c <= colours; c += 1) {
        if (assignment[colourVar(v, c, colours) - 1] === 1) { found = c - 1; break; }
      }
      out.push(found);
    }
    return out;
  }

  /* -------------------------------------------------------- the comparison */

  /**
   * The same instance under every at-most-one encoding, with and without
   * symmetry breaking, solved by the bundled DPLL. Clause counts, variable
   * counts and decision counts side by side — the table the section exists to
   * print, and the answer must be identical in every row or the encoding is
   * wrong rather than slow.
   */
  function compareEncodings(graph, colours, options) {
    const settings = options || {};
    const rows = [];

    AT_MOST_ONE.forEach(function (encoding) {
      [false, true].forEach(function (symmetry) {
        rows.push(oneEncodingRow(graph, colours, { encoding: encoding,
          symmetryBreaking: symmetry, groupSize: settings.groupSize,
          budget: settings.budget }));
      });
    });
    const answers = new Set(rows.map(function (row) { return row.satisfiable; }));
    return { rows: rows, agreed: answers.size === 1 && !rows.some(function (r) {
      return r.exhausted;
    }), colours: colours, vertices: graph.n, edges: graph.edges.length };
  }

  function oneEncodingRow(graph, colours, settings) {
    const model = colouringToCnf(graph, colours, settings);
    const solved = Sat.dpll(model.formula, { budget: settings.budget === undefined
      ? 500000 : settings.budget });
    const decoded = solved.satisfiable
      ? decodeColouring(solved.assignment, graph.n, colours) : null;

    return { encoding: model.encoding, symmetryBreaking: Boolean(settings.symmetryBreaking),
      variables: model.formula.variables, auxiliary: model.auxiliary,
      clauses: model.formula.clauses.length, symmetryClauses: model.symmetryClauses,
      satisfiable: solved.satisfiable, exhausted: solved.exhausted,
      decisions: solved.stats.decisions, propagations: solved.stats.propagations,
      conflicts: solved.stats.conflicts, nodes: solved.stats.nodes,
      proper: decoded === null ? null : isProper(graph, decoded) };
  }

  function isProper(graph, colouring) {
    if (colouring.indexOf(-1) !== -1) return false;
    for (let i = 0; i < graph.edges.length; i += 1) {
      const edge = graph.edges[i];
      if (colouring[edge.from] === colouring[edge.to]) return false;
    }
    return true;
  }

  return {
    AT_MOST_ONE: AT_MOST_ONE,
    atMostOne: atMostOne, exactlyOne: exactlyOne, atMostK: atMostK, atLeastK: atLeastK,
    colouringToCnf: colouringToCnf, colourVar: colourVar, colourLiterals: colourLiterals,
    decodeColouring: decodeColouring, isProper: isProper,
    breakColourSymmetry: breakColourSymmetry, greedyClique: greedyClique,
    compareEncodings: compareEncodings
  };
}));

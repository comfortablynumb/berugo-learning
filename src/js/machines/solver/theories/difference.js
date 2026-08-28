/**
 * Difference logic: constraints of the form x - y <= k, decided by looking for
 * a negative cycle.
 *
 * The translation is the whole procedure. Read `x - y <= k` as an edge from y
 * to x with weight k, and a set of such constraints is a weighted graph. The
 * set is satisfiable exactly when that graph has no negative cycle — because a
 * negative cycle says a quantity is strictly less than itself — and the
 * shortest-path distances from a virtual source are then a satisfying
 * assignment. So Bellman-Ford from M13 decides the theory, and the model comes
 * out of the same run.
 *
 * That is the pattern worth noticing across theory solvers: EUF next door is
 * union-find with one rule added, and this one is a shortest-path algorithm
 * read sideways. The mathematics is usually somebody else's algorithm.
 *
 * Difference logic is a fragment of linear integer arithmetic rather than all
 * of it — `x + y <= 3` is not expressible — and that restriction is what buys
 * a polynomial decision procedure instead of an NP-hard one. Stating the
 * fragment is part of shipping the solver: a tool that quietly accepts a
 * constraint it cannot really decide is worse than one that refuses it.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.Berugo = root.Berugo || {};
    root.Berugo.TheoryDifference = api;
  }
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const NAME = 'difference';
  const SOURCE = '__source__';

  /**
   * A literal is `{ left, right, bound, equal }`, read as
   * `left - right <= bound`. `equal: false` negates it, and the negation of
   * `x - y <= k` over the integers is `y - x <= -k - 1`, which is the one
   * place the integrality is used and the reason this is a decision procedure
   * for integers rather than for reals.
   */
  function edgeOf(literal) {
    if (literal.equal === false) {
      return { from: literal.left, to: literal.right,
        weight: -Number(literal.bound) - 1, source: literal };
    }
    return { from: literal.right, to: literal.left,
      weight: Number(literal.bound), source: literal };
  }

  function verticesOf(edges) {
    const seen = {};

    edges.forEach(function (edge) { seen[edge.from] = true; seen[edge.to] = true; });
    return Object.keys(seen);
  }

  /* --------------------------------------------------------- the decision */

  /**
   * Bellman-Ford from a virtual source connected to every vertex at weight
   * zero, which is what makes the graph connected without changing which
   * cycles are negative. A relaxation on the |V|th round proves a negative
   * cycle, and the predecessor chain from that vertex is the cycle itself —
   * which is the unsat core, ready to hand back to the SAT core.
   */
  function decide(literals) {
    const edges = literals.map(edgeOf);
    const vertices = verticesOf(edges);
    const distance = {};
    const previous = {};

    vertices.forEach(function (name) { distance[name] = 0; previous[name] = null; });
    let relaxed = null;

    for (let round = 0; round <= vertices.length; round += 1) {
      relaxed = relaxRound(edges, distance, previous);
      if (!relaxed) break;
      if (round === vertices.length) {
        return { ok: false, cycle: cycleFrom(previous, relaxed.to, vertices.length),
          edges: edges, vertices: vertices };
      }
    }
    return { ok: true, distance: distance, edges: edges, vertices: vertices };
  }

  function relaxRound(edges, distance, previous) {
    let last = null;

    edges.forEach(function (edge) {
      if (distance[edge.from] + edge.weight >= distance[edge.to]) return;
      distance[edge.to] = distance[edge.from] + edge.weight;
      previous[edge.to] = edge;
      last = edge;
    });
    return last;
  }

  /**
   * Walk the predecessor chain far enough to be certainly inside the cycle,
   * then walk once more to collect it. Taking the chain from the relaxed
   * vertex directly is the classic mistake: the first few steps may be the
   * path INTO the cycle rather than the cycle.
   */
  function cycleFrom(previous, start, count) {
    let here = start;

    for (let step = 0; step <= count; step += 1) {
      if (!previous[here]) return [];
      here = previous[here].from;
    }
    const cycle = [];
    let walk = here;

    do {
      cycle.push(previous[walk]);
      walk = previous[walk].from;
    } while (walk !== here && cycle.length <= count + 1);
    return cycle.reverse();
  }

  function check(literals) {
    const out = decide(literals);

    if (out.ok) {
      return { ok: true, theory: NAME, model: out.distance,
        vertices: out.vertices.length, edges: out.edges.length };
    }
    return { ok: false, theory: NAME,
      explanation: out.cycle.map(function (edge) { return edge.source; }),
      cycle: out.cycle.map(describe) };
  }

  function describe(edge) {
    return edge.source.left + ' - ' + edge.source.right +
      (edge.source.equal === false ? ' > ' : ' <= ') + edge.source.bound;
  }

  /**
   * The independent check: substitute the model into every literal and
   * evaluate the arithmetic. It shares nothing with the shortest-path code, so
   * a relaxation written the wrong way round fails here rather than producing
   * a distance map that looks plausible.
   */
  function checkModel(literals, model) {
    for (let at = 0; at < literals.length; at += 1) {
      const row = literals[at];
      const left = model[row.left];
      const right = model[row.right];

      if (left === undefined || right === undefined) {
        return { ok: false, at: at, why: 'the model does not mention every variable' };
      }
      const holds = row.equal === false
        ? left - right > Number(row.bound)
        : left - right <= Number(row.bound);

      if (!holds) {
        return { ok: false, at: at,
          why: 'literal ' + at + ' (' + describe(edgeOf(row)) + ') fails at ' +
            left + ' - ' + right };
      }
    }
    return { ok: true, checked: literals.length };
  }

  /**
   * Every assignment over a bounded range, tried. The oracle for the decision
   * procedure, and useless past a handful of variables — which is what makes
   * it trustworthy on the fixtures.
   */
  function bruteForce(literals, span) {
    const range = span || 6;
    const names = verticesOf(literals.map(edgeOf));
    const total = Math.pow(2 * range + 1, names.length);

    if (names.length > 4) return { verdict: 'skipped', variables: names.length };
    for (let mask = 0; mask < total; mask += 1) {
      const model = {};
      let rest = mask;

      names.forEach(function (name) {
        model[name] = (rest % (2 * range + 1)) - range;
        rest = Math.floor(rest / (2 * range + 1));
      });
      if (checkModel(literals, model).ok) return { verdict: 'sat', model: model };
    }
    return { verdict: 'unsat', tried: total };
  }

  return { NAME: NAME, SOURCE: SOURCE, edgeOf: edgeOf, decide: decide, check: check,
    checkModel: checkModel, bruteForce: bruteForce, describe: describe };
}));

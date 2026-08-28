/**
 * Equality with uninterpreted functions, decided by congruence closure.
 *
 * The theory is small and the observation that decides it is smaller: if
 * a = b then f(a) = f(b), for every f, without knowing anything about f. So
 * the decision procedure is union-find with one extra rule — after merging two
 * classes, merge any pair of terms whose arguments are now all in the same
 * classes. That rule is the congruence closure, and it is the whole algorithm.
 *
 * Which means the data structure from M04 is doing the reasoning. Most theory
 * solvers are like this: the interesting part is a small rule bolted onto an
 * algorithm that already existed, and the engineering is in the interface to
 * the SAT core rather than in the mathematics.
 *
 * Two things the DPLL(T) core needs beyond a yes/no:
 *
 * - **an explanation** when the answer is unsat — the SUBSET of asserted
 *   literals that is already contradictory. Handing back the whole assertion
 *   set works and is useless: the core learns a clause that forbids exactly
 *   one assignment instead of a family of them. The explanation here is
 *   produced by re-running the merges and recording which assertions were
 *   needed, which is coarse but real;
 * - **a model** when the answer is sat — an assignment of terms to class
 *   representatives that a checker can verify against every asserted equality
 *   and disequality without trusting the solver.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.Berugo = root.Berugo || {};
    root.Berugo.TheoryEuf = api;
  }
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const NAME = 'euf';

  /* ------------------------------------------------------------ the terms */

  /**
   * A term is `{ fn, args }` with an empty argument list for a constant. They
   * are interned by their printed form, so structural equality is identity
   * and the union-find can work on integers.
   */
  function create() {
    return { terms: [], index: {}, parent: [], uses: [], merges: 0, congruences: 0 };
  }

  function term(state, fn, args) {
    const kids = (args || []).map(function (child) {
      return typeof child === 'number' ? child : term(state, child.fn, child.args);
    });
    /* The key names the CHILDREN rather than their ids, so it round-trips
       through `parse` in another state. Keying on ids looks equivalent and is
       not: `f(0)` re-parses as a constant called "0" rather than as the term
       that had id 0, which silently broke the unsat-core minimisation into a
       no-op. */
    const key = fn + '(' + kids.map(function (child) {
      return state.terms[child].key;
    }).join(',') + ')';

    if (state.index[key] !== undefined) return state.index[key];
    const id = state.terms.length;

    state.terms.push({ id: id, fn: fn, args: kids, key: key });
    state.index[key] = id;
    state.parent.push(id);
    state.uses.push([]);
    kids.forEach(function (child) { state.uses[child].push(id); });
    return id;
  }

  function parse(state, text) {
    const trimmed = String(text).trim();
    const open = trimmed.indexOf('(');

    if (open === -1) return term(state, trimmed, []);
    const fn = trimmed.slice(0, open).trim();
    const inner = trimmed.slice(open + 1, trimmed.lastIndexOf(')'));

    return term(state, fn, splitArgs(inner).map(function (part) {
      return parse(state, part);
    }));
  }

  function splitArgs(text) {
    const parts = [];
    let depth = 0;
    let current = '';

    text.split('').forEach(function (character) {
      if (character === ',' && depth === 0) { parts.push(current); current = ''; return; }
      if (character === '(') depth += 1;
      if (character === ')') depth -= 1;
      current += character;
    });
    if (current.trim()) parts.push(current);
    return parts;
  }

  /* -------------------------------------------------------- the union-find */

  function find(state, id) {
    let here = id;

    while (state.parent[here] !== here) here = state.parent[here];
    let walk = id;

    while (state.parent[walk] !== walk) {
      const next = state.parent[walk];

      state.parent[walk] = here;
      walk = next;
    }
    return here;
  }

  /**
   * Merge, then close under congruence. The closure step is the only thing
   * here that is not M04's disjoint-set: after a union, any two terms whose
   * arguments are now pairwise equal must themselves be equal, and finding
   * them is what the `uses` lists are for.
   */
  function union(state, left, right) {
    const a = find(state, left);
    const b = find(state, right);

    if (a === b) return false;
    state.parent[a] = b;
    state.merges += 1;
    closeCongruence(state);
    return true;
  }

  function closeCongruence(state) {
    let changed = true;

    while (changed) {
      changed = false;
      const buckets = {};

      state.terms.forEach(function (row) {
        if (!row.args.length) return;
        const key = row.fn + '|' + row.args.map(function (arg) {
          return find(state, arg);
        }).join(',');

        if (buckets[key] === undefined) { buckets[key] = row.id; return; }
        if (find(state, buckets[key]) === find(state, row.id)) return;
        state.parent[find(state, buckets[key])] = find(state, row.id);
        state.congruences += 1;
        changed = true;
      });
    }
  }

  /* --------------------------------------------------------- the decision */

  /**
   * Assert a conjunction of literals and report satisfiability. Equalities are
   * merged first and disequalities checked afterwards, which is correct
   * because merging can only ever make more things equal — so a disequality
   * that survives every merge is consistent, and one that does not is the
   * conflict.
   */
  /**
   * Every term is interned BEFORE any merge, and that ordering is load
   * bearing. Congruence closure runs when classes are joined, so a term
   * created afterwards is never considered — `f(a)` parsed after `a = b` was
   * merged stays in its own class, and the trial re-runs used for the unsat
   * core all silently reported "consistent". Parse first, merge second.
   */
  function decide(literals) {
    const state = create();
    const rows = literals.map(function (row) { return normalise(state, row); });
    const equalities = rows.filter(function (row) { return row.equal; });
    const disequalities = rows.filter(function (row) { return !row.equal; });

    equalities.forEach(function (row) { union(state, row.left, row.right); });
    return { state: state, equalities: equalities,
      broken: disequalities.filter(function (row) {
        return find(state, row.left) === find(state, row.right);
      }) };
  }

  function check(literals) {
    const out = decide(literals);

    if (!out.broken.length) {
      return { ok: true, theory: NAME, state: out.state, model: modelOf(out.state) };
    }
    return { ok: false, theory: NAME, state: out.state,
      explanation: explain(out.equalities, out.broken[0]),
      conflict: out.broken[0].source };
  }

  function normalise(state, row) {
    return { equal: row.equal !== false, source: row,
      left: parse(state, row.left), right: parse(state, row.right) };
  }

  /**
   * The unsat core, by deletion: drop each asserted equality in turn and see
   * whether the disequality is still contradicted. What survives is a subset
   * that is still inconsistent, which is what the SAT core wants — a clause
   * over three literals prunes far more of the search than a clause over
   * thirty.
   */
  function explain(equalities, broken) {
    let needed = equalities.map(function (row) { return row.source; });

    equalities.forEach(function (candidate) {
      const without = needed.filter(function (row) { return row !== candidate.source; });

      if (!contradicts(without, broken.source)) return;
      needed = without;
    });
    return needed.concat([broken.source]);
  }

  /** Re-decide from the literal TEXT, so nothing is carried over by id. */
  function contradicts(equalities, disequality) {
    return decide(equalities.concat([disequality])).broken.length > 0;
  }

  /** Every term with the class it ended in, which is the model to check. */
  function modelOf(state) {
    const rows = {};

    state.terms.forEach(function (row) { rows[row.key] = find(state, row.id); });
    return rows;
  }

  /**
   * The independent check: a model satisfies the literals when every asserted
   * equality names two terms in one class and every disequality names two in
   * different ones. It re-parses the terms rather than reusing the solver's
   * ids, so a solver that interned two different terms to one id fails here.
   */
  function checkModel(literals, model) {
    for (let at = 0; at < literals.length; at += 1) {
      const row = literals[at];
      const left = model[keyOf(row.left)];
      const right = model[keyOf(row.right)];

      if (left === undefined || right === undefined) {
        return { ok: false, at: at, why: 'the model does not mention every term' };
      }
      if ((left === right) !== (row.equal !== false)) {
        return { ok: false, at: at, why: 'literal ' + at + ' is not satisfied by the model' };
      }
    }
    return { ok: true, checked: literals.length };
  }

  /** The interned key for a term written as text, without a solver state. */
  function keyOf(text) {
    const state = create();
    const id = parse(state, text);

    return state.terms[id].key;
  }

  return { NAME: NAME, create: create, term: term, parse: parse, find: find, union: union,
    decide: decide, check: check, modelOf: modelOf, checkModel: checkModel, keyOf: keyOf };
}));

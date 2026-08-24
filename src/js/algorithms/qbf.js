/**
 * Quantified Boolean formulas: the same clauses, and a different problem.
 *
 * SAT asks whether SOME assignment satisfies the clauses. QBF puts a
 * quantifier in front of every variable and asks whether the resulting
 * sentence is true, which turns a search into a two-player game: the
 * existential player picks the values of the ∃ variables, the universal player
 * picks the ∀ ones, they alternate in the order the prefix names, and the
 * existential player wins exactly when the clauses end up satisfied. QBF is
 * PSPACE-complete, and the game reading is why — a game is the canonical
 * PSPACE-complete object.
 *
 * The engineering content is the difference in what a certificate looks like.
 * A satisfiable SAT instance has a certificate one line long: the assignment.
 * A true QBF sentence with k universal variables has, in general, no
 * certificate shorter than a STRATEGY — a function from the opponent's moves
 * to yours — and writing one down takes 2^k entries. That is the whole gap
 * between "find a configuration" and "find a configuration no adversary can
 * break", and it is why hardening optimisation is qualitatively harder than
 * plain optimisation rather than only bigger.
 *
 * Three things here are measured rather than asserted:
 *
 *   - `evaluate` expands the prefix recursively and counts its nodes, so the
 *     cost of an alternation is a column rather than a claim.
 *   - `asSat` deletes the quantifiers and solves the result as plain SAT. It
 *     answers a DIFFERENT question, and putting the two answers side by side
 *     is the fastest way to see that ∀ is not decoration.
 *   - `expandUniversals` writes the sentence out as one CNF by conjoining a
 *     copy per universal assignment. It is correct, it is what "expand the
 *     quantifiers" means, and its size doubles per ∀ variable — the reason
 *     nobody solves QBF that way past about twenty of them.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.Qbf = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const Random = scope && scope.Random ? scope.Random : require('../utils/random.js');
  const Sat = scope && scope.SatBasics ? scope.SatBasics : require('./sat-basics.js');

  const EXISTS = 'exists';
  const FORALL = 'forall';

  /* --------------------------------------------------------------- shapes */

  /**
   * `prefix` is one entry per variable in quantifier order, each
   * `{ quantifier, variable }` with `variable` a 1-based index. Variables not
   * named in the prefix are treated as existential and appended, because a
   * formula with a free variable is not a sentence and silently reading it as
   * one is how a QBF tool starts answering a question nobody asked.
   */
  function createQbf(prefix, clauses, variables) {
    const count = variables === undefined
      ? prefix.reduce(function (max, item) { return Math.max(max, item.variable); }, 0)
      : variables;
    const named = new Set(prefix.map(function (item) { return item.variable; }));
    const full = prefix.slice();

    for (let v = 1; v <= count; v += 1) {
      if (named.has(v)) continue;
      full.push({ quantifier: EXISTS, variable: v });
    }
    return { variables: count, prefix: full,
      clauses: clauses.map(function (clause) { return clause.slice(); }) };
  }

  /** How many times the quantifier changes along the prefix. Σ₂ is one. */
  function alternations(qbf) {
    let count = 0;

    for (let i = 1; i < qbf.prefix.length; i += 1) {
      if (qbf.prefix[i].quantifier !== qbf.prefix[i - 1].quantifier) count += 1;
    }
    return count;
  }

  function universalCount(qbf) {
    return qbf.prefix.filter(function (item) { return item.quantifier === FORALL; }).length;
  }

  /* -------------------------------------------------------- the evaluator */

  /**
   * Recursive quantifier expansion. The assignment is the ±1 trail encoding
   * `sat-basics` uses, so `clauseState` can prune: a clause already falsified
   * by the decided prefix ends the branch without descending, which is unit
   * propagation's poorer cousin and the only reason small instances finish.
   */
  function evaluate(qbf, options) {
    const settings = options || {};
    const budget = settings.budget === undefined ? 4000000 : settings.budget;
    const state = { nodes: 0, leaves: 0, prunes: 0, exhausted: false, budget: budget };
    const assignment = new Array(qbf.variables).fill(Sat.UNASSIGNED);
    const value = descend(qbf, 0, assignment, state);

    return { value: value === true, exhausted: state.exhausted, nodes: state.nodes,
      leaves: state.leaves, prunes: state.prunes, alternations: alternations(qbf),
      universals: universalCount(qbf), variables: qbf.variables,
      clauses: qbf.clauses.length };
  }

  function descend(qbf, index, assignment, state) {
    state.nodes += 1;
    if (state.nodes > state.budget) { state.exhausted = true; return false; }
    if (falsified(qbf, assignment)) { state.prunes += 1; return false; }
    if (index === qbf.prefix.length) {
      state.leaves += 1;
      return Sat.countSatisfied(qbf, assignment) === qbf.clauses.length;
    }
    const item = qbf.prefix[index];
    const wantAll = item.quantifier === FORALL;

    for (let side = 0; side < 2; side += 1) {
      assignment[item.variable - 1] = side === 0 ? 1 : -1;
      const outcome = descend(qbf, index + 1, assignment, state);
      assignment[item.variable - 1] = Sat.UNASSIGNED;
      if (wantAll && !outcome) return false;
      if (!wantAll && outcome) return true;
    }
    return wantAll;
  }

  /** A clause every one of whose literals is already false ends the branch. */
  function falsified(qbf, assignment) {
    for (let c = 0; c < qbf.clauses.length; c += 1) {
      if (Sat.clauseState(qbf.clauses[c], assignment).status === 'conflict') return true;
    }
    return false;
  }

  /* ------------------------------------------------------------ the oracle */

  /**
   * The same answer computed a completely different way: build the full truth
   * table of the matrix, then fold the prefix from the inside out, taking a
   * min over each ∀ level and a max over each ∃ level. It costs 2ⁿ always and
   * shares no code with `evaluate`, which is what makes it an oracle rather
   * than a second opinion from the same source.
   */
  function bruteForceQbf(qbf) {
    const total = Math.pow(2, qbf.variables);
    let table = new Array(total);

    for (let mask = 0; mask < total; mask += 1) {
      const assignment = maskToAssignment(mask, qbf.variables);
      table[mask] = Sat.countSatisfied(qbf, assignment) === qbf.clauses.length;
    }
    for (let i = qbf.prefix.length - 1; i >= 0; i -= 1) {
      table = foldLevel(table, qbf.prefix[i]);
    }
    return { value: table[0], entries: total };
  }

  function maskToAssignment(mask, variables) {
    const assignment = new Array(variables);

    for (let v = 0; v < variables; v += 1) assignment[v] = ((mask >>> v) & 1) ? 1 : -1;
    return assignment;
  }

  /** Collapse one variable out of the table, by min for ∀ and max for ∃. */
  function foldLevel(table, item) {
    const bit = 1 << (item.variable - 1);
    const out = new Array(table.length);

    for (let mask = 0; mask < table.length; mask += 1) {
      const a = table[mask & ~bit];
      const b = table[mask | bit];
      out[mask] = item.quantifier === FORALL ? (a && b) : (a || b);
    }
    return out;
  }

  /* ---------------------------------------------------------- the game tree */

  /**
   * The evaluation as a tree the demo can draw. `maxDepth` bounds it because a
   * full tree is 2ⁿ nodes; the truncated branches are counted and reported
   * rather than dropped, since "the tree shown is the tree" is exactly the
   * impression a truncated drawing gives.
   */
  function gameTree(qbf, options) {
    const settings = options || {};
    const maxDepth = settings.maxDepth === undefined ? 4 : settings.maxDepth;
    const state = { truncated: 0, nodes: 0 };
    const assignment = new Array(qbf.variables).fill(Sat.UNASSIGNED);
    const root_ = buildNode(qbf, 0, assignment, { maxDepth: maxDepth, state: state, label: 'root' });

    return { root: root_, truncated: state.truncated, nodes: state.nodes,
      shownDepth: Math.min(maxDepth, qbf.prefix.length) };
  }

  function buildNode(qbf, index, assignment, control) {
    control.state.nodes += 1;
    const item = index < qbf.prefix.length ? qbf.prefix[index] : null;
    const node = { label: control.label, depth: index, quantifier: item ? item.quantifier : null,
      variable: item ? item.variable : null, value: descend(qbf, index, assignment,
        { nodes: 0, leaves: 0, prunes: 0, exhausted: false, budget: 4000000 }) === true,
      children: [] };

    if (!item || index >= control.maxDepth) {
      if (item) control.state.truncated += 1;
      return node;
    }
    [1, -1].forEach(function (side) {
      assignment[item.variable - 1] = side;
      node.children.push(buildNode(qbf, index + 1, assignment, { maxDepth: control.maxDepth,
        state: control.state, label: 'x' + item.variable + (side === 1 ? '=1' : '=0') }));
      assignment[item.variable - 1] = Sat.UNASSIGNED;
    });
    return node;
  }

  /* ------------------------------------------------ the two cheap readings */

  /** Every quantifier existential: plain SAT, and a different question. */
  function asSat(qbf) {
    return Sat.createFormula(qbf.variables, qbf.clauses);
  }

  /**
   * The sentence written out as one CNF, by conjoining a copy of the matrix
   * for every assignment of the universal variables with fresh existential
   * variables per copy. Correct, and 2^u copies wide — which is the honest
   * reason "just expand the quantifiers and call a SAT solver" is not a
   * strategy past about twenty universals.
   */
  function expandUniversals(qbf, options) {
    const settings = options || {};
    const cap = settings.cap === undefined ? 16 : settings.cap;
    const universals = qbf.prefix.filter(function (i) { return i.quantifier === FORALL; });
    const existentials = qbf.prefix.filter(function (i) { return i.quantifier === EXISTS; });
    const copies = Math.pow(2, universals.length);

    if (universals.length > cap) {
      return { built: false, copies: copies, clauses: copies * qbf.clauses.length,
        variables: copies * existentials.length,
        reason: 'expansion needs ' + copies + ' copies, past the cap of 2^' + cap };
    }
    const built = buildExpansion(qbf, universals, existentials, copies);
    return { built: true, copies: copies, formula: built,
      clauses: built.clauses.length, variables: built.variables };
  }

  /**
   * An existential variable is chosen BEFORE the universals that follow it and
   * AFTER the ones that precede it, so it may not simply get a fresh copy per
   * expansion. It gets one copy per assignment of the universals that come
   * before it in the prefix, and is shared across every copy that agrees on
   * those. Giving every existential a fresh copy is the plausible version and
   * it is strictly weaker: on `EAE` at seed 14 it made a false sentence
   * expand to a satisfiable formula, which is what the round-trip test caught.
   */
  function buildExpansion(qbf, universals, existentials, copies) {
    const scopes = scopesOf(qbf, universals, existentials);
    const names = new Map();
    const clauses = [];
    const counter = { next: 0 };

    for (let mask = 0; mask < copies; mask += 1) {
      const fixed = new Map();
      universals.forEach(function (item, i) { fixed.set(item.variable, ((mask >>> i) & 1) === 1); });
      qbf.clauses.forEach(function (clause) {
        const rewritten = rewriteClause(clause,
          { fixed: fixed, scopes: scopes, names: names, counter: counter, mask: mask });
        if (rewritten !== null) clauses.push(rewritten);
      });
    }
    return Sat.createFormula(counter.next, clauses);
  }

  /** For each existential variable, the positions (within `universals`) of the
   *  universals that precede it in the prefix. */
  function scopesOf(qbf, universals, existentials) {
    const position = new Map();
    const out = new Map();
    let seen = 0;

    universals.forEach(function (item, i) { position.set(item.variable, i); });
    qbf.prefix.forEach(function (item) {
      if (item.quantifier === FORALL) { seen += 1; return; }
      const before = [];
      for (let i = 0; i < seen; i += 1) before.push(i);
      out.set(item.variable, before);
    });
    existentials.forEach(function (item) {
      if (!out.has(item.variable)) out.set(item.variable, []);
    });
    return out;
  }

  /** A clause already true under the fixed universals disappears; a literal
   *  already false drops out; an empty result is a contradiction clause. */
  function rewriteClause(clause, control) {
    const out = [];

    for (let i = 0; i < clause.length; i += 1) {
      const literal = clause[i];
      const variable = Math.abs(literal);
      if (!control.fixed.has(variable)) {
        const fresh = nameFor(variable, control);
        out.push(literal > 0 ? fresh : -fresh);
        continue;
      }
      if (control.fixed.get(variable) === (literal > 0)) return null;
    }
    return out;
  }

  /** The copy of an existential variable used in this expansion, keyed by the
   *  assignment of the universals that precede it. */
  function nameFor(variable, control) {
    const scope = control.scopes.get(variable) || [];
    let key = String(variable);

    for (let i = 0; i < scope.length; i += 1) {
      key += ':' + ((control.mask >>> scope[i]) & 1);
    }
    if (!control.names.has(key)) {
      control.counter.next += 1;
      control.names.set(key, control.counter.next);
    }
    return control.names.get(key);
  }

  /* ------------------------------------------------------------ generators */

  /**
   * A random matrix under a prefix with a chosen alternation pattern.
   * `pattern` is a string like 'EAE' read left to right and stretched over the
   * variables, so the same matrix can be posed as SAT, as a Σ₂ question and as
   * a full alternation without changing anything else.
   */
  function randomQbf(options) {
    const settings = options || {};
    const rng = Random.seeded(settings.seed === undefined ? 1 : settings.seed);
    const variables = settings.variables === undefined ? 10 : settings.variables;
    const pattern = settings.pattern === undefined ? 'EA' : settings.pattern;
    const clauses = randomClauses(rng, variables,
      settings.clauses === undefined ? Math.round(variables * 2.5) : settings.clauses,
      settings.width === undefined ? 3 : settings.width);
    const prefix = [];

    for (let v = 1; v <= variables; v += 1) {
      const slot = Math.floor((v - 1) * pattern.length / variables);
      prefix.push({ quantifier: pattern[slot] === 'A' ? FORALL : EXISTS, variable: v });
    }
    return createQbf(prefix, clauses, variables);
  }

  function randomClauses(rng, variables, count, width) {
    const clauses = [];

    for (let c = 0; c < count; c += 1) {
      const used = new Set();
      const clause = [];
      while (clause.length < Math.min(width, variables)) {
        const v = 1 + rng.int(variables);
        if (used.has(v)) continue;
        used.add(v);
        clause.push(rng.int(2) === 1 ? v : -v);
      }
      clauses.push(clause);
    }
    return clauses;
  }

  /**
   * The canonical true sentence: ∀x ∃y (x ↔ y), which says "whatever you play,
   * I can match it". Its matrix is two clauses per pair and it is true at every
   * size, so it is the fixture for "true, and no short certificate" — the
   * existential player's strategy is a function of the opponent's move.
   */
  function matchingGame(pairs) {
    const prefix = [];
    const clauses = [];

    for (let i = 0; i < pairs; i += 1) {
      const x = 2 * i + 1;
      const y = 2 * i + 2;
      prefix.push({ quantifier: FORALL, variable: x });
      prefix.push({ quantifier: EXISTS, variable: y });
      clauses.push([-x, y]);
      clauses.push([x, -y]);
    }
    return { qbf: createQbf(prefix, clauses, 2 * pairs), value: true, pairs: pairs,
      reason: 'the existential player answers each move with a copy of it' };
  }

  /** The same clauses with the quantifiers swapped: ∃y ∀x (x ↔ y) is FALSE at
   *  every size, because the answer has to be chosen before the question. */
  function swappedGame(pairs) {
    const built = matchingGame(pairs);
    const prefix = built.qbf.prefix.map(function (item) {
      return { quantifier: item.quantifier === FORALL ? EXISTS : FORALL, variable: item.variable };
    });
    return { qbf: createQbf(prefix, built.qbf.clauses, built.qbf.variables), value: false,
      pairs: pairs, reason: 'y is fixed before x is played, so x can always disagree' };
  }

  return {
    EXISTS: EXISTS, FORALL: FORALL,
    createQbf: createQbf, alternations: alternations, universalCount: universalCount,
    evaluate: evaluate, bruteForceQbf: bruteForceQbf, gameTree: gameTree,
    asSat: asSat, expandUniversals: expandUniversals,
    randomQbf: randomQbf, matchingGame: matchingGame, swappedGame: swappedGame
  };
}));

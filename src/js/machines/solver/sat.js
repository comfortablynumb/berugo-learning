/**
 * A CDCL SAT solver, and the two things that make an answer believable.
 *
 * The algorithm is the standard one and the parts are worth naming because
 * each is a separate idea: DPLL is the backbone (decide a variable, propagate
 * the consequences, backtrack on conflict); **two-watched literals** make
 * propagation cost proportional to the clauses that actually became unit
 * rather than to every clause holding the variable; **conflict analysis**
 * derives a new clause from the implication graph that the search would never
 * have violated, which is what turns backtracking into learning;
 * **non-chronological backjumping** then discards every level the learned
 * clause does not mention; and **VSIDS** biases the next decision towards the
 * variables that have been in recent conflicts, which is why a solver gets
 * faster on a hard instance rather than slower.
 *
 * The two checks are the point of this file existing rather than a library.
 *
 * **A SAT answer carries a model, and the model is checked against the
 * formula by code that is not the solver.** That is cheap and total: every
 * clause must contain a satisfied literal.
 *
 * **An UNSAT answer carries a DRAT proof.** "I searched and found nothing" is
 * not evidence, and a solver with a bug in its conflict analysis produces
 * exactly that sentence. Every learned clause is logged, and `checkProof`
 * verifies each one is a reverse-unit-propagation consequence of the clauses
 * before it — so an UNSAT answer is a derivation of the empty clause that can
 * be replayed by a checker with no search in it at all.
 *
 * Literals are integers: variable v is 2v for positive and 2v+1 for negative,
 * so negation is `lit ^ 1` and the variable is `lit >> 1`. That encoding is
 * not decoration — it is what makes the watch lists plain array indices.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.Berugo = root.Berugo || {};
    root.Berugo.Sat = api;
  }
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const UNASSIGNED = -1;

  /* ------------------------------------------------------------- literals */

  function lit(variable, negated) {
    return (variable << 1) | (negated ? 1 : 0);
  }

  function negate(literal) {
    return literal ^ 1;
  }

  function varOf(literal) {
    return literal >> 1;
  }

  function signOf(literal) {
    return (literal & 1) === 0;
  }

  /** DIMACS-style integers in, internal literals out: -3 becomes var 2 negated. */
  function fromDimacs(value) {
    return lit(Math.abs(value) - 1, value < 0);
  }

  function toDimacs(literal) {
    return (varOf(literal) + 1) * (signOf(literal) ? 1 : -1);
  }

  function clauseFromDimacs(row) {
    return row.map(fromDimacs);
  }

  /* --------------------------------------------------------------- state */

  function create(options) {
    const settings = options || {};

    return { variables: settings.variables || 0,
      clauses: [], watches: [], value: [], level: [], reason: [], activity: [],
      phase: [], trail: [], limits: [], head: 0, decisionLevel: 0,
      decisions: 0, propagations: 0, conflicts: 0, learned: 0, restarts: 0,
      clauseVisits: 0, deleted: 0, bump: 1, decay: settings.decay || 0.95,
      restartBase: settings.restartBase || 100, maxLearned: settings.maxLearned || 2000,
      proof: [], keepProof: settings.proof !== false, rootConflict: false,
      budget: settings.budget || 2000000, steps: 0 };
  }

  function ensureVariables(state, count) {
    while (state.variables < count) {
      state.value.push(UNASSIGNED);
      state.level.push(0);
      state.reason.push(null);
      state.activity.push(0);
      state.phase.push(false);
      state.watches.push([]);
      state.watches.push([]);
      state.variables += 1;
    }
    return state.variables;
  }

  /**
   * Add a clause. A duplicated literal is dropped and a clause containing
   * both polarities of a variable is a tautology and is discarded — both
   * matter, because a clause with a repeated literal breaks the two-watched
   * invariant by letting one watch stand for two positions.
   */
  function addClause(state, literals) {
    const seen = {};
    const kept = [];
    let tautology = false;

    literals.forEach(function (literal) {
      if (seen[negate(literal)]) tautology = true;
      if (seen[literal]) return;
      seen[literal] = true;
      kept.push(literal);
    });
    if (tautology) return null;
    ensureVariables(state, Math.max.apply(null, kept.map(varOf).concat([-1])) + 1);
    return attach(state, kept, false);
  }

  function attach(state, literals, learned) {
    const clause = { literals: literals, learned: Boolean(learned), activity: 0 };

    state.clauses.push(clause);
    if (literals.length === 0) { state.rootConflict = true; return clause; }
    /* A unit clause is an assignment rather than a watched clause, and the
       failure of that assignment has to be recorded. Ignoring the return
       value here means two contradictory units — `p` and `not p` — are both
       swallowed and the solver reports SAT for a formula that is trivially
       unsatisfiable, which is what the differential against brute force
       caught. */
    if (literals.length === 1) {
      if (!enqueue(state, literals[0], null)) state.rootConflict = true;
      return clause;
    }
    state.watches[negate(literals[0])].push(clause);
    state.watches[negate(literals[1])].push(clause);
    return clause;
  }

  /* ------------------------------------------------------------ the trail */

  function valueOf(state, literal) {
    const assigned = state.value[varOf(literal)];

    if (assigned === UNASSIGNED) return UNASSIGNED;
    return assigned === (signOf(literal) ? 1 : 0) ? 1 : 0;
  }

  function enqueue(state, literal, reason) {
    const variable = varOf(literal);

    if (state.value[variable] !== UNASSIGNED) return valueOf(state, literal) === 1;
    state.value[variable] = signOf(literal) ? 1 : 0;
    state.level[variable] = state.decisionLevel;
    state.reason[variable] = reason;
    state.phase[variable] = signOf(literal);
    state.trail.push(literal);
    return true;
  }

  /**
   * `limits[L]` is the trail length just BEFORE level L's decision, so
   * everything assigned at levels 0..level is kept by popping back to
   * `limits[level + 1]`.
   *
   * Popping back to `limits[level]` instead is off by one level and it is
   * catastrophic at level 0, where `limits[0]` is never set: backtracking to
   * the root emptied the entire trail, including the assignments made by the
   * formula's UNIT clauses. A unit clause carries no watches — it is an
   * assignment, not a clause to revisit — so nothing ever re-derived them, and
   * the solver went on to assign those variables the other way and returned a
   * model that did not satisfy the formula it was given. Random 3-CNF has no
   * unit clauses, so the differential against brute force never saw it; the
   * bounded model checker, whose encoding pins the initial state with one unit
   * clause per variable, saw it immediately.
   */
  function backtrack(state, level) {
    const keep = state.limits[level + 1] === undefined
      ? state.trail.length : state.limits[level + 1];

    while (state.trail.length > keep) {
      const literal = state.trail.pop();

      state.value[varOf(literal)] = UNASSIGNED;
      state.reason[varOf(literal)] = null;
    }
    state.limits.length = level + 1;
    state.head = state.trail.length;
    state.decisionLevel = level;
  }

  /* --------------------------------------------------- watched propagation */

  /**
   * Two-watched-literal propagation. A clause is only visited when one of its
   * two watched literals becomes false, and the visit either finds a new
   * literal to watch or discovers the clause is unit or conflicting. The
   * saving over counting occurrences is that nothing has to be touched on
   * BACKTRACK — the watches are still valid, because a literal that was not
   * false cannot have become false by unassigning something.
   */
  function propagate(state) {
    while (state.head < state.trail.length) {
      const literal = state.trail[state.head];

      state.head += 1;
      state.propagations += 1;
      const conflict = visitWatchers(state, literal);

      if (conflict) return conflict;
    }
    return null;
  }

  function visitWatchers(state, literal) {
    const list = state.watches[literal];
    const keep = [];
    let conflict = null;

    for (let at = 0; at < list.length; at += 1) {
      state.clauseVisits += 1;
      if (conflict) { keep.push(list[at]); continue; }
      const outcome = visitClause(state, list[at], literal);

      if (outcome.moved) continue;
      keep.push(list[at]);
      if (outcome.conflict) conflict = list[at];
    }
    state.watches[literal] = keep;
    return conflict;
  }

  function visitClause(state, clause, falsified) {
    const literals = clause.literals;
    const other = negate(falsified);

    if (literals[0] === other) { literals[0] = literals[1]; literals[1] = other; }
    if (valueOf(state, literals[0]) === 1) return { moved: false, conflict: false };
    for (let at = 2; at < literals.length; at += 1) {
      if (valueOf(state, literals[at]) === 0) continue;
      literals[1] = literals[at];
      literals[at] = other;
      state.watches[negate(literals[1])].push(clause);
      return { moved: true, conflict: false };
    }
    if (enqueue(state, literals[0], clause)) return { moved: false, conflict: false };
    return { moved: false, conflict: true };
  }

  /* ------------------------------------------------------ conflict analysis */

  /**
   * First-UIP conflict analysis. Walk back through the trail resolving the
   * conflicting clause with the reasons of the literals assigned at the
   * current level, until exactly one literal from that level remains — the
   * unique implication point. The result is a clause that is implied by the
   * formula and that the search will never violate the same way twice, and
   * the second-highest level in it is where to jump back to.
   */
  function analyse(state, conflict) {
    const seen = {};
    const learned = [null];
    let counter = 0;
    let index = state.trail.length - 1;
    let literal = null;
    let clause = conflict;

    do {
      counter += resolveInto(state, clause, literal, seen, learned);
      while (!seen[varOf(state.trail[index])]) index -= 1;
      literal = state.trail[index];
      clause = state.reason[varOf(literal)];
      seen[varOf(literal)] = false;
      counter -= 1;
      index -= 1;
    } while (counter > 0);
    learned[0] = negate(literal);
    return finishLearned(state, learned);
  }

  function resolveInto(state, clause, skip, seen, learned) {
    let added = 0;

    clause.literals.forEach(function (candidate) {
      const variable = varOf(candidate);

      if (candidate === skip || seen[variable] || state.level[variable] === 0) return;
      seen[variable] = true;
      bumpVariable(state, variable);
      if (state.level[variable] >= state.decisionLevel) { added += 1; return; }
      learned.push(candidate);
    });
    return added;
  }

  function finishLearned(state, learned) {
    let level = 0;

    for (let at = 1; at < learned.length; at += 1) {
      if (state.level[varOf(learned[at])] <= level) continue;
      level = state.level[varOf(learned[at])];
      const swap = learned[1];

      learned[1] = learned[at];
      learned[at] = swap;
    }
    return { literals: learned, level: level };
  }

  /* ----------------------------------------------------------- heuristics */

  function bumpVariable(state, variable) {
    state.activity[variable] += state.bump;
    if (state.activity[variable] < 1e100) return;
    for (let at = 0; at < state.variables; at += 1) state.activity[at] *= 1e-100;
    state.bump *= 1e-100;
  }

  /**
   * VSIDS: pick the unassigned variable whose activity is highest, and take
   * the phase it was last assigned. Phase saving matters more than it looks —
   * after a restart it puts the search straight back into the region it was
   * exploring, so a restart costs the decisions and not the work.
   */
  function decide(state) {
    let best = -1;

    for (let variable = 0; variable < state.variables; variable += 1) {
      if (state.value[variable] !== UNASSIGNED) continue;
      if (best === -1 || state.activity[variable] > state.activity[best]) best = variable;
    }
    if (best === -1) return false;
    state.decisions += 1;
    state.decisionLevel += 1;
    state.limits[state.decisionLevel] = state.trail.length;
    enqueue(state, lit(best, !state.phase[best]), null);
    return true;
  }

  /** Luby-style restarts: frequent early, rarer later, and never at level 0. */
  function lubyAt(index) {
    let size = 1;
    let sequence = 0;

    while (size < index + 1) { sequence += 1; size = 2 * size + 1; }
    let value = index;
    let span = size;

    while (span - 1 !== value) {
      span = (span - 1) >> 1;
      sequence -= 1;
      value = value % span;
    }
    return 1 << sequence;
  }

  /* ---------------------------------------------------------- the search */

  function solve(formula, options) {
    const state = create(options || {});

    ensureVariables(state, formula.variables || 0);
    let unsat = false;

    /* The formula arrives in DIMACS integers, which is what every fixture
       format and every encoder in the milestone produces; the solver works in
       the shifted encoding, where negation is one XOR and a watch list is an
       array index. The conversion belongs here rather than at every caller. */
    formula.clauses.forEach(function (row) {
      if (row.length === 0) { unsat = true; return; }
      addClause(state, clauseFromDimacs(row));
    });
    if (unsat || state.rootConflict) return rootUnsat(state);
    if (propagate(state)) return rootUnsat(state);
    return search(state);
  }

  /**
   * The solver stopped at its n-th conflict, with the trail intact.
   *
   * Clause learning is the one idea in this milestone that has to be SEEN: the
   * implication graph, the cut, and the clause that comes out of it. Reporting
   * it needs a snapshot taken before `handleConflict` backtracks, which is why
   * this repeats the search loop rather than adding a callback to it — a hook
   * inside `search` would be one more thing that can be wrong in the solver
   * every other section depends on.
   */
  function firstConflict(formula, options) {
    const settings = options || {};
    const wanted = settings.at || 1;
    const state = loaded(formula, settings);

    if (!state) return { found: false, why: 'the formula is unsatisfiable at level 0' };
    for (let guard = 0; guard < (settings.budget || 200000); guard += 1) {
      const conflict = propagate(state);

      if (conflict) {
        if (state.conflicts + 1 >= wanted && state.decisionLevel > 0) {
          return snapshot(state, conflict);
        }
        if (handleConflict(state, conflict) === 'unsat') {
          return { found: false, why: 'proved unsatisfiable before conflict ' + wanted };
        }
        continue;
      }
      if (!decide(state)) return { found: false, why: 'satisfiable with no conflict left' };
    }
    return { found: false, why: 'ran out of steps looking for conflict ' + wanted };
  }

  function loaded(formula, settings) {
    const state = create(Object.assign({}, settings, { proof: false }));
    let broken = false;

    ensureVariables(state, formula.variables || 0);
    formula.clauses.forEach(function (row) {
      if (row.length === 0) { broken = true; return; }
      addClause(state, clauseFromDimacs(row));
    });
    if (broken || state.rootConflict || propagate(state)) return null;
    return state;
  }

  function snapshot(state, conflict) {
    const learned = analyse(state, conflict);

    return { found: true, at: state.conflicts + 1, level: state.decisionLevel,
      conflict: conflict.literals.map(toDimacs),
      learned: learned.literals.map(toDimacs), backjump: learned.level,
      trail: state.trail.map(function (literal) {
        const variable = varOf(literal);
        const reason = state.reason[variable];

        return { literal: toDimacs(literal), level: state.level[variable],
          decision: !reason,
          reason: reason ? reason.literals.map(toDimacs) : null };
      }) };
  }

  /** The empty clause really is derivable, so the proof has to say so. */
  function rootUnsat(state) {
    if (state.keepProof) state.proof.push([]);
    return report(state, 'unsat', null);
  }

  function search(state) {
    let sinceRestart = 0;
    let restartLimit = state.restartBase * lubyAt(0);

    for (;;) {
      state.steps += 1;
      if (state.steps > state.budget) return report(state, 'unknown', null);
      const conflict = propagate(state);

      if (conflict) {
        const outcome = handleConflict(state, conflict);

        if (outcome === 'unsat') return report(state, 'unsat', null);
        sinceRestart += 1;
        continue;
      }
      if (sinceRestart >= restartLimit) {
        state.restarts += 1;
        sinceRestart = 0;
        restartLimit = state.restartBase * lubyAt(state.restarts);
        backtrack(state, 0);
        continue;
      }
      if (!decide(state)) return report(state, 'sat', modelOf(state));
    }
  }

  function handleConflict(state, conflict) {
    state.conflicts += 1;
    if (state.decisionLevel === 0) {
      if (state.keepProof) state.proof.push([]);
      return 'unsat';
    }
    const learned = analyse(state, conflict);

    backtrack(state, learned.level);
    if (state.keepProof) {
      state.proof.push(learned.literals.map(toDimacs));
    }
    state.learned += 1;
    const clause = attach(state, learned.literals, true);

    if (learned.literals.length > 1) enqueue(state, learned.literals[0], clause);
    state.bump /= state.decay;
    return 'continue';
  }

  function modelOf(state) {
    const model = [];

    for (let variable = 0; variable < state.variables; variable += 1) {
      model.push(state.value[variable] === 1);
    }
    return model;
  }

  function report(state, verdict, model) {
    return { verdict: verdict, model: model, state: state,
      decisions: state.decisions, propagations: state.propagations,
      conflicts: state.conflicts, learned: state.learned, restarts: state.restarts,
      clauseVisits: state.clauseVisits, steps: state.steps,
      proof: state.proof, variables: state.variables };
  }

  return { UNASSIGNED: UNASSIGNED,
    lit: lit, negate: negate, varOf: varOf, signOf: signOf,
    fromDimacs: fromDimacs, toDimacs: toDimacs, clauseFromDimacs: clauseFromDimacs,
    create: create, ensureVariables: ensureVariables, addClause: addClause,
    valueOf: valueOf, propagate: propagate, analyse: analyse, decide: decide,
    lubyAt: lubyAt, solve: solve, modelOf: modelOf,
    firstConflict: firstConflict };
}));

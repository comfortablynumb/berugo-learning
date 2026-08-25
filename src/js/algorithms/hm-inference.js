/**
 * Hindley–Milner: inferring types nobody wrote down.
 *
 * Algorithm W is three ideas working together. Unification solves equations
 * between types by walking two trees in step and binding variables as it goes.
 * Generalisation, at a `let`, closes over the type variables the environment
 * does not mention — those are the ones the definition genuinely does not care
 * about, and closing over them is what makes `id` usable at two types in one
 * program. Instantiation reopens them fresh at every use.
 *
 * Two details cause almost every real error message. The occurs check refuses
 * `α = α → β`, because that equation has no finite solution and accepting it
 * builds an infinite type. And the *order* of unification decides which
 * location a mismatch is blamed on — inference is deterministic, so a
 * confusing error is a consequence of the traversal order, not bad luck.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.HmInference = api;
}(this, function () {
  'use strict';

  /* -------------------------------------------------------------- types */

  function tvar(name) { return { type: 'var', name: name }; }
  function tcon(name, args) { return { type: 'con', name: name, args: args || [] }; }
  function tarrow(from, to) { return tcon('→', [from, to]); }

  const NUMBER = tcon('Number');
  const BOOLEAN = tcon('Boolean');
  const STRING = tcon('String');

  function showType(type, parenthesise) {
    if (type.type === 'var') return type.name;
    if (type.name === '→') {
      const text = showType(type.args[0], true) + ' → ' + showType(type.args[1], false);

      return parenthesise ? '(' + text + ')' : text;
    }
    if (type.args.length === 0) return type.name;
    return type.name + ' ' + type.args.map(function (a) {
      return showType(a, true);
    }).join(' ');
  }

  function showScheme(scheme) {
    if (scheme.quantified.length === 0) return showType(scheme.body, false);
    return '∀' + scheme.quantified.join(' ') + '. ' + showType(scheme.body, false);
  }

  function freeTypeVariables(type, into) {
    const found = into || [];

    if (type.type === 'var') {
      if (found.indexOf(type.name) === -1) found.push(type.name);
      return found;
    }
    type.args.forEach(function (arg) { freeTypeVariables(arg, found); });
    return found;
  }

  /* -------------------------------------------------------- substitution */

  /**
   * One pass, never chasing a binding into the substitution again. Chasing
   * would loop the moment composition produced `α := β, β := α`, and it is
   * unnecessary: `compose` keeps substitutions idempotent by applying the
   * outer one to every value of the inner one as it builds the result.
   */
  function applySubstitution(substitution, type) {
    if (type.type === 'var') {
      const bound = substitution[type.name];

      return bound === undefined ? type : bound;
    }
    return tcon(type.name, type.args.map(function (arg) {
      return applySubstitution(substitution, arg);
    }));
  }

  function applyToScheme(substitution, scheme) {
    const trimmed = {};

    Object.keys(substitution).forEach(function (name) {
      if (scheme.quantified.indexOf(name) === -1) trimmed[name] = substitution[name];
    });
    return { quantified: scheme.quantified, body: applySubstitution(trimmed, scheme.body) };
  }

  function applyToEnvironment(substitution, environment) {
    const next = {};

    Object.keys(environment).forEach(function (name) {
      next[name] = applyToScheme(substitution, environment[name]);
    });
    return next;
  }

  function compose(outer, inner) {
    const result = {};

    Object.keys(inner).forEach(function (name) {
      result[name] = applySubstitution(outer, inner[name]);
    });
    Object.keys(outer).forEach(function (name) {
      if (result[name] === undefined) result[name] = outer[name];
    });
    return result;
  }

  /* ---------------------------------------------------------- unification */

  /**
   * Robinson's algorithm, with the two failures that carry all the meaning:
   * a constructor clash (`Number` against `Boolean`) and the occurs check
   * (`α` against `α → β`). Both are reported with the pair that clashed, which
   * is what a good error message quotes.
   */
  function unify(left, right, log) {
    const trace = log || [];

    trace.push({ left: showType(left, false), right: showType(right, false) });
    if (left.type === 'var') return bindVariable(left.name, right, trace);
    if (right.type === 'var') return bindVariable(right.name, left, trace);
    if (left.name !== right.name || left.args.length !== right.args.length) {
      return { ok: false, why: 'cannot match ' + showType(left, false)
        + ' with ' + showType(right, false), kind: 'clash', trace: trace };
    }
    return unifyArguments(left, right, trace);
  }

  function unifyArguments(left, right, trace) {
    let substitution = {};

    for (let i = 0; i < left.args.length; i += 1) {
      const step = unify(applySubstitution(substitution, left.args[i]),
        applySubstitution(substitution, right.args[i]), trace);

      if (!step.ok) return step;
      substitution = compose(step.substitution, substitution);
    }
    return { ok: true, substitution: substitution, trace: trace };
  }

  function bindVariable(name, type, trace) {
    if (type.type === 'var' && type.name === name) {
      return { ok: true, substitution: {}, trace: trace };
    }
    if (freeTypeVariables(type).indexOf(name) !== -1) {
      return { ok: false, kind: 'occurs', trace: trace,
        why: 'the occurs check failed: ' + name + ' appears inside '
          + showType(type, false) + ', so the equation has no finite solution' };
    }
    const substitution = {};

    substitution[name] = type;
    return { ok: true, substitution: substitution, trace: trace };
  }

  /* ------------------------------------------------------------ schemes */

  function monomorphic(type) { return { quantified: [], body: type }; }

  /** Close over every variable free in the type but not in the environment. */
  function generalise(environment, type) {
    const bound = [];

    Object.keys(environment).forEach(function (name) {
      freeTypeVariables(environment[name].body).forEach(function (variable) {
        if (environment[name].quantified.indexOf(variable) === -1) bound.push(variable);
      });
    });
    return { quantified: freeTypeVariables(type).filter(function (name) {
      return bound.indexOf(name) === -1;
    }), body: type };
  }

  /** Reopen a scheme with fresh variables — one per use site. */
  function instantiate(scheme, fresh) {
    const substitution = {};

    scheme.quantified.forEach(function (name) { substitution[name] = fresh(); });
    return applySubstitution(substitution, scheme.body);
  }

  /* --------------------------------------------------------- algorithm W */

  function makeCounter() {
    const state = { next: 0, names: [] };

    state.fresh = function () {
      const name = nameFor(state.next);

      state.next += 1;
      state.names.push(name);
      return tvar(name);
    };
    return state;
  }

  const GREEK = ['α', 'β', 'γ', 'δ', 'ε', 'ζ', 'η', 'θ', 'ι', 'κ', 'λ', 'μ'];

  function nameFor(index) {
    if (index < GREEK.length) return GREEK[index];
    return 't' + index;
  }

  /**
   * `infer` returns the substitution and the type, and appends a line to the
   * log for every rule it applies — the log *is* the explanation the demo
   * prints, so nothing about the inference is hidden.
   */
  function infer(term, environment, state) {
    const handler = RULES[term.type];

    if (handler === undefined) {
      return fail(state, 'no inference rule for ' + term.type);
    }
    return handler(term, environment, state);
  }

  function fail(state, why) {
    return { ok: false, why: why, substitution: {}, type: tvar('?') };
  }

  function note(state, rule, text) {
    state.log.push({ rule: rule, text: text });
  }

  const RULES = {
    num: function (term, environment, state) {
      note(state, 'W-Num', String(term.value) + ' : Number');
      return { ok: true, substitution: {}, type: NUMBER };
    },
    bool: function (term, environment, state) {
      note(state, 'W-Bool', String(term.value) + ' : Boolean');
      return { ok: true, substitution: {}, type: BOOLEAN };
    },
    str: function (term, environment, state) {
      note(state, 'W-Str', '"' + term.value + '" : String');
      return { ok: true, substitution: {}, type: STRING };
    },
    var: function (term, environment, state) { return inferVariable(term, environment, state); },
    lam: function (term, environment, state) { return inferLambda(term, environment, state); },
    app: function (term, environment, state) { return inferApplication(term, environment, state); },
    let: function (term, environment, state) { return inferLet(term, environment, state); },
    if: function (term, environment, state) { return inferIf(term, environment, state); }
  };

  function inferVariable(term, environment, state) {
    const scheme = environment[term.name];

    if (scheme === undefined) {
      return fail(state, 'unbound variable ' + term.name);
    }
    const type = instantiate(scheme, state.counter.fresh);

    note(state, 'W-Var', term.name + ' : ' + showScheme(scheme)
      + (scheme.quantified.length ? ' instantiated to ' + showType(type, false) : ''));
    return { ok: true, substitution: {}, type: type };
  }

  function inferLambda(term, environment, state) {
    const argument = state.counter.fresh();
    const extended = Object.assign({}, environment);

    extended[term.param] = monomorphic(argument);
    note(state, 'W-Abs', 'assume ' + term.param + ' : ' + showType(argument, false));
    const body = infer(term.body, extended, state);

    if (!body.ok) return body;
    const type = tarrow(applySubstitution(body.substitution, argument), body.type);

    note(state, 'W-Abs', 'so λ' + term.param + '. … : ' + showType(type, false));
    return { ok: true, substitution: body.substitution, type: type };
  }

  function inferApplication(term, environment, state) {
    const left = infer(term.left, environment, state);

    if (!left.ok) return left;
    const right = infer(term.right, applyToEnvironment(left.substitution, environment), state);

    if (!right.ok) return right;
    const result = state.counter.fresh();
    const expected = tarrow(right.type, result);
    const applied = applySubstitution(right.substitution, left.type);
    const solved = unify(applied, expected, state.unifications);

    if (!solved.ok) {
      return { ok: false, why: solved.why, kind: solved.kind, substitution: {}, type: result,
        blame: 'applying ' + showType(applied, false) + ' to ' + showType(right.type, false) };
    }
    note(state, 'W-App', showType(applied, false) + ' applied to '
      + showType(right.type, false) + ' gives ' + showType(applySubstitution(solved.substitution, result), false));
    return { ok: true, type: applySubstitution(solved.substitution, result),
      substitution: compose(solved.substitution, compose(right.substitution, left.substitution)) };
  }

  function inferLet(term, environment, state) {
    const bound = infer(term.value, environment, state);

    if (!bound.ok) return bound;
    const narrowed = applyToEnvironment(bound.substitution, environment);
    const scheme = generalise(narrowed, bound.type);
    const extended = Object.assign({}, narrowed);

    extended[term.name] = scheme;
    note(state, 'W-Let', 'generalise ' + term.name + ' : ' + showScheme(scheme)
      + (scheme.quantified.length === 0 ? ' (nothing to generalise)' : ''));
    const body = infer(term.body, extended, state);

    if (!body.ok) return body;
    return { ok: true, type: body.type,
      substitution: compose(body.substitution, bound.substitution) };
  }

  function inferIf(term, environment, state) {
    const parts = [term.test, term.then, term.other].map(function (part) {
      return infer(part, environment, state);
    });
    const bad = parts.filter(function (part) { return !part.ok; })[0];

    if (bad) return bad;
    const guard = unify(parts[0].type, BOOLEAN, state.unifications);

    if (!guard.ok) {
      return { ok: false, why: 'the guard of an if must be Boolean, not '
        + showType(parts[0].type, false), kind: guard.kind, substitution: {}, type: tvar('?') };
    }
    return joinBranches(parts, guard, state);
  }

  function joinBranches(parts, guard, state) {
    const branches = unify(applySubstitution(guard.substitution, parts[1].type),
      applySubstitution(guard.substitution, parts[2].type), state.unifications);

    if (!branches.ok) {
      return { ok: false, why: 'the two branches disagree: ' + branches.why,
        kind: branches.kind, substitution: {}, type: tvar('?') };
    }
    const type = applySubstitution(branches.substitution,
      applySubstitution(guard.substitution, parts[1].type));

    note(state, 'W-If', 'both branches are ' + showType(type, false));
    return { ok: true, type: type,
      substitution: compose(branches.substitution, compose(guard.substitution,
        compose(parts[2].substitution, compose(parts[1].substitution, parts[0].substitution)))) };
  }

  /* ---------------------------------------------------------- the entry */

  function run(term, environment) {
    const state = { counter: makeCounter(), log: [], unifications: [] };
    const result = infer(term, environment || baseEnvironment(), state);
    const type = result.ok ? applySubstitution(result.substitution, result.type) : null;

    return { ok: result.ok, why: result.why || '', kind: result.kind || '',
      blame: result.blame || '',
      type: type, text: type ? showType(renameForDisplay(type), false) : '—',
      scheme: type ? showScheme(displayScheme(type)) : '—',
      log: state.log, unifications: state.unifications,
      freshVariables: state.counter.next, unificationCount: state.unifications.length };
  }

  function displayScheme(type) {
    return generalise({}, renameForDisplay(type));
  }

  /** Renumber from α so the answer does not depend on how much work it took. */
  function renameForDisplay(type) {
    const substitution = {};

    freeTypeVariables(type).forEach(function (name, index) {
      substitution[name] = tvar(nameFor(index));
    });
    return applySubstitution(substitution, type);
  }

  function baseEnvironment() {
    return {
      add: monomorphic(tarrow(NUMBER, tarrow(NUMBER, NUMBER))),
      isZero: monomorphic(tarrow(NUMBER, BOOLEAN)),
      pair: { quantified: ['a', 'b'],
        body: tarrow(tvar('a'), tarrow(tvar('b'), tcon('Pair', [tvar('a'), tvar('b')]))) },
      fst: { quantified: ['a', 'b'],
        body: tarrow(tcon('Pair', [tvar('a'), tvar('b')]), tvar('a')) },
      nil: { quantified: ['a'], body: tcon('List', [tvar('a')]) },
      cons: { quantified: ['a'],
        body: tarrow(tvar('a'), tarrow(tcon('List', [tvar('a')]), tcon('List', [tvar('a')]))) },
      length: { quantified: ['a'], body: tarrow(tcon('List', [tvar('a')]), NUMBER) },
      show: { quantified: ['a'], body: tarrow(tvar('a'), STRING) }
    };
  }

  return {
    tvar: tvar, tcon: tcon, tarrow: tarrow, NUMBER: NUMBER, BOOLEAN: BOOLEAN, STRING: STRING,
    showType: showType, showScheme: showScheme, freeTypeVariables: freeTypeVariables,
    applySubstitution: applySubstitution, compose: compose, unify: unify,
    monomorphic: monomorphic, generalise: generalise, instantiate: instantiate,
    infer: infer, run: run, makeCounter: makeCounter, baseEnvironment: baseEnvironment,
    renameForDisplay: renameForDisplay, nameFor: nameFor
  };
}));

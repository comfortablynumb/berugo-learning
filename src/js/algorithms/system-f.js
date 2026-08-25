/**
 * System F: polymorphism written down rather than inferred.
 *
 * Hindley–Milner hides two operations. System F puts them back in the term:
 * `Λα. e` abstracts over a type, and `e [T]` applies one. That is all it adds,
 * and it buys a lot — rank-2 arguments (`(∀α. α → α) → …`), Church encodings
 * of every data type, and existential types by way of the dual encoding.
 *
 * It costs the thing HM was built to keep. Type inference for System F is
 * undecidable (Wells, 1994), so every type application in a real language —
 * Java's `Collections.<String>emptyList()`, Rust's turbofish — is either
 * written or recovered by a heuristic that can fail. The demo shows the exact
 * terms where HM gives up and System F does not.
 *
 * Parametricity is the payoff. A closed term of type `∀α. α → α` has no way to
 * inspect its argument, so it can only return it; the type alone rules out
 * every other implementation. That is a *free theorem*, and this module checks
 * a few of them by enumerating the normal forms of the type.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.SystemF = api;
}(this, function () {
  'use strict';

  /* -------------------------------------------------------------- types */

  function tvar(name) { return { kind: 'tvar', name: name }; }
  function tarrow(from, to) { return { kind: 'arrow', from: from, to: to }; }
  function forAll(param, body) { return { kind: 'forall', param: param, body: body }; }
  function tcon(name) { return { kind: 'con', name: name }; }

  function showType(type, inner) {
    if (type.kind === 'tvar' || type.kind === 'con') return type.name;
    if (type.kind === 'arrow') {
      const text = showType(type.from, true) + ' → ' + showType(type.to, false);

      return inner ? '(' + text + ')' : text;
    }
    const text = '∀' + type.param + '. ' + showType(type.body, false);

    return inner ? '(' + text + ')' : text;
  }

  function sameType(left, right) {
    return showType(alphaNormalise(left, {}, { next: 0 }), false)
      === showType(alphaNormalise(right, {}, { next: 0 }), false);
  }

  /** Rename bound type variables to a canonical order, so ∀α.α→α = ∀β.β→β. */
  function alphaNormalise(type, mapping, counter) {
    if (type.kind === 'con') return type;
    if (type.kind === 'tvar') {
      return tvar(mapping[type.name] === undefined ? type.name : mapping[type.name]);
    }
    if (type.kind === 'arrow') {
      return tarrow(alphaNormalise(type.from, mapping, counter),
        alphaNormalise(type.to, mapping, counter));
    }
    const fresh = '#' + counter.next;
    const next = Object.assign({}, mapping);

    counter.next += 1;
    next[type.param] = fresh;
    return forAll(fresh, alphaNormalise(type.body, next, counter));
  }

  function substituteType(type, name, value) {
    if (type.kind === 'con') return type;
    if (type.kind === 'tvar') return type.name === name ? value : type;
    if (type.kind === 'arrow') {
      return tarrow(substituteType(type.from, name, value),
        substituteType(type.to, name, value));
    }
    if (type.param === name) return type;
    return forAll(type.param, substituteType(type.body, name, value));
  }

  /* -------------------------------------------------------------- terms */

  function variable(name) { return { kind: 'var', name: name }; }
  function lam(param, paramType, body) {
    return { kind: 'lam', param: param, paramType: paramType, body: body };
  }
  function app(left, right) { return { kind: 'app', left: left, right: right }; }
  function tlam(param, body) { return { kind: 'tlam', param: param, body: body }; }
  function tapp(term, type) { return { kind: 'tapp', term: term, type: type }; }

  function showTerm(term) {
    if (term.kind === 'var') return term.name;
    if (term.kind === 'lam') {
      return 'λ' + term.param + ': ' + showType(term.paramType, false) + '. ' + showTerm(term.body);
    }
    if (term.kind === 'tlam') return 'Λ' + term.param + '. ' + showTerm(term.body);
    if (term.kind === 'tapp') return showAtom(term.term) + ' [' + showType(term.type, false) + ']';
    return showAtom(term.left) + ' ' + showAtom(term.right);
  }

  function showAtom(term) {
    return term.kind === 'var' || term.kind === 'tapp'
      ? showTerm(term) : '(' + showTerm(term) + ')';
  }

  /* ------------------------------------------------------------- typing */

  const RULES = {
    var: 'T-Var', lam: 'T-Abs', app: 'T-App', tlam: 'T-TAbs', tapp: 'T-TApp'
  };

  function check(term, context) {
    const environment = context || { terms: {}, types: [] };
    const handler = CHECKERS[term.kind];

    return handler(term, environment);
  }

  const CHECKERS = {
    var: function (term, environment) {
      const type = environment.terms[term.name];

      if (type === undefined) {
        return bad(term, environment, 'unbound variable ' + term.name);
      }
      return good(term, environment, type, []);
    },
    lam: function (term, environment) { return checkLambda(term, environment); },
    app: function (term, environment) { return checkApplication(term, environment); },
    tlam: function (term, environment) { return checkTypeLambda(term, environment); },
    tapp: function (term, environment) { return checkTypeApplication(term, environment); }
  };

  function good(term, environment, type, children) {
    return { rule: RULES[term.kind], term: showTerm(term), type: type,
      judgement: judgement(environment, term, type), ok: true, children: children, why: '' };
  }

  function bad(term, environment, why, children) {
    return { rule: RULES[term.kind], term: showTerm(term), type: null,
      judgement: judgement(environment, term, null), ok: false,
      children: children || [], why: why };
  }

  function judgement(environment, term, type) {
    return showContext(environment) + ' ⊢ ' + showTerm(term)
      + ' : ' + (type ? showType(type, false) : '?');
  }

  function showContext(environment) {
    const parts = environment.types.slice().concat(Object.keys(environment.terms)
      .map(function (name) {
        return name + ': ' + showType(environment.terms[name], false);
      }));

    return parts.length === 0 ? '∅' : parts.join(', ');
  }

  function checkLambda(term, environment) {
    const extended = { types: environment.types,
      terms: Object.assign({}, environment.terms) };

    extended.terms[term.param] = term.paramType;
    const body = check(term.body, extended);

    if (!body.ok) return bad(term, environment, body.why, [body]);
    return good(term, environment, tarrow(term.paramType, body.type), [body]);
  }

  function checkApplication(term, environment) {
    const left = check(term.left, environment);
    const right = check(term.right, environment);

    if (!left.ok || !right.ok) {
      return bad(term, environment, (left.why || right.why), [left, right]);
    }
    if (left.type.kind !== 'arrow') {
      return bad(term, environment, showTerm(term.left) + ' has type '
        + showType(left.type, false) + ', which is not a function type', [left, right]);
    }
    if (!sameType(left.type.from, right.type)) {
      return bad(term, environment, 'expected ' + showType(left.type.from, false)
        + ' but the argument is ' + showType(right.type, false), [left, right]);
    }
    return good(term, environment, left.type.to, [left, right]);
  }

  function checkTypeLambda(term, environment) {
    const extended = { types: environment.types.concat([term.param]),
      terms: environment.terms };
    const body = check(term.body, extended);

    if (!body.ok) return bad(term, environment, body.why, [body]);
    return good(term, environment, forAll(term.param, body.type), [body]);
  }

  function checkTypeApplication(term, environment) {
    const inner = check(term.term, environment);

    if (!inner.ok) return bad(term, environment, inner.why, [inner]);
    if (inner.type.kind !== 'forall') {
      return bad(term, environment, showTerm(term.term) + ' has type '
        + showType(inner.type, false) + ', which is not a ∀ type, so it takes no type argument',
      [inner]);
    }
    return good(term, environment,
      substituteType(inner.type.body, inner.type.param, term.type), [inner]);
  }

  /* --------------------------------------------------------- reduction */

  /**
   * Two beta rules instead of one. The type-level rule erases in a real
   * compiler — that is exactly what "types are erased at runtime" means, and
   * `erase` shows the untyped term that survives.
   */
  function reduce(term, budget) {
    const cap = budget || 200;
    const trace = [{ step: 0, term: showTerm(term), rule: '—' }];
    let current = term;
    let steps = 0;

    while (steps < cap) {
      const next = stepTerm(current);

      if (next === null) break;
      current = next.term;
      steps += 1;
      trace.push({ step: steps, term: showTerm(current), rule: next.rule });
    }
    return { term: current, text: showTerm(current), steps: steps, trace: trace,
      normal: stepTerm(current) === null };
  }

  function stepTerm(term) {
    if (term.kind === 'app' && term.left.kind === 'lam') {
      return { term: substituteTerm(term.left.body, term.left.param, term.right),
        rule: 'E-AppAbs' };
    }
    if (term.kind === 'tapp' && term.term.kind === 'tlam') {
      return { term: substituteTermType(term.term.body, term.term.param, term.type),
        rule: 'E-TAppTAbs' };
    }
    return stepInside(term);
  }

  const CHILDREN = { app: ['left', 'right'], tapp: ['term'], lam: ['body'], tlam: ['body'] };

  function stepInside(term) {
    const slots = CHILDREN[term.kind] || [];

    for (let i = 0; i < slots.length; i += 1) {
      const inner = stepTerm(term[slots[i]]);

      if (inner === null) continue;
      const copy = Object.assign({}, term);

      copy[slots[i]] = inner.term;
      return { term: copy, rule: inner.rule };
    }
    return null;
  }

  function substituteTerm(term, name, value) {
    if (term.kind === 'var') return term.name === name ? value : term;
    if (term.kind === 'lam') {
      return term.param === name ? term
        : lam(term.param, term.paramType, substituteTerm(term.body, name, value));
    }
    if (term.kind === 'tlam') return tlam(term.param, substituteTerm(term.body, name, value));
    if (term.kind === 'tapp') return tapp(substituteTerm(term.term, name, value), term.type);
    return app(substituteTerm(term.left, name, value), substituteTerm(term.right, name, value));
  }

  function substituteTermType(term, name, type) {
    if (term.kind === 'var') return term;
    if (term.kind === 'lam') {
      return lam(term.param, substituteType(term.paramType, name, type),
        substituteTermType(term.body, name, type));
    }
    if (term.kind === 'tlam') {
      return term.param === name ? term
        : tlam(term.param, substituteTermType(term.body, name, type));
    }
    if (term.kind === 'tapp') {
      return tapp(substituteTermType(term.term, name, type),
        substituteType(term.type, name, type));
    }
    return app(substituteTermType(term.left, name, type),
      substituteTermType(term.right, name, type));
  }

  /** What the runtime sees: types gone, structure unchanged. */
  function erase(term) {
    if (term.kind === 'var') return term.name;
    if (term.kind === 'lam') return 'λ' + term.param + '. ' + erase(term.body);
    if (term.kind === 'tlam') return erase(term.body);
    if (term.kind === 'tapp') return erase(term.term);
    return eraseLeft(term.left) + ' ' + eraseRight(term.right);
  }

  /**
   * Parenthesise by what the erased text *is*, not by what the typed term was:
   * `Λα. λx: α. x` erases to a lambda even though it was a type abstraction,
   * and printing it bare in a function position would reparse as something
   * else entirely.
   */
  function eraseLeft(term) {
    const text = erase(term);

    return text.charAt(0) === 'λ' ? '(' + text + ')' : text;
  }

  function eraseRight(term) {
    const text = erase(term);

    return text.indexOf(' ') === -1 ? text : '(' + text + ')';
  }

  /* --------------------------------------------------- free theorems */

  /**
   * Enumerate every closed normal-form term of a type, up to a small size, and
   * report how many there are. For `∀α. α → α` the answer is one, and that one
   * is the identity — which is parametricity, made countable rather than
   * asserted.
   */
  function inhabitants(type, limit) {
    const cap = limit === undefined ? 4 : limit;
    const found = [];

    search(type, { types: [], terms: {} }, cap, found, { fresh: 0 });
    return found;
  }

  function search(type, environment, fuel, found, counter) {
    if (fuel < 0 || found.length >= 12) return;
    if (type.kind === 'forall') {
      const inner = { types: environment.types.concat([type.param]), terms: environment.terms };

      searchInto(type.body, inner, fuel, found, counter, function (body) {
        return tlam(type.param, body);
      });
      return;
    }
    if (type.kind === 'arrow') {
      searchArrow(type, environment, fuel, found, counter);
      return;
    }
    variablesOfType(environment, type).forEach(function (name) {
      found.push(variable(name));
    });
  }

  function searchArrow(type, environment, fuel, found, counter) {
    const name = 'x' + counter.fresh;
    const extended = { types: environment.types,
      terms: Object.assign({}, environment.terms) };

    counter.fresh += 1;
    extended.terms[name] = type.from;
    searchInto(type.to, extended, fuel, found, counter, function (body) {
      return lam(name, type.from, body);
    });
    counter.fresh -= 1;
  }

  function searchInto(type, environment, fuel, found, counter, wrap) {
    const inner = [];

    search(type, environment, fuel - 1, inner, counter);
    inner.forEach(function (body) { found.push(wrap(body)); });
  }

  /** Variables in scope whose type matches. */
  function variablesOfType(environment, type) {
    return Object.keys(environment.terms).filter(function (name) {
      return sameType(environment.terms[name], type);
    });
  }

  /**
   * The enumeration above only builds abstractions and variables, never
   * applications — so it is a *complete* count exactly when no assumption it
   * introduces could be applied to anything, that is, when every argument
   * position of the type is a bare type variable. `enumerable` says so, and
   * every claim the section makes is guarded by it rather than by hope.
   */
  function enumerable(type) {
    if (type.kind === 'tvar' || type.kind === 'con') return true;
    if (type.kind === 'forall') return enumerable(type.body);
    return type.from.kind === 'tvar' && enumerable(type.to);
  }

  const FREE_THEOREMS = [
    { type: forAll('a', tarrow(tvar('a'), tvar('a'))), name: '∀α. α → α',
      claim: 'only the identity', expected: 1 },
    { type: forAll('a', forAll('b', tarrow(tvar('a'), tarrow(tvar('b'), tvar('a'))))),
      name: '∀α β. α → β → α', claim: 'only "keep the first"', expected: 1 },
    { type: forAll('a', tarrow(tvar('a'), tarrow(tvar('a'), tvar('a')))),
      name: '∀α. α → α → α', claim: 'exactly two: first or second', expected: 2 },
    { type: forAll('a', tvar('a')), name: '∀α. α',
      claim: 'nothing at all — the empty type', expected: 0 },
    { type: forAll('a', forAll('b', tarrow(tvar('a'), tvar('b')))), name: '∀α β. α → β',
      claim: 'nothing: no way to make a β', expected: 0 }
  ];

  function freeTheorems() {
    return FREE_THEOREMS.map(function (entry) {
      const terms = inhabitants(entry.type, 4);

      return { name: entry.name, claim: entry.claim, expected: entry.expected,
        count: terms.length, terms: terms.map(erase), complete: enumerable(entry.type),
        matches: terms.length === entry.expected && enumerable(entry.type) };
    });
  }

  return {
    tvar: tvar, tarrow: tarrow, forAll: forAll, tcon: tcon,
    showType: showType, sameType: sameType, substituteType: substituteType,
    variable: variable, lam: lam, app: app, tlam: tlam, tapp: tapp,
    showTerm: showTerm, check: check, reduce: reduce, erase: erase,
    inhabitants: inhabitants, freeTheorems: freeTheorems, FREE_THEOREMS: FREE_THEOREMS,
    enumerable: enumerable,
    showContext: showContext
  };
}));

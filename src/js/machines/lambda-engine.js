/**
 * The untyped lambda calculus: parsing, capture-avoiding substitution, and
 * five reduction strategies over one term representation.
 *
 * Three lines of grammar — a variable, an abstraction, an application — and
 * everything computable. What makes an implementation of it worth having is
 * the part everybody gets wrong the first time: SUBSTITUTION. Replacing `x`
 * with a term that mentions `y` inside a `λy` binder captures the `y`, and the
 * result means something else entirely. The fix is to rename the binder first,
 * and the same bug appears in macro systems, template engines and every code
 * generator that pastes an expression into a scope it did not check.
 *
 * The strategies matter for the same practical reason. Call-by-value evaluates
 * an argument before the function that may not use it, so an argument that
 * diverges takes the whole program down; call-by-name does not, and pays by
 * re-evaluating. `(λx. λy. y) Ω` terminates under one and not the other, and
 * the demo runs both on it rather than describing the difference.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.LambdaEngine = api;
}(this, function () {
  'use strict';

  const STRATEGIES = ['normal', 'applicative', 'callByName', 'callByValue', 'headSpine'];

  /**
   * What each strategy is, in the words a working programmer would use. The
   * `finds` column is the one that matters: normal order finds a normal form
   * whenever one exists (that is the standardisation theorem), and the others
   * trade that guarantee for something else — sharing, strictness, or simply
   * stopping at a value the way every mainstream language does.
   */
  const STRATEGY_INFO = {
    normal: { label: 'normal order', picks: 'leftmost, outermost redex',
      finds: 'a normal form whenever one exists',
      seenIn: 'the standardisation theorem; nothing implements it directly' },
    applicative: { label: 'applicative order', picks: 'leftmost, innermost redex',
      finds: 'a normal form only if every subterm has one',
      seenIn: 'strict evaluation taken all the way under lambdas' },
    callByName: { label: 'call by name', picks: 'the outermost redex, never under a λ',
      finds: 'a weak head normal form',
      seenIn: 'Haskell without sharing; Algol 60 parameters' },
    callByValue: { label: 'call by value', picks: 'arguments first, never under a λ',
      finds: 'a value',
      seenIn: 'JavaScript, Python, Java, C, ML — almost everything' },
    headSpine: { label: 'head reduction', picks: 'only redexes on the head spine',
      finds: 'a head normal form',
      seenIn: 'proofs that a term is solvable even with no normal form' }
  };

  /* ------------------------------------------------------------ the terms */

  function variable(name) { return { type: 'var', name: name }; }
  function lambda(param, body) { return { type: 'lam', param: param, body: body }; }
  function apply(left, right) { return { type: 'app', left: left, right: right }; }

  /* ----------------------------------------------------------- the parser */

  /**
   * `λx. x`, `\x. x` and `^x. x` all parse. Application is left-associative
   * and binds tighter than abstraction, so `λx. x y` is `λx. (x y)` — the
   * convention every text uses and the one that surprises people once.
   */
  function parse(text) {
    const tokens = tokenise(text);
    const state = { tokens: tokens, at: 0 };
    const term = parseTerm(state);

    if (state.at < tokens.length) {
      throw new Error('unexpected "' + tokens[state.at] + '" at token ' + state.at);
    }
    return term;
  }

  function tokenise(text) {
    const out = [];
    let at = 0;

    while (at < text.length) {
      const ch = text[at];

      if (ch === ' ' || ch === '\n' || ch === '\t') { at += 1; continue; }
      if ('λ\\^().'.indexOf(ch) !== -1) { out.push(ch === '\\' || ch === '^' ? 'λ' : ch);
        at += 1; continue; }
      let length = 0;

      while (at + length < text.length && /[A-Za-z0-9_']/.test(text[at + length])) length += 1;
      if (length === 0) throw new Error('unexpected character "' + ch + '"');
      out.push(text.slice(at, at + length));
      at += length;
    }
    return out;
  }

  function parseTerm(state) {
    if (state.tokens[state.at] === 'λ') return parseLambda(state);
    return parseApplication(state);
  }

  /** `λx y. body` is sugar for `λx. λy. body`, which is worth supporting
   *  because every real example is written that way. */
  function parseLambda(state) {
    state.at += 1;
    const params = [];

    while (state.at < state.tokens.length && /^[A-Za-z0-9_']+$/.test(state.tokens[state.at])) {
      params.push(state.tokens[state.at]);
      state.at += 1;
    }
    if (params.length === 0) throw new Error('a lambda needs at least one parameter');
    if (state.tokens[state.at] !== '.') throw new Error('expected "." after the parameters');
    state.at += 1;
    const body = parseTerm(state);

    return params.reduceRight(function (acc, param) { return lambda(param, acc); }, body);
  }

  function parseApplication(state) {
    let left = parseAtom(state);

    for (;;) {
      const token = state.tokens[state.at];

      if (token === undefined || token === ')' || token === '.') return left;
      if (token === 'λ') { left = apply(left, parseLambda(state)); continue; }
      left = apply(left, parseAtom(state));
    }
  }

  function parseAtom(state) {
    const token = state.tokens[state.at];

    if (token === '(') {
      state.at += 1;
      const inner = parseTerm(state);

      if (state.tokens[state.at] !== ')') throw new Error('expected ")"');
      state.at += 1;
      return inner;
    }
    if (token === 'λ') return parseLambda(state);
    if (token === undefined) throw new Error('unexpected end of term');
    state.at += 1;
    return variable(token);
  }

  /* ------------------------------------------------------------- printing */

  function show(term) {
    if (term.type === 'var') return term.name;
    if (term.type === 'lam') return 'λ' + term.param + '. ' + show(term.body);
    return showLeft(term.left) + ' ' + showRight(term.right);
  }

  function showLeft(term) {
    return term.type === 'lam' ? '(' + show(term) + ')' : show(term);
  }

  function showRight(term) {
    return term.type === 'var' ? show(term) : '(' + show(term) + ')';
  }

  function size(term) {
    if (term.type === 'var') return 1;
    if (term.type === 'lam') return 1 + size(term.body);
    return 1 + size(term.left) + size(term.right);
  }

  /* --------------------------------------------------- free and bound */

  function freeVariables(term, bound) {
    const seen = bound || [];

    if (term.type === 'var') return seen.indexOf(term.name) === -1 ? [term.name] : [];
    if (term.type === 'lam') return freeVariables(term.body, seen.concat([term.param]));
    return unique(freeVariables(term.left, seen).concat(freeVariables(term.right, seen)));
  }

  function unique(list) {
    return list.filter(function (item, i) { return list.indexOf(item) === i; });
  }

  /** A name not free in either term, so renaming a binder to it cannot
   *  capture anything. */
  function freshName(base, avoid) {
    let name = base;

    while (avoid.indexOf(name) !== -1) name += "'";
    return name;
  }

  /* -------------------------------------------------------- substitution */

  /**
   * `term[name := value]`, avoiding capture.
   *
   * The case that matters is the third: substituting into `λy. body` where the
   * replacement mentions `y` free. Pasting it in would bind that `y` to this
   * binder and change the meaning — `(λx. λy. x) y` would become `λy. y`, the
   * identity, instead of a function returning the outer `y`. The binder is
   * renamed first, which is α-conversion, and the demo reports when it happens.
   */
  function substitute(term, name, value, log) {
    if (term.type === 'var') return term.name === name ? value : term;
    if (term.type === 'app') {
      return apply(substitute(term.left, name, value, log),
        substitute(term.right, name, value, log));
    }
    if (term.param === name) return term;
    if (freeVariables(value).indexOf(term.param) === -1) {
      return lambda(term.param, substitute(term.body, name, value, log));
    }
    const fresh = freshName(term.param,
      unique(freeVariables(value).concat(freeVariables(term.body)).concat([name])));
    const renamed = substitute(term.body, term.param, variable(fresh), null);

    if (log) {
      log.push({ from: term.param, to: fresh,
        why: 'the replacement mentions ' + term.param + ' free, so binding it here would ' +
          'capture it' });
    }
    return lambda(fresh, substitute(renamed, name, value, log));
  }

  /** Are two terms the same up to the names of bound variables? */
  function alphaEqual(left, right, leftBound, rightBound) {
    const a = leftBound || [];
    const b = rightBound || [];

    if (left.type !== right.type) return false;
    if (left.type === 'var') return depth(a, left.name) === depth(b, right.name)
      && (depth(a, left.name) !== -1 || left.name === right.name);
    if (left.type === 'lam') {
      return alphaEqual(left.body, right.body, [left.param].concat(a),
        [right.param].concat(b));
    }
    return alphaEqual(left.left, right.left, a, b)
      && alphaEqual(left.right, right.right, a, b);
  }

  function depth(bound, name) { return bound.indexOf(name); }

  /* ------------------------------------------------------- de Bruijn form */

  /**
   * Indices instead of names: a variable is the number of binders between it
   * and the one that binds it. α-equivalence becomes syntactic equality, which
   * is why every serious implementation uses this and every teaching one does
   * not.
   */
  function toDeBruijn(term, context) {
    const stack = context || [];

    if (term.type === 'var') {
      const index = stack.indexOf(term.name);

      return index === -1 ? term.name : String(index);
    }
    if (term.type === 'lam') return 'λ ' + toDeBruijn(term.body, [term.param].concat(stack));
    return '(' + toDeBruijn(term.left, stack) + ' ' + toDeBruijn(term.right, stack) + ')';
  }

  /* ----------------------------------------------------------- reduction */

  function isValue(term) { return term.type === 'lam'; }

  function isRedex(term) {
    return term.type === 'app' && term.left.type === 'lam';
  }

  /**
   * One step under a strategy, or null when the term is in that strategy's
   * normal form. Each strategy is a different answer to "which redex next",
   * and that single choice is the whole difference between them.
   */
  const STEPPERS = {
    /* Leftmost-outermost: reduces the outermost redex first, and finds a
       normal form whenever one exists. */
    normal: function (term, log) {
      if (isRedex(term)) return beta(term, log);
      if (term.type === 'lam') {
        const body = STEPPERS.normal(term.body, log);

        return body ? lambda(term.param, body) : null;
      }
      if (term.type !== 'app') return null;
      const left = STEPPERS.normal(term.left, log);

      if (left) return apply(left, term.right);
      const right = STEPPERS.normal(term.right, log);

      return right ? apply(term.left, right) : null;
    },
    /* Leftmost-innermost: arguments first, which is what most languages do
       and why a diverging argument takes the program down. */
    applicative: function (term, log) {
      if (term.type === 'lam') {
        const body = STEPPERS.applicative(term.body, log);

        return body ? lambda(term.param, body) : null;
      }
      if (term.type !== 'app') return null;
      const left = STEPPERS.applicative(term.left, log);

      if (left) return apply(left, term.right);
      const right = STEPPERS.applicative(term.right, log);

      if (right) return apply(term.left, right);
      return isRedex(term) ? beta(term, log) : null;
    },
    /* Call-by-name: like normal order, but never reduces under a lambda —
       so it stops at a weak head normal form, which is what a real
       lazy language does. */
    callByName: function (term, log) {
      if (term.type !== 'app') return null;
      if (isRedex(term)) return beta(term, log);
      const left = STEPPERS.callByName(term.left, log);

      return left ? apply(left, term.right) : null;
    },
    /* Call-by-value: argument to a value first, then apply, and never under
       a lambda. This is JavaScript, Python, Java and almost everything else. */
    callByValue: function (term, log) {
      if (term.type !== 'app') return null;
      const left = STEPPERS.callByValue(term.left, log);

      if (left) return apply(left, term.right);
      if (!isValue(term.left)) return null;
      const right = STEPPERS.callByValue(term.right, log);

      if (right) return apply(term.left, right);
      return isValue(term.right) ? beta(term, log) : null;
    },
    /* Head reduction only: useful for showing that a term has a head normal
       form even when it has no normal form. */
    headSpine: function (term, log) {
      if (isRedex(term)) return beta(term, log);
      if (term.type !== 'app') return null;
      const left = STEPPERS.headSpine(term.left, log);

      return left ? apply(left, term.right) : null;
    }
  };

  function beta(term, log) {
    const renames = [];
    const result = substitute(term.left.body, term.left.param, term.right, renames);

    if (log) {
      log.push({ rule: 'β', param: term.left.param, argument: show(term.right),
        renames: renames });
    }
    return result;
  }

  /**
   * Reduce to a normal form or the step budget. The budget is not optional —
   * `Ω` has no normal form under any strategy, and a reducer with no bound
   * either hangs or lies about it.
   */
  function reduce(term, strategy, options) {
    const settings = options || {};
    const budget = settings.budget === undefined ? 1000 : settings.budget;
    const trace = [];
    const renames = [];
    let current = term;
    let steps = 0;

    while (steps < budget) {
      if (trace.length < (settings.traceLimit === undefined ? 40 : settings.traceLimit)) {
        trace.push({ step: steps, term: show(current), size: size(current) });
      }
      const log = [];
      const next = STEPPERS[strategy](current, log);

      if (next === null) {
        return finish(current, steps, trace, renames, 'normal');
      }
      log.forEach(function (entry) {
        (entry.renames || []).forEach(function (rename) { renames.push(rename); });
      });
      current = next;
      steps += 1;
      if (size(current) > (settings.sizeCap === undefined ? 8000 : settings.sizeCap)) {
        return finish(current, steps, trace, renames, 'size');
      }
    }
    return finish(current, steps, trace, renames, 'budget');
  }

  function finish(term, steps, trace, renames, outcome) {
    return { term: term, text: show(term), steps: steps, trace: trace,
      outcome: outcome, normal: outcome === 'normal', size: size(term),
      renames: renames };
  }

  /** Every strategy on one term, which is the demo's table — and the only
   *  honest way to show that the choice changes whether it terminates. */
  function compare(term, options) {
    return STRATEGIES.map(function (strategy) {
      const result = reduce(term, strategy, options);

      return { strategy: strategy, outcome: result.outcome, steps: result.steps,
        text: result.text, normal: result.normal, size: result.size };
    });
  }

  /* ------------------------------------------------------ Church encodings */

  const CHURCH = {
    'true': 'λt f. t',
    'false': 'λt f. f',
    'not': 'λb. b (λt f. f) (λt f. t)',
    and: 'λp q. p q p',
    or: 'λp q. p p q',
    'if': 'λc t e. c t e',
    zero: 'λf x. x',
    one: 'λf x. f x',
    two: 'λf x. f (f x)',
    three: 'λf x. f (f (f x))',
    succ: 'λn f x. f (n f x)',
    plus: 'λm n f x. m f (n f x)',
    mult: 'λm n f. m (n f)',
    isZero: 'λn. n (λx. λt f. f) (λt f. t)',
    pair: 'λa b s. s a b',
    fst: 'λp. p (λa b. a)',
    snd: 'λp. p (λa b. b)',
    nil: 'λc n. n',
    cons: 'λh t c n. c h (t c n)',
    Y: 'λf. (λx. f (x x)) (λx. f (x x))',
    Z: 'λf. (λx. f (λv. x x v)) (λx. f (λv. x x v))',
    omega: '(λx. x x) (λx. x x)'
  };

  /** Expand names from the encoding table before parsing, so a demo term can
   *  be written readably. */
  function expand(text, extra) {
    const table = Object.assign({}, CHURCH, extra || {});
    let out = text;

    for (let round = 0; round < 8; round += 1) {
      const before = out;

      Object.keys(table).sort(function (a, b) { return b.length - a.length; })
        .forEach(function (name) {
          out = out.split(new RegExp('\\b' + name + '\\b', 'g'))
            .join('(' + table[name] + ')');
        });
      if (out === before) break;
    }
    return out;
  }

  function church(n) {
    let body = 'x';

    for (let i = 0; i < n; i += 1) body = 'f (' + body + ')';
    return parse('λf x. ' + body);
  }

  /**
   * Read a Church numeral back out of a normal form, so a demo can say "this
   * computed 6" rather than printing a term and hoping.
   */
  function toNumber(term) {
    if (term.type !== 'lam' || term.body.type !== 'lam') return null;
    const f = term.param;
    const x = term.body.param;
    let count = 0;
    let current = term.body.body;

    while (current.type === 'app') {
      if (current.left.type !== 'var' || current.left.name !== f) return null;
      count += 1;
      current = current.right;
    }
    if (current.type !== 'var' || current.name !== x) return null;
    return count;
  }

  /** And a boolean, the same way. */
  function toBoolean(term) {
    if (term.type !== 'lam' || term.body.type !== 'lam') return null;
    const body = term.body.body;

    if (body.type !== 'var') return null;
    if (body.name === term.param) return true;
    if (body.name === term.body.param) return false;
    return null;
  }

  /* ------------------------------------------------------------ fixtures */

  /** The capture fixture: `(λx. λy. x) y` must NOT become `λy. y`. */
  function captureFixture() {
    return { term: parse('(λx. λy. x) y'),
      wrong: 'λy. y',
      right: "λy'. y",
      why: 'the argument y is free, and the binder λy would capture it — so the binder is ' +
        'renamed first' };
  }

  /**
   * Factorial by the Y combinator, which is the demonstration that recursion
   * needs no primitive support at all — a fixed-point combinator built from
   * nothing but abstraction and application is enough.
   *
   * The predecessor is the awkward part and always has been: Church numerals
   * make succ trivial and pred a trick, using a pair that shifts one step
   * behind. Kleene reportedly worked it out at the dentist.
   */
  const PREDECESSOR = 'λn f x. n (λg h. h (g f)) (λu. x) (λu. u)';
  const SUBTRACT = 'λm n. n (' + PREDECESSOR + ') m';
  const FACTORIAL = 'Y (λrec n. isZero n one (mult n (rec ((' + SUBTRACT + ') n one))))';

  function factorial(n) {
    const numerals = {};

    for (let i = 0; i <= 12; i += 1) numerals['n' + i] = show(church(i));
    return parse(expand('(' + FACTORIAL + ') n' + n, numerals));
  }

  /** A term that terminates under one strategy and not another. */
  function divergenceFixture() {
    return { term: parse('(λx. λy. y) (' + CHURCH.omega + ')'),
      note: 'the argument has no normal form, and the function ignores it' };
  }

  return {
    STRATEGIES: STRATEGIES, STRATEGY_INFO: STRATEGY_INFO, CHURCH: CHURCH,
    PREDECESSOR: PREDECESSOR, SUBTRACT: SUBTRACT, FACTORIAL: FACTORIAL,
    factorial: factorial,
    variable: variable, lambda: lambda, apply: apply,
    parse: parse, show: show, size: size, expand: expand,
    freeVariables: freeVariables, freshName: freshName, substitute: substitute,
    alphaEqual: alphaEqual, toDeBruijn: toDeBruijn,
    isRedex: isRedex, isValue: isValue, reduce: reduce, compare: compare,
    church: church, toNumber: toNumber, toBoolean: toBoolean,
    captureFixture: captureFixture, divergenceFixture: divergenceFixture
  };
}));

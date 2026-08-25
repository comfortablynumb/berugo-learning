/**
 * The inference bench: a surface syntax for Hindley–Milner terms, a fixture
 * set covering every way inference succeeds and every way it fails, and the
 * let-versus-lambda comparison that shows what generalisation actually buys.
 *
 * The syntax is deliberately small — `λx. e`, application by juxtaposition,
 * `let x = e in e`, `if e then e else e`, numbers, booleans and strings. There
 * are no type annotations anywhere, which is the whole point: every type in
 * the output was inferred, none of it was declared.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.HmLab = api;
}(this, function (root) {
  'use strict';

  const Hm = root && root.HmInference ? root.HmInference
    : require('../algorithms/hm-inference.js');

  const KEYWORDS = ['let', 'in', 'if', 'then', 'else'];

  function tokenise(text) {
    const raw = String(text).match(/"[^"]*"|[A-Za-z_][A-Za-z0-9_']*|\d+|λ|\\|[.=()]/g) || [];

    return raw.map(function (token) {
      return token === '\\' ? 'λ' : token;
    });
  }

  function parse(text) {
    const state = { tokens: tokenise(text), at: 0 };
    const term = parseTerm(state);

    if (state.at < state.tokens.length) {
      throw new Error('unexpected "' + state.tokens[state.at] + '"');
    }
    return term;
  }

  function parseTerm(state) {
    const token = state.tokens[state.at];

    if (token === 'λ') return parseLambda(state);
    if (token === 'let') return parseLet(state);
    if (token === 'if') return parseIf(state);
    return parseApplication(state);
  }

  function parseLambda(state) {
    state.at += 1;
    const params = [];

    while (state.tokens[state.at] !== undefined && state.tokens[state.at] !== '.') {
      params.push(state.tokens[state.at]);
      state.at += 1;
    }
    expect(state, '.');
    const body = parseTerm(state);

    return params.reverse().reduce(function (acc, param) {
      return { type: 'lam', param: param, body: acc };
    }, body);
  }

  function parseLet(state) {
    state.at += 1;
    const name = state.tokens[state.at];

    state.at += 1;
    expect(state, '=');
    const value = parseTerm(state);

    expect(state, 'in');
    return { type: 'let', name: name, value: value, body: parseTerm(state) };
  }

  function parseIf(state) {
    state.at += 1;
    const test = parseTerm(state);

    expect(state, 'then');
    const then = parseTerm(state);

    expect(state, 'else');
    return { type: 'if', test: test, then: then, other: parseTerm(state) };
  }

  function parseApplication(state) {
    let left = parseAtom(state);

    while (startsAtom(state.tokens[state.at])) {
      left = { type: 'app', left: left, right: parseAtom(state) };
    }
    return left;
  }

  function startsAtom(token) {
    if (token === undefined || token === ')' || token === '.' || token === '=') return false;
    return KEYWORDS.indexOf(token) === -1;
  }

  function parseAtom(state) {
    const token = state.tokens[state.at];

    if (token === undefined) throw new Error('unexpected end of term');
    state.at += 1;
    if (token === '(') return parseParenthesised(state);
    if (/^\d+$/.test(token)) return { type: 'num', value: Number(token) };
    if (token === 'true' || token === 'false') {
      return { type: 'bool', value: token === 'true' };
    }
    if (token.charAt(0) === '"') return { type: 'str', value: token.slice(1, -1) };
    if (token === 'λ' || token === 'let' || token === 'if') {
      state.at -= 1;
      return parseTerm(state);
    }
    return { type: 'var', name: token };
  }

  function parseParenthesised(state) {
    const inner = parseTerm(state);

    expect(state, ')');
    return inner;
  }

  function expect(state, token) {
    if (state.tokens[state.at] !== token) {
      throw new Error('expected "' + token + '" but found "'
        + (state.tokens[state.at] || 'end of term') + '"');
    }
    state.at += 1;
  }

  function show(term) {
    if (term.type === 'num' || term.type === 'bool') return String(term.value);
    if (term.type === 'str') return '"' + term.value + '"';
    if (term.type === 'var') return term.name;
    if (term.type === 'lam') return 'λ' + term.param + '. ' + show(term.body);
    if (term.type === 'let') {
      return 'let ' + term.name + ' = ' + show(term.value) + ' in ' + show(term.body);
    }
    if (term.type === 'if') {
      return 'if ' + show(term.test) + ' then ' + show(term.then)
        + ' else ' + show(term.other);
    }
    return showLeft(term.left) + ' ' + showRight(term.right);
  }

  function showLeft(term) {
    return term.type === 'lam' || term.type === 'let' || term.type === 'if'
      ? '(' + show(term) + ')' : show(term);
  }

  function showRight(term) {
    return term.type === 'var' || term.type === 'num' || term.type === 'bool'
      || term.type === 'str' ? show(term) : '(' + show(term) + ')';
  }

  /* ------------------------------------------------------------ fixtures */

  const FIXTURES = [
    { source: 'λx. x', expect: '∀α. α → α',
      note: 'the identity, and the type nobody wrote' },
    { source: 'λf. λx. f (f x)', expect: '∀α. (α → α) → α → α',
      note: 'twice: the argument type is forced to match the result' },
    { source: 'λx. λy. x', expect: '∀α β. α → β → α', note: 'K keeps the first' },
    { source: 'λf. λg. λx. f (g x)', expect: '∀α β γ. (α → β) → (γ → α) → γ → β',
      note: 'composition, three variables and no annotations' },
    { source: 'let id = λx. x in pair (id 3) (id true)',
      expect: 'Pair Number Boolean',
      note: 'let-polymorphism: id used at two types in one expression' },
    { source: 'λid. pair (id 3) (id true)', expect: null, kind: 'clash',
      note: 'the same body with a lambda-bound id — this is the one HM rejects' },
    { source: 'λx. x x', expect: null, kind: 'occurs',
      note: 'self-application needs α = α → β, which the occurs check refuses' },
    { source: 'let twice = λf. λx. f (f x) in twice (λn. add n 1) 5',
      expect: 'Number', note: 'a polymorphic helper used at one type' },
    { source: 'λl. add (length l) 1', expect: '∀α. List α → Number',
      note: 'length is polymorphic; the list element type stays open' },
    { source: 'if isZero 0 then 1 else true', expect: null, kind: 'clash',
      note: 'the branches disagree, and the message says which two types' },
    { source: 'λn. if isZero n then n else add n 1', expect: 'Number → Number',
      note: 'the guard forces n to Number before the branches are seen' },
    { source: 'let f = λx. x in pair (f (λy. y)) (f "s")',
      expect: '∀α. Pair (α → α) String',
      note: 'generalisation reaches under a function type too' }
  ];

  /** Run one source through inference and report everything the demo shows. */
  function analyse(source) {
    const term = parse(source);
    const result = Hm.run(term, Hm.baseEnvironment());

    return { source: source, ok: result.ok, scheme: result.ok ? result.scheme : '—',
      why: result.why, kind: result.kind, blame: result.blame,
      log: result.log, unifications: result.unifications,
      steps: result.log.length, unificationCount: result.unificationCount,
      freshVariables: result.freshVariables, size: size(term) };
  }

  function size(term) {
    if (term.type === 'lam') return 1 + size(term.body);
    if (term.type === 'app') return 1 + size(term.left) + size(term.right);
    if (term.type === 'let') return 1 + size(term.value) + size(term.body);
    if (term.type === 'if') return 1 + size(term.test) + size(term.then) + size(term.other);
    return 1;
  }

  /** The whole fixture set, with agreement against the expected scheme. */
  function sweep() {
    return FIXTURES.map(function (fixture) {
      const result = analyse(fixture.source);
      const matches = fixture.expect === null
        ? !result.ok && result.kind === fixture.kind
        : result.ok && result.scheme === fixture.expect;

      return Object.assign({}, result, { note: fixture.note,
        expected: fixture.expect === null ? 'rejected (' + fixture.kind + ')' : fixture.expect,
        matches: matches });
    });
  }

  /**
   * The comparison that makes let-polymorphism concrete: the same body, once
   * with the helper let-bound and once lambda-bound. One infers, one does not,
   * and the difference is a single generalisation step.
   */
  function polymorphismContrast() {
    const letBound = analyse('let id = λx. x in pair (id 3) (id true)');
    const lambdaBound = analyse('λid. pair (id 3) (id true)');

    return { letBound: letBound, lambdaBound: lambdaBound,
      difference: letBound.ok && !lambdaBound.ok
        ? 'generalisation at let is the only difference, and it decides the program'
        : 'the two agree, which would mean generalisation changed nothing' };
  }

  /** Unification pairs on their own, for the section that teaches unify first. */
  function unifyPair(leftText, rightText) {
    const parseType = function (text) { return typeFromText(text); };
    const trace = [];
    const result = Hm.unify(parseType(leftText), parseType(rightText), trace);

    return { left: leftText, right: rightText, ok: result.ok,
      why: result.why || '', kind: result.kind || '', trace: trace,
      bindings: result.ok ? Object.keys(result.substitution).map(function (name) {
        return name + ' := ' + Hm.showType(result.substitution[name], false);
      }) : [] };
  }

  /** A right-associative arrow parser over single letters and constructor names. */
  function typeFromText(text) {
    const tokens = String(text).match(/[A-Za-z]+|→|->|[()]/g) || [];
    const state = { tokens: tokens, at: 0 };
    const type = parseArrow(state);

    if (state.at < tokens.length) throw new Error('unexpected type token');
    return type;
  }

  function parseArrow(state) {
    const left = parseTypeApplication(state);
    const token = state.tokens[state.at];

    if (token !== '→' && token !== '->') return left;
    state.at += 1;
    return Hm.tarrow(left, parseArrow(state));
  }

  function parseTypeApplication(state) {
    const head = parseTypeAtom(state);
    const args = [];

    while (state.tokens[state.at] !== undefined && /^[A-Za-z]+$|^\($/.test(state.tokens[state.at])) {
      args.push(parseTypeAtom(state));
    }
    if (args.length === 0) return head;
    return Hm.tcon(head.name, args);
  }

  function parseTypeAtom(state) {
    const token = state.tokens[state.at];

    state.at += 1;
    if (token === '(') {
      const inner = parseArrow(state);

      state.at += 1;
      return inner;
    }
    if (/^[a-z]$|^[αβγδ]$/.test(token)) return Hm.tvar(token);
    return Hm.tcon(token, []);
  }

  const UNIFY_FIXTURES = [
    { left: 'a → b', right: 'Number → Boolean', note: 'two bindings, no work' },
    { left: 'a → a', right: 'Number → Boolean', note: 'a cannot be both' },
    { left: 'a', right: 'a → b', note: 'the occurs check' },
    { left: 'List a', right: 'List Number', note: 'structural, one level down' },
    { left: 'List a', right: 'Pair a b', note: 'constructor clash' },
    { left: '(a → b) → a', right: '(Number → c) → d', note: 'three bindings, chained' }
  ];

  return {
    parse: parse, show: show, size: size, analyse: analyse, sweep: sweep,
    FIXTURES: FIXTURES, UNIFY_FIXTURES: UNIFY_FIXTURES,
    polymorphismContrast: polymorphismContrast, unifyPair: unifyPair,
    typeFromText: typeFromText
  };
}));

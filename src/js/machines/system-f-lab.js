/**
 * The System F bench: a surface syntax with `Λ` and `[T]`, the fixture set,
 * and the two comparisons the section turns on — what erasure removes, and
 * which terms System F accepts that Hindley–Milner cannot.
 *
 * The base context supplies a few opaque constants (`zero: Nat`, `yes: Bool`,
 * `mix: Nat → Bool → Mixed`) so the fixtures can be about polymorphism rather
 * than about arithmetic. Nothing here computes; everything here types.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.SystemFLab = api;
}(this, function (root) {
  'use strict';

  const F = root && root.SystemF ? root.SystemF : require('../algorithms/system-f.js');
  const HmLab = root && root.HmLab ? root.HmLab : require('./hm-lab.js');

  const CONCRETE = ['Nat', 'Bool', 'Mixed'];

  function tokenise(text) {
    return String(text).match(/[A-Za-z_][A-Za-z0-9_']*|[λΛ\\^]|→|->|∀|[.:()\[\]]/g) || [];
  }

  function parseTerm(text) {
    const state = { tokens: tokenise(text), at: 0 };
    const term = term_(state);

    if (state.at < state.tokens.length) {
      throw new Error('unexpected "' + state.tokens[state.at] + '"');
    }
    return term;
  }

  function term_(state) {
    const token = state.tokens[state.at];

    if (token === 'λ' || token === '\\') return parseLambda(state);
    if (token === 'Λ' || token === '^') return parseTypeLambda(state);
    return parseApplication(state);
  }

  function parseLambda(state) {
    state.at += 1;
    const name = state.tokens[state.at];

    state.at += 1;
    expect(state, ':');
    const type = parseType(state);

    expect(state, '.');
    return F.lam(name, type, term_(state));
  }

  function parseTypeLambda(state) {
    state.at += 1;
    const name = state.tokens[state.at];

    state.at += 1;
    expect(state, '.');
    return F.tlam(name, term_(state));
  }

  function parseApplication(state) {
    let left = parseAtom(state);

    while (continues(state)) {
      if (state.tokens[state.at] === '[') {
        state.at += 1;
        left = F.tapp(left, parseType(state));
        expect(state, ']');
        continue;
      }
      left = F.app(left, parseAtom(state));
    }
    return left;
  }

  function continues(state) {
    const token = state.tokens[state.at];

    if (token === undefined) return false;
    return token === '[' || token === '(' || /^[A-Za-z_]/.test(token);
  }

  function parseAtom(state) {
    const token = state.tokens[state.at];

    if (token === undefined) throw new Error('unexpected end of term');
    if (token === '(') {
      state.at += 1;
      const inner = term_(state);

      expect(state, ')');
      return inner;
    }
    if (token === 'λ' || token === '\\' || token === 'Λ' || token === '^') return term_(state);
    state.at += 1;
    return F.variable(token);
  }

  function parseType(state) {
    const left = parseTypeAtom(state);
    const token = state.tokens[state.at];

    if (token !== '→' && token !== '->') return left;
    state.at += 1;
    return F.tarrow(left, parseType(state));
  }

  function parseTypeAtom(state) {
    const token = state.tokens[state.at];

    state.at += 1;
    if (token === '(') {
      const inner = parseType(state);

      expect(state, ')');
      return inner;
    }
    if (token === '∀') return parseForAll(state);
    if (CONCRETE.indexOf(token) !== -1) return F.tcon(token);
    return F.tvar(token);
  }

  function parseForAll(state) {
    const name = state.tokens[state.at];

    state.at += 1;
    expect(state, '.');
    return F.forAll(name, parseType(state));
  }

  function expect(state, token) {
    if (state.tokens[state.at] !== token) {
      throw new Error('expected "' + token + '" but found "'
        + (state.tokens[state.at] || 'end') + '"');
    }
    state.at += 1;
  }

  /* ------------------------------------------------------------ context */

  function baseContext() {
    return { types: [], terms: {
      zero: F.tcon('Nat'), yes: F.tcon('Bool'),
      mix: F.tarrow(F.tcon('Nat'), F.tarrow(F.tcon('Bool'), F.tcon('Mixed'))),
      succ: F.tarrow(F.tcon('Nat'), F.tcon('Nat'))
    } };
  }

  const FIXTURES = [
    { source: 'Λa. λx: a. x', expect: '∀a. a → a',
      note: 'the polymorphic identity, with the type abstraction written out' },
    { source: '(Λa. λx: a. x) [Nat]', expect: 'Nat → Nat',
      note: 'a type application specialises it, and the term records that it happened' },
    { source: '(Λa. λx: a. x) [Nat] zero', expect: 'Nat',
      note: 'specialise, then apply' },
    { source: 'Λa. λf: a → a. λx: a. f (f x)', expect: '∀a. (a → a) → a → a',
      note: 'Church two, typed' },
    { source: 'λid: ∀a. a → a. mix (id [Nat] zero) (id [Bool] yes)',
      expect: '(∀a. a → a) → Mixed',
      note: 'rank 2: the argument is used at two types, which HM cannot express' },
    { source: 'λid: ∀a. a → a. id [∀b. b → b] id', expect: '(∀a. a → a) → ∀b. b → b',
      note: 'self-application, typed by instantiating at its own type' },
    { source: 'Λa. Λb. λx: a. λy: b. x', expect: '∀a. ∀b. a → b → a',
      note: 'two type abstractions, and the order shows in the type' },
    { source: '(Λa. λx: a. x) [Nat] yes', expect: null,
      why: 'expected Nat but the argument is Bool',
      note: 'the specialisation is what makes this a mismatch' },
    { source: 'zero [Nat]', expect: null, why: 'not a ∀ type',
      note: 'a type application to something that takes no type argument' },
    { source: 'λx: Nat. x x', expect: null, why: 'not a function type',
      note: 'self-application at a base type is still nonsense' },
    { source: 'Λa. λx: a. succ x', expect: null, why: 'expected Nat but the argument is a',
      note: 'the body cannot assume anything about a — that is parametricity biting' }
  ];

  function analyse(source) {
    const term = parseTerm(source);
    const result = F.check(term, baseContext());
    const reduced = F.reduce(term, 200);

    return { source: source, ok: result.ok,
      type: result.ok ? F.showType(result.type, false) : '—',
      why: result.why || '', derivation: result,
      erased: F.erase(term), normal: reduced.text, steps: reduced.steps,
      nodes: countNodes(result), height: heightOf(result) };
  }

  function countNodes(node) {
    return node.children.reduce(function (total, child) {
      return total + countNodes(child);
    }, 1);
  }

  function heightOf(node) {
    return 1 + node.children.reduce(function (best, child) {
      return Math.max(best, heightOf(child));
    }, 0);
  }

  function sweep() {
    return FIXTURES.map(function (fixture) {
      const result = analyse(fixture.source);
      const matches = fixture.expect === null
        ? !result.ok && result.why.indexOf(fixture.why) !== -1
        : result.ok && result.type === fixture.expect;

      return Object.assign({}, result, { note: fixture.note, matches: matches,
        expected: fixture.expect === null ? 'rejected: ' + fixture.why : fixture.expect });
    });
  }

  /**
   * The comparison the section exists for: the rank-2 term System F accepts
   * with a written type, run through Hindley–Milner where it has no annotation
   * to lean on. One types, one does not, and the reason is the rank.
   */
  function rankContrast() {
    const written = analyse('λid: ∀a. a → a. mix (id [Nat] zero) (id [Bool] yes)');
    const inferred = HmLab.analyse('λid. pair (id 3) (id true)');

    return { written: written, inferred: inferred,
      agree: written.ok && !inferred.ok,
      reason: 'HM quantifies only at let, so a lambda-bound id has one monomorphic '
        + 'type; System F lets the binder carry a ∀, and the two uses instantiate it '
        + 'separately' };
  }

  /** What erasure removes, counted rather than described. */
  function erasureTable() {
    return FIXTURES.filter(function (fixture) { return fixture.expect !== null; })
      .map(function (fixture) {
        const result = analyse(fixture.source);

        return { source: fixture.source, typed: fixture.source.length,
          erased: result.erased, erasedLength: result.erased.length,
          removed: fixture.source.length - result.erased.length,
          type: result.type };
      });
  }

  return {
    parseTerm: parseTerm, parseType: function (text) {
      return parseType({ tokens: tokenise(text), at: 0 });
    },
    baseContext: baseContext, analyse: analyse, sweep: sweep, FIXTURES: FIXTURES,
    rankContrast: rankContrast, erasureTable: erasureTable,
    countNodes: countNodes, heightOf: heightOf
  };
}));

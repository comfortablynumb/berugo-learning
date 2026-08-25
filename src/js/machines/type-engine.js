/**
 * A typing judgement as a function, and a derivation tree as its output.
 *
 * The notation `Γ ⊢ e : τ` reads "in context Γ, expression e has type τ", and
 * a typing RULE is a claim that some judgements above the line let you write
 * the one below it. That is a recursive function with a case per syntactic
 * form, and the only thing separating it from ordinary code is that the
 * literature writes it as a fraction.
 *
 * So the checker here returns the whole derivation rather than a verdict. A
 * well-typed term produces the tree that proves it; an ill-typed one produces
 * the tree up to the point it failed, naming the rule that could not apply and
 * the constraint that could not be met. "Type error at line 40" is the version
 * with the interesting part thrown away.
 *
 * The type language is shared across M27: base types, arrows, records,
 * variables and universals, so the simply typed section, the inference section
 * and the subtyping section all describe the same objects.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.TypeEngine = api;
}(this, function () {
  'use strict';

  /* ------------------------------------------------------------- the types */

  function base(name) { return { kind: 'base', name: name }; }
  function arrow(from, to) { return { kind: 'arrow', from: from, to: to }; }
  function variableType(name) { return { kind: 'var', name: name }; }
  function record(fields) { return { kind: 'record', fields: fields }; }
  function forAll(param, body) { return { kind: 'forall', param: param, body: body }; }
  function product(left, right) { return { kind: 'product', left: left, right: right }; }
  function sum(left, right) { return { kind: 'sum', left: left, right: right }; }

  const NUMBER = base('Number');
  const BOOLEAN = base('Boolean');
  const STRING = base('String');

  function showType(type) {
    if (type.kind === 'base' || type.kind === 'var') return type.name;
    if (type.kind === 'arrow') {
      const left = type.from.kind === 'arrow' || type.from.kind === 'forall'
        ? '(' + showType(type.from) + ')' : showType(type.from);

      return left + ' → ' + showType(type.to);
    }
    if (type.kind === 'record') {
      return '{ ' + Object.keys(type.fields).map(function (name) {
        return name + ': ' + showType(type.fields[name]);
      }).join(', ') + ' }';
    }
    if (type.kind === 'forall') return '∀' + type.param + '. ' + showType(type.body);
    if (type.kind === 'product') {
      return '(' + showType(type.left) + ' × ' + showType(type.right) + ')';
    }
    return '(' + showType(type.left) + ' + ' + showType(type.right) + ')';
  }

  /** Structural equality on types, which is what a checker compares with. */
  function sameType(left, right) {
    if (!left || !right || left.kind !== right.kind) return false;
    if (left.kind === 'base' || left.kind === 'var') return left.name === right.name;
    if (left.kind === 'arrow') {
      return sameType(left.from, right.from) && sameType(left.to, right.to);
    }
    if (left.kind === 'record') return sameFields(left.fields, right.fields);
    if (left.kind === 'forall') {
      return left.param === right.param && sameType(left.body, right.body);
    }
    return sameType(left.left, right.left) && sameType(left.right, right.right);
  }

  function sameFields(left, right) {
    const names = Object.keys(left);

    if (names.length !== Object.keys(right).length) return false;
    return names.every(function (name) {
      return right[name] && sameType(left[name], right[name]);
    });
  }

  /* --------------------------------------------------------- the contexts */

  function emptyContext() { return { bindings: [] }; }

  function extend(context, name, type) {
    return { bindings: [{ name: name, type: type }].concat(context.bindings) };
  }

  function lookup(context, name) {
    const found = context.bindings.filter(function (binding) {
      return binding.name === name;
    })[0];

    return found ? found.type : null;
  }

  function showContext(context) {
    if (context.bindings.length === 0) return '∅';
    return context.bindings.slice().reverse().map(function (binding) {
      return binding.name + ': ' + showType(binding.type);
    }).join(', ');
  }

  /* ---------------------------------------------------------- expressions */

  /**
   * A slightly larger term language than the pure calculus, because a typing
   * demo needs something to have a base type: literals, `if`, `let`, records
   * and field access, alongside the three lambda forms.
   */
  function parse(text) {
    const tokens = tokenise(text);
    const state = { tokens: tokens, at: 0 };
    const term = parseExpression(state);

    if (state.at < tokens.length) {
      throw new Error('unexpected "' + tokens[state.at] + '"');
    }
    return term;
  }

  const PUNCTUATION = ['λ', '\\', '(', ')', '.', ':', '{', '}', ',', '=', '→', '->'];

  function tokenise(text) {
    const out = [];
    let at = 0;

    while (at < text.length) {
      if (' \n\t'.indexOf(text[at]) !== -1) { at += 1; continue; }
      if (text.slice(at, at + 2) === '->') { out.push('→'); at += 2; continue; }
      const punctuation = PUNCTUATION.filter(function (mark) {
        return mark.length === 1 && text[at] === mark;
      })[0];

      if (punctuation) {
        out.push(punctuation === '\\' ? 'λ' : punctuation);
        at += 1;
        continue;
      }
      let length = 0;

      while (at + length < text.length && /[A-Za-z0-9_']/.test(text[at + length])) length += 1;
      if (length === 0) throw new Error('unexpected character "' + text[at] + '"');
      out.push(text.slice(at, at + length));
      at += length;
    }
    return out;
  }

  function parseExpression(state) {
    if (state.tokens[state.at] === 'λ') return parseAbstraction(state);
    if (state.tokens[state.at] === 'let') return parseLet(state);
    if (state.tokens[state.at] === 'if') return parseIf(state);
    return parseApplication(state);
  }

  function parseAbstraction(state) {
    state.at += 1;
    const param = state.tokens[state.at];

    state.at += 1;
    let annotation = null;

    if (state.tokens[state.at] === ':') {
      state.at += 1;
      annotation = parseType(state);
    }
    if (state.tokens[state.at] !== '.') throw new Error('expected "." after the parameter');
    state.at += 1;
    return { type: 'lam', param: param, annotation: annotation,
      body: parseExpression(state) };
  }

  function parseLet(state) {
    state.at += 1;
    const name = state.tokens[state.at];

    state.at += 1;
    if (state.tokens[state.at] !== '=') throw new Error('expected "=" in a let');
    state.at += 1;
    const value = parseExpression(state);

    if (state.tokens[state.at] !== 'in') throw new Error('expected "in" after a let');
    state.at += 1;
    return { type: 'let', name: name, value: value, body: parseExpression(state) };
  }

  function parseIf(state) {
    state.at += 1;
    const condition = parseExpression(state);

    if (state.tokens[state.at] !== 'then') throw new Error('expected "then"');
    state.at += 1;
    const consequent = parseExpression(state);

    if (state.tokens[state.at] !== 'else') throw new Error('expected "else"');
    state.at += 1;
    return { type: 'if', condition: condition, consequent: consequent,
      alternative: parseExpression(state) };
  }

  function parseApplication(state) {
    let left = parseAtomExpression(state);

    for (;;) {
      const token = state.tokens[state.at];

      if (token === undefined || [')', '.', ',', '}', 'in', 'then', 'else'].indexOf(token)
        !== -1) return left;
      left = { type: 'app', left: left, right: parseAtomExpression(state) };
    }
  }

  function parseAtomExpression(state) {
    const token = state.tokens[state.at];

    if (token === '(') {
      state.at += 1;
      const inner = parseExpression(state);

      if (state.tokens[state.at] !== ')') throw new Error('expected ")"');
      state.at += 1;
      return inner;
    }
    if (token === 'λ') return parseAbstraction(state);
    if (token === '{') return parseRecord(state);
    if (token === undefined) throw new Error('unexpected end of expression');
    state.at += 1;
    if (/^[0-9]+$/.test(token)) return { type: 'number', value: Number(token) };
    if (token === 'true' || token === 'false') {
      return { type: 'boolean', value: token === 'true' };
    }
    if (state.tokens[state.at] === '.') {
      state.at += 1;
      const field = state.tokens[state.at];

      state.at += 1;
      return { type: 'field', target: { type: 'var', name: token }, field: field };
    }
    return { type: 'var', name: token };
  }

  function parseRecord(state) {
    state.at += 1;
    const fields = {};

    while (state.tokens[state.at] !== '}') {
      const name = state.tokens[state.at];

      state.at += 1;
      if (state.tokens[state.at] !== '=') throw new Error('expected "=" in a record');
      state.at += 1;
      fields[name] = parseExpression(state);
      if (state.tokens[state.at] === ',') state.at += 1;
    }
    state.at += 1;
    return { type: 'record', fields: fields };
  }

  function parseType(state) {
    let left = parseTypeAtom(state);

    while (state.tokens[state.at] === '→') {
      state.at += 1;
      left = arrow(left, parseType(state));
    }
    return left;
  }

  function parseTypeAtom(state) {
    const token = state.tokens[state.at];

    if (token === '(') {
      state.at += 1;
      const inner = parseType(state);

      if (state.tokens[state.at] !== ')') throw new Error('expected ")" in a type');
      state.at += 1;
      return inner;
    }
    if (token === '{') return parseRecordType(state);
    state.at += 1;
    if (/^[A-Z]/.test(token)) return base(token);
    return variableType(token);
  }

  function parseRecordType(state) {
    state.at += 1;
    const fields = {};

    while (state.tokens[state.at] !== '}') {
      const name = state.tokens[state.at];

      state.at += 1;
      if (state.tokens[state.at] !== ':') throw new Error('expected ":" in a record type');
      state.at += 1;
      fields[name] = parseType(state);
      if (state.tokens[state.at] === ',') state.at += 1;
    }
    state.at += 1;
    return record(fields);
  }

  function showExpression(term) {
    if (term.type === 'var') return term.name;
    if (term.type === 'number') return String(term.value);
    if (term.type === 'boolean') return String(term.value);
    if (term.type === 'lam') {
      return 'λ' + term.param + (term.annotation ? ': ' + showType(term.annotation) : '') +
        '. ' + showExpression(term.body);
    }
    if (term.type === 'app') {
      return showExpressionLeft(term.left) + ' ' + showExpressionRight(term.right);
    }
    if (term.type === 'let') {
      return 'let ' + term.name + ' = ' + showExpression(term.value) + ' in ' +
        showExpression(term.body);
    }
    if (term.type === 'if') {
      return 'if ' + showExpression(term.condition) + ' then ' +
        showExpression(term.consequent) + ' else ' + showExpression(term.alternative);
    }
    if (term.type === 'field') return showExpression(term.target) + '.' + term.field;
    return '{ ' + Object.keys(term.fields).map(function (name) {
      return name + ' = ' + showExpression(term.fields[name]);
    }).join(', ') + ' }';
  }

  function showExpressionLeft(term) {
    return ['lam', 'let', 'if'].indexOf(term.type) !== -1
      ? '(' + showExpression(term) + ')' : showExpression(term);
  }

  function showExpressionRight(term) {
    return ['var', 'number', 'boolean', 'record', 'field'].indexOf(term.type) !== -1
      ? showExpression(term) : '(' + showExpression(term) + ')';
  }

  /* ------------------------------------------------------- the derivation */

  function node(rule, context, term, type, children, note) {
    return {
      rule: rule,
      judgement: showContext(context) + ' ⊢ ' + showExpression(term) + ' : ' +
        (type ? showType(type) : '?'),
      type: type, children: children || [], ok: Boolean(type), note: note || null
    };
  }

  function failure(rule, context, term, why, children) {
    return {
      rule: rule,
      judgement: showContext(context) + ' ⊢ ' + showExpression(term) + ' : ✗',
      type: null, children: children || [], ok: false, why: why
    };
  }

  /**
   * The simply typed lambda calculus, as five rules and nothing else.
   *
   * Each case is one rule from a textbook, and the correspondence is exact:
   * T-Var reads the context, T-Abs extends it, T-App checks the argument
   * against the parameter type, T-If demands both branches agree, and T-Let
   * is T-App with the argument first.
   */
  function check(term, context) {
    const scope_ = context || emptyContext();
    const handler = RULES[term.type];

    if (!handler) return failure('unknown', scope_, term, 'no rule for ' + term.type);
    return handler(term, scope_);
  }

  const RULES = {
    number: function (term, context) {
      return node('T-Num', context, term, NUMBER);
    },
    boolean: function (term, context) {
      return node('T-Bool', context, term, BOOLEAN);
    },
    'var': function (term, context) {
      const type = lookup(context, term.name);

      if (!type) {
        return failure('T-Var', context, term,
          term.name + ' is not bound in the context — the rule needs x: τ in Γ');
      }
      return node('T-Var', context, term, type,
        [], 'found ' + term.name + ': ' + showType(type) + ' in the context');
    },
    lam: function (term, context) {
      if (!term.annotation) {
        return failure('T-Abs', context, term,
          'the parameter has no type annotation, and the simply typed calculus does not infer ' +
            'one — that is what the inference section adds');
      }
      const inner = check(term.body, extend(context, term.param, term.annotation));

      if (!inner.ok) return failure('T-Abs', context, term, inner.why || 'the body is ill-typed',
        [inner]);
      return node('T-Abs', context, term, arrow(term.annotation, inner.type), [inner]);
    },
    app: function (term, context) {
      const left = check(term.left, context);
      const right = check(term.right, context);

      if (!left.ok || !right.ok) {
        return failure('T-App', context, term, (left.why || right.why), [left, right]);
      }
      if (left.type.kind !== 'arrow') {
        return failure('T-App', context, term,
          'the left side has type ' + showType(left.type) + ', which is not a function type',
          [left, right]);
      }
      if (!sameType(left.type.from, right.type)) {
        return failure('T-App', context, term,
          'the function expects ' + showType(left.type.from) + ' and the argument is ' +
            showType(right.type), [left, right]);
      }
      return node('T-App', context, term, left.type.to, [left, right]);
    },
    'if': function (term, context) {
      const condition = check(term.condition, context);
      const consequent = check(term.consequent, context);
      const alternative = check(term.alternative, context);
      const children = [condition, consequent, alternative];

      if (!condition.ok || !consequent.ok || !alternative.ok) {
        return failure('T-If', context, term, 'a subterm is ill-typed', children);
      }
      if (!sameType(condition.type, BOOLEAN)) {
        return failure('T-If', context, term,
          'the condition has type ' + showType(condition.type) + ' and must be Boolean',
          children);
      }
      if (!sameType(consequent.type, alternative.type)) {
        return failure('T-If', context, term,
          'the branches have types ' + showType(consequent.type) + ' and ' +
            showType(alternative.type) + ', and both arms of an if must agree', children);
      }
      return node('T-If', context, term, consequent.type, children);
    },
    'let': function (term, context) {
      const value = check(term.value, context);

      if (!value.ok) return failure('T-Let', context, term, value.why, [value]);
      const body = check(term.body, extend(context, term.name, value.type));

      if (!body.ok) return failure('T-Let', context, term, body.why, [value, body]);
      return node('T-Let', context, term, body.type, [value, body]);
    },
    record: function (term, context) {
      const fields = {};
      const children = [];
      let failed = null;

      Object.keys(term.fields).forEach(function (name) {
        const child = check(term.fields[name], context);

        children.push(child);
        if (!child.ok) { failed = failed || child.why; return; }
        fields[name] = child.type;
      });
      if (failed) return failure('T-Rcd', context, term, failed, children);
      return node('T-Rcd', context, term, record(fields), children);
    },
    field: function (term, context) {
      const target = check(term.target, context);

      if (!target.ok) return failure('T-Proj', context, term, target.why, [target]);
      if (target.type.kind !== 'record') {
        return failure('T-Proj', context, term,
          showType(target.type) + ' is not a record, so it has no fields', [target]);
      }
      if (!target.type.fields[term.field]) {
        return failure('T-Proj', context, term,
          'the record has no field named ' + term.field + ' — it has ' +
            Object.keys(target.type.fields).join(', '), [target]);
      }
      return node('T-Proj', context, term, target.type.fields[term.field], [target]);
    }
  };

  /** The derivation as flat rows, deepest last, which is what a table draws. */
  function derivationRows(derivation, depth_) {
    const level = depth_ || 0;
    const rows = [{ depth: level, rule: derivation.rule, judgement: derivation.judgement,
      ok: derivation.ok, why: derivation.why || null, note: derivation.note || null }];

    derivation.children.forEach(function (child) {
      derivationRows(child, level + 1).forEach(function (row) { rows.push(row); });
    });
    return rows;
  }

  /** The rule that failed, deepest first — which is the one a person needs. */
  function firstFailure(derivation) {
    for (let i = 0; i < derivation.children.length; i += 1) {
      const inner = firstFailure(derivation.children[i]);

      if (inner) return inner;
    }
    return derivation.ok ? null : derivation;
  }

  function height(derivation) {
    if (derivation.children.length === 0) return 1;
    return 1 + Math.max.apply(null, derivation.children.map(height));
  }

  function countNodes(derivation) {
    return derivation.children.reduce(function (total, child) {
      return total + countNodes(child);
    }, 1);
  }

  /* --------------------------------------------------------- the rule list */

  /** The rules as a table, so the demo can show what it is walking. */
  const RULE_TABLE = [
    { name: 'T-Var', premises: 'x: τ ∈ Γ', conclusion: 'Γ ⊢ x : τ',
      reads: 'a variable has whatever type the context gives it' },
    { name: 'T-Num', premises: '—', conclusion: 'Γ ⊢ n : Number',
      reads: 'a numeric literal is a Number, in any context' },
    { name: 'T-Bool', premises: '—', conclusion: 'Γ ⊢ b : Boolean',
      reads: 'a boolean literal is a Boolean' },
    { name: 'T-Abs', premises: 'Γ, x: σ ⊢ e : τ', conclusion: 'Γ ⊢ λx: σ. e : σ → τ',
      reads: 'if the body has type τ with x bound to σ, the function is σ → τ' },
    { name: 'T-App', premises: 'Γ ⊢ f : σ → τ and Γ ⊢ a : σ', conclusion: 'Γ ⊢ f a : τ',
      reads: 'applying a σ → τ to a σ gives a τ — and the argument type must MATCH' },
    { name: 'T-If', premises: 'Γ ⊢ c : Boolean and Γ ⊢ t : τ and Γ ⊢ e : τ',
      conclusion: 'Γ ⊢ if c then t else e : τ',
      reads: 'the condition is Boolean and both branches have the SAME type' },
    { name: 'T-Let', premises: 'Γ ⊢ v : σ and Γ, x: σ ⊢ e : τ',
      conclusion: 'Γ ⊢ let x = v in e : τ',
      reads: 'bind the value’s type and check the body — this is where inference generalises' },
    { name: 'T-Rcd', premises: 'Γ ⊢ eᵢ : τᵢ for each field',
      conclusion: 'Γ ⊢ { l = e } : { l: τ }',
      reads: 'a record has the record type of its fields’ types' },
    { name: 'T-Proj', premises: 'Γ ⊢ e : { l: τ, … }', conclusion: 'Γ ⊢ e.l : τ',
      reads: 'projecting a field gives that field’s type, and the field must exist' }
  ];

  /* ------------------------------------------------------------ fixtures */

  /** Well-typed and ill-typed terms whose failing rule a reader can predict. */
  function fixtures() {
    return [
      { source: 'λx: Number. x', wellTyped: true, note: 'the identity on numbers' },
      { source: '(λx: Number. x) 3', wellTyped: true, note: 'a well-typed application' },
      { source: '(λx: Number. x) true', wellTyped: false, rule: 'T-App',
        note: 'the argument type does not match the parameter type' },
      { source: 'λf: Number → Number. λx: Number. f (f x)', wellTyped: true,
        note: 'twice, at Number' },
      { source: 'if true then 1 else 2', wellTyped: true, note: 'both branches are Number' },
      { source: 'if true then 1 else false', wellTyped: false, rule: 'T-If',
        note: 'the branches disagree' },
      { source: 'if 1 then 2 else 3', wellTyped: false, rule: 'T-If',
        note: 'the condition is not Boolean' },
      { source: 'let y = 3 in y', wellTyped: true, note: 'let binds a type into the context' },
      { source: 'x', wellTyped: false, rule: 'T-Var', note: 'unbound' },
      { source: '3 4', wellTyped: false, rule: 'T-App', note: 'a Number is not a function' },
      { source: 'λx: Number. x x', wellTyped: false, rule: 'T-App',
        note: 'self-application does not type in the simply typed calculus, at any type' },
      { source: 'λr: { a: Number }. r.a', wellTyped: true, note: 'field projection' },
      { source: 'λr: { a: Number }. r.b', wellTyped: false, rule: 'T-Proj',
        note: 'no such field' }
    ];
  }

  return {
    NUMBER: NUMBER, BOOLEAN: BOOLEAN, STRING: STRING, RULE_TABLE: RULE_TABLE,
    base: base, arrow: arrow, variableType: variableType, record: record,
    forAll: forAll, product: product, sum: sum,
    showType: showType, sameType: sameType,
    emptyContext: emptyContext, extend: extend, lookup: lookup, showContext: showContext,
    parse: parse, parseType: parseType, showExpression: showExpression,
    check: check, derivationRows: derivationRows, firstFailure: firstFailure,
    height: height, countNodes: countNodes, fixtures: fixtures
  };
}));

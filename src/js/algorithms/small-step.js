/**
 * Operational semantics: small-step, big-step, and what "stuck" means.
 *
 * A small-step semantics is a relation `e → e'` — one rule fires, one step
 * happens, and the term that cannot step is either a value or *stuck*. Stuck
 * is the whole point: it is the formal name for "this program went wrong", and
 * a type system is exactly a proof that well-typed terms never reach it.
 *
 * The evaluation-context trick separates the two kinds of rule. Computation
 * rules (`if true then a else b → a`) say what work happens; congruence rules
 * say where. Writing the congruence part as a context `E[·]` rather than a
 * dozen structural rules is what makes the semantics of a real language fit on
 * a page, and it is the same idea a compiler uses to pick the next redex.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.SmallStep = api;
}(this, function () {
  'use strict';

  /* ------------------------------------------------------------- syntax */

  function num(value) { return { type: 'num', value: value }; }
  function bool(value) { return { type: 'bool', value: value }; }
  function unit() { return { type: 'unit' }; }
  function plus(left, right) { return { type: 'plus', left: left, right: right }; }
  function times(left, right) { return { type: 'times', left: left, right: right }; }
  function less(left, right) { return { type: 'less', left: left, right: right }; }
  function iff(test, then, other) {
    return { type: 'if', test: test, then: then, other: other };
  }
  function pred(inner) { return { type: 'pred', inner: inner }; }
  function isZero(inner) { return { type: 'iszero', inner: inner }; }

  const CONSTRUCTORS = { num: num, bool: bool, plus: plus, times: times, less: less,
    if: iff, pred: pred, iszero: isZero, unit: unit };

  function isValue(term) {
    return term.type === 'num' || term.type === 'bool' || term.type === 'unit';
  }

  /**
   * Printed with the parentheses precedence requires. Dropping them would make
   * the trace lie: `2 * (3 + 4)` printed as `2 * 3 + 4` is a different term,
   * and a reader comparing two traces would be comparing the wrong things.
   */
  function show(term, outer) {
    if (term.type === 'num') return String(term.value);
    if (term.type === 'bool') return term.value ? 'true' : 'false';
    if (term.type === 'unit') return 'unit';
    if (term.type === 'pred') return 'pred ' + wrap(term.inner);
    if (term.type === 'iszero') return 'iszero ' + wrap(term.inner);
    if (term.type === 'if') return showIf(term, outer);
    return showBinary(term, outer);
  }

  const OPERATOR = { plus: '+', times: '*', less: '<' };
  const PRECEDENCE = { less: 1, plus: 2, times: 3 };

  function showIf(term, outer) {
    const text = 'if ' + show(term.test, 0) + ' then ' + show(term.then, 0)
      + ' else ' + show(term.other, 0);

    return outer ? '(' + text + ')' : text;
  }

  function showBinary(term, outer) {
    const level = PRECEDENCE[term.type];
    const text = show(term.left, level) + ' ' + OPERATOR[term.type]
      + ' ' + show(term.right, level + 1);

    return (outer || 0) > level ? '(' + text + ')' : text;
  }

  function wrap(term) {
    return isValue(term) ? show(term, 0) : '(' + show(term, 0) + ')';
  }

  /* -------------------------------------------------------- parsing text */

  /**
   * A tiny precedence parser so the demo can take a term from a control rather
   * than a hard-coded fixture. `<` binds loosest, then `+`, then `*`.
   */
  function parse(text) {
    const tokens = String(text).match(/\d+|[A-Za-z]+|[()+*<]/g) || [];
    const state = { tokens: tokens, at: 0 };
    const term = parseComparison(state);

    if (state.at < tokens.length) {
      throw new Error('unexpected "' + tokens[state.at] + '"');
    }
    return term;
  }

  function parseComparison(state) {
    let left = parseSum(state);

    while (state.tokens[state.at] === '<') {
      state.at += 1;
      left = less(left, parseSum(state));
    }
    return left;
  }

  function parseSum(state) {
    let left = parseProduct(state);

    while (state.tokens[state.at] === '+') {
      state.at += 1;
      left = plus(left, parseProduct(state));
    }
    return left;
  }

  function parseProduct(state) {
    let left = parseAtom(state);

    while (state.tokens[state.at] === '*') {
      state.at += 1;
      left = times(left, parseAtom(state));
    }
    return left;
  }

  function parseAtom(state) {
    const token = state.tokens[state.at];

    if (token === undefined) throw new Error('unexpected end of term');
    state.at += 1;
    if (/^\d+$/.test(token)) return num(Number(token));
    if (token === 'true') return bool(true);
    if (token === 'false') return bool(false);
    if (token === 'unit') return unit();
    if (token === 'pred') return pred(parseAtom(state));
    if (token === 'iszero') return isZero(parseAtom(state));
    if (token === 'if') return parseIf(state);
    if (token === '(') return parseParenthesised(state);
    throw new Error('unknown token "' + token + '"');
  }

  function parseIf(state) {
    const test = parseComparison(state);

    expect(state, 'then');
    const then = parseComparison(state);

    expect(state, 'else');
    return iff(test, then, parseComparison(state));
  }

  function parseParenthesised(state) {
    const inner = parseComparison(state);

    expect(state, ')');
    return inner;
  }

  function expect(state, token) {
    if (state.tokens[state.at] !== token) {
      throw new Error('expected "' + token + '"');
    }
    state.at += 1;
  }

  /* ------------------------------------------------------ the step relation */

  /**
   * One step. Each entry is a computation rule with the side condition that
   * makes it fire; if none fires, `congruence` looks for a subterm that can
   * step — which is the evaluation context, spelled out.
   */
  const COMPUTATION = [
    { name: 'E-IfTrue', shape: 'if true then a else b → a',
      fires: function (t, variant) { return ifReady(t, variant) && t.test.value; },
      run: function (t) { return t.then; } },
    { name: 'E-IfFalse', shape: 'if false then a else b → b',
      fires: function (t, variant) { return ifReady(t, variant) && !t.test.value; },
      run: function (t) { return t.other; } },
    { name: 'E-Plus', shape: 'n₁ + n₂ → n₁ plus n₂',
      fires: function (t) { return binaryReady(t, 'plus', 'num'); },
      run: function (t) { return num(t.left.value + t.right.value); } },
    { name: 'E-Times', shape: 'n₁ * n₂ → n₁ times n₂',
      fires: function (t) { return binaryReady(t, 'times', 'num'); },
      run: function (t) { return num(t.left.value * t.right.value); } },
    { name: 'E-Less', shape: 'n₁ < n₂ → true or false',
      fires: function (t) { return binaryReady(t, 'less', 'num'); },
      run: function (t) { return bool(t.left.value < t.right.value); } },
    { name: 'E-PredZero', shape: 'pred 0 → 0',
      fires: function (t) { return t.type === 'pred' && t.inner.type === 'num' && t.inner.value === 0; },
      run: function () { return num(0); } },
    { name: 'E-Pred', shape: 'pred n → n minus one',
      fires: function (t) { return t.type === 'pred' && t.inner.type === 'num'; },
      run: function (t) { return num(t.inner.value - 1); } },
    { name: 'E-IsZero', shape: 'iszero n → true or false',
      fires: function (t) { return t.type === 'iszero' && t.inner.type === 'num'; },
      run: function (t) { return bool(t.inner.value === 0); } }
  ];

  function binaryReady(term, type, valueType) {
    return term.type === type && term.left.type === valueType
      && term.right.type === valueType;
  }

  /**
   * Under the eager variant the branches must be values before the if-rule
   * fires. That single extra side condition is what turns "both branches may
   * step" from a harmless non-determinism into a term that gets stuck on code
   * it was never supposed to run.
   */
  function ifReady(term, variant) {
    if (term.type !== 'if' || term.test.type !== 'bool') return false;
    if (!(VARIANTS[variant] || VARIANTS.standard).eager) return true;
    return isValue(term.then) && isValue(term.other);
  }

  /** Where the congruence rules look, in order — this fixes the evaluation order. */
  const HOLES = {
    plus: ['left', 'right'], times: ['left', 'right'], less: ['left', 'right'],
    if: ['test'], pred: ['inner'], iszero: ['inner']
  };

  /**
   * Three rule sets, so the learner can change the semantics and watch the
   * language change. `rightToLeft` reorders the congruence holes and nothing
   * else — confluence says the answer cannot move, only the trace. `eagerIf`
   * lets the branches step before the guard is decided, which is where a
   * language stops being deterministic and starts evaluating code it should
   * never have run.
   */
  const VARIANTS = {
    standard: { holes: HOLES, ungated: [],
      label: 'the standard rules',
      note: 'the guard first, then one branch; operands left to right' },
    rightToLeft: { holes: Object.assign({}, HOLES, { plus: ['right', 'left'],
      times: ['right', 'left'], less: ['right', 'left'] }), ungated: [],
    label: 'operands right to left',
    note: 'the same computation rules, the congruence order flipped' },
    eagerIf: { holes: Object.assign({}, HOLES, { if: ['test', 'then', 'other'] }),
      ungated: ['if'], eager: true, label: 'if evaluates both branches',
      note: 'a plausible-looking rule that breaks determinism and runs dead code' }
  };

  function variantOf(variant) { return VARIANTS[variant] || VARIANTS.standard; }

  function holesFor(variant) { return variantOf(variant).holes; }

  /**
   * The holes actually available in a term. A gated context is the textbook
   * one — `E ::= E + e | v + E` — so the second hole only opens once the first
   * subterm is a value. That gating is what makes the relation deterministic
   * *as a set of rules*, not merely as an implementation that happens to try
   * the left one first; without it, enumerating every permitted step finds two
   * at any term with two reducible operands.
   */
  function openHoles(term, variant) {
    const settings = variantOf(variant);
    const holes = settings.holes[term.type] || [];

    if (settings.ungated.indexOf(term.type) !== -1) return holes;
    const open = [];

    for (let i = 0; i < holes.length; i += 1) {
      open.push(holes[i]);
      if (!isValue(term[holes[i]])) break;
    }
    return open;
  }

  function step(term, variant) {
    for (let i = 0; i < COMPUTATION.length; i += 1) {
      if (COMPUTATION[i].fires(term, variant)) {
        return { term: COMPUTATION[i].run(term), rule: COMPUTATION[i].name,
          shape: COMPUTATION[i].shape, context: '·', redex: show(term) };
      }
    }
    return congruence(term, variant);
  }

  /**
   * Every one-step reduction the rules permit, not only the one the stepper
   * picks. Determinism is the claim that this list never has two entries, and
   * the only way to check it is to build the list.
   */
  function allSteps(term, variant) {
    const found = COMPUTATION.filter(function (rule) { return rule.fires(term, variant); })
      .map(function (rule) {
        return { term: rule.run(term), rule: rule.name, where: 'here' };
      });

    openHoles(term, variant).forEach(function (hole) {
      allSteps(term[hole], variant).forEach(function (inner) {
        const copy = Object.assign({}, term);

        copy[hole] = inner.term;
        found.push({ term: copy, rule: inner.rule, where: hole + '.' + inner.where });
      });
    });
    return found;
  }

  function congruence(term, variant) {
    const holes = openHoles(term, variant);

    for (let i = 0; i < holes.length; i += 1) {
      const inner = step(term[holes[i]], variant);

      if (inner === null) continue;
      const copy = Object.assign({}, term);

      copy[holes[i]] = inner.term;
      return { term: copy, rule: inner.rule, shape: inner.shape,
        context: contextOf(term, holes[i], inner.context, variant), redex: inner.redex };
    }
    return null;
  }

  /** The evaluation context, printed with `·` marking the hole. */
  function contextOf(term, hole, inner, variant) {
    const copy = Object.assign({}, term);

    copy[hole] = { type: 'hole', text: inner };
    return showWithHole(copy, variant);
  }

  function showWithHole(term, variant) {
    if (term.type === 'hole') return term.text;
    const holes = holesFor(variant)[term.type] || [];
    let text = show(replaceHoles(term, variant));

    holes.forEach(function (hole) {
      if (term[hole] && term[hole].type === 'hole') {
        text = text.replace('«hole»', term[hole].text);
      }
    });
    return text;
  }

  function replaceHoles(term, variant) {
    const copy = Object.assign({}, term);

    (holesFor(variant)[term.type] || []).forEach(function (hole) {
      if (copy[hole] && copy[hole].type === 'hole') copy[hole] = { type: 'num', value: '«hole»' };
    });
    return copy;
  }

  /* --------------------------------------------------------- the two runs */

  /**
   * Small-step evaluation: every intermediate term is a real term, which is
   * what makes the trace legible and what makes stuckness observable.
   */
  function run(term, budget, variant) {
    const cap = budget || 200;
    const trace = [{ step: 0, term: show(term), rule: '—', context: '—' }];
    let current = term;
    let count = 0;

    while (count < cap) {
      const next = step(current, variant);

      if (next === null) break;
      current = next.term;
      count += 1;
      trace.push({ step: count, term: show(current), rule: next.rule,
        context: next.context, redex: next.redex, shape: next.shape });
    }
    return { term: current, text: show(current), steps: count, trace: trace,
      outcome: outcomeOf(current, count, cap), value: isValue(current) };
  }

  function outcomeOf(term, count, cap) {
    if (isValue(term)) return 'value';
    if (count >= cap) return 'budget';
    return 'stuck';
  }

  /**
   * Big-step evaluation: `e ⇓ v` in one derivation, no intermediate terms. It
   * is shorter to write and it cannot distinguish "stuck" from "diverges" —
   * both are simply the absence of a derivation, which is exactly the trade.
   */
  function evaluate(term) {
    const node = { rule: bigRule(term), term: show(term), children: [] };

    if (isValue(term)) return Object.assign(node, { value: term, ok: true });
    const holes = HOLES[term.type] || [];
    const parts = {};

    for (let i = 0; i < holes.length; i += 1) {
      const child = evaluate(term[holes[i]]);

      node.children.push(child);
      if (!child.ok) return Object.assign(node, { ok: false, why: child.why });
      parts[holes[i]] = child.value;
    }
    return finishBig(term, parts, node);
  }

  function finishBig(term, parts, node) {
    if (term.type === 'if') return finishIf(term, parts, node);
    const filled = Object.assign({}, term, parts);
    const fired = step(filled, 'standard');

    if (fired === null || !isValue(fired.term)) {
      return Object.assign(node, { ok: false,
        why: 'no rule applies to ' + show(filled) });
    }
    return Object.assign(node, { value: fired.term, ok: true });
  }

  function finishIf(term, parts, node) {
    if (parts.test.type !== 'bool') {
      return Object.assign(node, { ok: false,
        why: 'the guard evaluated to ' + show(parts.test) + ', not a boolean' });
    }
    const branch = evaluate(parts.test.value ? term.then : term.other);

    node.children.push(branch);
    return Object.assign(node, { value: branch.value, ok: branch.ok, why: branch.why });
  }

  const BIG_RULE = { num: 'B-Num', bool: 'B-Bool', unit: 'B-Unit', plus: 'B-Plus',
    times: 'B-Times', less: 'B-Less', if: 'B-If', pred: 'B-Pred', iszero: 'B-IsZero' };

  function bigRule(term) { return BIG_RULE[term.type] || 'B-?'; }

  /**
   * The agreement worth checking: where the small step reaches a value, the
   * big step derives the same one; where the small step gets stuck, the big
   * step has no derivation. Anything else means one of the two is wrong.
   */
  function compare(text, variant) {
    const term = parse(text);
    const small = run(term, 200, variant);
    const big = evaluate(term);

    return { source: text, smallText: small.text, smallSteps: small.steps,
      smallOutcome: small.outcome,
      bigText: big.ok ? show(big.value) : '—', bigOk: big.ok, bigWhy: big.why || '',
      bigHeight: height(big), bigNodes: countNodes(big),
      agree: small.outcome === 'value'
        ? big.ok && show(big.value) === small.text
        : !big.ok };
  }

  function height(node) {
    return 1 + node.children.reduce(function (best, child) {
      return Math.max(best, height(child));
    }, 0);
  }

  function countNodes(node) {
    return node.children.reduce(function (total, child) {
      return total + countNodes(child);
    }, 1);
  }

  /** Terms that reach a value, and terms that get stuck for stated reasons. */
  function fixtures() {
    return [
      { source: '2 + 3 * 4', note: 'ordinary arithmetic', expect: 'value' },
      { source: 'if 2 < 3 then 10 else 20', note: 'the guard steps first', expect: 'value' },
      { source: 'pred (pred (2 + 3))', note: 'nested congruence', expect: 'value' },
      { source: 'iszero (pred 1)', note: 'a boolean out of numbers', expect: 'value' },
      { source: 'if 1 then 2 else 3', note: 'a number as a guard', expect: 'stuck' },
      { source: 'true + 1', note: 'a boolean in an addition', expect: 'stuck' },
      { source: 'pred true', note: 'pred wants a number', expect: 'stuck' },
      { source: 'if iszero 0 then 1 + 1 else true + 1',
        note: 'the dead branch is stuck but never runs', expect: 'value' }
    ];
  }

  /** The rule table the section prints. */
  function ruleTable(variant) {
    const holes = holesFor(variant);

    return COMPUTATION.map(function (rule) {
      return { name: rule.name, shape: rule.shape, kind: 'computation' };
    }).concat(Object.keys(holes).map(function (type) {
      return { name: 'E-' + type.charAt(0).toUpperCase() + type.slice(1) + 'Ctx',
        shape: contextShape(type, holes[type],
          variantOf(variant).ungated.indexOf(type) === -1),
        kind: 'congruence' };
    }));
  }

  /** The context grammar for one constructor, spelled out hole by hole. */
  function contextShape(type, slots, gated) {
    return 'E ::= ' + slots.map(function (hole, index) {
      if (index === 0 || !gated) return type + ' with the hole in ' + hole;
      return type + ' with the hole in ' + hole + ', once ' + slots[index - 1]
        + ' is a value';
    }).join('  |  ');
  }

  /**
   * Walk every term reachable from a source under a variant and report the
   * largest number of rules that applied at once. Two is non-determinism, and
   * the term where it happened is the witness.
   */
  function determinism(text, variant) {
    const seen = {};
    const frontier = [parse(text)];
    let worst = { count: 0, term: '' };
    let visited = 0;

    while (frontier.length > 0 && visited < 400) {
      const current = frontier.pop();
      const key = show(current);

      if (seen[key]) continue;
      seen[key] = true;
      visited += 1;
      worst = widen(worst, current, key, frontier, variant);
    }
    return { source: text, visited: visited, most: worst.count,
      witness: worst.count > 1 ? worst.term : '',
      deterministic: worst.count <= 1 };
  }

  function widen(worst, current, key, frontier, variant) {
    const options = allSteps(current, variant);

    options.forEach(function (option) { frontier.push(option.term); });
    return options.length > worst.count ? { count: options.length, term: key } : worst;
  }

  return {
    CONSTRUCTORS: CONSTRUCTORS, COMPUTATION: COMPUTATION, HOLES: HOLES,
    num: num, bool: bool, unit: unit, plus: plus, times: times, less: less,
    iff: iff, pred: pred, isZero: isZero,
    isValue: isValue, show: show, parse: parse, VARIANTS: VARIANTS,
    step: step, allSteps: allSteps, run: run, evaluate: evaluate, compare: compare,
    determinism: determinism, holesFor: holesFor, openHoles: openHoles,
    height: height, countNodes: countNodes, fixtures: fixtures, ruleTable: ruleTable
  };
}));

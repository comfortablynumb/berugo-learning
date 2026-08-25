/**
 * Soundness, measured: a type system for the small-step arithmetic language,
 * and an exhaustive check that well-typed terms never get stuck.
 *
 * "Well-typed programs do not go wrong" is a theorem with two halves. Progress
 * says a well-typed term is either a value or can take a step — it is never
 * stuck. Preservation says stepping keeps the type — so progress applies again
 * to the result, and by induction the program runs to a value of the type its
 * source said it had. Together they are the whole content of static typing.
 *
 * Both halves are checkable here rather than assertable, because the language
 * is small enough to enumerate. Every term up to depth one is generated, typed
 * and run, and three counts come out: how many well-typed terms got stuck
 * (which must be zero, or the type system is unsound), how many ill-typed
 * terms ran fine anyway (which is the *price* of static checking, and it is
 * not small), and how many steps preserved the type at every intermediate term.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.ArithTypes = api;
}(this, function (root) {
  'use strict';

  const S = root && root.SmallStep ? root.SmallStep : require('./small-step.js');
  const Random = root && root.Random ? root.Random : require('../utils/random.js');

  const NUMBER = 'Number';
  const BOOLEAN = 'Boolean';

  /**
   * The typing rules, one per constructor. Each names the shape it demands and
   * why — a failed check reports the rule and the mismatch, never a bare
   * `null`, because the rule name is what tells a reader where to look.
   */
  const RULES = {
    num: { name: 'T-Num', expects: [], gives: NUMBER,
      reads: 'a numeral is a Number, in any context' },
    bool: { name: 'T-Bool', expects: [], gives: BOOLEAN,
      reads: 'a boolean literal is a Boolean' },
    unit: { name: 'T-Unit', expects: [], gives: 'Unit', reads: 'unit is Unit' },
    plus: { name: 'T-Plus', expects: [NUMBER, NUMBER], gives: NUMBER,
      reads: 'both operands must be Numbers, and the sum is a Number' },
    times: { name: 'T-Times', expects: [NUMBER, NUMBER], gives: NUMBER,
      reads: 'both operands must be Numbers' },
    less: { name: 'T-Less', expects: [NUMBER, NUMBER], gives: BOOLEAN,
      reads: 'two Numbers compare to a Boolean' },
    pred: { name: 'T-Pred', expects: [NUMBER], gives: NUMBER,
      reads: 'pred takes a Number' },
    iszero: { name: 'T-IsZero', expects: [NUMBER], gives: BOOLEAN,
      reads: 'iszero takes a Number and answers a Boolean' }
  };

  const SLOTS = { plus: ['left', 'right'], times: ['left', 'right'],
    less: ['left', 'right'], pred: ['inner'], iszero: ['inner'] };

  /** Type a term, returning a derivation node rather than a bare type. */
  function typeOf(term) {
    if (term.type === 'if') return typeIf(term);
    const rule = RULES[term.type];

    if (rule === undefined) {
      return bad(term, 'T-?', 'no typing rule for ' + term.type, []);
    }
    return typeSimple(term, rule);
  }

  function typeSimple(term, rule) {
    const slots = SLOTS[term.type] || [];
    const children = slots.map(function (slot) { return typeOf(term[slot]); });

    for (let i = 0; i < children.length; i += 1) {
      if (!children[i].ok) return bad(term, rule.name, children[i].why, children);
      if (children[i].type === rule.expects[i]) continue;
      return bad(term, rule.name, slots[i] + ' is ' + children[i].type
        + ' where ' + rule.expects[i] + ' is required', children);
    }
    return good(term, rule.name, rule.gives, children);
  }

  function typeIf(term) {
    const test = typeOf(term.test);
    const then = typeOf(term.then);
    const other = typeOf(term.other);
    const children = [test, then, other];

    if (!test.ok || !then.ok || !other.ok) {
      return bad(term, 'T-If', (test.why || then.why || other.why), children);
    }
    if (test.type !== BOOLEAN) {
      return bad(term, 'T-If', 'the guard is ' + test.type + ', not Boolean', children);
    }
    if (then.type !== other.type) {
      return bad(term, 'T-If', 'the branches are ' + then.type + ' and ' + other.type
        + ', which must agree because only one of them runs', children);
    }
    return good(term, 'T-If', then.type, children);
  }

  function good(term, rule, type, children) {
    return { ok: true, type: type, rule: rule, why: '',
      judgement: S.show(term, 0) + ' : ' + type, children: children };
  }

  function bad(term, rule, why, children) {
    return { ok: false, type: null, rule: rule, why: why,
      judgement: S.show(term, 0) + ' : ✗', children: children };
  }

  /* ------------------------------------------------------- the generators */

  const ATOMS = [S.num(0), S.num(1), S.num(2), S.bool(true), S.bool(false)];

  const BUILDERS = [
    { arity: 1, build: function (parts) { return S.pred(parts[0]); } },
    { arity: 1, build: function (parts) { return S.isZero(parts[0]); } },
    { arity: 2, build: function (parts) { return S.plus(parts[0], parts[1]); } },
    { arity: 2, build: function (parts) { return S.times(parts[0], parts[1]); } },
    { arity: 2, build: function (parts) { return S.less(parts[0], parts[1]); } },
    { arity: 3, build: function (parts) { return S.iff(parts[0], parts[1], parts[2]); } }
  ];

  /** Every term of depth one over the five atoms — 215 of them, no sampling. */
  function shallowTerms() {
    const out = ATOMS.slice();

    BUILDERS.forEach(function (builder) {
      combinations(ATOMS, builder.arity).forEach(function (parts) {
        out.push(builder.build(parts));
      });
    });
    return out;
  }

  function combinations(pool, arity) {
    if (arity === 0) return [[]];
    const shorter = combinations(pool, arity - 1);
    const out = [];

    pool.forEach(function (item) {
      shorter.forEach(function (rest) { out.push([item].concat(rest)); });
    });
    return out;
  }

  /** Deeper terms, sampled with a fixed seed so two runs agree. */
  function sampledTerms(count, seed, pool) {
    const random = Random.seeded(seed || 20260824);
    const source = pool || shallowTerms();
    const out = [];

    for (let i = 0; i < count; i += 1) {
      const builder = BUILDERS[random.int(BUILDERS.length)];
      const parts = [];

      for (let slot = 0; slot < builder.arity; slot += 1) {
        parts.push(source[random.int(source.length)]);
      }
      out.push(builder.build(parts));
    }
    return out;
  }

  /* --------------------------------------------------------- the theorems */

  /**
   * Preservation, checked step by step: run the term and type every
   * intermediate. A single step that changes the type is a counterexample and
   * is reported with the two terms involved.
   */
  function preservation(term, budget) {
    const trace = [];
    let current = term;
    let steps = 0;
    const start = typeOf(current);

    if (!start.ok) return { checked: 0, ok: true, applicable: false };
    while (steps < (budget || 100)) {
      const next = S.step(current, 'standard');

      if (next === null) break;
      const after = typeOf(next.term);

      trace.push({ before: S.show(current, 0), after: S.show(next.term, 0),
        beforeType: typeOf(current).type, afterType: after.type });
      if (!after.ok || after.type !== start.type) {
        return { checked: trace.length, ok: false, applicable: true,
          witness: trace[trace.length - 1] };
      }
      current = next.term;
      steps += 1;
    }
    return { checked: trace.length, ok: true, applicable: true, trace: trace };
  }

  /**
   * The sweep. Every term is typed and run, and the four cells of the table
   * are counted: well-typed and fine, well-typed and stuck (unsound — must be
   * zero), ill-typed and stuck (correctly rejected), ill-typed and fine
   * (rejected anyway, which is the conservatism the type system charges).
   */
  function sweep(options) {
    const settings = options || {};
    const terms = shallowTerms().concat(settings.sample
      ? sampledTerms(settings.sample, settings.seed) : []);
    const tally = { total: 0, wellTypedFine: 0, wellTypedStuck: 0,
      illTypedStuck: 0, illTypedFine: 0, preservationChecked: 0,
      preservationFailures: 0, unsoundWitness: null, conservativeWitness: null };

    terms.forEach(function (term) { tallyOne(tally, term); });
    return finishSweep(tally, terms.length);
  }

  function tallyOne(tally, term) {
    const typing = typeOf(term);
    const run = S.run(term, 200, 'standard');
    const stuck = run.outcome === 'stuck';

    tally.total += 1;
    if (typing.ok && !stuck) tally.wellTypedFine += 1;
    if (typing.ok && stuck) {
      tally.wellTypedStuck += 1;
      tally.unsoundWitness = tally.unsoundWitness || S.show(term, 0);
    }
    if (!typing.ok && stuck) tally.illTypedStuck += 1;
    if (!typing.ok && !stuck) {
      tally.illTypedFine += 1;
      tally.conservativeWitness = tally.conservativeWitness
        || { term: S.show(term, 0), value: run.text, why: typing.why };
    }
    if (typing.ok) countPreservation(tally, term);
  }

  function countPreservation(tally, term) {
    const result = preservation(term, 100);

    tally.preservationChecked += result.checked;
    if (!result.ok) tally.preservationFailures += 1;
  }

  function finishSweep(tally, count) {
    return Object.assign({}, tally, {
      terms: count,
      sound: tally.wellTypedStuck === 0 && tally.preservationFailures === 0,
      wellTyped: tally.wellTypedFine + tally.wellTypedStuck,
      illTyped: tally.illTypedStuck + tally.illTypedFine,
      conservatism: tally.illTypedFine
        / Math.max(1, tally.illTypedStuck + tally.illTypedFine)
    });
  }

  function ruleTable() {
    return Object.keys(RULES).map(function (kind) {
      return { kind: kind, name: RULES[kind].name, reads: RULES[kind].reads,
        gives: RULES[kind].gives };
    }).concat([{ kind: 'if', name: 'T-If', gives: 'either branch type',
      reads: 'the guard must be Boolean and the two branches must agree' }]);
  }

  return {
    NUMBER: NUMBER, BOOLEAN: BOOLEAN, RULES: RULES, ATOMS: ATOMS,
    typeOf: typeOf, shallowTerms: shallowTerms, sampledTerms: sampledTerms,
    preservation: preservation, sweep: sweep, ruleTable: ruleTable
  };
}));

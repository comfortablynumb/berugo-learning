/**
 * Parsing expression grammars, with packrat memoisation.
 *
 * A PEG looks like a CFG and means something different. `A / B` is ORDERED
 * choice: try A, and only if it fails try B — so a PEG can never be ambiguous,
 * because the first success wins and there is no second parse to find. That
 * sounds like a feature until an alternative is unreachable because an earlier
 * one always matches a prefix of it, and nothing tells you: `("a" / "ab")` can
 * never match "ab" as a whole, and most PEG tools do not check.
 *
 * Repetition is greedy and never backtracks into a successful repetition,
 * which is the other place PEG and CFG semantics part company. The demo runs
 * the same rule set both ways and shows an input where they disagree.
 *
 * Packrat memoisation makes it linear: cache (rule, position) and the
 * exponential re-parsing of the same suffix collapses to one entry per pair.
 * The `steps` counter is what the section measures — without the cache the
 * designed fixture is exponential, with it linear, and the numbers are printed
 * rather than asserted.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.Peg = api;
}(this, function () {
  'use strict';

  const FAIL = -1;

  /* ------------------------------------------------------- expressions */

  function lit(text) { return { type: 'lit', text: text }; }
  function ref(name) { return { type: 'ref', name: name }; }
  function seq() { return { type: 'seq', parts: Array.prototype.slice.call(arguments) }; }
  function choice() {
    return { type: 'choice', parts: Array.prototype.slice.call(arguments) };
  }
  function star(part) { return { type: 'star', part: part }; }
  function plus(part) { return { type: 'plus', part: part }; }
  function opt(part) { return { type: 'opt', part: part }; }
  function and(part) { return { type: 'and', part: part }; }
  function not(part) { return { type: 'not', part: part }; }
  function any() { return { type: 'any' }; }

  function create(config) {
    return { start: config.start, rules: config.rules, label: config.label || null };
  }

  /* ----------------------------------------------------------- the parser */

  /**
   * Parse `input` from position 0. `memo` is on by default; turning it off is
   * what makes the exponential fixture exponential, which is the measurement.
   */
  function parse(grammar, input, options) {
    const settings = options || {};
    const state = {
      grammar: grammar, input: input, steps: 0, hits: 0, misses: 0,
      memo: settings.memo === false ? null : {},
      cap: settings.cap === undefined ? 2000000 : settings.cap,
      overflow: false
    };
    const end = evaluate(state, grammar.rules[grammar.start], 0);

    return {
      matched: end !== FAIL, consumed: end === FAIL ? 0 : end,
      complete: end === input.length,
      steps: state.steps, hits: state.hits, misses: state.misses,
      entries: state.memo ? Object.keys(state.memo).length : 0,
      overflow: state.overflow
    };
  }

  function evaluate(state, expression, at) {
    state.steps += 1;
    if (state.steps > state.cap) { state.overflow = true; return FAIL; }
    const handler = HANDLERS[expression.type];

    return handler(state, expression, at);
  }

  const HANDLERS = {
    lit: function (state, expression, at) {
      return state.input.slice(at, at + expression.text.length) === expression.text
        ? at + expression.text.length : FAIL;
    },
    any: function (state, expression, at) {
      return at < state.input.length ? at + 1 : FAIL;
    },
    ref: function (state, expression, at) {
      return evaluateRule(state, expression.name, at);
    },
    seq: function (state, expression, at) {
      let position = at;

      for (let i = 0; i < expression.parts.length; i += 1) {
        position = evaluate(state, expression.parts[i], position);
        if (position === FAIL) return FAIL;
      }
      return position;
    },
    choice: function (state, expression, at) {
      for (let i = 0; i < expression.parts.length; i += 1) {
        const position = evaluate(state, expression.parts[i], at);

        if (position !== FAIL) return position;
      }
      return FAIL;
    },
    star: function (state, expression, at) { return repeat(state, expression.part, at, 0); },
    plus: function (state, expression, at) { return repeat(state, expression.part, at, 1); },
    opt: function (state, expression, at) {
      const position = evaluate(state, expression.part, at);

      return position === FAIL ? at : position;
    },
    and: function (state, expression, at) {
      return evaluate(state, expression.part, at) === FAIL ? FAIL : at;
    },
    not: function (state, expression, at) {
      return evaluate(state, expression.part, at) === FAIL ? at : FAIL;
    }
  };

  /** Greedy, and it never gives a repetition back — the semantic difference
   *  from a CFG's star that surprises people. */
  function repeat(state, part, at, minimum) {
    let position = at;
    let count = 0;

    for (;;) {
      const next = evaluate(state, part, position);

      if (next === FAIL || next === position) break;
      position = next;
      count += 1;
    }
    return count >= minimum ? position : FAIL;
  }

  /** The packrat cache: one entry per (rule, position). */
  function evaluateRule(state, name, at) {
    if (!state.memo) return evaluate(state, state.grammar.rules[name], at);
    const key = name + ':' + at;

    if (state.memo[key] !== undefined) { state.hits += 1; return state.memo[key]; }
    state.misses += 1;
    /* Left recursion would loop forever here; seeding with FAIL turns the
       hang into a rejection, which is what most packrat implementations do
       and what the demo reports honestly. */
    state.memo[key] = FAIL;
    const result = evaluate(state, state.grammar.rules[name], at);

    state.memo[key] = result;
    return result;
  }

  function matches(grammar, input, options) {
    const result = parse(grammar, input, options);

    return result.matched && result.complete;
  }

  /* ------------------------------------------------------- unreachable */

  /**
   * An alternative that can never win: an earlier one always matches a prefix
   * of everything it matches. Checked by sampling the language of the inputs
   * a caller supplies rather than proved, because the general question is
   * undecidable — but the common case is a shorter literal before a longer one
   * and that is caught exactly.
   */
  function unreachableAlternatives(grammar, samples) {
    const out = [];

    Object.keys(grammar.rules).forEach(function (name) {
      const expression = grammar.rules[name];

      if (expression.type !== 'choice') return;
      expression.parts.forEach(function (part, index) {
        if (index === 0) return;
        const wins = samples.filter(function (input) {
          return firstWinner(grammar, expression, input) === index;
        });

        if (wins.length > 0) return;
        out.push({ rule: name, index: index,
          shadowedBy: shadower(grammar, expression, index, samples),
          reason: literalPrefix(expression.parts, index) });
      });
    });
    return out;
  }

  /**
   * Which alternative ordered choice commits to. It is the first that succeeds
   * AT ALL, not the first that consumes the whole input — that distinction is
   * the entire hazard: `("a" / "ab")` commits to "a" on the input "ab", the
   * outer parse then finds a leftover character, and the second alternative is
   * never reached.
   */
  function firstWinner(grammar, expression, input) {
    for (let i = 0; i < expression.parts.length; i += 1) {
      const state = { grammar: grammar, input: input, steps: 0, hits: 0, misses: 0,
        memo: {}, cap: 200000, overflow: false };

      if (evaluate(state, expression.parts[i], 0) !== FAIL) return i;
    }
    return -1;
  }

  function shadower(grammar, expression, index, samples) {
    for (let i = 0; i < index; i += 1) {
      const covers = samples.some(function (input) {
        const state = { grammar: grammar, input: input, steps: 0, hits: 0, misses: 0,
          memo: {}, cap: 200000, overflow: false };

        return evaluate(state, expression.parts[i], 0) !== FAIL;
      });

      if (covers) return i;
    }
    return 0;
  }

  function literalPrefix(parts, index) {
    const mine = parts[index];

    for (let i = 0; i < index; i += 1) {
      if (parts[i].type === 'lit' && mine.type === 'lit'
        && mine.text.indexOf(parts[i].text) === 0) {
        return 'the earlier alternative "' + parts[i].text + '" is a prefix of "' +
          mine.text + '", so it always wins';
      }
    }
    return 'no sampled input reaches this alternative';
  }

  /* ------------------------------------------------------ ready-made */

  /**
   * The classic packrat fixture: each level parses the next level TWICE in an
   * alternative that then fails, and the second alternative parses it again.
   * Without memoisation the cost triples per level on an input of one
   * character; with it, each (rule, position) pair is computed once.
   */
  function exponentialFixture(depth) {
    const rules = {};

    for (let i = 0; i < depth; i += 1) {
      const next = 'A' + (i + 1);

      rules['A' + i] = choice(seq(ref(next), ref(next), lit('z')), ref(next));
    }
    rules['A' + depth] = lit('a');
    return create({ start: 'A0', rules: rules, label: 'exponential at depth ' + depth });
  }

  /** The same alternatives in both orders, so the demo can show ordered choice
   *  changing the result on one input. */
  function orderedChoicePair() {
    return {
      shortFirst: create({ start: 'S',
        rules: { S: choice(lit('a'), lit('ab')) }, label: '"a" / "ab"' }),
      longFirst: create({ start: 'S',
        rules: { S: choice(lit('ab'), lit('a')) }, label: '"ab" / "a"' })
    };
  }

  return {
    FAIL: FAIL, create: create, parse: parse, matches: matches,
    lit: lit, ref: ref, seq: seq, choice: choice, star: star, plus: plus, opt: opt,
    and: and, not: not, any: any,
    unreachableAlternatives: unreachableAlternatives,
    exponentialFixture: exponentialFixture, orderedChoicePair: orderedChoicePair
  };
}));

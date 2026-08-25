/**
 * Bracket abstraction: compiling variables away, and the proof that binding is
 * syntactic sugar.
 *
 * Every lambda term translates into a combination of S, K and I with no
 * variables anywhere. The algorithm is four cases and it is worth knowing
 * because its descendant is closure conversion — a real compiler does exactly
 * this job when it turns a nested function into a top-level one plus an
 * environment, and the size blow-up here is the same blow-up.
 *
 * The naive translation is exponential: each abstraction distributes S over an
 * application, and nested abstractions multiply. Schönfinkel's optimisations —
 * `S (K a) (K b) → K (a b)`, `S (K a) I → a` — cut it dramatically, and the
 * demo measures both so "combinators blow up" is a number rather than folklore.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.Combinators = api;
}(this, function (root) {
  'use strict';

  const Lambda = root && root.LambdaEngine ? root.LambdaEngine
    : require('../machines/lambda-engine.js');

  const COMBINATORS = {
    S: { arity: 3, rule: 'S x y z → x z (y z)',
      reads: 'apply both to the argument, then apply the results' },
    K: { arity: 2, rule: 'K x y → x', reads: 'throw the second argument away' },
    I: { arity: 1, rule: 'I x → x', reads: 'the identity' },
    B: { arity: 3, rule: 'B x y z → x (y z)', reads: 'compose' },
    C: { arity: 3, rule: 'C x y z → x z y', reads: 'swap the last two arguments' },
    W: { arity: 2, rule: 'W x y → x y y', reads: 'duplicate the argument' }
  };

  function isCombinator(term) {
    return term.type === 'var' && COMBINATORS[term.name] !== undefined;
  }

  /* ------------------------------------------------- bracket abstraction */

  /**
   * `abstract(x, term)` builds a combinator term that, applied to anything,
   * behaves as `λx. term` does. Four cases, and every one is forced:
   *
   *   - the variable itself becomes I,
   *   - a term not mentioning x becomes K applied to it,
   *   - an application distributes S over both halves,
   *   - a nested lambda is abstracted from the inside out first.
   *
   * `optimise` adds Schönfinkel's two rules, which is where the size
   * difference comes from.
   */
  function abstractVariable(name, term, options) {
    const settings = options || {};
    const steps = settings.steps || [];

    if (term.type === 'var' && term.name === name) {
      steps.push({ rule: 'λx. x → I', result: 'I' });
      return Lambda.variable('I');
    }
    if (Lambda.freeVariables(term).indexOf(name) === -1) {
      const wrapped = Lambda.apply(Lambda.variable('K'), term);

      steps.push({ rule: 'λx. e → K e when x is not free in e',
        result: Lambda.show(wrapped) });
      return wrapped;
    }
    if (term.type === 'lam') {
      return abstractVariable(name, abstractVariable(term.param, term.body, options), options);
    }
    const left = abstractVariable(name, term.left, options);
    const right = abstractVariable(name, term.right, options);

    if (settings.optimise !== false) {
      const short = shorten(left, right, steps);

      if (short) return short;
    }
    const spread = Lambda.apply(Lambda.apply(Lambda.variable('S'), left), right);

    steps.push({ rule: 'λx. (a b) → S (λx. a) (λx. b)', result: Lambda.show(spread) });
    return spread;
  }

  /** Schönfinkel's two optimisations, which are what keep the output readable. */
  function shorten(left, right, steps) {
    if (isApplicationOf(left, 'K') && isApplicationOf(right, 'K')) {
      steps.push({ rule: 'S (K a) (K b) → K (a b)',
        result: 'K (' + Lambda.show(Lambda.apply(left.right, right.right)) + ')' });
      return Lambda.apply(Lambda.variable('K'),
        Lambda.apply(left.right, right.right));
    }
    if (isApplicationOf(left, 'K') && right.type === 'var' && right.name === 'I') {
      steps.push({ rule: 'S (K a) I → a', result: Lambda.show(left.right) });
      return left.right;
    }
    return null;
  }

  function isApplicationOf(term, name) {
    return term.type === 'app' && term.left.type === 'var' && term.left.name === name;
  }

  /** Compile a whole term, innermost abstraction first. */
  function compile(term, options) {
    const settings = options || {};

    if (term.type === 'var') return term;
    if (term.type === 'app') {
      return Lambda.apply(compile(term.left, settings), compile(term.right, settings));
    }
    return abstractVariable(term.param, compile(term.body, settings), settings);
  }

  /** The compilation with its steps recorded, which is what the demo shows. */
  function compileWithSteps(term, optimise) {
    const steps = [];
    const result = compile(term, { steps: steps, optimise: optimise !== false });

    return { term: result, text: Lambda.show(result), steps: steps,
      size: Lambda.size(result), combinators: countCombinators(result) };
  }

  function countCombinators(term) {
    if (term.type === 'var') return COMBINATORS[term.name] ? 1 : 0;
    if (term.type === 'lam') return countCombinators(term.body);
    return countCombinators(term.left) + countCombinators(term.right);
  }

  /* ---------------------------------------------------- graph reduction */

  /**
   * Reduce a combinator term, leftmost-outermost. The spine is the chain of
   * applications down the left, and every rule fires when the spine has enough
   * arguments — which is what makes combinator reduction so mechanical, and
   * why the SKI machines of the 1980s existed at all.
   */
  function reduce(term, budget) {
    const cap = budget === undefined ? 4000 : budget;
    const trace = [];
    let current = term;
    let steps = 0;

    while (steps < cap) {
      if (trace.length < 40) {
        trace.push({ step: steps, term: Lambda.show(current), size: Lambda.size(current) });
      }
      const next = step(current);

      if (next === null) {
        return { term: current, text: Lambda.show(current), steps: steps, trace: trace,
          outcome: 'normal', size: Lambda.size(current) };
      }
      current = next;
      steps += 1;
      if (Lambda.size(current) > 20000) {
        return { term: current, text: Lambda.show(current), steps: steps, trace: trace,
          outcome: 'size', size: Lambda.size(current) };
      }
    }
    return { term: current, text: Lambda.show(current), steps: steps, trace: trace,
      outcome: 'budget', size: Lambda.size(current) };
  }

  function step(term) {
    const spine = spineOf(term);
    const head = spine[0];
    const args = spine.slice(1);

    if (head.type === 'var' && COMBINATORS[head.name]
      && args.length >= COMBINATORS[head.name].arity) {
      return rebuild(fire(head.name, args), args.slice(COMBINATORS[head.name].arity));
    }
    for (let i = 0; i < args.length; i += 1) {
      const reduced = step(args[i]);

      if (reduced === null) continue;
      const copy = args.slice();

      copy[i] = reduced;
      return rebuild(head, copy);
    }
    return null;
  }

  const FIRE = {
    I: function (args) { return args[0]; },
    K: function (args) { return args[0]; },
    S: function (args) {
      return Lambda.apply(Lambda.apply(args[0], args[2]),
        Lambda.apply(args[1], args[2]));
    },
    B: function (args) {
      return Lambda.apply(args[0], Lambda.apply(args[1], args[2]));
    },
    C: function (args) {
      return Lambda.apply(Lambda.apply(args[0], args[2]), args[1]);
    },
    W: function (args) {
      return Lambda.apply(Lambda.apply(args[0], args[1]), args[1]);
    }
  };

  function fire(name, args) {
    return FIRE[name](args);
  }

  function spineOf(term) {
    if (term.type !== 'app') return [term];
    return spineOf(term.left).concat([term.right]);
  }

  function rebuild(head, args) {
    return args.reduce(function (acc, arg) { return Lambda.apply(acc, arg); }, head);
  }

  /* ----------------------------------------------------- the equivalence */

  /**
   * The claim worth checking: a compiled term computes the same function as
   * the original. Applied to the same arguments, both reduce to the same
   * normal form — and that is a test rather than an appeal to the algorithm.
   */
  function agrees(source, argumentTexts, budget) {
    const term = Lambda.parse(source);
    const compiled = compile(term, {});
    const args = argumentTexts.map(Lambda.parse);
    const applyAll = function (base) {
      return args.reduce(function (acc, arg) { return Lambda.apply(acc, arg); }, base);
    };
    const fromLambda = Lambda.reduce(applyAll(term), 'normal',
      { budget: budget || 4000, traceLimit: 0 });
    const fromCombinators = reduce(applyAll(compiled), budget || 4000);

    return {
      source: source,
      compiled: Lambda.show(compiled),
      lambdaResult: fromLambda.text,
      combinatorResult: fromCombinators.text,
      agree: Lambda.alphaEqual(fromLambda.term, fromCombinators.term),
      lambdaSteps: fromLambda.steps, combinatorSteps: fromCombinators.steps
    };
  }

  /** Optimised against naive, so the blow-up is a number. */
  function sizeComparison(sources) {
    return sources.map(function (source) {
      const term = Lambda.parse(source);
      const naive = compileWithSteps(term, false);
      const better = compileWithSteps(term, true);

      return { source: source, original: Lambda.size(term),
        naive: naive.size, optimised: better.size,
        ratio: better.size === 0 ? 0 : naive.size / better.size,
        naiveText: naive.text, optimisedText: better.text };
    });
  }

  /** Terms whose compiled form a reader can check by hand. */
  function fixtures() {
    return ['λx. x', 'λx y. x', 'λx y. y', 'λx y z. x z (y z)', 'λf x. f (f x)',
      'λx y. x y', 'λf g x. f (g x)'];
  }

  return {
    COMBINATORS: COMBINATORS,
    abstractVariable: abstractVariable, compile: compile, compileWithSteps: compileWithSteps,
    reduce: reduce, step: step, spineOf: spineOf, isCombinator: isCombinator,
    agrees: agrees, sizeComparison: sizeComparison, fixtures: fixtures,
    countCombinators: countCombinators
  };
}));

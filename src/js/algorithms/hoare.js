/**
 * Axiomatic semantics: Hoare triples, weakest preconditions, and the loop
 * invariant that carries the whole proof.
 *
 * `{P} c {Q}` says: start anywhere satisfying P, run c, and if it stops you
 * land in Q. Dijkstra's move was to make it computable from the back: `wp(c,
 * Q)` is the weakest predicate that guarantees Q afterwards, and the triple
 * holds exactly when `P ⇒ wp(c, Q)`. Assignment is the surprising one —
 * `wp(x := e, Q)` is `Q` with `e` substituted for `x`, working backwards, not
 * forwards, which is why the rule looks upside down the first time.
 *
 * Loops are where it stops being mechanical. `wp` of a loop is an infinite
 * conjunction, so a human supplies an invariant and the tool checks three
 * finite obligations instead: the invariant holds on entry, the body preserves
 * it, and invariant-plus-exit-test implies the postcondition. Get the
 * invariant wrong and one of those three fails — with a concrete state, which
 * is the only useful form of "your proof is broken".
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.Hoare = api;
}(this, function () {
  'use strict';

  /* --------------------------------------------------------- expressions */

  function lit(value) { return { kind: 'lit', value: value }; }
  function ref(name) { return { kind: 'ref', name: name }; }
  function binary(op, left, right) {
    return { kind: 'bin', op: op, left: left, right: right };
  }

  const ARITHMETIC = {
    '+': function (a, b) { return a + b; },
    '-': function (a, b) { return a - b; },
    '*': function (a, b) { return a * b; },
    '/': function (a, b) { return b === 0 ? null : Math.trunc(a / b); },
    '%': function (a, b) { return b === 0 ? null : a - Math.trunc(a / b) * b; }
  };

  function evaluate(expression, state) {
    if (expression.kind === 'lit') return expression.value;
    if (expression.kind === 'ref') {
      return state[expression.name] === undefined ? 0 : state[expression.name];
    }
    const left = evaluate(expression.left, state);
    const right = evaluate(expression.right, state);

    if (left === null || right === null) return null;
    return ARITHMETIC[expression.op](left, right);
  }

  function showExpression(expression, inner) {
    if (expression.kind === 'lit') return String(expression.value);
    if (expression.kind === 'ref') return expression.name;
    const text = showExpression(expression.left, true) + ' ' + expression.op
      + ' ' + showExpression(expression.right, true);

    return inner ? '(' + text + ')' : text;
  }

  function substituteExpression(expression, name, value) {
    if (expression.kind === 'lit') return expression;
    if (expression.kind === 'ref') return expression.name === name ? value : expression;
    return binary(expression.op, substituteExpression(expression.left, name, value),
      substituteExpression(expression.right, name, value));
  }

  /* ------------------------------------------------------------ formulas */

  function compare(op, left, right) {
    return { kind: 'cmp', op: op, left: left, right: right };
  }
  function and(left, right) { return { kind: 'and', left: left, right: right }; }
  function or(left, right) { return { kind: 'or', left: left, right: right }; }
  function not(inner) { return { kind: 'not', inner: inner }; }
  function implies(left, right) { return { kind: 'implies', left: left, right: right }; }

  const TRUE = { kind: 'const', value: true };
  const FALSE = { kind: 'const', value: false };

  const COMPARISONS = {
    '=': function (a, b) { return a === b; },
    '≠': function (a, b) { return a !== b; },
    '<': function (a, b) { return a < b; },
    '≤': function (a, b) { return a <= b; },
    '>': function (a, b) { return a > b; },
    '≥': function (a, b) { return a >= b; }
  };

  const FORMULA_EVALUATORS = {
    const: function (formula) { return formula.value; },
    cmp: function (formula, state) {
      const left = evaluate(formula.left, state);
      const right = evaluate(formula.right, state);

      return left === null || right === null ? null : COMPARISONS[formula.op](left, right);
    },
    and: function (formula, state) { return bothWays(formula, state, 'and'); },
    or: function (formula, state) { return bothWays(formula, state, 'or'); },
    implies: function (formula, state) { return bothWays(formula, state, 'implies'); },
    not: function (formula, state) {
      const inner = holds(formula.inner, state);

      return inner === null ? null : !inner;
    }
  };

  function bothWays(formula, state, kind) {
    const left = holds(formula.left, state);
    const right = holds(formula.right, state);

    if (left === null || right === null) return null;
    if (kind === 'and') return left && right;
    if (kind === 'or') return left || right;
    return !left || right;
  }

  /** Does this formula hold in this state? `null` means an undefined operation. */
  function holds(formula, state) {
    return FORMULA_EVALUATORS[formula.kind](formula, state);
  }

  const CONNECTIVE = { and: ' ∧ ', or: ' ∨ ', implies: ' ⇒ ' };

  function showFormula(formula, inner) {
    if (formula.kind === 'const') return formula.value ? 'true' : 'false';
    if (formula.kind === 'cmp') {
      return showExpression(formula.left, false) + ' ' + formula.op
        + ' ' + showExpression(formula.right, false);
    }
    if (formula.kind === 'not') return '¬(' + showFormula(formula.inner, false) + ')';
    const text = showFormula(formula.left, true) + CONNECTIVE[formula.kind]
      + showFormula(formula.right, true);

    return inner ? '(' + text + ')' : text;
  }

  /** Substitution is the assignment rule; everything else just recurses. */
  function substitute(formula, name, value) {
    if (formula.kind === 'const') return formula;
    if (formula.kind === 'cmp') {
      return compare(formula.op, substituteExpression(formula.left, name, value),
        substituteExpression(formula.right, name, value));
    }
    if (formula.kind === 'not') return not(substitute(formula.inner, name, value));
    return { kind: formula.kind, left: substitute(formula.left, name, value),
      right: substitute(formula.right, name, value) };
  }

  function formulaSize(formula) {
    if (formula.kind === 'const') return 1;
    if (formula.kind === 'cmp') {
      return 1 + expressionSize(formula.left) + expressionSize(formula.right);
    }
    if (formula.kind === 'not') return 1 + formulaSize(formula.inner);
    return 1 + formulaSize(formula.left) + formulaSize(formula.right);
  }

  function expressionSize(expression) {
    if (expression.kind !== 'bin') return 1;
    return 1 + expressionSize(expression.left) + expressionSize(expression.right);
  }

  function variablesIn(node, into) {
    const found = into || [];

    if (node.kind === 'ref') {
      if (found.indexOf(node.name) === -1) found.push(node.name);
      return found;
    }
    ['left', 'right', 'inner'].forEach(function (slot) {
      if (node[slot] && typeof node[slot] === 'object') variablesIn(node[slot], found);
    });
    return found;
  }

  /* ------------------------------------------------------------ commands */

  function skip() { return { kind: 'skip' }; }
  function assign(name, expression) {
    return { kind: 'assign', name: name, expression: expression };
  }
  function seq(first, second) { return { kind: 'seq', first: first, second: second }; }
  function branch(test, then, other) {
    return { kind: 'if', test: test, then: then, other: other };
  }
  function loop(test, invariant, body, variant) {
    return { kind: 'while', test: test, invariant: invariant, body: body, variant: variant };
  }

  function showCommand(command, indent) {
    const pad = indent || '';

    if (command.kind === 'skip') return pad + 'skip';
    if (command.kind === 'assign') {
      return pad + command.name + ' := ' + showExpression(command.expression, false);
    }
    if (command.kind === 'seq') {
      return showCommand(command.first, pad) + ';\n' + showCommand(command.second, pad);
    }
    if (command.kind === 'if') return showBranch(command, pad);
    return showLoop(command, pad);
  }

  function showBranch(command, pad) {
    return pad + 'if ' + showFormula(command.test, false) + ' then\n'
      + showCommand(command.then, pad + '  ') + '\n' + pad + 'else\n'
      + showCommand(command.other, pad + '  ') + '\n' + pad + 'end';
  }

  function showLoop(command, pad) {
    return pad + 'while ' + showFormula(command.test, false) + '\n'
      + pad + '  invariant ' + showFormula(command.invariant, false) + '\n'
      + pad + 'do\n' + showCommand(command.body, pad + '  ') + '\n' + pad + 'end';
  }

  /* ------------------------------------------------------- the interpreter */

  /** Run the program, so a claimed triple can be tested and not only proved. */
  function run(command, state, budget) {
    const context = { state: Object.assign({}, state), steps: 0,
      cap: budget || 2000, trace: [], stuck: '' };

    execute(command, context);
    return { state: context.state, steps: context.steps, trace: context.trace,
      terminated: context.steps < context.cap && context.stuck === '',
      stuck: context.stuck };
  }

  const EXECUTORS = {
    skip: function () { return true; },
    assign: function (command, context) {
      const value = evaluate(command.expression, context.state);

      if (value === null) {
        context.stuck = 'division by zero in ' + showExpression(command.expression, false);
        return false;
      }
      context.state[command.name] = value;
      context.trace.push({ step: context.steps, command: command.name + ' := ' + value,
        state: Object.assign({}, context.state) });
      return true;
    },
    seq: function (command, context) {
      return execute(command.first, context) && execute(command.second, context);
    },
    if: function (command, context) {
      return execute(holds(command.test, context.state) ? command.then : command.other, context);
    },
    while: function (command, context) { return executeLoop(command, context); }
  };

  function execute(command, context) {
    context.steps += 1;
    if (context.steps > context.cap) {
      context.stuck = context.stuck || 'step budget exhausted';
      return false;
    }
    return EXECUTORS[command.kind](command, context);
  }

  function executeLoop(command, context) {
    while (holds(command.test, context.state) === true) {
      if (!execute(command.body, context)) return false;
      context.steps += 1;
      if (context.steps > context.cap) {
        context.stuck = context.stuck || 'the loop did not terminate within the budget';
        return false;
      }
    }
    return true;
  }

  /* ------------------------------------------------ weakest preconditions */

  /**
   * `wp` walks backwards. Its one interesting property is what happens to an
   * `if`: both branches contribute, so the formula *doubles* at every nesting
   * level — the classic weakest-precondition blow-up, and the reason real
   * verifiers pass to an SMT solver in single-static-assignment form instead
   * of building this text.
   */
  function wp(command, post, obligations) {
    const into = obligations || [];
    const handler = WP[command.kind];

    return handler(command, post, into);
  }

  const WP = {
    skip: function (command, post) { return post; },
    assign: function (command, post) {
      return substitute(post, command.name, command.expression);
    },
    seq: function (command, post, into) {
      return wp(command.first, wp(command.second, post, into), into);
    },
    if: function (command, post, into) {
      return and(implies(command.test, wp(command.then, post, into)),
        implies(not(command.test), wp(command.other, post, into)));
    },
    while: function (command, post, into) { return wpLoop(command, post, into); }
  };

  /**
   * The loop rule does not compute anything; it *trusts the invariant* and
   * records the two obligations that make the trust sound. That is the whole
   * bargain of Floyd–Hoare verification, and the invariant is where all the
   * human work goes.
   */
  function wpLoop(command, post, into) {
    into.push({ name: 'preservation',
      formula: implies(and(command.invariant, command.test),
        wp(command.body, command.invariant, into)),
      reads: 'running the body once from inside the loop leaves the invariant true' });
    into.push({ name: 'exit',
      formula: implies(and(command.invariant, not(command.test)), post),
      reads: 'the invariant plus a failed test is enough for the postcondition' });
    return command.invariant;
  }

  /**
   * The full obligation list for a triple: the entry condition plus whatever
   * the loops contributed. A verifier discharges each one separately, and each
   * one that fails names a different bug.
   */
  function conditions(pre, command, post) {
    const loopParts = [];
    const weakest = wp(command, post, loopParts);

    return [{ name: 'entry', formula: implies(pre, weakest),
      reads: 'the precondition is strong enough to establish the weakest precondition' }]
      .concat(loopParts);
  }

  /**
   * Given a state that falsifies a formula, find the smallest sub-formula that
   * is false there. A counterexample without this is a wall of symbols; with
   * it, the reader sees the one conjunct that did not hold.
   */
  function blame(formula, state) {
    if (holds(formula, state) !== false) return '';
    if (formula.kind === 'and') {
      return blame(holds(formula.left, state) === false ? formula.left : formula.right, state);
    }
    if (formula.kind === 'implies' && holds(formula.left, state) === true) {
      return blame(formula.right, state);
    }
    return showFormula(formula, false);
  }

  return {
    lit: lit, ref: ref, binary: binary, evaluate: evaluate, blame: blame,
    showExpression: showExpression, substituteExpression: substituteExpression,
    compare: compare, and: and, or: or, not: not, implies: implies,
    TRUE: TRUE, FALSE: FALSE, holds: holds, showFormula: showFormula,
    substitute: substitute, formulaSize: formulaSize, variablesIn: variablesIn,
    skip: skip, assign: assign, seq: seq, branch: branch, loop: loop,
    showCommand: showCommand, run: run, wp: wp, conditions: conditions
  };
}));

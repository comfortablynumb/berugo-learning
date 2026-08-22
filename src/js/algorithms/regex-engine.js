/**
 * Two regular-expression engines on one parser, so the difference between them
 * is a measurement rather than an argument.
 *
 * The backtracking engine is what almost every language ships: it tries one
 * alternative, and on failure returns and tries the next. On `(a+)+b` against
 * a string of a's, the number of ways to split the a's between the inner and
 * outer plus is exponential, and the engine tries all of them before
 * concluding there is no b. That is ReDoS - a denial-of-service primitive that
 * arrives as a one-line configuration change.
 *
 * The Thompson simulation keeps a SET of NFA states and advances all of them
 * together, one character at a time. There is no backtracking to do because
 * there is nothing to return to: every alternative is already in the set. The
 * cost is O(states x length), which is linear in the input for a fixed
 * pattern, and it is the design RE2 and Go's regexp are built on.
 *
 * The trade is real and this module does not hide it: the state-set engine
 * here supports no capture groups and no backreferences, because a set of
 * positions does not remember which path it took.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.RegexEngine = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function emptyReport() {
    return { steps: 0, states: 0, transitions: 0, backtracks: 0, exhausted: false,
      setSizePeak: 0, parseNodes: 0 };
  }

  /* ---------------------------------------------------------------- parser */

  /**
   * A recursive-descent parser for the subset: concatenation, `|`, `*`, `+`,
   * `?`, parentheses, `.` and literals. No character classes, no anchors, no
   * captures - the subset is chosen so that both engines can support all of
   * it, which is what makes the comparison honest.
   */
  function parse(pattern, options) {
    const report = (options || {}).report || emptyReport();
    const state = { at: 0, source: pattern, report: report };
    const node = parseAlternation(state);

    if (state.at < pattern.length) throw new Error('unexpected "' + pattern[state.at] + '"');
    return node;
  }

  function parseAlternation(state) {
    let node = parseConcat(state);

    while (state.source[state.at] === '|') {
      state.at += 1;
      state.report.parseNodes += 1;
      node = { kind: 'alt', left: node, right: parseConcat(state) };
    }
    return node;
  }

  function parseConcat(state) {
    let node = null;

    while (state.at < state.source.length && state.source[state.at] !== '|' &&
      state.source[state.at] !== ')') {
      const piece = parseRepeat(state);

      node = node === null ? piece : { kind: 'concat', left: node, right: piece };
    }
    return node === null ? { kind: 'empty' } : node;
  }

  function parseRepeat(state) {
    let node = parseAtom(state);

    for (;;) {
      const symbol = state.source[state.at];

      if (symbol !== '*' && symbol !== '+' && symbol !== '?') return node;
      state.at += 1;
      state.report.parseNodes += 1;
      node = { kind: symbol === '*' ? 'star' : (symbol === '+' ? 'plus' : 'optional'), body: node };
    }
  }

  function parseAtom(state) {
    const symbol = state.source[state.at];

    state.report.parseNodes += 1;

    if (symbol === '(') {
      state.at += 1;
      const inner = parseAlternation(state);

      if (state.source[state.at] !== ')') throw new Error('unclosed group');
      state.at += 1;
      return inner;
    }

    if (symbol === '.') { state.at += 1; return { kind: 'any' }; }
    state.at += 1;
    return { kind: 'char', value: symbol };
  }

  /* ------------------------------------------------------ Thompson NFA */

  /**
   * Thompson's construction: every node becomes a fragment with one entry and
   * a set of dangling exits, and the fragments compose. `split` states have
   * two epsilon successors and no character, which is where the
   * non-determinism lives.
   */
  function compile(node, options) {
    const report = (options || {}).report || emptyReport();
    const states = [];
    const add = function (state) { states.push(state); return states.length - 1; };
    const accept = add({ kind: 'accept' });
    const start = build(node, accept, { add: add, states: states });

    report.states = states.length;
    return { states: states, start: start, accept: accept, report: report };
  }

  function build(node, next, context) {
    if (node.kind === 'empty') return next;

    if (node.kind === 'char') return context.add({ kind: 'char', value: node.value, next: next });

    if (node.kind === 'any') return context.add({ kind: 'any', next: next });

    if (node.kind === 'concat') return build(node.left, build(node.right, next, context), context);

    if (node.kind === 'alt') {
      return context.add({ kind: 'split', a: build(node.left, next, context),
        b: build(node.right, next, context) });
    }
    return buildRepeat(node, next, context);
  }

  /** The three repeats, each a split with a loop back into the body. */
  function buildRepeat(node, next, context) {
    if (node.kind === 'optional') {
      return context.add({ kind: 'split', a: build(node.body, next, context), b: next });
    }
    const split = context.add({ kind: 'split', a: -1, b: next });
    const body = build(node.body, split, context);

    context.states[split].a = body;

    if (node.kind === 'star') return split;
    return body;
  }

  /**
   * Simulate the NFA over the input, carrying the whole reachable state set.
   * `setSizePeak` is the number that explains the cost: it is bounded by the
   * state count, which is bounded by the pattern length, so the work per input
   * character is bounded by the PATTERN and not by the input.
   */
  function simulate(program, text, options) {
    const report = (options || {}).report || emptyReport();
    let current = closureOf(program, [program.start], report);

    if (current.has(program.accept) && text.length === 0) {
      return { matched: true, report: report };
    }

    for (let i = 0; i < text.length; i += 1) {
      const next = [];

      current.forEach(function (id) {
        const state = program.states[id];

        report.steps += 1;

        if (state.kind === 'any' || (state.kind === 'char' && state.value === text[i])) {
          next.push(state.next);
          report.transitions += 1;
        }
      });
      current = closureOf(program, next, report);
      report.setSizePeak = Math.max(report.setSizePeak, current.size);

      if (current.size !== 0) continue;
      return { matched: false, report: report };
    }
    return { matched: current.has(program.accept), report: report };
  }

  /** Epsilon closure, iteratively - a deep pattern would blow a recursive one. */
  function closureOf(program, seeds, report) {
    const out = new Set();
    const stack = seeds.slice();

    while (stack.length) {
      const id = stack.pop();

      if (out.has(id)) continue;
      out.add(id);
      const state = program.states[id];

      report.steps += 1;

      if (state.kind !== 'split') continue;
      stack.push(state.a);
      stack.push(state.b);
    }
    return out;
  }

  /* ------------------------------------------------------- backtracking */

  /**
   * The engine everybody ships. `budget` exists because the whole point is
   * that this can take exponential time, and a demo that hangs teaches
   * nothing - `exhausted` in the report is the interesting outcome rather
   * than an error.
   */
  function backtrack(node, text, options) {
    const settings = options || {};
    const report = settings.report || emptyReport();
    const budget = settings.budget || 2000000;
    const matched = tryNode(node, text, 0, { report: report, budget: budget,
      done: function (at) { return at === text.length; } });

    return { matched: matched !== null, report: report, at: matched };
  }

  /**
   * Match `node` starting at `at`, then hand the rest to `context.done`. The
   * continuation is what makes backtracking backtracking: every alternative is
   * tried against the whole remainder before the next is considered.
   */
  function tryNode(node, text, at, context) {
    context.report.steps += 1;

    if (context.report.steps > context.budget) { context.report.exhausted = true; return null; }

    if (node.kind === 'empty') return context.done(at) ? at : null;

    if (node.kind === 'char') {
      if (text[at] !== node.value) return null;
      return context.done(at + 1) ? at + 1 : null;
    }

    if (node.kind === 'any') {
      if (at >= text.length) return null;
      return context.done(at + 1) ? at + 1 : null;
    }
    return tryComposite(node, text, at, context);
  }

  function tryComposite(node, text, at, context) {
    if (node.kind === 'concat') {
      return tryNode(node.left, text, at, { report: context.report, budget: context.budget,
        done: function (mid) {
          return tryNode(node.right, text, mid, context) !== null;
        } }) === null ? null : at;
    }

    if (node.kind === 'alt') {
      const left = tryNode(node.left, text, at, context);

      if (left !== null) return left;
      context.report.backtracks += 1;
      return tryNode(node.right, text, at, context);
    }
    return tryRepeat(node, text, at, context);
  }

  /** Greedy: take as many as possible, then give one back at a time. */
  function tryRepeat(node, text, at, context) {
    if (node.kind === 'optional') {
      const taken = tryNode(node.body, text, at, context);

      if (taken !== null) return taken;
      context.report.backtracks += 1;
      return context.done(at) ? at : null;
    }
    const once = tryNode(node.body, text, at, { report: context.report, budget: context.budget,
      done: function (mid) {
        if (mid === at) return false;
        return tryRepeat({ kind: 'star', body: node.body }, text, mid, context) !== null;
      } });

    if (once !== null) return once;
    context.report.backtracks += 1;

    if (node.kind === 'plus') return null;
    return context.done(at) ? at : null;
  }

  /* -------------------------------------------------------- the fixtures */

  /** `(a+)+b` against a's: the canonical ReDoS pattern, and the one that
   *  arrives in a config file as an innocent-looking validation rule. */
  function pathological(length) {
    return { pattern: '(a+)+b', text: 'a'.repeat(length) };
  }

  /** `(a|a)*b`: the same exponential, with the ambiguity written out. */
  function ambiguousAlternation(length) {
    return { pattern: '(a|a)*b', text: 'a'.repeat(length) };
  }

  /** Both engines on one input, with the step counts side by side. */
  function compare(pattern, text, options) {
    const settings = options || {};
    const node = parse(pattern, {});
    const backReport = emptyReport();
    const back = backtrack(node, text, { report: backReport, budget: settings.budget || 2000000 });
    const nfaReport = emptyReport();
    const program = compile(node, { report: nfaReport });
    const nfa = simulate(program, text, { report: nfaReport });

    return { pattern: pattern, length: text.length,
      backtrackSteps: backReport.steps, backtrackMatched: back.matched,
      exhausted: backReport.exhausted,
      nfaSteps: nfaReport.steps, nfaMatched: nfa.matched, nfaStates: nfaReport.states,
      setSizePeak: nfaReport.setSizePeak,
      agree: backReport.exhausted ? null : back.matched === nfa.matched };
  }

  return {
    emptyReport: emptyReport, parse: parse, compile: compile, simulate: simulate,
    backtrack: backtrack, compare: compare,
    pathological: pathological, ambiguousAlternation: ambiguousAlternation
  };
}));

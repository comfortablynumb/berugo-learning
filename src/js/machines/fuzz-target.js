/**
 * FuzzTarget - the Berugo front end, wrapped so a fuzzer can drive it.
 *
 * A coverage-guided fuzzer needs two things from a target and they are not
 * equally easy. The first is a COVERAGE signal: something that says "this
 * input reached behaviour the corpus had not reached", which is what turns
 * random mutation into a search. The second is an ORACLE: something that says
 * this run was wrong. Without one, the only bug a fuzzer can find is a crash,
 * and most bugs are not crashes.
 *
 * Three oracles are wired here and reported separately, because they find
 * different things:
 *
 * - **crash** — a stage recorded an exception. The front end's contract is to
 *   REPORT errors, not to raise them, so any input that makes it throw is a
 *   bug however malformed the input is.
 * - **differential** — `Pipeline.purity` runs the same source twice and
 *   compares every stage's fingerprint. A stage that carries state between
 *   runs, a module-level counter for fresh type variables being the classic
 *   one, disagrees with itself.
 * - **invariant** — `Pipeline.spanAudit` checks that every node's span lies
 *   inside the source and every synthesised node names the construct it stands
 *   for, which is what keeps a diagnostic pointing at something a developer
 *   typed.
 *
 * The coverage signal is a behavioural fingerprint rather than instrumented
 * edges: the stages reached, whether each produced diagnostics, the diagnostic
 * codes, the token kinds and the node kinds. That is coarser than an
 * instrumented build and it is measured on the same axis a real fuzzer uses —
 * new behaviour, not new input.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.FuzzTarget = api;
}(this, function (root) {
  'use strict';

  const Pipeline = root && root.Berugo && root.Berugo.Pipeline
    ? root.Berugo.Pipeline : require('./berugo/pipeline.js');

  function edgesOf(result) {
    const edges = {};

    result.stages.forEach(function (stage) {
      edges['stage:' + stage.id] = true;
      if (stage.errors) edges['stage:' + stage.id + ':errors'] = true;
      if (stage.crashed) edges['stage:' + stage.id + ':crash'] = true;
    });
    (result.diagnostics.kept || []).forEach(function (row) {
      edges['diag:' + row.code] = true;
    });
    collectTokens(result, edges);
    collectNodes(result, edges);
    return Object.keys(edges).sort();
  }

  function collectTokens(result, edges) {
    const lex = result.artefacts.lex;

    if (!lex || !lex.tokens) return;
    lex.tokens.forEach(function (token) { edges['token:' + token.kind] = true; });
  }

  function collectNodes(result, edges) {
    const parse = result.artefacts.parse;

    if (!parse || !parse.tree) return;
    walkNode(parse.tree, edges, new Set());
  }

  /* The visited set is not an optimisation. A tree whose nodes reference each
     other - a parent pointer, a shared type node, a binding that names its
     scope - turns this walk into an exponential re-visit, and the first
     version of it hung on `let x = 1;`. */
  function walkNode(node, edges, seen) {
    if (!node || typeof node !== 'object' || seen.has(node)) return;
    seen.add(node);
    if (node.kind) edges['node:' + node.kind] = true;
    Object.keys(node).forEach(function (key) {
      const value = node[key];

      if (Array.isArray(value)) {
        value.forEach(function (child) { walkNode(child, edges, seen); });
        return;
      }
      if (value && typeof value === 'object' && key !== 'span') {
        walkNode(value, edges, seen);
      }
    });
  }

  /* ---------------------------------------------------------- the oracles */

  function crashOf(result) {
    const crashed = result.stages.filter(function (stage) { return stage.crashed; });

    if (!crashed.length) return null;
    return { verdict: 'crash', detail: crashed[0].id + ' threw: ' + crashed[0].crashed };
  }

  /* A stage that crashed leaves no artefact, so the two later oracles have
     nothing to read - and calling them anyway is how an oracle turns into a
     crash of its own, which a fuzzer would then report as a finding. */
  function deeperOracles(input, result) {
    if (!result.artefacts.parse || !result.artefacts.parse.tree) return null;
    const spans = safely(function () { return Pipeline.spanAudit(input, {}); });

    if (spans.threw) return { verdict: 'oracle', detail: 'the span audit threw: ' + spans.why };
    if (!spans.value.ok) {
      return { verdict: 'invariant',
        detail: spans.value.problems[0].kind + ': ' + spans.value.problems[0].why };
    }
    const pure = safely(function () { return Pipeline.purity(input, {}); });

    if (pure.threw) return { verdict: 'oracle', detail: 'the purity check threw: ' + pure.why };
    if (!pure.value.ok) {
      return { verdict: 'differential',
        detail: 'these stages disagree with themselves: ' + pure.value.differing.join(', ') };
    }
    return null;
  }

  function safely(fn) {
    try {
      return { threw: false, value: fn() };
    } catch (problem) {
      return { threw: true, why: String(problem && problem.message || problem) };
    }
  }

  /**
   * One input, one verdict, one coverage set. The coverage is computed even
   * when a stage crashed, because "reached the parser and fell over" is a
   * behaviour worth keeping in the corpus.
   */
  function frontEnd(input) {
    const attempt = safely(function () { return Pipeline.run(input, {}); });

    if (attempt.threw) {
      return { coverage: ['stage:lex', 'harness:threw'], verdict: 'crash',
        detail: 'the pipeline itself threw: ' + attempt.why };
    }
    const result = attempt.value;
    const coverage = edgesOf(result);
    const found = crashOf(result) || deeperOracles(input, result);

    if (found) return { coverage: coverage, verdict: found.verdict, detail: found.detail };
    return { coverage: coverage, verdict: 'ok',
      detail: result.diagnostics.kept.length + ' diagnostics reported' };
  }


  /* ------------------------------------------- a target with planted bugs */

  const OPEN = '([{';
  const CLOSE = ')]}';

  /**
   * The thing under test: bracket matching by DEPTH COUNTING rather than with
   * a stack. It is wrong in a way that does not crash - `[)` counts as
   * balanced, because a counter cannot tell one bracket from another - and it
   * also has a planted crash at a nesting depth of seven, standing in for the
   * fixed-size buffer every real parser has somewhere.
   *
   * Both defects are here on purpose: they are the two halves of the oracle
   * problem, and a fuzzer with only a crash oracle finds exactly one of them.
   */
  function counted(input) {
    let depth = 0;

    for (let at = 0; at < input.length; at += 1) {
      const ch = input[at];

      if (OPEN.indexOf(ch) !== -1) {
        depth += 1;
        if (depth > 6) throw new Error('nesting deeper than 6');
        continue;
      }
      if (CLOSE.indexOf(ch) === -1) continue;
      depth -= 1;
      if (depth < 0) return false;
    }
    return depth === 0;
  }

  /** The reference: a stack, which knows which bracket it opened. */
  function stacked(input) {
    const stack = [];

    for (let at = 0; at < input.length; at += 1) {
      const ch = input[at];

      if (OPEN.indexOf(ch) !== -1) { stack.push(CLOSE[OPEN.indexOf(ch)]); continue; }
      if (CLOSE.indexOf(ch) === -1) continue;
      if (stack.pop() !== ch) return false;
    }
    return stack.length === 0;
  }

  function bracketCoverage(input, answer) {
    const edges = {};
    let depth = 0;

    edges['verdict:' + answer] = true;
    let deepest = 0;

    for (let at = 0; at < input.length; at += 1) {
      const ch = input[at];

      if (OPEN.indexOf(ch) !== -1) { depth += 1; deepest = Math.max(deepest, depth); }
      if (CLOSE.indexOf(ch) !== -1) depth -= 1;
      if (OPEN.indexOf(ch) !== -1 || CLOSE.indexOf(ch) !== -1) edges['char:' + ch] = true;
    }
    edges['depth:' + deepest] = true;
    return Object.keys(edges).sort();
  }

  /**
   * The same target under different oracles, which is the measurement the
   * section is about. `oracles` may hold 'crash' and 'differential'; with only
   * the first, the wrong answers are invisible however many of them the fuzzer
   * produces.
   */
  function brackets(input, options) {
    const settings = options || {};
    const oracles = settings.oracles || ['crash', 'differential'];
    const attempt = safely(function () { return counted(input); });

    if (attempt.threw) {
      return { coverage: ['crash:' + attempt.why], verdict: 'crash', detail: attempt.why };
    }
    const coverage = bracketCoverage(input, attempt.value);
    const truth = stacked(input);

    if (oracles.indexOf('differential') !== -1 && attempt.value !== truth) {
      return { coverage: coverage, verdict: 'differential',
        detail: 'counting says ' + attempt.value + ', the stack says ' + truth };
    }
    return { coverage: coverage, verdict: 'ok', detail: 'both agree: ' + truth };
  }

  return { frontEnd: frontEnd, edgesOf: edgesOf, safely: safely,
    brackets: brackets, counted: counted, stacked: stacked };
}));

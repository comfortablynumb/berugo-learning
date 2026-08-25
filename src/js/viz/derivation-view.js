/**
 * Proof trees, drawn the way a textbook draws them: premises in a row above a
 * horizontal rule, the conclusion below it, the rule name at the right.
 *
 * The shape is the argument. A derivation printed as an indented list reads as
 * a call trace; printed as a rule stack it reads as a proof, and the reader can
 * see at a glance which premise is doing the work and how deep the argument
 * goes. Nested flexbox does the layout — no measurement, no SVG, and it
 * reflows in a narrow column instead of overflowing.
 *
 * The same renderer takes typing derivations, big-step evaluations, instance
 * resolutions and verification obligations, because all four are the same
 * thing: a node with a rule name, a statement, and premises.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.DerivationView = api;
}(this, function () {
  'use strict';

  const MAX_DEPTH = 9;
  const MAX_NODES = 220;

  function escapeText(text) {
    return String(text === undefined || text === null ? '' : text)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Normalise the four shapes into one. Callers pass `read`, which pulls a
   * `{ rule, statement, children, ok, note }` out of whatever node they have;
   * the default handles the common `{ rule, judgement, children, ok, why }`.
   */
  function defaultRead(node) {
    return { rule: node.rule || '', ok: node.ok !== false,
      statement: node.judgement || node.goal || node.term || '',
      note: node.why || node.note || '', children: node.children || [] };
  }

  function markup(node, options) {
    const settings = options || {};
    const read = settings.read || defaultRead;
    const budget = { nodes: 0, truncated: false };
    const body = renderNode(node, { read: read, depth: 0, budget: budget,
      maxDepth: settings.maxDepth || MAX_DEPTH });

    return '<div class="derivation">' + body + (budget.truncated
      ? '<p class="derivation-truncated">the derivation continues past the '
        + 'depth this view draws</p>' : '') + '</div>';
  }

  function renderNode(node, context) {
    const parts = context.read(node);

    context.budget.nodes += 1;
    if (context.depth >= context.maxDepth || context.budget.nodes > MAX_NODES) {
      context.budget.truncated = true;
      return conclusionOnly(parts, true);
    }
    const premises = parts.children.map(function (child) {
      return renderNode(child, { read: context.read, depth: context.depth + 1,
        budget: context.budget, maxDepth: context.maxDepth });
    });

    if (premises.length === 0) return conclusionOnly(parts, false);
    return withPremises(parts, premises);
  }

  function conclusionOnly(parts, elided) {
    return '<div class="derivation-step' + (parts.ok ? '' : ' derivation-bad') + '">'
      + '<div class="derivation-premises derivation-axiom">'
      + (elided ? '⋮' : '') + '</div>'
      + bar(parts) + conclusion(parts) + '</div>';
  }

  function withPremises(parts, premises) {
    return '<div class="derivation-step' + (parts.ok ? '' : ' derivation-bad') + '">'
      + '<div class="derivation-premises">' + premises.join('') + '</div>'
      + bar(parts) + conclusion(parts) + '</div>';
  }

  function bar(parts) {
    return '<div class="derivation-bar"><span class="derivation-rule">'
      + escapeText(parts.rule) + '</span></div>';
  }

  function conclusion(parts) {
    return '<div class="derivation-conclusion">' + escapeText(parts.statement)
      + (parts.note ? '<span class="derivation-note">' + escapeText(parts.note)
        + '</span>' : '') + '</div>';
  }

  /* ------------------------------------------------------- decision trees */

  /**
   * A decision tree is not a proof, so it gets a different shape: an indented
   * list of tests, each branch labelled with the constructor that takes it.
   * Same data, different question — "what does this test next" rather than
   * "what justifies this".
   */
  function treeMarkup(node, options) {
    const settings = options || {};
    const columns = settings.columns || [];

    return '<ul class="decision-tree">' + treeNode(node, columns, '') + '</ul>';
  }

  function treeNode(node, columns, label) {
    if (node.kind === 'leaf') {
      return item(label, '<span class="decision-leaf">clause ' + node.clause + '</span>');
    }
    if (node.kind === 'fail') {
      return item(label, '<span class="decision-fail">no match</span>');
    }
    return item(label, switchBody(node, columns));
  }

  function switchBody(node, columns) {
    const name = columns[node.column] === undefined
      ? 'column ' + node.column : columns[node.column];
    const branches = node.cases.map(function (entry) {
      return treeNode(entry.tree, columns, entry.name);
    }).concat(node.fallback ? [treeNode(node.fallback, columns, 'otherwise')] : []);

    return '<span class="decision-test">test ' + escapeText(name) + '</span>'
      + '<ul class="decision-branches">' + branches.join('') + '</ul>';
  }

  function item(label, body) {
    return '<li class="decision-node">'
      + (label ? '<span class="decision-label">' + escapeText(label) + '</span>' : '')
      + body + '</li>';
  }

  /* --------------------------------------------------------- step traces */

  /** A reduction trace: one row per step, the rule that fired at the right. */
  function traceMarkup(trace, options) {
    const settings = options || {};
    const limit = settings.limit || 24;
    const rows = trace.slice(0, limit).map(function (entry) {
      return '<li class="trace-step"><span class="trace-index">' + entry.step
        + '</span><code class="trace-term">' + escapeText(entry.term)
        + '</code><span class="trace-rule">' + escapeText(entry.rule || '')
        + '</span></li>';
    });

    return '<ol class="trace-list">' + rows.join('')
      + (trace.length > limit ? '<li class="trace-step trace-more">'
        + (trace.length - limit) + ' more steps not shown</li>' : '') + '</ol>';
  }

  function render(host, html) {
    if (!host || typeof host.html !== 'function') return { host: host };
    host.html(html);
    return { host: host };
  }

  return {
    markup: markup, treeMarkup: treeMarkup, traceMarkup: traceMarkup,
    render: render, escapeText: escapeText, defaultRead: defaultRead,
    MAX_DEPTH: MAX_DEPTH, MAX_NODES: MAX_NODES
  };
}));

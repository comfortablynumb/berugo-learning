/**
 * AstView — a syntax tree beside the text it came from, linked both ways.
 *
 * Rendered as HTML, not SVG, and for the same reason `MatrixView` is: the
 * useful thing here is not a picture of a tree but the correspondence between
 * a node and a range of characters. That wants selectable text, a scrollbar on
 * a narrow screen, and a `data-span` on every row so a click can be turned
 * back into two offsets. A drawing of eighty circles gives none of it.
 *
 * The tree is indented rather than drawn, which also means a program with a
 * hundred nodes stays readable — the depth is the indent and the reading order
 * is the source order, which is the order a reader already has in their head.
 *
 * Nothing here knows what Berugo is. It takes rows of `{ depth, label, detail,
 * span, synthetic }` and a source string, and the section builds those.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AstView = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const MAX_ROWS = 160;

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /**
   * Flatten a tree into display rows. `childrenOf` is passed in rather than
   * assumed, so this renderer works for the surface tree, the core tree and
   * anything else with children.
   */
  function rows(tree, options) {
    const settings = options || {};
    const out = [];

    walk(tree, 0, out, settings);
    return out;
  }

  function walk(node, depth, out, settings) {
    if (!node || out.length >= MAX_ROWS) return;
    out.push({ depth: depth, label: settings.label(node), detail: settings.detail(node),
      span: node.span, synthetic: node.origin !== undefined, node: node });
    settings.childrenOf(node).forEach(function (child) {
      walk(child, depth + 1, out, settings);
    });
  }

  /* ----------------------------------------------------------------- markup */

  function treeMarkup(list, options) {
    const settings = options || {};
    const shown = list.slice(0, MAX_ROWS);

    return '<div class="ast-tree">' + shown.map(function (row, index) {
      return rowMarkup(row, index, settings);
    }).join('') + '</div>' + overflowNote(list.length);
  }

  function rowMarkup(row, index, settings) {
    const selected = settings.selected === index ? ' is-selected' : '';
    const synthetic = row.synthetic ? ' is-synthetic' : '';

    return '<button type="button" class="ast-node' + selected + synthetic +
      '" data-index="' + index + '" data-start="' + spanStart(row) +
      '" data-end="' + spanEnd(row) + '" style="padding-left:' +
      (0.35 + row.depth * 0.85) + 'rem">' +
      '<span class="ast-kind">' + escapeHtml(row.label) + '</span>' +
      (row.detail ? '<span class="ast-detail">' + escapeHtml(row.detail) + '</span>' : '') +
      '<span class="ast-span">' + spanStart(row) + '–' + spanEnd(row) + '</span>' +
      '</button>';
  }

  function spanStart(row) { return row.span ? row.span.start : 0; }
  function spanEnd(row) { return row.span ? row.span.end : 0; }

  function overflowNote(total) {
    if (total <= MAX_ROWS) return '';
    return '<p class="note">' + MAX_ROWS + ' of ' + total +
      ' nodes shown — the rest are below the fold rather than absent.</p>';
  }

  /**
   * The source with one range marked. Three slices rather than a regex,
   * because the range is given in offsets and offsets are what the compiler
   * produced — converting to a pattern and back is where an off-by-one gets
   * in.
   */
  function sourceMarkup(source, span) {
    if (!span || span.end <= span.start) return '<pre class="ast-source">' +
      escapeHtml(source) + '</pre>';
    const start = Math.max(0, Math.min(span.start, source.length));
    const end = Math.max(start, Math.min(span.end, source.length));

    return '<pre class="ast-source">' + escapeHtml(source.slice(0, start)) +
      '<mark class="ast-mark">' + escapeHtml(source.slice(start, end)) + '</mark>' +
      escapeHtml(source.slice(end)) + '</pre>';
  }

  /** The source with several ranges marked — what references and rename need. */
  function multiMarkup(source, spans) {
    const ordered = (spans || []).slice().filter(function (span) {
      return span && span.end > span.start;
    }).sort(function (a, b) { return a.start - b.start; });
    let at = 0;
    let out = '';

    ordered.forEach(function (span) {
      if (span.start < at) return;
      out += escapeHtml(source.slice(at, span.start)) + '<mark class="ast-mark">'
        + escapeHtml(source.slice(span.start, span.end)) + '</mark>';
      at = span.end;
    });
    return '<pre class="ast-source">' + out + escapeHtml(source.slice(at)) + '</pre>';
  }

  /**
   * The token stream as chips. Trivia is shown as its own faint chip rather
   * than dropped, because "trivia is preserved" is a claim the section makes
   * and a reader should be able to see it rather than take it on trust.
   */
  function tokenMarkup(tokens, options) {
    const settings = options || {};
    const limit = settings.limit || 120;

    return '<div class="token-strip">' + tokens.slice(0, limit).map(function (token) {
      return (settings.trivia === false ? '' : triviaChips(token))
        + '<span class="token-chip token-' + escapeHtml(token.kind) + '">'
        + '<span class="token-kind">' + escapeHtml(token.kind) + '</span>'
        + '<span class="token-text">' + escapeHtml(token.text || '') + '</span></span>';
    }).join('') + '</div>' + (tokens.length > limit
      ? '<p class="note">' + limit + ' of ' + tokens.length + ' tokens shown.</p>' : '');
  }

  function triviaChips(token) {
    return (token.trivia || []).map(function (entry) {
      return '<span class="token-chip token-trivia"><span class="token-kind">'
        + escapeHtml(entry.kind) + '</span><span class="token-text">'
        + escapeHtml(visibleTrivia(entry.text || '')) + '</span></span>';
    }).join('');
  }

  /** Whitespace has no glyph, so it renders as a column that looks empty. */
  function visibleTrivia(text) {
    return text.replace(/\n/g, '⏎').replace(/\t/g, '→').replace(/ /g, '·');
  }

  /**
   * A diagnostic rendered the way a terminal renders one: the line, then a
   * caret run under exactly the characters at fault. `format` supplies both;
   * this only puts them in a box.
   */
  function diagnosticMarkup(formatted) {
    return '<div class="diagnostic-block"><div class="diagnostic-head">' +
      escapeHtml(formatted.heading) + '</div>' +
      '<pre class="diagnostic-code">' + escapeHtml(formatted.text) + '\n' +
      escapeHtml(formatted.caret) + '</pre>' +
      '<p class="diagnostic-message">' + escapeHtml(formatted.message) + '</p>' +
      (formatted.note ? '<p class="note">' + escapeHtml(formatted.note) + '</p>' : '') +
      '</div>';
  }

  function render(host, html) {
    if (!host) return null;
    host.innerHTML = html;
    return { host: host };
  }

  return {
    MAX_ROWS: MAX_ROWS,
    rows: rows, treeMarkup: treeMarkup, sourceMarkup: sourceMarkup,
    multiMarkup: multiMarkup, tokenMarkup: tokenMarkup,
    diagnosticMarkup: diagnosticMarkup, visibleTrivia: visibleTrivia,
    escapeHtml: escapeHtml, render: render
  };
}));

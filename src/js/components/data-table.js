/**
 * DataTable - the one table helper.
 *
 * Almost every section renders the same three things: a card with a table in
 * it, rows of escaped cells, and a caption underneath saying what the rows
 * mean. Twenty-eight sections grew their own private copy of that code before
 * this file existed, which is twenty-eight places where the escaping could be
 * forgotten. New sections use this one.
 *
 * The caption is not optional decoration. A table of numbers with no sentence
 * saying what they are is the single most common way a demo stops teaching
 * anything, so `markup` always emits the paragraph and `caption` always has
 * somewhere to put the text.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.DataTable = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  function esc(value) {
    return scope.Helpers.escapeHtml(String(value));
  }

  /** A card with a titled table and an empty caption, ready for `fill`. */
  function markup(options) {
    const settings = options || {};
    const spacing = settings.first ? '' : ' style="margin-top:.875rem"';

    return '<div class="card"' + spacing + '>' +
      '<div class="card-header">' + esc(settings.title) + '</div>' +
      '<div class="card-body"><table class="ref-table" id="' + settings.id + '"><thead><tr>' +
      (settings.columns || []).map(function (name) {
        return '<th>' + esc(name) + '</th>';
      }).join('') +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="' + settings.id + '-caption"></p></div></div>';
  }

  /**
   * Replace a table's body with rows of cells.
   *
   * A cell may be a plain value or `{ value, className }` - the second form is
   * for the one thing worth colouring, which is a row that is the answer to the
   * question the table was asked. Everything is escaped either way.
   */
  function fill(id, rows) {
    scope.jQuery('#' + id + ' tbody').html((rows || []).map(function (cells) {
      return '<tr>' + cells.map(cell).join('') + '</tr>';
    }).join(''));
  }

  function cell(value) {
    if (value && typeof value === 'object' && value.value !== undefined) {
      return '<td class="' + esc(value.className || '') + '">' + esc(value.value) + '</td>';
    }
    return '<td>' + esc(value) + '</td>';
  }

  function caption(id, text) {
    scope.Helpers.setText(id + '-caption', text);
  }

  /** A table and its caption in one call, which is how a section usually wants
   *  to think about it. */
  function paint(id, rows, text) {
    fill(id, rows);
    if (text !== undefined) caption(id, text);
  }

  return { markup: markup, fill: fill, caption: caption, paint: paint };
}));

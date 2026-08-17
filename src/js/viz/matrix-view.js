/**
 * MatrixView - the table renderer for the structures that *are* tables: suffix
 * arrays with their ranks and LCPs, BWT rotation matrices, and the
 * dynamic-programming rows a Levenshtein automaton carries.
 *
 * Rendered as HTML rather than SVG on purpose. These are tables: they need to
 * be selectable, scrollable on a narrow screen, and readable by a screen
 * reader, and none of that comes free in SVG. What the renderer adds over a
 * plain `<table>` is the cell-level highlighting the sections need - a
 * character range inside a row, a column, a single cell - which is where the
 * teaching is.
 *
 * The caller passes plain data; nothing here knows what a suffix array is.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.MatrixView = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const MAX_ROWS = 40;

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /** A control character has no glyph, so the sentinel would render as nothing
   *  at all and the reader would see a column that mysteriously sorts first. */
  function display(value) {
    const text = String(value);
    let out = '';
    for (let i = 0; i < text.length; i += 1) {
      const code = text.charCodeAt(i);
      out += code < 32 ? '␀' : text[i];
    }
    return out;
  }

  function cellClass(cell) {
    const classes = ['matrix-cell'];
    if (cell && cell.highlight) classes.push('matrix-cell-lit');
    if (cell && cell.muted) classes.push('matrix-cell-muted');
    if (cell && cell.mono !== false) classes.push('mono');
    return classes.join(' ');
  }

  function cellMarkup(cell) {
    const value = cell && typeof cell === 'object' ? cell.value : cell;
    const title = cell && cell.title ? ' title="' + escapeHtml(cell.title) + '"' : '';
    return '<td class="' + cellClass(cell) + '"' + title + '>' + escapeHtml(display(value)) + '</td>';
  }

  /** A string rendered one character per cell, so a range inside it can be
   *  highlighted - the LCP overlap, the matched prefix, the active edge. */
  function charCells(text, options) {
    const settings = options || {};
    const from = settings.from === undefined ? -1 : settings.from;
    const to = settings.to === undefined ? -1 : settings.to;

    return text.split('').map(function (symbol, at) {
      return { value: symbol, highlight: at >= from && at < to, mono: true };
    });
  }

  /** rows: [{ cells: [...], note }]. columns: [string]. */
  function markup(options) {
    const settings = options || {};
    const rows = settings.rows || [];
    const limit = settings.maxRows || MAX_ROWS;
    const shown = rows.slice(0, limit);

    const head = (settings.columns || []).map(function (column) {
      return '<th scope="col" class="matrix-head">' + escapeHtml(column) + '</th>';
    }).join('');

    const body = shown.map(function (row) {
      const cells = (row.cells || []).map(cellMarkup).join('');
      const attrs = row.highlight ? ' class="matrix-row-lit"' : '';
      return '<tr' + attrs + '>' + cells + '</tr>';
    }).join('');

    const omitted = rows.length - shown.length;
    const caption = omitted > 0
      ? '<p class="note">' + omitted + ' further rows are not drawn.</p>'
      : '';

    return '<div class="matrix-scroll"><table class="matrix-table">' +
      (head ? '<thead><tr>' + head + '</tr></thead>' : '') +
      '<tbody>' + body + '</tbody></table></div>' + caption;
  }

  /** The suffix-array table: rank, start, LCP and the suffix itself, with the
   *  LCP overlap with the previous row highlighted - which makes the LCP array
   *  self-evidently what it is rather than a column of numbers. */
  function suffixRows(options) {
    const settings = options || {};
    const text = settings.text || '';
    const sa = settings.sa || [];
    const lcp = settings.lcp || [];
    const width = settings.width || 24;

    return sa.map(function (start, rank) {
      const suffix = text.slice(start, start + width);
      const overlap = lcp[rank] || 0;
      return {
        highlight: settings.highlight === rank,
        cells: [
          { value: rank },
          { value: start },
          { value: overlap },
          { value: display(suffix) + (start + width < text.length ? '…' : ''), highlight: overlap > 0 }
        ]
      };
    });
  }

  /** The rotation matrix, with the first and last columns marked - the two
   *  the LF mapping relates. */
  function rotationRows(rotations, options) {
    const settings = options || {};
    return rotations.map(function (rotation, at) {
      return {
        highlight: settings.highlight === at,
        cells: [{ value: at }].concat(charCells(rotation, {
          from: 0, to: 1
        }).map(function (cell, i) {
          if (i === rotation.length - 1) return { value: cell.value, highlight: true, mono: true };
          return cell;
        }))
      };
    });
  }

  function render(host, options) {
    const settings = options || {};
    if (!host) return null;
    host.innerHTML = markup(settings);
    return { host: host, rows: (settings.rows || []).length };
  }

  return {
    markup: markup,
    render: render,
    charCells: charCells,
    suffixRows: suffixRows,
    rotationRows: rotationRows,
    display: display,
    MAX_ROWS: MAX_ROWS
  };
}));

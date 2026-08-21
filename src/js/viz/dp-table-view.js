/**
 * DpTableView - the DP table, drawn, because in this milestone the table *is*
 * the explanation.
 *
 * HTML rather than SVG, for the reasons `MatrixView` gives: a DP table is a
 * table, and it needs to be selectable, scrollable and readable. What this
 * adds over `MatrixView` is the three things a DP table needs that a suffix
 * array does not:
 *
 *   - **a traceback path**, so the answer's provenance is visible rather than
 *     only its value;
 *   - **dependency marks** on the cells the active cell was computed from,
 *     which is what makes "two incoming edges" concrete;
 *   - **a fill order**, so the diagonal sweep of an interval DP and the
 *     row-major sweep of a knapsack look as different as they are.
 *
 * A table is capped at `MAX_CELLS` and says how much was dropped. A 2 000 x
 * 2 000 edit-distance table is four million `<td>` elements, which is not a
 * slow render - it is a dead tab. The cap is on cells rather than on rows
 * because the failure is the product, and a 4-row 100 000-column table is the
 * same disaster as the square one.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.DpTableView = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const MAX_CELLS = 4000;
  const MAX_SIDE = 60;

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /** Infinity is not a number a learner should read as one. */
  function display(value) {
    if (value === Infinity) return '∞';

    if (value === -Infinity) return '−∞';

    if (value === null || value === undefined) return '·';

    if (typeof value === 'number' && !Number.isInteger(value)) return value.toFixed(2);
    return String(value);
  }

  /** How much of a table fits inside the cell budget, as whole rows and
   *  columns rather than a ragged corner. */
  function windowFor(rows, columns) {
    const height = Math.min(rows, MAX_SIDE);
    const width = Math.min(columns, MAX_SIDE);

    if (height * width <= MAX_CELLS) {
      return { rows: height, columns: width, truncated: height < rows || width < columns };
    }
    const scaled = Math.max(1, Math.floor(Math.sqrt(MAX_CELLS)));
    return { rows: Math.min(height, scaled), columns: Math.min(width, scaled), truncated: true };
  }

  function keyOf(row, column) {
    return row + ',' + column;
  }

  function markSet(cells) {
    const set = new Set();

    (cells || []).forEach(function (cell) { set.add(keyOf(cell.row, cell.column)); });
    return set;
  }

  function classesFor(row, column, marks) {
    const classes = ['dp-cell'];

    if (marks.path.has(keyOf(row, column))) classes.push('dp-cell-path');

    if (marks.depends.has(keyOf(row, column))) classes.push('dp-cell-depends');

    if (marks.active.has(keyOf(row, column))) classes.push('dp-cell-active');

    if (marks.settled.has(keyOf(row, column))) classes.push('dp-cell-settled');
    return classes.join(' ');
  }

  function headerRow(settings, window) {
    const labels = settings.columnLabels || [];
    let out = '<th scope="col" class="dp-corner">' + escapeHtml(settings.corner || '') + '</th>';

    for (let column = 0; column < window.columns; column += 1) {
      out += '<th scope="col" class="dp-head">' +
        escapeHtml(labels[column] === undefined ? column : labels[column]) + '</th>';
    }
    return '<tr>' + out + '</tr>';
  }

  function bodyRows(settings, window, marks) {
    const labels = settings.rowLabels || [];
    let out = '';

    for (let row = 0; row < window.rows; row += 1) {
      out += '<tr><th scope="row" class="dp-head">' +
        escapeHtml(labels[row] === undefined ? row : labels[row]) + '</th>';

      for (let column = 0; column < window.columns; column += 1) {
        const value = (settings.table[row] || [])[column];
        out += '<td class="' + classesFor(row, column, marks) + '">' +
          escapeHtml(display(value)) + '</td>';
      }
      out += '</tr>';
    }
    return out;
  }

  /**
   * `markup({ table, rowLabels, columnLabels, path, depends, active, settled,
   * caption })`. Every mark list is `[{ row, column }]`.
   */
  function markup(options) {
    const settings = options || {};
    const table = settings.table || [];
    const rows = table.length;
    const columns = rows ? table[0].length : 0;
    const window = windowFor(rows, columns);
    const marks = {
      path: markSet(settings.path), depends: markSet(settings.depends),
      active: markSet(settings.active), settled: markSet(settings.settled)
    };
    const note = window.truncated
      ? '<p class="note">Drawing ' + window.rows + ' of ' + rows + ' rows and ' +
        window.columns + ' of ' + columns + ' columns; the computation used the whole table.</p>'
      : '';
    const caption = settings.caption
      ? '<p class="note">' + escapeHtml(settings.caption) + '</p>' : '';

    return '<div class="dp-scroll"><table class="dp-table">' +
      '<thead>' + headerRow(settings, window) + '</thead>' +
      '<tbody>' + bodyRows(settings, window, marks) + '</tbody>' +
      '</table></div>' + note + caption;
  }

  function render(options) {
    const settings = options || {};
    const host = settings.host || (settings.id && scope && scope.document
      ? scope.document.getElementById(settings.id) : null);

    if (!host) return null;
    host.innerHTML = markup(settings);
    return { host: host, cells: (settings.table || []).length };
  }

  /* ---------------------------------------------------------- helpers */

  /**
   * The traceback of an edit-distance table as a cell list, so the path is
   * drawn from the same walk the alignment came from rather than from a second
   * one that can disagree.
   */
  function editPath(a, b, table) {
    const path = [];
    let i = a.length;
    let j = b.length;

    while (i > 0 || j > 0) {
      path.push({ row: i, column: j });
      const same = i > 0 && j > 0 && a[i - 1] === b[j - 1];

      if (i > 0 && j > 0 && table[i][j] === table[i - 1][j - 1] + (same ? 0 : 1)) {
        i -= 1; j -= 1;
        continue;
      }

      if (i > 0 && table[i][j] === table[i - 1][j] + 1) { i -= 1; continue; }
      j -= 1;
    }
    path.push({ row: 0, column: 0 });
    return path.reverse();
  }

  /** The three cells an edit-distance cell was computed from. */
  function editDepends(row, column) {
    const out = [];

    if (row > 0 && column > 0) out.push({ row: row - 1, column: column - 1 });

    if (row > 0) out.push({ row: row - 1, column: column });

    if (column > 0) out.push({ row: row, column: column - 1 });
    return out;
  }

  /** The two cells a 0/1 knapsack cell was computed from - `skip` directly
   *  above, and `take` one row up and `weight` columns left. */
  function knapsackDepends(row, column, weight) {
    const out = [];

    if (row > 0) out.push({ row: row - 1, column: column });

    if (row > 0 && column - weight >= 0) out.push({ row: row - 1, column: column - weight });
    return out;
  }

  /** An interval DP is stored on the upper triangle, so the lower half is not
   *  empty - it is *not part of the problem*, and marking it as settled would
   *  say the opposite. */
  function intervalSettled(n, throughLength) {
    const out = [];

    for (let length = 1; length <= throughLength; length += 1) {
      for (let i = 0; i + length - 1 < n; i += 1) out.push({ row: i, column: i + length - 1 });
    }
    return out;
  }

  /** The cells below the diagonal, so a renderer can grey them rather than
   *  print a misleading zero. */
  function belowDiagonal(n) {
    const out = [];

    for (let row = 0; row < n; row += 1) {
      for (let column = 0; column < row; column += 1) out.push({ row: row, column: column });
    }
    return out;
  }

  return {
    MAX_CELLS: MAX_CELLS, MAX_SIDE: MAX_SIDE,
    markup: markup, render: render, display: display, windowFor: windowFor,
    editPath: editPath, editDepends: editDepends, knapsackDepends: knapsackDepends,
    intervalSettled: intervalSettled, belowDiagonal: belowDiagonal
  };
}));

/**
 * ParseTableView — LL and LR tables as HTML you can actually read.
 *
 * A parse table is a grid of terminals against states (LR) or nonterminals
 * (LL), and the interesting cells are the ones with two entries. Printing it as
 * a plain table hides those; this one marks conflicted cells, colours shift
 * against reduce, and puts the reason a cell exists in its title attribute, so
 * "why is there a reduce here" is one hover away rather than a re-derivation.
 *
 * HTML rather than SVG: a table is a table, it has to scroll horizontally on a
 * narrow screen, and screen readers get a real grid for free. The only thing
 * that would justify SVG here is the item-set graph, which
 * `viz/automaton-view.js` already draws.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ParseTableView = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const MAX_COLUMNS = 24;
  const MAX_ROWS = 60;

  function escapeText(value) {
    return String(value).replace(/[&<>"]/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch];
    });
  }

  /* ------------------------------------------------------------- LL tables */

  /**
   * `built` is what `LlParser.table` returns: `cells[nonterminal][terminal]`
   * holding one or more productions, plus the FIRST/FOLLOW reason each was
   * entered under.
   */
  function llMarkup(built, options) {
    const settings = options || {};
    const terminals = built.grammar.terminals.concat(['$'])
      .slice(0, settings.maxColumns || MAX_COLUMNS);
    const head = header(['nonterminal'].concat(terminals));
    const body = built.grammar.nonterminals.map(function (name) {
      return '<tr><th scope="row">' + escapeText(name) + '</th>' +
        terminals.map(function (terminal) {
          return llCell(built, name, terminal);
        }).join('') + '</tr>';
    }).join('');

    return wrap(head + '<tbody>' + body + '</tbody>',
      settings.caption || 'LL(1) parse table');
  }

  function llCell(built, name, terminal) {
    const entry = (built.cells[name] || {})[terminal];
    const clash = built.conflicts.filter(function (conflict) {
      return conflict.nonterminal === name && conflict.terminal === terminal;
    })[0];

    if (!entry) return '<td class="table-cell-empty"></td>';
    if (!clash) {
      return '<td class="table-cell-entry" title="' + escapeText(entry.reason) + '">' +
        escapeText(production(entry.rule)) + '</td>';
    }
    return '<td class="table-cell-conflict" title="' + escapeText(clash.reason) + '">' +
      escapeText(production(clash.first)) + '<br>' +
      escapeText(production(clash.second)) + '</td>';
  }

  function production(rule) {
    return rule.lhs + ' → ' + (rule.rhs.join(' ') || 'ε');
  }

  /* ------------------------------------------------------------- LR tables */

  /**
   * ACTION and GOTO as one grid, which is how a generator prints it and how a
   * conflict is easiest to spot: the shift and the reduce are in the same cell,
   * side by side, rather than in two tables you have to cross-reference.
   */
  function lrMarkup(built, options) {
    const settings = options || {};
    const terminals = built.augmented.terminals.concat(['$'])
      .slice(0, settings.maxColumns || MAX_COLUMNS);
    const nonterminals = built.augmented.nonterminals.filter(function (name) {
      return name !== built.augmented.start;
    });
    const rows = built.action.slice(0, settings.maxRows || MAX_ROWS);
    const head = header(['state'].concat(terminals).concat(nonterminals));
    const body = rows.map(function (row, state) {
      return '<tr><th scope="row">' + state + '</th>' +
        terminals.map(function (terminal) {
          return lrCell(built, state, terminal);
        }).join('') +
        nonterminals.map(function (name) {
          const target = built.goTo[state][name];

          return target === undefined ? '<td class="table-cell-empty"></td>'
            : '<td class="table-cell-goto">' + target + '</td>';
        }).join('') + '</tr>';
    }).join('');

    return wrap(head + '<tbody>' + body + '</tbody>',
      settings.caption || (built.mode.toUpperCase() + ' parse table'));
  }

  function lrCell(built, state, terminal) {
    const conflicts = built.conflicts.filter(function (conflict) {
      return conflict.state === state && conflict.terminal === terminal;
    });
    const entry = built.action[state][terminal];

    if (!entry && conflicts.length === 0) return '<td class="table-cell-empty"></td>';
    if (conflicts.length === 0) {
      return '<td class="table-cell-entry">' + escapeText(short(entry)) + '</td>';
    }
    return '<td class="table-cell-conflict" title="' +
      escapeText(conflicts[0].kind + ': ' + conflicts[0].first + ' against ' +
        conflicts[0].second) + '">' +
      escapeText(short(entry) + ' / ' + shortText(conflicts[0], entry)) + '</td>';
  }

  function short(entry) {
    if (!entry) return '—';
    if (entry.kind === 'shift') return 's' + entry.target;
    if (entry.kind === 'accept') return 'acc';
    return 'r' + entry.rule.index;
  }

  function shortText(conflict, kept) {
    const other = kept && conflict.first.indexOf('shift') === 0 && kept.kind === 'shift'
      ? conflict.second : conflict.first;

    if (other.indexOf('shift to state ') === 0) return 's' + other.slice(15);
    if (other === 'accept') return 'acc';
    return 'r?';
  }

  /* -------------------------------------------------------------- shared */

  function header(cells) {
    return '<thead><tr>' + cells.map(function (cell) {
      return '<th scope="col">' + escapeText(cell) + '</th>';
    }).join('') + '</tr></thead>';
  }

  function wrap(inner, caption) {
    return '<div class="table-scroll"><table class="parse-table">' +
      '<caption>' + escapeText(caption) + '</caption>' + inner + '</table></div>';
  }

  /** The Earley chart as a column-per-position list, which is the other table
   *  this milestone keeps needing. */
  function chartMarkup(rows, options) {
    const settings = options || {};
    const body = rows.map(function (column) {
      return '<tr><th scope="row">' + column.at + '</th>' +
        '<td class="table-cell-entry">' + column.items.map(function (item) {
          return '<span class="chart-item chart-item-' + escapeText(item.kind) + '">' +
            escapeText(item.text) + '</span>';
        }).join(' ') + '</td></tr>';
    }).join('');

    return wrap(header(['position', 'items']) + '<tbody>' + body + '</tbody>',
      settings.caption || 'Earley chart');
  }

  function render(host, markup) {
    if (!host) return null;
    host.innerHTML = markup;
    return { host: host };
  }

  return {
    llMarkup: llMarkup, lrMarkup: lrMarkup, chartMarkup: chartMarkup,
    render: render, MAX_COLUMNS: MAX_COLUMNS, MAX_ROWS: MAX_ROWS
  };
}));

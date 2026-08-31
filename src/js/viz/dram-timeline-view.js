/**
 * DramTimelineView - requests across banks on a time axis, which is the only
 * way the scheduler's reordering becomes visible.
 *
 * One row per bank, time running left to right, one cell per request coloured
 * by what it cost: a row hit, a row miss, or a row conflict. Two things show
 * up immediately in that picture and in no table:
 *
 * Bank-level parallelism is the vertical dimension. Several banks with work in
 * the same column is overlap; one busy row and seven empty ones is a workload
 * that has serialised itself on a single bank, which is what a stride aligned
 * to the bank count does.
 *
 * Reordering is the horizontal one. Under first-come-first-served the request
 * ids run in order along every row; under FR-FCFS they do not, and the ones
 * that jumped the queue are exactly the ones that hit an already-open row.
 * A request whose id is far out of order is the one paying for everyone
 * else's throughput.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.DramTimelineView = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const OUTCOME_CLASS = { rowHit: 'dram-hit', rowMiss: 'dram-miss',
    rowConflict: 'dram-conflict' };

  const OUTCOME_NAME = { rowHit: 'row hit — the row was already open',
    rowMiss: 'row miss — no row was open, so one had to be activated',
    rowConflict: 'row conflict — a different row was open and had to be closed first' };

  function escape(text) {
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /**
   * Divide the timeline into columns of equal duration and put each request in
   * the column its transfer started in.
   *
   * Equal columns rather than one column per request, because the point of the
   * picture is which banks were busy AT THE SAME TIME, and a per-request grid
   * would put simultaneous transfers in different columns.
   */
  function grid(dram, options) {
    const settings = options || {};
    const rows = dram.timeline.slice(0, settings.limit || 240);
    const columns = Math.max(1, settings.columns || 48);
    const span = Math.max(1, lastEnd(rows));
    const width = span / columns;
    const banks = [];

    for (let at = 0; at < dram.settings.banks; at += 1) {
      banks.push(new Array(columns).fill(null));
    }
    rows.forEach(function (row) {
      const column = Math.min(columns - 1, Math.floor(row.start / width));

      if (!banks[row.bank][column]) banks[row.bank][column] = row;
    });
    return { banks: banks, columns: columns, span: span, shown: rows.length,
      total: dram.timeline.length };
  }

  function lastEnd(rows) {
    return rows.reduce(function (most, row) { return Math.max(most, row.end); }, 0);
  }

  function markup(dram, options) {
    if (!dram.timeline.length) return '<p class="note">nothing has been run yet.</p>';
    const found = grid(dram, options);

    return '<div class="pipe-scroll"><table class="pipe-table"><thead>' +
      header(found) + '</thead><tbody>' + body(found) + '</tbody></table></div>' +
      (found.total > found.shown
        ? '<p class="note">showing the first ' + found.shown + ' of ' + found.total +
          ' requests.</p>'
        : '');
  }

  function header(found) {
    const cells = ['<th class="pipe-label">bank</th>'];
    const step = Math.max(1, Math.round(found.span / found.columns));

    for (let at = 0; at < found.columns; at += 1) {
      cells.push('<th>' + (at % 8 === 0 ? at * step : '') + '</th>');
    }
    return '<tr>' + cells.join('') + '</tr>';
  }

  function body(found) {
    return found.banks.map(function (row, bank) {
      return '<tr><th class="pipe-label">' + bank + '</th>' +
        row.map(cell).join('') + '</tr>';
    }).join('');
  }

  function cell(request) {
    if (!request) return '<td class="pipe-gap"></td>';
    return '<td class="' + OUTCOME_CLASS[request.outcome] + '" title="request ' +
      request.id + ', row ' + request.row + ': ' + escape(OUTCOME_NAME[request.outcome]) +
      ', waited ' + request.wait + ' cycles">' + request.id + '</td>';
  }

  function legend() {
    return Object.keys(OUTCOME_CLASS).map(function (outcome) {
      return '<span class="pipe-key"><span class="pipe-swatch ' + OUTCOME_CLASS[outcome] +
        '"></span>' + OUTCOME_NAME[outcome].split(' — ')[0] + '</span>';
    }).join('');
  }

  /**
   * How far requests were reordered, which is what a scheduling policy costs
   * the unlucky ones.
   *
   * Measured as the largest gap between a request's arrival position and the
   * position it was actually served in. A policy with a good average and an
   * unbounded worst case is not one anybody can ship, and this is the number
   * that says which you have.
   */
  function reordering(dram) {
    let worst = 0;
    let moved = 0;

    dram.timeline.forEach(function (row, served) {
      const gap = Math.abs(row.id - 1 - served);

      if (gap > 0) moved += 1;
      worst = Math.max(worst, gap);
    });
    return { worst: worst, moved: moved, served: dram.timeline.length,
      share: dram.timeline.length ? moved / dram.timeline.length : 0 };
  }

  /** Per-bank activity, which is where bank-level parallelism is or is not. */
  function banks(dram) {
    const rows = dram.banks.map(function (bank, at) {
      return { bank: at, requests: 0, activations: bank.activations, hits: 0 };
    });

    dram.timeline.forEach(function (row) {
      rows[row.bank].requests += 1;
      if (row.outcome === 'rowHit') rows[row.bank].hits += 1;
    });
    return rows;
  }

  return { OUTCOME_CLASS: OUTCOME_CLASS, OUTCOME_NAME: OUTCOME_NAME, markup: markup,
    grid: grid, legend: legend, reordering: reordering, banks: banks };
}));

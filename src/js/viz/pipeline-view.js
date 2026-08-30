/**
 * PipelineView - instructions on rows, cycles on columns.
 *
 * This is the only picture in the milestone that has to be exact rather than
 * illustrative, so it is built from the cycle log the simulator produced and
 * not from a second walk of the program. A cell says which stage an
 * instruction was in during a cycle; a gap says it was not in the pipeline at
 * all; and the colouring separates the three things that cost cycles - a
 * stall, a flush and the fill at the start - because "where did the cycles go"
 * is the question the diagram exists to answer.
 *
 * It is markup rather than a chart because the data is a grid of short labels
 * with no continuous axis to scale. A table also stays readable when a program
 * runs for eighty cycles, which a chart of eighty categories does not.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.PipelineView = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const STAGE_CLASS = { IF: 'pipe-if', ID: 'pipe-id', EX: 'pipe-ex',
    MEM: 'pipe-mem', WB: 'pipe-wb' };

  function escape(text) {
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /** One row per instruction, with the stage it occupied in each cycle. */
  function rows(machine, options) {
    const settings = options || {};
    const limit = settings.cycles || 32;
    const found = new Map();

    machine.log.slice(0, limit).forEach(function (cycle) {
      Object.keys(cycle.stages).forEach(function (stage) {
        const cell = cycle.stages[stage];

        if (!cell || cell.bubble) return;
        if (!found.has(cell.id)) {
          found.set(cell.id, { id: cell.id, pc: cell.pc, name: cell.name, cells: {} });
        }
        found.get(cell.id).cells[cycle.cycle] = stage;
      });
    });
    return Array.from(found.values()).sort(function (left, right) {
      return left.id - right.id;
    });
  }

  /** What stopped each cycle, if anything - read off the events rather than
   *  inferred from the gaps, so a cell's colour and its tooltip cannot
   *  disagree. */
  function reasons(machine, options) {
    const settings = options || {};
    const limit = settings.cycles || 32;
    const out = {};

    machine.log.slice(0, limit).forEach(function (cycle) {
      cycle.events.forEach(function (event) {
        if (event.kind !== 'stall' && event.kind !== 'flush') return;
        out[cycle.cycle] = { kind: event.kind, reason: event.reason };
      });
    });
    return out;
  }

  function header(machine, options) {
    const settings = options || {};
    const limit = Math.min(settings.cycles || 32, machine.log.length);
    const cells = ['<th>instruction</th>'];

    for (let at = 0; at < limit; at += 1) cells.push('<th>' + at + '</th>');
    return '<tr>' + cells.join('') + '</tr>';
  }

  function body(machine, options) {
    const settings = options || {};
    const limit = Math.min(settings.cycles || 32, machine.log.length);
    const why = reasons(machine, options);

    return rows(machine, options).map(function (row) {
      return '<tr>' + label(row) + line(row, limit, why) + '</tr>';
    }).join('');
  }

  function label(row) {
    return '<th class="pipe-label">0x' + row.pc.toString(16) + ' ' +
      escape(row.name) + '</th>';
  }

  function line(row, limit, why) {
    const cells = [];

    for (let at = 0; at < limit; at += 1) {
      const stage = row.cells[at];

      cells.push(stage ? cell(stage, at, why) : '<td class="pipe-gap"></td>');
    }
    return cells.join('');
  }

  function cell(stage, cycle, why) {
    const note = why[cycle] ? ' title="' + escape(why[cycle].reason) + '"' : '';
    const extra = why[cycle] ? ' pipe-' + why[cycle].kind : '';

    return '<td class="' + STAGE_CLASS[stage] + extra + '"' + note + '>' + stage + '</td>';
  }

  function markup(machine, options) {
    if (!machine.log.length) return '<p class="note">nothing has been run yet.</p>';
    return '<div class="pipe-scroll"><table class="pipe-table"><thead>' +
      header(machine, options) + '</thead><tbody>' + body(machine, options) +
      '</tbody></table></div>';
  }

  const ABOUT = {
    'filling the pipeline': 'the first instruction takes five cycles; after that they overlap',
    stall: 'a value that did not exist yet, or a resource already in use',
    structural: 'the fetch stage waiting for the only memory port',
    flush: 'fetched down a path that turned out to be wrong',
    'squashed by an exception': 'fetched after a fault was detected and before it committed',
    'drained by a serialising instruction': 'mret or a control-register write, which cannot forward',
    drained: 'the run was told to stop issuing'
  };

  /**
   * Where the cycles went, as a list that adds up.
   *
   * Every cycle either retired an instruction, committed a trap, or was a hole
   * — and the holes are charged at write-back, to whatever created the bubble
   * that arrived there. That is exact by construction, which matters: deriving
   * the same numbers from the stall and flush events was off by one on every
   * program, because bubbles created near the end of a run never reach
   * write-back and a pipeline that refills after a trap pays the fill twice.
   */
  function attribution(summary) {
    const rows = [{ name: 'instructions retired', cycles: summary.retired,
      about: 'one cycle each, which is the whole point of pipelining' }];

    if (summary.traps) {
      rows.push({ name: 'traps committed', cycles: summary.traps,
        about: 'a fault reaching write-back writes the CSRs instead of a register' });
    }
    Object.keys(summary.causes || {}).forEach(function (why) {
      rows.push({ name: why, cycles: summary.causes[why], about: ABOUT[why] || why });
    });
    const total = rows.reduce(function (sum, row) { return sum + row.cycles; }, 0);

    return { rows: rows, total: total, cycles: summary.cycles,
      reconciles: total === summary.cycles };
  }

  return { markup: markup, rows: rows, reasons: reasons, attribution: attribution,
    STAGE_CLASS: STAGE_CLASS };
}));

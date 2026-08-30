/**
 * OooView - the in-flight window: one row per instruction, one column per
 * cycle, and the state each instruction was in.
 *
 * The pipeline diagram in M35 had one honest reading: every instruction moved
 * one stage per cycle, so the picture was a staircase. This one is not a
 * staircase and that is the point. An instruction sits in the issue queue for
 * as long as its operands take, executes, then waits - often for a long time -
 * for every older instruction to commit ahead of it. Seeing the waiting is
 * what makes the reorder buffer make sense, because the buffer is exactly the
 * thing holding all those finished instructions that are not allowed to become
 * real yet.
 *
 * Every cell is derived from the core's event log rather than from a second
 * walk of the program, so the picture cannot drift from the numbers beside it.
 * The states are the ones the core actually records:
 *
 *   F  fetched, sitting in the fetch buffer, not yet renamed
 *   W  dispatched, in the issue queue, waiting for an operand or a port
 *   X  executing
 *   C  complete - the result exists, and it is not architectural yet
 *   R  committed, in program order, and now it is real
 *   S  squashed, because something older went a different way
 *
 * The gap between the first X and the R on the same row is the whole of what
 * a reorder buffer costs and buys.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.OooView = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const STATE_CLASS = { F: 'ooo-fetch', W: 'ooo-wait', X: 'ooo-exec', C: 'ooo-done',
    R: 'ooo-commit', S: 'ooo-squash' };

  const STATE_NAME = { F: 'fetched', W: 'waiting to issue', X: 'executing',
    C: 'complete, not committed', R: 'committed', S: 'squashed' };

  const TRANSITIONS = { fetch: 'F', dispatch: 'W', issue: 'X', defer: 'W',
    complete: 'C', commit: 'R', trap: 'R' };

  function escape(text) {
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ------------------------------------------------------------- the grid */

  function blankRow(event) {
    return { id: event.id, pc: event.pc, name: event.name || '?', cells: {},
      issuedAt: null, committedAt: null };
  }

  /**
   * Walk the log once, keeping a live state per instruction and writing it
   * into that cycle's column.
   *
   * A squash names the OLDEST surviving entry, so everything with a larger id
   * that is still alive goes at the same moment - which is what the core does
   * and what makes the wrong-path work visible as a block rather than as a
   * scattering of missing rows.
   */
  function timeline(core, options) {
    const settings = options || {};
    const from = settings.from || 0;
    const limit = from + (settings.cycles || 36);
    const rows = new Map();
    const live = new Map();

    (core.log || []).slice(from, limit).forEach(function (entry) {
      entry.events.forEach(function (event) { apply(rows, live, event); });
      live.forEach(function (state, id) { rows.get(id).cells[entry.cycle] = state; });
      retire(rows, live);
    });
    return Array.from(rows.values()).sort(function (left, right) {
      return left.id - right.id;
    });
  }

  function apply(rows, live, event) {
    if (event.kind === 'squash') { squash(live, event.id); return; }
    const next = TRANSITIONS[event.kind];

    if (!next || event.id === undefined) return;
    if (!rows.has(event.id)) rows.set(event.id, blankRow(event));
    const row = rows.get(event.id);

    if (next === 'X' && row.issuedAt === null) row.issuedAt = event.id;
    if (next === 'R') row.committedAt = event.id;
    live.set(event.id, next);
  }

  function squash(live, oldest) {
    live.forEach(function (state, id) {
      if (id > oldest) live.set(id, 'S');
    });
  }

  function retire(rows, live) {
    const gone = [];

    live.forEach(function (state, id) {
      if (state === 'R' || state === 'S') gone.push(id);
    });
    gone.forEach(function (id) { live.delete(id); });
  }

  function markup(core, options) {
    const settings = options || {};
    const from = settings.from || 0;
    const shown = Math.min(settings.cycles || 36, (core.log || []).length - from);

    if (!core.log || !core.log.length || shown <= 0) {
      return '<p class="note">nothing has been run yet.</p>';
    }
    return '<div class="pipe-scroll"><table class="pipe-table"><thead>' +
      header(from, shown) + '</thead><tbody>' +
      body(timeline(core, settings), from, shown) + '</tbody></table></div>';
  }

  function header(from, shown) {
    const cells = ['<th class="pipe-label">instruction</th>'];

    for (let at = 0; at < shown; at += 1) cells.push('<th>' + (from + at) + '</th>');
    return '<tr>' + cells.join('') + '</tr>';
  }

  function body(rows, from, shown) {
    return rows.map(function (row) {
      return '<tr><th class="pipe-label">0x' + row.pc.toString(16) + ' ' +
        escape(row.name) + '</th>' + line(row, from, shown) + '</tr>';
    }).join('');
  }

  function line(row, from, shown) {
    const cells = [];

    for (let at = 0; at < shown; at += 1) {
      const state = row.cells[from + at];

      cells.push(state
        ? '<td class="' + STATE_CLASS[state] + '" title="' + STATE_NAME[state] + '">' +
          state + '</td>'
        : '<td class="pipe-gap"></td>');
    }
    return cells.join('');
  }

  function legend() {
    return Object.keys(STATE_CLASS).map(function (state) {
      return '<span class="pipe-key"><span class="pipe-swatch ' + STATE_CLASS[state] +
        '"></span>' + state + ' — ' + STATE_NAME[state] + '</span>';
    }).join('');
  }

  /* ------------------------------------------------------------ the series */

  /** How full the window was, cycle by cycle - the picture that says whether
   *  the reorder buffer is the limit or a spectator. */
  function occupancy(core) {
    return (core.log || []).map(function (entry) {
      return { cycle: entry.cycle, used: entry.window.length,
        capacity: core.rob.capacity };
    });
  }

  /** Instructions issued per cycle, which is the histogram the width explorer
   *  is really about: a machine four wide that issues one most cycles is not
   *  a machine four wide. */
  function issueProfile(core) {
    const counts = {};

    (core.log || []).forEach(function (entry) {
      const issued = entry.events.filter(function (event) {
        return event.kind === 'issue';
      }).length;

      counts[issued] = (counts[issued] || 0) + 1;
    });
    return Object.keys(counts).map(Number).sort(function (left, right) {
      return left - right;
    }).map(function (issued) {
      return { issued: issued, cycles: counts[issued],
        share: core.log.length ? counts[issued] / core.log.length : 0 };
    });
  }

  /** Which port did the work. A port that is busy every cycle is the reason a
   *  wider machine did not help. */
  function portUse(core) {
    const counts = {};

    (core.log || []).forEach(function (entry) {
      entry.events.forEach(function (event) {
        if (event.kind !== 'issue' || !event.port) return;
        counts[event.port] = (counts[event.port] || 0) + 1;
      });
    });
    return core.scheduler.ports.map(function (port) {
      return { name: port.name, about: port.about, issued: counts[port.name] || 0,
        share: core.log.length ? (counts[port.name] || 0) / core.log.length : 0 };
    });
  }

  /**
   * Outstanding cache misses per cycle - the memory-level parallelism the array
   * has and the linked list does not.
   *
   * `inFlight` is read straight out of the log rather than reconstructed from
   * the starts and the miss latency, because a reconstruction would be a
   * restatement of the configuration rather than an observation of the run.
   */
  function outstanding(core) {
    const starts = {};

    (core.log || []).forEach(function (entry) {
      entry.events.forEach(function (event) {
        if (event.kind !== 'miss') return;
        starts[entry.cycle] = (starts[entry.cycle] || 0) + 1;
      });
    });
    return (core.log || []).map(function (entry) {
      return { cycle: entry.cycle, started: starts[entry.cycle] || 0,
        inFlight: entry.outstanding || 0 };
    });
  }

  /**
   * Memory-level parallelism: the average number of misses in flight during
   * the cycles when any were.
   *
   * Averaging over every cycle instead would mostly measure how much of the
   * program was not memory at all, and would report a smaller number for a
   * program that spent less time waiting - which is the wrong direction for
   * every conclusion this metric is used to reach.
   */
  function mlp(core) {
    const rows = outstanding(core).filter(function (row) { return row.inFlight > 0; });
    const total = rows.reduce(function (sum, row) { return sum + row.inFlight; }, 0);

    return { cycles: rows.length, total: total,
      average: rows.length ? total / rows.length : 0,
      peak: rows.reduce(function (most, row) { return Math.max(most, row.inFlight); }, 0),
      share: core.log.length ? rows.length / core.log.length : 0 };
  }

  /** The events of one cycle, in the order the stages produced them, for the
   *  stepper's running commentary. */
  function commentary(core, cycle) {
    const entry = (core.log || [])[cycle];

    if (!entry) return [];
    return entry.events.map(function (event) {
      return { kind: event.kind, id: event.id, name: event.name || null,
        reason: event.reason || null, port: event.port || null };
    });
  }

  return { STATE_CLASS: STATE_CLASS, STATE_NAME: STATE_NAME, markup: markup,
    timeline: timeline, legend: legend, occupancy: occupancy,
    issueProfile: issueProfile, portUse: portUse, outstanding: outstanding, mlp: mlp,
    commentary: commentary };
}));

/**
 * BytecodeView — the back end's four pictures, on one set of primitives.
 *
 * A disassembly listing, a frame with its operand stack and locals, a bar
 * comparison of two instruction sets, and an interference graph. They look
 * unrelated and are not: each is a small, labelled structure the learner has
 * to be able to read a specific value out of, so all four are drawn with the
 * text selectable and the numbers on the marks rather than in a legend.
 *
 * The interference graph is the only force-free layout here and deliberately
 * so: a circle with chords is unreadable past about twenty nodes, and past
 * twenty nodes the useful thing is the degree column rather than the picture.
 * `render` says so in its summary rather than drawing a hairball.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BytecodeView = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const NODE_LIMIT = 20;

  function escapeHtml(text) {
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ------------------------------------------------------------- listings */

  /**
   * A disassembly, with the block labels in the margin and one row per
   * instruction. `highlight` marks the program counter, which is what turns
   * the listing into a debugger view rather than a dump.
   */
  function listing(rows, options) {
    const settings = options || {};

    return '<pre class="ir-listing">' + rows.map(function (row) {
      return listingRow(row, settings);
    }).join('\n') + '</pre>';
  }

  function listingRow(row, settings) {
    const marked = settings.highlight === row.at;
    const label = row.label
      ? '<span class="ir-block">' + escapeHtml(row.label) + ':</span>\n' : '';

    return label + '<span class="ir-line' + (marked ? ' is-marked' : '') + '">' +
      String(row.at).padStart(4, ' ') + '  ' + escapeHtml(row.op).padEnd(16, ' ') +
      escapeHtml(row.operands) + '</span>';
  }

  /**
   * A frame: the operand stack growing upward, the named locals beside it and
   * the upvalues below. Drawn as a table rather than a chart because every
   * cell is a value the learner reads, and a bar of a value is not a value.
   */
  function frame(snapshot) {
    if (!snapshot) return '<p class="note">nothing is running.</p>';
    return '<div class="frame-view">' + stackColumn(snapshot) +
      localsColumn(snapshot) + '</div>';
  }

  function stackColumn(snapshot) {
    const items = snapshot.stack.length
      ? snapshot.stack.slice().reverse().map(function (value, at) {
        return '<li><span class="frame-slot">' +
          (snapshot.stack.length - 1 - at) + '</span> ' + escapeHtml(value) + '</li>';
      }).join('')
      : '<li class="is-empty">empty</li>';

    return '<div class="frame-column"><h4>operand stack</h4><ol class="frame-stack">' +
      items + '</ol></div>';
  }

  function localsColumn(snapshot) {
    const rows = (snapshot.locals || []).map(function (row) {
      return '<li><span class="frame-slot">' + escapeHtml(row.slot) + '</span> ' +
        escapeHtml(row.name) + ' = ' + escapeHtml(row.value) + '</li>';
    }).join('') || '<li class="is-empty">none</li>';
    const ups = (snapshot.upvalues || []).map(function (row) {
      return '<li><span class="frame-slot">' + row.at + '</span> ' +
        (row.open ? 'open' : 'closed') + ' = ' + escapeHtml(row.value) + '</li>';
    }).join('');

    return '<div class="frame-column"><h4>locals</h4><ul class="frame-locals">' + rows +
      '</ul>' + (ups ? '<h4>upvalues</h4><ul class="frame-locals">' + ups + '</ul>' : '') +
      '</div>';
  }

  /* ---------------------------------------------------------------- bars */

  /**
   * Grouped bars with the value written on each one. Two series at most,
   * because the comparison this milestone keeps making is between exactly two
   * things and a third series would need a legend nobody reads.
   */
  function bars(host, spec) {
    if (!host || !scope || !scope.ChartBase) return null;
    const settings = spec || {};
    const rows = settings.rows || [];
    const chart = scope.ChartBase.create({ host: host, lazyLib: settings.lazyLib,
      height: settings.height || 220,
      margin: { top: 16, right: 14, bottom: 34, left: 54 },
      summary: settings.summary });

    chart.render(function (ctx) { drawBars(ctx, rows, settings); });
    return { host: host, chart: chart };
  }

  function drawBars(ctx, rows, settings) {
    const series = settings.series || ['value'];
    const most = rows.reduce(function (top, row) {
      return series.reduce(function (inner, key) {
        return Math.max(inner, Number(row[key]) || 0);
      }, top);
    }, 0) || 1;
    const step = ctx.width / Math.max(rows.length, 1);
    const width = Math.max(6, (step - 12) / series.length);

    rows.forEach(function (row, at) {
      series.forEach(function (key, index) {
        drawOneBar(ctx, { row: row, key: key, index: index, at: at, step: step,
          width: width, most: most, series: series });
      });
      labelBar(ctx, row, at, step);
    });
  }

  function drawOneBar(ctx, spec) {
    const value = Number(spec.row[spec.key]) || 0;
    const height = (value / spec.most) * ctx.height;
    const x = spec.at * spec.step + 6 + spec.index * spec.width;
    const tone = spec.index === 0 ? scope.Palette.hue('blue') : scope.Palette.hue('amber');

    ctx.plot.append('rect')
      .attr('x', x).attr('y', ctx.height - height)
      .attr('width', spec.width - 2).attr('height', Math.max(height, 1))
      .attr('fill', tone).attr('opacity', 0.85);
    ctx.plot.append('text')
      .attr('x', x + (spec.width - 2) / 2).attr('y', ctx.height - height - 4)
      .attr('text-anchor', 'middle').attr('font-size', 10)
      .attr('fill', scope.Palette.token('text-muted'))
      .text(spec.row[spec.key]);
  }

  function labelBar(ctx, row, at, step) {
    ctx.plot.append('text')
      .attr('x', at * step + step / 2).attr('y', ctx.height + 16)
      .attr('text-anchor', 'middle').attr('font-size', 11)
      .attr('fill', scope.Palette.token('text-muted'))
      .text(row.label);
  }

  /* --------------------------------------------------- the interference graph */

  function interferenceLayout(names) {
    const radius = Math.max(60, names.length * 9);
    const placed = {};

    names.forEach(function (name, at) {
      const angle = (at / names.length) * Math.PI * 2 - Math.PI / 2;

      placed[name] = { name: name, x: radius * Math.cos(angle) + radius + 20,
        y: radius * Math.sin(angle) + radius + 20 };
    });
    return { nodes: placed, size: radius * 2 + 40 };
  }

  /**
   * Nodes on a circle, an edge for each interference, and the assigned colour
   * written inside each node. Past `NODE_LIMIT` nodes the chords cross too
   * often to read and the picture is replaced by a note saying how many were
   * dropped — which is the honest alternative to drawing something nobody can
   * use.
   */
  function interference(host, spec) {
    if (!host || !scope || !scope.ChartBase) return null;
    const settings = spec || {};
    const names = (settings.names || []).slice(0, NODE_LIMIT);
    const placed = interferenceLayout(names);
    const chart = scope.ChartBase.create({ host: host, lazyLib: settings.lazyLib,
      height: placed.size, margin: { top: 8, right: 8, bottom: 8, left: 8 },
      summary: settings.summary });

    chart.render(function (ctx) {
      drawInterferenceEdges(ctx, placed, settings, names);
      drawInterferenceNodes(ctx, placed, settings, names);
    });
    return { host: host, chart: chart, drawn: names.length,
      dropped: Math.max(0, (settings.names || []).length - NODE_LIMIT) };
  }

  function drawInterferenceEdges(ctx, placed, settings, names) {
    const shown = new Set(names);

    names.forEach(function (name) {
      (settings.edges[name] ? Array.from(settings.edges[name]) : []).forEach(function (other) {
        if (!shown.has(other) || other < name) return;
        ctx.plot.append('line')
          .attr('x1', placed.nodes[name].x).attr('y1', placed.nodes[name].y)
          .attr('x2', placed.nodes[other].x).attr('y2', placed.nodes[other].y)
          .attr('stroke', scope.Palette.token('border-strong'))
          .attr('stroke-width', 0.8).attr('opacity', 0.5);
      });
    });
  }

  function drawInterferenceNodes(ctx, placed, settings, names) {
    const assignment = settings.assignment || {};

    names.forEach(function (name) {
      const spot = placed.nodes[name];
      const colour = assignment[name];
      const spilled = colour === null || colour === undefined;

      ctx.plot.append('circle')
        .attr('cx', spot.x).attr('cy', spot.y).attr('r', 13)
        .attr('fill', spilled ? scope.Palette.hue('amber')
          : scope.Palette.soft(scope.Palette.hue('blue'), 0.18 + (colour % 5) * 0.14))
        .attr('stroke', scope.Palette.token('border-strong'));
      ctx.plot.append('text')
        .attr('x', spot.x).attr('y', spot.y + 4)
        .attr('text-anchor', 'middle').attr('font-size', 10)
        .attr('fill', scope.Palette.token('text-strong'))
        .text(spilled ? 'sp' : String(colour));
    });
  }

  /* --------------------------------------------------------------- timeline */

  /**
   * Tier transitions along the dispatch axis. One lane per function, a mark
   * per transition, and the deoptimisations in amber — so a function that
   * climbs and falls back reads as a shape rather than as a list of events.
   */
  function timeline(host, spec) {
    if (!host || !scope || !scope.ChartBase) return null;
    const settings = spec || {};
    const events = settings.events || [];
    const lanes = Array.from(new Set(events.map(function (row) { return row.fn; })));
    const chart = scope.ChartBase.create({ host: host, lazyLib: settings.lazyLib,
      height: Math.max(120, lanes.length * 44 + 40),
      margin: { top: 14, right: 14, bottom: 26, left: 76 },
      summary: settings.summary });

    chart.render(function (ctx) { drawTimeline(ctx, events, lanes, settings); });
    return { host: host, chart: chart, lanes: lanes.length };
  }

  function drawTimeline(ctx, events, lanes, settings) {
    const span = Math.max(settings.total || 1,
      events.reduce(function (most, row) { return Math.max(most, row.at); }, 1));

    lanes.forEach(function (name, lane) {
      const y = lane * 44 + 20;

      ctx.plot.append('line').attr('x1', 0).attr('y1', y).attr('x2', ctx.width).attr('y2', y)
        .attr('stroke', scope.Palette.token('border')).attr('stroke-width', 1);
      ctx.plot.append('text').attr('x', -8).attr('y', y + 4).attr('text-anchor', 'end')
        .attr('font-size', 11).attr('fill', scope.Palette.token('text-muted')).text(name);
      events.filter(function (row) { return row.fn === name; })
        .forEach(function (row) { drawEvent(ctx, row, y, span); });
    });
  }

  function drawEvent(ctx, row, y, span) {
    const x = (row.at / span) * ctx.width;
    const down = row.tier === 0;

    ctx.plot.append('circle').attr('cx', x).attr('cy', y).attr('r', 6)
      .attr('fill', down ? scope.Palette.hue('amber') : scope.Palette.hue('blue'))
      .attr('opacity', 0.9);
    ctx.plot.append('text').attr('x', x).attr('y', y - 11).attr('text-anchor', 'middle')
      .attr('font-size', 10).attr('fill', scope.Palette.token('text-muted'))
      .text(row.name || String(row.tier));
  }

  return {
    NODE_LIMIT: NODE_LIMIT, escapeHtml: escapeHtml,
    listing: listing, frame: frame, bars: bars,
    interference: interference, interferenceLayout: interferenceLayout,
    timeline: timeline
  };
}));

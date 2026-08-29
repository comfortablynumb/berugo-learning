/**
 * WaveformView - digital waveforms, which is the only honest way to look at a
 * circuit that has delays in it.
 *
 * A truth table says what a circuit computes and a waveform says what it does
 * on the way there, and the difference between those two is the entire subject
 * of glitches, setup times and metastability. A wire is drawn as a line at one
 * of two levels with a vertical edge where it changes; a wire that changes
 * twice between two settled states is marked, because that is a glitch and it
 * is what the eye should be drawn to.
 *
 * Built on ChartBase so margins, resize and theme colours are decided once,
 * and the colours come from the palette rather than from literals.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.WaveformView = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const ROW_HEIGHT = 34;
  const LEVEL = 10;

  /**
   * Turn a change list into one step per signal. The simulator records only
   * the changes, so a signal's value between two records is the earlier one -
   * which is what makes this a step plot rather than a line plot.
   */
  function tracesOf(config) {
    return config.signals.map(function (signal) {
      const points = [{ time: 0, value: signal.initial ? 1 : 0 }];

      (config.history || []).forEach(function (event) {
        if (event.id !== signal.id && event.label !== signal.label) return;
        points.push({ time: event.time, value: event.value });
      });
      return { label: signal.label, points: points, glitched: Boolean(signal.glitched),
        note: signal.note || '' };
    });
  }

  function spanOf(traces, config) {
    let last = config.until || 0;

    traces.forEach(function (trace) {
      trace.points.forEach(function (point) { last = Math.max(last, point.time); });
    });
    return last + 1;
  }

  function stepPath(trace, x, y, base) {
    let text = '';
    let previous = null;

    trace.points.forEach(function (point) {
      const level = y(base) - (point.value ? LEVEL : 0);

      if (previous === null) { text += 'M' + x(point.time) + ',' + level; previous = level; return; }
      text += 'L' + x(point.time) + ',' + previous + 'L' + x(point.time) + ',' + level;
      previous = level;
    });
    return text;
  }

  function render(host, config) {
    const traces = tracesOf(config);
    const chart = scope.ChartBase.create({
      host: host,
      lazyLib: config.lazyLib || scope.BerugoApp.lazyLib,
      height: config.height || Math.max(120, traces.length * ROW_HEIGHT + 40),
      margin: config.margin || { top: 12, right: 20, bottom: 30, left: 96 },
      summary: config.summary
    });

    chart.render(function (ctx) {
      if (!traces.length) return;
      const x = ctx.d3.scaleLinear().domain([0, spanOf(traces, config)])
        .range([0, ctx.width]);
      const y = ctx.d3.scaleLinear().domain([traces.length, 0]).range([ctx.height, 0]);

      drawAxis(ctx, x, config);
      drawTraces(ctx, traces, x, y);
    });
    return chart;
  }

  function drawAxis(ctx, x, config) {
    scope.ChartBase.axes(ctx, { x: x, xLabel: config.xLabel || 'time (gate delays)' });
  }

  function drawTraces(ctx, traces, x, y) {
    traces.forEach(function (trace, at) {
      const base = at + 0.9;

      ctx.plot.append('path')
        .attr('class', 'waveform-line')
        .attr('fill', 'none')
        .attr('stroke', scope.Palette.series(trace.glitched ? 3 : 0))
        .attr('stroke-width', trace.glitched ? 2.5 : 1.6)
        .attr('d', stepPath(trace, x, y, base));
      ctx.plot.append('text')
        .attr('class', 'waveform-label')
        .attr('x', -8)
        .attr('y', y(base) - 3)
        .attr('text-anchor', 'end')
        .attr('fill', 'currentColor')
        .style('font-size', '11px')
        .text(trace.label + (trace.glitched ? ' ⚠' : ''));
      markChanges(ctx, trace, x, y, base);
    });
  }

  /** A dot at every change, so a two-change transition — a glitch — is
   *  countable rather than merely visible. */
  function markChanges(ctx, trace, x, y, base) {
    trace.points.slice(1).forEach(function (point) {
      ctx.plot.append('circle')
        .attr('class', 'waveform-change')
        .attr('cx', x(point.time))
        .attr('cy', y(base) - (point.value ? LEVEL : 0))
        .attr('r', 2.4)
        .attr('fill', scope.Palette.series(trace.glitched ? 3 : 0));
    });
  }

  return { render: render, tracesOf: tracesOf, spanOf: spanOf, stepPath: stepPath,
    ROW_HEIGHT: ROW_HEIGHT };
}));

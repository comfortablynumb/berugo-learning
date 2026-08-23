/**
 * GrowthPlot - the series plot every cost curve in the platform uses.
 *
 * Linear or log axes, several series, optional markers and a crossover finder.
 * Built on ChartBase so margins, resize and theme colours are decided once.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.GrowthPlot = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  function extent(series, accessor) {
    let min = Infinity;
    let max = -Infinity;
    series.forEach(function (entry) {
      entry.points.forEach(function (point) {
        const value = accessor(point);
        if (!Number.isFinite(value)) return;
        if (value < min) min = value;
        if (value > max) max = value;
      });
    });
    return [min, max];
  }

  /** The smallest strictly positive value a log axis could start at. */
  function lowestPositive(series, accessor) {
    let min = Infinity;
    series.forEach(function (entry) {
      entry.points.forEach(function (point) {
        const value = accessor(point);
        if (Number.isFinite(value) && value > 0 && value < min) min = value;
      });
    });
    return min;
  }

  /* A log scale may not start at zero, and it does not throw when it does -
     `nice()` rounds the floor down to the power of ten below it, zero rounds
     to zero, and every point then maps to NaN. The result is a chart with its
     axes, its grid and its legend drawn and no data in it at all, which is why
     this was invisible to a headless render audit. The floor is forced
     positive here rather than at each of the thirty call sites. */
  function logDomain(span) {
    const hi = Number.isFinite(span[1]) && span[1] > 0 ? span[1] : 1;
    const floor = Number.isFinite(span[0]) && span[0] > 0 ? Math.min(span[0], hi) : hi / 1000;
    return [floor, hi > floor ? hi : floor * 10];
  }

  function makeScale(d3, options) {
    if (options.log) {
      return d3.scaleLog().domain(logDomain(options.domain)).range(options.range).nice();
    }
    const span = options.domain;
    const hi = span[1] > span[0] ? span[1] : span[0] + 1;
    return d3.scaleLinear().domain([span[0], hi]).range(options.range).nice();
  }

  function drawSeries(ctx, series, x, y) {
    const line = ctx.d3.line()
      .defined(function (point) { return Number.isFinite(point.y) && (point.y > 0 || !y.base); })
      .x(function (point) { return x(point.x); })
      .y(function (point) { return y(point.y); });

    series.forEach(function (entry, index) {
      const colour = entry.color || scope.Palette.series(index);

      ctx.plot.append('path')
        .datum(entry.points)
        .attr('fill', 'none')
        .attr('stroke', colour)
        .attr('stroke-width', entry.width || 2)
        .attr('stroke-dasharray', entry.dashed ? '5 3' : null)
        .attr('d', line);

      if (!entry.dots) return;
      ctx.plot.selectAll('.dot-' + index)
        .data(entry.points)
        .enter()
        .append('circle')
        .attr('r', 2.5)
        .attr('cx', function (point) { return x(point.x); })
        .attr('cy', function (point) { return y(point.y); })
        .attr('fill', colour);
    });
  }

  function drawMarkers(ctx, markers, x, y) {
    (markers || []).forEach(function (marker) {
      const px = x(marker.x);
      ctx.plot.append('line')
        .attr('x1', px).attr('x2', px).attr('y1', 0).attr('y2', ctx.height)
        .attr('stroke', marker.color || scope.Palette.hue('red'))
        .attr('stroke-dasharray', '4 3');

      if (!marker.label) return;
      ctx.plot.append('text')
        .attr('class', 'chart-text-strong')
        .attr('x', px + (marker.anchor === 'end' ? -6 : 6))
        .attr('y', marker.labelY === undefined ? 12 : marker.labelY)
        .attr('text-anchor', marker.anchor || 'start')
        .text(marker.label);
    });
  }

  /**
   * render(host, { series, xLabel, yLabel, logX, logY, markers, legendHost })
   * A series is { label, points: [{x, y}], color?, dashed?, dots? }.
   */
  function render(host, config) {
    const chart = scope.ChartBase.create({
      host: host,
      lazyLib: config.lazyLib || scope.BerugoApp.lazyLib,
      height: config.height || 240,
      margin: config.margin,
      summary: config.summary
    });

    chart.render(function (ctx) {
      const series = config.series.filter(function (entry) { return entry.points.length; });
      if (!series.length) return;

      const x = makeScale(ctx.d3, { log: config.logX, domain: extent(series, function (p) { return p.x; }), range: [0, ctx.width] });
      const yTop = extent(series, function (p) { return p.y; })[1];
      const yFloor = config.yMin !== undefined ? config.yMin
        : (config.logY ? lowestPositive(series, function (p) { return p.y; }) : 0);
      const y = makeScale(ctx.d3, { log: config.logY, domain: [yFloor, yTop], range: [ctx.height, 0] });

      scope.ChartBase.grid(ctx, y, { ticks: 5 });
      scope.ChartBase.axes(ctx, {
        x: x, y: y,
        xLabel: config.xLabel, yLabel: config.yLabel,
        xTicks: config.xTicks, yTicks: config.yTicks,
        xFormat: config.xFormat, yFormat: config.yFormat
      });

      drawSeries(ctx, series, x, y);
      drawMarkers(ctx, config.markers, x, y);
    });

    if (config.legendHost) {
      scope.Legend.render(config.legendHost, config.series.map(function (entry, index) {
        return { label: entry.label, color: entry.color || scope.Palette.series(index) };
      }));
    }

    return chart;
  }

  /** The smallest x where series b becomes cheaper than series a. */
  function crossover(a, b) {
    for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
      if (a[i].y > b[i].y) return a[i].x;
    }
    return null;
  }

  return { render: render, crossover: crossover,
    logDomain: logDomain, lowestPositive: lowestPositive };
}));

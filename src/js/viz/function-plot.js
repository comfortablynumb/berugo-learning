/**
 * FunctionPlot - curves over a domain, contour fields with paths drawn on
 * them, and the node markers an interpolation section needs.
 *
 * `GrowthPlot` already draws a series of points against a cost axis, and
 * every convergence curve in this milestone goes through it. What this file
 * adds is the two things it cannot do: several *functions* sampled over a
 * shared domain with their data points marked, and a scalar field drawn as
 * filled contours with an optimiser's path over the top.
 *
 * The y range is clipped rather than fitted for the curve plot, and that is
 * deliberate. A degree-21 polynomial on equally spaced nodes reaches 60 where
 * the function it is interpolating stays inside [0, 1]; fitting the axis to
 * the data would compress the interesting part into a single pixel line and
 * show the reader a spike. Clipping to the function's own range and letting
 * the divergence run off the top shows what actually happened.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.FunctionPlot = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const DEFAULT_HEIGHT = 260;

  function chartFor(host, config) {
    return scope.ChartBase.create({
      host: host,
      lazyLib: config.lazyLib || (scope.BerugoApp ? scope.BerugoApp.lazyLib : null),
      height: config.height || DEFAULT_HEIGHT,
      margin: config.margin,
      summary: config.summary
    });
  }

  function extentOf(series, accessor) {
    let low = Infinity;
    let high = -Infinity;
    series.forEach(function (entry) {
      entry.points.forEach(function (point) {
        const value = accessor(point);
        if (!Number.isFinite(value)) return;
        if (value < low) low = value;
        if (value > high) high = value;
      });
    });
    if (!Number.isFinite(low)) return [0, 1];
    return [low, high === low ? low + 1 : high];
  }

  /**
   * Several curves over one domain.
   *
   * `clip` is the range the y axis is held to. Without it one diverging
   * series decides the axis for all of them and the rest become a flat line;
   * with it, the divergence leaves the frame, which is what a reader needs to
   * see. Points outside the clip are dropped from the path rather than
   * clamped, so the line breaks instead of running along the edge pretending
   * to be data.
   */
  function curves(host, config) {
    const chart = chartFor(host, config);

    chart.render(function (ctx) {
      const series = (config.series || []).filter(function (entry) {
        return entry.points && entry.points.length > 0;
      });
      if (series.length === 0) return;

      const xSpan = config.domain || extentOf(series, function (p) { return p.x; });
      const ySpan = config.clip || extentOf(series, function (p) { return p.y; });
      const x = ctx.d3.scaleLinear().domain(xSpan).range([0, ctx.width]);
      const y = ctx.d3.scaleLinear().domain(ySpan).range([ctx.height, 0]).nice();

      scope.ChartBase.grid(ctx, y, { ticks: 5 });
      scope.ChartBase.axes(ctx, { x: x, y: y, xLabel: config.xLabel, yLabel: config.yLabel });
      drawCurves(ctx, series, x, y, ySpan);
      drawNodes(ctx, config.nodes || [], x, y);
    });
    renderLegend(config, series0(config));
    return chart;
  }

  function series0(config) {
    return (config.series || []).map(function (entry, index) {
      return { label: entry.label, color: entry.color || scope.Palette.series(index) };
    });
  }

  function renderLegend(config, entries) {
    if (!config.legendHost) return;
    scope.Legend.render(config.legendHost, entries);
  }

  function drawCurves(ctx, series, x, y, ySpan) {
    const line = ctx.d3.line()
      .defined(function (point) {
        return Number.isFinite(point.y) && point.y >= ySpan[0] && point.y <= ySpan[1];
      })
      .x(function (point) { return x(point.x); })
      .y(function (point) { return y(point.y); });

    series.forEach(function (entry, index) {
      ctx.plot.append('path')
        .datum(entry.points)
        .attr('fill', 'none')
        .attr('stroke', entry.color || scope.Palette.series(index))
        .attr('stroke-width', entry.width || 2)
        .attr('stroke-dasharray', entry.dashed ? '5 3' : null)
        .attr('d', line);
    });
  }

  /** The data an interpolant was built from, drawn as points so the reader can
   *  see the curve passing through them - and see where the nodes are, which
   *  is the whole subject of the Chebyshev comparison. */
  function drawNodes(ctx, groups, x, y) {
    groups.forEach(function (group, index) {
      ctx.plot.selectAll('.node-' + index)
        .data(group.points)
        .enter()
        .append('circle')
        .attr('r', group.radius || 3.5)
        .attr('cx', function (point) { return x(point.x); })
        .attr('cy', function (point) { return y(point.y); })
        .attr('fill', group.color || scope.Palette.hue('amber'))
        .attr('stroke', 'var(--surface)')
        .attr('stroke-width', 1);
    });
  }

  /**
   * A scalar field as filled bands, with paths over it.
   *
   * The bands are on a log scale of the value, because an optimisation
   * surface spans several orders of magnitude between its floor and its walls
   * and a linear ramp puts every contour the reader cares about in the same
   * colour. Rosenbrock's valley is the case: linear banding shows one dark
   * region and nothing else.
   */
  function contours(host, config) {
    const chart = chartFor(host, config);

    chart.render(function (ctx) {
      const grid = config.grid;
      if (!grid || !grid.values || grid.values.length === 0) return;

      const span = grid.span;
      const x = ctx.d3.scaleLinear().domain([-span, span]).range([0, ctx.width]);
      const y = ctx.d3.scaleLinear().domain([-span, span]).range([ctx.height, 0]);

      paintBands(ctx, grid, x, y);
      scope.ChartBase.axes(ctx, { x: x, y: y, xLabel: config.xLabel, yLabel: config.yLabel });
      drawPaths(ctx, config.paths || [], x, y);
      drawMinimum(ctx, grid.minimum, x, y);
    });
    renderLegend(config, (config.paths || []).map(function (path, index) {
      return { label: path.label, color: path.color || scope.Palette.series(index) };
    }));
    return chart;
  }

  function paintBands(ctx, grid, x, y) {
    const flat = [];
    grid.values.forEach(function (row) {
      row.forEach(function (value) { if (Number.isFinite(value)) flat.push(value); });
    });
    const low = Math.max(Math.min.apply(null, flat), 1e-8);
    const high = Math.max.apply(null, flat);
    const shade = ctx.d3.scaleLog().domain([low, high]).range([0.55, 0.02]).clamp(true);

    const cellWidth = ctx.width / (grid.size - 1);
    const cellHeight = ctx.height / (grid.size - 1);

    grid.values.forEach(function (row, r) {
      row.forEach(function (value, c) {
        ctx.plot.append('rect')
          .attr('x', x(-grid.span + 2 * grid.span * (c / (grid.size - 1))) - cellWidth / 2)
          .attr('y', y(-grid.span + 2 * grid.span * (r / (grid.size - 1))) - cellHeight / 2)
          .attr('width', cellWidth + 1)
          .attr('height', cellHeight + 1)
          .attr('fill', scope.Palette.hue('blue'))
          .attr('opacity', shade(Math.max(value, low)));
      });
    });
  }

  function drawPaths(ctx, paths, x, y) {
    const line = ctx.d3.line()
      .defined(function (point) { return Number.isFinite(point.x) && Number.isFinite(point.y); })
      .x(function (point) { return x(point.x); })
      .y(function (point) { return y(point.y); });

    paths.forEach(function (path, index) {
      const colour = path.color || scope.Palette.series(index);
      ctx.plot.append('path')
        .datum(path.points)
        .attr('fill', 'none')
        .attr('stroke', colour)
        .attr('stroke-width', 1.8)
        .attr('d', line);

      ctx.plot.selectAll('.iterate-' + index)
        .data(path.points.filter(function (point, i) {
          return i % Math.max(1, Math.floor(path.points.length / 40)) === 0;
        }))
        .enter()
        .append('circle')
        .attr('r', 2)
        .attr('cx', function (point) { return x(point.x); })
        .attr('cy', function (point) { return y(point.y); })
        .attr('fill', colour);
    });
  }

  function drawMinimum(ctx, minimum, x, y) {
    if (!minimum) return;
    ctx.plot.append('circle')
      .attr('r', 5)
      .attr('cx', x(minimum[0]))
      .attr('cy', y(minimum[1]))
      .attr('fill', 'none')
      .attr('stroke', scope.Palette.hue('amber'))
      .attr('stroke-width', 2);
  }

  /**
   * A convergence plot: iteration against a quantity that should be falling,
   * on a logarithmic y axis. This is `GrowthPlot` with the axis labels fixed,
   * kept here so a section does not have to remember to pass `logY` - a
   * convergence curve on a linear axis shows a drop to the floor and then a
   * flat line, which is the shape of every convergence curve and tells the
   * reader nothing.
   */
  function convergence(host, config) {
    return scope.GrowthPlot.render(host, {
      lazyLib: config.lazyLib,
      height: config.height || 240,
      logY: true,
      logX: !!config.logX,
      xLabel: config.xLabel || 'iteration',
      yLabel: config.yLabel || 'residual',
      series: config.series,
      markers: config.markers,
      legendHost: config.legendHost
    });
  }

  return {
    curves: curves,
    contours: contours,
    convergence: convergence,
    DEFAULT_HEIGHT: DEFAULT_HEIGHT
  };
}));

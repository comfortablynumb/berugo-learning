/**
 * ErrorBandView - estimate against truth, with the claimed error drawn as a
 * band around the truth.
 *
 * This is the only chart shape M07 really needs, and it exists as a component
 * because the milestone's review criterion is that *every* sketch demo shows
 * the predicted error and the measured error together. A renderer that draws
 * one line makes that easy to forget; this one cannot draw the estimate
 * without being handed the truth to draw it against.
 *
 * Two modes:
 *   `render`  a series over the stream - truth, estimate and the ±bound band.
 *   `scatter` per-key truth against per-key estimate, with the y = x line and
 *             the one-sided error ceiling above it.
 *
 * Built on ChartBase, so margins, resize and theme colours are decided once.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ErrorBandView = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  /* One SVG circle per point stops being reasonable somewhere around here;
     past it the scatter is subsampled rather than drawn in full. */
  const DOT_LIMIT = 3000;

  function chartFor(host, config) {
    return scope.ChartBase.create({
      host: host,
      lazyLib: config.lazyLib || (scope.BerugoApp && scope.BerugoApp.lazyLib),
      height: config.height || 260,
      margin: config.margin,
      summary: config.summary
    });
  }

  function extentOf(points, readers) {
    let min = Infinity;
    let max = -Infinity;
    points.forEach(function (point) {
      readers.forEach(function (read) {
        const value = read(point);
        if (!Number.isFinite(value)) return;
        if (value < min) min = value;
        if (value > max) max = value;
      });
    });
    return [min === Infinity ? 0 : min, max === -Infinity ? 1 : max];
  }

  function scaleFor(ctx, options) {
    const scale = options.log ? ctx.d3.scaleLog() : ctx.d3.scaleLinear();
    const low = options.log ? Math.max(options.domain[0], 1) : options.domain[0];
    const high = options.domain[1] > low ? options.domain[1] : low + 1;
    return scale.domain([low, high]).range(options.range).nice();
  }

  function drawBand(ctx, points, x, y) {
    const area = ctx.d3.area()
      .defined(function (point) { return Number.isFinite(point.bound); })
      .x(function (point) { return x(point.n); })
      .y0(function (point) { return y(Math.max(0, point.truth - point.bound)); })
      .y1(function (point) { return y(point.truth + point.bound); });

    ctx.plot.append('path')
      .datum(points)
      .attr('fill', scope.Palette.seriesSoft(0))
      .attr('opacity', 0.55)
      .attr('d', area);
  }

  function drawLine(ctx, points, x, y, options) {
    const line = ctx.d3.line()
      .defined(function (point) { return Number.isFinite(options.value(point)); })
      .x(function (point) { return x(point.n); })
      .y(function (point) { return y(options.value(point)); });

    ctx.plot.append('path')
      .datum(points)
      .attr('fill', 'none')
      .attr('stroke', options.color)
      .attr('stroke-width', options.width || 2)
      .attr('stroke-dasharray', options.dashed ? '5 3' : null)
      .attr('d', line);
  }

  /**
   * render(host, { points: [{ n, truth, estimate, bound }], ... })
   * The band is drawn first so the two lines sit on top of it.
   */
  function render(host, config) {
    const chart = chartFor(host, config);

    chart.render(function (ctx) {
      const points = config.points.filter(function (point) {
        return Number.isFinite(point.truth) && Number.isFinite(point.estimate);
      });
      if (!points.length) return;

      const span = extentOf(points, [
        function (p) { return p.truth; },
        function (p) { return p.estimate; },
        function (p) { return Number.isFinite(p.bound) ? p.truth + p.bound : p.truth; }
      ]);
      const x = scaleFor(ctx, { log: config.logX, domain: extentOf(points, [function (p) { return p.n; }]), range: [0, ctx.width] });
      const y = scaleFor(ctx, { log: config.logY, domain: [config.yMin === undefined ? 0 : config.yMin, span[1]], range: [ctx.height, 0] });

      scope.ChartBase.grid(ctx, y, { ticks: 5 });
      scope.ChartBase.axes(ctx, {
        x: x, y: y, xLabel: config.xLabel, yLabel: config.yLabel,
        xFormat: config.xFormat, yFormat: config.yFormat
      });

      drawBand(ctx, points, x, y);
      drawLine(ctx, points, x, y, { value: function (p) { return p.truth; }, color: scope.Palette.hue('gray'), dashed: true });
      drawLine(ctx, points, x, y, { value: function (p) { return p.estimate; }, color: scope.Palette.hue('blue') });
    });

    legendFor(config, [
      { label: config.truthLabel || 'exact', color: scope.Palette.hue('gray') },
      { label: config.estimateLabel || 'sketch estimate', color: scope.Palette.hue('blue') },
      { label: config.bandLabel || 'claimed error band', color: scope.Palette.seriesSoft(0) }
    ]);

    return chart;
  }

  function legendFor(config, entries) {
    if (!config.legendHost) return;
    scope.Legend.render(config.legendHost, entries);
  }

  /**
   * A deterministic subsample for a scatter with more points than SVG can
   * carry. One circle per element stops being sensible past a few thousand,
   * and a count-min scatter over a real stream is twenty thousand keys.
   *
   * The heaviest quarter of the budget is spent on the largest values, because
   * those are the points a reader is looking for; the rest is a fixed stride
   * through the tail, so the shape of the cloud survives and the sample does
   * not move between redraws.
   */
  function sampleFor(points, limit) {
    const cap = limit || DOT_LIMIT;
    if (points.length <= cap) return points;

    const sorted = points.slice().sort(function (a, b) { return b.truth - a.truth; });
    const head = sorted.slice(0, Math.floor(cap / 4));
    const rest = sorted.slice(head.length);
    const stride = Math.max(1, Math.ceil(rest.length / (cap - head.length)));
    const tail = [];
    for (let i = 0; i < rest.length; i += stride) tail.push(rest[i]);
    return head.concat(tail);
  }

  function drawDots(ctx, points, x, y) {
    ctx.plot.selectAll('circle.estimate')
      .data(points)
      .enter()
      .append('circle')
      .attr('class', 'estimate')
      .attr('r', 2)
      .attr('cx', function (point) { return x(point.truth); })
      .attr('cy', function (point) { return y(point.estimate); })
      .attr('fill', function (point) { return scope.Palette.series(point.series || 0); })
      .attr('opacity', 0.6);
  }

  function drawGuides(ctx, config, x, y, span) {
    const steps = 40;
    const guides = [];
    for (let i = 0; i <= steps; i += 1) {
      const value = span[0] + (span[1] - span[0]) * (i / steps);
      guides.push({ value: value });
    }

    const identity = ctx.d3.line()
      .x(function (point) { return x(point.value); })
      .y(function (point) { return y(point.value); });
    ctx.plot.append('path').datum(guides)
      .attr('fill', 'none').attr('stroke', scope.Palette.hue('gray'))
      .attr('stroke-width', 1.5).attr('d', identity);

    if (!Number.isFinite(config.bound)) return;
    const ceiling = ctx.d3.line()
      .x(function (point) { return x(point.value); })
      .y(function (point) { return y(point.value + config.bound); });
    ctx.plot.append('path').datum(guides)
      .attr('fill', 'none').attr('stroke', scope.Palette.hue('red'))
      .attr('stroke-width', 1.5).attr('stroke-dasharray', '5 3').attr('d', ceiling);
  }

  /**
   * scatter(host, { points: [{ truth, estimate, series? }], bound, ... })
   * The y = x line is the perfect answer and the dashed line above it is the
   * guarantee; a point above the dashed line is a violated bound, which is the
   * one thing the reader should be able to spot without reading a number.
   */
  function scatter(host, config) {
    const chart = chartFor(host, config);

    chart.render(function (ctx) {
      const points = config.points.filter(function (point) {
        return Number.isFinite(point.truth) && Number.isFinite(point.estimate);
      });
      if (!points.length) return;

      const span = extentOf(points, [function (p) { return p.truth; }]);
      const high = extentOf(points, [
        function (p) { return p.estimate; },
        function (p) { return p.truth + (config.bound || 0); }
      ])[1];
      const low = config.logX ? Math.max(1, span[0]) : 0;

      const x = scaleFor(ctx, { log: config.logX, domain: [low, span[1]], range: [0, ctx.width] });
      const y = scaleFor(ctx, { log: config.logY, domain: [low, high], range: [ctx.height, 0] });

      scope.ChartBase.grid(ctx, y, { ticks: 5 });
      scope.ChartBase.axes(ctx, {
        x: x, y: y, xLabel: config.xLabel || 'true count',
        yLabel: config.yLabel || 'estimate', xFormat: config.xFormat, yFormat: config.yFormat
      });

      drawGuides(ctx, config, x, y, [Math.max(low, span[0]), span[1]]);
      drawDots(ctx, sampleFor(points, config.maxPoints), x, y);
    });

    legendFor(config, (config.legend || []).concat([
      { label: 'exact (y = x)', color: scope.Palette.hue('gray') },
      { label: config.boundLabel || 'guaranteed ceiling', color: scope.Palette.hue('red') }
    ]));

    return chart;
  }

  /**
   * curve(host, { series: [{ label, points: [{x, y}], color? }], markers })
   * The plain multi-series curve the S-curve, the sizing curves and the
   * register histogram all need. It is here rather than in GrowthPlot because
   * these are probability curves on a linear 0-1 axis, not cost curves.
   */
  function curve(host, config) {
    const chart = chartFor(host, config);

    chart.render(function (ctx) {
      const series = config.series.filter(function (entry) { return entry.points.length; });
      if (!series.length) return;

      const all = series.reduce(function (out, entry) { return out.concat(entry.points); }, []);
      const x = scaleFor(ctx, { log: config.logX, domain: extentOf(all, [function (p) { return p.x; }]), range: [0, ctx.width] });
      const y = scaleFor(ctx, {
        log: config.logY,
        domain: [config.yMin === undefined ? 0 : config.yMin, config.yMax === undefined ? extentOf(all, [function (p) { return p.y; }])[1] : config.yMax],
        range: [ctx.height, 0]
      });

      scope.ChartBase.grid(ctx, y, { ticks: 5 });
      scope.ChartBase.axes(ctx, {
        x: x, y: y, xLabel: config.xLabel, yLabel: config.yLabel,
        xFormat: config.xFormat, yFormat: config.yFormat
      });

      series.forEach(function (entry, index) {
        const line = ctx.d3.line()
          .defined(function (point) { return Number.isFinite(point.y); })
          .x(function (point) { return x(point.x); })
          .y(function (point) { return y(point.y); });
        ctx.plot.append('path').datum(entry.points)
          .attr('fill', 'none')
          .attr('stroke', entry.color || scope.Palette.series(index))
          .attr('stroke-width', entry.width || 2)
          .attr('stroke-dasharray', entry.dashed ? '5 3' : null)
          .attr('d', line);
      });

      (config.markers || []).forEach(function (marker) {
        const px = x(marker.x);
        ctx.plot.append('line')
          .attr('x1', px).attr('x2', px).attr('y1', 0).attr('y2', ctx.height)
          .attr('stroke', scope.Palette.hue('red')).attr('stroke-dasharray', '4 3');
        if (!marker.label) return;
        ctx.plot.append('text').attr('class', 'chart-text-strong')
          .attr('x', px + 6).attr('y', 12).text(marker.label);
      });
    });

    legendFor(config, config.series.map(function (entry, index) {
      return { label: entry.label, color: entry.color || scope.Palette.series(index) };
    }));

    return chart;
  }

  /** Bars, for a register histogram or a bucket-occupancy profile. */
  function bars(host, config) {
    const chart = chartFor(host, config);

    chart.render(function (ctx) {
      const values = config.values;
      if (!values.length) return;

      const x = ctx.d3.scaleBand().domain(values.map(function (entry) { return entry.label; }))
        .range([0, ctx.width]).padding(0.15);
      /* A log scale is offered because some of these comparisons span three
         orders of magnitude - a prefix-sum update against a Fenwick one - and
         a linear axis there is one bar and four slivers. */
      const y = scaleFor(ctx, {
        log: config.logY,
        domain: [0, extentOf(values, [function (p) { return p.value; }])[1]],
        range: [ctx.height, 0]
      });

      scope.ChartBase.grid(ctx, y, { ticks: 4 });
      scope.ChartBase.axes(ctx, { x: x, y: y, xLabel: config.xLabel, yLabel: config.yLabel });

      ctx.plot.selectAll('rect.bar').data(values).enter().append('rect')
        .attr('class', 'bar')
        .attr('x', function (entry) { return x(entry.label); })
        .attr('y', function (entry) { return y(entry.value); })
        .attr('width', x.bandwidth())
        .attr('height', function (entry) { return ctx.height - y(entry.value); })
        .attr('fill', function (entry, index) { return scope.Palette.series(entry.series === undefined ? 0 : entry.series || index * 0); });
    });

    return chart;
  }

  return { render: render, scatter: scatter, curve: curve, bars: bars, sampleFor: sampleFor, DOT_LIMIT: DOT_LIMIT };
}));

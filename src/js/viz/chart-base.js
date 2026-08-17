/**
 * ChartBase - the only place that knows the margin convention, the resize
 * behaviour and the axis styling.
 *
 * Every chart in the platform is created here and draws through the context it
 * hands back, so a renderer never repeats layout maths and never reaches for a
 * colour literal (colours come from Palette, which reads the theme's CSS
 * variables). D3 is loaded lazily on the first chart the learner actually
 * opens.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ChartBase = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const DEFAULT_MARGIN = { top: 12, right: 16, bottom: 28, left: 44 };

  /* Every live chart, so a container that was hidden when it drew can be
     repainted the moment it is shown. A chart drawn inside a hidden tab panel
     measures no width and falls back to the 220px floor; without this it would
     keep that width until something else resized it. */
  const live = new Set();

  /** Repaints the charts whose host is actually laid out. Hidden ones are left
   *  alone: they would measure nothing, and they repaint when shown. */
  function refreshVisible() {
    let repainted = 0;
    live.forEach(function (chart) {
      const node = chart.host();
      if (!node || !node.offsetWidth) return;
      chart.redraw();
      repainted += 1;
    });
    return repainted;
  }

  function configure(options) {
    const settings = options || {};
    return {
      host: settings.host,
      lazyLib: settings.lazyLib || (typeof window !== 'undefined' ? window.BerugoApp && window.BerugoApp.lazyLib : null),
      height: settings.height || 240,
      margin: Object.assign({}, DEFAULT_MARGIN, settings.margin || {}),
      summaryFn: settings.summary || null
    };
  }

  function measureWidth(host, fallback) {
    const rect = host.getBoundingClientRect();
    return Math.max(220, Math.round(rect.width || fallback || 480));
  }

  function create(options) {
    const config = configure(options);
    const host = config.host;
    if (!host) throw new Error('ChartBase.create requires a host element');

    host.classList.add('chart-host');

    let drawFn = null;
    let context = null;
    let observer = null;
    let disposed = false;

    function buildContext(d3) {
      host.innerHTML = '';
      const width = measureWidth(host, 480);
      const height = config.height;
      const inner = {
        width: width - config.margin.left - config.margin.right,
        height: height - config.margin.top - config.margin.bottom
      };

      const svg = d3.select(host).append('svg')
        .attr('viewBox', '0 0 ' + width + ' ' + height)
        .attr('preserveAspectRatio', 'xMidYMid meet')
        .attr('role', 'img');

      const plot = svg.append('g')
        .attr('transform', 'translate(' + config.margin.left + ',' + config.margin.top + ')');

      return {
        d3: d3, svg: svg, plot: plot,
        width: inner.width, height: inner.height,
        outerWidth: width, outerHeight: height,
        margin: config.margin,
        host: host
      };
    }

    function paint() {
      if (disposed || !drawFn) return null;
      return config.lazyLib.d3().then(function (d3) {
        if (disposed) return null;
        context = buildContext(d3);
        drawFn(context);
        applySummary();
        return context;
      });
    }

    function applySummary() {
      if (!config.summaryFn) return;
      const text = config.summaryFn();
      if (!text) return;
      context.svg.attr('aria-label', text);
      let node = host.parentNode && host.parentNode.querySelector('.viz-summary');
      if (!node && host.parentNode) {
        node = document.createElement('p');
        node.className = 'viz-summary';
        host.parentNode.appendChild(node);
      }
      if (node) node.textContent = text;
    }

    function observeResize() {
      if (observer || typeof ResizeObserver === 'undefined') return;
      let last = measureWidth(host, 480);
      observer = new ResizeObserver(function () {
        const next = measureWidth(host, 480);
        if (Math.abs(next - last) < 8) return;
        last = next;
        paint();
      });
      observer.observe(host);
    }

    function render(fn) {
      drawFn = fn;
      observeResize();
      return paint();
    }

    function destroy() {
      disposed = true;
      if (observer) observer.disconnect();
      observer = null;
      live.delete(handle);
      host.innerHTML = '';
    }

    const handle = {
      render: render,
      redraw: paint,
      destroy: destroy,
      host: function () { return host; },
      context: function () { return context; }
    };

    live.add(handle);
    return handle;
  }

  /** Bottom and left axes with the platform's classes; never call d3.axis
   *  directly from a section, or the styling drifts. */
  function axes(ctx, options) {
    const settings = options || {};
    if (settings.x) {
      const axis = ctx.d3.axisBottom(settings.x).ticks(settings.xTicks || 6);
      if (settings.xFormat) axis.tickFormat(settings.xFormat);
      ctx.plot.append('g')
        .attr('class', 'chart-axis')
        .attr('transform', 'translate(0,' + ctx.height + ')')
        .call(axis);
    }

    if (settings.y) {
      const axis = ctx.d3.axisLeft(settings.y).ticks(settings.yTicks || 5);
      if (settings.yFormat) axis.tickFormat(settings.yFormat);
      ctx.plot.append('g').attr('class', 'chart-axis').call(axis);
    }

    if (settings.xLabel) {
      ctx.plot.append('text')
        .attr('class', 'chart-text')
        .attr('x', ctx.width / 2)
        .attr('y', ctx.height + ctx.margin.bottom - 2)
        .attr('text-anchor', 'middle')
        .text(settings.xLabel);
    }

    if (settings.yLabel) {
      ctx.plot.append('text')
        .attr('class', 'chart-text')
        .attr('transform', 'rotate(-90)')
        .attr('x', -ctx.height / 2)
        .attr('y', -ctx.margin.left + 12)
        .attr('text-anchor', 'middle')
        .text(settings.yLabel);
    }

    return ctx;
  }

  function grid(ctx, scale, options) {
    const settings = options || {};
    const axis = ctx.d3.axisLeft(scale).ticks(settings.ticks || 5).tickSize(-ctx.width).tickFormat('');
    ctx.plot.append('g').attr('class', 'chart-grid').call(axis);
    return ctx;
  }

  function title(ctx, text) {
    ctx.plot.append('text').attr('class', 'chart-title').attr('x', 0).attr('y', -2).text(text);
    return ctx;
  }

  return {
    create: create,
    axes: axes,
    grid: grid,
    title: title,
    refreshVisible: refreshVisible,
    liveCount: function () { return live.size; },
    DEFAULT_MARGIN: DEFAULT_MARGIN
  };
}));

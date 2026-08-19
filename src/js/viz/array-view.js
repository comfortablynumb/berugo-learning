/**
 * ArrayView - the array as bars, with the pointers drawn on top.
 *
 * Every sort in M10 is a story about *where the pointers are*, and a picture
 * of the values alone tells none of it. So a bar chart is the background and
 * the annotations are the content: the pivot, the two Hoare cursors, the
 * sorted prefix, the run boundaries Timsort found, the partition regions the
 * Dutch flag has settled. A frame here is a labelled state of one algorithm,
 * not an animation of an array changing colour.
 *
 * Canvas rather than SVG: a bar per element at 2 000 elements is 2 000 nodes
 * that get restyled on every step, which is exactly the size at which the
 * picture starts being worth looking at.
 *
 * Three entry points, and none of them animate on a timer - the learner
 * drives the step, because a sort that plays past the interesting moment has
 * shown nothing:
 *
 *   bars(host, config)     values as heights, with regions and markers
 *   runs(host, config)     the same array with detected runs banded, for
 *                          natural merge and Timsort
 *   compare(host, config)  two algorithms' counters side by side over the
 *                          same input
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ArrayView = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const PADDING = 8;
  const LABEL_BAND = 16;

  function palette() {
    return scope.Palette;
  }

  function surfaceFor(host, config) {
    return scope.CanvasSurface.create({
      host: host,
      height: config.height || 220,
      ariaLabel: config.ariaLabel || config.summary || 'array view'
    });
  }

  function summarise(host, text) {
    if (!text || !host.parentNode) return;
    let node = host.parentNode.querySelector('.viz-summary');
    if (!node) {
      node = document.createElement('p');
      node.className = 'viz-summary';
      host.parentNode.appendChild(node);
    }
    node.textContent = text;
  }

  /** Region fills, by role. Named rather than indexed so a template asking
   *  for 'pivot' cannot silently get the 'sorted' colour after a reorder. */
  function fillFor(colours, role) {
    const roles = {
      base: colours.soft('gray'),
      sorted: colours.hue('green'),
      active: colours.hue('blue'),
      pivot: colours.hue('orange'),
      less: colours.hue('blue'),
      equal: colours.hue('orange'),
      greater: colours.hue('purple'),
      discarded: colours.soft('gray'),
      run: colours.hue('teal')
    };
    return roles[role] || roles.base;
  }

  function roleAt(index, regions) {
    for (let i = 0; i < regions.length; i += 1) {
      const region = regions[i];
      if (index >= region.from && index < region.to) return region.role;
    }
    return 'base';
  }

  function scaleFor(values) {
    let low = Infinity;
    let high = -Infinity;
    values.forEach(function (value) {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) return;
      if (numeric < low) low = numeric;
      if (numeric > high) high = numeric;
    });
    if (!Number.isFinite(low)) { low = 0; high = 1; }
    if (high === low) high = low + 1;
    return { low: low, high: high, span: high - low };
  }

  function drawBars(ctx, dims, state) {
    const values = state.values;
    const scale = scaleFor(values);
    const usableWidth = dims.width - 2 * PADDING;
    const usableHeight = dims.height - 2 * PADDING - LABEL_BAND;
    const step = usableWidth / Math.max(1, values.length);
    const barWidth = Math.max(1, step * (values.length > 200 ? 1 : 0.82));

    values.forEach(function (value, index) {
      const height = ((Number(value) - scale.low) / scale.span) * usableHeight;
      const x = PADDING + index * step;
      ctx.fillStyle = fillFor(state.colours, roleAt(index, state.regions));
      ctx.fillRect(x, PADDING + usableHeight - height, barWidth, Math.max(1, height));
    });

    return { step: step, usableHeight: usableHeight, barWidth: barWidth };
  }

  /** Pointer markers under the bars. A cursor without a label is a mystery,
   *  so every marker carries its name. */
  function drawMarkers(ctx, dims, state, geometry) {
    const baseline = PADDING + geometry.usableHeight;
    ctx.font = '10px ui-monospace, monospace';
    ctx.textBaseline = 'top';

    state.markers.forEach(function (marker) {
      if (marker.at === undefined || marker.at === null) return;
      const x = PADDING + marker.at * geometry.step + geometry.barWidth / 2;
      ctx.strokeStyle = fillFor(state.colours, marker.role || 'active');
      ctx.fillStyle = fillFor(state.colours, marker.role || 'active');
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, baseline + 2);
      ctx.lineTo(x - 3.5, baseline + 8);
      ctx.lineTo(x + 3.5, baseline + 8);
      ctx.closePath();
      ctx.fill();
      if (marker.label) ctx.fillText(marker.label, Math.max(0, x - 6), baseline + 9);
    });
  }

  /**
   * bars(host, {
   *   values, regions: [{ from, to, role }], markers: [{ at, label, role }],
   *   height, summary
   * })
   */
  function bars(host, config) {
    const surface = surfaceFor(host, config);
    let current = config;

    function paint(ctx, dims) {
      const colours = palette();
      ctx.fillStyle = colours.token('surface-sunken');
      ctx.fillRect(0, 0, dims.width, dims.height);

      const state = {
        colours: colours,
        values: current.values || [],
        regions: current.regions || [],
        markers: current.markers || []
      };
      if (!state.values.length) return;
      const geometry = drawBars(ctx, dims, state);
      drawMarkers(ctx, dims, state, geometry);
    }

    surface.render(paint);
    summarise(host, config.summary);

    return {
      redraw: function () { return surface.redraw(); },
      update: function (next) {
        current = Object.assign({}, current, next);
        summarise(host, current.summary);
        return surface.redraw();
      },
      destroy: function () { surface.destroy(); }
    };
  }

  /**
   * runs(host, { values, runs: [{ from, to }], height, summary })
   *
   * The array with its detected runs banded in alternating tones. On nearly
   * sorted input this is the picture that explains Timsort in one glance:
   * a handful of wide bands rather than n/32 uniform ones.
   */
  function runs(host, config) {
    const surface = surfaceFor(host, config);
    let current = config;

    function paint(ctx, dims) {
      const colours = palette();
      ctx.fillStyle = colours.token('surface-sunken');
      ctx.fillRect(0, 0, dims.width, dims.height);

      const values = current.values || [];
      const detected = current.runs || [];
      if (!values.length) return;

      const regions = detected.map(function (run, index) {
        return { from: run.from, to: run.to, role: index % 2 === 0 ? 'run' : 'active' };
      });
      const state = { colours: colours, values: values, regions: regions, markers: [] };
      const geometry = drawBars(ctx, dims, state);

      ctx.strokeStyle = colours.token('border');
      ctx.lineWidth = 1;
      detected.forEach(function (run) {
        const x = PADDING + run.from * geometry.step;
        ctx.beginPath();
        ctx.moveTo(x, PADDING);
        ctx.lineTo(x, PADDING + geometry.usableHeight);
        ctx.stroke();
      });
    }

    surface.render(paint);
    summarise(host, config.summary);

    return {
      redraw: function () { return surface.redraw(); },
      update: function (next) {
        current = Object.assign({}, current, next);
        summarise(host, current.summary);
        return surface.redraw();
      },
      destroy: function () { surface.destroy(); }
    };
  }

  /**
   * compare(host, { rows: [{ label, comparisons, moves, swaps }], height })
   *
   * A grouped bar per algorithm on a log axis, because the spread between an
   * elementary sort and a library sort on the same input is three orders of
   * magnitude and a linear axis shows one bar and fourteen slivers.
   */
  function compare(host, config) {
    const surface = surfaceFor(host, config);
    let current = config;

    function paint(ctx, dims) {
      const colours = palette();
      ctx.fillStyle = colours.token('surface-sunken');
      ctx.fillRect(0, 0, dims.width, dims.height);

      const rows = current.rows || [];
      if (!rows.length) return;

      const peak = rows.reduce(function (best, row) {
        return Math.max(best, row.comparisons || 0, row.moves || 0);
      }, 1);
      const logPeak = Math.log10(Math.max(10, peak));
      const usableWidth = dims.width - 2 * PADDING;
      const usableHeight = dims.height - 2 * PADDING - LABEL_BAND;
      const step = usableWidth / rows.length;

      ctx.font = '9px ui-monospace, monospace';
      ctx.textBaseline = 'top';

      rows.forEach(function (row, index) {
        const x = PADDING + index * step;
        drawPair(ctx, colours, row, x, step, usableHeight, logPeak);
        ctx.fillStyle = colours.token('text-muted');
        ctx.fillText(String(row.label || '').slice(0, 12), x, PADDING + usableHeight + 3);
      });
    }

    function drawPair(ctx, colours, row, x, step, usableHeight, logPeak) {
      const width = Math.max(2, step * 0.36);
      const pairs = [
        { value: row.comparisons || 0, colour: colours.hue('blue') },
        { value: row.moves || 0, colour: colours.hue('orange') }
      ];
      pairs.forEach(function (pair, at) {
        const height = pair.value <= 0 ? 0
          : (Math.log10(Math.max(10, pair.value)) / logPeak) * usableHeight;
        ctx.fillStyle = pair.colour;
        ctx.fillRect(x + at * (width + 2), PADDING + usableHeight - height, width, Math.max(1, height));
      });
    }

    surface.render(paint);
    summarise(host, config.summary);

    return {
      redraw: function () { return surface.redraw(); },
      update: function (next) {
        current = Object.assign({}, current, next);
        summarise(host, current.summary);
        return surface.redraw();
      },
      destroy: function () { surface.destroy(); }
    };
  }

  return { bars: bars, runs: runs, compare: compare, fillFor: fillFor, roleAt: roleAt };
}));

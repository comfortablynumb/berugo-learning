/**
 * NetworkView - the comparator lattice of a sorting network.
 *
 * A sorting network is one of the few algorithms whose *whole* definition
 * fits in a picture: n horizontal wires, and a vertical connector wherever
 * two of them are compare-exchanged. Reading a network diagram is reading the
 * algorithm, which is not true of any other sort in this milestone.
 *
 * The layout carries the point the section is making. Comparators are placed
 * by *round* rather than by their position in the list, so everything drawn
 * in the same column happens simultaneously on a machine with enough lanes.
 * The width of the picture is the depth, and the depth is the parallel
 * running time - so "bitonic is O(log² n) deep" is something the reader can
 * count off the diagram instead of taking on faith.
 *
 * Canvas, because a 1 024-wire network is 28 160 comparators and SVG stops
 * being interactive well before that. Small networks are the readable ones
 * and large ones are drawn to show the shape rather than the detail.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.NetworkView = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const PADDING = 14;
  const MIN_COLUMN = 6;

  function palette() {
    return scope.Palette;
  }

  function surfaceFor(host, config) {
    return scope.CanvasSurface.create({
      host: host,
      height: config.height || 240,
      ariaLabel: config.ariaLabel || config.summary || 'sorting network diagram'
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

  /** Group comparators into their rounds. A round is a set of comparators on
   *  disjoint wires, so drawing them in one column is a claim about
   *  parallelism rather than a layout convenience. */
  function columnsOf(network) {
    const columns = [];
    network.comparators.forEach(function (comparator) {
      const round = comparator.round || 0;
      if (!columns[round]) columns[round] = [];
      columns[round].push(comparator);
    });
    return columns.filter(Boolean);
  }

  function geometryFor(dims, network, columns) {
    const usableWidth = dims.width - 2 * PADDING;
    const usableHeight = dims.height - 2 * PADDING;
    return {
      wireGap: usableHeight / Math.max(1, network.size - 1),
      columnGap: Math.max(MIN_COLUMN, usableWidth / Math.max(1, columns.length)),
      usableWidth: usableWidth,
      usableHeight: usableHeight
    };
  }

  function drawWires(ctx, colours, network, geometry) {
    ctx.strokeStyle = colours.token('border');
    ctx.lineWidth = 1;
    for (let wire = 0; wire < network.size; wire += 1) {
      const y = PADDING + wire * geometry.wireGap;
      ctx.beginPath();
      ctx.moveTo(PADDING, y);
      ctx.lineTo(PADDING + geometry.usableWidth, y);
      ctx.stroke();
    }
  }

  function drawComparator(ctx, colours, comparator, x, geometry, highlighted) {
    const top = PADDING + Math.min(comparator.a, comparator.b) * geometry.wireGap;
    const bottom = PADDING + Math.max(comparator.a, comparator.b) * geometry.wireGap;
    const colour = highlighted ? colours.hue('orange')
      : (comparator.ascending === false ? colours.hue('purple') : colours.hue('blue'));

    ctx.strokeStyle = colour;
    ctx.fillStyle = colour;
    ctx.lineWidth = highlighted ? 2.5 : 1.5;
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, bottom);
    ctx.stroke();

    const dot = Math.max(1.5, Math.min(3.5, geometry.wireGap / 4));
    [top, bottom].forEach(function (y) {
      ctx.beginPath();
      ctx.arc(x, y, dot, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  /**
   * lattice(host, { network, highlightRound, missing, height, summary })
   *
   * `missing` marks a deleted comparator so the demo can show a broken
   * network next to the working one - the gap in the lattice is the bug, and
   * it is one column wide.
   */
  function lattice(host, config) {
    const surface = surfaceFor(host, config);
    let current = config;

    function paint(ctx, dims) {
      const colours = palette();
      ctx.fillStyle = colours.token('surface-sunken');
      ctx.fillRect(0, 0, dims.width, dims.height);

      const network = current.network;
      if (!network || !network.size) return;

      const columns = columnsOf(network);
      const geometry = geometryFor(dims, network, columns);
      drawWires(ctx, colours, network, geometry);

      let index = 0;
      columns.forEach(function (column, round) {
        const spread = column.length > 1 ? Math.min(geometry.columnGap / column.length, 4) : 0;
        column.forEach(function (comparator, at) {
          const x = PADDING + round * geometry.columnGap + geometry.columnGap / 2
            + (at - (column.length - 1) / 2) * spread;
          const highlighted = current.highlightRound === round || current.missing === index;
          drawComparator(ctx, colours, comparator, x, geometry, highlighted);
          index += 1;
        });
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
   * depths(host, { rows: [{ label, comparators, depth }], height, summary })
   *
   * Comparators against depth for a set of sizes, on a log axis. The gap
   * between the two curves is the entire argument for a network: the work
   * grows and the *time* does not, given lanes to spend.
   */
  function depths(host, config) {
    const surface = surfaceFor(host, config);
    let current = config;

    function paint(ctx, dims) {
      const colours = palette();
      ctx.fillStyle = colours.token('surface-sunken');
      ctx.fillRect(0, 0, dims.width, dims.height);

      const rows = current.rows || [];
      if (!rows.length) return;

      const peak = rows.reduce(function (best, row) {
        return Math.max(best, row.comparators || 0, row.depth || 0);
      }, 10);
      const logPeak = Math.log10(Math.max(10, peak));
      const usableWidth = dims.width - 2 * PADDING;
      const usableHeight = dims.height - 2 * PADDING - 14;
      const step = usableWidth / rows.length;

      ctx.font = '9px ui-monospace, monospace';
      ctx.textBaseline = 'top';

      rows.forEach(function (row, index) {
        const x = PADDING + index * step;
        const width = Math.max(2, step * 0.36);
        [
          { value: row.comparators || 0, colour: colours.hue('blue') },
          { value: row.depth || 0, colour: colours.hue('green') }
        ].forEach(function (pair, at) {
          const height = pair.value <= 0 ? 0
            : (Math.log10(Math.max(10, pair.value)) / logPeak) * usableHeight;
          ctx.fillStyle = pair.colour;
          ctx.fillRect(x + at * (width + 2), PADDING + usableHeight - height, width, Math.max(1, height));
        });
        ctx.fillStyle = colours.token('text-muted');
        ctx.fillText(String(row.label || '').slice(0, 10), x, PADDING + usableHeight + 3);
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

  return { lattice: lattice, depths: depths, columnsOf: columnsOf };
}));

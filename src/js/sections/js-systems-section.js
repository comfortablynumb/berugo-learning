/**
 * Section: JavaScript as a systems language.
 *
 * One eight-byte buffer, several views over it, and a chart of the gap between
 * representable doubles. The byte grid is the point: bits are editable, and
 * every reading updates from the same memory.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'js-systems';
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  let chart = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID) return;
      if (!app.markRendered(SECTION_ID)) return;
      render(app);
    });

    app.state.subscribe('theme', function () {
      if (chart) chart.redraw();
    });
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render({
      sectionId: SECTION_ID,
      orientation: [
        'A buffer is bytes; a view is an interpretation of those bytes. Once that separation is ' +
          'concrete, the rest of this platform - a CPU with real registers, a page table, a packet ' +
          'parser - is ordinary JavaScript rather than metaphor.',
        'Two boundaries are worth memorising. Bitwise operators coerce to 32 bits, so anything above ' +
          '2³¹ wraps or turns negative. And every number is a float64, so integers stop being exact ' +
          'at 2⁵³ - the chart below shows exactly where.',
        'Flip a bit in the grid and watch every reading change at once.'
      ],
      demo: { title: 'Interactive demo — one buffer, six views', markup: root.JsSystemsTemplate.render() },
      diagram: {
        title: 'Diagram — the numeric tower and where it coerces',
        caption: 'Every path back to a Number goes through float64; the 32-bit path is the exception.',
        definition: [
          'flowchart LR',
          '    N["Number (float64)"] -->|"& | ^ << >> ~"| I32["int32"]',
          '    N -->|">>> 0"| U32["uint32"]',
          '    I32 --> N',
          '    U32 --> N',
          '    N -->|"BigInt(x)"| B["BigInt (arbitrary precision)"]',
          '    B -->|"Number(b) — may<br/>lose precision"| N',
          '    N -->|"exact while |x| < 2^53"| SAFE["safe integers"]',
          '    N -->|"|x| >= 2^53"| GAP["gap >= 2 — integers skip"]'
        ].join('\n')
      },
      insight: 'Nearly every "JavaScript cannot do systems programming" objection is really "I did ' +
        'not know about typed arrays". Everything below this section - the CPU, the allocator, the ' +
        'packet parser - is built on exactly these primitives.'
    }));

    app.shell.mount({ sectionId: SECTION_ID, app: app });
    bind();
    writeValue();
    paintAll();
    drawUlpChart(app);
  }

  function bind() {
    const $ = root.jQuery;

    $('#bytes-input').on('input', function () { writeValue(); paintAll(); });
    $('#bytes-type, #bytes-le').on('change', function () { writeValue(); paintAll(); });

    $('#bytes-grid').on('click', '[data-bit]', function () {
      const index = Number($(this).attr('data-byte'));
      const position = Number($(this).attr('data-bit'));
      view.setUint8(index, view.getUint8(index) ^ (1 << position));
      paintAll();
    });
  }

  function littleEndian() {
    return root.jQuery('#bytes-le').is(':checked');
  }

  function writeValue() {
    const raw = String(root.jQuery('#bytes-input').val()).trim();
    const kind = String(root.jQuery('#bytes-type').val());
    const le = littleEndian();

    for (let i = 0; i < 8; i += 1) view.setUint8(i, 0);

    try {
      if (kind === 'bigint64') view.setBigInt64(0, BigInt(raw || '0'), le);
      else if (kind === 'float64') view.setFloat64(0, Number(raw), le);
      else if (kind === 'float32') view.setFloat32(0, Number(raw), le);
      else if (kind === 'int32') view.setInt32(0, Number(raw) | 0, le);
      else if (kind === 'uint32') view.setUint32(0, Number(raw) >>> 0, le);
      else if (kind === 'int8') view.setInt8(0, Number(raw) | 0);
    } catch (error) {
      // An unparseable entry leaves the buffer zeroed; the readings show that.
    }
  }

  function paintAll() {
    paintGrid();
    paintFields();
    paintReadings();
  }

  function paintGrid() {
    const rows = [];
    for (let i = 0; i < 8; i += 1) {
      const byte = view.getUint8(i);
      const bits = [];
      for (let b = 7; b >= 0; b -= 1) {
        const set = (byte >> b) & 1;
        bits.push('<span class="chip" data-byte="' + i + '" data-bit="' + b + '" ' +
          'style="cursor:pointer;background:' + (set ? 'var(--hue-blue-soft)' : 'var(--hue-gray-soft)') +
          ';color:' + (set ? 'var(--hue-blue)' : 'var(--text-muted)') + '">' + set + '</span>');
      }
      rows.push('<div style="display:flex;gap:.25rem;align-items:center;margin-bottom:.25rem">' +
        '<span class="note" style="width:3.5rem">byte ' + i + '</span>' + bits.join('') +
        '<span class="note" style="margin-left:.5rem">0x' +
        byte.toString(16).padStart(2, '0') + '</span></div>');
    }
    root.jQuery('#bytes-grid').html(rows.join(''));
  }

  function paintFields() {
    const le = littleEndian();
    const bits = view.getBigUint64(0, le);
    const sign = (bits >> 63n) & 1n;
    const exponent = Number((bits >> 52n) & 0x7ffn);
    const mantissa = bits & 0xfffffffffffffn;

    root.jQuery('#bytes-fields').html('<div class="equation"><div class="eq-label">as a float64</div>' +
      'sign ' + sign + ' · biased exponent ' + exponent + ' (unbiased ' + (exponent - 1023) + ') · ' +
      'mantissa 0x' + mantissa.toString(16) + '</div>');
  }

  function paintReadings() {
    const le = littleEndian();
    const value = view.getFloat64(0, le);
    const rows = [
      ['Float64', String(value), 'the value a JavaScript number holds'],
      ['Float32 (first 4 bytes)', String(view.getFloat32(0, le)), 'half the mantissa, one quarter of the bytes'],
      ['Int32 (first 4 bytes)', String(view.getInt32(0, le)), 'what & | ^ would see'],
      ['Uint32 (first 4 bytes)', String(view.getUint32(0, le)), 'what >>> 0 produces'],
      ['BigInt64', view.getBigInt64(0, le).toString(), 'exact, arbitrary precision'],
      ['ulp at this magnitude', describeUlp(value), 'gap to the next representable double']
    ];

    root.jQuery('#bytes-readings tbody').html(rows.map(function (row) {
      return '<tr><td>' + root.Helpers.escapeHtml(row[0]) + '</td>' +
        '<td class="mono">' + root.Helpers.escapeHtml(row[1]) + '</td>' +
        '<td class="note">' + root.Helpers.escapeHtml(row[2]) + '</td></tr>';
    }).join(''));
  }

  function ulpOf(x) {
    if (!Number.isFinite(x) || x === 0) return Number.MIN_VALUE;
    const exponent = Math.floor(Math.log2(Math.abs(x)));
    return Math.pow(2, exponent - 52);
  }

  function describeUlp(x) {
    const ulp = ulpOf(x);
    return ulp.toExponential(3) + (ulp >= 1 ? '  (integers skip)' : '');
  }

  function drawUlpChart(app) {
    chart = root.ChartBase.create({
      host: root.jQuery('#ulp-chart')[0], lazyLib: app.lazyLib, height: 220,
      summary: function () {
        return 'Gap between representable doubles against magnitude, log-log. The gap reaches 1 at ' +
          '2^52 and 2 at 2^53, which is why MAX_SAFE_INTEGER is 2^53 - 1.';
      }
    });

    chart.render(function (ctx) {
      const points = [];
      for (let e = -20; e <= 62; e += 1) points.push({ x: Math.pow(2, e), y: Math.pow(2, e - 52) });

      const x = ctx.d3.scaleLog().domain([Math.pow(2, -20), Math.pow(2, 62)]).range([0, ctx.width]);
      const y = ctx.d3.scaleLog().domain([Math.pow(2, -72), Math.pow(2, 10)]).range([ctx.height, 0]);

      root.ChartBase.grid(ctx, y, { ticks: 5 });
      root.ChartBase.axes(ctx, {
        x: x, y: y, xTicks: 6, yTicks: 5,
        xFormat: function (d) { return '2^' + Math.round(Math.log2(d)); },
        yFormat: function (d) { return '2^' + Math.round(Math.log2(d)); },
        xLabel: 'magnitude', yLabel: 'ulp'
      });

      ctx.plot.append('path')
        .datum(points)
        .attr('fill', 'none')
        .attr('stroke', root.Palette.hue('blue'))
        .attr('stroke-width', 2)
        .attr('d', ctx.d3.line().x(function (d) { return x(d.x); }).y(function (d) { return y(d.y); }));

      markBoundary(ctx, x, y);
    });
  }

  function markBoundary(ctx, x, y) {
    const boundary = Math.pow(2, 53);
    ctx.plot.append('line')
      .attr('x1', x(boundary)).attr('x2', x(boundary))
      .attr('y1', 0).attr('y2', ctx.height)
      .attr('stroke', root.Palette.hue('red'))
      .attr('stroke-dasharray', '4 3');

    ctx.plot.append('circle')
      .attr('cx', x(boundary)).attr('cy', y(2)).attr('r', 4)
      .attr('fill', root.Palette.hue('red'));

    ctx.plot.append('text')
      .attr('class', 'chart-text-strong')
      .attr('x', x(boundary) - 6)
      .attr('y', y(2) - 8)
      .attr('text-anchor', 'end')
      .text('2^53: gap = 2');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

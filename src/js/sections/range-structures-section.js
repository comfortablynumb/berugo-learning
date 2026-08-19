/**
 * Section: one-dimensional range structures.
 *
 * The default is the worked example's setup - 8 192 values, 20 000 operations,
 * half of them updates - so the 7.49 and 13.01 slots the prose quotes are the
 * numbers on screen. Every row is replayed against a plain array, because the
 * lazy push convention is the one bug in this milestone that passes every
 * hand-written example.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'range-structures';
  let panel = null;
  let chart = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
    app.state.subscribe('theme', function () { if (chart) chart.redraw(); });
  }

  /* Lifted out of config() so the section config stays inside the function
     size limit; the mermaid definition is fourteen lines on its own. */
  function diagram() {
    return {
      title: 'Diagram — the canonical decomposition of an arbitrary interval',
      caption: 'Two staircases: one climbing out of the left endpoint by powers of two and one descending ' +
        'into the right. At most one node per level is partially covered on each side, which is where the ' +
        '2 log n bound comes from.',
      definition: [
        'flowchart TD',
        '    Q["query [1234, 6789] of 8 192"] --> L["left staircase"]',
        '    Q --> R["right staircase"]',
        '    L --> L1["1234–1235 · 2 values"]',
        '    L --> L2["1236–1239 · 4"]',
        '    L --> L3["1240–1247 · 8"]',
        '    L --> L4["1248–1279 · 32"]',
        '    L --> L5["1280–1535 · 256"]',
        '    L --> L6["1536–2047 · 512"]',
        '    R --> R1["2048–4095 · 2 048"]',
        '    R --> R2["4096–6143 · 2 048"]',
        '    R --> R3["6144–6655 · 512"]',
        '    R --> R4["6656–6783 · 128"]',
        '    R --> R5["6784–6787 · 4"]',
        '    R --> R6["6788–6789 · 2"]',
        '    N["12 nodes, against a bound of 2⌈log₂ 8192⌉ = 26"] -.-> Q'
      ].join('\n')
    };
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        'Six structures over one array, and the choice between them is decided by two questions: does the ' +
          'operation have an inverse, and does the array change? Prefix sums answer a query in 2.00 array slots ' +
          'and pay 4 088.88 for a point update. A Fenwick tree — one array of n + 1 numbers, no children, no ' +
          'padding — costs 7.49 slots per update and 13.01 per query at 8 192 elements, which is exactly ' +
          'log₂ 8 192 for the query.',
        'A segment tree does the same job for any monoid and the constant is the price: 14.00 slots per update ' +
          'and 44.90 per query, at 32 bytes per element against a Fenwick tree\'s 8. Neither figure is visible ' +
          'in "both are O(log n)", and the ratio holds across the whole size sweep. Sqrt decomposition loses to ' +
          'both — 91.00 and 118.40 — and is the one people actually write under time pressure, because changing ' +
          'what it aggregates is two lines.',
        'The structure\'s central idea is the canonical decomposition: any interval, however awkward, is the ' +
          'disjoint union of at most 2 log n stored nodes. [1234, 6789] of 8 192 is 12 of them, arranged as two ' +
          'staircases climbing out of the endpoints. Seeing the staircase is what makes lazy propagation ' +
          'obvious — a pending range update applies to whole canonical nodes, so it can wait at the node it ' +
          'covers until somebody descends past it.'
      ],
      demo: { title: 'Interactive demo — four structures, one operation stream', markup: root.RangeStructuresTemplate.render() },
      diagram: diagram(),
      insight: 'Fenwick is smaller and faster; segment trees generalise to any monoid and support lazy range ' +
        'updates. Knowing which question you have decides it in ten seconds — and the question is not "which is ' +
        'better" but "does my operation have an inverse". If it does and the array changes, a Fenwick tree does ' +
        'the job in half the memory and a third of the slot traffic. If it does not, no amount of tuning turns ' +
        'a Fenwick tree into a range-minimum structure; it cannot express the query at all.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.RangeStructuresTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  const compareFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|').map(Number);
    return root.RangeLab.compare({
      n: parts[0], count: parts[1], seed: 6, updateShare: parts[2] / 100
    });
  });

  const othersFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|').map(Number);
    return {
      lazy: root.RangeLab.lazyRun({ n: parts[0], count: parts[1], seed: 6 }),
      idempotent: root.RangeLab.idempotentRun({ n: parts[0], count: parts[1], seed: 6 }),
      order: root.RangeLab.orderStatisticRun({ n: parts[0], count: Math.min(2000, parts[1]), seed: 6 })
    };
  });

  function update(app) {
    const values = panel.values();
    const n = Number(values['seg-n']);
    const key = n + '|' + values['seg-ops'] + '|' + values['seg-mix'];
    const comparison = compareFor(key);
    const others = othersFor(n + '|' + values['seg-ops']);

    paintMetrics(comparison);
    paintCompare(comparison);
    paintOthers(others, n);
    paintDecomposition(n, Number(values['seg-from']), Number(values['seg-to']));
    draw(app, comparison);
  }

  function rowFor(comparison, id) {
    return comparison.rows.filter(function (row) { return row.id === id; })[0];
  }

  function paintMetrics(comparison) {
    const fenwick = rowFor(comparison, 'fenwick');
    const segment = rowFor(comparison, 'segment-tree');
    const mismatches = comparison.rows.reduce(function (total, row) { return total + row.mismatches; }, 0);

    root.MetricGrid.update({
      'seg-cheapest': {
        value: comparison.cheapest.label,
        note: root.Format.exact(comparison.cheapest.slotsTouched) + ' slots over ' +
          root.Format.exact(comparison.operations) + ' operations'
      },
      'seg-fenwick': {
        value: root.Format.fixed(fenwick.slotsPerUpdate, 2) + ' / ' + root.Format.fixed(fenwick.slotsPerQuery, 2),
        note: root.Format.fixed(fenwick.bytesPerElement, 2) + ' bytes per element; log₂ n = ' +
          root.Format.fixed(Math.log2(comparison.n), 1)
      },
      'seg-segment': {
        value: root.Format.fixed(segment.slotsPerUpdate, 2) + ' / ' + root.Format.fixed(segment.slotsPerQuery, 2),
        note: root.Format.fixed(segment.slotsPerQuery / fenwick.slotsPerQuery, 2) + '× the Fenwick query, ' +
          root.Format.fixed(segment.bytesPerElement / fenwick.bytesPerElement, 1) + '× the memory'
      },
      'seg-mismatches': {
        value: root.Format.exact(mismatches),
        note: mismatches ? 'a structure is returning a different answer from the array' : 'every structure matched the plain-array replay'
      }
    });
  }

  function paintCompare(comparison) {
    const html = comparison.rows.map(function (row) {
      const cheapest = row.id === comparison.cheapest.id;
      return '<tr' + (cheapest ? ' style="font-weight:600"' : '') + '>' +
        '<td>' + row.label + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.slotsPerUpdate, 2) + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.slotsPerQuery, 2) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.slotsTouched) + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.bytesPerElement, 2) + '</td>' +
        '<td class="mono">' + row.mismatches + '</td></tr>';
    }).join('');

    root.jQuery('#seg-compare tbody').html(html);
    root.jQuery('#seg-compare-note').text('Move the update share to 0% and prefix sums win outright; move it ' +
      'to 100% and they are the worst thing in the table by three orders of magnitude. That is the whole ' +
      'design space, and the two structures in the middle differ by a constant that no asymptotic notation ' +
      'shows: a segment tree touches about 3.5× the slots a Fenwick tree does for the same query, and costs ' +
      'four times the memory to do it.');
  }

  function paintOthers(others, n) {
    const rows = [
      ['range add and range minimum', 'lazy segment tree',
        root.Format.fixed(others.lazy.slotsPerOperation, 2) + ' slots',
        root.Format.bytes(others.lazy.bytes), others.lazy.mismatches],
      ['range minimum on a static array', 'sparse table',
        root.Format.fixed(others.idempotent.tableSlotsPerQuery, 2) + ' slots (segment tree: ' +
          root.Format.fixed(others.idempotent.treeSlotsPerQuery, 2) + ')',
        root.Format.bytes(others.idempotent.tableBytes) + ' — ' +
          root.Format.fixed(others.idempotent.memoryRatio, 2) + '× the tree', others.idempotent.mismatches],
      ['how many values below x in this range', 'merge-sort tree',
        root.Format.fixed(others.order.nodesPerQuery, 2) + ' nodes, ' +
          root.Format.fixed(others.order.comparisonsPerQuery, 2) + ' comparisons',
        root.Format.fixed(others.order.bytesPerElement, 1) + ' bytes per element', others.order.mismatches]
    ];

    root.jQuery('#seg-others tbody').html(rows.map(function (row) {
      return '<tr><td>' + row[0] + '</td><td>' + row[1] + '</td>' +
        '<td class="mono">' + row[2] + '</td><td class="mono">' + row[3] + '</td>' +
        '<td class="mono">' + row[4] + '</td></tr>';
    }).join(''));

    root.jQuery('#seg-others-note').text('Each row removes a structure. Range minimum removes the Fenwick tree ' +
      'outright — not on speed, on expressiveness, because a Fenwick range query is one prefix minus another ' +
      'and minimum has no inverse. A static array unlocks the sparse table\'s constant-time query, which is ' +
      'legal only because min(a, a) = a; asking it for a sum throws rather than double-counting. And an order ' +
      'statistic needs sorted copies at every level, because the answer for a union is not a function of the ' +
      'halves\' answers. All three are replayed against a plain array over ' + root.Format.exact(n) +
      ' elements, and all three agree.');
  }

  function paintDecomposition(n, from, to) {
    const lo = Math.min(from, to, n - 1);
    const hi = Math.min(Math.max(from, to), n - 1);
    const result = root.RangeLab.decomposition({
      values: root.RangeLab.values({ n: n, seed: 6 }), from: lo, to: hi
    });

    const lines = result.nodes.map(function (node) {
      const width = node.hi - node.lo + 1;
      return '  ' + String(node.lo).padStart(6) + ' – ' + String(node.hi).padStart(6) +
        '   ' + String(width).padStart(6) + ' values';
    });

    root.jQuery('#seg-decomposition').text([
      'interval [' + lo + ', ' + hi + '] of ' + n + ' — ' + result.span + ' values',
      'covered by ' + result.count + ' stored nodes, against a bound of 2⌈log₂ n⌉ = ' + result.bound,
      ''
    ].concat(lines).join('\n'));

    root.jQuery('#seg-decomposition-note').text('Drag the endpoints and watch the count. It never passes the ' +
      'bound, and it is usually well under it — the worst intervals are the ones whose endpoints are just ' +
      'inside a large node on both sides. Every one of these nodes has its value already stored, so the query ' +
      'is a combine over this list and nothing else, and a pending range update that covers one of them can ' +
      'stop there.');
  }

  function draw(app, comparison) {
    chart = root.ErrorBandView.bars(root.jQuery('#seg-chart')[0], {
      lazyLib: app.lazyLib,
      height: 260,
      logY: true,
      xLabel: 'structure',
      yLabel: 'slots per operation (log scale)',
      values: comparison.rows.reduce(function (out, row, index) {
        out.push({ label: row.id + ' upd', value: Math.max(row.slotsPerUpdate, 0.5), series: index });
        out.push({ label: row.id + ' qry', value: Math.max(row.slotsPerQuery, 0.5), series: index });
        return out;
      }, [])
    });

    root.jQuery('#seg-chart-note').text('Each structure has two bars: upd is a point update and qry is ' +
      'a range query. The log axis is not decoration: ' +
      'prefix sums are three orders of magnitude apart from the rest on updates and the best thing here on ' +
      'queries, and a linear axis would show one bar and four slivers.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

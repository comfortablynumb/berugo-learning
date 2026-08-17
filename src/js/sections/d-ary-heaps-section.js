/**
 * Section: d-ary heaps and cache behaviour.
 *
 * The demo sweeps the arity over one fixed operation list, which is the only
 * way the trade is visible: comparisons form a shallow U with its minimum
 * around three or four, while swaps fall monotonically as d rises. Neither
 * curve alone tells you what to pick, and the cache argument — d children in
 * one line — is what breaks the tie in practice.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'd-ary-heaps';
  const ARITIES = [2, 3, 4, 6, 8, 12, 16];
  let panel = null;
  let chart = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
    app.state.subscribe('theme', function () { if (chart) chart.redraw(); });
  }

  /** The shell config: orientation, demo, diagram and the insight. */
  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        'Nothing about a heap requires two children. Give each node d of them and the tree gets ' +
          'shallower — log_d n instead of log₂ n — which makes every sift-up shorter, and every ' +
          'sift-down does d comparisons per level instead of two.',
        'So the two costs move in opposite directions and the answer depends on the mix. A push ' +
          'sifts up and only compares against one parent per level, so it gets cheaper as d rises. A ' +
          'pop sifts down and must find the best of d children at each level, so it gets more ' +
          'expensive. Decrease-key is a sift-up, which is why d-ary heaps are the standard answer ' +
          'when decrease-key dominates.',
        'The argument that settles it is not in the comparison count at all: d children sit ' +
          'contiguously in the array, so a 4-ary or 8-ary node fetches all its children in one cache ' +
          'line. That is why real implementations use 4 rather than the comparison-optimal 3.'
      ],
      demo: { title: 'Interactive demo — sweep the arity', markup: root.DaryHeapsTemplate.render() },
      diagram: {
        title: 'Diagram — four children in one cache line',
        caption: 'The children of i are contiguous, so one fetch covers all of them.',
        definition: [
          'flowchart TB',
          '    P["node i"] --> C["children at 4i+1 … 4i+4<br/>16 bytes of a 64-byte line"]',
          '    C --> N1["4i+1"]',
          '    C --> N2["4i+2"]',
          '    C --> N3["4i+3"]',
          '    C --> N4["4i+4"]',
          '    L["one cache line = 16 four-byte keys<br/>so d = 16 is one line per level"] -.-> C'
        ].join('\n')
      },
      insight: 'd-ary heaps are the standard answer when decrease-key dominates, which is exactly ' +
        'the Dijkstra case in M13 — a sift-up compares against one parent per level, so the shallower ' +
        'tree is pure gain there. The comparison-optimal arity is 3; the practical answer is 4, and ' +
        'the difference between those two numbers is the cache line.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.DaryHeapsTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  function measure(values) {
    const operations = root.PqLab.operations({
      kind: values['da-mix'],
      count: values['da-count'],
      rng: root.Random.seeded(values['da-seed'])
    });

    return ARITIES.map(function (arity) {
      const heap = root.BinaryHeap.create({
        arity: arity,
        indexed: values['da-mix'] === 'decrease-key'
      });
      const result = root.PqLab.replay({ heap: heap, operations: operations });
      return { arity: arity, ok: result.ok, stats: result.stats, errors: result.errors };
    });
  }

  function update(app) {
    const values = panel.values();
    const rows = measure(values);

    const bestCmp = rows.reduce(function (best, row) {
      return !best || row.stats.comparisons < best.stats.comparisons ? row : best;
    }, null);
    const bestSwaps = rows.reduce(function (best, row) {
      return !best || row.stats.swaps < best.stats.swaps ? row : best;
    }, null);

    root.MetricGrid.update({
      'da-best-cmp': {
        value: root.Format.exact(bestCmp.stats.comparisons),
        note: 'at d = ' + bestCmp.arity + ', against ' + root.Format.exact(rows[0].stats.comparisons) + ' at d = 2'
      },
      'da-best-swaps': {
        value: root.Format.exact(bestSwaps.stats.swaps),
        note: 'at d = ' + bestSwaps.arity + ' — swaps only ever fall as d rises'
      },
      'da-height': {
        value: String(Math.ceil(Math.log(1e6) / Math.log(4))),
        note: 'against ' + Math.ceil(Math.log2(1e6)) + ' for a binary heap of a million elements'
      },
      'da-lines': { value: '16', note: 'a 64-byte line holds 16 four-byte keys, so d = 16 is one line per level' }
    });

    paintTable(rows, values);
    draw(app, rows, values);
  }

  function paintTable(rows, values) {
    const markup = rows.map(function (row) {
      return '<tr' + (row.arity === 4 ? ' style="font-weight:600"' : '') + '>' +
        '<td class="mono">' + row.arity + '</td>' +
        '<td class="mono">' + root.Format.exact(row.stats.comparisons) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.stats.swaps) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.stats.siftDistance) + '</td>' +
        '<td class="mono">' + Math.ceil(Math.log(1e6) / Math.log(row.arity)) + '</td>' +
        '<td class="mono">' + root.Format.fixed(Math.log(1e6) / Math.log(row.arity), 1) + '</td></tr>';
    }).join('');

    root.jQuery('#da-table tbody').html(markup);
    root.jQuery('#da-note').text('Comparisons form a shallow U and swaps fall monotonically, so no ' +
      'single column picks the arity. On a ' + values['da-mix'] + ' mix the comparison minimum is at ' +
      'd = ' + rows.reduce(function (best, row) {
        return !best || row.stats.comparisons < best.stats.comparisons ? row : best;
      }, null).arity + ', and 4 is the usual choice because its children fit one cache line.');
  }

  function draw(app, rows, values) {
    chart = root.GrowthPlot.render(root.jQuery('#da-chart')[0], {
      lazyLib: app.lazyLib,
      height: 240,
      series: [
        {
          label: 'comparisons',
          points: rows.map(function (row) { return { x: row.arity, y: row.stats.comparisons }; }),
          dots: true
        },
        {
          label: 'swaps (data movement)',
          points: rows.map(function (row) { return { x: row.arity, y: Math.max(1, row.stats.swaps) }; }),
          dots: true
        }
      ],
      xLabel: 'arity d',
      yLabel: 'operations',
      legendHost: root.jQuery('#da-legend')[0],
      summary: function () {
        return 'Comparisons and swaps against arity for a ' + values['da-mix'] + ' mix of ' +
          values['da-count'] + ' operations. The comparison curve has a minimum; the swap curve does not.';
      }
    });
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

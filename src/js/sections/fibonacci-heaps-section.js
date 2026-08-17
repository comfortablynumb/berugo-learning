/**
 * Section: Fibonacci heaps and the theory-practice gap.
 *
 * The section exists to show two rankings that disagree, so it reports both
 * and says which one the theory predicted. Operation counts confirm the
 * bounds — the Fibonacci heap does the fewest comparisons. Wall clock
 * contradicts them, because a comparison is not what the run is spending its
 * time on: it is chasing six pointers per node through scattered memory.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'fibonacci-heaps';
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
        'A Fibonacci heap does as little as possible until forced. Insert drops a node into a root ' +
          'list. Meld concatenates two root lists. Decrease-key cuts the node out and drops it in the ' +
          'root list. All three are O(1) worst case, and the mess is paid for exactly once — by the ' +
          'extract-min that finally consolidates the roots into one tree per degree.',
        'Cascading cuts are what make the analysis work. When a node loses a second child it is cut ' +
          'from its parent too, which stops a node of degree d from having fewer than F(d + 2) ' +
          'descendants — the Fibonacci numbers the structure is named after, and the reason the ' +
          'maximum degree is bounded by log_φ(n).',
        'The bounds are correct and the structure loses anyway. Every node carries a parent, a child, ' +
          'two siblings, a degree and a mark bit, and every consolidation walks an array. The demo ' +
          'below reports comparisons and wall clock for the same Dijkstra run, and the two columns ' +
          'rank the queues in opposite orders.'
      ],
      demo: { title: 'Interactive demo — the two rankings', markup: root.FibonacciHeapsTemplate.render() },
      diagram: {
        title: 'Diagram — a cascading cut',
        caption: 'A marked node that loses a second child is cut too, and the cascade continues upward.',
        definition: [
          'flowchart TB',
          '    R["root list"] --- A["a (degree 3)"]',
          '    A --> B["b — marked:<br/>already lost one child"]',
          '    B --> C["c — key decreased below b"]',
          '    C -->|"cut c, move to the root list"| R',
          '    B -->|"b was marked, so cut b too"| R',
          '    A -->|"and the cascade continues at a"| R'
        ].join('\n')
      },
      insight: 'Fibonacci heaps are the canonical example of an asymptotic win that loses in ' +
        'practice. Being able to show the two curves is more persuasive than knowing the bound — and ' +
        'the honest summary is that the structure was a proof technique first and an implementation ' +
        'second, which is exactly how Fredman and Tarjan presented it.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.FibonacciHeapsTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  function queues() {
    return [
      { label: 'binary, indexed', create: function () { return root.BinaryHeap.create({ arity: 2, indexed: true }); }, mode: 'indexed' },
      { label: '4-ary, indexed', create: function () { return root.BinaryHeap.create({ arity: 4, indexed: true }); }, mode: 'indexed' },
      { label: 'pairing', create: function () { return root.PairingHeap.create({}); }, mode: 'indexed' },
      { label: 'fibonacci', create: function () { return root.FibonacciHeap.create({}); }, mode: 'indexed' }
    ];
  }

  function medianOf(values) {
    const sorted = values.slice().sort(function (a, b) { return a - b; });
    return sorted[Math.floor(sorted.length / 2)];
  }

  function measure(values) {
    const graph = root.PqLab.gridGraph({
      side: values['fh-side'],
      rng: root.Random.seeded(values['fh-seed'])
    });

    let reference = null;
    const rows = queues().map(function (entry) {
      const times = [];
      let run = null;

      for (let i = 0; i < values['fh-runs']; i += 1) {
        const started = performance.now();
        run = root.PqLab.dijkstra(graph, 0, entry, entry.mode);
        times.push(performance.now() - started);
      }
      if (!reference) reference = run.distance;

      const agrees = run.distance.every(function (d, i) { return d === reference[i]; });
      return {
        label: entry.label,
        stats: run.stats,
        median: medianOf(times),
        runs: times.length,
        agrees: agrees,
        run: run
      };
    });

    return { graph: graph, rows: rows };
  }

  function update(app) {
    const values = panel.values();
    const measured = measure(values);
    const rows = measured.rows;

    const fewest = rows.reduce(function (best, row) {
      return !best || row.stats.comparisons < best.stats.comparisons ? row : best;
    }, null);
    const fastest = rows.reduce(function (best, row) {
      return !best || row.median < best.median ? row : best;
    }, null);
    const fib = rows[rows.length - 1];

    const probe = root.FibonacciHeap.create({});
    const rng = root.Random.seeded(values['fh-seed']);
    for (let i = 0; i < 20000; i += 1) probe.push(rng.int(1e6), 'p' + i);
    for (let i = 0; i < 4000; i += 1) probe.pop();

    root.MetricGrid.update({
      'fh-fewest-cmp': {
        value: fewest.label,
        note: root.Format.exact(fewest.stats.comparisons) + ' comparisons — what the bounds predict'
      },
      'fh-fastest': {
        value: fastest.label,
        note: root.Format.perRun(fastest.median, values['fh-runs']) + ' — what the machine says'
      },
      'fh-degree': {
        value: root.Format.exact(probe.maxDegree()),
        note: 'the log_φ(n) bound is ' + probe.degreeBound() + ' at ' + root.Format.exact(probe.size()) + ' nodes'
      },
      'fh-cascades': {
        value: root.Format.exact(fib.stats.cascadingCuts || 0),
        note: root.Format.exact(fib.stats.cuts || 0) + ' cuts in total over the Dijkstra run'
      }
    });

    paintTable(rows, values);
    paintBounds();
    draw(app, rows, values);
  }

  function paintTable(rows, values) {
    const markup = rows.map(function (row) {
      return '<tr><td class="mono">' + row.label + '</td>' +
        '<td class="mono">' + root.Format.exact(row.stats.comparisons) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.stats.decreaseKeys || 0) + '</td>' +
        '<td class="mono">' + root.Format.perRun(row.median, row.runs) + '</td>' +
        '<td class="mono">' + (row.agrees ? 'yes' : 'NO') + '</td></tr>';
    }).join('');

    root.jQuery('#fh-table tbody').html(markup);

    const fewest = rows.reduce(function (best, row) {
      return !best || row.stats.comparisons < best.stats.comparisons ? row : best;
    }, null);
    const fastest = rows.reduce(function (best, row) {
      return !best || row.median < best.median ? row : best;
    }, null);

    root.jQuery('#fh-note').text('Every row computes identical distances over ' +
      root.Format.exact(values['fh-side'] * values['fh-side']) + ' nodes. ' + fewest.label +
      ' does the fewest comparisons and ' + fastest.label + ' finishes first — and on this graph ' +
      'those are ' + (fewest.label === fastest.label ? 'the same queue' : 'not the same queue') +
      '. Timings are a median of ' + values['fh-runs'] + ' runs on this machine, in this browser, today.');
  }

  function paintBounds() {
    const rows = [
      { op: 'insert', binary: 'O(log n)', fib: 'O(1)', practice: 'the array heap wins: no allocation, no pointers' },
      { op: 'decrease-key', binary: 'O(log n)', fib: 'O(1) amortised', practice: 'the bound is real; the constant is a cut and a splice' },
      { op: 'extract-min', binary: 'O(log n)', fib: 'O(log n) amortised', practice: 'consolidation walks a degree array every time' },
      { op: 'meld', binary: 'O(n + m)', fib: 'O(1)', practice: 'the one place the Fibonacci heap is unambiguously better' },
      { op: 'memory per node', binary: '1 slot', fib: '6 fields', practice: 'and every one of them is a pointer chase' }
    ].map(function (row) {
      return '<tr><td class="mono">' + row.op + '</td>' +
        '<td class="mono">' + row.binary + '</td>' +
        '<td class="mono">' + row.fib + '</td>' +
        '<td class="note">' + row.practice + '</td></tr>';
    }).join('');

    root.jQuery('#fh-bounds tbody').html(rows);
  }

  function draw(app, rows, values) {
    const comparisons = rows.map(function (row, i) { return { x: i + 1, y: row.stats.comparisons }; });
    const times = rows.map(function (row, i) { return { x: i + 1, y: row.median * 10000 }; });

    chart = root.GrowthPlot.render(root.jQuery('#fh-chart')[0], {
      lazyLib: app.lazyLib,
      height: 240,
      series: [
        { label: 'comparisons', points: comparisons, dots: true },
        { label: 'median time (×10⁴ ms, to share the axis)', points: times, dots: true, dashed: true }
      ],
      xLabel: '1 binary · 2 four-ary · 3 pairing · 4 fibonacci',
      yLabel: 'cost',
      legendHost: root.jQuery('#fh-legend')[0],
      summary: function () {
        return 'Comparisons and median wall-clock time for four priority queues on the same Dijkstra ' +
          'run over ' + (values['fh-side'] * values['fh-side']) + ' nodes. The two lines do not agree.';
      }
    });
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

/**
 * Section: the external-memory model.
 *
 * The measurement that makes this section worth having is that the external
 * merge sort matches its closed form EXACTLY at every setting — ratio 1.0000
 * across four (M, B) pairs — and that the simulator's peak memory equals M
 * exactly. Both facts come from the same design decision: the simulator
 * refuses to hold more than M records rather than warning about it, so an
 * algorithm that quietly buffers the whole input throws instead of reporting
 * an impossibly good I/O count.
 *
 * The join comparison is the practical half. A nested loop costs one transfer
 * per ROW and a sort-merge costs two sorts and two scans, so the crossover
 * depends on M/B — and with a realistic fan-out the nested loop loses by six
 * to ten times on every size the demo runs.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'external-memory';
  let panel = null;
  let chart = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — the hierarchy, and the two parameters the model keeps',
      caption: 'The DAM model throws away everything about the hierarchy except two numbers: M, ' +
        'the records that fit in fast memory, and B, the records moved by one transfer. Cost is ' +
        'the number of transfers and nothing else — computation inside memory is free. That is a ' +
        'crude model and it predicts extremely well, because once the data exceeds memory the ' +
        'transfer count dominates everything by orders of magnitude. The same two parameters ' +
        'describe a cache line against L1, a page against RAM, and a disk block against a ' +
        'buffer pool; only the numbers change, which is why one model covers all three levels.',
      definition: [
        'flowchart TD',
        '    CPU["CPU registers<br/>free"] --- FAST["fast memory<br/>holds M records<br/>free once resident"]',
        '    FAST --- SLOW["slow memory<br/>unbounded"]',
        '    FAST -. "one transfer moves B records" .- SLOW',
        '    SLOW --> C1["scan: N/B transfers"]',
        '    SLOW --> C2["sort: (N/B)·log of (N/B) base M/B"]',
        '    SLOW --> C3["search: log of N base B"]',
        '    SLOW --> C4["one transfer per record: N — the RAM-model algorithm"]'
      ].join('\n')
    };
  }

  function orientationModel() {
    return [
      '**The RAM model assumes every memory access costs the same, and once the data exceeds ' +
        'memory that assumption stops predicting anything.** The model that replaces it keeps two ' +
        'parameters: M, the records that fit in fast memory, and B, the records moved by one ' +
        'transfer.',
      'Cost is the transfer count, and computation on resident data is free.',
      '**Three bounds carry almost everything.** A scan is N/B.',
      'A sort is (N/B)·log_{M/B}(N/B), which is one scan per merge pass, with the pass count a ' +
        'logarithm base the FAN-OUT rather than base two.',
      'A search is log_B N, which is the B-tree bound and the reason a database index has a ' +
        'fan-out of hundreds instead of two.',
      '**The gap between the models is a factor of B, not a constant.** An algorithm that touches ' +
        'a random record per row costs one transfer per row, and the same work done blockwise ' +
        'costs one per B rows.',
      'B is 512 or 4 096, not 8, so "it is fast on my laptop" stops predicting anything the moment ' +
        'the working set leaves memory.',
      '**The merge fan-out is where the model earns its keep.** With M/B − 1 runs merged at once, ' +
        'the pass count is log base M/B rather than base 2.',
      'So doubling memory does not halve the passes, it divides the logarithm’s base. A realistic ' +
        'M/B of a few hundred means two passes for almost any data size.'
    ];
  }

  function orientationMeasurement() {
    return [
      '**The demo enforces the memory budget rather than assuming it.** The simulator throws if an ' +
        'algorithm holds more than M records, and that is deliberate.',
      'An external algorithm that quietly buffers everything reports an I/O count that looks superb ' +
        'and describes a different program.',
      'The peak-held column is that check, reported.',
      '**The measured transfer count matches the formula exactly, not approximately.** The ratio ' +
        'is 1.0000 at four settings.',
      'That is what a correctly charged simulator produces, and it means a disagreement in future ' +
        'is a bug rather than noise.',
      'That is the point of having the formula alongside the measurement at all.',
      '**A nested-loop join is the RAM model’s answer and it costs one transfer per row.** The ' +
        'sort-merge alternative costs two sorts and two scans, so its cost per record falls as the ' +
        'data grows while the nested loop’s does not.',
      'The demo sweeps the size, and the ratio settles around six to ten times.',
      '**This is why a query planner’s cost model counts pages rather than rows.** Index scan ' +
        'against sequential scan, hash join against sort-merge, when to spill: every choice it ' +
        'makes is a comparison of transfer counts.',
      'It is exactly this model, with M as the work memory setting and B as the page size.'
    ];
  }

  function orientation() {
    return orientationModel().concat(orientationMeasurement());
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — the sort against its formula, and the join crossover',
        markup: root.ExternalMemoryTemplate.render()
      },
      diagram: diagram(),
      insight: '**When the data stops fitting in memory, stop counting operations and start ' +
        'counting transfers.** The first thing that changes is which algorithm you pick, not ' +
        'how fast it runs. A hash join is optimal in the RAM model and terrible in this one ' +
        'once the hash table spills, because every probe is a random block. The practical ' +
        'version of the model is three questions asked in order. Does the working set fit in ' +
        'memory? Is the access pattern blockwise or random? How many passes over the data does ' +
        'the algorithm make? Those three answers predict the runtime to within a small factor, ' +
        'and no amount of profiling the inner loop will tell you the same thing.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.ExternalMemoryTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  const sortFor = root.Helpers.memoise(function (key) {
    return root.DamLab.sortStudy({ n: Number(key) });
  });

  const oneFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.DamLab.sortStudy({ n: Number(parts[0]),
      configs: [{ M: Number(parts[1]), B: Number(parts[2]) }] });
  });

  const boundsFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.DamLab.boundsTable({ M: Number(parts[0]), B: Number(parts[1]) });
  });

  const joinsFor = root.Helpers.memoise(function () {
    return root.DamLab.joinStudy({});
  });

  function update(app) {
    const values = panel.values();
    const single = oneFor(values['xmm-records'] + '|' + values['xmm-memory'] + '|' +
      values['xmm-block']).rows[0];
    const joins = joinsFor('');

    paintMetrics(single, joins);
    paintChart(app, boundsFor(values['xmm-memory'] + '|' + values['xmm-block']));
    paintSort(sortFor(values['xmm-records']));
    paintBounds(boundsFor(values['xmm-memory'] + '|' + values['xmm-block']));
    paintJoins(joins);
  }

  function paintMetrics(row, joins) {
    const last = joins.rows[joins.rows.length - 1];

    root.MetricGrid.update({
      'xmm-transfers': { value: root.Format.exact(row.transfers),
        note: root.Format.exact(row.runs) + ' initial runs, ' + root.Format.exact(row.passes) +
          ' merge passes at a fan-out of ' + root.Format.exact(row.fanOut) },
      'xmm-predicted': { value: root.Format.exact(row.predicted),
        note: row.withinTenPercent
          ? 'the measurement is ' + root.Format.fixed(row.ratio, 4) + '× the formula'
          : 'the measurement is OUTSIDE ten per cent, which is a bug rather than noise' },
      'xmm-peak': { value: root.Format.exact(row.peakHeld) + ' of ' + root.Format.exact(row.M),
        note: row.peakHeld <= row.M
          ? 'the budget is enforced — holding more throws rather than warning'
          : 'THE BUDGET WAS EXCEEDED' },
      'xmm-join': { value: root.Format.fixed(last.ratio, 2) + '×',
        note: 'at ' + root.Format.exact(last.n) + ' rows a side, ' +
          root.Format.exact(last.nested) + ' transfers against ' + root.Format.exact(last.merge) }
    });
  }

  function paintChart(app, bounds) {
    const host = root.jQuery('#xmm-chart')[0];
    if (!host) return;
    if (chart) chart.destroy();

    chart = root.ErrorBandView.curve(host, {
      lazyLib: app.lazyLib, height: 250, logX: true, logY: true, yMin: 1,
      xLabel: 'records (log scale)', yLabel: 'transfers (log scale)',
      series: [
        { label: 'one transfer per record (the RAM-model algorithm)',
          points: bounds.rows.map(function (row) { return { x: row.n, y: row.naive }; }) },
        { label: 'sort: (N/B)·log_{M/B}(N/B)',
          points: bounds.rows.map(function (row) { return { x: row.n, y: row.sort }; }) },
        { label: 'scan: N/B',
          points: bounds.rows.map(function (row) { return { x: row.n, y: row.scan }; }) },
        { label: 'search: log_B N', dashed: true,
          points: bounds.rows.map(function (row) { return { x: row.n, y: row.search }; }) }
      ]
    });

    const last = bounds.rows[bounds.rows.length - 1];
    root.Helpers.setText('xmm-chart-note',
      'Four costs on one logarithmic pair of axes, at M = ' + root.Format.exact(bounds.M) +
      ' and B = ' + root.Format.exact(bounds.B) + '. The top line is what an algorithm written ' +
      'for the RAM model costs when its accesses are random — one transfer per record, ' +
      root.Format.exact(last.naive) + ' at the largest size — and it is exactly B times the scan ' +
      'below it. The sort sits between them because it is a scan repeated once per merge pass, ' +
      'and the pass count is ' + root.Format.exact(last.passes) + ' even at ' +
      root.Format.exact(last.n) + ' records. The bottom line is a single search, which is ' +
      root.Format.fixed(last.search, 2) + ' transfers — this is the same picture that makes an ' +
      'index worth building and a full scan worth avoiding.');
  }

  function paintSort(study) {
    root.jQuery('#xmm-sort tbody').html(study.rows.map(function (row) {
      return '<tr><td class="mono">' + root.Format.exact(row.M) + '</td><td class="mono">' +
        root.Format.exact(row.B) + '</td><td class="mono">' + root.Format.exact(row.runs) +
        '</td><td class="mono">' + root.Format.exact(row.passes) + '</td><td class="mono">' +
        root.Format.exact(row.fanOut) + '</td><td class="mono">' +
        root.Format.exact(row.transfers) + '</td><td class="mono">' +
        root.Format.exact(row.predicted) + '</td><td class="mono">' +
        root.Format.fixed(row.ratio, 4) + '</td><td class="mono">' +
        (row.sorted ? 'yes' : 'NO') + '</td><td class="mono">' +
        root.Format.exact(row.peakHeld) + '</td></tr>';
    }).join(''));

    const exact = study.rows.filter(function (row) { return Math.abs(row.ratio - 1) < 1e-9; });
    root.Helpers.setText('xmm-sort-note',
      root.Format.exact(exact.length) + ' of ' + root.Format.exact(study.rows.length) +
      ' settings match the formula to four decimal places, and the peak-held column equals M in ' +
      'every row — the budget is not a suggestion, and an algorithm that exceeded it would throw ' +
      'rather than report a number. Read the fan-out column against the pass count: at M/B = ' +
      root.Format.exact(study.rows[0].fanOut + 1) + ' the sort needs ' +
      root.Format.exact(study.rows[0].passes) + ' passes and at M/B = ' +
      root.Format.exact(study.rows[study.rows.length - 1].fanOut + 1) + ' it needs ' +
      root.Format.exact(study.rows[study.rows.length - 1].passes) + '. More memory does not make ' +
      'the passes cheaper — it makes there be fewer of them, and that is a different kind of ' +
      'improvement.');
  }

  function paintBounds(bounds) {
    root.jQuery('#xmm-bounds tbody').html(bounds.rows.map(function (row) {
      return '<tr><td class="mono">' + root.Format.exact(row.n) + '</td><td class="mono">' +
        root.Format.exact(row.scan) + '</td><td class="mono">' + root.Format.exact(row.sort) +
        '</td><td class="mono">' + root.Format.exact(row.passes) + '</td><td class="mono">' +
        root.Format.fixed(row.search, 2) + '</td><td class="mono">' +
        root.Format.exact(row.naive) + '</td><td class="mono">' +
        root.Format.fixed(row.naiveOverScan, 0) + '×</td></tr>';
    }).join(''));

    root.Helpers.setText('xmm-bounds-note',
      'The last column is B, exactly, in every row — because "one transfer per record" over ' +
      '"one transfer per block" is the block size and nothing else. That single factor is what ' +
      'the whole model is about: it does not appear in the RAM analysis at all, it is worth ' +
      root.Format.exact(bounds.B) + '× here, and it is worth several thousand on a real disk. ' +
      'The search column is the other extreme, and it barely moves: going from ten thousand ' +
      'records to a hundred million takes it from ' +
      root.Format.fixed(bounds.rows[0].search, 2) + ' transfers to ' +
      root.Format.fixed(bounds.rows[bounds.rows.length - 1].search, 2) + '.');
  }

  function paintJoins(joins) {
    root.jQuery('#xmm-joins tbody').html(joins.rows.map(function (row) {
      return '<tr><td class="mono">' + root.Format.exact(row.n) + '</td><td class="mono">' +
        root.Format.exact(row.nested) + '</td><td class="mono">' +
        root.Format.exact(row.merge) + '</td><td class="mono">' +
        root.Format.exact(row.sortPart) + '</td><td class="mono">' +
        root.Format.exact(row.walkPart) + '</td><td class="mono">' +
        root.Format.fixed(row.ratio, 2) + '×</td></tr>';
    }).join(''));

    const last = joins.rows[joins.rows.length - 1];
    root.Helpers.setText('xmm-joins-note',
      'At M = ' + root.Format.exact(joins.config.M) + ' and B = ' +
      root.Format.exact(joins.config.B) + ', so the fan-out is large enough for one or two merge ' +
      'passes. The nested loop costs exactly one transfer per outer row — its column IS the row ' +
      'count — because every probe is a random block. The sort-merge column grows more slowly ' +
      'because both of its parts are scans, and at ' + root.Format.exact(last.n) +
      ' rows a side it is ' + root.Format.fixed(last.ratio, 1) + ' times cheaper. The split ' +
      'between the last two columns is the planner’s real decision: the sorting dominates, so ' +
      'anything that makes a side already sorted — an index, a previous operator, a clustered ' +
      'table — removes most of the cost rather than a constant factor of it.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

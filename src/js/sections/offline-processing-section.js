/**
 * Section: offline and batch processing.
 *
 * Everything here is counted in pointer moves rather than milliseconds,
 * because the bound being taught - O((n + q)·sqrt(n)) - is a statement about
 * that counter. The comparison against the arrival order is the measurement
 * that makes "the ordering is the algorithm" concrete: same array, same
 * queries, same hooks, one sort in between.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'offline-processing';
  let panel = null;
  let chart = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
    app.state.subscribe('theme', function () {
      if (chart) chart.redraw();
    });
  }

  function diagram() {
    return {
      title: 'Diagram — queries sorted by (block, right endpoint)',
      caption: 'Inside a block the right pointer only moves forwards, so it costs n per block and there are ' +
        'n/b blocks. The left pointer never leaves its block, so it costs b per query. Adding the two and ' +
        'minimising gives the block size, and the square root falls out of the arithmetic.',
      definition: [
        'flowchart TD',
        '    Q["q queries, arriving in any order"] --> S["sort by (left / b, right)"]',
        '    S --> B1["block 0: right sweeps forward once"]',
        '    S --> B2["block 1: right resets, sweeps forward once"]',
        '    S --> B3["block n/b: …"]',
        '    B1 --> C["left moves at most b per query"]',
        '    B2 --> C',
        '    C --> T["total: q·b + n²/b, minimal at b = n/√q"]'
      ].join('\n')
    };
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        '**"Can I see all the queries before answering any of them?"** is a question worth ' +
          'asking explicitly, because the answer changes what is achievable.',
        'An online structure has to be ready for the worst order it might be asked in. Given the ' +
          'whole workload up front, the order becomes a free variable, and choosing it well turns ' +
          'problems with no efficient online structure into a linear-ish sweep.',
        'Mo\'s algorithm is the canonical case. Distinct values in a range has no simple online ' +
          'structure: the answer is not decomposable, so a segment tree does not help.',
        'Offline, sort the queries by the block of their left endpoint and then by their right ' +
          'endpoint, keep two pointers, and walk them to each query in turn. The left pointer ' +
          'never leaves its block and the right pointer sweeps forward once per block, which is ' +
          'q·b + n²/b moves, minimised at b = n/√q.',
        'The measurement is the argument. On 4 000 elements with 600 queries the ordered sweep ' +
          'costs 121 956 pointer moves. The same queries in arrival order cost 1 420 156, a ' +
          'factor of 11.6, and both produce answers identical to brute force.',
        'The bound (n + q)·√n is 290 930, comfortably above the measurement. That is what a ' +
          'correct bound looks like: an over-estimate that does not grow apart from the truth.'
      ],
      demo: {
        title: 'Interactive demo — the ordering, the block size and the bound',
        markup: root.OfflineProcessingTemplate.render()
      },
      diagram: diagram(),
      insight: 'The condition Mo\'s algorithm actually needs is not "offline" but "an O(1) ' +
        'incremental update". Adding or removing one element at an end must be cheap, because ' +
        'the sweep does that hundreds of thousands of times. Distinct counts, frequency modes ' +
        'and sums all qualify; anything needing a rebuild does not. And when the question *is* ' +
        'decomposable — sums, minima, gcds — a segment tree answers it online in log n, and ' +
        'reordering buys nothing. Ask both questions in that order. Is it decomposable? And if ' +
        'not, can I see the queries first?'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.OfflineProcessingTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  const workloadFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|').map(Number);
    const random = root.Random.seeded(parts[3]);
    const values = [];
    for (let i = 0; i < parts[0]; i += 1) values.push(random.int(parts[2]));
    return {
      values: values,
      queries: root.MoAlgorithm.randomQueries(parts[1], parts[0], parts[3]),
      universe: parts[2]
    };
  });

  function blockSizeFor(kind, n, q) {
    if (kind === 'sqrt') return Math.max(1, Math.round(Math.sqrt(n)));
    if (kind === 'small') return Math.max(1, Math.round(Math.sqrt(n) / 4));
    if (kind === 'large') return Math.max(1, Math.round(Math.sqrt(n) * 4));
    return root.MoAlgorithm.blockSizeFor(n, q);
  }

  const runFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const workload = workloadFor(parts.slice(1).join('|'));
    const blockSize = blockSizeFor(parts[0], workload.values.length, workload.queries.length);
    const offline = root.MoAlgorithm.run(workload.values, workload.queries,
      root.MoAlgorithm.distinctHooks(workload.universe), { blockSize: blockSize });
    return { workload: workload, offline: offline, blockSize: blockSize };
  });

  const unsortedFor = root.Helpers.memoise(function (key) {
    const workload = workloadFor(key);
    return root.MoAlgorithm.runUnsorted(workload.values, workload.queries,
      root.MoAlgorithm.distinctHooks(workload.universe));
  });

  const truthFor = root.Helpers.memoise(function (key) {
    const workload = workloadFor(key);
    return root.MoAlgorithm.bruteForce(workload.values, workload.queries, 'distinct');
  });

  const sweepFor = root.Helpers.memoise(function (key) {
    const workload = workloadFor(key);
    return root.MoAlgorithm.blockSweep(workload.values, workload.queries, workload.universe);
  });

  function workloadKey(values) {
    return values['ofl-size'] + '|' + values['ofl-queries'] + '|' + values['ofl-universe'] + '|' +
      values['ofl-seed'];
  }

  function update(app) {
    const values = panel.values();
    const key = workloadKey(values);
    const run = runFor(values['ofl-block'] + '|' + key);

    paintMetrics(values, run);
    paintBlocks(values);
    paintQuestions(values, run);
    paintOrder(run);
    drawChart(app, sweepFor(key), run);
  }

  function paintMetrics(values, run) {
    const key = workloadKey(values);
    const unsorted = unsortedFor(key);
    const truth = truthFor(key);
    const n = run.workload.values.length;
    const q = run.workload.queries.length;
    let matching = 0;
    truth.forEach(function (answer, index) {
      if (run.offline.answers[index] === answer) matching += 1;
    });

    root.MetricGrid.update({
      'ofl-moves': {
        value: root.Format.exact(run.offline.report.pointerMoves),
        note: 'block size ' + root.Format.exact(run.blockSize) + ', ' +
          root.Format.exact(run.offline.report.blocks) + ' blocks'
      },
      'ofl-unsorted': {
        value: root.Format.exact(unsorted.report.pointerMoves),
        note: root.Format.fixed(unsorted.report.pointerMoves /
          Math.max(1, run.offline.report.pointerMoves), 1) + '× the ordered sweep'
      },
      'ofl-bound': {
        value: root.Format.exact(Math.round((n + q) * Math.sqrt(n))),
        note: 'the measurement sits at ' +
          root.Format.fixed(run.offline.report.pointerMoves / ((n + q) * Math.sqrt(n)) * 100, 0) + '% of it'
      },
      'ofl-agree': {
        value: root.Format.exact(matching) + ' / ' + root.Format.exact(q),
        note: matching === q ? 'every answer matches the brute-force scan' : 'A REORDERING BUG'
      }
    });
  }

  const BLOCK_KINDS = [
    { id: 'optimal', label: 'n / √q — the minimiser' },
    { id: 'sqrt', label: '√n — the usual choice' },
    { id: 'small', label: '√n / 4' },
    { id: 'large', label: '4√n' }
  ];

  function paintBlocks(values) {
    const key = workloadKey(values);
    const rows = BLOCK_KINDS.map(function (kind) {
      return { kind: kind, run: runFor(kind.id + '|' + key) };
    });
    const best = Math.min.apply(null, rows.map(function (row) { return row.run.offline.report.pointerMoves; }));
    const n = rows[0].run.workload.values.length;
    const q = rows[0].run.workload.queries.length;

    const html = rows.map(function (row) {
      const moves = row.run.offline.report.pointerMoves;
      const predicted = q * row.run.blockSize + (n * n) / row.run.blockSize;
      return '<tr' + (row.kind.id === values['ofl-block'] ? ' style="font-weight:600"' : '') + '>' +
        '<td>' + row.kind.label + '</td>' +
        '<td class="mono">' + root.Format.exact(row.run.blockSize) + '</td>' +
        '<td class="mono">' + root.Format.exact(moves) + '</td>' +
        '<td class="mono">' + root.Format.exact(Math.round(predicted)) + '</td>' +
        '<td class="mono">' + root.Format.fixed(moves / best, 2) + '×</td></tr>';
    }).join('');

    root.jQuery('#ofl-blocks tbody').html(html);
    root.jQuery('#ofl-blocks-note').text('Three things are visible here and only one of them is the ' +
      'headline. The minimiser is n/√q rather than √n, and they differ whenever q is not close to n. The ' +
      'predicted column tracks the measurement but is not equal to it, because the formula bounds the ' +
      'movement rather than describing it. And the last column is nearly flat near the bottom — being ' +
      'roughly right about the block size is enough, which is why √n survives as a default despite not being ' +
      'the minimiser.');
  }

  function paintQuestions(values, run) {
    const key = workloadKey(values);
    const workload = workloadFor(key);
    const sums = root.MoAlgorithm.run(workload.values, workload.queries, root.MoAlgorithm.sumHooks(),
      { blockSize: run.blockSize });

    const rows = [
      {
        question: 'sum over a range',
        structure: 'prefix sums', cost: 'O(1) per query, O(n) to build',
        moves: sums.report.pointerMoves, worth: 'no — the online answer is strictly better'
      },
      {
        question: 'distinct values in a range',
        structure: 'none that is simple', cost: 'not decomposable',
        moves: run.offline.report.pointerMoves, worth: 'yes — this is what the technique is for'
      }
    ];

    const html = rows.map(function (row) {
      return '<tr><td>' + row.question + '</td>' +
        '<td>' + row.structure + '</td>' +
        '<td class="mono">' + row.cost + '</td>' +
        '<td class="mono">' + root.Format.exact(row.moves) + '</td>' +
        '<td>' + row.worth + '</td></tr>';
    }).join('');

    root.jQuery('#ofl-questions tbody').html(html);
    root.jQuery('#ofl-questions-note').text('The two rows cost the same number of pointer moves, because the ' +
      'sweep does not know what it is computing — only the hooks differ. That is the honest comparison: ' +
      'Mo\'s algorithm is not fast, it is applicable. For a decomposable question a prefix sum answers in ' +
      'constant time and reordering is pure overhead; for one that is not decomposable there is no online ' +
      'structure to compare against, and a sweep of ' + root.Format.exact(run.offline.report.pointerMoves) +
      ' moves is the whole cost of answering all ' + root.Format.exact(workload.queries.length) + '.');
  }

  function paintOrder(run) {
    const ordered = root.MoAlgorithm.order(run.workload.queries, run.blockSize, {});
    const html = ordered.slice(0, 12).map(function (query, rank) {
      return '<tr><td class="mono">' + (rank + 1) + '</td>' +
        '<td class="mono">' + query.block + '</td>' +
        '<td class="mono">' + root.Format.exact(query.left) + '</td>' +
        '<td class="mono">' + root.Format.exact(query.right) + '</td>' +
        '<td class="mono">' + root.Format.exact(query.index + 1) + '</td></tr>';
    }).join('');

    root.jQuery('#ofl-order tbody').html(html);
    root.jQuery('#ofl-order-note').text('Read the last two columns together: inside a block the right ' +
      'endpoint increases monotonically, and the query numbers are scattered. That scattering is the whole ' +
      'technique — the answers are produced out of order and written back into their original slots at the ' +
      'end. It is also the constraint it imposes on a system: nothing downstream can consume an answer ' +
      'before the last query has been processed.');
  }

  function drawChart(app, sweep, run) {
    chart = root.ErrorBandView.curve(root.jQuery('#ofl-chart')[0], {
      lazyLib: app.lazyLib,
      height: 260,
      logY: true,
      legendHost: root.jQuery('#ofl-chart-legend')[0],
      xLabel: 'block size',
      yLabel: 'pointer moves (log scale)',
      series: [
        { label: 'measured', width: 3,
          points: sweep.map(function (row) { return { x: row.blockSize, y: row.pointerMoves }; }) },
        { label: 'q·b + n²/b', dashed: true,
          points: sweep.map(function (row) { return { x: row.blockSize, y: row.predicted }; }) }
      ]
    });

    root.jQuery('#ofl-chart-note').text('The curve has a minimum and it is broad. Both terms are visible: on ' +
      'the left the right pointer resets too often and n²/b dominates, on the right the left pointer wanders ' +
      'too far inside its block and q·b dominates. The chosen block size here is ' +
      root.Format.exact(run.blockSize) + '. Being within a factor of two of the minimiser costs a few per ' +
      'cent, which is why this parameter is worth computing once and never tuning again.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

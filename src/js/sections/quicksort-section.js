/**
 * Section: quicksort.
 *
 * The demo is a matrix, because the claim is that no single cell describes
 * quicksort. Lomuto with a median-of-three pivot is excellent on random data
 * and quadratic on three distinct values; Hoare is fine on both and worse on
 * neither; three-way is the only one that treats duplicates as a case rather
 * than an accident. Every one of those is a measurement in the table.
 *
 * The second table is the introsort argument: the identical input with and
 * without the depth limit, so the escape can be watched firing.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'quicksort';
  let panel = null;
  let arrayView = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
    app.state.subscribe('theme', function () {
      if (arrayView) arrayView.redraw();
    });
  }

  function diagram() {
    return {
        title: 'Diagram — three-way partitioning, one pass',
        caption: 'One scan, three regions and one invariant: everything below `less` is smaller than the ' +
          'pivot, everything from `greater` up is larger, and the block between them is finished.',
        definition: [
          'flowchart TD',
          '    A["i < greater?"] -- no --> Z["done: [from, less) | [less, greater) | [greater, to)"]',
          '    A -- yes --> B{"compare a[i] with the pivot"}',
          '    B -- "less" --> C["swap a[i] with a[less]; less++; i++"]',
          '    B -- "equal" --> D["i++ — it is already in the middle block"]',
          '    B -- "greater" --> E["greater--; swap a[i] with a[greater]"]',
          '    C --> A',
          '    D --> A',
          '    E --> A'
        ].join('\n')
    };
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        'Quicksort has no single cost. It has a partition scheme, a pivot rule and an input, and the three of ' +
          'them together decide whether it is the fastest sort in the room or a quadratic one that still ' +
          'returns the right answer. On 2 000 elements of three distinct values, Lomuto partitioning with a ' +
          'median-of-three pivot does 676 647 comparisons and three-way partitioning does 3 389 - a factor of ' +
          '200 from the partition scheme alone, with the same pivot rule and the same data.',
        'The all-equal case is the one to understand first, because it is the one real data hits. Lomuto puts ' +
          'every element that is not strictly less than the pivot on one side, so an array of identical values ' +
          'splits n−1 to 0 and recurses n deep: 2 004 997 comparisons on 2 000 identical elements, and a stack ' +
          '2 000 frames tall. Hoare\'s two pointers *stop* on elements equal to the pivot, which splits the ' +
          'array down the middle and costs 31 723. Three-way partitioning places the whole equal block and ' +
          'never recurses into it at all: one partition, 2 012 comparisons, done.',
        'The failure mode is what makes quicksort worth a section rather than a paragraph. It is not a crash ' +
          'and not a wrong answer - the sort returns correctly ordered data, just slowly. That shows up as a ' +
          'latency incident on one customer\'s data at 3am, not as a bug report, and the input that causes it ' +
          'can be constructed: McIlroy\'s anti-quicksort answers comparisons adversarially while the sort runs ' +
          'and hands back the permutation that defeats exactly the pivot rule you used. On 2 048 elements it ' +
          'drives median-of-three to 1 051 648 comparisons, which is above n²/4.'
      ],
      demo: {
        title: 'Interactive demo — the scheme, the pivot, and the input built to defeat them',
        markup: root.QuicksortTemplate.render()
      },
      diagram: diagram(),
      insight: 'Quicksort\'s failure mode is a *quiet* quadratic. Every other sort here fails loudly or not at ' +
        'all; this one keeps returning correct output and simply takes n²/4 comparisons to do it, so it ' +
        'surfaces as a timeout on one tenant\'s data rather than as a wrong answer anywhere. The engineering ' +
        'answer is not a cleverer pivot - every deterministic rule has an input that defeats it, and the demo ' +
        'builds one on request. It is a depth counter and an escape hatch: run quicksort, and if the recursion ' +
        'passes 2·log₂ n, finish that subarray with heapsort. The average case is untouched and the worst case ' +
        'is gone, which is why every std::sort on earth is some version of this.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.QuicksortTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  const MATRIX_SHAPES = ['random', 'sorted', 'few-unique', 'organ-pipe', 'adversarial'];
  const MATRIX_ROWS = [
    { partition: 'lomuto', pivot: 'median-of-three', label: 'Lomuto · median-of-three' },
    { partition: 'hoare', pivot: 'median-of-three', label: 'Hoare · median-of-three' },
    { partition: 'three-way', pivot: 'ninther', label: 'three-way · ninther' },
    { partition: 'hoare', pivot: 'random', label: 'Hoare · random' }
  ];

  const runFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const values = root.SortLab.input(parts[2], Number(parts[3]), 3);
    const list = values.slice();
    const ops = root.SortOps.create({});
    const report = parts[4] === 'intro'
      ? root.QuickSort.introSort(list, ops, {
        partition: parts[0], pivot: parts[1], insertionSort: root.SortsElementary.insertionSort
      })
      : root.QuickSort.sort(list, ops, { partition: parts[0], pivot: parts[1], random: root.Random.seeded(9) });

    let wrong = 0;
    const expected = values.slice().sort(function (a, b) { return a - b; });
    for (let i = 0; i < expected.length; i += 1) {
      if (list[i] !== expected[i]) wrong += 1;
    }
    return { report: report, stats: ops.stats(), size: values.length, wrong: wrong };
  });

  function keyFor(values, shape, limit) {
    return values['qks-partition'] + '|' + values['qks-pivot'] + '|' + shape + '|' +
      values['qks-size'] + '|' + (limit || 'off');
  }

  function update(app) {
    const values = panel.values();
    const chosen = runFor(keyFor(values, values['qks-shape'], values['qks-limit']));

    paintMetrics(chosen);
    paintMatrix(values);
    paintIntro(values);
    drawPartition(values);
  }

  function paintMetrics(chosen) {
    const n = chosen.size;
    const quadratic = n * n / 4;
    const bound = 2 * Math.ceil(Math.log2(Math.max(2, n)));

    root.MetricGrid.update({
      'qks-comparisons': {
        value: root.Format.exact(chosen.stats.comparisons),
        note: root.Format.fixed(chosen.stats.comparisons / Math.max(1, n)) + ' per element'
      },
      'qks-depth': {
        value: root.Format.exact(chosen.report.maxDepth),
        note: '2·log₂ n is ' + bound + ' for this size'
      },
      'qks-quadratic': {
        value: root.Format.fixed(chosen.stats.comparisons / quadratic, 2) + '×',
        note: chosen.stats.comparisons > quadratic ? 'above n²/4 — this run is quadratic' : 'below n²/4'
      },
      'qks-fallbacks': {
        value: root.Format.exact(chosen.report.heapsortFallbacks || 0),
        note: chosen.report.heapsortFallbacks ? 'the escape hatch fired' : 'the depth limit was never reached'
      }
    });
  }

  function paintMatrix(values) {
    const html = MATRIX_ROWS.map(function (row) {
      const cells = MATRIX_SHAPES.map(function (shape) {
        const run = runFor(row.partition + '|' + row.pivot + '|' + shape + '|' + values['qks-size'] + '|off');
        const quadratic = run.size * run.size / 4;
        const bad = run.stats.comparisons > quadratic;
        return '<td class="mono"' + (bad ? ' style="font-weight:700"' : '') + '>' +
          root.Format.exact(run.stats.comparisons) + (bad ? ' !' : '') + '</td>';
      }).join('');
      return '<tr><td>' + row.label + '</td>' + cells + '</tr>';
    }).join('');

    root.jQuery('#qks-matrix tbody').html(html);
    root.jQuery('#qks-matrix-note').text('Comparisons, with a bold figure and an exclamation mark wherever the ' +
      'run went above n²/4 — that is what "quadratic" looks like as a number rather than as a curve. Read ' +
      'along the Lomuto row: excellent on random data, and catastrophic on both few-unique and the adversarial ' +
      'input. Read down the few-unique column: the only configuration that handles it is the three-way one, ' +
      'and it handles it by never recursing into the equal block.');
  }

  function paintIntro(values) {
    const rows = [
      { limit: 'off', label: 'plain quicksort — no depth limit' },
      { limit: 'intro', label: 'introsort — 2·log₂ n, then heapsort' }
    ].map(function (entry) {
      const run = runFor(keyFor(values, values['qks-shape'], entry.limit));
      return '<tr' + (entry.limit === values['qks-limit'] ? ' style="font-weight:600"' : '') + '>' +
        '<td>' + entry.label + '</td>' +
        '<td class="mono">' + root.Format.exact(run.stats.comparisons) + '</td>' +
        '<td class="mono">' + root.Format.exact(run.report.maxDepth) + '</td>' +
        '<td class="mono">' + root.Format.exact(run.report.partitions) + '</td>' +
        '<td class="mono">' + root.Format.exact(run.report.heapsortFallbacks || 0) + '</td>' +
        '<td class="mono">' + run.wrong + '</td></tr>';
    }).join('');

    root.jQuery('#qks-intro tbody').html(rows);
    root.jQuery('#qks-intro-note').text('The wrong column is zero on both rows of every configuration, which ' +
      'is the whole difficulty: a quadratic quicksort is not incorrect, it is slow. The depth limit does not ' +
      'make the good cases better - on random input introsort and plain quicksort do nearly the same work - ' +
      'it removes the tail. That is a bound bought for no average-case cost, which is a rare enough trade to ' +
      'be worth recognising when one shows up.');
  }

  function drawPartition(values) {
    const source = root.SortLab.input(values['qks-shape'], 240, 3);
    const list = source.slice();
    const ops = root.SortOps.create({});
    const pivotIndex = root.QuickSort.pivots[values['qks-pivot']](list, 0, list.length, ops, root.Random.seeded(9));
    const bounds = root.QuickSort.partitions[values['qks-partition']](list, 0, list.length, pivotIndex, ops);

    arrayView = root.ArrayView.bars(root.jQuery('#qks-array')[0], {
      height: 240,
      values: list,
      regions: [
        { from: 0, to: bounds.left, role: 'less' },
        { from: bounds.left, to: bounds.right, role: 'equal' },
        { from: bounds.right, to: list.length, role: 'greater' }
      ],
      markers: [
        { at: bounds.left, label: 'lo', role: 'less' },
        { at: Math.max(bounds.left, bounds.right - 1), label: 'hi', role: 'greater' }
      ],
      summary: 'One partition of 240 elements: ' + bounds.left + ' below the pivot, ' +
        (bounds.right - bounds.left) + ' equal to it, ' + (list.length - bounds.right) + ' above.'
    });

    const leftSize = bounds.left;
    const rightSize = list.length - bounds.right;
    root.jQuery('#qks-array-note').text('A single partition of 240 elements with the selected scheme and ' +
      'pivot: ' + leftSize + ' below, ' + (bounds.right - bounds.left) + ' equal, ' + rightSize + ' above. ' +
      'The split is the whole story — a partition that leaves ' + Math.max(leftSize, rightSize) +
      ' on one side and ' + Math.min(leftSize, rightSize) + ' on the other has done one level of work and ' +
      'barely reduced the problem. Only the three-way scheme produces a middle band, and that band is ' +
      'finished: it is never looked at again.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

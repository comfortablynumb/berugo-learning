/**
 * Section: library sorts.
 *
 * The centrepiece is the merge-stack table, because the 2015 verification
 * result is a claim about a stack and cannot be shown any other way. Toggling
 * the collapse rule to the pre-2015 version and loading the de Gouw run
 * lengths puts a violated invariant on screen next to a correctly sorted
 * array - which is the entire lesson.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'library-sorts';
  let panel = null;
  let runsView = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
    app.state.subscribe('theme', function () {
      if (runsView) runsView.redraw();
    });
  }

  function diagram() {
    return {
      title: 'Diagram — the merge-stack collapse rules',
      caption: 'X is the newest run, Y the one below it, Z below that. The collapse loop runs until both ' +
        'invariants hold, merging the smaller neighbour each time.',
      definition: [
        'flowchart TD',
        '    A["push a run — X"] --> B{"Z > Y + X ?"}',
        '    B -- no --> C["merge Y with the smaller of X and Z"]',
        '    B -- yes --> D{"Y > X ?"}',
        '    D -- no --> E["merge X into Y"]',
        '    D -- yes --> F["invariants hold — stop"]',
        '    C --> B',
        '    E --> B',
        '    F --> G["the 2015 fix also checks W > Z + Y, one run deeper"]'
      ].join('\n')
    };
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        'Timsort and pdqsort solve the same problem from opposite directions. Timsort asks what order is ' +
          'already present and exploits it: it finds the ascending runs, pads short ones to minrun with a ' +
          'binary insertion sort, and merges them under invariants that keep the run lengths balanced. On ' +
          'nearly-sorted input of 2 000 elements it does 3 099 comparisons - 1.55 per element - where a plain ' +
          'merge sort does 15 061. pdqsort asks what pattern is about to make it quadratic and destroys it: ' +
          'when a partition comes back badly unbalanced it swaps a few elements so the next pivot sample is ' +
          'uncorrelated with whatever produced that shape.',
        'The merge-stack invariants are the interesting part of Timsort, and they are two inequalities over ' +
          'the top three run lengths: Z > Y + X and Y > X. They are what bounds the stack depth, and that ' +
          'bound is what Java sized its fixed-length stack array from. In 2015 de Gouw, Rot, de Boer, Bubel ' +
          'and Hähnle tried to verify that bound and could not - because the collapse rule only checked the ' +
          'top three runs, and a violation can survive one level further down. Run lengths of 120, 80, 25, 20 ' +
          'and 30 are enough to produce it: the stack settles at 120, 80, 45, 30 and 120 is not greater than ' +
          '80 + 45.',
        'What makes that bug worth a section is how it presented. The sort was not wrong. Feed those run ' +
          'lengths to the buggy version and it returns a perfectly sorted array, every time, while the ' +
          'invariant its stack size was proved from no longer holds. The observable failure was an ' +
          'ArrayIndexOutOfBoundsException on arrays of about 67 million elements, which is why it sat in ' +
          'Java, Python and Android for years. A test of the output could not have found it; a check of the ' +
          'invariant finds it in one run, and the demo below runs that check after every push.'
      ],
      demo: {
        title: 'Interactive demo — the run stack, the invariants, and the rule that broke them',
        markup: root.LibrarySortsTemplate.render()
      },
      diagram: diagram(),
      insight: 'The Timsort bug is the best available argument for verifying an invariant rather than testing ' +
        'an output. It survived years in three standard libraries, on billions of sorts, because every one of ' +
        'those sorts returned the right answer - the broken invariant was invisible from outside and the ' +
        'failure it enabled needed an input of tens of millions of elements. No amount of randomised output ' +
        'testing finds that. Checking `Z > Y + X` after every push finds it on the first constructed input, ' +
        'and costs two comparisons. When a data structure has a stated invariant, assert it in the code rather ' +
        'than hoping the output implies it.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.LibrarySortsTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  /* The run lengths from de Gouw et al., as an array whose natural runs are
     exactly those lengths. Random data never reaches this case, which is why
     the demo has to construct it. */
  const PAPER_LENGTHS = [120, 80, 25, 20, 30];

  function paperInput() {
    const out = [];
    let base = 1000000;
    PAPER_LENGTHS.forEach(function (length) {
      for (let i = 0; i < length; i += 1) out.push(base + i);
      base -= 1;
    });
    return out;
  }

  const timsortFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const values = parts[0] === 'paper'
      ? paperInput()
      : root.SortLab.input(parts[0], Number(parts[1]), 3);
    const list = values.slice();
    const ops = root.SortOps.create({});
    const report = root.Timsort.sort(list, ops, {
      buggyCollapse: parts[2] === 'buggy',
      minRun: parts[0] === 'paper' ? 1 : undefined
    });
    let wrong = 0;
    const expected = values.slice().sort(function (a, b) { return a - b; });
    for (let i = 0; i < expected.length; i += 1) {
      if (list[i] !== expected[i]) wrong += 1;
    }
    return { report: report, stats: ops.stats(), wrong: wrong, size: values.length };
  });

  const runsFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const values = root.SortLab.input(parts[0], Number(parts[1]), 3);
    return {
      values: values,
      runs: root.MergeSort.detectRuns(values.slice(), root.SortOps.create({}), { reverseDescending: false })
    };
  });

  const compareFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.SortLab.compare({
      kind: parts[0], size: Number(parts[1]), seed: 3,
      algorithms: ['timsort', 'pdqsort', 'introsort', 'merge-bottom-up']
    });
  });

  /* Pinned at the size the worked example measures, not at the slider: the
     pdqsort mechanisms are a claim about 20 000 elements, and the all-equal
     column is not one of SortLab's generated shapes. */
  const PDQ_SIZE = 20000;

  const pdqFor = root.Helpers.memoise(function (key) {
    const size = Number(key);
    const identical = [];
    for (let i = 0; i < size; i += 1) identical.push(7);
    const shapes = root.SortLab.kinds.map(function (kind) {
      return { kind: kind, values: root.SortLab.input(kind, size, 3) };
    }).concat([{ kind: 'all-equal', values: identical }]);

    return shapes.map(function (shape) {
      const ops = root.SortOps.create({});
      const report = root.Pdqsort.sort(shape.values.slice(), ops, {});
      return { kind: shape.kind, report: report, comparisons: ops.stats().comparisons };
    });
  });

  function update(app) {
    const values = panel.values();
    const collapse = values['lib-collapse'];
    const timsort = timsortFor(values['lib-shape'] + '|' + values['lib-size'] + '|' + collapse);
    const paper = timsortFor('paper|0|' + collapse);

    paintMetrics(timsort, paper, collapse);
    paintStack(paper, collapse);
    paintCompare(values);
    paintPdq();
    drawRuns(values);
  }

  function paintMetrics(timsort, paper, collapse) {
    root.MetricGrid.update({
      'lib-runs': {
        value: root.Format.exact(timsort.report.runs),
        note: root.Format.exact(timsort.report.naturalRuns) + ' natural runs before minrun padding'
      },
      'lib-minrun': {
        value: root.Format.exact(timsort.report.minRun),
        note: 'always between 16 and 32 above the cutoff'
      },
      'lib-stack': {
        value: root.Format.exact(timsort.report.maxStackDepth),
        note: root.Format.exact(timsort.report.merges) + ' merges over the whole sort'
      },
      'lib-violations': {
        value: root.Format.exact(paper.report.invariantViolations),
        note: collapse === 'buggy'
          ? 'on the paper\'s run lengths, with the original rule'
          : 'on the paper\'s run lengths, with the fix'
      }
    });
  }

  function paintStack(paper, collapse) {
    const settled = paper.report.stackHistory.filter(function (entry) { return entry.settled; });
    const html = settled.map(function (entry, index) {
      const lengths = entry.lengths;
      const deepOk = lengths.length < 3 || lengths[lengths.length - 3] > lengths[lengths.length - 2] + lengths[lengths.length - 1];
      const shallowOk = lengths.length < 2 || lengths[lengths.length - 2] > lengths[lengths.length - 1];
      return '<tr' + (entry.violations ? ' style="font-weight:700"' : '') + '>' +
        '<td class="mono">' + (index + 1) + '</td>' +
        '<td class="mono">' + lengths.join(', ') + '</td>' +
        '<td>' + (lengths.length < 3 ? '—' : (deepOk ? 'holds' : 'BROKEN')) + '</td>' +
        '<td>' + (lengths.length < 2 ? '—' : (shallowOk ? 'holds' : 'BROKEN')) + '</td></tr>';
    }).join('');

    root.jQuery('#lib-stack-table tbody').html(html);
    root.jQuery('#lib-stack-table-note').text('The merge stack after each of the five runs from the 2015 paper — ' +
      'lengths 120, 80, 25, 20, 30 — settled, meaning after the collapse has finished. With the fix the final ' +
      'state is a single run of 275 and no invariant is ever broken. With the original rule the stack settles ' +
      'at 120, 80, 45, 30, and 120 is not greater than 80 + 45 = 125. The sorted output is identical either ' +
      'way: this run reports ' + paper.wrong + ' elements out of place with the ' +
      (collapse === 'buggy' ? 'buggy' : 'fixed') + ' rule.');
  }

  function paintCompare(values) {
    const rows = compareFor(values['lib-shape'] + '|' + values['lib-size']);
    const html = rows.map(function (row) {
      return '<tr><td>' + row.label + '</td>' +
        '<td class="mono">' + root.Format.exact(row.comparisons) + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.comparisonsPerElement) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.moves) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.allocations) + '</td>' +
        '<td>' + (row.unstable === 0 ? 'yes' : 'no') + '</td></tr>';
    }).join('');

    root.jQuery('#lib-compare tbody').html(html);
    root.jQuery('#lib-compare-note').text('The two library sorts and the two textbook ones on the same input. ' +
      'Switch the shape between "nearly sorted" and "random" and watch the ordering change: on structured ' +
      'input Timsort is far ahead because the runs are already there, and on uniform random data it has ' +
      'nothing to exploit and pdqsort\'s lower constant wins. Neither is universally faster, which is why ' +
      'Python ships one and Rust ships both — Timsort-derived for the stable sort, pdqsort-derived for the ' +
      'unstable one.');
  }

  function paintPdq() {
    const rows = pdqFor(String(PDQ_SIZE));
    const html = rows.map(function (row) {
      return '<tr><td>' + row.kind + '</td>' +
        '<td class="mono">' + root.Format.exact(row.comparisons) + '</td>' +
        '<td class="mono">' + row.report.maxDepth + '</td>' +
        '<td class="mono">' + row.report.alreadyPartitioned + '</td>' +
        '<td class="mono">' + row.report.partialInsertionWins + '</td>' +
        '<td class="mono">' + row.report.patternBreaks + '</td>' +
        '<td class="mono">' + row.report.equalBlocks + '</td>' +
        '<td class="mono">' + row.report.heapsortFallbacks + '</td></tr>';
    }).join('');

    root.jQuery('#lib-pdq tbody').html(html);
    root.jQuery('#lib-pdq-note').text('Each column is one of pdqsort\'s mechanisms, and each fires only on ' +
      'the shape it exists for. Sorted input wins with the bounded insertion sort and costs two comparisons ' +
      'per element at depth 1. Duplicate-heavy input uses the equal-block guard. Organ-pipe input unbalances ' +
      'the pivot repeatedly and gets the pattern broken hundreds of times. Random input triggers almost ' +
      'nothing — which is correct, because there is no pattern there to defeat. This table is fixed at ' +
      root.Format.exact(PDQ_SIZE) + ' elements, the size the worked example quotes, and does not follow ' +
      'the slider.');
  }

  function drawRuns(values) {
    const detected = runsFor(values['lib-shape'] + '|' + Math.min(600, Number(values['lib-size'])));
    const timsort = timsortFor(values['lib-shape'] + '|' + values['lib-size'] + '|' + values['lib-collapse']);

    runsView = root.ArrayView.runs(root.jQuery('#lib-runs-view')[0], {
      height: 240,
      values: detected.values,
      runs: detected.runs,
      summary: detected.runs.length + ' natural runs in the first ' + detected.values.length + ' elements.'
    });

    root.jQuery('#lib-runs-caption').text('The natural runs in the first ' + detected.values.length +
      ' elements: ' + detected.runs.length + ' of them. Over the whole ' + timsort.size +
      '-element input Timsort found ' + root.Format.exact(timsort.report.naturalRuns) +
      ' and pushed ' + root.Format.exact(timsort.report.runs) + ' after padding short ones up to minrun of ' +
      timsort.report.minRun + '. On random data the natural runs average about two elements and the padding ' +
      'does nearly all the work; on nearly-sorted data the runs are already long and there is almost nothing ' +
      'left to do.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

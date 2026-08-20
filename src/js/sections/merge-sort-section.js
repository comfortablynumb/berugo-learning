/**
 * Section: merge sort and its variants.
 *
 * Four schedules for the same merges. The demo's job is to make the
 * difference between them a number rather than a paragraph: top-down and
 * bottom-up do the same comparisons and bottom-up does half the moves,
 * natural merge does none at all on sorted input, and in-place merging trades
 * every allocation for a pile of swaps.
 *
 * The run view is the picture that explains the natural variant, and it is
 * also the picture the Timsort section reuses.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'merge-sort';
  let panel = null;
  let runsView = null;
  let chart = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
    app.state.subscribe('theme', function () {
      if (runsView) runsView.redraw();
      if (chart) chart.redraw();
    });
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        'Merge sort is one operation - merging two sorted runs into one - plus a decision about what order to ' +
          'do the merges in. Top-down recursion, bottom-up doubling and natural run detection are three answers ' +
          'to that scheduling question and they perform the same merges; what differs is the bookkeeping. On ' +
          '2 000 random elements the top-down and bottom-up schedules do 19 407 and 19 420 comparisons - the ' +
          'same, to within noise - and 43 904 against 24 000 moves, because the textbook recursion copies the ' +
          'merged range back into the array at every level and the bottom-up loop swaps the two buffers instead.',
        'Stability is one character. The merge takes from the left run when the two heads compare equal, so an ' +
          'element that started earlier stays earlier; change that `<=` to `<` and the sort still returns a ' +
          'correctly ordered array while silently ceasing to be stable. There is no test of the output alone ' +
          'that catches it, which is why every element in this demo carries the index it started at.',
        'Natural merge sort is the variant that matters in practice, and it is the direct ancestor of Timsort. ' +
          'It finds the ascending runs already present and merges those: on already-sorted input it finds one ' +
          'run, performs zero merges and costs 2 000 comparisons - a single linear scan. A strictly descending ' +
          'stretch is reversed in place and counted as a run too, which is why reversed input is also one pass. ' +
          'The descent test has to be *strict* for that reversal to be safe, and that is the whole reason ' +
          'Timsort uses strict descent too.'
      ],
      demo: {
        title: 'Interactive demo — four schedules, the runs they find, and what each one costs',
        markup: root.MergeSortTemplate.render()
      },
      diagram: {
        title: 'Diagram — the divide phase, with the merge widths annotated',
        caption: 'Every level merges the whole array once, and there are ⌈log₂ n⌉ levels - which is where ' +
          'n log n comes from. The widths on the edges are what each merge at that level handles.',
        definition: [
          'flowchart TD',
          '    A["8 elements — one merge of 4 + 4"] --> B["4 elements — merge 2 + 2"]',
          '    A --> C["4 elements — merge 2 + 2"]',
          '    B --> D["2 — merge 1 + 1"]',
          '    B --> E["2 — merge 1 + 1"]',
          '    C --> F["2 — merge 1 + 1"]',
          '    C --> G["2 — merge 1 + 1"]',
          '    D --> H["1 — a run of one is sorted"]'
        ].join('\n')
      },
      insight: 'Merge sort\'s real advantage is not its worst-case bound - introsort has the same one and is ' +
        'faster in memory. It is that the merge step reads both inputs strictly forwards and writes its output ' +
        'strictly forwards, so it works on data that arrives as a stream and never needs to be resident. That ' +
        'is why every external sort, every shuffle stage in a data pipeline and every LSM-tree compaction is a ' +
        'merge and not a quicksort: quicksort has to seek, and merge sort does not.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.MergeSortTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  const VARIANTS = ['merge-top-down', 'merge-bottom-up', 'merge-natural', 'merge-in-place'];
  const LABELS = {
    'top-down': 'merge-top-down', 'bottom-up': 'merge-bottom-up',
    natural: 'merge-natural', 'in-place': 'merge-in-place'
  };

  const rowsFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.SortLab.compare({
      kind: parts[0], size: Number(parts[1]), seed: 3, algorithms: VARIANTS
    });
  });

  const runsFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const values = root.SortLab.input(parts[0], Number(parts[1]), 3);
    const detected = root.MergeSort.detectRuns(values.slice(), root.SortOps.create({}),
      { reverseDescending: false });
    return { values: values, runs: detected };
  });

  const kwayFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return kwayTable(parts[0], Number(parts[1]), Number(parts[2]));
  });

  function update(app) {
    const values = panel.values();
    const shapeKey = values['mgs-shape'] + '|' + values['mgs-size'];
    const rows = rowsFor(shapeKey);
    const chosen = rows.filter(function (row) {
      return row.algorithm === LABELS[values['mgs-variant']];
    })[0];
    const detected = runsFor(values['mgs-shape'] + '|' + Math.min(600, Number(values['mgs-size'])));

    paintMetrics(chosen, detected.runs.length);
    paintVariants(rows, chosen);
    paintKway(values);
    drawRuns(detected, values);
    drawChart(app, rows);
  }

  function paintMetrics(chosen, runCount) {
    root.MetricGrid.update({
      'mgs-comparisons': {
        value: root.Format.exact(chosen.comparisons),
        note: root.Format.fixed(chosen.comparisonsPerElement) + ' per element'
      },
      'mgs-moves': {
        value: root.Format.exact(chosen.moves),
        note: chosen.swaps ? root.Format.exact(chosen.swaps) + ' of them are swaps' : 'no swaps at all'
      },
      'mgs-allocations': {
        value: root.Format.exact(chosen.allocations),
        note: chosen.allocations ? root.Format.exact(chosen.allocatedSlots) + ' slots in total' : 'nothing allocated'
      },
      'mgs-runs': { value: root.Format.exact(runCount), note: 'ascending stretches in the first 600 elements' }
    });
  }

  function paintVariants(rows, chosen) {
    const html = rows.map(function (row) {
      return '<tr' + (row.algorithm === chosen.algorithm ? ' style="font-weight:600"' : '') + '>' +
        '<td>' + row.label + '</td>' +
        '<td class="mono">' + root.Format.exact(row.comparisons) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.moves) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.swaps) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.allocations) + '</td>' +
        '<td>' + (row.unstable === 0 ? 'yes' : 'no') + '</td>' +
        '<td class="mono">' + row.wrong + '</td></tr>';
    }).join('');

    root.jQuery('#mgs-variants tbody').html(html);
    root.jQuery('#mgs-variants-note').text('All four are stable and all four are correct; they are the same ' +
      'algorithm scheduled four ways. Bottom-up does the same comparisons as top-down for about half the ' +
      'moves, because it alternates the roles of the array and the buffer instead of copying back after every ' +
      'merge. In-place merging removes the buffer entirely and pays for it in swaps - which is the honest ' +
      'price of the phrase "sorts in place".');
  }

  function paintKway(values) {
    const rows = kwayFor(values['mgs-shape'] + '|' + values['mgs-size'] + '|' + values['mgs-order']);
    const html = rows.map(function (row) {
      return '<tr' + (row.order === Number(values['mgs-order']) ? ' style="font-weight:600"' : '') + '>' +
        '<td class="mono">' + row.order + '-way</td>' +
        '<td class="mono">' + row.order + '</td>' +
        '<td class="mono">' + row.passes + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.comparisonsPerElement) + '</td></tr>';
    }).join('');

    root.jQuery('#mgs-kway tbody').html(html);
    root.jQuery('#mgs-kway-note').text('A k-way merge does not save comparisons - log₂ k of them are needed ' +
      'to pick the smallest of k heads however the merging is arranged, and the totals barely move down the ' +
      'column. What it saves is *passes*, and a pass over data that does not fit in memory is a full read and ' +
      'a full write. That is the whole reason external sorting cares about the merge order, and section 10.9 ' +
      'is where it becomes an I/O figure.');
  }

  function kwayTable(shape, size, unused) {
    const source = root.SortLab.input(shape, Math.min(4096, size), 3);
    return [2, 4, 8, 16].map(function (order) {
      const runs = splitIntoRuns(source, 64);
      const ops = root.SortOps.create({});
      let current = runs;
      let passes = 0;
      while (current.length > 1) {
        const next = [];
        for (let i = 0; i < current.length; i += order) {
          next.push(root.MergeSort.kWayMerge(current.slice(i, i + order), ops).values);
        }
        current = next;
        passes += 1;
      }
      return {
        order: order, passes: passes,
        comparisonsPerElement: ops.stats().comparisons / Math.max(1, source.length)
      };
    });
  }

  function splitIntoRuns(values, width) {
    const runs = [];
    for (let from = 0; from < values.length; from += width) {
      runs.push(values.slice(from, from + width).sort(function (a, b) { return a - b; }));
    }
    return runs;
  }

  function drawRuns(detected, values) {
    runsView = root.ArrayView.runs(root.jQuery('#mgs-runs-view')[0], {
      height: 240,
      values: detected.values,
      runs: detected.runs,
      summary: detected.runs.length + ' ascending runs in ' + detected.values.length + ' elements.'
    });

    const longest = detected.runs.reduce(function (best, run) {
      return Math.max(best, run.length);
    }, 0);
    root.jQuery('#mgs-runs-caption').text('The alternating bands are the ascending runs already present in the ' +
      'first ' + detected.values.length + ' elements: ' + detected.runs.length + ' of them, the longest ' +
      longest + ' elements. Natural merge sort starts from these instead of from runs of one, which is why ' +
      'the "' + values['mgs-shape'] + '" shape costs it what it does. Random data has runs of about two, and ' +
      'that is exactly why the natural variant buys nothing there.');
  }

  function drawChart(app, rows) {
    chart = root.ArrayView.compare(root.jQuery('#mgs-chart')[0], {
      height: 220,
      rows: rows.map(function (row) {
        return { label: row.label.replace('merge ', ''), comparisons: row.comparisons, moves: row.moves };
      }),
      summary: 'Comparisons and moves per schedule, on a log axis.'
    });

    root.jQuery('#mgs-chart-note').text('Blue is comparisons, orange is moves, and the axis is logarithmic ' +
      'because the move counts differ by more than the comparison counts do. The shape to notice is that the ' +
      'blue bars are nearly level across all four schedules and the orange ones are not: scheduling the merges ' +
      'differently changes how much data gets copied, and hardly changes how many questions get asked.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

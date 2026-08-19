/**
 * Section: 2-3 finger trees and monoid annotations.
 *
 * The claim the demo has to support is that four unrelated data structures are
 * the same structure with three different functions plugged into it, so the
 * monoid table reports the shape beside the measure: identical spines, four
 * different numbers. The split and concat counters are measured on a freshly
 * reset counter, because a build of 3 000 elements would otherwise dwarf them.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'finger-trees';
  const CURVE_POINTS = [250, 500, 1000, 2000, 4000, 8000, 16000];
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

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        'A finger tree keeps a small digit — one to four elements — at each end of every level, with the rest ' +
          'of the sequence as a tree of the level below. Both ends are therefore a constant hop away, so push ' +
          'and pop at either end are O(1) amortised, and the depth is logarithmic, so anything that has to ' +
          'reach the middle is O(log n). On 3 000 elements the spine is 7 levels holding 26 elements in its ' +
          'digits, and everything else is in the middle.',
        'What turns that into a general structure is the annotation. Every node caches the product of its ' +
          'subtree under a monoid you supply, and every query is a descent guided by that cached value. Change ' +
          'the monoid and the same code becomes a different structure: over the same 1 000 items the root ' +
          'reports 1 000 for size, 49 956 for the sum of values, 999 for the maximum priority and 499 for the ' +
          'largest interval end — with the identical spine in all four.',
        'The operations that are hard elsewhere follow from the annotation. Splitting a 3 000-element sequence ' +
          'at any position visits 14 nodes, because the descent compares the running product against the ' +
          'predicate instead of counting elements, and putting the two halves back together allocates 20. A ' +
          'cons list does either in O(n) and an array does the split in O(1) and the push-front in O(n) — the ' +
          'finger tree is the one that does all four in logarithmic time or better.'
      ],
      demo: {
        title: 'Interactive demo — one structure, four monoids, and a split that is a descent',
        markup: root.FingerTreesTemplate.render()
      },
      diagram: {
        title: 'Diagram — digits, spine and the annotated descent',
        caption: 'The digits at each end make both ends cheap; the annotation at each node makes the middle ' +
          'reachable. A split reads three cached measures per level — prefix, middle, suffix — and never looks ' +
          'at an element until the final digit.',
        definition: [
          'flowchart TD',
          '    D["Deep · measure 3 000"] --> L["left digit · 1–4 elements"]',
          '    D --> M["middle: Deep of 2-3 nodes · measure 2 974"]',
          '    D --> R["right digit · 1–4 elements"]',
          '    M --> L2["left digit"]',
          '    M --> M2["middle · measure 2 900"]',
          '    M --> R2["right digit"]',
          '    S{"running measure > target?"} -.-> L',
          '    S -.-> M',
          '    S -.-> R'
        ].join('\n')
      },
      insight: 'The monoid is the transferable idea, not the tree. Any balanced structure that caches an ' +
        'associative summary of each subtree can answer "find the first prefix whose summary crosses this ' +
        'threshold" in a descent, and that single query shape covers indexing, priority selection, interval ' +
        'search and running totals. The two conditions are real, though: the operation must be genuinely ' +
        'associative and the identity must be genuinely neutral, or the cached measure and the recomputed one ' +
        'disagree in a way that surfaces as an off-by-one in some rebalancing nobody wants to debug.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.FingerTreesTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  const opsFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|').map(Number);
    return root.VersionLab.sequenceOps({ count: parts[0], at: Math.round(parts[0] * parts[1] / 100) });
  });

  const monoidsFor = root.Helpers.memoise(function () {
    return root.VersionLab.monoidCompare({ count: 1000, seed: 7 });
  });

  const curveFor = root.Helpers.memoise(function () {
    return CURVE_POINTS.map(function (count) {
      return root.VersionLab.sequenceOps({ count: count, at: Math.round(count / 2) });
    });
  });

  function update(app) {
    const values = panel.values();
    const ops = opsFor(values['ftr-count'] + '|' + values['ftr-split']);
    const monoids = monoidsFor('all');
    const chosen = monoids.filter(function (row) { return row.monoid === values['ftr-monoid']; })[0];

    paintMetrics(ops, chosen);
    paintMonoids(monoids, chosen);
    paintCost(ops);
    drawChart(app, curveFor('all'));
  }

  function describe(monoid) {
    return {
      size: 'one per element, added — a sequence',
      sum: 'the item\'s value, added — a running total',
      priority: 'the item\'s priority, maximised — a priority queue',
      intervalEnd: 'the item\'s interval end, maximised — an interval map'
    }[monoid];
  }

  function paintMetrics(ops, chosen) {
    root.MetricGrid.update({
      'ftr-measure': {
        value: root.Format.exact(chosen.measure),
        note: 'over ' + root.Format.exact(chosen.count) + ' items, cached and never recomputed'
      },
      'ftr-spine': {
        value: root.Format.exact(ops.shape.spine),
        note: root.Format.exact(ops.shape.digitElements) + ' elements sit in the digits'
      },
      'ftr-visits': {
        value: root.Format.exact(ops.splitVisits),
        note: 'to cut ' + root.Format.exact(ops.count) + ' elements at position ' + root.Format.exact(ops.at)
      },
      'ftr-concat': {
        value: root.Format.exact(ops.concatAllocated),
        note: 'rejoining gives back all ' + root.Format.exact(ops.rejoinedLength) + ' elements'
      }
    });
  }

  function paintMonoids(monoids, chosen) {
    const html = monoids.map(function (row) {
      return '<tr' + (row.monoid === chosen.monoid ? ' style="font-weight:600"' : '') + '>' +
        '<td class="mono">' + row.monoid + '</td>' +
        '<td>' + describe(row.monoid) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.measure) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.spine) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.digitElements) + '</td>' +
        '<td class="mono">' + row.widths.join(', ') + '</td></tr>';
    }).join('');

    root.jQuery('#ftr-monoids tbody').html(html);
    root.jQuery('#ftr-monoids-note').text('The last three columns are identical on every row and the third is ' +
      'different on every row, which is the claim: the four trees hold the same items in the same shape and ' +
      'disagree only about what to remember. Nothing in the structural code knows which monoid it is running — ' +
      'the identity, the combine and the measure are the only three functions that differ.');
  }

  function paintCost(ops) {
    const rows = [
      { op: 'push / pop at either end', tree: 'O(1) amortised', list: 'O(1) front, O(n) back', array: 'O(1) back, O(n) front' },
      { op: 'index the middle', tree: 'O(log n) — ' + root.Format.exact(ops.splitVisits) + ' nodes visited', list: 'O(n)', array: 'O(1)' },
      { op: 'split at a measured position', tree: 'O(log n) — the same descent', list: 'O(n)', array: 'O(1) view, O(n) copy' },
      { op: 'concatenate two sequences', tree: 'O(log n) — ' + root.Format.exact(ops.concatAllocated) + ' nodes', list: 'O(n)', array: 'O(n)' },
      { op: 'persistent — old version survives', tree: 'yes, by construction', list: 'yes', array: 'no, without copying' }
    ];

    const html = rows.map(function (row) {
      return '<tr><td>' + row.op + '</td><td class="mono">' + row.tree + '</td>' +
        '<td class="mono">' + row.list + '</td><td class="mono">' + row.array + '</td></tr>';
    }).join('');

    root.jQuery('#ftr-cost tbody').html(html);
    root.jQuery('#ftr-cost-note').text('The array column is the honest one: if the sequence is read by index ' +
      'and appended at one end, an array wins every row that matters and a finger tree is a constant-factor ' +
      'tax with cached measures nobody reads. The tree earns its place when both ends are hot *and* the middle ' +
      'has to be cut, or when the same sequence needs two different indexes at once — which is exactly what ' +
      'the monoid table above is showing.');
  }

  function drawChart(app, curve) {
    chart = root.ErrorBandView.curve(root.jQuery('#ftr-chart')[0], {
      lazyLib: app.lazyLib,
      height: 260,
      legendHost: root.jQuery('#ftr-chart-legend')[0],
      xLabel: 'elements in the sequence',
      yLabel: 'nodes touched',
      series: [
        { label: 'split — nodes visited', width: 3,
          points: curve.map(function (row) { return { x: row.count, y: row.splitVisits }; }) },
        { label: 'concat — nodes allocated', dashed: true,
          points: curve.map(function (row) { return { x: row.count, y: row.concatAllocated }; }) },
        { label: 'log₂ n, for scale', dashed: true,
          points: curve.map(function (row) { return { x: row.count, y: Math.log2(row.count) }; }) }
      ]
    });

    root.jQuery('#ftr-chart-note').text('The sequence grows 64× across this chart and both counts stay ' +
      'between 6 and 25, which is what "the split is a descent" means once it is measured rather than claimed. ' +
      'They are not monotone, and that is honest rather than noisy: the cost depends on where in the digit ' +
      'structure the cut lands, so a longer sequence can be split slightly more cheaply than a shorter one. ' +
      'The log₂ n line is drawn for scale, not as a fitted bound.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

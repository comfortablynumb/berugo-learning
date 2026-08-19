/**
 * Section: versioned range queries and prefix-version order statistics.
 *
 * Two uses of one idea. A persistent segment tree answers a range sum at any
 * version for the cost of an ordinary descent; the same structure built once
 * per prefix answers "the k-th smallest value in positions l to r", which no
 * single non-persistent segment tree can do at all. Every figure the prose
 * quotes is measured here, and every version is replayed against an array.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'versioned-queries';
  const BYTES_PER_ELEMENT = 8;
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
        'A segment tree update rewrites one root-to-leaf path, so making it persistent costs nothing beyond ' +
          'not overwriting: build the ⌈log₂ n⌉ + 1 nodes on that path, point them at the siblings the previous ' +
          'version already had, and keep the new root. On 1 024 elements that is exactly 11 nodes per update, ' +
          'and 500 updates leave every one of the 501 versions queryable for 241 504 bytes against the ' +
          '32 817 504 a snapshot per version would need.',
        'The queries themselves are not slower. A version is a root pointer, so a range sum at version 12 is ' +
          'the same descent as a range sum at the head — there is no version index to search and no log factor ' +
          'to pay. The demo checks that claim rather than asserting it: 2 004 range sums spread over every ' +
          'version, each compared against the array as it stood at that moment, with 0 disagreements.',
        'The second use is the one that has no non-persistent equivalent. Build one version per array prefix, ' +
          'each counting how many values so far fall in each part of the value domain; the counts for ' +
          'positions l to r are the difference of versions r and l − 1, and a descent guided by that ' +
          'difference finds the k-th smallest in the range in a single pass — 10.0 descents per query over a ' +
          '1 000-value domain, for 10.98 nodes per value.'
      ],
      demo: {
        title: 'Interactive demo — every version queryable, and the quantile index that needs them',
        markup: root.VersionedQueriesTemplate.render()
      },
      diagram: {
        title: 'Diagram — the difference of two versions',
        caption: 'The quantile index keeps one version per prefix. Version r counts the values in positions ' +
          '1..r and version l − 1 counts those in 1..l − 1, so their difference is the count for the interval — ' +
          'and the descent reads both trees together rather than building a third.',
        definition: [
          'flowchart LR',
          '    A["version l − 1<br/>counts for 1..l−1"] --> D{"left child count<br/>v_r.left − v_{l−1}.left"}',
          '    B["version r<br/>counts for 1..r"] --> D',
          '    D -- "k ≤ that count" --> E["descend left"]',
          '    D -- "k > that count" --> F["k −= count<br/>descend right"]',
          '    E --> G["leaf reached: the k-th smallest in l..r"]',
          '    F --> G'
        ].join('\n')
      },
      insight: 'The reason this works is that a persistent structure makes "the state at time t" a first-class ' +
        'value rather than a reconstruction. Once versions are values you can subtract them, and a whole class ' +
        'of queries that look like they need a different index — order statistics on a range, "how many ' +
        'distinct values before position i", a snapshot read from an hour ago — collapse into one descent over ' +
        'a structure you already keep. The cost is a garbage-collection question rather than a query one: ' +
        'nothing is ever freed until the version pointing at it is dropped.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.VersionedQueriesTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  const sumsFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|').map(Number);
    return root.VersionLab.versionedQueries({ size: parts[0], updates: parts[1] });
  });

  const growthFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|').map(Number);
    return root.VersionLab.versionGrowth({ size: parts[0], updates: parts[1] });
  });

  const quantilesFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|').map(Number);
    return root.VersionLab.rangeQuantiles({ size: parts[0], domain: parts[1], probes: parts[2] });
  });

  function update(app) {
    const values = panel.values();
    const run = sumsFor(values['vq-size'] + '|' + values['vq-updates']);
    const quantiles = quantilesFor(Math.min(1024, Number(values['vq-size'])) + '|' +
      values['vq-domain'] + '|' + values['vq-probes']);

    paintMetrics(run);
    paintCompare(run);
    paintQuantiles(quantiles);
    drawChart(app, growthFor(values['vq-size'] + '|' + values['vq-updates']), run);
  }

  function paintMetrics(run) {
    const bound = run.shape.depthBound;

    root.MetricGrid.update({
      'vq-nodes': {
        value: root.Format.fixed(run.shape.nodesPerUpdate, 2),
        note: '⌈log₂ ' + root.Format.exact(run.size) + '⌉ + 1 = ' + bound +
          (Math.abs(run.shape.nodesPerUpdate - bound) < 0.001 ? ', and the measurement sits on it' : '')
      },
      'vq-bytes': {
        value: root.Format.exact(run.shape.bytes),
        note: root.Format.exact(run.shape.versions + 1) + ' versions of ' + root.Format.exact(run.size) + ' elements'
      },
      'vq-saving': {
        value: root.Format.fixed(run.savingAgainstCopying, 1) + '×',
        note: 'a snapshot per version would be ' + root.Format.exact(run.shape.bytesIfCopied) + ' bytes'
      },
      'vq-wrong': {
        value: root.Format.exact(run.wrong),
        note: 'of ' + root.Format.exact(run.checks) + ' range sums, spread over every version'
      }
    });
  }

  function paintCompare(run) {
    const latestOnly = run.size * BYTES_PER_ELEMENT * 2;
    const rows = [
      { label: 'persistent segment tree', bytes: run.shape.bytes,
        update: root.Format.exact(run.shape.nodesPerUpdate) + ' nodes',
        query: 'O(log n) descent', history: 'yes' },
      { label: 'one segment tree, overwritten', bytes: latestOnly,
        update: root.Format.exact(run.shape.depthBound) + ' nodes, in place',
        query: 'O(log n) descent', history: 'no' },
      { label: 'a snapshot of the array per version', bytes: run.shape.bytesIfCopied,
        update: root.Format.exact(run.size) + ' elements copied',
        query: 'O(n) scan', history: 'yes' }
    ];

    const html = rows.map(function (row) {
      return '<tr' + (row.history === 'yes' && row.bytes === run.shape.bytes ? ' style="font-weight:600"' : '') + '>' +
        '<td>' + row.label + '</td>' +
        '<td class="mono">' + root.Format.exact(row.bytes) + '</td>' +
        '<td class="mono">' + root.Format.exact(Math.round(row.bytes / (run.shape.versions + 1))) + '</td>' +
        '<td class="mono">' + row.update + '</td>' +
        '<td class="mono">' + row.query + '</td>' +
        '<td>' + row.history + '</td></tr>';
    }).join('');

    root.jQuery('#vq-compare tbody').html(html);
    root.jQuery('#vq-compare-note').text('The middle row is the one worth staring at: keeping every version ' +
      'costs ' + root.Format.fixed(run.shape.bytes / Math.max(1, latestOnly), 1) + '× the tree that keeps none, ' +
      'and answers a strictly larger set of questions at the same query cost. That ratio is what makes ' +
      '"just make it persistent" a reasonable default for an index rather than an indulgence — and it grows ' +
      'with the number of updates, not with the size of the array.');
  }

  function paintQuantiles(run) {
    const html = '<tr>' +
      '<td class="mono">' + root.Format.exact(run.size) + '</td>' +
      '<td class="mono">' + root.Format.exact(run.domain) + '</td>' +
      '<td class="mono">' + root.Format.exact(run.shape.versions + 1) + '</td>' +
      '<td class="mono">' + root.Format.fixed(run.shape.nodesPerValue, 2) + '</td>' +
      '<td class="mono">' + root.Format.fixed(run.descentsPerQuery, 1) + '</td>' +
      '<td class="mono">' + root.Format.exact(run.shape.bytes) + '</td>' +
      '<td class="mono">' + root.Format.exact(run.wrong) + '</td></tr>';

    root.jQuery('#vq-quantile tbody').html(html);
    root.jQuery('#vq-quantile-note').text('Every one of the ' + root.Format.exact(run.probes) + ' queries is ' +
      'checked against a sorted copy of the range, and ' + root.Format.exact(run.wrong) + ' disagree. The ' +
      'descents column is bounded by ⌈log₂ ' + root.Format.exact(run.domain) + '⌉ + 1 = ' +
      root.Format.exact(run.shape.depthBound) + ' — the depth of the *value* domain, not of the array — which ' +
      'is why widening the domain moves it and lengthening the array does not.');
  }

  function drawChart(app, rows, run) {
    const stride = Math.max(1, Math.round(rows.length / 200));
    const sampled = rows.filter(function (row, index) { return index % stride === 0; });

    chart = root.ErrorBandView.curve(root.jQuery('#vq-chart')[0], {
      lazyLib: app.lazyLib,
      height: 260,
      logY: true,
      legendHost: root.jQuery('#vq-chart-legend')[0],
      xLabel: 'versions kept',
      yLabel: 'bytes (log scale)',
      series: [
        { label: 'persistent segment tree', width: 3,
          points: sampled.map(function (row) { return { x: row.version, y: row.bytes }; }) },
        { label: 'a snapshot of the array per version', dashed: true,
          points: sampled.map(function (row) { return { x: row.version, y: row.copied }; }) }
      ]
    });

    root.jQuery('#vq-chart-note').text('Both lines are linear in the number of versions; they differ by the ' +
      'slope, which is ' + root.Format.exact(run.shape.nodesPerUpdate) + ' nodes against ' +
      root.Format.exact(run.size) + ' elements. That is the entire economic argument for structural sharing, ' +
      'and it is why the gap widens with the array length rather than closing: raise the array length and the ' +
      'dashed line steepens while the solid one moves by one node per doubling.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

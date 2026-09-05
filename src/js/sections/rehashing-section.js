/**
 * Section: Resizing and rehashing.
 *
 * The amortised bound is true and useless for a latency budget. This section
 * plots the actual per-insertion work so the spike is a number rather than a
 * warning, then shows what moving k buckets per operation costs instead.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'rehashing';
  let panel = null;
  let traceChart = null;
  let percentileChart = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
    app.state.subscribe('theme', function () {
      if (traceChart) traceChart.redraw();
      if (percentileChart) percentileChart.redraw();
    });
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render({
      sectionId: SECTION_ID,
      orientation: [
        'A hash table grows by allocating a bigger array and re-inserting everything, because every ' +
          'key\'s slot depends on the capacity. That is O(n) in one call, amortised to O(1) across the ' +
          'n insertions that led to it — and the amortised figure is what hides the problem.',
        'A service does not experience the average. It experiences the one request that arrived ' +
          'while the map with a million entries doubled. That request shows up in your p99.9 as a ' +
          'multi-millisecond outlier, with no obvious cause in the code path.',
        'Incremental rehash keeps both tables alive and moves a fixed number of buckets per operation. ' +
          'Every key stays findable throughout — lookups check the old table first — and the peak ' +
          'collapses. The costs are real: more total work, doubled memory during migration, and ' +
          'iterators that have to span two tables.'
      ],
      demo: { title: 'Interactive demo — the spike, and what removes it',
        markup: root.RehashingTemplate.render() },
      diagram: {
        title: 'Diagram — two-table incremental migration',
        caption: 'Redis does exactly this: ht[0] and ht[1] with a rehash cursor.',
        definition: [
          'stateDiagram-v2',
          '    [*] --> Stable',
          '    Stable --> Migrating: load factor exceeded',
          '    Migrating --> Migrating: each op moves k buckets',
          '    note right of Migrating',
          '        reads check old then new',
          '        writes go to new',
          '        memory is doubled',
          '    end note',
          '    Migrating --> Stable: cursor passed the last<br/>bucket',
          '    Stable --> [*]'
        ].join('\n')
      },
      insight: 'A hash table with a 10 ms p99.9 is usually a hash table that rehashed. The fix is ' +
        'either to pre-size it — you often know the count — or to spread the migration; both beat ' +
        'discovering it in a flame graph.'
    }));

    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.RehashingTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  function update(app) {
    const values = panel.values();
    const keys = root.HashLab.keys({
      kind: 'random', count: values['rs-inserts'], rng: root.Random.seeded(37)
    });

    const results = root.HashRehash.compare({
      hash: root.HashFunctions.murmur3,
      keys: keys,
      movePerOp: values['rs-move'],
      capacity: 16
    });

    const sync = results[0];
    const incremental = results[1];

    root.MetricGrid.update({
      'rs-peak-sync': { value: root.Format.count(sync.peak),
        note: 'one insertion moved ' + root.Format.exact(sync.peak) + ' slots' },
      'rs-peak-inc': { value: root.Format.count(incremental.peak),
        note: root.Format.ratio(sync.peak, Math.max(1, incremental.peak)) + ' smaller' },
      'rs-p999': { value: sync.p999 + ' → ' + incremental.p999,
        note: 'median ' + sync.median + ' → ' + incremental.median + ', p99 ' + sync.p99 + ' → ' + incremental.p99 },
      'rs-total': { value: root.Format.count(incremental.total),
        note: root.Format.ratio(incremental.total, sync.total) + ' the synchronous total (' +
          root.Format.count(sync.total) + ')' }
    });

    paintMigration(values, keys);
    drawTrace(app, results);
    drawPercentiles(app, results);
  }

  /** Snapshots the table mid-migration, and checks every key is still findable. */
  function paintMigration(values, keys) {
    const table = root.HashRehash.create({
      hash: root.HashFunctions.murmur3, mode: 'incremental',
      movePerOp: values['rs-move'], capacity: 16
    });

    let snapshot = null;
    keys.forEach(function (key, i) {
      table.set(key, i);
      if (!snapshot && table.migrating() && i > keys.length / 2) {
        snapshot = { at: i, capacity: table.capacity(), size: table.size() };
      }
    });

    const missing = keys.filter(function (key, i) { return table.get(key) !== i; }).length;
    root.jQuery('#rs-migration').html(
      snapshot
        ? '<div>mid-migration at insertion ' + root.Format.exact(snapshot.at) + '</div>' +
          '<div>slots live across both tables: ' + root.Format.exact(snapshot.capacity) + '</div>' +
          '<div>entries: ' + root.Format.exact(snapshot.size) + '</div>' +
          '<div>keys unfindable at any point: ' + missing + '</div>'
        : '<div>no migration was in flight for this stream</div>');
  }

  /** Downsampled by maximum, so a spike survives the reduction. */
  function drawTrace(app, results) {
    const buckets = 220;
    const series = results.map(function (result) {
      const width = Math.max(1, Math.ceil(result.trace.length / buckets));
      const points = [];
      for (let start = 0; start < result.trace.length; start += width) {
        const slice = result.trace.slice(start, start + width);
        points.push({ x: start + 1, y: Math.max(1, Math.max.apply(null, slice)) });
      }
      return { label: result.mode, points: points };
    });

    traceChart = root.GrowthPlot.render(root.jQuery('#rs-trace')[0], {
      lazyLib: app.lazyLib,
      height: 240,
      logY: true,
      yMin: 1,
      series: series,
      xLabel: 'insertion number',
      yLabel: 'slot writes (log)',
      legendHost: root.jQuery('#rs-trace-legend')[0],
      summary: function () {
        return 'Work done by each insertion, downsampled by maximum so rehash spikes survive.';
      }
    });
  }

  function drawPercentiles(app, results) {
    const marks = [0.5, 0.9, 0.99, 0.999, 0.9999];
    const series = results.map(function (result) {
      return {
        label: result.mode,
        points: marks.map(function (p) {
          return { x: 1 / (1 - p), y: Math.max(1, root.HashRehash.percentile(result.trace, p)) };
        }),
        dots: true
      };
    });

    percentileChart = root.GrowthPlot.render(root.jQuery('#rs-percentiles')[0], {
      lazyLib: app.lazyLib,
      height: 220,
      logX: true,
      logY: true,
      yMin: 1,
      series: series,
      xLabel: '1/(1−p): 2 = median, 1000 = p99.9',
      yLabel: 'slot writes (log)',
      summary: function () {
        return 'Latency percentiles for both rehash strategies; the curves separate in the tail.';
      }
    });
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

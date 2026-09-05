/**
 * Section: Separate chaining.
 *
 * The scheme whose average is easy and whose worst case is a security
 * property. Bucket occupancy is checked against the Poisson prediction, and
 * the treeify threshold is a slider so its effect on the tail is visible.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'separate-chaining';
  let panel = null;
  let chart = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
    app.state.subscribe('theme', function () { if (chart) chart.redraw(); });
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render({
      sectionId: SECTION_ID,
      orientation: [
        'Chaining is the scheme you can reason about on paper: a bucket array, a list per bucket, and ' +
          'an expected chain length of α = n/m. Lookup is 1 + α/2 comparisons on average, insertion is ' +
          'O(1), and the table keeps working at α far above 1.',
        'The average is not the interesting number. Bucket occupancy under a good hash is ' +
          'Poisson, so the longest chain is about ln m / ln ln m. At α = 1 with a thousand ' +
          'buckets that is around 6, not 1. Your tail latency lives in that bucket.',
        'And under adversarial keys the longest chain is n. That is why the JDK converts a bucket to ' +
          'a tree at 8 entries: it bounds the damage at O(log k) without changing the hash. Set the ' +
          'threshold to 0 below and pick the adversarial key stream to see what it is protecting you ' +
          'from.'
      ],
      demo: { title: 'Interactive demo — chains, the Poisson prediction, and treeification',
        markup: root.SeparateChainingTemplate.render() },
      diagram: {
        title: 'Diagram — a bucket array with one treeified bucket',
        caption: 'Most buckets hold nothing or one entry; the flooded one becomes a tree.',
        definition: [
          'flowchart LR',
          '    B0["bucket 0"] --> E0["(empty)"]',
          '    B1["bucket 1"] --> N1["key a"] --> N2["key b"]',
          '    B2["bucket 2 — 9 entries"] --> T["treeified: binary search"]',
          '    T --> TL["keys ≤ m"]',
          '    T --> TR["keys > m"]',
          '    B3["bucket 3"] --> E3["(empty)"]'
        ].join('\n')
      },
      insight: 'Treeification is a security mitigation with a performance story attached, not the ' +
        'other way round. It does nothing for a well-behaved table — the buckets never get long ' +
        'enough — and everything for a flooded one.'
    }));

    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.SeparateChainingTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  function buildKeys(kind, count, buckets) {
    if (kind !== 'adversarial') {
      return root.HashLab.keys({ kind: kind, count: count, rng: root.Random.seeded(41) });
    }
    return root.HashLab.collidingKeys({
      hash: root.HashFunctions.djb2, buckets: buckets, count: count, budget: 8000000
    }).keys;
  }

  function update(app) {
    const values = panel.values();
    const buckets = values['sc-buckets'];
    const alpha = values['sc-load'] / 100;
    const count = Math.max(1, Math.round(buckets * alpha));
    const keys = buildKeys(values['sc-keys'], count, buckets);

    const table = root.HashTableChained.create({
      hash: values['sc-keys'] === 'adversarial' ? root.HashFunctions.djb2 : root.HashFunctions.murmur3,
      capacity: buckets,
      maxLoad: 1e9,
      treeifyAt: values['sc-treeify']
    });
    keys.forEach(function (key, i) { table.set(key, i); });
    keys.forEach(function (key) { table.get(key); });

    report({ table: table, keys: keys, alpha: keys.length / buckets, buckets: buckets });
    draw(app, table, keys.length / buckets);
  }

  function report(state) {
    const stats = state.table.stats();
    const occupancy = state.table.occupancy();

    root.MetricGrid.update({
      'sc-expected': {
        value: state.alpha.toFixed(2),
        note: root.Format.exact(state.keys.length) + ' keys in ' + root.Format.exact(state.buckets) + ' buckets'
      },
      'sc-longest': {
        value: root.Format.exact(stats.maxChain),
        note: stats.treeBuckets ? root.Format.exact(stats.treeBuckets) + ' buckets treeified'
          : 'no bucket reached the threshold'
      },
      'sc-probes': {
        value: (stats.lookupProbes / Math.max(1, stats.lookups)).toFixed(2),
        note: 'chaining predicts 1 + α/2 = ' + (1 + state.alpha / 2).toFixed(2) + ' for a successful lookup'
      },
      'sc-empty': {
        value: root.Format.exact(stats.emptyBuckets),
        note: 'Poisson predicts ' + Math.round(state.buckets * Math.exp(-state.alpha))
      }
    });

    paintBuckets(occupancy, state);
    paintMemory(state);
  }

  function paintBuckets(occupancy, state) {
    root.BucketView.buckets(root.jQuery('#sc-buckets-view')[0], {
      lengths: occupancy.map(function (bucket) { return bucket.length; }),
      trees: occupancy.map(function (bucket) { return bucket.tree; }),
      expected: state.alpha,
      height: 190,
      caption: root.Format.exact(state.buckets) + ' buckets at α = ' + state.alpha.toFixed(2)
    });
  }

  function paintMemory(state) {
    const entries = state.keys.length;
    const chainedBytes = state.buckets * 8 + entries * 32;      // bucket pointer + node with header
    const openBytes = Math.pow(2, Math.ceil(Math.log2(Math.max(16, entries / 0.7)))) * 16;

    root.jQuery('#sc-memory').html(
      '<div>entries: ' + root.Format.exact(entries) + '</div>' +
      '<div>chaining:       ' + root.Format.bytes(chainedBytes) +
        '  (bucket array + a 32-byte node each)</div>' +
      '<div>open addressing: ' + root.Format.bytes(openBytes) +
        '  (slot array at α ≤ 0.7, no nodes)</div>' +
      '<div>ratio: ' + root.Format.ratio(chainedBytes, openBytes) + '</div>');
  }

  /** Observed occupancy against the Poisson prediction for the same α. */
  function draw(app, table, alpha) {
    const occupancy = table.occupancy();
    const histogram = new Map();
    occupancy.forEach(function (bucket) {
      histogram.set(bucket.length, (histogram.get(bucket.length) || 0) + 1);
    });

    const maxLength = Math.min(20, Math.max.apply(null, Array.from(histogram.keys())));
    const observed = [];
    const predicted = [];
    let factorial = 1;

    for (let k = 0; k <= maxLength; k += 1) {
      if (k > 0) factorial *= k;
      observed.push({ x: k, y: (histogram.get(k) || 0) / occupancy.length });
      predicted.push({ x: k, y: (Math.exp(-alpha) * Math.pow(alpha, k)) / factorial });
    }

    chart = root.GrowthPlot.render(root.jQuery('#sc-chart')[0], {
      lazyLib: app.lazyLib,
      height: 220,
      series: [
        { label: 'observed', points: observed, dots: true },
        { label: 'Poisson(α)', points: predicted, dashed: true }
      ],
      xLabel: 'keys in a bucket',
      yLabel: 'fraction of buckets',
      legendHost: root.jQuery('#sc-legend')[0],
      summary: function () {
        return 'Fraction of buckets holding k keys, observed against the Poisson prediction for α = ' +
          alpha.toFixed(2) + '.';
      }
    });
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

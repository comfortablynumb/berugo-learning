/**
 * Section: Robin Hood, hopscotch and cuckoo hashing.
 *
 * Four schemes on one key stream at one load factor. The means are nearly
 * identical by construction; the distributions are not, and the table below
 * puts mean, variance, p99 and worst case next to each other so the claim
 * "Robin Hood is faster" can be replaced with a correct one.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'robin-hood';
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
        'Linear probing has one bad property: the entries that arrive late land far from home and stay ' +
          'there, so a few lookups are very slow while most are instant. Robin Hood fixes the ' +
          'distribution rather than the mean — on insertion, a key that has travelled further takes ' +
          'the slot from one that has travelled less.',
        'The invariant that gives is worth stating precisely: along any probe sequence, distance from ' +
          'home never decreases. That is what lets a lookup stop early when it meets an entry closer ' +
          'to home than it has travelled, and it is what the exercise below asserts.',
        'Hopscotch and cuckoo bound the worst case outright instead. Hopscotch guarantees every key ' +
          'is within H slots of home — one cache line if H is chosen well. Cuckoo guarantees exactly ' +
          'two probes, and pays with insertions that can cycle and force a rebuild.'
      ],
      demo: { title: 'Interactive demo — four schemes, one key stream',
        markup: root.RobinHoodTemplate.render() },
      diagram: {
        title: 'Diagram — a cuckoo eviction chain that closes',
        caption: 'Each key has exactly two homes; inserting into a full one displaces the resident.',
        definition: [
          'flowchart LR',
          '    NEW["insert x"] --> A["T1[3] holds a"]',
          '    A -->|"a is evicted"| B["T2[9] holds b"]',
          '    B -->|"b is evicted"| C["T1[7] holds c"]',
          '    C -->|"c is evicted"| D["T2[9] again"]',
          '    D -.->|"cycle: rebuild with new<br/>seeds"| NEW'
        ].join('\n')
      },
      insight: 'Robin Hood does not lower the mean probe count — the load factor fixes that, and no ' +
        'rearrangement can change it. It lowers the variance, and tail latency is made of variance.'
    }));

    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.RobinHoodTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  function schemes(values, count) {
    const hash = root.HashFunctions.murmur3;
    const capacity = values['rh-capacity'];
    const cuckooCapacity = Math.max(16, Math.ceil(count));

    return [
      { label: 'linear probing', build: function () {
        return root.HashTableOpen.create({ hash: hash, capacity: capacity, probe: 'linear', maxLoad: 0.999 });
      } },
      { label: 'robin hood', build: function () {
        return root.HashTableRobinHood.createRobinHood({ hash: hash, capacity: capacity, maxLoad: 0.999 });
      } },
      { label: 'hopscotch', build: function () {
        return root.HashTableRobinHood.createHopscotch({
          hash: hash, capacity: capacity, neighbourhood: values['rh-neighbourhood']
        });
      } },
      { label: 'cuckoo', build: function () {
        return root.HashTableRobinHood.createCuckoo({ hash: hash, capacity: cuckooCapacity });
      } }
    ];
  }

  /** Probe distance per key, measured the same way for every scheme. */
  function distancesFor(table, keys) {
    if (table.distances) return table.distances();
    if (table.probeWalk) return keys.map(function (key) { return table.probeWalk(key).length - 1; });
    throw new Error(table.name + ' reports neither distances() nor probeWalk()');
  }

  function update(app) {
    const values = panel.values();
    const count = Math.floor(values['rh-capacity'] * (values['rh-load'] / 100));
    const keys = root.HashLab.keys({ kind: 'random', count: count, rng: root.Random.seeded(83) });

    const results = schemes(values, count).map(function (scheme) {
      const table = scheme.build();
      keys.forEach(function (key, i) { table.set(key, i); });
      const distances = distancesFor(table, keys);
      return Object.assign({ label: scheme.label, table: table },
        root.HashTableRobinHood.summarise(distances), { distances: distances });
    });

    const robin = results[1];
    root.MetricGrid.update({
      'rh-mean': { value: robin.meanDistance.toFixed(2),
        note: 'linear probing: ' + results[0].meanDistance.toFixed(2) + ' — essentially the same' },
      'rh-variance': { value: robin.varianceDistance.toFixed(2),
        note: 'linear probing: ' + results[0].varianceDistance.toFixed(2) },
      'rh-p99': { value: root.Format.exact(robin.p99Distance),
        note: 'linear probing: ' + root.Format.exact(results[0].p99Distance) },
      'rh-max': { value: root.Format.exact(robin.maxDistance),
        note: 'linear probing: ' + root.Format.exact(results[0].maxDistance) }
    });

    paintTable(results);
    paintCuckoo(count);
    draw(app, results);
  }

  function paintTable(results) {
    const rows = results.map(function (result) {
      return '<tr><td>' + root.Helpers.escapeHtml(result.label) + '</td>' +
        '<td>' + result.meanDistance.toFixed(2) + '</td>' +
        '<td>' + result.varianceDistance.toFixed(2) + '</td>' +
        '<td>' + result.p99Distance + '</td>' +
        '<td>' + result.maxDistance + '</td></tr>';
    }).join('');

    root.jQuery('#rh-table').html(
      '<table class="ref-table"><thead><tr><th>scheme</th><th>mean</th><th>variance</th>' +
      '<th>p99</th><th>worst</th></tr></thead><tbody>' + rows + '</tbody></table>');
  }

  function paintCuckoo(count) {
    const table = root.HashTableRobinHood.createCuckoo({
      hash: root.HashFunctions.murmur3, capacity: Math.max(16, Math.floor(count / 4))
    });
    const keys = root.HashLab.keys({ kind: 'random', count: Math.floor(count / 8), rng: root.Random.seeded(11) });
    keys.forEach(function (key, i) { table.set(key, i); });

    const chain = table.evictionChain('probe-key');
    const stats = table.stats();
    root.jQuery('#rh-cuckoo').html(
      '<div>' + root.Format.exact(keys.length) + ' keys inserted; ' +
        root.Format.exact(stats.cycles) + ' insertions hit the kick limit and forced a rebuild</div>' +
      '<div>eviction chain for one more key: ' + chain.length + ' displacements</div>' +
      chain.slice(0, 12).map(function (step, i) {
        return '<div>  ' + (i + 1) + '. ' + step.table + '[' + step.index + '] evicts "' +
          root.Helpers.escapeHtml(String(step.evicted)) + '"</div>';
      }).join('') +
      (chain.length > 12 ? '<div>  …</div>' : ''));
  }

  function draw(app, results) {
    const series = results.map(function (result) {
      const histogram = new Map();
      result.distances.forEach(function (d) { histogram.set(d, (histogram.get(d) || 0) + 1); });

      const points = [];
      const limit = Math.min(40, result.maxDistance);
      for (let d = 0; d <= limit; d += 1) {
        points.push({ x: d, y: (histogram.get(d) || 0) / Math.max(1, result.distances.length) });
      }
      return { label: result.label, points: points, dots: true };
    });

    chart = root.GrowthPlot.render(root.jQuery('#rh-chart')[0], {
      lazyLib: app.lazyLib,
      height: 240,
      series: series,
      xLabel: 'distance from home slot',
      yLabel: 'fraction of keys',
      yMin: 0,
      legendHost: root.jQuery('#rh-legend')[0],
      summary: function () {
        return 'How far keys sit from their home slot under each scheme, at the same load factor.';
      }
    });
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

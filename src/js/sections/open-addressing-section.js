/**
 * Section: Open addressing.
 *
 * The churn slider is the point of this section: fill the table, then roll
 * one delete and one insert per operation, and watch a tombstoned table's
 * lookup cost climb while its size and load factor stay exactly where they
 * were.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'open-addressing';
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
        'Open addressing keeps every entry in the slot array itself. No nodes, no pointer chasing, ' +
          'and a linear probe walks memory the prefetcher already fetched — which is why it beats ' +
          'chaining on modern hardware despite worse asymptotics near a full table.',
        'The cost is that deletion has no obvious answer. You cannot just empty a slot: doing so ' +
          'breaks every probe sequence that passed through it. The usual fix is a tombstone — a ' +
          'marker meaning "keep going" — and tombstones never leave on their own.',
        'So a delete-heavy table degrades until something rehashes it, and nothing in its size or ' +
          'load factor says so. Backward-shift deletion fixes it properly for linear probing: walk ' +
          'forward and pull back anything whose home slot is at or before the hole.',
        'Turn the churn slider up with tombstones selected. The live count never changes and the load ' +
          'factor never moves, but once tombstones fill the last empty slot, a lookup for a key that ' +
          'is not there has nothing to stop it and scans the entire table.'
      ],
      demo: { title: 'Interactive demo — probing, clustering and the tombstone trap',
        markup: root.OpenAddressingTemplate.render() },
      diagram: {
        title: 'Diagram — the insert path',
        caption: 'A tombstone is a candidate slot, but the search must continue past it.',
        definition: [
          'flowchart TD',
          '    S["slot = h(key)"] --> C{"state?"}',
          '    C -- empty --> W["write here (or in the first tombstone seen)"]',
          '    C -- "full, same key" --> U["update in place"]',
          '    C -- "full, other key" --> N["slot = next in sequence"]',
          '    C -- tombstone --> R["remember it, keep probing"]',
          '    N --> C',
          '    R --> N',
          '    W --> L{"load + tombstones > max?"}',
          '    L -- yes --> G["grow and rehash: tombstones vanish"]',
          '    L -- no --> D["done"]'
        ].join('\n')
      },
      insight: 'Tombstones turn a delete-heavy table into a slow one that never recovers until it ' +
        'rehashes — and since a tombstone is not a live entry, the load factor you monitor keeps ' +
        'reporting that everything is fine.'
    }));

    app.shell.mount({ sectionId: SECTION_ID, app: app });
    root.jQuery('#oa-slot-legend').html(root.BucketView.stateLegend());

    panel = root.ControlPanel.mount({
      controls: root.OpenAddressingTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  /**
   * Fills the table, then runs a rolling churn: each operation deletes one
   * live key and inserts a brand-new one, so the live count never moves.
   * Growth is disabled, because a resize would sweep the tombstones away and
   * hide the whole effect.
   */
  function build(options) {
    const table = root.HashTableOpen.create({
      hash: root.HashFunctions.murmur3,
      capacity: options.capacity,
      probe: options.probe,
      deletion: options.deletion,
      maxLoad: 1e9
    });

    const live = [];
    options.keys.forEach(function (key, i) { table.set(key, i); live.push(key); });

    const rng = root.Random.seeded(97);
    for (let step = 0; step < options.churn; step += 1) {
      table.delete(live.splice(rng.int(live.length), 1)[0]);
      const fresh = 'churn-' + step;
      table.set(fresh, step);
      live.push(fresh);
    }
    return { table: table, live: live };
  }

  /** Probes per lookup for a batch of keys, isolated from earlier counters. */
  function probesFor(table, keys) {
    const before = table.stats();
    keys.forEach(function (key) { table.get(key); });
    const after = table.stats();
    return (after.lookupProbes - before.lookupProbes) / Math.max(1, after.lookups - before.lookups);
  }

  function update(app) {
    const values = panel.values();
    const capacity = values['oa-capacity'];
    const alpha = values['oa-load'] / 100;
    const count = Math.floor(capacity * alpha);
    const keys = root.HashLab.keys({ kind: 'random', count: count, rng: root.Random.seeded(61) });

    const built = build({
      capacity: capacity, probe: values['oa-probe'], deletion: values['oa-deletion'],
      keys: keys, churn: values['oa-churn']
    });

    const absent = [];
    for (let i = 0; i < 400; i += 1) absent.push('absent-' + i);

    report({
      table: built.table,
      hit: probesFor(built.table, built.live),
      miss: probesFor(built.table, absent),
      stats: built.table.stats(),
      alpha: count / capacity,
      values: values
    });
    paintWalk(built.table, built.live);
    draw(app, values);
  }

  function report(state) {
    root.MetricGrid.update({
      'oa-probes': {
        value: state.hit.toFixed(2),
        note: state.values['oa-churn']
          ? 'after ' + root.Format.exact(state.values['oa-churn']) + ' churn operations'
          : 'freshly filled table'
      },
      'oa-miss': {
        value: state.miss.toFixed(1),
        note: state.stats.occupied >= 0.999
          ? 'no empty slot left to stop the probe: every miss scans the table'
          : 'a miss stops at the first genuinely empty slot'
      },
      'oa-expected': {
        value: root.HashTableOpen.expectedProbes(state.alpha, true).toFixed(2),
        note: 'hit at α = ' + state.alpha.toFixed(2) + '; miss ' +
          root.HashTableOpen.expectedProbes(state.alpha, false).toFixed(2)
      },
      'oa-tombs': {
        value: root.Format.exact(state.stats.tombstones),
        note: 'live load ' + state.stats.load.toFixed(2) + ' — unchanged — but ' +
          (state.stats.occupied * 100).toFixed(0) + '% of slots are non-empty'
      }
    });

    root.BucketView.slots(root.jQuery('#oa-slots')[0], {
      states: state.table.slots(),
      height: 190,
      caption: root.Format.exact(state.table.capacity()) + ' slots · ' +
        root.Format.exact(state.stats.tombstones) + ' tombstones'
    });
  }

  function paintWalk(table, keys) {
    const key = keys[Math.floor(keys.length / 2)] || 'missing';
    const walk = table.probeWalk(key);
    const names = ['empty', 'full', 'tombstone'];

    root.jQuery('#oa-walk').html(
      '<div>lookup of "' + root.Helpers.escapeHtml(key) + '"</div>' +
      walk.map(function (step, i) {
        return '<div>probe ' + (i + 1) + ': slot ' + step.index + ' — ' + names[step.state] + '</div>';
      }).join('') +
      '<div>' + walk.length + ' probes to answer</div>');
  }

  /** Measured probes against the closed forms, across the load-factor range. */
  function draw(app, values) {
    const measured = [];
    const theoryHit = [];
    const theoryMiss = [];

    for (let percent = 10; percent <= 95; percent += 5) {
      const alpha = percent / 100;
      const count = Math.floor(1024 * alpha);
      const keys = root.HashLab.keys({ kind: 'random', count: count, rng: root.Random.seeded(7) });
      const built = build({
        capacity: 1024, probe: values['oa-probe'], deletion: values['oa-deletion'],
        keys: keys, churn: values['oa-churn']
      });
      measured.push({ x: alpha, y: probesFor(built.table, built.live) });
      theoryHit.push({ x: alpha, y: root.HashTableOpen.expectedProbes(alpha, true) });
      theoryMiss.push({ x: alpha, y: Math.min(40, root.HashTableOpen.expectedProbes(alpha, false)) });
    }

    chart = root.GrowthPlot.render(root.jQuery('#oa-chart')[0], {
      lazyLib: app.lazyLib,
      height: 240,
      series: [
        { label: 'measured (' + values['oa-probe'] + ')', points: measured, dots: true },
        { label: 'linear-probe theory, hit', points: theoryHit, dashed: true },
        { label: 'linear-probe theory, miss', points: theoryMiss, dashed: true }
      ],
      xLabel: 'load factor α',
      yLabel: 'probes per lookup',
      yMin: 0,
      legendHost: root.jQuery('#oa-legend')[0],
      summary: function () {
        return 'Measured probes per successful lookup against the closed-form predictions for linear probing.';
      }
    });
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

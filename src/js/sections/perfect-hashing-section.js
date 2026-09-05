/**
 * Section: Perfect and minimal perfect hashing.
 *
 * Both constructions are built live from the chosen key set, so the space and
 * build-cost numbers are measurements rather than quoted constants.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'perfect-hashing';
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
        'If the key set is known when you build the binary, collisions are not a runtime problem ' +
          'to manage. Think of language keywords, HTTP header names, opcode tables, a routing ' +
          'table, an on-disk index. They are a build-time problem to eliminate.',
        'FKS is the classic result. Two levels: a bucket of b keys gets a table of b² slots, and ' +
          'the birthday bound says a collision-free seed appears after a few tries. Worst-case ' +
          'O(1) lookup, expected O(n) space — the demo reports the ratio it actually achieved.',
        'CHD-style hash-and-displace goes further and produces a *minimal* perfect hash: n keys ' +
          'map onto exactly [0, n) with no holes. What gets stored is a displacement per bucket, ' +
          'a few bits each. The keys themselves need not be stored at all if every lookup is ' +
          'known to be for a member.'
      ],
      demo: { title: 'Interactive demo — build both, and count the space',
        markup: root.PerfectHashingTemplate.render() },
      diagram: {
        title: 'Diagram — the FKS two-level structure',
        caption: 'Level 1 spreads keys; level 2 squares each bucket to remove the last collisions.',
        definition: [
          'flowchart TD',
          '    K["key"] --> L1["h(key) mod n"]',
          '    L1 --> B0["bucket 0 — 0 keys, no table"]',
          '    L1 --> B1["bucket 1 — 1 key, stored inline"]',
          '    L1 --> B2["bucket 2 — 3 keys"]',
          '    B2 --> T2["9-slot table, seed found by retry"]',
          '    T2 --> S["exactly one probe, no comparison chain"]'
        ].join('\n')
      },
      insight: 'If the key set is fixed at build time, a hash table is the wrong structure — and ' +
        'almost nobody notices, because the table works. It just spends memory on empty slots and ' +
        'time on collision handling that cannot happen.'
    }));

    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.PerfectHashingTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  function buildBoth(kind, count, lambda) {
    const keys = root.HashLab.keys({ kind: kind, count: count, rng: root.Random.seeded(53) });
    const hash = root.PerfectHash.seededHash(root.HashFunctions.murmur3);
    return {
      keys: keys,
      fks: root.PerfectHash.buildFks({ keys: keys, hash: hash }),
      chd: root.PerfectHash.buildChd({ keys: keys, hash: hash, lambda: lambda })
    };
  }

  function update(app) {
    const values = panel.values();
    const built = buildBoth(values['ph-set'], values['ph-keys'], values['ph-lambda']);
    const distinct = new Set(built.keys.map(function (key) { return built.chd.lookup(key); }));

    root.MetricGrid.update({
      'ph-fks': { value: built.fks.spaceRatio.toFixed(2) + ' slots/key',
        note: root.Format.exact(built.fks.slotsUsed) + ' slots for ' + root.Format.exact(built.fks.n) + ' keys' },
      'ph-chd': { value: built.chd.bitsPerKey.toFixed(2) + ' bits/key',
        note: root.Format.exact(built.chd.buckets) + ' displacements, largest ' + built.chd.maxDisplacement },
      'ph-probes': { value: '1',
        note: built.chd.minimal && distinct.size === built.keys.length
          ? 'minimal and collision-free: ' + distinct.size + ' distinct indices'
          : 'construction did not reach minimality' },
      'ph-build': { value: root.Format.count(built.fks.seedAttempts + built.chd.displacementAttempts),
        note: root.Format.count(built.fks.seedAttempts) + ' FKS seeds + ' +
          root.Format.count(built.chd.displacementAttempts) + ' CHD displacements' }
    });

    paintSlots(built);
    paintTrace(built);
    draw(app, values);
  }

  function paintSlots(built) {
    const states = built.chd.placed.map(function (key) { return key === undefined ? 0 : 1; });
    root.BucketView.slots(root.jQuery('#ph-slots')[0], {
      states: states,
      height: 170,
      caption: 'CHD output: ' + states.filter(Boolean).length + ' of ' + states.length + ' slots filled'
    });
  }

  function paintTrace(built) {
    const sizes = built.fks.levels.map(function (level) { return level.slots.length; });
    const largest = sizes.reduce(function (m, s) { return Math.max(m, s); }, 0);
    const singletons = sizes.filter(function (s) { return s === 1; }).length;

    root.jQuery('#ph-trace').html(
      '<div>FKS level 1: ' + root.Format.exact(built.fks.n) + ' buckets, largest holds ' + largest + ' keys</div>' +
      '<div>     ' + singletons + ' buckets hold exactly one key and need no second table</div>' +
      '<div>     secondary slots: ' + root.Format.exact(built.fks.secondarySlots) +
        ' (theory: E[Σ b²] &lt; 2n = ' + root.Format.exact(2 * built.fks.n) + ')</div>' +
      '<div>CHD: ' + root.Format.exact(built.chd.buckets) + ' buckets, largest ' + built.chd.largestBucket +
        ' keys, ' + root.Format.count(built.chd.displacementAttempts) + ' trials</div>');
  }

  function draw(app, values) {
    const fks = [];
    const chd = [];
    const table = [];

    for (let n = 100; n <= Math.max(400, values['ph-keys']); n += Math.max(50, Math.floor(values['ph-keys'] / 8))) {
      const built = buildBoth(values['ph-set'], n, values['ph-lambda']);
      fks.push({ x: n, y: built.fks.slotsUsed * 4 });                      // 4-byte slots
      chd.push({ x: n, y: (built.chd.bitsPerKey * n) / 8 });               // displacement array only
      table.push({ x: n, y: Math.pow(2, Math.ceil(Math.log2(n / 0.7))) * 8 });
    }

    chart = root.GrowthPlot.render(root.jQuery('#ph-chart')[0], {
      lazyLib: app.lazyLib,
      height: 220,
      series: [
        { label: 'FKS slot arrays', points: fks, dots: true },
        { label: 'CHD displacements', points: chd, dots: true },
        { label: 'hash table slots at α ≤ 0.7', points: table, dashed: true }
      ],
      xLabel: 'keys',
      yLabel: 'bytes of structure',
      yMin: 0,
      legendHost: root.jQuery('#ph-legend')[0],
      summary: function () {
        return 'Bytes of index structure for each approach, excluding the keys and values themselves.';
      }
    });
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

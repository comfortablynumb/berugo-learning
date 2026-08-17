/**
 * Section: SIMD-style metadata probing.
 *
 * The measurable claim is groups per lookup: one group is 16 control bytes,
 * and a 64-byte line holds four of them, so a table that answers in one group
 * answers within one fetch however full it is.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'swiss-tables';
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
        'A Swiss table splits the hash in two. The high bits (H1) pick a group of 16 slots; the low ' +
          '7 bits (H2) are stored in a one-byte control value next to the group. A lookup compares ' +
          'its tag against all 16 control bytes at once and only touches the slots whose tag matched.',
        'Two consequences follow. A group is 16 control bytes and a cache line is 64, so one fetch ' +
          'brings in the metadata for sixty-four slots. And a tag mismatch rejects a slot without ' +
          'reading the key at all, so the expensive comparison happens about once per lookup even ' +
          'at a load factor where linear probing is walking long runs.',
        'The 7-bit tag collides once in 128, so a false match costs one real key comparison. That is ' +
          'the entire error budget, and it is why the design tolerates a 7/8 load factor.'
      ],
      demo: { title: 'Interactive demo — group probing, measured',
        markup: root.SwissTablesTemplate.render() },
      diagram: {
        title: 'Diagram — splitting the hash',
        caption: 'H1 selects the group; H2 lives in the control byte beside it.',
        definition: [
          'flowchart LR',
          '    H["64-bit hash"] --> H1["H1 = h >> 7 — which group"]',
          '    H --> H2["H2 = h & 0x7F — the 7-bit tag"]',
          '    H1 --> G["group = H1 mod groups"]',
          '    G --> C["16 control bytes (a quarter of a cache line)"]',
          '    H2 --> M["compare tag against all 16"]',
          '    C --> M',
          '    M --> R["bitmask of candidate lanes"]',
          '    R --> K["read only those keys"]'
        ].join('\n')
      },
      insight: 'The JavaScript version cannot be as fast as the SSE one — there is no vector compare ' +
        'here. The structure is the point: one cache line of metadata answers "is it here" for ' +
        'sixty-four slots, and that is a property of the layout, not of the instruction set.'
    }));

    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.SwissTablesTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  function build(options) {
    const table = root.SwissTable.create({
      hash: root.HashFunctions.murmur3, capacity: options.capacity, maxLoad: 0.999
    });
    options.keys.forEach(function (key, i) { table.set(key, i); });

    const doomed = Math.floor(options.keys.length * options.deleteFraction);
    for (let i = 0; i < doomed; i += 1) table.delete(options.keys[i]);
    return { table: table, live: options.keys.slice(doomed) };
  }

  function plain(options) {
    const table = root.HashTableOpen.create({
      hash: root.HashFunctions.murmur3, capacity: options.capacity, probe: 'linear', maxLoad: 0.999
    });
    options.keys.forEach(function (key, i) { table.set(key, i); });

    const before = table.stats().lookupProbes;
    const beforeCount = table.stats().lookups;
    options.keys.forEach(function (key) { table.get(key); });
    const stats = table.stats();
    return (stats.lookupProbes - before) / Math.max(1, stats.lookups - beforeCount);
  }

  function update(app) {
    const values = panel.values();
    const capacity = values['st-capacity'];
    const count = Math.floor(capacity * (values['st-load'] / 100));
    const keys = root.HashLab.keys({ kind: 'random', count: count, rng: root.Random.seeded(29) });

    const built = build({ capacity: capacity, keys: keys, deleteFraction: values['st-deletes'] / 100 });
    const before = built.table.stats();
    built.live.forEach(function (key) { built.table.get(key); });
    const after = built.table.stats();

    const lookups = Math.max(1, after.lookups - before.lookups);
    const groups = (after.lookupGroups - before.lookupGroups) / lookups;
    const comparisons = (after.lookupProbes - before.lookupProbes) / lookups;

    root.MetricGrid.update({
      'st-groups': { value: groups.toFixed(3),
        note: '16 control bytes each; ' + root.Format.exact(built.table.groups()) + ' groups in the table' },
      'st-keycmp': { value: comparisons.toFixed(3),
        note: 'one per lookup is the floor — the key itself has to be checked' },
      'st-plain': { value: plain({ capacity: capacity, keys: keys }).toFixed(2),
        note: 'linear probing, same keys, same slot count' },
      'st-false': { value: Math.max(0, comparisons - 1).toFixed(3),
        note: 'extra comparisons from 7-bit tag collisions; 1/128 = 0.008 expected' }
    });

    paintGroup(built.table);
    paintSplit();
    draw(app, values);
  }

  function paintGroup(table) {
    const control = table.control().slice(0, root.SwissTable.GROUP);
    const tag = control.find(function (byte) {
      return byte !== root.SwissTable.EMPTY && byte !== root.SwissTable.DELETED;
    });
    const mask = root.SwissTable.matchTag(control, 0, tag === undefined ? 1 : tag);

    root.jQuery('#st-group').html(
      '<div>control: ' + control.map(describeByte).join(' ') + '</div>' +
      '<div>tag:     ' + (tag === undefined ? '—' : '0x' + tag.toString(16).padStart(2, '0')) + '</div>' +
      '<div>mask:    0b' + (mask >>> 0).toString(2).padStart(16, '0') + '</div>' +
      '<div>lanes:   ' + (mask ? lanesOf(mask).join(', ') : 'none') + '</div>');
  }

  function describeByte(byte) {
    if (byte === root.SwissTable.EMPTY) return '..';
    if (byte === root.SwissTable.DELETED) return 'XX';
    return byte.toString(16).padStart(2, '0');
  }

  function lanesOf(mask) {
    const lanes = [];
    for (let i = 0; i < root.SwissTable.GROUP; i += 1) {
      if ((mask >>> i) & 1) lanes.push(i);
    }
    return lanes;
  }

  function paintSplit() {
    const samples = ['user:1042', 'session-token', 'order/99'];
    root.jQuery('#st-split').html(samples.map(function (key) {
      const h = root.HashFunctions.murmur3(key, 0);
      const split = root.SwissTable.splitHash(h);
      return '<div>' + root.Helpers.escapeHtml(key) + ' → 0x' + h.toString(16).padStart(8, '0') +
        '  H1=' + split.h1 + '  H2=0x' + split.h2.toString(16).padStart(2, '0') + '</div>';
    }).join(''));
  }

  function draw(app, values) {
    const capacity = values['st-capacity'];
    const swiss = [];
    const linear = [];

    for (let percent = 20; percent <= 87; percent += 5) {
      const count = Math.floor(capacity * (percent / 100));
      const keys = root.HashLab.keys({ kind: 'random', count: count, rng: root.Random.seeded(13) });
      const built = build({ capacity: capacity, keys: keys, deleteFraction: 0 });

      const before = built.table.stats();
      keys.forEach(function (key) { built.table.get(key); });
      const after = built.table.stats();
      const lookups = Math.max(1, after.lookups - before.lookups);

      swiss.push({ x: percent / 100, y: (after.lookupGroups - before.lookupGroups) / lookups });
      linear.push({ x: percent / 100, y: plain({ capacity: capacity, keys: keys }) });
    }

    chart = root.GrowthPlot.render(root.jQuery('#st-chart')[0], {
      lazyLib: app.lazyLib,
      height: 240,
      series: [
        { label: 'swiss: groups per lookup', points: swiss, dots: true },
        { label: 'linear probing: slot probes', points: linear, dots: true }
      ],
      xLabel: 'load factor',
      yLabel: 'probes per lookup',
      yMin: 0,
      legendHost: root.jQuery('#st-legend')[0],
      summary: function () {
        return 'Group probes for a Swiss table against slot probes for linear probing, same keys and slots.';
      }
    });
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

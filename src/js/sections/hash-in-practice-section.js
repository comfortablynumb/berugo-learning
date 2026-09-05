/**
 * Section: Hash tables in the wild.
 *
 * The workload chooser runs every implementation from this milestone plus the
 * two the language gives you, and reports probes (exact) and time (median of
 * n runs). They rank differently, and saying why is the point of the section.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'hash-in-practice';
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render({
      sectionId: SECTION_ID,
      orientation: [
        'JavaScript gives you two maps and they are not interchangeable. A plain object coerces every ' +
          'key to a string, so 1 and "1" are the same key and an object key becomes "[object Object]". ' +
          'A `Map` compares keys by SameValueZero, which means NaN is a usable key and -0 and 0 are ' +
          'the same one.',
        'The performance difference has a cause worth knowing. V8 stores objects with a hidden ' +
          'class describing a fixed shape, and deleting a property forces the object into ' +
          'dictionary mode. That is a real hash table, with none of the inline-cache benefits, ' +
          'and it never goes back. Using an object as a map with deletes puts you there ' +
          'permanently and silently.',
        'The ranking below changes with the workload. Probe counts are exact and portable; timings ' +
          'belong to this machine and this engine on this day. When they disagree, the timing is ' +
          'usually telling you about memory behaviour the probe count cannot see (M02).'
      ],
      demo: { title: 'Interactive demo — pick a workload, rank the schemes',
        markup: root.HashInPracticeTemplate.render() },
      diagram: {
        title: 'Diagram — choosing a scheme',
        caption: 'The questions that actually decide it, in the order they decide it.',
        definition: [
          'flowchart TD',
          '    Q0{"key set fixed at build time?"} -- yes --> PH["minimal perfect hash (3.8)"]',
          '    Q0 -- no --> Q1{"keys from untrusted input?"}',
          '    Q1 -- yes --> KEYED["keyed hash, and treeify or Robin Hood (3.2, 3.3)"]',
          '    Q1 -- no --> Q2{"delete-heavy?"}',
          '    Q2 -- yes --> Q3{"need insertion order?"}',
          '    Q2 -- no --> SWISS["swiss / open addressing (3.4, 3.6)"]',
          '    Q3 -- yes --> OM["ordered map: entries array + index (3.9)"]',
          '    Q3 -- no --> BS["backward-shift or Robin Hood delete (3.4, 3.5)"]',
          '    SWISS --> Q4{"latency-sensitive?"}',
          '    Q4 -- yes --> INC["pre-size, or rehash incrementally (3.7)"]'
        ].join('\n')
      },
      insight: 'Using an object as a map moves it into dictionary mode after the first delete, and ' +
        'the shape transition is silent. Nothing in the profile says "this object changed ' +
        'representation". `Map` exists for a reason.'
    }));

    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.HashInPracticeTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  function candidates() {
    const hash = root.HashFunctions.murmur3;
    return [
      { label: 'chaining (treeify 8)', build: function () { return root.HashTableChained.create({ hash: hash, treeifyAt: 8 }); } },
      { label: 'linear + tombstones', build: function () { return root.HashTableOpen.create({ hash: hash, probe: 'linear' }); } },
      { label: 'linear + backward shift', build: function () { return root.HashTableOpen.create({ hash: hash, probe: 'linear', deletion: 'backward-shift' }); } },
      { label: 'double hashing', build: function () { return root.HashTableOpen.create({ hash: hash, probe: 'double' }); } },
      { label: 'robin hood', build: function () { return root.HashTableRobinHood.createRobinHood({ hash: hash }); } },
      { label: 'swiss table', build: function () { return root.SwissTable.create({ hash: hash }); } }
    ];
  }

  function driveNative(kind, keys, deleteRate, rng) {
    const map = kind === 'map' ? new Map() : Object.create(null);
    const live = [];
    keys.forEach(function (key, i) {
      if (kind === 'map') map.set(key, i); else map[key] = i;
      live.push(key);
      if (deleteRate > 0 && rng.next() < deleteRate && live.length) {
        const victim = live.splice(rng.int(live.length), 1)[0];
        if (kind === 'map') map.delete(victim); else delete map[victim];
      }
    });
    let found = 0;
    keys.forEach(function (key) {
      const value = kind === 'map' ? map.get(key) : map[key];
      if (value !== undefined) found += 1;
    });
    return found;
  }

  function update(app) {
    const values = panel.values();
    const keys = root.HashLab.keys({
      kind: values['hp-keys'], count: values['hp-size'], rng: root.Random.seeded(67)
    });
    const deleteRate = values['hp-delete'] / 100;
    const harness = root.BenchHarness.createHarness({ runs: values['hp-runs'], warmup: 2, sink: true });

    const rows = candidates().map(function (candidate) {
      const measured = root.HashLab.run({
        table: candidate.build(), keys: keys, deleteRate: deleteRate, rng: root.Random.seeded(71)
      });
      const timing = harness.run({
        label: candidate.label,
        task: function () {
          const table = candidate.build();
          keys.forEach(function (key, i) { table.set(key, i); });
          return table.size();
        }
      });
      return { label: candidate.label, probes: measured.probesPerLookup, correct: measured.correct,
        medianMs: timing.medianMs, runs: timing.runs };
    });

    const natives = ['map', 'object'].map(function (kind) {
      const timing = harness.run({
        label: kind,
        task: function () { return driveNative(kind, keys, deleteRate, root.Random.seeded(71)); }
      });
      return { label: kind === 'map' ? 'native Map' : 'plain object', probes: null,
        correct: true, medianMs: timing.medianMs, runs: timing.runs };
    });

    report(rows.concat(natives), values);
    paintOrdered(values);
    paintCoercion();
  }

  function report(rows, values) {
    const withProbes = rows.filter(function (row) { return row.probes !== null; });
    const fewest = withProbes.reduce(function (best, row) { return row.probes < best.probes ? row : best; });
    const fastest = rows.reduce(function (best, row) { return row.medianMs < best.medianMs ? row : best; });
    const byLabel = {};
    rows.forEach(function (row) { byLabel[row.label] = row; });

    root.MetricGrid.update({
      'hp-best': { value: fewest.label, note: fewest.probes.toFixed(2) + ' probes per lookup' },
      'hp-fastest': { value: fastest.label,
        note: root.Format.duration(fastest.medianMs) + ', median of ' + fastest.runs + ' runs' },
      'hp-map': { value: root.Format.duration(byLabel['native Map'].medianMs),
        note: 'building and reading ' + root.Format.exact(values['hp-size']) + ' entries' },
      'hp-object': { value: root.Format.duration(byLabel['plain object'].medianMs),
        note: values['hp-delete'] ? 'in dictionary mode after the first delete' : 'no deletes in this workload' }
    });

    root.jQuery('#hp-table').html(
      '<table class="ref-table"><thead><tr><th>implementation</th><th>probes/lookup</th>' +
      '<th>median time</th><th>correct</th></tr></thead><tbody>' +
      rows.map(function (row) {
        return '<tr><td>' + root.Helpers.escapeHtml(row.label) + '</td>' +
          '<td>' + (row.probes === null ? '—' : row.probes.toFixed(2)) + '</td>' +
          '<td>' + root.Format.duration(row.medianMs) + '</td>' +
          '<td>' + (row.correct ? 'yes' : 'NO') + '</td></tr>';
      }).join('') + '</tbody></table>');
  }

  function paintOrdered(values) {
    const rounds = Math.min(40000, values['hp-size'] * 2);
    const without = root.OrderedMap.churn({ compactAt: 0, rounds: rounds, liveKeys: 1000 });
    const with_ = root.OrderedMap.churn({ compactAt: 0.5, rounds: rounds, liveKeys: 1000 });

    root.jQuery('#hp-ordered').html(
      '<div>' + root.Format.exact(rounds) + ' delete-then-reinsert rounds over 1 000 live keys</div>' +
      '<div>no compaction:   ' + root.Format.exact(without.slots) + ' slots for ' +
        root.Format.exact(without.size) + ' entries (' + without.growth.toFixed(1) + '×)</div>' +
      '<div>compact at 50%:  ' + root.Format.exact(with_.slots) + ' slots for ' +
        root.Format.exact(with_.size) + ' entries (' + with_.growth.toFixed(1) + '×), ' +
        with_.stats.compactions + ' compactions</div>' +
      '<div>iteration order preserved in both: ' + (without.ordered && with_.ordered) + '</div>');
  }

  function paintCoercion() {
    const object = Object.create(null);
    object[1] = 'number one';
    object['1'] = 'string one';
    object[{ a: 1 }] = 'an object';
    object[{ b: 2 }] = 'another object';

    const map = new Map();
    map.set(1, 'number one');
    map.set('1', 'string one');
    map.set(NaN, 'not a number');
    map.set(-0, 'negative zero');

    root.jQuery('#hp-coercion').html(
      '<div>object with keys 1 and "1": ' + Object.keys(object).length + ' keys → ' +
        root.Helpers.escapeHtml(String(object[1])) + '</div>' +
      '<div>object with two distinct object keys: ' +
        root.Helpers.escapeHtml(String(object[{ c: 3 }])) + ' (both became "[object Object]")</div>' +
      '<div>Map with keys 1 and "1": ' + map.size + ' entries, get(1) = ' +
        root.Helpers.escapeHtml(String(map.get(1))) + '</div>' +
      '<div>Map.get(NaN) = ' + root.Helpers.escapeHtml(String(map.get(NaN))) +
        ' — NaN !== NaN, but SameValueZero says otherwise</div>' +
      '<div>Map.get(0) = ' + root.Helpers.escapeHtml(String(map.get(0))) +
        ' — -0 and 0 are one key</div>');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

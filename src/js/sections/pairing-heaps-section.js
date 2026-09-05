/**
 * Section: Pairing heaps and rank-pairing heaps.
 *
 * The demo's control is the one-pass merge: the same structure with the
 * pairing pass removed. That is the only honest way to show what the pairing
 * pass is worth, because comparing a pairing heap against a different family
 * confounds the merge with everything else.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'pairing-heaps';
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  /** The shell config: orientation, demo, diagram and the insight. */
  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        'A pairing heap is one multiway tree in heap order, and every operation is built from a ' +
          'single primitive: link two roots, the loser becoming the winner\'s newest child. Insert is ' +
          'a link, meld is a link, decrease-key is a cut and a link. There is no degree array, no ' +
          'mark bit and no consolidation.',
        'Only pop does anything more, and what it does is the design. The root\'s children are ' +
          'orphaned and have to be folded back into one tree. The fold is done in two passes: ' +
          'left to right pairing adjacent siblings, then right to left folding the results. ' +
          'Pairing first is not decoration — a single left-to-right fold builds a spine and ' +
          'degrades to O(n).',
        'The bounds are famously unsettled. O(log n) amortised is proved for everything; decrease-key ' +
          'is known to be between Ω(log log n) and O(log n) and behaves like O(1) in measurement. ' +
          'What is settled is that it beats a Fibonacci heap on real workloads, which is why boost ' +
          'and LEDA ship it.'
      ],
      demo: { title: 'Interactive demo — what the pairing pass is worth', markup: root.PairingHeapsTemplate.render() },
      diagram: {
        title: 'Diagram — the two-pass merge',
        caption: 'Pair adjacent siblings first, then fold the pairs back from the right.',
        definition: [
          'flowchart TB',
          '    C["orphaned children: c1 c2 c3 c4 c5 c6"] --> P1["pass one, left to right:<br/>link(c1,c2) link(c3,c4) link(c5,c6)"]',
          '    P1 --> P2["pass two, right to left:<br/>link(p1, link(p2, p3))"]',
          '    P2 --> R["one tree, and the new root"]',
          '    N["one-pass alternative:<br/>link(link(link(c1,c2),c3),c4)…<br/>builds a spine"] -.->|"O(n) behaviour"| C'
        ].join('\n')
      },
      insight: 'Pairing heaps are what most "we used a Fibonacci heap" codebases should have used, ' +
        'and boost and LEDA agree. The empirical study to cite is Larkin, Sen and Tarjan. On the ' +
        'workloads people actually run, the simple structures win, and the pairing heap is the ' +
        'simplest one that still supports a cheap decrease-key.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.PairingHeapsTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  function measure(values) {
    const operations = root.PqLab.operations({
      kind: values['ph-mix'],
      count: values['ph-count'],
      rng: root.Random.seeded(values['ph-seed'])
    });

    const indexed = values['ph-mix'] === 'decrease-key';
    const families = [
      { label: 'pairing (two-pass)', create: function () { return root.PairingHeap.create({}); },
        fields: 'key, child, next, prev', bound: 'O(log n), likely better' },
      { label: 'pairing (one-pass)', create: function () { return root.PairingHeap.create({ singlePass: true }); },
        fields: 'the same', bound: 'no useful bound' },
      { label: 'fibonacci', create: function () { return root.FibonacciHeap.create({}); },
        fields: 'parent, child, left, right, degree, mark', bound: 'O(1) amortised' },
      { label: 'binary heap', create: function () { return root.BinaryHeap.create({ arity: 2, indexed: indexed }); },
        fields: 'one array slot', bound: 'O(log n)' }
    ];

    return families.map(function (family) {
      const result = root.PqLab.replay({ heap: family.create(), operations: operations });
      return Object.assign({}, family, result);
    });
  }

  function update(app) {
    const values = panel.values();
    const rows = measure(values);
    const two = rows[0];
    const one = rows[1];

    const probe = root.PairingHeap.create({});
    const rng = root.Random.seeded(values['ph-seed']);
    for (let i = 0; i < 5000; i += 1) probe.push(rng.int(1e6), 'p' + i);
    probe.pop();

    root.MetricGrid.update({
      'ph-two': {
        value: root.Format.exact(two.stats.comparisons),
        note: root.Format.exact(two.stats.links) + ' links over the whole run'
      },
      'ph-one': {
        value: root.Format.exact(one.stats.comparisons),
        note: 'the same structure with the pairing pass removed'
      },
      'ph-saving': {
        value: root.Format.percent(1 - two.stats.comparisons / Math.max(1, one.stats.comparisons), 1),
        note: root.Format.exact(one.stats.comparisons - two.stats.comparisons) + ' comparisons on this mix'
      },
      'ph-children': {
        value: root.Format.exact(probe.rootChildren()),
        note: 'after one pop from a 5 000-element heap — this is the list the merge folds'
      }
    });

    paintPasses();
    paintTable(rows, values);
    void app;
  }

  function paintPasses() {
    const text = [
      'children of the popped root:   c1  c2  c3  c4  c5  c6  c7  c8',
      '',
      'pass one — left to right, pairing adjacent siblings:',
      '   link(c1,c2)   link(c3,c4)   link(c5,c6)   link(c7,c8)',
      '   =    p1            p2            p3            p4        (4 links)',
      '',
      'pass two — right to left, folding the pairs:',
      '   link(p3, p4)                  = q3',
      '   link(p2, q3)                  = q2',
      '   link(p1, q2)                  = the new root             (3 links)',
      '',
      'one-pass alternative — left to right, no pairing:',
      '   link(link(link(link(link(link(link(c1,c2),c3),c4),c5),c6),c7),c8)',
      '   the same 7 links, and a spine of depth 7 rather than a tree of depth 3'
    ].join('\n');

    root.jQuery('#ph-passes').text(text);
    root.jQuery('#ph-passes-note').text('Both versions do the same number of links on this one pop. ' +
      'The difference is the shape they leave behind, and the shape is what the next pop pays for.');
  }

  function paintTable(rows, values) {
    const markup = rows.map(function (row) {
      return '<tr><td class="mono">' + row.label + '</td>' +
        '<td class="mono">' + root.Format.exact(row.stats.comparisons) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.stats.links || 0) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.stats.cuts || 0) + '</td>' +
        '<td class="note">' + row.fields + '</td>' +
        '<td class="mono">' + row.bound + '</td></tr>';
    }).join('');

    root.jQuery('#ph-table tbody').html(markup);
    root.jQuery('#ph-note').text('Every row replays the identical ' + root.Format.exact(values['ph-count']) +
      '-operation list and answers identically. The pairing heap carries four fields per node against ' +
      'the Fibonacci heap\'s six, has no consolidation, and is about a hundred lines shorter — which ' +
      'is the argument, since the comparison counts are close.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

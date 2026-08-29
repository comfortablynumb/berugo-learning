/**
 * Section: Disjoint set union.
 *
 * The forest is drawn because the effect is visual: run a find on every
 * element with compression on and the picture flattens to two levels; run it
 * with compression off and nothing moves. The strategy table puts the cost of
 * that flattening next to it, because compression is not free — it trades
 * pointer writes for pointer hops.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'disjoint-sets';
  const DRAW_LIMIT = 60;
  const STRATEGIES = ['none', 'compression', 'splitting', 'halving'];
  let panel = null;
  let chart = null;
  let dsu = null;
  let lastSweep = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
    app.state.subscribe('theme', function () { if (chart) chart.redraw(); });
  }

  /** The shell config: orientation, demo, diagram and the insight. */
  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        'Disjoint set union answers one question — are these two elements in the same set — and ' +
          'supports one update: merge two sets. Each set is a tree of parent pointers, and the root ' +
          'is the set\'s name. Nothing is ordered, nothing is searched; the entire structure is one ' +
          'array of parents.',
        'Two independent ideas make it fast, and the bound needs both. Union by rank never hangs a ' +
          'taller tree under a shorter one, which alone gives O(log n). Path compression flattens ' +
          'every path a find walks, which alone also gives O(log n) amortised. Together they give ' +
          'O(α(n)) — the inverse Ackermann function, which is below 5 for any n that fits in this ' +
          'universe.',
        'The last part of the section is the trap. Path compression rewrites parents that no union ' +
          'ever touched, so there is no bounded record of what to undo. A structure that must roll ' +
          'back — offline dynamic connectivity, divide and conquer over time — has to give ' +
          'compression up and keep union by rank alone.'
      ],
      demo: { title: 'Interactive demo — watch the forest flatten', markup: root.DisjointSetsTemplate.render() },
      diagram: {
        title: 'Diagram — a compressing find',
        caption: 'One find rewrites every pointer on the path. That is why it cannot be undone cheaply.',
        definition: [
          'flowchart LR',
          '    subgraph before["before find(d)"]',
          '        A1(("a")) --> B1(("b")) --> C1(("c")) --> D1(("d"))',
          '    end',
          '    subgraph after["after find(d)"]',
          '        A2(("a"))',
          '        A2 --> B2(("b"))',
          '        A2 --> C2(("c"))',
          '        A2 --> D2(("d"))',
          '    end',
          '    before -->|"3 pointer writes, none<br/>recorded by any union"| after'
        ].join('\n')
      },
      insight: 'Path compression and rollback are incompatible — offline dynamic connectivity needs ' +
        'the union-by-rank-only variant, which is a trap people hit exactly once. The union recorded ' +
        'one parent change; the find changed four more, and no journal captured them.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.DisjointSetsTemplate.controls,
      onChange: function (id) { onControl(app, id); }
    });

    rebuild(app);
  }

  function onControl(app, id) {
    if (id === 'dsu-find-all') {
      dsu.resetStats();
      for (let i = 0; i < dsu.size(); i += 1) dsu.find(i);
      lastSweep = dsu.stats();
      paint(app);
      return;
    }
    rebuild(app);
  }

  function build(values, strategy) {
    const built = root.Dsu.create({
      size: values['dsu-size'],
      compress: strategy,
      byRank: values['dsu-byrank']
    });
    const rng = root.Random.seeded(values['dsu-seed']);
    for (let i = 0; i < values['dsu-unions']; i += 1) {
      built.union(rng.int(values['dsu-size']), rng.int(values['dsu-size']));
    }
    return built;
  }

  function rebuild(app) {
    const values = panel.values();
    dsu = build(values, values['dsu-compress']);
    lastSweep = null;
    paintStrategies(values);
    paintAckermann(values);
    paint(app);
  }

  function paint(app) {
    const stats = dsu.stats();

    root.MetricGrid.update({
      'dsu-components': {
        value: root.Format.exact(dsu.components()),
        note: 'from ' + root.Format.exact(dsu.size()) + ' singletons and ' +
          root.Format.exact(stats.merged) + ' real merges'
      },
      'dsu-depth': {
        value: root.Format.exact(dsu.maxDepth()),
        note: lastSweep
          ? 'after a find on every element'
          : 'press the button to run a find on every element'
      },
      'dsu-visits': {
        value: lastSweep ? root.Format.fixed(lastSweep.nodeVisits / Math.max(1, dsu.size()), 3) : '—',
        note: lastSweep ? 'pointer hops per find, averaged over the sweep' : 'no sweep run yet'
      },
      'dsu-writes': {
        value: root.Format.exact(stats.pointerWrites),
        note: 'unions wrote ' + root.Format.exact(stats.merged) + '; the rest is compression'
      }
    });

    draw(app);
  }

  function paintStrategies(values) {
    const rows = STRATEGIES.map(function (strategy) {
      const built = build(values, strategy);
      built.resetStats();
      for (let i = 0; i < built.size(); i += 1) built.find(i);
      const stats = built.stats();
      const current = strategy === values['dsu-compress'];
      const why = {
        none: 'walks to the root and rewrites nothing',
        compression: 'a second pass points every node on the path at the root',
        splitting: 'one pass, every node points at its grandparent',
        halving: 'one pass, every other node points at its grandparent'
      };

      return '<tr' + (current ? ' style="font-weight:600"' : '') + '>' +
        '<td class="mono">' + strategy + '</td>' +
        '<td class="mono">' + built.maxDepth() + '</td>' +
        '<td class="mono">' + root.Format.fixed(stats.nodeVisits / Math.max(1, built.size()), 3) + '</td>' +
        '<td class="mono">' + root.Format.exact(stats.pointerWrites) + '</td>' +
        '<td class="note">' + why[strategy] + '</td></tr>';
    }).join('');

    root.jQuery('#dsu-strategies tbody').html(rows);
    root.jQuery('#dsu-strategy-note').text('Every row answers identically; they differ only in how ' +
      'much they rewrite. Union by rank alone leaves real depth, and all three compressing variants ' +
      'flatten it to two or three levels — for a pointer write per node on the path.');
  }

  function paintAckermann(values) {
    const rows = [
      { upTo: 2, what: 'a pair' },
      { upTo: 4, what: 'a handful' },
      { upTo: 16, what: 'a small set' },
      { upTo: 65536, what: '2¹⁶ — a large in-memory graph' },
      { upTo: Math.pow(2, 65536), what: 'more atoms than the observable universe holds' }
    ].map(function (row) {
      const label = row.upTo > 1e12 ? '2^65536' : root.Format.exact(row.upTo);
      return '<tr><td class="mono">' + label + '</td>' +
        '<td class="mono">' + root.Dsu.inverseAckermann(row.upTo) + '</td>' +
        '<td class="note">' + row.what + '</td></tr>';
    }).join('');

    root.jQuery('#dsu-ackermann tbody').html(rows);
    void values;
  }

  function draw(app) {
    if (dsu.size() > DRAW_LIMIT) {
      root.jQuery('#dsu-forest').empty();
      root.jQuery('#dsu-forest-note').text(root.Format.exact(dsu.size()) + ' elements is past a ' +
        'readable drawing — set the element count to ' + DRAW_LIMIT + ' or fewer to see the forest. ' +
        'The tables below still measure the full structure.');
      chart = null;
      return;
    }

    root.jQuery('#dsu-forest-note').text('Each column is one element, drawn at its distance from its ' +
      'root. Run a find on every element and watch what compression does to the depths.');

    chart = root.ForestView.render(root.jQuery('#dsu-forest')[0], {
      lazyLib: app.lazyLib,
      height: 220,
      forest: dsu.forest(),
      summary: function () {
        return 'A disjoint-set forest of ' + dsu.size() + ' elements in ' + dsu.components() +
          ' components, deepest node ' + dsu.maxDepth() + ' hops from its root.';
      }
    });
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

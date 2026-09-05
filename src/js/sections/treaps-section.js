/**
 * Section: Treaps and randomised BSTs.
 *
 * The demo makes the central claim checkable rather than assertable: change
 * the insertion order and the shape does not move, because the shape is a
 * function of the priorities alone. Change the seed and it does. Split and
 * merge are the two buttons, because they are the two operations everything
 * else in the structure is built from.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'treaps';
  const DRAW_LIMIT = 63;
  const SEEDS = 40;
  let panel = null;
  let treeChart = null;
  let seedChart = null;
  let tree = null;
  let detached = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
    app.state.subscribe('theme', function () {
      if (treeChart) treeChart.redraw();
      if (seedChart) seedChart.redraw();
    });
  }

  /** The shell config: orientation, demo, diagram and the insight. */
  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        'A treap satisfies two orders at once: the search-tree order on the keys, and the heap order ' +
          'on a priority given to each node at random. Those two orders together pin the shape ' +
          'exactly — for a given set of (key, priority) pairs there is one and only one treap.',
        'That is the whole trick. Since the priorities are random, the shape is the shape a plain ' +
          'BST would have had if the keys had arrived in random order — expected height about ' +
          '3·log₂ n. The shape no longer depends on the order they actually arrived in. Sorted ' +
          'input, reverse input and shuffled input all produce the same tree.',
        'There is no balance bookkeeping at all: no heights, no colours, no sizes. Everything is ' +
          'built from two operations, split and merge. That is why a treap is the ordered ' +
          'structure to reach for when you need range extraction or concatenation and have an ' +
          'afternoon.'
      ],
      demo: { title: 'Interactive demo — two orders, one shape', markup: root.TreapsTemplate.render() },
      diagram: {
        title: 'Diagram — split(key)',
        caption: 'Split walks one root-to-leaf path, cutting each node into the half its key belongs to.',
        definition: [
          'flowchart TB',
          '    T["treap over all keys"] --> S{"split at k"}',
          '    S --> L["left treap<br/>every key &lt; k<br/>still a valid treap"]',
          '    S --> R["right treap<br/>every key ≥ k<br/>still a valid treap"]',
          '    L --> M{"merge(L, R)"}',
          '    R --> M',
          '    M --> T2["the original treap<br/>higher priority wins each root"]'
        ].join('\n')
      },
      insight: 'Split and merge give you order-statistics, range extraction and rope-like ' +
        'concatenation for about eighty lines of code. It is the highest power-to-weight ordered ' +
        'structure there is — and the one to write from memory under pressure, because there is no ' +
        'case analysis to get wrong.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.TreapsTemplate.controls,
      onChange: function (id) { onControl(app, id); }
    });

    rebuild(app);
  }

  function onControl(app, id) {
    if (id === 'treap-split-go') {
      const parts = tree.splitAt(panel.values()['treap-split']);
      detached = { left: root.Bst.size(parts.left), right: root.Bst.size(parts.right) };
      paint(app);
      return;
    }
    if (id === 'treap-merge-go') { detached = null; paint(app); return; }
    rebuild(app);
  }

  function keysFor(order, count, seed) {
    const sorted = Array.from({ length: count }, function (_, i) { return i + 1; });
    if (order === 'sorted') return sorted;
    if (order === 'reverse') return sorted.slice().reverse();
    return root.TreeLab.shuffle(sorted, root.Random.seeded(seed + 500));
  }

  function build(order, count, seed) {
    const built = root.Treap.create({ seed: seed });
    keysFor(order, count, seed).forEach(function (key) { built.insert(key, key); });
    return built;
  }

  function rebuild(app) {
    const values = panel.values();
    tree = build(values['treap-order'], values['treap-count'], values['treap-seed']);
    detached = null;
    paintShapes(values);
    paint(app);
    drawSeeds(app, values);
  }

  function paint(app) {
    const stats = tree.stats();
    const invariants = tree.checkInvariants();

    root.MetricGrid.update({
      'treap-height': {
        value: root.Format.exact(tree.height()),
        note: '3·log₂ n is ' + root.Format.fixed(tree.heightBound(), 1) + ' at this size'
      },
      'treap-order-check': {
        value: invariants.ok ? 'yes' : 'no',
        note: invariants.ok ? 'search order by key, heap order by priority' : invariants.errors[0]
      },
      'treap-splits': {
        value: root.Format.exact(stats.splits),
        note: detached
          ? 'the last split produced ' + detached.left + ' and ' + detached.right + ' keys'
          : 'nodes cut by every split so far'
      },
      'treap-writes': {
        value: root.Format.exact(stats.linkWrites),
        note: 'pointer writes, against ' + root.Format.exact(stats.comparisons) + ' comparisons'
      }
    });

    drawTree(app);
  }

  function drawTree(app) {
    const shown = tree.size() <= DRAW_LIMIT;
    root.jQuery('#treap-tree-note').text(shown
      ? 'The number above each node is its priority. Every parent outranks both of its children — that is the heap order.'
      : root.Format.exact(tree.size()) + ' keys is past a readable drawing; the top five levels are shown.');

    treeChart = root.TreeView.render(root.jQuery('#treap-tree')[0], {
      lazyLib: app.lazyLib,
      height: 250,
      snapshot: tree.snapshot({ maxDepth: shown ? 12 : 5 }),
      summary: function () {
        return 'A treap of ' + tree.size() + ' keys with height ' + tree.height() +
          ', shaped by its random priorities rather than by the insertion order.';
      }
    });
  }

  /** The point of the section: three insertion orders, one shape. */
  function paintShapes(values) {
    const rows = [
      { label: 'sorted insertion', order: 'sorted', seed: values['treap-seed'], why: 'the order that destroys a plain BST' },
      { label: 'shuffled insertion', order: 'random', seed: values['treap-seed'], why: 'identical tree — the order does not matter' },
      { label: 'reverse insertion', order: 'reverse', seed: values['treap-seed'], why: 'identical again' },
      { label: 'sorted, next seed', order: 'sorted', seed: values['treap-seed'] + 1, why: 'the seed is what moves the shape' }
    ].map(function (entry) {
      const built = build(entry.order, values['treap-count'], entry.seed);
      return '<tr><td class="mono">' + entry.label + '</td>' +
        '<td class="mono">' + root.Format.exact(built.height()) + '</td>' +
        '<td class="mono">' + root.Format.exact(built.root() ? built.root().key : 0) + '</td>' +
        '<td class="mono">' + root.Format.exact(built.stats().comparisons) + '</td>' +
        '<td class="note">' + entry.why + '</td></tr>';
    }).join('');

    root.jQuery('#treap-shapes tbody').html(rows);
    root.jQuery('#treap-shape-note').text('The first three rows share a seed and therefore a shape: ' +
      'same height, same root, whatever order the keys arrived in. The fourth changes the seed and ' +
      'the tree changes with it.');
  }

  /** Height over 40 seeds against the expected value and the ideal. */
  function drawSeeds(app, values) {
    const points = [];
    const expected = [];
    const ideal = [];

    for (let seed = 1; seed <= SEEDS; seed += 1) {
      const built = build('sorted', values['treap-count'], seed);
      points.push({ x: seed, y: built.height() });
      expected.push({ x: seed, y: 3 * Math.log2(Math.max(2, values['treap-count'])) });
      ideal.push({ x: seed, y: Math.ceil(Math.log2(values['treap-count'] + 1)) });
    }

    const mean = points.reduce(function (sum, p) { return sum + p.y; }, 0) / points.length;

    seedChart = root.GrowthPlot.render(root.jQuery('#treap-chart')[0], {
      lazyLib: app.lazyLib,
      height: 230,
      series: [
        { label: 'height at this seed', points: points, dots: true },
        { label: '3·log₂ n', points: expected, dashed: true },
        { label: 'perfectly balanced', points: ideal, dashed: true }
      ],
      xLabel: 'priority seed',
      yLabel: 'height',
      legendHost: root.jQuery('#treap-legend')[0],
      summary: function () {
        return 'Treap height over ' + SEEDS + ' priority seeds at ' + values['treap-count'] +
          ' keys: mean ' + mean.toFixed(1) + ', against 3·log₂ n = ' +
          (3 * Math.log2(Math.max(2, values['treap-count']))).toFixed(1) + '.';
      }
    });
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

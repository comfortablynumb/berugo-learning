/**
 * Section: AVL trees.
 *
 * Two things are measured here rather than asserted. The height stays inside
 * 1.44·log₂(n + 2) whatever the insertion order, including the sorted order
 * that turns a plain BST into a list; and the rotation counters separate
 * insertion from deletion, because "at most one rotation" is true of insertion
 * only, and that asymmetry is the whole read-heavy argument.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'avl-trees';
  const DRAW_LIMIT = 63;
  let panel = null;
  let treeChart = null;
  let heightChart = null;
  let tree = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
    app.state.subscribe('theme', function () {
      if (treeChart) treeChart.redraw();
      if (heightChart) heightChart.redraw();
    });
  }

  /** The shell config: orientation, demo, diagram and the insight. */
  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        'An AVL tree keeps one number per node: the difference in height between its two subtrees. ' +
          'That difference is never allowed past 1, which is the strictest rule any practical family ' +
          'imposes and gives the shallowest tree — height under 1.4404·log₂(n + 2).',
        'Insertion needs at most one rotation, single or double. The reason is precise rather than ' +
          'lucky: rebalancing after an insert restores the subtree to the height it had before, so ' +
          'no ancestor can still be out of balance. Deletion has no such property — it can shorten ' +
          'a subtree, so the fix has to be repeated at every level on the way up.',
        'That asymmetry is the whole argument. AVL is the family to pick when reads dominate, and ' +
          'the break-even is a measurable point in this demo rather than a slogan.'
      ],
      demo: { title: 'Interactive demo — the bound, and the rotation bill', markup: root.AvlTreesTemplate.render() },
      diagram: {
        title: 'Diagram — the four rebalance cases',
        caption: 'LL and RR need one rotation. LR and RL need the inner one first, which is what makes them double.',
        definition: [
          'flowchart TB',
          '    U["unbalanced node z<br/>balance factor +2 or −2"] --> L{"which side is heavy?"}',
          '    L -->|"left, and its left"| LL["LL — rotateRight(z)<br/>one rotation"]',
          '    L -->|"left, and its right"| LR["LR — rotateLeft(z.left)<br/>then rotateRight(z)"]',
          '    L -->|"right, and its right"| RR["RR — rotateLeft(z)<br/>one rotation"]',
          '    L -->|"right, and its left"| RL["RL — rotateRight(z.right)<br/>then rotateLeft(z)"]'
        ].join('\n')
      },
      insight: 'AVL is the shallowest of the practical trees, which is exactly why it does the most ' +
        'rotation work. Read-heavy is not a slogan, it is a measurable break-even: set the delete ' +
        'share above zero and watch the rotations per operation climb while the height barely moves.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.AvlTreesTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  function keysFor(order, count, seed) {
    const sorted = Array.from({ length: count }, function (_, i) { return i + 1; });
    if (order === 'sorted') return sorted;
    if (order === 'sawtooth') {
      const run = Math.max(2, Math.round(Math.sqrt(count)));
      return sorted.slice().sort(function (a, b) {
        return Math.floor((a - 1) / run) - Math.floor((b - 1) / run) || b - a;
      });
    }
    return root.TreeLab.shuffle(sorted, root.Random.seeded(seed));
  }

  /** Builds both trees on the same keys, then applies the delete share. */
  function build(values) {
    const keys = keysFor(values['avl-order'], values['avl-count'], values['avl-seed']);
    const avl = root.Avl.create({});
    const bst = root.Bst.create({});
    keys.forEach(function (key) { avl.insert(key, key); bst.insert(key, key); });

    const insertStats = avl.stats();
    const doomed = Math.floor(keys.length * (values['avl-deletes'] / 100));
    const order = root.TreeLab.shuffle(keys, root.Random.seeded(values['avl-seed'] + 991));

    avl.resetStats();
    let worstDelete = 0;
    for (let i = 0; i < doomed; i += 1) {
      const before = avl.stats().rotations;
      avl.remove(order[i]);
      worstDelete = Math.max(worstDelete, avl.stats().rotations - before);
    }

    return {
      avl: avl, bst: bst, keys: keys.length, deleted: doomed,
      insertStats: insertStats, deleteStats: avl.stats(), worstDelete: worstDelete
    };
  }

  function update(app) {
    const values = panel.values();
    const result = build(values);
    tree = result.avl;

    root.MetricGrid.update({
      'avl-height': {
        value: root.Format.exact(result.avl.height()),
        note: 'the bound is ' + root.Format.fixed(result.avl.heightBound(), 1) + ' at this size'
      },
      'avl-bst': {
        value: root.Format.exact(result.bst.height()),
        note: result.bst.height() === result.keys ? 'a spine: the same keys with no balance rule' : 'the same keys, unbalanced'
      },
      'avl-single': {
        value: root.Format.exact(result.insertStats.singleRotations + result.deleteStats.singleRotations),
        note: 'LL and RR — one rotation each'
      },
      'avl-double': {
        value: root.Format.exact(result.insertStats.doubleRotations + result.deleteStats.doubleRotations),
        note: 'LR and RL — two rotations each'
      }
    });

    paintRotations(result);
    drawTree(app, result);
    drawHeights(app, values);
  }

  function paintRotations(result) {
    const rows = [
      {
        label: 'insert', count: result.keys,
        rotations: result.insertStats.rotations, worst: result.keys ? 1 : 0,
        note: 'one rebalance at most'
      },
      {
        label: 'delete', count: result.deleted,
        rotations: result.deleteStats.rotations, worst: result.worstDelete,
        note: 'can rebalance at every level'
      }
    ].map(function (row) {
      return '<tr><td class="mono">' + row.label + '</td>' +
        '<td class="mono">' + root.Format.exact(row.count) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.rotations) + '</td>' +
        '<td class="mono">' + (row.count ? root.Format.fixed(row.rotations / row.count, 2) : '—') + '</td>' +
        '<td class="mono">' + root.Format.exact(row.worst) + '</td></tr>';
    }).join('');

    root.jQuery('#avl-rotations tbody').html(rows);
    root.jQuery('#avl-rotation-note').text(result.deleted
      ? 'Deletion rebalanced up to ' + result.worstDelete + ' times in a single call here, against the ' +
        'one rotation an insertion is bounded by.'
      : 'Raise the delete share to see the second row: an insertion is bounded at one rebalance, a ' +
        'deletion is not.');
  }

  function drawTree(app, result) {
    const shown = result.avl.size() <= DRAW_LIMIT;
    root.jQuery('#avl-tree-note').text(shown
      ? 'The number above each node is its balance factor: left height minus right height, never past ±1.'
      : root.Format.exact(result.avl.size()) + ' keys is past a readable drawing; the top five levels are shown.');

    treeChart = root.TreeView.render(root.jQuery('#avl-tree')[0], {
      lazyLib: app.lazyLib,
      height: 250,
      snapshot: result.avl.snapshot({ maxDepth: shown ? 12 : 5 }),
      summary: function () {
        return 'An AVL tree of ' + result.avl.size() + ' keys with height ' + result.avl.height() +
          ', inside its bound of ' + result.avl.heightBound().toFixed(1) + '.';
      }
    });
  }

  /** Height against the bound and against log₂ n, over a range of sizes. */
  function drawHeights(app, values) {
    const sizes = [];
    for (let n = 16; n <= Math.max(64, values['avl-count']); n = Math.round(n * 1.8)) sizes.push(n);

    const measured = [];
    const bound = [];
    const ideal = [];
    sizes.forEach(function (n) {
      const built = root.Avl.create({});
      keysFor(values['avl-order'], n, values['avl-seed']).forEach(function (key) { built.insert(key, key); });
      measured.push({ x: n, y: built.height() });
      bound.push({ x: n, y: built.heightBound() });
      ideal.push({ x: n, y: Math.ceil(Math.log2(n + 1)) });
    });

    heightChart = root.GrowthPlot.render(root.jQuery('#avl-chart')[0], {
      lazyLib: app.lazyLib,
      height: 230,
      series: [
        { label: 'measured height', points: measured, dots: true },
        { label: '1.4404·log₂(n + 2) − 0.328', points: bound, dashed: true },
        { label: 'perfectly balanced ⌈log₂(n + 1)⌉', points: ideal, dashed: true }
      ],
      xLabel: 'keys',
      yLabel: 'height',
      legendHost: root.jQuery('#avl-legend')[0],
      summary: function () {
        return 'AVL height measured against its analytical bound and against a perfectly balanced ' +
          'tree, from 16 keys up to ' + values['avl-count'] + '.';
      }
    });
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

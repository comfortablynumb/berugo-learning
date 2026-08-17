/**
 * Section: Binary search trees and rotations.
 *
 * The tree is built from a real insertion order rather than a picture, so the
 * headline of the section - that sorted input degenerates the structure into a
 * linked list - is measured rather than asserted. The rotation control is the
 * other half: press it and the shape changes while the in-order sequence,
 * printed underneath, does not.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'bst-rotations';
  const DRAW_LIMIT = 63;
  let panel = null;
  let chart = null;
  let tree = null;
  let lastRotation = null;

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
          'A binary search tree keeps one invariant: everything in a node\'s left subtree is smaller ' +
            'than it, everything in the right subtree is larger. That single rule makes search, ' +
            'insertion and deletion follow one root-to-leaf path, so all three cost the height of the ' +
            'tree — and nothing in the rule says anything about what the height will be.',
          'The height is decided by the insertion order, not by the keys. Random order measures ' +
            'about 2.2 × log₂ n at the sizes in this demo, rising towards its asymptotic 4.311 × ln n; ' +
            'sorted order gives exactly n, because every key is larger than the last and the tree ' +
            'becomes a right spine. That is not an adversarial curiosity: it is what a bulk load from ' +
            'an ordered export does to an unbalanced index.',
          'The rotation is the one primitive every balanced family is built from. It changes which ' +
            'node is on top of a pair while preserving the in-order sequence exactly, which is why it ' +
            'is safe to apply as often as a balance rule asks for.'
        ],
        demo: { title: 'Interactive demo — build it, then rotate it', markup: root.BstRotationsTemplate.render() },
        diagram: {
          title: 'Diagram — the right rotation',
          caption: 'The in-order sequence A x B y C is identical on both sides. Only the depths change.',
          definition: [
            'flowchart LR',
            '    subgraph before["before: y on top"]',
            '        Y1(("y")) --> X1(("x"))',
            '        Y1 --> C1["C"]',
            '        X1 --> A1["A"]',
            '        X1 --> B1["B"]',
            '    end',
            '    subgraph after["after: rotateRight(y)"]',
            '        X2(("x")) --> A2["A"]',
            '        X2 --> Y2(("y"))',
            '        Y2 --> B2["B"]',
            '        Y2 --> C2["C"]',
            '    end',
            '    before -->|"y.left = x.right; x.right = y"| after'
          ].join('\n')
        },
        insight: 'Sorted insertion is not a rare adversarial case; it is what happens when you bulk-load ' +
          'from a sorted export, and it turns your O(log n) index into a linked list. If you must load ' +
          'sorted data into an unbalanced tree, shuffle it first — or insert the median recursively, ' +
          'which builds the balanced tree directly.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));

    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.BstRotationsTemplate.controls,
      onChange: function (id) { onControl(app, id); }
    });

    rebuild(app);
  }

  function onControl(app, id) {
    if (id === 'bst-rotate-go') {
      lastRotation = tree.rotateAt(panel.values()['bst-rotate']);
      paint(app);
      return;
    }
    if (id === 'bst-delete-go') {
      tree.remove(panel.values()['bst-rotate']);
      lastRotation = null;
      paint(app);
      return;
    }
    rebuild(app);
  }

  /** The four insertion orders over the same key set. */
  function keysFor(order, count, seed) {
    const rng = root.Random.seeded(seed);
    const sorted = Array.from({ length: count }, function (_, i) { return i + 1; });
    if (order === 'sorted') return sorted;
    if (order === 'reverse') return sorted.slice().reverse();
    if (order === 'sawtooth') {
      const run = Math.max(2, Math.round(Math.sqrt(count)));
      return sorted.slice().sort(function (a, b) {
        const blockA = Math.floor((a - 1) / run);
        const blockB = Math.floor((b - 1) / run);
        return blockA - blockB || b - a;
      });
    }
    return root.TreeLab.shuffle(sorted, rng);
  }

  function build(order, count, seed) {
    const built = root.Bst.create({});
    keysFor(order, count, seed).forEach(function (key) { built.insert(key, key); });
    return built;
  }

  function rebuild(app) {
    const values = panel.values();
    tree = build(values['bst-order'], values['bst-count'], values['bst-seed']);
    lastRotation = null;
    paintTable(values);
    paint(app);
  }

  /** Mean and worst lookup depth, counted over the keys actually present. */
  function depths(built) {
    const stack = built.root() ? [{ node: built.root(), depth: 1 }] : [];
    let total = 0;
    let worst = 0;
    let nodes = 0;

    while (stack.length) {
      const frame = stack.pop();
      total += frame.depth;
      nodes += 1;
      if (frame.depth > worst) worst = frame.depth;
      if (frame.node.left) stack.push({ node: frame.node.left, depth: frame.depth + 1 });
      if (frame.node.right) stack.push({ node: frame.node.right, depth: frame.depth + 1 });
    }
    return { worst: worst, mean: nodes ? total / nodes : 0, nodes: nodes };
  }

  function paint(app) {
    const measured = depths(tree);
    const ideal = Math.ceil(Math.log2(tree.size() + 1));

    root.MetricGrid.update({
      'bst-height': {
        value: root.Format.exact(tree.height()),
        note: tree.height() === tree.size() ? 'a linked list: every node has one child' : 'nodes on the longest path'
      },
      'bst-ideal': { value: root.Format.exact(ideal), note: '⌈log₂(n + 1)⌉ for ' + root.Format.exact(tree.size()) + ' keys' },
      'bst-worst': { value: root.Format.exact(measured.worst), note: root.Format.ratio(measured.worst, ideal) + ' the ideal' },
      'bst-mean': { value: root.Format.fixed(measured.mean, 2), note: 'averaged over every key in the tree' }
    });

    const keys = tree.keys();
    const sorted = keys.slice().sort(function (a, b) { return a - b; });
    root.jQuery('#bst-inorder').text('In-order traversal is ' +
      (keys.join() === sorted.join() ? 'sorted, as the invariant requires' : 'NOT sorted — the invariant is broken') +
      (lastRotation ? ' — and it did not change when the last ' + lastRotation.direction + ' rotation ran.' : '.'));

    draw(app);
  }

  function draw(app) {
    const shown = tree.size() <= DRAW_LIMIT;
    root.jQuery('#bst-tree-note').text(shown
      ? 'Every node, drawn at its in-order position.'
      : root.Format.exact(tree.size()) + ' keys is past what a readable drawing holds; the top ' +
        'six levels are shown, and the rest is folded into the grey nodes.');

    chart = root.TreeView.render(root.jQuery('#bst-tree')[0], {
      lazyLib: app.lazyLib,
      height: 260,
      snapshot: tree.snapshot({ maxDepth: shown ? 12 : 5 }),
      highlight: lastRotation ? tree.pathTo(panel.values()['bst-rotate']).map(function (n) { return n.key; }) : [],
      summary: function () {
        return 'A binary search tree of ' + tree.size() + ' keys with height ' + tree.height() +
          ', drawn with each node at its in-order position.';
      }
    });
  }

  function paintTable(values) {
    const rows = [
      { order: 'random', why: 'expected height about 2·log₂ n' },
      { order: 'sorted', why: 'a right spine — the index is a linked list' },
      { order: 'reverse', why: 'a left spine, same cost' },
      { order: 'sawtooth', why: 'sorted runs: bad, but not the worst case' }
    ].map(function (entry) {
      const built = build(entry.order, values['bst-count'], values['bst-seed']);
      const measured = depths(built);
      return '<tr><td class="mono">' + entry.order + '</td>' +
        '<td class="mono">' + root.Format.exact(built.height()) + '</td>' +
        '<td class="mono">' + root.Format.fixed(measured.mean, 2) + '</td>' +
        '<td class="mono">' + root.Format.exact(built.stats().comparisons) + '</td>' +
        '<td class="note">' + entry.why + '</td></tr>';
    }).join('');

    root.jQuery('#bst-orders tbody').html(rows);
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

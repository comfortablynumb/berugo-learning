/**
 * Section: Red-black trees.
 *
 * The colour rules look arbitrary until the 2-3-4 mapping is on screen beside
 * them, so the demo puts both there: the coloured tree, and the same tree read
 * as 2-, 3- and 4-nodes. The comparison table answers the question the section
 * exists for — why libraries chose this family over the shallower AVL — by
 * running the identical operation stream through both.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'red-black-trees';
  const DRAW_LIMIT = 63;
  let panel = null;
  let chart = null;

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
        'Five rules: every node is red or black, the root is black, a null child counts as black, a ' +
          'red node has no red child, and every path from a node down to a leaf passes the same ' +
          'number of black nodes. The last one is the load-bearing rule — it makes the shortest and ' +
          'longest paths differ by at most a factor of two, so the height is under 2·log₂(n + 1).',
        'The rules stop looking arbitrary once you see what they encode. A black node together with ' +
          'its red children is one node of a 2-3-4 tree: black alone is a 2-node, black with one red ' +
          'child is a 3-node, black with two is a 4-node. Red-black is a 2-3-4 tree stored in a ' +
          'binary tree, and the colours are the glue.',
        'Libraries chose this family over AVL, which is shallower. The reason is on the write side ' +
          'and it is visible in the table below: red-black bounds the rotations per update at two ' +
          'for insertion and three for deletion, and does most of its work by recolouring, which ' +
          'costs no pointer writes at all.'
      ],
      demo: { title: 'Interactive demo — the colours, the 2-3-4 reading, and the bill', markup: root.RedBlackTreesTemplate.render() },
      diagram: {
        title: 'Diagram — a 2-3-4 node and its red-black form',
        caption: 'Red nodes are not extra nodes: they are the second and third key of a multi-key node.',
        definition: [
          'flowchart LR',
          '    subgraph four["one 4-node of a 2-3-4 tree"]',
          '        F["a · b · c<br/>four children"]',
          '    end',
          '    subgraph rb["the same node, red-black"]',
          '        B(("b — black")) --> A(("a — red"))',
          '        B --> C(("c — red"))',
          '    end',
          '    four -->|"the black node is the<br/>middle key"| rb'
        ].join('\n')
      },
      insight: 'Red-black wins in libraries because the deletion cost is bounded by O(1) rotations, ' +
        'and libraries delete. AVL gives a shallower tree and pays for it with rebalancing that can ' +
        'run the whole way up on every removal — which is the right trade only when reads dominate.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.RedBlackTreesTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  function operationsFor(values) {
    return root.TreeLab.operations({
      kind: values['rb-order'],
      count: values['rb-count'],
      span: Math.max(8, Math.round(values['rb-count'] * 0.6)),
      rng: root.Random.seeded(values['rb-seed'])
    });
  }

  function apply(tree, operations) {
    operations.forEach(function (step) {
      if (step.op === 'insert') tree.insert(step.key, step.key);
      else if (step.op === 'remove') tree.remove(step.key);
      else tree.has(step.key);
    });
    return tree;
  }

  function update(app) {
    const values = panel.values();
    const operations = operationsFor(values);
    const tree = apply(root.RedBlack.create({}), operations);
    const stats = tree.stats();

    root.MetricGrid.update({
      'rb-height': {
        value: root.Format.exact(tree.height()),
        note: 'the bound is ' + root.Format.fixed(tree.heightBound(), 1) + ' for ' + root.Format.exact(tree.size()) + ' keys'
      },
      'rb-black': {
        value: root.Format.exact(tree.blackHeight()),
        note: 'identical on every path — that is invariant five'
      },
      'rb-rotations': {
        value: root.Format.exact(stats.rotations),
        note: root.Format.fixed(stats.rotations / Math.max(1, operations.length), 2) + ' per operation'
      },
      'rb-recolours': {
        value: root.Format.exact(stats.recolours),
        note: root.Format.ratio(stats.recolours, Math.max(1, stats.rotations)) + ' as many as rotations'
      }
    });

    paint234(tree);
    paintCompare(operations);
    draw(app, tree);
  }

  function paint234(tree) {
    const nodes = tree.nodes234();
    const counts = { 2: 0, 3: 0, 4: 0 };
    nodes.forEach(function (node) { counts[node.degree] += 1; });

    const rows = [
      { degree: 2, label: '2-node', why: 'a black node with no red child' },
      { degree: 3, label: '3-node', why: 'a black node with one red child' },
      { degree: 4, label: '4-node', why: 'a black node with two red children' }
    ].map(function (row) {
      return '<tr><td class="mono">' + row.label + '</td>' +
        '<td class="mono">' + root.Format.exact(counts[row.degree]) + '</td>' +
        '<td class="mono">' + root.Format.percent(counts[row.degree] / Math.max(1, nodes.length), 1) + '</td>' +
        '<td class="note">' + row.why + '</td></tr>';
    }).join('');

    root.jQuery('#rb-234 tbody').html(rows);
    root.jQuery('#rb-234-note').text('The ' + root.Format.exact(tree.size()) + ' keys form ' +
      root.Format.exact(nodes.length) + ' nodes of the equivalent 2-3-4 tree, whose height is the ' +
      'black height: ' + tree.blackHeight() + '.');
  }

  /** The same operation stream through both families. */
  function paintCompare(operations) {
    const rows = [
      { name: 'red-black', tree: apply(root.RedBlack.create({}), operations) },
      { name: 'AVL', tree: apply(root.Avl.create({}), operations) }
    ].map(function (entry) {
      const stats = entry.tree.stats();
      return '<tr><td class="mono">' + entry.name + '</td>' +
        '<td class="mono">' + root.Format.exact(entry.tree.height()) + '</td>' +
        '<td class="mono">' + root.Format.exact(stats.comparisons) + '</td>' +
        '<td class="mono">' + root.Format.exact(stats.rotations) + '</td>' +
        '<td class="mono">' + root.Format.fixed(stats.rotations / Math.max(1, operations.length), 3) + '</td></tr>';
    }).join('');

    root.jQuery('#rb-compare tbody').html(rows);
    root.jQuery('#rb-compare-note').text('Identical operations, identical answers. AVL is the ' +
      'shallower tree and does the comparisons to prove it; red-black moves fewer pointers.');
  }

  function draw(app, tree) {
    const shown = tree.size() <= DRAW_LIMIT;
    root.jQuery('#rb-tree-note').text(shown
      ? 'Red nodes are drawn red. Count the black nodes on any root-to-leaf path: the total is the same every time.'
      : root.Format.exact(tree.size()) + ' keys is past a readable drawing; the top five levels are shown.');

    chart = root.TreeView.render(root.jQuery('#rb-tree')[0], {
      lazyLib: app.lazyLib,
      height: 250,
      snapshot: tree.snapshot({ maxDepth: shown ? 12 : 5 }),
      summary: function () {
        return 'A red-black tree of ' + tree.size() + ' keys, height ' + tree.height() +
          ', black height ' + tree.blackHeight() + '.';
      }
    });
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

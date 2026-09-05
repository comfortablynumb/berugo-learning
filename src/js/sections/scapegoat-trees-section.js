/**
 * Section: Weight-balanced and scapegoat trees.
 *
 * The demo is built around the α dial, because α is the whole design: it sets
 * the depth limit, and therefore how often a rebuild is triggered and how much
 * it costs. The amortised figure — nodes rebuilt per insertion — is reported
 * directly, since "rebuild it periodically" only works if that number stays
 * logarithmic, and it does.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'scapegoat-trees';
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
        'Every other family in this milestone stores something on the node: a height, a colour, a ' +
          'priority, a subtree size. A scapegoat tree stores nothing at all — a node is a key, a ' +
          'value and two children. Balance comes from two rules applied to the tree as a whole.',
        'The first rule watches depth. An insertion that lands deeper than log_{1/α}(n) walks ' +
          'back up until it finds the node whose subtree is more than α-heavy on one side — the ' +
          'scapegoat. That subtree is then rebuilt perfectly balanced, in linear time. The second ' +
          'rule watches deletions: once the live count falls below α times the high-water mark, ' +
          'the whole tree is rebuilt.',
        'A rebuild is O(size of the subtree), so the worst single operation is bad. The amortised ' +
          'cost is still O(log n), by the same credit argument the doubling array uses in M01.3 — ' +
          'and the metric below reports it directly rather than asserting it.'
      ],
      demo: { title: 'Interactive demo — the α dial', markup: root.ScapegoatTreesTemplate.render() },
      diagram: {
        title: 'Diagram — finding the scapegoat',
        caption: 'The search walks up from the new node, computing sizes, until one child is more than α of its parent.',
        definition: [
          'flowchart TB',
          '    I["insert lands at depth d"] --> C{"d > log_1/α(n)?"}',
          '    C -->|no| DONE["nothing to do"]',
          '    C -->|yes| W["walk up, computing subtree sizes"]',
          '    W --> S{"size(child) > α · size(node)?"}',
          '    S -->|no| W',
          '    S -->|yes| R["this node is the scapegoat<br/>rebuild its subtree perfectly balanced"]'
        ].join('\n')
      },
      insight: '"Rebuild it periodically" is a legitimate balancing strategy, and often the right ' +
        'one when nodes are large or stored on disk. A rebuild writes one contiguous run, while ' +
        'rotations scatter small writes across the structure. It is also the strategy that needs ' +
        'no per-node metadata, which matters when a node is a disk page and every byte of header ' +
        'costs.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.ScapegoatTreesTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  function keysFor(order, count, seed) {
    const sorted = Array.from({ length: count }, function (_, i) { return i + 1; });
    if (order === 'sorted') return sorted;
    return root.TreeLab.shuffle(sorted, root.Random.seeded(seed));
  }

  function build(values, alpha) {
    const tree = root.Scapegoat.create({ alpha: alpha });
    const keys = keysFor(values['sg-order'], values['sg-count'], values['sg-seed']);
    keys.forEach(function (key) { tree.insert(key, key); });

    const doomed = Math.floor(keys.length * (values['sg-deletes'] / 100));
    const order = root.TreeLab.shuffle(keys, root.Random.seeded(values['sg-seed'] + 77));
    for (let i = 0; i < doomed; i += 1) tree.remove(order[i]);

    return { tree: tree, operations: keys.length + doomed };
  }

  function update(app) {
    const values = panel.values();
    const result = build(values, values['sg-alpha']);
    const stats = result.tree.stats();

    root.MetricGrid.update({
      'sg-height': {
        value: root.Format.exact(result.tree.height()),
        note: 'the α limit is ' + result.tree.heightBound() + ' at this size'
      },
      'sg-rebuilds': {
        value: root.Format.exact(stats.rebuilds),
        note: stats.fullRebuilds + ' of them were whole-tree rebuilds after deletions'
      },
      'sg-moved': {
        value: root.Format.exact(stats.rebuiltNodes),
        note: 'every one is a pointer write, done in one linear pass'
      },
      'sg-amortised': {
        value: root.Format.fixed(stats.rebuiltNodes / Math.max(1, result.operations), 2),
        note: 'log₂ n is ' + root.Format.fixed(Math.log2(Math.max(2, result.tree.size())), 1) +
          ' — the amortised cost tracks it'
      }
    });

    paintAlphaTable(values);
    paintCompare(values);
    draw(app, result.tree);
  }

  /** The dial, swept: stricter α means a shallower tree and more rebuilding. */
  function paintAlphaTable(values) {
    const rows = [0.55, 0.6, 0.65, 0.7, 0.8, 0.9].map(function (alpha) {
      const result = build(values, alpha);
      const stats = result.tree.stats();
      const current = Math.abs(alpha - values['sg-alpha']) < 1e-9;
      return '<tr' + (current ? ' style="font-weight:600"' : '') + '>' +
        '<td class="mono">' + alpha.toFixed(2) + '</td>' +
        '<td class="mono">' + result.tree.heightBound() + '</td>' +
        '<td class="mono">' + root.Format.exact(result.tree.height()) + '</td>' +
        '<td class="mono">' + root.Format.exact(stats.rebuilds) + '</td>' +
        '<td class="mono">' + root.Format.fixed(stats.rebuiltNodes / Math.max(1, result.operations), 2) + '</td>' +
        '</tr>';
    }).join('');

    root.jQuery('#sg-alpha-table tbody').html(rows);
    root.jQuery('#sg-alpha-note').text('α is the whole design in one number: it sets the depth limit ' +
      'directly, and the rebuild bill follows from that. The current setting is in bold.');
  }

  function paintCompare(values) {
    const keys = keysFor(values['sg-order'], values['sg-count'], values['sg-seed']);
    const rows = [
      {
        name: 'scapegoat', tree: (function () {
          const built = root.Scapegoat.create({ alpha: values['sg-alpha'] });
          keys.forEach(function (key) { built.insert(key, key); });
          return built;
        }()),
        metadata: 'none', work: 'subtree rebuilds', worst: 'O(n) — one rebuild of the whole tree'
      },
      {
        name: 'AVL', tree: (function () {
          const built = root.Avl.create({});
          keys.forEach(function (key) { built.insert(key, key); });
          return built;
        }()),
        metadata: 'one height per node', work: 'rotations', worst: 'O(log n)'
      },
      {
        name: 'red-black', tree: (function () {
          const built = root.RedBlack.create({});
          keys.forEach(function (key) { built.insert(key, key); });
          return built;
        }()),
        metadata: 'one colour bit per node', work: 'rotations and recolourings', worst: 'O(log n)'
      }
    ].map(function (row) {
      const stats = row.tree.stats();
      const structural = row.name === 'scapegoat'
        ? root.Format.exact(stats.rebuiltNodes) + ' nodes rebuilt'
        : root.Format.exact(stats.rotations) + ' rotations';
      return '<tr><td class="mono">' + row.name + '</td>' +
        '<td class="mono">' + root.Format.exact(row.tree.height()) + '</td>' +
        '<td class="note">' + row.metadata + '</td>' +
        '<td class="mono">' + structural + '</td>' +
        '<td class="note">' + row.worst + '</td></tr>';
    }).join('');

    root.jQuery('#sg-compare tbody').html(rows);
  }

  function draw(app, tree) {
    const shown = tree.size() <= DRAW_LIMIT;
    root.jQuery('#sg-tree-note').text(shown
      ? 'Nothing is annotated on the nodes because nothing is stored on them: the balance rule is about the tree, not the node.'
      : root.Format.exact(tree.size()) + ' keys is past a readable drawing; the top five levels are shown.');

    chart = root.TreeView.render(root.jQuery('#sg-tree')[0], {
      lazyLib: app.lazyLib,
      height: 250,
      snapshot: tree.snapshot({ maxDepth: shown ? 12 : 5 }),
      summary: function () {
        return 'A scapegoat tree of ' + tree.size() + ' keys with height ' + tree.height() +
          ', inside its α depth limit of ' + tree.heightBound() + '.';
      }
    });
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

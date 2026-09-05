/**
 * Section: B-trees and B+ trees.
 *
 * The demo is built around the page size, because that is the argument: the
 * branching factor is not a tuning parameter, it is (page + key)/(key +
 * pointer), and changing the storage changes it. Page reads are the metric —
 * the one a database reports — and they are compared against both the
 * textbook log_B(n) and the honest log(B x fill)(n), because sequential
 * insertion leaves pages half full and that is worth a whole extra level.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'b-trees';
  const PAGES = [512, 4096, 16384, 65536];
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
        'A B-tree is not "a tree that is wide". It is a tree whose node is exactly one unit of ' +
          'I/O. The branching factor is therefore a consequence of the page size and the key ' +
          'size, rather than a choice. A 4 KB page holding 8-byte keys and 8-byte pointers fits ' +
          '256 children, and that is the order.',
        'The B+ variant puts every value in a leaf, keeps only separators in the internal nodes, ' +
          'and chains the leaves together. That is what makes it the database index. A point ' +
          'lookup costs log_B(n) page reads — three for a million keys on a 4 KB page. A range ' +
          'scan costs one descent plus a walk along the leaf chain, touching no internal page at ' +
          'all.',
        'The measured reads below are compared against two predictions. The textbook log_B(n) ' +
          'assumes full pages; real pages are not full, and after a sequential load they are about ' +
          'half full, which costs a whole extra level. The second prediction uses the measured fill ' +
          'and lands on the nose.'
      ],
      demo: { title: 'Interactive demo — the page decides the tree', markup: root.BTreesTemplate.render() },
      diagram: {
        title: 'Diagram — a B+ tree with its leaf chain',
        caption: 'Values live only in the leaves, and the leaves are a linked list. That is the range scan.',
        definition: [
          'flowchart TB',
          '    R["root: separators only<br/>50 · 100"] --> L1["leaf 1..49<br/>keys + values"]',
          '    R --> L2["leaf 50..99<br/>keys + values"]',
          '    R --> L3["leaf 100..149<br/>keys + values"]',
          '    L1 -->|"next"| L2',
          '    L2 -->|"next"| L3',
          '    L3 -->|"next"| L4["…"]'
        ].join('\n')
      },
      insight: 'B-trees are not "trees that are wide", they are trees whose node size equals the ' +
        'unit of I/O. Change the storage medium and the right order changes with it. And if you ' +
        'load an index sequentially, every page splits down the middle and the whole structure ' +
        'settles at half occupancy. That is a level you did not have to pay for. Bulk loading ' +
        'builds the leaves full instead.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.BTreesTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  function build(pageBytes, keyBytes, count, mode) {
    const tree = root.BTree.create({ pageBytes: pageBytes, keyBytes: keyBytes, pointerBytes: 8 });
    const keys = mode === 'random'
      ? root.TreeLab.shuffle(Array.from({ length: count }, function (_, i) { return i; }), root.Random.seeded(1))
      : Array.from({ length: count }, function (_, i) { return i; });
    keys.forEach(function (key) { tree.insert(key, key); });
    return tree;
  }

  function update(app) {
    const values = panel.values();
    const page = Number(values['bt-page']);
    const tree = build(page, values['bt-keybytes'], values['bt-count'], values['bt-order-mode']);

    tree.resetStats();
    tree.get(Math.floor(values['bt-count'] / 2));
    const reads = tree.stats().pageReads;
    const occupancy = tree.occupancy();

    root.MetricGrid.update({
      'bt-order': {
        value: root.Format.exact(tree.order()),
        note: '(' + root.Format.bytes(page) + ' + ' + values['bt-keybytes'] + ') ÷ (' +
          values['bt-keybytes'] + ' + 8) children per page'
      },
      'bt-reads': {
        value: root.Format.exact(reads),
        note: 'textbook log_B(n) says ' + tree.predictedReads() + '; at the measured fill, ' +
          tree.predictedReadsAtFill()
      },
      'bt-height': {
        value: root.Format.exact(tree.height()),
        note: root.Format.exact(occupancy.nodes) + ' pages, ' +
          root.Format.bytes(occupancy.nodes * page) + ' of index'
      },
      'bt-fill': {
        value: root.Format.percent(occupancy.fill, 1),
        note: values['bt-order-mode'] === 'sequential'
          ? 'a sequential load splits every page down the middle'
          : 'random insertion settles near ln 2 = 69.3%'
      }
    });

    paintPages(values);
    paintScan(tree, values);
    draw(app, values);
  }

  function paintPages(values) {
    const rows = PAGES.map(function (page) {
      const tree = build(page, values['bt-keybytes'], values['bt-count'], values['bt-order-mode']);
      tree.resetStats();
      tree.get(Math.floor(values['bt-count'] / 2));
      const occupancy = tree.occupancy();
      const current = page === Number(values['bt-page']);

      return '<tr' + (current ? ' style="font-weight:600"' : '') + '>' +
        '<td class="mono">' + root.Format.bytes(page) + '</td>' +
        '<td class="mono">' + root.Format.exact(tree.order()) + '</td>' +
        '<td class="mono">' + tree.height() + '</td>' +
        '<td class="mono">' + tree.stats().pageReads + '</td>' +
        '<td class="mono">' + root.Format.exact(occupancy.nodes) + '</td>' +
        '<td class="mono">' + root.Format.percent(occupancy.fill, 1) + '</td></tr>';
    }).join('');

    root.jQuery('#bt-pages tbody').html(rows);
    root.jQuery('#bt-pages-note').text('The order follows the page size, and the height follows the ' +
      'order. Doubling the page does not halve the reads — it divides them by the log of the ratio, ' +
      'which is why the last two rows so often agree.');
  }

  function paintScan(tree, values) {
    const lengths = [10, 100, 1000, values['bt-scan']].filter(function (n, i, all) {
      return all.indexOf(n) === i;
    }).sort(function (a, b) { return a - b; });

    const rows = lengths.map(function (length) {
      tree.resetStats();
      const from = Math.floor(values['bt-count'] * 0.4);
      const scanned = tree.range(from, from + length - 1);
      const reads = tree.stats().pageReads;
      return '<tr><td class="mono">' + root.Format.exact(scanned.length) + '</td>' +
        '<td class="mono">' + root.Format.exact(reads) + '</td>' +
        '<td class="mono">' + root.Format.fixed(reads / Math.max(1, scanned.length) * 1000, 1) + '</td>' +
        '<td class="note">' + (length <= 100 ? 'the descent dominates' : 'the leaf chain dominates') +
        '</td></tr>';
    }).join('');

    root.jQuery('#bt-scan-table tbody').html(rows);
    root.jQuery('#bt-scan-note').text('A scan pays the descent once. After that it is one page per ' +
      'leaf-full of keys, and no internal page is touched again — which is why an index scan is ' +
      'cheap and an index lookup per row is not.');
  }

  /** Reads against key count, for the four page sizes. */
  function draw(app, values) {
    const series = PAGES.map(function (page) {
      const points = [];
      for (let n = 1000; n <= values['bt-count']; n = Math.round(n * 4)) {
        const tree = build(page, values['bt-keybytes'], n, values['bt-order-mode']);
        tree.resetStats();
        tree.get(Math.floor(n / 2));
        points.push({ x: n, y: tree.stats().pageReads });
      }
      return { label: root.Format.bytes(page) + ' page', points: points, dots: true };
    });

    chart = root.GrowthPlot.render(root.jQuery('#bt-chart')[0], {
      lazyLib: app.lazyLib,
      height: 230,
      logX: true,
      series: series,
      xLabel: 'keys',
      yLabel: 'page reads per lookup',
      legendHost: root.jQuery('#bt-legend')[0],
      summary: function () {
        return 'Page reads per lookup against the number of keys, for four page sizes. The steps are ' +
          'where the tree gains a level.';
      }
    });
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

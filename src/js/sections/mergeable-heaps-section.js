/**
 * Section: Mergeable heaps — leftist, skew and binomial.
 *
 * The binomial forest is printed as a binary number because that is what it
 * is, and once a learner sees 13 = 1101 spelled out as B₃ + B₂ + B₀ the merge
 * stops being an algorithm to memorise and becomes addition. The leftist/skew
 * table is the other half: the same operation, with and without the field that
 * buys the worst-case bound.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'mergeable-heaps';
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
        'An array heap cannot merge. Two heaps of n and m elements have to be concatenated and ' +
          'rebuilt, which is O(n + m) — and if merging is something your program does, that is the ' +
          'operation the structure has to be chosen for.',
        'The mergeable families make meld the primitive and derive everything else from it: insert ' +
          'is melding a singleton, and pop is melding the root\'s children. A leftist heap keeps a ' +
          'null-path length per node so the right spine stays under log₂(n + 1), and meld walks only ' +
          'that spine. A skew heap throws the field away, swaps its children unconditionally, and ' +
          'gets the same bound amortised.',
        'A binomial heap takes a different route: a forest of trees of size 2^k, one per set bit of ' +
          'the element count. Merging two of them is adding two binary numbers, carries and all — ' +
          'which is also why insertion is O(1) amortised, by the same argument the binary counter ' +
          'uses in M01.3.'
      ],
      demo: { title: 'Interactive demo — meld as the primitive', markup: root.MergeableHeapsTemplate.render() },
      diagram: {
        title: 'Diagram — a binomial merge is binary addition',
        caption: 'Two trees of the same order link into one of the next order. That is the carry.',
        definition: [
          'flowchart LR',
          '    A["heap A = 3 = 011<br/>B₁ + B₀"] --> M{"merge"}',
          '    B["heap B = 1 = 001<br/>B₀"] --> M',
          '    M --> C["B₀ + B₀ carries into B₁"]',
          '    C --> D["B₁ + B₁ carries into B₂"]',
          '    D --> R["result = 4 = 100<br/>one B₂"]'
        ].join('\n')
      },
      insight: 'Once meld is the primitive, insert is "meld a singleton" and pop is "meld the ' +
        'children". Structures with one primitive are the ones you can still write correctly a year ' +
        'later — which is the real argument for a leftist heap over a binomial one, since the ' +
        'binomial forest needs carry bookkeeping that the leftist heap simply does not have.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.MergeableHeapsTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  function update(app) {
    const values = panel.values();
    const rng = root.Random.seeded(values['mh-seed']);

    const binomial = root.BinomialHeap.create({});
    for (let i = 0; i < values['mh-count']; i += 1) binomial.push(rng.int(1e6), 'b' + i);

    const leftist = root.LeftistHeap.create({});
    const skew = root.LeftistHeap.create({ skew: true });
    const spineRng = root.Random.seeded(values['mh-seed'] + 1);
    const spineRng2 = root.Random.seeded(values['mh-seed'] + 1);
    for (let i = 0; i < values['mh-count']; i += 1) leftist.push(spineRng.int(1e6), 'l' + i);
    for (let i = 0; i < values['mh-count']; i += 1) skew.push(spineRng2.int(1e6), 's' + i);

    const meldRows = meldRuns(values);

    root.MetricGrid.update({
      'mh-binary': {
        value: binomial.binary(),
        note: root.Format.exact(values['mh-count']) + ' elements, so one tree per set bit'
      },
      'mh-trees': {
        value: root.Format.exact(binomial.trees()),
        note: 'orders ' + binomial.orders().map(function (entry) { return 'B' + entry.order; }).join(' + ')
      },
      'mh-spine': {
        value: root.Format.exact(leftist.stats().rightSpine),
        note: 'the bound is ' + leftist.nplBound() + '; the skew heap measures ' + skew.stats().rightSpine
      },
      'mh-meld': {
        value: root.Format.exact(meldRows[0].stats.comparisons),
        note: 'for the leftist heap, folding ' + values['mh-pieces'] + ' heaps together'
      }
    });

    paintForest(binomial, values);
    paintMeld(meldRows, values);
    paintLeftist(leftist, skew, values);
    void app;
  }

  function paintForest(binomial, values) {
    const orders = binomial.orders();
    const binary = binomial.binary();
    const lines = binary.split('').map(function (bit, i) {
      const order = binary.length - 1 - i;
      const tree = orders.filter(function (entry) { return entry.order === order; })[0];
      return 'bit ' + String(order).padStart(2) + ' = ' + bit + '   ' +
        (tree ? 'B' + order + ' holding ' + String(tree.size).padStart(6) + ' nodes' : '(no tree)');
    });

    root.jQuery('#mh-forest').text(root.Format.exact(values['mh-count']) + ' = ' + binary +
      ' in binary\n\n' + lines.join('\n'));
    root.jQuery('#mh-forest-note').text('The forest is the binary representation of the size. Adding ' +
      'an element is adding one, and the carries are exactly the tree links.');
  }

  function meldRuns(values) {
    const families = [
      { name: 'leftist', builder: { create: function () { return root.LeftistHeap.create({}); } },
        cost: 'O(log n) worst case', what: 'walk both right spines' },
      { name: 'skew', builder: { create: function () { return root.LeftistHeap.create({ skew: true }); } },
        cost: 'O(log n) amortised', what: 'the same walk, swapping unconditionally' },
      { name: 'binomial', builder: { create: function () { return root.BinomialHeap.create({}); } },
        cost: 'O(log n) worst case', what: 'binary addition with carries' },
      { name: 'binary (array)', builder: { create: function () { return root.BinaryHeap.create({}); } },
        cost: 'O(n + m)', what: 'concatenate the arrays and rebuild' }
    ];

    return families.map(function (family) {
      const run = root.PqLab.meldRun(family.builder, {
        pieces: values['mh-pieces'],
        each: values['mh-each'],
        rng: root.Random.seeded(values['mh-seed'])
      });
      return Object.assign({}, family, run);
    });
  }

  function paintMeld(rows, values) {
    const total = values['mh-pieces'] * values['mh-each'];
    const markup = rows.map(function (row) {
      return '<tr><td class="mono">' + row.name + '</td>' +
        '<td class="mono">' + root.Format.exact(row.stats.comparisons) + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.stats.comparisons / total, 2) + '</td>' +
        '<td class="mono">' + row.cost + '</td>' +
        '<td class="note">' + row.what + '</td></tr>';
    }).join('');

    root.jQuery('#mh-meld-table tbody').html(markup);
    root.jQuery('#mh-meld-note').text('Every row folds ' + values['mh-pieces'] + ' heaps of ' +
      values['mh-each'] + ' elements into one and then drains it, so the totals include the drain. ' +
      'The array heap is the outlier: its meld is a rebuild, and the cost shows.');
  }

  function paintLeftist(leftist, skew, values) {
    const rows = [
      { name: 'leftist', heap: leftist, metadata: 'one null-path length per node' },
      { name: 'skew', heap: skew, metadata: 'none' }
    ].map(function (row) {
      const stats = row.heap.stats();
      return '<tr><td class="mono">' + row.name + '</td>' +
        '<td class="mono">' + stats.rightSpine + '</td>' +
        '<td class="mono">' + row.heap.nplBound() + '</td>' +
        '<td class="mono">' + row.heap.height() + '</td>' +
        '<td class="mono">' + root.Format.exact(stats.childSwaps) + '</td>' +
        '<td class="note">' + row.metadata + '</td></tr>';
    }).join('');

    root.jQuery('#mh-leftist tbody').html(rows);
    root.jQuery('#mh-leftist-note').text('The leftist heap swaps children only when the rule demands ' +
      'it; the skew heap swaps on every meld, which is why its swap count is an order of magnitude ' +
      'higher and its spine is not bounded. Both answer identically — the field buys a worst case, ' +
      'not an average.');
    void values;
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

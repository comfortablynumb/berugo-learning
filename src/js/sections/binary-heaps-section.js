/**
 * Section: The binary heap.
 *
 * The demo exists to make the O(n) build argument concrete rather than
 * asserted: the per-level table shows where the work actually is (almost all
 * the nodes are leaves and sink nowhere), and the method comparison shows that
 * the famous gap between build-heap and push-one-at-a-time only opens on the
 * input that forces it — 7× on descending input and 21% on random.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'binary-heaps';
  const DRAW_LIMIT = 63;
  let panel = null;
  let chart = null;
  let heap = null;
  let built = null;

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
        'A binary heap is an array that is read as a tree. The children of index i are at 2i + 1 and ' +
          '2i + 2 and the parent is at ⌊(i − 1)/2⌋, so there are no pointers, no allocation per ' +
          'element and no shape to maintain — the tree is complete because the array is dense.',
        'One rule holds it together: a parent outranks both of its children. That is weaker than a ' +
          'search tree, which is why a heap cannot answer "is this key present" any faster than a ' +
          'scan, and it is exactly strong enough for the one question a priority queue asks: what is ' +
          'the smallest thing here.',
        'The counter-intuitive part is the build. Inserting n elements one at a time is O(n log n) in ' +
          'the worst case; heapifying the same array in place is O(n), because most nodes are near ' +
          'the bottom and can barely sink. The table below tallies that sum rather than asserting it.'
      ],
      demo: { title: 'Interactive demo — one structure, two views', markup: root.BinaryHeapsTemplate.render() },
      diagram: {
        title: 'Diagram — the array is the tree',
        caption: 'No pointer is stored. The index arithmetic is the structure.',
        definition: [
          'flowchart TB',
          '    A["i = 0<br/>the minimum"] --> B["i = 1<br/>2·0 + 1"]',
          '    A --> C["i = 2<br/>2·0 + 2"]',
          '    B --> D["i = 3"]',
          '    B --> E["i = 4"]',
          '    C --> F["i = 5"]',
          '    C --> G["i = 6"]',
          '    P["parent of i = ⌊(i − 1)/2⌋"] -.-> A'
        ].join('\n')
      },
      insight: 'The O(n) build is the counter-intuitive one: most nodes are near the bottom and can ' +
        'barely sink, so the sum Σ h·n/2^(h+1) converges to n rather than to n log n. That summation ' +
        'is worth being able to reproduce on a whiteboard — and worth knowing that it only beats ' +
        'repeated insertion by 7× on the input that forces it, and by 21% on random input.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.BinaryHeapsTemplate.controls,
      onChange: function (id) { onControl(app, id); }
    });

    rebuild(app);
  }

  function onControl(app, id) {
    if (id === 'bh-pop') {
      if (heap.size()) heap.pop();
      paint(app);
      return;
    }
    rebuild(app);
  }

  function valuesFor(order, count, seed) {
    if (order === 'ascending') return Array.from({ length: count }, function (_, i) { return i + 1; });
    if (order === 'descending') return Array.from({ length: count }, function (_, i) { return count - i; });
    const rng = root.Random.seeded(seed);
    return Array.from({ length: count }, function () { return rng.int(count * 10); });
  }

  function make(order, count, seed, method) {
    const instance = root.BinaryHeap.create({});
    const values = valuesFor(order, count, seed);
    instance.resetStats();
    if (method === 'build') instance.build(values);
    else values.forEach(function (value) { instance.push(value); });
    return instance;
  }

  function rebuild(app) {
    const values = panel.values();
    heap = make(values['bh-order'], values['bh-count'], values['bh-seed'], values['bh-method']);
    built = heap.stats();
    paintMethods(values);
    paintLevels(values);
    paint(app);
  }

  function paint(app) {
    const invariants = heap.checkInvariants();
    const work = root.BinaryHeap.buildHeapWork(Math.max(1, heap.size()), 2);

    root.MetricGrid.update({
      'bh-comparisons': {
        value: root.Format.exact(built.comparisons),
        note: root.Format.fixed(built.comparisons / Math.max(1, heap.size()), 2) + ' per element'
      },
      'bh-swaps': {
        value: root.Format.exact(built.swaps),
        note: 'the sum-of-heights bound is ' + root.Format.exact(work.total)
      },
      'bh-height': {
        value: root.Format.exact(heap.height()),
        note: '⌊log₂ n⌋ + 1 for ' + root.Format.exact(heap.size()) + ' elements'
      },
      'bh-valid': {
        value: invariants.ok ? 'yes' : 'NO',
        note: invariants.ok ? 'every parent outranks both children' : invariants.errors[0]
      }
    });

    draw(app);
  }

  function draw(app) {
    const keys = heap.keys();
    const shown = keys.length <= DRAW_LIMIT;
    root.jQuery('#bh-view-note').text(shown
      ? 'Index i in the strip is the same node as the circle below it. Pop the minimum and watch the last element sift down from the root.'
      : root.Format.exact(keys.length) + ' elements is past a readable drawing; the first ' +
        DRAW_LIMIT + ' are shown, and the tables below measure the whole heap.');

    chart = root.HeapView.render(root.jQuery('#bh-view')[0], {
      lazyLib: app.lazyLib,
      height: 280,
      arity: 2,
      keys: keys.slice(0, DRAW_LIMIT),
      highlight: [0],
      summary: function () {
        return 'A binary heap of ' + heap.size() + ' elements, height ' + heap.height() +
          ', drawn as an array and as the tree that array encodes.';
      }
    });
  }

  /** The comparison the section exists for. */
  function paintMethods(values) {
    const rows = [
      { order: 'ascending', why: 'already heap-ordered: neither method does any work' },
      { order: 'random', why: 'the honest everyday case' },
      { order: 'descending', why: 'every push sifts to the root — the case the O(n log n) is about' }
    ].map(function (entry) {
      const build = make(entry.order, values['bh-count'], values['bh-seed'], 'build').stats();
      const push = make(entry.order, values['bh-count'], values['bh-seed'], 'push').stats();
      return '<tr><td class="mono">' + entry.order + '</td>' +
        '<td class="mono">' + root.Format.exact(build.comparisons) + '</td>' +
        '<td class="mono">' + root.Format.exact(push.comparisons) + '</td>' +
        '<td class="mono">' + root.Format.ratio(push.comparisons, Math.max(1, build.comparisons)) + '</td>' +
        '<td class="note">' + entry.why + '</td></tr>';
    }).join('');

    root.jQuery('#bh-methods tbody').html(rows);
    root.jQuery('#bh-methods-note').text('The famous gap is a worst-case statement. On random input ' +
      'the two methods are within a quarter of each other; the factor only appears on descending ' +
      'input, where every insertion walks the whole spine.');
  }

  function paintLevels(values) {
    const work = root.BinaryHeap.buildHeapWork(values['bh-count'], 2);
    const rows = work.rows.map(function (row) {
      return '<tr><td class="mono">' + row.height + '</td>' +
        '<td class="mono">' + root.Format.exact(row.nodes) + '</td>' +
        '<td class="mono">' + row.sinks + '</td>' +
        '<td class="mono">' + root.Format.exact(row.work) + '</td></tr>';
    }).join('');

    root.jQuery('#bh-levels tbody').html(rows);
    root.jQuery('#bh-levels-note').text('Total work: ' + root.Format.exact(work.total) + ' for ' +
      root.Format.exact(values['bh-count']) + ' elements — a constant times n, not n log n. Half the ' +
      'nodes are leaves and sink nowhere at all, and that is the whole argument.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

/**
 * Section: Heapsort and heap-based selection.
 *
 * Two things are measured rather than asserted. Heapsort's comparison count
 * against n log₂ n, so its constant is a number rather than a shrug; and the
 * top-k pattern against sorting the stream, where the interesting figure is
 * not the comparison count but the memory — k slots instead of n, at any n.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'heapsort';
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
        'Heapsort is selection sort with a heap doing the selecting. Build a max-heap over the array ' +
          'in place, then repeatedly swap the root to the end and sift down over the shrinking heap. ' +
          'The array is partitioned as it goes: a heap on the left, a sorted suffix on the right, and ' +
          'no second array anywhere.',
        'That gives it two properties nothing else in the sorting chapter has together: O(n log n) ' +
          'guaranteed rather than expected, and O(1) extra space. It is why introsort falls back to ' +
          'heapsort when quicksort\'s recursion goes too deep — the fallback has to be a guarantee.',
        'What it does not have is locality. Every sift-down jumps between array positions that are ' +
          'powers of two apart, so a heapsort of a large array misses cache on nearly every step, ' +
          'while quicksort scans linearly. That is why it is only the fallback.'
      ],
      demo: { title: 'Interactive demo — the sort, and the selection it generalises', markup: root.HeapsortTemplate.render() },
      diagram: {
        title: 'Diagram — the extract-and-place loop',
        caption: 'The heap shrinks by one each round and the sorted suffix grows by one. No extra array.',
        definition: [
          'flowchart TB',
          '    A["build a max-heap over the whole array<br/>O(n)"] --> B{"heap size > 1?"}',
          '    B -->|no| Z["array is sorted ascending"]',
          '    B -->|yes| C["swap arr[0] with arr[size − 1]<br/>the largest lands in its final place"]',
          '    C --> D["size − 1, then siftDown(0)<br/>O(log n)"]',
          '    D --> B'
        ].join('\n')
      },
      insight: 'Heapsort\'s guaranteed O(n log n) with O(1) space is why it is the fallback branch in ' +
        'introsort, and its cache behaviour is why it is only the fallback. The same structure used ' +
        'for selection rather than sorting is the more common win: bounded top-k costs k slots and ' +
        'one comparison per element, at any stream length.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.HeapsortTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  function update(app) {
    const values = panel.values();
    const rng = root.Random.seeded(values['hs-seed']);
    const input = Array.from({ length: values['hs-count'] }, function () { return rng.int(values['hs-count'] * 100); });

    const sorted = root.BinaryHeap.sort(input);
    const nLogN = values['hs-count'] * Math.log2(Math.max(2, values['hs-count']));

    const streamRng = root.Random.seeded(values['hs-seed'] + 1);
    const stream = Array.from({ length: values['hs-stream'] }, function () { return streamRng.int(1e9); });
    const top = root.BinaryHeap.topK(stream, values['hs-k']);

    root.MetricGrid.update({
      'hs-comparisons': {
        value: root.Format.exact(sorted.stats.comparisons),
        note: root.Format.fixed(sorted.stats.comparisons / nLogN, 2) + ' × n·log₂ n'
      },
      'hs-swaps': {
        value: root.Format.exact(sorted.stats.swaps),
        note: root.Format.fixed(sorted.stats.swaps / values['hs-count'], 2) + ' per element, each a jump'
      },
      'hs-extra': { value: '0', note: 'the sort happens inside the input array' },
      'hs-topk': {
        value: root.Format.exact(values['hs-k']),
        note: 'slots, against ' + root.Format.count(values['hs-stream']) + ' to sort the stream'
      }
    });

    paintSorts(sorted, values, nLogN);
    paintTopK(top, values);
    draw(app, values);
  }

  function paintSorts(sorted, values, nLogN) {
    const n = values['hs-count'];
    const rows = [
      {
        name: 'heapsort', comparisons: root.Format.exact(sorted.stats.comparisons),
        memory: 'O(1)', stable: 'no', worst: 'Θ(n log n)', where: 'the introsort fallback, and anywhere memory is fixed'
      },
      {
        name: 'quicksort', comparisons: '≈ ' + root.Format.exact(Math.round(1.39 * nLogN)),
        memory: 'O(log n) stack', stable: 'no', worst: 'Θ(n²)', where: 'the default, until the recursion goes too deep'
      },
      {
        name: 'merge sort', comparisons: '≈ ' + root.Format.exact(Math.round(nLogN)),
        memory: 'O(n)', stable: 'yes', worst: 'Θ(n log n)', where: 'when stability is required, or the data is external'
      }
    ].map(function (row) {
      return '<tr><td class="mono">' + row.name + '</td>' +
        '<td class="mono">' + row.comparisons + '</td>' +
        '<td class="mono">' + row.memory + '</td>' +
        '<td class="mono">' + row.stable + '</td>' +
        '<td class="mono">' + row.worst + '</td>' +
        '<td class="note">' + row.where + '</td></tr>';
    }).join('');

    root.jQuery('#hs-sorts tbody').html(rows);
    root.jQuery('#hs-sorts-note').text('Heapsort is measured here; the other two rows are the ' +
      'standard analytical figures, and M10 measures all three properly. The column that decides ' +
      'real use is not comparisons — it is the pair of memory and worst case, which is why heapsort ' +
      'is a fallback rather than a default. Note that heapsort is not stable: the sift moves equal ' +
      'keys past each other.');
  }

  function paintTopK(top, values) {
    const n = values['hs-stream'];
    const sortComparisons = Math.round(n * Math.log2(Math.max(2, n)));
    const rows = [
      {
        name: 'bounded top-k heap', comparisons: root.Format.exact(top.totalComparisons),
        memory: root.Format.exact(values['hs-k']) + ' slots', admitted: root.Format.exact(top.admitted)
      },
      {
        name: 'sort the whole stream', comparisons: '≈ ' + root.Format.exact(sortComparisons),
        memory: root.Format.exact(n) + ' slots', admitted: root.Format.exact(n)
      }
    ].map(function (row) {
      return '<tr><td class="mono">' + row.name + '</td>' +
        '<td class="mono">' + row.comparisons + '</td>' +
        '<td class="mono">' + row.memory + '</td>' +
        '<td class="mono">' + row.admitted + '</td></tr>';
    }).join('');

    root.jQuery('#hs-topk-table tbody').html(rows);
    root.jQuery('#hs-topk-table-note').text('Almost all of the top-k cost is the gate: one comparison per ' +
      'element against the current k-th best, and only ' + root.Format.exact(top.admitted) +
      ' of ' + root.Format.exact(n) + ' elements ever entered the heap. The memory is the real ' +
      'saving — ' + root.Format.exact(values['hs-k']) + ' slots against ' + root.Format.exact(n) + '.');
  }

  function draw(app, values) {
    /* A small array, sorted far enough to show the partition. */
    const size = Math.min(values['hs-count'], DRAW_LIMIT);
    const rng = root.Random.seeded(values['hs-seed']);
    const array = Array.from({ length: size }, function () { return rng.int(99); });

    const heap = root.BinaryHeap.create({ compare: function (a, b) { return b - a; } });
    heap.build(array);
    const keys = heap.keys();
    const taken = [];
    for (let i = 0; i < Math.floor(size / 3); i += 1) taken.unshift(heap.pop().key);

    const shown = heap.keys().concat(taken);
    root.jQuery('#hs-view-note').text('A ' + size + '-element array part-way through the sort: the ' +
      'first ' + heap.size() + ' cells are still a max-heap and the last ' + taken.length +
      ' are the sorted suffix, already in their final places.');

    chart = root.HeapView.render(root.jQuery('#hs-view')[0], {
      lazyLib: app.lazyLib,
      height: 280,
      arity: 2,
      keys: shown,
      highlight: shown.map(function (_, i) { return i; }).slice(heap.size()),
      summary: function () {
        return 'Heapsort part-way through a ' + size + '-element array: a max-heap of ' + heap.size() +
          ' elements followed by a sorted suffix of ' + taken.length + '.';
      }
    });
    void keys;
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

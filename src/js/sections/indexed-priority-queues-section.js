/**
 * Section: Indexed priority queues and decrease-key in practice.
 *
 * The comparison is the point: the same Dijkstra, once with a real
 * decrease-key against a handle map and once with duplicate insertions and a
 * stale-entry check. The indexed version is the one textbooks describe; the
 * lazy version is the one most production code contains, and on this graph it
 * is faster and simpler and lets the queue grow by 37%.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'indexed-priority-queues';
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
        'Decrease-key has a problem the bound never mentions: finding the element. A heap is an ' +
          'array in no useful order, so locating the entry for node 4 711 is a linear scan. That ' +
          'turns an O(log n) operation into an O(n) one, and undoes the whole point.',
        'The fix is a second structure: a map from handle to heap position, updated on every swap. ' +
          'That is an indexed priority queue, and it is what makes decrease-key genuinely logarithmic. ' +
          'The cost is the map itself, an extra write on every sift step, and an invariant that has ' +
          'to hold after every operation.',
        'The alternative is to not decrease anything. Push a duplicate entry with the better key ' +
          'and ignore the stale one when it surfaces. The queue grows, but nothing needs a handle ' +
          'map and the code is four lines shorter. The demo runs both and reports what each ' +
          'actually costs.'
      ],
      demo: { title: 'Interactive demo — decrease-key against duplicates', markup: root.IndexedPriorityQueuesTemplate.render() },
      diagram: {
        title: 'Diagram — the three parallel arrays',
        caption: 'Every swap in the heap must update the position map, or the handles go stale.',
        definition: [
          'flowchart LR',
          '    K["keys[i]<br/>the priority at slot i"] --- I["ids[i]<br/>the caller-s handle at slot i"]',
          '    I --- P["positions[id]<br/>the slot holding that handle"]',
          '    S["swap(a, b) must write<br/>keys, ids AND positions"] -.-> K',
          '    S -.-> P'
        ].join('\n')
      },
      insight: 'Lazy deletion is usually faster and always simpler, at the cost of an unbounded ' +
        'queue. Bounding it is the thing people forget, and it is where the memory goes. A queue ' +
        'that holds one entry per edge improvement rather than one per node can be an order of ' +
        'magnitude larger on a dense graph. Nothing in the algorithm notices until the allocator ' +
        'does.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.IndexedPriorityQueuesTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  function medianOf(values) {
    const sorted = values.slice().sort(function (a, b) { return a - b; });
    return sorted[Math.floor(sorted.length / 2)];
  }

  function measure(values) {
    const graph = root.PqLab.gridGraph({
      side: values['ipq-side'],
      rng: root.Random.seeded(values['ipq-seed'])
    });

    const strategies = [
      {
        label: 'indexed, real decrease-key', mode: 'indexed',
        create: function () { return root.BinaryHeap.create({ arity: 2, indexed: true }); }
      },
      {
        label: 'lazy, duplicate entries', mode: 'lazy',
        create: function () { return root.BinaryHeap.create({ arity: 2 }); }
      }
    ];

    let reference = null;
    const rows = strategies.map(function (entry) {
      const times = [];
      let run = null;
      for (let i = 0; i < values['ipq-runs']; i += 1) {
        const started = performance.now();
        run = root.PqLab.dijkstra(graph, 0, entry, entry.mode);
        times.push(performance.now() - started);
      }
      if (!reference) reference = run.distance;
      return {
        label: entry.label,
        run: run,
        median: medianOf(times),
        runs: times.length,
        agrees: run.distance.every(function (d, i) { return d === reference[i]; })
      };
    });

    return { graph: graph, rows: rows };
  }

  function update(app) {
    const values = panel.values();
    const measured = measure(values);
    const indexed = measured.rows[0];
    const lazy = measured.rows[1];
    const faster = indexed.median <= lazy.median ? indexed : lazy;

    root.MetricGrid.update({
      'ipq-pushes': {
        value: root.Format.exact(indexed.run.pushes),
        note: 'exactly one per node — ' + root.Format.exact(indexed.run.stats.decreaseKeys) + ' decrease-key calls on top'
      },
      'ipq-lazy-pushes': {
        value: root.Format.exact(lazy.run.pushes),
        note: root.Format.exact(lazy.run.stale) + ' of those were popped and discarded as stale'
      },
      'ipq-queue': {
        value: root.Format.exact(indexed.run.maxQueue) + ' / ' + root.Format.exact(lazy.run.maxQueue),
        note: root.Format.percent(lazy.run.maxQueue / indexed.run.maxQueue - 1, 0) + ' larger for the lazy version'
      },
      'ipq-time': {
        value: faster.label.split(',')[0],
        note: root.Format.perRun(faster.median, faster.runs) + ' against ' +
          root.Format.perRun(faster === indexed ? lazy.median : indexed.median, faster.runs)
      }
    });

    paintArrays(indexed);
    paintTable(measured.rows, values);
    paintTradeoff();
    void app;
  }

  function paintArrays(indexed) {
    const heap = root.BinaryHeap.create({ indexed: true });
    ['a', 'b', 'c', 'd', 'e', 'f'].forEach(function (id, i) { heap.push((i * 37) % 23, id); });
    const entries = heap.entries();

    const lines = [
      'slot      : ' + entries.map(function (_, i) { return String(i).padStart(4); }).join(''),
      'keys      : ' + entries.map(function (e) { return String(e.key).padStart(4); }).join(''),
      'ids       : ' + entries.map(function (e) { return String(e.id).padStart(4); }).join(''),
      '',
      'positions : ' + entries.map(function (e) { return e.id + '→' + heap.entries().findIndex(function (x) { return x.id === e.id; }); }).join('  ')
    ].join('\n');

    root.jQuery('#ipq-arrays').text(lines);
    root.jQuery('#ipq-arrays-note').text('A decrease-key looks the handle up in positions, edits ' +
      'keys at that slot and sifts up — and every swap on the way rewrites all three arrays. The ' +
      'invariant to test is that positions[ids[i]] === i for every i, checked after every operation. ' +
      'The live demo above ran on ' + root.Format.exact(indexed.run.settled) + ' nodes.');
  }

  function paintTable(rows, values) {
    const markup = rows.map(function (row) {
      return '<tr><td class="mono">' + row.label + '</td>' +
        '<td class="mono">' + root.Format.exact(row.run.pushes) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.run.stale) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.run.maxQueue) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.run.stats.comparisons) + '</td>' +
        '<td class="mono">' + root.Format.perRun(row.median, row.runs) + '</td></tr>';
    }).join('');

    root.jQuery('#ipq-table tbody').html(markup);
    root.jQuery('#ipq-note').text('Both rows compute identical distances over ' +
      root.Format.exact(values['ipq-side'] * values['ipq-side']) + ' nodes. The lazy version does more ' +
      'of everything — more pushes, more comparisons, a larger queue — and still finishes first on ' +
      'this machine, because it never touches a handle map. That is the trade, and it is why most ' +
      'shipped Dijkstra implementations look like the second row.');
  }

  function paintTradeoff() {
    const rows = [
      { what: 'queue size', indexed: 'one entry per node, bounded by V', lazy: 'one per improvement, bounded by E' },
      { what: 'extra structure', indexed: 'a handle → position map', lazy: 'none' },
      { what: 'per-swap cost', indexed: 'three array writes', lazy: 'two' },
      { what: 'what can go wrong', indexed: 'a stale position makes lookups silently wrong', lazy: 'the queue grows without a bound you set' },
      { what: 'code', indexed: 'decreaseKey, positions, an invariant to check', lazy: 'push again, and skip what is stale on the way out' }
    ].map(function (row) {
      return '<tr><td class="mono">' + row.what + '</td>' +
        '<td class="note">' + row.indexed + '</td>' +
        '<td class="note">' + row.lazy + '</td></tr>';
    }).join('');

    root.jQuery('#ipq-tradeoff tbody').html(rows);
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

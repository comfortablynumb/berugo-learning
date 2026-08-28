/**
 * Section: Incremental and concurrent collection.
 *
 * One bug, built by hand and then found by search.
 *
 * The hand-built version is `runScenario`: the container is blackened first,
 * the value is stored into it, the only other path is dropped, and without a
 * barrier the value is white when marking ends. That proves the barrier
 * handles the shape somebody thought of.
 *
 * The searched version is `stress`, and it is the one that matters: random
 * graphs, random interleavings of pointer stores with marking slices, ten
 * thousand of them, checked against a liveness oracle. No barrier loses a
 * live object on 76 of 10 000 runs — a 0.76 per cent failure rate, which is
 * exactly the kind of number that ships.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'incremental-collection';
  const SLICES = [1, 2, 4, 8, 16, 32, 64];
  let panel = null;
  let chart = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — the black-to-white pointer every barrier exists to prevent',
      caption: 'The container has already been scanned, so it is black and the collector will '
        + 'not look at it again. The program stores a reference to the value into it, then '
        + 'drops the only other path to the value. The value is now reachable and white, and '
        + 'nothing will ever reach it: the marker is past the container and the holder no '
        + 'longer points at it. It is freed while live. That is the bug, in full, and there is '
        + 'only one of it.',
      definition: [
        'graph LR',
        'C["container — BLACK, already scanned"] -->|"2. the program stores this"| V',
        'H["holder — still white or grey"] -.->|"3. the program drops this"| V',
        'V["value — WHITE, never reached"]',
        'M["the marker"] -->|"1. finished with the container"| C'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**A stop-the-world pause grows with the heap, and that is the whole reason this section '
        + 'exists.** Marking touches every reachable object, so a heap ten times larger takes '
        + 'roughly ten times as long to mark. There is no constant to tune that fixes it — the '
        + 'only options are to mark less of the heap, which is 31.4, or to mark it in pieces, '
        + 'which is this.',
      '**Marking incrementally means the program runs between slices, and that changes the '
        + 'problem completely.** A stop-the-world mark can conclude "still white when the grey '
        + 'set emptied, therefore garbage" because nothing moved underneath it. Let the program '
        + 'run and that inference is no longer valid.',
      '**There is exactly one bug, and it has a shape: a black object acquiring a white '
        + 'child.** The collector will not revisit a black object, so a reference stored into '
        + 'one is a reference the marker will never follow. If that was the last other path to '
        + 'the white object, it is freed while live. Every barrier in every concurrent '
        + 'collector ever built is a way of preventing that one shape.',
      '**Incremental update (Dijkstra) shades the NEW target.** When a black object is given a '
        + 'white child, colour the child grey so the marker will come back to it. This is '
        + 'precise: what survives the cycle is what was reachable when the cycle ended.',
      '**Snapshot at the beginning (Yuasa) shades the OLD target.** When a reference is '
        + 'overwritten, colour whatever it used to point at grey. This marks the heap as it was '
        + 'when the cycle started, so everything that dies during the cycle survives it. That '
        + 'is floating garbage, traded for a barrier that never has to look at the new value — '
        + 'and the demo measures the trade at 2.3 times as much retained.',
      '**SATB is correct only because a program cannot publish a reference it does not '
        + 'hold.** Every reference the mutator has came from a root or from a field it had '
        + 'already read, so nothing outside the snapshot can be stored into it. The single '
        + 'exception is allocation, which really does produce a reference from nowhere — and '
        + 'that is why every SATB collector allocates black.',
      '**Floating garbage is the price of concurrency and it is bounded by one cycle.** Objects '
        + 'that die after the collector decided they were live are collected next time. That is '
        + 'a memory cost, not a correctness one, and it is the right trade — but it means a '
        + 'concurrent collector needs headroom, and a heap sized exactly for the live set will '
        + 'thrash.',
      '**A read barrier is what you need if the collector MOVES objects concurrently, and it '
        + 'is much more expensive.** Reads outnumber writes heavily in real programs, so a '
        + 'check on every read is a different order of cost from a check on every write. '
        + 'Shenandoah and ZGC pay it, which is 31.6, and it is why their throughput numbers are '
        + 'the ones their designers are careful about.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: { title: 'Interactive demo — losing an object, then not losing it',
        markup: root.IncrementalTemplate.render() },
      diagram: diagram(),
      insight: '**The black-to-white pointer is THE garbage collection correctness bug, and '
        + 'every barrier design is a different way of preventing it — so knowing which '
        + 'invariant a runtime maintains tells you what its barrier costs.** What makes this '
        + 'worth carrying is how the bug behaves rather than what it is. Turn the barrier off '
        + 'in the demo and the collector does not crash, does not report anything, and passes '
        + '99.24 per cent of ten thousand randomised interleavings. The 0.76 per cent that fail '
        + 'lose an object the program is still using, and the program will notice at some '
        + 'unrelated later moment, in a stack trace that names neither the collector nor the '
        + 'store that caused it. This is why concurrent collectors are written by small teams '
        + 'over years and why their bugs are found by stress harnesses rather than by test '
        + 'suites: the shape you need is a specific three-way race, and no example-based test '
        + 'will contain it unless somebody already knew to write it. The practical read for an '
        + 'engineer using one of these runtimes is narrower and still useful. The barrier is '
        + 'the reason your stores are not free, and which barrier you have decides what you '
        + 'pay: an incremental-update collector charges you at stores into old objects and '
        + 'retains exactly what is live; a snapshot collector charges you at every overwrite '
        + 'and retains a cycle\'s worth of extra garbage. When a runtime\'s release notes say '
        + 'they changed the barrier, they have changed both of those numbers, and the second '
        + 'one is why your heap graph moved.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });
    panel = root.ControlPanel.mount({
      controls: root.IncrementalTemplate.controls,
      onChange: function () { update(); }
    });
    update();
  }

  /* ------------------------------------------------------------ measuring */

  function makeHeap() {
    return root.HeapSim.makeHeap({});
  }

  const scenariosFor = root.Helpers.memoise(function () {
    return root.GcIncremental.BARRIERS.map(function (barrier) {
      return { barrier: barrier, out: root.GcIncremental.runScenario(makeHeap, barrier.id) };
    });
  });

  const stressFor = root.Helpers.memoise(function (runs) {
    return root.GcIncremental.BARRIERS.map(function (barrier) {
      return { barrier: barrier,
        out: root.GcIncremental.stress(makeHeap, root.HeapSim.reachable,
          { barrier: barrier.id, runs: runs, seed: 11, objects: 12, stores: 6 }) };
    });
  });

  const traceFor = root.Helpers.memoise(function () {
    return root.HeapSim.synthetic({ count: 1500, seed: 5, survival: 0.15, retained: 64 });
  });

  const slicesFor = root.Helpers.memoise(function (barrier) {
    return root.GcLab.sweep(traceFor('one'), 'slice', SLICES,
      { mode: 'incremental', capacity: 8192, incrementalBarrier: barrier });
  });

  const baselineFor = root.Helpers.memoise(function () {
    return root.GcLab.replay(traceFor('one'), { mode: 'mark-sweep', capacity: 8192 });
  });

  const runFor = root.Helpers.memoise(function (key) {
    const parts = JSON.parse(key);

    return root.GcLab.replay(traceFor('one'), { mode: 'incremental', capacity: 8192,
      slice: parts[1], incrementalBarrier: parts[0] });
  });

  function update() {
    const values = panel.values();
    const barrier = values['icm-barrier'];
    const run = runFor(JSON.stringify([barrier, values['icm-slice']]));
    const stress = stressFor(values['icm-runs']);

    paintChart(slicesFor(barrier), values['icm-slice']);
    paintMetrics(run, stress, barrier);
    paintScenarios(scenariosFor('one'), barrier);
    paintStress(stress, barrier);
    paintSlices(slicesFor(barrier), values['icm-slice']);
    paintInvariant();
  }

  function paintChart(slices, chosen) {
    if (chart && chart.destroy) chart.destroy();
    chart = root.GrowthPlot.render(document.getElementById('icm-chart'), {
      series: [
        { label: 'p50 pause — the slice', color: root.Palette.series(0), dots: true,
          points: slices.map(function (row) { return { x: row.value, y: row.p50 }; }) },
        { label: 'p99 pause — the sweep', color: root.Palette.series(1), dots: true,
          points: slices.map(function (row) { return { x: row.value, y: row.p99 }; }) }
      ],
      xLabel: 'objects marked per slice', yLabel: 'objects touched in one pause',
      markers: [{ x: chosen, label: 'current' }],
      summary: function () { return 'Pause length against slice size for incremental marking.'; }
    });
    root.Helpers.setText('icm-chart-caption', chartCaption(slices));
  }

  function chartCaption(slices) {
    const small = slices[0];
    const large = slices[slices.length - 1];

    return 'The two lines say different things and the gap between them is the lesson. The p50 '
      + 'is exactly the slice — ' + small.p50 + ' at a slice of ' + small.value + ', ' +
      large.p50 + ' at ' + large.value + ' — because a typical pause IS one slice, which is '
      + 'what a bounded pause means. The p99 does not follow it down: ' + small.p99 + ' at the '
      + 'smallest slice against ' + large.p99 + ' at the largest. That is the SWEEP, which this '
      + 'design has not made incremental at all. Making marking concurrent and leaving the '
      + 'sweep stop-the-world is a real and common half-measure, and the p99 is where it shows.';
  }

  function storesIn(run) {
    return run.pauses.length ? traceFor('one').events.filter(function (event) {
      return event.kind === 'store';
    }).length : 0;
  }

  function paintMetrics(run, stress, barrier) {
    const row = stress.find(function (entry) { return entry.barrier.id === barrier; });
    const update = stress.find(function (entry) { return entry.barrier.id === 'update'; });
    const baseline = { p99: baselineFor('one').distribution.p99,
      stressFloating: update ? update.out.floating : 0 };
    const free = runFor(JSON.stringify(['none', run.settings.slice]));

    root.MetricGrid.update({
      'icm-lost': { value: row.out.lost + ' of ' + row.out.runs,
        note: row.out.lostObjects + ' live objects freed across the set' },
      'icm-floating': { value: row.out.floating + ' vs ' + baseline.stressFloating,
        note: baseline.stressFloating
          ? (row.out.floating / baseline.stressFloating).toFixed(2)
            + ' times what incremental update leaves' : 'no comparison available' },
      'icm-p99': { value: run.distribution.p99 + ' vs ' + baseline.p99,
        note: 'incremental against stop-the-world on the same trace' },
      'icm-throughput': { value: run.barrierWork - free.barrierWork,
        note: 'over ' + run.programWork + ' program steps, of which only '
          + storesIn(run) + ' are pointer stores — which is why the throughput columns barely '
          + 'differ' }
    });
  }

  function paintScenarios(rows, chosen) {
    root.jQuery('#icm-lost-table tbody').html(rows.map(function (entry) {
      return '<tr' + (entry.barrier.id === chosen ? ' class="row-current"' : '') +
        '><td class="mono">' + entry.barrier.name + '</td><td>' +
        root.Helpers.escapeHtml(entry.barrier.keeps) + '</td><td class="mono">' +
        (entry.out.survived ? 'yes' : 'NO — freed while live') + '</td><td class="mono">' +
        entry.out.reclaimed.length + '</td><td class="mono">' + entry.out.shaded +
        '</td></tr>';
    }).join(''));

    root.Helpers.setText('icm-lost-table-caption',
      'The fixture forces the ordering rather than hoping for it: the container is scanned to '
      + 'completion FIRST, so it is black, and only then does the program store the value into '
      + 'it and drop the holder. With an arbitrary grey order the marker might reach the value '
      + 'through the holder before the store happens, and then nothing is lost and nothing is '
      + 'demonstrated. A race you cannot reproduce on demand is a race you cannot fix.');
  }

  function paintStress(rows, chosen) {
    root.jQuery('#icm-stress tbody').html(rows.map(function (entry) {
      return '<tr' + (entry.barrier.id === chosen ? ' class="row-current"' : '') +
        '><td class="mono">' + entry.barrier.name + '</td><td>' +
        root.Helpers.escapeHtml(entry.barrier.invariant) + '</td><td class="mono">' +
        entry.out.runs + '</td><td class="mono">' + entry.out.lost + '</td><td class="mono">' +
        entry.out.lostObjects + '</td><td class="mono">' + entry.out.floating + '</td></tr>';
    }).join(''));

    root.Helpers.setText('icm-stress-caption', stressCaption(rows));
  }

  function stressCaption(rows) {
    const none = rows[0];
    const update = rows[1];
    const satb = rows[2];
    const rate = none.out.runs ? (none.out.lost / none.out.runs) * 100 : 0;

    return 'Random graphs, random interleavings, checked against an oracle that shares no code '
      + 'with the collector. No barrier fails ' + none.out.lost + ' of ' + none.out.runs +
      ' runs — ' + rate.toFixed(2) + ' per cent — which is the rate at which this bug reaches '
      + 'production rather than a test. Both barriers lose nothing. The last column is where '
      + 'they differ: snapshot-at-the-beginning leaves ' + satb.out.floating + ' dead objects '
      + 'against incremental update\'s ' + update.out.floating + ', ' +
      (update.out.floating ? (satb.out.floating / update.out.floating).toFixed(2) : '—') +
      ' times as much, because it is marking the heap as it was rather than as it is. Both '
      + 'stores are drawn from what the program can currently reach, which is the model doing '
      + 'its job: a mutator cannot publish a reference it does not hold, and SATB\'s '
      + 'correctness rests on exactly that.';
  }

  function paintSlices(rows, chosen) {
    root.jQuery('#icm-slices tbody').html(rows.map(function (row) {
      return '<tr' + (row.value === chosen ? ' class="row-current"' : '') +
        '><td class="mono">' + row.value + '</td><td class="mono">' + row.collections +
        '</td><td class="mono">' + row.p50 + '</td><td class="mono">' + row.p99 +
        '</td><td class="mono">' + row.max + '</td><td class="mono">' + row.gcWork +
        '</td><td class="mono">' + row.throughput.toFixed(3) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('icm-slices-caption',
      'The slice size is the median pause, and the number of pauses is the marking work divided '
      + 'by it, so the total work barely moves while the middle of the distribution moves a '
      + 'lot. That is the whole proposition of incremental collection: it does not make the '
      + 'work smaller, it makes most of the work arrive in pieces the application can survive. '
      + 'The max column is the one it does not fix — the sweep at the end of each cycle is a '
      + 'single pass over the heap and is still stop-the-world, so the tail of this '
      + 'distribution is the same shape whatever the slice.');
  }

  const INVARIANTS = [
    { rule: 'no black object points at a white one', held: 'incremental update (Dijkstra)',
      costs: 'a check on the store\'s target, on every pointer write while marking',
      keeps: 'exactly what is reachable when the mark ends' },
    { rule: 'everything reachable when marking started stays marked',
      held: 'snapshot at the beginning (Yuasa)',
      costs: 'a read of the old value before every overwrite while marking',
      keeps: 'that, plus everything that died during the cycle' },
    { rule: 'objects allocated during a cycle are not white',
      held: 'allocate-black, in both designs',
      costs: 'nothing — the colour is set at allocation',
      keeps: 'newborn objects the cycle never heard of, until the next cycle' }
  ];

  function paintInvariant() {
    root.jQuery('#icm-invariant tbody').html(INVARIANTS.map(function (row) {
      return '<tr><td class="mono">' + root.Helpers.escapeHtml(row.rule) + '</td><td>' +
        row.held + '</td><td>' + root.Helpers.escapeHtml(row.costs) + '</td><td>' +
        root.Helpers.escapeHtml(row.keeps) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('icm-invariant-caption',
      'Three rules, and the third is the one that is usually left out of the diagram. An object '
      + 'allocated after the mark began is not in the snapshot and was never reachable when the '
      + 'roots were scanned, so a marker that finished without seeing it would sweep it. '
      + 'Colouring it black at birth costs nothing and is why "allocate-black" appears in every '
      + 'concurrent collector\'s description — it is the one case where a program really can '
      + 'produce a reference out of nowhere.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

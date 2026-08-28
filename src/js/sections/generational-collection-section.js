/**
 * Section: Copying and generational collection.
 *
 * The headline is the heap-size sweep, and it is the milestone's cleanest
 * result: hold the workload fixed, quadruple the heap twice, and a mark-sweep
 * collection goes from 218 units to 1 270 while a copying collection stays
 * between 162 and 178. Cost proportional to survivors is not a slogan; it is
 * a flat line beside a rising one.
 *
 * The second measurement is the barrier, and it is measured by turning it
 * off. With no write barrier the nursery collection frees 208 reachable
 * objects, because an old object pointing into the nursery is a root the
 * collector never looked at. Both other settings free none. A demonstration
 * that has never failed has not been demonstrated.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'generational-collection';
  const HEAPS = [4096, 8192, 16384, 32768];
  const NURSERIES = [256, 512, 1024, 1536, 2048, 4096];
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
      title: 'Diagram — the write barrier recording an old-to-young pointer',
      caption: 'A nursery collection traces the young generation only, so it never looks at '
        + 'the old one. An old object holding a reference into the nursery is therefore a root '
        + 'the collector would miss, and the young object would be freed while live. The '
        + 'barrier is the few instructions on every pointer store that notice this case and '
        + 'record it, and the remembered set is where the record goes.',
      definition: [
        'graph LR',
        'O["old object"] -->|"store: old.field = young"| Y["young object"]',
        'O -.->|"the barrier notices old to young"| R["remembered set / dirty card"]',
        'R -->|"handed to the minor collection as an extra root"| Y',
        'N["nursery trace"] --> Y',
        'N -.->|"never scanned"| O'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**Cheney\'s algorithm is semi-space copying, and it is three facts.** Allocation is a '
        + 'pointer bump, because free space is always one contiguous run. Collection copies the '
        + 'live objects to the other space, so its cost is proportional to what survives rather '
        + 'than to the heap. And the to-space is its own work list — the scan pointer chases '
        + 'the allocation pointer — so there is no mark stack to overflow.',
      '**The price is the other half of the memory.** A semi-space collector can use half its '
        + 'heap at a time, which is why the design is usually applied to a nursery rather than '
        + 'to everything: half of a small nursery is a small price, and half of a large old '
        + 'generation is not.',
      '**"Cost proportional to survivors" is measurable and the demo measures it.** Fix the '
        + 'workload, grow the heap, and watch the two curves separate: mark-sweep has to look '
        + 'at everything to sweep it, so its per-collection cost tracks the heap; copying only '
        + 'touches what it copies, so its cost tracks the live set. A nursery full of dead '
        + 'objects is nearly free to collect.',
      '**The weak generational hypothesis is that most objects die young — and it is an '
        + 'empirical claim about your workload, not a law.** The survival curve here measures '
        + 'it on the trace at hand, and the dial lets you break it. At sixty per cent survival '
        + 'the generational design is the worst one available, because every minor collection '
        + 'copies most of what it touches and then does it again next time.',
      '**Promotion is what stops that repeating forever.** An object that survives a fixed '
        + 'number of nursery collections is moved to the old generation and stops being copied. '
        + 'Promote too early and long-lived garbage accumulates in a space that is rarely '
        + 'collected; promote too late and the same objects are copied over and over.',
      '**A minor collection\'s roots are the program\'s roots PLUS every old object pointing '
        + 'into the nursery, and finding those without scanning the old generation is the whole '
        + 'problem.** Scanning it would cost exactly what collecting generationally was supposed '
        + 'to avoid. So the mutator has to record them as they are created, which is the write '
        + 'barrier.',
      '**A remembered set is exact and a card table is cheap, and the difference is a dial.** '
        + 'The set stores the object and costs a set insertion per store; the card marks a '
        + 'fixed span of heap dirty with one byte and costs a scan of everything in that span. '
        + 'The demo sweeps the card size, and there is a third column people forget: the table '
        + 'itself is memory, and it shrinks as the cards grow.',
      '**A barrier entry is not cleared at the end of a collection, and getting that wrong is '
        + 'the subtle version of the same bug.** An old object pointing at a young one that '
        + 'SURVIVED still points at a young one, and no further store will re-record it. So the '
        + 'record has to be re-established from the objects the collection already scanned and '
        + 'the objects it promoted — which is free, because both sets are in hand.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: { title: 'Interactive demo — nursery, survivors, barriers',
        markup: root.GenerationalTemplate.render() },
      diagram: diagram(),
      insight: '**Copying collection costs time proportional to LIVE data, which is why a '
        + 'nursery full of dead objects is nearly free to collect, and why allocation rate '
        + 'alone is a poor predictor of GC cost.** The sweep in this section is the argument: '
        + 'the same workload in a heap four times larger costs mark-sweep three times as much '
        + 'per collection and costs copying nothing extra at all. Once that is internalised, a '
        + 'lot of tuning folklore reorganises itself. "Allocating in a loop is slow" is only '
        + 'true if the objects survive — a million objects that die immediately cost one '
        + 'pointer bump each and nothing at collection time, which is why an allocation-heavy '
        + 'functional style can outperform a pooled one. "Give the JVM more heap and GC gets '
        + 'cheaper" is true for throughput and false for pause length, and the sweep shows both '
        + 'halves in one table. And the survival rate, not the allocation rate, is the number '
        + 'to instrument first: it is what decides whether the nursery is doing its job, and it '
        + 'is the one number a workload can change out from under you when a cache is added or '
        + 'a request handler starts holding a reference it did not hold last release. The other '
        + 'thing worth carrying away is what the barrier costs when it is missing. Turn it off '
        + 'here and the collector is faster on every column — fewer instructions per store, '
        + 'better throughput, shorter pauses — and it frees 208 objects the program was still '
        + 'using. Every one of those numbers improved because the collector had stopped being '
        + 'correct, which is why the oracle column is the first one to read and not the last.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });
    panel = root.ControlPanel.mount({
      controls: root.GenerationalTemplate.controls,
      onChange: function () { update(); }
    });
    update();
  }

  /* ------------------------------------------------------------ measuring */

  const traceFor = root.Helpers.memoise(function (survival) {
    return root.HeapSim.synthetic({ count: 1500, seed: 5, retained: 64,
      survival: survival / 100 });
  });

  const runFor = root.Helpers.memoise(function (key) {
    const parts = JSON.parse(key);

    return root.GcLab.replay(traceFor(parts[0]), { mode: 'generational', capacity: 8192,
      nursery: parts[1], barrier: parts[2], cardBytes: parts[3] });
  });

  const sizesFor = root.Helpers.memoise(function (survival) {
    return root.GcLab.heapSizeSweep(traceFor(survival), HEAPS, ['mark-sweep', 'copying']);
  });

  const curveFor = root.Helpers.memoise(function (survival) {
    return root.GcCopying.survivalCurve(traceFor(survival), 8);
  });

  const nurseriesFor = root.Helpers.memoise(function (key) {
    const parts = JSON.parse(key);

    return root.GcLab.sweep(traceFor(parts[0]), 'nursery', NURSERIES,
      { mode: 'generational', capacity: 8192, barrier: parts[1], cardBytes: parts[2] });
  });

  const barriersFor = root.Helpers.memoise(function (key) {
    const parts = JSON.parse(key);

    return root.GcBarriers.KINDS.map(function (kind) {
      const run = root.GcLab.replay(traceFor(parts[0]), { mode: 'generational',
        capacity: 8192, nursery: parts[1], barrier: kind.id, cardBytes: parts[2] });

      return { kind: kind, run: run, table: tableBytes(kind.id, run, parts[2]) };
    });
  });

  /** A card table is one byte per span; a remembered set is a word per entry. */
  function tableBytes(kind, run, cardBytes) {
    if (kind === 'none') return 0;
    if (kind === 'card') return Math.ceil(run.span / cardBytes);
    return run.report.recorded * root.HeapSim.WORD_BYTES;
  }

  const mapFor = root.Helpers.memoise(function (survival) {
    const trace = traceFor(survival);
    const heap = root.HeapSim.build(trace, Math.floor(trace.events.length / 2),
      { capacity: 32768 });
    const state = root.GcCopying.create({ generational: true, promoteAfter: 2 });

    root.GcCopying.minorCollect(heap, state, 'demo');
    root.GcCopying.minorCollect(heap, state, 'demo');
    return heap;
  });

  function update() {
    const values = panel.values();
    const survival = values['gen-survival'];
    const key = JSON.stringify([survival, values['gen-nursery'], values['gen-barrier'],
      values['gen-card']]);
    const barrierKey = JSON.stringify([survival, values['gen-nursery'], values['gen-card']]);

    paintChart(sizesFor(survival));
    paintMetrics(runFor(key), curveFor(survival), sizesFor(survival));
    paintMap(mapFor(survival));
    paintHeapSizes(sizesFor(survival));
    paintCurve(curveFor(survival));
    paintNurseries(nurseriesFor(JSON.stringify([survival, values['gen-barrier'],
      values['gen-card']])), values['gen-nursery']);
    paintBarriers(barriersFor(barrierKey), values['gen-barrier'], values['gen-card']);
  }

  function paintChart(sizes) {
    if (chart && chart.destroy) chart.destroy();
    chart = root.GrowthPlot.render(document.getElementById('gen-chart'), {
      series: ['mark-sweep', 'copying'].map(function (mode, index) {
        return { label: mode, color: root.Palette.series(index), dots: true,
          points: sizes.filter(function (row) { return row.mode === mode; })
            .map(function (row) { return { x: row.capacity, y: row.perCollection }; }) };
      }),
      xLabel: 'heap the collector may fill (bytes)', yLabel: 'work per collection',
      legendHost: document.getElementById('gen-legend'),
      summary: function () { return 'Per-collection cost against heap size for mark-sweep and copying.'; }
    });
    root.Helpers.setText('gen-chart-caption', chartCaption(sizes));
  }

  function chartCaption(sizes) {
    const sweep = sizes.filter(function (row) { return row.mode === 'mark-sweep'; });
    const copy = sizes.filter(function (row) { return row.mode === 'copying'; });

    return 'Same trace, same live set, four heap sizes. Mark-sweep goes from ' +
      sweep[0].perCollection.toFixed(1) + ' units per collection to ' +
      sweep[sweep.length - 1].perCollection.toFixed(1) + ' — it has to walk the heap to sweep '
      + 'it, so its cost is the heap. Copying goes from ' + copy[0].perCollection.toFixed(1) +
      ' to ' + copy[copy.length - 1].perCollection.toFixed(1) + ', because it touches only '
      + 'what it copies and the live set has not moved. That gap is the entire argument for '
      + 'the generational design.';
  }

  function paintMetrics(run, curve, sizes) {
    const mean = curve.reduce(function (sum, row) { return sum + row.rate; }, 0) / curve.length;
    const full = sizes.find(function (row) {
      return row.mode === 'mark-sweep' && row.capacity === 8192;
    });

    root.MetricGrid.update({
      'gen-survival-rate': { value: (mean * 100).toFixed(1) + '%',
        note: 'mean over ' + curve.length + ' windows of this trace' },
      'gen-p99': { value: run.distribution.p99 + ' vs ' + (full ? full.p99 : '—'),
        note: 'a nursery collection against a full one at the same heap' },
      'gen-scanned': { value: run.report.scanned,
        note: run.report.recorded + ' recorded over ' + run.report.stores + ' stores, '
          + run.report.filtered + ' filtered by the fast path' },
      'gen-wrong': { value: run.wrong.length,
        note: run.wrong.length ? 'the barrier is off; these were reachable and are gone'
          : 'checked against the oracle at every collection' }
    });
  }

  function paintMap(heap) {
    root.jQuery('#gen-map').html(root.HeapMapView.map(heap.cells.values(), { scheme: 'age' }));

    const ages = { 0: 0, 1: 0, old: 0 };

    heap.cells.forEach(function (cell) {
      if (cell.age >= 2) { ages.old += 1; return; }
      ages[cell.age] += 1;
    });
    root.Helpers.setText('gen-map-caption',
      'Halfway through the trace, after two nursery collections: ' + ages[0] + ' objects born '
      + 'since the last one, ' + ages[1] + ' that have survived one, and ' + ages.old
      + ' promoted. The promoted ones will not be looked at again until a full collection, '
      + 'which is where a generational collector\'s floating garbage lives.');
  }

  function paintHeapSizes(sizes) {
    root.jQuery('#gen-heapsize tbody').html(sizes.map(function (row) {
      return '<tr><td class="mono">' + row.capacity + '</td><td class="mono">' + row.mode +
        '</td><td class="mono">' + row.collections + '</td><td class="mono">' +
        row.perCollection.toFixed(1) + '</td><td class="mono">' + row.p99 +
        '</td><td class="mono">' + row.peak + '</td></tr>';
    }).join(''));

    root.Helpers.setText('gen-heapsize-caption',
      'Read down the "work per collection" column within each collector. This is the '
      + 'acceptance test for the whole design and it is a measurement rather than an argument: '
      + 'if copying\'s column moved with the heap, the generational strategy would have no '
      + 'basis. Note also what happens to the collection COUNT — a bigger heap collects less '
      + 'often, so total GC work falls for both, and the pause gets longer for one of them. '
      + 'That is the throughput-latency trade in one table.');
  }

  function paintCurve(curve) {
    root.jQuery('#gen-curve tbody').html(curve.map(function (row) {
      return '<tr><td class="mono">' + row.from + '–' + row.to + '</td><td class="mono">' +
        row.allocated + '</td><td class="mono">' + row.survived + '</td><td class="mono">' +
        row.stillLater + '</td><td class="mono">' + (row.rate * 100).toFixed(1) +
        '%</td><td class="mono">' + row.bytes + '</td></tr>';
    }).join(''));

    root.Helpers.setText('gen-curve-caption', curveCaption(curve));
  }

  function curveCaption(curve) {
    const mean = curve.reduce(function (sum, row) { return sum + row.rate; }, 0) / curve.length;
    const later = curve.reduce(function (sum, row) { return sum + row.rateLater; }, 0)
      / curve.length;

    return 'Two horizons, both true, and quoting one while meaning the other is how a survival '
      + 'rate ends up disagreeing with the collector measured beside it. "Still live when the '
      + 'window ends" averages ' + (mean * 100).toFixed(1) + ' per cent and is the fraction a '
      + 'minor collection over a nursery of that size actually copies. "A window later" '
      + 'averages ' + (later * 100).toFixed(1) + ' per cent and is always smaller, because the '
      + 'objects that made it through one collection keep dying. The cost model wants the '
      + 'first.';
  }

  function paintNurseries(rows, nursery) {
    root.jQuery('#gen-nursery-table tbody').html(rows.map(function (row) {
      return '<tr' + (row.value === nursery ? ' class="row-current"' : '') +
        '><td class="mono">' + row.value + '</td><td class="mono">' + row.minor +
        '</td><td class="mono">' + row.major + '</td><td class="mono">' + row.p50 +
        '</td><td class="mono">' + row.p99 + '</td><td class="mono">' + row.gcWork +
        '</td><td class="mono">' + row.throughput.toFixed(3) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('gen-nursery-table-caption', nurseryCaption(rows));
  }

  function nurseryCaption(rows) {
    const small = rows[0];
    const large = rows[rows.length - 1];

    return 'A nursery of ' + small.value + ' bytes collects ' + small.minor + ' times for a p99 '
      + 'of ' + small.p99 + '; one of ' + large.value + ' collects ' + large.minor + ' times for '
      + 'a p99 of ' + large.p99 + '. The curve between them is not monotone in total work, and '
      + 'that is real rather than noise: the nursery size decides how long an object has to '
      + 'live to be promoted, so changing it changes the promotion rate as well as the '
      + 'collection frequency, and those two move the cost in opposite directions.';
  }

  function paintBarriers(rows, chosen, cardBytes) {
    root.jQuery('#gen-barrier-table tbody').html(rows.map(function (entry) {
      return '<tr' + (entry.kind.id === chosen ? ' class="row-current"' : '') +
        '><td class="mono">' + entry.kind.name + '</td><td class="mono">' + entry.kind.cost +
        '</td><td class="mono">' + entry.run.report.cost + '</td><td class="mono">' +
        entry.run.report.recorded + '</td><td class="mono">' + entry.run.report.scanned +
        '</td><td class="mono">' + entry.table + '</td><td class="mono">' +
        (entry.run.wrong.length ? entry.run.wrong.length + ' — BROKEN' : '0') + '</td></tr>';
    }).join(''));

    root.Helpers.setText('gen-barrier-table-caption', barrierCaption(rows, cardBytes));
  }

  function barrierCaption(rows, cardBytes) {
    const none = rows[0];
    const exact = rows[1];
    const card = rows[2];

    return 'The no-barrier row is faster on every column and frees ' + none.run.wrong.length +
      ' reachable objects, which is what a broken collector looks like from the outside: '
      + 'better numbers. Between the two working rows, the remembered set costs ' +
      exact.run.report.cost + ' units at the stores and hands the collector ' +
      exact.run.report.scanned + ' objects to look at; the card table costs ' +
      card.run.report.cost + ' and hands over ' + card.run.report.scanned + ' at ' + cardBytes +
      '-byte cards, in a table of ' + card.table + ' bytes against ' + exact.table + '. Shrink '
      + 'the cards and the scan approaches the exact set while the table grows — the card size '
      + 'is the dial between a store cost, a scan cost and a memory cost, and no setting '
      + 'minimises all three.';
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

/**
 * Section: The memory-management landscape.
 *
 * The measurement is the triangle, and the reason it is three columns rather
 * than one is that every collector here wins one of them. Reference counting
 * has no pause at all and the worst throughput; tracing has the best
 * throughput and the worst pause; the generational design splits the
 * difference and pays in footprint and in a barrier on every store. A table
 * with one column would rank them, and the ranking would be a lie.
 *
 * The manual half is the baseline the whole subject exists to replace, and it
 * is run rather than described: a scripted allocation sequence with five
 * seeded faults, a quarantine that catches four of them at its default depth,
 * and a sweep showing what the fifth costs to catch.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'memory-management-landscape';
  const MODES = ['refcount', 'mark-sweep', 'generational'];
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
      title: 'Diagram — the three axes no collector wins at once',
      caption: 'Throughput is the fraction of the program\'s work that is the program\'s own. '
        + 'Latency is the longest single pause. Footprint is how much memory the design needs '
        + 'above the live data. Every collector here is a choice of which two to favour, and '
        + '"which garbage collector is best" is always "for which of the three do you have the '
        + 'tightest budget".',
      definition: [
        'graph TD',
        'T["throughput — the program\'s share of the work"]',
        'L["latency — the longest single pause"]',
        'F["footprint — memory above the live set"]',
        'RC["reference counting"] --> L',
        'RC --> F',
        'MS["stop-the-world mark-sweep"] --> T',
        'MS --> F',
        'GEN["generational copying"] --> T',
        'GEN --> L',
        'INC["incremental / concurrent"] --> L',
        'MAN["manual: free() by hand"] --> T',
        'MAN --> F'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**Memory management is one question asked twice: where does this object go, and when '
        + 'may that space be used again.** The first is the allocator\'s and the second is the '
        + 'collector\'s, and separating them is the reason a runtime can change collector '
        + 'without changing how objects are laid out. Everything in this milestone is about '
        + 'the second question.',
      '**Manual management answers it with the program, and admits exactly four failures.** A '
        + 'block never freed is a leak. A block freed twice corrupts the allocator\'s own '
        + 'bookkeeping long before it corrupts anything the program can see. A block read after '
        + 'being freed returns whatever now lives there. And the reference that outlives its '
        + 'object — the dangling pointer — is what makes the middle two possible. The demo '
        + 'seeds all of them and runs them.',
      '**A quarantine plus a poison pattern is how you catch three of the four, and the fourth '
        + 'is the one that costs memory.** Do not hand a freed address back at once: hold it, '
        + 'overwrite its bytes with a value no program would compute, and a later read sees the '
        + 'pattern rather than plausible data. Deepen the queue and you catch more, and hold '
        + 'more memory out of circulation to do it. That is what a sanitiser build is.',
      '**Reference counting and tracing are the only two strategies, and they are opposites.** '
        + 'Counting asks each object whether anyone still points at it, and pays on every '
        + 'pointer write. Tracing asks the roots what is reachable, and pays in one burst. '
        + 'Everything else in this milestone is one of those two with the cost moved around.',
      '**"Safe" in a managed runtime means exactly one thing: no reachable object is ever '
        + 'freed.** It does not mean no leak — a cache nobody empties leaks in every language. '
        + 'It does not mean bounded memory, and it does not mean bounded pauses. The one '
        + 'guarantee is the one the liveness oracle in this milestone checks at every '
        + 'collection, and a collector that breaks it is broken however good its numbers look.',
      '**Every object pays a header, and the header is why small objects are expensive.** A '
        + 'mark bit needs somewhere to live; so does an age, a forwarding address, a region '
        + 'number and a reference count. Eight bytes on a twenty-four-byte object is a third of '
        + 'it, which is why runtimes work so hard to make small objects not be objects — value '
        + 'types, tagged integers, scalar replacement.',
      '**The three-way trade is the whole subject: throughput, latency, footprint.** Give a '
        + 'collector more memory and it collects less often, so throughput rises and pauses get '
        + 'longer. Break the pause into slices and throughput falls, because the barrier now '
        + 'runs on every store. There is no setting that improves all three, and every tuning '
        + 'flag in every runtime is a position on this triangle.',
      '**Which is why the pause distribution is reported and the mean is not.** A generational '
        + 'collector produces a bimodal pause set — many tiny nursery collections and the '
        + 'occasional full one — and its mean describes no pause that ever happened. The p99 is '
        + 'the number a latency budget is written against, and the maximum is the number that '
        + 'wakes somebody up.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: { title: 'Interactive demo — the same workload under three strategies',
        markup: root.LandscapeTemplate.render() },
      diagram: diagram(),
      insight: '**No collector wins on throughput, latency and footprint at once, so "which '
        + 'garbage collector is best" is always "for which of the three do you have the '
        + 'tightest budget".** That sounds like a platitude until you watch the table move. '
        + 'Reference counting posts a maximum pause of zero and the worst throughput in the '
        + 'set, because the work it does not do in a burst it does on every single pointer '
        + 'store instead — and it still leaks every cycle unless something else traces. '
        + 'Stop-the-world tracing posts the best throughput and a pause proportional to the '
        + 'heap, which is fine at eight megabytes and unshippable at eight gigabytes. The '
        + 'generational design cuts the common pause by an order of magnitude and pays for it '
        + 'twice: a write barrier on every store, and a p99 that is still the full collection '
        + 'it has not stopped needing. What makes this worth internalising is that the '
        + 'production question is never "is this collector good" — it is "which axis is my '
        + 'budget on". A batch job cares about throughput and should be given a large heap and '
        + 'left alone. A request path with a 50 ms budget cares about the p99 and nothing else, '
        + 'and will trade twenty per cent of its throughput for it without hesitating. An '
        + 'embedded target cares about footprint and will accept both of the other costs. Those '
        + 'are three different right answers to one question, and a benchmark that reports a '
        + 'single number has silently chosen one of them for you.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });
    panel = root.ControlPanel.mount({
      controls: root.LandscapeTemplate.controls,
      onChange: function () { update(); }
    });
    update();
  }

  /* ------------------------------------------------------------ measuring */

  const traceFor = root.Helpers.memoise(function (key) {
    const parts = JSON.parse(key);

    if (parts[0] === 'program') {
      return { trace: root.HeapSim.record(root.LandscapeTemplate.loopSource(50), {}),
        capacity: 1024, nursery: 320, candidates: 8 };
    }
    return { trace: root.HeapSim.synthetic({ count: 1500, seed: 5, retained: 64,
      cycles: 0.06, survival: parts[1] / 100 }),
    capacity: 8192, nursery: 1536, candidates: 32 };
  });

  const runsFor = root.Helpers.memoise(function (key) {
    const world = traceFor(key);

    return MODES.map(function (mode) {
      return root.GcLab.replay(world.trace, { mode: mode, capacity: world.capacity,
        nursery: world.nursery, candidates: world.candidates });
    });
  });

  const manualFor = root.Helpers.memoise(function (depth) {
    return { run: root.GcManual.replay(root.GcManual.seededScript(), { quarantine: depth }),
      sweep: root.GcManual.quarantineSweep(root.GcManual.seededScript(), [0, 1, 2, 4, 6, 8]) };
  });

  function update() {
    const values = panel.values();
    const key = JSON.stringify([values['mml-workload'], values['mml-survival']]);
    const world = traceFor(key);
    const runs = runsFor(key);
    const manual = manualFor(values['mml-quarantine']);

    paintChart(runs);
    paintMetrics(manual, runs, world);
    paintFaults(manual, runs);
    paintQuarantine(manual, values['mml-quarantine']);
    paintStrategies(runs, world);
    paintHeader(world, runs);
  }

  function paintChart(runs) {
    const host = document.getElementById('mml-chart');

    if (chart && chart.destroy) chart.destroy();
    chart = root.GrowthPlot.render(host, {
      series: runs.map(function (run, index) {
        return { label: run.mode.name, color: root.Palette.series(index),
          points: root.GcLab.occupancy(run, 140).map(function (row) {
            return { x: row.at, y: row.bytes };
          }) };
      }),
      xLabel: 'allocation', yLabel: 'bytes held',
      legendHost: document.getElementById('mml-legend'),
      summary: function () { return 'Heap occupancy over the run for three collection strategies.'; }
    });
    root.Helpers.setText('mml-chart-caption', chartCaption(runs));
  }

  function chartCaption(runs) {
    const counting = runs[0];
    const tracing = runs[1];

    return 'Reference counting never rises above the live set, because it frees at the store '
      + 'that made the object dead — ' + counting.immediate + ' objects reclaimed here without '
      + 'a single pause. The tracing lines are sawteeth: they rise to the limit, drop, and rise '
      + 'again ' + tracing.collections + ' times. The area under a sawtooth is the memory the '
      + 'design needs above the live set, and it is the third axis of the triangle.';
  }

  function paintMetrics(manual, runs, world) {
    const worst = runs.reduce(function (most, run) {
      return Math.max(most, run.distribution.max);
    }, 0);

    root.MetricGrid.update({
      'mml-caught': { value: manual.run.caught + ' of ' + manual.run.seeded,
        note: manual.run.missed ? manual.run.missed + ' became a plausible wrong answer instead'
          : 'the quarantine is deep enough to name every one' },
      'mml-missed': { value: manual.run.missed,
        note: 'freed blocks whose address had already been handed out again' },
      'mml-held': { value: heldBytes(manual.run),
        note: manual.run.state.pending.length + ' blocks waiting, unusable' },
      'mml-pause': { value: worst + ' vs 0',
        note: 'counting has no pause; it pays on every store instead' }
    });
    return world;
  }

  function heldBytes(run) {
    return run.state.pending.reduce(function (sum, address) {
      const block = run.state.blocks.get(address);

      return sum + (block ? block.size : 0);
    }, 0);
  }

  function paintFaults(manual, runs) {
    const seen = countFaults(manual);
    const rows = root.GcManual.FAULTS.map(function (fault) {
      return faultRow(fault, seen, runs);
    });

    root.jQuery('#mml-faults tbody').html(rows.join(''));
    root.Helpers.setText('mml-faults-caption',
      'The first three columns are what the strategies make impossible; the last is what this '
      + 'run actually produced. Note what neither collector prevents: a leak. An object that is '
      + 'still reachable and will never be used again is live by every definition a collector '
      + 'has, and no amount of tracing will free it.');
  }

  const PREVENTED = {
    leak: { rc: 'no — a reachable object nobody will use is still reachable',
      tracing: 'no — same; this is 31.9\'s subject' },
    'double-free': { rc: 'yes — the program never frees anything',
      tracing: 'yes — same reason' },
    'use-after-free': { rc: 'yes — the object lives while a reference does',
      tracing: 'yes — same guarantee, checked by the oracle' },
    dangling: { rc: 'yes — holding a reference is what keeps it alive',
      tracing: 'yes — a root is a reference and a reference is a root' }
  };

  function faultRow(fault, seen, runs) {
    const answer = PREVENTED[fault.id];

    return '<tr><td class="mono">' + fault.name + '</td><td>' +
      root.Helpers.escapeHtml(fault.about) + '</td><td>' + answer.rc + '</td><td>' +
      answer.tracing + '</td><td class="mono">' + observed(fault, seen, runs) + '</td></tr>';
  }

  function observed(fault, seen, runs) {
    if (fault.id === 'leak') {
      return seen.leaks + ' never freed here, ' + runs[0].uncollected
        + ' cycles leaked under counting';
    }
    if (fault.id === 'dangling') return seen.silent + ' via an address handed out again';
    return (seen[fault.id] || 0) + ' caught, ' + (seen.silentOf[fault.id] || 0) + ' silent';
  }

  function countFaults(manual) {
    const seen = { leaks: manual.run.leaks.length, silent: manual.run.silent.length,
      silentOf: {} };

    manual.run.faults.forEach(function (row) { seen[row.kind] = (seen[row.kind] || 0) + 1; });
    manual.run.silent.forEach(function (row) {
      seen.silentOf[row.kind] = (seen.silentOf[row.kind] || 0) + 1;
    });
    return seen;
  }

  function paintQuarantine(manual, depth) {
    root.jQuery('#mml-quar tbody').html(manual.sweep.map(function (row) {
      return '<tr' + (row.quarantine === depth ? ' class="row-current"' : '') +
        '><td class="mono">' + row.quarantine + '</td><td class="mono">' + row.caught +
        ' of ' + row.seeded + '</td><td class="mono">' + row.missed + '</td><td class="mono">' +
        row.held + '</td><td class="mono">' + row.reuses + '</td></tr>';
    }).join(''));

    root.Helpers.setText('mml-quar-caption', quarantineCaption(manual.sweep));
  }

  function quarantineCaption(sweep) {
    const none = sweep[0];
    const full = sweep[sweep.length - 1];

    return 'At depth ' + none.quarantine + ' the allocator hands a freed address straight back, '
      + 'so it catches ' + none.caught + ' of ' + none.seeded + ' and the other ' + none.missed
      + ' return plausible values. At depth ' + full.quarantine + ' it catches all '
      + full.caught + ' and holds ' + full.held + ' bytes out of circulation to do it. There is '
      + 'no free lunch on this curve, and the last row is the reason a sanitiser is a debugging '
      + 'build rather than the default one.';
  }

  function paintStrategies(runs, world) {
    root.jQuery('#mml-strategies tbody').html(runs.map(function (run) {
      return '<tr><td class="mono">' + run.mode.name + '</td><td class="mono">' +
        run.collections + '</td><td class="mono">' + run.distribution.p50 +
        '</td><td class="mono">' + run.distribution.p99 + '</td><td class="mono">' +
        run.throughput.toFixed(3) + '</td><td class="mono">' + run.peak +
        '</td><td class="mono">' + run.uncollected + '</td></tr>';
    }).join(''));

    root.Helpers.setText('mml-strategies-caption', strategiesCaption(runs, world));
  }

  function strategiesCaption(runs, world) {
    const best = runs.reduce(function (top, run) {
      return run.throughput > top.throughput ? run : top;
    });

    return 'One trace of ' + world.trace.allocations + ' objects and ' + world.trace.bytes +
      ' bytes, replayed against three designs, with every collection checked against the '
      + 'liveness oracle — ' + runs.filter(function (run) { return run.correct; }).length +
      ' of ' + runs.length + ' freed no reachable object. Best throughput is '
      + best.mode.name + ' at ' + best.throughput.toFixed(3) + ', and it is not the one with '
      + 'the smallest pause. Read the columns together or do not read them at all.';
  }

  const HEADER_ROWS = [
    { name: 'mark bit / colour', bytes: 1,
      why: 'a tracing collector has to record that it has reached this object' },
    { name: 'age', bytes: 1,
      why: 'a generational collector needs to know which side of the promotion line it is on' },
    { name: 'forwarding address', bytes: 4,
      why: 'a copying collector overwrites the object with where it went' },
    { name: 'reference count', bytes: 2,
      why: 'a counting collector needs one per object, and it has to be atomic if threads share it' }
  ];

  function paintHeader(world, runs) {
    const count = world.trace.allocations;

    root.jQuery('#mml-header tbody').html(HEADER_ROWS.map(function (row) {
      return '<tr><td class="mono">' + row.name + '</td><td class="mono">' + row.bytes +
        '</td><td>' + root.Helpers.escapeHtml(row.why) + '</td><td class="mono">' +
        (row.bytes * count) + ' bytes over ' + count + ' objects</td></tr>';
    }).join(''));

    root.Helpers.setText('mml-header-caption', headerCaption(world, runs));
  }

  function headerCaption(world) {
    const header = root.HeapSim.HEADER_BYTES;
    const total = header * world.trace.allocations;
    const share = world.trace.bytes ? (total / world.trace.bytes) * 100 : 0;

    return 'The model here charges one ' + header + '-byte header per object, which is '
      + total + ' of the ' + world.trace.bytes + ' bytes this trace allocates — '
      + share.toFixed(1) + ' per cent of the heap, before a single field. A real runtime packs '
      + 'these fields rather than laying them out as this table does, but the direction is the '
      + 'point: the header is a fixed cost per OBJECT, so it is paid hardest by the programs '
      + 'that allocate many small ones, and that is why every fast runtime works so hard to '
      + 'make small objects not be objects at all.';
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

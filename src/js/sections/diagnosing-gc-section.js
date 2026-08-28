/**
 * Section: Diagnosing GC in production.
 *
 * The leak is real and it is found the way a real one is found: two heap
 * snapshots, a dominator tree over the object graph, and the growth compared
 * by allocation site. The dominator code is M13's, unchanged — the question
 * "if I drop this one reference, how much memory comes back" is dominance
 * over the object graph, and that is the only question a heap dump can
 * usefully answer.
 *
 * The verdict is a measurement rather than an inspection: sample the retained
 * bytes over the second half of the run, where the warm-up is over, and take
 * the slope. Flat at 2 128 bytes with no leak; 1 040 bytes per sample with
 * one. The lab is graded on that assertion.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'diagnosing-gc';
  const FRACTIONS = [0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
  const HEAPS = [4096, 8192, 16384, 32768, 49152];
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
      title: 'Diagram — a retaining path from a GC root to a leaked object',
      caption: 'Every object in a heap dump is there because something points at it, and the '
        + 'chain back to a GC root is the retaining path. The collector is right about all of '
        + 'it: every object on this path is genuinely reachable, so no collector setting will '
        + 'free any of it. The only fix is to remove one edge, and the dominator tree is what '
        + 'tells you which edge is worth removing.',
      definition: [
        'graph LR',
        'R["GC root — a static field"] --> C["the cache"]',
        'C --> H["list head"]',
        'H --> N1["entry 368"]',
        'N1 --> N2["entry 367"]',
        'N2 --> D["... 366 more ..."]',
        'D --> L["the object you are looking for"]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**A managed leak is not a collector failure — it is a reference you forgot you were '
        + 'holding.** Every object in the dump is genuinely reachable and the collector is '
        + 'right about every one of them. That is why no flag, no heap size and no collector '
        + 'choice will fix it, and why the diagnosis is about your object graph rather than '
        + 'about the runtime.',
      '**There are four shapes and they cover almost everything.** A cache with no eviction. A '
        + 'listener or observer nobody deregisters. A thread-local on a pooled thread that '
        + 'outlives the request. And a closure capturing more than it needs — usually the '
        + 'enclosing object, because it referenced one field of it.',
      '**The first evidence is the GC log, and the useful reading is the trend rather than any '
        + 'single line.** Bytes after each full collection is the number that matters: if it '
        + 'rises monotonically across full collections, the live set is growing, and everything '
        + 'else in the log is noise about how hard the collector is working to keep up.',
      '**Allocation rate and promotion rate are different diagnoses.** A high allocation rate '
        + 'with a low promotion rate is a busy program the nursery is handling — the fix is '
        + '31.8, if anything. A high promotion rate means objects are surviving the nursery, '
        + 'which is either a real working-set change or the beginning of a leak.',
      '**A heap that is too small collects constantly and a heap that is too large pauses for a '
        + 'long time, and both are visible in the sweep.** The wrong response to a GC problem is '
        + 'usually to change the heap size first, because it moves every number and diagnoses '
        + 'nothing.',
      '**A heap dump shows what is RETAINED, never what is garbage.** A collection runs before '
        + 'the snapshot is taken, so everything in it is live. The only question a dump can '
        + 'answer is which reference is doing the retaining, which is why the dominator tree is '
        + 'the tool rather than the object list.',
      '**Retained size is the answer to "if I drop this one reference, how much comes back", '
        + 'and it is dominance over the object graph.** Object A dominates B if every path from '
        + 'a root to B goes through A. The retained size of A is the total size of everything it '
        + 'dominates — which is exactly the memory that would be freed if A became unreachable, '
        + 'and it is computed here by the same pass M13 built for control-flow graphs.',
      '**Compare two snapshots rather than reading one.** A single dump tells you what is big, '
        + 'which is usually a cache doing its job. Two dumps taken far apart tell you what is '
        + 'GROWING, by allocation site, and the site with the largest gain is the leak nine '
        + 'times out of ten.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: { title: 'Interactive demo — a growing heap, two snapshots and a dominator tree',
        markup: root.DiagnoseTemplate.render() },
      diagram: diagram(),
      insight: '**The dominator tree on the object graph is the same algorithm as in the '
        + 'compiler: it answers "if I drop this one reference, how much memory comes back", '
        + 'which is the only question a heap dump can usefully answer.** That equivalence is '
        + 'worth more than it first looks. It tells you what to do with a dump, which is the '
        + 'part most people never learn: not to sort by object count, not to look for the '
        + 'biggest class, but to sort by retained size and then read the retaining path of '
        + 'whatever is at the top. The retained size is a prediction — free this one edge and '
        + 'you get these bytes back — and it is a prediction the tool can make and you cannot, '
        + 'because it requires the whole graph. Sorting by shallow size instead is the standard '
        + 'mistake and it always points at `byte[]` and `String`, which are never the problem; '
        + 'they are what the problem is holding. The second habit worth building is to stop '
        + 'reading one dump. A single snapshot of a healthy service looks exactly like a '
        + 'single snapshot of a leaking one, because a cache doing its job and a cache with no '
        + 'eviction are the same picture at any one instant. Two snapshots far apart, differenced '
        + 'by allocation site, turn "the heap is big" into "this site gained 936 bytes between '
        + 'them" — and that sentence names a line of code. Everything else in this section — the '
        + 'log, the sizing sweep, the promotion rate — is context for reading that one number.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });
    panel = root.ControlPanel.mount({
      controls: root.DiagnoseTemplate.controls,
      onChange: function () { update(); }
    });
    update();
  }

  /* ------------------------------------------------------------ measuring */

  const traceFor = root.Helpers.memoise(function (leak) {
    return root.HeapSim.synthetic({ count: 2400, seed: 5, survival: 0.12, retained: 48,
      leak: leak / 100 });
  });

  /**
   * Snapshots over the second half of the run. The first half is warm-up:
   * the retained set is still filling, so a slope measured across it says
   * "growing" for a program that is merely starting. Every leak-hunting tool
   * has this problem and every one of them gets it wrong at least once.
   */
  const snapshotsFor = root.Helpers.memoise(function (leak) {
    const trace = traceFor(leak);

    return FRACTIONS.map(function (fraction) {
      const heap = root.HeapSim.snapshot(trace, Math.floor(trace.events.length * fraction),
        { capacity: 65536 });

      return { fraction: fraction, heap: heap, bytes: heap.bytes,
        analysis: root.HeapAnalysis.analyse(heap) };
    });
  });

  const runFor = root.Helpers.memoise(function (key) {
    const parts = JSON.parse(key);

    return root.GcLab.replay(traceFor(parts[0]), { mode: parts[2], capacity: parts[1],
      nursery: Math.max(512, Math.round(parts[1] / 8)) });
  });

  const sizingFor = root.Helpers.memoise(function (key) {
    const parts = JSON.parse(key);

    return HEAPS.map(function (capacity) {
      const run = root.GcLab.replay(traceFor(parts[0]), { mode: parts[1], capacity: capacity,
        nursery: Math.max(512, Math.round(capacity / 8)) });

      return { capacity: capacity, run: run };
    });
  });

  /** The deepest object in the dump, which is what a leak looks like. */
  const deepestFor = root.Helpers.memoise(function (leak) {
    const shots = snapshotsFor(leak);
    const last = shots[shots.length - 1];
    let best = { path: [], id: null };

    last.analysis.rows.forEach(function (row) {
      const path = root.HeapAnalysis.retainingPath(last.heap, row.id);

      if (path.length > best.path.length) best = { path: path, id: row.id };
    });
    return { heap: last.heap, analysis: last.analysis, path: best.path, id: best.id };
  });

  function update() {
    const values = panel.values();
    const leak = values['dgn-leak'];
    const shots = snapshotsFor(leak);
    const run = runFor(JSON.stringify([leak, values['dgn-heap'], values['dgn-collector']]));

    paintChart(leak);
    paintMetrics(shots, run, deepestFor(leak));
    paintLog(run);
    paintRetained(shots[shots.length - 1]);
    paintGrowth(shots);
    paintPath(deepestFor(leak));
    paintSizing(sizingFor(JSON.stringify([leak, values['dgn-collector']])), values['dgn-heap']);
    paintLeaks();
  }

  function paintChart(leak) {
    const series = [0, leak].filter(function (value, at, all) {
      return all.indexOf(value) === at;
    }).map(function (rate, index) {
      return { label: rate ? rate + '% leak' : 'no leak', color: root.Palette.series(index),
        dots: true,
        points: snapshotsFor(rate).map(function (shot) {
          return { x: Math.round(shot.fraction * 100), y: shot.bytes };
        }) };
    });

    if (chart && chart.destroy) chart.destroy();
    chart = root.GrowthPlot.render(document.getElementById('dgn-chart'), {
      series: series, xLabel: 'per cent of the run elapsed', yLabel: 'retained bytes',
      legendHost: document.getElementById('dgn-legend'),
      summary: function () { return 'Retained bytes at each snapshot, with and without the leak.'; }
    });
    root.Helpers.setText('dgn-chart-caption', chartCaption(leak));
  }

  function chartCaption(leak) {
    const clean = root.HeapAnalysis.stability(snapshotsFor(0).map(function (s) {
      return s.bytes;
    }));
    const dirty = root.HeapAnalysis.stability(snapshotsFor(leak).map(function (s) {
      return s.bytes;
    }));

    return 'Retained bytes only, taken after a collection — this is what a heap dump would '
      + 'show, and it contains no garbage at all. The clean line is flat at a slope of ' +
      clean.slope.toFixed(1) + ' bytes per sample; the current setting gives ' +
      dirty.slope.toFixed(1) + '. A rising line of RETAINED bytes is the one signal that no '
      + 'amount of collector tuning can change, because every byte on it is reachable and the '
      + 'collector is right.';
  }

  function paintMetrics(shots, run, deepest) {
    const stability = root.HeapAnalysis.stability(shots.map(function (s) { return s.bytes; }));
    const report = run.report;
    const ratio = report && run.allocatedBytes
      ? report.promoted / run.allocatedBytes : 0;

    root.MetricGrid.update({
      'dgn-slope': { value: stability.slope.toFixed(1),
        note: shots[0].bytes + ' bytes at the first snapshot, ' +
          shots[shots.length - 1].bytes + ' at the last' },
      'dgn-stable': { value: stability.stable ? 'yes' : 'NO',
        note: stability.stable ? 'the slope is within one per cent of the mean'
          : 'the retained set is growing and no collector will stop it' },
      'dgn-path': { value: deepest.path.length - 1,
        note: 'hops from a GC root to object #' + deepest.id },
      'dgn-promotion': { value: report ? (ratio * 100).toFixed(1) + '%' : 'n/a',
        note: report ? report.promoted + ' bytes promoted of ' + run.allocatedBytes
          + ' allocated' : 'only a generational collector reports one' }
    });
  }

  function paintLog(run) {
    const rows = run.pauses.slice(-12);

    root.jQuery('#dgn-log tbody').html(rows.map(function (row, at) {
      return '<tr><td class="mono">' + (run.pauses.length - rows.length + at + 1) +
        '</td><td class="mono">' + row.why + '</td><td class="mono">' +
        root.Helpers.escapeHtml(row.note || '—') + '</td><td class="mono">' + row.before +
        '</td><td class="mono">' + row.bytes + '</td><td class="mono">' + row.reclaimed +
        '</td><td class="mono">' + row.work + '</td></tr>';
    }).join('') || '<tr><td colspan="7">this collector had no pauses on this run</td></tr>');

    root.Helpers.setText('dgn-log-caption', logCaption(run));
  }

  function logCaption(run) {
    const rows = run.pauses;
    const first = rows[0];
    const last = rows[rows.length - 1];

    if (!rows.length) return 'No collections: reference counting reclaims at the store instead.';
    return 'The last ' + Math.min(12, rows.length) + ' of ' + rows.length + ' collections. The '
      + 'column to read is "bytes after": it went from ' + first.bytes + ' to ' + last.bytes +
      ' across this run. Rising bytes-after-collection is the live set growing, and it is the '
      + 'only line in a GC log that distinguishes a busy program from a leaking one — pause '
      + 'lengths and collection counts rise for both.';
  }

  function paintRetained(shot) {
    const rows = shot.analysis.rows.slice()
      .sort(function (a, b) { return b.retained - a.retained; }).slice(0, 12);

    root.jQuery('#dgn-retained tbody').html(rows.map(function (row) {
      const parent = root.HeapAnalysis.immediateHolder(shot.analysis, row.id);

      return '<tr><td class="mono">#' + row.id + '</td><td class="mono">' +
        root.Helpers.escapeHtml(row.site ? row.site.origin : row.kind) +
        '</td><td class="mono">' + row.shallow + '</td><td class="mono">' + row.retained +
        '</td><td class="mono">' + (parent === null ? 'a GC root' : '#' + parent) +
        '</td><td class="mono">' + row.dominated + '</td></tr>';
    }).join(''));

    root.Helpers.setText('dgn-retained-caption', retainedCaption(rows, shot));
  }

  function retainedCaption(rows, shot) {
    const top = rows[0];

    return 'Sorted by RETAINED size, not by own size, and that is the whole technique. Object #'
      + top.id + ' occupies ' + top.shallow + ' bytes itself and dominates ' + top.retained
      + ' — so dropping the one reference to it returns ' + top.retained + ' bytes of the '
      + shot.heap.bytes + ' in this dump, and dropping any object it dominates returns almost '
      + 'nothing. Sorting by own size instead always points at whatever class is physically '
      + 'largest, which is never the leak; it is what the leak is holding.';
  }

  function paintGrowth(shots) {
    const rows = root.HeapAnalysis.growth(shots[0].analysis,
      shots[shots.length - 1].analysis).slice(0, 10);

    root.jQuery('#dgn-growth tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + root.Helpers.escapeHtml(row.site) +
        '</td><td class="mono">' + row.wasCount + '</td><td class="mono">' + row.count +
        '</td><td class="mono">' + row.wasRetained + '</td><td class="mono">' + row.retained +
        '</td><td class="mono">' + row.delta + '</td></tr>';
    }).join('') || '<tr><td colspan="6">nothing grew between the two snapshots</td></tr>');

    root.Helpers.setText('dgn-growth-caption', growthCaption(rows, shots));
  }

  function growthCaption(rows, shots) {
    if (!rows.length) {
      return 'Nothing gained retained bytes between the two snapshots, which is what a healthy '
        + 'service looks like. Note that this is only visible because there are two snapshots: '
        + 'either one alone would show a heap with objects in it.';
    }
    const top = rows[0];

    return 'The difference between the snapshot at ' + Math.round(shots[0].fraction * 100) +
      ' per cent of the run and the one at the end, by allocation site. "' + top.site +
      '" went from ' + top.wasCount + ' objects retaining ' + top.wasRetained + ' bytes to ' +
      top.count + ' retaining ' + top.retained + ' — a gain of ' + top.delta + '. That row '
      + 'names a construct in the source, which is what turns "the heap is growing" into a '
      + 'line of code to look at.';
  }

  function paintPath(deepest) {
    const rows = deepest.path.slice(-14);
    const byId = new Map();

    deepest.analysis.rows.forEach(function (row) { byId.set(row.id, row); });
    root.jQuery('#dgn-path-table tbody').html(rows.map(function (node, at) {
      const row = node.id === null ? null : byId.get(node.id);

      return '<tr><td class="mono">' + (deepest.path.length - rows.length + at) +
        '</td><td class="mono">' + (node.id === null ? 'GC root' : '#' + node.id) +
        '</td><td class="mono">' + (row && row.site ? row.site.origin : '—') +
        '</td><td class="mono">' + (row ? row.shallow : '—') + '</td><td class="mono">' +
        (row ? row.retained : '—') + '</td></tr>';
    }).join(''));

    root.Helpers.setText('dgn-path-table-caption', pathCaption(deepest, rows.length));
  }

  function pathCaption(deepest, shown) {
    return 'The last ' + shown + ' hops of a path ' + (deepest.path.length - 1) + ' long, from '
      + 'a GC root to object #' + deepest.id + '. Every edge on it is a real reference and '
      + 'every object on it is genuinely reachable, which is why the collector will never free '
      + 'any of them. A path this long is itself the diagnosis: an unbounded list where each '
      + 'entry holds the previous one, so the whole history of the process is reachable from '
      + 'one field. Set the leak rate to zero and the longest path collapses to the depth of '
      + 'the retained structure.';
  }

  function paintSizing(rows, chosen) {
    root.jQuery('#dgn-sizing tbody').html(rows.map(function (entry) {
      return '<tr' + (entry.capacity === chosen ? ' class="row-current"' : '') +
        '><td class="mono">' + entry.capacity + '</td><td class="mono">' +
        entry.run.collections + '</td><td class="mono">' + entry.run.distribution.p50 +
        '</td><td class="mono">' + entry.run.distribution.p99 + '</td><td class="mono">' +
        entry.run.throughput.toFixed(3) + '</td><td class="mono">' + entry.run.peak +
        '</td><td class="mono">' + entry.run.uncollected + '</td></tr>';
    }).join(''));

    root.Helpers.setText('dgn-sizing-caption', sizingCaption(rows));
  }

  function sizingCaption(rows) {
    const small = rows[0];
    const large = rows[rows.length - 1];

    return 'At ' + small.capacity + ' bytes the collector runs ' + small.run.collections +
      ' times for a throughput of ' + small.run.throughput.toFixed(3) + '; at ' +
      large.capacity + ' it runs ' + large.run.collections + ' times at ' +
      large.run.throughput.toFixed(3) + ' with a p99 of ' + large.run.distribution.p99 +
      ' against ' + small.run.distribution.p99 + '. Both ends are bad and neither is a leak. '
      + 'This table is here because resizing the heap is the first thing people try and it '
      + 'moves every number in the log without diagnosing anything — the leak is still there '
      + 'at every row, and the retained-bytes line above is unchanged by any of it.';
  }

  const LEAKS = [
    { shape: 'a cache with no eviction',
      retains: 'the map, from a static field or a long-lived service object',
      tree: 'one object with an enormous retained size and thousands of children',
      fix: 'a bounded cache, or weak keys — 31.7' },
    { shape: 'a listener nobody deregisters',
      retains: 'the subject\'s subscriber list',
      tree: 'many short paths that all pass through one collection',
      fix: 'deregister in the same scope that registered, or hold subscribers weakly' },
    { shape: 'a thread-local on a pooled thread',
      retains: 'the thread object, which outlives every request',
      tree: 'a path whose root is a thread rather than a static',
      fix: 'clear it in a finally block; the pool will not do it for you' },
    { shape: 'a closure capturing its enclosing object',
      retains: 'one field you wanted, plus everything else the enclosing object holds',
      tree: 'a small object with a surprising retained size',
      fix: 'copy the field into a local before the closure captures it' }
  ];

  function paintLeaks() {
    root.jQuery('#dgn-leaks tbody').html(LEAKS.map(function (row) {
      return '<tr><td class="mono">' + row.shape + '</td><td>' + row.retains + '</td><td>' +
        row.tree + '</td><td>' + root.Helpers.escapeHtml(row.fix) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('dgn-leaks-caption',
      'Four shapes, and the third column is what each looks like in the tool rather than in '
      + 'the source. The last row is the one that surprises people: a lambda that reads one '
      + 'integer field of its enclosing object captures the whole object, so a small closure '
      + 'stored in a long-lived collection can retain a request, its response buffer and its '
      + 'database connection. Its own size is a few bytes and its retained size is megabytes, '
      + 'which is exactly the case sorting by shallow size cannot find.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

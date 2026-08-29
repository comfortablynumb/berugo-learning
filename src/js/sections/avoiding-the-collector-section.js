/**
 * Section: Avoiding the collector.
 *
 * Three programs computing 820, differing only in how many objects they build
 * on the way: 84 allocations, 3, and 1. The GC work behind them is 108 units,
 * 0 and 0. That is the section — the fastest collection is the one that has
 * nothing to collect, and the lever is the allocation rate rather than any
 * tuning flag.
 *
 * The answer is a column in the table rather than an assumption, because an
 * allocation-reduction that changes the result is not an optimisation. Every
 * row is run through the IR interpreter and the binding it produces is
 * printed next to its allocation count.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'avoiding-the-collector';
  const KINDS = ['heavy', 'pooled', 'light'];
  const COUNTS = [10, 20, 40, 60, 80];
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
      title: 'Diagram — an allocation site, and the three places it can end up',
      caption: 'Every allocation the compiler sees goes through this question. If the value '
        + 'never leaves the frame it can live on the stack, and if it is only ever read field '
        + 'by field it need not exist as an object at all — scalar replacement puts its fields '
        + 'in registers. Only what genuinely escapes reaches the heap, and only what reaches '
        + 'the heap is the collector\'s problem.',
      definition: [
        'graph TD',
        'A["allocation site"] --> E{"does the value escape the frame?"}',
        'E -->|"no, and only fields are<br/>read"| S["scalar replacement — registers"]',
        'E -->|"no, but it is used as an<br/>object"| K["stack allocation — the frame"]',
        'E -->|"returned, captured or<br/>stored"| H["the heap — the collector\'s problem"]',
        'H --> G["a header, a mark, a copy, a barrier"]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**The fastest collection is the one with nothing to collect, so allocation rate is the '
        + 'first thing to measure and the first thing to attack.** It is also measurable long '
        + 'before any tuning flag is worth touching, and it is a property of your code rather '
        + 'than of the runtime — which means you can change it.',
      '**Escape analysis is the compiler doing this for you, and it does more than you think '
        + 'and less than you hope.** An allocation whose value never leaves the frame can be '
        + 'put on the stack instead. The analysis in M29 reports the reason per allocation, '
        + 'because "returned" is exact and "passed to a call" is conservative, and only the '
        + 'second could be recovered by a better analysis.',
      '**Scalar replacement is the stronger version: do not allocate anything at all.** If an '
        + 'object is only ever read field by field and never passed anywhere as a whole, its '
        + 'fields can live in registers and the object never exists. This is why a small '
        + 'short-lived record in a hot loop often costs literally nothing.',
      '**Object pooling is the manual version and it is a genuine hazard.** You have '
        + 'reintroduced manual memory management: a pooled object handed back while somebody '
        + 'still holds it is a use-after-free with all the symptoms of one, and a pool that '
        + 'grows without bound is a leak the collector cannot help with. It also defeats the '
        + 'generational collector, because pooled objects are old and pointing at young ones.',
      '**Arenas are the honest version of the same idea, for phase-structured work.** Allocate '
        + 'everything for one request from one region and release the whole region at the end. '
        + 'There is no per-object bookkeeping and no fragmentation, and the constraint — '
        + 'nothing outlives the phase — is checkable at the point where it matters.',
      '**Off-heap buffers move the data out of the collector\'s reach entirely.** A typed array '
        + 'here, a `ByteBuffer` elsewhere: one object holding a million numbers is one object to '
        + 'trace, and a million boxed numbers is a million. The trade is that you are doing your '
        + 'own layout and your own lifetime management for that buffer.',
      '**Value types and flattening are the language-level fix, and they are the one that '
        + 'scales.** An array of a hundred thousand points as objects is a hundred thousand '
        + 'headers, a hundred thousand pointer chases and a hundred thousand things to mark; as '
        + 'flattened values it is one allocation. This is why every major managed language is '
        + 'working on value types.',
      '**And the discipline that makes all of it safe: the answer must not move.** Every row in '
        + 'the comparison prints what the program computed alongside what it allocated. An '
        + 'allocation reduction that changes the result is not an optimisation, and the only '
        + 'way to know is to check rather than to reason.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: { title: 'Interactive demo — the same answer at three allocation rates',
        markup: root.AvoidTemplate.render() },
      diagram: diagram(),
      insight: '**The fastest collection is the one that has nothing to collect; allocation '
        + 'rate is the metric to attack first, and it is measurable long before any GC tuning '
        + 'flag is worth touching.** The demo makes the case in its bluntest possible form: '
        + 'three programs, one answer, 84 allocations against 1, and the collector work behind '
        + 'them going from 108 units to zero. No flag, no collector choice and no heap size '
        + 'would have produced that. What is worth internalising beyond the obvious is the '
        + 'ORDER of the levers. Escape analysis is free and already running, so the first '
        + 'question is not "how do I allocate less" but "which of my allocations does the '
        + 'compiler already remove, and why not the others" — and the analysis will tell you, '
        + 'per site, with a reason. Restructuring so a value stops escaping is often a small '
        + 'change with a large effect, and it is a change the profiler will point you at. '
        + 'Pooling comes much later and it is the one to be suspicious of: it reintroduces '
        + 'manual lifetimes, with use-after-free available again, and it makes every pooled '
        + 'object old and pointing at young ones, which is precisely the shape a generational '
        + 'collector charges a write barrier for. Teams routinely adopt a pool, measure a win '
        + 'on a microbenchmark, and then find the barrier traffic has eaten it in production. '
        + 'The last lever, and the only one that scales without hazards, is not allocating '
        + 'objects at all: flat arrays, value types and off-heap buffers turn a million things '
        + 'to trace into one.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });
    panel = root.ControlPanel.mount({
      controls: root.AvoidTemplate.controls,
      onChange: function () { update(); }
    });
    update();
  }

  /* ------------------------------------------------------------ measuring */

  const studyFor = root.Helpers.memoise(function (key) {
    const parts = JSON.parse(key);
    const sources = root.AvoidTemplate.sources(parts[0]);

    return KINDS.map(function (kind) { return oneProgram(kind, sources[kind], parts[1]); });
  });

  function oneProgram(kind, source, collector) {
    const trace = root.HeapSim.record(source, {});
    const lowered = root.Berugo.IrLower.compile(source);
    const run = root.Berugo.IrInterp.run(lowered.program, {});
    const gc = root.GcLab.replay(trace, { mode: collector, capacity: 1024,
      nursery: 320, candidates: 8 });

    return { kind: kind, source: source, trace: trace,
      escape: root.Berugo.Interproc.escapeProgram(lowered.program),
      answer: answerOf(run), gc: gc };
  }

  function answerOf(run) {
    const row = (run.bindings || []).filter(function (text) {
      return text.indexOf('r = ') === 0;
    })[0];

    return row ? row.slice(4) : '—';
  }

  const sweepFor = root.Helpers.memoise(function (collector) {
    return COUNTS.map(function (count) {
      return { count: count, rows: studyFor(JSON.stringify([count, collector])) };
    });
  });

  function update() {
    const values = panel.values();
    const rows = studyFor(JSON.stringify([values['avc-count'], values['avc-collector']]));
    const chosen = rows.find(function (row) { return row.kind === values['avc-program']; });

    paintChart(sweepFor(values['avc-collector']));
    paintMetrics(rows, chosen);
    paintSource(chosen);
    paintCompare(rows, values['avc-program']);
    paintSites(chosen);
    paintEscape(chosen);
    paintLevers();
  }

  function paintChart(sweep) {
    if (chart && chart.destroy) chart.destroy();
    chart = root.GrowthPlot.render(document.getElementById('avc-chart'), {
      series: KINDS.map(function (kind, index) {
        return { label: root.AvoidTemplate.NAMES[kind], color: root.Palette.series(index),
          dots: true,
          points: sweep.map(function (entry) {
            const row = entry.rows.find(function (item) { return item.kind === kind; });

            return { x: entry.count, y: row.trace.allocations };
          }) };
      }),
      xLabel: 'iterations', yLabel: 'objects allocated',
      legendHost: document.getElementById('avc-legend'),
      summary: function () { return 'Allocations against loop length for three programs computing one answer.'; }
    });
    root.Helpers.setText('avc-chart-caption', chartCaption(sweep));
  }

  function chartCaption(sweep) {
    const last = sweep[sweep.length - 1];
    const heavy = last.rows[0];
    const light = last.rows[2];

    return 'The allocation-heavy programme\'s line has a slope and the other two are flat. At '
      + last.count + ' iterations that is ' + heavy.trace.allocations + ' objects against ' +
      light.trace.allocations + '. Slope is the thing to look for in a real profile: a constant '
      + 'number of allocations is a fixed cost you can ignore, and a slope is a cost that grows '
      + 'with your traffic.';
  }

  function paintMetrics(rows, chosen) {
    const heavy = rows[0];
    const light = rows[2];
    const ratio = light.trace.allocations
      ? heavy.trace.allocations / light.trace.allocations : heavy.trace.allocations;
    const answers = rows.map(function (row) { return row.answer; });
    const agree = answers.every(function (value) { return value === answers[0]; });

    root.MetricGrid.update({
      'avc-allocs': { value: heavy.trace.allocations + ' vs ' + light.trace.allocations,
        note: ratio.toFixed(1) + ' times fewer, for the same answer' },
      'avc-gcwork': { value: heavy.gc.gcWork - light.gc.gcWork,
        note: heavy.gc.gcWork + ' units become ' + light.gc.gcWork },
      'avc-stack': { value: chosen.escape.stack + ' of ' + chosen.escape.allocations,
        note: chosen.escape.escaping + ' escape, and the reason is per allocation' },
      'avc-answer': { value: answers[0],
        note: agree ? 'all three programmes agree' : 'THEY DISAGREE — one of them is wrong' }
    });
  }

  function paintSource(chosen) {
    root.jQuery('#avc-source').text(chosen.source);
    root.Helpers.setText('avc-source-caption',
      root.AvoidTemplate.NAMES[chosen.kind] + '. ' + chosen.trace.allocations +
      ' allocations over ' + chosen.trace.steps + ' instructions, ' + chosen.trace.bytes +
      ' bytes, answer ' + chosen.answer + '.');
  }

  function paintCompare(rows, chosen) {
    root.jQuery('#avc-compare tbody').html(rows.map(function (row) {
      return '<tr' + (row.kind === chosen ? ' class="row-current"' : '') +
        '><td class="mono">' + root.AvoidTemplate.NAMES[row.kind] + '</td><td class="mono">' +
        row.answer + '</td><td class="mono">' + row.trace.allocations + '</td><td class="mono">' +
        row.trace.bytes + '</td><td class="mono">' + row.gc.collections +
        '</td><td class="mono">' + row.gc.gcWork + '</td><td class="mono">' +
        row.gc.throughput.toFixed(3) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('avc-compare-caption', compareCaption(rows));
  }

  function compareCaption(rows) {
    const heavy = rows[0];
    const pooled = rows[1];
    const light = rows[2];

    return 'The answer column is the first one to read and the reason it is there: an '
      + 'allocation reduction that changes the result is not an optimisation. All three '
      + 'compute ' + heavy.answer + '. The middle row is the interesting one — it keeps the '
      + 'record type and builds one instead of one per iteration, going from ' +
      heavy.trace.allocations + ' allocations to ' + pooled.trace.allocations + ' with the loop '
      + 'body otherwise unchanged. That is usually the shape of a real fix: not "stop using '
      + 'objects" but "stop building one per iteration". The last row removes the type '
      + 'entirely for ' + light.trace.allocations + '.';
  }

  function paintSites(chosen) {
    const total = chosen.trace.bytes || 1;

    root.jQuery('#avc-sites tbody').html(chosen.trace.sites.map(function (site) {
      return '<tr><td class="mono">' + root.Helpers.escapeHtml(site.site) +
        '</td><td class="mono">' + root.Helpers.escapeHtml(site.origin || '—') +
        '</td><td class="mono">' + site.count + '</td><td class="mono">' + site.bytes +
        '</td><td class="mono">' + ((site.bytes / total) * 100).toFixed(1) + '%</td></tr>';
    }).join(''));

    root.Helpers.setText('avc-sites-caption',
      'Every allocation attributed to the instruction that made it and the construct that '
      + 'instruction came from — the span M28 attached at the parser and M29 and M30 carried '
      + 'through every pass. This table is what an allocation profiler shows you, and the '
      + 'reason it is worth having is that the fix is almost always at one or two rows of it '
      + 'rather than spread across the program.');
  }

  const ACTIONS = {
    'never leaves this frame': 'allocate it on the frame, or replace it with registers',
    returned: 'nothing — it has to outlive the frame',
    'captured by a closure': 'nothing here; the closure would have to be stack-allocated too',
    'stored into another object': 'nothing — its lifetime is now the other object\'s'
  };

  function paintEscape(chosen) {
    const rows = [];

    chosen.escape.functions.forEach(function (fn) {
      fn.allocations.forEach(function (row) { rows.push({ fn: fn.fn, row: row }); });
    });
    root.jQuery('#avc-escape tbody').html(rows.map(function (entry) {
      return '<tr><td class="mono">' + entry.fn + '</td><td class="mono">' + entry.row.op +
        ' → ' + entry.row.register + '</td><td class="mono">' +
        (entry.row.escapes ? 'yes' : 'no') + '</td><td>' +
        root.Helpers.escapeHtml(entry.row.why) + '</td><td>' + actionFor(entry.row) +
        '</td></tr>';
    }).join('') || '<tr><td colspan="5">this programme allocates nothing the analysis can '
      + 'see</td></tr>');

    root.Helpers.setText('avc-escape-caption', escapeCaption(chosen));
  }

  function actionFor(row) {
    if (ACTIONS[row.why]) return ACTIONS[row.why];
    return 'nothing yet — an interprocedural summary could decide this';
  }

  function escapeCaption(chosen) {
    return chosen.escape.stack + ' of ' + chosen.escape.allocations + ' allocations never '
      + 'leave their frame and could be removed by the compiler without anybody asking. The '
      + 'reason column is what makes this table actionable rather than a score: "returned" is '
      + 'exact and there is nothing to do about it, and "passed to a call, which this analysis '
      + 'cannot see into" is a conservative answer that a better analysis would improve. '
      + 'Collapsing those two into one number gives you something nobody can act on, which is '
      + 'the same discipline M29 applied when it built this pass.';
  }

  const LEVERS = [
    { name: 'let escape analysis do it',
      removes: 'allocations that never leave their frame',
      costs: 'nothing — it is already running',
      backfires: 'never, but it gives up at a call boundary, so it may do less than you expect' },
    { name: 'stop building one object per iteration',
      removes: 'the slope of the allocation curve',
      costs: 'a slightly less elegant loop',
      backfires: 'when the accumulation genuinely needs to be immutable' },
    { name: 'flatten to arrays of primitives',
      removes: 'one header and one pointer chase per element',
      costs: 'manual indexing, and the layout is now your problem',
      backfires: 'when the elements are polymorphic or variable-sized' },
    { name: 'arena per phase',
      removes: 'all per-object bookkeeping within a request',
      costs: 'a constraint: nothing may outlive the phase',
      backfires: 'the moment something does, and it is a use-after-free' },
    { name: 'object pool',
      removes: 'allocations, and the collector\'s ability to help you',
      costs: 'manual lifetimes, plus write-barrier traffic on every pooled object',
      backfires: 'on release-while-held, on unbounded growth, and on generational collectors' }
  ];

  function paintLevers() {
    root.jQuery('#avc-levers tbody').html(LEVERS.map(function (row) {
      return '<tr><td class="mono">' + row.name + '</td><td>' + row.removes + '</td><td>' +
        root.Helpers.escapeHtml(row.costs) + '</td><td>' +
        root.Helpers.escapeHtml(row.backfires) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('avc-levers-caption',
      'The order is deliberate and the last row is last for a reason. A pool makes every object '
      + 'in it old and long-lived, so every store of a young object into a pooled one is an '
      + 'old-to-young pointer that the write barrier in 31.4 has to record — which is a cost '
      + 'that does not appear in the microbenchmark where the pool was justified and does '
      + 'appear in production.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

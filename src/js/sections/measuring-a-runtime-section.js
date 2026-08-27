/**
 * Section: Measuring a language runtime.
 *
 * The measurement is a protocol rather than a number. Warm-up runs are
 * executed and discarded, the sample is what follows, and the reported figure
 * is a median with its spread and its run count attached — because a single
 * timing on a tiered runtime is a sample from whichever tier happened to be
 * running.
 *
 * The second is the naive column, which reproduces the classic mistakes and
 * prints what they produce. That is the only convincing argument that they
 * are mistakes: two numbers for the same work, differing by more than the
 * thing being compared.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'measuring-a-runtime';
  let panel = null;
  let chart = null;
  let application = null;

  const LIES = [
    { mistake: 'One run', instead: 'one sample from a distribution nobody looked at',
      fix: 'run several and report the median with the spread' },
    { mistake: 'Warm-up counted in the average',
      instead: 'mostly the compiler, on a program that had not been compiled yet',
      fix: 'run the warm-up and throw it away before sampling' },
    { mistake: 'The result discarded',
      instead: 'nothing — an optimiser is entitled to delete work nobody observes',
      fix: 'consume the result and report something derived from it' },
    { mistake: 'Constant inputs',
      instead: 'constant folding, because the compiler can see the whole computation',
      fix: 'make the input opaque, or scale it and check the cost scales' },
    { mistake: 'Compile time inside the timed region',
      instead: 'the compiler and the program added together, in unknown proportion',
      fix: 'time the compilation separately and report both' },
    { mistake: 'Wall clock on a machine you do not control',
      instead: 'the other tabs, the scheduler and the thermal state of somebody else\'s laptop',
      fix: 'report a deterministic unit — here, dispatches — beside the milliseconds' }
  ];

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — a measurement protocol for a JIT-compiled runtime',
      caption: 'Every arrow here is a rule somebody broke to publish a number that meant '
        + 'nothing. Run the workload until the tiers have settled and throw those runs away. '
        + 'Sample repeatedly. Report the middle of the distribution with its spread and the '
        + 'number of runs. Consume the result so nothing can be deleted for being unobserved. '
        + 'And report a deterministic unit beside the clock, because a millisecond on your '
        + 'machine is not a millisecond on anyone else\'s.',
      definition: [
        'flowchart TD',
        'A["choose a workload whose cost scales with its input"] --> B["warm up — run and discard"]',
        'B --> C["sample — run N times, keeping every result"]',
        'C --> D["report the median, the spread and N"]',
        'C --> E["report compile time separately"]',
        'D --> F["and a deterministic unit beside the clock"]',
        'E --> F'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**A single timing is not a measurement, and a benchmark harness that prints one is '
        + 'lying by omission.** The number has a distribution behind it — scheduler noise, '
        + 'cache state, which tier happened to be running — and reporting the middle of that '
        + 'distribution with its spread is the minimum that lets anybody else evaluate the '
        + 'claim.',
      '**Warm-up is a real phase, not noise to be averaged away.** On a tiered runtime the '
        + 'first thousand iterations run in the interpreter, the next in the baseline tier, and '
        + 'the rest in optimised code. Those are three different programs. Averaging over all '
        + 'three produces a figure that describes none of them, and the right answer is to '
        + 'report warm-up and steady state as two numbers.',
      '**Compile time and run time are different costs and belong in different columns.** A '
        + 'runtime that compiles aggressively wins on a long run and loses on a short one, and '
        + 'a single "time to complete" figure hides which of those you are looking at. That is '
        + 'the same latency-against-quality trade the register allocator made in 30.4.',
      '**Memory is a first-class metric and is usually missing.** Two runtimes with the same '
        + 'throughput and a fourfold difference in peak resident memory are not comparable, and '
        + 'the one that allocates more will lose on a machine with other things running — which '
        + 'is every machine.',
      '**A microbenchmark whose result is discarded measures nothing, because an optimiser may '
        + 'delete it.** This is the classic pathology and it is not hypothetical: the whole '
        + 'loop is dead code if nothing observes the value. Consume the result, report '
        + 'something derived from it, and the work has to happen.',
      '**Constant inputs get folded, and then you are timing the fold.** If the compiler can '
        + 'see every input, it can compute the answer once. The demo\'s scaling table is the '
        + 'check: if the cost does not grow with the input, the benchmark is measuring the '
        + 'harness rather than the work.',
      '**A deterministic unit belongs beside the clock.** A dispatch count is a real measure of '
        + 'interpreter work, it is reproducible on any machine, and it is what makes a claim '
        + 'checkable by somebody else. Milliseconds are what the user experiences and are not '
        + 'transferable; report both.',
      '**The comparison has to be against the same answer.** Every mode in this milestone is '
        + 'checked against the IR interpreter on value, output, outcome and every binding '
        + 'before any timing is reported. A faster mode that computes something else is not '
        + 'faster, and the differential column is what stops that being an easy mistake to '
        + 'make.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: { title: 'Interactive demo — a bake-off, and the same numbers measured badly',
        markup: root.MeasureTemplate.render() },
      diagram: diagram(),
      insight: '**Most published language benchmarks measure warm-up, allocation or the '
        + 'benchmark harness, and the discipline in this section is more transferable than '
        + 'anything else in the milestone.** The compiler techniques here apply when you are '
        + 'writing a compiler. The measurement rules apply every time anybody claims one thing '
        + 'is faster than another, which is constantly. The pattern to internalise is that '
        + 'each rule exists because of a specific way the system under test can defeat you: '
        + 'the optimiser deletes work you do not observe, the tiering means the first runs are '
        + 'a different program, constant inputs let the compiler do your work at compile time, '
        + 'and a single sample hides a distribution you never looked at. None of those is '
        + 'exotic and all of them are silent — the benchmark runs, prints a number, and the '
        + 'number is confidently wrong. So the useful habit is not memorising the list, it is '
        + 'the question underneath it: what could make this number come out right for a reason '
        + 'that has nothing to do with what I am measuring? Ask that of a benchmark, of a '
        + 'green test suite, and of a passing oracle, and it is the same question every '
        + 'milestone here has been asking.'
    };
  }

  function render(app) {
    application = app;
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });
    panel = root.ControlPanel.mount({
      controls: root.MeasureTemplate.controls,
      onChange: function () { update(); }
    });
    update();
  }

  /* ------------------------------------------------------------ measuring */

  function sourceOf(id) {
    const entry = root.ExecLab.BENCHMARKS.find(function (row) { return row.id === id; });

    return entry ? entry.source : root.ExecLab.BENCHMARKS[0].source;
  }

  const benchFor = root.Helpers.memoise(function (key) {
    const parts = JSON.parse(key);
    const source = sourceOf(parts[0]);
    const options = { warmup: parts[1], runs: parts[2], budget: 4000000 };

    return { rows: ['ir', 'stack', 'register', 'jit'].map(function (mode) {
      return root.ExecLab.bench(source, mode, options);
    }),
    naive: ['ir', 'stack', 'register', 'jit'].map(function (mode) {
      return root.ExecLab.naiveBench(source, mode, options);
    }) };
  });

  const dispatchFor = root.Helpers.memoise(function () {
    return root.ExecLab.dispatchTable({ budget: 4000000 });
  });

  const scalingFor = root.Helpers.memoise(function () {
    return root.ExecLab.scaling([25, 50, 100, 200, 400], { budget: 8000000 });
  });

  const suiteFor = root.Helpers.memoise(function () {
    return root.ExecLab.suite({ budget: 400000 });
  });

  function update() {
    const values = panel.values();
    const key = JSON.stringify([values['mr-benchmark'], Number(values['mr-warmup']),
      Number(values['mr-runs'])]);
    const bench = benchFor(key);

    paintChart(values['mr-benchmark']);
    paintMetrics(bench, values['mr-benchmark']);
    paintBench(bench, Boolean(values['mr-naive']));
    paintDispatch();
    paintScaling();
    paintLies();
    paintSuite();
  }

  function paintChart(id) {
    const table = dispatchFor();
    const entry = table.find(function (row) { return row.id === id; }) || table[0];

    if (chart && chart.chart) chart.chart.destroy();
    chart = root.BytecodeView.bars(document.getElementById('mr-chart'), {
      lazyLib: application.lazyLib, series: ['dispatches', 'compiled'],
      rows: entry.rows.map(function (row) {
        return { label: row.mode, dispatches: row.dispatches, compiled: row.compiled };
      }),
      summary: 'Total dispatches in blue and the ones that ran in compiled code in amber.' });

    root.Helpers.setText('mr-chart-caption',
      'Dispatches rather than milliseconds, because a dispatch is deterministic and '
      + 'reproducible on any machine. The amber bar is the part of the run that happened in '
      + 'compiled code — which is what a tiering policy is trying to maximise, and it is zero '
      + 'for both interpreters by definition.');
  }

  function paintMetrics(bench, id) {
    const register = bench.rows[2];
    const table = dispatchFor();
    const entry = table.find(function (row) { return row.id === id; }) || table[0];
    const scaling = scalingFor();
    const flat = scaling.every(function (row) {
      return Math.abs(row.perItem - scaling[0].perItem) < 0.5;
    });

    root.MetricGrid.update({
      'mr-median': { value: register.median.toFixed(3) + ' ms',
        note: 'median of ' + register.runs + ' runs, after ' + register.warmup + ' discarded' },
      'mr-spread': { value: register.spread.toFixed(3) + ' ms',
        note: 'worst minus best across the sample' },
      'mr-dispatches': { value: entry.rows[1].dispatches,
        note: 'the register VM on this benchmark; the same on every machine' },
      'mr-scales': { value: flat ? 'yes' : 'NO',
        note: flat ? 'cost per iteration is flat across a 16× change in input, so the loop '
          + 'really is doing the work'
          : 'cost per iteration moves with the input, which means something else is dominating' }
    });
  }

  function paintBench(bench, showNaive) {
    const rows = bench.rows.map(function (row, at) {
      return { row: row, naive: bench.naive[at] };
    });

    root.jQuery('#mr-bench tbody').html(rows.map(function (entry) {
      return benchRow(entry.row, false) + (showNaive ? benchRow(entry.naive, true) : '');
    }).join(''));

    root.Helpers.setText('mr-bench-caption', benchCaption(bench, showNaive));
  }

  function benchRow(row, naive) {
    const label = row.mode + (naive ? ' — measured naively' : '');

    return '<tr><td class="mono">' + label + '</td><td class="mono">' +
      row.median.toFixed(3) + '</td><td class="mono">' +
      (row.best === null ? '—' : row.best.toFixed(3)) + '</td><td class="mono">' +
      (row.worst === null ? '—' : row.worst.toFixed(3)) + '</td><td class="mono">' +
      (row.spread === null ? '—' : row.spread.toFixed(3)) + '</td><td class="mono">' +
      row.runs + '</td><td class="mono">' + row.warmup + '</td></tr>';
  }

  function benchCaption(bench, showNaive) {
    const spread = bench.rows.reduce(function (most, row) {
      return Math.max(most, row.spread);
    }, 0);

    return 'Every figure carries its run count and its warm-up, which is the minimum for '
      + 'anybody else to evaluate it. The widest spread here is ' + spread.toFixed(3)
      + ' ms — compare that against the differences between modes before believing any of '
      + 'them.' + (showNaive ? ' The naive rows are the same work measured with one run, the '
        + 'warm-up counted and the result discarded; they are a different number for the same '
        + 'program, and on a tiered runtime they are mostly the compilation that never '
        + 'finished.' : '');
  }

  function paintDispatch() {
    const rows = dispatchFor();

    root.jQuery('#mr-dispatch tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + row.id + '</td><td class="mono">' +
        row.rows[0].dispatches + '</td><td class="mono">' + row.rows[1].dispatches +
        '</td><td class="mono">' + row.rows[2].dispatches + '</td><td class="mono">' +
        (row.rows[2].share * 100).toFixed(1) + '%</td><td class="mono">' +
        row.ratio.toFixed(2) + '×</td></tr>';
    }).join(''));

    root.Helpers.setText('mr-dispatch-caption',
      'The same four benchmarks in a unit that does not depend on this machine. The last '
      + 'column is the stack-against-register ratio 30.1 argued about, measured on running '
      + 'programs rather than on static instruction counts — and it is close to 2 on every '
      + 'one, which is the figure Lua reported when it made the same change.');
  }

  function paintScaling() {
    const rows = scalingFor();

    root.jQuery('#mr-scaling tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + row.size + '</td><td class="mono">' + row.dispatches +
        '</td><td class="mono">' + row.perItem.toFixed(2) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('mr-scaling-caption',
      'The same loop at five input sizes. A flat last column means the cost really is per '
      + 'iteration and the benchmark is measuring the loop; a column that falls as the input '
      + 'grows means a fixed cost is dominating and the benchmark is measuring the harness. '
      + 'This check takes four lines and catches the commonest way a microbenchmark lies.');
  }

  function paintLies() {
    root.jQuery('#mr-lies tbody').html(LIES.map(function (row) {
      return '<tr><td class="mono">' + root.Helpers.escapeHtml(row.mistake) + '</td><td>' +
        root.Helpers.escapeHtml(row.instead) + '</td><td>' +
        root.Helpers.escapeHtml(row.fix) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('mr-lies-caption',
      LIES.length + ' mistakes, and the middle column is why each one is silent. None of them '
      + 'makes the benchmark fail — it runs, it prints a number, and the number is confidently '
      + 'about something else. That is what makes measurement a discipline rather than a step: '
      + 'nothing in the output tells you which of these you have made.');
  }

  function paintSuite() {
    const suite = suiteFor();

    root.jQuery('#mr-suite tbody').html(suite.rows.map(function (row) {
      return '<tr><td class="mono">' + row.id + '</td><td>' + row.modes.stack + '</td><td>' +
        row.modes.register + '</td><td>' + row.modes.jit + '</td><td>' + row.modes.wasm +
        '</td><td>' + root.Helpers.escapeHtml(row.why || '') + '</td></tr>';
    }).join(''));

    root.Helpers.setText('mr-suite-caption',
      suite.checks + ' comparisons across ' + suite.programs + ' programs and four back ends, '
      + 'with ' + suite.disagreements + ' disagreements and ' + suite.unsupported
      + ' outside the WebAssembly subset. This table comes before any timing in the section, '
      + 'and that order is deliberate: a mode that computes something else is not faster, and '
      + 'the only way that stays true is to check it first.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

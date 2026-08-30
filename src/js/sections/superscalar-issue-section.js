/**
 * Section: Superscalar issue.
 *
 * The width-explorer curve, and the part that makes it worth drawing: the
 * reason each program stopped rising is named rather than assumed. There are
 * four possible answers and the demo distinguishes them, because "wider did
 * not help" is a useless observation and "wider did not help because there are
 * two integer ports and this code is all integer arithmetic" is an action.
 *
 * The classification is deliberately conservative. A measured IPC at the
 * dependence bound from 36.1 is the code's own limit and nothing else needs
 * saying; a machine that is still getting faster at twice the width has not
 * saturated at all; and only when neither of those holds does the top-down
 * category and the port histogram get to have an opinion.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'superscalar-issue';
  const Lab = root.OooLab;
  const Table = root.DataTable;
  const View = root.OooView;
  const Ilp = root.IlpAnalysis;
  const WIDTHS = [1, 2, 4, 8];
  const CURVES = ['chain', 'independent', 'stride', 'factorial', 'strlen'];
  let panel = null;
  let chart = null;

  /**
   * What the wakeup and select logic costs. The quadratic row is the one that
   * ended the width race: every ready entry has to be compared against every
   * issue slot, so doubling the width roughly quadruples the select network
   * while the returns are already flattening.
   */
  const COST = [
    { structure: 'wakeup: tag comparators', grows: 'window x width', four: '128 comparisons',
      eight: '256 comparisons',
      why: 'every result broadcast has to reach every waiting entry in one cycle' },
    { structure: 'select: the priority encoder', grows: 'window x width, and deeper',
      four: 'pick 4 of 32', eight: 'pick 8 of 32',
      why: 'the pick must finish in time for the chosen instructions to read operands' },
    { structure: 'register file ports', grows: '2 read + 1 write per slot',
      four: '8 read, 4 write', eight: '16 read, 8 write',
      why: 'file area grows with the square of the port count' },
    { structure: 'bypass network', grows: 'width squared', four: '16 paths',
      eight: '64 paths',
      why: 'every producer must reach every consumer in the cycle after it finishes' },
    { structure: 'front end: fetch and decode', grows: 'linearly, until a branch',
      four: '4 instructions', eight: '8 instructions',
      why: 'a taken branch ends the fetch block, and blocks average fewer than 8 instructions' }
  ];

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  /* ------------------------------------------------------- the classifier */

  function peakIssue(name, width) {
    return View.issueProfile(Lab.run(name, { width: width }).core)
      .reduce(function (most, row) { return Math.max(most, row.issued); }, 0);
  }

  /**
   * Why this configuration stopped going faster.
   *
   * Order matters: the code's own bound first, because nothing about the
   * machine is interesting once it is reached; then whether widening still
   * helps at all; and only then the machine's own accounting.
   */
  function limitFor(name, width) {
    const found = Lab.summary(name, { width: width });
    const bound = Lab.ilp(name, { unitLatency: true }).ilp;

    if (Ilp.respects(found.ipc, bound)) return 'the dependence chain — the code has no more';
    const wider = Lab.summary(name, { width: width * 2 });

    if (wider.cycles < found.cycles) {
      return 'nothing yet — width ' + (width * 2) + ' is still faster';
    }
    return saturated(name, width, found);
  }

  function saturated(name, width, found) {
    const peak = peakIssue(name, width);
    const dominant = Lab.topdown(name, { width: width }).dominant;

    if (peak < width) {
      return 'the ports — never more than ' + peak + ' issued in a cycle at width ' + width;
    }
    return dominant.name + (dominant.detail.length
      ? ': ' + dominant.detail[0].reason : '');
  }

  /* ------------------------------------------------------------- the frame */

  function diagram() {
    return {
      title: 'Diagram — the wakeup and select loop, which happens every cycle',
      caption: 'Both halves are on the machine\'s critical path and both get more expensive '
        + 'as the window and the width grow. Wakeup compares one broadcast tag against every '
        + 'waiting entry; select picks the oldest ready instructions that have a free port, '
        + 'and the pick has to finish in time for them to read their operands in the same '
        + 'cycle. Doubling the width roughly quadruples the select network, which is why '
        + 'practical widths stopped at four to six long before the returns reached zero.',
      definition: [
        'flowchart TD',
        '    RES["a result finishes"] -->|"broadcast its tag"| WAKE["wakeup: every entry compares"]',
        '    WAKE --> READY["the ready set"]',
        '    READY --> SEL["select: oldest first"]',
        '    SEL --> PORT{"is a port free<br/>for this kind?"}',
        '    PORT -->|"yes"| ISSUE["issue, and mark the port busy"]',
        '    PORT -->|"no"| CONF["port conflict: wait a cycle"]',
        '    ISSUE --> RES',
        '    CONF --> READY'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**Issue width is how many instructions the machine may start in one cycle, and it is '
        + 'not the same as how many it does.** The demo runs the same program at widths 1 to '
        + '8 and reports the cycle count, the IPC and — the part that matters — what stopped '
        + 'it rising. There are only four possible answers and they call for completely '
        + 'different responses.',
      '**Answer one: the code has no more parallelism.** `chain` takes 38 cycles at every '
        + 'width from 1 to 8, and its dependence bound from 36.1 is 1.00. A wider machine '
        + 'cannot start an instruction whose operand does not exist yet, so the width control '
        + 'does nothing at all and the only fix is in the source.',
      '**Answer two: the ports.** `independent` goes from 37 cycles at width 1 to 21 at width '
        + '2 and then stops dead, while its bound is 32.00 — there is parallelism going '
        + 'begging. The issue histogram says why: exactly two instructions issue in every '
        + 'issuing cycle and never three, because the machine has two integer ports and this '
        + 'program is nothing but integer arithmetic.',
      '**Answer three: the front end.** A machine can only issue what has been fetched, '
        + 'decoded and dispatched. A taken branch ends a fetch block, and basic blocks in real '
        + 'code average well under eight instructions, so a fetch unit eight wide spends much '
        + 'of its time delivering four. This is the reason the µop cache and the loop buffer '
        + 'exist: both of them are ways to keep feeding a wide back end past a branch.',
      '**Answer four: the back end is full.** The reorder buffer, the issue queue, the '
        + 'physical register file or the load/store queue has no room, and dispatch stops '
        + 'whatever the width is. On `stride` this is the answer from width 2 onwards, and the '
        + 'stall reason names the structure.',
      '**The cost of width grows faster than the benefit, and that is the whole history.** '
        + 'Wakeup compares a broadcast tag against every entry in the window; select is a '
        + 'priority encoder over the ready set; the bypass network grows with the square of '
        + 'the width. Doubling from four to eight roughly quadruples the select logic on a '
        + 'curve that has already flattened, which is why the industry stopped widening and '
        + 'started adding cores.',
      '**Latency and occupancy are different numbers and confusing them halves the '
        + 'machine.** A port\'s latency is when its result appears; its initiation interval is '
        + 'when it can accept the next instruction. A fully pipelined unit takes one per cycle '
        + 'however long the result takes. This simulator conflated them at first — every port '
        + 'was blocked for its full latency — and the visible symptom was a machine that '
        + 'saturated at an IPC near one whatever the width, which is a true statement about '
        + 'the model and a false one about processors.',
      '**Nobody gets the speed-up the width promises, and the gap is the interesting part.** '
        + 'Across the twelve programs here, going from width 1 to width 8 is worth between 1.00x '
        + '(`chain`) and 2.37x (`alias`) — never close to eight. Quoting the width as though '
        + 'it were a speed-up is the same error as quoting IPC without the clock period, which '
        + 'M34.6 spent a section on.',
      '**The curve is the most useful picture in the milestone because of where it '
        + 'flattens.** The knee tells you which of the four answers applies to your code, and '
        + 'therefore whether the next thing to change is the algorithm, the data layout, the '
        + 'branch structure or nothing at all.'
    ];
  }

  function insight() {
    return '**"We made it wider and it did not get faster" is one of the most common '
      + 'performance results there is, and it is almost never a mystery — it is four '
      + 'distinct situations that happen to produce the same graph.** The code has no '
      + 'parallelism; the parallelism exists but one resource is saturated; the work is not '
      + 'arriving fast enough; or something downstream is full and refusing it. Those four '
      + 'want opposite responses — rewrite the algorithm, add units, fix the feed, enlarge '
      + 'the buffer — and picking the wrong one is how teams spend a quarter on an '
      + 'optimisation that could not have worked. What makes the processor version worth '
      + 'studying is that all four are visible in one instrument, and the discipline '
      + 'transfers exactly: a thread pool that does not speed up with more threads, a '
      + 'pipeline stage that does not speed up with more workers, a database that does not '
      + 'speed up with more connections. In every case the same four questions apply in the '
      + 'same order, and the first one is the one people skip: is there any parallelism in '
      + 'this work at all? Compute the bound first. The other three questions are only worth '
      + 'asking once the answer to that one is yes.';
  }

  function config() {
    return { sectionId: SECTION_ID, orientation: orientation(),
      demo: { title: 'Interactive demo — the width curve, and why it flattens',
        markup: root.WidthTemplate.render() },
      diagram: diagram(), insight: insight() };
  }

  /* ------------------------------------------------------------- plumbing */

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });
    panel = root.ControlPanel.mount({ controls: root.WidthTemplate.controls(),
      onChange: function () { update(app); } });
    update(app);
  }

  function reading() {
    const values = panel.values();
    const width = Number(values['wid-width']);
    const options = { width: width, queueSize: Number(values['wid-queue']) };

    return { name: values['wid-program'], width: width, options: options,
      run: Lab.run(values['wid-program'], options),
      found: Lab.summary(values['wid-program'], options) };
  }

  function update(app) {
    const view = reading();

    paintMetrics(view);
    paintPorts(view);
    paintSweep(view);
    paintHistogram(view);
    paintAll();
    paintCost();
    paintChart(app, view);
  }

  function paintMetrics(view) {
    const profile = View.issueProfile(view.run.core);
    const peak = profile.reduce(function (most, row) {
      return Math.max(most, row.issued);
    }, 0);
    const idle = profile.filter(function (row) { return row.issued === 0; })[0];
    const bound = Lab.ilp(view.name, { unitLatency: true }).ilp;

    root.MetricGrid.update({
      'wid-cycles': { value: view.found.cycles,
        note: view.found.retired + ' instructions retired' },
      'wid-ipc': { value: view.found.ipc.toFixed(3),
        note: 'at issue width ' + view.width },
      'wid-bound': { value: bound.toFixed(2),
        note: (bound / Math.max(view.found.ipc, 1e-9)).toFixed(2) + 'x above the measurement' },
      'wid-peak': { value: peak,
        note: peak < view.width ? 'never reached the width of ' + view.width
          : 'the width was reached at least once' },
      'wid-idle': { value: idle ? idle.cycles : 0,
        note: idle ? (100 * idle.share).toFixed(1) + '% of cycles issued nothing at all'
          : 'every cycle issued something' },
      'wid-limit': { value: limitFor(view.name, view.width).split(' —')[0],
        note: limitFor(view.name, view.width) }
    });
  }

  function paintPorts(view) {
    const ports = View.portUse(view.run.core);

    Table.paint('wid-ports', ports.map(function (port) {
      return [port.name, port.about, port.issued, port.issued + ' of ' +
        view.found.cycles + ' cycles', (100 * port.share).toFixed(1) + '%'];
    }), portCaption(view, ports));
  }

  function portCaption(view, ports) {
    const busiest = ports.slice().sort(function (left, right) {
      return right.share - left.share;
    })[0];

    return 'A port that is busy in most cycles is the reason a wider machine did not help, '
      + 'and here the busiest is ' + busiest.name + ' at '
      + (100 * busiest.share).toFixed(1) + '%. The mix is two integer units, one for memory '
      + 'and one for branches — every real machine\'s table has this shape and differs only '
      + 'in the counts, which is why an instruction mix that does not match the port mix '
      + 'leaves half the machine idle whatever the width says.';
  }

  function paintSweep(view) {
    const base = Lab.summary(view.name, { width: 1 });

    Table.paint('wid-sweep', WIDTHS.map(function (width) {
      const found = Lab.summary(view.name, { width: width });

      return [width, found.cycles, found.ipc.toFixed(3),
        (base.cycles / found.cycles).toFixed(2) + 'x', found.scheduler.portConflicts,
        found.dispatchStalls, limitFor(view.name, width)];
    }), 'The last column is the point of the table. "Wider did not help" is not a finding; '
      + '"wider did not help because two integer ports were already busy" is a decision about '
      + 'what to change next. Each row is classified in the same order: does the measurement '
      + 'already sit at the code\'s dependence bound, is a wider machine still faster, and '
      + 'only then what the machine\'s own accounting says.');
  }

  function paintHistogram(view) {
    Table.paint('wid-hist', View.issueProfile(view.run.core).map(function (row) {
      return [row.issued, row.cycles, (100 * row.share).toFixed(1) + '%'];
    }), 'The distribution behind the average. A machine four wide that issues two '
      + 'instructions in most of its working cycles is a machine two wide with extra logic, '
      + 'and the average IPC hides that completely. On `independent` the histogram has a '
      + 'single spike at two — never one, never three — which is what a hard port limit looks '
      + 'like and what no summary statistic would show.');
  }

  function paintAll() {
    Table.paint('wid-all', Lab.names().map(function (name) {
      const cells = WIDTHS.map(function (width) {
        return Lab.summary(name, { width: width }).cycles;
      });

      return [name].concat(cells).concat([(cells[0] / cells[3]).toFixed(2) + 'x',
        Lab.ilp(name, { unitLatency: true }).ilp.toFixed(2)]);
    }), 'Eight times the issue width buys between 1.00x and 2.37x across these twelve programs. '
      + 'That is the honest headline of superscalar execution and it has not changed in '
      + 'thirty years: width is cheap to specify and expensive to build, and almost no code '
      + 'converts it into speed at anything like the advertised rate. Comparing the last two '
      + 'columns tells you whether the shortfall is the code (a low bound) or the machine (a '
      + 'high one).');
  }

  function paintCost() {
    Table.paint('wid-cost', COST.map(function (row) {
      return [row.structure, row.grows, row.four, row.eight, row.why];
    }), 'Every row is on the critical path of a single cycle, which is what makes width '
      + 'expensive in a way that, say, cache capacity is not. A bigger cache is slower to '
      + 'access and can be pipelined; a wider select loop has to complete inside one clock, '
      + 'so it eats directly into the frequency. That trade — width against clock — is the '
      + 'same one M35.8 measured for pipeline depth, and it has the same shape.');
  }

  function paintChart(app, view) {
    const host = root.jQuery('#wid-chart')[0];

    if (!host) return;
    if (chart) chart.destroy();
    chart = root.GrowthPlot.render(host, { lazyLib: app.lazyLib, height: 260,
      xLabel: 'issue width', yLabel: 'instructions per cycle',
      series: CURVES.map(function (name) {
        return { label: name, points: WIDTHS.map(function (width) {
          return { x: width, y: Lab.summary(name, { width: width }).ipc };
        }) };
      }) });
    root.Helpers.setText('wid-chart-note', 'Five programs, four widths. `chain` is a flat '
      + 'line at 0.868 — no width helps a dependence chain. `independent` jumps at width 2 '
      + 'and then flattens completely, because two integer ports is all there are. `strlen` '
      + 'is still climbing at width 8, which is the one case where building a wider machine '
      + 'would actually have paid. Three different shapes from one control, and the '
      + 'difference between them is the code rather than the processor.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

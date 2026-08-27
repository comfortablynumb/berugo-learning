/**
 * Section: Register allocation.
 *
 * The measurement is the pressure sweep: spills against the number of
 * machine registers, for both allocators on the same function. Graph
 * colouring spills less at every count and takes longer to say so, which is
 * the trade the section exists to make concrete rather than to assert.
 *
 * The second is the verifier. Both allocations are checked against a liveness
 * pass the allocator did not produce: at every program point, no two live
 * values may share a register. An allocator that is subtly wrong produces
 * code that runs and is occasionally wrong, and nothing but that check
 * notices — the same oracle discipline M29 applied to every analysis.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'register-allocation';
  let panel = null;
  let graphChart = null;
  let sweepChart = null;
  let application = null;

  const BASE = ['ssa', 'sccp', 'copy-propagation', 'dead-code'];

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — an interference graph with a spilled node',
      caption: 'Each node is a value and each edge says the two are live at the same time, so '
        + 'they cannot share a register. Colouring the graph with k colours IS allocating k '
        + 'registers, and a node whose degree is below k can always be coloured once '
        + 'everything else has been — which is the observation the whole algorithm is built on. '
        + 'The node left over when no such node remains is the spill candidate, and Briggs\'s '
        + 'contribution was to push it optimistically anyway: its neighbours often end up '
        + 'sharing colours, and then it fits after all.',
      definition: [
        'graph TD',
        'A["a — degree 2"] --- B["b — degree 3"]',
        'A --- C["c — degree 2"]',
        'B --- C',
        'B --- D["d — degree 3"]',
        'C --- D',
        'D --- E["e — spilled"]',
        'B --- E'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**A live range is the span between a value\'s definition and its last use, and two '
        + 'ranges that overlap cannot share a register.** That relation is the interference '
        + 'graph, and allocating k registers is colouring it with k colours. The reduction is '
        + 'exact, which is both the good news and the bad: graph colouring is NP-complete, so '
        + 'every real allocator is a heuristic.',
      '**Chaitin\'s algorithm is simplify, then select.** Repeatedly remove a node whose degree '
        + 'is below the register count — it can always be coloured once its neighbours are — '
        + 'and push it on a stack. When none is left, everything remaining is a spill '
        + 'candidate. Popping the stack and giving each node a colour its neighbours have not '
        + 'taken is the second half.',
      '**Briggs\'s change was to be optimistic, and it is why this spills less.** When no node '
        + 'is below the threshold, push the highest-degree one anyway rather than spilling it '
        + 'immediately. Its neighbours frequently end up sharing colours, and then it fits. '
        + 'Chaitin\'s original spilled at that point and gave up quality it did not have to.',
      '**Coalescing removes a move by giving both ends the same register, and it must be '
        + 'conservative.** Two values connected by a move that do not interfere can be merged '
        + '— but merging raises the merged node\'s degree, and aggressive coalescing famously '
        + 'made programs spill that would otherwise have coloured. Briggs\'s test refuses a '
        + 'merge whose combined degree would be too high.',
      '**Linear scan does not build the graph at all.** Sort the intervals by start, walk them '
        + 'once, expire the ones that have ended, and hand out a free register; when none is '
        + 'free, spill the interval that ends LAST, because that frees the most space. It is '
        + 'nearly linear and it is what a JIT uses.',
      '**Splitting a spilled interval recovers most of the difference.** An interval flattened '
        + 'to a single range covers holes where the value is not live at all; cutting it at the '
        + 'point of the spill and re-queuing the tail lets the second half get a register even '
        + 'though the first could not. That is the single most valuable refinement to linear '
        + 'scan and it is a checkbox in the demo.',
      '**Some registers are chosen for you, and that is precolouring.** A calling convention '
        + 'says the first argument arrives in a particular register and the result leaves in '
        + 'another, so those live ranges start already coloured and everything else is '
        + 'allocated around them. Caller-saved against callee-saved is the same constraint '
        + 'expressed as which ranges survive a call.',
      '**The allocation has to be verified, not trusted.** At every program point, the live '
        + 'values with a register must have distinct registers. Checking that against a '
        + 'liveness pass the allocator did not produce is one loop and it is the only thing '
        + 'standing between a heuristic and a miscompilation that fires on one input in a '
        + 'thousand.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: { title: 'Interactive demo — two allocators, one interference graph',
        markup: root.RegallocTemplate.render() },
      diagram: diagram(),
      insight: '**JIT compilers use linear scan because compile time is on the critical path; '
        + 'ahead-of-time compilers use colouring because it is expected to produce better '
        + 'code. The choice is a latency decision — and on this function the quality half of '
        + 'the claim does not survive measurement.** The latency argument is solid and '
        + 'generalises: a JIT is compiling code a user is waiting for, so every millisecond in '
        + 'the allocator is a millisecond the program is not running, and an algorithm that is '
        + 'nearly linear wins outright. An ahead-of-time compiler spends its time once and '
        + 'ships the result to everyone, so it can afford the graph. But look at the sweep. '
        + 'With interval splitting enabled, linear scan matches colouring under moderate '
        + 'pressure on this function and beats it at some register counts, because splitting '
        + 'expresses something an interference graph built from whole live ranges cannot: a '
        + 'value that holds a register for half its life and sits in memory for the other '
        + 'half. Colouring is ahead only where the pressure is tightest, which is where its '
        + 'global view of interference actually pays. The general lesson is the one this '
        + 'milestone keeps arriving at — "the better algorithm" is a claim about a workload, '
        + 'and the workload here is small functions with short live ranges. On a thousand-line '
        + 'function with a real spill-cost heuristic the balance moves, and the only way to '
        + 'know which way is to run it.'
    };
  }

  function render(app) {
    application = app;
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });
    panel = root.ControlPanel.mount({
      controls: root.RegallocTemplate.controls,
      onChange: function () { update(); }
    });
    update();
  }

  /* ------------------------------------------------------------ measuring */

  /**
   * Allocation runs after SSA destruction, which is where a back end sits —
   * and on the function with the most instructions rather than on `main`. A
   * top level of literals is folded away by SCCP before the allocator sees
   * it, so allocating `main` measures an empty graph.
   */
  const preparedFor = root.Helpers.memoise(function (source) {
    const out = root.PassLab.run(source, BASE);

    out.program.functions.forEach(function (fn) {
      if (fn.ssa) root.Berugo.Ssa.destruct(fn);
    });
    return out.program.functions.reduce(function (best, fn) {
      return root.Berugo.Ir.instructionCount(fn) > root.Berugo.Ir.instructionCount(best)
        ? fn : best;
    }, out.program.functions[0]);
  });

  const allocationFor = root.Helpers.memoise(function (key) {
    const parts = JSON.parse(key);
    const fn = preparedFor(root.RegallocTemplate.SAMPLES[parts[0]]);
    const options = { registers: parts[1], coalesce: parts[2], split: parts[3] };
    const layout = root.Berugo.Regalloc.linearise(fn);
    const live = root.Berugo.Regalloc.livePoints(fn, layout);

    return { fn: fn, compared: root.Berugo.Regalloc.compare(fn, options),
      edges: root.Berugo.Regalloc.interference(fn, layout, live),
      intervals: root.Berugo.Regalloc.intervals(fn, layout, live),
      sweep: root.Berugo.Regalloc.pressureSweep(fn, [1, 2, 3, 4, 6, 8, 12]) };
  });

  const suiteFor = root.Helpers.memoise(function (registers) {
    return root.Berugo.Spec.CONFORMANCE.map(function (entry) {
      const fn = preparedFor(entry.source);
      const compared = root.Berugo.Regalloc.compare(fn, { registers: registers });

      return { id: entry.id, values: compared.graph.values,
        colouring: compared.graph.spills, scan: compared.scan.spills,
        sound: compared.graph.verify.ok && compared.scan.verify.ok };
    });
  });

  function update() {
    const values = panel.values();
    const registers = Number(values['ra-registers']);
    const state = allocationFor(JSON.stringify([values['ra-sample'], registers,
      Boolean(values['ra-coalesce']), Boolean(values['ra-split'])]));

    paintGraph(state);
    paintMetrics(state);
    paintCompare(state);
    paintSweep(state);
    paintRanges(state);
    paintSuite(registers);
  }

  function paintGraph(state) {
    if (graphChart && graphChart.chart) graphChart.chart.destroy();
    const names = state.intervals.map(function (row) { return row.register; });

    graphChart = root.BytecodeView.interference(document.getElementById('ra-graph'), {
      lazyLib: application.lazyLib, names: names, edges: state.edges,
      assignment: state.compared.graph.assignment,
      summary: 'One node per value, an edge for each interference, the register inside.' });

    root.Helpers.setText('ra-graph-caption', graphCaption(state, names, graphChart));
  }

  function graphCaption(state, names, drawn) {
    const dropped = drawn ? drawn.dropped : 0;

    return names.length + ' values and ' + state.compared.graph.edges + ' interference edges'
      + (dropped ? ', of which ' + dropped + ' nodes are not drawn — past twenty the chords '
        + 'cross too often to read and the degree column is the useful thing' : '')
      + '. The number inside each node is the register it was given; `sp` is a spill, which '
      + 'means the value lives in memory and every use of it is a load.';
  }

  function paintMetrics(state) {
    const rows = state.compared.rows;

    root.MetricGrid.update({
      'ra-spills': { value: rows[0].spilledPoints + ' / ' + rows[1].spilledPoints,
        note: 'program points in memory — colouring against linear scan, at '
          + state.compared.registers + ' register'
          + (state.compared.registers === 1 ? '' : 's') },
      'ra-degree': { value: state.compared.graph.maxDegree,
        note: 'a value interfering with more than there are registers must be pushed optimistically' },
      'ra-values': { value: state.compared.graph.values,
        note: 'live ranges after SSA destruction' },
      'ra-sound': { value: rows.every(function (row) { return row.sound; }) ? 'yes' : 'NO',
        note: 'checked at every program point against an independent liveness pass' }
    });
  }

  function paintCompare(state) {
    root.jQuery('#ra-compare tbody').html(state.compared.rows.map(function (row) {
      return '<tr><td class="mono">' + row.spilledPoints + '</td><td class="mono">' +
        row.name + '</td><td class="mono">' + row.spills +
        '</td><td class="mono">' + row.splits + '</td><td class="mono">' + row.coalesced +
        '</td><td class="mono">' + row.values + '</td><td>' +
        (row.sound ? 'yes' : 'NO - ' + row.clashes + ' clashes') + '</td></tr>';
    }).join(''));

    root.Helpers.setText('ra-compare-caption',
      'Both allocators on the same function at ' + state.compared.registers + ' registers. The '
      + 'first column is the comparable one: a spill COUNT is not, because splitting turns one '
      + 'interval into two and can raise the count while lowering the cost. Points in memory '
      + 'is what a spill is actually paid in, since every one of them is a load or a store. '
      + 'And the last column is what makes any of the others mean anything: an allocator that '
      + 'spills nothing because it gave two live values the same register has the best numbers '
      + 'in the table and produces a wrong program.');
  }

  function paintSweep(state) {
    if (sweepChart && sweepChart.chart) sweepChart.chart.destroy();
    sweepChart = root.BytecodeView.bars(document.getElementById('ra-chart'), {
      lazyLib: application.lazyLib, series: ['colouring', 'scan'],
      rows: state.sweep.map(function (row) {
        return { label: String(row.registers), colouring: row.colouringPoints,
          scan: row.scanPoints };
      }),
      summary: 'Points spent in memory at each register count: colouring in blue, scan in amber.' });

    root.Helpers.setText('ra-chart-caption', sweepCaption(state));
  }

  function sweepCaption(state) {
    const colouringWins = state.sweep.filter(function (row) {
      return row.colouringPoints < row.scanPoints;
    });
    const scanWins = state.sweep.filter(function (row) {
      return row.scanPoints < row.colouringPoints;
    });

    return 'Points spent in memory against the number of machine registers, colouring in blue '
      + 'and linear scan in amber. Read the result rather than the received wisdom: colouring '
      + 'is ahead at ' + registerList(colouringWins) + ' and linear scan is ahead at '
      + registerList(scanWins) + '. Splitting is what makes that possible — it lets a value '
      + 'hold a register for part of its life and sit in memory for the rest, which an '
      + 'interference graph built from whole ranges cannot express. Colouring wins where the '
      + 'pressure is tightest, which is the half of the textbook claim this function supports.';
  }

  function registerList(rows) {
    if (!rows.length) return 'no register count here';
    return rows.map(function (row) { return String(row.registers); }).join(', ');
  }

  function paintRanges(state) {
    const graph = state.compared.graph.assignment;
    const scan = state.compared.scan.assignment;

    root.jQuery('#ra-ranges tbody').html(state.intervals.slice(0, 24).map(function (row) {
      return '<tr><td class="mono">' + row.register + '</td><td class="mono">' + row.from +
        '</td><td class="mono">' + row.to + '</td><td class="mono">' +
        root.Berugo.Regalloc.degreeOf(state.edges, row.register) + '</td><td class="mono">' +
        showColour(graph[row.register]) + '</td><td class="mono">' +
        showColour(scan[row.register]) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('ra-ranges-caption',
      state.intervals.length + ' live ranges, in order of where they start. A range whose '
      + 'degree is below the register count can always be coloured once everything else has '
      + 'been, which is the observation the whole simplify phase rests on — reading the degree '
      + 'column beside the register count is reading which values were never in doubt.');
  }

  function showColour(value) {
    return value === null || value === undefined ? 'spilled' : String(value);
  }

  function paintSuite(registers) {
    const rows = suiteFor(registers);

    root.jQuery('#ra-suite tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + row.id + '</td><td class="mono">' + row.values +
        '</td><td class="mono">' + row.colouring + '</td><td class="mono">' + row.scan +
        '</td><td>' + (row.sound ? 'yes' : 'NO') + '</td></tr>';
    }).join(''));

    const sound = rows.filter(function (row) { return row.sound; }).length;
    const totals = rows.reduce(function (into, row) {
      return { c: into.c + row.colouring, s: into.s + row.scan };
    }, { c: 0, s: 0 });

    root.Helpers.setText('ra-suite-caption',
      sound + ' of ' + rows.length + ' programs allocate soundly under both algorithms at '
      + registers + ' registers, with ' + totals.c + ' spill' + (totals.c === 1 ? '' : 's')
      + ' from colouring against ' + totals.s + ' from linear scan across the suite. Turning the register count down makes '
      + 'the gap grow, which is the only condition under which the more expensive algorithm '
      + 'earns its cost.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

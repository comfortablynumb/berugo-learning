/**
 * Section: Scheduling and peephole at the machine level.
 *
 * The measurement is two orders through one pipeline model, with register
 * pressure reported beside the cycle count. The schedule removes stalls and
 * raises the peak, and reporting only the first half is how a scheduler comes
 * to be blamed for spills nobody connected to it.
 *
 * The second is legality. A schedule is correct exactly when every dependence
 * edge still points forwards, and checking that rather than trusting the
 * algorithm is the difference between a scheduler and a shuffler.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'machine-scheduling';
  let panel = null;
  let chart = null;
  let application = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — a dependence DAG with latency-weighted edges',
      caption: 'An edge says one instruction must come after another, and its weight is how '
        + 'long the result takes to arrive. Three kinds of edge appear and only the first is '
        + 'about values: a TRUE edge from a producer to its consumer, a MEMORY edge that stops '
        + 'a load moving above a store, and an EFFECT edge that stops anything crossing a call. '
        + 'The last two exist because the scheduler has no alias information — M29.9 is what '
        + 'would be needed to remove them, and a scheduler that assumes them away miscompiles.',
      definition: [
        'graph TD',
        'L1["load a — latency 4"] -->|"4"| S1["add a, b"]',
        'L2["load b — latency 4"] -->|"4"| S1',
        'S1 -->|"2"| S2["mul"]',
        'ST["store p.x"] -.->|"memory edge"| L3["load q.y"]',
        'C["call f()"] -.->|"effect edge"| ST'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**A processor issues instructions in order and results arrive late, so an instruction '
        + 'that needs a result too soon stalls.** Scheduling is reordering the block so that '
        + 'something useful happens in the gap. The model here is deliberately simple — one '
        + 'issue per cycle, in order, a consumer waits for its producer\'s latency — and it is '
        + 'enough to make the trade visible; M35 has the real pipeline.',
      '**The dependence DAG is what a legal reordering has to respect, and it has three kinds '
        + 'of edge.** A true edge runs from a value\'s producer to its consumer. A memory edge '
        + 'stops a load moving above a store, because proving it safe needs the alias analysis '
        + 'of M29.9 and this pass does not consult one. An effect edge stops anything crossing '
        + 'a call, because a call may do anything.',
      '**List scheduling is greedy over a ready list, and the priority is what makes it good.** '
        + 'At each cycle, take a ready instruction; the standard choice is the one with the '
        + 'longest latency-weighted path to the end of the block, because everything behind it '
        + 'is waiting. The demo has a "source order" setting so the priority can be turned off '
        + 'and the difference read.',
      '**A load is the expensive one, which is why every scheduler is mostly a load '
        + 'scheduler.** Arithmetic is one or two cycles and a cache hit is three or four; a '
        + 'miss is hundreds. Hoisting a load early so its result has arrived by the time '
        + 'anything wants it is most of what the pass buys, and it is why the latency slider '
        + 'moves the answer so much.',
      '**Scheduling raises register pressure, and that is the cost side.** Moving a load early '
        + 'means its result is live for longer, and a value live for longer interferes with '
        + 'more values. Past the register count that is a spill, a spill is a memory access, '
        + 'and the pass has then bought a stall with a load. The pressure column is beside the '
        + 'cycle column for exactly this reason.',
      '**The two passes fight, and that is why their order is tuned per target.** Schedule '
        + 'first and the allocator is handed higher pressure; allocate first and the scheduler '
        + 'is handed false dependences through reused registers. Real compilers schedule, '
        + 'allocate, and then schedule again — which is a confession that neither order is '
        + 'right.',
      '**Block layout is scheduling at a larger grain.** Putting the likely successor of a '
        + 'branch immediately after it makes the not-taken path the fast one and keeps the hot '
        + 'path contiguous in the instruction cache. It needs a profile to know which successor '
        + 'is likely, which is why profile-guided optimisation shows up here and in 30.7 for '
        + 'the same reason.',
      '**Delay slots are the historical version of this idea, and they lost.** An early RISC '
        + 'exposed the pipeline in the instruction set: the instruction after a branch always '
        + 'executes. It let a simple compiler fill one stall and it froze one pipeline depth '
        + 'into the architecture forever, which is why nothing designed since does it.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: { title: 'Interactive demo — one block, two orders, one pipeline',
        markup: root.ScheduleTemplate.render() },
      diagram: diagram(),
      insight: '**Aggressive scheduling raises register pressure and can cause spills that cost '
        + 'more than the stalls it removed, which is why the two passes fight and why their '
        + 'order is tuned per target rather than settled.** Every instruction the scheduler '
        + 'moves earlier extends the lifetime of its result, and lifetimes are what the '
        + 'allocator is trying to fit into a fixed number of registers. So a scheduler that '
        + 'removes twelve stall cycles by hoisting four loads may hand the allocator a peak it '
        + 'cannot meet, and each spill is a store and a load — often more than twelve cycles '
        + 'between them. There is no way to decide this locally: the scheduler cannot see the '
        + 'spill it will cause and the allocator cannot see the stall it would have removed. '
        + 'Real compilers run a pre-allocation schedule, allocate, then schedule again to clean '
        + 'up what the spill code did, and tune the aggressiveness per target because the right '
        + 'answer depends on the register count and the memory latency of the machine. When you '
        + 'see two passes whose objectives are in tension and no principled order between them, '
        + 'that is not a failure of the compiler — it is the shape of the problem.'
    };
  }

  function render(app) {
    application = app;
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });
    panel = root.ControlPanel.mount({
      controls: root.ScheduleTemplate.controls,
      onChange: function () { update(); }
    });
    update();
  }

  /* ------------------------------------------------------------ measuring */

  const functionFor = root.Helpers.memoise(function (id) {
    const program = root.Berugo.IrLower.compile(root.ScheduleTemplate.SAMPLES[id]).program;

    return program.functions.reduce(function (best, fn) {
      return root.Berugo.Ir.instructionCount(fn) > root.Berugo.Ir.instructionCount(best)
        ? fn : best;
    }, program.functions[0]);
  });

  const scheduleFor = root.Helpers.memoise(function (key) {
    const parts = JSON.parse(key);
    const fn = functionFor(parts[0]);
    const options = { latency: { loadIndex: parts[1], loadField: parts[1] },
      priority: parts[2] };
    const block = biggestBlock(fn);

    return { fn: fn, block: block, options: options,
      report: root.Berugo.Schedule.report(fn, options),
      scheduled: root.Berugo.Schedule.listSchedule(block, options),
      sweep: root.Berugo.Schedule.latencySweep(fn, [1, 2, 4, 8, 12, 16]) };
  });

  function biggestBlock(fn) {
    return fn.blocks.reduce(function (best, block) {
      return block.instructions.length > best.instructions.length ? block : best;
    }, fn.blocks[0]);
  }

  function update() {
    const values = panel.values();
    const state = scheduleFor(JSON.stringify([values['ms-sample'],
      Number(values['ms-latency']), values['ms-priority']]));

    paintChart(state);
    paintMetrics(state);
    paintTimeline(state);
    paintDag(state);
    paintBlocks(state);
    paintSweep(state);
  }

  function summaryRow(state) {
    return root.Berugo.Schedule.compareBlock(state.block, state.options).rows;
  }

  function paintChart(state) {
    const rows = summaryRow(state);

    if (chart && chart.chart) chart.chart.destroy();
    chart = root.BytecodeView.bars(document.getElementById('ms-chart'), {
      lazyLib: application.lazyLib, series: ['cycles', 'peak'],
      rows: rows.map(function (row) {
        return { label: row.name, cycles: row.cycles, peak: row.peak };
      }),
      summary: 'Cycles in blue and peak register pressure in amber, for both orders.' });

    root.Helpers.setText('ms-chart-caption',
      'Cycles in blue and peak register pressure in amber. Reading the two together is the '
      + 'whole section: the schedule is only a win if the pressure it costs stays under the '
      + 'register count, and the allocator in 30.4 is what decides that.');
  }

  function paintMetrics(state) {
    const rows = summaryRow(state);

    root.MetricGrid.update({
      'ms-cycles': { value: rows[0].cycles + ' → ' + rows[1].cycles,
        note: (rows[0].cycles - rows[1].cycles) + ' cycles removed on the largest block' },
      'ms-stalls': { value: rows[0].stalls + ' → ' + rows[1].stalls,
        note: 'cycles spent waiting for a result rather than issuing' },
      'ms-peak': { value: rows[0].peak + ' → ' + rows[1].peak,
        note: rows[1].peak > rows[0].peak
          ? 'the schedule bought its cycles with ' + (rows[1].peak - rows[0].peak)
            + ' more live value' + (rows[1].peak - rows[0].peak === 1 ? '' : 's')
          : 'no extra pressure on this block' },
      'ms-legal': { value: rows[1].legal ? 'yes' : 'NO',
        note: 'every dependence edge still points forwards in the new order' }
    });
  }

  function paintTimeline(state) {
    const run = root.Berugo.Schedule.simulate(state.block, state.scheduled.order, state.options);
    const dag = state.scheduled.dag;

    root.jQuery('#ms-timeline tbody').html(run.timeline.map(function (row, step) {
      return '<tr><td class="mono">' + step + '</td><td class="mono">' +
        root.Berugo.Ir.showInstruction(dag.nodes[row.at].inst) + '</td><td class="mono">' +
        row.issued + '</td><td class="mono">' + row.waited + '</td><td class="mono">' +
        dag.nodes[row.at].latency + '</td></tr>';
    }).join(''));

    root.Helpers.setText('ms-timeline-caption',
      run.instructions + ' instructions issued over ' + run.cycles + ' cycles, of which '
      + run.stalls + ' were spent waiting. The waited column is where the schedule earns its '
      + 'keep: a non-zero entry is a cycle the processor had nothing to do, and moving an '
      + 'independent instruction into it is the entire transformation.');
  }

  function paintDag(state) {
    const dag = state.scheduled.dag;
    const height = state.scheduled.height;

    root.jQuery('#ms-dag tbody').html(dag.nodes.map(function (node) {
      return '<tr><td class="mono">' + root.Berugo.Ir.showInstruction(node.inst) +
        '</td><td class="mono">' + (node.preds.map(function (pred) {
        return String(pred.at);
      }).join(', ') || '—') + '</td><td class="mono">' + node.latency +
        '</td><td class="mono">' + height[node.at] + '</td></tr>';
    }).join(''));

    root.Helpers.setText('ms-dag-caption',
      dag.nodes.length + ' instructions and ' + dag.edges + ' dependence edges. The last '
      + 'column is the priority: the longest latency-weighted path from this instruction to '
      + 'the end of the block, which is how much of the block is waiting behind it. List '
      + 'scheduling takes the largest one that is ready, and that single rule is what '
      + 'separates a good schedule from a legal one.');
  }

  function paintBlocks(state) {
    root.jQuery('#ms-blocks tbody').html(state.report.rows.map(function (row) {
      return '<tr><td class="mono">' + row.block + '</td><td class="mono">' + row.instructions +
        '</td><td class="mono">' + row.rows[0].cycles + '</td><td class="mono">' +
        row.rows[1].cycles + '</td><td class="mono">' +
        (row.rows[0].stalls - row.rows[1].stalls) + '</td><td class="mono">' +
        row.rows[0].peak + '</td><td class="mono">' + row.rows[1].peak + '</td></tr>';
    }).join('') || '<tr><td colspan="7">no block in this function has two instructions</td></tr>');

    root.Helpers.setText('ms-blocks-caption',
      state.report.rows.length + ' block' + (state.report.rows.length === 1 ? '' : 's')
      + ' worth scheduling, taking the function from '
      + state.report.before + ' cycles to ' + state.report.after + ' and its stalls from '
      + state.report.stallsBefore + ' to ' + state.report.stallsAfter + '. Peak pressure went '
      + 'from ' + state.report.peakBefore + ' to ' + state.report.peakAfter + ', and '
      + state.report.illegal + ' schedules violated a dependence — which is the number that '
      + 'has to be zero before any of the others mean anything.');
  }

  function paintSweep(state) {
    root.jQuery('#ms-sweep tbody').html(state.sweep.map(function (row) {
      return '<tr><td class="mono">' + row.latency + '</td><td class="mono">' + row.cycles +
        '</td><td class="mono">' + row.saved + '</td><td class="mono">' + row.stalls +
        '</td><td class="mono">' + row.peak + '</td></tr>';
    }).join(''));

    root.Helpers.setText('ms-sweep-caption',
      'The same function with the load latency swept from 1 to 16. Notice what does and does '
      + 'not move: the stalls climb with the latency and the peak pressure does not, because '
      + 'the schedule is the same order in every row — the pass has already moved everything '
      + 'it can, and past that point a slower memory is simply a slower program. That ceiling '
      + 'is what out-of-order execution in M36 exists to break.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

/**
 * Section: Instruction-level parallelism and its limits.
 *
 * The first section of the milestone and the one that supplies its oracle.
 * Everything after this page is a claim about a simulator's timing, and a
 * timing model cannot be checked by a differential against a behavioural
 * reference - both machines compute the right answer and one of them lies
 * about how long it took. The dependence graph is the independent check: it
 * knows nothing about the processor, and the IPC it permits is a ceiling the
 * measurement is asserted never to break.
 *
 * The graph is built over the TRACE rather than the source, because a loop
 * executed forty times has a chain forty long and a static analysis of the
 * same loop does not know that.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'instruction-level-parallelism';
  const Lab = root.OooLab;
  const Ilp = root.IlpAnalysis;
  const Table = root.DataTable;
  let panel = null;
  let chart = null;

  /**
   * A six-instruction basic block, written out by hand so the diagram is
   * readable, and analysed by the same code as everything else so it cannot
   * say something the analyser would not.
   */
  const BLOCK = [
    { id: 0, pc: 0, name: 'lw t0, 0(a0)', kind: 'load', latency: 2, reads: [10],
      writes: 5, address: 0x100, access: 'read' },
    { id: 1, pc: 4, name: 'lw t1, 4(a0)', kind: 'load', latency: 2, reads: [10],
      writes: 6, address: 0x104, access: 'read' },
    { id: 2, pc: 8, name: 'add t2, t0, t1', kind: 'alu', latency: 1, reads: [5, 6],
      writes: 7, address: null, access: null },
    { id: 3, pc: 12, name: 'addi a0, a0, 8', kind: 'alu', latency: 1, reads: [10],
      writes: 10, address: null, access: null },
    { id: 4, pc: 16, name: 'add s0, s0, t2', kind: 'alu', latency: 1, reads: [8, 7],
      writes: 8, address: null, access: null },
    { id: 5, pc: 20, name: 'bne a0, a1, loop', kind: 'branch', latency: 1, reads: [10, 11],
      writes: null, address: null, access: null }
  ];

  const EDGE_ABOUT = {
    raw: { on: 'a value', removed: 'nothing — this is the only real one' },
    war: { on: 'a register name', removed: 'renaming (36.2)' },
    waw: { on: 'a register name', removed: 'renaming (36.2)' },
    mem: { on: 'a value in memory', removed: 'store-to-load forwarding, which hides the latency but not the order' },
    memOrder: { on: 'not knowing an address yet', removed: 'memory dependence speculation (36.5)' }
  };

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  /* ------------------------------------------------------------- the frame */

  function diagram() {
    const found = Ilp.analyse(BLOCK, { model: 'renamed' });
    const critical = new Set(found.path.map(function (step) { return step.id; }));

    return {
      title: 'Diagram — one basic block, its dependences, and the path through them',
      caption: 'Solid arrows are read-after-write: a real dependence on a value, and the '
        + 'only kind no hardware can remove. Dashed arrows are write-after-read, which exist '
        + 'because the loop counter is called a0 both before and after it is incremented — '
        + 'rename it and they are gone. The thick path is the longest chain of real '
        + 'dependences, at ' + found.criticalPath + ' cycles for ' + BLOCK.length
        + ' instructions, so this block cannot exceed '
        + found.ilp.toFixed(2) + ' instructions per cycle on any machine ever built.',
      definition: mermaid(found, critical)
    };
  }

  function mermaid(found, critical) {
    const lines = ['flowchart TD'];

    BLOCK.forEach(function (row) {
      lines.push('    n' + row.id + '["' + row.id + ': ' + row.name + '"]');
    });
    found.graph.edges.forEach(function (edge) {
      lines.push('    n' + edge.from + (edge.kind === 'raw' ? ' --> ' : ' -.-> ') +
        '|' + edge.kind + ' ' + edge.through + '| n' + edge.to);
    });
    BLOCK.forEach(function (row) {
      if (critical.has(row.id)) lines.push('    style n' + row.id + ' stroke-width:3px');
    });
    return lines.join('\n');
  }

  function orientation() {
    return opening().concat(closing());
  }

  function opening() {
    return [
      '**Instruction-level parallelism is a property of the code, not of the processor.** '
        + 'Draw the dependence graph of a run and find the longest chain through it: that '
        + 'chain is how many cycles the program takes on a machine with unlimited width, an '
        + 'unlimited window and perfect prediction. Divide the instruction count by it and '
        + 'you have the highest instructions-per-cycle any machine could ever report. The '
        + 'demo computes that number and then measures the simulator against it.',
      '**Three kinds of dependence, and only one of them is real.** Read-after-write is a '
        + 'dependence on a *value* — the second instruction needs the number the first one '
        + 'produced, and no amount of hardware changes that. Write-after-read and '
        + 'write-after-write are dependences on a *name*: they exist only because the '
        + 'instruction set has thirty-two registers and the compiler ran out. Renaming '
        + 'removes both outright, which is the whole of 36.2.',
      '**The two matched fixtures show exactly what that is worth.** `chain` is 32 additions '
        + 'in one chain: critical path 33, ILP bound 1.00, and nothing helps. `independent` '
        + 'is the same 32 additions with no true dependence at all, written over four '
        + 'register names — bound 32.00 on a machine that renames, and 4.00 on one that does '
        + 'not. Same instruction count, same arithmetic, an eight-fold difference that is '
        + 'entirely about register naming.',
      '**Memory dependences are the ones you cannot read off the source.** Whether a load '
        + 'depends on an older store is a question about their addresses, and the addresses '
        + 'are computed at run time. A machine that will not let a load pass a store whose '
        + 'address is unknown is correct and slow; the `disjoint` fixture is built to show '
        + 'the cost, and 36.5 is where the machine guesses instead.',
      '**The bound is an oracle, and that is why it is in the first section.** Every later '
        + 'page claims a cycle count. A differential against the in-order reference cannot '
        + 'catch a timing bug, because both machines still produce the right answer. The '
        + 'dependence bound can, and the tests assert on every program that the measured IPC '
        + 'never exceeds it.'
    ];
  }

  function closing() {
    return [
      '**The gap between the bound and the measurement is what the hardware costs.** On '
        + '`chain` the bound is 1.00 and the machine reaches 0.868 — a headroom of 1.15, '
        + 'because there is nothing to win. On `independent` the bound is 32.00 and the '
        + 'machine reaches 1.524, a headroom of 21, because the core has two integer ports '
        + 'and the code would need thirty-two. Which of those two numbers is large tells you '
        + 'whether to change the machine or the program.',
      '**The classic ILP studies found small numbers, and the parallelism profile says '
        + 'why.** Plot how many instructions could start in each cycle and the shape is a few '
        + 'tall spikes over a long flat plain — `factorial` offers 26 instructions in its '
        + 'first cycle and between 1 and 10 in every cycle after. A machine wide enough for '
        + 'the spikes is idle for the rest of the run, which is the economic argument against '
        + 'width and the reason practical machines stopped at four to six.',
      '**Latency is a separate axis and both bounds are valid.** With unit latency the bound '
        + 'is the classic "infinite resources" figure. With the simulator\'s own latencies — '
        + 'a load takes two cycles — the bound is lower and tighter, and the machine cannot '
        + 'beat that one either. A cache miss makes a real load slower still, which only '
        + 'moves the measurement further below both.',
      '**When a loop will not go faster, the chain is usually the reason.** That is the '
        + 'senior version of this page. Before reaching for a wider machine, a better '
        + 'compiler or a profiler, ask what the longest dependence chain through the loop is '
        + '— because if it is the loop-carried accumulator, no microarchitecture on the '
        + 'roadmap will help and the fix is to break the chain in the source.'
    ];
  }

  function insight() {
    return '**The most useful thing on this page is a habit: before asking why a machine is '
      + 'slow, compute what the code would allow a perfect machine to do.** Two numbers come '
      + 'out of that, and they point in opposite directions. If the bound is close to the '
      + 'measurement — `chain` at 1.00 against 0.868 — the processor is already doing almost '
      + 'everything the code permits, and every microarchitectural idea in the rest of this '
      + 'milestone is worth nothing here; the only remaining move is to change the '
      + 'dependence structure, which means changing the program. If the bound is far above '
      + 'the measurement — `independent` at 32.00 against 1.524 — the code has parallelism '
      + 'the machine is failing to use, and now the questions about width, window, ports and '
      + 'memory are the right ones. Nearly every argument about performance that goes in '
      + 'circles is one where nobody computed this first, and the two sides are answering '
      + 'different questions: one is talking about the ceiling and the other about the gap '
      + 'to it. The same split runs through the whole curriculum — an algorithm\'s '
      + 'complexity class is a ceiling and its constant factor is the gap, a network\'s '
      + 'bandwidth-delay product is a ceiling and its window is the gap — and in every case '
      + 'the ceiling has to be computed first, because it decides which conversation is '
      + 'worth having.';
  }

  function config() {
    return { sectionId: SECTION_ID, orientation: orientation(),
      demo: { title: 'Interactive demo — the dependence graph as a speed limit',
        markup: root.IlpTemplate.render() },
      diagram: diagram(), insight: insight() };
  }

  /* ------------------------------------------------------------- plumbing */

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });
    panel = root.ControlPanel.mount({ controls: root.IlpTemplate.controls(),
      onChange: function () { update(app); } });
    update(app);
  }

  function reading() {
    const values = panel.values();
    const name = values['ilp-program'];
    const options = { model: values['ilp-model'],
      unitLatency: values['ilp-latency'] === 'unit' };

    return { name: name, options: options, width: Number(values['ilp-width']),
      found: Lab.ilp(name, options),
      measured: Lab.summary(name, { width: Number(values['ilp-width']) }) };
  }

  function update(app) {
    const view = reading();

    paintMetrics(view);
    paintModels(view);
    paintEdges(view);
    paintPath(view);
    paintPrograms(view);
    paintProfile(app, view);
  }

  function paintMetrics(view) {
    const found = view.found;
    const ipc = view.measured.ipc;
    const respects = Ilp.respects(found.ilp, ipc);

    root.MetricGrid.update({
      'ilp-instructions': { value: found.instructions,
        note: 'retired by the reference simulator, one row each' },
      'ilp-critical': { value: found.criticalPath,
        note: 'the longest chain of dependences this model must obey' },
      'ilp-bound': { value: found.ilp.toFixed(2),
        note: found.instructions + ' / ' + found.criticalPath + ' — no machine can beat it' },
      'ilp-measured': { value: ipc.toFixed(3),
        note: 'at issue width ' + view.width + ', over ' + view.measured.cycles + ' cycles' },
      'ilp-headroom': { value: (found.ilp / Math.max(ipc, 1e-9)).toFixed(2) + 'x',
        note: respects ? 'what the machine\'s finite resources cost' : 'negative headroom' },
      'ilp-respects': { value: respects ? 'yes' : 'NO',
        note: respects ? 'the measurement is below the ceiling, as it must be'
          : 'the timing model is reporting an impossible IPC' }
    });
  }

  function paintModels(view) {
    const rows = Ilp.compare(Lab.trace(view.name).rows,
      { unitLatency: view.options.unitLatency });
    const renamed = rows.filter(function (row) { return row.model === 'renamed'; })[0];

    Table.paint('ilp-models', rows.map(function (row) {
      return [row.model + ' — ' + row.about, row.criticalPath, row.ilp.toFixed(2),
        row.model === 'renamed' ? 'the baseline'
          : (row.ilp / renamed.ilp).toFixed(2) + 'x'];
    }), modelCaption(view, rows, renamed));
  }

  function modelCaption(view, rows, renamed) {
    const unrenamed = rows.filter(function (row) { return row.model === 'unrenamed'; })[0];
    const gap = renamed.ilp / Math.max(unrenamed.ilp, 1e-9);

    return 'The three rows differ only in which dependences the machine is required to '
      + 'respect, over the same ' + renamed.instructions + ' instructions. Renaming is worth '
      + gap.toFixed(2) + 'x on ' + view.name + (gap > 1.5
        ? ', which is the whole argument for a physical register file larger than the '
          + 'architectural one.'
        : ', which is almost nothing here — this program\'s parallelism is limited by real '
          + 'value dependences, and no naming trick touches those.')
      + ' The third row is a machine that will not let a load pass a store whose address it '
      + 'does not know yet; where it differs from the first, memory dependence speculation '
      + '(36.5) is the mechanism that closes the gap.';
  }

  function paintEdges(view) {
    const counts = view.found.counts;
    const rows = Object.keys(counts).map(function (kind) {
      return [kind, counts[kind], EDGE_ABOUT[kind].on, EDGE_ABOUT[kind].removed];
    });

    Table.paint('ilp-edges', rows, 'Only the read-after-write count is a statement about the '
      + 'computation. The other rows are statements about the encoding: ' + counts.war
      + ' write-after-read and ' + counts.waw + ' write-after-write dependences exist here '
      + 'because thirty-two register names have to be reused, and a machine with a hundred '
      + 'and ninety-two physical registers underneath sees none of them. That is why the '
      + 'unrenamed row above is slower on almost every program, and why it is dramatically '
      + 'slower on code a reader would call obviously parallel.');
  }

  function paintPath(view) {
    const path = view.found.path;
    const shown = path.slice(0, 14);

    Table.paint('ilp-path', shown.map(function (step, at) {
      return [at + 1, '0x' + step.pc.toString(16), step.name,
        step.kind ? 'instruction ' + (path[at - 1] ? path[at - 1].id : '?') : 'nothing — it starts here',
        step.through || '—'];
    }), 'The chain that sets the cycle count, ' + path.length + ' steps long'
      + (path.length > shown.length ? ' (the first ' + shown.length + ' shown)' : '')
      + '. Shortening the program anywhere else changes nothing; shortening this chain is '
      + 'the only edit that moves the bound. That is the practical use of a critical path — '
      + 'not the number, but the list of instructions it names.');
  }

  function paintPrograms(view) {
    Table.paint('ilp-programs', Lab.names().map(function (name) {
      const found = Lab.ilp(name, { unitLatency: true });
      const measured = Lab.summary(name, { width: 4 });
      const respects = Ilp.respects(found.ilp, measured.ipc);

      return [name, found.instructions, found.criticalPath, found.ilp.toFixed(2),
        measured.ipc.toFixed(3),
        (found.ilp / Math.max(measured.ipc, 1e-9)).toFixed(2) + 'x',
        { value: respects ? 'yes' : 'NO', className: respects ? '' : 'bad' }];
    }), 'Every program, at unit latency and issue width 4. The last column is the check the '
      + 'test suite runs on every configuration: a measured IPC above the bound would mean '
      + 'the timing model is counting cycles that the code\'s own structure says cannot '
      + 'exist. The headroom column is the interesting one — `chain` at 1.15x has nothing '
      + 'left to give, and `independent` at 21x is entirely limited by the machine.');
  }

  function paintProfile(app, view) {
    const host = root.jQuery('#ilp-profile')[0];

    if (!host) return;
    if (chart) chart.destroy();
    const profile = Ilp.profile(Lab.trace(view.name).rows, view.options);
    const peak = profile.reduce(function (most, row) {
      return Math.max(most, row.ready);
    }, 0);

    chart = root.GrowthPlot.render(host, { lazyLib: app.lazyLib, height: 240,
      xLabel: 'earliest cycle the instruction could start',
      yLabel: 'instructions available',
      series: [{ label: 'ready to issue', points: profile.map(function (row) {
        return { x: row.cycle, y: row.ready };
      }) }] });
    root.Helpers.setText('ilp-profile-note', profileNote(view, profile, peak));
  }

  function profileNote(view, profile, peak) {
    const mean = profile.reduce(function (sum, row) {
      return sum + row.ready;
    }, 0) / Math.max(profile.length, 1);

    return 'How many instructions a machine with unlimited resources could start in each '
      + 'cycle. The peak is ' + peak + ' and the mean is ' + mean.toFixed(1) + ', and that '
      + 'ratio is the whole economic problem with issue width: hardware has to be built for '
      + 'the peak and is paid for in every cycle. This is the shape the ILP studies of the '
      + 'late 1980s found, and the reason their conclusions were read as disappointing — the '
      + 'average is small even when the maximum is not.';
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

/**
 * Section: Structural hazards.
 *
 * The simplest hazard and the one with the clearest fix: two stages want one
 * resource, so one of them waits. The demo runs the same programs with a
 * unified memory and with split instruction and data ports, and the difference
 * is entirely stalls the fetch stage spent waiting.
 *
 * The M34 single-cycle datapath already had the split, because it had to - it
 * fetches and accesses data in the same cycle. This section is where that
 * modelling convenience becomes a design decision with a price on it.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'structural-hazards';
  const Pipeline = root.Brv32.Pipeline;
  const Assembler = root.Brv32.Assembler;
  const Programs = root.Brv32.Programs;
  const Isa = root.Brv32.Isa;
  const View = root.PipelineView;
  let panel = null;
  let chart = null;

  const NAMES = ['sum', 'arrayMax', 'strlen', 'factorial'];

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — two stages, one memory port',
      caption: 'Fetch wants an instruction and the memory stage wants a word of data, in the '
        + 'same cycle, from the same memory. One of them waits, and it is always fetch — the '
        + 'older instruction has priority, because letting the younger one go first would '
        + 'reorder the machine. That priority rule is the whole of structural hazard '
        + 'resolution.',
      definition: [
        'flowchart TB',
        '    IF["fetch stage<br/>wants the next instruction"] --> A{"one memory port"}',
        '    MEM["memory stage<br/>wants a word of data"] --> A',
        '    A -->|"the older instruction wins"| D["the data access proceeds"]',
        '    A -->|"the younger one waits"| S["fetch stalls: a bubble<br/>enters the pipeline"]',
        '    D --> R["resolution 1: duplicate<br/>split instruction and data memories"]',
        '    S --> R2["resolution 2: stall<br/>free, and it costs cycles"]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**A structural hazard is two stages wanting one resource in the same cycle.** Nothing '
        + 'about the program is wrong and no value is missing — the machine simply does not '
        + 'have enough of something. That makes it the easiest hazard to reason about and the '
        + 'most expensive to fix, because the fix is more hardware.',
      '**The classic case is one memory serving both fetch and data access.** Every cycle '
        + 'needs an instruction; the cycles with a load or a store need a word as well. With '
        + 'one port they cannot both happen, so fetch waits and a bubble enters the pipeline '
        + 'behind it.',
      '**The older instruction always wins.** Priority goes to the instruction further down '
        + 'the pipeline, because letting the younger one proceed would mean it finished first. '
        + 'An in-order machine that retires out of order is not an in-order machine. That '
        + 'rule is the same one every arbiter in every system needs and rarely states.',
      '**There are exactly three resolutions: duplicate the resource, pipeline it, or '
        + 'stall.** Duplicating costs area and power; pipelining the resource costs latency '
        + 'and complexity; stalling costs cycles and is free to build. Which is right depends '
        + 'entirely on how often the conflict happens, and that is a measurement rather than '
        + 'an opinion.',
      '**The Harvard split at the top of the memory hierarchy is this fix, applied.** Real '
        + 'machines have separate instruction and data caches over a unified memory below. The '
        + 'split is affordable exactly where the conflict is frequent — the first level — and '
        + 'not below it, where it is rare.',
      '**A single-ported register file is the same hazard in miniature.** Two reads and one '
        + 'write per cycle need three ports; with fewer, something waits. Real designs read in '
        + 'one half of the cycle and write in the other, which is a way of pipelining the '
        + 'resource rather than duplicating it.',
      '**A multi-cycle functional unit creates the hazard too.** A divider that takes twenty '
        + 'cycles and is not pipelined blocks every later division, and the stall count '
        + 'depends on how often divisions occur. That is why nobody pipelines a divider and '
        + 'everybody pipelines a multiplier.',
      '**This is a queueing problem, and M58 will say so with the maths.** A resource, a '
        + 'stream of requests, a service time and a decision about how many servers to build. '
        + 'The pipeline is where the shape appears first; the same question about connection '
        + 'pools and thread pools has the same answer and better arithmetic.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: { title: 'Interactive demo — one memory, or two',
        markup: root.StructuralTemplate.render() },
      diagram: diagram(),
      insight: insight()
    };
  }

  function insight() {
    return '**Every structural hazard is the same question: build another one, or wait for '
      + 'the one you have.** The answer is always a measurement rather than a principle. '
      + 'A second memory port removes every one of these stalls and costs an entire memory. '
      + 'On a program with no loads at all it buys nothing, and on a load in every iteration '
      + 'it buys a stall per iteration. Nothing about the architecture tells you which case '
      + 'you are in, so the only way to decide is to count. That is a habit worth carrying '
      + 'well beyond processors, because the same decision arrives constantly in software with '
      + 'much worse instrumentation attached to it. How many connections in the pool, how many '
      + 'threads in the executor, how many replicas of the service, how many partitions of the '
      + 'topic? Every one is "duplicate the resource or queue for it", and every one is '
      + 'routinely decided by intuition. The processor version has an advantage the software '
      + 'version rarely has: the contention is visible, the stalls are counted, and the cost '
      + 'of the fix is known in advance. When you can measure the queue and price the server, '
      + 'the decision stops being architecture and becomes arithmetic. If you cannot '
      + 'measure it, that is the first thing to fix rather than a reason to guess.';
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });
    panel = root.ControlPanel.mount({
      controls: root.StructuralTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------- plumbing */

  function fill(id, rows) {
    root.jQuery('#' + id + ' tbody').html(rows.map(function (cells) {
      return '<tr>' + cells.map(function (cell) {
        return '<td>' + root.Helpers.escapeHtml(String(cell)) + '</td>';
      }).join('') + '</tr>';
    }).join(''));
  }

  const runOf = root.Helpers.memoise(function (key) {
    const parts = JSON.parse(key);
    const image = Assembler.assemble(Programs.CATALOGUE[parts.name].source, { origin: 0 });
    const machine = Pipeline.create({ image: image.bytes, entry: 0, predictor: 'bimodal',
      unifiedMemory: parts.unified });

    Pipeline.run(machine, { cycles: 3000, stopOnTrap: true });
    return { machine: machine, summary: Pipeline.summary(machine), image: image };
  });

  /** How many of the instructions this program executes touch memory - the
   *  count that decides whether a second port is worth building. */
  const accessesIn = root.Helpers.memoise(function (name) {
    const run = runOf(JSON.stringify({ name: name, unified: false }));
    let accesses = 0;

    run.machine.log.forEach(function (cycle) {
      cycle.events.forEach(function (event) {
        if (event.kind === 'memory') accesses += 1;
      });
    });
    return accesses;
  });

  function reading() {
    const values = panel.values();
    const unified = Boolean(values['sth-unified']);
    const key = JSON.stringify({ name: values['sth-program'], unified: unified });

    return { name: values['sth-program'], unified: unified,
      cycles: Number(values['sth-cycles']), run: runOf(key),
      other: runOf(JSON.stringify({ name: values['sth-program'], unified: !unified })) };
  }

  /* --------------------------------------------------------------- render */

  function update(app) {
    const view = reading();

    paintMetrics(view);
    paintAttribution(view);
    paintDiagram(view);
    paintCompare(view);
    paintResolutions();
    paintElsewhere();
    paintChart(app, view);
  }

  function splitRun(name) {
    return runOf(JSON.stringify({ name: name, unified: false }));
  }

  function unifiedRun(name) {
    return runOf(JSON.stringify({ name: name, unified: true }));
  }

  function paintMetrics(view) {
    const summary = view.run.summary;
    const split = splitRun(view.name).summary;
    const unified = unifiedRun(view.name).summary;

    root.MetricGrid.update({
      'sth-cycles-total': { value: summary.cycles,
        note: view.unified ? 'with one memory' : 'with two' },
      'sth-structural': { value: summary.structural,
        note: summary.structural ? 'each one a bubble behind the fetch'
          : 'nothing contended for the port' },
      'sth-ipc': { value: summary.ipc.toFixed(3), note: 'instructions retired per cycle' },
      'sth-split': { value: split.cycles, note: 'the same program with two ports' },
      'sth-cost': { value: (unified.cycles - split.cycles) + ' cycles',
        note: unified.cycles === split.cycles ? 'nothing — this program barely touches memory'
          : ((100 * (unified.cycles - split.cycles) / split.cycles).toFixed(1) +
            '% of the split-memory run') },
      'sth-accesses': { value: accessesIn(view.name),
        note: 'of ' + split.retired + ' instructions executed' }
    });
  }

  function paintAttribution(view) {
    const found = View.attribution(view.run.summary);

    fill('sth-attribution', found.rows.map(function (row) {
      return [row.name, row.cycles,
        (100 * row.cycles / found.cycles).toFixed(1) + '%', row.about];
    }));
    root.Helpers.setText('sth-attribution-caption', 'The stall row is the one this section '
      + 'moves. With one memory it holds every cycle the fetch stage spent waiting for the '
      + 'port; with two it holds only the load-use stalls the next section is about. The '
      + 'totals reconcile at ' + found.total + ' against ' + found.cycles + ' cycles, which '
      + 'is what makes the attribution worth reading at all.');
  }

  function paintDiagram(view) {
    root.jQuery('#sth-diagram').html(View.markup(view.run.machine, { cycles: view.cycles }));
    root.Helpers.setText('sth-diagram-note', view.unified
      ? 'With one memory, look for a row whose fetch repeats: that instruction could not be '
        + 'read because an older one was using the port. The outline marks it, and hovering '
        + 'gives the reason the simulator recorded.'
      : 'With two memories there is no contention to see, which is the point: every fetch '
        + 'happens in the cycle it was asked for. Tick the box above to put the stalls back.');
  }

  function paintCompare(view) {
    fill('sth-compare', NAMES.map(function (name) {
      const split = splitRun(name).summary;
      const unified = unifiedRun(name).summary;
      const cost = unified.cycles - split.cycles;

      return [name + (name === view.name ? ' <-' : ''), accessesIn(name),
        unified.cycles, split.cycles,
        cost === 0 ? 'nothing' : cost + ' cycles (' +
          (100 * cost / split.cycles).toFixed(1) + '%)'];
    }));
    root.Helpers.setText('sth-compare-caption', 'The second column predicts the fifth: a '
      + 'program that never touches memory pays nothing for sharing the port, and one with a '
      + 'load in every iteration pays a stall per load. That is the entire argument for a '
      + 'second memory, and it is a property of the workload rather than of the machine — '
      + 'which is why the answer is a measurement.');
  }

  function paintResolutions() {
    fill('sth-resolutions', [
      ['duplicate the resource', 'area and power: a whole second memory',
        'the conflict disappears entirely',
        'when the conflict is frequent — which is why first-level caches are split'],
      ['pipeline the resource', 'latency, and real design complexity',
        'the resource serves one request per cycle even though each takes several',
        'a multiplier, which is why multiplies are pipelined and divides are not'],
      ['stall', 'cycles, one per conflict',
        'nothing to build; it is the default and it always works',
        'when the conflict is rare, or when the resource is genuinely unaffordable'],
      ['split the access in time', 'a tighter timing budget',
        'two accesses per cycle from one structure',
        'a register file that writes in the first half of a cycle and reads in the second']
    ]);
    root.Helpers.setText('sth-resolutions-caption', 'The fourth row is the one that looks '
      + 'like cheating and is not: a register file really does write in one half of the cycle '
      + 'and read in the other, which is how three ports\' worth of work comes out of fewer. '
      + 'It costs timing margin, which is a real budget, and it is the same trick as '
      + 'double-buffering anything.');
  }

  function paintElsewhere() {
    fill('sth-elsewhere', [
      ['a memory port', 'split instruction and data caches',
        'the fetch waits a cycle', 'how many instructions touch memory'],
      ['a database connection', 'a bigger pool, and more memory on the server',
        'the request queues', 'arrival rate against service time — the M/M/c of M58'],
      ['a thread in an executor', 'more threads, and more context switching',
        'the task waits in the queue', 'whether the work is CPU-bound or waiting on I/O'],
      ['a lock', 'finer-grained locking, and more chances to get it wrong',
        'the thread blocks', 'how long the critical section is against how often it is entered']
    ]);
    root.Helpers.setText('sth-elsewhere-caption', 'Four resources, one decision. Every row is '
      + '"build another or wait for the one you have", every row has a measurable arrival '
      + 'rate and service time, and only the first one comes with the contention counted for '
      + 'you. That asymmetry is why the processor version is worth studying: it is the same '
      + 'problem with the instrumentation already fitted.');
  }

  function paintChart(app, view) {
    const host = root.jQuery('#sth-chart')[0];

    if (!host) return;
    if (chart) chart.destroy();
    chart = root.ErrorBandView.bars(host, {
      lazyLib: app.lazyLib, height: 250, yLabel: 'cycles',
      values: NAMES.reduce(function (out, name) {
        out.push({ label: name + ' unified', value: unifiedRun(name).summary.cycles,
          series: 0 });
        out.push({ label: name + ' split', value: splitRun(name).summary.cycles, series: 1 });
        return out;
      }, [])
    });
    root.Helpers.setText('sth-chart-note', 'Two bars per program: one memory and two. The '
      + 'gap is the price of sharing, and it tracks the memory-instruction count rather than '
      + 'the program length — the sum loop touches memory not at all and its bars are '
      + 'identical, while the load-heavy programs separate.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

/**
 * Section: Precise exceptions in a pipeline.
 *
 * Five fault classes, each raised by a program that runs, with the
 * architectural state at the handler compared against the M34 behavioural
 * simulator at the same retire count. That comparison is the definition of
 * precise: the pipelined machine has five instructions in flight and must
 * still produce exactly the state a machine executing strictly in order would
 * have produced.
 *
 * The mechanism in `pipeline.js` is the textbook one and its two halves are
 * both necessary. Younger instructions are squashed the moment the fault is
 * detected, so none of them can reach memory; the trap itself commits at
 * write-back, so older instructions still finish. Doing only the first would
 * lose completed work; doing only the second would let a younger store land
 * before the trap.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'precise-exceptions-pipelined';
  const Pipeline = root.Brv32.Pipeline;
  const Reference = root.Brv32.Reference;
  const Assembler = root.Brv32.Assembler;
  const Programs = root.Brv32.Programs;
  const Devices = root.Brv32.Devices;
  const Traps = root.Brv32.Traps;
  const View = root.PipelineView;
  let panel = null;

  const VECTOR = 0x100;
  const CLASSES = ['ecall', 'illegal', 'misalignedLoad', 'misalignedStore', 'unmapped'];
  const TAIL = '\n  li a3, 4\n  li a5, 7\nspin:\n  j spin\n';

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — the flag travels, and the trap commits at the end',
      caption: 'Two things happen and both are necessary. The moment a fault is detected, '
        + 'every younger instruction is squashed, so none of them can write a register or '
        + 'reach memory. The fault itself travels with its instruction to write-back and '
        + 'commits there, so every older instruction finishes normally first. Squashing '
        + 'without the delayed commit would throw away completed work; committing without the '
        + 'squash would let a younger store land before the trap.',
      definition: [
        'flowchart LR',
        '    F["fetch<br/>misaligned or unmapped"] -->|"flag"| D["decode<br/>illegal instruction"]',
        '    D -->|"flag"| E["execute<br/>ecall, ebreak"]',
        '    E -->|"flag"| M["memory<br/>misaligned or unmapped access"]',
        '    M -->|"flag"| W["write-back:<br/>the commit point"]',
        '    W --> T["trap: mepc, mcause, mtval,<br/>privilege, pc = mtvec"]',
        '    E -.->|"squash immediately"| Y["everything younger:<br/>no register write, no memory access"]',
        '    M -.->|"squash immediately"| Y'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**Precise means the machine can pretend it executed strictly in order.** When the '
        + 'handler runs, every instruction before the faulting one must have completed and '
        + 'none after it may have had any effect. That promise is what the entire software '
        + 'stack is built on: a debugger showing a coherent state, a page-fault handler '
        + 'restarting an access, a system call reading its arguments.',
      '**It is free on a single-cycle machine and it is not free here.** With one instruction '
        + 'at a time there is nothing to squash and nothing in flight. With five, an exception '
        + 'in the memory stage has two younger instructions already executing and two older '
        + 'ones not yet committed, and both directions have to be handled.',
      '**Faults are detected in different stages, and the flag travels with the '
        + 'instruction.** A misaligned fetch is known at fetch; an illegal opcode at decode; an '
        + 'environment call at execute; a misaligned or unmapped data access at memory. Each '
        + 'one is recorded on the instruction and carried down rather than acted on where it '
        + 'was found.',
      '**Squashing happens immediately; the trap commits at the end.** Younger instructions '
        + 'are killed as soon as the fault is detected, because a store two stages behind '
        + 'would otherwise reach memory before the trap. The trap itself waits until '
        + 'write-back so that older instructions finish — they are architecturally before the '
        + 'fault and must complete.',
      '**A fault on the wrong path is not a fault.** Fetch runs ahead of unresolved branches '
        + 'and regularly reads past the end of a program, decoding zeros as an illegal '
        + 'instruction. Those flags have to evaporate when the branch resolves and squashes '
        + 'them — a machine that acted on them would stop dead on the first mispredicted loop '
        + 'exit.',
      '**mret is serialising, and that is not a detail.** The return address lives in a control '
        + 'register that the handler has usually just written, and there is no forwarding path '
        + 'from a control register. So the pipeline drains before the return — which is part '
        + 'of why a trap costs far more than its instruction count suggests.',
      '**Branch misprediction recovery and exception recovery are the same machinery.** Both '
        + 'kill younger instructions and redirect fetch. That is not a coincidence: '
        + 'speculation is the ability to undo, and once a machine has it, exceptions come '
        + 'nearly free.',
      '**Everything in M36 exists to break the order while preserving the illusion.** '
        + 'Out-of-order execution finishes instructions in whatever order their operands '
        + 'allow, and then commits them in program order from a reorder buffer, precisely so '
        + 'that this section\'s promise still holds. The promise is the constraint the whole '
        + 'design is built around.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: { title: 'Interactive demo — a fault mid-pipeline, and the state at the handler',
        markup: root.PreciseTemplate.render() },
      diagram: diagram(),
      insight: insight()
    };
  }

  function insight() {
    return '**"Precise" is the name for a lie the hardware tells, and the entire software '
      + 'stack is built on believing it.** At the moment a fault is taken there are five '
      + 'instructions inside this machine at various stages of completion. Two of them are '
      + 'younger than the one that failed and already executing. The architecture promises that '
      + 'none of that is observable: the state is exactly what a machine doing one instruction '
      + 'at a time would have produced. Every debugger, every page-fault handler that fixes a '
      + 'mapping and re-runs the access, every context switch that saves a register set: all '
      + 'of them assume it. None of them would work without it. What makes this worth '
      + 'more than the mechanism is that it is the clearest example in the curriculum of an '
      + 'abstraction that is expensive precisely because it is simple. Keeping it costs a '
      + 'squash path, a commit point, and in M36 an entire reorder buffer. Abandoning it would '
      + 'save all of that and make the machine unprogrammable. That is the trade behind every '
      + 'strong guarantee in a system: serialisable transactions, exactly-once delivery, '
      + 'linearisable reads. The ones that survive are the ones where the '
      + 'implementation cost buys a simplification that everybody above them gets to assume.';
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });
    panel = root.ControlPanel.mount({
      controls: root.PreciseTemplate.controls,
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

  const imageFor = root.Helpers.memoise(function (name) {
    return Assembler.assemble(Programs.FAULTS[name] + TAIL, { origin: 0 });
  });

  const handler = root.Helpers.memoise(function () {
    return Assembler.assemble(Programs.INTERRUPT_HANDLER, { origin: VECTOR });
  });

  const runOf = root.Helpers.memoise(function (name) {
    const image = imageFor(name);
    const machine = Pipeline.create({ image: image.bytes, entry: 0 });

    Devices.loadImage(machine.memory, VECTOR, handler('one').bytes);
    Pipeline.run(machine, { cycles: 200 });
    return { machine: machine, summary: Pipeline.summary(machine) };
  });

  /** The same program on the behavioural machine, stepped to the same number
   *  of retired instructions. Anything the pipeline did that a strictly
   *  in-order machine would not have done shows up here. */
  const referenceFor = root.Helpers.memoise(function (name) {
    const run = runOf(name);
    const image = imageFor(name);
    const machine = Reference.create({ image: image.bytes, entry: 0 });

    Devices.loadImage(machine.memory, VECTOR, handler('one').bytes);
    for (let at = 0; at < run.machine.retired; at += 1) Reference.step(machine);
    return Reference.snapshot(machine);
  });

  function differencesFor(name) {
    return Reference.differences(Pipeline.snapshot(runOf(name).machine), referenceFor(name))
      .filter(function (row) { return row.field !== 'pc'; });
  }

  function reading() {
    const values = panel.values();

    return { name: values['pex-fault'], cycles: Number(values['pex-cycles']),
      run: runOf(values['pex-fault']), differences: differencesFor(values['pex-fault']) };
  }

  /* --------------------------------------------------------------- render */

  function update(app) {
    const view = reading();

    paintMetrics(view);
    paintTrace(view);
    paintDiagram(view);
    paintClasses(view);
    paintRules();
    paintSingle(view);
    paintOoo();
  }

  function firstTrap(name) {
    return runOf(name).machine.traps.taken[0] || null;
  }

  /**
   * The events that matter, which is not all of them.
   *
   * Fetch runs ahead of every unresolved branch, so it repeatedly reads past
   * the end of the program and decodes zeros as an illegal instruction. Those
   * faults are detected and then squashed when the branch resolves, and they
   * never commit. Showing them would fill this table with faults that did not
   * happen, so a fault is listed only if a trap with the same instruction id
   * followed it.
   */
  function faultEvents(name) {
    const machine = runOf(name).machine;
    const committed = new Set();
    const out = [];

    machine.log.forEach(function (cycle) {
      cycle.events.forEach(function (event) {
        if (event.kind === 'trap') committed.add(event.id);
      });
    });
    machine.log.forEach(function (cycle) {
      cycle.events.forEach(function (event) {
        if (['fault', 'trap', 'resume', 'serialise'].indexOf(event.kind) === -1) return;
        if (event.kind === 'fault' && !committed.has(event.id)) return;
        out.push({ cycle: cycle.cycle, event: event });
      });
    });
    return out;
  }

  /** How many faults were detected and then thrown away with the wrong-path
   *  instruction carrying them. */
  function speculativeFaults(name) {
    const machine = runOf(name).machine;
    const committed = new Set();
    let seen = 0;

    machine.log.forEach(function (cycle) {
      cycle.events.forEach(function (event) {
        if (event.kind === 'trap') committed.add(event.id);
      });
    });
    machine.log.forEach(function (cycle) {
      cycle.events.forEach(function (event) {
        if (event.kind === 'fault' && !committed.has(event.id)) seen += 1;
      });
    });
    return seen;
  }

  function drainOf(name) {
    const events = faultEvents(name);
    const detected = events.filter(function (row) { return row.event.kind === 'fault'; })[0];
    const committed = events.filter(function (row) { return row.event.kind === 'trap'; })[0];

    if (!detected || !committed) return null;
    return committed.cycle - detected.cycle;
  }

  function paintMetrics(view) {
    const trap = firstTrap(view.name);
    const machine = view.run.machine;

    root.MetricGrid.update({
      'pex-cause': { value: trap ? trap.cause : 'none',
        note: trap ? trap.name : 'nothing faulted' },
      'pex-epc': { value: trap ? '0x' + trap.pc.toString(16) : '-',
        note: 'the faulting instruction, not the one after it' },
      'pex-tval': { value: '0x' + (machine.traps.csrs[Traps.CSR.mtval] >>> 0).toString(16),
        note: 'the offending address or instruction word' },
      'pex-squashed': { value: view.run.summary.squashed,
        note: 'fetched after the fault and never committed' },
      'pex-precise': { value: view.differences.length === 0 ? 'identical' : 'DIFFERS',
        note: view.differences.length === 0
          ? 'against the behavioural machine at ' + machine.retired + ' retired instructions'
          : view.differences.length + ' registers differ, which means it is not precise' },
      'pex-drain': { value: drainOf(view.name) === null ? '-' : drainOf(view.name),
        note: 'detection to commit, while older instructions finished' }
    });
  }

  const MEANING = {
    fault: 'detected here; everything younger is squashed immediately',
    trap: 'committed at write-back; the CSRs are written and fetch is redirected',
    serialise: 'the pipeline drains, because there is no forwarding from a control register',
    resume: 'fetch restarts'
  };

  function paintTrace(view) {
    fill('pex-trace', faultEvents(view.name).slice(0, 12).map(function (row) {
      return [row.cycle, row.event.stage, row.event.kind + ': ' + (row.event.reason || ''),
        MEANING[row.event.kind] || ''];
    }));
    root.Helpers.setText('pex-trace-caption', traceCaption(view));
  }

  function traceCaption(view) {
    const drain = drainOf(view.name);

    if (drain === null) return 'No fault was raised on this program.';
    return 'The fault is detected and the trap commits ' + drain + ' cycles later. Those '
      + 'cycles are not wasted: they are the older instructions finishing, which is the half '
      + 'of precision that squashing alone does not give you. The handler entry then drains '
      + 'the pipeline again, because mret and the control-register writes before it are '
      + 'serialising. This run also detected ' + speculativeFaults(view.name) + ' further '
      + 'faults that are not listed, every one of them on an instruction fetched past the end '
      + 'of a mispredicted branch — they were squashed with it and never committed, which is '
      + 'exactly what a speculative fault has to do.';
  }

  function paintDiagram(view) {
    root.jQuery('#pex-diagram').html(View.markup(view.run.machine, { cycles: view.cycles }));
    root.Helpers.setText('pex-diagram-note', 'Find the faulting instruction, then look at the '
      + 'rows below it: they stop. Those instructions were fetched, decoded and in some cases '
      + 'executed, and they left nothing behind — no register written, no memory touched. The '
      + 'rows above it continue to write-back, because they are architecturally before the '
      + 'fault and have to finish.');
  }

  function paintClasses(view) {
    fill('pex-classes', CLASSES.map(function (name) {
      const trap = firstTrap(name);
      const machine = runOf(name).machine;
      const differences = differencesFor(name);

      return [name + (name === view.name ? ' <-' : ''),
        stageFor(name), trap ? trap.cause : '-',
        trap ? '0x' + trap.pc.toString(16) : '-',
        '0x' + (machine.traps.csrs[Traps.CSR.mtval] >>> 0).toString(16),
        differences.length === 0 ? 'yes' : 'NO'];
    }));
    root.Helpers.setText('pex-classes-caption', 'Five classes detected in three different '
      + 'stages, and the last column is the acceptance criterion: at the same number of '
      + 'retired instructions, the pipelined machine\'s registers are identical to the '
      + 'behavioural machine\'s. It has five instructions in flight and produces the state of '
      + 'a machine that has one.');
  }

  const STAGES = { ecall: 'execute', illegal: 'decode', misalignedLoad: 'memory',
    misalignedStore: 'memory', unmapped: 'memory' };

  function stageFor(name) {
    return STAGES[name] || 'unknown';
  }

  function paintRules() {
    fill('pex-rules', [
      ['every older instruction has completed',
        'the trap commits at write-back, so anything ahead of it has already retired',
        'a handler sees a half-finished computation and a debugger shows a state that never existed'],
      ['no younger instruction has had any effect',
        'younger instructions are squashed the moment the fault is detected',
        'a store two stages behind the fault reaches memory before the trap'],
      ['mepc names the faulting instruction',
        'the address is carried with the instruction from the stage that fetched it',
        'a page-fault handler cannot restart the access it was supposed to fix'],
      ['a wrong-path fault never commits',
        'the flag is squashed with the instruction when the branch resolves',
        'the machine traps on zeros it fetched past the end of a mispredicted loop']
    ]);
    root.Helpers.setText('pex-rules-caption', 'The fourth row is the one that is easy to miss '
      + 'and stops the machine dead. Fetch runs ahead of every unresolved branch and reads '
      + 'whatever is there; decoding that as an illegal instruction is correct, and acting on '
      + 'it is not. The flag has to be as speculative as the instruction carrying it.');
  }

  function paintSingle(view) {
    const trap = firstTrap(view.name);

    fill('pex-single', [
      ['how many instructions are in flight', '1', '5',
        'four of them have to be accounted for at every fault'],
      ['what has to be squashed', 'nothing', 'everything younger than the fault',
        'a squash path from every stage back to fetch'],
      ['when the trap is taken', 'immediately',
        'when the faulting instruction reaches write-back',
        drainOf(view.name) === null ? 'no fault here' : drainOf(view.name) + ' cycles later'],
      ['what precision costs', 'nothing — it is structural',
        'a flag per stage, a squash path and a commit point',
        'and in M36, a reorder buffer for the whole machine']
    ]);
    root.Helpers.setText('pex-single-caption', 'The M34 machine got precision for free because '
      + 'it never had anything to be imprecise about. Every row here is a cost that appeared '
      + 'the moment instructions overlapped, and every one of them is paid to produce exactly '
      + 'the behaviour the simpler machine had by construction — which is what an abstraction '
      + 'costs once the implementation stops matching it.');
  }

  function paintOoo() {
    fill('pex-ooo', [
      ['instructions finish in program order', 'yes, by construction: write-back is in order',
        'no — a reorder buffer holds results until they can commit in order'],
      ['a squashed instruction has had no effect',
        'yes: nothing before write-back changes state',
        'harder: a store buffer holds writes that must be discardable'],
      ['registers are written once, in order', 'yes',
        'renaming means several physical registers per architectural one, and a map to unwind'],
      ['an exception is detected before anything younger commits',
        'yes: younger instructions are behind it in the pipeline',
        'younger instructions may have finished already, and must be thrown away']
    ]);
    root.Helpers.setText('pex-ooo-caption', 'Every row that says "yes, by construction" here '
      + 'becomes a hardware structure in M36. That is the shape of the whole next milestone: '
      + 'it breaks the ordering this machine had for free, and then rebuilds the appearance of '
      + 'it out of a reorder buffer, a rename table and a store buffer — because the promise '
      + 'on this page is not negotiable.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

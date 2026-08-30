/**
 * Section: The reorder buffer and precise state.
 *
 * M35 raised five fault classes with five instructions in flight. This page
 * raises the same five with a full reorder buffer, which is the difference the
 * milestone is about: everything between execution and commit is speculative,
 * and the reorder buffer is the structure that holds it there.
 *
 * Getting the window genuinely full took two attempts and the first one is
 * recorded in `fixture()`, because it looked right and was not. Every fixture
 * is checked against the M34 behavioural simulator at the same retire count,
 * which is the only claim worth making here.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'reorder-buffer-and-precise-state';
  const Lab = root.OooLab;
  const Table = root.DataTable;
  const View = root.OooView;
  const Core = root.OooCore;
  const Reference = root.Brv32.Reference;
  const Assembler = root.Brv32.Assembler;
  const Traps = root.Brv32.Traps;
  const SIZES = [4, 8, 16, 32, 64, 128];
  const SWEEP = ['chain', 'independent', 'stride', 'chase', 'factorial'];
  const CHAIN = 9;
  const TAIL = 40;

  /**
   * The five fault classes, each reached through the chained address so the
   * fault is detected late. They are written out rather than taken from
   * `Programs.FAULTS`, because those fixtures compute their address in one
   * instruction and would fault immediately.
   */
  const FAULTS = {
    ecall: ['  add a0, a0, t0', '  ecall'],
    illegal: ['  add a0, a0, t0', '  .word 0xffffffff'],
    misalignedLoad: ['  li a0, 0x10000000', '  add a0, a0, t0', '  lw a1, 0(a0)'],
    misalignedStore: ['  li a0, 0x10000000', '  add a0, a0, t0', '  sw a1, 0(a0)'],
    unmapped: ['  li a0, 0x40000000', '  add a0, a0, t0', '  lw a1, 0(a0)']
  };
  const cache = {};
  let panel = null;
  let chart = null;

  const STATES = [
    { state: 'waiting (W)', where: 'nowhere yet — the operands have not arrived',
      visible: 'no', squash: 'removed from the issue queue' },
    { state: 'executing (X)', where: 'a functional unit',
      visible: 'no', squash: 'removed; the unit finishes and the result is dropped' },
    { state: 'complete (C)', where: 'a physical register, and the load/store queue for a store',
      visible: 'no — this is the whole point', squash: 'the register goes back on the free list' },
    { state: 'committed (R)', where: 'the architectural mapping, and memory for a store',
      visible: 'yes, and irrevocably', squash: 'nothing can squash it; commit is the point of no return' }
  ];

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  /* --------------------------------------------------------- the fixtures */

  /**
   * The faulting address is produced by a dependence chain, and independent
   * work follows it.
   *
   * The obvious fixture - forty additions and then a fault - does not do what
   * it looks like it does. The additions are independent, so they retire
   * almost as fast as they arrive, and by the time the faulting instruction
   * reaches the head of the buffer the window has drained to three entries.
   * The demo would then show a precise exception with almost nothing in
   * flight, which proves nothing that M35 had not already shown.
   *
   * Making the faulting address depend on a chain fixes it: the faulting
   * instruction sits at the head unable to finish while the independent work
   * behind it fills all thirty-two entries. When the fault finally commits,
   * every one of them is squashed and none has touched architectural state.
   */
  function fixture(kind) {
    const step = kind === 'unmapped' ? 4 : 1;
    const names = ['t1', 't2', 't3', 't4'];
    const lines = ['  # a chain, so the faulting address arrives late', '  li t0, 0'];

    for (let at = 0; at < CHAIN; at += 1) lines.push('  addi t0, t0, ' + step);
    FAULTS[kind].forEach(function (line) { lines.push(line); });
    lines.push('  # independent work behind it, which must never become visible');
    for (let at = 0; at < TAIL; at += 1) {
      lines.push('  addi ' + names[at % names.length] + ', zero, ' + (at + 1));
    }
    return lines.concat(['  ecall']).join('\n');
  }

  function runFault(kind, capacity) {
    const key = kind + ' ' + capacity;

    if (cache[key]) return cache[key];
    const image = Assembler.assemble(fixture(kind), { origin: 0 });
    const core = Core.create({ image: image.bytes, entry: 0, width: 4,
      capacity: capacity, queueSize: 64, physical: 128 });

    Core.run(core, { cycles: 4000, stopOnTrap: true });
    cache[key] = { core: core, summary: Core.summary(core),
      differences: differencesFor(image, core), inFlight: inFlightAtFault(core) };
    return cache[key];
  }

  /** The state the machine reached, against a machine that never had more than
   *  one instruction in flight, stepped the same number of times. */
  function differencesFor(image, core) {
    const reference = Reference.create({ image: image.bytes, entry: 0 });

    for (let at = 0; at < core.retired; at += 1) Reference.step(reference);
    return Reference.differences(Core.snapshot(core), Reference.snapshot(reference))
      .filter(function (row) { return row.field !== 'pc'; });
  }

  /**
   * How many instructions were in flight in the cycle before the trap.
   *
   * Not the cycle of the trap itself: the squash happens before the log entry
   * is written, so that row always reads zero and would report every fault as
   * having been raised into an empty machine.
   */
  function inFlightAtFault(core) {
    let at = -1;

    core.log.forEach(function (row) {
      if (at < 0 && row.events.some(function (event) { return event.kind === 'trap'; })) {
        at = row.cycle;
      }
    });
    return at > 0 ? core.log[at - 1].window.length : 0;
  }

  function csr(core, name) {
    return Traps.read(core.traps, Traps.CSR[name]) | 0;
  }

  /* ------------------------------------------------------------- the frame */

  function diagram() {
    return {
      title: 'Diagram — finishing out of order, becoming real in order',
      caption: 'Four instructions finish in the order their operands allowed: the second one '
        + 'first, then the fourth, then the first, then the third. Not one of them has '
        + 'changed anything a program could observe. The buffer holds them until the oldest '
        + 'is finished, and only then does anything architectural happen — which is why an '
        + 'exception taken at instruction 3 can leave a state in which 1 and 2 happened and '
        + '4 did not, even though 4 finished executing first.',
      definition: [
        'flowchart LR',
        '    subgraph exec["execution: whenever operands allow"]',
        '        E2["i2 done, cycle 5"]',
        '        E4["i4 done, cycle 6"]',
        '        E1["i1 done, cycle 9"]',
        '        E3["i3 done, cycle 11"]',
        '    end',
        '    subgraph rob["reorder buffer: program order, oldest at the head"]',
        '        R1["i1"] --> R2["i2"] --> R3["i3"] --> R4["i4"]',
        '    end',
        '    E1 --> R1',
        '    E2 --> R2',
        '    E3 --> R3',
        '    E4 --> R4',
        '    R1 -->|"head, and finished"| C["commit: registers, memory, CSRs"]',
        '    R3 -->|"faulted"| S["squash everything younger, then trap"]'
      ].join('\n')
    };
  }

  function orientation() {
    return opening().concat(closing());
  }

  function opening() {
    return [
      '**Commit is the only place anything becomes real, and it happens in program order.** '
        + 'Execution finishes in whatever order the operands allowed; the reorder buffer holds '
        + 'every finished instruction until the oldest one is done, then retires them oldest '
        + 'first. That single rule is what lets a machine with forty instructions in flight '
        + 'pretend to be a machine with one.',
      '**A result that exists is not a result that happened.** Between execution and commit '
        + 'the value sits in a physical register, and a store sits in the load/store queue '
        + 'holding its address and data. Nothing in the architectural state has moved. That is '
        + 'why a squash costs nothing but the work: there is no undo, because nothing was ever '
        + 'done.',
      '**Stores are the clearest case and the reason the rule is absolute.** A speculative '
        + 'store that reached memory could not be taken back — memory has no free list and no '
        + 'checkpoint. So a store waits in the queue until it commits, and a younger load that '
        + 'wants the same address is given the value from the queue rather than from memory '
        + '(36.6).',
      '**A precise exception means the handler sees exactly the state it would have seen on a '
        + 'machine that did one instruction at a time.** Everything before the faulting '
        + 'instruction has committed; nothing after it has. The demo raises five fault classes '
        + 'with all 32 buffer entries occupied, squashes the 39 instructions behind the fault '
        + '- 31 of them in the buffer and 8 more still in the fetch buffer - and compares the '
        + 'resulting state against the M34 behavioural simulator register by register at the '
        + 'same retire count.',
      '**A fault has to be detected without being taken.** A store\'s address can be '
        + 'misaligned, and the machine has to know that when the address is computed, not when '
        + 'the store writes — because it must not write. This simulator carried exactly that '
        + 'bug: it checked a store\'s legality by attempting the write, so a misaligned store '
        + 'never faulted at all while the in-order reference trapped on the same instruction.'
    ];
  }

  function closing() {
    return [
      '**Nothing on the wrong path can fault.** Fetch runs far ahead of every unresolved '
        + 'branch, so it reads past the end of programs constantly and decodes zeros as '
        + 'illegal instructions. Those faults are real and they are also irrelevant: they are '
        + 'discarded with the rest of the wrong path, and a machine that took them would trap '
        + 'on code it never executed. The illegal-instruction fixture is the one row with an '
        + 'almost empty window for the opposite reason: an illegal opcode is detected at '
        + 'decode and stops the front end, so nothing younger is ever fetched.',
      '**The buffer\'s size is how far ahead the machine may run, and it is a hard bound.** '
        + 'When it is full nothing can be dispatched however ready it is. On `stride` the '
        + 'sweep runs 463 cycles at 4 entries and 108 at 64; on `chain` it is 38 at every '
        + 'size, because a dependence chain never has anything waiting to dispatch.',
      '**That bound is the real reason reorder buffers keep growing.** A load that misses in '
        + 'the cache sits at the head for the whole miss, and every cycle of that miss is a '
        + 'cycle in which the machine can only run as far ahead as the buffer allows. Two '
        + 'hundred cycles of memory latency is why the number went from 40 entries in the mid '
        + '1990s to over 500 today.',
      '**Bigger is not monotonically better, and the sweep shows it.** `arrayMax` takes 52 '
        + 'cycles at 32 entries and 54 at 64: a deeper window speculates further past an '
        + 'unresolved branch, and when the branch turns out to be wrong there is more to throw '
        + 'away. Window size buys memory-level parallelism and pays for it in wasted work.'
    ];
  }

  function insight() {
    return '**The reorder buffer is the general answer to a problem that is not about '
      + 'processors: how to do work speculatively and stay able to pretend you did not.** '
      + 'The recipe has three parts and they show up together every time. Do the work '
      + 'somewhere private — a physical register here, a shadow page in a copy-on-write file '
      + 'system, an uncommitted transaction\'s row versions, a git branch. Keep an ordered '
      + 'record of what is outstanding — the buffer, the write-ahead log, the reflog. And '
      + 'have exactly one point at which private becomes public, so that the question "did '
      + 'this happen" has a single answer — commit here, fsync of the log there, the atomic '
      + 'rename of a superblock, the merge. Systems that get this right can be interrupted at '
      + 'any instant and still explain themselves; systems that get it wrong are the ones '
      + 'where a crash leaves a state that no execution could have produced, and where the '
      + 'recovery code is a pile of special cases. The processor version is unusually strict, '
      + 'because it has to make the guarantee forty times a nanosecond and it is not allowed '
      + 'to be slow about it — which is exactly why it is the cleanest example of the pattern '
      + 'to learn it from.';
  }

  function config() {
    return { sectionId: SECTION_ID, orientation: orientation(),
      demo: { title: 'Interactive demo — a fault with the window full',
        markup: root.RobTemplate.render() },
      diagram: diagram(), insight: insight() };
  }

  /* ------------------------------------------------------------- plumbing */

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });
    panel = root.ControlPanel.mount({ controls: root.RobTemplate.controls,
      onChange: function () { update(app); } });
    update(app);
  }

  function reading() {
    const values = panel.values();
    const capacity = Number(values['rob-capacity']);

    return { kind: values['rob-fault'], capacity: capacity,
      cycles: Number(values['rob-cycles']), run: runFault(values['rob-fault'], capacity) };
  }

  function update(app) {
    const view = reading();

    paintMetrics(view);
    paintFaults(view);
    paintWindow(view);
    paintStates();
    paintCapacity();
    paintChart(app, view);
  }

  function paintMetrics(view) {
    const core = view.run.core;
    const taken = core.traps.taken[0];

    root.MetricGrid.update({
      'rob-cause': { value: csr(core, 'mcause'),
        note: taken ? taken.name : 'the program ran to completion' },
      'rob-epc': { value: '0x' + (csr(core, 'mepc') >>> 0).toString(16),
        note: 'exactly the faulting instruction, not one near it' },
      'rob-tval': { value: '0x' + (csr(core, 'mtval') >>> 0).toString(16),
        note: 'the address or the word the handler needs' },
      'rob-inflight': { value: view.run.inFlight,
        note: 'in a buffer of ' + view.capacity + ' entries' },
      'rob-squashed': { value: core.counters.squashed,
        note: 'discarded without ever touching architectural state' },
      'rob-precise': { value: view.run.differences.length ? 'DIFFERS' : 'identical',
        note: view.run.differences.length
          ? view.run.differences.length + ' fields disagree with the in-order machine'
          : 'every register and CSR matches the in-order reference' }
    });
  }

  function paintFaults(view) {
    Table.paint('rob-faults', root.RobTemplate.FAULTS.map(function (option) {
      const found = runFault(option.value, view.capacity);
      const core = found.core;

      return [option.value, csr(core, 'mcause'),
        '0x' + (csr(core, 'mepc') >>> 0).toString(16), found.inFlight,
        core.counters.squashed,
        { value: found.differences.length ? found.differences.length : 'none',
          className: found.differences.length ? 'bad' : '' }];
    }), 'Five fault classes, each reached through a dependence chain so the faulting '
      + 'instruction sits at the head of a buffer of ' + view.capacity + ' entries while the '
      + 'independent work behind it fills every one of them. The last column is the claim: at '
      + 'the same retire count, this machine\'s registers and control registers are identical '
      + 'to those of a simulator that never had more than one instruction in flight. The '
      + 'illegal-instruction row is the exception with almost nothing in flight, and that is '
      + 'correct rather than a failure — an illegal opcode is detected at decode and stops the '
      + 'front end, so there is nothing younger to squash.');
  }

  function paintWindow(view) {
    root.jQuery('#rob-window').html(View.markup(view.run.core, { cycles: view.cycles }));
    root.jQuery('#rob-legend').html(View.legend());
    root.Helpers.setText('rob-window-note', 'The C cells are the reorder buffer\'s whole '
      + 'job: an instruction that has finished and is waiting for every older instruction to '
      + 'commit first. Read down a column near the fault and you can see the squash — a block '
      + 'of S cells, all younger than the faulting instruction, discarded in one cycle. Not '
      + 'one of them wrote a register the program can see.');
  }

  function paintStates() {
    Table.paint('rob-states', STATES.map(function (row) {
      return [row.state, row.where, row.visible, row.squash];
    }), 'Three of the four rows say the result is not visible, and that is the mechanism. '
      + 'There is no undo operation anywhere in this machine: a squash is a deletion of '
      + 'bookkeeping, because nothing outside the bookkeeping had changed. The one row where '
      + 'that stops being true is the last, and it is the reason a store waits in the queue '
      + 'until it reaches the head.');
  }

  function paintCapacity() {
    Table.paint('rob-capacity-table', SIZES.map(function (size) {
      return [size].concat(SWEEP.map(function (name) {
        return Lab.summary(name, { width: 4, capacity: size, queueSize: 128,
          physical: 192 }).cycles;
      }));
    }), 'The physical register file and the issue queue are held large here so the buffer is '
      + 'the only limit. `chain` is flat at every size — a dependence chain never has anything '
      + 'waiting to dispatch, so the window is a spectator. `stride` falls from 463 cycles to '
      + '108, because every entry it can hold is another load whose miss can overlap with the '
      + 'others. That contrast is the whole argument for a large window, and 36.6 measures it '
      + 'directly.');
  }

  function paintChart(app, view) {
    const host = root.jQuery('#rob-chart')[0];

    if (!host) return;
    if (chart) chart.destroy();
    const series = View.occupancy(view.run.core);

    chart = root.GrowthPlot.render(host, { lazyLib: app.lazyLib, height: 240,
      xLabel: 'cycle', yLabel: 'entries in the buffer',
      series: [
        { label: 'occupancy', points: series.map(function (row) {
          return { x: row.cycle, y: row.used };
        }) },
        { label: 'capacity', points: series.map(function (row) {
          return { x: row.cycle, y: row.capacity };
        }), dashed: true }
      ] });
    root.Helpers.setText('rob-chart-note', chartNote(view, series));
  }

  function chartNote(view, series) {
    const peak = series.reduce(function (most, row) { return Math.max(most, row.used); }, 0);
    const full = series.filter(function (row) { return row.used >= row.capacity; }).length;

    return 'The buffer fills to ' + peak + ' of ' + view.capacity + ' entries and spends '
      + full + ' of ' + series.length + ' cycles completely full. Every full cycle is one in '
      + 'which nothing could be dispatched however ready it was — the fall at the end is the '
      + 'squash, which empties in a single cycle everything younger than the fault.';
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

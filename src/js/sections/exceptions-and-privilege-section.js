/**
 * Section: Exceptions, interrupts and privilege.
 *
 * A trap is the only way control leaves a program without the program asking,
 * and the mechanism is small enough to state completely: save the address of
 * the offending instruction, record why, switch privilege, jump to a fixed
 * handler. `mret` undoes exactly those four things.
 *
 * The demo raises every class from a real program and shows the CSRs the
 * hardware wrote. Its sharpest moment is the handler control: a handler that
 * always skips four bytes is correct for every synchronous exception and
 * wrong for an interrupt, and running the same timer interrupt through both
 * shows 1 trap and a finished program against 5 traps and a register that
 * never got its value.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'exceptions-and-privilege';
  const Assembler = root.Brv32.Assembler;
  const Reference = root.Brv32.Reference;
  const Programs = root.Brv32.Programs;
  const Traps = root.Brv32.Traps;
  const Devices = root.Brv32.Devices;
  const Isa = root.Brv32.Isa;
  let panel = null;
  let chart = null;

  const VECTOR = 0x100;
  const BUDGET = 30;
  const CLASSES = ['ecall', 'illegal', 'misalignedLoad', 'misalignedStore', 'unmapped', 'timer'];
  const TIMER_BODY = '  li a0, 1\n  li a1, 2\n  li a2, 3\n  li a3, 4\n';

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — a trap, from the offending instruction to the return',
      caption: 'Four things happen in hardware and nothing else: the address of the offending '
        + 'instruction goes into mepc, the reason into mcause, the offending value into mtval, '
        + 'and the program counter becomes mtvec with the privilege raised. mret undoes '
        + 'exactly those. Everything the operating-system track builds later is policy '
        + 'written on top of this.',
      definition: [
        'sequenceDiagram',
        '    participant P as the program',
        '    participant H as the hardware',
        '    participant K as the handler at 0x100',
        '    P->>H: lw a1, 0(a0) with a0 = 0x10000001',
        '    H->>H: mepc = the address of THIS instruction',
        '    H->>H: mcause = 4, mtval = 0x10000001',
        '    H->>H: mode = machine',
        '    H->>K: pc = mtvec',
        '    K->>K: read mcause, decide what to do',
        '    K->>H: mret',
        '    H->>P: pc = mepc, mode restored'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**A trap is the only way control leaves a program without the program asking.** The '
        + 'hardware saves where it was, records why, raises the privilege and jumps to a fixed '
        + 'address. Four register writes and a jump: that is the entire mechanism. Every '
        + 'system call, page fault, timer preemption and segmentation fault in M41 to M46 is '
        + 'this with policy on top.',
      '**Synchronous exceptions are caused by an instruction; asynchronous interrupts are '
        + 'not.** An illegal instruction, a misaligned access and an ecall are all consequences '
        + 'of the instruction at mepc, and re-running that instruction would raise them again. '
        + 'A timer interrupt has nothing to do with the instruction it happened to land '
        + 'between, and the sign bit of mcause is what says which kind you are looking at.',
      '**The two kinds need opposite return addresses, and getting it wrong is silent.** An '
        + 'exception has already happened, so the handler resumes after the instruction. An '
        + 'interrupt arrived between instructions, so the handler must resume at the one it '
        + 'interrupted — otherwise that instruction never executes. The demo runs the same '
        + 'interrupt through both handlers and one of them loses a register.',
      '**mepc holds the offending instruction, not the one after it.** That is a deliberate '
        + 'choice: a page-fault handler needs to restart the access it could not complete, '
        + 'which it cannot do if the address was lost. It also means an ecall handler has to '
        + 'add four itself, and an off-by-four here is the classic way to make a handler loop '
        + 'forever on the same instruction.',
      '**Precise means everything before is done and nothing after has happened.** When the '
        + 'handler runs, the machine state must look exactly as if execution stopped cleanly at '
        + 'mepc. On this single-cycle machine that is free, which is exactly why it is worth '
        + 'naming here. The moment M35 pipelines this datapath, five instructions are in '
        + 'flight and keeping the promise costs real hardware.',
      '**A device that cannot be acknowledged raises the same interrupt forever.** The timer '
        + 'here is cleared by writing its compare register, and a handler that returns without '
        + 'doing so is re-entered immediately. That is a livelock rather than a crash, and it '
        + 'is why every interrupt handler ever written ends by touching the device.',
      '**Privilege is a two-bit register plus the checks the hardware performs against it.** '
        + 'A trap raises the mode and mret restores it; the mode decides which instructions and '
        + 'which control registers are reachable. There is nothing more to it at this level, '
        + 'and everything about kernels and system calls is built from exactly this.',
      '**A system call is a deliberate exception, which is the whole trick.** The ecall '
        + 'instruction does not jump anywhere the program chose. It traps, so the kernel '
        + 'decides where control goes and at what privilege. That is why a system call is the '
        + 'only way into a kernel, and why its cost is a trap rather than a call. M45 spends a '
        + 'lot of effort working around that.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: { title: 'Interactive demo — raise every class, and watch the return',
        markup: root.TrapsTemplate.render() },
      diagram: diagram(),
      insight: insight()
    };
  }

  function insight() {
    return '**The whole user/kernel boundary is four register writes and a jump.** The '
      + 'reason it is trustworthy is that the program does not get to choose any of them. A '
      + 'call goes where the caller says. A trap goes where mtvec says, at a privilege the '
      + 'hardware raises, with the return address in a register the unprivileged program cannot '
      + 'write. That asymmetry is the entire security argument. It is why a system call '
      + 'costs a trap rather than a jump: you are not calling the kernel, you are stopping and '
      + 'letting the kernel decide. Preemptive scheduling, memory protection, the system call '
      + 'interface, virtualisation: everything in M41 to M46 is policy layered on this '
      + 'mechanism, and none of it is stronger than the mechanism. The transferable idea is '
      + 'about who chooses the entry point. Any boundary where the untrusted side picks the '
      + 'destination is not a boundary; it is a convention. That is the difference between a '
      + 'callback registered by a plugin and a message posted to a queue the host owns. It is '
      + 'the difference between a URL a client supplies and a route table the server keeps. It '
      + 'is the difference between a function pointer in writable memory and a jump table the '
      + 'hardware refuses to let you change. The single-entry handler looks like a limitation until you notice it '
      + 'is the feature.';
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });
    panel = root.ControlPanel.mount({
      controls: root.TrapsTemplate.controls,
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

  function sourceFor(name) {
    const body = name === 'timer' ? TIMER_BODY : Programs.FAULTS[name] + '\n  li a3, 4\n';

    return body + 'spin:\n  j spin\n';
  }

  const handlerImage = root.Helpers.memoise(function (kind) {
    return Assembler.assemble(kind === 'skip' ? Programs.HANDLER
      : Programs.INTERRUPT_HANDLER, { origin: VECTOR });
  });

  /** One run, with the handler loaded at the trap vector and the trace kept.
   *  The trace is what turns "a trap happened" into something a reader can
   *  follow instruction by instruction. */
  const runOf = root.Helpers.memoise(function (key) {
    const parts = JSON.parse(key);
    const image = Assembler.assemble(sourceFor(parts.name), { origin: 0 });
    const machine = Reference.create({ image: image.bytes, entry: 0 });

    Devices.loadImage(machine.memory, VECTOR, handlerImage(parts.handler).bytes);
    if (parts.name === 'timer') armTimer(machine);
    return { image: image, machine: machine, trace: trace(machine) };
  });

  function armTimer(machine) {
    machine.traps.csrs[Traps.CSR.mie] = 1 << Traps.INTERRUPT_TIMER;
    machine.memory.timer.compare = 3;
  }

  function trace(machine) {
    const steps = [];

    for (let at = 0; at < BUDGET; at += 1) {
      const pc = machine.pc >>> 0;
      const word = Reference.fetch(machine).word || 0;
      const decoded = Isa.decode(word);
      const before = machine.traps.taken.length;
      const out = Reference.step(machine);

      steps.push({ pc: pc, text: decoded.ok ? decoded.name : 'not an instruction',
        mode: machine.traps.mode === Traps.MODE.machine ? 'machine' : 'user',
        trapped: machine.traps.taken.length > before,
        taken: machine.traps.taken[machine.traps.taken.length - 1],
        mret: Boolean(out.mret) });
    }
    return steps;
  }

  function reading() {
    const values = panel.values();
    const key = JSON.stringify({ name: values['trp-class'], handler: values['trp-handler'] });

    return { name: values['trp-class'], handler: values['trp-handler'],
      steps: Number(values['trp-step']), run: runOf(key),
      state: Reference.snapshot(runOf(key).machine) };
  }

  /* --------------------------------------------------------------- render */

  function update(app) {
    const view = reading();

    paintMetrics(view);
    paintCsrs(view);
    paintTrace(view);
    paintClasses(view);
    paintHandlers(view);
    paintPrivilege(view);
    paintChart(app, view);
  }

  function hex(value) {
    return '0x' + ((value >>> 0).toString(16));
  }

  function firstTrap(view) {
    return view.run.machine.traps.taken[0] || null;
  }

  function paintMetrics(view) {
    const trap = firstTrap(view);
    const csrs = view.run.machine.traps.csrs;

    root.MetricGrid.update({
      'trp-cause': { value: trap ? describeCause(trap.cause) : 'none',
        note: trap ? (trap.interrupt ? 'asynchronous — the sign bit is set'
          : 'synchronous — caused by the instruction at mepc') : 'no trap was raised' },
      'trp-epc': { value: trap ? hex(trap.pc) : '-',
        note: trap ? 'the instruction that trapped, not the one after it' : '' },
      'trp-tval': { value: hex(csrs[Traps.CSR.mtval]),
        note: csrs[Traps.CSR.mtval] ? 'the offending address or word'
          : 'this class carries no value' },
      'trp-vector': { value: hex(csrs[Traps.CSR.mtvec]),
        note: 'one entry point for every cause, which is what makes it a boundary' },
      'trp-taken': { value: view.run.machine.traps.taken.length,
        note: 'in ' + BUDGET + ' instructions' },
      'trp-outcome': { value: view.state.registers[13] === 4 ? 'yes' : 'no',
        note: 'a3 holds ' + view.state.registers[13] + ', and the program sets it to 4' }
    });
  }

  function describeCause(cause) {
    if (cause < 0) return 'interrupt ' + (cause & 0x7fffffff);
    return cause + ' — ' + (Traps.CAUSES[cause] || 'unknown');
  }

  const CSR_ABOUT = {
    mstatus: 'the saved privilege and the interrupt-enable bits',
    mtvec: 'where every trap goes; the program cannot write it in user mode',
    mepc: 'the address of the instruction that trapped',
    mcause: 'why, with the sign bit set for an interrupt',
    mtval: 'the offending address or instruction word',
    mie: 'which interrupts are enabled',
    mip: 'which are pending'
  };

  function paintCsrs(view) {
    fill('trp-csrs', Traps.describe(view.run.machine.traps).map(function (row) {
      return [row.name, hex(row.number), hex(row.value), CSR_ABOUT[row.name] || ''];
    }));
    root.Helpers.setText('trp-csrs-caption', 'Seven registers as they stand now: the hardware '
      + 'wrote them at the trap and the handler has since edited mepc itself, which is why it '
      + 'reads four higher than the metric above. mepc and mcause are the two the handler cannot work '
      + 'without: one says where to go back to and the other says what to do first. mtval is '
      + 'the difference between "a load faulted" and "a load of 0x10000001 faulted", which is '
      + 'the difference between a message and a diagnosis.');
  }

  function paintTrace(view) {
    fill('trp-trace', view.run.trace.slice(0, view.steps).map(function (step, at) {
      return [at + 1, hex(step.pc), step.text, step.mode, describeStep(step)];
    }));
    root.Helpers.setText('trp-trace-caption', 'The arrow of the story is in the last column: '
      + 'the program runs, one instruction traps, control appears at ' + hex(VECTOR)
      + ' in machine mode, the handler reads mcause, and mret puts execution back where the '
      + 'CSRs say. Nothing here is a function call — the program never named the handler.');
  }

  function describeStep(step) {
    if (step.trapped) {
      return 'trapped: ' + (step.taken ? step.taken.name : 'unknown') +
        ' — control goes to ' + hex(VECTOR);
    }
    if (step.mret) return 'mret: back to mepc, privilege restored';
    return step.pc >= VECTOR ? 'inside the handler' : 'ordinary execution';
  }

  function paintClasses(view) {
    fill('trp-classes', CLASSES.map(function (name) {
      const run = runOf(JSON.stringify({ name: name, handler: 'aware' }));
      const trap = run.machine.traps.taken[0];
      const csrs = run.machine.traps.csrs;

      return [name + (name === view.name ? ' <-' : ''),
        trap ? describeCause(trap.cause) : 'none', trap ? hex(trap.pc) : '-',
        hex(csrs[Traps.CSR.mtval]), name === 'timer' ? 'no — asynchronous' : 'yes',
        name === 'timer' ? 'a device, between two instructions'
          : 'the instruction at mepc'];
    }));
    root.Helpers.setText('trp-classes-caption', 'Every class raised by a program that actually '
      + 'runs, with the CSR values the hardware wrote. Five of the six are consequences of an '
      + 'instruction and would happen again if it were re-run; the timer is the one that has '
      + 'nothing to do with the instruction it landed between, and that difference is the '
      + 'whole reason mcause has a sign bit.');
  }

  function paintHandlers(view) {
    fill('trp-handlers', ['aware', 'skip'].map(function (kind) {
      const run = runOf(JSON.stringify({ name: 'timer', handler: kind }));
      const state = Reference.snapshot(run.machine);

      return [kind === 'aware' ? 'cause-aware' : 'always skip four bytes',
        String(run.machine.traps.taken.length), String(state.registers[13]),
        kind === 'aware' ? 'nothing — the interrupt resumes at the instruction it interrupted'
          : 'each interrupt skips the instruction it landed on, and the timer is never '
            + 'acknowledged, so it fires again'];
    }));
    root.Helpers.setText('trp-handlers-caption', 'The same timer interrupt, the same program, '
      + 'two handlers. The cause-aware one takes 1 trap and the program finishes with a3 = 4; '
      + 'the unconditional one takes 5 and a3 is still 0, because the instruction that would '
      + 'have set it was skipped. Neither handler crashes, and nothing anywhere reports an '
      + 'error — which is what makes this class of bug expensive.');
  }

  function paintPrivilege(view) {
    fill('trp-privilege', [
      ['what is privilege, physically', 'a two-bit mode register, raised by a trap and '
        + 'restored by mret', 'the same register, with a supervisor level between'],
      ['who chooses where a trap goes', 'mtvec, which user mode cannot write',
        'the kernel sets it once at boot; nothing after that can move it'],
      ['what a system call is', 'ecall — a deliberate exception, cause 11',
        'the kernel reads a register for the call number and dispatches'],
      ['how a program is stopped', 'a timer interrupt it cannot mask in user mode',
        'this is preemptive scheduling, and M41 is built on it'],
      ['what stops a program reading kernel memory', 'nothing here — there is no MMU yet',
        'M43 adds address translation, and the check is per access']
    ]);
    root.Helpers.setText('trp-privilege-caption', 'Privilege at this level is a two-bit '
      + 'register and the checks the hardware performs against it, and that really is all. '
      + 'The right-hand column is the rest of the curriculum: every operating-system mechanism '
      + 'from scheduling to isolation is policy written on top of the four register writes in '
      + 'the diagram above.');
  }

  function paintChart(app, view) {
    const host = root.jQuery('#trp-chart')[0];

    if (!host) return;
    if (chart) chart.destroy();
    chart = root.ErrorBandView.bars(host, {
      lazyLib: app.lazyLib, height: 250, yLabel: 'instructions',
      values: CLASSES.map(function (name, index) {
        const run = runOf(JSON.stringify({ name: name, handler: 'aware' }));
        const trap = run.machine.traps.taken[0];

        return { label: name, value: trap ? (trap.pc >>> 2) + 1 : 0, series: index % 3 };
      })
    });
    root.Helpers.setText('trp-chart-note', 'How many instructions each program executed before '
      + 'it trapped. The synchronous classes trap on a specific instruction — the second or '
      + 'the third, depending on how many the setup took — and the timer traps wherever the '
      + 'counter happened to reach its compare value, which is the visible difference between '
      + '"the program did this" and "something else did".');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

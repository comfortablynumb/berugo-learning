/**
 * Section: The single-cycle datapath.
 *
 * The processor on this page is a netlist of 5 945 gates, executed by the
 * simulator from M33, and every instruction it runs is compared with the
 * behavioural machine afterwards. That comparison is the point: two
 * implementations sharing no code and agreeing on architectural state is the
 * strongest statement this milestone can make.
 *
 * The idle-block column is the second point. In a single-cycle machine every
 * instruction is charged the delay of the slowest path in the whole datapath,
 * so an `add` pays for a data memory it never touches — which is exactly the
 * waste that pipelining removes.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'single-cycle-datapath';
  const Sim = root.LogicSim;
  const Assembler = root.Brv32.Assembler;
  const GateCpu = root.Brv32.GateCpu;
  const Datapath = root.Brv32.Datapath;
  const Control = root.Brv32.Control;
  const Multicycle = root.Brv32.Multicycle;
  const View = root.DatapathView;
  let panel = null;
  let chart = null;

  const PROGRAMS = {
    mixed: ['  lui a0, 0x10000', '  addi a1, x0, 42', '  sw a1, 0(a0)', '  lw a2, 0(a0)',
      '  add a3, a1, a2', '  beq a1, a2, skip', '  addi a4, x0, 1', 'skip:',
      '  jal ra, 4', '  ecall'].join('\n'),
    arithmetic: ['  addi a0, x0, 9', '  addi a1, x0, 4', '  add a2, a0, a1',
      '  sub a3, a0, a1', '  xor a4, a0, a1', '  slli a5, a0, 2', '  slt a6, a1, a0',
      '  and a7, a0, a1', '  or t0, a0, a1', '  ecall'].join('\n'),
    memory: ['  lui a0, 0x10000', '  addi a1, x0, 7', '  sw a1, 0(a0)', '  sw a1, 4(a0)',
      '  lw a2, 0(a0)', '  lh a3, 4(a0)', '  lbu a4, 0(a0)', '  sb a1, 8(a0)',
      '  lbu a5, 8(a0)', '  ecall'].join('\n')
  };

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — the single-cycle datapath, with the muxes named',
      caption: 'Five multiplexers decide what this machine does. The first chooses whether the '
        + 'ALU\'s first operand is a register or the program counter (which is how auipc '
        + 'works); the second chooses whether the second is a register or the immediate; the '
        + 'third chooses what gets written back — the ALU result, a loaded word, the return '
        + 'address, or the immediate; the fourth chooses the next program counter; and the '
        + 'fifth, inside the ALU, chooses which function to apply. The control unit\'s entire '
        + 'job is to set those five, and the instruction decides. Everything else in the '
        + 'picture is present for every instruction, whether it is needed or not — which is '
        + 'what "single cycle" costs.',
      definition: [
        'flowchart LR',
        'PC["program counter"] --> IM["instruction memory"]',
        'IM --> DEC["decode: opcode, rd, rs1, rs2, funct3"]',
        'DEC --> RF["register file<br/>two reads, one write"]',
        'IM --> IMM["immediate generator<br/>six formats, one multiplexer"]',
        'RF -->|"rs1"| MA{"mux: rs1 or PC"}',
        'PC --> MA',
        'RF -->|"rs2"| MB{"mux: rs2 or immediate"}',
        'IMM --> MB',
        'MA --> ALU["ALU"]',
        'MB --> ALU',
        'ALU --> DM["data memory"]',
        'ALU --> WB{"mux: ALU, memory, PC+4, immediate"}',
        'DM --> WB',
        'WB --> RF',
        'ALU -->|"flags"| BR["branch unit"]',
        'BR --> NPC{"mux: PC+4 or target"}',
        'NPC --> PC'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**Every instruction takes exactly one clock cycle, and the cycle is as long as the '
        + 'slowest instruction needs.** That is the whole definition, and both halves matter. '
        + 'The first makes the machine trivial to reason about — no state between instructions, '
        + 'no hazards, no forwarding. The second makes it slow: the measured period here is set '
        + 'by the load path, and an `add` pays it too.',
      '**The datapath is the blocks of M33, wired together.** The register file of 33.8, the '
        + 'ALU of 33.5, the multiplexers and decoders of 33.3, the adders of 33.4. Nothing new '
        + 'is invented here; the processor is an arrangement, which is exactly the claim the '
        + 'gate count backs up.',
      '**The immediate generator is pure wiring.** Every format\'s immediate is gathered from '
        + 'fixed bit positions and a multiplexer picks the format — no gate computes anything. '
        + 'That is the scrambled encoding of 34.2 paying off in hardware, and it is why the '
        + 'immediate is available almost immediately after fetch.',
      '**The ALU does more than arithmetic; it computes addresses and comparisons too.** A load '
        + 'is base plus offset, which is an add. A branch is a comparison, which is a subtract '
        + 'with the result thrown away. `jalr` is an add. One adder serves all of them, which '
        + 'is why the ALU is on the critical path of nearly every instruction.',
      '**Write-back is a multiplexer with four inputs, and each input is an instruction class.** '
        + 'The ALU result for arithmetic, the loaded word for a load, PC + 4 for a jump-and-'
        + 'link, and the immediate for `lui`. Two control bits choose, and those two bits are '
        + 'most of what distinguishes the classes from the register file\'s point of view.',
      '**The branch decision is three gates on top of the ALU flags.** Bit 2 of funct3 chooses '
        + 'equality or magnitude, bit 1 chooses signed or unsigned, and bit 0 inverts the '
        + 'answer. That regularity in the encoding is why the branch unit is this small. A '
        + 'less tidy encoding would need a decoder here.',
      '**The clock period is a register-to-register path, and the ALU holds most of it.** The '
        + 'measured path runs from a flip-flop in the register file, through the read '
        + 'multiplexer tree, the operand mux, the ALU, the write-back mux and back to a '
        + 'flip-flop. The 32-bit ripple adder inside the ALU is the largest single term.',
      '**Idle blocks are the argument for the next two sections.** An arithmetic instruction '
        + 'uses the register file and the ALU and leaves the data memory alone; a store uses '
        + 'the memory and writes no register. Everything is present and everything is paid for, '
        + 'every cycle — which multi-cycle execution and pipelining each attack differently.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: { title: 'Interactive demo — a processor made of gates, stepped',
        markup: root.DatapathTemplate.render() },
      diagram: diagram(),
      insight: insight()
    };
  }

  function insight() {
    return '**A processor is not a new kind of object; it is the blocks of the previous '
      + 'milestone wired into a loop, and the loop is what makes it a computer.** Take the '
      + 'register file, the ALU, some multiplexers and an adder — all of which were built and '
      + 'measured separately. Feed the output of the last one back into the first. That '
      + 'feedback is the entire difference between a calculator and a machine that can run a '
      + 'program: the next instruction\'s address comes from the current instruction\'s '
      + 'execution. Everything else in computer architecture is an optimisation of that loop. '
      + 'The second thing worth taking is what the idle-block column shows. This machine is '
      + 'correct and it wastes most of itself on every instruction. The data memory sits unused '
      + 'during arithmetic, the register write port during a store, and the ALU is barely '
      + 'stretched by a branch. The clock period is set by the one path that needs everything, '
      + 'so every instruction pays the maximum. Once that is visible, the two classical answers '
      + 'become obvious rather than arbitrary. Cut the path into stages so each cycle is shorter '
      + '(multi-cycle, next section), or keep the stages and overlap instructions in them '
      + '(pipelining, next milestone). Both are attacking the same measured waste.';
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });
    panel = root.ControlPanel.mount({
      controls: root.DatapathTemplate.controls,
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
    return Assembler.assemble(PROGRAMS[name], { origin: 0 });
  });

  /** Running the gate machine costs about a fifth of a second per instruction,
   *  so the walk is memoised on the pair and bounded by the control. */
  const walk = root.Helpers.memoise(function (key) {
    const parts = JSON.parse(key);
    const image = imageFor(parts.name);
    const result = GateCpu.differential(image.bytes, { steps: Math.max(1, parts.steps) });
    const machine = GateCpu.create({ image: image.bytes, entry: 0 });
    const taken = [];

    for (let at = 0; at < parts.steps; at += 1) taken.push(GateCpu.step(machine));
    return { image: image, result: result, machine: machine, taken: taken,
      last: taken.length ? taken[taken.length - 1] : null };
  });

  const built = root.Helpers.memoise(function () {
    const machine = GateCpu.create({ image: [], entry: 0 });

    return { gates: Sim.gateCount(machine.net),
      transistors: Sim.transistorCount(machine.net),
      period: root.Timing.frequency(machine.net, {}) };
  });

  const blocks = root.Helpers.memoise(function () {
    const stages = Multicycle.stageDelays();
    const decoder = Control.decoder();
    const aluDecoder = Control.aluDecoder();

    return stages.concat([
      { name: 'control decoder', gates: Sim.gateCount(decoder),
        delay: Sim.criticalPath(decoder).delay },
      { name: 'ALU function decoder', gates: Sim.gateCount(aluDecoder),
        delay: Sim.criticalPath(aluDecoder).delay }
    ]);
  });

  function reading() {
    const values = panel.values();
    const steps = Number(values['dpa-step']);

    return { name: values['dpa-program'], steps: steps,
      walk: walk(JSON.stringify({ name: values['dpa-program'], steps: steps })),
      built: built('one') };
  }

  /* --------------------------------------------------------------- render */

  function update(app) {
    const view = reading();

    paintMetrics(view);
    paintGraph(app, view);
    paintSignals(view);
    paintDifferential(view);
    paintClasses(view);
    paintCost(view);
    paintChart(app);
  }

  function viewModel(view) {
    const last = view.walk.last;

    if (!last || !last.decoded) return { signals: {}, rs1: 0, rs2: 0, rd: 0 };
    return { pc: last.pc, word: last.decoded.raw, signals: last.signals,
      rs1: last.decoded.rs1, rs2: last.decoded.rs2, rd: last.decoded.rd,
      imm: last.decoded.imm, alu: last.address, address: last.address,
      next: last.next, usesImmediate: Boolean(last.signals.aluSrc),
      taken: last.next !== (last.pc + 4) >>> 0 };
  }

  function paintMetrics(view) {
    const model = viewModel(view);
    const last = view.walk.last;
    const idle = View.idleBlocks(model);

    root.MetricGrid.update({
      'dpa-instruction': { value: last && last.decoded ? last.decoded.name : 'not started',
        note: last ? 'fetched at 0x' + last.pc.toString(16) : 'move the step control' },
      'dpa-gates': { value: view.built.gates,
        note: view.built.transistors + ' transistors' },
      'dpa-period': { value: view.built.period.period,
        note: view.built.period.logic + ' of logic plus 3 of flip-flop overhead' },
      'dpa-idle': { value: idle.length ? idle.join(', ') : 'none',
        note: 'present, powered and unused this cycle' },
      'dpa-agree': { value: view.walk.result.agreed + ' of ' + view.walk.result.steps,
        note: view.walk.result.agreed === view.walk.result.steps
          ? 'architectural state matches after every instruction'
          : 'a disagreement — the gate machine is wrong' },
      'dpa-cost': { value: view.walk.machine.settleTime || 0,
        note: 'gate delays for the combinational phase to settle' }
    });
  }

  function paintGraph(app, view) {
    const host = root.jQuery('#dpa-graph')[0];
    const model = viewModel(view);

    if (!host) return;
    if (view.walk.last) app.mermaid.render(host, View.definition(model));
    else root.jQuery(host).empty();
    root.Helpers.setText('dpa-graph-note', graphNote(view, model));
  }

  function graphNote(view, model) {
    const last = view.walk.last;

    if (!last) return 'Nothing has executed yet. Move the step control to run the gates.';
    const idle = View.idleBlocks(model);

    return 'The datapath as the gates are currently driving it: hexagons are active, dotted '
      + 'arrows are paths this instruction does not use. ' + last.decoded.name + ' leaves ' +
      (idle.length ? idle.join(' and ') + ' idle' : 'nothing idle') + ', and the clock period '
      + 'charges for them anyway.';
  }

  function paintSignals(view) {
    const last = view.walk.last;

    if (!last || !last.signals) {
      fill('dpa-signals', [['—', '—', 'nothing has executed yet', '—']]);
      return;
    }
    fill('dpa-signals', Control.SIGNALS.map(function (signal) {
      const value = last.signals[signal.name];

      return [signal.name, String(value === undefined ? 0 : value), signal.about,
        effectOf(signal.name, value, last)];
    }));
    root.Helpers.setText('dpa-signals-caption', signalsCaption(view, last));
  }

  const WRITE_BACK_TEXT = ['the ALU result', 'the loaded word', 'PC + 4', 'the immediate'];

  function effectOf(name, value, last) {
    if (name === 'writeBack') return WRITE_BACK_TEXT[value || 0] + ' goes to x' + last.decoded.rd;
    if (name === 'aluSrc') return value ? 'the immediate ' + last.decoded.imm : 'register x' +
      last.decoded.rs2;
    if (name === 'aluOp') return 'function code ' + (value || 0);
    return value ? 'asserted' : 'low';
  }

  function signalsCaption(view, last) {
    const asserted = Control.SIGNALS.filter(function (signal) {
      return last.signals[signal.name];
    });

    return 'The full control vector for ' + last.decoded.name + ': ' + asserted.length +
      ' of ' + Control.SIGNALS.length + ' signals are asserted. That sparseness is why a '
      + 'hardwired decoder is cheap — most signals are zero for most instructions, so each one '
      + 'is an OR over the handful of opcodes that need it.';
  }

  function paintDifferential(view) {
    fill('dpa-differential', view.walk.result.rows.map(function (row, at) {
      const changed = differencesOf(view, at);

      return [String(at + 1), '0x' + row.pc.toString(16), row.instruction, changed,
        row.differences.length ? 'NO — ' + JSON.stringify(row.differences) : 'yes'];
    }));
    root.Helpers.setText('dpa-differential-caption', differentialCaption(view));
  }

  function differencesOf(view, at) {
    const rows = view.walk.result.rows;
    const before = at === 0 ? null : rows[at - 1].model;
    const after = rows[at].model;

    if (!before) return 'first instruction';
    const moved = after.registers.map(function (value, index) {
      return (value | 0) !== (before.registers[index] | 0) ? 'x' + index : null;
    }).filter(Boolean);

    return moved.length ? moved.join(', ') : 'none — a branch or a store';
  }

  function differentialCaption(view) {
    return 'Both machines run the same image and their architectural state — thirty-two '
      + 'registers and the program counter — is compared after every instruction. ' +
      view.walk.result.agreed + ' of ' + view.walk.result.steps + ' agree. They share no code: '
      + 'one propagates values through 5 945 gates, the other calls a JavaScript function per '
      + 'instruction, so agreement is evidence rather than a tautology.';
  }

  function paintClasses(view) {
    fill('dpa-classes', [
      ['arithmetic', 'two reads, one write', 'computes the result', 'idle',
        'the ALU result', 'the data memory'],
      ['load', 'one read, one write', 'computes the address', 'reads',
        'the loaded word', 'nothing — this is the longest path'],
      ['store', 'two reads, no write', 'computes the address', 'writes',
        'nothing', 'the register write port'],
      ['branch', 'two reads, no write', 'subtracts to compare', 'idle',
        'nothing', 'the data memory and the write port'],
      ['jump and link', 'no read, one write', 'computes the target for jalr', 'idle',
        'PC + 4', 'the data memory']
    ]);
    root.Helpers.setText('dpa-classes-caption', 'The load row is the one that sets the clock: '
      + 'it is the only class that needs the register file, the ALU, the data memory and the '
      + 'write-back path in series. Every other class finishes earlier and waits, which is '
      + 'exactly the waste the next section measures.');
  }

  function paintCost(view) {
    const rows = blocks('one');
    const total = view.built.gates;

    fill('dpa-cost-table', rows.map(function (row) {
      return [row.name, String(row.gates),
        (100 * row.gates / total).toFixed(0) + '%', String(row.delay),
        reasonFor(row.name)];
    }));
    root.Helpers.setText('dpa-cost-table-caption', costCaption(view, rows, total));
  }

  const REASONS = {
    decode: '1 024 flip-flops plus two 32:1 multiplexer trees per bit',
    execute: 'a 32-bit adder, a barrel shifter and an 8:1 result multiplexer per bit',
    address: 'a 32-bit ripple adder for PC + immediate',
    'control decoder': 'one AND term per opcode and an OR per signal',
    'ALU function decoder': 'a 3-to-8 decoder over funct3 and three AND terms'
  };

  function reasonFor(name) {
    return REASONS[name] || '';
  }

  function costCaption(view, rows, total) {
    const decode = rows.filter(function (row) { return row.name === 'decode'; })[0];
    const execute = rows.filter(function (row) { return row.name === 'execute'; })[0];

    return 'The register file is ' + (100 * decode.gates / total).toFixed(0) + '% of the gates '
      + 'and ' + decode.delay + ' gate delays; the ALU is ' +
      (100 * execute.gates / total).toFixed(0) + '% of the gates and ' + execute.delay +
      ' delays. Area and time are in completely different places, which is why "make it '
      + 'smaller" and "make it faster" are different projects: the storage dominates the area '
      + 'and the arithmetic dominates the clock.';
  }

  function paintChart(app) {
    const host = root.jQuery('#dpa-chart')[0];
    const rows = blocks('one');

    if (!host) return;
    if (chart) chart.destroy();
    chart = root.ErrorBandView.bars(host, {
      lazyLib: app.lazyLib, height: 250, logY: true, yLabel: 'gates and gate delays (log)',
      values: rows.reduce(function (out, row) {
        out.push({ label: row.name + ' · gates', value: row.gates, series: 0 });
        out.push({ label: row.name + ' · delay', value: row.delay, series: 1 });
        return out;
      }, [])
    });
    root.Helpers.setText('dpa-chart-note', chartNote(rows));
  }

  function chartNote(rows) {
    const decode = rows.filter(function (row) { return row.name === 'decode'; })[0];
    const execute = rows.filter(function (row) { return row.name === 'execute'; })[0];

    return 'Gates and delay per block, on a log axis because they differ by two orders of '
      + 'magnitude. The register file is ' + decode.gates + ' gates and only ' + decode.delay +
      ' gate delays deep; the ALU is ' + execute.gates + ' gates and ' + execute.delay +
      '. The bars cross, which is the whole point: the biggest block is not the slowest one.';
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

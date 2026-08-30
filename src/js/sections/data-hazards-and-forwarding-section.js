/**
 * Section: Data hazards and forwarding.
 *
 * Five dependency shapes and three forwarding units, with the correctness of
 * each combination checked against the M34 behavioural simulator rather than
 * asserted. The one that matters is the double hazard: two instructions in a
 * row writing the same register, where a forwarding unit that checks MEM/WB
 * before EX/MEM picks the older value and produces a machine that is right on
 * almost every program.
 *
 * That bug is here as a control rather than as a description. Selecting
 * "naive" runs it, and the answer column goes wrong on exactly one of the five
 * fixtures — which is the whole point about why it survives testing.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'data-hazards-and-forwarding';
  const Pipeline = root.Brv32.Pipeline;
  const Reference = root.Brv32.Reference;
  const Assembler = root.Brv32.Assembler;
  const Hazards = root.Brv32.Hazards;
  const Isa = root.Brv32.Isa;
  const View = root.PipelineView;
  let panel = null;
  let chart = null;

  /* The fixtures. Each ends in ecall so the run stops itself, and each has a
     result in a3 so "did this machine compute the right thing" is one
     comparison rather than an inspection. */
  const FIXTURES = {
    chain: { about: 'every instruction reads the one before it',
      answer: 'a3 = 30',
      source: ['  li a0, 1', '  addi a1, a0, 4', '  addi a2, a1, 10', '  addi a3, a2, 15',
        '  ecall'] },
    double: { about: 'two instructions in a row write a2; the third must read the newer one',
      answer: 'a3 = 14',
      source: ['  li a0, 1', '  li a1, 2', '  add a2, a0, a1', '  addi a2, a2, 10',
        '  add a3, a2, a0', '  ecall'] },
    loaduse: { about: 'a load, then the instruction that uses what it loaded',
      answer: 'a3 = 43',
      source: ['  li a0, 0x10000000', '  li a1, 42', '  sw a1, 0(a0)', '  lw a2, 0(a0)',
        '  addi a3, a2, 1', '  ecall'] },
    scheduled: { about: 'the same load-use, with an unrelated instruction moved into the slot',
      answer: 'a3 = 43',
      source: ['  li a0, 0x10000000', '  li a1, 42', '  sw a1, 0(a0)', '  lw a2, 0(a0)',
        '  li a4, 99', '  addi a3, a2, 1', '  ecall'] },
    independent: { about: 'nothing reads anything the instruction before it wrote',
      answer: 'a3 = 4',
      source: ['  li a0, 1', '  li a1, 2', '  li a2, 3', '  li a3, 4', '  ecall'] }
  };

  const ORDER = ['chain', 'double', 'loaduse', 'scheduled', 'independent'];
  const UNITS = { full: {}, naive: { naiveForwarding: true }, none: { forwarding: false } };

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — the two forwarding paths, and the one that is not there',
      caption: 'A value exists at the end of execute and is not written to the register file '
        + 'until write-back, two stages later. The two forwarding paths carry it back to the '
        + 'execute stage in the meantime, and the priority between them is the whole design: '
        + 'the EX/MEM path is the more recent producer and must win. The load path is the '
        + 'exception — a loaded word does not exist until the end of memory, so there is no '
        + 'wire to draw and the instruction waits.',
      definition: [
        'flowchart LR',
        '    RF["register file"] --> M{"operand select"}',
        '    EXM["EX/MEM latch<br/>the instruction one ahead"] -->|"priority 1"| M',
        '    MWB["MEM/WB latch<br/>two ahead"] -->|"priority 2"| M',
        '    M --> ALU["execute"]',
        '    ALU --> EXM',
        '    EXM --> MEM["memory stage"]',
        '    MEM -->|"a loaded word arrives HERE"| MWB',
        '    MEM -.->|"no path: the value does not exist yet"| M'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**A data hazard is an instruction reading a register that an instruction still in '
        + 'flight has not written yet.** The value exists — it was computed at the end of '
        + 'execute — but it does not reach the register file until write-back, two stages '
        + 'later. So a machine that only reads the register file gets a stale value, and the '
        + 'fix is either to wait for it or to fetch it from where it actually is.',
      '**Read-after-write is the only kind that can happen in an in-order pipeline.** '
        + 'Write-after-read needs a later instruction to write before an earlier one reads, '
        + 'and write-after-write needs them to complete out of order; neither is possible when '
        + 'every instruction passes the stages in the same order. Both come back in M36, and '
        + 'register renaming exists to remove them.',
      '**Forwarding sends the value from where it is rather than from where it belongs.** Two '
        + 'paths: one from the EX/MEM latch and one from MEM/WB. With both, an arithmetic '
        + 'result is available to the very next instruction, and a dependency chain runs at '
        + 'full speed.',
      '**The priority between those two paths is the classic bug.** When two instructions '
        + 'ahead of you both wrote the register you are reading, you want the more recent one '
        + '— the EX/MEM latch. A unit that checks MEM/WB first picks the older value. Select '
        + '"naive" above and watch exactly one of the five fixtures give the wrong answer.',
      '**It survives testing because it needs two back-to-back writes to the same '
        + 'register.** Hand-written test programs rarely do that; compiler output does it '
        + 'constantly, because a register allocator reuses registers as soon as they are dead. '
        + 'That gap between what people test and what compilers emit is worth remembering well '
        + 'beyond pipelines.',
      '**One hazard cannot be forwarded away at all.** A load\'s value does not exist until '
        + 'the end of the memory stage, so the instruction directly after it has to wait one '
        + 'cycle whatever the wiring. There is no path to draw, which is why the diagram above '
        + 'has a dotted line where a solid one would be.',
      '**A compiler removes that stall by putting something else in the slot.** The '
        + '"scheduled" fixture is the same load and the same use with one unrelated '
        + 'instruction moved between them; the stall disappears and the program is one '
        + 'instruction longer and one cycle shorter. This is instruction scheduling, and it is '
        + 'why compiler output looks reordered.',
      '**A register file that writes in the first half of a cycle and reads in the second '
        + 'needs no third forwarding path.** The MEM/WB case is handled by the storage itself. '
        + 'That is the same trick as the structural hazard section\'s split access, and it is '
        + 'why textbook diagrams differ on whether that path exists.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: { title: 'Interactive demo — five dependency shapes, three forwarding units',
        markup: root.ForwardingTemplate.render() },
      diagram: diagram(),
      insight: insight()
    };
  }

  function insight() {
    return '**The double-hazard bug is the most instructive defect in this milestone, and not '
      + 'because it is hard: it is one comparison in the wrong order.** A forwarding unit that '
      + 'checks MEM/WB before EX/MEM picks the older of two producers, and it is wrong only '
      + 'when two instructions in a row write the same register and a third reads it. Write a '
      + 'test program by hand and you will almost never produce that shape, because a person '
      + 'writing assembly names a fresh register for a fresh value. A register allocator does '
      + 'the opposite: it reuses a register the moment the previous value is dead, so '
      + 'compiler output is full of exactly this pattern. The machine passes every '
      + 'hand-written test and fails on real code. That gap is the thing worth carrying '
      + 'away, because it is not specific to processors at all — it is what happens whenever '
      + 'the inputs a system is tested on are generated by a different process from the '
      + 'inputs it will see. Hand-written fixtures share the author\'s assumptions; generated '
      + 'data, production traffic and compiler output do not. The remedy is not more '
      + 'hand-written tests but a different generator: a differential oracle, a fuzzer, or a '
      + 'replay of real input. This section can afford the first of those, and the answer '
      + 'column is checked against a machine that shares none of the pipeline\'s code.';
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });
    panel = root.ControlPanel.mount({
      controls: root.ForwardingTemplate.controls,
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
    return Assembler.assemble(FIXTURES[name].source.join('\n'), { origin: 0 });
  });

  const runOf = root.Helpers.memoise(function (key) {
    const parts = JSON.parse(key);
    const image = imageFor(parts.name);
    const machine = Pipeline.create(Object.assign({ image: image.bytes, entry: 0 },
      UNITS[parts.unit]));

    Pipeline.run(machine, { cycles: 200, stopOnTrap: true });
    return { machine: machine, summary: Pipeline.summary(machine),
      state: Pipeline.snapshot(machine) };
  });

  /** What the behavioural machine gets, which is the only thing that decides
   *  whether the pipeline is right. */
  const expected = root.Helpers.memoise(function (name) {
    const image = imageFor(name);
    const machine = Reference.create({ image: image.bytes, entry: 0 });

    Reference.run(machine, { budget: 200, stopOnTrap: true });
    return Reference.snapshot(machine);
  });

  function resultOf(name, unit) {
    return runOf(JSON.stringify({ name: name, unit: unit })).state.registers[13] | 0;
  }

  function reading() {
    const values = panel.values();

    return { name: values['dhz-fixture'], unit: values['dhz-forwarding'],
      cycles: Number(values['dhz-cycles']),
      run: runOf(JSON.stringify({ name: values['dhz-fixture'],
        unit: values['dhz-forwarding'] })),
      want: expected(values['dhz-fixture']) };
  }

  /* --------------------------------------------------------------- render */

  function update(app) {
    const view = reading();

    paintMetrics(view);
    paintOperands(view);
    paintDiagram(view);
    paintSource(view);
    paintUnits(view);
    paintKinds();
    paintFixes();
    paintChart(app);
  }

  function paintMetrics(view) {
    const summary = view.run.summary;
    const got = view.run.state.registers[13] | 0;
    const want = view.want.registers[13] | 0;
    const full = runOf(JSON.stringify({ name: view.name, unit: 'full' })).summary;

    root.MetricGrid.update({
      'dhz-cycles-total': { value: summary.cycles,
        note: summary.retired + ' instructions retired' },
      'dhz-stalls': { value: summary.stalls,
        note: summary.loadUse + ' of them load-use, ' + summary.dependency + ' plain dependences' },
      'dhz-forwards': { value: summary.forwards, note: 'operands taken from a latch' },
      'dhz-answer': { value: 'a3 = ' + got, note: 'the reference computes ' + want },
      'dhz-correct': { value: got === want ? 'yes' : 'NO',
        note: got === want ? 'against the behavioural simulator'
          : 'this forwarding unit is broken, and only this fixture shows it' },
      'dhz-cost': { value: (summary.cycles - full.cycles) + ' cycles',
        note: summary.cycles === full.cycles ? 'the same as full forwarding'
          : 'slower than full forwarding' }
    });
  }

  /** Provenance per instruction: where each operand actually came from. This
   *  is the table the section exists for, because "forwarding" is invisible
   *  until you can see an operand arriving from somewhere other than the
   *  register file.
   *
   *  Every fixture here is straight-line - no loops and no branches - so an
   *  instruction's issue order is its position in the listing, and the two ids
   *  can be used interchangeably. That is only true because of how the
   *  fixtures were written, so it is said out loud rather than assumed. */
  function paintOperands(view) {
    fill('dhz-operands', imageFor(view.name).listing.map(function (row, at) {
      const decoded = Isa.decode(row.word >>> 0);
      const reads = Hazards.readsRegisters({ decoded: decoded });
      const sources = sourcesFor(view, at, decoded);

      return ['0x' + row.address.toString(16) + '  ' + row.text.trim(),
        reads.rs1 ? Hazards.name(decoded.rs1) : '-', reads.rs1 ? sources.rs1 : 'not read',
        reads.rs2 ? Hazards.name(decoded.rs2) : '-', reads.rs2 ? sources.rs2 : 'not read'];
    }));
    root.Helpers.setText('dhz-operands-caption', operandCaption(view));
  }

  /** Read the provenance out of the forward events the run recorded, which is
   *  the same data the machine acted on rather than a second derivation of
   *  it. */
  function sourcesFor(view, id, decoded) {
    const byName = {};

    view.run.machine.log.forEach(function (cycle) {
      cycle.events.forEach(function (event) {
        if (event.kind !== 'forward' || event.id !== id) return;
        const parts = event.reason.split(' from ');

        byName[parts[0]] = parts[1];
      });
    });
    return { rs1: byName[Hazards.name(decoded.rs1)] || 'register file',
      rs2: byName[Hazards.name(decoded.rs2)] || 'register file' };
  }

  function operandCaption(view) {
    const forwards = view.run.summary.forwards;

    return forwards + ' of the operands on this run came from a pipeline latch rather than '
      + 'from the register file. That is what forwarding is, and it is invisible in the '
      + 'answer: the program computes the same number either way, and only the cycle count '
      + 'and this column say how. With no forwarding every row reads "register file" and the '
      + 'stall count rises to pay for it.';
  }

  function paintDiagram(view) {
    root.jQuery('#dhz-diagram').html(View.markup(view.run.machine, { cycles: view.cycles }));
    root.Helpers.setText('dhz-diagram-note', 'A repeated stage in a row is an instruction '
      + 'that could not move. With full forwarding the only one left is the load-use case; '
      + 'with no forwarding almost every dependent instruction waits two cycles, and the '
      + 'diagram fills with held stages.');
  }

  function paintSource(view) {
    const spec = FIXTURES[view.name];

    fill('dhz-source', imageFor(view.name).listing.map(function (row, at) {
      const decoded = Isa.decode(row.word >>> 0);

      return ['0x' + row.address.toString(16), row.text.trim(),
        dependsOn(view, decoded, at), costOf(view, at)];
    }));
    root.Helpers.setText('dhz-source-caption', spec.about + '. The expected answer is '
      + spec.answer + ', and the metric grid above compares it against what the pipeline '
      + 'actually produced with the forwarding unit you selected.');
  }

  function dependsOn(view, decoded, at) {
    const listing = imageFor(view.name).listing;
    const reads = Hazards.readsRegisters({ decoded: decoded });
    const names = [];

    [['rs1', reads.rs1], ['rs2', reads.rs2]].forEach(function (pair) {
      if (!pair[1] || decoded[pair[0]] === 0) return;
      for (let back = at - 1; back >= 0 && back >= at - 3; back -= 1) {
        const earlier = Isa.decode(listing[back].word >>> 0);

        if (earlier.ok && earlier.rd === decoded[pair[0]]) {
          names.push(Hazards.name(decoded[pair[0]]) + ' from ' + (at - back) + ' back');
          return;
        }
      }
    });
    return names.length ? names.join(', ') : 'nothing recent';
  }

  function costOf(view, at) {
    let stalls = 0;

    view.run.machine.log.forEach(function (cycle) {
      cycle.events.forEach(function (event) {
        if (event.kind === 'stall' && event.id === at) stalls += 1;
      });
    });
    return stalls ? stalls + ' stall cycle(s)' : 'nothing';
  }

  function paintUnits(view) {
    fill('dhz-units', ORDER.map(function (name) {
      const want = expected(name).registers[13] | 0;
      const cells = ['full', 'naive', 'none'].map(function (unit) {
        const run = runOf(JSON.stringify({ name: name, unit: unit }));

        return run.summary.cycles + ' cycles, a3 = ' + (run.state.registers[13] | 0);
      });

      return [name + (name === view.name ? ' <-' : '')].concat(cells)
        .concat([resultOf(name, 'naive') === want ? 'yes' : 'NO — it computes ' +
          resultOf(name, 'naive') + ' instead of ' + want]);
    }));
    root.Helpers.setText('dhz-units-caption', 'The last column is the point of the section. '
      + 'The naive forwarding unit gets the right answer on four of the five fixtures and the '
      + 'wrong one on the double hazard, which needs two back-to-back writes to the same '
      + 'register — a shape a person writing test programs by hand produces almost never and '
      + 'a register allocator produces constantly.');
  }

  function paintKinds() {
    fill('dhz-kinds', [
      ['read after write', 'an instruction reads what an earlier one writes',
        'yes — this is the only one, and forwarding is the answer',
        'everywhere; it is a real dependence and no renaming removes it'],
      ['write after read', 'an instruction writes what an earlier one reads',
        'impossible: reads happen in order, before any later write',
        'out-of-order machines, where M36 renames the register to remove it'],
      ['write after write', 'two instructions write the same register',
        'impossible: write-back happens in order',
        'out-of-order machines again, and it is why the rename table exists'],
      ['memory dependences', 'a load reading what an earlier store wrote',
        'in order here, so it just works',
        'M36, where a load may issue before an older store knows its address']
    ]);
    root.Helpers.setText('dhz-kinds-caption', 'Three of the four rows say "impossible" for '
      + 'this machine, and that is worth noticing: in-order execution removes them for free. '
      + 'Everything M36 does to break that order has to put them back, which is why register '
      + 'renaming and memory disambiguation are the two hardest parts of an out-of-order '
      + 'design.');
  }

  function paintFixes() {
    fill('dhz-fixes', [
      ['arithmetic to arithmetic', 'yes — the value exists at the end of execute',
        'not needed', 'nothing to do'],
      ['load to use, next instruction', 'no — the value does not exist yet',
        'one cycle, unavoidable', 'move an unrelated instruction into the slot'],
      ['load to use, one instruction later', 'yes — from MEM/WB', 'not needed',
        'this is what the scheduling is aiming for'],
      ['two producers of the same register', 'yes — the more recent one wins',
        'not needed', 'nothing, but the hardware must get the priority right']
    ]);
    root.Helpers.setText('dhz-fixes-caption', 'The second row is the only one hardware cannot '
      + 'solve, and it is why compilers schedule instructions at all. Compare the "loaduse" '
      + 'and "scheduled" fixtures above: both take 12 cycles, but the scheduled one retires 8 '
      + 'instructions in them instead of 7. The stall did not disappear so much as get filled '
      + 'with work — which is the whole of instruction scheduling, and the reason it only pays '
      + 'when there is genuinely something else to do.');
  }

  function paintChart(app) {
    const host = root.jQuery('#dhz-chart')[0];

    if (!host) return;
    if (chart) chart.destroy();
    chart = root.ErrorBandView.bars(host, {
      lazyLib: app.lazyLib, height: 250, yLabel: 'cycles',
      values: ORDER.reduce(function (out, name) {
        out.push({ label: name + ' full',
          value: runOf(JSON.stringify({ name: name, unit: 'full' })).summary.cycles,
          series: 0 });
        out.push({ label: name + ' none',
          value: runOf(JSON.stringify({ name: name, unit: 'none' })).summary.cycles,
          series: 1 });
        return out;
      }, [])
    });
    root.Helpers.setText('dhz-chart-note', 'Two bars per fixture: with full forwarding and '
      + 'with none. The independent fixture\'s bars are identical, because there is nothing '
      + 'to forward; the chain\'s separate the most, because every instruction depends on the '
      + 'one before it and pays two stalls without the wires.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

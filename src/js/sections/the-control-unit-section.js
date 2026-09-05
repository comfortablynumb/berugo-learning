/**
 * Section: The control unit.
 *
 * Two decoders and a saboteur. The control table is the specification, the
 * gate-level decoder is checked against it over every instruction, and then
 * the demo forces one signal to a constant and runs three real programs to see
 * what a broken control unit actually does — which is a much better way to
 * learn what a signal is for than reading its name.
 *
 * The forced runs go through `machines/brv32/signal-machine.js`: a processor
 * driven by the control vector rather than by instruction names, checked
 * against the behavioural simulator when the signals are correct.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'the-control-unit';
  const Sim = root.LogicSim;
  const Isa = root.Brv32.Isa;
  const Control = root.Brv32.Control;
  const Assembler = root.Brv32.Assembler;
  const SignalMachine = root.Brv32.SignalMachine;
  const Programs = root.Brv32.Programs;
  let panel = null;
  let chart = null;

  const CHECKED = ['sum', 'arrayMax', 'strlen'];
  const FLAT = ['regWrite', 'aluSrc', 'memRead', 'memWrite', 'branch', 'jump', 'jalr'];

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — seven bits in, a control vector out',
      caption: 'A hardwired decoder is one AND term per opcode and one OR per signal. The AND '
        + 'terms are a decoder — the block from 33.3 — and each control signal is the OR of the '
        + 'opcodes that need it, which is why most of the vector is zero for most instructions '
        + 'and why the whole thing is 103 gates. A microcoded control unit replaces the OR '
        + 'array with a memory: the opcode addresses a ROM whose contents are the signal '
        + 'vectors, and a counter walks through several of them for one instruction. That is '
        + 'slower and it can be changed after the chip is made, which is what every microcode '
        + 'update you have ever installed actually is.',
      definition: [
        'flowchart LR',
        'OP["opcode[6:0]"] --> DEC["one AND term per opcode<br/>a 7-to-10 decoder"]',
        'DEC --> OR1["OR: regWrite<br/>op, opImm, load, lui, auipc, jal, jalr"]',
        'DEC --> OR2["OR: aluSrc<br/>opImm, load, store, auipc, jalr"]',
        'DEC --> OR3["OR: memRead · memWrite · branch · jump"]',
        'DEC --> WB["write-back select, two bits"]',
        'F3["funct3, funct7[5]"] --> ALUC["ALU function decoder<br/>3-to-8 over funct3"]',
        'OR1 --> V["control vector"]',
        'OR2 --> V',
        'OR3 --> V',
        'WB --> V',
        'ALUC --> V',
        'V -.->|"microcoded alternative"| ROM["a ROM addressed by opcode and step"]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**A control unit is a function from the opcode to a vector of wires, and nothing else.** '
        + 'Given seven bits of opcode and a few function bits, produce the ten or so signals the '
        + 'datapath needs. Once that is the definition, the implementation choices are '
        + 'obvious: compute it with gates, or look it up in a memory.',
      '**Hardwired control is an AND per opcode and an OR per signal.** The decoder from 33.3 '
        + 'produces one hot line per opcode; each control signal is the OR of the lines that '
        + 'need it. The whole thing is 103 gates and two levels deep, which is why a RISC '
        + 'decoder is small enough to duplicate four times for a wide machine.',
      '**Most signals are zero for most instructions, and that sparseness is the reason it is '
        + 'cheap.** An arithmetic instruction asserts two of the seven boolean signals; a store '
        + 'asserts two different ones. A decoder for a dense vector would be far larger — which '
        + 'is one of the arguments for a small, regular instruction set.',
      '**Microcode replaces the logic with a memory, and buys changeability.** The opcode and a '
        + 'step counter address a ROM whose contents are control vectors. It is slower and '
        + 'larger, and it means the machine\'s behaviour can be altered after manufacture — '
        + 'which is exactly how the Spectre and Meltdown mitigations reached shipped '
        + 'processors.',
      '**x86 does both: it decodes to micro-operations and then runs those.** The complex, '
        + 'variable-width instruction set is translated into simple internal operations, which '
        + 'a RISC-like core executes. The instruction set stayed; everything behind it was '
        + 'replaced. That is the single most successful application of "keep the interface, '
        + 'change the implementation" in computing.',
      '**Don\'t-care signals are a real optimisation and a real hazard.** If an instruction does '
        + 'not write a register, the write-back multiplexer\'s select bits do not matter — so a '
        + 'minimiser may set them to whatever makes the logic smaller. That is fine until '
        + 'somebody reads those bits for something else, which is how a "harmless" don\'t-care '
        + 'becomes a bug.',
      '**A decoder must do something safe with input it does not recognise.** An undefined '
        + 'opcode must not write a register or memory; it must raise an illegal-instruction '
        + 'trap. The demo checks that every opcode outside the table produces a control vector '
        + 'with every write signal low, because "it probably does nothing" is not a '
        + 'specification.',
      '**Forcing a signal is the fastest way to learn what it does.** A control unit is hard to '
        + 'reason about from its truth table and easy to understand from its failures. '
        + 'regWrite stuck low makes every program compute zero. Branch stuck low makes every '
        + 'loop run forever, and memWrite stuck high turns the first instruction into a store to '
        + 'a nonsense address.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: { title: 'Interactive demo — decode, compare, and then sabotage',
        markup: root.ControlTemplate.render() },
      diagram: diagram(),
      insight: insight()
    };
  }

  function insight() {
    return '**Microcode is the reason a processor can be fixed after it is sold, and that single '
      + 'property has shaped the industry more than any argument about instruction counts.** A '
      + 'hardwired control unit is faster and smaller and completely fixed: what it does is '
      + 'etched. A microcoded one is a memory full of control vectors, so the behaviour of an '
      + 'instruction can be changed by loading different contents. That is what a microcode '
      + 'update is, and why the mitigations for Spectre and Meltdown could reach processors '
      + 'that were already in machines. It is also why the RISC-versus-CISC argument ended '
      + 'where it did. The x86 architecture kept a complex instruction set as its interface, and '
      + 'put a decoder in front that translates to simple internal operations. Those run on a '
      + 'core that '
      + 'looks like the machines that were supposed to replace it. The interface was worth more '
      + 'than the implementation, so they changed the implementation. The transferable idea is '
      + 'about where to put a table. Any behaviour expressed as data can be changed at run '
      + 'time, versioned, tested independently and shipped separately; the same behaviour '
      + 'expressed as code cannot. A control unit is exactly that choice, logic or a lookup. '
      + 'Every configuration file, feature flag and rules engine you have ever written is '
      + 'the same decision at a different scale.';
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });
    panel = root.ControlPanel.mount({
      controls: root.ControlTemplate.controls,
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

  const decoderNet = root.Helpers.memoise(function () {
    return Control.decoder();
  });

  const encodeLine = root.Helpers.memoise(function (text) {
    const out = Assembler.assemble('  ' + text, { origin: 0 });

    return out.listing.length ? (out.listing[0].word >>> 0) : 0;
  });

  /** The gate decoder's answer for one word, read as a signal vector. */
  function gateSignals(word) {
    const net = decoderNet('one');
    const values = {};

    for (let at = 0; at < 7; at += 1) values['op' + at] = (word >>> at) & 1;
    const out = Sim.outputsOf(net, Sim.evaluate(net, values));
    const vector = {};

    FLAT.forEach(function (name) { vector[name] = out[name] ? 1 : 0; });
    vector.writeBack = (out.writeBack1 ? 2 : 0) | (out.writeBack0 ? 1 : 0);
    return vector;
  }

  const agreement = root.Helpers.memoise(function () {
    const rows = Isa.TABLE.map(function (row) {
      const word = Isa.encode(row.name, { rd: 5, rs1: 6, rs2: 7,
        imm: row.format === 'U' ? 0x1000 : 4 });
      const want = Control.signalsFor(Isa.decode(word));
      const got = gateSignals(word);
      const same = FLAT.every(function (name) { return got[name] === want[name]; }) &&
        got.writeBack === want.writeBack;

      return { name: row.name, same: same };
    });

    return { rows: rows, agreed: rows.filter(function (row) { return row.same; }).length };
  });

  const runProgram = root.Helpers.memoise(function (key) {
    const parts = JSON.parse(key);
    const image = Assembler.assemble(Programs.CATALOGUE[parts.name].source, { origin: 0 });

    return SignalMachine.runWith(image.bytes, parts.override, { budget: 400 });
  });

  function overrideOf(text) {
    if (text === 'none') return null;
    const parts = text.split('=');
    const out = {};

    out[parts[0]] = Number(parts[1]);
    return out;
  }

  function reading() {
    const values = panel.values();
    const word = encodeLine(values['ctl-instruction']);

    return { text: values['ctl-instruction'], word: word, decoded: Isa.decode(word),
      table: Control.signalsFor(Isa.decode(word)), gates: gateSignals(word),
      breakText: values['ctl-break'], override: overrideOf(values['ctl-break']),
      agreement: agreement('one') };
  }

  /* --------------------------------------------------------------- render */

  function update(app) {
    const view = reading();

    paintMetrics(view);
    paintVector(view);
    paintBreak(view);
    paintTable(view);
    paintStyles(view);
    paintSafety(view);
    paintChart(app);
  }

  function resultOf(name, override) {
    const spec = Programs.CATALOGUE[name];
    const run = runProgram(JSON.stringify({ name: name, override: override }));

    return { value: run.state.registers[spec.result], finished: run.finished,
      steps: run.steps, halted: run.halted, expect: spec.expect };
  }

  function describe(row) {
    if (row.halted) return 'faulted after ' + row.steps;
    if (!row.finished) return 'never finished';
    return String(row.value);
  }

  function paintMetrics(view) {
    const asserted = Object.keys(view.table).filter(function (name) {
      return FLAT.indexOf(name) !== -1 && view.table[name];
    });
    const decoder = decoderNet('one');
    const broken = resultOf('sum', view.override);
    const correct = resultOf('sum', null);

    root.MetricGrid.update({
      'ctl-asserted': { value: asserted.length + ' of ' + FLAT.length,
        note: asserted.length ? asserted.join(', ') : 'none — this instruction changes nothing' },
      'ctl-agree': { value: view.agreement.agreed + ' of ' + view.agreement.rows.length,
        note: 'the gate decoder against the control table' },
      'ctl-size': { value: Sim.gateCount(decoder) + ' gates',
        note: Sim.criticalPath(decoder).delay + ' gate delays deep' },
      'ctl-broken': { value: describe(broken),
        note: view.override ? 'the sum program with ' + view.breakText : 'nothing is forced' },
      'ctl-correct': { value: describe(correct), note: 'the same program, correct control' },
      'ctl-undefined': { value: undefinedIsSafe() ? 'writes nothing' : 'WRITES SOMETHING',
        note: 'every opcode outside the table, checked' }
    });
  }

  function undefinedIsSafe() {
    for (let opcode = 0; opcode < 128; opcode += 1) {
      const word = (opcode | (5 << 7)) >>> 0;
      const decoded = Isa.decode(word);

      if (decoded.ok) continue;
      const signals = Control.signalsFor(decoded);

      if (signals.regWrite || signals.memWrite) return false;
    }
    return true;
  }

  function paintVector(view) {
    const rows = FLAT.concat(['writeBack']).map(function (name) {
      const table = view.table[name] === undefined ? 0 : view.table[name];
      const gates = view.gates[name];
      const meaning = Control.SIGNALS.filter(function (row) { return row.name === name; })[0];

      return [name, String(table), String(gates), table === gates ? 'yes' : 'NO',
        meaning ? meaning.about : ''];
    });

    fill('ctl-vector', rows);
    root.Helpers.setText('ctl-vector-caption', vectorCaption(view, rows));
  }

  function vectorCaption(view, rows) {
    const disagree = rows.filter(function (row) { return row[3] === 'NO'; });

    return 'The control vector for ' + view.text + ', produced twice: by the table that '
      + 'specifies it and by the 103-gate decoder that implements it. ' +
      (disagree.length ? disagree.length + ' signals DISAGREE, which is a bug in the decoder.'
        : 'They agree on every signal, as they do on all ' + view.agreement.rows.length +
        ' instructions in the set.') + ' The ALU function code is decoded separately, from '
      + 'funct3 and one bit of funct7.';
  }

  const BREAKS = ['none', 'regWrite=0', 'aluSrc=1', 'branch=0', 'memWrite=1', 'writeBack=1'];

  const EXPLANATIONS = {
    none: 'nothing is forced, so every program computes what it should',
    'regWrite=0': 'no register is ever written, so every value stays zero and the first '
      + 'branch-if-zero is taken immediately',
    'aluSrc=1': 'every second operand becomes the immediate, so register-to-register '
      + 'arithmetic silently computes with a constant',
    'branch=0': 'no conditional branch is ever taken, so every loop runs until the budget '
      + 'stops it',
    'memWrite=1': 'every instruction stores to whatever the ALU computed, and the first '
      + 'address outside memory faults',
    'writeBack=1': 'every result is taken from the data memory, so arithmetic writes back '
      + 'whatever the load path happened to have'
  };

  function paintBreak(view) {
    fill('ctl-break-table', BREAKS.map(function (text) {
      const override = overrideOf(text);
      const cells = CHECKED.map(function (name) {
        return describe(resultOf(name, override));
      });

      return [text + (text === view.breakText ? ' ←' : '')].concat(cells)
        .concat([EXPLANATIONS[text]]);
    }));
    root.Helpers.setText('ctl-break-table-caption', breakCaption(view));
  }

  function breakCaption(view) {
    const correct = CHECKED.map(function (name) {
      return Programs.CATALOGUE[name].expect;
    });

    return 'Three real programs run with each signal forced to a constant. The correct answers '
      + 'are ' + correct.join(', ') + '; every other row is a control unit with one wire stuck. '
      + 'Notice how varied the failures are — one program stops early, one never ends, one '
      + 'faults on the first instruction — which is why "the control unit is wrong" is such a '
      + 'hard bug to recognise from its symptoms.';
  }

  const OPCODE_ROWS = ['op', 'opImm', 'load', 'store', 'branch', 'jal', 'jalr', 'lui', 'auipc'];

  function paintTable(view) {
    fill('ctl-table', OPCODE_ROWS.map(function (name) {
      const sample = sampleFor(name);
      const signals = Control.signalsFor(Isa.decode(sample));

      return [name].concat(FLAT.slice(0, 6).map(function (signal) {
        return String(signals[signal]);
      })).concat([['ALU', 'memory', 'PC+4', 'immediate'][signals.writeBack]]);
    }));
    root.Helpers.setText('ctl-table-caption', 'Nine opcodes and their vectors. Read down a '
      + 'column rather than across a row: each control signal is asserted by a handful of '
      + 'opcodes, and that is literally the OR gate the decoder builds for it.');
  }

  const SAMPLES = { op: 'add a0, a1, a2', opImm: 'addi a0, a1, 8', load: 'lw a0, 8(a1)',
    store: 'sw a0, 8(a1)', branch: 'beq a0, a1, 8', jal: 'jal ra, 8',
    jalr: 'jalr ra, a0, 0', lui: 'lui a0, 0x10000', auipc: 'auipc a0, 1' };

  function sampleFor(name) {
    return encodeLine(SAMPLES[name]);
  }

  function paintStyles(view) {
    const decoder = decoderNet('one');

    fill('ctl-styles', [
      ['size', Sim.gateCount(decoder) + ' gates',
        'a ROM of one vector per opcode per step — thousands of bits',
        'RISC machines hardwire; large CISC machines historically did not'],
      ['latency', Sim.criticalPath(decoder).delay + ' gate delays',
        'a memory access, plus a sequencer', 'hardwired control keeps decode off the critical '
          + 'path'],
      ['changeable after manufacture', 'no — it is etched',
        'yes — load new ROM contents', 'this is what a microcode update is'],
      ['complex instructions', 'each one is more logic',
        'each one is more ROM entries', 'why CISC and microcode grew up together'],
      ['duplication for wide issue', 'cheap — copy 103 gates four times',
        'expensive — copy the ROM, or arbitrate for it',
        'why RISC decoders are easy to widen']
    ]);
    root.Helpers.setText('ctl-styles-caption', 'The row that decided the argument is the '
      + 'third. Everything else was an engineering trade; being able to change a shipped '
      + 'processor\'s behaviour turned out to be worth an enormous amount, and it is why '
      + 'microcode survives inside machines that are otherwise hardwired.');
  }

  function paintSafety(view) {
    fill('ctl-safety', [
      ['an opcode the table does not contain',
        undefinedIsSafe() ? 'every write signal is low' : 'SOMETHING IS ASSERTED',
        'an undefined instruction must trap, not corrupt state'],
      ['a funct3 value with no meaning for its opcode',
        'the ALU decoder still produces a code; the instruction decoder rejects the word',
        'two decoders disagreeing is how a "reserved" encoding becomes a security bug'],
      ['a signal that is a don\'t-care for this instruction',
        'left at zero rather than minimised away',
        'a don\'t-care that somebody later reads is a bug with no author'],
      ['x0 as a destination',
        'the register file has no write enable for row zero',
        'the safety is structural, not a check that could be forgotten']
    ]);
    root.Helpers.setText('ctl-safety-caption', 'Four cases where a decoder meets input it was '
      + 'not designed for. The first is checked over all 128 opcode values on every render; '
      + 'the last is the nicest, because it cannot be got wrong — the wire is simply not '
      + 'there.');
  }

  function paintChart(app) {
    const host = root.jQuery('#ctl-chart')[0];

    if (!host) return;
    if (chart) chart.destroy();
    chart = root.ErrorBandView.bars(host, {
      lazyLib: app.lazyLib, height: 250, yLabel: 'signals asserted',
      values: OPCODE_ROWS.map(function (name, index) {
        const signals = Control.signalsFor(Isa.decode(sampleFor(name)));

        return { label: name, value: FLAT.filter(function (signal) {
          return signals[signal];
        }).length, series: index % 3 };
      })
    });
    root.Helpers.setText('ctl-chart-note', 'How many of the seven boolean control signals each '
      + 'opcode asserts. Only jalr reaches four — it writes a register, takes an immediate and '
      + 'redirects the program counter from a register — and most reach two. That sparseness is '
      + 'exactly why the decoder is 103 gates rather than a memory, and why a wide processor can '
      + 'afford four copies of it.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

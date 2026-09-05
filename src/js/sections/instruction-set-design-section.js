/**
 * Section: Instruction set design.
 *
 * Three machine models compute the same expression, and all three are real
 * interpreters with real encodings — so the instruction counts and byte counts
 * are of programs that produce the answer rather than of programs somebody
 * sketched. The agreement check is part of the demo for that reason: a density
 * comparison between three different computations would be worthless.
 *
 * The packing table is the other half. Once the opcode and the register fields
 * are paid for, what is left is the immediate, and that arithmetic is why a
 * 16-bit instruction set has eight registers.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'instruction-set-design';
  const Models = root.Brv32.Models;
  let panel = null;
  let chart = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — one expression, three machines',
      caption: 'The same computation, (a + b) times two minus c, on three kinds of machine. '
        + 'A stack machine names no operands at all: every instruction takes what is on top '
        + 'and leaves its result there, so an instruction is little more than an opcode and '
        + 'the code is dense. An accumulator machine has one implied destination, so each '
        + 'instruction names one source. A register machine names all three, which costs bits '
        + 'in every instruction and buys the freedom to keep values where they are — no '
        + 'shuffling, no reloading, and an optimiser that can allocate. The trade is visible '
        + 'in the demo: the stack program is the smallest in bytes and the largest in '
        + 'instructions, and the register program is the reverse.',
      definition: [
        'flowchart TD',
        'E["(a + b) * 2 - c"] --> S["stack machine<br/>push a, push b, add, push 1,<br/>shl, push c, sub"]',
        'E --> A["accumulator machine<br/>load a, add b, shl 1, sub c"]',
        'E --> R["register machine<br/>add t0, a, b<br/>slli t0, t0, 1<br/>sub t0, t0, c"]',
        'S --> SB["7 instructions, 7 bytes"]',
        'A --> AB["4 instructions, 8 bytes"]',
        'R --> RB["3 instructions, 12 bytes"]',
        'SB -.->|"dense code, many instructions"| T["the density trade"]',
        'AB -.-> T',
        'RB -.->|"few instructions, wide encoding"| T'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**An instruction set is a contract, and its first clause is where operands live.** A '
        + 'stack machine implies them by position, an accumulator machine implies one of them, '
        + 'and a register machine names them all. Everything else — encoding width, code '
        + 'density, how hard the thing is to decode — follows from that choice, which is why '
        + 'the demo starts there rather than with opcodes.',
      '**Naming operands costs bits in every instruction and buys freedom in every program.** '
        + 'Three register fields of five bits each is fifteen bits gone before the opcode is '
        + 'written. What that buys is values staying where they are: no push, no pop, no '
        + 'reload, and a register allocator that can decide. The demo measures both sides on '
        + 'the same expression.',
      '**Fixed width buys trivial decode and costs code density.** Every BRV32 instruction is '
        + 'four bytes, so the address of the next one is always the current one plus four. A '
        + 'decoder can therefore look at every field of every instruction simultaneously. A '
        + 'variable-width encoding is denser, and its decoder must find where the instruction '
        + 'ends before it can know what it is. That is the single biggest difference between '
        + 'reading ARM64 and reading x86-64.',
      '**RISC and CISC is a real argument and mostly a settled one.** Complex instructions were '
        + 'worth having when code came off a slow disk into a small memory and a microcoded '
        + 'engine could do more per fetch. Once caches and compilers arrived, the decode '
        + 'complexity stopped paying — and x86 responded by translating to internal micro-'
        + 'operations, which is a RISC core wearing a CISC interface.',
      '**Orthogonality is what makes a compiler\'s job possible.** If every operation works with '
        + 'every addressing mode and every register, the code generator can choose freely. '
        + 'Special cases turn instruction selection into a search: this instruction only '
        + 'writes that register, this mode only works with that operation. They are the '
        + 'reason older instruction sets are harder to target than their instruction counts '
        + 'suggest.',
      '**Addressing modes are a compression scheme for address arithmetic.** Base plus offset, '
        + 'scaled index, auto-increment: each one folds a common address computation into the '
        + 'load. RISC-V keeps only base plus offset, so the arithmetic is explicit and every '
        + 'instruction stays one operation — which costs instructions and makes the pipeline '
        + 'regular.',
      '**The encoding budget is arithmetic, and the demo does it.** Width, minus opcode bits, '
        + 'minus register fields, leaves the immediate. At sixteen bits with thirty-two '
        + 'registers and two operands there is one bit left. That is why small instruction '
        + 'sets have small register files, and why RISC-V\'s compressed extension pairs '
        + 'sixteen-bit encodings with a restricted set of registers.',
      '**The ISA constrains the microarchitecture, permanently.** Condition codes serialise '
        + 'instructions that look independent. Variable width forces a decoder that finds '
        + 'boundaries before it can decode in parallel. Precise exceptions constrain how far '
        + 'out of order a machine may commit. These are promises made once and paid for in '
        + 'every implementation afterwards.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: { title: 'Interactive demo — three machines, one expression, measured',
        markup: root.IsaDesignTemplate.render() },
      diagram: diagram(),
      insight: insight()
    };
  }

  function insight() {
    return '**An instruction set is the most expensive interface in computing, because it is '
      + 'the one you cannot change once anybody has shipped a binary against it.** Everything '
      + 'else in this course can be rewritten: a compiler pass, a cache policy, an operating '
      + 'system. An ISA is a promise to every program ever compiled for it. That is why x86 '
      + 'still decodes instructions designed in 1978, and why the interesting engineering '
      + 'happens behind the interface rather than in it. That framing explains the two design '
      + 'moves that actually matter. The first is to keep the interface small and regular, '
      + 'because every irregularity is a special case in every future implementation. RISC-V '
      + 'has no condition codes precisely so that no future out-of-order implementation has to '
      + 'rename them. The second is to hide the implementation completely, which is what µop '
      + 'translation does. The x86 architecture kept its interface and replaced everything '
      + 'behind it, and the '
      + 'result runs faster than the RISC machines that were supposed to replace it. The '
      + 'density measurement in this demo is worth carrying too. Stack code is the smallest and '
      + 'takes the most instructions; register code is the largest and takes the fewest. Which '
      + 'one wins depends entirely on whether you are short of instruction-fetch bandwidth or '
      + 'of execution slots. That is a question about the machine you are building, not '
      + 'about the elegance of the encoding.';
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });
    panel = root.ControlPanel.mount({
      controls: root.IsaDesignTemplate.controls,
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

  function reading() {
    const values = panel.values();
    const locals = [Number(values['isd-a']), Number(values['isd-b']), Number(values['isd-c'])];

    return { model: values['isd-model'], locals: locals,
      width: Number(values['isd-width']), registers: Number(values['isd-registers']),
      comparison: Models.compare(locals) };
  }

  function rowFor(view, name) {
    return view.comparison.rows.filter(function (row) { return row.name === name; })[0];
  }

  /* --------------------------------------------------------------- render */

  function update(app) {
    const view = reading();

    paintMetrics(view);
    paintProgram(view);
    paintModels(view);
    paintPacking(view);
    paintTradeoffs(view);
    paintChart(app, view);
  }

  function paintMetrics(view) {
    const chosen = rowFor(view, view.model);
    const packed = Models.packing({ width: view.width, opcodes: 32,
      registers: view.registers, operands: 2 });

    root.MetricGrid.update({
      'isd-answer': { value: view.comparison.answer,
        note: '(' + view.locals[0] + ' + ' + view.locals[1] + ') × 2 − ' + view.locals[2] },
      'isd-instructions': { value: chosen.instructions, note: chosen.about },
      'isd-bytes': { value: chosen.bytes,
        note: chosen.bytesPerInstruction + ' bytes per instruction' },
      'isd-immediate': { value: packed.immediateBits,
        note: view.width + ' bits, minus ' + packed.opcodeBits + ' of opcode and ' +
          (packed.registerBits * 2) + ' of registers' },
      'isd-range': { value: packed.immediateBits > 0
        ? packed.range.low + ' to ' + packed.range.high : 'nothing fits',
        note: 'what a two-operand instruction can carry inline' },
      'isd-agree': { value: view.comparison.agree ? 'all three' : 'THEY DISAGREE',
        note: view.comparison.agree ? 'so the byte counts compare one computation'
          : 'the comparison is meaningless until they do' }
    });
  }

  function paintProgram(view) {
    const chosen = rowFor(view, view.model);

    fill('isd-program', chosen.steps.map(function (step, at) {
      return [String(at + 1), step.text, String(chosen.bytesPerInstruction),
        leavesBehind(view.model, at, chosen.steps.length)];
    }));
    root.Helpers.setText('isd-program-caption', 'The ' + view.model + ' program for the same '
      + 'expression: ' + chosen.instructions + ' instructions and ' + chosen.bytes +
      ' bytes, computing ' + chosen.result + '. ' + chosen.about + '.');
  }

  function leavesBehind(model, at, total) {
    if (model === 'stack') {
      return at === total - 1 ? 'the answer, on top of the stack' : 'a value on the stack';
    }
    if (model === 'accumulator') return 'the accumulator';
    return at === total - 1 ? 'the answer, in t0' : 'a named register';
  }

  function paintModels(view) {
    fill('isd-models', view.comparison.rows.map(function (row) {
      return [row.name, row.about, String(row.instructions),
        String(row.bytesPerInstruction), String(row.bytes), String(row.result)];
    }));
    root.Helpers.setText('isd-models-caption', modelsCaption(view));
  }

  function modelsCaption(view) {
    const stack = rowFor(view, 'stack');
    const register = rowFor(view, 'register');

    return 'Three machines, one answer — ' + view.comparison.answer + ' from all of them, '
      + 'which is what makes the byte counts comparable. The stack program is ' + stack.bytes +
      ' bytes in ' + stack.instructions + ' instructions; the register program is ' +
      register.bytes + ' bytes in ' + register.instructions + '. Density and instruction count '
      + 'move in opposite directions, and which one you are short of decides the argument.';
  }

  const PACKING_ROWS = [
    { registers: 8, operands: 2 }, { registers: 16, operands: 2 },
    { registers: 32, operands: 2 }, { registers: 8, operands: 3 },
    { registers: 32, operands: 3 }
  ];

  function paintPacking(view) {
    fill('isd-packing', PACKING_ROWS.map(function (shape) {
      const packed = Models.packing({ width: view.width, opcodes: 32,
        registers: shape.registers, operands: shape.operands });

      return [view.width + ' bits', String(shape.registers), String(shape.operands),
        String(packed.opcodeBits), String(packed.registerBits * shape.operands),
        String(packed.immediateBits),
        packed.immediateBits > 0 ? packed.range.low + ' to ' + packed.range.high
          : 'the instruction does not fit'];
    }));
    root.Helpers.setText('isd-packing-caption', packingCaption(view));
  }

  function packingCaption(view) {
    const small = Models.packing({ width: view.width, opcodes: 32, registers: 8, operands: 2 });
    const large = Models.packing({ width: view.width, opcodes: 32, registers: 32, operands: 3 });

    return 'Thirty-two opcodes is five bits; a register field is the logarithm of the register '
      + 'count. At ' + view.width + ' bits, eight registers and two operands leave ' +
      small.immediateBits + ' bits of immediate, and thirty-two registers with three operands '
      + 'leave ' + large.immediateBits + '. That single row is why sixteen-bit instruction sets '
      + 'have small register files, and why RISC-V\'s compressed extension restricts which '
      + 'registers a short instruction may name.';
  }

  function paintTradeoffs(view) {
    const register = rowFor(view, 'register');
    const stack = rowFor(view, 'stack');

    fill('isd-tradeoffs', [
      ['fixed-width encoding', 'trivial decode; the next address is always PC + 4',
        register.bytes + ' bytes where a stack encoding needs ' + stack.bytes,
        'RISC-V, ARM64, MIPS'],
      ['variable-width encoding', 'denser code, so more instructions per cache line',
        'the decoder must find the end before it knows the start',
        'x86-64, and every machine designed when memory was scarce'],
      ['many registers', 'values stay put; the allocator has room',
        'five bits per operand, three times per instruction',
        'RISC-V and ARM64 at 32; x86-64 at 16 for encoding reasons'],
      ['condition codes', 'a compare and a branch share their work',
        'a hidden dependency between instructions that look independent',
        'x86 and ARM have them; RISC-V deliberately does not'],
      ['rich addressing modes', 'address arithmetic folded into the access',
        'each mode is a special case in every future implementation',
        'x86-64 scaled-index; RISC-V keeps only base plus offset']
    ]);
    root.Helpers.setText('isd-tradeoffs-caption', 'Five decisions, and the last column is the '
      + 'part worth remembering: every one of them is a live choice that real instruction sets '
      + 'answered differently, and every one is paid for in every implementation for as long '
      + 'as the instruction set lives.');
  }

  function paintChart(app, view) {
    const host = root.jQuery('#isd-chart')[0];

    if (!host) return;
    if (chart) chart.destroy();
    chart = root.ErrorBandView.bars(host, {
      lazyLib: app.lazyLib, height: 250, yLabel: 'count',
      values: view.comparison.rows.reduce(function (out, row) {
        out.push({ label: row.name + ' · instructions', value: row.instructions, series: 0 });
        out.push({ label: row.name + ' · bytes', value: row.bytes, series: 1 });
        return out;
      }, [])
    });
    root.Helpers.setText('isd-chart-note', chartNote(view));
  }

  function chartNote(view) {
    const stack = rowFor(view, 'stack');
    const accumulator = rowFor(view, 'accumulator');
    const register = rowFor(view, 'register');

    return 'Two bars per model: instructions executed and bytes of code. They point in '
      + 'opposite directions — ' + stack.instructions + ' instructions in ' + stack.bytes +
      ' bytes for the stack machine, ' + register.instructions + ' in ' + register.bytes +
      ' for the register machine, and the accumulator machine between them at ' +
      accumulator.instructions + ' and ' + accumulator.bytes + '. A machine short of fetch '
      + 'bandwidth wants the left-hand bar small; a machine short of execution slots wants the '
      + 'right-hand one small.';
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

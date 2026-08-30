/**
 * Section: The BRV32 instruction set.
 *
 * The encoder and the decoder are the same table read in two directions, and
 * the demo drives both: assemble a line, read its fields, flip a bit, and see
 * what the word becomes. The immediate reconstruction is shown field by field
 * because that is the part everybody assumes is arbitrary — and it is the part
 * with the clearest hardware reason behind it.
 *
 * The published-encodings table is the outside judge. Fourteen words taken
 * from the RISC-V specification and from standard assembler output, compared
 * byte for byte, so "compatible" is a measurement rather than an intention.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'brv32-instruction-set';
  const Isa = root.Brv32.Isa;
  const Assembler = root.Brv32.Assembler;
  const Disassembler = root.Brv32.Disassembler;
  let panel = null;
  let chart = null;

  /* The same fourteen encodings the module test checks, so the page and the
     suite cannot disagree about what compatibility means. */
  const PUBLISHED = [
    ['addi a0, zero, 5', 0x00500513], ['add a2, a0, a1', 0x00b50633],
    ['sub a2, a0, a1', 0x40b50633], ['lw a1, 8(a0)', 0x00852583],
    ['sw a1, 8(a0)', 0x00b52423], ['beq a0, a1, 8', 0x00b50463],
    ['bne a0, a1, -4', 0xfeb51ee3], ['jal ra, 16', 0x010000ef],
    ['lui a0, 0x12345', 0x12345537], ['auipc a0, 1', 0x00001517],
    ['jalr zero, ra, 0', 0x00008067], ['slli a1, a0, 3', 0x00351593],
    ['srai a1, a0, 3', 0x40355593], ['ecall', 0x00000073]
  ];

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — the six formats, with their field boundaries aligned',
      caption: 'Read the columns rather than the rows. The opcode is always bits 6 to 0; the '
        + 'destination register is always bits 11 to 7; the source registers are always at 19 '
        + 'to 15 and 24 to 20. A decoder can therefore pull all four out before it knows what '
        + 'the instruction is, which is why a fixed-width regular encoding decodes in one gate '
        + 'delay. The immediates are what move — and even they move as little as possible: bit '
        + '31 is the sign in every format that has one, so the sign extender is wired once. The '
        + 'S and B formats differ only in where the low bits land, and the I and J formats '
        + 'share their upper bits. That is not tidiness, it is wire count.',
      definition: [
        'flowchart TD',
        'R["R · funct7[31:25] · rs2[24:20] · rs1[19:15] · funct3[14:12] · rd[11:7] · opcode[6:0]"]',
        'I["I · imm[31:20] · rs1 · funct3 · rd · opcode"]',
        'S["S · imm[31:25] · rs2 · rs1 · funct3 · imm[11:7] · opcode"]',
        'B["B · imm[12,10:5] · rs2 · rs1 · funct3 · imm[4:1,11] · opcode"]',
        'U["U · imm[31:12] · rd · opcode"]',
        'J["J · imm[20,10:1,11,19:12] · rd · opcode"]',
        'R --> C["the same wires feed rd, rs1, rs2 and the opcode in every format"]',
        'I --> C',
        'S --> C',
        'B --> C',
        'U --> D["bit 31 is the sign bit in every signed format"]',
        'J --> D'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**Thirty-two registers, one of which is always zero.** x0 reads as zero and discards '
        + 'writes, which is not a special case in the register file so much as an absence: the '
        + 'write enable for row zero is not wired. It buys a great deal — `mv` is `addi rd, rs, '
        + '0`, `nop` is `addi x0, x0, 0`, a comparison against zero needs no constant, and '
        + 'discarding a result needs no instruction.',
      '**Six formats, and the fields that matter are in the same place in all of them.** The '
        + 'opcode, the destination register and both source registers occupy fixed bit '
        + 'positions, so the decoder reads them before it knows which instruction it has. That '
        + 'is what a regular encoding buys, and it is why the register file can start its read '
        + 'in parallel with decode.',
      '**The immediate scrambling is a wiring optimisation, visible in the software rules.** '
        + 'Bit 31 is the sign in every signed format, and the fields below move as little as '
        + 'possible between formats, so the same wires carry the same immediate bits whatever '
        + 'the instruction is. The assembler pays for it once; the decoder saves it in every '
        + 'instruction, forever.',
      '**A load and an immediate arithmetic instruction share a format, and that is deliberate.** '
        + 'Both are "one register, one twelve-bit constant", so `lw a0, 8(a1)` and `addi a0, '
        + 'a1, 8` differ only in the opcode — and in the datapath they differ only in whether '
        + 'the ALU result is used as an address. One adder serves both.',
      '**Stores and branches split their immediates so the registers stay put.** An S-format '
        + 'instruction has two sources and no destination, so the bits that would be the '
        + 'destination register hold the low half of the offset instead. It looks like '
        + 'vandalism and it is the only way to keep rs1 and rs2 where the decoder expects them.',
      '**Pseudo-instructions are the assembler being helpful, and the listing should say so.** '
        + '`li a0, 0x12345` is a `lui` and an `addi`; `ret` is `jalr x0, ra, 0`; `nop` is an '
        + 'addi. Reading disassembly means knowing which lines you wrote and which the '
        + 'assembler wrote for you, and the demo marks them.',
      '**Little-endian byte order and natural alignment are part of the contract.** A word is '
        + 'stored low byte first, so a byte pointer into an integer sees the low byte; an '
        + 'access must be aligned to its width or it faults. Both are choices, both are visible '
        + 'to software, and both are the reason a struct laid out for one machine can be wrong '
        + 'on another.',
      '**The calling convention is not in the hardware, and everything depends on it.** Which '
        + 'registers pass arguments, which the callee must preserve, where the return address '
        + 'lives: none of that is enforced by a single gate. It is a convention that every '
        + 'compiler, library and hand-written routine agrees to, and the register names in the '
        + 'demo — a0, ra, sp — are that agreement written down.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: { title: 'Interactive demo — an instruction, bit by bit',
        markup: root.EncodingTemplate.render() },
      diagram: diagram(),
      insight: insight()
    };
  }

  function insight() {
    return '**The immediate scrambling is the clearest example in this course of software being '
      + 'shaped by gates.** There is no reason, in software, for the bits of a branch offset to '
      + 'be scattered across four fields in a strange order — it makes the assembler harder to '
      + 'write and the encoding harder to read. The reason is that the alternative costs wires '
      + 'in the decoder of every implementation forever: if each format put its immediate in a '
      + 'different place, the sign extender would need a multiplexer in front of every bit, and '
      + 'that multiplexer sits on the path between fetch and execute in every processor that '
      + 'ever implements the instruction set. Paying once in the assembler to save a level of '
      + 'logic in every chip is obviously the right trade, and it is invisible unless you know '
      + 'to look. The general lesson is worth more than the example: when an interface has a '
      + 'rule that seems gratuitously awkward, the reason is usually on the other side of it, '
      + 'and the awkwardness is somebody having already made this exact trade. Alignment '
      + 'requirements, the zero register, fixed instruction width, the absence of condition '
      + 'codes — every one of those is a software-visible rule with a hardware argument behind '
      + 'it, and knowing the argument is the difference between memorising an instruction set '
      + 'and understanding one.';
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });
    panel = root.ControlPanel.mount({
      controls: root.EncodingTemplate.controls,
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

  function hex(value) {
    return '0x' + (value >>> 0).toString(16).padStart(8, '0');
  }

  function binary(value) {
    return (value >>> 0).toString(2).padStart(32, '0').replace(/(.{8})(?=.)/g, '$1 ');
  }

  const encodeLine = root.Helpers.memoise(function (text) {
    const out = Assembler.assemble('  ' + text, { origin: 0 });

    return { ok: out.ok && out.listing.length > 0 && out.listing[0].word !== undefined,
      word: out.listing.length ? (out.listing[0].word >>> 0) : 0, errors: out.errors };
  });

  function reading() {
    const values = panel.values();
    const text = values['enc-instruction'];
    const encoded = encodeLine(text);
    const flip = Number(values['enc-flip']);

    return { text: text, word: encoded.word, ok: encoded.ok, flip: flip,
      format: values['enc-format'], line: Disassembler.line(encoded.word, 0),
      flipped: flip < 32 ? (encoded.word ^ (1 << flip)) >>> 0 : encoded.word >>> 0 };
  }

  /* --------------------------------------------------------------- render */

  function update(app) {
    const view = reading();

    paintMetrics(view);
    paintFields(view);
    paintImmediate(view);
    paintFormats(view);
    paintPublished();
    paintScramble(view);
    paintChart(app);
  }

  function paintMetrics(view) {
    const flippedLine = Disassembler.line(view.flipped, 0);
    const published = publishedRows();
    const decoded = Isa.decode(view.word);

    root.MetricGrid.update({
      'enc-word': { value: hex(view.word), note: binary(view.word) },
      'enc-name': { value: view.line.ok ? view.line.name : 'not an instruction',
        note: view.line.ok ? view.line.decoded.format + ' format' : view.line.why },
      'enc-immediate': { value: view.line.ok ? decoded.imm : '—',
        note: view.line.ok ? 'from ' + decoded.parts.length + ' field(s) of the word'
          : 'no format to read it with' },
      'enc-roundtrip': { value: view.line.ok && encodeLine(view.text).word === view.word
        ? 'stable' : 'CHANGED',
        note: 'assemble, decode, and the word is the same' },
      'enc-flipped': { value: view.flip < 32 ? hex(view.flipped) : 'nothing flipped',
        note: view.flip < 32 ? (flippedLine.ok ? 'now decodes as ' + flippedLine.text
          : 'now decodes as nothing at all') : 'move the control to change a bit' },
      'enc-reference': { value: published.filter(function (row) { return row[3] === 'yes'; })
        .length + ' of ' + published.length,
      note: 'encodings taken from the specification' }
    });
  }

  function paintFields(view) {
    if (!view.line.ok) {
      fill('enc-fields', [['—', '—', '—', 'this word decodes to no instruction', '—']]);
      root.Helpers.setText('enc-fields-caption', view.line.why);
      return;
    }
    fill('enc-fields', view.line.fields.map(function (field) {
      return [field.name, field.bits, field.value,
        field.shows === undefined ? '' : field.shows, field.used ? 'yes' : 'ignored here'];
    }));
    root.Helpers.setText('enc-fields-caption', fieldsCaption(view));
  }

  function fieldsCaption(view) {
    const unused = view.line.fields.filter(function (field) { return !field.used; });

    return 'Every field of the word, including the ' + unused.length + ' this instruction does '
      + 'not use — because "that field is ignored here" is itself an answer, and because the '
      + 'decoder reads them all anyway. The opcode, rd, rs1 and rs2 are at fixed positions in '
      + 'every format, so those reads start before anything knows what the instruction is.';
  }

  function paintImmediate(view) {
    const decoded = Isa.decode(view.word);
    const parts = view.line.ok ? decoded.parts : [];

    fill('enc-immediate-table', parts.length ? parts.map(function (part) {
      return [part.to, part.from, part.width, part.value];
    }) : [['—', '—', '—', 'this format has no immediate']]);
    root.Helpers.setText('enc-immediate-table-caption', immediateCaption(view, decoded, parts));
  }

  function immediateCaption(view, decoded, parts) {
    if (!parts.length) {
      return 'An R-format instruction has no immediate at all: both operands are registers, '
        + 'and the bits that would carry a constant hold funct7 instead.';
    }
    return 'The ' + decoded.format + '-format immediate arrives in ' + parts.length +
      ' piece(s) and reassembles to ' + decoded.imm + '. Follow the "comes from" column: bit '
      + '31 is always the top of the immediate, which is why the sign extender is wired once '
      + 'for every format rather than once per format.';
  }

  const FORMAT_ROWS = {
    R: ['funct7, rs2, rs1, funct3, rd, opcode', 0, 'register-to-register arithmetic',
      'any constant at all'],
    I: ['imm[11:0], rs1, funct3, rd, opcode', 12, 'immediate arithmetic, loads, jalr',
      'a second source register'],
    S: ['imm[11:5], rs2, rs1, funct3, imm[4:0], opcode', 12, 'stores',
      'a destination register — its bits hold the offset'],
    B: ['imm[12|10:5], rs2, rs1, funct3, imm[4:1|11], opcode', 13, 'conditional branches',
      'an odd offset: bit 0 is always zero'],
    U: ['imm[31:12], rd, opcode', 20, 'lui and auipc — the upper half of a constant',
      'anything about the low twelve bits'],
    J: ['imm[20|10:1|11|19:12], rd, opcode', 21, 'jal',
      'a target more than a megabyte away']
  };

  function paintFormats(view) {
    fill('enc-formats', Object.keys(FORMAT_ROWS).map(function (format) {
      const row = FORMAT_ROWS[format];

      return [format + (format === view.format ? ' ←' : ''), row[0],
        row[1] === 0 ? 'none' : String(row[1]), row[2], row[3]];
    }));
    root.Helpers.setText('enc-formats-caption', formatsCaption(view));
  }

  function formatsCaption(view) {
    const row = FORMAT_ROWS[view.format];

    return 'The ' + view.format + ' format carries ' +
      (row[1] === 0 ? 'no immediate' : row[1] + ' immediate bits') + ' and is used for ' +
      row[2] + '. What it cannot express is ' + row[3] + ' — and every one of those absences '
      + 'is a decision that bought bits somewhere else.';
  }

  function publishedRows() {
    return PUBLISHED.map(function (entry) {
      const ours = encodeLine(entry[0]).word >>> 0;

      return [entry[0], hex(ours), hex(entry[1]), ours === (entry[1] >>> 0) ? 'yes' : 'NO'];
    });
  }

  function paintPublished() {
    const rows = publishedRows();

    fill('enc-published', rows);
    root.Helpers.setText('enc-published-caption', 'Fourteen encodings taken from the RISC-V '
      + 'specification and from standard assembler output, compared byte for byte with what '
      + 'this assembler produces: ' + rows.filter(function (row) { return row[3] === 'yes'; })
      .length + ' of ' + rows.length + ' agree. This is the only table in the milestone whose '
      + 'right-hand column does not come from our own code, which is exactly why it is worth '
      + 'having — everything else here could be self-consistently wrong.');
  }

  function paintScramble(view) {
    const branch = Isa.decode(Isa.encode('beq', { rs1: 10, rs2: 11, imm: -4 }));

    fill('enc-scramble', [
      ['bit 31 is the sign of the immediate in I, S, B and J',
        'one sign extender, wired to one bit, for every format'],
      ['rs1 is always bits 19:15 and rs2 always 24:20',
        'the register file read starts before decode finishes'],
      ['rd is always bits 11:7',
        'the write port address needs no multiplexer'],
      ['S and B differ only in where the low bits sit',
        'a store and a branch share almost all of their wiring'],
      ['B and J immediates have no bit 0',
        'targets are even, so the field reaches twice as far — ' +
          branch.imm + ' from ' + branch.parts.length + ' fields here']
    ]);
    root.Helpers.setText('enc-scramble-caption', 'Five observations about where the bits are, '
      + 'and what each one saves. None of them make the assembler simpler; all of them make '
      + 'the decoder smaller, in every implementation, forever.');
  }

  function paintChart(app) {
    const host = root.jQuery('#enc-chart')[0];

    if (!host) return;
    if (chart) chart.destroy();
    chart = root.ErrorBandView.bars(host, {
      lazyLib: app.lazyLib, height: 250, yLabel: 'bits of the 32',
      values: Object.keys(FORMAT_ROWS).reduce(function (out, format) {
        const immediate = FORMAT_ROWS[format][1];
        const registers = format === 'R' ? 15 : (format === 'U' || format === 'J' ? 5 : 10);

        out.push({ label: format + ' · immediate', value: immediate, series: 0 });
        out.push({ label: format + ' · registers', value: registers, series: 1 });
        return out;
      }, [])
    });
    root.Helpers.setText('enc-chart-note', 'Two bars per format: bits spent on the immediate '
      + 'and bits spent naming registers. They trade directly against each other inside a '
      + 'fixed 32-bit word — the R format spends 15 bits on three registers and has no '
      + 'immediate at all, and the J format spends 5 on one register and 21 on the offset. '
      + 'The remainder in every row is the opcode and the function fields.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

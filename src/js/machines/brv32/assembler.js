/**
 * Brv32Assembler - two passes, a symbol table, and pseudo-instructions.
 *
 * The two passes exist for one reason: a branch to a label further down the
 * file needs the label's address, and the address is not known until the
 * instructions before it have been sized. Pass one assigns addresses and
 * records symbols; pass two encodes. Everything else an assembler does —
 * pseudo-instruction expansion, directives, relocations — hangs off that
 * skeleton.
 *
 * Pseudo-instructions are recorded rather than hidden. `li x5, 0x12345` is two
 * real instructions and the listing says so, because "the assembler emitted
 * something I did not write" is exactly the surprise that makes reading
 * disassembly confusing the first few times.
 *
 * An unresolved symbol produces a relocation, not an error: that is the
 * difference between assembling and linking, and the linker in `linker.js` is
 * what turns the relocation into a number.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) {
    scope.Brv32 = scope.Brv32 || {};
    scope.Brv32.Assembler = api;
  }
}(this, function (root) {
  'use strict';

  const Isa = root && root.Brv32 && root.Brv32.Isa ? root.Brv32.Isa : require('./isa.js');

  /* --------------------------------------------------------------- lexing */

  function stripComment(line) {
    const cut = line.search(/[#;]|\/\//);

    return cut === -1 ? line : line.slice(0, cut);
  }

  function splitOperands(text) {
    return text.split(',').map(function (part) { return part.trim(); })
      .filter(function (part) { return part.length > 0; });
  }

  function parseLine(text, at) {
    const clean = stripComment(text).trim();

    if (!clean) return null;
    const labelled = clean.match(/^([A-Za-z_.][\w.$]*)\s*:\s*(.*)$/);
    const label = labelled ? labelled[1] : null;
    const body = labelled ? labelled[2].trim() : clean;

    if (!body) return { line: at, label: label, op: null, operands: [], text: clean };
    const parts = body.match(/^(\S+)\s*(.*)$/);

    return { line: at, label: label, op: parts[1].toLowerCase(),
      operands: splitOperands(parts[2] || ''), text: clean };
  }

  /* ------------------------------------------------------------ operands */

  function parseNumber(text) {
    const trimmed = String(text).trim();

    if (/^-?0x[0-9a-f]+$/i.test(trimmed)) {
      return trimmed[0] === '-' ? -parseInt(trimmed.slice(3), 16) : parseInt(trimmed.slice(2), 16);
    }
    if (/^-?0b[01]+$/i.test(trimmed)) {
      return trimmed[0] === '-' ? -parseInt(trimmed.slice(3), 2) : parseInt(trimmed.slice(2), 2);
    }
    if (/^-?\d+$/.test(trimmed)) return Number(trimmed);
    if (/^'.'$/.test(trimmed)) return trimmed.charCodeAt(1);
    return null;
  }

  function parseMemory(text) {
    const match = String(text).match(/^(-?[\w#x]+)?\s*\(\s*(\S+?)\s*\)$/);

    if (!match) return null;
    return { offset: match[1] === undefined ? 0 : parseNumber(match[1]), base: match[2],
      symbol: match[1] !== undefined && parseNumber(match[1]) === null ? match[1] : null };
  }

  /* --------------------------------------------------- pseudo-instructions */

  const PSEUDO = {
    nop: function () { return [['addi', ['x0', 'x0', '0']]]; },
    mv: function (ops) { return [['addi', [ops[0], ops[1], '0']]]; },
    not: function (ops) { return [['xori', [ops[0], ops[1], '-1']]]; },
    neg: function (ops) { return [['sub', [ops[0], 'x0', ops[1]]]]; },
    seqz: function (ops) { return [['sltiu', [ops[0], ops[1], '1']]]; },
    j: function (ops) { return [['jal', ['x0', ops[0]]]]; },
    jr: function (ops) { return [['jalr', ['x0', ops[0], '0']]]; },
    ret: function () { return [['jalr', ['x0', 'ra', '0']]]; },
    call: function (ops) { return [['jal', ['ra', ops[0]]]]; },
    beqz: function (ops) { return [['beq', [ops[0], 'x0', ops[1]]]]; },
    bnez: function (ops) { return [['bne', [ops[0], 'x0', ops[1]]]]; },
    bgez: function (ops) { return [['bge', [ops[0], 'x0', ops[1]]]]; },
    li: expandLoadImmediate,
    la: function (ops) { return [['auipc', [ops[0], '%hi(' + ops[1] + ')']],
      ['addi', [ops[0], ops[0], '%lo(' + ops[1] + ')']]]; }
  };

  /**
   * `li` is one instruction for a small constant and two for a large one,
   * because an I-format immediate is twelve bits. The +0x800 is the classic
   * correction: `addi` sign-extends, so a low half above 0x7ff borrows one
   * from the upper half.
   */
  function expandLoadImmediate(ops) {
    const value = parseNumber(ops[1]);

    if (value === null) return [['addi', [ops[0], 'x0', ops[1]]]];
    if (value >= -2048 && value <= 2047) return [['addi', [ops[0], 'x0', String(value)]]];
    const upper = (value + 0x800) & 0xfffff000;
    const lower = value - (upper | 0);

    /* The `lui` operand in assembly is the twenty-bit FIELD, not the value it
       lands on — which is why `li x5, 0x12345` assembles to `lui x5, 0x12`
       and not to `lui x5, 0x12000`. Real assemblers read it this way and so
       does the disassembler here. */
    return [['lui', [ops[0], String((upper >>> 12) & 0xfffff)]],
      ['addi', [ops[0], ops[0], String(lower)]]];
  }

  /* ----------------------------------------------------------- directives */

  const DIRECTIVE_SIZES = {
    '.word': function (ops) { return 4 * ops.length; },
    '.byte': function (ops) { return ops.length; },
    '.space': function (ops) { return parseNumber(ops[0]) || 0; },
    '.string': function (ops) { return stringBytes(ops[0]).length; },
    '.asciz': function (ops) { return stringBytes(ops[0]).length; },
    '.align': function () { return 0; },
    '.globl': function () { return 0; },
    '.text': function () { return 0; },
    '.data': function () { return 0; }
  };

  function stringBytes(text) {
    const body = String(text).replace(/^"|"$/g, '').replace(/\\n/g, '\n').replace(/\\0/g, '\0');
    const out = [];

    for (let at = 0; at < body.length; at += 1) out.push(body.charCodeAt(at) & 0xff);
    out.push(0);
    return out;
  }

  function directiveBytes(op, operands) {
    if (op === '.word') {
      return operands.reduce(function (into, text) {
        const value = parseNumber(text) || 0;

        return into.concat([value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff,
          (value >>> 24) & 0xff]);
      }, []);
    }
    if (op === '.byte') {
      return operands.map(function (text) { return (parseNumber(text) || 0) & 0xff; });
    }
    if (op === '.space') return new Array(parseNumber(operands[0]) || 0).fill(0);
    if (op === '.string' || op === '.asciz') return stringBytes(operands[0]);
    return [];
  }

  /* ------------------------------------------------------------- passes */

  function expand(entry) {
    if (!entry.op || entry.op[0] === '.') return [entry];
    const pseudo = PSEUDO[entry.op];

    if (!pseudo) return [entry];
    return pseudo(entry.operands).map(function (pair, at) {
      return { line: entry.line, label: at === 0 ? entry.label : null, op: pair[0],
        operands: pair[1], text: entry.text, from: entry.op };
    });
  }

  function sizeOf(entry) {
    if (!entry.op) return 0;
    if (entry.op[0] === '.') {
      const measure = DIRECTIVE_SIZES[entry.op];

      return measure ? measure(entry.operands) : 0;
    }
    return 4;
  }

  function firstPass(entries, origin) {
    const symbols = {};
    const placed = [];
    let address = origin;

    entries.forEach(function (entry) {
      if (entry.label) symbols[entry.label] = address;
      placed.push({ entry: entry, address: address });
      address += sizeOf(entry);
    });
    return { symbols: symbols, placed: placed, end: address };
  }

  return buildApi({ parseLine: parseLine, parseNumber: parseNumber, parseMemory: parseMemory,
    expand: expand, sizeOf: sizeOf, firstPass: firstPass, directiveBytes: directiveBytes,
    stringBytes: stringBytes, PSEUDO: PSEUDO, Isa: Isa });

  /* ---------------------------------------------------------- second pass */

  function buildApi(parts) {
    const Isa = parts.Isa;

    /** Resolve one operand to a number: a register, a literal, a symbol, or a
     *  %hi/%lo relocation of a symbol. */
    function valueOf(text, context) {
      const literal = parts.parseNumber(text);

      if (literal !== null) return { value: literal };
      const relocation = String(text).match(/^%(hi|lo|pcrel)\(([^)]+)\)$/);

      if (relocation) return resolveRelocation(relocation, context);
      if (context.symbols[text] !== undefined) {
        return { value: context.symbols[text], symbol: text };
      }
      return { missing: text };
    }

    function resolveRelocation(match, context) {
      const target = context.symbols[match[2]];

      if (target === undefined) return { missing: match[2], kind: match[1] };
      /* `%lo` is defined here as "the low half of the pair whose `%hi` is the
         instruction immediately above me", which is what `la` expands to and
         what makes the two add up to the symbol exactly. */
      if (match[1] === 'hi') {
        return { value: (((target - context.address) + 0x800) >> 12) & 0xfffff };
      }
      if (match[1] === 'lo') {
        const offset = target - (context.address - 4);

        return { value: offset - ((offset + 0x800) & 0xfffff000) };
      }
      return { value: target - context.address };
    }

    /** An unresolved symbol is a relocation, not an error: it records where the
     *  hole is, what shape it is, and who has to fill it. That triple is the
     *  entire content of an object file's relocation table. */
    function note(context, entry, symbol, kind) {
      context.pending.push({ entry: entry, symbol: symbol, kind: kind,
        address: context.address, op: entry.op });
    }

    function registerOf(text, errors, line) {
      const number = Isa.registerNumber(text);

      if (number === -1) errors.push({ line: line, message: 'not a register: ' + text });
      return number === -1 ? 0 : number;
    }

    /** `csrrs rd, csr, rs1` names the control register in the middle, where
     *  every other I-format instruction names a source register. Reading it
     *  positionally would make 0x342 "not a register", which is exactly what
     *  it did before this existed. */
    function csrFields(entry, context) {
      const number = parts.parseNumber(entry.operands[1]);

      if (number === null) {
        context.errors.push({ line: entry.line,
          message: 'expected a control register number: ' + entry.operands[1] });
      }
      return { rd: registerOf(entry.operands[0], context.errors, entry.line),
        rs1: registerOf(entry.operands[2] || 'x0', context.errors, entry.line),
        imm: number === null ? 0 : number };
    }

    function fieldsFor(row, entry, context) {
      if (row.csr) return csrFields(entry, context);
      if (row.format === 'R') {
        return { rd: registerOf(entry.operands[0], context.errors, entry.line),
          rs1: registerOf(entry.operands[1], context.errors, entry.line),
          rs2: registerOf(entry.operands[2], context.errors, entry.line) };
      }
      if (row.format === 'S' || row.opcode === Isa.OPCODES.load) return memoryFields(row, entry, context);
      if (row.format === 'B') return branchFields(entry, context);
      if (row.format === 'J') return jumpFields(entry, context);
      if (row.format === 'U') return upperFields(entry, context);
      return immediateFields(row, entry, context);
    }

    function memoryFields(row, entry, context) {
      const isLoad = row.opcode === Isa.OPCODES.load;
      const target = registerOf(entry.operands[0], context.errors, entry.line);
      const memory = parts.parseMemory(entry.operands[1]);

      if (!memory) {
        context.errors.push({ line: entry.line, message: 'expected offset(register)' });
        return { rd: 0, rs1: 0, rs2: 0, imm: 0 };
      }
      const base = registerOf(memory.base, context.errors, entry.line);
      const offset = memory.symbol
        ? valueOf(memory.symbol, context).value || 0 : memory.offset;

      return isLoad ? { rd: target, rs1: base, imm: offset }
        : { rs1: base, rs2: target, imm: offset };
    }

    function branchFields(entry, context) {
      const resolved = valueOf(entry.operands[2], context);

      if (resolved.missing) note(context, entry, resolved.missing, 'branch');
      return { rs1: registerOf(entry.operands[0], context.errors, entry.line),
        rs2: registerOf(entry.operands[1], context.errors, entry.line),
        imm: (resolved.value === undefined ? 0 : resolved.value) - context.address };
    }

    function jumpFields(entry, context) {
      const resolved = valueOf(entry.operands[1], context);

      if (resolved.missing) note(context, entry, resolved.missing, 'jump');
      return { rd: registerOf(entry.operands[0], context.errors, entry.line),
        imm: (resolved.value === undefined ? 0 : resolved.value) - context.address };
    }

    /** A U-format operand is the twenty-bit field; the encoder takes the value
     *  those bits land on, so the assembler shifts. Keeping the encoder
     *  symmetric with the decoder is worth one shift here. */
    function upperFields(entry, context) {
      const resolved = valueOf(entry.operands[1], context);

      if (resolved.missing) note(context, entry, resolved.missing, 'upper');
      return { rd: registerOf(entry.operands[0], context.errors, entry.line),
        imm: resolved.value === undefined ? 0 : (resolved.value << 12) };
    }

    function immediateFields(row, entry, context) {
      const third = entry.operands[2];
      const resolved = third === undefined ? { value: 0 } : valueOf(third, context);

      if (resolved.missing) note(context, entry, resolved.missing, 'immediate');
      return { rd: registerOf(entry.operands[0] || 'x0', context.errors, entry.line),
        rs1: registerOf(entry.operands[1] || 'x0', context.errors, entry.line),
        imm: resolved.value === undefined ? 0 : resolved.value };
    }

    function encodeEntry(placed, context) {
      const entry = placed.entry;
      const row = Isa.BY_NAME[entry.op];

      if (!row) {
        context.errors.push({ line: entry.line, message: 'unknown instruction: ' + entry.op });
        return null;
      }
      if (row.fixed !== undefined) return Isa.encode(entry.op, {});
      const fields = fieldsFor(row, entry, Object.assign({}, context, { address: placed.address }));

      return Isa.encode(entry.op, fields);
    }

    /** The whole assembly, in the order a reader would do it by hand. */
    function assemble(source, options) {
      const settings = options || {};
      const origin = settings.origin === undefined ? 0 : settings.origin;
      const entries = String(source).split('\n')
        .map(function (text, at) { return parts.parseLine(text, at + 1); })
        .filter(Boolean)
        .reduce(function (into, entry) { return into.concat(parts.expand(entry)); }, []);
      const first = parts.firstPass(entries, origin);
      const context = { symbols: Object.assign({}, settings.symbols, first.symbols),
        errors: [], pending: [] };

      return emit(first, context, origin);
    }

    function emit(first, context, origin) {
      const bytes = [];
      const listing = [];

      first.placed.forEach(function (placed) {
        const entry = placed.entry;

        if (!entry.op) return;
        if (entry.op[0] === '.') {
          const data = parts.directiveBytes(entry.op, entry.operands);

          data.forEach(function (byte) { bytes.push(byte); });
          listing.push({ address: placed.address, line: entry.line, text: entry.text,
            bytes: data, directive: entry.op });
          return;
        }
        const word = encodeEntry(placed, context);

        pushWord(bytes, word === null ? 0 : word);
        listing.push({ address: placed.address, line: entry.line, text: entry.text,
          word: (word === null ? 0 : word) >>> 0, op: entry.op, from: entry.from,
          operands: entry.operands });
      });
      return { ok: context.errors.length === 0, bytes: bytes, listing: listing,
        symbols: context.symbols, errors: context.errors, origin: origin,
        relocations: context.pending.map(function (row) {
          return { line: row.entry.line, symbol: row.symbol, op: row.op,
            kind: row.kind, address: row.address };
        }) };
    }

    function pushWord(bytes, word) {
      bytes.push(word & 0xff, (word >>> 8) & 0xff, (word >>> 16) & 0xff, (word >>> 24) & 0xff);
    }

    return { assemble: assemble, parseLine: parts.parseLine, parseNumber: parts.parseNumber,
      parseMemory: parts.parseMemory, expand: parts.expand, sizeOf: parts.sizeOf,
      firstPass: parts.firstPass, stringBytes: parts.stringBytes, PSEUDO: parts.PSEUDO };
  }
}));

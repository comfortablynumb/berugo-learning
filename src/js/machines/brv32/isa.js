/**
 * Brv32Isa - the instruction set as data.
 *
 * BRV32 is the RV32I base integer instruction set, unchanged where it matters:
 * the same opcodes, the same six formats, the same immediate scrambling. That
 * compatibility is the point. It means the encodings on this page can be
 * checked against a published specification rather than against themselves,
 * and a learner can paste an instruction into any RISC-V assembler and compare.
 *
 * Everything here is a value. An instruction is a row in a table - name,
 * format, opcode, funct fields, and a `run` that mutates architectural state -
 * so the assembler, the disassembler, the behavioural simulator and the
 * gate-level control unit are all readers of one description rather than four
 * implementations that must be kept in agreement.
 *
 * The immediate scrambling is the part that looks arbitrary and is not. The
 * bits are placed so that every format's immediate reaches the sign extender
 * on the same wires: bit 31 is always the sign, and the fields below it move
 * as little as possible between formats. `immediateParts` reports that
 * decomposition field by field, because it is much easier to believe when you
 * can see which source bits landed where.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) {
    scope.Brv32 = scope.Brv32 || {};
    scope.Brv32.Isa = api;
  }
}(this, function () {
  'use strict';

  const XLEN = 32;
  const OPCODES = { op: 0x33, opImm: 0x13, load: 0x03, store: 0x23, branch: 0x63,
    jal: 0x6f, jalr: 0x67, lui: 0x37, auipc: 0x17, system: 0x73 };

  /* ------------------------------------------------------------ bit tools */

  function bits(word, high, low) {
    return (word >>> low) & ((1 << (high - low + 1)) - 1);
  }

  function signExtend(value, width) {
    const sign = 1 << (width - 1);

    return (value & (sign - 1)) - (value & sign);
  }

  function toUnsigned(value) {
    return value >>> 0;
  }

  function toSigned(value) {
    return value | 0;
  }

  /* -------------------------------------------------------- the immediates */

  /**
   * Where each format's immediate bits come from, as data. The tables read
   * `[destinationHigh, destinationLow, sourceHigh, sourceLow]`, which is
   * exactly how a decoder is wired: a bundle of wires from one place to
   * another.
   */
  const IMMEDIATE_FIELDS = {
    I: [[11, 0, 31, 20]],
    S: [[11, 5, 31, 25], [4, 0, 11, 7]],
    B: [[12, 12, 31, 31], [10, 5, 30, 25], [4, 1, 11, 8], [11, 11, 7, 7]],
    U: [[31, 12, 31, 12]],
    J: [[20, 20, 31, 31], [10, 1, 30, 21], [11, 11, 20, 20], [19, 12, 19, 12]]
  };

  const IMMEDIATE_WIDTH = { I: 12, S: 12, B: 13, U: 32, J: 21 };

  function immediateParts(word, format) {
    return (IMMEDIATE_FIELDS[format] || []).map(function (field) {
      const value = bits(word, field[2], field[3]);

      return { to: 'imm[' + field[0] + ':' + field[1] + ']',
        from: 'word[' + field[2] + ':' + field[3] + ']',
        value: value, width: field[0] - field[1] + 1 };
    });
  }

  function immediateOf(word, format) {
    if (!IMMEDIATE_FIELDS[format]) return 0;
    let value = 0;

    IMMEDIATE_FIELDS[format].forEach(function (field) {
      value |= bits(word, field[2], field[3]) << field[1];
    });
    if (format === 'U') return value | 0;
    return signExtend(value >>> 0, IMMEDIATE_WIDTH[format]);
  }

  function packImmediate(value, format) {
    if (!IMMEDIATE_FIELDS[format]) return 0;
    let word = 0;

    IMMEDIATE_FIELDS[format].forEach(function (field) {
      const width = field[0] - field[1] + 1;
      const part = (value >> field[1]) & ((1 << width) - 1);

      word |= part << field[3];
    });
    return word >>> 0;
  }

  /* ------------------------------------------------- the instruction table */

  function reg(state, index) {
    return index === 0 ? 0 : state.registers[index] | 0;
  }

  function write(state, index, value) {
    if (index !== 0) state.registers[index] = value | 0;
  }

  function arithmetic(name, funct3, funct7, apply) {
    return { name: name, format: 'R', opcode: OPCODES.op, funct3: funct3, funct7: funct7,
      about: 'register-register arithmetic',
      run: function (state, f) {
        write(state, f.rd, apply(reg(state, f.rs1), reg(state, f.rs2)));
      } };
  }

  function immediate(name, funct3, apply, funct7) {
    return { name: name, format: 'I', opcode: OPCODES.opImm, funct3: funct3, funct7: funct7,
      about: 'register-immediate arithmetic',
      run: function (state, f) { write(state, f.rd, apply(reg(state, f.rs1), f.imm)); } };
  }

  function load(name, funct3, width, signed) {
    return { name: name, format: 'I', opcode: OPCODES.load, funct3: funct3, width: width,
      signed: signed, about: 'load ' + width + ' byte(s)' + (signed ? ', sign extended' : ''),
      run: function (state, f) {
        write(state, f.rd, state.memory.read(reg(state, f.rs1) + f.imm, width, signed));
      } };
  }

  function store(name, funct3, width) {
    return { name: name, format: 'S', opcode: OPCODES.store, funct3: funct3, width: width,
      about: 'store ' + width + ' byte(s)',
      run: function (state, f) {
        state.memory.write(reg(state, f.rs1) + f.imm, reg(state, f.rs2), width);
      } };
  }

  function branch(name, funct3, taken) {
    return { name: name, format: 'B', opcode: OPCODES.branch, funct3: funct3, branch: true,
      about: 'branch if ' + name.slice(1),
      run: function (state, f) {
        if (taken(reg(state, f.rs1), reg(state, f.rs2))) state.next = (state.pc + f.imm) >>> 0;
      } };
  }

  const SHIFT = { sll: 0, srl: 1, sra: 2 };

  function shiftBy(value, amount, kind) {
    const by = amount & 31;

    if (kind === SHIFT.sll) return value << by;
    if (kind === SHIFT.srl) return value >>> by;
    return value >> by;
  }

  const TABLE = [
    arithmetic('add', 0x0, 0x00, function (a, b) { return (a + b) | 0; }),
    arithmetic('sub', 0x0, 0x20, function (a, b) { return (a - b) | 0; }),
    arithmetic('sll', 0x1, 0x00, function (a, b) { return shiftBy(a, b, SHIFT.sll); }),
    arithmetic('slt', 0x2, 0x00, function (a, b) { return a < b ? 1 : 0; }),
    arithmetic('sltu', 0x3, 0x00, function (a, b) {
      return toUnsigned(a) < toUnsigned(b) ? 1 : 0;
    }),
    arithmetic('xor', 0x4, 0x00, function (a, b) { return a ^ b; }),
    arithmetic('srl', 0x5, 0x00, function (a, b) { return shiftBy(a, b, SHIFT.srl); }),
    arithmetic('sra', 0x5, 0x20, function (a, b) { return shiftBy(a, b, SHIFT.sra); }),
    arithmetic('or', 0x6, 0x00, function (a, b) { return a | b; }),
    arithmetic('and', 0x7, 0x00, function (a, b) { return a & b; }),

    immediate('addi', 0x0, function (a, b) { return (a + b) | 0; }),
    immediate('slti', 0x2, function (a, b) { return a < b ? 1 : 0; }),
    immediate('sltiu', 0x3, function (a, b) { return toUnsigned(a) < toUnsigned(b) ? 1 : 0; }),
    immediate('xori', 0x4, function (a, b) { return a ^ b; }),
    immediate('ori', 0x6, function (a, b) { return a | b; }),
    immediate('andi', 0x7, function (a, b) { return a & b; }),
    immediate('slli', 0x1, function (a, b) { return shiftBy(a, b, SHIFT.sll); }, 0x00),
    immediate('srli', 0x5, function (a, b) { return shiftBy(a, b, SHIFT.srl); }, 0x00),
    immediate('srai', 0x5, function (a, b) { return shiftBy(a, b, SHIFT.sra); }, 0x20),

    load('lb', 0x0, 1, true), load('lh', 0x1, 2, true), load('lw', 0x2, 4, true),
    load('lbu', 0x4, 1, false), load('lhu', 0x5, 2, false),
    store('sb', 0x0, 1), store('sh', 0x1, 2), store('sw', 0x2, 4),

    branch('beq', 0x0, function (a, b) { return a === b; }),
    branch('bne', 0x1, function (a, b) { return a !== b; }),
    branch('blt', 0x4, function (a, b) { return a < b; }),
    branch('bge', 0x5, function (a, b) { return a >= b; }),
    branch('bltu', 0x6, function (a, b) { return toUnsigned(a) < toUnsigned(b); }),
    branch('bgeu', 0x7, function (a, b) { return toUnsigned(a) >= toUnsigned(b); }),

    { name: 'lui', format: 'U', opcode: OPCODES.lui, about: 'load upper immediate',
      run: function (state, f) { write(state, f.rd, f.imm | 0); } },
    { name: 'auipc', format: 'U', opcode: OPCODES.auipc, about: 'PC plus upper immediate',
      run: function (state, f) { write(state, f.rd, (state.pc + f.imm) | 0); } },
    { name: 'jal', format: 'J', opcode: OPCODES.jal, jump: true, about: 'jump and link',
      run: function (state, f) {
        write(state, f.rd, (state.pc + 4) | 0);
        state.next = (state.pc + f.imm) >>> 0;
      } },
    { name: 'jalr', format: 'I', opcode: OPCODES.jalr, funct3: 0x0, jump: true,
      about: 'jump and link register',
      run: function (state, f) {
        const target = (reg(state, f.rs1) + f.imm) & ~1;

        write(state, f.rd, (state.pc + 4) | 0);
        state.next = target >>> 0;
      } },

    { name: 'ecall', format: 'I', opcode: OPCODES.system, funct3: 0x0, fixed: 0x000,
      about: 'environment call — a deliberate exception',
      run: function (state) { state.trap = { cause: 11, value: 0, name: 'environment call' }; } },
    { name: 'ebreak', format: 'I', opcode: OPCODES.system, funct3: 0x0, fixed: 0x001,
      about: 'breakpoint',
      run: function (state) { state.trap = { cause: 3, value: 0, name: 'breakpoint' }; } },
    { name: 'mret', format: 'I', opcode: OPCODES.system, funct3: 0x0, fixed: 0x302,
      about: 'return from a machine-mode trap',
      run: function (state) { state.mret = true; } },
    { name: 'csrrw', format: 'I', opcode: OPCODES.system, funct3: 0x1, csr: true,
      about: 'read a control register and write it',
      run: function (state, f) { state.csrAccess = { op: 'w', csr: f.imm & 0xfff, fields: f }; } },
    { name: 'csrrs', format: 'I', opcode: OPCODES.system, funct3: 0x2, csr: true,
      about: 'read a control register and set bits in it',
      run: function (state, f) { state.csrAccess = { op: 's', csr: f.imm & 0xfff, fields: f }; } }
  ];

  const BY_NAME = {};

  TABLE.forEach(function (row) { BY_NAME[row.name] = row; });

  /* ------------------------------------------------------------- encoding */

  function encodeFields(row, operands) {
    const fields = operands || {};
    let word = row.opcode >>> 0;

    word |= ((fields.rd || 0) & 31) << 7;
    if (row.funct3 !== undefined) word |= (row.funct3 & 7) << 12;
    word |= ((fields.rs1 || 0) & 31) << 15;
    if (row.format === 'R') {
      word |= ((fields.rs2 || 0) & 31) << 20;
      word |= (row.funct7 & 0x7f) << 25;
      return word >>> 0;
    }
    return (word | variableField(row, fields)) >>> 0;
  }

  /** Everything that is not a fixed field: the immediate, the second source
   *  register a store or branch needs, and the constant body of a SYSTEM
   *  instruction. */
  function variableField(row, fields) {
    if (row.fixed !== undefined) return row.fixed << 20;
    if (row.format === 'S' || row.format === 'B') {
      return packImmediate(fields.imm | 0, row.format) | (((fields.rs2 || 0) & 31) << 20);
    }
    if (row.format === 'I' && row.funct7 !== undefined) {
      return ((fields.imm & 31) << 20) | ((row.funct7 & 0x7f) << 25);
    }
    return packImmediate(fields.imm | 0, row.format);
  }

  function encode(name, operands) {
    const row = BY_NAME[name];

    if (!row) throw new Error('no such instruction: ' + name);
    return encodeFields(row, operands);
  }

  /* ------------------------------------------------------------- decoding */

  function candidates(word) {
    const opcode = bits(word, 6, 0);
    const funct3 = bits(word, 14, 12);

    return TABLE.filter(function (row) {
      if (row.opcode !== opcode) return false;
      if (row.funct3 !== undefined && row.funct3 !== funct3) return false;
      if (row.format === 'R' && row.funct7 !== bits(word, 31, 25)) return false;
      if (row.format === 'I' && row.funct7 !== undefined && row.funct7 !== bits(word, 31, 25)) {
        return false;
      }
      return row.fixed === undefined || row.fixed === bits(word, 31, 20);
    });
  }

  /** A shift-immediate carries its shift amount in the low five bits of the
   *  I-format field, with funct7 above it selecting arithmetic or logical.
   *  Reporting the whole field as the immediate would make `srai x2, x1, 3`
   *  read as an immediate of 1027, which is true of the bits and wrong about
   *  the instruction. */
  function immediateFor(row, value) {
    if (row.format === 'I' && row.funct7 !== undefined) return bits(value, 24, 20);
    return immediateOf(value, row.format);
  }

  function decode(word) {
    const value = word >>> 0;
    const row = candidates(value)[0];

    if (!row) {
      return { ok: false, raw: value, name: null,
        why: 'no instruction matches opcode 0x' + bits(value, 6, 0).toString(16) };
    }
    return { ok: true, raw: value, name: row.name, format: row.format, row: row,
      rd: bits(value, 11, 7), rs1: bits(value, 19, 15), rs2: bits(value, 24, 20),
      funct3: bits(value, 14, 12), funct7: bits(value, 31, 25),
      imm: immediateFor(row, value), parts: immediateParts(value, row.format) };
  }

  const REGISTER_NAMES = ['zero', 'ra', 'sp', 'gp', 'tp', 't0', 't1', 't2', 's0', 's1',
    'a0', 'a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 's2', 's3', 's4', 's5', 's6', 's7',
    's8', 's9', 's10', 's11', 't3', 't4', 't5', 't6'];

  function registerNumber(name) {
    const trimmed = String(name).trim();
    const at = REGISTER_NAMES.indexOf(trimmed);

    if (at !== -1) return at;
    if (/^x(\d|[12]\d|3[01])$/.test(trimmed)) return Number(trimmed.slice(1));
    return -1;
  }

  return { XLEN: XLEN, OPCODES: OPCODES, TABLE: TABLE, BY_NAME: BY_NAME,
    REGISTER_NAMES: REGISTER_NAMES, registerNumber: registerNumber,
    IMMEDIATE_FIELDS: IMMEDIATE_FIELDS, IMMEDIATE_WIDTH: IMMEDIATE_WIDTH,
    encode: encode, decode: decode, bits: bits, signExtend: signExtend,
    immediateOf: immediateOf, immediateFor: immediateFor,
    immediateParts: immediateParts, packImmediate: packImmediate,
    toUnsigned: toUnsigned, toSigned: toSigned };
}));

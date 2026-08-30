/**
 * Brv32Disassembler - bytes back to assembly, with the fields shown.
 *
 * The interesting output is not the mnemonic, it is the field breakdown: which
 * bits became the opcode, which became a register number, and which pieces
 * were gathered from four different places to form the immediate. Printing
 * that beside the instruction is what turns the immediate scrambling from an
 * arbitrary rule into an observable fact.
 *
 * It is also the round-trip half of the encoder. `decode(encode(x)) === x` for
 * every instruction in the table is a cheap and total check, and it catches
 * the field-shift mistakes that are otherwise found by a program behaving
 * strangely six instructions later.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) {
    scope.Brv32 = scope.Brv32 || {};
    scope.Brv32.Disassembler = api;
  }
}(this, function (root) {
  'use strict';

  const Isa = root && root.Brv32 && root.Brv32.Isa ? root.Brv32.Isa : require('./isa.js');

  function regName(number) {
    return Isa.REGISTER_NAMES[number] || ('x' + number);
  }

  function hex(value, width) {
    return '0x' + (value >>> 0).toString(16).padStart(width || 8, '0');
  }

  /** The operand text for each format, which is the only per-format knowledge
   *  this module has — everything else comes from the decode. */
  function operandsOf(decoded, address) {
    const format = decoded.format;

    if (decoded.row.fixed !== undefined) return '';
    if (format === 'R') {
      return [regName(decoded.rd), regName(decoded.rs1), regName(decoded.rs2)].join(', ');
    }
    if (format === 'S') {
      return regName(decoded.rs2) + ', ' + decoded.imm + '(' + regName(decoded.rs1) + ')';
    }
    if (format === 'B') {
      return [regName(decoded.rs1), regName(decoded.rs2),
        hex((address + decoded.imm) >>> 0, 4)].join(', ');
    }
    if (format === 'U') return regName(decoded.rd) + ', ' + hex(decoded.imm >>> 12, 5);
    if (format === 'J') return regName(decoded.rd) + ', ' + hex((address + decoded.imm) >>> 0, 4);
    return immediateOperands(decoded);
  }

  function immediateOperands(decoded) {
    if (decoded.row.opcode === Isa.OPCODES.load) {
      return regName(decoded.rd) + ', ' + decoded.imm + '(' + regName(decoded.rs1) + ')';
    }
    return [regName(decoded.rd), regName(decoded.rs1), String(decoded.imm)].join(', ');
  }

  /** Every field of the word, named — including the ones this instruction does
   *  not use, because "that field is ignored here" is itself the answer to a
   *  question a reader will have. */
  function fieldsOf(decoded) {
    const word = decoded.raw;
    const used = decoded.format;
    const rows = [
      { name: 'opcode', bits: '[6:0]', value: Isa.bits(word, 6, 0), used: true,
        shows: hex(Isa.bits(word, 6, 0), 2) + ' — ' + decoded.name },
      { name: 'rd', bits: '[11:7]', value: decoded.rd,
        used: 'RIUJ'.indexOf(used) !== -1, shows: regName(decoded.rd) },
      { name: 'funct3', bits: '[14:12]', value: decoded.funct3,
        used: used !== 'U' && used !== 'J', shows: hex(decoded.funct3, 1) },
      { name: 'rs1', bits: '[19:15]', value: decoded.rs1,
        used: 'RISB'.indexOf(used) !== -1, shows: regName(decoded.rs1) },
      { name: 'rs2', bits: '[24:20]', value: decoded.rs2,
        used: 'RSB'.indexOf(used) !== -1, shows: regName(decoded.rs2) },
      { name: 'funct7', bits: '[31:25]', value: decoded.funct7, used: used === 'R',
        shows: hex(decoded.funct7, 2) }
    ];

    return rows.concat([{ name: 'immediate', bits: 'gathered', value: decoded.imm,
      used: used !== 'R', shows: String(decoded.imm) }]);
  }

  function line(word, address) {
    const decoded = Isa.decode(word);

    if (!decoded.ok) {
      return { ok: false, address: address >>> 0, word: word >>> 0, text: '.word ' + hex(word),
        why: decoded.why };
    }
    const operands = operandsOf(decoded, address >>> 0);

    return { ok: true, address: address >>> 0, word: word >>> 0, name: decoded.name,
      text: decoded.name + (operands ? ' ' + operands : ''), decoded: decoded,
      fields: fieldsOf(decoded), parts: decoded.parts };
  }

  /** A whole image, word by word. Data disassembles as nonsense and says so
   *  rather than pretending — a disassembler cannot tell code from data, which
   *  is why the section on linking cares about section boundaries. */
  function listing(bytes, options) {
    const settings = options || {};
    const base = settings.base === undefined ? 0 : settings.base;
    const out = [];

    for (let at = 0; at + 3 < bytes.length; at += 4) {
      const word = (bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16) |
        (bytes[at + 3] << 24)) >>> 0;

      out.push(line(word, base + at));
    }
    return out;
  }

  return { line: line, listing: listing, fieldsOf: fieldsOf, regName: regName, hex: hex };
}));

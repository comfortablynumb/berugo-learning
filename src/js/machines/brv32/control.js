/**
 * Brv32Control - the control unit, twice: as a table and as gates.
 *
 * `signalsFor` is the specification: given a decoded instruction it returns
 * the control-signal vector the datapath needs. `decoder()` is a netlist that
 * computes the same vector from the raw instruction bits, and it is checked
 * against the table over every opcode the machine can see. That is the same
 * discipline the rest of the milestone uses — a gate-level claim and a
 * behavioural judge — applied to the block that is hardest to reason about by
 * looking at it.
 *
 * A control unit is where "hardwired versus microcoded" stops being a slogan.
 * Hardwired control is this: a handful of AND terms over the opcode, one per
 * signal, finished in two gate delays. Microcode replaces it with a memory
 * whose contents are the signal vectors, addressed by a state counter — slower
 * per instruction, and changeable after the chip is made, which is why every
 * microcode update you have ever installed exists.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) {
    scope.Brv32 = scope.Brv32 || {};
    scope.Brv32.Control = api;
  }
}(this, function (root) {
  'use strict';

  const has = root && root.Brv32;
  const Isa = has && root.Brv32.Isa ? root.Brv32.Isa : require('./isa.js');
  const Sim = root && root.LogicSim ? root.LogicSim : require('../logic-sim.js');

  /** Every signal the datapath consumes, with what it does when asserted.
   *  The `about` text is what the demo shows beside the wire. */
  const SIGNALS = [
    { name: 'regWrite', about: 'write the result back to rd' },
    { name: 'aluSrc', about: 'the second ALU operand is the immediate, not rs2' },
    { name: 'memRead', about: 'read data memory this cycle' },
    { name: 'memWrite', about: 'write data memory this cycle' },
    { name: 'branch', about: 'this is a conditional branch — the comparison decides' },
    { name: 'jump', about: 'unconditionally redirect the program counter' },
    { name: 'jalr', about: 'the jump target comes from rs1 rather than the PC' },
    { name: 'usePc', about: 'the first ALU operand is the program counter, not rs1' },
    { name: 'writeBack', about: '0 ALU, 1 memory, 2 PC+4, 3 immediate', width: 2 },
    { name: 'aluOp', about: 'which ALU function to apply', width: 4 }
  ];

  /** The ALU function codes this datapath uses. They are the datapath's own
   *  encoding, not the instruction's: mapping one to the other is exactly what
   *  the control unit is for. */
  const ALU = { add: 0, sub: 1, and: 2, or: 3, xor: 4, sll: 5, srl: 6, sra: 7,
    slt: 8, sltu: 9, passB: 10 };

  const ALU_BY_NAME = { add: ALU.add, addi: ALU.add, sub: ALU.sub, and: ALU.and,
    andi: ALU.and, or: ALU.or, ori: ALU.or, xor: ALU.xor, xori: ALU.xor,
    sll: ALU.sll, slli: ALU.sll, srl: ALU.srl, srli: ALU.srl, sra: ALU.sra, srai: ALU.sra,
    slt: ALU.slt, slti: ALU.slt, sltu: ALU.sltu, sltiu: ALU.sltu };

  const WRITE_BACK = { alu: 0, memory: 1, link: 2, immediate: 3 };

  function blank() {
    return { regWrite: 0, aluSrc: 0, memRead: 0, memWrite: 0, branch: 0, jump: 0,
      jalr: 0, usePc: 0, writeBack: WRITE_BACK.alu, aluOp: ALU.add };
  }

  /**
   * The control table, by opcode. Every row is one line of what a hardwired
   * decoder does, and the shape — most signals zero, a few set — is why the
   * decoder is cheap.
   */
  function signalsFor(decoded) {
    const out = blank();

    if (!decoded || !decoded.ok) return out;
    const opcode = decoded.row.opcode;

    if (opcode === Isa.OPCODES.op) return register(out, decoded);
    if (opcode === Isa.OPCODES.opImm) return immediate(out, decoded);
    if (opcode === Isa.OPCODES.load) return loadSignals(out);
    if (opcode === Isa.OPCODES.store) return storeSignals(out);
    if (opcode === Isa.OPCODES.branch) return branchSignals(out);
    return controlTransfer(out, decoded, opcode);
  }

  function register(out, decoded) {
    out.regWrite = 1;
    out.aluOp = ALU_BY_NAME[decoded.name];
    return out;
  }

  function immediate(out, decoded) {
    out.regWrite = 1;
    out.aluSrc = 1;
    out.aluOp = ALU_BY_NAME[decoded.name];
    return out;
  }

  function loadSignals(out) {
    out.regWrite = 1;
    out.aluSrc = 1;
    out.memRead = 1;
    out.writeBack = WRITE_BACK.memory;
    return out;
  }

  function storeSignals(out) {
    out.aluSrc = 1;
    out.memWrite = 1;
    return out;
  }

  function branchSignals(out) {
    out.branch = 1;
    out.aluOp = ALU.sub;
    return out;
  }

  function controlTransfer(out, decoded, opcode) {
    if (opcode === Isa.OPCODES.lui) {
      out.regWrite = 1;
      out.writeBack = WRITE_BACK.immediate;
      return out;
    }
    if (opcode === Isa.OPCODES.auipc) {
      out.regWrite = 1;
      out.aluSrc = 1;
      out.writeBack = WRITE_BACK.alu;
      out.usePc = 1;
      return out;
    }
    if (opcode === Isa.OPCODES.jal || opcode === Isa.OPCODES.jalr) {
      out.regWrite = 1;
      out.jump = 1;
      out.jalr = opcode === Isa.OPCODES.jalr ? 1 : 0;
      /* `jalr` computes its target as rs1 + immediate, and the adder that does
         it is the ALU — so the second operand is the immediate. Leaving this
         at 0 was the first disagreement the gate-level decoder found against
         this table, before any datapath existed to be confused by it. */
      out.aluSrc = out.jalr;
      out.writeBack = WRITE_BACK.link;
      return out;
    }
    return out;
  }

  /* -------------------------------------------------------- as gates */

  /** One AND term per opcode, which is a decoder — the block from M33.3, and
   *  the reason a hardwired control unit is two gate delays deep. */
  function opcodeTerm(net, inputs, opcode) {
    let node = null;

    for (let at = 0; at < 7; at += 1) {
      const line = ((opcode >> at) & 1) ? inputs[at] : Sim.addGate(net, 'not', [inputs[at]]);

      node = node === null ? line : Sim.addGate(net, 'and', [node, line]);
    }
    return node;
  }

  function orAll(net, nodes) {
    if (!nodes.length) return Sim.addNode(net, 'const0', []);
    return nodes.reduce(function (left, right) {
      return Sim.addGate(net, 'or', [left, right]);
    });
  }

  /** The signals that depend only on the opcode. `aluOp` and `writeBack` are
   *  multi-bit and are produced the same way, one OR term per bit. */
  const OPCODE_SIGNALS = {
    regWrite: ['op', 'opImm', 'load', 'lui', 'auipc', 'jal', 'jalr'],
    aluSrc: ['opImm', 'load', 'store', 'auipc', 'jalr'],
    memRead: ['load'],
    memWrite: ['store'],
    branch: ['branch'],
    jump: ['jal', 'jalr'],
    jalr: ['jalr']
  };

  function decoder() {
    const net = Sim.create('hardwired control decoder');
    const inputs = [];

    for (let at = 0; at < 7; at += 1) inputs.push(Sim.addInput(net, 'op' + at));
    const terms = {};

    Object.keys(Isa.OPCODES).forEach(function (name) {
      terms[name] = opcodeTerm(net, inputs, Isa.OPCODES[name]);
    });
    Object.keys(OPCODE_SIGNALS).forEach(function (signal) {
      Sim.addOutput(net, signal, orAll(net, OPCODE_SIGNALS[signal].map(function (name) {
        return terms[name];
      })));
    });
    writeBackBits(net, terms);
    return net;
  }

  /** `writeBack` is two bits: 01 for a load, 10 for a jump link, 11 for lui. */
  function writeBackBits(net, terms) {
    Sim.addOutput(net, 'writeBack0', orAll(net, [terms.load, terms.lui]));
    Sim.addOutput(net, 'writeBack1', orAll(net, [terms.jal, terms.jalr, terms.lui]));
  }

  /* ------------------------------------------------- the ALU function code */

  /** The datapath's ALU takes a select value, a subtract bit, an arithmetic
   *  bit and an unsigned bit. This is the map from the instruction's funct3
   *  and funct7 to those four, and it is the whole of "what the control unit
   *  is for": the instruction encoding and the datapath encoding are different
   *  languages, and this is the translation. */
  const ALU_TO_DATAPATH = {
    0: { select: 0, sub: 0 }, 1: { select: 0, sub: 1 },
    2: { select: 1 }, 3: { select: 2 }, 4: { select: 3 },
    5: { select: 4 }, 6: { select: 5 }, 7: { select: 5, arith: 1 },
    8: { select: 6, sub: 1 }, 9: { select: 6, sub: 1, unsig: 1 },
    10: { select: 7 }
  };

  function aluControlFor(signals) {
    const row = ALU_TO_DATAPATH[signals.aluOp] || ALU_TO_DATAPATH[0];

    return { select: row.select, sub: row.sub || 0, arith: row.arith || 0,
      unsig: row.unsig || 0 };
  }

  /**
   * The same translation as gates: a 3-to-8 decoder over funct3, an OR per
   * output bit, and three AND terms. It is checked against the map above over
   * every instruction, and it is what the hardwired-control lab asks for.
   */
  function aluDecoder() {
    const net = Sim.create('ALU function decoder');
    const funct3 = [];

    for (let at = 0; at < 3; at += 1) funct3.push(Sim.addInput(net, 'f' + at));
    const bit30 = Sim.addInput(net, 'bit30');
    const isArith = Sim.addInput(net, 'isArith');
    const isReg = Sim.addInput(net, 'isReg');
    const isBranch = Sim.addInput(net, 'isBranch');
    const terms = decodeFunct3(net, funct3);

    aluSelectBits(net, terms, isArith);
    Sim.addOutput(net, 'sub', subtractSignal(net, terms, {
      bit30: bit30, isArith: isArith, isReg: isReg, isBranch: isBranch }));
    Sim.addOutput(net, 'arith', Sim.addGate(net, 'and',
      [Sim.addGate(net, 'and', [terms[5], bit30]), isArith]));
    Sim.addOutput(net, 'unsigned', Sim.addGate(net, 'and', [terms[3], isArith]));
    return net;
  }

  /** Three reasons to subtract: the `sub` instruction, a set-less-than (which
   *  compares by subtracting), and any branch (whose condition is read off the
   *  flags of the same subtraction). Missing the last two is the kind of
   *  omission a differential against the table finds and a demo does not. */
  function subtractSignal(net, terms, ports) {
    const explicit = Sim.addGate(net, 'and',
      [Sim.addGate(net, 'and', [terms[0], ports.bit30]), ports.isReg]);
    const compare = Sim.addGate(net, 'and',
      [Sim.addGate(net, 'or', [terms[2], terms[3]]), ports.isArith]);

    return Sim.addGate(net, 'or', [Sim.addGate(net, 'or', [explicit, compare]), ports.isBranch]);
  }

  function decodeFunct3(net, funct3) {
    const terms = [];

    for (let value = 0; value < 8; value += 1) {
      let node = null;

      for (let at = 0; at < 3; at += 1) {
        const line = ((value >> at) & 1) ? funct3[at] : Sim.addGate(net, 'not', [funct3[at]]);

        node = node === null ? line : Sim.addGate(net, 'and', [node, line]);
      }
      terms.push(node);
    }
    return terms;
  }

  /** funct3 0..7 map to ALU selects 0, 4, 6, 6, 3, 5, 2, 1 — so each select
   *  bit is an OR over the funct3 values that set it. */
  const SELECT_BITS = [[4, 5, 7], [2, 3, 4, 6], [1, 2, 3, 5]];

  function aluSelectBits(net, terms, isArith) {
    SELECT_BITS.forEach(function (values, bit) {
      const any = orAll(net, values.map(function (value) { return terms[value]; }));

      Sim.addOutput(net, 'sel' + bit, Sim.addGate(net, 'and', [any, isArith]));
    });
  }

  /** Which immediate format the generator should select, by opcode. */
  function immediateSelect(decoded) {
    const order = { I: 0, S: 1, B: 2, U: 3, J: 4 };

    return decoded && decoded.ok ? (order[decoded.format] || 0) : 0;
  }

  /** The behavioural signals for a raw word, so the netlist above has
   *  something to be checked against. */
  function expected(word) {
    return signalsFor(Isa.decode(word));
  }

  return { SIGNALS: SIGNALS, ALU: ALU, ALU_BY_NAME: ALU_BY_NAME, WRITE_BACK: WRITE_BACK,
    OPCODE_SIGNALS: OPCODE_SIGNALS, ALU_TO_DATAPATH: ALU_TO_DATAPATH,
    SELECT_BITS: SELECT_BITS, signalsFor: signalsFor, blank: blank,
    decoder: decoder, aluDecoder: aluDecoder, aluControlFor: aluControlFor,
    immediateSelect: immediateSelect, expected: expected, opcodeTerm: opcodeTerm };
}));

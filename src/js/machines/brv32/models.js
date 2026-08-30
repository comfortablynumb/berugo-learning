/**
 * Brv32Models - the same expression on three kinds of machine.
 *
 * A register machine names its operands, a stack machine implies them, and an
 * accumulator machine has exactly one implied destination. That single choice
 * decides how many bits an instruction needs, how many instructions a program
 * takes, and how much of the encoding is left over for immediates — and this
 * module measures all three by running the same computation on all three
 * rather than describing the difference.
 *
 * Each model here is a real interpreter with a real encoding, so the byte
 * counts are of programs that produce the right answer. A comparison between a
 * program that runs and a program somebody sketched is not a comparison.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) {
    scope.Brv32 = scope.Brv32 || {};
    scope.Brv32.Models = api;
  }
}(this, function () {
  'use strict';

  /* ------------------------------------------------------- stack machine */

  const STACK_OPS = { pushLocal: 0, pushConst: 1, add: 2, sub: 3, shiftLeft: 4, store: 5 };

  /** One byte per instruction: four bits of opcode, four bits of operand.
   *  There is nowhere to say which registers to use, because there are none. */
  function runStack(program, locals) {
    const stack = [];

    program.forEach(function (step) {
      if (step.op === STACK_OPS.pushLocal) { stack.push(locals[step.arg] | 0); return; }
      if (step.op === STACK_OPS.pushConst) { stack.push(step.arg | 0); return; }
      const right = stack.pop();
      const left = stack.pop();

      stack.push(apply(step.op, left, right));
    });
    return stack.pop();
  }

  function apply(op, left, right) {
    if (op === STACK_OPS.add) return (left + right) | 0;
    if (op === STACK_OPS.sub) return (left - right) | 0;
    if (op === STACK_OPS.shiftLeft) return left << right;
    return right;
  }

  /* -------------------------------------------------- accumulator machine */

  const ACC_OPS = { load: 0, add: 1, sub: 2, shiftLeft: 3, loadConst: 4 };

  /** Two bytes per instruction: eight bits of opcode, eight of operand. One
   *  implied destination means every instruction names exactly one source. */
  function runAccumulator(program, locals) {
    let acc = 0;

    program.forEach(function (step) {
      if (step.op === ACC_OPS.load) { acc = locals[step.arg] | 0; return; }
      if (step.op === ACC_OPS.loadConst) { acc = step.arg | 0; return; }
      if (step.op === ACC_OPS.add) { acc = (acc + locals[step.arg]) | 0; return; }
      if (step.op === ACC_OPS.sub) { acc = (acc - locals[step.arg]) | 0; return; }
      acc = acc << step.arg;
    });
    return acc;
  }

  /* ----------------------------------------------------- register machine */

  const REG_OPS = { add: 0, sub: 1, shiftLeft: 2 };

  /** Four bytes per instruction, as BRV32 encodes them: three operands named
   *  explicitly, which is what costs the bits and buys the freedom. */
  function runRegister(program, locals) {
    const registers = locals.slice();

    program.forEach(function (step) {
      const left = registers[step.a] | 0;
      const right = step.immediate === undefined ? registers[step.b] | 0 : step.immediate;

      registers[step.rd] = applyRegister(step.op, left, right);
    });
    return registers[program[program.length - 1].rd] | 0;
  }

  function applyRegister(op, left, right) {
    if (op === REG_OPS.add) return (left + right) | 0;
    if (op === REG_OPS.sub) return (left - right) | 0;
    return left << right;
  }

  /* -------------------------------------------- the same expression, thrice */

  /** `(a + b) * 2 - c`, with the multiply written as a shift because none of
   *  these machines has a multiplier. */
  const PROGRAMS = {
    stack: { bytesPerInstruction: 1, run: runStack,
      about: 'operands are implied by the stack, so an instruction is an opcode',
      steps: [
        { op: STACK_OPS.pushLocal, arg: 0, text: 'push a' },
        { op: STACK_OPS.pushLocal, arg: 1, text: 'push b' },
        { op: STACK_OPS.add, text: 'add' },
        { op: STACK_OPS.pushConst, arg: 1, text: 'push 1' },
        { op: STACK_OPS.shiftLeft, text: 'shl' },
        { op: STACK_OPS.pushLocal, arg: 2, text: 'push c' },
        { op: STACK_OPS.sub, text: 'sub' }
      ] },
    accumulator: { bytesPerInstruction: 2, run: runAccumulator,
      about: 'one implied destination, so every instruction names one source',
      steps: [
        { op: ACC_OPS.load, arg: 0, text: 'load a' },
        { op: ACC_OPS.add, arg: 1, text: 'add b' },
        { op: ACC_OPS.shiftLeft, arg: 1, text: 'shl 1' },
        { op: ACC_OPS.sub, arg: 2, text: 'sub c' }
      ] },
    register: { bytesPerInstruction: 4, run: runRegister,
      about: 'three operands named explicitly, which is what the width buys',
      steps: [
        { op: REG_OPS.add, rd: 3, a: 0, b: 1, text: 'add t0, a, b' },
        { op: REG_OPS.shiftLeft, rd: 3, a: 3, immediate: 1, text: 'slli t0, t0, 1' },
        { op: REG_OPS.sub, rd: 3, a: 3, b: 2, text: 'sub t0, t0, c' }
      ] }
  };

  function measure(name, locals) {
    const model = PROGRAMS[name];

    return { name: name, about: model.about, instructions: model.steps.length,
      bytesPerInstruction: model.bytesPerInstruction,
      bytes: model.steps.length * model.bytesPerInstruction,
      result: model.run(model.steps, locals), steps: model.steps };
  }

  /** All three, on the same inputs — and the answers must agree, or the
   *  comparison is between three different computations. */
  function compare(locals) {
    const rows = Object.keys(PROGRAMS).map(function (name) { return measure(name, locals); });
    const answers = rows.map(function (row) { return row.result; });

    return { rows: rows, agree: answers.every(function (value) { return value === answers[0]; }),
      answer: answers[0] };
  }

  /* --------------------------------------------------------- field packing */

  /**
   * How many bits are left for an immediate once the opcode and the register
   * fields have been paid for. This is the whole of instruction-encoding
   * design in one calculation, and it is why a 16-bit instruction set has
   * eight registers rather than thirty-two.
   */
  function packing(options) {
    const settings = options || {};
    const width = settings.width || 16;
    const opcodeBits = Math.ceil(Math.log2(settings.opcodes || 32));
    const registerBits = Math.ceil(Math.log2(settings.registers || 8));
    const fields = settings.operands === undefined ? 2 : settings.operands;
    const left = width - opcodeBits - registerBits * fields;

    return { width: width, opcodeBits: opcodeBits, registerBits: registerBits,
      operands: fields, immediateBits: left,
      range: left > 0 ? { low: -Math.pow(2, left - 1), high: Math.pow(2, left - 1) - 1 }
        : { low: 0, high: 0 },
      encodable: left >= 0 };
  }

  return { PROGRAMS: PROGRAMS, STACK_OPS: STACK_OPS, ACC_OPS: ACC_OPS, REG_OPS: REG_OPS,
    measure: measure, compare: compare, packing: packing, runStack: runStack,
    runAccumulator: runAccumulator, runRegister: runRegister };
}));

/**
 * Brv32Programs - the sample programs, as source.
 *
 * They live in a module rather than inside a section for the usual reason:
 * every number the prose quotes about them — instructions retired, the value
 * left in a register, how deep the stack got — is recomputed by a test from
 * this exact source, so a program that changes takes its figures with it.
 *
 * They are also written the way a person would write them, following the
 * calling convention exactly, because the recursion example is only worth
 * anything if it really does save the return address and really does restore
 * the stack pointer.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) {
    scope.Brv32 = scope.Brv32 || {};
    scope.Brv32.Programs = api;
  }
}(this, function () {
  'use strict';

  const SUM = [
    '  # sum 1 to n, the simplest loop there is',
    '  li a0, 10',
    '  li a1, 0',
    'loop:',
    '  beqz a0, done',
    '  add a1, a1, a0',
    '  addi a0, a0, -1',
    '  j loop',
    'done:',
    '  ecall'
  ].join('\n');

  const FACTORIAL = [
    '  # 5! by recursion, following the calling convention exactly',
    '  li sp, 0x10000f00',
    '  li a0, 5',
    '  jal ra, factorial',
    '  j finish',
    'factorial:',
    '  addi sp, sp, -8          # make a frame',
    '  sw ra, 4(sp)             # save the return address',
    '  sw a0, 0(sp)             # and our argument',
    '  li t0, 2',
    '  blt a0, t0, base',
    '  addi a0, a0, -1',
    '  jal ra, factorial        # recurse',
    '  lw t1, 0(sp)             # our argument, still there',
    '  jal ra, multiply',
    '  j return',
    'base:',
    '  li a0, 1',
    'return:',
    '  lw ra, 4(sp)             # restore what we saved',
    '  addi sp, sp, 8           # and the stack pointer',
    '  ret',
    'multiply:',
    '  # a0 = a0 * t1, by repeated addition — BRV32I has no multiplier',
    '  mv t2, a0',
    '  li a0, 0',
    '  beqz t1, mdone',
    'mloop:',
    '  add a0, a0, t2',
    '  addi t1, t1, -1',
    '  bnez t1, mloop',
    'mdone:',
    '  ret',
    'finish:',
    '  ecall'
  ].join('\n');

  const ARRAY_MAX = [
    '  # the largest signed value in an array',
    '  la a0, data',
    '  li a1, 6',
    '  lw a2, 0(a0)             # first element is the running maximum',
    '  li t0, 1',
    'scan:',
    '  bge t0, a1, mdone',
    '  slli t1, t0, 2',
    '  add t1, t1, a0',
    '  lw t2, 0(t1)',
    '  bge a2, t2, next',
    '  mv a2, t2',
    'next:',
    '  addi t0, t0, 1',
    '  j scan',
    'mdone:',
    '  ecall',
    'data:',
    '  .word 12, -4, 37, 5, 37, 1'
  ].join('\n');

  const STRING_LENGTH = [
    '  # strlen, one byte at a time',
    '  la a0, text',
    '  li a1, 0',
    'next:',
    '  add t0, a0, a1',
    '  lbu t1, 0(t0)',
    '  beqz t1, done',
    '  addi a1, a1, 1',
    '  j next',
    'done:',
    '  ecall',
    'text:',
    '  .string "hello"'
  ].join('\n');

  const CONSOLE = [
    '  # memory-mapped output: the device is an address',
    '  la a0, text',
    '  li a1, 0x20000000        # the console data register',
    'next:',
    '  lbu t0, 0(a0)',
    '  beqz t0, done',
    '  sb t0, 0(a1)             # this store is the output',
    '  addi a0, a0, 1',
    '  j next',
    'done:',
    '  ecall',
    'text:',
    '  .string "hi there"'
  ].join('\n');

  const FAULTS = {
    ecall: '  li a0, 1\n  ecall',
    illegal: '  li a0, 1\n  .word 0xffffffff',
    misalignedLoad: '  li a0, 0x10000001\n  lw a1, 0(a0)',
    misalignedStore: '  li a0, 0x10000002\n  sw a1, 0(a0)',
    unmapped: '  li a0, 0x40000000\n  lw a1, 0(a0)'
  };

  /** A handler that records the cause and returns, so a trap can be watched
   *  rather than merely reported. It is loaded at the trap vector. */
  const HANDLER = [
    'handler:',
    '  csrrs t0, 0x342, x0      # read mcause',
    '  csrrs t1, 0x341, x0      # and mepc',
    '  addi t1, t1, 4           # skip the instruction that trapped',
    '  csrrw x0, 0x341, t1',
    '  mret'
  ].join('\n');

  /**
   * The same handler, told which kind of trap it is looking at.
   *
   * The sign bit of mcause is set for an interrupt and clear for an exception,
   * and the two need opposite return addresses: an exception has already
   * happened, so the handler resumes AFTER the instruction; an interrupt
   * arrived between instructions, so the handler must resume AT the one it
   * interrupted, or that instruction never runs at all. The simpler handler
   * above skips unconditionally, which quietly deletes one instruction per
   * interrupt - a defect the demo shows rather than describes.
   */
  const INTERRUPT_HANDLER = [
    'handler:',
    '  csrrs t0, 0x342, x0      # read mcause',
    '  blt t0, x0, async        # the sign bit means an interrupt',
    '  csrrs t1, 0x341, x0      # an exception: resume after it',
    '  addi t1, t1, 4',
    '  csrrw x0, 0x341, t1',
    '  mret',
    'async:',
    '  li t2, 0x20001000        # acknowledge the timer by re-arming it',
    '  sw x0, 4(t2)',
    '  mret                     # and resume AT the interrupted instruction'
  ].join('\n');

  const CATALOGUE = {
    sum: { source: SUM, about: 'a counted loop', result: 11, expect: 55 },
    factorial: { source: FACTORIAL, about: 'recursion with a real stack frame',
      result: 10, expect: 120 },
    arrayMax: { source: ARRAY_MAX, about: 'an array walk with a comparison',
      result: 12, expect: 37 },
    strlen: { source: STRING_LENGTH, about: 'byte loads and a sentinel', result: 11,
      expect: 5 },
    console: { source: CONSOLE, about: 'memory-mapped output', output: 'hi there' }
  };

  return { CATALOGUE: CATALOGUE, FAULTS: FAULTS, HANDLER: HANDLER,
    INTERRUPT_HANDLER: INTERRUPT_HANDLER,
    SUM: SUM, FACTORIAL: FACTORIAL, ARRAY_MAX: ARRAY_MAX, STRING_LENGTH: STRING_LENGTH,
    CONSOLE: CONSOLE };
}));

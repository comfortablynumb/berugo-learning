/**
 * Brv32Compare - one function, three instruction sets, counted.
 *
 * The listings below are reference assembly, written by hand and checked
 * against the published encoding rules of each architecture rather than
 * produced by a compiler in the browser - there is no x86 assembler in this
 * project and pretending otherwise would be worse than saying so. Every row
 * carries the length its encoding actually has, and the length of a fixed
 * width instruction set is 4 by definition, so the only rows a reader has to
 * take on trust are the x86-64 ones, which are listed byte by byte so they can
 * be checked one at a time against the manual.
 *
 * The function is the same in all three: sum an array of 32-bit integers.
 *
 *     int sum(int *a, int n) {
 *       int s = 0;
 *       for (int i = 0; i < n; i++) s += a[i];
 *       return s;
 *     }
 *
 * What comes out of the counting is more interesting than the usual slogans.
 * All three take the same number of instructions. ARM64's post-increment load
 * saves one instruction in the loop and its condition codes cost one back, so
 * it ties with RISC-V exactly. x86-64 ties on instruction count and wins on
 * size by a factor of 1.7, entirely through variable-length encoding.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) {
    scope.Brv32 = scope.Brv32 || {};
    scope.Brv32.Compare = api;
  }
}(this, function () {
  'use strict';

  const RISCV = {
    id: 'riscv',
    name: 'RISC-V (RV32I)',
    width: 'fixed, 4 bytes',
    registers: 32,
    conditionCodes: false,
    addressing: 'register + 12-bit offset, only',
    listing: [
      { text: 'li a2, 0', bytes: 4, loop: false, about: 'the running total, from x0' },
      { text: 'blez a1, .done', bytes: 4, loop: false, about: 'compare and branch in one' },
      { text: 'slli a3, a1, 2', bytes: 4, loop: false, about: 'n times 4: no scaled index exists' },
      { text: 'add a3, a0, a3', bytes: 4, loop: false, about: 'the end pointer, computed explicitly' },
      { text: '.loop: lw a4, 0(a0)', bytes: 4, loop: true, about: 'the only addressing mode there is' },
      { text: 'addi a0, a0, 4', bytes: 4, loop: true, about: 'the increment the load could not fold' },
      { text: 'add a2, a2, a4', bytes: 4, loop: true, about: 'accumulate' },
      { text: 'bne a0, a3, .loop', bytes: 4, loop: true, about: 'compare and branch again — no flags' },
      { text: '.done: mv a0, a2', bytes: 4, loop: false, about: 'addi a0, a2, 0 underneath' },
      { text: 'ret', bytes: 4, loop: false, about: 'jalr x0, ra, 0' }
    ],
    evidence: [
      'Every instruction is exactly 4 bytes and every address is a multiple of 4.',
      'A compare and a branch are one instruction: there is no flags register to set.',
      'An array index is a shift and an add before the load, because there is one addressing mode.',
      'Register names a0-a7, s0-s11, t0-t6 — and x0, which appears wherever a zero is wanted.'
    ]
  };

  const ARM64 = {
    id: 'arm64',
    name: 'ARM64 (AArch64)',
    width: 'fixed, 4 bytes',
    registers: 31,
    conditionCodes: true,
    addressing: 'base + offset, pre/post-increment, extended register with shift',
    listing: [
      { text: 'mov w2, wzr', bytes: 4, loop: false, about: 'a zero register here too' },
      { text: 'cmp w1, #0', bytes: 4, loop: false, about: 'sets the flags; decides nothing yet' },
      { text: 'b.le .done', bytes: 4, loop: false, about: 'and this reads them' },
      { text: 'add x3, x0, w1, sxtw #2', bytes: 4, loop: false,
        about: 'sign-extend, scale by 4 and add, in one instruction' },
      { text: '.loop: ldr w4, [x0], #4', bytes: 4, loop: true,
        about: 'post-increment: the pointer advance is free' },
      { text: 'add w2, w2, w4', bytes: 4, loop: true, about: 'accumulate' },
      { text: 'cmp x0, x3', bytes: 4, loop: true, about: 'the flags again' },
      { text: 'b.ne .loop', bytes: 4, loop: true, about: 'and the branch that reads them' },
      { text: '.done: mov w0, w2', bytes: 4, loop: false, about: 'the return value' },
      { text: 'ret', bytes: 4, loop: false, about: 'br x30' }
    ],
    evidence: [
      'Every instruction is 4 bytes, like RISC-V — the fixed width is not the distinguishing feature.',
      'Compare and branch are separate instructions, because there is a flags register between them.',
      'w and x prefixes on the same register number: w0 is the low 32 bits of x0.',
      'Addressing modes do arithmetic: post-increment, and sign-extend-and-scale in the address.'
    ]
  };

  const X86 = {
    id: 'x86',
    name: 'x86-64',
    width: 'variable, 1 to 15 bytes',
    registers: 16,
    conditionCodes: true,
    addressing: 'base + index*scale + displacement, on almost any instruction',
    listing: [
      { text: 'xor eax, eax', bytes: 2, encoding: '31 c0', loop: false,
        about: 'the idiomatic zero, and it is 2 bytes' },
      { text: 'test esi, esi', bytes: 2, encoding: '85 f6', loop: false, about: 'sets the flags' },
      { text: 'jle .done', bytes: 2, encoding: '7e xx', loop: false, about: 'an 8-bit displacement' },
      { text: 'movsxd rdx, esi', bytes: 3, encoding: '48 63 d6', loop: false,
        about: 'the REX prefix is the third byte of the story' },
      { text: 'xor ecx, ecx', bytes: 2, encoding: '31 c9', loop: false, about: 'the index' },
      { text: '.loop: add eax, [rdi+rcx*4]', bytes: 3, encoding: '03 04 8f', loop: true,
        about: 'a load and an add, with the index scaled, in 3 bytes' },
      { text: 'inc rcx', bytes: 3, encoding: '48 ff c1', loop: true, about: 'REX again' },
      { text: 'cmp rcx, rdx', bytes: 3, encoding: '48 39 d1', loop: true, about: 'the flags' },
      { text: 'jne .loop', bytes: 2, encoding: '75 xx', loop: true, about: 'and the branch' },
      { text: '.done: ret', bytes: 1, encoding: 'c3', loop: false, about: 'one byte' }
    ],
    evidence: [
      'Instruction lengths differ: 1, 2 and 3 bytes in the same ten instructions.',
      'A memory operand appears inside an arithmetic instruction, not only in a load.',
      'The index is scaled by 4 in the addressing mode — no separate shift instruction.',
      'Two-operand form: the destination is also a source, which is why the zero is an xor.'
    ]
  };

  const SETS = [RISCV, ARM64, X86];
  const BY_ID = {};

  SETS.forEach(function (row) { BY_ID[row.id] = row; });

  /** Counted from the listing rather than stated, so a row added to a listing
   *  cannot leave a total behind disagreeing with it. */
  function measure(id) {
    const set = BY_ID[id];
    const loop = set.listing.filter(function (row) { return row.loop; });

    return { id: id, name: set.name,
      instructions: set.listing.length,
      bytes: set.listing.reduce(function (sum, row) { return sum + row.bytes; }, 0),
      loopInstructions: loop.length,
      loopBytes: loop.reduce(function (sum, row) { return sum + row.bytes; }, 0),
      widths: distinctWidths(set) };
  }

  function distinctWidths(set) {
    const seen = {};

    set.listing.forEach(function (row) { seen[row.bytes] = true; });
    return Object.keys(seen).map(Number).sort(function (a, b) { return a - b; });
  }

  function all() {
    return SETS.map(function (set) { return measure(set.id); });
  }

  /** Density relative to the largest, which is the comparison people mean when
   *  they say "denser" and rarely state. */
  function density() {
    const rows = all();
    const largest = rows.reduce(function (best, row) {
      return row.bytes > best ? row.bytes : best;
    }, 0);

    return rows.map(function (row) {
      return { id: row.id, name: row.name, bytes: row.bytes,
        ratio: largest / row.bytes };
    });
  }

  /** The comparison table: one row per property, three columns of answers. */
  const PROPERTIES = [
    { name: 'encoding width', of: function (set) { return set.width; },
      why: 'fixed width buys trivial decode; variable width buys density' },
    { name: 'architectural registers', of: function (set) { return String(set.registers); },
      why: 'more registers means fewer spills and more bits per instruction' },
    { name: 'condition codes', of: function (set) { return set.conditionCodes ? 'yes' : 'no'; },
      why: 'a hidden dependency between instructions that look independent' },
    { name: 'addressing modes', of: function (set) { return set.addressing; },
      why: 'folded address arithmetic is denser and is a special case forever' }
  ];

  function properties() {
    return PROPERTIES.map(function (row) {
      return { name: row.name, why: row.why,
        values: SETS.map(function (set) { return { id: set.id, value: row.of(set) }; }) };
    });
  }

  return { SETS: SETS, BY_ID: BY_ID, PROPERTIES: PROPERTIES,
    measure: measure, all: all, density: density, properties: properties };
}));

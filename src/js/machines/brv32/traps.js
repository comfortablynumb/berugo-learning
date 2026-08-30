/**
 * Brv32Traps - control registers, exception entry and exit, privilege.
 *
 * A trap is the only way control leaves a program without the program asking,
 * and the mechanism is small enough to state completely: save the address of
 * the offending instruction, record why, switch privilege, jump to a fixed
 * handler address. `mret` undoes exactly those four things. Everything the
 * operating-system track builds later — system calls, preemption, memory
 * protection — is this mechanism with policy on top.
 *
 * Precision is the property worth naming. When the handler runs, every
 * instruction before the trapping one must have completed and none after it
 * may have had any effect. On a single-cycle machine that is free, which is
 * exactly why it is worth saying out loud here: the moment M35 pipelines this
 * datapath, keeping the promise costs real hardware.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) {
    scope.Brv32 = scope.Brv32 || {};
    scope.Brv32.Traps = api;
  }
}(this, function () {
  'use strict';

  /** The control and status registers this machine implements, by number —
   *  the same numbers the RISC-V privileged specification assigns. */
  const CSR = { mstatus: 0x300, mtvec: 0x305, mepc: 0x341, mcause: 0x342, mtval: 0x343,
    mie: 0x304, mip: 0x344 };

  const CSR_NAMES = {};

  Object.keys(CSR).forEach(function (name) { CSR_NAMES[CSR[name]] = name; });

  const CAUSES = {
    0: 'instruction address misaligned',
    2: 'illegal instruction',
    3: 'breakpoint',
    4: 'load address misaligned',
    5: 'load access fault',
    6: 'store address misaligned',
    7: 'store access fault',
    11: 'environment call'
  };

  const INTERRUPT_TIMER = 7;
  const MODE = { user: 0, machine: 3 };

  function create(options) {
    const settings = options || {};
    const csrs = {};

    Object.keys(CSR).forEach(function (name) { csrs[CSR[name]] = 0; });
    csrs[CSR.mtvec] = settings.handler === undefined ? 0x100 : settings.handler;
    return { csrs: csrs, mode: MODE.machine, taken: [], depth: 0 };
  }

  function read(state, number) {
    const value = state.csrs[number];

    return value === undefined ? 0 : value | 0;
  }

  function writeCsr(state, number, value) {
    if (state.csrs[number] === undefined) return false;
    state.csrs[number] = value | 0;
    return true;
  }

  /**
   * Enter a trap. `pc` is the address of the instruction that trapped — not
   * the one after it — because the handler may need to restart it, and an
   * off-by-four here is the classic way to make a page fault handler loop
   * forever on the wrong instruction.
   */
  function enter(state, trap, pc) {
    const cause = trap.interrupt ? (0x80000000 | trap.cause) : trap.cause;

    state.csrs[CSR.mepc] = pc | 0;
    state.csrs[CSR.mcause] = cause | 0;
    state.csrs[CSR.mtval] = trap.value === undefined ? 0 : trap.value | 0;
    state.csrs[CSR.mstatus] = (state.csrs[CSR.mstatus] & ~0x8) | (state.mode << 11);
    state.previousMode = state.mode;
    state.mode = MODE.machine;
    state.depth += 1;
    state.taken.push({ cause: cause, pc: pc >>> 0, name: nameOf(trap),
      interrupt: Boolean(trap.interrupt) });
    return state.csrs[CSR.mtvec] >>> 0;
  }

  function nameOf(trap) {
    if (trap.name) return trap.name;
    if (trap.interrupt) return 'timer interrupt';
    return CAUSES[trap.cause] || ('cause ' + trap.cause);
  }

  /** Leave the handler: restore the privilege the trap interrupted and resume
   *  at the saved address. */
  function exit(state) {
    state.mode = state.previousMode === undefined ? MODE.machine : state.previousMode;
    state.depth = Math.max(0, state.depth - 1);
    return state.csrs[CSR.mepc] >>> 0;
  }

  /** An interrupt is only taken between instructions, and only when it is
   *  enabled — which is what makes "disable interrupts" a usable primitive. */
  function pendingInterrupt(state, devices) {
    if (!devices.timer.pending) return null;
    if (!(state.csrs[CSR.mie] & (1 << INTERRUPT_TIMER))) return null;
    if (state.depth > 0) return null;
    return { cause: INTERRUPT_TIMER, interrupt: true, value: 0, name: 'timer interrupt' };
  }

  function describe(state) {
    return Object.keys(CSR).map(function (name) {
      return { name: name, number: CSR[name], value: state.csrs[CSR[name]] | 0 };
    });
  }

  return { CSR: CSR, CSR_NAMES: CSR_NAMES, CAUSES: CAUSES, MODE: MODE,
    INTERRUPT_TIMER: INTERRUPT_TIMER, create: create, read: read, write: writeCsr,
    enter: enter, exit: exit, pendingInterrupt: pendingInterrupt, describe: describe,
    nameOf: nameOf };
}));

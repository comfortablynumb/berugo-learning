/**
 * Brv32Hazards - detection, stalling and forwarding, as pure functions.
 *
 * These are separated from the pipeline itself because they are the part worth
 * testing exhaustively and the part a learner is asked to implement. Each one
 * takes the pipeline latches as plain data and returns a decision; none of
 * them mutates anything.
 *
 * The rule that matters most is in `forwardFor`: when two instructions ahead
 * of you both write the register you are reading, the value you want is the
 * MOST RECENT one - the instruction in EX/MEM, not the one in MEM/WB. Getting
 * that backwards produces a machine that works on almost every program, since
 * it needs two back-to-back writes to the same register to go wrong. That is
 * rare in hand-written tests and common in compiler output, which is exactly
 * the shape of bug this module exists to make testable.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) {
    scope.Brv32 = scope.Brv32 || {};
    scope.Brv32.Hazards = api;
  }
}(this, function () {
  'use strict';

  /** Where an operand came from. The names are the ones the demo prints. */
  const SOURCE = { file: 'register file', ex: 'EX/MEM forward', mem: 'MEM/WB forward',
    zero: 'x0', immediate: 'immediate' };

  /** An instruction writes a register if it has a destination and that
   *  destination is not x0 - the register file has no write enable for row
   *  zero, so forwarding from it would be forwarding a value nobody stored. */
  function writesRegister(entry) {
    if (!entry || !entry.decoded || !entry.decoded.ok) return false;
    const row = entry.decoded.row;

    if (row.format === 'S' || row.format === 'B') return false;
    if (row.fixed !== undefined) return false;
    return entry.decoded.rd !== 0;
  }

  function isLoad(entry) {
    return Boolean(entry && entry.decoded && entry.decoded.ok &&
      entry.decoded.row.opcode === 0x03);
  }

  function readsRegisters(entry) {
    if (!entry || !entry.decoded || !entry.decoded.ok) return { rs1: false, rs2: false };
    const format = entry.decoded.row.format;

    return {
      rs1: format !== 'U' && format !== 'J',
      rs2: format === 'R' || format === 'S' || format === 'B'
    };
  }

  /**
   * Which value the execute stage should use for one source register.
   *
   * `exMem` is the instruction one ahead; `memWb` is two ahead. Both are
   * checked, and exMem wins, because it is the more recent producer. A load in
   * exMem has no value yet - that is the load-use hazard, and it is the
   * detection unit's job rather than this one's.
   */
  function forwardFor(register, latches, options) {
    const settings = options || {};

    if (register === 0) return { source: SOURCE.zero, value: 0 };
    if (settings.forwarding === false) return { source: SOURCE.file, value: null };
    const order = settings.naiveForwarding ? ['memWb', 'exMem'] : ['exMem', 'memWb'];

    for (let at = 0; at < order.length; at += 1) {
      const found = tryLatch(order[at], register, latches);

      if (found) return found;
    }
    return { source: SOURCE.file, value: null };
  }

  /** One candidate producer. A load in the memory stage has no value yet, so
   *  it is not a forwarding source - it is a stall, and the detection unit
   *  will already have arranged one. */
  function tryLatch(which, register, latches) {
    const entry = latches[which];

    if (!writesRegister(entry) || entry.decoded.rd !== register) return null;
    if (which === 'exMem' && isLoad(entry)) return null;
    return { source: which === 'exMem' ? SOURCE.ex : SOURCE.mem, value: entry.value | 0 };
  }

  /**
   * Does the instruction in decode have to wait?
   *
   * The latch names are the pipeline's, so the instruction one ahead of the
   * one in decode is in EXECUTE - `latches.idEx` - and the one two ahead is in
   * memory. Getting that mapping off by one is the first bug anybody writes
   * here, and it hides completely behind forwarding: the machine still
   * computes the right answers and simply never stalls.
   *
   * With forwarding, only one case remains: the instruction directly ahead is
   * a load writing a register this one reads, and the loaded word does not
   * exist until the end of the memory stage. One bubble is enough, and no
   * amount of wiring removes it - which is why compilers schedule an unrelated
   * instruction into that slot instead.
   *
   * Without forwarding, a producer in execute costs two stalls and one in
   * memory costs one, because the value is only readable once it has been
   * written back.
   */
  function stallFor(inDecode, latches, options) {
    const settings = options || {};

    if (!inDecode || !inDecode.decoded || !inDecode.decoded.ok) return null;
    const reads = readsRegisters(inDecode);
    const sources = [];

    if (reads.rs1) sources.push(inDecode.decoded.rs1);
    if (reads.rs2) sources.push(inDecode.decoded.rs2);

    for (let at = 0; at < sources.length; at += 1) {
      const found = producerFor(sources[at], latches, settings);

      if (found) return found;
    }
    return null;
  }

  function producerFor(register, latches, settings) {
    if (register === 0) return null;
    if (writesRegister(latches.idEx) && latches.idEx.decoded.rd === register) {
      if (settings.forwarding === false) {
        return { reason: 'no forwarding: waiting for ' + name(register) +
          ' from the instruction ahead', register: register, distance: 1 };
      }
      if (isLoad(latches.idEx)) {
        return { reason: 'load-use: ' + name(register) +
          ' is not loaded until the memory stage', register: register, distance: 1,
          loadUse: true };
      }
    }
    if (settings.forwarding === false && writesRegister(latches.exMem) &&
      latches.exMem.decoded.rd === register) {
      return { reason: 'no forwarding: waiting for ' + name(register) +
        ' from two instructions ahead', register: register, distance: 2 };
    }
    return null;
  }

  const NAMES = ['zero', 'ra', 'sp', 'gp', 'tp', 't0', 't1', 't2', 's0', 's1',
    'a0', 'a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 's2', 's3', 's4', 's5', 's6', 's7',
    's8', 's9', 's10', 's11', 't3', 't4', 't5', 't6'];

  function name(register) {
    return NAMES[register] || ('x' + register);
  }

  /**
   * A structural hazard: one memory, two stages that want it.
   *
   * With a unified memory the fetch stage cannot read an instruction in a
   * cycle when the memory stage is performing a data access, so the fetch
   * waits. Splitting the memory into an instruction port and a data port makes
   * the conflict disappear and costs a second memory - which is the whole
   * trade, and it is why every real machine has split first-level caches over
   * a unified memory below them.
   */
  function structuralStall(exMem, options) {
    const settings = options || {};

    if (settings.unifiedMemory !== true) return null;
    if (!exMem || !exMem.decoded || !exMem.decoded.ok) return null;
    const row = exMem.decoded.row;
    const accesses = row.opcode === 0x03 || row.format === 'S';

    if (!accesses) return null;
    return { reason: 'structural: the memory stage is using the only memory port',
      stage: 'IF' };
  }

  return { SOURCE: SOURCE, forwardFor: forwardFor, stallFor: stallFor,
    structuralStall: structuralStall, writesRegister: writesRegister, isLoad: isLoad,
    readsRegisters: readsRegisters, name: name };
}));

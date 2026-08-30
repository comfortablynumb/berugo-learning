/**
 * OooRename - the alias table, the physical register file and the free list.
 *
 * Renaming is the idea the whole milestone turns on, and it is smaller than it
 * sounds: the thirty-two register names an instruction set defines are a naming
 * convention, and the hardware keeps a much larger set of physical registers
 * underneath with a table saying which physical register each name currently
 * means. Writing a register does not overwrite anything - it allocates a new
 * physical register and repoints the name.
 *
 * That one change removes two of the three dependence kinds outright. A
 * write-after-read hazard is two instructions arguing over a name, and once
 * they have different physical registers there is nothing to argue about; a
 * write-after-write hazard is the same. Only read-after-write survives, because
 * it is a dependence on a value rather than on a name.
 *
 * The same trick appears twice more in this curriculum. SSA form in M29 gives
 * every assignment its own name for exactly this reason, and multi-version
 * concurrency control in M53 keeps old versions of a row so readers and writers
 * stop contending. Three fields, one idea.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) {
    scope.Ooo = scope.Ooo || {};
    scope.Ooo.Rename = api;
  }
}(this, function () {
  'use strict';

  const ARCH = 32;

  /**
   * The initial state maps every architectural register to a physical one and
   * marks them ready. Registers 0 to 31 are permanently allocated for that
   * mapping; everything above is free.
   */
  function create(options) {
    const settings = options || {};
    const physical = settings.physical || 64;
    const values = new Array(physical).fill(0);
    const ready = new Array(physical).fill(true);
    const table = [];
    const free = [];

    for (let at = 0; at < ARCH; at += 1) table.push(at);
    for (let at = ARCH; at < physical; at += 1) free.push(at);
    (settings.registers || []).forEach(function (value, at) {
      if (at > 0 && at < ARCH) values[at] = value | 0;
    });
    return { table: table, values: values, ready: ready, free: free,
      physical: physical, checkpoints: [], counters: { allocated: 0, freed: 0, stalls: 0 } };
  }

  /** What a source operand currently means. x0 is special: it is a name that
   *  never changes and always reads zero, so it needs no rename at all. */
  function lookup(state, arch) {
    if (arch === 0) return { phys: 0, ready: true, value: 0 };
    const phys = state.table[arch];

    return { phys: phys, ready: state.ready[phys], value: state.values[phys] | 0 };
  }

  function canAllocate(state) {
    return state.free.length > 0;
  }

  /**
   * Rename a destination: take a free physical register, point the name at it
   * and remember which physical register the name used to mean, because commit
   * has to give that one back and a squash has to put it back.
   */
  function allocate(state, arch) {
    if (arch === 0) return { phys: 0, old: 0, renamed: false };
    if (!canAllocate(state)) { state.counters.stalls += 1; return null; }
    const phys = state.free.shift();
    const old = state.table[arch];

    state.table[arch] = phys;
    state.ready[phys] = false;
    state.values[phys] = 0;
    state.counters.allocated += 1;
    return { phys: phys, old: old, renamed: true };
  }

  /** A result arrives: write it and wake everything waiting on the tag. */
  function write(state, phys, value) {
    if (phys === 0) return;
    state.values[phys] = value | 0;
    state.ready[phys] = true;
  }

  /**
   * Commit frees the register the name used to mean, because nothing can reach
   * it any more - every instruction that could read it has retired.
   *
   * The register has to be added to every outstanding checkpoint as well, and
   * that is not an optimisation. A checkpoint holds the free list as it was at
   * a branch; commits that happen while the branch is still in flight free
   * registers the checkpoint knew nothing about, and restoring the snapshot
   * wholesale throws those away. The leak is silent and slow: the machine runs
   * correctly for a while, runs out of physical registers, and then stalls at
   * dispatch forever with an empty pipeline.
   *
   * The registers holding the INITIAL architectural mapping come back to the
   * pool too, and refusing them was a second leak of the same kind with a
   * louder symptom. Physical registers 1 to 31 are ordinary members of the
   * file that happen to start out mapped; once an instruction overwrites the
   * name one of them held, it is as dead as any other superseded register.
   * Keeping them out of the free list burns thirty-one entries permanently,
   * which is invisible on a large file and deadlocks a small one - a machine
   * with 34 physical registers could rename exactly twice and then hang.
   *
   * Physical register 0 is the exception and stays reserved. It is the one x0
   * means, reads of it short-circuit to zero and writes to it are dropped, so
   * an instruction that was allocated it would wait forever for a value that
   * is never written.
   *
   * Nothing live can be freed here, which is worth stating because it is not
   * obvious. Every instruction that could still read the old register was
   * renamed before the instruction overwriting it, so in-order commit means
   * they have all retired; and every checkpoint was taken by a branch younger
   * than the committing instruction, so no checkpoint's table names it either.
   */
  function release(state, old) {
    if (!old) return;
    state.free.push(old);
    state.checkpoints.forEach(function (saved) { saved.free.push(old); });
    state.counters.freed += 1;
  }

  /**
   * A checkpoint of the alias table, taken at a branch so recovery is a copy
   * rather than an unwind.
   *
   * The alternative - walking the reorder buffer backwards undoing renames one
   * at a time - is correct and slow, and the difference between them is most of
   * the misprediction penalty on a modern machine. That is why real designs
   * checkpoint at branches and why the number of checkpoints is a published
   * microarchitectural parameter.
   */
  function checkpoint(state, id) {
    const saved = { id: id, table: state.table.slice(), free: state.free.slice() };

    state.checkpoints.push(saved);
    return saved;
  }

  function restore(state, id) {
    for (let at = state.checkpoints.length - 1; at >= 0; at -= 1) {
      if (state.checkpoints[at].id !== id) continue;
      const saved = state.checkpoints[at];

      state.table = saved.table.slice();
      state.free = saved.free.slice();
      state.checkpoints.length = at;
      return true;
    }
    return false;
  }

  /**
   * Recovery the slow way: walk the squashed instructions youngest first and
   * undo each rename by hand.
   *
   * This is the mechanism a checkpoint exists to avoid, and it is not
   * redundant - a checkpoint only exists where one was taken, and they are
   * taken at branches. A memory misspeculation and an exception can land
   * anywhere, so the machine needs a way to recover from a point nobody
   * predicted, and unwinding is it. The cost is the difference: a restore is
   * one copy however deep the window, and an unwind is one step per squashed
   * instruction. That is the whole of "checkpoint restore versus drain".
   *
   * The freed registers go on the live free list only, never onto a
   * checkpoint's. A checkpoint was taken before these registers were
   * allocated, so its snapshot already lists them as free; adding them again
   * would hand the same register out twice after a later restore.
   */
  function unwind(state, rolled) {
    rolled.forEach(function (entry) {
      if (entry.arch === undefined || entry.arch === 0) return;
      state.table[entry.arch] = entry.old;
      if (entry.phys) state.free.push(entry.phys);
      state.counters.freed += 1;
    });
  }

  function drop(state, id) {
    state.checkpoints = state.checkpoints.filter(function (saved) {
      return saved.id !== id;
    });
  }

  /** The architectural state, which is what the alias table means: the value
   *  each name currently has. */
  function architectural(state) {
    const out = new Array(ARCH).fill(0);

    for (let at = 1; at < ARCH; at += 1) out[at] = state.values[state.table[at]] | 0;
    return out;
  }

  function summary(state) {
    return { physical: state.physical, free: state.free.length,
      inFlight: state.physical - ARCH - state.free.length,
      allocated: state.counters.allocated, freed: state.counters.freed,
      stalls: state.counters.stalls, checkpoints: state.checkpoints.length };
  }

  return { ARCH: ARCH, create: create, lookup: lookup, allocate: allocate,
    canAllocate: canAllocate, write: write, release: release, checkpoint: checkpoint,
    restore: restore, unwind: unwind, drop: drop, architectural: architectural,
    summary: summary };
}));

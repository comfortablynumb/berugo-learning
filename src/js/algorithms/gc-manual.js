/**
 * Manual memory management, and the four bugs it makes possible.
 *
 * Before any collector, the baseline: the program says when memory is freed.
 * That is the fastest possible arrangement and the reason C is still written,
 * and it admits exactly four failures, which this module reproduces rather
 * than describes.
 *
 * - **leak** — freed never, so the heap grows without bound;
 * - **double free** — freed twice, which corrupts the allocator's own
 *   bookkeeping long before it corrupts anything the program can see;
 * - **use after free** — read or written after being freed, returning
 *   whatever the allocator has since put there;
 * - **dangling pointer** — the reference that makes the previous two
 *   possible, still held after the object it names is gone.
 *
 * The detector is the standard one: do not reuse an address immediately. A
 * freed block goes into a QUARANTINE queue and its bytes are overwritten with
 * a POISON pattern, so a later read sees the pattern rather than plausible
 * data and the allocator can say which block, freed when, was touched. That
 * is what ASan does, and the cost — memory held that could have been reused —
 * is why it is a debugging build rather than the default one.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.GcManual = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  /** A value no program would compute, so seeing it is a diagnosis. */
  const POISON = 0xdeadbeef;

  const FAULTS = [
    { id: 'leak', name: 'leak',
      about: 'never freed; the heap grows until the process dies' },
    { id: 'double-free', name: 'double free',
      about: 'freed twice; the free list ends up containing one block twice' },
    { id: 'use-after-free', name: 'use after free',
      about: 'read after being freed; returns whatever now lives there' },
    { id: 'dangling', name: 'dangling pointer',
      about: 'a reference outliving its object, which is how the other two happen' }
  ];

  function create(options) {
    const settings = options || {};

    return { quarantine: settings.quarantine === undefined ? 4 : settings.quarantine,
      poison: settings.poison !== false,
      blocks: new Map(), pending: [], available: [], next: 1,
      allocated: 0, freed: 0, live: 0, peak: 0,
      faults: [], silent: [], reads: 0, writes: 0, reuses: 0 };
  }

  /* ------------------------------------------------------- the allocator */

  /**
   * A handle is an address AND a generation, because an address alone cannot
   * tell a live block from the one that used to be there. The program only
   * ever sees the address; the generation is the oracle this file checks the
   * detector against, and the gap between the two is the subject.
   */
  function allocate(state, size, site) {
    const recycled = claim(state, size);
    const address = recycled === null ? state.next : recycled.address;
    const generation = recycled === null ? 1 : recycled.generation + 1;

    if (recycled === null) state.next += size;
    if (recycled !== null) state.reuses += 1;
    state.blocks.set(address, { address: address, size: size, site: site || 'anonymous',
      status: 'live', bytes: new Array(size).fill(0), freedAt: 0,
      generation: generation });
    state.allocated += size;
    state.live += size;
    state.peak = Math.max(state.peak, state.live);
    return { address: address, generation: generation };
  }

  /** Reuse the oldest retired block that is big enough, first fit. */
  function claim(state, size) {
    const at = state.available.findIndex(function (row) { return row.size >= size; });

    if (at === -1) return null;
    return state.available.splice(at, 1)[0];
  }

  /**
   * Free with quarantine. The block is not returned to the allocator at once:
   * it is poisoned, marked freed and queued, and only leaves the queue when
   * `quarantine` further frees have happened. Everything inside that window
   * is a use-after-free the allocator can still name; everything outside it
   * is a use-after-free that has become a silent wrong answer, which is the
   * honest limit of the technique.
   */
  function free(state, handle, at) {
    const block = handle ? state.blocks.get(handle.address) : null;

    if (!block) {
      return fault(state, 'double-free', handle, at, 'freed a block that is not allocated');
    }
    if (block.status !== 'live' || block.generation !== handle.generation) {
      return staleFree(state, block, handle, at);
    }
    block.status = 'freed';
    block.freedAt = at || 0;
    if (state.poison) block.bytes = block.bytes.map(function () { return POISON; });
    state.live -= block.size;
    state.freed += block.size;
    state.pending.push(handle.address);
    retire(state);
    return null;
  }

  /**
   * The second free of the same handle. While the block is in quarantine the
   * allocator still knows, and says so. Once the address has been reused the
   * second free succeeds against SOMEBODY ELSE'S block, which is the shape
   * that ends as heap corruption three functions later, and nothing reports
   * it — so it is recorded as silent rather than caught.
   */
  function staleFree(state, block, handle, at) {
    if (block.status === 'freed') {
      return fault(state, 'double-free', handle, at,
        'freed at step ' + block.freedAt + ' already');
    }
    state.silent.push({ kind: 'double-free', address: handle.address, at: at || 0,
      why: 'address reused; this frees the block that took its place' });
    return null;
  }

  /** Blocks leave quarantine oldest first, and become reusable memory. */
  function retire(state) {
    while (state.pending.length > state.quarantine) {
      const address = state.pending.shift();
      const block = state.blocks.get(address);

      if (!block) continue;
      block.status = 'retired';
      state.available.push({ address: address, size: block.size,
        generation: block.generation });
    }
  }

  /* --------------------------------------------------------- the accesses */

  function read(state, handle, offset, at) {
    const block = handle ? state.blocks.get(handle.address) : null;

    state.reads += 1;
    if (!block) return { value: null, fault: null };
    const verdict = check(state, block, handle, at, 'read');

    return { value: block.bytes[offset || 0], fault: verdict };
  }

  function write(state, handle, offset, value, at) {
    const block = handle ? state.blocks.get(handle.address) : null;

    state.writes += 1;
    if (!block) return null;
    const verdict = check(state, block, handle, at, 'wrote');

    block.bytes[offset || 0] = value;
    return verdict;
  }

  /**
   * The whole detector, and its whole limit. The generation on the handle is
   * the truth: if it does not match the block, the access is a use-after-free
   * whatever the allocator thinks. The allocator only sees the block's
   * status, so it catches the ones still in quarantine and misses the ones
   * whose address has been handed out again — silently, with a plausible
   * value returned. Deepening the quarantine moves rows from `silent` to
   * `faults` and costs memory to do it.
   */
  function check(state, block, handle, at, verb) {
    if (block.status === 'live' && block.generation === handle.generation) return null;
    if (block.status === 'freed') {
      return fault(state, 'use-after-free', handle, at, verb + ' at step ' + at
        + '; freed at step ' + block.freedAt + ', still poisoned in quarantine');
    }
    state.silent.push({ kind: 'use-after-free', address: handle.address, at: at || 0,
      why: verb + ' an address that has been handed to another allocation' });
    return null;
  }

  function fault(state, kind, handle, at, why) {
    const row = { kind: kind, address: handle ? handle.address : null,
      at: at || 0, why: why };

    state.faults.push(row);
    return row;
  }

  /* ---------------------------------------------------------- the report */

  /** Blocks still live at the end of the run: the leaks, with their sites. */
  function leaks(state) {
    const rows = [];

    state.blocks.forEach(function (block) {
      if (block.status !== 'live') return;
      rows.push({ address: block.address, size: block.size, site: block.site });
    });
    return rows;
  }

  /**
   * Replay a scripted run and report what the allocator caught against what
   * actually happened. `caught` and `missed` are different numbers and the
   * second is the one worth quoting: a detector that finds three of five
   * faults is a different tool from one that finds five, and only the ratio
   * says which you have.
   */
  function replay(script, options) {
    const state = create(options);
    const named = new Map();

    script.forEach(function (step, at) { apply(state, named, step, at + 1); });
    const seeded = script.filter(function (step) { return step.seeds; }).length;

    return { state: state, faults: state.faults, silent: state.silent,
      leaks: leaks(state), caught: state.faults.length, missed: state.silent.length,
      seeded: seeded, reuses: state.reuses,
      rate: seeded ? state.faults.length / seeded : 1,
      reads: state.reads, writes: state.writes, peak: state.peak,
      held: state.pending.length };
  }

  function apply(state, named, step, at) {
    if (step.op === 'alloc') {
      named.set(step.name, allocate(state, step.size, step.site));
      return;
    }
    if (step.op === 'free') { free(state, named.get(step.name), at); return; }
    if (step.op === 'read') { read(state, named.get(step.name), step.offset, at); return; }
    if (step.op === 'write') {
      write(state, named.get(step.name), step.offset, step.value, at);
      return;
    }
    if (step.op === 'drop') named.delete(step.name);
  }

  /**
   * The quarantine sweep: how many of the seeded faults each depth catches,
   * and how much memory that depth is holding out of circulation to do it.
   * There is no free lunch on this curve and the demo plots both columns.
   */
  function quarantineSweep(script, depths) {
    return depths.map(function (depth) {
      const out = replay(script, { quarantine: depth });

      return { quarantine: depth, caught: out.caught, missed: out.missed,
        seeded: out.seeded, reuses: out.reuses,
        held: heldBytes(out.state), peak: out.peak };
    });
  }

  function heldBytes(state) {
    return state.pending.reduce(function (sum, address) {
      const block = state.blocks.get(address);

      return sum + (block ? block.size : 0);
    }, 0);
  }

  /**
   * The fixture the section and its lab both use: five seeded faults — four
   * use-after-frees and a double free — plus one block that is never freed at
   * all, which `leaks()` reports rather than `faults`. The last row is a read
   * far enough past its free that the default quarantine has already released
   * the block, so the detector misses it. That row is deliberate: a detector
   * that catches every fault in its own fixture is either very good or
   * reading the script, and only a fixture it demonstrably fails on can tell
   * the two apart.
   */
  function seededScript() {
    return [
      { op: 'alloc', name: 'a', size: 4, site: 'buffer' },
      { op: 'alloc', name: 'b', size: 4, site: 'node' },
      { op: 'write', name: 'a', offset: 0, value: 7 },
      { op: 'free', name: 'a' },
      { op: 'read', name: 'a', offset: 0, seeds: 'use-after-free' },
      { op: 'free', name: 'a', seeds: 'double-free' },
      { op: 'alloc', name: 'c', size: 8, site: 'cache' },
      { op: 'alloc', name: 'd', size: 8, site: 'cache' },
      { op: 'free', name: 'c' },
      { op: 'alloc', name: 'e', size: 8, site: 'cache' },
      { op: 'alloc', name: 'f', size: 8, site: 'cache' },
      { op: 'free', name: 'd' },
      { op: 'free', name: 'e' },
      { op: 'free', name: 'f' },
      { op: 'read', name: 'c', offset: 0, seeds: 'use-after-free' },
      { op: 'write', name: 'd', offset: 1, value: 3, seeds: 'use-after-free' },
      /* `a` was freed at step 4 and left quarantine at step 14, five frees
         later. At the default depth of 4 this read is a use-after-free the
         allocator can no longer name, and it is the row that stops the
         fixture from being a script the detector passes by construction. */
      { op: 'read', name: 'a', offset: 0, seeds: 'use-after-free' }
    ];
  }

  return { POISON: POISON, FAULTS: FAULTS, create: create, allocate: allocate,
    free: free, read: read, write: write, leaks: leaks, replay: replay,
    quarantineSweep: quarantineSweep, seededScript: seededScript };
}));

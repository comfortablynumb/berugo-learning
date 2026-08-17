/**
 * Allocation-aware structures: bump, free list and pool.
 *
 * These are the cheap versions of the argument M43 makes properly. They exist
 * here because the allocation strategy is part of a data structure's cost, and
 * because fragmentation is much easier to believe once you have watched it
 * happen to a memory map you can see.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BasicAllocators = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  /**
   * Bump allocator: allocation is one addition, and there is no free at all -
   * only a reset that frees everything. Phase-structured work (a request, a
   * frame, a compilation pass) fits this exactly.
   */
  function createBumpAllocator(options) {
    const settings = options || {};
    const size = settings.bytes || 65536;
    let top = 0;
    const stats = { allocations: 0, resets: 0, failed: 0, peak: 0 };

    function allocate(bytes, align) {
      const boundary = align || 8;
      const start = Math.ceil(top / boundary) * boundary;
      if (start + bytes > size) { stats.failed += 1; return null; }
      top = start + bytes;
      stats.allocations += 1;
      stats.peak = Math.max(stats.peak, top);
      return { address: start, bytes: bytes };
    }

    return {
      allocate: allocate,
      reset: function () { top = 0; stats.resets += 1; },
      used: function () { return top; },
      free: function () { return size - top; },
      stats: function () { return Object.assign({ size: size, used: top }, stats); }
    };
  }

  /**
   * Free-list allocator over fixed-size slots. Allocation and free are both
   * O(1) because the free list is threaded through the free blocks themselves -
   * the trick worth remembering from this section.
   */
  function createFreeList(options) {
    const settings = options || {};
    const slotBytes = settings.slotBytes || 32;
    const slots = settings.slots || 256;
    const nextFree = new Int32Array(slots);
    const live = new Uint8Array(slots);

    for (let i = 0; i < slots; i += 1) nextFree[i] = i + 1;
    nextFree[slots - 1] = -1;

    let head = 0;
    const stats = { allocations: 0, frees: 0, failed: 0, liveCount: 0, peakLive: 0 };

    function allocate() {
      if (head < 0) { stats.failed += 1; return null; }
      const slot = head;
      head = nextFree[slot];
      live[slot] = 1;
      stats.allocations += 1;
      stats.liveCount += 1;
      stats.peakLive = Math.max(stats.peakLive, stats.liveCount);
      return { slot: slot, address: slot * slotBytes, bytes: slotBytes };
    }

    function free(handle) {
      if (!handle || !live[handle.slot]) return false;
      live[handle.slot] = 0;
      nextFree[handle.slot] = head;
      head = handle.slot;
      stats.frees += 1;
      stats.liveCount -= 1;
      return true;
    }

    return {
      allocate: allocate,
      free: free,
      stats: function () { return Object.assign({ slots: slots, slotBytes: slotBytes }, stats); },
      map: function () { return Array.from(live); }
    };
  }

  /**
   * A first-fit allocator over variable-size blocks, which is where external
   * fragmentation appears: plenty of free bytes, no contiguous run.
   */
  function createFirstFit(options) {
    const settings = options || {};
    const size = settings.bytes || 65536;
    let blocks = [{ address: 0, bytes: size, free: true }];
    const stats = { allocations: 0, frees: 0, failed: 0 };

    function allocate(bytes) {
      for (let i = 0; i < blocks.length; i += 1) {
        const block = blocks[i];
        if (!block.free || block.bytes < bytes) continue;

        const allocated = { address: block.address, bytes: bytes, free: false };
        const remainder = block.bytes - bytes;
        const replacement = remainder > 0
          ? [allocated, { address: block.address + bytes, bytes: remainder, free: true }]
          : [allocated];
        blocks.splice.apply(blocks, [i, 1].concat(replacement));
        stats.allocations += 1;
        return allocated;
      }
      stats.failed += 1;
      return null;
    }

    function free(handle) {
      const index = blocks.findIndex(function (block) {
        return !block.free && block.address === handle.address;
      });
      if (index < 0) return false;
      blocks[index].free = true;
      stats.frees += 1;
      coalesce();
      return true;
    }

    function coalesce() {
      const merged = [];
      blocks.forEach(function (block) {
        const previous = merged[merged.length - 1];
        if (previous && previous.free && block.free) {
          previous.bytes += block.bytes;
          return;
        }
        merged.push(Object.assign({}, block));
      });
      blocks = merged;
    }

    /** Fragmentation: free bytes that the largest free run cannot serve. */
    function fragmentation() {
      const free = blocks.filter(function (block) { return block.free; });
      const total = free.reduce(function (sum, block) { return sum + block.bytes; }, 0);
      const largest = free.reduce(function (max, block) { return Math.max(max, block.bytes); }, 0);
      return {
        freeBytes: total,
        largestFree: largest,
        blocks: blocks.length,
        ratio: total ? 1 - largest / total : 0
      };
    }

    return {
      allocate: allocate,
      free: free,
      fragmentation: fragmentation,
      blocks: function () { return blocks.map(function (block) { return Object.assign({}, block); }); },
      stats: function () { return Object.assign({ size: size }, stats); }
    };
  }

  /**
   * Drives an allocator with a churn workload and reports what happened. The
   * point of the section: pooling trades fragmentation and lifetime bugs for
   * allocation speed, and the trade is measurable.
   */
  function churn(options) {
    const allocator = options.allocator;
    const rng = options.rng;
    const rounds = options.rounds || 2000;
    const sizes = options.sizes || [16, 32, 64, 256];
    const live = [];
    let failures = 0;

    for (let i = 0; i < rounds; i += 1) {
      const shouldFree = live.length > 0 && rng.next() < (options.freeBias || 0.45);
      if (shouldFree) {
        const index = rng.int(live.length);
        allocator.free(live[index]);
        live.splice(index, 1);
        continue;
      }
      const handle = allocator.allocate(rng.pick(sizes));
      if (handle) live.push(handle); else failures += 1;
    }

    return { live: live.length, failures: failures, stats: allocator.stats() };
  }

  return {
    createBumpAllocator: createBumpAllocator,
    createFreeList: createFreeList,
    createFirstFit: createFirstFit,
    churn: churn
  };
}));

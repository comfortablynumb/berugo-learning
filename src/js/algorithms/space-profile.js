/**
 * Space complexity, measured rather than asserted.
 *
 * An accounting allocator that records live bytes, peak bytes and the
 * allocation timeline for three shapes of the same computation: materialise
 * everything, process in chunks, or stream one item at a time. The peak is the
 * number that matters, and it is the one people guess at.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SpaceProfile = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function createAccountant() {
    let live = 0;
    let peak = 0;
    let allocations = 0;
    const timeline = [];

    function allocate(bytes, label) {
      live += bytes;
      allocations += 1;
      peak = Math.max(peak, live);
      timeline.push({ step: timeline.length, delta: bytes, live: live, peak: peak, label: label || '' });
      return { bytes: bytes, label: label };
    }

    function release(handle) {
      if (!handle) return;
      live -= handle.bytes;
      timeline.push({ step: timeline.length, delta: -handle.bytes, live: live, peak: peak, label: 'free ' + (handle.label || '') });
    }

    return {
      allocate: allocate,
      release: release,
      timeline: function () { return timeline; },
      summary: function () {
        return { peakBytes: peak, liveBytes: live, allocations: allocations, steps: timeline.length };
      }
    };
  }

  const ITEM_BYTES = 64;

  /** Materialise: build every intermediate array before the next stage. */
  function materialised(n, stages) {
    const account = createAccountant();
    const held = [];
    for (let stage = 0; stage < stages; stage += 1) {
      held.push(account.allocate(n * ITEM_BYTES, 'stage ' + stage));
    }
    held.forEach(account.release);
    return Object.assign({ shape: 'materialised' }, account.summary());
  }

  /** Chunked: at most two chunks live at once, whatever n is. */
  function chunked(n, stages, chunkSize) {
    const account = createAccountant();
    const size = Math.max(1, chunkSize);
    const chunks = Math.ceil(n / size);

    for (let chunk = 0; chunk < chunks; chunk += 1) {
      const input = account.allocate(size * ITEM_BYTES, 'chunk in');
      let previous = input;
      for (let stage = 0; stage < stages; stage += 1) {
        const output = account.allocate(size * ITEM_BYTES, 'chunk stage ' + stage);
        account.release(previous);
        previous = output;
      }
      account.release(previous);
    }

    return Object.assign({ shape: 'chunked', chunkSize: size }, account.summary());
  }

  /** Streaming: one item in flight, so the peak does not depend on n at all. */
  function streaming(n, stages) {
    const account = createAccountant();
    for (let i = 0; i < n; i += 1) {
      let handle = account.allocate(ITEM_BYTES, 'item');
      for (let stage = 0; stage < stages; stage += 1) {
        const next = account.allocate(ITEM_BYTES, 'stage ' + stage);
        account.release(handle);
        handle = next;
      }
      account.release(handle);
    }
    return Object.assign({ shape: 'streaming' }, account.summary());
  }

  function compare(n, stages, chunkSize) {
    return [materialised(n, stages), chunked(n, stages, chunkSize), streaming(n, stages)];
  }

  /** Recursion depth is space too: the stack frame is the allocation. */
  function recursionDepth(options) {
    const frameBytes = options.frameBytes || 96;
    const depth = options.depth;
    return { depth: depth, frameBytes: frameBytes, peakBytes: depth * frameBytes };
  }

  return {
    createAccountant: createAccountant,
    materialised: materialised,
    chunked: chunked,
    streaming: streaming,
    compare: compare,
    recursionDepth: recursionDepth,
    ITEM_BYTES: ITEM_BYTES
  };
}));

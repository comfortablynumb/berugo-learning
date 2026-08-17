/**
 * A fully associative LRU cache over fixed-size lines.
 *
 * Counting *distinct* lines is the wrong measure for a single pass over data:
 * a full traversal touches every line exactly once whatever order the elements
 * sit in, so the number is identical for a contiguous array and a shredded
 * linked list. What actually differs is how many times a line has to be
 * fetched again after being evicted, and that needs a cache with a size.
 *
 * The model is deliberately simple - fully associative, LRU, no prefetcher,
 * no write policy. It is enough to show why layout changes cost, and M36
 * refines it with associativity and replacement policy.
 */
(function (root, factory) {
  'use strict';

  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.CacheSim = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const DEFAULT_LINE_BYTES = 64;
  const DEFAULT_LINES = 512;              // 32 KB, roughly an L1 data cache

  function create(options) {
    const settings = options || {};
    const lineBytes = settings.lineBytes || DEFAULT_LINE_BYTES;
    const capacity = Math.max(1, settings.lines || DEFAULT_LINES);
    const resident = new Map();           // line number -> true, in LRU order
    const counters = { accesses: 0, hits: 0, misses: 0, evictions: 0, distinct: 0 };
    const seen = new Set();

    function touchLine(line) {
      if (resident.has(line)) {
        resident.delete(line);            // re-insert to move it to the MRU end
        resident.set(line, true);
        counters.hits += 1;
        return;
      }

      counters.misses += 1;
      if (!seen.has(line)) { seen.add(line); counters.distinct += 1; }
      resident.set(line, true);
      if (resident.size <= capacity) return;

      const oldest = resident.keys().next().value;
      resident.delete(oldest);
      counters.evictions += 1;
    }

    /** One access may straddle a line boundary, which costs two fetches. */
    function access(address, bytes) {
      const width = bytes || 1;
      const first = Math.floor(address / lineBytes);
      const last = Math.floor((address + width - 1) / lineBytes);
      counters.accesses += 1;
      for (let line = first; line <= last; line += 1) touchLine(line);
    }

    function stats() {
      return {
        accesses: counters.accesses,
        hits: counters.hits,
        misses: counters.misses,
        evictions: counters.evictions,
        distinctLines: counters.distinct,
        missRate: counters.accesses ? counters.misses / counters.accesses : 0,
        bytesFetched: counters.misses * lineBytes,
        lines: capacity,
        lineBytes: lineBytes
      };
    }

    function reset() {
      resident.clear();
      seen.clear();
      Object.keys(counters).forEach(function (key) { counters[key] = 0; });
    }

    return {
      access: access,
      stats: stats,
      reset: reset,
      lineBytes: lineBytes,
      lines: capacity,
      resident: function () { return Array.from(resident.keys()); }
    };
  }

  /**
   * Runs a memory-model access log through a fresh cache. Both the record
   * array and the linked list already record one, so measuring them is a
   * replay rather than a second instrumented traversal that could drift.
   */
  function replay(options) {
    const settings = options || {};
    const cache = create(settings);
    (settings.log || []).forEach(function (entry) { cache.access(entry.address, entry.bytes); });
    return cache.stats();
  }

  /**
   * A cache sized so that a given number of bytes fits: used by demos that
   * want "the array fits" or "the array does not fit" as a control.
   */
  function linesFor(bytes, lineBytes) {
    return Math.max(1, Math.ceil(bytes / (lineBytes || DEFAULT_LINE_BYTES)));
  }

  return {
    create: create,
    replay: replay,
    linesFor: linesFor,
    DEFAULT_LINE_BYTES: DEFAULT_LINE_BYTES,
    DEFAULT_LINES: DEFAULT_LINES
  };
}));

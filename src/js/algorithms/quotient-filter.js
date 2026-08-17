/**
 * Quotient filter: a p-bit fingerprint split into a q-bit slot index and an
 * r-bit remainder, with three metadata bits per slot that reconstruct which
 * remainder belongs to which quotient after linear probing has moved it.
 *
 *   fingerprint = quotient · 2^r + remainder,  p = q + r
 *   is_occupied     slot q is the canonical slot of at least one fingerprint
 *   is_continuation this slot continues the run started to its left
 *   is_shifted      this slot's element is not in its canonical slot
 *
 * Two properties follow from that layout and neither is available to a Bloom
 * filter. A query touches one run of contiguous slots, so it is one or two
 * cache lines rather than k scattered bits. And the slots can be read out in
 * ascending fingerprint order in a single linear pass, so two filters merge by
 * merge-sorting their read-outs into a filter with one more quotient bit and
 * one fewer remainder bit - the same p, the same fingerprints, no rehashing
 * and no access to the original keys.
 *
 * Deletion is not implemented. It is possible - it is an unshift of the tail
 * of the cluster - and a partially correct unshift corrupts run boundaries in
 * a way that reports false negatives, so a filter that cannot delete is the
 * honest thing to ship next to a cuckoo filter that can.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.QuotientFilter = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const LINE_BYTES = 64;
  const METADATA_BITS = 3;

  function hashFunctions() {
    if (scope && scope.HashFunctions) return scope.HashFunctions;
    return require('./hash-functions.js');
  }

  /** α/2^r: a query collides when some stored fingerprint equals this one. */
  function fprFor(options) {
    return 1 - Math.exp(-options.count / Math.pow(2, options.quotientBits + options.remainderBits));
  }

  function create(options) {
    const settings = options || {};
    const quotientBits = Math.max(3, Math.min(20, Math.floor(settings.quotientBits || 12)));
    const remainderBits = Math.max(1, Math.min(24, Math.floor(settings.remainderBits || 8)));
    const seed = (settings.seed === undefined ? 1 : settings.seed) >>> 0;
    const slots = Math.pow(2, quotientBits);
    const remainders = new Uint32Array(slots);
    const occupied = new Uint8Array(slots);
    const continuation = new Uint8Array(slots);
    const shifted = new Uint8Array(slots);
    const slotsPerLine = Math.max(1, Math.floor(LINE_BYTES * 8 / (remainderBits + METADATA_BITS)));
    let items = 0;
    let stats = emptyStats();

    function next(index) { return (index + 1) & (slots - 1); }
    function prev(index) { return (index - 1 + slots) & (slots - 1); }
    function isEmpty(index) {
      return !occupied[index] && !continuation[index] && !shifted[index];
    }

    function fingerprintOf(key) {
      const H = hashFunctions();
      const hash = H.murmur3(key, seed);
      const total = quotientBits + remainderBits;
      const value = total >= 32 ? hash >>> 0 : (hash >>> (32 - total));
      return {
        quotient: Math.floor(value / Math.pow(2, remainderBits)) & (slots - 1),
        remainder: value % Math.pow(2, remainderBits),
        value: value
      };
    }

    /** Walk left to the cluster start, then right one run per occupied slot. */
    function runStart(quotient) {
      let b = quotient;
      while (shifted[b]) { b = prev(b); stats.slotReads += 1; }

      let s = b;
      while (b !== quotient) {
        do { s = next(s); stats.slotReads += 1; } while (continuation[s]);
        do { b = next(b); } while (!occupied[b]);
      }
      return s;
    }

    /** Writes at `s` and carries every displaced element one slot to the right. */
    function insertAndShift(s, remainder, continues, isShifted) {
      let curR = remainder;
      let curC = continues ? 1 : 0;
      let curS = isShifted ? 1 : 0;
      let i = s;

      for (let guard = 0; guard < slots; guard += 1) {
        const empty = isEmpty(i);
        const oldR = remainders[i];
        const oldC = continuation[i];
        remainders[i] = curR;
        continuation[i] = curC;
        shifted[i] = curS;
        if (empty) return true;
        curR = oldR;
        curC = oldC;
        curS = 1;
        i = next(i);
        stats.shifts += 1;
      }
      return false;
    }

    /** Scans a run for the sorted insertion point; -1 means already present. */
    function positionInRun(start, remainder) {
      let s = start;
      do {
        stats.slotReads += 1;
        if (remainders[s] === remainder) return -1;
        if (remainders[s] > remainder) return s;
        s = next(s);
      } while (continuation[s]);
      return s;
    }

    function addFingerprint(quotient, remainder) {
      if (items >= slots) return false;
      if (isEmpty(quotient)) {
        remainders[quotient] = remainder;
        occupied[quotient] = 1;
        items += 1;
        return true;
      }

      const runExisted = occupied[quotient] === 1;
      occupied[quotient] = 1;
      const start = runStart(quotient);
      const s = runExisted ? positionInRun(start, remainder) : start;
      if (s === -1) return false;

      if (runExisted && s === start) continuation[start] = 1;
      insertAndShift(s, remainder, s !== start, s !== quotient);
      items += 1;
      return true;
    }

    function add(key) {
      const fingerprint = fingerprintOf(key);
      stats.inserts += 1;
      return addFingerprint(fingerprint.quotient, fingerprint.remainder);
    }

    function has(key) {
      const fingerprint = fingerprintOf(key);
      stats.queries += 1;
      if (!occupied[fingerprint.quotient]) { stats.linesTouched += 1; return false; }

      let s = runStart(fingerprint.quotient);
      const first = s;
      do {
        if (remainders[s] === fingerprint.remainder) { chargeLines(first, s); return true; }
        if (remainders[s] > fingerprint.remainder) break;
        s = next(s);
      } while (continuation[s]);

      chargeLines(first, s);
      return false;
    }

    function chargeLines(from, to) {
      const span = (to - from + slots) % slots;
      stats.linesTouched += 1 + Math.floor(span / slotsPerLine);
    }

    /** Every stored fingerprint, in ascending fingerprint order, in one pass. */
    function entries() {
      const out = [];
      for (let quotient = 0; quotient < slots; quotient += 1) {
        if (!occupied[quotient]) continue;
        let s = runStart(quotient);
        out.push({ quotient: quotient, remainder: remainders[s] });
        s = next(s);
        while (continuation[s] && out.length <= items) {
          out.push({ quotient: quotient, remainder: remainders[s] });
          s = next(s);
        }
      }
      return out;
    }

    /** Run and cluster lengths, which is what the load-factor story is about. */
    function clusterStats() {
      let clusters = 0;
      let longest = 0;
      let current = 0;
      for (let i = 0; i < slots; i += 1) {
        if (isEmpty(i)) {
          if (current > longest) longest = current;
          current = 0;
          continue;
        }
        if (current === 0) clusters += 1;
        current += 1;
      }
      return { clusters: clusters, longestCluster: Math.max(longest, current) };
    }

    return {
      kind: 'quotient',
      add: add,
      has: has,
      addFingerprint: addFingerprint,
      fingerprintOf: fingerprintOf,
      entries: entries,
      clusterStats: clusterStats,
      slots: function () { return slots; },
      quotientBits: function () { return quotientBits; },
      remainderBits: function () { return remainderBits; },
      count: function () { return items; },
      load: function () { return items / slots; },
      bits: function () { return slots * (remainderBits + METADATA_BITS); },
      bytes: function () { return Math.ceil(slots * (remainderBits + METADATA_BITS) / 8); },
      metadata: function () {
        return { occupied: occupied, continuation: continuation, shifted: shifted, remainders: remainders };
      },
      predictedFpr: function () {
        return fprFor({ count: items, quotientBits: quotientBits, remainderBits: remainderBits });
      },
      stats: function () { return Object.assign({}, stats); },
      resetStats: function () { stats = emptyStats(); }
    };
  }

  function emptyStats() {
    return { queries: 0, inserts: 0, slotReads: 0, shifts: 0, linesTouched: 0 };
  }

  /**
   * Merges two filters of the same shape into one with a doubled slot count.
   * One bit moves from the remainder to the quotient, so p is unchanged and
   * every fingerprint survives: no key is rehashed and no key is needed.
   */
  function merge(a, b) {
    const remainderBits = a.remainderBits() - 1;
    if (remainderBits < 1) throw new Error('QuotientFilter.merge: no remainder bit left to move');

    const out = create({
      quotientBits: a.quotientBits() + 1,
      remainderBits: remainderBits,
      seed: 1
    });
    const half = Math.pow(2, remainderBits);
    const values = merged(valuesOf(a), valuesOf(b));

    values.forEach(function (value) {
      out.addFingerprint(Math.floor(value / half), value % half);
    });

    return { filter: out, fingerprints: values.length };
  }

  /** The p-bit fingerprints a filter holds, ascending, from its read-out. */
  function valuesOf(filter) {
    const scale = Math.pow(2, filter.remainderBits());
    return filter.entries().map(function (entry) {
      return entry.quotient * scale + entry.remainder;
    });
  }

  /** One linear pass over two ascending streams - the reason to bother. */
  function merged(a, b) {
    const out = [];
    let i = 0;
    let j = 0;

    while (i < a.length || j < b.length) {
      if (j >= b.length || (i < a.length && a[i] <= b[j])) { out.push(a[i]); i += 1; continue; }
      out.push(b[j]);
      j += 1;
    }
    return out;
  }

  return {
    create: create,
    merge: merge,
    valuesOf: valuesOf,
    fprFor: fprFor,
    METADATA_BITS: METADATA_BITS
  };
}));

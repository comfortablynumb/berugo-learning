/**
 * Counting, bucket and radix sort - the sorts that escape the Ω(n log n)
 * bound by refusing to be comparison sorts, and the constraints they pay for
 * it with.
 *
 * The lower bound says a sort that learns about its input *only* through
 * comparisons needs Ω(n log n) of them. None of these do. Counting sort reads
 * the key as an index; radix sort reads it as a sequence of digits. They are
 * not faster comparison sorts, they are not comparison sorts at all - and the
 * price is that they need to know what a key looks like.
 *
 * The three constraints, which the section makes measurable rather than
 * stating:
 *
 *   counting sort  allocates one bucket per possible key. Sorting 1 000
 *                  32-bit integers means a 4-billion-entry table, so the
 *                  key range - not n - is what decides feasibility.
 *   LSD radix      is stable-or-broken. Each pass must preserve the order the
 *                  previous passes established; an unstable digit pass leaves
 *                  output that is *almost* right, which is the worst kind.
 *   bucket sort    assumes the keys are roughly uniform. They usually are
 *                  not, and a skewed distribution puts everything in one
 *                  bucket and degrades to whatever sorts the bucket.
 *
 * Negative numbers are the classic radix bug. Two's-complement negatives have
 * the top bit set, so an unsigned digit sort puts them *after* the positives.
 * The fix is to bias the sign bit (`value ^ 0x80000000`), which is one line
 * and is omitted by roughly every hand-rolled radix sort.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.RadixSort = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const SIGN_BIT = 0x80000000;

  /** Map a signed 32-bit value onto an unsigned one that sorts the same way.
   *  Flipping the sign bit maps [-2^31, 2^31) onto [0, 2^32) monotonically. */
  function biasSigned(value) {
    return (value ^ SIGN_BIT) >>> 0;
  }

  function unbiasSigned(value) {
    return (value ^ SIGN_BIT) | 0;
  }

  /**
   * Counting sort over a key range. Stable when built the standard way: the
   * prefix sums give each key its block, and walking the input *backwards*
   * while decrementing the counter keeps equal keys in their original order.
   *
   * `unstable: true` walks forwards instead, which is the one-line mistake
   * that makes an LSD radix built on it silently wrong.
   */
  function countingSort(values, ops, options) {
    const settings = options || {};
    const keyOf = settings.key || function (value) { return value; };
    const range = keyRangeOf(values, keyOf, settings);
    const min = range.min;
    const max = range.max;
    const span = max - min + 1;
    if (!values.length) return { values: values, buckets: 0, counts: [] };

    ops.alloc(span);
    const counts = new Array(span).fill(0);
    values.forEach(function (value) { counts[keyOf(value) - min] += 1; });

    for (let i = 1; i < span; i += 1) counts[i] += counts[i - 1];

    ops.alloc(values.length);
    const out = new Array(values.length);
    if (settings.unstable) {
      for (let i = 0; i < values.length; i += 1) placeFrom(values, out, counts, keyOf, min, i, ops);
    } else {
      for (let i = values.length - 1; i >= 0; i -= 1) placeFrom(values, out, counts, keyOf, min, i, ops);
    }

    for (let i = 0; i < values.length; i += 1) ops.write(values, i, out[i]);
    return { values: values, buckets: span, counts: counts };
  }

  function placeFrom(values, out, counts, keyOf, min, index, ops) {
    const slot = keyOf(values[index]) - min;
    counts[slot] -= 1;
    ops.move();
    out[counts[slot]] = values[index];
  }

  /** The key range, read through the key function rather than off the values
   *  themselves - sorting objects by a field is the normal case, and a range
   *  computed from the objects is `NaN`. */
  function keyRangeOf(values, keyOf, settings) {
    let min = settings.min === undefined ? Infinity : settings.min;
    let max = settings.max === undefined ? -Infinity : settings.max;
    if (settings.min !== undefined && settings.max !== undefined) return { min: min, max: max };

    values.forEach(function (value) {
      const key = keyOf(value);
      if (settings.min === undefined && key < min) min = key;
      if (settings.max === undefined && key > max) max = key;
    });
    return { min: min, max: max };
  }

  /**
   * LSD radix sort for 32-bit integers, `bits` at a time.
   *
   * Least-significant digit first only works because every pass is stable:
   * after sorting by digit 0, the pass on digit 1 must leave elements with
   * equal digit-1 values in the order digit 0 put them. Break stability in
   * any single pass and every earlier pass is silently undone.
   */
  function lsdRadixSort(values, ops, options) {
    const settings = options || {};
    const bits = settings.bits || 8;
    const signed = settings.signed !== false;
    const keyOf = settings.key || function (value) { return value; };
    const buckets = 1 << bits;
    const passes = Math.ceil(32 / bits);
    const report = { passes: 0, buckets: buckets, bits: bits, histograms: [] };
    if (values.length < 2) return report;

    const codeOf = function (value) {
      const raw = keyOf(value) | 0;
      return signed ? biasSigned(raw) : (raw >>> 0);
    };

    let source = values;
    ops.alloc(values.length);
    let target = new Array(values.length);

    for (let pass = 0; pass < passes; pass += 1) {
      const shift = pass * bits;
      ops.alloc(buckets);
      const counts = new Array(buckets).fill(0);
      for (let i = 0; i < source.length; i += 1) counts[(codeOf(source[i]) >>> shift) & (buckets - 1)] += 1;

      if (report.histograms.length < passes) report.histograms.push(counts.slice());
      if (counts[(codeOf(source[0]) >>> shift) & (buckets - 1)] === source.length) continue;

      for (let b = 1; b < buckets; b += 1) counts[b] += counts[b - 1];

      if (settings.unstable) {
        for (let i = 0; i < source.length; i += 1) scatter(source, target, counts, codeOf, shift, buckets, i, ops);
      } else {
        for (let i = source.length - 1; i >= 0; i -= 1) scatter(source, target, counts, codeOf, shift, buckets, i, ops);
      }

      const held = source;
      source = target;
      target = held;
      report.passes += 1;
    }

    if (source !== values) for (let i = 0; i < values.length; i += 1) ops.write(values, i, source[i]);
    return report;
  }

  function scatter(source, target, counts, codeOf, shift, buckets, index, ops) {
    const slot = (codeOf(source[index]) >>> shift) & (buckets - 1);
    counts[slot] -= 1;
    ops.move();
    target[counts[slot]] = source[index];
  }

  /**
   * MSD radix, which is what sorting variable-length keys needs: it can stop
   * as soon as a bucket holds one element, so it never looks at the rest of
   * a key that is already distinguished. That is also why it is the right
   * shape for strings and the wrong shape for fixed-width integers, where
   * LSD's single linear pass per digit wins.
   */
  function msdRadixSort(values, ops, options) {
    const settings = options || {};
    const bits = settings.bits || 8;
    const buckets = 1 << bits;
    const signed = settings.signed !== false;
    const keyOf = settings.key || function (value) { return value; };
    const cutoff = settings.cutoff === undefined ? 16 : settings.cutoff;
    const report = { recursions: 0, shortCircuits: 0, insertionRuns: 0 };

    const codeOf = function (value) {
      const raw = keyOf(value) | 0;
      return signed ? biasSigned(raw) : (raw >>> 0);
    };

    function sortRange(items, shift) {
      if (items.length < 2) { report.shortCircuits += 1; return items; }
      if (shift < 0) return items;
      if (items.length <= cutoff && settings.insertionSort) {
        report.insertionRuns += 1;
        settings.insertionSort(items, ops, {});
        return items;
      }

      report.recursions += 1;
      ops.alloc(buckets);
      const bins = [];
      for (let b = 0; b < buckets; b += 1) bins.push([]);
      items.forEach(function (item) {
        ops.move();
        bins[(codeOf(item) >>> shift) & (buckets - 1)].push(item);
      });

      const out = [];
      bins.forEach(function (bin) {
        sortRange(bin, shift - bits).forEach(function (item) { out.push(item); });
      });
      return out;
    }

    const sorted = sortRange(values.slice(), 32 - bits);
    for (let i = 0; i < values.length; i += 1) ops.write(values, i, sorted[i]);
    return report;
  }

  /**
   * Bucket sort: split [min, max] into n equal buckets, sort each, concatenate.
   * O(n) expected *if* the keys are uniform. `maxBucket` is reported because
   * it is the number that decides whether the assumption held: on uniform
   * input it is a small constant, and on skewed input it is n.
   */
  function bucketSort(values, ops, options) {
    const settings = options || {};
    const keyOf = settings.key || function (value) { return value; };
    const count = settings.buckets || Math.max(1, values.length);
    const min = values.reduce(function (a, v) { return Math.min(a, keyOf(v)); }, Infinity);
    const max = values.reduce(function (a, v) { return Math.max(a, keyOf(v)); }, -Infinity);
    const span = (max - min) || 1;

    ops.alloc(count);
    const bins = [];
    for (let b = 0; b < count; b += 1) bins.push([]);

    values.forEach(function (value) {
      const slot = Math.min(count - 1, Math.floor(((keyOf(value) - min) / span) * count));
      ops.move();
      bins[slot].push(value);
    });

    let at = 0;
    let maxBucket = 0;
    bins.forEach(function (bin) {
      if (bin.length > maxBucket) maxBucket = bin.length;
      if (settings.insertionSort) settings.insertionSort(bin, ops, {});
      bin.forEach(function (value) { ops.write(values, at, value); at += 1; });
    });

    return { buckets: count, maxBucket: maxBucket, meanBucket: values.length / count };
  }

  /**
   * American flag sort: MSD radix done in place. One counting pass to size
   * the buckets, then a permutation cycle that swaps each element to its
   * bucket - so it allocates the histogram and nothing else. It is not
   * stable, which is the price of doing it in place.
   */
  function americanFlagSort(values, ops, options) {
    const settings = options || {};
    const bits = settings.bits || 8;
    const buckets = 1 << bits;
    const signed = settings.signed !== false;
    const report = { passes: 0, cycles: 0 };

    const codeOf = function (value) {
      const raw = value | 0;
      return signed ? biasSigned(raw) : (raw >>> 0);
    };

    function sortRange(from, to, shift) {
      if (to - from < 2 || shift < 0) return;
      report.passes += 1;
      ops.alloc(buckets * 2);
      const counts = new Array(buckets).fill(0);
      for (let i = from; i < to; i += 1) counts[(codeOf(values[i]) >>> shift) & (buckets - 1)] += 1;

      const starts = new Array(buckets);
      const ends = new Array(buckets);
      let at = from;
      for (let b = 0; b < buckets; b += 1) { starts[b] = at; at += counts[b]; ends[b] = at; }

      for (let b = 0; b < buckets; b += 1) {
        while (starts[b] < ends[b]) {
          const slot = (codeOf(values[starts[b]]) >>> shift) & (buckets - 1);
          if (slot === b) { starts[b] += 1; continue; }
          ops.swap(values, starts[b], starts[slot]);
          starts[slot] += 1;
          report.cycles += 1;
        }
      }

      let begin = from;
      for (let b = 0; b < buckets; b += 1) {
        sortRange(begin, ends[b], shift - bits);
        begin = ends[b];
      }
    }

    sortRange(0, values.length, 32 - bits);
    return report;
  }

  /** The memory a counting sort needs for a key range, and the n at which a
   *  comparison sort's n log2 n is cheaper. Both are arithmetic, and the
   *  section shows them rather than asserting "counting sort needs small
   *  keys". */
  function countingCost(keyRange, n, bytesPerSlot) {
    const slotBytes = bytesPerSlot === undefined ? 4 : bytesPerSlot;
    return {
      keyRange: keyRange,
      tableBytes: keyRange * slotBytes,
      countingOperations: n + keyRange,
      comparisonOperations: n * Math.max(1, Math.log2(Math.max(2, n))),
      wins: n + keyRange < n * Math.max(1, Math.log2(Math.max(2, n)))
    };
  }

  return {
    countingSort: countingSort,
    lsdRadixSort: lsdRadixSort,
    msdRadixSort: msdRadixSort,
    bucketSort: bucketSort,
    americanFlagSort: americanFlagSort,
    countingCost: countingCost,
    biasSigned: biasSigned,
    unbiasSigned: unbiasSigned
  };
}));

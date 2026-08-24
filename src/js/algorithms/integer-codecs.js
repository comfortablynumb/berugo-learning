/**
 * Domain-specific compression: knowing what the numbers mean.
 *
 * A general-purpose compressor sees bytes. A columnar store knows the column is
 * sorted timestamps, or low-cardinality strings, or a metric that barely moves,
 * and each of those facts is worth more than any amount of Huffman coding. This
 * module implements the encodings those formats actually use and measures them
 * on the same data, because the choice between them is entirely a property of
 * the data rather than of the encoder.
 *
 * The single most important measurement here is that SORTING the column first
 * is usually worth more than the encoding choice. Delta coding a sorted column
 * turns large integers into small ones; delta coding an unsorted one turns
 * small integers into large ones with sign noise. That is why columnar formats
 * care so much about clustering keys, and why "which codec" is the second
 * question rather than the first.
 *
 * Gorilla's float encoding is the other lesson: XOR two consecutive readings of
 * a slowly-varying metric and nearly all the bits are zero, because IEEE 754
 * puts the exponent and the high mantissa bits — the parts that do not change —
 * at the top. That is a compression scheme built entirely out of a fact about
 * the representation.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.IntegerCodecs = api;
}(this, function () {
  'use strict';

  /* ------------------------------------------------------------ varint */

  /** LEB128: seven payload bits per byte, the top bit saying "more follows". */
  function varintBytes(value) {
    let bytes = 1;
    let remaining = Math.floor(value / 128);

    while (remaining > 0) {
      bytes += 1;
      remaining = Math.floor(remaining / 128);
    }
    return bytes;
  }

  function varint(values) {
    let bytes = 0;

    values.forEach(function (value) { bytes += varintBytes(value); });
    return { name: 'varint', bytes: bytes, values: values.length };
  }

  /** Zigzag maps signed to unsigned without wasting the high bits on sign, so
   *  −1 costs one byte rather than ten. */
  function zigzag(value) {
    return value >= 0 ? value * 2 : -value * 2 - 1;
  }

  function unzigzag(value) {
    return value % 2 === 0 ? value / 2 : -(value + 1) / 2;
  }

  /* ------------------------------------------------------------- delta */

  function delta(values) {
    const out = [];

    for (let i = 0; i < values.length; i += 1) {
      out.push(i === 0 ? values[0] : values[i] - values[i - 1]);
    }
    return out;
  }

  function undelta(deltas) {
    const out = [];
    let running = 0;

    deltas.forEach(function (value, i) {
      running = i === 0 ? value : running + value;
      out.push(running);
    });
    return out;
  }

  /* ------------------------------------------------------- bit packing */

  /** Every value in the same number of bits, sized by the largest. One outlier
   *  therefore costs the whole block, which is what frame-of-reference and
   *  patched schemes exist to fix. */
  function bitsFor(value) {
    if (value <= 0) return 1;
    return Math.floor(Math.log2(value)) + 1;
  }

  function bitPack(values) {
    let width = 1;

    values.forEach(function (value) { width = Math.max(width, bitsFor(value)); });
    return { name: 'bit-packed', width: width, bytes: Math.ceil(width * values.length / 8),
      values: values.length };
  }

  /** Frame of reference: subtract the block minimum first, so a column of large
   *  but similar values packs as if it were small. */
  function frameOfReference(values, blockSize) {
    const size = blockSize === undefined ? 128 : blockSize;
    let bytes = 0;
    const blocks = [];

    for (let at = 0; at < values.length; at += size) {
      const block = values.slice(at, Math.min(values.length, at + size));
      const minimum = Math.min.apply(null, block);
      let width = 1;

      block.forEach(function (value) { width = Math.max(width, bitsFor(value - minimum)); });
      bytes += 4 + Math.ceil(width * block.length / 8);
      blocks.push({ minimum: minimum, width: width, length: block.length });
    }
    return { name: 'frame-of-reference', bytes: bytes, blocks: blocks, values: values.length };
  }

  /**
   * Simple-8b: pack as many values as fit into a 64-bit word at one of a fixed
   * set of widths, with a 4-bit selector. Its point is that the width adapts
   * every word rather than every block, so a single outlier costs one word
   * rather than a block.
   */
  const SIMPLE8B = [
    { bits: 60, count: 1 }, { bits: 30, count: 2 }, { bits: 20, count: 3 },
    { bits: 15, count: 4 }, { bits: 12, count: 5 }, { bits: 10, count: 6 },
    { bits: 8, count: 7 }, { bits: 7, count: 8 }, { bits: 6, count: 10 },
    { bits: 5, count: 12 }, { bits: 4, count: 15 }, { bits: 3, count: 20 },
    { bits: 2, count: 30 }, { bits: 1, count: 60 }
  ];

  function simple8b(values) {
    let at = 0;
    let words = 0;

    while (at < values.length) {
      const chosen = chooseSelector(values, at);

      words += 1;
      at += chosen;
    }
    return { name: 'simple-8b', bytes: words * 8, words: words, values: values.length };
  }

  function chooseSelector(values, at) {
    for (let s = SIMPLE8B.length - 1; s >= 0; s -= 1) {
      const option = SIMPLE8B[s];
      const available = Math.min(option.count, values.length - at);
      let fits = true;

      for (let i = 0; i < available && fits; i += 1) {
        if (bitsFor(values[at + i]) > option.bits) fits = false;
      }
      if (fits && available === option.count) return option.count;
      if (fits && available < option.count) return available;
    }
    return 1;
  }

  /* ------------------------------------------------ columnar encodings */

  /** A dictionary plus codes, which is what every columnar format reaches for
   *  on a low-cardinality string column. */
  function dictionary(values) {
    const codes = new Map();
    const out = [];

    values.forEach(function (value) {
      if (!codes.has(value)) codes.set(value, codes.size);
      out.push(codes.get(value));
    });
    const width = Math.max(1, Math.ceil(Math.log2(Math.max(2, codes.size))));

    return { name: 'dictionary', cardinality: codes.size, width: width,
      bytes: Math.ceil(width * values.length / 8) + codes.size * 8,
      codes: out, values: values.length };
  }

  /** Run-length coding, which is what dictionary codes become once the column
   *  is sorted — and it is why sorting is the first thing these formats do. */
  function runLength(values) {
    const runs = [];

    values.forEach(function (value) {
      const last = runs[runs.length - 1];

      if (last && last.value === value) {
        last.count += 1;
        return;
      }
      runs.push({ value: value, count: 1 });
    });
    return { name: 'run-length', runs: runs.length, bytes: runs.length * 5,
      values: values.length };
  }

  /* ------------------------------------------------- Gorilla XOR floats */

  /**
   * Gorilla: XOR each double with the previous one and store only the bits
   * between the leading and trailing zeros. A metric that moves slowly has
   * almost every high bit unchanged, so the XOR is nearly zero and the stored
   * window is a handful of bits.
   *
   * The control bits are what make it exact: one bit for "identical", and when
   * not, one more for "the meaningful window fits inside the previous one",
   * which avoids re-sending the leading-zero count. The scheme is lossless —
   * an exact reproduction of every double — which is what separates it from
   * quantising a metric and hoping.
   */
  function gorilla(values) {
    const encoded = [];
    let bits = 64;
    let previous = values.length ? toBits(values[0]) : null;
    let previousLeading = -1;
    let previousTrailing = -1;

    for (let i = 1; i < values.length; i += 1) {
      const current = toBits(values[i]);
      const x = xorBits(previous, current);
      const window = meaningful(x);

      if (window.length === 0) {
        bits += 1;
        encoded.push({ control: 'same' });
      } else if (previousLeading >= 0 && window.leading >= previousLeading
          && window.trailing >= previousTrailing) {
        const width = 64 - previousLeading - previousTrailing;

        bits += 2 + width;
        encoded.push({ control: 'reuse', width: width });
      } else {
        bits += 2 + 5 + 6 + window.length;
        encoded.push({ control: 'new', leading: window.leading, width: window.length });
        previousLeading = window.leading;
        previousTrailing = window.trailing;
      }
      previous = current;
    }
    return { name: 'gorilla', bits: bits, bytes: Math.ceil(bits / 8),
      values: values.length, encoded: encoded,
      ratio: values.length === 0 ? 1 : (values.length * 8) / Math.max(1, Math.ceil(bits / 8)) };
  }

  /** A double's 64 bits as two 32-bit halves, which is as much as a JS bitwise
   *  operator can hold. */
  function toBits(value) {
    const buffer = new ArrayBuffer(8);
    const floats = new Float64Array(buffer);
    const words = new Uint32Array(buffer);

    floats[0] = value;
    return { high: words[1], low: words[0] };
  }

  function fromBits(bits) {
    const buffer = new ArrayBuffer(8);
    const floats = new Float64Array(buffer);
    const words = new Uint32Array(buffer);

    words[1] = bits.high;
    words[0] = bits.low;
    return floats[0];
  }

  function xorBits(a, b) {
    return { high: (a.high ^ b.high) >>> 0, low: (a.low ^ b.low) >>> 0 };
  }

  /** Leading zeros, trailing zeros and the width between them. */
  function meaningful(x) {
    if (x.high === 0 && x.low === 0) return { leading: 64, trailing: 0, length: 0 };
    const leading = x.high !== 0 ? Math.clz32(x.high) : 32 + Math.clz32(x.low);
    const trailing = x.low !== 0 ? countTrailing(x.low) : 32 + countTrailing(x.high);

    return { leading: leading, trailing: trailing, length: 64 - leading - trailing };
  }

  function countTrailing(word) {
    if (word === 0) return 32;
    let count = 0;
    let value = word;

    while ((value & 1) === 0) {
      count += 1;
      value >>>= 1;
    }
    return count;
  }

  /** The exact round-trip: the encoding stores every meaningful bit, so
   *  reconstructing from the XOR chain returns the identical doubles. */
  function gorillaRoundTrip(values) {
    if (values.length === 0) return [];
    const out = [values[0]];
    let previous = toBits(values[0]);

    for (let i = 1; i < values.length; i += 1) {
      const current = toBits(values[i]);
      const x = xorBits(previous, current);

      out.push(fromBits(xorBits(previous, x)));
      previous = current;
    }
    return out;
  }

  return {
    varintBytes: varintBytes, varint: varint, zigzag: zigzag, unzigzag: unzigzag,
    delta: delta, undelta: undelta, bitsFor: bitsFor, bitPack: bitPack,
    frameOfReference: frameOfReference, simple8b: simple8b, SIMPLE8B: SIMPLE8B,
    dictionary: dictionary, runLength: runLength,
    gorilla: gorilla, gorillaRoundTrip: gorillaRoundTrip,
    toBits: toBits, fromBits: fromBits, meaningful: meaningful
  };
}));

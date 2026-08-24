/**
 * The bzip2 chain: a transform that compresses nothing, and why it works.
 *
 * The Burrows–Wheeler transform is a permutation. It removes no redundancy, it
 * changes no byte's value, and its output is the same length as its input — and
 * running it before a compressor typically halves the result. What it does is
 * REARRANGE: sorting every rotation of the input puts characters with similar
 * following context next to each other, so the letters preceding "he" in
 * English text end up in one run, and that run is mostly "t".
 *
 * Move-to-front then converts "locally repetitive" into "mostly small numbers":
 * each symbol is replaced by its position in a list that is reordered to put
 * the last-seen symbol first. A run of one character becomes a run of zeros.
 * Run-length coding collapses those runs, and an entropy coder finishes the
 * job — and it is a WEAK, order-0 entropy coder, which is the point. The
 * pipeline is a way of making a simple model accurate, rather than a way of
 * building a complicated model.
 *
 * Every stage's size and entropy are reported here, because the gain is not
 * where intuition puts it: BWT leaves the size unchanged and the ENTROPY nearly
 * unchanged too — the order-0 entropy of a permutation is identical to that of
 * its input, by definition. The drop appears at MTF, and that is the fact the
 * pipeline is worth teaching for.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.BwtPipeline = api;
}(this, function () {
  'use strict';

  /* ---------------------------------------------------------------- BWT */

  /**
   * The transform, over byte arrays. A suffix array would be O(n log n); at the
   * block sizes this demo uses, sorting rotations directly is clearer and fast
   * enough, and the row index replaces the sentinel character so the alphabet
   * is unchanged.
   */
  function transform(bytes) {
    const n = bytes.length;

    if (n === 0) return { last: [], index: 0 };
    const order = [];

    for (let i = 0; i < n; i += 1) order.push(i);
    order.sort(function (a, b) { return compareRotations(bytes, a, b); });
    const last = [];
    let index = 0;

    order.forEach(function (start, row) {
      if (start === 0) index = row;
      last.push(bytes[(start + n - 1) % n]);
    });
    return { last: last, index: index };
  }

  function compareRotations(bytes, a, b) {
    const n = bytes.length;

    for (let i = 0; i < n; i += 1) {
      const x = bytes[(a + i) % n];
      const y = bytes[(b + i) % n];

      if (x !== y) return x - y;
    }
    return a - b;
  }

  /**
   * The inverse, by the standard LF-mapping: the first column is the last
   * column sorted, and the i-th occurrence of a character in the last column
   * corresponds to the i-th occurrence in the first. That correspondence is the
   * whole trick, and it is why a permutation this aggressive is still
   * invertible from one extra integer.
   */
  function inverse(last, index) {
    const n = last.length;

    if (n === 0) return [];
    const counts = new Array(256).fill(0);

    last.forEach(function (byte) { counts[byte] += 1; });
    const before = new Array(256).fill(0);

    for (let symbol = 1; symbol < 256; symbol += 1) {
      before[symbol] = before[symbol - 1] + counts[symbol - 1];
    }
    const seen = new Array(256).fill(0);
    const next = new Array(n);

    for (let row = 0; row < n; row += 1) {
      next[before[last[row]] + seen[last[row]]] = row;
      seen[last[row]] += 1;
    }
    const out = [];
    let row = next[index];

    for (let i = 0; i < n; i += 1) {
      out.push(last[row]);
      row = next[row];
    }
    return out;
  }

  /* ---------------------------------------------------------------- MTF */

  /**
   * Move-to-front. The list starts as 0..255 in order and the symbol just
   * emitted moves to the front, so a locally repetitive stream becomes a stream
   * of small numbers — and a run of one symbol becomes a run of zeros, which is
   * exactly what the next two stages are good at.
   */
  function moveToFront(bytes) {
    const list = [];

    for (let i = 0; i < 256; i += 1) list.push(i);
    const out = [];

    bytes.forEach(function (byte) {
      const at = list.indexOf(byte);

      out.push(at);
      list.splice(at, 1);
      list.unshift(byte);
    });
    return out;
  }

  function inverseMoveToFront(indices) {
    const list = [];

    for (let i = 0; i < 256; i += 1) list.push(i);
    const out = [];

    indices.forEach(function (at) {
      const byte = list[at];

      out.push(byte);
      list.splice(at, 1);
      list.unshift(byte);
    });
    return out;
  }

  /* ---------------------------------------------------------------- RLE */

  /**
   * Run-length coding of zeros only, which is what bzip2 does at this stage:
   * after MTF the stream is dominated by zeros and coding every run of every
   * symbol would cost more than it saves. A run of k zeros becomes a (0, k)
   * pair; everything else passes through shifted by one so the marker cannot
   * collide with a real symbol.
   */
  function runLengthZeros(indices) {
    const out = [];
    let run = 0;

    indices.forEach(function (value) {
      if (value === 0) {
        run += 1;
        return;
      }
      if (run > 0) {
        out.push({ zeros: run });
        run = 0;
      }
      out.push({ value: value });
    });
    if (run > 0) out.push({ zeros: run });
    return out;
  }

  function inverseRunLength(tokens) {
    const out = [];

    tokens.forEach(function (token) {
      if (token.zeros !== undefined) {
        for (let i = 0; i < token.zeros; i += 1) out.push(0);
        return;
      }
      out.push(token.value);
    });
    return out;
  }

  /** The token stream as symbols an entropy coder can count: a zero run is
   *  coded as its length in a separate part of the alphabet. */
  function flatten(tokens) {
    const out = [];

    tokens.forEach(function (token) {
      if (token.zeros !== undefined) {
        out.push(256 + Math.min(63, token.zeros));
        return;
      }
      out.push(token.value);
    });
    return out;
  }

  /* ----------------------------------------------------------- pipeline */

  /**
   * Every stage with its size and order-0 entropy, so the reader can see where
   * the gain occurs. BWT changes neither — its output is a permutation, and a
   * permutation has exactly the same symbol counts as its input.
   */
  function pipeline(bytes, entropyOf) {
    const stages = [];
    const record = function (name, symbols, note) {
      stages.push({ name: name, length: symbols.length,
        bits: entropyOf(symbols), note: note,
        bytes: Math.ceil(entropyOf(symbols) * symbols.length / 8) });
    };

    record('input', bytes, 'the original bytes');
    const transformed = transform(bytes);

    record('after BWT', transformed.last,
      'a permutation: same length, same symbol counts, same order-0 entropy');
    const mtf = moveToFront(transformed.last);

    record('after MTF', mtf, 'runs become zeros, and the entropy finally falls');
    const rle = runLengthZeros(mtf);
    const flat = flatten(rle);

    record('after RLE', flat, 'zero runs collapse into single symbols');
    return { stages: stages, transformed: transformed, mtf: mtf, rle: rle, flat: flat };
  }

  /** The whole chain, inverted, so the pipeline can be asserted rather than
   *  believed. */
  function roundTrip(bytes) {
    const transformed = transform(bytes);
    const mtf = moveToFront(transformed.last);
    const rle = runLengthZeros(mtf);
    const back = inverseMoveToFront(inverseRunLength(rle));

    return inverse(back, transformed.index);
  }

  /** How much of the output is zeros after MTF — the number that says whether
   *  the transform found anything. */
  function zeroShare(mtf) {
    if (mtf.length === 0) return 0;
    let zeros = 0;

    mtf.forEach(function (value) { if (value === 0) zeros += 1; });
    return zeros / mtf.length;
  }

  /**
   * Block size is the pipeline's one real parameter. A bigger block finds more
   * context and costs O(n log n) sorting plus the memory to hold it; bzip2 caps
   * it at 900 KB for exactly that reason, and the ratio gain past a few hundred
   * kilobytes is small.
   */
  function blockSweep(bytes, sizes, entropyOf) {
    return sizes.map(function (size) {
      let bits = 0;
      let zeros = 0;
      let total = 0;

      for (let at = 0; at < bytes.length; at += size) {
        const block = bytes.slice(at, Math.min(bytes.length, at + size));
        const mtf = moveToFront(transform(block).last);

        bits += entropyOf(mtf) * mtf.length;
        zeros += Math.round(zeroShare(mtf) * mtf.length);
        total += mtf.length;
      }
      return { block: size, blocks: Math.ceil(bytes.length / size),
        bytes: Math.ceil(bits / 8), bitsPerSymbol: total === 0 ? 0 : bits / total,
        zeroShare: total === 0 ? 0 : zeros / total,
        ratio: bytes.length === 0 ? 1 : bytes.length / Math.max(1, Math.ceil(bits / 8)) };
    });
  }

  return {
    transform: transform, inverse: inverse,
    moveToFront: moveToFront, inverseMoveToFront: inverseMoveToFront,
    runLengthZeros: runLengthZeros, inverseRunLength: inverseRunLength, flatten: flatten,
    pipeline: pipeline, roundTrip: roundTrip, zeroShare: zeroShare, blockSweep: blockSweep
  };
}));

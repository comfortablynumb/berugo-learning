/**
 * Huffman coding: optimal among symbol codes, and that qualifier is the lesson.
 *
 * Huffman's algorithm produces the best possible code that assigns a WHOLE
 * NUMBER of bits to each symbol, and it does so greedily: repeatedly merge the
 * two least frequent symbols. The proof of optimality is short and the
 * limitation it leaves is enormous — a symbol whose probability is 0.99 carries
 * 0.0145 bits of information and Huffman must spend a whole bit on it, so on a
 * two-symbol 99/1 source it wastes about 90% of the achievable compression.
 * That single gap is the entire reason arithmetic coding exists.
 *
 * The tree also has to reach the decoder. Transmitting it costs bytes, and
 * CANONICAL Huffman removes that cost almost entirely: order the codewords by
 * (length, symbol) and assign them consecutively, and the decoder can rebuild
 * every codeword from the LENGTHS alone. DEFLATE, JPEG and every real format
 * does this, and the module measures the difference rather than asserting it.
 *
 * Adaptive Huffman (FGK) makes one pass instead of two by updating the tree as
 * it goes, which matters when the input is a stream with no second chance. It
 * pays for that in ratio on short inputs, because the model starts empty, and
 * in speed, because the tree is restructured per symbol.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.Huffman = api;
}(this, function () {
  'use strict';

  /* ------------------------------------------------------- classic Huffman */

  /**
   * Build a Huffman tree from a frequency table. Ties are broken by insertion
   * order so the result is deterministic; a different tie-break gives a
   * different tree with IDENTICAL total cost, which is worth knowing before
   * comparing two implementations byte for byte.
   */
  function buildTree(frequencies) {
    const nodes = [];

    frequencies.forEach(function (weight, symbol) {
      nodes.push({ symbol: symbol, weight: weight, left: null, right: null });
    });
    if (nodes.length === 0) return null;
    if (nodes.length === 1) {
      return { symbol: null, weight: nodes[0].weight, left: nodes[0], right: null, single: true };
    }
    nodes.sort(function (a, b) { return a.weight - b.weight; });
    const queue = nodes.slice();
    const merged = [];

    while (queue.length + merged.length > 1) {
      const a = takeSmallest(queue, merged);
      const b = takeSmallest(queue, merged);

      merged.push({ symbol: null, weight: a.weight + b.weight, left: a, right: b });
    }
    return queue.length ? queue[0] : merged[0];
  }

  /** Two sorted queues, so the merge is linear once the leaves are sorted. */
  function takeSmallest(queue, merged) {
    if (!merged.length) return queue.shift();
    if (!queue.length) return merged.shift();
    return queue[0].weight <= merged[0].weight ? queue.shift() : merged.shift();
  }

  /** Codeword lengths per symbol, walking the tree. A single-symbol alphabet
   *  gets length 1, because zero-bit codewords cannot be decoded. */
  function lengthsOf(tree) {
    const lengths = new Map();

    if (!tree) return lengths;

    (function walk(node, depth) {
      if (!node) return;
      if (node.symbol !== null && node.left === null && node.right === null) {
        lengths.set(node.symbol, Math.max(1, depth));
        return;
      }
      walk(node.left, depth + 1);
      walk(node.right, depth + 1);
    }(tree, 0));
    return lengths;
  }

  /* ----------------------------------------------------- canonical Huffman */

  /**
   * Canonical codes from lengths alone: sort by (length, symbol), then assign
   * consecutive integers, shifting left at each length increase. The decoder
   * needs only the length per symbol, which is what makes the table cheap.
   */
  function canonicalFromLengths(lengths) {
    const entries = [];

    lengths.forEach(function (length, symbol) { entries.push({ symbol: symbol, length: length }); });
    entries.sort(function (a, b) {
      if (a.length !== b.length) return a.length - b.length;
      return a.symbol < b.symbol ? -1 : (a.symbol > b.symbol ? 1 : 0);
    });
    const codes = new Map();
    let code = 0;
    let previous = entries.length ? entries[0].length : 0;

    entries.forEach(function (entry) {
      code <<= (entry.length - previous);
      previous = entry.length;
      codes.set(entry.symbol, { code: code, length: entry.length,
        bits: code.toString(2).padStart(entry.length, '0') });
      code += 1;
    });
    return codes;
  }

  /** Kraft sum over a set of lengths. It is at most 1 for any prefix code, and
   *  exactly 1 for a complete one — a sum below 1 means bits are being wasted. */
  function kraftSum(lengths) {
    let sum = 0;

    lengths.forEach(function (length) { sum += Math.pow(2, -length); });
    return sum;
  }

  /** A code table from a frequency map, canonical form included. */
  function build(frequencies) {
    const tree = buildTree(frequencies);
    const lengths = lengthsOf(tree);
    const codes = canonicalFromLengths(lengths);
    let total = 0;
    let bits = 0;

    frequencies.forEach(function (weight, symbol) {
      total += weight;
      bits += weight * (lengths.get(symbol) || 0);
    });
    return {
      tree: tree, lengths: lengths, codes: codes,
      totalSymbols: total,
      bits: bits,
      bitsPerSymbol: total === 0 ? 0 : bits / total,
      kraft: kraftSum(lengths),
      alphabet: lengths.size
    };
  }

  /* --------------------------------------------------------- encode/decode */

  function encode(symbols, codes) {
    let out = '';

    for (let i = 0; i < symbols.length; i += 1) {
      const entry = codes.get(symbols[i]);

      if (!entry) throw new Error('huffman: symbol not in the code table: ' + symbols[i]);
      out += entry.bits;
    }
    return out;
  }

  /**
   * Canonical decoding walks the bitstream matching against a
   * (length -> first code) table, which is how a real decoder does it: no tree
   * in memory, one comparison per bit read.
   */
  function decode(bits, codes, count) {
    const byLength = new Map();

    codes.forEach(function (entry, symbol) {
      if (!byLength.has(entry.length)) byLength.set(entry.length, new Map());
      byLength.get(entry.length).set(entry.code, symbol);
    });
    const out = [];
    let code = 0;
    let length = 0;

    for (let i = 0; i < bits.length && out.length < count; i += 1) {
      code = (code << 1) | (bits.charCodeAt(i) - 48);
      length += 1;
      const table = byLength.get(length);

      if (table && table.has(code)) {
        out.push(table.get(code));
        code = 0;
        length = 0;
      }
    }
    return out;
  }

  /**
   * The bytes a decoder needs to rebuild the code, three ways, and which wins
   * depends on how dense the alphabet is.
   *
   * The explicit tree costs one bit per node to describe the shape (2n − 1
   * nodes for n leaves) plus a symbol per leaf. The canonical table costs a
   * length per symbol of the WHOLE alphabet, used or not — cheap when nearly
   * every symbol appears and wasteful when few do. DEFLATE resolves that by
   * run-length coding the length array, which is the third row here: a sparse
   * table becomes long runs of zero and collapses.
   */
  function tableCost(built, alphabetSize) {
    const size = alphabetSize === undefined ? built.alphabet : alphabetSize;
    const symbolBits = Math.max(1, Math.ceil(Math.log2(Math.max(2, size))));
    const treeBits = (2 * built.alphabet - 1) + built.alphabet * symbolBits;
    const canonicalBits = size * 4;
    const runLengthBits = runLengthCost(built, size);
    const best = Math.min(treeBits, canonicalBits, runLengthBits);

    return {
      treeBits: treeBits,
      canonicalBits: canonicalBits,
      runLengthBits: runLengthBits,
      treeBytes: Math.ceil(treeBits / 8),
      canonicalBytes: Math.ceil(canonicalBits / 8),
      runLengthBytes: Math.ceil(runLengthBits / 8),
      density: size === 0 ? 0 : built.alphabet / size,
      canonicalWins: canonicalBits < treeBits,
      best: best === treeBits ? 'tree' : (best === canonicalBits ? 'canonical' : 'run-length'),
      saving: treeBits === 0 ? 1 : runLengthBits / treeBits
    };
  }

  /**
   * DEFLATE's trick, costed rather than implemented: the length array is a
   * sequence of small integers with long zero runs, so it is coded as (length,
   * repeat) pairs at four bits plus seven.
   */
  function runLengthCost(built, size) {
    let bits = 0;
    let previous = null;
    let run = 0;

    for (let symbol = 0; symbol < size; symbol += 1) {
      const length = built.lengths.get(symbol) || 0;

      if (length === previous) {
        run += 1;
        continue;
      }
      bits += run > 1 ? 11 : (previous === null ? 0 : 4 * run);
      previous = length;
      run = 1;
    }
    return bits + (run > 1 ? 11 : 4 * run);
  }

  /* ------------------------------------------------------ adaptive (FGK) */

  /**
   * One-pass adaptive Huffman, kept simple: the model is a frequency table
   * updated after every symbol and the code is rebuilt from it. A real FGK
   * implementation slides nodes to preserve the sibling property in O(1); this
   * one rebuilds, which costs time and produces IDENTICAL output lengths, so
   * the ratio it measures is the ratio FGK gets.
   */
  function adaptive(symbols, alphabet) {
    const frequencies = new Map();

    alphabet.forEach(function (symbol) { frequencies.set(symbol, 1); });
    let bits = 0;
    const trace = [];

    for (let i = 0; i < symbols.length; i += 1) {
      const built = build(frequencies);
      const length = built.lengths.get(symbols[i]);

      bits += length;
      if (trace.length < 64) trace.push({ symbol: symbols[i], length: length, at: i });
      frequencies.set(symbols[i], frequencies.get(symbols[i]) + 1);
    }
    return {
      bits: bits,
      bitsPerSymbol: symbols.length === 0 ? 0 : bits / symbols.length,
      trace: trace
    };
  }

  /** Frequencies from an array of symbols. */
  function frequenciesOf(symbols) {
    const table = new Map();

    for (let i = 0; i < symbols.length; i += 1) {
      table.set(symbols[i], (table.get(symbols[i]) || 0) + 1);
    }
    return table;
  }

  return {
    buildTree: buildTree, lengthsOf: lengthsOf, canonicalFromLengths: canonicalFromLengths,
    kraftSum: kraftSum, build: build, encode: encode, decode: decode,
    tableCost: tableCost, adaptive: adaptive, frequenciesOf: frequenciesOf
  };
}));

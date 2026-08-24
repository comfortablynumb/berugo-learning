/**
 * The coding bench: entropy, symbol codes, arithmetic coding, dictionaries and
 * context models, each measured against the floor it is trying to reach.
 *
 * One rule runs through all of it. A compressed size is never reported alone —
 * it is reported beside the entropy of a stated model, because "1 200 bytes" is
 * meaningless and "1 200 bytes against a floor of 1 141" is a result. Which
 * model that floor comes from is the argument the whole milestone is about: an
 * order-0 coder is measured against order-0 entropy and looks excellent, and
 * the same file measured against an order-3 model shows how much it left on the
 * table.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.CodingLab = api;
}(this, function (root) {
  'use strict';

  const Entropy = root && root.Entropy ? root.Entropy : require('../algorithms/entropy.js');
  const Huffman = root && root.Huffman ? root.Huffman : require('../algorithms/huffman.js');
  const Arithmetic = root && root.ArithmeticCoder ? root.ArithmeticCoder
    : require('../algorithms/arithmetic-coder.js');
  const Lz = root && root.Lz ? root.Lz : require('../algorithms/lz.js');
  const Context = root && root.ContextModel ? root.ContextModel
    : require('../algorithms/context-model.js');
  const Bwt = root && root.BwtPipeline ? root.BwtPipeline
    : require('../algorithms/bwt-pipeline.js');
  const CodecLab = root && root.CodecLab ? root.CodecLab : require('./codec-lab.js');
  const Random = root && root.Random ? root.Random : require('../utils/random.js');

  function bytesOf(name, size) {
    const found = CodecLab.corpora({ size: size }).filter(function (corpus) {
      return corpus.name === name;
    });

    if (!found.length) throw new Error('coding-lab: no corpus named ' + name);
    return found[0];
  }

  /* ------------------------------------------------------ 22.1 entropy */

  /**
   * The entropy profile of a corpus at rising model order, with the two
   * numbers that say when the estimate has stopped meaning anything: how many
   * contexts were seen, and how many observations each got. A high-order
   * estimate on a short input is memorisation, and it reports an entropy near
   * zero while learning nothing.
   */
  function entropyStudy(options) {
    const settings = options || {};
    const size = settings.size === undefined ? 3000 : settings.size;
    const maxOrder = settings.maxOrder === undefined ? 4 : settings.maxOrder;
    const corpus = bytesOf(settings.corpus === undefined ? 'English text' : settings.corpus, size);
    const rows = Entropy.profile(corpus.bytes, maxOrder).map(function (row) {
      return {
        order: row.order, bits: row.bits, contexts: row.contexts,
        perContext: row.perContext, reliable: row.reliable !== false,
        floorBytes: Entropy.floorBytes(row.bits, corpus.bytes.length)
      };
    });

    return {
      corpus: corpus.name, note: corpus.note, bytes: corpus.bytes.length,
      distinct: Entropy.order0(corpus.bytes).distinct,
      rows: rows,
      mutual: Entropy.mutualInformation(corpus.bytes)
    };
  }

  /** Every corpus at order 0 and order 2, so the redundancy an order-0 coder
   *  cannot reach is visible per data type. */
  function entropyByCorpus(options) {
    const settings = options || {};
    const size = settings.size === undefined ? 3000 : settings.size;

    return CodecLab.corpora({ size: size }).map(function (corpus) {
      const zero = Entropy.order0(corpus.bytes);
      const two = Entropy.orderK(corpus.bytes, 2);

      return {
        corpus: corpus.name, note: corpus.note, distinct: zero.distinct,
        order0: zero.bits, order2: two.bits,
        redundancy: zero.bits - two.bits,
        contexts: two.contexts, perContext: two.perContext,
        order0Floor: Entropy.floorBytes(zero.bits, corpus.bytes.length),
        order2Floor: Entropy.floorBytes(two.bits, corpus.bytes.length),
        bytes: corpus.bytes.length
      };
    });
  }

  /** Synthetic sources whose entropy is known in closed form, so the estimator
   *  can be checked rather than trusted. */
  function estimatorCheck(options) {
    const settings = options || {};
    const length = settings.length === undefined ? 20000 : settings.length;
    const rows = [];

    [0.5, 0.25, 0.1, 0.01].forEach(function (p) {
      const rng = Random.seeded(Math.round(p * 1000) + 1);
      const measured = Entropy.order0(Entropy.biasedCoin(length, p, rng)).bits;

      rows.push({ source: 'biased coin p=' + p, truth: Entropy.binaryEntropy(p),
        measured: measured, error: Math.abs(measured - Entropy.binaryEntropy(p)) });
    });
    [[4, 0.8], [8, 0.6]].forEach(function (spec) {
      const rng = Random.seeded(spec[0] * 13 + 5);
      const chain = Entropy.markovChain(length, spec[0], spec[1], rng);
      const truth = Entropy.markovEntropy(spec[0], spec[1]);
      const measured = Entropy.orderK(chain, 1).bits;

      rows.push({ source: 'Markov ' + spec[0] + ' states, stay ' + spec[1],
        truth: truth, measured: measured, error: Math.abs(measured - truth),
        order0: Entropy.order0(chain).bits });
    });
    return { length: length, rows: rows };
  }

  /* ------------------------------------------------------ 22.2 Huffman */

  /**
   * Huffman against the entropy on a chosen corpus, plus the three ways of
   * transmitting the table. The gap column is the whole-bit penalty: it is
   * small on a large alphabet and enormous on a skewed small one.
   */
  function huffmanStudy(options) {
    const settings = options || {};
    const size = settings.size === undefined ? 3000 : settings.size;
    const corpus = bytesOf(settings.corpus === undefined ? 'English text' : settings.corpus, size);
    const entropy = Entropy.order0(corpus.bytes);
    const built = Huffman.build(Huffman.frequenciesOf(corpus.bytes));
    const encoded = Huffman.encode(corpus.bytes, built.codes);
    const decoded = Huffman.decode(encoded, built.codes, corpus.bytes.length);
    const table = Huffman.tableCost(built, 256);

    return {
      corpus: corpus.name, bytes: corpus.bytes.length,
      entropy: entropy.bits, alphabet: built.alphabet,
      bitsPerSymbol: built.bitsPerSymbol,
      overEntropy: built.bitsPerSymbol - entropy.bits,
      kraft: built.kraft, table: table,
      roundTrip: sameBytes(decoded, corpus.bytes),
      payloadBytes: Math.ceil(encoded.length / 8),
      totalBytes: Math.ceil((encoded.length + table.runLengthBits) / 8),
      codes: codeRows(built, Huffman.frequenciesOf(corpus.bytes), corpus.bytes.length),
      segments: segmentsFor(corpus.bytes, built, 24)
    };
  }

  /**
   * The code table as rows: the codeword each symbol got, the bits it spends
   * and the bits its own probability says it carries. The last column is the
   * whole-bit penalty, per symbol, and it is where a skewed alphabet's waste
   * becomes visible.
   */
  function codeRows(built, frequencies, total) {
    const rows = [];

    built.codes.forEach(function (entry, symbol) {
      const count = frequencies.get(symbol) || 0;
      const probability = count / Math.max(1, total);

      rows.push({ symbol: symbol, label: labelFor(symbol), length: entry.length,
        code: entry.bits, count: count, probability: probability,
        ideal: probability > 0 ? -Math.log2(probability) : 0,
        waste: entry.length - (probability > 0 ? -Math.log2(probability) : 0) });
    });
    rows.sort(function (a, b) { return b.count - a.count || a.symbol - b.symbol; });
    return rows;
  }

  function labelFor(symbol) {
    if (symbol === 32) return 'space';
    if (symbol === 10) return '\\n';
    if (symbol >= 33 && symbol <= 126) return String.fromCharCode(symbol);
    return '0x' + symbol.toString(16);
  }

  /** The first n symbols as bitstream segments, for the attribution view. */
  function segmentsFor(bytes, built, count) {
    const out = [];

    for (let i = 0; i < Math.min(count, bytes.length); i += 1) {
      const entry = built.codes.get(bytes[i]);

      out.push({ label: labelFor(bytes[i]), bits: entry.bits });
    }
    return out;
  }

  /**
   * The two-symbol source Huffman cannot code well, swept over the skew. At
   * 99/1 the entropy is 0.08 bits and Huffman spends 1.00, which is the twelve-
   * fold waste that arithmetic coding exists to remove.
   */
  function skewSweep(options) {
    const settings = options || {};
    const size = settings.size === undefined ? 2000 : settings.size;
    const shares = settings.shares || [0.5, 0.25, 0.1, 0.05, 0.01, 0.001];

    return shares.map(function (share) {
      const bytes = [];

      for (let i = 0; i < size; i += 1) bytes.push(i % Math.round(1 / share) === 0 ? 66 : 65);
      const entropy = Entropy.order0(bytes).bits;
      const built = Huffman.build(Huffman.frequenciesOf(bytes));
      const alphabet = [65, 66];
      const model = Arithmetic.model(Huffman.frequenciesOf(bytes), alphabet);
      const arithmetic = Arithmetic.encode(bytes, model);

      return {
        share: share, entropy: entropy,
        huffmanBits: built.bitsPerSymbol,
        arithmeticBits: arithmetic.length / bytes.length,
        waste: entropy === 0 ? Infinity : built.bitsPerSymbol / entropy,
        arithmeticWaste: entropy === 0 ? Infinity : (arithmetic.length / bytes.length) / entropy
      };
    });
  }

  /* --------------------------------------------- 22.3 arithmetic and ANS */

  /**
   * The interval walk for a short message, the integer coder's output for the
   * whole corpus, and rANS beside it. The three should agree to within a couple
   * of bits per message and the ways they differ are the interesting part:
   * rANS pays a 32-bit state flush and a quantised model, arithmetic pays two
   * termination bits.
   */
  function arithmeticStudy(options) {
    const settings = options || {};
    const size = settings.size === undefined ? 3000 : settings.size;
    const corpus = bytesOf(settings.corpus === undefined ? 'English text' : settings.corpus, size);
    const alphabet = alphabetOf(corpus.bytes);
    const frequencies = Huffman.frequenciesOf(corpus.bytes);
    const model = Arithmetic.model(frequencies, alphabet);
    const encoded = Arithmetic.encode(corpus.bytes, model);
    const decoded = Arithmetic.decode(encoded.bits, model, corpus.bytes.length);
    const ideal = Arithmetic.idealBits(corpus.bytes, model);
    const ransModel = Arithmetic.ransModel(frequencies, alphabet, 12);
    const rans = Arithmetic.ransEncode(corpus.bytes, ransModel);
    const ransBack = Arithmetic.ransDecode(rans, ransModel, corpus.bytes.length);
    const built = Huffman.build(frequencies);

    return {
      corpus: corpus.name, bytes: corpus.bytes.length,
      entropy: Entropy.order0(corpus.bytes).bits,
      idealBits: ideal,
      arithmetic: { bits: encoded.length, roundTrip: sameBytes(decoded, corpus.bytes),
        overIdeal: encoded.length - ideal, maxPending: encoded.maxPending,
        bitsPerSymbol: encoded.length / corpus.bytes.length },
      rans: { bits: rans.bits, roundTrip: sameBytes(ransBack, corpus.bytes),
        overIdeal: rans.bits - ideal, bytes: rans.bytes.length,
        bitsPerSymbol: rans.bits / corpus.bytes.length },
      huffman: { bits: built.bits, bitsPerSymbol: built.bitsPerSymbol,
        overIdeal: built.bits - ideal },
      adaptive: Arithmetic.adaptiveCost(corpus.bytes, alphabet)
    };
  }

  /** The interval narrowing for a short word, which is the picture. */
  function intervalWalk(text, options) {
    const settings = options || {};
    const bytes = CodecLab.toBytes(text);
    const alphabet = alphabetOf(bytes);
    const model = Arithmetic.model(Huffman.frequenciesOf(bytes), alphabet);
    const encoded = Arithmetic.encode(bytes, model);
    let low = 0;
    let high = 1;
    const steps = [];

    bytes.forEach(function (byte) {
      const at = model.index.get(byte);
      const width = high - low;

      high = low + width * model.cumulative[at + 1] / model.total;
      low = low + width * model.cumulative[at] / model.total;
      steps.push({ symbol: labelFor(byte), low: low, high: high, width: high - low,
        bits: -Math.log2(high - low) });
    });
    return { text: text, steps: steps, bits: encoded.length,
      ideal: settings.ideal === undefined ? Arithmetic.idealBits(bytes, model) : settings.ideal };
  }

  /* ------------------------------------------------- 22.4 dictionaries */

  /** LZ77 over a corpus: the depth ladder, the window ladder and LZW beside
   *  them, all round-trip checked. */
  function dictionaryStudy(options) {
    const settings = options || {};
    const size = settings.size === undefined ? 3000 : settings.size;
    const corpus = bytesOf(settings.corpus === undefined ? 'English text' : settings.corpus, size);
    const depths = settings.depths || [1, 2, 4, 8, 16, 32, 64];
    const windows = settings.windows || [64, 256, 1024, 4096];
    const base = Lz.compress(corpus.bytes, { window: 4096, depth: 32 });
    const lazy = Lz.compress(corpus.bytes, { window: 4096, depth: 32, lazy: true });
    const lzw = Lz.lzwCompress(corpus.bytes);

    return {
      corpus: corpus.name, bytes: corpus.bytes.length,
      depths: Lz.depthSweep(corpus.bytes, depths, { window: 4096 }),
      windows: Lz.windowSweep(corpus.bytes, windows, { depth: 32 }),
      base: { bytes: base.bytes, ratio: base.ratio, matches: base.matches,
        literals: base.literals, matchedBytes: base.matchedBytes,
        roundTrip: sameBytes(Lz.decompress(base.tokens), corpus.bytes) },
      lazy: { bytes: lazy.bytes, ratio: lazy.ratio, matches: lazy.matches,
        gain: base.bytes / lazy.bytes,
        roundTrip: sameBytes(Lz.decompress(lazy.tokens), corpus.bytes) },
      lzw: { bytes: lzw.bytes, ratio: lzw.ratio, entries: lzw.entries,
        codeBits: lzw.codeBits,
        roundTrip: sameBytes(Lz.lzwDecompress(lzw.codes), corpus.bytes) },
      tokens: base.tokens.slice(0, 40)
    };
  }

  /* ------------------------------------------------ 22.6 context models */

  /** Order-k models, PPM and a mixture over the same corpus. */
  function contextStudy(options) {
    const settings = options || {};
    const size = settings.size === undefined ? 1500 : settings.size;
    const maxOrder = settings.maxOrder === undefined ? 4 : settings.maxOrder;
    const corpus = bytesOf(settings.corpus === undefined ? 'English text' : settings.corpus, size);
    const mapped = remap(corpus.bytes);
    const orders = Context.orderSweep(mapped.symbols, maxOrder, mapped.size);
    const ppm = [];

    for (let order = 1; order <= maxOrder; order += 1) {
      ppm.push(Context.ppm(mapped.symbols, order, mapped.size));
    }
    return {
      corpus: corpus.name, bytes: corpus.bytes.length, alphabet: mapped.size,
      entropy: Entropy.order0(corpus.bytes).bits,
      orders: orders, ppm: ppm,
      mixed: Context.mixedCost(mapped.symbols, settings.mix || [0, 1, 2, 3], mapped.size)
    };
  }

  /** Contiguous symbol indices, because an order-k model's cost is linear in
   *  the alphabet size and 256 mostly-unused symbols distort every number. */
  function remap(bytes) {
    const alphabet = alphabetOf(bytes);
    const index = new Map();

    alphabet.forEach(function (byte, i) { index.set(byte, i); });
    return { symbols: bytes.map(function (byte) { return index.get(byte); }),
      size: alphabet.length, alphabet: alphabet };
  }

  /* ----------------------------------------------------- 22.7 transform */

  /** The bzip2 chain stage by stage, plus the block-size ladder. */
  function transformStudy(options) {
    const settings = options || {};
    const size = settings.size === undefined ? 2000 : settings.size;
    const corpus = bytesOf(settings.corpus === undefined ? 'English text' : settings.corpus, size);
    const entropyOf = function (symbols) { return Entropy.order0(symbols).bits; };
    const run = Bwt.pipeline(corpus.bytes, entropyOf);

    return {
      corpus: corpus.name, bytes: corpus.bytes.length,
      stages: run.stages,
      zeroShare: Bwt.zeroShare(run.mtf),
      roundTrip: sameBytes(Bwt.roundTrip(corpus.bytes), corpus.bytes),
      blocks: Bwt.blockSweep(corpus.bytes, settings.blocks || [64, 256, 1024, 4096], entropyOf),
      sample: {
        input: corpus.bytes.slice(0, 48),
        transformed: run.transformed.last.slice(0, 48),
        mtf: run.mtf.slice(0, 48)
      }
    };
  }

  function alphabetOf(bytes) {
    return Array.from(new Set(bytes)).sort(function (a, b) { return a - b; });
  }

  function sameBytes(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  return {
    entropyStudy: entropyStudy, entropyByCorpus: entropyByCorpus,
    estimatorCheck: estimatorCheck,
    huffmanStudy: huffmanStudy, skewSweep: skewSweep,
    arithmeticStudy: arithmeticStudy, intervalWalk: intervalWalk,
    dictionaryStudy: dictionaryStudy, contextStudy: contextStudy,
    transformStudy: transformStudy,
    labelFor: labelFor, remap: remap
  };
}));

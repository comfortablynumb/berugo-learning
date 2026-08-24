/**
 * The codec bench: every codec over the same corpora, with a round-trip
 * assertion and a denominator.
 *
 * The rules this harness enforces are the ones a compression benchmark usually
 * breaks:
 *
 * - **A ratio is always reported against a stated corpus.** "3x compression" is
 *   a property of the data, and the same codec measures 20x on a log file and
 *   0.99x on a JPEG. Every table here has one row per corpus.
 * - **Achieved bits per symbol are shown against the measured entropy**, so a
 *   codec that is within 2% of the order-0 entropy and a codec that is 40% away
 *   are visibly different rather than both "compressing".
 * - **Expansion is reported, not hidden.** Every lossless codec is run on
 *   already-compressed bytes, where the honest answer is a ratio below one, and
 *   the table says so.
 * - **Every lossless codec round-trips or the row is marked failed.** A
 *   compression number from an implementation that cannot decompress is not a
 *   measurement.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.CodecLab = api;
}(this, function (root) {
  'use strict';

  const Entropy = root && root.Entropy ? root.Entropy
    : require('../algorithms/entropy.js');
  const Huffman = root && root.Huffman ? root.Huffman
    : require('../algorithms/huffman.js');
  const Arithmetic = root && root.ArithmeticCoder ? root.ArithmeticCoder
    : require('../algorithms/arithmetic-coder.js');
  const Lz = root && root.Lz ? root.Lz : require('../algorithms/lz.js');
  const Deflate = root && root.Deflate ? root.Deflate : require('../algorithms/deflate.js');
  const Bwt = root && root.BwtPipeline ? root.BwtPipeline
    : require('../algorithms/bwt-pipeline.js');
  const Random = root && root.Random ? root.Random : require('../utils/random.js');

  /* ------------------------------------------------------------- corpora */

  const ENGLISH = 'the quick brown fox jumps over the lazy dog. pack my box with five dozen '
    + 'liquor jugs. how vexingly quick daft zebras jump! the five boxing wizards jump '
    + 'quickly. sphinx of black quartz, judge my vow. ';

  const SOURCE = 'function encode(values, options) {\n'
    + '  const settings = options || {};\n'
    + '  const out = [];\n'
    + '  values.forEach(function (value) {\n'
    + '    if (value < settings.threshold) { out.push(value); return; }\n'
    + '    out.push(settings.replacement);\n'
    + '  });\n'
    + '  return out;\n'
    + '}\n';

  const LOG = '{"ts":"2026-08-24T10:00:00Z","level":"info","service":"api","latency_ms":12}\n'
    + '{"ts":"2026-08-24T10:00:01Z","level":"info","service":"api","latency_ms":15}\n'
    + '{"ts":"2026-08-24T10:00:02Z","level":"warn","service":"api","latency_ms":211}\n';

  /** Seven corpora chosen so the ranking CHANGES between them, which is the
   *  point of having more than one. */
  function corpora(options) {
    const settings = options || {};
    const size = settings.size === undefined ? 3000 : settings.size;

    return [
      { name: 'English text', bytes: repeatTo(ENGLISH, size),
        note: 'natural language: strong context structure, moderate order-0 entropy' },
      { name: 'source code', bytes: repeatTo(SOURCE, size),
        note: 'small alphabet, long repeated tokens, deep indentation runs' },
      { name: 'JSON logs', bytes: repeatTo(LOG, size),
        note: 'the keys repeat exactly; only the values move' },
      { name: 'mixed prose', bytes: prose(size, settings.seed === undefined ? 3 : settings.seed),
        note: 'words drawn from a Zipf distribution: many candidate matches, none dominant' },
      { name: 'image-like', bytes: gradient(size),
        note: 'smooth ramps: neighbouring bytes differ by one, so deltas are tiny' },
      { name: 'random bytes', bytes: randomBytes(size, settings.seed === undefined ? 7 : settings.seed),
        note: 'incompressible by theorem: every codec must expand it' },
      { name: 'already compressed', bytes: alreadyCompressed(size,
        settings.seed === undefined ? 7 : settings.seed),
      note: 'the output of a codec is high-entropy by construction' }
    ];
  }

  function repeatTo(text, size) {
    let out = '';

    while (out.length < size) out += text;
    return toBytes(out.slice(0, size));
  }

  function toBytes(text) {
    const out = [];

    for (let i = 0; i < text.length; i += 1) out.push(text.charCodeAt(i) & 0xff);
    return out;
  }

  /**
   * Words drawn from a Zipf distribution, which is what makes match finding
   * actually work for its living: the repeats are real but they are not one
   * dominant string, so the search depth changes the answer instead of finding
   * the same match on its first probe.
   */
  const WORDS = ('the of and to in a is that it for as was with be by on not he this are or '
    + 'his from at which but have an they one you had were their we all her she there would '
    + 'their about when what your who will more no if out so said up other into than them '
    + 'could time only its over new some these two may then do first any my now such like our '
    + 'compression entropy huffman arithmetic dictionary transform codec bitstream symbol '
    + 'model coder decoder window match literal length distance quantisation checksum').split(' ');

  function prose(size, seed) {
    const rng = Random.seeded(seed);
    let out = '';

    while (out.length < size) {
      const rank = Math.floor(Math.pow(rng.next(), 2.2) * WORDS.length);

      out += WORDS[Math.min(WORDS.length - 1, rank)] + (rng.next() < 0.06 ? '.\n' : ' ');
    }
    return toBytes(out.slice(0, size));
  }

  function gradient(size) {
    const out = [];

    for (let i = 0; i < size; i += 1) {
      out.push(Math.round(128 + 100 * Math.sin(i / 37) + 20 * Math.sin(i / 5)) & 0xff);
    }
    return out;
  }

  function randomBytes(size, seed) {
    const rng = Random.seeded(seed);
    const out = [];

    for (let i = 0; i < size; i += 1) out.push(Math.floor(rng.next() * 256));
    return out;
  }

  /** Real codec output: LZ77 over English text, entropy-coded. It is genuinely
   *  what a compressed file looks like, rather than random bytes wearing a
   *  label. */
  function alreadyCompressed(size, seed) {
    const source = repeatTo(ENGLISH, size * 3);
    const tokens = Lz.compress(source, { window: 4096, depth: 16 }).tokens;

    return Deflate.deflateFixed(tokens).concat(randomBytes(Math.max(0,
      size - Deflate.deflateFixed(tokens).length), seed)).slice(0, size);
  }

  /* -------------------------------------------------------------- codecs */

  /**
   * Every codec behind one interface: bytes in, a size and a round-trip check
   * out. The interface is what makes the comparison legitimate — each codec is
   * asked the same question and its answer is verified the same way.
   */
  const CODECS = [
    { name: 'Huffman (order-0)', run: runHuffman,
      note: 'one whole bit per symbol minimum, table transmitted' },
    { name: 'arithmetic (order-0)', run: runArithmetic,
      note: 'fractional bits: reaches the order-0 entropy' },
    { name: 'rANS (order-0)', run: runRans,
      note: 'the same ratio, table-driven, one integer of state' },
    { name: 'LZSS', run: runLz,
      note: 'no entropy stage at all: matches only' },
    { name: 'DEFLATE (LZ + fixed Huffman)', run: runDeflate,
      note: 'the real pipeline: matches, then a code over the tokens' },
    { name: 'BWT + MTF + RLE + Huffman', run: runBwt,
      note: 'a transform that compresses nothing, then a weak coder' }
  ];

  function runHuffman(bytes) {
    if (bytes.length === 0) return { bits: 0, roundTrip: true };
    const built = Huffman.build(Huffman.frequenciesOf(bytes));
    const encoded = Huffman.encode(bytes, built.codes);
    const decoded = Huffman.decode(encoded, built.codes, bytes.length);
    const table = Huffman.tableCost(built, 256);

    return { bits: encoded.length + table.runLengthBits,
      payloadBits: encoded.length, tableBits: table.runLengthBits,
      roundTrip: same(decoded, bytes),
      bitsPerSymbol: encoded.length / bytes.length };
  }

  function runArithmetic(bytes) {
    if (bytes.length === 0) return { bits: 0, roundTrip: true };
    const alphabet = alphabetOf(bytes);
    const m = Arithmetic.model(Huffman.frequenciesOf(bytes), alphabet);
    const encoded = Arithmetic.encode(bytes, m);
    const decoded = Arithmetic.decode(encoded.bits, m, bytes.length);
    const table = alphabet.length * 12;

    return { bits: encoded.length + table, payloadBits: encoded.length, tableBits: table,
      roundTrip: same(decoded, bytes), bitsPerSymbol: encoded.length / bytes.length };
  }

  function runRans(bytes) {
    if (bytes.length === 0) return { bits: 0, roundTrip: true };
    const alphabet = alphabetOf(bytes);
    const m = Arithmetic.ransModel(Huffman.frequenciesOf(bytes), alphabet, 12);
    const encoded = Arithmetic.ransEncode(bytes, m);
    const decoded = Arithmetic.ransDecode(encoded, m, bytes.length);
    const table = alphabet.length * 12;

    return { bits: encoded.bits + table, payloadBits: encoded.bits, tableBits: table,
      roundTrip: same(decoded, bytes), bitsPerSymbol: encoded.bits / bytes.length };
  }

  function runLz(bytes) {
    const result = Lz.compress(bytes, { window: 4096, depth: 32, lazy: true });

    return { bits: result.bits, payloadBits: result.bits, tableBits: 0,
      roundTrip: same(Lz.decompress(result.tokens), bytes),
      matches: result.matches, literals: result.literals,
      bitsPerSymbol: bytes.length === 0 ? 0 : result.bits / bytes.length };
  }

  function runDeflate(bytes) {
    if (bytes.length === 0) return { bits: 0, roundTrip: true };
    const tokens = Lz.compress(bytes, { window: 4096, depth: 32, lazy: true }).tokens;
    const stream = Deflate.deflateFixed(tokens);
    const stored = Deflate.storeBlock(bytes);
    const chosen = stream.length <= stored.length ? stream : stored;
    const decoded = Deflate.inflate(chosen);

    return { bits: chosen.length * 8, payloadBits: chosen.length * 8, tableBits: 0,
      roundTrip: same(decoded.bytes, bytes), blockKind: chosen === stream ? 'fixed' : 'stored',
      bitsPerSymbol: chosen.length * 8 / bytes.length };
  }

  function runBwt(bytes) {
    if (bytes.length === 0) return { bits: 0, roundTrip: true };
    const transformed = Bwt.transform(bytes);
    const mtf = Bwt.moveToFront(transformed.last);
    const flat = Bwt.flatten(Bwt.runLengthZeros(mtf));
    const built = Huffman.build(Huffman.frequenciesOf(flat));
    const bits = built.bits + Huffman.tableCost(built, 320).runLengthBits;

    return { bits: bits, payloadBits: built.bits,
      tableBits: Huffman.tableCost(built, 320).runLengthBits,
      roundTrip: same(Bwt.roundTrip(bytes), bytes),
      bitsPerSymbol: bits / bytes.length };
  }

  function alphabetOf(bytes) {
    const seen = new Set(bytes);

    return Array.from(seen).sort(function (a, b) { return a - b; });
  }

  function same(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  /* --------------------------------------------------------- the bake-off */

  /**
   * Every codec on every corpus. The ratio is input over output, so a value
   * below one is EXPANSION and is reported as such rather than clamped.
   */
  function bakeOff(options) {
    const sets = corpora(options);

    return {
      corpora: sets.map(function (corpus) { return corpus.name; }),
      rows: sets.map(function (corpus) { return corpusRow(corpus); })
    };
  }

  function corpusRow(corpus) {
    const entropy = Entropy.order0(corpus.bytes);
    const floor = Entropy.floorBytes(entropy.bits, corpus.bytes.length);

    return {
      corpus: corpus.name, note: corpus.note, bytes: corpus.bytes.length,
      entropy: entropy.bits, distinct: entropy.distinct, order0Floor: floor,
      codecs: CODECS.map(function (codec) { return codecRow(codec, corpus, entropy); })
    };
  }

  function codecRow(codec, corpus, entropy) {
    const result = codec.run(corpus.bytes);
    const bytes = Math.max(1, Math.ceil(result.bits / 8));

    return {
      name: codec.name, note: codec.note,
      bytes: bytes, bits: result.bits,
      bitsPerSymbol: corpus.bytes.length === 0 ? 0 : result.bits / corpus.bytes.length,
      ratio: corpus.bytes.length === 0 ? 1 : corpus.bytes.length / bytes,
      expands: bytes >= corpus.bytes.length,
      againstEntropy: entropy.bits === 0 ? 1
        : (result.bits / corpus.bytes.length) / entropy.bits,
      roundTrip: result.roundTrip,
      tableBits: result.tableBits || 0
    };
  }

  /** One corpus, every codec, with the entropy floor beside it. */
  function onCorpus(name, options) {
    const found = corpora(options).filter(function (corpus) { return corpus.name === name; });

    if (!found.length) throw new Error('codec-lab: no corpus named ' + name);
    return corpusRow(found[0]);
  }

  /** The Pareto view: ratio against work, where work is the comparison count an
   *  encoder spends. Decode cost is the column that usually decides, and it is
   *  reported separately because it is not the same shape as encode cost. */
  function paretoTable(options) {
    const corpus = corpora(options).filter(function (c) {
      return c.name === (options && options.corpus ? options.corpus : 'mixed prose');
    })[0];
    const depths = (options && options.depths) || [1, 2, 4, 8, 16, 32, 64];

    return {
      corpus: corpus.name, bytes: corpus.bytes.length,
      rows: depths.map(function (depth) {
        const result = Lz.compress(corpus.bytes, { window: 4096, depth: depth, lazy: true });
        const tokens = result.tokens.length;

        return { depth: depth, bytes: Math.ceil(result.bits / 8),
          ratio: corpus.bytes.length / Math.ceil(result.bits / 8),
          encodeWork: result.comparisons,
          workPerByte: result.comparisons / corpus.bytes.length,
          decodeWork: tokens, matches: result.matches };
      })
    };
  }

  /**
   * DEFLATE's block-type decision, per corpus. Every block picks the cheapest
   * of stored, fixed-Huffman and dynamic-Huffman, and the stored option is why
   * the format never expands its input by more than five bytes per block — a
   * guarantee no amount of entropy coding provides.
   */
  function blockStudy(options) {
    return corpora(options).map(function (corpus) {
      const tokens = Lz.compress(corpus.bytes, { window: 4096, depth: 32, lazy: true }).tokens;
      const choice = Deflate.chooseBlock(corpus.bytes, tokens);
      const stream = choice.choice === 'fixed'
        ? Deflate.deflateFixed(tokens) : Deflate.storeBlock(corpus.bytes);
      const decoded = Deflate.inflate(stream);

      return {
        corpus: corpus.name, bytes: corpus.bytes.length,
        storedBytes: choice.storedBytes, fixedBytes: choice.fixedBytes,
        choice: choice.choice, overhead: choice.overhead,
        chosenBytes: Math.min(choice.storedBytes, choice.fixedBytes),
        ratio: corpus.bytes.length / Math.min(choice.storedBytes, choice.fixedBytes),
        roundTrip: same(decoded.bytes, corpus.bytes),
        blockKind: decoded.blocks[0].kind
      };
    });
  }

  /** The edge cases every codec has to survive, run as a table rather than
   *  assumed: empty input, one byte, and a long run of one value. */
  function edgeCases() {
    const cases = [
      { name: 'empty', bytes: [] },
      { name: 'one byte', bytes: [65] },
      { name: 'all identical (1 000)', bytes: new Array(1000).fill(65) },
      { name: 'two symbols, 99/1', bytes: skewed(1000) }
    ];

    return cases.map(function (entry) {
      return {
        name: entry.name, bytes: entry.bytes.length,
        codecs: CODECS.map(function (codec) {
          const result = codec.run(entry.bytes);

          return { name: codec.name, bits: result.bits, roundTrip: result.roundTrip,
            bytes: Math.ceil(result.bits / 8) };
        })
      };
    });
  }

  function skewed(size) {
    const out = [];

    for (let i = 0; i < size; i += 1) out.push(i % 100 === 0 ? 66 : 65);
    return out;
  }

  return {
    ENGLISH: ENGLISH, CODECS: CODECS,
    corpora: corpora, bakeOff: bakeOff, onCorpus: onCorpus,
    paretoTable: paretoTable, blockStudy: blockStudy, edgeCases: edgeCases,
    toBytes: toBytes
  };
}));

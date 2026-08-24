'use strict';

/**
 * Property tests for the M22.1-M22.7 modules: entropy, Huffman, arithmetic
 * coding and ANS, LZ, DEFLATE, context models and the BWT chain.
 *
 * The rules pinned here are the ones a compression implementation breaks
 * silently: a round-trip that fails only on a run, a coder that works until the
 * underflow counter matters, an entropy estimate that is really memorisation.
 * The DEFLATE decoder is checked against Node's own zlib, which is a genuine
 * external oracle running in-process.
 */

const test = require('node:test');
const assert = require('node:assert');
const zlib = require('node:zlib');

const Entropy = require('../../src/js/algorithms/entropy.js');
const Huffman = require('../../src/js/algorithms/huffman.js');
const Arithmetic = require('../../src/js/algorithms/arithmetic-coder.js');
const Lz = require('../../src/js/algorithms/lz.js');
const Deflate = require('../../src/js/algorithms/deflate.js');
const Context = require('../../src/js/algorithms/context-model.js');
const Bwt = require('../../src/js/algorithms/bwt-pipeline.js');
const Random = require('../../src/js/utils/random.js');

function bytesOf(text) {
  const out = [];

  for (let i = 0; i < text.length; i += 1) out.push(text.charCodeAt(i) & 0xff);
  return out;
}

function randomBytes(count, seed) {
  const rng = Random.seeded(seed);
  const out = [];

  for (let i = 0; i < count; i += 1) out.push(Math.floor(rng.next() * 256));
  return out;
}

const TEXT = bytesOf('the quick brown fox jumps over the lazy dog. pack my box with five '
  + 'dozen liquor jugs. '.repeat(20));

/* ---------------------------------------------------------- 22.1 entropy */

test('entropy matches closed forms on sources whose entropy is arithmetic', function () {
  [0.5, 0.25, 0.1, 0.01].forEach(function (p) {
    const rng = Random.seeded(Math.round(p * 1000) + 1);
    const measured = Entropy.order0(Entropy.biasedCoin(50000, p, rng)).bits;

    assert.ok(Math.abs(measured - Entropy.binaryEntropy(p)) < 0.01,
      'p=' + p + ': measured ' + measured + ' against ' + Entropy.binaryEntropy(p));
  });
  const chain = Entropy.markovChain(50000, 4, 0.8, Random.seeded(9));

  assert.ok(Math.abs(Entropy.orderK(chain, 1).bits - Entropy.markovEntropy(4, 0.8)) < 0.02,
    'the order-1 estimate must find the transition entropy');
  assert.ok(Math.abs(Entropy.order0(chain).bits - 2) < 0.05,
    'and the order-0 estimate must see a uniform stationary distribution');
});

test('entropy is bounded by the alphabet and falls with order', function () {
  const profile = Entropy.profile(TEXT, 3);

  assert.ok(profile[0].bits <= Math.log2(profile[0].distinct) + 1e-9,
    'no distribution over k symbols exceeds log2(k) bits');
  for (let i = 1; i < profile.length; i += 1) {
    assert.ok(profile[i].bits <= profile[i - 1].bits + 1e-9,
      'conditioning on more context cannot raise the measured entropy');
  }
  assert.strictEqual(Entropy.order0([]).bits, 0, 'an empty input carries no information');
});

test('the reliability flag catches memorisation', function () {
  const random = randomBytes(3000, 7);
  const order2 = Entropy.orderK(random, 2);

  assert.ok(order2.bits < 1,
    'the estimate on random bytes at order 2 is near zero — which is the trap');
  assert.strictEqual(order2.reliable, false,
    'and it must be flagged unreliable: ' + order2.perContext + ' observations per context');
  assert.ok(Entropy.orderK(TEXT, 1).reliable, 'a well-populated model is not flagged');
});

/* --------------------------------------------------------- 22.2 Huffman */

test('Huffman is within one bit of the entropy and its Kraft sum is one', function () {
  [TEXT, randomBytes(2000, 3), new Array(500).fill(65).concat(new Array(5).fill(66))]
    .forEach(function (bytes, i) {
      const built = Huffman.build(Huffman.frequenciesOf(bytes));
      const entropy = Entropy.order0(bytes).bits;

      assert.ok(built.bitsPerSymbol >= entropy - 1e-9,
        'case ' + i + ': a code cannot beat the entropy');
      assert.ok(built.bitsPerSymbol < entropy + 1 + 1e-9,
        'case ' + i + ': nor be more than a bit above it');
      assert.ok(Math.abs(built.kraft - 1) < 1e-9,
        'case ' + i + ': the Kraft sum of a complete code is exactly one');
    });
});

test('Huffman round-trips, including degenerate alphabets', function () {
  const cases = [TEXT, [65], new Array(200).fill(7), randomBytes(1000, 11)];

  cases.forEach(function (bytes, i) {
    const built = Huffman.build(Huffman.frequenciesOf(bytes));
    const decoded = Huffman.decode(Huffman.encode(bytes, built.codes), built.codes, bytes.length);

    assert.deepStrictEqual(decoded, bytes, 'case ' + i + ' failed to round-trip');
  });
});

test('canonical codes are prefix-free and rebuild from lengths alone', function () {
  const built = Huffman.build(Huffman.frequenciesOf(TEXT));
  const rebuilt = Huffman.canonicalFromLengths(built.lengths);
  const all = [];

  rebuilt.forEach(function (entry, symbol) {
    assert.strictEqual(entry.bits, built.codes.get(symbol).bits,
      'the code must be reconstructible from lengths alone');
    all.push(entry.bits);
  });
  all.forEach(function (code) {
    all.forEach(function (other) {
      if (code === other) return;
      assert.notStrictEqual(other.indexOf(code), 0, code + ' is a prefix of ' + other);
    });
  });
});

/* ---------------------------------------------- 22.3 arithmetic and ANS */

test('the arithmetic coder round-trips and stays within two bits of the ideal', function () {
  const cases = [TEXT, randomBytes(1500, 5), new Array(1000).fill(65),
    bytesOf('a'.repeat(999) + 'b')];

  cases.forEach(function (bytes, i) {
    const alphabet = Array.from(new Set(bytes)).sort(function (a, b) { return a - b; });
    const model = Arithmetic.model(Huffman.frequenciesOf(bytes), alphabet);
    const encoded = Arithmetic.encode(bytes, model);
    const decoded = Arithmetic.decode(encoded.bits, model, bytes.length);
    const ideal = Arithmetic.idealBits(bytes, model);

    assert.deepStrictEqual(decoded, bytes, 'case ' + i + ' failed to round-trip');
    assert.ok(encoded.length >= ideal - 1e-6, 'case ' + i + ': a coder cannot beat the ideal');
    assert.ok(encoded.length - ideal <= 2.5,
      'case ' + i + ': overhead is per message, not per symbol — ' +
      (encoded.length - ideal).toFixed(2) + ' bits');
  });
});

test('the coder beats Huffman by more as the source skews', function () {
  let previous = 0;

  [0.5, 0.1, 0.01, 0.001].forEach(function (share) {
    const bytes = [];
    const period = Math.round(1 / share);

    for (let i = 0; i < 2000; i += 1) bytes.push(i % period === 0 ? 66 : 65);
    const model = Arithmetic.model(Huffman.frequenciesOf(bytes), [65, 66]);
    const arithmetic = Arithmetic.encode(bytes, model).length / bytes.length;
    const huffman = Huffman.build(Huffman.frequenciesOf(bytes)).bitsPerSymbol;

    assert.ok(Math.abs(huffman - 1) < 1e-9, 'Huffman is pinned at one bit on two symbols');
    const ratio = huffman / arithmetic;

    assert.ok(ratio >= previous - 1e-9,
      'the advantage must grow with the skew: ' + ratio.toFixed(2) + ' at ' + share);
    if (share === 0.5) {
      assert.ok(Math.abs(ratio - 1) < 0.01,
        'at an even split the two coders are indistinguishable: ' + ratio.toFixed(4));
    }
    previous = ratio;
  });
  assert.ok(previous > 50, 'and it must reach a large factor at 1 in 1 000: ' + previous);
});

test('rANS round-trips against a power-of-two model', function () {
  [TEXT, randomBytes(2000, 17), [42], new Array(300).fill(9)].forEach(function (bytes, i) {
    const alphabet = Array.from(new Set(bytes)).sort(function (a, b) { return a - b; });
    const model = Arithmetic.ransModel(Huffman.frequenciesOf(bytes), alphabet, 12);

    assert.strictEqual(model.total, 4096, 'the frequency total must be a power of two');
    model.cumulative.forEach(function (value, at) {
      if (at === 0) return;
      assert.ok(value > model.cumulative[at - 1],
        'every symbol must keep a frequency of at least one');
    });
    const encoded = Arithmetic.ransEncode(bytes, model);

    assert.deepStrictEqual(Arithmetic.ransDecode(encoded, model, bytes.length), bytes,
      'case ' + i + ' failed to round-trip');
  });
});

/* --------------------------------------------------------------- 22.4 LZ */

test('LZ round-trips, and the overlapping copy is handled', function () {
  const cases = [TEXT, [], [65], new Array(500).fill(3), randomBytes(2000, 23),
    bytesOf('abababababab'.repeat(50))];

  cases.forEach(function (bytes, i) {
    const result = Lz.compress(bytes, { window: 4096, depth: 16, lazy: true });

    assert.deepStrictEqual(Lz.decompress(result.tokens), bytes,
      'case ' + i + ' failed to round-trip');
    const covered = result.tokens.reduce(function (total, token) {
      return total + (token.kind === 'literal' ? 1 : token.length);
    }, 0);

    assert.strictEqual(covered, bytes.length, 'case ' + i + ': the tokens must cover the input');
  });
});

test('a deeper search never finds fewer matched bytes', function () {
  const sweep = Lz.depthSweep(TEXT, [1, 2, 4, 8, 16, 32], { window: 4096 });

  for (let i = 1; i < sweep.length; i += 1) {
    assert.ok(sweep[i].matchedBytes >= sweep[i - 1].matchedBytes,
      'depth ' + sweep[i].depth + ' matched less than depth ' + sweep[i - 1].depth);
    assert.ok(sweep[i].comparisons >= sweep[i - 1].comparisons,
      'and it must cost at least as much work');
  }
});

test('LZW round-trips including the code-before-its-entry case', function () {
  [TEXT, bytesOf('abababababababab'), new Array(400).fill(200), []].forEach(function (bytes, i) {
    const encoded = Lz.lzwCompress(bytes);

    assert.deepStrictEqual(Lz.lzwDecompress(encoded.codes), bytes,
      'case ' + i + ' failed to round-trip');
  });
});

/* ---------------------------------------------------------- 22.5 DEFLATE */

test('the DEFLATE decoder decodes real zlib output byte for byte', function () {
  const inputs = [
    'the quick brown fox jumps over the lazy dog. '.repeat(40),
    'abcdefghij'.repeat(50) + Array.from({ length: 2000 },
      function (unused, i) { return String.fromCharCode(97 + (i * 7) % 26); }).join(''),
    'x'
  ];

  inputs.forEach(function (text, i) {
    [0, 1, 6, 9].forEach(function (level) {
      const compressed = Array.from(zlib.deflateRawSync(Buffer.from(text, 'binary'),
        { level: level }));
      const out = Deflate.inflate(compressed);

      assert.strictEqual(Buffer.from(out.bytes).toString('binary'), text,
        'input ' + i + ' at level ' + level + ' did not decode');
    });
  });
});

test('the decoder handles all three block types', function () {
  const text = 'the quick brown fox jumps over the lazy dog. '.repeat(40);
  const kinds = new Set();

  [0, 1, 9].forEach(function (level) {
    const compressed = Array.from(zlib.deflateRawSync(Buffer.from(text, 'binary'),
      { level: level }));

    Deflate.inflate(compressed).blocks.forEach(function (block) { kinds.add(block.kind); });
  });
  const dynamic = Array.from(zlib.deflateRawSync(Buffer.from(
    Array.from({ length: 3000 }, function (unused, i) {
      return String.fromCharCode(97 + (i * 13) % 26);
    }).join(''), 'binary'), { level: 9 }));

  Deflate.inflate(dynamic).blocks.forEach(function (block) { kinds.add(block.kind); });
  assert.ok(kinds.has('stored'), 'a stored block was never exercised');
  assert.ok(kinds.has('fixed'), 'a fixed-Huffman block was never exercised');
  assert.ok(kinds.has('dynamic'), 'a dynamic-Huffman block was never exercised');
});

test('our own fixed-Huffman encoder produces a stream our decoder reads', function () {
  const bytes = bytesOf('the quick brown fox jumps over the lazy dog. '.repeat(30));
  const tokens = Lz.compress(bytes, { window: 32768, depth: 32 }).tokens;
  const stream = Deflate.deflateFixed(tokens);

  assert.deepStrictEqual(Deflate.inflate(stream).bytes, bytes, 'self round-trip failed');
  assert.ok(stream.length < bytes.length / 4, 'and it should actually compress');

  const stored = Deflate.storeBlock(bytes);

  assert.strictEqual(stored.length, bytes.length + 5, 'a stored block costs five bytes');
  assert.deepStrictEqual(Deflate.inflate(stored).bytes, bytes, 'stored round-trip failed');
});

/* --------------------------------------------------- 22.6 context models */

test('a context model never reports fewer bits than the coder could spend', function () {
  const mapped = TEXT.map(function (byte) { return byte % 32; });
  const rows = Context.orderSweep(mapped, 3, 32);

  rows.forEach(function (row) {
    assert.ok(row.bits > 0, 'order ' + row.order + ' reported no cost at all');
    assert.ok(row.bitsPerSymbol <= Math.log2(32) + 1e-9,
      'order ' + row.order + ' cannot exceed a uniform model over the alphabet');
  });
  assert.ok(rows[1].bitsPerSymbol < rows[0].bitsPerSymbol,
    'order 1 must beat order 0 on structured text');
});

test('PPM beats a plain model of the same order, and escapes are counted', function () {
  const mapped = TEXT.map(function (byte) { return byte % 32; });

  [2, 3, 4].forEach(function (order) {
    const plain = Context.costUnder(mapped, Context.orderModel(order, 32));
    const ppm = Context.ppm(mapped, order, 32);

    assert.ok(ppm.bitsPerSymbol < plain.bitsPerSymbol,
      'order ' + order + ': PPM ' + ppm.bitsPerSymbol.toFixed(3) + ' against ' +
      plain.bitsPerSymbol.toFixed(3));
    assert.ok(ppm.escapes > 0, 'and it must actually be escaping');
    assert.ok(ppm.escapesPerSymbol < 1, 'though not on every symbol');
  });
});

test('the mixer keeps its weights normalised and non-negative', function () {
  const mapped = TEXT.slice(0, 1200).map(function (byte) { return byte % 24; });
  const mixed = Context.mixedCost(mapped, [0, 1, 2], 24);
  let sum = 0;

  mixed.weights.forEach(function (weight) {
    assert.ok(weight >= 0, 'a negative weight is not a probability mixture');
    sum += weight;
  });
  assert.ok(Math.abs(sum - 1) < 1e-9, 'the weights must sum to one, and sum to ' + sum);
  assert.ok(mixed.weightTrace.length > 4, 'the trace must record the adaptation');
  assert.notDeepStrictEqual(mixed.weights, mixed.weightTrace[0].weights,
    'weights that never move mean the mixer is not learning');
});

/* -------------------------------------------------------- 22.7 transform */

test('the BWT is a permutation: identical counts and identical entropy', function () {
  [TEXT, randomBytes(1000, 29), [65, 66, 67], []].forEach(function (bytes, i) {
    const transformed = Bwt.transform(bytes);
    const before = Huffman.frequenciesOf(bytes);
    const after = Huffman.frequenciesOf(transformed.last);

    assert.strictEqual(transformed.last.length, bytes.length, 'case ' + i + ': length changed');
    before.forEach(function (count, symbol) {
      assert.strictEqual(after.get(symbol), count, 'case ' + i + ': counts changed for ' + symbol);
    });
    if (bytes.length === 0) return;
    assert.ok(Math.abs(Entropy.order0(transformed.last).bits - Entropy.order0(bytes).bits) < 1e-12,
      'case ' + i + ': a permutation cannot change the order-0 entropy');
  });
});

test('the whole chain round-trips, and MTF drops the entropy on runs', function () {
  [TEXT, randomBytes(800, 31), [65], [], new Array(300).fill(200)].forEach(function (bytes, i) {
    assert.deepStrictEqual(Bwt.roundTrip(bytes), bytes, 'case ' + i + ' failed to round-trip');
  });
  const transformed = Bwt.transform(TEXT);
  const mtf = Bwt.moveToFront(transformed.last);

  assert.ok(Entropy.order0(mtf).bits < Entropy.order0(TEXT).bits / 2,
    'move-to-front must halve the entropy at least, on transformed text');
  assert.ok(Bwt.zeroShare(mtf) > 0.5, 'and most of its output should be zeros');
});

test('a bigger block groups more of the data into runs', function () {
  const sweep = Bwt.blockSweep(TEXT, [64, 256, 1024], function (symbols) {
    return Entropy.order0(symbols).bits;
  });

  for (let i = 1; i < sweep.length; i += 1) {
    assert.ok(sweep[i].zeroShare >= sweep[i - 1].zeroShare,
      'block ' + sweep[i].block + ' found fewer runs than ' + sweep[i - 1].block);
    assert.ok(sweep[i].ratio >= sweep[i - 1].ratio, 'and compressed worse');
  }
});

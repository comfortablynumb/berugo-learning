'use strict';

/**
 * Unit tests for the M09 succinct structures.
 *
 * Everything here is checked against the naive form it replaces: rank and
 * select against a scan, LOUDS navigation against the pointer tree it encodes,
 * the wavelet tree against a sorted slice, and Roaring against a plain `Set`.
 * A succinct structure that is subtly wrong is indistinguishable from a
 * correct one until the answer matters, and it is exactly the kind of code
 * where an off-by-one in an index computation survives casual testing.
 *
 * The edge cases are the point: all-zero, all-one, single-bit and empty inputs
 * are where index arithmetic actually breaks.
 */

const test = require('node:test');
const assert = require('node:assert');

const BitVector = require('../../src/js/algorithms/bit-vector.js');
const SuccinctTree = require('../../src/js/algorithms/succinct-tree.js');
const Roaring = require('../../src/js/algorithms/roaring.js');
const Random = require('../../src/js/utils/random.js');

function bitsOf(length, density, seed) {
  const random = Random.seeded(seed);
  const out = new Array(length);
  for (let i = 0; i < length; i += 1) out[i] = random.next() < density ? 1 : 0;
  return out;
}

function checkRankSelect(bits, label) {
  const vector = BitVector.create(bits);
  const positions = [];
  let ones = 0;

  for (let i = 0; i < bits.length; i += 1) {
    assert.strictEqual(vector.rank1(i), ones, label + ': rank1(' + i + ')');
    assert.strictEqual(vector.rank0(i), i - ones, label + ': rank0(' + i + ')');
    if (bits[i]) { ones += 1; positions.push(i); }
  }
  assert.strictEqual(vector.rank1(bits.length), ones, label + ': rank1 at the end');

  for (let k = 1; k <= positions.length; k += 1) {
    assert.strictEqual(vector.select1(k), positions[k - 1], label + ': select1(' + k + ')');
    assert.strictEqual(vector.select1Sampled(k), positions[k - 1], label + ': sampled select1(' + k + ')');
  }
  assert.strictEqual(vector.select1(positions.length + 1), -1, label + ': select past the last one');
  assert.strictEqual(vector.select1(0), -1, label + ': select of the zeroth one');
  return vector;
}

/* ------------------------------------------------------------ rank/select */

test('bit vector: rank and select match a scan on 10 000 random bits', function () {
  checkRankSelect(bitsOf(10000, 0.5, 3), 'dense');
  checkRankSelect(bitsOf(10000, 0.02, 5), 'sparse');
  checkRankSelect(bitsOf(10000, 0.98, 7), 'nearly full');
});

test('bit vector: the degenerate inputs are the ones that break index arithmetic', function () {
  checkRankSelect(new Array(4096).fill(0), 'all zero');
  checkRankSelect(new Array(4096).fill(1), 'all one');
  checkRankSelect([1], 'single one');
  checkRankSelect([0], 'single zero');
  checkRankSelect([0, 0, 1], 'one at the end');
  checkRankSelect([1, 0, 0], 'one at the start');

  const boundary = new Array(BitVector.SUPERBLOCK * 2 + 1).fill(0);
  boundary[BitVector.SUPERBLOCK - 1] = 1;
  boundary[BitVector.SUPERBLOCK] = 1;
  boundary[BitVector.BLOCK] = 1;
  checkRankSelect(boundary, 'bits on the block and superblock seams');
});

test('bit vector: select0 finds zeros, which is what LOUDS needs', function () {
  const bits = bitsOf(5000, 0.4, 11);
  const vector = BitVector.create(bits);
  const zeros = [];
  bits.forEach(function (bit, index) { if (!bit) zeros.push(index); });

  for (let k = 1; k <= zeros.length; k += 1) {
    assert.strictEqual(vector.select0(k), zeros[k - 1], 'select0(' + k + ')');
  }
  assert.strictEqual(vector.select0(zeros.length + 1), -1);
});

test('bit vector: the index overhead is small and is reported rather than hidden', function () {
  const vector = BitVector.create(bitsOf(1 << 16, 0.5, 13));
  const shape = vector.shape();
  assert.ok(shape.overhead > 0, 'succinct means o(n) overhead, not zero overhead');
  assert.ok(shape.overhead < 0.12, 'and it measured ' + (shape.overhead * 100).toFixed(1) + '%');
  assert.ok(shape.rawBytes + shape.indexBytes < shape.positionArrayBytes,
    'the whole point is beating an explicit array of positions');
});

test('bit vector: Elias-Fano stays inside its own bound and round-trips', function () {
  const random = Random.seeded(17);
  const values = [];
  let running = 0;
  for (let i = 0; i < 5000; i += 1) { running += 1 + random.int(400); values.push(running); }

  const coded = BitVector.eliasFano(values);
  values.forEach(function (value, index) {
    assert.strictEqual(coded.get(index), value, 'value ' + index);
  });

  const shape = coded.shape();
  assert.ok(shape.bitsPerValue <= shape.bound,
    shape.bitsPerValue.toFixed(3) + ' bits per value against a bound of ' + shape.bound.toFixed(3));
  assert.ok(shape.compression > 2, 'and it must beat 32 bits per value: ' + shape.compression.toFixed(2) + '×');
});

/* ---------------------------------------------------------- succinct trees */

function randomTree(size, seed) {
  const random = Random.seeded(seed);
  const nodes = [{ value: 0, children: [] }];
  for (let i = 1; i < size; i += 1) {
    const parent = nodes[random.int(nodes.length)];
    const child = { value: i, children: [] };
    parent.children.push(child);
    nodes.push(child);
  }
  return nodes[0];
}

test('louds: navigation reproduces the pointer tree exactly', function () {
  const source = randomTree(2000, 19);
  const pointer = SuccinctTree.pointerTree(source);
  const louds = SuccinctTree.louds(source);
  const levelOrder = pointer.levelOrder();

  levelOrder.forEach(function (node, i) {
    const v = i + 1;
    assert.strictEqual(louds.value(v), node.value, 'value of node ' + v);
    assert.strictEqual(louds.degree(v), node.children.length, 'degree of node ' + v);

    const walked = [];
    let child = louds.firstChild(v);
    while (child !== null) { walked.push(louds.value(child)); child = louds.nextSibling(child); }
    assert.deepStrictEqual(walked, node.children.map(function (c) { return c.value; }),
      'children of node ' + v);

    node.children.forEach(function (unused, k) {
      assert.strictEqual(louds.parent(louds.child(v, k + 1)), v, 'parent of child ' + (k + 1) + ' of ' + v);
    });
  });

  assert.strictEqual(louds.parent(1), null, 'the root has no parent');
});

test('louds: two bits a node, against forty-eight bytes a node', function () {
  const louds = SuccinctTree.louds(randomTree(5000, 23));
  const shape = louds.shape();

  assert.ok(shape.bitsPerNode > 2 && shape.bitsPerNode < 2.01,
    'measured ' + shape.bitsPerNode.toFixed(4) + ' bits per node');
  assert.ok(shape.pointerBytes / shape.totalBytes > 50,
    'the saving against pointers measured ' + (shape.pointerBytes / shape.totalBytes).toFixed(0) + '×');
});

test('parentheses: the depth-first encoding preserves preorder and subtree sizes', function () {
  const source = randomTree(1500, 29);
  const pointer = SuccinctTree.pointerTree(source);
  const bp = SuccinctTree.parentheses(source);

  assert.deepStrictEqual(bp.preorderValues(), pointer.preorder.map(function (n) { return n.value; }));
  assert.strictEqual(bp.subtreeSize(0), pointer.size, 'the root\'s subtree is the whole tree');
  assert.strictEqual(bp.shape().bitsPerNode, 2);
  assert.strictEqual(bp.depthAt(0), 1, 'the root sits at excess 1');
});

test('wavelet: access, rank and range quantile all agree with the sequence', function () {
  const random = Random.seeded(31);
  const sequence = [];
  for (let i = 0; i < 4000; i += 1) sequence.push(random.int(256));
  const wavelet = SuccinctTree.wavelet(sequence, { alphabet: 256 });

  sequence.forEach(function (symbol, index) {
    assert.strictEqual(wavelet.access(index), symbol, 'access(' + index + ')');
  });

  for (let probe = 0; probe < 200; probe += 1) {
    const symbol = random.int(256);
    const index = random.int(sequence.length + 1);
    let want = 0;
    for (let i = 0; i < index; i += 1) if (sequence[i] === symbol) want += 1;
    assert.strictEqual(wavelet.rank(symbol, index), want, 'rank(' + symbol + ', ' + index + ')');
  }

  for (let probe = 0; probe < 200; probe += 1) {
    const a = random.int(sequence.length);
    const b = random.int(sequence.length);
    const from = Math.min(a, b);
    const to = Math.max(a, b);
    const k = 1 + random.int(to - from + 1);
    const sorted = sequence.slice(from, to + 1).sort(function (x, y) { return x - y; });
    assert.strictEqual(wavelet.quantile(from, to, k), sorted[k - 1],
      'quantile(' + from + ', ' + to + ', ' + k + ')');
  }

  assert.strictEqual(wavelet.shape().bitsPerSymbol, wavelet.shape().bound,
    'a wavelet tree costs exactly log₂ σ bits per symbol');
});

/* ------------------------------------------------------------- Roaring */

function sampleSet(kind, count, seed) {
  const random = Random.seeded(seed);
  const set = new Set();
  if (kind === 'sparse') { while (set.size < count) set.add(random.int(5000000)); }
  if (kind === 'dense') { while (set.size < count) set.add(random.int(count * 2)); }
  if (kind === 'runs') {
    let at = 0;
    while (set.size < count) {
      const length = 1 + random.int(200);
      for (let i = 0; i < length && set.size < count; i += 1) set.add(at + i);
      at += length + random.int(50);
    }
  }
  return Array.from(set).sort(function (a, b) { return a - b; });
}

['sparse', 'dense', 'runs'].forEach(function (kind) {
  test('roaring: set operations match a reference Set on ' + kind + ' input', function () {
    const engine = Roaring.create({});
    const left = sampleSet(kind, 20000, 37);
    const right = sampleSet(kind, 20000, 41);
    const a = engine.fromArray(left);
    const b = engine.fromArray(right);
    const rightSet = new Set(right);

    assert.deepStrictEqual(engine.values(a), left, 'round trip');
    assert.strictEqual(engine.size(a), left.length);

    assert.deepStrictEqual(engine.values(engine.union(a, b)),
      Array.from(new Set(left.concat(right))).sort(function (x, y) { return x - y; }));
    assert.deepStrictEqual(engine.values(engine.intersection(a, b)),
      left.filter(function (value) { return rightSet.has(value); }));
    assert.deepStrictEqual(engine.values(engine.difference(a, b)),
      left.filter(function (value) { return !rightSet.has(value); }));

    left.forEach(function (value, index) {
      if (index % 97) return;
      assert.strictEqual(engine.contains(a, value), true);
    });
  });
});

test('roaring: the container choice follows the density of each chunk', function () {
  const engine = Roaring.create({});
  const sparse = engine.shape(engine.fromArray(sampleSet('sparse', 20000, 43)));
  const dense = engine.shape(engine.fromArray(sampleSet('dense', 20000, 47)));

  assert.ok(sparse.containers.array > 0 && sparse.containers.bitmap === 0,
    'a chunk holding a handful of values must stay an array');
  assert.ok(dense.containers.bitmap > 0,
    'a chunk past the 4 096 crossover must become a bitmap');
  assert.ok(sparse.bytes < sparse.rawBitmapBytes,
    'and the sparse case must beat an uncompressed bitmap: ' + sparse.bytes + ' against ' + sparse.rawBitmapBytes);
});

test('roaring: run optimisation collapses consecutive stretches', function () {
  const engine = Roaring.create({});
  const values = sampleSet('runs', 20000, 53);
  const plain = engine.fromArray(values);
  const optimised = engine.runOptimize(plain);

  assert.deepStrictEqual(engine.values(optimised), values, 'run optimisation must not change the set');
  assert.ok(engine.shape(optimised).containers.run > 0, 'run containers must actually be chosen');
  assert.ok(engine.shape(optimised).bytes < engine.shape(plain).bytes / 2,
    'and must be materially smaller: ' + engine.shape(optimised).bytes + ' against ' + engine.shape(plain).bytes);
});

test('roaring: an array-versus-bitmap intersection touches the smaller side', function () {
  const engine = Roaring.create({});
  const tiny = engine.fromArray([1, 2, 3, 70000, 70001]);
  const huge = engine.fromArray(sampleSet('dense', 20000, 59));

  engine.resetStats();
  const result = engine.intersection(tiny, huge);
  const stats = engine.stats();

  assert.ok(engine.size(result) <= 5);
  assert.ok(stats.elementsTouched <= 10,
    'the scan must be the size of the small side, not the universe: ' + stats.elementsTouched);
  assert.strictEqual(stats.wordsTouched, 0, 'and no bitmap word should be walked at all');
});

test('roaring: WAH is the honest comparison, and it wins on dense random data', function () {
  const engine = Roaring.create({});
  const dense = sampleSet('dense', 20000, 61);
  const sparse = sampleSet('sparse', 20000, 67);

  const roaringDense = engine.shape(engine.fromArray(dense)).bytes;
  const roaringSparse = engine.shape(engine.fromArray(sparse)).bytes;

  assert.ok(Roaring.wah(dense).bytes < roaringDense,
    'WAH really is smaller on a dense random chunk, and the section says so');
  assert.ok(Roaring.wah(sparse).bytes > roaringSparse * 2,
    'and much larger on sparse data spread over a wide universe');
});

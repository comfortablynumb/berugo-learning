'use strict';

/**
 * Every figure the M09.7-M09.9 worked examples quote, recomputed.
 *
 * As elsewhere: reproduce the measurement with the demo's parameters and seed,
 * then assert the prose still quotes it. The LOUDS test below re-runs the
 * *full* pointer-tree comparison at the 5 000 nodes the example claims, rather
 * than trusting the smaller property test, because "0 disagreements" is a
 * claim about the tree in the prose.
 */

const test = require('node:test');
const assert = require('node:assert');

const prose = require('../support/worked-example-prose.js');
const quotes = prose.quotes;
const fixed = prose.fixed;
const grouped = prose.grouped;

const SuccinctLab = require('../../src/js/machines/succinct-lab.js');
const SuccinctTree = require('../../src/js/algorithms/succinct-tree.js');
require('../../src/js/content/examples-succinct.js');
require('../../src/js/content/concepts-succinct.js');

const dense = SuccinctLab.bitVectorRun({ bits: 65536, density: 0.5 });
const sparse = SuccinctLab.bitVectorRun({ bits: 65536, density: 0.02 });
const million = SuccinctLab.bitVectorRun({ bits: 1048576, density: 0.5 });

const TREE_NODES = 5000;
const TREE_SEED = 23;
const trees = SuccinctLab.treeEncodings({ nodes: TREE_NODES });

/* -------------------------------------------------- 9.7 rank-and-select */

test('rank-and-select: the predicted overhead is 7.81% and the measured one is 7.9%', function () {
  const shape = dense.shape;

  assert.strictEqual(shape.superblockBits, 2048);
  assert.strictEqual(shape.blockBits, 256);
  assert.strictEqual(fixed(32 / 2048 * 100), '1.56');
  assert.strictEqual(fixed(16 / 256 * 100), '6.25');
  assert.strictEqual(fixed((32 / 2048 + 16 / 256) * 100), '7.81');
  assert.strictEqual(fixed(shape.overhead * 100, 1), '7.9');
  assert.ok(Math.abs(shape.overhead - 0.078125) < 0.001, 'the measurement must land on the prediction');

  quotes('rank-and-select', ['superblocks: 32 bits per 2 048 = 1.56%', 'blocks:      16 bits per 256   = 6.25%',
    'total predicted: 7.81%', 'a prediction of just under 8%', 'overhead: 7.9%']);
});

test('rank-and-select: 8 192 data bytes plus a 646-byte index holds 65 536 bits', function () {
  const shape = dense.shape;

  assert.strictEqual(shape.length, 65536);
  assert.strictEqual(shape.ones, 32583);
  assert.strictEqual(shape.rawBytes, 8192);
  assert.strictEqual(shape.rawBytes, 65536 / 8);
  assert.strictEqual(shape.indexBytes, 646);
  assert.strictEqual(shape.rawBytes + shape.indexBytes, 8838);
  assert.strictEqual(grouped(32583), '32 583');

  quotes('rank-and-select', ['32 583 ones', 'data:  8 192 bytes', 'index:   646 bytes',
    '8 838 bytes to hold 65 536 bits with constant-time rank']);
});

test('rank-and-select: rank is 3.0 lookups and 3.5 popcounts at every length', function () {
  assert.strictEqual(fixed(dense.rankLookups, 1), '3.0');
  assert.strictEqual(fixed(dense.rankWords, 1), '3.5');
  assert.strictEqual(fixed(million.rankLookups, 1), '3.0');
  assert.strictEqual(dense.shape.blockBits / 32, 8, 'a block is eight 32-bit words');
  assert.ok(dense.rankWords <= 8, 'the popcount count is bounded by the words in one block');
  assert.strictEqual(million.rankLookups, dense.rankLookups,
    'rank must not grow with the vector, which is the whole claim');

  quotes('rank-and-select', ['3.0 table lookups per query - superblock, block, and the word',
    '3.5 word popcounts per query, bounded by the 8 words in a block',
    'the same cost at 65 536 bits and at 1 048 576']);
});

test('rank-and-select: select is 8.0 steps at 65 536 bits and 12.0 at a million', function () {
  assert.strictEqual(fixed(dense.selectSteps, 1), '8.0');
  assert.strictEqual(fixed(million.selectSteps, 1), '12.0');
  assert.ok(million.selectSteps > dense.selectSteps, 'select grows with the vector where rank does not');
  assert.strictEqual(million.shape.length, 1048576);

  quotes('rank-and-select', ['8.0 binary-search steps per select on 65 536 bits', '12.0 on 1 048 576 bits',
    'O(log n), and it grows with the vector where rank does not']);
});

test('rank-and-select: 130 332 bytes of positions against 8 838 - 14.7x', function () {
  const shape = dense.shape;

  assert.strictEqual(shape.positionArrayBytes, shape.ones * 4);
  assert.strictEqual(shape.positionArrayBytes, 130332);
  assert.strictEqual(fixed(dense.positionsRatio, 1), '14.7');
  assert.strictEqual(fixed(shape.positionArrayBytes / (shape.rawBytes + shape.indexBytes), 1), '14.7');

  quotes('rank-and-select', ['32 583 ones × 4 bytes = 130 332 bytes', 'bit vector plus index: 8 838 bytes',
    '14.7× smaller, and rank is O(1) rather than a binary search']);
});

test('rank-and-select: the vector is indifferent to density and the position array is not', function () {
  assert.strictEqual(sparse.shape.rawBytes, dense.shape.rawBytes);
  assert.strictEqual(sparse.shape.indexBytes, dense.shape.indexBytes);

  assert.strictEqual(sparse.shape.ones, 1246);
  assert.strictEqual(sparse.shape.positionArrayBytes, 1246 * 4);
  assert.strictEqual(sparse.shape.positionArrayBytes, 4984);
  assert.strictEqual(fixed(dense.shape.positionArrayBytes / sparse.shape.positionArrayBytes, 0), '26');

  quotes('rank-and-select', ['50% density: 8 192 data bytes + 646 index',
    ' 2% density: 8 192 data bytes + 646 index',
    '50% density: 32 583 ones × 4 = 130 332 bytes',
    ' 2% density:  1 246 ones × 4 =   4 984 bytes',
    'the alternative shrinks by 26× while the vector does not move']);
});

test('rank-and-select: the crossover sits near 3.4% and the two measurements straddle it', function () {
  const overhead = dense.shape.overhead;

  assert.strictEqual(fixed(32 / (1 + overhead), 1), '29.7');
  assert.strictEqual(fixed(1 / (32 / (1 + overhead)) * 100, 1), '3.4');

  assert.ok(dense.shape.density > 0.034, 'the 50% run must sit above the crossover');
  assert.ok(sparse.shape.density < 0.034, 'the 2% run must sit below it');
  assert.strictEqual(fixed(dense.positionsRatio, 1), '14.7');
  assert.strictEqual(fixed(1 / sparse.positionsRatio, 1), '1.8');

  quotes('rank-and-select', ['positions win when 32m < n(1 + overhead)',
    'with 7.9% overhead: m/n < 1/29.7, about 3.4%',
    '50%: 8 838 bytes against 130 332 - the vector wins 14.7×',
    ' 2%: 8 838 bytes against  4 984 - the positions win 1.8×']);
});

test('rank-and-select: Elias-Fano is 9.5686 bits per value against a 9.6496 bound', function () {
  const run = SuccinctLab.eliasFanoRun({});
  const shape = run.shape;

  assert.strictEqual(run.wrong, 0);
  assert.strictEqual(shape.count, 5000);
  assert.strictEqual(shape.rawBits, 5000 * 32);
  assert.strictEqual(shape.rawBits, 160000);
  assert.strictEqual(shape.totalBits, 47843);
  assert.strictEqual(fixed(shape.bitsPerValue, 4), '9.5686');
  assert.strictEqual(fixed(shape.bound, 4), '9.6496');
  assert.strictEqual(fixed(2 + Math.log2(shape.universe / shape.count), 4), '9.6496');
  assert.ok(shape.bitsPerValue < shape.bound, 'the measurement must stay inside the bound it quotes');
  assert.strictEqual(fixed(shape.compression), '3.34');
  assert.ok(shape.universe < 1000000 * 1.01, 'the values really are "under a million"');

  quotes('rank-and-select', ['5 000 increasing values under a million:',
    'raw 32-bit integers: 160 000 bits', 'Elias-Fano:           47 843 bits = 9.5686 per value',
    'its own bound 2 + log₂(u/n) = 9.6496', '3.34× smaller than integers']);
});

/* ---------------------------------------------------- 9.8 succinct-trees */

test('succinct-trees: 5 000 nodes are 10 001 bits - 2.0002 per node', function () {
  assert.strictEqual(trees.louds.nodes, TREE_NODES);
  assert.strictEqual(trees.louds.bits, 10001);
  assert.strictEqual(trees.louds.bits, 2 * TREE_NODES + 1);
  assert.strictEqual(fixed(trees.louds.bitsPerNode, 4), '2.0002');
  assert.strictEqual(trees.louds.rawBytes, 1252);
  assert.strictEqual(trees.louds.indexBytes, 106);
  assert.strictEqual(trees.louds.totalBytes, 1358);
  assert.strictEqual(trees.louds.rawBytes + trees.louds.indexBytes, trees.louds.totalBytes);

  quotes('succinct-trees', ['log₂ C(n) ≈ 2n bits', '5 000 nodes → 10 001 bits = 2.0002 bits per node',
    'data 1 252 bytes + rank/select index 106 bytes = 1 358 bytes']);
});

test('succinct-trees: every navigation answer agrees with the pointer tree at 5 000 nodes', function () {
  const source = SuccinctLab.randomTree(TREE_NODES, TREE_SEED);
  const pointer = SuccinctTree.pointerTree(source);
  const louds = SuccinctTree.louds(source);
  let disagreements = 0;

  pointer.levelOrder().forEach(function (node, index) {
    const v = index + 1;
    if (louds.value(v) !== node.value) disagreements += 1;
    if (louds.degree(v) !== node.children.length) disagreements += 1;

    const walked = [];
    let child = louds.firstChild(v);
    while (child !== null) { walked.push(louds.value(child)); child = louds.nextSibling(child); }
    if (walked.join(',') !== node.children.map(function (c) { return c.value; }).join(',')) disagreements += 1;

    node.children.forEach(function (unused, k) {
      if (louds.parent(louds.child(v, k + 1)) !== v) disagreements += 1;
    });
  });

  assert.strictEqual(pointer.levelOrder().length, TREE_NODES);
  assert.strictEqual(disagreements, 0);
  assert.strictEqual(trees.mismatches, 0);

  quotes('succinct-trees', ['all 5 000 nodes: value, degree, full child walk and parent of every child',
    '0 disagreements with the pointer tree']);
});

test('succinct-trees: 15 000 calls use 14 999 selects, 9 998 ranks and no dereference', function () {
  assert.strictEqual(3 * TREE_NODES, 15000);
  assert.strictEqual(trees.ops.selectCalls, 14999);
  assert.strictEqual(trees.ops.rankCalls, 9998);
  assert.strictEqual(trees.ops.scanSteps, 0, 'a scan would make the constant-time claim false');

  quotes('succinct-trees', ['15 000 navigation calls', '14 999 selects and 9 998 ranks',
    '0 pointer dereferences', 'each operation is one select plus at most one rank']);
});

test('succinct-trees: 240 000 pointer bytes against 1 358 is 177x for the shape alone', function () {
  assert.strictEqual(trees.pointerBytes, TREE_NODES * 48);
  assert.strictEqual(trees.pointerBytes, 240000);
  assert.strictEqual(fixed(trees.saving, 0), '177');

  quotes('succinct-trees', ['pointers: 5 000 × 48 bytes = 240 000', 'LOUDS:    1 358 bytes',
    '177× less for the same tree and the same navigation']);
});

test('succinct-trees: adding the payload back takes 177x down to 5.8x', function () {
  assert.strictEqual(trees.louds.valueBytes, TREE_NODES * 8);
  assert.strictEqual(trees.louds.valueBytes, 40000);
  assert.strictEqual(trees.louds.totalBytes + trees.louds.valueBytes, 41358);
  assert.strictEqual(fixed(trees.savingWithValues, 1), '5.8');
  assert.strictEqual(fixed(240000 / 41358, 1), '5.8');

  quotes('succinct-trees', ['shape as LOUDS:            1 358 bytes', '5 000 values at 8 bytes:  40 000 bytes',
    'total:                    41 358 bytes', '5.8× against pointers, not 177× - the payload now dominates',
    '5 000 nodes: 240 KB against 41 KB - both trivially resident']);
});

test('succinct-trees: balanced parentheses is exactly 2 bits a node', function () {
  assert.strictEqual(trees.parentheses.bits, 2 * TREE_NODES);
  assert.strictEqual(trees.parentheses.bits, 10000);
  assert.strictEqual(trees.parentheses.bitsPerNode, 2);
  assert.ok(trees.parentheses.bits < trees.louds.bits, 'BP saves LOUDS its super-root bit');

  quotes('succinct-trees', ['BP: exactly 2 bits per node, subtree size = (close − open + 1) / 2',
    'but navigation needs findClose, which this implementation scans for',
    'constant-time BP navigation needs a range-min-max tree that is not built here']);
});

test('succinct-trees: a wavelet tree hits its own bound and answers quantiles in 16 ranks', function () {
  const wavelet = SuccinctLab.waveletRun({});
  const shape = wavelet.shape;

  assert.strictEqual(wavelet.wrong, 0);
  assert.strictEqual(shape.levels, 8);
  assert.strictEqual(shape.levels, Math.log2(shape.alphabet));
  assert.strictEqual(shape.vectors, 255);
  assert.strictEqual(shape.vectors, shape.alphabet - 1);
  assert.strictEqual(shape.bitsPerSymbol, 8);
  assert.strictEqual(shape.bitsPerSymbol, shape.bound);
  assert.strictEqual(fixed(wavelet.rankCallsPerQuery, 1), '16.0');
  assert.strictEqual(wavelet.rankCallsPerQuery, 2 * shape.levels);
  assert.strictEqual(shape.length, 4000);

  quotes('succinct-trees', ['4 000 symbols over a 256-letter alphabet: exactly 8 bits per symbol, ' +
    'which is log₂ 256.']);
});

/* ------------------------------------------------ 9.9 compressed-bitmaps */

const bitmaps = SuccinctLab.bitmapKinds({ count: 20000, seed: 37 });

function kind(name) {
  const row = bitmaps.filter(function (item) { return item.kind === name; })[0];
  assert.ok(row, 'no ' + name + ' row in bitmapKinds');
  return row;
}

test('compressed-bitmaps: the 4 096-value crossover is arithmetic, not a setting', function () {
  assert.strictEqual(4096 * 2, 8192);
  assert.strictEqual(65536 / 8, 8192);
  quotes('compressed-bitmaps', ['4 096 values × 2 bytes = 8 192 bytes',
    'a 65 536-bit bitmap        = 8 192 bytes',
    'above 4 096 values in a chunk, the bitmap is smaller *and* has O(1) membership']);
});

test('compressed-bitmaps: the sparse set picks 77 array containers for 41 232 bytes', function () {
  const row = kind('sparse');

  assert.strictEqual(row.shape.containers.array, 77);
  assert.strictEqual(row.shape.containers.bitmap, 0);
  assert.strictEqual(row.shape.bytes, 41232);
  assert.strictEqual(fixed(row.shape.bitsPerValue), '16.49');
  assert.strictEqual(row.shape.rawBitmapBytes, 630784);
  assert.strictEqual(fixed(row.againstRaw, 0), '15');

  quotes('compressed-bitmaps', ['77 array containers, 0 bitmaps', '41 232 bytes, 16.49 bits per value',
    'a plain bitmap over that universe would be 630 784 bytes - 15× more']);
});

test('compressed-bitmaps: the dense set picks one bitmap container for 8 208 bytes', function () {
  const row = kind('dense');

  assert.strictEqual(row.shape.containers.bitmap, 1);
  assert.strictEqual(row.shape.containers.array, 0);
  assert.strictEqual(row.shape.bytes, 8208);
  assert.strictEqual(fixed(row.shape.bitsPerValue), '3.28');

  quotes('compressed-bitmaps', ['1 bitmap container, 0 arrays', '8 208 bytes, 3.28 bits per value',
    'the container rule fired and picked the right one']);
});

test('compressed-bitmaps: run optimisation takes the run-heavy set from 8 208 to 808', function () {
  const row = kind('runs');

  assert.strictEqual(row.shape.containers.bitmap, 1);
  assert.strictEqual(row.shape.bytes, 8208);
  assert.strictEqual(row.optimised.containers.run, 1);
  assert.strictEqual(row.optimised.containers.bitmap, 0);
  assert.strictEqual(row.optimised.bytes, 808);
  assert.strictEqual(fixed(row.optimisedSaving, 0), '10');

  quotes('compressed-bitmaps', ['as built: 1 bitmap container, 8 208 bytes',
    'after runOptimize: 1 run container, 808 bytes',
    '10× smaller, because 4 bytes per run beat 8 KB of bitmap']);
});

test('compressed-bitmaps: an intersection does the work of the smaller side', function () {
  const paths = SuccinctLab.intersectionPaths({});

  assert.strictEqual(paths.mixed.stats.elementsTouched, 3);
  assert.strictEqual(paths.mixed.stats.probes, 3);
  assert.strictEqual(paths.mixed.stats.wordsTouched, 0);
  assert.strictEqual(paths.both.stats.wordsTouched, 2048);
  assert.strictEqual(paths.both.stats.elementsTouched, 0);
  assert.strictEqual(2048, 65536 / 32, 'a bitmap-versus-bitmap intersection is one pass over the words');

  quotes('compressed-bitmaps', ['a 5-element array container against a bitmap container:',
    '  3 elements touched, 0 bitmap words', 'two bitmap containers:', '  2 048 words touched, 0 elements',
    'the work is the size of the smaller side, not of the universe']);
});

test('compressed-bitmaps: on one dense random chunk Roaring is the largest of the three', function () {
  const row = kind('dense');

  assert.strictEqual(row.shape.bytes, 8208);
  assert.strictEqual(row.shape.rawBitmapBytes, 8192);
  assert.strictEqual(row.wah.bytes, 5164);
  assert.ok(row.shape.bytes > row.shape.rawBitmapBytes, 'the container header is why');
  assert.ok(row.shape.bytes > row.wah.bytes, 'the example claims Roaring loses here, and it must');
  assert.strictEqual(row.shape.chunks, 1);

  quotes('compressed-bitmaps', ['Roaring:     8 208 bytes (one bitmap container plus its header)',
    'raw bitmap:  8 192 bytes', 'WAH:         5 164 bytes',
    'Roaring is the largest of the three on dense uniformly random data',
    'nothing about Roaring can beat a raw bitmap on 1 dense chunk: 8 208 against 8 192']);
});

test('compressed-bitmaps: WAH falls apart on the sparse set - 141 972 bytes', function () {
  const row = kind('sparse');

  assert.strictEqual(row.wah.bytes, 141972);
  assert.strictEqual(row.wah.literals, 18838);
  assert.strictEqual(row.wah.fills, 16655);
  assert.strictEqual(row.wah.bytes, (row.wah.literals + row.wah.fills) * 4);
  assert.strictEqual(fixed(row.againstWah, 1), '3.4');

  quotes('compressed-bitmaps', ['sparse set: WAH 141 972 bytes against Roaring\'s 41 232',
    '18 838 literal words and 16 655 fill words', '3.4× larger']);
});

test('compressed-bitmaps: the sorted array baseline is 80 000 bytes in every case', function () {
  bitmaps.forEach(function (row) {
    assert.strictEqual(row.shape.sortedArrayBytes, 20000 * 4);
    assert.strictEqual(row.shape.sortedArrayBytes, 80000);
  });
  assert.ok(kind('sparse').shape.sortedArrayBytes < kind('sparse').shape.rawBitmapBytes,
    'the array beats a raw bitmap once the universe is wide');

  quotes('compressed-bitmaps', ['20 000 values × 4 bytes = 80 000 bytes, in every case',
    'sparse:  Roaring 41 232 - Roaring wins', 'dense:   Roaring  8 208 - Roaring wins',
    'raw bitmap over the sparse universe: 630 784 - the array wins',
    'the sorted array beats a raw bitmap whenever the universe is wide']);
});

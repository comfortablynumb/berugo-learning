/**
 * SuccinctLab - the measurement harness for the succinct half of M09.
 *
 * Every claim in these three sections is a claim about *space with the queries
 * still working*, which means neither number is worth anything on its own: a
 * bit vector that is 2% overhead and cannot answer select, or a Roaring bitmap
 * that is small until it is intersected, has proved nothing. So each runner
 * here reports the shape and the query cost from the same object, and the
 * comparisons it prints - a positions array, a pointer tree, a raw bitmap, WAH -
 * are the alternatives a reader would otherwise assume are cheaper.
 *
 * Nothing here touches the DOM.
 */
(function (root, factory) {
  const api = factory(root, typeof require === 'function' ? require : null);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SuccinctLab = api;
}(typeof window !== 'undefined' ? window : null, function (scope, requireFn) {
  'use strict';

  function load(name, global) {
    if (scope && scope[global]) return scope[global];
    return requireFn ? requireFn(name) : null;
  }

  function Random() { return load('../utils/random.js', 'Random'); }
  function BitVector() { return load('../algorithms/bit-vector.js', 'BitVector'); }
  function SuccinctTree() { return load('../algorithms/succinct-tree.js', 'SuccinctTree'); }
  function Roaring() { return load('../algorithms/roaring.js', 'Roaring'); }

  /* --------------------------------------------------- 9.7 rank and select */

  function bitsFor(count, density, seed) {
    const random = Random().seeded(seed || 3);
    const bits = new Array(count);
    for (let i = 0; i < count; i += 1) bits[i] = random.next() < density ? 1 : 0;
    return bits;
  }

  /**
   * One bit vector, its index, and the cost of the two queries the index
   * exists for. The rank and select counters are read on a reset counter so
   * the build does not swamp them.
   */
  function bitVectorRun(options) {
    const settings = options || {};
    const count = Math.max(64, Math.floor(settings.bits || 65536));
    const density = Math.min(0.99, Math.max(0.01, settings.density || 0.5));
    const queries = Math.max(1, Math.floor(settings.queries || 1000));

    const vector = BitVector().create(bitsFor(count, density, settings.seed || 3));
    const shape = vector.shape();
    const random = Random().seeded(settings.querySeed || 3);

    vector.resetStats();
    for (let i = 0; i < queries; i += 1) vector.rank1(random.int(count));
    const rank = vector.stats();

    vector.resetStats();
    for (let i = 0; i < queries; i += 1) vector.select1(1 + random.int(Math.max(1, shape.ones)));
    const select = vector.stats();

    return {
      bits: count, density: density, queries: queries, shape: shape,
      rankLookups: rank.lookups / queries,
      rankWords: rank.wordsScanned / queries,
      selectSteps: select.binarySteps / queries,
      selectWords: select.wordsScanned / queries,
      positionsRatio: shape.positionArrayBytes / (shape.rawBytes + shape.indexBytes)
    };
  }

  /** A monotone sequence in Elias-Fano, against the information-theoretic
   *  bound it is supposed to sit just under. */
  function eliasFanoRun(options) {
    const settings = options || {};
    const count = Math.max(8, Math.floor(settings.count || 5000));
    const gap = Math.max(2, Math.floor(settings.gap || 400));
    const random = Random().seeded(settings.seed || 17);

    const values = new Array(count);
    let running = 0;
    for (let i = 0; i < count; i += 1) {
      running += 1 + random.int(gap);
      values[i] = running;
    }

    const encoded = BitVector().eliasFano(values);
    let wrong = 0;
    for (let i = 0; i < count; i += 1) {
      if (encoded.get(i) !== values[i]) wrong += 1;
    }
    return { count: count, gap: gap, wrong: wrong, shape: encoded.shape() };
  }

  /* ---------------------------------------------------- 9.8 succinct trees */

  function randomTree(nodes, seed) {
    const random = Random().seeded(seed || 23);
    const all = [{ value: 0, children: [] }];
    for (let i = 1; i < nodes; i += 1) {
      const parent = all[random.int(all.length)];
      const child = { value: i, children: [] };
      parent.children.push(child);
      all.push(child);
    }
    return all[0];
  }

  /**
   * The same tree three ways: pointers, LOUDS and balanced parentheses. The
   * navigation loop afterwards is the part that makes the comparison fair -
   * a bit string that cannot be walked is not an encoding of a tree.
   */
  function treeEncodings(options) {
    const settings = options || {};
    const nodes = Math.max(8, Math.floor(settings.nodes || 5000));
    const source = randomTree(nodes, settings.seed || 23);

    const pointer = SuccinctTree().pointerTree(source);
    const louds = SuccinctTree().louds(source);
    const parens = SuccinctTree().parentheses(source);

    louds.resetStats();
    let mismatches = 0;
    for (let node = 1; node <= nodes; node += 1) {
      louds.firstChild(node);
      louds.nextSibling(node);
      if (louds.parent(node) === undefined) mismatches += 1;
    }

    return {
      nodes: nodes,
      pointerBytes: pointer.bytes,
      louds: louds.shape(),
      parentheses: parens.shape(),
      ops: louds.stats(),
      mismatches: mismatches,
      saving: louds.shape().pointerBytes / Math.max(1, louds.shape().totalBytes),
      savingWithValues: louds.shape().pointerBytes /
        Math.max(1, louds.shape().totalBytes + louds.shape().valueBytes)
    };
  }

  /** A wavelet tree over a byte alphabet, and what a quantile costs in rank
   *  calls - the query that justifies the whole structure. */
  function waveletRun(options) {
    const settings = options || {};
    const length = Math.max(16, Math.floor(settings.length || 4000));
    const alphabet = Math.max(2, Math.floor(settings.alphabet || 256));
    const queries = Math.max(1, Math.floor(settings.queries || 500));
    const random = Random().seeded(settings.seed || 31);

    const symbols = new Array(length);
    for (let i = 0; i < length; i += 1) symbols[i] = random.int(alphabet);

    const tree = SuccinctTree().wavelet(symbols, { alphabet: alphabet });
    const sorted = symbols.slice().sort(function (a, b) { return a - b; });

    tree.resetStats();
    let wrong = 0;
    for (let i = 0; i < queries; i += 1) {
      const k = 1 + random.int(length);
      if (tree.quantile(0, length - 1, k) !== sorted[k - 1]) wrong += 1;
    }

    return {
      length: length, alphabet: alphabet, queries: queries, wrong: wrong,
      shape: tree.shape(),
      rankCallsPerQuery: tree.stats().rankCalls / queries
    };
  }

  /* ----------------------------------------------- 9.9 compressed bitmaps */

  const KINDS = ['sparse', 'dense', 'runs'];

  function sampleSet(kind, count, seed) {
    const random = Random().seeded(seed || 37);
    const set = new Set();
    if (kind === 'sparse') while (set.size < count) set.add(random.int(5000000));
    if (kind === 'dense') while (set.size < count) set.add(random.int(count * 2));
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

  /**
   * Three value distributions through the same encoder, with WAH and the two
   * uncompressed layouts beside them. The point of the table is that no row
   * wins every column.
   */
  function bitmapKinds(options) {
    const settings = options || {};
    const count = Math.max(100, Math.floor(settings.count || 20000));
    const engine = Roaring().create({});

    return KINDS.map(function (kind) {
      const values = sampleSet(kind, count, settings.seed || 37);
      const bitmap = engine.fromArray(values);
      const shape = engine.shape(bitmap);
      const optimised = engine.shape(engine.runOptimize(bitmap));
      const wah = Roaring().wah(values);

      return {
        kind: kind, count: values.length, shape: shape, optimised: optimised, wah: wah,
        againstRaw: shape.rawBitmapBytes / Math.max(1, shape.bytes),
        againstWah: wah.bytes / Math.max(1, shape.bytes),
        optimisedSaving: shape.bytes / Math.max(1, optimised.bytes)
      };
    });
  }

  /** The two intersection paths, counted. A sparse operand against a dense one
   *  should touch three elements, not two thousand words. */
  function intersectionPaths(options) {
    const settings = options || {};
    const engine = Roaring().create({});
    const dense = engine.fromArray(sampleSet('dense', Math.floor(settings.count || 20000), settings.seed || 59));
    const tiny = engine.fromArray([1, 2, 3, 70000, 70001]);

    engine.resetStats();
    const mixed = engine.intersection(tiny, dense);
    const mixedStats = engine.stats();

    engine.resetStats();
    const both = engine.intersection(dense, dense);
    const bothStats = engine.stats();

    return {
      mixed: { stats: mixedStats, size: engine.size(mixed) },
      both: { stats: bothStats, size: engine.size(both) }
    };
  }

  return {
    bitsFor: bitsFor,
    bitVectorRun: bitVectorRun,
    eliasFanoRun: eliasFanoRun,
    randomTree: randomTree,
    treeEncodings: treeEncodings,
    waveletRun: waveletRun,
    sampleSet: sampleSet,
    bitmapKinds: bitmapKinds,
    intersectionPaths: intersectionPaths,
    kinds: KINDS.slice()
  };
}));

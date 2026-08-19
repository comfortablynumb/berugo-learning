/**
 * One array, one operation mix, six range structures.
 *
 * The comparison is deliberately not a stopwatch. Every structure here reports
 * the array slots it touches per operation, because that is the number the
 * asymptotics hide: a Fenwick tree and a segment tree are both "O(log n)" and
 * one touches about log n slots while the other touches about four times that,
 * and on a competitive-programming time limit or a hot analytics path the
 * constant is the whole decision.
 *
 * Every mixed run is also checked against a brute-force replay of the same
 * operations on a plain array. A lazy segment tree with the push convention
 * backwards is right whenever the query range happens to align with a node,
 * which is most of the time on hand-picked examples and none of the time under
 * a hundred thousand random operations.
 */
(function (root, factory) {
  const api = factory(root, typeof require === 'function' ? require : null);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.RangeLab = api;
}(typeof window !== 'undefined' ? window : null, function (scope, requireFn) {
  'use strict';

  function load(name, global) {
    if (scope && scope[global]) return scope[global];
    return requireFn ? requireFn(name) : null;
  }

  function Random() { return load('../utils/random.js', 'Random'); }
  function Structures() { return load('../algorithms/range-structures.js', 'RangeStructures'); }

  function values(options) {
    const settings = options || {};
    const n = Math.max(1, Math.floor(settings.n || 1024));
    const random = Random().seeded(settings.seed || 1);
    const out = new Array(n);
    const spread = settings.spread || 1000;
    for (let i = 0; i < n; i += 1) out[i] = Math.floor(random.next() * spread);
    return out;
  }

  /** A reproducible operation stream: `updateShare` of them are point updates
   *  and the rest are range queries over spans drawn from the whole array. */
  function operations(options) {
    const settings = options || {};
    const n = Math.max(1, Math.floor(settings.n || 1024));
    const count = Math.max(1, Math.floor(settings.count || 20000));
    const share = settings.updateShare === undefined ? 0.5 : settings.updateShare;
    const random = Random().seeded((settings.seed || 1) + 4242);
    const out = new Array(count);

    for (let i = 0; i < count; i += 1) {
      if (random.next() < share) {
        out[i] = { kind: 'update', index: random.int(n), value: Math.floor(random.next() * 1000) };
      } else {
        const a = random.int(n);
        const b = random.int(n);
        out[i] = { kind: 'query', from: Math.min(a, b), to: Math.max(a, b) };
      }
    }
    return out;
  }

  /* ------------------------------------------------------- sum families */

  const SUM_FAMILIES = [
    {
      id: 'prefix-sums', label: 'prefix sums',
      build: function (data) { return Structures().prefixSums(data); },
      update: function (structure, op, state) {
        structure.add(op.index, op.value - state[op.index]);
        state[op.index] = op.value;
      },
      query: function (structure, op) { return structure.rangeSum(op.from, op.to); }
    },
    {
      id: 'fenwick', label: 'Fenwick tree',
      build: function (data) { return Structures().fenwick(data); },
      update: function (structure, op, state) {
        structure.add(op.index, op.value - state[op.index]);
        state[op.index] = op.value;
      },
      query: function (structure, op) { return structure.rangeSum(op.from, op.to); }
    },
    {
      id: 'segment-tree', label: 'segment tree',
      build: function (data) { return Structures().segmentTree(data, { monoid: 'sum' }); },
      update: function (structure, op, state) { structure.update(op.index, op.value); state[op.index] = op.value; },
      query: function (structure, op) { return structure.query(op.from, op.to); }
    },
    {
      id: 'sqrt-blocks', label: 'sqrt decomposition',
      build: function (data) { return Structures().sqrtBlocks(data, { monoid: 'sum' }); },
      update: function (structure, op, state) { structure.update(op.index, op.value); state[op.index] = op.value; },
      query: function (structure, op) { return structure.query(op.from, op.to); }
    }
  ];

  function bruteSum(state, op) {
    let total = 0;
    for (let i = op.from; i <= op.to; i += 1) total += state[i];
    return total;
  }

  /**
   * Replays one operation stream through one structure and through a plain
   * array, and reports both the cost and the number of answers that differed.
   */
  function replay(family, data, ops) {
    const structure = family.build(data);
    const state = data.slice();
    const truth = data.slice();
    const tally = { mismatches: 0, queries: 0, updateSlots: 0, querySlots: 0 };

    ops.forEach(function (op) {
      const before = structure.stats().slotsTouched;
      if (op.kind === 'update') {
        family.update(structure, op, state);
        truth[op.index] = op.value;
        tally.updateSlots += structure.stats().slotsTouched - before;
        return;
      }
      tally.queries += 1;
      if (family.query(structure, op) !== bruteSum(truth, op)) tally.mismatches += 1;
      tally.querySlots += structure.stats().slotsTouched - before;
    });

    const updates = ops.length - tally.queries;
    return {
      id: family.id,
      label: family.label,
      mismatches: tally.mismatches,
      queries: tally.queries,
      updates: updates,
      slotsPerUpdate: updates ? tally.updateSlots / updates : 0,
      slotsPerQuery: tally.queries ? tally.querySlots / tally.queries : 0,
      slotsTouched: tally.updateSlots + tally.querySlots,
      bytes: structure.bytes(),
      bytesPerElement: structure.bytes() / data.length
    };
  }

  /** The headline table: same array, same operations, every sum structure. */
  function compare(options) {
    const settings = options || {};
    const data = settings.values || values(settings);
    const ops = settings.operations || operations({
      n: data.length, count: settings.count, seed: settings.seed, updateShare: settings.updateShare
    });

    const rows = SUM_FAMILIES
      .filter(function (family) { return settings.include ? settings.include.indexOf(family.id) !== -1 : true; })
      .map(function (family) { return replay(family, data, ops); });

    const cheapest = rows.reduce(function (best, row) {
      return !best || row.slotsTouched < best.slotsTouched ? row : best;
    }, null);

    return { rows: rows, cheapest: cheapest, n: data.length, operations: ops.length };
  }

  /* ------------------------------------------------------ lazy and rest */

  /**
   * Range add and range min, against a brute-force array. This is the one the
   * acceptance criterion names, because the lazy push convention is the single
   * easiest thing in this milestone to get subtly wrong.
   */
  function lazyRun(options) {
    const settings = options || {};
    const data = settings.values || values(settings);
    const count = Math.max(1, Math.floor(settings.count || 20000));
    const random = Random().seeded((settings.seed || 1) + 77);
    const tree = Structures().lazySegmentTree(data);
    const truth = data.slice();
    let mismatches = 0;
    let queries = 0;

    for (let i = 0; i < count; i += 1) {
      const a = random.int(data.length);
      const b = random.int(data.length);
      const from = Math.min(a, b);
      const to = Math.max(a, b);
      if (random.next() < 0.5) {
        const delta = random.int(41) - 20;
        tree.rangeAdd(from, to, delta);
        for (let j = from; j <= to; j += 1) truth[j] += delta;
        continue;
      }
      queries += 1;
      let best = Infinity;
      for (let j = from; j <= to; j += 1) best = Math.min(best, truth[j]);
      if (tree.rangeMin(from, to) !== best) mismatches += 1;
    }

    const stats = tree.stats();
    return {
      operations: count,
      queries: queries,
      updates: count - queries,
      mismatches: mismatches,
      slotsPerOperation: stats.slotsTouched / count,
      bytes: tree.bytes(),
      n: data.length
    };
  }

  /**
   * Sparse table against a segment tree on the *same* min queries, so the
   * O(1)-versus-O(log n) claim comes with its memory price attached.
   */
  function idempotentRun(options) {
    const settings = options || {};
    const data = settings.values || values(settings);
    const count = Math.max(1, Math.floor(settings.count || 20000));
    const random = Random().seeded((settings.seed || 1) + 991);
    const table = Structures().sparseTable(data, { monoid: 'min' });
    const tree = Structures().segmentTree(data, { monoid: 'min' });
    let mismatches = 0;

    for (let i = 0; i < count; i += 1) {
      const a = random.int(data.length);
      const b = random.int(data.length);
      const from = Math.min(a, b);
      const to = Math.max(a, b);
      if (table.query(from, to) !== tree.query(from, to)) mismatches += 1;
    }

    return {
      queries: count,
      mismatches: mismatches,
      tableSlotsPerQuery: table.stats().slotsTouched / count,
      treeSlotsPerQuery: tree.stats().slotsTouched / count,
      tableBytes: table.bytes(),
      treeBytes: tree.bytes(),
      memoryRatio: table.bytes() / tree.bytes(),
      levels: table.levels,
      n: data.length
    };
  }

  /**
   * The order-statistic query no monoid can answer, and the structure that
   * pays O(n log n) memory to answer it anyway.
   */
  function orderStatisticRun(options) {
    const settings = options || {};
    const data = settings.values || values(settings);
    const count = Math.max(1, Math.floor(settings.count || 2000));
    const random = Random().seeded((settings.seed || 1) + 313);
    const tree = Structures().mergeSortTree(data);
    let mismatches = 0;

    for (let i = 0; i < count; i += 1) {
      const a = random.int(data.length);
      const b = random.int(data.length);
      const from = Math.min(a, b);
      const to = Math.max(a, b);
      const threshold = random.int(1000);
      let truth = 0;
      for (let j = from; j <= to; j += 1) if (data[j] < threshold) truth += 1;
      if (tree.countLessThan(from, to, threshold) !== truth) mismatches += 1;
    }

    const stats = tree.stats();
    return {
      queries: count,
      mismatches: mismatches,
      nodesPerQuery: stats.slotsTouched / count,
      comparisonsPerQuery: stats.comparisons / count,
      bytes: tree.bytes(),
      bytesPerElement: tree.bytes() / data.length,
      n: data.length
    };
  }

  /** The canonical decomposition of one interval, for the diagram and the
   *  "at most 2 log n nodes" claim. */
  function decomposition(options) {
    const settings = options || {};
    const data = settings.values || values(settings);
    const tree = Structures().segmentTree(data, { monoid: settings.monoid || 'sum' });
    const nodes = tree.decomposition(settings.from, settings.to);
    return {
      nodes: nodes,
      count: nodes.length,
      bound: 2 * Math.ceil(Math.log2(Math.max(2, data.length))),
      span: settings.to - settings.from + 1,
      n: data.length
    };
  }

  return {
    values: values,
    operations: operations,
    compare: compare,
    replay: replay,
    lazyRun: lazyRun,
    idempotentRun: idempotentRun,
    orderStatisticRun: orderStatisticRun,
    decomposition: decomposition,
    families: SUM_FAMILIES.map(function (family) { return { id: family.id, label: family.label }; })
  };
}));

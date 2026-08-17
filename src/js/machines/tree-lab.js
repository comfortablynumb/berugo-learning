/**
 * One harness for every ordered structure in M04.
 *
 * A tree is anything with { name, insert, remove, has, keys, size, height,
 * checkInvariants, stats }. The lab builds an operation sequence once and
 * replays *the same sequence* against each structure, checks every answer
 * against a reference sorted set, and reports comparisons, rotations and
 * height rather than wall-clock time - so a comparison is a property of the
 * family rather than of the machine that ran it.
 *
 * The workloads matter as much as the structures. Sorted insertion is not an
 * adversarial curiosity: it is what a bulk load from an ordered export does,
 * and it is the input that turns an unbalanced BST into a linked list. Zipf
 * access is what a cache-like workload looks like, and it is the one a splay
 * tree is supposed to win.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.TreeLab = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const KINDS = ['random', 'sorted', 'reverse', 'sawtooth', 'zipf', 'churn'];

  /** A Zipf-distributed index in [0, n): rank r appears about 1/r as often as
   *  rank 1. Built by inverting the cumulative distribution once. */
  function zipfTable(n, skew) {
    const weights = new Array(n);
    let total = 0;
    for (let i = 0; i < n; i += 1) {
      weights[i] = 1 / Math.pow(i + 1, skew);
      total += weights[i];
    }
    let running = 0;
    for (let i = 0; i < n; i += 1) {
      running += weights[i] / total;
      weights[i] = running;
    }
    return weights;
  }

  function zipfPick(table, rng) {
    const value = rng.next();
    let lo = 0;
    let hi = table.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (table[mid] < value) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  function insertOps(keys) {
    return keys.map(function (key) { return { op: 'insert', key: key }; });
  }

  /** A build phase followed by an access phase, which is what makes the
   *  access distribution the thing being measured. */
  function accessOps(options) {
    const span = options.span;
    const rng = options.rng;
    const build = [];
    for (let i = 0; i < span; i += 1) build.push(i);

    const ops = insertOps(options.shuffled ? shuffle(build, rng) : build);
    const table = options.kind === 'zipf' ? zipfTable(span, options.skew || 1) : null;

    for (let i = 0; i < options.accesses; i += 1) {
      const key = table ? zipfPick(table, rng) : rng.int(span);
      ops.push({ op: 'find', key: key });
    }
    return ops;
  }

  function shuffle(list, rng) {
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = rng.int(i + 1);
      const tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }

  /** The workload catalogue. Every kind returns a flat operation list, so the
   *  replay loop has no idea which workload it is running. */
  function operations(options) {
    const settings = options || {};
    const count = settings.count || 1000;
    const span = settings.span || count;
    const rng = settings.rng;

    if (settings.kind === 'sorted') {
      return insertOps(Array.from({ length: count }, function (_, i) { return i; }));
    }
    if (settings.kind === 'reverse') {
      return insertOps(Array.from({ length: count }, function (_, i) { return count - i; }));
    }
    if (settings.kind === 'sawtooth') {
      const keys = [];
      const run = Math.max(2, Math.floor(count / 20));
      for (let i = 0; i < count; i += 1) keys.push((Math.floor(i / run) * run) + (run - 1 - (i % run)));
      return insertOps(keys);
    }
    if (settings.kind === 'zipf') {
      return accessOps({ span: span, accesses: count, rng: rng, kind: 'zipf', skew: settings.skew, shuffled: true });
    }
    if (settings.kind === 'churn') return churnOps(count, span, rng);
    return insertOps(shuffle(Array.from({ length: count }, function (_, i) { return i; }), rng));
  }

  /** Half inserts, half deletes, drawn from the same span - the sequence that
   *  separates families whose deletion is cheap from families whose deletion
   *  is a second algorithm. */
  function churnOps(count, span, rng) {
    const ops = [];
    for (let i = 0; i < count; i += 1) {
      const key = rng.int(span);
      const roll = rng.next();
      if (roll < 0.45) ops.push({ op: 'insert', key: key });
      else if (roll < 0.75) ops.push({ op: 'remove', key: key });
      else ops.push({ op: 'find', key: key });
    }
    return ops;
  }

  function applyOne(tree, step, reference) {
    if (step.op === 'insert') {
      const inserted = tree.insert(step.key, step.key);
      const isNew = !reference.has(step.key);
      reference.add(step.key);
      return inserted === isNew ? null : 'insert(' + step.key + ') reported ' + inserted;
    }
    if (step.op === 'remove') {
      const removed = tree.remove(step.key);
      const existed = reference.delete(step.key);
      return removed === existed ? null : 'remove(' + step.key + ') reported ' + removed;
    }
    const found = tree.has(step.key);
    return found === reference.has(step.key) ? null : 'has(' + step.key + ') reported ' + found;
  }

  /** Replays the sequence against one structure, checking every answer and
   *  the family's own invariants every `checkEvery` operations. */
  function replay(options) {
    const tree = options.tree;
    const steps = options.operations;
    const checkEvery = options.checkEvery || 0;
    /* Where the measurement starts. A workload that builds the structure and
       then accesses it must not charge the build to the access phase, or the
       build swamps the effect the workload exists to show. */
    const measureFrom = options.measureFrom || 0;
    const reference = new Set();
    const errors = [];

    tree.resetStats();
    for (let i = 0; i < steps.length && errors.length < 3; i += 1) {
      if (i === measureFrom && measureFrom) tree.resetStats();
      const mismatch = applyOne(tree, steps[i], reference);
      if (mismatch) errors.push('step ' + i + ': ' + mismatch);
      if (checkEvery && i % checkEvery === 0) {
        const invariants = tree.checkInvariants();
        if (!invariants.ok) errors.push('step ' + i + ': ' + invariants.errors[0]);
      }
    }

    const expected = Array.from(reference).sort(function (a, b) { return a - b; });
    const actual = tree.keys();
    if (actual.length !== expected.length) {
      errors.push('holds ' + actual.length + ' keys, the reference holds ' + expected.length);
    } else {
      for (let i = 0; i < expected.length; i += 1) {
        if (actual[i] !== expected[i]) { errors.push('key ' + i + ' is ' + actual[i] + ', expected ' + expected[i]); break; }
      }
    }

    const invariants = tree.checkInvariants();
    if (!invariants.ok) errors.push(invariants.errors[0]);

    return {
      name: tree.name,
      ok: errors.length === 0,
      errors: errors,
      stats: tree.stats(),
      size: tree.size(),
      height: tree.height()
    };
  }

  /** Runs every builder over one shared sequence and returns a row each. */
  function compare(options) {
    const steps = options.operations;
    return (options.builders || []).map(function (builder) {
      return replay({
        tree: builder.create(),
        operations: steps,
        checkEvery: options.checkEvery || 0,
        measureFrom: options.measureFrom || 0
      });
    });
  }

  /** Where the access phase of a build-then-access workload begins. */
  function firstAccess(steps) {
    for (let i = 0; i < steps.length; i += 1) {
      if (steps[i].op === 'find') return i;
    }
    return 0;
  }

  return {
    KINDS: KINDS,
    operations: operations,
    replay: replay,
    compare: compare,
    firstAccess: firstAccess,
    zipfTable: zipfTable,
    zipfPick: zipfPick,
    shuffle: shuffle
  };
}));

/**
 * One operation sequence, every persistence strategy, and the same question
 * asked of all of them: does *every* version still answer correctly, and what
 * did keeping them cost?
 *
 * The correctness half is the part that is easy to skip and impossible to
 * recover from. A persistent structure that is right at the latest version and
 * wrong three versions back looks perfect to every test that only checks the
 * end state, and the failure surfaces as a snapshot read returning data that
 * never existed. Every runner here therefore replays the whole history against
 * a plain-array or plain-Set model and reports the number of versions that
 * disagreed, rather than throwing on the first one.
 *
 * The cost half is measured as *distinct nodes reachable from any version*,
 * which is the only figure that captures sharing. Counting allocations
 * flatters path copying; counting the latest version flatters everything.
 *
 * Nothing here touches the DOM.
 */
(function (root, factory) {
  const api = factory(root, typeof require === 'function' ? require : null);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.VersionLab = api;
}(typeof window !== 'undefined' ? window : null, function (scope, requireFn) {
  'use strict';

  function load(name, global) {
    if (scope && scope[global]) return scope[global];
    return requireFn ? requireFn(name) : null;
  }

  function Random() { return load('../utils/random.js', 'Random'); }
  function PersistentBst() { return load('../algorithms/persistent-bst.js', 'PersistentBst'); }
  function PersistentQueue() { return load('../algorithms/persistent-queue.js', 'PersistentQueue'); }
  function PersistentSegmentTree() { return load('../algorithms/persistent-segment-tree.js', 'PersistentSegmentTree'); }
  function Hamt() { return load('../algorithms/hamt.js', 'Hamt'); }
  function Zipper() { return load('../algorithms/zipper.js', 'Zipper'); }
  function FingerTree() { return load('../algorithms/finger-tree.js', 'FingerTree'); }

  /* ------------------------------------------------- 9.1 three strategies */

  function keyStream(options) {
    const settings = options || {};
    const count = Math.max(1, Math.floor(settings.count || 400));
    const universe = Math.max(count, Math.floor(settings.universe || count * 3));
    const random = Random().seeded(settings.seed || 1);
    const out = new Array(count);
    for (let i = 0; i < count; i += 1) out[i] = random.int(universe);
    return out;
  }

  /**
   * Every strategy over the same key stream, scored on every version.
   *
   * The reference is rebuilt incrementally rather than by re-sorting a Set per
   * version, because at 400 versions the oracle is otherwise the slowest thing
   * in the milestone.
   */
  function persistenceCompare(options) {
    const settings = options || {};
    const keys = settings.keys || keyStream(settings);
    const expected = referenceVersions(keys);

    return PersistentBst().strategies.map(function (strategy) {
      const tree = PersistentBst().create({ strategy: strategy });
      keys.forEach(function (key) { tree.insert(key); });

      let wrongVersions = 0;
      for (let version = 1; version <= keys.length; version += 1) {
        const got = tree.keys(version);
        const want = expected[version - 1];
        if (got.length !== want.length || got.some(function (key, i) { return key !== want[i]; })) {
          wrongVersions += 1;
        }
      }

      const shape = tree.shape();
      const stats = tree.stats();
      return {
        strategy: strategy,
        wrongVersions: wrongVersions,
        shape: shape,
        stats: stats,
        bytesPerVersion: shape.versions ? shape.bytes / shape.versions : 0,
        sharing: shape.nodesAllocated ? 1 - (shape.distinctNodes / (shape.versions * shape.liveKeys || 1)) : 0
      };
    });
  }

  function referenceVersions(keys) {
    const live = [];
    const seen = new Set();
    return keys.map(function (key) {
      if (!seen.has(key)) {
        seen.add(key);
        let at = live.length;
        while (at > 0 && live[at - 1] > key) { live[at] = live[at - 1]; at -= 1; }
        live[at] = key;
      }
      return live.slice();
    });
  }

  /** What a naive "copy the whole structure per version" would have cost, for
   *  the column that makes sharing legible. */
  function copyingCost(versions, liveKeys) {
    return versions * liveKeys * 40;
  }

  /**
   * The read side of the same three trees: membership queries spread evenly
   * over every version, counting the probes each strategy performs. This is
   * the column a space comparison leaves out, and it is where the fat-node
   * saving is given back - every pointer traversal becomes a binary search
   * over that field's history.
   */
  function readProbes(options) {
    const settings = options || {};
    const keys = settings.keys || keyStream(settings);
    const queries = Math.max(1, Math.floor(settings.queries || 2000));

    return PersistentBst().strategies.map(function (strategy) {
      const tree = PersistentBst().create({ strategy: strategy });
      keys.forEach(function (key) { tree.insert(key); });

      const random = Random().seeded(settings.probeSeed || 99);
      tree.resetStats();
      let hits = 0;
      for (let i = 0; i < queries; i += 1) {
        const version = 1 + random.int(keys.length);
        if (tree.has(keys[random.int(keys.length)], version)) hits += 1;
      }

      const stats = tree.stats();
      return {
        strategy: strategy,
        queries: queries,
        hits: hits,
        comparisons: stats.comparisons / queries,
        versionLookups: stats.versionLookups / queries,
        probes: (stats.comparisons + stats.versionLookups) / queries
      };
    });
  }

  /**
   * Two consecutive versions of a small tree, so the renderer can colour the
   * nodes this update had to build against the ones it inherited. The tree is
   * deliberately small: the argument is a shape, and a shape needs to be
   * legible before it needs to be big.
   */
  function versionPair(options) {
    const settings = options || {};
    const keys = settings.keys ||
      keyStream({ count: settings.count || 24, seed: settings.seed || 1, universe: 60 });
    const version = Math.min(Math.max(2, Math.floor(settings.version || keys.length)), keys.length);
    const tree = PersistentBst().create({ strategy: settings.strategy || 'path-copying' });
    keys.forEach(function (key) { tree.insert(key); });

    const current = tree.structure(version);
    const previous = tree.structure(version - 1);
    const inherited = new Set(previous.nodes.map(function (node) { return node.id; }));
    return {
      strategy: tree.strategy,
      version: version,
      key: keys[version - 1],
      current: current,
      previous: previous,
      copied: current.nodes.filter(function (node) { return !inherited.has(node.id); }).length,
      shared: current.nodes.filter(function (node) { return inherited.has(node.id); }).length
    };
  }

  /* --------------------------------------------- 9.2 the queue experiment */

  /**
   * Build a queue, find the version whose next `tail` triggers a rotation, and
   * reuse exactly that version. This is the whole argument of the section: the
   * strict queue re-pays the rotation on every reuse, the banker's queue pays
   * it once because the suspension is memoised, and the real-time queue never
   * had a spike to re-pay.
   */
  function queueReuse(options) {
    const settings = options || {};
    const size = Math.max(8, Math.floor(settings.size || 512));
    const reuses = Math.max(1, Math.floor(settings.reuses || 1000));

    return PersistentQueue().kinds.map(function (kind) {
      const queue = PersistentQueue().create({ kind: kind });
      let current = queue.empty();
      let victim = null;

      for (let i = 0; i < size; i += 1) {
        current = queue.snoc(current, i);
        if (current.frontLen !== undefined && current.frontLen === current.rearLen &&
          current.frontLen >= size / 8) victim = current;
        if (victim === null) victim = current;
      }

      const build = queue.stats();
      queue.resetStats();
      for (let i = 0; i < reuses; i += 1) queue.tail(victim);
      const reuse = queue.stats();

      return {
        kind: kind,
        size: size,
        reuses: reuses,
        buildWorst: build.worstOperation,
        steps: reuse.steps,
        stepsPerReuse: reuse.steps / reuses,
        worstOperation: reuse.worstOperation,
        suspensionsForced: reuse.suspensionsForced,
        memoHits: reuse.memoHits
      };
    });
  }

  /** The per-operation cost of an ordinary (non-persistent) run, so the spike
   *  the amortised argument is about is visible before it is broken. */
  function queueTimeline(options) {
    const settings = options || {};
    const size = Math.max(8, Math.floor(settings.size || 512));

    return PersistentQueue().kinds.map(function (kind) {
      const queue = PersistentQueue().create({ kind: kind });
      let current = queue.empty();
      const series = [];
      let previous = 0;

      for (let i = 0; i < size; i += 1) {
        current = queue.snoc(current, i);
        const steps = queue.stats().steps;
        series.push({ n: i, cost: steps - previous });
        previous = steps;
      }
      for (let i = 0; i < size; i += 1) {
        current = queue.tail(current);
        const steps = queue.stats().steps;
        series.push({ n: size + i, cost: steps - previous });
        previous = steps;
      }

      const costs = series.map(function (point) { return point.cost; });
      return {
        kind: kind,
        series: series,
        worst: Math.max.apply(null, costs),
        mean: costs.reduce(function (a, b) { return a + b; }, 0) / costs.length
      };
    });
  }

  /* ------------------------------------------ 9.3 versioned range queries */

  function versionedQueries(options) {
    const settings = options || {};
    const size = Math.max(8, Math.floor(settings.size || 1024));
    const updates = Math.max(1, Math.floor(settings.updates || 500));
    const random = Random().seeded(settings.seed || 3);
    const values = new Array(size);
    for (let i = 0; i < size; i += 1) values[i] = random.int(100);

    const tree = PersistentSegmentTree().create(values);
    const history = [values.slice()];
    for (let i = 0; i < updates; i += 1) {
      const index = random.int(size);
      const value = random.int(100);
      tree.update(index, value);
      const next = history[history.length - 1].slice();
      next[index] = value;
      history.push(next);
    }

    let wrong = 0;
    let checks = 0;
    for (let version = 0; version <= updates; version += 1) {
      for (let probe = 0; probe < 4; probe += 1) {
        const a = random.int(size);
        const b = random.int(size);
        const from = Math.min(a, b);
        const to = Math.max(a, b);
        let want = 0;
        for (let i = from; i <= to; i += 1) want += history[version][i];
        checks += 1;
        if (tree.rangeSum(from, to, version) !== want) wrong += 1;
      }
    }

    const shape = tree.shape();
    return {
      size: size,
      updates: updates,
      checks: checks,
      wrong: wrong,
      shape: shape,
      savingAgainstCopying: shape.bytes ? shape.bytesIfCopied / shape.bytes : 1
    };
  }

  /**
   * Bytes kept after each update, beside the bytes a snapshot per version
   * would have needed. Two lines on one chart are the whole argument for
   * versioned indexes, and both are read off the same run.
   */
  function versionGrowth(options) {
    const settings = options || {};
    const size = Math.max(8, Math.floor(settings.size || 1024));
    const updates = Math.max(1, Math.floor(settings.updates || 500));
    const random = Random().seeded(settings.seed || 3);
    const values = new Array(size);
    for (let i = 0; i < size; i += 1) values[i] = random.int(100);

    const tree = PersistentSegmentTree().create(values);
    const rows = [];
    for (let i = 0; i < updates; i += 1) {
      tree.update(random.int(size), random.int(100));
      const shape = tree.shape();
      rows.push({ version: i + 1, bytes: shape.bytes, copied: shape.bytesIfCopied });
    }
    return rows;
  }

  /** The k-th smallest in a range, from one version per prefix. */
  function rangeQuantiles(options) {
    const settings = options || {};
    const size = Math.max(8, Math.floor(settings.size || 512));
    const domain = Math.max(2, Math.floor(settings.domain || 1000));
    const random = Random().seeded(settings.seed || 4);
    const values = new Array(size);
    for (let i = 0; i < size; i += 1) values[i] = random.int(domain);

    const index = PersistentSegmentTree().prefixCounts(values, { domain: domain });
    let wrong = 0;
    const probes = Math.max(1, Math.floor(settings.probes || 200));

    for (let probe = 0; probe < probes; probe += 1) {
      const a = random.int(size);
      const b = random.int(size);
      const from = Math.min(a, b);
      const to = Math.max(a, b);
      const k = 1 + random.int(to - from + 1);
      const sorted = values.slice(from, to + 1).sort(function (x, y) { return x - y; });
      if (index.kthSmallest(from, to, k) !== sorted[k - 1]) wrong += 1;
    }

    const shape = index.shape();
    return {
      size: size, domain: domain, probes: probes, wrong: wrong, shape: shape,
      descentsPerQuery: index.stats().descents / probes
    };
  }

  /* ----------------------------------------------- 9.4 tries and vectors */

  /**
   * The same n appends, once persistently and once through a transient. The
   * answers are identical; only the allocation count moves, which is exactly
   * what a transient is for.
   */
  function vectorAllocations(options) {
    const settings = options || {};
    const count = Math.max(1, Math.floor(settings.count || 20000));
    const engine = Hamt().vector({});

    engine.resetStats();
    let persistent = engine.empty();
    for (let i = 0; i < count; i += 1) persistent = engine.push(persistent, i);
    const withoutTransient = engine.stats();
    const shape = engine.shape(persistent);

    engine.resetStats();
    const built = engine.transient(engine.empty(), function (batch, start) {
      let current = start;
      for (let i = 0; i < count; i += 1) current = batch.push(current, i);
      return current;
    });
    const withTransient = engine.stats();

    let wrong = 0;
    for (let i = 0; i < count; i += 1) {
      if (engine.get(persistent, i) !== i || engine.get(built, i) !== i) wrong += 1;
    }

    return {
      count: count,
      wrong: wrong,
      shape: shape,
      persistent: withoutTransient,
      transient: withTransient,
      saving: withTransient.nodesAllocated
        ? withoutTransient.nodesAllocated / withTransient.nodesAllocated : 1
    };
  }

  /** A HAMT against a plain Map, on correctness and on what the sparse node
   *  layout saves against a dense 32-slot one. */
  function mapCompare(options) {
    const settings = options || {};
    const count = Math.max(1, Math.floor(settings.count || 20000));
    const random = Random().seeded(settings.seed || 5);
    const engine = Hamt().map({});
    const reference = new Map();
    let node = engine.empty();

    for (let i = 0; i < count; i += 1) {
      const key = 'key-' + random.int(count * 2);
      node = engine.set(node, key, i);
      reference.set(key, i);
    }

    let wrong = 0;
    reference.forEach(function (value, key) { if (engine.get(node, key) !== value) wrong += 1; });
    const shape = engine.shape(node);

    return {
      count: count,
      distinctKeys: reference.size,
      wrong: wrong,
      shape: shape,
      denseSaving: shape.bytesSparse ? shape.bytesDense / shape.bytesSparse : 1,
      depthBound: Math.ceil(32 / Hamt().BITS)
    };
  }

  /* ----------------------------------------------------- 9.5 finger trees */

  /**
   * The same items in four finger trees that differ only in their monoid. The
   * measures differ; the spine does not, which is the claim - one structure,
   * four data structures.
   */
  function monoidCompare(options) {
    const settings = options || {};
    const count = Math.max(1, Math.floor(settings.count || 1000));

    return Object.keys(FingerTree().monoids).map(function (name) {
      const engine = FingerTree().create({ monoid: name });
      const random = Random().seeded(settings.seed || 7);
      let tree = engine.empty();
      for (let i = 0; i < count; i += 1) {
        tree = engine.pushBack(tree, {
          value: random.int(100), priority: random.int(1000), end: random.int(500)
        });
      }
      const shape = engine.shape(tree);
      return {
        monoid: name, count: count, measure: engine.measure(tree),
        widths: shape.widths, spine: shape.spine, digitElements: shape.digitElements
      };
    });
  }

  /** Split and concatenate one sequence, counting the nodes each touches. */
  function sequenceOps(options) {
    const settings = options || {};
    const count = Math.max(4, Math.floor(settings.count || 3000));
    const at = Math.min(count - 1, Math.max(1, Math.floor(settings.at || count / 2)));
    const engine = FingerTree().create({ monoid: 'size' });

    let tree = engine.empty();
    for (let i = 0; i < count; i += 1) tree = engine.pushBack(tree, i);
    const shape = engine.shape(tree);
    const built = engine.stats();

    engine.resetStats();
    const halves = engine.split(tree, function (measure) { return measure > at; });
    const splitVisits = engine.stats().nodesVisited;
    const leftLength = engine.toArray(halves[0]).length;

    engine.resetStats();
    const joined = engine.concat(halves[0], halves[1]);
    const concatAllocated = engine.stats().nodesAllocated;

    return {
      count: count, at: at, shape: shape, built: built,
      splitVisits: splitVisits, leftLength: leftLength,
      concatAllocated: concatAllocated,
      rejoinedLength: engine.toArray(joined).length
    };
  }

  /* ---------------------------------------------------------- 9.6 zippers */

  function zipperCost(options) {
    return Zipper().editCost(options);
  }

  /* ------------------------------------------------------- the version DAG */

  /**
   * The picture the section draws: one row per version, split into the nodes
   * that version had to build and the nodes it inherited untouched.
   */
  function versionDag(options) {
    const settings = options || {};
    const keys = settings.keys || keyStream({ count: settings.count || 24, seed: settings.seed || 1, universe: 60 });
    const tree = PersistentBst().create({ strategy: settings.strategy || 'path-copying' });
    const rows = [];
    let previousNodes = 0;
    let previousAllocated = 0;

    keys.forEach(function (key, index) {
      tree.insert(key);
      const shape = tree.shape();
      const allocated = shape.nodesAllocated;
      rows.push({
        version: index + 1,
        key: key,
        copied: allocated - previousAllocated,
        total: shape.distinctNodes,
        shared: shape.distinctNodes - (allocated - previousAllocated) - previousNodes >= 0
          ? previousNodes : Math.max(0, shape.distinctNodes - (allocated - previousAllocated)),
        liveKeys: shape.liveKeys,
        depth: shape.depth
      });
      previousNodes = shape.distinctNodes;
      previousAllocated = allocated;
    });

    return { strategy: tree.strategy, rows: rows, keys: keys };
  }

  return {
    keyStream: keyStream,
    persistenceCompare: persistenceCompare,
    copyingCost: copyingCost,
    readProbes: readProbes,
    versionPair: versionPair,
    queueReuse: queueReuse,
    queueTimeline: queueTimeline,
    versionedQueries: versionedQueries,
    versionGrowth: versionGrowth,
    rangeQuantiles: rangeQuantiles,
    vectorAllocations: vectorAllocations,
    mapCompare: mapCompare,
    monoidCompare: monoidCompare,
    sequenceOps: sequenceOps,
    zipperCost: zipperCost,
    versionDag: versionDag
  };
}));

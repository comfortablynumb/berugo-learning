/**
 * Three ways to make one balanced search tree persistent, on one interface, so
 * the cost of each is a measurement rather than a citation.
 *
 * The tree itself is a treap with hashed priorities, so its shape is a
 * function of the key set and not of the insertion order - otherwise a sorted
 * insert sequence would produce a path and every "O(depth)" figure below would
 * be a statement about the input rather than about persistence.
 *
 *   'path-copying'  the obvious method: copy every node from the changed leaf
 *                   to the root and leave the rest shared. O(depth) new nodes
 *                   per update, and a query that costs exactly what the
 *                   ephemeral tree costs.
 *   'fat-node'      change nothing: append a version-stamped entry to the
 *                   node's own list of left/right values. O(1) space per
 *                   change - the cheapest possible - and a query that now
 *                   binary-searches a version list at every step.
 *   'node-copying'  Driscoll, Sarnak, Sleator and Tarjan: one spare
 *                   modification box per node. A change fills the box; a
 *                   second change copies the node and the copy propagates to
 *                   the parent, which may itself copy. Amortised O(1) space
 *                   with no query slowdown, and the cascade is what has to be
 *                   measured rather than assumed.
 *
 * Every strategy answers `has` and `keys` at *any* version. That is the
 * property the whole milestone is about, and the one a test has to check at
 * every version rather than at the last.
 */
(function (root, factory) {
  const api = factory(root, typeof require === 'function' ? require : null);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.PersistentBst = api;
}(typeof window !== 'undefined' ? window : null, function (scope, requireFn) {
  'use strict';

  const STRATEGIES = ['path-copying', 'fat-node', 'node-copying'];

  function hashFunctions() {
    if (scope && scope.HashFunctions) return scope.HashFunctions;
    return requireFn ? requireFn('./hash-functions.js') : null;
  }

  /** Priorities come from the key, so the same key set is the same tree shape
   *  whatever order it arrived in. A treap whose priorities are drawn at
   *  insertion time is a different tree per order, which M04 measured. */
  function priorityOf(key) {
    return hashFunctions().murmur3(String(key), 0x9e3779b9) >>> 0;
  }

  function emptyStats() {
    return {
      updates: 0, nodesAllocated: 0, nodesCopied: 0, fieldsAppended: 0,
      boxesFilled: 0, cascades: 0, comparisons: 0, versionLookups: 0
    };
  }

  /* --------------------------------------------------------- path copying */

  function pathCopying(stats) {
    function makeNode(key, left, right) {
      stats.nodesAllocated += 1;
      return { key: key, priority: priorityOf(key), left: left, right: right };
    }

    function rotateRight(node) {
      return makeNode(node.left.key, node.left.left, makeNode(node.key, node.left.right, node.right));
    }

    function rotateLeft(node) {
      return makeNode(node.right.key, makeNode(node.key, node.left, node.right.left), node.right.right);
    }

    function insert(node, key) {
      if (!node) return makeNode(key, null, null);
      stats.comparisons += 1;
      if (key === node.key) return node;

      if (key < node.key) {
        const fresh = makeNode(node.key, insert(node.left, key), node.right);
        return fresh.left.priority < fresh.priority ? rotateRight(fresh) : fresh;
      }
      const fresh = makeNode(node.key, node.left, insert(node.right, key));
      return fresh.right.priority < fresh.priority ? rotateLeft(fresh) : fresh;
    }

    return {
      id: 'path-copying',
      insert: insert,
      childOf: function (node, side) { return node[side]; },
      rootAt: function (roots, version) { return roots[version]; }
    };
  }

  /* -------------------------------------------------------------- fat node */

  /**
   * Nothing is ever copied and nothing is ever overwritten: a node keeps a
   * list of (version, value) pairs per pointer field, and a read at version v
   * takes the last entry at or before v. Space per change is one entry; the
   * price is that every step of every query is now a binary search.
   */
  function fatNode(stats) {
    function makeNode(key, version) {
      stats.nodesAllocated += 1;
      return {
        key: key, priority: priorityOf(key),
        left: [{ version: version, node: null }],
        right: [{ version: version, node: null }]
      };
    }

    function childAt(node, side, version) {
      const list = node[side];
      stats.versionLookups += 1;
      let low = 0;
      let high = list.length - 1;
      let best = null;
      while (low <= high) {
        const mid = (low + high) >> 1;
        if (list[mid].version <= version) { best = list[mid].node; low = mid + 1; }
        else high = mid - 1;
      }
      return best;
    }

    function setChild(node, side, value, version) {
      const list = node[side];
      const last = list[list.length - 1];
      if (last.version === version) { last.node = value; return; }
      list.push({ version: version, node: value });
      stats.fieldsAppended += 1;
    }

    /* The rotation a treap needs is a structural change, and a fat node
       expresses it by appending to the two nodes involved rather than by
       building anything - which is exactly why its space cost is flat. */
    function rotate(node, side, version) {
      const other = side === 'left' ? 'right' : 'left';
      const pivot = childAt(node, side, version);
      setChild(node, side, childAt(pivot, other, version), version);
      setChild(pivot, other, node, version);
      return pivot;
    }

    function insert(node, key, version) {
      if (!node) return makeNode(key, version);
      stats.comparisons += 1;
      if (key === node.key) return node;

      const side = key < node.key ? 'left' : 'right';
      setChild(node, side, insert(childAt(node, side, version), key, version), version);
      const child = childAt(node, side, version);
      return child.priority < node.priority ? rotate(node, side, version) : node;
    }

    return {
      id: 'fat-node',
      insert: function (node, key, version) { return insert(node, key, version); },
      childOf: childAt,
      rootAt: function (roots, version) { return roots[version]; }
    };
  }

  /* ---------------------------------------------------------- node copying */

  /**
   * One spare slot per node. A change writes the box; a second change to the
   * same node has nowhere to put the value, so the node is copied with the box
   * applied and the *parent* must be told about the copy - which may fill the
   * parent's box, and so on. The cascade terminates and is rare, which is the
   * whole content of the O(1) amortised result; `cascades` counts it.
   */
  function nodeCopying(stats) {
    function makeNode(key, version) {
      stats.nodesAllocated += 1;
      return { key: key, priority: priorityOf(key), left: null, right: null, born: version, box: null };
    }

    function childAt(node, side, version) {
      if (node.box && node.box.side === side && node.box.version <= version) return node.box.node;
      return node[side];
    }

    /** Returns the node the caller should point at: the same one if the change
     *  fitted, a copy if it did not. */
    function setChild(node, side, value, version) {
      if (node.born === version) { node[side] = value; return node; }
      if (!node.box) {
        node.box = { side: side, version: version, node: value };
        stats.boxesFilled += 1;
        return node;
      }
      if (node.box.side === side && node.box.version === version) { node.box.node = value; return node; }

      stats.nodesCopied += 1;
      const copy = makeNode(node.key, version);
      copy.priority = node.priority;
      copy.left = childAt(node, 'left', version);
      copy.right = childAt(node, 'right', version);
      copy[side] = value;
      return copy;
    }

    function rotate(node, side, version) {
      const other = side === 'left' ? 'right' : 'left';
      const pivot = childAt(node, side, version);
      const lowered = setChild(node, side, childAt(pivot, other, version), version);
      return setChild(pivot, other, lowered, version);
    }

    function insert(node, key, version) {
      if (!node) return makeNode(key, version);
      stats.comparisons += 1;
      if (key === node.key) return node;

      const side = key < node.key ? 'left' : 'right';
      const grown = insert(childAt(node, side, version), key, version);
      const before = node;
      const here = setChild(node, side, grown, version);
      if (here !== before) stats.cascades += 1;
      const child = childAt(here, side, version);
      return child.priority < here.priority ? rotate(here, side, version) : here;
    }

    return {
      id: 'node-copying',
      insert: insert,
      childOf: childAt,
      rootAt: function (roots, version) { return roots[version]; }
    };
  }

  const BUILDERS = {
    'path-copying': pathCopying,
    'fat-node': fatNode,
    'node-copying': nodeCopying
  };

  /* ------------------------------------------------------------ the facade */

  function create(options) {
    const settings = options || {};
    const name = STRATEGIES.indexOf(settings.strategy) === -1 ? 'path-copying' : settings.strategy;
    let stats = emptyStats();
    const engine = BUILDERS[name](stats);
    const roots = [null];  // version 0 is the empty tree, not a special case

    function insert(key) {
      const version = roots.length;
      stats.updates += 1;
      roots.push(engine.insert(roots[version - 1], key, version));
      return version;
    }

    function insertAll(keys) {
      keys.forEach(insert);
      return roots.length - 1;
    }

    function versionOf(version) {
      const at = version === undefined ? roots.length - 1 : version;
      if (at < 0 || at >= roots.length) throw new RangeError('PersistentBst: no version ' + version);
      return at;
    }

    function has(key, version) {
      const at = versionOf(version);
      let node = engine.rootAt(roots, at);
      while (node) {
        stats.comparisons += 1;
        if (key === node.key) return true;
        node = engine.childOf(node, key < node.key ? 'left' : 'right', at);
      }
      return false;
    }

    function keys(version) {
      const at = versionOf(version);
      const out = [];
      walk(engine.rootAt(roots, at), at, out);
      return out;
    }

    function walk(node, version, out) {
      if (!node) return;
      walk(engine.childOf(node, 'left', version), version, out);
      out.push(node.key);
      walk(engine.childOf(node, 'right', version), version, out);
    }

    function depth(version) {
      const at = versionOf(version);
      return measureDepth(engine.rootAt(roots, at), at);
    }

    function measureDepth(node, version) {
      if (!node) return 0;
      return 1 + Math.max(
        measureDepth(engine.childOf(node, 'left', version), version),
        measureDepth(engine.childOf(node, 'right', version), version)
      );
    }

    function shape() {
      /* Distinct node objects reachable from *any* version - the number the
         whole section turns on, since a strategy that shares well keeps it
         near the size of one tree however many versions exist.

         Two details are load-bearing. The visited set has to be per version as
         well as global: a fat node is the same object in every version and has
         different children in each, so a global-only set stops the walk at the
         first version and reports fourteen nodes for a tree holding hundreds.
         And the walk's own version lookups are restored afterwards, because a
         counter labelled "what your queries cost" must not include the cost of
         measuring the structure. */
      const before = { versionLookups: stats.versionLookups, comparisons: stats.comparisons };
      const seen = new Set();
      for (let version = 1; version < roots.length; version += 1) {
        collect(engine.rootAt(roots, version), version, seen, new Set());
      }
      const live = keys().length;
      const measured = {
        strategy: name,
        versions: roots.length - 1,
        liveKeys: live,
        distinctNodes: seen.size,
        nodesAllocated: stats.nodesAllocated,
        nodesPerUpdate: stats.updates ? stats.nodesAllocated / stats.updates : 0,
        bytes: bytesFor(seen),
        depth: live ? depth() : 0
      };

      stats.versionLookups = before.versionLookups;
      stats.comparisons = before.comparisons;
      return measured;
    }

    function collect(node, version, seen, local) {
      if (!node || local.has(node)) return;
      local.add(node);
      seen.add(node);
      collect(engine.childOf(node, 'left', version), version, seen, local);
      collect(engine.childOf(node, 'right', version), version, seen, local);
    }

    function bytesFor(seen) {
      /* A pointer field costs 8 bytes; a fat node's version list costs 16 per
         entry, because the version travels with the pointer. */
      let total = 0;
      seen.forEach(function (node) {
        total += 24;
        if (Array.isArray(node.left)) total += (node.left.length + node.right.length) * 16;
        else total += 16 + (node.box ? 24 : 0);
      });
      return total;
    }

    const identity = new Map();

    function idOf(node) {
      if (!identity.has(node)) identity.set(node, identity.size + 1);
      return identity.get(node);
    }

    function structure(version) {
      /* One version's tree as nodes and edges, with an identity that is stable
         across versions - which is what lets a caller ask "which of these did
         the previous version already have" and draw the sharing. */
      const at = versionOf(version);
      const nodes = [];
      const edges = [];
      const before = { versionLookups: stats.versionLookups, comparisons: stats.comparisons };
      collectShape(engine.rootAt(roots, at), at, 0, { nodes: nodes, edges: edges, seen: new Set() });
      stats.versionLookups = before.versionLookups;
      stats.comparisons = before.comparisons;
      return { version: at, nodes: nodes, edges: edges };
    }

    function collectShape(node, version, depthAt, out) {
      if (!node || out.seen.has(node)) return null;
      out.seen.add(node);
      const id = idOf(node);
      out.nodes.push({ id: id, key: node.key, depth: depthAt });
      ['left', 'right'].forEach(function (side) {
        const child = engine.childOf(node, side, version);
        const childId = collectShape(child, version, depthAt + 1, out);
        if (childId !== null && childId !== undefined) out.edges.push({ from: id, to: childId, side: side });
      });
      return id;
    }

    return {
      strategy: name, insert: insert, insertAll: insertAll, has: has,
      keys: keys, depth: depth, shape: shape, structure: structure,
      versions: function () { return roots.length - 1; },
      size: function (version) { return keys(version).length; },
      stats: function () { return Object.assign({}, stats); },
      resetStats: function () {
        /* Cleared in place, not rebound. The strategy engine was handed this
           object as an argument and holds the reference, so assigning a fresh
           object here would leave every engine-side counter - comparisons,
           version lookups, boxes, cascades - writing to an orphan and reading
           back as zero. */
        Object.assign(stats, emptyStats());
      }
    };
  }

  return { create: create, strategies: STRATEGIES.slice(), priorityOf: priorityOf };
}));

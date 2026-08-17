/**
 * The plain trie: one node per character, one edge per distinct next letter.
 *
 * The shared interface for every prefix structure in M06 lives here, because
 * `machines/text-lab.js` drives all four families through it without knowing
 * which one it holds:
 *
 *   insert · has · remove · withPrefix · longestPrefixOf · size · nodes ·
 *   bytes · checkInvariants · stats · resetStats
 *
 * Three node layouts are offered, and they are the section's whole point. The
 * structure is identical; only the per-node child storage changes:
 *
 *   - `map`    — a Map per node. 1 entry per real child, and a hash lookup per
 *                character. The default, and what a JS implementation would
 *                actually write.
 *   - `array`  — a fixed slot per alphabet symbol. Lookup is one index, and
 *                the memory is `alphabet` slots per node whether 1 is used or
 *                26 - on a 4-letter DNA alphabet in a 256-slot array that is
 *                98% waste, which is why the layout is a decision and not a
 *                detail.
 *   - `sorted` — a sorted array of (char, child) pairs with a binary search.
 *                The compromise: no per-symbol waste, log(children) lookup.
 *
 * A terminal marker rather than a sentinel character: `insert('a')` after
 * `insert('an')` must not need a second node, and a sentinel would make the
 * two keys `a$` and `an$`, which share only `a` and cost an extra node per
 * key. The cost of the marker is one boolean per node; the cost of a sentinel
 * is one node per key.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Trie = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const LAYOUTS = ['map', 'array', 'sorted'];

  /* Rough per-node cost in bytes, for the memory column. A JS engine's real
     numbers are unknowable from inside the language, so these are the sizes
     the same structure would occupy in a compiled implementation: a pointer
     is 8 bytes, a boolean is packed into the node header. */
  const NODE_HEADER = 16;
  const POINTER = 8;

  function newStats() {
    return {
      inserts: 0, lookups: 0, removals: 0, prefixQueries: 0,
      charSteps: 0, childProbes: 0, nodesCreated: 0, nodesFreed: 0
    };
  }

  /* --------------------------------------------------- child containers */

  function makeChildren(layout, alphabet) {
    if (layout === 'array') return { kind: 'array', slots: new Array(alphabet.length).fill(null), count: 0 };
    if (layout === 'sorted') return { kind: 'sorted', keys: [], values: [] };
    return { kind: 'map', map: new Map() };
  }

  /** Binary search for `symbol` in a sorted child list. Returns the insertion
   *  point when absent, so insert and lookup share one walk. */
  function searchSorted(children, symbol) {
    let low = 0;
    let high = children.keys.length - 1;

    while (low <= high) {
      const mid = (low + high) >> 1;
      if (children.keys[mid] === symbol) return { found: true, at: mid };
      if (children.keys[mid] < symbol) low = mid + 1;
      else high = mid - 1;
    }
    return { found: false, at: low };
  }

  function childCount(children) {
    if (children.kind === 'array') return children.count;
    if (children.kind === 'sorted') return children.keys.length;
    return children.map.size;
  }

  /** Children in symbol order, which every ordered query depends on. A Map
   *  preserves insertion order, not symbol order, so it has to be sorted. */
  function childEntries(children) {
    if (children.kind === 'sorted') {
      return children.keys.map(function (key, i) { return [key, children.values[i]]; });
    }
    if (children.kind === 'array') {
      const out = [];
      children.slots.forEach(function (child, index) {
        if (child) out.push([child.symbol, child]);
      });
      return out;
    }
    return Array.from(children.map.entries()).sort(function (a, b) {
      return a[0] < b[0] ? -1 : (a[0] > b[0] ? 1 : 0);
    });
  }

  /** Bytes this node's child storage would occupy. */
  function childBytes(children, alphabetSize) {
    if (children.kind === 'array') return alphabetSize * POINTER;
    if (children.kind === 'sorted') return children.keys.length * (POINTER + 1);
    return children.map.size * (POINTER + 8);
  }

  function createTrie(options) {
    const settings = options || {};
    const layout = LAYOUTS.indexOf(settings.layout) === -1 ? 'map' : settings.layout;
    const alphabet = (settings.alphabet || 'abcdefghijklmnopqrstuvwxyz').split('');
    const index = new Map();
    alphabet.forEach(function (symbol, at) { index.set(symbol, at); });

    let stats = newStats();
    let count = 0;
    let nodeCount = 1;

    function newNode(symbol) {
      stats.nodesCreated += 1;
      nodeCount += 1;
      return { symbol: symbol, terminal: false, children: makeChildren(layout, alphabet) };
    }

    const rootNode = { symbol: '', terminal: false, children: makeChildren(layout, alphabet) };

    /** One character step. `create` decides whether a miss allocates. */
    function step(node, symbol, create) {
      stats.childProbes += 1;
      const children = node.children;

      if (children.kind === 'array') {
        const at = index.get(symbol);
        if (at === undefined) throw new Error('trie: "' + symbol + '" is outside the declared alphabet');
        if (!children.slots[at] && create) {
          children.slots[at] = newNode(symbol);
          children.count += 1;
        }
        return children.slots[at];
      }

      if (children.kind === 'sorted') {
        const found = searchSorted(children, symbol);
        if (found.found) return children.values[found.at];
        if (!create) return null;
        const child = newNode(symbol);
        children.keys.splice(found.at, 0, symbol);
        children.values.splice(found.at, 0, child);
        return child;
      }

      let child = children.map.get(symbol);
      if (!child && create) {
        child = newNode(symbol);
        children.map.set(symbol, child);
      }
      return child || null;
    }

    function detach(node, symbol) {
      const children = node.children;
      if (children.kind === 'array') {
        const at = index.get(symbol);
        if (children.slots[at]) { children.slots[at] = null; children.count -= 1; }
        return;
      }
      if (children.kind === 'sorted') {
        const found = searchSorted(children, symbol);
        if (found.found) { children.keys.splice(found.at, 1); children.values.splice(found.at, 1); }
        return;
      }
      children.map.delete(symbol);
    }

    /** Walks `key`, allocating nothing. Returns the node or null. */
    function descend(key) {
      let node = rootNode;
      for (let i = 0; i < key.length; i += 1) {
        stats.charSteps += 1;
        node = step(node, key[i], false);
        if (!node) return null;
      }
      return node;
    }

    function insert(key) {
      stats.inserts += 1;
      let node = rootNode;
      for (let i = 0; i < key.length; i += 1) {
        stats.charSteps += 1;
        node = step(node, key[i], true);
      }
      if (node.terminal) return false;
      node.terminal = true;
      count += 1;
      return true;
    }

    function has(key) {
      stats.lookups += 1;
      const node = descend(key);
      return Boolean(node && node.terminal);
    }

    /** Removal unmarks the terminal, then prunes upward while a node has no
     *  children and is not itself a key. Skipping the prune is the common bug:
     *  the set stays correct and the node count only ever grows. */
    function remove(key) {
      stats.removals += 1;
      const path = [];
      let node = rootNode;

      for (let i = 0; i < key.length; i += 1) {
        stats.charSteps += 1;
        const next = step(node, key[i], false);
        if (!next) return false;
        path.push({ parent: node, symbol: key[i], node: next });
        node = next;
      }
      if (!node.terminal) return false;

      node.terminal = false;
      count -= 1;

      for (let i = path.length - 1; i >= 0; i -= 1) {
        const link = path[i];
        if (link.node.terminal || childCount(link.node.children) > 0) break;
        detach(link.parent, link.symbol);
        nodeCount -= 1;
        stats.nodesFreed += 1;
      }
      return true;
    }

    /** Every key under a prefix, in order. The walk starts at the prefix node,
     *  so the cost is the size of the answer plus the length of the prefix -
     *  never the size of the trie, which is the query a hash table cannot do
     *  at all. */
    function withPrefix(prefix) {
      stats.prefixQueries += 1;
      const start = descend(prefix);
      const out = [];
      if (!start) return out;

      const stack = [{ node: start, text: prefix }];
      while (stack.length) {
        const item = stack.pop();
        if (item.node.terminal) out.push(item.text);
        const entries = childEntries(item.node.children);
        for (let i = entries.length - 1; i >= 0; i -= 1) {
          stack.push({ node: entries[i][1], text: item.text + entries[i][0] });
        }
      }
      return out.sort();
    }

    /** The longest key that is a prefix of `text` - the IP-routing query, and
     *  the one a trie answers in one downward walk. */
    function longestPrefixOf(text) {
      stats.lookups += 1;
      let node = rootNode;
      let best = null;

      if (node.terminal) best = '';
      for (let i = 0; i < text.length; i += 1) {
        stats.charSteps += 1;
        node = step(node, text[i], false);
        if (!node) break;
        if (node.terminal) best = text.slice(0, i + 1);
      }
      return best;
    }

    /** The search path for one key, for the visualiser: every node touched and
     *  whether the walk fell off the trie. */
    function pathFor(key) {
      const path = [{ symbol: '', depth: 0, terminal: rootNode.terminal }];
      let node = rootNode;

      for (let i = 0; i < key.length; i += 1) {
        node = step(node, key[i], false);
        if (!node) return { path: path, complete: false, found: false };
        path.push({ symbol: key[i], depth: i + 1, terminal: node.terminal });
      }
      return { path: path, complete: true, found: node.terminal };
    }

    function walk(visit) {
      const stack = [{ node: rootNode, depth: 0, text: '' }];
      while (stack.length) {
        const item = stack.pop();
        visit(item);
        childEntries(item.node.children).forEach(function (entry) {
          stack.push({ node: entry[1], depth: item.depth + 1, text: item.text + entry[0] });
        });
      }
    }

    function bytes() {
      let total = 0;
      walk(function (item) {
        total += NODE_HEADER + childBytes(item.node.children, alphabet.length);
      });
      return total;
    }

    /** Keys in order, which must equal a sorted reference set. */
    function keys() {
      return withPrefix('');
    }

    function checkInvariants() {
      const errors = [];
      let terminals = 0;
      let walked = 0;

      walk(function (item) {
        walked += 1;
        if (item.node.terminal) terminals += 1;
        if (item.node !== rootNode && !item.node.terminal && childCount(item.node.children) === 0) {
          errors.push('node "' + item.text + '" is a dead end: not a key and has no children');
        }
        childEntries(item.node.children).forEach(function (entry) {
          if (entry[1].symbol !== entry[0]) {
            errors.push('node "' + item.text + '" files "' + entry[1].symbol + '" under "' + entry[0] + '"');
          }
        });
      });

      if (terminals !== count) errors.push('walked ' + terminals + ' keys, size() says ' + count);
      if (walked !== nodeCount) errors.push('walked ' + walked + ' nodes, the counter says ' + nodeCount);
      return { ok: errors.length === 0, errors: errors.slice(0, 5) };
    }

    function publicApi() {
      return {
        name: 'trie-' + layout,
        layout: layout,
        insert: insert,
        has: has,
        remove: remove,
        withPrefix: withPrefix,
        longestPrefixOf: longestPrefixOf,
        pathFor: pathFor,
        keys: keys,
        walk: walk,
        root: function () { return rootNode; },
        /* A node's children as [symbol, node] pairs in symbol order. The
           container differs by layout, so anything outside this module that
           wants to walk the structure - the visualiser, mostly - has to ask
           rather than reach into `node.children`. */
        childrenOf: function (node) { return childEntries(node.children); },
        size: function () { return count; },
        nodes: function () { return nodeCount; },
        bytes: bytes,
        alphabetSize: function () { return alphabet.length; },
        checkInvariants: checkInvariants,
        stats: function () { return Object.assign({ size: count, nodes: nodeCount }, stats); },
        resetStats: function () { stats = newStats(); }
      };
    }

    return publicApi();
  }

  return { create: createTrie, newStats: newStats, LAYOUTS: LAYOUTS, NODE_HEADER: NODE_HEADER, POINTER: POINTER };
}));

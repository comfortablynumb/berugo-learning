/**
 * The ternary search tree: a binary search tree whose comparison is on one
 * character, and whose "equal" child advances to the next character.
 *
 * Each node holds one symbol and three pointers - `lo`, `eq`, `hi` - so the
 * per-node cost is fixed at three pointers whatever the alphabet, where a
 * plain trie pays either a slot per symbol (an array node) or a hash per node
 * (a map node). That is the compromise the structure exists for: no alphabet
 * tax, and a lookup that is `log(children) + length` character comparisons
 * rather than `length` hash lookups.
 *
 * The insertion order matters, and it is the trap. Inserting a sorted word
 * list builds a right spine at every level - the same degeneracy a BST has,
 * for the same reason - so a TST over a sorted dictionary is a linked list
 * wearing a tree's interface. `balanced: true` inserts by recursive median
 * selection, which is what a real implementation does when the key set is
 * known up front.
 *
 * The near-neighbour query is what a hash table cannot do and a plain trie can
 * only do by walking every branch: `withinDistance` prunes at each node using
 * the remaining edit budget, so a distance-1 query over a dictionary visits a
 * few hundred nodes rather than all of them.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.TernaryTrie = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const NODE_HEADER = 16;
  const POINTER = 8;

  function newStats() {
    return {
      inserts: 0, lookups: 0, prefixQueries: 0, neighbourQueries: 0,
      charComparisons: 0, nodeVisits: 0, nodesCreated: 0
    };
  }

  function create(options) {
    const settings = options || {};
    let stats = newStats();
    let root = null;
    let count = 0;
    let nodeCount = 0;

    function newNode(symbol) {
      stats.nodesCreated += 1;
      nodeCount += 1;
      return { symbol: symbol, terminal: false, lo: null, eq: null, hi: null };
    }

    /** Iterative insert: a recursive one overflows on a sorted 100 000-key
     *  load, which is exactly the input this structure is worst on. */
    function insert(key) {
      stats.inserts += 1;
      if (!key.length) return false;

      if (!root) root = newNode(key[0]);
      let node = root;
      let at = 0;

      for (;;) {
        stats.nodeVisits += 1;
        stats.charComparisons += 1;
        const symbol = key[at];

        if (symbol < node.symbol) {
          if (!node.lo) node.lo = newNode(symbol);
          node = node.lo;
          continue;
        }
        if (symbol > node.symbol) {
          if (!node.hi) node.hi = newNode(symbol);
          node = node.hi;
          continue;
        }

        at += 1;
        if (at === key.length) {
          if (node.terminal) return false;
          node.terminal = true;
          count += 1;
          return true;
        }
        if (!node.eq) node.eq = newNode(key[at]);
        node = node.eq;
      }
    }

    /** The node that spells `key`, or null. */
    function find(key) {
      let node = root;
      let at = 0;

      while (node && at < key.length) {
        stats.nodeVisits += 1;
        stats.charComparisons += 1;
        const symbol = key[at];

        if (symbol < node.symbol) { node = node.lo; continue; }
        if (symbol > node.symbol) { node = node.hi; continue; }
        at += 1;
        if (at === key.length) return node;
        node = node.eq;
      }
      return null;
    }

    function has(key) {
      stats.lookups += 1;
      const node = find(key);
      return Boolean(node && node.terminal);
    }

    /** Collects every key in the `eq` subtree below `node`, prefixed. */
    function collect(node, prefix, out) {
      const stack = [{ node: node, prefix: prefix }];
      while (stack.length) {
        const item = stack.pop();
        if (!item.node) continue;
        stack.push({ node: item.node.lo, prefix: item.prefix });
        stack.push({ node: item.node.hi, prefix: item.prefix });
        const spelled = item.prefix + item.node.symbol;
        if (item.node.terminal) out.push(spelled);
        stack.push({ node: item.node.eq, prefix: spelled });
      }
    }

    function withPrefix(prefix) {
      stats.prefixQueries += 1;
      const out = [];

      if (!prefix.length) {
        collect(root, '', out);
        return out.sort();
      }
      const node = find(prefix);
      if (!node) return out;
      if (node.terminal) out.push(prefix);
      collect(node.eq, prefix, out);
      return out.sort();
    }

    function longestPrefixOf(text) {
      stats.lookups += 1;
      let node = root;
      let at = 0;
      let best = null;

      while (node && at < text.length) {
        stats.nodeVisits += 1;
        stats.charComparisons += 1;
        const symbol = text[at];

        if (symbol < node.symbol) { node = node.lo; continue; }
        if (symbol > node.symbol) { node = node.hi; continue; }
        at += 1;
        if (node.terminal) best = text.slice(0, at);
        node = node.eq;
      }
      return best;
    }

    /** Keys within `budget` substitutions of `pattern`, same length only.
     *  The pruning is the point: a subtree is skipped the moment the budget is
     *  spent, so the visit count is a small multiple of the answer size. */
    function withinDistance(pattern, budget) {
      stats.neighbourQueries += 1;
      const out = [];

      const visit = function (node, at, left, spelled) {
        if (!node || left < 0 || at >= pattern.length) return;
        stats.nodeVisits += 1;
        stats.charComparisons += 1;
        const symbol = pattern[at];

        if (left > 0 || symbol < node.symbol) visit(node.lo, at, left, spelled);

        const cost = symbol === node.symbol ? 0 : 1;
        if (left - cost >= 0) {
          const next = spelled + node.symbol;
          if (at === pattern.length - 1) {
            if (node.terminal) out.push(next);
          } else {
            visit(node.eq, at + 1, left - cost, next);
          }
        }

        if (left > 0 || symbol > node.symbol) visit(node.hi, at, left, spelled);
      };

      visit(root, 0, budget, '');
      return out.sort();
    }

    function walk(visit) {
      const stack = [{ node: root, depth: 0 }];
      while (stack.length) {
        const item = stack.pop();
        if (!item.node) continue;
        visit(item);
        stack.push({ node: item.node.lo, depth: item.depth + 1 });
        stack.push({ node: item.node.eq, depth: item.depth + 1 });
        stack.push({ node: item.node.hi, depth: item.depth + 1 });
      }
    }

    function height() {
      let deepest = 0;
      walk(function (item) { if (item.depth > deepest) deepest = item.depth; });
      return deepest + 1;
    }

    function keys() {
      return withPrefix('');
    }

    function bytes() {
      return nodeCount * (NODE_HEADER + 3 * POINTER + 1);
    }

    function checkInvariants() {
      const errors = [];
      let terminals = 0;
      let walked = 0;

      walk(function (item) {
        walked += 1;
        const node = item.node;
        if (node.terminal) terminals += 1;
        if (node.lo && node.lo.symbol >= node.symbol) {
          errors.push('node "' + node.symbol + '" has a lo child "' + node.lo.symbol + '" that does not sort before it');
        }
        if (node.hi && node.hi.symbol <= node.symbol) {
          errors.push('node "' + node.symbol + '" has a hi child "' + node.hi.symbol + '" that does not sort after it');
        }
      });

      if (terminals !== count) errors.push('walked ' + terminals + ' keys, size() says ' + count);
      if (walked !== nodeCount) errors.push('walked ' + walked + ' nodes, the counter says ' + nodeCount);
      return { ok: errors.length === 0, errors: errors.slice(0, 5) };
    }

    /** Insert a key set by recursive median selection, which is how a TST is
     *  built when the keys are known up front - and the difference between a
     *  balanced tree and a spine. */
    function insertBalanced(list) {
      const sorted = list.slice().sort();
      const place = function (low, high) {
        if (low > high) return;
        const mid = (low + high) >> 1;
        insert(sorted[mid]);
        place(low, mid - 1);
        place(mid + 1, high);
      };
      place(0, sorted.length - 1);
    }

    if (settings.keys) {
      if (settings.balanced) insertBalanced(settings.keys);
      else settings.keys.forEach(insert);
    }

    return {
      name: settings.balanced ? 'ternary-balanced' : 'ternary',
      insert: insert,
      insertBalanced: insertBalanced,
      has: has,
      withPrefix: withPrefix,
      longestPrefixOf: longestPrefixOf,
      withinDistance: withinDistance,
      keys: keys,
      walk: walk,
      root: function () { return root; },
      size: function () { return count; },
      nodes: function () { return nodeCount; },
      height: height,
      bytes: bytes,
      checkInvariants: checkInvariants,
      stats: function () { return Object.assign({ size: count, nodes: nodeCount }, stats); },
      resetStats: function () { stats = newStats(); }
    };
  }

  return { create: create, newStats: newStats, NODE_HEADER: NODE_HEADER, POINTER: POINTER };
}));

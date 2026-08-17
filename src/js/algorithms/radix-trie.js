/**
 * The radix trie: the same set as a plain trie, with every non-branching chain
 * of nodes collapsed into one edge carrying a substring.
 *
 * The structure is defined by one rule - a node exists only where the key set
 * branches or ends - so the node count is bounded by 2k − 1 for k keys however
 * long the keys are. A plain trie's node count is bounded by the total number
 * of characters. That is the entire difference, and it is why routing tables,
 * filesystem paths and key-value prefixes all use this one: the keys there are
 * long and their branching is shallow.
 *
 * Insertion has exactly three cases, and the third is where implementations go
 * wrong:
 *
 *   1. the new key runs off the end of an edge → recurse into the child;
 *   2. the edge is a prefix of what remains → follow it;
 *   3. the edge and the key agree for a while and then differ → **split**:
 *      the edge becomes two, an internal node appears at the split point, and
 *      the old child hangs below it. Forgetting that the split node may itself
 *      be a key (when the new key ends exactly at the split) is the bug.
 *
 * `adaptive: true` switches the child storage by fan-out the way an ART node
 * does — a list up to 4, a sorted array up to 16, a map beyond — which is what
 * makes a radix trie competitive with a hash table in a main-memory database:
 * the small nodes, which are almost all of them, stay small.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.RadixTrie = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const NODE_HEADER = 16;
  const POINTER = 8;

  /* ART's node sizes: the class a node is in, by how many children it has. */
  const ADAPTIVE_CLASSES = [
    { name: 'node4', upTo: 4, bytesPerChild: POINTER + 1 },
    { name: 'node16', upTo: 16, bytesPerChild: POINTER + 1 },
    { name: 'node48', upTo: 48, bytesPerChild: POINTER + 2 },
    { name: 'node256', upTo: 256, bytesPerChild: POINTER }
  ];

  function newStats() {
    return {
      inserts: 0, lookups: 0, prefixQueries: 0,
      charSteps: 0, edgeFollows: 0, splits: 0, nodesCreated: 0
    };
  }

  function classFor(children) {
    const size = children.size;
    for (let i = 0; i < ADAPTIVE_CLASSES.length; i += 1) {
      if (size <= ADAPTIVE_CLASSES[i].upTo) return ADAPTIVE_CLASSES[i];
    }
    return ADAPTIVE_CLASSES[ADAPTIVE_CLASSES.length - 1];
  }

  /** How many leading characters two strings agree on. */
  function commonPrefix(a, b) {
    const limit = Math.min(a.length, b.length);
    let i = 0;
    while (i < limit && a[i] === b[i]) i += 1;
    return i;
  }

  function create(options) {
    const settings = options || {};
    const adaptive = Boolean(settings.adaptive);

    let stats = newStats();
    let count = 0;
    let nodeCount = 1;

    function newNode(label) {
      stats.nodesCreated += 1;
      nodeCount += 1;
      return { label: label, terminal: false, children: new Map() };
    }

    const rootNode = { label: '', terminal: false, children: new Map() };

    /* ------------------------------------------------------------ insert */

    /** Case 3: `node`'s edge agrees with the incoming key for `at` characters
     *  and then differs. The edge becomes two nodes. */
    function split(parent, node, at) {
      stats.splits += 1;

      const head = newNode(node.label.slice(0, at));
      const tail = node;
      tail.label = tail.label.slice(at);

      parent.children.delete(head.label[0]);
      parent.children.set(head.label[0], head);
      head.children.set(tail.label[0], tail);
      return head;
    }

    function insert(key) {
      stats.inserts += 1;
      let node = rootNode;
      let rest = key;

      for (;;) {
        if (!rest.length) {
          if (node.terminal) return false;
          node.terminal = true;
          count += 1;
          return true;
        }

        const child = node.children.get(rest[0]);
        stats.charSteps += 1;

        if (!child) {
          const leaf = newNode(rest);
          leaf.terminal = true;
          node.children.set(rest[0], leaf);
          count += 1;
          return true;
        }

        const shared = commonPrefix(child.label, rest);
        stats.charSteps += shared;

        if (shared === child.label.length) {
          stats.edgeFollows += 1;
          node = child;
          rest = rest.slice(shared);
          continue;
        }

        /* The edge and the key diverge inside the edge: split, then either the
           key ends at the split point or it hangs a new leaf off it. */
        const head = split(node, child, shared);
        if (shared === rest.length) {
          head.terminal = true;
          count += 1;
          return true;
        }
        const leaf = newNode(rest.slice(shared));
        leaf.terminal = true;
        head.children.set(leaf.label[0], leaf);
        count += 1;
        return true;
      }
    }

    /* ------------------------------------------------------------ lookup */

    /** Walks as far as `key` goes. `partial` reports a walk that ended inside
     *  an edge, which `withPrefix` needs and `has` must reject. */
    function descend(key) {
      let node = rootNode;
      let rest = key;

      while (rest.length) {
        const child = node.children.get(rest[0]);
        stats.charSteps += 1;
        if (!child) return null;

        const shared = commonPrefix(child.label, rest);
        stats.charSteps += shared;

        if (shared === rest.length) return { node: child, partial: shared < child.label.length, consumed: shared };
        if (shared < child.label.length) return null;

        stats.edgeFollows += 1;
        node = child;
        rest = rest.slice(shared);
      }
      return { node: node, partial: false, consumed: 0 };
    }

    function has(key) {
      stats.lookups += 1;
      const found = descend(key);
      return Boolean(found && !found.partial && found.node.terminal);
    }

    function collect(node, text, out) {
      const stack = [{ node: node, text: text }];
      while (stack.length) {
        const item = stack.pop();
        if (item.node.terminal) out.push(item.text);
        Array.from(item.node.children.values()).forEach(function (child) {
          stack.push({ node: child, text: item.text + child.label });
        });
      }
    }

    /** Every key under a prefix. A prefix that ends inside an edge is still a
     *  valid prefix - the subtree below that edge is the answer - which is the
     *  case a plain-trie port of this function gets wrong. */
    function withPrefix(prefix) {
      stats.prefixQueries += 1;
      const found = descend(prefix);
      const out = [];
      if (!found) return out;

      const text = found.partial
        ? prefix.slice(0, prefix.length - found.consumed) + found.node.label
        : prefix;
      collect(found.node, text, out);
      return out.sort();
    }

    function longestPrefixOf(text) {
      stats.lookups += 1;
      let node = rootNode;
      let consumed = 0;
      let best = node.terminal ? '' : null;

      for (;;) {
        const rest = text.slice(consumed);
        if (!rest.length) return best;

        const child = node.children.get(rest[0]);
        stats.charSteps += 1;
        if (!child) return best;
        if (commonPrefix(child.label, rest) !== child.label.length) return best;

        consumed += child.label.length;
        node = child;
        if (node.terminal) best = text.slice(0, consumed);
      }
    }

    /* ------------------------------------------------------- bookkeeping */

    function walk(visit) {
      const stack = [{ node: rootNode, text: '', depth: 0 }];
      while (stack.length) {
        const item = stack.pop();
        visit(item);
        Array.from(item.node.children.values()).forEach(function (child) {
          stack.push({ node: child, text: item.text + child.label, depth: item.depth + 1 });
        });
      }
    }

    function keys() {
      return withPrefix('');
    }

    /** Bytes, with the adaptive node classes if they are on. The label is
     *  counted as a pointer plus its characters, because a real implementation
     *  stores a slice of the key rather than a copy. */
    function bytes() {
      let total = 0;
      walk(function (item) {
        const node = item.node;
        const per = adaptive ? classFor(node.children).bytesPerChild : POINTER + 8;
        const slots = adaptive ? classFor(node.children).upTo : node.children.size;
        total += NODE_HEADER + POINTER + node.label.length + slots * per;
      });
      return total;
    }

    /** How the nodes are distributed over the ART size classes. */
    function nodeClasses() {
      const tally = {};
      ADAPTIVE_CLASSES.forEach(function (klass) { tally[klass.name] = 0; });
      walk(function (item) { tally[classFor(item.node.children).name] += 1; });
      return tally;
    }

    function checkInvariants() {
      const errors = [];
      let terminals = 0;
      let walked = 0;

      walk(function (item) {
        walked += 1;
        const node = item.node;
        if (node.terminal) terminals += 1;

        if (node !== rootNode && !node.label.length) errors.push('a non-root node carries an empty edge');
        if (node !== rootNode && !node.terminal && node.children.size === 1) {
          errors.push('node "' + item.text + '" branches once and is not a key: the edge was not compressed');
        }
        if (node !== rootNode && !node.terminal && node.children.size === 0) {
          errors.push('node "' + item.text + '" is a dead end');
        }
        node.children.forEach(function (child, symbol) {
          if (child.label[0] !== symbol) {
            errors.push('node "' + item.text + '" files an edge starting "' + child.label[0] + '" under "' + symbol + '"');
          }
        });
      });

      if (terminals !== count) errors.push('walked ' + terminals + ' keys, size() says ' + count);
      if (walked !== nodeCount) errors.push('walked ' + walked + ' nodes, the counter says ' + nodeCount);
      return { ok: errors.length === 0, errors: errors.slice(0, 5) };
    }

    function publicApi() {
      return {
        name: adaptive ? 'radix-adaptive' : 'radix',
        insert: insert,
        has: has,
        withPrefix: withPrefix,
        longestPrefixOf: longestPrefixOf,
        keys: keys,
        walk: walk,
        root: function () { return rootNode; },
        size: function () { return count; },
        nodes: function () { return nodeCount; },
        bytes: bytes,
        nodeClasses: nodeClasses,
        checkInvariants: checkInvariants,
        stats: function () { return Object.assign({ size: count, nodes: nodeCount }, stats); },
        resetStats: function () { stats = newStats(); }
      };
    }

    return publicApi();
  }

  /* --------------------------------------------------------- IP routing */

  /** Longest-prefix match over an IPv4 routing table, done on the bits rather
   *  than on characters - which is what a PATRICIA trie is: a radix trie whose
   *  alphabet is {0, 1} and whose edges are bit ranges. */
  function ipToBits(address) {
    return address.split('.').map(function (part) {
      return Number(part).toString(2).padStart(8, '0');
    }).join('');
  }

  /** `10.0.0.0/8` becomes the 8-bit string the table files it under. */
  function prefixToBits(cidr) {
    const parts = cidr.split('/');
    return ipToBits(parts[0]).slice(0, Number(parts[1]));
  }

  function routingTable(routes) {
    const trie = create({});
    const nextHop = new Map();

    routes.forEach(function (route) {
      const bits = prefixToBits(route.cidr);
      trie.insert(bits);
      nextHop.set(bits, route.via);
    });

    return {
      trie: trie,
      lookup: function (address) {
        const match = trie.longestPrefixOf(ipToBits(address));
        if (match === null) return null;
        return { bits: match, length: match.length, via: nextHop.get(match) };
      },
      size: function () { return nextHop.size; }
    };
  }

  return {
    create: create,
    newStats: newStats,
    routingTable: routingTable,
    ipToBits: ipToBits,
    prefixToBits: prefixToBits,
    commonPrefix: commonPrefix,
    ADAPTIVE_CLASSES: ADAPTIVE_CLASSES
  };
}));

/**
 * The DAWG: a trie that shares suffixes as well as prefixes, built by
 * incremental minimisation.
 *
 * A trie merges two keys wherever they start the same. A DAWG also merges them
 * wherever they *end* the same, so `walking`, `talking` and `running` share one
 * copy of `ing` rather than three. On an English word list that is the
 * difference between 2 500 nodes and 700, and it is why a spell checker ships
 * its dictionary this way: the graph is the compressed dictionary, and lookup
 * is still one step per character.
 *
 * The construction is Daciuk, Mihov, Watson and Watson's: keys are inserted in
 * **sorted order**, which guarantees that once a branch is left behind it can
 * never be extended again, so it can be minimised immediately. Two pieces do
 * the work:
 *
 *   - the **register**, a map from a state's signature (terminal flag plus its
 *     outgoing (symbol, target) pairs) to a canonical state. A state whose
 *     signature is already registered is not a new state; the parent is
 *     repointed at the registered one.
 *   - `minimiseFrom(depth)`, which walks the tail of the previous key from the
 *     bottom up, registering each state as it goes.
 *
 * Sorted input is not a convenience, it is a correctness requirement: insert
 * out of order and a state that was registered as final can acquire a new edge,
 * and every parent that was repointed at it silently gains a word that was
 * never inserted. `create({ checked: true })` rejects unsorted input rather
 * than producing a graph that accepts a superset of the language.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Dawg = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const NODE_HEADER = 16;
  const POINTER = 8;

  function newStats() {
    return {
      inserts: 0, lookups: 0, charSteps: 0,
      statesCreated: 0, statesMerged: 0, registryHits: 0, registryMisses: 0
    };
  }

  /** A state's identity: what it accepts and where it goes. Two states with
   *  the same signature accept the same language and are the same state. */
  function signatureOf(state) {
    const parts = [state.terminal ? '1' : '0'];
    Array.from(state.edges.keys()).sort().forEach(function (symbol) {
      parts.push(symbol + ':' + state.edges.get(symbol).id);
    });
    return parts.join('|');
  }

  function create(options) {
    const settings = options || {};
    const checked = settings.checked !== false;

    let stats = newStats();
    let nextId = 0;
    let count = 0;
    let stateCount = 1;

    function newState() {
      stats.statesCreated += 1;
      stateCount += 1;
      nextId += 1;
      return { id: nextId, terminal: false, edges: new Map() };
    }

    const start = { id: 0, terminal: false, edges: new Map() };
    const register = new Map();
    let previous = '';
    let frozen = false;

    /** Walk the unminimised tail of the previous key, deepest first, and either
     *  register each state or replace it with the registered equivalent. */
    function minimiseFrom(depth) {
      const path = [start];
      let node = start;

      for (let i = 0; i < previous.length; i += 1) {
        node = node.edges.get(previous[i]);
        path.push(node);
      }

      for (let i = previous.length; i > depth; i -= 1) {
        const parent = path[i - 1];
        const child = path[i];
        const signature = signatureOf(child);
        const registered = register.get(signature);

        if (registered && registered !== child) {
          stats.registryHits += 1;
          stats.statesMerged += 1;
          stateCount -= 1;
          parent.edges.set(previous[i - 1], registered);
          path[i] = registered;
          continue;
        }
        stats.registryMisses += 1;
        register.set(signature, child);
      }
    }

    /** Insert in sorted order. Returns false for a duplicate. */
    function insert(key) {
      if (frozen) throw new Error('dawg: the graph is frozen; build it before querying by state');
      stats.inserts += 1;

      if (checked && key < previous) {
        throw new Error('dawg: keys must arrive in sorted order ("' + key + '" after "' + previous + '")');
      }
      if (key === previous && previous !== '') return false;

      let shared = 0;
      while (shared < key.length && shared < previous.length && key[shared] === previous[shared]) shared += 1;

      minimiseFrom(shared);

      let node = start;
      for (let i = 0; i < shared; i += 1) node = node.edges.get(key[i]);

      for (let i = shared; i < key.length; i += 1) {
        stats.charSteps += 1;
        const child = newState();
        node.edges.set(key[i], child);
        node = child;
      }

      if (node.terminal) return false;
      node.terminal = true;
      count += 1;
      previous = key;
      return true;
    }

    /** Minimise what is left and stop accepting insertions. Every query below
     *  is valid before this too, but the state count is only minimal after. */
    function finish() {
      if (frozen) return;
      minimiseFrom(0);
      frozen = true;
    }

    function has(key) {
      stats.lookups += 1;
      let node = start;
      for (let i = 0; i < key.length; i += 1) {
        stats.charSteps += 1;
        node = node.edges.get(key[i]);
        if (!node) return false;
      }
      return node.terminal;
    }

    /** Every accepted word. A DAWG is a DAG, so a state is reachable by many
     *  paths and each path is a distinct word - the walk must not memoise on
     *  the state, only on the (state, spelling) pair, which is the path. */
    function keys() {
      const out = [];
      const stack = [{ node: start, text: '' }];

      while (stack.length) {
        const item = stack.pop();
        if (item.node.terminal) out.push(item.text);
        Array.from(item.node.edges.keys()).sort().reverse().forEach(function (symbol) {
          stack.push({ node: item.node.edges.get(symbol), text: item.text + symbol });
        });
      }
      return out.sort();
    }

    function withPrefix(prefix) {
      let node = start;
      for (let i = 0; i < prefix.length; i += 1) {
        node = node.edges.get(prefix[i]);
        if (!node) return [];
      }

      const out = [];
      const stack = [{ node: node, text: prefix }];
      while (stack.length) {
        const item = stack.pop();
        if (item.node.terminal) out.push(item.text);
        item.node.edges.forEach(function (child, symbol) {
          stack.push({ node: child, text: item.text + symbol });
        });
      }
      return out.sort();
    }

    /** Every distinct state, by identity. */
    function states() {
      const seen = new Map();
      const stack = [start];
      while (stack.length) {
        const node = stack.pop();
        if (seen.has(node.id)) continue;
        seen.set(node.id, node);
        node.edges.forEach(function (child) { stack.push(child); });
      }
      return Array.from(seen.values());
    }

    function edgeCount() {
      return states().reduce(function (total, state) { return total + state.edges.size; }, 0);
    }

    function bytes() {
      return states().length * NODE_HEADER + edgeCount() * (POINTER + 1);
    }

    function checkInvariants() {
      const errors = [];
      const live = states();

      if (live.length !== stateCount) {
        errors.push('reachable states ' + live.length + ', the counter says ' + stateCount);
      }

      /* No two reachable states may share a signature: that is what "minimal"
         means, and a missed merge shows up here rather than in the language. */
      const seen = new Map();
      live.forEach(function (state) {
        const signature = signatureOf(state);
        if (seen.has(signature) && frozen) {
          errors.push('states ' + seen.get(signature) + ' and ' + state.id + ' are equivalent and were not merged');
        }
        seen.set(signature, state.id);
      });

      /* And it must be acyclic, or `keys()` never terminates. */
      const colour = new Map();
      const visit = function (node) {
        if (colour.get(node.id) === 'grey') { errors.push('the graph has a cycle at state ' + node.id); return; }
        if (colour.get(node.id) === 'black') return;
        colour.set(node.id, 'grey');
        node.edges.forEach(function (child) { visit(child); });
        colour.set(node.id, 'black');
      };
      visit(start);

      return { ok: errors.length === 0, errors: errors.slice(0, 5) };
    }

    return {
      name: 'dawg',
      insert: insert,
      finish: finish,
      has: has,
      keys: keys,
      withPrefix: withPrefix,
      states: states,
      start: function () { return start; },
      size: function () { return count; },
      nodes: function () { return states().length; },
      edges: edgeCount,
      bytes: bytes,
      registerSize: function () { return register.size; },
      checkInvariants: checkInvariants,
      stats: function () { return Object.assign({ size: count, states: stateCount }, stats); },
      resetStats: function () { stats = newStats(); }
    };
  }

  /** Build from a key list, sorting and finishing - the usual entry point. */
  function fromKeys(list, options) {
    const graph = create(options);
    list.slice().sort().forEach(function (key) { graph.insert(key); });
    graph.finish();
    return graph;
  }

  return { create: create, fromKeys: fromKeys, newStats: newStats, signatureOf: signatureOf };
}));

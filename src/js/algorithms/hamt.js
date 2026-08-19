/**
 * Bit-partitioned tries: the hash array mapped trie behind every immutable map
 * worth using, and the persistent vector behind every immutable list.
 *
 * Both are the same trick. Take 5 bits of a 32-bit key at each level, so a
 * node has 32 slots and the depth is ⌈32/5⌉ = 7 at the very worst. Then do not
 * store 32 slots: store a 32-bit `bitmap` of which are occupied and a dense
 * array of only those, and find a child's position with
 *
 *     index = popcount(bitmap & (bit − 1))
 *
 * A node with three children is an array of three, not an array of 32 with 29
 * holes - which is the difference between a structure that is usable and one
 * that allocates 128 bytes per node forever.
 *
 * "O(log₃₂ n)" is how immutable collections get away with claiming constant
 * time, and the claim is fair: depth 7 covers 34 billion elements. The
 * constant is real, the depth is not. What actually costs is *allocation* -
 * one new node per level per update - which is why both structures offer
 * transients: a batch that owns its nodes may mutate them in place, and the
 * node counter is where that shows up.
 */
(function (root, factory) {
  const api = factory(root, typeof require === 'function' ? require : null);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Hamt = api;
}(typeof window !== 'undefined' ? window : null, function (scope, requireFn) {
  'use strict';

  const BITS = 5;
  const WIDTH = 1 << BITS;
  const MASK = WIDTH - 1;

  function hashFunctions() {
    if (scope && scope.HashFunctions) return scope.HashFunctions;
    return requireFn ? requireFn('./hash-functions.js') : null;
  }

  /** Kernighan's popcount, written out because the whole section is about this
   *  one expression and `>>> 0` hiding in a library would obscure it. */
  function popcount(value) {
    let bits = value >>> 0;
    bits = bits - ((bits >>> 1) & 0x55555555);
    bits = (bits & 0x33333333) + ((bits >>> 2) & 0x33333333);
    bits = (bits + (bits >>> 4)) & 0x0f0f0f0f;
    return (Math.imul(bits, 0x01010101) >>> 24);
  }

  function emptyStats() {
    return { updates: 0, lookups: 0, nodesAllocated: 0, nodesMutated: 0, levelsWalked: 0, collisions: 0 };
  }

  /* ------------------------------------------------------------- the HAMT */

  function map(options) {
    const settings = options || {};
    const seed = settings.seed === undefined ? 0x811c9dc5 : settings.seed;
    let stats = emptyStats();

    function hashOf(key) {
      return hashFunctions().murmur3(String(key), seed) >>> 0;
    }

    function makeNode(bitmap, children, owner) {
      stats.nodesAllocated += 1;
      return { bitmap: bitmap >>> 0, children: children, owner: owner || null };
    }

    const EMPTY = makeNode(0, []);

    function fragment(hash, shift) {
      return (hash >>> shift) & MASK;
    }

    function slotFor(bitmap, bit) {
      return popcount(bitmap & (bit - 1));
    }

    function get(node, key) {
      const hash = hashOf(key);
      let current = node;
      let shift = 0;
      stats.lookups += 1;

      while (current) {
        stats.levelsWalked += 1;
        const bit = (1 << fragment(hash, shift)) >>> 0;
        if (!(current.bitmap & bit)) return undefined;
        const child = current.children[slotFor(current.bitmap, bit)];
        if (child.entry) return child.key === key ? child.value : bucketGet(child, key);
        current = child;
        shift += BITS;
      }
      return undefined;
    }

    function bucketGet(entry, key) {
      if (!entry.more) return undefined;
      for (let i = 0; i < entry.more.length; i += 1) {
        if (entry.more[i].key === key) return entry.more[i].value;
      }
      return undefined;
    }

    function makeEntry(key, value) {
      stats.nodesAllocated += 1;
      return { entry: true, key: key, value: value, more: null };
    }

    /* A node the batch owns may be written in place; anything else is copied.
       That single check is what a transient is. */
    function writable(node, owner) {
      if (owner && node.owner === owner) { stats.nodesMutated += 1; return node; }
      return makeNode(node.bitmap, node.children.slice(), owner);
    }

    function put(node, key, value, context) {
      const bit = (1 << fragment(context.hash, context.shift)) >>> 0;
      const slot = slotFor(node.bitmap, bit);

      if (!(node.bitmap & bit)) {
        const fresh = writable(node, context.owner);
        fresh.bitmap = (node.bitmap | bit) >>> 0;
        fresh.children.splice(slot, 0, makeEntry(key, value));
        return fresh;
      }

      const child = node.children[slot];
      const fresh = writable(node, context.owner);
      fresh.children[slot] = child.entry
        ? resolve(child, key, value, context)
        : put(child, key, value, { hash: context.hash, shift: context.shift + BITS, owner: context.owner });
      return fresh;
    }

    /**
     * Two keys meet in one slot. If they are the same key it is a replace; if
     * their hashes still differ deeper, push both down a level; if the hashes
     * are equal for all 32 bits it is a genuine collision and the entry keeps a
     * list. Skipping that last case is the bug that makes a HAMT lose keys.
     */
    function resolve(entry, key, value, context) {
      if (entry.key === key) return makeEntry(key, value);

      const otherHash = hashOf(entry.key);
      const shift = context.shift + BITS;
      if (shift >= 32 || otherHash === context.hash) {
        stats.collisions += 1;
        const merged = makeEntry(entry.key, entry.value);
        merged.more = (entry.more || []).filter(function (item) { return item.key !== key; })
          .concat([{ key: key, value: value }]);
        return merged;
      }

      let branch = makeNode(0, [], context.owner);
      branch = put(branch, entry.key, entry.value, { hash: otherHash, shift: shift, owner: context.owner });
      return put(branch, key, value, { hash: context.hash, shift: shift, owner: context.owner });
    }

    function set(node, key, value, owner) {
      stats.updates += 1;
      return put(node, key, value, { hash: hashOf(key), shift: 0, owner: owner || null });
    }

    function entriesOf(node, out) {
      node.children.forEach(function (child) {
        if (!child.entry) { entriesOf(child, out); return; }
        out.push({ key: child.key, value: child.value });
        (child.more || []).forEach(function (item) { out.push({ key: item.key, value: item.value }); });
      });
      return out;
    }

    function shapeOf(node) {
      const totals = { nodes: 0, entries: 0, maxDepth: 0, emptySlots: 0, slots: 0 };
      measure(node, 0, totals);
      return Object.assign(totals, {
        bytesDense: totals.nodes * (8 + WIDTH * 8),
        bytesSparse: totals.nodes * 16 + totals.slots * 8,
        meanFanout: totals.nodes ? totals.slots / totals.nodes : 0
      });
    }

    function measure(node, depth, totals) {
      totals.nodes += 1;
      totals.slots += node.children.length;
      if (depth > totals.maxDepth) totals.maxDepth = depth;
      if (popcount(node.bitmap) !== node.children.length) totals.emptySlots += 1;
      node.children.forEach(function (child) {
        if (child.entry) { totals.entries += 1 + (child.more ? child.more.length : 0); return; }
        measure(child, depth + 1, totals);
      });
    }

    return {
      empty: function () { return EMPTY; },
      set: set,
      get: get,
      entries: function (node) { return entriesOf(node, []); },
      shape: shapeOf,
      /** A transient: one owner token, and every node it creates is its own to
       *  overwrite until `persist` withdraws the licence. */
      transient: function (node, build) {
        const owner = { id: 'transient' };
        const result = build({
          set: function (current, key, value) { return set(current, key, value, owner); }
        }, node);
        return result;
      },
      stats: function () { return Object.assign({}, stats); },
      resetStats: function () { stats = emptyStats(); }
    };
  }

  /* -------------------------------------------------- the persistent vector */

  /**
   * The same trie indexed by position rather than by hash, plus one detail
   * that carries most of the performance: a *tail* buffer of up to 32 elements
   * held outside the trie. An append writes the tail and allocates nothing at
   * all thirty-one times out of thirty-two.
   */
  function vector(options) {
    const settings = options || {};
    let stats = emptyStats();

    function makeNode(children, owner) {
      stats.nodesAllocated += 1;
      return { children: children, owner: owner || null };
    }

    const EMPTY = { count: 0, shift: BITS, root: makeNode([]), tail: [] };

    function tailOffset(vec) {
      return vec.count < WIDTH ? 0 : ((vec.count - 1) >>> BITS) << BITS;
    }

    function get(vec, index) {
      stats.lookups += 1;
      if (index < 0 || index >= vec.count) return undefined;
      if (index >= tailOffset(vec)) return vec.tail[index & MASK];

      let node = vec.root;
      for (let shift = vec.shift; shift > 0; shift -= BITS) {
        stats.levelsWalked += 1;
        node = node.children[(index >>> shift) & MASK];
      }
      return node.children[index & MASK];
    }

    function writable(node, owner) {
      if (owner && node.owner === owner) { stats.nodesMutated += 1; return node; }
      return makeNode(node.children.slice(), owner);
    }

    function pushTail(node, shift, tail, context) {
      const fresh = writable(node, context.owner);
      const slot = ((context.count - 1) >>> shift) & MASK;
      if (shift === BITS) {
        fresh.children[slot] = makeNode(tail, context.owner);
        return fresh;
      }
      const child = fresh.children[slot];
      fresh.children[slot] = child
        ? pushTail(child, shift - BITS, tail, context)
        : newPath(shift - BITS, tail, context.owner);
      return fresh;
    }

    function newPath(shift, tail, owner) {
      if (shift === 0) return makeNode(tail, owner);
      return makeNode([newPath(shift - BITS, tail, owner)], owner);
    }

    /** Thirty-one appends in thirty-two touch nothing but the tail. */
    function push(vec, value, owner) {
      stats.updates += 1;
      if (vec.count - tailOffset(vec) < WIDTH) {
        return { count: vec.count + 1, shift: vec.shift, root: vec.root, tail: vec.tail.concat([value]) };
      }

      const overflowed = (vec.count >>> BITS) > (1 << vec.shift);
      const context = { count: vec.count, owner: owner || null };
      if (overflowed) {
        /* The new root is one level *above* the old one, so the path down to
           the retired tail is built at the old root's shift - not one below
           it, which leaves the tail a level too shallow and makes every index
           past the first overflow read an undefined node. */
        const root = makeNode([vec.root, newPath(vec.shift, vec.tail, context.owner)], context.owner);
        return { count: vec.count + 1, shift: vec.shift + BITS, root: root, tail: [value] };
      }
      return {
        count: vec.count + 1, shift: vec.shift,
        root: pushTail(vec.root, vec.shift, vec.tail, context), tail: [value]
      };
    }

    function set(vec, index, value, owner) {
      stats.updates += 1;
      if (index < 0 || index >= vec.count) throw new RangeError('Hamt.vector: index ' + index + ' out of range');
      if (index >= tailOffset(vec)) {
        const tail = vec.tail.slice();
        tail[index & MASK] = value;
        return { count: vec.count, shift: vec.shift, root: vec.root, tail: tail };
      }
      return {
        count: vec.count, shift: vec.shift, tail: vec.tail,
        root: assoc(vec.root, vec.shift, index, value, owner || null)
      };
    }

    function assoc(node, shift, index, value, owner) {
      const fresh = writable(node, owner);
      if (shift === 0) { fresh.children[index & MASK] = value; return fresh; }
      const slot = (index >>> shift) & MASK;
      fresh.children[slot] = assoc(node.children[slot], shift - BITS, index, value, owner);
      return fresh;
    }

    function toArray(vec) {
      const out = new Array(vec.count);
      for (let i = 0; i < vec.count; i += 1) out[i] = get(vec, i);
      return out;
    }

    function shapeOf(vec) {
      const seen = new Set();
      collect(vec.root, vec.shift, seen);
      return {
        count: vec.count,
        /* Levels *including* the leaf array: shift 10 indexes three levels of
           32, which is 32 768 elements. Reporting shift/BITS alone reads as
           one level fewer than the trie actually has. */
        levels: vec.shift / BITS + 1,
        tail: vec.tail.length,
        nodes: seen.size,
        capacityAtDepth: Math.pow(WIDTH, vec.shift / BITS + 1),
        bytes: seen.size * 16 + vec.count * 8
      };
    }

    function collect(node, shift, seen) {
      if (!node || seen.has(node)) return;
      seen.add(node);
      if (shift === 0) return;
      node.children.forEach(function (child) { collect(child, shift - BITS, seen); });
    }

    return {
      empty: function () { return EMPTY; },
      push: push,
      set: set,
      get: get,
      toArray: toArray,
      shape: shapeOf,
      transient: function (vec, build) {
        const owner = { id: 'transient' };
        return build({
          push: function (current, value) { return push(current, value, owner); },
          set: function (current, index, value) { return set(current, index, value, owner); }
        }, vec);
      },
      stats: function () { return Object.assign({}, stats); },
      resetStats: function () { stats = emptyStats(); },
      label: settings.label || 'persistent vector'
    };
  }

  return { map: map, vector: vector, popcount: popcount, BITS: BITS, WIDTH: WIDTH };
}));

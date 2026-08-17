/**
 * B+ trees, with the page accounting that makes them make sense.
 *
 * A B-tree is not "a tree that is wide". It is a tree whose node is exactly
 * one unit of I/O, so the branching factor is a consequence of the page size
 * and the key size rather than a tuning knob: `orderForPage` computes it, and
 * changing the storage medium changes it.
 *
 * This is the B+ variant, so every value lives in a leaf, internal nodes hold
 * separators only, and the leaves are chained. That is what a database index
 * is: a point lookup costs log_B(n) page reads, and a range scan costs one
 * descent plus a walk along the leaf chain, touching no internal page at all.
 *
 * The page operations - split, borrow, merge - take a context rather than
 * closing over the tree, so they can be reasoned about (and tested) as what
 * they are: edits to one page and its parent.
 *
 * `pageReads` counts a read per node touched, which is the metric a database
 * reports and the one the analytical prediction is about.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BTree = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function compareKeys(a, b) {
    if (a < b) return -1;
    return a > b ? 1 : 0;
  }

  /** How many children fit in one page: each child costs a pointer, and all
   *  but one costs a separator key too. */
  function orderForPage(options) {
    const settings = options || {};
    const page = settings.pageBytes || 4096;
    const key = settings.keyBytes || 8;
    const pointer = settings.pointerBytes || 8;
    return Math.max(3, Math.floor((page + key) / (key + pointer)));
  }

  function newStats() {
    return {
      comparisons: 0, pageReads: 0, pageWrites: 0, splits: 0, merges: 0, borrows: 0,
      inserts: 0, removes: 0, finds: 0
    };
  }

  function makeLeaf() {
    return { leaf: true, keys: [], values: [], next: null };
  }

  function makeInternal() {
    return { leaf: false, keys: [], children: [] };
  }

  /* ------------------------------------------------------------- page edits */

  /** First index whose key is >= `key`. A linear scan inside the page is the
   *  right thing: the page is already in cache once it has been read. */
  function lowerBound(ctx, keys, key) {
    let i = 0;
    while (i < keys.length && ctx.cmp(keys[i], key) < 0) i += 1;
    return i;
  }

  function splitLeaf(ctx, leaf) {
    const at = Math.ceil(leaf.keys.length / 2);
    const right = makeLeaf();
    right.keys = leaf.keys.splice(at);
    right.values = leaf.values.splice(at);
    right.next = leaf.next;
    leaf.next = right;
    ctx.stats.splits += 1;
    ctx.stats.pageWrites += 2;
    return { separator: right.keys[0], node: right };
  }

  /** The internal split promotes its median rather than copying it: a
   *  separator is not data, so it does not have to stay in a leaf. */
  function splitInternal(ctx, node) {
    const at = Math.floor(node.keys.length / 2);
    const separator = node.keys[at];
    const right = makeInternal();
    right.keys = node.keys.splice(at + 1);
    right.children = node.children.splice(at + 1);
    node.keys.pop();
    ctx.stats.splits += 1;
    ctx.stats.pageWrites += 2;
    return { separator: separator, node: right };
  }

  function borrowLeft(ctx, parent, index) {
    const node = parent.children[index];
    const left = parent.children[index - 1];
    if (node.leaf) {
      node.keys.unshift(left.keys.pop());
      node.values.unshift(left.values.pop());
      parent.keys[index - 1] = node.keys[0];
    } else {
      node.keys.unshift(parent.keys[index - 1]);
      parent.keys[index - 1] = left.keys.pop();
      node.children.unshift(left.children.pop());
    }
    ctx.stats.borrows += 1;
  }

  function borrowRight(ctx, parent, index) {
    const node = parent.children[index];
    const right = parent.children[index + 1];
    if (node.leaf) {
      node.keys.push(right.keys.shift());
      node.values.push(right.values.shift());
      parent.keys[index] = right.keys[0];
    } else {
      node.keys.push(parent.keys[index]);
      parent.keys[index] = right.keys.shift();
      node.children.push(right.children.shift());
    }
    ctx.stats.borrows += 1;
  }

  /** Merging is what shrinks the tree, and the only way the root loses a level.
   *  A leaf merge drops the separator; an internal merge pulls it down. */
  function mergeInto(ctx, parent, index) {
    const left = parent.children[index];
    const right = parent.children[index + 1];
    if (left.leaf) {
      left.keys = left.keys.concat(right.keys);
      left.values = left.values.concat(right.values);
      left.next = right.next;
    } else {
      left.keys = left.keys.concat([parent.keys[index]]).concat(right.keys);
      left.children = left.children.concat(right.children);
    }
    parent.keys.splice(index, 1);
    parent.children.splice(index + 1, 1);
    ctx.stats.merges += 1;
    ctx.stats.pageWrites += 1;
  }

  function underflows(ctx, node) {
    return node.leaf ? node.keys.length < ctx.minLeafKeys : node.keys.length < ctx.minInternalKeys;
  }

  /** Borrow from whichever sibling can spare a key, and merge when neither can. */
  function repair(ctx, parent, index) {
    const left = index > 0 ? parent.children[index - 1] : null;
    const right = index + 1 < parent.children.length ? parent.children[index + 1] : null;
    const spare = function (node) {
      return node && node.keys.length > (node.leaf ? ctx.minLeafKeys : ctx.minInternalKeys);
    };

    if (spare(left)) { borrowLeft(ctx, parent, index); return; }
    if (spare(right)) { borrowRight(ctx, parent, index); return; }
    if (left) mergeInto(ctx, parent, index - 1);
    else mergeInto(ctx, parent, index);
  }

  /* ----------------------------------------------------------- the B+ tree */

  function create(options) {
    const settings = options || {};
    const order = Math.max(3, settings.order || orderForPage(settings));
    const compare = settings.compare || compareKeys;
    let root = makeLeaf();
    let count = 0;
    let stats = newStats();

    const ctx = {
      stats: stats,
      maxKeys: order - 1,
      minLeafKeys: Math.ceil((order - 1) / 2),
      minInternalKeys: Math.ceil(order / 2) - 1,
      cmp: function (a, b) { ctx.stats.comparisons += 1; return compare(a, b); }
    };

    function descend(key, path, indexes) {
      let node = root;
      while (!node.leaf) {
        ctx.stats.pageReads += 1;
        let i = lowerBound(ctx, node.keys, key);
        if (i < node.keys.length && ctx.cmp(node.keys[i], key) === 0) i += 1;
        if (path) { path.push(node); indexes.push(i); }
        node = node.children[i];
      }
      ctx.stats.pageReads += 1;
      return node;
    }

    function insertUp(path, indexes, firstSplit) {
      let split = firstSplit;
      for (let i = path.length - 1; i >= 0 && split; i -= 1) {
        const node = path[i];
        node.keys.splice(indexes[i], 0, split.separator);
        node.children.splice(indexes[i] + 1, 0, split.node);
        ctx.stats.pageWrites += 1;
        split = node.keys.length > ctx.maxKeys ? splitInternal(ctx, node) : null;
      }
      if (!split) return;

      const grown = makeInternal();
      grown.keys = [split.separator];
      grown.children = [root, split.node];
      root = grown;
      ctx.stats.pageWrites += 1;
    }

    function insert(key, value) {
      ctx.stats.inserts += 1;
      const path = [];
      const indexes = [];
      const leaf = descend(key, path, indexes);
      const at = lowerBound(ctx, leaf.keys, key);
      ctx.stats.pageWrites += 1;

      if (at < leaf.keys.length && ctx.cmp(leaf.keys[at], key) === 0) {
        leaf.values[at] = value;
        return false;
      }

      leaf.keys.splice(at, 0, key);
      leaf.values.splice(at, 0, value);
      count += 1;
      if (leaf.keys.length > ctx.maxKeys) insertUp(path, indexes, splitLeaf(ctx, leaf));
      return true;
    }

    function remove(key) {
      ctx.stats.removes += 1;
      const path = [];
      const indexes = [];
      const leaf = descend(key, path, indexes);
      const at = lowerBound(ctx, leaf.keys, key);
      if (at >= leaf.keys.length || ctx.cmp(leaf.keys[at], key) !== 0) return false;

      leaf.keys.splice(at, 1);
      leaf.values.splice(at, 1);
      ctx.stats.pageWrites += 1;
      count -= 1;

      let child = leaf;
      for (let i = path.length - 1; i >= 0 && underflows(ctx, child); i -= 1) {
        repair(ctx, path[i], indexes[i]);
        child = path[i];
      }
      if (!root.leaf && root.keys.length === 0) root = root.children[0];
      return true;
    }

    function get(key) {
      ctx.stats.finds += 1;
      const leaf = descend(key, null, null);
      const at = lowerBound(ctx, leaf.keys, key);
      if (at < leaf.keys.length && ctx.cmp(leaf.keys[at], key) === 0) return leaf.values[at];
      return undefined;
    }

    /** One descent, then the leaf chain: no internal page is touched again,
     *  which is the whole reason an index scan is cheap. */
    function range(lo, hi) {
      const out = [];
      let leaf = descend(lo, null, null);
      let at = lowerBound(ctx, leaf.keys, lo);

      while (leaf) {
        while (at < leaf.keys.length) {
          if (ctx.cmp(leaf.keys[at], hi) > 0) return out;
          out.push(leaf.keys[at]);
          at += 1;
        }
        leaf = leaf.next;
        at = 0;
        if (leaf) ctx.stats.pageReads += 1;
      }
      return out;
    }

    function keys() {
      const out = [];
      let leaf = root;
      while (!leaf.leaf) leaf = leaf.children[0];
      while (leaf) {
        Array.prototype.push.apply(out, leaf.keys);
        leaf = leaf.next;
      }
      return out;
    }

    function height() {
      let depth = 1;
      let node = root;
      while (!node.leaf) { node = node.children[0]; depth += 1; }
      return depth;
    }

    function occupancy() {
      let nodes = 0;
      let used = 0;
      const stack = [root];
      while (stack.length) {
        const node = stack.pop();
        nodes += 1;
        used += node.keys.length;
        if (!node.leaf) Array.prototype.push.apply(stack, node.children);
      }
      return { nodes: nodes, fill: nodes ? used / (nodes * ctx.maxKeys) : 0 };
    }

    function checkPage(node, errors) {
      for (let i = 1; i < node.keys.length; i += 1) {
        if (compare(node.keys[i - 1], node.keys[i]) >= 0) {
          errors.push('keys out of order in a ' + (node.leaf ? 'leaf' : 'node'));
        }
      }
      if (node.keys.length > ctx.maxKeys) {
        errors.push('a node holds ' + node.keys.length + ' keys, over the ' + ctx.maxKeys + ' limit');
      }
      if (node !== root && underflows(ctx, node)) {
        errors.push('a ' + (node.leaf ? 'leaf' : 'node') + ' holds ' + node.keys.length + ' keys, under the fill minimum');
      }
      if (!node.leaf && node.children.length !== node.keys.length + 1) {
        errors.push('a node has ' + node.keys.length + ' keys and ' + node.children.length + ' children');
      }
    }

    /** Equal leaf depth is the B-tree invariant; the fill rule is what keeps
     *  the branching factor real rather than nominal. */
    function checkInvariants() {
      const errors = [];
      const depths = new Set();
      const stack = [{ node: root, depth: 1 }];

      while (stack.length) {
        const frame = stack.pop();
        checkPage(frame.node, errors);
        if (frame.node.leaf) depths.add(frame.depth);
        else frame.node.children.forEach(function (child) { stack.push({ node: child, depth: frame.depth + 1 }); });
      }

      if (depths.size > 1) errors.push('leaves sit at different depths: ' + Array.from(depths).join(', '));
      if (keys().length !== count) errors.push('the leaf chain holds ' + keys().length + ' keys, size says ' + count);
      return { ok: errors.length === 0, errors: errors };
    }

    /** The public surface, assembled in one place. */
    function publicApi() {
      return {
        name: 'b+tree',
        insert: insert,
        remove: remove,
        has: function (key) { return get(key) !== undefined; },
        get: get,
        keys: keys,
        range: range,
        size: function () { return count; },
        height: height,
        order: function () { return order; },
        /** The textbook prediction, log_B(n), which assumes full pages. */
        predictedReads: function () {
          return Math.max(1, Math.ceil(Math.log(Math.max(2, count)) / Math.log(order)));
        },
        /** The honest prediction: pages are not full, so the branching factor
         *  that matters is order x fill. Sequential insertion leaves pages
         *  about half full, which is worth a whole extra level. */
        predictedReadsAtFill: function () {
          const effective = Math.max(2, order * occupancy().fill);
          return Math.max(1, Math.ceil(Math.log(Math.max(2, count)) / Math.log(effective)));
        },
        occupancy: occupancy,
        root: function () { return root; },
        checkInvariants: checkInvariants,
        stats: function () { return Object.assign({ height: height(), size: count, order: order }, ctx.stats); },
        resetStats: function () { stats = newStats(); ctx.stats = stats; }
      };
    }

    return publicApi();
  }

  return {
    create: create,
    orderForPage: orderForPage,
    newStats: newStats,
    lowerBound: lowerBound,
    splitLeaf: splitLeaf,
    splitInternal: splitInternal,
    makeLeaf: makeLeaf,
    makeInternal: makeInternal
  };
}));

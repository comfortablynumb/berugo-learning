/**
 * The base tree engine every balanced family in M04 is built on.
 *
 * Two things live here. The first is the set of primitives the families share:
 * node creation, the two rotations, iterative height/size/traversal, and the
 * ordering check. The second is the plain unbalanced BST, which is the
 * baseline every other family is measured against.
 *
 * Everything is iterative. A BST built from sorted input has height n, and at
 * the 10⁵-operation sequences `tree-lab` replays that is a stack overflow
 * rather than a slow answer - which is the same lesson M02.4 measures.
 *
 * The interface below is the contract `machines/tree-lab.js` drives, and every
 * family implements it without special cases: insert, remove, has, keys,
 * range, size, height, snapshot, checkInvariants, stats.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Bst = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function compareKeys(a, b) {
    if (a < b) return -1;
    return a > b ? 1 : 0;
  }

  function createNode(key, value) {
    return { key: key, value: value, left: null, right: null };
  }

  /* ------------------------------------------------------------- rotations */

  /** The right rotation: node.left becomes the subtree root. Returns it. */
  function rotateRight(node) {
    const pivot = node.left;
    node.left = pivot.right;
    pivot.right = node;
    return pivot;
  }

  /** The mirror image. Returns the new subtree root. */
  function rotateLeft(node) {
    const pivot = node.right;
    node.right = pivot.left;
    pivot.left = node;
    return pivot;
  }

  /* ------------------------------------------------- iterative tree walks */

  function size(node) {
    let count = 0;
    const stack = node ? [node] : [];
    while (stack.length) {
      const current = stack.pop();
      count += 1;
      if (current.left) stack.push(current.left);
      if (current.right) stack.push(current.right);
    }
    return count;
  }

  function height(node) {
    let best = 0;
    const stack = node ? [{ node: node, depth: 1 }] : [];
    while (stack.length) {
      const frame = stack.pop();
      if (frame.depth > best) best = frame.depth;
      if (frame.node.left) stack.push({ node: frame.node.left, depth: frame.depth + 1 });
      if (frame.node.right) stack.push({ node: frame.node.right, depth: frame.depth + 1 });
    }
    return best;
  }

  /** In-order keys. The sorted view of the tree, and the reference every
   *  property test compares against. */
  function inOrder(node) {
    const out = [];
    const stack = [];
    let current = node;
    while (current || stack.length) {
      while (current) { stack.push(current); current = current.left; }
      current = stack.pop();
      out.push(current.key);
      current = current.right;
    }
    return out;
  }

  /** Keys in [lo, hi], skipping the subtrees that cannot contain any. */
  function rangeOf(node, lo, hi, compare) {
    const out = [];
    const stack = [];
    let current = node;
    while (current || stack.length) {
      while (current) {
        stack.push(current);
        current = compare(current.key, lo) > 0 ? current.left : null;
      }
      current = stack.pop();
      if (compare(current.key, hi) > 0) return out;
      if (compare(current.key, lo) >= 0) out.push(current.key);
      current = current.right;
    }
    return out;
  }

  /** The ordering invariant, checked with real bounds rather than by looking
   *  only at each node's immediate children - which is the classic wrong
   *  version, and it accepts trees that are not search trees. */
  function checkOrder(node, compare) {
    const errors = [];
    const stack = node ? [{ node: node, lo: null, hi: null }] : [];

    while (stack.length) {
      const frame = stack.pop();
      const current = frame.node;
      if (frame.lo !== null && compare(current.key, frame.lo) <= 0) {
        errors.push('key ' + current.key + ' is not above its left bound ' + frame.lo);
      }
      if (frame.hi !== null && compare(current.key, frame.hi) >= 0) {
        errors.push('key ' + current.key + ' is not below its right bound ' + frame.hi);
      }
      if (current.left) stack.push({ node: current.left, lo: frame.lo, hi: current.key });
      if (current.right) stack.push({ node: current.right, lo: current.key, hi: frame.hi });
    }
    return errors;
  }

  /** A plain nested copy for the renderer, capped so a degenerate tree cannot
   *  produce a 100 000-deep object. `label` names the extra field a family
   *  wants drawn on the node. */
  function snapshot(node, options) {
    const settings = options || {};
    const maxDepth = settings.maxDepth || 6;
    const annotate = settings.annotate || function () { return null; };

    function walk(current, depth) {
      if (!current) return null;
      if (depth > maxDepth) return { key: '…', truncated: true, left: null, right: null };
      return {
        key: current.key,
        note: annotate(current),
        left: walk(current.left, depth + 1),
        right: walk(current.right, depth + 1)
      };
    }
    return walk(node, 1);
  }

  function newStats() {
    return {
      comparisons: 0, nodeVisits: 0, rotations: 0,
      inserts: 0, removes: 0, finds: 0
    };
  }

  /* --------------------------------------------------------- the plain BST */

  function create(options) {
    const settings = options || {};
    const compare = settings.compare || compareKeys;
    let root = null;
    let count = 0;
    let stats = newStats();

    function cmp(a, b) {
      stats.comparisons += 1;
      return compare(a, b);
    }

    function findNode(key) {
      let node = root;
      while (node) {
        stats.nodeVisits += 1;
        const order = cmp(key, node.key);
        if (order === 0) return node;
        node = order < 0 ? node.left : node.right;
      }
      return null;
    }

    function insert(key, value) {
      stats.inserts += 1;
      if (!root) { root = createNode(key, value); count = 1; return true; }

      let node = root;
      for (;;) {
        stats.nodeVisits += 1;
        const order = cmp(key, node.key);
        if (order === 0) { node.value = value; return false; }
        const side = order < 0 ? 'left' : 'right';
        if (!node[side]) { node[side] = createNode(key, value); count += 1; return true; }
        node = node[side];
      }
    }

    function attach(parent, side, child) {
      if (!parent) root = child;
      else parent[side] = child;
    }

    /** The three delete cases: no child, one child, two children. The last one
     *  copies the in-order successor into the node and deletes the successor,
     *  which by construction has no left child. */
    function detach(node, parent, side) {
      if (!node.left || !node.right) {
        attach(parent, side, node.left || node.right);
        return 'one-child';
      }

      let successorParent = node;
      let successor = node.right;
      let successorSide = 'right';
      while (successor.left) {
        successorParent = successor;
        successor = successor.left;
        successorSide = 'left';
      }

      node.key = successor.key;
      node.value = successor.value;
      successorParent[successorSide] = successor.right;
      return 'two-children';
    }

    function remove(key) {
      stats.removes += 1;
      let parent = null;
      let node = root;
      let side = null;

      while (node) {
        stats.nodeVisits += 1;
        const order = cmp(key, node.key);
        if (order === 0) break;
        parent = node;
        side = order < 0 ? 'left' : 'right';
        node = node[side];
      }

      if (!node) return false;
      detach(node, parent, side);
      count -= 1;
      return true;
    }

    /** Rotates the node holding `key` above its parent, which is what the demo
     *  does when a node is dragged. Returns the direction, or null. */
    function rotateAt(key) {
      let parent = null;
      let node = root;
      let side = null;

      while (node && compare(key, node.key) !== 0) {
        parent = node;
        side = compare(key, node.key) < 0 ? 'left' : 'right';
        node = node[side];
      }
      if (!node || !parent) return null;

      stats.rotations += 1;
      const rotated = side === 'left' ? rotateRight(parent) : rotateLeft(parent);
      return { direction: side === 'left' ? 'right' : 'left', root: attachRotated(rotated, parent) };
    }

    function attachRotated(rotated, oldRoot) {
      if (root === oldRoot) { root = rotated; return rotated; }
      const path = pathTo(oldRoot.key);
      const parent = path[path.length - 2];
      if (!parent) { root = rotated; return rotated; }
      if (parent.left === oldRoot) parent.left = rotated;
      else parent.right = rotated;
      return rotated;
    }

    function pathTo(key) {
      const out = [];
      let node = root;
      while (node) {
        out.push(node);
        const order = compare(key, node.key);
        if (order === 0) return out;
        node = order < 0 ? node.left : node.right;
      }
      return out;
    }

    function checkInvariants() {
      const errors = checkOrder(root, compare);
      if (size(root) !== count) errors.push('node count ' + size(root) + ' disagrees with size ' + count);
      return { ok: errors.length === 0, errors: errors };
    }

    return {
      name: 'bst',
      insert: insert,
      remove: remove,
      has: function (key) { stats.finds += 1; return findNode(key) !== null; },
      get: function (key) { stats.finds += 1; const node = findNode(key); return node ? node.value : undefined; },
      keys: function () { return inOrder(root); },
      range: function (lo, hi) { return rangeOf(root, lo, hi, compare); },
      size: function () { return count; },
      height: function () { return height(root); },
      root: function () { return root; },
      snapshot: function (options) { return snapshot(root, options); },
      rotateAt: rotateAt,
      pathTo: pathTo,
      checkInvariants: checkInvariants,
      stats: function () { return Object.assign({ height: height(root), size: count }, stats); },
      resetStats: function () { stats = newStats(); }
    };
  }

  return {
    create: create,
    createNode: createNode,
    compareKeys: compareKeys,
    rotateLeft: rotateLeft,
    rotateRight: rotateRight,
    size: size,
    height: height,
    inOrder: inOrder,
    rangeOf: rangeOf,
    checkOrder: checkOrder,
    snapshot: snapshot,
    newStats: newStats
  };
}));

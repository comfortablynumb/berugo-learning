/**
 * Pairing heaps: the self-adjusting answer to the Fibonacci heap.
 *
 * A pairing heap is a single multiway tree in heap order, and every operation
 * is built from one primitive - link two roots, the loser becoming the
 * winner's newest child. Insert is a link, meld is a link, decrease-key is a
 * cut and a link. Only pop does anything more, and what it does is the whole
 * design: the two-pass merge.
 *
 * Pass one walks the orphaned children left to right pairing them up; pass two
 * folds the results right to left. Pairing first is what matters - a single
 * left-to-right fold gives a degenerate spine and O(n) behaviour, and the
 * pairing pass is what keeps the tree bushy. The bounds are famously not
 * settled: O(log n) amortised for everything is proved, decrease-key is known
 * to be between Ω(log log n) and O(log n), and in practice it measures like
 * O(1). What is settled is that it beats a Fibonacci heap on real workloads,
 * which is why boost and LEDA ship it.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.PairingHeap = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function minFirst(a, b) {
    if (a < b) return -1;
    return a > b ? 1 : 0;
  }

  function newStats() {
    return {
      comparisons: 0, links: 0, cuts: 0, nodeTouches: 0, passOneLinks: 0, passTwoLinks: 0,
      pushes: 0, pops: 0, melds: 0, decreaseKeys: 0
    };
  }

  function create(options) {
    const settings = options || {};
    const compare = settings.compare || minFirst;
    /* One-pass merge, for the demo that shows why the pairing pass exists. */
    const singlePass = Boolean(settings.singlePass);

    let root = null;
    let count = 0;
    let stats = newStats();
    const handles = new Map();

    function cmp(a, b) {
      stats.comparisons += 1;
      return compare(a, b);
    }

    function makeNode(key, id) {
      return { key: key, id: id, child: null, next: null, prev: null };
    }

    /** The one primitive: the loser becomes the winner's newest child. */
    function link(a, b) {
      if (!a) return b;
      if (!b) return a;
      stats.links += 1;
      stats.nodeTouches += 2;

      const winner = cmp(a.key, b.key) <= 0 ? a : b;
      const loser = winner === a ? b : a;

      loser.next = winner.child;
      if (winner.child) winner.child.prev = loser;
      loser.prev = winner;
      winner.child = loser;
      winner.next = null;
      return winner;
    }

    /** Left to right, pairing adjacent siblings. This is the pass that keeps
     *  the tree from degenerating into a spine. */
    function pairUp(first) {
      const paired = [];
      let node = first;

      while (node) {
        const a = node;
        const b = node.next;
        node = b ? b.next : null;
        a.next = null;
        a.prev = null;
        if (b) { b.next = null; b.prev = null; }
        stats.passOneLinks += b ? 1 : 0;
        paired.push(b ? link(a, b) : a);
      }
      return paired;
    }

    /** Right to left, folding the paired results into one tree. */
    function foldRight(paired) {
      let merged = null;
      for (let i = paired.length - 1; i >= 0; i -= 1) {
        stats.passTwoLinks += merged ? 1 : 0;
        merged = link(paired[i], merged);
      }
      return merged;
    }

    /** The naive alternative, kept so the demo can measure what it costs. */
    function foldLeft(first) {
      let merged = null;
      let node = first;
      while (node) {
        const next = node.next;
        node.next = null;
        node.prev = null;
        stats.passOneLinks += merged ? 1 : 0;
        merged = link(merged, node);
        node = next;
      }
      return merged;
    }

    function push(key, id) {
      stats.pushes += 1;
      const handle = id === undefined ? key : id;
      const node = makeNode(key, handle);
      handles.set(handle, node);
      root = link(root, node);
      count += 1;
      return handle;
    }

    function pop() {
      if (!root) return undefined;
      stats.pops += 1;

      const top = { key: root.key, id: root.id };
      handles.delete(root.id);
      const children = root.child;
      root.child = null;

      root = singlePass ? foldLeft(children) : foldRight(pairUp(children));
      if (root) { root.prev = null; root.next = null; }
      count -= 1;
      return top;
    }

    /** Detach a node from its parent's child list. */
    function cut(node) {
      stats.cuts += 1;
      if (!node.prev) return;
      if (node.prev.child === node) node.prev.child = node.next;
      else node.prev.next = node.next;
      if (node.next) node.next.prev = node.prev;
      node.next = null;
      node.prev = null;
    }

    /** Cut the subtree out and link it back at the root. That is all - there
     *  is no consolidation and no mark bit, which is why it is short. */
    function decreaseKey(id, key) {
      stats.decreaseKeys += 1;
      const node = handles.get(id);
      if (!node) return false;
      if (cmp(node.key, key) <= 0) return false;

      node.key = key;
      if (node === root) return true;
      cut(node);
      root = link(root, node);
      return true;
    }

    function meld(other) {
      stats.melds += 1;
      const incoming = other.size();
      other.handles().forEach(function (node, id) { handles.set(id, node); });
      root = link(root, other.detach());
      count += incoming;
      return count;
    }

    function walk(visit) {
      const stack = root ? [{ node: root, depth: 1 }] : [];
      while (stack.length) {
        const frame = stack.pop();
        visit(frame.node, frame.depth);
        let child = frame.node.child;
        while (child) {
          stack.push({ node: child, depth: frame.depth + 1 });
          child = child.next;
        }
      }
    }

    function checkInvariants() {
      const errors = [];
      let seen = 0;
      let deepest = 0;

      walk(function (node, depth) {
        seen += 1;
        deepest = Math.max(deepest, depth);
        let child = node.child;
        let previous = null;
        while (child) {
          if (compare(child.key, node.key) < 0) {
            errors.push('child ' + child.id + ' outranks its parent ' + node.id);
          }
          const expected = previous || node;
          if (child.prev !== expected) errors.push('node ' + child.id + ' has a stale prev link');
          previous = child;
          child = child.next;
        }
      });

      if (seen !== count) errors.push('walked ' + seen + ' nodes, size says ' + count);
      if (root && (root.next || root.prev)) errors.push('the root is still linked to a sibling');
      void deepest;
      return { ok: errors.length === 0, errors: errors };
    }

    function height() {
      let deepest = 0;
      walk(function (node, depth) { deepest = Math.max(deepest, depth); });
      return deepest;
    }

    /** The public surface, assembled in one place. */
    function publicApi() {
      return {
        name: singlePass ? 'pairing-heap-1pass' : 'pairing-heap',
        push: push,
        pop: pop,
        peek: function () { return root ? { key: root.key, id: root.id } : undefined; },
        meld: meld,
        decreaseKey: decreaseKey,
        size: function () { return count; },
        height: height,
        rootChildren: function () {
          let n = 0;
          let child = root ? root.child : null;
          while (child) { n += 1; child = child.next; }
          return n;
        },
        root: function () { return root; },
        handles: function () { return handles; },
        detach: function () { const node = root; root = null; count = 0; handles.clear(); return node; },
        clear: function () { root = null; count = 0; handles.clear(); },
        checkInvariants: checkInvariants,
        stats: function () { return Object.assign({ size: count, height: height() }, stats); },
        resetStats: function () { stats = newStats(); }
      };
    }

    return publicApi();
  }

  return { create: create, newStats: newStats, minFirst: minFirst };
}));

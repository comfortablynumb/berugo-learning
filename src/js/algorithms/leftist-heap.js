/**
 * Leftist and skew heaps: two mergeable families built on one primitive.
 *
 * Everything here is `meld`. Insert is "meld a singleton", pop is "meld the
 * two children of the root", and there is no other structural code at all —
 * which is why these are the mergeable heaps you can still write correctly a
 * year later.
 *
 * A leftist heap keeps the null-path length on each node and insists the left
 * child's is at least the right child's, so the right spine is the shortest
 * path to a null and has length at most log₂(n + 1). Meld walks only that
 * spine, so it is O(log n) worst case.
 *
 * A skew heap drops the field and the invariant entirely and unconditionally
 * swaps the children after every meld. That is the self-adjusting version: no
 * bookkeeping, no worst-case bound, and O(log n) amortised by the same kind of
 * potential argument splay trees use.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LeftistHeap = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function minFirst(a, b) {
    if (a < b) return -1;
    return a > b ? 1 : 0;
  }

  function newStats() {
    return {
      comparisons: 0, nodeTouches: 0, meldSteps: 0, childSwaps: 0,
      pushes: 0, pops: 0, melds: 0
    };
  }

  function nplOf(node) {
    return node ? node.npl : 0;
  }

  function create(options) {
    const settings = options || {};
    const compare = settings.compare || minFirst;
    const skew = Boolean(settings.skew);
    let root = null;
    let count = 0;
    let stats = newStats();

    function cmp(a, b) {
      stats.comparisons += 1;
      return compare(a, b);
    }

    function makeNode(key, id) {
      return { key: key, id: id, left: null, right: null, npl: 1 };
    }

    /** The leftist repair: the taller null path goes left, and the node's own
     *  null-path length is one more than the shorter side. */
    function repairLeftist(node) {
      if (nplOf(node.left) < nplOf(node.right)) {
        const swapped = node.left;
        node.left = node.right;
        node.right = swapped;
        stats.childSwaps += 1;
      }
      node.npl = 1 + nplOf(node.right);
      return node;
    }

    /** The skew repair: swap unconditionally, keep no field. */
    function repairSkew(node) {
      const swapped = node.left;
      node.left = node.right;
      node.right = swapped;
      stats.childSwaps += 1;
      node.npl = 1 + nplOf(node.right);
      return node;
    }

    /** The one primitive. Walks down the right spines of both heaps, taking
     *  whichever root outranks the other, then repairs on the way back up. */
    function meldNodes(a, b) {
      if (!a) return b;
      if (!b) return a;
      stats.meldSteps += 1;
      stats.nodeTouches += 2;

      const winner = cmp(a.key, b.key) <= 0 ? a : b;
      const loser = winner === a ? b : a;

      winner.right = meldNodes(winner.right, loser);
      return skew ? repairSkew(winner) : repairLeftist(winner);
    }

    function push(key, id) {
      stats.pushes += 1;
      root = meldNodes(root, makeNode(key, id === undefined ? key : id));
      count += 1;
      return root;
    }

    function pop() {
      if (!root) return undefined;
      stats.pops += 1;

      const top = { key: root.key, id: root.id };
      root = meldNodes(root.left, root.right);
      count -= 1;
      return top;
    }

    function meld(other) {
      stats.melds += 1;
      /* The size has to be read before detaching: detach() empties the other
         heap, so asking it afterwards reports zero and the melded count is
         silently short. */
      const incoming = other.size();
      root = meldNodes(root, other.detach());
      count += incoming;
      return count;
    }

    /** The right spine is the shortest path to a null, so its length bounds
     *  the cost of every meld. */
    function rightSpineLength() {
      let length = 0;
      let node = root;
      while (node) { length += 1; node = node.right; }
      return length;
    }

    function height(node) {
      const stack = node ? [{ node: node, depth: 1 }] : [];
      let best = 0;
      while (stack.length) {
        const frame = stack.pop();
        best = Math.max(best, frame.depth);
        if (frame.node.left) stack.push({ node: frame.node.left, depth: frame.depth + 1 });
        if (frame.node.right) stack.push({ node: frame.node.right, depth: frame.depth + 1 });
      }
      return best;
    }

    function checkInvariants() {
      const errors = [];
      const stack = root ? [root] : [];
      let seen = 0;

      while (stack.length) {
        const node = stack.pop();
        seen += 1;

        [node.left, node.right].forEach(function (child) {
          if (!child) return;
          if (compare(child.key, node.key) < 0) {
            errors.push('child ' + child.id + ' outranks its parent ' + node.id);
          }
          stack.push(child);
        });

        if (!skew) {
          if (nplOf(node.left) < nplOf(node.right)) {
            errors.push('node ' + node.id + ' breaks the leftist rule: npl(left) < npl(right)');
          }
          if (node.npl !== 1 + nplOf(node.right)) {
            errors.push('node ' + node.id + ' stores npl ' + node.npl + ', children say ' + (1 + nplOf(node.right)));
          }
        }
      }

      if (seen !== count) errors.push('walked ' + seen + ' nodes, size says ' + count);
      if (!skew && root && rightSpineLength() > Math.log2(count + 1) + 1) {
        errors.push('the right spine is ' + rightSpineLength() + ', over the log2(n + 1) bound');
      }
      return { ok: errors.length === 0, errors: errors };
    }

    /** The public surface, assembled in one place. */
    function publicApi() {
      return {
        name: skew ? 'skew-heap' : 'leftist-heap',
        push: push,
        pop: pop,
        peek: function () { return root ? { key: root.key, id: root.id } : undefined; },
        meld: meld,
        size: function () { return count; },
        height: function () { return height(root); },
        rightSpine: rightSpineLength,
        nplBound: function () { return Math.floor(Math.log2(count + 1)); },
        root: function () { return root; },
        detach: function () { const node = root; root = null; count = 0; return node; },
        clear: function () { root = null; count = 0; },
        checkInvariants: checkInvariants,
        stats: function () { return Object.assign({ size: count, rightSpine: rightSpineLength() }, stats); },
        resetStats: function () { stats = newStats(); }
      };
    }

    return publicApi();
  }

  return { create: create, newStats: newStats, nplOf: nplOf, minFirst: minFirst };
}));

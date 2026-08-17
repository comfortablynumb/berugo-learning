/**
 * Fibonacci heaps: the structure whose bounds nobody disputes and whose
 * constants nobody defends.
 *
 * The idea is to do as little as possible until forced. Insert drops a node
 * into a root list and stops. Meld concatenates two root lists and stops.
 * Decrease-key cuts the node out and drops it in the root list, and stops. All
 * three are O(1) worst case, and the mess they leave is paid for exactly once,
 * by the extract-min that finally has to consolidate the root list into one
 * tree per degree.
 *
 * Cascading cuts are the part that makes the analysis work: when a node loses
 * a second child it is cut from its parent too, which keeps a node of degree d
 * from having fewer than F(d + 2) descendants. That is where the Fibonacci
 * numbers - and the name - come from, and it is what bounds the maximum degree
 * at log_φ(n).
 *
 * The cost is a node carrying parent, child, two sibling pointers, a degree
 * and a mark bit, and a consolidation that touches an array per pop. This
 * platform measures both the operation counts and the node touches so the
 * theory and the practice can be shown side by side, which is the point of
 * section 5.5.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.FibonacciHeap = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const PHI = (1 + Math.sqrt(5)) / 2;

  function minFirst(a, b) {
    if (a < b) return -1;
    return a > b ? 1 : 0;
  }

  function newStats() {
    return {
      comparisons: 0, links: 0, cuts: 0, cascadingCuts: 0, marks: 0, nodeTouches: 0,
      consolidations: 0, pushes: 0, pops: 0, melds: 0, decreaseKeys: 0
    };
  }

  function create(options) {
    const settings = options || {};
    const compare = settings.compare || minFirst;

    /* The root list is a circular doubly linked list; `min` points into it. */
    let min = null;
    let count = 0;
    let stats = newStats();
    const handles = new Map();

    function cmp(a, b) {
      stats.comparisons += 1;
      return compare(a, b);
    }

    function makeNode(key, id) {
      const node = { key: key, id: id, parent: null, child: null, degree: 0, marked: false };
      node.left = node;
      node.right = node;
      return node;
    }

    /** Splice `node` into the circular list containing `into`. */
    function spliceInto(into, node) {
      node.left = into;
      node.right = into.right;
      into.right.left = node;
      into.right = node;
    }

    function unlink(node) {
      node.left.right = node.right;
      node.right.left = node.left;
      node.left = node;
      node.right = node;
    }

    function addToRootList(node) {
      node.parent = null;
      if (!min) { min = node; node.left = node; node.right = node; return; }
      spliceInto(min, node);
      if (cmp(node.key, min.key) < 0) min = node;
    }

    function push(key, id) {
      stats.pushes += 1;
      const handle = id === undefined ? key : id;
      const node = makeNode(key, handle);
      handles.set(handle, node);
      addToRootList(node);
      count += 1;
      return handle;
    }

    function rootList() {
      const out = [];
      if (!min) return out;
      let node = min;
      do { out.push(node); node = node.right; } while (node !== min);
      return out;
    }

    /** Make `loser` a child of `winner`. Both are roots when this is called. */
    function link(winner, loser) {
      stats.links += 1;
      unlink(loser);
      loser.parent = winner;
      loser.marked = false;

      if (!winner.child) { winner.child = loser; loser.left = loser; loser.right = loser; }
      else spliceInto(winner.child, loser);

      winner.degree += 1;
    }

    /** The deferred work, paid once per pop: collapse the root list so no two
     *  roots share a degree. The array is sized by the degree bound. */
    function consolidate() {
      stats.consolidations += 1;
      const bound = Math.floor(Math.log(Math.max(2, count)) / Math.log(PHI)) + 2;
      const byDegree = new Array(bound + 1).fill(null);

      rootList().forEach(function (start) {
        let node = start;
        let degree = node.degree;
        stats.nodeTouches += 1;

        while (byDegree[degree]) {
          let other = byDegree[degree];
          if (cmp(other.key, node.key) < 0) { const swap = node; node = other; other = swap; }
          link(node, other);
          byDegree[degree] = null;
          degree += 1;
        }
        byDegree[degree] = node;
      });

      min = null;
      byDegree.forEach(function (node) {
        if (!node) return;
        node.left = node;
        node.right = node;
        addToRootList(node);
      });
    }

    function pop() {
      if (!min) return undefined;
      stats.pops += 1;

      const top = { key: min.key, id: min.id };
      handles.delete(min.id);

      /* Promote the children, then drop the old minimum out of the list. */
      if (min.child) {
        const children = [];
        let child = min.child;
        do { children.push(child); child = child.right; } while (child !== min.child);
        children.forEach(function (node) {
          node.parent = null;
          /* The mark has to be cleared here. It records "this node has already
             lost a child while being a child", and a root cannot lose a child
             in that sense — leaving it set makes a marked root, which is what
             the invariant check catches and what would make a later cascading
             cut fire against nothing. */
          node.marked = false;
          node.left = node;
          node.right = node;
          spliceInto(min, node);
        });
        min.child = null;
      }

      const only = min.right === min;
      const next = min.right;
      unlink(min);
      min = only ? null : next;
      count -= 1;

      if (min) consolidate();
      return top;
    }

    /** Cut a node from its parent and move it to the root list. */
    function cut(node, parent) {
      stats.cuts += 1;
      if (parent.child === node) parent.child = node.right === node ? null : node.right;
      unlink(node);
      parent.degree -= 1;
      node.marked = false;
      addToRootList(node);
    }

    /** The cascade: a parent that has already lost a child loses itself too.
     *  This is what keeps a degree-d node from being too small, and therefore
     *  what bounds the maximum degree at log_φ(n). */
    function cascadingCut(node) {
      const parent = node.parent;
      if (!parent) return;
      if (!node.marked) { node.marked = true; stats.marks += 1; return; }
      stats.cascadingCuts += 1;
      cut(node, parent);
      cascadingCut(parent);
    }

    function decreaseKey(id, key) {
      stats.decreaseKeys += 1;
      const node = handles.get(id);
      if (!node) return false;
      if (cmp(node.key, key) <= 0) return false;

      node.key = key;
      const parent = node.parent;
      if (parent && cmp(node.key, parent.key) < 0) {
        cut(node, parent);
        cascadingCut(parent);
      }
      if (cmp(node.key, min.key) < 0) min = node;
      return true;
    }

    function meld(other) {
      stats.melds += 1;
      const incoming = other.size();
      const otherMin = other.detachInto(handles);
      if (otherMin) {
        if (!min) min = otherMin;
        else {
          /* Splice the two circular lists together in O(1). */
          const a = min.right;
          const b = otherMin.right;
          min.right = b;
          b.left = min;
          otherMin.right = a;
          a.left = otherMin;
          if (cmp(otherMin.key, min.key) < 0) min = otherMin;
        }
      }
      count += incoming;
      return count;
    }

    function walk(visit) {
      const stack = rootList().map(function (node) { return { node: node, depth: 1 }; });
      while (stack.length) {
        const frame = stack.pop();
        visit(frame.node, frame.depth);
        if (!frame.node.child) continue;
        let child = frame.node.child;
        do {
          stack.push({ node: child, depth: frame.depth + 1 });
          child = child.right;
        } while (child !== frame.node.child);
      }
    }

    function checkInvariants() {
      const errors = [];
      let seen = 0;

      walk(function (node) {
        seen += 1;
        if (node.parent && compare(node.key, node.parent.key) < 0) {
          errors.push('node ' + node.id + ' outranks its parent ' + node.parent.id);
        }
        if (node.left.right !== node || node.right.left !== node) {
          errors.push('node ' + node.id + ' has a broken sibling link');
        }

        let children = 0;
        if (node.child) {
          let child = node.child;
          do {
            children += 1;
            if (child.parent !== node) errors.push('child ' + child.id + ' has a stale parent');
            child = child.right;
          } while (child !== node.child);
        }
        if (children !== node.degree) {
          errors.push('node ' + node.id + ' stores degree ' + node.degree + ' with ' + children + ' children');
        }
      });

      if (seen !== count) errors.push('walked ' + seen + ' nodes, size says ' + count);
      rootList().forEach(function (node) {
        if (node.marked) errors.push('root ' + node.id + ' is marked, which only children may be');
        if (min && compare(min.key, node.key) > 0) errors.push('the min pointer does not point at the minimum');
      });
      return { ok: errors.length === 0, errors: errors };
    }

    function maxDegree() {
      let best = 0;
      walk(function (node) { best = Math.max(best, node.degree); });
      return best;
    }

    /** The public surface, assembled in one place. */
    function publicApi() {
      return {
        name: 'fibonacci-heap',
        push: push,
        pop: pop,
        peek: function () { return min ? { key: min.key, id: min.id } : undefined; },
        meld: meld,
        decreaseKey: decreaseKey,
        size: function () { return count; },
        roots: function () { return rootList().length; },
        maxDegree: maxDegree,
        degreeBound: function () { return Math.floor(Math.log(Math.max(2, count)) / Math.log(PHI)); },
        marked: function () {
          let n = 0;
          walk(function (node) { if (node.marked) n += 1; });
          return n;
        },
        detachInto: function (into) {
          handles.forEach(function (node, id) { into.set(id, node); });
          const node = min;
          min = null;
          count = 0;
          handles.clear();
          return node;
        },
        clear: function () { min = null; count = 0; handles.clear(); },
        checkInvariants: checkInvariants,
        stats: function () { return Object.assign({ size: count, roots: rootList().length }, stats); },
        resetStats: function () { stats = newStats(); }
      };
    }

    return publicApi();
  }

  return { create: create, newStats: newStats, PHI: PHI, minFirst: minFirst };
}));

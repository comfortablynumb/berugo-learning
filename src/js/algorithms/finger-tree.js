/**
 * A 2-3 finger tree: one persistent structure that is a deque, a sequence, a
 * priority queue, an interval map or an ordered set depending on a single
 * choice - which monoid it annotates its nodes with.
 *
 * The shape is a spine of `Deep` nodes, each holding a *digit* of one to four
 * elements at each end and a finger tree of 2-3 `Node`s in the middle. Access
 * at either end is amortised O(1) because the digits absorb it; the middle
 * level is only disturbed when a digit overflows or empties, and that happens
 * geometrically less often as you go down.
 *
 * The annotation is the idea worth stealing even if you never write one of
 * these. Every node caches the monoid product of everything beneath it, and
 * `split` walks down using only that cache and a predicate on it. Pick the
 * measure and a family of queries falls out:
 *
 *   size (integers under +)      → index, take, drop, insertAt
 *   max priority (under max)     → a priority queue with O(log n) delete-max
 *   key (under "rightmost")      → an ordered sequence with search
 *   max interval end             → an interval map answering "what overlaps"
 *
 * Nothing about the tree changes between those four. That is the whole claim,
 * and the demo runs the same code four times to check it.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.FingerTree = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const MONOIDS = {
    size: {
      id: 'size',
      identity: 0,
      combine: function (a, b) { return a + b; },
      measure: function () { return 1; }
    },
    sum: {
      id: 'sum',
      identity: 0,
      combine: function (a, b) { return a + b; },
      measure: function (item) { return item.value === undefined ? item : item.value; }
    },
    priority: {
      id: 'priority',
      identity: -Infinity,
      combine: function (a, b) { return Math.max(a, b); },
      measure: function (item) { return item.priority === undefined ? item : item.priority; }
    },
    intervalEnd: {
      id: 'intervalEnd',
      identity: -Infinity,
      combine: function (a, b) { return Math.max(a, b); },
      measure: function (item) { return item.end; }
    }
  };

  function emptyStats() {
    return { pushes: 0, pops: 0, splits: 0, nodesAllocated: 0, nodesVisited: 0, concats: 0 };
  }

  /** A named monoid, or a caller-supplied one, or the default. */
  function monoidFor(choice) {
    const monoid = typeof choice === 'string' ? MONOIDS[choice] : (choice || MONOIDS.size);
    if (!monoid) throw new Error('FingerTree: unknown monoid "' + choice + '"');
    return monoid;
  }

  function create(options) {
    const monoid = monoidFor((options || {}).monoid);
    let stats = emptyStats();

    const EMPTY = { kind: 'empty', measure: monoid.identity };

    function measureOf(value) {
      if (value && (value.kind === 'node' || value.kind === 'deep' ||
        value.kind === 'single' || value.kind === 'empty')) return value.measure;
      return monoid.measure(value);
    }

    function measureAll(items) {
      return items.reduce(function (total, item) {
        return monoid.combine(total, measureOf(item));
      }, monoid.identity);
    }

    function node(items) {
      stats.nodesAllocated += 1;
      return { kind: 'node', measure: measureAll(items), items: items };
    }

    function single(value) {
      stats.nodesAllocated += 1;
      return { kind: 'single', measure: measureOf(value), value: value };
    }

    function deep(prefix, middle, suffix) {
      stats.nodesAllocated += 1;
      return {
        kind: 'deep',
        measure: monoid.combine(monoid.combine(measureAll(prefix), middle.measure), measureAll(suffix)),
        prefix: prefix, middle: middle, suffix: suffix
      };
    }

    /* ------------------------------------------------------------- ends */

    function pushFront(tree, value) {
      stats.pushes += 1;
      return consLeft(tree, value);
    }

    function consLeft(tree, value) {
      if (tree.kind === 'empty') return single(value);
      if (tree.kind === 'single') return deep([value], EMPTY, [tree.value]);
      if (tree.prefix.length < 4) {
        return deep([value].concat(tree.prefix), tree.middle, tree.suffix);
      }
      const overflow = node(tree.prefix.slice(1));
      return deep([value, tree.prefix[0]], consLeft(tree.middle, overflow), tree.suffix);
    }

    function pushBack(tree, value) {
      stats.pushes += 1;
      return consRight(tree, value);
    }

    function consRight(tree, value) {
      if (tree.kind === 'empty') return single(value);
      if (tree.kind === 'single') return deep([tree.value], EMPTY, [value]);
      if (tree.suffix.length < 4) {
        return deep(tree.prefix, tree.middle, tree.suffix.concat([value]));
      }
      const overflow = node(tree.suffix.slice(0, 3));
      return deep(tree.prefix, consRight(tree.middle, overflow), [tree.suffix[3], value]);
    }

    function deepLeft(prefix, middle, suffix) {
      /* A digit that has emptied is refilled from the middle, which is where
         a finger tree's amortisation lives. */
      if (prefix.length) return deep(prefix, middle, suffix);
      const view = viewLeft(middle);
      if (!view) return fromArray(suffix);
      return deep(view.head.items, view.tail, suffix);
    }

    function deepRight(prefix, middle, suffix) {
      if (suffix.length) return deep(prefix, middle, suffix);
      const view = viewRight(middle);
      if (!view) return fromArray(prefix);
      return deep(prefix, view.init, view.last.items);
    }

    function viewLeft(tree) {
      stats.nodesVisited += 1;
      if (tree.kind === 'empty') return null;
      if (tree.kind === 'single') return { head: tree.value, tail: EMPTY };
      return {
        head: tree.prefix[0],
        tail: deepLeft(tree.prefix.slice(1), tree.middle, tree.suffix)
      };
    }

    function viewRight(tree) {
      stats.nodesVisited += 1;
      if (tree.kind === 'empty') return null;
      if (tree.kind === 'single') return { last: tree.value, init: EMPTY };
      return {
        last: tree.suffix[tree.suffix.length - 1],
        init: deepRight(tree.prefix, tree.middle, tree.suffix.slice(0, -1))
      };
    }

    function popFront(tree) {
      stats.pops += 1;
      return viewLeft(tree);
    }

    function popBack(tree) {
      stats.pops += 1;
      return viewRight(tree);
    }

    /* ------------------------------------------------------------ concat */

    function nodes(items) {
      if (items.length === 2) return [node(items)];
      if (items.length === 3) return [node(items)];
      if (items.length === 4) return [node(items.slice(0, 2)), node(items.slice(2))];
      return [node(items.slice(0, 3))].concat(nodes(items.slice(3)));
    }

    function append(left, middle, right) {
      /* Prepending the middle onto `right` is a *right* fold: a left fold puts
         the first element nearest the front and silently reverses the run,
         which shows up only when a concat crosses a spine level. */
      if (left.kind === 'empty') {
        return middle.reduceRight(function (tree, value) { return consLeft(tree, value); }, right);
      }
      if (right.kind === 'empty') {
        return middle.reduce(function (tree, value) { return consRight(tree, value); }, left);
      }
      if (left.kind === 'single') return consLeft(append(EMPTY, middle, right), left.value);
      if (right.kind === 'single') return consRight(append(left, middle, EMPTY), right.value);
      return deep(left.prefix,
        append(left.middle, nodes(left.suffix.concat(middle).concat(right.prefix)), right.middle),
        right.suffix);
    }

    function concat(left, right) {
      stats.concats += 1;
      return append(left, [], right);
    }

    /* ------------------------------------------------------------- split */

    function splitDigit(items, predicate, accumulator) {
      for (let i = 0; i < items.length - 1; i += 1) {
        const next = monoid.combine(accumulator, measureOf(items[i]));
        if (predicate(next)) {
          return { left: items.slice(0, i), focus: items[i], right: items.slice(i + 1), before: accumulator };
        }
        accumulator = next;
      }
      const last = items.length - 1;
      return { left: items.slice(0, last), focus: items[last], right: [], before: accumulator };
    }

    function splitTree(tree, predicate, accumulator) {
      /* Walk down using only the cached measures: at each node ask whether the
         running product crosses the predicate inside the prefix, the middle or
         the suffix, and recurse into whichever it is. Nothing looks at an
         element until the very last step. */
      stats.nodesVisited += 1;
      if (tree.kind === 'single') return { left: EMPTY, focus: tree.value, right: EMPTY };

      const afterPrefix = monoid.combine(accumulator, measureAll(tree.prefix));
      if (predicate(afterPrefix)) {
        const cut = splitDigit(tree.prefix, predicate, accumulator);
        return { left: fromArray(cut.left), focus: cut.focus, right: deepLeft(cut.right, tree.middle, tree.suffix) };
      }

      const afterMiddle = monoid.combine(afterPrefix, tree.middle.measure);
      if (predicate(afterMiddle)) {
        const inner = splitTree(tree.middle, predicate, afterPrefix);
        const before = monoid.combine(afterPrefix, inner.left.measure);
        const cut = splitDigit(inner.focus.items, predicate, before);
        return {
          left: deepRight(tree.prefix, inner.left, cut.left),
          focus: cut.focus,
          right: deepLeft(cut.right, inner.right, tree.suffix)
        };
      }

      const cut = splitDigit(tree.suffix, predicate, afterMiddle);
      return {
        left: deepRight(tree.prefix, tree.middle, cut.left),
        focus: cut.focus,
        right: fromArray(cut.right)
      };
    }

    function split(tree, predicate) {
      /* Returns [before, from] with the focused element at the head of `from`,
         so `concat(before, from)` reconstructs the original exactly. */
      stats.splits += 1;
      if (tree.kind === 'empty') return [EMPTY, EMPTY];
      if (!predicate(tree.measure)) return [tree, EMPTY];
      const parts = splitTree(tree, predicate, monoid.identity);
      return [parts.left, consLeft(parts.right, parts.focus)];
    }

    /* ------------------------------------------------------------ helpers */

    function fromArray(items) {
      return items.reduce(consRight, EMPTY);
    }

    function toArray(tree) {
      const out = [];
      let view = viewLeft(tree);
      while (view) { out.push(view.head); view = viewLeft(view.tail); }
      return out;
    }

    function shape(tree) {
      /* The spine, not the contents: how many Deep levels there are and how
         wide the digits at each of them are. The elements themselves live in
         2-3 nodes hanging off the middle and are counted by `length`. */
      const totals = { spine: 0, digits: 0, digitElements: 0, widths: [] };
      measureShape(tree, totals);
      return Object.assign(totals, {
        measure: tree.measure,
        monoid: monoid.id,
        length: toArray(tree).length
      });
    }

    function measureShape(tree, totals) {
      if (tree.kind === 'empty') return;
      if (tree.kind === 'single') { totals.digitElements += 1; return; }
      totals.spine += 1;
      totals.digits += 2;
      totals.digitElements += tree.prefix.length + tree.suffix.length;
      totals.widths.push(tree.prefix.length + '/' + tree.suffix.length);
      measureShape(tree.middle, totals);
    }

    return {
      monoid: monoid.id, pushFront: pushFront, pushBack: pushBack, popFront: popFront,
      popBack: popBack, concat: concat, split: split, fromArray: fromArray,
      toArray: toArray, shape: shape,
      empty: function () { return EMPTY; },
      measure: function (tree) { return tree.measure; },
      stats: function () { return Object.assign({}, stats); },
      resetStats: function () { stats = emptyStats(); }
    };
  }

  return { create: create, monoids: MONOIDS };
}));

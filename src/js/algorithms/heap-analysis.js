/**
 * Reading a heap dump: retained size, dominators and the retaining path.
 *
 * A heap dump answers one question well and every other question badly. The
 * question it answers is "if this one reference went away, how much memory
 * would come back", and the structure that answers it is the dominator tree
 * of the object graph rooted at a synthetic node above the GC roots.
 *
 * That is the same algorithm the compiler ran over basic blocks in 29.3, on a
 * different graph. An object X dominates Y when every path from a root to Y
 * passes through X, so dropping X makes Y unreachable — which is precisely
 * "retained by X". Shallow size is what an object occupies; RETAINED size is
 * what it keeps alive, and the difference between the two columns is why a
 * 48-byte cache object can be responsible for a gigabyte.
 *
 * The leak hunt then has a mechanical shape. Sort by retained size, take the
 * top row, walk the retaining path back to a root, and look at the reference
 * that should not exist. No intuition about "what is holding this" is needed
 * and none should be trusted.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.HeapAnalysis = api;
}(this, function (root) {
  'use strict';

  const berugo = root && root.Berugo ? root.Berugo : null;
  const Dominators = berugo && berugo.Dominators
    ? berugo.Dominators : require('../machines/berugo/dominators.js');

  /** The synthetic node above every GC root, so one tree covers the heap. */
  const ROOT = 'gc-roots';

  /* --------------------------------------------------------- the graph */

  /**
   * The object graph as the dominator code wants it: string ids, a successor
   * map, a predecessor map and one entry. The synthetic entry matters — a
   * heap has many roots and a dominator tree has one, and joining them under
   * a node that dominates everything is what makes "retained by the program"
   * expressible at all.
   */
  function graphOf(heap) {
    const succs = {};
    const preds = {};

    succs[ROOT] = [];
    preds[ROOT] = [];
    heap.cells.forEach(function (cell, id) {
      succs[key(id)] = [];
      preds[key(id)] = [];
    });
    heap.roots.forEach(function (id) {
      if (heap.cells.has(id)) link(succs, preds, ROOT, key(id));
    });
    heap.cells.forEach(function (cell, id) {
      cell.refs.forEach(function (child) {
        if (child === null || child === undefined || !heap.cells.has(child)) return;
        link(succs, preds, key(id), key(child));
      });
    });
    return { entry: ROOT, succs: succs, preds: preds };
  }

  function link(succs, preds, from, to) {
    if (succs[from].indexOf(to) === -1) succs[from].push(to);
    if (preds[to].indexOf(from) === -1) preds[to].push(from);
  }

  function key(id) { return 'o' + id; }

  function idOf(name) { return name === ROOT ? null : Number(name.slice(1)); }

  /* ------------------------------------------------------ retained sizes */

  /**
   * Retained size is the total size of everything an object dominates,
   * itself included. Computing it bottom-up over the dominator tree is one
   * pass: a node's retained size is its own size plus its children's, and the
   * children are exactly the objects it alone keeps alive.
   */
  function analyse(heap) {
    const graph = graphOf(heap);
    const tree = Dominators.compute(graph);
    const children = childMap(tree, graph);
    const retained = new Map();

    postorder(children, ROOT).forEach(function (name) {
      const own = name === ROOT ? 0 : sizeOf(heap, idOf(name));
      const below = (children.get(name) || []).reduce(function (sum, child) {
        return sum + (retained.get(child) || 0);
      }, 0);

      retained.set(name, own + below);
    });
    return { graph: graph, tree: tree, children: children, retained: retained,
      rows: rowsOf(heap, retained, children) };
  }

  function sizeOf(heap, id) {
    const cell = heap.cells.get(id);

    return cell ? cell.size : 0;
  }

  function childMap(tree, graph) {
    const children = new Map();

    Object.keys(graph.succs).forEach(function (name) { children.set(name, []); });
    Object.keys(graph.succs).forEach(function (name) {
      if (name === ROOT) return;
      const parent = tree.idom[name];

      if (parent === undefined || parent === name) return;
      children.get(parent).push(name);
    });
    return children;
  }

  function postorder(children, from) {
    const order = [];
    const seen = new Set();
    const walk = function (name) {
      if (seen.has(name)) return;
      seen.add(name);
      (children.get(name) || []).forEach(walk);
      order.push(name);
    };

    walk(from);
    return order;
  }

  /**
   * One row per object, sorted by what it retains. This is the table a heap
   * profiler shows and reading it top-down is the whole of the technique:
   * the first row whose retained size surprises you is the leak.
   */
  function rowsOf(heap, retained, children) {
    const rows = [];

    heap.cells.forEach(function (cell, id) {
      rows.push({ id: id, kind: cell.kind || 'record', site: cell.site || null,
        shallow: cell.size, retained: retained.get(key(id)) || cell.size,
        dominated: (children.get(key(id)) || []).length });
    });
    return rows.sort(function (a, b) {
      if (b.retained !== a.retained) return b.retained - a.retained;
      return a.id - b.id;
    });
  }

  /* ------------------------------------------------- the retaining path */

  /**
   * The shortest path from a GC root to an object, which is what a profiler
   * shows when you ask "why is this alive". Breadth-first because the
   * shortest path is the one a human can read; any path proves reachability,
   * but a twelve-hop path through a cache proves nothing anybody can act on.
   */
  function retainingPath(heap, target) {
    const graph = graphOf(heap);
    const previous = new Map();
    const queue = [ROOT];

    previous.set(ROOT, null);
    while (queue.length) {
      const here = queue.shift();

      if (here === key(target)) return unwind(previous, here);
      (graph.succs[here] || []).forEach(function (next) {
        if (previous.has(next)) return;
        previous.set(next, here);
        queue.push(next);
      });
    }
    return [];
  }

  function unwind(previous, from) {
    const path = [];
    let here = from;

    while (here !== null && here !== undefined) {
      path.unshift(here === ROOT ? { id: null, name: ROOT } : { id: idOf(here), name: here });
      here = previous.get(here);
    }
    return path;
  }

  /**
   * The dominator of an object that is NOT the synthetic root: the single
   * reference whose removal frees it. When a profiler says "one reference is
   * keeping 400 MB alive", this is the reference it means.
   */
  function immediateHolder(analysis, id) {
    const parent = analysis.tree.idom[key(id)];

    if (parent === undefined || parent === key(id)) return null;
    return parent === ROOT ? null : idOf(parent);
  }

  /* ---------------------------------------------------------- growth */

  /**
   * A leak is not a big object, it is a growing one. Comparing two snapshots
   * by retained size per allocation site is what separates a cache that is
   * merely large from one that is unbounded, and only the second is a bug.
   */
  function growth(before, after) {
    const first = bySite(before);
    const second = bySite(after);
    const rows = [];

    second.forEach(function (row, site) {
      const was = first.get(site) || { count: 0, retained: 0 };

      rows.push({ site: site, count: row.count, wasCount: was.count,
        retained: row.retained, wasRetained: was.retained,
        delta: row.retained - was.retained });
    });
    return rows.sort(function (a, b) { return b.delta - a.delta; });
  }

  function bySite(analysis) {
    const sites = new Map();

    analysis.rows.forEach(function (row) {
      const name = row.site ? row.site.origin || String(row.site) : row.kind;

      if (!sites.has(name)) sites.set(name, { count: 0, retained: 0 });
      sites.get(name).count += 1;
      sites.get(name).retained += row.shallow;
    });
    return sites;
  }

  /**
   * Is the heap stable? Over a long run of the same work, a program without a
   * leak returns to the same live size; one with a leak does not. The test is
   * the slope of live bytes across repetitions, not any single reading, and
   * this is what the lab is graded on rather than inspection of the code.
   */
  function stability(samples) {
    if (samples.length < 2) return { slope: 0, stable: true, first: 0, last: 0 };
    const first = samples[0];
    const last = samples[samples.length - 1];
    const mean = samples.reduce(function (sum, value) { return sum + value; }, 0)
      / samples.length;
    const middle = (samples.length - 1) / 2;
    let top = 0;
    let bottom = 0;

    samples.forEach(function (value, at) {
      top += (at - middle) * (value - mean);
      bottom += (at - middle) * (at - middle);
    });
    const slope = bottom ? top / bottom : 0;

    return { slope: slope, first: first, last: last,
      stable: Math.abs(slope) <= Math.max(1, mean * 0.01) };
  }

  return { ROOT: ROOT, graphOf: graphOf, analyse: analyse,
    retainingPath: retainingPath, immediateHolder: immediateHolder,
    growth: growth, stability: stability, key: key, idOf: idOf };
}));

/**
 * R-tree: a B-tree over rectangles, and the spatial index every database
 * actually ships (PostGIS GiST, SQLite R*Tree, Oracle, SQL Server).
 *
 * The difference from every other structure in this milestone is that sibling
 * nodes may *overlap*. A quadtree or a k-d tree partitions space, so a point
 * query follows one path; an R-tree covers space with minimum bounding
 * rectangles that can intersect, so a point query may have to follow several.
 * That makes overlap, not height, the quantity that decides query cost - and
 * it makes the split heuristic, which is what creates the overlap, the whole
 * design.
 *
 * Four splits are implemented so the choice can be measured rather than
 * asserted:
 *   'firstfit'  cut the entry list in half in insertion order - the baseline
 *               that shows what a heuristic is worth
 *   'linear'    Guttman's O(M) seed pick: the pair furthest apart on the axis
 *               with the greatest normalised separation
 *   'quadratic' Guttman's O(M²) seed pick: the pair that wastes the most space
 *               if grouped, then greedy assignment by preference
 *   'rstar'     axis chosen by the smallest perimeter sum, distribution by the
 *               smallest overlap, plus forced reinsertion on first overflow
 *
 * `bulkLoad` is sort-tile-recursive. It is here because the honest result of
 * this section is that bulk loading beats incremental insertion so reliably
 * that most systems rebuild rather than maintain - and that is a measurement,
 * not folklore.
 *
 * Two things about the R* path are load-bearing and easy to undo by accident.
 * Forced reinsertion is *queued* rather than performed in place: re-entering
 * the tree from the root while still unwinding an insertion lets a split
 * replace a node the outer recursion is still holding, and the entries under it
 * are lost - the tree stays structurally valid and simply stops returning them,
 * which is why only a brute-force oracle catches it. And reinsertion is
 * restricted to leaves, because putting an internal entry back has to put it
 * back at its own level and an insert that always descends to a leaf cannot do
 * that; the leaves are where most of the benefit is.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.RTree = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const REINSERT_FRACTION = 0.3;
  const STRATEGIES = ['firstfit', 'linear', 'quadratic', 'rstar'];

  function emptyStats() {
    return { queries: 0, nodesVisited: 0, candidatesTested: 0, results: 0, splits: 0, reinsertions: 0 };
  }

  function boxOf(entry) {
    return { minX: entry.minX, minY: entry.minY, maxX: entry.maxX, maxY: entry.maxY };
  }

  function unionOf(entries) {
    const box = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    entries.forEach(function (entry) {
      if (entry.minX < box.minX) box.minX = entry.minX;
      if (entry.minY < box.minY) box.minY = entry.minY;
      if (entry.maxX > box.maxX) box.maxX = entry.maxX;
      if (entry.maxY > box.maxY) box.maxY = entry.maxY;
    });
    return box;
  }

  function area(box) {
    return Math.max(0, box.maxX - box.minX) * Math.max(0, box.maxY - box.minY);
  }

  function perimeter(box) {
    return 2 * (Math.max(0, box.maxX - box.minX) + Math.max(0, box.maxY - box.minY));
  }

  function combined(a, b) {
    return {
      minX: Math.min(a.minX, b.minX), minY: Math.min(a.minY, b.minY),
      maxX: Math.max(a.maxX, b.maxX), maxY: Math.max(a.maxY, b.maxY)
    };
  }

  function intersectionArea(a, b) {
    const width = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX);
    const height = Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY);
    return width > 0 && height > 0 ? width * height : 0;
  }

  function overlaps(a, b) {
    return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
  }

  function centre(box) {
    return { x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 };
  }

  function makeNode(leaf, entries) {
    const node = { leaf: leaf, entries: entries || [], minX: 0, minY: 0, maxX: 0, maxY: 0 };
    return refresh(node);
  }

  function refresh(node) {
    const box = node.entries.length
      ? unionOf(node.entries)
      : { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    node.minX = box.minX;
    node.minY = box.minY;
    node.maxX = box.maxX;
    node.maxY = box.maxY;
    return node;
  }

  /* ------------------------------------------------------------- splits */

  /** Guttman linear: the extreme pair on the axis whose separation is widest
   *  relative to the whole node's width. O(M) and visibly worse than the rest. */
  function linearSeeds(entries) {
    const whole = unionOf(entries);
    let best = { a: 0, b: entries.length - 1, score: -Infinity };

    ['X', 'Y'].forEach(function (axis) {
      let lowest = 0;
      let highest = 0;
      entries.forEach(function (entry, index) {
        if (entry['min' + axis] > entries[lowest]['min' + axis]) lowest = index;
        if (entry['max' + axis] < entries[highest]['max' + axis]) highest = index;
      });
      const span = whole['max' + axis] - whole['min' + axis];
      const separation = Math.abs(entries[lowest]['min' + axis] - entries[highest]['max' + axis]);
      const score = span > 0 ? separation / span : 0;
      if (score > best.score && lowest !== highest) best = { a: lowest, b: highest, score: score };
    });

    return best;
  }

  /** Guttman quadratic: the pair that would waste the most space if put in
   *  the same group. O(M²), and the extra work buys a real reduction. */
  function quadraticSeeds(entries) {
    let best = { a: 0, b: 1, score: -Infinity };
    for (let i = 0; i < entries.length; i += 1) {
      for (let j = i + 1; j < entries.length; j += 1) {
        const waste = area(combined(entries[i], entries[j])) - area(entries[i]) - area(entries[j]);
        if (waste > best.score) best = { a: i, b: j, score: waste };
      }
    }
    return best;
  }

  const SEEDS = { linear: linearSeeds, quadratic: quadraticSeeds };

  /** Greedy assignment: each remaining entry joins the group it enlarges
   *  least, and a group short of `min` takes whatever is left. */
  function distribute(entries, seeds, limits) {
    const groups = [[entries[seeds.a]], [entries[seeds.b]]];
    const boxes = [boxOf(entries[seeds.a]), boxOf(entries[seeds.b])];
    const rest = entries.filter(function (entry, index) { return index !== seeds.a && index !== seeds.b; });

    rest.forEach(function (entry, index) {
      const left = rest.length - index;
      for (let side = 0; side < 2; side += 1) {
        if (groups[side].length + left === limits.min) {
          groups[side].push(entry);
          boxes[side] = combined(boxes[side], entry);
          return;
        }
      }
      const growth = [0, 1].map(function (side) {
        return area(combined(boxes[side], entry)) - area(boxes[side]);
      });
      const pick = growth[0] < growth[1] || (growth[0] === growth[1] && area(boxes[0]) <= area(boxes[1])) ? 0 : 1;
      groups[pick].push(entry);
      boxes[pick] = combined(boxes[pick], entry);
    });

    return groups;
  }

  /** R*: pick the axis with the smallest total perimeter over all admissible
   *  cuts, then the cut on that axis with the smallest overlap. */
  function rstarGroups(entries, limits) {
    let best = null;

    ['X', 'Y'].forEach(function (axis) {
      ['min', 'max'].forEach(function (edge) {
        const sorted = entries.slice().sort(function (a, b) { return a[edge + axis] - b[edge + axis]; });
        for (let cut = limits.min; cut <= sorted.length - limits.min; cut += 1) {
          const left = unionOf(sorted.slice(0, cut));
          const right = unionOf(sorted.slice(cut));
          const score = {
            margin: perimeter(left) + perimeter(right),
            overlap: intersectionArea(left, right),
            area: area(left) + area(right)
          };
          if (!best || better(score, best.score)) best = { score: score, groups: [sorted.slice(0, cut), sorted.slice(cut)] };
        }
      });
    });

    return best.groups;
  }

  function better(candidate, current) {
    if (candidate.overlap !== current.overlap) return candidate.overlap < current.overlap;
    if (candidate.area !== current.area) return candidate.area < current.area;
    return candidate.margin < current.margin;
  }

  /* --------------------------------------------------------- reporting */

  function distanceTo(point, box) {
    const c = centre(box);
    return Math.pow(c.x - point.x, 2) + Math.pow(c.y - point.y, 2);
  }

  function measure(node, depth, totals) {
    totals.nodes += 1;
    totals.entries += node.entries.length;
    totals.coverage += area(node);
    if (depth + 1 > totals.height) totals.height = depth + 1;
    if (node.leaf) { totals.leaves += 1; return; }
    for (let i = 0; i < node.entries.length; i += 1) {
      for (let j = i + 1; j < node.entries.length; j += 1) {
        totals.overlap += intersectionArea(node.entries[i], node.entries[j]);
        totals.siblingPairs += 1;
      }
    }
    node.entries.forEach(function (child) { measure(child, depth + 1, totals); });
  }

  /** Height, fill and - the number that decides query cost - the total area in
   *  which siblings overlap, as a fraction of the area the tree covers. */
  function shapeOf(tree, config) {
    const totals = {
      height: 0, nodes: 0, leaves: 0, entries: 0, coverage: 0, overlap: 0, siblingPairs: 0
    };
    measure(tree, 0, totals);
    return Object.assign(totals, {
      items: config.count,
      fill: totals.leaves ? config.count / (totals.leaves * config.maxEntries) : 0,
      overlapRatio: totals.coverage ? totals.overlap / totals.coverage : 0,
      bytes: totals.nodes * 32 + totals.entries * 40,
      split: config.strategy
    });
  }

  /** Every level's rectangles, root first - what the section draws. */
  function levelsOf(tree) {
    const out = [];
    let frontier = [tree];
    while (frontier.length) {
      out.push(frontier.map(function (node) {
        return { minX: node.minX, minY: node.minY, maxX: node.maxX, maxY: node.maxY, leaf: !!node.leaf };
      }));
      const next = [];
      frontier.forEach(function (node) { if (!node.leaf) next.push.apply(next, node.entries); });
      frontier = next;
    }
    return out;
  }

  function verify(node, depth, context) {
    const problems = context.problems;
    const tight = node.entries.length ? unionOf(node.entries) : null;
    if (tight && (tight.minX !== node.minX || tight.maxX !== node.maxX ||
      tight.minY !== node.minY || tight.maxY !== node.maxY)) {
      problems.push('MBR is not tight at depth ' + depth);
    }
    if (context.minFill && depth > 0 && node.entries.length < context.limits.min) {
      problems.push('node at depth ' + depth + ' holds ' + node.entries.length +
        ' of a minimum ' + context.limits.min);
    }
    if (node.entries.length > context.limits.max) problems.push('node at depth ' + depth + ' is over capacity');
    if (node.leaf) return;
    node.entries.forEach(function (child) { verify(child, depth + 1, context); });
  }

  /* `minFill` is opt-out because a sort-tile-recursive build packs pages full
     and leaves the *last* page of a slice short on purpose. Asserting
     Guttman's minimum against an STR tree is checking the wrong structure's
     invariant, so the caller says which one it built. */
  function inspect(tree, limits, options) {
    const settings = options || {};
    const problems = [];
    verify(tree, 0, { problems: problems, limits: limits, minFill: settings.minFill !== false });
    return { ok: !problems.length, problems: problems };
  }

  /* --------------------------------------------------------------- tree */

  function create(options) {
    const settings = options || {};
    const maxEntries = Math.max(4, Math.floor(settings.maxEntries || 9));
    const minEntries = Math.max(2, Math.floor(settings.minEntries || Math.ceil(maxEntries * 0.4)));
    const strategy = STRATEGIES.indexOf(settings.split) === -1 ? 'quadratic' : settings.split;
    const limits = { min: minEntries, max: maxEntries };
    let tree = makeNode(true, []);
    let stats = emptyStats();
    let count = 0;
    let pending = [];
    let reinsertUsed = false;

    function groupsFor(entries) {
      if (strategy === 'rstar') return rstarGroups(entries, limits);
      if (strategy === 'firstfit') {
        const half = Math.ceil(entries.length / 2);
        return [entries.slice(0, half), entries.slice(half)];
      }
      return distribute(entries, SEEDS[strategy](entries), limits);
    }

    function splitNode(node) {
      stats.splits += 1;
      const groups = groupsFor(node.entries);
      node.entries = groups[0];
      refresh(node);
      return makeNode(node.leaf, groups[1]);
    }

    /** Least enlargement, ties broken by smaller area - Guttman's rule, and
     *  the tie-break matters: without it the tree drifts towards one fat node. */
    function chooseSubtree(node, item) {
      let best = null;
      node.entries.forEach(function (child) {
        const growth = area(combined(child, item)) - area(child);
        const score = { growth: growth, area: area(child) };
        if (!best || score.growth < best.score.growth ||
          (score.growth === best.score.growth && score.area < best.score.area)) {
          best = { child: child, score: score };
        }
      });
      return best.child;
    }

    function insertAt(node, item, level) {
      if (node.leaf) node.entries.push(item);
      else {
        const child = chooseSubtree(node, item);
        const split = insertAt(child, item, level + 1);
        if (split) node.entries.push(split);
      }
      refresh(node);
      if (node.entries.length <= maxEntries) return null;
      if (strategy === 'rstar' && node.leaf && !reinsertUsed) {
        reinsertUsed = true;
        return queueReinsert(node);
      }
      return splitNode(node);
    }

    /** R*'s forced reinsertion (see the module header for why it is queued and
     *  why it is restricted to leaves). */
    function queueReinsert(node) {
      const middle = centre(node);
      const sorted = node.entries.slice().sort(function (a, b) {
        return distanceTo(middle, b) - distanceTo(middle, a);
      });
      const moving = sorted.slice(0, Math.max(1, Math.round(node.entries.length * REINSERT_FRACTION)));
      node.entries = sorted.slice(moving.length);
      refresh(node);
      stats.reinsertions += moving.length;
      pending.push.apply(pending, moving.slice().reverse());
      return null;
    }

    function place(item) {
      const split = insertAt(tree, item, 0);
      if (split) tree = makeNode(false, [tree, split]);
    }

    function insert(item) {
      count += 1;
      reinsertUsed = false;
      pending = [];
      place(item);
      while (pending.length) place(pending.shift());
      return item;
    }

    function insertAll(list) {
      list.forEach(insert);
      return count;
    }

    function search(rect) {
      const out = [];
      stats.queries += 1;
      visit(tree, rect, out);
      stats.results += out.length;
      return out;
    }

    function visit(node, rect, out) {
      stats.nodesVisited += 1;
      for (let i = 0; i < node.entries.length; i += 1) {
        const entry = node.entries[i];
        stats.candidatesTested += 1;
        if (!overlaps(entry, rect)) continue;
        if (node.leaf) out.push(entry);
        else visit(entry, rect, out);
      }
    }

    function queryRange(rect) { return search(rect); }

    function queryRadius(centrePoint, radius) {
      const rect = {
        minX: centrePoint.x - radius, minY: centrePoint.y - radius,
        maxX: centrePoint.x + radius, maxY: centrePoint.y + radius
      };
      return search(rect).filter(function (entry) {
        const dx = Math.max(entry.minX - centrePoint.x, 0, centrePoint.x - entry.maxX);
        const dy = Math.max(entry.minY - centrePoint.y, 0, centrePoint.y - entry.maxY);
        return dx * dx + dy * dy <= radius * radius;
      });
    }

    function replaceRoot(node) {
      tree = node;
      return tree;
    }

    function shape() {
      return shapeOf(tree, { count: count, maxEntries: maxEntries, strategy: strategy });
    }

    function levels() { return levelsOf(tree); }

    function checkInvariants(options) { return inspect(tree, limits, options); }

    /* The shared index interface, assembled in its own function so the factory
       body stays under the size limit and readable. */
    function handle() {
      return {
        insert: insert,
        insertAll: insertAll,
        search: search,
        queryRange: queryRange,
        queryRadius: queryRadius,
        levels: levels,
        shape: shape,
        checkInvariants: checkInvariants,
        root: function () { return tree; },
        replaceRoot: replaceRoot,
        setCount: function (n) { count = n; return count; },
        maxEntries: maxEntries,
        minEntries: minEntries,
        split: strategy,
        size: function () { return count; },
        stats: function () { return Object.assign({}, stats); },
        resetStats: function () { stats = emptyStats(); }
      };
    }

    return handle();
  }

  /* ---------------------------------------------------------- STR build */

  function chunk(list, size) {
    const out = [];
    for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
    return out;
  }

  function sortBy(list, key) {
    return list.slice().sort(function (a, b) {
      return (a['min' + key] + a['max' + key]) - (b['min' + key] + b['max' + key]);
    });
  }

  /** One STR level: slice on x, then pack each slice on y. */
  function packLevel(entries, maxEntries) {
    const pages = Math.ceil(entries.length / maxEntries);
    const slices = Math.max(1, Math.ceil(Math.sqrt(pages)));
    const perSlice = Math.ceil(entries.length / slices);
    const out = [];

    chunk(sortBy(entries, 'X'), perSlice).forEach(function (slice) {
      chunk(sortBy(slice, 'Y'), maxEntries).forEach(function (page) { out.push(page); });
    });

    return out;
  }

  /**
   * Sort-tile-recursive bulk load: leaves are packed full, so the tree is one
   * level shorter and the sibling rectangles are near-disjoint tiles rather
   * than whatever the insertion order happened to produce.
   */
  function bulkLoad(items, options) {
    const settings = options || {};
    const tree = create(settings);
    const maxEntries = tree.maxEntries;
    if (!items.length) return tree;

    let nodes = packLevel(items, maxEntries).map(function (page) { return makeNode(true, page); });
    while (nodes.length > 1) {
      nodes = packLevel(nodes, maxEntries).map(function (page) { return makeNode(false, page); });
    }

    tree.replaceRoot(nodes[0]);
    tree.setCount(items.length);
    return tree;
  }

  return {
    create: create,
    bulkLoad: bulkLoad,
    area: area,
    perimeter: perimeter,
    unionOf: unionOf,
    intersectionArea: intersectionArea,
    combined: combined,
    strategies: STRATEGIES.slice()
  };
}));

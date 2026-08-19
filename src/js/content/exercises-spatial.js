/**
 * Graded exercises for the grid, quadtree and k-d tree sections (M08.1-M08.3).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'uniform-grids': [{
      id: 'grid-radius-query',
      title: 'A grid that answers a radius query exactly, and cheaply',
      prompt: 'makeGrid(cellSize) must return { insert, queryRadius, stats }. insert(point) files a ' +
        '{ id, x, y } into the cell it falls in. queryRadius(centre, radius) returns every stored point within ' +
        '`radius` of centre - exactly the set a brute-force scan returns, in any order - by reading only the ' +
        'cells the query box touches. stats() returns { cellsScanned, candidatesTested } accumulated over every ' +
        'query, where a candidate is a point taken out of a bucket and measured. Both numbers are graded: ' +
        'returning everything is correct and is not a spatial index.',
      entry: 'makeGrid',
      starter: [
        'function makeGrid(cellSize) {',
        '  const points = [];',
        '  let cellsScanned = 0;',
        '  let candidatesTested = 0;',
        '',
        '  return {',
        '    insert: function (point) { points.push(point); },',
        '    queryRadius: function (centre, radius) {',
        '      // the honest brute-force answer: correct, and not an index',
        '      const out = [];',
        '      points.forEach(function (point) {',
        '        candidatesTested += 1;',
        '        const dx = point.x - centre.x;',
        '        const dy = point.y - centre.y;',
        '        if (dx * dx + dy * dy <= radius * radius) out.push(point);',
        '      });',
        '      cellsScanned += 1;',
        '      return out;',
        '    },',
        '    stats: function () {',
        '      return { cellsScanned: cellsScanned, candidatesTested: candidatesTested };',
        '    }',
        '  };',
        '}'
      ].join('\n'),
      solution: [
        'function makeGrid(cellSize) {',
        '  const buckets = new Map();',
        '  let cellsScanned = 0;',
        '  let candidatesTested = 0;',
        '',
        '  function keyFor(cx, cy) { return cx + \',\' + cy; }',
        '',
        '  return {',
        '    insert: function (point) {',
        '      const key = keyFor(Math.floor(point.x / cellSize), Math.floor(point.y / cellSize));',
        '      if (!buckets.has(key)) buckets.set(key, []);',
        '      buckets.get(key).push(point);',
        '    },',
        '    queryRadius: function (centre, radius) {',
        '      const out = [];',
        '      const x0 = Math.floor((centre.x - radius) / cellSize);',
        '      const x1 = Math.floor((centre.x + radius) / cellSize);',
        '      const y0 = Math.floor((centre.y - radius) / cellSize);',
        '      const y1 = Math.floor((centre.y + radius) / cellSize);',
        '',
        '      for (let cy = y0; cy <= y1; cy += 1) {',
        '        for (let cx = x0; cx <= x1; cx += 1) {',
        '          cellsScanned += 1;',
        '          const bucket = buckets.get(keyFor(cx, cy));',
        '          if (!bucket) continue;',
        '          for (let i = 0; i < bucket.length; i += 1) {',
        '            candidatesTested += 1;',
        '            const dx = bucket[i].x - centre.x;',
        '            const dy = bucket[i].y - centre.y;',
        '            if (dx * dx + dy * dy <= radius * radius) out.push(bucket[i]);',
        '          }',
        '        }',
        '      }',
        '      return out;',
        '    },',
        '    stats: function () {',
        '      return { cellsScanned: cellsScanned, candidatesTested: candidatesTested };',
        '    }',
        '  };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the answers are exactly the brute-force answers, on 200 queries',
          assert: function (makeGrid, api) {
            const random = api.rng;
            const points = [];
            for (let i = 0; i < 4000; i += 1) {
              points.push({ id: i, x: random.next() * 1000, y: random.next() * 1000 });
            }

            const grid = makeGrid(25);
            points.forEach(function (point) { grid.insert(point); });

            for (let q = 0; q < 200; q += 1) {
              const centre = { x: random.next() * 1000, y: random.next() * 1000 };
              const found = grid.queryRadius(centre, 25).map(function (p) { return p.id; }).sort(function (a, b) { return a - b; });
              const truth = points.filter(function (p) {
                const dx = p.x - centre.x;
                const dy = p.y - centre.y;
                return dx * dx + dy * dy <= 625;
              }).map(function (p) { return p.id; }).sort(function (a, b) { return a - b; });
              api.assert.deepEqual(found, truth, 'query ' + q + ' at (' + centre.x.toFixed(1) + ', ' + centre.y.toFixed(1) + ')');
            }
          }
        },
        {
          name: 'a query reads cells, not the whole point set',
          assert: function (makeGrid, api) {
            const random = api.rng;
            const points = [];
            for (let i = 0; i < 4000; i += 1) {
              points.push({ id: i, x: random.next() * 1000, y: random.next() * 1000 });
            }

            const grid = makeGrid(25);
            points.forEach(function (point) { grid.insert(point); });
            for (let q = 0; q < 100; q += 1) {
              grid.queryRadius({ x: random.next() * 1000, y: random.next() * 1000 }, 25);
            }

            const stats = grid.stats();
            api.assert.atMost(stats.cellsScanned / 100, 12,
              'a radius-25 query over 25-unit cells reads about 9 cells');
            api.assert.atMost(stats.candidatesTested / 100, 60,
              'density 0.004 over a 75x75 scanned region predicts about 22.5 candidates');
            api.assert.atLeast(stats.candidatesTested, 1, 'the query must actually measure some points');
          }
        },
        {
          name: 'a point exactly on the radius is inside, and one just outside is not',
          assert: function (makeGrid, api) {
            const grid = makeGrid(10);
            grid.insert({ id: 'on', x: 30, y: 0 });
            grid.insert({ id: 'out', x: 30.001, y: 0 });
            grid.insert({ id: 'in', x: 0, y: 0 });

            const found = grid.queryRadius({ x: 0, y: 0 }, 30).map(function (p) { return p.id; }).sort();
            api.assert.deepEqual(found, ['in', 'on'], 'the boundary is inclusive and 30.001 is outside');
          }
        },
        {
          name: 'points far outside the first cell are still found',
          assert: function (makeGrid, api) {
            const grid = makeGrid(4);
            grid.insert({ id: 'far', x: -917.5, y: 640.25 });
            grid.insert({ id: 'near', x: -915, y: 641 });

            const found = grid.queryRadius({ x: -916, y: 640.5 }, 3).map(function (p) { return p.id; }).sort();
            api.assert.deepEqual(found, ['far', 'near'], 'negative coordinates must work, not clamp to zero');
          }
        }
      ]
    }],

    quadtrees: [{
      id: 'quadtree-insert-and-query',
      title: 'A quadtree that survives coincident points',
      prompt: 'makeQuadtree(bounds, capacity, maxDepth) must return { insert, queryRange, shape }. insert(point) ' +
        'places an { id, x, y } and subdivides a leaf into four quadrants when it holds more than `capacity` ' +
        'points *and* its depth is below `maxDepth`. queryRange(rect) returns every stored point inside the ' +
        '{ minX, minY, maxX, maxY } rectangle, visiting only nodes whose square overlaps it. shape() returns ' +
        '{ nodes, maxDepth, largestLeaf }. The graded case is 5 000 points on three distinct locations: the ' +
        'split rule has no fixed point there, and the depth cap plus an overflowing bucket is what makes it ' +
        'terminate.',
      entry: 'makeQuadtree',
      starter: [
        'function makeQuadtree(bounds, capacity, maxDepth) {',
        '  const points = [];',
        '',
        '  return {',
        '    insert: function (point) { points.push(point); },',
        '    queryRange: function (rect) {',
        '      return points.filter(function (p) {',
        '        return p.x >= rect.minX && p.x <= rect.maxX && p.y >= rect.minY && p.y <= rect.maxY;',
        '      });',
        '    },',
        '    shape: function () {',
        '      return { nodes: 1, maxDepth: 0, largestLeaf: points.length };',
        '    }',
        '  };',
        '}'
      ].join('\n'),
      solution: [
        'function makeQuadtree(bounds, capacity, maxDepth) {',
        '  function makeNode(box, depth) {',
        '    return { box: box, depth: depth, items: [], children: null };',
        '  }',
        '',
        '  const root = makeNode(bounds, 0);',
        '',
        '  function quadrants(box) {',
        '    const midX = (box.minX + box.maxX) / 2;',
        '    const midY = (box.minY + box.maxY) / 2;',
        '    return [',
        '      { minX: box.minX, minY: box.minY, maxX: midX, maxY: midY },',
        '      { minX: midX, minY: box.minY, maxX: box.maxX, maxY: midY },',
        '      { minX: box.minX, minY: midY, maxX: midX, maxY: box.maxY },',
        '      { minX: midX, minY: midY, maxX: box.maxX, maxY: box.maxY }',
        '    ];',
        '  }',
        '',
        '  function holds(box, point) {',
        '    return point.x >= box.minX && point.x <= box.maxX && point.y >= box.minY && point.y <= box.maxY;',
        '  }',
        '',
        '  function childFor(node, point) {',
        '    for (let i = 0; i < 4; i += 1) {',
        '      if (holds(node.children[i].box, point)) return node.children[i];',
        '    }',
        '    return null;',
        '  }',
        '',
        '  function place(node, point) {',
        '    let target = node;',
        '    while (target.children) {',
        '      const child = childFor(target, point);',
        '      if (!child) break;',
        '      target = child;',
        '    }',
        '    target.items.push(point);',
        '    // the depth cap is what stops coincident points recursing forever,',
        '    // and the bucket is allowed to overflow once the cap is reached',
        '    if (target.items.length > capacity && target.depth < maxDepth) split(target);',
        '  }',
        '',
        '  function split(node) {',
        '    node.children = quadrants(node.box).map(function (box) { return makeNode(box, node.depth + 1); });',
        '    const held = node.items;',
        '    node.items = [];',
        '    held.forEach(function (point) { place(node, point); });',
        '  }',
        '',
        '  function overlaps(box, rect) {',
        '    return box.minX <= rect.maxX && box.maxX >= rect.minX && box.minY <= rect.maxY && box.maxY >= rect.minY;',
        '  }',
        '',
        '  return {',
        '    insert: function (point) { place(root, point); },',
        '    queryRange: function (rect) {',
        '      const out = [];',
        '      const stack = [root];',
        '      while (stack.length) {',
        '        const node = stack.pop();',
        '        if (!overlaps(node.box, rect)) continue;',
        '        node.items.forEach(function (p) {',
        '          if (p.x >= rect.minX && p.x <= rect.maxX && p.y >= rect.minY && p.y <= rect.maxY) out.push(p);',
        '        });',
        '        if (node.children) for (let i = 0; i < 4; i += 1) stack.push(node.children[i]);',
        '      }',
        '      return out;',
        '    },',
        '    shape: function () {',
        '      const totals = { nodes: 0, maxDepth: 0, largestLeaf: 0 };',
        '      const stack = [root];',
        '      while (stack.length) {',
        '        const node = stack.pop();',
        '        totals.nodes += 1;',
        '        if (node.depth > totals.maxDepth) totals.maxDepth = node.depth;',
        '        if (node.children) { for (let i = 0; i < 4; i += 1) stack.push(node.children[i]); continue; }',
        '        if (node.items.length > totals.largestLeaf) totals.largestLeaf = node.items.length;',
        '      }',
        '      return totals;',
        '    }',
        '  };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'range queries agree with a brute-force filter over 150 windows',
          assert: function (makeQuadtree, api) {
            const random = api.rng;
            const bounds = { minX: 0, minY: 0, maxX: 1000, maxY: 1000 };
            const points = [];
            for (let i = 0; i < 3000; i += 1) {
              points.push({ id: i, x: random.next() * 1000, y: random.next() * 1000 });
            }

            const tree = makeQuadtree(bounds, 8, 12);
            points.forEach(function (point) { tree.insert(point); });

            for (let q = 0; q < 150; q += 1) {
              const cx = random.next() * 1000;
              const cy = random.next() * 1000;
              const rect = { minX: cx - 40, minY: cy - 40, maxX: cx + 40, maxY: cy + 40 };
              const found = tree.queryRange(rect).map(function (p) { return p.id; }).sort(function (a, b) { return a - b; });
              const truth = points.filter(function (p) {
                return p.x >= rect.minX && p.x <= rect.maxX && p.y >= rect.minY && p.y <= rect.maxY;
              }).map(function (p) { return p.id; }).sort(function (a, b) { return a - b; });
              api.assert.deepEqual(found, truth, 'window ' + q);
            }
          }
        },
        {
          name: 'the tree really subdivides rather than keeping one bucket',
          assert: function (makeQuadtree, api) {
            const random = api.rng;
            const points = [];
            for (let i = 0; i < 3000; i += 1) {
              points.push({ id: i, x: random.next() * 1000, y: random.next() * 1000 });
            }

            const tree = makeQuadtree({ minX: 0, minY: 0, maxX: 1000, maxY: 1000 }, 8, 12);
            points.forEach(function (point) { tree.insert(point); });

            const shape = tree.shape();
            api.assert.atLeast(shape.nodes, 400, '3 000 points at capacity 8 need hundreds of nodes');
            api.assert.atMost(shape.largestLeaf, 8, 'no leaf below the depth cap may exceed the capacity');
            api.assert.atLeast(shape.maxDepth, 3, 'the tree must actually be a tree');
          }
        },
        {
          name: '5 000 coincident points terminate, and the cap is respected',
          assert: function (makeQuadtree, api) {
            const sites = [{ x: 137.5, y: 862.25 }, { x: 500, y: 500 }, { x: 901.125, y: 12.0625 }];
            const tree = makeQuadtree({ minX: 0, minY: 0, maxX: 1000, maxY: 1000 }, 4, 10);
            for (let i = 0; i < 5000; i += 1) {
              const site = sites[i % 3];
              tree.insert({ id: i, x: site.x, y: site.y });
            }

            const shape = tree.shape();
            api.assert.atMost(shape.maxDepth, 10, 'the depth cap must bind');
            api.assert.atLeast(shape.largestLeaf, 1000,
              'a leaf at the cap has to be allowed to overflow, or the insert cannot complete');

            const found = tree.queryRange({ minX: 400, minY: 400, maxX: 600, maxY: 600 });
            api.assert.equal(found.length, 1667, 'every point on the middle site must still be findable');
          }
        },
        {
          name: 'a point on a quadrant boundary is stored once and found once',
          assert: function (makeQuadtree, api) {
            const tree = makeQuadtree({ minX: 0, minY: 0, maxX: 100, maxY: 100 }, 1, 6);
            tree.insert({ id: 'a', x: 50, y: 50 });
            tree.insert({ id: 'b', x: 10, y: 10 });
            tree.insert({ id: 'c', x: 90, y: 90 });

            const all = tree.queryRange({ minX: 0, minY: 0, maxX: 100, maxY: 100 });
            api.assert.equal(all.length, 3, 'the midpoint must not be duplicated or dropped');

            const middle = tree.queryRange({ minX: 45, minY: 45, maxX: 55, maxY: 55 })
              .map(function (p) { return p.id; });
            api.assert.deepEqual(middle, ['a']);
          }
        }
      ]
    }],

    'kd-trees': [{
      id: 'kd-nearest-with-backtrack',
      title: 'Nearest neighbour, and the backtrack that makes it right',
      prompt: 'makeKdTree(points) must return { nearest, stats }. Build a 2-D k-d tree over the ' +
        '{ id, x, y } points, splitting on x at even depths and y at odd ones, at the median of the points in ' +
        'that node. nearest({x, y}) returns { point, distance } for the closest stored point - the *actual* ' +
        'closest, which means descending to the leaf the query falls in and then re-examining the far side of ' +
        'every split whose plane is nearer than the best distance found so far. stats() returns ' +
        '{ distanceComputations } accumulated over every query. The descent alone is graded as a failure: it is ' +
        'fast, it always returns a plausible point, and it is wrong on about three fifths of queries.',
      entry: 'makeKdTree',
      starter: [
        'function makeKdTree(points) {',
        '  let distanceComputations = 0;',
        '',
        '  // the descent, with no backtrack: fast, plausible, and wrong',
        '  function build(list, depth) {',
        '    if (list.length <= 4) return { leaf: true, points: list };',
        '    const axis = depth % 2 === 0 ? \'x\' : \'y\';',
        '    const sorted = list.slice().sort(function (a, b) { return a[axis] - b[axis]; });',
        '    const mid = sorted.length >> 1;',
        '    return {',
        '      leaf: false, axis: axis, value: sorted[mid][axis],',
        '      left: build(sorted.slice(0, mid), depth + 1),',
        '      right: build(sorted.slice(mid), depth + 1)',
        '    };',
        '  }',
        '',
        '  const root = points.length ? build(points, 0) : null;',
        '',
        '  return {',
        '    nearest: function (query) {',
        '      let node = root;',
        '      while (node && !node.leaf) node = query[node.axis] < node.value ? node.left : node.right;',
        '      let best = null;',
        '      if (node) node.points.forEach(function (p) {',
        '        distanceComputations += 1;',
        '        const dx = p.x - query.x;',
        '        const dy = p.y - query.y;',
        '        const d = Math.sqrt(dx * dx + dy * dy);',
        '        if (!best || d < best.distance) best = { point: p, distance: d };',
        '      });',
        '      return best;',
        '    },',
        '    stats: function () { return { distanceComputations: distanceComputations }; }',
        '  };',
        '}'
      ].join('\n'),
      solution: [
        'function makeKdTree(points) {',
        '  let distanceComputations = 0;',
        '',
        '  function build(list, depth) {',
        '    if (list.length <= 4) return { leaf: true, points: list };',
        '    const axis = depth % 2 === 0 ? \'x\' : \'y\';',
        '    const sorted = list.slice().sort(function (a, b) { return a[axis] - b[axis]; });',
        '    const mid = sorted.length >> 1;',
        '    return {',
        '      leaf: false, axis: axis, value: sorted[mid][axis],',
        '      left: build(sorted.slice(0, mid), depth + 1),',
        '      right: build(sorted.slice(mid), depth + 1)',
        '    };',
        '  }',
        '',
        '  const root = points.length ? build(points, 0) : null;',
        '',
        '  function descend(node, query, best) {',
        '    if (node.leaf) {',
        '      node.points.forEach(function (p) {',
        '        distanceComputations += 1;',
        '        const dx = p.x - query.x;',
        '        const dy = p.y - query.y;',
        '        const d = Math.sqrt(dx * dx + dy * dy);',
        '        if (!best.found || d < best.found.distance) best.found = { point: p, distance: d };',
        '      });',
        '      return;',
        '    }',
        '',
        '    const goLeft = query[node.axis] < node.value;',
        '    descend(goLeft ? node.left : node.right, query, best);',
        '',
        '    // the backtrack: the nearest point is often on the other side of a',
        '    // plane the query sits close to, so the far side is re-examined',
        '    // whenever the plane is nearer than the best distance so far',
        '    const plane = Math.abs(query[node.axis] - node.value);',
        '    if (!best.found || plane < best.found.distance) {',
        '      descend(goLeft ? node.right : node.left, query, best);',
        '    }',
        '  }',
        '',
        '  return {',
        '    nearest: function (query) {',
        '      if (!root) return null;',
        '      const best = { found: null };',
        '      descend(root, query, best);',
        '      return best.found;',
        '    },',
        '    stats: function () { return { distanceComputations: distanceComputations }; }',
        '  };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'every one of 400 answers matches brute force exactly',
          assert: function (makeKdTree, api) {
            const random = api.rng;
            const points = [];
            for (let i = 0; i < 3000; i += 1) {
              points.push({ id: i, x: random.next() * 1000, y: random.next() * 1000 });
            }

            const tree = makeKdTree(points);
            let wrong = 0;
            for (let q = 0; q < 400; q += 1) {
              const query = { x: random.next() * 1000, y: random.next() * 1000 };
              const found = tree.nearest(query);
              let truth = null;
              for (let i = 0; i < points.length; i += 1) {
                const dx = points[i].x - query.x;
                const dy = points[i].y - query.y;
                const d = Math.sqrt(dx * dx + dy * dy);
                if (!truth || d < truth.distance) truth = { point: points[i], distance: d };
              }
              if (!found || Math.abs(found.distance - truth.distance) > 1e-9) wrong += 1;
            }
            api.assert.equal(wrong, 0, wrong + ' of 400 nearest answers were wrong');
          }
        },
        {
          name: 'the query near a splitting plane is the one that catches a missing backtrack',
          assert: function (makeKdTree, api) {
            const points = [];
            for (let i = 0; i < 40; i += 1) points.push({ id: 'L' + i, x: 10 + i * 0.5, y: 500 });
            for (let i = 0; i < 40; i += 1) points.push({ id: 'R' + i, x: 600 + i * 0.5, y: 500 });
            points.push({ id: 'answer', x: 400.5, y: 500 });
            points.push({ id: 'decoy', x: 399, y: 560 });

            const tree = makeKdTree(points);
            const found = tree.nearest({ x: 400, y: 500 });
            api.assert.equal(found.point.id, 'answer', 'the nearest point sits just past the median split');
          }
        },
        {
          name: 'the tree prunes: it is far cheaper than a scan',
          assert: function (makeKdTree, api) {
            const random = api.rng;
            const points = [];
            for (let i = 0; i < 3000; i += 1) {
              points.push({ id: i, x: random.next() * 1000, y: random.next() * 1000 });
            }

            const tree = makeKdTree(points);
            for (let q = 0; q < 200; q += 1) {
              tree.nearest({ x: random.next() * 1000, y: random.next() * 1000 });
            }

            const perQuery = tree.stats().distanceComputations / 200;
            api.assert.atMost(perQuery, 300, 'a correct backtrack still touches a small fraction of 3 000 points');
            api.assert.atLeast(perQuery, 5, 'and it must touch more than one leaf, or it is not backtracking');
          }
        },
        {
          name: 'coincident and collinear points do not break the build',
          assert: function (makeKdTree, api) {
            const collinear = [];
            for (let i = 0; i < 200; i += 1) collinear.push({ id: i, x: i, y: i });
            const flat = makeKdTree(collinear);
            api.assert.equal(flat.nearest({ x: 100.4, y: 100.4 }).point.id, 100);

            const same = [];
            for (let i = 0; i < 200; i += 1) same.push({ id: i, x: 7, y: 7 });
            const stacked = makeKdTree(same);
            api.assert.closeTo(stacked.nearest({ x: 10, y: 11 }).distance, 5, 1e-9);
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));

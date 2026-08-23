/**
 * Graded exercises for sweeps, triangulation and Voronoi diagrams (M16.4-M16.6).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'sweep-line-algorithms': [{
      id: 'rectangle-union-sweep',
      title: 'Coordinate compression, and the overlap you must not count twice',
      prompt: 'unionArea(rects) must return { area, slabs }: the area covered by at least one of ' +
        'the axis-aligned rectangles `{ x1, y1, x2, y2 }`. Collect every distinct y coordinate, ' +
        'sort them, and treat consecutive pairs as SLABS — inside a slab nothing changes, so the ' +
        'covered height is constant there. Turn each rectangle into two x-events, +1 at `x1` and −1 ' +
        'at `x2`, sort them by x, and walk them once: before applying an event, add the currently ' +
        'covered height times the distance from the previous event position. A slab counts as ' +
        'covered when its cover count is greater than zero, however many rectangles overlap it. ' +
        '`slabs` is the number of consecutive y-pairs. Rectangles with zero width or height ' +
        'contribute nothing. The starter sums each rectangle\'s own area, so every overlap is ' +
        'counted once per rectangle covering it.',
      entry: 'unionArea',
      starter: [
        'function unionArea(rects) {',
        '  const ys = [];',
        '',
        '  rects.forEach(function (r) { ys.push(r.y1); ys.push(r.y2); });',
        '  const grid = Array.from(new Set(ys)).sort(function (a, b) { return a - b; });',
        '  let area = 0;',
        '',
        '  // every rectangle in full, so the overlaps are counted twice',
        '  rects.forEach(function (r) {',
        '    area += Math.max(0, r.x2 - r.x1) * Math.max(0, r.y2 - r.y1);',
        '  });',
        '  return { area: area, slabs: Math.max(0, grid.length - 1) };',
        '}'
      ].join('\n'),
      solution: [
        'function unionArea(rects) {',
        '  const ys = [];',
        '',
        '  rects.forEach(function (r) { ys.push(r.y1); ys.push(r.y2); });',
        '  const grid = Array.from(new Set(ys)).sort(function (a, b) { return a - b; });',
        '  const slabs = Math.max(0, grid.length - 1);',
        '  const events = [];',
        '',
        '  rects.forEach(function (r) {',
        '    if (r.x2 <= r.x1 || r.y2 <= r.y1) return;',
        '    events.push({ x: r.x1, delta: 1, rect: r });',
        '    events.push({ x: r.x2, delta: -1, rect: r });',
        '  });',
        '  events.sort(function (a, b) { return a.x - b.x; });',
        '  const cover = new Array(slabs).fill(0);',
        '  let area = 0;',
        '  let at = 0;',
        '',
        '  events.forEach(function (event) {',
        '    let covered = 0;',
        '',
        '    for (let i = 0; i < slabs; i += 1) {',
        '      if (cover[i] > 0) covered += grid[i + 1] - grid[i];',
        '    }',
        '    area += covered * (event.x - at);',
        '    at = event.x;',
        '',
        '    for (let i = 0; i < slabs; i += 1) {',
        '      if (grid[i] >= event.rect.y1 && grid[i + 1] <= event.rect.y2) {',
        '        cover[i] += event.delta;',
        '      }',
        '    }',
        '  });',
        '  return { area: area, slabs: slabs };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the area matches inclusion-exclusion on 200 small random sets',
          assert: function (unionArea, api) {
            function inclusionExclusion(rects) {
              let total = 0;
              const n = rects.length;

              for (let mask = 1; mask < (1 << n); mask += 1) {
                let x1 = -Infinity, y1 = -Infinity, x2 = Infinity, y2 = Infinity, bits = 0;

                for (let i = 0; i < n; i += 1) {
                  if (!(mask & (1 << i))) continue;
                  bits += 1;
                  x1 = Math.max(x1, rects[i].x1);
                  y1 = Math.max(y1, rects[i].y1);
                  x2 = Math.min(x2, rects[i].x2);
                  y2 = Math.min(y2, rects[i].y2);
                }
                total += (bits % 2 === 1 ? 1 : -1) *
                  Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
              }
              return total;
            }

            for (let trial = 0; trial < 200; trial += 1) {
              const count = 2 + api.rng.int(6);
              const rects = [];

              for (let i = 0; i < count; i += 1) {
                const x1 = api.rng.int(40);
                const y1 = api.rng.int(40);
                rects.push({ x1: x1, y1: y1,
                  x2: x1 + 1 + api.rng.int(30), y2: y1 + 1 + api.rng.int(30) });
              }
              api.assert.closeTo(unionArea(rects).area, inclusionExclusion(rects), 1e-9,
                'trial ' + trial + ' with ' + count + ' rectangles');
            }
          }
        },
        {
          name: 'overlaps, shared edges and empty rectangles',
          assert: function (unionArea, api) {
            api.assert.closeTo(unionArea([{ x1: 0, y1: 0, x2: 10, y2: 10 },
              { x1: 0, y1: 0, x2: 10, y2: 10 }]).area, 100, 1e-9,
            'two identical rectangles cover one rectangle');
            api.assert.closeTo(unionArea([{ x1: 0, y1: 0, x2: 10, y2: 10 },
              { x1: 10, y1: 0, x2: 20, y2: 10 }]).area, 200, 1e-9,
            'rectangles touching along an edge overlap in nothing');
            api.assert.closeTo(unionArea([{ x1: 0, y1: 0, x2: 10, y2: 10 },
              { x1: 3, y1: 3, x2: 3, y2: 9 }]).area, 100, 1e-9,
            'a zero-width rectangle contributes no area');
            api.assert.closeTo(unionArea([{ x1: 0, y1: 0, x2: 10, y2: 10 },
              { x1: 5, y1: 5, x2: 15, y2: 15 }]).area, 175, 1e-9,
            'a corner overlap of 25 is subtracted once');
            api.assert.closeTo(unionArea([]).area, 0, 1e-9, 'nothing covers nothing');
          }
        },
        {
          name: 'the y-axis is compressed to the coordinates that actually appear',
          assert: function (unionArea, api) {
            const rects = [{ x1: 0, y1: 0, x2: 10, y2: 40 }, { x1: 5, y1: 10, x2: 20, y2: 30 },
              { x1: 8, y1: 20, x2: 12, y2: 50 }];
            const got = unionArea(rects);

            api.assert.equal(got.slabs, 5,
              'six distinct y values — 0, 10, 20, 30, 40, 50 — give five slabs');
            api.assert.atMost(got.slabs, 2 * rects.length - 1,
              'n rectangles can never produce more than 2n − 1 slabs');
          }
        },
        {
          name: 'a hundred overlapping rectangles agree with a fine rasterisation',
          assert: function (unionArea, api) {
            const rects = [];

            for (let i = 0; i < 100; i += 1) {
              const x1 = api.rng.int(80);
              const y1 = api.rng.int(80);
              rects.push({ x1: x1, y1: y1, x2: x1 + 1 + api.rng.int(20),
                y2: y1 + 1 + api.rng.int(20) });
            }
            let covered = 0;

            for (let x = 0; x < 100; x += 1) {
              for (let y = 0; y < 100; y += 1) {
                const cx = x + 0.5;
                const cy = y + 0.5;
                const hit = rects.some(function (r) {
                  return cx >= r.x1 && cx <= r.x2 && cy >= r.y1 && cy <= r.y2;
                });
                if (hit) covered += 1;
              }
            }
            const got = unionArea(rects).area;

            api.assert.atMost(Math.abs(got - covered), 250,
              'the sweep area must match the rasterised area to within its cell resolution');
          }
        }
      ]
    }],

    'polygon-triangulation': [{
      id: 'delaunay-flip-loop',
      title: 'The flip that fixes one quadrilateral and breaks its neighbours',
      prompt: 'flipToDelaunay(points, triangles) must return { triangles, flips }. `triangles` is ' +
        'an array of index triples into `points`; normalise each to counter-clockwise first. Build ' +
        'a map from each undirected edge to the triangles that share it. An edge shared by exactly ' +
        'two triangles is ILLEGAL when the opposite vertex of one lies inside the circumcircle of ' +
        'the other — take the triangle as (i, j, opp) in its counter-clockwise order and test the ' +
        'other triangle\'s opposite vertex with the in-circle determinant. Flip an illegal edge by ' +
        'replacing both triangles with the two that share the OTHER diagonal, but only when the ' +
        'quadrilateral is convex: the two shared endpoints must lie on opposite sides of the line ' +
        'through the two opposite vertices. A flip changes the adjacency, so rebuild the map and ' +
        'start again; stop when a full pass finds nothing to flip. The starter builds the map once ' +
        'and flips everything it finds in a single pass, so later flips are applied against ' +
        'adjacency that earlier ones already invalidated.',
      entry: 'flipToDelaunay',
      starter: [
        'function flipToDelaunay(points, triangles) {',
        '  function orient(a, b, c) {',
        '    return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);',
        '  }',
        '  function inCircle(a, b, c, d) {',
        '    const ax = a.x - d.x, ay = a.y - d.y;',
        '    const bx = b.x - d.x, by = b.y - d.y;',
        '    const cx = c.x - d.x, cy = c.y - d.y;',
        '    return (ax * ax + ay * ay) * (bx * cy - by * cx) -',
        '      (bx * bx + by * by) * (ax * cy - ay * cx) +',
        '      (cx * cx + cy * cy) * (ax * by - ay * bx);',
        '  }',
        '  function ccw(t) {',
        '    return orient(points[t[0]], points[t[1]], points[t[2]]) < 0',
        '      ? [t[0], t[2], t[1]] : t.slice();',
        '  }',
        '  const tris = triangles.map(ccw);',
        '  const edges = {};',
        '  let flips = 0;',
        '',
        '  tris.forEach(function (t, index) {',
        '    for (let k = 0; k < 3; k += 1) {',
        '      const i = t[k], j = t[(k + 1) % 3], opp = t[(k + 2) % 3];',
        '      const key = Math.min(i, j) + ":" + Math.max(i, j);',
        '      (edges[key] = edges[key] || []).push({ index: index, i: i, j: j, opp: opp });',
        '    }',
        '  });',
        '',
        '  // one pass over a map that every flip makes a little more wrong',
        '  Object.keys(edges).forEach(function (key) {',
        '    const share = edges[key];',
        '    if (share.length !== 2) return;',
        '    const one = share[0], two = share[1];',
        '    if (inCircle(points[one.i], points[one.j], points[one.opp], points[two.opp]) <= 0) return;',
        '    const p = points[one.opp], q = points[two.opp];',
        '    if ((orient(p, q, points[one.i]) > 0) === (orient(p, q, points[one.j]) > 0)) return;',
        '    tris[one.index] = ccw([one.opp, two.opp, one.i]);',
        '    tris[two.index] = ccw([one.opp, two.opp, one.j]);',
        '    flips += 1;',
        '  });',
        '  return { triangles: tris, flips: flips };',
        '}'
      ].join('\n'),
      solution: [
        'function flipToDelaunay(points, triangles) {',
        '  function orient(a, b, c) {',
        '    return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);',
        '  }',
        '  function inCircle(a, b, c, d) {',
        '    const ax = a.x - d.x, ay = a.y - d.y;',
        '    const bx = b.x - d.x, by = b.y - d.y;',
        '    const cx = c.x - d.x, cy = c.y - d.y;',
        '    return (ax * ax + ay * ay) * (bx * cy - by * cx) -',
        '      (bx * bx + by * by) * (ax * cy - ay * cx) +',
        '      (cx * cx + cy * cy) * (ax * by - ay * bx);',
        '  }',
        '  function ccw(t) {',
        '    return orient(points[t[0]], points[t[1]], points[t[2]]) < 0',
        '      ? [t[0], t[2], t[1]] : t.slice();',
        '  }',
        '  function adjacency(tris) {',
        '    const edges = {};',
        '',
        '    tris.forEach(function (t, index) {',
        '      for (let k = 0; k < 3; k += 1) {',
        '        const i = t[k], j = t[(k + 1) % 3], opp = t[(k + 2) % 3];',
        '        const key = Math.min(i, j) + ":" + Math.max(i, j);',
        '        (edges[key] = edges[key] || []).push({ index: index, i: i, j: j, opp: opp });',
        '      }',
        '    });',
        '    return edges;',
        '  }',
        '  const tris = triangles.map(ccw);',
        '  let flips = 0;',
        '  let changed = true;',
        '',
        '  while (changed) {',
        '    changed = false;',
        '    const edges = adjacency(tris);',
        '    const keys = Object.keys(edges);',
        '',
        '    for (let n = 0; n < keys.length; n += 1) {',
        '      const share = edges[keys[n]];',
        '      if (share.length !== 2) continue;',
        '      const one = share[0];',
        '      const two = share[1];',
        '      if (inCircle(points[one.i], points[one.j], points[one.opp], points[two.opp]) <= 0) {',
        '        continue;',
        '      }',
        '      const p = points[one.opp];',
        '      const q = points[two.opp];',
        '',
        '      // a flip is only legal when the quadrilateral is convex',
        '      if ((orient(p, q, points[one.i]) > 0) === (orient(p, q, points[one.j]) > 0)) continue;',
        '      tris[one.index] = ccw([one.opp, two.opp, one.i]);',
        '      tris[two.index] = ccw([one.opp, two.opp, one.j]);',
        '      flips += 1;',
        '      changed = true;',
        '',
        '      // the adjacency this flip invalidated has to be rebuilt',
        '      break;',
        '    }',
        '  }',
        '  return { triangles: tris, flips: flips };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'no vertex lies inside any circumcircle, over 20 fans of 8 to 15 points',
          assert: function (flipToDelaunay, api) {
            function inCircle(a, b, c, d) {
              const ax = a.x - d.x, ay = a.y - d.y;
              const bx = b.x - d.x, by = b.y - d.y;
              const cx = c.x - d.x, cy = c.y - d.y;
              return (ax * ax + ay * ay) * (bx * cy - by * cx) -
                (bx * bx + by * by) * (ax * cy - ay * cx) +
                (cx * cx + cy * cy) * (ax * by - ay * bx);
            }
            function orient(a, b, c) {
              return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
            }

            for (let trial = 0; trial < 20; trial += 1) {
              const n = 8 + api.rng.int(8);
              const points = [];

              for (let i = 0; i < n; i += 1) {
                const angle = 2 * Math.PI * i / n;
                points.push({ x: 100 * Math.cos(angle) + api.rng.next() * 4,
                  y: 70 * Math.sin(angle) + api.rng.next() * 4 });
              }
              const start = [];

              for (let i = 1; i < n - 1; i += 1) start.push([0, i, i + 1]);
              const got = flipToDelaunay(points, start);

              api.assert.equal(got.triangles.length, n - 2,
                'trial ' + trial + ': a flip never changes the triangle count');
              got.triangles.forEach(function (t) {
                api.assert.atLeast(orient(points[t[0]], points[t[1]], points[t[2]]), 0,
                  'trial ' + trial + ': every triangle must come back counter-clockwise');
                points.forEach(function (d, index) {
                  if (t.indexOf(index) >= 0) return;
                  api.assert.atMost(inCircle(points[t[0]], points[t[1]], points[t[2]], d), 1e-6,
                    'trial ' + trial + ': vertex ' + index + ' is inside a circumcircle');
                });
              });
            }
          }
        },
        {
          name: 'the mesh is preserved: same area, same vertices, nothing dropped',
          assert: function (flipToDelaunay, api) {
            function orient(a, b, c) {
              return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
            }
            function totalArea(points, tris) {
              let sum = 0;

              tris.forEach(function (t) {
                sum += Math.abs(orient(points[t[0]], points[t[1]], points[t[2]])) / 2;
              });
              return sum;
            }

            for (let trial = 0; trial < 10; trial += 1) {
              const n = 9 + api.rng.int(6);
              const points = [];

              for (let i = 0; i < n; i += 1) {
                const angle = 2 * Math.PI * i / n;
                points.push({ x: 90 * Math.cos(angle) + api.rng.next() * 3,
                  y: 60 * Math.sin(angle) + api.rng.next() * 3 });
              }
              const start = [];

              for (let i = 1; i < n - 1; i += 1) start.push([0, i, i + 1]);
              const before = totalArea(points, start);
              const got = flipToDelaunay(points, start);

              api.assert.closeTo(totalArea(points, got.triangles), before, 1e-6,
                'trial ' + trial + ': the covered region cannot change');
              const used = {};

              got.triangles.forEach(function (t) {
                t.forEach(function (index) { used[index] = true; });
              });
              api.assert.equal(Object.keys(used).length, n,
                'trial ' + trial + ': every vertex is still in the mesh');
            }
          }
        },
        {
          name: 'running it again finds nothing to flip',
          assert: function (flipToDelaunay, api) {
            const n = 12;
            const points = [];

            for (let i = 0; i < n; i += 1) {
              const angle = 2 * Math.PI * i / n;
              points.push({ x: 100 * Math.cos(angle) + api.rng.next() * 4,
                y: 70 * Math.sin(angle) + api.rng.next() * 4 });
            }
            const start = [];

            for (let i = 1; i < n - 1; i += 1) start.push([0, i, i + 1]);
            const first = flipToDelaunay(points, start);
            const second = flipToDelaunay(points, first.triangles);

            api.assert.atLeast(first.flips, 1, 'a fan of 12 points is very far from Delaunay');
            api.assert.equal(second.flips, 0, 'a Delaunay mesh has no illegal edge left');
          }
        }
      ]
    }],

    'voronoi-diagrams': [{
      id: 'voronoi-half-planes',
      title: 'The definition, used as an algorithm',
      prompt: 'voronoiCell(site, sites, box) must return the cell of `site` as an array of ' +
        '{ x, y } in order: start from the rectangle `{ minX, minY, maxX, maxY }` and clip it once ' +
        'per OTHER site by the half-plane of points at least as close to `site` as to that other ' +
        'one. The bisector passes through the midpoint of the two sites with the vector between ' +
        'them as its normal, so a point is kept when `(p − midpoint) · (other − site)` is not ' +
        'positive. Clip with the standard polygon-against-a-line walk: emit a vertex when it is on ' +
        'the kept side, and emit the crossing point whenever an edge changes side. Skip any site ' +
        'at the same coordinates as `site`. Every other site has to be clipped against, however far ' +
        'away it is — the starter keeps only the three nearest, which is a plausible optimisation ' +
        'and returns cells that overlap and cover the box three times over.',
      entry: 'voronoiCell',
      starter: [
        'function voronoiCell(site, sites, box) {',
        '  function clip(poly, other) {',
        '    const mx = (site.x + other.x) / 2;',
        '    const my = (site.y + other.y) / 2;',
        '    const nx = other.x - site.x;',
        '    const ny = other.y - site.y;',
        '    const value = function (p) { return (p.x - mx) * nx + (p.y - my) * ny; };',
        '    const out = [];',
        '',
        '    for (let i = 0; i < poly.length; i += 1) {',
        '      const a = poly[i];',
        '      const b = poly[(i + 1) % poly.length];',
        '      const va = value(a);',
        '      const vb = value(b);',
        '      if (va <= 0) out.push(a);',
        '      if ((va < 0 && vb > 0) || (va > 0 && vb < 0)) {',
        '        const t = va / (va - vb);',
        '        out.push({ x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });',
        '      }',
        '    }',
        '    return out;',
        '  }',
        '  let poly = [{ x: box.minX, y: box.minY }, { x: box.maxX, y: box.minY },',
        '    { x: box.maxX, y: box.maxY }, { x: box.minX, y: box.maxY }];',
        '',
        '  // the three nearest sites decide the cell, surely',
        '  const near = sites.slice().sort(function (a, b) {',
        '    return (a.x - site.x) * (a.x - site.x) + (a.y - site.y) * (a.y - site.y) -',
        '      ((b.x - site.x) * (b.x - site.x) + (b.y - site.y) * (b.y - site.y));',
        '  }).slice(0, 4);',
        '',
        '  near.forEach(function (other) {',
        '    if (other.x === site.x && other.y === site.y) return;',
        '    if (poly.length) poly = clip(poly, other);',
        '  });',
        '  return poly;',
        '}'
      ].join('\n'),
      solution: [
        'function voronoiCell(site, sites, box) {',
        '  function clip(poly, other) {',
        '    const mx = (site.x + other.x) / 2;',
        '    const my = (site.y + other.y) / 2;',
        '    const nx = other.x - site.x;',
        '    const ny = other.y - site.y;',
        '    const value = function (p) { return (p.x - mx) * nx + (p.y - my) * ny; };',
        '    const out = [];',
        '',
        '    for (let i = 0; i < poly.length; i += 1) {',
        '      const a = poly[i];',
        '      const b = poly[(i + 1) % poly.length];',
        '      const va = value(a);',
        '      const vb = value(b);',
        '      if (va <= 0) out.push(a);',
        '      if ((va < 0 && vb > 0) || (va > 0 && vb < 0)) {',
        '        const t = va / (va - vb);',
        '        out.push({ x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });',
        '      }',
        '    }',
        '    return out;',
        '  }',
        '  let poly = [{ x: box.minX, y: box.minY }, { x: box.maxX, y: box.minY },',
        '    { x: box.maxX, y: box.maxY }, { x: box.minX, y: box.maxY }];',
        '',
        '  sites.forEach(function (other) {',
        '    if (other.x === site.x && other.y === site.y) return;',
        '    if (poly.length) poly = clip(poly, other);',
        '  });',
        '  return poly;',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'every site is inside its own cell, and every cell has area',
          assert: function (voronoiCell, api) {
            function area(poly) {
              let sum = 0;

              for (let i = 0; i < poly.length; i += 1) {
                const p = poly[i];
                const q = poly[(i + 1) % poly.length];
                sum += p.x * q.y - q.x * p.y;
              }
              return Math.abs(sum) / 2;
            }
            function inside(poly, p) {
              let crossings = 0;

              for (let i = 0; i < poly.length; i += 1) {
                const a = poly[i];
                const b = poly[(i + 1) % poly.length];
                if ((a.y > p.y) === (b.y > p.y)) continue;
                const x = a.x + (p.y - a.y) / (b.y - a.y) * (b.x - a.x);
                if (x > p.x) crossings += 1;
              }
              return crossings % 2 === 1;
            }
            const box = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
            const sites = [];

            for (let i = 0; i < 14; i += 1) {
              sites.push({ x: 5 + api.rng.next() * 90, y: 5 + api.rng.next() * 90 });
            }
            sites.forEach(function (site, index) {
              const cell = voronoiCell(site, sites, box);

              api.assert.atLeast(cell.length, 3, 'cell ' + index + ' is not a polygon');
              api.assert.atLeast(area(cell), 1e-6, 'cell ' + index + ' has no area');
              api.assert.ok(inside(cell, site), 'site ' + index + ' is outside its own cell');
            });
          }
        },
        {
          name: 'the cells partition the box: the areas sum to the box area',
          assert: function (voronoiCell, api) {
            function area(poly) {
              let sum = 0;

              for (let i = 0; i < poly.length; i += 1) {
                const p = poly[i];
                const q = poly[(i + 1) % poly.length];
                sum += p.x * q.y - q.x * p.y;
              }
              return Math.abs(sum) / 2;
            }
            const box = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
            const sites = [];

            for (let i = 0; i < 14; i += 1) {
              sites.push({ x: 5 + api.rng.next() * 90, y: 5 + api.rng.next() * 90 });
            }
            let total = 0;

            sites.forEach(function (site) { total += area(voronoiCell(site, sites, box)); });
            api.assert.closeTo(total, 10000, 1e-4,
              'a cell that is too large means a site was never clipped against');
          }
        },
        {
          name: '900 sample points land in exactly one cell, and it is their nearest site',
          assert: function (voronoiCell, api) {
            function inside(poly, p) {
              let crossings = 0;

              for (let i = 0; i < poly.length; i += 1) {
                const a = poly[i];
                const b = poly[(i + 1) % poly.length];
                if ((a.y > p.y) === (b.y > p.y)) continue;
                const x = a.x + (p.y - a.y) / (b.y - a.y) * (b.x - a.x);
                if (x > p.x) crossings += 1;
              }
              return crossings % 2 === 1;
            }
            const box = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
            const sites = [];

            for (let i = 0; i < 14; i += 1) {
              sites.push({ x: 5 + api.rng.next() * 90, y: 5 + api.rng.next() * 90 });
            }
            const cells = sites.map(function (site) { return voronoiCell(site, sites, box); });
            let samples = 0;

            for (let gx = 0; gx < 30; gx += 1) {
              for (let gy = 0; gy < 30; gy += 1) {
                const p = { x: (gx + 0.5) * 100 / 30, y: (gy + 0.5) * 100 / 30 };
                let best = 0;
                let bestDistance = Infinity;

                sites.forEach(function (s, index) {
                  const d = (s.x - p.x) * (s.x - p.x) + (s.y - p.y) * (s.y - p.y);
                  if (d < bestDistance) { bestDistance = d; best = index; }
                });
                let holders = 0;

                cells.forEach(function (cell) { if (inside(cell, p)) holders += 1; });
                samples += 1;
                api.assert.equal(holders, 1,
                  'the sample at ' + p.x.toFixed(2) + ',' + p.y.toFixed(2) +
                  ' is in ' + holders + ' cells, and the cells must partition the box');
                api.assert.ok(inside(cells[best], p),
                  'the sample must land in the cell of its nearest site');
              }
            }
            api.assert.equal(samples, 900, 'the grid must actually be walked');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));

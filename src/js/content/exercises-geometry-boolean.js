/**
 * Graded exercises for boolean operations and rotating calipers (M16.7-M16.8).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'polygon-clipping': [{
      id: 'clip-convex-pieces',
      title: 'Sutherland-Hodgman, and the concave clip it cannot be given',
      prompt: 'clipPieces(subject, pieces) must return { polygons, area }. `pieces` is a ' +
        'decomposition of the clip region into interior-disjoint CONVEX polygons, and the answer is ' +
        'the subject clipped against the region they cover. Clip the subject against each piece ' +
        'SEPARATELY with Sutherland-Hodgman — walk the piece\'s edges, and for each edge keep the ' +
        'part of the current polygon on its inside, emitting the crossing point wherever an edge ' +
        'changes side. Pieces are wound counter-clockwise, so "inside" is where the cross product ' +
        '`(b − a) × (p − a)` is not negative. Collect every result with three or more vertices into ' +
        '`polygons` and sum their shoelace areas into `area`; the pieces do not overlap, so a sum is ' +
        'the union. The starter feeds each clip result into the next piece rather than starting ' +
        'from the subject each time, which is the same thing as treating a concave region as one ' +
        'long list of half-planes — and it returns nothing at all.',
      entry: 'clipPieces',
      starter: [
        'function clipPieces(subject, pieces) {',
        '  function clipByEdge(poly, a, b) {',
        '    const out = [];',
        '    const side = function (p) {',
        '      return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);',
        '    };',
        '',
        '    for (let i = 0; i < poly.length; i += 1) {',
        '      const p = poly[i];',
        '      const q = poly[(i + 1) % poly.length];',
        '      const vp = side(p);',
        '      const vq = side(q);',
        '      if (vp >= 0) out.push(p);',
        '      if ((vp < 0 && vq > 0) || (vp > 0 && vq < 0)) {',
        '        const t = vp / (vp - vq);',
        '        out.push({ x: p.x + t * (q.x - p.x), y: p.y + t * (q.y - p.y) });',
        '      }',
        '    }',
        '    return out;',
        '  }',
        '  function shoelace(poly) {',
        '    let sum = 0;',
        '',
        '    for (let i = 0; i < poly.length; i += 1) {',
        '      const p = poly[i];',
        '      const q = poly[(i + 1) % poly.length];',
        '      sum += p.x * q.y - q.x * p.y;',
        '    }',
        '    return Math.abs(sum) / 2;',
        '  }',
        '  let poly = subject.slice();',
        '',
        '  // every piece applied to what the last one left: a concave clip as half-planes',
        '  pieces.forEach(function (piece) {',
        '    for (let i = 0; i < piece.length && poly.length; i += 1) {',
        '      poly = clipByEdge(poly, piece[i], piece[(i + 1) % piece.length]);',
        '    }',
        '  });',
        '  if (poly.length < 3) return { polygons: [], area: 0 };',
        '  return { polygons: [poly], area: shoelace(poly) };',
        '}'
      ].join('\n'),
      solution: [
        'function clipPieces(subject, pieces) {',
        '  function clipByEdge(poly, a, b) {',
        '    const out = [];',
        '    const side = function (p) {',
        '      return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);',
        '    };',
        '',
        '    for (let i = 0; i < poly.length; i += 1) {',
        '      const p = poly[i];',
        '      const q = poly[(i + 1) % poly.length];',
        '      const vp = side(p);',
        '      const vq = side(q);',
        '      if (vp >= 0) out.push(p);',
        '      if ((vp < 0 && vq > 0) || (vp > 0 && vq < 0)) {',
        '        const t = vp / (vp - vq);',
        '        out.push({ x: p.x + t * (q.x - p.x), y: p.y + t * (q.y - p.y) });',
        '      }',
        '    }',
        '    return out;',
        '  }',
        '  function shoelace(poly) {',
        '    let sum = 0;',
        '',
        '    for (let i = 0; i < poly.length; i += 1) {',
        '      const p = poly[i];',
        '      const q = poly[(i + 1) % poly.length];',
        '      sum += p.x * q.y - q.x * p.y;',
        '    }',
        '    return Math.abs(sum) / 2;',
        '  }',
        '  const polygons = [];',
        '  let area = 0;',
        '',
        '  pieces.forEach(function (piece) {',
        '    // each piece is convex, so the algorithm applies — and each starts from the subject',
        '    let poly = subject.slice();',
        '',
        '    for (let i = 0; i < piece.length && poly.length; i += 1) {',
        '      poly = clipByEdge(poly, piece[i], piece[(i + 1) % piece.length]);',
        '    }',
        '    if (poly.length < 3) return;',
        '    polygons.push(poly);',
        '    area += shoelace(poly);',
        '  });',
        '  return { polygons: polygons, area: area };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'a single convex clip matches a rasterised reference',
          assert: function (clipPieces, api) {
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
            function sampled(subject, pieces, step) {
              let hits = 0;

              for (let x = 0; x < 80; x += step) {
                for (let y = 0; y < 80; y += step) {
                  const p = { x: x + step / 2, y: y + step / 2 };
                  if (!inside(subject, p)) continue;
                  const covered = pieces.some(function (piece) { return inside(piece, p); });
                  if (covered) hits += 1;
                }
              }
              return hits * step * step;
            }
            const subject = [{ x: 10, y: 10 }, { x: 70, y: 10 }, { x: 70, y: 70 }, { x: 10, y: 70 }];
            const pieces = [[{ x: 25, y: 25 }, { x: 65, y: 25 }, { x: 65, y: 55 }, { x: 25, y: 55 }]];
            const got = clipPieces(subject, pieces);

            api.assert.equal(got.polygons.length, 1, 'one piece, one polygon');
            api.assert.closeTo(got.area, sampled(subject, pieces, 0.25), 1e-6,
              'a convex clip is exactly where Sutherland-Hodgman is correct');
            api.assert.closeTo(got.area, 1200, 1e-9, 'the overlap here is 40 by 30');
          }
        },
        {
          name: 'a three-piece decomposition of a concave clip matches the sampler',
          assert: function (clipPieces, api) {
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
            function sampled(subject, pieces, step) {
              let hits = 0;

              for (let x = 0; x < 80; x += step) {
                for (let y = 0; y < 80; y += step) {
                  const p = { x: x + step / 2, y: y + step / 2 };
                  if (!inside(subject, p)) continue;
                  const covered = pieces.some(function (piece) { return inside(piece, p); });
                  if (covered) hits += 1;
                }
              }
              return hits * step * step;
            }
            const subject = [{ x: 10, y: 10 }, { x: 70, y: 10 }, { x: 70, y: 70 }, { x: 10, y: 70 }];
            const pieces = [
              [{ x: 20, y: 20 }, { x: 60, y: 20 }, { x: 60, y: 35 }, { x: 20, y: 35 }],
              [{ x: 20, y: 35 }, { x: 30, y: 35 }, { x: 30, y: 60 }, { x: 20, y: 60 }],
              [{ x: 50, y: 35 }, { x: 60, y: 35 }, { x: 60, y: 60 }, { x: 50, y: 60 }]
            ];
            const got = clipPieces(subject, pieces);

            api.assert.equal(got.polygons.length, 3, 'each piece contributes a polygon');
            api.assert.closeTo(got.area, sampled(subject, pieces, 0.25), 1e-6,
              'a notch clip needs one pass per convex piece, each starting from the subject');
            api.assert.closeTo(got.area, 1100, 1e-9, 'the notch covers 600 + 250 + 250');
          }
        },
        {
          name: 'pieces the subject misses entirely contribute nothing',
          assert: function (clipPieces, api) {
            const subject = [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 20 }, { x: 0, y: 20 }];
            const pieces = [
              [{ x: 5, y: 5 }, { x: 15, y: 5 }, { x: 15, y: 15 }, { x: 5, y: 15 }],
              [{ x: 50, y: 50 }, { x: 60, y: 50 }, { x: 60, y: 60 }, { x: 50, y: 60 }]
            ];
            const got = clipPieces(subject, pieces);

            api.assert.equal(got.polygons.length, 1, 'the far piece clips to nothing');
            api.assert.closeTo(got.area, 100, 1e-9, 'and the near one contributes 10 by 10');
            api.assert.closeTo(clipPieces(subject, []).area, 0, 1e-9, 'no pieces, no area');
          }
        },
        {
          name: 'a subject entirely inside one piece comes back whole',
          assert: function (clipPieces, api) {
            const subject = [{ x: 10, y: 10 }, { x: 20, y: 10 }, { x: 20, y: 20 }, { x: 10, y: 20 }];
            const pieces = [[{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 40 }, { x: 0, y: 40 }]];
            const got = clipPieces(subject, pieces);

            api.assert.closeTo(got.area, 100, 1e-9, 'clipping cannot remove anything here');
            api.assert.atLeast(got.polygons[0].length, 4, 'and the four corners survive');
          }
        }
      ]
    }],

    'rotating-calipers': [{
      id: 'min-area-rectangle',
      title: 'One angle per hull edge, and a sweep that must never beat it',
      prompt: 'minAreaRect(points) must return { area, angle, width, height, candidates }: the ' +
        'smallest-area enclosing rectangle at any orientation. Build the convex hull, then try ONE ' +
        'angle per hull edge — the minimum-area rectangle always has a side flush with a hull edge, ' +
        'so every other angle in the continuous range between them is provably worse. For each ' +
        'candidate angle, rotate the hull by minus that angle, take the axis-aligned extent, and ' +
        'keep the smallest width times height. `angle` is the winning edge\'s direction in radians, ' +
        '`width` and `height` are that rectangle\'s extents in the rotated frame, and `candidates` ' +
        'is how many angles were tried. The starter returns the axis-aligned bounding box, which is ' +
        'a valid enclosing rectangle, is what almost every system actually uses, and on data with a ' +
        'diagonal grain is an order of magnitude too large.',
      entry: 'minAreaRect',
      starter: [
        'function minAreaRect(points) {',
        '  function extent(list, angle) {',
        '    const c = Math.cos(-angle);',
        '    const s = Math.sin(-angle);',
        '    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;',
        '',
        '    list.forEach(function (p) {',
        '      const x = p.x * c - p.y * s;',
        '      const y = p.x * s + p.y * c;',
        '      if (x < minX) minX = x;',
        '      if (x > maxX) maxX = x;',
        '      if (y < minY) minY = y;',
        '      if (y > maxY) maxY = y;',
        '    });',
        '    return { width: maxX - minX, height: maxY - minY,',
        '      area: (maxX - minX) * (maxY - minY) };',
        '  }',
        '',
        '  // the axis-aligned box: free, valid, and sometimes ten times too big',
        '  const box = extent(points, 0);',
        '',
        '  return { area: box.area, angle: 0, width: box.width, height: box.height,',
        '    candidates: 1 };',
        '}'
      ].join('\n'),
      solution: [
        'function minAreaRect(points) {',
        '  function cross(o, a, b) {',
        '    return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);',
        '  }',
        '  function hullOf(list) {',
        '    const sorted = list.slice().sort(function (p, q) { return p.x - q.x || p.y - q.y; });',
        '    const unique = [];',
        '',
        '    sorted.forEach(function (p) {',
        '      const last = unique[unique.length - 1];',
        '      if (!last || last.x !== p.x || last.y !== p.y) unique.push(p);',
        '    });',
        '    if (unique.length < 3) return unique;',
        '',
        '    function build(order) {',
        '      const out = [];',
        '',
        '      order.forEach(function (p) {',
        '        while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], p) <= 0) {',
        '          out.pop();',
        '        }',
        '        out.push(p);',
        '      });',
        '      return out;',
        '    }',
        '    const lower = build(unique);',
        '    const upper = build(unique.slice().reverse());',
        '    return lower.slice(0, -1).concat(upper.slice(0, -1));',
        '  }',
        '  function extent(list, angle) {',
        '    const c = Math.cos(-angle);',
        '    const s = Math.sin(-angle);',
        '    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;',
        '',
        '    list.forEach(function (p) {',
        '      const x = p.x * c - p.y * s;',
        '      const y = p.x * s + p.y * c;',
        '      if (x < minX) minX = x;',
        '      if (x > maxX) maxX = x;',
        '      if (y < minY) minY = y;',
        '      if (y > maxY) maxY = y;',
        '    });',
        '    return { width: maxX - minX, height: maxY - minY,',
        '      area: (maxX - minX) * (maxY - minY) };',
        '  }',
        '  const hull = hullOf(points);',
        '',
        '  if (hull.length < 3) {',
        '    const box = extent(points, 0);',
        '    return { area: box.area, angle: 0, width: box.width, height: box.height,',
        '      candidates: hull.length };',
        '  }',
        '  let best = null;',
        '',
        '  // one candidate per hull edge, and the theorem says that is all of them',
        '  for (let i = 0; i < hull.length; i += 1) {',
        '    const a = hull[i];',
        '    const b = hull[(i + 1) % hull.length];',
        '    const angle = Math.atan2(b.y - a.y, b.x - a.x);',
        '    const got = extent(hull, angle);',
        '',
        '    if (!best || got.area < best.area) {',
        '      best = { area: got.area, angle: angle, width: got.width, height: got.height };',
        '    }',
        '  }',
        '  return { area: best.area, angle: best.angle, width: best.width, height: best.height,',
        '    candidates: hull.length };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the scan is never worse than a 720-angle sweep, over 30 random clouds',
          assert: function (minAreaRect, api) {
            function extent(list, angle) {
              const c = Math.cos(-angle);
              const s = Math.sin(-angle);
              let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

              list.forEach(function (p) {
                const x = p.x * c - p.y * s;
                const y = p.x * s + p.y * c;
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
              });
              return (maxX - minX) * (maxY - minY);
            }

            for (let trial = 0; trial < 30; trial += 1) {
              const points = [];
              const slant = trial % 3;

              for (let i = 0; i < 40; i += 1) {
                const t = api.rng.next() * 100;
                if (slant === 0) points.push({ x: t, y: t + api.rng.next() * 6 });
                else if (slant === 1) points.push({ x: t, y: 60 - t / 2 + api.rng.next() * 20 });
                else points.push({ x: api.rng.next() * 100, y: api.rng.next() * 60 });
              }
              let sweep = Infinity;

              for (let i = 0; i < 720; i += 1) {
                sweep = Math.min(sweep, extent(points, Math.PI * i / 720));
              }
              const got = minAreaRect(points);

              api.assert.atMost(got.area, sweep + 1e-6,
                'trial ' + trial + ': the hull-edge scan is complete, so it cannot lose to a sample');
            }
          }
        },
        {
          name: 'the reported angle, width and height describe the reported area',
          assert: function (minAreaRect, api) {
            function extent(list, angle) {
              const c = Math.cos(-angle);
              const s = Math.sin(-angle);
              let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

              list.forEach(function (p) {
                const x = p.x * c - p.y * s;
                const y = p.x * s + p.y * c;
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
              });
              return { width: maxX - minX, height: maxY - minY };
            }

            for (let trial = 0; trial < 10; trial += 1) {
              const points = [];

              for (let i = 0; i < 30; i += 1) {
                const t = api.rng.next() * 100;
                points.push({ x: t + api.rng.next() * 8, y: t / 2 + api.rng.next() * 8 });
              }
              const got = minAreaRect(points);
              const check = extent(points, got.angle);

              api.assert.closeTo(got.width * got.height, got.area, 1e-6,
                'trial ' + trial + ': the area must be the product of the two extents');
              api.assert.closeTo(check.width, got.width, 1e-6,
                'trial ' + trial + ': every point must fit inside the reported width');
              api.assert.closeTo(check.height, got.height, 1e-6,
                'trial ' + trial + ': and inside the reported height');
              api.assert.atLeast(got.candidates, 3, 'a real hull has at least three edges');
              api.assert.atMost(got.candidates, points.length, 'and at most one per input point');
            }
          }
        },
        {
          name: 'a grid gains nothing and a diagonal cloud gains an order of magnitude',
          assert: function (minAreaRect, api) {
            const grid = [];

            for (let x = 0; x < 8; x += 1) {
              for (let y = 0; y < 8; y += 1) grid.push({ x: x * 10, y: y * 10 });
            }
            api.assert.closeTo(minAreaRect(grid).area, 4900, 1e-6,
              'an axis-aligned grid is already at its minimum');

            const diagonal = [];

            for (let i = 0; i < 60; i += 1) {
              const t = api.rng.next() * 100;
              diagonal.push({ x: t + api.rng.next() * 4, y: t + api.rng.next() * 4 });
            }
            let boxMinX = Infinity, boxMaxX = -Infinity, boxMinY = Infinity, boxMaxY = -Infinity;

            diagonal.forEach(function (p) {
              if (p.x < boxMinX) boxMinX = p.x;
              if (p.x > boxMaxX) boxMaxX = p.x;
              if (p.y < boxMinY) boxMinY = p.y;
              if (p.y > boxMaxY) boxMaxY = p.y;
            });
            const box = (boxMaxX - boxMinX) * (boxMaxY - boxMinY);

            api.assert.atMost(minAreaRect(diagonal).area, box / 10,
              'a diagonal grain makes the axis-aligned box more than ten times too large');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));

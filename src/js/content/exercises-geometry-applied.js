/**
 * Graded exercises for transforms, 3-D geometry and applied geometry (M16.9-M16.10).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'transforms-and-3d': [{
      id: 'moller-trumbore',
      title: 'The intersection that hands you the barycentric coordinates',
      prompt: 'intersect(origin, direction, triangle) must return { hit, parallel, t, u, v } for a ' +
        'ray and a triangle of three { x, y, z } points. Follow Möller-Trumbore: take the two edges ' +
        'from the first vertex, cross the ray direction with the second edge, and dot that with the ' +
        'first edge to get the determinant. A determinant near zero means the ray is PARALLEL to the ' +
        'triangle\'s plane — return `hit: false, parallel: true` rather than dividing by it. ' +
        'Otherwise solve for `u`, then `v`, then `t`, rejecting as soon as a coordinate leaves the ' +
        'triangle: `u` outside [0, 1], `v` below zero, or `u + v` above one. A hit needs `t` ' +
        'strictly positive, so a triangle behind the origin is a miss. The starter checks `u` and ' +
        '`v` separately and forgets that they must also sum to at most one, so it reports hits ' +
        'across the whole parallelogram rather than the triangle — twice the area, and half the ' +
        'extra hits are wrong.',
      entry: 'intersect',
      starter: [
        'function intersect(origin, direction, triangle) {',
        '  function sub(a, b) { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }; }',
        '  function cross(a, b) {',
        '    return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z,',
        '      z: a.x * b.y - a.y * b.x };',
        '  }',
        '  function dot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }',
        '',
        '  const e1 = sub(triangle[1], triangle[0]);',
        '  const e2 = sub(triangle[2], triangle[0]);',
        '  const p = cross(direction, e2);',
        '  const det = dot(e1, p);',
        '',
        '  if (Math.abs(det) < 1e-12) return { hit: false, parallel: true };',
        '  const inv = 1 / det;',
        '  const from = sub(origin, triangle[0]);',
        '  const u = dot(from, p) * inv;',
        '  if (u < 0 || u > 1) return { hit: false, parallel: false };',
        '  const q = cross(from, e1);',
        '  const v = dot(direction, q) * inv;',
        '',
        '  // u and v each in range, and never asked to sum to one',
        '  if (v < 0 || v > 1) return { hit: false, parallel: false };',
        '  const t = dot(e2, q) * inv;',
        '  if (t <= 0) return { hit: false, parallel: false };',
        '  return { hit: true, parallel: false, t: t, u: u, v: v };',
        '}'
      ].join('\n'),
      solution: [
        'function intersect(origin, direction, triangle) {',
        '  function sub(a, b) { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }; }',
        '  function cross(a, b) {',
        '    return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z,',
        '      z: a.x * b.y - a.y * b.x };',
        '  }',
        '  function dot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }',
        '',
        '  const e1 = sub(triangle[1], triangle[0]);',
        '  const e2 = sub(triangle[2], triangle[0]);',
        '  const p = cross(direction, e2);',
        '  const det = dot(e1, p);',
        '',
        '  // a ray parallel to the plane is rejected, not divided by',
        '  if (Math.abs(det) < 1e-12) return { hit: false, parallel: true };',
        '  const inv = 1 / det;',
        '  const from = sub(origin, triangle[0]);',
        '  const u = dot(from, p) * inv;',
        '  if (u < 0 || u > 1) return { hit: false, parallel: false };',
        '  const q = cross(from, e1);',
        '  const v = dot(direction, q) * inv;',
        '',
        '  // the third barycentric coordinate is 1 − u − v, and it must not be negative',
        '  if (v < 0 || u + v > 1) return { hit: false, parallel: false };',
        '  const t = dot(e2, q) * inv;',
        '  if (t <= 0) return { hit: false, parallel: false };',
        '  return { hit: true, parallel: false, t: t, u: u, v: v };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: '20 000 rays agree with a plane-and-edges reference that shares no algebra',
          assert: function (intersect, api) {
            function sub(a, b) { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }; }
            function cross(a, b) {
              return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z,
                z: a.x * b.y - a.y * b.x };
            }
            function dot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
            function add(a, b) { return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }; }
            function scale(a, k) { return { x: a.x * k, y: a.y * k, z: a.z * k }; }

            function reference(origin, direction, triangle) {
              const e1 = sub(triangle[1], triangle[0]);
              const e2 = sub(triangle[2], triangle[0]);
              const normal = cross(e1, e2);
              const denominator = dot(normal, direction);

              if (Math.abs(denominator) < 1e-12) return false;
              const t = dot(normal, sub(triangle[0], origin)) / denominator;
              if (t <= 0) return false;
              const point = add(origin, scale(direction, t));
              const c0 = dot(normal, cross(sub(triangle[1], triangle[0]), sub(point, triangle[0])));
              const c1 = dot(normal, cross(sub(triangle[2], triangle[1]), sub(point, triangle[1])));
              const c2 = dot(normal, cross(sub(triangle[0], triangle[2]), sub(point, triangle[2])));
              return c0 >= 0 && c1 >= 0 && c2 >= 0;
            }
            let hits = 0;

            for (let trial = 0; trial < 20000; trial += 1) {
              const triangle = [];

              for (let i = 0; i < 3; i += 1) {
                triangle.push({ x: api.rng.next() * 4 - 2, y: api.rng.next() * 4 - 2,
                  z: 2 + api.rng.next() * 2 });
              }
              const origin = { x: 0, y: 0, z: 0 };
              const direction = { x: api.rng.next() * 2 - 1, y: api.rng.next() * 2 - 1, z: 1 };
              const got = intersect(origin, direction, triangle);

              if (got.hit) hits += 1;
              api.assert.equal(got.hit, reference(origin, direction, triangle),
                'trial ' + trial + ': the two derivations must agree');
            }
            api.assert.atLeast(hits, 200, 'the sweep must actually hit some triangles');
          }
        },
        {
          name: 'every hit round-trips through its barycentric coordinates',
          assert: function (intersect, api) {
            for (let trial = 0; trial < 4000; trial += 1) {
              const triangle = [];

              for (let i = 0; i < 3; i += 1) {
                triangle.push({ x: api.rng.next() * 4 - 2, y: api.rng.next() * 4 - 2,
                  z: 2 + api.rng.next() * 2 });
              }
              const origin = { x: 0, y: 0, z: 0 };
              const direction = { x: api.rng.next() * 2 - 1, y: api.rng.next() * 2 - 1, z: 1 };
              const got = intersect(origin, direction, triangle);
              if (!got.hit) continue;

              api.assert.atLeast(got.u, -1e-12, 'u must be inside the triangle');
              api.assert.atLeast(got.v, -1e-12, 'v must be inside the triangle');
              api.assert.atMost(got.u + got.v, 1 + 1e-12, 'and the two must sum to at most one');

              const along = { x: origin.x + direction.x * got.t, y: origin.y + direction.y * got.t,
                z: origin.z + direction.z * got.t };
              const rebuilt = {
                x: triangle[0].x + got.u * (triangle[1].x - triangle[0].x) +
                  got.v * (triangle[2].x - triangle[0].x),
                y: triangle[0].y + got.u * (triangle[1].y - triangle[0].y) +
                  got.v * (triangle[2].y - triangle[0].y),
                z: triangle[0].z + got.u * (triangle[1].z - triangle[0].z) +
                  got.v * (triangle[2].z - triangle[0].z)
              };

              api.assert.closeTo(rebuilt.x, along.x, 1e-9, 'trial ' + trial + ': x');
              api.assert.closeTo(rebuilt.y, along.y, 1e-9, 'trial ' + trial + ': y');
              api.assert.closeTo(rebuilt.z, along.z, 1e-9, 'trial ' + trial + ': z');
            }
          }
        },
        {
          name: 'the parallel ray, the triangle behind the origin, and the centre hit',
          assert: function (intersect, api) {
            const triangle = [{ x: 0, y: 0, z: 1 }, { x: 1, y: 0, z: 1 }, { x: 0, y: 1, z: 1 }];
            const parallel = intersect({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, triangle);

            api.assert.equal(parallel.hit, false, 'a ray in the plane must not hit');
            api.assert.equal(parallel.parallel, true, 'and it must be reported as parallel');

            const behind = intersect({ x: 0.25, y: 0.25, z: 2 }, { x: 0, y: 0, z: 1 }, triangle);

            api.assert.equal(behind.hit, false, 'the triangle is behind the origin');

            const centre = intersect({ x: 0.25, y: 0.25, z: 0 }, { x: 0, y: 0, z: 1 }, triangle);

            api.assert.equal(centre.hit, true, 'straight through the middle');
            api.assert.closeTo(centre.t, 1, 1e-12, 'one unit along the ray');
            api.assert.closeTo(centre.u, 0.25, 1e-12, 'u');
            api.assert.closeTo(centre.v, 0.25, 1e-12, 'v');

            const outside = intersect({ x: 0.7, y: 0.7, z: 0 }, { x: 0, y: 0, z: 1 }, triangle);

            api.assert.equal(outside.hit, false,
              'u and v are each below one here, and they sum to 1.4');
          }
        }
      ]
    }],

    'applied-geometry': [{
      id: 'sat-minimum-translation',
      title: 'The axis of smallest overlap, and the push that has to push',
      prompt: 'separatingAxis(a, b) must return { overlapping, axes, depth, push } for two convex ' +
        'polygons wound counter-clockwise. The candidate axes are the edge normals of BOTH shapes ' +
        'and nothing else — that is the theorem, and it is what makes the search finite. Project ' +
        'both polygons onto each axis in turn and count the axes you actually test in `axes`; the ' +
        'moment a projection pair fails to overlap, return `overlapping: false` immediately, so a ' +
        'clear miss is cheaper than a hit. If every axis overlaps, the shapes overlap: `depth` is ' +
        'the SMALLEST overlap over all the axes and `push` is the vector that moves `a` out of `b` ' +
        'along that axis. Take the overlap on an axis as the smaller of `aMax − bMin` and ' +
        '`bMax − aMin`, and take the sign from those two rather than from the direction between the ' +
        'centroids — the starter does the latter, which is intuitive, cheap, and returns a push ' +
        'that does not separate the shapes.',
      entry: 'separatingAxis',
      starter: [
        'function separatingAxis(a, b) {',
        '  function normals(poly) {',
        '    const out = [];',
        '',
        '    for (let i = 0; i < poly.length; i += 1) {',
        '      const p = poly[i];',
        '      const q = poly[(i + 1) % poly.length];',
        '      const ex = q.x - p.x;',
        '      const ey = q.y - p.y;',
        '      const length = Math.hypot(ex, ey) || 1;',
        '      out.push({ x: -ey / length, y: ex / length });',
        '    }',
        '    return out;',
        '  }',
        '  function project(poly, axis) {',
        '    let min = Infinity;',
        '    let max = -Infinity;',
        '',
        '    poly.forEach(function (p) {',
        '      const d = p.x * axis.x + p.y * axis.y;',
        '      if (d < min) min = d;',
        '      if (d > max) max = d;',
        '    });',
        '    return { min: min, max: max };',
        '  }',
        '  function centroid(poly) {',
        '    return poly.reduce(function (sum, p) {',
        '      return { x: sum.x + p.x / poly.length, y: sum.y + p.y / poly.length };',
        '    }, { x: 0, y: 0 });',
        '  }',
        '  const candidates = normals(a).concat(normals(b));',
        '  let tested = 0;',
        '  let best = Infinity;',
        '',
        '  for (let i = 0; i < candidates.length; i += 1) {',
        '    tested += 1;',
        '    const pa = project(a, candidates[i]);',
        '    const pb = project(b, candidates[i]);',
        '    if (pa.max <= pb.min || pb.max <= pa.min) {',
        '      return { overlapping: false, axes: tested, depth: 0, push: { x: 0, y: 0 } };',
        '    }',
        '    const overlap = Math.min(pa.max, pb.max) - Math.max(pa.min, pb.min);',
        '    if (overlap < best) best = overlap;',
        '  }',
        '',
        '  // the direction between the centroids: right most of the time',
        '  const ca = centroid(a);',
        '  const cb = centroid(b);',
        '  const dx = ca.x - cb.x;',
        '  const dy = ca.y - cb.y;',
        '  const length = Math.hypot(dx, dy) || 1;',
        '',
        '  return { overlapping: true, axes: tested, depth: best,',
        '    push: { x: dx / length * best, y: dy / length * best } };',
        '}'
      ].join('\n'),
      solution: [
        'function separatingAxis(a, b) {',
        '  function normals(poly) {',
        '    const out = [];',
        '',
        '    for (let i = 0; i < poly.length; i += 1) {',
        '      const p = poly[i];',
        '      const q = poly[(i + 1) % poly.length];',
        '      const ex = q.x - p.x;',
        '      const ey = q.y - p.y;',
        '      const length = Math.hypot(ex, ey) || 1;',
        '      out.push({ x: -ey / length, y: ex / length });',
        '    }',
        '    return out;',
        '  }',
        '  function project(poly, axis) {',
        '    let min = Infinity;',
        '    let max = -Infinity;',
        '',
        '    poly.forEach(function (p) {',
        '      const d = p.x * axis.x + p.y * axis.y;',
        '      if (d < min) min = d;',
        '      if (d > max) max = d;',
        '    });',
        '    return { min: min, max: max };',
        '  }',
        '  const candidates = normals(a).concat(normals(b));',
        '  let tested = 0;',
        '  let best = Infinity;',
        '  let push = { x: 0, y: 0 };',
        '',
        '  for (let i = 0; i < candidates.length; i += 1) {',
        '    tested += 1;',
        '    const axis = candidates[i];',
        '    const pa = project(a, axis);',
        '    const pb = project(b, axis);',
        '',
        '    // one axis with no overlap is the whole answer',
        '    if (pa.max <= pb.min || pb.max <= pa.min) {',
        '      return { overlapping: false, axes: tested, depth: 0, push: { x: 0, y: 0 } };',
        '    }',
        '    const left = pa.max - pb.min;',
        '    const right = pb.max - pa.min;',
        '    const overlap = Math.min(left, right);',
        '',
        '    if (overlap < best) {',
        '      best = overlap;',
        '      const sign = left < right ? -1 : 1;',
        '      push = { x: axis.x * overlap * sign, y: axis.y * overlap * sign };',
        '    }',
        '  }',
        '  return { overlapping: true, axes: tested, depth: best, push: push };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'applying the push separates the shapes, over 400 overlapping pairs',
          assert: function (separatingAxis, api) {
            function stretched(sides, cx, cy, rx, ry, rotation) {
              const out = [];

              for (let i = 0; i < sides; i += 1) {
                const angle = 2 * Math.PI * i / sides;
                const x = rx * Math.cos(angle);
                const y = ry * Math.sin(angle);
                out.push({ x: cx + x * Math.cos(rotation) - y * Math.sin(rotation),
                  y: cy + x * Math.sin(rotation) + y * Math.cos(rotation) });
              }
              return out;
            }
            function moved(poly, v) {
              return poly.map(function (p) { return { x: p.x + v.x, y: p.y + v.y }; });
            }
            let overlaps = 0;

            for (let trial = 0; trial < 400; trial += 1) {
              const a = stretched(4 + api.rng.int(3), 0, 0, 4 + api.rng.next() * 20,
                1 + api.rng.next() * 3, api.rng.next() * Math.PI);
              const b = stretched(4 + api.rng.int(3), (api.rng.next() - 0.5) * 20,
                (api.rng.next() - 0.5) * 20, 4 + api.rng.next() * 20,
                1 + api.rng.next() * 3, api.rng.next() * Math.PI);
              const got = separatingAxis(a, b);
              if (!got.overlapping) continue;
              overlaps += 1;

              api.assert.atLeast(got.depth, 0, 'trial ' + trial + ': a depth is not negative');
              const after = separatingAxis(moved(a, got.push), b);

              api.assert.atMost(after.depth, 1e-6,
                'trial ' + trial + ': applying the push must separate the shapes');
            }
            api.assert.atLeast(overlaps, 100, 'most of these pairs should overlap');
          }
        },
        {
          name: 'the verdict agrees with a sampling oracle',
          assert: function (separatingAxis, api) {
            function stretched(sides, cx, cy, rx, ry, rotation) {
              const out = [];

              for (let i = 0; i < sides; i += 1) {
                const angle = 2 * Math.PI * i / sides;
                const x = rx * Math.cos(angle);
                const y = ry * Math.sin(angle);
                out.push({ x: cx + x * Math.cos(rotation) - y * Math.sin(rotation),
                  y: cy + x * Math.sin(rotation) + y * Math.cos(rotation) });
              }
              return out;
            }
            function inside(poly, p) {
              for (let i = 0; i < poly.length; i += 1) {
                const q = poly[i];
                const r = poly[(i + 1) % poly.length];
                if ((r.x - q.x) * (p.y - q.y) - (r.y - q.y) * (p.x - q.x) < 0) return false;
              }
              return true;
            }
            function sampled(a, b) {
              let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

              a.concat(b).forEach(function (p) {
                minX = Math.min(minX, p.x);
                maxX = Math.max(maxX, p.x);
                minY = Math.min(minY, p.y);
                maxY = Math.max(maxY, p.y);
              });

              for (let i = 0; i <= 140; i += 1) {
                for (let j = 0; j <= 140; j += 1) {
                  const p = { x: minX + (maxX - minX) * i / 140,
                    y: minY + (maxY - minY) * j / 140 };
                  if (inside(a, p) && inside(b, p)) return true;
                }
              }
              return false;
            }

            for (let trial = 0; trial < 120; trial += 1) {
              const a = stretched(4 + api.rng.int(3), 0, 0, 4 + api.rng.next() * 20,
                1 + api.rng.next() * 3, api.rng.next() * Math.PI);
              const b = stretched(4 + api.rng.int(3), (api.rng.next() - 0.5) * 20,
                (api.rng.next() - 0.5) * 20, 4 + api.rng.next() * 20,
                1 + api.rng.next() * 3, api.rng.next() * Math.PI);
              const got = separatingAxis(a, b);

              // only judge the clear cases; the sampler resolves to one grid cell
              if (got.overlapping && got.depth < 0.4) continue;
              api.assert.equal(got.overlapping, sampled(a, b),
                'trial ' + trial + ': the sampling oracle disagreed');
            }
          }
        },
        {
          name: 'a clear miss exits early, and touching along an edge is not an overlap',
          assert: function (separatingAxis, api) {
            const square = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
            const far = [{ x: 40, y: 40 }, { x: 50, y: 40 }, { x: 50, y: 50 }, { x: 40, y: 50 }];
            const over = [{ x: 5, y: 5 }, { x: 15, y: 5 }, { x: 15, y: 15 }, { x: 5, y: 15 }];
            const touching = [{ x: 10, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 10 }, { x: 10, y: 10 }];

            const miss = separatingAxis(square, far);
            const hit = separatingAxis(square, over);

            api.assert.equal(miss.overlapping, false, 'these squares are nowhere near each other');
            api.assert.equal(hit.overlapping, true, 'and these overlap by 5 in each direction');
            api.assert.atMost(miss.axes, hit.axes,
              'the test stops at the first separating axis, so a miss is cheaper');
            api.assert.closeTo(hit.depth, 5, 1e-9, 'the smallest overlap is 5');
            api.assert.equal(separatingAxis(square, touching).overlapping, false,
              'touching along an edge is not an overlap');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));

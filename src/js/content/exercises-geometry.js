/**
 * Graded exercises for primitives, polygons and convex hulls (M16.1-M16.3).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'geometry-primitives': [{
      id: 'orient2d-escalate',
      title: 'The filter that knows when it must not answer',
      prompt: 'orient2d(a, b, c) must return { sign, escalated } for INTEGER coordinates. `sign` is ' +
        '+1 when c lies left of the ray a to b, −1 when it lies right, and 0 when the three are ' +
        'exactly collinear. Compute the determinant as `left − right` where `left = (b.x − a.x) * ' +
        '(c.y − a.y)` and `right = (b.y − a.y) * (c.x − a.x)`, then compare its magnitude against a ' +
        'bound computed from the operands — `3.3306690738754716e-16 * (|left| + |right|)`. Outside ' +
        'that bound the sign is certain: return it with `escalated: false`. Inside it rounding could ' +
        'have moved the value across zero, so redo the whole determinant in BigInt and return that ' +
        'sign with `escalated: true`. The starter takes the sign of the double and never escalates, ' +
        'so on coordinates near 2³⁰ it answers 0 for triples that are a genuine right turn — and ' +
        'answers differently depending on which of the three points you pass first.',
      entry: 'orient2d',
      starter: [
        'function orient2d(a, b, c) {',
        '  const left = (b.x - a.x) * (c.y - a.y);',
        '  const right = (b.y - a.y) * (c.x - a.x);',
        '  const det = left - right;',
        '',
        '  // the sign of a rounded number, taken on faith',
        '  return { sign: det > 0 ? 1 : (det < 0 ? -1 : 0), escalated: false };',
        '}'
      ].join('\n'),
      solution: [
        'function orient2d(a, b, c) {',
        '  const left = (b.x - a.x) * (c.y - a.y);',
        '  const right = (b.y - a.y) * (c.x - a.x);',
        '  const det = left - right;',
        '  const bound = 3.3306690738754716e-16 * (Math.abs(left) + Math.abs(right));',
        '',
        '  // outside its own error bar the sign cannot be a rounding artefact',
        '  if (det > bound) return { sign: 1, escalated: false };',
        '  if (-det > bound) return { sign: -1, escalated: false };',
        '',
        '  // inside it, redo the arithmetic where there is no rounding at all',
        '  const B = BigInt;',
        '  const exact = (B(b.x) - B(a.x)) * (B(c.y) - B(a.y)) -',
        '    (B(b.y) - B(a.y)) * (B(c.x) - B(a.x));',
        '',
        '  return { sign: exact > 0n ? 1 : (exact < 0n ? -1 : 0), escalated: true };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the six orderings of one adversarial triple cannot contradict each other',
          assert: function (orient2d, api) {
            const base = Math.pow(2, 30);
            const a = { x: 0, y: 0 };
            const b = { x: base, y: base + 1 };
            const c = { x: base + 2, y: base + 3 };
            const rotations = [[a, b, c], [b, c, a], [c, a, b]];
            const swaps = [[a, c, b], [c, b, a], [b, a, c]];
            const even = rotations.map(function (t) { return orient2d(t[0], t[1], t[2]).sign; });
            const odd = swaps.map(function (t) { return orient2d(t[0], t[1], t[2]).sign; });

            api.assert.equal(even[0], even[1], 'the three rotations must agree');
            api.assert.equal(even[1], even[2], 'the three rotations must agree');
            api.assert.equal(odd[0], -even[0], 'swapping two arguments must flip the sign');
            api.assert.equal(odd[1], -even[0], 'swapping two arguments must flip the sign');
            api.assert.equal(odd[2], -even[0], 'swapping two arguments must flip the sign');
            api.assert.equal(even[0], -1, 'this triple is a right turn: the exact determinant is −2');
          }
        },
        {
          name: '2 000 near-collinear triples at 2³⁰ agree with a BigInt reference',
          assert: function (orient2d, api) {
            function exact(a, b, c) {
              const B = BigInt;
              const v = (B(b.x) - B(a.x)) * (B(c.y) - B(a.y)) -
                (B(b.y) - B(a.y)) * (B(c.x) - B(a.x));
              return v > 0n ? 1 : (v < 0n ? -1 : 0);
            }

            for (let trial = 0; trial < 2000; trial += 1) {
              const ox = api.rng.int(1000);
              const oy = api.rng.int(1000);
              const u = Math.pow(2, 29) + api.rng.int(Math.pow(2, 30));
              const k1 = 1 + api.rng.int(50);
              const k2 = 1 + api.rng.int(50);
              const e = api.rng.int(3) - 1;
              const a = { x: ox, y: oy };
              const b = { x: ox + u, y: oy + u + k1 };
              const c = { x: ox + u + k2, y: oy + u + k1 + k2 + e };

              api.assert.equal(orient2d(a, b, c).sign, exact(a, b, c),
                'trial ' + trial + ': the double determinant is inside its own error bar here');
            }
          }
        },
        {
          name: 'ordinary coordinates never reach the exact path',
          assert: function (orient2d, api) {
            function exact(a, b, c) {
              const B = BigInt;
              const v = (B(b.x) - B(a.x)) * (B(c.y) - B(a.y)) -
                (B(b.y) - B(a.y)) * (B(c.x) - B(a.x));
              return v > 0n ? 1 : (v < 0n ? -1 : 0);
            }
            let escalations = 0;
            let checked = 0;

            for (let trial = 0; trial < 600; trial += 1) {
              const a = { x: api.rng.int(1000), y: api.rng.int(1000) };
              const b = { x: api.rng.int(1000), y: api.rng.int(1000) };
              const c = { x: api.rng.int(1000), y: api.rng.int(1000) };
              if (exact(a, b, c) === 0) continue;
              checked += 1;
              const got = orient2d(a, b, c);

              api.assert.equal(got.sign, exact(a, b, c), 'trial ' + trial);
              if (got.escalated) escalations += 1;
            }
            api.assert.atLeast(checked, 500, 'most random triples are not collinear');
            api.assert.equal(escalations, 0,
              'the filter must answer every one of these itself — robustness is free here');
          }
        },
        {
          name: 'exactly collinear points return 0 rather than a sign',
          assert: function (orient2d, api) {
            api.assert.equal(orient2d({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 25, y: 25 }).sign, 0);
            api.assert.equal(orient2d({ x: 0, y: 0 }, { x: 0, y: 7 }, { x: 0, y: 3 }).sign, 0);
            api.assert.equal(orient2d({ x: 4, y: 4 }, { x: 4, y: 4 }, { x: 9, y: 1 }).sign, 0,
              'two coincident points cannot define a side');
          }
        }
      ]
    }],

    'polygon-containment': [{
      id: 'winding-vertex-hits',
      title: 'Both rules from one loop, and the vertex that must count once',
      prompt: 'contains(ring, point) must shoot one ray in the +x direction and report both ' +
        'containment rules: { crossings, winding, evenOdd, nonZero }. `ring` is an array of ' +
        '{ x, y } with no repeated closing vertex, so edge i runs from vertex i to vertex ' +
        '(i + 1) mod n. An edge is crossed when exactly one of its endpoints is strictly above the ' +
        'point — `p.y > point.y` for one and not the other — which is the half-open rule that makes ' +
        'a ray passing exactly through a vertex count ONCE rather than twice or not at all. Count ' +
        'the crossing only when the intersection lies strictly right of the point. `winding` adds ' +
        '+1 for an edge crossing upward and −1 for one crossing downward. `evenOdd` is whether the ' +
        'crossing count is odd; `nonZero` is whether the winding is not zero. The starter tests the ' +
        'y interval with both ends closed, so on an L-shape it counts a grazed vertex twice and ' +
        'reports a band of interior points as outside.',
      entry: 'contains',
      starter: [
        'function contains(ring, point) {',
        '  let crossings = 0;',
        '  let winding = 0;',
        '',
        '  for (let i = 0; i < ring.length; i += 1) {',
        '    const p = ring[i];',
        '    const q = ring[(i + 1) % ring.length];',
        '',
        '    // both ends inclusive: a vertex on the ray belongs to both its edges',
        '    const lo = Math.min(p.y, q.y);',
        '    const hi = Math.max(p.y, q.y);',
        '    if (p.y === q.y || point.y < lo || point.y > hi) continue;',
        '',
        '    const t = (point.y - p.y) / (q.y - p.y);',
        '    const x = p.x + t * (q.x - p.x);',
        '    if (x <= point.x) continue;',
        '',
        '    crossings += 1;',
        '    winding += q.y > p.y ? 1 : -1;',
        '  }',
        '  return { crossings: crossings, winding: winding,',
        '    evenOdd: crossings % 2 !== 0, nonZero: winding !== 0 };',
        '}'
      ].join('\n'),
      solution: [
        'function contains(ring, point) {',
        '  let crossings = 0;',
        '  let winding = 0;',
        '',
        '  for (let i = 0; i < ring.length; i += 1) {',
        '    const p = ring[i];',
        '    const q = ring[(i + 1) % ring.length];',
        '',
        '    // half-open: strictly above at one end and not at the other',
        '    const pAbove = p.y > point.y;',
        '    const qAbove = q.y > point.y;',
        '    if (pAbove === qAbove) continue;',
        '',
        '    const t = (point.y - p.y) / (q.y - p.y);',
        '    const x = p.x + t * (q.x - p.x);',
        '    if (x <= point.x) continue;',
        '',
        '    crossings += 1;',
        '    winding += qAbove ? 1 : -1;',
        '  }',
        '  return { crossings: crossings, winding: winding,',
        '    evenOdd: crossings % 2 !== 0, nonZero: winding !== 0 };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'both rules match an angle-summing reference on a square, an L-shape and a comb',
          assert: function (contains, api) {
            function windingByAngle(ring, p) {
              let total = 0;

              for (let i = 0; i < ring.length; i += 1) {
                const a = ring[i];
                const b = ring[(i + 1) % ring.length];
                let d = Math.atan2(b.y - p.y, b.x - p.x) - Math.atan2(a.y - p.y, a.x - p.x);

                while (d > Math.PI) d -= 2 * Math.PI;
                while (d < -Math.PI) d += 2 * Math.PI;
                total += d;
              }
              return Math.round(total / (2 * Math.PI));
            }

            function onBoundary(ring, p) {
              for (let i = 0; i < ring.length; i += 1) {
                const a = ring[i];
                const b = ring[(i + 1) % ring.length];
                const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
                if (Math.abs(cross) > 1e-9) continue;
                if (p.x < Math.min(a.x, b.x) - 1e-9 || p.x > Math.max(a.x, b.x) + 1e-9) continue;
                if (p.y < Math.min(a.y, b.y) - 1e-9 || p.y > Math.max(a.y, b.y) + 1e-9) continue;
                return true;
              }
              return false;
            }
            const point = function (x, y) { return { x: x, y: y }; };
            const shapes = {
              square: [point(0, 0), point(60, 0), point(60, 60), point(0, 60)],
              lShape: [point(0, 0), point(60, 0), point(60, 20), point(20, 20),
                point(20, 60), point(0, 60)],
              comb: [point(0, 0), point(60, 0), point(60, 40), point(50, 40), point(50, 10),
                point(40, 10), point(40, 40), point(30, 40), point(30, 10), point(20, 10),
                point(20, 40), point(0, 40)]
            };
            let probes = 0;

            Object.keys(shapes).forEach(function (name) {
              const ring = shapes[name];

              for (let x = 1; x <= 59; x += 2) {
                for (let y = 0; y <= 60; y += 2) {
                  const p = point(x, y);
                  if (onBoundary(ring, p)) continue;
                  probes += 1;
                  const w = windingByAngle(ring, p);
                  const got = contains(ring, p);

                  api.assert.equal(got.nonZero, w !== 0, name + ' non-zero at ' + x + ',' + y);
                  api.assert.equal(got.evenOdd, Math.abs(w) % 2 !== 0,
                    name + ' even-odd at ' + x + ',' + y +
                    ' — a grazed vertex must count once, not twice');
                }
              }
            });
            api.assert.atLeast(probes, 2000, 'the grid must actually be probed');
          }
        },
        {
          name: 'the pentagram centre: two crossings and a winding number of two',
          assert: function (contains, api) {
            const ring = [];

            for (let i = 0; i < 5; i += 1) {
              const angle = -Math.PI / 2 + ((i * 2) % 5) * 2 * Math.PI / 5;
              ring.push({ x: 30 + 30 * Math.cos(angle), y: 30 + 30 * Math.sin(angle) });
            }
            const got = contains(ring, { x: 30, y: 30 });

            api.assert.equal(got.crossings, 2, 'the ray crosses two edges');
            api.assert.equal(Math.abs(got.winding), 2, 'and the ring encircles the centre twice');
            api.assert.equal(got.evenOdd, false, 'even parity: the even-odd rule says outside');
            api.assert.equal(got.nonZero, true, 'non-zero winding: the other rule says inside');
          }
        },
        {
          name: 'on a simple polygon the two rules never disagree',
          assert: function (contains, api) {
            const ring = [{ x: 0, y: 0 }, { x: 80, y: 0 }, { x: 80, y: 30 }, { x: 30, y: 30 },
              { x: 30, y: 50 }, { x: 80, y: 50 }, { x: 80, y: 80 }, { x: 0, y: 80 }];

            for (let trial = 0; trial < 400; trial += 1) {
              const p = { x: 0.5 + api.rng.int(160) / 2, y: 0.5 + api.rng.int(160) / 2 };
              const got = contains(ring, p);

              api.assert.equal(got.evenOdd, got.nonZero,
                'a simple ring cannot make the two rules differ, at ' + p.x + ',' + p.y);
            }
          }
        }
      ]
    }],

    'convex-hulls': [{
      id: 'monotone-chain-policy',
      title: 'Two sweeps, and the one character that is the collinear policy',
      prompt: 'monotoneChain(points, keepCollinear) must return { hull, tests }. Sort the points ' +
        'lexicographically by x then y, drop exact duplicates, then build the lower hull by walking ' +
        'the sorted list and the upper hull by walking it reversed, popping the last vertex while ' +
        'the last three do not turn left. `keepCollinear` decides that comparison and nothing else: ' +
        'when false a zero cross product is also popped, so no three consecutive ring vertices are ' +
        'collinear; when true only a strictly negative one is, so every input point lying on a hull ' +
        'edge stays. Join the two chains, drop each chain\'s last vertex, and make sure the ring ' +
        'lists no point twice. `tests` counts cross-product evaluations. The starter always pops on ' +
        'a zero, so it ignores the parameter: 60 collinear points come back as a 2-point segment ' +
        'whichever policy was asked for.',
      entry: 'monotoneChain',
      starter: [
        'function monotoneChain(points, keepCollinear) {',
        '  let tests = 0;',
        '',
        '  function cross(o, a, b) {',
        '    tests += 1;',
        '    return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);',
        '  }',
        '  const sorted = points.slice().sort(function (p, q) { return p.x - q.x || p.y - q.y; });',
        '  const unique = [];',
        '',
        '  sorted.forEach(function (p) {',
        '    const last = unique[unique.length - 1];',
        '    if (!last || last.x !== p.x || last.y !== p.y) unique.push(p);',
        '  });',
        '  if (unique.length < 3) return { hull: unique.slice(), tests: tests };',
        '',
        '  function build(list) {',
        '    const out = [];',
        '',
        '    list.forEach(function (p) {',
        '      // the policy the caller asked for is never consulted',
        '      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], p) <= 0) {',
        '        out.pop();',
        '      }',
        '      out.push(p);',
        '    });',
        '    return out;',
        '  }',
        '  const lower = build(unique);',
        '  const upper = build(unique.slice().reverse());',
        '',
        '  return { hull: lower.slice(0, -1).concat(upper.slice(0, -1)), tests: tests };',
        '}'
      ].join('\n'),
      solution: [
        'function monotoneChain(points, keepCollinear) {',
        '  let tests = 0;',
        '',
        '  function cross(o, a, b) {',
        '    tests += 1;',
        '    return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);',
        '  }',
        '  const sorted = points.slice().sort(function (p, q) { return p.x - q.x || p.y - q.y; });',
        '  const unique = [];',
        '',
        '  sorted.forEach(function (p) {',
        '    const last = unique[unique.length - 1];',
        '    if (!last || last.x !== p.x || last.y !== p.y) unique.push(p);',
        '  });',
        '  if (unique.length < 3) return { hull: unique.slice(), tests: tests };',
        '',
        '  function build(list) {',
        '    const out = [];',
        '',
        '    list.forEach(function (p) {',
        '      while (out.length >= 2) {',
        '        const c = cross(out[out.length - 2], out[out.length - 1], p);',
        '',
        '        // the whole policy: is a zero a reason to pop?',
        '        if (c < 0 || (!keepCollinear && c === 0)) out.pop();',
        '        else break;',
        '      }',
        '      out.push(p);',
        '    });',
        '    return out;',
        '  }',
        '  const lower = build(unique);',
        '  const upper = build(unique.slice().reverse());',
        '  const ring = lower.slice(0, -1).concat(upper.slice(0, -1));',
        '  const seen = {};',
        '  const hull = [];',
        '',
        '  ring.forEach(function (p) {',
        '    const key = p.x + "," + p.y;',
        '    if (seen[key]) return;',
        '    seen[key] = true;',
        '    hull.push(p);',
        '  });',
        '  return { hull: hull, tests: tests };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the oracle: every point inside, no reflex turn, no repeated vertex',
          assert: function (monotoneChain, api) {
            function orient(a, b, c) {
              const v = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
              return v > 0 ? 1 : (v < 0 ? -1 : 0);
            }
            const sets = {};
            const cloud = [];

            for (let i = 0; i < 200; i += 1) {
              cloud.push({ x: api.rng.int(1000), y: api.rng.int(1000) });
            }
            sets.cloud = cloud;
            const grid = [];

            for (let x = 0; x < 8; x += 1) {
              for (let y = 0; y < 8; y += 1) grid.push({ x: x * 10, y: y * 10 });
            }
            sets.grid = grid;
            const collinear = [];

            for (let i = 0; i < 60; i += 1) collinear.push({ x: i, y: 2 * i });
            sets.collinear = collinear;
            const coincident = [];

            for (let i = 0; i < 60; i += 1) {
              coincident.push({ x: 10 * (i % 3), y: 10 * (i % 3) + (i % 2) * 5 });
            }
            sets.coincident = coincident;

            [true, false].forEach(function (policy) {
              Object.keys(sets).forEach(function (name) {
                const points = sets[name];
                const got = monotoneChain(points, policy);
                const hull = got.hull;
                const label = name + ' with keepCollinear=' + policy;

                api.assert.atLeast(hull.length, 2, label + ': a hull needs at least two points');
                const seen = {};

                hull.forEach(function (p) {
                  const key = p.x + ',' + p.y;
                  api.assert.equal(seen[key], undefined, label + ': ' + key + ' appears twice');
                  seen[key] = true;
                });

                if (hull.length < 3) return;
                points.forEach(function (p) {
                  for (let i = 0; i < hull.length; i += 1) {
                    const a = hull[i];
                    const b = hull[(i + 1) % hull.length];
                    api.assert.atLeast(orient(a, b, p), 0,
                      label + ': (' + p.x + ',' + p.y + ') is outside the returned ring');
                  }
                });

                for (let i = 0; i < hull.length; i += 1) {
                  const a = hull[i];
                  const b = hull[(i + 1) % hull.length];
                  const c = hull[(i + 2) % hull.length];
                  api.assert.atLeast(orient(a, b, c), 0, label + ': a reflex vertex at index ' + i);
                }
              });
            });
          }
        },
        {
          name: 'the policy decides: 60 collinear points are a 2-point segment or all 60',
          assert: function (monotoneChain, api) {
            const collinear = [];

            for (let i = 0; i < 60; i += 1) collinear.push({ x: i, y: 2 * i });
            api.assert.equal(monotoneChain(collinear, false).hull.length, 2,
              'dropping collinear points leaves the two extremes');
            api.assert.equal(monotoneChain(collinear, true).hull.length, 60,
              'keeping them leaves every point, since all of them are on the hull edge');

            const grid = [];

            for (let x = 0; x < 8; x += 1) {
              for (let y = 0; y < 8; y += 1) grid.push({ x: x * 10, y: y * 10 });
            }
            api.assert.equal(monotoneChain(grid, false).hull.length, 4,
              'a square grid has four corners once collinear points are dropped');
            api.assert.equal(monotoneChain(grid, true).hull.length, 28,
              'and 28 boundary points when they are kept');
          }
        },
        {
          name: 'no three consecutive ring vertices are collinear under the drop policy',
          assert: function (monotoneChain, api) {
            function orient(a, b, c) {
              const v = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
              return v > 0 ? 1 : (v < 0 ? -1 : 0);
            }

            for (let trial = 0; trial < 20; trial += 1) {
              const points = [];

              for (let i = 0; i < 60; i += 1) {
                points.push({ x: api.rng.int(12) * 10, y: api.rng.int(12) * 10 });
              }
              const hull = monotoneChain(points, false).hull;
              if (hull.length < 3) continue;

              for (let i = 0; i < hull.length; i += 1) {
                api.assert.equal(orient(hull[i], hull[(i + 1) % hull.length],
                  hull[(i + 2) % hull.length]), 1,
                'trial ' + trial + ': a collinear vertex survived the drop policy');
              }
            }
          }
        },
        {
          name: 'the sweep stays linear after the sort',
          assert: function (monotoneChain, api) {
            const points = [];

            for (let i = 0; i < 400; i += 1) {
              points.push({ x: api.rng.int(100000), y: api.rng.int(100000) });
            }
            const got = monotoneChain(points, false);

            api.assert.atMost(got.tests, 6 * 400,
              'every point is pushed once and popped at most once, in each of two chains');
            api.assert.atLeast(got.hull.length, 3, 'a random cloud has a real hull');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));

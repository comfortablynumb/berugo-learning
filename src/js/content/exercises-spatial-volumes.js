/**
 * Graded exercises for the R-tree, BVH and curve sections (M08.4-M08.6).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'r-trees': [{
      id: 'rtree-quadratic-split',
      title: 'Guttman\'s quadratic split',
      prompt: 'makeSplit() must return { split }. split(entries, minEntries) divides an overflowing node\'s ' +
        'entries - objects with minX, minY, maxX, maxY - into exactly two groups and returns them as an array ' +
        'of two arrays. Use Guttman\'s quadratic rule: pick as seeds the pair whose combined rectangle wastes ' +
        'the most area (area of the union minus both areas), then assign each remaining entry to the group whose ' +
        'rectangle it enlarges least, and force the rest into a group that would otherwise fall below ' +
        '`minEntries`. The grading compares the overlap you leave behind against a naive split that simply cuts ' +
        'the list in half.',
      entry: 'makeSplit',
      starter: [
        'function makeSplit() {',
        '  return {',
        '    split: function (entries, minEntries) {',
        '      // the naive baseline: cut the list in half in insertion order',
        '      const half = Math.ceil(entries.length / 2);',
        '      return [entries.slice(0, half), entries.slice(half)];',
        '    }',
        '  };',
        '}'
      ].join('\n'),
      solution: [
        'function makeSplit() {',
        '  function union(a, b) {',
        '    return {',
        '      minX: Math.min(a.minX, b.minX), minY: Math.min(a.minY, b.minY),',
        '      maxX: Math.max(a.maxX, b.maxX), maxY: Math.max(a.maxY, b.maxY)',
        '    };',
        '  }',
        '',
        '  function area(box) {',
        '    return Math.max(0, box.maxX - box.minX) * Math.max(0, box.maxY - box.minY);',
        '  }',
        '',
        '  function seeds(entries) {',
        '    let best = { a: 0, b: 1, waste: -Infinity };',
        '    for (let i = 0; i < entries.length; i += 1) {',
        '      for (let j = i + 1; j < entries.length; j += 1) {',
        '        const waste = area(union(entries[i], entries[j])) - area(entries[i]) - area(entries[j]);',
        '        if (waste > best.waste) best = { a: i, b: j, waste: waste };',
        '      }',
        '    }',
        '    return best;',
        '  }',
        '',
        '  return {',
        '    split: function (entries, minEntries) {',
        '      const pick = seeds(entries);',
        '      const groups = [[entries[pick.a]], [entries[pick.b]]];',
        '      const boxes = [entries[pick.a], entries[pick.b]];',
        '      const rest = entries.filter(function (entry, index) {',
        '        return index !== pick.a && index !== pick.b;',
        '      });',
        '',
        '      rest.forEach(function (entry, index) {',
        '        const left = rest.length - index;',
        '        for (let side = 0; side < 2; side += 1) {',
        '          // a group that could still fall below the minimum takes the rest',
        '          if (groups[side].length + left === minEntries) {',
        '            groups[side].push(entry);',
        '            boxes[side] = union(boxes[side], entry);',
        '            return;',
        '          }',
        '        }',
        '        const growA = area(union(boxes[0], entry)) - area(boxes[0]);',
        '        const growB = area(union(boxes[1], entry)) - area(boxes[1]);',
        '        const side = growA < growB || (growA === growB && area(boxes[0]) <= area(boxes[1])) ? 0 : 1;',
        '        groups[side].push(entry);',
        '        boxes[side] = union(boxes[side], entry);',
        '      });',
        '',
        '      return groups;',
        '    }',
        '  };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the split is a partition, and both groups clear the minimum',
          assert: function (makeSplit, api) {
            const random = api.rng;
            const splitter = makeSplit();

            for (let round = 0; round < 100; round += 1) {
              const entries = [];
              for (let i = 0; i < 10; i += 1) {
                const x = random.next() * 1000;
                const y = random.next() * 1000;
                const w = 1 + random.next() * 60;
                const h = 1 + random.next() * 60;
                entries.push({ id: i, minX: x, minY: y, maxX: x + w, maxY: y + h });
              }

              const groups = splitter.split(entries, 4);
              api.assert.equal(groups.length, 2, 'a split makes exactly two groups');
              api.assert.equal(groups[0].length + groups[1].length, 10, 'every entry lands somewhere');
              api.assert.atLeast(groups[0].length, 4, 'group 0 is below the minimum fill');
              api.assert.atLeast(groups[1].length, 4, 'group 1 is below the minimum fill');

              const seen = new Set();
              groups[0].concat(groups[1]).forEach(function (entry) { seen.add(entry.id); });
              api.assert.equal(seen.size, 10, 'no entry is duplicated or lost');
            }
          }
        },
        {
          name: 'it leaves less overlap than cutting the list in half',
          assert: function (makeSplit, api) {
            const random = api.rng;
            const splitter = makeSplit();

            function union(list) {
              const box = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
              list.forEach(function (e) {
                box.minX = Math.min(box.minX, e.minX);
                box.minY = Math.min(box.minY, e.minY);
                box.maxX = Math.max(box.maxX, e.maxX);
                box.maxY = Math.max(box.maxY, e.maxY);
              });
              return box;
            }

            function overlap(a, b) {
              const w = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX);
              const h = Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY);
              return w > 0 && h > 0 ? w * h : 0;
            }

            let mine = 0;
            let naive = 0;
            for (let round = 0; round < 200; round += 1) {
              const entries = [];
              for (let i = 0; i < 9; i += 1) {
                const x = random.next() * 1000;
                const y = random.next() * 1000;
                const w = 1 + random.next() * 80;
                const h = 1 + random.next() * 80;
                entries.push({ id: i, minX: x, minY: y, maxX: x + w, maxY: y + h });
              }

              const groups = splitter.split(entries, 3);
              mine += overlap(union(groups[0]), union(groups[1]));
              const half = Math.ceil(entries.length / 2);
              naive += overlap(union(entries.slice(0, half)), union(entries.slice(half)));
            }

            api.assert.ok(mine < naive * 0.75,
              'total overlap ' + Math.round(mine) + ' against a naive split\'s ' + Math.round(naive));
          }
        },
        {
          name: 'two well-separated clusters end up in different groups',
          assert: function (makeSplit, api) {
            const entries = [];
            for (let i = 0; i < 4; i += 1) {
              entries.push({ id: 'L' + i, minX: i * 3, minY: 0, maxX: i * 3 + 2, maxY: 2 });
            }
            for (let i = 0; i < 4; i += 1) {
              entries.push({ id: 'R' + i, minX: 900 + i * 3, minY: 900, maxX: 902 + i * 3, maxY: 902 });
            }

            const groups = makeSplit().split(entries, 3);
            const sides = groups.map(function (group) {
              return group.every(function (e) { return e.id[0] === group[0].id[0]; });
            });
            api.assert.ok(sides[0] && sides[1], 'the seeds must be the two extremes, not two neighbours');
          }
        }
      ]
    }],

    'bounding-volumes': [{
      id: 'bvh-slab-and-traversal',
      title: 'The slab test, the axis-parallel ray, and the traversal stack',
      prompt: 'makeTracer(tree) must return { nearest, stats }. The tree is { box, left, right } for an ' +
        'internal node and { box, leaf: true, id } for a leaf, where a box is { min: [x,y,z], max: [x,y,z] }. ' +
        'nearest(ray) returns { id, t } for the leaf box the ray enters first, or null if it enters none; a ray ' +
        'is { origin: [x,y,z], direction: [x,y,z] }. Use the slab method, keep an explicit stack, and skip a ' +
        'node whose entry distance is already past the closest leaf found. The graded edge case is a direction ' +
        'component of exactly zero: the reciprocal is infinite, and if the origin sits on a slab plane the ' +
        'product is 0 × ∞ = NaN, every comparison against NaN is false, and the box silently disappears.',
      entry: 'makeTracer',
      starter: [
        'function makeTracer(tree) {',
        '  let nodesVisited = 0;',
        '',
        '  function slab(ray, box, tMax) {',
        '    let near = 0;',
        '    let far = tMax;',
        '    for (let axis = 0; axis < 3; axis += 1) {',
        '      const inverse = 1 / ray.direction[axis];',
        '      let entry = (box.min[axis] - ray.origin[axis]) * inverse;',
        '      let exit = (box.max[axis] - ray.origin[axis]) * inverse;',
        '      if (entry > exit) { const swap = entry; entry = exit; exit = swap; }',
        '      if (entry > near) near = entry;',
        '      if (exit < far) far = exit;',
        '      if (near > far) return null;',
        '    }',
        '    return near;',
        '  }',
        '',
        '  return {',
        '    nearest: function (ray) {',
        '      const stack = [tree];',
        '      while (stack.length) {',
        '        const node = stack.pop();',
        '        nodesVisited += 1;',
        '        const entry = slab(ray, node.box, Infinity);',
        '        if (entry === null) continue;',
        '        // returns the first leaf the ray enters, not the closest one',
        '        if (node.leaf) return { id: node.id, t: entry };',
        '        stack.push(node.left);',
        '        stack.push(node.right);',
        '      }',
        '      return null;',
        '    },',
        '    stats: function () { return { nodesVisited: nodesVisited }; }',
        '  };',
        '}'
      ].join('\n'),
      solution: [
        'function makeTracer(tree) {',
        '  const EPSILON = 1e-9;',
        '  let nodesVisited = 0;',
        '',
        '  function slab(ray, box, tMax) {',
        '    let near = 0;',
        '    let far = tMax;',
        '',
        '    for (let axis = 0; axis < 3; axis += 1) {',
        '      // the axis-parallel case, handled before the arithmetic that',
        '      // would produce 0 x Infinity = NaN and silently miss the box',
        '      if (Math.abs(ray.direction[axis]) < EPSILON) {',
        '        if (ray.origin[axis] < box.min[axis] || ray.origin[axis] > box.max[axis]) return null;',
        '        continue;',
        '      }',
        '      const inverse = 1 / ray.direction[axis];',
        '      let entry = (box.min[axis] - ray.origin[axis]) * inverse;',
        '      let exit = (box.max[axis] - ray.origin[axis]) * inverse;',
        '      if (entry > exit) { const swap = entry; entry = exit; exit = swap; }',
        '      if (entry > near) near = entry;',
        '      if (exit < far) far = exit;',
        '      if (near > far) return null;',
        '    }',
        '',
        '    return near;',
        '  }',
        '',
        '  return {',
        '    nearest: function (ray) {',
        '      const stack = [tree];',
        '      let best = null;',
        '',
        '      while (stack.length) {',
        '        const node = stack.pop();',
        '        nodesVisited += 1;',
        '        // re-test at pop time: the bound has usually tightened since',
        '        // the node was pushed',
        '        const entry = slab(ray, node.box, best ? best.t : Infinity);',
        '        if (entry === null) continue;',
        '        if (node.leaf) {',
        '          if (!best || entry < best.t) best = { id: node.id, t: entry };',
        '          continue;',
        '        }',
        '        stack.push(node.right);',
        '        stack.push(node.left);',
        '      }',
        '',
        '      return best;',
        '    },',
        '    stats: function () { return { nodesVisited: nodesVisited }; }',
        '  };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'an axis-parallel ray with its origin on a slab plane still hits',
          assert: function (makeTracer, api) {
            const box = { min: [0, 0, 0], max: [10, 10, 10] };
            const tracer = makeTracer({ box: box, leaf: true, id: 'cube' });

            const through = tracer.nearest({ origin: [-5, 5, 5], direction: [1, 0, 0] });
            api.assert.ok(through, 'a ray straight down +x through the middle must hit');
            api.assert.closeTo(through.t, 5, 1e-9);

            const onFace = tracer.nearest({ origin: [-5, 0, 5], direction: [1, 0, 0] });
            api.assert.ok(onFace, 'an origin exactly on the y = 0 plane is the 0 x Infinity = NaN case');
            api.assert.closeTo(onFace.t, 5, 1e-9);

            // a direction component of -0 flips the sign of the infinity and
            // turns the same case into a false miss
            const negativeZero = tracer.nearest({ origin: [-5, 0, 5], direction: [1, -0, 0] });
            api.assert.ok(negativeZero, 'a -0 direction component must not turn a hit into a miss');
            api.assert.closeTo(negativeZero.t, 5, 1e-9);

            const past = tracer.nearest({ origin: [-5, 20, 5], direction: [1, 0, 0] });
            api.assert.equal(past, null, 'and a parallel ray outside the slab must miss');
          }
        },
        {
          name: 'the traversal agrees with brute force over 300 rays',
          assert: function (makeTracer, api) {
            const random = api.rng;
            const boxes = [];
            for (let i = 0; i < 512; i += 1) {
              const c = [random.next() * 100, random.next() * 100, random.next() * 100];
              boxes.push({
                id: i,
                box: { min: [c[0], c[1], c[2]], max: [c[0] + 2, c[1] + 2, c[2] + 2] }
              });
            }

            function union(list) {
              const min = [Infinity, Infinity, Infinity];
              const max = [-Infinity, -Infinity, -Infinity];
              list.forEach(function (item) {
                for (let a = 0; a < 3; a += 1) {
                  min[a] = Math.min(min[a], item.box.min[a]);
                  max[a] = Math.max(max[a], item.box.max[a]);
                }
              });
              return { min: min, max: max };
            }

            function build(list, depth) {
              if (list.length === 1) return { box: list[0].box, leaf: true, id: list[0].id };
              const axis = depth % 3;
              const sorted = list.slice().sort(function (a, b) { return a.box.min[axis] - b.box.min[axis]; });
              const mid = sorted.length >> 1;
              return {
                box: union(list),
                left: build(sorted.slice(0, mid), depth + 1),
                right: build(sorted.slice(mid), depth + 1)
              };
            }

            function slab(ray, box) {
              let near = 0;
              let far = Infinity;
              for (let axis = 0; axis < 3; axis += 1) {
                if (Math.abs(ray.direction[axis]) < 1e-9) {
                  if (ray.origin[axis] < box.min[axis] || ray.origin[axis] > box.max[axis]) return null;
                  continue;
                }
                const inverse = 1 / ray.direction[axis];
                let entry = (box.min[axis] - ray.origin[axis]) * inverse;
                let exit = (box.max[axis] - ray.origin[axis]) * inverse;
                if (entry > exit) { const swap = entry; entry = exit; exit = swap; }
                if (entry > near) near = entry;
                if (exit < far) far = exit;
                if (near > far) return null;
              }
              return near;
            }

            const tracer = makeTracer(build(boxes, 0));
            for (let r = 0; r < 300; r += 1) {
              const origin = [random.next() * 100, random.next() * 100, -50];
              const target = [random.next() * 100, random.next() * 100, 150];
              const delta = [target[0] - origin[0], target[1] - origin[1], target[2] - origin[2]];
              const length = Math.sqrt(delta[0] * delta[0] + delta[1] * delta[1] + delta[2] * delta[2]);
              const ray = { origin: origin, direction: [delta[0] / length, delta[1] / length, delta[2] / length] };

              let truth = null;
              boxes.forEach(function (item) {
                const t = slab(ray, item.box);
                if (t !== null && (!truth || t < truth.t)) truth = { id: item.id, t: t };
              });

              const found = tracer.nearest(ray);
              if (!truth) { api.assert.equal(found, null, 'ray ' + r + ' should miss everything'); continue; }
              api.assert.ok(found, 'ray ' + r + ' should hit box ' + truth.id);
              api.assert.closeTo(found.t, truth.t, 1e-9, 'ray ' + r);
            }
          }
        },
        {
          name: 'the traversal prunes rather than visiting every node',
          assert: function (makeTracer, api) {
            const random = api.rng;
            const boxes = [];
            for (let i = 0; i < 512; i += 1) {
              const c = [random.next() * 100, random.next() * 100, random.next() * 100];
              boxes.push({ id: i, box: { min: [c[0], c[1], c[2]], max: [c[0] + 2, c[1] + 2, c[2] + 2] } });
            }

            function union(list) {
              const min = [Infinity, Infinity, Infinity];
              const max = [-Infinity, -Infinity, -Infinity];
              list.forEach(function (item) {
                for (let a = 0; a < 3; a += 1) {
                  min[a] = Math.min(min[a], item.box.min[a]);
                  max[a] = Math.max(max[a], item.box.max[a]);
                }
              });
              return { min: min, max: max };
            }

            function build(list, depth) {
              if (list.length === 1) return { box: list[0].box, leaf: true, id: list[0].id };
              const axis = depth % 3;
              const sorted = list.slice().sort(function (a, b) { return a.box.min[axis] - b.box.min[axis]; });
              const mid = sorted.length >> 1;
              return {
                box: union(list),
                left: build(sorted.slice(0, mid), depth + 1),
                right: build(sorted.slice(mid), depth + 1)
              };
            }

            const tracer = makeTracer(build(boxes, 0));
            for (let r = 0; r < 200; r += 1) {
              const origin = [random.next() * 100, random.next() * 100, -50];
              tracer.nearest({ origin: origin, direction: [0, 0, 1] });
            }

            const perRay = tracer.stats().nodesVisited / 200;
            api.assert.atMost(perRay, 300, 'a tree of 1 023 nodes must not be walked in full: ' + perRay.toFixed(1));
            api.assert.atLeast(perRay, 2, 'and it must visit something');
          }
        }
      ]
    }],

    'space-filling-curves': [{
      id: 'morton-and-hilbert',
      title: 'Interleave the bits, then walk the Hilbert curve',
      prompt: 'makeCurves() must return { morton, mortonDecode, hilbert }. morton(x, y) interleaves the bits of ' +
        'two 16-bit non-negative integers so that x contributes the even bit positions and y the odd ones; ' +
        'mortonDecode(code) returns { x, y } and must round-trip exactly. hilbert(x, y, order) returns the ' +
        'position of the cell (x, y) along the Hilbert curve of a 2^order × 2^order grid. The Hilbert index is ' +
        'graded on two properties: it is a bijection over the whole grid, and consecutive indices are always ' +
        'orthogonally adjacent cells - which is the property Z-order does not have.',
      entry: 'makeCurves',
      starter: [
        'function makeCurves() {',
        '  return {',
        '    morton: function (x, y) {',
        '      // not an interleave: this is just concatenation, and it round-trips',
        '      return ((y & 0xffff) * 65536 + (x & 0xffff)) >>> 0;',
        '    },',
        '    mortonDecode: function (code) {',
        '      return { x: code & 0xffff, y: (code >>> 16) & 0xffff };',
        '    },',
        '    hilbert: function (x, y, order) {',
        '      const side = 1 << order;',
        '      return y * side + x;',
        '    }',
        '  };',
        '}'
      ].join('\n'),
      solution: [
        'function makeCurves() {',
        '  function spread(n) {',
        '    let x = n & 0x0000ffff;',
        '    x = (x | (x << 8)) & 0x00ff00ff;',
        '    x = (x | (x << 4)) & 0x0f0f0f0f;',
        '    x = (x | (x << 2)) & 0x33333333;',
        '    x = (x | (x << 1)) & 0x55555555;',
        '    return x >>> 0;',
        '  }',
        '',
        '  function gather(n) {',
        '    let x = n & 0x55555555;',
        '    x = (x | (x >>> 1)) & 0x33333333;',
        '    x = (x | (x >>> 2)) & 0x0f0f0f0f;',
        '    x = (x | (x >>> 4)) & 0x00ff00ff;',
        '    x = (x | (x >>> 8)) & 0x0000ffff;',
        '    return x >>> 0;',
        '  }',
        '',
        '  return {',
        '    morton: function (x, y) {',
        '      return (spread(x) | (spread(y) << 1)) >>> 0;',
        '    },',
        '    mortonDecode: function (code) {',
        '      return { x: gather(code >>> 0), y: gather((code >>> 0) >>> 1) };',
        '    },',
        '    hilbert: function (x, y, order) {',
        '      const side = 1 << order;',
        '      let px = x;',
        '      let py = y;',
        '      let index = 0;',
        '',
        '      for (let step = side >> 1; step > 0; step >>= 1) {',
        '        const rx = (px & step) > 0 ? 1 : 0;',
        '        const ry = (py & step) > 0 ? 1 : 0;',
        '        index += step * step * ((3 * rx) ^ ry);',
        '        // the rotation is what keeps the curve continuous across a split',
        '        if (ry === 0) {',
        '          if (rx === 1) { px = side - 1 - px; py = side - 1 - py; }',
        '          const swap = px; px = py; py = swap;',
        '        }',
        '      }',
        '',
        '      return index;',
        '    }',
        '  };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'Morton round-trips for every coordinate in a 256 x 256 grid',
          assert: function (makeCurves, api) {
            const curves = makeCurves();
            for (let y = 0; y < 256; y += 1) {
              for (let x = 0; x < 256; x += 1) {
                const back = curves.mortonDecode(curves.morton(x, y));
                if (back.x !== x || back.y !== y) {
                  api.assert.ok(false, 'morton(' + x + ',' + y + ') decoded to (' + back.x + ',' + back.y + ')');
                }
              }
            }
          }
        },
        {
          name: 'Morton really interleaves, so a 2 x 2 block is four consecutive codes',
          assert: function (makeCurves, api) {
            const curves = makeCurves();
            api.assert.equal(curves.morton(0, 0), 0);
            api.assert.equal(curves.morton(1, 0), 1);
            api.assert.equal(curves.morton(0, 1), 2);
            api.assert.equal(curves.morton(1, 1), 3);
            api.assert.equal(curves.morton(3, 3), 15, 'the 2 x 2 quadrant at (2,2) ends at 15');
            api.assert.equal(curves.morton(5, 3), 27);
          }
        },
        {
          name: 'the Hilbert index is a bijection over the whole grid',
          assert: function (makeCurves, api) {
            const curves = makeCurves();
            const order = 6;
            const side = 1 << order;
            const seen = new Set();

            for (let y = 0; y < side; y += 1) {
              for (let x = 0; x < side; x += 1) {
                const index = curves.hilbert(x, y, order);
                api.assert.ok(index >= 0 && index < side * side, 'index ' + index + ' is outside the grid');
                api.assert.ok(!seen.has(index), 'index ' + index + ' was produced twice');
                seen.add(index);
              }
            }
            api.assert.equal(seen.size, side * side);
          }
        },
        {
          name: 'consecutive Hilbert indices are always adjacent cells',
          assert: function (makeCurves, api) {
            const curves = makeCurves();
            const order = 5;
            const side = 1 << order;
            const cells = new Array(side * side);

            for (let y = 0; y < side; y += 1) {
              for (let x = 0; x < side; x += 1) cells[curves.hilbert(x, y, order)] = { x: x, y: y };
            }

            for (let i = 1; i < cells.length; i += 1) {
              const step = Math.abs(cells[i].x - cells[i - 1].x) + Math.abs(cells[i].y - cells[i - 1].y);
              api.assert.equal(step, 1,
                'step ' + i + ' moved from (' + cells[i - 1].x + ',' + cells[i - 1].y + ') to (' +
                cells[i].x + ',' + cells[i].y + ')');
            }
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));

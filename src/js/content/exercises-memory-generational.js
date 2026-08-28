/**
 * Graded exercises for copying, incremental and modern collectors (M31.4-M31.6).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'generational-collection': [{
      id: 'cheney-and-the-barrier',
      title: 'Cheney\'s collector, and the barrier it cannot work without',
      prompt: 'A heap is { cells: { id: { refs: [], age, size } }, roots: [], remembered: [] }. ' +
        'Write store(heap, from, index, to) which performs the store AND records `from` in ' +
        'heap.remembered when an OLD object (age >= 2) is given a reference to a YOUNG one, ' +
        'and minor(heap) which copies the young survivors reachable from heap.roots plus ' +
        'heap.remembered, ages them, frees the young objects it did not reach, and returns ' +
        '{ reclaimed, survivors, copied }. The trap is the roots: an old object among them ' +
        'must be SCANNED and not copied, because the same filter that keeps it out of the ' +
        'collection set would otherwise stop the collector following its references into the ' +
        'nursery. The starter runs every root through the filter, so as soon as the long-lived ' +
        'container ages past the threshold, everything it holds is freed.',
      entry: 'lab',
      starter: [
        'const PROMOTE_AFTER = 2;',
        '',
        'function isYoung(cell) {',
        '  return cell.age < PROMOTE_AFTER;',
        '}',
        '',
        'function store(heap, from, index, to) {',
        '  const cell = heap.cells[from];',
        '',
        '  if (!cell) return false;',
        '  while (cell.refs.length <= index) cell.refs.push(null);',
        '  cell.refs[index] = to;',
        '  // No barrier at all: an old object pointing into the nursery is never',
        '  // recorded, so the next minor collection does not know about it.',
        '  return false;',
        '}',
        '',
        'function minor(heap) {',
        '  const moved = {};',
        '  const order = [];',
        '  let copied = 0;',
        '',
        '  // Every root goes through the young filter, including the old ones.',
        '  heap.roots.concat(heap.remembered || []).forEach(function (id) {',
        '    copied += forward(heap, id, moved, order);',
        '  });',
        '  copied += drain(heap, moved, order);',
        '  return finish(heap, order, copied);',
        '}',
        '',
        'function forward(heap, id, moved, order) {',
        '  const cell = heap.cells[id];',
        '',
        '  if (!cell || moved[id]) return 0;',
        '  moved[id] = true;',
        '  if (!isYoung(cell)) return 0;',
        '  order.push(id);',
        '  return cell.size;',
        '}',
        '',
        'function drain(heap, moved, order) {',
        '  let scan = 0;',
        '  let copied = 0;',
        '',
        '  while (scan < order.length) {',
        '    const cell = heap.cells[order[scan]];',
        '',
        '    scan += 1;',
        '    cell.refs.forEach(function (child) {',
        '      if (child === null || child === undefined) return;',
        '      copied += forward(heap, child, moved, order);',
        '    });',
        '  }',
        '  return copied;',
        '}',
        '',
        'function finish(heap, order, copied) {',
        '  const survivors = {};',
        '  const reclaimed = [];',
        '',
        '  order.forEach(function (id) { survivors[id] = true; });',
        '  Object.keys(heap.cells).forEach(function (key) {',
        '    const id = Number(key);',
        '',
        '    if (!isYoung(heap.cells[id]) || survivors[id]) return;',
        '    reclaimed.push(id);',
        '  });',
        '  reclaimed.forEach(function (id) { delete heap.cells[id]; });',
        '  order.forEach(function (id) { heap.cells[id].age += 1; });',
        '  heap.remembered = [];',
        '  return { reclaimed: reclaimed, survivors: order.slice(), copied: copied };',
        '}',
        '',
        'function lab() {',
        '  return { store: store, minor: minor, isYoung: isYoung,',
        '    PROMOTE_AFTER: PROMOTE_AFTER };',
        '}'
      ].join('\n'),
      solution: [
        'const PROMOTE_AFTER = 2;',
        '',
        'function isYoung(cell) {',
        '  return cell.age < PROMOTE_AFTER;',
        '}',
        '',
        'function store(heap, from, index, to) {',
        '  const cell = heap.cells[from];',
        '  const target = to === null || to === undefined ? null : heap.cells[to];',
        '',
        '  if (!cell) return false;',
        '  while (cell.refs.length <= index) cell.refs.push(null);',
        '  cell.refs[index] = to;',
        '  if (!target || isYoung(cell) || !isYoung(target)) return false;',
        '  if (heap.remembered.indexOf(from) === -1) heap.remembered.push(from);',
        '  return true;',
        '}',
        '',
        'function minor(heap) {',
        '  const moved = {};',
        '  const order = [];',
        '  const scanned = {};',
        '  let copied = 0;',
        '',
        '  heap.roots.concat(heap.remembered || []).forEach(function (id) {',
        '    copied += enterRoot(heap, id, moved, order, scanned);',
        '  });',
        '  copied += drain(heap, moved, order);',
        '  return finish(heap, order, copied);',
        '}',
        '',
        '// A root outside the collected generation is scanned, never copied.',
        'function enterRoot(heap, id, moved, order, scanned) {',
        '  const cell = heap.cells[id];',
        '  let copied = 0;',
        '',
        '  if (!cell) return 0;',
        '  if (isYoung(cell)) return forward(heap, id, moved, order);',
        '  if (scanned[id]) return 0;',
        '  scanned[id] = true;',
        '  cell.refs.forEach(function (child) {',
        '    if (child === null || child === undefined) return;',
        '    copied += forward(heap, child, moved, order);',
        '  });',
        '  return copied;',
        '}',
        '',
        'function forward(heap, id, moved, order) {',
        '  const cell = heap.cells[id];',
        '',
        '  if (!cell || moved[id]) return 0;',
        '  moved[id] = true;',
        '  if (!isYoung(cell)) return 0;',
        '  order.push(id);',
        '  return cell.size;',
        '}',
        '',
        'function drain(heap, moved, order) {',
        '  let scan = 0;',
        '  let copied = 0;',
        '',
        '  while (scan < order.length) {',
        '    const cell = heap.cells[order[scan]];',
        '',
        '    scan += 1;',
        '    cell.refs.forEach(function (child) {',
        '      if (child === null || child === undefined) return;',
        '      copied += forward(heap, child, moved, order);',
        '    });',
        '  }',
        '  return copied;',
        '}',
        '',
        'function finish(heap, order, copied) {',
        '  const survivors = {};',
        '  const reclaimed = [];',
        '',
        '  order.forEach(function (id) { survivors[id] = true; });',
        '  Object.keys(heap.cells).forEach(function (key) {',
        '    const id = Number(key);',
        '',
        '    if (!isYoung(heap.cells[id]) || survivors[id]) return;',
        '    reclaimed.push(id);',
        '  });',
        '  reclaimed.forEach(function (id) { delete heap.cells[id]; });',
        '  order.forEach(function (id) { heap.cells[id].age += 1; });',
        '  heap.remembered = refresh(heap);',
        '  return { reclaimed: reclaimed, survivors: order.slice(), copied: copied };',
        '}',
        '',
        '// An entry whose young referent merely SURVIVED still crosses, and no',
        '// further store will re-record it.',
        'function refresh(heap) {',
        '  return Object.keys(heap.cells).map(Number).filter(function (id) {',
        '    const cell = heap.cells[id];',
        '',
        '    if (isYoung(cell)) return false;',
        '    return cell.refs.some(function (child) {',
        '      const target = heap.cells[child];',
        '',
        '      return Boolean(target) && isYoung(target);',
        '    });',
        '  });',
        '}',
        '',
        'function lab() {',
        '  return { store: store, minor: minor, isYoung: isYoung,',
        '    PROMOTE_AFTER: PROMOTE_AFTER };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'an old object holding a young one keeps it alive',
          assert: function (lab, api) {
            const parts = lab();
            const heap = { roots: [0], remembered: [], cells: {
              0: { refs: [], age: 5, size: 16 },
              1: { refs: [], age: 0, size: 16 },
              2: { refs: [], age: 0, size: 16 }
            } };

            parts.store(heap, 0, 0, 1);
            const out = parts.minor(heap);

            api.assert.ok(heap.cells[1], 'the young object held by an old root survived');
            api.assert.deepEqual(out.reclaimed, [2], 'and only the unreachable one went');
          }
        },
        {
          name: 'a survivor stays reachable across a second collection',
          assert: function (lab, api) {
            const parts = lab();
            const heap = { roots: [0], remembered: [], cells: {
              0: { refs: [], age: 5, size: 16 },
              1: { refs: [], age: 0, size: 16 }
            } };

            parts.store(heap, 0, 0, 1);
            parts.minor(heap);
            api.assert.ok(heap.cells[1], 'it survived the first collection');
            parts.minor(heap);
            api.assert.ok(heap.cells[1],
              'and the second — clearing the record loses it here');
          }
        },
        {
          name: 'no reachable object is freed over randomised heaps',
          assert: function (lab, api) {
            const parts = lab();

            for (let run = 0; run < 40; run += 1) {
              const size = 6 + Math.floor(api.rng.next() * 6);
              const heap = { roots: [0], remembered: [], cells: {} };

              for (let id = 0; id < size; id += 1) {
                heap.cells[id] = { refs: [], age: id === 0 ? 5 : 0, size: 16 };
              }
              for (let at = 0; at < size; at += 1) {
                parts.store(heap, Math.floor(api.rng.next() * size),
                  Math.floor(api.rng.next() * 2), Math.floor(api.rng.next() * size));
              }
              const live = [];
              const queue = heap.roots.slice();

              while (queue.length) {
                const id = queue.shift();

                if (live.indexOf(id) !== -1 || !heap.cells[id]) continue;
                live.push(id);
                heap.cells[id].refs.forEach(function (child) { queue.push(child); });
              }
              parts.minor(heap);
              live.forEach(function (id) {
                api.assert.ok(heap.cells[id],
                  'reachable object ' + id + ' was freed on run ' + run);
              });
            }
          }
        }
      ]
    }],

    'incremental-collection': [{
      id: 'dijkstra-barrier',
      title: 'The barrier that stops the object being lost',
      prompt: 'A state is { cells: { id: { refs: [], colour } }, roots: [], grey: [], ' +
        'marking }. Write begin(state) which whitens everything and shades the roots grey, ' +
        'step(state, budget) which pops up to `budget` grey objects, blackens them and shades ' +
        'their children, store(state, from, index, to) which performs the store AND maintains ' +
        'the tri-colour invariant while marking, and finish(state) which frees the white cells ' +
        'and returns { reclaimed }. The starter\'s store is a plain assignment, so a reference ' +
        'written into an already-black object is never followed and the object it names is ' +
        'freed while live.',
      entry: 'lab',
      starter: [
        'function begin(state) {',
        '  Object.keys(state.cells).forEach(function (id) {',
        '    state.cells[id].colour = "white";',
        '  });',
        '  state.grey = [];',
        '  state.marking = true;',
        '  state.roots.forEach(function (id) { shade(state, id); });',
        '  return state;',
        '}',
        '',
        'function shade(state, id) {',
        '  const cell = state.cells[id];',
        '',
        '  if (!cell || cell.colour !== "white") return false;',
        '  cell.colour = "grey";',
        '  state.grey.push(id);',
        '  return true;',
        '}',
        '',
        'function step(state, budget) {',
        '  let done = 0;',
        '',
        '  while (state.grey.length && done < budget) {',
        '    const cell = state.cells[state.grey.pop()];',
        '',
        '    done += 1;',
        '    if (!cell) continue;',
        '    cell.colour = "black";',
        '    cell.refs.forEach(function (child) {',
        '      if (child !== null && child !== undefined) shade(state, child);',
        '    });',
        '  }',
        '  if (!state.grey.length) state.marking = false;',
        '  return { scanned: done, remaining: state.grey.length };',
        '}',
        '',
        'function store(state, from, index, to) {',
        '  const cell = state.cells[from];',
        '',
        '  if (!cell) return false;',
        '  while (cell.refs.length <= index) cell.refs.push(null);',
        '  // A plain assignment. If `from` is already black the marker will never',
        '  // look at it again, so `to` is never reached.',
        '  cell.refs[index] = to;',
        '  return true;',
        '}',
        '',
        'function finish(state) {',
        '  const reclaimed = [];',
        '',
        '  Object.keys(state.cells).forEach(function (key) {',
        '    if (state.cells[key].colour === "white") reclaimed.push(Number(key));',
        '  });',
        '  reclaimed.forEach(function (id) { delete state.cells[id]; });',
        '  state.marking = false;',
        '  return { reclaimed: reclaimed };',
        '}',
        '',
        'function lab() {',
        '  return { begin: begin, shade: shade, step: step, store: store, finish: finish };',
        '}'
      ].join('\n'),
      solution: [
        'function begin(state) {',
        '  Object.keys(state.cells).forEach(function (id) {',
        '    state.cells[id].colour = "white";',
        '  });',
        '  state.grey = [];',
        '  state.marking = true;',
        '  state.roots.forEach(function (id) { shade(state, id); });',
        '  return state;',
        '}',
        '',
        'function shade(state, id) {',
        '  const cell = state.cells[id];',
        '',
        '  if (!cell || cell.colour !== "white") return false;',
        '  cell.colour = "grey";',
        '  state.grey.push(id);',
        '  return true;',
        '}',
        '',
        'function step(state, budget) {',
        '  let done = 0;',
        '',
        '  while (state.grey.length && done < budget) {',
        '    const cell = state.cells[state.grey.pop()];',
        '',
        '    done += 1;',
        '    if (!cell) continue;',
        '    cell.colour = "black";',
        '    cell.refs.forEach(function (child) {',
        '      if (child !== null && child !== undefined) shade(state, child);',
        '    });',
        '  }',
        '  if (!state.grey.length) state.marking = false;',
        '  return { scanned: done, remaining: state.grey.length };',
        '}',
        '',
        '// Dijkstra: when a BLACK object is given a WHITE child, shade the child.',
        '// That single rule is the whole of the correctness argument.',
        'function store(state, from, index, to) {',
        '  const cell = state.cells[from];',
        '',
        '  if (!cell) return false;',
        '  while (cell.refs.length <= index) cell.refs.push(null);',
        '  cell.refs[index] = to;',
        '  if (!state.marking) return true;',
        '  if (cell.colour === "black" && to !== null && to !== undefined) shade(state, to);',
        '  return true;',
        '}',
        '',
        'function finish(state) {',
        '  const reclaimed = [];',
        '',
        '  Object.keys(state.cells).forEach(function (key) {',
        '    if (state.cells[key].colour === "white") reclaimed.push(Number(key));',
        '  });',
        '  reclaimed.forEach(function (id) { delete state.cells[id]; });',
        '  state.marking = false;',
        '  return { reclaimed: reclaimed };',
        '}',
        '',
        'function lab() {',
        '  return { begin: begin, shade: shade, step: step, store: store, finish: finish };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the black-to-white store does not lose the object',
          assert: function (lab, api) {
            const parts = lab();
            const state = { roots: [0, 1], grey: [], marking: false, cells: {
              0: { refs: [], colour: 'white' },
              1: { refs: [2], colour: 'white' },
              2: { refs: [], colour: 'white' }
            } };

            parts.begin(state);
            /* Force the ordering: scan the container to completion first, so it
               is black, and only then perform the store and drop the holder. */
            while (state.cells[0].colour !== 'black') parts.step(state, 1);
            parts.store(state, 0, 0, 2);
            parts.store(state, 1, 0, null);
            while (state.marking) parts.step(state, 4);
            parts.finish(state);

            api.assert.ok(state.cells[2], 'the value the black object holds survived');
          }
        },
        {
          name: 'no live object is lost across randomised interleavings',
          assert: function (lab, api) {
            const parts = lab();

            for (let run = 0; run < 200; run += 1) {
              const size = 8 + Math.floor(api.rng.next() * 5);
              const state = { roots: [0], grey: [], marking: false, cells: {} };

              for (let id = 0; id < size; id += 1) {
                state.cells[id] = { refs: [], colour: 'white' };
              }
              for (let id = 0; id < size; id += 1) {
                const fan = Math.floor(api.rng.next() * 3);

                for (let at = 0; at < fan; at += 1) {
                  state.cells[id].refs.push(Math.floor(api.rng.next() * size));
                }
              }
              state.roots.push(1 + Math.floor(api.rng.next() * (size - 1)));
              parts.begin(state);
              let made = 0;
              let guard = 0;

              while (state.marking && guard < 300) {
                guard += 1;
                if (made < 6 && api.rng.next() < 0.5) {
                  made += 1;
                  const reach = [];
                  const queue = state.roots.slice();

                  while (queue.length) {
                    const id = queue.shift();

                    if (reach.indexOf(id) !== -1 || !state.cells[id]) continue;
                    reach.push(id);
                    state.cells[id].refs.forEach(function (c) { queue.push(c); });
                  }
                  /* Both ends are drawn from what the program can currently
                     reach: a mutator cannot store into an object it cannot
                     reach, nor publish a reference it does not hold. */
                  const from = reach[Math.floor(api.rng.next() * reach.length)];
                  const to = api.rng.next() < 0.15 ? null
                    : reach[Math.floor(api.rng.next() * reach.length)];

                  parts.store(state, from, Math.floor(api.rng.next() * 2), to);
                  continue;
                }
                parts.step(state, 1);
              }
              const live = [];
              const queue = state.roots.slice();

              while (queue.length) {
                const id = queue.shift();

                if (live.indexOf(id) !== -1 || !state.cells[id]) continue;
                live.push(id);
                state.cells[id].refs.forEach(function (c) { queue.push(c); });
              }
              const out = parts.finish(state);

              out.reclaimed.forEach(function (id) {
                api.assert.equal(live.indexOf(id), -1,
                  'freed live object ' + id + ' on run ' + run);
              });
            }
          }
        }
      ]
    }],

    'modern-collectors': [{
      id: 'garbage-first',
      title: 'Choose the collection set within a pause budget',
      prompt: 'A region is { region, live, garbage }. Write rank(regions) returning them ' +
        'sorted by garbage reclaimed per byte copied — a region with nothing live sorts first, ' +
        'whatever its garbage — and select(regions, budget) which takes regions in that order ' +
        'while the copying cost stays within `budget`, returning { regions, copied, ' +
        'reclaimed }. A region larger than the whole budget must be skipped rather than ' +
        'ending the selection, because a later, smaller one may still fit. The starter stops ' +
        'at the first region that does not fit, which throws away everything behind it.',
      entry: 'lab',
      starter: [
        'function ratio(row) {',
        '  return row.live === 0 ? Infinity : row.garbage / row.live;',
        '}',
        '',
        'function rank(regions) {',
        '  return regions.slice().sort(function (a, b) {',
        '    if (ratio(b) !== ratio(a)) return ratio(b) - ratio(a);',
        '    return b.garbage - a.garbage;',
        '  });',
        '}',
        '',
        'function select(regions, budget) {',
        '  const ranked = rank(regions);',
        '  const chosen = [];',
        '  let copied = 0;',
        '  let reclaimed = 0;',
        '',
        '  for (let at = 0; at < ranked.length; at += 1) {',
        '    // Stopping here discards every region behind the first one that',
        '    // does not fit, however small those are.',
        '    if (copied + ranked[at].live > budget) break;',
        '    chosen.push(ranked[at].region);',
        '    copied += ranked[at].live;',
        '    reclaimed += ranked[at].garbage;',
        '  }',
        '  return { regions: chosen, copied: copied, reclaimed: reclaimed };',
        '}',
        '',
        'function lab() {',
        '  return { ratio: ratio, rank: rank, select: select };',
        '}'
      ].join('\n'),
      solution: [
        'function ratio(row) {',
        '  return row.live === 0 ? Infinity : row.garbage / row.live;',
        '}',
        '',
        'function rank(regions) {',
        '  return regions.slice().sort(function (a, b) {',
        '    if (ratio(b) !== ratio(a)) return ratio(b) - ratio(a);',
        '    return b.garbage - a.garbage;',
        '  });',
        '}',
        '',
        'function select(regions, budget) {',
        '  const ranked = rank(regions);',
        '  const chosen = [];',
        '  let copied = 0;',
        '  let reclaimed = 0;',
        '',
        '  ranked.forEach(function (row) {',
        '    if (copied + row.live > budget) return;',
        '    chosen.push(row.region);',
        '    copied += row.live;',
        '    reclaimed += row.garbage;',
        '  });',
        '  return { regions: chosen, copied: copied, reclaimed: reclaimed };',
        '}',
        '',
        'function lab() {',
        '  return { ratio: ratio, rank: rank, select: select };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'a wholly dead region is free and sorts first',
          assert: function (lab, api) {
            const parts = lab();
            const rows = [
              { region: 0, live: 40, garbage: 200 },
              { region: 1, live: 0, garbage: 10 },
              { region: 2, live: 10, garbage: 30 }
            ];
            const ranked = parts.rank(rows);

            api.assert.equal(ranked[0].region, 1,
              'nothing live means nothing to copy and everything returned');
            const out = parts.select(rows, 0);

            api.assert.deepEqual(out.regions, [1], 'and it fits in a budget of zero');
            api.assert.equal(out.copied, 0);
          }
        },
        {
          name: 'a region that does not fit is skipped, not a stopping point',
          assert: function (lab, api) {
            const parts = lab();
            const rows = [
              { region: 0, live: 90, garbage: 200 },
              { region: 1, live: 10, garbage: 20 },
              { region: 2, live: 10, garbage: 15 }
            ];
            const out = parts.select(rows, 20);

            api.assert.equal(out.copied <= 20, true, 'the budget is respected');
            api.assert.equal(out.regions.length, 2,
              'the two small regions behind the oversized one are still taken');
            api.assert.equal(out.reclaimed, 35);
          }
        },
        {
          name: 'the budget is never exceeded over randomised region sets',
          assert: function (lab, api) {
            const parts = lab();

            for (let run = 0; run < 60; run += 1) {
              const rows = [];
              const count = 4 + Math.floor(api.rng.next() * 8);

              for (let at = 0; at < count; at += 1) {
                rows.push({ region: at, live: Math.floor(api.rng.next() * 60),
                  garbage: Math.floor(api.rng.next() * 200) });
              }
              const budget = 20 + Math.floor(api.rng.next() * 120);
              const out = parts.select(rows, budget);
              const byId = {};

              rows.forEach(function (row) { byId[row.region] = row; });
              let copied = 0;
              let reclaimed = 0;

              out.regions.forEach(function (id) {
                copied += byId[id].live;
                reclaimed += byId[id].garbage;
              });
              api.assert.ok(copied <= budget, 'over budget on run ' + run);
              api.assert.equal(out.copied, copied, 'the reported copying cost is real');
              api.assert.equal(out.reclaimed, reclaimed, 'and so is the reclaimed total');
            }
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));

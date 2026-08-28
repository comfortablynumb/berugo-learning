/**
 * Graded exercises for the landscape, counting and tracing (M31.1-M31.3).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'memory-management-landscape': [{
      id: 'quarantine-detector',
      title: 'Build the use-after-free detector',
      prompt: 'Write makeAllocator(quarantine) returning the detector state, and alloc(state, ' +
        'size), free(state, handle, at) and read(state, handle, offset, at). A handle is ' +
        '{ address, generation } — the generation is the oracle and the program only ever uses ' +
        'the address. `free` must POISON the block\'s bytes and queue it; a block leaves the ' +
        'queue only once `quarantine` further frees have happened, and only then may its ' +
        'address be reused. `read` returns { value, fault } where `fault` names the block and ' +
        'the step it was freed at, if the block is still in quarantine. The starter reuses an ' +
        'address immediately, so every use-after-free returns a plausible value and nothing is ' +
        'reported.',
      entry: 'lab',
      starter: [
        'const POISON = 0xdeadbeef;',
        '',
        'function makeAllocator(quarantine) {',
        '  return { quarantine: quarantine || 0, blocks: {}, pending: [], available: [],',
        '    next: 1, faults: [] };',
        '}',
        '',
        'function alloc(state, size) {',
        '  const recycled = state.available.shift() || null;',
        '  const address = recycled === null ? state.next : recycled.address;',
        '',
        '  if (recycled === null) state.next += size;',
        '  const generation = recycled === null ? 1 : recycled.generation + 1;',
        '',
        '  state.blocks[address] = { address: address, size: size, status: "live",',
        '    bytes: new Array(size).fill(0), freedAt: 0, generation: generation };',
        '  return { address: address, generation: generation };',
        '}',
        '',
        'function free(state, handle, at) {',
        '  const block = state.blocks[handle.address];',
        '',
        '  if (!block || block.status !== "live") return null;',
        '  block.status = "freed";',
        '  block.freedAt = at;',
        '  // No poison and no quarantine: the address goes straight back.',
        '  state.available.push({ address: block.address, generation: block.generation });',
        '  return null;',
        '}',
        '',
        'function read(state, handle, offset, at) {',
        '  const block = state.blocks[handle.address];',
        '',
        '  if (!block) return { value: null, fault: null };',
        '  return { value: block.bytes[offset || 0], fault: null };',
        '}',
        '',
        'function lab() {',
        '  return { makeAllocator: makeAllocator, alloc: alloc, free: free, read: read,',
        '    POISON: POISON };',
        '}'
      ].join('\n'),
      solution: [
        'const POISON = 0xdeadbeef;',
        '',
        'function makeAllocator(quarantine) {',
        '  return { quarantine: quarantine || 0, blocks: {}, pending: [], available: [],',
        '    next: 1, faults: [] };',
        '}',
        '',
        'function alloc(state, size) {',
        '  const at = state.available.findIndex(function (row) { return row.size >= size; });',
        '  const recycled = at === -1 ? null : state.available.splice(at, 1)[0];',
        '  const address = recycled === null ? state.next : recycled.address;',
        '  const generation = recycled === null ? 1 : recycled.generation + 1;',
        '',
        '  if (recycled === null) state.next += size;',
        '  state.blocks[address] = { address: address, size: size, status: "live",',
        '    bytes: new Array(size).fill(0), freedAt: 0, generation: generation };',
        '  return { address: address, generation: generation };',
        '}',
        '',
        'function retire(state) {',
        '  while (state.pending.length > state.quarantine) {',
        '    const address = state.pending.shift();',
        '    const block = state.blocks[address];',
        '',
        '    if (!block) continue;',
        '    block.status = "retired";',
        '    state.available.push({ address: address, size: block.size,',
        '      generation: block.generation });',
        '  }',
        '}',
        '',
        'function free(state, handle, at) {',
        '  const block = state.blocks[handle.address];',
        '',
        '  if (!block) return null;',
        '  if (block.status === "freed") {',
        '    const row = { kind: "double-free", address: handle.address, at: at,',
        '      freedAt: block.freedAt };',
        '',
        '    state.faults.push(row);',
        '    return row;',
        '  }',
        '  if (block.generation !== handle.generation) return null;',
        '  block.status = "freed";',
        '  block.freedAt = at;',
        '  block.bytes = block.bytes.map(function () { return POISON; });',
        '  state.pending.push(block.address);',
        '  retire(state);',
        '  return null;',
        '}',
        '',
        'function read(state, handle, offset, at) {',
        '  const block = state.blocks[handle.address];',
        '',
        '  if (!block) return { value: null, fault: null };',
        '  const value = block.bytes[offset || 0];',
        '',
        '  if (block.status === "live" && block.generation === handle.generation) {',
        '    return { value: value, fault: null };',
        '  }',
        '  if (block.status !== "freed") return { value: value, fault: null };',
        '  const row = { kind: "use-after-free", address: handle.address, at: at,',
        '    freedAt: block.freedAt };',
        '',
        '  state.faults.push(row);',
        '  return { value: value, fault: row };',
        '}',
        '',
        'function lab() {',
        '  return { makeAllocator: makeAllocator, alloc: alloc, free: free, read: read,',
        '    POISON: POISON };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'a read after a free is named while the block is in quarantine',
          assert: function (lab, api) {
            const parts = lab();
            const state = parts.makeAllocator(4);
            const a = parts.alloc(state, 4);

            parts.free(state, a, 1);
            const out = parts.read(state, a, 0, 2);

            api.assert.ok(out.fault, 'the read after the free is reported');
            api.assert.equal(out.fault.freedAt, 1, 'and it names the step it was freed at');
            api.assert.equal(out.value, parts.POISON, 'the bytes were poisoned');
          }
        },
        {
          name: 'with no quarantine the address is reused and the fault goes silent',
          assert: function (lab, api) {
            const parts = lab();
            const state = parts.makeAllocator(0);
            const a = parts.alloc(state, 4);

            parts.free(state, a, 1);
            const b = parts.alloc(state, 4);

            api.assert.equal(b.address, a.address, 'the address really was handed out again');
            api.assert.ok(b.generation > a.generation, 'and the generation says so');
            api.assert.equal(parts.read(state, a, 0, 3).fault, null,
              'so the stale read cannot be named — this is the limit of the technique');
          }
        },
        {
          name: 'freeing twice is reported, and a deeper quarantine catches more',
          assert: function (lab, api) {
            const parts = lab();
            const state = parts.makeAllocator(4);
            const a = parts.alloc(state, 4);

            parts.free(state, a, 1);
            api.assert.ok(parts.free(state, a, 2), 'the second free is a fault');

            const deep = parts.makeAllocator(8);
            const handles = [];
            let caught = 0;

            for (let at = 0; at < 6; at += 1) handles.push(parts.alloc(deep, 4));
            handles.forEach(function (handle, at) { parts.free(deep, handle, at + 1); });
            handles.forEach(function (handle, at) {
              if (parts.read(deep, handle, 0, 20 + at).fault) caught += 1;
            });
            api.assert.equal(caught, 6, 'a quarantine deeper than the run catches every one');
          }
        }
      ]
    }],

    'reference-counting': [{
      id: 'trial-deletion',
      title: 'Collect the cycle a count cannot see',
      prompt: 'A heap is { cells: { id: { refs: [], count } }, roots: [] }. Write ' +
        'subgraph(heap, id) returning the set of ids reachable from `id` (as an array), ' +
        'externallyReferenced(heap, group) returning true if any member\'s count exceeds the ' +
        'references coming from INSIDE the group or if any member is a root, and ' +
        'collectCycles(heap, candidates) which reclaims every candidate group that is not ' +
        'externally referenced and returns { reclaimed, groups, work }. The starter reclaims a ' +
        'group whenever no member is a root, which frees live objects the moment anything ' +
        'outside the group points in.',
      entry: 'lab',
      starter: [
        'function subgraph(heap, id) {',
        '  const group = [];',
        '  const queue = [id];',
        '',
        '  while (queue.length) {',
        '    const here = queue.shift();',
        '',
        '    if (group.indexOf(here) !== -1 || !heap.cells[here]) continue;',
        '    group.push(here);',
        '    heap.cells[here].refs.forEach(function (child) {',
        '      if (child !== null && child !== undefined) queue.push(child);',
        '    });',
        '  }',
        '  return group;',
        '}',
        '',
        'function externallyReferenced(heap, group) {',
        '  // Only the roots are consulted, so a reference from an ordinary live object',
        '  // outside the group is invisible and the group is freed while reachable.',
        '  return group.some(function (id) { return heap.roots.indexOf(id) !== -1; });',
        '}',
        '',
        'function collectCycles(heap, candidates) {',
        '  const reclaimed = [];',
        '  let work = 0;',
        '',
        '  candidates.forEach(function (id) {',
        '    if (!heap.cells[id]) return;',
        '    const group = subgraph(heap, id);',
        '',
        '    work += group.length;',
        '    if (externallyReferenced(heap, group)) return;',
        '    group.forEach(function (member) {',
        '      if (!heap.cells[member]) return;',
        '      reclaimed.push(member);',
        '      delete heap.cells[member];',
        '    });',
        '  });',
        '  return { reclaimed: reclaimed, groups: candidates.length, work: work };',
        '}',
        '',
        'function lab() {',
        '  return { subgraph: subgraph, externallyReferenced: externallyReferenced,',
        '    collectCycles: collectCycles };',
        '}'
      ].join('\n'),
      solution: [
        'function subgraph(heap, id) {',
        '  const group = [];',
        '  const queue = [id];',
        '',
        '  while (queue.length) {',
        '    const here = queue.shift();',
        '',
        '    if (group.indexOf(here) !== -1 || !heap.cells[here]) continue;',
        '    group.push(here);',
        '    heap.cells[here].refs.forEach(function (child) {',
        '      if (child !== null && child !== undefined) queue.push(child);',
        '    });',
        '  }',
        '  return group;',
        '}',
        '',
        'function internalCounts(heap, group) {',
        '  const internal = {};',
        '',
        '  group.forEach(function (id) { internal[id] = 0; });',
        '  group.forEach(function (id) {',
        '    heap.cells[id].refs.forEach(function (child) {',
        '      if (internal[child] !== undefined) internal[child] += 1;',
        '    });',
        '  });',
        '  return internal;',
        '}',
        '',
        'function externallyReferenced(heap, group) {',
        '  const internal = internalCounts(heap, group);',
        '',
        '  return group.some(function (id) {',
        '    if (heap.roots.indexOf(id) !== -1) return true;',
        '    return heap.cells[id].count - internal[id] > 0;',
        '  });',
        '}',
        '',
        'function collectCycles(heap, candidates) {',
        '  const reclaimed = [];',
        '  let work = 0;',
        '',
        '  candidates.forEach(function (id) {',
        '    if (!heap.cells[id]) return;',
        '    const group = subgraph(heap, id);',
        '',
        '    work += group.length;',
        '    if (externallyReferenced(heap, group)) return;',
        '    group.forEach(function (member) {',
        '      if (!heap.cells[member]) return;',
        '      reclaimed.push(member);',
        '      delete heap.cells[member];',
        '    });',
        '  });',
        '  return { reclaimed: reclaimed, groups: candidates.length, work: work };',
        '}',
        '',
        'function lab() {',
        '  return { subgraph: subgraph, externallyReferenced: externallyReferenced,',
        '    collectCycles: collectCycles };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'a cycle nothing can reach is reclaimed',
          assert: function (lab, api) {
            const parts = lab();
            const heap = { roots: [2], cells: {
              0: { refs: [1], count: 1 },
              1: { refs: [0], count: 1 },
              2: { refs: [], count: 1 }
            } };
            const out = parts.collectCycles(heap, [0]);

            api.assert.equal(out.reclaimed.length, 2, 'both members of the cycle go');
            api.assert.ok(!heap.cells[0] && !heap.cells[1], 'and they leave the heap');
            api.assert.ok(heap.cells[2], 'the object outside the cycle is untouched');
          }
        },
        {
          name: 'a cycle something outside points into is left alone',
          assert: function (lab, api) {
            const parts = lab();
            const heap = { roots: [2], cells: {
              0: { refs: [1], count: 2 },
              1: { refs: [0], count: 1 },
              2: { refs: [0], count: 1 }
            } };
            const out = parts.collectCycles(heap, [0]);

            api.assert.equal(out.reclaimed.length, 0,
              'object 2 holds object 0, so the whole group is live');
            api.assert.ok(heap.cells[0] && heap.cells[1], 'and neither is freed');
          }
        },
        {
          name: 'the reclaimed set equals the unreachable set on randomised heaps',
          assert: function (lab, api) {
            const parts = lab();

            for (let run = 0; run < 40; run += 1) {
              const heap = { roots: [0], cells: {} };
              const size = 6 + Math.floor(api.rng.next() * 6);

              for (let id = 0; id < size; id += 1) heap.cells[id] = { refs: [], count: 0 };
              for (let id = 0; id < size; id += 1) {
                const fan = Math.floor(api.rng.next() * 3);

                for (let at = 0; at < fan; at += 1) {
                  const to = Math.floor(api.rng.next() * size);

                  heap.cells[id].refs.push(to);
                  heap.cells[to].count += 1;
                }
              }
              heap.cells[0].count += 1;
              const live = parts.subgraph(heap, 0);
              const before = Object.keys(heap.cells).map(Number);
              const candidates = before.filter(function (id) {
                return live.indexOf(id) === -1;
              });

              parts.collectCycles(heap, candidates);
              live.forEach(function (id) {
                api.assert.ok(heap.cells[id], 'a reachable object was freed on run ' + run);
              });
            }
          }
        }
      ]
    }],

    'mark-sweep-and-compact': [{
      id: 'mark-stack-overflow',
      title: 'Mark with a bounded stack, and recover from the overflow',
      prompt: 'A heap is { cells: { id: { refs: [], colour } }, roots: [] }. Write ' +
        'collect(heap, stackLimit) which whitens every cell, marks from the roots with a mark ' +
        'stack of at most `stackLimit` entries, recovers whatever the overflow dropped, sweeps ' +
        'the white cells and returns { reclaimed, rescans, visited }. Pushing onto a full stack ' +
        'must DROP the entry and set a flag rather than growing the stack. The starter pushes ' +
        'the whole root set at once, which loses roots when the stack is smaller than the root ' +
        'set — and a dropped root is unrecoverable, because the recovery looks for a black ' +
        'object with a white child and a root has no parent.',
      entry: 'lab',
      starter: [
        'function collect(heap, stackLimit) {',
        '  const state = { limit: Math.max(1, stackLimit), overflowed: false, rescans: 0,',
        '    visited: 0 };',
        '',
        '  Object.keys(heap.cells).forEach(function (id) { heap.cells[id].colour = "white"; });',
        '  // Every root is pushed before anything is scanned, so a stack smaller than the',
        '  // root set drops roots and nothing can ever find them again.',
        '  markFrom(heap, heap.roots.slice(), state);',
        '  rescan(heap, state);',
        '  return sweep(heap, state);',
        '}',
        '',
        'function push(heap, stack, id, state) {',
        '  const cell = heap.cells[id];',
        '',
        '  if (!cell || cell.colour !== "white") return;',
        '  if (stack.length >= state.limit) { state.overflowed = true; return; }',
        '  cell.colour = "grey";',
        '  stack.push(id);',
        '}',
        '',
        'function markFrom(heap, ids, state) {',
        '  const stack = [];',
        '',
        '  ids.forEach(function (id) { push(heap, stack, id, state); });',
        '  while (stack.length) {',
        '    const cell = heap.cells[stack.pop()];',
        '',
        '    if (!cell) continue;',
        '    state.visited += 1;',
        '    cell.colour = "black";',
        '    cell.refs.forEach(function (child) {',
        '      if (child !== null && child !== undefined) push(heap, stack, child, state);',
        '    });',
        '  }',
        '}',
        '',
        'function rescan(heap, state) {',
        '  let again = true;',
        '',
        '  while (again && state.overflowed) {',
        '    again = false;',
        '    state.overflowed = false;',
        '    state.rescans += 1;',
        '    Object.keys(heap.cells).forEach(function (id) {',
        '      const cell = heap.cells[id];',
        '',
        '      if (cell.colour !== "black") return;',
        '      const pending = cell.refs.filter(function (child) {',
        '        const target = heap.cells[child];',
        '',
        '        return Boolean(target) && target.colour === "white";',
        '      });',
        '',
        '      if (!pending.length) return;',
        '      markFrom(heap, pending, state);',
        '      again = true;',
        '    });',
        '  }',
        '}',
        '',
        'function sweep(heap, state) {',
        '  const reclaimed = [];',
        '',
        '  Object.keys(heap.cells).forEach(function (id) {',
        '    if (heap.cells[id].colour === "white") reclaimed.push(Number(id));',
        '  });',
        '  reclaimed.forEach(function (id) { delete heap.cells[id]; });',
        '  return { reclaimed: reclaimed, rescans: state.rescans, visited: state.visited };',
        '}',
        '',
        'function lab() {',
        '  return { collect: collect };',
        '}'
      ].join('\n'),
      solution: [
        'function collect(heap, stackLimit) {',
        '  const state = { limit: Math.max(1, stackLimit), overflowed: false, rescans: 0,',
        '    visited: 0 };',
        '',
        '  Object.keys(heap.cells).forEach(function (id) { heap.cells[id].colour = "white"; });',
        '  markFrom(heap, heap.roots.slice(), state);',
        '  rescan(heap, state);',
        '  return sweep(heap, state);',
        '}',
        '',
        'function push(heap, stack, id, state) {',
        '  const cell = heap.cells[id];',
        '',
        '  if (!cell || cell.colour !== "white") return;',
        '  if (stack.length >= state.limit) { state.overflowed = true; return; }',
        '  cell.colour = "grey";',
        '  stack.push(id);',
        '}',
        '',
        'function drain(heap, stack, state) {',
        '  while (stack.length) {',
        '    const cell = heap.cells[stack.pop()];',
        '',
        '    if (!cell) continue;',
        '    state.visited += 1;',
        '    cell.colour = "black";',
        '    cell.refs.forEach(function (child) {',
        '      if (child !== null && child !== undefined) push(heap, stack, child, state);',
        '    });',
        '  }',
        '}',
        '',
        '// One at a time: the stack bound belongs to the traversal, not to the',
        '// enumeration of the roots, and a dropped root can never be recovered.',
        'function markFrom(heap, ids, state) {',
        '  const stack = [];',
        '',
        '  ids.forEach(function (id) {',
        '    push(heap, stack, id, state);',
        '    drain(heap, stack, state);',
        '  });',
        '}',
        '',
        'function rescan(heap, state) {',
        '  let again = true;',
        '',
        '  while (again && state.overflowed) {',
        '    again = false;',
        '    state.overflowed = false;',
        '    state.rescans += 1;',
        '    Object.keys(heap.cells).forEach(function (id) {',
        '      const cell = heap.cells[id];',
        '',
        '      if (cell.colour !== "black") return;',
        '      const pending = cell.refs.filter(function (child) {',
        '        const target = heap.cells[child];',
        '',
        '        return Boolean(target) && target.colour === "white";',
        '      });',
        '',
        '      if (!pending.length) return;',
        '      markFrom(heap, pending, state);',
        '      again = true;',
        '    });',
        '  }',
        '}',
        '',
        'function sweep(heap, state) {',
        '  const reclaimed = [];',
        '',
        '  Object.keys(heap.cells).forEach(function (id) {',
        '    if (heap.cells[id].colour === "white") reclaimed.push(Number(id));',
        '  });',
        '  reclaimed.forEach(function (id) { delete heap.cells[id]; });',
        '  return { reclaimed: reclaimed, rescans: state.rescans, visited: state.visited };',
        '}',
        '',
        'function lab() {',
        '  return { collect: collect };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'a stack smaller than the root set still keeps every root',
          assert: function (lab, api) {
            const parts = lab();
            const heap = { roots: [0, 1, 2, 3], cells: {
              0: { refs: [] }, 1: { refs: [] }, 2: { refs: [] }, 3: { refs: [] },
              4: { refs: [] }
            } };
            const out = parts.collect(heap, 1);

            api.assert.deepEqual(out.reclaimed, [4], 'only the unreachable object goes');
            [0, 1, 2, 3].forEach(function (id) {
              api.assert.ok(heap.cells[id], 'root ' + id + ' survived a stack of one');
            });
          }
        },
        {
          name: 'a branching tree is recovered after the stack overflows',
          assert: function (lab, api) {
            const parts = lab();
            const heap = { roots: [0], cells: {} };

            /* A chain never overflows a stack of two, however long it is: its
               fan-out is one, so the stack holds one entry at a time. Only
               branching makes the frontier wider than the bound. */
            for (let id = 0; id < 31; id += 1) {
              const kids = [];

              if (2 * id + 1 < 31) kids.push(2 * id + 1);
              if (2 * id + 2 < 31) kids.push(2 * id + 2);
              heap.cells[id] = { refs: kids };
            }
            heap.cells[31] = { refs: [] };
            const out = parts.collect(heap, 2);

            api.assert.deepEqual(out.reclaimed, [31], 'the tree survives, the orphan does not');
            api.assert.ok(out.rescans > 0, 'and the recovery really did run');
            api.assert.equal(Object.keys(heap.cells).length, 31, 'all 31 nodes are still there');
          }
        },
        {
          name: 'the reclaimed set equals the unreachable set over randomised heaps',
          assert: function (lab, api) {
            const parts = lab();

            for (let run = 0; run < 60; run += 1) {
              const size = 8 + Math.floor(api.rng.next() * 10);
              const heap = { roots: [], cells: {} };

              for (let id = 0; id < size; id += 1) heap.cells[id] = { refs: [] };
              for (let id = 0; id < size; id += 1) {
                const fan = Math.floor(api.rng.next() * 3);

                for (let at = 0; at < fan; at += 1) {
                  heap.cells[id].refs.push(Math.floor(api.rng.next() * size));
                }
              }
              for (let at = 0; at < 3; at += 1) {
                heap.roots.push(Math.floor(api.rng.next() * size));
              }
              const live = [];
              const queue = heap.roots.slice();

              while (queue.length) {
                const id = queue.shift();

                if (live.indexOf(id) !== -1 || !heap.cells[id]) continue;
                live.push(id);
                heap.cells[id].refs.forEach(function (child) { queue.push(child); });
              }
              const out = parts.collect(heap, 1 + Math.floor(api.rng.next() * 4));

              api.assert.equal(out.reclaimed.length, size - live.length,
                'reclaimed the wrong number on run ' + run);
              out.reclaimed.forEach(function (id) {
                api.assert.equal(live.indexOf(id), -1,
                  'freed reachable object ' + id + ' on run ' + run);
              });
            }
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));

/** Graded exercises for the linear-structures sections (M02). */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'memory-layout': [{
      id: 'struct-layout',
      title: 'Lay out a struct the way the compiler does',
      prompt: 'layout(fields) places fields in order, each at an address divisible by its own size, ' +
        'and pads the struct to a multiple of its widest member. Return ' +
        '{ fields: [{name, offset, bytes}], stride, padding }. Sizes: i8/u8 = 1, i16 = 2, i32/f32 = 4, ' +
        'f64 = 8.',
      entry: 'layout',
      starter: [
        'const SIZES = { i8: 1, u8: 1, i16: 2, u16: 2, i32: 4, u32: 4, f32: 4, f64: 8 };',
        '',
        'function layout(fields) {',
        '  let offset = 0;',
        '  const placed = fields.map(function (field) {',
        '    const bytes = SIZES[field.type];',
        '    // align the offset to a multiple of bytes before placing the field',
        '    const at = offset;',
        '    offset = at + bytes;',
        '    return { name: field.name, offset: at, bytes: bytes };',
        '  });',
        '  return { fields: placed, stride: offset, padding: 0 };',
        '}'
      ].join('\n'),
      solution: [
        'const SIZES = { i8: 1, u8: 1, i16: 2, u16: 2, i32: 4, u32: 4, f32: 4, f64: 8 };',
        '',
        'function layout(fields) {',
        '  let offset = 0;',
        '  let widest = 1;',
        '  const placed = fields.map(function (field) {',
        '    const bytes = SIZES[field.type];',
        '    widest = Math.max(widest, bytes);',
        '    const at = Math.ceil(offset / bytes) * bytes;',
        '    offset = at + bytes;',
        '    return { name: field.name, offset: at, bytes: bytes };',
        '  });',
        '  const stride = Math.ceil(offset / widest) * widest;',
        '  const used = placed.reduce(function (sum, f) { return sum + f.bytes; }, 0);',
        '  return { fields: placed, stride: stride, padding: stride - used };',
        '}'
      ].join('\n'),
      tests: [
        { name: 'the classic mixed struct gets a 24-byte stride',
          assert: function (layout, api) {
            const result = layout([
              { name: 'id', type: 'i32' }, { name: 'flag', type: 'u8' },
              { name: 'score', type: 'f64' }, { name: 'rank', type: 'i16' }
            ]);
            api.assert.equal(result.fields[0].offset, 0, 'id');
            api.assert.equal(result.fields[1].offset, 4, 'flag');
            api.assert.equal(result.fields[2].offset, 8, 'score must be 8-aligned');
            api.assert.equal(result.fields[3].offset, 16, 'rank');
            api.assert.equal(result.stride, 24, 'padded to a multiple of 8');
            api.assert.equal(result.padding, 9, '24 − 15 used bytes');
          } },
        { name: 'widest-first ordering removes almost all the padding',
          assert: function (layout, api) {
            const result = layout([
              { name: 'score', type: 'f64' }, { name: 'id', type: 'i32' },
              { name: 'rank', type: 'i16' }, { name: 'flag', type: 'u8' }
            ]);
            api.assert.equal(result.stride, 16, 'the same fields now fit in 16 bytes');
            api.assert.equal(result.padding, 1, 'one trailing byte');
          } },
        { name: 'a struct of one type needs no padding at all',
          assert: function (layout, api) {
            const result = layout([
              { name: 'a', type: 'i32' }, { name: 'b', type: 'i32' }, { name: 'c', type: 'i32' }
            ]);
            api.assert.equal(result.stride, 12);
            api.assert.equal(result.padding, 0);
          } },
        { name: 'every field is aligned to its own width',
          assert: function (layout, api) {
            const types = ['u8', 'f64', 'i16', 'i32', 'u8', 'f64'];
            const result = layout(types.map(function (type, i) { return { name: 'f' + i, type: type }; }));
            const sizes = { i8: 1, u8: 1, i16: 2, u16: 2, i32: 4, u32: 4, f32: 4, f64: 8 };
            result.fields.forEach(function (field, i) {
              api.assert.equal(field.offset % sizes[types[i]], 0, 'field ' + i + ' at ' + field.offset);
            });
          } }
      ]
    }],

    'dynamic-arrays': [{
      id: 'insert-remove',
      title: 'Insert and remove without losing elements',
      prompt: 'insertAt(array, index, value) and removeAt(array, index) must shift the tail by exactly ' +
        'one position and return the new length (or the removed value). Do it with a single pass in ' +
        'the correct direction — the wrong direction overwrites the data it is about to move.',
      entry: 'insertAt',
      starter: [
        'function insertAt(array, index, value) {',
        '  // shift right from the end, then write; the direction matters',
        '  array[index] = value;',
        '  return array.length;',
        '}',
        '',
        'function removeAt(array, index) {',
        '  const value = array[index];',
        '  return value;',
        '}'
      ].join('\n'),
      solution: [
        'function insertAt(array, index, value) {',
        '  array.length += 1;',
        '  for (let i = array.length - 1; i > index; i -= 1) array[i] = array[i - 1];',
        '  array[index] = value;',
        '  return array.length;',
        '}',
        '',
        'function removeAt(array, index) {',
        '  const value = array[index];',
        '  for (let i = index; i < array.length - 1; i += 1) array[i] = array[i + 1];',
        '  array.length -= 1;',
        '  return value;',
        '}'
      ].join('\n'),
      tests: [
        { name: 'inserting at the front, middle and end all work',
          assert: function (insertAt, api) {
            const front = [1, 2, 3];
            insertAt(front, 0, 9);
            api.assert.deepEqual(front, [9, 1, 2, 3], 'front');

            const middle = [1, 2, 3];
            insertAt(middle, 1, 9);
            api.assert.deepEqual(middle, [1, 9, 2, 3], 'middle');

            const end = [1, 2, 3];
            insertAt(end, 3, 9);
            api.assert.deepEqual(end, [1, 2, 3, 9], 'end');
          } },
        { name: 'the returned length is the new length',
          assert: function (insertAt, api) {
            const array = [1, 2, 3];
            api.assert.equal(insertAt(array, 1, 9), 4);
            api.assert.equal(array.length, 4);
          } },
        { name: 'a long array survives many insertions in order',
          assert: function (insertAt, api) {
            const array = [];
            for (let i = 0; i < 200; i += 1) insertAt(array, 0, i);
            api.assert.equal(array.length, 200);
            api.assert.equal(array[0], 199, 'the last front insert is first');
            api.assert.equal(array[199], 0, 'the first is last');
            for (let i = 0; i < 200; i += 1) api.assert.equal(array[i], 199 - i, 'position ' + i);
          } }
      ]
    }],

    'linked-lists': [{
      id: 'cycle',
      title: 'Find the cycle with Brent\'s algorithm',
      prompt: 'findCycle(next, start) returns { length, start } for the loop reachable from start, or ' +
        'null when there is none. `next(i)` returns the following index, or -1 at the end. Use Brent\'s ' +
        'method: advance the hare while teleporting the tortoise at powers of two.',
      entry: 'findCycle',
      starter: [
        'function findCycle(next, start) {',
        '  // Brent: keep a power-of-two step budget; teleport the tortoise when it runs out.',
        '  return null;',
        '}'
      ].join('\n'),
      solution: [
        'function findCycle(next, start) {',
        '  let power = 1;',
        '  let length = 1;',
        '  let tortoise = start;',
        '  let hare = next(start);',
        '',
        '  while (hare !== -1 && tortoise !== hare) {',
        '    if (power === length) { tortoise = hare; power *= 2; length = 0; }',
        '    hare = next(hare);',
        '    length += 1;',
        '  }',
        '  if (hare === -1) return null;',
        '',
        '  let first = start;',
        '  let second = start;',
        '  for (let i = 0; i < length; i += 1) second = next(second);',
        '  while (first !== second) { first = next(first); second = next(second); }',
        '  return { length: length, start: first };',
        '}'
      ].join('\n'),
      tests: [
        { name: 'an acyclic list returns null',
          assert: function (findCycle, api) {
            const next = function (i) { return i < 9 ? i + 1 : -1; };
            api.assert.equal(findCycle(next, 0), null);
          } },
        { name: 'a self-loop at the end is found',
          assert: function (findCycle, api) {
            const next = function (i) { return i < 5 ? i + 1 : 5; };
            const found = findCycle(next, 0);
            api.assert.deepEqual(found, { length: 1, start: 5 });
          } },
        { name: 'the cycle length and entry point are exact',
          assert: function (findCycle, api) {
            [[10, 3], [50, 0], [64, 40], [7, 6]].forEach(function (pair) {
              const size = pair[0];
              const entry = pair[1];
              const next = function (i) { return i < size - 1 ? i + 1 : entry; };
              const found = findCycle(next, 0);
              api.assert.equal(found.length, size - entry, 'length for size ' + size + ' entry ' + entry);
              api.assert.equal(found.start, entry, 'entry for size ' + size);
            });
          } },
        { name: 'it works on a randomised functional graph',
          assert: function (findCycle, api) {
            for (let trial = 0; trial < 20; trial += 1) {
              const size = 30 + api.rng.int(40);
              const entry = api.rng.int(size);
              const next = function (i) { return i < size - 1 ? i + 1 : entry; };
              const found = findCycle(next, 0);
              api.assert.equal(found.start, entry, 'trial ' + trial);
              api.assert.equal(found.length, size - entry, 'trial ' + trial + ' length');
            }
          } }
      ]
    }],

    'stacks-and-frames': [{
      id: 'iterative-traversal',
      title: 'Convert a recursion into an explicit stack',
      prompt: 'inOrder(nodes, root) must return the in-order traversal of a binary tree using an ' +
        'explicit stack, not recursion. Nodes are { value, left, right } with -1 for absent, and the ' +
        'tree may be a degenerate chain 200 000 nodes deep — which is why recursion is not allowed here.',
      entry: 'inOrder',
      starter: [
        'function inOrder(nodes, root) {',
        '  // push left spine, pop, visit, move right - no recursive calls',
        '  return [];',
        '}'
      ].join('\n'),
      solution: [
        'function inOrder(nodes, root) {',
        '  const out = [];',
        '  const stack = [];',
        '  let cursor = root;',
        '',
        '  while (cursor !== -1 || stack.length) {',
        '    while (cursor !== -1) { stack.push(cursor); cursor = nodes[cursor].left; }',
        '    const index = stack.pop();',
        '    out.push(nodes[index].value);',
        '    cursor = nodes[index].right;',
        '  }',
        '  return out;',
        '}'
      ].join('\n'),
      tests: [
        { name: 'a balanced tree is visited in order',
          assert: function (inOrder, api) {
            const nodes = [
              { value: 4, left: 1, right: 2 },
              { value: 2, left: 3, right: 4 },
              { value: 6, left: 5, right: 6 },
              { value: 1, left: -1, right: -1 },
              { value: 3, left: -1, right: -1 },
              { value: 5, left: -1, right: -1 },
              { value: 7, left: -1, right: -1 }
            ];
            api.assert.deepEqual(inOrder(nodes, 0), [1, 2, 3, 4, 5, 6, 7]);
          } },
        { name: 'empty and single-node trees are handled',
          assert: function (inOrder, api) {
            api.assert.deepEqual(inOrder([], -1), []);
            api.assert.deepEqual(inOrder([{ value: 42, left: -1, right: -1 }], 0), [42]);
          } },
        { name: 'a 200 000-node degenerate chain does not overflow',
          assert: function (inOrder, api) {
            const size = 200000;
            const nodes = new Array(size);
            for (let i = 0; i < size; i += 1) {
              nodes[i] = { value: i, left: -1, right: i + 1 < size ? i + 1 : -1 };
            }
            const result = inOrder(nodes, 0);
            api.assert.equal(result.length, size, 'every node visited');
            api.assert.equal(result[0], 0);
            api.assert.equal(result[size - 1], size - 1);
          } },
        { name: 'a left-leaning chain also works',
          assert: function (inOrder, api) {
            const size = 50000;
            const nodes = new Array(size);
            for (let i = 0; i < size; i += 1) {
              nodes[i] = { value: size - i, left: i + 1 < size ? i + 1 : -1, right: -1 };
            }
            const result = inOrder(nodes, 0);
            api.assert.equal(result.length, size);
            api.assert.equal(result[0], 1, 'the deepest left node comes first');
          } }
      ]
    }],

    'queues-and-rings': [{
      id: 'ring-buffer',
      title: 'Implement the ring buffer',
      prompt: 'createRing(capacity) must round the capacity up to a power of two, wrap with a mask, ' +
        'and distinguish full from empty by leaving one slot unused. Return ' +
        '{ push, shift, size, isFull, isEmpty, capacity }. push returns false when full; shift returns ' +
        'undefined when empty.',
      entry: 'createRing',
      starter: [
        'function createRing(capacity) {',
        '  const slots = new Array(capacity);',
        '  let head = 0;',
        '  let tail = 0;',
        '  return {',
        '    push: function (v) { slots[tail] = v; tail += 1; return true; },',
        '    shift: function () { const v = slots[head]; head += 1; return v; },',
        '    size: function () { return tail - head; },',
        '    isFull: function () { return false; },',
        '    isEmpty: function () { return head === tail; },',
        '    capacity: capacity',
        '  };',
        '}'
      ].join('\n'),
      solution: [
        'function createRing(capacity) {',
        '  let size = 1;',
        '  while (size < capacity) size *= 2;',
        '  const mask = size - 1;',
        '  const slots = new Array(size);',
        '  let head = 0;',
        '  let tail = 0;',
        '',
        '  const count = function () { return (tail - head) & mask; };',
        '  const full = function () { return count() === size - 1; };',
        '',
        '  return {',
        '    push: function (value) {',
        '      if (full()) return false;',
        '      slots[tail] = value;',
        '      tail = (tail + 1) & mask;',
        '      return true;',
        '    },',
        '    shift: function () {',
        '      if (count() === 0) return undefined;',
        '      const value = slots[head];',
        '      head = (head + 1) & mask;',
        '      return value;',
        '    },',
        '    size: count,',
        '    isFull: full,',
        '    isEmpty: function () { return count() === 0; },',
        '    capacity: size',
        '  };',
        '}'
      ].join('\n'),
      tests: [
        { name: 'capacity rounds up to a power of two',
          assert: function (createRing, api) {
            [[3, 4], [5, 8], [8, 8], [9, 16], [100, 128]].forEach(function (pair) {
              api.assert.equal(createRing(pair[0]).capacity, pair[1], 'requested ' + pair[0]);
            });
          } },
        { name: 'FIFO order is preserved across wrap-around',
          assert: function (createRing, api) {
            const ring = createRing(8);
            let expected = 0;
            let sent = 0;
            for (let round = 0; round < 50; round += 1) {
              while (!ring.isFull()) { ring.push(sent); sent += 1; }
              for (let i = 0; i < 3; i += 1) {
                api.assert.equal(ring.shift(), expected, 'value order');
                expected += 1;
              }
            }
          } },
        { name: 'full and empty are distinguished',
          assert: function (createRing, api) {
            const ring = createRing(4);
            api.assert.equal(ring.isEmpty(), true, 'starts empty');
            api.assert.equal(ring.isFull(), false, 'and not full');

            while (ring.push(1)) { /* fill */ }
            api.assert.equal(ring.isFull(), true, 'reports full');
            api.assert.equal(ring.isEmpty(), false, 'and not empty');
            api.assert.equal(ring.size(), 3, 'one slot of four is reserved');
            api.assert.equal(ring.push(2), false, 'a push into a full ring is rejected');

            while (ring.shift() !== undefined) { /* drain */ }
            api.assert.equal(ring.isEmpty(), true, 'empty again after draining');
            api.assert.equal(ring.shift(), undefined, 'shift on empty is undefined');
          } },
        { name: 'it survives a long randomised sequence against a reference queue',
          assert: function (createRing, api) {
            const ring = createRing(16);
            const reference = [];
            for (let step = 0; step < 4000; step += 1) {
              if (api.rng.next() < 0.55) {
                const value = api.rng.int(1000);
                const accepted = ring.push(value);
                if (reference.length < ring.capacity - 1) {
                  api.assert.equal(accepted, true, 'should accept at step ' + step);
                  reference.push(value);
                } else {
                  api.assert.equal(accepted, false, 'should reject at step ' + step);
                }
              } else {
                api.assert.equal(ring.shift(), reference.shift(), 'value at step ' + step);
              }
              api.assert.equal(ring.size(), reference.length, 'size at step ' + step);
            }
          } }
      ]
    }],

    'batching-pipelines': [{
      id: 'chunked',
      title: 'Chunk a stream without holding it',
      prompt: 'processInChunks(items, size, onChunk) must call onChunk with successive arrays of at ' +
        'most `size` items, never hold more than one chunk at a time, and return the number of chunks. ' +
        'The final chunk may be short, and it must still be delivered.',
      entry: 'processInChunks',
      starter: [
        'function processInChunks(items, size, onChunk) {',
        '  onChunk(items.slice());   // holds everything: fix this',
        '  return 1;',
        '}'
      ].join('\n'),
      solution: [
        'function processInChunks(items, size, onChunk) {',
        '  if (size <= 0) throw new Error("chunk size must be positive");',
        '  let chunks = 0;',
        '  for (let start = 0; start < items.length; start += size) {',
        '    onChunk(items.slice(start, start + size));',
        '    chunks += 1;',
        '  }',
        '  return chunks;',
        '}'
      ].join('\n'),
      tests: [
        { name: 'every item is delivered exactly once, in order',
          assert: function (processInChunks, api) {
            const items = [];
            for (let i = 0; i < 1000; i += 1) items.push(i);
            const seen = [];
            const chunks = processInChunks(items, 64, function (chunk) {
              chunk.forEach(function (value) { seen.push(value); });
            });
            api.assert.equal(chunks, 16, '1000 / 64 rounded up');
            api.assert.equal(seen.length, 1000);
            api.assert.deepEqual(seen.slice(0, 5), [0, 1, 2, 3, 4]);
            api.assert.equal(seen[999], 999);
          } },
        { name: 'no chunk exceeds the size, and the last one may be short',
          assert: function (processInChunks, api) {
            const items = [];
            for (let i = 0; i < 250; i += 1) items.push(i);
            const sizes = [];
            processInChunks(items, 100, function (chunk) { sizes.push(chunk.length); });
            api.assert.deepEqual(sizes, [100, 100, 50]);
          } },
        { name: 'peak held items stays at the chunk size for any input length',
          assert: function (processInChunks, api) {
            [500, 5000, 20000].forEach(function (n) {
              const items = [];
              for (let i = 0; i < n; i += 1) items.push(i);
              let peak = 0;
              processInChunks(items, 32, function (chunk) { peak = Math.max(peak, chunk.length); });
              api.assert.atMost(peak, 32, 'n = ' + n + ' peaked at ' + peak);
            });
          } },
        { name: 'an empty input produces no chunks',
          assert: function (processInChunks, api) {
            let called = 0;
            api.assert.equal(processInChunks([], 10, function () { called += 1; }), 0);
            api.assert.equal(called, 0, 'onChunk must not be called for empty input');
          } }
      ]
    }],

    'pools-and-arenas': [{
      id: 'free-list',
      title: 'Thread a free list through the free slots',
      prompt: 'createPool(slots) hands out fixed-size slots in O(1) and takes them back in O(1), with ' +
        'the free list stored inside the free slots themselves — no extra array of booleans, no scan. ' +
        'Return { allocate, free, available }. allocate returns a slot index or -1. Pushing onto the ' +
        'head of the list makes reuse last-freed-first, and the tests check that order.',
      entry: 'createPool',
      starter: [
        'function createPool(slots) {',
        '  const used = new Array(slots).fill(false);',
        '  return {',
        '    allocate: function () {',
        '      for (let i = 0; i < slots; i += 1) if (!used[i]) { used[i] = true; return i; }',
        '      return -1;   // this scan is what the free list removes',
        '    },',
        '    free: function (slot) { used[slot] = false; },',
        '    available: function () { return used.filter(function (u) { return !u; }).length; }',
        '  };',
        '}'
      ].join('\n'),
      solution: [
        'function createPool(slots) {',
        '  const next = new Int32Array(slots);',
        '  for (let i = 0; i < slots; i += 1) next[i] = i + 1;',
        '  if (slots > 0) next[slots - 1] = -1;',
        '  let head = slots > 0 ? 0 : -1;',
        '  let free = slots;',
        '',
        '  return {',
        '    allocate: function () {',
        '      if (head === -1) return -1;',
        '      const slot = head;',
        '      head = next[slot];',
        '      free -= 1;',
        '      return slot;',
        '    },',
        '    free: function (slot) {',
        '      next[slot] = head;',
        '      head = slot;',
        '      free += 1;',
        '    },',
        '    available: function () { return free; }',
        '  };',
        '}'
      ].join('\n'),
      tests: [
        { name: 'allocation hands out distinct slots until the pool is empty',
          assert: function (createPool, api) {
            const pool = createPool(8);
            const seen = new Set();
            for (let i = 0; i < 8; i += 1) {
              const slot = pool.allocate();
              api.assert.ok(slot >= 0 && slot < 8, 'slot in range: ' + slot);
              api.assert.equal(seen.has(slot), false, 'slot ' + slot + ' handed out twice');
              seen.add(slot);
            }
            api.assert.equal(pool.allocate(), -1, 'an exhausted pool returns -1');
            api.assert.equal(pool.available(), 0);
          } },
        { name: 'freed slots come back last-freed-first, not lowest-index-first',
          assert: function (createPool, api) {
            const pool = createPool(4);
            const taken = [pool.allocate(), pool.allocate(), pool.allocate(), pool.allocate()];
            api.assert.equal(pool.available(), 0, 'the pool is empty');

            pool.free(taken[0]);
            pool.free(taken[2]);
            api.assert.equal(pool.available(), 2, 'two returned');
            api.assert.equal(pool.allocate(), taken[2], 'the head of the list is the last slot freed');
            api.assert.equal(pool.allocate(), taken[0], 'then the one before it');
            api.assert.equal(pool.allocate(), -1, 'and the pool is empty again');
          } },
        { name: 'a long allocate/free churn never double-allocates',
          assert: function (createPool, api) {
            const pool = createPool(64);
            const live = new Set();
            for (let step = 0; step < 5000; step += 1) {
              if (live.size > 0 && api.rng.next() < 0.5) {
                const slot = Array.from(live)[api.rng.int(live.size)];
                live.delete(slot);
                pool.free(slot);
              } else {
                const slot = pool.allocate();
                if (slot === -1) { api.assert.equal(live.size, 64, 'only full pools refuse'); continue; }
                api.assert.equal(live.has(slot), false, 'slot ' + slot + ' allocated twice at step ' + step);
                live.add(slot);
              }
              api.assert.equal(pool.available(), 64 - live.size, 'available at step ' + step);
            }
          } }
      ]
    }],

    'text-buffers': [{
      id: 'gap-buffer',
      title: 'Move the gap, then type into it',
      prompt: 'createGap(text) returns { insert(position, value), text(), moved() }. Keep free space at ' +
        'the cursor: moving the gap copies one character per position, and inserting into it copies ' +
        'nothing. moved() reports the total characters shifted, which the tests check.',
      entry: 'createGap',
      starter: [
        'function createGap(text) {',
        '  let value = text;',
        '  let moved = 0;',
        '  return {',
        '    insert: function (position, insertion) {',
        '      value = value.slice(0, position) + insertion + value.slice(position);',
        '      moved += value.length;   // a whole-document copy every time',
        '    },',
        '    text: function () { return value; },',
        '    moved: function () { return moved; }',
        '  };',
        '}'
      ].join('\n'),
      solution: [
        'function createGap(text) {',
        '  let chars = text.split("").concat(new Array(16).fill(""));',
        '  let gapStart = text.length;',
        '  let gapEnd = chars.length;',
        '  let moved = 0;',
        '',
        '  const moveGap = function (position) {',
        '    while (gapStart > position) { gapStart -= 1; gapEnd -= 1; chars[gapEnd] = chars[gapStart]; moved += 1; }',
        '    while (gapStart < position) { chars[gapStart] = chars[gapEnd]; gapStart += 1; gapEnd += 1; moved += 1; }',
        '  };',
        '',
        '  const grow = function (extra) {',
        '    const before = chars.slice(0, gapStart);',
        '    const after = chars.slice(gapEnd);',
        '    const size = Math.max(extra, chars.length);',
        '    chars = before.concat(new Array(size).fill(""), after);',
        '    gapEnd = gapStart + size;',
        '  };',
        '',
        '  return {',
        '    insert: function (position, insertion) {',
        '      moveGap(position);',
        '      if (gapEnd - gapStart < insertion.length) grow(insertion.length);',
        '      for (let i = 0; i < insertion.length; i += 1) { chars[gapStart] = insertion[i]; gapStart += 1; }',
        '    },',
        '    text: function () { return chars.slice(0, gapStart).join("") + chars.slice(gapEnd).join(""); },',
        '    moved: function () { return moved; }',
        '  };',
        '}'
      ].join('\n'),
      tests: [
        { name: 'the text matches a plain string implementation',
          assert: function (createGap, api) {
            const buffer = createGap('hello world');
            let reference = 'hello world';

            const edits = [[5, ','], [0, '>> '], [14, '!'], [3, 'X']];
            edits.forEach(function (edit) {
              buffer.insert(edit[0], edit[1]);
              reference = reference.slice(0, edit[0]) + edit[1] + reference.slice(edit[0]);
            });

            api.assert.equal(buffer.text(), reference);
          } },
        { name: 'sequential typing at the cursor moves almost nothing',
          assert: function (createGap, api) {
            const buffer = createGap(new Array(5000).fill('.').join(''));
            buffer.insert(2500, 'a');
            const afterFirst = buffer.moved();
            for (let i = 1; i < 300; i += 1) buffer.insert(2500 + i, 'a');

            api.assert.atMost(buffer.moved() - afterFirst, 10,
              'typing forward at the gap should not move characters');
            api.assert.equal(buffer.text().length, 5300);
          } },
        { name: 'jumping around costs the distance, and stays correct',
          assert: function (createGap, api) {
            const buffer = createGap(new Array(2000).fill('.').join(''));
            let reference = new Array(2000).fill('.').join('');

            for (let i = 0; i < 40; i += 1) {
              const at = api.rng.int(reference.length);
              buffer.insert(at, 'z');
              reference = reference.slice(0, at) + 'z' + reference.slice(at);
            }

            api.assert.equal(buffer.text(), reference, 'scattered edits still produce the right text');
            api.assert.atLeast(buffer.moved(), 1000, 'and they do cost cursor movement');
          } }
      ]
    }],

    'cache-layouts': [{
      id: 'eytzinger',
      title: 'Build and search the Eytzinger layout',
      prompt: 'buildEytzinger(sorted) returns an array whose index 1 is the root and whose children of ' +
        'i are 2i and 2i+1, holding the same keys as the sorted input. eytzingerSearch(layout, target) ' +
        'returns the index of the target or -1. Index 0 is unused.',
      entry: 'buildEytzinger',
      starter: [
        'function buildEytzinger(sorted) {',
        '  // fill index 1 as the root; an in-order walk of the tree emits the sorted order',
        '  return [0].concat(sorted);',
        '}',
        '',
        'function eytzingerSearch(layout, target) {',
        '  return layout.indexOf(target);',
        '}'
      ].join('\n'),
      solution: [
        'function buildEytzinger(sorted) {',
        '  const layout = new Array(sorted.length + 1).fill(0);',
        '  let cursor = 0;',
        '',
        '  const fill = function (index) {',
        '    if (index > sorted.length) return;',
        '    fill(2 * index);',
        '    layout[index] = sorted[cursor];',
        '    cursor += 1;',
        '    fill(2 * index + 1);',
        '  };',
        '',
        '  fill(1);',
        '  return layout;',
        '}',
        '',
        'function eytzingerSearch(layout, target) {',
        '  let index = 1;',
        '  while (index < layout.length) {',
        '    if (layout[index] === target) return index;',
        '    index = 2 * index + (layout[index] < target ? 1 : 0);',
        '  }',
        '  return -1;',
        '}'
      ].join('\n'),
      tests: [
        { name: 'the root is the middle key and the layout holds every key once',
          assert: function (buildEytzinger, api) {
            const sorted = [];
            for (let i = 0; i < 15; i += 1) sorted.push(i * 2);
            const layout = buildEytzinger(sorted);

            api.assert.equal(layout.length, 16, 'index 0 is unused');
            api.assert.equal(layout[1], 14, 'the root is the median');
            const keys = layout.slice(1).slice().sort(function (a, b) { return a - b; });
            api.assert.deepEqual(keys, sorted, 'same multiset of keys');
          } },
        { name: 'an in-order walk of the layout recovers the sorted order',
          assert: function (buildEytzinger, api) {
            const sorted = [];
            for (let i = 0; i < 31; i += 1) sorted.push(i * 3 + 1);
            const layout = buildEytzinger(sorted);

            const out = [];
            const walk = function (index) {
              if (index >= layout.length) return;
              walk(2 * index);
              out.push(layout[index]);
              walk(2 * index + 1);
            };
            walk(1);
            api.assert.deepEqual(out, sorted);
          } },
        { name: 'search finds every present key and rejects absent ones',
          assert: function (buildEytzinger, api) {
            const sorted = [];
            for (let i = 0; i < 63; i += 1) sorted.push(i * 2);
            const layout = buildEytzinger(sorted);

            const search = function (target) {
              let index = 1;
              while (index < layout.length) {
                if (layout[index] === target) return index;
                index = 2 * index + (layout[index] < target ? 1 : 0);
              }
              return -1;
            };

            sorted.forEach(function (key) {
              const at = search(key);
              api.assert.notEqual(at, -1, 'key ' + key + ' should be found');
              api.assert.equal(layout[at], key, 'and the index should hold it');
            });
            api.assert.equal(search(1), -1, 'odd values are absent');
            api.assert.equal(search(1000), -1, 'above the range');
          } }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));

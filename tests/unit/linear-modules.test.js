'use strict';

/**
 * Unit tests for the M02 linear-structure engines. All pure and DOM-free: the
 * memory model is a plain ArrayBuffer, so nothing here touches the filesystem,
 * the network or a real allocator.
 */

const test = require('node:test');
const assert = require('node:assert');

const MemoryModel = require('../../src/js/machines/memory-model.js');
const Linear = require('../../src/js/algorithms/linear-structures.js');
const TextBuffers = require('../../src/js/algorithms/text-buffers.js');
const Allocators = require('../../src/js/algorithms/allocators-basic.js');
const CacheLayouts = require('../../src/js/algorithms/cache-layouts.js');
const CallStack = require('../../src/js/algorithms/call-stack.js');
const CacheSim = require('../../src/js/machines/cache-sim.js');
const Random = require('../../src/js/utils/random.js');

/* --------------------------------------------------------------- memory model */

test('memory model: fields are aligned to their own width and the struct is padded', function () {
  const plan = MemoryModel.layout([
    { name: 'id', type: 'i32' },
    { name: 'flag', type: 'u8' },
    { name: 'score', type: 'f64' },
    { name: 'rank', type: 'i16' }
  ]);

  assert.deepStrictEqual(plan.fields.map(function (f) { return f.offset; }), [0, 4, 8, 16]);
  assert.strictEqual(plan.stride, 24, 'padded up to a multiple of the widest member');
  assert.strictEqual(plan.used, 15);
  assert.strictEqual(plan.padding, 9);
  assert.strictEqual(plan.widest, 8);
});

test('memory model: widest-first ordering removes almost all the padding', function () {
  const fields = [
    { name: 'id', type: 'i32' }, { name: 'flag', type: 'u8' },
    { name: 'score', type: 'f64' }, { name: 'rank', type: 'i16' }
  ];

  const declared = MemoryModel.layout(fields);
  const packed = MemoryModel.packed(fields);

  assert.strictEqual(packed.stride, 16);
  assert.strictEqual(packed.padding, 1);
  assert.strictEqual(declared.used, packed.used, 'the same bytes are actually used');
  assert.ok(packed.stride < declared.stride, 'and the stride shrinks by a third');
});

test('memory model: reads and writes round-trip and are counted', function () {
  const memory = MemoryModel.create({ bytes: 1024 });

  memory.write(16, 'f64', 1.5, 'test');
  memory.write(0, 'i32', -7, 'test');
  memory.write(8, 'u8', 200, 'test');

  assert.strictEqual(memory.read(16, 'f64'), 1.5);
  assert.strictEqual(memory.read(0, 'i32'), -7);
  assert.strictEqual(memory.read(8, 'u8'), 200);

  const counters = memory.counters();
  assert.strictEqual(counters.writes, 3);
  assert.strictEqual(counters.reads, 3);
  assert.strictEqual(counters.bytesWritten, 8 + 4 + 1);
  assert.strictEqual(counters.bytesRead, 8 + 4 + 1);
});

test('memory model: an out-of-range access is refused rather than silently wrapping', function () {
  const memory = MemoryModel.create({ bytes: 64 });
  assert.throws(function () { memory.write(60, 'f64', 1, 'over'); }, RangeError);
  assert.throws(function () { memory.read(-1, 'i32'); }, RangeError);
});

/* -------------------------------------------------------------- record arrays */

test('record array: SoA touches far fewer cache lines than AoS for a one-field scan', function () {
  const fields = [
    { name: 'id', type: 'i32' }, { name: 'flag', type: 'u8' },
    { name: 'score', type: 'f64' }, { name: 'rank', type: 'i16' }
  ];
  const count = 256;

  const build = function (soa) {
    const records = Linear.createRecordArray({ fields: fields, count: count, soa: soa });
    for (let i = 0; i < count; i += 1) records.set(i, 'score', i);
    return records.sumField('score');
  };

  const aos = build(false);
  const soa = build(true);

  const expected = (count * (count - 1)) / 2;
  assert.strictEqual(aos.total, expected, 'both layouts hold the same data');
  assert.strictEqual(soa.total, expected);
  assert.strictEqual(aos.bytesNeeded, soa.bytesNeeded, 'and read the same useful bytes');

  assert.strictEqual(soa.cacheLines, Math.ceil((count * 8) / 64), 'SoA reads a dense column');
  assert.ok(aos.cacheLines >= soa.cacheLines * 2,
    'AoS touched ' + aos.cacheLines + ' lines against SoA ' + soa.cacheLines);
});

/* ------------------------------------------------------------- dynamic arrays */

test('dynamic array: growth is geometric and total copying is bounded by the factor', function () {
  [[2, 1.2], [1.5, 2.4], [1.25, 4.6]].forEach(function (pair) {
    const factor = pair[0];
    const bound = pair[1];
    const array = Linear.createDynamicArray({ factor: factor, initialCapacity: 1, bytes: 1 << 22 });

    const n = 2000;
    for (let i = 0; i < n; i += 1) array.push(i);

    const copied = array.events().reduce(function (sum, e) { return sum + e.copied; }, 0);
    assert.ok(copied / n <= bound,
      'factor ' + factor + ' copied ' + (copied / n).toFixed(2) + ' per push, bound ' + bound);
    assert.ok(array.capacity() >= n && array.capacity() < n * factor + factor,
      'capacity ' + array.capacity() + ' is within one growth step of ' + n);
    assert.strictEqual(array.length(), n);
    assert.strictEqual(array.get(1999), 1999);
  });
});

test('dynamic array: insertion cost is the distance to the end', function () {
  const array = Linear.createDynamicArray({ initialCapacity: 64, bytes: 1 << 20 });
  for (let i = 0; i < 50; i += 1) array.push(i);

  assert.strictEqual(array.insertAt(50, 999), 0, 'appending moves nothing');
  assert.strictEqual(array.insertAt(0, -1), 51, 'a front insert moves the whole array');
  assert.strictEqual(array.insertAt(26, 7), 26, 'the middle moves half');

  const contents = array.toArray();
  assert.strictEqual(contents[0], -1);
  assert.strictEqual(contents[26], 7);
  assert.strictEqual(contents.length, 53);
});

test('dynamic array: removal returns the value and closes the gap', function () {
  const array = Linear.createDynamicArray({ initialCapacity: 8, bytes: 1 << 20 });
  [10, 20, 30, 40].forEach(function (value) { array.push(value); });

  const removed = array.removeAt(1);
  assert.strictEqual(removed.value, 20);
  assert.strictEqual(removed.moved, 2);
  assert.deepStrictEqual(array.toArray(), [10, 30, 40]);
});

/* ---------------------------------------------------------------- linked lists */

test('linked list: the same list scattered touches many more cache lines', function () {
  const size = 32768;                       // 256 KB of nodes against a 32 KB cache
  const build = function (order) {
    const list = Linear.createLinkedList({ order: order, slots: size, rng: Random.seeded(5) });
    for (let i = 0; i < size; i += 1) list.push(i);
    return list.traverse();
  };

  const sequential = build('sequential');
  const scattered = build('scattered');

  const expected = (size * (size - 1)) / 2;
  assert.strictEqual(sequential.total, expected, 'the traversal visits every node');
  assert.strictEqual(scattered.total, expected, 'in the same logical order');
  assert.strictEqual(sequential.steps, scattered.steps);
  assert.strictEqual(sequential.bytesRead, scattered.bytesRead, 'and reads the same bytes');

  assert.ok(sequential.jumpRate < 0.01, 'sequential nodes are adjacent');
  assert.ok(scattered.jumpRate > 0.9, 'scattered nodes almost never are');

  assert.strictEqual(sequential.cacheLines, scattered.cacheLines,
    'both walks touch the same number of distinct lines - which is why distinct lines is the ' +
      'wrong measure for a single pass');
  assert.ok(scattered.cacheMisses > sequential.cacheMisses * 4,
    scattered.cacheMisses + ' misses scattered against ' + sequential.cacheMisses + ' sequential');
  assert.ok(sequential.cacheMisses <= Math.ceil((size * 8) / 64) + 1,
    'a sequential walk misses once per line and reuses it eight times');
});

/* ----------------------------------------------------------------- ring buffer */

test('ring buffer: capacity rounds to a power of two and one slot stays free', function () {
  [[3, 4], [5, 8], [8, 8], [100, 128]].forEach(function (pair) {
    const ring = Linear.createRingBuffer({ capacity: pair[0] });
    assert.strictEqual(ring.capacity, pair[1], 'requested ' + pair[0]);
    assert.strictEqual(ring.usable, pair[1] - 1);
  });
});

test('ring buffer: reject and overwrite differ only in what happens when full', function () {
  const fill = function (policy) {
    const ring = Linear.createRingBuffer({ capacity: 8, policy: policy });
    for (let i = 0; i < 20; i += 1) ring.push(i);
    const drained = [];
    while (!ring.isEmpty()) drained.push(ring.shift());
    return { drained: drained, dropped: ring.dropped() };
  };

  const rejected = fill('reject');
  assert.deepStrictEqual(rejected.drained, [0, 1, 2, 3, 4, 5, 6], 'the oldest seven survive');
  assert.strictEqual(rejected.dropped, 13, 'and 13 pushes were refused');

  const overwritten = fill('overwrite');
  assert.deepStrictEqual(overwritten.drained, [13, 14, 15, 16, 17, 18, 19], 'the newest seven survive');
  assert.strictEqual(overwritten.dropped, 13, 'and 13 items were dropped silently');
});

test('ring buffer: a long randomised sequence matches a reference queue', function () {
  const rng = Random.seeded(31);
  const ring = Linear.createRingBuffer({ capacity: 16, policy: 'reject' });
  const reference = [];

  for (let step = 0; step < 5000; step += 1) {
    if (rng.next() < 0.55) {
      const hadRoom = reference.length < ring.usable;
      const value = rng.int(1000);
      const accepted = ring.push(value);
      assert.strictEqual(accepted, hadRoom, 'accept decision at ' + step);
      if (accepted) reference.push(value);
    } else {
      assert.strictEqual(ring.shift(), reference.shift(), 'value at ' + step);
    }
    assert.strictEqual(ring.size(), reference.length, 'size at ' + step);
  }
});

/* ---------------------------------------------------------------- text buffers */

test('text buffers: all three structures agree with each other on any edit script', function () {
  const rng = Random.seeded(17);
  const initial = new Array(400).fill('.').join('');
  const script = [];
  let length = initial.length;

  for (let i = 0; i < 120; i += 1) {
    if (rng.next() < 0.75 || length < 10) {
      const text = 'abcde'.slice(0, 1 + rng.int(4));
      script.push({ op: 'insert', at: rng.int(length + 1), text: text });
      length += text.length;
    } else {
      const at = rng.int(length - 5);
      script.push({ op: 'delete', at: at, count: 1 + rng.int(4) });
      length -= script[script.length - 1].count;
    }
  }

  const result = TextBuffers.compare({ initial: initial, script: script });
  assert.strictEqual(result.agree, true, 'gap buffer, piece table and rope produce the same text');
  assert.strictEqual(result.text.length, length, 'and the expected length');
});

test('text buffers: typing at the cursor is free for a gap buffer, jumping is not', function () {
  const document = new Array(2000).fill('.').join('');

  const sequential = TextBuffers.createGapBuffer({ gap: 4096 });
  sequential.insert(0, document);
  sequential.insert(1000, 'x');                       // one cursor move to get there
  const before = sequential.stats().moved;
  for (let i = 1; i < 200; i += 1) sequential.insert(1000 + i, 'x');
  const typing = sequential.stats().moved - before;

  const jumping = TextBuffers.createGapBuffer({ gap: 4096 });
  jumping.insert(0, document);
  jumping.insert(1000, 'x');
  const jumpBase = jumping.stats().moved;
  for (let i = 1; i < 200; i += 1) jumping.insert(i % 2 === 0 ? 100 : 1900, 'x');
  const scattered = jumping.stats().moved - jumpBase;

  assert.strictEqual(typing, 0, 'typing forward at the gap moves nothing at all');
  assert.ok(scattered > 200000, 'alternating jumps moved ' + scattered + ' characters');
});

test('text buffers: a piece table never moves text, and the piece count grows with edits', function () {
  const table = TextBuffers.createPieceTable('hello world');
  for (let i = 0; i < 20; i += 1) table.insert(5, '!');

  assert.strictEqual(table.stats().moved, 0, 'no text was copied');
  assert.ok(table.stats().pieces > 20, 'but the piece list grew to ' + table.stats().pieces);
  assert.strictEqual(table.text(), 'hello' + new Array(20).fill('!').join('') + ' world');
});

test('text buffers: a rope keeps its height logarithmic in the document size', function () {
  const rope = TextBuffers.createRope('', 64);
  for (let i = 0; i < 400; i += 1) rope.insert(rope.length(), '0123456789');

  assert.strictEqual(rope.length(), 4000);
  assert.ok(rope.height() <= 40, 'height ' + rope.height() + ' for 4000 characters');
  assert.strictEqual(rope.text().length, 4000);
});

/* ------------------------------------------------------------------ allocators */

test('bump allocator: allocation is aligned, monotonic, and reset frees everything', function () {
  const bump = Allocators.createBumpAllocator({ bytes: 4096 });

  const first = bump.allocate(5, 8);
  const second = bump.allocate(8, 8);
  assert.strictEqual(first.address, 0);
  assert.strictEqual(second.address, 8, 'the second allocation is aligned past the first');
  assert.strictEqual(bump.used(), 16);

  bump.reset();
  assert.strictEqual(bump.used(), 0);
  assert.strictEqual(bump.allocate(4, 4).address, 0, 'the arena is reusable from the start');
});

test('bump allocator: a request larger than the arena fails rather than overflowing', function () {
  const bump = Allocators.createBumpAllocator({ bytes: 64 });
  assert.strictEqual(bump.allocate(128, 8), null);
  assert.strictEqual(bump.stats().failed, 1);
  assert.strictEqual(bump.used(), 0, 'and the failure did not move the top');
});

test('free list: slots are never handed out twice across a long churn', function () {
  const pool = Allocators.createFreeList({ slots: 64, slotBytes: 32 });
  const rng = Random.seeded(23);
  const live = [];

  for (let step = 0; step < 4000; step += 1) {
    if (live.length && rng.next() < 0.45) {
      pool.free(live.splice(rng.int(live.length), 1)[0]);
      continue;
    }
    const handle = pool.allocate();
    if (!handle) { assert.strictEqual(live.length, 64, 'only a full pool refuses'); continue; }
    assert.ok(!live.some(function (h) { return h.slot === handle.slot; }),
      'slot ' + handle.slot + ' handed out twice at step ' + step);
    live.push(handle);
  }

  assert.strictEqual(pool.map().filter(Boolean).length, live.length, 'the map matches the live set');
});

test('first fit: coalescing keeps a full free-and-reallocate cycle usable', function () {
  const heap = Allocators.createFirstFit({ bytes: 4096 });
  const handles = [];
  for (let i = 0; i < 16; i += 1) handles.push(heap.allocate(256));

  assert.ok(handles.every(Boolean), 'the heap holds exactly sixteen 256-byte blocks');
  assert.strictEqual(heap.allocate(1), null, 'and nothing more');

  handles.forEach(function (handle) { heap.free(handle); });
  const state = heap.fragmentation();
  assert.strictEqual(state.blocks, 1, 'coalescing merged everything back into one block');
  assert.strictEqual(state.largestFree, 4096);
  assert.strictEqual(state.ratio, 0);
  assert.ok(heap.allocate(4096), 'so the whole heap is allocatable again');
});

test('first fit: freeing every other block leaves memory free but unusable', function () {
  const heap = Allocators.createFirstFit({ bytes: 4096 });
  const handles = [];
  for (let i = 0; i < 16; i += 1) handles.push(heap.allocate(256));

  handles.forEach(function (handle, i) { if (i % 2 === 0) heap.free(handle); });

  const state = heap.fragmentation();
  assert.strictEqual(state.freeBytes, 8 * 256, 'half the heap is free');
  assert.strictEqual(state.largestFree, 256, 'in 256-byte holes');
  assert.ok(state.ratio > 0.87, 'fragmentation ratio ' + state.ratio.toFixed(2));
  assert.strictEqual(heap.allocate(512), null, 'a 512-byte request fails with 2 KB free');
});

/* --------------------------------------------------------------- cache layouts */

test('cache layouts: the Eytzinger permutation holds the same keys in tree order', function () {
  const sorted = [];
  for (let i = 0; i < 31; i += 1) sorted.push(i * 2);
  const layout = CacheLayouts.buildEytzinger(sorted);

  assert.strictEqual(layout.length, 32, 'index 0 is unused');
  assert.strictEqual(layout[1], 30, 'the root is the median');

  const inOrder = [];
  const walk = function (index) {
    if (index >= layout.length) return;
    walk(2 * index);
    inOrder.push(layout[index]);
    walk(2 * index + 1);
  };
  walk(1);
  assert.deepStrictEqual(inOrder, sorted);
});

test('cache layouts: every layout answers every query identically', function () {
  const sorted = [];
  for (let i = 0; i < 200; i += 1) sorted.push(i * 3);
  const eytzinger = CacheLayouts.buildEytzinger(sorted);
  const blocked = CacheLayouts.buildBlocked(sorted, 16);

  sorted.concat([1, 2, 601, -5]).forEach(function (target) {
    const present = target % 3 === 0 && target >= 0 && target < 600;
    const found = function (result) { return result >= 0; };

    assert.strictEqual(found(CacheLayouts.sortedSearch(sorted, target, CacheLayouts.tracker())), present,
      'sorted ' + target);
    assert.strictEqual(found(CacheLayouts.eytzingerSearch(eytzinger, target, CacheLayouts.tracker())), present,
      'eytzinger ' + target);
    assert.strictEqual(found(CacheLayouts.blockedSearch(blocked, target, CacheLayouts.tracker())), present,
      'blocked ' + target);
  });
});

test('cache layouts: comparisons barely move while cache misses do', function () {
  const result = CacheLayouts.compare({
    n: 65536, queries: 400, blockSize: 16, cacheLines: 512, rng: Random.seeded(7)
  });
  const byName = {};
  result.layouts.forEach(function (entry) { byName[entry.name] = entry; });

  assert.strictEqual(byName.sorted.comparisonsPerQuery, byName.eytzinger.comparisonsPerQuery,
    'the two binary searches do exactly the same number of comparisons');
  assert.ok(Math.abs(byName.sorted.cacheLinesPerQuery - byName.eytzinger.cacheLinesPerQuery) < 1,
    'and touch about the same number of distinct lines per query');

  assert.ok(byName.eytzinger.missesPerQuery < byName.sorted.missesPerQuery,
    'but eytzinger keeps more of the tree resident: ' + byName.eytzinger.missesPerQuery.toFixed(2) +
      ' misses against ' + byName.sorted.missesPerQuery.toFixed(2));
  assert.ok(byName.blocked.missesPerQuery < byName.eytzinger.missesPerQuery,
    'and the blocked layout is better still at ' + byName.blocked.missesPerQuery.toFixed(2));
  assert.strictEqual(byName.sorted.foundRate, 1, 'every generated query is present');
});

test('cache layouts: with a cache big enough to hold the keys nothing misses twice', function () {
  const n = 4096;
  const result = CacheLayouts.compare({
    n: n, queries: 3000, blockSize: 16, rng: Random.seeded(3),
    cacheLines: CacheSim.linesFor(n * CacheLayouts.KEY_BYTES * 2, CacheLayouts.LINE_BYTES)
  });

  result.layouts.forEach(function (layout) {
    assert.ok(layout.missesPerQuery < 0.2,
      layout.name + ' still missed ' + layout.missesPerQuery.toFixed(2) + ' times per query');
  });
});

/* ------------------------------------------------------------------ call stack */

test('call stack: the iterative traversal matches the recursive one exactly', function () {
  ['balanced', 'degenerate'].forEach(function (shape) {
    const result = CallStack.compare({ count: 1023, shape: shape });
    assert.strictEqual(result.sameOrder, true, shape + ' order');
    assert.strictEqual(result.recursive.order.length, 1023);
    assert.strictEqual(result.iterative.order.length, 1023);
  });
});

test('call stack: depth is logarithmic when balanced and linear when degenerate', function () {
  const balanced = CallStack.compare({ count: 1023, shape: 'balanced' });
  const degenerate = CallStack.compare({ count: 1023, shape: 'degenerate' });

  assert.strictEqual(balanced.recursive.peakDepth, 10, '2^10 - 1 nodes recurse ten deep');
  assert.strictEqual(degenerate.recursive.peakDepth, 1023, 'a chain recurses once per node');
  assert.ok(degenerate.recursive.peakBytes > balanced.recursive.peakBytes * 100,
    'and that is memory: ' + degenerate.recursive.peakBytes + ' bytes against ' + balanced.recursive.peakBytes);
});

test('call stack: the explicit stack holds indices, not frames', function () {
  const result = CallStack.compare({ count: 1023, shape: 'degenerate' });
  const perLevel = result.iterative.peakBytes / result.iterative.peakDepth;

  assert.strictEqual(perLevel, 8, 'one index per level');
  assert.ok(result.iterative.peakBytes * 10 < result.recursive.peakBytes,
    'an order of magnitude less memory for the same traversal');
});

test('call stack: the recursion reports an overflow instead of crashing the test run', function () {
  const result = CallStack.recursiveInOrder(
    CallStack.buildTree({ count: 5000, shape: 'degenerate' }), { maxDepth: 500 });

  assert.strictEqual(result.overflowed, true);
  assert.strictEqual(result.peakDepth, 500, 'the guard stopped exactly at the stated budget');
});

/* ------------------------------------------------------------- cache simulator */

test('cache sim: a sequential sweep misses once per line and hits the rest', function () {
  const cache = CacheSim.create({ lines: 512, lineBytes: 64 });
  for (let i = 0; i < 4096; i += 1) cache.access(i * 4, 4);

  const stats = cache.stats();
  assert.strictEqual(stats.accesses, 4096);
  assert.strictEqual(stats.misses, 256, '16 KB over 64-byte lines');
  assert.strictEqual(stats.hits, 4096 - 256);
  assert.strictEqual(stats.evictions, 0, 'it all fits in 32 KB');
  assert.strictEqual(stats.bytesFetched, 256 * 64);
});

test('cache sim: re-reading a working set larger than the cache misses every time', function () {
  const cache = CacheSim.create({ lines: 8, lineBytes: 64 });
  for (let pass = 0; pass < 4; pass += 1) {
    for (let line = 0; line < 16; line += 1) cache.access(line * 64, 4);
  }

  const stats = cache.stats();
  assert.strictEqual(stats.misses, 64, 'LRU is the worst policy for a cyclic sweep');
  assert.strictEqual(stats.hits, 0);
  assert.strictEqual(stats.distinctLines, 16);
});

test('cache sim: an access straddling a line boundary costs two fetches', function () {
  const cache = CacheSim.create({ lines: 16, lineBytes: 64 });
  cache.access(60, 8);

  assert.strictEqual(cache.stats().accesses, 1);
  assert.strictEqual(cache.stats().misses, 2, 'bytes 60..67 live in two lines');
});

test('cache sim: replaying a memory log gives the same answer as live accesses', function () {
  const memory = MemoryModel.create({ bytes: 1 << 16 });
  for (let i = 0; i < 512; i += 1) memory.write(i * 4, 'i32', i, 'fill');
  memory.clearLog();
  for (let i = 0; i < 512; i += 1) memory.read(i * 4, 'i32', 'scan');

  const replayed = CacheSim.replay({ log: memory.log(), lines: 64 });
  const live = CacheSim.create({ lines: 64 });
  for (let i = 0; i < 512; i += 1) live.access(i * 4, 4);

  assert.deepStrictEqual(replayed, live.stats());
  assert.strictEqual(replayed.misses, 32, '2 KB of i32 over 64-byte lines');
});

test('cache sim: linesFor rounds a byte budget up to whole lines', function () {
  assert.strictEqual(CacheSim.linesFor(32 * 1024), 512);
  assert.strictEqual(CacheSim.linesFor(65), 2);
  assert.strictEqual(CacheSim.linesFor(0), 1, 'never zero');
});

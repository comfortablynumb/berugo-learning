/**
 * The linear structures of M02, built over MemoryModel so every operation's
 * cost is a counted access rather than an assertion.
 *
 * Contains: array layouts (AoS vs SoA), a dynamic array with a growth policy,
 * a linked list with sequential or scattered node placement, and a ring buffer
 * with power-of-two masking.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LinearStructures = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  function memoryModel() {
    if (scope && scope.MemoryModel) return scope.MemoryModel;
    return require('../machines/memory-model.js');
  }

  function cacheSim() {
    if (scope && scope.CacheSim) return scope.CacheSim;
    return require('../machines/cache-sim.js');
  }

  /* ------------------------------------------------------------ array layout */

  /**
   * Array of structs versus struct of arrays, over the same records.
   * `sumField` touches one field of every record and reports the bytes it had
   * to read to get there - which is the entire argument.
   */
  function createRecordArray(options) {
    const MemoryModel = memoryModel();
    const fields = options.fields;
    const count = options.count;
    const soa = Boolean(options.soa);
    const plan = MemoryModel.layout(fields);
    const memory = options.memory || MemoryModel.create({ bytes: Math.max(4096, plan.stride * count * 2) });

    // SoA places each field in its own contiguous run; AoS interleaves them.
    const columnBase = {};
    if (soa) {
      let base = 0;
      plan.fields.forEach(function (field) {
        columnBase[field.name] = base;
        base += field.bytes * count;
      });
    }

    function addressOf(index, name) {
      const field = plan.fields.find(function (entry) { return entry.name === name; });
      return soa ? columnBase[name] + index * field.bytes : index * plan.stride + field.offset;
    }

    function set(index, name, value) {
      const field = plan.fields.find(function (entry) { return entry.name === name; });
      memory.write(addressOf(index, name), field.type, value, name);
    }

    function get(index, name) {
      const field = plan.fields.find(function (entry) { return entry.name === name; });
      return memory.read(addressOf(index, name), field.type, name);
    }

    /** Reads one field of every record; the counters show what it cost. */
    function sumField(name) {
      memory.resetCounters();
      memory.clearLog();
      let total = 0;
      for (let i = 0; i < count; i += 1) total += get(i, name);

      const counters = memory.counters();
      const field = plan.fields.find(function (entry) { return entry.name === name; });
      const cache = cacheSim().replay({ log: memory.log(), lines: options.cacheLines || 512 });
      const cacheLines = cache.distinctLines;

      return {
        total: total,
        bytesNeeded: field.bytes * count,
        bytesRead: counters.bytesRead,
        cacheLines: cacheLines,
        cacheMisses: cache.misses,
        bytesFetched: cache.bytesFetched,
        layout: soa ? 'soa' : 'aos',
        stride: soa ? field.bytes : plan.stride
      };
    }

    return { plan: plan, memory: memory, set: set, get: get, sumField: sumField, addressOf: addressOf };
  }

  /** Distinct 64-byte lines an access log touched - the real cost unit. */
  function countLines(log, lineBytes) {
    const lines = new Set();
    log.forEach(function (entry) {
      const first = Math.floor(entry.address / lineBytes);
      const last = Math.floor((entry.address + entry.bytes - 1) / lineBytes);
      for (let line = first; line <= last; line += 1) lines.add(line);
    });
    return lines.size;
  }

  /* ----------------------------------------------------------- dynamic array */

  function createDynamicArray(options) {
    const settings = options || {};
    const MemoryModel = memoryModel();
    const type = settings.type || 'i32';
    const factor = settings.factor || 2;
    const memory = settings.memory || MemoryModel.create({ bytes: settings.bytes || 1 << 20 });
    const width = memory.bytesOf(type);

    let base = 0;
    let capacity = settings.initialCapacity || 1;
    let length = 0;
    let allocTop = capacity * width;
    const events = [];

    function grow() {
      const next = Math.max(capacity + 1, Math.ceil(capacity * factor));
      const newBase = allocTop;
      allocTop += next * width;
      if (length) memory.copyWithin(newBase, base, length * width, 'grow');
      events.push({ op: 'grow', from: capacity, to: next, copied: length, base: newBase });
      base = newBase;
      capacity = next;
    }

    function push(value) {
      if (length === capacity) grow();
      memory.write(base + length * width, type, value, 'push');
      length += 1;
      return length;
    }

    function get(index) {
      if (index < 0 || index >= length) throw new RangeError('index ' + index + ' out of range');
      return memory.read(base + index * width, type, 'get');
    }

    function insertAt(index, value) {
      if (length === capacity) grow();
      const moved = length - index;
      if (moved > 0) memory.copyWithin(base + (index + 1) * width, base + index * width, moved * width, 'shift');
      memory.write(base + index * width, type, value, 'insert');
      length += 1;
      return moved;
    }

    function removeAt(index) {
      const value = get(index);
      const moved = length - index - 1;
      if (moved > 0) memory.copyWithin(base + index * width, base + (index + 1) * width, moved * width, 'shift');
      length -= 1;
      return { value: value, moved: moved };
    }

    function toArray() {
      const out = [];
      for (let i = 0; i < length; i += 1) out.push(get(i));
      return out;
    }

    return {
      push: push, get: get, insertAt: insertAt, removeAt: removeAt, toArray: toArray,
      memory: memory,
      length: function () { return length; },
      capacity: function () { return capacity; },
      base: function () { return base; },
      events: function () { return events.slice(); }
    };
  }

  /* -------------------------------------------------------------- linked list */

  /**
   * A singly linked list whose nodes are placed either sequentially or
   * scattered through memory. Same list, same operations - the traversal cost
   * differs only by where the nodes sit.
   */
  function createLinkedList(options) {
    const settings = options || {};
    const MemoryModel = memoryModel();
    const memory = settings.memory || MemoryModel.create({ bytes: settings.bytes || 1 << 20 });
    const NODE_BYTES = 8;                       // i32 value + i32 next
    const slots = settings.slots || 4096;
    const order = settings.order || 'sequential';
    const rng = settings.rng;

    const placement = buildPlacement(slots, order, rng);
    let head = -1;
    let tail = -1;
    let used = 0;

    function addressOf(slot) {
      return placement[slot] * NODE_BYTES;
    }

    function push(value) {
      if (used >= slots) throw new RangeError('list is full');
      const slot = used;
      used += 1;
      memory.write(addressOf(slot), 'i32', value, 'value');
      memory.write(addressOf(slot) + 4, 'i32', -1, 'next');
      if (tail >= 0) memory.write(addressOf(tail) + 4, 'i32', slot, 'link');
      else head = slot;
      tail = slot;
      return slot;
    }

    /** Walks the list, counting accesses and the distinct cache lines touched. */
    function traverse() {
      memory.resetCounters();
      memory.clearLog();
      let total = 0;
      let cursor = head;
      let steps = 0;
      let jumps = 0;
      let previousAddress = -1;

      while (cursor >= 0 && steps <= slots) {
        const address = addressOf(cursor);
        total += memory.read(address, 'i32', 'value');
        if (previousAddress >= 0 && address !== previousAddress + NODE_BYTES) jumps += 1;
        previousAddress = address;
        cursor = memory.read(address + 4, 'i32', 'next');
        steps += 1;
      }

      const cache = cacheSim().replay({ log: memory.log(), lines: settings.cacheLines || 512 });

      return {
        total: total,
        steps: steps,
        jumps: jumps,
        jumpRate: steps ? jumps / steps : 0,
        cacheLines: cache.distinctLines,
        cacheMisses: cache.misses,
        missRate: cache.missRate,
        bytesFetched: cache.bytesFetched,
        bytesRead: memory.counters().bytesRead,
        order: order
      };
    }

    return { push: push, traverse: traverse, memory: memory, length: function () { return used; } };
  }

  function buildPlacement(slots, order, rng) {
    const placement = [];
    for (let i = 0; i < slots; i += 1) placement.push(i);
    if (order === 'scattered' && rng) return rng.shuffle(placement);
    if (order === 'reversed') return placement.reverse();
    return placement;
  }

  /* -------------------------------------------------------------- ring buffer */

  /**
   * A ring buffer with power-of-two masking. Full and empty are distinguished
   * by keeping one slot unused, which is the choice that makes the
   * single-producer/single-consumer version lock-free in M47.
   */
  function createRingBuffer(options) {
    const settings = options || {};
    const requested = settings.capacity || 8;
    const capacity = nextPowerOfTwo(requested);
    const mask = capacity - 1;
    const slots = new Array(capacity).fill(null);
    const policy = settings.policy || 'reject';   // reject | overwrite

    let head = 0;      // next read
    let tail = 0;      // next write
    let dropped = 0;

    function size() {
      return (tail - head) & mask;
    }

    function isFull() {
      return size() === capacity - 1;
    }

    function push(value) {
      if (isFull()) {
        if (policy === 'reject') { dropped += 1; return false; }
        head = (head + 1) & mask;               // overwrite the oldest
        dropped += 1;
      }
      slots[tail] = value;
      tail = (tail + 1) & mask;
      return true;
    }

    function shift() {
      if (size() === 0) return undefined;
      const value = slots[head];
      slots[head] = null;
      head = (head + 1) & mask;
      return value;
    }

    return {
      push: push,
      shift: shift,
      size: size,
      isFull: isFull,
      isEmpty: function () { return size() === 0; },
      capacity: capacity,
      usable: capacity - 1,
      dropped: function () { return dropped; },
      state: function () { return { head: head, tail: tail, slots: slots.slice() }; }
    };
  }

  function nextPowerOfTwo(n) {
    let value = 1;
    while (value < n) value *= 2;
    return value;
  }

  return {
    createRecordArray: createRecordArray,
    createDynamicArray: createDynamicArray,
    createLinkedList: createLinkedList,
    createRingBuffer: createRingBuffer,
    countLines: countLines,
    nextPowerOfTwo: nextPowerOfTwo
  };
}));

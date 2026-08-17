/**
 * Graded exercises for the platform sections.
 *
 * A test's `assert` function is serialised and rebuilt inside the sandbox, so
 * it must be self-contained: it may use its two arguments (the learner's
 * function and the api) and nothing from this file's scope. The api carries
 * `assert`, a seeded `rng`, the shared `ops` counters and `log`.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'code-engine': [
      {
        id: 'budget',
        title: 'Finish inside the budget',
        prompt: 'hasDuplicate(values) returns true when any value appears twice. The version below is ' +
          'quadratic: on 20 000 values it will not finish before the 1.2 s budget and the worker is ' +
          'terminated. Make it finish - the answer must stay exactly the same.',
        entry: 'hasDuplicate',
        timeoutMs: 1200,
        starterFailure: 'timeout',
        starter: [
          'function hasDuplicate(values) {',
          '  for (let i = 0; i < values.length; i += 1) {',
          '    for (let j = i + 1; j < values.length; j += 1) {',
          '      if (values[i] === values[j]) return true;',
          '    }',
          '  }',
          '  return false;',
          '}'
        ].join('\n'),
        solution: [
          'function hasDuplicate(values) {',
          '  const seen = new Set();',
          '  for (const value of values) {',
          '    if (seen.has(value)) return true;',
          '    seen.add(value);',
          '  }',
          '  return false;',
          '}'
        ].join('\n'),
        tests: [
          {
            name: 'small cases are correct',
            assert: function (hasDuplicate, api) {
              api.assert.equal(hasDuplicate([]), false, 'empty');
              api.assert.equal(hasDuplicate([1]), false, 'single');
              api.assert.equal(hasDuplicate([1, 2, 3]), false, 'distinct');
              api.assert.equal(hasDuplicate([1, 2, 1]), true, 'repeat at the ends');
              api.assert.equal(hasDuplicate([5, 5]), true, 'adjacent repeat');
            }
          },
          {
            name: '20 000 distinct values finish inside the budget',
            assert: function (hasDuplicate, api) {
              const values = [];
              for (let i = 0; i < 20000; i += 1) values.push(i * 3 + 1);
              api.assert.equal(hasDuplicate(values), false, 'no duplicates present');
            }
          },
          {
            name: 'a duplicate at the very end is still found',
            assert: function (hasDuplicate, api) {
              const values = [];
              for (let i = 0; i < 20000; i += 1) values.push(i);
              values.push(19999);
              api.assert.equal(hasDuplicate(values), true, 'duplicate at the tail');
            }
          }
        ]
      },
      {
        id: 'counted-search',
        title: 'Measure what you actually do',
        prompt: 'Implement binary search, but route every comparison through the instrumented ops ' +
          'counter: call ops.cmp(a, b), which returns -1, 0 or 1 and counts the comparison. The tests ' +
          'check the answer and the comparison count - this is how every cost claim on this platform ' +
          'is checked.',
        entry: 'search',
        starter: [
          '// ops.cmp(a, b) returns -1, 0 or 1 and counts one comparison.',
          'function search(sorted, target) {',
          '  let lo = 0;',
          '  let hi = sorted.length;        // half-open: [lo, hi)',
          '  while (lo < hi) {',
          '    const mid = lo + ((hi - lo) >> 1);',
          '    // replace this linear step with the comparison-driven one',
          '    if (ops.cmp(sorted[lo], target) === 0) return lo;',
          '    lo += 1;',
          '  }',
          '  return -1;',
          '}'
        ].join('\n'),
        solution: [
          'function search(sorted, target) {',
          '  let lo = 0;',
          '  let hi = sorted.length;',
          '  while (lo < hi) {',
          '    const mid = lo + ((hi - lo) >> 1);',
          '    const order = ops.cmp(sorted[mid], target);',
          '    if (order === 0) return mid;',
          '    if (order < 0) lo = mid + 1;',
          '    else hi = mid;',
          '  }',
          '  return -1;',
          '}'
        ].join('\n'),
        tests: [
          {
            name: 'finds every element of a 1024-element array',
            assert: function (search, api) {
              const sorted = [];
              for (let i = 0; i < 1024; i += 1) sorted.push(i * 2);
              for (let i = 0; i < 1024; i += 1) {
                api.assert.equal(search(sorted, i * 2), i, 'index of value ' + (i * 2));
              }
            }
          },
          {
            name: 'reports -1 for absent values, including outside the range',
            assert: function (search, api) {
              const sorted = [2, 4, 6, 8, 10];
              api.assert.equal(search(sorted, 5), -1, 'gap');
              api.assert.equal(search(sorted, 1), -1, 'below');
              api.assert.equal(search(sorted, 11), -1, 'above');
              api.assert.equal(search([], 1), -1, 'empty array');
            }
          },
          {
            name: 'uses at most ceil(log2 n) + 1 comparisons per lookup',
            assert: function (search, api) {
              const sorted = [];
              for (let i = 0; i < 1024; i += 1) sorted.push(i);
              const budget = Math.ceil(Math.log2(sorted.length)) + 1;
              for (let i = 0; i < 64; i += 1) {
                const target = api.rng.int(sorted.length);
                const before = api.ops.snapshot().cmp || 0;
                search(sorted, target);
                const used = (api.ops.snapshot().cmp || 0) - before;
                api.assert.atMost(used, budget, 'comparisons for target ' + target);
                api.assert.atLeast(used, 1, 'the search must use ops.cmp');
              }
            }
          }
        ]
      }
    ],

    'js-systems': [
      {
        id: 'varint',
        title: 'Read a LEB128 varint',
        prompt: 'Decode an unsigned LEB128 varint from a DataView: seven payload bits per byte, ' +
          'little-endian, and the high bit set means "another byte follows". Return ' +
          '{ value, next } where next is the offset just past the varint.',
        entry: 'readVarint',
        starter: [
          'function readVarint(view, offset) {',
          '  let value = 0;',
          '  let shift = 0;',
          '  let i = offset;',
          '  // read bytes until the continuation bit is clear',
          '  return { value: view.getUint8(i), next: i + 1 };',
          '}'
        ].join('\n'),
        solution: [
          'function readVarint(view, offset) {',
          '  let value = 0;',
          '  let shift = 0;',
          '  let i = offset;',
          '  for (;;) {',
          '    const byte = view.getUint8(i);',
          '    i += 1;',
          '    value += (byte & 0x7f) * Math.pow(2, shift);',
          '    if ((byte & 0x80) === 0) break;',
          '    shift += 7;',
          '  }',
          '  return { value: value, next: i };',
          '}'
        ].join('\n'),
        tests: [
          {
            name: 'single-byte values decode',
            assert: function (readVarint, api) {
              const view = new DataView(new Uint8Array([0x00, 0x01, 0x7f]).buffer);
              api.assert.deepEqual(readVarint(view, 0), { value: 0, next: 1 }, 'zero');
              api.assert.deepEqual(readVarint(view, 1), { value: 1, next: 2 }, 'one');
              api.assert.deepEqual(readVarint(view, 2), { value: 127, next: 3 }, 'max single byte');
            }
          },
          {
            name: 'multi-byte values decode, and the offset advances',
            assert: function (readVarint, api) {
              const view = new DataView(new Uint8Array([0xe5, 0x8e, 0x26, 0x80, 0x01]).buffer);
              api.assert.deepEqual(readVarint(view, 0), { value: 624485, next: 3 }, '624485');
              api.assert.deepEqual(readVarint(view, 3), { value: 128, next: 5 }, '128');
            }
          },
          {
            name: 'round-trips values that exceed 32 bits of payload',
            assert: function (readVarint, api) {
              const encode = function (n) {
                const bytes = [];
                let rest = n;
                do {
                  const byte = rest % 128;
                  rest = Math.floor(rest / 128);
                  bytes.push(rest > 0 ? byte | 0x80 : byte);
                } while (rest > 0);
                return bytes;
              };
              const cases = [300, 1e6, 2147483648, 68719476735];
              cases.forEach(function (n) {
                const view = new DataView(new Uint8Array(encode(n)).buffer);
                api.assert.equal(readVarint(view, 0).value, n, 'value ' + n);
              });
            }
          }
        ]
      },
      {
        id: 'hash-combine',
        title: 'Combine two hashes without collapsing them',
        prompt: 'combine(a, b) must mix two 32-bit hashes into one. XOR is the obvious answer and it ' +
          'is wrong: it makes (a, b) collide with (b, a). Use Math.imul-based mixing and return an ' +
          'unsigned 32-bit result. The tests check order sensitivity and avalanche.',
        entry: 'combine',
        starter: [
          '// Math.imul(a, b) multiplies as 32-bit ints. >>> 0 makes a value unsigned.',
          'function combine(a, b) {',
          '  return (a ^ b) >>> 0;   // order-insensitive: fix this',
          '}'
        ].join('\n'),
        solution: [
          'function combine(a, b) {',
          '  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) >>> 0;',
          '  h = (h ^ (h >>> 13)) >>> 0;',
          '  h = Math.imul(h ^ b, 0xc2b2ae35) >>> 0;',
          '  h = (h ^ (h >>> 16)) >>> 0;',
          '  return h >>> 0;',
          '}'
        ].join('\n'),
        tests: [
          {
            name: 'returns an unsigned 32-bit integer',
            assert: function (combine, api) {
              for (let i = 0; i < 50; i += 1) {
                const a = api.rng.int(4294967295);
                const b = api.rng.int(4294967295);
                const out = combine(a, b);
                api.assert.ok(Number.isInteger(out), 'integer result');
                api.assert.atLeast(out, 0, 'unsigned');
                api.assert.atMost(out, 4294967295, 'fits in 32 bits');
              }
            }
          },
          {
            name: 'order matters: combine(a, b) !== combine(b, a)',
            assert: function (combine, api) {
              let differing = 0;
              for (let i = 0; i < 100; i += 1) {
                const a = api.rng.int(4294967295);
                const b = api.rng.int(4294967295);
                if (a !== b && combine(a, b) !== combine(b, a)) differing += 1;
              }
              api.assert.atLeast(differing, 95, 'swapped pairs should nearly always differ');
            }
          },
          {
            name: 'avalanche: one input bit flips about half the output bits',
            assert: function (combine, api) {
              const samples = 160;
              const flips = new Array(32).fill(0);
              for (let s = 0; s < samples; s += 1) {
                const a = api.rng.int(4294967295);
                const b = api.rng.int(4294967295);
                const base = combine(a, b) >>> 0;
                const bit = api.rng.int(32);
                const changed = combine((a ^ (1 << bit)) >>> 0, b) >>> 0;
                const diff = (base ^ changed) >>> 0;
                for (let k = 0; k < 32; k += 1) if ((diff >>> k) & 1) flips[k] += 1;
              }
              const rates = flips.map(function (n) { return n / samples; });
              const worst = rates.reduce(function (acc, r) { return Math.min(acc, Math.min(r, 1 - r)); }, 1);
              api.assert.atLeast(worst, 0.3, 'every output bit should flip 30-70% of the time');
            }
          }
        ]
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));

/**
 * Graded exercises for integer representation, bit tricks and bitsets
 * (M17.1-M17.3).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'integer-representation': [{
      id: 'add-with-flags',
      title: 'The two flags one adder raises',
      prompt: 'addWithOverflowFlags(a, b, bits) must return { value, carry, overflow } for a ' +
        'width of `bits` bits, read as signed. The operands arrive as BigInt and may be written ' +
        'either way round — 255n and −1n are the same eight-bit pattern — so start by reducing ' +
        'both to their patterns: `p = ((x % span) + span) % span`, where `span` is `1n << ' +
        'BigInt(bits)`. Then compute the SAME addition twice. Reading both patterns as unsigned ' +
        'gives a sum whose escape from 0 … span − 1 is the `carry` flag. Reading both as two’s ' +
        'complement — subtract `span` from a pattern that reaches `span / 2n` — gives a sum whose ' +
        'escape from −span/2 … span/2 − 1 is the `overflow` flag. `value` is that signed sum read ' +
        'back at this width. Computing carry from the signed sum instead is the trap: at eight ' +
        'bits (−1) + 1 is 0, which is inside 0 … 255, so that version reports no carry — and the ' +
        'hardware raises one, because 0xFF + 0x01 is 0x100 and something left the top bit. The ' +
        'starter makes exactly that mistake.',
      entry: 'addWithOverflowFlags',
      starter: [
        'function addWithOverflowFlags(a, b, bits) {',
        '  const span = 1n << BigInt(bits);',
        '  const half = span >> 1n;',
        '',
        '  // the operands taken as VALUES, which is where this goes wrong',
        '  const exact = a + b;',
        '  let raw = exact % span;',
        '  if (raw < 0n) raw += span;',
        '  const value = raw >= half ? raw - span : raw;',
        '',
        '  return {',
        '    value: value,',
        '    carry: exact < 0n || exact > span - 1n,',
        '    overflow: exact < -half || exact > half - 1n',
        '  };',
        '}'
      ].join('\n'),
      solution: [
        'function addWithOverflowFlags(a, b, bits) {',
        '  const span = 1n << BigInt(bits);',
        '  const half = span >> 1n;',
        '',
        '  function patternOf(x) { return ((x % span) + span) % span; }',
        '  function signedOf(p) { return p >= half ? p - span : p; }',
        '',
        '  const pa = patternOf(a);',
        '  const pb = patternOf(b);',
        '',
        '  // the same addition, read two ways',
        '  const asUnsigned = pa + pb;',
        '  const asSigned = signedOf(pa) + signedOf(pb);',
        '',
        '  let raw = asSigned % span;',
        '  if (raw < 0n) raw += span;',
        '',
        '  return {',
        '    value: raw >= half ? raw - span : raw,',
        '    carry: asUnsigned > span - 1n,',
        '    overflow: asSigned < -half || asSigned > half - 1n',
        '  };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the canonical pair: 0xFF + 0x01 carries, 0x7F + 0x01 overflows',
          assert: function (addWithOverflowFlags, api) {
            const carryOnly = addWithOverflowFlags(255n, 1n, 8);
            api.assert.equal(carryOnly.carry, true,
              'the patterns 0xFF and 0x01 add to 0x100, so something left the top bit');
            api.assert.equal(carryOnly.overflow, false,
              'read as two\u2019s complement that addition is (\u22121) + 1 = 0');
            api.assert.equal(carryOnly.value, 0n, 'and the width stores zero');

            const overflowOnly = addWithOverflowFlags(127n, 1n, 8);
            api.assert.equal(overflowOnly.carry, false, '128 is inside 0 \u2026 255');
            api.assert.equal(overflowOnly.overflow, true, '128 is above 127');
            api.assert.equal(overflowOnly.value, -128n, 'one past the top lands on the bottom');
          }
        },
        {
          name: 'the same pattern written either way gives the same answer',
          assert: function (addWithOverflowFlags, api) {
            const asUnsigned = addWithOverflowFlags(255n, 1n, 8);
            const asSigned = addWithOverflowFlags(-1n, 1n, 8);

            api.assert.equal(asSigned.carry, asUnsigned.carry,
              '255n and \u22121n are the same eight-bit pattern, so the flags must match');
            api.assert.equal(asSigned.overflow, asUnsigned.overflow, 'and so must overflow');
            api.assert.equal(asSigned.value, asUnsigned.value, 'and so must the stored value');

            const big = addWithOverflowFlags(300n, 0n, 8);
            api.assert.equal(big.value, 44n, '300 is the pattern 44 at eight bits');
          }
        },
        {
          name: 'all four flag combinations occur, so the two are not one flag twice',
          assert: function (addWithOverflowFlags, api) {
            const seen = { '00': 0, '01': 0, '10': 0, '11': 0 };

            for (let trial = 0; trial < 4000; trial += 1) {
              const a = BigInt(api.rng.int(256));
              const b = BigInt(api.rng.int(256));
              const got = addWithOverflowFlags(a, b, 8);
              seen[(got.carry ? '1' : '0') + (got.overflow ? '1' : '0')] += 1;
            }
            api.assert.ok(seen['10'] > 0, 'no input carried without overflowing');
            api.assert.ok(seen['01'] > 0, 'no input overflowed without carrying');
            api.assert.ok(seen['11'] > 0, 'no input raised both');
            api.assert.ok(seen['00'] > 0, 'no input raised neither');
          }
        },
        {
          name: '4 000 random pairs at four widths agree with an exact reference',
          assert: function (addWithOverflowFlags, api) {
            const widths = [8, 16, 32, 64];

            for (let trial = 0; trial < 4000; trial += 1) {
              const bits = widths[api.rng.int(widths.length)];
              const span = 1n << BigInt(bits);
              const half = span >> 1n;
              const a = BigInt(api.rng.int(1000000)) - 500000n;
              const b = BigInt(api.rng.int(1000000)) - 500000n;

              const pa = ((a % span) + span) % span;
              const pb = ((b % span) + span) % span;
              const sa = pa >= half ? pa - span : pa;
              const sb = pb >= half ? pb - span : pb;
              const asSigned = sa + sb;

              let raw = asSigned % span;
              if (raw < 0n) raw += span;
              const got = addWithOverflowFlags(a, b, bits);

              api.assert.equal(got.value, raw >= half ? raw - span : raw,
                'stored value at ' + bits + ' bits');
              api.assert.equal(got.carry, pa + pb > span - 1n,
                'carry at ' + bits + ' bits for ' + a + ' + ' + b);
              api.assert.equal(got.overflow, asSigned < -half || asSigned > half - 1n,
                'overflow at ' + bits + ' bits for ' + a + ' + ' + b);
            }
          }
        }
      ]
    }],

    'bit-manipulation': [{
      id: 'popcount-and-ctz',
      title: 'Population count by SWAR, and a bit scan by De Bruijn',
      prompt: 'Return an object with four members. `popcount(x)` counts the set bits of a 32-bit ' +
        'word by the SWAR reduction. `stages(x)` returns the three intermediate words of that ' +
        'reduction as an array — after the pair sum `v - ((v >>> 1) & 0x55555555)`, after the ' +
        'nibble sum `(v & 0x33333333) + ((v >>> 2) & 0x33333333)`, and after the byte sum ' +
        '`(v + (v >>> 4)) & 0x0f0f0f0f` — each forced unsigned with `>>> 0`; the final total is ' +
        '`Math.imul(v, 0x01010101) >>> 24`. `table` is the 32-entry De Bruijn lookup you build ' +
        'yourself, by setting `table[Math.imul(0x077cb531, 1 << i) >>> 27] = i` for every i; each ' +
        'five-bit window of that constant is distinct, which is what makes the table an exact ' +
        'inverse. `ctz(x)` returns the count of trailing zeros — 32 for zero — by isolating the ' +
        'lowest set bit with `x & -x`, multiplying it by the same constant with `Math.imul`, ' +
        'shifting right by 27 and reading the table. Use `>>>` throughout: `>>` sign-extends and ' +
        'every value here is unsigned. The starter loops over all 32 positions, which is correct ' +
        'and produces neither the stages nor the table.',
      entry: 'bitKit',
      starter: [
        'function bitKit() {',
        '  function popcount(x) {',
        '    let value = x >>> 0;',
        '    let count = 0;',
        '    for (let i = 0; i < 32; i += 1) { count += value & 1; value >>>= 1; }',
        '    return count;',
        '  }',
        '',
        '  function ctz(x) {',
        '    const value = x >>> 0;',
        '    if (value === 0) return 32;',
        '    let index = 0;',
        '    while (((value >>> index) & 1) === 0) index += 1;',
        '    return index;',
        '  }',
        '',
        '  // no reduction to report and no table to invert',
        '  return { popcount: popcount, ctz: ctz, stages: null, table: null };',
        '}'
      ].join('\n'),
      solution: [
        'function bitKit() {',
        '  const DE_BRUIJN = 0x077cb531;',
        '',
        '  // every 5-bit window of the constant is distinct, so the shifted',
        '  // top five bits name the exponent exactly once each',
        '  const table = new Array(32);',
        '  for (let i = 0; i < 32; i += 1) {',
        '    table[Math.imul(DE_BRUIJN, 1 << i) >>> 27] = i;',
        '  }',
        '',
        '  function stages(x) {',
        '    let v = x >>> 0;',
        '    const out = [];',
        '    v = (v - ((v >>> 1) & 0x55555555)) >>> 0;',
        '    out.push(v);',
        '    v = ((v & 0x33333333) + ((v >>> 2) & 0x33333333)) >>> 0;',
        '    out.push(v);',
        '    v = ((v + (v >>> 4)) & 0x0f0f0f0f) >>> 0;',
        '    out.push(v);',
        '    return out;',
        '  }',
        '',
        '  function popcount(x) {',
        '    const reduced = stages(x);',
        '    return Math.imul(reduced[2], 0x01010101) >>> 24;',
        '  }',
        '',
        '  function ctz(x) {',
        '    const v = x >>> 0;',
        '    if (v === 0) return 32;',
        '    return table[Math.imul(DE_BRUIJN, (v & -v) >>> 0) >>> 27];',
        '  }',
        '',
        '  return { popcount: popcount, ctz: ctz, stages: stages, table: table };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the SWAR stages are the reduction, not a loop wearing its name',
          assert: function (bitKit, api) {
            const kit = bitKit();
            api.assert.ok(typeof kit.stages === 'function', 'stages must be a function');

            const traced = kit.stages(0xdeadbeef);
            api.assert.equal(traced.length, 3, 'three intermediate words');
            api.assert.equal(traced[0] >>> 0, 0x9959699a, '16 two-bit counters');
            api.assert.equal(traced[1] >>> 0, 0x33233334, '8 four-bit counters');
            api.assert.equal(traced[2] >>> 0, 0x06050607, '4 byte counters reading 6, 5, 6 and 7');
            api.assert.equal(kit.popcount(0xdeadbeef), 24, '6 + 5 + 6 + 7 = 24');
          }
        },
        {
          name: 'the De Bruijn table is a genuine 32-entry inverse',
          assert: function (bitKit, api) {
            const kit = bitKit();
            api.assert.ok(kit.table && kit.table.length === 32,
              'table must have exactly 32 entries');

            const seen = new Set();
            for (let i = 0; i < 32; i += 1) {
              const slot = Math.imul(0x077cb531, 1 << i) >>> 27;
              api.assert.equal(kit.table[slot], i,
                'multiplying the constant by 2^' + i + ' must index back to ' + i);
              seen.add(slot);
            }
            api.assert.equal(seen.size, 32,
              'the 32 powers of two must land on 32 distinct slots, or the table is not an inverse');
          }
        },
        {
          name: 'both agree with a naive loop on all 65 536 low words',
          assert: function (bitKit, api) {
            const kit = bitKit();
            let popWrong = 0;
            let ctzWrong = 0;

            for (let x = 0; x < 65536; x += 1) {
              let count = 0;
              let value = x;
              while (value !== 0) { count += value & 1; value >>>= 1; }
              if (kit.popcount(x) !== count) popWrong += 1;

              let index = 0;
              if (x === 0) index = 32;
              else while (((x >>> index) & 1) === 0) index += 1;
              if (kit.ctz(x) !== index) ctzWrong += 1;
            }
            api.assert.equal(popWrong, 0, 'popcount disagreed on ' + popWrong + ' of 65 536 words');
            api.assert.equal(ctzWrong, 0, 'ctz disagreed on ' + ctzWrong + ' of 65 536 words');
          }
        },
        {
          name: 'the boundary values a sample would skip, and 20 000 random words',
          assert: function (bitKit, api) {
            const kit = bitKit();
            api.assert.equal(kit.popcount(0), 0, 'zero has no set bits');
            api.assert.equal(kit.popcount(0xffffffff), 32, 'all ones');
            api.assert.equal(kit.popcount(0x80000000), 1, 'the sign bit alone');
            api.assert.equal(kit.ctz(0), 32, 'zero has no lowest set bit; the convention is 32');
            api.assert.equal(kit.ctz(0x80000000), 31,
              'the sign bit is the lowest set bit here, and >>> must not sign-extend');

            for (let trial = 0; trial < 20000; trial += 1) {
              const x = ((api.rng.int(65536) << 16) | api.rng.int(65536)) >>> 0;
              let count = 0;
              let value = x;
              while (value !== 0) { count += value & 1; value >>>= 1; }
              api.assert.equal(kit.popcount(x), count, 'popcount of ' + x);

              let index = 0;
              if (x === 0) index = 32;
              else while (((x >>> index) & 1) === 0) index += 1;
              api.assert.equal(kit.ctz(x), index, 'ctz of ' + x);
            }
          }
        }
      ]
    }],

    'bitsets-and-swar': [{
      id: 'bitset-word-ops',
      title: 'Word-wise set operations, and iterating the population',
      prompt: 'Return an object with three functions operating on `Uint32Array` bitsets over the ' +
        'same universe. `union(a, b)` and `intersect(a, b)` must return a NEW `Uint32Array` of ' +
        'the same length, computed one word at a time with `|` and `&` — no per-element loop, and ' +
        'no branch inside the loop. `forEachSetBit(words, visit)` must call `visit(value)` once ' +
        'per set bit, in increasing order, and must cost the POPULATION rather than the universe: ' +
        'isolate the lowest set bit of each word with `word & -word`, turn that power of two into ' +
        'an index with `31 - Math.clz32(isolated)`, and clear it with `word & (word - 1)`. Return ' +
        'the number of bits visited. Every intermediate must be forced unsigned with `>>> 0`, ' +
        'because `word & -word` on a word with bit 31 set is negative otherwise and `Math.clz32` ' +
        'of a negative is 0. The starter tests every position of the universe, which is correct ' +
        'and is what makes a sparse bitset useless.',
      entry: 'bitsetKit',
      starter: [
        'function bitsetKit() {',
        '  function union(a, b) {',
        '    const out = new Uint32Array(a.length);',
        '    for (let i = 0; i < a.length; i += 1) out[i] = a[i] | b[i];',
        '    return out;',
        '  }',
        '',
        '  function intersect(a, b) {',
        '    const out = new Uint32Array(a.length);',
        '    for (let i = 0; i < a.length; i += 1) out[i] = a[i] & b[i];',
        '    return out;',
        '  }',
        '',
        '  function forEachSetBit(words, visit) {',
        '    let seen = 0;',
        '    // one test per possible element: the universe, not the population',
        '    for (let i = 0; i < words.length * 32; i += 1) {',
        '      if ((words[i >>> 5] & (1 << (i & 31))) === 0) continue;',
        '      visit(i);',
        '      seen += 1;',
        '    }',
        '    return seen;',
        '  }',
        '',
        '  return { union: union, intersect: intersect, forEachSetBit: forEachSetBit };',
        '}'
      ].join('\n'),
      solution: [
        'function bitsetKit() {',
        '  function combine(a, b, op) {',
        '    const out = new Uint32Array(a.length);',
        '    for (let i = 0; i < a.length; i += 1) out[i] = op(a[i], b[i]);',
        '    return out;',
        '  }',
        '',
        '  function union(a, b) {',
        '    return combine(a, b, function (x, y) { return (x | y) >>> 0; });',
        '  }',
        '',
        '  function intersect(a, b) {',
        '    return combine(a, b, function (x, y) { return (x & y) >>> 0; });',
        '  }',
        '',
        '  function forEachSetBit(words, visit) {',
        '    let seen = 0;',
        '    for (let w = 0; w < words.length; w += 1) {',
        '      let word = words[w] >>> 0;',
        '      while (word !== 0) {',
        '        // isolate the lowest set bit, name it, then clear it',
        '        const isolated = (word & -word) >>> 0;',
        '        visit((w << 5) + (31 - Math.clz32(isolated)));',
        '        word = (word & (word - 1)) >>> 0;',
        '        seen += 1;',
        '      }',
        '    }',
        '    return seen;',
        '  }',
        '',
        '  return { union: union, intersect: intersect, forEachSetBit: forEachSetBit };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'union and intersection agree with a real Set over 200 random pairs',
          assert: function (bitsetKit, api) {
            const kit = bitsetKit();
            const universe = 2048;
            const words = universe / 32;

            for (let trial = 0; trial < 200; trial += 1) {
              const a = new Uint32Array(words);
              const b = new Uint32Array(words);
              const left = new Set();
              const right = new Set();

              for (let i = 0; i < 300; i += 1) {
                const x = api.rng.int(universe);
                const y = api.rng.int(universe);
                a[x >>> 5] |= (1 << (x & 31)); left.add(x);
                b[y >>> 5] |= (1 << (y & 31)); right.add(y);
              }

              const unionWords = kit.union(a, b);
              const meetWords = kit.intersect(a, b);
              const unionSeen = [];
              const meetSeen = [];
              kit.forEachSetBit(unionWords, function (v) { unionSeen.push(v); });
              kit.forEachSetBit(meetWords, function (v) { meetSeen.push(v); });

              const expectedUnion = new Set(left);
              right.forEach(function (v) { expectedUnion.add(v); });
              const expectedMeet = [];
              left.forEach(function (v) { if (right.has(v)) expectedMeet.push(v); });

              api.assert.equal(unionSeen.length, expectedUnion.size, 'union size on trial ' + trial);
              api.assert.equal(meetSeen.length, expectedMeet.length,
                'intersection size on trial ' + trial);
            }
          }
        },
        {
          name: 'iteration is in increasing order and visits every set bit exactly once',
          assert: function (bitsetKit, api) {
            const kit = bitsetKit();
            const words = new Uint32Array(8);
            const expected = [0, 1, 31, 32, 63, 64, 127, 200, 255];
            expected.forEach(function (v) { words[v >>> 5] |= (1 << (v & 31)); });

            const seen = [];
            const count = kit.forEachSetBit(words, function (v) { seen.push(v); });

            api.assert.equal(count, expected.length, 'the returned count is the population');
            api.assert.deepEqual(seen, expected,
              'positions must come out in increasing order, 31 and 32 included');
          }
        },
        {
          name: 'bit 31 of a word does not break the isolate-and-name step',
          assert: function (bitsetKit, api) {
            const kit = bitsetKit();
            const words = new Uint32Array(2);
            words[0] = 0x80000000;
            words[1] = 0x80000000;

            const seen = [];
            kit.forEachSetBit(words, function (v) { seen.push(v); });
            api.assert.deepEqual(seen, [31, 63],
              'word & −word is negative here unless it is forced unsigned, and Math.clz32 of a ' +
              'negative value is 0');

            const all = new Uint32Array(1);
            all[0] = 0xffffffff;
            api.assert.equal(kit.forEachSetBit(all, function () {}), 32,
              'a full word must visit all 32 positions and terminate');
          }
        },
        {
          name: 'the walk reads each word once, so its cost is the population',
          assert: function (bitsetKit, api) {
            const kit = bitsetKit();
            const length = 4096;
            const backing = new Uint32Array(length);
            const wanted = [];

            for (let i = 0; i < 40; i += 1) {
              const v = api.rng.int(length * 32);
              backing[v >>> 5] |= (1 << (v & 31));
              wanted.push(v);
            }

            /* Counting callbacks cannot tell a walk from a scan - both call
               back once per set bit. Counting WORD READS can: a walk reads
               each word once, and a scan reads it once for each of the 32
               positions inside it. */
            let reads = 0;
            const watched = { length: length };
            for (let i = 0; i < length; i += 1) {
              (function (index) {
                Object.defineProperty(watched, index, {
                  get: function () { reads += 1; return backing[index]; }
                });
              }(i));
            }

            let visits = 0;
            const count = kit.forEachSetBit(watched, function () { visits += 1; });
            const distinct = new Set(wanted).size;

            api.assert.equal(count, distinct, 'every set bit is visited exactly once');
            api.assert.equal(visits, distinct, 'and the callback fires only for set bits');
            api.assert.atMost(reads, 2 * length,
              'the walk read ' + reads + ' words for ' + length + ' words of bitset; a scan of ' +
              'the universe reads each word once per position, which is ' + (32 * length));
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));

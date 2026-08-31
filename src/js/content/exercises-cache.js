/**
 * Graded exercises for the hierarchy, cache organisation and policies
 * (M37.1-M37.3).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'memory-hierarchy-numbers': [{
      id: 'amat-and-steps',
      title: 'Compute AMAT down a hierarchy, and read capacities off a curve',
      prompt: 'Write lab() returning { amat, capacities }. amat(levels, dramCycles) takes an '
        + 'array of levels ordered top to bottom, each { hitCycles, missRate } with missRate '
        + 'local to that level (misses at the level divided by accesses reaching it), and '
        + 'returns the average access time a program experiences at the top - the recursion '
        + 'is hit time plus miss rate times the whole cost of everything below, with '
        + 'dramCycles as the base case. capacities(curve, threshold) takes an array of '
        + '{ bytes, cycles } ordered by increasing size and returns the bytes value BELOW '
        + 'every point where the cycles rose by at least threshold times the previous point - '
        + 'that is the capacity, because it is the largest working set that still fitted. The '
        + 'starter adds the level costs instead of weighting them by the miss rate, and reads '
        + 'the size above each step.',
      entry: 'lab',
      starter: [
        'function amat(levels, dramCycles) {',
        '  // Wrong: every level charged in full, whatever the miss rate.',
        '  var total = dramCycles;',
        '',
        '  levels.forEach(function (level) { total += level.hitCycles; });',
        '  return total;',
        '}',
        '',
        'function capacities(curve, threshold) {',
        '  var found = [];',
        '',
        '  for (var at = 1; at < curve.length; at += 1) {',
        '    if (curve[at].cycles >= curve[at - 1].cycles * threshold) {',
        '      found.push(curve[at].bytes); // off by one: this is the size ABOVE the step',
        '    }',
        '  }',
        '  return found;',
        '}',
        '',
        'function lab() {',
        '  return { amat: amat, capacities: capacities };',
        '}'
      ].join('\n'),
      solution: [
        '/* The recursion runs bottom up, so build it from the last level back. */',
        'function amat(levels, dramCycles) {',
        '  var below = dramCycles;',
        '  var at;',
        '',
        '  for (at = levels.length - 1; at >= 0; at -= 1) {',
        '    below = levels[at].hitCycles + levels[at].missRate * below;',
        '  }',
        '  return below;',
        '}',
        '',
        '/* The capacity is the size BELOW the step: the largest working set that',
        '   still fitted. Reading the size above reports every cache as twice its',
        '   real size, which is the single commonest error in this measurement. */',
        'function capacities(curve, threshold) {',
        '  var found = [];',
        '  var at;',
        '',
        '  for (at = 1; at < curve.length; at += 1) {',
        '    if (curve[at].cycles >= curve[at - 1].cycles * threshold) {',
        '      found.push(curve[at - 1].bytes);',
        '    }',
        '  }',
        '  return found;',
        '}',
        '',
        'function lab() {',
        '  return { amat: amat, capacities: capacities };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'AMAT weights each level by the fraction that reached it',
          assert: function (lab, api) {
            const got = lab().amat([
              { hitCycles: 4, missRate: 0.0534 },
              { hitCycles: 14, missRate: 0.0361 },
              { hitCycles: 45, missRate: 1 }
            ], 250);

            api.assert.ok(Math.abs(got - 5.32) < 0.01,
              'the measured hierarchy is 5.32 cycles per access, not the sum of the hit times');
          }
        },
        {
          name: 'a level that never misses costs its hit time and nothing else',
          assert: function (lab, api) {
            const got = lab().amat([{ hitCycles: 4, missRate: 0 }], 250);

            api.assert.equal(got, 4, 'nothing below is ever paid for');
          }
        },
        {
          name: 'the capacity is the size below the step',
          assert: function (lab, api) {
            const curve = [
              { bytes: 16384, cycles: 4 },
              { bytes: 32768, cycles: 4 },
              { bytes: 65536, cycles: 18 },
              { bytes: 131072, cycles: 18 },
              { bytes: 262144, cycles: 63 }
            ];
            const got = lab().capacities(curve, 1.35);

            api.assert.deepEqual(got, [32768, 131072],
              'the largest working set that still fitted, at each step');
          }
        }
      ]
    }],

    'cache-organisation': [{
      id: 'decode-and-collide',
      title: 'Split an address, then predict which addresses collide',
      prompt: 'Write lab() returning { decode, sharesSet, reach }. decode(address, config) '
        + 'takes config { sets, ways, lineBytes } and returns { offset, index, tag }: offset '
        + 'is the byte within the line, index is which set the line must live in, and tag is '
        + 'what is left above. sharesSet(a, b, config) returns true when two addresses map to '
        + 'the same set. reach(stride, config) returns how many distinct sets a walk at that '
        + 'stride can reach - which is sets divided by the greatest common divisor of sets and '
        + 'stride-in-lines when the stride is a whole number of lines, and simply sets when it '
        + 'is not. The starter takes the index from the low bits, which is where a tag would '
        + 'go, so nothing collides that should.',
      entry: 'lab',
      starter: [
        'function decode(address, config) {',
        '  // Wrong: the index is taken from the LOW bits, below the offset.',
        '  return {',
        '    offset: Math.floor(address / config.lineBytes),',
        '    index: address % config.sets,',
        '    tag: Math.floor(address / config.sets / config.lineBytes)',
        '  };',
        '}',
        '',
        'function sharesSet(a, b, config) {',
        '  return decode(a, config).index === decode(b, config).index;',
        '}',
        '',
        'function reach(stride, config) {',
        '  return config.sets;',
        '}',
        '',
        'function lab() {',
        '  return { decode: decode, sharesSet: sharesSet, reach: reach };',
        '}'
      ].join('\n'),
      solution: [
        '/* Offset at the bottom, index in the middle, tag above. The index being',
        '   in the MIDDLE is the whole reason two addresses far apart in memory',
        '   can land in the same set. */',
        'function decode(address, config) {',
        '  var line = Math.floor(address / config.lineBytes);',
        '',
        '  return {',
        '    offset: address % config.lineBytes,',
        '    index: line % config.sets,',
        '    tag: Math.floor(line / config.sets)',
        '  };',
        '}',
        '',
        'function sharesSet(a, b, config) {',
        '  return decode(a, config).index === decode(b, config).index;',
        '}',
        '',
        'function gcd(a, b) {',
        '  return b ? gcd(b, a % b) : a;',
        '}',
        '',
        '/* A walk at a stride of s lines visits the sets s, 2s, 3s ... modulo the',
        '   set count, and that cycle has length sets / gcd(sets, s). */',
        'function reach(stride, config) {',
        '  var lines;',
        '',
        '  if (stride % config.lineBytes !== 0) return config.sets;',
        '  lines = stride / config.lineBytes;',
        '  if (lines % config.sets === 0) return 1;',
        '  return config.sets / gcd(config.sets, lines % config.sets);',
        '}',
        '',
        'function lab() {',
        '  return { decode: decode, sharesSet: sharesSet, reach: reach };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: '0x1234 on a 16-set 64-byte-line cache splits into 52, 8 and 4',
          assert: function (lab, api) {
            const got = lab().decode(0x1234, { sets: 16, ways: 4, lineBytes: 64 });

            api.assert.equal(got.offset, 52, 'the low six bits are the byte in the line');
            api.assert.equal(got.index, 8, 'the next four bits pick the set');
            api.assert.equal(got.tag, 4, 'everything above is the tag');
          }
        },
        {
          name: 'addresses one set-span apart share a set however far apart they are',
          assert: function (lab, api) {
            const config = { sets: 16, ways: 4, lineBytes: 64 };
            const parts = lab();

            api.assert.ok(parts.sharesSet(0, 1024, config), '16 x 64 = 1024 bytes apart');
            api.assert.ok(parts.sharesSet(0, 1024 * 97, config), 'and any multiple of it');
            api.assert.ok(!parts.sharesSet(0, 64, config), 'one line apart is the next set');
          }
        },
        {
          name: 'a stride that is a multiple of the set span reaches exactly one set',
          assert: function (lab, api) {
            const config = { sets: 64, ways: 8, lineBytes: 64 };
            const parts = lab();

            api.assert.equal(parts.reach(64, config), 64, 'a one-line stride reaches them all');
            api.assert.equal(parts.reach(2048, config), 2, '2048 B is 32 lines: half the table is unreachable');
            api.assert.equal(parts.reach(4096, config), 1, 'the whole walk lands in one set');
          }
        }
      ]
    }],

    'cache-policies': [{
      id: 'write-traffic-and-rrip',
      title: 'Count what each write policy sends, and insert an RRIP line correctly',
      prompt: 'Write lab() returning { traffic, victim }. traffic(trace, policy) takes an '
        + 'array of line numbers written, in order, and policy { write, allocate } where '
        + 'write is "writeBack" or "writeThrough" and allocate is "writeAllocate" or '
        + '"noWriteAllocate", and returns the number of transactions sent to the next level, '
        + 'assuming a cache large enough that no line is ever evicted. Under write-through '
        + 'every write is a transaction. Under write-back a line generates one fill when it is '
        + 'allocated and nothing more. Under no-write-allocate a write miss is forwarded '
        + 'instead of filling. victim(rrpvs) takes the re-reference values of the lines in one '
        + 'set and returns the index of the first line whose value is 3, incrementing every '
        + 'value (capped at 3) and looking again when none qualifies. The starter charges every '
        + 'write and never ages the RRIP values.',
      entry: 'lab',
      starter: [
        'function traffic(trace, policy) {',
        '  // Wrong: every write is charged, whatever the policy says.',
        '  return trace.length;',
        '}',
        '',
        'function victim(rrpvs) {',
        '  for (var at = 0; at < rrpvs.length; at += 1) {',
        '    if (rrpvs[at] === 3) return at;',
        '  }',
        '  return 0; // wrong: nothing was aged, so a set with no 3 always evicts line 0',
        '}',
        '',
        'function lab() {',
        '  return { traffic: traffic, victim: victim };',
        '}'
      ].join('\n'),
      solution: [
        '/* Write-back defers: the line is filled once and the writes accumulate in',
        '   it. Write-through charges every write. No-write-allocate skips the fill',
        '   on a miss and forwards the write instead, which is the right answer for',
        '   a line that will never be read back. */',
        'function traffic(trace, policy) {',
        '  var resident = {};',
        '  var count = 0;',
        '',
        '  trace.forEach(function (line) {',
        '    var present = resident[line] === true;',
        '',
        '    if (policy.write === "writeThrough") {',
        '      count += 1;',
        '      if (!present && policy.allocate === "writeAllocate") resident[line] = true;',
        '      return;',
        '    }',
        '    if (present) return;',
        '    if (policy.allocate === "noWriteAllocate") { count += 1; return; }',
        '    count += 1;',
        '    resident[line] = true;',
        '  });',
        '  return count;',
        '}',
        '',
        '/* Ageing is the whole mechanism: a set where nothing is predicted distant',
        '   yet has everything aged until something is. Four values means at most',
        '   three sweeps before one qualifies. */',
        'function victim(rrpvs) {',
        '  var round;',
        '  var at;',
        '',
        '  for (round = 0; round < 4; round += 1) {',
        '    for (at = 0; at < rrpvs.length; at += 1) {',
        '      if (rrpvs[at] >= 3) return at;',
        '    }',
        '    for (at = 0; at < rrpvs.length; at += 1) {',
        '      rrpvs[at] = Math.min(3, rrpvs[at] + 1);',
        '    }',
        '  }',
        '  return 0;',
        '}',
        '',
        'function lab() {',
        '  return { traffic: traffic, victim: victim };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'a thousand writes to four lines cost 4 under write-back and 1000 under write-through',
          assert: function (lab, api) {
            const trace = [];
            const parts = lab();

            for (let at = 0; at < 1000; at += 1) trace.push(at % 4);
            api.assert.equal(parts.traffic(trace,
              { write: 'writeBack', allocate: 'writeAllocate' }), 4, 'one fill per line');
            api.assert.equal(parts.traffic(trace,
              { write: 'writeThrough', allocate: 'writeAllocate' }), 1000, 'every write goes through');
          }
        },
        {
          name: 'no-write-allocate never installs, so a rewritten line is charged every time',
          assert: function (lab, api) {
            const hot = [];
            const stream = [];
            const parts = lab();

            for (let at = 0; at < 1000; at += 1) hot.push(at % 4);
            for (let at = 0; at < 100; at += 1) stream.push(at);
            api.assert.equal(parts.traffic(hot,
              { write: 'writeBack', allocate: 'noWriteAllocate' }), 1000,
              'nothing is installed, so every write is forwarded');
            api.assert.equal(parts.traffic(stream,
              { write: 'writeBack', allocate: 'noWriteAllocate' }), 100,
              'and on a stream that is exactly one transaction per line, with no fill wasted');
          }
        },
        {
          name: 'RRIP ages the set when nothing is predicted distant',
          assert: function (lab, api) {
            const parts = lab();

            api.assert.equal(parts.victim([0, 3, 2, 1]), 1, 'the line already at 3 goes first');
            api.assert.equal(parts.victim([2, 2, 0, 2]), 0,
              'nothing at 3, so age everything and take the first that reaches it');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));

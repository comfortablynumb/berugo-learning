/**
 * Graded exercises for the approximate-membership sections (M07.1-M07.3).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'bloom-filters': [{
      id: 'bloom-sizing-and-filter',
      title: 'optimalParams and the filter itself',
      prompt: 'makeBloom() returns { optimalParams, create }. optimalParams(n, p) must return ' +
        '{ m, k } from m = −n·ln p / (ln 2)² and k = round((m/n)·ln 2), both at least 1. ' +
        'create(m, k) must return { add, has, setBits } over a Uint8Array of ⌈m/8⌉ bytes, deriving ' +
        'the k probe positions from the two supplied hashes as (h1 + i·h2 + i²) mod m. There must be ' +
        'no false negatives at any load, and the measured false-positive rate must land within 15% ' +
        'of (1 − e^(−kn/m))^k.',
      entry: 'makeBloom',
      starter: [
        'function makeBloom() {',
        '  // provided: two independent 32-bit hashes of a string key',
        '  function hash(key, seed) {',
        '    let h = seed >>> 0;',
        '    for (let i = 0; i < key.length; i += 1) {',
        '      h ^= key.charCodeAt(i);',
        '      h = Math.imul(h, 0x01000193) >>> 0;',
        '    }',
        '    h ^= h >>> 16;',
        '    h = Math.imul(h, 0x85ebca6b) >>> 0;',
        '    h ^= h >>> 13;',
        '    return h >>> 0;',
        '  }',
        '',
        '  return {',
        '    optimalParams: function (n, p) { return { m: 0, k: 0 }; },',
        '    create: function (m, k) {',
        '      return {',
        '        add: function (key) {},',
        '        has: function (key) { return true; },',
        '        setBits: function () { return 0; }',
        '      };',
        '    }',
        '  };',
        '}'
      ].join('\n'),
      solution: [
        'function makeBloom() {',
        '  function hash(key, seed) {',
        '    let h = seed >>> 0;',
        '    for (let i = 0; i < key.length; i += 1) {',
        '      h ^= key.charCodeAt(i);',
        '      h = Math.imul(h, 0x01000193) >>> 0;',
        '    }',
        '    h ^= h >>> 16;',
        '    h = Math.imul(h, 0x85ebca6b) >>> 0;',
        '    h ^= h >>> 13;',
        '    return h >>> 0;',
        '  }',
        '',
        '  return {',
        '    optimalParams: function (n, p) {',
        '      const m = Math.max(8, Math.ceil(-n * Math.log(p) / (Math.LN2 * Math.LN2)));',
        '      const k = Math.max(1, Math.round((m / n) * Math.LN2));',
        '      return { m: m, k: k };',
        '    },',
        '    create: function (m, k) {',
        '      const bytes = new Uint8Array(Math.ceil(m / 8));',
        '',
        '      function positions(key) {',
        '        const h1 = hash(key, 0x811c9dc5);',
        '        const h2 = (hash(key, 0x9e3779b9) | 1) >>> 0;',
        '        const out = new Array(k);',
        '        for (let i = 0; i < k; i += 1) {',
        '          out[i] = ((h1 + Math.imul(i, h2) + i * i) >>> 0) % m;',
        '        }',
        '        return out;',
        '      }',
        '',
        '      return {',
        '        add: function (key) {',
        '          positions(key).forEach(function (bit) {',
        '            bytes[bit >>> 3] |= 1 << (bit & 7);',
        '          });',
        '        },',
        '        has: function (key) {',
        '          const list = positions(key);',
        '          for (let i = 0; i < list.length; i += 1) {',
        '            const bit = list[i];',
        '            if ((bytes[bit >>> 3] & (1 << (bit & 7))) === 0) return false;',
        '          }',
        '          return true;',
        '        },',
        '        setBits: function () {',
        '          let total = 0;',
        '          for (let i = 0; i < bytes.length; i += 1) {',
        '            let v = bytes[i];',
        '            while (v) { total += v & 1; v >>>= 1; }',
        '          }',
        '          return total;',
        '        }',
        '      };',
        '    }',
        '  };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'optimalParams follows the sizing formulas',
          assert: function (makeBloom, api) {
            const bloom = makeBloom();
            [[10000, 0.01, 95851, 7], [10000, 0.001, 143776, 10], [1000, 0.1, 4793, 3]]
              .forEach(function (row) {
                const shape = bloom.optimalParams(row[0], row[1]);
                api.assert.equal(shape.m, row[2], 'm for n=' + row[0] + ', p=' + row[1]);
                api.assert.equal(shape.k, row[3], 'k for n=' + row[0] + ', p=' + row[1]);
              });
          }
        },
        {
          name: 'no false negatives, at the design load and well past it',
          assert: function (makeBloom, api) {
            const bloom = makeBloom();
            const shape = bloom.optimalParams(5000, 0.01);
            const filter = bloom.create(shape.m, shape.k);

            for (let i = 0; i < 15000; i += 1) filter.add('key-' + i);
            for (let i = 0; i < 15000; i += 1) {
              api.assert.equal(filter.has('key-' + i), true, 'key-' + i + ' was added and must be found');
            }
          }
        },
        {
          name: 'the measured false-positive rate is within 15% of the prediction',
          assert: function (makeBloom, api) {
            const bloom = makeBloom();
            const n = 20000;
            const shape = bloom.optimalParams(n, 0.01);
            const filter = bloom.create(shape.m, shape.k);

            for (let i = 0; i < n; i += 1) filter.add('key-' + i);

            let hits = 0;
            const probes = 50000;
            for (let i = 0; i < probes; i += 1) if (filter.has('absent-' + i)) hits += 1;

            const measured = hits / probes;
            const predicted = Math.pow(1 - Math.exp(-shape.k * n / shape.m), shape.k);
            api.assert.ok(Math.abs(measured - predicted) <= 0.15 * predicted,
              'measured ' + measured.toFixed(5) + ' against predicted ' + predicted.toFixed(5));
          }
        },
        {
          name: 'the array is about half full at the design capacity',
          assert: function (makeBloom, api) {
            const bloom = makeBloom();
            const n = 20000;
            const shape = bloom.optimalParams(n, 0.01);
            const filter = bloom.create(shape.m, shape.k);

            for (let i = 0; i < n; i += 1) filter.add('key-' + i);
            const fill = filter.setBits() / shape.m;
            api.assert.ok(fill > 0.45 && fill < 0.57, 'fill was ' + fill.toFixed(4) + ', expected ~0.52');
          }
        }
      ]
    }],

    'bloom-variants': [{
      id: 'blocked-bloom',
      title: 'A blocked filter, and the access count that justifies it',
      prompt: 'makeBlocked(blocks, blockBits, k) must return { add, has, positions, blockOf }. One ' +
        'hash picks the block; all k bit positions must fall inside it, so a query touches one ' +
        'aligned run of blockBits bits. Derive the in-block offsets by re-mixing the second hash per ' +
        'i — a fixed stride gives every key the same pattern of offsets translated by one value, ' +
        'which collapses the number of distinct patterns to blockBits and inflates the measured ' +
        'error by more than an order of magnitude.',
      entry: 'makeBlocked',
      starter: [
        'function makeBlocked(blocks, blockBits, k) {',
        '  // provided: a 32-bit string hash and a finaliser',
        '  function hash(key, seed) {',
        '    let h = seed >>> 0;',
        '    for (let i = 0; i < key.length; i += 1) {',
        '      h ^= key.charCodeAt(i);',
        '      h = Math.imul(h, 0x01000193) >>> 0;',
        '    }',
        '    return mix(h);',
        '  }',
        '',
        '  function mix(value) {',
        '    let h = value >>> 0;',
        '    h ^= h >>> 16;',
        '    h = Math.imul(h, 0x85ebca6b) >>> 0;',
        '    h ^= h >>> 13;',
        '    h = Math.imul(h, 0xc2b2ae35) >>> 0;',
        '    h ^= h >>> 16;',
        '    return h >>> 0;',
        '  }',
        '',
        '  const bits = new Uint8Array(Math.ceil(blocks * blockBits / 8));',
        '',
        '  return {',
        '    blockOf: function (key) { return 0; },',
        '    positions: function (key) { return []; },',
        '    add: function (key) {},',
        '    has: function (key) { return true; }',
        '  };',
        '}'
      ].join('\n'),
      solution: [
        'function makeBlocked(blocks, blockBits, k) {',
        '  function hash(key, seed) {',
        '    let h = seed >>> 0;',
        '    for (let i = 0; i < key.length; i += 1) {',
        '      h ^= key.charCodeAt(i);',
        '      h = Math.imul(h, 0x01000193) >>> 0;',
        '    }',
        '    return mix(h);',
        '  }',
        '',
        '  function mix(value) {',
        '    let h = value >>> 0;',
        '    h ^= h >>> 16;',
        '    h = Math.imul(h, 0x85ebca6b) >>> 0;',
        '    h ^= h >>> 13;',
        '    h = Math.imul(h, 0xc2b2ae35) >>> 0;',
        '    h ^= h >>> 16;',
        '    return h >>> 0;',
        '  }',
        '',
        '  const bits = new Uint8Array(Math.ceil(blocks * blockBits / 8));',
        '',
        '  function blockOf(key) {',
        '    return hash(key, 0x811c9dc5) % blocks;',
        '  }',
        '',
        '  function positions(key) {',
        '    const base = blockOf(key) * blockBits;',
        '    const h2 = hash(key, 0x9e3779b9);',
        '    const out = new Array(k);',
        '    for (let i = 0; i < k; i += 1) {',
        '      out[i] = base + (mix((h2 ^ Math.imul(i + 1, 0x9e3779b1)) >>> 0) % blockBits);',
        '    }',
        '    return out;',
        '  }',
        '',
        '  return {',
        '    blockOf: blockOf,',
        '    positions: positions,',
        '    add: function (key) {',
        '      positions(key).forEach(function (bit) {',
        '        bits[bit >>> 3] |= 1 << (bit & 7);',
        '      });',
        '    },',
        '    has: function (key) {',
        '      const list = positions(key);',
        '      for (let i = 0; i < list.length; i += 1) {',
        '        const bit = list[i];',
        '        if ((bits[bit >>> 3] & (1 << (bit & 7))) === 0) return false;',
        '      }',
        '      return true;',
        '    }',
        '  };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'every bit of a key lands in one block',
          assert: function (makeBlocked, api) {
            const filter = makeBlocked(374, 512, 7);
            for (let i = 0; i < 500; i += 1) {
              const key = 'key-' + i;
              const block = filter.blockOf(key);
              const list = filter.positions(key);
              api.assert.equal(list.length, 7, 'k positions for ' + key);
              list.forEach(function (bit) {
                api.assert.equal(Math.floor(bit / 512), block,
                  key + ': bit ' + bit + ' is outside block ' + block);
              });
            }
          }
        },
        {
          name: 'no false negatives',
          assert: function (makeBlocked, api) {
            const filter = makeBlocked(374, 512, 7);
            for (let i = 0; i < 20000; i += 1) filter.add('key-' + i);
            for (let i = 0; i < 20000; i += 1) {
              api.assert.equal(filter.has('key-' + i), true, 'key-' + i + ' was added');
            }
          }
        },
        {
          name: 'the offsets are re-mixed per i, not stepped by a fixed stride',
          assert: function (makeBlocked, api) {
            const filter = makeBlocked(374, 512, 7);
            const patterns = new Set();

            for (let i = 0; i < 400; i += 1) {
              const list = filter.positions('key-' + i);
              const base = filter.blockOf('key-' + i) * 512;
              const gaps = [];
              for (let j = 1; j < list.length; j += 1) {
                gaps.push(((list[j] - base) - (list[j - 1] - base) + 512) % 512);
              }
              patterns.add(gaps.join(','));
            }

            api.assert.ok(patterns.size > 300,
              'only ' + patterns.size + ' distinct offset patterns over 400 keys — a fixed stride ' +
              'gives every key the same gaps');
          }
        },
        {
          name: 'the measured error is inflated, but only modestly',
          assert: function (makeBlocked, api) {
            const filter = makeBlocked(374, 512, 7);
            const m = 374 * 512;
            const n = 20000;
            for (let i = 0; i < n; i += 1) filter.add('key-' + i);

            let hits = 0;
            const probes = 30000;
            for (let i = 0; i < probes; i += 1) if (filter.has('absent-' + i)) hits += 1;

            const measured = hits / probes;
            const standard = Math.pow(1 - Math.exp(-7 * n / m), 7);
            api.assert.ok(measured > standard,
              'blocking always costs some accuracy: measured ' + measured.toFixed(5));
            api.assert.ok(measured < 1.6 * standard,
              'measured ' + measured.toFixed(5) + ' is more than 1.6x the standard filter\'s ' +
              standard.toFixed(5) + ', which means the offsets are correlated');
          }
        }
      ]
    }],

    'fingerprint-filters': [{
      id: 'cuckoo-insert',
      title: 'Cuckoo insert with a bounded eviction chain',
      prompt: 'makeCuckoo(buckets, bucketSize, maxKicks) must return { add, has, remove, altBucket, ' +
        'count }. buckets is a power of two. Store an 8-bit fingerprint (never 0 — fold it to 1) in ' +
        'one of two candidate buckets, the second being i1 XOR (mix(fingerprint) mod buckets). On a ' +
        'full pair, evict a resident, put the new fingerprint in its place and rehome the evicted ' +
        'one, up to maxKicks times; then return false. Keep the final orphan in a victim slot that ' +
        'has() also consults, or the filter acquires a false negative at the moment it fills.',
      entry: 'makeCuckoo',
      starter: [
        'function makeCuckoo(buckets, bucketSize, maxKicks) {',
        '  // provided: a 32-bit string hash and a finaliser',
        '  function hash(key, seed) {',
        '    let h = seed >>> 0;',
        '    for (let i = 0; i < key.length; i += 1) {',
        '      h ^= key.charCodeAt(i);',
        '      h = Math.imul(h, 0x01000193) >>> 0;',
        '    }',
        '    return mix(h);',
        '  }',
        '',
        '  function mix(value) {',
        '    let h = value >>> 0;',
        '    h ^= h >>> 16;',
        '    h = Math.imul(h, 0x85ebca6b) >>> 0;',
        '    h ^= h >>> 13;',
        '    h = Math.imul(h, 0xc2b2ae35) >>> 0;',
        '    h ^= h >>> 16;',
        '    return h >>> 0;',
        '  }',
        '',
        '  const table = new Uint8Array(buckets * bucketSize);',
        '  let step = 0;',
        '',
        '  return {',
        '    altBucket: function (index, fingerprint) { return index; },',
        '    add: function (key) { return true; },',
        '    has: function (key) { return true; },',
        '    remove: function (key) { return true; },',
        '    count: function () { return 0; }',
        '  };',
        '}'
      ].join('\n'),
      solution: [
        'function makeCuckoo(buckets, bucketSize, maxKicks) {',
        '  function hash(key, seed) {',
        '    let h = seed >>> 0;',
        '    for (let i = 0; i < key.length; i += 1) {',
        '      h ^= key.charCodeAt(i);',
        '      h = Math.imul(h, 0x01000193) >>> 0;',
        '    }',
        '    return mix(h);',
        '  }',
        '',
        '  function mix(value) {',
        '    let h = value >>> 0;',
        '    h ^= h >>> 16;',
        '    h = Math.imul(h, 0x85ebca6b) >>> 0;',
        '    h ^= h >>> 13;',
        '    h = Math.imul(h, 0xc2b2ae35) >>> 0;',
        '    h ^= h >>> 16;',
        '    return h >>> 0;',
        '  }',
        '',
        '  const table = new Uint8Array(buckets * bucketSize);',
        '  let victim = null;',
        '  let items = 0;',
        '  let step = 0;',
        '',
        '  function fingerprintOf(key) {',
        '    const value = hash(key, 0x27d4eb2f) & 255;',
        '    return value === 0 ? 1 : value;',
        '  }',
        '',
        '  function altBucket(index, fingerprint) {',
        '    return (index ^ (mix(fingerprint) % buckets)) % buckets;',
        '  }',
        '',
        '  function placeIn(index, fingerprint) {',
        '    for (let i = 0; i < bucketSize; i += 1) {',
        '      if (table[index * bucketSize + i] === 0) {',
        '        table[index * bucketSize + i] = fingerprint;',
        '        return true;',
        '      }',
        '    }',
        '    return false;',
        '  }',
        '',
        '  function findIn(index, fingerprint) {',
        '    for (let i = 0; i < bucketSize; i += 1) {',
        '      if (table[index * bucketSize + i] === fingerprint) return index * bucketSize + i;',
        '    }',
        '    return -1;',
        '  }',
        '',
        '  function bucketsFor(key) {',
        '    const fingerprint = fingerprintOf(key);',
        '    const i1 = hash(key, 0x811c9dc5) % buckets;',
        '    return { f: fingerprint, i1: i1, i2: altBucket(i1, fingerprint) };',
        '  }',
        '',
        '  function inVictim(spot) {',
        '    if (!victim || victim.f !== spot.f) return false;',
        '    return victim.i1 === spot.i1 || victim.i1 === spot.i2;',
        '  }',
        '',
        '  return {',
        '    altBucket: altBucket,',
        '    count: function () { return items; },',
        '    add: function (key) {',
        '      if (victim) return false;',
        '      const spot = bucketsFor(key);',
        '      if (placeIn(spot.i1, spot.f) || placeIn(spot.i2, spot.f)) { items += 1; return true; }',
        '',
        '      let index = spot.i1;',
        '      let fingerprint = spot.f;',
        '      for (let kick = 0; kick < maxKicks; kick += 1) {',
        '        step = (step + 1) % bucketSize;',
        '        const slot = index * bucketSize + step;',
        '        const evicted = table[slot];',
        '        table[slot] = fingerprint;',
        '        fingerprint = evicted;',
        '        index = altBucket(index, fingerprint);',
        '        if (placeIn(index, fingerprint)) { items += 1; return true; }',
        '      }',
        '',
        '      victim = { f: fingerprint, i1: index, i2: altBucket(index, fingerprint) };',
        '      items += 1;',
        '      return false;',
        '    },',
        '    has: function (key) {',
        '      const spot = bucketsFor(key);',
        '      if (inVictim(spot)) return true;',
        '      return findIn(spot.i1, spot.f) !== -1 || findIn(spot.i2, spot.f) !== -1;',
        '    },',
        '    remove: function (key) {',
        '      const spot = bucketsFor(key);',
        '      if (inVictim(spot)) { victim = null; items -= 1; return true; }',
        '      const primary = findIn(spot.i1, spot.f);',
        '      const slot = primary !== -1 ? primary : findIn(spot.i2, spot.f);',
        '      if (slot === -1) return false;',
        '      table[slot] = 0;',
        '      items -= 1;',
        '      return true;',
        '    }',
        '  };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the alternative bucket is an involution',
          assert: function (makeCuckoo, api) {
            const filter = makeCuckoo(1024, 4, 100);
            for (let index = 0; index < 1024; index += 7) {
              for (let f = 1; f < 256; f += 17) {
                const other = filter.altBucket(index, f);
                api.assert.ok(other >= 0 && other < 1024, 'alt bucket ' + other + ' is out of range');
                api.assert.equal(filter.altBucket(other, f), index,
                  'alt(alt(' + index + ', ' + f + '), ' + f + ') must return ' + index);
              }
            }
          }
        },
        {
          name: 'nothing accepted is ever lost, right up to the failure point',
          assert: function (makeCuckoo, api) {
            const filter = makeCuckoo(512, 4, 500);
            const inserted = [];

            for (let i = 0; i < 4096; i += 1) {
              const key = 'key-' + i;
              const ok = filter.add(key);
              inserted.push(key);
              if (!ok) break;
            }

            inserted.forEach(function (key) {
              api.assert.equal(filter.has(key), true, key + ' was accepted and must still be found');
            });
          }
        },
        {
          name: 'the filter fills to a high load and then refuses',
          assert: function (makeCuckoo, api) {
            const filter = makeCuckoo(512, 4, 500);
            let accepted = 0;
            let failedAt = -1;

            for (let i = 0; i < 4096; i += 1) {
              if (filter.add('key-' + i)) { accepted += 1; continue; }
              failedAt = i;
              break;
            }

            api.assert.ok(failedAt > 0, 'the filter must eventually refuse an insert');
            const load = accepted / 2048;
            api.assert.ok(load > 0.9, 'load reached only ' + load.toFixed(3) + ', expected above 0.90');
            api.assert.equal(filter.add('one-more'), false, 'a full filter stays full');
          }
        },
        {
          name: 'removing an inserted key removes it; removing a stranger may not be refused',
          assert: function (makeCuckoo, api) {
            const filter = makeCuckoo(1024, 4, 500);
            for (let i = 0; i < 2000; i += 1) filter.add('key-' + i);

            api.assert.equal(filter.remove('key-7'), true, 'key-7 was inserted');
            api.assert.equal(filter.count(), 1999, 'the count must fall by one');

            let accepted = 0;
            for (let i = 0; i < 2000; i += 1) if (filter.remove('ghost-' + i)) accepted += 1;

            let missing = 0;
            for (let i = 0; i < 2000; i += 1) {
              if (i !== 7 && !filter.has('key-' + i)) missing += 1;
            }

            api.assert.equal(missing, accepted,
              'every accepted phantom delete must have cost exactly one real key: ' + accepted +
              ' accepted, ' + missing + ' keys lost');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));

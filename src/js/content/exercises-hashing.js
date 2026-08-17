/**
 * Graded exercises for the hashing sections (M03), part one: the hash function
 * itself, the attack that made seeds random, and the two classical collision
 * strategies.
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'hash-functions': [{
      id: 'fmix32',
      title: 'Write murmur3\'s finaliser and make it avalanche',
      prompt: 'finalise(value) is murmur3\'s fmix32: shift-xor by 16, multiply by 0x85ebca6b, ' +
        'shift-xor by 13, multiply by 0xc2b2ae35, shift-xor by 16. Every multiply goes through ' +
        'Math.imul and every step ends >>> 0 — a plain * loses the low bits as soon as the product ' +
        'passes 2^53, and the low bits are exactly the ones a table masks with. The starter is one ' +
        'shift-xor: a perfectly good bijection that fails avalanche badly.',
      entry: 'finalise',
      starter: [
        'function finalise(value) {',
        '  // One shift-xor mixes the high bits down, and nothing back up.',
        '  let h = value >>> 0;',
        '  h ^= h >>> 16;',
        '  return h >>> 0;',
        '}'
      ].join('\n'),
      solution: [
        'function finalise(value) {',
        '  let h = value >>> 0;',
        '  h ^= h >>> 16;',
        '  h = Math.imul(h, 0x85ebca6b) >>> 0;',
        '  h ^= h >>> 13;',
        '  h = Math.imul(h, 0xc2b2ae35) >>> 0;',
        '  h ^= h >>> 16;',
        '  return h >>> 0;',
        '}'
      ].join('\n'),
      tests: [
        { name: 'the published fmix32 vectors come out exactly',
          assert: function (finalise, api) {
            api.assert.equal(finalise(0), 0, 'fmix32(0) is a fixed point');
            api.assert.equal(finalise(1), 1364076727, 'fmix32(1)');
            api.assert.equal(finalise(2), 821347078, 'fmix32(2)');
            api.assert.equal(finalise(42), 142593372, 'fmix32(42)');
            api.assert.equal(finalise(0xffffffff), 2180083513, 'fmix32(2^32 − 1)');
            api.assert.equal(finalise(123456789), 3126909082, 'fmix32(123456789)');
          } },
        { name: 'every output bit flips about half the time when an input bit flips',
          assert: function (finalise, api) {
            const flips = new Array(32).fill(0);
            let trials = 0;

            for (let s = 0; s < 128; s += 1) {
              const base = api.rng.int(0x7fffffff) >>> 0;
              const baseHash = finalise(base) >>> 0;
              for (let inBit = 0; inBit < 32; inBit += 1) {
                const diff = (baseHash ^ (finalise((base ^ (1 << inBit)) >>> 0) >>> 0)) >>> 0;
                for (let outBit = 0; outBit < 32; outBit += 1) {
                  if ((diff >>> outBit) & 1) flips[outBit] += 1;
                }
                trials += 1;
              }
            }

            flips.forEach(function (count, bit) {
              const fraction = count / trials;
              api.assert.ok(fraction >= 0.35 && fraction <= 0.65,
                'output bit ' + bit + ' flipped ' + (fraction * 100).toFixed(1) +
                '% of the time, wanted 35–65%');
            });
          } },
        { name: 'the result is always an unsigned 32-bit integer',
          assert: function (finalise, api) {
            [0, 1, 0x7fffffff, 0x80000000, 0xffffffff, 3735928559].forEach(function (value) {
              const out = finalise(value);
              api.assert.ok(Number.isInteger(out), 'integer for ' + value + ', got ' + out);
              api.assert.ok(out >= 0 && out <= 0xffffffff, 'in range for ' + value + ', got ' + out);
            });
          } },
        { name: 'it is still a bijection — no two inputs share an output',
          assert: function (finalise, api) {
            const seen = new Set();
            for (let i = 0; i < 3000; i += 1) seen.add(finalise(Math.imul(i, 2654435761) >>> 0));
            api.assert.equal(seen.size, 3000, 'a finaliser must lose no information');
          } }
      ]
    }],

    'universal-hashing': [{
      id: 'flood',
      title: 'Price a hash-flooding attack',
      prompt: 'attack({ hash, buckets, target, count, budget }) brute-forces the key set an attacker ' +
        'would post: candidates are the strings "x0", "x1", "x2", … in order, and a candidate is kept ' +
        'when hash(candidate) % buckets === target. Return { keys, examined, exhausted } — examined is ' +
        'how many candidates were hashed, exhausted says the budget ran out before count keys were ' +
        'found. `examined` is the number that matters: it is what the attack costs, and it is why the ' +
        'fix is a seed the attacker cannot know.',
      entry: 'attack',
      starter: [
        'function attack(options) {',
        '  const keys = [];',
        '  let examined = 0;',
        '',
        '  // Every candidate is kept, so these keys land all over the table.',
        '  while (keys.length < options.count && examined < options.budget) {',
        '    keys.push(\'x\' + examined);',
        '    examined += 1;',
        '  }',
        '  return { keys: keys, examined: examined, exhausted: keys.length < options.count };',
        '}'
      ].join('\n'),
      solution: [
        'function attack(options) {',
        '  const target = options.target || 0;',
        '  const keys = [];',
        '  let examined = 0;',
        '',
        '  while (keys.length < options.count && examined < options.budget) {',
        '    const candidate = \'x\' + examined;',
        '    examined += 1;',
        '    if (options.hash(candidate) % options.buckets === target) keys.push(candidate);',
        '  }',
        '  return { keys: keys, examined: examined, exhausted: keys.length < options.count };',
        '}'
      ].join('\n'),
      tests: [
        { name: 'every key found lands in the target bucket, and they are distinct',
          assert: function (attack, api) {
            const djb2 = function (key) {
              let h = 5381;
              for (let i = 0; i < key.length; i += 1) h = (Math.imul(h, 33) + key.charCodeAt(i)) >>> 0;
              return h >>> 0;
            };

            const result = attack({ hash: djb2, buckets: 256, target: 0, count: 40, budget: 200000 });
            api.assert.equal(result.keys.length, 40, 'found the requested number of keys');
            api.assert.equal(result.exhausted, false, 'the budget was ample');
            api.assert.equal(new Set(result.keys).size, 40, 'no duplicate keys');
            result.keys.forEach(function (key) {
              api.assert.equal(djb2(key) % 256, 0, key + ' must land in bucket 0');
            });
          } },
        { name: 'a non-zero target bucket is honoured',
          assert: function (attack, api) {
            const fnv = function (key) {
              let h = 0x811c9dc5;
              for (let i = 0; i < key.length; i += 1) {
                h ^= key.charCodeAt(i);
                h = Math.imul(h, 0x01000193) >>> 0;
              }
              return h >>> 0;
            };

            const result = attack({ hash: fnv, buckets: 64, target: 37, count: 25, budget: 200000 });
            api.assert.equal(result.keys.length, 25, 'found the requested number of keys');
            result.keys.forEach(function (key) {
              api.assert.equal(fnv(key) % 64, 37, key + ' must land in bucket 37');
            });
          } },
        { name: 'the price of the attack is about count × buckets hashes',
          assert: function (attack, api) {
            const fnv = function (key) {
              let h = 0x811c9dc5;
              for (let i = 0; i < key.length; i += 1) {
                h ^= key.charCodeAt(i);
                h = Math.imul(h, 0x01000193) >>> 0;
              }
              return h >>> 0;
            };

            const result = attack({ hash: fnv, buckets: 1024, target: 0, count: 100, budget: 4000000 });
            api.assert.equal(result.keys.length, 100, 'found the requested number of keys');
            api.assert.atLeast(result.examined, 100 * 1024 * 0.5, 'far too cheap to be a real search');
            api.assert.atMost(result.examined, 100 * 1024 * 2, 'a geometric search should not stray this far');
          } },
        { name: 'the budget is a hard stop, and it is reported',
          assert: function (attack, api) {
            const fnv = function (key) {
              let h = 0x811c9dc5;
              for (let i = 0; i < key.length; i += 1) {
                h ^= key.charCodeAt(i);
                h = Math.imul(h, 0x01000193) >>> 0;
              }
              return h >>> 0;
            };

            const result = attack({ hash: fnv, buckets: 65536, target: 0, count: 50, budget: 5000 });
            api.assert.equal(result.exhausted, true, 'the budget ran out first');
            api.assert.atMost(result.examined, 5000, 'never hash more candidates than the budget allows');
            api.assert.ok(result.keys.length < 50, 'it cannot have found them all');
          } }
      ]
    }],

    'separate-chaining': [{
      id: 'chained-treeify',
      title: 'Chain the buckets, then bound the worst one',
      prompt: 'createChained({ buckets, hash, treeifyAt }) returns { set, get, delete, size, bucket }. ' +
        'A bucket holds its entries in an array; when it reaches treeifyAt entries it treeifies — sort ' +
        'it by key once, keep it sorted on every later insert, and search it by binary search from ' +
        'then on. bucket(i) returns { entries: [key, …] in stored order, tree: boolean }. set returns ' +
        'true for a new key and false for an update; delete returns whether it removed anything.',
      entry: 'createChained',
      starter: [
        'function createChained(options) {',
        '  const buckets = [];',
        '  for (let i = 0; i < options.buckets; i += 1) buckets.push({ entries: [], tree: false });',
        '  let count = 0;',
        '',
        '  function at(key) { return buckets[options.hash(key) % buckets.length]; }',
        '',
        '  function find(bucket, key) {',
        '    // A linear scan, whatever the bucket has grown to.',
        '    for (let i = 0; i < bucket.entries.length; i += 1) {',
        '      if (bucket.entries[i].key === key) return i;',
        '    }',
        '    return -1;',
        '  }',
        '',
        '  return {',
        '    set: function (key, value) {',
        '      const bucket = at(key);',
        '      const found = find(bucket, key);',
        '      if (found >= 0) { bucket.entries[found].value = value; return false; }',
        '      bucket.entries.push({ key: key, value: value });',
        '      count += 1;',
        '      return true;',
        '    },',
        '    get: function (key) {',
        '      const bucket = at(key);',
        '      const found = find(bucket, key);',
        '      return found >= 0 ? bucket.entries[found].value : undefined;',
        '    },',
        '    delete: function (key) {',
        '      const bucket = at(key);',
        '      const found = find(bucket, key);',
        '      if (found < 0) return false;',
        '      bucket.entries.splice(found, 1);',
        '      count -= 1;',
        '      return true;',
        '    },',
        '    size: function () { return count; },',
        '    bucket: function (i) {',
        '      return {',
        '        entries: buckets[i].entries.map(function (e) { return e.key; }),',
        '        tree: buckets[i].tree',
        '      };',
        '    }',
        '  };',
        '}'
      ].join('\n'),
      solution: [
        'function createChained(options) {',
        '  const treeifyAt = options.treeifyAt || 0;',
        '  const buckets = [];',
        '  for (let i = 0; i < options.buckets; i += 1) buckets.push({ entries: [], tree: false });',
        '  let count = 0;',
        '',
        '  function at(key) { return buckets[options.hash(key) % buckets.length]; }',
        '',
        '  function scan(bucket, key) {',
        '    for (let i = 0; i < bucket.entries.length; i += 1) {',
        '      if (bucket.entries[i].key === key) return i;',
        '    }',
        '    return -1;',
        '  }',
        '',
        '  function search(bucket, key) {',
        '    if (!bucket.tree) return scan(bucket, key);',
        '    let lo = 0;',
        '    let hi = bucket.entries.length - 1;',
        '    while (lo <= hi) {',
        '      const mid = (lo + hi) >>> 1;',
        '      const here = bucket.entries[mid].key;',
        '      if (here === key) return mid;',
        '      if (here < key) lo = mid + 1; else hi = mid - 1;',
        '    }',
        '    return -1;',
        '  }',
        '',
        '  function place(bucket, entry) {',
        '    if (!bucket.tree) { bucket.entries.push(entry); return; }',
        '    let i = bucket.entries.length;',
        '    while (i > 0 && bucket.entries[i - 1].key > entry.key) i -= 1;',
        '    bucket.entries.splice(i, 0, entry);',
        '  }',
        '',
        '  function treeify(bucket) {',
        '    bucket.entries.sort(function (a, b) { return a.key < b.key ? -1 : a.key > b.key ? 1 : 0; });',
        '    bucket.tree = true;',
        '  }',
        '',
        '  return {',
        '    set: function (key, value) {',
        '      const bucket = at(key);',
        '      const found = search(bucket, key);',
        '      if (found >= 0) { bucket.entries[found].value = value; return false; }',
        '      place(bucket, { key: key, value: value });',
        '      count += 1;',
        '      if (treeifyAt && !bucket.tree && bucket.entries.length >= treeifyAt) treeify(bucket);',
        '      return true;',
        '    },',
        '    get: function (key) {',
        '      const bucket = at(key);',
        '      const found = search(bucket, key);',
        '      return found >= 0 ? bucket.entries[found].value : undefined;',
        '    },',
        '    delete: function (key) {',
        '      const bucket = at(key);',
        '      const found = search(bucket, key);',
        '      if (found < 0) return false;',
        '      bucket.entries.splice(found, 1);',
        '      count -= 1;',
        '      return true;',
        '    },',
        '    size: function () { return count; },',
        '    bucket: function (i) {',
        '      return {',
        '        entries: buckets[i].entries.map(function (e) { return e.key; }),',
        '        tree: buckets[i].tree',
        '      };',
        '    }',
        '  };',
        '}'
      ].join('\n'),
      tests: [
        { name: 'it agrees with a Map over a mixed stream of sets, updates and deletes',
          assert: function (createChained, api) {
            const hash = function (key) {
              let h = 0x811c9dc5;
              for (let i = 0; i < key.length; i += 1) {
                h ^= key.charCodeAt(i);
                h = Math.imul(h, 0x01000193) >>> 0;
              }
              return h >>> 0;
            };

            const table = createChained({ buckets: 64, hash: hash, treeifyAt: 8 });
            const reference = new Map();

            for (let i = 0; i < 600; i += 1) {
              const key = 'key-' + api.rng.int(200);
              if (api.rng.next() < 0.25) {
                api.assert.equal(table.delete(key), reference.delete(key), 'delete ' + key);
              } else {
                api.assert.equal(table.set(key, i), !reference.has(key), 'set ' + key + ' reports novelty');
                reference.set(key, i);
              }
              api.assert.equal(table.size(), reference.size, 'size after operation ' + i);
            }

            reference.forEach(function (value, key) {
              api.assert.equal(table.get(key), value, 'lookup ' + key);
            });
            api.assert.equal(table.get('never-inserted'), undefined, 'a missing key is undefined');
          } },
        { name: 'a flooded bucket treeifies at the threshold and stays sorted',
          assert: function (createChained, api) {
            const table = createChained({ buckets: 16, hash: function () { return 0; }, treeifyAt: 8 });
            const keys = [];
            for (let i = 0; i < 50; i += 1) keys.push('k' + (999 - i));

            keys.forEach(function (key, i) {
              table.set(key, i);
              api.assert.equal(table.bucket(0).tree, i + 1 >= 8,
                'tree flag after ' + (i + 1) + ' inserts');
            });

            const entries = table.bucket(0).entries;
            api.assert.equal(entries.length, 50, 'every key is in bucket 0');
            for (let i = 1; i < entries.length; i += 1) {
              api.assert.ok(entries[i - 1] < entries[i],
                'a treeified bucket is sorted: ' + entries[i - 1] + ' before ' + entries[i]);
            }
          } },
        { name: 'lookups and deletes still work once a bucket is treeified',
          assert: function (createChained, api) {
            const table = createChained({ buckets: 4, hash: function () { return 0; }, treeifyAt: 8 });
            for (let i = 0; i < 40; i += 1) table.set('k' + i, i * 3);

            for (let i = 0; i < 40; i += 1) {
              api.assert.equal(table.get('k' + i), i * 3, 'binary search finds k' + i);
            }
            api.assert.equal(table.get('k40'), undefined, 'and rejects a key that was never added');

            for (let i = 0; i < 40; i += 2) {
              api.assert.equal(table.delete('k' + i), true, 'delete k' + i);
            }
            api.assert.equal(table.size(), 20, 'half the keys are gone');
            for (let i = 1; i < 40; i += 2) {
              api.assert.equal(table.get('k' + i), i * 3, 'k' + i + ' survived');
            }
            api.assert.equal(table.get('k0'), undefined, 'k0 was deleted');
          } }
      ]
    }],

    'open-addressing': [{
      id: 'backward-shift',
      title: 'Delete without leaving a tombstone',
      prompt: 'remove(table, key) deletes from a linear-probed table that has no tombstones at all. ' +
        'table is { slots, hash }: slots holds keys or null, and a lookup walks forward from ' +
        'hash(key) % slots.length until it meets the key or a null. Nulling the slot on its own strands ' +
        'every key that probed past it. Walk forward from the hole instead, pull back any entry whose ' +
        'home is at or before the hole, and null the last gap. Return whether anything was removed.',
      entry: 'remove',
      starter: [
        'function remove(table, key) {',
        '  const slots = table.slots;',
        '  const capacity = slots.length;',
        '  const home = table.hash(key) % capacity;',
        '',
        '  for (let i = 0; i < capacity; i += 1) {',
        '    const at = (home + i) % capacity;',
        '    if (slots[at] === null) return false;',
        '    if (slots[at] === key) { slots[at] = null; return true; }   // and the chain breaks here',
        '  }',
        '  return false;',
        '}'
      ].join('\n'),
      solution: [
        'function remove(table, key) {',
        '  const slots = table.slots;',
        '  const capacity = slots.length;',
        '  const home = table.hash(key) % capacity;',
        '  let hole = -1;',
        '',
        '  for (let i = 0; i < capacity && hole < 0; i += 1) {',
        '    const at = (home + i) % capacity;',
        '    if (slots[at] === null) return false;',
        '    if (slots[at] === key) hole = at;',
        '  }',
        '  if (hole < 0) return false;',
        '',
        '  let gap = hole;',
        '  let cursor = (hole + 1) % capacity;',
        '',
        '  while (slots[cursor] !== null && cursor !== gap) {',
        '    const resident = table.hash(slots[cursor]) % capacity;',
        '    const toGap = (gap - resident + capacity) % capacity;',
        '    const toCursor = (cursor - resident + capacity) % capacity;',
        '    if (toGap < toCursor) { slots[gap] = slots[cursor]; gap = cursor; }',
        '    cursor = (cursor + 1) % capacity;',
        '  }',
        '  slots[gap] = null;',
        '  return true;',
        '}'
      ].join('\n'),
      tests: [
        { name: 'a key deleted from the middle of a cluster does not hide the rest',
          assert: function (remove, api) {
            const hash = function (key) { return Number(key.slice(1)) % 8; };
            const table = { hash: hash, slots: new Array(8).fill(null) };
            const insert = function (key) {
              let at = hash(key) % 8;
              while (table.slots[at] !== null) at = (at + 1) % 8;
              table.slots[at] = key;
            };
            const findable = function (key) {
              for (let i = 0; i < 8; i += 1) {
                const at = (hash(key) + i) % 8;
                if (table.slots[at] === null) return false;
                if (table.slots[at] === key) return true;
              }
              return false;
            };

            ['k2', 'k10', 'k18', 'k3'].forEach(insert);
            api.assert.equal(remove(table, 'k10'), true, 'k10 was there');
            ['k2', 'k18', 'k3'].forEach(function (key) {
              api.assert.ok(findable(key), key + ' must still be reachable by linear probing');
            });
            api.assert.equal(table.slots.filter(function (s) { return s === null; }).length, 5,
              'exactly one slot was freed, and it is a real empty slot');
          } },
        { name: 'a cluster that wraps around the end of the array survives too',
          assert: function (remove, api) {
            const hash = function (key) { return Number(key.slice(1)) % 8; };
            const table = { hash: hash, slots: new Array(8).fill(null) };
            const insert = function (key) {
              let at = hash(key) % 8;
              while (table.slots[at] !== null) at = (at + 1) % 8;
              table.slots[at] = key;
            };
            const findable = function (key) {
              for (let i = 0; i < 8; i += 1) {
                const at = (hash(key) + i) % 8;
                if (table.slots[at] === null) return false;
                if (table.slots[at] === key) return true;
              }
              return false;
            };

            ['k7', 'k15', 'k23', 'k0'].forEach(insert);
            api.assert.equal(table.slots[0], 'k15', 'the cluster wrapped past the end');
            api.assert.equal(remove(table, 'k7'), true, 'k7 was there');
            ['k15', 'k23', 'k0'].forEach(function (key) {
              api.assert.ok(findable(key), key + ' must still be reachable after a wrapped delete');
            });
          } },
        { name: 'a thousand random deletes leave no unreachable key and no ghost slot',
          assert: function (remove, api) {
            const capacity = 64;
            const hash = function (key) {
              let h = 0x811c9dc5;
              for (let i = 0; i < key.length; i += 1) {
                h ^= key.charCodeAt(i);
                h = Math.imul(h, 0x01000193) >>> 0;
              }
              return h >>> 0;
            };
            const table = { hash: hash, slots: new Array(capacity).fill(null) };
            const live = [];
            const insert = function (key) {
              let at = hash(key) % capacity;
              while (table.slots[at] !== null) at = (at + 1) % capacity;
              table.slots[at] = key;
              live.push(key);
            };
            const findable = function (key) {
              for (let i = 0; i < capacity; i += 1) {
                const at = (hash(key) + i) % capacity;
                if (table.slots[at] === null) return false;
                if (table.slots[at] === key) return true;
              }
              return false;
            };

            for (let i = 0; i < 40; i += 1) insert('key-' + i);
            for (let round = 0; round < 1000; round += 1) {
              const victim = live.splice(api.rng.int(live.length), 1)[0];
              api.assert.equal(remove(table, victim), true, 'removing ' + victim);
              insert('key-' + (40 + round));
              const filled = table.slots.filter(function (s) { return s !== null; }).length;
              api.assert.equal(filled, live.length,
                'round ' + round + ': every occupied slot holds a live key');
            }
            live.forEach(function (key) {
              api.assert.ok(findable(key), key + ' survived the churn');
            });
          } },
        { name: 'removing a key that was never inserted changes nothing',
          assert: function (remove, api) {
            const hash = function (key) { return Number(key.slice(1)) % 8; };
            const table = { hash: hash, slots: new Array(8).fill(null) };
            ['k1', 'k9'].forEach(function (key) {
              let at = hash(key) % 8;
              while (table.slots[at] !== null) at = (at + 1) % 8;
              table.slots[at] = key;
            });

            const before = table.slots.slice();
            api.assert.equal(remove(table, 'k17'), false, 'k17 is not in the table');
            api.assert.deepEqual(table.slots, before, 'the slots are untouched');
            api.assert.equal(remove(table, 'k4'), false, 'k4 probes an empty slot immediately');
          } }
      ]
    }],

    'robin-hood': [{
      id: 'robin-insert',
      title: 'Rob the rich slot to pay the poor key',
      prompt: 'robinInsert(slots, entry) inserts { key, home } into a linear-probed table the Robin ' +
        'Hood way: walk forward from entry.home, and whenever the resident sits closer to its own home ' +
        'than the carried entry is to its home, swap — put the carried entry down and carry the ' +
        'resident on. Return true when something was placed, false when the table is full. This cannot ' +
        'lower the mean distance, which the load factor fixes. It collapses the variance, and the tail ' +
        'is made of variance.',
      entry: 'robinInsert',
      starter: [
        'function robinInsert(slots, entry) {',
        '  const capacity = slots.length;',
        '',
        '  // Plain linear probing: first come, first served, and the late keys pay for it.',
        '  for (let i = 0; i < capacity; i += 1) {',
        '    const at = (entry.home + i) % capacity;',
        '    if (!slots[at]) { slots[at] = entry; return true; }',
        '  }',
        '  return false;',
        '}'
      ].join('\n'),
      solution: [
        'function robinInsert(slots, entry) {',
        '  const capacity = slots.length;',
        '  let carry = entry;',
        '  let index = carry.home;',
        '  let travelled = 0;',
        '',
        '  for (let i = 0; i < capacity; i += 1) {',
        '    const resident = slots[index];',
        '    if (!resident) { slots[index] = carry; return true; }',
        '',
        '    const residentDistance = (index - resident.home + capacity) % capacity;',
        '    if (residentDistance < travelled) {',
        '      slots[index] = carry;',
        '      carry = resident;',
        '      travelled = residentDistance;',
        '    }',
        '    index = (index + 1) % capacity;',
        '    travelled += 1;',
        '  }',
        '  return false;',
        '}'
      ].join('\n'),
      tests: [
        { name: 'no key is lost, and every key sits at or after its home',
          assert: function (robinInsert, api) {
            const capacity = 128;
            const slots = new Array(capacity).fill(null);
            const inserted = [];

            for (let i = 0; i < 100; i += 1) {
              const entry = { key: 'k' + i, home: api.rng.int(capacity) };
              inserted.push(entry.key);
              api.assert.equal(robinInsert(slots, entry), true, 'placed k' + i);
            }

            const found = slots.filter(Boolean).map(function (e) { return e.key; }).sort();
            api.assert.deepEqual(found, inserted.slice().sort(),
              'every key inserted is present exactly once');
            slots.forEach(function (entry, index) {
              if (!entry) return;
              api.assert.ok(entry.home >= 0 && entry.home < capacity,
                entry.key + ' kept its home slot');
            });
          } },
        { name: 'the Robin Hood invariant holds: distance grows by at most one per slot',
          assert: function (robinInsert, api) {
            const capacity = 256;
            const slots = new Array(capacity).fill(null);
            for (let i = 0; i < 200; i += 1) {
              robinInsert(slots, { key: 'k' + i, home: api.rng.int(capacity) });
            }

            const distance = function (index) {
              return (index - slots[index].home + capacity) % capacity;
            };

            for (let i = 0; i < capacity; i += 1) {
              const next = (i + 1) % capacity;
              if (!slots[i] || !slots[next]) continue;
              api.assert.atMost(distance(next), distance(i) + 1,
                'slot ' + next + ' is ' + distance(next) + ' from home behind a slot only ' +
                distance(i) + ' from its own — a poor key stranded behind a rich one');
            }
          } },
        { name: 'the mean is unchanged and the variance collapses',
          assert: function (robinInsert, api) {
            const capacity = 2048;
            const homes = [];
            for (let i = 0; i < 1740; i += 1) homes.push(api.rng.int(capacity));

            const linear = new Array(capacity).fill(null);
            homes.forEach(function (home, i) {
              for (let step = 0; step < capacity; step += 1) {
                const at = (home + step) % capacity;
                if (!linear[at]) { linear[at] = { key: 'k' + i, home: home }; return; }
              }
            });

            const robin = new Array(capacity).fill(null);
            homes.forEach(function (home, i) { robinInsert(robin, { key: 'k' + i, home: home }); });

            const summarise = function (table) {
              const distances = [];
              table.forEach(function (entry, index) {
                if (entry) distances.push((index - entry.home + capacity) % capacity);
              });
              const mean = distances.reduce(function (a, b) { return a + b; }, 0) / distances.length;
              return {
                count: distances.length,
                mean: mean,
                variance: distances.reduce(function (sum, d) {
                  return sum + (d - mean) * (d - mean);
                }, 0) / distances.length,
                max: distances.reduce(function (m, d) { return Math.max(m, d); }, 0)
              };
            };

            const plain = summarise(linear);
            const rich = summarise(robin);
            api.assert.equal(rich.count, 1740, 'every key is placed');
            api.assert.closeTo(rich.mean, plain.mean, 1e-9, 'the mean distance is fixed by the load factor');
            api.assert.atMost(rich.variance, plain.variance / 2,
              'variance ' + rich.variance.toFixed(2) + ' against linear probing\'s ' +
              plain.variance.toFixed(2));
            api.assert.atMost(rich.max, plain.max / 2,
              'worst distance ' + rich.max + ' against linear probing\'s ' + plain.max);
          } }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));

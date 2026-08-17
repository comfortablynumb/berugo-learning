/**
 * Graded exercises for the hashing sections (M03), part two: metadata probing,
 * resizing, static key sets and the ordered map behind `Map`.
 *
 * Split from exercises-hashing.js to keep both files well under the size
 * limit; the registry keys are section ids, so the split is invisible to the
 * shell.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'swiss-tables': [{
      id: 'match-tag',
      title: 'Answer sixteen slots with one mask',
      prompt: 'matchTag(control, offset, tag) returns a 16-bit mask: bit L is set when ' +
        'control[offset + L] equals tag, for the sixteen lanes of one group. That mask is the whole ' +
        'trick — SSE computes it in one instruction, and only the lanes it sets are worth a real key ' +
        'comparison. Return the mask itself, not a lane index and not a count: the caller needs every ' +
        'match, because a 7-bit tag collides about once in 128.',
      entry: 'matchTag',
      starter: [
        'function matchTag(control, offset, tag) {',
        '  // Counting the matches throws away *which* lanes matched, which is the only',
        '  // thing the caller wanted.',
        '  let matches = 0;',
        '  for (let lane = 0; lane < 16; lane += 1) {',
        '    if (control[offset + lane] === tag) matches += 1;',
        '  }',
        '  return matches;',
        '}'
      ].join('\n'),
      solution: [
        'function matchTag(control, offset, tag) {',
        '  let mask = 0;',
        '  for (let lane = 0; lane < 16; lane += 1) {',
        '    if (control[offset + lane] === tag) mask |= (1 << lane);',
        '  }',
        '  return mask;',
        '}'
      ].join('\n'),
      tests: [
        { name: 'the mask names every lane that matched',
          assert: function (matchTag, api) {
            const EMPTY = 0x80;
            const control = new Uint8Array(16).fill(EMPTY);
            control[0] = 0x2a;
            control[2] = 0x2a;
            control[15] = 0x2a;
            control[7] = 0x2b;

            api.assert.equal(matchTag(control, 0, 0x2a), 0x8005,
              'lanes 0, 2 and 15 matched, so bits 0, 2 and 15 are set');
            api.assert.equal(matchTag(control, 0, 0x2b), 1 << 7, 'lane 7 only');
            api.assert.equal(matchTag(control, 0, 0x33), 0, 'a tag nobody carries matches nothing');
          } },
        { name: 'a group of empty control bytes matches no tag at all',
          assert: function (matchTag, api) {
            const control = new Uint8Array(16).fill(0x80);
            for (let tag = 0; tag < 128; tag += 1) {
              api.assert.equal(matchTag(control, 0, tag), 0, 'tag ' + tag + ' against an empty group');
            }
          } },
        { name: 'the offset selects the group, and nothing outside it',
          assert: function (matchTag, api) {
            const control = new Uint8Array(48).fill(0x80);
            control[3] = 0x11;
            control[16 + 3] = 0x11;
            control[16 + 9] = 0x11;
            control[32 + 0] = 0x11;

            api.assert.equal(matchTag(control, 0, 0x11), 1 << 3, 'group 0');
            api.assert.equal(matchTag(control, 16, 0x11), (1 << 3) | (1 << 9), 'group 1');
            api.assert.equal(matchTag(control, 32, 0x11), 1, 'group 2');
          } },
        { name: 'a group-probe lookup built on the mask finds every key',
          assert: function (matchTag, api) {
            const EMPTY = 0x80;
            const GROUP = 16;
            const groups = 4;
            const control = new Uint8Array(groups * GROUP).fill(EMPTY);
            const keys = new Array(groups * GROUP).fill(undefined);

            const hash = function (key) {
              let h = 0x811c9dc5;
              for (let i = 0; i < key.length; i += 1) {
                h ^= key.charCodeAt(i);
                h = Math.imul(h, 0x01000193) >>> 0;
              }
              return h >>> 0;
            };
            const split = function (key) {
              const h = hash(key) >>> 0;
              return { h1: h >>> 7, h2: h & 0x7f };
            };
            const insert = function (key) {
              const parts = split(key);
              for (let i = 0; i < groups; i += 1) {
                const offset = ((parts.h1 + i) % groups) * GROUP;
                for (let lane = 0; lane < GROUP; lane += 1) {
                  if (control[offset + lane] !== EMPTY) continue;
                  control[offset + lane] = parts.h2;
                  keys[offset + lane] = key;
                  return true;
                }
              }
              return false;
            };
            const lookup = function (key) {
              const parts = split(key);
              for (let i = 0; i < groups; i += 1) {
                const offset = ((parts.h1 + i) % groups) * GROUP;
                const mask = matchTag(control, offset, parts.h2);
                for (let lane = 0; lane < GROUP; lane += 1) {
                  if (((mask >>> lane) & 1) && keys[offset + lane] === key) return offset + lane;
                }
                let empty = false;
                for (let lane = 0; lane < GROUP; lane += 1) {
                  if (control[offset + lane] === EMPTY) empty = true;
                }
                if (empty) return -1;
              }
              return -1;
            };

            for (let i = 0; i < 40; i += 1) api.assert.equal(insert('key-' + i), true, 'inserted key-' + i);
            for (let i = 0; i < 40; i += 1) {
              const at = lookup('key-' + i);
              api.assert.ok(at >= 0, 'key-' + i + ' must be found by the group probe');
              api.assert.equal(keys[at], 'key-' + i, 'and the slot it names must hold it');
            }
            for (let i = 100; i < 140; i += 1) {
              api.assert.equal(lookup('key-' + i), -1, 'key-' + i + ' was never inserted');
            }
          } }
      ]
    }],

    rehashing: [{
      id: 'incremental-rehash',
      title: 'Spread the rehash over the operations that caused it',
      prompt: 'createIncremental({ capacity, hash, movePerOp, maxLoad }) returns ' +
        '{ set, get, size, migrating, capacity } for a linear-probed table that never rehashes in one ' +
        'go. When the load passes maxLoad, keep the full table as `old`, allocate a new one of twice ' +
        'the size, and move at most movePerOp entries out of `old` on every later operation. Lookups ' +
        'check both tables while a migration is running. Two traps: a slot you empty in `old` cuts ' +
        'every probe chain that ran through it — mark it moved instead — and set must report the ' +
        'number of entries it moved, which is the number the tests bound. Keep movePerOp high enough ' +
        '(the tests use 4) that a migration finishes before the new table fills.',
      entry: 'createIncremental',
      starter: [
        'function createIncremental(options) {',
        '  const hash = options.hash;',
        '  const maxLoad = options.maxLoad || 0.7;',
        '  let table = newTable(options.capacity || 16);',
        '  let count = 0;',
        '',
        '  function newTable(size) {',
        '    return { keys: new Array(size).fill(null), values: new Array(size).fill(null) };',
        '  }',
        '',
        '  function slotIn(target, key) {',
        '    const capacity = target.keys.length;',
        '    let at = hash(key) % capacity;',
        '    while (target.keys[at] !== null && target.keys[at] !== key) at = (at + 1) % capacity;',
        '    return at;',
        '  }',
        '',
        '  // The whole table, in one call, on whichever unlucky insert crossed the line.',
        '  function grow() {',
        '    const previous = table;',
        '    table = newTable(previous.keys.length * 2);',
        '    let moved = 0;',
        '    previous.keys.forEach(function (key, i) {',
        '      if (key === null) return;',
        '      const at = slotIn(table, key);',
        '      table.keys[at] = key;',
        '      table.values[at] = previous.values[i];',
        '      moved += 1;',
        '    });',
        '    return moved;',
        '  }',
        '',
        '  return {',
        '    set: function (key, value) {',
        '      const at = slotIn(table, key);',
        '      if (table.keys[at] !== key) count += 1;',
        '      table.keys[at] = key;',
        '      table.values[at] = value;',
        '      return count / table.keys.length > maxLoad ? grow() : 0;',
        '    },',
        '    get: function (key) {',
        '      const at = slotIn(table, key);',
        '      return table.keys[at] === key ? table.values[at] : undefined;',
        '    },',
        '    size: function () { return count; },',
        '    migrating: function () { return false; },',
        '    capacity: function () { return table.keys.length; }',
        '  };',
        '}'
      ].join('\n'),
      solution: [
        'function createIncremental(options) {',
        '  const hash = options.hash;',
        '  const movePerOp = options.movePerOp || 2;',
        '  const maxLoad = options.maxLoad || 0.7;',
        '  const MOVED = { moved: true };   // never null, never equal to a key',
        '  let main = newTable(options.capacity || 16);',
        '  let old = null;',
        '  let cursor = 0;',
        '  let count = 0;',
        '',
        '  function newTable(size) {',
        '    return { keys: new Array(size).fill(null), values: new Array(size).fill(null) };',
        '  }',
        '',
        '  // MOVED slots do not stop the walk, so the chain survives the migration.',
        '  function slotIn(target, key) {',
        '    const capacity = target.keys.length;',
        '    let at = hash(key) % capacity;',
        '    while (target.keys[at] !== null && target.keys[at] !== key) at = (at + 1) % capacity;',
        '    return at;',
        '  }',
        '',
        '  function migrate() {',
        '    if (!old) return 0;',
        '    let moved = 0;',
        '    while (cursor < old.keys.length && moved < movePerOp) {',
        '      const key = old.keys[cursor];',
        '      if (key !== null && key !== MOVED) {',
        '        const at = slotIn(main, key);',
        '        main.keys[at] = key;',
        '        main.values[at] = old.values[cursor];',
        '        old.keys[cursor] = MOVED;',
        '        moved += 1;',
        '      }',
        '      cursor += 1;',
        '    }',
        '    if (cursor >= old.keys.length) old = null;',
        '    return moved;',
        '  }',
        '',
        '  function grow() {',
        '    old = main;',
        '    cursor = 0;',
        '    main = newTable(old.keys.length * 2);',
        '  }',
        '',
        '  function set(key, value) {',
        '    const moved = migrate();',
        '    if (old) {',
        '      const found = slotIn(old, key);',
        '      if (old.keys[found] === key) { old.values[found] = value; return moved; }',
        '    }',
        '    const at = slotIn(main, key);',
        '    if (main.keys[at] !== key) count += 1;',
        '    main.keys[at] = key;',
        '    main.values[at] = value;',
        '    if (!old && count / main.keys.length > maxLoad) grow();',
        '    return moved;',
        '  }',
        '',
        '  function get(key) {',
        '    if (old) {',
        '      const found = slotIn(old, key);',
        '      if (old.keys[found] === key) return old.values[found];',
        '    }',
        '    const at = slotIn(main, key);',
        '    return main.keys[at] === key ? main.values[at] : undefined;',
        '  }',
        '',
        '  return {',
        '    set: set,',
        '    get: get,',
        '    size: function () { return count; },',
        '    migrating: function () { return Boolean(old); },',
        '    capacity: function () { return main.keys.length + (old ? old.keys.length : 0); }',
        '  };',
        '}'
      ].join('\n'),
      tests: [
        { name: 'no single insert moves more than movePerOp entries',
          assert: function (createIncremental, api) {
            const hash = function (key) {
              let h = 0x811c9dc5;
              for (let i = 0; i < key.length; i += 1) {
                h ^= key.charCodeAt(i);
                h = Math.imul(h, 0x01000193) >>> 0;
              }
              return h >>> 0;
            };

            const table = createIncremental({ capacity: 16, hash: hash, movePerOp: 4, maxLoad: 0.7 });
            let peak = 0;
            let total = 0;

            for (let i = 0; i < 4000; i += 1) {
              const moved = table.set('key-' + i, i);
              api.assert.ok(Number.isFinite(moved), 'set must report how many entries it moved');
              api.assert.atMost(moved, 4, 'insert ' + i + ' moved ' + moved + ' entries in one call');
              peak = Math.max(peak, moved);
              total += moved;
            }

            api.assert.equal(peak, 4, 'a migration should be running at full rate for most of the run');
            api.assert.atLeast(total, 4000, 'every key is moved at least once by the doubling sequence');
          } },
        { name: 'every key stays findable while a migration is running',
          assert: function (createIncremental, api) {
            const hash = function (key) {
              let h = 5381;
              for (let i = 0; i < key.length; i += 1) h = (Math.imul(h, 33) + key.charCodeAt(i)) >>> 0;
              return h >>> 0;
            };

            const table = createIncremental({ capacity: 16, hash: hash, movePerOp: 4, maxLoad: 0.7 });
            let sawMigration = false;

            for (let i = 0; i < 1500; i += 1) {
              table.set('key-' + i, i * 7);
              if (table.migrating()) sawMigration = true;
              if (i % 50 !== 0) continue;
              for (let j = 0; j <= i; j += 1) {
                api.assert.equal(table.get('key-' + j), j * 7,
                  'key-' + j + ' after ' + (i + 1) + ' inserts (migrating: ' + table.migrating() + ')');
              }
            }

            api.assert.ok(sawMigration, 'the table must actually spend time migrating');
            api.assert.equal(table.get('key-9999'), undefined, 'a key never inserted is undefined');
          } },
        { name: 'updates during a migration are not lost or duplicated',
          assert: function (createIncremental, api) {
            const hash = function (key) {
              let h = 0x811c9dc5;
              for (let i = 0; i < key.length; i += 1) {
                h ^= key.charCodeAt(i);
                h = Math.imul(h, 0x01000193) >>> 0;
              }
              return h >>> 0;
            };

            const table = createIncremental({ capacity: 16, hash: hash, movePerOp: 4, maxLoad: 0.7 });
            const reference = new Map();

            for (let i = 0; i < 2000; i += 1) {
              const key = 'key-' + api.rng.int(600);
              table.set(key, i);
              reference.set(key, i);
              api.assert.equal(table.size(), reference.size, 'size after operation ' + i);
            }

            reference.forEach(function (value, key) {
              api.assert.equal(table.get(key), value, 'final value of ' + key);
            });
          } },
        { name: 'the table doubles and each migration finishes',
          assert: function (createIncremental, api) {
            const hash = function (key) {
              let h = 5381;
              for (let i = 0; i < key.length; i += 1) h = (Math.imul(h, 33) + key.charCodeAt(i)) >>> 0;
              return h >>> 0;
            };

            const table = createIncremental({ capacity: 16, hash: hash, movePerOp: 4, maxLoad: 0.7 });
            for (let i = 0; i < 1000; i += 1) table.set('key-' + i, i);

            api.assert.equal(table.size(), 1000, 'every key is counted once');
            api.assert.atLeast(table.capacity(), Math.ceil(1000 / 0.7), 'the table grew enough');

            for (let i = 1000; i < 1400; i += 1) table.set('key-' + i, i);
            api.assert.equal(table.migrating(), false, 'the migration finished within 400 operations');
            for (let i = 0; i < 1400; i += 1) {
              api.assert.equal(table.get('key-' + i), i, 'key-' + i + ' survived the migration');
            }
          } }
      ]
    }],

    'perfect-hashing': [{
      id: 'fks',
      title: 'Build the FKS second level and prove it collision-free',
      prompt: 'buildFks(keys, hash) builds the classic two-level perfect hash for a key set that is ' +
        'fixed at build time. hash(key, seed) returns a non-negative integer. Level one sends each key ' +
        'to bucket hash(key, 0) % n, with n = keys.length. A bucket holding b keys gets a level-two ' +
        'table of exactly b² slots, and the smallest seed ≥ 1 that places its keys with no collision — ' +
        'b² is what makes that search terminate after a couple of tries, by the birthday bound. Return ' +
        '{ levels, secondarySlots, lookup }, where levels[i] is { size, seed, slots } and lookup(key) ' +
        'gives the index inside its own level-two table, or -1 when the key is not in the set.',
      entry: 'buildFks',
      starter: [
        'function buildFks(keys, hash) {',
        '  const n = keys.length;',
        '  const buckets = [];',
        '  for (let i = 0; i < n; i += 1) buckets.push([]);',
        '  keys.forEach(function (key) { buckets[hash(key, 0) % n].push(key); });',
        '',
        '  const levels = buckets.map(function (bucket) {',
        '    // b slots for b keys, and no retry: the birthday bound says this collides.',
        '    const size = bucket.length;',
        '    const slots = new Array(size).fill(undefined);',
        '    bucket.forEach(function (key) { slots[hash(key, 1) % Math.max(1, size)] = key; });',
        '    return { size: size, seed: 1, slots: slots };',
        '  });',
        '',
        '  return {',
        '    levels: levels,',
        '    secondarySlots: levels.reduce(function (sum, level) { return sum + level.size; }, 0),',
        '    lookup: function (key) {',
        '      const level = levels[hash(key, 0) % n];',
        '      if (!level.size) return -1;',
        '      const at = hash(key, level.seed) % level.size;',
        '      return level.slots[at] === key ? at : -1;',
        '    }',
        '  };',
        '}'
      ].join('\n'),
      solution: [
        'function buildFks(keys, hash) {',
        '  const n = keys.length;',
        '  const buckets = [];',
        '  for (let i = 0; i < n; i += 1) buckets.push([]);',
        '  keys.forEach(function (key) { buckets[hash(key, 0) % n].push(key); });',
        '',
        '  function place(bucket, seed, size) {',
        '    const slots = new Array(size).fill(undefined);',
        '    for (let i = 0; i < bucket.length; i += 1) {',
        '      const at = hash(bucket[i], seed) % size;',
        '      if (slots[at] !== undefined) return null;',
        '      slots[at] = bucket[i];',
        '    }',
        '    return slots;',
        '  }',
        '',
        '  const levels = buckets.map(function (bucket) {',
        '    if (!bucket.length) return { size: 0, seed: 0, slots: [] };',
        '    const size = bucket.length * bucket.length;',
        '    for (let seed = 1; seed < 4096; seed += 1) {',
        '      const slots = place(bucket, seed, size);',
        '      if (slots) return { size: size, seed: seed, slots: slots };',
        '    }',
        '    throw new Error(\'no collision-free seed for a bucket of \' + bucket.length);',
        '  });',
        '',
        '  return {',
        '    levels: levels,',
        '    secondarySlots: levels.reduce(function (sum, level) { return sum + level.size; }, 0),',
        '    lookup: function (key) {',
        '      const level = levels[hash(key, 0) % n];',
        '      if (!level.size) return -1;',
        '      const at = hash(key, level.seed) % level.size;',
        '      return level.slots[at] === key ? at : -1;',
        '    }',
        '  };',
        '}'
      ].join('\n'),
      tests: [
        { name: 'every key lands on its own slot, and no two share one',
          assert: function (buildFks, api) {
            const hash = function (key, seed) {
              const text = String(key);
              let h = (0x811c9dc5 ^ Math.imul(seed || 0, 0x9e3779b1)) >>> 0;
              for (let i = 0; i < text.length; i += 1) {
                h ^= text.charCodeAt(i);
                h = Math.imul(h, 0x01000193) >>> 0;
              }
              h ^= h >>> 16;
              h = Math.imul(h, 0x85ebca6b) >>> 0;
              h ^= h >>> 13;
              return h >>> 0;
            };

            const keys = [];
            for (let i = 0; i < 400; i += 1) keys.push('word-' + i + '-' + (i * 7 % 13));

            const built = buildFks(keys, hash);
            const offsets = [];
            let running = 0;
            built.levels.forEach(function (level) { offsets.push(running); running += level.size; });

            const positions = new Set();
            keys.forEach(function (key) {
              const at = built.lookup(key);
              api.assert.atLeast(at, 0, key + ' must be found');
              positions.add(offsets[hash(key, 0) % keys.length] + at);
            });
            api.assert.equal(positions.size, keys.length, 'every key occupies a distinct global slot');
          } },
        { name: 'a bucket of b keys gets b² slots and a seed that really works',
          assert: function (buildFks, api) {
            const hash = function (key, seed) {
              const text = String(key);
              let h = (0x811c9dc5 ^ Math.imul(seed || 0, 0x9e3779b1)) >>> 0;
              for (let i = 0; i < text.length; i += 1) {
                h ^= text.charCodeAt(i);
                h = Math.imul(h, 0x01000193) >>> 0;
              }
              h ^= h >>> 16;
              h = Math.imul(h, 0x85ebca6b) >>> 0;
              h ^= h >>> 13;
              return h >>> 0;
            };

            const keys = [];
            for (let i = 0; i < 300; i += 1) keys.push('k' + (i * 3));

            const built = buildFks(keys, hash);
            const buckets = built.levels.map(function () { return []; });
            keys.forEach(function (key) { buckets[hash(key, 0) % keys.length].push(key); });

            let crowded = 0;
            built.levels.forEach(function (level, i) {
              const b = buckets[i].length;
              api.assert.equal(level.size, b * b, 'bucket ' + i + ' holds ' + b + ' keys');
              if (b < 2) return;
              crowded += 1;
              const seen = new Set();
              buckets[i].forEach(function (key) { seen.add(hash(key, level.seed) % level.size); });
              api.assert.equal(seen.size, b, 'bucket ' + i + ' seed ' + level.seed + ' still collides');
            });
            api.assert.atLeast(crowded, 1, 'the test needs at least one bucket with two keys in it');
          } },
        { name: 'the secondary space stays near the 2n the theory promises',
          assert: function (buildFks, api) {
            const hash = function (key, seed) {
              const text = String(key);
              let h = (0x811c9dc5 ^ Math.imul(seed || 0, 0x9e3779b1)) >>> 0;
              for (let i = 0; i < text.length; i += 1) {
                h ^= text.charCodeAt(i);
                h = Math.imul(h, 0x01000193) >>> 0;
              }
              h ^= h >>> 16;
              h = Math.imul(h, 0x85ebca6b) >>> 0;
              h ^= h >>> 13;
              return h >>> 0;
            };

            const keys = [];
            for (let i = 0; i < 500; i += 1) keys.push('key-' + i);

            const built = buildFks(keys, hash);
            api.assert.atLeast(built.secondarySlots, keys.length, 'every key needs a slot');
            api.assert.atMost(built.secondarySlots, keys.length * 3,
              'E[Σ b²] < 2n, so ' + built.secondarySlots + ' slots for ' + keys.length + ' keys is too many');
          } },
        { name: 'a key that is not in the set is rejected',
          assert: function (buildFks, api) {
            const hash = function (key, seed) {
              const text = String(key);
              let h = (0x811c9dc5 ^ Math.imul(seed || 0, 0x9e3779b1)) >>> 0;
              for (let i = 0; i < text.length; i += 1) {
                h ^= text.charCodeAt(i);
                h = Math.imul(h, 0x01000193) >>> 0;
              }
              h ^= h >>> 16;
              h = Math.imul(h, 0x85ebca6b) >>> 0;
              h ^= h >>> 13;
              return h >>> 0;
            };

            const keys = [];
            for (let i = 0; i < 200; i += 1) keys.push('member-' + i);

            const built = buildFks(keys, hash);
            for (let i = 0; i < 200; i += 1) {
              api.assert.equal(built.lookup('stranger-' + i), -1, 'stranger-' + i + ' is not a member');
            }
            api.assert.atLeast(built.lookup('member-17'), 0, 'and members are still found');
          } }
      ]
    }],

    'hash-in-practice': [{
      id: 'ordered-map',
      title: 'Keep insertion order, delete in O(1), and still bound the memory',
      prompt: 'createOrderedMap({ compactAt }) returns { set, get, delete, keys, size, slots } for the ' +
        'structure behind JavaScript\'s Map: entries live in an append-only array in insertion order, ' +
        'and a Map from key to position indexes them. Delete punches a hole (entries[at] = null) so it ' +
        'stays O(1) — splicing would be O(n). Holes are what grows the array, so compact it — rebuild ' +
        'in order, dropping the holes and reindexing — when holes > max(8, slots × compactAt). ' +
        'compactAt = 0 disables compaction. slots() reports the backing array length, holes included.',
      entry: 'createOrderedMap',
      starter: [
        'function createOrderedMap(options) {',
        '  let entries = [];',
        '  const index = new Map();',
        '',
        '  return {',
        '    set: function (key, value) {',
        '      const at = index.get(key);',
        '      if (at !== undefined) { entries[at].value = value; return false; }',
        '      index.set(key, entries.length);',
        '      entries.push({ key: key, value: value });',
        '      return true;',
        '    },',
        '    get: function (key) {',
        '      const at = index.get(key);',
        '      return at === undefined ? undefined : entries[at].value;',
        '    },',
        '    // O(1), and the hole it leaves is never reclaimed.',
        '    delete: function (key) {',
        '      const at = index.get(key);',
        '      if (at === undefined) return false;',
        '      entries[at] = null;',
        '      index.delete(key);',
        '      return true;',
        '    },',
        '    keys: function () {',
        '      const out = [];',
        '      entries.forEach(function (entry) { if (entry) out.push(entry.key); });',
        '      return out;',
        '    },',
        '    size: function () { return index.size; },',
        '    slots: function () { return entries.length; }',
        '  };',
        '}'
      ].join('\n'),
      solution: [
        'function createOrderedMap(options) {',
        '  const compactAt = (options || {}).compactAt === undefined ? 0.5 : options.compactAt;',
        '  let entries = [];',
        '  const index = new Map();',
        '  let holes = 0;',
        '',
        '  function compact() {',
        '    const live = [];',
        '    entries.forEach(function (entry) {',
        '      if (!entry) return;',
        '      index.set(entry.key, live.length);',
        '      live.push(entry);',
        '    });',
        '    entries = live;',
        '    holes = 0;',
        '  }',
        '',
        '  return {',
        '    set: function (key, value) {',
        '      const at = index.get(key);',
        '      if (at !== undefined) { entries[at].value = value; return false; }',
        '      index.set(key, entries.length);',
        '      entries.push({ key: key, value: value });',
        '      return true;',
        '    },',
        '    get: function (key) {',
        '      const at = index.get(key);',
        '      return at === undefined ? undefined : entries[at].value;',
        '    },',
        '    delete: function (key) {',
        '      const at = index.get(key);',
        '      if (at === undefined) return false;',
        '      entries[at] = null;',
        '      index.delete(key);',
        '      holes += 1;',
        '      if (compactAt > 0 && holes > Math.max(8, entries.length * compactAt)) compact();',
        '      return true;',
        '    },',
        '    keys: function () {',
        '      const out = [];',
        '      entries.forEach(function (entry) { if (entry) out.push(entry.key); });',
        '      return out;',
        '    },',
        '    size: function () { return index.size; },',
        '    slots: function () { return entries.length; }',
        '  };',
        '}'
      ].join('\n'),
      tests: [
        { name: 'iteration is insertion order, and re-inserting moves a key to the end',
          assert: function (createOrderedMap, api) {
            const map = createOrderedMap({ compactAt: 0.5 });
            ['a', 'b', 'c', 'd'].forEach(function (key, i) {
              api.assert.equal(map.set(key, i), true, 'set ' + key + ' is new');
            });
            api.assert.deepEqual(map.keys(), ['a', 'b', 'c', 'd'], 'insertion order');

            api.assert.equal(map.set('b', 99), false, 'updating an existing key');
            api.assert.deepEqual(map.keys(), ['a', 'b', 'c', 'd'], 'an update keeps the position');
            api.assert.equal(map.get('b'), 99, 'and the new value');

            api.assert.equal(map.delete('b'), true, 'delete b');
            api.assert.deepEqual(map.keys(), ['a', 'c', 'd'], 'b is gone');
            map.set('b', 5);
            api.assert.deepEqual(map.keys(), ['a', 'c', 'd', 'b'], 're-insertion goes to the end');
            api.assert.equal(map.size(), 4, 'four live entries');
          } },
        { name: 'the compaction rule holds the array proportional to the live set',
          assert: function (createOrderedMap, api) {
            const map = createOrderedMap({ compactAt: 0.5 });
            for (let i = 0; i < 200; i += 1) map.set('k' + i, i);

            for (let round = 0; round < 5000; round += 1) {
              const key = 'k' + (round % 200);
              api.assert.equal(map.delete(key), true, 'delete ' + key + ' in round ' + round);
              map.set(key, round);
            }

            api.assert.equal(map.size(), 200, 'the live set never changed size');
            api.assert.atMost(map.slots(), 600,
              'the backing array holds ' + map.slots() + ' slots for 200 entries');
            api.assert.equal(map.keys().length, 200, 'iteration visits exactly the live entries');
            api.assert.equal(new Set(map.keys()).size, 200, 'and each of them once');
          } },
        { name: 'with compaction disabled the array grows by one slot per delete',
          assert: function (createOrderedMap, api) {
            const map = createOrderedMap({ compactAt: 0 });
            for (let i = 0; i < 50; i += 1) map.set('k' + i, i);

            for (let round = 0; round < 1000; round += 1) {
              const key = 'k' + (round % 50);
              map.delete(key);
              map.set(key, round);
            }

            api.assert.equal(map.size(), 50, 'still 50 live entries');
            api.assert.atLeast(map.slots(), 1000, 'every delete left a hole nothing reclaims');
            api.assert.equal(map.keys().length, 50, 'iteration still walks past all of them correctly');
          } },
        { name: 'lookups and deletes of absent keys behave',
          assert: function (createOrderedMap, api) {
            const map = createOrderedMap({ compactAt: 0.5 });
            api.assert.equal(map.get('nothing'), undefined, 'an empty map has nothing');
            api.assert.equal(map.delete('nothing'), false, 'and deletes nothing');
            api.assert.equal(map.size(), 0, 'size 0');

            for (let i = 0; i < 100; i += 1) map.set('k' + i, i * 2);
            for (let i = 0; i < 100; i += 2) map.delete('k' + i);

            api.assert.equal(map.size(), 50, 'half remain');
            for (let i = 1; i < 100; i += 2) api.assert.equal(map.get('k' + i), i * 2, 'k' + i);
            for (let i = 0; i < 100; i += 2) api.assert.equal(map.get('k' + i), undefined, 'k' + i + ' deleted');
          } }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));

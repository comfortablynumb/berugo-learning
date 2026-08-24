/**
 * Graded exercises for threat models, randomness and hashing (M23.1-M23.3).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 * The sandbox has no crypto library, so where a hash is needed the test
 * defines a toy one and passes it in; the construction under test is the
 * lesson, not the primitive.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'threat-models-and-primitives': [{
      id: 'requirement-to-primitive',
      title: 'Map a requirement to a primitive, its parameters and its failure mode',
      prompt: 'choose(goal) must return { primitive, parameter, failure } for each of six ' +
        'goals: "encrypt", "authenticate-shared", "authenticate-third-party", "store-passwords", ' +
        '"derive-keys" and "random". Use these exact answers — primitive first, then the ' +
        'parameter that gets chosen wrongly, then the classic failure. encrypt → "AEAD", ' +
        '"96-bit nonce, never repeated", "nonce reuse". authenticate-shared → "HMAC", ' +
        '"256-bit key", "hash(key || message) instead of HMAC". authenticate-third-party → ' +
        '"signature", "deterministic nonce", "nonce reuse recovers the key". store-passwords → ' +
        '"Argon2id", "memory cost", "a fast hash". derive-keys → "HKDF", "context string", ' +
        '"using the shared secret directly". random → "CSPRNG", "none", "seeding it yourself". ' +
        'The starter answers every goal with encryption, which is the mistake the section is ' +
        'about.',
      entry: 'choose',
      starter: [
        'function choose(goal) {',
        '  // Everything is "encrypt it", which answers one goal out of four.',
        '  return {',
        '    primitive: \'AEAD\',',
        '    parameter: \'96-bit nonce, never repeated\',',
        '    failure: \'nonce reuse\'',
        '  };',
        '}'
      ].join('\n'),
      solution: [
        'function choose(goal) {',
        '  const table = {',
        '    \'encrypt\': [\'AEAD\', \'96-bit nonce, never repeated\', \'nonce reuse\'],',
        '    \'authenticate-shared\': [\'HMAC\', \'256-bit key\',',
        '      \'hash(key || message) instead of HMAC\'],',
        '    \'authenticate-third-party\': [\'signature\', \'deterministic nonce\',',
        '      \'nonce reuse recovers the key\'],',
        '    \'store-passwords\': [\'Argon2id\', \'memory cost\', \'a fast hash\'],',
        '    \'derive-keys\': [\'HKDF\', \'context string\', \'using the shared secret directly\'],',
        '    \'random\': [\'CSPRNG\', \'none\', \'seeding it yourself\']',
        '  };',
        '  const row = table[goal];',
        '',
        '  if (!row) return null;',
        '  return { primitive: row[0], parameter: row[1], failure: row[2] };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'encryption and shared-key authentication are different answers',
          assert: function (choose, api) {
            api.assert.equal(choose('encrypt').primitive, 'AEAD', 'encryption needs an AEAD');
            api.assert.equal(choose('authenticate-shared').primitive, 'HMAC',
              'a shared-key MAC is not encryption');
            api.assert.notEqual(choose('authenticate-shared').primitive,
              choose('encrypt').primitive, 'the two goals must not collapse to one answer');
          }
        },
        {
          name: 'a third party needs a signature, not a MAC',
          assert: function (choose, api) {
            api.assert.equal(choose('authenticate-third-party').primitive, 'signature',
              'a MAC is forgeable by the verifier, so it proves nothing to anyone else');
            api.assert.equal(choose('authenticate-third-party').failure,
              'nonce reuse recovers the key', 'and its classic failure is the ECDSA nonce bug');
          }
        },
        {
          name: 'all six goals are answered, and no two share a primitive by accident',
          assert: function (choose, api) {
            const goals = ['encrypt', 'authenticate-shared', 'authenticate-third-party',
              'store-passwords', 'derive-keys', 'random'];
            const seen = {};

            goals.forEach(function (goal) {
              const row = choose(goal);

              api.assert.ok(row && row.primitive && row.parameter && row.failure,
                goal + ' must name a primitive, a parameter and a failure');
              seen[row.primitive] = (seen[row.primitive] || 0) + 1;
            });
            api.assert.equal(Object.keys(seen).length, 6,
              'six goals, six different primitives');
            api.assert.equal(choose('store-passwords').parameter, 'memory cost',
              'for passwords the parameter is the security control');
          }
        }
      ]
    }],

    'randomness-for-cryptography': [{
      id: 'lcg-state-recovery',
      title: 'Recover a generator’s state and predict its future exactly',
      prompt: 'predict(observed, params, count) must return the next `count` outputs of a linear ' +
        'congruential generator, exactly. `observed` is an array of consecutive outputs the ' +
        'attacker has seen and `params` is { a, c, m } with the published constants. The state ' +
        'of an LCG is the value it last emitted, so no searching is required: take the last ' +
        'observed value and apply x = (a·x + c) mod m repeatedly. The starter returns random ' +
        'numbers, which is what a generator that could not be predicted would force you to do.',
      entry: 'predict',
      starter: [
        'function predict(observed, params, count) {',
        '  // Guessing. This is what you would have to do against a CSPRNG.',
        '  const out = [];',
        '',
        '  for (let i = 0; i < count; i += 1) out.push(0);',
        '  return out;',
        '}'
      ].join('\n'),
      solution: [
        'function predict(observed, params, count) {',
        '  let state = observed[observed.length - 1];',
        '  const out = [];',
        '',
        '  for (let i = 0; i < count; i += 1) {',
        '    state = (params.a * state + params.c) % params.m;',
        '    out.push(state);',
        '  }',
        '  return out;',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'every predicted value matches, with one observation',
          assert: function (predict, api) {
            const params = { a: 1103515245, c: 12345, m: 2147483648 };
            let state = 42;
            const stream = [];

            for (let i = 0; i < 12; i += 1) {
              state = (params.a * state + params.c) % params.m;
              stream.push(state);
            }
            const got = predict(stream.slice(0, 1), params, 8);

            api.assert.equal(got.length, 8, 'eight predictions were asked for');
            api.assert.deepEqual(got, stream.slice(1, 9),
              'one observation is the whole state, so every value must match exactly');
          }
        },
        {
          name: 'more observations change nothing, because one was already enough',
          assert: function (predict, api) {
            const params = { a: 1103515245, c: 12345, m: 2147483648 };
            let state = 7;
            const stream = [];

            for (let i = 0; i < 20; i += 1) {
              state = (params.a * state + params.c) % params.m;
              stream.push(state);
            }
            const fromOne = predict(stream.slice(0, 1), params, 6);
            const fromFour = predict(stream.slice(0, 4), params, 6);

            api.assert.deepEqual(fromOne, stream.slice(1, 7), 'one observation predicts');
            api.assert.deepEqual(fromFour, stream.slice(4, 10),
              'four observations predict from the fourth, not from the first');
          }
        },
        {
          name: 'it works for other published constants too',
          assert: function (predict, api) {
            const params = { a: 1664525, c: 1013904223, m: 4294967296 };
            let state = 2024;
            const stream = [];

            for (let i = 0; i < 10; i += 1) {
              state = (params.a * state + params.c) % params.m;
              stream.push(state);
            }
            api.assert.deepEqual(predict(stream.slice(0, 2), params, 5), stream.slice(2, 7),
              'the attack is the recurrence, so any published constants work');
          }
        }
      ]
    }],

    'hash-functions-and-macs': [{
      id: 'hmac-over-a-provided-hash',
      title: 'Build HMAC, and see the naive construction forged beside it',
      prompt: 'hmac(hash, blockSize, key, message) must return the HMAC of the message under the ' +
        'key, using the supplied `hash` function and block size. The construction is: pad the ' +
        'key with zeros to blockSize (hashing it first if it is longer), XOR one copy with 0x36 ' +
        'and another with 0x5c, then return hash(outer.concat(hash(inner.concat(message)))). ' +
        'All values are arrays of byte numbers. The starter returns the naive ' +
        'hash(key.concat(message)), which the tests forge.',
      entry: 'hmac',
      starter: [
        'function hmac(hash, blockSize, key, message) {',
        '  // The construction that is not a MAC: the digest is a resumable state.',
        '  return hash(key.concat(message));',
        '}'
      ].join('\n'),
      solution: [
        'function hmac(hash, blockSize, key, message) {',
        '  let block = key.length > blockSize ? hash(key) : key.slice();',
        '',
        '  while (block.length < blockSize) block.push(0);',
        '  const inner = block.map(function (byte) { return byte ^ 0x36; });',
        '  const outer = block.map(function (byte) { return byte ^ 0x5c; });',
        '',
        '  return hash(outer.concat(hash(inner.concat(message))));',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the tag depends on the key and the message, and has the digest length',
          assert: function (hmac, api) {
            const toy = function (bytes) {
              const state = [1, 2, 3, 4];

              bytes.forEach(function (byte, i) {
                state[i % 4] = ((state[i % 4] * 31 + byte + i) >>> 0) % 251;
              });
              return state.slice();
            };
            const a = hmac(toy, 8, [1, 2, 3], [9, 9, 9]);
            const b = hmac(toy, 8, [1, 2, 4], [9, 9, 9]);
            const c = hmac(toy, 8, [1, 2, 3], [9, 9, 8]);

            api.assert.equal(a.length, 4, 'the tag is a digest of the toy hash');
            api.assert.notEqual(a.join(','), b.join(','), 'a different key gives a different tag');
            api.assert.notEqual(a.join(','), c.join(','),
              'a different message gives a different tag');
          }
        },
        {
          name: 'the naive construction is forgeable and this one is not',
          assert: function (hmac, api) {
            /* A toy Merkle-Damgard hash: the digest IS the state, so it can be
               resumed. That is the whole property the attack needs. */
            const compress = function (state, byte, i) {
              return [(state[0] * 31 + byte) % 251, (state[1] + byte * 7 + i) % 251,
                (state[2] ^ byte) % 251, (state[3] + byte + 1) % 251];
            };
            const hashFrom = function (state, bytes, offset) {
              let s = state.slice();

              bytes.forEach(function (byte, i) { s = compress(s, byte, offset + i); });
              return s;
            };
            const toy = function (bytes) { return hashFrom([1, 2, 3, 4], bytes, 0); };
            const secret = [7, 7, 7, 7, 7];
            const message = [10, 20, 30];
            const suffix = [99, 98];

            const naiveTag = toy(secret.concat(message));
            const forged = hashFrom(naiveTag, suffix, secret.length + message.length);
            const honest = toy(secret.concat(message).concat(suffix));

            api.assert.deepEqual(forged, honest,
              'the naive tag is a resumable state, so extending it forges a valid tag');

            const keyedTag = hmac(toy, 8, secret, message);
            const keyedForged = hashFrom(keyedTag, suffix, secret.length + message.length);
            const keyedHonest = hmac(toy, 8, secret, message.concat(suffix));

            api.assert.notEqual(keyedForged.join(','), keyedHonest.join(','),
              'resuming an HMAC tag extends the outer hash, which the verifier never re-hashes');
          }
        },
        {
          name: 'a key longer than the block is hashed first, not truncated',
          assert: function (hmac, api) {
            const toy = function (bytes) {
              const state = [5, 6, 7, 8];

              bytes.forEach(function (byte, i) {
                state[i % 4] = ((state[i % 4] * 17 + byte * 3 + i) >>> 0) % 241;
              });
              return state.slice();
            };
            const longKey = [];

            for (let i = 0; i < 30; i += 1) longKey.push(i + 1);
            const shortened = longKey.slice(0, 8);
            const message = [4, 5, 6];

            api.assert.notEqual(hmac(toy, 8, longKey, message).join(','),
              hmac(toy, 8, shortened, message).join(','),
              'a long key must be hashed down, not cut off at the block size');
            api.assert.deepEqual(hmac(toy, 8, longKey, message),
              hmac(toy, 8, toy(longKey), message),
              'hashing the long key first must give the same tag as passing it whole');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));

/**
 * Graded exercises for password hashing, modes and AEAD (M23.4-M23.6).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'password-hashing': [{
      id: 'cracking-cost',
      title: 'Price the attacker, and find where memory starts to bind',
      prompt: 'cost(config) must return { effectiveCores, guessesPerSecond, daysForEightChars, ' +
        'memoryLimited } for an attacker with config.cores and config.memoryMb of RAM, running ' +
        'config.speedup times faster per guess than the defender’s config.verifyMs. Each guess ' +
        'needs config.memoryKb of memory, so the attacker runs the SMALLER of their core count ' +
        'and floor(memoryMb × 1024 / memoryKb) guesses at once — and when memoryKb is 0, memory ' +
        'never binds. Rate is effectiveCores × 1000 / (verifyMs / speedup); days is 62^8 / rate ' +
        '/ 86400; memoryLimited is true only when memory strictly reduced the parallelism. The ' +
        'starter ignores memory entirely, which is the mistake the section is about.',
      entry: 'cost',
      starter: [
        'function cost(config) {',
        '  // Memory is ignored, so Argon2 looks exactly like PBKDF2.',
        '  const perGuessMs = config.verifyMs / config.speedup;',
        '  const rate = config.cores * 1000 / perGuessMs;',
        '',
        '  return {',
        '    effectiveCores: config.cores,',
        '    guessesPerSecond: rate,',
        '    daysForEightChars: Math.pow(62, 8) / rate / 86400,',
        '    memoryLimited: false',
        '  };',
        '}'
      ].join('\n'),
      solution: [
        'function cost(config) {',
        '  const memoryLimit = config.memoryKb > 0',
        '    ? Math.floor(config.memoryMb * 1024 / config.memoryKb)',
        '    : config.cores;',
        '  const effectiveCores = Math.min(config.cores, memoryLimit);',
        '  const perGuessMs = config.verifyMs / config.speedup;',
        '  const rate = effectiveCores * 1000 / perGuessMs;',
        '',
        '  return {',
        '    effectiveCores: effectiveCores,',
        '    guessesPerSecond: rate,',
        '    daysForEightChars: Math.pow(62, 8) / rate / 86400,',
        '    memoryLimited: config.memoryKb > 0 && memoryLimit < config.cores',
        '  };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'a fast hash and a slow one differ by the ratio of their verification times',
          assert: function (cost, api) {
            const base = { cores: 4096, memoryMb: 16384, speedup: 20, memoryKb: 0 };
            const fast = cost(Object.assign({}, base, { verifyMs: 0.002 }));
            const slow = cost(Object.assign({}, base, { verifyMs: 250 }));

            api.assert.closeTo(fast.guessesPerSecond, 4.096e10, 1e7,
              'unsalted SHA-256 at 0.002 ms gives about 4.096e10 guesses per second');
            api.assert.closeTo(slow.guessesPerSecond, 3.277e5, 1e3,
              'PBKDF2 at 250 ms gives about 3.277e5');
            api.assert.closeTo(fast.guessesPerSecond / slow.guessesPerSecond, 125000, 1000,
              'the ratio is exactly the ratio of the verification times');
            api.assert.closeTo(fast.daysForEightChars, 0.0617, 0.002,
              'a random 8-character password falls in about 0.06 days against the fast hash');
          }
        },
        {
          name: 'memory binds only past a threshold, and then every doubling halves the attacker',
          assert: function (cost, api) {
            const base = { cores: 4096, memoryMb: 16384, speedup: 20, verifyMs: 250 };
            const tiny = cost(Object.assign({}, base, { memoryKb: 4096 }));
            const mid = cost(Object.assign({}, base, { memoryKb: 65536 }));
            const big = cost(Object.assign({}, base, { memoryKb: 524288 }));

            api.assert.equal(tiny.effectiveCores, 4096,
              'at 4 MiB the attacker fits 4 096 instances, so cores still bind');
            api.assert.equal(tiny.memoryLimited, false,
              'and memory has not reduced the parallelism at all');
            api.assert.equal(mid.effectiveCores, 256, 'at 64 MiB only 256 instances fit');
            api.assert.equal(mid.memoryLimited, true, 'and now memory binds');
            api.assert.equal(big.effectiveCores, 32, 'at 512 MiB only 32 fit');
            api.assert.closeTo(tiny.guessesPerSecond / big.guessesPerSecond, 128, 0.01,
              'the sweep divides the attacker by 128 at identical defender cost');
          }
        },
        {
          name: 'bcrypt’s 4 KiB does not constrain a 16 GiB rig',
          assert: function (cost, api) {
            const bcrypt = cost({ cores: 4096, memoryMb: 16384, speedup: 20, verifyMs: 250,
              memoryKb: 4 });
            const pbkdf2 = cost({ cores: 4096, memoryMb: 16384, speedup: 20, verifyMs: 250,
              memoryKb: 0 });

            api.assert.equal(bcrypt.memoryLimited, false,
              '16 GiB / 4 KiB is 4 194 304 instances, far more than the core count');
            api.assert.closeTo(bcrypt.guessesPerSecond, pbkdf2.guessesPerSecond, 1,
              'so bcrypt at cost 12 prices identically to PBKDF2 with no memory at all');
          }
        }
      ]
    }],

    'symmetric-encryption': [{
      id: 'ctr-mode',
      title: 'Build CTR mode, and see what a repeated counter costs',
      prompt: 'ctr(encryptBlock, blockSize, data, nonce) must encrypt (or decrypt — they are the ' +
        'same operation) by building a keystream and XORing. For block index i, the counter ' +
        'block is the nonce bytes followed by the four big-endian bytes of i, padded or ' +
        'truncated to blockSize; encryptBlock turns that into blockSize keystream bytes. XOR the ' +
        'keystream with the data, byte for byte, and return an array the same length as the ' +
        'input. The starter encrypts the plaintext blocks directly, which is ECB.',
      entry: 'ctr',
      starter: [
        'function ctr(encryptBlock, blockSize, data, nonce) {',
        '  // This is ECB: the plaintext goes through the cipher, so equal blocks match.',
        '  const out = [];',
        '',
        '  for (let i = 0; i < data.length; i += blockSize) {',
        '    const block = data.slice(i, i + blockSize);',
        '',
        '    while (block.length < blockSize) block.push(0);',
        '    encryptBlock(block).forEach(function (byte) { out.push(byte); });',
        '  }',
        '  return out.slice(0, data.length);',
        '}'
      ].join('\n'),
      solution: [
        'function ctr(encryptBlock, blockSize, data, nonce) {',
        '  function counterBlock(index) {',
        '    const block = nonce.slice(0, blockSize);',
        '',
        '    while (block.length < blockSize) block.push(0);',
        '    for (let i = 0; i < 4; i += 1) {',
        '      block[blockSize - 1 - i] = (index >>> (8 * i)) & 0xff;',
        '    }',
        '    return block;',
        '  }',
        '  const out = [];',
        '',
        '  for (let i = 0; i < data.length; i += blockSize) {',
        '    const stream = encryptBlock(counterBlock(Math.floor(i / blockSize)));',
        '',
        '    for (let j = 0; j < blockSize && i + j < data.length; j += 1) {',
        '      out.push(data[i + j] ^ stream[j]);',
        '    }',
        '  }',
        '  return out;',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'it round-trips, preserves length, and hides repeated blocks',
          assert: function (ctr, api) {
            const encryptBlock = function (block) {
              return block.map(function (byte, i) {
                return (byte * 37 + i * 11 + 91) & 0xff;
              });
            };
            const nonce = [1, 2, 3, 4, 5, 6, 7, 8];
            const plaintext = [];

            for (let i = 0; i < 40; i += 1) plaintext.push(i % 16 === 0 ? 65 : 66);
            const cipher = ctr(encryptBlock, 16, plaintext, nonce);

            api.assert.equal(cipher.length, plaintext.length,
              'CTR needs no padding, so the length is unchanged');
            api.assert.deepEqual(ctr(encryptBlock, 16, cipher, nonce), plaintext,
              'encryption and decryption are the same operation');

            const first = cipher.slice(0, 16).join(',');
            const second = cipher.slice(16, 32).join(',');

            api.assert.notEqual(first, second,
              'identical plaintext blocks must NOT give identical ciphertext blocks');
          }
        },
        {
          name: 'reusing the nonce publishes the XOR of both plaintexts',
          assert: function (ctr, api) {
            const encryptBlock = function (block) {
              return block.map(function (byte, i) {
                return (byte * 53 + i * 7 + 13) & 0xff;
              });
            };
            const nonce = [9, 9, 9, 9];
            const a = [];
            const b = [];

            for (let i = 0; i < 24; i += 1) { a.push(i + 1); b.push(200 - i); }
            const ca = ctr(encryptBlock, 16, a, nonce);
            const cb = ctr(encryptBlock, 16, b, nonce);
            const cipherXor = ca.map(function (byte, i) { return byte ^ cb[i]; });
            const plainXor = a.map(function (byte, i) { return byte ^ b[i]; });

            api.assert.deepEqual(cipherXor, plainXor,
              'the keystream cancels, so the ciphertexts XOR to the plaintexts XOR');

            const recovered = cipherXor.map(function (byte, i) { return byte ^ a[i]; });

            api.assert.deepEqual(recovered, b,
              'one known plaintext therefore yields the other, in full');
          }
        },
        {
          name: 'a different nonce gives a different keystream',
          assert: function (ctr, api) {
            const encryptBlock = function (block) {
              return block.map(function (byte, i) {
                return (byte * 29 + i * 5 + 3) & 0xff;
              });
            };
            const message = [];

            for (let i = 0; i < 20; i += 1) message.push(100);
            const one = ctr(encryptBlock, 16, message, [1, 1, 1, 1]);
            const two = ctr(encryptBlock, 16, message, [2, 2, 2, 2]);

            api.assert.notEqual(one.join(','), two.join(','),
              'the counter block includes the nonce, so the keystream must change with it');
            api.assert.deepEqual(ctr(encryptBlock, 16, two, [2, 2, 2, 2]), message,
              'and each still round-trips under its own nonce');
          }
        }
      ]
    }],

    'authenticated-encryption': [{
      id: 'encrypt-then-mac',
      title: 'Verify before you decrypt, in constant time',
      prompt: 'open(sealed, deps) must return { plaintext, verified } for a sealed message ' +
        '{ iv, ciphertext, tag }. Recompute the expected tag with deps.mac(iv.concat(ciphertext)) ' +
        'and compare it with the supplied tag using a comparison that reads EVERY byte — no ' +
        'early exit — and that treats a wrong length as a failure. Only if the tags match may ' +
        'you call deps.decrypt(iv, ciphertext); otherwise return { plaintext: null, verified: ' +
        'false } without calling it at all. The starter decrypts first and compares with ===, ' +
        'which is both the padding-oracle shape and a timing oracle.',
      entry: 'open',
      starter: [
        'function open(sealed, deps) {',
        '  // Decrypt first, then check: this is the code path an oracle attack needs.',
        '  const plaintext = deps.decrypt(sealed.iv, sealed.ciphertext);',
        '  const expected = deps.mac(sealed.iv.concat(sealed.ciphertext));',
        '',
        '  for (let i = 0; i < expected.length; i += 1) {',
        '    if (expected[i] !== sealed.tag[i]) return { plaintext: null, verified: false };',
        '  }',
        '  return { plaintext: plaintext, verified: true };',
        '}'
      ].join('\n'),
      solution: [
        'function open(sealed, deps) {',
        '  const expected = deps.mac(sealed.iv.concat(sealed.ciphertext));',
        '  let diff = expected.length ^ sealed.tag.length;',
        '',
        '  for (let i = 0; i < expected.length; i += 1) {',
        '    diff |= expected[i] ^ (sealed.tag[i] === undefined ? 0 : sealed.tag[i]);',
        '  }',
        '  if (diff !== 0) return { plaintext: null, verified: false };',
        '  return { plaintext: deps.decrypt(sealed.iv, sealed.ciphertext), verified: true };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'an honest message opens and a tampered one does not',
          assert: function (open, api) {
            const mac = function (bytes) {
              const state = [11, 22, 33, 44];

              bytes.forEach(function (byte, i) {
                state[i % 4] = ((state[i % 4] * 31 + byte + i) >>> 0) % 251;
              });
              return state.slice();
            };
            const decrypt = function (iv, ciphertext) {
              return ciphertext.map(function (byte, i) { return byte ^ iv[i % iv.length]; });
            };
            const deps = { mac: mac, decrypt: decrypt };
            const iv = [4, 5, 6, 7];
            const ciphertext = [10, 20, 30, 40, 50];
            const sealed = { iv: iv, ciphertext: ciphertext, tag: mac(iv.concat(ciphertext)) };

            const good = open(sealed, deps);

            api.assert.equal(good.verified, true, 'the honest message must verify');
            api.assert.deepEqual(good.plaintext, decrypt(iv, ciphertext),
              'and it must return the plaintext');

            const edited = ciphertext.slice();

            edited[0] ^= 1;
            const bad = open({ iv: iv, ciphertext: edited, tag: sealed.tag }, deps);

            api.assert.equal(bad.verified, false, 'one flipped bit must fail the tag check');
            api.assert.equal(bad.plaintext, null, 'and must return no plaintext');
          }
        },
        {
          name: 'a bad tag never reaches the decryption code at all',
          assert: function (open, api) {
            let decryptCalls = 0;
            const mac = function (bytes) {
              let acc = 7;

              bytes.forEach(function (byte, i) { acc = (acc * 17 + byte + i) % 65521; });
              return [acc & 0xff, (acc >> 8) & 0xff];
            };
            const deps = {
              mac: mac,
              decrypt: function (iv, ciphertext) {
                decryptCalls += 1;
                return ciphertext.slice();
              }
            };
            const iv = [1, 2];
            const ciphertext = [9, 8, 7];

            open({ iv: iv, ciphertext: ciphertext, tag: [0, 0] }, deps);
            api.assert.equal(decryptCalls, 0,
              'a forged ciphertext must be rejected before anything is decrypted');

            open({ iv: iv, ciphertext: ciphertext, tag: mac(iv.concat(ciphertext)) }, deps);
            api.assert.equal(decryptCalls, 1, 'and a valid one must be decrypted exactly once');
          }
        },
        {
          name: 'the comparison reads every byte and rejects a short tag',
          assert: function (open, api) {
            const reads = [];
            const mac = function () { return [1, 2, 3, 4, 5, 6, 7, 8]; };
            const deps = { mac: mac, decrypt: function () { return []; } };
            const tag = [9, 2, 3, 4, 5, 6, 7, 8];
            const watched = [];

            tag.forEach(function (value, index) {
              Object.defineProperty(watched, index, {
                enumerable: true,
                configurable: true,
                get: function () { reads.push(index); return value; }
              });
            });
            watched.length = tag.length;

            const result = open({ iv: [], ciphertext: [], tag: watched }, deps);

            api.assert.equal(result.verified, false, 'the first byte differs, so it must fail');
            api.assert.equal(new Set(reads).size, tag.length,
              'every tag byte must be read, even though byte 0 already differs');

            const short = open({ iv: [], ciphertext: [], tag: [1, 2, 3] }, deps);

            api.assert.equal(short.verified, false, 'a short tag is a rejected tag');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));

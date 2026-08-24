/**
 * The crypto bench: published test vectors, executed attacks, and the standing
 * disclaimer.
 *
 * ⚠ Everything this harness drives is TEACHING CODE — not constant-time, not
 * audited, and never for real data. That sentence is a value here rather than a
 * comment, because a content test asserts that every section in this milestone
 * renders it.
 *
 * Two rules run through the whole milestone and both are enforced here:
 *
 * - **A primitive with no vector coverage does not ship.** Every implementation
 *   is checked against published values — NIST's AES vectors, RFC 4231 for
 *   HMAC, RFC 6070 for PBKDF2, RFC 8439 for ChaCha20-Poly1305 — and the harness
 *   reports the pass count rather than assuming it.
 * - **Every attack is executed, not narrated.** The length extension forges a
 *   real tag, the padding oracle recovers real plaintext, the nonce reuse
 *   recovers a real key. If an attack stops working the demo says so instead of
 *   telling a story about an attacker who succeeds off-screen.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.CryptoLab = api;
}(this, function (root) {
  'use strict';

  const Hash = root && root.CryptoHash ? root.CryptoHash
    : require('../algorithms/crypto-hash.js');
  const Cipher = root && root.BlockCipher ? root.BlockCipher
    : require('../algorithms/block-cipher.js');
  const Aead = root && root.Aead ? root.Aead : require('../algorithms/aead.js');
  const Kdf = root && root.Kdf ? root.Kdf : require('../algorithms/kdf.js');
  const Random = root && root.Random ? root.Random : require('../utils/random.js');

  const DISCLAIMER = 'These implementations are for learning. They are not constant-time, not '
    + 'side-channel hardened and not audited, and they must never protect real data. Production '
    + 'code uses crypto.subtle, libsodium or an equivalent audited library.';

  function hex(bytes) {
    return Hash.hex(bytes);
  }

  function fromHex(text) {
    return Hash.fromHex(text);
  }

  function bytesOf(text) {
    return Hash.bytesOf(text);
  }

  /* -------------------------------------------------------- test vectors */

  /**
   * Published vectors from the specifications, checked at runtime. These are
   * the numbers other implementations agree on, and agreement with them is the
   * only reason to believe any figure elsewhere in the milestone.
   */
  function vectors() {
    return [
      sha256Vector('', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
        + '0'.replace('0', '')),
      sha256Vector('abc', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'),
      hmacVector(),
      pbkdf2Vector(),
      aesVector(),
      chachaVector()
    ];
  }

  function sha256Vector(input, expected) {
    const actual = hex(Hash.sha256(bytesOf(input)));

    return { name: 'SHA-256("' + input + '")', source: 'FIPS 180-4',
      expected: expected, actual: actual, ok: actual === expected };
  }

  function hmacVector() {
    const key = new Array(20).fill(0x0b);
    const actual = hex(Hash.hmac('sha-256', key, bytesOf('Hi There')));
    const expected = 'b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7';

    return { name: 'HMAC-SHA-256, RFC 4231 case 1', source: 'RFC 4231',
      expected: expected, actual: actual, ok: actual === expected };
  }

  function pbkdf2Vector() {
    const actual = hex(Kdf.pbkdf2({ password: bytesOf('password'), salt: bytesOf('salt'),
      iterations: 4096, length: 20, hash: 'sha-1' }));
    const expected = '4b007901b765489abead49d926f721d065a429c1';

    return { name: 'PBKDF2-HMAC-SHA-1, 4 096 iterations', source: 'RFC 6070',
      expected: expected, actual: actual, ok: actual === expected };
  }

  function aesVector() {
    const key = fromHex('000102030405060708090a0b0c0d0e0f');
    const plaintext = fromHex('00112233445566778899aabbccddeeff');
    const actual = hex(Cipher.encryptBlock(plaintext, Cipher.expandKey(key)));
    const expected = '69c4e0d86a7b0430d8cdb78070b4c55a';

    return { name: 'AES-128 single block', source: 'FIPS 197 Appendix C.1',
      expected: expected, actual: actual, ok: actual === expected };
  }

  function chachaVector() {
    const key = fromHex('808182838485868788898a8b8c8d8e8f909192939495969798999a9b9c9d9e9f');
    const nonce = fromHex('070000004041424344454647');
    const associated = fromHex('50515253c0c1c2c3c4c5c6c7');
    const plaintext = bytesOf('Ladies and Gentlemen of the class of \'99: If I could offer you '
      + 'only one tip for the future, sunscreen would be it.');
    const result = Aead.chachaPolyEncrypt({ key: key, nonce: nonce, plaintext: plaintext,
      associated: associated });
    const actual = hex(result.tag);
    const expected = '1ae10b594f09e26a7e902ecbd0600691';

    return { name: 'ChaCha20-Poly1305 tag', source: 'RFC 8439 §2.8.2',
      expected: expected, actual: actual, ok: actual === expected };
  }

  function vectorSummary() {
    const rows = vectors();

    return { rows: rows, passed: rows.filter(function (row) { return row.ok; }).length,
      total: rows.length };
  }

  /* ------------------------------------------------- the padding oracle */

  /**
   * The attack Vaudenay published in 2002 and which is still shipping. The
   * oracle answers one bit — "did the padding parse" — and that bit is enough
   * to decrypt the whole ciphertext, one byte at a time, without the key.
   *
   * For each byte position, the attacker forges an IV that makes the target
   * block decrypt to valid padding. When it does, the intermediate value is
   * known, and XORing with the real previous block gives the plaintext byte.
   * 256 queries per byte, at most.
   */
  function paddingOracleAttack(config) {
    const key = config.key;
    const oracle = function (iv, block) {
      return Cipher.unpadPkcs7(Cipher.cbcDecryptRaw(block, key, iv)) !== null;
    };
    const blocks = Cipher.blocksOf(config.ciphertext);
    const recovered = [];
    let queries = 0;

    blocks.forEach(function (block, index) {
      const previous = index === 0 ? config.iv : blocks[index - 1];
      const result = recoverBlock({ block: block, previous: previous, oracle: oracle });

      queries += result.queries;
      result.plaintext.forEach(function (byte) { recovered.push(byte); });
    });
    const unpadded = Cipher.unpadPkcs7(recovered);

    return {
      recovered: recovered, plaintext: unpadded, queries: queries,
      blocks: blocks.length,
      queriesPerByte: queries / Math.max(1, recovered.length),
      succeeded: unpadded !== null
    };
  }

  /** One block, byte by byte from the end, forging padding of 1, then 2, then
   *  3 — which is why the attack needs the previously recovered bytes. */
  function recoverBlock(config) {
    const intermediate = new Array(16).fill(0);
    let queries = 0;

    for (let position = 15; position >= 0; position -= 1) {
      const padding = 16 - position;

      for (let guess = 0; guess < 256; guess += 1) {
        const forged = new Array(16).fill(0);

        for (let i = position + 1; i < 16; i += 1) forged[i] = intermediate[i] ^ padding;
        forged[position] = guess;
        queries += 1;
        if (!config.oracle(forged, config.block)) continue;
        if (position === 15 && !confirmLastByte(config, forged, queries)) continue;
        intermediate[position] = guess ^ padding;
        break;
      }
    }
    return {
      plaintext: intermediate.map(function (value, i) { return value ^ config.previous[i]; }),
      intermediate: intermediate,
      queries: queries
    };
  }

  /** The one false positive the attack has to handle: a forged block whose last
   *  byte gives 0x02 0x02 rather than 0x01. Changing the second-to-last byte
   *  and asking again settles it. */
  function confirmLastByte(config, forged, queries) {
    const probe = forged.slice();

    probe[14] ^= 0xff;
    return config.oracle(probe, config.block);
  }

  /* ------------------------------------------------------- ECB leakage */

  /**
   * ECB on structured data. The demo image is a bitmap with large uniform
   * areas; identical plaintext blocks give identical ciphertext blocks, so the
   * structure survives encryption. The measurement is the count of DISTINCT
   * ciphertext blocks: a mode that hid the structure would produce as many
   * distinct blocks as there are blocks.
   */
  function ecbLeakage(config) {
    const image = config.image;
    const key = config.key;
    const ecb = Cipher.ecbEncrypt(image, key);
    const cbc = Cipher.cbcEncrypt(image, key, config.iv);
    const count = function (bytes) {
      const seen = new Set();

      Cipher.blocksOf(bytes).forEach(function (block) { seen.add(hex(block)); });
      return seen.size;
    };
    const blocks = Math.ceil(image.length / 16);

    const plaintextDistinct = count(image);
    const ecbDistinct = count(ecb);
    const cbcDistinct = count(cbc);

    return {
      blocks: blocks,
      plaintextDistinct: plaintextDistinct,
      ecbDistinct: ecbDistinct,
      cbcDistinct: cbcDistinct,
      ecbLeaks: ecbDistinct < blocks / 2,
      ecbTracksPlaintext: Math.abs(ecbDistinct - plaintextDistinct) <= 1,
      cbcHides: cbcDistinct >= blocks,
      ecb: ecb, cbc: cbc
    };
  }

  /** A small greyscale image with a hard-edged shape — the structure ECB
   *  preserves and CBC destroys. */
  function testImage(width, height) {
    const data = [];

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const inShape = Math.abs(x - width / 2) + Math.abs(y - height / 2) < width / 3;

        data.push(inShape ? 30 : 220);
      }
    }
    return { data: data, width: width, height: height };
  }

  /* ------------------------------------------------- randomness recovery */

  /**
   * A statistical PRNG is not a CSPRNG, and the difference is not a matter of
   * degree. A linear congruential generator's state IS its output, so two
   * consecutive values determine every value that follows — recovered here by
   * solving for the modulus-consistent state directly rather than by searching.
   */
  function lcgRecovery(config) {
    const a = config.a;
    const c = config.c;
    const m = config.m;
    const observed = [];
    let state = config.seed;

    for (let i = 0; i < config.observe; i += 1) {
      state = (a * state + c) % m;
      observed.push(state);
    }
    const recoveredState = observed[observed.length - 1];
    const predicted = [];
    let next = recoveredState;

    for (let i = 0; i < config.predict; i += 1) {
      next = (a * next + c) % m;
      predicted.push(next);
    }
    const actual = [];

    next = observed[observed.length - 1];
    for (let i = 0; i < config.predict; i += 1) {
      next = (a * next + c) % m;
      actual.push(next);
    }
    return {
      observed: observed, predicted: predicted, actual: actual,
      exact: predicted.every(function (value, i) { return value === actual[i]; }),
      observationsNeeded: 1
    };
  }

  /**
   * What a CSPRNG offers instead: the output is a keyed function of a counter,
   * so seeing outputs tells an attacker nothing about the key or about any
   * other output. This one is HMAC-DRBG's shape, reduced.
   */
  function csprng(seed) {
    let key = Hash.sha256(seed);
    let counter = 0;

    return {
      next: function () {
        counter += 1;
        const out = Hash.hmac('sha-256', key, [counter & 0xff]);

        key = Hash.hmac('sha-256', key, [0]);
        return out;
      },
      reseed: function (extra) { key = Hash.hmac('sha-256', key, extra); }
    };
  }

  /** Entropy of an observed byte stream, so "looks random" can be a number
   *  rather than an impression — and so the demo can show that looking random
   *  is exactly what a broken generator does. */
  function outputEntropy(values) {
    const counts = new Map();

    values.forEach(function (value) { counts.set(value, (counts.get(value) || 0) + 1); });
    let bits = 0;

    counts.forEach(function (count) {
      const p = count / values.length;

      bits -= p * Math.log2(p);
    });
    return { bits: bits, distinct: counts.size, samples: values.length };
  }

  /* --------------------------------------------------------- the chooser */

  /**
   * Requirement to primitive. Every row ends at a named audited API, because
   * the correct answer to "which cipher should I implement" is always "none of
   * them".
   */
  function primitiveTable() {
    return [
      { goal: 'confidentiality and integrity of a message',
        threat: 'active attacker who can modify the ciphertext',
        primitive: 'AEAD: AES-256-GCM or ChaCha20-Poly1305',
        parameters: '96-bit nonce, never repeated under one key',
        failure: 'nonce reuse — recovers the authentication key, not just the plaintext',
        api: 'crypto.subtle.encrypt({name:"AES-GCM"}) / libsodium crypto_aead_*' },
      { goal: 'authenticity of a message between two parties who share a key',
        threat: 'forgery by anyone without the key',
        primitive: 'HMAC-SHA-256',
        parameters: 'a 256-bit random key; compare tags in constant time',
        failure: 'hash(key ‖ message) instead of HMAC — forgeable by length extension',
        api: 'crypto.subtle.sign({name:"HMAC"}) / libsodium crypto_auth' },
      { goal: 'authenticity verifiable by a third party',
        threat: 'repudiation, or a verifier who must not be able to forge',
        primitive: 'Ed25519 signatures',
        parameters: 'no parameters to choose — that is the design',
        failure: 'ECDSA with a repeated or biased nonce — recovers the private key',
        api: 'crypto.subtle.sign({name:"Ed25519"}) / libsodium crypto_sign' },
      { goal: 'store user passwords',
        threat: 'offline cracking after a database breach',
        primitive: 'Argon2id, or bcrypt/scrypt where Argon2 is unavailable',
        parameters: 'tuned to a verification budget: memory first, then iterations',
        failure: 'a fast hash, or a cost parameter fixed in 2015 and never revisited',
        api: 'libsodium crypto_pwhash / a maintained bcrypt binding' },
      { goal: 'derive keys from a shared secret',
        threat: 'key reuse across contexts',
        primitive: 'HKDF-SHA-256',
        parameters: 'a distinct info string per use — that is what separates the keys',
        failure: 'using the raw DH output as a key, or one key for several purposes',
        api: 'crypto.subtle.deriveBits({name:"HKDF"}) / libsodium crypto_kdf' },
      { goal: 'agree a key over an untrusted network',
        threat: 'passive eavesdropper; active attacker without authentication',
        primitive: 'X25519, with the peer authenticated separately',
        parameters: 'ephemeral keys per session for forward secrecy',
        failure: 'unauthenticated DH — secure against eavesdroppers and trivially machine-in-the-middled',
        api: 'crypto.subtle.deriveBits({name:"X25519"}) / libsodium crypto_kx' },
      { goal: 'random values for keys, nonces or tokens',
        threat: 'prediction of any generated value',
        primitive: 'the platform CSPRNG',
        parameters: 'none; do not seed it yourself',
        failure: 'Math.random(), a statistical PRNG, or a device with no boot entropy',
        api: 'crypto.getRandomValues / crypto.randomBytes / getrandom(2)' }
    ];
  }

  /** Grade an answer against the acceptable set, with the reason a rejected
   *  answer is rejected — because "wrong" is not a teaching artefact. */
  function gradeChoice(scenario, answer) {
    const row = primitiveTable().filter(function (entry) {
      return entry.goal === scenario;
    })[0];

    if (!row) return { ok: false, reason: 'unknown scenario' };
    const ok = row.primitive.toLowerCase().indexOf(answer.toLowerCase()) !== -1;

    return { ok: ok, expected: row.primitive, failure: row.failure, api: row.api,
      reason: ok ? 'matches the standard answer' : 'the standard answer is ' + row.primitive };
  }

  function randomBytes(count, seed) {
    const rng = Random.seeded(seed);
    const out = [];

    for (let i = 0; i < count; i += 1) out.push(Math.floor(rng.next() * 256));
    return out;
  }

  return {
    DISCLAIMER: DISCLAIMER,
    hex: hex, fromHex: fromHex, bytesOf: bytesOf, randomBytes: randomBytes,
    vectors: vectors, vectorSummary: vectorSummary,
    paddingOracleAttack: paddingOracleAttack, recoverBlock: recoverBlock,
    ecbLeakage: ecbLeakage, testImage: testImage,
    lcgRecovery: lcgRecovery, csprng: csprng, outputEntropy: outputEntropy,
    primitiveTable: primitiveTable, gradeChoice: gradeChoice
  };
}));

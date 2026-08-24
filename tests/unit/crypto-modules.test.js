'use strict';

/**
 * Property tests for the M23 primitives.
 *
 * The rule that matters here is that a cryptographic implementation which is
 * subtly wrong produces stable, well-distributed, completely wrong output, so
 * nothing about the output detects the bug. Every primitive below is therefore
 * checked against a published vector or against node's own crypto — somebody
 * else's answer — before any property is asserted about it.
 */

const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');

const Hash = require('../../src/js/algorithms/crypto-hash.js');
const Cipher = require('../../src/js/algorithms/block-cipher.js');
const Aead = require('../../src/js/algorithms/aead.js');
const Kdf = require('../../src/js/algorithms/kdf.js');
const Lab = require('../../src/js/machines/crypto-lab.js');

function bytes(text) { return Hash.bytesOf(text); }

/* ------------------------------------------------------- published vectors */

test('crypto-hash: SHA-256 and SHA-1 agree with node', function () {
  ['', 'abc', 'the quick brown fox jumps over the lazy dog',
    'a'.repeat(200)].forEach(function (input) {
    assert.strictEqual(Hash.hex(Hash.sha256(bytes(input))),
      crypto.createHash('sha256').update(input).digest('hex'), 'sha256("' + input.slice(0, 12) + '")');
    assert.strictEqual(Hash.hex(Hash.sha1(bytes(input))),
      crypto.createHash('sha1').update(input).digest('hex'), 'sha1("' + input.slice(0, 12) + '")');
  });
});

test('crypto-hash: HMAC agrees with node at several key lengths', function () {
  [4, 32, 64, 100].forEach(function (keyLength) {
    const key = 'k'.repeat(keyLength);

    assert.strictEqual(Hash.hex(Hash.hmac('sha-256', bytes(key), bytes('message'))),
      crypto.createHmac('sha256', key).update('message').digest('hex'),
      'HMAC-SHA-256 with a ' + keyLength + '-byte key');
  });
});

test('crypto-lab: every published vector in the milestone passes', function () {
  const summary = Lab.vectorSummary();

  assert.ok(summary.total >= 6, 'expected at least six vectors, found ' + summary.total);
  assert.strictEqual(summary.passed, summary.total,
    summary.rows.filter(function (row) { return !row.ok; })
      .map(function (row) { return row.name; }).join(', ') + ' disagree with their sources');
});

test('block-cipher: AES matches node at all three key sizes', function () {
  [16, 24, 32].forEach(function (keyLength) {
    const key = Buffer.from('K'.repeat(keyLength));
    const block = Buffer.from('0123456789abcdef');
    const cipher = crypto.createCipheriv('aes-' + keyLength * 8 + '-ecb', key, null);

    cipher.setAutoPadding(false);
    const expected = Buffer.concat([cipher.update(block), cipher.final()]).toString('hex');

    const schedule = Cipher.expandKey(Array.from(key));

    assert.strictEqual(Hash.hex(Cipher.encryptBlock(Array.from(block), schedule)), expected,
      'AES-' + keyLength * 8 + ' single block');
    assert.deepStrictEqual(
      Cipher.decryptBlock(Cipher.encryptBlock(Array.from(block), schedule), schedule),
      Array.from(block), 'and decryption must invert it');
  });
});

test('block-cipher: CBC and CTR match node, and both round-trip', function () {
  const key = Array.from(Buffer.from('0123456789abcdef'));
  const iv = Array.from(Buffer.from('fedcba9876543210'));
  const plaintext = Array.from(Buffer.from('a message of exactly forty-eight bytes, padded..'));

  const cbc = Cipher.cbcEncrypt(plaintext, key, iv);
  const node = crypto.createCipheriv('aes-128-cbc', Buffer.from(key), Buffer.from(iv));

  assert.strictEqual(Hash.hex(cbc),
    Buffer.concat([node.update(Buffer.from(plaintext)), node.final()]).toString('hex'),
    'CBC including PKCS#7 padding');
  assert.deepStrictEqual(Cipher.cbcDecrypt(cbc, key, iv), plaintext, 'CBC round-trips');

  const nonce = Array.from(Buffer.from('a-nonce-here'));
  const ctr = Cipher.ctr(plaintext, key, nonce);

  assert.strictEqual(ctr.length, plaintext.length, 'CTR adds no padding');
  assert.deepStrictEqual(Cipher.ctr(ctr, key, nonce), plaintext, 'CTR is its own inverse');
});

/* ------------------------------------------------------------- properties */

test('crypto-hash: length extension forges the naive MAC at every secret length', function () {
  const original = bytes('user=bob&role=guest');
  const suffix = bytes('&role=admin');

  [1, 8, 16, 32, 55, 56, 64, 100].forEach(function (secretLength) {
    const secret = bytes('S'.repeat(secretLength));
    const forged = Hash.lengthExtend({ secretLength: secretLength, original: original,
      suffix: suffix, tag: Hash.naiveMac(secret, original) });

    assert.strictEqual(Hash.hex(Hash.naiveMac(secret, forged.message)), Hash.hex(forged.tag),
      'the forgery must be accepted at secret length ' + secretLength);
    assert.strictEqual((secretLength + original.length + forged.glueLength) % 64, 0,
      'the glue must pad the message to a whole number of blocks');
  });
});

test('crypto-hash: the same attack never forges an HMAC tag', function () {
  const original = bytes('user=bob&role=guest');
  const suffix = bytes('&role=admin');

  [8, 16, 32].forEach(function (secretLength) {
    const secret = bytes('S'.repeat(secretLength));
    const forged = Hash.lengthExtend({ secretLength: secretLength, original: original,
      suffix: suffix, tag: Hash.hmacMac(secret, original) });

    assert.notStrictEqual(Hash.hex(Hash.hmacMac(secret, forged.message)), Hash.hex(forged.tag),
      'HMAC must reject the extension at secret length ' + secretLength);
  });
});

test('crypto-hash: the birthday bound is the square root of the space', function () {
  [64, 128, 160, 256].forEach(function (bits) {
    const half = Hash.birthday(bits, 0).halfAt;
    const root = Math.sqrt(Math.pow(2, bits));

    assert.ok(half > root && half < root * 1.3,
      bits + '-bit: expected about the square root of the space, got ' + half);
  });
  assert.ok(Hash.birthday(96, Math.pow(2, 48)).probability > 0.3,
    'a 96-bit nonce collides with real probability at 2^48 messages');
  assert.ok(Hash.birthday(96, Math.pow(2, 32)).probability < 1e-9,
    'and with negligible probability at 2^32');
});

test('crypto-lab: the padding oracle recovers the whole message', function () {
  const key = bytes('0123456789abcdef');
  const iv = bytes('fedcba9876543210');

  ['short', 'transfer 100 to alice; auth=ok',
    'a longer message that spans several blocks of the cipher'].forEach(function (message) {
    const attack = Lab.paddingOracleAttack({ key: key, iv: iv,
      ciphertext: Cipher.cbcEncrypt(bytes(message), key, iv) });

    assert.strictEqual(attack.succeeded, true, 'the attack must succeed on "' + message + '"');
    assert.deepStrictEqual(attack.plaintext, bytes(message), 'and recover it exactly');
    assert.ok(attack.queriesPerByte <= 256,
      'no byte may cost more than the 256 values it could take');
  });
});

test('crypto-lab: ECB preserves the picture and CBC does not', function () {
  const image = Lab.testImage(48, 48);
  const leak = Lab.ecbLeakage({ image: image.data, key: bytes('0123456789abcdef'),
    iv: bytes('fedcba9876543210') });

  assert.strictEqual(leak.blocks, 144, '48 × 48 bytes is 144 blocks of 16');
  assert.strictEqual(leak.ecbTracksPlaintext, true,
    'ECB must have about as many distinct blocks as the plaintext did');
  assert.strictEqual(leak.ecbLeaks, true, 'which is the leak');
  assert.strictEqual(leak.cbcHides, true, 'and CBC must give one distinct block per position');
});

test('aead: GCM and ChaCha20-Poly1305 reject every tampering', function () {
  const key = bytes('0123456789abcdef');
  const nonce = bytes('a-unique-once');
  const sealed = Aead.gcmEncrypt({ key: key, nonce: nonce, plaintext: bytes('balance=1000'),
    associated: bytes('to=alice') });

  assert.strictEqual(Aead.gcmDecrypt({ key: key, nonce: nonce, ciphertext: sealed.ciphertext,
    tag: sealed.tag, associated: bytes('to=alice') }).verified, true, 'the honest message opens');

  const flipped = sealed.ciphertext.slice();

  flipped[0] ^= 1;
  assert.strictEqual(Aead.gcmDecrypt({ key: key, nonce: nonce, ciphertext: flipped,
    tag: sealed.tag, associated: bytes('to=alice') }).verified, false, 'a flipped bit is rejected');
  assert.strictEqual(Aead.gcmDecrypt({ key: key, nonce: nonce, ciphertext: sealed.ciphertext,
    tag: sealed.tag, associated: bytes('to=mallory') }).verified, false,
  'associated data is authenticated even though it is not encrypted');
  assert.strictEqual(Aead.gcmDecrypt({ key: key, nonce: nonce, ciphertext: sealed.ciphertext,
    tag: sealed.tag.slice(0, 15), associated: bytes('to=alice') }).verified, false,
  'a truncated tag is a rejected tag');
});

test('aead: nonce reuse publishes the second plaintext and then the tag mask', function () {
  const key = bytes('0123456789abcdef');
  const nonce = bytes('reused-nonce');
  const first = bytes('attack at dawn!');
  const second = bytes('retreat by dusk');
  const run = Aead.nonceReuse({ key: key, nonce: nonce, first: first, second: second });

  assert.strictEqual(run.keystreamIdentical, true,
    'the ciphertexts must XOR to the plaintexts XOR');
  assert.deepStrictEqual(run.recovered, second, 'so one known plaintext yields the other');

  const known = run.first;
  const mask = Aead.xorBytes(known.tag, Aead.ghash(run.authKey, [], known.ciphertext));
  const edited = known.ciphertext.slice();

  edited[0] ^= 0x20;
  const forged = Aead.xorBytes(Aead.ghash(run.authKey, [], edited), mask);

  assert.strictEqual(Aead.gcmDecrypt({ key: key, nonce: nonce, ciphertext: edited,
    tag: forged, associated: [] }).verified, true,
  'and GHASH being linear turns the eavesdropper into a forger');
});

test('aead: encrypt-then-MAC rejects before it decrypts', function () {
  const encKey = bytes('0123456789abcdef');
  const macKey = bytes('a different key!');
  const iv = bytes('fedcba9876543210');
  const sealed = Aead.encryptThenMac({ plaintext: bytes('hello world'), encKey: encKey,
    macKey: macKey, iv: iv });
  const opened = Aead.verifyThenDecrypt({ ciphertext: sealed.ciphertext, tag: sealed.tag,
    encKey: encKey, macKey: macKey, iv: iv });

  assert.strictEqual(opened.verified, true, 'the honest message opens');
  assert.deepStrictEqual(opened.plaintext, bytes('hello world'), 'and returns the plaintext');

  const edited = sealed.ciphertext.slice();

  edited[0] ^= 1;
  const refused = Aead.verifyThenDecrypt({ ciphertext: edited, tag: sealed.tag, encKey: encKey,
    macKey: macKey, iv: iv });

  assert.strictEqual(refused.verified, false, 'and a tampered one does not');
  assert.strictEqual(refused.plaintext, null, 'with no plaintext produced at all');
});

test('aead: the constant-time comparison agrees with the naive one on every input', function () {
  const cases = [[[1, 2, 3], [1, 2, 3]], [[1, 2, 3], [1, 2, 4]], [[1, 2, 3], [9, 2, 3]],
    [[1, 2, 3], [1, 2]], [[], []]];

  cases.forEach(function (pair) {
    assert.strictEqual(Aead.constantTimeEquals(pair[0], pair[1]),
      Aead.naiveEquals(pair[0], pair[1]),
      'the two comparisons must agree on ' + JSON.stringify(pair));
  });
});

test('kdf: PBKDF2 agrees with node, and salts separate equal passwords', function () {
  const derived = Kdf.pbkdf2({ password: bytes('password'), salt: bytes('salt'),
    iterations: 1000, length: 20, hash: 'sha-1' });

  assert.strictEqual(Hash.hex(derived),
    crypto.pbkdf2Sync('password', 'salt', 1000, 20, 'sha1').toString('hex'),
    'PBKDF2-HMAC-SHA-1 must match node');

  const effect = Kdf.saltEffect({ password: bytes('correct horse battery staple'),
    saltA: bytes('salt-for-user-a'), saltB: bytes('salt-for-user-b'), iterations: 200 });

  assert.strictEqual(effect.identicalHash, false,
    'the same password under two salts must give different keys');
});

test('kdf: memory binds only past a threshold, and then halves the attacker per doubling', function () {
  const at = function (memoryKb) {
    return Kdf.crackingCost({ verifyMs: 250, memoryKb: memoryKb });
  };

  assert.strictEqual(at(0).memoryLimited, false, 'no memory cost cannot bind');
  assert.strictEqual(at(4).memoryLimited, false, 'bcrypt’s 4 KiB does not bind a 16 GiB rig');
  assert.strictEqual(at(4096).memoryLimited, false, '4 MiB gives exactly the core count');
  assert.strictEqual(at(65536).memoryLimited, true, '64 MiB binds');
  assert.strictEqual(at(4096).guessesPerSecond / at(524288).guessesPerSecond, 128,
    'the sweep from 4 MiB to 512 MiB divides the attacker by 128');
  assert.ok(at(0.002 * 0 + 0).guessesPerSecond > 0, 'the rate is always positive');
});

test('kdf: verification detects a stale cost parameter', function () {
  const password = bytes('correct horse battery staple');
  const record = Kdf.register({ password: password, salt: bytes('an-old-salt'),
    iterations: 1000 });
  const good = Kdf.verifyPassword(record, password, 30000);

  assert.strictEqual(good.ok, true, 'the right password verifies');
  assert.strictEqual(good.needsRehash, true, 'and the stale parameters are flagged');

  const wrong = Kdf.verifyPassword(record, bytes('not the password'), 30000);

  assert.strictEqual(wrong.ok, false, 'the wrong password does not verify');
  assert.strictEqual(wrong.needsRehash, false, 'and a failed login never triggers a rehash');
});

test('crypto-lab: the LCG is predicted exactly and the CSPRNG is not', function () {
  const run = Lab.lcgRecovery({ a: 1103515245, c: 12345, m: 2147483648, seed: 42,
    observe: 2, predict: 8 });

  assert.strictEqual(run.exact, true, 'every prediction must match');
  assert.strictEqual(run.observationsNeeded, 1, 'the state IS the output');

  const stream = Lab.lcgRecovery({ a: 1103515245, c: 12345, m: 2147483648, seed: 42,
    observe: 4000, predict: 1 });
  const high = Lab.outputEntropy(stream.observed.map(function (value) {
    return Math.floor(value / 8388608) % 256;
  }));
  const low = Lab.outputEntropy(stream.observed.map(function (value) { return value % 256; }));

  assert.ok(high.bits > 7.9, 'the high byte looks like excellent randomness');
  assert.ok(low.bits < 2, 'the low byte does not, and both are equally predictable');

  const generator = Lab.csprng(bytes('an entropy-pool seed'));
  const seen = new Set();

  for (let i = 0; i < 20; i += 1) seen.add(Hash.hex(generator.next()));
  assert.strictEqual(seen.size, 20, 'a keyed generator repeats nothing over 20 outputs');
});

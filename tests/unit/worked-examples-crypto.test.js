'use strict';

/**
 * Every figure the M23.1-M23.6 content quotes, recomputed from the modules and
 * then checked against the prose.
 *
 * The section controllers are not imported; the calls below reproduce what they
 * make at their default control settings, which is the contract this suite is
 * really pinning down — if a default moves, the prose is wrong and this fails.
 */

const test = require('node:test');
const assert = require('node:assert');

const Hash = require('../../src/js/algorithms/crypto-hash.js');
const Cipher = require('../../src/js/algorithms/block-cipher.js');
const Aead = require('../../src/js/algorithms/aead.js');
const Kdf = require('../../src/js/algorithms/kdf.js');
const Pk = require('../../src/js/algorithms/public-key.js');
const Lab = require('../../src/js/machines/crypto-lab.js');

require('../../src/js/content/concepts-crypto-basics.js');
require('../../src/js/content/examples-crypto-basics.js');
require('../../src/js/content/concepts-crypto-symmetric.js');
require('../../src/js/content/examples-crypto-symmetric.js');
const prose = require('../support/worked-example-prose.js');

function bytes(text) { return Hash.bytesOf(text); }

/* -------------------------------------------------- 23.1 threat models */

test('threat-models-and-primitives: the vector count and the key-size table', function () {
  const summary = Lab.vectorSummary();

  assert.strictEqual(summary.passed, summary.total, 'every vector must pass');
  assert.strictEqual(summary.total, 6, 'six vectors ship in this milestone');
  prose.quotes('threat-models-and-primitives', ['6 of 6', '6 vectors']);

  const levels = Pk.keySizeTable();
  const at128 = levels.filter(function (row) { return row.bits === 128; })[0];
  const at192 = levels.filter(function (row) { return row.bits === 192; })[0];

  assert.strictEqual(at128.rsa, 3072);
  assert.strictEqual(at128.ecc, 256);
  assert.strictEqual(at128.rsa / at128.ecc, 12);
  assert.strictEqual(at192.rsa / at192.ecc, 20);
  prose.quotes('threat-models-and-primitives',
    ['3 072', '256-bit curve', 'a factor of 12', 'a factor of 20']);
});

test('threat-models-and-primitives: the nonce arithmetic the second example uses', function () {
  const at48 = Hash.birthday(96, Math.pow(2, 48)).probability;
  const at32 = Hash.birthday(96, Math.pow(2, 32)).probability;

  assert.strictEqual(at48.toExponential(3), '3.935e-1');
  assert.strictEqual(at32.toExponential(3), '1.164e-10');
  assert.strictEqual(prose.fixed(at48 * 100, 2), '39.35');
  prose.quotes('threat-models-and-primitives',
    ['3.935 × 10^-1', '1.164 × 10^-10', '39.35%', '2^-32']);

  const table = Lab.primitiveTable();

  assert.strictEqual(table.length, 7, 'seven requirement rows');
  prose.quotes('threat-models-and-primitives', ['7 requirement', '7 rows']);
});

/* ----------------------------------------------------- 23.2 randomness */

test('randomness-for-cryptography: one observation predicts eight values exactly', function () {
  const run = Lab.lcgRecovery({ a: 1103515245, c: 12345, m: 2147483648, seed: 42,
    observe: 2, predict: 8 });

  assert.strictEqual(run.exact, true);
  assert.strictEqual(run.observationsNeeded, 1);
  assert.strictEqual(run.predicted.length, 8);
  assert.strictEqual(prose.grouped(run.predicted[0]), '1 964 818 176');
  assert.strictEqual(prose.grouped(run.predicted[1]), '1 500 480 256');
  assert.strictEqual(prose.grouped(run.predicted[2]), '1 617 229 568');
  prose.quotes('randomness-for-cryptography',
    ['1 964 818 176', '1 500 480 256', '1 617 229 568', '8 predicted, 8 matched',
      '1 103 515 245', '2 147 483 648']);
});

test('randomness-for-cryptography: the entropy of the same stream, both bytes', function () {
  const stream = Lab.lcgRecovery({ a: 1103515245, c: 12345, m: 2147483648, seed: 42,
    observe: 4000, predict: 1 });
  const high = Lab.outputEntropy(stream.observed.map(function (value) {
    return Math.floor(value / 8388608) % 256;
  }));
  const low = Lab.outputEntropy(stream.observed.map(function (value) { return value % 256; }));

  assert.strictEqual(prose.fixed(high.bits, 4), '7.9553');
  assert.strictEqual(high.distinct, 256);
  assert.strictEqual(high.samples, 4000);
  assert.strictEqual(prose.fixed(low.bits, 4), '1.2946');
  assert.strictEqual(low.distinct, 17);
  prose.quotes('randomness-for-cryptography',
    ['7.9553', '1.2946', '17 distinct values', '256 distinct values', '4 000 samples']);
});

/* ------------------------------------------------------- 23.3 hashing */

test('hash-functions-and-macs: the forgery, its glue and the HMAC rejection', function () {
  const secret = bytes('S'.repeat(16));
  const original = bytes('user=bob&role=guest');
  const suffix = bytes('&role=admin');
  const forged = Hash.lengthExtend({ secretLength: secret.length, original: original,
    suffix: suffix, tag: Hash.naiveMac(secret, original) });

  assert.strictEqual(original.length, 19, 'the demo message is 19 bytes');
  assert.strictEqual(secret.length + original.length, 35, 'so the hashed prefix is 35');
  assert.strictEqual(forged.glueLength, 29, 'which pads to 64 with 29 glue bytes');
  assert.strictEqual(Hash.hex(Hash.naiveMac(secret, forged.message)), Hash.hex(forged.tag),
    'and the forged tag is accepted');

  const keyed = Hash.lengthExtend({ secretLength: secret.length, original: original,
    suffix: suffix, tag: Hash.hmacMac(secret, original) });

  assert.notStrictEqual(Hash.hex(Hash.hmacMac(secret, keyed.message)), Hash.hex(keyed.tag),
    'while HMAC rejects it');
  prose.quotes('hash-functions-and-macs',
    ['16 bytes', '19-byte', '16 + 19 = 35', '29 glue bytes', 'forged tag accepted: no']);
});

test('hash-functions-and-macs: the birthday bound at four digest sizes', function () {
  const at = function (bits) { return Hash.birthday(bits, 0).halfAt.toExponential(4); };

  assert.strictEqual(at(64), '5.0569e+9');
  assert.strictEqual(at(128), '2.1719e+19');
  assert.strictEqual(at(160), '1.4234e+24');
  assert.strictEqual(at(256), '4.0065e+38');
  prose.quotes('hash-functions-and-macs',
    ['5.0569 × 10⁹', '2.1719 × 10¹⁹', '1.4234 × 10²⁴', '4.0065 × 10³⁸']);
  prose.quotes('hash-functions-and-macs', ['4.0065 × 10^38', '2.1719 × 10^19', '1.4234 × 10^24']);
});

/* ------------------------------------------------ 23.4 password hashing */

test('password-hashing: six schemes at one budget', function () {
  const at = function (verifyMs, memoryKb) {
    return Kdf.crackingCost({ verifyMs: verifyMs, memoryKb: memoryKb });
  };
  const sha = at(0.002, 0);
  const pbkdf2 = at(250, 0);
  const bcrypt = at(250, 4);
  const scrypt = at(250, 32768);
  const argon = at(250, 65536);

  assert.strictEqual(sha.guessesPerSecond.toExponential(3), '4.096e+10');
  assert.strictEqual(prose.fixed(sha.daysForEightChars, 2), '0.06');
  assert.strictEqual(pbkdf2.guessesPerSecond.toExponential(3), '3.277e+5');
  assert.strictEqual(prose.fixed(pbkdf2.daysForEightChars, 2), '7712.05');
  assert.strictEqual(bcrypt.memoryLimited, false, 'bcrypt’s 4 KiB does not bind');
  assert.strictEqual(scrypt.effectiveCores, 512);
  assert.strictEqual(argon.effectiveCores, 256);
  assert.strictEqual(argon.guessesPerSecond.toExponential(3), '2.048e+4');
  assert.strictEqual(prose.fixed(argon.daysForEightChars, 2), '123392.80');
  assert.strictEqual((sha.guessesPerSecond / argon.guessesPerSecond).toExponential(3), '2.000e+6');

  prose.quotes('password-hashing',
    ['4.096 × 10^10', '3.277 × 10^5', '2.048 × 10^4', '0.06 days', '7 712.05',
      '123 392.80', '2 000 000', '256 instances']);
  prose.quotes('password-hashing', ['62^8 = 2.183 × 10^14']);
  assert.strictEqual(Math.pow(62, 8).toExponential(3), '2.183e+14');
});

test('password-hashing: the memory sweep divides the attacker by 128', function () {
  const at = function (mib) {
    return Kdf.crackingCost({ verifyMs: 250, memoryKb: mib * 1024 });
  };

  assert.strictEqual(at(4).effectiveCores, 4096, '4 MiB gives exactly the core count');
  assert.strictEqual(at(4).memoryLimited, false, 'so cores still bind');
  assert.strictEqual(at(64).effectiveCores, 256);
  assert.strictEqual(at(512).effectiveCores, 32);
  assert.strictEqual(at(4).guessesPerSecond / at(512).guessesPerSecond, 128);
  assert.strictEqual(at(512).guessesPerSecond.toExponential(3), '2.560e+3');
  prose.quotes('password-hashing',
    ['4 096 instances', '32 instances', '2.560 × 10^3', '128×']);
});

/* --------------------------------------------- 23.5 symmetric encryption */

test('symmetric-encryption: the ECB picture and the padding oracle', function () {
  const key = bytes('0123456789abcdef');
  const iv = bytes('fedcba9876543210');
  const image = Lab.testImage(48, 48);
  const leak = Lab.ecbLeakage({ image: image.data, key: key, iv: iv });

  assert.strictEqual(leak.blocks, 144);
  assert.strictEqual(leak.plaintextDistinct, 25);
  assert.strictEqual(leak.ecbDistinct, 26);
  assert.strictEqual(leak.cbcDistinct, 145);
  prose.quotes('symmetric-encryption', ['144', '25 distinct', '26 distinct', '145']);

  const message = 'transfer 100 to alice; auth=ok';
  const attack = Lab.paddingOracleAttack({ key: key, iv: iv,
    ciphertext: Cipher.cbcEncrypt(bytes(message), key, iv) });

  assert.strictEqual(message.length, 30);
  assert.strictEqual(attack.blocks, 2);
  assert.strictEqual(attack.queries, 2749);
  assert.strictEqual(prose.fixed(attack.queriesPerByte, 1), '85.9');
  assert.strictEqual(Math.round(attack.queries / attack.blocks), 1375);
  prose.quotes('symmetric-encryption',
    ['2 749', '85.9', '1 375', '30 of 30', '2 blocks of 16']);
});

test('symmetric-encryption: five edited bytes rewrite a CTR plaintext', function () {
  const key = bytes('0123456789abcdef');
  const nonce = bytes('one-shot-nonce');
  const original = 'user=bob;role=guest';
  const target = 'user=bob;role=admin';
  const ciphertext = Cipher.ctr(bytes(original), key, nonce);
  const edited = ciphertext.slice();

  for (let i = 0; i < original.length; i += 1) {
    edited[i] ^= original.charCodeAt(i) ^ target.charCodeAt(i);
  }
  const delivered = Cipher.ctr(edited, key, nonce).map(function (byte) {
    return String.fromCharCode(byte);
  }).join('');
  const changed = edited.filter(function (byte, i) { return byte !== ciphertext[i]; }).length;

  assert.strictEqual(delivered, target, 'the recipient reads the attacker’s sentence');
  assert.strictEqual(changed, 5, 'from five edited bytes');
  assert.strictEqual(original.length, 19);
  prose.quotes('symmetric-encryption',
    ['5 ciphertext bytes changed out of 19', 'user=bob;role=admin', '0 oracle queries']);
});

/* ----------------------------------------- 23.6 authenticated encryption */

test('authenticated-encryption: the nonce repeat and the forgery that follows', function () {
  const key = bytes('0123456789abcdef');
  const nonce = bytes('reused-nonce');
  const first = 'attack at dawn!';
  const second = 'retreat by dusk';
  const run = Aead.nonceReuse({ key: key, nonce: nonce, first: bytes(first),
    second: bytes(second) });

  assert.strictEqual(first.length, 15);
  assert.strictEqual(second.length, 15);
  assert.strictEqual(run.keystreamIdentical, true);
  assert.strictEqual(run.recoveredMatches, true);

  const known = run.first;
  const mask = Aead.xorBytes(known.tag, Aead.ghash(run.authKey, [], known.ciphertext));
  const edited = known.ciphertext.slice();

  edited[0] ^= 0x20;
  edited[1] ^= 0x20;
  const forged = Aead.xorBytes(Aead.ghash(run.authKey, [], edited), mask);

  assert.strictEqual(Aead.gcmDecrypt({ key: key, nonce: nonce, ciphertext: edited, tag: forged,
    associated: [] }).verified, true, 'the receiver accepts a tag the sender never produced');
  prose.quotes('authenticated-encryption', ['15 of 15', '15-byte']);
});

test('authenticated-encryption: the birthday ceiling on a 96-bit nonce', function () {
  const at = function (exponent) {
    return Hash.birthday(96, Math.pow(2, exponent)).probability.toExponential(3);
  };

  assert.strictEqual(at(32), '1.164e-10');
  assert.strictEqual(at(40), '7.629e-6');
  assert.strictEqual(at(48), '3.935e-1');
  prose.quotes('authenticated-encryption',
    ['1.164 × 10^-10', '7.629 × 10^-6', '3.935 × 10^-1', '2^-32']);
  prose.quotes('authenticated-encryption', ['1.164 × 10⁻¹⁰', '3.935 × 10⁻¹']);
});

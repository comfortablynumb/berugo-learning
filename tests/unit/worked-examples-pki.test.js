'use strict';

/**
 * Every figure the M23.7-M23.11 content quotes, recomputed from the modules and
 * then checked against the prose.
 *
 * The section controllers are not imported; the calls below reproduce what they
 * make at their default control settings, which is the contract this suite is
 * really pinning down — if a default moves, the prose is wrong and this fails.
 */

const test = require('node:test');
const assert = require('node:assert');

const Pk = require('../../src/js/algorithms/public-key.js');
const Signatures = require('../../src/js/algorithms/signatures.js');
const Ratchet = require('../../src/js/algorithms/ratchet.js');
const ConstantTime = require('../../src/js/algorithms/constant-time.js');
const Threshold = require('../../src/js/algorithms/threshold.js');
const Hash = require('../../src/js/algorithms/crypto-hash.js');
const Random = require('../../src/js/utils/random.js');

require('../../src/js/content/concepts-crypto-public.js');
require('../../src/js/content/examples-crypto-public.js');
require('../../src/js/content/concepts-crypto-applied.js');
require('../../src/js/content/examples-crypto-applied.js');
const prose = require('../support/worked-example-prose.js');

/* ------------------------------------------------------- 23.7 public key */

test('public-key-cryptography: the eavesdropper at four moduli', function () {
  const at = function (modulus) {
    const p = BigInt(modulus);
    const exchange = Pk.diffieHellman({ p: p, g: 5n, a: (p * 61n) / 100n, b: (p * 37n) / 100n });

    return { bits: p.toString(2).length, exchange: exchange,
      log: Pk.discreteLog(exchange.alicePublic, 5n, p, 2000000) };
  };
  const small = at('7919');
  const mid = at('104729');
  const large = at('1299709');
  const huge = at('2147483647');

  assert.strictEqual(small.bits, 13);
  assert.strictEqual(small.log.steps, 872);
  assert.strictEqual(mid.bits, 17);
  assert.strictEqual(mid.log.steps, 11521);
  assert.strictEqual(large.bits, 21);
  assert.strictEqual(large.log.steps, 142969);
  assert.strictEqual(huge.bits, 31);
  assert.strictEqual(huge.log.found, false);
  assert.strictEqual(mid.exchange.aliceShared, 42864n, 'the demo default shared secret');

  prose.quotes('public-key-cryptography',
    ['872 steps', '11 521 steps', '142 969 steps', '2 000 000', '13 bits', '31 bits',
      '42 864', '104 729']);
});

test('public-key-cryptography: the RSA attack and the key that simply factors', function () {
  const key = Pk.rsaKey(1061n, 1553n, 17n);
  const cipher = Pk.rsaEncrypt(42n, key);

  assert.strictEqual(key.n, 1647733n);
  assert.strictEqual(cipher, 1074770n);

  const attack = Pk.malleabilityAttack({ key: key, ciphertext: cipher, blind: 3n,
    oracle: function (value) { return Pk.rsaDecrypt(value, key); } });

  assert.strictEqual(attack.blinded, 1008078n);
  assert.strictEqual(attack.oracleAnswer, 126n);
  assert.strictEqual(attack.recovered, 42n);

  const factored = Pk.factor(key.n);

  assert.strictEqual(factored.steps, 1060);
  assert.strictEqual(factored.p, 1061n);
  assert.strictEqual(factored.q, 1553n);
  prose.quotes('public-key-cryptography',
    ['1 647 733', '1 074 770', '1 008 078', '126', '1 060', '1 061', '1 553']);
});

/* -------------------------------------------------- 23.8 signatures / PKI */

test('signatures-and-pki: the nonce-reuse recovery, value by value', function () {
  const curve = Pk.demoCurve();
  const key = Signatures.keyPair(1234n, curve);
  const first = Signatures.sign({ curve: curve, key: key, k: 777n,
    message: Hash.bytesOf('transfer 100 to alice') });
  const second = Signatures.sign({ curve: curve, key: key, k: 777n,
    message: Hash.bytesOf('transfer 900 to mallory') });
  const attack = Signatures.recoverFromReusedNonce({ curve: curve, first: first,
    second: second });

  assert.strictEqual(curve.n, 3359n, 'the demo curve has prime order 3 359');
  assert.strictEqual(first.r, 1854n);
  assert.strictEqual(second.r, 1854n);
  assert.strictEqual(first.s, 414n);
  assert.strictEqual(second.s, 2957n);
  assert.strictEqual(attack.k, 777n);
  assert.strictEqual(attack.d, 1234n);
  prose.quotes('signatures-and-pki',
    ['3 359', '1 854', '414', '2 957', '777', '1 234']);
});

test('signatures-and-pki: the check counts across five chains', function () {
  const curve = Pk.demoCurve();
  const keys = { anchor: Signatures.keyPair(9001n, curve), ca: Signatures.keyPair(9002n, curve),
    leaf: Signatures.keyPair(9003n, curve), rogue: Signatures.keyPair(9004n, curve) };
  const anchor = Signatures.certificate({ subject: 'Root', issuer: 'Root', notBefore: 2020,
    notAfter: 2040, isCa: true, key: keys.anchor, keyUsage: ['certSign'] });
  const ca = Signatures.signCertificate(Signatures.certificate({ subject: 'Issuing',
    issuer: 'Root', notBefore: 2023, notAfter: 2033, isCa: true, key: keys.ca,
    keyUsage: ['certSign'] }), keys.anchor, curve);
  const spec = { subject: 'shop.example.com', issuer: 'Issuing', notBefore: 2025,
    notAfter: 2027, isCa: false, key: keys.leaf,
    names: ['shop.example.com', '*.shop.example.com'] };
  const leafOf = function (over) {
    return Signatures.signCertificate(Signatures.certificate(Object.assign({}, spec, over)),
      keys.ca, curve);
  };
  const run = function (chain, host) {
    return Signatures.validateChain({ chain: chain, trustAnchor: anchor, curve: curve,
      at: 2026, host: host });
  };

  const good = run([leafOf({}), ca], 'shop.example.com');

  assert.strictEqual(good.checks.length, 9);
  assert.strictEqual(good.failed.length, 0);
  assert.strictEqual(run([leafOf({ notBefore: 2019, notAfter: 2021 }), ca],
    'shop.example.com').failed.length, 1);
  assert.strictEqual(run([leafOf({}), ca], 'bank.example.com').failed.length, 1);

  const tampered = leafOf({});

  tampered.names = ['bank.example.com'];
  assert.strictEqual(run([tampered, ca], 'shop.example.com').failed.length, 2);

  const rogue = Signatures.signCertificate(Signatures.certificate({
    subject: 'blog.example.org', issuer: 'Issuing', notBefore: 2025, notAfter: 2027,
    isCa: false, key: keys.rogue, names: ['blog.example.org'] }), keys.ca, curve);
  const victim = Signatures.signCertificate(Signatures.certificate({
    subject: 'shop.example.com', issuer: 'blog.example.org', notBefore: 2025, notAfter: 2027,
    isCa: false, key: keys.leaf, names: ['shop.example.com'] }), keys.rogue, curve);
  const chained = run([victim, rogue, ca], 'shop.example.com');

  assert.strictEqual(chained.checks.length, 14);
  assert.strictEqual(chained.failed.length, 2);
  prose.quotes('signatures-and-pki', ['9 checks', '14 checks applied, 2 fail']);
});

test('signatures-and-pki: the deterministic nonces the demo reports', function () {
  const curve = Pk.demoCurve();
  const key = Signatures.keyPair(1234n, curve);
  const a = Signatures.deterministicNonce({ curve: curve, key: key,
    message: Hash.bytesOf('transfer 100 to alice') });
  const b = Signatures.deterministicNonce({ curve: curve, key: key,
    message: Hash.bytesOf('transfer 900 to mallory') });

  assert.notStrictEqual(a, b, 'different messages give different nonces');
  assert.strictEqual(Signatures.deterministicNonce({ curve: curve, key: key,
    message: Hash.bytesOf('transfer 100 to alice') }), a, 'and the derivation is stable');
});

/* -------------------------------------------------------- 23.9 protocol */

test('protocol-construction: the blast radius and the recovery point', function () {
  const rootKey = Hash.sha256(Hash.bytesOf('shared secret from the initial agreement'));
  const secrecy = Ratchet.forwardSecrecy({ rootChainKey: rootKey, messages: 10,
    compromiseAt: 3 });

  assert.strictEqual(secrecy.pastSafe, true);
  assert.deepStrictEqual(secrecy.exposedIndices, [3, 4, 5, 6, 7, 8, 9]);

  const run = Ratchet.postCompromise({ curve: Pk.demoCurve(), rootKey: rootKey,
    alicePrivate: 11n, bobPrivate: 23n, aliceSecondPrivate: 31n, bobSecondPrivate: 67n,
    messages: 10, compromiseAt: 3, ratchetAt: 6 });

  assert.deepStrictEqual(run.readable, [3, 4, 5]);
  assert.strictEqual(run.recoveredAt, 6);
  prose.quotes('protocol-construction',
    ['3 messages before the theft', 'messages 3, 4 and 5', '3 of 10', 'message 6']);
});

test('protocol-construction: the conversation and its ratchet count', function () {
  const rootKey = Hash.sha256(Hash.bytesOf('shared secret from the initial agreement'));
  const script = ['alice', 'alice', 'bob', 'alice', 'bob', 'bob', 'alice', 'bob'];
  const run = Ratchet.conversation({ curve: Pk.demoCurve(), rootKey: rootKey,
    alicePrivate: 11n, bobPrivate: 23n, aliceKeys: [31n, 41n, 53n], bobKeys: [67n, 79n, 97n],
    script: script });
  let changes = 0;

  script.forEach(function (from, i) { if (i > 0 && script[i - 1] !== from) changes += 1; });

  assert.strictEqual(changes, 5, 'five direction changes in the script');
  assert.strictEqual(run.ratchets, 10, 'costing ten ratchet steps across both parties');
  assert.strictEqual(run.allDelivered, true);
  assert.strictEqual(run.messages.length, 8);
  prose.quotes('protocol-construction',
    ['5 direction changes', '10 ratchet steps', '8 of 8']);
});

/* -------------------------------------------------- 23.10 constant time */

test('constant-time-programming: the recovery, the cost and the separation', function () {
  const secret = [0x9f, 0x3c, 0x71, 0x08];
  const attack = ConstantTime.timingAttack({ secret: secret, compare: ConstantTime.naiveWork,
    rng: Random.seeded(42), samples: 40, noise: 1.2 });

  assert.strictEqual(attack.succeeded, true);
  assert.strictEqual(attack.searchSpace, 1024);
  assert.strictEqual(attack.measurements, 40960);
  assert.strictEqual(attack.bruteForce.toExponential(3), '4.295e+9');

  const leaky = ConstantTime.timingProfile({ secret: secret, compare: ConstantTime.naiveWork,
    rng: Random.seeded(7), samples: 40, noise: 1.2, trials: 60 });
  const safe = ConstantTime.timingProfile({ secret: secret, compare: ConstantTime.constantWork,
    rng: Random.seeded(7), samples: 40, noise: 1.2, trials: 60 });

  assert.strictEqual(prose.fixed(leaky.separation, 4), '4.5029');
  assert.strictEqual(prose.fixed(safe.separation, 4), '0.0885');
  assert.strictEqual(prose.fixed(leaky.right.mean, 4), '1.9746');
  assert.strictEqual(prose.fixed(leaky.wrong.mean, 4), '0.9939');
  assert.strictEqual(prose.fixed(safe.right.mean, 4), '3.9746');
  assert.strictEqual(prose.fixed(safe.wrong.mean, 4), '3.9939');
  assert.strictEqual(prose.fixed(leaky.right.deviation, 4), '0.1098');
  assert.strictEqual(prose.fixed(leaky.wrong.deviation, 4), '0.1080');

  prose.quotes('constant-time-programming',
    ['1 024', '40 960', '4.295 × 10^9', '4.5029', '0.0885',
      '1.9746 ± 0.1098', '0.9939 ± 0.1080', '3.9746 ± 0.1098', '3.9939 ± 0.1080']);
});

test('constant-time-programming: the noise sweep prices distance', function () {
  const secret = [0x9f, 0x3c, 0x71, 0x08];
  const at = function (noise, samples) {
    return ConstantTime.timingAttack({ secret: secret, compare: ConstantTime.naiveWork,
      rng: Random.seeded(42), samples: samples, noise: noise }).succeeded;
  };
  const samples = [10, 20, 40, 80, 160, 320];
  const smallest = function (noise) {
    return samples.filter(function (n) { return at(noise, n); })[0];
  };

  assert.strictEqual(smallest(0.4), 10, 'a quiet link needs 10 samples');
  assert.strictEqual(smallest(1.2), 10, 'and so does a data centre');
  assert.strictEqual(smallest(3), 80, 'the internet needs 80');
  assert.strictEqual(smallest(6), 320, 'a congested link needs 320');

  let cells = 0;

  [0.4, 1.2, 3, 6].forEach(function (noise) {
    samples.forEach(function (n) {
      if (ConstantTime.timingAttack({ secret: secret, compare: ConstantTime.constantWork,
        rng: Random.seeded(42), samples: n, noise: noise }).succeeded) cells += 1;
    });
  });
  assert.strictEqual(cells, 0, 'the branchless comparison must fail in all 24 cells');
  prose.quotes('constant-time-programming',
    ['recovers at 80', 'only at 320 samples', '0 recoveries in 24 cells', '8 192']);
});

/* ------------------------------------------- 23.11 applied constructions */

test('applied-constructions: every k-subset, and the value two shares return', function () {
  const run = Threshold.split({ secret: 1234567n, n: 5, k: 3, rng: Random.seeded(9) });
  let subsets = 0;

  for (let a = 0; a < 5; a += 1) {
    for (let b = a + 1; b < 5; b += 1) {
      for (let c = b + 1; c < 5; c += 1) {
        assert.strictEqual(
          Threshold.reconstruct([run.shares[a], run.shares[b], run.shares[c]], run.prime),
          1234567n);
        subsets += 1;
      }
    }
  }
  assert.strictEqual(subsets, 10);
  assert.strictEqual(run.prime, 2147483647n);
  assert.strictEqual(
    Threshold.reconstruct([run.shares[0], run.shares[1]], run.prime), 446296622n);

  const study = Threshold.underdetermined({ shares: [run.shares[0], run.shares[1]], k: 3,
    candidates: 8, from: 1234563, prime: run.prime });

  assert.strictEqual(study.allConsistent, true);
  assert.strictEqual(study.distinctImplied, 8);
  prose.quotes('applied-constructions',
    ['10 subsets', '1 234 567', '446 296 622', '8 candidates tested, 8 consistent',
      '2 147 483 647']);
});

test('applied-constructions: the proof lengths and the cost table', function () {
  const entries = ['alice:100', 'bob:250', 'carol:75', 'dave:900', 'erin:12', 'frank:640',
    'grace:38'].map(Hash.bytesOf);
  const tree = Threshold.buildTree(entries);

  assert.strictEqual(tree.leaves, 7);
  assert.strictEqual(tree.levels.length, 4);
  assert.strictEqual(Hash.hex(tree.root).slice(0, 8), '6a8f617f');
  assert.strictEqual(Threshold.proof(tree, 2).length, 3);
  assert.strictEqual(Threshold.proof(tree, 6).length, 2);
  assert.strictEqual(Threshold.verifyProof({ root: tree.root, value: entries[2],
    proof: Threshold.proof(tree, 2) }), true);
  assert.strictEqual(Threshold.verifyProof({ root: tree.root,
    value: Hash.bytesOf('carol:7500'), proof: Threshold.proof(tree, 2) }), false);

  const rows = Threshold.proofCost([8, 1024, 1048576, 1073741824]);
  const billion = rows[rows.length - 1];

  assert.strictEqual(billion.proofHashes, 30);
  assert.strictEqual(billion.proofBytes, 960);
  assert.strictEqual(billion.fullListBytes, 34359738368);
  assert.ok(billion.saving > 35000000);
  prose.quotes('applied-constructions',
    ['7 leaves → 4 levels', '3 sibling hashes, 96 bytes', '2 sibling hashes rather than 3',
      '30 hashes and 960 B', '34.4 GB', '6a8f617f']);
});

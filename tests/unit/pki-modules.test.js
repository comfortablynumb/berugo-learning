'use strict';

/**
 * Property tests for the M23 public-key, protocol and applied modules.
 *
 * The attacks here are the point of the milestone, so every one of them is
 * executed rather than described: the RSA malleability query, the ECDSA
 * nonce-reuse key recovery, the timing recovery of a secret token, the
 * ratchet's forward secrecy and Shamir's underdetermination all run and their
 * outcome is asserted.
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

/* --------------------------------------------------------------- RSA / DH */

test('public-key: modPow agrees with a direct computation and RSA round-trips', function () {
  assert.strictEqual(Pk.modPow(2n, 10n, 1000n), 24n, '2^10 mod 1000 is 24');
  assert.strictEqual(Pk.modPow(7n, 0n, 13n), 1n, 'anything to the zero is one');
  assert.strictEqual(Pk.modPow(2n, 100n, 1000000007n), 976371285n, '2^100 is a fixed value');

  const key = Pk.rsaKey(1061n, 1553n, 17n);

  assert.strictEqual(key.n, 1647733n, 'n is p times q');
  assert.strictEqual((key.e * key.d) % key.phi, 1n, 'd inverts e modulo phi');
  for (let m = 2n; m < 60n; m += 7n) {
    assert.strictEqual(Pk.rsaDecrypt(Pk.rsaEncrypt(m, key), key), m,
      'RSA must round-trip the message ' + m);
  }
});

test('public-key: the malleability attack never submits the forbidden ciphertext', function () {
  const key = Pk.rsaKey(1061n, 1553n, 17n);
  const message = 42n;
  const ciphertext = Pk.rsaEncrypt(message, key);

  [2n, 3n, 5n, 9n].forEach(function (blind) {
    let refused = false;
    let queries = 0;
    const attack = Pk.malleabilityAttack({ key: key, ciphertext: ciphertext, blind: blind,
      oracle: function (value) {
        queries += 1;
        if (value === ciphertext) { refused = true; return 0n; }
        return Pk.rsaDecrypt(value, key);
      } });

    assert.strictEqual(refused, false, 'the forbidden ciphertext must never be submitted');
    assert.strictEqual(queries, 1, 'one query is enough at blind ' + blind);
    assert.strictEqual(attack.recovered, message, 'and the plaintext falls out');
  });
});

test('public-key: Diffie–Hellman agrees, and the break tracks the modulus', function () {
  const sizes = [7919n, 104729n, 1299709n];
  const steps = [];

  sizes.forEach(function (p) {
    const exchange = Pk.diffieHellman({ p: p, g: 5n, a: (p * 61n) / 100n, b: (p * 37n) / 100n });

    assert.strictEqual(exchange.aliceShared, exchange.bobShared,
      'both sides must reach the same secret at modulus ' + p);

    const log = Pk.discreteLog(exchange.alicePublic, 5n, p, 2000000);

    assert.strictEqual(log.found, true, 'the naive search must finish at ' + p);
    assert.strictEqual(Pk.modPow(exchange.bobPublic, BigInt(log.x), p), exchange.aliceShared,
      'any solution to the discrete log yields the shared secret');
    steps.push(log.steps);
  });
  assert.ok(steps[0] < steps[1] && steps[1] < steps[2],
    'the cost must rise with the group size: ' + steps.join(', '));

  const big = Pk.diffieHellman({ p: 2147483647n, g: 5n, a: 1309965024n, b: 794468949n });

  assert.strictEqual(Pk.discreteLog(big.alicePublic, 5n, 2147483647n, 2000000).found, false,
    'and at 31 bits the same code runs out of budget');
});

test('public-key: the demo curve is a group with a prime-order generator', function () {
  const curve = Pk.demoCurve();

  assert.strictEqual(Pk.isOnCurve(curve.g, curve), true, 'the generator is on the curve');
  assert.strictEqual(Pk.scalarMul(curve.n, curve.g, curve).infinity, true,
    'and multiplying by the order gives the point at infinity');

  const exchange = Pk.ecdh({ curve: curve, a: 7n, b: 11n });

  assert.deepStrictEqual(exchange.aliceShared, exchange.bobShared,
    'ECDH must reach the same point from both sides');
  assert.strictEqual(Pk.isOnCurve(exchange.aliceShared, curve), true,
    'and the shared point must be on the curve');
});

/* ------------------------------------------------------ signatures and PKI */

test('signatures: sign and verify agree, and a tampered message does not', function () {
  const curve = Pk.demoCurve();
  const key = Signatures.keyPair(1234n, curve);
  const message = Hash.bytesOf('transfer 100 to alice');
  const signature = Signatures.sign({ curve: curve, key: key,
    k: Signatures.deterministicNonce({ curve: curve, key: key, message: message }),
    message: message });

  assert.strictEqual(Signatures.verify({ curve: curve, publicKey: key.q, message: message,
    signature: signature }), true, 'an honest signature verifies');
  assert.strictEqual(Signatures.verify({ curve: curve, publicKey: key.q,
    message: Hash.bytesOf('transfer 900 to mallory'), signature: signature }), false,
  'and it does not verify against a different message');
});

test('signatures: a repeated nonce gives up the private key', function () {
  const curve = Pk.demoCurve();

  [1234n, 77n, 3000n].forEach(function (secret) {
    const key = Signatures.keyPair(secret, curve);
    const first = Signatures.sign({ curve: curve, key: key, k: 777n,
      message: Hash.bytesOf('transfer 100 to alice') });
    const second = Signatures.sign({ curve: curve, key: key, k: 777n,
      message: Hash.bytesOf('transfer 900 to mallory') });

    assert.strictEqual(first.r, second.r, 'the shared nonce shows as a shared r');

    const attack = Signatures.recoverFromReusedNonce({ curve: curve, first: first,
      second: second });

    assert.strictEqual(attack.k, 777n, 'the nonce is recovered');
    assert.strictEqual(attack.d, key.d, 'and so is the private key ' + key.d);
  });
});

test('signatures: deterministic nonces differ per message and are stable per run', function () {
  const curve = Pk.demoCurve();
  const key = Signatures.keyPair(1234n, curve);
  const a = Hash.bytesOf('transfer 100 to alice');
  const b = Hash.bytesOf('transfer 900 to mallory');
  const first = Signatures.deterministicNonce({ curve: curve, key: key, message: a });
  const second = Signatures.deterministicNonce({ curve: curve, key: key, message: b });

  assert.notStrictEqual(first, second, 'different messages must give different nonces');
  assert.strictEqual(Signatures.deterministicNonce({ curve: curve, key: key, message: a }), first,
    'and the same message must give the same nonce every time');

  const one = Signatures.sign({ curve: curve, key: key, k: first, message: a });
  const two = Signatures.sign({ curve: curve, key: key, k: second, message: b });

  assert.notStrictEqual(one.r, two.r, 'so the r values differ');
  assert.notStrictEqual(Signatures.recoverFromReusedNonce({ curve: curve, first: one,
    second: two }).d, key.d, 'and the recovery finds nothing');
});

test('signatures: each broken chain fails on its own check', function () {
  const curve = Pk.demoCurve();
  const keys = { anchor: Signatures.keyPair(9001n, curve), ca: Signatures.keyPair(9002n, curve),
    leaf: Signatures.keyPair(9003n, curve), rogue: Signatures.keyPair(9004n, curve) };
  const anchor = Signatures.certificate({ subject: 'Root', issuer: 'Root', notBefore: 2020,
    notAfter: 2040, isCa: true, key: keys.anchor, keyUsage: ['certSign'] });
  const ca = Signatures.signCertificate(Signatures.certificate({ subject: 'Issuing',
    issuer: 'Root', notBefore: 2023, notAfter: 2033, isCa: true, key: keys.ca,
    keyUsage: ['certSign'] }), keys.anchor, curve);
  const leafSpec = { subject: 'shop.example.com', issuer: 'Issuing', notBefore: 2025,
    notAfter: 2027, isCa: false, key: keys.leaf,
    names: ['shop.example.com', '*.shop.example.com'] };
  const leafOf = function (spec) {
    return Signatures.signCertificate(Signatures.certificate(spec), keys.ca, curve);
  };
  const run = function (chain, host, at) {
    return Signatures.validateChain({ chain: chain, trustAnchor: anchor, curve: curve,
      at: at === undefined ? 2026 : at, host: host });
  };

  const good = run([leafOf(leafSpec), ca], 'shop.example.com');

  assert.strictEqual(good.valid, true, 'the well-formed chain must be accepted');
  assert.strictEqual(good.checks.length, 9, 'and nine checks must have been applied');

  const expired = run([leafOf(Object.assign({}, leafSpec, { notBefore: 2019, notAfter: 2021 })),
    ca], 'shop.example.com');

  assert.strictEqual(expired.failed.length, 1, 'an expired leaf fails exactly one check');
  assert.match(expired.failed[0].name, /validity window/, 'and it is the validity window');

  const wrongHost = run([leafOf(leafSpec), ca], 'bank.example.com');

  assert.strictEqual(wrongHost.failed.length, 1, 'a wrong host fails exactly one check');
  assert.match(wrongHost.failed[0].name, /host name/, 'and it is the name match');

  const tampered = leafOf(leafSpec);

  tampered.names = ['bank.example.com'];
  assert.strictEqual(run([tampered, ca], 'shop.example.com').valid, false,
    'editing the leaf after signing must break it');
});

test('signatures: a leaf may not issue another certificate', function () {
  const curve = Pk.demoCurve();
  const keys = { anchor: Signatures.keyPair(9001n, curve), ca: Signatures.keyPair(9002n, curve),
    leaf: Signatures.keyPair(9003n, curve), rogue: Signatures.keyPair(9004n, curve) };
  const anchor = Signatures.certificate({ subject: 'Root', issuer: 'Root', notBefore: 2020,
    notAfter: 2040, isCa: true, key: keys.anchor, keyUsage: ['certSign'] });
  const ca = Signatures.signCertificate(Signatures.certificate({ subject: 'Issuing',
    issuer: 'Root', notBefore: 2023, notAfter: 2033, isCa: true, key: keys.ca,
    keyUsage: ['certSign'] }), keys.anchor, curve);
  const rogue = Signatures.signCertificate(Signatures.certificate({ subject: 'blog.example.org',
    issuer: 'Issuing', notBefore: 2025, notAfter: 2027, isCa: false, key: keys.rogue,
    names: ['blog.example.org'] }), keys.ca, curve);
  const victim = Signatures.signCertificate(Signatures.certificate({
    subject: 'shop.example.com', issuer: 'blog.example.org', notBefore: 2025, notAfter: 2027,
    isCa: false, key: keys.leaf, names: ['shop.example.com'] }), keys.rogue, curve);
  const result = Signatures.validateChain({ chain: [victim, rogue, ca], trustAnchor: anchor,
    curve: curve, at: 2026, host: 'shop.example.com' });

  assert.strictEqual(result.valid, false, 'basic constraints must stop this');
  assert.strictEqual(result.checks.length, 14, 'a three-link chain applies fourteen checks');
  assert.strictEqual(result.failed.length, 2,
    'and both basic constraints and key usage fail on the rogue issuer');
});

test('signatures: a wildcard covers one label and never the bare domain', function () {
  assert.strictEqual(Signatures.matchesName('*.example.com', 'shop.example.com'), true);
  assert.strictEqual(Signatures.matchesName('*.example.com', 'a.b.example.com'), false);
  assert.strictEqual(Signatures.matchesName('*.example.com', 'example.com'), false);
  assert.strictEqual(Signatures.matchesName('*.example.com', 'shop.example.net'), false);
  assert.strictEqual(Signatures.matchesName('shop.example.com', 'shop.example.com'), true);
});

/* --------------------------------------------------------------- protocol */

test('ratchet: the symmetric chain bounds the past and not the future', function () {
  const rootKey = Hash.sha256(Hash.bytesOf('shared secret from the initial agreement'));

  [0, 3, 6, 9].forEach(function (compromiseAt) {
    const run = Ratchet.forwardSecrecy({ rootChainKey: rootKey, messages: 10,
      compromiseAt: compromiseAt });

    assert.strictEqual(run.pastSafe, true,
      'nothing before message ' + compromiseAt + ' may be derivable');
    assert.strictEqual(run.futureExposed, true,
      'and everything after it must be, because deriving forward is the legitimate path');
    assert.deepStrictEqual(run.exposedIndices,
      Array.from({ length: 10 - compromiseAt }, function (ignored, i) {
        return compromiseAt + i;
      }), 'exactly the messages from the theft onward');
  });
});

test('ratchet: a DH ratchet ends the compromise without anyone noticing it', function () {
  const curve = Pk.demoCurve();
  const rootKey = Hash.sha256(Hash.bytesOf('shared secret from the initial agreement'));
  const run = Ratchet.postCompromise({ curve: curve, rootKey: rootKey, alicePrivate: 11n,
    bobPrivate: 23n, aliceSecondPrivate: 31n, bobSecondPrivate: 67n, messages: 10,
    compromiseAt: 3, ratchetAt: 6 });

  assert.deepStrictEqual(run.readable, [3, 4, 5],
    'the stolen root opens exactly the messages between the theft and the ratchet');
  assert.strictEqual(run.recoveredAt, 6, 'and security returns when the ratchet turns');
});

test('ratchet: a real conversation delivers every message', function () {
  const curve = Pk.demoCurve();
  const rootKey = Hash.sha256(Hash.bytesOf('shared secret from the initial agreement'));
  const script = ['alice', 'alice', 'bob', 'alice', 'bob', 'bob', 'alice', 'bob'];
  const run = Ratchet.conversation({ curve: curve, rootKey: rootKey, alicePrivate: 11n,
    bobPrivate: 23n, aliceKeys: [31n, 41n, 53n], bobKeys: [67n, 79n, 97n], script: script });

  assert.strictEqual(run.allDelivered, true, 'both sides must derive the same key every time');
  assert.strictEqual(run.messages.length, script.length, 'every scripted message is delivered');
  assert.strictEqual(run.ratchets, 10, 'five direction changes cost ten ratchet steps');
});

/* ---------------------------------------------------------- constant time */

test('constant-time: the branchless helpers agree with the obvious versions', function () {
  assert.strictEqual(ConstantTime.select(1, 0xaa, 0xbb), 0xaa);
  assert.strictEqual(ConstantTime.select(0, 0xaa, 0xbb), 0xbb);
  assert.strictEqual(ConstantTime.select(1, 0xffffffff, 0) >>> 0, 0xffffffff);

  const values = [0, 1, 2, 255, 65535, 0x7fffffff, 0xffffffff];

  values.forEach(function (a) {
    values.forEach(function (b) {
      assert.strictEqual(ConstantTime.lessThan(a, b), a < b ? 1 : 0,
        'lessThan(' + a + ', ' + b + ')');
      assert.strictEqual(ConstantTime.equalWords(a, b), a === b ? 1 : 0,
        'equalWords(' + a + ', ' + b + ')');
    });
  });
  [[[1, 2, 3], [1, 2, 3]], [[1, 2, 3], [1, 2, 4]], [[1, 2, 3], [9, 2, 3]],
    [[1, 2, 3], [1, 2]], [[], []]].forEach(function (pair) {
    assert.strictEqual(ConstantTime.equals(pair[0], pair[1]),
      ConstantTime.naiveEquals(pair[0], pair[1]), JSON.stringify(pair));
  });
  assert.strictEqual(ConstantTime.lookup([10, 20, 30, 40], 2), 30, 'a scanning lookup is correct');
});

test('constant-time: the timing attack empties the early-exit comparison only', function () {
  const secret = [0x9f, 0x3c, 0x71, 0x08];
  const leaky = ConstantTime.timingAttack({ secret: secret, compare: ConstantTime.naiveWork,
    rng: Random.seeded(42), samples: 40, noise: 1.2 });

  assert.strictEqual(leaky.succeeded, true, 'the early-exit comparison must give up the token');
  assert.deepStrictEqual(leaky.recovered, secret, 'byte for byte');
  assert.strictEqual(leaky.searchSpace, 1024, '4 positions × 256 values');
  assert.strictEqual(leaky.bruteForce, Math.pow(2, 32), 'against a blind space of 2^32');

  const safe = ConstantTime.timingAttack({ secret: secret, compare: ConstantTime.constantWork,
    rng: Random.seeded(42), samples: 40, noise: 1.2 });

  assert.strictEqual(safe.succeeded, false, 'and the branchless one must give up nothing');
});

test('constant-time: the separation is large for one comparison and absent for the other', function () {
  const secret = [0x9f, 0x3c, 0x71, 0x08];
  const leaky = ConstantTime.timingProfile({ secret: secret, compare: ConstantTime.naiveWork,
    rng: Random.seeded(7), samples: 40, noise: 1.2, trials: 60 });
  const safe = ConstantTime.timingProfile({ secret: secret, compare: ConstantTime.constantWork,
    rng: Random.seeded(7), samples: 40, noise: 1.2, trials: 60 });

  assert.ok(leaky.separation > 3, 'the early exit must separate by several deviations');
  assert.ok(safe.separation < 0.5, 'and the branchless one by a fraction of one');
  assert.ok(safe.right.mean > leaky.right.mean,
    'the branchless comparison is SLOWER in absolute terms, which is the whole cost');
});

test('constant-time: more noise needs more averaging and never stops the attack', function () {
  const secret = [0x9f, 0x3c, 0x71, 0x08];
  const at = function (noise, samples) {
    return ConstantTime.timingAttack({ secret: secret, compare: ConstantTime.naiveWork,
      rng: Random.seeded(42), samples: samples, noise: noise }).succeeded;
  };

  assert.strictEqual(at(0.4, 10), true, 'a quiet link needs almost no averaging');
  assert.strictEqual(at(3, 40), false, 'internet noise defeats 40 samples per guess');
  assert.strictEqual(at(3, 80), true, 'and 80 is enough');
  assert.strictEqual(at(6, 320), true, 'a congested link only costs more measurements');
});

/* ------------------------------------------------------ applied constructions */

test('threshold: every k-subset reconstructs and k − 1 constrains nothing', function () {
  const run = Threshold.split({ secret: 1234567n, n: 5, k: 3, rng: Random.seeded(9) });
  let subsets = 0;

  for (let a = 0; a < 5; a += 1) {
    for (let b = a + 1; b < 5; b += 1) {
      for (let c = b + 1; c < 5; c += 1) {
        assert.strictEqual(
          Threshold.reconstruct([run.shares[a], run.shares[b], run.shares[c]], run.prime),
          1234567n, 'shares ' + a + ',' + b + ',' + c + ' must reconstruct');
        subsets += 1;
      }
    }
  }
  assert.strictEqual(subsets, 10, 'all ten three-share subsets were checked');

  const short = Threshold.reconstruct([run.shares[0], run.shares[1]], run.prime);

  assert.notStrictEqual(short, 1234567n, 'two shares must not reconstruct');
  assert.ok(short >= 0n && short < run.prime, 'and must fail silently, returning a field element');

  const study = Threshold.underdetermined({ shares: [run.shares[0], run.shares[1]], k: 3,
    candidates: 8, from: 1234563, prime: run.prime });

  assert.strictEqual(study.allConsistent, true, 'every candidate secret still fits the shares');
  assert.strictEqual(study.distinctImplied, 8,
    'and each implies a different value for a share nobody holds');
});

test('threshold: a commitment hides and binds', function () {
  const message = Hash.bytesOf('the sealed bid is 4200');
  const commitment = Threshold.commit(message, Random.seeded(3));

  assert.strictEqual(Threshold.openCommitment(commitment.commitment, commitment.opening, message),
    true, 'the honest opening must verify');
  assert.strictEqual(Threshold.openCommitment(commitment.commitment, commitment.opening,
    Hash.bytesOf('the sealed bid is 9900')), false, 'and a second message must not');
  assert.strictEqual(commitment.opening.length, 32, 'the opening is 32 random bytes');
});

test('threshold: every leaf proves, and an edited leaf does not', function () {
  const entries = ['alice:100', 'bob:250', 'carol:75', 'dave:900', 'erin:12', 'frank:640',
    'grace:38'].map(Hash.bytesOf);
  const tree = Threshold.buildTree(entries);

  assert.strictEqual(tree.leaves, 7, 'seven leaves');
  assert.strictEqual(tree.levels.length, 4, 'in four levels');

  entries.forEach(function (value, index) {
    const proof = Threshold.proof(tree, index);

    assert.strictEqual(Threshold.verifyProof({ root: tree.root, value: value, proof: proof }),
      true, 'leaf ' + index + ' must prove');
    assert.strictEqual(Threshold.verifyProof({ root: tree.root,
      value: Hash.bytesOf('edited'), proof: proof }), false,
    'and the same proof must reject an edited value');
  });
  assert.strictEqual(Threshold.proof(tree, 6).length, 2,
    'the odd leaf is carried up, so its path is shorter');
  assert.strictEqual(Threshold.proof(tree, 0).length, 3, 'while a paired leaf needs three');
});

test('threshold: the proof cost is logarithmic', function () {
  const rows = Threshold.proofCost([8, 1024, 1048576, 1073741824]);

  assert.deepStrictEqual(rows.map(function (row) { return row.proofHashes; }), [3, 10, 20, 30]);
  assert.deepStrictEqual(rows.map(function (row) { return row.proofBytes; }),
    [96, 320, 640, 960]);
  assert.strictEqual(rows[3].fullListBytes, 1073741824 * 32,
    'against the whole list at 32 bytes an entry');
  assert.ok(rows[3].saving > 35000000, 'a saving of tens of millions at a billion entries');
});

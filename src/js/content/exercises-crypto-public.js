/**
 * Graded exercises for public keys, signatures and protocols (M23.7-M23.9).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'public-key-cryptography': [{
      id: 'rsa-and-its-malleability',
      title: 'Build small RSA, then break it with one chosen-ciphertext query',
      prompt: 'rsa(op, args) must handle three operations on BigInt values. op "keygen" takes ' +
        '{ p, q, e } and returns { n, e, d } where d is the inverse of e modulo (p−1)(q−1). ' +
        'op "power" takes { base, exponent, modulus } and returns base^exponent mod modulus, ' +
        'computed by square-and-multiply so it works at any size. op "attack" takes ' +
        '{ key, ciphertext, blind, oracle } and must recover the plaintext WITHOUT submitting ' +
        'the ciphertext: multiply it by blind^e mod n, pass that to oracle, and divide the ' +
        'answer by blind modulo n. The starter computes powers by repeated multiplication, which ' +
        'overflows the operation budget, and refuses to attack.',
      entry: 'rsa',
      opsLimit: 4000000,
      starter: [
        'function rsa(op, args) {',
        '  if (op === \'power\') {',
        '    // Repeated multiplication: correct, and hopeless past small exponents.',
        '    let result = 1n;',
        '',
        '    for (let i = 0n; i < args.exponent; i += 1n) {',
        '      result = (result * args.base) % args.modulus;',
        '    }',
        '    return result;',
        '  }',
        '  if (op === \'keygen\') return { n: args.p * args.q, e: args.e, d: 1n };',
        '  return null;',
        '}'
      ].join('\n'),
      solution: [
        'function rsa(op, args) {',
        '  function mod(value, m) { return ((value % m) + m) % m; }',
        '  function power(base, exponent, modulus) {',
        '    let result = 1n;',
        '    let b = mod(base, modulus);',
        '    let e = exponent;',
        '',
        '    while (e > 0n) {',
        '      if (e & 1n) result = (result * b) % modulus;',
        '      b = (b * b) % modulus;',
        '      e >>= 1n;',
        '    }',
        '    return result;',
        '  }',
        '  function inverse(a, m) {',
        '    let [oldR, r] = [mod(a, m), m];',
        '    let [oldS, s] = [1n, 0n];',
        '',
        '    while (r !== 0n) {',
        '      const q = oldR / r;',
        '',
        '      [oldR, r] = [r, oldR - q * r];',
        '      [oldS, s] = [s, oldS - q * s];',
        '    }',
        '    return mod(oldS, m);',
        '  }',
        '  if (op === \'power\') return power(args.base, args.exponent, args.modulus);',
        '  if (op === \'keygen\') {',
        '    const n = args.p * args.q;',
        '    const phi = (args.p - 1n) * (args.q - 1n);',
        '',
        '    return { n: n, e: args.e, d: inverse(args.e, phi) };',
        '  }',
        '  if (op === \'attack\') {',
        '    const key = args.key;',
        '    const blinded = (args.ciphertext * power(args.blind, key.e, key.n)) % key.n;',
        '',
        '    return mod(args.oracle(blinded) * inverse(args.blind, key.n), key.n);',
        '  }',
        '  return null;',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'key generation and the round trip work at a readable size',
          assert: function (rsa, api) {
            const key = rsa('keygen', { p: 1061n, q: 1553n, e: 17n });

            api.assert.equal(key.n.toString(), '1647733', 'n is p times q');
            api.assert.equal(((key.e * key.d) % ((1061n - 1n) * (1553n - 1n))).toString(), '1',
              'd must be the inverse of e modulo phi');

            const cipher = rsa('power', { base: 42n, exponent: key.e, modulus: key.n });

            api.assert.equal(cipher.toString(), '1074770', 'encryption of 42 under e = 17');
            api.assert.equal(
              rsa('power', { base: cipher, exponent: key.d, modulus: key.n }).toString(), '42',
              'and decryption must return the message');
          }
        },
        {
          name: 'square-and-multiply survives a large exponent',
          assert: function (rsa, api) {
            const value = rsa('power',
              { base: 7n, exponent: 1000000007n, modulus: 2147483647n });

            api.assert.ok(value >= 0n && value < 2147483647n, 'the result is reduced');
            api.assert.equal(
              rsa('power', { base: 2n, exponent: 100n, modulus: 1000000007n }).toString(),
              '976371285', '2^100 mod 1000000007 is a fixed value');
          }
        },
        {
          name: 'the malleability attack recovers the plaintext in one query',
          assert: function (rsa, api) {
            const key = rsa('keygen', { p: 1061n, q: 1553n, e: 17n });
            const message = 42n;
            const cipher = rsa('power', { base: message, exponent: key.e, modulus: key.n });
            let refused = false;
            let queries = 0;
            const oracle = function (value) {
              queries += 1;
              if (value === cipher) { refused = true; return null; }
              return rsa('power', { base: value, exponent: key.d, modulus: key.n });
            };

            const recovered = rsa('attack',
              { key: key, ciphertext: cipher, blind: 3n, oracle: oracle });

            api.assert.equal(refused, false,
              'the forbidden ciphertext must never be submitted');
            api.assert.equal(queries, 1, 'one query is enough');
            api.assert.equal(recovered.toString(), '42',
              'and the plaintext falls out of RSA being multiplicative');
          }
        }
      ]
    }],

    'signatures-and-pki': [{
      id: 'chain-validation',
      title: 'Validate a certificate chain, every check',
      prompt: 'validate(config) must return { valid, failed } for config.chain — an array from ' +
        'leaf to the last intermediate — against config.trustAnchor, at config.now, for ' +
        'config.host. Each certificate has { subject, issuer, notBefore, notAfter, isCa, ' +
        'keyUsage, names }. For every link check that its issuer field matches the subject of ' +
        'the certificate above it (the anchor for the last one), and that now lies within ' +
        '[notBefore, notAfter]. For every link ABOVE the leaf also check isCa === true and that ' +
        'keyUsage contains "certSign". Finally check that one of the leaf’s names covers the ' +
        'host, where a name beginning "*." matches exactly one extra label and never the bare ' +
        'domain. `failed` is an array of short check names. The starter checks the leaf’s expiry ' +
        'and nothing else.',
      entry: 'validate',
      starter: [
        'function validate(config) {',
        '  // Only the leaf expiry, which is the check everyone remembers.',
        '  const leaf = config.chain[0];',
        '  const failed = [];',
        '',
        '  if (config.now < leaf.notBefore || config.now > leaf.notAfter) {',
        '    failed.push(\'validity:\' + leaf.subject);',
        '  }',
        '  return { valid: failed.length === 0, failed: failed };',
        '}'
      ].join('\n'),
      solution: [
        'function validate(config) {',
        '  const failed = [];',
        '',
        '  function matches(pattern, host) {',
        '    if (pattern === host) return true;',
        '    if (pattern.indexOf(\'*.\') !== 0) return false;',
        '    const suffix = pattern.slice(1);',
        '',
        '    if (host.length <= suffix.length) return false;',
        '    if (host.slice(host.length - suffix.length) !== suffix) return false;',
        '    return host.slice(0, host.length - suffix.length).indexOf(\'.\') === -1;',
        '  }',
        '  config.chain.forEach(function (cert, i) {',
        '    const issuer = config.chain[i + 1] || config.trustAnchor;',
        '',
        '    if (!issuer || cert.issuer !== issuer.subject) {',
        '      failed.push(\'issuer:\' + cert.subject);',
        '    }',
        '    if (config.now < cert.notBefore || config.now > cert.notAfter) {',
        '      failed.push(\'validity:\' + cert.subject);',
        '    }',
        '    if (i > 0) {',
        '      if (cert.isCa !== true) failed.push(\'basicConstraints:\' + cert.subject);',
        '      if (cert.keyUsage.indexOf(\'certSign\') === -1) {',
        '        failed.push(\'keyUsage:\' + cert.subject);',
        '      }',
        '    }',
        '  });',
        '  const leaf = config.chain[0];',
        '',
        '  if (!leaf.names.some(function (name) { return matches(name, config.host); })) {',
        '    failed.push(\'host:\' + config.host);',
        '  }',
        '  return { valid: failed.length === 0, failed: failed };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'a well-formed chain passes and an expired leaf fails on exactly one check',
          assert: function (validate, api) {
            const anchor = { subject: 'Root', issuer: 'Root', notBefore: 2020, notAfter: 2040,
              isCa: true, keyUsage: ['certSign'], names: ['Root'] };
            const ca = { subject: 'Issuing', issuer: 'Root', notBefore: 2023, notAfter: 2033,
              isCa: true, keyUsage: ['certSign'], names: ['Issuing'] };
            const leaf = { subject: 'shop.example.com', issuer: 'Issuing', notBefore: 2025,
              notAfter: 2027, isCa: false, keyUsage: ['digitalSignature'],
              names: ['shop.example.com', '*.shop.example.com'] };

            const ok = validate({ chain: [leaf, ca], trustAnchor: anchor, now: 2026,
              host: 'shop.example.com' });

            api.assert.equal(ok.valid, true, 'nothing is wrong with this chain');
            api.assert.equal(ok.failed.length, 0, 'so nothing must be reported');

            const expired = Object.assign({}, leaf, { notBefore: 2019, notAfter: 2021 });
            const bad = validate({ chain: [expired, ca], trustAnchor: anchor, now: 2026,
              host: 'shop.example.com' });

            api.assert.equal(bad.valid, false, 'an expired leaf must be rejected');
            api.assert.equal(bad.failed.length, 1, 'and only the expiry check may fail');
          }
        },
        {
          name: 'a leaf may not sign another certificate',
          assert: function (validate, api) {
            const anchor = { subject: 'Root', issuer: 'Root', notBefore: 2020, notAfter: 2040,
              isCa: true, keyUsage: ['certSign'], names: ['Root'] };
            const ca = { subject: 'Issuing', issuer: 'Root', notBefore: 2023, notAfter: 2033,
              isCa: true, keyUsage: ['certSign'], names: ['Issuing'] };
            const rogue = { subject: 'blog.example.org', issuer: 'Issuing', notBefore: 2025,
              notAfter: 2027, isCa: false, keyUsage: ['digitalSignature'],
              names: ['blog.example.org'] };
            const victim = { subject: 'shop.example.com', issuer: 'blog.example.org',
              notBefore: 2025, notAfter: 2027, isCa: false, keyUsage: ['digitalSignature'],
              names: ['shop.example.com'] };

            const result = validate({ chain: [victim, rogue, ca], trustAnchor: anchor,
              now: 2026, host: 'shop.example.com' });

            api.assert.equal(result.valid, false,
              'an ordinary site certificate must not be usable as an issuer');
            api.assert.equal(result.failed.length, 2,
              'basic constraints and key usage both fail on the rogue issuer');
          }
        },
        {
          name: 'a wildcard covers one label and never the bare domain',
          assert: function (validate, api) {
            const anchor = { subject: 'Root', issuer: 'Root', notBefore: 2020, notAfter: 2040,
              isCa: true, keyUsage: ['certSign'], names: ['Root'] };
            const ca = { subject: 'Issuing', issuer: 'Root', notBefore: 2023, notAfter: 2033,
              isCa: true, keyUsage: ['certSign'], names: ['Issuing'] };
            const leaf = { subject: 'wild', issuer: 'Issuing', notBefore: 2025, notAfter: 2027,
              isCa: false, keyUsage: ['digitalSignature'], names: ['*.example.com'] };
            const check = function (host) {
              return validate({ chain: [leaf, ca], trustAnchor: anchor, now: 2026,
                host: host }).valid;
            };

            api.assert.equal(check('shop.example.com'), true, 'one label matches');
            api.assert.equal(check('a.b.example.com'), false, 'two labels must not');
            api.assert.equal(check('example.com'), false, 'the bare domain must not');
            api.assert.equal(check('shop.example.net'), false, 'a different suffix must not');
          }
        }
      ]
    }],

    'protocol-construction': [{
      id: 'symmetric-ratchet',
      title: 'Build the symmetric ratchet, and show the past stays closed',
      prompt: 'ratchet(kdf, chainKey, count) must return { messageKeys, finalChain } for `count` ' +
        'messages. At each step call kdf(chain, 1) for the message key and kdf(chain, 2) for the ' +
        'next chain key, collect the message key, and carry the new chain forward. The old chain ' +
        'key must not be retained anywhere in the result — that is what makes earlier message ' +
        'keys unrecoverable from a later state. The starter reuses one key for every message, ' +
        'which is a keystream reuse rather than a ratchet.',
      entry: 'ratchet',
      starter: [
        'function ratchet(kdf, chainKey, count) {',
        '  // One key for every message: no forward secrecy, and a keystream reuse besides.',
        '  const messageKeys = [];',
        '',
        '  for (let i = 0; i < count; i += 1) messageKeys.push(kdf(chainKey, 1));',
        '  return { messageKeys: messageKeys, finalChain: chainKey };',
        '}'
      ].join('\n'),
      solution: [
        'function ratchet(kdf, chainKey, count) {',
        '  const messageKeys = [];',
        '  let chain = chainKey;',
        '',
        '  for (let i = 0; i < count; i += 1) {',
        '    messageKeys.push(kdf(chain, 1));',
        '    chain = kdf(chain, 2);',
        '  }',
        '  return { messageKeys: messageKeys, finalChain: chain };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'every message gets a different key, and the chain advances',
          assert: function (ratchet, api) {
            const kdf = function (chain, label) {
              return chain.map(function (byte, i) {
                return ((byte * 31 + label * 17 + i) >>> 0) % 251;
              });
            };
            const start = [1, 2, 3, 4];
            const run = ratchet(kdf, start, 6);

            api.assert.equal(run.messageKeys.length, 6, 'six messages, six keys');
            const seen = new Set(run.messageKeys.map(function (key) { return key.join(','); }));

            api.assert.equal(seen.size, 6, 'and no two of them may be the same');
            api.assert.notEqual(run.finalChain.join(','), start.join(','),
              'the chain key must have moved on');
          }
        },
        {
          name: 'a later chain state derives the future and never the past',
          assert: function (ratchet, api) {
            const kdf = function (chain, label) {
              return chain.map(function (byte, i) {
                return ((byte * 31 + label * 17 + i) >>> 0) % 251;
              });
            };
            const full = ratchet(kdf, [9, 8, 7, 6], 10);
            const stolen = ratchet(kdf, [9, 8, 7, 6], 4).finalChain;
            const fromStolen = ratchet(kdf, stolen, 6);

            api.assert.deepEqual(fromStolen.messageKeys, full.messageKeys.slice(4),
              'from the stolen chain the attacker derives messages 4 onward exactly');

            const later = new Set(fromStolen.messageKeys.map(function (k) { return k.join(','); }));

            full.messageKeys.slice(0, 4).forEach(function (key, i) {
              api.assert.equal(later.has(key.join(',')), false,
                'message key ' + i + ' must not be derivable from the later state');
            });
          }
        },
        {
          name: 'the result carries no earlier chain key that would undo the property',
          assert: function (ratchet, api) {
            const kdf = function (chain, label) {
              return chain.map(function (byte, i) {
                return ((byte * 13 + label * 29 + i) >>> 0) % 241;
              });
            };
            const start = [5, 5, 5, 5];
            const run = ratchet(kdf, start, 5);
            const reference = [];
            let chain = start;

            for (let i = 0; i < 5; i += 1) {
              reference.push(kdf(chain, 1));
              chain = kdf(chain, 2);
            }
            api.assert.deepEqual(run.messageKeys, reference,
              'the derivation must match the specified order: key from label 1, chain from 2');
            api.assert.deepEqual(run.finalChain, chain,
              'and the returned chain must be the one AFTER the last message');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));

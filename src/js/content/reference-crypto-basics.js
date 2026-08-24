/** Reference entries for threat models, randomness and hashing (M23.1-M23.3). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'threat-models-and-primitives': {
      summary: 'A requirement-to-primitive map over seven goals, six published test vectors ' +
        'recomputed at render time, and the four security goals people routinely conflate set ' +
        'out with what each one does not give you.',
      intuition: 'Name the adversary first and the choice becomes a lookup; every path ends at ' +
        'an audited library rather than at an algorithm you implement.',
      formulation: {
        equations: [
          {
            label: 'Four goals, four primitives',
            expr: 'confidentiality → AEAD · integrity → AEAD · authenticity → MAC · non-repudiation → signature',
            terms: [
              { sym: 'confidentiality', meaning: 'can an eavesdropper read this? Encryption answers only this.' },
              { sym: 'integrity', meaning: 'has it changed? A checksum answers this against noise, not against a person.' },
              { sym: 'authenticity', meaning: 'was it produced by a key holder? A shared MAC key cannot say WHICH holder.' },
              { sym: 'non-repudiation', meaning: 'can a third party be convinced? Only a signature, because a MAC is forgeable by the verifier.' }
            ]
          },
          {
            label: 'Security levels and the key sizes that reach them',
            expr: 'level · RSA modulus · finite-field DH · elliptic curve',
            terms: [
              { sym: '112-bit', meaning: '2 048 · 2 048 · 224 — the current minimum for new systems' },
              { sym: '128-bit', meaning: '3 072 · 3 072 · 256 — the common target, where X25519 and P-256 live' },
              { sym: '192-bit', meaning: '7 680 · 7 680 · 384 — where RSA becomes operationally painful' },
              { sym: '256-bit', meaning: '15 360 · 15 360 · 512 — RSA is impractical, curves are routine' }
            ]
          },
          {
            label: 'Vectors recomputed when the page renders',
            expr: 'primitive · source · agrees',
            terms: [
              { sym: 'SHA-256', meaning: 'FIPS 180-4, two inputs — both agree' },
              { sym: 'AES-128 block', meaning: 'FIPS 197 Appendix C.1 — agrees' },
              { sym: 'HMAC-SHA-256', meaning: 'RFC 4231 case 1 — agrees' },
              { sym: 'PBKDF2 and ChaCha20-Poly1305', meaning: 'RFC 6070 at 4 096 iterations and RFC 8439 §2.8.2 — 6 of 6 pass' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Every primitive is checked against somebody else’s published answer',
          why: 'A wrong implementation produces stable, well-distributed, completely wrong output, and nothing about the output reveals it.',
          breaks: 'Unit tests written against your own implementation agree with it by construction; a swapped byte order still round-trips.'
        },
        {
          name: 'The adversary is named before the primitive is chosen',
          why: 'Passive, active and chosen-ciphertext adversaries need progressively stronger constructions.',
          breaks: 'An unauthenticated mode is adequate against an eavesdropper and a liability against anyone who can modify traffic.'
        },
        {
          name: 'Security is stated as attacker work, not as key length',
          why: 'Factoring has subexponential algorithms and the curve discrete log does not.',
          breaks: '"2 048-bit RSA is stronger than 256-bit ECC" compares incommensurable numbers; the curve is stronger.'
        },
        {
          name: 'Every recommendation terminates at a named audited API',
          why: 'Understanding a construction and shipping one are different activities.',
          breaks: 'Teaching implementations are not constant-time, not side-channel hardened and not audited, and this milestone says so on every section.'
        }
      ],
      complexity: [
        { operation: 'choosing a primitive', average: 'a table lookup once the goal and adversary are named', worst: 'unbounded when the goal is stated as "make it secure"' },
        { operation: 'AES-256-GCM', average: '128-bit security, hardware accelerated on most CPUs', worst: 'catastrophic on nonce reuse — plaintext and authentication key' },
        { operation: 'HMAC-SHA-256', average: 'two hash passes, 32-byte tag', worst: 'no non-repudiation, ever — the key is shared' },
        { operation: 'Ed25519 signature', average: '64 bytes, no parameter choices', worst: 'slower than a MAC by orders of magnitude' },
        { operation: 'Argon2id', average: 'tuned to a verification budget, typically 250 ms', worst: 'irrelevant against credential stuffing, which does not search' },
        { operation: 'test-vector validation', average: '6 vectors from 5 documents, recomputed per render', worst: 'a primitive with no vector coverage does not ship' }
      ],
      failureModes: [
        {
          symptom: 'The traffic is encrypted and an attacker still changed the message.',
          cause: 'Confidentiality was provided and integrity was not; the mode is malleable.',
          fix: 'Use an AEAD. Encryption alone answers one of the four goals.'
        },
        {
          symptom: 'A signed API request is accepted for a body the client never sent.',
          cause: 'The signature is hash(secret ‖ request), which is length-extendable.',
          fix: 'HMAC, or a keyed sponge. The hash is fine; the composition is not.'
        },
        {
          symptom: 'A cryptographic implementation passes every internal test and interoperates with nothing.',
          cause: 'A constant, a byte order or a padding rule is wrong, and the output still looks perfect.',
          fix: 'Check against published vectors before anything else. It is the only detector.'
        },
        {
          symptom: 'A review argues about ciphers and ships a repeated nonce.',
          cause: 'Attention went to the primitive, which was never the weak point.',
          fix: 'Review the parameters and the composition: nonce discipline, mode, comparison, cost.'
        }
      ],
      inTheWild: [
        'NIST SP 800-57, which is where the security-level equivalences in the demo come from.',
        'The libsodium and Tink APIs, both designed so the parameter choices cannot be made wrongly.',
        'Cryptographic module validation, where agreement with published vectors is a certification requirement rather than a habit.',
        'Post-incident reviews of TLS vulnerabilities, which are overwhelmingly composition failures rather than broken ciphers.'
      ],
      sources: [
        { title: 'Aumasson — Serious Cryptography', note: 'the practitioner’s survey: what each primitive assumes and how it fails' },
        { title: 'Ferguson, Schneier and Kohno — Cryptography Engineering', note: 'threat modelling and the discipline of naming the adversary first' },
        { title: 'Katz and Lindell — Introduction to Modern Cryptography', note: 'the formal definitions behind the four goals and the adversary models' },
        { title: 'NIST SP 800-57 Part 1 — Recommendation for Key Management', note: 'the security-level table and the equivalent key sizes' }
      ]
    },

    'randomness-for-cryptography': {
      summary: 'A statistical generator state-recovered from one output and its next eight values ' +
        'predicted exactly, the entropy of that same stream measured at 7.9553 bits per byte, ' +
        'and the identical attack run against a keyed generator for comparison.',
      intuition: 'Statistical quality and unpredictability are different properties, and every ' +
        'randomness test measures the first.',
      formulation: {
        equations: [
          {
            label: 'The generator that is not a CSPRNG',
            expr: 'xₙ₊₁ = (a·xₙ + c) mod m, with a = 1 103 515 245, c = 12 345, m = 2³¹',
            readAs: 'Each output is the previous output multiplied by a fixed constant, plus ' +
              'another constant, reduced modulo two to the thirty-first — and all three ' +
              'constants are published.',
            terms: [
              { sym: 'observations needed', meaning: '1 — the state IS the output' },
              { sym: 'predicted exactly', meaning: '8 of 8 at the shipped defaults' },
              { sym: 'Mersenne Twister', meaning: '624 observations rather than 1: a difference of degree, not of kind' },
              { sym: 'the same attack on a CSPRNG', meaning: '0 of 8 — output is not state' }
            ]
          },
          {
            label: 'What the entropy of that stream measures',
            expr: 'high byte · low byte · both fully predictable',
            terms: [
              { sym: 'high byte', meaning: '7.9553 bits of 8, 256 distinct values over 4 000 samples' },
              { sym: 'low byte', meaning: '1.2946 bits, 17 distinct values over the same 4 000' },
              { sym: 'what this shows', meaning: 'which bits you test changes the verdict; predictability does not change at all' },
              { sym: 'what a test suite measures', meaning: 'exactly this quantity, and nothing about the recurrence' }
            ]
          },
          {
            label: 'Where entropy is genuinely missing',
            expr: 'first boot · VM clone · fork · seeded-for-reproducibility',
            terms: [
              { sym: 'first boot', meaning: 'the pool is near-empty; Heninger et al. found tens of thousands of duplicate RSA keys' },
              { sym: 'VM clone', meaning: 'every instance resumes with the same pool and generator state' },
              { sym: 'fork', meaning: 'parent and child continue one stream — identical nonces, which for GCM is total' },
              { sym: 'modern Linux after init', meaning: 'getrandom(2) never blocks again; entropy is not consumed by use' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Randomness for keys comes from the platform CSPRNG, never from a seeded generator',
          why: 'A seed an attacker can guess is a key an attacker can guess.',
          breaks: 'Math.random has generated session tokens, password-reset links and API keys in shipped software repeatedly.'
        },
        {
          name: 'Passing a randomness test suite is never cited as evidence of unpredictability',
          why: 'A statistical generator is built to pass those tests and succeeds.',
          breaks: 'The demo predicts 8 of 8 outputs of a stream measuring 7.9553 bits of entropy per byte.'
        },
        {
          name: 'Key generation is deferred until the entropy pool is initialised',
          why: 'A key from an empty pool is structurally valid and completely predictable.',
          breaks: 'Embedded devices generating host keys at first boot produced shared primes across the public internet.'
        }
      ],
      complexity: [
        { operation: 'LCG state recovery', average: '1 observation, O(1) work', worst: 'the same — there is nothing to search' },
        { operation: 'Mersenne Twister state recovery', average: '624 consecutive outputs, then untemper each', worst: 'still linear and still trivial' },
        { operation: 'CSPRNG prediction', average: 'requires breaking the underlying hash or cipher', worst: 'no better attack known' },
        { operation: 'getrandom(2)', average: 'never blocks once the pool is initialised', worst: 'blocks at first boot, which is the correct behaviour' },
        { operation: 'entropy of an observed stream', average: 'O(n) over the samples', worst: 'says nothing about predictability, at any value' },
        { operation: 'reseeding', average: 'bounds the value of a state compromise in both directions', worst: 'omitted, a compromised state is permanent' }
      ],
      failureModes: [
        {
          symptom: 'Session tokens turn out to be predictable from earlier ones.',
          cause: 'They came from a statistical generator whose state is its output.',
          fix: 'crypto.getRandomValues or crypto.randomBytes. There is no configuration to fix.'
        },
        {
          symptom: 'Two devices of the same model share a private key.',
          cause: 'Both generated it at first boot from a near-empty entropy pool.',
          fix: 'Defer key generation until the pool is initialised, or provision entropy at manufacture.'
        },
        {
          symptom: 'A forked worker emits the same nonces as its parent.',
          cause: 'A userspace generator’s state was inherited across fork().',
          fix: 'Use the kernel interface, which is fork-safe, or reseed explicitly after fork.'
        },
        {
          symptom: 'A team avoids the non-blocking device to conserve entropy.',
          cause: 'The folklore that reading randomness drains a pool.',
          fix: 'Once initialised the generator is a keyed function; it produces unlimited output.'
        }
      ],
      inTheWild: [
        'The 2008 Debian OpenSSL defect, where a removed line reduced the key space to 32 767 possibilities.',
        'Heninger et al. 2012, which scanned the internet and found tens of thousands of devices sharing RSA factors.',
        'Android’s SecureRandom defect in 2013, which repeated values and cost Bitcoin wallets their keys.',
        'Cloud images and container base layers, where a shared snapshot means a shared generator state until reseeding.'
      ],
      sources: [
        { title: 'Heninger, Durumeric, Wustrow and Halderman — Mining your Ps and Qs (2012)', note: 'the internet-wide scan that found weak keys from boot-time entropy failures' },
        { title: 'NIST SP 800-90A — Recommendation for Random Number Generation', note: 'DRBG constructions, reseeding and the security properties expected of them' },
        { title: 'Barker and Kelsey — Entropy sources and health tests (SP 800-90B)', note: 'what an entropy source must demonstrate before it can be trusted' },
        { title: 'Ts’o and the Linux random(4) manual page', note: 'the current behaviour of getrandom(2) and why the blocking device is obsolete' }
      ]
    },

    'hash-functions-and-macs': {
      summary: 'A length-extension forgery executed against hash(secret ‖ message) at every ' +
        'secret length, the same attack rejected against HMAC, and the birthday bound computed ' +
        'for five digest sizes rather than quoted.',
      intuition: 'Merkle–Damgård publishes its internal state as the digest, so the tag is a ' +
        'machine an attacker can resume — which is why HMAC exists.',
      formulation: {
        equations: [
          {
            label: 'Three resistances and what each costs',
            expr: 'preimage 2ⁿ · second preimage 2ⁿ · collision 2^(n/2)',
            readAs: 'Finding an input for a given digest, or a second input matching a given ' +
              'one, costs about two to the n; finding any colliding pair costs about two to the ' +
              'n over two.',
            terms: [
              { sym: '64-bit', meaning: 'collisions at 5.0569 × 10⁹ samples — seconds' },
              { sym: '128-bit', meaning: '2.1719 × 10¹⁹ — MD5-sized; collisions practical, preimages not' },
              { sym: '160-bit', meaning: 'bound 1.4234 × 10²⁴ (2⁸⁰); the real 2017 SHA-1 collision cost about 2⁶³' },
              { sym: '256-bit', meaning: '4.0065 × 10³⁸ — the working default, 128-bit collision resistance' }
            ]
          },
          {
            label: 'The forgery, with a 16-byte secret and a 19-byte message',
            expr: 'tag ‖ length → glue → resume → suffix → accepted',
            terms: [
              { sym: 'what the attacker needs', meaning: 'one legitimate tag and the LENGTH of the secret' },
              { sym: 'glue', meaning: '29 bytes: 0x80, zeros, and a 64-bit length field, from 16 + 19 = 35' },
              { sym: 'the resume', meaning: '8 state words loaded from the published digest, at byte offset 64' },
              { sym: 'result', meaning: 'a tag the key holder’s own verifier accepts, from 1 hash computation' }
            ]
          },
          {
            label: 'Six keyed constructions rated',
            expr: 'construction · extendable · verdict',
            terms: [
              { sym: 'hash(secret ‖ message)', meaning: 'YES — broken, and forged in the demo' },
              { sym: 'hash(message ‖ secret)', meaning: 'no, but a collision on the message forges the tag, offline' },
              { sym: 'hash(secret ‖ message ‖ secret)', meaning: 'no, and no proof either — nobody has analysed it' },
              { sym: 'HMAC, KMAC, BLAKE3 keyed', meaning: 'no, and all three carry proofs' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'A keyed tag uses HMAC or a keyed sponge, never a concatenation',
          why: 'Merkle–Damgård publishes its state, so hash(secret ‖ message) is extendable by anyone holding a tag.',
          breaks: 'The demo forges a valid tag for an unauthorised message with one hash computation and no knowledge of the secret.'
        },
        {
          name: 'The required resistance is named before a digest size is chosen',
          why: 'Collision resistance is half the output length; preimage resistance is all of it.',
          breaks: 'MD5 lost collision resistance and kept preimage resistance, so "MD5 is broken" is true for signatures and false for a corruption checksum.'
        },
        {
          name: 'Tag comparison is constant time',
          why: 'An early-exit comparison turns tag verification into a byte-at-a-time search.',
          breaks: 'The constant-time section recovers a 4-byte secret in 1 024 guesses instead of 4.295 × 10⁹.'
        }
      ],
      complexity: [
        { operation: 'SHA-256', average: 'O(n) over the message, one pass', worst: 'length-extendable by construction' },
        { operation: 'HMAC-SHA-256', average: 'two hash passes plus two block XORs', worst: 'not extendable; proved from the compression function' },
        { operation: 'length-extension forgery', average: '1 hash computation once the secret length is right', worst: 'a few dozen tries across plausible lengths' },
        { operation: 'collision search, n-bit digest', average: '2^(n/2) by the birthday bound', worst: 'less, where a structural attack exists — SHA-1 fell at 2⁶³' },
        { operation: 'preimage search, n-bit digest', average: '2ⁿ', worst: 'unbroken for every hash still recommended' },
        { operation: 'sponge (SHA-3, BLAKE3)', average: 'O(n), keyed modes built in', worst: 'no length-extension property to defend against' }
      ],
      failureModes: [
        {
          symptom: 'An API accepts a request with extra parameters the client never signed.',
          cause: 'The signature is hash(secret ‖ canonical_request) and the attacker extended it.',
          fix: 'HMAC. The hash is not the problem; publishing the state is.'
        },
        {
          symptom: 'Somebody "fixes" length extension by putting the secret at the end.',
          cause: 'That stops the extension and opens an offline collision attack instead.',
          fix: 'Do not invent a MAC. HMAC has a proof; the alternatives do not.'
        },
        {
          symptom: 'A system is declared safe because it uses SHA-256 rather than MD5.',
          cause: 'The digest was never the issue; the construction was.',
          fix: 'Ask which of the three resistances the use depends on, and whether the key is inside a proven construction.'
        },
        {
          symptom: 'A 128-bit digest is chosen for a deduplication or content-addressing scheme.',
          cause: 'Collision resistance is 64-bit there, which is reachable.',
          fix: 'Use at least 256 bits wherever an adversary can choose the inputs.'
        }
      ],
      inTheWild: [
        'Flickr and several other APIs, whose signature schemes were forgeable by length extension.',
        'HMAC in TLS, IPsec, JWT and almost every request-signing scheme that got it right.',
        'The 2017 SHAttered collision, which produced two PDFs with the same SHA-1 digest at about 2⁶³ work.',
        'Git’s migration towards SHA-256, driven by SHA-1 collisions rather than by any preimage attack.'
      ],
      sources: [
        { title: 'Bellare, Canetti and Krawczyk — Keying hash functions for message authentication (1996)', note: 'the HMAC construction and its proof from the compression function' },
        { title: 'RFC 2104 and RFC 4231', note: 'the HMAC specification and the test vectors this milestone checks against' },
        { title: 'Stevens, Bursztein, Karpman, Albertini and Markov — The first collision for full SHA-1 (2017)', note: 'a real collision at about 2⁶³, well under the birthday bound' },
        { title: 'Bertoni, Daemen, Peeters and Van Assche — Cryptographic sponge functions', note: 'why a sponge has no length-extension property and needs no HMAC wrapper' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));

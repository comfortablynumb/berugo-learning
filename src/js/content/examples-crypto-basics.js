/** Worked examples for threat models, randomness and hashing (M23.1-M23.3). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'threat-models-and-primitives': [
      {
        title: 'Pricing a security level: why 3 072-bit RSA equals a 256-bit curve',
        goal: 'Turn "128-bit security" from a slogan into the three key sizes it names.',
        setup: 'A design review asks for "128-bit security" on a key exchange, a signature and a ' +
          'bulk cipher. Read the equivalences off the demo’s strength table.',
        steps: [
          { do: 'Fix the definition: 128-bit security means the cheapest known attack costs ' +
              'about 2^128 operations.',
            why: 'The number is a claim about the attacker’s work, not about how many bits the ' +
              'key occupies.',
            work: '2^128 ≈ 3.4 × 10^38 operations' },
          { do: 'Read the symmetric column.',
            why: 'For a well-designed cipher the best attack is exhaustive key search, so the ' +
              'level and the key length coincide.',
            work: 'AES-128: 2^128 keys, so 128-bit security from 128 bits of key' },
          { do: 'Read the elliptic-curve column.',
            why: 'The best attack on a well-chosen curve is square-root in the group order, so ' +
              'the curve needs twice the bits of the level.',
            work: '256-bit curve → 2^(256/2) = 2^128 operations' },
          { do: 'Read the RSA column.',
            why: 'Factoring has subexponential algorithms, so the modulus must be far larger to ' +
              'reach the same work.',
            work: '3 072-bit modulus → about 2^128; a factor of 12 more bits than the curve' },
          { do: 'Check how the gap moves at the next level up.',
            why: 'The ratio is not constant, which is what makes key length a bad cross-family ' +
              'comparison.',
            work: '192-bit level: 7 680-bit RSA against a 384-bit curve — a factor of 20' }
        ],
        answer: 'At 128-bit security the three answers are AES-128, a 256-bit curve and a ' +
          '3 072-bit RSA modulus. The RSA-to-curve ratio is 12 at that level and 20 at 192-bit, ' +
          'so "2 048-bit RSA" and "256-bit ECC" are not comparable numbers.'
      },
      {
        title: 'The case that inverts it: a strong primitive with a fatal parameter',
        goal: 'Show that naming the algorithm settles nothing without the parameter.',
        setup: 'Two systems both report "AES-256-GCM". One uses a counter nonce; the other draws ' +
          'a random 96-bit nonce and sends 2^48 messages under one key.',
        steps: [
          { do: 'Price the cipher itself in both systems.',
            why: 'It is identical, so it cannot explain any difference in outcome.',
            work: 'AES-256: 2^256 key search in both, 128-bit security level in both' },
          { do: 'Compute the nonce-collision probability for the random-nonce system.',
            why: 'The birthday bound governs, and it grows with the square of the message count.',
            work: 'q = 2^48 messages, 96-bit nonce → probability ≈ 3.935 × 10^-1' },
          { do: 'State what a collision costs when it happens.',
            why: 'GCM does not degrade under nonce reuse; both plaintexts and the authentication ' +
              'key fall.',
            work: 'C1 XOR C2 = P1 XOR P2, and GHASH’s linearity yields the tag mask' },
          { do: 'Compute the same probability at the standard ceiling.',
            why: 'The recommended limit is chosen so the risk stays below 2^-32, not below one ' +
              'half.',
            work: 'q = 2^32 → probability ≈ 1.164 × 10^-10, about 2^-33' },
          { do: 'Compare the two systems on the only axis that differs.',
            why: 'The parameter, not the primitive, is the security control.',
            work: 'counter nonce: 0 collision risk; random nonce at 2^48: 39.35%' }
        ],
        answer: 'Both systems run AES-256-GCM at a 128-bit level, and one of them has a 39.35% ' +
          'chance of a total break. The primitive was never the variable; the nonce strategy and ' +
          'the message budget were.'
      }
    ],

    'randomness-for-cryptography': [
      {
        title: 'Recovering a generator’s state from one output',
        goal: 'Show that a statistical PRNG’s output IS its state, so prediction is exact.',
        setup: 'A glibc-style generator with a = 1 103 515 245, c = 12 345 and m = 2^31, seeded ' +
          'at 42. The attacker sees 2 outputs and predicts the next 8.',
        steps: [
          { do: 'Write down what the attacker knows.',
            why: 'The constants are published; only the seed was ever secret.',
            work: 'a = 1 103 515 245, c = 12 345, m = 2 147 483 648, and the observed outputs' },
          { do: 'Take the last observed value as the state.',
            why: 'The recurrence outputs its own state, so no solving is needed at all.',
            work: 'observations needed: 1' },
          { do: 'Apply the recurrence forward once.',
            why: 'This is the same computation the legitimate generator performs.',
            work: 'next = (1 103 515 245 · state + 12 345) mod 2 147 483 648 = 1 964 818 176' },
          { do: 'Repeat for the remaining predictions and compare with the actual stream.',
            why: 'The claim is exactness, so the comparison has to be value by value.',
            work: '8 predicted, 8 matched — including 1 500 480 256 and 1 617 229 568' },
          { do: 'Run the identical procedure against a keyed generator.',
            why: 'A CSPRNG’s output is not its state, so treating it as one produces nothing.',
            work: '0 of 8 predictions correct' }
        ],
        answer: 'One observation recovers the whole state and all 8 subsequent values are ' +
          'predicted exactly. The same attack against a CSPRNG gets 0 of 8.'
      },
      {
        title: 'The case that inverts it: the same numbers measure as excellent randomness',
        goal: 'Show that entropy of an observed stream says nothing about predictability.',
        setup: 'The same generator, 4 000 outputs. Measure the entropy of the high byte and of ' +
          'the low byte of each value.',
        steps: [
          { do: 'Take the high byte of each output and count the distinct values.',
            why: 'A uniform byte should reach all 256 values in 4 000 samples.',
            work: '256 distinct values out of 256 possible' },
          { do: 'Compute the entropy of that byte stream.',
            why: 'This is the quantity every statistical randomness test measures.',
            work: '7.9553 bits per byte, against a maximum of 8' },
          { do: 'Take the low byte of the SAME values and count the distinct ones.',
            why: 'Low bits of a linear congruential generator have short periods.',
            work: '17 distinct values in 4 000 samples' },
          { do: 'Compute its entropy.',
            why: 'The contrast shows the measurement depends on which bits you look at.',
            work: '1.2946 bits per byte' },
          { do: 'Compare both against the prediction result.',
            why: 'Predictability did not change between the two bytes; the measurement did.',
            work: 'both bytes: 100% predictable; entropy 7.9553 against 1.2946' }
        ],
        answer: 'The high byte measures 7.9553 of 8 bits and the low byte 1.2946, and both are ' +
          'completely predictable. Passing a distribution test is evidence about distribution ' +
          'and nothing else.'
      }
    ],

    'hash-functions-and-macs': [
      {
        title: 'Forging a tag for hash(secret ‖ message) without the secret',
        goal: 'Execute the length-extension attack and count what it costs.',
        setup: 'A service authenticates requests with SHA-256(secret ‖ message). The secret is ' +
          '16 bytes, the message is the 19-byte "user=bob&role=guest", and the attacker wants to ' +
          'append "&role=admin".',
        steps: [
          { do: 'Observe one legitimate request and its tag.',
            why: 'The digest is the hash state after the secret and message were absorbed.',
            work: 'observe 1 request and its 32-byte tag' },
          { do: 'Guess the secret length.',
            why: 'Padding depends only on the total length, so this is the only unknown needed.',
            work: '16 bytes; there are only a few dozen plausible values to try' },
          { do: 'Compute the glue: the padding the original message would have received.',
            why: 'SHA-256 pads to a multiple of 64 bytes with a 0x80 byte, zeros and a length ' +
              'field.',
            work: '16 + 19 = 35 bytes → pad to 64 → 29 glue bytes' },
          { do: 'Resume the hash from the published tag and hash the suffix.',
            why: 'The tag is the state, so it loads straight back in; only the byte offset needs ' +
              'correcting.',
            work: '8 state words restored, offset 64, then 11 suffix bytes' },
          { do: 'Submit message ‖ glue ‖ suffix with the new tag and check the verifier.',
            why: 'The claim is that the key holder’s own verifier accepts it.',
            work: 'accepted: yes, with 1 hash computation and 0 knowledge of the secret' }
        ],
        answer: 'A 29-byte glue and one hash computation produce a valid tag for a message the ' +
          'key holder never authorised. The secret was never learned and SHA-256 was never ' +
          'attacked.'
      },
      {
        title: 'The case that inverts it: the same attack against HMAC, and the birthday cost',
        goal: 'Show why HMAC is immune, and price the collision resistance the digest actually ' +
          'has.',
        setup: 'Same secret, same message, same suffix — but the tag is HMAC-SHA-256. Then ' +
          'compute the collision bound for the digest sizes in common use.',
        steps: [
          { do: 'Run the identical extension procedure against the HMAC tag.',
            why: 'The published value is the OUTER hash, over a digest the attacker cannot ' +
              'extend.',
            work: 'forged tag accepted: no — 0 of 1 attempts succeed' },
          { do: 'Compute the collision sample count for a 256-bit digest.',
            why: 'The birthday bound is roughly the square root of the output space.',
            work: 'sqrt(2 · ln 2 · 2^256) = 4.0065 × 10^38, about 2^128' },
          { do: 'Do the same for a 128-bit digest.',
            why: 'MD5-sized digests are where collisions became practical.',
            work: '2.1719 × 10^19, about 2^64' },
          { do: 'Do the same for a 160-bit digest and compare with the real SHA-1 attack.',
            why: 'The bound is an upper limit on cost; better attacks came in under it.',
            work: 'bound 1.4234 × 10^24 (2^80); the 2017 collision cost about 2^63' },
          { do: 'State which of the three resistances each number is about.',
            why: '"Is this hash broken?" is the wrong question.',
            work: 'preimage 2^160 for SHA-1 and never broken; collision 2^63 and broken' }
        ],
        answer: 'HMAC rejects the forgery that the naive construction accepts. Separately, ' +
          'SHA-256 gives 128-bit collision resistance at 4.0065 × 10^38 samples, and SHA-1’s ' +
          'collisions fell at 2^63 while its preimage resistance never did.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));

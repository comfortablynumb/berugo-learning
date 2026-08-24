/** Reference entries for password hashing, modes and AEAD (M23.4-M23.6). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'password-hashing': {
      summary: 'Six storage schemes priced at one verification budget, a memory sweep that ' +
        'divides the attacker by 128 at no defender cost, PBKDF2 tuned in the browser against a ' +
        '250 ms target, and the stored record set out with the rehash path most systems omit.',
      intuition: 'The parameter is the security control: the defender pays once per login and ' +
        'the attacker pays per guess, and memory hardness is what takes a GPU’s cores away.',
      formulation: {
        equations: [
          {
            label: 'The attacker’s rate, from the parameters',
            expr: 'guesses/s = min(cores, RAM ÷ memory-per-guess) × 1 000 ÷ (verify ms ÷ speedup)',
            readAs: 'The attacker runs as many parallel guesses as their cores or their memory ' +
              'allows, whichever is smaller, each taking the defender’s verification time ' +
              'divided by their hardware advantage.',
            terms: [
              { sym: 'the rig modelled', meaning: '4 096 cores, 16 GiB, 20× per-guess speedup' },
              { sym: 'budget', meaning: '250 ms, the defender’s cost for one login' },
              { sym: 'search space', meaning: '62⁸ = 2.1834 × 10¹⁴ for a random 8-character password' },
              { sym: 'what memory does', meaning: 'divides the parallelism once RAM binds before cores' }
            ]
          },
          {
            label: 'Six schemes at the same 250 ms budget',
            expr: 'scheme · memory each · effective cores · guesses/s · days for 8 characters',
            terms: [
              { sym: 'SHA-256, salted or not', meaning: '0 KiB · 4 096 · 4.096 × 10¹⁰ · 0.06' },
              { sym: 'PBKDF2-HMAC-SHA-256', meaning: '0 KiB · 4 096 · 3.277 × 10⁵ · 7 712.05' },
              { sym: 'bcrypt cost 12', meaning: '4 KiB · 4 096 · 3.277 × 10⁵ · 7 712.05 — memory does not bind' },
              { sym: 'scrypt N = 2¹⁵ and Argon2id 64 MiB', meaning: '512 and 256 cores · 4.096 × 10⁴ and 2.048 × 10⁴' }
            ]
          },
          {
            label: 'The memory sweep, identical defender cost throughout',
            expr: 'memory each · instances in 16 GiB · guesses/s · binding constraint',
            terms: [
              { sym: '4 MiB', meaning: '4 096 instances · 3.277 × 10⁵ · cores bind, so memory buys nothing' },
              { sym: '64 MiB', meaning: '256 · 2.048 × 10⁴ · memory binds' },
              { sym: '512 MiB', meaning: '32 · 2.560 × 10³ · memory binds' },
              { sym: 'total swing', meaning: '128× across the sweep, at 250 ms per login throughout' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The stored record is self-describing: algorithm, parameters and salt beside the key',
          why: 'Parameters must change, and an old record has to be recognisable as old.',
          breaks: 'Without it there is no upgrade path, and the cost chosen on launch day is the cost forever.'
        },
        {
          name: 'A successful login re-derives when the stored parameters are below policy',
          why: 'That is the only instant the system holds the plaintext password.',
          breaks: 'The demo verifies a record at 1 000 iterations against a policy of 30 000 and reports needsRehash: yes — which nothing acts on if the path does not exist.'
        },
        {
          name: 'The cost parameter is measured on production hardware, not copied',
          why: 'A quoted iteration count is a snapshot of somebody else’s machine at some point in the past.',
          breaks: 'The same constant is too slow on weak hardware and far too cheap on strong, and it decays every year.'
        },
        {
          name: 'Every password is salted with fresh per-user random bytes',
          why: 'One precomputed table otherwise covers the whole database, and equal passwords are visibly equal.',
          breaks: 'The demo derives one password under two salts and the keys differ — at zero cost per guess, which is a separate defence from slowness.'
        }
      ],
      complexity: [
        { operation: 'SHA-256 as a password store', average: '0.002 ms per verify', worst: '4.096 × 10¹⁰ guesses per second for the attacker' },
        { operation: 'PBKDF2-HMAC-SHA-256', average: 'iterations × one HMAC, negligible memory', worst: 'the weakest survivor: no memory hardness at all' },
        { operation: 'bcrypt', average: 'cost parameter is a power of two, 4 KiB working set', worst: '4 KiB does not constrain a 16 GiB rig' },
        { operation: 'scrypt', average: 'N × r × 128 bytes, sequential memory-hard', worst: 'parameters interact; getting r and p wrong undoes N' },
        { operation: 'Argon2id', average: 'memory, time and parallelism chosen against a budget', worst: 'a 4 MiB memory parameter is weaker than scrypt at 32 MiB' },
        { operation: 'credential stuffing', average: 'one guess per account', worst: 'unaffected by any cost parameter — needs rate limiting and MFA' }
      ],
      failureModes: [
        {
          symptom: 'A breach dump is cracked within hours despite "hashed" passwords.',
          cause: 'The hash was fast: a general-purpose digest, salted or not.',
          fix: 'Argon2id, scrypt or bcrypt at a measured cost. Salting alone changes nothing about the rate.'
        },
        {
          symptom: 'The cost parameter has not changed since the service launched.',
          cause: 'There is no rehash-on-login path, so records cannot be upgraded.',
          fix: 'Store the parameters with the hash and re-derive on successful verification when they are below policy.'
        },
        {
          symptom: 'Argon2 is deployed and the attacker is unaffected.',
          cause: 'The memory parameter is below the point where RAM binds before cores.',
          fix: 'Sweep it and find where the binding constraint changes; below that, memory hardness is decoration.'
        },
        {
          symptom: 'Accounts are taken over despite a strong password hash.',
          cause: 'Credential stuffing does not search, so cost parameters do not apply.',
          fix: 'Rate limiting, breach-list checks and multi-factor authentication. Different attack, different control.'
        }
      ],
      inTheWild: [
        'The Password Hashing Competition, which selected Argon2 in 2015 with memory hardness as the criterion.',
        'OWASP’s storage cheat sheet, which states parameters as a measured verification time rather than a constant.',
        'Rehash-on-login in Django, Rails and PHP’s password_needs_rehash, which is where the upgrade path exists when it exists.',
        'Have I Been Pwned’s k-anonymity range API, which is how breach-list checking is done without sending the password.'
      ],
      sources: [
        { title: 'Biryukov, Dinu and Khovratovich — Argon2 (2015)', note: 'the design, the memory-hardness argument and the parameter guidance' },
        { title: 'Percival — Stronger key derivation via sequential memory-hard functions (2009)', note: 'scrypt, and the economics of memory against custom hardware' },
        { title: 'Provos and Mazières — A future-adaptable password scheme (1999)', note: 'bcrypt, and the idea of a cost parameter that rises with hardware' },
        { title: 'RFC 6070 and RFC 8018', note: 'PBKDF2 and the test vectors this milestone checks against' }
      ]
    },

    'symmetric-encryption': {
      summary: 'An image encrypted three ways with the distinct-block count reported for each, a ' +
        'padding oracle that recovers a 30-byte message in 2 749 yes-or-no answers, and a CTR ' +
        'ciphertext edited into a different sentence with five bytes and no key.',
      intuition: 'A block cipher is a keyed permutation with no notion of a message; everything ' +
        'that goes wrong here is the mode.',
      formulation: {
        equations: [
          {
            label: 'The three modes',
            expr: 'ECB: E_k(Pᵢ) · CBC: E_k(Pᵢ ⊕ Cᵢ₋₁) · CTR: Pᵢ ⊕ E_k(nonce ‖ i)',
            readAs: 'ECB encrypts each block alone; CBC encrypts each block after ' +
              'exclusive-ORing it with the previous ciphertext; CTR encrypts a counter and ' +
              'exclusive-ORs the result with the plaintext.',
            terms: [
              { sym: 'ECB needs', meaning: 'nothing, and leaks equality of plaintext blocks' },
              { sym: 'CBC needs', meaning: 'an unpredictable IV, and padding — which is where the oracle lives' },
              { sym: 'CTR needs', meaning: 'a never-repeated counter per key, and no padding at all' },
              { sym: 'none of them provides', meaning: 'integrity; all three are malleable' }
            ]
          },
          {
            label: 'The 48 × 48 image, 144 blocks',
            expr: 'mode · distinct ciphertext blocks',
            terms: [
              { sym: 'plaintext', meaning: '25 distinct blocks — large uniform regions' },
              { sym: 'ECB', meaning: '26 distinct — tracks the plaintext, and the shape survives' },
              { sym: 'CBC', meaning: '145 distinct, one per position including the padding block' },
              { sym: 'CTR', meaning: '144 distinct, no padding block' }
            ]
          },
          {
            label: 'The padding oracle on a 30-byte message',
            expr: 'queries · per byte · recovered · key bits guessed',
            terms: [
              { sym: 'total queries', meaning: '2 749 across 2 blocks, about 1 375 each' },
              { sym: 'per byte', meaning: '85.9 on average, bounded by 256 and never by key size' },
              { sym: 'recovered', meaning: '30 of 30 plaintext bytes' },
              { sym: 'attacks on AES', meaning: '0 — the cipher behaves exactly as designed throughout' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Every rejection path returns one indistinguishable failure',
          why: 'A padding oracle needs only that "bad padding" differs from "bad MAC" in a message, a status code or a timing.',
          breaks: 'One distinguishable bit is worth the whole plaintext at about 86 queries per byte.'
        },
        {
          name: 'A counter or nonce value is never reused under one key',
          why: 'The keystream depends on key and counter alone, so a repeat publishes the XOR of both plaintexts.',
          breaks: 'There is no partial failure: for messages with known structure, the XOR is both messages.'
        },
        {
          name: 'The IV for CBC is unpredictable, not merely unique',
          why: 'An attacker who knows the next IV can choose plaintext that cancels it.',
          breaks: 'That is the BEAST attack against TLS, and it needed only predictability rather than reuse.'
        },
        {
          name: 'A raw mode is never exposed to application code',
          why: 'ECB, CBC and CTR are components of authenticated modes rather than choices.',
          breaks: 'Every failure demonstrated in this section requires an unauthenticated ciphertext to exist somewhere.'
        }
      ],
      complexity: [
        { operation: 'AES block encryption', average: '10, 12 or 14 rounds by key size', worst: 'hardware accelerated on most modern CPUs' },
        { operation: 'ECB', average: 'parallel both ways, no state', worst: 'leaks every repetition in the plaintext' },
        { operation: 'CBC encryption', average: 'sequential — each block needs the previous ciphertext', worst: 'decryption is parallel, encryption is not' },
        { operation: 'CTR', average: 'parallel both ways, no padding, seekable', worst: 'total failure on counter reuse' },
        { operation: 'padding oracle', average: '≤ 256 queries per byte, linear in message length', worst: 'a kilobyte message costs a few hundred thousand requests' },
        { operation: 'bit-flipping a CTR ciphertext', average: 'one XOR per byte changed, 0 queries', worst: 'requires only knowledge of the message format' }
      ],
      failureModes: [
        {
          symptom: 'Encrypted records show visible structure or repeated ciphertext.',
          cause: 'ECB, which maps equal plaintext blocks to equal ciphertext blocks.',
          fix: 'An AEAD. The picture in the demo is the standard demonstration and the block count is the measurement.'
        },
        {
          symptom: 'An attacker decrypts traffic by submitting modified ciphertexts.',
          cause: 'A padding oracle: the service distinguishes a padding failure from another failure.',
          fix: 'Authenticate first, so the ciphertext is rejected before the decrypt path runs at all.'
        },
        {
          symptom: 'A field inside an encrypted token changed value without the key.',
          cause: 'The mode is malleable, and XOR is linear.',
          fix: 'A tag the attacker cannot recompute. Encryption is not integrity.'
        },
        {
          symptom: 'Two messages under one key turn out to be readable from each other.',
          cause: 'A repeated IV or counter, often from a restart, a clone or a second writer.',
          fix: 'A counter owned by one writer, or a 192-bit random nonce, or a misuse-resistant mode.'
        }
      ],
      inTheWild: [
        'The "ECB penguin", which is the same measurement this demo makes with a distinct-block count attached.',
        'Vaudenay’s padding oracle, which has been rediscovered in ASP.NET, Java, XML encryption and JSON web tokens.',
        'The BEAST attack on TLS 1.0, which needed only a predictable IV rather than a repeated one.',
        'Disk encryption, where XTS exists because a mode has to be seekable and length-preserving at once.'
      ],
      sources: [
        { title: 'FIPS 197 — Advanced Encryption Standard', note: 'the cipher itself and the vectors this milestone checks against' },
        { title: 'NIST SP 800-38A — Recommendation for Block Cipher Modes of Operation', note: 'ECB, CBC, CFB, OFB and CTR, with the IV requirements stated' },
        { title: 'Vaudenay — Security flaws induced by CBC padding (2002)', note: 'the padding oracle, and why one bit of feedback is enough' },
        { title: 'Bernstein — ChaCha, a variant of Salsa20', note: 'a stream cipher fast without AES hardware, and its nonce requirements' }
      ]
    },

    'authenticated-encryption': {
      summary: 'A repeated nonce that gives up a 15-byte plaintext in full and then a tag the ' +
        'receiver accepts, five tamper tests run against the chosen suite, and the birthday ' +
        'bound on a 96-bit nonce computed across traffic volumes.',
      intuition: 'AEAD is encrypt-then-MAC as a single interface, so the order cannot be got ' +
        'wrong and unverified bytes never reach the application.',
      formulation: {
        equations: [
          {
            label: 'The interface',
            expr: 'seal(key, nonce, plaintext, associated) → (ciphertext, tag); open → plaintext OR failure',
            terms: [
              { sym: 'nonce', meaning: 'public, and never repeated under one key' },
              { sym: 'associated data', meaning: 'authenticated but not encrypted — headers, types, versions' },
              { sym: 'the return', meaning: 'plaintext or a failure, never both and never a partial result' },
              { sym: 'why that matters', meaning: 'it removes the code path every attack in the previous section needed' }
            ]
          },
          {
            label: 'Nonce reuse under AES-GCM',
            expr: 'C₁ ⊕ C₂ = P₁ ⊕ P₂ · mask = tag₁ ⊕ GHASH(H, A, C₁) · tag′ = GHASH(H, A, C′) ⊕ mask',
            readAs: 'The two ciphertexts exclusive-ORed give the two plaintexts exclusive-ORed; ' +
              'one known ciphertext-and-tag pair gives the additive tag mask; and from there any ' +
              'ciphertext can be given a tag the receiver accepts.',
            terms: [
              { sym: 'plaintext recovered', meaning: '15 of 15 bytes, from one known plaintext' },
              { sym: 'H', meaning: 'the GHASH key, E_k(0¹²⁸), identical for every message under the key' },
              { sym: 'why the forgery works', meaning: 'GHASH is a polynomial evaluation and therefore linear' },
              { sym: 'result', meaning: 'confidentiality and authenticity fall together from one repeat' }
            ]
          },
          {
            label: 'Random 96-bit nonces, collision probability by volume',
            expr: 'probability ≈ q² ÷ 2⁹⁷',
            readAs: 'The chance of a nonce collision grows with the square of the message count ' +
              'divided by two to the ninety-seventh.',
            terms: [
              { sym: '2³² messages', meaning: '1.164 × 10⁻¹⁰, about 2⁻³³ — the standard ceiling' },
              { sym: '2⁴⁰ messages', meaning: '7.629 × 10⁻⁶' },
              { sym: '2⁴⁸ messages', meaning: '3.935 × 10⁻¹ — more likely than a coin landing on its edge, by a lot' },
              { sym: 'a counter nonce', meaning: '0, with no arithmetic required at all' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The tag is verified before any plaintext is produced',
          why: 'A forged ciphertext must never reach the decryption code.',
          breaks: 'MAC-then-encrypt has to decrypt to find the tag, which is the padding-oracle shape in TLS 1.2.'
        },
        {
          name: 'Headers a middlebox reads go in the associated-data channel',
          why: 'They must be visible and unchangeable, which is exactly what the channel provides.',
          breaks: 'The demo changes only the associated data and the AEAD rejects it; omit them and a valid ciphertext replays under a different header.'
        },
        {
          name: 'A message budget per key is written down when nonces are random',
          why: 'The birthday bound gives a ceiling around 2³² messages that nothing signals.',
          breaks: 'At 2⁴⁸ messages the collision probability is 39.35% and the failure when it happens is total.'
        }
      ],
      complexity: [
        { operation: 'AES-GCM', average: 'CTR plus GHASH, both hardware accelerated', worst: 'nonce reuse recovers plaintexts and the authentication key' },
        { operation: 'ChaCha20-Poly1305', average: 'fast without AES hardware, 96-bit nonce', worst: 'identical nonce-reuse failure for confidentiality' },
        { operation: 'XChaCha20-Poly1305', average: '192-bit nonce, random nonces are safe at any realistic volume', worst: 'slightly larger nonce on the wire' },
        { operation: 'AES-GCM-SIV', average: 'two passes over the plaintext', worst: 'cannot stream; a repeat leaks only message equality' },
        { operation: 'encrypt-then-MAC by hand', average: 'correct if the tag covers IV and ciphertext and the compare is constant time', worst: 'three ways to get it wrong that an AEAD does not expose' },
        { operation: 'tag forgery without the key', average: '2⁻¹²⁸ per attempt', worst: 'certain, once a repeated nonce yields the authentication key' }
      ],
      failureModes: [
        {
          symptom: 'Two messages under one key turn out to reveal each other.',
          cause: 'A repeated nonce, usually from a restart, a clone or a second writer sharing the key.',
          fix: 'A counter owned by one writer, XChaCha20’s 192-bit nonce, or a misuse-resistant mode.'
        },
        {
          symptom: 'An attacker produces ciphertexts the receiver accepts.',
          cause: 'GCM’s authentication key was recovered from a nonce repeat; GHASH is linear.',
          fix: 'Rotate the key immediately. A nonce repeat is not a leak of one message, it is a key compromise.'
        },
        {
          symptom: 'A valid ciphertext is replayed under a different header and accepted.',
          cause: 'The header was not included in the associated data.',
          fix: 'Bind every field the receiver acts on into the AEAD call.'
        },
        {
          symptom: 'A hand-rolled encrypt-then-MAC leaks through its tag comparison.',
          cause: 'The comparison exits early, which is a timing oracle on the tag.',
          fix: 'Use the AEAD interface, which does not expose the comparison at all.'
        }
      ],
      inTheWild: [
        'TLS 1.3, which removed every non-AEAD cipher suite rather than documenting the right order.',
        'WireGuard and the Noise protocol framework, both built on ChaCha20-Poly1305 with counter nonces.',
        'Joux’s forbidden attack on GCM, which is the authentication-key recovery this demo executes.',
        'AWS’s and Google’s envelope-encryption SDKs, which cap messages per data key rather than trusting random nonces.'
      ],
      sources: [
        { title: 'Rogaway — Authenticated encryption with associated data (2002)', note: 'the AEAD interface and why the associated-data channel belongs in it' },
        { title: 'Joux — Authentication failures in NIST version of GCM', note: 'the forbidden attack: nonce reuse recovers the authentication key' },
        { title: 'RFC 8439 — ChaCha20 and Poly1305 for IETF protocols', note: 'the construction and the test vectors this milestone checks against' },
        { title: 'Gueron, Langley and Lindell — AES-GCM-SIV (RFC 8452)', note: 'misuse resistance, and what a repeated nonce costs when it is designed for' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));

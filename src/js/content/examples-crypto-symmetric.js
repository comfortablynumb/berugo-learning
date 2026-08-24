/** Worked examples for password hashing, modes and AEAD (M23.4-M23.6). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'password-hashing': [
      {
        title: 'Pricing an attacker at a fixed verification budget',
        goal: 'Turn a storage choice into the attacker’s guesses per second.',
        setup: 'A 250 ms verification budget, an attacker with 4 096 cores and 16 GiB of memory ' +
          'running 20× faster per guess than the defender’s implementation.',
        steps: [
          { do: 'Price unsalted SHA-256 first.',
            why: 'It is the store people reach for, and it costs almost nothing per guess.',
            work: '0.002 ms per verify → 4 096 cores × 1 000 / (0.002 / 20) = 4.096 × 10^10 ' +
              'guesses per second' },
          { do: 'Convert that to a time for a random 8-character password.',
            why: 'A rate is only meaningful against a search space.',
            work: '62^8 = 2.183 × 10^14 candidates / 4.096 × 10^10 / 86 400 = 0.06 days' },
          { do: 'Price PBKDF2 at the same budget.',
            why: 'The only change is time per guess; memory is still negligible.',
            work: '250 ms → 3.277 × 10^5 guesses per second → 7 712.05 days' },
          { do: 'Price Argon2id with a 64 MiB memory parameter.',
            why: 'Memory divides the attacker’s parallelism: 16 GiB / 64 MiB = 256 instances.',
            work: '256 effective cores → 2.048 × 10^4 guesses per second → 123 392.80 days' },
          { do: 'Compare the two extremes at the identical defender cost.',
            why: 'This is the whole argument for a slow, memory-hard hash.',
            work: '4.096 × 10^10 against 2.048 × 10^4 — a factor of 2 000 000' }
        ],
        answer: 'At the same 250 ms budget the attacker runs 4.096 × 10^10 guesses per second ' +
          'against unsalted SHA-256 and 2.048 × 10^4 against Argon2id at 64 MiB, turning 0.06 ' +
          'days into 123 392.80.'
      },
      {
        title: 'The case that inverts it: the memory parameter, not the algorithm',
        goal: 'Show that the cost parameter spans more range than the choice of algorithm.',
        setup: 'The same 250 ms budget and the same 4 096-core, 16 GiB rig. Sweep the memory ' +
          'parameter from 4 MiB to 512 MiB.',
        steps: [
          { do: 'Start at 4 MiB and find the binding constraint.',
            why: 'The attacker is limited by whichever runs out first, cores or memory.',
            work: '16 GiB / 4 MiB = 4 096 instances, which equals the core count — cores bind' },
          { do: 'Read the guess rate there.',
            why: 'At this setting the memory parameter is buying nothing.',
            work: '3.277 × 10^5 guesses per second — identical to PBKDF2 with no memory at all' },
          { do: 'Move to 64 MiB.',
            why: 'Once memory binds, every doubling halves the attacker.',
            work: '16 GiB / 64 MiB = 256 instances → 2.048 × 10^4 guesses per second' },
          { do: 'Move to 512 MiB.',
            why: 'The defender still pays 250 ms; only the attacker’s parallelism changed.',
            work: '16 GiB / 512 MiB = 32 instances → 2.560 × 10^3 guesses per second' },
          { do: 'Compute the total swing across the sweep.',
            why: 'The comparison is against the algorithm choice, which spans far less.',
            work: '3.277 × 10^5 / 2.560 × 10^3 = 128× — at unchanged defender cost' }
        ],
        answer: 'Sweeping one parameter from 4 MiB to 512 MiB divides the attacker by 128 and ' +
          'costs the defender nothing, and below 4 MiB it buys nothing at all because cores ' +
          'bind first. "We use Argon2" is not an answer to "how expensive is a guess".'
      }
    ],

    'symmetric-encryption': [
      {
        title: 'Decrypting a CBC message from one bit of feedback',
        goal: 'Count what a padding oracle actually costs.',
        setup: 'A 30-byte message encrypted with AES-128-CBC, and a service that distinguishes ' +
          '"invalid padding" from any other outcome.',
        steps: [
          { do: 'Count the ciphertext blocks.',
            why: 'The attack runs block by block, using the previous block as the forgery target.',
            work: '30 bytes → 2 blocks of 16, after PKCS#7 padding' },
          { do: 'Attack the last byte of a block by forging padding of length 1.',
            why: 'At most 256 values exist, so the search per byte is bounded regardless of key ' +
              'size.',
            work: '≤ 256 queries; the demo averages 85.9 per byte over the whole message' },
          { do: 'Use the recovered byte to forge padding of length 2, then 3, and so on.',
            why: 'Each recovered intermediate byte is needed to construct the next forgery.',
            work: '16 positions per block, each ≤ 256 queries' },
          { do: 'Total the queries across both blocks.',
            why: 'The cost is linear in message length, not exponential in anything.',
            work: '2 749 queries total, about 1 375 per block' },
          { do: 'Check what was recovered and what was never touched.',
            why: 'The point is that no cryptography was attacked.',
            work: '30 of 30 plaintext bytes; 0 key bits guessed; 0 attacks on AES' }
        ],
        answer: '2 749 yes-or-no answers recover all 30 plaintext bytes, at about 86 queries per ' +
          'byte. A kilobyte message would cost a few hundred thousand requests.'
      },
      {
        title: 'The case that inverts it: no oracle needed, just five edited bytes',
        goal: 'Show that malleability is a separate failure from confidentiality.',
        setup: 'The message "user=bob;role=guest" encrypted with AES-128-CTR. The attacker never ' +
          'sees the plaintext but knows the format.',
        steps: [
          { do: 'Write down what CTR does.',
            why: 'The plaintext never enters the cipher; it is XORed with a keystream.',
            work: 'C[i] = P[i] XOR S[i] for all 19 bytes, with S from key and counter alone' },
          { do: 'Compute the edit the attacker wants, character by character.',
            why: 'XOR is linear, so the edit to the ciphertext equals the edit to the plaintext.',
            work: '"guest" XOR "admin" over 5 positions' },
          { do: 'Apply it to the ciphertext bytes at those positions.',
            why: 'No key is involved and nothing is decrypted along the way.',
            work: '5 ciphertext bytes changed out of 19' },
          { do: 'Decrypt normally and read the result.',
            why: 'The recipient has no way to tell this from an authentic message.',
            work: 'delivered: "user=bob;role=admin" — 19 bytes, 5 of them changed' },
          { do: 'Compare the query cost with the padding oracle.',
            why: 'Malleability needs no oracle and no interaction at all.',
            work: '0 oracle queries against 2 749' }
        ],
        answer: 'Five edited bytes and zero queries change what the recipient reads. Encryption ' +
          'without integrity is not a weaker protection — it leaves a different door open, and ' +
          'the fix is a tag rather than a stronger cipher.'
      }
    ],

    'authenticated-encryption': [
      {
        title: 'One repeated nonce, two plaintexts and a forged tag',
        goal: 'Follow the arithmetic from a nonce repeat to an accepted forgery.',
        setup: 'Two 15-byte messages encrypted under one AES-GCM key with the same nonce. The ' +
          'attacker knows the first plaintext.',
        steps: [
          { do: 'XOR the two ciphertexts.',
            why: 'The keystream is a function of key and nonce alone, so it is identical and ' +
              'cancels.',
            work: 'C1 XOR C2 = P1 XOR P2, over all 15 bytes' },
          { do: 'XOR in the known plaintext.',
            why: 'What remains is the other message, exactly.',
            work: '(P1 XOR P2) XOR P1 = P2 → 15 of 15 bytes recovered' },
          { do: 'Take GHASH’s authentication key H.',
            why: 'It is the encryption of a zero block under the same key, so it is the same for ' +
              'every message.',
            work: 'H = E_k(0^128), a single 16-byte value' },
          { do: 'Derive the tag mask from the known pair.',
            why: 'GHASH is linear, so one (ciphertext, tag) pair determines the additive mask.',
            work: 'mask = tag1 XOR GHASH(H, A, C1)' },
          { do: 'Tag an edited ciphertext and submit it.',
            why: 'The claim is that the receiver accepts it, so the check must be run.',
            work: 'tag2 = GHASH(H, A, C2) XOR mask → accepted' }
        ],
        answer: 'The repeat gives up the second plaintext in full and then a tag for a ciphertext ' +
          'the sender never produced. For GCM, nonce reuse turns an eavesdropper into a forger.'
      },
      {
        title: 'The case that inverts it: how many messages a random nonce survives',
        goal: 'Price the birthday bound on a 96-bit nonce and find where the ceiling comes from.',
        setup: 'Random 96-bit nonces drawn per message under one key. Compute the collision ' +
          'probability at four traffic volumes.',
        steps: [
          { do: 'Write the bound.',
            why: 'Collisions follow the birthday formula, growing with the square of the count.',
            work: 'probability ≈ q^2 / 2^97 for q messages' },
          { do: 'Evaluate at 2^32 messages.',
            why: 'This is the standard recommended ceiling.',
            work: '1.164 × 10^-10, which is about 2^-33' },
          { do: 'Note why the ceiling sits there.',
            why: 'The target is a probability bound, not "more likely than not".',
            work: 'the limit keeps the risk below 2^-32, not below 0.5' },
          { do: 'Evaluate at 2^40 and 2^48 messages.',
            why: 'Squared growth means the number stops looking small quickly.',
            work: '7.629 × 10^-6 at 2^40; 3.935 × 10^-1 at 2^48' },
          { do: 'Compare a counter nonce on the same axis.',
            why: 'A counter removes the analysis rather than improving the number.',
            work: 'collision probability 0 while the counter never resets' }
        ],
        answer: 'At 2^32 messages the risk is 1.164 × 10^-10 and at 2^48 it is 39.35%. The ' +
          'ceiling exists because the risk quadruples with every doubling of traffic, and nothing ' +
          'signals the crossing.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));

/** Concepts for password hashing, modes and AEAD (M23.4-M23.6). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'password-hashing': [
      {
        term: 'A password hash is deliberately slow',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["SHA-256: billions per second"] --> B["exactly what you want<br/>for a checksum"]',
            '    A --> C["and exactly what an attacker<br/>wants for a password file"]',
            '    D["Argon2 or bcrypt: tuned to take<br/>a noticeable fraction of a second"] --> E["one login is unaffected"]',
            '    E --> F["and a billion guesses becomes<br/>thirty years"]'
          ].join('\n'),
          caption: 'Speed is a virtue in every other hash and a defect here. The cost is paid once per login and multiplied by every guess an attacker makes.'
        },
        plain: 'Being fast is what makes SHA-256 a good hash and a catastrophic password store.',
        formal: 'a password store is priced by the attacker’s guesses per second, so the defender buys security by spending time',
        detail: 'Every other use of a hash wants it fast, and this one wants the opposite, which ' +
          'inverts the instinct that makes engineers reach for SHA-256. The defender pays the ' +
          'cost once per login and can afford a quarter of a second; the attacker pays it per ' +
          'guess and is trying billions. That asymmetry is the entire mechanism, and it means the ' +
          'security of the store is measured in the attacker\'s rate rather than in any property ' +
          'of the algorithm.',
        example: 'At the same 250 ms budget the demo prices unsalted SHA-256 at 4.096 × 10¹⁰ ' +
          'guesses per second and Argon2id at 64 MiB at 2.048 × 10⁴.'
      },
      {
        term: 'A salt is not a secret and does not need to be',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["no salt: identical passwords<br/>give identical hashes"] --> B["crack one, crack them all"]',
            '    B --> C["and a precomputed table<br/>works on every database"]',
            '    D["a unique salt per user,<br/>stored in the clear"] --> E["every stored hash becomes<br/>a separate problem"]',
            '    E --> F["and no table can be built in advance"]'
          ].join('\n'),
          caption: 'Its job is not to hide anything. It is to stop one unit of work from being reused against a second account, which is what makes bulk cracking economic.'
        },
        plain: 'Its job is to make each stored hash a separate problem.',
        formal: 'a per-user random salt stops one precomputed table covering the database and hides equal passwords',
        detail: 'Storing the salt in plain text alongside the hash is correct and expected — it ' +
          'is not a second key. Without one, a single precomputed table attacks every account at ' +
          'once and two users with the same password have visibly the same stored value, which ' +
          'leaks membership of a leak list. With one, each account is its own search. Note what ' +
          'it does NOT do: it costs the attacker nothing per guess, so a salted fast hash is ' +
          'still a fast hash.',
        example: 'The demo derives one password under two salts and reports the keys identical: ' +
          'no. Both rows still run at 4.096 × 10¹⁰ guesses per second.'
      },
      {
        term: 'A pepper is a secret, and it lives outside the database',
        plain: 'An application-held key mixed into the derivation.',
        formal: 'a pepper defends exactly one threat: database exfiltration without application compromise',
        detail: 'Because it is not stored with the hash, an attacker holding a dumped table ' +
          'cannot verify guesses at all — they need the application key too. That is a real ' +
          'defence against the most common breach shape, and it is narrow: an attacker who ' +
          'reaches the application gets both. It also complicates rotation, since changing the ' +
          'pepper invalidates every stored hash unless the scheme is designed for it, so it is a ' +
          'considered choice rather than a default.',
        example: 'The demo lists it in the record table with its threat named, and marks it as ' +
          'not modelled by the cost calculator.'
      },
      {
        term: 'Memory hardness is what breaks GPUs specifically',
        plain: 'A GPU has thousands of cores and little memory each.',
        formal: 'an attacker with fixed RAM runs floor(RAM / memory-per-guess) guesses at once, so the memory parameter divides their parallelism',
        detail: 'Raising the memory cost is nearly free for a server verifying one login at a ' +
          'time and ruinous for a rig verifying thousands at once, because the rig\'s fixed RAM ' +
          'divides by your parameter. Below a threshold the attacker is limited by cores and the ' +
          'parameter buys nothing; above it every doubling halves them. That threshold is why ' +
          'bcrypt\'s 4 KiB, which was generous in 1999, does not constrain a modern rig at all ' +
          'while scrypt and Argon2 at tens of megabytes do.',
        example: 'The demo’s sweep runs 4 096 parallel guesses at 4 MiB and 32 at 512 MiB, a ' +
          'factor of 128, at identical defender cost.'
      },
      {
        term: 'The parameter is the security control, not the algorithm',
        plain: '"We use bcrypt" is not an answer to "how expensive is a guess".',
        formal: 'bcrypt at cost 4 and cost 12 differ by a factor of 256 and are both bcrypt',
        detail: 'Naming the algorithm settles almost nothing, because the cost parameter spans ' +
          'orders of magnitude within every one of them and a badly parameterised Argon2 is ' +
          'weaker than a well parameterised scrypt. The correct parameter is whatever exhausts ' +
          'your verification budget on your production hardware today, which means it is a ' +
          'measurement rather than a constant, and it changes as hardware improves.',
        example: 'The demo measures PBKDF2 in this browser and reports the iteration count that ' +
          'fills 250 ms here, which differs by machine.'
      },
      {
        term: 'Tune against a measured budget, not a blog post',
        plain: 'The right number is the one that fills your verification time on your hardware.',
        formal: 'measure milliseconds per iteration, then set iterations = budget / per-iteration',
        detail: 'A quoted iteration count is a snapshot of somebody else\'s hardware at some ' +
          'point in the past, and using it means your parameter drifts away from your budget in ' +
          'both directions — too slow on weak hardware, far too cheap on strong. Measuring takes ' +
          'a few lines: run a sample, divide, scale. The budget itself is a product decision ' +
          'about how long a login may take, typically a couple of hundred milliseconds, and it ' +
          'has to account for concurrent logins as well.',
        example: 'The demo runs 2 000 PBKDF2 iterations, divides, and reports both the ' +
          'per-iteration microseconds and the iteration count for a 250 ms budget.'
      },
      {
        term: 'Rehash on successful login, or the parameters freeze',
        plain: 'The only moment you hold the plaintext is a successful verification.',
        formal: 'if stored parameters are below current policy, re-derive at the current cost and replace the record',
        detail: 'Costs must rise as hardware improves, and the stored hash cannot be upgraded ' +
          'without the password — which the system holds for exactly one instant, during a ' +
          'successful login. A store without that path is frozen at whatever it launched with, ' +
          'and gets weaker every year with nobody changing a line. Building it requires the ' +
          'record to be self-describing: algorithm, parameters and salt stored alongside the key, ' +
          'so an old record can be recognised and replaced.',
        example: 'The demo verifies a record at 1 000 iterations against a policy of 30 000 and ' +
          'reports needsRehash: yes.'
      },
      {
        term: 'Credential stuffing ignores all of this',
        plain: 'A password from a leak list falls at any cost parameter.',
        formal: 'reused credentials cost the attacker one guess per account, so the hash cost is irrelevant',
        detail: 'The cost parameter prices a search over a space of candidates, and a stuffing ' +
          'attack does not search — it tries the password the user already used somewhere else, ' +
          'once. That makes rate limiting, breach-list checking and multi-factor authentication ' +
          'the controls that matter for the most common real attack, and it is worth stating ' +
          'plainly so that tuning Argon2 is not mistaken for a complete answer to account ' +
          'takeover.',
        example: 'The demo’s verdict note says it directly: a password from a leak list falls ' +
          'immediately regardless of the setting.'
      }
    ],

    'symmetric-encryption': [
      {
        term: 'A block cipher is a keyed permutation and nothing more',
        plain: 'AES maps 16 bytes to 16 bytes reversibly under a key.',
        formal: 'AES is a bijection on 128-bit blocks for each key; it has no notion of a message, a length or an order',
        detail: 'Everything about encrypting real data — how a long message is split, how ' +
          'position is made to matter, how the last partial block is handled — is the MODE rather ' +
          'than the cipher. That is why every failure in this section is a mode failure and none ' +
          'is an attack on AES. It also explains the shape of the standards: FIPS 197 specifies ' +
          'one block transformation, and a separate document specifies each way of using it.',
        example: 'The demo encrypts the same 2 304-byte image three ways with one cipher and one ' +
          'key, and the three results differ entirely.'
      },
      {
        term: 'ECB preserves structure, visibly',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["two identical plaintext blocks"] --> B["encrypted independently,<br/>with the same key"]',
            '    B --> C["two identical ciphertext blocks"]',
            '    C --> D["so every repetition in the input<br/>is a repetition in the output"]',
            '    D --> E["the shape of the data survives<br/>encryption completely"]'
          ].join('\n'),
          caption: 'Nothing is decrypted and the picture is still recognisable. It is the clearest demonstration that a strong cipher used the wrong way protects nothing.'
        },
        plain: 'Identical plaintext blocks give identical ciphertext blocks.',
        formal: 'ECB is a per-block function with no position input, so equal blocks map to equal blocks',
        detail: 'The consequence is that any repetition in the plaintext survives encryption, ' +
          'which for structured data — an image, a database column, a fixed-format record — ' +
          'leaks the structure itself. Counting distinct ciphertext blocks quantifies it: a mode ' +
          'that hid the structure would produce one distinct block per position, and ECB produces ' +
          'as many as the plaintext had. The picture is the famous demonstration and the count is ' +
          'the measurement behind it.',
        example: 'The demo’s 144-block image has 25 distinct plaintext blocks and 26 distinct ECB ' +
          'ciphertext blocks; CBC gives 145.'
      },
      {
        term: 'CBC needs an unpredictable IV and adds padding',
        plain: 'Each block is XORed with the previous ciphertext before encryption.',
        formal: 'Cᵢ = E_k(Pᵢ ⊕ Cᵢ₋₁), with C₀ the IV; a fixed IV leaks whether two messages share a prefix',
        readAs: 'Each ciphertext block is the encryption of the plaintext block exclusive-ORed ' +
          'with the previous ciphertext block, and the initialisation vector plays the part of ' +
          'the block before the first one.',
        detail: 'Chaining makes position matter, which removes the ECB leak, at the cost of being ' +
          'sequential to encrypt and needing the message padded to a whole number of blocks. The ' +
          'IV requirement is stronger than "unique": a PREDICTABLE IV allowed the BEAST attack ' +
          'against TLS, because an attacker who knows the next IV can choose plaintext that ' +
          'cancels it. The padding is where the oracle lives.',
        example: 'The demo’s CBC panel is noise, and its 144-block image becomes 145 ciphertext ' +
          'blocks because of the padding block.'
      },
      {
        term: 'CTR turns a block cipher into a stream cipher',
        plain: 'Encrypt a counter to make a keystream, then XOR.',
        formal: 'Cᵢ = Pᵢ ⊕ E_k(nonce ‖ i); parallel in both directions and needing no padding',
        readAs: 'Each ciphertext block is the plaintext block exclusive-ORed with the encryption ' +
          'of a counter block built from the nonce and the block index, so the plaintext is never ' +
          'fed into the cipher at all.',
        detail: 'Because the plaintext never enters the cipher, encryption and decryption are the ' +
          'same operation, both are parallel, and the message needs no padding — which removes ' +
          'the padding oracle entirely. The price is absolute: the keystream is a function of the ' +
          'key and the counter alone, so encrypting two messages at the same counter value under ' +
          'one key publishes the XOR of the two plaintexts. There is no partial failure here.',
        example: 'The demo’s CTR panel is noise with no padding block, and its modes table rates ' +
          'counter reuse as total and immediate.'
      },
      {
        term: 'A padding oracle turns one bit into full decryption',
        plain: 'An attacker who can tell "bad padding" from anything else reads the message.',
        formal: 'forge the previous block so the target decrypts to valid padding; each byte costs at most 256 queries',
        detail: 'The attacker learns one byte of the block\'s intermediate value per position by ' +
          'forging padding of length one, then two, then three — which is why the previously ' +
          'recovered bytes are needed — and XORs it with the real previous block to get the ' +
          'plaintext byte. The cost is linear in the message length rather than exponential in ' +
          'anything, the key is never attacked, and the only thing the server did wrong was ' +
          'distinguish one failure from another.',
        example: 'The demo recovers a 30-byte message in 2 749 queries, about 86 per byte across ' +
          '2 blocks.'
      },
      {
        term: 'Unauthenticated ciphertext is malleable',
        plain: 'Flipping a bit in a CTR ciphertext flips exactly that bit in the plaintext.',
        formal: 'XOR is linear, so an edit to the ciphertext is the identical edit to the plaintext',
        detail: 'An attacker who knows the message format rewrites its contents without the key ' +
          'and without decrypting anything along the way. In CBC the effect is different but ' +
          'still exploitable: editing a ciphertext block flips the corresponding bits of the NEXT ' +
          'plaintext block while garbling its own. Encryption without integrity is not a weaker ' +
          'protection, it is a different one that leaves this door wide open.',
        example: 'The demo edits 5 ciphertext bytes and the recipient decrypts ' +
          '"user=bob;role=admin" instead of "user=bob;role=guest".'
      },
      {
        term: 'Every rejection path must be indistinguishable',
        plain: 'Two different failures with different timing or messages IS the oracle.',
        formal: 'compute every check, combine the results, and return one failure that cannot be told from another',
        detail: 'The padding oracle needs only that "bad padding" is distinguishable from "bad ' +
          'MAC" — through an error string, a status code, a log line or a response time. That ' +
          'makes generic error messages a cryptographic requirement rather than a courtesy, and ' +
          'it makes the timing of the two paths part of the specification. The deeper fix is a ' +
          'mode with only one rejection path, which is what an AEAD is.',
        example: 'The section’s insight states it as the transferable rule, and the constant-time ' +
          'section executes the timing version of the same attack.'
      },
      {
        term: 'None of these modes is a production choice',
        plain: 'ECB, CBC and CTR are components of authenticated modes.',
        formal: 'the deliverable is AES-GCM or ChaCha20-Poly1305; raw modes appear only inside them',
        detail: 'Choosing between CBC and CTR is a question that should not arise in application ' +
          'code, because the correct answer to both is an AEAD that uses one of them internally ' +
          'and adds the authentication that makes it safe. The value of understanding the raw ' +
          'modes is knowing what the AEAD is protecting you from and recognising the shape of the ' +
          'failure when you meet legacy code that did make the choice.',
        example: 'The demo’s modes table notes that none of its 5 rows provides integrity and ' +
          'every one is malleable.'
      }
    ],

    'authenticated-encryption': [
      {
        term: 'Confidentiality without integrity is the wrong product',
        plain: 'An AEAD refuses to return plaintext unless a tag checks out first.',
        formal: 'decrypt returns plaintext OR a failure and never both, so unverified bytes never reach the application',
        detail: 'The previous section edited a ciphertext into a different sentence with no key ' +
          'at all, which is possible only because there was a code path that decrypted ' +
          'attacker-controlled bytes. Removing that path is the entire contribution of ' +
          'authenticated encryption: the tag is checked first, the failure is single and ' +
          'indistinguishable, and there is no partial result to leak. Almost every application ' +
          'that wants encryption wants this interface.',
        example: 'The demo runs 5 tamper tests against the chosen suite and 4 are rejected, the ' +
          'accepted one being the honest ciphertext.'
      },
      {
        term: 'Encrypt-then-MAC is the only order with a general proof',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["encrypt the plaintext"] --> B["tag the CIPHERTEXT"]',
            '    B --> C["on receipt: check the tag first"]',
            '    C --> D{"tag valid?"}',
            '    D -->|no| E["stop — never touch the decryptor"]',
            '    D -->|yes| F["decrypt"]',
            '    E --> G["forged input never reaches<br/>the parsing or padding code"]'
          ].join('\n'),
          caption: 'The other orders can be secure with the right primitives and have no general proof. This one keeps attacker-chosen bytes out of the decryptor entirely.'
        },
        plain: 'Tag the ciphertext, verify before decrypting.',
        formal: 'encrypt-then-MAC is secure for any secure cipher and MAC; MAC-then-encrypt and encrypt-and-MAC are not in general',
        detail: 'The distinguishing question is whether the tag can be checked before anything is ' +
          'decrypted. If it can, forged ciphertext never reaches the decryption code and there is ' +
          'no oracle to build — which is precisely why the padding oracle exists in TLS 1.2\'s ' +
          'CBC suites and not in TLS 1.3. MAC-then-encrypt must decrypt to find the tag; ' +
          'encrypt-and-MAC tags the plaintext, which leaks plaintext equality through the tag ' +
          'and still needs the decrypt path.',
        example: 'The demo’s order table gives four compositions and marks the "verify before ' +
          'decrypting" column as the one that decides the other two.'
      },
      {
        term: 'Associated data is authenticated but not encrypted',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["a message header"] --> B["a router must be able to read it"]',
            '    B --> C["so it cannot be encrypted"]',
            '    A --> D["and nobody may alter it"]',
            '    D --> E["so it must be authenticated"]',
            '    C --> F["pass it as associated data:<br/>covered by the tag, sent in clear"]',
            '    E --> F'
          ].join('\n'),
          caption: 'It exists because routing metadata has to be readable and unforgeable at once, and leaving it outside the tag is how header-swapping attacks work.'
        },
        plain: 'Headers a middlebox must read and nobody may alter.',
        formal: 'the AEAD tag covers the associated data, so changing it fails verification even though it travels in clear',
        detail: 'Routing headers, message types, version numbers and sequence numbers belong ' +
          'here: visible to the network, unchangeable without detection. It is the channel that ' +
          'makes an AEAD sufficient for a protocol rather than just for a payload, because ' +
          'binding the header to the ciphertext stops an attacker replaying a valid ciphertext ' +
          'under a different header. Forgetting to include the header in the associated data is a ' +
          'common and quiet mistake.',
        example: 'The demo changes only the associated data, leaving the ciphertext untouched, ' +
          'and the AEAD rejects it.'
      },
      {
        term: 'Nonce reuse publishes the XOR of both plaintexts',
        plain: 'Same key, same nonce, same keystream.',
        formal: 'C₁ ⊕ C₂ = P₁ ⊕ P₂, so one known plaintext yields the other',
        readAs: 'The two ciphertexts exclusive-ORed together equal the two plaintexts ' +
          'exclusive-ORed together, because the identical keystream cancels, so knowing one ' +
          'message reveals the other.',
        detail: 'The attacker needs only one known plaintext, which is easy to come by — a fixed ' +
          'header, a login banner, or a message they sent themselves. This is the failure shared ' +
          'by every stream cipher and counter mode, and it is why the nonce requirement is stated ' +
          'as "never repeated under one key" rather than "usually different". There is no ' +
          'degradation and no partial leak.',
        example: 'The demo recovers 15 of 15 bytes of the second message from the two ciphertexts ' +
          'and the first plaintext.'
      },
      {
        term: 'For GCM it is worse: the authentication key falls too',
        plain: 'Nonce reuse turns an eavesdropper into a forger.',
        formal: 'GHASH is a polynomial evaluation and therefore linear, so one known (ciphertext, tag) pair yields the tag mask',
        detail: 'With the authentication key recovered, the attacker derives the tag mask from a ' +
          'known pair and can then compute a valid tag for any ciphertext they choose, which the ' +
          'receiver accepts. Confidentiality and authenticity fall together from one repeated ' +
          '96-bit value. That is why GCM\'s nonce requirement is stricter than "do not repeat, ' +
          'it leaks a bit", and why misuse-resistant modes exist.',
        example: 'The demo derives the mask, tags an edited ciphertext, and reports that GCM ' +
          'accepted the forgery.'
      },
      {
        term: 'Random 96-bit nonces have a message ceiling',
        plain: 'Collisions follow the birthday bound, not the nonce width.',
        formal: 'collision probability ≈ q²/2⁹⁷ for q messages, so 2³² messages sits at about 2⁻³³',
        readAs: 'The chance that two random ninety-six-bit nonces collide grows with the square ' +
          'of the number of messages, so at about four billion messages the risk is around two to ' +
          'the minus thirty-three.',
        detail: 'The standard ceiling of 2³² messages per key is chosen so that probability stays ' +
          'under 2⁻³², which is a much stricter target than "unlikely" — and it means the number ' +
          'looks reassuringly tiny right up to the limit. Because the risk grows with the square, ' +
          'every doubling of traffic quadruples it, and past 2⁴⁸ messages a collision is more ' +
          'likely than not. Nothing announces the crossing.',
        example: 'The demo computes 1.164 × 10⁻¹⁰ at 2³² messages and 3.935 × 10⁻¹ at 2⁴⁸.'
      },
      {
        term: 'Counter nonces have no ceiling and no analysis',
        plain: 'Use a counter when one writer owns the key.',
        formal: 'a monotonic counter never repeats by construction; it fails only on restart, cloning or two writers',
        detail: 'The counter is the better default precisely because it removes the arithmetic: ' +
          'there is no message budget to compute and no probability to bound. Its failure modes ' +
          'are operational rather than statistical — a restart from stale stored state, a cloned ' +
          'VM image, or two processes sharing a key through a config file — and each of those is ' +
          'a systems problem with a systems answer. Where writers genuinely cannot coordinate, ' +
          'XChaCha20\'s 192-bit nonce removes the ceiling instead.',
        example: 'The demo’s nonce table gives four strategies with the failure condition and the ' +
          'situation each one suits.'
      },
      {
        term: 'Misuse-resistant modes degrade instead of collapsing',
        plain: 'AES-GCM-SIV derives its nonce from the message.',
        formal: 'under SIV, a repeated nonce leaks only that two messages were identical',
        detail: 'The trade is a second pass over the plaintext, because the synthetic ' +
          'initialisation vector must be computed before encryption can start, which rules out ' +
          'streaming. In exchange, the worst case stops being catastrophic: a repeat reveals ' +
          'equality of messages rather than handing over the keystream and the authentication ' +
          'key. Where nonce uniqueness cannot be guaranteed — many writers, unreliable state, ' +
          'restarts — that is a good price.',
        example: 'The demo’s nonce table gives SIV its own row and names the residual leak ' +
          'explicitly.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));

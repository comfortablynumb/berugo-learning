/** Concepts for threat models, randomness and hashing (M23.1-M23.3). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'threat-models-and-primitives': [
      {
        term: 'Four goals people say "encrypted" for',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["confidentiality"] --> E["four separate properties"]',
            '    B["integrity"] --> E',
            '    C["authenticity"] --> E',
            '    D["non-repudiation"] --> E',
            '    E --> F["encryption alone gives you<br/>the first one only"]',
            '    F --> G["so ciphertext nobody authenticated<br/>can still be altered by anyone"]'
          ].join('\n'),
          caption: 'Most real failures come from assuming one word covers all four. Naming which of them you actually need makes the primitive choice almost mechanical.'
        },
        plain: 'Confidentiality, integrity, authenticity and non-repudiation are separate things.',
        formal: 'encryption gives confidentiality only; integrity needs a tag, authenticity needs a keyed tag, non-repudiation needs a signature',
        detail: 'Conflating these is the most common cryptographic mistake in system design, and ' +
          'it is a vocabulary failure rather than a mathematical one. "We encrypt it" answers ' +
          'whether an eavesdropper can read the message and says nothing about whether it arrived ' +
          'as sent, who sent it, or whether that can be proved to anyone else. Each of the four ' +
          'has a different primitive, and picking the wrong one leaves a door open that nobody ' +
          'notices because the traffic looks encrypted.',
        example: 'The demo tabulates all four with the question each answers and what it does ' +
          'not give you, across 4 rows.'
      },
      {
        term: 'Kerckhoffs’s principle: only the key is secret',
        plain: 'The system must stay secure with everything but the key made public.',
        formal: 'security must rest on the key alone, never on the algorithm or the protocol remaining hidden',
        detail: 'This is an engineering position, not a moral one. Secrets that are not keys ' +
          'leak — through disassembly, staff turnover, subpoena or a leaked repository — and ' +
          'unlike a key they cannot be rotated when they do. A design whose security depends on ' +
          'its algorithm staying hidden also cannot be reviewed, which removes the only process ' +
          'that reliably finds cryptographic flaws. Every primitive worth using is fully ' +
          'published and has been attacked in public for years.',
        example: 'Every primitive in the milestone is a published standard, and all 6 of them ' +
          'are checked against published vectors at render time.'
      },
      {
        term: 'The adversary model decides the answer',
        plain: 'Naming who you are defending against makes the rest of the choice mechanical.',
        formal: 'passive eavesdropper, active modifier, chosen-plaintext and chosen-ciphertext adversaries need progressively stronger constructions',
        detail: 'A passive attacker who only reads needs confidentiality. An active one who can ' +
          'modify traffic needs authentication as well, because an unauthenticated ciphertext ' +
          'can be edited into a different valid message. An attacker who can submit chosen ' +
          'ciphertexts and observe how the system responds needs a mode with no distinguishable ' +
          'failure at all, which is what rules out every unauthenticated mode. Stating the ' +
          'adversary first turns a debate about algorithms into a lookup.',
        example: 'The demo’s map names the adversary in its second column for all 7 requirement ' +
          'rows.'
      },
      {
        term: '"128-bit security" is work, not key length',
        plain: 'It means the best known attack costs about 2 to the 128 operations.',
        formal: '128-bit security ≈ 2¹²⁸ operations: a 3 072-bit RSA modulus, a 256-bit elliptic curve, a 128-bit symmetric key',
        readAs: 'A hundred-and-twenty-eight-bit security level means the cheapest known attack ' +
          'costs about two to the hundred-and-twenty-eighth operations, which is reached by a ' +
          'three-thousand-and-seventy-two-bit RSA key or a two-hundred-and-fifty-six-bit curve.',
        detail: 'The number is a claim about the attacker\'s cost, so it depends on the best ' +
          'known algorithm rather than on how many bits the key happens to occupy. Factoring has ' +
          'subexponential algorithms and the elliptic-curve discrete log does not, which is why ' +
          'RSA needs twelve times the bits of a curve at the same level and the gap widens as the ' +
          'level rises. Comparing "2 048-bit RSA" with "256-bit ECC" as if the numbers were ' +
          'commensurable is one of the most common errors in this area.',
        example: 'The public-key section tabulates the equivalences: 128-bit security is 3 072 ' +
          'bits of RSA and 256 bits of curve.'
      },
      {
        term: 'Test vectors are the only detector of a wrong implementation',
        plain: 'A broken cipher produces stable, well-distributed, completely wrong output.',
        formal: 'agreement with published values from NIST or an RFC is the check; no property of the output alone reveals the bug',
        detail: 'This is what makes cryptographic code different from ordinary code. A hash with ' +
          'a wrong constant still returns 32 bytes that pass every randomness test, a cipher with ' +
          'a swapped byte order still round-trips with itself, and an off-by-one in padding still ' +
          'produces plausible ciphertext. Nothing about the output looks wrong, and unit tests ' +
          'written against your own implementation agree with it by construction. Only somebody ' +
          'else\'s published answer catches it.',
        example: 'The demo checks 6 of 6 vectors — FIPS 180-4, FIPS 197, RFC 4231, RFC 6070 and ' +
          'RFC 8439 — when the page renders.'
      },
      {
        term: 'Production failures are composition and parameters',
        plain: 'AES has never been the weak point in your system.',
        formal: 'the recurring failures are repeated nonces, fast password hashes, unauthenticated modes and variable-time comparisons',
        detail: 'Every mainstream primitive is strong, and the breaches are elsewhere: a nonce ' +
          'reused under one key, a password stored with a fast hash, a mode with no ' +
          'authentication, a token compared with an operator that exits early. Each is an ' +
          'ordinary engineering mistake rather than an exotic cryptographic one, which is exactly ' +
          'why they keep happening — they are invisible to code review unless the reviewer knows ' +
          'the specific failure mode by name.',
        example: 'The demo’s fifth column names the classic failure for each of the 7 ' +
          'requirements, and every one is demonstrated later in the milestone.'
      },
      {
        term: 'Every path ends at an audited library',
        plain: 'The right answer to "which cipher should I implement" is none of them.',
        formal: 'the deliverable is a call to crypto.subtle, libsodium or an equivalent, not an implementation',
        detail: 'The implementations in this milestone exist so the attacks can be executed ' +
          'rather than described, and they are explicitly unfit for real data — not ' +
          'constant-time, not side-channel hardened, not audited. Understanding a construction ' +
          'and shipping one are different activities: the second requires years of adversarial ' +
          'attention that only a widely deployed library accumulates. Reading the code is how you ' +
          'learn what can go wrong; calling the library is how you avoid it.',
        example: 'All 7 rows of the demo’s chooser terminate at a named API rather than at an ' +
          'algorithm.'
      },
      {
        term: 'A tag proves who only if the key identifies them',
        plain: 'A MAC key is shared, so either holder could have produced the tag.',
        formal: 'a MAC gives authenticity between key holders and never non-repudiation, because the verifier can forge it',
        detail: 'This is the distinction that decides between HMAC and a signature, and it is ' +
          'about who holds what rather than about strength. If two parties share a MAC key, a ' +
          'valid tag proves the message came from one of them and cannot settle which — the ' +
          'verifier could have produced it themselves. A signature is produced with a private key ' +
          'and checked with a public one, so a third party who trusts the public key can be ' +
          'convinced. Audit logs, code signing and certificates all need the second.',
        example: 'The demo’s goals table separates authenticity from non-repudiation and names ' +
          'the different primitive each one needs.'
      }
    ],

    'randomness-for-cryptography': [
      {
        term: 'A statistical PRNG and a CSPRNG differ in KIND',
        plain: 'One promises good distribution; the other promises unpredictability.',
        formal: 'a statistical generator guarantees distribution tests pass; a CSPRNG guarantees output reveals nothing about future output',
        detail: 'These are not two grades of the same property. A statistical generator is ' +
          'designed to produce values that pass distribution tests, and it succeeds — which ' +
          'says nothing whatever about whether an observer can predict the next one. A CSPRNG is ' +
          'designed so that seeing any amount of output leaves the rest as unpredictable as ' +
          'before, and that is the property a key, a nonce or a session token needs. Passing a ' +
          'randomness test suite is evidence for the first and none at all for the second.',
        example: 'The demo predicts 8 of 8 future outputs of a statistical generator exactly, and ' +
          '0 of 8 against a keyed one.'
      },
      {
        term: 'A linear congruential generator’s state IS its output',
        plain: 'One observed value gives you the state, and the recurrence gives you the rest.',
        formal: 'xₙ₊₁ = (a·xₙ + c) mod m, with a, c and m public, so observing xₙ determines every later value',
        readAs: 'Each value is the previous value times a, plus c, reduced modulo m. Because a, ' +
          'c and m are published, anyone who sees one output can compute every output that ' +
          'follows it.',
        detail: 'There is no statistics in the attack and no probability. The generator is a ' +
          'published recurrence, its state is the value it last emitted, and applying the ' +
          'recurrence forward is the entire break. This is why the observation count in the demo ' +
          'is one rather than "enough samples": the secret is not spread across many outputs, it ' +
          'IS an output. Mersenne Twister needs 624 observations instead of one, which is a ' +
          'difference of degree and not of kind.',
        example: 'The demo needs 1 output to recover the whole state and then predicts the next 8 ' +
          'values exactly.'
      },
      {
        term: 'Looking random is what a broken generator does',
        plain: 'The demo measures the entropy of the sequence it just predicted perfectly.',
        formal: 'the high byte of a 31-bit LCG measures 7.9553 bits of entropy out of 8, over 4 000 samples',
        detail: 'That number is close to the maximum and it is exactly what every statistical ' +
          'test measures. The same values were predicted with certainty a moment earlier, so the ' +
          'entropy of an observed stream is not evidence of unpredictability and cannot be. It ' +
          'gets worse in the other direction too: the LOW byte of the same generator carries only ' +
          '1.2946 bits and takes 17 distinct values in four thousand samples, so which bits you ' +
          'look at changes the verdict entirely while the predictability does not change at all.',
        example: 'The demo reports 7.9553 bits for the high byte with all 256 values seen, and ' +
          '1.2946 bits for the low byte with 17.'
      },
      {
        term: 'The /dev/random blocking folklore points the wrong way',
        plain: 'Entropy is not consumed by use; a seeded generator produces unlimited output.',
        formal: 'once the pool is initialised, getrandom(2) never blocks again and the two devices are the same generator',
        detail: 'The belief that reading randomness "drains" an entropy count leads people away ' +
          'from the non-blocking interface and towards something worse — a userspace generator, a ' +
          'clock seed, or a hand-rolled mixer. On a modern Linux kernel the pool is a seed and ' +
          'the generator is a keyed function of it, so once initialised it can emit as many bytes ' +
          'as anyone asks for. The genuine problem is the moment BEFORE initialisation, which is ' +
          'precisely what getrandom(2) blocks for and then never blocks again.',
        example: 'The demo’s entropy table lists this as the one non-failure among five ' +
          'situations.'
      },
      {
        term: 'Boot, clones and forks are where entropy is actually missing',
        plain: 'A key generated before the pool has anything in it is a predictable key.',
        formal: 'first boot, VM cloning and fork() with userspace generator state all reproduce the same "random" values',
        detail: 'An embedded device generating its host key on first boot has an almost empty ' +
          'pool, so devices of the same model produce related or identical keys. A cloned VM ' +
          'image resumes with a cloned pool and a cloned generator state. A forked child that ' +
          'inherits userspace generator state continues the parent\'s stream, so two processes ' +
          'emit the same nonces — which for AES-GCM is a complete break. All three are silent: ' +
          'the keys are valid, the protocols work, and the security is zero.',
        example: 'The demo’s table names four such situations, including the study that found ' +
          'tens of thousands of duplicate RSA keys on the public internet.'
      },
      {
        term: 'The remedy is which function you call',
        plain: 'Use the platform CSPRNG and never seed it yourself.',
        formal: 'crypto.getRandomValues in a browser, crypto.randomBytes or getrandom(2) on a server; never Math.random',
        detail: 'There is no configuration to tune, no analysis to perform and no algorithm to ' +
          'choose — the whole decision is the name of the function. `Math.random` is a ' +
          'statistical PRNG in every engine, is not seeded from an entropy pool, and has been ' +
          'used to generate session tokens, password-reset links and API keys in shipped software ' +
          'repeatedly. Seeding a generator yourself is worse than useless, because a seed an ' +
          'attacker can guess is a key an attacker can guess.',
        example: 'The demo’s comparison table ends on this row, and calls it the entire remedy.'
      },
      {
        term: 'Forward secrecy in a generator means reseeding',
        plain: 'A statistical recurrence runs backwards; a reseeded CSPRNG does not.',
        formal: 'a compromised generator state should not expose output produced before the last reseed',
        detail: 'A linear recurrence is invertible, so an attacker who recovers the state can ' +
          'produce not only future values but past ones — every key the generator ever emitted. ' +
          'A CSPRNG built as a keyed function of a counter has no such inverse, and reseeding ' +
          'from the pool periodically bounds how much a state compromise is worth in the other ' +
          'direction too. That is the same forward-secrecy idea that appears in the ratchet ' +
          'section, applied to a generator instead of a session.',
        example: 'The demo’s comparison table gives this its own row, separate from predicting ' +
          'the next output.'
      },
      {
        term: 'Randomness failures are silent and total',
        plain: 'Nothing looks wrong, and there is no monitoring that catches it later.',
        formal: 'a weak key is a valid key: it passes validation, completes handshakes and encrypts traffic normally',
        detail: 'This is what makes the failure class dangerous out of proportion to how often ' +
          'it happens. A key from an empty entropy pool is structurally correct, so nothing in a ' +
          'test suite, a dashboard or a code review notices, and the system works perfectly for ' +
          'everyone including the attacker who regenerated the private key from the device model. ' +
          'Because there is no symptom, the defence has to be structural: use the platform ' +
          'generator, and treat "generate a key at first boot" as a design smell.',
        example: 'The section’s insight is this: the 2012 studies found the duplicate keys by ' +
          'scanning the internet, not because anything reported an error.'
      }
    ],

    'hash-functions-and-macs': [
      {
        term: 'Three resistances, and they cost different amounts',
        plain: 'Preimage, second preimage and collision are separate promises.',
        formal: 'preimage and second preimage cost about 2ⁿ; a collision costs about 2^(n/2)',
        readAs: 'Finding an input for a given digest, or a second input matching a given one, ' +
          'costs about two to the n operations for an n-bit digest, while finding any two inputs ' +
          'that agree costs only about two to the n-over-two.',
        detail: 'Asking "is this hash broken?" is the wrong question, because the three ' +
          'properties fall separately. MD5 and SHA-1 both lost collision resistance while their ' +
          'preimage resistance was never broken, which is why an MD5 checksum against accidental ' +
          'corruption is still fine and an MD5 signature is not. Knowing which property a use ' +
          'depends on is what decides whether a deprecation applies to you.',
        example: 'The demo tabulates all three at five digest sizes, computing the collision ' +
          'sample count from the birthday formula rather than quoting it: 5.0569 × 10⁹ samples ' +
          'at 64 bits and 1.4234 × 10²⁴ at 160.'
      },
      {
        term: 'The birthday bound halves your digest',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["a 256-bit hash"] --> B["preimage: about 2²⁵⁶ work"]',
            '    A --> C["collision: about 2¹²⁸ work"]',
            '    C --> D["because you only need ANY two<br/>inputs to agree, not a specific one"]',
            '    D --> E["so collision resistance is<br/>half the output length"]'
          ].join('\n'),
          caption: 'Two of the three resistances cost the full digest and one costs half it. Sizing a hash for collision resistance and quoting the full length is the common error.'
        },
        plain: 'Collision resistance is half the output length, not all of it.',
        formal: 'a collision becomes even money at about √(2·ln 2·2ⁿ) samples, so SHA-256 gives 128-bit collision resistance',
        readAs: 'Even odds of a collision arrive after roughly the square root of the size of ' +
          'the output space, so a two-hundred-and-fifty-six-bit digest resists collisions at ' +
          'about two to the hundred-and-twenty-eighth rather than two to the ' +
          'two-hundred-and-fifty-sixth.',
        detail: 'The consequence is a design rule: a use that needs collision resistance needs ' +
          'twice the digest length a preimage-resistant use does. It also explains why the ' +
          '128-bit digests everyone grew up with turned out to be inadequate — a 128-bit hash ' +
          'resists collisions at about 1.7 × 10¹⁹ samples, which an adversary with a budget has ' +
          'reached in practice, and the real SHA-1 collision cost about 2⁶³ rather than the 2⁸⁰ ' +
          'the bound suggests.',
        example: 'The demo computes 4.0065 × 10³⁸ samples for SHA-256 and 2.1719 × 10¹⁹ for a ' +
          '128-bit digest.'
      },
      {
        term: 'Merkle–Damgård publishes its internal state',
        plain: 'The digest of SHA-1 or SHA-2 IS the machine’s state after the last block.',
        formal: 'the compression function folds each block into a running state, and the final state is printed as the digest',
        detail: 'That structural choice is the whole vulnerability. Anyone holding the digest ' +
          'holds a machine they can resume — not run backwards to recover the input, but run ' +
          'FORWARD over blocks of their own choosing, producing a legitimate digest for a longer ' +
          'message. It is not a weakness in the compression function and no amount of ' +
          'strengthening SHA-256 removes it; it is what "the digest is the state" means. A sponge ' +
          'keeps a wider state and publishes a truncated slice, so it has nothing to resume.',
        example: 'The demo resumes SHA-256 from a published tag and produces a valid tag for a ' +
          'message the key holder never authorised.'
      },
      {
        term: 'Length extension forges hash(secret ‖ message)',
        plain: 'The tag and the secret’s LENGTH are enough; the secret itself is not needed.',
        formal: 'given H(s ‖ m) and |s|, an attacker computes H(s ‖ m ‖ glue ‖ suffix) for any suffix',
        readAs: 'Given the hash of a secret followed by a message, and the length of that secret, ' +
          'an attacker can compute the hash of the same secret and message followed by padding ' +
          'and anything they choose.',
        detail: 'The glue is the padding the original message would have received, which the ' +
          'attacker reconstructs because padding depends only on the total length. They guess the ' +
          'secret length — there are only a few dozen plausible values, and each can simply be ' +
          'tried — load the published tag back in as the hash state, hash their own suffix, and ' +
          'emit a tag the verifier accepts. The cost is one hash computation and the result is a ' +
          'complete authentication bypass.',
        example: 'With a 16-byte secret and a 19-byte message the demo computes 29 glue bytes and ' +
          'the forged tag is accepted.'
      },
      {
        term: 'HMAC exists for exactly this, and it works',
        plain: 'Hash twice with two derived keys, and there is nothing to resume from.',
        formal: 'HMAC(k, m) = H((k ⊕ opad) ‖ H((k ⊕ ipad) ‖ m)), and the published value is the OUTER hash',
        readAs: 'Take the key exclusive-ORed with one constant, follow it with the hash of the ' +
          'key exclusive-ORed with a different constant and then the message, and hash the whole ' +
          'thing again. What is published is the outer hash, which an attacker cannot extend.',
        detail: 'Resuming the published digest would extend the outer hash, whose input is a ' +
          'digest the attacker cannot control and which the verifier never re-hashes, so the ' +
          'attack produces nothing. HMAC is also proved secure from properties of the compression ' +
          'function rather than assumed, which is why it survived MD5 and SHA-1 losing collision ' +
          'resistance. The same attack the demo runs against the naive construction is run ' +
          'against HMAC and fails.',
        example: 'The demo reports the naive tag forged as "yes" and the HMAC tag forged as "no", ' +
          'both computed at render time.'
      },
      {
        term: 'The patches people invent instead are worse',
        plain: 'Moving the secret to the end stops extension and opens a collision attack.',
        formal: 'hash(message ‖ secret) resists extension but a collision on the message forges the tag, offline',
        readAs: 'Hashing the message followed by the secret cannot be extended, but any two ' +
          'messages that collide under the hash produce the same tag under any secret, and that ' +
          'collision is found without touching the system.',
        detail: 'This is the natural fix when somebody learns about length extension, and it ' +
          'trades one failure for another: two messages that collide under the hash produce the ' +
          'same tag under any secret, and the attacker finds that collision offline with no ' +
          'access to the system at all. Wrapping the message in the secret at both ends stops ' +
          'both attacks and has no security proof, so nobody can say what else it permits. ' +
          'Inventing a MAC is a research problem; HMAC already solved it.',
        example: 'The demo’s construction table rates six constructions and only three carry a ' +
          'proof.'
      },
      {
        term: 'A sponge does not have the property at all',
        plain: 'SHA-3 and BLAKE3 keep more state than they publish.',
        formal: 'a sponge absorbs into a state wider than its output and squeezes a truncated slice, so the digest is not resumable',
        detail: 'Because the published digest is only part of the state, there is no way to ' +
          'reconstruct the machine and continue it, and the length-extension property is absent ' +
          'rather than defended against. That is why SHA-3 and BLAKE3 offer keyed modes directly ' +
          'and need no HMAC wrapper: the wrapper exists to work around a structural property they ' +
          'do not have. It also makes them the simpler choice for a new design, since there is ' +
          'one fewer way to compose them wrongly.',
        example: 'The demo’s table marks KMAC and BLAKE3 keyed mode as correct and notes the ' +
          'wrapper is unnecessary rather than merely redundant.'
      },
      {
        term: 'API signing schemes still reinvent the broken one',
        plain: 'Concatenating a shared secret with a canonicalised request and hashing it is the same bug.',
        formal: 'signature = H(secret ‖ canonical_request) is the construction the demo forges',
        readAs: 'The signature is the hash of the shared secret followed by the canonicalised ' +
          'request, which is exactly the concatenation the length-extension attack in the demo ' +
          'forges without ever learning the secret.',
        detail: 'It keeps happening because the construction looks obviously correct: the secret ' +
          'is in there, the hash is strong, and no amount of staring at the digest reveals the ' +
          'key. The flaw is not in the hash at all, it is in what Merkle–Damgård chooses to ' +
          'publish, and it is invisible unless you already know to look for it. That is the ' +
          'general lesson of the milestone in one construction — the primitive is fine, the ' +
          'composition is the vulnerability, and the fix is one function call.',
        example: 'The demo’s attack table shows all six steps, and none of them requires the ' +
          'secret or a weakness in SHA-256.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));

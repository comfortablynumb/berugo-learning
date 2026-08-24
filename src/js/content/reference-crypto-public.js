/** Reference entries for public keys, signatures and protocols (M23.7-M23.9). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'public-key-cryptography': {
      summary: 'One Diffie–Hellman implementation attacked at four moduli, with the ' +
        'eavesdropper’s step count reported and the size at which it fails; a textbook RSA ' +
        'ciphertext broken with one chosen-ciphertext query; and the equivalent key sizes across ' +
        'three families.',
      intuition: 'The mathematics is fine and the deployments were not — the failures are ' +
        'padding and parameters, which is why modern primitives expose neither.',
      formulation: {
        equations: [
          {
            label: 'Diffie–Hellman',
            expr: 'A = gᵃ mod p · B = gᵇ mod p · shared = Bᵃ = Aᵇ = g^(ab) mod p',
            readAs: 'Each side raises the generator to its own secret exponent and sends the ' +
              'result; each then raises what it received to its own exponent, and because the ' +
              'operations commute both reach the generator raised to the product.',
            terms: [
              { sym: 'on the wire', meaning: 'p, g, A and B — everything except the two exponents' },
              { sym: 'what the attacker needs', meaning: 'either exponent, which means the discrete logarithm' },
              { sym: 'what it does not provide', meaning: 'any authentication at all' },
              { sym: 'at modulus 104 729', meaning: 'both sides reach 42 864, which never crossed the wire' }
            ]
          },
          {
            label: 'Brute-force discrete log at four sizes, cap 2 000 000 steps',
            expr: 'modulus · bits · steps · broke it',
            terms: [
              { sym: '7 919', meaning: '13 bits · 872 steps · yes' },
              { sym: '104 729', meaning: '17 bits · 11 521 · yes' },
              { sym: '1 299 709', meaning: '21 bits · 142 969 · yes' },
              { sym: '2 147 483 647', meaning: '31 bits · over 2 000 000 · no' }
            ]
          },
          {
            label: 'Textbook RSA broken with one query',
            expr: '(m·s)ᵉ ≡ mᵉ · sᵉ (mod n), so the oracle’s answer is m·s',
            readAs: 'Encrypting a message multiplied by a blinding value gives the product of ' +
              'the two encryptions, so an attacker can disguise a ciphertext, have it decrypted, ' +
              'and divide the blinding out.',
            terms: [
              { sym: 'the key', meaning: 'n = 1 647 733 = 1 061 × 1 553, e = 17, d = 1 258 033' },
              { sym: 'the blinded query', meaning: 's = 3 → c′ = 1 008 078, oracle returns 126' },
              { sym: 'recovered', meaning: '126 · 3⁻¹ mod n = 42, the true plaintext' },
              { sym: 'or simply factor it', meaning: '1 060 trial divisions at 21 bits' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'RSA encryption uses OAEP and RSA signing uses PSS',
          why: 'Padding destroys the multiplicative structure the attack needs and makes equal plaintexts give different ciphertexts.',
          breaks: 'An unpadded ciphertext falls to one chosen-ciphertext query, and a short unpadded message falls to encrypting every candidate.'
        },
        {
          name: 'Diffie–Hellman is authenticated by something outside the exchange',
          why: 'The exchange agrees a key with whoever answered.',
          breaks: 'An active attacker runs two exchanges in the middle and reads everything while both sides see a secure channel.'
        },
        {
          name: 'Curve parameters are fixed by the protocol, not negotiated',
          why: 'A small subgroup, a composite order or an unvalidated point gives up secrets a good curve does not.',
          breaks: 'The section’s demo curve needed a prime-order generator before ECDSA nonces had inverses at all.'
        },
        {
          name: 'Security is compared as attacker work, never as key length across families',
          why: 'Factoring has subexponential algorithms; the curve discrete log does not.',
          breaks: '128-bit security is 3 072 RSA bits against 256 curve bits, and the ratio grows to 20 at the 192-bit level.'
        }
      ],
      complexity: [
        { operation: 'modular exponentiation', average: 'O(log e) multiplications by square-and-multiply', worst: 'variable-time unless blinded — a side channel on d' },
        { operation: 'brute-force discrete log', average: 'O(p) steps', worst: 'this loop is not the real threat; index calculus is' },
        { operation: 'trial-division factoring', average: 'O(√n) divisions', worst: 'hopeless at 2 048 bits and 1 060 steps at 21' },
        { operation: 'RSA key generation', average: 'search for two primes, then one modular inverse', worst: 'shared primes across devices when the entropy pool is empty' },
        { operation: 'elliptic-curve scalar multiplication', average: 'O(log k) point operations by double-and-add', worst: 'leaks k through timing unless implemented branchlessly' },
        { operation: 'ECDH at 128-bit security', average: 'a 256-bit curve, one scalar multiplication each way', worst: 'invalid-point attacks where the peer’s point is not validated' }
      ],
      failureModes: [
        {
          symptom: 'An RSA ciphertext is decrypted by an attacker with only oracle access.',
          cause: 'Textbook RSA is multiplicative, so a blinded ciphertext is a different value the oracle will accept.',
          fix: 'OAEP. The homomorphism is a feature elsewhere and a break here.'
        },
        {
          symptom: 'Two RSA keys in a fleet share a prime factor.',
          cause: 'Key generation ran before the entropy pool was initialised.',
          fix: 'Defer generation, or provision entropy at manufacture. This was found at internet scale in 2012.'
        },
        {
          symptom: 'A key exchange completes with an attacker in the middle.',
          cause: 'The exchange was never bound to an identity.',
          fix: 'Sign the transcript, present a certificate chain, or use a pre-shared key.'
        },
        {
          symptom: 'A protocol is broken by a peer sending a point that is not on the curve.',
          cause: 'The received point was used without validation, leaking the private scalar modulo small factors.',
          fix: 'Validate, or use X25519 where the construction removes the case.'
        }
      ],
      inTheWild: [
        'Bleichenbacher’s 1998 attack on PKCS#1 v1.5, which is still rediscovered in TLS stacks as ROBOT.',
        'Logjam and FREAK, which forced connections down to 512-bit export-grade parameters that were then factored.',
        'X25519 in TLS 1.3, WireGuard and Signal, chosen because it has no parameters to misconfigure.',
        'Certificate authorities moving to ECDSA P-256 roots, because RSA at equivalent strength has become unwieldy.'
      ],
      sources: [
        { title: 'Rivest, Shamir and Adleman — A method for obtaining digital signatures (1978)', note: 'the original construction, and the multiplicative property that makes padding necessary' },
        { title: 'Diffie and Hellman — New directions in cryptography (1976)', note: 'key agreement over a public channel, and the discrete-log assumption' },
        { title: 'Bernstein — Curve25519: new Diffie-Hellman speed records (2006)', note: 'the design choices that remove invalid-point and small-subgroup cases' },
        { title: 'Adrian et al. — Imperfect forward secrecy: how Diffie-Hellman fails in practice (2015)', note: 'Logjam, and what happens when parameters can be negotiated downwards' }
      ]
    },

    'signatures-and-pki': {
      summary: 'An ECDSA private key recovered from two signatures sharing a nonce in four ' +
        'modular operations, the same signer switched to deterministic nonces with the recovery ' +
        'failing, and five certificate chains run through a validator that applies nine checks to ' +
        'the well-formed one.',
      intuition: 'Deterministic nonces exist because "generate a good random number every time" ' +
        'is a requirement systems fail at, and the failure is total and retroactive.',
      formulation: {
        equations: [
          {
            label: 'ECDSA, and what a repeated nonce gives away',
            expr: 's = k⁻¹(z + r·d) mod n · k = (z₁ − z₂)(s₁ − s₂)⁻¹ · d = (s₁k − z₁)r⁻¹',
            readAs: 'A signature value is the inverse of the nonce times the message hash plus ' +
              'the signature x-coordinate times the private key. Subtracting two such equations ' +
              'that share a nonce gives the nonce, and substituting it back gives the key.',
            terms: [
              { sym: 'the visible symptom', meaning: 'r is the same in both signatures, and r is public' },
              { sym: 'on the demo curve', meaning: 'order 3 359, r = 1 854 in both, k = 777, d = 1 234' },
              { sym: 'what it needs', meaning: 'two public signatures — no curve weakness, no side channel, no access' },
              { sym: 'the damage', meaning: 'every signature that key ever made becomes forgeable' }
            ]
          },
          {
            label: 'Deterministic nonces',
            expr: 'k = HMAC(private key, hash(message)) mod (n − 1)',
            readAs: 'The nonce is a keyed hash of the message, so it is unpredictable without ' +
              'the private key, differs whenever the message differs, and needs no randomness ' +
              'at signing time.',
            terms: [
              { sym: 'on the demo messages', meaning: '1 683 and 460 — different, because the messages differ' },
              { sym: 'stability', meaning: 'signing the same message twice gives the same signature' },
              { sym: 'entropy consumed at signing', meaning: '0, so there is no generator to fail' },
              { sym: 'EdDSA', meaning: 'builds this in rather than offering it as an option' }
            ]
          },
          {
            label: 'Chain validation: five chains, one broken check each',
            expr: 'chain · checks applied · checks failed',
            terms: [
              { sym: 'well-formed', meaning: '9 applied · 0 failed · accepted' },
              { sym: 'expired leaf', meaning: '9 · 1 — the validity window' },
              { sym: 'wrong host', meaning: '9 · 1 — the host-name match' },
              { sym: 'leaf signs leaf', meaning: '14 · 2 — basic constraints and key usage on the issuer' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The signing nonce is derived deterministically or from a CSPRNG, never reused',
          why: 'Two signatures sharing a nonce yield the private key in four modular operations.',
          breaks: 'The PlayStation 3 signing key and several Bitcoin wallets fell to exactly this.'
        },
        {
          name: 'Every link in a chain is checked, not just the leaf signature',
          why: 'Each omitted check is a separate way to accept a certificate that should be refused.',
          breaks: 'Without basic constraints, anyone holding any valid leaf can issue a certificate for any name.'
        },
        {
          name: 'A wildcard covers exactly one label and never the bare domain',
          why: 'Name matching is string handling, which fails in ways the cryptography does not.',
          breaks: '*.example.com must not match a.b.example.com or example.com, and loose implementations have shipped.'
        },
        {
          name: 'Signatures are used where a third party must be convinced; MACs where two ends share a key',
          why: 'A MAC key holder can forge any tag the verifier would accept.',
          breaks: 'A MAC over an audit log proves nothing to an auditor who was not already holding the key.'
        }
      ],
      complexity: [
        { operation: 'ECDSA sign', average: 'one scalar multiplication and one modular inverse', worst: 'requires a fresh secret nonce every time' },
        { operation: 'ECDSA verify', average: 'two scalar multiplications', worst: 'slower than signing, unlike RSA' },
        { operation: 'Ed25519', average: '64-byte signature, deterministic by construction', worst: 'no parameter choices, which is the point' },
        { operation: 'nonce-reuse key recovery', average: '2 subtractions and 2 modular inverses', worst: 'microseconds, at any key size' },
        { operation: 'chain validation', average: 'O(depth) signature verifications plus the per-link checks', worst: '9 checks for a two-link chain, 14 for three links' },
        { operation: 'OCSP', average: 'one extra round trip to a third party per connection', worst: 'fails open, so blocking the responder defeats it' }
      ],
      failureModes: [
        {
          symptom: 'A signing key is extracted from published signatures.',
          cause: 'Two signatures shared a nonce, which is visible as a repeated r.',
          fix: 'RFC 6979 deterministic nonces, or EdDSA. Rotate the key: every past signature is now forgeable.'
        },
        {
          symptom: 'A client accepts a certificate for a name it did not request.',
          cause: 'The host-name match was skipped, or wildcard matching was implemented loosely.',
          fix: 'Match against the SAN list with strict single-label wildcard rules.'
        },
        {
          symptom: 'An ordinary site certificate is used to issue certificates for other sites.',
          cause: 'The basic-constraints check on intermediates was not applied.',
          fix: 'Require CA:TRUE and the certSign key usage on every non-leaf link.'
        },
        {
          symptom: 'A revoked certificate keeps working.',
          cause: 'CRLs are stale and OCSP fails open when the responder is unreachable.',
          fix: 'Short-lived certificates with automated renewal, plus Certificate Transparency monitoring.'
        }
      ],
      inTheWild: [
        'The 2010 PlayStation 3 signing-key extraction, from a constant ECDSA nonce.',
        'Android’s 2013 SecureRandom defect, which repeated nonces and drained Bitcoin wallets.',
        'The 2011 DigiNotar compromise, which is the misissuance case Certificate Transparency was built to surface.',
        'Let’s Encrypt retiring OCSP URLs in 2025, leaving short lifetimes and CT as the operative mechanisms.'
      ],
      sources: [
        { title: 'RFC 6979 — Deterministic usage of DSA and ECDSA', note: 'the nonce derivation, and the reasoning for removing randomness from signing' },
        { title: 'Bernstein, Duif, Lange, Schwabe and Yang — High-speed high-security signatures (2012)', note: 'Ed25519, with determinism built into the scheme' },
        { title: 'RFC 5280 — Internet X.509 PKI certificate and CRL profile', note: 'the certificate structure and the full validation algorithm' },
        { title: 'Laurie, Langley and Kasper — Certificate Transparency (RFC 6962)', note: 'public logs and inclusion proofs as an answer to misissuance' }
      ]
    },

    'protocol-construction': {
      summary: 'A session state stolen at a chosen message, with the number of earlier messages ' +
        'that stay closed and the exact message at which the attacker loses access both ' +
        'reported; and an eight-message conversation with ten ratchet steps where every message ' +
        'still decrypts.',
      intuition: 'Forward secrecy bounds the past and post-compromise security bounds the ' +
        'future, and each needs its own mechanism.',
      formulation: {
        equations: [
          {
            label: 'The two ratchets',
            expr: 'symmetric: (messageKey, nextChain) = KDF(chain) · DH: root′ = KDF(root, DH(new keys))',
            terms: [
              { sym: 'symmetric ratchet cost', meaning: 'one hash per message' },
              { sym: 'DH ratchet cost', meaning: 'one key exchange per change of direction' },
              { sym: 'what each provides', meaning: 'forward secrecy and post-compromise security respectively' },
              { sym: 'why both', meaning: 'a one-way chain cannot introduce new material; an exchange cannot erase old' }
            ]
          },
          {
            label: 'A ten-message session, theft at 3, ratchet at 6',
            expr: 'message · readable with the stolen state',
            terms: [
              { sym: 'messages 0–2', meaning: 'not readable — before the theft, and the chain runs one way' },
              { sym: 'messages 3–5', meaning: 'readable — the root key is still the stolen one' },
              { sym: 'messages 6–9', meaning: 'not readable — the DH ratchet mixed in unseen material' },
              { sym: 'repair actions taken', meaning: '0 — nobody detected the compromise' }
            ]
          },
          {
            label: 'The TLS 1.3 handshake, cryptographically',
            expr: 'key shares → shared secret → key schedule over the transcript → signature → Finished',
            terms: [
              { sym: 'why one round trip', meaning: 'the client sends its key share before anything is negotiated' },
              { sym: 'what the signature covers', meaning: 'the transcript, not the message — that is the anti-downgrade binding' },
              { sym: 'Finished', meaning: 'a MAC over the whole transcript in both directions; a mismatch aborts' },
              { sym: 'forward secrecy', meaning: 'the ephemeral keys are discarded, so a stolen long-term key cannot decrypt recordings' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Message keys are used once and then deleted',
          why: 'That is what makes the chain one-way and gives replay protection at the same time.',
          breaks: 'Retaining keys turns a state compromise into full history disclosure.'
        },
        {
          name: 'New key-exchange material is mixed in periodically, not only at session start',
          why: 'Without it a compromise lasts for the life of the session.',
          breaks: 'The demo’s attacker keeps reading until the ratchet turns, and then stops.'
        },
        {
          name: 'The negotiation transcript is authenticated at the end of the handshake',
          why: 'An attacker who edits the offered options changes the transcript.',
          breaks: 'Unauthenticated negotiation is a downgrade attack, and the strongest available option becomes irrelevant.'
        }
      ],
      complexity: [
        { operation: 'symmetric ratchet step', average: 'one KDF call per message', worst: 'negligible — it is a hash' },
        { operation: 'DH ratchet step', average: 'one key exchange per change of direction', worst: '5 direction changes cost 10 steps across both parties in the demo' },
        { operation: 'out-of-order delivery', average: 'store skipped message keys until a window closes', worst: 'an unbounded window is a memory exhaustion vector' },
        { operation: 'replay protection', average: 'a sliding window of accepted counters', worst: 'TLS 1.3 0-RTT explicitly does not provide it' },
        { operation: 'TLS 1.3 handshake', average: 'one round trip, or zero with 0-RTT', worst: '0-RTT early data is replayable by design' },
        { operation: 'session resumption', average: 'a pre-shared key derived from the previous session', worst: 'without a fresh exchange it loses forward secrecy' }
      ],
      failureModes: [
        {
          symptom: 'A stolen long-term key decrypts traffic recorded years earlier.',
          cause: 'Static key transport rather than an ephemeral exchange.',
          fix: 'Ephemeral Diffie–Hellman with the session keys discarded — which is why TLS 1.3 removed RSA key transport.'
        },
        {
          symptom: 'A device compromise keeps yielding plaintext long after it was cleaned up.',
          cause: 'No new key material is ever mixed in, so the stolen state stays valid.',
          fix: 'A DH ratchet on every change of direction, so recovery happens without anyone noticing the compromise.'
        },
        {
          symptom: 'A captured request is accepted a second time.',
          cause: 'Authenticated encryption was mistaken for freshness.',
          fix: 'Counters and a sliding acceptance window, with keys deleted after use.'
        },
        {
          symptom: 'A connection negotiates a weak option despite both ends supporting strong ones.',
          cause: 'The negotiation was not authenticated, so an attacker edited it.',
          fix: 'Bind the transcript into the handshake signature, and remove weak options entirely.'
        }
      ],
      inTheWild: [
        'Signal’s double ratchet, in WhatsApp, Signal and Messenger’s encrypted mode.',
        'TLS 1.3, which removed static RSA key transport and cut the negotiable surface to almost nothing.',
        'WireGuard, which fixes one cipher suite and rekeys on a timer rather than negotiating anything.',
        'Application-layer message stores, where "we use TLS" answers nothing about the data at rest.'
      ],
      sources: [
        { title: 'Perrin and Marlinspike — The Double Ratchet Algorithm', note: 'the two ratchets, and precisely which property each one provides' },
        { title: 'Cohn-Gordon, Cremers and Garratt — On post-compromise security (2016)', note: 'the formal definition, and why it is separate from forward secrecy' },
        { title: 'RFC 8446 — TLS 1.3', note: 'the handshake, the key schedule and the transcript binding' },
        { title: 'Perrin — The Noise Protocol Framework', note: 'a set of analysed handshake patterns to adopt rather than invent' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));

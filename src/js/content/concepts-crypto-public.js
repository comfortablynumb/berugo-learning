/** Concepts for public keys, signatures and protocols (M23.7-M23.9). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'public-key-cryptography': [
      {
        term: 'Two assumptions carry everything',
        plain: 'Factoring is hard, and taking a logarithm in a group is hard.',
        formal: 'RSA rests on integer factorisation; Diffie–Hellman, ECDH and ECDSA rest on the discrete logarithm',
        detail: [
          'Neither problem has been proved hard. Both are believed hard because a great deal of ' +
            'attention has failed to make them easy.',
          'That is a weaker foundation than the symmetric primitives rest on. Those also lack a ' +
            'proof, but they give an attacker far less structure to work with.',
          'It also means public-key security levels move when algorithms improve. The recommended ' +
            'RSA size has risen repeatedly without RSA ever being broken.'
        ],
        example: 'The demo runs a brute-force discrete log against four moduli and reports the ' +
          'step count each time.'
      },
      {
        term: 'Diffie–Hellman agrees a secret that was never sent',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["Alice picks a, sends g^a"] --> C["each raises what they received<br/>to their own private number"]',
            '    B["Bob picks b, sends g^b"] --> C',
            '    C --> D["both reach g^(ab)"]',
            '    D --> E["an eavesdropper saw g^a and g^b<br/>and cannot get there"]'
          ].join('\n'),
          caption: 'The shared secret never crosses the wire in any form. It is computed independently at both ends from things that were public, which is the whole surprise.'
        },
        plain: 'Both sides exponentiate the other’s public value with their own private one.',
        formal: 'Alice computes B^a mod p and Bob computes A^b mod p, and both equal g^(ab) mod p',
        readAs: 'Alice raises the value Bob sent to her secret exponent, and Bob raises the value ' +
          'Alice sent to his. Because exponentiation commutes, both arrive at the generator ' +
          'raised to the product of the two secrets.',
        detail: [
          'The eavesdropper holds the group, the generator and both public values — almost ' +
            'everything. What they lack is either private exponent, and the only known route to ' +
            'one is the discrete logarithm.',
          'Note what the exchange does not provide. There is no authentication anywhere in it, so ' +
            'an active attacker who runs two exchanges in the middle reads everything.',
          'It is a key agreement, not a protocol.'
        ],
        example: 'At modulus 104 729 the demo shows both sides reaching 42 864 with nothing of ' +
          'that value on the wire.'
      },
      {
        term: 'The parameter size IS the security, measured',
        plain: 'The same attacker, the same code, one number changed.',
        formal: 'brute-force discrete log costs O(p) steps, so the modulus size is the only thing standing between the attacker and the secret',
        detail: [
          'This is worth seeing as a measurement rather than a rule of thumb. It shows the ' +
            'protocol is not stronger at one size than another — it is the same protocol, and ' +
            'only the search length differs.',
          'Real parameters are chosen so the best KNOWN search is out of reach for the lifetime ' +
            'of the data. That is why recommended sizes rise over time without any protocol ' +
            'changing.',
          'For finite fields the recommended numbers come from index calculus, not from a naive ' +
            'loop like this one.'
        ],
        example: 'The demo breaks 13 bits in 872 steps, 21 bits in 142 969, and gives up on ' +
          '31 bits after 2 000 000.'
      },
      {
        term: 'RSA is multiplicative, which breaks textbook RSA',
        plain: 'Multiply a ciphertext by s to the e, and the decryption comes back multiplied by s.',
        formal: '(m·s)^e ≡ m^e · s^e (mod n), so an oracle that decrypts anything but c still yields m',
        readAs: 'The encryption of a message times a blinding value equals the encryption of the ' +
          'message times the encryption of the blinding value. So an attacker can disguise a ' +
          'ciphertext, get it decrypted, and divide the blinding out afterwards.',
        detail: [
          'The attacker takes a ciphertext they are not allowed to submit and blinds it into one ' +
            'that looks unrelated. They send that, then divide the answer by the blinding factor. ' +
            'One query, no key, and the plaintext.',
          'The homomorphic property is a feature in some settings and a complete break here. That ' +
            'is what "textbook RSA" means as a criticism: the mathematics without the padding ' +
            'that makes it usable.'
        ],
        example: 'With blinding factor 3 the demo submits a blinded ciphertext, gets 126 back, ' +
          'and divides to recover the plaintext 42.'
      },
      {
        term: 'OAEP and PSS are not decoration',
        plain: 'Padding destroys the structure the attack needs and adds randomness.',
        formal: 'OAEP for encryption and PSS for signatures make the padded message unpredictable and non-multiplicative',
        detail: [
          'A blinded ciphertext decrypts to something without the required padding structure. The ' +
            'oracle rejects it, and the attack loses its query.',
          'The randomness matters separately. Without it, equal plaintexts give equal ' +
            'ciphertexts, so an attacker who can guess a short message encrypts every candidate ' +
            'and compares.',
          'Any RSA implementation that lets you encrypt a raw integer is offering you the broken ' +
            'version.'
        ],
        example: 'The demo’s RSA table runs the attack that OAEP removes, step by step with the ' +
          'arithmetic shown.'
      },
      {
        term: 'Curves get the same strength from far smaller keys',
        plain: '128-bit security is a 3 072-bit RSA modulus and a 256-bit curve.',
        formal: 'the best attack on a well-chosen curve is square-root in the group order; factoring has subexponential methods',
        detail: [
          'The asymmetry comes from the algorithms available, not from the design quality of ' +
            'either family. It widens with the security level: at 256-bit security RSA needs ' +
            '15 360 bits and a curve needs 512.',
          'That is why nobody deploys RSA at high levels and everybody deploys curves.',
          'Treating key length as a strength comparison across families is a mistake. ' +
            '"2 048-bit RSA" and "256-bit ECC" are not commensurable numbers.'
        ],
        example: 'The demo tabulates five security levels with the RSA, finite-field and curve ' +
          'sizes for each.'
      },
      {
        term: 'A curve is a group, and scalar multiplication is the one-way step',
        plain: 'Adding a point to itself k times is easy; recovering k is not.',
        formal: 'the chord-and-tangent law makes points a group; k·G is cheap by double-and-add and k is hard to recover',
        readAs: 'The line through two points on the curve meets it in a third, and reflecting ' +
          'that third point defines addition. Multiplying a point by a whole number is then ' +
          'repeated addition — fast forwards, with no known fast inverse.',
        detail: [
          'ECDH is exactly Diffie–Hellman with this group substituted for the integers modulo a ' +
            'prime. The protocol description is unchanged; only the arithmetic differs.',
          'Curve choice matters enormously. A curve with a small subgroup, a composite order or a ' +
            'bad generator gives up secrets that a well-chosen curve does not.',
          'That is the reason modern practice fixes the curve rather than negotiating it.'
        ],
        example: 'The section’s demo curve has a generator of prime order 3 359, chosen so that ' +
          'every nonce has an inverse.'
      },
      {
        term: 'X25519 and Ed25519 removed the dials',
        plain: 'The failures were parameters, so the response was to have none.',
        formal: 'a fixed curve, mandatory clamping and no invalid-point cases: there is nothing left to configure wrongly',
        detail: [
          'Twenty years of RSA and classical-curve incidents were overwhelmingly padding and ' +
            'parameter failures. Bleichenbacher oracles, shared moduli from bad key generation, ' +
            'small exponents on unpadded messages, 512-bit export keys still accepted, ' +
            'invalid-point attacks on unvalidated inputs.',
          'The industry\'s answer was not better advice about parameters but primitives that do ' +
            'not expose any. It is the same move that produced AEAD and Argon2\'s single-call ' +
            'interface.'
        ],
        example: 'The section’s insight names this as the transferable lesson: when a parameter ' +
          'can be wrong, eventually it will be.'
      }
    ],

    'signatures-and-pki': [
      {
        term: 'A signature convinces a third party; a MAC cannot',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["a MAC: the key is SHARED"] --> B["the verifier could have<br/>produced the tag themselves"]',
            '    B --> C["so it proves nothing<br/>to anyone else"]',
            '    D["a signature: the private key<br/>belongs to one party"] --> E["only they could have made it"]',
            '    E --> F["which is what non-repudiation<br/>actually means"]'
          ].join('\n'),
          caption: 'They both detect tampering, and only one of them survives being shown to a third party. Choosing between them is choosing whether anyone else has to be convinced.'
        },
        plain: 'A MAC key is shared, so the verifier could have produced the tag.',
        formal: 'signing uses a private key and verification a public one, so a valid signature identifies the key holder to anyone',
        detail: [
          'That difference decides where each belongs. Per-packet authentication between two ends ' +
            'that already share a key should use a MAC, which costs one or two hash passes ' +
            'instead of an elliptic-curve operation.',
          'Anything a third party must be able to check later needs a signature: a certificate, a ' +
            'signed release, an audit log entry.',
          'A MAC over any of those proves nothing to anyone who was not already holding the key.'
        ],
        example: 'The demo’s comparison table gives six properties and marks non-repudiation as ' +
          'the row only signatures answer.'
      },
      {
        term: 'ECDSA needs a fresh secret nonce every time',
        plain: 'Reusing one hands over the private key.',
        formal: 'from two signatures sharing r: k = (z₁ − z₂)·(s₁ − s₂)⁻¹ and d = (s₁·k − z₁)·r⁻¹, all mod n',
        readAs: 'Subtract the two message hashes and divide by the difference of the two ' +
          'signature values. That is the nonce. Substitute it back into either signature ' +
          'equation and the private key falls out. Everything is arithmetic modulo the group ' +
          'order.',
        detail: [
          'Two subtractions and two modular inverses, and the key is out. The symptom is public: ' +
            'signatures sharing a nonce share the value r, which sits in the signature itself.',
          'Anyone scanning a blockchain or a firmware archive can spot it. No weakness in the ' +
            'curve is needed, no side channel, no access to the signer.',
          'The failure is total and retroactive: every signature that key ever made becomes ' +
            'forgeable.'
        ],
        example: 'The demo recovers the private key 1234 from two signatures sharing r = 1854 on ' +
          'a curve of order 3 359.'
      },
      {
        term: 'This is not theoretical: PS3 and Bitcoin wallets',
        plain: 'Same bug, different decade.',
        formal: 'Sony used a constant nonce in 2010; Android’s SecureRandom repeated values in 2013',
        detail: [
          'The PlayStation 3 firmware signing key was extracted because the signer used a fixed k ' +
            'rather than a random one. Bitcoin wallets on Android lost funds because a broken ' +
            'SecureRandom repeated values across signatures.',
          'Both are the same arithmetic as the demo, on real keys, in shipped software.',
          'A scheme whose security depends on the caller doing something correctly every single ' +
            'time will eventually meet a caller who does not.'
        ],
        example: 'The section’s insight names both incidents as instances of one bug.'
      },
      {
        term: 'Deterministic nonces remove the requirement',
        plain: 'Derive k from the private key and the message hash.',
        formal: 'RFC 6979 sets k = HMAC(private key, hash(message)), which never repeats across different messages and needs no entropy',
        detail: [
          'The derived nonce is unpredictable to anyone without the key, and it differs whenever ' +
            'the message differs. It is also stable across runs: signing the same message twice ' +
            'gives the same signature, which is useful for testing and reproducible builds.',
          'No entropy is consumed at signing time, so there is no random number generator to fail.',
          'EdDSA builds the same idea into the scheme rather than offering it as an option.'
        ],
        example: 'The demo’s deterministic mode produces nonces 1 683 and 460 for its two ' +
          'messages, and the recovery finds nothing.'
      },
      {
        term: 'Validation is a list, and every item has been skipped by somebody',
        plain: 'Signature, validity window, basic constraints, key usage, issuer linkage, name.',
        formal: 'a chain is valid only if every check passes at every link, up to a trusted anchor',
        detail: [
          'Each item is a separate way a chain can be wrong. A client that omits any one accepts ' +
            'certificates it should not, while every other check still passes — which is exactly ' +
            'why the omission is invisible.',
          'The basic-constraints check is the historically important one. Without it, anyone ' +
            'holding any valid leaf certificate could issue a certificate for any site.',
          'Real validation adds more still: extended key usage, name constraints, path length, ' +
            'algorithm policy.'
        ],
        example: 'The demo runs 9 checks on a well-formed chain and 14 on the leaf-signs-leaf ' +
          'case, naming the failing one.'
      },
      {
        term: 'Wildcard matching is narrower than people assume',
        plain: '*.example.com matches shop.example.com and nothing deeper.',
        formal: 'a wildcard covers exactly one label, and never the bare domain',
        detail: [
          'So `*.example.com` does NOT match `a.b.example.com` and does NOT match `example.com`.',
          'Implementing that comparison loosely is a certificate-validation bug of the same class ' +
            'as skipping a check, and it has shipped repeatedly. So has accepting a wildcard in ' +
            'the middle of a name, or treating an embedded null byte as a terminator.',
          'Name matching is string handling, which is why it fails in ways the cryptography never ' +
            'does.'
        ],
        example: 'The demo’s wrong-host chain fails exactly one check: the host-name match against ' +
          'the leaf.'
      },
      {
        term: 'Revocation barely works, so certificates got short',
        plain: 'CRLs went stale and OCSP fails open.',
        formal: 'an attacker able to use a stolen certificate can generally also block the query that would report it stolen',
        detail: [
          'Certificate revocation lists grew large and cached, so browsers largely stopped ' +
            'fetching them.',
          'OCSP added a third-party round trip on every connection, leaked browsing to the CA, ' +
            'and failed open when unreachable. Stapling helps only where the server cooperates.',
          'The practical answer became short-lived certificates, where expiry does the work of ' +
            'revocation, plus automation reliable enough to renew them.'
        ],
        example: 'The demo’s revocation table gives five mechanisms and marks two as effectively ' +
          'abandoned.'
      },
      {
        term: 'Certificate Transparency detects rather than prevents',
        plain: 'Every issued certificate is logged publicly and monitored.',
        formal: 'a browser requires proof of inclusion in public logs, so misissuance cannot be done quietly',
        detail: [
          'It is a different kind of answer from revocation, and it has proved more useful. It ' +
            'does not stop a CA issuing a certificate it should not, but it makes doing so ' +
            'visible.',
          'The domain owner sees it, and so does anyone watching the logs. That has caught real ' +
            'misissuance.',
          'The underlying mechanism is a Merkle tree with inclusion and consistency proofs, which ' +
            'the applied-constructions section builds.'
        ],
        example: 'The demo’s revocation table lists it as required by browsers and notes it ' +
          'detects rather than prevents.'
      }
    ],

    'protocol-construction': [
      {
        term: 'A protocol is what turns primitives into a conversation',
        plain: 'Who is the peer, which keys, what about replays, what survives a restart.',
        formal: 'a protocol specifies identity binding, key schedule, message ordering, freshness and state handling',
        detail: [
          'Each of those is a place to be attacked, and none is a primitive.',
          'Encryption protects a message. It does not decide who the other party is, or which ' +
            'keys this session uses.',
          'Nor does it say what happens when a message arrives twice or out of order, or what an ' +
            'attacker learns from stored state after a crash.',
          'Assembling a protocol from primitives is a research activity. That is why Noise, ' +
            'TLS 1.3 and the double ratchet exist as analysed designs to adopt.'
        ],
        example: 'The demo runs an 8-message conversation with 10 ratchet steps and checks that ' +
          'both sides derived matching keys every time.'
      },
      {
        term: 'Key agreement without authentication buys nothing against an active attacker',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["you run Diffie-Hellman"] --> B["and agree a key with<br/>whoever answered"]',
            '    B --> C["an attacker in the middle answers,<br/>and runs it twice"]',
            '    C --> D["one key with you,<br/>another with the server"]',
            '    D --> E["perfect encryption, on both legs,<br/>readable throughout"]'
          ].join('\n'),
          caption: 'The maths is not broken; the peer was never established. Authentication is what turns a shared secret into a shared secret with somebody in particular.'
        },
        plain: 'You agree a key with whoever answered.',
        formal: 'unauthenticated Diffie–Hellman is secure against eavesdropping and defenceless against a machine in the middle',
        detail: [
          'An attacker who can modify traffic runs two exchanges, one with each party. They read ' +
            'everything while both sides believe they have a secure channel.',
          'Binding the exchange to an identity is the other half of the protocol: a signature ' +
            'over the transcript, a certificate chain, or a pre-shared key.',
          'Which of those you use is a trust-model decision. Having none of them is not a weaker ' +
            'choice but a different threat model.'
        ],
        example: 'The public-key section’s exchange table has no authentication in any of its ' +
          '5 rows, and says so.'
      },
      {
        term: 'Forward secrecy: a key stolen today does not open yesterday',
        plain: 'Derive the message key, then replace the chain key with a hash of itself.',
        formal: 'the chain runs one way, so earlier message keys cannot be reconstructed from a later state',
        detail: [
          'The mechanism is one hash per message and nothing else.',
          'An attacker who steals the chain state at message k derives every message key from k ' +
            'onward, because deriving forward is exactly what the legitimate party does. They ' +
            'recover nothing before k, because hashing does not invert.',
          'That bounds the past perfectly and the future not at all, which is precisely why a ' +
            'second mechanism is required.'
        ],
        example: 'The demo steals the state at message 3 of 10 and reports 3 messages closed and ' +
          'the rest exposed.'
      },
      {
        term: 'Post-compromise security: a key stolen today stops working tomorrow',
        plain: 'Mix new Diffie–Hellman output into the root on every change of direction.',
        formal: 'a DH ratchet introduces secret material the attacker never observed, so the chain they track diverges',
        detail: [
          'This is the opposite bound from forward secrecy, and it needs a different mechanism. A ' +
            'one-way chain cannot introduce anything new.',
          'The important property is that recovery is not a repair action anybody takes. Nobody ' +
            'detected the compromise and nobody rotated anything.',
          'The protocol heals because turning the ratchet is what it does anyway when the ' +
            'conversation changes direction.'
        ],
        example: 'The demo’s attacker reads messages 3, 4 and 5 and loses access at message 6, ' +
          'where the ratchet turns.'
      },
      {
        term: 'The double ratchet is double because neither half suffices',
        plain: 'The symmetric ratchet protects the past; the DH ratchet protects the future.',
        formal: 'a hash chain per message plus a key exchange per turn, and each provides only its own property',
        detail: [
          'Treating these as degrees of "how secure is the protocol" is the mistake the demo is ' +
            'built to prevent. They are separate questions with separate answers, and a system ' +
            'can have either, both or neither.',
          'The costs are also different. One hash per message is nothing, while a key exchange ' +
            'per turn is real work.',
          'That is why the DH ratchet runs on direction changes rather than on every message.'
        ],
        example: 'The demo’s conversation shows 5 direction changes across 8 messages, each ' +
          'triggering a ratchet on both sides.'
      },
      {
        term: 'Replay protection is a separate property again',
        plain: 'An attacker who cannot read or modify can still send it twice.',
        formal: 'freshness needs counters, a sliding acceptance window and keys deleted after use; authenticated encryption does not imply it',
        detail: [
          'A captured ciphertext with a valid tag remains valid forever, unless something tracks ' +
            'what has already been accepted.',
          'The ratchet gets this by construction, because a message key is used once and ' +
            'discarded.',
          'TLS 1.3\'s 0-RTT mode is the instructive counterexample. Early data is replayable by ' +
            'design, traded deliberately for a round trip, which is why it is restricted to ' +
            'idempotent requests.'
        ],
        example: 'The demo’s properties table gives replay its own row and names 0-RTT as the ' +
          'explicit exception.'
      },
      {
        term: 'Downgrade attacks target the negotiation',
        plain: 'If both ends can be steered to a weaker option, the strong one is irrelevant.',
        formal: 'authenticate the transcript of the negotiation, and remove negotiable options entirely',
        detail: [
          'TLS 1.3 responded on both fronts. It cut the negotiable surface to almost nothing: no ' +
            'static RSA key transport, no CBC suites, no compression, a short list of curves.',
          'It also authenticates the handshake transcript. An attacker who edits the ClientHello ' +
            'to remove strong options changes the transcript, and both ends detect it.',
          'Removing the option is the stronger fix, because it cannot be misconfigured.'
        ],
        example: 'The demo’s handshake table shows the signature and the Finished MAC both ' +
          'covering the transcript rather than the message.'
      },
      {
        term: '"We use TLS" answers neither question about your store',
        plain: 'Transport security ends at the server.',
        formal: 'properties of the channel do not extend to data the application then writes down',
        detail: [
          'TLS gives forward secrecy on the wire, and it terminates at the server.',
          'Suppose the application then stores plaintext, or stores ciphertext under a key that ' +
            'has not changed since deployment. Neither forward secrecy nor post-compromise ' +
            'security applies to the data that actually matters.',
          'The threat model for the store is a different one, and answering it needs a design at ' +
            'the application layer rather than a transport setting.'
        ],
        example: 'The section’s insight makes this the practical consequence of separating the ' +
          'two properties.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));

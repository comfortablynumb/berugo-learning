# M23 — Applied cryptography and constant-time programming

> **Track** Algorithms · **Depends on** M17, M22 · **Sections** 11 · **Effort** L

**Outcome.** Cryptography as an engineer uses it: which primitive answers which requirement, what
each one assumes, and the specific ways real deployments break. Every construction is implemented
for understanding and every section states plainly that the implementations are teaching artefacts,
not production code.

**Standing disclaimer (rendered on every section in this milestone).** These implementations are
for learning. They are not constant-time, not side-channel hardened, not audited, and must never
protect real data. Production code uses `crypto.subtle`, libsodium or an equivalent audited
library. The final section shows exactly what the platform's own implementations get wrong.

**Shared machinery introduced.** `machines/crypto-lab.js` — test-vector harness (NIST/RFC vectors),
an attack simulator (padding oracle, nonce reuse, ECB pattern leakage, timing measurement) and a
byte-level inspector; `viz/bitstream-view.js` reused from M22 for round-by-round state rendering.

---

## Sections

### 23.1 Threat models and primitive selection
- **Covers** — confidentiality, integrity, authenticity and non-repudiation as distinct goals;
  Kerckhoffs's principle; passive versus active adversaries; the chosen-plaintext and
  chosen-ciphertext models; security parameters and what "128-bit security" means; a decision map
  from requirement to primitive; and the specific reasons not to implement your own.
- **Demo** — requirement-to-primitive chooser: state the goal, the trust boundary and the threat,
  and the tool names the primitive, the standard parameters and the classic failure mode; every
  path ends at a named audited library API.
- **Diagram** — mermaid decision flowchart from security goal to primitive.
- **Lab** — given six scenarios, select the primitive and justify the parameters; graded against a
  rubric of acceptable answers with explanations for the rejected ones.
- **Senior insight** — most cryptographic failures in production are composition and parameter
  failures, not broken primitives. AES has never been the weak point in your system.

### 23.2 Randomness for cryptography
- **Covers** — the difference between a statistical PRNG (from M17) and a CSPRNG, entropy sources
  and estimation, `/dev/urandom` versus `/dev/random` and the myth about blocking, seeding at boot
  and in VMs and containers, fork safety, `crypto.getRandomValues`, and real key-generation failures
  caused by low entropy.
- **Demo** — side-by-side generation from a statistical PRNG and a CSPRNG: the statistical one is
  state-recovered from a short observed output and its future output is then predicted exactly, in
  the browser.
- **Diagram** — mermaid diagram of an entropy pool feeding a DRBG with reseeding.
- **Lab** — recover the state of a small LCG from consecutive outputs and predict the next values;
  tests assert exact prediction, demonstrating why a statistical PRNG can never generate keys.
- **Senior insight** — the 2012 Debian and embedded-device key studies found duplicate RSA keys in
  the wild because of low boot entropy; randomness failures are silent and total.

### 23.3 Hash functions and MACs
- **Covers** — preimage, second-preimage and collision resistance; the birthday bound; the
  Merkle–Damgård construction and length-extension attacks; sponge construction and SHA-3;
  SHA-2 versus SHA-3 versus BLAKE3; HMAC and why naive `hash(key || message)` fails; keyed hashing;
  and hash-based commitments.
- **Demo** — length-extension attack executed live against a naive `hash(secret || message)` MAC,
  forging a valid tag without the secret; the same attack fails against HMAC and against SHA-3.
- **Diagram** — mermaid diagram of the Merkle–Damgård chain showing why the internal state is the
  vulnerability.
- **Lab** — implement HMAC over a provided hash; tests assert agreement with RFC 4231 test vectors
  and that the naive construction is forgeable while HMAC is not.
- **Senior insight** — the length-extension property is why HMAC exists, and it is still being
  reinvented incorrectly in API-signing schemes today.

### 23.4 Password hashing and key derivation
- **Covers** — why fast hashes are wrong for passwords, salts and their purpose, peppers and where
  they live, bcrypt, scrypt and Argon2 with their cost parameters, memory hardness against GPUs and
  ASICs, PBKDF2's weakness, choosing parameters against a target verification time, upgrade paths
  for stored hashes, and credential-stuffing economics.
- **Demo** — cracking-cost calculator: choose an algorithm and parameters, see the verification time
  measured in the browser and the estimated attacker cost per billion guesses on commodity hardware;
  a slider shows how Argon2's memory parameter changes the attacker's economics.
- **Diagram** — mermaid diagram of the register/verify flow with salt storage and rehash-on-login.
- **Lab** — implement PBKDF2-HMAC and measure iterations against a 250 ms verification budget; tests
  assert agreement with RFC 6070 vectors and that the chosen iteration count meets the budget.
- **Senior insight** — the parameter, not the algorithm, is the security control, and it must be
  re-tuned as hardware improves — which requires the rehash-on-successful-login path that most
  systems never build.

### 23.5 Symmetric encryption and block cipher modes
- **Covers** — block ciphers as keyed permutations, the AES substitution–permutation structure and
  its rounds, key schedules, ECB's catastrophic pattern leakage, CBC with IV requirements, CTR
  turning a block cipher into a stream cipher, padding and padding-oracle attacks, bit-flipping
  attacks on unauthenticated modes, and stream ciphers (ChaCha20).
- **Demo** — encrypt an image in ECB and CBC and display both: the ECB penguin appears; then a
  padding-oracle attack decrypts a CBC ciphertext byte by byte using only the oracle's accept/reject
  answer, with the recovered plaintext filling in live.
- **Diagram** — mermaid diagram of CBC chaining and of the CTR keystream construction.
- **Lab** — implement CTR mode over a provided block cipher; tests assert round-trip, agreement with
  NIST vectors, and demonstrate the catastrophic keystream reuse when a nonce is repeated.
- **Senior insight** — the padding oracle needs only a yes/no answer, which means any error message
  or timing difference that distinguishes "bad padding" from "bad MAC" is a full plaintext
  disclosure.

### 23.6 Authenticated encryption
- **Covers** — why confidentiality without integrity is almost always wrong, encrypt-then-MAC versus
  MAC-then-encrypt versus encrypt-and-MAC, AEAD as the modern interface, AES-GCM and its
  catastrophic nonce-reuse failure (authentication-key recovery), ChaCha20-Poly1305, associated
  data, nonce management strategies (counter, random, SIV), and misuse-resistant modes.
- **Demo** — nonce-reuse attack on GCM: two messages encrypted under the same nonce, the keystream
  XOR recovered, and then the authentication key derived — with each step's arithmetic shown.
- **Diagram** — mermaid diagram of an AEAD interface with the associated-data channel.
- **Lab** — implement encrypt-then-MAC composition correctly with a constant-time tag comparison;
  tests assert tampered ciphertexts are rejected before decryption and that the comparison has no
  early exit.
- **Senior insight** — GCM's 96-bit nonce means random nonces are unsafe past roughly 2³² messages
  per key; a counter nonce plus a key-rotation policy is the design most systems should have
  written down and did not.

### 23.7 Public-key cryptography
- **Covers** — the discrete-log and factoring assumptions, RSA key generation, encryption and
  signing, why textbook RSA is broken and what OAEP and PSS do, small-exponent and shared-modulus
  pitfalls, Diffie–Hellman and the group-parameter requirements, elliptic curves (group law, scalar
  multiplication, Curve25519's design choices), ECDH, and key sizes across families.
- **Demo** — Diffie–Hellman over a small group, executed step by step with both parties' arithmetic
  visible and an eavesdropper's view alongside; then a small-parameter break by brute-force discrete
  log to show why the parameter size *is* the security.
- **Diagram** — mermaid sequence diagram of ECDH key agreement.
- **Lab** — implement RSA key generation, encryption and decryption for small primes, then break a
  textbook-RSA ciphertext with a chosen-ciphertext malleability attack; tests assert both the
  round-trip and the successful attack.
- **Senior insight** — RSA's failure modes are almost all padding and parameter failures. The maths
  is fine; the deployments were not, which is why modern protocols moved to X25519 and Ed25519 with
  no parameter choices to get wrong.

### 23.8 Signatures, certificates and PKI
- **Covers** — signature semantics versus MACs, ECDSA and the nonce-reuse key-recovery disaster,
  deterministic nonces (RFC 6979) and EdDSA, certificate structure and chain validation, name
  constraints and validation pitfalls, revocation (CRL, OCSP, stapling) and why it barely works,
  Certificate Transparency, and key pinning.
- **Demo** — ECDSA private-key recovery from two signatures sharing a nonce, computed live from the
  signature values; a certificate-chain validator that walks a real chain and shows each check
  (signature, validity window, name match, basic constraints, key usage).
- **Diagram** — mermaid diagram of a certificate chain with the checks applied at each link.
- **Lab** — implement chain validation including expiry, name matching and basic constraints; tests
  assert rejection of each individually-broken fixture chain, including the "leaf signs a leaf" case.
- **Senior insight** — the PlayStation 3 and several Bitcoin wallet compromises were the same
  ECDSA nonce bug. Deterministic nonces exist because "generate a good random number every time" is
  a requirement systems fail at.

### 23.9 Protocol construction
- **Covers** — what a protocol adds over primitives, key agreement plus authentication, forward
  secrecy and post-compromise security, replay protection and freshness, the TLS 1.3 handshake at
  the cryptographic level (previewing M50), the Signal double ratchet, downgrade attacks, and
  protocol-verification tools at a conceptual level.
- **Demo** — a double-ratchet session between two simulated parties: message keys derived per
  message, a compromise injected at a chosen point, and the demo shows exactly which past and future
  messages remain secure.
- **Diagram** — mermaid sequence diagram of the double ratchet's DH and symmetric ratchets.
- **Lab** — implement the symmetric-ratchet key derivation chain; tests assert forward secrecy by
  showing earlier message keys are not derivable from a later chain state.
- **Senior insight** — forward secrecy and post-compromise security are different properties with
  different mechanisms, and "we use TLS" answers neither question about your application-layer
  message store.

### 23.10 Constant-time programming and side channels
- **Covers** — timing attacks on comparison and table lookup, branch-on-secret and
  memory-access-on-secret as the two rules, constant-time selection and comparison patterns, cache-
  timing attacks on table-driven AES, blinding for RSA and ECC, compiler optimisations that
  reintroduce branches, and how to measure whether code is constant time.
- **Demo** — timing-attack laboratory: a naive early-exit comparison is attacked byte by byte using
  measured timing distributions in the browser, recovering a secret token; the constant-time
  comparison resists the same attack, with both timing distributions plotted.
- **Diagram** — mermaid flowchart contrasting a secret-dependent branch with a branchless select.
- **Lab** — implement constant-time `equals` and `select` with bit masks; tests assert functional
  correctness and that measured timing variance across secret values is within noise.
- **Senior insight** — `===` on a token is a remote timing oracle. Over a network the signal is
  small, but it is statistically recoverable, and the fix costs one function.

### 23.11 Applied constructions
- **Covers** — Shamir secret sharing and threshold schemes, commitment schemes, Merkle trees and
  inclusion proofs (used again in M54), hash chains, verifiable random functions, zero-knowledge
  proofs by intuition (graph three-colouring, Schnorr identification), multiparty computation and
  homomorphic encryption at a conceptual level, and the post-quantum transition with hybrid key
  exchange.
- **Demo** — Merkle-tree builder with inclusion proofs verifiable live and a tampered leaf detected;
  a Shamir sharing panel splits a secret into n shares and demonstrates that k−1 shares reveal
  nothing while k reconstruct exactly.
- **Diagram** — mermaid diagram of a Merkle inclusion proof path.
- **Lab** — implement Shamir secret sharing over a prime field with Lagrange reconstruction; tests
  assert exact reconstruction from any k shares and that k−1 shares leave every secret equally
  likely.
- **Senior insight** — Merkle proofs are the most reusable idea in this milestone: they turn "trust
  the server" into "verify one path", and they appear in Git, Certificate Transparency, blockchains,
  backups and replication protocols.

---

## Modules

| Path | Purpose |
|---|---|
| `src/js/algorithms/crypto-hash.js` | SHA-2 family, sponge/SHA-3 core, HMAC, length-extension demo |
| `src/js/algorithms/kdf.js` | PBKDF2, scrypt core, Argon2 structure with cost parameters |
| `src/js/algorithms/block-cipher.js` | AES-like SPN, key schedule, ECB/CBC/CTR modes, padding |
| `src/js/algorithms/aead.js` | GCM (GHASH), ChaCha20-Poly1305, encrypt-then-MAC composition |
| `src/js/algorithms/public-key.js` | RSA, Diffie–Hellman, elliptic-curve arithmetic, ECDH |
| `src/js/algorithms/signatures.js` | ECDSA, EdDSA, deterministic nonces, chain validation |
| `src/js/algorithms/ratchet.js` | Symmetric and DH ratchets |
| `src/js/algorithms/constant-time.js` | Branchless comparison, selection, masking helpers |
| `src/js/algorithms/threshold.js` | Shamir sharing, commitments, Merkle trees and proofs |
| `src/js/machines/crypto-lab.js` | Test vectors, attack simulators, timing measurement |

---

## Acceptance criteria

- [ ] Every primitive is validated against published test vectors (NIST, RFC); a primitive with no
      vector coverage does not ship.
- [ ] Every attack demo actually executes the attack in the browser and succeeds — no simulated
      "imagine the attacker recovers the key" narration.
- [ ] The standing disclaimer renders on every section in this milestone, enforced by a content
      test.
- [ ] Constant-time helpers are measured: the test asserts timing variance across secret values is
      statistically indistinguishable, and the naive versions fail the same measurement.
- [ ] Nonce-reuse, padding-oracle and length-extension demos each recover the stated secret from
      the fixture, asserted in tests.
- [ ] Shamir reconstruction succeeds from every k-subset and fails to constrain the secret with
      k−1, asserted over randomised splits.

---

## Sources

- Aumasson — *Serious Cryptography*
- Ferguson, Schneier, Kohno — *Cryptography Engineering*
- Katz, Lindell — *Introduction to Modern Cryptography*
- Vaudenay — *Security flaws induced by CBC padding*
- Joux — *Authentication failures in NIST version of GCM*
- Heninger et al. — *Mining your Ps and Qs: detection of widespread weak keys in network devices*
- Bernstein — *Curve25519* and *Cache-timing attacks on AES*
- Perrin, Marlinspike — *The double ratchet algorithm*
- Shamir — *How to share a secret*

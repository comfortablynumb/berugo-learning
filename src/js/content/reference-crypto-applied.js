/** Reference entries for constant-time code and applied constructions (M23.10-M23.11). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'constant-time-programming': {
      summary: 'A 4-byte token recovered from timing in 1 024 guesses against a brute-force ' +
        'space of 4.295 × 10⁹, the two timing distributions reported in standard deviations, and ' +
        'a noise-against-averaging sweep that prices how far away the attacker can stand.',
      intuition: 'Never branch on a secret and never index memory with a secret; everything else ' +
        'is those two rules applied.',
      formulation: {
        equations: [
          {
            label: 'The signal, and what averaging does to noise',
            expr: 'time ∝ shared prefix length · standard error of a mean falls as 1 ÷ √n',
            readAs: 'How long the comparison runs is proportional to how many leading bytes ' +
              'match, and the uncertainty in an average shrinks with the square root of the ' +
              'number of measurements it contains.',
            terms: [
              { sym: 'early exit, right first byte', meaning: '1.9746 ± 0.1098' },
              { sym: 'early exit, wrong first byte', meaning: '0.9939 ± 0.1080 — a separation of 4.5029 σ' },
              { sym: 'branchless, both cases', meaning: '3.9746 and 3.9939, a separation of 0.0885 σ' },
              { sym: 'what that means', meaning: 'quadrupling the samples halves the effective noise, so distance is a price' }
            ]
          },
          {
            label: 'The search collapse',
            expr: 'blind: 256^len · byte-at-a-time: len × 256',
            terms: [
              { sym: '4-byte token, blind', meaning: '4.295 × 10⁹ attempts' },
              { sym: '4-byte token, timed', meaning: '1 024 guesses, 40 960 individual timings' },
              { sym: '32-byte token, timed', meaning: '8 192 guesses — the length stops mattering' },
              { sym: 'why', meaning: 'the comparison leaks WHERE the first difference is' }
            ]
          },
          {
            label: 'Noise against averaging, early-exit comparison',
            expr: 'noise level · smallest sample count that recovers the token',
            terms: [
              { sym: 'same machine (0.4)', meaning: '10 samples per guess' },
              { sym: 'same data centre (1.2)', meaning: '10 samples per guess' },
              { sym: 'across the internet (3)', meaning: '80 samples per guess' },
              { sym: 'congested internet (6)', meaning: '320 samples per guess' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'No branch and no memory index depends on a secret',
          why: 'The first leaks through time and branch prediction, the second through the cache.',
          breaks: 'An early-exit comparison turns a 4.295 × 10⁹ search into 1 024 guesses.'
        },
        {
          name: 'Constant-time claims are measured, not asserted',
          why: 'Branchless source is not branchless code, and the next compiler may choose differently.',
          breaks: 'The only durable check is a separation figure that can be regression-tested: 0.0885 σ against 4.5029.'
        },
        {
          name: 'Every secret comparison uses the library’s constant-time function',
          why: 'Comparing 32 bytes unconditionally is nothing next to the request that carried them.',
          breaks: 'There is no performance argument for the early exit; it survives because === is what people type.'
        }
      ],
      complexity: [
        { operation: 'constant-time equals', average: 'always the full length, one XOR and one OR per byte', worst: 'slower than an early exit on every mismatching input, by design' },
        { operation: 'branchless select', average: 'both branches computed, one mask applied', worst: 'twice the work of a conditional, and no timing signal' },
        { operation: 'constant-time table lookup', average: 'O(table size) per access', worst: 'expensive; hardware AES instructions exist to avoid it' },
        { operation: 'timing attack per byte', average: '256 guesses × samples-per-guess measurements', worst: 'more samples at higher noise, never failure' },
        { operation: 'cache-timing attack', average: 'requires co-resident code', worst: 'defeats a branchless implementation that still uses secret-derived indices' },
        { operation: 'blinding for RSA or ECC', average: 'one extra multiplication per operation', worst: 'necessary because a secret-dependent loop count is not fixable with masks' }
      ],
      failureModes: [
        {
          symptom: 'An API token or HMAC tag is guessed byte by byte by a remote attacker.',
          cause: 'The comparison exits at the first differing byte.',
          fix: 'crypto.timingSafeEqual, sodium_memcmp, or the equivalent. One function.'
        },
        {
          symptom: 'A key is extracted by a process on the same machine with no network access.',
          cause: 'A table-driven cipher indexes its S-box with key-derived values, and the cache is shared.',
          fix: 'Hardware AES instructions, a bit-sliced implementation, or a full-table scan.'
        },
        {
          symptom: 'Code that was constant time last year is not after a compiler upgrade.',
          cause: 'The optimiser recognised the select pattern and lowered it to a branch.',
          fix: 'Volatile barriers or assembly, and a timing measurement in CI rather than a comment.'
        },
        {
          symptom: 'A padding failure and a MAC failure take different amounts of time.',
          cause: 'Two rejection paths, which is the same leak at protocol level.',
          fix: 'Compute both, combine, and return one indistinguishable failure — or use an AEAD.'
        }
      ],
      inTheWild: [
        'Brumley and Boneh’s 2003 remote timing attack on OpenSSL, which settled whether network noise protects you.',
        'Bernstein’s cache-timing attack on AES, which is why hardware AES instructions exist.',
        'crypto.timingSafeEqual in Node, sodium_memcmp in libsodium, and hmac.compare_digest in Python.',
        'Lucky Thirteen, which recovered TLS plaintext from timing differences of a few microseconds.'
      ],
      sources: [
        { title: 'Kocher — Timing attacks on implementations of Diffie-Hellman, RSA, DSS (1996)', note: 'the paper that made timing a first-class channel' },
        { title: 'Brumley and Boneh — Remote timing attacks are practical (2003)', note: 'the same attack over a network, against OpenSSL' },
        { title: 'Bernstein — Cache-timing attacks on AES (2005)', note: 'why a secret-derived table index leaks even with no branches' },
        { title: 'Almeida, Barbosa, Barthe, Dupressoir and Emmi — Verifying constant-time implementations (2016)', note: 'tooling that checks the property on emitted code rather than on source' }
      ]
    },

    'applied-constructions': {
      summary: 'Every three-share subset of a five-way Shamir split reconstructing the same ' +
        'secret, eight candidate secrets all still consistent with two shares, and a Merkle ' +
        'inclusion proof of three hashes verified and then rejected against an edited leaf.',
      intuition: 'Merkle proofs turn "trust the server" into "verify one path", which is why the ' +
        'shape appears in Git, Certificate Transparency, blockchains, backups and replication.',
      formulation: {
        equations: [
          {
            label: 'Shamir sharing',
            expr: 'f(x) = s + a₁x + … + a_(k−1)x^(k−1) mod p · share i is (i, f(i)) · s = f(0) by Lagrange',
            readAs: 'Build a polynomial of degree k minus one whose constant term is the secret ' +
              'and whose other coefficients are random; each share is the polynomial evaluated ' +
              'at a different point, and interpolating any k of them back to zero returns the ' +
              'secret.',
            terms: [
              { sym: 'the demo split', meaning: 'secret 1 234 567, n = 5, k = 3, prime 2 147 483 647' },
              { sym: 'any k reconstruct', meaning: '10 of 10 three-share subsets return 1 234 567' },
              { sym: 'k − 1 reconstruct', meaning: '446 296 622 — a number, silently, with no error' },
              { sym: 'what k − 1 shares rule out', meaning: 'nothing: 8 of 8 candidates tested remain consistent' }
            ]
          },
          {
            label: 'Merkle trees',
            expr: 'leaf = H(0x00 ‖ value) · node = H(0x01 ‖ left ‖ right) · proof = ⌈log₂ n⌉ siblings',
            readAs: 'Hash each entry with one prefix and each internal node with another over its ' +
              'two children, and an inclusion proof is the sibling hash at each level, about ' +
              'log-base-two of n of them.',
            terms: [
              { sym: 'domain separation', meaning: 'the 0x00 and 0x01 prefixes stop a leaf being read as a node' },
              { sym: 'the odd leaf', meaning: 'carried up, not duplicated — duplicating is CVE-2012-2459' },
              { sym: 'the demo tree', meaning: '7 leaves, 4 levels, proofs of 3 hashes and 2 for the odd leaf' },
              { sym: 'tampering', meaning: 'the same proof against an edited value fails' }
            ]
          },
          {
            label: 'Proof cost against sending the list, 32-byte hashes',
            expr: 'entries · proof hashes · proof bytes · full list · saving',
            terms: [
              { sym: '1 024', meaning: '10 · 320 B · 32.0 KB · 102.4×' },
              { sym: '1 048 576', meaning: '20 · 640 B · 33.6 MB · 52 428.8×' },
              { sym: '1 073 741 824', meaning: '30 · 960 B · 34.4 GB · about 35 million×' },
              { sym: 'what the verifier holds', meaning: 'the root and nothing else' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The share count is checked before reconstruction is attempted',
          why: 'Interpolating too few points is a well-defined operation that returns a wrong value.',
          breaks: 'The demo returns 446 296 622 from 2 of 3 required shares, with nothing signalling the shortfall.'
        },
        {
          name: 'A commitment includes a random opening value',
          why: 'Hiding comes from the opening; binding comes from collision resistance, and they are different properties.',
          breaks: 'Without it, a short message is found by hashing every candidate and comparing.'
        },
        {
          name: 'An unpaired node in a Merkle level is carried up, never duplicated',
          why: 'Duplicating lets two different lists build the same tree and produce the same root.',
          breaks: 'Bitcoin shipped the duplicating version and had to fix it as CVE-2012-2459.'
        },
        {
          name: 'Leaves and internal nodes are hashed with different prefixes',
          why: 'Otherwise a leaf whose value happens to be two concatenated hashes can be presented as a node.',
          breaks: 'Second-preimage attacks on Merkle trees exist precisely where domain separation is missing.'
        }
      ],
      complexity: [
        { operation: 'Shamir split', average: 'O(n·k) field operations for n shares', worst: 'shares are as large as the secret' },
        { operation: 'Shamir reconstruct', average: 'O(k²) field operations by Lagrange interpolation', worst: 'no integrity — a wrong share corrupts the result silently' },
        { operation: 'commitment', average: 'one hash over the opening and the message', worst: 'hiding fails without a random opening' },
        { operation: 'Merkle tree build', average: 'O(n) hashes, O(n) space', worst: 'the whole list must be present to build the root' },
        { operation: 'inclusion proof', average: 'ceil(log2 n) hashes to generate and to verify', worst: '30 hashes at a billion entries' },
        { operation: 'anti-entropy range comparison', average: 'O(log n) to find where two replicas diverge', worst: 'O(n) when everything differs' }
      ],
      failureModes: [
        {
          symptom: 'A key reconstructed from shares decrypts nothing, with no error anywhere.',
          cause: 'Fewer than k shares were supplied, and interpolation returned a valid-looking wrong value.',
          fix: 'Count the shares, and verify the reconstructed key against a stored commitment.'
        },
        {
          symptom: 'A share holder submits a corrupted share and the reconstruction is silently wrong.',
          cause: 'Plain Shamir provides no integrity on shares.',
          fix: 'Verifiable secret sharing, or commit to each share so a bad one can be identified.'
        },
        {
          symptom: 'Two different transaction lists produce the same Merkle root.',
          cause: 'An unpaired node was duplicated rather than carried up.',
          fix: 'Carry it, and reject trees whose shape is ambiguous. This is CVE-2012-2459.'
        },
        {
          symptom: 'A commitment turns out to be openable to a second message.',
          cause: 'Either a collision in the hash, or no domain separation between what is being committed to.',
          fix: 'A 256-bit hash, a random opening and explicit prefixes for each kind of input.'
        }
      ],
      inTheWild: [
        'Certificate Transparency, whose inclusion and consistency proofs are exactly this construction.',
        'Git, where a commit hash commits to the entire tree of files beneath it.',
        'HashiCorp Vault’s unseal keys, which are a Shamir split across operators.',
        'Cassandra and DynamoDB anti-entropy, which compares Merkle ranges to find which keys diverged.'
      ],
      sources: [
        { title: 'Shamir — How to share a secret (1979)', note: 'the polynomial construction and the information-theoretic argument' },
        { title: 'Merkle — A certified digital signature (1979)', note: 'the tree, and inclusion proofs as a way to commit to many values at once' },
        { title: 'Laurie, Langley and Kasper — Certificate Transparency (RFC 6962)', note: 'inclusion and consistency proofs deployed at internet scale' },
        { title: 'Bitcoin CVE-2012-2459', note: 'the duplicated-node bug, and why tree shape is part of the commitment' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));

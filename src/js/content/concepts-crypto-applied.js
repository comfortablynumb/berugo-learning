/** Concepts for constant-time programming and applied constructions (M23.10-M23.11). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'constant-time-programming': [
      {
        term: 'Two rules cover almost everything',
        plain: 'Do not branch on a secret; do not index memory with a secret.',
        formal: 'a secret-dependent branch leaks through time and prediction; a secret-dependent address leaks through the cache',
        detail: 'Every constant-time pattern is one of those two rules applied. The first is ' +
          'observable from anywhere, including across a network, because a branch changes how ' +
          'long the code runs. The second is observable to anything sharing the cache, which on a ' +
          'multi-tenant machine is a stranger. Stating them as rules rather than as a list of ' +
          'patterns is what makes them usable in review: the question becomes whether ' +
          'anything secret reaches a condition or an index.',
        example: 'The demo’s pattern table gives six replacements, and every one removes a branch ' +
          'or a secret-derived index.'
      },
      {
        term: '=== on a token is a remote timing oracle',
        plain: 'A comparison that exits on the first difference takes longer for a better guess.',
        formal: 'time ∝ length of the shared prefix, so averaging enough samples reveals each byte in turn',
        readAs: 'The time taken is proportional to how many leading bytes match, so an attacker ' +
          'who averages enough measurements can tell a guess with a correct prefix from one ' +
          'without.',
        detail: 'The signal is one loop iteration, which is tiny, and that is not a defence — ' +
          'averaging suppresses noise as the square root of the sample count, so an attacker on a ' +
          'noisy link pays more measurements and is not stopped. The 2003 remote-timing work ' +
          'against OpenSSL settled the question of whether network noise protects you: it does ' +
          'not, it just sets a price.',
        example: 'The demo separates a right first byte from a wrong one by 4.5029 standard ' +
          'deviations at moderate noise.'
      },
      {
        term: 'It collapses an exponential search into a linear one',
        plain: 'Byte at a time instead of the whole token at once.',
        formal: 'guessing a 4-byte token blind costs 2³² attempts; byte-at-a-time costs 4 × 256 = 1 024',
        detail: 'That is the actual damage, and it is not "somewhat easier" — it is the whole ' +
          'security of the token. The same collapse applies at any length, so a 32-byte session ' +
          'token that would take 2²⁵⁶ guesses to forge takes 8 192, which is a few seconds of ' +
          'requests. The length of the secret stops mattering once the comparison leaks where the ' +
          'first difference is.',
        example: 'The demo reports 1 024 guesses against a brute-force space of 4.295 × 10⁹, ' +
          'using 40 960 individual timings.'
      },
      {
        term: 'Distance costs measurements, and the sweep prices it',
        plain: 'More noise, more averaging, same outcome.',
        formal: 'the standard error of a mean falls as 1/√n, so quadrupling samples halves the effective noise',
        readAs: 'The uncertainty in an average shrinks with the square root of how many ' +
          'measurements it contains, so four times as many samples makes the noise half as large ' +
          'relative to the signal.',
        detail: 'This is why "the signal is too small over the internet" has never been a ' +
          'defence: it converts a security property into a budget. The sweep makes the exchange ' +
          'rate visible — at low noise ten samples per guess suffice, and each step up in noise ' +
          'demands roughly a quadrupling to keep the same confidence. An attacker who can make ' +
          'requests can always pay.',
        example: 'The demo recovers the token at every sample count at low noise, needs 80 at ' +
          'internet noise, and 320 at congested-internet noise.'
      },
      {
        term: 'The constant-time version is measured, not asserted',
        plain: 'Report the separation, not the intention.',
        formal: 'a constant-time comparison should show right-byte and wrong-byte timings separated by well under one deviation',
        detail: 'Writing branchless source is not the same as running branchless code, so the ' +
          'only check that survives a compiler upgrade is a measurement. Reporting the separation ' +
          'in standard deviations gives a number that can be regression-tested, and the ' +
          'difference between a leaking and a non-leaking implementation is stark rather than ' +
          'marginal — several deviations against a fraction of one.',
        example: 'The demo reports 4.5029 σ for the early-exit comparison and 0.0885 σ for the ' +
          'masked one, under identical conditions.'
      },
      {
        term: 'The constant-time version is slower, and that is the whole cost',
        plain: 'It always compares every byte.',
        formal: 'the branchless comparison performs the full length of work on every call, including calls that would have exited on byte one',
        detail: 'There is no performance argument for the early exit in this setting: comparing ' +
          '32 bytes unconditionally is nothing next to the request that carried them. The reason ' +
          'the variable-time version survives in code is that `a === b` is what everyone types, ' +
          'not that anyone chose it for speed — which is exactly why it belongs on a review ' +
          'checklist rather than in a performance discussion.',
        example: 'The demo’s profile table shows the branchless row with a higher absolute mean ' +
          'than the early-exit row on both inputs.'
      },
      {
        term: 'Table lookups leak through the cache with no branches at all',
        plain: 'Which cache line you fetch depends on the secret index.',
        formal: 'a secret-derived index into an S-box reveals its high bits through cache-timing measurement',
        detail: 'The original cache-timing attacks on AES exploited exactly this: table-driven ' +
          'implementations index an S-box with key-derived values, and an attacker sharing the ' +
          'cache learns which lines were touched. The fixes are structural — bit-sliced ' +
          'implementations that use no tables, hardware AES instructions that keep the S-box off ' +
          'the data cache, or scanning the whole table with masks so every line is touched every ' +
          'time.',
        example: 'The demo’s channel table lists cache timing with its requirement — code running ' +
          'on the same machine — and its three defences.'
      },
      {
        term: 'A compiler will happily reintroduce the branch',
        plain: 'Branchless source is not branchless code.',
        formal: 'optimisers recognise select patterns and lower them to conditional jumps, so source-level discipline is not a guarantee',
        detail: 'Real implementations use volatile barriers, hand-written assembly, or ' +
          'verification tools that inspect the emitted instructions — and then measure, because ' +
          'the next compiler version may make a different choice. This is also why JavaScript ' +
          'cannot offer the guarantee at all: the JIT, the garbage collector and the engine\'s ' +
          'internal value representations all vary with data in ways the source cannot control.',
        example: 'The section states this in its orientation and marks the whole milestone’s code ' +
          'as unsuitable for real data on exactly these grounds.'
      }
    ],

    'applied-constructions': [
      {
        term: 'Shamir sharing is a fact about polynomials',
        plain: 'A degree k−1 polynomial is determined by any k points and by no fewer.',
        formal: 'put the secret in the constant term, hand out points; Lagrange interpolation at zero recovers it from any k',
        readAs: 'Choose a polynomial whose value at zero is the secret and whose other ' +
          'coefficients are random, give each holder the value at a different input, and any k of ' +
          'those values reconstruct the value at zero exactly.',
        detail: 'The shares are interchangeable, which is the operational value: a key can be ' +
          'split across five people or five regions and any k of them can act, with no single ' +
          'holder able to act alone and no single holder indispensable. Losing up to n − k shares ' +
          'is survivable, so it is an availability mechanism as much as a confidentiality one — ' +
          'which is how it is usually deployed, for root keys and recovery procedures.',
        example: 'The demo splits one secret into 5 shares at threshold 3 and all 10 three-share ' +
          'subsets reconstruct it exactly.'
      },
      {
        term: 'k − 1 shares constrain nothing at all',
        plain: 'Every candidate secret is still consistent with what the attacker holds.',
        formal: 'for each candidate constant term there is exactly one polynomial of degree k−1 through the held shares',
        detail: 'This is information-theoretic rather than computational: the shares eliminate no ' +
          'possibilities, so no amount of computation helps and no future algorithm changes it. ' +
          'That is a stronger guarantee than anything else in the milestone, all of which rests ' +
          'on some problem being hard. The cost is that the shares are as large as the secret and ' +
          'the scheme provides no integrity — a holder who submits a wrong share corrupts the ' +
          'reconstruction silently.',
        example: 'The demo tests 8 candidate secrets against 2 held shares and every one is ' +
          'consistent, each implying a different value for a share nobody holds.'
      },
      {
        term: 'Too few shares fails silently, which is the trap',
        plain: 'The arithmetic does not error; it returns a wrong number.',
        formal: 'interpolating k−1 points fits a lower-degree polynomial and reports its constant term',
        detail: 'Nothing signals the shortfall. Lagrange interpolation through fewer points is a ' +
          'perfectly well-defined operation that returns a value with no relationship to the ' +
          'secret, so a system that does not check the share count will happily decrypt with the ' +
          'wrong key and report a decryption failure somewhere further downstream — or, worse, ' +
          'succeed at something. Counting shares before reconstructing is a required step.',
        example: 'With 2 of 5 shares at threshold 3 the demo reconstructs 446 296 622 against a ' +
          'true secret of 1 234 567.'
      },
      {
        term: 'A commitment is "I have decided and cannot change my mind"',
        plain: 'Hash the message with a random opening value.',
        formal: 'hiding: the commitment reveals nothing without the opening; binding: opening it two ways needs a hash collision',
        detail: 'The random opening is what provides hiding — without it, an attacker who can ' +
          'guess a short message simply hashes every candidate and compares. Binding comes free ' +
          'from collision resistance, so the two properties come from different places and both ' +
          'are needed. Sealed bids, fair coin flips and random beacons that nobody can bias are ' +
          'all this construction, and it is one of the cheapest useful things in cryptography.',
        example: 'The demo opens a commitment correctly and then fails to open the same ' +
          'commitment to a different message.'
      },
      {
        term: 'A Merkle tree turns "trust the list" into "verify one path"',
        plain: 'Hash the leaves, hash the pairs, and the root commits to everything.',
        formal: 'an inclusion proof is the sibling hash at each level: ⌈log₂ n⌉ hashes, verified against a root the client already holds',
        readAs: 'To prove one entry belongs to a list of n entries, send the sibling hash at each ' +
          'level of the tree — about log-base-two of n of them — and the verifier recomputes the ' +
          'path upward and compares with the root they already trust.',
        detail: 'The verifier needs nothing else: not the other entries, not the tree, only the ' +
          'root. That is what makes the construction a systems tool rather than a cryptographic ' +
          'one — a client that cannot hold the data, cannot re-download it and does not trust the ' +
          'party serving it can still check any single answer. Changing any byte anywhere changes ' +
          'the root, so the commitment covers the whole list.',
        example: 'The demo proves one entry out of 7 with 3 sibling hashes and rejects the same ' +
          'proof against an edited leaf.'
      },
      {
        term: 'The cost ratio is why it is everywhere',
        plain: 'Thirty hashes to prove one entry in a billion.',
        formal: 'a proof is ⌈log₂ n⌉ × 32 bytes against n × 32 for the list: 960 bytes against 34 GB at a billion entries',
        readAs: 'The proof holds about log-base-two of n hashes of thirty-two bytes each, while ' +
          'the full list holds n of them, so at a billion entries the proof is under a kilobyte ' +
          'and the list is tens of gigabytes.',
        detail: 'That ratio is what makes light clients, transparency logs and incremental backup ' +
          'verification possible at all. It also sets the shape of systems built on it: the ' +
          'server holds everything and is untrusted, the client holds a root and is offline most ' +
          'of the time, and each answer arrives with its own proof. Recognising when a design has ' +
          'that shape is more valuable than the construction itself.',
        example: 'The demo tabulates four sizes; at 1 073 741 824 entries the proof is 30 hashes ' +
          'and the saving is about 35 million times.'
      },
      {
        term: 'The odd-leaf case is a real bug, not a detail',
        plain: 'Duplicating a lone node lets two different lists give the same root.',
        formal: 'carrying an unpaired node up is correct; hashing it with itself creates a second preimage of the root',
        detail: 'Bitcoin shipped the duplicating version and had to fix it as CVE-2012-2459, ' +
          'because a list with a duplicated final entry produced the same root as the list ' +
          'without it — which breaks the whole point of a commitment. The general lesson is that ' +
          'the tree\'s shape is part of the commitment, so anything that makes two different ' +
          'inputs build the same tree is a break even when the hash is perfect.',
        example: 'The demo lets you prove the odd leaf, whose path is 2 hashes rather than 3, ' +
          'because the lone node is carried rather than duplicated.'
      },
      {
        term: 'The wider family runs from here',
        plain: 'Hash chains, VRFs, zero-knowledge proofs and post-quantum hybrids.',
        formal: 'a hash chain is a Merkle tree with one branch; a VRF adds a proof that a pseudorandom output was computed correctly',
        detail: 'Zero-knowledge proofs generalise "convince me without telling me", of which ' +
          'Schnorr identification and the graph three-colouring protocol are the readable ' +
          'introductions. Post-quantum practice currently ships hybrids — a classical key ' +
          'exchange and a lattice one together, with the shared secret derived from both — so ' +
          'that a break in either leaves the other standing, which is the same defensive ' +
          'reasoning as everything else in the milestone.',
        example: 'The demo’s uses table lists six systems built on Merkle proofs, from Git to ' +
          'package registries.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));

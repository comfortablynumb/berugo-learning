/** Concepts for error detection and error correction (M22.10-M22.11). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'checksums-and-crc': [
      {
        term: 'A checksum is a claim about which corruptions it catches',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["the wrong question:<br/>is this data correct?"] --> B["no checksum answers that"]',
            '    C["the right question:<br/>which kinds of damage<br/>would I notice?"] --> D["single-bit flips? bursts?<br/>reordering? truncation?"]',
            '    D --> E["different checksums answer<br/>different subsets"]'
          ].join('\n'),
          caption: 'Choosing a checksum is choosing which failures you will find out about. A sum that cannot see reordering is not weak — it is answering a different question.'
        },
        plain: 'Not "is this right" but "which kinds of wrong would I notice".',
        formal: 'a detector catches an error exactly when the corrupted message hashes differently',
        detail: [
          'That framing is what makes the choice tractable.',
          'Every function here catches 100% of single-bit flips, so a test that checks only those ' +
            'cannot tell them apart.',
          'The differences appear on the error classes the medium actually produces: bursts on a ' +
            'disc or a radio link, reordering in reassembly, whole-word corruption in memory. The ' +
            'demo searches each class rather than quoting a claim about it.'
        ],
        example: 'The demo measures 100.0% on single-bit flips for all six detectors and 0.0% to ' +
          '100.0% on byte swaps.'
      },
      {
        term: 'A commutative sum cannot see reordering',
        plain: 'Swapping two bytes leaves the total unchanged.',
        formal: 'Σ is invariant under permutation, so any pure sum has a blind spot exactly there',
        readAs: 'A sum does not change when its terms are reordered, so a checksum built only ' +
          'from addition cannot detect that two bytes swapped places.',
        detail: [
          'This is not a theoretical concern. Misordered reassembly, a scatter-gather list built ' +
            'wrongly and an out-of-order write all produce exactly this corruption.',
          'A byte sum or a parity bit reports success every time.',
          'Fletcher and Adler fix it by keeping a running sum of the running sum, so each byte gets ' +
            'a weight that depends on its position. That is the minimum change that makes order ' +
            'matter.'
        ],
        example: 'The demo measures 0.0% of byte swaps caught by a plain sum, 50.3% by the ' +
          'Internet checksum and 99.2% by Fletcher-16.'
      },
      {
        term: 'CRC is polynomial division over GF(2)',
        plain: 'Bits are coefficients, addition is XOR, and the checksum is a remainder.',
        formal: 'CRC(m) = m·x^32 mod G(x), where G is the generator polynomial of degree 32',
        readAs: 'The checksum is the remainder when the message, shifted left by the generator’s ' +
          'degree, is divided by the generator polynomial.',
        detail: [
          'The algebra is what turns "usually catches errors" into proved guarantees.',
          'An error is undetected exactly when its own polynomial is divisible by the generator, so ' +
            'every question about detection becomes a question about divisibility.',
          'A burst shorter than the generator’s degree simply cannot be a multiple of it. That is a ' +
            'proof rather than a probability, which is why CRC is specified for storage and links.'
        ],
        example: 'The demo’s CRC-32 misses nothing at any burst length up to 34 bits in a search ' +
          'over every position.'
      },
      {
        term: 'Bursts are what hardware actually produces',
        plain: 'Not independent bit flips — scratches, interference, a bad sector.',
        formal: 'a burst of length k is an error confined to a window of k bits whose ends both moved',
        detail: [
          'That mismatch between the error model people imagine and the one media produce is why ' +
            'the width of a checksum is a poor guide to its usefulness.',
          'A 16-bit CRC beats a 32-bit sum on a channel that produces bursts, because the sum has a ' +
            'blind spot the burst walks straight into.',
          'Choosing a detector means asking what the medium does, not how many bits are available.'
        ],
        example: 'The demo measures the byte sum failing first at 9-bit bursts and the 16-bit ' +
          'checksums at 17. CRC-32 does not fail at all within range.'
      },
      {
        term: 'A guarantee from a sampled search is a different claim',
        plain: 'Say which lengths were checked exhaustively and which were sampled.',
        formal: 'a burst of length k has 2^(k−2) interior patterns; exhaustive verification stops being finishable around k = 12',
        readAs: 'The number of distinct bursts of length k grows as two to the power k minus two, ' +
          'so an exhaustive search runs out of time well before k reaches thirty-two.',
        detail: [
          'Verifying "every burst of 32 bits is detected" exhaustively would need a billion patterns ' +
            'per position. Any demo that claims it has either proved a theorem or sampled.',
          'Reporting both columns is the difference between a measurement and a quotation dressed as ' +
            'one.',
          'Those columns are the exhaustively verified prefix, and the longest length where nothing ' +
            'was missed.'
        ],
        example: 'The demo reports CRC-32 as exhaustively verified to 9 bits and missing nothing ' +
          'up to 34.'
      },
      {
        term: 'The table-driven implementation is checked against the definition',
        plain: 'Two implementations, and the published vectors.',
        formal: 'a 256-entry table gives one lookup and one XOR per byte; slicing-by-8 does a word at a time',
        detail: [
          'A checksum implementation that is subtly wrong still produces a stable, plausible-looking ' +
            'value for every input, so nothing about its output reveals the bug.',
          'The only defence is agreement with somebody else’s answer.',
          'That means the bit-at-a-time version derived straight from the definition, and the ' +
            'published check values that appear in every CRC catalogue for exactly this purpose.'
        ],
        example: 'The demo checks 5 of 5 published vectors, including CRC-32 of "123456789" = ' +
          '0xcbf43926, against both implementations.'
      },
      {
        term: 'A CRC is public and invertible, so it forges in microseconds',
        plain: 'Four appended bytes make it come out to any value you choose.',
        formal: 'CRC is affine in its input: crc(prefix ‖ s) = crc(prefix ‖ 0) ⊕ L(s) for a linear L',
        readAs: 'The checksum of a prefix followed by a suffix is the checksum of the prefix ' +
          'followed by zeros, exclusive-ored with a linear function of the suffix.',
        detail: [
          'That makes forgery a 32-by-32 linear system rather than a search. It is 33 CRC ' +
            'evaluations and a Gaussian elimination.',
          'It is not a weakness in CRC. It is outside what CRC promises.',
          'The failure is in systems that treat "the checksum matches" as an integrity claim. That ' +
            'verifies the transfer worked, and verifies nothing at all about who wrote the bytes.'
        ],
        example: 'The demo forges a chosen CRC-32 with 4 appended bytes, solved rather than ' +
          'searched.'
      },
      {
        term: 'A checksum and a cryptographic hash answer different questions',
        plain: '"Did the wire corrupt this" against "did somebody change this".',
        formal: 'a checksum has no key and no collision resistance; a MAC has both',
        detail: [
          'Confusing them is the failure this section exists to prevent, and it shows up in incident ' +
            'reports rather than in textbooks.',
          'An upload validated by CRC. A config file "verified" by MD5 against a hash served from ' +
            'the same compromised host. A cache key that an attacker can steer.',
          'The right question is whether the adversary can choose the input. If they can, no unkeyed ' +
            'function helps.'
        ],
        example: 'The demo’s forgery is the demonstration: a valid CRC on a message the attacker ' +
          'chose.'
      }
    ],

    'error-correction': [
      {
        term: 'Correction repairs damage without asking for a retransmission',
        plain: 'Because sometimes there is nobody to ask.',
        formal: 'an (n, k) code carries k symbols of data in n, and any k of them suffice',
        detail: 'A scratched disc, a cosmic ray in a DRAM cell, a QR code with a coffee ring on ' +
          'it, a storage node that is simply gone — none of those can be re-requested. Detection ' +
          'tells you the data is wrong and correction gives it back, and the price is the ' +
          'redundancy paid on every read whether or not anything went wrong. That is a very ' +
          'different economic shape from a retry.',
        example: 'The demo’s RS(16, 10) carries 10 data symbols in 16 and recovers from any 6 ' +
          'erasures.'
      },
      {
        term: 'Hamming reads the error’s position out of the syndrome',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["each parity bit covers<br/>a fixed set of positions"] --> B["one bit flips"]',
            '    B --> C["exactly the parity checks covering<br/>that position now fail"]',
            '    C --> D["write the failures as bits"]',
            '    D --> E["and they spell the position<br/>of the flipped bit, in binary"]'
          ].join('\n'),
          caption: 'The code is arranged so the pattern of failures is the answer. Nothing has to be searched for — the syndrome is the index.'
        },
        plain: 'The failing parity checks spell the bad bit’s index in binary.',
        formal: 'parity bits at positions 2^i cover every position whose index has bit i set',
        detail: 'That construction is why the code is called elegant rather than merely correct: ' +
          'nothing is searched, and the syndrome is not a flag but an address. Zero means clean; ' +
          'anything else is the one-based index of the bit to flip. It generalises directly — a ' +
          'code with more parity bits addresses a larger block — and it is the reason ECC memory ' +
          'can correct in hardware in a single cycle.',
        example: 'The demo corrects 112 of 112 single-bit errors over all 16 data words, with the ' +
          'syndrome equal to the flipped position every time.'
      },
      {
        term: 'One more parity bit turns correction into SECDED',
        plain: 'Single error correct, double error DETECT.',
        formal: 'a syndrome that is non-zero while the overall parity is even is a state one error cannot produce',
        detail: 'Without it, a double error produces a non-zero syndrome that points at some ' +
          'innocent third bit, and a naive decoder flips it — turning two errors into three and ' +
          'reporting success. The extra bit distinguishes the two cases, so a double error is ' +
          'reported rather than miscorrected. That is what ECC memory does, and it is why an ' +
          'uncorrectable-error counter exists in every server’s logs.',
        example: 'The demo detects 448 of 448 double-bit errors as double errors, over every data ' +
          'word and every pair of positions.'
      },
      {
        term: 'Reed–Solomon works over symbols and over a finite field',
        plain: 'Bytes, with XOR for addition and a table for multiplication.',
        formal: 'GF(2^8) with the polynomial 0x11d; the code’s roots are consecutive powers of a generator',
        readAs: 'The arithmetic is in the field of 256 elements built from a degree-eight ' +
          'polynomial, and the code is defined by the powers of a generator that are its roots.',
        detail: 'Working over a field rather than the integers is what makes everything exact: ' +
          'there is no rounding, no overflow and no precision to lose, so a decoder either ' +
          'succeeds exactly or reports failure. It also means a whole BYTE is one symbol, so a ' +
          'burst of eight bad bits inside one byte costs one symbol of the correction budget ' +
          'rather than eight.',
        example: 'The demo encodes over GF(256) and verifies the round-trip on every corruption ' +
          'up to the limit.'
      },
      {
        term: 'Erasures are worth twice as much parity as errors',
        plain: 'A failure that announces itself is half the problem.',
        formal: 'up to n − k erasures are repairable; only ⌊(n − k)/2⌋ unknown errors are correctable',
        readAs: 'The code repairs as many known-bad positions as it has parity symbols, and only ' +
          'half that many errors whose positions are unknown.',
        detail: 'Finding WHERE the damage is costs as much redundancy as fixing it, which is the ' +
          'whole reason distributed storage cares so much about failure detection. A node that is ' +
          'known to be down is worth twice as much as one silently returning bad bytes, so ' +
          'anything that makes a failure announce itself — a checksum per fragment, a health ' +
          'check that fails fast — doubles the value of redundancy already paid for.',
        example: 'The demo repairs 6 erasures and corrects 3 errors with the same 6 parity ' +
          'symbols.'
      },
      {
        term: 'Past the limit the decoder must say so',
        plain: 'A decoder without a limit check invents a plausible wrong answer.',
        formal: 'beyond ⌊(n − k)/2⌋ errors the received word can be closer to a DIFFERENT valid codeword',
        readAs: 'Past the floor of n minus k over two errors, the damaged word may sit nearer to ' +
          'some other legal codeword than to the one that was sent.',
        detail: 'That failure is worse than no correction at all: the machinery built to protect ' +
          'the data manufactures silent corruption, confidently, and reports success. Which is ' +
          'why a decoder has to check its own limit rather than searching until something ' +
          'validates. The demo’s table has a row past the limit and it reports beyond-limit, ' +
          'because the alternative is a number that looks like data.',
        example: 'The demo corrects 1, 2 and 3 errors and reports beyond-limit at 4 and 5.'
      },
      {
        term: 'Erasure coding gives replication’s durability at half the storage',
        plain: 'More losses tolerated, less space, and that is why every object store uses it.',
        formal: 'r-way replication costs r× and survives r − 1 losses; an (n, k) code costs n/k× and survives n − k',
        detail: 'The arithmetic is stark: three-way replication is 3× storage for two tolerated ' +
          'losses, and RS(12, 8) is 1.5× for four. That factor of two on a storage bill is why ' +
          'the switch happened across the industry, and it is why the default assumption should ' +
          'be an erasure code unless the read pattern forbids it.',
        example: 'The demo tabulates RS(14, 10) at 1.40× storage tolerating 4 losses against ' +
          '3× replication at 3.00× tolerating 2.'
      },
      {
        term: 'The cost nobody mentions is on the read path',
        plain: 'Rebuilding one lost fragment reads k fragments from k machines.',
        formal: 'reconstruction read amplification = k for an (n, k) code, against 1 for replication',
        detail: 'On a quiet day that is invisible, because reads are served from the intact ' +
          'fragments. During a correlated failure it is the traffic that turns one dead node into ' +
          'a busy cluster: every object on that node needs k reads to rebuild, all at once, ' +
          'across the network. That is the operational reason wide codes are chosen carefully and ' +
          'why local-reconstruction codes exist — they add parity specifically to make the common ' +
          'single-failure case cheap.',
        example: 'The demo reports 10 reconstruction reads for RS(14, 10) and 1 for replication, ' +
          'in a column beside the storage saving.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));

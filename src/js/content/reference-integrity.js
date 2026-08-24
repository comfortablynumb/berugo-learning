/** Reference entries for error detection and error correction (M22.10-M22.11). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'checksums-and-crc': {
      summary: 'Six detectors against every single-bit flip, thousands of double-bit flips and ' +
        'every byte swap in a 72-byte message; bursts searched at every position to 34 bits; the ' +
        'published CRC-32 vectors checked against two implementations; and a forged CRC.',
      intuition: 'A checksum is a claim about which corruptions it catches, and the ones that ' +
        'matter are the ones the medium actually produces.',
      formulation: {
        equations: [
          {
            label: 'The definition, and what makes CRC different in kind',
            expr: 'CRC(m) = m·x^32 mod G(x) over GF(2), with G = 0xEDB88320',
            readAs: 'The checksum is the remainder when the message, shifted left by 32 bits, is ' +
              'divided by the generator polynomial, with XOR for addition and no carries.',
            terms: [
              { sym: 'undetected exactly when', meaning: 'the error’s own polynomial is divisible by the generator' },
              { sym: 'the burst guarantee', meaning: 'a burst shorter than the degree cannot be a multiple, so it is always caught' },
              { sym: 'table-driven', meaning: 'one lookup and one XOR per byte; slicing-by-8 does a word at a time' },
              { sym: 'what it does NOT promise', meaning: 'anything at all about an adversary — the function is public and invertible' }
            ]
          },
          {
            label: 'Three error models, six detectors, a 72-byte message',
            expr: 'detector · width · single-bit · double-bit · byte swap',
            terms: [
              { sym: 'byte sum', meaning: '8 bits · 100.0% · 95.1% · 0.0%' },
              { sym: 'parity', meaning: '1 bit · 100.0% · 0.0% · 0.0%' },
              { sym: 'Internet checksum', meaning: '16 bits · 100.0% · 97.3% · 50.3%' },
              { sym: 'Fletcher-16 / Adler-32 / CRC-32', meaning: '100.0% · 100.0% · 99.2%, 100.0%, 100.0%' }
            ]
          },
          {
            label: 'Bursts, searched at every position',
            expr: 'detector · exhaustively verified to · nothing missed up to · first miss',
            terms: [
              { sym: 'byte sum', meaning: '8 bits · 8 bits · fails at 9 (99.22% caught)' },
              { sym: 'parity', meaning: '1 · 1 · fails at 2 (0.00% caught)' },
              { sym: 'Internet checksum / Fletcher-16', meaning: '9 · 16 · both fail at 17' },
              { sym: 'Adler-32 / CRC-32', meaning: '9 · 34 · no miss within range' }
            ]
          },
          {
            label: 'The vectors, and the forgery',
            expr: 'input · expected CRC-32 · table-driven · bit-at-a-time',
            terms: [
              { sym: '(empty)', meaning: '00000000, agreed by both implementations' },
              { sym: '"a" / "abc"', meaning: 'e8b7be43 · 352441c2' },
              { sym: '"123456789"', meaning: 'cbf43926 — the conventional check value in every CRC catalogue' },
              { sym: 'the forgery', meaning: '4 appended bytes, solved as a linear system, hitting a chosen target exactly' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Every detection rate comes from a search, not a citation',
          why: 'A claim about an error class is checkable, and checking it is cheap.',
          breaks: 'Quoting "CRC catches all bursts under 32 bits" without a search hides that the exhaustive verification stops around 9.'
        },
        {
          name: 'Sampled and exhaustive results are reported in separate columns',
          why: 'A burst of length k has 2^(k−2) interior patterns; the search cannot finish past about 12.',
          breaks: 'A single "guaranteed to" column silently promotes a sampled result to a proof.'
        },
        {
          name: 'The table-driven implementation is checked against the definition',
          why: 'A wrong CRC still produces a stable, plausible value for every input.',
          breaks: 'Nothing about the output reveals the bug — only agreement with published vectors does.'
        }
      ],
      complexity: [
        { operation: 'parity', average: 'one XOR per bit; 1 bit of state', worst: 'catches every odd number of flips and nothing else' },
        { operation: 'byte sum', average: 'one addition per byte', worst: 'blind to reordering — 0.0% of byte swaps' },
        { operation: 'Internet checksum', average: 'one 16-bit add and fold per word', worst: '50.3% of byte swaps; still in every TCP and UDP header' },
        { operation: 'Fletcher / Adler', average: 'two additions per byte', worst: '99.2% and 100.0% of swaps — the second accumulator is the fix' },
        { operation: 'CRC-32, table-driven', average: 'one lookup and one XOR per byte', worst: 'all bursts under 32 bits, proved; nothing about an adversary' },
        { operation: 'forging a CRC', average: '33 CRC evaluations and a 32×32 GF(2) elimination', worst: 'microseconds — which is the point' }
      ],
      failureModes: [
        {
          symptom: 'Corruption reaches storage despite a checksum on every write.',
          cause: 'The checksum is blind to the failure mode — usually reordering, caught by no pure sum.',
          fix: 'Match the detector to the medium. The demo measures a byte sum catching 0% of byte swaps.'
        },
        {
          symptom: 'A CRC implementation passes all internal tests and disagrees with another system.',
          cause: 'A wrong polynomial, bit order or initial value still produces stable, plausible values.',
          fix: 'Check against published vectors — "123456789" is the conventional one — and against a bit-at-a-time version.'
        },
        {
          symptom: 'An attacker uploads a file whose checksum matches the expected value.',
          cause: 'A CRC is public and invertible; four chosen bytes hit any target.',
          fix: 'Use a keyed MAC. A checksum answers "did the wire corrupt this" and nothing else.'
        },
        {
          symptom: 'A wider checksum did not reduce undetected errors.',
          cause: 'Width is not the guarantee — the structure is. A 32-bit sum has the same blind spot as an 8-bit one.',
          fix: 'Choose by error class: a 16-bit CRC beats a 32-bit sum on a bursty channel.'
        }
      ],
      inTheWild: [
        'Ethernet frames, which carry a CRC-32; and TCP/UDP, which carry the much weaker Internet checksum.',
        'zlib’s Adler-32 and gzip’s CRC-32, chosen for speed and for detection strength respectively.',
        'Storage: ZFS, Btrfs and every modern disk sector, all of which checksum per block.',
        'QR codes and disc formats, where the checksum sits alongside an error-correcting code.'
      ],
      sources: [
        { title: 'Peterson and Brown — Cyclic codes for error detection (1961)', note: 'the original, with the divisibility argument for the burst guarantee' },
        { title: 'Koopman — Cyclic redundancy code (CRC) polynomial selection for embedded networks', note: 'which polynomial to choose for which message length' },
        { title: 'Stone, Greenwald, Partridge and Hughes — Performance of checksums and CRCs over real data (1998)', note: 'why the Internet checksum misses more than the theory suggests' },
        { title: 'Williams — A painless guide to CRC error detection algorithms', note: 'the implementation details: bit order, initial value, reflection' }
      ]
    },

    'error-correction': {
      summary: 'Hamming checked against all 112 single-bit errors and all 448 double-bit errors ' +
        'exhaustively, Reed–Solomon corrupted until it fails so the correction limit is observed, ' +
        'erasures repaired to exactly the parity count, and erasure coding tabulated against ' +
        'replication with the reconstruction cost included.',
      intuition: 'The same parity repairs twice as many erasures as errors, because finding the ' +
        'damage costs as much as fixing it.',
      formulation: {
        equations: [
          {
            label: 'What an (n, k) code buys',
            expr: 'n − k erasures · ⌊(n − k)/2⌋ errors · beyond that, detection only',
            readAs: 'The code repairs as many known-bad positions as it has parity symbols, ' +
              'corrects half that many errors at unknown positions, and past that can only report ' +
              'that something is wrong.',
            terms: [
              { sym: 'erasure', meaning: 'a position known to be bad — a missing disc, a failed read' },
              { sym: 'error', meaning: 'a wrong symbol at an unknown position, which costs redundancy to LOCATE' },
              { sym: 'the factor of two', meaning: 'why storage systems invest so heavily in failure detection' },
              { sym: 'past the limit', meaning: 'a decoder that keeps searching returns a valid, wrong codeword' }
            ]
          },
          {
            label: 'Hamming, checked exhaustively',
            expr: 'construction · single-bit · double-bit · rate',
            terms: [
              { sym: 'parity at 2^i', meaning: 'each covers the positions whose index has bit i set, so the syndrome IS the index' },
              { sym: 'single-bit', meaning: '112 of 112 corrected over 16 data words × 7 positions' },
              { sym: 'SECDED double-bit', meaning: '448 of 448 detected rather than miscorrected into a third error' },
              { sym: 'rate', meaning: '4 in 7, or 4 in 8 with SECDED — and 64 in 72 in real ECC memory' }
            ]
          },
          {
            label: 'RS(16, 10) over GF(256), corrupted until it fails',
            expr: 'symbols corrupted · decoder says · data recovered',
            terms: [
              { sym: '0 to 3 errors', meaning: 'clean, then corrected three times — the data returns exactly' },
              { sym: '4 and 5 errors', meaning: 'beyond-limit, and NOTHING is returned' },
              { sym: '0 to 6 erasures', meaning: 'repaired exactly, every time — twice the error limit' },
              { sym: '7 erasures', meaning: 'refused: more erasures than parity symbols' }
            ]
          },
          {
            label: 'Erasure coding against replication, at equal or better durability',
            expr: 'scheme · storage · losses tolerated · reads to rebuild one loss',
            terms: [
              { sym: '3× replication', meaning: '3.00× · 2 · 1' },
              { sym: 'RS(9, 6)', meaning: '1.50× · 3 · 6' },
              { sym: 'RS(12, 8)', meaning: '1.50× · 4 · 8' },
              { sym: 'RS(14, 10)', meaning: '1.40× · 4 · 10 — 47% of the storage, twice the tolerance, ten times the rebuild traffic' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The correction limit is observed, not cited',
          why: 'A decoder that searches past its limit will eventually validate a wrong codeword.',
          breaks: 'The demo’s table has a row at limit + 1 and it reports beyond-limit rather than returning data.'
        },
        {
          name: 'Hamming’s claims are checked on the whole code space',
          why: 'There are only 112 single-bit and 448 double-bit cases, so "all" is affordable.',
          breaks: 'A sampled check would pass with a syndrome table that is wrong for one position.'
        },
        {
          name: 'The reconstruction cost is reported beside the storage saving',
          why: 'A comparison on storage alone recommends the widest possible code.',
          breaks: 'RS(14, 10) looks strictly better than RS(9, 6) until the rebuild column shows 10 reads against 6.'
        }
      ],
      complexity: [
        { operation: 'Hamming encode', average: 'three XOR trees over the data bits', worst: 'rate 4/7 — 75% overhead at this block size' },
        { operation: 'Hamming decode', average: 'three parity checks; the syndrome is the position', worst: 'no search at all, which is why it runs in hardware in a cycle' },
        { operation: 'SECDED', average: 'one extra parity bit over the whole word', worst: 'distinguishes double from single, so it reports rather than miscorrects' },
        { operation: 'RS encode', average: 'polynomial division by the generator: O(k · parity) field operations', worst: 'systematic, so the data passes through unchanged' },
        { operation: 'RS erasure repair', average: 'Gaussian elimination over GF(256): O(parity³)', worst: 'exactly n − k repairable, and it refuses beyond that' },
        { operation: 'RS error correction', average: 'Berlekamp–Massey and Chien search in production; brute force here', worst: '⌊(n − k)/2⌋ — half the erasure limit, and the search space is why' }
      ],
      failureModes: [
        {
          symptom: 'ECC memory reports uncorrectable errors after a period of correctable ones.',
          cause: 'A failing DIMM: single-bit errors accumulate until two land in one word.',
          fix: 'Replace the module on the CORRECTABLE-error counter, not the uncorrectable one — the second is data loss.'
        },
        {
          symptom: 'A decoder returns data that is subtly wrong.',
          cause: 'The corruption exceeded the correction limit and the decoder searched until something validated.',
          fix: 'Check the limit explicitly and report failure. A wrong codeword is worse than no answer.'
        },
        {
          symptom: 'A single node failure saturates the cluster network.',
          cause: 'Erasure-coded reconstruction reads k fragments from k machines for every lost object.',
          fix: 'Use a narrower code, or a local-reconstruction code that adds parity specifically for the single-failure case.'
        },
        {
          symptom: 'A storage system tolerates fewer failures than its parity suggests.',
          cause: 'The failures are not announcing themselves, so they are errors rather than erasures — and that halves the tolerance.',
          fix: 'Checksum every fragment. A failure that is detected is worth twice one that is not.'
        }
      ],
      inTheWild: [
        'ECC DRAM, which is SECDED over 64-bit words with 8 parity bits.',
        'CDs, DVDs, QR codes and Blu-ray, all of which use Reed–Solomon with interleaving against scratches.',
        'HDFS, Ceph, S3 and every large object store, which erasure-code cold data and replicate hot data.',
        'LDPC and turbo codes in 5G, Wi-Fi and satellite links, which get closer to the Shannon limit at higher decoding cost.'
      ],
      sources: [
        { title: 'Hamming — Error detecting and error correcting codes (1950)', note: 'the construction, and the syndrome-as-address idea' },
        { title: 'Reed and Solomon — Polynomial codes over certain finite fields (1960)', note: 'the code, in five pages' },
        { title: 'Plank — A tutorial on Reed–Solomon coding for fault-tolerance in RAID-like systems', note: 'the practical version, with the GF(256) arithmetic spelled out' },
        { title: 'Huang et al. — Erasure coding in Windows Azure Storage (2012)', note: 'local reconstruction codes, and the read-amplification problem stated by operators' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));

/** Worked examples for error detection and error correction (M22.10-M22.11). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'checksums-and-crc': [
      {
        title: 'Six detectors, three error models, and the column that separates them',
        goal: 'Inject each class of corruption into the same message and count what each detector ' +
          'catches.',
        setup: 'A 72-byte pangram, with every single-bit flip tried, thousands of double-bit ' +
          'flips, and every byte swap the budget allows.',
        steps: [
          {
            do: 'Flip every bit in turn, one at a time.',
            why: 'This is the test a naive check would stop at.',
            work: '576 flips against six detectors',
            result: '100.0% caught by every one of them, including a single parity bit'
          },
          {
            do: 'Flip pairs of bits.',
            why: 'Parity is defined to miss even numbers of flips.',
            work: 'byte sum 95.1%, Internet checksum 97.3%, Fletcher and above 100.0%',
            result: 'parity catches 0.0% — by construction, not by accident'
          },
          {
            do: 'Swap two bytes.',
            why: 'Reordering is what a scatter-gather or reassembly bug produces.',
            work: 'byte sum 0.0%, parity 0.0%, Internet checksum 50.3%',
            result: 'addition is commutative, so a pure sum cannot see a permutation at all'
          },
          {
            do: 'Read the same column for Fletcher and Adler.',
            why: 'Their second accumulator is exactly the fix for this.',
            work: 'Fletcher-16 99.2%, Adler-32 100.0%, CRC-32 100.0%',
            result: 'a running sum of the running sum weights each byte by its position'
          },
          {
            do: 'Compare the widths against the results.',
            why: 'Width is a poor guide to usefulness.',
            work: 'the 8-bit sum catches 0% of swaps and the 1-bit parity catches 0% of pairs',
            result: 'the error model decides, not the number of bits'
          }
        ],
        answer: 'Every detector scores 100% in the first column, which is why a test that flips ' +
          'single bits proves nothing about a checksum. The differences are entirely in the ' +
          'classes the medium actually produces, and the byte-swap column is the clearest: a sum ' +
          'is invariant under permutation, so a reassembly bug is precisely the corruption it can ' +
          'never see. Fletcher’s second accumulator — one extra variable — takes that from 0% to ' +
          '99.2%.'
      },
      {
        title: 'The inverted case: the guarantee, searched — and then forged',
        goal: 'Verify CRC-32’s burst guarantee by exhaustive search, then break the thing it does ' +
          'not promise.',
        setup: 'The same message, bursts of every length from 1 to 34 at every position, exhaustive ' +
          'over interior patterns to 9 bits and sampled beyond it.',
        steps: [
          {
            do: 'Search bursts against the byte sum.',
            why: 'A one-byte checksum should fail as soon as a burst spans two bytes.',
            work: 'perfect to 8 bits; at 9 bits it catches 99.22%',
            result: 'the cliff is exactly at its own width'
          },
          {
            do: 'Search the two 16-bit detectors.',
            why: 'Their guarantee should hold to 16 and then break.',
            work: 'Internet checksum and Fletcher-16 both miss nothing to 16 bits and fail at 17',
            result: '98.44% and 99.80% at that first failing length'
          },
          {
            do: 'Search CRC-32 over the same range.',
            why: 'Its degree is 32, so nothing shorter should survive.',
            work: 'nothing missed at any length up to 34 bits, at any position',
            result: 'consistent with the theorem, and produced by a search rather than a citation'
          },
          {
            do: 'Read the two guarantee columns separately.',
            why: 'A sampled search is a weaker claim than an exhaustive one.',
            work: 'exhaustively verified to 9 bits; nothing missed up to 34',
            result: '2^30 interior patterns per position is why the first number is not 32'
          },
          {
            do: 'Now forge a CRC.',
            why: 'To show what the guarantee does NOT cover.',
            work: 'CRC is affine, so four appended bytes are a 32-by-32 linear system',
            result: 'a chosen target CRC, matched exactly, in 33 evaluations and an elimination'
          }
        ],
        answer: 'The burst columns are what a proved guarantee looks like when it is searched ' +
          'rather than quoted, and the two-column reporting is the honest part: an exhaustive ' +
          'search stops being finishable around nine bits, so the wider claim is evidence for a ' +
          'theorem rather than a proof of one. The forgery is the other half of the same lesson. ' +
          'CRC-32 will catch any burst a disc produces and will not catch anything an adversary ' +
          'does, because the function is public and invertible — and a system that treats a ' +
          'matching CRC as an integrity check has verified the wire and nothing else.'
      }
    ],

    'error-correction': [
      {
        title: 'Hamming, checked against every error it claims to handle',
        goal: 'Verify single-error correction and double-error detection exhaustively rather than ' +
          'by argument.',
        setup: 'All 16 four-bit data words, encoded as Hamming(7,4) and as the 8-bit SECDED ' +
          'extension, with every single-bit and every double-bit error applied.',
        steps: [
          {
            do: 'Encode a data word and flip one bit.',
            why: 'The syndrome should be the index of the bit that moved.',
            work: 'the 3 parity bits at positions 1, 2 and 4 cover the positions whose index ' +
              'has that bit set',
            result: 'the failing checks spell the position in binary'
          },
          {
            do: 'Do that for every word and every position.',
            why: 'A claim about all cases should be checked on all cases when there are only 112.',
            work: '16 data words × 7 positions',
            result: '112 of 112 corrected, with the syndrome matching the flipped index every time'
          },
          {
            do: 'Add the overall parity bit and flip TWO bits.',
            why: 'Without SECDED a double error is miscorrected into a third.',
            work: '16 words × 28 pairs = 448 cases',
            result: '448 of 448 reported as double errors rather than "corrected"'
          },
          {
            do: 'Read the code rate.',
            why: 'This is what the guarantee costs.',
            work: '4 data bits in 7, or 4 in 8 with SECDED',
            result: 'a rate of 0.571 or 0.500 — 75% to 100% overhead'
          },
          {
            do: 'Compare that against what ECC memory actually uses.',
            why: 'The construction generalises, and the overhead falls as the block grows.',
            work: 'a 72-bit word carrying 64 data bits is SECDED at 12.5% overhead',
            result: 'the same idea, addressing a bigger block with three more parity bits'
          }
        ],
        answer: 'Both claims are checked on every case rather than argued, which is possible here ' +
          'because the whole code space is 16 words. The syndrome-equals-index property is the ' +
          'part worth carrying: the construction turns "something is wrong" into "bit 5 is wrong" ' +
          'with no search at all, which is why it can run in hardware in a cycle. And the ' +
          'SECDED row is the one that matters operationally — without it, two errors become three ' +
          'and the decoder reports success, which is silent corruption produced by the correction ' +
          'machinery itself.'
      },
      {
        title: 'The inverted case: erasure coding’s bill, in the column nobody quotes',
        goal: 'Find the correction limit by measurement, then compare erasure coding against ' +
          'replication on both axes.',
        setup: 'RS(16, 10) over GF(256) — 10 data symbols and 6 parity — corrupted at rising error ' +
          'counts and rising erasure counts, plus a durability table.',
        steps: [
          {
            do: 'Corrupt one, two and three symbols at unknown positions.',
            why: 'The limit is ⌊(n − k)/2⌋ = 3, and it should be observed rather than assumed.',
            work: 'at 1, 2 and 3 corrupted symbols the decoder reports "corrected" and returns ' +
              'the original 10 data symbols each time',
            result: 'exact recovery at every count up to the limit'
          },
          {
            do: 'Corrupt four.',
            why: 'This is one past the limit.',
            work: 'at 4 corrupted symbols the decoder reports beyond-limit',
            result: 'it refuses rather than returning a plausible wrong codeword'
          },
          {
            do: 'Now ERASE symbols instead — mark their positions as known-bad.',
            why: 'Finding the damage is what costs the other half of the parity.',
            work: 'all 6 erasures repaired exactly; the 7th refused',
            result: 'twice the tolerance, from the same six parity symbols'
          },
          {
            do: 'Compare RS(14, 10) against 3× replication.',
            why: 'This is the decision a storage system actually makes.',
            work: '1.40× storage tolerating 4 losses against 3.00× tolerating 2',
            result: 'more durability for 47% of the storage'
          },
          {
            do: 'Read the reconstruction column.',
            why: 'It is the cost that does not appear in a storage-price comparison.',
            work: '10 fragment reads to rebuild one lost fragment, against 1 for replication',
            result: 'the traffic that turns a single node failure into a busy cluster'
          }
        ],
        answer: 'The erasure limit is exactly twice the error limit, from identical parity, ' +
          'because knowing WHERE the damage is costs as much redundancy as fixing it. That single ' +
          'fact is why distributed storage invests so heavily in failure detection — a node known ' +
          'to be down is worth twice one silently returning bad bytes. The durability table then ' +
          'shows why every large object store made the switch, and the last column shows what it ' +
          'bought: reconstruction reads k fragments from k machines, so the saving on the storage ' +
          'bill is paid for in cross-network traffic exactly when the cluster is least able to ' +
          'absorb it.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));

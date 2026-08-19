/** Worked examples for the approximate-membership sections (M07.1-M07.3). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'bloom-filters': [
      {
        title: 'Sizing a filter, and checking that the formula told the truth',
        goal: 'Turn a key count and an error target into bits and hashes, then measure whether the ' +
          'filter delivers what the arithmetic promised.',
        setup: '10 000 keys, a 1% target false-positive rate, and 20 000 probe keys known to be absent.',
        steps: [
          {
            do: 'Compute m from n and p.',
            why: 'This is the only formula that decides memory, and it does not mention the keys.',
            work: 'm = −n ln p / (ln 2)²\n  = −10 000 × ln(0.01) / 0.4805\n  = 10 000 × 4.6052 / 0.4805 = 95 851 bits',
            result: '95 851 bits = 11 982 bytes = 9.585 bits per key'
          },
          {
            do: 'Compute k from m and n.',
            why: 'k is a compromise: more hashes find more clear bits and also fill the array faster.',
            work: 'k = (m/n) ln 2 = 9.585 × 0.6931 = 6.643 → 7',
            result: 'k = 7, rounded from 6.643'
          },
          {
            do: 'Recompute the achieved error from the rounded k.',
            why: 'The k the formula asks for is not an integer, so the achieved error is not exactly p.',
            work: 'fpr = (1 − e^(−kn/m))^k = (1 − e^(−7 × 10 000 / 95 851))^7\n    = (1 − e^(−0.7302))^7 = 0.5182^7',
            result: '1.004%, not 1.000%'
          },
          {
            do: 'Insert the 10 000 keys and measure the fill.',
            why: 'A correctly sized filter at capacity should be about half full — that is what the optimal k means.',
            work: 'bits set: 49 751 of 95 851',
            result: '51.9% full, as the optimum predicts'
          },
          {
            do: 'Probe with 20 000 keys that were never inserted, and with all 10 000 that were.',
            why: 'Predicted error without measured error is a claim, not a result.',
            work: 'false positives: 202 of 20 000 = 1.010%\nfalse negatives: 0 of 10 000',
            result: '1.010% measured against 1.004% predicted, and zero false negatives'
          }
        ],
        answer: 'A 1% filter over 10 000 keys is 11 982 bytes and 7 hashes, ends up 51.9% full, and ' +
          'measures 1.010% against a predicted 1.004% — a fifth of a standard error apart over 20 000 ' +
          'probes. Nothing about the keys entered the calculation, which is why the same 9.59 bits per ' +
          'key holds for three-character keys and three-kilobyte ones.'
      },
      {
        title: 'Working backwards: what the memory you have will actually hold',
        goal: 'Invert the sizing question — given a fixed budget, find the key count, and find the ' +
          'point at which the filter must be alerted on.',
        setup: 'A 64 KB budget, and the same filter as above sized for 10 000 keys at 1%.',
        steps: [
          {
            do: 'Convert the budget into keys at three target error rates.',
            why: 'The budget is fixed by the deployment; the error rate is the dial you get to turn.',
            work: '64 KB = 524 288 bits\n  at 10%:  4.79 bits/key → 109 396 keys\n' +
              '  at 1%:   9.59 bits/key →  54 698 keys\n  at 0.1%: 14.38 bits/key →  36 465 keys',
            result: 'a factor of 100 in error costs a factor of 3 in capacity'
          },
          {
            do: 'Find the n at which the 10 000-key filter\'s error doubles.',
            why: 'This is the number an alert should fire on, and it is not 10 000.',
            work: 'solve (1 − e^(−7n/95 851))^7 = 0.02\n  n = 11 616',
            result: '1.16n — only 16% of overshoot doubles the error'
          },
          {
            do: 'Find the n at which it reaches 5% and 10%.',
            why: 'To see how fast the curve steepens once it has left the design point.',
            work: '5%:  n = 14 448 = 1.44n\n10%: n = 17 416 = 1.74n',
            result: 'a 74% overshoot is a tenfold error rate'
          },
          {
            do: 'Check what the filter reports about any of this.',
            why: 'Because the answer determines whether the alert can be built from the filter at all.',
            work: 'has() returns true or false\nthe predicted and measured curves agree at every n, ' +
              'so there is no anomaly to detect\nthe only readable signal is the fill, and inverting ' +
              'it gives n̂ = −(m/k)·ln(1 − fill)',
            result: 'nothing — unless the insert count is exported, or the array is scanned'
          },
          {
            do: 'State the alert.',
            why: 'A rule that can be written into a runbook rather than a caution.',
            work: 'alert when inserts > 1.16 × the n the filter was sized for\n' +
              'page when inserts > 1.44 ×',
            result: 'two thresholds, both computed from the sizing rather than guessed'
          }
        ],
        answer: 'A 64 KB filter holds 54 698 keys at 1%, and the same budget buys twice that at 10% or ' +
          'two-thirds of it at 0.1%. The number that matters operationally is 1.16n, where the error ' +
          'has doubled: a 16% overshoot is enough, the curve is smooth through it, and the filter ' +
          'itself will never mention it. Export the insert count and compare it with the design n, or ' +
          'the first symptom will be a downstream system doing ten times the work.'
      }
    ],

    'bloom-variants': [
      {
        title: 'What one cache line per query is worth, and what it costs',
        goal: 'Price the blocked filter honestly: the access saving in one column and the accuracy ' +
          'loss in the other, at identical m and k.',
        setup: '20 000 keys at a 1% target — m = 191 702 bits, k = 7 — through a standard filter and a ' +
          'blocked filter with 512-bit blocks, probed with 50 000 absent keys.',
        steps: [
          {
            do: 'Count the distinct 64-byte lines each query touches.',
            why: 'This is the cost that actually shows up in a profile, and it is not the hash count.',
            work: 'standard: 7 bit positions spread over 191 702 bits → 6.95 lines measured\n' +
              'blocked: 512 bits = 64 bytes = exactly one line → 1.00',
            result: '6.95× fewer lines per query'
          },
          {
            do: 'Measure the false-positive rate of both.',
            why: 'The blocked filter has the same m and the same k, so any difference is the blocking itself.',
            work: 'standard: 0.992%\nblocked:  1.204%',
            result: '1.21× the error, for the same memory'
          },
          {
            do: 'Explain where the extra error comes from.',
            why: 'So the effect is understood rather than memorised — it predicts what other block sizes do.',
            work: 'keys are spread over 374 blocks by a hash, so block occupancy varies\n' +
              'error is convex in density, so heavy blocks cost more than light ones save',
            result: 'the inflation is a property of the variance, so smaller blocks are worse'
          },
          {
            do: 'Sweep the block size to check that prediction.',
            why: 'A stated mechanism that does not predict the next measurement is a story.',
            work: '  64 bits: 2.536×    128: 1.679×    256: 1.365×\n' +
              ' 512 bits: 1.214×   1024: 1.083×   4096: 0.952×',
            result: 'monotone, exactly as the variance argument requires'
          },
          {
            do: 'State the trade in one line.',
            why: 'Because the decision is a comparison against what sits behind the filter.',
            work: 'blocked: 1 line, 1.204% · standard: 6.95 lines, 0.992%\n' +
              '21% more misses, each costing whatever the miss path costs',
            result: 'buy the cache line when the miss path is cheap; buy the accuracy when it is a disk'
          }
        ],
        answer: 'At 512-bit blocks a blocked filter touches 1.00 cache lines per query against 6.95 and ' +
          'measures 1.204% against 0.992% — a 21% higher error for the same 23 963 bytes. The error ' +
          'inflation is entirely a variance effect and shrinks monotonically as blocks grow, which is ' +
          'the mechanism that makes the trade predictable rather than empirical.'
      },
      {
        title: 'The block size at which the idea gives itself back',
        goal: 'Invert the first example: find the block size that recovers the standard filter\'s ' +
          'accuracy, and show that at that size there is nothing left to buy.',
        setup: 'The same 20 000 keys and 191 702 bits, sweeping the block from 64 bits to 4 096.',
        steps: [
          {
            do: 'Find the block size whose measured error matches the standard filter.',
            why: 'That is the point at which the accuracy objection disappears.',
            work: '1024 bits: 1.074% against 0.992% — still 1.08×\n4096 bits: 0.944% against 0.992% — 0.95×',
            result: 'somewhere between 1 024 and 4 096 bits'
          },
          {
            do: 'Count the cache lines at those sizes.',
            why: 'The whole point of blocking was the line count, so it has to be checked at the same time.',
            work: '1024 bits = 128 bytes = 2.00 lines\n4096 bits = 512 bytes = 8.00 lines',
            result: '8 lines is worse than the standard filter\'s 6.95'
          },
          {
            do: 'Put the two columns side by side.',
            why: 'To see that the two properties move in opposite directions with no window in between.',
            work: ' 512: 1.00 lines, 1.214× error\n1024: 2.00 lines, 1.083×\n4096: 8.00 lines, 0.952×',
            result: 'accuracy is bought back with exactly the accesses that were saved'
          },
          {
            do: 'Compare with the counting filter\'s trade, for contrast.',
            why: 'Counting buys a *capability* rather than a rate, and pays in a different currency.',
            work: 'counting, 4-bit: 95 851 bytes against 23 963, error unchanged at 0.99%,\n' +
              'lines per query 6.99 — the same as standard',
            result: '4× the memory for deletion, and no change to either other column'
          },
          {
            do: 'Say what each variant actually bought.',
            why: 'So the three are not filed as "improved Bloom filters".',
            work: 'blocked:  accesses, paid for in error\ncounting: deletion, paid for in memory\n' +
              'scalable: no sizing needed, paid for on the miss path (9.11 lines)',
            result: 'three different currencies, and no variant is a strict improvement'
          }
        ],
        answer: 'The blocked filter matches the standard filter\'s accuracy only at 4 096-bit blocks, ' +
          'where it touches 8.00 cache lines per query against the standard filter\'s 6.95 — so the ' +
          'accuracy comes back exactly when the saving is gone. None of the three variants is a strict ' +
          'improvement on the plain filter: each buys one property and pays for it in a different ' +
          'currency, and the choice is which currency your system has to spend.'
      }
    ],

    'fingerprint-filters': [
      {
        title: 'Filling a cuckoo filter until it refuses',
        goal: 'Separate the two dials — how full the table gets and how often it lies — and find where ' +
          'the hard ceiling is.',
        setup: '8 192 slots, four slots per bucket, 8-bit fingerprints, a 500-kick eviction limit, ' +
          'keys inserted until one fails, then probed with 50 000 absent keys.',
        steps: [
          {
            do: 'Fill until an insert fails and record where.',
            why: 'This is the number a Bloom filter does not have, and code has to handle it.',
            work: 'inserts accepted: 7 957\ninsert 7 958 walks 500 kicks and returns failure',
            result: '97.14% load, and the filter is full for good'
          },
          {
            do: 'Look at the distribution of eviction chain lengths, not the mean.',
            why: 'The mean hides the tail, and the tail is what a latency budget has to survive.',
            work: 'no eviction at all: 6 876 of 7 957 = 86.4%\nmean kicks per insert: 1.94\n' +
              'longest chain in the fill: 408, at insert 7 921',
            result: 'the worst insert is 210× the mean'
          },
          {
            do: 'Vary the fingerprint width and watch the load.',
            why: 'To establish that the load ceiling is not what the fingerprint controls.',
            work: 'f =  6: load 96.02%   f =  8: 97.14%\nf = 10: 97.14%       f = 12: 97.07%',
            result: 'the load is flat in f — this dial does something else'
          },
          {
            do: 'Vary the fingerprint width and watch the error.',
            why: 'To establish what it does control.',
            work: 'f =  6: 11.872%   f =  8: 2.978%\nf = 10:  0.678%   f = 12: 0.200%   f = 14: 0.052%',
            result: 'the error quarters for every two bits — 2bα/2^f, exactly'
          },
          {
            do: 'Vary the bucket width and watch the load.',
            why: 'To find the dial the load ceiling actually responds to.',
            work: 'b = 1: 49.77%   b = 2: 88.04%\nb = 4: 97.14%   b = 8: 99.32%',
            result: 'the ceiling is set by the bucket geometry, and flattens at four'
          }
        ],
        answer: 'A cuckoo filter has two independent dials. The bucket width sets the load ceiling — ' +
          '49.8% at one slot, 97.1% at four, 99.3% at eight — and the fingerprint width sets the error ' +
          'rate, which quarters for every two bits added. Four slots is where the load curve flattens, ' +
          'which is why every implementation uses it. The ceiling itself is the real difference from a ' +
          'Bloom filter: 86.4% of inserts are free and then, at 7 957 of 8 192 slots, insertion simply ' +
          'stops.'
      },
      {
        title: 'The error rate at which the ranking reverses',
        goal: 'Invert the usual claim that fingerprint filters are smaller, and find the point where ' +
          'it becomes true.',
        setup: 'Bits per item at each family\'s design load: Bloom at 1.4427·log₂(1/ε), a cuckoo filter ' +
          'at f/0.95 with four slots per bucket, and a quotient filter at (r + 3)/0.75.',
        steps: [
          {
            do: 'Note that a fingerprint is a whole number of bits.',
            why: 'You cannot ask a cuckoo filter for 1%; you get the error the next integer f gives.',
            work: 'f = 10 achieves 0.740%\nf = 11 achieves 0.370%\nf = 12 achieves 0.185%',
            result: 'compare at the achieved error, not at the requested one'
          },
          {
            do: 'Price both families at each achieved error.',
            why: 'This is the comparison the "cuckoo filters are smaller" claim is implicitly making.',
            work: 'f = 10: cuckoo 10.53 bits, Bloom at 0.740% costs 10.21\n' +
              'f = 11: cuckoo 11.58 bits, Bloom at 0.370% costs 11.65',
            result: 'the two lines cross between 0.74% and 0.37%'
          },
          {
            do: 'Confirm the direction on either side.',
            why: 'A crossing has to be checked from both ends or it is a coincidence.',
            work: 'f =  8: cuckoo  8.42, Bloom  7.35 — Bloom by 15%\n' +
              'f = 13: cuckoo 13.68, Bloom 14.53 — cuckoo by 6%',
            result: 'Bloom wins above ~0.5%, cuckoo below it'
          },
          {
            do: 'Price the quotient filter the same way.',
            why: 'It is the third family in the section and it loses this comparison outright.',
            work: 'r =  7: 13.33 bits at 0.586%, where Bloom costs 10.70\n' +
              'r = 10: 17.33 bits at 0.073%, where Bloom costs 15.03',
            result: 'never smaller — its case is not memory'
          },
          {
            do: 'Say what each family is actually bought for.',
            why: 'Because the memory column is the one everybody quotes and the wrong one to choose on.',
            work: 'Bloom:    smallest above 0.5%, no deletes, merges only at identical shape\n' +
              'cuckoo:   smallest below 0.5%, deletes, 2.00 lines per query, does not merge\n' +
              'quotient: largest, 1.00 lines per query, merges with no keys at all',
            result: 'three different reasons, only one of which is bits'
          }
        ],
        answer: 'The crossover is at about 0.5% achieved false-positive rate: above it a Bloom filter ' +
          'is smaller (8.42 against 7.35 bits per item at 2.9%), below it a cuckoo filter is (13.68 ' +
          'against 14.53 at 0.093%). A quotient filter is never the smallest of the three — it costs ' +
          '13.33 bits where Bloom costs 10.70 — and is chosen for the two columns nobody puts in the ' +
          'headline: one cache line per query, and a merge that needs neither key set.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));

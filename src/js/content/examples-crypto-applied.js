/** Worked examples for constant-time code and applied constructions (M23.10-M23.11). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'constant-time-programming': [
      {
        title: 'Emptying a token comparison with a stopwatch',
        goal: 'Turn an early-exit comparison into a linear search and count the cost.',
        setup: 'A 4-byte secret token compared with an early-exit loop, moderate measurement ' +
          'noise, and 40 timing samples averaged per guess.',
        steps: [
          { do: 'Establish the signal: time a right first byte against a wrong one.',
            why: 'A correct prefix survives one more loop iteration.',
            work: 'right 1.9746 ± 0.1098, wrong 0.9939 ± 0.1080 — a separation of 4.5029 σ' },
          { do: 'Try all 256 values for the first byte and keep the slowest.',
            why: 'The slowest response is the one whose prefix matched.',
            work: '256 guesses × 40 samples = 10 240 timings for byte 1' },
          { do: 'Fix that byte and repeat for the next position.',
            why: 'Each recovered byte extends the prefix the attacker can build on.',
            work: '4 positions × 256 values = 1 024 guesses in total' },
          { do: 'Total the measurements and check the recovered token.',
            why: 'The claim is exact recovery, so it has to be compared byte by byte.',
            work: '40 960 timings, 4 of 4 bytes correct' },
          { do: 'Compare with guessing the token blind.',
            why: 'This is the actual damage: exponential becomes linear.',
            work: '1 024 guesses against a brute-force space of 4.295 × 10^9' }
        ],
        answer: '1 024 guesses and 40 960 timings recover a token that would take 4.295 × 10^9 ' +
          'attempts to forge blind. The length of the secret stopped mattering the moment the ' +
          'comparison leaked where the first difference was.'
      },
      {
        title: 'The case that inverts it: what distance costs, and what it does not',
        goal: 'Show that noise sets a price rather than a defence, and that masking removes the ' +
          'signal entirely.',
        setup: 'The same attack at four noise levels and six sample counts, against both the ' +
          'early-exit comparison and the branchless one.',
        steps: [
          { do: 'Run at the quietest setting.',
            why: 'On the same machine the signal dwarfs the noise.',
            work: 'recovered at every sample count from 10 to 320' },
          { do: 'Raise the noise to an internet-like level.',
            why: 'Averaging suppresses noise as the square root of the sample count.',
            work: 'fails at 10, 20 and 40 samples; recovers at 80' },
          { do: 'Raise it again to a congested link.',
            why: 'The attacker pays more measurements and is not stopped.',
            work: 'recovers only at 320 samples' },
          { do: 'Measure the branchless comparison’s separation under identical conditions.',
            why: 'The claim is that the difference is absent rather than small.',
            work: 'right 3.9746 ± 0.1098, wrong 3.9939 ± 0.1080 — 0.0885 σ' },
          { do: 'Run the full sweep against the branchless comparison.',
            why: 'If the signal is absent, no amount of averaging finds it.',
            work: '0 recoveries in 24 cells, across all noise levels and sample counts' }
        ],
        answer: 'Noise raises the attacker’s sample count and never their failure rate: 10 ' +
          'samples suffice on a quiet link and 320 on a congested one. Against the branchless ' +
          'comparison all 24 cells fail, because the separation is 0.0885 σ rather than 4.5029.'
      }
    ],

    'applied-constructions': [
      {
        title: 'Any three of five shares, and the fourth that reveals nothing',
        goal: 'Check both halves of the Shamir guarantee by computation rather than assertion.',
        setup: 'The secret 1 234 567 split into 5 shares at threshold 3, over the prime ' +
          '2 147 483 647.',
        steps: [
          { do: 'Enumerate every three-share subset and reconstruct from each.',
            why: 'The claim is that ANY k shares work, so a single example proves nothing.',
            work: '10 subsets of size 3, all reconstructing 1 234 567' },
          { do: 'Reconstruct from only two shares.',
            why: 'The failure mode matters: the arithmetic does not error.',
            work: 'returns 446 296 622 against a true secret of 1 234 567' },
          { do: 'Test whether the two held shares rule out any candidate secret.',
            why: 'For each candidate there should be exactly one polynomial through the shares.',
            work: '8 candidates tested, 8 consistent' },
          { do: 'Ask what each candidate implies about a share nobody holds.',
            why: 'If the implied values all differ, the shares pin down nothing.',
            work: '8 distinct implied values at the probe point, one per candidate' },
          { do: 'State what kind of security that is.',
            why: 'It does not depend on the attacker’s resources at all.',
            work: '0 possibilities eliminated by 2 of 3 required shares' }
        ],
        answer: 'All 10 three-share subsets reconstruct 1 234 567 exactly, and two shares ' +
          'eliminate none of the candidates while silently returning 446 296 622. Counting ' +
          'shares before reconstructing is a required step.'
      },
      {
        title: 'The case that inverts it: proving one entry without holding the list',
        goal: 'Price a Merkle inclusion proof against sending the data.',
        setup: 'A list of 7 balance entries hashed into a tree, with a client that holds only ' +
          'the root.',
        steps: [
          { do: 'Build the tree and note its depth.',
            why: 'The proof length is the depth, which is the logarithm of the entry count.',
            work: '7 leaves → 4 levels, root 6a8f617f…' },
          { do: 'Produce an inclusion proof for one entry and verify it.',
            why: 'The verifier recomputes the path upward and compares with the root.',
            work: '3 sibling hashes, 96 bytes, verification succeeds' },
          { do: 'Produce the proof for the odd final leaf.',
            why: 'An unpaired node is carried up rather than duplicated, so its path is shorter.',
            work: '2 sibling hashes rather than 3' },
          { do: 'Edit the entry and re-run the same proof.',
            why: 'The commitment covers every byte, so any change breaks the path.',
            work: 'verification fails — 0 of 1 proofs accepted after the edit' },
          { do: 'Scale the cost to a billion entries.',
            why: 'The ratio is what makes light clients and transparency logs possible.',
            work: '30 hashes and 960 B against 34.4 GB for the list — about 35 million times' }
        ],
        answer: 'Proving one of 7 entries costs 3 hashes and 96 bytes; proving one of a billion ' +
          'costs 30 hashes and 960 bytes against 34.4 GB. The verifier needs the root and ' +
          'nothing else.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));

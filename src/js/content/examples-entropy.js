/** Worked examples for random generation and identifier design (M17.9-M17.10). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'random-generation': [
      {
        title: 'Ranking nine generators with a test that ranks none of them',
        goal: 'Run the uniformity test everybody runs, find that it separates nothing, and then ' +
          'find the two readings that do.',
        setup: 'Nine generators, 200 000 samples each into 64 buckets, taken from the high bits ' +
          'and then from the low eight, with a chi-squared verdict against both tails.',
        steps: [
          {
            do: 'Test every generator on its high bits and read the verdicts.',
            why: 'This is the test that gets run, and its result is the reason the rest of the section exists.',
            work: 'statistics from 0.1 to 81.0 against a plausible range of 45.7 to 82.5',
            result: 'nothing is rejected — including the generator IBM had to withdraw'
          },
          {
            do: 'Look at the bottom of that range rather than the top.',
            why: 'A chi-squared test has two tails and one of them is almost never checked.',
            work: 'RANDU scores 0.1 where about 63 is expected, and the 5th percentile is 45.7',
            result: 'the counts are too even, which means the values are enumerated rather than sampled'
          },
          {
            do: 'Repeat the test on the low eight bits.',
            why: 'For a power-of-two-modulus LCG the two ends of the word have different quality.',
            work: 'RANDU scores 600 000.0 and the Numerical Recipes LCG scores exactly 0.0',
            result: 'one fails for being ragged and the other for being perfect'
          },
          {
            do: 'Measure the period of the individual low bits.',
            why: 'A frequency test cannot see a cycle; the bits come up set half the time either way.',
            work: 'RANDU’s bits 0 to 5 have periods 1, 2, 1, 4, 8 and 16',
            result: 'bit 0 never changes at all, so it is set 100% of the time'
          },
          {
            do: 'Check RANDU’s linear identity over consecutive triples.',
            why: 'This is a property that holds or does not, with no sample size to argue about.',
            work: 'x[n+2] = 6·x[n+1] − 9·x[n] has a residual of exactly 0 over 2 000 triples',
            result: 'every triple it will ever emit lies on one of fifteen planes'
          }
        ],
        answer: 'The test that is easy to run is the test that discriminates least. All nine ' +
          'generators pass a one-dimensional histogram on their high bits, and the three readings ' +
          'that separate them are the lower tail of the same statistic, the period of individual ' +
          'bits, and an exact linear identity over consecutive outputs. RANDU fails all three; ' +
          'the Numerical Recipes LCG fails two; PCG, splitmix, xorshift128 and MT19937 fail none ' +
          'of them, which is a statement about their distributions and not about predictability.'
      },
      {
        title: 'Two ways to ruin a correct generator, one arithmetic and one combinatorial',
        goal: 'Invert the first example: instead of a fault in the generator, find two in the code ' +
          'that consumes it — and show that neither is fixed by choosing a better generator.',
        setup: 'PCG32, which passes everything above, feeding a bounded sampler at 8 bits and a ' +
          'three-element shuffle.',
        steps: [
          {
            do: 'Predict the modulo bias before measuring anything.',
            why: 'It is a property of two integers and needs no experiment.',
            work: 'at a range of 256 and n = 200, 56 outputs get 2 source values and 144 get 1 — a ratio of 2.000×',
            result: 'the bias is arithmetic, so no generator quality changes it'
          },
          {
            do: 'Sample 400 000 values with `value % n` and test them.',
            why: 'To watch the predicted bias arrive.',
            work: 'chi-squared 49 161.2 against a threshold of 232.9, with a measured spread of 2.219×',
            result: 'the measurement lands on the prediction'
          },
          {
            do: 'Repeat with rejection and with Lemire’s method.',
            why: 'Both are exactly uniform; the question is what they cost.',
            work: '203.8 and 212.0, both passing, at 1.2790 and 1.2807 draws per sample',
            result: 'about 28% extra draws for exact uniformity'
          },
          {
            do: 'Now shuffle three elements 120 000 times, correctly and naively.',
            why: 'The second failure is combinatorial rather than arithmetic.',
            work: 'Fisher-Yates scores 7.0 and the naive version 1 509.7, against a threshold of 11.0',
            result: 'counts from 17 640 to 22 290 where 20 000 is expected'
          },
          {
            do: 'Count the execution paths rather than testing further.',
            why: 'A counting argument settles it without any statistics at all.',
            work: '3³ = 27 equally likely paths for 3! = 6 outcomes, and 6 does not divide 27',
            result: 'the distribution cannot be uniform, whatever generator drives it'
          }
        ],
        answer: 'Both failures survive a perfect source of randomness, which is what makes them ' +
          'worth separating from generator quality. The modulo bias is arithmetic — 56 of 200 ' +
          'outputs get an extra chance, a ratio of exactly 2.000× — and rejection removes it for ' +
          'about 28% more draws. The shuffle bias is combinatorial: 27 paths cannot distribute ' +
          'evenly over 6 outcomes, so the algorithm is wrong rather than the generator. The two ' +
          'shuffles differ by one character in the source, which is the whole reason this is worth ' +
          'measuring rather than reasoning about.'
      }
    ],

    'integer-algorithms': [
      {
        title: 'Pricing the identifier, in index pages rather than in bytes',
        goal: 'Turn "random UUIDs are bad for B-trees" into a working-set measurement, and find ' +
          'the scheme that is almost but not quite as local as a sequence.',
        setup: '20 000 identifiers from each of five schemes, issued three per millisecond, ' +
          'assigned to 4 096 index pages by rank, with the last 64 inserts tracked.',
        steps: [
          {
            do: 'Measure the working set for a sequential integer.',
            why: 'It is the best case, and it sets the floor everything else is read against.',
            work: '14 distinct pages touched in a 64-insert window, switching page on 20.5% of inserts',
            result: 'inserts arrive at the end of the key space and stay on one page until it fills'
          },
          {
            do: 'Measure the same for a random UUID.',
            why: 'This is the claim under test.',
            work: '64 pages in a 64-insert window, switching on 100.0% of inserts',
            result: 'every insert lands on a different page — the working set is the whole window'
          },
          {
            do: 'Sweep the window to check the shape rather than one point.',
            why: 'A single window size could be a coincidence; the growth is the finding.',
            work: 'the random line is the diagonal y = x from windows of 8 to 512',
            result: 'the working set grows without bound, so no buffer pool size fixes it'
          },
          {
            do: 'Measure UUIDv7 and ULID, which put a timestamp in the high bits.',
            why: 'They are supposed to recover the locality, and they nearly do.',
            work: '15 pages against the sequence’s 14, but switching on 38.8% of inserts against 20.5%',
            result: 'almost all the locality, and measurably not all of it'
          },
          {
            do: 'Explain the residual gap rather than rounding it away.',
            why: 'A small unexplained difference is usually the interesting one.',
            work: 'within a millisecond their low bits are random, and 6 735 of 13 333 same-millisecond pairs come out unordered',
            result: 'the same property that makes them non-monotonic makes them switch page 1.9× as often'
          }
        ],
        answer: 'The working set is the number to quote: 64 pages for a random UUID in a ' +
          '64-insert window against 14 for a sequence, and it grows with the window rather than ' +
          'settling. Time-ordered UUIDs recover nearly all of it — 15 pages — and the residual ' +
          'gap is not noise: their intra-millisecond randomness makes them switch page on 38.8% ' +
          'of inserts against 20.5%. Snowflake matches the sequence exactly at 14 and 20.5%, ' +
          'because its low bits are a counter rather than random.'
      },
      {
        title: 'The clock, the ceiling, and the option that produces duplicates',
        goal: 'Invert the first example: instead of a steady-state cost, take the two moments a ' +
          'Snowflake generator can fail and measure what each policy does about them.',
        setup: 'A Snowflake generator driven by an injected clock, first stepped backwards by 40 ' +
          'milliseconds and then held still through a burst of 5 000 requests.',
        steps: [
          {
            do: 'Issue five identifiers, step the clock back 40 ms, and ask for eight more.',
            why: 'A backwards step is what an NTP correction or a resumed virtual machine looks like.',
            work: 'the generator is now 40 ms ahead of the clock it is being asked to read',
            result: 'every subsequent timestamp would repeat one already issued'
          },
          {
            do: 'Run the waiting policy.',
            why: 'It keeps issuing from its own last stamp until real time catches up.',
            work: '13 of 13 issued, 0 dropped, 0 duplicates, 8 stalls recorded',
            result: 'availability preserved, monotonicity preserved, latency spent'
          },
          {
            do: 'Run the refusing policy.',
            why: 'It refuses until the clock passes its last stamp.',
            work: '5 of 13 issued, 8 dropped, 0 duplicates',
            result: 'latency preserved, monotonicity preserved, availability spent'
          },
          {
            do: 'Name the third option and why it is not offered.',
            why: 'It is the one a generator falls into if nobody considered the case.',
            work: 'serving from the stale reading repeats 8 identifiers that were already issued',
            result: 'the duplicate surfaces days later as a primary-key violation nobody can reproduce'
          },
          {
            do: 'Hold the clock still and ask for 5 000 identifiers in one millisecond.',
            why: 'The sequence field is 12 bits, which is a hard rate ceiling.',
            work: '4 096 fit; the generator borrows 1 millisecond from the future for the other 904',
            result: '0 duplicates, and the generator is now ahead of the clock by its own doing'
          }
        ],
        answer: 'Both offered policies preserve uniqueness and spend a different resource: waiting ' +
          'spends latency and issues all 13, refusing spends availability and issues 5. The third ' +
          'option — serving from the stale clock — is the one that produces duplicates, and it is ' +
          'what a generator does by default if the case was never considered. The sequence ceiling ' +
          'is the same failure from the other direction: 4 096 per machine per millisecond, past ' +
          'which the generator borrows from the future and stays ahead of the clock until real ' +
          'time catches up. Testing either requires injecting the clock.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));

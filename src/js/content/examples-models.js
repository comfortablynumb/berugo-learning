/** Worked examples for streaming, work and span, and cost models (M21.7-M21.9). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'streaming-model': [
      {
        title: 'Kill the exact structure, then buy accuracy with registers',
        goal: 'Show what a space budget actually forbids, by enforcing it rather than asserting it.',
        setup: 'A stream of 200 000 items over 19 990 distinct values, with a budget of 8 192 ' +
          'bytes, counted exactly and by HyperLogLog at four register counts.',
        steps: [
          {
            do: 'Run the exact set and let the harness enforce the budget.',
            why: 'The claim "an exact count does not fit" should be measured, not assumed.',
            work: 'the set passes 8 192 bytes at 8 208 bytes, having seen 345 items of 200 000',
            result: 'killed 0.17% of the way through the stream'
          },
          {
            do: 'Note what the exact answer would have cost.',
            why: 'It says how far outside the budget the honest answer is.',
            work: '479 760 bytes for 19 990 distinct values, against a budget of 8 192',
            result: '59× over — off the right-hand edge of the accuracy-space plot entirely'
          },
          {
            do: 'Run HyperLogLog at 16, 256, 4 096 and 16 384 bytes.',
            why: 'The trade is registers against relative error, at 1.04/√m.',
            work: 'errors of 11.30%, 8.38%, 4.33% and 0.73%',
            result: 'roughly a straight line on logarithmic axes — quadruple the memory, halve the error'
          },
          {
            do: 'Check which of those fit.',
            why: 'The budget applies to the sketches too.',
            work: 'p=14 at 16 384 bytes is killed like the exact set was',
            result: 'the best answer INSIDE the budget is 4.33% at 4 096 bytes, answering 20 855'
          },
          {
            do: 'Compare the measured errors against the predicted ones.',
            why: 'A measurement that disagrees with the formula is a bug, a missing correction or a real limit.',
            work: 'p=8 measures 8.38% against a predicted 6.50%',
            result: 'the raw estimator reads high between about 2.5m and 4m distinct values, and the ' +
              'correction for that band is not implemented here'
          }
        ],
        answer: 'The exact structure is not slow, it does not exist: 345 items in, it is over ' +
          'budget, and the complete answer would need 479 760 bytes. What is available instead is ' +
          '4.33% relative error in 4 096 bytes, and the square-root law says the next halving of ' +
          'that costs four times the memory. The p=8 row is the one worth keeping: its measured ' +
          'error is above the formula for a documented reason, and reporting it rather than ' +
          'quietly dropping the row is what makes the other four numbers believable.'
      },
      {
        title: 'The inverted case: two questions with no one-pass answer at all',
        goal: 'Separate what a sketch approximates from what nothing can approximate in one pass.',
        setup: 'Five questions about the same stream, each with the space an exact answer needs ' +
          'and the best approximate structure available.',
        steps: [
          {
            do: 'Take the distinct count and the median.',
            why: 'Both need linear space exactly, and both have good sketches.',
            work: 'Ω(n) exact; HyperLogLog at 1.04/√m and KLL or t-digest with bounded rank error',
            result: 'approximable in one pass — the model’s success cases'
          },
          {
            do: 'Take the frequency of a given key.',
            why: 'Count-min is the standard answer and its guarantee is one-sided.',
            work: 'Ω(distinct keys) exact — 19 990 counters here; count-min over-estimates by at most εN',
            result: 'approximable, with the error always in the same direction'
          },
          {
            do: 'Ask which keys appeared exactly once.',
            why: 'This is where the one-sided error becomes fatal rather than inconvenient.',
            work: 'a structure that over-counts cannot certify a count of exactly 1',
            result: 'no one-pass answer, even approximately'
          },
          {
            do: 'Ask for the maximum gap between consecutive values.',
            why: 'The answer can depend on every item and requires an ordering.',
            work: 'Ω(n) exact — all 200 000 items — and no sketch, because sorting is required',
            result: 'no one-pass answer, for a second and different structural reason'
          },
          {
            do: 'Read the quantile table to see what IS promised.',
            why: 'The sketches that work bound RANK, and the dashboards quote values.',
            work: 't-digest returns ranks of 0.5001, 0.8995 and 0.9897 for p50, p90 and p99',
            result: 'a worst rank error of 0.050% at 928 bytes — against a reservoir’s 1.045% at 8 000'
          }
        ],
        answer: 'Two of the five questions cannot be answered in one pass at all, and the reasons ' +
          'are structural rather than gaps in the literature. That is the practical value of the ' +
          'model: when a requirement lands on that side of the line, the negotiation is about the ' +
          'requirement — retain the data, take two passes, or ask a different question — and never ' +
          'about the implementation. The quantile rows carry the other lesson: the guarantee is on ' +
          'rank, and on a heavy tail a one per cent rank error at p99 can be an enormous number of ' +
          'milliseconds.'
      }
    ],

    'work-and-span': [
      {
        title: 'A prefix sum that looks sequential, scheduled onto eight processor counts',
        goal: 'Compute work and span for three scans, then schedule the best one and watch it hit ' +
          'its span.',
        setup: 'A prefix sum over 256 elements, recorded as a dependency graph and scheduled ' +
          'greedily onto 1 to 256 processors.',
        steps: [
          {
            do: 'Measure the sequential loop.',
            why: 'Each output needs the one before it, which is what "inherently sequential" means.',
            work: 'work 256, span 256',
            result: 'a parallelism of 1.0× — processors do nothing for it at all'
          },
          {
            do: 'Measure Blelloch’s up-sweep and down-sweep.',
            why: 'The tree formulation gets the same answers with a critical path of 2 log n.',
            work: 'work 511 against 2n = 512, span 17 against 2·log₂(256) = 16',
            result: 'a parallelism of 30.1×, at 2.00× the sequential work'
          },
          {
            do: 'Measure Hillis–Steele.',
            why: 'It trades more work for a shorter path still.',
            work: 'work 1 793, span 8',
            result: 'a parallelism of 224.1×, at 7.00× the sequential work'
          },
          {
            do: 'Schedule Blelloch greedily at 1, 16, 64 and 256 processors.',
            why: 'Brent’s theorem says greedy is within a factor of two of optimal.',
            work: 'measured 511, 39, 19 and 17 steps against bounds of 528, 49, 25 and 19',
            result: 'below the bound in every row, which is what an upper bound is for'
          },
          {
            do: 'Read the time ÷ span column downwards.',
            why: 'It says when more processors stop helping.',
            work: '30.06×, 2.29×, 1.12× and 1.00×',
            result: 'the span is attained exactly at 256 — a thousand more processors would take 17 too'
          }
        ],
        answer: 'A computation whose every output depends on the previous one has a span of 17 ' +
          'rather than 256, and the price is exactly a factor of two in total work. The schedule ' +
          'confirms the theory numerically: greedy stays under Brent’s bound at every processor ' +
          'count, and the time floors at the span. The comparison between Blelloch and ' +
          'Hillis–Steele is the takeaway — neither is better in the abstract, since one is 30.1× ' +
          'parallel at 2× the work and the other 224.1× at 7×, and which wins is decided by how ' +
          'many processors there are.'
      },
      {
        title: 'The inverted case: 1 024 processors and a speed-up of 5',
        goal: 'Read the two scaling laws off the same serial fractions and see why they disagree.',
        setup: 'Serial fractions of 0.1%, 1%, 5% and 20%, evaluated under Amdahl at four ' +
          'processor counts and under Gustafson at 1 024.',
        steps: [
          {
            do: 'Compute the Amdahl ceiling at each fraction.',
            why: 'It is 1/s and nothing in the row can pass it.',
            work: '1000×, 100×, 20× and 5×',
            result: 'the serial fraction alone caps the whole exercise'
          },
          {
            do: 'Evaluate at 1 024 processors.',
            why: 'This is where a capacity argument would live.',
            work: '506.2, 91.2, 19.6 and 5.0',
            result: 'at 20% serial, 1 024 processors deliver 5.0× and the other thousand are idle'
          },
          {
            do: 'Compare 8 processors against 1 024 at 5% serial.',
            why: 'It says where the money stops working.',
            work: '5.9× at 8 processors and 19.6× at 1 024',
            result: '128 times the machine for 3.3 times the speed'
          },
          {
            do: 'Evaluate Gustafson at 1 024 on the same fractions.',
            why: 'The same serial fraction, a different question.',
            work: '1023×, 1014×, 973× and 819×',
            result: 'not a contradiction — a scaled problem rather than a fixed one'
          },
          {
            do: 'Decide which applies by asking whether the work grows with the machine.',
            why: 'That is the only thing separating the two.',
            work: 'a nightly batch over a fixed dataset is Amdahl and caps at 5.0×; a service ' +
              'whose traffic grows with its fleet is Gustafson and reaches 819×',
            result: '5.0× or 819× on identical inputs, decided by the question rather than the hardware'
          }
        ],
        answer: 'A serial fraction of twenty per cent caps a fixed problem at five times faster ' +
          'however large the machine, and the same fraction supports 819× of scaled speed-up — ' +
          'and both numbers are correct. The disagreement is entirely about which question is ' +
          'being asked, so the first thing to establish in any capacity argument is whether the ' +
          'workload grows when the fleet does. The 5% row is the practical one: measure the serial ' +
          'fraction before buying cores, because 128 times the machine bought 3.3 times the speed.'
      }
    ],

    'choosing-a-cost-model': [
      {
        title: 'One workload, four models, four numbers that cannot be compared',
        goal: 'Predict the cost of the same sort under four cost models and work out which one ' +
          'the runtime tracks.',
        setup: 'Sorting 65 536 records, analysed as operations, cache misses, block transfers and ' +
          'critical-path steps.',
        steps: [
          {
            do: 'Count comparisons.',
            why: 'The RAM model charges one unit per operation.',
            work: 'n·log₂ n = 65 536 × 16 = 1 048 576 comparisons',
            result: 'the right answer when the data fits in cache and one core does the work'
          },
          {
            do: 'Count cache misses.',
            why: 'Once the working set exceeds the cache, the misses are the cost.',
            work: '10 240 cache misses',
            result: 'the right answer when the data fits in memory and the working set does not fit in cache'
          },
          {
            do: 'Count block transfers.',
            why: 'Once the data exceeds memory, everything else is noise beside the I/O.',
            work: '4 096 block transfers',
            result: 'the right answer when the data does not fit in memory'
          },
          {
            do: 'Count the critical path.',
            why: 'With enough processors the span is the floor.',
            work: '256 dependent steps',
            result: 'the right answer when there are more processors than the span can use'
          },
          {
            do: 'Check the one prediction that can be checked.',
            why: 'A model nobody has compared against anything is a preference, not a prediction.',
            work: 'sorting 16 384 records under the DAM simulator costs 1 024 transfers against a ' +
              'prediction of 1 024',
            result: 'an exact match, which is what licenses using the formula at sizes too large to run'
          }
        ],
        answer: 'The four predictions span 4 096× — from 256 to 1 048 576 — and comparing them is ' +
          'a category error, because they count comparisons, misses, transfers and steps. All four ' +
          'are correct; at most one of them tracks the runtime, and which one is decided by where ' +
          'the data sits rather than by which number is largest. The DAM row is the only one that ' +
          'can be validated against a simulator, and it is: that agreement is what makes the ' +
          'formula usable at sizes nobody will run.'
      },
      {
        title: 'The inverted case: four access patterns over one array, and three are memory-bound',
        goal: 'Measure where a loop’s time goes without changing the loop body at all.',
        setup: 'Four traversals of the same 4 096-element array against the same cache: ' +
          'sequential, a stride of 8 doubles, a stride of 64, and random probes.',
        steps: [
          {
            do: 'Walk the array sequentially.',
            why: 'It is the compulsory-traffic baseline.',
            work: '4 096 accesses, 512 misses, 32 768 bytes fetched for 32 768 used',
            result: 'a 12.5% miss rate and 1.0 bytes per byte — one miss per cache line and nothing wasted'
          },
          {
            do: 'Stride by 8 doubles, exactly one cache line.',
            why: 'This is a loop touching one field of every struct in an array.',
            work: '512 accesses, 512 misses, 32 768 bytes fetched for 4 096 used',
            result: 'a 100% miss rate and 8.0× waste — the same traffic for an eighth of the work'
          },
          {
            do: 'Stride by 64 doubles, eight lines.',
            why: 'Fewer accesses still; the question is whether that helps.',
            work: '64 accesses, 64 misses, 4 096 bytes fetched for 512 used',
            result: 'still 100% and still 8.0× — the miss RATE saturates and stays there'
          },
          {
            do: 'Probe at random.',
            why: 'The worst realistic case, and the one a pointer-chasing structure produces.',
            work: '4 096 accesses, 3 604 misses, 230 656 bytes fetched for 32 768 used',
            result: 'an 88% miss rate and 7.0× waste'
          },
          {
            do: 'Name the binding resource per row.',
            why: 'Bytes-per-byte says whether the memory system is the problem.',
            work: '1.0× for the scan and 7.0× to 8.0× for the other three',
            result: '3 of 4 patterns are memory-bound, on identical arithmetic'
          }
        ],
        answer: 'The same array, the same cache, and the same amount of useful data — and three of ' +
          'the four traversals are bound by the memory system rather than by anything the loop ' +
          'body does. The strided rows carry the actionable finding: once the stride exceeds a ' +
          'line every access misses however few there are, so touching one field of every struct ' +
          'pays sixty-four bytes for eight. That is a layout problem, and no amount of optimising ' +
          'the loop body touches it — which is exactly the kind of conclusion a cost model is ' +
          'chosen in order to reach.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));

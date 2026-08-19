/** Worked examples for the counting and quantile sections (M07.4-M07.6). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    hyperloglog: [
      {
        title: 'Choosing a precision, and checking that σ means what it says',
        goal: 'Turn a target relative error into a register count, then measure whether the sketch ' +
          'delivers it on a real stream.',
        setup: 'A Zipf stream of 200 000 items over 50 000 possible keys, which contains 21 619 ' +
          'distinct keys, and HyperLogLog at four precisions.',
        steps: [
          {
            do: 'Invert the error formula to get m.',
            why: 'This is the only sizing decision, and the cardinality does not appear in it.',
            work: 'σ = 1.04/√m  ⇒  m = (1.04/σ)²\nfor σ = 2%: m = 2 704 → round up to 2^12 = 4 096',
            result: 'p = 12, m = 4 096, claimed σ = 1.63%'
          },
          {
            do: 'Convert m into bytes.',
            why: 'A register needs only six bits, and the difference between six and eight is 25%.',
            work: 'packed:  4 096 × 6 / 8 = 3 072 bytes\nunpacked: 4 096 bytes, one per register',
            result: '3 072 bytes, whatever the answer turns out to be'
          },
          {
            do: 'Run the stream and compare the estimate with an exact Set.',
            why: 'The sketch\'s claim is about the gap between those two, so both have to exist.',
            work: 'exact:    21 619 distinct keys\nestimate: 21 665\nerror:    +46 = +0.21%',
            result: '0.13σ — well inside the claim'
          },
          {
            do: 'Repeat at three other precisions on the same stream.',
            why: 'One measurement inside a band is not evidence that the band is the right one.',
            work: 'p =  8: σ 6.50%, 192 B, estimate 21 122, error −2.30% (0.35σ)\n' +
              'p = 10: σ 3.25%, 768 B, estimate 21 550, error −0.32% (0.10σ)\n' +
              'p = 14: σ 0.81%, 12 288 B, estimate 21 660, error +0.19% (0.23σ)',
            result: 'every one inside 0.4σ, and memory quadrupling per halving of σ'
          },
          {
            do: 'Compare against keeping the keys.',
            why: 'The exact option has to be priced before the sketch can be said to have won.',
            work: 'a Set of 21 619 string keys ≈ 1.2 MB\nthe sketch: 3 072 bytes',
            result: '400× smaller, at 1.63% error and no ability to answer anything else'
          }
        ],
        answer: 'A 2% target needs 4 096 registers, which is p = 12 and 3 072 bytes packed, and the ' +
          'sketch measures +0.21% against a claimed σ of 1.63% on a 21 619-key stream. The cost model ' +
          'contains no cardinality at all: the same 3 072 bytes would answer for a billion distinct ' +
          'keys at the same 1.63%, which is what makes the structure worth the approximation.'
      },
      {
        title: 'Four shards, and the one line of arithmetic that ruins them',
        goal: 'Invert the first example: instead of one stream and one sketch, take four sketches and ' +
          'combine them — correctly, and then the way it is usually done.',
        setup: 'The same 200 000-item stream, dealt round-robin into four shards, each with its own ' +
          'p = 12 sketch, plus one sketch of the whole stream for comparison.',
        steps: [
          {
            do: 'Estimate each shard separately.',
            why: 'These are the numbers a per-shard dashboard already has.',
            work: 'shard estimates: 9 010, 9 427, 9 300, 8 965\neach shard genuinely holds about 9 200 distinct keys',
            result: 'four accurate answers to four different questions'
          },
          {
            do: 'Add them up, which is what the dashboard does.',
            why: 'It is the obvious operation and it is wrong for a reason worth naming.',
            work: '9 010 + 9 427 + 9 300 + 8 965 = 36 702\ntrue distinct count: 21 619',
            result: '+69.8% — every key present in more than one shard counted more than once'
          },
          {
            do: 'Merge the register arrays instead, taking the maximum entry by entry.',
            why: 'A register holds a maximum, and the maximum of maxima is the maximum of the union.',
            work: 'merged estimate: 21 607\nsketch of the whole stream: 21 607',
            result: 'identical — not close, identical'
          },
          {
            do: 'Check the register arrays element by element rather than comparing the estimates.',
            why: 'A merge that dropped a shard would still produce a plausible estimate.',
            work: '4 096 registers compared: all equal',
            result: 'the merge is exact, so the test can be an equality'
          },
          {
            do: 'Read the two results against the truth.',
            why: 'To state which operation is an approximation and which is a mistake.',
            work: 'exact:  21 619\nmerged: 21 607  (−0.06%, well inside σ = 1.63%)\n' +
              'summed: 36 702  (+69.8%, and not an estimate of anything)',
            result: 'merging approximates; adding does not'
          }
        ],
        answer: 'Four individually accurate shard sketches sum to 36 702 against a true distinct count ' +
          'of 21 619 — a 70% over-count produced entirely by the arithmetic applied after the ' +
          'sketches. Merging the register arrays gives 21 607, which is not an approximation of the ' +
          'whole-stream sketch but is register-for-register identical to it. That exactness is why ' +
          'the test for a merge should assert equality: an approximate check would pass a merge that ' +
          'silently lost a shard.'
      }
    ],

    'count-min-sketch': [
      {
        title: 'Sizing a count-min sketch, and checking the bound key by key',
        goal: 'Turn ε and δ into a matrix, then verify both halves of the guarantee against the exact ' +
          'counts of every key in the stream.',
        setup: 'A Zipf stream of 200 000 items over 21 619 distinct keys, with an exact Map kept ' +
          'alongside.',
        steps: [
          {
            do: 'Choose w from ε and d from δ.',
            why: 'They are independent: one sets how wrong the answer can be, the other how often.',
            work: 'w = ⌈e/ε⌉; for ε = 0.0053 that is ⌈512.87⌉ = 513, and the demo uses 512\nd = ⌈ln(1/δ)⌉ = 5 gives δ = e^−5 = 0.674%',
            result: '512 × 5 = 2 560 cells, 20 480 bytes, achieving ε = e/512 = 0.005309'
          },
          {
            do: 'Compute the additive bound at this stream length.',
            why: 'The guarantee is stated in absolute terms, so it needs N to become a number.',
            work: 'ε·N = (e/512) × 200 000 = 0.005309 × 200 000',
            result: '1 062 — no key may exceed its true count by more than this'
          },
          {
            do: 'Check the never-under half against every key.',
            why: 'This is the property the sketch is chosen for and it is absolute, not probabilistic.',
            work: 'keys estimated below their true count: 0 of 21 619',
            result: 'one-sided, exactly as specified'
          },
          {
            do: 'Check the bounded-over half against every key.',
            why: 'δ is a per-key failure probability, so the check is a count of violations.',
            work: 'worst over-count: 363\nmean absolute error: 97.9\nkeys exceeding 1 062: 0',
            result: 'the worst key is at a third of the bound'
          },
          {
            do: 'Turn on conservative update and repeat.',
            why: 'It changes only the write path, so any difference is attributable to that alone.',
            work: 'mean absolute error: 97.9 → 54.2\nworst over-count: 363 → 261\n' +
              'keys under-counted: still 0',
            result: '1.81× tighter on the mean, with the guarantee intact'
          }
        ],
        answer: 'ε = 0.005309 and δ = 0.0067 give a 512 × 5 matrix of 20 480 bytes and an additive bound ' +
          'of 1 062 at this stream length. Every one of the 21 619 keys is estimated at or above its ' +
          'true count and none exceeds the bound; the worst is 363 over. Conservative update cuts the ' +
          'mean absolute error from 97.9 to 54.2 by skipping writes to cells that are already above ' +
          'the key\'s own estimate, and it costs nothing but the ability to merge by addition.'
      },
      {
        title: 'The keys the bound is useless for',
        goal: 'Invert the first example: the same guarantee, read as a relative error, is excellent at ' +
          'the head of the distribution and meaningless in the tail.',
        setup: 'The same sketch and the same stream, with the keys sorted by true frequency.',
        steps: [
          {
            do: 'Read the bound against the heaviest key.',
            why: 'The bound is a single number; what it means depends entirely on what it is compared to.',
            work: 'rank 1: true 27 954, estimate 28 025, over by 71\nbound 1 062 = 3.80% of that key',
            result: '0.3% actual error on the key everybody cares about'
          },
          {
            do: 'Read it against the hundredth key.',
            why: 'This is where the additive bound starts to be the dominant term.',
            work: 'rank 100: true 176, estimate 296, over by 120',
            result: '68% relative error, from an absolute error a tenth of the bound'
          },
          {
            do: 'Read it against a key seen fourteen times.',
            why: 'To see the failure mode named rather than implied.',
            work: 'rank 1 000: true 14, estimate 110, over by 96\nbound 1 062 = 7 584% of that key',
            result: 'the answer is noise, and the guarantee is being honoured throughout'
          },
          {
            do: 'Read it against a key seen once.',
            why: 'The tail of a Zipf stream is most of the distinct keys, so this is the common case.',
            work: 'rank 10 000: true 1, estimate 88\nrank 21 619: true 1, estimate 115',
            result: 'nearly 90× over, for the majority of the key set'
          },
          {
            do: 'State what the structure therefore is.',
            why: 'Because "frequency sketch" invites exactly the wrong use.',
            work: 'excellent above ~ε·N occurrences, meaningless below it\n' +
              'ε·N = 1 062 here, so about 20 keys of 21 619 are well estimated',
            result: 'a heavy-hitter structure, not a frequency table'
          }
        ],
        answer: 'The same 1 062-count bound is 3.8% of the heaviest key and 7 584% of a key seen ' +
          'fourteen times, and the sketch honours it everywhere: the estimate for a once-seen key ' +
          'reads 88. A count-min sketch is a heavy-hitter structure and calling it a frequency table ' +
          'invites the one use it cannot serve. The rule of thumb falls out of the bound itself — ' +
          'trust the estimate for keys well above ε·N occurrences, and for nothing below it.'
      }
    ],

    'quantile-sketches': [
      {
        title: 'Four sketches, one latency stream, two kinds of error',
        goal: 'Measure each sketch twice — once in milliseconds and once in rank — and see that the ' +
          'two rankings disagree.',
        setup: '200 000 requests: 90% lognormal around 20 ms and 10% around 300 ms, with every value ' +
          'kept for the exact answer.',
        steps: [
          {
            do: 'Establish the exact quantiles and the memory they cost.',
            why: 'Every claim below is a comparison against these four numbers.',
            work: 'p50 21.15 ms, p90 67.39, p99 738.88, p99.9 1 533.84\n' +
              '200 000 doubles = 1 600 000 bytes',
            result: 'the mean, 58.13 ms, is none of them'
          },
          {
            do: 'Read the value error of each sketch at p99.9.',
            why: 'This is where the four separate most, and where an SLO usually lives.',
            work: 'reservoir (8 000 B): 938.3 ms, −38.82%\nKLL (2 152 B):        897.3 ms, −41.50%\n' +
              't-digest (944 B):    1 594.8 ms,  +3.98%\nDDSketch (4 116 B):  1 525.7 ms,  −0.53%',
            result: 'DDSketch by a factor of seven, from four times t-digest\'s memory'
          },
          {
            do: 'Read the rank error of the same four answers.',
            why: 'It is the same answer scored against a different definition of correct.',
            work: 'reservoir −0.421 pp   KLL −0.489 pp\nt-digest +0.013 pp   DDSketch −0.003 pp',
            result: 't-digest is second best here and worst but one above'
          },
          {
            do: 'Look at p90, where the two modes meet.',
            why: 'A steep region turns a small rank error into a large value error, and this shows it.',
            work: 't-digest: rank +0.267 pp, value +23.55%\nDDSketch: rank −0.001 pp, value −0.04%',
            result: 'one answer, 0.267 percentage points and 23.55% at the same time'
          },
          {
            do: 'Match each sketch to the guarantee it makes.',
            why: 'So the numbers above stop looking like four attempts at one job.',
            work: 'reservoir (8 000 B): a uniform sample, no per-quantile bound at all\n' +
              't-digest (944 B):   no formal bound, empirically 0.267 pp of rank at worst\n' +
              'KLL (2 152 B):      a proven rank bound, 0.489 pp measured\n' +
              'DDSketch (4 116 B): |v̂ − v| ≤ α·v, measured 0.53% at α = 1%',
            result: 'only one of the four bounds the thing an SLO is written in'
          }
        ],
        answer: 'At p99.9 DDSketch is 0.53% out and KLL is 41.50% out; measured by rank instead, ' +
          'DDSketch is 0.003 percentage points out and KLL 0.489, and t-digest beats the reservoir on ' +
          'rank while losing to it nowhere. The two scoreboards disagree because a bimodal stream has ' +
          'regions where the quantile function is nearly vertical, and 0.267 percentage points of ' +
          'rank there is 23.55% of value. Which column matters is decided by how the requirement was ' +
          'written, not by the sketch.'
      },
      {
        title: 'The dashboard that hides the outage',
        goal: 'Invert the first example: not one stream and four sketches, but eight streams and one ' +
          'number — and the aggregation that makes it worse than useless.',
        setup: 'Eight shards of 25 000 requests each. Seven are healthy with 5% of requests in the ' +
          'slow mode; one is degraded, with 60%.',
        steps: [
          {
            do: 'Compute each shard\'s exact p99.',
            why: 'These are the per-shard numbers every monitoring system produces by default.',
            work: 'healthy shards: 558, 575, 544, 545, 533, 507, 550 ms\ndegraded shard: 1 345 ms',
            result: 'the degraded shard is visible in its own panel'
          },
          {
            do: 'Average them, which is what a fleet-wide panel does.',
            why: 'It is the arithmetic a dashboard applies to any per-shard series without asking.',
            work: '(558 + 575 + 544 + 545 + 533 + 507 + 550 + 1 345) / 8 = 644.65 ms',
            result: 'one bad shard is one value in eight, and gets outvoted'
          },
          {
            do: 'Compute the true global p99 over all 200 000 requests.',
            why: 'This is the number the users are actually experiencing.',
            work: 'exact p99 of the union: 780.37 ms',
            result: 'the averaged panel reads 17.39% below it'
          },
          {
            do: 'Merge eight DDSketches and query the merged sketch once.',
            why: 'A bucket-wise addition is the correct operation, and it is as cheap as the average.',
            work: 'merged p99: 772.92 ms, −0.95% against the truth\nα = 1%, so this is inside the guarantee',
            result: 'the right answer, from the same per-shard data'
          },
          {
            do: 'Note when the mistake is invisible.',
            why: 'Because that is why it survives long enough to matter.',
            work: 'over eight statistically identical shards the average is within 0.1% of the truth',
            result: 'it only breaks when a shard misbehaves — which is the only time anybody looks'
          }
        ],
        answer: 'Averaging eight per-shard p99s reads 644.65 ms against a true global p99 of 780.37 — ' +
          '17.39% low, and low is the direction that hides the incident. Merging the sketches instead ' +
          'gives 772.92 ms, inside the 1% the sketch guarantees. The averaged number is not a poorer ' +
          'estimate of the global p99; it is an estimate of nothing, and it looks correct on identical ' +
          'shards, which is exactly when nobody is checking.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));

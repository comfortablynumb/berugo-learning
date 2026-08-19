/** Worked examples for the similarity, window and selection sections (M07.7-M07.9). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'minhash-and-lsh': [
      {
        title: 'Spending one signature budget three different ways',
        goal: 'Fix the number of hashes and show that the band split, not the signature length, is ' +
          'what decides which pairs the index finds.',
        setup: '60 documents in 12 families of 5, five-character shingles, 128 min-hashes each, and a ' +
          '50% Jaccard similarity counted as a duplicate.',
        steps: [
          {
            do: 'Establish the exact answer by comparing every pair.',
            why: 'Precision and recall are meaningless without the set they are measured against.',
            work: 'pairs: 60 × 59 / 2 = 1 770\npairs at or above 0.50 Jaccard: 11',
            result: '11 true duplicate pairs out of 1 770'
          },
          {
            do: 'Check that the signature estimates similarity well enough to be worth banding.',
            why: 'If the estimate were poor, no split of it would help.',
            work: 'standard error 1/√128 = 8.84%\nworst estimate error over all 1 770 pairs: 10.34%',
            result: 'unbiased, and inside 1.2 standard errors at the worst pair'
          },
          {
            do: 'Split the 128 hashes as 8 bands of 16 rows.',
            why: 'A long band demands a long exact agreement, which is a high threshold.',
            work: 'curve threshold (1/8)^(1/16) = 0.878\ncandidates proposed: 0',
            result: 'recall 0%, precision 100% — it finds nothing and is never wrong'
          },
          {
            do: 'Split the same 128 hashes as 16 × 8, then 32 × 4.',
            why: 'To move the curve without changing the signature at all.',
            work: '16 × 8: threshold 0.707, 3 candidates, recall 27.3%, precision 100%\n' +
              '32 × 4: threshold 0.420, 22 candidates, recall 100%, precision 50.0%',
            result: 'the same hashes give a strict index or a generous one'
          },
          {
            do: 'Price the work each split avoids.',
            why: 'Because avoiding the quadratic comparison is the only reason the index exists.',
            work: 'exhaustive: 1 770 pair comparisons\n32 × 4: 22 candidates verified exactly',
            result: '98.8% of the pairs never examined, at full recall'
          }
        ],
        answer: 'The same 128 hashes produce three completely different retrieval systems: 8 × 16 ' +
          'proposes nothing, 16 × 8 finds 27.3% of the duplicates with no false proposals, and ' +
          '32 × 4 finds all of them while half its proposals are wrong. The signature length sets ' +
          'the estimate\'s accuracy; the split sets the policy. Choosing the length first and letting ' +
          'b and r fall out is making the retrieval decision by accident.'
      },
      {
        title: 'The same corpus at a sixty-fourth of the memory',
        goal: 'Invert the first example — instead of tuning MinHash, replace it with SimHash and find ' +
          'out what the cheaper structure actually gives up.',
        setup: 'The same 60 documents, a 64-bit SimHash each, and the same 50% duplicate threshold.',
        steps: [
          {
            do: 'Compare the per-document memory.',
            why: 'This is the reason to consider SimHash at all.',
            work: 'MinHash, 128 hashes × 4 bytes: 512 bytes per document\nSimHash, 64 bits: 8 bytes',
            result: '64× smaller, before any index is built'
          },
          {
            do: 'Note that the threshold is now in different units.',
            why: 'A cut tuned on similarity does not transfer to a Hamming distance.',
            work: 'MinHash: "estimated Jaccard ≥ 0.50"\nSimHash: "Hamming distance ≤ d of 64 bits"',
            result: 'the tuning has to be redone from scratch against the corpus'
          },
          {
            do: 'Sweep the Hamming cutoff and score it against the same 11 true pairs.',
            why: 'To find whether any cutoff reproduces the MinHash answer.',
            work: '≤ 12 bits: 2 flagged, recall 18.2%, precision 100%\n' +
              '≤ 16 bits: 9 flagged, recall 63.6%, precision 77.8%\n' +
              '≤ 20 bits: 30 flagged, recall 100%, precision 36.7%',
            result: 'full recall costs 36.7% precision, against 50% for MinHash at 32 × 4'
          },
          {
            do: 'Say why the two disagree at all.',
            why: 'They are not two approximations of one quantity.',
            work: 'MinHash estimates |A ∩ B| / |A ∪ B| — set overlap, 0 to 1\n' +
              'SimHash estimates θ/π from the differing-bit fraction, 0 to 32 of 64 bits\n' +
              '32 differing bits means orthogonal, not "half similar"',
            result: 'two documents can overlap heavily and still point in different directions'
          },
          {
            do: 'Check the third member of the family on the same principle.',
            why: 'Random projection makes the "how many dimensions" question concrete.',
            work: 'Johnson-Lindenstrauss for 60 points at ε = 0.3 asks for 364 dimensions\n' +
              'projecting into 64: worst distortion 29.95%, mean 6.68%',
            result: 'the lemma\'s constant is about 5.7× conservative here'
          }
        ],
        answer: 'SimHash costs 8 bytes per document against MinHash\'s 512 and reaches full recall at ' +
          '36.7% precision against MinHash\'s 50% — but the comparison is not really about accuracy. ' +
          'It measures the angle between weighted token vectors rather than set overlap, so the ' +
          'threshold is in different units and every tuning decision has to be repeated. The pattern ' +
          'repeats for random projection: Johnson-Lindenstrauss demands 364 dimensions and 64 ' +
          'measured 29.95% distortion against a promised 30%.'
      }
    ],

    'windowed-counting': [
      {
        title: 'Sizing DGIM for an error target',
        goal: 'Turn a tolerable relative error into a bucket allowance, and check the memory it costs ' +
          'against the exact ring buffer.',
        setup: 'A bursty 0/1 stream of 200 000 positions, a 20 000-position window, and an exact ring ' +
          'buffer kept alongside for the truth.',
        steps: [
          {
            do: 'Price the exact answer.',
            why: 'The lower bound says this is the only way to be exact, so it is the baseline.',
            work: 'one bit per position in the window: 20 000 bits',
            result: '20 000 bits, and no way to do better exactly'
          },
          {
            do: 'Run plain DGIM — two buckets of any one size.',
            why: 'This is the canonical version and the loosest useful setting.',
            work: '20 buckets, each carrying a size and a timestamp of ⌈log₂ 20 001⌉ = 15 bits\n' +
              '20 × 2 × 15 = 600 bits\nworst relative error over the run: 26.14%',
            result: '33.3× smaller, at a quarter error'
          },
          {
            do: 'Double the bucket allowance twice and measure again.',
            why: 'The bound says the error should halve each time; that is a prediction to check.',
            work: 'r =  4: 41 buckets, 1 230 bits, worst error 12.93%\n' +
              'r =  8: 76 buckets, 2 280 bits, worst error  6.38%',
            result: 'each doubling halves the error, exactly as 1/2r predicts'
          },
          {
            do: 'Find the allowance that meets a 3% target.',
            why: 'That is the question a real deployment asks.',
            work: '1/2r ≤ 0.03  ⇒  r ≥ 16.7, so r = 16\nmeasured: 145 buckets, 4 350 bits, 2.97%',
            result: 'r = 16, 4 350 bits — still 4.6× smaller than exact'
          },
          {
            do: 'Read the structure\'s own error report at that setting.',
            why: 'It can compute its uncertainty without the exact answer, which is what to export.',
            work: 'half the oldest bucket over the total: 2.45% at the moment of measurement',
            result: 'a number a production system can publish, with no reference to keep'
          }
        ],
        answer: 'A 3% target needs 16 buckets per size, which is 145 buckets and 4 350 bits against ' +
          '20 000 for the exact ring — still 4.6× smaller. The trade is a single geometric knob: 600 ' +
          'bits at 26.14%, 1 230 at 12.93%, 2 280 at 6.38%, 4 350 at 2.97%, each doubling of memory ' +
          'halving the error. And the structure can report its own current uncertainty from half the ' +
          'oldest bucket, which is the number to export.'
      },
      {
        title: 'Three top-k structures, three different guarantees',
        goal: 'Invert the sizing question: with the memory fixed, find out what each structure ' +
          'actually promises, and which of them answers "right now".',
        setup: 'A Zipf stream of 200 000 items over 21 619 distinct keys, through space-saving with ' +
          '200 counters, lossy counting at ε = 1/2 000, and a decayed counter with a 20 000-item ' +
          'half-life.',
        steps: [
          {
            do: 'Read space-saving\'s guarantee and check it.',
            why: 'It is one-sided upwards, with a per-key slack the caller can read.',
            work: 'count − error ≤ truth ≤ count\nguaranteed to hold every key above N/m = 1 000\n' +
              'worst over-count in the reported top-10: 0\nmemory: 8 000 bytes',
            result: 'exact on the head of this distribution, and it says so per key'
          },
          {
            do: 'Read lossy counting\'s guarantee and check it.',
            why: 'The direction is the opposite, which matters more than the size.',
            work: 'count ≤ truth ≤ count + εN = count + 100\n270 entries kept, 10 800 bytes\n' +
              'worst under-count in the reported top-10: 0',
            result: 'never over — the mirror image of space-saving'
          },
          {
            do: 'Read the decayed counter\'s memory.',
            why: 'Because it is the one people reach for when they mean "recently".',
            work: '21 619 keys retained, 518 856 bytes\na decayed value only reaches zero in the limit',
            result: '65× space-saving\'s memory, and no bound at all'
          },
          {
            do: 'Compare what each is actually counting.',
            why: 'The three columns are not three estimates of one quantity.',
            work: 'space-saving: occurrences since the beginning\nlossy: the same, from below\n' +
              'decayed: a half-life-weighted recent rate — key-0 reads 4 048 against 27 954',
            result: 'labelling all three "count" on one dashboard is a category error'
          },
          {
            do: 'State what a real windowed top-k costs.',
            why: 'Because it is the query that was wanted and none of the three provides it.',
            work: 'decay: 1× the memory, a blurred boundary, no window semantics\n' +
              'a ring of 12 five-minute sketches: 12× the memory, a real boundary',
            result: 'two honest options, and the choice has to be made explicitly'
          }
        ],
        answer: 'Space-saving over-estimates and knows by how much, lossy counting under-estimates and ' +
          'knows by how much, and a decayed counter answers a different question entirely while ' +
          'bounding nothing — 518 856 bytes against 8 000. None of the three answers "in the last ' +
          'five minutes": that needs decay, which blurs the boundary, or a ring of per-interval ' +
          'sketches, which multiplies the memory by the number of intervals. Deciding which is the ' +
          'design work, and it is the step usually skipped.'
      }
    ],

    'choosing-sketches': [
      {
        title: 'Running the chooser on a real budget',
        goal: 'State a question, a budget and a tolerance, and let the measurement rather than the ' +
          'table pick the structure.',
        setup: 'The Zipf stream of 200 000 items over 21 619 distinct keys, a 64 KB budget and a 2% ' +
          'error tolerance, with every candidate built and fed the same input.',
        steps: [
          {
            do: 'Ask the membership question.',
            why: 'It has the widest field, and the exact option is the one usually not priced.',
            work: 'Bloom 1%:      25 903 B, measured 1.045%  — usable\n' +
              'blocked Bloom:  25 920 B, measured 1.200%  — usable\n' +
              'Bloom 0.1%:     38 854 B, measured 0.070%  — usable\n' +
              'quotient r = 7: 40 960 B, measured 0.525%  — usable\n' +
              'cuckoo f = 8:   32 768 B, measured 2.005%  — too inaccurate\n' +
              'a Set:       1 234 098 B, exact           — too large',
            result: 'the 1% Bloom filter, at 25 903 bytes'
          },
          {
            do: 'Ask the distinct-count question with the same budget.',
            why: 'To see a field where the cheapest candidate is far inside the constraint.',
            work: 'HLL p = 10:   768 B, 0.318%  — usable\nHLL p = 12: 3 072 B, 0.214%\n' +
              'HLL p = 14: 12 288 B, 0.188%\na Set: 1 234 098 B',
            result: 'p = 10, at 768 bytes and 1 607× smaller than exact'
          },
          {
            do: 'Ask the frequency question.',
            why: 'Because the honest answer here is that nothing fits.',
            work: 'count-min 256 × 5, conservative: 10 240 B, worst relative error over the top 100: 4.49%\n' +
              'count-min 2 048 × 5:            81 920 B — over budget\nexact Map: 1 210 664 B — over budget',
            result: 'no candidate meets both constraints'
          },
          {
            do: 'Say what "nothing fits" means operationally.',
            why: 'It is a useful answer, and it is the one a lookup table cannot give.',
            work: 'raise the budget to 128 KB, or accept 5% error, or\n' +
              'change the metric: over the top 20 keys the conservative 256 × 5 sketch is exact',
            result: 'three moves, and the third is usually the right one'
          },
          {
            do: 'Ask the hot-keys question.',
            why: 'To land on a structure with no hashing in it at all.',
            work: 'space-saving 200 counters:  8 000 B, 0 of the true top 20 missed\n' +
              'space-saving 50 counters:   2 000 B, 9 of 20 missed\n' +
              'space-saving 1 000:        40 000 B, 0 missed',
            result: '200 counters, at 8 000 bytes'
          }
        ],
        answer: 'At 64 KB and a 2% tolerance the chooser recommends a 1% Bloom filter for membership ' +
          '(25 903 bytes, measured 1.045%), HyperLogLog at p = 10 for distinct counting (768 bytes, ' +
          '0.318%), and space-saving with 200 counters for hot keys (8 000 bytes, nothing missed) — ' +
          'and reports that nothing fits for per-key frequency, because the additive bound makes the ' +
          'hundredth key 4.49% out at the largest sketch that fits. That last answer is the one a ' +
          'table cannot give, and it comes from measuring the candidates rather than looking them up.'
      },
      {
        title: 'Two attacks, and the one line that stops both',
        goal: 'Invert the chooser: instead of picking a structure for a workload, break a correctly ' +
          'chosen one with a workload built for it.',
        setup: 'A Bloom filter over 5 000 keys with a published seed, and a 32 × 3 count-min sketch ' +
          'with the same.',
        steps: [
          {
            do: 'Search for keys the filter accepts but never held.',
            why: 'This is the entire attack: try keys until one is accepted.',
            work: 'target 1%: 50 false positives from 5 179 probes — 103.6 each\n' +
              '1/ε predicts 99.6',
            result: 'a manufactured false positive costs about a hundred hash computations'
          },
          {
            do: 'Check whether lowering the error rate defends against it.',
            why: 'It is the first thing anyone tries, and the exchange rate is bad.',
            work: 'target 10%:  9.0 probes per hit\ntarget 1%:  103.6\ntarget 0.1%: 967.7',
            result: 'the attacker\'s work scales as 1/ε, and so does your memory'
          },
          {
            do: 'Test the manufactured keys against a filter with a different seed.',
            why: 'This is the actual defence, and it should be measurable.',
            work: '50 keys tested against a differently seeded filter of the same shape\n' +
              'reported present: 0\nchance alone predicts 0.50',
            result: 'the precomputation is worth nothing against an unknown seed'
          },
          {
            do: 'Attack the count-min sketch instead.',
            why: 'To show the same idea against a structure whose guarantee is not violated by it.',
            work: 'find keys colliding with a victim in all 3 rows: 8 found in 305 021 probes\n' +
              'w^d = 32 768 predicted per hit; measured 38 128\n' +
              'push 5 000 events through each: victim goes from 100 to 40 100',
            result: '401× the true count, with the ε·N bound never exceeded'
          },
          {
            do: 'Price the same attack against a production-sized sketch.',
            why: 'Because the width is the other half of the defence.',
            work: 'a 2 048 × 5 sketch: w^d = 3.60 × 10¹⁶ candidates per collision',
            result: 'infeasible — but only while the seed is also unknown'
          }
        ],
        answer: 'Fifty false positives cost 5 179 probes against a 1% filter with a published seed, ' +
          'and none of them transfer to a filter seeded differently. A 32 × 3 count-min sketch can ' +
          'have one key\'s estimate driven from 100 to 40 100 by eight keys found in 305 021 probes, ' +
          'and its guarantee is never violated — ε·N grew with the flood. Lowering the error rate is ' +
          'the wrong defence, because the attacker\'s cost and your memory both scale as 1/ε. The ' +
          'defence is a per-process seed the attacker cannot read.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));

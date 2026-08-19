/** Concepts for the similarity, window and selection sections (M07.7-M07.9). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'minhash-and-lsh': [
      {
        term: 'The min-hash identity',
        plain: 'For a random permutation, the chance two sets share a minimum is exactly their Jaccard similarity.',
        formal: 'P[min h(A) = min h(B)] = |A ∩ B| / |A ∪ B|',
        detail: 'Take the union of the two sets and hash every element. The smallest hash in the union ' +
          'belongs to some element, and that element is equally likely to be any of them; the two ' +
          'minima agree exactly when it lies in the intersection. So a single hash is a Bernoulli ' +
          'trial with success probability equal to the Jaccard similarity, and averaging L of them ' +
          'is an unbiased estimate with standard error 1/√L. Nothing about the sets\' sizes enters ' +
          'the argument, which is why documents of wildly different lengths compare fine.',
        example: 'L = 128 gives a standard error of 8.84%; the worst pair in the demo corpus is 10.34% out.'
      },
      {
        term: 'Shingling turns a document into a set',
        plain: 'Overlapping k-character or k-word windows, so word order is partly preserved.',
        formal: 'shingles(t, k) = { t[i..i+k) : 0 ≤ i ≤ |t| − k }',
        detail: 'MinHash compares sets, so the first decision is what the set is, and it is a bigger ' +
          'decision than the sketch parameters. A bag of words treats a reordering as identical; ' +
          'five-character shingles do not, because reordering breaks the windows that spanned the ' +
          'boundary. Short shingles make everything look similar and long ones make near-duplicates ' +
          'look unrelated, so the width is a threshold in disguise and has to be tuned against the ' +
          'same corpus as b and r.',
        example: 'Five-character shingles over 60-word documents: 1 770 pairs, 11 above 50% similarity.'
      },
      {
        term: 'Banding, and the S-curve',
        plain: 'Split the signature into b bands of r rows; a pair is a candidate if any band matches entirely.',
        formal: 'P[candidate] = 1 − (1 − s^r)^b',
        detail: 'The curve is flat near zero, rises steeply, and flattens near one — which is exactly ' +
          'the shape a threshold wants, except that it is a probability rather than a cut. Its steep ' +
          'part sits near (1/b)^(1/r), and moving b and r moves it: 16 bands of 8 rows turns at ' +
          '0.707 and 32 bands of 4 turns at 0.420, from the identical 128 hashes. Choosing the split ' +
          'is choosing the retrieval policy, and doing it by picking a signature length first gets ' +
          'the decision made by accident.',
        example: '16 × 8 proposes 3 pairs of 1 770; 32 × 4 proposes 22. Same signature.'
      },
      {
        term: 'The split is the precision/recall dial',
        plain: 'More bands finds more true pairs and more false ones; fewer bands finds neither.',
        formal: 'recall and precision move in opposite directions along b',
        detail: 'On the demo corpus with a 50% duplicate threshold, 8 bands of 16 rows proposes ' +
          'nothing at all — perfect precision, zero recall — while 32 bands of 4 finds every true ' +
          'pair and is wrong about half the time. Neither is correct in the abstract: the right split ' +
          'is the one whose false-positive load the verification stage can afford, because every ' +
          'candidate pair is normally checked exactly afterwards. That makes the choice a question ' +
          'about the downstream cost rather than about hashing.',
        example: '8 × 16: recall 0%. 16 × 8: recall 27%, precision 100%. 32 × 4: recall 100%, precision 50%.'
      },
      {
        term: 'SimHash answers a different question',
        plain: 'One random hyperplane per output bit; the differing-bit fraction estimates the angle.',
        formal: 'P[bit differs] = θ/π, so cos θ ≈ cos(π · hamming / bits)',
        detail: 'MinHash estimates set overlap and SimHash estimates the angle between weighted ' +
          'vectors, and those rank a corpus differently: two documents can share most of their ' +
          'tokens while emphasising them very differently. SimHash is far cheaper — 8 bytes per ' +
          'document against 512 — and its threshold is a Hamming distance rather than a similarity, ' +
          'so a cut tuned on Jaccard does not transfer. The tuning has to be redone against the same ' +
          'corpus, which is what the cutoff table in the demo is.',
        example: '64-bit SimHash: 8 bytes per document, and a cutoff of 20 bits reaches full recall at 37% precision.'
      },
      {
        term: 'Random projection and Johnson-Lindenstrauss',
        plain: 'A random ±1/√k matrix preserves every pairwise distance to within 1 ± ε, given enough k.',
        formal: 'k ≥ 8 ln n / ε² suffices for n points',
        detail: 'The lemma is a worst-case statement over every pair and its constant is generous. ' +
          'For 60 points at ε = 0.3 it asks for 364 dimensions; projecting the same points into 64 ' +
          'measures a worst distortion of 29.95% — just inside the promise — and a mean of 6.68%. So ' +
          'the formula tells you a dimension that certainly works and measurement tells you the one ' +
          'you can get away with, and the gap between them is often a factor of five. The lemma is ' +
          'also independent of the source dimension, which is the surprising part.',
        example: 'JL asks for 364 dimensions; 64 measured a worst distortion of 29.95% against a promised 30%.'
      },
      {
        term: 'The estimate is unbiased, unlike count-min',
        plain: 'MinHash straddles the true similarity rather than sitting above it.',
        formal: 'E[estimate] = s, with variance s(1 − s)/L',
        detail: 'Every position of the signature is an independent Bernoulli trial for the same ' +
          'probability, so the fraction that agree is an unbiased estimator and the scatter of ' +
          'estimate against truth is centred on the y = x line rather than lying above it. That ' +
          'means a similarity threshold applied to the estimate misses genuine pairs about as often ' +
          'as it admits spurious ones, and it is why the band index exists: it is cheaper to be ' +
          'generous at the candidate stage and exact at the verification stage.',
        example: 'The scatter of 1 770 pairs straddles y = x, with a spread of 1/√128 = 8.84%.'
      },
      {
        term: 'The index is the point, not the estimate',
        plain: 'Comparing every pair is quadratic; the band index makes the search sublinear.',
        formal: 'candidates ≪ n(n − 1)/2',
        detail: 'A signature that estimates similarity accurately still needs every pair compared, ' +
          'and at 60 documents that is 1 770 comparisons — at a million it is 5×10¹¹. The band index ' +
          'turns the problem into a hash lookup: documents that share any band bucket are candidates ' +
          'and everything else is never examined. On the demo corpus that is 22 pairs of 1 770, a ' +
          '98.8% reduction, and the saving grows with the square of the corpus while the signature ' +
          'cost stays linear.',
        example: '22 candidate pairs examined of 1 770 — 98.8% never looked at.'
      }
    ],

    'windowed-counting': [
      {
        term: 'Exact windowed counting needs Ω(N) bits',
        plain: 'Answering "how many ones in the last N" exactly requires storing the window.',
        formal: 'the algorithm must distinguish all 2^N possible windows',
        detail: 'The lower bound is an information argument rather than an engineering one: two ' +
          'different windows that the algorithm cannot tell apart will produce the same answer, and ' +
          'since every one of the 2^N windows has a potentially different count, the state must be ' +
          'able to take 2^N values. That is N bits, which is exactly the ring buffer. Every ' +
          'structure in this section is therefore an approximation by necessity, not by choice, ' +
          'which is a different situation from a Bloom filter replacing a hash set.',
        example: 'A 20 000-bit window needs 20 000 bits exactly; DGIM answers it in 600.'
      },
      {
        term: 'DGIM buckets, timestamped by their newest one',
        plain: 'Buckets of size 1, 2, 4, … each stamped with the position of its most recent one.',
        formal: 'at most r buckets of any size, so there are O(log N) buckets',
        detail: 'The bucket sizes double because that is what keeps the count logarithmic, and each ' +
          'carries the timestamp of its newest member because that is the one that determines when ' +
          'the whole bucket leaves the window. Only the oldest bucket is ever uncertain — everything ' +
          'newer is entirely inside — so the estimate counts every bucket fully plus half of the one ' +
          'straddling the edge, half being the expected position of the boundary within it.',
        example: '20 buckets for a 20 000-bit window: 600 bits against 20 000, a 33× saving.'
      },
      {
        term: 'The bucket allowance is one geometric dial',
        plain: 'Allowing r buckets per size bounds the relative error by about 1/2r.',
        formal: 'error ≤ (oldest/2) / total, and the newer buckets sum to at least r(2^j − 1)',
        detail: 'The uncertainty is half the oldest bucket, and with r buckets of every smaller size ' +
          'the certain part is at least r times as large — so the ratio is bounded and shrinks ' +
          'linearly in r. That gives a single clean knob rather than a family of algorithms: 2 ' +
          'buckets per size is DGIM at 26.14% worst measured error and 600 bits, 4 gives 12.93% at ' +
          '1 230, 8 gives 6.38% at 2 280 and 16 gives 2.97% at 4 350. Doubling the memory halves ' +
          'the error, all the way down.',
        example: 'r = 2: 26.14% and 600 bits. r = 16: 2.97% and 4 350 bits.'
      },
      {
        term: 'The estimate is a staircase',
        plain: 'It changes only when a bucket expires or a merge moves a boundary.',
        formal: 'the state is piecewise constant between structural events',
        detail: 'Between the events that change the bucket layout, DGIM\'s answer is frozen while the ' +
          'true count drifts, so the error is not noise around the truth but a sawtooth that ' +
          'accumulates and then snaps back. That matters for alerting: a threshold crossing may be ' +
          'reported late by up to the width of the oldest bucket, which at 20 000 positions is ' +
          'thousands of items. Averaging consecutive readings does not help, because consecutive ' +
          'readings are the same number.',
        example: 'The plotted estimate is flat for long stretches while the exact count moves.'
      },
      {
        term: 'Space-saving: nothing starts from zero',
        plain: 'An unmonitored key takes over the smallest counter and inherits its value as a recorded error.',
        formal: 'count ← min + 1, error ← min',
        detail: 'Starting a new key at 1 would let a genuinely heavy key be evicted and then ' +
          'permanently under-reported. Inheriting the minimum instead makes every counter an upper ' +
          'bound on its key\'s true frequency, with the inherited part recorded as the slack — so a ' +
          'reported count of 4 000 with an error of 250 means the truth is between 3 750 and 4 000. ' +
          'The consequence is a guarantee with no hashing in it at all: any key whose frequency ' +
          'exceeds N/m must be in the table.',
        example: '200 counters over 200 000 items: every key above 1 000 occurrences is guaranteed present.'
      },
      {
        term: 'Lossy counting is the mirror image',
        plain: 'It under-estimates by at most εN, and also never misses a frequent key.',
        formal: 'count ≤ truth ≤ count + εN',
        detail: 'The stream is cut into windows of ⌈1/ε⌉ items, a key first seen in window b carries ' +
          'a handicap of b − 1, and at each boundary any key whose count plus handicap has not ' +
          'reached the window number is dropped. A key that keeps arriving survives; one that does ' +
          'not cannot have been frequent. The direction of the error is the opposite of ' +
          'space-saving\'s, which makes the pair a neat illustration that "approximate" is not one ' +
          'property — a system that can tolerate an over-count often cannot tolerate an under-count.',
        example: 'ε = 1/2 000 over 200 000 items: 270 entries kept, and a bound of 100.'
      },
      {
        term: 'Decay changes the question, not the memory',
        plain: 'Exponential decay makes counts recent; it does nothing to bound the number of keys.',
        formal: 'value ← value · 2^(−Δt/H) + 1, applied lazily on touch',
        detail: 'A decayed counter is cheap — multiply by 2^(−Δt/H) when the key is next touched, ' +
          'so the cost is per update rather than per tick — and it answers "most frequent lately" ' +
          'rather than "most frequent". What it does not do is bound anything: a decayed value only ' +
          'reaches zero in the limit, so every key ever seen still has an entry, and the demo\'s ' +
          'decayed table holds 21 619 keys in 518 856 bytes against space-saving\'s 8 000. The usable ' +
          'structure is decay *inside* a bounded counter set.',
        example: '518 856 bytes for 21 619 keys, against 8 000 for 200 space-saving counters.'
      },
      {
        term: '"In the last five minutes" is a third thing',
        plain: 'Space-saving counts since the beginning of time; a window needs more than decay.',
        formal: 'windowed top-k = a ring of per-interval sketches, or decay with a chosen half-life',
        detail: 'The query everybody actually asks combines two structures from this section and gets ' +
          'neither for free. Decay approximates a window with a half-life, which is cheap and blurs ' +
          'the boundary; a ring of per-interval sketches gives a real window and multiplies the ' +
          'memory by the number of intervals, and merging them needs the sketch to be mergeable — ' +
          'which space-saving only approximately is. Deciding which of those two you meant is the ' +
          'design work, and it is usually skipped.',
        example: 'A ring of 12 five-minute sketches is 12× the memory; decay is 1× and has no boundary.'
      }
    ],

    'choosing-sketches': [
      {
        term: 'Three questions, not one',
        plain: 'What is the error on, which direction can it go, and do two of them merge?',
        formal: 'the trade-off table is those three columns plus the size',
        detail: 'Size is the column everybody quotes and the least useful of the four. What the error ' +
          'is measured on decides whether a guarantee means anything for your requirement — a rank ' +
          'bound is silent about milliseconds. Its direction decides whether the system survives ' +
          'being wrong. And mergeability decides whether the design still works after the service is ' +
          'sharded, which it will be, and retrofitting it means changing the sketch rather than ' +
          'tuning it.',
        example: 'Count-min and count-sketch differ in exactly one of those columns, and it is decisive.'
      },
      {
        term: 'Price exactness first',
        plain: 'A hash set of the keys is often affordable, and it is always right.',
        formal: 'exact memory = Θ(distinct keys × key size)',
        detail: 'A Set holding 21 619 string keys is about 1.2 MB, which is a lot next to a Bloom ' +
          'filter\'s 26 KB and nothing at all next to the machine it runs on. Sketches earn their ' +
          'place when the key count is genuinely large, when there are thousands of streams rather ' +
          'than one, or when the answer has to cross a network — and not simply because the exact ' +
          'structure sounds expensive. The chooser prices the exact option in every ranking for ' +
          'exactly this reason.',
        example: '1.2 MB exact against 26 KB approximate — a real difference only at scale or in bulk.'
      },
      {
        term: 'Mergeability is a design constraint, not a feature',
        plain: 'A system that shards will need to combine sketches, and not all of them can.',
        formal: 'HLL and DDSketch merge exactly; cuckoo filters do not merge at all',
        detail: 'HyperLogLog and DDSketch merge exactly, count-min merges by addition unless it uses ' +
          'conservative update, quotient filters merge in one linear pass, Bloom filters merge only ' +
          'at identical shape and seed, and cuckoo filters do not merge at all because the bucket ' +
          'assignment depends on the table size. Discovering that after the service is sharded means ' +
          'replacing the structure, which means a migration of stored state — which is why the ' +
          'column belongs in the first comparison rather than the last.',
        example: 'Conservative update tightens count-min by 1.8× and costs it merging by addition.'
      },
      {
        term: 'Composing sketches inherits the worst of both',
        plain: 'A per-key HLL inside a count-min is one-sided outside and two-sided inside.',
        formal: 'the composed error is neither bounded like the outer sketch nor like the inner one',
        detail: 'Sketch-of-sketches designs are common — distinct users per URL, distinct sources per ' +
          'flow — and their guarantees do not compose in any convenient way. The outer structure\'s ' +
          'collisions merge two inner sketches that should have been separate, so the inner estimate ' +
          'is now over a union it was not meant to see, and the outer bound says nothing about that. ' +
          'The honest approach is to measure the composition end to end against an exact reference, ' +
          'because there is no formula to appeal to.',
        example: 'The outer bound is on counts; the inner error is relative. Neither describes the pair.'
      },
      {
        term: 'A published seed is an attack surface',
        plain: 'Knowing the seed lets an attacker manufacture false positives for the cost of arithmetic.',
        formal: 'expected probes per manufactured false positive = 1/ε',
        detail: 'Every structure here assumes keys are independent of the hash, and an attacker who ' +
          'can compute the hash chooses keys that are not. Against a 1% filter it costs about 104 ' +
          'probes to find a key the filter accepts, and 50 of them took 5 179 candidates — a search ' +
          'that runs offline in milliseconds. Lowering ε does not fix it: halving the error doubles ' +
          'the attacker\'s work and doubles your memory, which is the wrong exchange rate. A ' +
          'per-process seed makes the whole precomputation worthless.',
        example: '50 manufactured false positives from 5 179 probes; 0 of them survive a different seed.'
      },
      {
        term: 'A guarantee that holds is not an answer you can act on',
        plain: 'A flooded count-min sketch is still within its bound, and still 400× wrong.',
        formal: 'ε·N grows with the flood, so the bound stretches to cover the damage',
        detail: 'Finding eight keys that collide with a victim in every row of a 32 × 3 sketch takes ' +
          '305 021 candidate probes, and pushing 5 000 events through each drives the victim\'s ' +
          'estimate from 100 to 40 100. Count-min has not been violated: N grew, so ε·N grew with ' +
          'it. The specification is intact and a rate limiter reading that number would ban a user ' +
          'who did nothing, which is the distinction between a proof about a structure and a claim ' +
          'about a system.',
        example: 'True count 100, estimate 40 100, and the ε·N bound was never exceeded.'
      },
      {
        term: 'Test the stated bound, not a tolerance',
        plain: 'Assert ε·N, 1.04/√m or α computed from the structure\'s own parameters.',
        formal: 'a hand-tuned tolerance outlives the reason it was chosen',
        detail: '"Within 15%" written into a test survives long after anyone remembers why 15%, and ' +
          'the next person to see it fail widens it. A bound computed from the sketch\'s parameters ' +
          'fails when the structure changes rather than when the measurement drifts, which is the ' +
          'behaviour a regression test is for. It also documents the guarantee in the one place ' +
          'somebody will definitely read, which is more than the comment above the constructor ' +
          'manages.',
        example: 'Assert est ≤ truth + (e/w)·N, not est ≤ truth × 1.15.'
      },
      {
        term: 'Six assertions every sketch\'s test suite needs',
        plain: 'No false negatives; the stated bound; the error direction; the merge; adversarial input; behaviour past the sizing.',
        formal: 'each one catches a specific class of change',
        detail: 'No false negatives catches a filter that lost a key during a resize. The stated ' +
          'bound catches a quietly widened tolerance. The direction, checked key by key, catches a ' +
          'switch from count-min to count-sketch made for accuracy. Merge equality catches a merge ' +
          'that drops a shard, which would still look plausible. An adversarial key set catches ' +
          'correlated hash rows. And running past the sized n catches every assumption that was ' +
          'never written down — which is most of them.',
        example: 'Merge equality is the one that would otherwise pass: a dropped shard still estimates plausibly.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));

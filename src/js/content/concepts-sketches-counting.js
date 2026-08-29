/** Concepts for the counting and quantile sections (M07.4-M07.6). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    hyperloglog: [
      {
        term: 'Leading zeros as a counter',
        plain: 'A hash with ρ leading zeros turns up about once in every 2^ρ distinct values.',
        formal: 'P[ρ(h(x)) ≥ j] = 2^(−j+1) for a uniform hash',
        readAs: 'The chance a hash begins with j−1 zero bits is one in 2 to that power. Seeing a long run of ' +
          'leading zeros is therefore evidence that you have hashed many distinct things — which is the ' +
          'entire idea behind counting distinct items in a few kilobytes.',
        detail: 'The observation is that rare patterns are evidence of many draws. Seeing a hash that ' +
          'begins with fifteen zeros suggests roughly 2^15 distinct values have gone past, because ' +
          'that is how often such a hash appears. Used alone it is a terrible estimator — it is a ' +
          'single observation of a geometric variable, so it is off by a factor of two about as often ' +
          'as not — but it costs one small register and it is completely insensitive to duplicates, ' +
          'which is the property a distinct count needs.',
        example: 'The register histogram is a fixed shape that slides one step right per doubling.'
      },
      {
        term: 'Stochastic averaging',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["hash the item"] --> B["the first p bits choose<br/>one of m registers"]',
            '    B --> C["the rest give a leading-zero count"]',
            '    C --> D["that register keeps its maximum"]',
            '    D --> E["m independent estimates instead of one"]',
            '    E --> F["averaging them cuts the noise<br/>by the square root of m"]'
          ].join('\n'),
          caption: 'One leading-zero count is a wildly noisy estimator. Splitting the stream across many registers and averaging is what turns it into a usable one.'
        },
        plain: 'The first p bits of the hash choose one of m = 2^p registers; each keeps its own maximum.',
        formal: 'm independent estimators over n/m elements each',
        detail: 'Splitting the stream by the leading bits of the hash turns one high-variance estimator ' +
          'into m of them, each watching its own share of the keys, and averaging cuts the variance by ' +
          '√m. The split is by hash rather than by arrival, so the same key always lands in the same ' +
          'register — which is exactly what makes the sketch insensitive to duplicates and what makes ' +
          'two sketches of overlapping streams mergeable. It also fixes the memory: m one-byte ' +
          'registers, whatever the answer turns out to be.',
        example: 'p = 12 gives 4 096 registers in 3 072 bytes packed at six bits each.'
      },
      {
        term: 'The harmonic mean, not the arithmetic one',
        plain: 'Average the 2^M[j] harmonically, so one overlarge register cannot dominate.',
        formal: 'E = α_m · m² / Σ_j 2^(−M[j])',
        readAs: 'The estimate is a correction constant times the number of registers squared, divided by the ' +
          'total of 2 to the minus each register. That division is a harmonic mean, which is what stops ' +
          'one unlucky large register from dominating the answer.',
        detail: 'Register values are maxima of geometric variables, so their distribution has a long ' +
          'right tail: one register that happens to see a hash with twenty leading zeros would drag ' +
          'an arithmetic mean of 2^M far above the truth. The harmonic mean is dominated by the ' +
          '*small* values instead, which are the well-behaved ones, and that single change is what ' +
          'takes LogLog\'s 1.30/√m to HyperLogLog\'s 1.04/√m. The α_m constant removes the remaining ' +
          'multiplicative bias.',
        example: 'α_m = 0.7213/(1 + 1.079/m), which is 0.7213 for any practical m.'
      },
      {
        term: 'Error that does not depend on the answer',
        plain: 'The standard error is 1.04/√m whether the count is a thousand or a trillion.',
        formal: 'σ = 1.04/√m, and memory = m registers',
        readAs: 'The relative error is about 1.04 divided by the square root of the register count. ' +
          'Quadrupling the memory halves the error — the usual square-root law, and the reason 16 KB ' +
          'gets you around 1%.',
        detail: 'This is the property that makes the structure usable: the cost model has no ' +
          'cardinality in it at all. Halving the error costs four times the memory and nothing else ' +
          'changes — p = 10 gives 3.25% from 768 bytes, p = 12 gives 1.63% from 3 072 and p = 14 ' +
          'gives 0.81% from 12 288. A sketch sized once is correct for every stream it will ever see, ' +
          'which is the opposite of a Bloom filter, whose whole difficulty is that its sizing needs a ' +
          'number nobody knows.',
        example: 'p = 8 measured −2.30%, p = 14 measured +0.19%, on the same 21 619-key stream.'
      },
      {
        term: 'Merging is exact, not approximate',
        plain: 'Register-wise maximum gives precisely the sketch the union would have produced.',
        formal: 'merge(A, B)[j] = max(A[j], B[j]) = sketch(A ∪ B)[j]',
        readAs: 'Merging two sketches is taking the larger value in each register, and the result is exactly ' +
          'the sketch you would have built from both streams together. Not an approximation of the ' +
          'merge — the merge itself.',
        detail: 'A register holds a maximum, and the maximum of two maxima is the maximum over the ' +
          'union — so the merged register array is identical, entry for entry, to the array the ' +
          'concatenated stream would have built. That is an equality and not a tolerance, which is ' +
          'why the test for it should assert register equality rather than closeness: a merge that ' +
          'silently dropped a shard would still produce a plausible-looking estimate, and only the ' +
          'exact comparison catches it.',
        example: 'Four shards merged: registers identical to the whole-stream sketch, for every seed.'
      },
      {
        term: 'Adding estimates is not merging',
        plain: 'Summing per-shard counts double-counts every key that appears in more than one shard.',
        formal: 'Σ|S_i| ≠ |∪S_i| unless the shards are disjoint',
        readAs: 'Adding up the distinct counts of each shard does not give the distinct count of the whole, ' +
          'because anything appearing in two shards is counted twice. Merging the sketches does give ' +
          'it.',
        detail: 'This is the mistake the mergeability property exists to prevent and it is made ' +
          'constantly, because the per-shard numbers are the ones a dashboard already has. On a ' +
          'stream split four ways, the four estimates sum to 36 702 against a true distinct count of ' +
          '21 619 — a 70% over-count — and every one of the four is individually accurate to a ' +
          'fraction of a per cent. The error is not in the sketches; it is in the arithmetic applied ' +
          'to them afterwards.',
        example: 'Four shards: 36 702 by addition, 21 607 by merging, 21 619 exactly.'
      },
      {
        term: 'Sparse and dense representations',
        plain: 'Keep a map of (index, ρ) pairs while the set is small; switch to a byte per register when it is not.',
        formal: 'HLL++ promotes when the sparse form stops being the cheaper one',
        detail: 'A sketch that has seen 500 keys has 3 600 of its 4 096 registers still at zero, and ' +
          'storing them costs 3 072 bytes to say nothing. The sparse form keeps only the non-zero ' +
          'entries and is therefore both smaller *and* more accurate at low cardinality, because it ' +
          'is effectively counting distinct indices rather than estimating. The promotion is ' +
          'one-way and invisible from outside: the same `estimate()` answers throughout, which is ' +
          'what makes it safe to do at all.',
        example: 'At 500 keys the sketch is sparse, 472 entries, and estimates 501.'
      },
      {
        term: 'The corrections, and the band neither of them fixes',
        plain: 'Linear counting rescues small cardinalities; between 2.5m and 4m both rules read a few per cent high.',
        formal: 'if zeros > 0 and E ≤ 2.5m: E = m · ln(m/zeros)',
        readAs: 'At small cardinalities the main estimator is biased, so switch to counting empty registers ' +
          'instead: the number of registers times the natural log of the fraction still empty. It is ' +
          'the same argument as the coupon collector.',
        detail: 'Below the register count the raw harmonic estimator is not merely inaccurate but ' +
          'useless — 1 388% high at n = 0.05m — because almost every register is still zero and the ' +
          'sum it divides by is dominated by them. Counting the zero registers instead is exact ' +
          'enough to bring that to −1.00%. The awkward region is just above: at n = 2.5m both rules ' +
          'read 4.99% high, which is three standard deviations, and closing it is precisely what ' +
          'HLL++\'s empirical bias tables are for.',
        example: 'At n = 0.05m: raw +1 388%, corrected −1.00%. At n = 2.5m: both +4.99%.'
      }
    ],

    'count-min-sketch': [
      {
        term: 'A d×w matrix and one cell per row',
        plain: 'Increment one cell in each of d rows; query reads those d cells and takes the smallest.',
        formal: 'est(x) = min_i C[i][h_i(x)]',
        readAs: 'Look up the key in every row and take the smallest count you find. Every row over-counts ' +
          'because of collisions, so the smallest is the closest to the truth.',
        detail: 'Every cell holds the true count of the keys that hash to it, so each of the d cells a ' +
          'key touches is its true count plus contamination from other keys. Taking the minimum picks ' +
          'the least contaminated of d estimates, and because contamination is never negative, the ' +
          'answer can only be too high. The structure has no keys in it at all — which is what bounds ' +
          'the memory, and also why it cannot enumerate anything.',
        example: 'w = 512, d = 5 is 20 480 bytes and answers for any number of distinct keys.'
      },
      {
        term: 'One-sided error is the design decision',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["every counter a key touches<br/>may also be touched by others"] --> B["so every count is<br/>at least the true count"]',
            '    B --> C["count-min never under-counts"]',
            '    C --> D["safe: is this below a threshold?<br/>a no is trustworthy"]',
            '    C --> E["unsafe: is this above a threshold?<br/>a yes may be collisions"]'
          ].join('\n'),
          caption: 'Knowing which direction the error can go tells you which questions the sketch may be asked. The same number is trustworthy for one and misleading for the other.'
        },
        plain: 'Count-min never under-counts. That makes it safe for some uses and unsafe for others.',
        formal: 'est(x) ≥ f(x) always; est(x) ≤ f(x) + εN with probability 1 − δ',
        readAs: 'The estimate is never below the real frequency — collisions can only add — and with ' +
          'probability 1 − δ it is no more than εN above it, where N is the total stream length. ' +
          'Overcounting is guaranteed; undercounting is impossible.',
        detail: 'Knowing the direction of the error is worth more than knowing its size. An estimate ' +
          'that is never low is safe wherever over-counting is conservative — rate limiting, load ' +
          'shedding, alerting — and unsafe wherever the number turns into money or a quota, because ' +
          'the customer is charged for traffic that did not happen. Count-sketch has a lower mean ' +
          'error and gives this up entirely: on the same stream it under-counts 10 727 of 21 619 ' +
          'keys, which is not a defect and is a completely different contract.',
        example: '0 keys under-counted by count-min; 10 727 of 21 619 by count-sketch.'
      },
      {
        term: 'ε and δ, and what each buys',
        plain: 'Width sets how wrong; depth sets how often.',
        formal: 'w = ⌈e/ε⌉, d = ⌈ln(1/δ)⌉, error ≤ εN with probability 1 − δ',
        readAs: 'The table is e (2.718…) divided by your error tolerance wide, and the natural log of one ' +
          'over your failure probability deep. Width buys accuracy, depth buys confidence, and they are ' +
          'independent dials.',
        detail: 'The two parameters are independent and they are bought in different currencies. Width ' +
          'is linear in memory and linear in accuracy: doubling w halves the additive error. Depth is ' +
          'linear in memory and *logarithmic* in the failure probability, so going from d = 5 to ' +
          'd = 10 takes δ from 0.7% to 0.005% for twice the memory. A sketch with a large d and a ' +
          'small w is a common mistake: it is very confident about a bound that is far too wide to ' +
          'be useful.',
        example: 'ε = 0.001, δ = 0.01 gives w = 2 719, d = 5 — 13 595 cells.'
      },
      {
        term: 'The bound is additive, so it hurts the small keys',
        plain: 'ε·N is the same number for a key seen ten times and one seen a hundred thousand times.',
        formal: 'absolute error ≤ εN, so relative error ≤ εN / f(x)',
        readAs: 'The error is a fixed slice of the whole stream, not a fraction of the item\'s own count. For ' +
          'a heavy hitter that is tiny; for a rare item it can be larger than the true count, which is ' +
          'why the sketch answers about heavy hitters and nothing else.',
        detail: 'At w = 512 over a 200 000-item stream the bound is 1 062, which is a rounding error ' +
          'for the heaviest key and a hundredfold over-count for a key seen ten times. This is why a ' +
          'count-min sketch is a heavy-hitter structure rather than a frequency table: the estimates ' +
          'it gives for the head of the distribution are excellent and the ones for the tail are ' +
          'meaningless, and a scatter of estimate against truth on a log axis shows the cloud fanning ' +
          'out to the left.',
        example: 'Bound 1 062 over a 200 000-item stream: 1.5% of the top key, 100× a rare one.'
      },
      {
        term: 'Conservative update',
        plain: 'On an increment, raise only the cells that are currently at the minimum.',
        formal: 'C[i][h_i(x)] ← max(C[i][h_i(x)], min_j C[j][h_j(x)] + c)',
        readAs: 'Conservative update: work out what the estimate would become, then raise each counter only ' +
          'as far as that. Counters that were already higher are left alone, so less error is injected ' +
          '— at the cost of no longer being able to delete.',
        detail: 'A cell that is already above the key\'s current estimate is above it because of some ' +
          'other key, and raising it further only pollutes that other key\'s answer. Skipping those ' +
          'writes cannot break the never-under guarantee — every cell is still at least the true ' +
          'count of what hashed into it — and it measurably tightens the whole distribution: mean ' +
          'absolute error falls from 97.9 to 54.2 and the worst from 363 to 261 on the same stream ' +
          'and matrix. The cost is that conservative sketches no longer merge by addition.',
        example: 'Mean absolute error 97.9 → 54.2, at identical w, d and stream.'
      },
      {
        term: 'Count-sketch: signs instead of a minimum',
        plain: 'Multiply each update by a ±1 hash and take the median at query time.',
        formal: 'est(x) = median_i s_i(x) · C[i][h_i(x)]',
        readAs: 'Each row is multiplied by a random ±1 sign before being read, so collisions cancel instead ' +
          'of accumulating, and the median across rows discards the rows that went badly. That is what ' +
          'lets the count-sketch estimate be too low as well as too high.',
        detail: 'With a sign attached, a colliding key adds to a cell as often as it subtracts, so ' +
          'collisions cancel in expectation rather than accumulating. The estimator is unbiased and ' +
          'its error is bounded relative to ‖f‖₂ rather than ‖f‖₁, which is much tighter on a ' +
          'heavy-tailed stream — mean absolute error 32.1 against count-min\'s 97.9 at the same size. ' +
          'The depth must be odd: a median over an even count averages the two middle rows, mixing a ' +
          'good row with a bad one instead of choosing between them.',
        example: 'Mean absolute error 32.1 against 97.9, and 10 727 keys read low.'
      },
      {
        term: 'The rows must be genuinely independent',
        plain: 'Deriving the d row hashes from two by a linear rule breaks the guarantee.',
        formal: 'h_i = finalise(h₁ + i·h₂ + i²), not h₁ + i·h₂',
        readAs: 'Double hashing needs a final mixing step, or the rows are linearly related and their errors ' +
          'stop being independent — at which point taking the minimum across rows buys you nothing.',
        detail: 'Two hashes are enough for a Bloom filter, whose error analysis does not need ' +
          'independence between probes. A count-min sketch does: the whole argument is that a key is ' +
          'unlucky in one row independently of the others. With the raw linear rule, two keys whose ' +
          'h₁ and h₂ both agree modulo w collide in *every* row at once, which happens about once per ' +
          'w² pairs — and on a 21 619-key stream that put count-sketch\'s worst error at 6 939 against ' +
          'a stated bound of 2 808. Avalanching each row\'s value first restores it.',
        example: 'Worst count-sketch error 6 939 → 879 after mixing each row value.'
      },
      {
        term: 'Heavy hitters need a heap as well',
        plain: 'The sketch can score a key you name; it cannot tell you which keys are heavy.',
        formal: 'top-k = a candidate set maintained alongside, not derived from the matrix',
        detail: 'There are no keys in the matrix, so there is nothing to enumerate. A heavy-hitter ' +
          'query needs a candidate structure kept beside the sketch — typically a heap of keys whose ' +
          'estimate crossed the threshold — and that structure\'s memory grows with the number of ' +
          'answers rather than staying fixed. Pretending the sketch does it alone is the usual ' +
          'overclaim, and it matters because space-saving solves the same problem in less memory ' +
          'with no hashing at all.',
        example: 'Count-min plus heap: 17 408 bytes. Space-saving alone: 16 000, for the same answer.'
      }
    ],

    'quantile-sketches': [
      {
        term: 'Averages lie about latency',
        plain: 'On a bimodal distribution the mean is neither the typical experience nor the bad one.',
        formal: 'mean 58 ms, median 21 ms, p99 739 ms on the same stream',
        detail: 'A latency distribution with a fast path and a slow path has a mean that sits in the ' +
          'gap between them, describing an experience nobody had. Worse, the mean moves when the ' +
          'slow mode\'s *share* changes and also when its *depth* changes, so it cannot distinguish ' +
          '"more requests are slow" from "the slow ones got slower". Quantiles separate those and ' +
          'they are what every SLO is written in, which is why a system that only records means ' +
          'cannot answer the question it is being asked.',
        example: 'The mean of 58 ms sits between a 21 ms median and a 739 ms p99.'
      },
      {
        term: 'Exact quantiles need the data sorted',
        plain: 'There is no streaming algorithm that gives an exact p99 in sublinear space.',
        formal: 'exact selection over an unordered stream needs Ω(n) space',
        readAs: 'You cannot report an exact quantile of a stream without keeping essentially all of it. That ' +
          'lower bound is why quantile sketches exist at all.',
        detail: 'The p99 of a stream cannot be maintained incrementally without keeping enough of the ' +
          'stream to identify it, and the adversary argument is the usual one: whatever you discard ' +
          'could have been the answer. Keeping 200 000 doubles is 1.6 MB per stream per window, ' +
          'which is affordable for one service and not for ten thousand of them at per-endpoint ' +
          'granularity. Every sketch here is a different way of deciding what to throw away.',
        example: '200 000 samples kept exactly is 1.6 MB; the sketches range from 944 to 8 000 bytes.'
      },
      {
        term: 'Reservoir sampling keeps a uniform sample',
        plain: 'Algorithm R: the i-th item replaces a random resident with probability k/i.',
        formal: 'every item is in the sample with probability k/n, at every point',
        readAs: 'Reservoir sampling keeps every item equally likely to be in the sample, at every moment, ' +
          'without ever knowing how long the stream will be.',
        detail: 'The invariant is stronger than "uniform at the end": after any number of items the ' +
          'sample is a uniform draw without replacement from everything seen so far, which is what ' +
          'makes it safe to query a reservoir at any moment. It is the most general of the four — the ' +
          'sample answers any question about the distribution, not only quantiles — and the weakest ' +
          'in the tail, because a k-item sample holds only k·(1 − p) observations past the p-th ' +
          'quantile and at p99.9 with k = 1 000 that is one.',
        example: 'p99.9 from 1 000 samples is one observation, and reads 38.8% low.'
      },
      {
        term: 't-digest sizes centroids by a scale function',
        plain: 'Centroids may be large in the middle and must be small at both tails.',
        formal: 'k(q) = δ/2π · asin(2q − 1), and a centroid may absorb while Δk ≤ 1',
        readAs: 'The scale function stretches the ends of the distribution and squashes the middle, so ' +
          'centroids near the extremes stay small. A centroid may absorb another only while the change ' +
          'in scale stays under one, which is what keeps the tails accurate.',
        detail: 'The scale function is flat near q = 0.5 and steep as q approaches 0 or 1, so the ' +
          'merging rule allows a centroid to swallow thousands of points in the middle and only a ' +
          'handful at the edges. That puts the resolution where the interesting quantiles are: with ' +
          'δ = 100 the whole digest is about 60 centroids and 944 bytes, and its rank error at p99.9 ' +
          'is 0.013 percentage points — better than the reservoir at eight times the memory. There is ' +
          'no formal bound; the argument for it is empirical and the demo is the evidence.',
        example: '60 centroids, 944 bytes, rank error 0.013 pp at p99.9.'
      },
      {
        term: 'KLL compactors',
        plain: 'Level h holds items of weight 2^h; a full level is sorted and every second item is promoted.',
        formal: 'capacity grows geometrically up the stack, so the sketch is O(k) items',
        detail: 'Compacting a sorted buffer by taking alternate items halves the data and doubles the ' +
          'weight, which is exact in expectation and wrong by at most one item\'s worth of rank per ' +
          'compaction. The coin that decides odd or even is what keeps it unbiased — always keeping ' +
          'the same parity biases every quantile in one direction, and the error accumulates instead ' +
          'of cancelling. KLL is the family with a proven rank-error bound, which is what separates ' +
          'it from t-digest in a specification even where t-digest measures better.',
        example: '2 152 bytes and a worst rank error of 0.489 percentage points across four quantiles.'
      },
      {
        term: 'DDSketch bounds the value, not the rank',
        plain: 'Logarithmic buckets: bucket i covers [γ^i, γ^(i+1)) for γ = (1+α)/(1−α).',
        formal: '|v̂ − v| ≤ α·v, for every quantile, always',
        readAs: 'The estimate is within a fixed fraction of the true value — a relative guarantee rather than ' +
          'an absolute one, which is what latency work needs, because being 1 ms out matters at p50 and ' +
          'not at p99.9.',
        detail: 'Every value in a bucket is within a relative α of the bucket\'s representative, so ' +
          'the returned value is within α of *some* value at the requested rank — a guarantee about ' +
          'milliseconds rather than about position. That is the form an SLO is written in, and it is ' +
          'the reason DDSketch is 0.53% out at worst across p50 to p99.9 on a stream where t-digest ' +
          'is 23.55% out at p90. The cost is memory proportional to the number of decades the data ' +
          'spans, which is fine for latency and wrong for something unbounded.',
        example: 'α = 1%: worst value error 0.53% across p50, p90, p99 and p99.9.'
      },
      {
        term: 'Rank error and value error are different claims',
        plain: 'A tiny rank error lands a long way away in value wherever the distribution is steep.',
        formal: 'Δvalue ≈ Δrank / density at that quantile',
        readAs: 'An error in rank turns into an error in value by dividing by how tightly packed the data is ' +
          'there — the Δ is "an error in". Where points are sparse, being a few ranks out moves the ' +
          'reported value a long way.',
        detail: 'On a bimodal stream the quantile function is nearly vertical between the modes, so a ' +
          'sketch that is 0.267 percentage points out in rank at p90 is 23.55% out in milliseconds — ' +
          'and both numbers describe the same answer. Reporting only one of them makes three of the ' +
          'four sketches look either flawless or broken. Which one matters is decided by the question: ' +
          '"the 90th percentile request" is a rank and "under 250 ms" is a value.',
        example: 't-digest at p90: 0.267 pp of rank, 23.55% of value, one answer.'
      },
      {
        term: 'Averaging quantiles across shards is meaningless',
        plain: 'The mean of per-shard p99s is not an estimate of the global p99.',
        formal: 'quantile(∪ S_i) ≠ mean_i quantile(S_i)',
        readAs: 'Averaging the p99s of several shards does not give the p99 of the whole. It is a genuinely ' +
          'wrong operation, and it is the most common mistake in latency dashboards.',
        detail: 'It is not a worse estimate; it is an estimate of nothing. When the shards are ' +
          'statistically identical the two numbers happen to be close and the dashboard looks ' +
          'correct, which is why the mistake survives. The moment one shard is degraded — the only ' +
          'case anybody cares about — the average reads 17.4% *below* the true global p99, because ' +
          'seven healthy shards outvote the one that is failing. Merging the sketches and querying ' +
          'once lands within 0.95%.',
        example: 'Eight shards, one degraded: averaged 644.7 ms, merged 772.9, true 780.4.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));

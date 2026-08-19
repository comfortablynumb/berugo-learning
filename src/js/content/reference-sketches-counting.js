/** Reference entries for the counting and quantile sections (M07.4-M07.6). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    hyperloglog: {
      summary: 'Distinct-count estimation from the longest run of leading zeros per register, with a ' +
        'standard error of 1.04/√m that does not depend on the cardinality, and a merge that is exact.',
      intuition: 'Rare hash patterns are evidence of many draws. One register would be far too noisy, ' +
        'so the leading bits of the hash split the stream over m registers and their 2^M values are ' +
        'averaged harmonically.',
      formulation: {
        equations: [
          {
            label: 'Estimator',
            expr: 'E = α_m · m² / Σ_j 2^(−M[j]),  α_m = 0.7213 / (1 + 1.079/m)',
            terms: [
              { sym: 'harmonic', meaning: 'the arithmetic mean would be dominated by one large register' }
            ]
          },
          {
            label: 'Error',
            expr: 'σ = 1.04/√m, independent of the cardinality',
            terms: [
              { sym: 'measured', meaning: 'p = 12 claims 1.63% and delivered +0.21% on 21 619 keys' },
              { sym: 'cost', meaning: 'memory quadruples for each halving of σ' }
            ]
          },
          {
            label: 'Small-range correction',
            expr: 'if zeros > 0 and E ≤ 2.5m: E = m · ln(m / zeros)',
            terms: [
              { sym: 'measured', meaning: 'at n = 0.05m the raw estimator is +1 388%, corrected −1.00%' },
              { sym: 'gap', meaning: 'between 2.5m and 4m both rules read 2.5-5.0% high' }
            ]
          },
          {
            label: 'Merge',
            expr: 'merge(A, B)[j] = max(A[j], B[j]) = sketch(A ∪ B)[j]',
            terms: [
              { sym: 'exact', meaning: 'an equality, so the test for it is an equality' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'A register only ever increases',
          why: 'It holds a maximum, which is what makes the merge a maximum and duplicates free.',
          breaks: 'Any decrement makes the sketch order-dependent and the merge wrong.'
        },
        {
          name: 'The same key always lands in the same register',
          why: 'Insensitivity to duplicates comes from this, not from any deduplication step.',
          breaks: 'A per-insert seed turns the distinct count into a count of insertions.'
        },
        {
          name: 'Merged registers equal the whole-stream registers exactly',
          why: 'Mergeability is an exact property; a tolerance would pass a merge that lost a shard.',
          breaks: 'A missing shard still yields a plausible estimate, so nothing else catches it.'
        },
        {
          name: 'Sketches merge only at equal precision',
          why: 'Register j means a different slice of the hash space at a different p.',
          breaks: 'Merging different precisions silently produces an unrelated count.'
        }
      ],
      complexity: [
        { operation: 'add', average: 'Θ(1)', worst: 'Θ(1)', note: 'one hash, one compare-and-set' },
        { operation: 'estimate', average: 'Θ(m)', worst: 'Θ(m)', note: 'a pass over the registers' },
        { operation: 'merge', average: 'Θ(m)', worst: 'Θ(m)', note: 'register-wise maximum, exact' },
        { operation: 'space, dense', average: 'Θ(m)', worst: 'Θ(m)', note: '3 072 bytes at p = 12, packed to 6 bits' },
        { operation: 'space, sparse', average: 'Θ(distinct)', worst: 'Θ(m)', note: '4 bytes per non-zero register' },
        { operation: 'error', average: '1.04/√m', worst: '1.04/√m', note: 'no cardinality term at all' }
      ],
      failureModes: [
        {
          symptom: 'The fleet-wide distinct count is far higher than any plausible truth.',
          cause: 'Per-shard estimates were added instead of the sketches being merged.',
          fix: 'Ship the register arrays, merge them, then estimate once — 36 702 becomes 21 607.'
        },
        {
          symptom: 'Small counts are wildly overestimated.',
          cause: 'The raw harmonic estimator is being used below about 2.5m, where it is useless.',
          fix: 'Apply linear counting while any register is zero; +1 388% becomes −1.00%.'
        },
        {
          symptom: 'The estimate is a few per cent high in a specific cardinality band.',
          cause: 'Between 2.5m and 4m neither the raw estimator nor linear counting is accurate.',
          fix: 'Use HLL++\'s empirical bias tables, or raise p so the band sits below your range.'
        },
        {
          symptom: 'A sketch reports the number of insertions rather than distinct keys.',
          cause: 'The hash is being seeded or salted per call, so repeats land in different registers.',
          fix: 'Fix the seed for the lifetime of the sketch, and version it with the data.'
        },
        {
          symptom: 'Two sketches will not combine.',
          cause: 'Different precisions, or one in sparse and one in dense form with no promotion.',
          fix: 'Pin p at deployment; promote both to dense before merging.'
        }
      ],
      inTheWild: [
        { system: 'Redis PFADD / PFCOUNT / PFMERGE', how: 'HLL++ with sparse and dense encodings, 12 KB per key at p = 14' },
        { system: 'BigQuery, Presto, Spark approx_count_distinct', how: 'per-partition sketches merged at the shuffle, which is why it parallelises' },
        { system: 'Druid and ClickHouse', how: 'HLL columns stored per segment, merged at query time with no re-scan' },
        { system: 'Web analytics unique-visitor counts', how: 'one sketch per dimension per hour, rolled up by merging' }
      ],
      sources: [
        { title: 'Flajolet, Fusy, Gandouet, Meunier — HyperLogLog: the analysis of a near-optimal cardinality estimation algorithm (2007)', where: 'the harmonic mean, α_m and the 1.04/√m bound' },
        { title: 'Heule, Nunkesser, Hall — HyperLogLog in practice (EDBT 2013)', where: 'sparse representation, 64-bit hashes and the empirical bias tables' },
        { title: 'Durand, Flajolet — Loglog counting of large cardinalities (ESA 2003)', where: 'the predecessor, at 1.30/√m' },
        { title: 'Whang, Vander-Zanden, Taylor — A linear-time probabilistic counting algorithm (1990)', where: 'the linear counting used as the small-range correction' }
      ]
    },

    'count-min-sketch': {
      summary: 'A d×w counter matrix answering per-key frequency in space independent of the key ' +
        'count, with an error that is additive, one-sided, and bounded by ε·N with probability 1 − δ.',
      intuition: 'Each of d rows gives an over-estimate contaminated by whatever else hashed into the ' +
        'same cell; taking the minimum picks the least contaminated of them.',
      formulation: {
        equations: [
          {
            label: 'Sizing',
            expr: 'w = ⌈e/ε⌉, d = ⌈ln(1/δ)⌉',
            terms: [
              { sym: 'measured', meaning: 'ε = 0.001, δ = 0.01 gives 2 719 × 5 = 13 595 cells' }
            ]
          },
          {
            label: 'Guarantee',
            expr: 'f(x) ≤ est(x) ≤ f(x) + εN, the right half with probability 1 − δ',
            terms: [
              { sym: 'left half', meaning: 'absolute — 0 of 21 619 keys under-counted' },
              { sym: 'measured', meaning: 'bound 1 062, worst over-count 363' }
            ]
          },
          {
            label: 'Conservative update',
            expr: 'C[i][h_i(x)] ← max(C[i][h_i(x)], min_j C[j][h_j(x)] + c)',
            terms: [
              { sym: 'measured', meaning: 'mean absolute error 97.9 → 54.2, worst 363 → 261' }
            ]
          },
          {
            label: 'Count-sketch',
            expr: 'est(x) = median_i s_i(x)·C[i][h_i(x)], error relative to ‖f‖₂',
            terms: [
              { sym: 'measured', meaning: 'mean absolute error 32.1, and 10 727 keys read low' },
              { sym: 'depth', meaning: 'must be odd, or the median averages a good row with a bad one' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The estimate is never below the true count',
          why: 'Every cell holds the true count plus a non-negative contamination.',
          breaks: 'A signed update or a decrement makes the sketch two-sided, which changes its contract.'
        },
        {
          name: 'The d row hashes are independent',
          why: 'The bound assumes a key is unlucky in one row independently of the others.',
          breaks: 'Linear double-hashing collides in all rows at once; measured 6 939 against a 2 808 bound.'
        },
        {
          name: 'Count-sketch depth is odd',
          why: 'A median over an even count averages the two middle rows instead of choosing.',
          breaks: 'The tail widens measurably, because one bad row contaminates the answer.'
        },
        {
          name: 'Heavy hitters come from a candidate set, not from the matrix',
          why: 'The matrix contains no keys, so it can score a key but never produce one.',
          breaks: 'Claiming top-k from the sketch alone hides the structure whose memory grows.'
        }
      ],
      complexity: [
        { operation: 'add', average: 'Θ(d)', worst: 'Θ(d)', note: 'one cell per row' },
        { operation: 'estimate', average: 'Θ(d)', worst: 'Θ(d)', note: 'minimum of d cells' },
        { operation: 'conservative add', average: 'Θ(d)', worst: 'Θ(d)', note: 'a read pass before the write pass' },
        { operation: 'merge', average: 'Θ(dw)', worst: 'Θ(dw)', note: 'cell-wise addition — not valid for conservative sketches' },
        { operation: 'heavy hitters', average: 'Θ(candidates·d)', worst: 'Θ(candidates·d)', note: 'the candidate set is separate memory' },
        { operation: 'space', average: 'Θ(dw)', worst: 'Θ(dw)', note: '20 480 bytes at 512 × 5' }
      ],
      failureModes: [
        {
          symptom: 'Customers are billed for traffic they did not send.',
          cause: 'A one-sided over-estimating sketch was used where the number becomes money.',
          fix: 'Use exact counting for anything billable; count-min is for shedding, not charging.'
        },
        {
          symptom: 'Rare keys report counts a hundred times their true value.',
          cause: 'The bound is additive — ε·N is 1 062 whether the key was seen once or 27 954 times.',
          fix: 'Trust estimates only well above ε·N; treat the sketch as a heavy-hitter structure.'
        },
        {
          symptom: 'Switching to count-sketch for accuracy broke a downstream guard.',
          cause: 'Count-sketch is unbiased, so it under-counts about half the keys — 10 727 of 21 619.',
          fix: 'Decide the error direction first; "more accurate" is a different property from "safe".'
        },
        {
          symptom: 'Measured errors exceed the stated bound on a real key set.',
          cause: 'The row hashes are derived linearly from two hashes, so the rows are not independent.',
          fix: 'Avalanche each row\'s combined value before the modulo — worst error 6 939 → 879.'
        },
        {
          symptom: 'A merged sketch reports counts far above the sum of the inputs.',
          cause: 'Conservative sketches were merged by addition, which double-counts the skipped writes.',
          fix: 'Merge plain sketches only; a conservative sketch cannot be reconstructed by addition.'
        }
      ],
      inTheWild: [
        { system: 'CDN and API rate limiters', how: 'per-client request counts where an over-estimate sheds load conservatively' },
        { system: 'Network telemetry (sFlow, IPFIX collectors)', how: 'per-flow byte counts at line rate, with heavy hitters kept in a heap' },
        { system: 'Caffeine and other cache admission policies', how: 'count-min with conservative update and periodic halving, as the TinyLFU frequency filter' },
        { system: 'Search query logs', how: 'trending-term detection, where the head of the distribution is the whole answer' }
      ],
      sources: [
        { title: 'Cormode, Muthukrishnan — An improved data stream summary: the count-min sketch (2005)', where: 'the construction, the bound and the dot-product and range extensions' },
        { title: 'Charikar, Chen, Farach-Colton — Finding frequent items in data streams (ICALP 2002)', where: 'count-sketch, the signed variant with an L2 bound' },
        { title: 'Estan, Varghese — New directions in traffic measurement and accounting (SIGCOMM 2002)', where: 'conservative update, introduced as "conservative update" for traffic counters' },
        { title: 'Einziger, Friedman — TinyLFU: a highly efficient cache admission policy (2014)', where: 'the sketch as a cache policy, with ageing' }
      ]
    },

    'quantile-sketches': {
      summary: 'Four ways to answer "what is p99" without keeping the stream, differing in whether the ' +
        'guarantee is on the rank or on the value, and in whether there is a guarantee at all.',
      intuition: 'Exact quantiles need the data sorted, so every sketch here is a rule for what to ' +
        'throw away — a uniform sample, coarse centroids in the middle, halved levels, or ' +
        'logarithmic buckets.',
      formulation: {
        equations: [
          {
            label: 'Reservoir (Algorithm R)',
            expr: 'the i-th item replaces a uniformly chosen resident with probability k/i',
            terms: [
              { sym: 'tail', meaning: 'k(1 − p) observations past the p-th quantile — one at p99.9, k = 1 000' }
            ]
          },
          {
            label: 't-digest scale function',
            expr: 'k(q) = δ/2π · asin(2q − 1); a centroid absorbs while Δk ≤ 1',
            terms: [
              { sym: 'measured', meaning: 'δ = 100 gives ~60 centroids in 944 bytes' },
              { sym: 'rank error', meaning: '0.013 pp at p99.9, 0.267 pp at p90' }
            ]
          },
          {
            label: 'KLL compaction',
            expr: 'sort a full level, promote alternate items at double weight, choose the parity by coin',
            terms: [
              { sym: 'why the coin', meaning: 'a fixed parity biases every quantile in one direction' }
            ]
          },
          {
            label: 'DDSketch',
            expr: 'bucket i covers [γ^i, γ^(i+1)) for γ = (1+α)/(1−α); |v̂ − v| ≤ α·v',
            terms: [
              { sym: 'measured', meaning: 'α = 1% delivered ≤ 0.53% at every quantile tested' },
              { sym: 'cost', meaning: 'buckets grow with the number of decades spanned, not with n' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'A reservoir is uniform at every point, not only at the end',
          why: 'It is what makes querying a live reservoir meaningful.',
          breaks: 'Replacing with the wrong probability biases the sample towards early or late items.'
        },
        {
          name: 'KLL chooses the promoted parity at random',
          why: 'Alternate-item compaction is exact in expectation only if the offset is unbiased.',
          breaks: 'A fixed parity makes every quantile drift in the same direction as levels accumulate.'
        },
        {
          name: 'DDSketch buckets are multiplicative, so the guarantee is relative',
          why: 'Every value in a bucket is within α of the representative, at any magnitude.',
          breaks: 'Linear buckets give an absolute guarantee, which is useless across four decades.'
        },
        {
          name: 'Quantiles are merged by merging sketches, never by averaging answers',
          why: 'A quantile of a mixture is not a mixture of quantiles.',
          breaks: 'Eight shards with one degraded: the average reads 17.4% below the true p99.'
        }
      ],
      complexity: [
        { operation: 'reservoir add', average: 'Θ(1)', worst: 'Θ(1)', note: 'one random draw' },
        { operation: 't-digest add', average: 'Θ(1) amortised', worst: 'Θ(buffer log buffer)', note: 'a sort per compression pass' },
        { operation: 'KLL add', average: 'Θ(1) amortised', worst: 'Θ(k log k)', note: 'a cascade of compactions' },
        { operation: 'DDSketch add', average: 'Θ(1)', worst: 'Θ(1)', note: 'one logarithm and one map update' },
        { operation: 'query', average: 'Θ(size)', worst: 'Θ(size)', note: 'a walk over centroids, items or buckets' },
        { operation: 'space', average: 'varies', worst: 'varies', note: '944 B t-digest, 2 152 KLL, 4 116 DDSketch, 8 000 reservoir' }
      ],
      failureModes: [
        {
          symptom: 'A fleet-wide p99 panel looks healthy during an incident.',
          cause: 'Per-shard p99s are being averaged; one bad shard is outvoted by seven good ones.',
          fix: 'Merge the sketches and query once — 644.65 ms becomes 772.92 against a truth of 780.37.'
        },
        {
          symptom: 'The p99.9 jumps around between reporting intervals.',
          cause: 'A reservoir is answering it from one or two sampled observations.',
          fix: 'Use a tail-aware sketch; a 1 000-item reservoir reads 38.8% low at p99.9.'
        },
        {
          symptom: 'The sketch is accurate by every internal check and wrong against the SLO.',
          cause: 'The guarantee is on rank and the SLO is written in milliseconds.',
          fix: 'Use DDSketch where the requirement is a value; 0.267 pp of rank was 23.55% of value.'
        },
        {
          symptom: 'A DDSketch grows without bound.',
          cause: 'The values span far more decades than expected — negative, zero or unbounded inputs.',
          fix: 'Clamp the range, collapse the lowest buckets, and handle zero explicitly.'
        },
        {
          symptom: 'An alert on the mean latency never fires during a partial outage.',
          cause: 'The mean of a bimodal distribution sits between the modes and moves slowly.',
          fix: 'Alert on a quantile; the mean here is 58 ms against a p99 of 739.'
        }
      ],
      inTheWild: [
        { system: 'Datadog, and the DDSketch that came out of it', how: 'relative-error quantiles per metric per interval, merged across hosts' },
        { system: 'Elasticsearch percentiles aggregation', how: 't-digest per shard, merged at the coordinating node' },
        { system: 'Apache DataSketches (KLL, REQ)', how: 'the formally bounded family, used where the guarantee has to be provable' },
        { system: 'Prometheus histograms', how: 'the fixed-bucket alternative, and the reason bucket choice is a permanent decision' }
      ],
      sources: [
        { title: 'Dunning, Ertl — Computing extremely accurate quantiles using t-digests (2019)', where: 'the scale functions and the merging digest' },
        { title: 'Karnin, Lang, Liberty — Optimal quantile approximation in streams (FOCS 2016)', where: 'KLL, and the compactor analysis' },
        { title: 'Masson, Rim, Lee — DDSketch: a fast and fully-mergeable quantile sketch with relative-error guarantees (VLDB 2019)', where: 'the relative-error formulation an SLO needs' },
        { title: 'Vitter — Random sampling with a reservoir (TOMS 1985)', where: 'Algorithm R, and the faster variants' },
        { title: 'Efraimidis, Spirakis — Weighted random sampling with a reservoir (2006)', where: 'the weighted variant used when the stream is pre-aggregated' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));

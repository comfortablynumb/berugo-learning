/** Reference entries for the similarity, window and selection sections (M07.7-M07.9). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'minhash-and-lsh': {
      summary: 'Signatures that estimate set similarity from a fixed number of hashes, and a banding ' +
        'scheme that turns the estimate into a sublinear search with a tunable precision/recall split.',
      intuition: 'Two sets share the minimum of a random hash exactly when the smallest element of ' +
        'their union lies in the intersection — so agreement between signatures *is* similarity, and ' +
        'requiring several positions to agree at once is a threshold.',
      formulation: {
        equations: [
          {
            label: 'The identity',
            expr: 'P[min h(A) = min h(B)] = |A ∩ B| / |A ∪ B|',
            terms: [
              { sym: 'error', meaning: '1/√L — 8.84% at L = 128, independent of document size' }
            ]
          },
          {
            label: 'Banding',
            expr: 'P[candidate] = 1 − (1 − s^r)^b, steepest near (1/b)^(1/r)',
            terms: [
              { sym: 'measured', meaning: '16 × 8 turns at 0.707; 32 × 4 turns at 0.420' },
              { sym: 'consequence', meaning: '3 candidate pairs of 1 770 against 22, from the same signature' }
            ]
          },
          {
            label: 'SimHash',
            expr: 'P[bit differs] = θ/π, so cos θ ≈ cos(π · hamming / bits)',
            terms: [
              { sym: 'cost', meaning: '8 bytes per document at 64 bits, against 512 for L = 128' }
            ]
          },
          {
            label: 'Johnson-Lindenstrauss',
            expr: 'k ≥ 8 ln n / ε² preserves every pairwise distance within 1 ± ε',
            terms: [
              { sym: 'measured', meaning: '60 points at ε = 0.3 asks for 364 dimensions; 64 delivered 29.95%' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The L hashes are independent',
          why: 'Each signature position is a separate Bernoulli trial for the same probability.',
          breaks: 'Correlated hashes make the estimate biased and the standard error a fiction.'
        },
        {
          name: 'Both documents are shingled the same way',
          why: 'The estimate is of set similarity, and the shingling defines the sets.',
          breaks: 'Different widths make two documents look unrelated whatever the text says.'
        },
        {
          name: 'Every candidate pair is verified exactly',
          why: 'The index is a filter; its precision is deliberately below 1.',
          breaks: 'Reporting candidates as duplicates ships whatever false-positive rate b and r chose.'
        },
        {
          name: 'b × r equals the signature length',
          why: 'Bands partition the signature; overlapping or leftover rows change the curve.',
          breaks: 'The measured threshold no longer matches (1/b)^(1/r) and tuning stops being predictable.'
        }
      ],
      complexity: [
        { operation: 'signature', average: 'Θ(L·|set|)', worst: 'Θ(L·|set|)', note: 'one pass per token per hash' },
        { operation: 'estimate a pair', average: 'Θ(L)', worst: 'Θ(L)', note: 'count agreeing positions' },
        { operation: 'index a document', average: 'Θ(L)', worst: 'Θ(L)', note: 'b band hashes, b bucket inserts' },
        { operation: 'candidates for a query', average: 'Θ(b + answers)', worst: 'Θ(b·n)', note: '22 of 1 770 pairs on the demo corpus' },
        { operation: 'SimHash', average: 'Θ(bits·|set|)', worst: 'Θ(bits·|set|)', note: '8 bytes per document at 64 bits' },
        { operation: 'projection', average: 'Θ(d·k)', worst: 'Θ(d·k)', note: 'k from the JL bound, or from measurement' }
      ],
      failureModes: [
        {
          symptom: 'The near-duplicate finder misses obvious duplicates.',
          cause: 'Too few bands, so the S-curve turns above the similarity you call a duplicate.',
          fix: 'Lower (1/b)^(1/r) below the threshold — 8 × 16 finds nothing where 32 × 4 finds everything.'
        },
        {
          symptom: 'The verification stage is the bottleneck.',
          cause: 'Too many bands: the index proposes far more candidates than there are duplicates.',
          fix: 'Raise the curve threshold, or verify more cheaply; 32 × 4 was 50% precision here.'
        },
        {
          symptom: 'A threshold tuned for MinHash behaves differently under SimHash.',
          cause: 'They estimate different quantities — overlap against angle — in different units.',
          fix: 'Re-tune against the corpus; a Hamming cutoff is not a similarity.'
        },
        {
          symptom: 'Similarity scores are systematically too high for short documents.',
          cause: 'The shingle width is close to the document length, so almost everything shares shingles.',
          fix: 'Choose the shingle width against the shortest documents you actually index.'
        },
        {
          symptom: 'A random projection distorts a few distances badly.',
          cause: 'Fewer dimensions than the JL bound asks for; the guarantee is over *every* pair.',
          fix: 'Measure the worst distortion rather than trusting the mean — 6.68% mean against 29.95% worst.'
        }
      ],
      inTheWild: [
        { system: 'AltaVista and later web crawlers', how: 'MinHash over shingles for near-duplicate page detection, the original application' },
        { system: 'Google\'s crawl deduplication', how: 'SimHash over 64 bits, chosen for the per-document memory at web scale' },
        { system: 'Plagiarism and licence-scanning tools', how: 'banded MinHash with an exact verification pass on every candidate' },
        { system: 'Approximate nearest-neighbour libraries (FAISS, Annoy)', how: 'random projections and LSH as the first stage before exact reranking' }
      ],
      sources: [
        { title: 'Broder — On the resemblance and containment of documents (1997)', where: 'the min-hash identity and shingling' },
        { title: 'Leskovec, Rajaraman, Ullman — Mining of Massive Datasets, chapter 3', where: 'banding, the S-curve and how to choose b and r' },
        { title: 'Charikar — Similarity estimation techniques from rounding algorithms (STOC 2002)', where: 'SimHash and the angle estimate' },
        { title: 'Johnson, Lindenstrauss — Extensions of Lipschitz mappings into a Hilbert space (1984)', where: 'the dimension bound, and its generous constant' }
      ]
    },

    'windowed-counting': {
      summary: 'Counting over a sliding window and over decayed time, where exactness is provably ' +
        'impossible in sublinear space, plus the bounded-counter structures that answer "which keys ' +
        'are hot".',
      intuition: 'The window has to forget, and forgetting exactly means remembering everything. DGIM ' +
        'keeps only bucket boundaries; space-saving keeps only a fixed number of keys and records how ' +
        'much of each counter it inherited.',
      formulation: {
        equations: [
          {
            label: 'DGIM estimate',
            expr: 'Σ (buckets fully inside) + (oldest bucket) / 2',
            terms: [
              { sym: 'measured', meaning: '20 buckets and 600 bits for a 20 000-position window' }
            ]
          },
          {
            label: 'DGIM bound',
            expr: 'relative error ≤ (oldest/2) / total ≈ 1/2r for r buckets per size',
            terms: [
              { sym: 'measured', meaning: '26.14% at r = 2, 12.93% at 4, 6.38% at 8, 2.97% at 16' }
            ]
          },
          {
            label: 'Space-saving',
            expr: 'count − error ≤ f(x) ≤ count; every key above N/m is monitored',
            terms: [
              { sym: 'measured', meaning: '200 counters over 200 000 items guarantees every key above 1 000' }
            ]
          },
          {
            label: 'Lossy counting',
            expr: 'count ≤ f(x) ≤ count + εN, window width ⌈1/ε⌉',
            terms: [
              { sym: 'measured', meaning: 'ε = 1/2 000 kept 270 entries and bounded the gap at 100' }
            ]
          },
          {
            label: 'Exponential decay',
            expr: 'v ← v · 2^(−Δt/H) + c, applied lazily when the key is touched',
            terms: [
              { sym: 'cost', meaning: 'no bound on the key count — 21 619 keys, 518 856 bytes' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Bucket sizes are non-decreasing from newest to oldest',
          why: 'It is what keeps the bucket count logarithmic and makes an overfull run contiguous.',
          breaks: 'Merging the wrong pair destroys the ordering and the error bound with it.'
        },
        {
          name: 'A merged bucket keeps the newer timestamp',
          why: 'The bucket leaves the window when its most recent one does.',
          breaks: 'Keeping the older timestamp expires live ones and under-counts permanently.'
        },
        {
          name: 'A space-saving replacement inherits the minimum as its error',
          why: 'It is what makes every counter an upper bound with readable slack.',
          breaks: 'Starting a new key at 1 lets a genuinely heavy key be evicted and never recover.'
        },
        {
          name: 'Only the oldest DGIM bucket is uncertain',
          why: 'Everything newer lies entirely inside the window, so it contributes exactly.',
          breaks: 'Halving more than one bucket makes the estimate biased low without bounding anything.'
        }
      ],
      complexity: [
        { operation: 'DGIM add', average: 'Θ(1) amortised', worst: 'Θ(log N)', note: 'a cascade of merges' },
        { operation: 'DGIM query', average: 'Θ(log N)', worst: 'Θ(log N)', note: 'sum the buckets' },
        { operation: 'DGIM space', average: 'Θ(log² N)', worst: 'Θ(log² N)', note: '600 bits against 20 000 exact' },
        { operation: 'space-saving add', average: 'Θ(1)', worst: 'Θ(1)', note: 'a bucket-list move, not a scan' },
        { operation: 'space-saving top-k', average: 'Θ(m log m)', worst: 'Θ(m log m)', note: 'sort the monitored set' },
        { operation: 'lossy counting add', average: 'Θ(1) amortised', worst: 'Θ(table)', note: 'a prune at every window boundary' },
        { operation: 'decayed add', average: 'Θ(1)', worst: 'Θ(1)', note: 'one exponential, applied lazily' }
      ],
      failureModes: [
        {
          symptom: 'A windowed alert fires thousands of items late.',
          cause: 'DGIM\'s estimate is a staircase: it only moves when a bucket expires or merges.',
          fix: 'Raise the bucket allowance, which shortens the oldest bucket and the staircase step.'
        },
        {
          symptom: 'The top-k list is stable but wrong after a traffic shift.',
          cause: 'Space-saving counts since the beginning of time; it has no window at all.',
          fix: 'Add decay, or keep a ring of per-interval sketches — and choose deliberately between them.'
        },
        {
          symptom: 'Memory grows without bound under a decayed counter.',
          cause: 'A decayed value only reaches zero in the limit, so no key is ever dropped.',
          fix: 'Put the decay inside a bounded structure; decay alone bounds nothing.'
        },
        {
          symptom: 'A reported heavy hitter turns out to have almost no traffic.',
          cause: 'Its counter is mostly inherited from the key it replaced, and the error was ignored.',
          fix: 'Report count − error, not count, when the answer has to be defensible.'
        },
        {
          symptom: 'Two per-shard top-k lists cannot be combined into a fleet-wide one.',
          cause: 'Space-saving is only approximately mergeable — the inherited errors do not compose.',
          fix: 'Merge count-min sketches if exact mergeability is needed, and keep candidates separately.'
        }
      ],
      inTheWild: [
        { system: 'Network flow monitoring at line rate', how: 'exponential histograms for per-interface counts over a rolling window' },
        { system: 'DDoS and abuse detection', how: 'space-saving over source addresses, because "top talkers now" is the query' },
        { system: 'Trending-topic pipelines', how: 'decayed counters inside a bounded counter set, so recency and memory are both handled' },
        { system: 'Database query-plan caches', how: 'lossy counting to find the statements worth keeping a plan for' }
      ],
      sources: [
        { title: 'Datar, Gionis, Indyk, Motwani — Maintaining stream statistics over sliding windows (SODA 2002)', where: 'DGIM, exponential histograms and the Ω(N) lower bound' },
        { title: 'Metwally, Agrawal, El Abbadi — Efficient computation of frequent and top-k elements in data streams (ICDT 2005)', where: 'space-saving and the Stream-Summary structure' },
        { title: 'Manku, Motwani — Approximate frequency counts over data streams (VLDB 2002)', where: 'lossy counting and its under-estimating bound' },
        { title: 'Cormode, Korn, Tirthapura — Exponentially decayed aggregates on data streams (ICDE 2008)', where: 'decay done properly, with bounded state' }
      ]
    },

    'choosing-sketches': {
      summary: 'The error/space/mergeability comparison across every family in the milestone, the ' +
        'adversarial input that breaks an unkeyed one, and the assertions a sketch\'s test suite needs.',
      intuition: 'The size column is the one everybody quotes and the least useful. What the error is ' +
        'measured on, which way it can go, and whether two sketches merge are the three that decide ' +
        'whether the structure survives contact with a real system.',
      formulation: {
        equations: [
          {
            label: 'The attack cost on a filter',
            expr: 'probes per manufactured false positive = 1/ε',
            terms: [
              { sym: 'measured', meaning: '50 false positives from 5 179 probes at ε = 1%' },
              { sym: 'why not lower ε', meaning: 'the attacker\'s work and your memory both scale as 1/ε' }
            ]
          },
          {
            label: 'The attack cost on a count-min sketch',
            expr: 'candidates per all-row collision ≈ w^d',
            terms: [
              { sym: 'measured', meaning: '32 × 3: 8 collisions in 305 021 probes against 32 768 predicted' },
              { sym: 'production', meaning: '2 048 × 5 costs 3.6 × 10¹⁶ candidates per collision' }
            ]
          },
          {
            label: 'What the flood achieves',
            expr: 'estimate rises to f(x) + Σ flood, and ε·N rises with it',
            terms: [
              { sym: 'measured', meaning: 'true count 100, estimate 40 100, bound never exceeded' }
            ]
          },
          {
            label: 'Exact, priced',
            expr: 'a Set of the keys ≈ Σ (2·|key| + 40) bytes',
            terms: [
              { sym: 'measured', meaning: '1 234 098 bytes for 21 619 keys, against 25 903 for a 1% filter' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The seed is per process and never published',
          why: 'Every guarantee here assumes the keys were chosen without knowledge of the hash.',
          breaks: 'A published seed costs 1/ε probes per manufactured false positive.'
        },
        {
          name: 'The insert count is exported alongside the sketch',
          why: 'Nothing inside a filter can report that it has passed the n it was sized for.',
          breaks: 'The error rate rises smoothly and silently — 1% becomes 16% at twice the n.'
        },
        {
          name: 'Mergeability is decided before the service is sharded',
          why: 'Retrofitting it means replacing the structure and migrating stored state.',
          breaks: 'Cuckoo filters and conservative count-min sketches cannot be combined afterwards.'
        },
        {
          name: 'A composed sketch is measured end to end',
          why: 'The guarantees of the outer and inner structures do not compose into a useful one.',
          breaks: 'Quoting the outer bound for a sketch-of-sketches asserts something nobody proved.'
        }
      ],
      complexity: [
        { operation: 'membership', average: 'Θ(k) or Θ(b)', worst: 'Θ(k) or Θ(cluster)', note: 'Bloom 9.6 bits/key at 1%; cuckoo 8.2 at 3%' },
        { operation: 'distinct count', average: 'Θ(1)', worst: 'Θ(1)', note: 'HyperLogLog, 3 072 bytes at σ = 1.63%' },
        { operation: 'frequency', average: 'Θ(d)', worst: 'Θ(d)', note: 'count-min, error ε·N, one-sided' },
        { operation: 'hot keys', average: 'Θ(1)', worst: 'Θ(1)', note: 'space-saving, 8 000 bytes for 200 counters' },
        { operation: 'quantiles', average: 'Θ(1) amortised', worst: 'varies', note: '944 B t-digest to 8 000 B reservoir' },
        { operation: 'similarity', average: 'Θ(L)', worst: 'Θ(L)', note: 'MinHash 512 bytes per document at L = 128' }
      ],
      failureModes: [
        {
          symptom: 'A sketch was chosen from a table and is wrong for the workload.',
          cause: 'The table summarises measurements on other streams; the ranking depends on the shape of yours.',
          fix: 'Build the candidates, feed them your stream, and score them against the exact answer.'
        },
        {
          symptom: 'An attacker inflates one key\'s count arbitrarily.',
          cause: 'The seed is known, so keys colliding with the victim in every row can be searched for.',
          fix: 'Seed per process, and widen the sketch — w^d is the search cost and it is the real defence.'
        },
        {
          symptom: 'A guarantee holds and the system still misbehaves.',
          cause: 'ε·N grows with the stream, so a flood widens the bound rather than violating it.',
          fix: 'Alert on the bound itself, not only on the estimate; a widening bound is the signal.'
        },
        {
          symptom: 'A test that used to pass now fails, and the tolerance is widened.',
          cause: 'The assertion was a hand-tuned constant with no derivation attached.',
          fix: 'Assert the stated bound computed from the structure\'s own parameters instead.'
        },
        {
          symptom: 'A sharded rollout produces impossible fleet-wide numbers.',
          cause: 'Per-shard answers were combined arithmetically rather than the sketches being merged.',
          fix: 'Ship the sketches; adding distinct counts over-counts by 70% and averaging p99s under-counts by 17%.'
        }
      ],
      inTheWild: [
        { system: 'Every LSM storage engine', how: 'a filter per file, sized from the expected key count, with the count exported' },
        { system: 'Analytics platforms with per-shard rollups', how: 'HLL and DDSketch chosen specifically because they merge exactly' },
        { system: 'Language runtimes after the 2011 hash-flooding disclosures', how: 'per-process hash seeds, for exactly the reason this section measures' },
        { system: 'Cache admission policies', how: 'count-min plus decay, composed — and measured end to end because the composition has no closed-form bound' }
      ],
      sources: [
        { title: 'Cormode, Garofalakis, Haas, Jermaine — Synopses for massive data (2012)', where: 'the family-by-family comparison this table condenses' },
        { title: 'Crosby, Wallach — Denial of service via algorithmic complexity attacks (USENIX 2003)', where: 'why a published hash seed is an attack surface' },
        { title: 'Aumüller, Dietzfelbinger, Woelfel — Explicit and efficient hash families suffice for cuckoo hashing (2014)', where: 'what "independent enough" actually means for these guarantees' },
        { title: 'Apache DataSketches — the library and its documentation', where: 'mergeability treated as a first-class design constraint' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));

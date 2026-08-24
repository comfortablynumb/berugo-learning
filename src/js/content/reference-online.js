/** Reference entries for competitive analysis, caching and scheduling (M21.1-M21.3). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'competitive-analysis': {
      summary: 'Ski rental swept over every season length at five purchase prices, with the ' +
        'break-even rule attaining 2 − 1/B exactly at each; the randomised strategy measured ' +
        'against an oblivious adversary and an adaptive one; and list update on three request ' +
        'families scored against the best static order.',
      intuition: 'The competitive ratio is the worst an algorithm can do against an opponent who ' +
        'saw the whole sequence first, and it is a maximum rather than an average.',
      formulation: {
        equations: [
          {
            label: 'The definition, and the quantifier that matters',
            expr: 'ALG(σ) ≤ c·OPT(σ) + b for EVERY σ',
            readAs: 'The algorithm costs at most c times the optimum plus a constant, on every ' +
              'request sequence rather than on average.',
            terms: [
              { sym: 'the maximum, not the mean', meaning: 'the demo’s "buy immediately" has a better mean and a 5× worse maximum' },
              { sym: 'the additive b', meaning: 'why a bound can look violated on a small instance and hold in the limit' },
              { sym: 'OPT', meaning: 'the offline optimum; where it is NP-hard the demo names a weaker reference instead' },
              { sym: 'oblivious against adaptive', meaning: 'whether the adversary sees the coins, which decides whether randomisation helps' }
            ]
          },
          {
            label: 'Ski rental at five purchase prices',
            expr: 'worst ratio · the bound 2 − 1/B · the season that produced it',
            terms: [
              { sym: 'B = 2 and 4', meaning: '1.5000 and 1.7500, at days 2 and 4' },
              { sym: 'B = 10', meaning: '1.9000 at day 10, against a mean of 1.6300' },
              { sym: 'B = 25 and 100', meaning: '1.9600 and 1.9900, at days 25 and 100' },
              { sym: 'the two mistakes', meaning: 'never buy reaches 3.0000 and grows; buy immediately reaches 10.0000' }
            ]
          },
          {
            label: 'List update on three families, against the best STATIC order',
            expr: 'do nothing · transpose · move-to-front · frequency count',
            terms: [
              { sym: 'Zipf (stationary)', meaning: '1.2850 · 1.0679 · 1.2399 · 1.0177' },
              { sym: 'bursty (a moving working set)', meaning: '1.2901 · 0.7278 · 0.3113 · 1.0156' },
              { sym: 'reverse sweep', meaning: '1.0000 · 1.0475 · 1.8964 · 1.0097' },
              { sym: 'the number below one', meaning: 'an ONLINE policy beating the best offline static order, because no static order follows a moving set' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The reported ratio is the maximum over inputs',
          why: 'A c-competitive claim is a promise about every sequence; a mean is a summary of one experiment.',
          breaks: 'Averaging over an arbitrary input distribution measures the distribution — the demo’s mean column makes a 5× worse strategy look 1% worse.'
        },
        {
          name: 'The denominator is named as exact or as a bound',
          why: 'A ratio against a lower bound over-estimates the true ratio, and against a weaker reference under-estimates it.',
          breaks: 'Calling the best static order OPT for list update quietly changes what every number in the table means.'
        },
        {
          name: 'The adversary model is stated before the randomised result',
          why: 'The same randomised strategy is 1.5625 against one opponent and 3.1428 against another.',
          breaks: 'Quoting e/(e − 1) for a system whose load reacts to its own behaviour is quoting a bound for a different problem.'
        }
      ],
      complexity: [
        { operation: 'break-even ski rental', average: 'O(1) per day, no state beyond the running total', worst: 'exactly 2 − 1/B times the optimum, attained on day B' },
        { operation: 'the randomised strategy', average: 'one draw from a distribution of B weights', worst: 'e/(e − 1) ≈ 1.582 oblivious; 3.1428 measured adaptive' },
        { operation: 'move-to-front', average: 'one splice per access; measured 0.3113× the static optimum on a bursty trace', worst: '2-competitive against the offline optimum; 1.8964 measured on the reverse sweep' },
        { operation: 'transpose', average: 'one swap per access; 1.0679 on a stationary trace', worst: 'not competitive — it needs many accesses to promote an item' },
        { operation: 'frequency count', average: 'a sort per access in this implementation; 1.0177 on Zipf', worst: 'nearly optimal on stationary traces and slow to react on moving ones' },
        { operation: 'the best static order (the reference)', average: 'one pass to count, one sort', worst: 'offline, and still beaten by move-to-front on a moving working set' }
      ],
      failureModes: [
        {
          symptom: 'A "2-competitive" heuristic performs badly in production.',
          cause: 'The bound is against an offline optimum and the workload’s optimum is already bad; a ratio to a poor reference is a poor absolute answer.',
          fix: 'Report the absolute cost alongside the ratio, and check what the offline optimum actually is on your traces.'
        },
        {
          symptom: 'A randomised strategy performs worse than the deterministic one it replaced.',
          cause: 'The adversary is adaptive — the system’s own retries, autoscaling or an attacker react to the choices.',
          fix: 'Use the deterministic rule. Randomisation is a payment for the input being fixed in advance.'
        },
        {
          symptom: 'A benchmark ranks strategies differently from the theory.',
          cause: 'It averaged over input lengths, and the competitive ratio is a maximum.',
          fix: 'Report the worst case and the input that produced it, with the mean beside them rather than instead of them.'
        },
        {
          symptom: 'Move-to-front makes a hot list slower.',
          cause: 'The distribution is stationary, so the moves buy nothing and cost one splice per access.',
          fix: 'Measure whether the working set moves. If it does not, a static order sorted by frequency wins.'
        }
      ],
      inTheWild: [
        'Connection pooling and keep-alive: rent until you have spent a reconnect, then keep it — the 2-competitive default.',
        'Spot-instance and reserved-instance decisions, which are ski rental with a longer horizon.',
        'Kernel and library list caches using move-to-front for recently used entries.',
        'TCP keep-alive and idle-timeout tuning, which is the same trade with the cost asymmetry reversed.'
      ],
      sources: [
        { title: 'Borodin and El-Yaniv — Online Computation and Competitive Analysis', note: 'the standard reference for the whole area' },
        { title: 'Sleator and Tarjan — Amortized efficiency of list update and paging rules (1985)', note: 'move-to-front, LRU, and the potential-function method' },
        { title: 'Karlin, Manasse, McGeoch and Owicki — Competitive randomized algorithms for nonuniform problems', note: 'the e/(e − 1) ski-rental strategy' },
        { title: 'Ben-David, Borodin, Karp, Tardos and Wigderson — On the power of randomization in on-line algorithms', note: 'why the adversary model decides whether randomisation helps' }
      ]
    },

    'page-replacement': {
      summary: 'Seven policies and Belady’s optimum on four trace families, with a working-set ' +
        'curve, a scan-resistance table and ARC’s adaptation target sampled as the trace runs.',
      intuition: 'Every policy is a guess about the future built from the past, and the failure ' +
        'they are all measured on is a scan that walks the working set out of the cache.',
      formulation: {
        equations: [
          {
            label: 'Seven policies on a mixed trace, 20 000 requests over 5 480 keys, 100 entries',
            expr: 'hit rate · fraction of Belady’s optimum',
            terms: [
              { sym: 'Belady (offline)', meaning: '72.6% — 14 520 hits, and nothing can be above it' },
              { sym: 'W-TinyLFU, LFU, ARC', meaning: '72.5% each, 99.9% of the ceiling' },
              { sym: '2Q', meaning: '67.8%, 93.4% of the ceiling' },
              { sym: 'FIFO, LRU, CLOCK', meaning: '58.7% each, 80.9% of the ceiling' }
            ]
          },
          {
            label: 'The loop: a cycle of 120 keys through a cache of 100',
            expr: 'LRU’s k-competitive bound attained',
            terms: [
              { sym: 'FIFO, LRU, CLOCK, LFU, ARC, 2Q', meaning: '0.0% — every key is evicted one step before it is needed' },
              { sym: 'Belady', meaning: '81.9%, by keeping 99 of the 120 resident' },
              { sym: 'W-TinyLFU', meaning: '81.1% — a tie in the admission contest goes to the incumbent, so the resident set freezes' },
              { sym: 'what this is', meaning: 'the k-competitiveness bound attained rather than approached' }
            ]
          },
          {
            label: 'Scan resistance: hit rate retained when a sweep is added to a Zipf trace',
            expr: 'Zipf → scan · fraction retained',
            terms: [
              { sym: 'ARC', meaning: '49.9% → 33.0%, retaining 66%' },
              { sym: 'LFU and W-TinyLFU', meaning: '52.1% → 33.0% and 56.3% → 32.9%, retaining 63% and 58%' },
              { sym: '2Q', meaning: '50.4% → 28.8%, retaining 57%' },
              { sym: 'FIFO, LRU, CLOCK', meaning: '→ 20.8% each, retaining 49%, 45% and 44%' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Every hit rate is reported next to the optimum on the same trace',
          why: 'A hit rate alone is a property of the trace as much as of the policy.',
          breaks: 'Comparing two policies measured on two traces compares the traces.'
        },
        {
          name: 'Belady is computed from the actual future positions, not estimated',
          why: 'It is the ceiling, so an approximation to it silently changes every ratio in the table.',
          breaks: 'Evicting the item not used for the longest time in the PAST is LRU, not Belady, and the two differ by 14 points on the demo’s trace.'
        },
        {
          name: 'The scan trace and the Zipf trace share a hot set',
          why: 'Otherwise the retained fraction measures two different workloads rather than the effect of the sweep.',
          breaks: 'Generating the scan trace independently makes the retention column meaningless.'
        }
      ],
      complexity: [
        { operation: 'LRU', average: 'O(1) per access with a hash map and a list', worst: 'k-competitive; 0% hits on a cycle of k + 1 keys' },
        { operation: 'CLOCK', average: 'O(1) amortised; one reference bit per entry', worst: 'the hand can sweep the whole cache before finding a clear bit' },
        { operation: 'LFU', average: 'O(k) per eviction in this implementation; a heap makes it O(log k)', worst: 'a stale favourite is unevictable without decay' },
        { operation: 'ARC', average: 'O(1) per access; four lists and two ghost lists of keys only', worst: 'ghost lists double the key memory, and adapt only when evictions return' },
        { operation: '2Q', average: 'O(1); a FIFO, a ghost FIFO and an LRU', worst: 'the in-queue size is a tuning parameter, unlike ARC’s target' },
        { operation: 'W-TinyLFU', average: 'O(1); a count-min sketch of 4-bit counters plus a window and a segmented main cache', worst: 'the sketch is approximate, so a rare key can be over-counted and admitted' },
        { operation: 'Belady', average: 'one pass to index future positions, then a binary search per eviction', worst: 'offline only; it is a ceiling rather than a policy' }
      ],
      failureModes: [
        {
          symptom: 'The cache hit rate collapses at the same time every night.',
          cause: 'A batch job sweeping a table through an LRU, evicting the whole working set.',
          fix: 'Admission control — a frequency sketch and a comparison — rather than more memory. The demo measures LRU retaining 45% and ARC retaining 66%.'
        },
        {
          symptom: 'A cache reports a good hit rate and the system is still slow.',
          cause: 'The hit rate is close to the trace’s ceiling, so the cache is not the problem.',
          fix: 'Compute Belady on a captured trace. If the policy is at 99% of it, only more memory or fewer requests will help.'
        },
        {
          symptom: 'A loop over slightly more data than the cache holds gets no hits at all.',
          cause: 'LRU’s worst case exactly — each item is evicted one step before it is needed.',
          fix: 'Any policy with admission, or a slightly larger cache, or reverse the iteration order on alternate passes.'
        },
        {
          symptom: 'LFU keeps items nobody has wanted for weeks.',
          cause: 'Counts never decay, so an old favourite outranks anything new.',
          fix: 'Halve the counts periodically. W-TinyLFU does it in the sketch, which needs no key list to walk.'
        }
      ],
      inTheWild: [
        'PostgreSQL’s buffer manager uses a CLOCK variant; MySQL/InnoDB uses a midpoint-insertion LRU that is 2Q in spirit.',
        'Caffeine, the standard JVM cache, is W-TinyLFU; Go’s Ristretto follows the same design.',
        'ZFS uses ARC, which is where the name is most often met.',
        'Operating-system page replacement is almost always CLOCK or second-chance, for the hardware reason rather than a quality one.'
      ],
      sources: [
        { title: 'Belady — A study of replacement algorithms for a virtual-storage computer (1966)', note: 'the optimal offline policy, and the ceiling every comparison needs' },
        { title: 'Sleator and Tarjan (1985)', note: 'LRU’s k-competitiveness and the matching lower bound' },
        { title: 'Megiddo and Modha — ARC: a self-tuning, low overhead replacement cache (2003)', note: 'the ghost lists and the adaptation rule' },
        { title: 'Johnson and Shasha — 2Q: a low overhead high performance buffer management replacement algorithm', note: 'admission on a second sighting' },
        { title: 'Einziger, Friedman and Manes — TinyLFU: a highly efficient cache admission policy', note: 'the frequency sketch, the decay, and the admission contest' }
      ]
    },

    'online-scheduling': {
      summary: 'List scheduling and LPT scored against exact optima on forty instances and on ' +
        'the family that attains Graham’s bound, the power of two choices measured against both ' +
        'asymptotic predictions, and consistent hashing measured on imbalance and on key movement ' +
        'at once.',
      intuition: 'Sampling two backends and taking the less loaded is a one-line change with an ' +
        'exponential effect on tail load, and it is the highest ratio of benefit to effort here.',
      formulation: {
        equations: [
          {
            label: 'Graham’s bound, measured',
            expr: 'worst ratio · mean · the proved bound',
            terms: [
              { sym: 'list scheduling, 40 exact instances', meaning: '1.5000 · 1.1625 · 1.7500' },
              { sym: 'LPT, the same instances', meaning: '1.0455 · 1.0032 · 1.2500' },
              { sym: 'the tight family at m = 4', meaning: '1.7500 exactly — 13 jobs, makespan 7 against an optimum of 4' },
              { sym: 'LPT on the same family', meaning: '1.0000 — placing the big job first removes the problem' }
            ]
          },
          {
            label: 'Balls into bins: maximum load at n balls in n bins, averaged over 12 runs',
            expr: 'one choice · two choices · three choices',
            terms: [
              { sym: 'n = 100', meaning: '4.33 · 2.50 · 2.00, against predictions of 3.02 and 2.20' },
              { sym: 'n = 1 600', meaning: '6.00 · 3.00 · 2.67' },
              { sym: 'n = 25 600', meaning: '6.83 · 3.08 · 3.00, against predictions of 4.38 and 3.34' },
              { sym: 'the ratio one over two', meaning: '1.73, 1.64, 2.00, 2.08, 2.22 — it grows, which is what a separation looks like' }
            ]
          },
          {
            label: 'Consistent hashing on 16 machines and 20 000 keys',
            expr: 'points per machine · imbalance · busiest over quietest · keys moved on removal',
            terms: [
              { sym: '1 point', meaning: '4.470× · 84.65× · 8.03%' },
              { sym: '16 points', meaning: '1.351× · 1.77× · 6.47%' },
              { sym: '256 points', meaning: '1.085× · 1.17× · 6.16%' },
              { sym: 'the ideal move fraction', meaning: '1/16 = 6.25%, which every row is near — that is the property being bought' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Every ratio is against an exact optimum, and rows without one are excluded',
          why: 'A ratio against a lower bound is an over-estimate, and mixing the two produces an apparently violated theorem.',
          breaks: 'An earlier version of the demo mixed them and reported an LPT worst case of 1.3647 against a bound of 1.2500.'
        },
        {
          name: 'The two-choices samples are independent draws',
          why: 'Two rounds of the same hash are one choice with extra steps.',
          breaks: 'Hashing the key twice with the same function gives the same bin, and the measurement silently becomes the one-choice column.'
        },
        {
          name: 'Consistent hashing is reported on imbalance AND on key movement',
          why: 'The imbalance is the price and the movement is what it buys.',
          breaks: 'Reporting only the imbalance makes it look strictly worse than random assignment, which is the standard misreading.'
        }
      ],
      complexity: [
        { operation: 'list scheduling', average: 'O(m) per job with a scan, O(log m) with a heap', worst: '(2 − 1/m)·OPT, attained by m(m − 1) unit jobs and one of size m' },
        { operation: 'LPT', average: 'O(n log n) to sort, then the same greedy pass', worst: '(4/3 − 1/(3m))·OPT; measured 1.0455 on random instances' },
        { operation: 'exact makespan (the reference)', average: 'm^n assignments with pruning; 4^8 here', worst: 'NP-hard — which is why the demo’s instances are eight jobs' },
        { operation: 'one random choice', average: 'O(1); maximum load ≈ log n / log log n above the mean', worst: 'the maximum keeps growing with n' },
        { operation: 'two random choices', average: 'O(1) plus one extra sample; maximum ≈ log log n / log 2', worst: 'nearly flat in n over any measurable range' },
        { operation: 'consistent hashing lookup', average: 'O(log(m·v)) with a binary search over the ring', worst: 'the ring is m·v points, held in memory on every client' }
      ],
      failureModes: [
        {
          symptom: 'A random load balancer has one very slow backend.',
          cause: 'The maximum load of n random assignments is log n / log log n above the mean, and it grows.',
          fix: 'Sample two and take the less loaded. The demo measures the maximum falling from 6.83 to 3.08 at 25 600 bins.'
        },
        {
          symptom: 'Two-choices balancing is worse than random.',
          cause: 'The load signal is stale, so every balancer picks the same "idle" backend at once.',
          fix: 'Use a current signal — in-flight requests at this balancer — rather than a periodically reported one.'
        },
        {
          symptom: 'Adding a machine to a hash-sharded cluster moves nearly all the data.',
          cause: 'Hashing modulo the machine count changes every key’s owner.',
          fix: 'Consistent hashing moves about 1/m; the demo measures 6.16% for one of sixteen against an ideal of 6.25%.'
        },
        {
          symptom: 'A consistent-hash ring has one machine holding several times its share.',
          cause: 'Too few virtual nodes — a single ring point per machine owns one random arc, and random arcs are very uneven.',
          fix: 'Raise the points per machine. The demo measures 4.470× at one point and 1.085× at 256.'
        }
      ],
      inTheWild: [
        'Nginx and HAProxy both offer a "least connections of two random" mode, which is exactly this result.',
        'Kubernetes scheduling and YARN are list scheduling with a scoring function on top.',
        'Memcached clients, Cassandra and DynamoDB partitioning all use consistent hashing with virtual nodes.',
        'Netflix and Google have both published on two-choices load balancing at scale, under the name "power of two random choices" or "least-loaded of d".'
      ],
      sources: [
        { title: 'Graham — Bounds for certain multiprocessing anomalies (1966)', note: 'list scheduling, the 2 − 1/m bound and the tight family' },
        { title: 'Graham — Bounds on multiprocessing timing anomalies (1969)', note: 'LPT and 4/3 − 1/(3m)' },
        { title: 'Azar, Broder, Karlin and Upfal — Balanced allocations (1994)', note: 'the power of two choices' },
        { title: 'Mitzenmacher — The power of two choices in randomized load balancing', note: 'the thesis, and the clearest account of why the exponent changes' },
        { title: 'Karger et al. — Consistent hashing and random trees (1997)', note: 'the ring, virtual nodes and the movement property' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));

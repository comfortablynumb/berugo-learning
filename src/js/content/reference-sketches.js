/** Reference entries for the approximate-membership sections (M07.1-M07.3). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'bloom-filters': {
      summary: 'A bit array and k hash functions answering set membership with no false negatives, a ' +
        'tunable false-positive rate and space that depends on the error target rather than on the keys.',
      intuition: 'Setting a bit is a one-way promise. If a bit a key needs is clear, the key was never ' +
        'added; if all of them are set, it may have been, or several other keys may have set them ' +
        'between them.',
      formulation: {
        equations: [
          {
            label: 'Size',
            expr: 'm = −n ln p / (ln 2)² = 1.4427 · n · log₂(1/p)',
            terms: [
              { sym: 'measured', meaning: '9.59 bits per key at p = 1%, 14.38 at 0.1%' },
              { sym: '1.4427', meaning: 'the standing overhead over the information-theoretic optimum' }
            ]
          },
          {
            label: 'Hash count',
            expr: 'k = (m/n) ln 2, at which exactly half the array is set',
            terms: [
              { sym: 'measured', meaning: 'k = 7 at 1%; the array reads 51.9% full at the design n' }
            ]
          },
          {
            label: 'Achieved error',
            expr: 'fpr(n) = (1 − e^(−kn/m))^k',
            terms: [
              { sym: 'at n', meaning: '1.004% predicted, 1.010% measured over 20 000 absent keys' },
              { sym: 'at 2n', meaning: '15.75% predicted, 16.05% measured — same curve, no break' }
            ]
          },
          {
            label: 'Self-estimate',
            expr: 'n̂ = −(m/k) · ln(1 − fill)',
            terms: [
              { sym: 'measured', meaning: '99 905 recovered from a filter holding 100 000 keys' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'A key that was added always answers true',
          why: 'Bits are only ever set, so the k bits a key tested at insert time are still set.',
          breaks: 'Any clearing of a bit — a delete, a reset, a partial rebuild — introduces false negatives.'
        },
        {
          name: 'The array is about half full at the design capacity',
          why: 'It is what k = (m/n) ln 2 means, and it is the cheapest audit of a filter you inherited.',
          breaks: 'A filter measured at 80% full is holding far more than it was sized for.'
        },
        {
          name: 'Union by OR is exact; intersection by AND is not',
          why: 'A key\'s bits are set in the OR exactly when they were set on one side.',
          breaks: 'AND reports keys neither set held, because their bits can be covered from both sides.'
        },
        {
          name: 'Two filters combine only at identical m, k and seed',
          why: 'Bit positions carry no meaning across filters with different parameters.',
          breaks: 'Combining mismatched filters produces an array whose answers are unrelated to either set.'
        }
      ],
      complexity: [
        { operation: 'add', average: 'Θ(k)', worst: 'Θ(k)', note: 'two hashes, k bit writes' },
        { operation: 'query, hit', average: 'Θ(k)', worst: 'Θ(k)', note: '6.95 cache lines measured at k = 7' },
        { operation: 'query, miss', average: 'Θ(1) expected', worst: 'Θ(k)', note: 'stops at the first clear bit' },
        { operation: 'delete', average: '—', worst: '—', note: 'not supported at any cost' },
        { operation: 'union', average: 'Θ(m)', worst: 'Θ(m)', note: 'bitwise OR, exact' },
        { operation: 'space', average: 'Θ(n log(1/p))', worst: 'Θ(n log(1/p))', note: '9.59 bits per key at 1%' }
      ],
      failureModes: [
        {
          symptom: 'The false-positive rate in production is many times what was designed for.',
          cause: 'More keys were inserted than the filter was sized for; the curve continued smoothly.',
          fix: 'Export the insert count, alert at 1.16× the design n where the error has doubled.'
        },
        {
          symptom: 'A key that was definitely added is reported absent.',
          cause: 'Something cleared bits — a delete was implemented, or two filters were ANDed.',
          fix: 'Use a counting or cuckoo filter for a shrinking set; never clear bits in a plain filter.'
        },
        {
          symptom: 'Two filters merged and the result answers nonsense.',
          cause: 'They were built with different m, k or seed, so their bit positions mean different things.',
          fix: 'Fix the shape and the seed at deployment, and version them alongside the data.'
        },
        {
          symptom: 'An attacker produces false positives at will.',
          cause: 'The seed is a published constant, so candidate keys can be searched offline.',
          fix: 'Seed per process from a source the attacker cannot read; 1/ε probes is all an attack costs.'
        },
        {
          symptom: 'The filter is slower than the lookup it was meant to avoid.',
          cause: 'k scattered probes are k cache misses; the protected structure was already in memory.',
          fix: 'Use a blocked filter, or drop the filter — it only pays when the miss path is expensive.'
        }
      ],
      inTheWild: [
        { system: 'LSM-tree storage engines (RocksDB, LevelDB, Cassandra)', how: 'one filter per SSTable, to skip a disk read on a key the file does not hold' },
        { system: 'Chrome Safe Browsing (historically)', how: 'a local filter over malicious URLs, with a server round-trip only on a hit' },
        { system: 'CDN and proxy caches', how: '"has this object been requested twice" before admitting it to the cache' },
        { system: 'Bitcoin BIP-37 (deprecated)', how: 'clients advertising a filter over their addresses — and the privacy leak that killed it' }
      ],
      sources: [
        { title: 'Bloom — Space/time trade-offs in hash coding with allowable errors (CACM 1970)', where: 'the original construction and the error analysis' },
        { title: 'Kirsch, Mitzenmacher — Less hashing, same performance (ESA 2006)', where: 'why two hashes suffice for k probes' },
        { title: 'Broder, Mitzenmacher — Network applications of Bloom filters: a survey (2004)', where: 'the variants and where each is used' },
        { title: 'Carter et al. — Exact and approximate membership testers (STOC 1978)', where: 'the log₂(1/p) lower bound the 1.44 factor is measured against' }
      ]
    },

    'bloom-variants': {
      summary: 'Three repairs to three separate complaints about the plain filter — deletion, cache ' +
        'behaviour and an unknown n — each buying one property and paying in a different currency.',
      intuition: 'None of them is a strictly better Bloom filter. Counting buys deletion with memory, ' +
        'blocking buys one cache line with accuracy, and a scalable chain buys "no sizing needed" with ' +
        'work on the miss path.',
      formulation: {
        equations: [
          {
            label: 'Counting filter memory',
            expr: 'bits = m · b for b-bit counters, against m for the plain filter',
            terms: [
              { sym: 'measured', meaning: '95 851 bytes at b = 4 against 23 963, for identical m and k' }
            ]
          },
          {
            label: 'Blocked filter cost',
            expr: 'lines per query = ⌈blockBits / 512⌉, independent of k',
            terms: [
              { sym: 'measured', meaning: '1.00 at 512-bit blocks against 6.95 for the standard filter' }
            ]
          },
          {
            label: 'Blocking penalty',
            expr: 'inflation = measured_blocked / measured_standard at equal m and k',
            terms: [
              { sym: 'measured', meaning: '2.56× at 64 bits, 1.21× at 512, 1.08× at 1 024, 0.95× at 4 096' }
            ]
          },
          {
            label: 'Scalable chain error',
            expr: '1 − Π(1 − p·r^i) ≤ p/(1 − r) for tightening ratio r',
            terms: [
              { sym: 'measured', meaning: '0.95% over four layers against a 1% target' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'A saturated counter is never decremented',
          why: 'It has lost track of its true multiplicity; decrementing risks a false negative.',
          breaks: 'Decrementing a saturated counter deletes a key that is still in the set.'
        },
        {
          name: 'A blocked filter\'s block is one aligned cache line',
          why: 'The whole benefit is one memory access, and an unaligned 512-bit block spans two.',
          breaks: 'Misalignment costs the access saving while keeping the accuracy penalty.'
        },
        {
          name: 'Scalable layers have strictly tightening targets',
          why: 'The geometric series is what bounds the whole chain independently of its length.',
          breaks: 'Equal targets make the total error grow linearly with the number of layers.'
        },
        {
          name: 'A query that returns false has consulted every layer',
          why: 'Absence has to be proved in all of them; only a hit may short-circuit.',
          breaks: 'Stopping early on a miss produces false negatives, which no filter may have.'
        }
      ],
      complexity: [
        { operation: 'counting add / remove', average: 'Θ(k)', worst: 'Θ(k)', note: '4× the memory of the plain filter' },
        { operation: 'blocked query', average: 'Θ(k)', worst: 'Θ(k)', note: '1 cache line rather than k' },
        { operation: 'scalable query, hit', average: 'Θ(k)', worst: 'Θ(L·k)', note: 'stops at the matching layer' },
        { operation: 'scalable query, miss', average: 'Θ(L·k)', worst: 'Θ(L·k)', note: '9.11 lines measured over four layers' },
        { operation: 'scalable add', average: 'Θ(L·k)', worst: 'Θ(L·k)', note: 'a duplicate check across the chain first' },
        { operation: 'space', average: 'Θ(n log(1/p))', worst: 'Θ(n log(1/p))', note: 'counting ×b, scalable ×2.2 measured' }
      ],
      failureModes: [
        {
          symptom: 'A counting filter stops forgetting: removals no longer reduce the error rate.',
          cause: 'Counters saturated under a multiset load and are frozen at the ceiling.',
          fix: 'Widen the counters, or deduplicate before insert; 4 bits saturate at 15 repeats.'
        },
        {
          symptom: 'The blocked filter is no faster than the standard one.',
          cause: 'Blocks are not cache-line aligned, so each query straddles two lines.',
          fix: 'Allocate the array with explicit alignment and make the block exactly one line.'
        },
        {
          symptom: 'The blocked filter\'s error is far above the formula.',
          cause: 'Blocks are too small, so occupancy variance dominates — 2.56× at 64 bits.',
          fix: 'Use 512-bit blocks; below that the variance penalty grows faster than the saving.'
        },
        {
          symptom: 'A scalable filter\'s queries get slower over time.',
          cause: 'Every miss consults every layer, and layers accumulate as the sizing estimate fails.',
          fix: 'Rebuild into one correctly sized filter once the real n is known.'
        },
        {
          symptom: 'Memory grew far beyond the estimate for a scalable filter.',
          cause: 'Layer capacities double, so the chain holds roughly twice the ideal filter\'s bits.',
          fix: 'Size the first layer generously; the penalty is worst when n₀ was wildly low.'
        }
      ],
      inTheWild: [
        { system: 'Squid and other proxy caches', how: 'counting filters for cache digests, which must forget evicted objects' },
        { system: 'Apache Impala and Parquet readers', how: 'blocked (split-block) filters for runtime join filtering, chosen for the single access' },
        { system: 'Distributed deduplication systems', how: 'scalable filters where the corpus size is genuinely unknown at start-up' },
        { system: 'Network switches with per-flow state', how: 'counting filters so a flow can be removed when it ends' }
      ],
      sources: [
        { title: 'Fan, Cao, Almeida, Broder — Summary cache: a scalable wide-area web cache sharing protocol (1998)', where: 'the counting Bloom filter, and cache digests' },
        { title: 'Putze, Sanders, Singler — Cache-, hash- and space-efficient Bloom filters (2007)', where: 'blocked filters and the accuracy they give up' },
        { title: 'Almeida, Baquero, Preguiça, Hutchison — Scalable Bloom filters (2007)', where: 'the layer chain and the geometric error bound' },
        { title: 'Rottenstreich, Kanizo, Keslassy — The variable-increment counting Bloom filter (2012)', where: 'what to do when 4-bit counters are not enough' }
      ]
    },

    'fingerprint-filters': {
      summary: 'Filters that store a short fingerprint of each key rather than setting bits, which buys ' +
        'deletion and a mergeable read-out and costs a hard capacity ceiling.',
      intuition: 'A Bloom filter smears each key across k unattributable bits. A fingerprint filter ' +
        'keeps one small object per key, so it can be found again and removed — and so the table can ' +
        'run out.',
      formulation: {
        equations: [
          {
            label: 'Cuckoo error',
            expr: 'fpr ≈ 1 − (1 − 2^−f)^(2bα) ≈ 2bα / 2^f',
            terms: [
              { sym: 'measured', meaning: '2.978% at f = 8, b = 4, α = 0.97 against 3.083% predicted' },
              { sym: 'α', meaning: 'load matters: a half-empty table has half the error of the formula' }
            ]
          },
          {
            label: 'Cuckoo space',
            expr: 'bits per item = f / α',
            terms: [
              { sym: 'measured', meaning: '8.24 at f = 8; the crossover with Bloom is near 0.5% error' }
            ]
          },
          {
            label: 'Alternative bucket',
            expr: 'i₂ = i₁ ⊕ (h(f) mod b), an involution only for b a power of two',
            terms: [
              { sym: 'why', meaning: 'relocation must find the other bucket from the fingerprint alone' }
            ]
          },
          {
            label: 'Quotient filter layout',
            expr: 'fingerprint = q·2^r + rem, stored as r + 3 bits per slot',
            terms: [
              { sym: 'error', meaning: '≈ α/2^r — 0.586% at r = 7 and α = 0.75' },
              { sym: 'merge', meaning: 'q → q+1, r → r−1 keeps p fixed and every fingerprint intact' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The bucket count is a power of two',
          why: 'i₁ ⊕ h(f) must return i₁ when applied twice, or a relocated fingerprint is unreachable.',
          breaks: 'Any other modulus loses items during eviction with no error reported.'
        },
        {
          name: 'A failed insertion keeps its orphan',
          why: 'The last fingerprint of an exhausted eviction chain is still a member of the set.',
          breaks: 'Dropping it gives the filter a false negative at the exact moment it fills.'
        },
        {
          name: 'Remove is only ever called for a key that was inserted',
          why: 'The filter cannot check it, and a phantom removal deletes some other key\'s fingerprint.',
          breaks: 'Silent false negatives — 59 of them from 4 000 phantom deletes at a 3% error rate.'
        },
        {
          name: 'A quotient filter\'s runs are ordered by quotient, and remainders sorted within a run',
          why: 'That is what makes the linear read-out ascending, and therefore what makes merging linear.',
          breaks: 'An unsorted run makes the merge produce a filter whose queries miss.'
        }
      ],
      complexity: [
        { operation: 'cuckoo query', average: 'Θ(b)', worst: 'Θ(b)', note: 'exactly two buckets, 2.00 cache lines' },
        { operation: 'cuckoo insert', average: 'Θ(1)', worst: 'Θ(maxKicks)', note: '86.4% evict nothing; longest chain measured 408' },
        { operation: 'cuckoo delete', average: 'Θ(b)', worst: 'Θ(b)', note: 'unchecked — see the invariant' },
        { operation: 'quotient query', average: 'Θ(1) expected', worst: 'Θ(cluster)', note: 'one contiguous run, 1.00 cache lines' },
        { operation: 'quotient insert', average: 'Θ(1) expected', worst: 'Θ(cluster)', note: 'shifts the tail of the cluster right' },
        { operation: 'quotient merge', average: 'Θ(n₁ + n₂)', worst: 'Θ(n₁ + n₂)', note: 'one pass, no key consulted' }
      ],
      failureModes: [
        {
          symptom: 'Inserts start failing under load and never recover.',
          cause: 'The table reached its load ceiling — 97.1% at four slots per bucket.',
          fix: 'Treat add() as fallible, size for the ceiling, and rebuild larger rather than retrying.'
        },
        {
          symptom: 'Keys that were definitely inserted are reported absent.',
          cause: 'A removal was issued for a key that was never added, and it cleared somebody else\'s fingerprint.',
          fix: 'Guard the delete path outside the filter; nothing inside it can detect the mistake.'
        },
        {
          symptom: 'Insert latency has a tail three orders of magnitude past the mean.',
          cause: 'Eviction chains: the mean is 1.94 kicks and the longest in one fill was 408.',
          fix: 'Bound the chain, and budget for the tail rather than for the mean.'
        },
        {
          symptom: 'A cuckoo filter uses far more memory than the paper promised.',
          cause: 'The bucket count is rounded up to a power of two, so a table for 8 000 keys is half empty.',
          fix: 'Choose the key count to fit the geometry, or accept up to 2× on the rounding.'
        },
        {
          symptom: 'Two filters cannot be combined into one.',
          cause: 'Cuckoo filters do not merge — the bucket assignment depends on the table size.',
          fix: 'Use a quotient filter if shards must be rolled up, and pay the extra bits per item.'
        }
      ],
      inTheWild: [
        { system: 'CockroachDB, TiKV and other LSM engines', how: 'cuckoo and ribbon filters where per-SSTable deletion or a tighter error is wanted' },
        { system: 'Network middleboxes with per-flow tables', how: 'cuckoo filters, because a flow that ends must be removable' },
        { system: 'Quotient-filter-based LSM designs (VerLSM, SplinterDB lineage)', how: 'the mergeable read-out is what makes compaction cheap' },
        { system: 'Content-addressed storage', how: 'fingerprint filters where the error budget is well under 0.5% and Bloom loses on size' }
      ],
      sources: [
        { title: 'Fan, Andersen, Kaminsky, Mitzenmacher — Cuckoo filter: practically better than Bloom (CoNEXT 2014)', where: 'the partial-key trick and the space comparison' },
        { title: 'Bender et al. — Don\'t thrash: how to cache your hash on flash (VLDB 2012)', where: 'the quotient filter, its metadata bits and its merge' },
        { title: 'Pagh, Rodler — Cuckoo hashing (2004)', where: 'the load ceiling that the bucket width is fighting' },
        { title: 'Pandey, Bender, Johnson, Patro — A general-purpose counting filter (SIGMOD 2017)', where: 'counting quotient filters, and why the read-out matters' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));

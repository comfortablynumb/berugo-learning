/** Reference entries for the hashing sections (M03). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;
  const CLRS = { title: 'Introduction to Algorithms, chapter 11', where: 'Cormen, Leiserson, Rivest, Stein' };
  const CROSBY = { title: 'Denial of service via algorithmic complexity attacks', where: 'Crosby, Wallach, USENIX 2003' };
  const ABSEIL = { title: 'Swiss tables design notes', where: 'Abseil / Google' };

  registry.register({
    'hash-functions': {
      summary: 'A table hash must be deterministic, uniform, avalanching and fast — and the third of ' +
        'those is the one a histogram cannot check.',
      intuition: 'Think of the hash as spending its budget on mixing. Every shift-multiply pair moves ' +
        'information from high bits into low ones; skip the finalising pairs and the low bits — the ' +
        'only ones a masked table actually reads — still carry the shape of the input.',
      formulation: {
        equations: [
          { label: 'Avalanche', expr: 'P(bit j of h flips | bit i of x flips) ≈ 0.5 for all i, j',
            terms: [{ sym: 'estimate', meaning: 'a proportion over n samples, SE = sqrt(0.25/n)' }] },
          { label: 'murmur3 finaliser', expr: 'h ^= h>>>16; h *= 0x85ebca6b; h ^= h>>>13; h *= 0xc2b2ae35; h ^= h>>>16',
            terms: [{ sym: 'the constants', meaning: 'chosen by search to maximise avalanche' }] },
          { label: 'Uniformity', expr: 'χ² = Σ (o_i − e_i)² / e_i, e_i = n/m',
            terms: [{ sym: 'χ²/dof ≈ 1', meaning: 'consistent with uniform' }] },
          { label: 'Composite keys', expr: 'combine(a,b) = a ^ (b + 0x9e3779b9 + (a<<6) + (a>>2))',
            terms: [{ sym: 'the shifts', meaning: 'what makes it order-sensitive; plain XOR is not' }] }
        ],
        derivation: [
          'A table masks with capacity − 1, so only log₂m low bits are read. A finaliser exists to ' +
            'push entropy from the whole word into those bits.',
          'The 40-60% avalanche band is only a criterion once each cell has a standard error well ' +
            'under 10 points, which needs at least ~420 samples across 1 024 cells.'
        ]
      },
      invariants: [
        { name: 'Equal keys hash equally', why: 'Everything else in a table depends on it.', breaks: 'When the hash reads mutable state — a key mutated after insertion is lost.' },
        { name: 'The hash is not a checksum or a digest', why: 'Different jobs: speed, error detection, and collision resistance.', breaks: 'Using a table hash for integrity, or SHA-256 for a hot map.' },
        { name: 'Low bits carry as much entropy as high bits', why: 'The table only reads the low ones.', breaks: 'For any hash without a finaliser, which is most hand-rolled ones.' }
      ],
      complexity: [
        { operation: 'FNV-1a, djb2', average: 'Θ(len)', worst: 'Θ(len)', note: 'One multiply per byte, no finalise' },
        { operation: 'murmur3', average: 'Θ(len)', worst: 'Θ(len)', note: 'Four bytes per round plus a finalise' },
        { operation: 'Avalanche test', average: 'Θ(32 · samples)', worst: 'same', note: '1 024 cells estimated at once' },
        { operation: 'Chi-squared', average: 'Θ(n + m)', worst: 'same', note: 'One pass plus one over the buckets' }
      ],
      failureModes: [
        { symptom: 'Uneven buckets with a "good" hash', cause: 'No finaliser, so the low bits are correlated.', fix: 'Add a murmur3-style finalise, or hash the hash.' },
        { symptom: '(a, b) and (b, a) collide', cause: 'Field hashes combined with XOR.', fix: 'An order-sensitive combine with shifts.' },
        { symptom: 'A good mixer fails the avalanche test', cause: 'Too few samples: the worst of 1 024 cells strays by chance.', fix: 'Use ≥ 420 samples, or test deviation in standard errors.' },
        { symptom: 'Hash values differ between runs or machines', cause: 'A seeded or address-derived hash being persisted.', fix: 'Never store a runtime hash; recompute it.' }
      ],
      inTheWild: [
        { system: 'Java String.hashCode', how: 'h = 31h + c, no finaliser — and cached per string' },
        { system: 'Go maps', how: 'AES-NI-based hash with a per-process seed where the CPU supports it' },
        { system: 'xxHash, wyhash', how: 'The current speed/quality frontier for non-cryptographic hashing' }
      ],
      sources: [CLRS, { title: 'MurmurHash3', where: 'Appleby, 2011' },
        { title: 'The hash function lounge', where: 'SMHasher test suite' }]
    },

    'universal-hashing': {
      summary: 'Choosing the hash at random from a family turns "collisions are unlikely" from a hope ' +
        'about the input into a guarantee about the algorithm.',
      intuition: 'A fixed hash has a fixed worst case, and anyone can compute it. Randomising the ' +
        'choice does not make collisions impossible — it makes them unpredictable, which is what ' +
        'matters when the keys are supplied by someone who read your source.',
      formulation: {
        equations: [
          { label: 'Universality', expr: 'P_{h∈H}[h(x) = h(y)] ≤ 1/m for all x ≠ y',
            terms: [{ sym: 'over h, not over x', meaning: 'the randomness is in the choice of function' }] },
          { label: 'Multiply-shift', expr: 'h_a(x) = (a·x mod 2^w) >>> (w − ℓ), a odd, m = 2^ℓ',
            terms: [{ sym: 'a', meaning: 'drawn once, uniformly, from the odd residues' }] },
          { label: 'Tabulation', expr: 'h(x) = T₀[x₀] ⊕ T₁[x₁] ⊕ T₂[x₂] ⊕ T₃[x₃]',
            terms: [{ sym: 'T_i', meaning: '256 random words each: 4 KB of secret state' }] },
          { label: 'Flooding cost', expr: 'k colliding keys ⇒ k(k+1)/2 comparisons to insert',
            terms: [{ sym: 'k = 2 000', meaning: '2 001 000 comparisons for one request' }] }
        ],
        derivation: [
          'The bound is over the choice of h, so it holds for adversarial key pairs — the attacker ' +
            'must beat the function, and they do not know which one it is.',
          'Tabulation is 3-independent, which is enough for linear probing to keep its expected bounds ' +
            'even against a chosen key set.'
        ]
      },
      invariants: [
        { name: 'The seed is per process and never leaves it', why: 'A leaked or persisted seed restores the attacker\'s precomputation.', breaks: 'Caching hashes in Redis, on disk, or in a shared cache.' },
        { name: 'Iteration order is not part of the contract', why: 'It follows from the seed, which changes each run.', breaks: 'Any code that depends on map order — and it will only fail sometimes.' },
        { name: 'Universality is about pairs, not about the whole set', why: 'It bounds the expected chain length, not the maximum.', breaks: 'It does not make the longest bucket O(1); treeification handles that.' }
      ],
      complexity: [
        { operation: 'Multiply-shift', average: 'Θ(1), two instructions', worst: 'Θ(1)', note: 'Universal for fixed-width keys' },
        { operation: 'Tabulation', average: 'Θ(bytes), 4 lookups', worst: 'Θ(bytes)', note: '3-independent, 4 KB of state' },
        { operation: 'SipHash-2-4', average: 'Θ(len), ~1 cycle/byte', worst: 'Θ(len)', note: 'Keyed PRF, not just universal' },
        { operation: 'Flooded chained table', average: 'Θ(1) per op', worst: 'Θ(n) per op, Θ(n²) total', note: 'The attack' }
      ],
      failureModes: [
        { symptom: 'One request pins a CPU core', cause: 'Hash flooding through a parameter map or a JSON object.', fix: 'Keyed hash with a per-process seed; cap the parameter count.' },
        { symptom: 'The attack works again after a deploy', cause: 'Seed derived from something stable — a config value, a hostname, time-of-build.', fix: 'Draw it from a CSPRNG at start-up.' },
        { symptom: 'Tests fail intermittently on map order', cause: 'The seed differs per run, deliberately.', fix: 'Sort before comparing; never assert on map order.' },
        { symptom: 'A keyed hash did not help', cause: 'The collision happens after the hash, in a fixed-size bucket index derived elsewhere.', fix: 'Check the whole path from key to bucket.' }
      ],
      inTheWild: [
        { system: 'Python, since 3.3', how: 'SipHash with PYTHONHASHSEED, randomised by default' },
        { system: 'Rust HashMap', how: 'SipHash-1-3 with a per-instance random key' },
        { system: 'Java 8+ HashMap', how: 'Kept its weak hash and added treeification instead' }
      ],
      sources: [CROSBY, { title: 'SipHash: a fast short-input PRF', where: 'Aumasson, Bernstein, 2012' },
        { title: 'Universal classes of hash functions', where: 'Carter, Wegman, 1979' }]
    },

    'separate-chaining': {
      summary: 'A bucket array with a list per bucket: easy to reason about, tolerant of load factors ' +
        'above 1, and reliant on treeification for its worst case.',
      intuition: 'The mean chain length is exactly α and is easy to control. The interesting quantity ' +
        'is the *longest* chain, which is a Poisson tail — five or six at α = 1, not one — and under ' +
        'chosen keys is n.',
      formulation: {
        equations: [
          { label: 'Load factor', expr: 'α = n / m, unbounded above',
            terms: [{ sym: 'α > 1', meaning: 'legal for chaining, impossible for open addressing' }] },
          { label: 'Occupancy', expr: 'P(bucket has k keys) = e^-α α^k / k!',
            terms: [{ sym: 'k = 0', meaning: 'e^-α: 37% of buckets empty at α = 1' }] },
          { label: 'Lookup', expr: '1 + α/2 comparisons for a hit, α for a miss',
            terms: [{ sym: '1', meaning: 'the bucket dereference itself' }] },
          { label: 'Longest chain', expr: 'Θ(ln m / ln ln m) at α = 1',
            terms: [{ sym: 'm = 1 000', meaning: 'about 5 or 6 in practice' }] }
        ],
        derivation: [
          'Keys land independently and uniformly, so the count per bucket is Binomial(n, 1/m), which ' +
            'converges to Poisson(α).',
          'Treeification changes the worst bucket from Θ(k) to Θ(log k) without touching the hash, ' +
            'which is why it is a mitigation rather than an optimisation.'
        ]
      },
      invariants: [
        { name: 'A key appears in exactly one bucket', why: 'The bucket index is a function of the key.', breaks: 'If the key is mutated after insertion.' },
        { name: 'Load factor may exceed 1', why: 'Buckets are lists; there is no capacity to exhaust.', breaks: 'Never — this is chaining\'s structural advantage.' },
        { name: 'Iteration is Θ(m + n)', why: 'Every bucket must be visited, empty or not.', breaks: 'A table that grew and emptied still costs Θ(m).' }
      ],
      complexity: [
        { operation: 'Lookup', average: 'Θ(1 + α)', worst: 'Θ(n), or Θ(log n) treeified', note: 'The worst case is the security story' },
        { operation: 'Insert', average: 'Θ(1)', worst: 'Θ(n) on resize', note: 'Prepend to the bucket' },
        { operation: 'Delete', average: 'Θ(1 + α)', worst: 'Θ(n)', note: 'No tombstones needed' },
        { operation: 'Space', average: 'Θ(m + n)', worst: 'same', note: '~32 bytes per entry with a real allocator' }
      ],
      failureModes: [
        { symptom: 'One bucket holds everything', cause: 'A weak or attacker-known hash.', fix: 'Keyed hash; treeify as a backstop.' },
        { symptom: 'Memory far above the data size', cause: 'A node with an allocator header per entry.', fix: 'Open addressing, or an intrusive/arena-allocated node.' },
        { symptom: 'Iteration is slow on a nearly empty table', cause: 'Θ(m) buckets to walk.', fix: 'Shrink on removal, or keep a separate entry list (3.9).' },
        { symptom: 'Treeification never triggers under attack', cause: 'Real implementations also require a minimum table size before treeifying.', fix: 'Know your implementation\'s exact rule.' }
      ],
      inTheWild: [
        { system: 'Java HashMap', how: 'Chaining, treeified at 8 entries when the table has ≥ 64 buckets' },
        { system: 'CPython dicts (pre-3.6 design)', how: 'Open addressing, not chaining — a common misconception' },
        { system: 'Most textbook implementations', how: 'Chaining, because it is the easy one to prove things about' }
      ],
      sources: [CLRS, CROSBY, { title: 'JEP: HashMap improvements', where: 'OpenJDK 8 release notes' }]
    },

    'open-addressing': {
      summary: 'Entries live in the slot array itself: no nodes, excellent locality, a hard ceiling at ' +
        'α = 1, and a deletion problem with two answers.',
      intuition: 'Everything good about open addressing comes from the entries being contiguous, and ' +
        'everything hard about it comes from the fact that a probe sequence is a path — you cannot ' +
        'remove a stone from the middle of a path without breaking it.',
      formulation: {
        equations: [
          { label: 'Probe sequences', expr: 'linear h+i · quadratic h+i(i+1)/2 · double h₁+i·h₂',
            terms: [{ sym: 'h₂ odd', meaning: 'required for double hashing to cover every slot' }] },
          { label: 'Successful search', expr: '½(1 + 1/(1−α)) probes',
            terms: [{ sym: 'α = 0.7', meaning: '2.17 probes' }, { sym: 'α = 0.9', meaning: '5.5 probes' }] },
          { label: 'Unsuccessful search', expr: '½(1 + 1/(1−α)²) probes',
            terms: [{ sym: 'α = 0.9', meaning: '50.5 probes — this is the one that hurts' }] },
          { label: 'Occupancy', expr: 'grow when (live + tombstones) / m > maxLoad',
            terms: [{ sym: 'not live/m', meaning: 'counting only live entries lets a table degrade forever' }] }
        ],
        derivation: [
          'A miss must continue until it meets an EMPTY slot, so tombstones lengthen it without ' +
            'bound; once no EMPTY slot remains, every miss scans the table.',
          'Backward-shift deletion restores the invariant directly: an entry may move back into the ' +
            'hole exactly when the hole is at or after its home slot.'
        ]
      },
      invariants: [
        { name: 'A probe sequence visits every slot', why: 'Otherwise an insert can fail while the table has room.', breaks: 'Quadratic probing with a bad modulus; double hashing with an even h₂.' },
        { name: 'No EMPTY slot inside a live probe sequence', why: 'An EMPTY slot terminates the search.', breaks: 'Deleting by clearing a slot — the classic bug tombstones exist to prevent.' },
        { name: 'α < 1 always', why: 'There is nowhere to put the n+1-th entry.', breaks: 'Never, structurally.' }
      ],
      complexity: [
        { operation: 'Lookup (hit)', average: '½(1 + 1/(1−α))', worst: 'Θ(m)', note: '2.2 probes at α = 0.7' },
        { operation: 'Lookup (miss)', average: '½(1 + 1/(1−α)²)', worst: 'Θ(m)', note: 'Θ(m) once tombstones fill the table' },
        { operation: 'Delete, tombstone', average: 'Θ(1)', worst: 'Θ(m)', note: 'Cheap now, expensive later' },
        { operation: 'Delete, backward shift', average: 'Θ(cluster)', worst: 'Θ(m)', note: 'Linear probing only; no lasting damage' }
      ],
      failureModes: [
        { symptom: 'Lookups slow down with no change in size or load factor', cause: 'Tombstone accumulation.', fix: 'Count tombstones toward the growth trigger; or backward-shift deletion.' },
        { symptom: 'Insert fails in a table with free slots', cause: 'A probe sequence that does not cover the table.', fix: 'Power-of-two size with the triangular quadratic form, or a proper double hash.' },
        { symptom: 'Sudden cliff in throughput near capacity', cause: 'The 1/(1−α)² term for misses.', fix: 'Grow at 0.7-0.875, and never run near 1.' },
        { symptom: 'Deleting in a loop is quadratic', cause: 'Backward shift over one long cluster, repeatedly.', fix: 'Bulk-delete then rebuild, or accept tombstones plus a scheduled rehash.' }
      ],
      inTheWild: [
        { system: 'CPython dict', how: 'Open addressing with a perturbation-based probe sequence' },
        { system: 'Rust std HashMap', how: 'Swiss-table open addressing (hashbrown)' },
        { system: 'Boost unordered_flat_map', how: 'Open addressing with backward-shift-style deletion' }
      ],
      sources: [CLRS, { title: 'Robin Hood hashing', where: 'Celis, 1986' }, ABSEIL]
    },

    'robin-hood': {
      summary: 'Three ways to bound the worst probe: redistribute displacement (Robin Hood), cap it ' +
        'structurally (hopscotch), or fix it at two (cuckoo).',
      intuition: 'The mean displacement is decided by the load factor and cannot be improved by any ' +
        'placement policy — the entries have to go somewhere. What a policy can change is who bears ' +
        'the cost, and that is what a p99 measures.',
      formulation: {
        equations: [
          { label: 'Robin Hood rule', expr: 'on collision, swap if d(carry) > d(resident)',
            terms: [{ sym: 'd', meaning: 'distance from the home slot' }] },
          { label: 'Variance, measured', expr: 'linear 68.8 → Robin Hood 9.2 at α = 0.85',
            terms: [{ sym: 'mean', meaning: '2.88 for both — unchanged, as it must be' }] },
          { label: 'Hopscotch bound', expr: 'every key within H slots of home',
            terms: [{ sym: 'H too small', meaning: 'insertion fails and the table must grow' }] },
          { label: 'Cuckoo', expr: 'x ∈ {T₁[h₁(x)], T₂[h₂(x)]}; 2 tables cap out near α = 0.5',
            terms: [{ sym: 'd tables', meaning: 'raise the threshold: 3 tables reach ~0.91' }] }
        ],
        derivation: [
          'Total displacement is a property of the key-to-slot assignment, so any policy that does ' +
            'not change which slots are occupied cannot change the mean.',
          'The Robin Hood invariant — distance never decreases along a probe sequence — lets a lookup ' +
            'stop as soon as it meets an entry closer to home than it has travelled.'
        ]
      },
      invariants: [
        { name: 'Robin Hood: distance is monotone along a cluster', why: 'It is what makes early termination correct.', breaks: 'If deletion leaves a hole instead of shifting back.' },
        { name: 'Hopscotch: d(k) < H for every key', why: 'The bound is the guarantee.', breaks: 'When no empty slot can be dragged into range — the table must grow.' },
        { name: 'Cuckoo: exactly two candidate slots', why: 'Lookup is two probes, worst case.', breaks: 'Never for lookup; insertion is where the cost went.' }
      ],
      complexity: [
        { operation: 'Robin Hood lookup', average: 'Θ(1), low variance', worst: 'Θ(cluster)', note: 'p99 14 against 44 at α = 0.85' },
        { operation: 'Robin Hood insert', average: 'Θ(1) plus displacements', worst: 'Θ(cluster)', note: 'More writes than plain linear probing' },
        { operation: 'Hopscotch lookup', average: 'Θ(1), reads H slots', worst: 'Θ(H)', note: 'A hard bound, if insertion succeeded' },
        { operation: 'Cuckoo lookup', average: '2 probes', worst: '2 probes', note: 'The only true worst-case guarantee here' },
        { operation: 'Cuckoo insert', average: 'Θ(1) amortised', worst: 'Θ(n) on a rebuild', note: 'Cycles force a full rehash' }
      ],
      failureModes: [
        { symptom: 'Robin Hood is not faster on average', cause: 'It was never supposed to be.', fix: 'Measure the p99, which is what it improves.' },
        { symptom: 'Hopscotch insertions start failing', cause: 'Load too high for the chosen H.', fix: 'Raise H, or grow earlier — both cost memory.' },
        { symptom: 'Cuckoo insertion loops forever', cause: 'An eviction cycle.', fix: 'A kick limit plus rebuild with new seeds; expect it above ~0.5 with two tables.' },
        { symptom: 'Robin Hood deletion corrupts lookups', cause: 'A tombstone or hole broke the monotone invariant.', fix: 'Shift subsequent displaced entries back on delete.' }
      ],
      inTheWild: [
        { system: 'Rust hashbrown (before Swiss)', how: 'Robin Hood with backward-shift deletion' },
        { system: 'Cuckoo filters and cuckoo caches', how: 'The two-slot guarantee is what makes them bounded' },
        { system: 'Java ConcurrentHashMap', how: 'Chaining plus treeify rather than any of these' }
      ],
      sources: [{ title: 'Robin Hood hashing', where: 'Celis, 1986' },
        { title: 'Cuckoo hashing', where: 'Pagh, Rodler, 2001' },
        { title: 'Hopscotch hashing', where: 'Herlihy, Shavit, Tzafrir, 2008' }]
    },

    'swiss-tables': {
      summary: 'Store one metadata byte per slot in its own array and probe sixteen at a time; the ' +
        'expensive key comparison then happens about once per lookup even at 85% load.',
      intuition: 'The design separates "which slots could hold this key" from "which slot does". The ' +
        'first question is answered from a tiny contiguous array that stays in cache; only the ' +
        'answers that survive touch the large slot array.',
      formulation: {
        equations: [
          { label: 'Hash split', expr: 'H1 = h >> 7 (group), H2 = h & 0x7F (tag)',
            terms: [{ sym: 'H2', meaning: 'stored in the control byte; 0x80 is EMPTY, 0xFE is DELETED' }] },
          { label: 'Group match', expr: 'mask = movemask(cmpeq(ctrl[g..g+16], tag))',
            terms: [{ sym: '16', meaning: 'one SSE2 register; a byte loop in JavaScript' }] },
          { label: 'Groups per lookup', expr: '≈ 1 / (1 − α^16)',
            terms: [{ sym: 'α = 0.85', meaning: '1/(1 − 0.074) = 1.08' }] },
          { label: 'False tag match', expr: '1/128 per occupied slot examined',
            terms: [{ sym: 'cost', meaning: 'one real key comparison' }] }
        ],
        derivation: [
          'A group is skipped only when all 16 of its slots are occupied by other keys, which has ' +
            'probability about α^16 — 7.4% at α = 0.85, which is why 7/8 is a workable growth point.',
          'The control array is one byte per slot, so a 2 048-slot table has a 2 KB control array that ' +
            'stays resident; a 64-byte line covers the metadata for 64 slots.'
        ]
      },
      invariants: [
        { name: 'A group probe stops at the first EMPTY', why: 'EMPTY proves the key was never inserted past here.', breaks: 'DELETED does not stop it — that is the difference between the two markers.' },
        { name: 'Control byte and slot agree', why: 'A tag is derived from the same hash as the key in that slot.', breaks: 'If the two arrays are updated non-atomically under concurrency.' },
        { name: 'Only matched lanes read keys', why: 'That is the whole saving.', breaks: 'Never — and it is why a good H2 distribution matters.' }
      ],
      complexity: [
        { operation: 'Lookup', average: '≈1.08 groups, ≈1.06 key comparisons at α = 0.85', worst: 'Θ(groups)', note: 'One fetch of metadata covers 64 slots' },
        { operation: 'Insert', average: 'Θ(1)', worst: 'Θ(n) on resize', note: 'Grows at 7/8' },
        { operation: 'Delete', average: 'Θ(1)', worst: 'Θ(1)', note: 'Writes DELETED, or EMPTY if the group has room' },
        { operation: 'Space', average: 'slots + 1 byte each', worst: 'same', note: 'The metadata is ~3% overhead on 32-byte entries' }
      ],
      failureModes: [
        { symptom: 'No speed-up over plain open addressing', cause: 'Table small enough to fit in cache anyway, or no vector compare available.', fix: 'Expect the win at scale; in JavaScript expect the structure, not the speed.' },
        { symptom: 'Group probes climb past 1.2', cause: 'Load above 7/8, or many DELETED bytes.', fix: 'Grow, or convert DELETED to EMPTY when the group has a free slot.' },
        { symptom: 'Extra key comparisons', cause: '7-bit tag collisions, or a hash whose low bits are poor.', fix: 'Check the hash: H2 is the low 7 bits and needs real entropy.' },
        { symptom: 'Iteration order changes between runs', cause: 'It is unspecified, by design.', fix: 'Do not depend on it.' }
      ],
      inTheWild: [
        { system: 'Abseil flat_hash_map', how: 'The original design' },
        { system: 'Rust std HashMap', how: 'hashbrown, a Swiss-table port' },
        { system: 'Folly F14', how: 'Same idea with 14-slot chunks and a different tag layout' }
      ],
      sources: [ABSEIL, { title: 'Designing a fast, efficient, cache-friendly hash table', where: 'Kulukundis, CppCon 2017' }, { title: 'abseil raw_hash_set — the reference implementation', where: 'github.com/abseil/abseil-cpp' }]
    },

    rehashing: {
      summary: 'Growing a table is O(n) work in one call. Amortised analysis says that is fine; a ' +
        'latency budget says it is not, and incremental migration is the reconciliation.',
      intuition: 'Every entry\'s slot depends on the capacity, so changing the capacity moves ' +
        'everything. The only questions are when you pay for it and whether you pay it all at once.',
      formulation: {
        equations: [
          { label: 'Growth', expr: 'capacity ← 2·capacity when (live + tombstones)/m > maxLoad',
            terms: [{ sym: 'maxLoad', meaning: '0.7 for plain open addressing, 0.875 for Swiss' }] },
          { label: 'Amortised cost', expr: 'total moves = n + n/2 + n/4 + … < 2n',
            terms: [{ sym: 'per insert', meaning: 'O(1) — and this is the misleading number' }] },
          { label: 'Worst single op', expr: 'Θ(n) — measured 14 567 slot writes for 20 000 inserts',
            terms: [{ sym: 'that call', meaning: 'is your p99.9' }] },
          { label: 'Incremental', expr: 'move k buckets per operation; migration lasts m/k operations',
            terms: [{ sym: 'k = 4', meaning: 'peak 96 instead of 14 567, at 1.61× total work' }] }
        ],
        derivation: [
          'The geometric series bounds total work, which is why the amortised claim is true.',
          'Spreading the same work over m/k operations bounds the per-operation cost at roughly ' +
            'k probes plus the ordinary operation, at the price of both tables being live.'
        ]
      },
      invariants: [
        { name: 'Every key is findable at every instant', why: 'A migration is not a maintenance window.', breaks: 'If a lookup checks only the new table while entries remain in the old.' },
        { name: 'Writes go to the new table only', why: 'Otherwise the old table never drains.', breaks: 'Updating an entry still in the old table in place — allowed, but it must not create new ones there.' },
        { name: 'Iterators do not survive a resize', why: 'Entries moved.', breaks: 'Every language documents this; most detect it and throw.' }
      ],
      complexity: [
        { operation: 'Insert, synchronous', average: 'Θ(1) amortised', worst: 'Θ(n)', note: 'Median 2, worst 14 567 in the demo' },
        { operation: 'Insert, incremental', average: 'Θ(1 + k)', worst: 'Θ(k)', note: 'Median 3, worst 96' },
        { operation: 'Lookup during migration', average: 'Θ(1), two tables', worst: 'Θ(1)', note: 'Check old, then new' },
        { operation: 'Peak memory', average: 'Θ(m)', worst: 'Θ(3m) during migration', note: 'The price of the flat tail' }
      ],
      failureModes: [
        { symptom: 'Millisecond outliers with no slow code path', cause: 'A map resized.', fix: 'Pre-size it, or migrate incrementally.' },
        { symptom: 'Memory doubles and stays there', cause: 'A migration that never completes because the table is idle.', fix: 'Also migrate on read, or on a timer.' },
        { symptom: 'The table grows forever', cause: 'Growth triggered by tombstones that a rehash would have removed.', fix: 'Rehash in place at the same capacity when tombstones dominate.' },
        { symptom: 'Concurrent iteration returns duplicates', cause: 'An entry seen in both tables during migration.', fix: 'Iterate the old table only up to the cursor.' }
      ],
      inTheWild: [
        { system: 'Redis', how: 'ht[0]/ht[1] with a rehash cursor, migrating on every command' },
        { system: 'Go maps', how: 'Incremental evacuation, a bucket or two per write' },
        { system: 'Java HashMap', how: 'Synchronous — which is why sizing the constructor matters' }
      ],
      sources: [CLRS, { title: 'Redis dict.c', where: 'Redis source' },
        { title: 'Amortized computational complexity', where: 'Tarjan, 1985' }]
    },

    'perfect-hashing': {
      summary: 'When the key set is fixed at build time, collisions can be eliminated rather than ' +
        'managed: one probe, no comparison chain, and — for a minimal perfect hash — no empty slots.',
      intuition: 'A hash table spends memory on empty slots and time on collision handling so it can ' +
        'accept keys it has not seen. If it will never see one, both are pure waste, and the search ' +
        'for a collision-free function can happen once, offline.',
      formulation: {
        equations: [
          { label: 'FKS', expr: 'level 1: n buckets; a bucket of b keys gets b² slots',
            terms: [{ sym: 'E[Σ b²]', meaning: '< 2n, so total space is under 3n' }] },
          { label: 'Birthday bound', expr: 'b keys in b² slots collide with probability < ½',
            terms: [{ sym: 'retry', meaning: 'a new seed succeeds in ~2 attempts' }] },
          { label: 'Hash and displace', expr: 'slot(x) = h(x, d_{bucket(x)}) mod n',
            terms: [{ sym: 'd', meaning: 'the only thing stored: one displacement per bucket' }] },
          { label: 'Space', expr: 'bits per key = r·⌈log₂ max d⌉ / n',
            terms: [{ sym: 'measured', meaning: '3.00 bits/key at λ = 4; published CHD reaches ~2.1' }] }
        ],
        derivation: [
          'Σ b² counts ordered pairs landing in the same bucket, whose expectation is n + n(n−1)/n < 2n.',
          'Placing the largest buckets first is what makes the displacement search converge: crowded ' +
            'buckets need a mostly empty table.'
        ]
      },
      invariants: [
        { name: 'The key set is closed', why: 'The function is only injective on the set it was built for.', breaks: 'A key outside the set maps somewhere — silently, unless you store and check keys.' },
        { name: 'Every lookup is exactly one probe', why: 'There is no collision to resolve.', breaks: 'FKS needs two array reads: level 1 then level 2.' },
        { name: 'A minimal perfect hash fills [0, n) exactly', why: 'Bijective by construction.', breaks: 'Non-minimal perfect hashes leave holes and use more space.' }
      ],
      complexity: [
        { operation: 'FKS lookup', average: 'Θ(1)', worst: 'Θ(1)', note: 'Two reads, guaranteed' },
        { operation: 'FKS space', average: '≈3n slots', worst: 'Θ(n) expected', note: 'Measured 2.99 slots/key for 500 keys' },
        { operation: 'CHD lookup', average: 'Θ(1)', worst: 'Θ(1)', note: 'One displacement read plus one hash' },
        { operation: 'CHD space', average: '~2-3 bits/key', worst: 'same', note: 'No keys stored at all' },
        { operation: 'Construction', average: 'Θ(n) expected', worst: 'unbounded retries', note: '22 080 trials for 500 keys here' }
      ],
      failureModes: [
        { symptom: 'A lookup for an unknown key returns a valid-looking index', cause: 'Perfect hashing says nothing about non-members.', fix: 'Store the keys and verify, or guarantee membership upstream.' },
        { symptom: 'Construction hangs', cause: 'Displacement search on the last buckets with a nearly full table.', fix: 'Place largest buckets first; lower λ; try a new base seed.' },
        { symptom: 'Bits per key much worse than published', cause: 'A naive displacement encoding.', fix: 'Compress the displacement array — the C in CHD.' },
        { symptom: 'Rebuilding on every deploy is slow', cause: 'Construction at start-up rather than build time.', fix: 'Generate the tables as source or data at build time.' }
      ],
      inTheWild: [
        { system: 'gperf', how: 'Generates perfect hashes for compiler keyword tables' },
        { system: 'CMPH, BBHash', how: 'Minimal perfect hashing for very large static key sets' },
        { system: 'On-disk indexes', how: 'MPH avoids storing keys, which dominates the index size' }
      ],
      sources: [{ title: 'Storing a sparse table with O(1) worst case access', where: 'Fredman, Komlós, Szemerédi, 1984' },
        { title: 'Hash, displace, and compress', where: 'Belazzougui, Botelho, Dietzfelbinger, 2009' },
        { title: 'Practical minimal perfect hash functions for large databases', where: 'Fox, Chen, Heath, CACM 1992' }]
    },

    'hash-in-practice': {
      summary: 'Two maps in the language, several in this milestone, and a choice that depends on the ' +
        'workload rather than on a benchmark someone else ran.',
      intuition: 'Almost every real decision here is made by one of four questions: is the key set ' +
        'fixed, is the input untrusted, is the workload delete-heavy, and does anything depend on ' +
        'order. The performance differences between good implementations are smaller than the ' +
        'difference those four answers make.',
      formulation: {
        equations: [
          { label: 'Object keys', expr: 'obj[k] uses String(k)',
            terms: [{ sym: 'consequence', meaning: 'obj[1] and obj["1"] are one key; every object key is "[object Object]"' }] },
          { label: 'Map keys', expr: 'SameValueZero',
            terms: [{ sym: 'NaN', meaning: 'usable as a key' }, { sym: '-0 and 0', meaning: 'the same key' }] },
          { label: 'Ordered map with O(1) delete', expr: 'entries[] with holes + Map<key, position>',
            terms: [{ sym: 'compaction', meaning: 'when holes > half the array' }] },
          { label: 'Growth without compaction', expr: 'slots = live + deletes',
            terms: [{ sym: 'measured', meaning: '41 000 slots for 1 000 entries after 40 000 deletes' }] }
        ],
        derivation: [
          'Splicing an entries array on delete would be O(n); punching a hole is O(1) and moves the ' +
            'cost to a periodic O(n) compaction, which amortises to one move per delete.',
          'V8 keeps objects in a hidden class describing a fixed shape; deleting a property forces a ' +
            'dictionary representation, and the object does not go back.'
        ]
      },
      invariants: [
        { name: 'Map preserves insertion order', why: 'It is specified, not incidental.', breaks: 'Never for Map; plain objects order integer-like keys numerically first.' },
        { name: 'A key must not mutate while in the map', why: 'Its hash and its slot were computed from it.', breaks: 'Using a mutable array or object as a Map key and then changing it — the entry is unreachable but still present.' },
        { name: 'WeakMap entries vanish with their keys', why: 'Keys are held weakly.', breaks: 'Not iterable and not enumerable, by design.' }
      ],
      complexity: [
        { operation: 'Map get/set/delete', average: 'Θ(1)', worst: 'Θ(n) on resize', note: 'Insertion-ordered' },
        { operation: 'Object property, fast mode', average: 'Θ(1), inline-cached', worst: 'Θ(1)', note: 'Until the first delete' },
        { operation: 'Object property, dictionary mode', average: 'Θ(1) hash lookup', worst: 'Θ(1)', note: 'No inline caching; permanent' },
        { operation: 'Ordered map delete', average: 'Θ(1) amortised', worst: 'Θ(n) on compaction', note: 'One move per delete, amortised' }
      ],
      failureModes: [
        { symptom: 'An object-as-map got slow after adding deletes', cause: 'Dictionary-mode transition.', fix: 'Use Map. It is what it is for.' },
        { symptom: 'Two different keys overwrite each other', cause: 'Object key coercion to a string.', fix: 'Map, or an explicit key-encoding function.' },
        { symptom: 'Memory grows in a long-lived map with steady size', cause: 'An entries array full of holes, or a cache with no eviction.', fix: 'Compaction, or a bounded cache.' },
        { symptom: 'A Map entry cannot be found or removed', cause: 'The key object was mutated, or a structurally-equal but distinct object is being used.', fix: 'Key by a stable primitive, or keep the original reference.' },
        { symptom: 'A benchmark ranks differently in production', cause: 'Timing measures one machine and workload; probes measure the scheme.', fix: 'Report both, with the run count.' }
      ],
      inTheWild: [
        { system: 'V8 Map', how: 'An ordered hash table: entries array plus index, compacted on demand' },
        { system: 'V8 objects', how: 'Hidden classes with inline caches; delete forces dictionary mode' },
        { system: 'Python dicts (3.7+)', how: 'Compact, insertion-ordered — the same entries-array design' }
      ],
      sources: [{ title: 'ECMAScript specification, Map objects', where: 'ECMA-262' },
        { title: 'Fast properties in V8', where: 'V8 blog' }, ABSEIL]
    }
  });
}(typeof window !== 'undefined' ? window : null));

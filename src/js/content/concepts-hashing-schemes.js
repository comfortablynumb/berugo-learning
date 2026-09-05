/**
 * Concepts for the hash-table scheme sections (M03.5-M03.9): Robin Hood and
 * friends, Swiss tables, rehashing, perfect hashing, and hashing in practice.
 *
 * Split from concepts-hashing.js only for size: one file for the whole
 * milestone runs past the 1 000-line limit once every concept carries its
 * explanation.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'robin-hood': [
      {
        term: 'Probe distance',
        plain: 'How far a key sits from its home slot. The mean is fixed by the load factor; the spread is not.',
        formal: 'd(k) = (slot − home) mod m',
        readAs: 'A key\'s displacement is how far it sits from the slot it wanted, counted forward and ' +
          'wrapping round the end of the table. Zero means it got its first choice.',
        detail: [
          'Probe distance is the per-key version of the load-factor arithmetic, and it is the ' +
            'right thing to look at, because the mean is not the interesting part.',
          'At a given load factor the average distance is essentially fixed — the keys have to go ' +
            'somewhere. So every scheme in this section has the same mean, and they differ ' +
            'entirely in the shape of the distribution.',
          'Two tables at α = 0.85 can share a mean of 3 and differ by a factor of ten in the worst ' +
            'case. The worst case is what a p99 latency measures.',
          'Plot the histogram, not the average.'
        ],
        example: 'Two schemes at α = 0.85 can share a mean of 3 and differ 10× in the worst case.'
      },
      {
        term: 'Robin Hood displacement',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["inserting a key that has<br/>travelled 1 slot from home"] --> B{"the key sitting there<br/>travelled 4"}',
            '    B --> C["the richer key gives up the slot<br/>to the poorer one"]',
            '    C --> D["the displaced key carries on probing"]',
            '    D --> E["the spread of probe distances<br/>collapses toward the mean"]'
          ].join('\n'),
          caption: 'The mean probe distance is fixed by the load factor and cannot be improved. What this removes is the variance — the unlucky key that probed forty times.'
        },
        plain: 'On insertion, a key that has travelled further takes the slot from one that has travelled less.',
        formal: 'swap if d(carry) > d(resident)',
        detail: [
          'Ordinary linear probing is first-come-first-served, so an unlucky key inserted late can ' +
            'end up very far from home while a lucky early one sits in its home slot.',
          'Robin Hood insertion evens this out. When the key being carried has travelled further ' +
            'than the resident of the slot it is examining, the two swap and the resident ' +
            'continues the probe.',
          'The rich give to the poor, the total displacement is unchanged, and the variance ' +
            'collapses.',
          'Nothing about the average improves. This is a redistribution, and the whole benefit is ' +
            'in the tail.'
        ],
        example: 'Rich entries give to poor ones — hence the name.'
      },
      {
        term: 'The monotone invariant',
        plain: 'Along a probe sequence, distance from home never decreases — so a lookup can stop early.',
        formal: 'd(slot i) ≥ d(slot i−1) − 1 within a cluster',
        readAs: 'Walking forward through a cluster, each slot\'s displacement can drop by at most one from ' +
          'the slot before it. That single guarantee is what lets a lookup stop early: once the ' +
          'displacement falls below yours, your key cannot be further along.',
        detail: [
          'The swap rule has a consequence that is easy to miss and is the real payoff: entries ' +
            'end up ordered by probe distance along the run.',
          'So a lookup that reaches a slot whose resident is closer to home than the searched key ' +
            'has travelled can stop immediately. If the key were present it would have displaced ' +
            'that resident on the way in.',
          'That turns an unsuccessful lookup from a walk to the end of the run into an early exit. ' +
            'It is the operation open addressing is otherwise worst at, and it costs nothing to ' +
            'check.'
        ],
        example: 'Meeting a closer-to-home entry proves the key is absent.'
      },
      {
        term: 'Hopscotch neighbourhood',
        plain: 'Every key is guaranteed to live within H slots of home, so a lookup reads one window.',
        formal: 'd(k) < H, typically H = 8..32',
        readAs: 'Every key is guaranteed to sit within H slots of its home, where H is a small fixed ' +
          'neighbourhood size. That bound is what makes a lookup a single cache line rather than an ' +
          'open-ended walk.',
        detail: [
          'Hopscotch hashing enforces a hard bound rather than merely improving the distribution. ' +
            'Every key lives within H slots of its home, and insertion maintains that by moving ' +
            'other keys — hopping a free slot backwards toward the home — until it holds.',
          'A lookup then reads exactly one window of H slots. With H chosen to make the window one ' +
            'cache line, it is one fetch and a bitmask test.',
          'The cost is on the insert side. Maintaining the bound can require a chain of ' +
            'relocations and, at high load, a resize when no free slot can be hopped close enough.'
        ],
        example: 'Choose H so the window is one cache line and a lookup is one fetch.'
      },
      {
        term: 'Cuckoo hashing',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["a key has exactly two homes,<br/>one per table"] --> B["lookup reads both:<br/>two probes, worst case, always"]',
            '    A --> C["insert: if both are taken,<br/>evict one and re-home it"]',
            '    C --> D["that eviction may evict another"]',
            '    D --> C'
          ].join('\n'),
          caption: 'Lookup gets a hard worst-case bound of two probes, which nothing else here offers. Insertion pays for it, and can fail outright and need a full rebuild.'
        },
        plain: 'Two tables, two hashes, and a key lives in one of exactly two slots. Lookup is two probes, always.',
        formal: 'x ∈ {T₁[h₁(x)], T₂[h₂(x)]}',
        readAs: 'A key is in one of exactly two places: the slot its first hash names in the first table, or ' +
          'the slot its second hash names in the second. A lookup is therefore always two probes and ' +
          'never more.',
        detail: [
          'Cuckoo hashing gives every key exactly two possible homes, one in each table, so a ' +
            'lookup checks two slots and stops. That is a true worst-case O(1) guarantee, which no ' +
            'other scheme in this section provides.',
          'The two probes are independent, so they can be issued in parallel, and a negative ' +
            'lookup costs the same as a positive one.',
          'All of the difficulty moves to insertion. If both slots are taken, the new key evicts ' +
            'one of the residents, which must then move to its alternative slot, which may evict ' +
            'another.'
        ],
        example: 'Worst-case O(1) lookup — the only scheme here that guarantees it.'
      },
      {
        term: 'Eviction cycle',
        plain: 'A cuckoo insertion can displace a key that displaces another, forever. The only repair is a rebuild.',
        formal: 'kick limit ⇒ rehash with new seeds',
        readAs: 'When the eviction chain runs too long, there is no repair available — the table has to be ' +
          'rebuilt with different hash seeds. The ⇒ is "which means".',
        detail: [
          'An eviction chain can close into a cycle, in which every slot involved is occupied by a ' +
            'key whose alternative is also in the cycle. No amount of further kicking resolves it.',
          'Implementations detect this with a kick limit, and respond by rehashing the whole table ' +
            'with new seeds.',
          'The probability of a cycle depends sharply on load. Two tables become unworkable above ' +
            'roughly 50% occupancy, while three or four hash functions push the threshold past ' +
            '90%.',
          'So cuckoo hashing buys its worst-case lookup with a worst-case insert and a load ' +
            'ceiling.'
        ],
        example: 'Two tables stop working above about 50% load; d tables push it higher.'
      },
      {
        term: 'Write amplification',
        plain: 'Robin Hood makes exactly the same probes as linear probing and more writes. That is the price of the shorter tail.',
        formal: 'writes = 1 + displacements per insert',
        detail: [
          'Robin Hood visits exactly the same slots as plain linear probing. The swap rule changes ' +
            'who ends up where, not how far the insertion walks.',
          'So the probe count is identical and the extra cost is entirely in writes. At α = 0.85, ' +
            '1 740 inserts make the same 6 757 probes and 2.46 writes each instead of 1.',
          'That is the honest accounting of the trade.',
          'On a read-heavy workload it is an excellent bargain. On an insert-heavy one, or where ' +
            'writes are expensive because of cache coherence traffic, it is a cost to weigh rather ' +
            'than a free improvement.'
        ],
        example: '1 740 inserts at α = 0.85: the same 6 757 probes, and 2.46 writes each instead of 1.'
      },
      {
        term: 'No tombstones allowed',
        plain: 'A tombstone would break the monotone-distance invariant, so deletion pulls the following displaced run back one slot instead.',
        formal: 'shift while distance(cursor) > 0',
        detail: [
          'The early-exit rule depends on distances being non-decreasing along a run, and a ' +
            'tombstone is a slot with no distance at all.',
          'It would break the ordering, and silently make lookups return "absent" for keys that ' +
            'are present.',
          'So Robin Hood deletion has to repair the run. Shift each following entry back one slot ' +
            'while its distance is greater than zero, stopping at the first entry already at home.',
          'It is the same loop as backward-shift deletion in the open-addressing section, ' +
            'justified by the same argument about contiguous runs.'
        ],
        example: 'It is the same loop as backward-shift deletion in 3.4, kept honest by the same argument.'
      }
    ],

    'swiss-tables': [
      {
        term: 'Control byte',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["one byte per slot, held in a<br/>separate small array"] --> B["empty"]',
            '    A --> C["deleted"]',
            '    A --> D["or a 7-bit tag taken from the hash"]',
            '    D --> E["16 of them fit in one register,<br/>so a whole group is checked at once"]'
          ].join('\n'),
          caption: 'The metadata is small enough to stay in cache while the entries do not, so a group that holds nothing is rejected without touching the large array at all.'
        },
        plain: 'One byte per slot, stored in a separate array: empty, deleted, or a 7-bit tag from the hash.',
        formal: 'ctrl ∈ {0x80, 0xFE} ∪ [0, 0x7F]',
        readAs: 'Each control byte is either one of two special markers — 0x80 for empty, 0xFE for deleted — ' +
          'or any value from 0 to 0x7F standing for a live entry. The ∪ joins the two possibilities ' +
          'into one set of allowed values.',
        detail: [
          'A Swiss table keeps a one-byte summary of each slot in a separate array. The top bit ' +
            'distinguishes the special states — empty and deleted — from an occupied slot, whose ' +
            'remaining seven bits hold a tag taken from the key\'s hash.',
          'Because the summaries are dense and separate from the entries, a probe can examine many ' +
            'slots per cache line.',
          'A group is 16 control bytes, and a 64-byte line holds four groups, so one fetch covers ' +
            'the metadata for 64 slots.',
          'The entries array is only touched once a tag matches.'
        ],
        example: 'A group is 16 control bytes; a 64-byte line holds four groups, so one fetch covers 64 slots.'
      },
      {
        term: 'H1 and H2',
        plain: 'The hash is split: high bits choose the group, the low 7 bits become the tag.',
        formal: 'H1 = h >> 7, H2 = h & 0x7F',
        readAs: 'Split the hash in two. Shift it right by 7 to get the part that picks the group, ' +
          'and keep the bottom 7 bits as the tag stored in the control byte. One hash, two ' +
          'independent jobs.',
        detail: [
          'The design uses the hash twice, and it uses different parts for the two jobs so they ' +
            'stay independent. The upper bits select which group to probe, and the low seven ' +
            'become the tag stored in the control byte.',
          'If those two parts were correlated, keys landing in the same group would also tend to ' +
            'share a tag, and the tag would stop filtering.',
          'That is why the quality demanded of the hash here is higher than for a plain masked ' +
            'table. Both ends of the word have to be well mixed, which is precisely what the ' +
            'hash-functions section is about.'
        ],
        example: 'Both halves must be well mixed, which is why 3.1 comes first.'
      },
      {
        term: 'Group probing',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["take the 7-bit tag from the hash"] --> B["compare it against all 16 control<br/>bytes in a single instruction"]',
            '    B --> C["get back a bitmask of candidate lanes"]',
            '    C --> D["compare only those candidates<br/>against the real keys"]',
            '    D --> E["most groups are rejected without<br/>reading a single key"]'
          ].join('\n'),
          caption: 'Sixteen comparisons for the price of one, and the false positives a 7-bit tag allows cost exactly one real key comparison each.'
        },
        plain: 'Compare the tag against all 16 control bytes at once and get a bitmask of candidates.',
        formal: '_mm_cmpeq_epi8 then movemask',
        detail: [
          'The tag is broadcast across a 16-byte SIMD register and compared against a whole group ' +
            'of control bytes in one instruction. The result is condensed into a 16-bit mask whose ' +
            'set bits are the candidate slots.',
          'Iterating the mask visits only those, so a lookup typically performs one key comparison ' +
            'after one metadata fetch.',
          'This is the mechanism that lets the table run at 87.5% load. The expensive part of a ' +
            'probe is examining slots, and sixteen of them are examined at once.',
          'The implementation here uses a byte loop with the same structure, since JavaScript has ' +
            'no SIMD.'
        ],
        example: 'One SSE2 instruction over a 16-byte group in C++; a byte loop here, same structure.'
      },
      {
        term: 'Tag false positive',
        plain: 'Two different keys can share a 7-bit tag, costing one real key comparison.',
        formal: 'P = 1/128 ≈ 0.008',
        readAs: 'Two different keys share a 7-bit tag about once in every 128 tries, so roughly 0.8% of ' +
          'candidate matches are false and need a full key comparison to reject.',
        detail: [
          'Seven bits cannot identify a key, so two distinct keys in the same group share a tag ' +
            'about one time in 128. The table pays a full key comparison to discover the mismatch.',
          'That is the entire error budget of the design, and it is well spent. Only 0.8% of ' +
            'probes cost an extra comparison, and the other 99.2% are rejected without touching ' +
            'the entries array at all.',
          'It is the same trade a Bloom filter makes: a small, quantified false-positive rate ' +
            'bought with very little metadata.',
          'The tag is never allowed to decide equality on its own.'
        ],
        example: 'That is the entire error budget of the design.'
      },
      {
        term: 'Load factor 7/8',
        plain: 'Group probing stays cheap where linear probing is already walking long runs.',
        formal: 'grow at α > 0.875',
        readAs: 'Resize once the table is more than seven-eighths full. Higher than most open-addressing ' +
          'schemes dare, and the SIMD group scan is what makes it affordable.',
        detail: [
          'A conventional open-addressed table is deep into the 1/(1 − α) wall at 87.5% load, ' +
            'averaging four probes and walking long runs.',
          'A Swiss table is not, because its unit of work is a group rather than a slot. A run of ' +
            'occupied slots is scanned sixteen at a time, so the same occupancy costs a fraction ' +
            'of the memory traffic.',
          'That is what allows Abseil to set the growth threshold at 7/8. It means fewer resizes, ' +
            'and roughly a third less memory for the same key count than a table growing at 0.5 ' +
            'or 0.75.'
        ],
        example: 'Abseil\'s choice; a plain open-addressed table would be suffering at that load.'
      },
      {
        term: 'Metadata separation',
        plain: 'Keeping tags apart from entries means a rejected group never touches the (large) slot array.',
        formal: 'ctrl array: 1 byte/slot',
        detail: [
          'The point of holding control bytes in their own array is that failure is cheap.',
          'A group that contains no matching tag is rejected without reading a single entry. The ' +
            'large slot array — potentially dozens of bytes per entry — is touched only when the ' +
            'metadata says it is worth touching.',
          'The control array is small enough to stay resident: a 4 096-slot table needs 4 KB of it.',
          'The cost is one extra indirection and the need to keep the two arrays consistent, which ' +
            'is straightforward because they are indexed identically.'
        ],
        example: 'A 4 096-slot table has a 4 KB control array — usually resident.'
      },
      {
        term: 'DELETED means keep going',
        plain: 'A deleted slot must not read as empty: a probe stops at the first empty lane, and a key inserted past this group is only reachable through it.',
        formal: 'EMPTY = 0x80 stops the probe; DELETED = 0xFE does not',
        detail: [
          'The two special control values look similar and mean opposite things to a probe.',
          'EMPTY terminates the search, because a key that hashed here would have been placed here.',
          'DELETED does not, because a key may have been inserted past this slot while it was ' +
            'occupied, and is reachable only by continuing through it. Collapsing the two states ' +
            'loses keys.',
          'The price is the familiar tombstone problem in group form. Seven hundred deletions ' +
            'leave 700 DELETED bytes that still cost probe work, with lookups touching 1.051 ' +
            'groups instead of the ideal 1.'
        ],
        example: '700 deletions leave 700 DELETED bytes, and lookups still touch 1.051 groups.'
      },
      {
        term: 'Rehash in place',
        plain: 'Deletions raise occupancy without raising the live count, so the growth trigger fires on a table that is half empty. The fix is to rebuild at the same capacity.',
        formal: 'grow when (live + deleted)/slots > maxLoad',
        detail: [
          'Because tombstones count towards the probing load, a delete-heavy workload can drive ' +
            '(live + deleted)/slots past the growth threshold while the live load is only 0.34.',
          'Doubling the table then wastes memory to solve a problem that is not about capacity at ' +
            'all.',
          'The correct response is to rebuild at the same capacity, which drops every tombstone ' +
            'and restores probe lengths for the cost of one rehash.',
          'Distinguishing "too many entries" from "too many tombstones" before resizing is what ' +
            'keeps a long-lived table from growing without bound.'
        ],
        example: 'A delete-heavy workload would otherwise double a table whose live load is 0.34.'
      }
    ],

    rehashing: [
      {
        term: 'Amortised versus worst case',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["O(1) amortised over a million inserts"] --> B["entirely true"]',
            '    C["and one of those inserts<br/>moved a million entries"] --> D["also entirely true"]',
            '    D --> E["a latency target is measured<br/>on the second statement"]'
          ].join('\n'),
          caption: 'Amortised analysis answers what the sequence costs. It says nothing at all about the single call — which is the one a p99 target is graded on.'
        },
        plain: 'O(1) amortised says nothing about the one call that moved a million entries.',
        formal: 'total O(n), single op O(n)',
        detail: [
          'The amortised bound is true and it is an average over a sequence, so it is silent about ' +
            'the individual insert that rehashes the whole table.',
          'That insert is not rare in any useful sense. It happens at every power of two, ' +
            'deterministically, and it is proportional to the current size, so the largest spikes ' +
            'come last.',
          'In a service, those calls are your p99.9. A request that happens to trigger the rehash ' +
            'of a million-entry table wears the entire cost.',
          'Amortised analysis is the right tool for capacity planning and the wrong one for a ' +
            'latency budget.'
        ],
        example: 'Your p99.9 is made of exactly those calls.'
      },
      {
        term: 'Growth trigger',
        plain: 'Grow when the load factor crosses a threshold — counting tombstones, not just live entries.',
        formal: '(n + tombstones) / m > maxLoad',
        detail: [
          'Probe cost is driven by how many slots are unavailable, and a tombstone is unavailable ' +
            'for probing even though it holds no entry.',
          'A trigger that looks only at the live count therefore never fires on a table that is ' +
            'full of tombstones. Probe lengths climb indefinitely while the table reports itself ' +
            'as half empty.',
          'Counting both is the fix. The Swiss-table section adds the refinement: a table failing ' +
            'the test because of tombstones should be rebuilt at the same capacity rather than ' +
            'doubled.'
        ],
        example: 'Growing on live entries alone lets a tombstoned table degrade forever.'
      },
      {
        term: 'Incremental rehash',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["growth triggers"] --> B["allocate the new table,<br/>keep the old one"]',
            '    B --> C["every operation moves<br/>a few buckets across"]',
            '    C --> D["lookups consult both tables<br/>until the old one is empty"]',
            '    D --> E["no single call ever pays<br/>for the whole migration"]'
          ].join('\n'),
          caption: 'The total work is unchanged. It is spread so that no one request is the unlucky one, and the price is holding both tables allocated at once.'
        },
        plain: 'Keep both tables and move k buckets per operation until the old one is empty.',
        formal: 'reads check old then new; writes go to new',
        detail: [
          'Instead of migrating everything in one call, keep both tables live and move a few ' +
            'buckets on each subsequent operation.',
          'Reads consult the old table and then the new one, writes go to the new one, and a ' +
            'cursor records how far the migration has reached.',
          'The spike disappears and total work rises slightly, since every operation during the ' +
            'migration pays a little extra.',
          'Redis is the canonical implementation — ht[0], ht[1] and a rehash index — and the same ' +
            'pattern shows up wherever a latency budget outranks throughput.'
        ],
        example: 'Redis: ht[0], ht[1] and a rehash cursor.'
      },
      {
        term: 'Doubled memory',
        plain: 'During migration both tables are allocated, so peak memory is the real cost of a flat tail.',
        formal: 'peak ≈ 3m slots',
        detail: [
          'Both the old and the new table are allocated for the whole migration, so the memory ' +
            'high-water mark is the sum. That is about three times the original slot count, since ' +
            'the new table is twice the old.',
          'For a one-shot rehash that peak lasts microseconds. For an incremental one it lasts as ' +
            'long as the migration does, which is why an incremental rehash that stalls because ' +
            'traffic stopped is worse than either alternative.',
          'It is also why implementations force progress on a timer, or finish the migration when ' +
            'the table is idle, rather than relying on operations to arrive.'
        ],
        example: 'Which is why the migration should finish, not linger.'
      },
      {
        term: 'Iterator invalidation',
        plain: 'Resizing moves entries, so any iterator taken before the resize is meaningless after it.',
        formal: 'modification during iteration is undefined',
        detail: [
          'An iterator over a hash table is a position in a slot array, and a resize rehashes ' +
            'every key into a different array. The position now refers to unrelated data.',
          'Continuing would silently skip entries or return some twice, which is worse than ' +
            'failing.',
          'Implementations therefore either detect the change and throw, as Java does with ' +
            'ConcurrentModificationException, or declare the behaviour undefined and let it ' +
            'corrupt, as C++ does.',
          'The practical rule is the same either way: collect the keys you intend to modify, ' +
            'finish iterating, and then modify.'
        ],
        example: 'Java throws ConcurrentModificationException rather than returning nonsense.'
      },
      {
        term: 'Pre-sizing',
        plain: 'If you know the count, allocate for it once and no rehash happens at all.',
        formal: 'capacity ≥ n / maxLoad',
        detail: [
          'Every rehash exists because the final size was unknown. Sometimes it is known: a query ' +
            'with a row count, a file with a length, a collection being copied.',
          'Sizing the table up front then removes the entire problem rather than mitigating it.',
          'The capacity needed is n divided by the maximum load factor, rounded up to the ' +
            'implementation\'s granularity.',
          'Forgetting to divide is the common error. Reserving exactly n leaves the table at 100% ' +
            'load and it grows anyway.',
          'This is the cheapest fix available and it is usually available.'
        ],
        example: 'The cheapest possible fix, and it is usually available.'
      },
      {
        term: 'Reserve beats both schemes',
        plain: 'When the final size is known, reserving removes the spike instead of spreading it — and does less total work than either alternative.',
        formal: 'capacity = ⌈n / maxLoad⌉, rounded to a power of two',
        readAs: 'To hold n entries without resizing, reserve n divided by the maximum load factor, rounded up ' +
          'and then up again to a power of two. Reserving up front skips every intermediate rehash.',
        detail: [
          'Reserving is not merely the smoothest option, it is the cheapest. Twenty thousand ' +
            'inserts cost 36 043 units of work from a reserved table, against 84 633 growing from ' +
            'an initial 16, and 149 468 with an incremental migration.',
          'Growth pays to move entries repeatedly, and the incremental scheme pays extra per ' +
            'operation on top of that to spread the cost out.',
          'So the ordering is unambiguous when the size is known. Incremental rehashing is the ' +
            'answer only when it is not — where the choice is between a spike and a smear, not ' +
            'between either and avoiding the work.'
        ],
        example: '20 000 inserts cost 36 043 units from a reserved table, against 84 633 growing from 16 and 149 468 incrementally.'
      },
      {
        term: 'Migration is a correctness problem',
        plain: 'While two tables are live every operation consults both, and a slot vacated in the old table must not cut its probe chain.',
        formal: 'mark migrated slots DEAD, never EMPTY',
        detail: [
          'Incremental rehashing is usually presented as a latency technique, and its hardest part ' +
            'is correctness.',
          'Both tables are probed, and the old one is still being probed while entries are removed ' +
            'from it.',
          'So a migrated slot left EMPTY cuts every probe chain passing through it. A key already ' +
            'scanned past by the cursor but not yet copied is then reachable in neither table.',
          'Marking migrated slots DEAD, exactly like a tombstone, keeps the chains intact.',
          'The invariant to test is that every key is findable after every single step of the ' +
            'migration, not merely at the end.'
        ],
        example: 'Emptying them loses keys that the cursor has passed and not yet copied — reachable in neither table.'
      }
    ],

    'perfect-hashing': [
      {
        term: 'Perfect hash',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["a key set that never changes"] --> B["search for a hash function<br/>with no collisions on it"]',
            '    B --> C["one probe per lookup, always"]',
            '    C --> D["no chains, no probe sequences,<br/>no load factor"]',
            '    D --> E["and it works only because<br/>the keys were fixed in advance"]'
          ].join('\n'),
          caption: 'Everything a general hash table spends effort on exists because keys arrive unpredictably. Fix the set and all of it disappears.'
        },
        plain: 'For a fixed key set, a function with no collisions at all — so a lookup is one probe.',
        formal: 'h injective on S',
        readAs: '"Injective" means no two different keys in S get the same output. The function ' +
          'never collides on the set you actually have, though it may collide on keys outside it.',
        detail: [
          'When the key set is known in advance and never changes, the collision problem can be ' +
            'solved once at build time instead of handled at every lookup. Search for a function ' +
            'that is injective on exactly those keys.',
          'The result needs no probing, no chains and no load factor. A lookup is one hash and one ' +
            'array read, with a single comparison if you also need to reject non-keys.',
          'The requirement is severe and more common than it sounds: compiler keywords, opcode ' +
            'dispatch tables, HTTP header names, protocol enums and anything else generated at ' +
            'build time.'
        ],
        example: 'Compiler keyword tables, opcode dispatch, HTTP header names.'
      },
      {
        term: 'Minimal perfect hash',
        plain: 'Perfect and onto: n keys map to exactly [0, n) with no empty slots.',
        formal: 'h : S → [0, n) bijective',
        readAs: 'The function maps the set S onto the whole numbers from 0 up to but not including n, hitting ' +
          'every one of them exactly once. "Bijective" is that perfect pairing: no gaps and no ' +
          'collisions, so n keys occupy exactly n slots.',
        detail: [
          'A perfect hash into a larger range is easy. Making it minimal — a bijection onto ' +
            '[0, n) with no gaps — is what makes the table exactly as large as the data.',
          'Compare an ordinary hash table, which must run below its maximum load factor and ' +
            'therefore wastes a quarter to a half of its slots.',
          'The search is harder and the payoff is the densest possible layout, which matters when ' +
            'the table is large or when it must fit in a cache.',
          'The function itself still needs storage, and that cost is measured in bits per key.'
        ],
        example: 'No wasted slots, unlike a hash table which needs α < 1.'
      },
      {
        term: 'FKS two-level',
        plain: 'Spread keys over n buckets, then give a bucket of b keys a table of b² slots.',
        formal: 'E[Σ b_i²] < 2n',
        readAs: 'Add up the square of each bucket\'s size, and on average that total stays under twice the ' +
          'number of keys. It matters because the squares are exactly the space the second-level tables ' +
          'need.',
        detail: [
          'Fredman, Komlós and Szemerédi\'s 1984 construction is the classic result. Hash into n ' +
            'buckets, then give each bucket its own second-level table of size b² and search for a ' +
            'seed that is collision-free within it.',
          'Quadratic space per bucket sounds ruinous until you sum it. The expectation of Σ b² is ' +
            'below 2n for a universal first-level hash, so the whole structure is linear.',
          'A lookup is two hashes and one comparison, worst case, always. It is the proof that ' +
            'worst-case O(1) lookup with O(n) space is achievable.'
        ],
        example: 'Worst-case O(1) lookup with expected O(n) space, from 1984.'
      },
      {
        term: 'Hash and displace',
        plain: 'Group keys into buckets, then find a displacement per bucket that places its keys in free slots.',
        formal: 'slot = h(key, d_bucket) mod n',
        readAs: 'Hash the key again, this time seeded with the displacement value stored for its bucket, and ' +
          'take the remainder to land in the table. Choosing that displacement per bucket is what ' +
          'removes the collisions.',
        detail: [
          'Hash-and-displace keeps FKS\'s two levels but stores far less. Instead of a ' +
            'second-level table per bucket, it stores a single displacement value per bucket.',
          'That displacement is chosen so that re-hashing the bucket\'s keys with it lands them ' +
            'all on currently free slots.',
          'Lookup is one hash to find the bucket, one lookup of its displacement, and one more ' +
            'hash to reach the slot.',
          'Because only the displacement array is stored, the structure costs a few bits per key ' +
            'rather than a word. That is the whole reason CHD-style constructions are what people ' +
            'actually ship.'
        ],
        example: 'Only the displacement array is stored — a few bits per key.'
      },
      {
        term: 'Largest bucket first',
        plain: 'Placing crowded buckets while the table is empty is what makes the displacement search converge.',
        formal: 'sort buckets by descending size',
        detail: [
          'The order buckets are placed in decides whether the search terminates in reasonable ' +
            'time.',
          'A bucket with several keys needs a displacement that finds several free slots at once, ' +
            'and the probability of that collapses as the table fills.',
          'So crowded buckets are placed first, while space is plentiful, and singleton buckets ' +
            'last, when almost any displacement works.',
          'Reverse the order and the search stalls on the final large buckets, sometimes for so ' +
            'long that the build appears to hang. It is a greedy heuristic, and it is the ' +
            'difference between seconds and never.'
        ],
        example: 'Reverse the order and the search stalls on the last few buckets.'
      },
      {
        term: 'Bits per key',
        plain: 'The space measure for a minimal perfect hash, since it stores no keys.',
        formal: 'r · ⌈log₂(max d)⌉ / n',
        readAs: 'The space cost per key. Take the number of displacement entries, times the bits ' +
          'each one needs — log base 2 of the largest displacement, rounded up — and divide by the ' +
          'number of keys.',
        detail: [
          'A minimal perfect hash stores no keys and no values of its own, only the displacement ' +
            'array.',
          'So the meaningful space measure is bits per key: the number of displacement entries ' +
            'times the bits each needs, divided by the key count.',
          'That makes the structures comparable across key types and sizes, and it puts the ' +
            'achievement in perspective. Published CHD implementations reach about 2.1 bits per ' +
            'key, against the information-theoretic lower bound of roughly 1.44.',
          'The straightforward version in this section lands near 3, which is the price of a ' +
            'simple search.'
        ],
        example: 'Published CHD reaches ~2.1 bits/key; the simple version here lands near 3.'
      },
      {
        term: 'The lambda dial',
        plain: 'The average bucket size in hash-and-displace. Larger buckets mean fewer displacements to store and an exponentially harder search to find them.',
        formal: 'r = ⌈n/λ⌉ displacement entries',
        readAs: 'How many buckets there are: the key count divided by the average keys per bucket, rounded ' +
          'up. Fewer buckets means a smaller table and a harder search.',
        detail: [
          'λ is the average number of keys per bucket, and it trades build time against space ' +
            'along a brutally non-linear curve.',
          'Larger buckets mean fewer of them, and so fewer displacements to store. But each ' +
            'displacement must place all of its bucket\'s keys simultaneously, and the probability ' +
            'of that falls exponentially in the bucket size.',
          'On 500 keys, λ = 2 costs 4.50 bits per key after 3 809 trials, while λ = 6 costs 2.52 ' +
            'bits after 227 969. That is a 44% space saving for 60 times the build work.',
          'Since the build happens once, that is often the right trade.'
        ],
        example: '500 keys: λ = 2 gives 4.50 bits/key after 3 809 trials; λ = 6 gives 2.52 bits after 227 969.'
      },
      {
        term: 'Membership is not included',
        plain: 'A minimal perfect hash maps every key to a distinct slot — and maps a non-key to a slot as well. Nothing detects a stranger unless the keys are stored.',
        formal: 'lookup(x) ∈ [0, n) for every x, member or not',
        readAs: 'The function returns a slot in range for any input at all, including keys that were never ' +
          'stored. It cannot tell you whether the key belongs — that is what makes it minimal perfect ' +
          'hashing rather than a set.',
        detail: [
          'The function is defined on the whole universe, and it is injective only on the set it ' +
            'was built for.',
          'So a key that was never in the set still hashes to some slot in [0, n), and returns ' +
            'whatever lives there — confidently and wrongly.',
          'If the input is guaranteed to be a member, that is fine, and it is why the keys need ' +
            'not be stored.',
          'If it is not, you must store something to check against: the full keys, or a ' +
            'fingerprint per slot. One byte of fingerprint drops false positives to 1/256 and ' +
            'costs 8 bits per key, against the structure\'s own 3.'
        ],
        example: 'One byte of fingerprint per key drops false positives to 1/256, at 8 bits per key against the structure\'s 3.'
      }
    ],

    'hash-in-practice': [
      {
        term: 'Map versus object',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["an object used as a map"] --> B["every key is coerced<br/>to a string"]',
            '    B --> C["so 1 and \'1\' are the same key"]',
            '    D["a Map"] --> E["keys compared by SameValueZero"]',
            '    E --> F["1 and \'1\' are different keys,<br/>and an object can BE a key"]'
          ].join('\n'),
          caption: 'They look interchangeable and have different key semantics. Using an object as a dictionary silently merges keys that the language considers distinct everywhere else.'
        },
        plain: 'Object keys are coerced to strings; Map keys are values compared by SameValueZero.',
        formal: 'obj[1] === obj["1"]; map.get(1) !== map.get("1")',
        detail: [
          'A plain object is not a hash map with a nicer syntax. Its keys are strings and symbols ' +
            'only, so every other key is coerced.',
          'The number 1 and the string "1" are the same property. An object used as a key becomes ' +
            'the string "[object Object]", silently merging every such key into one.',
          'A Map keeps keys as values and compares them with SameValueZero, so numbers, objects ' +
            'and strings stay distinct.',
          'It also has no prototype chain to collide with, which removes the whole class of bugs ' +
            'around keys named "constructor" or "__proto__".'
        ],
        example: 'An object used as an object key becomes "[object Object]".'
      },
      {
        term: 'Dictionary mode',
        plain: 'V8 stores objects with a fixed shape until you delete a property; then it switches to a real hash table.',
        formal: 'hidden class → dictionary',
        detail: [
          'V8 represents an ordinary object as a hidden class plus a flat array of values, so a ' +
            'property access compiles down to an offset load and can be inline-cached.',
          'Deleting a property forces a transition to a genuine hash table representation. So does ' +
            'adding a great many, or using an object as a dynamic dictionary.',
          'That transition is silent and effectively permanent for the object. It disables the ' +
            'inline caches at every site that touches it, so the cost lands in code far away from ' +
            'the delete.',
          'Using a Map for map-like data avoids the question entirely.'
        ],
        example: 'The transition is silent, permanent for that object, and disables inline caches.'
      },
      {
        term: 'Insertion-ordered iteration',
        plain: 'Map guarantees it. The structure behind it is an entries array plus an index.',
        formal: 'entries[] + Map<key, position>',
        detail: [
          'Map is specified to iterate in insertion order, which a bare hash table cannot do. The ' +
            'implementation is therefore a dense array of entries in insertion order, plus a hash ' +
            'index from key to position.',
          'Iteration walks the array, which is contiguous and fast, and does not depend on the ' +
            'table\'s capacity the way iterating a chained table does.',
          'Deletion is the awkward case. Removing from the middle of the array would move ' +
            'everything after it, so a hole is left and the array is compacted when the holes get ' +
            'numerous enough.'
        ],
        example: 'Delete leaves a hole; the array must be compacted or it grows forever.'
      },
      {
        term: 'WeakMap',
        plain: 'Keys are held weakly, so an entry disappears when its key becomes unreachable.',
        formal: 'not enumerable, not iterable',
        detail: [
          'A WeakMap does not keep its keys alive. Once nothing else references a key object, the ' +
            'entry becomes collectable.',
          'That makes it the correct structure for metadata attached to objects you do not own: ' +
            'caches, private fields, listener registries.',
          'A Map used for the same purpose is a memory leak, because it holds every key it was ' +
            'ever given.',
          'The restrictions follow from the semantics. It cannot be iterated or sized, since ' +
            'exposing that would make garbage collection timing observable, and its keys must be ' +
            'objects.'
        ],
        example: 'The right structure for per-object metadata that must not leak.'
      },
      {
        term: 'Hash caching',
        plain: 'Storing the hash with the entry avoids recomputing it on resize and speeds up comparison.',
        formal: 'entry = {hash, key, value}',
        detail: [
          'Keeping the hash beside the entry pays twice. A resize can rehash without touching the ' +
            'keys at all, and a lookup can reject a candidate by comparing 32-bit integers before ' +
            'it compares two long strings.',
          'That is why Java caches String hash codes, and why most table implementations store the ' +
            'hash in the slot.',
          'Two cautions. The cached value must be invalidated if the key can mutate, which is why ' +
            'hash keys should be immutable.',
          'And a cached hash that is persisted or exposed across processes reintroduces the ' +
            'flooding surface that per-process seeding was meant to close.'
        ],
        example: 'Java caches String hashes; the cache is also a hash-flooding surface if persisted.'
      },
      {
        term: 'Probes versus time',
        plain: 'Probe counts are exact and portable; timings belong to one machine, engine and day.',
        formal: 'report both, and the run count',
        detail: [
          'Probe counts are deterministic, reproducible and comparable across machines, which ' +
            'makes them the right basis for a claim about a scheme.',
          'Times are what users experience, and are valid only for the machine, engine and moment ' +
            'that produced them.',
          'Reporting both is what makes a disagreement between them visible, and that disagreement ' +
            'is nearly always the interesting finding.',
          'It means memory behaviour the probe count cannot see is deciding the outcome — a ' +
            'contiguous run versus scattered lines, or a table that has left cache.'
        ],
        example: 'When they disagree it is usually memory behaviour the probe count cannot see.'
      },
      {
        term: 'The workload picks the scheme',
        plain: 'There is no ordering of these tables. Change the delete rate and the ranking changes with it.',
        formal: 'rank(scheme) is a function of the operation mix',
        detail: [
          'Every scheme in this milestone wins some workload and loses another. A general ranking ' +
            'does not exist, and any article offering one has fixed a workload without saying so.',
          'Backward-shift deletion is best-equal on a read-heavy stream and last under 45% ' +
            'deletions. Tombstones are the reverse.',
          'The operating parameters that flip the order are few and easy to measure: the ' +
            'read/write/delete mix, the load factor, the key size, and whether the final count is ' +
            'known.',
          'So the practical method is to measure your mix, rather than to inherit someone else\'s ' +
            'conclusion.'
        ],
        example: 'Backward-shift deletion is best-equal on a read-heavy stream and last under 45% deletions.'
      },
      {
        term: 'Memory is part of the answer',
        plain: 'A table that probes less may simply be holding more slots. Compare probes and capacity together, or the comparison says nothing.',
        formal: 'probes at equal load, or probes and load side by side',
        detail: [
          'Probe count falls as the table gets emptier, so any scheme can be made to look good by ' +
            'giving it more memory. A benchmark that reports only probes will report that as a ' +
            'victory.',
          'In this section\'s measurements the tombstone table beats backward shift 2.13 probes to ' +
            '3.72, while holding 8 192 slots against 4 096.',
          'It is not faster, it is twice as large, because its tombstones triggered a growth.',
          'Compare at equal load factor, or report probes and capacity side by side. A ' +
            'single-number comparison between hash tables is almost always hiding one of the two.'
        ],
        example: 'Tombstones beat backward shift 2.13 to 3.72 probes — while holding 8 192 slots against 4 096.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));

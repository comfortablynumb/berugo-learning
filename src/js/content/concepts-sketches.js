/** Concepts for the approximate-membership sections (M07.1-M07.3). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'bloom-filters': [
      {
        term: 'A clear bit is proof; a set bit is not',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["look up a key:<br/>check its k bits"] --> B{"is any one of them 0?"}',
            '    B -->|yes| C["definitely absent —<br/>this key was never inserted"]',
            '    B -->|no| D["probably present"]',
            '    D --> E["or those bits were set<br/>by other keys, between them"]'
          ].join('\n'),
          caption: 'The asymmetry is the whole structure. A negative answer is a proof; a positive one is a hint, which is why a Bloom filter is always a front end for something authoritative.'
        },
        plain: 'No false negatives ever, because every bit a key sets stays set.',
        formal: 'x ∈ S ⇒ has(x) = true; has(x) = true ⇏ x ∈ S',
        readAs: 'If the key really is in the set the filter always says yes — no false negatives, ever. The ' +
          'reverse does not follow: a yes does not prove membership, and ⇏ is exactly that "does not ' +
          'imply".',
        detail: [
          'The asymmetry is the entire structure.',
          'Adding a key only ever turns bits on, so if any of the k bits a key tests is clear, that ' +
            'key was definitely never added. The filter has found positive evidence of absence.',
          'A set bit carries no such evidence, because any of the other keys could have set it.',
          'Every use of a Bloom filter has to be arranged so that the cheap answer is the "no" and ' +
            'the expensive path is only taken on a "maybe". That is why it works in front of a ' +
            'disk read and not in place of one.'
        ],
        example: '20 000 keys checked against the filter that holds them: 0 false negatives, always.'
      },
      {
        term: 'The sizing formula',
        plain: 'm = −n ln p / (ln 2)² bits and k = (m/n) ln 2 hashes, for n keys at error p.',
        formal: 'm/n = −log₂ p / ln 2 = 1.4427 · log₂(1/p)',
        readAs: 'Bits per key, given the false-positive rate p you want. About 1.44 bits for every halving of ' +
          'the rate — so 1% costs roughly 9.6 bits per key and 0.1% costs 14.4, whatever the key ' +
          'actually is.',
        detail: [
          'Bits per key depends only on the target error rate, never on the keys themselves.',
          'A 1% filter costs 9.59 bits per key whether the keys are three characters or three ' +
            'kilobytes, because only a hash of each key is ever consulted.',
          'That is what makes the structure so attractive for long identifiers: URLs, content ' +
            'hashes, file paths.',
          'It is also the source of the standing 1.44 factor. An information-theoretic optimum ' +
            'would need log₂(1/p) bits, and a Bloom filter always pays 44% more.'
        ],
        example: '1% costs 9.59 bits per key with k = 7; 0.1% costs 14.38 with k = 10.'
      },
      {
        term: 'k is a compromise, not a maximum',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["more hash functions"] --> B["more bits to check,<br/>so a miss is caught sooner"]',
            '    A --> C["but more bits set per insert,<br/>so the filter fills faster"]',
            '    B --> D["the two effects pull<br/>in opposite directions"]',
            '    C --> D',
            '    D --> E["the optimum sits where they balance,<br/>at about 0.7 bits per bit of space"]'
          ].join('\n'),
          caption: 'Adding hashes helps until it does not. This is the one parameter in the structure where more is not better, and the formula is where the two curves cross.'
        },
        plain: 'More hashes set more bits; the optimum balances the two effects.',
        formal: 'k* = (m/n) ln 2, at which exactly half the bits are set',
        readAs: 'The best number of hash functions is the bits-per-key figure times the natural log of 2, ' +
          'about 0.693. At that setting exactly half the bit array ends up set — which is the point of ' +
          'maximum information per bit.',
        detail: [
          'Raising k gives a query more chances to find a clear bit, which lowers the error. It ' +
            'also fills the array faster, which raises it.',
          'The two curves cross at k = (m/n) ln 2, and that is precisely the k at which half the ' +
            'array is set.',
          'It is a memorable check, because a correctly sized filter measured at capacity always ' +
            'reads about 50% full.',
          'Being wrong about k is forgiving. The curve is flat near the optimum, and k = 1 or ' +
            'k = 12 in a filter sized for 7 costs error but never correctness.'
        ],
        example: 'At the sized n the measured fill is 51.9% — the optimum is a half-full array.'
      },
      {
        term: 'Two hashes are enough',
        plain: 'g_i(x) = h₁(x) + i·h₂(x) behaves like k independent hashes for the error rate.',
        formal: 'Kirsch-Mitzenmacher: the asymptotic false-positive rate is unchanged',
        detail: [
          'Computing k independent hashes of every key would make the filter k times more ' +
            'expensive to use, and it is unnecessary.',
          'A linear combination of two independent hashes gives an indistinguishable ' +
            'false-positive rate.',
          'The implementation here adds an i² term because h₂ can share a factor with m, and then ' +
            'the sequence cycles early, revisiting the same bits.',
          'The trick does not transfer to every sketch. A count-min sketch built the same way ' +
            'breaks, because its guarantee needs the rows to be genuinely independent.'
        ],
        example: 'One murmur3 with two seeds gives all 7 probe positions at 1% error.'
      },
      {
        term: 'The error grows past n with no signal',
        plain: 'Nothing happens when the filter passes the n it was sized for; the curve just continues.',
        formal: 'fpr(n) = (1 − e^(−kn/m))^k, monotonically increasing and continuous at the sizing point',
        readAs: 'The chance of a false positive after n insertions: one minus the chance a given bit is still ' +
          'clear, raised to the power of the number of hashes. It only ever rises as you add keys, ' +
          'which is why a filter has a capacity rather than a load factor.',
        detail: [
          'A filter sized for 10 000 keys at 1% measures 1.010% at 10 000, 5.82% at 15 000 and ' +
            '16.05% at 20 000.',
          'There is no discontinuity, no counter that crosses a line and no way for the filter to ' +
            'notice. The predicted and measured curves agree the whole way, which is exactly why ' +
            'the failure is invisible.',
          'The only thing that knows is the insert counter, and that has to be exported ' +
            'deliberately. A filter that only reports yes and no cannot report this at all.'
        ],
        example: 'At 2n the filter that promised 1% measures 16.05%, and reports nothing.'
      },
      {
        term: 'No deletion, ever',
        plain: 'Clearing a bit may remove a key that was relying on it, which is a false negative.',
        formal: 'bits are shared, so clearing is not the inverse of setting',
        detail: [
          'A bit set by "apple" may also be one of the bits "banana" tests, so clearing it on ' +
            'behalf of "apple" makes "banana" disappear.',
          'There is no way to tell from the array which keys depend on a bit, because keys are not ' +
            'stored. That is the whole economy of the structure.',
          'The consequences are architectural. A Bloom filter cannot model a set that shrinks.',
          'Anything with eviction, expiry or tenancy changes needs a counting filter, a cuckoo ' +
            'filter, or a periodic rebuild from the authoritative source.'
        ],
        example: 'The repair is a counting filter at four times the memory, or a rebuild.'
      },
      {
        term: 'Union is exact; intersection is not',
        plain: 'Bitwise OR of two same-shaped filters is the filter of the union. Bitwise AND is not the filter of the intersection.',
        formal: 'A ∪ B: exact. A ∩ B: may report keys in neither set.',
        readAs: 'Bitwise OR of two filters gives exactly the filter of the combined set. Bitwise AND does not ' +
          'give the intersection: a key can set its bits from A in one place and from B in another, and ' +
          'the AND keeps both.',
        detail: [
          'OR works because a key\'s bits are set in the result exactly when they were set on ' +
            'either side, which is what the union means.',
          'AND fails because a key absent from both sets may still have each of its bits covered. ' +
            'Bit 3 comes from a key on the left, bit 9 from a different key on the right.',
          'So the intersection filter reports keys neither filter ever held.',
          'Both operations also require identical m, k and seed. Two filters built independently ' +
            'share no bit positions, and combining them produces noise.'
        ],
        example: 'Both operations need identical m, k and seed — otherwise the bits mean nothing.'
      },
      {
        term: 'The filter can estimate its own load',
        plain: 'The fraction of set bits gives back an estimate of how many keys went in.',
        formal: 'n̂ = −(m/k) · ln(1 − fill)',
        readAs: 'Estimate how many keys went in by looking at how full the bit array is. The hat on the n ' +
          'means "estimated", and the logarithm inverts the filling curve.',
        detail: [
          'Counting the set bits and inverting the fill formula recovers the insert count to ' +
            'within a fraction of a per cent. A filter holding 100 000 keys reports 99 905.',
          'It is not a substitute for the counter. It needs a full scan of the array, and it ' +
            'degrades badly once the filter is nearly saturated.',
          'But it is the only way to audit a filter you inherited. Given the bytes and the ' +
            'parameters, you can tell whether the thing is inside its design envelope without any ' +
            'access to the stream that filled it.'
        ],
        example: 'A filter holding 100 000 keys reports 99 905 from its bits alone.'
      }
    ],

    'bloom-variants': [
      {
        term: 'Counters instead of bits',
        plain: 'A small counter per cell makes removal possible, at four times the memory.',
        formal: 'add: c += 1; remove: c −= 1; has: all counters > 0',
        detail: 'Nobody reads the counters — they are not there to count anything. They exist so that ' +
          'decrementing on behalf of one key cannot clear a cell another key still needs, which is ' +
          'the precise reason a plain Bloom filter cannot delete. Four bits per cell is the standard ' +
          'choice and it costs exactly 4× the memory: 95 851 bytes against 23 963 for the same m and ' +
          'k. That factor, not the arithmetic, is why counting filters are reached for reluctantly.',
        example: '95 851 bytes against 23 963 for the identical m = 191 702 and k = 7.'
      },
      {
        term: 'A saturated counter is permanent',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["a counting Bloom cell<br/>hits its ceiling"] --> B{"decrement it on removal?"}',
            '    B -->|yes| C["it may have been incremented<br/>more times than it recorded"]',
            '    C --> D["a key that IS present<br/>now reads as absent"]',
            '    B -->|no| E["leave it stuck high forever"]',
            '    E --> F["the safe choice, and it<br/>slowly degrades the filter"]'
          ].join('\n'),
          caption: 'A false negative destroys the one guarantee a Bloom filter offers, so the only safe response to saturation is to stop counting that cell and accept the drift.'
        },
        plain: 'A counter at its ceiling can never be decremented again without risking a false negative.',
        formal: 'c = 2^b − 1 ⇒ c is frozen for the life of the filter',
        readAs: 'A counter with b bits saturates at its maximum value, and once there it can never be ' +
          'decremented safely — you no longer know how many increments it swallowed. That slot is ' +
          'permanently stuck.',
        detail: 'Once a 4-bit counter reaches 15 it has lost track of how many keys it really ' +
          'represents, so decrementing it could take it below the true count and make a live key ' +
          'vanish. The correct behaviour is to freeze it, and the cost is that the filter slowly ' +
          'stops forgetting: those cells stay set forever and the error rate drifts back towards a ' +
          'filter nothing was ever removed from. On a multiset load — each key inserted four times — ' +
          '1 260 cells freeze and 2 052 increments are lost outright at 4 bits, and 31 858 freeze at 3.',
        example: 'Each key inserted 4 times: 1 260 of 191 702 cells frozen at 4 bits, 31 858 at 3.'
      },
      {
        term: 'One block, one cache line',
        plain: 'Confine a key\'s k bits to one aligned block and a query touches one line instead of k.',
        formal: 'block = h₁ mod b; the k offsets are within the block',
        readAs: 'Pick one block from the first hash, then place all k bits inside that block. Every probe for ' +
          'a key then lands in the same cache line, so a lookup is one memory fetch instead of k.',
        detail: 'A standard filter\'s k bit positions are spread uniformly over the whole array, so a ' +
          'query touches up to k different cache lines — 6.95 measured at k = 7 — and every one of ' +
          'them is an unpredictable access the prefetcher cannot help with. A blocked filter picks ' +
          'one 512-bit block with the first hash and puts all k bits inside it, so the query is one ' +
          'line. At a query rate where the filter is the hot loop, that is the difference between the ' +
          'structure being free and being the bottleneck.',
        example: '1.00 cache lines per query against 6.95 for the standard filter.'
      },
      {
        term: 'Blocking costs accuracy, and the price is measurable',
        plain: 'Block occupancy varies, and the overloaded blocks add more error than the empty ones save.',
        formal: 'measured inflation at the same m and k, by block size',
        detail: 'Keys are distributed over blocks by a hash, so some blocks end up with more keys ' +
          'than average and those blocks are denser than the global fill. Error is convex in ' +
          'density, so the heavy blocks cost more than the light ones save and the net effect is ' +
          'always an increase. It is a function of block size and nothing else: 1.21× at 512 bits, ' +
          '1.37× at 256, 1.68× at 128 and 2.56× at 64, while a 4 096-bit block matches the standard ' +
          'filter exactly and costs eight cache lines, which gives the whole idea back.',
        example: '512-bit blocks: 1.204% measured against 0.992% for the standard filter, 1.21×.'
      },
      {
        term: 'A block must be an aligned cache line',
        plain: 'The saving is real only when the block does not straddle a line boundary.',
        formal: 'blockBits = 512 and the array is 64-byte aligned',
        detail: 'The entire argument for a blocked filter is one memory access, and a 512-bit block ' +
          'that starts halfway through a cache line spans two of them — so it costs the same as a ' +
          '1 024-bit block while carrying the accuracy penalty of a 512-bit one. This is a rare case ' +
          'where alignment is not a micro-optimisation but the whole feature, and it is why real ' +
          'implementations allocate the array with an explicit alignment rather than trusting the ' +
          'allocator.',
        example: 'A 1 024-bit block measures 2.00 lines per query, so it is not the same structure.'
      },
      {
        term: 'Layers for an unknown n',
        plain: 'When the newest layer fills, add a larger one with a tighter target in front of it.',
        formal: 'layer i: capacity n₀·s^i, target p·r^i',
        readAs: 'Each layer of a scalable filter is s times bigger than the last and aims at r times the ' +
          'accuracy, so the sizes grow geometrically while the error rates shrink geometrically — and ' +
          'the total error stays bounded.',
        detail: 'The whole difficulty with a Bloom filter is that the sizing needs an n, and a ' +
          'scalable filter is the answer when that number is genuinely unknowable. Each new layer is ' +
          'sized larger and aims lower, so the errors form a geometric series and their sum stays ' +
          'under the overall target however many layers appear. The demo starts with a layer sized ' +
          'for a tenth of the real key count and ends with four layers holding 2 000, 4 000, 8 000 ' +
          'and 5 866 keys at targets that halve down the chain.',
        example: 'Sized for 2 000 and given 20 000: four layers, measured 0.95% against a 1% target.'
      },
      {
        term: 'The chain is paid for on the miss path',
        plain: 'A "yes" can stop at the first layer that matches; a "no" must consult every layer.',
        formal: 'cost(miss) = Σ over layers of k_i probes',
        readAs: 'A key that is absent has to be ruled out by every layer, so a miss costs the sum of all ' +
          'their probe counts. Hits are cheap and misses get steadily dearer as layers accumulate.',
        detail: 'The layers are searched in order and a hit short-circuits, but the negative answer — ' +
          'which is the answer a filter exists to give quickly — has to prove absence in all of them. ' +
          'The measured cost is 9.11 cache lines per query against the standard filter\'s 6.95, and ' +
          'it grows with the number of times the original sizing estimate was wrong. A scalable ' +
          'filter is therefore a bet that being unable to size the structure is worse than paying for ' +
          'the misses, and that is a judgement about the workload rather than about the algorithm.',
        example: '9.11 lines per query for the four-layer chain against 6.95 for one filter.'
      },
      {
        term: 'Partitioned against shared arrays',
        plain: 'Giving each hash its own m/k slice, rather than sharing one array of m bits.',
        formal: 'the partitioned variant is very slightly worse and much easier to reason about',
        detail: 'In the shared layout every hash may address any of the m bits; in the partitioned ' +
          'layout hash i addresses only its own slice of m/k. The partitioned form makes each hash ' +
          'independent of the others by construction and lets the k probes proceed in parallel ' +
          'without conflict, at the cost of a marginally higher error rate — each slice is smaller, ' +
          'so each fills faster. The distinction matters most when the filter is being built ' +
          'concurrently, where the shared layout needs atomics on a single word that all k hashes ' +
          'may target.',
        example: 'Each of k hashes owns m/k bits, so the k probes never contend for one word.'
      }
    ],

    'fingerprint-filters': [
      {
        term: 'A fingerprint, not a set of bits',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["Bloom: set k bits derived<br/>from the key"] --> B["other keys set the same bits,<br/>so you cannot unset them"]',
            '    B --> C["deletion is impossible"]',
            '    D["cuckoo filter: store a short<br/>fingerprint of the key"] --> E["find that fingerprint<br/>and remove it"]',
            '    E --> F["deletion works"]'
          ].join('\n'),
          caption: 'Storing something identifiable rather than anonymous bits is what makes removal possible, and the price is a slightly larger cell and a bounded insert.'
        },
        plain: 'Store f bits derived from the key, so a delete can remove the fingerprint again.',
        formal: 'fpr ≈ 1 − (1 − 2^−f)^(2b·α) ≈ 2bα/2^f',
        readAs: 'For a cuckoo filter the error rate is set by the fingerprint length f: roughly the number of ' +
          'fingerprints you compare against, divided by 2 to the power f. Each extra fingerprint bit ' +
          'halves the rate.',
        detail: 'Bloom filters cannot delete because the bits are shared and unattributable. A ' +
          'fingerprint is a single object, so removing it removes exactly what one key put there — ' +
          'subject to the caveat that two keys with the same fingerprint in the same bucket are ' +
          'indistinguishable. The error rate follows directly from the fingerprint width and the ' +
          'number of slots a query examines, which is why the two dials of a cuckoo filter — how ' +
          'full it gets and how often it lies — are independent.',
        example: '8-bit fingerprints, four slots per bucket: 2.98% measured against 3.08% predicted.'
      },
      {
        term: 'Partial-key cuckoo hashing',
        plain: 'The alternative bucket is the first XOR a hash of the fingerprint.',
        formal: 'i₂ = i₁ ⊕ h(f), which is its own inverse',
        readAs: 'The second bucket is the first XORed with a hash of the fingerprint. XOR undoes itself, so ' +
          'from either bucket you can compute the other using only the fingerprint — which is what ' +
          'makes eviction possible without ever storing the key.',
        detail: 'Ordinary cuckoo hashing recomputes both candidate positions from the key, and a ' +
          'filter has thrown the key away. The trick is to derive the second bucket from the first ' +
          'and the *fingerprint*, using XOR so that applying it again returns the original: from ' +
          'either bucket, the other is one XOR away. This is what makes relocation possible at all ' +
          'and it is why the bucket count must be a power of two — with any other modulus the ' +
          'operation stops being an involution and evicted fingerprints are lost silently.',
        example: 'Powers of two only: with any other modulus the XOR is not an involution.'
      },
      {
        term: 'A hard load ceiling',
        plain: 'Past about 95% full an insert fails outright, and no amount of retrying helps.',
        formal: 'the eviction chain exceeds maxKicks and the item has nowhere to go',
        detail: 'A Bloom filter degrades: put in more keys and the error rate rises. A cuckoo filter ' +
          'stops: at 97.1% load an insert walks its full eviction budget and returns failure. That ' +
          'is a much better failure mode — it is loud, it happens at a known point, and it can be ' +
          'handled — but it is a failure mode a Bloom filter does not have, and code that treats ' +
          '`add` as infallible will drop items. The last orphan of a failed chain must be kept in a ' +
          'victim slot rather than dropped, or the filter acquires a false negative at the moment it ' +
          'fills.',
        example: '7 957 of 8 192 slots filled, then the 7 958th insert fails and the filter is full.'
      },
      {
        term: 'Four slots per bucket',
        plain: 'One slot jams at half full; four reaches 97%, and eight barely improves on that.',
        formal: 'measured load ceiling: 0.498, 0.880, 0.971, 0.993 for b = 1, 2, 4, 8',
        detail: 'With one slot per bucket the structure is plain cuckoo hashing with two choices, and ' +
          'the classic result is that it jams just under half full. Adding slots gives each ' +
          'relocation somewhere to go and the ceiling climbs steeply, then flattens: the step from ' +
          'two to four is worth nine percentage points and the step from four to eight is worth two, ' +
          'while wider buckets mean more slots examined per query and a proportionally worse error ' +
          'rate. Four is where every implementation lands, and the table is the reason.',
        example: 'b = 2 reaches 88.0%, b = 4 reaches 97.1%, b = 8 reaches 99.3%.'
      },
      {
        term: 'The eviction tail',
        plain: 'Most inserts evict nothing; a few walk hundreds of buckets.',
        formal: 'mean 1.94 kicks, maximum 408, over one complete fill',
        detail: '86.4% of inserts find a free slot immediately and cost nothing at all. The mean of ' +
          '1.94 is made almost entirely of the minority that do relocate, and the longest chain in a ' +
          'single fill ran 408 buckets — 210 times the mean. An insert cost quoted as an average is ' +
          'therefore not a latency budget, and the `maxKicks` limit is not a tuning parameter but a ' +
          'bound on the worst case: without it a nearly full table can walk indefinitely.',
        example: '86.4% of inserts evict nothing; the longest chain in one fill was 408.'
      },
      {
        term: 'Deleting what you never inserted',
        plain: 'The delete finds a matching fingerprint and clears it, whoever it belonged to.',
        formal: 'remove(x) has no way to verify that x was ever added',
        detail: 'The API reads like a set — add, contains, remove — and it is not one. A removal ' +
          'searches the two candidate buckets for a matching fingerprint and clears the first it ' +
          'finds; if the caller never inserted that key, the fingerprint it matched belongs to ' +
          'somebody else. Nothing is reported, and from that moment the filter answers "no" about a ' +
          'key it holds. Over 4 000 phantom deletes against a filter holding 4 000 keys, 59 were ' +
          'accepted and produced exactly 59 false negatives.',
        example: '59 of 4 000 phantom deletes accepted, producing 59 false negatives and no error.'
      },
      {
        term: 'Quotient and remainder',
        plain: 'Split the fingerprint: the quotient is the slot, the remainder is what gets stored.',
        formal: 'fingerprint = q·2^r + rem, with three metadata bits per slot',
        readAs: 'Split the fingerprint in two: the top part q picks the slot, and the remainder r bits are ' +
          'what gets stored there. Three metadata bits per slot record how the runs that collide are ' +
          'laid out.',
        detail: 'A quotient filter stores only the remainder, and recovers the quotient from *where* ' +
          'the remainder sits — which is a saving of q bits per item, paid for with three metadata ' +
          'bits. is_occupied marks a slot as some fingerprint\'s canonical home, is_continuation ' +
          'marks a slot as part of the run started to its left, and is_shifted marks an element that ' +
          'linear probing moved. Those three bits are exactly enough to reconstruct the mapping ' +
          'after any amount of shifting, which is the whole trick.',
        example: 'r = 7 remainder bits plus 3 metadata bits stores a 20-bit fingerprint in 10.'
      },
      {
        term: 'The sorted read-out is why it merges',
        plain: 'Slots can be walked in ascending fingerprint order in one pass, so two filters merge like two sorted lists.',
        formal: 'merge: q → q + 1, r → r − 1, p unchanged, no key consulted',
        readAs: 'Doubling a quotient filter moves one bit from the stored remainder into the slot index. The ' +
          'total fingerprint length p is unchanged and no original key is needed, which is why a ' +
          'quotient filter can resize and a Bloom filter cannot.',
        detail: 'Because runs are ordered by quotient and remainders are sorted within a run, a ' +
          'linear scan of the table produces every stored fingerprint in ascending order. Two such ' +
          'streams merge in one pass into a filter with one more quotient bit and one fewer ' +
          'remainder bit — the same p, the same fingerprints, nothing rehashed, and no access to the ' +
          'original keys, which is essential because there are none. That is the property a ' +
          'per-shard filter needs and the one a cuckoo filter does not have.',
        example: '1 999 + 1 999 fingerprints merge into 3 998, exactly, with r going 10 → 9.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));

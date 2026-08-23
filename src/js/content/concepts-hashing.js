/**
 * Concepts for the hashing sections (M03.1-M03.4): hash functions, universal
 * hashing, separate chaining and open addressing.
 *
 * The four scheme sections plus the practice section (M03.5-M03.9) live in
 * concepts-hashing-schemes.js, because one file for the whole milestone runs
 * past the 1 000-line limit once every concept carries its explanation.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'hash-functions': [
      {
        term: 'Avalanche',
        plain: 'Flipping one input bit should flip about half the output bits, and which half should look random.',
        formal: 'P(output bit j flips | input bit i flips) ≈ 0.5',
        readAs: 'Given that you flipped one bit of the input, the chance that any particular output bit flips ' +
          'should be about a half. The vertical bar reads "given that" — everything after it is the ' +
          'condition you are assuming.',
        detail: 'Avalanche is the practical test for whether a hash mixes. Flip one input bit, ' +
          'compare the outputs, and every output bit should flip about half the time — because if ' +
          'some output bit is insensitive to some input bit, then keys differing only there are ' +
          'partly correlated in the hash, and a table will find them clustering. The measurement is ' +
          'a grid: 32 input bits by 32 output bits, each cell a flip probability estimated over many ' +
          'samples. Judging it needs care, since with few samples a cell strays from 0.5 by chance ' +
          'alone; this platform uses a Bonferroni-corrected z-test rather than a fixed 40-60% band ' +
          'for exactly that reason.',
        example: 'murmur3\'s finaliser holds every cell in 0.42–0.58; one shift and an XOR does not.'
      },
      {
        term: 'Finaliser',
        plain: 'The shift-multiply-shift tail that mixes the accumulated state before it is used.',
        formal: 'h ^= h>>>16; h *= C; h ^= h>>>13; …',
        readAs: 'Repeatedly fold the high bits down onto the low ones with a shift and an XOR, then multiply ' +
          'by a constant to smear them back up. Each round moves entropy between the two ends; the ' +
          'pattern is shift, mix, shift, mix.',
        detail: 'The main loop of a hash accumulates bytes cheaply and leaves the state unevenly ' +
          'mixed — in FNV-1a the last byte is still visible in the low bits. The finaliser fixes that ' +
          'in a few instructions: an XOR-shift moves high entropy down, a multiply by an odd ' +
          'constant spreads it back up, and repeating the pair makes every input bit reach every ' +
          'output bit. This is where a hash earns its avalanche, and it is the part people drop when ' +
          'they write their own. The trade is that the finaliser is a fixed cost per call, which is ' +
          'invisible for long keys and dominant for short ones.',
        example: 'FNV-1a without one leaves the low bits correlated with the last byte.'
      },
      {
        term: 'Low bits matter most',
        plain: 'A table masks with capacity − 1, so it uses the *low* bits and throws the rest away.',
        formal: 'slot = h & (m − 1)',
        readAs: 'When the table size m is a power of two, m − 1 is a run of 1 bits, so ANDing against it ' +
          'keeps the low bits and discards the rest. That is the remainder after dividing by m, in a ' +
          'single instruction.',
        detail: 'A power-of-two table computes its slot by masking, which keeps the bottom log₂ m ' +
          'bits and discards everything else. So the quality of the top 22 bits is irrelevant to ' +
          'that table, and a hash with excellent high bits and poor low ones will cluster badly ' +
          'while looking fine in a whole-word test. This is why multiplicative hashes are finished ' +
          'with an XOR-shift that folds high bits down, and why Java\'s HashMap applies its own ' +
          'extra spread to hashCode() results before masking — it does not trust that the low bits ' +
          'of an arbitrary hashCode carry any entropy at all.',
        example: 'A hash whose high bits are excellent and low bits are not is useless to a power-of-two table.'
      },
      {
        term: 'Math.imul',
        plain: 'JavaScript numbers are doubles, so a 32-bit multiply needs the intrinsic or the low bits are lost.',
        formal: 'imul(a, b) = (a·b) mod 2³²',
        readAs: 'A 32-bit multiply keeps only the bottom 32 bits of the product and throws the rest away — ' +
          '"mod 2³²" is exactly that truncation. Plain * in JavaScript would round instead, losing the ' +
          'low bits the mixing depends on.',
        detail: 'Multiplying two 32-bit values can produce 64 bits, and a double holds only 53 ' +
          'exactly, so plain * rounds — and the bits it discards are the low ones, which is exactly ' +
          'the entropy a mixer is trying to propagate. The failure is silent: the code runs, the ' +
          'hash looks plausible, and its avalanche is quietly broken. Math.imul performs the ' +
          'multiplication modulo 2³² the way the hardware does, keeping the low 32 bits, so every ' +
          'mixing step in this platform is written with it. Substituting * anywhere in a finaliser ' +
          'measurably degrades the avalanche grid.',
        example: 'h * 0x85ebca6b silently loses precision past 2⁵³; Math.imul does not.'
      },
      {
        term: 'Chi-squared uniformity',
        plain: 'Compare observed bucket counts against the uniform expectation; the ratio to the degrees of freedom should be near 1.',
        formal: 'χ² = Σ (observed − expected)² / expected',
        readAs: 'For each bucket take how far its count sits from what you expected, square it so sign does ' +
          'not matter, divide by the expected count to keep buckets comparable, and add all of those ' +
          'up. The symbol is a Greek chi, and the whole thing reads "chi-squared".',
        detail: 'Avalanche tests the bits; chi-squared tests the distribution actually produced by ' +
          'your keys. Bucket the hashes, compare each count against the uniform expectation, and ' +
          'normalise by the degrees of freedom so the statistic reads near 1 for a good hash ' +
          'regardless of table size. Both tails are informative: well above 1 means clumping, and ' +
          'far below 1 means the counts are suspiciously even, which happens when the key set is ' +
          'regular and the hash is close to the identity. Run it on your real keys, since a hash can ' +
          'be uniform on random input and terrible on sequential ids.',
        example: 'Well above 1 means clumping; far below 1 means the key set is suspiciously regular.'
      },
      {
        term: 'The hashCombine trap',
        plain: 'XOR-ing field hashes makes (a, b) collide with (b, a), because XOR is commutative.',
        formal: 'h(a) ^ h(b) = h(b) ^ h(a)',
        readAs: 'XOR gives the same answer whichever way round you feed it, so combining two hashes with it ' +
          'cannot tell {a, b} from {b, a}. That is exactly what you want for a set, and exactly what ' +
          'you must not use for an ordered pair.',
        detail: 'Combining field hashes with XOR is the obvious thing to write and it destroys ' +
          'positional information: (a, b) and (b, a) produce the same hash, and any pair of equal ' +
          'fields hashes to zero. For a composite key of (row, column) or (from, to) that is a ' +
          'systematic collision generator built into the key type, and it will not show up until the ' +
          'data happens to contain transposed pairs. The standard fix is an order-dependent ' +
          'combine — Boost\'s seed ^= h + 0x9e3779b9 + (seed<<6) + (seed>>2), or mixing each field ' +
          'through the finaliser before folding it in.',
        example: 'A tuple key of (row, column) collides with (column, row) in half the codebases that hand-roll one.'
      },
      {
        term: 'Which end the consumer reads',
        plain: 'A table masks the low bits; a Swiss table and every displace scheme shift and read the high ones. A hash can be uniform at one end and useless at the other.',
        formal: 'h & (m − 1) against h >>> (32 − k)',
        readAs: 'Two ways to cut a hash down to a table index: keep the low k bits with a mask, or shift the ' +
          'high k bits down into place. They select different halves of the hash, and a weak mixer ' +
          'usually leaves one of those halves much better than the other.',
        detail: 'Different consumers read different ends of the same 32 bits, so "is this hash good" ' +
          'is not a well-formed question until you say which end. A power-of-two table masks and ' +
          'reads the bottom; a Swiss table shifts H1 out of the top; multiply-shift is universal ' +
          'precisely in its high bits. A hash can therefore pass one test and fail the other by ' +
          'three orders of magnitude — on sequential keys djb2 scores a healthy 2.84 on its low 9 ' +
          'bits and 2 536.85 on its top 9. Test the end your table will actually use, and prefer a ' +
          'finaliser that makes the question moot.',
        example: 'On sequential keys djb2 scores 2.84 on its low 9 bits and 2 536.85 on its top 9.'
      },
      {
        term: 'Speed is measured in bytes, not calls',
        plain: 'A hash is charged per byte of key, so key length is part of the cost — and short keys are dominated by the finaliser.',
        formal: 'cost ≈ setup + bytes × per-byte + finalise',
        detail: 'Hash cost splits into a fixed part — setup and finalisation — and a part ' +
          'proportional to the key length, and which dominates depends entirely on your keys. For ' +
          '8-byte keys a murmur-style finaliser is most of the total, so a "faster" hash with a ' +
          'longer tail is slower in practice; for 1 KB keys the finaliser is noise and the per-byte ' +
          'loop is everything. This is why hash benchmarks quoted in GB/s are close to useless for a ' +
          'table of short keys, and why the right comparison is measured at your key length, on your ' +
          'key distribution.',
        example: 'For 8-byte keys a murmur-style finaliser is most of the work; for 1 KB keys it is noise.'
      }
    ],

    'universal-hashing': [
      {
        term: 'Universal family',
        plain: 'A set of hash functions such that any two distinct keys collide with probability at most 1/m when the function is picked at random.',
        formal: 'P_{h∈H}[h(x) = h(y)] ≤ 1/m for x ≠ y',
        readAs: 'Pick a hash function at random from the family H. For any two different keys you care to ' +
          'name, the chance that this randomly chosen function maps them to the same slot is at most 1 ' +
          'in m. The randomness is in the choice of function, never in the keys.',
        detail: 'A single fixed hash function always has bad key sets — the pigeonhole principle ' +
          'guarantees it, and an attacker who can read your source can find them. Universality moves ' +
          'the randomness out of the input and into the choice of function: for any two distinct ' +
          'keys, picked in advance and adversarially, the probability of collision over the random ' +
          'draw of h is at most 1/m. That is a guarantee about every key pair rather than about ' +
          'typical inputs, which is why it survives an adversary. Note what it does not claim: for ' +
          'the function you actually drew, some pair does collide.',
        example: 'The guarantee holds for every key pair, including ones an attacker chose.'
      },
      {
        term: 'Multiply-shift',
        plain: 'Multiply by a random odd number and take the high bits. Two instructions, and universal.',
        formal: 'h(x) = (a·x mod 2^w) >>> (w − m), a odd',
        readAs: 'Multiply the key by a randomly chosen odd number, keep the low w bits, then shift the top m ' +
          'of those down to use as the index. Multiplying carries information upward, so the top bits ' +
          'are the well-mixed ones.',
        detail: 'Dietzfelbinger\'s multiply-shift is about as cheap as a hash can be — one multiply ' +
          'and one shift — and it is provably universal when a is drawn at random from the odd ' +
          'integers. The high bits are the ones with the guarantee, because multiplication mixes ' +
          'upward: bit 0 of the product depends only on bit 0 of the input, while the top bits ' +
          'depend on everything. That is why the shift takes from the top, and why using the low ' +
          'bits of a multiplicative hash forfeits the proof. Choosing the family is just "pick a new ' +
          'odd a", which makes per-process seeding trivial.',
        example: 'Dietzfelbinger\'s scheme; the whole family is "pick a new odd a".'
      },
      {
        term: 'Tabulation hashing',
        plain: 'Split the key into bytes, look each byte up in its own random table, XOR the results.',
        formal: 'h(x) = ⊕ T_i[byte_i(x)]',
        readAs: 'Split the key into bytes, look each byte up in its own table of random numbers, and XOR all ' +
          'the results together. One table per byte position, so the same byte value in a different ' +
          'position gives a different number.',
        detail: 'Tabulation hashing pre-fills one table of random words per byte position, then ' +
          'hashes by XOR-ing the four lookups. It has no arithmetic mixing at all, and it is ' +
          '3-independent — a stronger guarantee than multiply-shift — which is what bounds the ' +
          'longest chain rather than just the mean. In practice it is also fast: the tables are 4 KB ' +
          'and stay resident, so the four lookups hit L1. The costs are that memory, the ' +
          'initialisation, and a key length fixed at table-construction time, which is why it suits ' +
          'integer keys better than arbitrary strings.',
        example: 'Three-independent, four cache lookups, and it beats multiply-shift on adversarial inputs.'
      },
      {
        term: 'Hash flooding',
        plain: 'Send keys that all collide. Insertion becomes quadratic and one request eats a core.',
        formal: 'n keys in one bucket ⇒ Θ(n²) work',
        readAs: 'Land every key in the same bucket and each insert scans everything already there, so n ' +
          'inserts do roughly n²/2 comparisons. The ⇒ is "which means".',
        detail: 'If the hash function is fixed and public, an attacker can precompute keys that all ' +
          'land in one bucket and send them as form fields, JSON keys or headers. Every insertion ' +
          'then walks the whole chain, so n keys cost Θ(n²) comparisons and a few thousand ' +
          'parameters in one request can occupy a core for seconds — a denial of service with no ' +
          'traffic volume behind it. Crosby and Wallach described it in 2003; it was rediscovered ' +
          'against essentially every web framework in 2011, which is when per-process hash seeding ' +
          'became standard everywhere.',
        example: 'Crosby and Wallach, 2003; rediscovered against web frameworks in 2011.'
      },
      {
        term: 'Per-process seed',
        plain: 'Choosing the function at start-up is what makes the attacker\'s precomputation useless.',
        formal: 'seed drawn once from a CSPRNG',
        detail: 'Universality is only worth something if the function is genuinely drawn at random, ' +
          'so the seed is taken once at start-up from a cryptographic source and never shipped in ' +
          'the source. An attacker can then no longer precompute a colliding set, because the target ' +
          'they would need is different in every process. The visible consequence is that iteration ' +
          'order over a hash map differs between runs, which several languages made deliberate and ' +
          'documented so that nobody would depend on it. The other consequence is that a hash value ' +
          'must never be persisted or sent across processes.',
        example: 'It is also why iteration order differs between runs — deliberately.'
      },
      {
        term: 'Keyed hash',
        plain: 'A short-input PRF like SipHash: fast enough for a table, and not invertible without the key.',
        formal: 'SipHash-2-4(k, m)',
        detail: 'Universal families stop an attacker who can only guess the parameter; they do not ' +
          'stop one who can observe outputs and solve for it, which is possible when hash values ' +
          'leak through iteration order or timing. A keyed pseudo-random function like SipHash ' +
          'closes that: without the key, the output is computationally indistinguishable from ' +
          'random, so collisions cannot be constructed even from observations. It costs several ' +
          'times a multiply-shift and is still fast enough to sit under a general-purpose hash map, ' +
          'which is why Rust\'s default hasher and Python\'s string hash both use it.',
        example: 'Rust\'s default hasher and Python\'s string hash both use it.'
      },
      {
        term: 'The randomness is the guarantee',
        plain: 'Universality bounds the collision probability over the random choice of the parameter. A constant shipped in the source has no randomness left.',
        formal: 'P_a[h_a(x) = h_a(y)] ≤ 2/m for fixed x ≠ y',
        readAs: 'For a randomly drawn multiplier a, any two fixed distinct keys collide with probability at ' +
          'most 2 in m. The 2 rather than 1 is the price of the multiply-shift construction being ' +
          'cheap; it costs nothing that matters.',
        detail: 'The probability in the definition is over the draw of the parameter, not over the ' +
          'keys — so a "universal" hash with the parameter hard-coded has a probability of either 0 ' +
          'or 1 for any given pair, and the guarantee has evaporated. The failure is not subtle when ' +
          'the constant is unlucky: multiply-shift with a random odd a collides on adjacent keys ' +
          '0.108% of the time, while the same scheme with a = 2¹⁶ + 1 leaves 960 of 1 024 buckets ' +
          'empty. Copying a hash function out of a paper and pinning its constant is exactly this ' +
          'mistake, and it is common.',
        example: 'Multiply-shift with a random odd a collides on adjacent keys 0.108% of the time; with a = 2¹⁶ + 1 it leaves 960 of 1 024 buckets empty.'
      },
      {
        term: 'Independence, and how much of it',
        plain: 'Pairwise independence is enough for expected chain length; higher independence is what bounds the tail.',
        formal: '2-independent, 3-independent, k-independent families',
        readAs: 'How many keys the family guarantees behave independently at once. 2-independent means any ' +
          'two keys land independently; k-independent extends that to any k of them, and each step up ' +
          'costs more work per hash.',
        detail: 'k-independence says any k distinct keys are mapped independently and uniformly, and ' +
          'the level you need depends on which statistic you are trying to control. Pairwise ' +
          '(2-independent) is enough for the expected chain length, because that is a sum over ' +
          'pairs and linearity of expectation does the rest. Bounding the longest chain requires ' +
          'reasoning about a maximum, which needs a concentration argument, which needs more ' +
          'independence than that. This is why tabulation hashing, at 3-independent, has ' +
          'well-behaved worst-case buckets where multiply-shift does not, despite both being ' +
          'universal.',
        example: 'Tabulation hashing is 3-independent, which is why its worst-case bucket behaves and multiply-shift\'s does not.'
      }
    ],

    'separate-chaining': [
      {
        term: 'Load factor α',
        plain: 'Keys divided by buckets. For chaining it is the expected chain length, and it may exceed 1.',
        formal: 'α = n / m',
        readAs: 'The load factor is the number of entries divided by the number of slots. At 0.75 the table ' +
          'is three-quarters full.',
        detail: 'For a chained table the load factor is literally the average chain length, so it can ' +
          'exceed 1 without anything breaking — at α = 2 the average bucket holds two entries and ' +
          'lookups get proportionally slower, gracefully. That is the structural difference from ' +
          'open addressing, where α is bounded by 1 and the cost blows up as it approaches. The cost ' +
          'model is linear in α rather than hyperbolic: a successful lookup averages about 1 + α/2 ' +
          'comparisons, so 1.4 at α = 0.75. Chaining trades memory and locality for that ' +
          'predictability.',
        example: 'At α = 0.75 a successful lookup averages about 1.4 comparisons.'
      },
      {
        term: 'Poisson occupancy',
        plain: 'Under a good hash, the number of keys in a bucket is Poisson with mean α.',
        formal: 'P(k keys) = e^-α α^k / k!',
        readAs: 'The chance a given bucket holds exactly k keys, when n keys are spread at random over m ' +
          'slots. Read it as: e (2.718…) to the power of minus the load, times the load to the power k, ' +
          'divided by k factorial. This is the Poisson distribution, and it is what makes the longest ' +
          'chain predictable.',
        detail: 'Throwing n keys into m buckets independently and uniformly makes each bucket\'s ' +
          'count binomial, and for large m that is Poisson with mean α. That single fact predicts ' +
          'the whole occupancy distribution without simulation: at α = 1 with 1 000 buckets, about ' +
          '368 are empty, 368 hold one key and 184 hold two. It is also the null hypothesis worth ' +
          'testing against — if your measured distribution has a much heavier tail than Poisson ' +
          'predicts, the hash is not mixing your keys, and you have found a hash problem rather than ' +
          'a table problem.',
        example: 'At α = 1 with 1 000 buckets, expect about 368 empty ones.'
      },
      {
        term: 'Longest chain',
        plain: 'The tail, not the mean, is what a request waits on — and it grows with the table.',
        formal: '≈ ln m / ln ln m at α = 1',
        readAs: 'With as many keys as slots, the longest chain is about the natural log of m divided by the ' +
          'natural log of that — a number that grows extremely slowly. At a million slots it is roughly ' +
          '5.',
        detail: 'A user does not experience the average bucket, they experience the one their key ' +
          'landed in, and the maximum over m buckets grows with m even at a fixed load factor. The ' +
          'asymptotic form ln m / ln ln m drops constants that matter at real sizes: at m = 1 000 ' +
          'the expected maximum is about 6, not the 1 the mean suggests. So a table can have an ' +
          'excellent average and a tail six times worse, which is what shows up in p99 latency. It ' +
          'is also the reason "the average chain is short" is not an answer to a hash-flooding ' +
          'concern.',
        example: 'About 6 for a thousand buckets, not 1.'
      },
      {
        term: 'Treeification',
        plain: 'Convert a bucket to a search structure once it gets long, bounding the damage at O(log k).',
        formal: 'list → tree at k ≥ 8',
        detail: 'Once a bucket exceeds a threshold, the JDK replaces its linked list with a red-black ' +
          'tree, so the worst case inside one bucket falls from O(k) to O(log k). The purpose is ' +
          'containment rather than speed: on well-mixed keys the threshold essentially never fires, ' +
          'so it buys nothing in normal operation and costs a comparison in the insert path. It is ' +
          'insurance against the adversarial case, and its value is measured in what it prevents — ' +
          'which is why it was added as a security response rather than as a performance change.',
        example: 'The JDK does this; it is a hash-flooding mitigation, not an optimisation.'
      },
      {
        term: 'Node overhead',
        plain: 'Chaining allocates per entry: a key, a value, a next pointer and an allocator header.',
        formal: 'bytes ≈ m·8 + n·32',
        detail: 'Every entry in a chained table is a separately allocated node carrying a next ' +
          'pointer and an allocator header on top of the key and value, so the table costs roughly ' +
          'm pointers for the bucket array plus about 32 bytes per entry. Open addressing stores ' +
          'entries directly in the slot array and allocates nothing per entry, which is both less ' +
          'memory and better locality — the entries are contiguous instead of scattered. This ' +
          'memory difference, not the probe counts, is usually what decides between the two schemes ' +
          'in practice.',
        example: 'Open addressing stores the entry in the slot array and allocates nothing.'
      },
      {
        term: 'Sparse iteration',
        plain: 'Iterating a chained table walks every bucket, including the empty ones.',
        formal: 'Θ(m + n)',
        detail: 'Iteration has to visit every bucket to find the non-empty ones, so it costs Θ(m + n) ' +
          'rather than Θ(n). For a table that grew large and was then mostly emptied, that is ' +
          'dominated by m: iterating a million-bucket table holding ten entries reads a million ' +
          'pointers. Nothing shrinks the bucket array unless the implementation explicitly does so, ' +
          'which is why a long-lived cache that is iterated regularly can pay a cost proportional to ' +
          'its historical peak forever. Structures that keep a dense entries array alongside the ' +
          'index — like JavaScript\'s Map — do not have this problem.',
        example: 'A table that grew and then emptied still costs Θ(m) to iterate.'
      },
      {
        term: 'The threshold rarely fires',
        plain: 'Treeification is insurance, not an optimisation: at α = 1 a bucket reaches 8 entries with probability 10⁻⁵.',
        formal: 'P(X ≥ 8) = 1 − Σ_{k≤7} e^−α α^k/k!',
        readAs: 'The chance a bucket reaches eight or more is one minus the chance it holds seven or fewer, ' +
          'and that second part is just the Poisson probabilities for 0 through 7 added up. Subtract ' +
          'from 1 because it is easier to total the small cases than the unbounded tail.',
        detail: 'The Poisson tail makes the treeify threshold almost unreachable by chance: at α = 1 ' +
          'the probability a given bucket reaches 8 entries is about 1.0 × 10⁻⁵, so in a table of a ' +
          'thousand buckets it fires roughly once in a hundred tables. The measured consequence is ' +
          'that a well-mixed workload costs exactly the same with the threshold and without it — ' +
          '1 537 insert comparisons either way, identical to the probe. That is the correct result ' +
          'for a mitigation, and it is worth knowing before attributing any performance improvement ' +
          'to it.',
        example: 'On well-mixed keys the same table costs 1 537 insert comparisons with the threshold and without it — identical, to the probe.'
      },
      {
        term: 'Bounded, not defeated',
        plain: 'Treeifying does not shorten the flooded bucket. It shortens the walk through it, which is all that was needed.',
        formal: 'O(k) → O(log k) inside one bucket',
        detail: 'It is easy to misread treeification as fixing the collision, and it does not: after ' +
          'the mitigation the crafted bucket still holds every one of the 1 024 attacker keys, and ' +
          'the memory is still consumed. What changes is the cost of traversing it — 9.01 probes per ' +
          'lookup instead of 512.5 — which converts a quadratic denial of service into an ordinary ' +
          'slowdown. That is the right goal for a mitigation, and stating it precisely matters, ' +
          'because a defence that bounds damage is often mistaken for one that prevents the attack.',
        example: 'After the mitigation the crafted bucket still holds all 1 024 keys, at 9.01 probes per lookup instead of 512.5.'
      }
    ],

    'open-addressing': [
      {
        term: 'Probe sequence',
        plain: 'The order of slots a key visits. Linear is h+i, quadratic is h+i(i+1)/2, double hashing is h₁+i·h₂.',
        formal: 'slot(i) = (h + f(i)) mod m',
        readAs: 'The i-th slot a probe tries is the home slot plus some offset f(i), wrapped around the ' +
          'table. Choosing f is what separates linear probing (f(i) = i) from quadratic and double ' +
          'hashing.',
        detail: 'With no chains, a key that finds its home slot taken must have a deterministic order ' +
          'of alternatives, and that order is the design decision the whole scheme turns on. The ' +
          'requirement is that it be a permutation of the table — if the sequence cycles before ' +
          'visiting every slot, an insert can fail while the table still has room, which is a ' +
          'correctness bug rather than a performance one. Quadratic probing with triangular numbers ' +
          'is a permutation on power-of-two tables; double hashing needs its second hash to be odd. ' +
          'Both details are easy to get wrong and produce failures only under load.',
        example: 'The sequence must visit every slot, or an insert can fail in a table with room.'
      },
      {
        term: 'Primary clustering',
        plain: 'Linear probing makes occupied runs, and a long run captures more keys, making it longer.',
        formal: 'runs grow superlinearly in α',
        detail: 'Linear probing has a positive feedback loop: any key hashing anywhere into an ' +
          'occupied run is appended to its end, so long runs capture more keys and grow faster than ' +
          'short ones. The result is that cost rises superlinearly with load, much worse than the ' +
          'independent-probe idealisation predicts. The compensation is that the run is contiguous ' +
          'memory, so walking it is nearly free in cache terms — which is why linear probing remains ' +
          'the fastest choice at moderate load despite having the worst clustering behaviour of the ' +
          'three sequences.',
        example: 'It is also why linear probing is fast: the run is contiguous memory.'
      },
      {
        term: 'The 1/(1−α) wall',
        plain: 'Expected probes blow up as the table fills, and the blow-up is sudden.',
        formal: '½(1 + 1/(1−α)) for a hit',
        readAs: 'The expected probes for a successful linear-probing lookup: one half of (1 plus 1 divided by ' +
          'the space left). At α = 0.5 that is 1.5 probes; at α = 0.9 it is 5.5, and the 1/(1−α) is ' +
          'what makes it explode as the table fills.',
        detail: 'The cost of open addressing is hyperbolic in the load factor, not linear, so the ' +
          'behaviour near full is qualitatively different from the behaviour at moderate load: a ' +
          'successful lookup averages 5.5 probes at α = 0.9 and 10.5 at α = 0.95. Five percentage ' +
          'points of load doubles the cost. This is why every implementation resizes well before the ' +
          'table is full, and why the growth threshold is one of the most consequential constants in ' +
          'a hash table — and also why a table whose load creeps up in production degrades suddenly ' +
          'rather than gradually.',
        example: 'α = 0.9 costs 5.5 probes; α = 0.95 costs 10.5.'
      },
      {
        term: 'Tombstone',
        plain: 'A marker meaning "something was here, keep probing". Needed because emptying a slot breaks probe sequences.',
        formal: 'state ∈ {empty, full, deleted}',
        readAs: 'Every slot is in exactly one of three states — the ∈ means "is one of". Two states are not ' +
          'enough: a deleted slot has to stop a lookup from concluding early without stopping it from ' +
          'continuing.',
        detail: 'A probe stops at the first empty slot, so simply emptying a slot on delete would cut ' +
          'every probe chain running through it and lose keys that are still in the table. The ' +
          'tombstone is a third state that says "keep going": probes pass through it, and inserts ' +
          'may reuse it. The cost is that a tombstone occupies a slot for probing purposes while ' +
          'counting as absent for size purposes, so a delete-heavy workload fills the table with ' +
          'markers and probe lengths rise even though the live count is falling. Growth decisions ' +
          'therefore have to count tombstones.',
        example: 'A tombstone counts against the load factor for probing and not for size.'
      },
      {
        term: 'Backward-shift deletion',
        plain: 'For linear probing: walk forward and pull back any entry whose home is at or before the hole.',
        formal: 'move if dist(gap, home) < dist(cursor, home)',
        detail: 'Instead of leaving a marker, backward-shift deletion repairs the run: walk forward ' +
          'from the hole and move back any entry that would still be findable from its home slot ' +
          'through the new gap, then repeat with the new hole. The table is left in exactly the ' +
          'state it would have been in had the key never been inserted, so there is no accumulating ' +
          'debt and no rehash-to-clean. It costs a loop per delete rather than a constant, and it ' +
          'relies on runs being contiguous — which is why it belongs to linear probing and not to ' +
          'the other sequences.',
        example: 'No tombstones at all, at the cost of a loop per delete.'
      },
      {
        term: 'Cache locality',
        plain: 'A probe run is consecutive memory, so the prefetcher has already fetched the next slot.',
        formal: 'sequential access, one line per 4-8 slots',
        detail: 'Probe counts systematically overstate the cost of linear probing, because the probes ' +
          'after the first are usually free: the run is contiguous, a 64-byte line holds four to ' +
          'eight slots, and the prefetcher has the next line in flight. A chained table with a lower ' +
          'probe count pays a dependent pointer dereference for each step, and those are the ' +
          'expensive kind. This is the concrete reason open addressing outperforms chaining in ' +
          'practice at moderate load despite worse asymptotic behaviour near full, and why the ' +
          'metric worth reporting is misses rather than probes.',
        example: 'This is why open addressing beats chaining despite worse asymptotics near full.'
      },
      {
        term: 'Secondary clustering',
        plain: 'Quadratic probing removes the runs but keeps one flaw: two keys with the same home follow the same sequence forever.',
        formal: 'the step depends on i, not on the key',
        detail: 'Quadratic probing breaks up the contiguous runs of linear probing, and at α = 0.9 it ' +
          'roughly halves the cost of a successful lookup. What it does not fix is that the step ' +
          'pattern depends only on the probe index, so all keys sharing a home slot walk the same ' +
          'path and collide with each other at every step. That is secondary clustering, and it is ' +
          'why the improvement is a constant factor rather than a change of behaviour — the ' +
          'measured table still contains a 97-slot run at that load. Double hashing removes it by ' +
          'making the step itself key-dependent.',
        example: 'At α = 0.9 quadratic probing halves the hit cost against linear and still leaves a 97-slot run.'
      },
      {
        term: 'Deletion decides the probe sequence',
        plain: 'Backward-shift deletion needs every key in the run to have probed through the hole, which only linear probing guarantees.',
        formal: 'contiguous runs ⇒ shiftable; scattered steps ⇒ tombstones',
        detail: 'The choice of probe sequence and the choice of deletion strategy are not ' +
          'independent, which is the point most treatments leave out. Backward shift works because ' +
          'linear probing visits consecutive slots, so every key that could be affected by the hole ' +
          'lies in the contiguous run after it and can be found by walking forward. Quadratic ' +
          'probing and double hashing scatter their steps across the table, so the keys whose chains ' +
          'pass through a given slot cannot be enumerated without scanning everything — leaving ' +
          'tombstones as the only practical option, with all the maintenance they imply.',
        example: 'Quadratic and double hashing cannot delete without tombstones; linear probing can.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));

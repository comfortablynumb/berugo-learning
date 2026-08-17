/**
 * Worked examples for the hashing sections (M03).
 * Figures are recomputed by tests/unit/worked-examples-hashing.test.js.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'hash-functions': [{
      title: 'Decide how many avalanche samples the verdict needs',
      goal: 'Turn "each output bit should flip 40-60% of the time" into a sample count.',
      setup: 'A 32x32 avalanche matrix (1 024 cells), each cell an estimated probability, and a pass ' +
        'band of 0.40 to 0.60.',
      steps: [
        { do: 'Write down the standard error of one cell.', why: 'Each cell is a proportion estimated from n Bernoulli trials.',
          work: 'SE = sqrt(p(1-p)/n) = sqrt(0.25/n)\nn = 256  ⇒ SE = 0.0313\nn = 1024 ⇒ SE = 0.0156',
          result: 'At 256 samples a cell is only known to about 3 points.' },
        { do: 'Account for taking the worst of 1 024 cells.', why: 'The extreme of many estimates strays much further than any one of them.',
          work: 'Bonferroni at family-wise 1%: z = Φ⁻¹(1 − 0.005/1024) ≈ 4.06\nuse z = 4.1',
          result: 'A good mixer can legitimately produce a cell 4.1 standard errors from 0.5.' },
        { do: 'Solve for the sample count the band needs.', why: 'The band is ±0.10, so it must be at least z standard errors wide.',
          work: 'z · SE ≤ 0.10\n4.1 · sqrt(0.25/n) ≤ 0.10\nn ≥ 0.25 / (0.10/4.1)² = 421',
          result: 'Below 421 samples the 40-60% band rejects good functions.' },
        { do: 'Check it against the real thing.', why: 'The prediction should show up as murmur3 failing and then passing.',
          work: 'murmur3 finaliser at n = 256:  range 0.391–0.633, worst 4.25σ ⇒ fails\nmurmur3 finaliser at n = 512:  range 0.420–0.570, worst 3.62σ ⇒ passes\nweak finaliser at n = 512:     range 0.000–1.000, worst 22.6σ ⇒ fails',
          result: 'The weak function fails by 22 standard errors; murmur3 at 256 fails by 0.15.' },
        { do: 'Note what the histogram would have told you.', why: 'Uniformity and avalanche are different properties, and only one of them is usually checked.',
          work: 'chi²/dof over 512 buckets, 4 096 word-like keys:\nmurmur3: 0.971\nweak:    0.965',
          result: 'The distribution test cannot tell them apart at all.' }
      ],
      answer: 'The 40-60% band needs at least 421 samples to be a criterion rather than noise; below ' +
        'that, test the deviation in standard errors instead. And the chi-squared readout gives 0.97 ' +
        'for both a good mixer and a broken one, so it cannot substitute for the avalanche test.'
    }, {
      title: 'Find out which end of the hash is broken',
      goal: 'Test the low bits and the high bits separately, because a table only ever uses one of them.',
      setup: '4 096 keys into 512 buckets, measured as chi²/dof. Two reductions: the low 9 bits ' +
        '(h & 511, what a power-of-two table takes) and the top 9 bits (h >>> 23, what a Swiss table\'s ' +
        'H1 and every hash-and-displace scheme take).',
      steps: [
        {
          do: 'Measure both ends on word-like keys.',
          why: 'This is the benign case, and it should look fine everywhere.',
          work: '            low 9 bits   top 9 bits\n' +
            'FNV-1a         0.794        1.242\n' +
            'djb2           1.465       67.818\n' +
            'murmur3        0.971        1.009',
          result: 'One of these is not like the others, and only the second column shows it.'
        },
        {
          do: 'Switch to sequential keys, which is what ids look like.',
          why: 'Structured keys are the normal case, not the adversarial one.',
          work: '            low 9 bits   top 9 bits   worst bucket (top)\n' +
            'FNV-1a         0.863        1.556        20 of 4,096\n' +
            'djb2           2.843     2,536.851     3,096 of 4,096\n' +
            'murmur3        1.009        0.976        18 of 4,096',
          result: 'djb2 puts 76% of the keys in one bucket — if you read its high bits.'
        },
        {
          do: 'Explain it from the recurrence, not from the measurement.',
          why: 'A number without a mechanism is a coincidence until you find the mechanism.',
          work: 'djb2: h ← 33·h + c\n' +
            'the last character moves the low bits by c and the high bits by almost nothing\n' +
            'after k characters the top bits are dominated by 33^k · h₀, which barely varies',
          result: 'The high bits are a function of the length, not of the characters.'
        },
        {
          do: 'Ask which end each consumer actually reads.',
          why: 'The same hash is fine in one table and catastrophic in another.',
          work: 'chained/open table:  h mod 2^k  ⇒ low bits\n' +
            'Swiss table H1:      h >>> 7     ⇒ high bits\n' +
            'CHD / FKS:           h mod n     ⇒ low bits, but modulo a non-power of two\n' +
            'a shard picker:      h >>> 24    ⇒ high bits',
          result: 'Two of these four would have shipped djb2 successfully.'
        },
        {
          do: 'State the rule the two columns give.',
          why: 'This is the reason every serious hash ends with a finaliser.',
          work: 'a finaliser makes both columns pass: murmur3 is 1.009 and 0.976\n' +
            'without one you must know which bits your consumer takes — for every consumer, forever',
          result: 'Finalise, and stop having to know.'
        }
      ],
      answer: 'On sequential keys djb2 scores 2.84 on its low bits and 2 536.85 on its high bits, ' +
        'with 3 096 of 4 096 keys in one bucket — while murmur3 scores 1.009 and 0.976. Which end you ' +
        'read is a property of the table, not of the hash, so a hash without a finaliser is only safe ' +
        'until someone changes the table.'
    }],

    'universal-hashing': [{
      title: 'Price a hash-flooding attack, then price each defence',
      goal: 'Put numbers on the attack, the offline cost of mounting it, and what each fix buys.',
      setup: 'A chained table with 1 024 fixed buckets using djb2, and an attacker posting 2 000 ' +
        'parameter names chosen to land in bucket 0.',
      steps: [
        { do: 'Cost the attacker\'s search.', why: 'One candidate in m lands in the target bucket.',
          work: 'P(a candidate collides) = 1/1024\nexpected candidates for 2 000 keys ≈ 2,048,000\nmeasured: 2,124,047 hashed',
          result: 'About 2.1 million hashes — well under a second, done once, offline.' },
        { do: 'Cost the server\'s insertion.', why: 'Every insert walks the chain the previous inserts built.',
          work: 'comparisons = 1 + 2 + … + 2,000 = 2000 × 2001 / 2 = 2,001,000\nmeasured: 2,001,000',
          result: 'Two million comparisons for one request, exactly the closed form.' },
        { do: 'Cost a lookup.', why: 'Reading a parameter is now a chain walk.',
          work: 'a successful lookup stops at its own entry, so it averages half the chain\n(1 + 2 + … + 2,000) / 2,000 = 1,000.5\nmeasured: 1,000.5 comparisons per lookup, 2,000 for the last key inserted',
          result: 'Every parameter read costs about a thousand comparisons instead of one.' },
        { do: 'Apply the treeify mitigation.', why: 'It keeps the weak hash and bounds the bucket at O(log k).',
          work: 'insert comparisons: 19,238 (from 2,001,000) = 104× less\nper lookup: 9.98, against log2(2,000) = 10.97',
          result: 'The attack survives but stops being a denial of service.' },
        { do: 'Apply a per-process keyed hash.', why: 'The precomputed key set is worthless against a function chosen at start-up.',
          work: 'longest bucket: 9 (against 2,000)\ninsert comparisons: 3,949 = 507× less\nper lookup: 1.97',
          result: 'The payload becomes 2 000 ordinary keys.' },
        { do: 'Compare the two defences honestly.', why: 'They fix different things and one of them is not optional.',
          work: 'treeify:  104× better, works on keys you already hashed, no seed needed\nkeyed:    507× better, but only if the seed is per-process and never persisted',
          result: 'Use both: the seed stops the attack, treeification bounds whatever gets through.' }
      ],
      answer: 'Two million comparisons for one request, bought with 2.1 million offline hashes. ' +
        'Treeification cuts the server cost 104×; a per-process keyed hash cuts it 507× and reduces ' +
        'the longest bucket from 2 000 to 9.'
    }, {
      title: 'Check universality by testing the multiplier, not the keys',
      goal: 'See what "choose a at random" buys, and what a fixed clever constant does not.',
      setup: 'Multiply-shift into 1 024 buckets: h(x) = (a·x mod 2³²) >>> 22, with a odd. ' +
        '40 000 trials, and 4 096 keys spaced exactly 65 536 apart.',
      steps: [
        {
          do: 'Test the guarantee the family actually makes.',
          why: 'Universality is a statement about the random choice of a, for every fixed pair of keys.',
          work: 'fix the worst pair we can think of: x and x + 1\n' +
            'draw a fresh odd a on each of 40,000 trials\n' +
            'collisions: 43 ⇒ rate 0.00108\n' +
            'the bound: 2/m = 2/1024 = 0.00195',
          result: 'Measured 0.00108 against a promised ceiling of 0.00195.'
        },
        {
          do: 'Now fix a and vary the keys instead.',
          why: 'This is what actually ships: one constant, chosen once, and keys you do not control.',
          work: 'a = 2,654,435,769 (2³² / φ), keys spaced 65,536 apart:\n' +
            'chi²/dof 0.17, worst bucket 6, 0 buckets empty',
          result: 'A good fixed constant survives structured keys.'
        },
        {
          do: 'Change the constant to one that looks equally reasonable.',
          why: 'Odd is the only requirement the theorem states, and odd is not enough in practice.',
          work: 'a = 65,537 = 2¹⁶ + 1, same keys:\n' +
            'chi²/dof 60.06, worst bucket 64, 960 of 1,024 buckets empty\n' +
            'a = 3, same keys: chi²/dof 17.36, 832 empty',
          result: 'Both are odd, both are universal on average, and both are terrible here.'
        },
        {
          do: 'Reconcile the two results.',
          why: 'The theorem is not wrong; it is a statement about a different experiment.',
          work: 'universality: P over random a, for fixed keys, ≤ 2/m\n' +
            'this test:    fixed a, adversarial keys — the theorem says nothing\n' +
            'a random a would land on a bad constant with probability ~2/m as well',
          result: 'The guarantee lives in the randomness, and a shipped constant has none.'
        },
        {
          do: 'Try the construction that does not depend on the constant.',
          why: 'Tabulation hashing gets its randomness from tables, not from one multiplier.',
          work: 'four 256-entry tables of random 32-bit words, XOR-ed by byte\n' +
            'same spaced keys: chi²/dof 0.889',
          result: 'Uniform on the keys that broke two of the three multipliers.'
        }
      ],
      answer: 'Over random multipliers the collision rate on adjacent keys is 0.00108 against the ' +
        'promised 2/m = 0.00195. Fix the multiplier and the guarantee goes with it: 2¹⁶ + 1 leaves ' +
        '960 of 1 024 buckets empty on keys spaced 65 536 apart, where the golden-ratio constant ' +
        'scores 0.17 and tabulation hashing scores 0.889.'
    }],

    'separate-chaining': [{
      title: 'Predict the bucket distribution before running it',
      goal: 'Get the empty-bucket count and the longest chain from the Poisson model.',
      setup: '1 000 buckets holding 1 000 keys under a well-mixed hash, so α = 1.',
      steps: [
        { do: 'State the model.', why: 'Each key picks a bucket independently and uniformly, which is a Poisson limit.',
          work: 'P(bucket holds k keys) = e^-α α^k / k!\nα = 1000/1000 = 1',
          result: 'P(k) = e^-1 / k! = 0.3679 / k!' },
        { do: 'Count the empty buckets.', why: 'This is the number people get wrong: it is not close to zero.',
          work: 'P(0) = e^-1 = 0.3679\nempty ≈ 1000 × 0.3679 = 368',
          result: 'Over a third of the table is empty at a load factor of exactly 1.' },
        { do: 'Count the singletons and the crowded buckets.', why: 'The shape matters more than the mean.',
          work: 'P(1) = e^-1 = 0.3679 ⇒ 368 buckets\nP(2) = e^-1/2 = 0.1839 ⇒ 184\nP(≥5) = 1 − Σ_{k≤4} = 0.00366 ⇒ 3.7 buckets',
          result: 'About 4 buckets hold 5 or more keys.' },
        { do: 'Find the longest chain.', why: 'It is the tail, and the tail is what a request waits on.',
          work: 'smallest k with 1000·P(X ≥ k) < 1:\nP(≥6) = 0.000594 ⇒ 0.59 buckets\nP(≥5) = 0.00366  ⇒ 3.7 buckets',
          result: 'The longest chain is 5 or 6, not 1 — five times the mean.' },
        { do: 'Price the lookup.', why: 'This is the number the mean does predict correctly.',
          work: 'successful lookup ≈ 1 + α/2 = 1.5 comparisons\nunsuccessful  ≈ α = 1.0',
          result: 'The average is fine. The worst bucket is 5× it, and adversarial keys make it n.' }
      ],
      answer: 'At α = 1 with 1 000 buckets: 368 buckets empty, 368 holding one key, about 4 holding ' +
        'five or more, and a longest chain of 5 or 6. The mean of 1.5 comparisons is accurate and ' +
        'says nothing about the bucket your slowest request lands in.'
    }, {
      title: 'Find out what treeification costs when nothing goes wrong',
      goal: 'Measure the mitigation on the workload it was not written for, then on the one it was.',
      setup: 'A 1 024-bucket chained table holding 1 024 keys (α = 1), growth disabled, with and ' +
        'without a treeify threshold of 8. Once with well-mixed keys, once with 1 024 keys crafted to ' +
        'collide under djb2.',
      steps: [
        {
          do: 'Run the ordinary workload both ways.',
          why: 'A mitigation that costs something on the common path is a different trade.',
          work: 'treeifyAt 0: 1,537 insert comparisons, longest chain 5, 1.50 per lookup\n' +
            'treeifyAt 8: 1,537 insert comparisons, longest chain 5, 1.50 per lookup\n' +
            'buckets treeified: 0',
          result: 'Byte for byte identical: at α = 1 no bucket ever reaches 8.'
        },
        {
          do: 'Confirm that from the distribution rather than the run.',
          why: 'It should be predictable from the Poisson model in the first example.',
          work: 'P(bucket ≥ 8) = 1 − Σ_{k≤7} e⁻¹/k! = 1.02 × 10⁻⁵\n' +
            'expected buckets over the threshold: 1,024 × 1.01 × 10⁻⁵ = 0.0105',
          result: 'One table in a hundred has a single treeified bucket. The cost is zero.'
        },
        {
          do: 'Now run the crafted keys.',
          why: 'This is the case the threshold exists for, and the same code path.',
          work: 'treeifyAt 0: 524,800 insert comparisons, 512.5 per lookup\n' +
            'treeifyAt 8:   8,890 insert comparisons,   9.01 per lookup\n' +
            'buckets treeified: 1, and it still holds all 1,024 keys',
          result: '59× less insert work and 57× less lookup work, from one threshold.'
        },
        {
          do: 'Check the shape of the survivor.',
          why: 'The attack is not defeated, it is bounded — and the difference matters.',
          work: 'longest chain: still 1,024 keys in one bucket\n' +
            'cost of reaching one: log₂(1,024) = 10 comparisons instead of 512.5\n' +
            'memory: unchanged',
          result: 'The bucket is as long as ever; only the walk got shorter.'
        }
      ],
      answer: 'At α = 1 the treeify threshold never fires — 1 537 insert comparisons and 1.50 per ' +
        'lookup either way, because a bucket reaches 8 with probability 9 × 10⁻⁷. On crafted keys the ' +
        'same threshold turns 524 800 insert comparisons into 8 890 and 512.5 probes per lookup into ' +
        '9.01, while the flooded bucket still holds all 1 024 keys.'
    }],

    'open-addressing': [{
      title: 'Watch a tombstoned table degrade at constant load factor',
      goal: 'Show that the monitored numbers stay flat while lookups get 171× slower.',
      setup: '1 024 slots, linear probing, 716 live keys (α = 0.70), then 5 000 operations that each ' +
        'delete one live key and insert one new key. Growth is disabled.',
      steps: [
        { do: 'Measure the fresh table.', why: 'This is the baseline the closed forms predict.',
          work: 'theory, hit:  ½(1 + 1/(1−0.70)) = 2.17\ntheory, miss: ½(1 + 1/(1−0.70)²) = 6.06\nmeasured: 2.11 hit, 6.0 miss',
          result: 'Theory and measurement agree to within 3%.' },
        { do: 'Run the churn and check the monitored numbers.', why: 'These are what an operator sees on a dashboard.',
          work: 'live keys:     716 → 716\nload factor:   0.70 → 0.70\nsize:          unchanged',
          result: 'Nothing an operator watches has moved at all.' },
        { do: 'Count the tombstones.', why: 'They are the state the load factor does not include.',
          work: 'after 5 000 operations: 308 tombstones\n716 live + 308 tombstones = 1 024 = every slot',
          result: 'There is no empty slot left anywhere in the table.' },
        { do: 'Re-measure the lookups.', why: 'An unsuccessful search stops at the first empty slot — and there is none.',
          work: 'hit:  2.11 → 5.01 probes  (2.4×)\nmiss: 6.0 → 1,024 probes  (171×)',
          result: 'Every lookup for an absent key now scans the entire table.' },
        { do: 'Run the same workload with backward-shift deletion.', why: 'The fix is a loop, not a rewrite.',
          work: 'hit:  2.11 → 2.26\nmiss: 6.0 → 5.5\ntombstones: 0 throughout',
          result: 'Flat, because the table never stops having empty slots.' }
      ],
      answer: 'After 5 000 delete-and-insert operations the live count, size and load factor are ' +
        'identical, 308 tombstones have filled every remaining slot, and a lookup for a missing key ' +
        'costs 1 024 probes instead of 6. Backward-shift deletion holds it at 5.5.'
    }, {
      title: 'Run three probe sequences over the same keys',
      goal: 'Separate what clustering costs from what the load factor costs.',
      setup: 'The same key stream at α = 0.9, growth disabled: 921 keys in 1 024 slots for linear and ' +
        'quadratic probing, 927 in 1 031 for double hashing (a prime, so the second hash can step ' +
        'anywhere).',
      steps: [
        {
          do: 'Write down what the closed form predicts.',
          why: 'The formula is derived for uniform probing, so the gap is the clustering.',
          work: 'hit:  ½(1 + 1/(1 − 0.9))  = 5.50\n' +
            'miss: ½(1 + 1/(1 − 0.9)²) = 50.5',
          result: 'A prediction for the sequence with no clustering at all.'
        },
        {
          do: 'Measure the three.',
          why: 'One number per sequence, on the same keys, at the same load.',
          work: '             hit    miss   longest cluster   worst insert\n' +
            'linear       4.64   31.2        126               97\n' +
            'quadratic    2.55   11.1         97               21\n' +
            'double       2.55   10.2         44               31',
          result: 'Quadratic and double halve the hit cost and cut the miss cost 3×.'
        },
        {
          do: 'Attribute the difference.',
          why: 'The three sequences differ in exactly one property, and it is visible in the clusters.',
          work: 'linear:    keys with the same home *and* keys displaced into it share a run\n' +
            '           ⇒ primary clustering, longest run 126 slots\n' +
            'quadratic: same home ⇒ same sequence, different homes diverge\n' +
            '           ⇒ secondary clustering only, longest run 97\n' +
            'double:    the step itself depends on the key ⇒ longest run 44',
          result: 'Runs of 126, 97 and 44 slots, from the same 921 keys.'
        },
        {
          do: 'Say what linear probing is buying with those clusters.',
          why: 'It is still the default in every high-performance table, and not by accident.',
          work: 'a run of 126 slots at 8 bytes each = 1,008 bytes = 16 cache lines, read sequentially\n' +
            'quadratic step i²: slots 1, 3, 6, 10, … — a new line almost every probe\n' +
            'double hashing: a new line every probe, and a second hash to compute',
          result: '4.64 sequential probes can be cheaper than 2.55 scattered ones.'
        },
        {
          do: 'Note what each sequence gives up.',
          why: 'Two of the three cannot use the backward-shift deletion from the first example.',
          work: 'backward shift needs "every key between home and here belongs to this run"\n' +
            'linear:    holds       ⇒ tombstone-free deletion, 0 tombstones after any churn\n' +
            'quadratic: step i² skips slots ⇒ tombstones required\n' +
            'double:    step depends on the key ⇒ tombstones required',
          result: 'The sequence with the worst clustering is the only one that can delete cleanly.'
        }
      ],
      answer: 'At α = 0.9 the same keys cost 4.64 probes on a hit with linear probing, 2.55 with ' +
        'quadratic and 2.55 with double hashing, and the longest cluster falls from 126 slots to 97 ' +
        'to 44. Linear probing pays in probes and is repaid in cache lines — and it is the only one ' +
        'of the three that can delete without tombstones.'
    }],

    'robin-hood': [{
      title: 'Separate the mean from the tail',
      goal: 'Show what Robin Hood changes and what it cannot change.',
      setup: '2 048 slots, 1 740 keys (α = 0.85), the same key stream through linear probing, Robin ' +
        'Hood, hopscotch with H = 8 and cuckoo hashing.',
      steps: [
        { do: 'Note what the load factor already fixes.', why: 'No rearrangement can change the total displacement.',
          work: 'total displacement is a property of the key-to-slot assignment\nmean distance: linear 2.88, robin hood 2.88',
          result: 'Identical to two decimal places, as they must be.' },
        { do: 'Compare the spread.', why: 'This is the quantity Robin Hood exists to reduce.',
          work: 'variance: 68.77 → 9.16  (7.5× lower)\np99:      44 → 14\nworst:    92 → 17',
          result: 'Same mean, a fifth of the tail.' },
        { do: 'Check hopscotch at H = 8.', why: 'A hard bound on distance is a hard bound on load factor too.',
          work: 'it could not place every key within 8 slots at α = 0.85\nit grew once: 4 096 slots, final load 0.42, worst distance 7\nat H = 32 it holds α = 0.85 with worst distance 31',
          result: 'The neighbourhood bound is real, and it costs either memory or a larger H.' },
        { do: 'Check cuckoo.', why: 'It is the only scheme here with a worst-case guarantee.',
          work: 'two tables of 1 740 slots = 3 480 slots for 1 740 keys\nload 0.50, 0 insertion cycles, lookup always 2 probes',
          result: 'Worst case 2, at twice the memory.' },
        { do: 'Pick by the number you care about.', why: 'The four schemes are not ranked; they answer different questions.',
          work: 'lowest mean at high load: linear or robin hood (2.88)\nlowest tail at high load: robin hood (p99 14)\nhard bound, high load:    cuckoo (2 probes, 2× memory)\nhard bound, cache-shaped: hopscotch (H slots, needs headroom)',
          result: 'Tail latency picks Robin Hood; a hard SLA picks cuckoo.' }
      ],
      answer: 'At α = 0.85 linear probing and Robin Hood share a mean of 2.88 probes, and their tails ' +
        'differ by 5×: p99 of 44 against 14, worst case 92 against 17. Hopscotch with H = 8 cannot ' +
        'reach that load at all and grows to α = 0.42; cuckoo guarantees 2 probes at α = 0.50.'
    }, {
      title: 'Price Robin Hood on the insert side',
      goal: 'Find what the variance reduction costs, since it cannot be free.',
      setup: '1 740 keys into 2 048 slots (α = 0.85), the same stream through linear probing and ' +
        'through Robin Hood, counting probes and writes rather than distances.',
      steps: [
        {
          do: 'Count the probes both schemes make while inserting.',
          why: 'If Robin Hood probed more, the whole scheme would be a bad trade.',
          work: 'linear probing: 6,757 probes over 1,740 inserts\n' +
            'robin hood:     6,757 probes over 1,740 inserts',
          result: 'Identical — the probe sequence is the same walk.'
        },
        {
          do: 'Count the writes.',
          why: 'This is where the difference lives, and it is the number nobody quotes.',
          work: 'linear probing: 1 write per insert (place the key at the first free slot)\n' +
            'robin hood:     1 write + 2,537 displacements over 1,740 inserts\n' +
            '                = 2.46 writes per insert',
          result: '2.5× the memory writes for the same probes.'
        },
        {
          do: 'Read what those writes bought.',
          why: 'The worst insert is the tail an insert-heavy workload actually waits on.',
          work: 'worst single insert: linear 93 probes, robin hood 7\n' +
            'p99 lookup distance: 44 against 14 (first example)\n' +
            'mean distance: 2.88 both',
          result: 'A 13× shorter worst insert and a 3× shorter p99 lookup.'
        },
        {
          do: 'Decide from the read/write mix.',
          why: 'The trade is only good if reads outnumber writes, which is usually but not always true.',
          work: 'read-mostly cache (100 reads per write): 2.5× on 1% of operations, tail 3× better\n' +
            'write-heavy index (1 read per write): 2.5× on half the operations\n' +
            'insertion into a cache line already in L1: a write is nearly free\n' +
            'insertion that dirties a new line: the write is the cost',
          result: 'Robin Hood is a read-latency optimisation paid for in writes.'
        }
      ],
      answer: 'Robin Hood makes exactly the same 6 757 probes as linear probing over 1 740 inserts, ' +
        'and 2.46 writes per insert against 1. What that buys is a worst insert of 7 probes instead ' +
        'of 93 and a p99 lookup of 14 instead of 44 — a read-latency optimisation, paid for on the ' +
        'write path.'
    }],

    'swiss-tables': [{
      title: 'Count what a group probe saves',
      goal: 'Work out why a Swiss table stays flat where linear probing is climbing.',
      setup: '2 048 slots at α = 0.85, 4-byte keys, 64-byte cache lines, 16 slots per group.',
      steps: [
        { do: 'Size the control array.', why: 'The control bytes are the only thing a rejected group touches.',
          work: 'control = 1 byte per slot = 2,048 bytes\ngroups = 2,048 / 16 = 128 groups of 16 bytes\na 64-byte line holds 4 groups = metadata for 64 slots',
          result: 'The whole control array is 2 KB and stays in L1.' },
        { do: 'Predict the group probes.', why: 'A group is only rejected when all 16 of its slots are full of other keys.',
          work: 'P(a group has no free slot) ≈ α^16 = 0.85^16 = 0.074\nexpected groups ≈ 1 / (1 − 0.074) = 1.08',
          result: 'About 1.08 groups per lookup.' },
        { do: 'Measure it.', why: 'The prediction ignores clustering, so it should be close but not exact.',
          work: 'measured groups per lookup: 1.080\nmeasured key comparisons per lookup: 1.059',
          result: 'The prediction is right, and the key array is touched about once.' },
        { do: 'Account for the extra comparisons.', why: 'A 7-bit tag collides sometimes, and that costs a real comparison.',
          work: 'false-match rate = 1/128 = 0.0078 per occupied slot examined\nmeasured excess over 1.0: 1.059 − 1 = 0.059',
          result: 'Small, bounded, and the entire error budget of the design.' },
        { do: 'Compare against linear probing at the same load.', why: 'This is the number the design is competing with.',
          work: 'linear probing at α = 0.85: ½(1 + 1/(1−0.85)) = 3.83 slot probes\nswiss: 1.08 group probes, 1.06 key comparisons',
          result: 'One cache line answers what linear probing needs ~4 slot reads for.' }
      ],
      answer: 'At α = 0.85 a Swiss table probes 1.08 groups and compares 1.06 keys per lookup — the ' +
        'α^16 = 7.4% chance that a group is full is what keeps it at one — while linear probing at ' +
        'the same load averages 3.8 slot probes.'
    }, {
      title: 'Delete from a Swiss table and see what the control byte remembers',
      goal: 'Follow the third control state — DELETED — and the tag width that makes the design work.',
      setup: '2 048 slots at maxLoad 0.875. Insert 1 400 keys, then delete 700 of them, then look up ' +
        'the 700 that remain.',
      steps: [
        {
          do: 'Account for the slots after the deletions.',
          why: 'A deleted slot is not empty, and the difference is what keeps probing correct.',
          work: 'live keys: 700\n' +
            'DELETED control bytes: 700\n' +
            'load reported: 0.342\n' +
            'resizes: 0',
          result: 'Half the occupied slots hold nothing and still stop nothing.'
        },
        {
          do: 'Explain why DELETED cannot simply be EMPTY.',
          why: 'This is the same probe-chain argument as open addressing, one level down.',
          work: 'a lookup stops at the first group of 16 containing an EMPTY lane\n' +
            'a key inserted past a full group is only reachable through it\n' +
            '⇒ marking 1 byte EMPTY would end the probe early and lose the key',
          result: 'DELETED means "keep going"; EMPTY means "stop".'
        },
        {
          do: 'Measure what those 700 tombstones cost a lookup.',
          why: 'The group probe should absorb them, and the number says by how much.',
          work: 'groups per lookup with 700 DELETED bytes: 1.051\n' +
            'against 1.080 for a full table at α = 0.85 (first example)',
          result: 'Nothing measurable: the group is scanned whatever the bytes say.'
        },
        {
          do: 'Price the tag width.',
          why: 'Seven bits is not an accident — it is one bit short of the byte, and the byte has jobs.',
          work: 'control byte = 1 bit "is this a real key" + 7 bits of tag\n' +
            'EMPTY = 0x80, DELETED = 0xFE, tag = 0x00…0x7F\n' +
            'false match rate = 1/128 = 0.0078 per occupied lane examined\n' +
            'a 4-bit tag would give 1/16 = 0.0625 — eight times the wasted key comparisons',
          result: '0.78% of lanes cost a real comparison that finds nothing.'
        },
        {
          do: 'Say when the table must rehash rather than grow.',
          why: 'Deletions can fill a table with DELETED bytes at a constant live count.',
          work: 'growth trigger: (live + deleted) / slots > 0.875\n' +
            'here: (700 + 700) / 2,048 = 0.684 — one more round of churn crosses it\n' +
            'live load is only 0.342, so doubling would waste half the table\n' +
            'real implementations rehash in place at the same capacity instead',
          result: 'The tombstone problem does not go away; it moves into the resize policy.'
        }
      ],
      answer: 'After 700 deletions the table holds 700 live keys and 700 DELETED control bytes at a ' +
        'reported load of 0.342, and lookups still touch 1.051 groups — the group probe does not care. ' +
        'The 7-bit tag costs a false key comparison 0.78% of the time, where a 4-bit tag would cost ' +
        '6.25%.'
    }],

    rehashing: [{
      title: 'Price the rehash spike, then price removing it',
      goal: 'Turn "amortised O(1)" into the p99.9 an operator actually sees.',
      setup: '20 000 insertions into a table that starts at 16 slots, grows at load 0.7 by doubling, ' +
        'and moves 4 buckets per operation in incremental mode.',
      steps: [
        { do: 'Count the rehashes and the biggest one.', why: 'Doubling means the last rehash moves more than all the earlier ones together.',
          work: 'capacities: 16, 32, 64, … , 32,768\nthe final rehash moves about 20,000 entries in one call\nmeasured peak: 14,567 slot writes in a single insert',
          result: 'One insertion did 14 567 units of work.' },
        { do: 'Confirm the amortised claim.', why: 'It is true, and it is the claim that hides the spike.',
          work: 'total work: 84,633 for 20,000 inserts = 4.2 per insert\nmedian insert: 2',
          result: 'The average is 4.2 and the median is 2. Both are honest and both are useless here.' },
        { do: 'Read the distribution instead.', why: 'A latency budget is a statement about a percentile.',
          work: 'synchronous:  median 2, p99 18, p99.9 42, worst 14,567',
          result: 'The worst case is 350× the p99.9 and 7 000× the median.' },
        { do: 'Switch to incremental rehash.', why: 'Moving k buckets per operation spreads the same work.',
          work: 'incremental: median 3, p99 37, p99.9 63, worst 98\npeak: 14,567 → 98 = 149× smaller',
          result: 'The spike is gone; the typical operation got slightly slower.' },
        { do: 'Price what that cost.', why: 'A flat tail is bought, not free.',
          work: 'total work: 84,633 → 149,468 = 1.77×\nmemory during migration: both tables live, so ~3m slots\niterators must span two tables',
          result: '77% more total work and doubled peak memory, for a 149× smaller worst case.' }
      ],
      answer: 'Synchronous rehashing gives a median insert of 2 units and a worst case of 14 567 — ' +
        'that single call is the p99.9 in a real service. Incremental rehashing at 4 buckets per ' +
        'operation caps it at 98, for 1.77× the total work and doubled memory during migration.'
    }, {
      title: 'Delete the rehash instead of spreading it',
      goal: 'Compare the two fixes: pay the spike incrementally, or never incur it.',
      setup: 'The same 20 000 insertions, synchronous rehash, growing at load 0.7 by doubling — once ' +
        'from a capacity of 16 and once from a capacity of 32 768 reserved up front.',
      steps: [
        {
          do: 'Run it from 16 slots.',
          why: 'This is the default every hash table ships with.',
          work: 'total work: 84,633 units\n' +
            'resizes: 11\n' +
            'worst single insert: 14,567\n' +
            'p99.9: 42',
          result: 'The table is rebuilt eleven times on the way to its final size.'
        },
        {
          do: 'Run it from a reserved 32 768 slots.',
          why: 'The final capacity is known: 20 000 keys at load 0.7 rounds up to 32 768.',
          work: 'total work: 36,043 units\n' +
            'resizes: 0\n' +
            'worst single insert: 44\n' +
            'p99.9: 22',
          result: 'No resize happens at all, so there is no spike to spread.'
        },
        {
          do: 'Compare the three strategies on the same axis.',
          why: 'Incremental rehash and reservation solve the same problem at different prices.',
          work: '                    total    worst insert   memory\n' +
            'synchronous, 16     84,633       14,567      1× final\n' +
            'incremental, 16    149,468           98      2× during migration\n' +
            'reserved, 32,768    36,043           44      1× final, from the start',
          result: 'Reservation wins both columns — when the size is known.'
        },
        {
          do: 'Say what reservation costs when the guess is wrong.',
          why: 'This is the case that stops it being the universal answer.',
          work: 'reserve 32,768 and insert 1,000 keys: 32,768 slots for 1,000 = 3% occupancy\n' +
            'reserve 32,768 and insert 100,000 keys: it resizes anyway, from a larger base\n' +
            'the incremental scheme needs no estimate at all',
          result: 'Reservation trades a guess for the spike; incremental rehash trades work for it.'
        }
      ],
      answer: 'Reserving 32 768 slots up front does the 20 000 insertions in 36 043 units of work with ' +
        'a worst insert of 44 — against 84 633 and 14 567 growing from 16, and 149 468 and 98 with the ' +
        'incremental scheme. Reservation is the best answer whenever the size is known, and no answer ' +
        'at all when it is not.'
    }],

    'perfect-hashing': [{
      title: 'Measure what a static key set is worth',
      goal: 'Compare a hash table, FKS and a minimal perfect hash on 500 fixed keys.',
      setup: '500 word-like keys known at build time, 4-byte slots, and a hash table that grows at ' +
        'load 0.7.',
      steps: [
        { do: 'Size the hash table.', why: 'It must keep α below its threshold, and capacities are powers of two.',
          work: 'slots ≥ 500 / 0.7 = 715 ⇒ 1,024 slots\noccupancy 500/1024 = 49%\nand it must store the keys, to answer "is this key present"',
          result: '1 024 slots, half of them empty, plus every key.' },
        { do: 'Build FKS and check the space bound.', why: 'The theory bounds the expected secondary space at 2n.',
          work: 'level 1: 500 buckets\nsecondary slots: 1,028 (theory: E[Σ b²] < 2n = 1,000)\ntotal: 500 + 1,028 = 1,528 slots = 3.06 per key',
          result: 'Just over three slots per key, and one probe per lookup.' },
        { do: 'Build the minimal perfect hash.', why: 'It maps the 500 keys onto exactly [0, 500).',
          work: 'λ = 4 ⇒ 125 buckets\nlargest displacement: 3,080 ⇒ 12 bits each\nspace = 125 × 12 / 500 = 3.00 bits per key',
          result: '188 bytes of structure for 500 keys, no empty slots at all.' },
        { do: 'Price the construction.', why: 'This cost is paid once, at build time, and it is not small.',
          work: 'FKS: 166 seed trials\nCHD: 21,961 displacement trials',
          result: 'Milliseconds at this size; the reason it happens at build time, not start-up.' },
        { do: 'Compare the three.', why: 'The comparison only holds when the key set really is fixed.',
          work: 'hash table: 1,024 slots + all keys stored, ~1.4 probes\nFKS:          1,528 slots, exactly 1 probe, worst case\nMPH:          188 bytes, exactly 1 probe, no keys stored',
          result: 'The MPH is two orders of magnitude smaller — if every lookup is for a member.' }
      ],
      answer: 'For 500 fixed keys: a hash table needs 1 024 slots plus the keys; FKS needs 1 528 slots ' +
        'and gives a worst-case single probe; a minimal perfect hash needs 3.00 bits per key — ' +
        '188 bytes total — and answers in one probe, provided every lookup is for a key in the set.'
    }, {
      title: 'Turn the CHD dial and watch build time pay for space',
      goal: 'Find what λ actually controls, and where the knee is.',
      setup: 'The same 500 keys, hash-and-displace, λ from 2 to 6. λ is the average bucket size, so ' +
        'the structure has r = ⌈n/λ⌉ displacement entries.',
      steps: [
        {
          do: 'Tabulate the whole range.',
          why: 'One parameter, two costs moving in opposite directions.',
          work: 'λ   buckets   bits/key   max displacement   trials\n' +
            '2      250       4.50            274            3,809\n' +
            '3      167       4.01          2,998           10,668\n' +
            '4      125       3.00          3,080           21,961\n' +
            '5      100       2.80         10,824           62,119\n' +
            '6       84       2.52         32,538          227,969',
          result: 'Space falls by 44% from λ = 2 to λ = 6; build cost rises 60×.'
        },
        {
          do: 'Say why fewer buckets cost more to place.',
          why: 'The mechanism is the same birthday argument as the FKS second level.',
          work: 'bucket of size b must find a displacement d placing all b keys on free slots\n' +
            'P(a given d works) ≈ (free fraction)^b\n' +
            'λ = 6 ⇒ largest bucket 15 keys ⇒ the search is exponential in b',
          result: 'The largest bucket, not the average one, sets the build time.'
        },
        {
          do: 'Locate the knee.',
          why: 'This is the number to quote when someone asks for "the" CHD parameter.',
          work: 'λ 2→3: −11% bits,  2.8× trials\n' +
            'λ 3→4: −25% bits,  2.1× trials\n' +
            'λ 4→5:  −7% bits,  2.8× trials\n' +
            'λ 5→6: −10% bits,  3.7× trials',
          result: 'λ = 4 is where the space is still falling faster than the cost is rising.'
        },
        {
          do: 'Check that the output is unchanged.',
          why: 'A build-time parameter must not become a correctness parameter.',
          work: 'minimal: true at all 5 settings\n' +
            'lookup: 1 displacement read + 1 hash, at every λ\n' +
            'the only thing that changed is the displacement array: 250 entries against 84',
          result: 'λ buys space at build time and changes nothing at query time.'
        }
      ],
      answer: 'For 500 keys, λ = 2 gives 4.50 bits per key after 3 809 displacement trials and λ = 6 ' +
        'gives 2.52 bits after 227 969 — 44% less space for 60× the build cost, with an identical ' +
        'one-probe lookup either way. λ = 4 (3.00 bits, 21 961 trials) is where the curves cross.'
    }],

    'hash-in-practice': [{
      title: 'Size the hole problem in an insertion-ordered map',
      goal: 'Show why O(1) delete needs a compaction rule, with the growth measured.',
      setup: 'An insertion-ordered map holding 1 000 live keys, driven through 40 000 rounds that each ' +
        'delete one key and re-insert it.',
      steps: [
        { do: 'State the structure.', why: 'Order requires an array; O(1) delete forbids splicing it.',
          work: 'entries[]: 1,000 records of {key, value} in insertion order\nindex: a Map of 1,000 key → position\ndelete: entries[at] = null, index.delete(key) — 2 writes, 0 entries shifted',
          result: 'Delete is O(1) and leaves a hole behind.' },
        { do: 'Count the holes with no compaction.', why: 'Every delete adds one and nothing removes them.',
          work: 'holes after 40,000 deletes = 40,000\nslots = 1,000 live + 40,000 holes = 41,000\nmeasured: 41,000 slots for 1,000 entries',
          result: '41× the memory the data needs, and iteration walks all of it.' },
        { do: 'Add the compaction rule.', why: 'Rebuilding when holes exceed live entries keeps the array proportional.',
          work: 'compact when holes > 0.5 × slots\nmeasured: 1,000 slots for 1,000 entries, 40 compactions',
          result: 'Growth factor 1.0 instead of 41.' },
        { do: 'Check the amortised cost.', why: 'A compaction is O(n), so it needs the same argument as a dynamic array.',
          work: '40 compactions over 40,000 deletes\neach moves at most ~1,000 entries ⇒ ≤ 40,000 moves total\n≤ 1 move per delete, amortised',
          result: 'O(1) amortised delete, and the array stays proportional to the live set.' },
        { do: 'Note what this has to do with objects.', why: 'The same problem is why deleting a property is expensive in V8.',
          work: 'delete obj.k forces the object out of its hidden class into dictionary mode\n1 deletion is enough, and that object never goes back\nthe Map instead pays 40 compactions across 40,000 deletes and keeps its representation',
          result: 'Map pays a compaction; an object pays a representation change it never undoes.' }
      ],
      answer: 'Without compaction, 40 000 delete-and-reinsert rounds leave 41 000 slots holding ' +
        '1 000 entries. Compacting when holes exceed half the array holds it at 1 000 slots for ' +
        '40 compactions — one entry moved per delete, amortised.'
    }, {
      title: 'Let the workload pick the scheme',
      goal: 'Run every M03 table through two workloads and watch the ranking change.',
      setup: 'The same 5 000-key stream through five schemes, all growing from a small capacity: ' +
        'once read-heavy (no deletions) and once churn-heavy (45% of operations delete a live key). ' +
        'Probes per lookup, counted by the lab.',
      steps: [
        {
          do: 'Rank them on the read-heavy stream.',
          why: 'This is the workload most benchmarks use, and it is the easy one.',
          work: 'swiss table    1.04\n' +
            'chaining       1.30\n' +
            'linear/tombstone 1.80\n' +
            'linear/backward-shift 1.80\n' +
            'robin hood     1.94',
          result: 'A group probe answers in about one group; the rest are within a factor of two.'
        },
        {
          do: 'Add deletions and rank them again.',
          why: 'Only one thing about the workload changed.',
          work: 'swiss table    1.04\n' +
            'chaining       1.90\n' +
            'linear/tombstone 2.13\n' +
            'robin hood     3.01\n' +
            'linear/backward-shift 3.72',
          result: 'Backward shift went from best-equal to last.'
        },
        {
          do: 'Find out why the "better" deletion lost.',
          why: 'The first example in this section says tombstones are the problem; here they win.',
          work: '                 probes  size  capacity  load   tombstones\n' +
            'linear/tombstone   2.13  2,750    8,192   0.336      342\n' +
            'linear/shift       3.72  2,750    4,096   0.671        0\n' +
            'growth triggers on (live + tombstones)/capacity',
          result: 'Tombstones won by spending twice the memory, not by probing better.'
        },
        {
          do: 'Restate both results without contradiction.',
          why: 'The two examples measure the same scheme under different growth policies.',
          work: 'growth disabled: tombstones accumulate to 1,024 probes per miss (first example)\n' +
            'growth enabled:  tombstones inflate occupancy ⇒ the table doubles sooner\n' +
            '⇒ lower load, fewer probes, 2× the slots',
          result: 'Tombstones are a memory-for-probes trade, and a disaster only when growth is off.'
        },
        {
          do: 'Write the selection rule the two tables support.',
          why: 'The point of the milestone is choosing, not ranking.',
          work: 'read-mostly, memory-tight:  swiss table (1.04 probes at α = 0.85)\n' +
            'adversarial keys, no seed:  chaining with treeify\n' +
            'churn-heavy, memory-tight:  chaining, or backward shift with headroom\n' +
            'tail-latency SLA:           robin hood, or cuckoo for a hard bound',
          result: 'Four workloads, four different answers, none of them "it depends".'
        }
      ],
      answer: 'On a read-heavy stream the ranking is swiss 1.04, chaining 1.30, linear 1.80, Robin ' +
        'Hood 1.94. Add 45% deletions and it becomes swiss 1.04, chaining 1.90, tombstones 2.13, ' +
        'Robin Hood 3.01, backward shift 3.72 — and tombstones only beat backward shift by holding ' +
        '8 192 slots at load 0.336 against 4 096 at 0.671.'
    }]
  });
}(typeof window !== 'undefined' ? window : null));

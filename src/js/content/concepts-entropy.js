/** Concepts for random generation and identifier design (M17.9-M17.10). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'random-generation': [
      {
        term: 'A PRNG is a deterministic function, so "random" can only mean "passes these tests"',
        plain: 'The question is never whether it is random — it is not — but what structure it leaves behind.',
        formal: 'every generator here is a state and a transition; the output is a function of the state and nothing else',
        detail: [
          'Framing it this way is what makes the subject tractable.',
          'There is no property "randomness" to verify, only specific structures to look for, and a ' +
            'generator that is ruinous for one use can be perfectly adequate for another.',
          'Determinism is also a feature rather than a compromise. A seeded generator turns "change ' +
            'one line and run it again" into a controlled experiment, and a bug that appears for one ' +
            'seed in ten thousand is unreproducible without one.'
        ],
        example: 'Every generator in the demo passes a one-dimensional histogram, including the ' +
          'one whose triples all lie on fifteen planes.'
      },
      {
        term: 'The test everybody runs separates nothing',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["a histogram of single outputs"] --> B["flat for every generator here"]',
            '    B --> C["including RANDU, which is famously broken"]',
            '    C --> D["the structure is in the RELATIONS<br/>between successive outputs"]',
            '    D --> E["so test triples in space,<br/>not values in a bar chart"]'
          ].join('\n'),
          caption: 'A uniform histogram is necessary and nowhere near sufficient. RANDU\'s triples lie on fifteen planes, and no single-output test can see that.'
        },
        plain: 'A histogram of single outputs passes for every generator here, RANDU included.',
        formal: 'over 200 000 samples into 64 buckets, every generator sits inside the plausible chi-squared range on its high bits',
        detail: [
          'A one-dimensional uniformity test asks the easiest possible question, and any generator ' +
            'that fails it would never have been published.',
          'What separates them is the structure in *consecutive* outputs, which a histogram cannot ' +
            'see because it discards the order.',
          'That is the general shape of this whole subject: the test that is easy to run is the test ' +
            'that discriminates least. Every real test suite — TestU01, PractRand — is a battery of ' +
            'many tests for exactly that reason.'
        ],
        example: 'The demo’s table has all nine generators passing on their high bits, with ' +
          'statistics from 0.1 to 81.0 against a plausible range of 45.7 to 82.5.'
      },
      {
        term: 'A statistic far below the expectation is also a failure',
        plain: 'Counts that are too even are as suspicious as counts that are too ragged.',
        formal: 'RANDU scores 0.1 where 63 is expected, because a full-period generator sweeps every value exactly once',
        detail: [
          'A chi-squared test has two tails and almost every write-up checks one of them.',
          'If the counts come out impossibly regular, the values are not being sampled — they are ' +
            'being enumerated, which is exactly what a full-period generator does over its whole ' +
            'cycle.',
          'Reporting that as a pass is how a histogram test certifies a counter. So the demo names ' +
            'three verdicts rather than two: uneven, too even, and plausible.'
        ],
        example: 'The Numerical Recipes LCG scores exactly 0.0 on its low eight bits, because they ' +
          'cycle through all 256 values with a period of 256.'
      },
      {
        term: 'RANDU’s failure is a linear identity you can check',
        plain: 'Its outputs satisfy x[n+2] = 6·x[n+1] − 9·x[n] exactly, which is why triples lie on planes.',
        formal: 'the residual of that identity is 0 for every consecutive triple, and large for every other generator here',
        detail: [
          'Every linear congruential generator’s outputs taken k at a time lie on a lattice of ' +
            'hyperplanes.',
          'A good multiplier makes the lattice fine enough that no plot at a realistic sample size ' +
            'can find it, and RANDU’s makes it fifteen planes in three dimensions.',
          'The identity is what makes this checkable rather than quotable. It either holds for every ' +
            'triple or it does not, and no sample size or seed changes the answer.'
        ],
        example: 'The demo evaluates that identity over 2 000 consecutive triples and reports a ' +
          'worst residual of exactly 0 for RANDU.'
      },
      {
        term: 'For a power-of-two modulus the low bits are provably worse than the high bits',
        plain: 'Bit k of such an LCG has a period of 2^(k+1), so the lowest bit simply alternates.',
        formal: 'measured: RANDU’s bits 0 to 5 have periods 1, 2, 1, 4, 8 and 16',
        detail: [
          'This is a theorem rather than an observation, and it is why `rand() % 8` on a generator ' +
            'like that returns a counter rather than a sample.',
          'It is also invisible to a frequency test. The bits come up set half the time, so the ' +
            'histogram is perfect and the sequence is a cycle.',
          'PCG exists to fix precisely this by permuting the output rather than handing the state ' +
            'out, which is why its low bits are as good as its high ones.'
        ],
        example: 'The demo’s heat strip shows RANDU’s bit 0 at 100% set — a worst deviation of ' +
          '50.00 points — with a measured period of 1.'
      },
      {
        term: 'Modulo bias is arithmetic, not a sampling artefact',
        plain: 'If n does not divide the range, some outputs get one extra source value each — and nothing redistributes them.',
        formal: 'range mod n of the outputs get ⌊range/n⌋ + 1 chances and the rest get ⌊range/n⌋',
        readAs: 'Divide the generator’s range by the bound and keep the remainder. That many of ' +
          'the possible outputs get one more chance than all the others, and the ratio between ' +
          'the two groups is the bias.',
        detail: [
          'The bias needs no experiment to predict, which is what makes it worth stating before ' +
            'measuring. It is a property of two integers.',
          'It is largest exactly when n is a large fraction of the range — the case people reach for ' +
            '`%` on. And it becomes invisible when the range is 2³² and n is small, which is why the ' +
            'shortcut survives in so much code.',
          'Rejection removes it exactly by discarding the ragged top of the range. Lemire does the ' +
            'same with one multiplication.'
        ],
        example: 'Drawing 200 buckets from 8 bits, the demo predicts 56 favoured outputs at a ratio ' +
          'of 2.000× and measures a spread of 2.219× arriving at it.'
      },
      {
        term: 'A wrong shuffle cannot be fixed by a better generator',
        plain: 'Drawing the swap partner from the whole array gives nⁿ paths for n! outcomes, and n! does not divide nⁿ.',
        formal: 'at n = 3: 27 equally likely execution paths and 6 outcomes, so the distribution cannot be uniform',
        readAs: 'Every step picks from all n positions, so there are n multiplied by itself n ' +
          'times equally likely ways the loop can run. That count is not a whole-number multiple ' +
          'of the number of orderings, so the orderings cannot come out equally often.',
        detail: [
          'This is a counting argument, not a statistical one, so no generator quality fixes it. The ' +
            'bias is in the algorithm and would persist with a perfect source of randomness.',
          'Fisher-Yates draws from the unvisited suffix instead, giving exactly n! paths for n! ' +
            'outcomes.',
          'The two differ by one character in the source, and on three elements the difference is ' +
            'large enough to read straight off a table.'
        ],
        example: 'Over 120 000 shuffles the demo measures Fisher-Yates at a chi-squared of 7.0 and ' +
          'the naive version at 1 509.7, against a threshold of 11.0.'
      },
      {
        term: 'Statistical quality and unpredictability are different properties',
        plain: 'Every generator here passes statistical tests and every one of them is predictable from its output.',
        formal: 'xorshift and MT19937 are linear over GF(2), so their state is recoverable from a few hundred outputs',
        detail: [
          'A generator that passes TestU01 is telling you about its distribution, not about whether ' +
            'an observer can compute the next value. For all of these, the observer can.',
          'That is fine for simulation, for reproducible tests and for sampling. It is not fine for ' +
            'anything a person could gain by predicting: session tokens, password salts, a shuffle ' +
            'in a game people bet on.',
          '`Math.random()` is in this category and its specification says so explicitly.'
        ],
        example: 'MT19937 has 19 937 bits of state and its whole future is determined by 624 ' +
          'consecutive outputs.'
      }
    ],

    'integer-algorithms': [
      {
        term: 'An identifier scheme is three decisions, and uniqueness is not one of them',
        plain: 'How it is generated, what it costs the index, and what it tells the person holding it.',
        formal: 'every scheme here achieves uniqueness; they differ on locality, ordering and leakage',
        detail: [
          'Arguing about collision probability is arguing about the one dimension where all the ' +
            'candidates are fine.',
          'A 122-bit random identifier collides with probability about 10⁻²⁰ at a billion rows, and ' +
            'a sequential integer never collides at all.',
          'The decisions that actually differ are the ones with costs attached, and two of the three ' +
            'are invisible at the moment the scheme is chosen. The index cost shows up when the ' +
            'table gets large, and the leakage shows up when somebody looks.'
        ],
        example: 'The demo reports 0 duplicates for all five schemes over 20 000 identifiers and ' +
          'working sets from 14 to 64 pages.'
      },
      {
        term: 'Randomness in the high bits is what destroys insert locality',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["a B-tree inserts where<br/>the key sorts"] --> B{"where do the high bits<br/>of the key come from?"}',
            '    B -->|"a timestamp"| C["consecutive keys land<br/>on the same page"]',
            '    B -->|"randomness"| D["every insert lands<br/>on a different page"]',
            '    C --> E["one page dirtied per batch"]',
            '    D --> F["one page dirtied per ROW"]'
          ].join('\n'),
          caption: 'UUIDv4 and a time-ordered id are the same size and the same uniqueness. Which end the randomness sits in decides whether the index writes one page or thousands.'
        },
        plain: 'A B-tree inserts where the key sorts, so a random key lands on a random page.',
        formal: 'measured: a random UUID touches 64 distinct index pages in a 64-insert window; a time-ordered one touches 15',
        detail: [
          'The number that matters is the working set: how many distinct pages the recent inserts ' +
            'touched. That is what the buffer pool has to hold to avoid a disk read per insert.',
          'For a random key it is the whole window and it grows without bound. For a time-ordered ' +
            'key it is a handful of pages, and it is flat.',
          'At a billion rows that is the difference between an index that lives in memory and one ' +
            'that does not, and it is invisible until the table outgrows the cache.'
        ],
        example: 'The demo’s chart has the random-UUID line as the diagonal y = x and every ' +
          'time-ordered line flat, across windows from 8 to 512.'
      },
      {
        term: 'Time-ordered is not monotonic, and the gap is where cursors break',
        plain: 'UUIDv7 and ULID sort across milliseconds and come out unordered within one.',
        formal: 'measured: 0 inversions across milliseconds and 6 735 of 13 333 same-millisecond pairs out of order',
        detail: [
          'The timestamp is 48 bits of milliseconds and everything below it is random, so two ' +
            'identifiers from the same millisecond order by their random tails. About half of them ' +
            'come out the wrong way, which is exactly what randomness predicts.',
          'A cursor that pages by `id > last` therefore drops rows, and it drops them only under ' +
            'concurrency. That is the hardest kind of bug to reproduce.',
          'Snowflake has a sequence counter in those bits instead, and is strictly monotonic per ' +
            'machine.'
        ],
        example: 'The demo reports Snowflake at 0 out-of-order pairs of 13 333 same-millisecond ' +
          'pairs, where UUIDv7 has 6 735.'
      },
      {
        term: 'A Snowflake is three fields and two hard limits',
        plain: '41 bits of milliseconds, 10 of machine id, 12 of sequence — and the last two are ceilings.',
        formal: '4 096 identifiers per machine per millisecond, and 1 024 machines',
        detail: [
          'The sequence width is a hard rate limit that nobody notices until a backfill job hits it.',
          'Past 4 096 in one millisecond the generator must either stall or borrow from the next ' +
            'millisecond. Borrowing means it is now ahead of the clock, and will keep borrowing ' +
            'until real time catches up.',
          'The machine-id width is a deployment constraint that has to be satisfied by something ' +
            'outside the generator — a coordinator, a configuration file, or an ordinal from a ' +
            'stateful set.'
        ],
        example: 'The demo issues 5 000 identifiers in one millisecond, borrows exactly 1 ' +
          'millisecond from the future, and produces 0 duplicates.'
      },
      {
        term: 'A backwards clock forces a choice, and the third option is the one that ships',
        plain: 'Wait and stall, refuse and drop, or serve from the stale reading and hand out a duplicate.',
        formal: 'measured over a 40 ms regression: waiting issued 13 of 13 with 8 stalls; refusing issued 5 of 13',
        detail: [
          'Only two of the three preserve uniqueness, and the third is the one a generator falls ' +
            'into by accident.',
          'Serving from whatever the clock currently says is what the code does if nobody thought ' +
            'about it.',
          'The duplicate does not surface at generation time. It surfaces days later as a ' +
            'primary-key violation nobody can reproduce, because the clock has long since moved on. ' +
            'Testing this requires injecting the clock, which is why the generator takes one as a ' +
            'parameter.'
        ],
        example: 'The demo runs both policies against a scripted regression and reports 0 ' +
          'duplicates for each, which is the property they were chosen to keep.'
      },
      {
        term: 'The fields that make an identifier cheap to index are the fields that leak',
        plain: 'Sortability is information, and information is what an outsider reads.',
        formal: 'UUIDv7 leaks the creation time to the millisecond; Snowflake leaks time, machine and per-millisecond sequence',
        detail: [
          'This is a genuine trade rather than an oversight in either direction.',
          'A time-ordered identifier is cheap to index precisely because its high bits encode when ' +
            'it was made, and anyone holding one can read that back with a shift.',
          'A sequential integer is worse: the value *is* the count. So id 4 812 tells a competitor ' +
            'how many rows exist, and two ids a week apart tell them the growth rate. Only the ' +
            'random UUID leaks nothing, and it pays for that with the worst locality of the five.'
        ],
        example: 'The demo’s leakage table has Snowflake at yes in all four columns and UUIDv4 at ' +
          'no in all four.'
      },
      {
        term: 'A key and a name are different objects, and one identifier is rarely both',
        plain: 'A key lives in an index and pays for locality; a name appears in URLs and pays for what it reveals.',
        formal: 'systems that need both use two identifiers rather than compromising on one',
        detail: [
          'The two roles have opposite requirements, so a single scheme is a compromise on at least ' +
            'one of them.',
          'That compromise is usually made silently, by whoever picked the primary-key type.',
          'Having both is cheap: a time-ordered internal key that never leaves the database, and an ' +
            'opaque external identifier that appears in URLs, with one index between them. What it ' +
            'costs is an extra column and the discipline never to expose the first.'
        ],
        example: 'The demo’s locality and leakage tables put the same five schemes in almost ' +
          'exactly opposite orders.'
      },
      {
        term: 'Bit-packing several fields into one word is the same technique underneath',
        plain: 'A Snowflake is a struct in an integer, and so are permission masks, tagged pointers and colour values.',
        formal: 'timestamp << 22 | machine << 12 | sequence, unpacked by a shift and a mask',
        detail: [
          'The reason to do it is that the whole thing then fits in a machine word, an integer ' +
            'column and an index entry. That is why a Snowflake fits in a `bigint` and a UUID needs ' +
            'sixteen bytes.',
          'The reason to be careful is that the field widths are a permanent decision. Widening one ' +
            'narrows another, and both are already stored in every row that exists.',
          'Write the layout down beside the code that packs it, because the shifts alone do not say ' +
            'what the fields mean.'
        ],
        example: 'The demo colours the four fields of a real Snowflake and shows each one read ' +
          'back by shifting and masking.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));

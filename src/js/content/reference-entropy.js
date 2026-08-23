/** Reference entries for random generation and identifier design (M17.9-M17.10). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'random-generation': {
      summary: 'Nine generators on the test that separates none of them and the three that do, ' +
        'plus the two consumer-side mistakes that ruin a correct generator without touching it.',
      intuition: 'A chi-squared statistic far below its expectation is a failure too, and that is ' +
        'the tail nobody checks.',
      formulation: {
        equations: [
          {
            label: 'The test that separates nothing',
            expr: '200 000 samples into 64 buckets, high bits, plausible range 45.7 to 82.5',
            terms: [
              { sym: 'RANDU', meaning: '0.1 — too even, because a full-period generator enumerates rather than samples' },
              { sym: 'Numerical Recipes LCG', meaning: '0.7 — the same failure' },
              { sym: 'MINSTD, xorshift, splitmix, PCG, MT19937', meaning: '49.7 to 81.0 — plausible' },
              { sym: 'the point', meaning: 'nothing is rejected on the upper tail, including a generator IBM withdrew' }
            ]
          },
          {
            label: 'The readings that do separate them',
            expr: 'the low bits, the period of individual bits, and a linear identity',
            terms: [
              { sym: 'RANDU, low 8 bits', meaning: 'chi-squared 600 000.0 — uneven' },
              { sym: 'Numerical Recipes, low 8 bits', meaning: 'exactly 0.0 — too even; those bits cycle with period 256' },
              { sym: 'RANDU bit periods', meaning: 'bits 0 to 5 have periods 1, 2, 1, 4, 8 and 16' },
              { sym: 'the identity', meaning: 'x[n+2] = 6·x[n+1] − 9·x[n] holds with residual 0 over 2 000 triples' }
            ]
          },
          {
            label: 'Modulo bias, predicted then measured',
            expr: 'range mod n outputs get one extra source value each',
            terms: [
              { sym: 'at 8 bits, n = 200', meaning: '56 favoured outputs, ratio exactly 2.000×' },
              { sym: 'measured spread', meaning: '2.219× between the most and least frequent bucket' },
              { sym: 'at 32 bits, n = 200', meaning: 'ratio 1.000000047 — still biased, and below the noise' },
              { sym: 'the fixes', meaning: 'rejection 1.2790 draws a sample, Lemire 1.2807; both exactly uniform' }
            ]
          },
          {
            label: 'The shuffle',
            expr: 'nⁿ equally likely paths cannot distribute evenly over n! outcomes',
            terms: [
              { sym: 'at n = 3', meaning: '27 paths, 6 outcomes, and 6 does not divide 27' },
              { sym: 'Fisher-Yates', meaning: 'chi-squared 7.0 over 120 000 shuffles, threshold 11.0' },
              { sym: 'the naive version', meaning: '1 509.7, with counts from 17 640 to 22 290 where 20 000 is expected' },
              { sym: 'why a better generator does not help', meaning: 'the argument is combinatorial, not statistical' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Nothing rescales one generator range into another',
          why: 'Scaling a 31-bit state into 32 bits multiplies every output by two and pins the low bit to zero.',
          breaks: 'A manufactured "one-dimensional failure" that is an artefact of the scaling, not a property of the generator.'
        },
        {
          name: 'Narrowing says which end of the word it takes',
          why: 'For a power-of-two-modulus LCG the two ends have provably different quality.',
          breaks: 'A generator passes or fails depending on an unstated choice inside the harness.'
        },
        {
          name: 'A verdict names both tails',
          why: 'Counts that are too even mean the values are being enumerated.',
          breaks: 'A histogram test certifies a counter as random.'
        },
        {
          name: 'The bias is predicted before it is sampled',
          why: 'It is a property of two integers, so the measurement is a confirmation rather than a discovery.',
          breaks: 'A measured spread with no prediction beside it cannot be distinguished from sampling noise.'
        }
      ],
      complexity: [
        { operation: 'LCG step', average: 'one multiply, one add, one modulus', worst: 'the same; period is the modulus at best' },
        { operation: 'xorshift32 step', average: 'three shifts and three XORs', worst: 'period 2³² − 1, and the state is 32 bits' },
        { operation: 'PCG32 step', average: 'an LCG step plus a data-dependent rotation', worst: 'period 2⁶⁴, and the low bits are as good as the high' },
        { operation: 'MT19937 step', average: 'amortised one XOR and two shifts; a twist every 624 draws', worst: '2 496 bytes of state and a linear-complexity failure in TestU01' },
        { operation: 'bounded by rejection', average: '1.2790 draws a sample at 8 bits and n = 200', worst: 'unbounded, though the probability decays geometrically' },
        { operation: 'bounded by modulo', average: 'exactly 1 draw', worst: 'a ratio of 2.000× between the most and least likely output' }
      ],
      failureModes: [
        {
          symptom: 'A generator passes every test in the suite and produces visibly structured data.',
          cause: 'The suite tests single outputs, and the structure is in consecutive ones.',
          fix: 'Plot pairs and triples, and check any linear identity the family is known to satisfy.'
        },
        {
          symptom: '`rand() % 8` returns a repeating pattern.',
          cause: 'Bit k of a power-of-two-modulus LCG has period 2^(k+1).',
          fix: 'Take the high bits, or use a generator whose output is permuted.'
        },
        {
          symptom: 'A sampled distribution is slightly wrong and no amount of sampling fixes it.',
          cause: '`value % n` is biased whenever n does not divide the range.',
          fix: 'Use rejection or Lemire; both are exactly uniform for about 28% more draws.'
        },
        {
          symptom: 'A shuffle favours some orderings and the generator tests clean.',
          cause: 'The swap partner is drawn from the whole array, so nⁿ paths cover n! outcomes.',
          fix: 'Draw from the unvisited suffix — Fisher-Yates — which gives exactly n! paths.'
        },
        {
          symptom: 'Session tokens turn out to be predictable.',
          cause: 'A statistically good generator was used where unpredictability was required.',
          fix: 'Use the platform CSPRNG; statistical quality and unpredictability are different properties.'
        }
      ],
      inTheWild: [
        { system: 'RANDU', how: 'shipped by IBM through the 1960s and 70s; its triples lie on fifteen planes, and results computed with it had to be revisited.' },
        { system: 'V8’s Math.random', how: 'is xorshift128+, which is fast and statistically good and explicitly documented as not cryptographically secure.' },
        { system: 'Lemire’s bounded generation', how: 'is what Go, Swift and several C++ implementations use, because it is exactly uniform with one multiplication and almost never a second draw.' }
      ],
      sources: [
        { title: 'Random number generators: good ones are hard to find', author: 'Park and Miller', note: 'The paper that made MINSTD a standard, and named the failures that motivated it.' },
        { title: 'PCG: a family of simple fast space-efficient statistically good algorithms', author: 'Melissa O’Neill', note: 'The permuted-output design, with a survey of what the existing families get wrong.' },
        { title: 'Fast random integer generation in an interval', author: 'Daniel Lemire', note: 'The multiply-and-check method and its exact-uniformity proof.' },
        { title: 'TestU01: a C library for empirical testing of random number generators', author: "L'Ecuyer and Simard", note: 'The batteries, and what each of them is actually able to detect.' }
      ]
    },

    'integer-algorithms': {
      summary: 'Five identifier schemes measured on the three properties that separate them: index ' +
        'locality as a working set, ordering across and within a millisecond, and what a holder ' +
        'of one learns.',
      intuition: 'The fields that make an identifier cheap to index are exactly the fields that ' +
        'make it informative to a stranger.',
      formulation: {
        equations: [
          {
            label: 'Index locality, as a working set',
            expr: 'distinct pages touched by the last 64 inserts, over 4 096 pages',
            terms: [
              { sym: 'sequential integer', meaning: '14 pages, switching page on 20.5% of inserts' },
              { sym: 'Snowflake', meaning: '14 pages and 20.5% — its low bits are a counter' },
              { sym: 'UUIDv7 and ULID', meaning: '15 pages, but switching on 38.8% — intra-millisecond randomness' },
              { sym: 'UUIDv4', meaning: '64 pages, switching on 100.0%, and the working set grows with the window' }
            ]
          },
          {
            label: 'Ordering, split two ways',
            expr: 'across milliseconds and within one',
            terms: [
              { sym: 'across milliseconds', meaning: '0 inversions for every time-ordered scheme; 9 963 for UUIDv4' },
              { sym: 'within one millisecond', meaning: 'UUIDv7 6 735 of 13 333 pairs, ULID 6 665 — about half, as randomness predicts' },
              { sym: 'Snowflake', meaning: '0 of 13 333 — strictly monotonic per machine' },
              { sym: 'why it matters', meaning: 'a cursor paging by `id > last` drops rows under the first two' }
            ]
          },
          {
            label: 'The Snowflake layout, and its two ceilings',
            expr: 'timestamp << 22 | machine << 12 | sequence',
            terms: [
              { sym: '41 bits of milliseconds', meaning: '69 years from the chosen epoch' },
              { sym: '10 bits of machine id', meaning: '1 024 generators, assigned by something outside the generator' },
              { sym: '12 bits of sequence', meaning: '4 096 per machine per millisecond — a hard rate ceiling' },
              { sym: 'measured', meaning: '5 000 requests in one millisecond borrow exactly 1 millisecond from the future, 0 duplicates' }
            ]
          },
          {
            label: 'A backwards clock',
            expr: 'three options, two of which keep uniqueness',
            terms: [
              { sym: 'wait', meaning: '13 of 13 issued, 0 dropped, 8 stalls — spends latency' },
              { sym: 'refuse', meaning: '5 of 13 issued, 8 dropped — spends availability' },
              { sym: 'serve from the stale reading', meaning: 'issues 8 duplicates; not offered, and it is what happens by default' },
              { sym: 'testing it', meaning: 'requires injecting the clock, which is why the generator takes one' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Page assignment is by rank among the actual keys',
          why: 'A B-tree splits pages where the data is, so an equal-frequency partition is what a filled index looks like.',
          breaks: 'Deriving the page from leading bytes confines hex identifiers to a fifth of the pages and flatters them.'
        },
        {
          name: 'Ordering is reported across and within a millisecond separately',
          why: 'Time-ordered schemes score perfectly on one and about 50% on the other.',
          breaks: '"UUIDv7 is sortable" becomes an assumption a paging cursor is built on.'
        },
        {
          name: 'The clock is injected rather than read',
          why: 'A backwards step is the only interesting failure and it cannot otherwise be reproduced.',
          breaks: 'The regression path is untestable, so it ships untested.'
        },
        {
          name: 'A regression and being ahead of the clock are counted separately',
          why: 'One is an external fault and one is self-inflicted by the sequence ceiling.',
          breaks: 'A burst looks like a fleet-wide clock fault, and the wrong thing is escalated.'
        }
      ],
      complexity: [
        { operation: 'sequential integer', average: 'one increment; requires coordination', worst: 'a single point of allocation, and the value is the row count' },
        { operation: 'UUIDv4', average: '122 random bits, no coordination', worst: 'working set equal to the insert window, growing without bound' },
        { operation: 'UUIDv7 / ULID', average: '48-bit timestamp plus 74 or 80 random bits', worst: 'about half of same-millisecond pairs out of order' },
        { operation: 'Snowflake', average: 'one integer, strictly monotonic per machine', worst: '4 096 per millisecond, then it borrows from the future' },
        { operation: 'collision probability at 10⁹ identifiers', average: '9.4e-20 for 122 random bits, 4.1e-7 for 80', worst: 'zero for the counter-based schemes, which trade it for coordination' }
      ],
      failureModes: [
        {
          symptom: 'Insert throughput collapses once a table outgrows the buffer pool.',
          cause: 'Random primary keys give a working set the size of the insert window.',
          fix: 'Use a time-ordered key internally; the working set drops to a handful of pages.'
        },
        {
          symptom: 'A cursor paging by `id > last` silently skips rows.',
          cause: 'UUIDv7 and ULID are ordered to the millisecond and random within one.',
          fix: 'Page by (timestamp, id) or use a strictly monotonic scheme.'
        },
        {
          symptom: 'A primary-key violation appears days after the fact and cannot be reproduced.',
          cause: 'The generator served from a clock that had stepped backwards.',
          fix: 'Wait or refuse; test it by injecting a clock that steps back.'
        },
        {
          symptom: 'A backfill job stalls at a fixed rate per node.',
          cause: 'The 12-bit sequence field is 4 096 identifiers per machine per millisecond.',
          fix: 'Add machines, widen the sequence, or accept the ceiling as a documented rate limit.'
        },
        {
          symptom: 'A competitor can estimate the row count or the write rate.',
          cause: 'A sequential id IS the count; a Snowflake carries the per-millisecond sequence.',
          fix: 'Expose an opaque external identifier and keep the ordered one internal.'
        }
      ],
      inTheWild: [
        { system: 'Twitter Snowflake', how: 'is the origin of the 41/10/12 layout, built because sequential ids needed a coordinator and UUIDs would not fit a bigint index.' },
        { system: 'PostgreSQL and MySQL', how: 'both see the locality effect directly, which is why UUIDv7 support and "ordered UUID" columns exist at all.' },
        { system: 'Instagram', how: 'shards on a time-ordered id whose bits carry the shard, so the identifier routes the query as well as ordering the index.' }
      ],
      sources: [
        { title: 'RFC 9562, Universally Unique IDentifiers', author: 'IETF', note: 'The current specification, including v7 and the reasoning for a time-ordered variant.' },
        { title: 'Announcing Snowflake', author: 'Twitter Engineering', note: 'The original post, with the constraints that produced the 41/10/12 split.' },
        { title: 'The ULID specification', author: 'Alizain Feerasta', note: 'The Crockford base32 encoding and the monotonic-within-a-millisecond option.' },
        { title: 'Sharding and IDs at Instagram', author: 'Instagram Engineering', note: 'Putting the shard in the identifier, and what it costs when the shard count changes.' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));

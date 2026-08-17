/** Worked examples for B-trees and augmented trees (M04.7-M04.8). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'b-trees': [
      {
        title: 'Sizing an index from the page, not from a preference',
        goal: 'Derive the branching factor from the storage geometry and check the page reads it predicts.',
        setup: 'One million keys, 8-byte keys, 8-byte pointers, loaded in sorted order. Cost is page ' +
          'reads, which is what a database reports.',
        steps: [
          {
            do: 'Compute the order from the page.',
            why: 'Each child needs a pointer, and all but one needs a separator key.',
            work: 'order = ⌊(page + key) / (key + pointer)⌋\n' +
              '4 KB: (4096 + 8) / 16 = 256\n512 B: (512 + 8) / 16 = 32\n16 KB: (16384 + 8) / 16 = 1 024',
            result: '256 children on a 4 KB page — a consequence, not a choice'
          },
          {
            do: 'Predict the height and measure it.',
            why: 'Every level is a separate I/O, so the height is the lookup cost.',
            work: 'log_256(10⁶) = 2.49 → 3 levels\nmeasured: height 3, 3 page reads',
            result: 'a million keys, three reads'
          },
          {
            do: 'Do the same for the other two page sizes.',
            why: 'To see how flat the return on a bigger page is.',
            work: '512 B:  order 32, height 5, 5 reads\n4 KB:   order 256, height 3, 3 reads\n' +
              '16 KB:  order 1 024, height 3, 3 reads',
            result: 'quadrupling the page from 4 KB to 16 KB removes no level at all'
          },
          {
            do: 'Check the naive prediction against the measurement.',
            why: 'log_B(n) assumes the pages are full, and they are not.',
            work: '512 B:  log_B(n) = 4, measured 5\n16 KB: log_B(n) = 2, measured 3\n' +
              'measured fill: 51.6% and 50.0%',
            result: 'the textbook figure is a level short on two of the three'
          },
          {
            do: 'Redo the prediction using the measured fill.',
            why: 'The branching factor that matters is order × fill.',
            work: '512 B:  log_{32×0.516}(10⁶) = 4.93 → 5 ✓\n' +
              '4 KB:   log_{256×0.502}(10⁶) = 2.85 → 3 ✓\n16 KB: log_{1024×0.500}(10⁶) = 2.22 → 3 ✓',
            result: 'all three land exactly on the measurement'
          }
        ],
        answer: 'The order is (page + key)/(key + pointer) — 256 on a 4 KB page — and it gives three ' +
          'page reads for a million keys. The textbook log_B(n) under-predicts by a level on two of ' +
          'the three geometries, because a sequential load leaves pages half full; using order × fill ' +
          'matches the measurement exactly.'
      },
      {
        title: 'What the fill factor costs, and what a range scan buys',
        goal: 'Price the two things a lookup-only view of a B+ tree misses: the occupancy left by the ' +
          'load order, and the scan the leaf chain makes cheap.',
        setup: '100 000 keys on a 1 KB page — order 64, so the effects are visible at a readable '+
          'size — loaded first sequentially and then in random order, and then scanned on the '+
          '4 KB page from the first example.',
        steps: [
          {
            do: 'Measure the occupancy each load order produces.',
            why: 'Every split leaves two half-full pages; whether they refill depends on the order.',
            work: 'sequential: 50.8% fill\nrandom:     68.6% fill\ntheory for random: ln 2 = 69.3%',
            result: 'the classic ln 2 result, measured'
          },
          {
            do: 'Say what that difference is worth.',
            why: 'Occupancy is index size, and index size is levels.',
            work: 'sequential: 3 222 pages, height 4; random: 2 367 pages, height 3; '+
              'a third more pages, and a whole extra level of I/O per lookup',
            result: 'the load order costs a third of the index size'
          },
          {
            do: 'Note the fix.',
            why: 'A database loading sorted data does not insert one row at a time.',
            work: 'bulk load: fill each leaf to the requested factor, link them, build upward; '+
              '1 pass, 0 splits, 0 rebalancing steps',
            result: 'which is why CREATE INDEX is far faster than the equivalent INSERTs'
          },
          {
            do: 'Measure the range scan.',
            why: 'This is the operation the leaf chain exists for.',
            work: '10 keys:     3 page reads\n100 keys:    3 page reads\n' +
              '1 000 keys:  10 page reads\n10 000 keys: 81 page reads',
            result: 'the descent is paid once, then one page per leaf-full of rows'
          },
          {
            do: 'Compare with fetching the same rows by lookup.',
            why: 'This is the difference between an index scan and an index seek per row.',
            work: 'scan of 10 000 rows: 81 page reads\n' +
              '10 000 individual lookups: 10 000 × 3 = 30 000 page reads',
            result: '370× — and it is the same tree, the same rows and the same index'
          }
        ],
        answer: 'A sequential load leaves pages 50.8% full against 68.6% for a random one — a third ' +
          'more pages for the same keys, which is what bulk loading fixes. And the leaf chain turns ' +
          '10 000 rows into 81 page reads where 10 000 separate lookups would cost 30 000: the ' +
          'range scan is the reason B+ trees index databases.'
      }
    ],

    'augmented-trees': [
      {
        title: 'What one extra field per node buys',
        goal: 'Measure the three augmentations against the brute-force scan each one replaces.',
        setup: 'A balanced tree of 100 000 keys for the order-statistic and range-sum queries, and ' +
          '18 211 intervals for the stabbing query. Every answer is checked against a scan.',
        steps: [
          {
            do: 'Ask for the 50 000th smallest key with the subtree size on hand.',
            why: 'The size lets the descent decide which way to go without counting anything.',
            work: 'select(50 000) on a 100 000-key tree of height 17\nnodes visited: 13',
            result: '13 nodes, against 50 000 for a scan'
          },
          {
            do: 'Stab a point in 18 211 intervals with the max endpoint on hand.',
            why: 'A subtree whose maxEnd is below the point cannot contain it, so it is skipped whole.',
            work: 'stab(50 000): 7 intervals found\nnodes visited: 22, subtrees pruned: 6',
            result: '22 nodes, against a scan of 18 211'
          },
          {
            do: 'Sum a range of 1 001 keys with the subtree sum on hand.',
            why: 'A subtree entirely inside the range contributes its stored sum and is not descended into.',
            work: 'rangeSum(1 000, 2 000) = 1 501 500\nnodes visited: 51, subtrees pruned: 7',
            result: 'correct, and logarithmic rather than proportional to the range'
          },
          {
            do: 'Check what the same query costs without using the field.',
            why: 'Storing the field and then walking every node anyway is the common half-measure.',
            work: 'range sum by visiting every node in range: 1 020 nodes\n' +
              'range sum using the stored subtree sums: 51 nodes',
            result: '20× — the augmentation is in the query, not only in the field'
          },
          {
            do: 'Confirm every answer against brute force.',
            why: 'A subtly wrong augmentation returns plausible answers, which is the failure mode.',
            work: 'select: 50 000th of the sorted array ✓\nstab: 7 by scan, 7 by tree ✓\n' +
              'rangeSum: 1 501 500 by scan ✓',
            result: 'all three agree'
          }
        ],
        answer: 'Subtree size answers select(50 000) in 13 node visits; max-endpoint answers a stabbing ' +
          'query in 22 visits over 18 211 intervals; subtree sum answers a 1 001-key range in 51. The ' +
          'last one is the caution: the same field with a naive query costs 1 020 visits, so the ' +
          'saving lives in the query, not in the field.'
      },
      {
        title: 'The field that cannot be maintained',
        goal: 'Apply the augmentation rule to a field that fails it, and find the field that answers ' +
          'the same question and passes.',
        setup: 'The rule: a field is maintainable exactly when it is computable from the node and the ' +
          'same field on its two children. The candidate: "the median of my subtree".',
        steps: [
          {
            do: 'Try to compute a subtree median from the two child medians.',
            why: 'That is what the rule requires, and it is the whole test.',
            work: 'left subtree {1, 2, 3}, median 2\nright subtree {10, 20, 30}, median 20\n' +
              'node 5 — the union is {1,2,3,5,10,20,30}, median 5',
            result: '5 is neither 2 nor 20 nor any function of them alone'
          },
          {
            do: 'Show that the failure is not a lack of cleverness.',
            why: 'A second example with the same child medians and a different answer settles it.',
            work: 'left {1,2,3} median 2, right {10,20,30} median 20, node 5 → median 5\n' +
              'left {0,2,4,6,8} median 4… changing only the sizes changes the answer',
            result: 'the same child medians can give different parent medians'
          },
          {
            do: 'Work out what that costs if you maintain it anyway.',
            why: 'The field can be kept correct — just not in constant time.',
            work: 'repairing a median after a rotation needs the whole subtree, so it is '+
              'O(subtree) per rotation rather than O(1) — up to 100 000 nodes here, not 2',
            result: 'the tree stops being logarithmic'
          },
          {
            do: 'Find a field that passes the rule and answers the question.',
            why: 'This is the productive move whenever a field fails.',
            work: 'size passes: 1 + size(left) + size(right)\n' +
              'median = select(⌈n / 2⌉), which is one descent: 13 nodes at n = 100 000',
            result: 'the median in O(log n), from a field that is maintainable'
          },
          {
            do: 'Apply the same test to two more tempting fields.',
            why: 'So the rule becomes a habit rather than a fact about medians.',
            work: 'distinct values: fails — the 2 children may share values and neither knows; '+
              'subtree min and max: passes — 1 comparison against each of the 2 children',
            result: 'one question, asked in the same form, decides all of them'
          }
        ],
        answer: 'A subtree median is not computable from the two child medians — {1,2,3} and {10,20,30} ' +
          'around node 5 gives 5, which is not a function of 2 and 20 — so maintaining it would cost ' +
          'O(subtree) per rotation. Subtree size does pass the rule, and select(⌈n/2⌉) answers the ' +
          'same question in 13 node visits.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));

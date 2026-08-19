/** Worked examples for the persistence sections (M09.1-M09.3). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'persistence-basics': [
      {
        title: 'What one update costs, three ways',
        goal: 'Apply the identical operation sequence under path copying, fat nodes and node copying, and ' +
          'measure what keeping every version actually costs in each.',
        setup: '400 insertions drawn from a 1 200-key universe, seed 1. The tree is a treap with hashed ' +
          'priorities, so all three end up with the same shape - 344 live keys at depth 18 - and only the ' +
          'persistence method differs.',
        steps: [
          {
            do: 'Establish the baseline: what would copying the whole structure per version cost?',
            why: 'Every figure below is only interesting relative to the naive answer.',
            work: '400 versions × 344 live keys × 40 bytes = 5 504 000 bytes',
            result: '5.5 MB to keep 400 snapshots of a 344-key set'
          },
          {
            do: 'Measure path copying: rebuild the root-to-leaf path, share everything off it.',
            why: 'This is what every immutable collection library actually does.',
            work: '13.12 nodes allocated per update at depth 18\n' +
              '3 918 distinct nodes across all 400 versions\n' +
              '156 720 bytes',
            result: '35× less than copying, and the read path is untouched'
          },
          {
            do: 'Note why 13.12 exceeds nothing and falls short of 18.',
            why: 'Quoting "exactly the depth" would be the clean version and not the true one.',
            work: 'an insert rebuilds one path of at most 18 nodes\n' +
              'a treap insert also rotates, and each rotation rebuilds 2 more\n' +
              'most inserts land shallower than the deepest leaf',
            result: 'the measured figure is a small multiple of the mean depth, not the maximum'
          },
          {
            do: 'Measure fat nodes: never copy, append a version-stamped entry instead.',
            why: 'It is the cheapest possible write, and the question is what it costs elsewhere.',
            work: '344 node objects in total - one per distinct key, never copied\n' +
              '3 574 version entries appended across 400 updates\n' +
              '0.86 nodes allocated per update, 76 448 bytes',
            result: '2.05× smaller than path copying, and nothing is ever rebuilt'
          },
          {
            do: 'Measure node copying: one spare box per node, copy on the second change.',
            why: 'This is the O(1)-amortised result, and the cascade is the part to check rather than believe.',
            work: '1 861 boxes filled and 1 713 cascades over 400 updates\n' +
              '5.14 nodes allocated per update\n' +
              '2 057 distinct nodes, 126 944 bytes',
            result: '2.6× fewer allocations than path copying, at 1.23× less memory'
          }
        ],
        answer: 'All three keep 400 versions of a 344-key tree, and all three answer every one of them ' +
          'correctly. Path copying allocates 13.12 nodes per update for 156 720 bytes; node copying allocates ' +
          '5.14 for 126 944; fat nodes allocate 0.86 for 76 448. Against the 5 504 000 bytes that copying every ' +
          'version would cost, even the most expensive of them is 35× smaller - which is the actual answer to ' +
          '"can we afford to keep the history".'
      },
      {
        title: 'Where the saving comes back: the read path',
        goal: 'Invert the first example. Instead of measuring what each method costs to write, measure what it ' +
          'costs to read - which is the column that decides the choice in practice and is missing from most ' +
          'comparisons.',
        setup: 'The same three trees. 2 000 membership queries, each at a randomly chosen version between 1 ' +
          'and 400, counting the probes each query performs.',
        steps: [
          {
            do: 'Count what a query costs on the path-copying tree.',
            why: 'It is the baseline, because a version is just a root pointer and nothing else changes.',
            work: '8.61 key comparisons per query\n' +
              '0 version lookups\n' +
              'the tree at version v is an ordinary tree',
            result: '8.61 probes - exactly what the ephemeral structure would cost'
          },
          {
            do: 'Count the same queries on the node-copying tree.',
            why: 'Its whole claim is O(1) amortised space *without* a read penalty.',
            work: '8.61 key comparisons, 0 version lookups\n' +
              'a box is checked with one comparison, not a search',
            result: '8.61 probes - identical, and the claim holds'
          },
          {
            do: 'Count them on the fat-node tree.',
            why: 'This is where the cheapest write turns out to have been paid for.',
            work: '8.61 key comparisons\n' +
              '8.05 version-list binary searches - one per pointer traversal\n' +
              'each searches a list of up to 400 entries, so up to log₂ 400 = 8.6 steps inside it',
            result: '16.66 probes per query - 1.94× the other two'
          },
          {
            do: 'Put the two axes side by side.',
            why: 'Neither column alone decides anything.',
            work: 'path copying: 156 720 bytes,  8.61 probes\n' +
              'node copying: 126 944 bytes,  8.61 probes\n' +
              'fat nodes:     76 448 bytes, 16.66 probes',
            result: 'fat nodes save 2.05× the memory and cost 1.94× the read'
          },
          {
            do: 'Decide from a read/write ratio rather than from the table.',
            why: 'The right answer is a property of the workload, not of the structure.',
            work: 'an audit log written constantly and read rarely → fat nodes\n' +
              'a snapshot read thousands of times per write → path copying\n' +
              'allocation pressure the real constraint → node copying (5.14 nodes per update)',
            result: 'three methods, three workloads, and no overall winner'
          }
        ],
        answer: 'The cheapest write is the most expensive read, almost exactly: fat nodes store 2.05× less and ' +
          'perform 1.94× more probes per query, because every pointer traversal becomes a binary search over ' +
          'that field\'s history and log₂ 400 = 8.6. Node copying is the one that refuses the trade - 8.61 ' +
          'probes, the same as path copying, at 1.23× less memory - which is what the O(1)-amortised result ' +
          'actually buys. Comparing persistence methods on space alone gets this backwards.'
      }
    ],

    'persistent-sequences': [
      {
        title: 'Breaking an amortised bound on purpose',
        goal: 'Construct the case that makes a textbook amortised-O(1) queue cost O(n) per operation, and then ' +
          'watch a memoised suspension repair it.',
        setup: 'A two-list queue built to 512 elements. The version chosen for reuse is the one whose next ' +
          '`tail` triggers a rotation - front and rear both 255 long - and it is reused 1 000 times.',
        steps: [
          {
            do: 'State the amortised argument that is about to fail.',
            why: 'It is a correct argument about a premise that persistence removes.',
            work: 'each push costs 1 and saves 1 credit\n' +
              'a rotation of n elements costs n and spends n credits\n' +
              'valid iff each version is consumed once',
            result: 'the bound holds for linear use and assumes it'
          },
          {
            do: 'Reuse the pre-rotation version 1 000 times with the strict queue.',
            why: 'Nothing prevents a caller from holding an old version; that is what persistence means.',
            work: '510 000 steps for 1 000 calls\n' +
              '510.00 steps per reuse\n' +
              'worst single operation: 510',
            result: 'the rotation is re-paid in full, every time, forever'
          },
          {
            do: 'Do exactly the same thing to the banker\'s queue.',
            why: 'Its rotation is a suspension stored in the queue rather than work done at the call.',
            work: '1 502 steps for the same 1 000 calls\n' +
              'the suspension is forced 8 times and the memo is hit 1 518 times\n' +
              '1.50 steps per reuse',
            result: '340× less work for the identical sequence of calls'
          },
          {
            do: 'Identify which half of "lazy evaluation" is doing the work.',
            why: 'Because "make it lazy" is the wrong lesson and is what people take away.',
            work: 'all 1 000 reuses point at the same suspension object\n' +
              'the first to force it pays 503 steps; the rest read the memo\n' +
              'a lazy value without a memo recomputes and behaves exactly like the strict queue',
            result: 'the sharing of the computation is the fix, not the deferral of it'
          }
        ],
        answer: 'One version, reused a thousand times: 510.00 steps per reuse for the strict queue and 1.50 for ' +
          'the banker\'s - a factor of 340 for the same calls returning the same answers. The amortised bound ' +
          'was never a property of the algorithm alone; it was a property of the algorithm plus the assumption ' +
          'that each version is used once. Persistence deletes the assumption, and a memoised suspension is what ' +
          'puts the bound back.'
      },
      {
        title: 'Laziness fixes persistence and does not fix latency',
        goal: 'Invert the first example: stop reusing old versions, run all three queues linearly, and look at ' +
          'the single most expensive operation rather than the total.',
        setup: 'The same three queues, 512 pushes followed by 512 pops - 1 024 operations, each version used ' +
          'exactly once, which is the case the amortised argument was always valid for.',
        steps: [
          {
            do: 'Confirm the amortised bound holds for all three under linear use.',
            why: 'Otherwise the comparison below would be about something else.',
            work: 'mean steps per operation over 1 024 operations:\n' +
              'strict 1.49, banker 1.49, real-time 1.00',
            result: 'all three are constant on average, exactly as advertised'
          },
          {
            do: 'Now ask what the worst single operation cost.',
            why: 'A frame budget or a tail-latency target is a statement about this number, not about the mean.',
            work: 'strict:     511 steps in one operation\n' +
              'banker:   1 014 steps in one operation\n' +
              'real-time:    2 steps',
            result: 'the banker\'s queue has a *larger* spike than the queue it fixed'
          },
          {
            do: 'Explain the result that looks like a bug and is not.',
            why: 'It is the whole reason the real-time variant exists.',
            work: 'the banker\'s queue defers rotations rather than performing them\n' +
              'the front is a chain of suspensions, and forcing the head can cascade\n' +
              '2 rotations coming due together are forced by 1 operation: 1 014 steps, the worst in the run',
            result: 'deferral moves the spike; it does not remove it'
          },
          {
            do: 'Look at what the real-time queue does differently.',
            why: 'It is the only one of the three that can be put behind a latency budget.',
            work: 'the rotation is a chain of n suspensions, each doing O(1) work\n' +
              'one link is forced per queue operation, by the schedule\n' +
              'the rotation always completes before the next one is due',
            result: '2 steps in the worst case over the whole run, at a *lower* mean than the others'
          },
          {
            do: 'Check that the fix survives the first example\'s attack too.',
            why: 'A worst-case bound that persistence breaks would be no better than an amortised one.',
            work: 'the same pre-rotation reuse experiment, 1 000 times:\n' +
              '1.00 steps per reuse, worst operation 1',
            result: 'bounded per operation and bounded under arbitrary reuse'
          }
        ],
        answer: 'Under linear use all three queues average about one step per operation, and the worst single ' +
          'operation is 511, 1 014 and 2 steps. The banker\'s queue - the fix for the persistence problem - has ' +
          'the biggest spike of the three, because deferring the rotations lets two of them come due at once. ' +
          'Amortised O(1) and worst-case O(1) are different promises, laziness delivers the first and only ' +
          'scheduling delivers the second, and which one you need is decided by whether anybody is measuring a ' +
          'tail.'
      }
    ],

    'versioned-queries': [
      {
        title: 'Five hundred versions of a thousand-element array',
        goal: 'Keep every version of a mutable array and query any of them, then account for what the history ' +
          'cost against the obvious alternative.',
        setup: '1 024 elements, 500 point updates, and 2 004 range-sum queries spread over all 501 versions ' +
          'and checked against a replay of the array.',
        steps: [
          {
            do: 'Predict the per-update cost before measuring it.',
            why: 'A segment tree is perfectly balanced and never rotates, so the count should be exact.',
            work: 'an update rebuilds one root-to-leaf path\n' +
              '⌈log₂ 1 024⌉ + 1 = 11 nodes',
            result: 'a prediction of exactly 11, not "about 11"'
          },
          {
            do: 'Measure it.',
            why: 'This is the cleanest instance of structural sharing there is, and it should be exact.',
            work: '500 updates, 7 547 distinct nodes in total\n' +
              'initial tree 2 047 nodes; (7 547 − 2 047) / 500 = 11.00',
            result: 'exactly 11 nodes per version, matching the bound'
          },
          {
            do: 'Check that the history is actually answerable.',
            why: 'A structure that is right at the tip and wrong three versions back passes every naive test.',
            work: '2 004 range-sum queries across all 501 versions\n' +
              'each compared against a replayed copy of the array at that version',
            result: '0 disagreements'
          },
          {
            do: 'Account for the space against copying every version.',
            why: 'The ratio is the reason snapshot isolation is feasible at all.',
            work: 'shared:  241 504 bytes for 501 versions\n' +
              'copied: 32 817 504 bytes (501 × 2 047 nodes × 32)',
            result: '135.9× less, and the gap widens linearly with the version count'
          },
          {
            do: 'Note what a historical query costs.',
            why: 'This is what separates a persistent structure from a change log.',
            work: 'a version is a root pointer, so a query at version 12 is an ordinary descent\n' +
              'replaying a log to reconstruct version 12 would be O(changes)',
            result: 'O(log n) to read any point in history, identical to reading the present'
          }
        ],
        answer: 'Every update adds exactly 11 nodes - one root-to-leaf path in a 1 024-leaf tree - and every one ' +
          'of the 501 versions answers range sums correctly. 241 504 bytes hold the whole history against ' +
          '32 817 504 for independent copies, a factor of 135.9 that grows with every version added. This is ' +
          'the structure under copy-on-write filesystems and snapshot isolation, and the arithmetic is why ' +
          'those features are cheap enough to leave switched on.'
      },
      {
        title: 'The query no monoid can answer',
        goal: 'Invert the first example: instead of keeping versions because the data changes, *manufacture* ' +
          'versions - one per array prefix - and use the difference between two of them as an index.',
        setup: '512 values drawn from a 1 000-value domain. A counting tree over the *value* domain is built ' +
          'after each element, giving 513 versions, and 300 range k-th-smallest queries are checked against a ' +
          'sorted slice.',
        steps: [
          {
            do: 'Say why the obvious structures cannot do this.',
            why: 'M08.7 established that an order statistic is not a monoid.',
            work: 'combining two ranges\' answers needs x at combine time\n' +
              'a segment tree node stores 1 value and cannot',
            result: 'no annotation makes "k-th smallest in a range" a fold'
          },
          {
            do: 'Build one version per prefix over the value domain.',
            why: 'Version i then counts the values in positions [0, i).',
            work: '512 values, 513 versions, 10.98 nodes allocated per value\n' +
              '5 622 distinct nodes, 179 904 bytes',
            result: 'the same path-copying cost as before, over a different domain'
          },
          {
            do: 'Take the difference of two versions without building anything.',
            why: 'This is the entire trick.',
            work: 'version r+1 minus version l counts exactly positions [l, r]\n' +
              'the two trees have identical shape, so they are walked together\n' +
              'at each step the left-child counts are subtracted',
            result: 'a counting tree for any range, materialised nowhere'
          },
          {
            do: 'Descend it to find the k-th smallest.',
            why: 'The descent is guided by the difference, so it is a single pass.',
            work: '10.0 descents per query - ⌈log₂ 1 000⌉ + 1 = 11 is the bound\n' +
              '0 wrong of 300 queries against a sorted slice',
            result: 'the k-th smallest in any range in one descent of the value domain'
          },
          {
            do: 'Compare it with the structure M08 used for the weaker question.',
            why: 'The persistent construction answers more, faster, for comparable memory.',
            work: 'merge-sort tree: counts values below x, 44.85 nodes and 57.78 comparisons per query\n' +
              'persistent prefix trees: the k-th smallest itself, 10.0 descents per query',
            result: 'a harder question answered in a fifth of the work'
          }
        ],
        answer: 'Building one version per prefix turns a persistent segment tree into a range order-statistic ' +
          'index: 10.0 descents answer "the k-th smallest value in positions l to r" exactly, over 300 ' +
          'randomised queries, for 10.98 nodes per value. M08 answered the strictly easier question - how many ' +
          'values below x - with a merge-sort tree at 44.85 nodes and 57.78 comparisons per query. The lesson ' +
          'is worth generalising: versions do not have to come from time. Manufacturing them along another axis ' +
          'is a technique.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));

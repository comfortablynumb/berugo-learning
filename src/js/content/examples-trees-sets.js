/** Worked examples for skip lists and disjoint set union (M04.9-M04.10). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'skip-lists': [
      {
        title: 'What p actually trades',
        goal: 'Test the natural assumption that a smaller p means a faster search, and find what it ' +
          'really changes.',
        setup: '100 000 keys, seed 5, maximum 24 levels. Search cost is comparisons averaged over ' +
          '1 000 lookups; memory is forward pointers per node.',
        steps: [
          {
            do: 'Write down the two competing effects.',
            why: 'The intuition only looks at the first one.',
            work: 'levels  L = log_{1/p}(n) — falls as p falls\n' +
              'steps per level ≈ 1/p — rises as p falls\ncost ≈ L/p + 1/(1 − p)',
            result: 'the two move in opposite directions'
          },
          {
            do: 'Measure the search cost at three values of p.',
            why: 'To see how much of the intuition survives contact.',
            work: 'p = 0.5:   17 levels, 30.89 comparisons per search\n' +
              'p = 0.368: 15 levels, 32.99\np = 0.25:   8 levels, 32.13',
            result: 'a factor of two in levels, and 7% in comparisons'
          },
          {
            do: 'Measure the memory instead.',
            why: 'This is the term that is not flat.',
            work: 'expected tower height = 1/(1 − p)\n' +
              'p = 0.5:   1.999 pointers per node, 199 877 in total\n' +
              'p = 0.368: 1.582 · p = 0.25: 1.333, 133 297 in total',
            result: 'a third less memory at p = 0.25, for 4% more comparisons'
          },
          {
            do: 'Check the measured tower heights against the prediction.',
            why: 'If 1/(1 − p) is exact, the memory claim is exact too.',
            work: 'predicted 2.000, measured 1.999\npredicted 1.333, measured 1.333',
            result: 'the geometric mean, to three decimals'
          },
          {
            do: 'Explain the choice implementations actually make.',
            why: 'Redis and LevelDB use 0.25, not the search-optimal 1/e.',
            work: 'search optimum: p = 1/e = 0.368, and the curve around it is flat\n' +
              'memory: strictly decreasing in p',
            result: 'optimise the term that varies, which is memory'
          }
        ],
        answer: 'Halving p from 0.5 to 0.25 changes the search cost from 30.89 comparisons to 32.13 — ' +
          'four percent — while changing the memory from 2.00 pointers per node to 1.33. p is a ' +
          'memory dial with a small side effect on speed, which is why implementations pick 0.25 over ' +
          'the search-optimal 1/e.'
      },
      {
        title: 'Where a skip list loses, and why it is still the right choice',
        goal: 'Compare a skip list against a balanced tree on the metric it loses, then on the one ' +
          'that decides real adoptions.',
        setup: 'The same 100 000 keys in a skip list at p = 0.5 and in an AVL tree, measured over ' +
          '1 000 lookups each.',
        steps: [
          {
            do: 'Compare the comparison counts.',
            why: 'This is the metric a textbook comparison stops at.',
            work: 'skip list, p = 0.5: 30.89 comparisons per search\n' +
              'AVL tree: 15.68 comparisons per search, height 17',
            result: 'the skip list costs about twice as much'
          },
          {
            do: 'Explain the gap rather than excusing it.',
            why: 'The express lanes are a coarser index than a tree branch.',
            work: 'a tree comparison halves the remaining range\n' +
              'a skip-list step advances by 1/p nodes on that level',
            result: 'a tree extracts more information per comparison'
          },
          {
            do: 'Compare what an insertion has to do.',
            why: 'This is the metric that decides whether the structure can be shared.',
            work: 'skip list: splice into 1/(1 − p) = 2 linked lists, 2 pointer writes\n' +
              'AVL: descend, rebalance, up to 2 rotations and 6 pointer writes',
            result: 'the skip-list insertion touches nothing it did not just splice'
          },
          {
            do: 'Turn that into the concurrency argument.',
            why: 'A splice is one pointer write; a rotation is not.',
            work: 'skip list: 1 compare-and-swap per level, 0 locks for readers; '+
              'balanced tree: a rotation moves 3 nodes at once, so the subtree must be locked',
            result: 'lock-free insertion is available to one of them and not the other'
          },
          {
            do: 'State when to pick which.',
            why: 'Both answers are right for a stated workload.',
            work: 'single-threaded and comparison-bound: the tree, at 15.68 against 30.89; '+
              'concurrent or code-size-bound: the skip list, at 1 CAS per level',
            result: 'and that is why LevelDB and Redis chose it'
          }
        ],
        answer: 'A skip list costs 30.89 comparisons per search against an AVL tree\'s 15.68 — it ' +
          'genuinely loses on the textbook metric. It wins where it matters to LevelDB and Redis: an ' +
          'insertion is a splice of two pointers rather than a rotation, so it can be made lock-free ' +
          'with one compare-and-swap per level, and readers need no synchronisation at all.'
      }
    ],

    'disjoint-sets': [
      {
        title: 'What each half of the bound is worth',
        goal: 'Separate the two optimisations and measure what each contributes, rather than treating ' +
          '"union by rank plus path compression" as one thing.',
        setup: '100 000 elements, 100 000 random unions at seed 3, then a find on every element. Cost ' +
          'is pointer hops per find and pointer writes.',
        steps: [
          {
            do: 'Run union by rank with no compression at all.',
            why: 'To see what the union rule alone achieves.',
            work: 'deepest node: 8 hops\nhops per find: 1.993\npointer writes: 0',
            result: 'depth 8 out of a possible 100 000 — the union rule is doing most of the work'
          },
          {
            do: 'Add full path compression.',
            why: 'This is the half that flattens what the finds have already walked.',
            work: 'deepest node: 3 hops\nhops per find: 1.017\npointer writes: 17 751',
            result: 'the forest is essentially flat after one sweep'
          },
          {
            do: 'Compare the one-pass variants.',
            why: 'Splitting and halving get the same asymptotic bound for less bookkeeping.',
            work: 'splitting: depth 3, 1.042 hops, 20 250 writes\n' +
              'halving:   depth 4, 0.859 hops, 23 280 writes',
            result: 'all three land within a few percent of each other'
          },
          {
            do: 'Note what compression costs.',
            why: 'It is not free, and the trade is visible in the last column.',
            work: 'none:        0 pointer writes, 1.993 hops per find\n' +
              'compression: 17 751 writes, 1.017 hops',
            result: 'about 18 000 writes bought half the hops'
          },
          {
            do: 'State the bound the two together earn.',
            why: 'Because it is famous, and because the honest phrasing matters.',
            work: 'O(α(n)) amortised, α(n) = 4 for every n up to 2^65536\n' +
              'Tarjan also proved a matching lower bound',
            result: '"effectively constant" — not constant, and never distinguishable'
          }
        ],
        answer: 'Union by rank alone holds the deepest node at 8 hops over 100 000 elements; adding ' +
          'path compression takes it to 3 and halves the hops per find, for about 18 000 pointer ' +
          'writes. The one-pass variants land within a few percent. Together the two give O(α(n)), ' +
          'which is 4 for every input anyone will ever run.'
      },
      {
        title: 'The trap: compression and rollback cannot coexist',
        goal: 'Show precisely why a rollback-capable DSU has to give up path compression, and what it ' +
          'costs to do so.',
        setup: 'A union journals what it changed so it can be undone. The question is whether a find ' +
          'can do the same.',
        steps: [
          {
            do: 'Count what a union changes.',
            why: 'This is what makes undo possible at all.',
            work: 'parent[attached root] = kept root — 1 write\n' +
              'rank[kept root] += 1 sometimes — 1 write\njournal entry: 2 values',
            result: 'constant space per union, exactly undoable'
          },
          {
            do: 'Count what a compressing find changes.',
            why: 'The comparison is the whole argument.',
            work: 'a find over a path of length k rewrites k − 1 parents\n' +
              'measured: 17 751 writes across 100 000 finds\n' +
              'none of them recorded by any union',
            result: 'unbounded, and invisible to the journal'
          },
          {
            do: 'Try to journal them anyway.',
            why: 'To see why the obvious fix is not one.',
            work: 'journalling every compression write means recording all 17 751 of them; '+
              'and the undo has to replay them in reverse, in order',
            result: 'the bookkeeping costs more than the compression saves'
          },
          {
            do: 'Price the variant that does support rollback.',
            why: 'Giving up compression is not giving up the structure.',
            work: 'union by rank only: depth 8, 1.993 hops per find at 100 000 elements\n' +
              'worst case O(log n) rather than O(α(n))',
            result: 'twice the hops, and an exact undo'
          },
          {
            do: 'Say where this actually bites.',
            why: 'So the rule is attached to the situation that produces it.',
            work: 'offline dynamic connectivity: 1 segment tree over time, 1 DSU with undo; '+
              'the recursion unions on the way down and undoes on the way up, at every one of its log n levels',
            result: 'the algorithm requires rollback, so it requires the union-only variant'
          }
        ],
        answer: 'A union changes two values and can be journalled exactly; a compressing find rewrote ' +
          '17 751 parents across 100 000 finds that no union recorded. So rollback forces union by ' +
          'rank alone — 1.993 hops per find instead of 1.017, and a depth of 8 instead of 3, in ' +
          'exchange for an undo that restores the arrays exactly.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));

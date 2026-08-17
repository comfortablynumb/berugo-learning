/** Worked examples for the search-tree sections (M04.1-M04.3). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'bst-rotations': [
      {
        title: 'What a sorted bulk load costs',
        goal: 'Price the difference between loading 1 000 keys in order and loading them shuffled.',
        setup: 'An unbalanced BST, keys 1…1000, inserted first in sorted order and then in a shuffled ' +
          'order (seed 1). Cost is comparisons, which is machine-independent.',
        steps: [
          {
            do: 'Count the comparisons a sorted insertion makes.',
            why: 'Every new key is larger than everything already in the tree, so it walks the whole ' +
              'right spine before hanging off the end.',
            work: 'insert of the i-th key costs i − 1 comparisons\n' +
              'total = 0 + 1 + 2 + … + 999 = n(n − 1)/2 = 1000 × 999 / 2',
            result: '499 500 comparisons'
          },
          {
            do: 'Read off the shape that produces.',
            why: 'Each node has exactly one child, so the structure is a linked list with a tree API.',
            work: 'height = n = 1000\nmean depth = (n + 1)/2 = 500.5\nideal height = ⌈log₂(n + 1)⌉ = 10',
            result: 'height 1000 against an ideal of 10'
          },
          {
            do: 'Measure the same keys shuffled.',
            why: 'Random order is the baseline the asymptotic analysis is about.',
            work: 'seed 1 shuffle of 1…1000\nbuild cost = 11 454 comparisons\nheight = 23, mean depth = 12.45',
            result: '11 454 comparisons, height 23'
          },
          {
            do: 'Take the ratio.',
            why: 'It is the number to quote when someone proposes bulk-loading an ordered export.',
            work: 'build:  499 500 / 11 454 = 43.6×\nlookup: 500.5 / 12.45 = 40.2× the mean depth',
            result: '43.6× the build cost, 40× the lookup cost'
          },
          {
            do: 'Check the average against the theory.',
            why: 'The asymptotic constants arrive slowly, so quoting them at a practical size ' +
              'overstates the height.',
            work: 'over 50 seeds at n = 1000: mean height 22.3, mean depth 12.0\n' +
              'asymptotic: 4.311·ln n = 29.8 and 2·ln n = 13.8',
            result: 'measured 22.3, asymptotic 29.8 — the formula is an upper reading at this size'
          }
        ],
        answer: 'Sorted insertion costs 499 500 comparisons and produces height 1 000; the same keys ' +
          'shuffled cost 11 454 and produce height 23. The keys are identical — only the order ' +
          'differed, and it cost a factor of 43.'
      },
      {
        title: 'What one rotation actually buys',
        goal: 'Show that a rotation is worth exactly the difference between two subtree sizes, and ' +
          'work out what that implies for repairing a degenerate tree.',
        setup: 'rotateLeft(y) with pivot x = y.right. Call the three subtrees A = y.left, B = x.left ' +
          'and C = x.right. Cost is the sum of every node\'s depth, which is n × the mean lookup.',
        steps: [
          {
            do: 'Work out which nodes move.',
            why: 'A rotation moves whole subtrees by one level each; nothing else changes.',
            work: 'y descends 1, x rises 1\nA descends 1 (|A| nodes), C rises 1 (|C| nodes), B is unmoved\n' +
              'Δ(total depth) = (1 + |A|) − (1 + |C|) = |A| − |C|',
            result: 'Δ = |A| − |C|, and nothing else enters it'
          },
          {
            do: 'Apply it to a balanced five-node tree.',
            why: 'This is the case that shows a rotation is not free improvement.',
            work: 'tree: 4 at the root, left child 2, right child 8 holding 6 and 9\n' +
              'depths: 1 + 2 + 2 + 3 + 3 = 11\n' +
              'rotateLeft(4): A = {2} so |A| = 1, C = {9} so |C| = 1, so Δ = 0\n' +
              'after: 8 at the root, depths 1 + 2 + 2 + 3 + 3 = 11',
            result: 'total depth 11 → 11: zero-sum'
          },
          {
            do: 'Apply it to a five-node right spine.',
            why: 'Here one side is empty and the other holds everything, so the rotation is worth the ' +
              'most it can be.',
            work: 'spine 1→2→3→4→5, depths 1 + 2 + 3 + 4 + 5 = 15\n' +
              'rotateLeft(1): A = {} so |A| = 0, C = {3,4,5} so |C| = 3\nΔ = 0 − 3 = −3',
            result: 'total depth 15 → 12, exactly as Δ predicts'
          },
          {
            do: 'Scale it to the 1 000-key spine from the first example.',
            why: 'To see whether "just rotate it back into shape" is a plan.',
            work: 'spine total depth = n(n + 1)/2 = 500 500\n' +
              'balanced total depth = 8 987 (511 nodes over 9 levels, then 489 at depth 10)\n' +
              'to remove = 491 513, and one rotation removes at most |A| − |C| ≤ n − 1 = 999',
            result: 'at least 493 rotations, and in practice Θ(n)'
          },
          {
            do: 'Draw the conclusion the rest of M04 is built on.',
            why: 'A repair costs a linear number of rotations; maintenance costs one or two per insert.',
            work: 'repair after the fact: Θ(n) rotations\nAVL insert: at most 1 rotation\n' +
              'red-black insert: at most 2',
            result: 'balance is maintained per operation, not repaired afterwards'
          }
        ],
        answer: 'A rotation changes the total depth by exactly |A| − |C| — zero on a balanced tree, ' +
          'and at most n − 1 on a degenerate one. Since a 1 000-key spine is 491 513 units of depth ' +
          'away from balanced, no constant number of rotations can fix it: every family that follows ' +
          'keeps the tree balanced as it goes instead.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));

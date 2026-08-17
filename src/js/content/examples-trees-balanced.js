/** Worked examples for AVL and red-black trees (M04.2-M04.3). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'avl-trees': [
      {
        title: 'Where the 1.44 comes from, and what the tree measures',
        goal: 'Derive the AVL height bound from the sparsest legal tree, then check a real one against it.',
        setup: 'The question is inverted: rather than asking how tall a tree of n nodes can be, ask ' +
          'how few nodes a legal tree of height h can hold. Measurements are at n = 10 000, seed 1.',
        steps: [
          {
            do: 'Write the recurrence for the sparsest AVL tree of height h.',
            why: 'To be as sparse as possible while staying legal, one subtree is height h − 1 and ' +
              'the other is h − 2 — any thinner and the balance factor would be ±2.',
            work: 'N(h) = N(h − 1) + N(h − 2) + 1\nN(1) = 1, N(2) = 2',
            result: 'a Fibonacci recurrence, shifted by one'
          },
          {
            do: 'Tabulate it.',
            why: 'The numbers show how fast the requirement grows, which is what makes the bound tight.',
            work: 'h:  1  2  3  4  5   6   7   8   9   10\nN: 1  2  4  7  12  20  33  54  88  143',
            result: 'height 10 needs only 143 nodes, against 1 023 for a perfect tree'
          },
          {
            do: 'Invert it into a bound on the height.',
            why: 'N(h) grows like φ^h, so h grows like log_φ n = log₂ n / log₂ φ.',
            work: '1 / log₂ φ = 1.4404\nh < 1.4404 · log₂(n + 2) − 0.328',
            result: 'about 44% taller than a perfect tree, in the worst case'
          },
          {
            do: 'Evaluate it at n = 10 000 and measure against it.',
            why: 'A bound nobody checks is decoration.',
            work: 'bound = 1.4404 × log₂(10 002) − 0.328 = 18.81\n' +
              'perfect tree = ⌈log₂(10 001)⌉ = 14\nmeasured: sorted 14, shuffled 16',
            result: 'both inside 18.81, and sorted input lands on the perfect height'
          },
          {
            do: 'Count the rebalances the same build performed.',
            why: 'The bound is about shape; this is what the shape cost.',
            work: 'sorted:   9 986 single rotations, 0 double — 0.999 per insert\n' +
              'shuffled: 2 331 single, 2 320 double — 0.465 per insert',
            result: 'sorted rebalances nearly every time and never needs a double rotation'
          }
        ],
        answer: 'The Fibonacci recurrence gives h < 1.4404·log₂(n + 2) − 0.328, which is 18.81 at ' +
          'n = 10 000. A real tree measures 14 on sorted input and 16 on shuffled — and the sorted ' +
          'input that turns a plain BST into a 10 000-node list produces the perfectly balanced height here.'
      },
      {
        title: 'What the strictest bound costs on the write side',
        goal: 'Price AVL against red-black on an identical operation stream, and find where the ' +
          'received wisdom is right and where it is vaguer than it sounds.',
        setup: '20 000 operations over a 6 000-key span, seed 5, replayed through both families. Both ' +
          'answer identically; only the cost differs.',
        steps: [
          {
            do: 'Establish the asymmetry inside AVL first.',
            why: 'Insertion has a bound that deletion does not, and that is the whole argument.',
            work: 'worst rebalances in a single insert over 20 000 inserts: 1\n' +
              'deleting 5 000 keys from 10 000: 1 919 rotations, 0.384 per delete\n' +
              'worst single deletion in that run: 6 rotations',
            result: 'insertion is bounded at one rebalance; deletion is bounded only by the height'
          },
          {
            do: 'Run an insert-heavy mix through both families.',
            why: 'This is where AVL is supposed to be at its best.',
            work: '90% insert / 5% delete / 5% find\n' +
              'AVL: 225 915 comparisons, 4 338 rotations, height 15\n' +
              'red-black: 227 170 comparisons, 3 606 rotations, height 15',
            result: 'AVL saves 1 255 comparisons and spends 732 extra rotations'
          },
          {
            do: 'Run a delete-heavy mix.',
            why: 'This is where red-black is supposed to win.',
            work: '30% insert / 55% delete / 15% find\n' +
              'AVL: 205 837 comparisons, 4 056 rotations, height 13\n' +
              'red-black: 205 504 comparisons, 3 242 rotations, height 14',
            result: 'red-black now wins on both counts — fewer rotations and fewer comparisons'
          },
          {
            do: 'State the size of the effect rather than its direction.',
            why: 'The folklore says "AVL for reads"; the numbers say the gap is small.',
            work: 'comparisons differ by 0.6% and 0.2%\nrotations differ by 20% and 25%\n' +
              'heights differ by 0 or 1 level',
            result: 'the rotation gap is real and the comparison gap is nearly noise'
          },
          {
            do: 'Draw the conclusion that survives the measurement.',
            why: 'A recommendation should rest on the number that actually moves.',
            work: 'insert-heavy: AVL saves 1 255 comparisons and spends 732 extra rotations; '+
              'delete-heavy: AVL costs 333 more comparisons and 814 more rotations; '+
              'so at 1 rotation = 1 comparison, AVL is 523 units ahead on the first and 1 147 behind on the second',
            result: 'the deciding question is what a pointer write costs you, not what the average depth is'
          }
        ],
        answer: 'AVL is the shallower tree and does about 20% more rotations for it. On measured ' +
          'workloads the comparison saving is under 1% while the rotation gap is 20 to 25%, so the ' +
          'right question is not "reads or writes" but "what does a pointer write cost here" — which ' +
          'is why libraries, where nodes are shared and deletions are common, chose red-black.'
      }
    ],

    'red-black-trees': [
      {
        title: 'The height bound, from the black height up',
        goal: 'Derive 2·log₂(n + 1) from the two load-bearing rules, and check it against a measured tree.',
        setup: 'A red-black tree of 10 000 shuffled keys, seed 2. Black height and total height are ' +
          'both measured from the structure rather than assumed.',
        steps: [
          {
            do: 'Bound the nodes from below using the black height.',
            why: 'Every path holds the same number of black nodes, so a subtree of black height b ' +
              'contains at least a complete black tree of that height.',
            work: 'n ≥ 2^b − 1, where b is the black height',
            result: 'b ≤ log₂(n + 1)'
          },
          {
            do: 'Bound the height from above using the red rule.',
            why: 'No red node has a red child, so at most every second node on a path is red.',
            work: 'h ≤ 2b',
            result: 'h ≤ 2·log₂(n + 1)'
          },
          {
            do: 'Evaluate at n = 10 000 and measure.',
            why: 'To see how much slack the bound leaves in practice.',
            work: 'bound = 2 × log₂(10 001) = 26.58\nmeasured height = 16, black height = 8',
            result: 'the measured height is exactly 2 × the black height, and well inside the bound'
          },
          {
            do: 'Read the same tree as a 2-3-4 tree.',
            why: 'The black height is the 2-3-4 height, which is what the colours encode.',
            work: '5 164 nodes: 1 646 2-nodes (31.9%), 2 200 3-nodes (42.6%), 1 318 4-nodes (25.5%)\n' +
              '2-3-4 height = black height = 8',
            result: 'a 2-3-4 tree of height 8 over 10 000 keys'
          },
          {
            do: 'Count what building it cost.',
            why: 'The fixup is mostly recolouring, and recolouring writes no pointers.',
            work: '5 763 rotations, 33 239 recolourings over 10 000 insertions\n' +
              '0.576 rotations per insert',
            result: 'about six recolourings per rotation'
          }
        ],
        answer: 'The two load-bearing rules give h ≤ 2·log₂(n + 1) = 26.58 at n = 10 000, and the ' +
          'measured tree has height 16 with black height 8 — the factor of two, exactly. The same ' +
          'tree is a 2-3-4 tree of height 8, which is what the colours were encoding all along.'
      },
      {
        title: 'What the colours cost, and the case that inverts the trade',
        goal: 'Show what red-black gives up against AVL, then find the workload where the ranking flips.',
        setup: 'The identical 20 000-operation stream from the AVL section, replayed through both ' +
          'families at three different operation mixes.',
        steps: [
          {
            do: 'Compare the shapes.',
            why: 'The looser invariant should show up as a taller tree, and it does — barely.',
            work: 'insert-heavy: both height 15\nbalanced mix: AVL 14, red-black 15\n' +
              'delete-heavy: AVL 13, red-black 14',
            result: 'red-black is at most one level taller on these runs'
          },
          {
            do: 'Compare the comparisons that height implies.',
            why: 'This is the cost AVL is supposed to be buying down.',
            work: 'insert-heavy: 225 915 against 227 170 — AVL 0.6% fewer\n' +
              'balanced: 214 913 against 216 761 — AVL 0.85% fewer\n' +
              'delete-heavy: 205 837 against 205 504 — red-black 0.2% fewer',
            result: 'under one percent either way, and the sign flips on the delete-heavy mix'
          },
          {
            do: 'Compare the rotations.',
            why: 'This is the cost red-black is buying down, and the gap is an order of magnitude larger.',
            work: 'insert-heavy: 4 338 against 3 606 — red-black 17% fewer\n' +
              'balanced: 4 434 against 3 613 — 19% fewer\n' +
              'delete-heavy: 4 056 against 3 242 — 20% fewer',
            result: 'red-black does about a fifth fewer pointer writes across every mix'
          },
          {
            do: 'Find the inversion.',
            why: 'The received wisdom has AVL winning the read side; the delete-heavy row has it losing both.',
            work: 'at 30% insert / 55% delete, AVL is taller in comparisons AND does more rotations\n' +
              'because AVL deletions rebalance repeatedly and red-black deletions do not',
            result: 'the delete-heavy workload beats AVL on its own metric'
          },
          {
            do: 'State the decision rule.',
            why: 'So the choice rests on a measurable property of your workload.',
            work: 'reads dominate and deletes are under about 10%: AVL, for the 1 level and the '+
              '0.6% of comparisons it saves; anything else: red-black, for the 17 to 20% of '+
              'rotations it saves — and note the whole spread here is 3 613 to 4 434 rotations',
            result: 'and the honest note: the gap is a few percent, so this is rarely the bottleneck'
          }
        ],
        answer: 'Red-black gives up at most one level of height and under 1% of comparisons, and buys ' +
          'about 20% fewer rotations for it. On a delete-heavy stream it wins on both — which is why ' +
          'the libraries that delete chose it, and why the "AVL for reads" rule of thumb needs its ' +
          'workload stated before it means anything.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));

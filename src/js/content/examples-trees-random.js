/** Worked examples for treaps, splay trees and scapegoat trees (M04.4-M04.6). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    treaps: [
      {
        title: 'Three insertion orders, one tree',
        goal: 'Check the claim the whole structure rests on: with the priorities fixed, the shape ' +
          'does not depend on the order the keys arrived in.',
        setup: '1 000 keys, priority seed 1, inserted sorted, shuffled and reverse-sorted. The trees ' +
          'are compared on height and root key; the build cost is compared separately.',
        steps: [
          {
            do: 'Build the same keys three ways and read off the shape.',
            why: 'If the shape is a function of the priorities alone, all three must agree exactly.',
            work: 'sorted:   height 23, root 623\nshuffled: height 23, root 623\nreversed: height 23, root 623',
            result: 'identical trees, to the node'
          },
          {
            do: 'Compare the cost of building them.',
            why: 'The trees agree; the paths taken to build them do not.',
            work: 'sorted:   14 464 comparisons\nshuffled: 24 230 comparisons\nreversed: 12 840 comparisons',
            result: 'the same destination reached by three different routes'
          },
          {
            do: 'Change the seed instead of the order.',
            why: 'To confirm what the shape actually depends on.',
            work: 'seed 1, sorted: height 23, root 623\nseed 2, sorted: height 21, root 523',
            result: 'the seed moves the tree; the insertion order does not'
          },
          {
            do: 'Check the height against the random-BST expectation.',
            why: 'The priorities encode a random insertion order, so the height should match one.',
            work: '40 seeds at n = 1 000: mean height 22.4, worst 26\n' +
              'random BST over 40 shuffles: mean height 22.3\n3·log₂ 1 000 = 29.9',
            result: 'the treap height distribution is the random-BST height distribution'
          },
          {
            do: 'Contrast with the plain BST on the same sorted input.',
            why: 'This is what the randomisation bought.',
            work: 'plain BST, sorted input: height 1 000\ntreap, sorted input: height 23',
            result: 'a factor of 43, for a priority field and no balance code'
          }
        ],
        answer: 'With priorities derived from the keys, sorted, shuffled and reversed insertion all ' +
          'produce the identical treap — height 23, root 623 at seed 1 — while the plain BST goes to ' +
          'height 1 000 on the sorted case. The shape follows the seed, and the seed is not something ' +
          'the input gets to choose.'
      },
      {
        title: 'The mistake that quietly removes the guarantee',
        goal: 'Show what happens when priorities are drawn from a sequence at insertion time instead ' +
          'of derived from the key, and why the demo is what caught it.',
        setup: 'The same 1 000 keys and seed, with the priority taken from rng.next() as each node is ' +
          'created — the natural first implementation, and the one this platform shipped first.',
        steps: [
          {
            do: 'Note which draw each key receives.',
            why: 'The generator produces a fixed sequence; the insertion order decides who gets what.',
            work: 'sorted insertion:  key 1 gets draw 1, key 2 gets draw 2, …\n' +
              'reverse insertion: key 1000 gets draw 1, key 999 gets draw 2, …',
            result: 'the priority is a property of the position, not of the key'
          },
          {
            do: 'Build sorted and reversed and compare.',
            why: 'If the priorities differ per key, the unique-shape argument no longer applies.',
            work: 'sorted:   height 21, root 987\nreversed: height 21, root 14',
            result: 'the same height by coincidence, and a completely different tree'
          },
          {
            do: 'Say precisely what was lost.',
            why: 'The heights looked fine, which is why this survives review.',
            work: 'checkInvariants() passes on both trees; both orders hold at all 1 000 nodes; '+
              'expected height is still O(log n) — and the shape is a function of history again',
            result: 'every invariant passes and the design goal is gone'
          },
          {
            do: 'Fix it by hashing the key with the seed.',
            why: 'Then the priority is a property of the key, and the tree is a property of the key set.',
            work: 'priority = mix(fnv1a(key) ⊕ seed) / 2³²\nsorted: 623 · shuffled: 623 · reversed: 623',
            result: 'all three orders agree again'
          },
          {
            do: 'Note what would have caught it.',
            why: 'No invariant check could — both invariants held throughout.',
            work: 'checkInvariants(): passed on all 1 000 nodes before and after; '+
              'the "three orders, one shape" table: 3 different roots before, 1 after',
            result: 'the property test has to test the property, not the invariant'
          }
        ],
        answer: 'Drawing priorities from a sequence leaves every treap invariant intact and destroys ' +
          'the guarantee: sorted and reversed insertion produced roots 987 and 14 rather than one ' +
          'tree. Deriving the priority from the key restores it. An invariant checker cannot find ' +
          'this, because nothing about the structure is invalid — only the claim about it is.'
      }
    ],

    'splay-trees': [
      {
        title: 'Where self-adjustment starts paying',
        goal: 'Find the access skew at which a splay tree overtakes a balanced tree, rather than ' +
          'asserting that it does.',
        setup: '2 000 keys, 20 000 accesses drawn from a Zipf distribution, seed 9. The build phase is ' +
          'excluded from the measurement — charging it to the access phase would swamp the effect.',
        steps: [
          {
            do: 'Measure a nearly flat access pattern.',
            why: 'With no hot set there is nothing for splaying to exploit, and the rotations are pure cost.',
            work: 'skew 0.6: splay 13.01 comparisons per access, AVL 10.32',
            result: 'splay costs 1.26× the balanced tree'
          },
          {
            do: 'Increase the skew until the lines cross.',
            why: 'This is the number worth knowing, and it is a property of the workload rather than of the structures.',
            work: 'skew 0.8: 11.86 against 10.47 — ratio 1.13\n' +
              'skew 1.0: 10.02 against 10.69 — ratio 0.94',
            result: 'the crossover sits between skew 0.8 and 1.0'
          },
          {
            do: 'Push the skew further.',
            why: 'To see how fast the working-set property pays once it applies.',
            work: 'skew 1.2: 7.80 against 10.94 — ratio 0.71\n' +
              'skew 1.6: 4.40 against 11.37 — ratio 0.39\n' +
              'skew 2.0: 2.77 against 11.60 — ratio 0.24',
            result: 'at skew 2.0 splaying costs a quarter of the balanced tree'
          },
          {
            do: 'Note what the AVL column is doing.',
            why: 'It is nearly flat, which is the control that makes the comparison trustworthy.',
            work: 'AVL: 10.32 → 10.47 → 10.69 → 10.94 → 11.37 → 11.60',
            result: 'the balanced tree is indifferent to the distribution, as it should be'
          },
          {
            do: 'Count what the splaying cost to achieve it.',
            why: 'Because those rotations are writes, and the next concept is what that rules out.',
            work: 'skew 0.6: 57 726 zig-zigs and 57 419 zig-zags per 20 000 accesses\n' +
              'skew 2.0: 8 331 and 5 554',
            result: 'about 3.6 splay steps per read, which is 6.8 rotations'
          }
        ],
        answer: 'A splay tree costs 1.26× a balanced tree on a nearly uniform pattern and 0.24× on a ' +
          'sharply skewed one, crossing over between Zipf skew 0.8 and 1.0. The AVL baseline barely ' +
          'moves across the whole range, which is what makes the splay curve a measurement of the ' +
          'workload rather than of the tree.'
      },
      {
        title: 'The cost the amortised bound does not mention',
        goal: 'Price the fact that a splay tree writes on every read, which is what usually decides ' +
          'against it regardless of the comparison count.',
        setup: 'The same 20 000-access run at skew 1.2, where splaying is comfortably ahead on ' +
          'comparisons, examined for what it did to the tree while reading it.',
        steps: [
          {
            do: 'Take the run where splaying wins clearly.',
            why: 'To make the point on the structure\'s best ground rather than its worst.',
            work: 'skew 1.2: splay 7.80 comparisons per access, AVL 10.94 — 29% cheaper',
            result: 'splaying is 29% ahead on the metric it is judged by'
          },
          {
            do: 'Count the writes those reads performed.',
            why: 'Every rotation is three pointer writes to a shared structure.',
            work: '9 748 zigs + 32 597 zig-zigs + 30 496 zig-zags over 20 000 accesses\n' +
              '= 3.64 splay steps and 6.80 rotations per read, so about 20 pointer writes',
            result: 'a read-only workload performed roughly 400 000 pointer writes'
          },
          {
            do: 'Work out what that costs a second thread.',
            why: 'This is the decision most systems actually face.',
            work: 'AVL: a read takes a shared lock, so 8 reader threads proceed together; '+
              'splay: every one of the 20 000 reads needs the exclusive lock',
            result: 'read concurrency drops from n to 1'
          },
          {
            do: 'And a memory-mapped or read-only page.',
            why: 'Some structures live where writing is not merely expensive but impossible.',
            work: 'a splay of a mapped page costs 1 page fault and 1 copy-on-write per read; '+
              'a read-only mapping supports 0 splays, so the structure cannot be used there',
            result: 'the amortised bound is irrelevant if the write is not permitted'
          },
          {
            do: 'State the case where it is still the right answer.',
            why: 'The structure is genuinely excellent in its niche, and the niche is precise.',
            work: 'single-threaded, in-memory, Zipf skew above 1.0, 0 concurrent readers, '+
              'and no budget on the worst single operation, which can still cost n',
            result: 'a per-thread cache is the canonical fit'
          }
        ],
        answer: 'Even at the skew where splaying wins by 29% on comparisons, it performs about 3.5 ' +
          'rotations per read — roughly 400 000 pointer writes for a 20 000-access read-only ' +
          'workload. That is what collapses read concurrency to one thread and rules the structure ' +
          'out of shared or mapped memory, and no amortised bound speaks to it.'
      }
    ],

    'scapegoat-trees': [
      {
        title: 'What α actually buys',
        goal: 'Sweep the one parameter and read off both sides of the trade, rather than accepting a default.',
        setup: '10 000 keys inserted in sorted order — the input that forces the maximum amount of ' +
          'rebuilding — at six values of α.',
        steps: [
          {
            do: 'Write down what α controls directly.',
            why: 'Everything else in the structure follows from the depth limit.',
            work: 'depth limit = ⌊log_{1/α}(n)⌋\n' +
              'α = 0.55 → 16 · α = 0.65 → 22 · α = 0.9 → 88',
            result: 'a stricter α is a shallower tree, by construction'
          },
          {
            do: 'Measure the height actually reached.',
            why: 'To confirm sorted input pushes the tree right up against its limit.',
            work: 'α:      0.55  0.60  0.65  0.70  0.80  0.90\n' +
              'limit:    16    19    22    26    42    88\nheight:   16    19    22    26    42    87',
            result: 'the height sits exactly on the limit at every α'
          },
          {
            do: 'Measure what that cost in rebuilding.',
            why: 'This is the other side of the dial, and it moves much faster.',
            work: 'nodes rebuilt per insertion:\n' +
              'α = 0.55 → 40.27 · 0.65 → 18.69 · 0.80 → 9.99 · 0.90 → 7.53',
            result: 'the strictest setting rebuilds five times as much as the loosest'
          },
          {
            do: 'Check the amortised claim against log n.',
            why: 'The whole argument is that rebuilding stays logarithmic per operation.',
            work: 'log₂ 10 000 = 13.29\nα = 0.65 rebuilds 18.69 nodes per insert = 1.41 × log₂ n',
            result: 'a small constant times log n, which is what amortised O(log n) means here'
          },
          {
            do: 'Pick a setting on purpose.',
            why: 'The default exists to be changed once you know what it trades.',
            work: 'reads dominate and writes are rare → 0.55, height 16\n' +
              'writes dominate → 0.8, height 42 and a quarter of the rebuild cost',
            result: 'α = 0.65 is a middle, not a law'
          }
        ],
        answer: 'α sets the depth limit directly and the rebuild bill follows: 0.55 caps the height at ' +
          '16 and rebuilds 40.3 nodes per insertion, while 0.9 allows 88 and rebuilds 7.5. At the ' +
          'usual 0.65 the tree is 22 deep and rebuilds 18.7 nodes per insertion — 1.41 × log₂ n, ' +
          'which is the amortised bound showing up as a measurement.'
      },
      {
        title: 'The workload the rebuilds are almost free on',
        goal: 'Show that a scapegoat tree only pays for the disorder it is actually handed, which ' +
          'inverts the first example completely.',
        setup: 'The same 10 000 keys at α = 0.65, inserted shuffled instead of sorted, and then a ' +
          'deletion phase to exercise the second rule.',
        steps: [
          {
            do: 'Insert the keys shuffled and count the rebuilds.',
            why: 'A random order rarely pushes a node past the depth limit.',
            work: 'sorted:   8 584 rebuilds, 18.69 nodes per insertion\n' +
              'shuffled:   439 rebuilds,  0.21 nodes per insertion',
            result: 'a factor of ninety in rebuild work'
          },
          {
            do: 'Compare the trees those two builds produced.',
            why: 'If the cheap one were also worse, the saving would not be a saving.',
            work: 'sorted:   height 22\nshuffled: height 22\nlimit:    22',
            result: 'identical height — the cheaper build is not the worse tree'
          },
          {
            do: 'Contrast with a family that stores metadata.',
            why: 'AVL does roughly the same work whatever the input; this one does not.',
            work: 'AVL, sorted:   9 986 rebalances, all single rotations' + 
              '; AVL, shuffled: 4 651 rebalances (6 971 rotations); '+
              'scapegoat, shuffled: 439 rebuilds',
            result: 'the rotating families always pay; this one pays only when provoked'
          },
          {
            do: 'Run the deletion rule.',
            why: 'Deletion never rebuilds a subtree, so it should do nothing until it does everything.',
            work: 'delete 5 000 of 10 000 keys at α = 0.65\n' +
              'rebuild triggers when live < 0.65 × 10 000 = 6 500\n' +
              'measured: exactly 1 whole-tree rebuild, of 6 499 nodes',
            result: 'one rebuild, at the moment the count crosses the threshold'
          },
          {
            do: 'Say what the average is hiding.',
            why: 'The same objection M01.3 raises against every amortised bound.',
            work: 'amortised: 0.21 nodes per insertion on shuffled input\n' +
              'worst single insertion: rebuilds the root subtree — up to n nodes',
            result: 'excellent throughput, and a tail no average describes'
          }
        ],
        answer: 'Shuffled insertion costs 439 rebuilds and 0.21 nodes per insertion against sorted ' +
          'input\'s 8 584 and 18.69 — ninety times cheaper for the same height 22. The structure ' +
          'charges only for the disorder it is given, and pays it back in one spike rather than in ' +
          'instalments, which is the trade in both directions.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));

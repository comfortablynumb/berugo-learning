/** Worked examples for spanning trees and tree path queries (M13.9-M13.10). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'minimum-spanning-trees': [
      {
        title: 'Three algorithms, one weight, and the minimax path nobody asked for',
        goal: 'Compute a minimum spanning tree three ways, verify the result structurally, and then ' +
          'get a second answer out of it for free.',
        setup: 'A random graph of 60 nodes and 180 edges with weights drawn from 1 to 20. Kruskal, ' +
          'Prim and Borůvka each run on it, and each result is checked acyclic and spanning.',
        steps: [
          {
            do: 'Run all three and compare the weight.',
            why: 'The weight and the spanning property are the invariants; nothing else is guaranteed.',
            work: 'all three return 59 edges weighing 270, on a graph where 160 edges share a weight ' +
              'with an earlier one',
            result: 'three derivations agreeing on the answer'
          },
          {
            do: 'Check each result with a union-find rather than trusting the weight.',
            why: 'Two implementations can share a mistake and produce two matching wrong numbers.',
            work: 'none of the 59 chosen edges closes a cycle, and the components match the graph\'s own',
            result: 'acyclic and spanning, checked independently of the weight'
          },
          {
            do: 'Compare the work each one paid.',
            why: 'Equal answers, unequal cost — and the cost is where the choice lives.',
            work: 'Kruskal 1 666, Prim 2 280, Borůvka 1 170 units; Borůvka finishes in 3 rounds',
            result: 'a 1.95× spread on the same graph'
          },
          {
            do: 'Watch Prim exploit one cut at a time.',
            why: 'The cut property is the correctness engine and it can be shown rather than asserted.',
            work: 'after 20 edges the tree holds 21 nodes and the next edge, 4–24 at weight 5, is the ' +
              'lightest of all edges crossing that cut',
            result: 'every step is the same theorem applied to a different split'
          },
          {
            do: 'Now ask the tree for the minimax path between random pairs and check it against an oracle.',
            why: 'The maximum edge on the MST path is the smallest maximum any path can achieve.',
            work: '198 pairs, 0 disagreements against a binary search over weight thresholds',
            result: 'a second problem answered by a structure built for the first'
          }
        ],
        answer: '270, from three algorithms costing 1 666, 2 280 and 1 170 units, each verified acyclic ' +
          'and spanning. The part worth taking away is the last step: "minimise the worst hop" is a ' +
          'different question from "minimise the total", it is the one network design actually asks, ' +
          'and the spanning tree you already built answers it exactly — on 198 pairs with zero ' +
          'disagreements against a brute-force threshold oracle.'
      },
      {
        title: 'The tree that is not unique, and the ranking that inverts',
        goal: 'Show that "all three agree" is a claim about weight rather than about the tree, and ' +
          'that no algorithm here is the fastest.',
        setup: 'The same generator at three weight ranges — 1 to 3, 1 to 20, and 1 to 100 000 — over ' +
          'twenty instances each; then the edge count swept from 60 to 900 at 60 nodes.',
        steps: [
          {
            do: 'Run all three on twenty instances with weights from 1 to 3 and compare edge sets.',
            why: 'Duplicate weights admit several optimal trees, and tie-breaks decide which.',
            work: '20 of 20 agree on weight; 0 of 20 agree on the edge set, at 177 duplicate edges on average',
            result: 'never the same tree, always the same cost'
          },
          {
            do: 'Repeat with effectively distinct weights.',
            why: 'Distinct weights are sufficient for a unique minimum spanning tree.',
            work: '20 of 20 agree on weight and 20 of 20 agree on the edge set, at 0.2 duplicates',
            result: 'uniqueness restored, and the earlier disagreement explained'
          },
          {
            do: 'Ask for the second-best spanning tree on the duplicate-heavy default.',
            why: 'The cycle property says the runner-up differs by exactly one edge.',
            work: 'the best swap takes edge 76 out and edge 109 in, for a total of 270 — a difference of 0',
            result: 'a tie, which means the minimum spanning tree was never unique'
          },
          {
            do: 'Sweep the density and compare the three cost columns.',
            why: 'A single "which is fastest" answer would mean two of these should have been deleted.',
            work: '60 edges: 425 / 426 / 619 · 900 edges: 10 576 / 15 840 / 8 428',
            result: 'Borůvka is worst at the sparse end and best at the dense end'
          },
          {
            do: 'Note what stays still.',
            why: 'Each Borůvka round at least halves the component count.',
            work: 'the round count moves between 3 and 4 across a 15× change in edge count',
            result: 'the scan count grows and the round count does not'
          }
        ],
        answer: 'This inverts the first example on both axes. There the three algorithms agreed; here ' +
          'they agree on 270 and disagree on which 59 edges make it, on 20 of 20 instances with ' +
          'duplicate weights — so a test asserting a particular tree is asserting the tie-break rather ' +
          'than the algorithm. And there Borůvka was cheapest at 1 170 units; at 60 edges it is the ' +
          'most expensive of the three. The ranking crosses with density, which is exactly why all ' +
          'three are still taught.'
      }
    ],

    'tree-path-queries': [
      {
        title: 'Four ways to answer the same question, priced on a real tree',
        goal: 'Measure preprocessing and query cost for every LCA structure on one tree, and decide.',
        setup: 'A random tree of 200 nodes and depth 13, with 200 random query pairs. Every structure ' +
          'is checked against the naive climb, which is slow, obvious and the only one that cannot be ' +
          'subtly wrong.',
        steps: [
          {
            do: 'Run the naive climb and count pointer steps.',
            why: 'It needs no preprocessing at all and is the oracle for everything else.',
            work: '1 630 steps over 200 queries — 8.15 per query, on a tree of depth 13',
            result: 'the baseline, and a surprisingly low one'
          },
          {
            do: 'Build the binary-lifting table and query it.',
            why: 'It answers k-th ancestor as well, which is why it is worth its size.',
            work: '1 800 cells across 9 levels, and 1 916 jumps over the same 200 queries — 9.58 each',
            result: 'more work than the naive climb, plus 1 800 cells'
          },
          {
            do: 'Build the Euler tour and its sparse table.',
            why: 'Range minimum over tour depths answers LCA in constant time.',
            work: 'a 399-entry tour and 3 591 cells; 200 queries cost 200 lookups — 1.00 each',
            result: 'the fastest query and the largest table'
          },
          {
            do: 'Decompose the tree into heavy chains and count segments.',
            why: 'It is the only one that answers a query *over* the path rather than about its top.',
            work: '200 cells, 770 segments over 200 queries — 3.85 each, worst case 6',
            result: 'the general structure, at a middling cost'
          },
          {
            do: 'Trace one query through the lifting table.',
            why: 'The descent stopping one step short is the part that looks like a bug and is not.',
            work: 'a jump of 2 to level the depths, then jumps of 2 and 1 while the nodes stay apart, ' +
              'then one parent step',
            result: 'four jumps, against a naive climb of up to 26 steps on this tree'
          }
        ],
        answer: 'On a 200-node tree of depth 13, the naive climb costs 8.15 steps per query with no ' +
          'preprocessing, binary lifting costs 9.58 jumps plus 1 800 cells, the sparse table costs 1.00 ' +
          'lookup plus 3 591 cells, and heavy-light costs 3.85 segments plus 200. The clever structure ' +
          'is slower and larger than the obvious one — and the reason to choose binary lifting or ' +
          'heavy-light anyway is the last column, because one answers k-th ancestor and the other ' +
          'answers any range query on the path.'
      },
      {
        title: 'The same table on a path, where every ranking flips',
        goal: 'Change nothing but the shape of the tree and watch the conclusion reverse.',
        setup: 'A path of 200 nodes — depth 199 — with the identical 200 query pairs; then the ' +
          'heavy-light decomposition measured across five shapes at n = 1 000, 400 queries each, ' +
          'with every structure cross-checked on a further 480 queries per shape.',
        steps: [
          {
            do: 'Re-run the naive climb on the path.',
            why: 'Its cost is the depth, and the depth has gone from 13 to 199.',
            work: '11 783 steps over 200 queries — 58.91 each, against 8.15 on the random tree',
            result: '7.2× worse, from the same code on the same number of queries'
          },
          {
            do: 'Re-run binary lifting.',
            why: 'Its cost is log n, which did not change at all.',
            work: '621 jumps — 3.10 per query, against 9.58 on the random tree',
            result: '19× cheaper than the naive climb, having been 18% more expensive'
          },
          {
            do: 'Re-run the sparse table.',
            why: 'It was constant-time before and it is constant-time now.',
            work: '200 lookups, 1.00 per query, and 3 591 cells — identical on both shapes',
            result: 'the only structure whose cost does not notice the shape'
          },
          {
            do: 'Decompose the path into heavy chains.',
            why: 'A path has no light edges at all, which is the decomposition\'s best case.',
            work: '1 chain, worst case 1 segment, mean 1.00 over 400 queries',
            result: 'every path query is a single contiguous range'
          },
          {
            do: 'Compare against four other shapes at n = 1 000.',
            why: 'The 2 log₂n bound is about 20 here, and bounds are not measurements.',
            work: 'star 999 chains worst 3 mean 2.99 · random 505 chains worst 9 mean 5.26 · ' +
              'caterpillar 500 chains worst 14 mean 7.77 · complete binary 512 chains worst 15 mean 8.02',
            result: 'the worst measured case is 15 against a bound of 20'
          }
        ],
        answer: 'Nothing changed except the shape of the tree, and every ranking in the first example ' +
          'inverted: the naive climb went from 8.15 steps per query to 58.91, binary lifting went from ' +
          '9.58 jumps to 3.10, and the sparse table did not move. Depth is the variable that decides, ' +
          'and it is exactly the one the complexity table hides behind "log n" — so measure the depth ' +
          'of the trees you actually have before paying n log n cells to avoid a climb of thirteen.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));

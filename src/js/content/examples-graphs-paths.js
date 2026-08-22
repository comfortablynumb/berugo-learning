/** Worked examples for connectivity and shortest paths (M13.4-M13.6). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'bridges-and-cuts': [
      {
        title: 'Pricing one redundant link',
        goal: 'Find the single points of failure in a network and measure exactly what one extra ' +
          'cable removes.',
        setup: 'A barbell of 40 nodes: two dense clusters of 20 joined by one link. Every claim is ' +
          'checked against an oracle that removes each edge in turn and recounts the components.',
        steps: [
          {
            do: 'Run the lowlink pass and read off the bridges and cut vertices.',
            why: 'One depth-first walk answers both questions.',
            work: '1 bridge — 0.3% of the 381 links — and 2 articulation points, 5.0% of the nodes',
            result: 'the whole network hangs on one cable and two routers'
          },
          {
            do: 'Confirm against the removal oracle.',
            why: 'The definition is "removing it disconnects the graph", so removing it is the check.',
            work: 'each of 381 edges removed and the components recounted; the sets agree',
            result: 'the linear algorithm matches the quadratic definition'
          },
          {
            do: 'Add one redundant link across the bridge and re-measure.',
            why: 'An edge on a cycle is not a bridge, so a second route must remove it.',
            work: 'bridges fall from 1 to 0 after a single duplicate link',
            result: 'the network now survives any one cable cut'
          },
          {
            do: 'Read the cut-vertex column in the same row.',
            why: 'Edge redundancy and vertex redundancy are different purchases.',
            work: 'articulation points stay at 2 and blocks stay at 3, at every redundancy level',
            result: 'the cable is redundant and the two routers are still single points of failure'
          },
          {
            do: 'Read the block-cut tree and check it is a forest.',
            why: 'It is what turns "this node is fragile" into "this node strands 20 machines".',
            work: '3 blocks plus 2 cut vertices = 5 nodes and 4 edges; nodes − components = edges',
            result: 'a forest, verified by counting rather than assumed'
          }
        ],
        answer: 'One duplicate cable takes the barbell from one bridge to none, and leaves both ' +
          'articulation points exactly where they were. That is the finding worth carrying into a ' +
          'design review: surviving any single *cable* failure and surviving any single *router* ' +
          'failure are different requirements with different price tags, and the block-cut tree — 3 ' +
          'blocks joined at 2 cut vertices — is what says which twenty machines each one strands.'
      },
      {
        title: 'The network where every link is a bridge, and the graph that breaks the naive test',
        goal: 'Invert the first example on a shape where redundancy barely helps, then exhibit the ' +
          'parallel-edge bug on the smallest instance that shows it.',
        setup: 'A path of 40 nodes, then a three-node multigraph with vertices 0 and 1 joined twice.',
        steps: [
          {
            do: 'Analyse the path.',
            why: 'A path is the worst possible network and the best possible fixture.',
            work: '39 bridges — 100.0% of the links — and 38 cut vertices, 95.0% of the nodes',
            result: 'every link and every internal node is a single point of failure'
          },
          {
            do: 'Add redundant links one at a time and watch the count fall linearly.',
            why: 'On the barbell one link fixed everything; here the curve is completely different.',
            work: '0 links: 39 bridges · 1: 38 · 2: 37 · 4: 35 · 8: 31',
            result: 'one bridge removed per link — 39 links needed to fix 39 bridges'
          },
          {
            do: 'Note that the cut vertices do not move at all.',
            why: 'Parallel edges cannot remove an articulation point, only a bridge.',
            work: 'cut vertices stay at 38 and blocks at 39 across every redundancy level',
            result: 'a path cannot be made vertex-redundant by duplicating its edges'
          },
          {
            do: 'Now take three nodes with 0–1 doubled, and ask the removal oracle.',
            why: 'This is the smallest graph where the two implementations differ.',
            work: 'removing either copy of 0–1 leaves the other, so only 1–2 is a bridge — 1 of 3 edges',
            result: 'the oracle answer, by definition'
          },
          {
            do: 'Run both variants of the parent check against it.',
            why: 'The difference is three lines and it is wrong on every multigraph.',
            work: 'skipping the parent edge by id reports 1–2; skipping the parent vertex reports 0–1 and 1–2',
            result: 'a bridge reported where none exists, with nothing raised'
          }
        ],
        answer: 'The barbell needed one link and the path needs 39 — same algorithm, same slider, ' +
          'opposite economics, because redundancy is only cheap where the fragility is concentrated. ' +
          'And on three nodes with one doubled link, tracking the parent *vertex* instead of the parent ' +
          '*edge* reports two bridges where there is one. Both halves of this example are the same ' +
          'lesson: the input shape decides everything, and a bridge finder tested only on random graphs ' +
          'is tested on the case where the answer is empty.'
      }
    ],

    'shortest-paths-basics': [
      {
        title: 'What one Dijkstra run actually costs',
        goal: 'Count every quantity a shortest-path run consumes, and check the answer against a ' +
          'slower reference.',
        setup: 'A 30 × 30 weighted grid — 900 vertices, steps costing 1 to 9 — with a corner-to-corner ' +
          'query, run through Dijkstra with a lazy binary heap.',
        steps: [
          {
            do: 'Run Dijkstra and read the distance.',
            why: 'This is the answer everything else is checked against.',
            work: '181',
            result: 'a number that is indistinguishable from a wrong one without a second opinion'
          },
          {
            do: 'Run Bellman-Ford and SPFA on the same instance and compare vertex by vertex.',
            why: 'Shortest-path bugs return plausible numbers rather than throwing.',
            work: 'all three return 181 with 0 disagreements across all 900 vertices',
            result: 'three derivations agreeing, which is the only evidence available'
          },
          {
            do: 'Count what each one paid for that agreement.',
            why: 'Correctness is equal here; cost is not.',
            work: 'Bellman-Ford 20 880 relaxations over 6 rounds; Dijkstra 3 480; SPFA 6 516',
            result: 'Dijkstra relaxes each directed edge once; Bellman-Ford does it six times'
          },
          {
            do: 'Open up the heap.',
            why: 'The lazy heap is a design decision and its cost should be a number.',
            work: '1 153 pushes and 1 153 pops for 900 vertices, of which 253 pops are stale — 21.9%',
            result: 'the price of not maintaining decrease-key handles'
          },
          {
            do: 'Re-walk the returned path and re-add the weights.',
            why: 'A distance that disagrees with its own path is worse than either alone.',
            work: 'the reconstructed path costs 181, matching exactly',
            result: 'the parent array is consistent with the distance array'
          },
          {
            do: 'Count how much of the grid was settled before the target popped.',
            why: 'This is the number the next two sections exist to reduce.',
            work: '900 of 900 vertices settled',
            result: 'Dijkstra grows a ball, and for this query the ball is the whole grid'
          }
        ],
        answer: '181, agreed by three algorithms with 0 disagreements, at a cost of 3 480 relaxations ' +
          'and 1 153 heap operations of which 253 did nothing. The figure to carry forward is the last ' +
          'one: all 900 vertices were settled to answer a question about one of them. Dijkstra has no ' +
          'idea where the target is, so it settles every vertex closer than the target — and that is ' +
          'precisely what a heuristic and a bidirectional search attack.'
      },
      {
        title: 'The four-vertex graph where Dijkstra is confidently wrong, and the queue that needs no heap',
        goal: 'Construct a negative-edge counter-example that actually demonstrates the failure, then ' +
          'remove the heap entirely on a graph that permits it.',
        setup: 'Four vertices: 0→1 costs 2, 0→2 costs 3, 2→1 costs −2 and 1→3 costs 1. Then the same ' +
          '900-cell grid with every weight redrawn as 0 or 1.',
        steps: [
          {
            do: 'Trace Dijkstra on the four-vertex graph.',
            why: 'The greedy invariant is only sound with non-negative weights, and this violates it.',
            work: 'vertex 1 is settled at 2 and relaxes 1→3, giving d[3] = 3',
            result: 'a vertex settled before the negative edge that would have improved it'
          },
          {
            do: 'Continue: vertex 2 pops and its −2 edge fires.',
            why: 'This is where a naive counter-example accidentally gets the right answer.',
            work: 'd[1] falls from 2 to 1 — the correct value — but 1 is already settled',
            result: 'd[1] ends CORRECT, which is why this failure survives casual testing'
          },
          {
            do: 'Read d[3], which was computed from the stale value.',
            why: 'The error has to propagate past the settled vertex to be visible.',
            work: 'd[3] = 3 where Bellman-Ford gives 2',
            result: 'a plausible wrong answer, one hop downstream, with nothing raised'
          },
          {
            do: 'Now take the 900-cell grid with weights redrawn as 0 or 1 and run a deque instead.',
            why: 'With only two weights the frontier holds two distance values and needs no ordering.',
            work: '0-1 BFS makes 0 comparisons where Dijkstra makes 1 142',
            result: 'the same 900 distances, with no heap at all'
          },
          {
            do: 'Confirm both agree.',
            why: 'A specialisation that is faster and wrong is the failure mode of every specialisation.',
            work: 'the deque and the heap return identical distances on all 900 vertices',
            result: 'linear time, no comparisons, same answer'
          }
        ],
        answer: 'This inverts the first example twice over. There the three algorithms agreed and the ' +
          'question was cost; here Dijkstra returns 3 against a true 2 and nothing in the run says so — ' +
          'and the smaller, more obvious counter-example does not work, because the vertex at the end ' +
          'of the negative edge comes out correct and only its successor is wrong. And where the first ' +
          'example measured what the heap cost, the 0-1 case deletes the heap: 0 comparisons against ' +
          '1 142, for identical distances, purely because the weights are drawn from a two-element set.'
      }
    ],

    'negative-weights': [
      {
        title: 'Finding the arbitrage loop, extracting it and pricing it',
        goal: 'Turn a rate table into a shortest-path problem, then turn the detection into a trade.',
        setup: 'A four-currency rate table (USD, EUR, GBP, JPY) with one inconsistent quote, ' +
          'transformed by −log so that a profitable loop becomes a negative cycle.',
        steps: [
          {
            do: 'Apply the transform.',
            why: 'Logarithms turn products into sums and the negation flips "above 1" into "below 0".',
            work: 'edge weight = −log(rate), over 4 currencies and 12 directed quotes',
            result: 'a profitable loop is now exactly a negative cycle'
          },
          {
            do: 'Run Bellman-Ford and watch the n-th round still improve something.',
            why: 'No simple path has n edges, so an improving n-th round proves a cycle.',
            work: 'the proof arrives after 4 rounds on 4 currencies',
            result: 'detection — a boolean the caller already suspected'
          },
          {
            do: 'Walk the parent array back n times, then close the loop.',
            why: 'The vertex that improved last may be downstream of the cycle rather than in it.',
            work: 'the extracted loop is JPY → GBP → JPY, a cycle of 2 currencies',
            result: 'the actual trades, in order'
          },
          {
            do: 'Verify the cycle edge by edge against the graph.',
            why: 'A "cycle" with a tail hanging off it is the classic extraction bug.',
            work: 'every step is a real edge and the total is −0.0070',
            result: 'checked against the graph rather than trusted'
          },
          {
            do: 'Price it back in the original units.',
            why: 'A total below zero in log space is not yet a number anybody acts on.',
            work: 'multiplying the original rates around the loop gives 1.007000',
            result: '0.70% per round trip — and had it come out at 1.0000 it would have been noise'
          }
        ],
        answer: '0.70% per round trip, on a two-currency loop, verified edge by edge. The chain from ' +
          '"an n-th round still improved something" to "sell JPY for GBP and back" is four extra lines ' +
          'over a parent array the algorithm already maintains — and the last step matters as much as ' +
          'the rest, because a multiplier of 1.0000 would have meant floating-point noise rather than ' +
          'an opportunity, and only pricing it in the original units tells you which you have.'
      },
      {
        title: 'The loop order that is silently wrong, and the reweighting that makes Dijkstra legal',
        goal: 'Show that Floyd-Warshall\'s triple loop has exactly one correct order, then beat it on a ' +
          'sparse graph.',
        setup: 'A 40-vertex directed graph with 120 edges, 7 of them negative and no negative cycle — ' +
          'built by *undoing* a reweighting, so that every cycle still totals a positive amount.',
        steps: [
          {
            do: 'Run Floyd-Warshall with k outermost and take it as the truth.',
            why: 'The recurrence is over k, so k must be the outer loop.',
            work: '64 000 relaxations filling 1 600 cells; 0 cells differ from the reference',
            result: 'the shortest-path matrix'
          },
          {
            do: 'Swap the loops so that i is outermost and run it again.',
            why: 'People reorder these loops for cache reasons and assume it is a style choice.',
            work: 'exactly 64 000 relaxations again, and it terminates normally',
            result: 'not slower, not louder, and not obviously broken'
          },
          {
            do: 'Compare the two matrices cell by cell.',
            why: 'The only thing that distinguishes them is the answer.',
            work: '554 of 1 600 cells differ — 34.6% of the matrix',
            result: 'a third of the answers wrong, with no signal of any kind'
          },
          {
            do: 'Now run Johnson: one Bellman-Ford from a super-source, then Dijkstra from each vertex.',
            why: 'On a sparse graph n² is a bad way to spend the time.',
            work: '5 124 relaxations against Floyd-Warshall\'s 64 000 and 26 520 for Bellman-Ford from every vertex',
            result: '12.5× fewer relaxations than the matrix method for the same 1 600 cells'
          },
          {
            do: 'Check the reweighted edges.',
            why: 'The whole argument is that w + h(u) − h(v) is non-negative.',
            work: 'all 7 negative edges reweight to 0 or above, and every path shifts by the same h(s) − h(t)',
            result: 'Dijkstra is legal on a graph it was not legal on before'
          }
        ],
        answer: 'Both loop orders do 64 000 relaxations and both return a full matrix; one of them is ' +
          'wrong on 554 of 1 600 cells. That inverts the first example neatly — there the algorithm ' +
          'announced the problem and the work was turning the announcement into something actionable, ' +
          'and here the algorithm announces nothing at all. Johnson then answers the same question in ' +
          '5 124 relaxations rather than 64 000, by spending one Bellman-Ford pass on a potential that ' +
          'makes every one of the 7 negative edges non-negative.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));

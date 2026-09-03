/** Concepts for maximum flow, minimum cut and push-relabel (M14.1-M14.3). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'maximum-flow': [
      {
        term: 'A flow is two constraints and nothing else',
        plain: 'No arc carries more than its capacity, and every vertex but the two terminals passes on exactly what it receives.',
        formal: '0 <= f(e) <= c(e) for every arc, and sum of inflow = sum of outflow at every vertex except s and t',
        readAs: 'Two rules make something a flow: no pipe carries more than it can hold or a negative amount, ' +
          'and everything entering a junction leaves it again. Only the source and the sink are allowed ' +
          'to create or absorb.',
        detail: [
          'Those two rules are the entire definition, and everything else in the section is a ' +
            'consequence of them.',
          'Capacity is local and easy to check. Conservation is what makes the problem global, ' +
            'because a decision on one arc constrains arcs several hops away.',
          'The two together are also the whole test suite, because a flow algorithm fails by ' +
            'returning a plausible number. You cannot tell a maximum flow from an array of integers ' +
            'that happens to look like one, so you check capacity on every arc and balance at every ' +
            'vertex.'
        ],
        example: 'On the default 18-node layered network the value is 22, and the checker reports no ' +
          'arc over capacity and no vertex out of balance.'
      },
      {
        term: 'The residual graph is the algorithm',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["an arc with capacity 10,<br/>carrying 4"] --> B["forward residual: 6 still free"]',
            '    A --> C["backward residual: 4,<br/>meaning 4 can be undone"]',
            '    C --> D["a later path may push back<br/>along that arc"]',
            '    D --> E["which is how a bad early choice<br/>gets corrected without backtracking"]'
          ].join('\n'),
          caption: 'The back edge is not bookkeeping. It is the only mechanism by which the algorithm can change its mind, and removing it makes the answer wrong rather than slow.'
        },
        plain: 'Pushing f along an arc leaves capacity − f forward and adds f backward.',
        formal: 'residual capacity c_f(u,v) = c(u,v) − f(u,v) forward, and f(u,v) backward on the reverse arc',
        readAs: 'The residual graph records what you could still do. It holds how much spare room ' +
          'each pipe has, and — crucially — how much you could undo by pushing back. That backward ' +
          'arc is what lets the algorithm correct an earlier bad choice.',
        detail: [
          'The backward arc does not exist in the input file, in the road network, or in the pipe.',
          'It exists only inside the algorithm: permission for a later augmenting path to route flow ' +
            'back out of a vertex that an earlier path filled badly.',
          'Without it, repeatedly finding paths and filling them is not a slower algorithm but a ' +
            'wrong one. It gets stuck at a local maximum with no way to undo an early bad choice. ' +
            'Every algorithm in this milestone, including push-relabel and min-cost flow, works on ' +
            'the residual graph rather than the original.'
        ],
        example: 'The default network has 39 arcs and its residual has 54, of which 28 are backward ' +
          'arcs that appear in no input anywhere.'
      },
      {
        term: 'Path filling without a back edge is wrong, not slow',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["greedily fill any path<br/>you can find"] --> B["an early path uses the<br/>middle arc the wrong way"]',
            '    B --> C["no back edge, so it cannot be undone"]',
            '    C --> D["the algorithm stops and reports success"]',
            '    D --> E["with an answer below the maximum,<br/>and no indication of it"]'
          ].join('\n'),
          caption: 'This is the failure worth internalising: it terminates, it returns a valid flow, and it is not the maximum. Only the residual back edge fixes it.'
        },
        plain: 'On four vertices with two arcs of 1 000 and one of 1, greedy stops at 1 999 and reports success.',
        formal: 'the greedy is not an approximation algorithm; its answer has no ratio bound',
        detail: [
          'This is the failure that matters, because the shortfall is one unit in two thousand and ' +
            'the run reports nothing unusual.',
          'A depth-first search takes the middle arc on its first path, which routes 1 unit through ' +
            'the crossing. The 999 units stranded on each side can never be moved, because there is ' +
            'no arc to move them along.',
          'On random layered networks the same greedy falls short on 2 of 20 instances, with a worst ' +
            'shortfall of 9.5%. It is not a contrived failure — it is the normal behaviour of the ' +
            'obvious implementation.'
        ],
        example: 'Greedy 1 999 in 3 paths against Ford-Fulkerson\'s 2 000 in 2, on the same ' +
          'four-vertex network.'
      },
      {
        term: 'The four augmenting-path algorithms differ only in which path they take',
        plain: 'Any path, the shortest path, a whole blocking flow, or only fat paths.',
        formal: 'Ford-Fulkerson O(f·E); Edmonds-Karp O(VE²); Dinic O(V²E); capacity scaling O(E² log C)',
        detail: [
          'Ford-Fulkerson takes whatever path the search finds first, so its cost depends on the arc ' +
            'order and on the numbers in the capacities. With irrational capacities it need not ' +
            'terminate at all.',
          'Edmonds-Karp always takes the shortest augmenting path, which bounds the count by the ' +
            'graph alone.',
          'Dinic builds a level graph and saturates an entire blocking flow per phase, so the phase ' +
            'count rather than the path count is what is bounded. Capacity scaling only considers ' +
            'arcs with at least delta residual, halving delta each round, so every path found ' +
            'carries a lot.'
        ],
        example: 'On the default network: Ford-Fulkerson 13 paths and 576 arc visits, Edmonds-Karp ' +
          '10 and 647, Dinic 10 paths in 1 phase and 247, scaling 8 paths and 832.'
      },
      {
        term: 'Dinic\'s phase count is bounded by the graph, not by the capacities',
        plain: 'Scaling every capacity by 64 leaves the phase count exactly where it was.',
        formal: 'each phase strictly increases the shortest augmenting path length, so there are at most V − 1 phases',
        readAs: 'Dinic works in phases, and each one leaves the shortest route from source to sink strictly ' +
          'longer than before. A path cannot exceed V−1 edges, so the phases run out.',
        detail: [
          'This is the property that separates the algorithms that care about the *numbers* from the ' +
            'algorithms that care about the *shape*.',
          'A blocking flow saturates at least one arc on every shortest path, so after a phase no ' +
            'shortest path of that length survives and the level graph deepens.',
          'On a layered network every source-to-sink path has the same length, so a single blocking ' +
            'flow saturates a cut and one phase finishes the job at any capacity at all. ' +
            'Ford-Fulkerson has no such bound, which is why its pathological example uses two huge ' +
            'capacities and one small one.'
        ],
        example: 'Capacities 1, 4, 16, 64 and 256 give Dinic 1 phase throughout while the value ' +
          'rises 4, 10, 29, 103, 403.'
      },
      {
        term: 'Integrality is why flow answers combinatorial questions',
        plain: 'With whole-number capacities, some maximum flow is whole-number too.',
        formal: 'every augmenting path pushes an integral amount, so the flow stays integral throughout',
        readAs: 'With whole-number capacities, every step moves a whole number, so the answer is a whole ' +
          'number too. That is why max-flow can decide matchings and assignments — problems where half ' +
          'an edge would be meaningless.',
        detail: [
          'This is not an implementation convenience. It is the bridge between a continuous ' +
            'optimisation problem and a discrete one.',
          'A unit-capacity flow of value k is exactly k edge-disjoint paths, so maximum flow answers ' +
            '"how many disjoint routes are there" without any rounding step.',
          'That is what makes bipartite matching, edge-disjoint path packing, project selection and ' +
            'image segmentation all reducible to flow. Each one wants a whole-number answer, and the ' +
            'flow it reduces to has one for free.'
        ],
        example: 'Bipartite matching is exactly this: a maximum flow of value 9 on a unit-capacity ' +
          'network is 9 disjoint source-to-sink paths, which is a matching of size 9.'
      },
      {
        term: 'The cut is the proof, and it is free',
        plain: 'When no augmenting path remains, what the source can still reach is one side of a minimum cut.',
        formal: 'max-flow min-cut: the maximum flow value equals the minimum cut capacity',
        detail: [
          'A flow value on its own is unverifiable. You cannot tell a maximum from a nearly maximum ' +
            'by looking.',
          'The cut is the certificate. Take everything still reachable from the source in the ' +
            'residual graph. Every original arc leaving that set must be saturated, or it would ' +
            'still be reachable, and every arc entering it must be empty.',
          'The capacity of those arcs is therefore exactly the flow, and no flow can exceed any cut. ' +
            'That is why every run here reports the cut capacity beside the value — two numbers that ' +
            'must agree, computed two different ways.'
        ],
        example: 'The default run\'s cut crosses 8 arcs with total capacity 22, which is the flow ' +
          'value exactly, and all six algorithms report the same 22.'
      },
      {
        term: 'Check the flow, not the number',
        plain: 'Six implementations agreeing on a value is weaker evidence than one implementation passing a structural check.',
        formal: 'validity = capacity respected on every arc AND conservation at every non-terminal vertex AND value = cut capacity',
        detail: [
          'Two implementations that share a mistake produce two matching wrong numbers. Flow ' +
            'implementations share mistakes constantly, because they are all built from the same ' +
            'residual idea.',
          'The three checks are independent of each other and of the algorithm. Capacity is local, ' +
            'conservation is per-vertex, and the cut equality relates the answer to a structure ' +
            'derived from it.',
          'The demo reports all three as columns rather than throwing, because a section whose point ' +
            'is "this can silently be wrong" has to be able to render the wrong answer.'
        ],
        example: 'The comparison table shows value, work, cut capacity and validity for all six ' +
          'algorithms; the agreement metric goes to NO if any column disagrees.'
      }
    ],

    'minimum-cut': [
      {
        term: 'The cut and the flow are one number seen twice',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["maximise what gets<br/>from source to sink"] --> C["the same number"]',
            '    B["minimise the capacity you must<br/>sever to disconnect them"] --> C',
            '    C --> D["so solving either one<br/>solves the other"]',
            '    D --> E["and the saturated arcs of a<br/>maximum flow are the cut"]'
          ].join('\n'),
          caption: 'Two questions that sound unrelated have the same answer, which is why a segmentation problem can be solved by a flow algorithm without ever mentioning flow.'
        },
        plain: 'Maximise what gets through, or minimise what has to be severed — the answers are equal.',
        formal: 'max over flows of |f| = min over s-t cuts of c(S, V∖S)',
        readAs: 'The largest possible flow equals the cheapest way to sever the source from the sink. Two ' +
          'completely different questions with provably the same answer, and every application in this ' +
          'section uses one to answer the other.',
        detail: 'Weak duality is obvious: every unit of flow crosses every cut, so no flow exceeds ' +
          'any cut. Strong duality — that they are exactly equal — is the theorem, and it is what ' +
          'makes the cut usable as an answer rather than merely as a bound. In practice the cut is ' +
          'almost always the thing you actually wanted: which links to cut, which pixels are ' +
          'foreground, which projects to fund. The flow is the machinery, and the cut is the ' +
          'product.',
        example: 'Across five network shapes the flow values are 23, 10, 4, 7 and 6, the cut ' +
          'capacities are identical, and 5, 5, 4, 1 and 6 arcs cross, all saturated.'
      },
      {
        term: 'Image segmentation is a cut',
        plain: 'Source arcs are how much a pixel looks like foreground, sink arcs how much like background, and neighbour arcs are how much you want them to agree.',
        formal: 'minimise sum of unary disagreement + sum over neighbours of smoothness·[label(u) != label(v)]',
        detail: 'Every pixel gets an arc from the source weighted by its foreground evidence and an ' +
          'arc to the sink weighted by its background evidence; any cut must sever exactly one of ' +
          'the two, which is what makes a cut a labelling. Then a smoothness-weighted arc between ' +
          'each neighbouring pair is severed exactly when the two pixels end up on different sides, ' +
          'so the cut capacity is the total disagreement. Minimising it is therefore minimising a ' +
          'stated objective — the model — rather than finding truth, and the difference between ' +
          'those two things is the section.',
        example: 'An 8×8 image with 20% noise at smoothness 3: cut 159, and 4 of 64 pixels ' +
          'misclassified.'
      },
      {
        term: 'The objective is a model, and improving it can look like getting worse',
        plain: 'Raising the smoothness makes the answer better and the cut capacity larger the whole way.',
        formal: 'the cut minimises the model; the misclassification count measures the truth, and they are different functions',
        detail: 'This is the single most useful thing in the section and it is invisible unless the ' +
          'generator carries a ground truth. As smoothness rises the neighbour arcs get heavier, so ' +
          'any cut costs more — the minimum cut capacity rises monotonically. Meanwhile the labelling ' +
          'gets better, because the smoothness term is exactly what suppresses the noise. Anyone ' +
          'watching only the objective would conclude the parameter was hurting. Optimisation ' +
          'literature is full of this: the number the solver reports is the number the modeller ' +
          'chose, not the number the user cares about.',
        example: 'Smoothness 0 to 12 gives cuts of 92, 123, 145, 159, 182, 210, 242 while ' +
          'misclassification falls 10, 8, 5, 4, 2, 0, 0 — from 15.6% to 0.0%.'
      },
      {
        term: 'Project selection is maximum closure',
        plain: 'Choose a set closed under prerequisites to maximise profit; the answer is the total positive profit minus a minimum cut.',
        formal: 'source arc of profit p for each profitable item, sink arc of cost |p| for each costly one, infinite-capacity arc for each prerequisite',
        detail: 'The infinite-capacity prerequisite arc is the whole trick: no finite cut can sever ' +
          'it, so any finite cut respects every prerequisite automatically, and the constraint is ' +
          'enforced by the structure rather than by a checker. Cutting a source arc means declining ' +
          'that profit; cutting a sink arc means paying that cost. The minimum cut therefore ' +
          'minimises profit-forgone plus cost-paid, and subtracting it from the total available ' +
          'profit gives the best achievable. This same construction is the standard reduction for ' +
          'a large family of "select a downward-closed set" problems.',
        example: 'Eight projects across five seeds: positive profit 43, 27, 20, 25, 31; cuts 3, 5, ' +
          '8, 7, 4; realised 40, 22, 12, 18, 27 — and brute force agrees on all five.'
      },
      {
        term: 'Koenig\'s theorem is the bipartite special case',
        plain: 'On a bipartite graph the minimum vertex cover has exactly the size of the maximum matching.',
        formal: 'in a bipartite graph, max matching = min vertex cover; in a general graph this is false and the problem is NP-hard',
        detail: 'The cut in the matching network is a vertex cover, and reading it off is the whole ' +
          'proof. That the equality fails on general graphs is the important half: minimum vertex ' +
          'cover is one of Karp\'s original NP-complete problems, and bipartiteness is exactly what ' +
          'collapses it to a flow computation. Recognising that a graph is bipartite is therefore ' +
          'not a stylistic observation, it is the difference between a polynomial answer and a ' +
          'search, and the same boundary governs colouring and independent set.',
        example: 'Four seeds at 13, 14, 14 and 15 edges: matchings of 5, 7, 6, 6 and covers of 5, ' +
          '7, 6, 6, every cover verified to cover every edge.'
      },
      {
        term: 'Every arc crossing a minimum cut is saturated',
        plain: 'If one were not, the source could still reach the far side and the cut would not be minimum.',
        formal: 'for the cut S derived from residual reachability: f(e) = c(e) for e leaving S, and f(e) = 0 for e entering S',
        readAs: 'When the algorithm stops, take everything still reachable from the source in the residual ' +
          'graph. Every pipe leaving that set is completely full and every pipe entering it is ' +
          'completely empty — which is what makes it a minimum cut.',
        detail: 'This is the structural check that makes a reported cut trustworthy, and it is ' +
          'cheap. A cut is just a set of vertices; any set of vertices has a capacity, and reporting ' +
          'the wrong set produces a number that is too large rather than an error. Verifying that ' +
          'every crossing arc is full and every returning arc is empty confirms both that the cut ' +
          'is minimum and that the flow is maximum, without recomputing either. If an arc leaving ' +
          'the source side has residual capacity, the search that built the set had a bug.',
        example: 'Across the five shapes at seed 2, all 5, 5, 4, 1 and 6 crossing arcs are ' +
          'saturated in every case.'
      },
      {
        term: 'Modelling is the hard part; the algorithm is a library call',
        plain: 'Which vertices, which capacities, which two terminals — get those wrong and no algorithm helps.',
        formal: 'the reduction is problem-specific and the solver is not',
        detail: 'Every application in this section is one page of graph construction followed by an ' +
          'identical call. The construction is where the thinking is: deciding that a pixel is a ' +
          'vertex and a neighbouring pair is an arc, that a prerequisite must be infinite rather ' +
          'than merely large, that the two terminals mean foreground and background. Almost every ' +
          'real engineering use of maximum flow looks like this, and the failure mode is a wrong ' +
          'model producing a correct answer to the wrong question — which no amount of testing the ' +
          'solver will catch.',
        example: 'Segmentation, project selection and vertex cover are three different sentences ' +
          'and the same twenty lines of solver.'
      },
      {
        term: 'A brute-force oracle is the only real check on a reduction',
        plain: 'Enumerate every closed set, or every cover, and compare.',
        formal: 'exponential, but exact, and it owes nothing to the reduction it is checking',
        detail: 'A reduction can be wrong in a way that produces valid-looking output: a cut is ' +
          'always a cut, a labelling is always a labelling. The only independent check is to solve ' +
          'the original problem directly on instances small enough to afford it, and to report the ' +
          'disagreement count as a field rather than as an exception. Small here means eight ' +
          'projects — 256 subsets — which is enough to catch a sign error, a missing infinite arc, ' +
          'or a terminal wired the wrong way round, and all three are mistakes that survive every ' +
          'test that only checks the flow.',
        example: 'The project panel brute-forces all five instances; the Koenig panel verifies every ' +
          'cover against every edge.'
      }
    ],

    'push-relabel': [
      {
        term: 'A preflow lets vertices hold excess',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["a flow: inflow equals outflow<br/>at every vertex"] --> B["true at all times,<br/>so progress is a whole path"]',
            '    C["a preflow: inflow may EXCEED outflow"] --> D["a vertex can hold a puddle<br/>of unsent flow"]',
            '    D --> E["so progress is one edge at a time"]',
            '    E --> F["and the excess is drained<br/>back out at the end"]'
          ].join('\n'),
          caption: 'Relaxing conservation is what frees the algorithm from finding whole augmenting paths, which is why push-relabel is local and parallelises where Ford-Fulkerson does not.'
        },
        plain: 'Conservation is relaxed to "inflow is at least outflow", and the excess is drained later.',
        formal: 'excess(v) = inflow − outflow >= 0 for every v other than s; a flow is a preflow with every excess zero',
        readAs: 'A preflow lets water pile up at a junction rather than balancing immediately. Push-relabel ' +
          'works with those piles and only drains them at the end, which is what frees it from having ' +
          'to find whole paths.',
        detail: 'Augmenting-path algorithms maintain a valid flow at every step and improve it. ' +
          'Push-relabel does the opposite: it floods the network immediately, violating ' +
          'conservation everywhere, and then spends its whole run repairing that violation. The ' +
          'intermediate states are not flows at all, which is why the check at the end has to ' +
          'confirm that no vertex is still active — a run that stops early returns a preflow, and a ' +
          'preflow has a value that looks entirely reasonable and is wrong.',
        example: 'The default 27-node run finishes with value 20, heights valid and nothing still ' +
          'active — three separate assertions.'
      },
      {
        term: 'The height function is a distance estimate that only rises',
        plain: 'Flow may only be pushed downhill by exactly one, and a stuck vertex is lifted.',
        formal: 'a push along (u,v) requires h(u) = h(v) + 1; h(s) = n and h(t) = 0 throughout',
        readAs: 'Water only ever flows downhill, and exactly one step at a time. The heights are a made-up ' +
          'ordering that the algorithm raises as it goes; the source starts n high and the sink at ' +
          'zero.',
        detail: 'The heights are a lower bound on the residual distance to the sink, and the ' +
          'one-step rule is what stops flow cycling between two vertices for ever. Because heights ' +
          'only ever increase and are bounded by 2n, the relabel count is bounded, and that is the ' +
          'whole termination argument. The boundary condition h(s) = n is not a constraint to be ' +
          'checked but a definition — it is what makes the source unreachable from below, so ' +
          'excess that cannot reach the sink is pushed back to the source instead of oscillating.',
        example: 'The default run does 50 relabels and 87 pushes, 39 of them saturating and 48 not.'
      },
      {
        term: 'checkHeights must skip arcs out of the source',
        plain: 'h(s) = n is a boundary condition, not something the invariant applies to.',
        formal: 'the valid-labelling condition h(u) <= h(v) + 1 is required for residual arcs (u,v) with u != s',
        detail: 'This is the kind of detail that turns a correct implementation into one that fails ' +
          'its own assertion. The source is set to height n at the start, and its outgoing arcs are ' +
          'saturated immediately, so in the residual graph the interesting arcs at the source are ' +
          'the backward ones. Applying the general condition to arcs leaving the source flags a ' +
          'violation on every run of a perfectly correct algorithm, and the natural response — ' +
          'weakening the check until it passes — removes the one assertion that would have caught a ' +
          'real bug.',
        example: 'With the exclusion, the height check passes across 20 seeds, two selection rules ' +
          'and four heuristic combinations.'
      },
      {
        term: 'The selection rule decides how much work the same algorithm does',
        plain: 'Take the next active vertex from a queue, or always the highest one.',
        formal: 'FIFO gives O(V³); highest-label gives O(V²·sqrt(E)); the flow value is identical',
        detail: 'The rule changes nothing about correctness — any order of pushes and relabels ' +
          'terminates at a maximum flow — and it changes the constant and the asymptotics ' +
          'substantially. Highest-label works on the vertex furthest from the sink first, which ' +
          'tends to move excess in long coherent runs instead of shuffling it locally, so fewer ' +
          'relabels are needed overall. This is the same pattern as the ordering in greedy ' +
          'colouring: the algorithm is a family indexed by a choice, and the choice is where the ' +
          'performance lives.',
        example: 'FIFO 41 relabels and 79 pushes against highest-label\'s 35 and 70 on the ' +
          '14.1 network, at 760 and 627 arc visits.'
      },
      {
        term: 'The gap heuristic lifts a whole stranded layer at once',
        plain: 'If no vertex has height h, nothing below h can reach the sink, so lift them all past n.',
        formal: 'if the height histogram has an empty bucket at h, every vertex with height in (h, n) is raised to n + 1',
        readAs: 'If no vertex sits at some height, nothing above that height can ever reach the sink — the ' +
          'downhill chain is broken. Lifting them all out at once is the gap heuristic, and it is worth ' +
          'several times the running time.',
        detail: 'Without it, each of those vertices discovers independently, one relabel at a time, ' +
          'that it is cut off from the sink, and the cost of that discovery is quadratic in the ' +
          'layer size. The gap test is a histogram lookup — genuinely one array of counts — and it ' +
          'converts that whole rediscovery into a single sweep. It is the clearest example in the ' +
          'milestone of a heuristic that is not an optimisation but a structural insight: the empty ' +
          'bucket *proves* the vertices below it are stranded.',
        example: 'The default run does 23 gap lifts out of 50 relabels.'
      },
      {
        term: 'Global relabelling recomputes the heights exactly, backwards from the sink',
        plain: 'A breadth-first search in the reverse residual graph replaces every estimate with the truth.',
        formal: 'h(v) = residual distance to t, or n + residual distance to s for vertices that cannot reach t, and a common height for neither',
        detail: 'The three-way split is the part that is easy to get wrong and catastrophic to get ' +
          'wrong. Setting every vertex that cannot reach the sink to 2n looks reasonable and ' +
          'abandons any excess that has to drain back to the source: the run finishes with vertices ' +
          'still holding excess, the height invariant violated, and — the dangerous part — the ' +
          'reported value correct anyway on most instances. The correct version relabels in three ' +
          'groups, and the fix was found by an assertion rather than by a wrong answer.',
        example: 'Two global passes in the default run; across 20 seeds, two rules and four ' +
          'heuristic settings, no vertex is left active and no height invalid.'
      },
      {
        term: 'The heuristics are not additive, and the section says so',
        plain: 'Global relabelling alone beats gap and global together on this network.',
        formal: 'gap + global 50 relabels; gap only 83; global only 44; neither 369',
        detail: 'It is tempting to report the combined speed-up and stop. The honest table shows ' +
          'that global relabelling alone does fewer relabels than the pair, because a gap lift ' +
          'raises vertices to heights that the next global pass then has to correct. Both are still ' +
          'enormous wins over neither — 7.4×, 4.5× and 8.4× fewer relabels respectively — and the ' +
          'ranking between them is instance-dependent. A benchmark that reported only the best ' +
          'combination would hide the fact that one of its two components was doing negative work.',
        example: '1 030, 989, 1 011 and 4 433 arc visits for gap+global, gap only, global only ' +
          'and neither.'
      },
      {
        term: 'Without its heuristics the textbook algorithm disappoints on purpose',
        plain: 'Plain push-relabel does 369 relabels where the tuned version does 50.',
        formal: 'the O(V³) bound is met either way; the constant is 7× and it is the constant that decides',
        detail: 'Push-relabel is presented as the fast modern alternative to augmenting paths, and ' +
          'the version in the textbook is not. That is not a criticism of the textbook — the ' +
          'presentation is about the *bound*, and the bound is unchanged — but it does mean the ' +
          'implementation you write from the pseudocode will be slower than Dinic on most inputs, ' +
          'and you will conclude the algorithm was overhyped. It was not; you left out the two ' +
          'paragraphs after the pseudocode.',
        example: 'On the same network: Ford-Fulkerson 607 arc visits, Edmonds-Karp 1 116, Dinic ' +
          '409, capacity scaling 1 164, push-relabel 1 030 tuned and 4 433 untuned.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));

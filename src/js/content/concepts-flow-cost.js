/** Concepts for minimum-cost flow and bipartite matching (M14.4-M14.5). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'min-cost-flow': [
      {
        term: 'Two objectives, and the second one only matters once the first is fixed',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["first: maximise the flow value"] --> B["that fixes how much gets through"]',
            '    B --> C["second: among all flows of<br/>that value, find the cheapest"]',
            '    C --> D["the objectives are ordered,<br/>not combined"]',
            '    D --> E["which is why the algorithm sends<br/>units one at a time, cheapest first"]'
          ].join('\n'),
          caption: 'Trying to optimise both at once gives a different, harder problem. The ordering is what lets successive shortest paths work at all.'
        },
        plain: 'Among all flows of a given value, find the cheapest.',
        formal: 'minimise sum over arcs of cost(e)·f(e) subject to capacity, conservation and |f| = k',
        readAs: 'Send exactly k units from source to sink as cheaply as possible: total cost is each arc\'s ' +
          'price times how much it carries, and the flow rules still apply.',
        detail: 'Maximum flow has one objective and min-cost flow has two, ordered: the value is a ' +
          'constraint and the cost is what gets minimised. That ordering is why "the min-cost ' +
          'maximum flow" and "the minimum-cost flow of value 3" are different problems with ' +
          'different answers, and why an implementation must be told which one it is solving. It ' +
          'also means the answer is a *curve* — cost as a function of value — and reporting a single ' +
          'number without saying which value it belongs to is ambiguous.',
        example: 'On the six-worker assignment the cost against flow 1 to 6 is 1, 2, 4, 9, 18, 28.'
      },
      {
        term: 'Send one unit at a time along the cheapest path',
        plain: 'Successive shortest paths: repeatedly find the cheapest residual route and saturate it.',
        formal: 'if f is a minimum-cost flow of value k, augmenting along a shortest residual path gives a minimum-cost flow of value k + 1',
        readAs: 'Cheapest-path augmentation is safe at every step: get the cheapest flow of size k, push one ' +
          'more unit along the cheapest remaining route, and you have the cheapest flow of size k+1. No ' +
          'backtracking is ever needed.',
        detail: 'The correctness argument is the useful part. If the current flow is optimal for its ' +
          'value, then its residual graph has no negative-cost cycle; augmenting along a *shortest* ' +
          'path cannot create one, so the next flow is optimal for the next value. That inductive ' +
          'step is what makes a greedy sequence of shortest paths reach the global optimum, and it ' +
          'is also why the marginal cost never falls — which is the convexity you can see in the ' +
          'cost-against-value table.',
        example: 'Seven Dijkstra runs and 582 relaxations produce the optimal assignment of cost 28.'
      },
      {
        term: 'The marginal cost never falls, and that is why one-at-a-time works',
        plain: 'Each extra unit costs at least as much as the one before it.',
        formal: 'the min-cost function is convex in the flow value',
        detail: 'Convexity is what licenses the greedy. If a later unit could be cheaper than an ' +
          'earlier one, then routing them in the other order would have been better and the ' +
          'sequence of shortest paths would be leaving money on the table. Because the cost function ' +
          'is convex, the cheapest way to send k units is always the cheapest way to send k − 1 ' +
          'units plus the cheapest remaining path — and the marginal column is the demonstration ' +
          'rather than the assertion.',
        example: 'Marginal costs of 1, 1, 2, 5, 9, 10 for the six units — never falling.'
      },
      {
        term: 'Potentials are Johnson\'s reweighting, and Dijkstra needs them',
        plain: 'Residual backward arcs have negative cost, so shift every cost by a potential difference.',
        formal: 'reduced cost c′(u,v) = c(u,v) + p(u) − p(v) >= 0, and a shortest path under c′ is a shortest path under c',
        readAs: 'Adding a potential to each vertex shifts every arc\'s price so none is negative — c′ is read ' +
          '"c prime". Every route between the same two ends shifts by the same total, so which route is ' +
          'cheapest does not change, and Dijkstra becomes usable.',
        detail: 'The first shortest-path computation may need Bellman-Ford, because the input can ' +
          'have negative costs. After that, the distances themselves become the potentials, every ' +
          'reduced cost is non-negative, and Dijkstra takes over — which is the whole reason the ' +
          'algorithm is practical. This is exactly the transform M13 introduced for all-pairs ' +
          'shortest paths, and recognising it is what turns min-cost flow from a new algorithm into ' +
          'Dijkstra in a loop.',
        example: 'On non-negative costs no potential is needed at all: 7 Dijkstra runs and 0 ' +
          'Bellman-Ford passes.'
      },
      {
        term: 'Cycle cancelling is the other direction and the other cost profile',
        plain: 'Start from any maximum flow and repeatedly cancel a negative-cost residual cycle.',
        formal: 'a flow is minimum-cost for its value exactly when its residual graph has no negative-cost cycle',
        readAs: 'A complete test for optimality that does not need the algorithm that produced the answer: if ' +
          'you could go round a loop and come out cheaper, you are not optimal. If you cannot, you are.',
        detail: 'That equivalence is the actual optimality theorem, and it is more useful than the ' +
          'algorithm: it gives a check that owes nothing to how the flow was produced. Cycle ' +
          'cancelling reaches the optimum from above rather than from below, which means it always ' +
          'holds a feasible flow of the right value — attractive if you have one already and want to ' +
          'improve it — at the price of a Bellman-Ford pass per cycle.',
        example: 'Four cycles and 5 Bellman-Ford passes reach the same cost of 28 that successive ' +
          'shortest paths reached in 7 Dijkstra runs.'
      },
      {
        term: 'A negative-cost cycle with spare capacity means there is no minimum',
        plain: 'Go round it for ever and the cost falls without bound.',
        formal: 'the problem is unbounded; the correct answer is a refusal, not a number',
        detail: 'This is the case an implementation loops on for ever if nobody thought about it. ' +
          'The instance is not merely hard, it has no optimum: each trip around the cycle reduces ' +
          'the cost by a fixed amount and the capacity allows infinitely many trips. The right ' +
          'behaviour is to detect it — one Bellman-Ford pass already runs, so the detection is free ' +
          '— and return a refusal with the cycle attached, because a caller who built such a network ' +
          'has a modelling bug and needs to see it.',
        example: 'The general-network panel builds negative costs deliberately: 5 negative arcs, and ' +
          'both methods still return 3 units at cost 81 because no negative cycle exists.'
      },
      {
        term: 'The assignment problem is min-cost flow with every capacity 1',
        plain: 'n workers, n tasks, a cost matrix, and one perfect pairing to be chosen.',
        formal: 'minimise sum of c(i, sigma(i)) over permutations sigma; equivalently a min-cost flow of value n on a unit-capacity bipartite network',
        detail: 'Seeing it as flow is what makes it obviously polynomial: there are n! permutations ' +
          'and integrality means the flow optimum is one of them. The Hungarian algorithm is the ' +
          'specialised O(n³) version — it is successive shortest paths with the potentials written ' +
          'down explicitly as row and column duals — and it is worth knowing both framings, because ' +
          'the flow one generalises (unequal counts, capacities above one, side constraints) and the ' +
          'Hungarian one is faster on the square case.',
        example: 'Six workers: the Hungarian algorithm reaches 28 in 6 phases and 45 comparisons, ' +
          'against 720 permutations for brute force.'
      },
      {
        term: 'Check the theorem, not the potential',
        plain: 'Verify that the residual has no negative cycle rather than that the duals look right.',
        formal: 'checkOptimal tests the characterisation directly; a potential is only maintained where the algorithm reached',
        detail: 'A natural check is to scan every reduced cost and assert it is non-negative — and ' +
          'it fails on provably optimal flows, because the algorithm only maintains potentials on ' +
          'the vertices its searches reached. Vertices it never had to visit carry stale values and ' +
          'produce phantom violations. Testing the theorem instead is both correct and stronger: it ' +
          'is a property of the flow alone, so it validates a flow that arrived from anywhere, ' +
          'including from a completely different algorithm.',
        example: 'The Hungarian dual certificate is checked separately: zero slack on every chosen ' +
          'cell and no negative reduced cost anywhere.'
      }
    ],

    'bipartite-matching': [
      {
        term: 'An augmenting path alternates, and flipping it gains exactly one',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["free — matched — free — matched — free"] --> B["it starts and ends unmatched"]',
            '    B --> C["so it has one more free edge<br/>than matched ones"]',
            '    C --> D["flip every edge along it"]',
            '    D --> E["still a valid matching,<br/>and exactly one larger"]'
          ].join('\n'),
          caption: 'The whole of matching theory rests on this: a matching is maximum exactly when no such path exists, so the algorithm is just a search for one.'
        },
        plain: 'Free, matched, free, matched, free — one more free edge than matched ones.',
        formal: 'Berge: a matching is maximum exactly when no augmenting path exists',
        detail: 'Everything in this section is that one idea. The path starts and ends at unmatched ' +
          'vertices, so it has odd length and therefore one more unmatched edge than matched ones; ' +
          'flipping every edge on it keeps the result a matching, because each internal vertex ' +
          'trades one partner for another, and the size rises by one. Berge\'s theorem supplies the ' +
          'stopping rule: no augmenting path means maximum, so the algorithm needs no bound on how ' +
          'good the answer should be.',
        example: 'The default 9-by-9 graph reaches a perfect matching of 9 in 9 augmenting paths.'
      },
      {
        term: 'Kuhn finds one path at a time and resets its visited set per vertex',
        plain: 'A depth-first search per unmatched left vertex, marking right vertices once each.',
        formal: 'O(VE): V searches, each linear in the edges',
        detail: 'The per-vertex reset is what makes each individual search linear rather than ' +
          'quadratic: within one search a right vertex is examined at most once, and across ' +
          'searches the marks start clean. The bipartite structure is doing the work — a right ' +
          'vertex reached once cannot usefully be reached again in the same search, because any ' +
          'alternating continuation from it is the same continuation. That argument is exactly what ' +
          'fails on a general graph with an odd cycle, which is the next section.',
        example: 'On the default graph Kuhn examines 45 edges to find 9 augmenting paths.'
      },
      {
        term: 'Hopcroft-Karp finds a whole layer of disjoint paths per phase',
        plain: 'A breadth-first search finds the shortest augmenting length, then a depth-first pass takes as many disjoint paths of that length as exist.',
        formal: 'O(E·sqrt(V)): the shortest augmenting path strictly lengthens each phase, so there are O(sqrt(V)) phases',
        readAs: 'Hopcroft-Karp augments along many disjoint shortest paths at once. After about the square ' +
          'root of V phases, the paths are long enough that few can remain — which is where the square ' +
          'root comes from.',
        detail: 'The bound comes from a counting argument rather than from the search: after ' +
          'sqrt(V) phases the shortest augmenting path is longer than sqrt(V), and vertex-disjoint ' +
          'paths of that length cannot number more than sqrt(V), so at most sqrt(V) augmentations ' +
          'remain. The phase count is therefore the whole difference from Kuhn, and on a small graph ' +
          'it is often no difference at all — which is why the demonstration sweeps the size instead ' +
          'of quoting the complexity.',
        example: 'From 8 to 256 vertices a side the phase count moves 2, 2, 2, 3, 4, 4 while √V ' +
          'moves 2.83 to 16.'
      },
      {
        term: 'The asymptotically better algorithm loses on small inputs, measurably',
        plain: 'Hopcroft-Karp examines 58 edges where Kuhn examines 20, and 4 530 where Kuhn examines 12 426.',
        formal: 'the crossover is a property of the instance size, not of the complexity classes',
        detail: 'Every phase of Hopcroft-Karp pays for a breadth-first layering pass whether or not ' +
          'that pass finds several paths, and on a small graph almost every phase finds one. The ' +
          'layering is then pure overhead. Reporting the crossover rather than the asymptotics is ' +
          'the honest way to present this: "O(E√V) beats O(VE)" is true and does not tell you which ' +
          'to use for a graph of 30 vertices, which is the size most people actually have.',
        example: 'At 8 vertices a side Kuhn examines 20 edges and Hopcroft-Karp 58; at 256 the ' +
          'numbers are 12 426 and 4 530, a 2.74× saving.'
      },
      {
        term: 'A unit-capacity maximum flow is a matching',
        plain: 'Source to every left vertex, every edge, every right vertex to the sink, all at capacity one.',
        formal: 'integrality: a maximum flow of value k on a unit-capacity network is k edge-disjoint paths',
        detail: 'The reduction is worth internalising because it goes both ways. Any matching ' +
          'problem you can phrase as a bipartite graph can be solved with a flow library, and — more ' +
          'usefully — any variation the matching library does not support can often be expressed by ' +
          'changing a capacity. Allowing a worker to take three tasks is a capacity of three on one ' +
          'arc. Requiring at least one task is a lower bound, which flow also handles. The matching ' +
          'algorithms are faster and the flow framing is what generalises.',
        example: 'The flow route gets the same 9 as Kuhn and Hopcroft-Karp, at 280 arc visits ' +
          'against 45 and 57 edge examinations.'
      },
      {
        term: 'Koenig: maximum matching equals minimum vertex cover, and the cover is constructible',
        plain: 'Start from the unmatched left vertices, alternate, then take the left vertices not reached plus the right vertices that were.',
        formal: 'on a bipartite graph max matching = min vertex cover; the complement of the cover is a maximum independent set',
        readAs: 'König\'s theorem: on a bipartite graph the largest matching and the smallest set of vertices ' +
          'touching every edge are the same number. Everything outside that cover is then the largest ' +
          'set of mutually unconnected vertices.',
        detail: 'The construction is what makes the theorem usable rather than decorative: it hands ' +
          'you the cover, not merely its size, from a search you already ran. And the restriction to ' +
          'bipartite graphs is the important part — minimum vertex cover is NP-hard in general, so ' +
          'the theorem is not a fact about covers but a fact about bipartiteness. The same boundary ' +
          'reappears in colouring and independent set, and noticing that a graph is bipartite is ' +
          'therefore worth real money.',
        example: 'A matching of 9 and a cover of 9 on the default graph, verified to touch every one ' +
          'of the 25 edges.'
      },
      {
        term: 'Hall\'s condition hands back a witness rather than a boolean',
        plain: 'If some set of left vertices has fewer neighbours than members, no perfect matching exists — and that set is the proof.',
        formal: 'a perfect matching exists iff |N(S)| >= |S| for every subset S of the left side',
        readAs: 'Hall\'s theorem: everyone on the left can be matched exactly when no group of them is ' +
          'collectively short of options. N(S) is everything that group is connected to, and the bars ' +
          'are "how many".',
        detail: 'A search that fails tells an operator nothing; a witness tells them exactly which ' +
          'demand to relax. The alternating search from an unmatched left vertex produces one for ' +
          'free: every right vertex it reaches is already matched back into the set it reached it ' +
          'from, so the reachable left set has a neighbourhood one short. There are exponentially ' +
          'many subsets and the condition never has to be tested over all of them, because the ' +
          'search finds a violating one directly whenever one exists.',
        example: 'On the deficiency shape, 3 left vertices share 2 neighbours, so at least 1 must go ' +
          'unmatched — a proof rather than a failed search.'
      },
      {
        term: 'Stable is not maximum, and the proposing side wins',
        plain: 'Gale-Shapley optimises "no pair would both rather defect", and it does so in the proposers\' favour.',
        formal: 'the proposer-optimal stable matching gives every proposer the best partner they have in ANY stable matching, and every receiver the worst',
        readAs: 'Which side proposes is not a detail. Gale-Shapley gives the proposing side simultaneously ' +
          'their best possible stable outcome and the other side their worst — so choosing who proposes ' +
          'is a policy decision.',
        detail: 'Three properties are constantly conflated: perfect (everyone is matched), maximum ' +
          '(no larger matching exists) and stable (no blocking pair). Gale-Shapley guarantees the ' +
          'first and third on complete preferences and says nothing about total satisfaction, so a ' +
          'weighted algorithm will beat it on that measure whenever the measure exists. The ' +
          'proposer-optimality result is not a tendency but a theorem, and running the algorithm ' +
          'from both sides makes it a table: no proposer is ever worse off, and no receiver is ever ' +
          'better.',
        example: 'Eight people a side: left-proposing gives the left side a total rank of 10 and ' +
          'right-proposing gives it 20, with 5 people strictly better off and 0 worse.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));

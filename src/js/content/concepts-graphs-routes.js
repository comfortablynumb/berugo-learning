/** Concepts for heuristic search and route planning (M13.7-M13.8). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'heuristic-search': [
      {
        term: 'A* is Dijkstra with a different queue key',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["Dijkstra orders by:<br/>cost so far"] --> C["the same algorithm otherwise"]',
            '    B["A* orders by:<br/>cost so far + estimate of the rest"] --> C',
            '    C --> D["the estimate steers the search<br/>toward the goal"]',
            '    D --> E["a zero estimate makes A*<br/>exactly Dijkstra again"]'
          ].join('\n'),
          caption: 'One line changes. Everything A* is good at, and every way it goes wrong, comes from what that estimate does and whether it ever overestimates.'
        },
        plain: 'Order by cost so far plus an estimate of what remains, instead of cost so far alone.',
        formal: 'f(v) = g(v) + h(v); Dijkstra is the special case h ≡ 0',
        readAs: 'A* orders its queue by the cost already spent plus an estimate of the cost remaining. Set ' +
          'the estimate to zero everywhere — the ≡ means "is identically" — and you have Dijkstra back.',
        detail: [
          'Nothing else changes. The relaxation, the settled set, the parent pointers and the ' +
            'termination test are identical.',
          'That is worth internalising, because it means A* inherits Dijkstra\'s correctness ' +
            'argument wholesale and only has to defend the new term. It also means any Dijkstra ' +
            'implementation can become A* by changing one expression.',
          'It also means A* cannot be *faster* in any sense other than expanding fewer nodes. If h ' +
            'contributes nothing, the two searches are the same search with extra arithmetic.'
        ],
        example: 'On a weighted 40×40 grid Dijkstra settles 1 600 cells and A* with a unit-step ' +
          'Manhattan estimate expands exactly the same 1 600.'
      },
      {
        term: 'Admissible buys optimality',
        plain: 'If the estimate never overestimates, the path returned is the shortest one.',
        formal: 'h(v) <= true cost from v to the goal, for every v',
        readAs: 'The estimate must never overstate what is left. Admissible means optimistic: an estimate ' +
          'that guesses too high makes A* fast and wrong.',
        detail: [
          'The argument is short. When the goal is popped, its key is its true cost, because ' +
            'h(goal) = 0.',
          'Any cheaper route would have to sit in the queue under a key at or below that true cost, ' +
            'so it would have been popped first.',
          'Admissibility is therefore the property that decides *correctness*, and it is checkable ' +
            'at small sizes against exact distances. That is what this page does rather than ' +
            'asserting it: every heuristic here is verified against a full Dijkstra from the goal.'
        ],
        example: 'Manhattan ×1, Euclidean and ALT all return the optimal 249; Manhattan ×5 returns 295 ' +
          'and reports itself inadmissible.'
      },
      {
        term: 'Consistent buys the right to close a node forever',
        plain: 'If the estimate falls by at most the edge weight along every edge, nothing is ever reopened.',
        formal: 'h(u) <= w(u, v) + h(v) for every edge; implies f is non-decreasing along any path',
        readAs: 'Consistency is the triangle inequality for the estimate: crossing one edge can never improve ' +
          'the estimate by more than the edge costs. It guarantees f never falls along a path, which is ' +
          'what lets a settled node stay settled.',
        detail: [
          'Consistency is strictly stronger than admissibility, and it is a statement about *edges* ' +
            'rather than about vertices. That is why the two are so easy to conflate.',
          'Its consequence is that f never decreases along a path. So when a node is popped its g is ' +
            'already final, and it never needs revisiting.',
          'Almost every heuristic derived from a metric is consistent automatically — Manhattan on a ' +
            'grid, straight-line distance, an ALT bound from real distances. That is why the ' +
            'distinction so rarely bites, and hurts so much when it does.'
        ],
        example: 'With a consistent heuristic the 20×20 demo expands 400 nodes and reopens 0, whether ' +
          'or not reopening is enabled.'
      },
      {
        term: 'Admissible but inconsistent, with the reopen check off, is silently wrong',
        plain: 'Drop reopening for speed and you need consistency, not merely admissibility.',
        formal: 'an inconsistent h can settle v at a g above its true distance; without reopening that value is final',
        detail: [
          'This is the trap the section is built around, because the failure produces no error and a ' +
            'plausible answer.',
          'An inconsistent estimate can make a node look good early, close it at a distance that is ' +
            'too large, and only later reveal a cheaper route to it. By then a search that never ' +
            'reopens has already propagated the wrong value onwards.',
          'The cost is not a rounding error. The same search returns 128 with reopening on and 155 ' +
            'with it off, and nothing in the run distinguishes the two.'
        ],
        example: 'On the 20×20 demo, reopening on gives 128 from 840 expansions with 508 reopenings; ' +
          'reopening off gives 155 — a 21.09% gap — from 365.'
      },
      {
        term: 'A stale heap entry is not a reopening, and counting it as one hides the real number',
        plain: 'A lazy heap leaves duplicates behind; discarding them is bookkeeping, not revisiting.',
        formal: 'stale iff the popped key exceeds the node’s current f; a genuine reopen has a key equal to it',
        detail: [
          'Any A* built on a lazy heap pushes a fresh entry per improvement and meets the old ones ' +
            'later.',
          'If every pop of a closed node is counted as a reopening, a perfectly consistent heuristic ' +
            'appears to reopen hundreds of nodes, and the consistency claim becomes unfalsifiable.',
          'Separating the two is what turns "consistent heuristics never reopen" from a slogan into ' +
            'a counter that reads zero. A key above the current f means stale; a key equal to it ' +
            'means g genuinely fell.'
        ],
        example: 'The consistent Manhattan run reports 0 reopenings and 495 stale pops skipped; the ' +
          'inconsistent one reports 508 genuine reopenings.'
      },
      {
        term: 'A heuristic in the wrong units is admissible and worthless',
        plain: 'Counting grid steps is a true lower bound on a graph whose steps cost up to nine — and a useless one.',
        formal: 'the pruning power of h is how close it is to the true remaining cost, not whether it is a bound',
        detail: [
          'A zero heuristic is admissible and consistent and prunes nothing, and a weak heuristic is ' +
            'closer to that end of the scale than to a good one.',
          'This is the question grid tutorials never ask, because on a unit-cost grid the geometry ' +
            'happens to be exactly the cost.',
          'As soon as edges carry durations, tolls, turn penalties or transfer times, a ' +
            'distance-shaped heuristic becomes a bound so loose that A* degenerates into Dijkstra ' +
            'with extra arithmetic. Measure the expansion count; do not assume the estimate helps.'
        ],
        example: 'Manhattan and Euclidean both expand all 1 600 cells of the weighted grid — the same ' +
          'as Dijkstra — while ALT expands 98.'
      },
      {
        term: 'ALT: the triangle inequality gives a heuristic with no geometry at all',
        plain: 'Precompute exact distances to a few landmarks; |d(L,t) − d(L,v)| is a valid lower bound.',
        formal: 'for any landmark L: |d(L, t) − d(L, v)| <= d(v, t); take the maximum over landmarks',
        readAs: 'Precompute distances to a few fixed landmarks. The difference between two of those ' +
          'distances is a lower bound on the distance between the vertices, and the bars mean ' +
          'absolute value. The best landmark gives the tightest bound.',
        detail: [
          'ALT is the technique to reach for whenever the graph has no coordinates, or its costs are ' +
            'not distances. Think of a road network with turn penalties, a transit network with ' +
            'transfer times, or a state space with no geometry whatsoever.',
          'Each landmark costs one full single-source search to precompute and n stored distances. ' +
            'The bound is the maximum over landmarks, so it is only as good as the best-placed one ' +
            'for the query at hand.',
          'That is also why adding landmarks stops helping. A landmark that is never the maximum ' +
            'contributes memory and nothing else.'
        ],
        example: 'One landmark expands 1 256 cells, a saving of only 1.27×, while two expand 98. ' +
          'Four and eight also expand 98, so the third and later landmarks buy nothing on this query.'
      },
      {
        term: 'Weighted A*: give up optimality by a factor you choose',
        plain: 'Multiply h by w > 1 and the returned path is at most w times optimal.',
        formal: 'f = g + w·h with w > 1; the result is w-admissible, and the gap is measured rather than assumed',
        readAs: 'Multiply the estimate by more than one and A* finds an answer faster, at the cost of it ' +
          'possibly being up to w times too long. The point is that the bound is known, and the actual ' +
          'gap is measured.',
        detail: [
          'Inflating the heuristic makes the search greedier and the guarantee weaker, in a way that ' +
            'is bounded and controllable. That is the honest version of "good enough is fine".',
          'The trap is testing it on the wrong instance. On a uniform grid every monotone route to ' +
            'the goal costs the same, so no amount of inflation can return a worse path.',
          'The experiment then reports that inadmissibility is free. Vary the edge costs and the ' +
            'real trade appears immediately.'
        ],
        example: '×5 costs 18.47% more for 11× fewer expansions and ×9 costs 44.98% more for 19× fewer ' +
          '— and on a uniform grid the same ×5 still returns the optimum.'
      },
      {
        term: 'Bidirectional search is a constant factor that depends on the query',
        plain: 'Two balls of radius d/2 are smaller than one ball of radius d — sometimes much smaller.',
        formal: 'stop when the two frontier keys sum to at least the best meeting cost, not at first contact',
        readAs: 'The two searches meeting does not mean the best route has been found — a cheaper one may ' +
          'still be forming. The correct stopping rule compares the two frontier keys against the best ' +
          'meeting found so far.',
        detail: [
          'The saving is geometric, and therefore entirely dependent on the shape of the search ' +
            'space. In an open region two half-radius balls cover a fraction of one full ball; ' +
            'against a boundary they cover nearly all of it.',
          'The subtle part is the stopping condition. The first vertex settled by both searches need ' +
            'not lie on a shortest path.',
          'So the best meeting cost has to be tracked separately, and the loop continues until the ' +
            'two frontier keys sum to at least that cost.'
        ],
        example: 'On an 80×80 grid, centre to a nearby cell saves 2.48×, centre to the far corner ' +
          '2.32×, and corner to corner just 1.01×. That last is the worst case, because both balls ' +
          'hit the walls.'
      },
      {
        term: 'IDA* trades the frontier for repeated work, and the trade is often terrible',
        plain: 'Keep only the current path; re-expand everything shallow on every threshold round.',
        formal: 'memory is Θ(depth); work is the sum over rounds, and the round count grows with the cost range',
        readAs: 'IDA* keeps only the current path, so memory is tiny. The price is redoing every earlier ' +
          'round, and with real-valued costs the threshold barely moves each time — so the rounds ' +
          'multiply.',
        detail: [
          'Iterative deepening on f is the right answer when the frontier genuinely cannot be ' +
            'stored. Think of puzzle state spaces with billions of positions and no room for a ' +
            'closed set.',
          'On a graph that fits in memory it is a bad deal, and the reason is the threshold ' +
            'schedule. With integer weights the bound creeps up by ones, so the number of rounds ' +
            'grows with the path cost. Each round redoes all the work of the previous ones.',
          'Knowing which situation you are in is the entire decision.'
        ],
        example: 'On a 6×6 weighted grid IDA* costs 1 068 expansions against A*\'s 34, and on an ' +
          '8×8 it costs 34 164 against 64. At 10×10 it exhausts a 120 000-expansion budget on a ' +
          'graph A* finishes in 100.'
      }
    ],

    'route-planning': [
      {
        term: 'Plain Dijkstra settles a ball, and a continent is a big ball',
        plain: 'Every node closer than the destination is settled before the destination pops.',
        formal: 'settled set = { v : d(s, v) <= d(s, t) }, which for a cross-country query is most of the network',
        readAs: 'The set of vertices Dijkstra settles is everything nearer to the start than the target is. ' +
          'For a long journey that is nearly the whole map, which is why route planners preprocess.',
        detail: [
          'This is why route planning is a separate subject rather than a call to a shortest-path ' +
            'routine.',
          'The work is not proportional to the length of the answer. It is proportional to the area ' +
            'the answer spans.',
          'A twenty-million-node continental network answers a local query in microseconds, and a ' +
            'Lisbon-to-Helsinki query by settling nearly the whole graph. No amount of ' +
            'micro-optimisation changes the shape of that curve, so every technique in this section ' +
            'attacks the ball rather than the constant factor.'
        ],
        example: 'On a road-like 12×12 network Dijkstra settles all 144 nodes for a corner-to-corner ' +
          'query, while the hierarchy settles 87.'
      },
      {
        term: 'Contraction: remove a node and preserve every distance through it',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["pick a node to remove"] --> B["for each pair of neighbours whose<br/>shortest path went through it"]',
            '    B --> C["add a shortcut edge<br/>with the combined weight"]',
            '    C --> D["delete the node"]',
            '    D --> E["every distance in the graph<br/>is unchanged"]',
            '    E --> A'
          ].join('\n'),
          caption: 'Repeat over the whole graph and a continental road network becomes a small overlay that answers queries in milliseconds — with exact distances, not estimates.'
        },
        plain: 'Delete the node; wherever a shortest path went through it, add an edge that replaces it.',
        formal: 'for each surviving pair (u, w): if the only u→w route within cost(u→v→w) went through v, add that shortcut',
        detail: [
          'Contraction is a preprocessing step, not a query-time one. Nodes are removed one at a ' +
            'time in a chosen order, and each removal patches the graph so that the distances among ' +
            'the remaining nodes are unchanged.',
          'The output is the original graph plus a set of shortcut edges and a rank per node.',
          'Everything about the technique\'s speed follows from the order, and everything about its ' +
            'correctness follows from the patching step.'
        ],
        example: 'A road-like 6×6 network needs 18 shortcuts, taking 62 edges to 80 — a growth of 1.29×.'
      },
      {
        term: 'The witness search is where correctness lives',
        plain: 'Before adding a shortcut, ask whether another route already covers it.',
        formal: 'a bounded Dijkstra from u to w avoiding v, limited by cost(u→v→w) and by a hop count',
        detail: [
          'If a route from u to w that avoids v is no more expensive than going through v, then ' +
            'removing v loses nothing and no shortcut is needed. That route is the witness.',
          'The search for it is bounded in both distance and hops for speed. It is also the single ' +
            'subroutine on which the entire hierarchy\'s correctness rests.',
          'A hierarchy with a subtly wrong witness search builds to the expected size in the ' +
            'expected time, and answers a small fraction of queries incorrectly forever after.'
        ],
        example: 'The 6×6 network finds 70 witnesses in 28 876 search steps, and adds a shortcut ' +
          'wherever it finds none.'
      },
      {
        term: 'The two witness-search errors are not symmetric',
        plain: 'Missing a witness is slow. Inventing one is wrong.',
        formal: 'false negative ⇒ an unnecessary shortcut, still correct; false positive ⇒ a missing shortcut, incorrect',
        readAs: 'The witness search decides whether a shortcut is needed. Failing to find a witness that ' +
          'exists costs you an extra edge and nothing else; believing in one that does not exist ' +
          'deletes a route.',
        detail: [
          'This asymmetry is what licenses every practical shortcut in the implementation.',
          'The search may be truncated by hop count, bounded by distance, or abandoned early, ' +
            'because all of those failures fall on the safe side. They add edges nobody needed, ' +
            'making the graph bigger and the query slower while leaving every distance correct.',
          'What is never permissible is claiming a witness that does not exist. The easiest way to ' +
            'do that is to let the search walk through nodes that have already been contracted and ' +
            'are therefore gone.'
        ],
        example: 'Skipping the witness search entirely gives 492 shortcuts instead of 18, a graph 8.94× ' +
          'the original size, and 0 wrong pairs of 1 260.'
      },
      {
        term: 'Searching through contracted nodes finds witnesses that no longer exist',
        plain: 'A node that has been removed cannot carry a route.',
        formal: 'the witness must be a path in the *remaining* graph; `contracted` is a required argument, not an option',
        detail: [
          'This is the bug the section exists for, and its signature is what makes it dangerous.',
          'The hierarchy comes out almost exactly the right size, the build takes the usual time, ' +
            'and every structural invariant holds. A few pairs in a thousand return a distance that ' +
            'is too large — or Infinity, on a connected graph.',
          'No spot check finds it, and nothing about the artefact looks wrong. The only defence is ' +
            'an exhaustive comparison against a reference at a size where exhaustive is affordable, ' +
            'kept as a fixture forever.'
        ],
        example: 'The broken variant produces 20 shortcuts against the correct 18 and is wrong on 42 of ' +
          '1 260 pairs, 20 of which are reported unreachable.'
      },
      {
        term: 'The order decides speed, never correctness',
        plain: 'Contract the nodes that need fewest shortcuts first — edge difference is the usual score.',
        formal: 'edge difference = shortcuts a contraction would add − edges it would remove; recomputed lazily',
        detail: [
          'Any contraction order produces a correct hierarchy, so the ordering heuristic is a pure ' +
            'performance knob and can be as approximate as you like.',
          'Edge difference is the standard greedy choice, and it is recomputed lazily because ' +
            'contracting a node changes its neighbours\' scores.',
          'What emerges is worth looking at. On a road-like network the last nodes contracted are ' +
            'the junctions where the fast roads meet — the algorithm rediscovers the motorway ' +
            'network from nothing but a shortcut count.'
        ],
        example: 'The demo highlights the last 15% of nodes to be contracted, and on a road-like ' +
          'network they are exactly the fast-road junctions.'
      },
      {
        term: 'The query never goes down the hierarchy',
        plain: 'Two searches, both moving only to higher-ranked nodes, meeting at the top.',
        formal: 'forward search on upward edges from s, backward on upward edges into t; the meeting node is the highest on the path',
        detail: [
          'The upward restriction is what makes the query fast. It halves the edges each search ' +
            'sees, and confines both to a small neighbourhood of the top of the ranking.',
          'It is only correct because contraction added a shortcut everywhere the true path ' +
            'descends, which is exactly what the witness search decides.',
          'Query correctness and preprocessing correctness are therefore the same property, seen at ' +
            'two different times. That is why a preprocessing bug is so much worse than a query bug.'
        ],
        example: 'On a road-like 8×8 network Dijkstra settles 64 nodes, bidirectional Dijkstra 42 and ' +
          'the hierarchy 37, all returning 46.'
      },
      {
        term: 'Preprocessing is amortised over queries, and the exchange rate is brutal',
        plain: 'The build cost grows far faster than the query saving does.',
        formal: 'witness search is the dominant preprocessing cost and scales superlinearly; query settled counts fall slowly',
        detail: [
          'The reason contraction hierarchies are a continental-scale technique, and a poor choice ' +
            'for a small graph, is visible in one table.',
          'Over a 9× increase in nodes, preprocessing work rises by nearly 300× while the query ' +
            'settles roughly half as many nodes. That is a good trade only when the preprocessing is ' +
            'paid once and the query is run billions of times.',
          'For a handful of route lookups on a graph that fits in memory, bidirectional Dijkstra is ' +
            'the right answer and needs no build step at all.'
        ],
        example: 'Witness steps rise from 2 927 at 16 nodes to 864 467 at 144 — 295× the work for 9× ' +
          'the nodes.'
      },
      {
        term: 'Some graphs have nothing to contract around',
        plain: 'A path and a barbell produce zero shortcuts, so the hierarchy is pure overhead.',
        formal: 'shortcuts are needed only where a contracted node lies on a unique shortest path between survivors',
        detail: [
          'Recognising the degenerate case before deploying the technique saves a lot of ' +
            'disappointment.',
          'On a path every node has at most two neighbours, and removing one leaves a single pair ' +
            'whose only route was through it. But the replacement edge is the path itself, so no ' +
            '*extra* structure appears. On a clique-heavy graph almost every pair already has a ' +
            'direct edge.',
          'The technique earns its keep on graphs with a genuine hierarchy of importance, which road ' +
            'networks have and social graphs largely do not.'
        ],
        example: 'A path of 20 and a barbell of 5 both build with 0 shortcuts and 1.00× edge growth.'
      },
      {
        term: 'Verify an index exhaustively at a size where exhaustive is affordable',
        plain: 'Check every pair against a reference, and keep the fixture forever.',
        formal: 'n² queries against Dijkstra; the disagreement count is a reported field, not an exception',
        detail: [
          'A preprocessing artefact outlives the run that produced it, so every query afterwards ' +
            'inherits any error in it.',
          'Sampled testing is useless here, because the failure rate is a few per thousand and the ' +
            'failures are indistinguishable from correct answers.',
          'An all-pairs comparison on a few dozen nodes takes milliseconds and catches the entire ' +
            'class. Reporting the disagreement count rather than throwing keeps the demo usable ' +
            'exactly when a broken variant is selected on purpose.'
        ],
        example: '4 460 pairs across six fixtures, 0 wrong with the correct witness search and 42 wrong ' +
          'with the broken one.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));

/** Concepts for the first graph sections (M13.1-M13.3). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'graph-representations': [
      {
        term: 'A graph is an input format, not a working format',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["the input: a list of edges"] --> B["convert once"]',
            '    B --> C["adjacency lists — for traversal"]',
            '    B --> D["CSR arrays — for scale"]',
            '    B --> E["a matrix — only if you need<br/>constant-time edge tests"]',
            '    C --> F["the algorithm picks the format,<br/>and conversion is one linear pass"]'
          ].join('\n'),
          caption: 'Arguing about which representation is best is arguing about which algorithm you are running. Convert on the way in and the question dissolves.'
        },
        plain: 'Store it as a list of edges and convert to whatever the algorithm needs.',
        formal: '{ n, edges: [{ from, to, weight }], directed } converts to adjacency list, matrix or CSR',
        detail: 'Every representation is good at something and hopeless at something else, so a library ' +
          'that commits to one has already lost an argument it never had. Keeping the edge list as the ' +
          'canonical form and converting per algorithm costs one linear pass and makes the trade ' +
          'explicit: the conversion appears in the profile instead of hiding as a constant factor ' +
          'inside a traversal. It also means the memory question is answerable — the same graph can be ' +
          'measured in all three forms at once, which is the first table in this section.',
        example: 'A 400-node grid with 760 edges costs 25.3 KB as CSR, 38.8 KB as an adjacency list and ' +
          '1.2 MB as a matrix.'
      },
      {
        term: 'CSR is what a serious graph library stores',
        plain: 'Two typed arrays: where each vertex starts, and its neighbours laid out end to end.',
        formal: 'offsets[v] .. offsets[v + 1] is v’s slice of targets; a neighbour scan is one contiguous read',
        detail: 'An adjacency list of arrays gives the same asymptotics and a completely different ' +
          'machine: each vertex\'s neighbours live in a separately allocated object, so a traversal is ' +
          'a pointer chase per vertex and the prefetcher can do nothing. Compressed sparse row puts ' +
          'every neighbour in one flat array, so scanning a vertex is a sequential read and scanning ' +
          'the whole graph is a sequential read of the whole array. That is why the same BFS is ' +
          'several times faster on CSR, and why the representation is the first thing to check when a ' +
          'graph workload is slower than its complexity says it should be.',
        example: 'CSR is 1.53× smaller than the adjacency list on the default grid — and the ' +
          'locality, not the bytes, is the reason to use it.'
      },
      {
        term: 'The adjacency matrix buys one operation and pays n² for it',
        plain: 'Constant-time "is there an edge?" at the cost of storing every absent edge.',
        formal: 'Θ(n²) entries whatever m is; the neighbour scan is Θ(n) per vertex, mostly over Infinity',
        readAs: 'A matrix reserves a cell for every possible edge, whether it exists or not — n vertices ' +
          'means n² cells. Scanning one vertex\'s neighbours then costs n, nearly all of it spent ' +
          'reading "no edge here".',
        detail: 'The matrix is the right structure exactly when the graph is dense or when the ' +
          'algorithm is defined over the matrix itself — Floyd-Warshall, transitive closure, anything ' +
          'that wants a bit-parallel row operation. Everywhere else it is a trap that looks tidy: at ' +
          '0.95% density the default grid spends more than 99% of 1.2 MB recording the absence of ' +
          'edges, and its neighbour scan reads 400 cells to find four neighbours. Reach for it when ' +
          'you have measured the density, not when the code looks nicer.',
        example: 'The matrix is 49.38× the size of CSR on a graph that is 0.95% dense.'
      },
      {
        term: 'BFS and DFS do identical work and differ in what they hold',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["both visit every vertex once<br/>and every edge once"] --> B["same O(V + E)"]',
            '    C["BFS holds a frontier —<br/>can be the whole width of the graph"] --> D["peak memory is the widest level"]',
            '    E["DFS holds a path —<br/>at most the depth"] --> F["peak memory is the longest path"]',
            '    D --> G["same time, and the memory<br/>can differ by orders of magnitude"]',
            '    F --> G'
          ].join('\n'),
          caption: 'The choice between them is almost never about speed. It is about which of the two shapes your graph has, and therefore which peak you can afford.'
        },
        plain: 'Same vertices, same edges — the peak memory is the whole difference.',
        formal: 'both are Θ(n + m); BFS peaks at the widest level, DFS at the longest root-to-node path',
        readAs: 'The two traversals cost the same — one visit per vertex and one per edge — and differ only ' +
          'in memory. BFS holds a whole level at once; DFS holds one path. Which is worse depends ' +
          'entirely on the shape of the graph.',
        detail: 'This is the comparison that gets stated backwards. Neither search is faster; they ' +
          'visit every reachable vertex and examine every incident edge exactly once, and on the same ' +
          'graph the counters are equal. What differs is the frontier: breadth-first holds one level, ' +
          'which is wide and shallow, and depth-first holds one path, which is narrow and deep. Choose ' +
          'by which of those your graph makes enormous — a wide bipartite layer graph kills BFS, a ' +
          'long chain kills recursive DFS.',
        example: 'On the 400-node grid both visit 400 nodes and examine 1 520 edges; the BFS frontier ' +
          'peaks at 20 and the DFS stack at 400.'
      },
      {
        term: 'Recursive DFS is a stack overflow waiting for the right input',
        plain: 'Use an explicit stack; the recursion depth is the path length, not the log of anything.',
        formal: 'depth = length of the longest root-to-node path in the DFS tree, which is n on a path graph',
        detail: 'A balanced tree makes recursion look safe because its depth is logarithmic, and a ' +
          'graph offers no such guarantee: a path, a linked list of objects, a deeply nested ' +
          'dependency chain all produce a DFS tree of depth n. Every traversal in this milestone is ' +
          'iterative for that reason, and the cost is a few lines of explicit stack frame. The failure ' +
          'mode is also the worst kind — it depends on the data, so it survives every test written ' +
          'against small fixtures and appears in production on the one customer with a long chain.',
        example: 'The DFS stack reaches 400 on a 400-node grid, and the path generator makes it exactly n.'
      },
      {
        term: 'Edge classification, and what an undirected walk can produce',
        plain: 'Tree, back, forward and cross — but undirected graphs only ever have the first two.',
        formal: 'directed: 4 classes by discovery/finish times; undirected: every non-tree edge is a back edge',
        detail: 'Classifying edges during a depth-first walk is how cycle detection, topological order ' +
          'and strong connectivity are all derived, so it is worth getting exact. A back edge points ' +
          'at an ancestor still on the stack and is precisely a cycle. A forward edge is a shortcut ' +
          'into your own already-finished subtree and a cross edge points into a different one — and ' +
          'neither can exist in an undirected graph, because an undirected edge is walkable from both ' +
          'ends and would have been taken as a tree edge from the other side first.',
        example: 'The 400-node grid classifies 399 tree edges and 361 back edges — exactly the 760 it ' +
          'has, with zero forward and zero cross.'
      },
      {
        term: 'An undirected walk sees every edge twice, and the second sighting must be dropped by id',
        plain: 'Skip the edge you arrived on — the edge, not the vertex.',
        formal: 'track the parent EDGE id; tracking the parent vertex also discards genuine parallel edges',
        detail: 'The walk arrives at v along an edge and then meets that same edge again from v\'s side. ' +
          'It must be ignored or it would be classified as a back edge to the parent, which is not a ' +
          'cycle. The natural way to ignore it — "is this neighbour my parent?" — also ignores a second, ' +
          'genuinely different edge to the same parent, and a second edge to the same parent is exactly ' +
          'what makes something not a bridge. This is why every adjacency entry in this milestone ' +
          'carries an edge id, and it is the bug section 13.4 is built around.',
        example: 'Three nodes with 0 and 1 joined twice: skipping by edge id reports one bridge, ' +
          'skipping by vertex reports two.'
      },
      {
        term: 'Two-colouring is BFS with one extra array',
        plain: 'Alternate colours by level; a same-colour edge is an odd cycle.',
        formal: 'a graph is bipartite iff it has no odd cycle; the witness is one edge plus the path around it',
        readAs: 'A graph can be two-coloured exactly when it contains no cycle of odd length — and the "iff" ' +
          'means that is a complete test, not just a necessary one. When it fails, the offending edge ' +
          'and the tree path joining its ends are the proof.',
        detail: 'Bipartiteness is the smallest example of the pattern this whole milestone repeats: the ' +
          'boolean is nearly useless and the witness is what you needed. "Not bipartite" leaves the ' +
          'caller with nowhere to go; "these two vertices have the same colour and here is the odd ' +
          'cycle through them" is a defect report. The check itself is free — one colour array carried ' +
          'through a breadth-first walk you were doing anyway — and it is the reachability test behind ' +
          'matching, two-colouring conflicts and half of the scheduling problems that look harder.',
        example: 'The grid is bipartite; adding one diagonal makes it not, and the demo names the edge ' +
          'and the odd cycle rather than returning false.'
      }
    ],

    'topological-order': [
      {
        term: 'A topological order is a promise about predecessors',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["every edge points forwards<br/>in the order"] --> B["so when you reach a vertex,<br/>everything it depends on<br/>is already computed"]',
            '    B --> C["which is why a DAG DP<br/>needs no memoisation"]',
            '    B --> D["and why a build system<br/>can run in one pass"]'
          ].join('\n'),
          caption: 'The order is not the goal; the guarantee is. Everything built on top of it — DAG shortest paths, dependency resolution, DP evaluation — uses only that one promise.'
        },
        plain: 'Every edge points forwards, so everything a vertex depends on is already settled.',
        formal: 'an ordering v1..vn such that every edge (vi, vj) has i < j; exists iff the graph is acyclic',
        readAs: 'Line the vertices up so every edge points forwards. Such an ordering exists exactly when ' +
          'there are no cycles — a cycle would need an edge pointing back.',
        detail: 'The list itself is rarely the goal. What the order buys is the right to process ' +
          'vertices in one sweep with no memoisation, no priority queue and no fixpoint iteration, ' +
          'because when you reach a vertex every predecessor is finished. That single guarantee turns ' +
          'longest path — NP-hard on a general graph — into one linear pass, makes negative edge ' +
          'weights harmless, and is the reason a build system computes an order before doing anything ' +
          'else. Validate it the only way that means anything: check that every edge points forwards.',
        example: 'Every method in the demo is validated edge by edge on 40 packages, and all three ' +
          'orders place all 40.'
      },
      {
        term: 'Kahn: repeatedly take a vertex with no unmet dependency',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["count incoming edges<br/>for every vertex"] --> B["queue everything with a count of 0"]',
            '    B --> C["take one, output it"]',
            '    C --> D["decrement its neighbours\' counts"]',
            '    D --> E["any that reach 0 join the queue"]',
            '    E --> C',
            '    C --> F["queue empty but vertices left:<br/>those vertices are a cycle"]'
          ].join('\n'),
          caption: 'The cycle detection is not a separate pass. Whatever is left when the queue empties is precisely the part of the graph that can never be ordered.'
        },
        plain: 'Count incoming edges, start from the zeroes, and decrement as you go.',
        formal: 'maintain in-degrees; a vertex joins the ready set when its count reaches zero; Θ(n + m)',
        readAs: 'Count how many unmet dependencies each vertex has. Every time one is satisfied, decrement; ' +
          'when it hits zero the vertex is ready. One visit per vertex and per edge.',
        detail: 'Kahn\'s algorithm is the one to reach for when the order has to mean something ' +
          'operationally, because its ready set is literally "what can be built right now". That makes ' +
          'it the natural fit for a scheduler: hand ready vertices to workers, decrement on completion, ' +
          'and the algorithm and the build are the same loop. It also fails informatively — when the ' +
          'ready set empties with vertices left over, every one of those vertices is downstream of a ' +
          'cycle, which is a far more useful message than a boolean.',
        example: 'On 40 packages with 2 dependencies each, Kahn places all 40 and the ready set is ' +
          'what the four-worker schedule consumes.'
      },
      {
        term: 'DFS finish order, reversed, is also a topological order',
        plain: 'A vertex finishes only after everything it points at has finished.',
        formal: 'push v on finish; the reversed finish sequence is a valid order; a back edge proves a cycle',
        detail: 'The two derivations answer different questions and both are worth knowing. Kahn is ' +
          'incremental and matches a scheduler; the depth-first version drops out of a walk you are ' +
          'often doing anyway and is the foundation of Kosaraju\'s strongly-connected-components ' +
          'algorithm, which uses exactly this finish order on the reversed graph. The cycle test is ' +
          'different too: Kahn detects a cycle by stalling, DFS by meeting a back edge, and the back ' +
          'edge hands you the cycle directly.',
        example: 'The DFS order and both Kahn orders all place 40 of 40 packages and every one passes ' +
          'the edge-by-edge check.'
      },
      {
        term: 'Returning null on a cycle is a useless error',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["there is a cycle"] --> B["return null"]',
            '    B --> C["the caller knows something is wrong<br/>and nothing about where"]',
            '    A --> D["return the cycle itself"]',
            '    D --> E["costs one parent map"]',
            '    E --> F["and it is the only output<br/>a human can act on"]'
          ].join('\n'),
          caption: 'A dependency cycle in a real build is a bug report, and the report has to name the loop. Detecting it and discarding it is most of the work for none of the value.'
        },
        plain: 'Return the cycle. It costs one parent map and it is the only thing the caller can act on.',
        formal: 'on detecting a back edge (u, v), walk parents from u to v; the resulting list is the cycle',
        detail: '"Circular dependency detected" in a build log is the difference between a five-minute ' +
          'fix and an afternoon of bisecting imports, and the whole difference is one array the ' +
          'algorithm already maintains. This is the general shape: when a routine can fail because of a ' +
          'property of the input, the useful return value is the witness, not the verdict. The same ' +
          'sentence covers the odd cycle in a two-colouring, the negative loop in a rate table, and the ' +
          'pair of vertices where an ordering assumption broke.',
        example: 'The demo injects one back edge — one new import, added last — and reports the exact ' +
          'cycle rather than a boolean.'
      },
      {
        term: 'The critical path is the floor no worker count breaks',
        plain: 'The longest chain of dependent tasks is the fastest a build can possibly go.',
        formal: 'makespan >= longest weighted path in the DAG, for any number of workers',
        detail: 'Total work divided by workers is a lower bound people quote and it is the wrong one, ' +
          'because dependent tasks cannot overlap however many machines you buy. The real floor is the ' +
          'longest chain, and the ratio between total work and that chain is the maximum speedup ' +
          'available — a number worth computing before authorising a bigger CI fleet. Everything above ' +
          'that ratio is spend with no return, and the schedule table shows exactly where the curve ' +
          'goes flat.',
        example: '40 packages totalling 118 units of work have a critical path of 25 over 7 packages, ' +
          'so no worker count beats a 4.72× speedup.'
      },
      {
        term: 'Adding workers stops helping long before you notice',
        plain: 'The makespan flattens at the critical path, and the extra workers idle.',
        formal: 'makespan(k) falls until k reaches the peak parallel width, then is constant at the critical path',
        detail: 'The interesting column in a schedule table is not the makespan but the number of ' +
          'workers actually busy, because that is what separates "we need more machines" from "we need ' +
          'to break this dependency". Once the width of the widest independent set is reached, more ' +
          'workers change nothing at all — and the fix is a graph change, not a capacity change. This ' +
          'is why a build that takes 25 minutes on eight machines still takes 25 on sixty-four, and ' +
          'why the answer is to split the package on the critical path.',
        example: 'One worker takes 118, two take 59, four take 36, eight take 25 — and sixty-four also ' +
          'take 25, with at most 11 ever busy.'
      },
      {
        term: 'DAG shortest paths need no priority queue',
        plain: 'Relax edges in topological order, once each, and negative weights are fine.',
        formal: 'Θ(n + m) rather than Θ(m log n); Dijkstra’s non-negativity requirement disappears entirely',
        readAs: 'On a DAG the topological order already tells you the right sequence, so no priority queue is ' +
          'needed — and because nothing is ever settled early, negative weights are fine.',
        detail: 'Dijkstra needs a heap because it has to decide which vertex is safe to settle next; on ' +
          'a DAG the topological order has already decided, so the heap is pure overhead. More ' +
          'importantly the non-negativity restriction goes with it: the order guarantees every ' +
          'predecessor is final before a vertex is relaxed, so a negative edge cannot invalidate a ' +
          'settled distance. Any problem whose state space is acyclic — a build, a pipeline, a version ' +
          'history, a layered network — should use this rather than reaching for Dijkstra out of habit.',
        example: 'From package 0 the sweep reaches 19 packages with no priority queue at all.'
      },
      {
        term: 'Longest path is easy here and NP-hard everywhere else',
        plain: 'Negate the weights and run the same sweep; on a general graph the problem is intractable.',
        formal: 'longest path in a DAG is Θ(n + m); longest simple path in a general graph is NP-hard',
        readAs: 'The same question is linear on an acyclic graph and intractable on a general one. Cycles are ' +
          'what makes the difference: without them there is nothing to go round twice.',
        detail: 'The gap between those two facts is the sharpest illustration of what acyclicity buys, ' +
          'and it is worth being able to state in a design review. On a DAG the recurrence "longest ' +
          'path ending here = the best of my predecessors, plus my weight" terminates because there is ' +
          'no cycle to loop around; on a general graph the same recurrence has no base case and the ' +
          'problem contains Hamiltonian path. So "is this graph acyclic?" is not a formality — it is ' +
          'the question that decides whether the problem is linear or hopeless.',
        example: 'The critical path of 25 is a longest-path computation done in a single sweep over ' +
          '40 packages.'
      }
    ],

    'strongly-connected': [
      {
        term: 'A strongly connected component is a mutual-reachability class',
        plain: 'Every vertex in it can reach every other one, going the right way down the arrows.',
        formal: 'u ~ v iff u reaches v and v reaches u; this is an equivalence relation, so the classes partition V',
        readAs: 'Two vertices are in the same component when each can reach the other. Because that relation ' +
          'is reflexive, symmetric and transitive — an equivalence relation — it carves the vertices ' +
          'into disjoint groups with nothing left over and nothing in two groups.',
        detail: 'Because mutual reachability is an equivalence relation, the components partition the ' +
          'vertices — every vertex is in exactly one, including vertices on no cycle at all, which form ' +
          'components of size one. That last case is the one people forget, and it is why a singleton ' +
          'count is a useful output: a directed graph whose components are all singletons has no ' +
          'directed cycle anywhere, which is the same as saying it is a DAG already.',
        example: 'Five chained cycles of four give 15 components of size 4 and zero singletons on a ' +
          '60-node digraph.'
      },
      {
        term: 'Tarjan: one pass, one stack, one number per vertex',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["give each vertex an index<br/>as it is first seen"] --> B["track the lowest index reachable<br/>from its subtree that is still<br/>on the stack"]',
            '    B --> C{"is that number its own index?"}',
            '    C -->|yes| D["it is the root of a component —<br/>pop the stack down to it"]',
            '    C -->|no| E["it belongs to an<br/>ancestor\'s component"]'
          ].join('\n'),
          caption: 'One depth-first pass and two integers per vertex. Kosaraju needs two passes and a reversed copy of the graph to reach the same answer.'
        },
        plain: 'Track the earliest vertex reachable from this subtree that is still on the stack.',
        formal: 'lowlink[v] = min(index[v], lowlink of children, index of stack neighbours); v is a root iff lowlink = index',
        readAs: 'Each vertex records the earliest-discovered vertex reachable from its subtree. When that ' +
          'value equals the vertex\'s own discovery number, nothing under it escapes upward — so it is ' +
          'the root of a component.',
        detail: 'The algorithm is a depth-first walk with a stack of vertices whose component is not yet ' +
          'decided. A vertex whose lowlink never falls below its own index cannot reach anything ' +
          'earlier that is still open, so it is the root of its component and everything above it on ' +
          'the stack pops out together. One pass, one traversal of every edge, and it needs neither the ' +
          'reverse graph nor a second walk — which is why it wins on memory when the graph is large ' +
          'enough that materialising the reverse is a real cost.',
        example: 'Tarjan finds all 15 components in one pass over 60 vertices and 74 edges.'
      },
      {
        term: 'This lowlink is not the biconnectivity lowlink',
        plain: 'Here it may follow an edge to anything still on the stack; there, only to an ancestor.',
        formal: 'SCC: min over stack-resident neighbours. Bridges: min over already-discovered ancestors',
        detail: 'The two algorithms look nearly identical on the page and answer different questions, ' +
          'so conflating them produces code that runs, terminates and is wrong. Strong connectivity ' +
          'asks whether a subtree can reach anything whose component is still undecided, which includes ' +
          'cross edges into open components. Biconnectivity asks whether a subtree has a second route ' +
          'up to an ancestor, which is a strictly narrower question. Writing both in the same codebase ' +
          'and naming both variables `low` is a reliable way to lose a day.',
        example: 'The SCC lowlink accepts a cross edge into an open component; the bridge lowlink of ' +
          '13.4 must not.'
      },
      {
        term: 'Kosaraju: two passes, and it exists to check the first one',
        plain: 'Finish-order DFS, then a DFS on the reversed graph in that order.',
        formal: 'order by decreasing finish time in G, then take DFS trees in that order on Gᵀ',
        readAs: 'Kosaraju\'s two passes: one to order the vertices by when the search finished with them, and ' +
          'one on the graph with every edge reversed — that is what the superscript T means — taking ' +
          'the trees in that order.',
        detail: 'Kosaraju needs the reverse graph and walks every edge twice, so it is the slower ' +
          'algorithm — and it is the one to keep, because it is derived completely differently and ' +
          'therefore fails differently. Two independent implementations that agree on a partition are ' +
          'evidence; one implementation that passes its own tests is not. Compare them as *partitions* ' +
          'rather than as labellings: the component ids are arbitrary and only the grouping is the ' +
          'answer.',
        example: 'Kosaraju examines 148 edges against Tarjan’s 74 on the same graph, and the two ' +
          'partitions match exactly.'
      },
      {
        term: 'The condensation is always a DAG',
        plain: 'Collapse each component to one node and no cycle can survive.',
        formal: 'if the condensation had a cycle, its components would be mutually reachable and would be one component',
        detail: 'This is the payoff of the whole computation rather than a curiosity: whatever the ' +
          'original graph looked like, the condensation is acyclic, so every technique from the ' +
          'topological-order section applies to it. Cycle-aware analysis therefore becomes ' +
          '"components, then a sweep over the condensation" — which is how a compiler handles recursive ' +
          'function groups, how a build tool handles a module cycle, and how 2-SAT is solved. Verify it ' +
          'with an actual topological sweep rather than quoting the theorem, because a broken SCC ' +
          'computation produces a condensation with a cycle and nothing else notices.',
        example: '60 vertices and 74 edges condense to 15 nodes and 14 edges, and a topological sweep ' +
          'places all 15.'
      },
      {
        term: 'The condensation loses parallel crossings, and should',
        plain: 'Many edges between two components collapse into one.',
        formal: 'edges(condensation) <= edges(G), usually far fewer; only the existence of a crossing survives',
        readAs: 'Collapsing each component to a single node keeps at most as many edges and usually far ' +
          'fewer, because many edges between two components become one. What survives is whether a ' +
          'connection exists, not how many.',
        detail: 'The de-duplication is what makes the condensation small enough to be useful, and it is ' +
          'also the thing to remember when a caller wants edge weights back. Component-level analysis ' +
          'answers "can this group reach that group", not "how expensive is the cheapest crossing" — ' +
          'and if you need the second, the crossing edges must be kept alongside the condensation ' +
          'rather than recovered from it afterwards.',
        example: '74 edges become 14 in the condensation, because most crossings duplicate one that is ' +
          'already there.'
      },
      {
        term: 'Import cycles, deadlocks and 2-SAT are one computation',
        plain: 'Different graphs, same question: which vertices are mutually reachable?',
        formal: 'modules/imports, threads/waits-for, literals/implications — a component of size > 1 is the answer in each',
        detail: 'The reason to learn strong connectivity properly is that it keeps turning up under ' +
          'other names. A module cycle is a component in the import graph. A deadlock is a component in ' +
          'the waits-for graph. Unsatisfiability in 2-SAT is a variable sharing a component with its ' +
          'own negation in the implication graph, which is the least obvious of the four and the most ' +
          'striking: an NP-complete-looking problem becomes a single linear-time SCC pass because the ' +
          'clauses have exactly two literals.',
        example: 'The demo lists four graphs — modules, threads, literals, build targets — where a ' +
          'component of size above one is the defect.'
      },
      {
        term: 'A component must be rebuilt as a unit',
        plain: 'Nothing inside a cycle can be skipped, because everything in it depends on everything else.',
        formal: 'incremental analysis is exact on the condensation and coarse inside a component',
        detail: 'This is the operational consequence that makes engineers care about SCCs. Incremental ' +
          'builds, incremental type-checking and incremental analysis all work by processing a DAG in ' +
          'order and skipping anything whose inputs did not change; inside a strongly connected group ' +
          'that reasoning collapses, because every member is downstream of every other. So a component ' +
          'of size 40 in a module graph is a 40-module rebuild every time any one of them changes, and ' +
          'the SCC computation is what tells you which 40.',
        example: 'A component of size 4 in the demo is four packages that always rebuild together.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));

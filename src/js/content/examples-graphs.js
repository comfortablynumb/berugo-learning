/** Worked examples for the first graph sections (M13.1-M13.3). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'graph-representations': [
      {
        title: 'Three representations of one graph, in bytes',
        goal: 'Cost the same 400-node graph as an adjacency list, a matrix and CSR, and decide which ' +
          'one to store.',
        setup: 'A 20 × 20 grid: 400 vertices, 760 undirected edges, mean degree 3.80 and maximum ' +
          'degree 4. Every representation is built from the same edge list and measured.',
        steps: [
          {
            do: 'Compute the density first, because it decides everything else.',
            why: 'The matrix costs n² whatever m is, so the question is what fraction of n² the edges are.',
            work: '760 edges of a possible 79 800 — a density of 0.95%',
            result: 'more than 99% of any matrix would record the absence of an edge'
          },
          {
            do: 'Measure CSR: one offset per vertex plus one entry per direction.',
            why: 'This is the compact form and the natural baseline.',
            work: '401 offsets plus 1 520 arcs at 16 bytes each = 25.3 KB',
            result: 'a neighbour scan is a contiguous read of two typed arrays'
          },
          {
            do: 'Measure the adjacency list of arrays.',
            why: 'Same asymptotics, different machine: each vertex owns a separately allocated array.',
            work: '38.8 KB, which is 1.53× CSR',
            result: 'the 53% is the smaller half of the cost; the pointer chase per vertex is the larger'
          },
          {
            do: 'Measure the matrix.',
            why: 'It buys a constant-time edge test, and it is worth pricing that test.',
            work: '400² entries at 8 bytes = 1.2 MB, which is 49.38× CSR',
            result: 'and its neighbour scan reads 400 cells to find four neighbours'
          }
        ],
        answer: 'At 0.95% density CSR costs 25.3 KB, the adjacency list 38.8 KB and the matrix 1.2 MB — ' +
          'a 49.38× spread for the identical graph. Store CSR unless you have measured a reason not to: ' +
          'it is the smallest, and more importantly its neighbour scan is sequential, which is why a ' +
          'traversal over it runs several times faster than over an array of arrays with the same ' +
          'complexity.'
      },
      {
        title: 'The density at which the matrix wins, and the walk that costs the same either way',
        goal: 'Find where the previous ranking inverts, then show that BFS and DFS differ in memory ' +
          'rather than in work.',
        setup: 'The same 400 vertices, with the edge count swept from 400 to 79 800; then BFS and DFS ' +
          'from vertex 0 of the 20 × 20 grid, with the frontier, the stack and the edge classification ' +
          'counted.',
        steps: [
          {
            do: 'Sweep the edge count and watch the matrix ratio fall.',
            why: 'The matrix is flat at 1 250.0 KB and CSR grows linearly, so they must cross.',
            work: '400 edges: 88.86× · 4 000: 9.88× · 20 000: 2.00× · 40 000: 1.00×',
            result: 'the crossing is at 40 000 edges — exactly n²/4, or 50% density'
          },
          {
            do: 'Read off the fully dense case.',
            why: 'The first example\'s conclusion has to be stated with its precondition attached.',
            work: 'at 79 800 edges the matrix is 1 250.0 KB against CSR\'s 2 495.3 KB — 0.50×',
            result: 'on a complete graph the matrix is half the size of the compact representation'
          },
          {
            do: 'Now run BFS and DFS from the same source on the grid and compare the counters.',
            why: '"BFS is faster than DFS" is said constantly and is not a claim about work.',
            work: 'both visit 400 nodes and examine 1 520 edges — identical',
            result: 'the work is the same; only the peak differs'
          },
          {
            do: 'Compare the peaks.',
            why: 'This is the real difference, and it is the one that decides which overflows.',
            work: 'BFS frontier peaks at 20, DFS stack peaks at 400',
            result: 'a 20× difference in live memory for identical work'
          },
          {
            do: 'Classify the DFS edges and check the total.',
            why: 'An undirected walk can only produce two of the four classes, and the arithmetic proves it.',
            work: '399 tree + 361 back + 0 forward + 0 cross = 760, the graph\'s entire edge set',
            result: 'every edge classified exactly once, and no undirected forward or cross edge exists'
          }
        ],
        answer: 'The first example\'s ranking holds below 50% density and inverts above it: at 40 000 ' +
          'edges the matrix and CSR are the same size, and on a complete graph the matrix is half the ' +
          'size. And the choice between BFS and DFS is not a choice about speed at all — both visit 400 ' +
          'nodes and examine 1 520 edges — it is a choice between a frontier of 20 and a stack of 400. ' +
          'Pick by which of those your graph makes enormous, which is exactly why the DFS here is ' +
          'iterative.'
      }
    ],

    'topological-order': [
      {
        title: 'How many build workers are worth buying',
        goal: 'Turn a dependency graph into a defensible answer about machine count.',
        setup: '40 packages with 2 dependencies each and a build time per package, totalling 118 units ' +
          'of work. The graph is ordered, then scheduled greedily at several worker counts.',
        steps: [
          {
            do: 'Order the packages and validate the order edge by edge.',
            why: 'An order that is not checked is a list, and every downstream claim rests on it.',
            work: 'all 40 packages placed, every edge pointing forwards, by three separate methods',
            result: 'Kahn, DFS finish order and the lexicographic variant all agree'
          },
          {
            do: 'Compute the total work — the one-worker time.',
            why: 'This is the numerator of every speedup claim.',
            work: '118 units',
            result: 'the naive "buy k machines, divide by k" baseline'
          },
          {
            do: 'Compute the critical path with a single sweep in topological order.',
            why: 'Dependent tasks cannot overlap, so the longest chain is a hard floor.',
            work: '25 units, over a chain of 7 packages',
            result: 'no worker count can finish faster than 25'
          },
          {
            do: 'Divide to get the speedup ceiling, then schedule and compare.',
            why: 'The ratio is the number that decides whether more machines help.',
            work: '118 / 25 = 4.72×; measured makespans are 118, 59, 36, 25, 25, 25 at 1, 2, 4, 8, 16 and 64 workers',
            result: 'the curve reaches its floor at 8 workers and never moves again'
          },
          {
            do: 'Read the "workers actually busy" column.',
            why: 'It says whether the constraint is capacity or graph shape.',
            work: 'at most 11 workers are ever busy at once, however many are provided',
            result: 'past 11 machines the money buys idle time'
          }
        ],
        answer: 'Eight workers. Total work is 118 and the critical path is 25, so the speedup ceiling is ' +
          '4.72× and it is reached at 8 workers — 16 and 64 both take the same 25 units, with never ' +
          'more than 11 busy at once. The only way below 25 is to shorten the chain of 7 packages, ' +
          'which is a change to the dependency graph rather than to the fleet, and the topological ' +
          'sweep is what identifies which 7.'
      },
      {
        title: 'The same graph with one cycle in it, and what the error message is worth',
        goal: 'Break the build with a single extra import and compare what each failure mode tells you.',
        setup: 'The same 40 packages with one back edge added — one new import, added last, which is ' +
          'how a dependency cycle actually appears.',
        steps: [
          {
            do: 'Run Kahn\'s algorithm and watch it stall.',
            why: 'This is the failure mode a build tool actually hits.',
            work: '37 of 40 packages placed, then the ready set empties with 3 left',
            result: 'the 3 stragglers are the cycle and everything downstream of it'
          },
          {
            do: 'Ask what the boolean is worth.',
            why: '"Is it acyclic?" is the question the caller already suspected the answer to.',
            work: 'the answer is "no", over a graph of 40 packages',
            result: 'no indication of which packages, so no way to act'
          },
          {
            do: 'Extract the cycle from the parent pointers instead.',
            why: 'One array the algorithm already maintains turns the verdict into a witness.',
            work: '34 → 19 → 34, a cycle of 2 packages, verified edge by edge against the graph',
            result: 'the exact chain to open in an editor'
          },
          {
            do: 'Compare the two orderings\' failure behaviour.',
            why: 'They fail differently, and one of them is far more useful operationally.',
            work: 'Kahn places 37 before stalling; the DFS version aborts at the back edge, placing 0',
            result: 'Kahn also answers "what can still be built" — 37 packages, and they can start now'
          },
          {
            do: 'Note what the critical path becomes.',
            why: 'Every downstream computation depends on acyclicity and must say so rather than guess.',
            work: 'both the critical path and the 4-worker makespan report "undefined while a cycle exists"',
            result: 'a refusal rather than a plausible number'
          }
        ],
        answer: 'One extra import takes the build from 40 packages ordered to 37, and the difference ' +
          'between a useless error and a useful one is a parent array: "circular dependency detected" ' +
          'against "34 → 19 → 34, and the other 37 packages can still be built". This inverts the first ' +
          'example — there the order was the means and the schedule was the answer; here the order ' +
          'cannot exist and the by-product of failing is the entire value.'
      }
    ],

    'strongly-connected': [
      {
        title: 'Two algorithms, one partition, and the DAG that falls out',
        goal: 'Compute strongly connected components twice by different routes and verify the ' +
          'condensation is acyclic.',
        setup: 'A 60-vertex digraph built as five chained cycles of four, with 74 directed edges — a ' +
          'shape whose component structure is known in advance, which is what makes it a fixture ' +
          'rather than a demonstration.',
        steps: [
          {
            do: 'Run Tarjan\'s algorithm: one depth-first pass with an index, a lowlink and a stack.',
            why: 'It needs no reverse graph and touches every edge once.',
            work: '15 components from 1 pass, 60 vertices visited and 74 edges examined',
            result: 'every component has size 4 and there are no singletons'
          },
          {
            do: 'Run Kosaraju: finish-order DFS, then a DFS on the reversed graph in that order.',
            why: 'A second derivation is the only real evidence that the first is right.',
            work: '15 components from 2 passes, 148 edges examined — twice Tarjan\'s 74',
            result: 'the extra pass is the price of the cross-check'
          },
          {
            do: 'Compare the two results as partitions rather than as labellings.',
            why: 'Component ids are arbitrary; only the grouping is the answer.',
            work: '15 groups against 15 groups, identical membership',
            result: 'two independent derivations agreeing is worth more than either alone'
          },
          {
            do: 'Build the condensation and run a topological sweep over it.',
            why: 'The theorem says it is acyclic; a broken SCC computation produces one that is not.',
            work: '60 vertices and 74 edges become 15 nodes and 14 edges, and all 15 are placed',
            result: 'acyclicity verified by counting rather than quoted'
          }
        ],
        answer: '15 components of size 4, found identically by two algorithms with different ' +
          'derivations, condensing to a 15-node DAG with 14 edges. The de-duplication is worth noticing: ' +
          '74 edges become 14 because many crossings between the same pair of components collapse into ' +
          'one. That is what makes the condensation small enough to be useful, and it is also why edge ' +
          'weights must be kept alongside it if you need them — the condensation answers "can this ' +
          'group reach that group", not "how expensive is the cheapest crossing".'
      },
      {
        title: 'The same computation on a random digraph, where the shape inverts',
        goal: 'Run the identical analysis on a graph with no designed structure and read the difference.',
        setup: 'The same 60 vertices with 120 random directed edges instead of five chained cycles.',
        steps: [
          {
            do: 'Count the components.',
            why: 'The chained-cycles fixture gave 15 equal components; a random digraph does not.',
            work: '18 components, the largest holding 43 vertices — 71.7% of the graph',
            result: 'one giant component instead of a uniform partition'
          },
          {
            do: 'Count the singletons.',
            why: 'A singleton is a vertex on no directed cycle at all, and the fixture had none.',
            work: '17 singletons against 0 on the chained-cycles graph',
            result: 'a giant component plus a dust of isolated vertices — the usual random-digraph picture'
          },
          {
            do: 'Compare the two algorithms\' peak stack on this shape.',
            why: 'The work counters track edges; the memory tracks structure, and here they diverge.',
            work: 'Tarjan peaks at 44 and Kosaraju at 23, on the same 60 vertices',
            result: 'Tarjan holds the whole giant component on its stack at once'
          },
          {
            do: 'Check the condensation again.',
            why: 'The theorem does not care about the shape, and the check should be run anyway.',
            work: '18 nodes and 21 edges, all 18 placed by a topological sweep',
            result: 'acyclic here too, from 120 edges rather than 74'
          }
        ],
        answer: 'The same code on a random digraph reports 18 components with one holding 71.7% of the ' +
          'graph and 17 singletons — nothing like the 15 uniform components of the designed fixture. ' +
          'That inversion is the reason to keep both: the chained-cycles graph has a known answer and ' +
          'so tests correctness, while the random graph exercises the case a real import graph or ' +
          'waits-for graph actually looks like, where the interesting question is not how many ' +
          'components there are but how big the largest one is.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));

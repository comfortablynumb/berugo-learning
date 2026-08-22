/** Reference entries for maximum flow, minimum cut and push-relabel (M14.1-M14.3). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'maximum-flow': {
      summary: 'The residual graph as the whole idea, four augmenting-path algorithms that differ ' +
        'only in which path they take, the cut that certifies the answer, and the greedy that is ' +
        'wrong by one unit in two thousand rather than slow.',
      intuition: 'A backward arc is permission to change your mind. Take it away and repeated path ' +
        'filling stops at a local maximum and reports success.',
      formulation: {
        equations: [
          {
            label: 'A flow',
            expr: '0 <= f(e) <= c(e), and inflow = outflow at every vertex except s and t',
            terms: [
              { sym: 'value', meaning: 'the net flow out of s, which equals the net flow into t' },
              { sym: 'residual forward', meaning: 'c(u,v) − f(u,v)' },
              { sym: 'residual backward', meaning: 'f(u,v) on the reverse arc — not present in the input' },
              { sym: 'measured', meaning: '39 input arcs become 54 residual arcs, 28 of them backward' }
            ]
          },
          {
            label: 'Max-flow min-cut',
            expr: 'max |f| = min c(S, V∖S) over s-t cuts',
            terms: [
              { sym: 'the cut', meaning: 'everything still reachable from s in the residual graph' },
              { sym: 'why it is tight', meaning: 'every arc leaving S is saturated and every arc entering it is empty' },
              { sym: 'measured', meaning: 'value 22, cut across 8 arcs, capacity 22' }
            ]
          },
          {
            label: 'The four augmenting-path algorithms on the default network',
            expr: 'same value, 3.4x spread in arc visits',
            terms: [
              { sym: 'Ford-Fulkerson', meaning: '13 paths, 576 arc visits — O(f·E), unbounded in the graph alone' },
              { sym: 'Edmonds-Karp', meaning: '10 paths, 647 — O(VE²), shortest path each time' },
              { sym: 'Dinic', meaning: '10 paths in 1 phase, 247 — O(V²E), a blocking flow per phase' },
              { sym: 'capacity scaling', meaning: '8 paths, 832 — O(E² log C), only fat paths' }
            ]
          },
          {
            label: 'Scaling the capacities 1 to 256',
            expr: 'the phase count is bounded by the shape, the path count is not',
            terms: [
              { sym: 'value', meaning: '4 / 10 / 29 / 103 / 403' },
              { sym: 'Ford-Fulkerson paths', meaning: '4 / 9 / 14 / 16 / 14' },
              { sym: 'Dinic phases', meaning: '1 at every capacity — one blocking flow saturates a cut on a layered network' },
              { sym: 'scaling rounds', meaning: '1 / 3 / 5 / 7 / 8 — log2 of the largest capacity' }
            ]
          },
          {
            label: 'The counter-example',
            expr: 'greedy without a residual: 1 999 where the answer is 2 000',
            terms: [
              { sym: 'the instance', meaning: 'two arcs of 1 000 each side and one of capacity 1 across the middle' },
              { sym: 'not contrived', meaning: 'short on 2 of 20 random layered networks, worst shortfall 9.5%' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Capacity on every arc and conservation at every non-terminal vertex',
          why: 'They are the definition of a flow; nothing else distinguishes one from an array of integers.',
          breaks: 'A run that stops early returns a valid-looking number with a vertex out of balance.'
        },
        {
          name: 'The value equals the capacity of the cut its own residual graph defines',
          why: 'It is the certificate, and it is computed from the answer rather than alongside it.',
          breaks: 'A value that does not equal its cut capacity is a bug the value alone never reveals.'
        },
        {
          name: 'Every arc crossing the minimum cut is saturated',
          why: 'If one were not, the source could still reach the far side and the set is wrong.',
          breaks: 'A cut reported with slack is a set of vertices, not a minimum cut.'
        },
        {
          name: 'Integral capacities admit an integral maximum flow',
          why: 'It is what lets flow answer combinatorial questions with no rounding step.',
          breaks: 'A floating-point residual accumulates error and the integrality argument is lost.'
        }
      ],
      complexity: [
        { operation: 'Ford-Fulkerson', average: 'O(f·E) — depends on the capacities', worst: 'need not terminate on irrational capacities; 13 paths / 576 arc visits here' },
        { operation: 'Edmonds-Karp', average: 'O(VE²)', worst: '10 paths / 647 arc visits — bounded by the graph alone' },
        { operation: 'Dinic', average: 'O(V²E), O(E·sqrt(V)) on unit capacities', worst: '10 paths in 1 phase / 247 arc visits' },
        { operation: 'capacity scaling', average: 'O(E² log C)', worst: '8 paths / 832 arc visits; log2(C) rounds' },
        { operation: 'minimum cut extraction', average: 'O(V + E) — one search of the residual', worst: 'free, once the flow exists' },
        { operation: 'validity check', average: 'O(V + E)', worst: 'cheaper than any of the algorithms it checks' }
      ],
      failureModes: [
        {
          symptom: 'The flow value is slightly too low and nothing looks wrong.',
          cause: 'The implementation fills paths without adding residual backward arcs.',
          fix: 'Add the reverse arc on every push; the result is not slower, it is correct.'
        },
        {
          symptom: 'Ford-Fulkerson takes an absurd number of paths on a small graph.',
          cause: 'Its bound mentions the flow value, so two huge capacities and one small one defeat it.',
          fix: 'Use Edmonds-Karp or Dinic, whose bounds mention only the graph.'
        },
        {
          symptom: 'Two implementations agree and both are wrong.',
          cause: 'They share the same residual bug; agreement is not a structural check.',
          fix: 'Verify capacity, conservation and the cut equality, all of which are independent of the algorithm.'
        },
        {
          symptom: 'A flow model gives a correct answer to the wrong question.',
          cause: 'The reduction — which vertices, which capacities, which terminals — was wrong.',
          fix: 'Check the reduction against a brute-force solution of the original problem on small instances.'
        }
      ],
      inTheWild: [
        { system: 'Image segmentation (GrabCut, graph cuts)', how: 'pixels as vertices, terminal arcs as evidence, neighbour arcs as smoothness' },
        { system: 'Bipartite scheduling and assignment', how: 'unit-capacity flow, where integrality makes the answer a matching' },
        { system: 'Network reliability and capacity planning', how: 'the minimum cut is the bottleneck set, and it is the deliverable' },
        { system: 'Baseball elimination and tournament feasibility', how: 'a flow model that saturates exactly when a team can still win' }
      ],
      sources: [
        { title: 'Maximal Flow through a Network', where: 'Ford, Fulkerson — Canadian Journal of Mathematics, 1956' },
        { title: 'Theoretical improvements in algorithmic efficiency for network flow problems', where: 'Edmonds, Karp — JACM, 1972' },
        { title: 'Algorithm for solution of a problem of maximum flow in networks with power estimation', where: 'Dinitz, 1970' },
        { title: 'Network Flows: Theory, Algorithms, and Applications', where: 'Ahuja, Magnanti, Orlin — Prentice Hall, 1993' }
      ]
    },

    'minimum-cut': {
      summary: 'The cut as the product rather than the by-product: image segmentation, maximum ' +
        'closure and Koenig\'s theorem are one construction, and the objective can rise the whole ' +
        'way while the answer improves.',
      intuition: 'An infinite-capacity arc is a constraint no finite cut can break, which is how a ' +
        'prerequisite becomes a piece of graph rather than a checker.',
      formulation: {
        equations: [
          {
            label: 'Segmentation as a cut',
            expr: 'minimise sum of unary disagreement + smoothness x boundary length',
            terms: [
              { sym: 'source arc', meaning: 'how much this pixel looks like foreground' },
              { sym: 'sink arc', meaning: 'how much it looks like background — a cut severs exactly one of the two' },
              { sym: 'neighbour arc', meaning: 'severed exactly when the two pixels end up on different sides' },
              { sym: 'measured', meaning: '8x8 image, 20% noise, smoothness 3: cut 159, 4 of 64 pixels wrong' }
            ]
          },
          {
            label: 'The smoothness sweep, 0 to 12',
            expr: 'the objective rises monotonically while the answer improves monotonically',
            terms: [
              { sym: 'cut capacity', meaning: '92 / 123 / 145 / 159 / 182 / 210 / 242' },
              { sym: 'misclassified', meaning: '10 / 8 / 5 / 4 / 2 / 0 / 0 — 15.6% down to 0.0%' },
              { sym: 'why', meaning: 'heavier neighbour arcs make every cut cost more; the model is not the truth' }
            ]
          },
          {
            label: 'Maximum closure (project selection)',
            expr: 'best profit = total positive profit − minimum cut',
            terms: [
              { sym: 'prerequisite', meaning: 'an arc of infinite capacity, so no finite cut violates it' },
              { sym: 'measured', meaning: '8 projects, seeds 1-5: positive 43/27/20/25/31, cut 3/5/8/7/4, realised 40/22/12/18/27' },
              { sym: 'checked', meaning: 'brute force over all 256 subsets agrees on all five' }
            ]
          },
          {
            label: 'Koenig',
            expr: 'on a bipartite graph, max matching = min vertex cover',
            terms: [
              { sym: 'measured', meaning: 'seeds 1-4 at 13/14/14/15 edges: matching 5/7/6/6 = cover 5/7/6/6' },
              { sym: 'not general', meaning: 'on a non-bipartite graph the equality fails and vertex cover is NP-hard' }
            ]
          },
          {
            label: 'Max-flow min-cut across five shapes at seed 2',
            expr: 'values 23 / 10 / 4 / 7 / 6, cut capacities identical',
            terms: [
              { sym: 'crossing arcs', meaning: '5 / 5 / 4 / 1 / 6' },
              { sym: 'all saturated', meaning: 'yes, on every shape' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Every arc crossing the cut is saturated and every arc entering the source side is empty',
          why: 'Otherwise the residual search that produced the set had not finished.',
          breaks: 'A set with slack across it is a cut with an inflated capacity, not a minimum one.'
        },
        {
          name: 'A prerequisite arc must be infinite, not merely large',
          why: 'Any finite value is a price somebody will pay, and the closure constraint stops being one.',
          breaks: 'A "large enough" constant produces closed sets on small instances and open ones on real data.'
        },
        {
          name: 'The reduction is checked against a brute-force solve of the original problem',
          why: 'A wrong reduction produces a valid cut and a plausible answer to the wrong question.',
          breaks: 'A sign error or a swapped terminal survives every test that only checks the flow.'
        },
        {
          name: 'A cut is a labelling only if every item has exactly one terminal arc',
          why: 'A pixel with no source arc can sit on either side for free and the labelling is undefined.',
          breaks: 'Silent, and shows up as an unstable segmentation that changes with the arc order.'
        }
      ],
      complexity: [
        { operation: 'minimum cut via maximum flow', average: 'the cost of the flow — Dinic O(V²E)', worst: '8x8 segmentation solves in one Dinic run' },
        { operation: 'segmentation network construction', average: 'Θ(pixels) arcs to the terminals + Θ(pixels) neighbour arcs', worst: '64 pixels give 64 + 64 + ~112 arcs' },
        { operation: 'maximum closure', average: 'one flow on n + 2 vertices', worst: '8 projects, brute-forced against 256 subsets' },
        { operation: 'Koenig cover extraction', average: 'O(V + E) — one alternating search', worst: 'free once the matching exists' },
        { operation: 'brute-force closure oracle', average: 'Θ(2^n · n)', worst: 'affordable to about 20 projects and no further' },
        { operation: 'cover validity check', average: 'Θ(E)', worst: 'one pass over the edges' }
      ],
      failureModes: [
        {
          symptom: 'A tuning parameter appears to hurt, because the reported objective rises.',
          cause: 'The objective is the model, and the model is not the quantity anyone cares about.',
          fix: 'Score against a held-out truth; report both numbers and expect them to disagree.'
        },
        {
          symptom: 'The chosen project set violates a prerequisite.',
          cause: 'The prerequisite arc has a finite capacity that the cut found worth paying.',
          fix: 'Use Infinity, or a value provably larger than the sum of all profits.'
        },
        {
          symptom: 'A vertex-cover routine gives wrong answers on some graphs.',
          cause: 'Koenig applies to bipartite graphs only; an odd cycle breaks the equality.',
          fix: 'Test bipartiteness first and fall back to an approximation or an exact solver.'
        },
        {
          symptom: 'Segmentation results change when the pixel iteration order changes.',
          cause: 'Ties in the model, or an item missing one of its two terminal arcs.',
          fix: 'Check that every item has both terminal arcs, and break ties explicitly.'
        }
      ],
      inTheWild: [
        { system: 'Interactive image segmentation', how: 'Boykov-Jolly and GrabCut both minimise exactly this energy by a graph cut' },
        { system: 'Open-pit mining and project scheduling', how: 'maximum closure is the standard formulation for which blocks to extract' },
        { system: 'Cloud placement and dependency selection', how: 'choosing a downward-closed set of services under a cost model' },
        { system: 'Network vulnerability analysis', how: 'the minimum cut names the links whose loss disconnects the service' }
      ],
      sources: [
        { title: 'Interactive Graph Cuts for Optimal Boundary and Region Segmentation', where: 'Boykov, Jolly — ICCV, 2001' },
        { title: 'Maximal closure of a graph and applications to combinatorial problems', where: 'Picard — Management Science, 1976' },
        { title: 'Graphok es matrixok', where: 'Denes Koenig, 1931 — the matching/cover equality' },
        { title: 'Algorithm Design, chapter 7', where: 'Kleinberg, Tardos — Addison-Wesley, 2005' }
      ]
    },

    'push-relabel': {
      summary: 'A preflow flooded from the source and repaired by local pushes, the height function ' +
        'that makes it terminate, and the two heuristics without which the textbook version is ' +
        'slower than Dinic.',
      intuition: 'It is the only algorithm here whose intermediate states are not flows, so ' +
        '"the value looks right" is a much weaker signal than usual.',
      formulation: {
        equations: [
          {
            label: 'The preflow and the height function',
            expr: 'push along (u,v) only if h(u) = h(v) + 1; relabel a stuck active vertex',
            terms: [
              { sym: 'excess', meaning: 'inflow − outflow, allowed to be positive at any vertex but s' },
              { sym: 'boundary', meaning: 'h(s) = n and h(t) = 0, held fixed' },
              { sym: 'termination', meaning: 'heights only rise and are bounded by 2n' },
              { sym: 'measured', meaning: '27 vertices: value 20, 50 relabels, 87 pushes (39 saturating, 48 not)' }
            ]
          },
          {
            label: 'The two heuristics, FIFO, on the default network',
            expr: 'they are not additive',
            terms: [
              { sym: 'gap + global', meaning: '50 relabels / 87 pushes / 1 030 arc visits — 7.38x' },
              { sym: 'gap only', meaning: '83 / 142 / 989 — 4.45x' },
              { sym: 'global only', meaning: '44 / 108 / 1 011 — 8.39x, and better than the pair' },
              { sym: 'neither', meaning: '369 / 719 / 4 433 — the textbook algorithm' }
            ]
          },
          {
            label: 'Selection rule, on the 14.1 network',
            expr: 'the rule changes the work and not the answer',
            terms: [
              { sym: 'FIFO', meaning: '41 relabels, 79 pushes, 760 arc visits — O(V³)' },
              { sym: 'highest-label', meaning: '35, 70, 627 — O(V²·sqrt(E))' }
            ]
          },
          {
            label: 'Against the augmenting-path family, same network',
            expr: 'Dinic wins here and push-relabel beats two of the four',
            terms: [
              { sym: 'arc visits', meaning: 'Ford-Fulkerson 607 · Edmonds-Karp 1 116 · Dinic 409 · scaling 1 164 · push-relabel 1 030 / 1 048' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'No vertex is left active when the run reports a value',
          why: 'An active vertex means the answer is a preflow, whose value is plausible and wrong.',
          breaks: 'A global relabel that abandons excess finishes with active vertices and a correct-looking number.'
        },
        {
          name: 'h(u) <= h(v) + 1 for every residual arc, excluding arcs out of the source',
          why: 'h(s) = n is a boundary condition; applying the general rule to it flags every correct run.',
          breaks: 'Weakening the check to make it pass removes the assertion that would have caught the real bug.'
        },
        {
          name: 'Heights never decrease',
          why: 'It is the entire termination argument, and it bounds the relabel count by 2n per vertex.',
          breaks: 'A "corrective" downward relabel makes the run cycle indefinitely.'
        },
        {
          name: 'Global relabelling assigns three groups, not two',
          why: 'Distance to t, n plus distance to s, and a common height for vertices in neither.',
          breaks: 'Setting the unreachable set to 2n abandons excess that must drain back to the source.'
        }
      ],
      complexity: [
        { operation: 'push-relabel, FIFO', average: 'O(V³)', worst: '41 relabels / 79 pushes / 760 arc visits on the 18-vertex network' },
        { operation: 'push-relabel, highest label', average: 'O(V²·sqrt(E))', worst: '35 / 70 / 627 on the same network' },
        { operation: 'gap heuristic', average: 'Θ(1) per test — one histogram lookup', worst: '23 of the 50 relabels in the default run are gap lifts' },
        { operation: 'global relabel', average: 'Θ(V + E) per pass', worst: '2 passes in the default run' },
        { operation: 'no heuristics', average: 'the same O(V³) bound', worst: '369 relabels / 4 433 arc visits — 7.4x the tuned version' },
        { operation: 'height validity check', average: 'Θ(V + E)', worst: 'run on every seed, rule and heuristic combination' }
      ],
      failureModes: [
        {
          symptom: 'The run finishes with the right value and a violated height invariant.',
          cause: 'Global relabelling set every vertex unreachable from t to 2n, stranding excess.',
          fix: 'Relabel in three groups; the correct value on most instances is what makes this hard to spot.'
        },
        {
          symptom: 'The height check fails on a provably correct implementation.',
          cause: 'The valid-labelling condition was applied to arcs out of the source.',
          fix: 'Exclude them; h(s) = n is a definition rather than a constraint.'
        },
        {
          symptom: 'Push-relabel is slower than Dinic and the conclusion is that it was overhyped.',
          cause: 'The gap and global-relabel heuristics were left out — they are 7.4x here.',
          fix: 'Implement both, then measure again; they are two short paragraphs after the pseudocode.'
        },
        {
          symptom: 'The reported flow value is right but a downstream consumer sees imbalance.',
          cause: 'The run returned a preflow, not a flow, because the active set was not drained.',
          fix: 'Assert that no vertex is active before returning, not merely that the value is stable.'
        }
      ],
      inTheWild: [
        { system: 'HIPR and the DIMACS flow implementations', how: 'highest-label push-relabel with both heuristics is the reference implementation' },
        { system: 'Computer-vision graph-cut libraries', how: 'push-relabel and Boykov-Kolmogorov are the two engines under every segmentation tool' },
        { system: 'Parallel and GPU maximum flow', how: 'push-relabel parallelises because pushes are local; augmenting paths do not' },
        { system: 'Scheduling and load balancing at scale', how: 'preflow methods dominate on very dense networks' }
      ],
      sources: [
        { title: 'A new approach to the maximum-flow problem', where: 'Goldberg, Tarjan — JACM, 1988' },
        { title: 'On implementing the push-relabel method for the maximum flow problem', where: 'Cherkassky, Goldberg — Algorithmica, 1997' },
        { title: 'An experimental comparison of min-cut/max-flow algorithms for energy minimization in vision', where: 'Boykov, Kolmogorov — PAMI, 2004' },
        { title: 'Network Flows: Theory, Algorithms, and Applications', where: 'Ahuja, Magnanti, Orlin — Prentice Hall, 1993' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));

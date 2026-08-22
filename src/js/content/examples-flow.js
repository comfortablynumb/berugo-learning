/** Worked examples for maximum flow, minimum cut and push-relabel (M14.1-M14.3). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'maximum-flow': [
      {
        title: 'Six algorithms, one network, and three checks on the answer',
        goal: 'Compute a maximum flow six ways, verify it structurally rather than by agreement, ' +
          'and read the certificate off the residual graph.',
        setup: 'A layered network of width 4 and 4 ranks at seed 1: 18 vertices, 39 arcs, ' +
          'capacities drawn up to 12.',
        steps: [
          {
            do: 'Run all six and compare the value.',
            why: 'Six independent derivations of one number is evidence, though not proof.',
            work: 'all six return 22',
            result: 'no disagreement to explain'
          },
          {
            do: 'Check capacity on every arc and conservation at every vertex.',
            why: 'Two implementations built from the same residual idea can share a mistake.',
            work: 'no arc over capacity and 0 vertices out of balance, in all six runs',
            result: 'a valid flow, checked without reference to any other run'
          },
          {
            do: 'Take everything still reachable from the source in the residual graph.',
            why: 'That set is one side of a cut, and every original arc leaving it must be full.',
            work: 'the cut crosses 8 arcs whose capacities sum to 22',
            result: 'the certificate matches the value exactly'
          },
          {
            do: 'Count the residual arcs.',
            why: 'The backward arcs are the algorithm, and they exist in no input file.',
            work: '54 residual arcs from 39 input arcs — 28 of them backward',
            result: 'more than half of the graph the algorithm searches was invented by it'
          },
          {
            do: 'Compare the work each one paid.',
            why: 'Equal answers, unequal cost, and the cost is where the choice lives.',
            work: 'Ford-Fulkerson 13 paths / 576 arc visits · Edmonds-Karp 10 / 647 · Dinic 10 ' +
              'paths in 1 phase / 247 · capacity scaling 8 / 832 · push-relabel FIFO 41 relabels ' +
              'and 79 pushes / 760 · highest-label 35 and 70 / 627',
            result: 'a 3.4× spread in arc visits on identical input'
          }
        ],
        answer: '22, from six algorithms, verified three ways: capacity, conservation, and a cut of ' +
          'capacity 22 crossing 8 saturated arcs. The number worth remembering is 28 — the count of ' +
          'backward residual arcs on a 39-arc network. More than half the graph these algorithms ' +
          'search does not exist in the input, and the next example shows what happens without it.'
      },
      {
        title: 'The four-vertex network where path filling is wrong rather than slow',
        goal: 'Show that removing the residual back edge does not degrade the algorithm gracefully; ' +
          'it breaks it, silently, by one unit in two thousand.',
        setup: 'Four vertices: two arcs of capacity 1 000 out of the source, two of 1 000 into the ' +
          'sink, and one arc of capacity 1 across the middle. Then twenty random layered networks.',
        steps: [
          {
            do: 'Run a depth-first path search with no backward arcs.',
            why: 'This is what everybody writes first, and it terminates and reports success.',
            work: '1 999 in 3 paths',
            result: 'a plausible number, one unit short'
          },
          {
            do: 'Run the same search with residual arcs.',
            why: 'The only difference is the permission to reroute an earlier bad choice.',
            work: '2 000 in 2 paths',
            result: 'correct, and in fewer paths'
          },
          {
            do: 'Work out what the greedy did.',
            why: 'The failure has to be explicable or it is folklore.',
            work: 'the first path takes the middle arc, using 1 of the 1 000 available on each ' +
              'side; the 999 units stranded on each side have no arc to move along',
            result: 'a local maximum with no escape'
          },
          {
            do: 'Ask whether the example had to be arranged.',
            why: 'A contrived failure is a curiosity; a common one is a bug.',
            work: 'on 20 random layered networks the greedy falls short on 2, worst shortfall 9.5%',
            result: 'one instance in ten, with no adversary'
          },
          {
            do: 'Scale the capacities and watch the path counts.',
            why: 'The augmenting-path algorithms differ in what bounds them.',
            work: 'capacities 1 / 4 / 16 / 64 / 256 give values 4 / 10 / 29 / 103 / 403, ' +
              'Ford-Fulkerson 4 / 9 / 14 / 16 / 14 paths, Edmonds-Karp 4 / 9 / 9 / 13 / 13, ' +
              'Dinic 1 phase throughout, scaling 1 / 3 / 5 / 7 / 8 rounds',
            result: 'Dinic is bounded by the shape and scaling by log2 of the largest capacity'
          }
        ],
        answer: '1 999 against 2 000 — and 2 of 20 random networks short by up to 9.5%. The lesson ' +
          'is not the four-vertex example, which everybody has seen; it is that the same failure ' +
          'occurs on inputs nobody arranged, and that the wrong answer is a valid flow with a ' +
          'plausible value. Only the cut check, or a second implementation, distinguishes them.'
      }
    ],

    'minimum-cut': [
      {
        title: 'Segmenting an image, and the objective that rises while the answer improves',
        goal: 'Build a labelling problem as a cut, then watch the model and the truth disagree ' +
          'about whether a parameter is helping.',
        setup: 'An 8×8 image, 20% of pixels flipped by noise, with a ground truth the generator ' +
          'keeps. Each pixel gets a source arc and a sink arc; each neighbouring pair gets an arc ' +
          'weighted by the smoothness parameter.',
        steps: [
          {
            do: 'Run the cut at smoothness 3.',
            why: 'The cut severs exactly one of the two terminal arcs per pixel, so it is a labelling.',
            work: 'cut capacity 159, equal to the maximum flow',
            result: 'a complete labelling of all 64 pixels'
          },
          {
            do: 'Compare it against the ground truth the generator kept.',
            why: 'The cut minimises the model; only the truth says whether the model was any good.',
            work: '4 of 64 pixels misclassified — 6.3%',
            result: 'the noise is mostly suppressed'
          },
          {
            do: 'Sweep the smoothness from 0 to 12 and read the cut capacity.',
            why: 'Heavier neighbour arcs make every cut more expensive.',
            work: '92, 123, 145, 159, 182, 210, 242',
            result: 'the objective rises monotonically'
          },
          {
            do: 'Read the misclassification count over the same sweep.',
            why: 'This is the quantity anyone actually cares about.',
            work: '10, 8, 5, 4, 2, 0, 0 — from 15.6% to 0.0%',
            result: 'the answer improves monotonically while the objective worsens'
          }
        ],
        answer: 'At smoothness 3 the cut is 159 and 4 of 64 pixels are wrong; at smoothness 12 the ' +
          'cut is 242 and none are. The objective and the outcome move in opposite directions for ' +
          'the whole sweep. Anybody tuning this by watching the solver\'s reported cost would ' +
          'conclude the smoothness term was harmful — which is the general hazard of optimisation: ' +
          'the number the solver reports is the number the modeller chose.'
      },
      {
        title: 'The same cut, twice more: project selection and vertex cover',
        goal: 'Show that two problems with nothing visibly in common are the same construction, and ' +
          'check both against exhaustive search.',
        setup: 'Eight projects with profits from −8 to 12 and eight prerequisite links, at seeds 1 ' +
          'to 5; then four bipartite graphs of 13 to 15 edges.',
        steps: [
          {
            do: 'Wire each profitable project to the source and each costly one to the sink, and ' +
              'give every prerequisite an arc of infinite capacity.',
            why: 'No finite cut can sever an infinite arc, so any finite cut respects prerequisites.',
            work: 'total positive profit across the five seeds: 43, 27, 20, 25, 31',
            result: 'the constraint is enforced by the structure, not by a checker'
          },
          {
            do: 'Take the total positive profit minus the minimum cut.',
            why: 'Cutting a source arc declines a profit; cutting a sink arc pays a cost.',
            work: 'cuts of 3, 5, 8, 7, 4 give realised profits of 40, 22, 12, 18, 27, taking 5, 7, ' +
              '4, 4 and 7 projects',
            result: 'a maximum-profit closed set from a flow computation'
          },
          {
            do: 'Enumerate every subset and check closure by hand.',
            why: 'A reduction can be wrong while producing perfectly valid-looking output.',
            work: 'brute force over all 256 subsets agrees on all five seeds',
            result: 'the reduction is checked rather than argued'
          },
          {
            do: 'Now run the bipartite construction and read Koenig\'s cover off the cut.',
            why: 'Minimum vertex cover is NP-hard in general and a flow problem on a bipartite graph.',
            work: 'four seeds at 13, 14, 14, 15 edges give matchings of 5, 7, 6, 6 and covers of ' +
              '5, 7, 6, 6, every cover verified against every edge',
            result: 'two equal numbers computed two different ways'
          },
          {
            do: 'Check max-flow min-cut across five unrelated network shapes.',
            why: 'The theorem is the reason any of this is allowed.',
            work: 'values 23, 10, 4, 7, 6 with identical cut capacities and 5, 5, 4, 1, 6 crossing ' +
              'arcs, every one saturated',
            result: 'the certificate holds on every shape'
          }
        ],
        answer: 'Five project instances at 40, 22, 12, 18 and 27 realised profit, all confirmed by ' +
          'exhaustive search, and four vertex covers matching their matchings exactly. Three ' +
          'sentences that share no vocabulary — segment this image, fund these projects, cover these ' +
          'edges — compile to the same twenty lines. The modelling is the work; the solver is a ' +
          'library call.'
      }
    ],

    'push-relabel': [
      {
        title: 'Flooding first and repairing afterwards',
        goal: 'Run push-relabel on a network the augmenting-path family already solved, and check ' +
          'the three things that distinguish a flow from a preflow.',
        setup: 'A layered network of width 5 and 5 ranks at seed 1: 27 vertices. FIFO selection ' +
          'with both heuristics on.',
        steps: [
          {
            do: 'Saturate every arc out of the source and set h(s) = n.',
            why: 'The algorithm starts by violating conservation everywhere on purpose.',
            work: '27 vertices, the source lifted to height 27',
            result: 'a preflow, not a flow'
          },
          {
            do: 'Push and relabel until no vertex is active, then read the value.',
            why: 'A run that stops early returns a preflow whose value looks entirely reasonable.',
            work: 'value 20, and Dinic agrees',
            result: 'the same answer by a completely different route'
          },
          {
            do: 'Check the height invariant and the active set.',
            why: 'These are the two things a wrong answer would not satisfy.',
            work: '50 relabels of which 23 are gap lifts, 87 pushes of which 39 saturate and 48 do ' +
              'not, heights valid, nothing still active',
            result: 'a flow, confirmed structurally'
          },
          {
            do: 'Switch the selection rule to highest-label on the 14.1 network.',
            why: 'The rule changes the work and not the answer.',
            work: 'FIFO 41 relabels and 79 pushes at 760 arc visits; highest-label 35 and 70 at 627',
            result: 'the same 22, at 82% of the arc visits'
          }
        ],
        answer: 'Value 20, agreeing with Dinic, at 50 relabels and 87 pushes with no vertex left ' +
          'active and every height valid. The distinctive thing about push-relabel is that its ' +
          'intermediate states are not flows at all, so "the value looks right" is a much weaker ' +
          'signal here than it is for an augmenting-path algorithm — the assertion that nothing is ' +
          'still active is doing real work.'
      },
      {
        title: 'Pricing the two heuristics, including the one that costs the other',
        goal: 'Measure what gap and global relabelling are worth separately and together, and ' +
          'report the result that a benchmark would be tempted to hide.',
        setup: 'The same 27-vertex layered network, FIFO selection, with each of the four ' +
          'combinations of the two heuristics.',
        steps: [
          {
            do: 'Run with neither heuristic — the textbook algorithm.',
            why: 'This is what an implementation written from the pseudocode does.',
            work: '369 relabels, 719 pushes, 4 433 arc visits',
            result: 'the baseline, and it is a disappointment'
          },
          {
            do: 'Turn on the gap heuristic alone.',
            why: 'An empty bucket in the height histogram proves everything below it is stranded.',
            work: '83 relabels, 142 pushes, 989 arc visits — 4.45× fewer relabels',
            result: 'a histogram lookup replaces a quadratic rediscovery'
          },
          {
            do: 'Turn on global relabelling alone.',
            why: 'A reverse breadth-first search from the sink replaces every estimate with the truth.',
            work: '44 relabels, 108 pushes, 1 011 arc visits — 8.39× fewer relabels',
            result: 'the single biggest win available'
          },
          {
            do: 'Turn on both.',
            why: 'The obvious expectation is that two wins compose.',
            work: '50 relabels, 87 pushes, 1 030 arc visits — 7.38× against neither, and *worse* ' +
              'than global relabelling alone',
            result: 'they are not additive'
          },
          {
            do: 'Compare the tuned run against the whole augmenting-path family on one network.',
            why: '"Push-relabel is the fast modern one" is a claim that should be measured.',
            work: 'Ford-Fulkerson 607 arc visits, Edmonds-Karp 1 116, Dinic 409, capacity scaling ' +
              '1 164, push-relabel 1 030 and 1 048',
            result: 'Dinic wins on this network, and push-relabel beats two of the four'
          }
        ],
        answer: '369 relabels untuned against 50 tuned — but 44 with global relabelling alone, which ' +
          'is fewer than the pair. A gap lift raises vertices to heights the next global pass then ' +
          'corrects, so one heuristic does negative work in the presence of the other. Reporting ' +
          'only the combined 7.38× would have concealed that, and the ranking between the two is ' +
          'instance-dependent rather than settled.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));

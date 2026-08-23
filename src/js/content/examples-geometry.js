/** Worked examples for primitives, polygons and convex hulls (M16.1-M16.3). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'geometry-primitives': [
      {
        title: 'Six orderings of one triple, and the two ways to fail',
        goal: 'Ask the same three points the same question six times, and rank three predicates ' +
          'without ever needing to know the right answer.',
        setup: 'One near-collinear triple built from full-mantissa coordinates, with the third point ' +
          'lifted one unit in the last place off the line through the other two.',
        steps: [
          {
            do: 'Read the floating-point determinant for the triple as written.',
            why: 'It is the number every naive implementation takes the sign of.',
            work: 'the determinant reads 4.441e-16, and the exact answer is a left turn (+1)',
            result: 'the value is inside its own rounding error, so the sign is not information yet'
          },
          {
            do: 'Ask the naive test all six orderings — three rotations, then three swaps.',
            why: 'Rotations must agree with each other; swaps must give the opposite answer.',
            work: 'rotations answer left (+1), collinear (0), left (+1)',
            result: 'it contradicts itself on the first fixture, with no adversary involved'
          },
          {
            do: 'Ask the tolerance test the same six, with epsilon at 1e-12.',
            why: 'This is the fix everybody reaches for first.',
            work: 'all six answer collinear (0) — perfectly consistent',
            result: 'consistent and wrong: these points are not collinear'
          },
          {
            do: 'Ask the adaptive predicate the same six.',
            why: 'The filter refuses to answer here, so the exact path decides it.',
            work: 'left (+1) three times and right (−1) three times',
            result: 'consistent and correct — the only one of the three that is both'
          },
          {
            do: 'Run all three over 4 000 near-collinear triples and count two columns separately.',
            why: 'Self-contradiction and wrongness are different failures and rank the three differently.',
            work: 'naive 1 121 contradictions and 642 wrong; epsilon 0 and 4 000; adaptive 0 and 0',
            result: 'the epsilon test scores best on the column people check and worst on the one that matters'
          }
        ],
        answer: 'The tolerance test is not a compromise between the other two — it is a third, ' +
          'different failure. It never contradicts itself and it is wrong on every one of the 4 000 ' +
          'triples, calling a real turn collinear 4 000 times where the naive test does it 0 times. ' +
          'The naive test fails loudly, which is the better of the two: a hull that loops gets ' +
          'debugged, and a hull that quietly drops real vertices ships.'
      },
      {
        title: 'What the robust predicate actually costs',
        goal: 'Measure how often the exact path runs, on data that is adversarial and on data that ' +
          'is not, and settle whether robustness is a performance trade.',
        setup: 'The same adaptive predicate, run over 4 000 ordinary points and then over 4 000 ' +
          'triples constructed to sit inside the filter\'s error bound.',
        steps: [
          {
            do: 'Count predicate calls and escalations on ordinary points.',
            why: 'This is the input a real program has almost all of the time.',
            work: '4 000 calls, 0 escalated to exact — a rate of 0.00%',
            result: 'the slow path did not run once'
          },
          {
            do: 'Count the same two numbers on the adversarial triples.',
            why: 'This is the input the filter exists for.',
            work: '4 000 calls, 2 507 escalated — 62.67%',
            result: 'the filter refuses to answer for most of them, which is the point'
          },
          {
            do: 'Check what the exact path decided for those 2 507 refusals.',
            why: 'A filter that escalates is only useful if the escalation is right.',
            work: '0 contradictions and 0 wrong answers across the whole sweep',
            result: 'every refused triple got the true sign'
          },
          {
            do: 'Compare against the alternative on the same adversarial set.',
            why: 'The cost has to be read against what it buys.',
            work: 'the naive test is free and wrong 642 times; the epsilon test is free and wrong 4 000 times',
            result: 'the trade is not speed against correctness on your data'
          }
        ],
        answer: 'On ordinary data the measured cost of robustness is one comparison against a ' +
          'computed error bound and nothing else: 0 of 4 000 calls escalated. The exact path is ' +
          'paid for only on the triples where the fast answer would have been a coin flip, and there ' +
          'it is not a slowdown, it is the difference between an answer and a wrong answer. If the ' +
          'coordinates can be integers instead, the fast path is already exact and the question does ' +
          'not arise.'
      }
    ],

    'polygon-containment': [
      {
        title: 'The pentagram centre, where two correct rules disagree',
        goal: 'Find a point that is inside by one containment rule and outside by the other, and ' +
          'establish that neither implementation is wrong.',
        setup: 'A five-pointed star drawn as a single self-crossing ring, probed on a 21 by 21 grid ' +
          'of 441 points with ray casting and the winding number run side by side.',
        steps: [
          {
            do: 'Compute the signed area with the shoelace sum.',
            why: 'The sign is the ring\'s orientation, which both rules depend on.',
            work: '3 600.00, wound counter-clockwise',
            result: 'a well-defined ring, whatever its self-crossings'
          },
          {
            do: 'Probe the centre with both rules and record the intermediate counts, not just the verdicts.',
            why: 'The verdicts differ; the counts explain why.',
            work: '2 ray crossings and a winding number of 2',
            result: 'even parity says outside, non-zero winding says inside'
          },
          {
            do: 'Count the disagreements over the whole grid.',
            why: 'One disagreeing point could be a boundary artefact; a region cannot.',
            work: '44 of 441 probes disagree — 10.0%',
            result: 'the whole central pentagon, not a rounding edge case'
          },
          {
            do: 'Probe the eight-vertex star, which traces the same outline without crossing itself.',
            why: 'It isolates the crossing as the cause rather than the shape.',
            work: '8 vertices, an area of 1 980.0, simple, and 0 disagreeing probes',
            result: 'the same silhouette drawn as a simple ring never disagrees'
          }
        ],
        answer: 'Both implementations counted correctly. The ring encircles its centre twice, so the ' +
          'crossing count is even while the signed winding is 2, and the two rules were only ever ' +
          'the same function on polygons that do not do this. The polygon does not carry the answer ' +
          '— the fill rule does. SVG names it as a property and defaults to non-zero; the simple ' +
          'feature model used by spatial databases declares the ring invalid and leaves the ' +
          'behaviour undefined.'
      },
      {
        title: 'Which polygons can disagree at all',
        goal: 'Separate the shapes where the two rules can differ from the shapes where they ' +
          'provably cannot, and find the counterexample to the obvious rule.',
        setup: 'Eight fixture polygons from 4 to 12 vertices — square, L-shape, comb, chevron, star, ' +
          'pentagram, bowtie and spiky — each probed on the same grid.',
        steps: [
          {
            do: 'Run every simple polygon through the probe grid.',
            why: 'On a simple polygon the two rules are provably the same function.',
            work: '6 simple polygons, 0 disagreeing probes between them',
            result: 'as required — a disagreement there would be an implementation bug'
          },
          {
            do: 'Identify the polygons that are not simple.',
            why: 'Self-intersection is the necessary condition.',
            work: '2 of 8: the pentagram with 5 self-intersections, and the bowtie',
            result: 'two candidates for a disagreement'
          },
          {
            do: 'Probe the bowtie.',
            why: 'It crosses itself, so the obvious rule predicts a disagreement.',
            work: '0 disagreeing probes, and a signed area of 0.0 from its two cancelling lobes',
            result: 'the obvious rule is wrong'
          },
          {
            do: 'Say what the pentagram has that the bowtie does not.',
            why: 'The real condition is stronger than self-intersection.',
            work: 'the pentagram encircles its centre 2 times; each bowtie lobe is encircled once',
            result: 'a region wound twice is the actual requirement'
          },
          {
            do: 'Check convexity while the fixtures are loaded.',
            why: 'The pentagram tests a second assumption at the same time.',
            work: 'all 5 of the pentagram\'s turns go the same way, and it is not convex',
            result: 'consistent turn direction is necessary and not sufficient'
          }
        ],
        answer: 'Self-intersection is necessary for a disagreement and not sufficient: 1 of the 2 ' +
          'non-simple fixtures produces one. The condition is a region the ring goes round twice, ' +
          'which the pentagram has and the bowtie does not. The same fixture also breaks the usual ' +
          'convexity test — its turns all agree, but the boundary turns through two full ' +
          'revolutions rather than one, and code that trusts a sign-only convexity check will clip, ' +
          'measure and index it wrongly.'
      }
    ],

    'convex-hulls': [
      {
        title: 'One hull, four bills',
        goal: 'Compute the same hull four ways and compare what each algorithm spent, given that ' +
          'the answer is unique and so the only variable is cost.',
        setup: '200 uniform points, hulled by monotone chain, gift wrapping, Graham scan and ' +
          'quickhull, with orientation tests and sort comparisons counted separately.',
        steps: [
          {
            do: 'Run all four and compare the returned rings.',
            why: 'The hull is unique, so any disagreement is a bug rather than a policy difference.',
            work: '4 of 4 returned the identical 12-vertex hull from 200 points',
            result: 'a shared answer to compare costs against'
          },
          {
            do: 'Read the orientation-test column.',
            why: 'That is the predicate every one of them is really paying for.',
            work: '789 for monotone chain, 1 314 quickhull, 1 651 Graham, 2 400 gift wrapping',
            result: 'a 3.04× spread from the cheapest to the dearest'
          },
          {
            do: 'Read the sort-comparison column beside it.',
            why: 'Two of the four do no sorting at all, and pay elsewhere.',
            work: '1 262 and 1 253 comparisons for the two sorting algorithms, 0 for the other two',
            result: 'gift wrapping and quickhull trade the sort for more predicate calls'
          },
          {
            do: 'Run the oracle on every result.',
            why: 'Agreement between four implementations is not correctness if all four are wrong.',
            work: 'every input point inside or on the ring, and no reflex vertex: 4 of 4 pass',
            result: 'the hull is right, not merely agreed upon'
          },
          {
            do: 'Count how much of the input survives.',
            why: 'The hull is also a summary, and its size is what makes it composable.',
            work: '12 of 200 points are on the hull — 6.0%',
            result: 'a second pass over merged chunks works on 6% of the data'
          }
        ],
        answer: 'The monotone chain wins this scene at 789 orientation tests against gift wrapping\'s ' +
          '2 400, and it wins the implementation on top of that: a lexicographic sort any language ' +
          'gets right, two identical sweeps, and no angular comparator, no pivot special case and no ' +
          'trigonometry. That is why it is the default worth memorising, and why the other three are ' +
          'worth understanding rather than writing.'
      },
      {
        title: 'Where output-sensitivity wins, and the degenerate sets that decide correctness',
        goal: 'Find the input where gift wrapping is the right choice and the input where it is a ' +
          'disaster, then check every algorithm on the sets that break implementations.',
        setup: '1 024 points arranged first as a cloud and then on a circle, followed by five ' +
          'degenerate sets of 60 points each run under both collinear policies.',
        steps: [
          {
            do: 'Hull the 1 024-point cloud and count hull vertices.',
            why: 'Gift wrapping costs one full scan per hull vertex.',
            work: '16 hull vertices, so gift wrapping does 16 384 orientation tests',
            result: 'a small h makes the O(n·h) bound the better one'
          },
          {
            do: 'Hull 1 024 points on a circle instead.',
            why: 'Now every input point is a hull vertex.',
            work: '1 024 hull vertices and 1 047 552 orientation tests — 63.9× the cloud',
            result: 'the same n, and the bound has become a liability'
          },
          {
            do: 'Read the monotone chain on the same two inputs.',
            why: 'Its cost depends on n alone, so it should barely move.',
            work: '4 077 tests on the cloud against 4 090 on the circle',
            result: 'a 0.3% difference where gift wrapping saw 63.9×'
          },
          {
            do: 'Run the five degenerate sets under the drop-collinear policy and then the keep policy.',
            why: 'Points exactly on a hull edge are where implementations diverge.',
            work: 'collinear 2 against 60; grid 5 against 24; coincident 6 against 8; circle 60 against 60',
            result: 'the policy changes the answer by up to 30× on the same points'
          },
          {
            do: 'Require all four algorithms to agree on every degenerate set, under both policies.',
            why: '"Each computes a convex hull" is a weaker contract and lets a surprise through.',
            work: '5 of 5 sets agree across all 4 algorithms under both policies',
            result: 'the contract downstream code actually needs'
          }
        ],
        answer: 'Output-sensitivity is a bet on h, and it should be written down as one: 16 384 tests ' +
          'against 1 047 552 from the same 1 024 points, decided entirely by the shape of the cloud. ' +
          'The collinear policy is the other undocumented parameter — it is one character in the ' +
          'comparison, it changes a 60-point collinear set from a 2-vertex segment to a 60-vertex ' +
          'run, and downstream code for area, calipers and rendering breaks differently depending on ' +
          'which was picked.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));

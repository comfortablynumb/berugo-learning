/** Worked examples for solvers, hardness in practice and the workshop (M20.7-M20.9). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'using-solvers': [
      {
        title: 'Six models of one schedule, and the six unit clauses worth more than all of them',
        goal: 'Separate the two effects an encoding decision can have — formula size and search ' +
          'shape — by measuring both on one instance.',
        setup: '18 tasks with 60 conflicts plus a group of 7 that mutually conflict, asked for 6 ' +
          'slots, so the answer is NO and the solver must prove it.',
        steps: [
          {
            do: 'Confirm the answer with a hand-written backtracking colourer.',
            why: 'Every model has to agree with something that used no encoding at all.',
            work: '327 steps, no assignment found',
            result: 'NO — and all six models must match this'
          },
          {
            do: 'Build the model three ways and read the sizes.',
            why: 'The clause count is arithmetic and it is the memory bound.',
            work: 'pairwise 108 variables / 720 clauses, commander 144 / 720, sequential 198 / 702',
            result: 'the sequential encoding is smallest in clauses and largest in variables'
          },
          {
            do: 'Solve all three and compare the node counts.',
            why: 'This is where the expected difference should appear.',
            work: '1 439 nodes for all three; propagations 18 010, 21 923 and 21 150',
            result: 'identical search, different propagation — this DPLL cannot show the difference'
          },
          {
            do: 'Add six unit clauses fixing the conflicting group to slots 1 to 6.',
            why: 'Those tasks need distinct slots anyway, so this rules out nothing.',
            work: '726 clauses instead of 720; 1 node instead of 1 439',
            result: 'a factor of 1 439, for six clauses'
          },
          {
            do: 'Price at-most-one over a group of 2 000 literals.',
            why: 'The encoding choice that does not matter here matters enormously at scale.',
            work: 'at 100 literals pairwise is 4 950 clauses, commander 350 and sequential ' +
              '296; at 2 000 they are 1 999 000, 6 999 and 5 996',
            result: '333× — the number that decides whether a model fits in memory'
          }
        ],
        answer: 'Two effects of completely different sizes. The at-most-one encoding changes the ' +
          'clause count by a factor of 333 at scale and, on this solver, changes the node count ' +
          'not at all — because DPLL branches on the first unassigned variable and every ' +
          'auxiliary variable is numbered after every decision variable. Symmetry breaking ' +
          'changes the node count by a factor of 1 439 for six unit clauses. If you have time to ' +
          'do one thing to a model, break the symmetry; the encoding choice is a memory decision ' +
          'with a known crossover around twenty literals.'
      },
      {
        title: 'The inverted case: sweep the slot count and watch a factorial appear in the measurement',
        goal: 'Show that the search cost on the unsatisfiable side is a permutation count, which ' +
          'is what makes symmetry breaking obvious rather than clever.',
        setup: 'The same instance with a group of 7 mutually conflicting tasks, asked for 3 up to ' +
          '8 slots, with and without symmetry breaking.',
        steps: [
          {
            do: 'Ask for 3 slots and record the cost.',
            why: 'Far below the boundary, where refutation should be cheap.',
            work: '11 nodes without symmetry breaking, 1 with',
            result: '11 = 2 × 3! − 1'
          },
          {
            do: 'Ask for 4 and 5 slots.',
            why: 'Two more points to see whether the pattern is a pattern.',
            work: '47 and 239 nodes',
            result: '2 × 4! − 1 = 47 and 2 × 5! − 1 = 239'
          },
          {
            do: 'Ask for 6 slots, one below the group size.',
            why: 'The last unsatisfiable row, and the most expensive.',
            work: '1 439 nodes, 720 conflicts',
            result: '2 × 6! − 1 = 1 439 and 6! = 720 — exact at every row'
          },
          {
            do: 'Ask for 7 and 8 slots, where the answer becomes YES.',
            why: 'A search that finds an answer never explores the symmetric copies.',
            work: '17 and 19 nodes plain, 12 with symmetry breaking',
            result: 'the effect nearly vanishes above the boundary'
          }
        ],
        answer: 'Every unsatisfiable row costs exactly 2·c! − 1 nodes and produces exactly c! ' +
          'conflicts, which is the solver enumerating assignments of the conflicting group to ' +
          'slots one permutation at a time. Recognising a factorial in a measurement is what ' +
          'makes the fix obvious. Above the boundary the effect nearly disappears — 19 nodes ' +
          'against 12 — because a search that finds an answer stops before it has to refute the ' +
          'symmetric copies, which is why symmetry breaking is a technique for the NO side.'
      }
    ],

    'hardness-in-practice': [
      {
        title: 'Find the hardness peak by measurement rather than by quoting 4.27',
        goal: 'Sweep the clause ratio with many seeds per point and read where the satisfiable ' +
          'fraction crosses one half and where the cost peaks.',
        setup: '44 variables, 60 independent formulas per ratio, ratios from 1 to 8.',
        steps: [
          {
            do: 'Solve 60 formulas at ratio 1 and at ratio 8.',
            why: 'Establish that both ends are easy, for opposite reasons.',
            work: 'ratio 1: 100% satisfiable, median 10 nodes. ratio 8: 0% satisfiable, median 53',
            result: 'cheap at both ends'
          },
          {
            do: 'Find where the satisfiable fraction crosses one half.',
            why: 'This is the transition the literature names.',
            work: '86.7% at ratio 4.00 and 41.7% at ratio 4.50, interpolating to 4.38',
            result: '4.38 at this size, against an asymptotic 4.27'
          },
          {
            do: 'Find where the median cost peaks.',
            why: 'The two are not the same point at finite size.',
            work: 'medians 134, 256, 313, 247 at ratios 4.00, 4.27, 4.50 and 5.00, with a ' +
              'worst of 931 at the peak',
            result: 'the peak is at 4.50, slightly above the satisfiability crossover'
          },
          {
            do: 'Compare the median against the mean at each ratio.',
            why: 'A heavy tail makes them disagree, and the disagreement is the signal.',
            work: 'ratio 3: median 20, mean 29.6, worst 255 — a spread of 12.8×',
            result: 'the mean is dragged by runs nobody would wait for'
          }
        ],
        answer: 'At 44 variables the crossover is at ratio 4.38 and the cost peaks at 4.50, both ' +
          'measured rather than quoted; the asymptotic 4.27 is what these drift towards as n ' +
          'grows. The rise and fall is the point: 10 nodes at ratio 1, 313 at the peak, 53 at ' +
          'ratio 8. Anybody generating "random test instances" outside that band is generating ' +
          'instances that are easy for a structural reason, and a benchmark built from them ' +
          'measures nothing about the solver.'
      },
      {
        title: 'The inverted case: restarts help, and the wrong cutoff makes things four times worse',
        goal: 'Measure the runtime distribution of a stochastic solver on ONE instance and find ' +
          'the cutoff that helps — and the one that does not.',
        setup: 'A planted 3-SAT instance on 100 variables at ratio 4.2, solved by WalkSAT from ' +
          '40 seeds, with a 40 000-flip overall cap.',
        steps: [
          {
            do: 'Run 40 seeds with no restarts and describe the distribution.',
            why: 'One number cannot describe a heavy-tailed sample.',
            work: 'median 1 125 flips, mean 1 582, 90th percentile 3 724, worst 6 060',
            result: 'a spread of 5.4× between the worst and the median'
          },
          {
            do: 'Restart every 1 000 flips.',
            why: 'A cutoff above the median should cut the tail without cutting the body.',
            work: 'median 1 192, mean 1 314, 90th percentile 2 836, worst 5 252, 37 restarts',
            result: 'the mean falls 17% and the 90th percentile falls 24%'
          },
          {
            do: 'Restart every 3 000 flips.',
            why: 'A cutoff far above the median should do almost nothing.',
            work: 'mean 1 566 against 1 582, with 7 restarts in 40 runs',
            result: 'no harm and almost no benefit'
          },
          {
            do: 'Restart every 100 flips.',
            why: 'A cutoff below the median abandons every attempt just short of finishing.',
            work: '2 666 restarts, median 4 670, mean 6 747, worst 20 384',
            result: '4.3× worse than doing nothing at all'
          }
        ],
        answer: 'Restarts are not a free improvement: the cutoff is the whole design and it has ' +
          'to come from the measured distribution. A cutoff of 1 000 — comfortably above the ' +
          'median of 1 125 but below the tail — takes the mean from 1 582 to 1 314 and the 90th ' +
          'percentile from 3 724 to 2 836 while barely moving the median, which is exactly the ' +
          'shape of a tail being cut. A cutoff of 100 takes 2 666 restarts to do the same work ' +
          'and makes the mean 4.3× worse. That is the failure mode of choosing a timeout that ' +
          'feels responsive rather than one the data supports.'
      }
    ],

    'reduction-workshop': [
      {
        title: 'Model a roster, solve it, and check it against every stated requirement',
        goal: 'Run the whole pipeline and produce the artefact that makes it trustworthy — a ' +
          'per-requirement verdict on the answer.',
        setup: '9 nurses, 7 days, three shifts needing 2, 2 and 1 nurses, at most 5 shifts each, ' +
          'and a rest day in every window of 4.',
        steps: [
          {
            do: 'Encode the five requirements and read what each cost.',
            why: 'The cheap-sounding requirements are usually the expensive ones.',
            work: '189, 3 171, 54, 1 935 and 2 664 clauses, for 8 013 in total',
            result: '3 789 variables, of which 3 600 are counters the encoding introduced'
          },
          {
            do: 'Solve it.',
            why: 'This is the only step that is somebody else’s code.',
            work: '4 707 search nodes, 813 ms',
            result: 'satisfiable, with an assignment of 3 789 variables'
          },
          {
            do: 'Decode the assignment into a grid of 9 nurses by 7 days.',
            why: 'A roster is what the requirement was about; an assignment is not.',
            work: '63 cells, each a shift or a rest day',
            result: 'a schedule that looks like a schedule'
          },
          {
            do: 'Check each requirement against the GRID, with code the encoder did not write.',
            why: 'A checker derived from the model would agree with a wrong model.',
            work: 'count nurses per shift, count shifts per nurse, look for a day shift after a ' +
              'night, count rest days in each window of 4',
            result: '5 of 5 hold, with 0 failures each'
          },
          {
            do: 'Report what the model does NOT say.',
            why: 'A solver answering yes is not the same as a roster anybody would accept.',
            work: 'shifts per nurse 5, 5, 5, 5, 5, 4, 2, 2, 2 — a spread of 3',
            result: 'every hard constraint satisfied, and the workload is not shared'
          }
        ],
        answer: 'The pipeline produced a valid roster in 813 milliseconds and the validator ' +
          'confirmed all five requirements against the grid itself. The interesting output is ' +
          'the last row: five nurses work five shifts and three work two, which satisfies every ' +
          'constraint in the model and is not what anybody means by a fair roster. That is the ' +
          'gap the section is about — the model is correct and incomplete, and only reporting ' +
          'the preference numbers alongside the verdicts makes the incompleteness visible.'
      },
      {
        title: 'The inverted case: two infeasible instances, and the solver can only prove one of them',
        goal: 'Show that "no answer" arrives in two forms that look identical to the caller and ' +
          'mean completely different things.',
        setup: 'The same model at 6 days with demand 2, 1, 1 and a cap of 4 shifts, swept over 4 ' +
          'to 8 nurses with a 40 000-node budget.',
        steps: [
          {
            do: 'Count capacity against demand at each size.',
            why: 'A one-line argument any reader can check, before any solver runs.',
            work: '24 shifts are required; capacity is 16, 20, 24, 28 and 32',
            result: '4 and 5 nurses are infeasible by counting alone'
          },
          {
            do: 'Solve the 4-nurse instance.',
            why: 'Far below the boundary, where refutation should be reachable.',
            work: '14 663 nodes, 700 ms',
            result: 'proved infeasible — a real UNSAT'
          },
          {
            do: 'Solve the 5-nurse instance.',
            why: 'Also infeasible by counting, and closer to the boundary.',
            work: '40 000 nodes, 2.29 s, budget exhausted',
            result: 'no answer, and no proof — the solver says nothing'
          },
          {
            do: 'Solve at 6, 7 and 8 nurses.',
            why: 'Above the boundary the instance gets easier fast.',
            work: '6 327 nodes at 6 nurses, 247 at 7, 33 at 8',
            result: 'feasible, and each schedule validates against all five requirements'
          }
        ],
        answer: 'Rows two and three describe the same situation to a human — capacity below ' +
          'demand — and completely different situations to a caller. One is a proof that no ' +
          'roster exists and justifies relaxing a requirement; the other is a solver that ran ' +
          'out of budget and justifies nothing at all. They arrive as the same thing unless the ' +
          'API distinguishes them. The counting check that classifies both correctly costs one ' +
          'line and runs before the solver, which is why it belongs in the code rather than in ' +
          'the runbook.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));

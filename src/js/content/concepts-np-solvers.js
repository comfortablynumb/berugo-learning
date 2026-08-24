/** Concepts for solvers, hardness in practice and the reduction workshop (M20.7-M20.9). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'using-solvers': [
      {
        term: 'The model is the engineering and the solver is a library call',
        plain: 'Write the problem down as constraints and hand it to somebody else’s search.',
        formal: 'model → encode → solve → decode → validate, with the solver as the only step you do not write',
        detail: 'Decades of engineering have gone into CDCL SAT solvers, MIP solvers and CP ' +
          'solvers, and none of it is going into a hand-written search written this quarter. The ' +
          'work moves from writing an algorithm to writing a MODEL, and a good model beats a ' +
          'clever hand-written search on almost every industrial instance. What that buys you ' +
          'is also a different skill set: the questions become "which encoding" and "what does ' +
          'the answer mean" rather than "which pruning rule".',
        example: 'The demo hands the same scheduling instance to the bundled DPLL under six ' +
          'different models, and every one of them agrees with a hand-written colourer.'
      },
      {
        term: 'At most one of these is true is the workhorse, and there are three ways to write it',
        plain: 'One clause per pair, a tree of commander variables, or a chain of carries.',
        formal: 'pairwise: n(n − 1)/2 clauses, 0 new variables. commander: O(n) clauses, O(n) variables. sequential: 3n − 4 clauses, n − 1 variables',
        readAs: 'Pairwise costs n times n minus one over two clauses and no new variables; the ' +
          'commander and sequential encodings cost a linear number of clauses and a linear ' +
          'number of new variables.',
        detail: 'One colour per vertex, one shift per nurse, one machine per job — this ' +
          'constraint is most of what a real model is made of, and the three encodings are all ' +
          'exactly correct. Which to use is decided by the group size and it has a crossover: ' +
          'pairwise is smallest below about twenty literals and introduces no variables, and a ' +
          'counter wins above it. Knowing where the crossover is means never having to argue ' +
          'about it — use both, in the same model.',
        example: 'At 5 literals the demo measures 10 pairwise clauses against 11 sequential; at ' +
          '2 000 it measures 1 999 000 against 5 996.'
      },
      {
        term: 'Clause count is arithmetic and solve time is not',
        plain: 'The size of the formula is exactly computable; whether it solves faster is an experiment.',
        formal: 'the pairwise-to-sequential clause ratio is (n − 1)/6 asymptotically — 333× at n = 2 000',
        readAs: 'The ratio between the pairwise and sequential clause counts grows like n minus ' +
          'one over six, reaching three hundred and thirty-three at two thousand literals.',
        detail: 'The clause count is what decides whether a model fits in memory at all, and it ' +
          'costs nothing to compute before writing any code. Solve time is a different question ' +
          'with a different answer per solver: propagation strength, clause-learning quality and ' +
          'branching heuristics all interact with the encoding. The honest report gives the ' +
          'arithmetic as arithmetic and the timings as measurements, rather than presenting one ' +
          'as evidence for the other.',
        example: 'The demo’s scaling table is pure arithmetic with no solving in it, and its ' +
          'model table reports node counts separately.'
      },
      {
        term: 'The solver here is DPLL, and that bounds what the encoding column can show',
        plain: 'It branches on the first unassigned variable, so auxiliary variables never change its search order.',
        formal: 'with a fixed variable order and no clause learning, encodings that differ only in auxiliary variables give identical node counts',
        detail: 'This is a limitation of the bundled solver rather than a fact about encodings, ' +
          'and reporting the node column without saying so would be an overclaim. The auxiliary ' +
          'variables an encoding introduces are numbered after every decision variable, so the ' +
          'search explores the same tree whichever encoding is used. With clause learning the ' +
          'propagation strength of the sequential encoding does show up in the time, and the ' +
          'propagation column is where that difference is visible even here.',
        example: 'The demo’s three plain rows all report 1 439 nodes and report 18 010, 21 923 ' +
          'and 21 150 propagations — the clause counts differ and the search does not.'
      },
      {
        term: 'Symmetry breaking is the largest cheap win available',
        plain: 'Fix the slots of one mutually conflicting group and delete a factorial from the search.',
        formal: 'a proper assignment stays proper under any permutation of the c slots, so the search space carries a factor of c!',
        readAs: 'A proper assignment stays proper when the slots are permuted, so the search ' +
          'space contains c factorial copies of every answer.',
        detail: 'A solver that has refuted "task 0 goes in slot 1" will refute "task 0 goes in ' +
          'slot 2" again from scratch, and again for every permutation. Tasks that mutually ' +
          'conflict need distinct slots anyway, so assigning them 1, 2, 3, … rules out no ' +
          'solution at all and removes the whole factor. It costs a handful of unit clauses and ' +
          'is the first thing to try on any model with interchangeable objects in it.',
        example: 'The demo measures 1 439 nodes falling to 1 for six unit clauses — a factor of ' +
          '1 439 on an unsatisfiable instance.'
      },
      {
        term: 'The node counts on the unsatisfiable side are exactly 2·c! − 1',
        plain: 'The solver is enumerating assignments of the conflicting group, one permutation at a time.',
        formal: 'for a clique of size c asked for c − 1 slots, DPLL with a fixed variable order visits 2·c! − 1 nodes and c! conflicts',
        detail: 'Seeing a factorial in a measurement is what makes symmetry breaking obvious ' +
          'rather than clever: the number is not merely large, it is exactly the count of ' +
          'permutations of the conflicting group. Three slots cost 11 nodes, four cost 47, five ' +
          'cost 239 and six cost 1 439, and each is two times the factorial minus one. Once the ' +
          'shape of the number is recognised, the fix suggests itself.',
        example: 'The demo’s slot sweep prints the measured node count and 2·slots! − 1 side by ' +
          'side, and they match on every unsatisfiable row.'
      },
      {
        term: 'A redundant constraint can help, which is counter-intuitive',
        plain: 'A clause implied by the others adds no solutions and can still cut the search.',
        formal: 'unit propagation is not logically complete, so an implied clause can put a consequence within reach that was several inferences away',
        detail: 'Solvers only derive what their propagation reaches, not everything that follows. ' +
          'A redundant clause changes nothing about the set of models and can change a great ' +
          'deal about how quickly the solver notices a contradiction — the classic example is ' +
          'stating "the total headcount equals the total demand" alongside the per-shift ' +
          'constraints, which is implied and propagates immediately. Adding redundancy is a ' +
          'legitimate modelling technique rather than a sign of a confused model.',
        example: 'The same idea explains why the demo’s symmetry-breaking unit clauses help: ' +
          'they are implied by nothing, but they are consistent with some solution and ' +
          'propagate at once.'
      },
      {
        term: 'Read what the solver actually returned',
        plain: 'SAT with a model is a certificate; UNSAT is a claim; a budget overrun is neither.',
        formal: 'the three outcomes are SAT with an assignment, UNSAT with (optionally) a resolution proof, and UNKNOWN',
        detail: 'A SAT answer comes with an assignment you can check in milliseconds, so check ' +
          'it — that is a free end-to-end test of the encoder, the solver and the decoder on ' +
          'every production run. An UNSAT answer is a claim about every assignment and the only ' +
          'evidence is a proof file. "Budget exhausted" is neither, and every API that collapses ' +
          'it into the UNSAT branch turns a slow model into a wrong answer, silently and at the ' +
          'worst possible moment.',
        example: 'The demo’s scheduling model reports a budget overrun on one row of the ' +
          'feasibility frontier in section 20.9, next to a row that is genuinely proved ' +
          'infeasible.'
      }
    ],

    'hardness-in-practice': [
      {
        term: 'Worst case and typical case are different questions',
        plain: 'NP-completeness says some instances are hard; it says nothing about yours.',
        formal: 'a completeness result quantifies over all instances; a benchmark quantifies over a distribution',
        detail: 'Industrial SAT instances with millions of variables are solved in seconds every ' +
          'day, and randomly generated instances with fifty variables can be genuinely ' +
          'difficult. That is not a contradiction: the complexity class is a statement about the ' +
          'worst member of an infinite family, and your instances are drawn from a distribution ' +
          'with structure in it. The useful question is what that structure is, because it is ' +
          'the thing a solver exploits and it is not in the class.',
        example: 'The demo’s structure table lists five properties that separate an industrial ' +
          'instance from a random one, and none of them is about size.'
      },
      {
        term: 'Random 3-SAT has a phase transition near a ratio of 4.27',
        plain: 'Below it almost everything is satisfiable; above it almost nothing is.',
        formal: 'the satisfiable fraction falls from 1 to 0 across a narrowing window around m/n ≈ 4.27',
        readAs: 'The fraction of satisfiable formulas falls from one to zero across a window ' +
          'around a clause-to-variable ratio of about four point two seven, and the window ' +
          'narrows as n grows.',
        detail: 'This is a property of the DISTRIBUTION rather than of any instance, so it needs ' +
          'many seeds per ratio and a median rather than a single run. The threshold value is ' +
          'asymptotic: at the sizes a browser can measure the crossover sits above 4.27 and ' +
          'drifts down as n grows, which the demo reports rather than rounding to the textbook ' +
          'number. The window narrowing with n is what makes it a genuine phase transition ' +
          'rather than a gradual trend.',
        example: 'At 44 variables the demo measures the satisfiable fraction crossing one half at ' +
          'ratio 4.38, and reports that the asymptotic value is 4.27.'
      },
      {
        term: 'The cost peaks at the crossover, and both ends are cheap for opposite reasons',
        plain: 'Under-constrained instances have many answers; over-constrained ones contradict quickly.',
        formal: 'median DPLL nodes rise from 10 at ratio 1 to 313 at ratio 4.5 and fall to 53 at ratio 8',
        detail: 'Far below the threshold there are so many satisfying assignments that almost any ' +
          'descent lands on one. Far above it a contradiction appears within a few decisions and ' +
          'propagation reaches it immediately. At the crossover there are few solutions AND no ' +
          'early contradiction, so the search has to go deep before it learns anything at all — ' +
          'which is exactly the regime anybody generating "random test instances" should be ' +
          'aiming at if the test is to mean anything.',
        example: 'The demo’s median column rises and then falls: 10 nodes at ratio 1, 134 at ' +
          '4.00, a peak of 313 at 4.50, then 247 at 5.00, 137 at 6.00 and 53 at 8.00.'
      },
      {
        term: 'Report the median, because the mean is dominated by the tail',
        plain: 'Near the threshold a handful of runs are far above everything else.',
        formal: 'at the peak the worst run is several times the median; the mean tracks the tail and moves between experiments',
        detail: 'A mean over a heavy-tailed sample is an estimate of something that moves between ' +
          'runs, so quoting it as "the solve time" makes a benchmark irreproducible without ' +
          'anybody doing anything wrong. The demo prints the median, the upper quartile, the ' +
          'mean and the worst side by side precisely so the gap between them is visible; where ' +
          'the four agree the distribution is well behaved, and where they diverge is exactly ' +
          'where a single number stops describing anything.',
        example: 'At ratio 3 the demo measures a median of 20 and a worst of 255 — a spread of ' +
          '12.8× — while the mean reads 29.6.'
      },
      {
        term: 'A backdoor is a small set of variables that makes the rest propagate',
        plain: 'Guess a few dozen values and millions of others follow without search.',
        formal: 'a strong backdoor is a set B such that for every assignment to B, a polynomial subsolver decides the rest',
        readAs: 'A strong backdoor is a set of variables such that for every way of assigning ' +
          'them, a polynomial-time subsolver settles everything else.',
        detail: 'Industrial instances usually have one of a few dozen variables even when they ' +
          'have millions in total, and random instances at the threshold do not. That single ' +
          'structural fact explains most of the gap between "solves in seconds" and "runs for a ' +
          'week". It also runs backwards into the encoding: a model that keeps related variables ' +
          'together and keeps implications binary preserves the backdoor, and one that flattens ' +
          'the structure destroys it.',
        example: 'The demo’s structure table contrasts "no small set decides the rest" for random ' +
          'instances against "often a few dozen" for industrial ones.'
      },
      {
        term: 'Combinatorial search has heavy-tailed runtimes',
        plain: 'The same solver on the same instance with a different seed can take orders of magnitude longer.',
        formal: 'the runtime distribution has a tail heavy enough that the mean is dominated by rare runs',
        detail: 'An unlucky seed wanders into a region of the space with no short path out, and ' +
          'it has no way to know that is what happened. This is not a defect in the solver: it ' +
          'is a property of the search landscape, and it appears in complete and incomplete ' +
          'solvers alike. The practical consequence is that a p99 several times the median means ' +
          'most of your latency budget is being spent by a small number of runs, and shaving the ' +
          'median does nothing about them.',
        example: 'The demo measures a median of 1 125 flips and a worst of 6 060 on one instance ' +
          'over 40 seeds — a spread of 5.4×.'
      },
      {
        term: 'Restarts convert an unbounded tail into a bounded expectation',
        plain: 'Abandon a run at a cutoff and start again with a fresh seed.',
        formal: 'with success probability p per attempt, the expected total is cutoff/p, which is geometric rather than heavy-tailed',
        readAs: 'If each attempt succeeds with probability p, the expected total work is the ' +
          'cutoff divided by p, which is a geometric distribution rather than a heavy-tailed one.',
        detail: 'A fresh attempt is a fresh draw from the distribution rather than a continuation ' +
          'of a bad one, which is exactly the same argument as a hedged request in a ' +
          'distributed system. The mechanism is arithmetic rather than luck, and it works ' +
          'because the hazard rate stops rising: past a certain point, a run that has not ' +
          'finished is no more likely to finish soon than a fresh one, so continuing it is ' +
          'strictly worse than restarting.',
        example: 'The demo’s best cutoff takes the mean from 1 582 flips to 1 314 and the worst ' +
          'from 6 060 to 5 252, while barely moving the median.'
      },
      {
        term: 'Too short a cutoff is far worse than no restarts at all',
        plain: 'Every attempt is abandoned just before it would have finished.',
        formal: 'if the cutoff is below the median, most attempts fail and the expected total rises rather than falls',
        detail: 'This is the failure mode of picking a timeout that feels responsive rather than ' +
          'one the data supports, and it is not a mild mistake — the demo’s shortest cutoff ' +
          'makes the mean more than four times worse than doing nothing. The cutoff has to come ' +
          'from the measured distribution: somewhere above the median and below the point where ' +
          'the tail begins, which for a heavy-tailed distribution is a wide but not unlimited ' +
          'window.',
        example: 'The demo’s 100-flip cutoff takes 2 666 restarts and a mean of 6 747 flips ' +
          'against 1 582 with no restarts at all.'
      }
    ],

    'reduction-workshop': [
      {
        term: 'Modelling is choosing which known problem your problem is',
        plain: 'Shift scheduling is colouring; allocation is matching; routing is a TSP variant.',
        formal: 'the formulation commits you to every assumption the target problem carries',
        detail: 'Recognising the shape gives you decades of solver engineering for free, and it ' +
          'is most of the work. It also commits you to assumptions the requirements never ' +
          'stated: that costs are additive, that travel times are fixed, that a slot is ' +
          'interchangeable with any other. Those are usually fine, and when one is not the ' +
          'symptom is a model that solves quickly and produces answers the domain experts reject ' +
          'for reasons they find hard to articulate.',
        example: 'The demo’s catalogue lists six real problems with their formulations, the ' +
          'assumption each makes, and where each usually diverges.'
      },
      {
        term: 'Write the requirement down twice, in code that shares nothing',
        plain: 'An encoder that produces clauses, and a checker that reads a finished answer.',
        formal: 'encode : requirements → CNF and validate : (requirements, answer) → per-requirement verdicts, with no shared code',
        detail: 'A checker written from the model checks the model, and would agree with a wrong ' +
          'one exactly as happily. Writing the second version from the REQUIREMENTS — counting ' +
          'nurses on a shift, counting worked days in a window — is what makes the agreement ' +
          'evidence. It is usually a morning’s work, it runs in milliseconds, and it is the only ' +
          'defence against a model that has drifted since somebody last read it.',
        example: 'The demo checks five requirements against the produced grid and reports 5 of 5, ' +
          'with a failure count per requirement rather than a single pass or fail.'
      },
      {
        term: 'The failure mode is a model that answers a different question',
        plain: 'The solver is fast and correct, and the schedule is not the one anybody asked for.',
        formal: 'a wrong encoding is satisfiable, its answer decodes cleanly, and nothing downstream can detect it',
        detail: 'This is what makes it dangerous. A slow solver announces itself; a drifted model ' +
          'produces a schedule that looks like a schedule, passes every type check and every ' +
          'smoke test, and violates a requirement nobody re-read. The defect was found in this ' +
          'milestone’s own code: a scenario configured without a night shift produced an index ' +
          'of −1 and constrained a variable one slot below the intended row, and only the ' +
          'independent validator noticed.',
        example: 'The demo’s hard-constraint table reports each requirement’s verdict separately, ' +
          'so a drifted one names itself instead of failing the whole run.'
      },
      {
        term: 'Every arrow from a requirement to a constraint carries an assumption',
        plain: 'And some of them are only true because of another requirement.',
        formal: '"a rest day in every window of w" is encoded as "at most w − 1 of the w·s shift variables", which needs "at most one shift per day"',
        readAs: 'At least one rest day in every window of w days is encoded as at most w minus ' +
          'one of the w times s shift variables in that window, which is only equivalent because ' +
          'a nurse works at most one shift a day.',
        detail: 'Counting shifts and counting worked days are the same number only while the ' +
          'one-shift-per-day rule holds. That is true today and would stop being true the moment ' +
          'split shifts appeared, and the encoding would then quietly allow a nurse to work ' +
          'every day. The checker counts worked DAYS directly rather than trusting the ' +
          'equivalence, which is what makes it a check rather than a restatement.',
        example: 'The demo’s rest-window constraint costs 2 664 clauses and 1 188 auxiliary ' +
          'variables, and is checked by counting rest days in the grid.'
      },
      {
        term: 'A hard constraint is a clause and a preference is an objective',
        plain: 'SAT has no objective, so a preference cannot be a clause.',
        formal: 'encoding "shared evenly" as a hard bound turns a preference into a constraint and can make a feasible instance infeasible',
        detail: 'Turning a preference into a hard bound is the tempting move and it is usually ' +
          'wrong: the instance becomes unsatisfiable and the solver gives no indication of which ' +
          'requirement caused it. The honest model lists the preference as unmodelled and ' +
          'reports what the produced answer achieved on it anyway, so the gap between "satisfies ' +
          'the model" and "is acceptable" is a number rather than an omission. Closing it means ' +
          'MaxSAT, an ILP objective, or a search over a fairness bound.',
        example: 'The demo’s roster gives five nurses five shifts each and three nurses two, ' +
          'which satisfies every hard constraint and is not what anybody means by fair.'
      },
      {
        term: 'UNSAT and budget exhausted are completely different claims',
        plain: 'One says no schedule exists; the other says this solver did not find one.',
        formal: 'UNSAT is a statement about every assignment; UNKNOWN is a statement about one run',
        detail: 'They arrive at the caller as the same thing — no answer — and treating the ' +
          'second as the first is the mistake that makes a team relax a requirement that did not ' +
          'need relaxing. The demo’s frontier table has rows of both kinds side by side on ' +
          'instances a human can classify by counting, which is the clearest way to see that the ' +
          'difference is real and that the solver will not tell you which one you have.',
        example: 'At 4 nurses the demo proves infeasibility in 14 663 nodes; at 5 nurses, which ' +
          'is also infeasible by counting, it exhausts a 40 000-node budget and says nothing.'
      },
      {
        term: 'An infeasibility diagnosis has to be built',
        plain: 'The solver says no and does not say why.',
        formal: 'solve with each constraint group relaxed in turn, or request an unsatisfiable core; the counting argument is cheaper than both',
        detail: 'A solver’s UNSAT answer names no requirement, so the diagnosis is a piece of ' +
          'engineering you write. Three techniques, in increasing cost: check the counting ' +
          'arguments before calling the solver at all, ask for an unsatisfiable core if the ' +
          'solver produces one, and re-solve with each constraint group dropped to see which ' +
          'restores feasibility. The first is free and catches the common case with a reason ' +
          'attached, which is why it belongs in the code rather than in the runbook.',
        example: 'The demo’s frontier prints capacity against required shifts on every row, and ' +
          'the two infeasible rows are the ones where capacity is below demand.'
      },
      {
        term: 'Recognition is most of the work, and half of "NP-hard" is a misidentification',
        plain: 'Assignment is polynomial; treating it as scheduling loses a fast exact algorithm.',
        formal: 'bipartite matching and min-cost flow are polynomial; adding one "these two together" constraint pushes them to ILP',
        detail: 'Once you see that a problem is matching rather than colouring, the algorithm is ' +
          'polynomial and the conversation is over. The commonest error in the catalogue is ' +
          'exactly that: a resource-allocation problem that is a flow gets modelled as a general ' +
          'scheduling problem because it feels like one. It is also worth knowing which single ' +
          'constraint breaks the structure — a coupling requirement destroys the flow ' +
          'formulation — so the trade-off can be discussed rather than discovered.',
        example: 'The demo’s catalogue marks resource allocation as "polynomial, not NP-hard" and ' +
          'names the constraint that would change that.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));

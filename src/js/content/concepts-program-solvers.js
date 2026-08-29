/** Concepts for SAT and SMT solving (M32.5-M32.6). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'sat-solving': [
      {
        term: 'CNF is the only shape, and unit propagation is the reason',
        plain: 'A conjunction of clauses, each a disjunction of literals.',
        formal: 'a clause with one unassigned literal and the rest false forces that literal',
        detail: 'Everything else in the solver is machinery around that rule. It is also why '
          + 'the input format looks so primitive: an encoder in front converts whatever you '
          + 'actually have into clauses, and the quality of that conversion decides how hard '
          + 'the instance is far more than the solver does. A formula in any other shape is '
          + 'translated first, and Tseitin encoding does it in linear size by naming '
          + 'subformulas.',
        example: 'On a Horn instance of 40 variables the solver makes 0 decisions: propagation '
          + 'alone decides it.'
      },
      {
        term: 'Two watched literals make propagation cost what it should',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["clause (x1 or x2 or x3 or x4)"] --> B["watch x1 and x2 only"]',
            '    B --> C{"x1 becomes false"}',
            '    C -->|"another non-false literal exists"| D["move the watch to x3<br/>and forget this clause again"]',
            '    C -->|"none left"| E["the clause is unit or conflicting<br/>— report it"]',
            '    F["x3 or x4 assigned"] -.->|"not watched, so<br/>the clause is never visited"| A'
          ].join('\n'),
          caption: 'A clause is only visited when one of its two watched literals is falsified, so assigning a variable touches the clauses that might have changed state rather than every clause containing it.'
        },
        plain: 'Only look at a clause when one of two chosen literals is falsified.',
        formal: 'a clause can only become unit when one of its two watched literals goes false',
        detail: 'The invariant is what makes it work: while two non-false literals are watched, '
          + 'the clause cannot be unit, so it can be ignored entirely. Backtracking costs '
          + 'nothing because the watches never need restoring — any two non-false literals are '
          + 'a valid pair, and undoing an assignment only makes more literals non-false. That '
          + 'is the property a naive implementation with counters does not have.',
        example: 'The demo counts clause visits: 8 636 on pigeonhole at five holes, against '
          + '1 742 propagations.'
      },
      {
        term: 'A conflict is an opportunity, and the implication graph is where it is taken',
        plain: 'Every assignment that forced the conflict, with an edge from each cause.',
        formal: 'decisions are roots; each propagated literal has an edge from every other literal of its reason clause',
        detail: 'The graph is not a data structure the solver builds — it is implicit in the '
          + 'trail, where every propagated literal remembers the clause that forced it. That is '
          + 'the whole storage cost of clause learning: one pointer per assignment. Walking it '
          + 'backwards from the conflicting clause gives the cone of assignments that are '
          + 'actually responsible, which on a large instance is a handful out of thousands.',
        example: 'At the first conflict of pigeonhole with three holes, the cone is 12 '
          + 'assignments out of a trail that already holds all of them.'
      },
      {
        term: 'Cutting the graph produces a clause the formula already implied',
        diagram: {
          definition: [
            'flowchart LR',
            '    D["decision: x4 = false<br/>level 3"] --> I1["x5 = true"]',
            '    I1 --> I2["x11 = false"]',
            '    I1 --> I3["x8 = false"]',
            '    I2 --> C1["x10 = true"]',
            '    I3 --> C2["x7 = true"]',
            '    C1 --> K{{"conflict"}}',
            '    C2 --> K',
            '    I1 -.->|"the cut here keeps one literal<br/>from the current level"| U["learned: not x5 or x12 or x9"]'
          ].join('\n'),
          caption: 'The first unique implication point is the single literal every path from the decision passes through. Cutting there gives a short clause with exactly one literal at the conflict level, which is what makes the backjump well defined.'
        },
        plain: 'Negate the literals on the far side of the cut and you have a new clause.',
        formal: 'the clause is implied by the formula, and the current assignment falsifies it',
        detail: 'Both halves matter. Implied means adding it changes nothing about which '
          + 'assignments satisfy the formula, so the solver stays correct; falsified means the '
          + 'search is forced to move, so it makes progress. The cut chosen in practice is the '
          + 'first unique implication point, because it yields a short clause containing '
          + 'exactly one literal from the conflict level — and that is precisely the condition '
          + 'for the clause to become unit after backjumping.',
        example: 'On pigeonhole with three holes the first conflict yields (not x5 or x12 or '
          + 'x9) and a jump from level 3 back to level 2.'
      },
      {
        term: 'Backjumping is non-chronological, and that is the point',
        plain: 'Discard every level the learned clause does not mention.',
        formal: 'jump to the second-highest level in the learned clause',
        detail: 'Landing there is not an optimisation of undoing one level at a time — it is a '
          + 'different algorithm. At that level the learned clause has exactly one unassigned '
          + 'literal, so it immediately forces something new, which means the solver never '
          + 'repeats the decisions that led here. A chronological backtracker would undo one '
          + 'decision, find the same conflict by another route, and do it again.',
        example: 'The demo prints the jump: from level 10 back to level 9 on one conflict, and '
          + 'from 3 to 2 on another.'
      },
      {
        term: 'VSIDS makes the search follow the conflicts',
        plain: 'Decide on the variables that have been in recent conflicts.',
        formal: 'bump the activity of every variable in a conflict; grow the bump over time',
        detail: 'Growing the bump rather than decaying every score is the same thing done '
          + 'cheaply, and the effect is that recent conflicts dominate. What this buys is '
          + 'locality: the solver concentrates on the part of the formula that is actually '
          + 'hard, which is why it can handle industrial instances with millions of variables '
          + 'where almost all of the formula is easy. Phase saving completes it by reusing the '
          + 'polarity a variable last had, so a restart resumes rather than restarts.',
        example: 'Restarts on pigeonhole at five holes: 1, with every learned clause kept '
          + 'across it.'
      },
      {
        term: 'A SAT answer carries a model and an UNSAT answer carries a proof',
        plain: 'Neither answer requires you to trust the solver.',
        formal: 'a model is checked clause by clause; a DRAT proof is replayed by a checker with no search',
        detail: '"I searched and found nothing" is exactly what a solver with a bug in its '
          + 'conflict analysis reports, and that failure is invisible. So every learned clause '
          + 'is logged in order, and the checker verifies each is a reverse-unit-propagation '
          + 'consequence of the clauses before it, ending in the empty clause. This is why SAT '
          + 'solvers can be trusted inside verification tools despite being large optimised C++ '
          + 'programs with a real bug history.',
        example: 'The pigeonhole answer at five holes emits 145 proof steps, and the checker '
          + 'replays all of them.'
      },
      {
        term: 'Clause learning is not always a win, and the pigeonhole family is why',
        diagram: {
          definition: [
            'flowchart TD',
            '    A["random 3-SAT at the threshold<br/>70 variables"] --> B["CDCL: 125 decisions"]',
            '    A --> C["DPLL: 5 831 nodes"]',
            '    D["pigeonhole, 6 pigeons into 5 holes"] --> E["CDCL: 183 decisions"]',
            '    D --> F["DPLL: 239 nodes"]',
            '    G["planted satisfiable, 80 variables"] --> H["CDCL: 159 decisions"]',
            '    G --> I["DPLL: 43 nodes"]'
          ].join('\n'),
          caption: 'Learning wins by 47 times at the threshold, by 1.3 times on pigeonhole where no short proof exists, and loses outright on an instance whose answer is a satisfying assignment waiting to be found.'
        },
        plain: 'On a problem with no short resolution proof, both solvers are exponential.',
        formal: 'PHP(n) has no polynomial-size resolution proof, and CDCL is resolution',
        detail: 'Every clause a CDCL solver learns is derived by resolution, so the whole run '
          + 'is a resolution proof and the known exponential lower bound applies to it '
          + 'directly. That is not a weakness of any implementation and no amount of '
          + 'engineering removes it. It matters in practice because counting arguments — n + 1 '
          + 'things into n slots — appear constantly in real encodings, and an encoding whose '
          + 'unsatisfiability is a counting argument will not be decided by any CDCL solver.',
        example: 'Pigeonhole conflicts: 7 at four holes, 28 at five, 145 at six, 849 at seven.'
      }
    ],

    'smt-solving': [
      {
        term: 'An atom means something, and the SAT core still does not know what',
        plain: 'The structure is boolean; the propositions are equalities and inequalities.',
        formal: 'a formula over theory atoms, with the core treating each atom as opaque',
        detail: 'That separation is the entire architecture. It means one SAT core serves '
          + 'equality, arithmetic, arrays and bit-vectors, and that adding a theory is writing '
          + 'a decision procedure for conjunctions rather than a solver. It also means the core '
          + 'can be the same heavily engineered CDCL solver everyone already has, which is '
          + 'where most of the raw speed comes from.',
        example: 'The demo\'s problem has 4 atoms and 3 clauses; the core sees 4 propositions '
          + 'with no meaning attached.'
      },
      {
        term: 'The theory answers one question: can these literals hold together',
        plain: 'A conjunction in, consistent or not out.',
        formal: 'the theory decides satisfiability of a conjunction, never of a formula',
        detail: 'It needs no notion of clauses, search, or backtracking, and that is why the '
          + 'procedures are classical algorithms rather than solvers: congruence closure for '
          + 'equality, negative-cycle detection for difference logic, simplex or elimination '
          + 'for linear arithmetic. Writing a new theory means answering that one question '
          + 'correctly and explaining a "no" well.',
        example: 'On the feasible difference-logic system the theory accepts on the first '
          + 'round, so the whole answer costs 1 round.'
      },
      {
        term: 'An explanation is what turns a loop into an algorithm',
        diagram: {
          definition: [
            'flowchart LR',
            '    M["a model the theory refuted"] --> Q{"what comes back?"}',
            '    Q -->|"the two literals<br/>that actually clash"| S["a short clause:<br/>rules out a whole family"]',
            '    Q -->|"the whole assignment"| L["a long clause:<br/>rules out exactly one model"]',
            '    S --> R1["2 rounds, whatever the problem size"]',
            '    L --> R2["one round per model:<br/>2, 4, 10, 28, 82"]'
          ].join('\n'),
          caption: 'The same conflict, the same theory, the same core. Only the size of the explanation differs, and it is the difference between a solver and an enumerator.'
        },
        plain: 'A subset of the asserted literals that is already contradictory.',
        formal: 'negating the explanation gives a clause implied by the theory',
        detail: 'The size of that subset is the single most important number in a theory '
          + 'implementation. A minimised core names only the literals that really clash, so the '
          + 'blocking clause forbids every assignment that repeats them — a whole family at '
          + 'once. Returning the entire assignment is always correct and blocks exactly one '
          + 'model, which turns the loop into an enumeration of the theory-consistent '
          + 'assignments.',
        example: 'On the padded problem: 2 rounds at every size with a minimised core, and 2, '
          + '4, 10, 28, 82 rounds with the whole assignment.'
      },
      {
        term: 'Congruence closure is union-find with one extra rule',
        plain: 'Merge what is asserted equal, then merge what follows from congruence.',
        formal: 'if the arguments of two applications of the same function are equal, the results are equal',
        detail: 'The data structure is the one from M04 and the rule is one line, which is '
          + 'worth noticing: the reasoning in the base theory of every SMT solver is a '
          + 'disjoint-set forest with a rule attached. The subtlety is that merging can create '
          + 'new congruences, so the closure has to be recomputed until nothing changes — and a '
          + 'term interned after the merges have run will not be seen unless the '
          + 'implementation re-checks, which is a real and silent bug.',
        example: 'a = b and b = c makes f(a) and f(c) congruent, which contradicts f(a) != '
          + 'f(c) — 3 atoms, 1 theory refutation.'
      },
      {
        term: 'Uninterpreted means the solver assumes nothing except congruence',
        plain: 'Replace what you cannot reason about with a symbol.',
        formal: 'no axioms about the function beyond equal arguments giving equal results',
        detail: 'This is what makes the theory useful on real programs: abstract a hash, a '
          + 'library call or an unmodelled operation as an uninterpreted function, and anything '
          + 'you prove holds for every possible implementation of it. The price is exactly '
          + 'symmetrical — you cannot prove anything that depends on what the function '
          + 'computes, so a property that needs `length(reverse(xs)) = length(xs)` will not be '
          + 'proved until you say so.',
        example: 'f is never evaluated anywhere in the demo; the only thing asserted about it '
          + 'is that equal arguments give equal results.'
      },
      {
        term: 'Difference logic is a graph problem in disguise',
        plain: 'x - y <= c is an edge from y to x of weight c.',
        formal: 'the conjunction is satisfiable exactly when the constraint graph has no negative cycle',
        detail: 'So the decision procedure is Bellman-Ford from M13, and the explanation writes '
          + 'itself: the negative cycle is a minimal contradictory subset, which is the best '
          + 'possible explanation and comes free with the algorithm. The fragment is narrow — '
          + 'two variables and a constant, nothing else — and it covers a surprising amount of '
          + 'scheduling and timing reasoning.',
        example: 'x - y <= 3, y - z <= -2, z - x <= -2 sums to -1 round the cycle, so the '
          + 'system is unsatisfiable.'
      },
      {
        term: 'Rational and integer arithmetic are different problems',
        plain: 'A system can have a fractional solution and no whole-number one.',
        formal: 'satisfiable over the rationals does not imply satisfiable over the integers',
        detail: 'The elimination procedure here decides the rationals, so a counter-example it '
          + 'produces may be fractional — and a fractional counter-example to a program '
          + 'property is not one, because program variables are integers. Reporting that '
          + 'honestly is the difference between a tool that says "your invariant is wrong" and '
          + 'one that says "I cannot prove it, and here is why my counter-example may not '
          + 'count". The verification section runs into exactly this.',
        example: 'A loop invariant that holds over the integers fails here with a counter-'
          + 'example at n = 0.5, and the report says the counter-example is fractional.'
      },
      {
        term: 'Every answer is re-checked outside the solver',
        plain: 'The boolean half and the theory half can be wrong independently.',
        formal: 'the model satisfies the skeleton, and the theory model satisfies every asserted literal',
        detail: 'A satisfiable answer is checked twice because there are two ways to produce a '
          + 'wrong one, and neither check shares code with the search. An unsatisfiable answer '
          + 'inherits the DRAT proof of the final SAT call — which covers the boolean reasoning '
          + 'completely and the theory reasoning not at all, because the blocking clauses are '
          + 'assumed. That gap is real, and it is why proof-producing theory solvers are an '
          + 'active area.',
        example: 'The padded problem at four free choices: 82 rounds, 1 024 assignments '
          + 'enumerated by brute force, and both verdicts agree.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));

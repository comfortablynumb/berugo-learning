/** Reference entries for SAT and SMT solving (M32.5-M32.6). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'sat-solving': {
      summary: 'CDCL with two-watched literals, 1UIP conflict analysis, non-chronological '
        + 'backjumping, VSIDS and Luby restarts, with the implication graph drawn at a chosen '
        + 'conflict and the cut marked, every SAT answer\'s model re-checked and every UNSAT '
        + 'answer\'s DRAT proof replayed — and a four-family comparison against plain DPLL '
        + 'showing where learning wins by 47 times and where it loses.',
      intuition: 'Each conflict is turned into a clause the formula already implied, so the '
        + 'search never makes that combination of decisions again — which is why a modern '
        + 'solver gets faster on a hard instance rather than slower.',
      formulation: {
        equations: [
          {
            label: 'CDCL against DPLL, branches guessed, on four families',
            expr: 'family · verdict · CDCL decisions · DPLL nodes',
            terms: [
              { sym: 'random 3-SAT at 4.26, n = 70', meaning: 'unsat · 125 · 5 831' },
              { sym: 'pigeonhole, 6 into 5', meaning: 'unsat · 183 · 239' },
              { sym: 'planted satisfiable, n = 80', meaning: 'sat · 159 · 43' },
              { sym: 'Horn, n = 40', meaning: 'sat · 0 · 1' }
            ]
          },
          {
            label: 'The pigeonhole family: conflicts before the empty clause',
            expr: 'holes · conflicts · what it costs',
            terms: [
              { sym: '3', meaning: '7 conflicts, 7 proof steps' },
              { sym: '4', meaning: '28' },
              { sym: '5', meaning: '145 conflicts, 8 636 clause visits' },
              { sym: '6', meaning: '849 — no engineering removes this' }
            ]
          },
          {
            label: 'One conflict on pigeonhole with three holes',
            expr: 'what the analysis produces',
            terms: [
              { sym: 'conflicting clause', meaning: '(not x10 or not x7), every literal false' },
              { sym: 'cone of assignments', meaning: '12, of which 3 are decisions' },
              { sym: 'learned clause', meaning: '(not x5 or x12 or x9)' },
              { sym: 'backjump', meaning: 'level 3 to level 2' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'While two non-false literals are watched, a clause cannot be unit',
          why: 'It is what lets propagation skip the clause entirely, and what makes backtracking free.',
          breaks: 'Undoing an assignment only makes more literals non-false, so the watches never need restoring.'
        },
        {
          name: 'A learned clause is implied by the formula and falsified by the current assignment',
          why: 'The first half keeps the solver correct; the second guarantees progress.',
          breaks: 'Both are properties of the 1UIP cut, not of the search order.'
        },
        {
          name: 'A unit clause is an assignment, not a watched clause',
          why: 'It carries no watches, so nothing re-derives it if the trail is cleared past level 0.',
          breaks: 'Backtracking to level 0 must keep it; an off-by-one there returns models that do not satisfy the formula.'
        },
        {
          name: 'Every UNSAT answer emits a proof that a checker with no search replays',
          why: '"I searched and found nothing" is what a solver with broken conflict analysis reports.',
          breaks: 'Each logged clause must be a reverse-unit-propagation consequence of the clauses before it.'
        }
      ],
      complexity: [
        { operation: 'unit propagation, two watched literals', average: 'proportional to the clauses whose watch was falsified', worst: 'every clause holding the variable, when all watches move' },
        { operation: 'conflict analysis', average: 'proportional to the cone behind the conflict', worst: 'the whole trail' },
        { operation: 'the search', average: 'instance-dependent, and the reason benchmarks exist', worst: 'exponential; SAT is NP-complete' },
        { operation: 'pigeonhole PHP(n)', average: 'exponential for every resolution-based solver', worst: 'the same, and proved rather than observed' },
        { operation: 'DRAT checking', average: 'one propagation per proof step', worst: 'quadratic in the proof, which is why proofs are large' }
      ],
      failureModes: [
        {
          symptom: 'A solver runs for hours on an instance a human describes in one sentence.',
          cause: 'The encoding\'s unsatisfiability rests on a counting argument, which has no short resolution proof.',
          fix: 'Encode the cardinality constraint explicitly — totaliser or sequential encoding — or use a solver with native support.'
        },
        {
          symptom: 'The solver reports SAT and the model does not satisfy the formula.',
          cause: 'A bug in backtracking or in clause attachment; the classic is losing unit assignments at level 0.',
          fix: 'Check every model against the formula in code that shares nothing with the solver; it is cheap and total.'
        },
        {
          symptom: 'Performance collapses after adding a few thousand learned clauses.',
          cause: 'The learned database is now most of the propagation work.',
          fix: 'Clause deletion by activity or LBD; keeping everything is as bad as keeping nothing.'
        },
        {
          symptom: 'An UNSAT answer turns out to be wrong months later.',
          cause: 'Nobody checked it, because a wrong UNSAT looks exactly like a right one.',
          fix: 'Require a DRAT proof and replay it; this is why competitions mandate proofs.'
        }
      ],
      inTheWild: [
        'MiniSat, whose 2 000 lines defined the modern architecture everything else refines.',
        'The SAT competition, which has required machine-checkable UNSAT proofs since 2013.',
        'CryptoMiniSat and the use of solvers in cryptanalysis, where XOR clauses get native support.',
        'Bounded model checkers, package managers and configuration tools, all of which are encoders in front of a solver.'
      ],
      sources: [
        { title: 'Davis, Putnam, Logemann, Loveland — the DPLL papers (1960, 1962)', note: 'the backbone, and still the shape of the search' },
        { title: 'Marques-Silva, Sakallah — GRASP', note: 'conflict-driven clause learning, and the implication graph' },
        { title: 'Moskewicz et al. — Chaff', note: 'two watched literals and VSIDS, the engineering that made it practical' },
        { title: 'Haken — The intractability of resolution', note: 'why pigeonhole is exponential for every solver in this family' },
        { title: 'Heule, Hunt, Wetzler — Trimming while checking clausal proofs', note: 'DRAT, and what a checkable proof costs' }
      ]
    },

    'smt-solving': {
      summary: 'DPLL(T) with the loop reported round by round: a SAT core over opaque atoms, '
        + 'congruence closure and negative-cycle detection as theories, explanations that can '
        + 'be minimised cores or whole assignments, and a padded problem where that choice is '
        + 'the difference between 2 rounds and 82.',
      intuition: 'A SAT core that knows nothing and a theory that knows one thing, passing '
        + 'clauses between them — which is why adding a theory means writing a decision '
        + 'procedure for conjunctions rather than a solver.',
      formulation: {
        equations: [
          {
            label: 'One conflict plus k free choices, rounds of the loop',
            expr: 'k · minimised core · whole assignment',
            terms: [
              { sym: '0', meaning: '2 · 2' },
              { sym: '2', meaning: '2 · 10' },
              { sym: '3', meaning: '2 · 28' },
              { sym: '4', meaning: '2 · 82, against 81 theory-consistent models' }
            ]
          },
          {
            label: 'Two routes to one contradiction: 4 atoms, 3 clauses',
            expr: 'round · stage · outcome · explanation',
            terms: [
              { sym: '1', meaning: 'theory · refuted · 2 literals' },
              { sym: '2', meaning: 'theory · refuted · 3 literals' },
              { sym: '3', meaning: 'boolean · unsat · the answer' },
              { sym: 'brute force', meaning: '16 assignments tried, same verdict' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The theory decides conjunctions and never formulas',
          why: 'It is what keeps a theory small enough to be a classical algorithm with an interface.',
          breaks: 'Everything about clauses, search and backtracking stays in the SAT core.'
        },
        {
          name: 'A blocking clause is implied by the theory',
          why: 'Otherwise adding it would remove satisfying assignments and the answer could be wrong.',
          breaks: 'It is the negation of a set of literals the theory proved contradictory.'
        },
        {
          name: 'A term key names its children rather than their identifiers',
          why: 'A key built from ids does not re-parse in another state, so core minimisation silently becomes a no-op.',
          breaks: 'Congruence is looked up by structural key, which is what makes the minimisation real.'
        },
        {
          name: 'A satisfiable answer is checked in two independent halves',
          why: 'The boolean assignment and the theory model can be wrong independently.',
          breaks: 'The skeleton is re-checked clause by clause and the theory model against every asserted literal.'
        }
      ],
      complexity: [
        { operation: 'congruence closure', average: 'near-linear in the terms, with union-find', worst: 'the same; the closure re-runs until nothing merges' },
        { operation: 'difference logic', average: 'Bellman-Ford over the constraint graph', worst: 'vertices times edges, and the negative cycle is the explanation' },
        { operation: 'Fourier-Motzkin elimination', average: 'upper bounds times lower bounds per variable', worst: 'doubly exponential; it gives up past 4 000 constraints' },
        { operation: 'the DPLL(T) loop, minimised cores', average: 'a few rounds, independent of irrelevant structure', worst: 'one per theory-consistent model' },
        { operation: 'the DPLL(T) loop, whole-assignment explanations', average: 'one round per theory-consistent model', worst: 'the same, and that is the point' }
      ],
      failureModes: [
        {
          symptom: 'A query that should be easy takes thousands of theory calls.',
          cause: 'The theory returns weak explanations, so each refutation rules out one model.',
          fix: 'Minimise the core — by deletion if nothing better is available — and measure the round count before and after.'
        },
        {
          symptom: 'The solver answers "unknown" on a query with quantifiers.',
          cause: 'Quantifier instantiation by E-matching is a heuristic, not a decision procedure.',
          fix: 'Read it as "my patterns did not fire"; supply triggers, or eliminate the quantifier by hand.'
        },
        {
          symptom: 'A counter-example contains a fraction where the program has an integer.',
          cause: 'The arithmetic procedure decides the rationals; the property is over the integers.',
          fix: 'Report the non-integrality rather than the counter-example, and use an integer procedure if you need one.'
        },
        {
          symptom: 'Adding one innocuous constraint makes a fast query time out.',
          cause: 'It moved the atoms out of a decidable fragment — a product of two variables is enough.',
          fix: 'Keep the query in the weakest theory that expresses it, and check which fragment your atoms are in.'
        }
      ],
      inTheWild: [
        'Z3 and CVC5, the two solvers most verification tools are built on.',
        'Dafny, Boogie and F*, which compile program verification conditions into SMT queries.',
        'SMT-LIB, the standard input format and benchmark library that made the field comparable.',
        'Symbolic execution engines, where the path condition goes straight to an SMT solver.'
      ],
      sources: [
        { title: 'Nieuwenhuis, Oliveras, Tinelli — Solving SAT and SAT modulo theories', note: 'the DPLL(T) architecture, stated abstractly' },
        { title: 'de Moura, Bjorner — Z3: an efficient SMT solver', note: 'the engineering, including theory combination' },
        { title: 'Nelson, Oppen — Fast decision procedures based on congruence closure', note: 'the base theory, and how theories combine' },
        { title: 'Downey, Sethi, Tarjan — Variations on the common subexpression problem', note: 'congruence closure as a union-find algorithm' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));

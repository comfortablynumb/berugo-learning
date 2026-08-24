/** Reference entries for decision problems, reductions and the SAT zoo (M20.1-M20.3). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'decision-problems': {
      summary: 'Four problems with a planted YES instance and a structurally obstructed NO ' +
        'instance, each with its verifier and its search measured on both, plus corrupted and ' +
        'malformed certificates fed to every verifier.',
      intuition: 'NP is the class of problems that are easy to CHECK and hard to FIND, and the ' +
        'gap between those two costs is visible only on instances that have no answer.',
      formulation: {
        equations: [
          {
            label: 'The definition, and what each half constrains',
            expr: 'x ∈ L ⟺ ∃c, |c| ≤ p(|x|), V(x, c) accepts, with V polynomial-time',
            terms: [
              { sym: 'the certificate c', meaning: 'an assignment, a tour, a subset — the thing a solver would hand you' },
              { sym: '|c| ≤ p(|x|)', meaning: 'short: a certificate the size of the search space proves nothing' },
              { sym: 'V polynomial-time', meaning: 'checkable: the whole practical content of the class' },
              { sym: 'the missing NO side', meaning: 'no short certificate is known for a NO answer; that gap is co-NP' }
            ]
          },
          {
            label: 'Measured at 12 vertices, seed 3',
            expr: 'verify · search on YES · search on NO',
            terms: [
              { sym: 'Hamiltonian cycle', meaning: '24 · 82 · 4 794 steps — 199.8× on the NO side' },
              { sym: 'subset sum', meaning: '5 · 3 138 · 4 096 steps — 819.2×' },
              { sym: '3-colouring', meaning: '20 · 13 · 2 213 steps — the YES search is CHEAPER than the check' },
              { sym: 'clique of size 5', meaning: '16 · 33 · 306 steps — 19.1×, on a NO instance at density 0.5' }
            ]
          },
          {
            label: 'The growth, over 8 to 15 vertices',
            expr: 'Hamiltonian cycle, verifier against refutation',
            terms: [
              { sym: 'verification', meaning: '16 → 30 steps, which is 2n + 2 exactly' },
              { sym: 'refutation', meaning: '369 → 28 378 steps, about 1.96× per extra vertex' },
              { sym: 'the YES search', meaning: '11 → 191, erratic — it measures the generator' },
              { sym: 'what this is evidence of', meaning: 'a growth rate, not a data point; one instance proves nothing' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'A verifier is total: it accepts or rejects every input',
          why: 'The moment a certificate comes from outside, the verifier is a security boundary and an exception is a denial-of-service vector.',
          breaks: 'Indexing a certificate array without a bounds check turns a malformed input into a crash, or worse into an accidental accept.'
        },
        {
          name: 'A NO instance must be obstructed for a stated reason',
          why: 'Otherwise "the search found nothing" is indistinguishable from "the search was cut off", and the measurement means nothing.',
          breaks: 'Rejection sampling produces NO instances whose reason nobody can check, and a budget-limited search on one is reported as a refutation.'
        },
        {
          name: 'The certificate is polynomially bounded in the instance',
          why: 'A certificate as large as the search space would put every decidable problem in NP.',
          breaks: 'A "certificate" that is the whole execution trace of a search is not one, and a verifier that replays it is not a polynomial-time verifier.'
        }
      ],
      complexity: [
        { operation: 'verify a Hamiltonian certificate', average: 'O(n) — 2n + 2 steps measured', worst: 'the same; the cost does not depend on the answer' },
        { operation: 'search for a Hamiltonian cycle', average: 'fast on planted instances — 82 steps at n = 12', worst: '(n − 1)! orders; 28 378 steps at n = 15 on an obstructed instance' },
        { operation: 'verify a subset-sum certificate', average: 'O(k) for k indices — 5 steps measured', worst: 'the same, plus a duplicate check' },
        { operation: 'search for a subset sum', average: '2ⁿ subsets; 3 138 steps at n = 12 with a planted answer', worst: '4 096 = 2¹² exactly, on the unsolvable instance' },
        { operation: 'verify a 3-colouring', average: 'O(n + m) — 20 steps measured', worst: 'the same' },
        { operation: 'search for a 3-colouring', average: '13 steps on a planted instance', worst: '3ⁿ assignments; 2 213 steps against a K₄ obstruction' }
      ],
      failureModes: [
        {
          symptom: 'A benchmark shows an NP-complete problem solving instantly at every size.',
          cause: 'Every instance was generated from a known answer, so the search walks into the planted structure.',
          fix: 'Generate NO instances with a stated structural obstruction, and report the two sides separately.'
        },
        {
          symptom: 'The verifier throws on input from an untrusted source.',
          cause: 'It indexes the certificate without validating its shape first.',
          fix: 'Validate length, range and distinctness before reading anything, and return a named rejection.'
        },
        {
          symptom: '"NP-hard" is quoted and nobody can produce a certificate format.',
          cause: 'The problem is NP-hard but not in NP — often an optimisation form, sometimes worse.',
          fix: 'State the decision form and its certificate explicitly. If there is none, no checker can be built and the design must change.'
        },
        {
          symptom: 'A solver reports "no solution" and the team relaxes a requirement.',
          cause: 'The solver hit a time budget rather than exhausting the space, and the two look identical from outside.',
          fix: 'Make the API distinguish UNSAT from EXHAUSTED, and never let a budget produce a negative answer.'
        }
      ],
      inTheWild: [
        'Proof-of-work: one hash to verify, 2ᵈ expected hashes to find, and the whole security argument is that asymmetry.',
        'Verifiable computation and rollup proofs: an untrusted party computes and a cheap verifier checks, which is NP read as a protocol.',
        'Optimiser output in production: run the certificate through a checker before acting on it, and log every rejection.',
        'CAPTCHA and puzzle-based rate limiting: a client-side cost that is cheap to set and cheap to check.'
      ],
      sources: [
        { title: 'Cook — The complexity of theorem-proving procedures (1971)', note: 'the original completeness result for SAT' },
        { title: 'Garey and Johnson — Computers and Intractability', note: 'the standard catalogue, and still the best guide to stating a problem precisely' },
        { title: 'Arora and Barak — Computational Complexity: A Modern Approach', note: 'chapter 2 for NP, chapter 4 for the classes above it' },
        { title: 'Sipser — Introduction to the Theory of Computation', note: 'the clearest treatment of verifiers and certificates for a first pass' }
      ]
    },

    reductions: {
      summary: 'Five reductions with forward, solve, backward and validate, each round-tripped ' +
        'on a satisfiable source and on an unsatisfiable one, with the mapped answer checked ' +
        'against the source instance rather than against the model.',
      intuition: 'The arrow points from the problem you want to solve to the problem you can ' +
        'call, and the step that catches every bug is checking the mapped answer against the ' +
        'original constraints.',
      formulation: {
        equations: [
          {
            label: 'The definition, and the direction',
            expr: 'A ≤ₚ B ⟺ ∃ polynomial-time f with x ∈ A ⟺ f(x) ∈ B',
            terms: [
              { sym: 'as a proof', meaning: 'A hard and A ≤ₚ B means B is hard; reduce FROM a known-hard problem' },
              { sym: 'as a solver', meaning: 'A ≤ₚ B and a B-solver answers A; reduce TO a problem with a solver' },
              { sym: 'both directions', meaning: 'x ∈ A ⟹ f(x) ∈ B is easy; the converse is where a broken gadget shows' },
              { sym: 'composition', meaning: 'A ≤ₚ B and B ≤ₚ C gives A ≤ₚ C, and the backward maps compose in reverse' }
            ]
          },
          {
            label: 'The 3-SAT → independent set gadget',
            expr: 'one vertex per literal occurrence, a triangle per clause, an edge between complementary literals',
            terms: [
              { sym: 'the triangles', meaning: 'at most one vertex per clause can be chosen' },
              { sym: 'the target size m', meaning: 'exactly one per clause, which is the choice of satisfying literal' },
              { sym: 'the consistency edges', meaning: 'x and ¬x are never both chosen' },
              { sym: 'measured', meaning: '9 clauses become 27 vertices and 54 edges, asking for a set of 9' }
            ]
          },
          {
            label: 'The audit: every reduction, both answers',
            expr: 'target-solve steps, satisfiable source · unsatisfiable source',
            terms: [
              { sym: '3-SAT → independent set', meaning: '10 · 4 662' },
              { sym: '3-SAT → clique', meaning: '10 · 5 279' },
              { sym: '3-SAT → 3-colouring', meaning: '221 · 127 382' },
              { sym: 'vertex cover → set cover, subset sum → partition', meaning: '8 · 0 and 1 712 · 4 096' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The forward map runs in polynomial time and never calls the solver',
          why: 'It is what makes the relation compose and what makes a hardness argument valid.',
          breaks: 'A "reduction" that solves part of the source problem to decide how to build the target proves nothing about either.'
        },
        {
          name: 'The mapped-back answer satisfies the SOURCE instance',
          why: 'It is the only check that catches a gadget that is correct forwards and wrong backwards.',
          breaks: 'Validating with code derived from the encoder checks the encoder against itself and agrees with a wrong one.'
        },
        {
          name: 'The two answers agree on unsatisfiable sources as well as satisfiable ones',
          why: 'A gadget that is too permissive makes an unsatisfiable source produce a solvable target.',
          breaks: 'Testing only on satisfiable instances misses exactly the direction that fails.'
        }
      ],
      complexity: [
        { operation: '3-SAT → independent set, forward', average: 'O(m·k + n²) for m clauses of k literals', worst: '27 vertices and 54 edges from 9 clauses' },
        { operation: 'solving the independent-set target', average: '10 steps on a satisfiable source', worst: '4 662 on the eight-clause unsatisfiable core' },
        { operation: '3-SAT → 3-colouring, forward', average: '2n + 3 palette vertices plus 6 per clause', worst: '57 vertices and 108 edges from 8 clauses' },
        { operation: 'solving the 3-colouring target', average: '221 steps on a satisfiable source', worst: '127 382 on the unsatisfiable core — 27× the independent-set route' },
        { operation: 'subset sum → partition', average: 'O(n), adding two numbers', worst: '1 712 steps to solve at n = 10, 4 096 on the unsolvable instance' },
        { operation: 'the backward map', average: 'O(|answer|) in every reduction here', worst: 'the same; it is a read, not a search' }
      ],
      failureModes: [
        {
          symptom: 'A hardness argument is presented and proves nothing.',
          cause: 'The reduction runs from the new problem to a known-hard one, which is the direction that gives a solver rather than a lower bound.',
          fix: 'Say the sentence out loud: "I am reducing X to Y, so Y is at least as hard as X". If X is your problem, the argument is backwards.'
        },
        {
          symptom: 'The encoding answers correctly on every test and wrongly in production.',
          cause: 'A gadget is too permissive, so the target has solutions the source cannot explain; every test instance happened to be satisfiable.',
          fix: 'Round-trip on unsatisfiable sources too, and validate every mapped answer against the source instance.'
        },
        {
          symptom: 'The reduction is fast and the pipeline is unusably slow.',
          cause: 'The difficulty moved to the target solver, which is where it always goes.',
          fix: 'Point the reduction at a real solver rather than a hand-written search, and price the target instance before choosing it.'
        },
        {
          symptom: 'Two reductions of the same source disagree about the answer.',
          cause: 'One of the two gadgets is wrong; the agreement check is what surfaced it.',
          fix: 'Run both against a brute-force oracle on small instances until they agree, then keep the oracle as a test.'
        }
      ],
      inTheWild: [
        'Encoding scheduling, allocation and configuration into SAT or ILP so a solver can be called, which is most industrial use of this material.',
        'Proving a new problem hard by reduction from 3-SAT, vertex cover or subset sum, which is how nearly every hardness result is obtained.',
        'Turning an optimisation problem into a sequence of decision calls with a binary search over the bound — a Turing reduction.',
        'Compilers reducing register allocation to graph colouring, which is the same map read as an engineering decision.'
      ],
      sources: [
        { title: 'Karp — Reducibility among combinatorial problems (1972)', note: 'the twenty-one problems and the chain between them' },
        { title: 'Garey and Johnson — Computers and Intractability, chapter 3', note: 'the gadget constructions, and the discipline for stating them' },
        { title: 'Arora and Barak, chapter 2', note: 'many-one against Turing reductions, and why the distinction matters' },
        { title: 'Levin — Universal sequential search problems (1973)', note: 'the independent result, and the search-to-search form the backward map belongs to' }
      ]
    },

    'sat-zoo': {
      summary: 'Six clause families of one size with their DPLL node counts, the pigeonhole ' +
        'family from three to eight holes fitting 2·h! − 1 exactly, Karp’s chain as a table of ' +
        'gadgets, and the polynomial fragments with their real algorithms.',
      intuition: 'SAT sits at the root because every computation can be written as clauses, and ' +
        'the practically important half is the fragments of it that are polynomial.',
      formulation: {
        equations: [
          {
            label: 'Cook–Levin, in one line',
            expr: 'φ(x) encodes: the tape starts with x, each step obeys the transition table, the last state accepts',
            terms: [
              { sym: 'the variables', meaning: 'one per (cell, symbol, time) and one per (state, time)' },
              { sym: 'why it is polynomial', meaning: 'a polynomial-time machine runs for polynomially many steps on polynomially much tape' },
              { sym: 'what it gives', meaning: 'every problem in NP reduces to SAT, so SAT is NP-complete' },
              { sym: 'why 3-CNF too', meaning: 'wide clauses chain through fresh variables, linearly and equisatisfiably' }
            ]
          },
          {
            label: 'Six families at 42 variables, seed 3',
            expr: 'clauses · linear-time steps · DPLL nodes · conflicts',
            terms: [
              { sym: 'Horn, satisfiable', meaning: '85 · 170 · 1 · 0 — propagation alone, no branching' },
              { sym: 'Horn, contradictory', meaning: '87 · 86 · 1 · 1 — still no branching on the NO side' },
              { sym: 'random 3-SAT at 2, 4.27, 8', meaning: '84/179/336 clauses · 15/30/53 nodes · 1/11/27 conflicts' },
              { sym: 'PHP(6)', meaning: '133 · — · 1 439 · 720, on fewer clauses than the ratio-8 row' }
            ]
          },
          {
            label: 'The pigeonhole family, measured against a closed form',
            expr: 'nodes = 2·h! − 1 and conflicts = h!, at every size',
            terms: [
              { sym: 'h = 3 to 8', meaning: '11, 47, 239, 1 439, 10 079, 80 639 nodes' },
              { sym: 'the ratio to 2·h! − 1', meaning: '1.0000 in every row' },
              { sym: 'the formula size', meaning: '22 to 297 clauses — quadratic, not exponential' },
              { sym: 'why no solver escapes it', meaning: 'Haken: every resolution refutation is exponential, and clause learning is resolution' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'A Horn formula has at most one positive literal per clause',
          why: 'It is a one-pass syntactic check, and it is what makes unit propagation complete for the fragment.',
          breaks: 'One clause with two positive literals — an alternative dependency — takes the instance out of the fragment entirely.'
        },
        {
          name: 'Unit propagation on a Horn formula reaches the minimal model',
          why: 'It sets a variable true only when a clause forced it, so nothing true is unnecessary.',
          breaks: 'Seeding the propagation with anything true breaks minimality, and the "smallest set of packages" answer stops being smallest.'
        },
        {
          name: 'toThreeCnf preserves satisfiability, not the set of models',
          why: 'The fresh chain variables add models of their own; equisatisfiability is what the reduction needs and all it gives.',
          breaks: 'Counting solutions of the 3-CNF and reporting them as solutions of the source over-counts by the chain variables.'
        }
      ],
      complexity: [
        { operation: 'Horn-SAT by unit propagation', average: 'O(total literals) — 170 clause visits on 85 clauses', worst: 'the same; it never branches' },
        { operation: '2-SAT by strongly connected components', average: 'O(n + m)', worst: 'the same; the implication graph is built once' },
        { operation: 'XOR-SAT by Gaussian elimination', average: 'O(n³) over GF(2)', worst: 'the same; it is linear algebra, not search' },
        { operation: 'DPLL on random 3-SAT at 42 variables', average: '15 to 53 nodes across ratios 2 to 8', worst: 'exponential; the peak is at the threshold, measured in section 20.8' },
        { operation: 'DPLL on PHP(h)', average: 'exactly 2·h! − 1 nodes', worst: '80 639 nodes on 297 clauses at h = 8' },
        { operation: 'toThreeCnf', average: 'O(total literals), adding k − 3 variables per clause of width k', worst: 'linear growth in both clauses and variables' }
      ],
      failureModes: [
        {
          symptom: 'A dependency resolver is instantaneous most days and hangs occasionally.',
          cause: 'The requirement graph is Horn and something added an alternative dependency, which is a clause with two positive literals.',
          fix: 'Check the fragment: one pass over the clauses tells you whether you are in P or in NP, and which clause took you out.'
        },
        {
          symptom: 'A SAT solver is benchmarked as fast and then fails on a small instance.',
          cause: 'The benchmark had no structural family in it; pigeonhole-shaped constraints are exponential for every resolution solver.',
          fix: 'Include PHP and a threshold-ratio family in the benchmark, and treat cardinality constraints as a known hazard.'
        },
        {
          symptom: 'Converting to 3-CNF changed the number of solutions.',
          cause: 'The chain variables have free values whenever the clause is already satisfied.',
          fix: 'Use the conversion for satisfiability only; for counting, project onto the original variables or do not convert.'
        },
        {
          symptom: 'A constraint problem is assumed hard without checking.',
          cause: 'Schaefer’s dichotomy was not applied; the relations may all be Horn, dual-Horn, bijunctive or affine.',
          fix: 'Classify the relations first. The check costs one pass and the answer is either a polynomial algorithm or a definite NP-completeness.'
        }
      ],
      inTheWild: [
        'Package managers: apt, dnf and Cargo resolve dependency graphs that are Horn until alternatives and conflicts appear.',
        'Datalog and Prolog without negation: Horn clauses evaluated to a fixed point, which is the same algorithm.',
        'Static analysis and type inference: many constraint systems are 2-SAT or XOR-SAT shaped and are solved as such.',
        'Hardware verification: industrial CNF with millions of variables, solved in seconds, next to pigeonhole-shaped instances that are not.'
      ],
      sources: [
        { title: 'Cook (1971) and Levin (1973)', note: 'the two independent completeness proofs' },
        { title: 'Karp — Reducibility among combinatorial problems', note: 'the chain from SAT outward' },
        { title: 'Schaefer — The complexity of satisfiability problems (1978)', note: 'the dichotomy: in P or NP-complete, nothing between' },
        { title: 'Haken — The intractability of resolution (1985)', note: 'why the pigeonhole formula defeats every resolution-based solver' },
        { title: 'Dowling and Gallier — Linear-time algorithms for testing the satisfiability of propositional Horn formulae', note: 'the Horn algorithm and its minimal model' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));

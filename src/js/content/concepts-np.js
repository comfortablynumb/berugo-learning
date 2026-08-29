/** Concepts for decision problems, reductions and the SAT zoo (M20.1-M20.3). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'decision-problems': [
      {
        term: 'A decision problem is a yes-or-no question, and that restriction costs nothing',
        plain: 'Ask "is there an answer of size at most k?" instead of "what is the best answer?".',
        formal: 'the optimisation form is recovered by binary search over k, at a cost of O(log range) decision calls',
        readAs: 'The optimisation answer follows from a number of decision calls proportional ' +
          'to the logarithm of the range of possible answers.',
        detail: 'Complexity theory is built on languages — sets of strings — so a decision ' +
          'problem *is* a language and the whole apparatus applies to it directly. The reason ' +
          'this is not a loss is that the two forms are equivalent up to a logarithmic factor: ' +
          'ask "is there a cover of size at most 10?", then 5, then 7, and a dozen calls locate ' +
          'the optimum exactly. Every hardness result in this milestone is stated about the ' +
          'decision form for that reason, and every one of them transfers to the version you ' +
          'actually want.',
        example: 'The demo asks for a Hamiltonian CYCLE rather than the shortest tour, and for a ' +
          'clique of size 5 rather than the largest clique.'
      },
      {
        term: 'NP is defined by checking, not by searching',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["a yes instance"] --> B["has a short certificate"]',
            '    B --> C["which a fast checker accepts"]',
            '    C --> D["that is the whole definition of NP"]',
            '    D --> E["nothing in it says finding<br/>the certificate is hard —<br/>or that it is easy"]'
          ].join('\n'),
          caption: 'NP is a statement about verification. The famous open question is whether searching is harder than checking, which the definition deliberately leaves alone.'
        },
        plain: 'A problem is in NP when every yes instance has a short certificate a fast checker accepts.',
        formal: 'L ∈ NP ⟺ ∃ polynomial-time V and polynomial p with x ∈ L ⟺ ∃c, |c| ≤ p(|x|), V(x, c) accepts',
        readAs: 'A language is in NP exactly when there is a polynomial-time verifier and a ' +
          'polynomial bound such that a string is in the language exactly when some certificate ' +
          'no longer than that bound makes the verifier accept.',
        detail: 'This is the definition worth carrying around, because it is the one that ' +
          'explains what these problems have in common in practice: easy to check, hard to ' +
          'find. The N does not stand for "not polynomial" — it stands for nondeterministic, ' +
          'and the certificate is exactly what a nondeterministic machine would guess. Reading ' +
          'NP as a statement about verification rather than about search is what makes ' +
          'proof-of-work, verifiable computation and auditable heuristics obvious rather than ' +
          'surprising.',
        example: 'The demo verifies a 12-vertex Hamiltonian certificate in 24 steps and searches ' +
          'for one on an instance that has none in 4 794.'
      },
      {
        term: 'The gap between checking and searching is invisible on YES instances',
        plain: 'A search often stumbles onto a planted answer faster than the verifier checks it.',
        formal: 'search cost on a planted YES instance is a property of the generator, not of the problem',
        detail: 'A backtracking search on a graph built around a planted Hamiltonian cycle ' +
          'wanders into that cycle early, because the generator put a great many edges along it. ' +
          'The demo shows a column where the search on a YES instance costs less than the ' +
          'verifier does, which is a genuinely misleading measurement and is exactly why the NO ' +
          'side is the one that matters. Proving there is no answer requires exhausting the ' +
          'space, and no amount of luck shortens that.',
        example: 'On the demo’s 3-colouring row the search finds the planted colouring in 13 ' +
          'steps against 20 to verify one, and needs 2 213 to refute the obstructed instance.'
      },
      {
        term: 'A verifier must reject malformed certificates as firmly as wrong ones',
        plain: 'A short array, a repeated index or a colour outside the palette is a rejection, not a crash.',
        formal: 'V must be total: it returns accept or reject on every input, including ill-formed ones',
        detail: 'The moment anything untrusted supplies the certificate — which is the whole ' +
          'point of proof-of-work and of verifiable computation — the verifier is a security ' +
          'boundary. A verifier that throws on a malformed input is a denial-of-service vector; ' +
          'one that accidentally accepts is worse. Every verifier in this milestone returns a ' +
          'named reason for every rejection, and the demo feeds each of them a corrupted ' +
          'certificate and a structurally malformed one to show that it does.',
        example: 'The demo rejects a repeated vertex, an out-of-range subset-sum index and a ' +
          'three-vertex clique offered as a five-vertex one, each with a stated reason.'
      },
      {
        term: 'co-NP is the mirror, and it is not known to be the same class',
        plain: 'Nobody knows a short certificate for "this formula is unsatisfiable".',
        formal: 'co-NP = { L : complement of L ∈ NP }; NP = co-NP is open, and would follow from P = NP',
        readAs: 'co-NP is the set of languages whose complement is in NP; whether NP and '
          + 'co-NP are the same class is open, and they would be equal if P equalled NP.',
        detail: 'Every NP problem has short evidence for YES and, as far as anybody knows, none ' +
          'for NO. That asymmetry has a very concrete consequence: a SAT solver answering SAT ' +
          'hands you an assignment anybody can check in milliseconds, and a solver answering ' +
          'UNSAT hands you either a resolution proof measured in gigabytes or nothing at all. ' +
          'Every "the solver says it is infeasible" conversation in section 20.9 traces back to ' +
          'this, and so does every design that logs a certificate rather than a claim.',
        example: 'The demo’s problem table has no row for "this formula is unsatisfiable", and ' +
          'that missing row is co-NP.'
      },
      {
        term: 'NP-hard and NP-complete are different claims',
        plain: 'NP-hard means everything in NP reduces to it; NP-complete means that and being in NP.',
        formal: 'L is NP-hard when ∀ A ∈ NP, A ≤ₚ L; NP-complete when additionally L ∈ NP',
        readAs: 'A language is NP-hard when every language in NP reduces to it in polynomial ' +
          'time, and NP-complete when it is also itself in NP.',
        detail: 'The distinction is not pedantry. The halting problem is NP-hard and is not in ' +
          'NP — it is not decidable at all — so "NP-hard" on its own carries no promise that an ' +
          'answer can even be recognised, let alone found. When a paper or a colleague says ' +
          '"NP-hard", the useful question is whether membership in NP was also established, ' +
          'because that is what tells you whether a certificate exists and therefore whether a ' +
          'checker can be built.',
        example: 'The optimisation form of TSP is NP-hard; the decision form "is there a tour ' +
          'under length L?" is NP-complete, and only the second has a certificate.'
      },
      {
        term: 'Easy to check and hard to find is a product, not a problem',
        plain: 'Proof-of-work, verifiable computation and puzzle-based rate limiting all live in that gap.',
        formal: 'a proof-of-work puzzle asks for a nonce with H(block ‖ nonce) < target: one hash to verify, 2ᵈ expected to find',
        readAs: 'Find a nonce such that the hash of the block concatenated with it is below the ' +
          'target; verifying costs one hash and finding one costs two to the difficulty in ' +
          'expectation.',
        detail: 'Every protocol in this family is the same shape: an asymmetric cost where the ' +
          'party doing the work pays a great deal more than the party checking it. That ' +
          'asymmetry is not a bug in the problem, it is the mechanism — it is what makes the ' +
          'work costly to fake and cheap to audit. Reading NP as "the class of problems with ' +
          'that asymmetry" makes the design space obvious: any NP-complete problem with a ' +
          'tunable difficulty dial is a candidate puzzle.',
        example: 'The demo measures the same asymmetry directly: 24 steps to verify against ' +
          '4 794 to refute, and the ratio grows without bound with instance size.'
      },
      {
        term: 'P versus NP is about certificates, not about cleverness',
        plain: 'It asks whether everything checkable quickly is also solvable quickly.',
        formal: 'P = NP would mean every polynomial-time verifier can be turned into a polynomial-time solver',
        detail: 'The practical value of the question is not the prize. It is that fifty years of ' +
          'concentrated attack have produced no algorithm and no proof, which is the strongest ' +
          'available evidence that a specific NP-complete problem in front of you is not about ' +
          'to fall to a better algorithm. That is what justifies spending the effort on ' +
          'approximation, parameterisation, encoding and heuristics instead — the moves the rest ' +
          'of this milestone is about — rather than on one more attempt at an exact ' +
          'polynomial method.',
        example: 'The demo’s cost sweep grows by a factor of about 1.96 per extra vertex over ' +
          'eight sizes, with no sign of the polynomial anybody would need.'
      }
    ],

    reductions: [
      {
        term: 'A many-one reduction maps instances, not answers',
        plain: 'Turn an instance of your problem into an instance of a problem you can solve, with the same answer.',
        formal: 'A ≤ₚ B when ∃ polynomial-time f with x ∈ A ⟺ f(x) ∈ B',
        readAs: 'A reduces to B in polynomial time when there is a polynomial-time function f ' +
          'such that x is a yes instance of A exactly when f of x is a yes instance of B.',
        detail: 'The map runs before the solver and produces a new instance; it does not get to ' +
          'call the solver, look at the answer and adjust. That restriction is what makes the ' +
          'relation compose cleanly and what makes it a proof device: if A reduces to B and B ' +
          'were easy, A would be too. The same map read the other way is a way to SOLVE A by ' +
          'calling a solver for B, which is the reading almost every practical use depends on.',
        example: 'The demo turns 5 variables and 9 clauses into a graph on 27 vertices and 54 ' +
          'edges in a single pass, with no solving involved.'
      },
      {
        term: 'The arrow points from what you want to solve to what you can call',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["reduce YOUR problem to SAT"] --> B["you can now use a SAT solver"]',
            '    C["reduce SAT to YOUR problem"] --> D["your problem is at least as hard"]',
            '    B --> E["the direction is the entire claim"]',
            '    D --> E',
            '    E --> F["getting it backwards proves<br/>the opposite of what you meant"]'
          ].join('\n'),
          caption: 'The same construction read in either direction says two opposite things: one gives you a tool, the other gives you a hardness proof.'
        },
        plain: 'Reducing your problem to SAT lets you use a solver; reducing SAT to your problem proves yours is hard.',
        formal: 'A ≤ₚ B proves B is at least as hard as A, and lets a B-solver answer A',
        detail: 'This is the mistake everybody makes once, and the code still runs when it is ' +
          'made. If your goal is a hardness argument you must reduce a KNOWN-hard problem to ' +
          'yours; if your goal is a solver you must reduce yours to a problem with a solver. ' +
          'Writing the reduction the wrong way round produces a program that computes something, ' +
          'terminates, and proves nothing whatsoever. The direction is worth saying out loud ' +
          'every time: "I am reducing X to Y, so Y is at least as hard as X".',
        example: 'The demo reduces 3-SAT to independent set, so independent set is at least as ' +
          'hard as 3-SAT — and the same code solves 3-SAT by calling an independent-set solver.'
      },
      {
        term: 'A gadget simulates one piece of the source inside the target',
        plain: 'A clause becomes a triangle; a variable becomes a pair of opposite vertices.',
        formal: 'the 3-SAT → independent set gadget: one vertex per literal occurrence, a triangle per clause, an edge between every x and every ¬x',
        readAs: 'Reducing 3-SAT to independent set: make one vertex for every literal '
          + 'occurrence, join the three vertices of each clause into a triangle, and join '
          + 'every vertex for x to every vertex for not-x.',
        detail: 'The triangle enforces "at most one literal chosen per clause", and asking for a ' +
          'set of size m — one per clause — upgrades that to exactly one, which is the choice of ' +
          'which literal satisfies the clause. The edges between complementary literals enforce ' +
          'consistency across clauses. Those two sentences are the entire correctness proof, and ' +
          'they are worth learning as a pattern: a gadget encodes a local choice, and a second ' +
          'edge family enforces the global consistency the choices must respect.',
        example: 'The demo shows 9 clause triangles over 27 vertices, and highlights the one ' +
          'vertex the solver chose in each — reading them down the table is the assignment.'
      },
      {
        term: 'Correctness is two implications and the second is the one that fails',
        plain: 'Source YES implies target YES is easy; target YES implies source YES is where the bugs are.',
        formal: 'x ∈ A ⟹ f(x) ∈ B is usually by construction; f(x) ∈ B ⟹ x ∈ A is the direction a broken gadget loses',
        readAs: 'x being a yes instance of A implies f of x is a yes instance of B, which '
          + 'usually comes for free; the converse — f of x being a yes instance implies x '
          + 'is one — is the direction a broken gadget loses.',
        detail: 'The forward direction is easy because you built the target from a solution you ' +
          'were holding. The backward direction says the target has no solutions the source ' +
          'cannot explain, and a gadget that is slightly too permissive breaks it silently: the ' +
          'target is solvable, the backward map returns something, and the something is not an ' +
          'answer to the original question. The only way to observe that is to check the mapped ' +
          'answer against the source instance itself.',
        example: 'The demo’s fourth step verifies the mapped assignment against the ORIGINAL ' +
          'formula, and reports "valid" or a named reason.'
      },
      {
        term: 'The backward map is what turns a proof into a solver',
        plain: 'Map the target’s answer back to the source, or you have proved hardness and solved nothing.',
        formal: 'the pair (f, g) with g mapping a B-certificate to an A-certificate is a Levin reduction',
        detail: 'A textbook reduction usually stops at the equivalence, because a proof needs no ' +
          'more. An engineering reduction must carry the inverse: the whole reason to encode a ' +
          'problem into SAT is to get an answer back out. The backward map is typically four ' +
          'lines — read the chosen literals, take the complement of the set, drop the two added ' +
          'numbers — and it is the difference between "this is NP-hard, sorry" and "this is ' +
          'NP-hard, so here is the encoding and here is your schedule".',
        example: 'Independent set → assignment is one line per chosen vertex; set cover → vertex ' +
          'cover is reading the set indices as vertex indices.'
      },
      {
        term: 'A Turing reduction may call the oracle many times',
        plain: 'Binary searching over k with a decision solver is a reduction too, just a weaker kind.',
        formal: 'A ≤ᵀ B when A is decidable by a polynomial-time machine with an oracle for B',
        readAs: 'A Turing-reduces to B when a polynomial-time machine that may consult a B-oracle ' +
          'decides A.',
        detail: 'Many-one reductions make one call and return its answer unchanged; Turing ' +
          'reductions may call repeatedly and do arbitrary polynomial work between calls. Every ' +
          '"minimise k" wrapper around a SAT solver is a Turing reduction, and so is every ' +
          'branch-and-bound loop that consults a feasibility check. The weaker relation is ' +
          'sufficient for almost every practical purpose and insufficient for some theoretical ' +
          'ones — notably it does not distinguish NP from co-NP, which is exactly why hardness ' +
          'proofs use the many-one form.',
        example: 'Turning "is there a cover of size ≤ k?" into "what is the smallest cover?" is a ' +
          'Turing reduction with about log n calls.'
      },
      {
        term: 'Reductions compose, which is why one theorem covers thousands of problems',
        plain: 'A reduces to B and B to C gives A reduces to C, by running the maps in sequence.',
        formal: 'A ≤ₚ B and B ≤ₚ C ⟹ A ≤ₚ C; the composition of two polynomials is a polynomial',
        readAs: 'If A reduces to B in polynomial time and B reduces to C in polynomial '
          + 'time, then A reduces to C, because one polynomial of another is a polynomial.',
        detail: 'This is why Cook–Levin is enough. It puts every problem in NP at the top of a ' +
          'chain that reaches SAT, and every subsequent hardness result is one more link rather ' +
          'than a proof from first principles. Composition also works on the backward maps, run ' +
          'in reverse order, so a chain of reductions is still a solver — which is what makes a ' +
          'long encoding pipeline into a solver rather than only an argument.',
        example: '3-SAT → independent set → vertex cover → set cover is three links, and the ' +
          'demo round-trips each of them.'
      },
      {
        term: 'The reduction is cheap and solving the target is not',
        plain: 'Building the target instance is one pass; answering it is exponential.',
        formal: 'f runs in polynomial time by definition; the B-solver carries all the difficulty',
        detail: 'It is easy to be impressed by a reduction and forget that it has moved the ' +
          'difficulty rather than removed it. The demo makes the split visible: the forward map ' +
          'is instant on any instance a browser can hold, and the exhaustive search on the ' +
          'target is what limits the demo to five variables. That is precisely the argument for ' +
          'pointing reductions at a real solver rather than at a hand-written search, which is ' +
          'what section 20.7 is about.',
        example: 'The demo’s unsatisfiable source takes 4 662 steps to refute through independent ' +
          'set and 127 382 through 3-colouring, from nine clauses.'
      }
    ],

    'sat-zoo': [
      {
        term: 'Cook–Levin encodes a computation as a formula',
        plain: 'Variables say what is on the tape at each step; clauses say each step follows the rules.',
        formal: 'for any L ∈ NP with verifier V, build φ(x) satisfiable ⟺ ∃c with V(x, c) accepting in p(|x|) steps',
        readAs: 'For any language in NP with verifier V, construct a formula that is satisfiable ' +
          'exactly when some certificate makes V accept within the polynomial step bound.',
        detail: 'The construction is mechanical: one variable per (tape cell, symbol, time step) ' +
          'and one per (state, time step), plus clauses saying the tape starts with the input, ' +
          'each configuration follows the transition table, and the last one accepts. Its size ' +
          'is polynomial because the machine runs for polynomially many steps on polynomially ' +
          'much tape. That single theorem is why SAT rather than some other problem sits at the ' +
          'root of every hardness argument in this milestone.',
        example: 'The demo’s reduction chain begins at "any NP problem → SAT" with Cook–Levin as ' +
          'the gadget, and every arrow after it is one construction.'
      },
      {
        term: '3-CNF is not weaker than CNF',
        plain: 'Any wide clause becomes a chain of three-literal clauses linked by fresh variables.',
        formal: '(l₁ ∨ … ∨ lₖ) becomes (l₁ ∨ l₂ ∨ y₁) ∧ (¬y₁ ∨ l₃ ∨ y₂) ∧ … , adding k − 3 variables',
        readAs: 'A clause of k literals becomes a chain of three-literal clauses linked by k ' +
          'minus three fresh variables.',
        detail: 'The fresh variables act as a carry: y₁ is forced true only when the first two ' +
          'literals fail, which passes the obligation down the chain. Satisfiability is ' +
          'preserved exactly and the formula grows linearly, so 3-SAT is NP-complete too. 3-SAT ' +
          'is then the convenient root for gadget constructions because a clause of exactly ' +
          'three literals has a fixed small shape — a triangle, a three-way choice, three digits ' +
          '— that a gadget can be designed around once and reused.',
        example: 'The module’s toThreeCnf converts width-5 clauses and the tests check the result ' +
          'is equisatisfiable with the source on every fixture.'
      },
      {
        term: 'Karp’s chain is twenty-one problems and each link is one gadget',
        plain: 'Independent set, clique and vertex cover are the same problem read three ways.',
        formal: 'S is independent in G ⟺ S is a clique in the complement of G ⟺ V ∖ S is a vertex cover of G',
        readAs: 'A set is independent in a graph exactly when it is a clique in the complement, ' +
          'and exactly when everything outside it is a vertex cover.',
        detail: 'Recognising that three named problems are one problem in three costumes is ' +
          'worth more than memorising the chain, because it means a solver for any of them ' +
          'answers all three with a two-line transformation. The rest of the chain splits into ' +
          'branches: set cover generalises vertex cover, subset sum and partition are the ' +
          'arithmetic branch, 3-colouring and Hamiltonian cycle are the graph branch. A new ' +
          'hardness proof is one link from whichever of these your problem most resembles.',
        example: 'The demo’s chain table lists nine links, and the first five are implemented and ' +
          'round-tripped in section 20.2.'
      },
      {
        term: 'Horn-SAT is decided by unit propagation, in linear time',
        plain: 'At most one positive literal per clause, and propagation alone gives the answer.',
        formal: 'a Horn clause has at most one positive literal; (¬A ∨ B) is exactly "A requires B"',
        readAs: 'A Horn clause has at most one positive literal; not-A or B says exactly '
          + 'that A requires B.',
        detail: 'Start with everything false and repeatedly find a clause that is not yet ' +
          'satisfied: if it has a positive literal, that literal is forced true, and if it has ' +
          'none the formula is unsatisfiable. The fixed point is the MINIMAL model — the ' +
          'smallest set of variables that has to be true — which for a dependency graph is ' +
          'exactly the smallest set of packages that satisfies the requirements. The algorithm ' +
          'and the answer people actually want are the same object.',
        example: 'The demo decides an 85-clause Horn instance in 170 clause visits, and DPLL ' +
          'never branches on it at all — 1 search node.'
      },
      {
        term: 'One alternative dependency changes the complexity class',
        plain: '"A requires B or C" has two positive literals, so it is not Horn.',
        formal: '(¬A ∨ B ∨ C) is not Horn; adding conflicts (¬B ∨ ¬C) to a non-Horn formula gives general SAT',
        readAs: 'Not-A or B or C has two positive literals, so it is not Horn; adding '
          + 'not-B or not-C on top of that gives general satisfiability.',
        detail: 'This is the honest explanation for why some package resolvers are instantaneous ' +
          'and others occasionally hang: they are not the same algorithm on different inputs, ' +
          'they are different problems. Pure requirements are Horn and propagate; a virtual ' +
          'package with two providers is a disjunction with two positive literals and is not; ' +
          'combine that with conflicts and you have general satisfiability. Knowing which clause ' +
          'broke the fragment turns "the resolver is slow sometimes" into an engineering ' +
          'trade-off somebody can decide about.',
        example: 'The demo shows the Horn rows at 1 search node and the non-Horn rows branching, ' +
          'at the same variable count.'
      },
      {
        term: '2-SAT and XOR-SAT are polynomial for completely different reasons',
        plain: 'One is strongly connected components; the other is Gaussian elimination.',
        formal: '2-SAT: unsatisfiable ⟺ some x and ¬x share a strongly connected component of the implication graph. XOR-SAT: solve over GF(2)',
        readAs: 'A two-literal formula is unsatisfiable exactly when some variable and its ' +
          'negation lie in the same strongly connected component of the implication graph; a ' +
          'parity formula is solved by Gaussian elimination over the two-element field.',
        detail: 'These are not variations on one technique. A 2-clause is two implications, so ' +
          'the whole formula is a graph and reachability decides it in linear time. A parity ' +
          'constraint is a linear equation, so the whole formula is a linear system and ' +
          'elimination decides it in cubic time. Schaefer’s dichotomy says these — with Horn, ' +
          'dual-Horn and two trivial families — are the only polynomial cases, and everything ' +
          'else is NP-complete with nothing in between.',
        example: 'The demo lists all three islands with their algorithms, and each is a genuine ' +
          'polynomial method rather than a heuristic that usually works.'
      },
      {
        term: 'The pigeonhole formula is the counter-example to "solvers are fast now"',
        plain: 'A fact a human sees instantly costs a resolution solver exponentially many steps.',
        formal: 'PHP(n): n + 1 pigeons, n holes, one clause per pigeon and one per colliding pair; Haken proved every resolution refutation is exponential',
        detail: 'The formula has O(n³) clauses and says something obviously false, and no ' +
          'resolution-based solver — which is every CDCL solver, since clause learning is ' +
          'resolution — can refute it in polynomial time. That is a theorem about the PROOF ' +
          'SYSTEM rather than about any implementation, so it will not be fixed by a better ' +
          'heuristic. When somebody says modern solvers handle millions of variables, an ' +
          'eight-hole pigeonhole instance with 297 clauses is the reply.',
        example: 'The demo measures 11, 47, 239, 1 439, 10 079 and 80 639 nodes for three to ' +
          'eight holes — exactly 2·h! − 1 at every size, with h! conflicts.'
      },
      {
        term: 'Schaefer’s dichotomy says there is no middle',
        plain: 'A Boolean constraint problem is either in P or NP-complete, with nothing in between.',
        formal: 'every Boolean CSP is polynomial if all relations are Horn, dual-Horn, bijunctive, affine, 0-valid or 1-valid; otherwise NP-complete',
        detail: 'Dichotomy theorems are rare and this one is unusually useful, because it turns ' +
          '"probably somewhere in between" into an unavailable answer. For a Boolean constraint ' +
          'problem the only question is which of six families your relations fall into, and ' +
          'that is a syntactic check over the clause list costing one pass. It is worth running ' +
          'before assuming the worst, because the check is free relative to solving and the six ' +
          'families cover a large fraction of the constraint logic that turns up in ' +
          'configuration, permissions and dependency systems.',
        example: 'The demo’s island table names five fragments; three of them have running ' +
          'algorithms in this milestone and the section states the other two rather than ' +
          'implying they are the same kind of claim.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));

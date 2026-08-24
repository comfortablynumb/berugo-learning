/** Reference entries for Turing machines, models, undecidability and Rice (M26.1-M26.4). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'turing-machines': {
      summary: 'A simulator with three outcomes rather than two, an aⁿbⁿcⁿ machine checked ' +
        'against an independent definition over all 3 280 strings up to length 7, and a step ' +
        'budget that is reported as its own answer rather than folded into a rejection.',
      intuition: 'A model this weak that computes everything computable is what makes a limit ' +
        'proved here a limit on computation rather than on one formalism.',
      formulation: {
        equations: [
          {
            label: 'The model',
            expr: 'delta: Q × Γ → Q × Γ × {L, R, S}',
            readAs: 'The transition takes a state and the symbol under the head, and gives back ' +
              'a state, a symbol to write, and a direction to move.',
            terms: [
              { sym: 'a configuration', meaning: 'state, tape and head position — the complete description' },
              { sym: 'a missing transition', meaning: 'the machine halts where it is; no reject state is needed' },
              { sym: 'accept', meaning: 'halted in an accepting state' },
              { sym: 'budget', meaning: 'a THIRD outcome, and folding it into rejection is a lie about the language' }
            ]
          },
          {
            label: 'The cost of aⁿbⁿcⁿ, measured',
            expr: 'triples · tokens · steps · tape cells',
            terms: [
              { sym: '1', meaning: '3 · 16 · 5' },
              { sym: '2', meaning: '6 · 37 · 8' },
              { sym: '3', meaning: '9 · 66 · 11' },
              { sym: '4', meaning: '12 · 103 · 14' },
              { sym: '5', meaning: '15 · 148 · 17 — quadratic time, linear space' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'A budget exhaustion is not a rejection',
          why: 'The machine may accept after a million more steps.',
          breaks: 'The looper reports `budget` at every setting and never `rejected`; a simulator that collapsed them would claim it rejects every input.'
        },
        {
          name: 'The machine is checked against a definition written from the LANGUAGE',
          why: 'A definition derived from the machine tests nothing.',
          breaks: '3 280 strings up to length 7, with 0 disagreements — and the first version of the machine failed it.'
        },
        {
          name: 'The order phase is separate from the counting phase',
          why: 'Crossing off one of each per sweep gets the counts right and says nothing about the order.',
          breaks: 'Without it the machine accepts `abcabc`, which no hand-picked test case would catch.'
        },
        {
          name: 'A machine encodes to a string and decodes back',
          why: 'Program-as-data is what the universal machine and the diagonal argument both need.',
          breaks: 'The increment machine round-trips through 116 characters and gives the same output.'
        }
      ],
      complexity: [
        { operation: 'one step', average: 'O(1) — a table lookup and a tape write', worst: 'the same' },
        { operation: 'deciding aⁿbⁿcⁿ', average: 'O(n²) — one sweep per triple', worst: 'O(n²), measured at 16, 37, 66, 103, 148' },
        { operation: 'deciding palindromes', average: 'O(n²)', worst: 'O(n²) — 66 steps for 10 symbols' },
        { operation: 'binary increment', average: 'O(n)', worst: 'O(n) — 22 steps for 10 digits' },
        { operation: 'simulating k tapes on one', average: 'quadratic slowdown', worst: 'quadratic — which keeps "polynomial time" robust' },
        { operation: 'simulating nondeterminism', average: 'exponential', worst: 'exponential — and closing that gap is P versus NP' }
      ],
      failureModes: [
        {
          symptom: 'A simulator reports that a non-halting machine rejects its input.',
          cause: 'The budget outcome was folded into rejection.',
          fix: 'Report three outcomes. The bounded question and the unbounded one are different questions.'
        },
        {
          symptom: 'A machine passes every hand-written test and accepts a string outside its language.',
          cause: 'A phase the author assumed was implied by another — here, order implied by counting.',
          fix: 'Check exhaustively against a definition written from the language.'
        },
        {
          symptom: 'A demo hangs the page.',
          cause: 'A simulator with no step bound, running a machine that does not halt.',
          fix: 'A budget is not a compromise; it is the only decidable version of the question.'
        },
        {
          symptom: 'A tape implementation breaks when the head moves left of the start.',
          cause: 'An array indexed from zero, where the model is two-way infinite.',
          fix: 'A sparse map from index to symbol, so negative indices need no special case.'
        }
      ],
      inTheWild: [
        'Every interpreter, VM and container runtime — all descendants of the universal machine.',
        'WebAssembly’s fuel metering and the EVM’s gas, both bounded halting by another name.',
        'CI time limits, query planner cost caps, and every request timeout ever configured.',
        'The Busy Beaver function, whose values are known only up to n = 5 and provably not computable in general.'
      ],
      sources: [
        { title: 'Turing — On computable numbers, with an application to the Entscheidungsproblem (1936)', note: 'the model, the universal machine and the halting argument, in one paper' },
        { title: 'Sipser — Introduction to the Theory of Computation', note: 'the standard modern treatment, and the variants' },
        { title: 'Hopcroft, Motwani and Ullman — Introduction to Automata Theory', note: 'multi-tape and nondeterministic equivalence, with the simulation costs' },
        { title: 'Aaronson — The Busy Beaver Frontier (2020)', note: 'what uncomputability looks like from the inside, with concrete numbers' }
      ]
    },

    'equivalent-models-of-computation': {
      summary: 'One function run in three models with the answers compared and the costs printed: ' +
        'a RAM takes 2 steps at every input, a counter machine 3n + 1, and a Turing machine ' +
        '2n² + 4n + 2 — 2 against 31 against 242 at n = 10.',
      intuition: 'Equal power is not equal efficiency, and the gap between those two facts is ' +
        'the whole of complexity theory.',
      formulation: {
        equations: [
          {
            label: 'Doubling, measured in three models',
            expr: 'n · RAM steps · counter steps · Turing steps',
            terms: [
              { sym: '1', meaning: '2 · 4 · 8' },
              { sym: '4', meaning: '2 · 13 · 50' },
              { sym: '10', meaning: '2 · 31 · 242' },
              { sym: 'the shapes', meaning: 'constant · 3n + 1 · 2n² + 4n + 2' },
              { sym: 'the answers', meaning: 'identical at every input — that agreement IS the equivalence' }
            ]
          },
          {
            label: 'Who simulates whom, and at what cost',
            expr: 'model · slowdown when simulating a Turing machine',
            terms: [
              { sym: 'RAM', meaning: 'constant factor, under the unit-cost model' },
              { sym: '2-counter machine', meaning: 'EXPONENTIAL, via Gödel numbering' },
              { sym: 'Rule 110', meaning: 'polynomial (Cook, 2004)' },
              { sym: 'tag system', meaning: 'polynomial — and it is what the Rule 110 proof reduces to' },
              { sym: 'SKI / lambda calculus', meaning: 'polynomial (Turing, 1937)' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Equivalence is demonstrated by execution, not asserted',
          why: 'A simulation sketch is a proof; running it is a test of the implementation.',
          breaks: 'The demo compares the answers at every input and reports 0 disagreements.'
        },
        {
          name: 'Every equivalence comes with a cost, and the cost is the part that gets dropped',
          why: '"Turing complete" says the column is finite and nothing about how it grows.',
          breaks: 'The simulation table names the slowdown for each model, and one of them is exponential.'
        },
        {
          name: 'A counter machine cannot read a register without destroying it',
          why: 'That single limitation is where the inefficiency comes from.',
          breaks: 'Doubling needs 3n + 1 steps because copying a value takes a loop.'
        },
        {
          name: 'Universality is common rather than engineered',
          why: 'An eight-entry lookup table and a queue are each enough.',
          breaks: 'Rule 110 and 2-tag systems are both universal, and neither was designed to compute anything.'
        }
      ],
      complexity: [
        { operation: 'RAM doubling', average: '2 instructions', worst: '2 — arithmetic on whole registers' },
        { operation: 'counter-machine doubling', average: '3n + 1 steps', worst: 'linear in the VALUE, exponential in the bits' },
        { operation: 'Turing doubling', average: '2n² + 4n + 2', worst: 'quadratic — the head walks the tape per symbol' },
        { operation: 'one cellular generation', average: 'O(width)', worst: 'O(width) per generation' },
        { operation: 'one SKI reduction', average: 'O(term size)', worst: 'terms can grow; the demo caps at 4 000 steps' },
        { operation: 'a tag-system step', average: 'O(1) amortised', worst: 'the word can grow without bound' }
      ],
      failureModes: [
        {
          symptom: '"It is Turing complete" is offered as an argument that a system is powerful enough.',
          cause: 'The claim is about the class of computable functions, not about cost.',
          fix: 'Ask about the cost model. A two-counter machine is universal and exponentially slow.'
        },
        {
          symptom: 'An algorithm analysed as O(n) is far slower than expected on large values.',
          cause: 'The unit-cost RAM assumption charges one step for arithmetic on unbounded integers.',
          fix: 'Use the logarithmic cost model when the values grow, which is when it matters.'
        },
        {
          symptom: 'A configuration language turns out to be accidentally Turing complete.',
          cause: 'Universality is cheap; a lookup table and recursion is usually enough.',
          fix: 'Design for termination deliberately, or accept the halting question you have created.'
        },
        {
          symptom: 'An SKI or lambda reducer runs out of memory on a small term.',
          cause: 'Reduction can grow a term without bound before it shrinks.',
          fix: 'A step cap, reported honestly — the same three-outcome discipline as the last section.'
        }
      ],
      inTheWild: [
        'Rule 110 in Wolfram’s work, and Cook’s 2004 proof of its universality.',
        'The lambda calculus under every functional language, and SKI under several compilers.',
        'Accidentally Turing-complete systems: C++ templates, Magic: the Gathering, and sendmail.cf.',
        'The unit-cost RAM, which every algorithms textbook assumes without naming.'
      ],
      sources: [
        { title: 'Minsky — Computation: Finite and Infinite Machines (1967)', note: 'two-counter universality and the Gödel-numbering encoding' },
        { title: 'Cook — Universality in Elementary Cellular Automata (2004)', note: 'the Rule 110 proof, via 2-tag systems' },
        { title: 'Post — Formal reductions of the general combinatorial decision problem (1943)', note: 'tag systems, thirty years before anybody needed them' },
        { title: 'Turing — Computability and λ-definability (1937)', note: 'the equivalence of his model with Church’s' }
      ]
    },

    'undecidability-and-diagonalisation': {
      summary: 'A contradiction produced against every candidate oracle a learner can pick — ' +
        'including one that flips a coin — with 200 arbitrary deciders defeated in the test ' +
        'suite, and bounded halting decided completely beside it.',
      intuition: 'Bounded halting is decidable and unbounded is not; every timeout in production ' +
        'software is that substitution.',
      formulation: {
        equations: [
          {
            label: 'The construction, in six lines',
            expr: 'contrary(p): if halts(p, p) then loop forever, else return',
            terms: [
              { sym: 'run it on itself', meaning: 'whatever the oracle says, the program does the other thing' },
              { sym: 'the oracle said halts', meaning: 'so it loops — the oracle was wrong' },
              { sym: 'the oracle said loops', meaning: 'so it returns — the oracle was wrong' },
              { sym: 'what it inspects', meaning: 'nothing about the oracle, which is why the theorem is universal' },
              { sym: 'measured', meaning: '200 of 200 arbitrary deciders defeated' }
            ]
          },
          {
            label: 'The three classes',
            expr: 'decidable = recognisable AND co-recognisable',
            terms: [
              { sym: 'halting', meaning: 'recognisable, not co-recognisable — run it and see, or wait forever' },
              { sym: 'looping forever', meaning: 'co-recognisable, not recognisable — the mirror image' },
              { sym: 'language equivalence', meaning: 'neither, so no partial procedure works from either side' },
              { sym: 'totality', meaning: 'neither, and strictly harder than halting' },
              { sym: 'bounded halting', meaning: 'decidable, and it is what every tool actually uses' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The oracle is genuinely called',
          why: 'A demo that describes the argument rather than running it teaches the shape and not the fact.',
          breaks: 'The verdict metric changes when you switch oracles; the contradiction metric does not.'
        },
        {
          name: 'The construction never inspects the oracle',
          why: 'That is what makes the result about EVERY program rather than the ones anyone has tried.',
          breaks: 'A heuristic, a constant, and a coin flip are all defeated by the same six lines.'
        },
        {
          name: 'The diagonal machine differs from every row at a NAMED column',
          why: '"It is not in the table" is a claim; "it differs from row 3 at column 3" is a check.',
          breaks: 'The differences table lists one row per machine, with the column and both behaviours.'
        },
        {
          name: 'Bounded halting is decided, not approximated',
          why: 'Running a machine for k steps and looking is a complete algorithm.',
          breaks: 'The bounded table changes as the budget moves, and the looper never migrates back.'
        }
      ],
      complexity: [
        { operation: 'the diagonal construction', average: 'O(size) to build the row', worst: 'O(size²) to list every difference' },
        { operation: 'defeating an oracle', average: 'one oracle call', worst: 'one — the construction is O(1) in the oracle' },
        { operation: 'bounded halting', average: 'O(k) — run it for k steps', worst: 'O(k), by definition' },
        { operation: 'unbounded halting', average: 'no algorithm exists', worst: 'no algorithm exists' }
      ],
      failureModes: [
        {
          symptom: 'A tool claims to detect infinite loops.',
          cause: 'It detects some of them, which is a different and achievable thing.',
          fix: 'State the bound. "Detects these five patterns" is honest; "detects infinite loops" is not.'
        },
        {
          symptom: 'A timeout fires and the system treats it as a definite failure.',
          cause: 'Budget exhaustion reported as a rejection.',
          fix: 'Three outcomes. The work may have succeeded a millisecond later, and the system has to say so.'
        },
        {
          symptom: 'Someone proposes solving halting with machine learning.',
          cause: 'The construction defeats any oracle, however it was produced.',
          fix: 'A learned model is a candidate decider; the same six lines beat it. Bounded halting is the achievable goal.'
        },
        {
          symptom: 'A search for a counterexample runs forever and nobody knows whether to stop.',
          cause: 'The property is recognisable but not co-recognisable, so absence is never confirmed.',
          fix: 'Bound the search and report the bound, which converts it into a decidable question.'
        }
      ],
      inTheWild: [
        'Every request timeout, CI time limit and gas meter — bounded halting standing in for the real question.',
        'Static analysers that report "possible infinite loop", which is the honest phrasing.',
        'The Collatz conjecture, whose halting for all inputs is open and would be undecidable in general.',
        'Gödel’s incompleteness theorems, which are the same diagonal argument applied to proof rather than computation.'
      ],
      sources: [
        { title: 'Turing — On computable numbers (1936)', note: 'the original argument, and the universal machine it needs' },
        { title: 'Cantor — Über eine elementare Frage der Mannigfaltigkeitslehre (1891)', note: 'the diagonal argument, fifty years earlier and about the reals' },
        { title: 'Sipser — Introduction to the Theory of Computation', note: 'decidability, recognisability and the reductions between them' },
        { title: 'Davis — Computability and Unsolvability', note: 'the enumeration reading of recognisability, in detail' }
      ]
    },

    'reductions-and-the-rice-theorem': {
      summary: 'A reduction builder that prints the transformed program, and ten properties ' +
        'classified — four undecidable by Rice, four decidable because syntactic, and two ' +
        'decidable because trivial.',
      intuition: 'Every non-trivial semantic property of programs is undecidable, so every static ' +
        'analyser gave up soundness or completeness and chose which.',
      formulation: {
        equations: [
          {
            label: 'A mapping reduction',
            expr: 'f computable with p in HALT iff f(p) in P',
            readAs: 'A computable transformation turning any program into one that has property P ' +
              'exactly when the original halts.',
            terms: [
              { sym: 'the direction', meaning: 'HALT reduces TO P, making P at least as hard — the reverse shows nothing' },
              { sym: 'the transformation', meaning: 'a source-to-source rewrite you can read' },
              { sym: 'the consequence', meaning: 'a decider for P, composed with f, decides halting' },
              { sym: 'in the demo', meaning: '5 reductions, each adding one line to the source' }
            ]
          },
          {
            label: 'Rice’s condition, applied',
            expr: 'undecidable iff semantic AND non-trivial',
            terms: [
              { sym: 'undecidable', meaning: '4 of 10 — halting, the zero function, empty language, division by zero' },
              { sym: 'semantic and trivial', meaning: '2 of 10 — decidable by a constant' },
              { sym: 'syntactic', meaning: '4 of 10 — decidable, and this is where every linter lives' },
              { sym: 'the bounded escape', meaning: '"halts within 10 000 steps" is a property of an execution, not of a function' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The reduction is printed, not described',
          why: 'The equivalence is checkable by reading the transformed source.',
          breaks: 'Each target problem shows the transformed program, the equivalence and the consequence separately.'
        },
        {
          name: 'The direction is stated explicitly',
          why: 'Everything reduces to halting, so a reduction that way is content-free.',
          breaks: 'Each entry says which way the arrow goes and what that makes the target.'
        },
        {
          name: 'The verdict is computed from the two flags, not asserted',
          why: 'Rice’s condition is mechanical, and stating it as a rule makes it checkable.',
          breaks: 'The table computes decidability from semantic and trivial, and gets 4 of 10.'
        },
        {
          name: 'The two escapes are distinguished',
          why: '"Decidable because syntactic" and "decidable because trivial" support different tools.',
          breaks: 'The reason column separates them, and only one of the two is useful.'
        }
      ],
      complexity: [
        { operation: 'building one reduction', average: 'O(source length) — a string concatenation', worst: 'the same' },
        { operation: 'classifying a property', average: 'O(1) from the two flags', worst: 'O(1)' },
        { operation: 'deciding a syntactic property', average: 'O(source length) — grep', worst: 'whatever the pattern costs' },
        { operation: 'deciding a semantic non-trivial property', average: 'no algorithm exists', worst: 'no algorithm exists' }
      ],
      failureModes: [
        {
          symptom: 'A linter reports nothing and the team treats the code as verified.',
          cause: 'An incomplete analysis read as a sound one.',
          fix: 'Ask what silence means for that specific tool. For most linters it means nothing.'
        },
        {
          symptom: 'A tool claims to find all bugs of some semantic kind with no false positives.',
          cause: 'Rice forbids that combination for any non-trivial semantic property.',
          fix: 'It is measuring something syntactic, or it is wrong. Find out which.'
        },
        {
          symptom: 'An undecidability proof turns out to prove nothing.',
          cause: 'The reduction went the wrong way — everything reduces to halting.',
          fix: 'Check whether the argument would still work with the arrows swapped. If so, it is not one.'
        },
        {
          symptom: 'A team keeps requesting exact dead-code elimination.',
          cause: 'It is one of the five reductions here, and undecidable.',
          fix: 'Choose over-reporting or under-reporting deliberately, and document which.'
        }
      ],
      inTheWild: [
        'Rust’s borrow checker, which is sound and rejects correct programs on purpose.',
        'Every linter and security scanner, which are incomplete and say so quietly.',
        'Abstract interpretation in Astrée and Infer, sound by over-approximation.',
        'Dead-code warnings in every compiler, all of them approximations of an undecidable question.'
      ],
      sources: [
        { title: 'Rice — Classes of recursively enumerable sets and their decision problems (1953)', note: 'the theorem, and its proof by reduction' },
        { title: 'Sipser — Introduction to the Theory of Computation', note: 'mapping reductions and the direction convention' },
        { title: 'Cousot and Cousot — Abstract interpretation (1977)', note: 'the systematic way to be sound and incomplete on purpose' },
        { title: 'Rice’s theorem in practice: the LLVM and GCC optimiser documentation', note: 'where the approximations are stated explicitly' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));

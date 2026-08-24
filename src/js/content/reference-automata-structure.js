/** Reference entries for minimisation, closure, non-regularity and transducers (M24.5-M24.8). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'minimisation-and-canonical-forms': {
      summary: 'Three minimisation algorithms on one machine, checked against a brute-force ' +
        'Myhill–Nerode count that never builds a machine, with the witness suffix printed for ' +
        'every pair of classes.',
      intuition: 'The minimal DFA is unique, which turns "are these two patterns the same" into ' +
        'a comparison of two finite objects.',
      formulation: {
        equations: [
          {
            label: 'Myhill–Nerode',
            expr: 'x ≡ y when ∀z: xz ∈ L ⟺ yz ∈ L; the classes are the states of the minimal DFA',
            readAs: 'Two prefixes are equivalent when every continuation puts them both in the ' +
              'language or both outside it, and the classes of that relation are exactly the ' +
              'states of the smallest machine.',
            terms: [
              { sym: 'lower bound', meaning: 'any machine must send inequivalent prefixes to different states' },
              { sym: 'upper bound', meaning: 'the class-indexed machine recognises the language' },
              { sym: 'so', meaning: 'the minimal DFA is unique up to renaming' },
              { sym: 'and', meaning: '"is my state set right" is a decidable question' }
            ]
          },
          {
            label: 'Three algorithms on the (a|b)*abb machine',
            expr: 'algorithm · result · cost',
            terms: [
              { sym: 'Moore', meaning: '4 states in 3 refinement rounds · O(n²·|Σ|)' },
              { sym: 'Hopcroft', meaning: '4 states · O(n log n) — enqueue the smaller half' },
              { sym: 'Brzozowski', meaning: '4 states · reverse, determinise, twice — exponential worst case' },
              { sym: 'the oracle', meaning: '4 classes, computed from the language with no machine involved' }
            ]
          },
          {
            label: 'The convention that must be chosen once',
            expr: 'minimal TOTAL against minimal trimmed, on a*b*',
            terms: [
              { sym: 'total', meaning: '3 states, including the trap for the dead prefixes' },
              { sym: 'trimmed', meaning: '2 states, with no dead state at all' },
              { sym: 'the oracle', meaning: '3 classes, because Myhill–Nerode partitions all of Σ*' },
              { sym: 'mixing them', meaning: '2 states against 3 classes — a false "not minimal"' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The reference never looks at a machine',
          why: 'Comparing two minimisation algorithms confirms a shared assumption; comparing both against the language does not.',
          breaks: 'The demo prints four numbers computed four ways and the metric is whether they agree.'
        },
        {
          name: 'Trim and complete before refining',
          why: 'An unreachable state cannot be distinguished from anything, and every dead state is the same state.',
          breaks: 'Skipping it yields a "minimal" machine containing states no input ever visits.'
        },
        {
          name: 'One convention for totality, used everywhere',
          why: 'The minimal total machine has one more state than the minimal trimmed one whenever the language is not everything.',
          breaks: 'a*b* gives 3 and 2, and comparing across the two makes three correct algorithms disagree.'
        },
        {
          name: 'Every pair of classes carries a witness suffix',
          why: 'That witness is what "these are different states" means, and it is what makes the count a lower bound.',
          breaks: 'The demo lists them; a pair with no witness is a pair that should have been merged.'
        }
      ],
      complexity: [
        { operation: 'Moore refinement', average: 'O(n²·|Σ|)', worst: 'the same; every round recomputes every signature' },
        { operation: 'Hopcroft', average: 'O(n log n)', worst: 'the logarithm comes from the smaller-half rule alone' },
        { operation: 'Brzozowski', average: 'two determinisations', worst: 'exponential intermediate machine' },
        { operation: 'Myhill–Nerode by brute force', average: 'O(|Σ|^bound × classes) string tests', worst: 'exponential in the bound — a test, never an implementation' },
        { operation: 'equivalence of two DFAs', average: 'minimise both, compare shapes', worst: 'polynomial from DFAs, PSPACE-complete from NFAs' },
        { operation: 'trim', average: 'two reachability passes', worst: 'linear in the machine' }
      ],
      failureModes: [
        {
          symptom: 'A minimisation returns a machine that accepts the wrong language.',
          cause: 'Refinement started from an unreachable or dead state that had no evidence to split on.',
          fix: 'Trim first; it is part of the algorithm rather than an optimisation.'
        },
        {
          symptom: 'Two correct minimisers report different state counts.',
          cause: 'One returns the minimal total machine and the other the minimal trimmed one.',
          fix: 'Pick a convention and apply it to the oracle too.'
        },
        {
          symptom: 'Brzozowski’s algorithm exhausts memory on a small input.',
          cause: 'Its intermediate machine can be exponential even when the result is tiny.',
          fix: 'Hopcroft for a DFA; Brzozowski is worth it when the input is an NFA.'
        },
        {
          symptom: 'A refactored pattern is assumed equivalent because the tests pass.',
          cause: 'Tests sample the language; minimisation decides it.',
          fix: 'Minimise both and compare, or run the containment check in 24.6 for a counter-example.'
        }
      ],
      inTheWild: [
        'Regex equivalence checkers, which minimise both patterns and compare.',
        'Hardware synthesis, where state minimisation directly reduces flip-flop count.',
        'Model checkers, which minimise before comparing behaviours.',
        'Lexer generators, which minimise the merged rule automaton before emitting a table.'
      ],
      sources: [
        { title: 'Hopcroft — An n log n algorithm for minimizing states in a finite automaton (1971)', note: 'the worklist refinement and the smaller-half argument' },
        { title: 'Brzozowski — Canonical regular expressions and minimal state graphs (1962)', note: 'the double-reversal algorithm' },
        { title: 'Nerode — Linear automaton transformations (1958)', note: 'the equivalence relation the whole section rests on' },
        { title: 'Berstel, Boasson, Carton and Fagnot — Minimization of automata (2010)', note: 'a survey comparing the algorithms and their real costs' }
      ]
    },

    'closure-and-the-product': {
      summary: 'One product construction with four accepting rules, a complement that needs a ' +
        'total machine, and a containment check that returns the shortest string one language ' +
        'admits and the other refuses.',
      intuition: 'Closure plus a decidable emptiness test makes containment decidable — with a ' +
        'witness, which is what makes the answer actionable.',
      formulation: {
        equations: [
          {
            label: 'The product',
            expr: 'δ((p, q), a) = (δ₁(p, a), δ₂(q, a)); only the accepting rule changes',
            terms: [
              { sym: '∩', meaning: 'both components accept' },
              { sym: '∪', meaning: 'either accepts' },
              { sym: '∖', meaning: 'the first accepts and the second does not' },
              { sym: 'symmetric', meaning: 'exactly one accepts — empty exactly when the languages are equivalent' }
            ]
          },
          {
            label: 'Containment, and the witness',
            expr: 'L(A) ⊆ L(B) ⟺ L(A) ∩ complement(L(B)) = ∅',
            readAs: 'The first language sits inside the second exactly when nothing is accepted ' +
              'by the first and rejected by the second, and when something is, the shortest such ' +
              'string is the counter-example.',
            terms: [
              { sym: 'A = (a|b)*abb, B = (a|b)*b', meaning: 'A ⊆ B holds; the difference is empty' },
              { sym: 'the other direction', meaning: 'B ⊆ A fails, with the witness "b"' },
              { sym: 'confirmation', meaning: 'the witness is re-run through both ORIGINAL machines' },
              { sym: 'why', meaning: 'a bug anywhere in determinise-complete-complement-product yields a confident wrong string' }
            ]
          },
          {
            label: 'What each construction costs',
            expr: 'operation · state cost · the catch',
            terms: [
              { sym: 'Boolean operations', meaning: 'at most m × n, usually fewer · both machines must be deterministic and total' },
              { sym: 'complement', meaning: 'up to 2ⁿ from determinising · flipping a PARTIAL machine accepts the wrong half' },
              { sym: 'concatenation and star', meaning: 'm + n and n + 1 · the result is an NFA' },
              { sym: 'emptiness', meaning: 'linear in the product · the product is what may be large' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Complement is applied to a total machine, in that order',
          why: 'Flipping the accepting set of a partial DFA accepts every string that used to fall off the end.',
          breaks: 'Containment checks then pass when they should fail, which is the direction that looks fine.'
        },
        {
          name: 'A counter-example is confirmed against the original machines',
          why: 'The construction is several steps deep and a defect anywhere returns a wrong witness with full confidence.',
          breaks: 'The demo prints "first accepts, second rejects" computed from the originals rather than from the product.'
        },
        {
          name: 'Reachable pairs are built, not the whole grid',
          why: 'The bound is m × n and the reality is usually a fraction of it.',
          breaks: 'The demo reports 5 reachable pairs out of a possible 8 on its default languages.'
        }
      ],
      complexity: [
        { operation: 'product', average: 'reachable pairs only, at most m × n', worst: 'm × n when every pair is reachable' },
        { operation: 'complement', average: 'free once the machine is deterministic and total', worst: 'the determinisation, which is up to 2ⁿ' },
        { operation: 'emptiness', average: 'breadth-first search, linear in the machine', worst: 'linear — the path found is the shortest accepted word' },
        { operation: 'containment', average: 'one complement and one product, then a search', worst: 'PSPACE-complete when the inputs are NFAs' },
        { operation: 'equivalence', average: 'containment twice', worst: 'the same, in both directions' },
        { operation: 'concatenation and star', average: 'linear in the state counts', worst: 'the result is an NFA, so a later determinisation may be exponential' }
      ],
      failureModes: [
        {
          symptom: 'A containment check says yes and production says otherwise.',
          cause: 'The complement was taken of a partial machine.',
          fix: 'Complete first. This is the single most common bug in the section.'
        },
        {
          symptom: 'A counter-example does not reproduce.',
          cause: 'It came from the constructed machine and was never checked against the originals.',
          fix: 'Run both source machines on the returned string; two lines, and it catches the whole class.'
        },
        {
          symptom: 'A pipeline of operations becomes unexpectedly slow.',
          cause: 'Concatenation, star and reversal all return NFAs, so a determinisation happens somewhere.',
          fix: 'Minimise between steps; each pass is cheap on a small machine and expensive on a large one.'
        },
        {
          symptom: 'The same question about two grammars never terminates.',
          cause: 'Context-free languages are not closed under intersection, so the reduction does not exist.',
          fix: 'Compare at the regular level if the inputs allow it, or test rather than decide.'
        }
      ],
      inTheWild: [
        'Firewall and routing rule comparison, where two versions are compared for containment.',
        'Access-control policy tools, which report the request a new policy admits and the old one did not.',
        'Regex linters that check whether one alternative shadows another.',
        'Model checkers, whose product-with-the-negation is exactly this construction over infinite words.'
      ],
      sources: [
        { title: 'Hopcroft, Motwani and Ullman — Introduction to Automata Theory', note: 'the product construction and the closure proofs' },
        { title: 'Sipser — Introduction to the Theory of Computation', note: 'closure, decidability and where the boundary sits' },
        { title: 'Meyer and Stockmeyer — The equivalence problem for regular expressions (1972)', note: 'why equivalence from NFAs is PSPACE-complete' },
        { title: 'Kozen — Automata and Computability', note: 'the decision procedures set out as algorithms' }
      ]
    },

    'proving-non-regularity': {
      summary: 'The pumping lemma implemented as the adversary game with every decomposition ' +
        'enumerated, beside a Myhill–Nerode family with an explicit witness for each pair — and ' +
        'both correctly declining on a language that is regular.',
      intuition: 'The pumping lemma only ever says no; Myhill–Nerode answers both ways and builds ' +
        'the machine when there is one.',
      formulation: {
        equations: [
          {
            label: 'The pumping lemma, with its quantifiers',
            expr: '∀p ∃w ∈ L, |w| ≥ p, ∀xyz = w with |xy| ≤ p and |y| ≥ 1, ∃i ≥ 0: xyⁱz ∉ L',
            readAs: 'For every pumping length the adversary chooses, there is a word in the ' +
              'language at least that long, such that for every legal decomposition of it, some ' +
              'number of repetitions of the middle part leaves the language.',
            terms: [
              { sym: 'you choose', meaning: 'the word and the exponent' },
              { sym: 'the adversary chooses', meaning: 'the pumping length and the decomposition' },
              { sym: 'you must beat', meaning: 'EVERY decomposition; the adversary needs one survivor' },
              { sym: 'i = 0 counts', meaning: 'deleting the pumped block is pumping, and is often easier' }
            ]
          },
          {
            label: 'aⁿbⁿ at pumping length 4',
            expr: 'w = aaaabbbb · decompositions · survivors',
            terms: [
              { sym: 'why that word', meaning: '|xy| ≤ 4 forces y inside the run of a' },
              { sym: 'decompositions', meaning: '10, all enumerated rather than argued' },
              { sym: 'survivors', meaning: '0 — the language is not regular' },
              { sym: 'the control', meaning: 'on a regular language, 4 of 10 survive and the lemma proves nothing' }
            ]
          },
          {
            label: 'Myhill–Nerode, the other tool',
            expr: 'exhibit prefixes no two of which share a continuation set',
            terms: [
              { sym: 'family for aⁿbⁿ', meaning: 'a, aa, aaa, … with aⁱ separated from aʲ by bⁱ' },
              { sym: 'demo size', meaning: '6 prefixes, 15 pairs, 15 witnesses' },
              { sym: 'on a regular language', meaning: 'the family collapses — 9 of 15 pairs have a witness and the rest are one state' },
              { sym: 'the payoff', meaning: 'finitely many classes IS the minimal machine' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Every decomposition is enumerated, not sampled',
          why: 'The lemma quantifies over all of them, and checking a convenient one is the standard bad proof.',
          breaks: 'The demo reports the survivor count as its own metric, so a lost round is visible.'
        },
        {
          name: 'A failed pumping argument concludes nothing',
          why: 'Pumpability is necessary and not sufficient, so the technique has no positive branch.',
          breaks: 'The demo runs it against a regular language and it correctly declines with 4 surviving splits.'
        },
        {
          name: 'A distinguishing family carries the witness for every pair',
          why: 'Without the witness the family is an assertion that the prefixes differ.',
          breaks: 'The demo lists all 15 witnesses and marks any pair that has none as the same state.'
        }
      ],
      complexity: [
        { operation: 'enumerating decompositions', average: 'O(p²) splits for pumping length p', worst: '10 at p = 4, and it grows quadratically' },
        { operation: 'testing one decomposition', average: 'O(maxExponent) membership tests', worst: 'bounded by the exponent budget' },
        { operation: 'building a distinguishing family', average: 'O(k²) pairs for k prefixes', worst: 'each pair needs a suffix search' },
        { operation: 'finding a witness suffix', average: 'O(|Σ|^bound) in the worst case', worst: 'usually the first suffix tried, for a well-chosen family' },
        { operation: 'Myhill–Nerode on a regular language', average: 'terminates at the number of classes', worst: 'that number is the state count of the minimal machine' },
        { operation: 'Myhill–Nerode on a non-regular language', average: 'never terminates', worst: 'which is the proof — you stop when the family is clearly infinite' }
      ],
      failureModes: [
        {
          symptom: 'A pumping proof is accepted and the language turns out to be regular.',
          cause: 'Only one decomposition was checked, and the others survive.',
          fix: 'Enumerate them. The demo does it; a written proof must argue every case explicitly.'
        },
        {
          symptom: '"I could not build a DFA, so it is not regular."',
          cause: 'Failing to find a machine proves nothing at all.',
          fix: 'Compute the Myhill–Nerode classes: finitely many gives you the machine, infinitely many gives you the proof.'
        },
        {
          symptom: 'A pumping argument gets stuck because the adversary always has a move.',
          cause: 'The chosen word does not constrain where y can sit.',
          fix: 'Choose a word where |xy| ≤ p forces y into the part the constraint is about.'
        },
        {
          symptom: 'A distinguishing family is claimed and two members are actually equivalent.',
          cause: 'No witness was produced for that pair.',
          fix: 'Produce the suffix for every pair; a missing one means the family is smaller than claimed.'
        }
      ],
      inTheWild: [
        'Deciding whether a validation rule can be a regex or needs a parser.',
        'Proving that a proposed protocol invariant cannot be checked by a finite monitor.',
        'Compiler design, where the lexer/parser split is exactly this boundary.',
        'Interview questions, which is where most engineers meet the pumping lemma and misuse it.'
      ],
      sources: [
        { title: 'Sipser — Introduction to the Theory of Computation', note: 'the lemma, its quantifiers and the standard proofs' },
        { title: 'Nerode — Linear automaton transformations (1958)', note: 'the equivalence relation, and why it answers both directions' },
        { title: 'Myhill — Finite automata and the representation of events (1957)', note: 'the other half of the theorem' },
        { title: 'Hopcroft, Motwani and Ullman — Introduction to Automata Theory', note: 'the catalogue of non-regular languages and the closure reductions' }
      ]
    },

    transducers: {
      summary: 'Two text machines composed into one pass and checked against running them in ' +
        'sequence over 204 inputs, with a one-state Mealy case folder growing to 29 states in ' +
        'Moore form.',
      intuition: 'Composing beats chaining because a chained pipeline materialises the ' +
        'intermediate string and throws away every position offset with it.',
      formulation: {
        equations: [
          {
            label: 'Mealy and Moore',
            expr: 'Mealy: output on the transition · Moore: output on the state',
            terms: [
              { sym: 'Mealy size', meaning: '1 state for a case folder — the output depends on what was read' },
              { sym: 'Moore size', meaning: '29 states for the same function — one per distinct arriving output' },
              { sym: 'Moore emits', meaning: 'one extra symbol, for its start state' },
              { sym: 'why Moore', meaning: 'the output is a property of where you are, which hardware and protocols want' }
            ]
          },
          {
            label: 'Composition',
            expr: 'the state is a pair; the second machine consumes what the first wrote',
            terms: [
              { sym: 'the subtlety', meaning: 'the first machine may write several symbols or none per input symbol' },
              { sym: 'so', meaning: 'the second component advances a variable number of steps per composed transition' },
              { sym: 'the demo', meaning: '1 × 2 states, 2 reachable, one pass instead of two' },
              { sym: 'checked', meaning: '4 samples plus 200 generated strings: 204 of 204 agreements' }
            ]
          },
          {
            label: 'Weights, and where the next section goes',
            expr: 'over the tropical semiring, the best output is the cheapest path',
            terms: [
              { sym: 'along a path', meaning: 'add the weights' },
              { sym: 'between paths', meaning: 'take the minimum' },
              { sym: 'so', meaning: '"run the machine" becomes "search the machine"' },
              { sym: 'composition still works', meaning: 'which is how a speech decoder becomes one machine rather than a pipeline' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Composition is checked against chaining over a generated corpus',
          why: 'A bug in the "wrote several symbols" branch survives every hand-written sample.',
          breaks: 'The demo runs 200 generated strings beside 4 samples and reports the agreement count.'
        },
        {
          name: 'An empty output is a first-class case',
          why: 'Deletion is what makes whitespace collapsing and normalisation expressible at all.',
          breaks: 'A transducer without it can only substitute, never remove.'
        },
        {
          name: 'The state never grows with the input',
          why: 'It is a finite machine, so a megabyte of text costs the same memory as a sentence.',
          breaks: 'Anything that needs to remember how much text has been read is not a transducer.'
        }
      ],
      complexity: [
        { operation: 'running a transducer', average: 'O(n) — one transition per input symbol', worst: 'the same; the output length may differ from n' },
        { operation: 'composition', average: 'at most m × n states, reachable pairs only', worst: 'm × n, plus the inner walk per composed transition' },
        { operation: 'Mealy to Moore', average: 'one state per (state, arriving output) pair', worst: '|Q| × |distinct outputs| — 29 for a 1-state folder' },
        { operation: 'chaining two passes', average: 'two traversals plus one intermediate string', worst: 'the copy, and the loss of every position offset' },
        { operation: 'weighted best path', average: 'O(n · |Q| · edges) by relaxation', worst: 'the same shape as Viterbi in 24.10' },
        { operation: 'minimising a transducer', average: 'as for automata, after the outputs are pushed', worst: 'output pushing is the extra step transducers need' }
      ],
      failureModes: [
        {
          symptom: 'An error message points at the wrong character of the source.',
          cause: 'A normalisation pass ran first and the offsets no longer correspond.',
          fix: 'Compose the passes, or carry an explicit alignment; reconstructing it afterwards is guesswork.'
        },
        {
          symptom: 'A composition works on the examples and fails on real input.',
          cause: 'The branch where the first machine writes more than one symbol was never exercised.',
          fix: 'Test against the chained version over a generated corpus.'
        },
        {
          symptom: 'A Moore conversion explodes in size.',
          cause: 'The Mealy machine has many distinct outputs arriving at one state.',
          fix: 'Stay in Mealy form unless the output really is a property of the state.'
        },
        {
          symptom: 'A text pipeline is slow and allocates heavily.',
          cause: 'Each stage materialises a full copy of the text.',
          fix: 'Compose the stages into one machine — the technique this section exists for.'
        }
      ],
      inTheWild: [
        'Speech decoders, which compose context, lexicon and language-model transducers into one machine.',
        'Morphological analysers, the classic FST application in computational linguistics.',
        'Unicode normalisation, where one character may map to several.',
        'Tokenisers that emit token types and text in a single pass over the source.'
      ],
      sources: [
        { title: 'Mohri — Weighted finite-state transducer algorithms: an overview (2004)', note: 'composition, determinisation and minimisation for transducers' },
        { title: 'Mealy — A method for synthesizing sequential circuits (1955)', note: 'output on the transition' },
        { title: 'Moore — Gedanken-experiments on sequential machines (1956)', note: 'output on the state, and the conversion between them' },
        { title: 'Roche and Schabes — Finite-State Language Processing', note: 'the text-pipeline applications in full' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));

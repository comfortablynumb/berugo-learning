/** Concepts for minimisation, closure, non-regularity and transducers (M24.5-M24.8). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'minimisation-and-canonical-forms': [
      {
        term: 'Myhill–Nerode: the language decides the states',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["two prefixes, p and q"] --> B{"is there any suffix s where<br/>ps is accepted and qs is not?"}',
            '    B -->|yes| C["they must be different states"]',
            '    B -->|no| D["no machine can ever<br/>need to tell them apart"]',
            '    D --> E["so they ARE the same state"]',
            '    C --> F["count the classes and you have<br/>the minimum state count"]',
            '    E --> F'
          ].join('\n'),
          caption: 'The minimum machine is not found by optimising a machine. It is read off the language itself, which is why the result is unique up to renaming.'
        },
        plain: 'Two prefixes are the same state when no suffix tells them apart.',
        formal: 'x ≡ y when for every suffix z, xz ∈ L exactly when yz ∈ L; the classes are the states',
        readAs: 'Two prefixes are equivalent when, for every possible continuation, either both ' +
          'completed strings are in the language or neither is — and each such class of ' +
          'prefixes is one state of the minimal machine.',
        detail: 'This is a statement about the LANGUAGE and mentions no machine, which is why ' +
          'the minimal DFA is unique up to renaming: any machine recognising the language must ' +
          'send equivalent prefixes to the same state and inequivalent ones to different states, ' +
          'so the class count is both a lower and an upper bound. It is also the reason "am I ' +
          'done" is a decidable question about a state design.',
        example: 'The demo computes the classes by brute force and reports them beside three ' +
          'algorithms’ answers, all four agreeing at 4.'
      },
      {
        term: 'Refinement starts coarse and only ever splits',
        plain: 'Accepting against rejecting, then split anything that disagrees.',
        formal: 'a block splits when its members send some symbol into different blocks',
        detail: 'The first partition is the coarsest one that could possibly be right, because ' +
          'accepting and rejecting states are distinguishable by the empty suffix. Every later ' +
          'round finds a symbol that separates two members of a block and splits on it. The ' +
          'process cannot loop: every round either refines the partition or is the last, and a ' +
          'partition of n states can be refined at most n times.',
        example: 'The demo prints every intermediate partition and names the symbol and the two ' +
          'states each split was based on.'
      },
      {
        term: 'Hopcroft’s trick is one line: enqueue the smaller half',
        plain: 'Refine against a worklist of splitters, and always take the smaller side.',
        formal: 'O(n log n), because a state can be in the smaller half at most log n times',
        readAs: 'The algorithm runs in n times log n steps, because each state can belong to the ' +
          'smaller of two halves only about log-base-two of n times before the halves run out.',
        detail: 'Moore\'s version recomputes every signature each round and is quadratic; ' +
          'Hopcroft\'s does the same refinement driven by a worklist and gets the logarithm from ' +
          'that one choice. It is a good example of an algorithmic improvement that is entirely ' +
          'in the bookkeeping — the partition it computes is identical, only the schedule ' +
          'differs.',
        example: 'The demo reports Hopcroft’s worklist pass count beside Moore’s round count for ' +
          'the same machine.'
      },
      {
        term: 'Brzozowski: reverse, determinise, twice',
        plain: 'Two lines, exponential in the worst case, and it lands on the minimal machine.',
        formal: 'determinise(reverse(determinise(reverse(M)))) is minimal',
        readAs: 'Reverse the machine, determinise it, reverse it again and determinise again, and ' +
          'the result is the minimal automaton.',
        detail: 'Nobody believes it until they run it. The reason it works is that determinising ' +
          'a reversed machine produces a machine whose states are already distinguishable, so ' +
          'the second pass has nothing left to merge. The intermediate machine can be ' +
          'exponentially large, which is the price — and the compensating advantage is that it ' +
          'accepts an NFA directly and does determinisation and minimisation in one move.',
        example: 'The demo reports the size of Brzozowski’s intermediate machine alongside its ' +
          'result.'
      },
      {
        term: 'Trim first, or the counts mean nothing',
        plain: 'Unreachable states are indistinguishable from everything; dead states are all one state.',
        formal: 'remove states not reachable from the start and states from which no accepting state is reachable',
        detail: 'This is part of the algorithm rather than an optimisation. An unreachable state ' +
          'cannot be told apart from anything because nothing reaches it, so refinement has no ' +
          'evidence to split on; a dead state is equivalent to every other dead state and to the ' +
          'trap. Skipping the trim gives a "minimal" machine with states in it that no input ' +
          'ever visits.',
        example: 'All three algorithms in the demo trim and complete before refining, which is ' +
          'why their counts agree.'
      },
      {
        term: 'Minimal TOTAL, not minimal trimmed — pick one and stay',
        plain: 'Myhill–Nerode partitions all of Σ*, including the dead prefixes.',
        formal: 'the minimal total machine has one more state than the minimal trimmed one whenever the language is not everything',
        readAs: 'Because the equivalence classes cover every string over the alphabet, the ' +
          'prefixes from which nothing can be accepted form a class of their own, so a total ' +
          'machine carries a trap state the trimmed one does not.',
        detail: 'This off-by-one makes three correct algorithms look like they disagree, and it ' +
          'is entirely a matter of convention. The demo uses the total convention throughout ' +
          'because the theorem is stated that way and because complement needs it — but the ' +
          'important thing is choosing once, not which one is chosen.',
        example: 'The demo completes Brzozowski’s output for exactly this reason, and all three ' +
          'algorithms then report the same count as the oracle.'
      },
      {
        term: 'Uniqueness is what makes equivalence decidable',
        plain: 'Two patterns are equivalent exactly when their minimal machines are the same shape.',
        formal: 'L(A) = L(B) if and only if the minimal DFAs of A and B are isomorphic',
        detail: 'That reduces a question about infinitely many strings to a comparison of two ' +
          'finite objects, which is the practical payoff of the whole section. It also means a ' +
          'difference comes with a witness: section 24.6 builds the difference machine and takes ' +
          'the shortest word in it, so "these are not equivalent" arrives with the shortest ' +
          'string that proves it.',
        example: 'Section 24.6 reports "b" as the shortest string separating (a|b)*abb from ' +
          '(a|b)*b.'
      },
      {
        term: 'The oracle must not share a bug with the algorithm',
        plain: 'A brute-force class count never looks at a machine at all.',
        formal: 'the reference is computed from the language by testing prefixes against suffixes',
        detail: 'Comparing two minimisation algorithms against each other confirms a shared ' +
          'assumption; comparing both against a computation that never builds a machine does ' +
          'not. That is the same discipline as the batch tester in 24.2 and the published ' +
          'vectors in M23 — an independent answer is the only detector for a bug that produces ' +
          'plausible output.',
        example: 'The demo prints four numbers computed four ways and the metric is whether they ' +
          'agree.'
      }
    ],

    'closure-and-the-product': [
      {
        term: 'Closure is constructive, which is what makes it useful',
        plain: 'There is an algorithm producing the machine, not just a proof one exists.',
        formal: 'regular languages are closed under ∪, ∩, complement, ∖, concatenation, star and reversal',
        readAs: 'Combining regular languages by union, intersection, complement, difference, ' +
          'concatenation, Kleene star or reversal always gives another regular language.',
        detail: 'A non-constructive closure theorem would be a curiosity. These come with ' +
          'constructions you can run, which is what turns questions about languages into ' +
          'programs — containment, equivalence and emptiness all reduce to combining machines ' +
          'and searching the result, and every one of those is decidable because the closure is ' +
          'effective.',
        example: 'The demo builds all four Boolean results from one product and reports the ' +
          'shortest word in each.'
      },
      {
        term: 'The product runs both machines at once',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["machine A in state 3"] --> C["product state: the pair (3, 7)"]',
            '    B["machine B in state 7"] --> C',
            '    C --> D["read a symbol:<br/>each component moves on its own"]',
            '    D --> E["accept if BOTH accept:<br/>intersection"]',
            '    D --> F["accept if EITHER accepts:<br/>union"]'
          ].join('\n'),
          caption: 'One construction gives union, intersection and difference — only the accepting set changes. That is why closure properties come as a family rather than one at a time.'
        },
        plain: 'The state is a pair; each component moves independently.',
        formal: 'δ((p, q), a) = (δ₁(p, a), δ₂(q, a)), with the accepting rule chosen per operation',
        readAs: 'The pair moves to the pair of destinations, and only which pairs count as ' +
          'accepting distinguishes intersection from union from difference.',
        detail: 'One construction, four results — which means the expensive part, building the ' +
          'reachable pairs, is shared. That is why a library exposes one product function and ' +
          'four thin wrappers, and why difference and symmetric difference come free once ' +
          'intersection exists. It also explains the state cost: at most m × n, and usually far ' +
          'fewer because most pairs are unreachable.',
        example: 'The demo builds 5 reachable pairs out of a possible 8 and reports the same ' +
          'count for all four operations.'
      },
      {
        term: 'Complement needs a total machine, and the order matters',
        plain: 'Determinise, add the trap, then flip.',
        formal: 'complementing a partial DFA by flipping F accepts every string that fell off the end',
        detail: 'This is the most common implementation bug in the section and it fails in the ' +
          'direction that looks fine: the complemented machine accepts more than it should, so ' +
          'containment checks pass when they should not. Adding the trap is one line and getting ' +
          'the order wrong is invisible until a specific input finds it.',
        example: 'The demo’s closure table names this as the catch on the complement row.'
      },
      {
        term: 'Emptiness is reachability, and the path is the witness',
        plain: 'A machine accepts something exactly when an accepting state is reachable.',
        formal: 'breadth-first search from the start set; the first accepting state gives the shortest accepted word',
        detail: 'That the search returns the SHORTEST word is what makes it useful rather than ' +
          'merely decisive. A "no" with a witness is a test case; a "no" without one is an ' +
          'assertion somebody has to trust. The whole containment story rests on this: the ' +
          'construction produces a machine, the search produces a string, and the string can be ' +
          'run back through both originals.',
        example: 'The demo reports "abb" as the shortest word in the intersection and confirms ' +
          'it by running both machines on it.'
      },
      {
        term: 'Containment is emptiness of A ∩ complement(B)',
        plain: 'Everything A accepts is in B exactly when nothing is in A and outside B.',
        formal: 'L(A) ⊆ L(B) if and only if L(A) ∩ complement(L(B)) = ∅',
        readAs: 'The first language sits inside the second exactly when there is no string that ' +
          'the first accepts and the second rejects.',
        detail: 'Two closure operations and a search, and the composition is the whole algorithm. ' +
          'When the intersection is non-empty its shortest word is a string A accepts and B does ' +
          'not — which is exactly the counter-example a reviewer needs. Equivalence is the same ' +
          'check in both directions.',
        example: 'The demo confirms (a|b)*abb ⊆ (a|b)*b and reports "b" as the string that breaks ' +
          'equivalence in the other direction.'
      },
      {
        term: 'A witness must be confirmed against the originals',
        plain: 'Run both source machines on the counter-example rather than trusting it.',
        formal: 'a bug in the complement or the product produces a confident wrong witness',
        detail: 'The construction is several steps deep — determinise, complete, complement, ' +
          'product, search — and a defect anywhere in it yields a string that is presented with ' +
          'the same confidence as a correct one. Running the two original machines on the ' +
          'returned word is two lines and turns the answer into something checkable, which is ' +
          'the same reason the padding oracle in M23 verifies its recovered plaintext.',
        example: 'The demo prints "first accepts / second rejects" for its witness, computed from ' +
          'the originals rather than from the product.'
      },
      {
        term: 'Concatenation, star and reversal all return an NFA',
        plain: 'Which means a pipeline pays for a determinisation it did not ask for.',
        formal: 'concatenation adds ε-edges, star adds a state, reversal flips the edges — none preserves determinism',
        readAs: 'Joining two machines needs transitions that consume no input, starring one adds ' +
          'a fresh state with such transitions back, and reversing one turns a single ' +
          'destination into several — so all three leave the machine nondeterministic.',
        detail: 'A sequence of operations that concatenates, stars and then complements will ' +
          'determinise somewhere, and where it happens decides the cost. Minimising between ' +
          'steps rather than at the end is the practical response: each minimisation is cheap on ' +
          'a small machine and expensive on a large one, so doing it early keeps the sizes down.',
        example: 'The demo’s closure table marks which constructions leave the machine ' +
          'nondeterministic and what that costs downstream.'
      },
      {
        term: 'Policy questions about patterns are decidable; about grammars they are not',
        plain: 'Firewall rules, route matchers and URL filters are regular languages.',
        formal: 'containment is decidable for regular languages and undecidable for context-free ones',
        detail: 'The difference comes straight from closure: regular languages are closed under ' +
          'intersection and complement and context-free ones are not, so the reduction that ' +
          'makes containment work has no analogue one level up. Practically, a rule set built ' +
          'from patterns without backreferences can be compared exactly between versions, with a ' +
          'generated counter-example — and one expressed as a grammar cannot be compared at all.',
        example: 'The demo turns the comparison into a metric with a witness, which is what a ' +
          'code review comment on a rule change would want attached.'
      }
    ],

    'proving-non-regularity': [
      {
        term: 'The pumping lemma proves NO and never yes',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["the language pumps"] --> B["tells you nothing —<br/>some non-regular languages do too"]',
            '    C["the language fails to pump"] --> D["it is definitely not regular"]',
            '    B --> E["so it is a refutation tool only"]',
            '    D --> E'
          ].join('\n'),
          caption: 'Showing a language pumps is not a proof it is regular, and that is the single most common misuse of the lemma.'
        },
        plain: 'Every regular language pumps; some non-regular ones do too.',
        formal: 'regularity implies pumpability, and the converse is false',
        detail: 'It is a necessary condition, so a successful pumping argument refutes regularity ' +
          'and a failed one establishes nothing at all. That asymmetry is the source of most ' +
          'misuse: "I tried to pump it and could not" is not evidence, and neither is "it pumps, ' +
          'so it is regular". Myhill–Nerode is the tool without that limitation.',
        example: 'The demo runs the lemma against a language that IS regular and it correctly ' +
          'declines, with 4 of 10 decompositions surviving.'
      },
      {
        term: 'The quantifiers alternate, and that is the whole difficulty',
        plain: 'For all p, there exists w, for all splits, there exists i.',
        formal: '∀p ∃w ∈ L, |w| ≥ p, ∀ xyz = w with |xy| ≤ p and |y| ≥ 1, ∃i : xyⁱz ∉ L',
        readAs: 'For every pumping length the adversary picks, you must find a word in the ' +
          'language at least that long such that for EVERY way the adversary splits it into ' +
          'three parts with the first two short and the middle non-empty, some number of ' +
          'repetitions of the middle part leaves the language.',
        detail: 'Reading it as a game is the only reliable way to keep the alternation straight: ' +
          'the adversary moves first and last-but-one, you move second and last. You must beat ' +
          'every decomposition and the adversary needs only one that survives, which is why the ' +
          'demo enumerates all of them rather than picking a convenient one.',
        example: 'For aⁿbⁿ at pumping length 4 the demo enumerates all 10 decompositions and ' +
          'reports 0 survivors.'
      },
      {
        term: 'One surviving split loses the round',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["the adversary picks the split"] --> B["you must defeat EVERY<br/>legal decomposition"]',
            '    B --> C{"did you check them all?"}',
            '    C -->|no| D["one convenient split checked —<br/>this proves nothing"]',
            '    C -->|yes| E["the language does not pump"]'
          ].join('\n'),
          caption: 'The quantifier is for-all over splits, so the proof is only finished when no decomposition survives. Checking the easy one is the classic bad proof.'
        },
        plain: 'Checking a convenient decomposition is the most common bad proof.',
        formal: 'the claim quantifies over every split with |xy| ≤ p and |y| ≥ 1',
        detail: 'A written proof compresses the case analysis into "without loss of generality", ' +
          'and that compression is where the errors live. Enumerating the splits makes the ' +
          'quantifier concrete and makes the failure mode visible: on a regular language some ' +
          'splits survive, and a proof that stopped at the first failing one would have claimed ' +
          'the opposite.',
        example: 'The demo reports the survivor count as its own metric, so a round is lost ' +
          'visibly rather than quietly.'
      },
      {
        term: 'Choosing the word is where the skill is',
        plain: 'Pick one that pins the adversary down.',
        formal: 'for aⁿbⁿ, choosing aᵖbᵖ forces y inside the run of a because |xy| ≤ p',
        readAs: 'Choosing p copies of a followed by p copies of b means the first two parts fit ' +
          'inside the run of a, so the middle part is all a and pumping it changes one count ' +
          'without changing the other.',
        detail: 'The lemma gives you the choice of word precisely so you can use it, and a poor ' +
          'choice hands the adversary a decomposition that survives. This is the part that ' +
          'cannot be automated: the machine can enumerate the splits, and picking the word that ' +
          'makes all of them fail is the argument.',
        example: 'The demo picks the word for each language and explains why that choice ' +
          'constrains the adversary.'
      },
      {
        term: 'Deleting is pumping too',
        plain: 'i = 0 works as often as i = 2.',
        formal: 'xy⁰z = xz, and the lemma quantifies over every i ≥ 0',
        detail: 'People reach for i = 2 by default and frequently make more work for themselves. ' +
          'For a language with an equality constraint, removing the pumped block breaks it just ' +
          'as surely as repeating it, and the resulting string is shorter and easier to reason ' +
          'about. The demo reports the smallest exponent that escapes, and it is often zero.',
        example: 'The demo’s split table shows i = 0 defeating most decompositions of aaaabbbb.'
      },
      {
        term: 'Myhill–Nerode: an infinite distinguishable family',
        plain: 'Each prefix would need its own state, and there are only finitely many.',
        formal: 'if infinitely many prefixes are pairwise distinguishable, no finite automaton recognises the language',
        detail: 'This is the stronger tool and usually the easier one: exhibit the family, give ' +
          'the witness suffix for each pair, and the proof is finished with no case analysis and ' +
          'no adversary. For aⁿbⁿ the family is a, aa, aaa, … and the witness separating aⁱ from ' +
          'aʲ is bⁱ. The construction is mechanical once the family is chosen.',
        example: 'The demo builds a family of 6 prefixes, gives all 15 witness suffixes, and ' +
          'notes the family extends to any size.'
      },
      {
        term: 'And it works in the positive direction too',
        plain: 'When the classes are finite, they ARE the minimal machine.',
        formal: 'finitely many equivalence classes if and only if the language is regular',
        detail: 'That is the property the pumping lemma lacks entirely. Computing the equivalence ' +
          'classes tells you immediately which case you are in: finitely many and you have the ' +
          'machine with its states enumerated, infinitely many and you have a proof of ' +
          'non-regularity with the family as the witness. One tool, both answers — which is why ' +
          'it should be the first thing reached for.',
        example: 'Section 24.5 uses the same computation as the oracle that checks three ' +
          'minimisation algorithms.'
      },
      {
        term: 'The classic non-regular languages fail for one reason',
        plain: 'Each requires remembering an unbounded quantity.',
        formal: 'aⁿbⁿ, palindromes, balanced brackets and square lengths all need a count that grows with the input',
        detail: 'Recognising the shape is faster than running either proof, and it generalises to ' +
          'design: any specification containing "as many as", "matching", "properly nested" or ' +
          '"the same number of" is asking for memory a finite automaton does not have. The right ' +
          'response is a parser, an explicit counter, or a format that does not need one.',
        example: 'The demo offers three such languages plus a regular control, and the control is ' +
          'the row where both tools decline.'
      }
    ],

    transducers: [
      {
        term: 'A transducer is an automaton that writes',
        plain: 'Same states, same transitions, plus an output on each move.',
        formal: 'a Mealy machine adds an output function Q × Σ → Γ*; a Moore machine attaches output to states',
        readAs: 'A Mealy machine labels each transition with an output string; a Moore machine ' +
          'labels each state, so the output is emitted on arrival rather than on the move.',
        detail: 'Recognition becomes translation and the whole toolkit carries over — ' +
          'determinisation, minimisation and composition all still apply. The output being a ' +
          'STRING rather than a symbol is what makes it useful: a transition may write several ' +
          'characters, or none at all.',
        example: 'The demo’s space collapser writes one space for the first and nothing for each ' +
          'repeat, which is deletion expressed as an output.'
      },
      {
        term: 'An empty output is what makes deletion expressible',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["a transition reads a symbol"] --> B["and writes one symbol:<br/>a substitution"]',
            '    A --> C["and writes several:<br/>an expansion"]',
            '    A --> D["and writes nothing:<br/>a deletion"]',
            '    D --> E["so input and output lengths<br/>need not match"]',
            '    E --> F["which is what makes a transducer<br/>a rewriter rather than a relabeller"]'
          ].join('\n'),
          caption: 'Allowing an empty output is a one-word change to the definition and it is the whole difference between renaming symbols and transforming text.'
        },
        plain: 'A transition can consume a symbol and write nothing.',
        formal: 'the output alphabet includes the empty string, so |output| need not equal |input|',
        detail: 'A plain automaton has no way to express deletion because it has no output to ' +
          'withhold — it can only accept or reject. Whitespace collapsing, comment stripping, ' +
          'diacritic removal and case normalisation to a shorter form are all this one feature. ' +
          'It is also what makes composition non-trivial: the second machine advances zero or ' +
          'many steps per input symbol of the first.',
        example: 'The demo reports how many transitions in a run wrote nothing, and the output ' +
          'is shorter than the input by exactly that count.'
      },
      {
        term: 'Composition is the operation that matters',
        plain: 'One machine that does both jobs in a single pass.',
        formal: 'the composed state is a pair; the second machine consumes whatever the first wrote',
        detail: 'Chaining two passes materialises the intermediate string — a full copy, a second ' +
          'traversal, and every position offset in the original lost. Composing produces a ' +
          'machine that never has two strings to relate. The construction is the product with ' +
          'one twist: because the first machine may write several symbols or none for one input ' +
          'symbol, the second component moves a variable number of steps per composed ' +
          'transition.',
        example: 'The demo composes a case folder with a space collapser into a 2-state machine ' +
          'and checks it against the chained version on 204 inputs.'
      },
      {
        term: 'Losing position information is the real cost of chaining',
        plain: 'Character 42 of the output is no longer character 42 of the input.',
        formal: 'after a normalisation pass, offsets in the output do not map back without a stored alignment',
        detail: 'The copy is the obvious cost and the smaller one. Anything that wants to point ' +
          'at the original — a compiler error, a syntax highlighter, a diff, a source map — has ' +
          'to reconstruct a mapping the pass threw away, and reconstructing it after the fact is ' +
          'guesswork. A composed machine can carry the alignment because it never lost it, which ' +
          'is why FST pipelines are built this way and a five-stage `replace` chain is so hard ' +
          'to attach diagnostics to.',
        example: 'The section’s insight names this as the reason speech and NLP pipelines compose ' +
          'rather than chain.'
      },
      {
        term: 'Mealy is smaller; Moore is easier to reason about',
        plain: 'Moore must split a state per distinct output arriving at it.',
        formal: 'converting Mealy to Moore multiplies states by the number of distinct outputs reaching each one',
        detail: 'A case folder is one state as a Mealy machine and one state per letter as a ' +
          'Moore machine, because the output depends on what was just read rather than on where ' +
          'you are. The compensating advantage is that in a Moore machine the output IS a ' +
          'property of the state, which is what hardware and protocol specifications want — you ' +
          'can point at a state and say what it emits.',
        example: 'The demo converts its 1-state case folder to Moore form and it grows to 29 ' +
          'states.'
      },
      {
        term: 'Composition is checked against chaining, not assumed',
        plain: 'Run both ways over samples and a generated corpus and compare.',
        formal: 'the composed machine must produce the same output as running the two machines in sequence, on every input',
        detail: 'A composition with a subtle bug — usually in the "the first machine wrote two ' +
          'symbols" branch — produces correct output on the hand-written examples and fails on ' +
          'inputs nobody thought of. Generating a corpus catches exactly that class, which is ' +
          'the same argument every brute-force oracle in the platform makes.',
        example: 'The demo tests 4 samples plus 200 generated strings and reports 204 of 204 ' +
          'agreements.'
      },
      {
        term: 'Weighted transducers turn a run into a shortest path',
        plain: 'Add weights, add them along a path, take the cheapest.',
        formal: 'over the tropical semiring, the best output is the minimum-cost path through the machine',
        readAs: 'Weights add along a path and the best path is the one with the smallest total, ' +
          'which is exactly a shortest-path computation over the machine.',
        detail: 'That one change turns "run the machine" into "search the machine", and it is the ' +
          'shape every decoder in this area has — including Viterbi in the next section. It also ' +
          'means composition still works: composing weighted transducers combines the weights, ' +
          'so a speech decoder can be one machine rather than a pipeline of lattices.',
        example: 'Section 24.10 tabulates the semirings and shows the same algorithm computing ' +
          'six different things.'
      },
      {
        term: 'Real pipelines compose because the intermediates are enormous',
        plain: 'A speech decoder composes context, lexicon and grammar into one machine.',
        formal: 'the composed machine is optimised as a whole, which is impossible for a sequence of passes',
        detail: 'At small scale composition is an elegance; at the scale of a speech system it is ' +
          'the only thing that works, because the intermediate lattices between passes would not ' +
          'fit and because the composition can be determinised and minimised as a single object ' +
          'in a way the individual stages cannot. That is the argument for the technique in its ' +
          'strongest form.',
        example: 'The demo’s applications table lists six pipelines, with the speech row as the ' +
          'one where composition stopped being optional.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));

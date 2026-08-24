/** Worked examples for languages, DFAs, NFAs and regexes (M24.1-M24.4). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'languages-and-the-hierarchy': [
      {
        title: 'Classifying "ends in abb" by running the machine beside the definition',
        goal: 'Turn "this language is regular" from a claim into a check.',
        setup: 'The language of strings over {a, b} ending in abb, tested over every string up ' +
          'to length 6.',
        steps: [
          { do: 'Ask what a recogniser has to remember.',
            why: 'The answer decides the level of the hierarchy.',
            work: 'the last 3 characters, which is a bounded amount whatever the input length' },
          { do: 'Count the strings to test.',
            why: 'Over a 2-symbol alphabet the count doubles per length.',
            work: '1 + 2 + 4 + … + 64 = 127 strings up to length 6' },
          { do: 'Run the definition over all of them.',
            why: 'This is the reference the machine will be compared against.',
            work: '15 of 127 accepted' },
          { do: 'Build the minimal finite automaton and run it too.',
            why: 'Agreement is the evidence; a disagreement would refute the classification.',
            work: '4 states, 0 disagreements over 127 strings' },
          { do: 'Compare the state count with what the language needs.',
            why: 'One state per amount of the target already matched.',
            work: '4 states for a 3-character target — one per prefix of "abb", plus the empty ' +
              'one' }
        ],
        answer: 'A 4-state automaton agrees with the definition on all 127 strings, which is ' +
          'what "regular" means as a check. The state count matches the informal argument: one ' +
          'state per prefix of "abb".'
      },
      {
        title: 'The case that inverts it: aⁿbⁿ, where no state count is enough',
        goal: 'Show that the boundary is about unbounded memory rather than complexity.',
        setup: 'The language of n copies of a followed by n copies of b, over the same alphabet ' +
          'and the same 127 strings.',
        steps: [
          { do: 'Run the definition and count what it accepts.',
            why: 'The language is sparse, which is not itself the problem.',
            work: '4 of 127 strings accepted: ε, ab, aabb, aaabbb' },
          { do: 'Ask what a recogniser must remember at the moment the b run starts.',
            why: 'That is where the requirement bites.',
            work: 'the value of n, which is unbounded — 1, 2, 3 and upward' },
          { do: 'Compare with a fixed number of states.',
            why: 'A machine with k states cannot distinguish more than k prefixes.',
            work: 'aⁱ and aʲ need different states for all i ≠ j, so k must exceed every one of 1, 2, 3, …' },
          { do: 'Note what changes if the constraint is dropped.',
            why: 'a*b* asks for the same shape without the equality.',
            work: 'a*b* is regular with 3 states; aⁿbⁿ is not regular at all' },
          { do: 'Name the machine that does work.',
            why: 'A stack lifts exactly the restriction that failed.',
            work: 'a pushdown automaton with 1 stack symbol' }
        ],
        answer: 'The two languages differ by one word in their description and by a whole level ' +
          'of the hierarchy. The test is always the same: does membership require an unbounded ' +
          'count?'
      }
    ],

    'deterministic-finite-automata': [
      {
        title: 'Divisibility by 7 in seven states, built from arithmetic',
        goal: 'Derive a machine from the quantity that has to be remembered, then check it.',
        setup: 'Binary numerals read left to right, over the alphabet {0, 1}, with the empty ' +
          'numeral read as zero.',
        steps: [
          { do: 'Write what one more bit does to the value.',
            why: 'Reading left to right doubles the value and adds the bit.',
            work: 'v → 2v + b' },
          { do: 'Reduce that modulo 7 to get the transition function.',
            why: 'Two numerals with the same remainder behave identically from here on.',
            work: 'r → (2r + b) mod 7, which is the whole machine' },
          { do: 'Count the states.',
            why: 'One per remainder, and no two remainders are interchangeable.',
            work: '7 states, r0 through r6, with r0 accepting' },
          { do: 'Check against real arithmetic over every string up to length 8.',
            why: 'A hand-drawn machine agrees with its own trace; only arithmetic is independent.',
            work: '511 strings tested, 511 agreements' },
          { do: 'Ask whether the machine is already minimal.',
            why: 'Fewer states would mean two remainders are the same state.',
            work: '7 states against 7 Myhill–Nerode classes — minimal' }
        ],
        answer: 'Divisibility by 7 needs exactly 7 states, the transition function is the ' +
          'arithmetic itself, and the machine agrees with real division on all 511 binary ' +
          'strings up to length 8.'
      },
      {
        title: 'The case that inverts it: a machine that is not minimal, and why',
        goal: 'Show that the state count is a property of the language, not of your drawing.',
        setup: 'The pattern (a|b)*abb compiled by Thompson\'s construction and determinised, ' +
          'before any minimisation.',
        steps: [
          { do: 'Compile and determinise, and count.',
            why: 'The subset construction builds one state per reachable subset.',
            work: 'Thompson gives 14 states, the subset construction gives 5' },
          { do: 'Compute the equivalence classes from the language.',
            why: 'That count is both the lower and the upper bound on states.',
            work: '4 classes' },
          { do: 'Find the two states that are not distinguishable.',
            why: 'A pair with no separating suffix is one state.',
            work: 'refinement merges 1 pair in its first round' },
          { do: 'Minimise and confirm.',
            why: 'The result must accept the same language.',
            work: '4 states, agreeing with the 5-state machine on all 511 strings up to length 8' },
          { do: 'Compare with the "ends in abb" machine from the first example.',
            why: 'Same language, and the minimal machine is unique.',
            work: 'both are 4 states — the minimal machine does not depend on how it was built' }
        ],
        answer: 'The construction produced 5 states and the language has 4 classes, so one pair ' +
          'was redundant. The minimal machine is the same 4 states whichever route reaches it.'
      }
    ],

    'nondeterminism-and-subsets': [
      {
        title: 'Determinising (a|b)*abb, and checking the result',
        goal: 'Follow the subset construction and verify the two machines agree.',
        setup: 'Thompson\'s NFA for (a|b)*abb over {a, b}, then the subset construction.',
        steps: [
          { do: 'Count the NFA states before and after ε-removal.',
            why: 'Thompson\'s construction spends two states per operator.',
            work: '14 states, with ε-edges throughout' },
          { do: 'Run the subset construction and count the transitions it computes.',
            why: 'One per (reachable subset, symbol) pair.',
            work: '5 DFA states from 10 computed transitions' },
          { do: 'Read what each DFA state stands for.',
            why: 'A subset state is accepting exactly when it contains an accepting NFA state.',
            work: 'each state is a set of NFA states; one of the 5 contains the accepting one' },
          { do: 'Check the two machines over every string up to length 9.',
            why: 'Equivalence is the whole claim of the construction.',
            work: '1 023 strings, 0 disagreements' },
          { do: 'Minimise and see what the construction left behind.',
            why: 'Reachable subsets are not the same as distinguishable languages.',
            work: '5 states become 4' }
        ],
        answer: 'The subset construction turns 14 NFA states into 5 DFA states, agrees with the ' +
          'NFA on all 1 023 strings up to length 9, and leaves one redundant state that ' +
          'minimisation removes.'
      },
      {
        title: 'The case that inverts it: where determinisation actually explodes',
        goal: 'Measure the exponential family against its predicted bound.',
        setup: 'The pattern (a|b)*a(a|b)^n — an `a` exactly n + 1 positions from the end — for n ' +
          'from 1 to 7.',
        steps: [
          { do: 'Count the positions in the pattern.',
            why: 'The Glushkov automaton has one state per literal, so it grows linearly.',
            work: 'n = 1 gives 6 positions; n = 7 gives 18' },
          { do: 'State what the DFA must remember.',
            why: 'It cannot guess, so it carries every possibility.',
            work: 'which of the last n + 1 positions held an a — a subset of n + 1 positions' },
          { do: 'Predict the count.',
            why: 'The number of subsets of n + 1 positions.',
            work: '2^(n+1): 4, 8, 16, 32, 64, 128, 256' },
          { do: 'Measure the minimal DFA at each n.',
            why: 'The prediction is about the minimal machine, not about the construction.',
            work: 'measured 4, 8, 16, 32, 64, 128, 256 — exact at every n' },
          { do: 'Measure what the subset construction produced before minimisation.',
            why: 'Reachable subsets over-count by exactly one here.',
            work: '5, 9, 17, 33, 65, 129, 257 — one above the bound at every n' }
        ],
        answer: 'The minimal DFA hits 2^(n+1) exactly at every n, reaching 256 states for a ' +
          'pattern with 18 positions. The subset construction lands one state above the bound ' +
          'each time, which minimisation removes.'
      }
    ],

    'regular-expressions-and-constructions': [
      {
        title: 'Three constructions on one pattern, compared and cross-checked',
        goal: 'Measure what each construction costs and confirm they agree.',
        setup: 'The pattern (a|b)*abb, built three ways over the alphabet {a, b}.',
        steps: [
          { do: 'Build Thompson\'s NFA and count.',
            why: 'Two fresh states per operator, nothing shared.',
            work: '14 states, with ε-edges' },
          { do: 'Build the Glushkov position automaton.',
            why: 'One state per literal plus a start, and no ε-edges.',
            work: '6 states — 2.33× smaller' },
          { do: 'Build the derivative DFA.',
            why: 'The state is a regular expression, and it is deterministic already.',
            work: '4 states, matching the minimal DFA exactly' },
          { do: 'Check each against Thompson\'s over every string up to length 8.',
            why: 'A construction that is subtly wrong is self-consistent.',
            work: '511 strings each, 0 disagreements' },
          { do: 'Compare with the minimal machine.',
            why: 'It is the lower bound all three are approaching.',
            work: '4 states — the derivative construction reached it without a minimisation pass' }
        ],
        answer: '14, 6 and 4 states for one language, all three agreeing over 511 strings. The ' +
          'derivative construction lands on the minimal machine directly; Thompson\'s is three ' +
          'and a half times larger.'
      },
      {
        title: 'The case that inverts it: reading the regex back off the machine',
        goal: 'Show that the minimal automaton is unique and the minimal expression is not.',
        setup: 'The 4-state minimal DFA for (a|b)*abb, eliminated in two different orders.',
        steps: [
          { do: 'Add a fresh start and accept, and label every edge with an expression.',
            why: 'State elimination needs one entry and one exit that are never removed.',
            work: '4 interior states to eliminate' },
          { do: 'Eliminate in state order and measure the result.',
            why: 'Each removal reroutes every path through the state being deleted.',
            work: '40 characters' },
          { do: 'Eliminate in the reverse order and measure again.',
            why: 'Every order is correct; none is canonical.',
            work: '44 characters — 10% longer for the same language' },
          { do: 'Compile both back and check them against the machine.',
            why: 'A round trip that does not preserve the language is not a round trip.',
            work: 'both agree with the minimal DFA over 255 strings up to length 7' },
          { do: 'Contrast with the automaton side.',
            why: 'This is the asymmetry worth remembering.',
            work: '1 minimal automaton, 2 different expressions of 40 and 44 characters' }
        ],
        answer: 'Two elimination orders give expressions of 40 and 44 characters for the same ' +
          '4-state machine, and both round-trip correctly. The minimal automaton is unique; the ' +
          'minimal regular expression is not.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));

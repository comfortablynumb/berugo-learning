/** Worked examples for the suffix-structure sections (M06.4-M06.6). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'suffix-trees': [
      {
        title: 'Ukkonen on banana$, phase by phase',
        goal: 'Watch the remainder rise and fall, because that is what "implicit tree" means.',
        setup: 'The text banana with a terminator, built one character at a time.',
        steps: [
          {
            do: 'Run the first three phases.',
            why: 'Every character is new, so every phase is a plain rule-2 extension.',
            work: 'phase 1 (b): remainder 0, 2 nodes\nphase 2 (a): remainder 0, 3 nodes\nphase 3 (n): remainder 0, 4 nodes',
            result: 'three leaves off the root, nothing owed'
          },
          {
            do: 'Run phases 4 to 6.',
            why: 'The repeated "ana" is where the interesting behaviour starts.',
            work: 'phase 4 (a): remainder 1, activeLength 1, still 4 nodes\nphase 5 (n): remainder 2, activeLength 2\nphase 6 (a): remainder 3, activeLength 3',
            result: 'three phases add no nodes at all and the debt climbs to 3'
          },
          {
            do: 'Explain why no node was created.',
            why: 'This is rule 3, and it is the reason the tree is implicit.',
            work: 'each new character was already on the active edge: 3 rule-3 applications\nthe phase ends immediately, leaving the suffix inside an edge with no leaf',
            result: 'three suffixes exist in the tree and have nowhere to be marked'
          },
          {
            do: 'Add the terminator.',
            why: 'A character that occurs nowhere else cannot match, so every debt is paid at once.',
            work: 'phase 7 ($): remainder 0, nodes 4 → 11\n3 edge splits, 3 suffix links created',
            result: 'seven leaves for seven suffixes'
          },
          {
            do: 'Tally the construction.',
            why: 'To see where the linear bound comes from.',
            work: '7 phases, 10 extensions total\nrule 2 applied 7 times, rule 3 applied 3 times',
            result: '10 extensions for a 7-character text — linear, not quadratic'
          }
        ],
        answer: 'The remainder climbs to 3 across phases 4 to 6 without a single node being created, ' +
          'because each character was already present on the active edge — those three suffixes are ' +
          'in the tree implicitly, inside an edge. The terminator forces all three out at once: 4 ' +
          'nodes become 11, with 3 splits and 3 suffix links, and the finished tree has 7 leaves ' +
          'for 7 suffixes. The whole build took 10 extensions.'
      },
      {
        title: 'The memory that made everyone switch',
        goal: 'Price the suffix tree against the structures that answer the same questions.',
        setup: '2 000 characters of DNA, indexed four ways, cross-checked on 60 membership queries.',
        steps: [
          {
            do: 'Check that the four indexes agree before comparing them.',
            why: 'A size comparison between structures that answer differently is meaningless.',
            work: '60 patterns, half real substrings and half near-misses\nsuffix tree, suffix array, suffix automaton and FM-index: 0 disagreements',
            result: 'the same answers, so the only difference left is cost'
          },
          {
            do: 'Count the units each one holds.',
            why: 'Nodes, entries and states are not comparable, which is exactly the point.',
            work: 'tree 3 527 nodes (1.76 per character)\narray 2 000 entries (1.00) · automaton 3 668 states (1.83) · FM 2 001 characters (1.00)',
            result: 'the tree holds nearly twice as many objects as the text has characters'
          },
          {
            do: 'Convert to bytes per input character.',
            why: 'This is the only number the four can be ranked on.',
            work: 'tree 42.3 · automaton 34.7 · array 9.0 · FM-index 1.9',
            result: 'a spread of 22× between the largest and the smallest'
          },
          {
            do: 'Scale it to a real input.',
            why: 'The ratio only becomes a decision at a size where it changes what fits.',
            work: 'a 3-gigabase genome: tree 127 GB, array 27 GB, FM-index 5.6 GB',
            result: 'one of those fits on a laptop and one does not'
          },
          {
            do: 'Name what the tree still has.',
            why: 'The comparison is about size, not about worth, and the tree is not obsolete.',
            work: '3 527 nodes carry suffix links; the 2 000-entry array carries none\nmatching statistics and several linear-time algorithms are stated on those links',
            result: 'build a tree when you need the tree; build an array when you need the answers'
          }
        ],
        answer: 'On 2 000 characters of DNA all four indexes answer 60 membership queries identically ' +
          'and cost 42.3, 34.7, 9.0 and 1.9 bytes per character. Scaled to a 3-gigabase genome that ' +
          'is 127 GB against 5.6 GB for the same answers, which is why bioinformatics switched — not ' +
          'because the tree became wrong, but because the constant decided what fit in memory.'
      }
    ],

    'suffix-arrays': [
      {
        title: 'Building the array for mississippi by doubling',
        goal: 'Follow prefix doubling to the point where the ranks stop changing.',
        setup: 'The 11-character text mississippi, sorted by 1, then 2, then 4 characters.',
        steps: [
          {
            do: 'Sort by the first character and rank.',
            why: 'This is the base case, and it already distinguishes the four letters.',
            work: 'i(4 suffixes) < m(1) < p(2) < s(4)\nranks: 0, 1, 2, 3 by letter',
            result: 'four rank classes, none of them singletons except m'
          },
          {
            do: 'Sort by pairs of ranks and repeat.',
            why: 'Comparing 2k characters is comparing two k-character ranks, which are integers.',
            work: 'round 1 sorts by 2 characters, round 2 by 4, round 3 by 8\nthe loop exits when every rank is distinct',
            result: '3 rounds for an 11-character text'
          },
          {
            do: 'Read off the array.',
            why: 'The order is the answer, and it is checkable by eye at this size.',
            work: 'sa = 10, 7, 4, 1, 0, 9, 8, 6, 3, 5, 2\nsuffix 10 is "i", suffix 0 is the whole text',
            result: 'the shortest suffix sorts first, as it must'
          },
          {
            do: 'Compute the LCP array with Kasai.',
            why: 'The LCP column is what makes the array the equal of a tree.',
            work: 'lcp = 0, 1, 1, 4, 0, 0, 1, 0, 2, 1, 3\nthe largest entry is 4',
            result: 'the longest repeated substring is 4 characters: "issi"'
          },
          {
            do: 'Count the distinct substrings two ways.',
            why: 'Because a suffix automaton will have to agree, and disagreement is a real bug.',
            work: '11 × 12 ÷ 2 = 66 total prefixes of suffixes\nΣ lcp = 13, so 66 − 13 = 53',
            result: '53 distinct substrings, which the automaton also reports'
          }
        ],
        answer: 'Three doubling rounds produce sa = 10, 7, 4, 1, 0, 9, 8, 6, 3, 5, 2 and Kasai gives ' +
          'lcp = 0, 1, 1, 4, 0, 0, 1, 0, 2, 1, 3. The largest LCP entry, 4, marks the longest ' +
          'repeated substring "issi", and 66 − 13 = 53 distinct substrings — the same number a ' +
          'suffix automaton computes from a completely different quantity.'
      },
      {
        title: 'Three constructions, and why the slow one stays',
        goal: 'Price the constructions on a real input, and justify keeping the useless one.',
        setup: '4 000 characters of DNA, built by naive sort, prefix doubling and SA-IS.',
        steps: [
          {
            do: 'Count the comparisons each one performs.',
            why: 'The obvious column, and on its own it is misleading.',
            work: 'naive 42 555 comparisons\ndoubling 159 592 · SA-IS 0',
            result: 'the naive sort appears to do the fewest comparisons of the two that compare'
          },
          {
            do: 'Count the characters those comparisons touched.',
            why: 'A suffix comparison is not O(1), and this is where the quadratic term lives.',
            work: 'naive: 77 241 942 character comparisons\ndoubling: 0 · SA-IS: 0',
            result: '1 815 characters touched per comparison, on average'
          },
          {
            do: 'Explain the difference.',
            why: 'It is a representation change rather than a cleverer sort.',
            work: 'naive compares strings, 1 815 characters per comparison on average\ndoubling compares pairs of integers; SA-IS places positions into buckets by induction',
            result: 'the work moved out of the comparator, which is where the win is'
          },
          {
            do: 'Count the rounds and recursions.',
            why: 'These are the structural costs the two fast methods actually pay.',
            work: 'doubling: 6 rounds — ceil(log2 4 000) = 12, and it exits early\nSA-IS: 4 recursions on progressively smaller strings',
            result: 'both are far below their worst-case round counts on this input'
          },
          {
            do: 'Check all three produce the same array.',
            why: 'This is why the naive version is kept, and it is not optional.',
            work: 'naive = doubling = SA-IS on all 4 corpora, including a one-letter alphabet\nan off-by-one in the induced sort produces a plausible-looking wrong array',
            result: 'the obviously-correct version is the only cheap oracle available'
          }
        ],
        answer: 'The naive sort does 42 555 comparisons and touches 77 241 942 characters doing them; ' +
          'doubling does 159 592 comparisons and touches none, because it compares integers; SA-IS ' +
          'compares nothing at all and recurses 4 times. The naive version stays in the code as the ' +
          'oracle: a fast construction that is subtly wrong produces an array that answers most ' +
          'queries correctly, and nothing but a cross-check will find it.'
      }
    ],

    'suffix-automata': [
      {
        title: 'The clone, on the smallest text that needs one',
        goal: 'See a clone happen and see what it separates.',
        setup: 'The text abbbaab, built one character at a time.',
        steps: [
          {
            do: 'Build the automaton and count what it holds.',
            why: 'The bounds are tight, so the counts are worth checking against them.',
            work: '10 states for a 7-character text — the bound is 2n − 1 = 13\n13 transitions — the bound is 3n − 4 = 17',
            result: 'comfortably inside both bounds, and larger than n + 1 = 8'
          },
          {
            do: 'Count the clones.',
            why: 'The excess over n + 1 states is exactly the clones.',
            work: '2 clones\n8 prefix states + 2 clones = 10',
            result: 'each clone is a state that is not a prefix of the text'
          },
          {
            do: 'Say what a clone separates.',
            why: 'A clone is not an implementation detail; it is a class splitting.',
            work: 'a clone fires when len(q) > len(p) + 1, so q mixes 2 endpos classes\nthe new character has just separated them: 1 state has to become 2',
            result: 'one endpos class became two, so one state has to become two'
          },
          {
            do: 'Count the distinct substrings from the states.',
            why: 'This is the quantity that cross-checks against the suffix array.',
            work: 'Σ (len(v) − len(link(v))) over the 9 non-initial states = 21\nthe suffix array gives 7 × 8 ÷ 2 − Σ lcp = 21',
            result: '21 both ways'
          },
          {
            do: 'Note what a missing clone would have done.',
            why: 'The counts alone would not have revealed it.',
            work: 'the automaton would be smaller and still accept every one of the 21 substrings\nit would also accept "aba", "abaa" and "abba", which do not occur',
            result: 'smaller, still passing a spot check, and wrong'
          }
        ],
        answer: 'abbbaab needs 10 states for 7 characters — 8 prefixes plus 2 clones — with 13 ' +
          'transitions, both inside the 2n − 1 and 3n − 4 bounds. Each clone splits an endpos class ' +
          'the new character has separated. Both the automaton and the suffix array count 21 ' +
          'distinct substrings, and an automaton built without the clone step would be smaller, ' +
          'would still accept all 21, and would also accept three strings that never occurred.'
      },
      {
        title: 'The oracle: smaller, faster, and wrong',
        goal: 'Measure what skipping the clone case actually costs.',
        setup: 'The factor oracle and the suffix automaton for abbbaab, tested against every string ' +
          'of length up to 4 over the text\'s alphabet.',
        steps: [
          {
            do: 'Compare the sizes.',
            why: 'The oracle is genuinely the cheaper structure, which is why it is tempting.',
            work: 'oracle: 8 states — exactly n + 1, always\nautomaton: 10 states',
            result: '20% smaller, and its state count is known in advance'
          },
          {
            do: 'Test both on every substring of the text.',
            why: 'This is the test most implementations are checked with.',
            work: '21 distinct substrings\noracle accepts all 21; automaton accepts all 21',
            result: 'the test both structures pass'
          },
          {
            do: 'Test both on strings that are not substrings.',
            why: 'Accepting a superset is invisible to the previous step.',
            work: '30 strings of length 1 to 4 over {a, b}\nautomaton wrong on 0; oracle wrong on 3',
            result: 'the oracle accepts "aba", "abaa" and "abba"'
          },
          {
            do: 'State the alternative check.',
            why: 'Brute force does not scale, so the invariant has to stand in for it.',
            work: 'endpos identity: count(v) = Σ count(link children) + [v is a prefix state]\n1 structural assertion, checked on all 10 states, instead of 30 membership probes',
            result: 'one structural assertion instead of an exponential test set'
          },
          {
            do: 'Say where the oracle is nonetheless correct to use.',
            why: 'It is a real structure with a real purpose, not a broken one.',
            work: 'BOM-family string matching: a false accept costs 1 verification and nothing else\nthe oracle is 20% smaller here and its state count is exactly n + 1',
            result: 'fine as a filter, wrong as an index'
          }
        ],
        answer: 'The factor oracle for abbbaab has 8 states to the automaton\'s 10, accepts every one ' +
          'of the 21 real substrings, and also accepts "aba", "abaa" and "abba" — 3 of the 30 ' +
          'strings tested. It is a legitimate filter and an illegitimate index, and the only cheap ' +
          'way to tell the two structures apart in a test is the endpos identity on the link tree, ' +
          'because "it accepted every substring I tried" is passed by both.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));

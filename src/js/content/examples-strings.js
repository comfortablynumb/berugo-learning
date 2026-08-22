/** Worked examples for the naive matcher, KMP and the Z-algorithm (M15.1-M15.3). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'naive-matching': [
      {
        title: 'Nearly linear on English, quadratic on one line of input',
        goal: 'Measure the naive matcher on seven corpora and find the input that realises its bound.',
        setup: '4 000 characters of each corpus with its own default pattern, scanned left to right, ' +
          'counting character comparisons.',
        steps: [
          {
            do: 'Run it on English and divide the comparisons by the text length.',
            why: 'The worst case is n·m; the question is what the typical case actually costs.',
            work: '4 211 comparisons over 4 000 characters — 1.05 each',
            result: 'essentially linear'
          },
          {
            do: 'Ask why by counting inner-loop entries.',
            why: 'An alignment that fails on its first character costs exactly one comparison.',
            work: '191 of 3 998 alignments entered the inner loop — 95.2% failed immediately',
            result: 'the alphabet is doing the work, not the algorithm'
          },
          {
            do: 'Now search for a 12-character pattern of a\'s ending in b, inside 4 000 a\'s.',
            why: 'Every alignment now agrees on all but the last character.',
            work: '47 868 comparisons — 11.97 per character, which is the pattern length',
            result: 'the O(nm) bound, arriving in full'
          },
          {
            do: 'Compare the two rows.',
            why: 'Nothing about the algorithm changed between them.',
            work: '1.05 against 11.97 — an 11.4× difference from the input alone',
            result: 'the gap the rest of the milestone exists to close'
          },
          {
            do: 'Read the alphabet column across all seven corpora.',
            why: 'The failure rate of the first comparison is a property of the alphabet.',
            work: 'English 26 symbols at 1.05, DNA 4 at 1.35, binary 2 at 1.99, one repeated ' +
              'character at 4.00',
            result: 'the cost rises as the alphabet shrinks, monotonically'
          }
        ],
        answer: '1.05 comparisons per character on English and 11.97 on the adversarial corpus, ' +
          'from the same twelve lines of code. The lesson is that "O(nm)" describes an input rather ' +
          'than an algorithm: on the data `indexOf` actually sees, the naive scan is within a few ' +
          'per cent of optimal, and on one line of adversarial input it is a denial-of-service hole.'
      },
      {
        title: 'The filter that saves no comparisons and is worth having anyway',
        goal: 'Measure what a first-character filter actually removes, and be precise about the ' +
          'units the saving is in.',
        setup: 'The same English corpus, scanned twice: once plainly, once skipping any alignment ' +
          'whose first character cannot match.',
        steps: [
          {
            do: 'Count the character comparisons both ways.',
            why: 'The obvious expectation is that filtering removes work.',
            work: '4 211 with the filter and 4 211 without — identical',
            result: 'no comparison is saved, ever'
          },
          {
            do: 'Work out why.',
            why: 'A negative result needs an explanation or it is an anomaly.',
            work: 'the filter compares text[i] against pattern[0], which is exactly the comparison ' +
              'the inner loop makes first',
            result: 'the same comparison, moved to a different loop'
          },
          {
            do: 'Count inner-loop entries instead.',
            why: 'That is the quantity the filter actually moves.',
            work: '3 998 entries fall to 191 — a 20.9× reduction, and 3 807 alignments skipped',
            result: 'the saving, in the right units'
          },
          {
            do: 'Say why that matters on a real machine.',
            why: 'A count that does not fall can still describe work that does.',
            work: 'a memchr-style scan examines 16 bytes per instruction; a general inner loop ' +
              'examines 1',
            result: 'the same comparisons at a sixteenth of the cost'
          },
          {
            do: 'Check the adversarial corpus.',
            why: 'A filter that helps everywhere would be suspicious.',
            work: '3 989 of 3 989 alignments enter the inner loop — the filter skips nothing at all',
            result: 'and the pathological input stays pathological'
          }
        ],
        answer: '4 211 comparisons either way, and 3 998 inner-loop entries down to 191. The ' +
          'honest report is that the filter changes no number in this table and changes the ' +
          'wall-clock by a large factor, because the two loops it moves work between run at ' +
          'different speeds. Reporting the comparison count as though it had fallen would have been ' +
          'easier and false.'
      }
    ],

    'kmp-prefix-function': [
      {
        title: 'The border array, and four questions it answers that are not searching',
        goal: 'Compute the prefix function once and read period, power, prefix counts and the ' +
          'shift rule off it.',
        setup: 'The pattern "ababcabab", nine characters, and its border array computed in one ' +
          'left-to-right pass.',
        steps: [
          {
            do: 'Compute the array and read its last entry.',
            why: 'That is the longest border of the whole pattern and the basis of every shift.',
            work: '0, 0, 1, 2, 0, 1, 2, 3, 4 — in 9 preprocessing steps',
            result: 'the border is "abab", of length 4'
          },
          {
            do: 'Subtract it from the length.',
            why: 'n minus the longest border is the smallest period.',
            work: '9 − 4 = 5, and 5 does not divide 9',
            result: 'the pattern is not an exact repetition of anything'
          },
          {
            do: 'Walk the border chain backwards.',
            why: 'It counts occurrences of every prefix inside the pattern, all n of them at once.',
            work: 'on "aabaaab" the first character occurs 5 times and the whole string once',
            result: 'n answers from one backwards loop'
          },
          {
            do: 'Use it as a shift rule and count text positions re-read.',
            why: 'The distinctive property of KMP is not its speed.',
            work: '0 text positions re-read on every corpus',
            result: 'a matcher that works on a stream'
          },
          {
            do: 'Compare its cost against the naive scan on English.',
            why: 'A guarantee is worth what it costs on the common case.',
            work: 'KMP 1.08 comparisons per character against the naive 1.07, plus 9 preprocessing ' +
              'steps',
            result: 'slightly worse, on the input people actually have'
          }
        ],
        answer: 'Border 4, period 5, and 0 text positions re-read — with KMP measured slightly ' +
          'slower than the naive scan on English. That last figure is the one worth keeping: KMP ' +
          'buys the absence of a cliff rather than speed, and the array it computes to do so ' +
          'answers three other questions on the way past.'
      },
      {
        title: 'Where the guarantee pays, and what the automaton costs to remove the loop',
        goal: 'Find the input where KMP\'s bound is worth having, then price the table that removes ' +
          'its inner loop entirely.',
        setup: 'The same pattern on the adversarial and repeated corpora; then the automaton form ' +
          'built over three alphabets.',
        steps: [
          {
            do: 'Run the naive scan and KMP on the adversarial corpus.',
            why: 'This is the input the O(nm) bound is about.',
            work: 'naive 47 868 comparisons, KMP 7 989 — a 6.0× saving',
            result: 'the insurance paying out'
          },
          {
            do: 'Run both on the repeated corpus, where the pattern matches almost everywhere.',
            why: 'A matcher that skips has nothing to skip here.',
            work: 'KMP 4 000 comparisons — exactly one per character — against the naive 15 988',
            result: 'KMP wins outright, and every skipping matcher pays 15 988'
          },
          {
            do: 'Build the automaton and count its cells on DNA.',
            why: 'The table removes the fallback loop at a cost of alphabet × states.',
            work: '10 states, 40 cells, and exactly 4 000 comparisons — one lookup per character',
            result: 'no inner loop at all'
          },
          {
            do: 'Build the same automaton over the English alphabet.',
            why: 'The identical automaton, a different alphabet.',
            work: '10 states, 260 cells — 6.5× the memory for the same machine',
            result: 'the decision is entirely about the alphabet'
          },
          {
            do: 'Note what happens at Unicode.',
            why: 'The trade has to be stated at the size it actually arrives in.',
            work: 'a million-symbol alphabet over 10 states is ten million cells for a nine-character ' +
              'pattern',
            result: 'which is why every table-building matcher works over bytes'
          }
        ],
        answer: '6.0× on the adversarial corpus and 4.0× on the repeated one, against a loss on ' +
          'English — and an automaton that costs 40 cells on DNA and 260 on English for the same ten ' +
          'states. Both halves are the same lesson: the algorithm is fixed and the input decides, ' +
          'so the useful question is never "which matcher is fastest" but "what does my alphabet ' +
          'look like and how often does my pattern occur".'
      }
    ],

    'z-algorithm': [
      {
        title: 'Three cases, one window, and a proof that fits in a sentence',
        goal: 'Build a Z-array, count what each of the three cases cost, and check it against a ' +
          'definition-by-definition computation.',
        setup: 'The string "aabxaabxcaabxaabxay", 19 characters, with the window traced at every ' +
          'position.',
        steps: [
          {
            do: 'Build the array and check it against the O(n²) definition.',
            why: 'A linear construction that is subtly wrong produces a plausible array.',
            work: '19 values, matching the brute-force computation at every position',
            result: 'correct, checked rather than argued'
          },
          {
            do: 'Count the positions answered from the window.',
            why: 'Those cost zero character comparisons.',
            work: '11 of 18 positions were inside the window; the other 7 started from nothing',
            result: 'most of the array was copied rather than computed'
          },
          {
            do: 'Count the characters actually compared.',
            why: 'That is the only work the algorithm does.',
            work: '14 extensions on a string of 19 characters',
            result: 'below the length, as the bound requires'
          },
          {
            do: 'Read the window edge down the trace.',
            why: 'The proof is that it never falls.',
            work: 'the right edge moves 0, 2, 2, 6, 6, 6, 6, 14, … and never decreases',
            result: 'every successful comparison pushes it right, and it can be pushed at most n times'
          }
        ],
        answer: '11 positions answered by the mirror and 14 characters compared on a 19-character ' +
          'string. The whole complexity argument is the monotone edge: a comparison either fails, ' +
          'once per position, or succeeds and moves the edge right — and the edge can move right at ' +
          'most n times. That is the same argument Manacher uses in 15.7 and Myers uses in 15.9.'
      },
      {
        title: 'Matching by concatenation, and the bound that is tight to the character',
        goal: 'Use the array as a matcher, note what the sentinel costs, and construct the ' +
          'tightness of Fine and Wilf rather than citing it.',
        setup: 'The same corpus as 15.2, plus the Fibonacci words and a union-find over forced ' +
          'positions.',
        steps: [
          {
            do: 'Concatenate pattern, sentinel and text, and read off every position with z >= m.',
            why: 'Three lines, and the same occurrences as any other matcher.',
            work: '4 320 comparisons against KMP\'s 4 304 on the same English corpus',
            result: 'the same asymptotics and a worse constant'
          },
          {
            do: 'Say what the extra cost buys and what it forbids.',
            why: 'A trade stated as a saving is not a trade.',
            work: 'an array of 4 000 entries rather than 9, and the whole text needed in memory ' +
              'before the first comparison',
            result: 'easier to write, more expensive to run, and not a stream matcher'
          },
          {
            do: 'Take the two smallest proper periods of each Fibonacci word and apply Fine and Wilf.',
            why: 'The lemma says two short periods force their gcd to be a period too.',
            work: 'length 8 with periods 5 and 7 gives a bound of 11; length 34 with 21 and 29 ' +
              'gives 49 — the bound exceeds the length on every row',
            result: 'the lemma never applies, and gcd = 1 is never a period'
          },
          {
            do: 'Force both periods on a string of exactly p + q − gcd and count the free symbols.',
            why: 'Tightness is a construction, not a citation.',
            work: 'for p = 5 and q = 8 the bound is 12: exactly 1 symbol is free at length 12 and ' +
              '2 at length 11',
            result: 'the gcd is forced at the bound and not one character below it'
          },
          {
            do: 'Repeat for a non-coprime pair.',
            why: 'The statement is about the gcd, not about coprimality.',
            work: 'p = 6 and q = 9 give a bound of 12 with 3 classes at the bound and 4 below',
            result: 'the count collapses to gcd exactly, in every row'
          }
        ],
        answer: '4 320 comparisons against KMP\'s 4 304, and a bound that is tight to the character ' +
          'in every row of the table. The Fibonacci words are the family engineered to sit just ' +
          'outside it, which is why every periodicity implementation is tested on them — and why an ' +
          'implementation correct on "aaaa" and "abcabc" and wrong on a Fibonacci word is the ' +
          'normal case rather than an unlucky one.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));

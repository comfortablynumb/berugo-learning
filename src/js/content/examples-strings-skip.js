/** Worked examples for Boyer-Moore, rolling hashes and Aho-Corasick (M15.4-M15.6). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'boyer-moore': [
      {
        title: 'The only matcher that gets faster as the pattern grows',
        goal: 'Measure characters examined per text character as the pattern lengthens, against ' +
          'three matchers that cannot go below one.',
        setup: '4 000 characters of English, with the pattern taken from the text itself at lengths ' +
          '2, 4, 8, 16 and 32.',
        steps: [
          {
            do: 'Run Boyer-Moore at each length and divide comparisons by text length.',
            why: 'Below one comparison per character is sublinear, which nothing else here achieves.',
            work: '0.611, 0.324, 0.165, 0.131, 0.106',
            result: 'falling monotonically as the pattern grows'
          },
          {
            do: 'Run KMP on the same five patterns.',
            why: 'A left-to-right matcher must look at every character at least once.',
            work: '1.048, 1.056, 1.055, 1.054, 1.052',
            result: 'flat, and above one'
          },
          {
            do: 'Run the naive scan too.',
            why: 'The baseline should be shown moving in the other direction.',
            work: '1.057, 1.068, 1.072, 1.080, 1.096 — rising slightly',
            result: 'a longer pattern costs the naive scan slightly more'
          },
          {
            do: 'State the ratio at each end.',
            why: 'One number without the other is half the claim.',
            work: 'at length 2 Boyer-Moore does 58% of KMP\'s work; at length 32 it does 10%',
            result: 'a 5.8× swing from the pattern length alone'
          },
          {
            do: 'Read the bad-character table for a three-character pattern.',
            why: 'The skip has to be explicable, not magical.',
            work: 'for "the": e slides by 1, h by 1, t by 2, and any of the other 23 letters by the ' +
              'full 3',
            result: 'most text characters license the maximum jump'
          }
        ],
        answer: '0.611 falling to 0.106 characters examined per text character, against a flat 1.05 ' +
          'for KMP. The mechanism is in the last step: a pattern of length m contains at most m ' +
          'distinct characters, so on a 26-letter alphabet most mismatches are against a character ' +
          'the pattern does not contain — and that licenses a full m-position slide with m − 1 ' +
          'characters never examined.'
      },
      {
        title: 'Which rule does the work, and the corpora where the whole idea fails',
        goal: 'Price the two shift rules separately, then find the inputs on which every skipping ' +
          'matcher collapses to the naive cost.',
        setup: 'The same English corpus with each rule enabled alone and both together; then ' +
          'Boyer-Moore, Horspool and Sunday across all seven corpora.',
        steps: [
          {
            do: 'Run with both rules, then with each alone.',
            why: 'The combined number hides which half is earning its construction cost.',
            work: 'both 1 553 comparisons, bad character alone 1 615, good suffix alone 3 641',
            result: 'the bad-character rule is doing almost all of it'
          },
          {
            do: 'Count which rule decided each shift.',
            why: 'A rule that never wins is a table built for nothing.',
            work: 'bad character 1 195, good suffix 139, tied 40',
            result: '87% of shifts decided by the cheaper table'
          },
          {
            do: 'Compare the three variants on English and on source code.',
            why: 'Horspool and Sunday drop machinery, so they should lose somewhere.',
            work: 'English 1 553 / 1 553 / 1 265 and source 80 / 77 / 74 — Sunday wins both',
            result: 'the simplest variant wins on a large alphabet'
          },
          {
            do: 'Repeat on DNA and binary.',
            why: 'Four symbols and two symbols are where the bet stops paying.',
            work: 'DNA 1 927 / 2 611 / 2 108 and binary 1 855 / 5 978 / 5 328 — full Boyer-Moore ' +
              'wins both',
            result: 'the good-suffix rule earns its keep exactly where the alphabet is small'
          },
          {
            do: 'Run all three on the adversarial and repeated corpora.',
            why: 'Every algorithm should be shown losing somewhere.',
            work: 'adversarial 3 989 / 3 989 / 23 940 and repeated 15 988 for all three, against ' +
              'KMP\'s 4 000',
            result: 'Sunday is 6× worse than the others, and all three lose to KMP'
          }
        ],
        answer: '1 553 against 1 615 and 3 641 for the two rules alone, with the bad-character rule ' +
          'deciding 1 195 of 1 374 contested shifts. Across seven corpora the best of the three ' +
          'variants changes hands four times, and on the repeated corpus all three pay 15 988 — ' +
          'exactly the naive cost — while KMP pays 4 000. No matcher here dominates, which is why ' +
          'real `strstr` implementations are hybrids with a linear-time fallback.'
      }
    ],

    'rolling-hashes': [
      {
        title: 'The modulus decides the work and never the answer',
        goal: 'Sweep the modulus over four orders of magnitude and watch the spurious-hit count ' +
          'move while the occurrence list does not.',
        setup: '4 000 characters of English, the pattern "the", and the same rolling hash at moduli ' +
          '101, 1 009, 1 000 003 and 999 999 937.',
        steps: [
          {
            do: 'Run at modulus 101 and separate hash hits from real occurrences.',
            why: 'A hit is a fingerprint match; an occurrence is a character match.',
            work: '31 hash hits, 12 real occurrences, 19 spurious, 55 character comparisons',
            result: 'more than half the hits were wrong'
          },
          {
            do: 'Compare against the prediction, windows over modulus.',
            why: 'A model that is never checked is a superstition.',
            work: '3 998/101 = 39.58 predicted against 19 measured',
            result: 'the same order, and the hash spreads better than uniformly here'
          },
          {
            do: 'Run at 1 000 003 and 999 999 937.',
            why: 'The usual choice and a much larger one.',
            work: '12 hits and 12 occurrences at both — 0 spurious, 36 comparisons',
            result: 'the filter is exact at this scale'
          },
          {
            do: 'Check the occurrence list at every modulus.',
            why: 'This is the property that makes the modulus a tuning parameter.',
            work: '12 occurrences at all four settings, identical positions',
            result: 'the verification makes the answer independent of the hash'
          }
        ],
        answer: '19 spurious hits at modulus 101 and 0 at a million, with the same 12 occurrences ' +
          'reported at every setting. That separation is the whole design: the fingerprint decides ' +
          'the work and the verification decides the answer, and every criticism of Rabin-Karp that ' +
          'starts "but it can produce false positives" is about an implementation that dropped the ' +
          'second half.'
      },
      {
        title: 'One second of work defeats a fixed base, and one line restores it',
        goal: 'Build a colliding pair by birthday search, use it to defeat the filter completely, ' +
          'then defeat the attack by randomising a constant.',
        setup: 'Random 16-character strings hashed at the default base 257 and modulus 1 000 003, ' +
          'until two collide; then a text made by repeating one of them.',
        steps: [
          {
            do: 'Search for two random strings with the same fingerprint.',
            why: 'The birthday bound says about √M tries suffice, and M is a million.',
            work: '1 536 tries against an estimate of 1 000',
            result: 'a colliding pair, in milliseconds, needing only the published constants'
          },
          {
            do: 'Build a text by repeating the second half of the pair 200 times and search for the first.',
            why: 'Every aligned window now fingerprints to the pattern\'s value.',
            work: '200 spurious hits over 3 200 characters, at 1 200 character comparisons',
            result: 'the filter admits every window and finds nothing'
          },
          {
            do: 'Check the answer.',
            why: 'The attack should cost work rather than correctness.',
            work: '0 occurrences reported, which is correct',
            result: 'a performance attack, not a correctness one'
          },
          {
            do: 'Run the identical text with a randomly chosen base, twenty times.',
            why: 'The pair was a solution for one base only.',
            work: '0 spurious hits at the worst of 20 trials, 0 in total',
            result: 'the attack evaporates'
          },
          {
            do: 'Run it once more at a much larger modulus with the fixed base.',
            why: 'A bigger modulus is the other obvious defence, and it is weaker.',
            work: '0 spurious hits — but the pair could simply be recomputed for the new constant',
            result: 'randomisation is the fix; a larger constant is only a bigger target'
          }
        ],
        answer: '1 536 tries to build the pair, 200 spurious hits and 1 200 wasted comparisons at ' +
          'the fixed base, and 0 across 20 random ones. The lesson generalises well past this ' +
          'algorithm: a deterministic hash of untrusted input is a promise that its worst case is ' +
          'reachable on demand, which is the same reasoning that produced SipHash for hash tables ' +
          'after the 2011 flooding attacks.'
      }
    ],

    'aho-corasick': [
      {
        title: 'The output links, and the two matches that vanish without them',
        goal: 'Build the automaton for a pattern set where one pattern is a suffix of another, and ' +
          'measure exactly what dropping the output chain costs.',
        setup: 'The patterns he, she, his, hers and her over the line "ushers said he hushed his ' +
          'hers", checked against a brute-force multi-pattern oracle.',
        steps: [
          {
            do: 'Build the trie and count the states.',
            why: 'One state per distinct prefix of any pattern is the memory model.',
            work: '10 states and 9 goto edges for 5 patterns',
            result: 'the shared prefixes are shared'
          },
          {
            do: 'Run the scan with output links and compare against the oracle.',
            why: 'Every occurrence of every pattern, exactly once each.',
            work: '11 matches, 0 missing and 0 extra, over 10 failure-link follows and 2 output-link follows',
            result: 'complete'
          },
          {
            do: 'Turn the output links off and run it again.',
            why: 'This is the five-line difference the section exists for.',
            work: '9 matches against a true 11 — 2 missed, with the failure-link count unchanged at 10',
            result: 'the same run, two answers short, and nothing about it looks different'
          },
          {
            do: 'Identify which matches disappeared.',
            why: 'A count without the cause is not a diagnosis.',
            work: '"he" at position 2 inside "she" at position 1, and "he" at 18 inside "she" at 17',
            result: 'exactly the patterns that are proper suffixes of another pattern'
          }
        ],
        answer: '11 matches with the output chain and 9 without, and the two lost are precisely the ' +
          'nested ones. The diagnostic that matters is the question rather than the debugger: when ' +
          'a multi-pattern matcher is reported as "missing some matches", ask whether any pattern in ' +
          'the set is a suffix of another. That resolves most reports of this shape, and it explains ' +
          'why they arrive months after the matcher was written — nobody adds "he" to a list ' +
          'containing "she" on the day it is tested.'
      },
      {
        title: 'One pass against k passes, and the alphabet that decides the table',
        goal: 'Show that the automaton\'s cost is independent of the pattern count, then price the ' +
          'dense goto table on two alphabets.',
        setup: 'English text of 4 000 characters with pattern sets of 1, 2, 4, 8, 16 and 32 words ' +
          'drawn from it; then the same automaton converted to a dense table over four corpora.',
        steps: [
          {
            do: 'Run the automaton at each set size and record its comparisons.',
            why: 'One pass over the text should cost one pass over the text.',
            work: '4 000 at every size from 1 to 32 patterns',
            result: 'flat, exactly the text length'
          },
          {
            do: 'Run one naive scan per pattern for comparison.',
            why: 'That is the alternative the automaton replaces.',
            work: '4 303, 8 645, 17 288, 34 654, 68 864, 135 036',
            result: 'linear in the pattern count'
          },
          {
            do: 'Take the ratio at each end.',
            why: 'The crossover is the recommendation.',
            work: '1.08× at one pattern and 33.76× at thirty-two',
            result: 'at one pattern the automaton is a loss'
          },
          {
            do: 'Watch the state count as the set grows.',
            why: 'Memory is the other half of the trade.',
            work: '5, 11, 20, 42, 73, 138 states for 1 to 32 patterns',
            result: 'sublinear in the total pattern length, because prefixes are shared'
          },
          {
            do: 'Convert to a dense goto table on DNA and on source code.',
            why: 'Removing the failure-link loop costs alphabet × states.',
            work: '40 cells on a 4-symbol alphabet and 400 on a 40-symbol one, for the identical ' +
              '10-state automaton',
            result: 'a 10× memory difference from the alphabet alone'
          }
        ],
        answer: '4 000 comparisons at every set size against 135 036 for thirty-two separate scans, ' +
          'and a dense table costing 40 cells or 400 for the same machine. Both halves are the same ' +
          'shape of decision: the automaton is worth building exactly when there is more than one ' +
          'thing to look for, and the dense table is worth building exactly when the alphabet is ' +
          'small — which is why intrusion-detection engines work over bytes.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));

/** Worked examples for palindromes, approximate matching and diff (M15.7-M15.9). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'palindromes': [
      {
        title: 'The mirror, and the two counts that differ by a factor of n',
        goal: 'Build a radius array, count what the mirror gave for free, and separate "how many ' +
          'palindromic substrings" from "how many different ones".',
        setup: 'The string "abacabadabacaba", interleaved with separators into 31 transformed ' +
          'characters, plus its palindromic tree.',
        steps: [
          {
            do: 'Interleave and build the radius array.',
            why: 'One array covers odd and even palindromes, and a radius here is a length there.',
            work: '31 transformed characters, longest radius 15 at the centre',
            result: 'the whole string is a palindrome'
          },
          {
            do: 'Count the positions answered from the mirror.',
            why: 'Those cost zero character comparisons.',
            work: '11 of 31 positions reused a mirror; 26 characters were actually compared',
            result: 'below the transformed length, as the bound requires'
          },
          {
            do: 'Sum the radii to count palindromic substrings, and check exhaustively.',
            why: 'A wrong min in the mirror step produces plausible numbers.',
            work: '32 palindromic substrings, matching a brute-force O(n²) expansion',
            result: 'correct, checked rather than argued'
          },
          {
            do: 'Build the eertree and count its nodes.',
            why: 'That is a different question with a different answer.',
            work: '15 distinct palindromic substrings, matching an exhaustive enumeration',
            result: 'the vocabulary rather than the count'
          },
          {
            do: 'Switch to a string of 800 identical characters.',
            why: 'The extreme case separates the two counts as far as they go.',
            work: '320 400 palindromic substrings against 800 distinct ones — n(n+1)/2 and n',
            result: 'a factor of n between the two questions'
          }
        ],
        answer: '32 substrings and 15 distinct on the default string, and 320 400 against 800 on a ' +
          'run of identical characters. No arithmetic on the radius array recovers the second ' +
          'number from the first, which is why the eertree exists — and its node count is at most ' +
          'n + 2, because adding one character creates at most one palindrome that was not there ' +
          'before.'
      },
      {
        title: 'What the mirror saves, on the family where it saves the most',
        goal: 'Measure Manacher against expanding around every centre across two families, and ' +
          'find where the linear algorithm stops mattering.',
        setup: 'Strings of 20 to 800 characters, first random over two letters and then a single ' +
          'repeated character, with both algorithms counted in character comparisons.',
        steps: [
          {
            do: 'Run both on random two-letter strings.',
            why: 'This is the realistic case and the ratio should be modest.',
            work: 'at 800 characters, Manacher 3 199 against 4 899 — 1.5×',
            result: 'linear against nearly linear'
          },
          {
            do: 'Note why the naive method is nearly linear here.',
            why: 'A ratio of 1.5 needs explaining or it undermines the section.',
            work: 'the longest palindrome in a random binary string of 800 is about 20 characters, ' +
              'so most centres expand a handful of steps and stop',
            result: 'the quadratic bound is not reached on random data'
          },
          {
            do: 'Switch to a string of one repeated character.',
            why: 'Every centre now expands all the way to an edge.',
            work: 'at 800 characters, Manacher 3 200 against 641 599 — 200.5×',
            result: 'the O(n²) bound arriving in full'
          },
          {
            do: 'Read the ratio down the sizes on that family.',
            why: 'A single ratio does not show a growth rate.',
            work: '5.5×, 13.0×, 25.5×, 50.5×, 100.5×, 200.5× at 20, 50, 100, 200, 400 and 800',
            result: 'the ratio doubles with the length, which is what linear against quadratic means'
          },
          {
            do: 'Check the two counts on the same family.',
            why: 'The extreme case should also be the clearest for the distinct question.',
            work: 'palindromic substrings 210, 1 275, 5 050, 20 100, 80 200, 320 400 against ' +
              'distinct counts equal to n every time',
            result: 'exactly n(n+1)/2 and exactly n'
          }
        ],
        answer: '1.5× on random binary strings and 200.5× on a repeated character, with the ratio ' +
          'doubling as the length does. The honest reading is that Manacher is insurance rather ' +
          'than speed on realistic data — the same shape as KMP in 15.2 — and that the family where ' +
          'it matters is exactly the family where a naive implementation would have looked fine in ' +
          'testing.'
      }
    ],

    'approximate-matching': [
      {
        title: 'Four AND terms, checked at every error budget, and the cliff at the word boundary',
        goal: 'Verify the bit-parallel recurrence against a dynamic-programming reference, then ' +
          'walk the pattern length off the end of a machine word.',
        setup: '9 870 characters of log lines, the pattern "orders", at error budgets 0 to 4; then ' +
          'the same corpus with patterns of length 8 to 48.',
        steps: [
          {
            do: 'Run bitap and a plain DP search at each error budget and compare the end positions.',
            why: 'Getting one of the four AND terms wrong reports positions almost everywhere.',
            work: '102, 306, 510, 864 and 1 468 end positions at k = 0 to 4 — identical from both',
            result: 'the recurrence is right'
          },
          {
            do: 'Compare the work at each budget.',
            why: 'The bit-parallel version should cost k + 1 words per character.',
            work: 'bitap 9 870, 19 740, 29 610, 39 480 and 49 350 words against a flat 59 220 DP cells',
            result: 'exactly one word per character per error level'
          },
          {
            do: 'Take the ratio at k = 4.',
            why: 'The saving should be the pattern length divided by k + 1.',
            work: '59 220 / 49 350 = 1.2×, and 6 / 5 = 1.2',
            result: 'the model and the measurement agree'
          },
          {
            do: 'Now grow the pattern from 8 to 32 characters at k = 1.',
            why: 'A longer pattern should cost bitap nothing at all.',
            work: '2.00 words per character at 8, 16, 24 and 32 — flat, while DP cells go 78 960 to ' +
              '315 840',
            result: 'the ratio rises from 4× to 16× and bitap does not move'
          },
          {
            do: 'Ask for 40 and 48 characters.',
            why: 'The register is 32 bits wide.',
            work: 'refused outright at 40 and at 48, because the state needs 40 bits and the ' +
              'register holds 32',
            result: 'the cliff, exactly at the word size'
          }
        ],
        answer: 'Identical positions at every error budget, a flat 2.00 words per character from ' +
          'pattern length 8 to 32, and a refusal at 40. The staircase is the point: the cost per ' +
          'character is `ceil(m / w) × (k + 1)`, so this family of algorithms got faster when ' +
          'registers widened and nobody changed the algorithm — and every `agrep`-style tool has a ' +
          'documented pattern-length limit for the same reason.'
      },
      {
        title: 'A band that refuses, and a filter that silently stops filtering',
        goal: 'Show that a banded distance above its budget is not a number, and that the q-gram ' +
          'filter has a condition which fails without any error.',
        setup: 'Six string pairs at a budget of k = 1, then the same log corpus filtered at q = 2, ' +
          '3, 4 and 5 for a six-character pattern.',
        steps: [
          {
            do: 'Compute the banded distance for each pair and record whether it was exact.',
            why: 'The band is a correct restriction only inside its budget.',
            work: '71 cells computed against 314 for the full grid — 77.4% never touched — and 5 of ' +
              'the 6 pairs returned a refusal',
            result: 'most of the savings come from pairs whose answer the band cannot give'
          },
          {
            do: 'Read one refusal carefully.',
            why: 'The distinction is the whole panel.',
            work: '"kitten" against "sitting" has true distance 3; at k = 1 the band reports "greater ' +
              'than 1"',
            result: 'an inequality, not the value 2'
          },
          {
            do: 'Compute the q-gram threshold at each q.',
            why: 'm − q + 1 − kq is three variables and one subtraction.',
            work: 'q = 2 gives 3, q = 3 gives 1, q = 4 gives −1 and q = 5 gives −3',
            result: 'two of the four settings are unusable'
          },
          {
            do: 'Run the pipeline at each setting and count candidates.',
            why: 'An unusable filter should admit everything, and it should be visible.',
            work: 'candidates 54, 177, 1 196 and 1 196 out of 1 196 positions',
            result: 'at q = 4 and 5 the filter passes every window'
          },
          {
            do: 'Divide by the result count.',
            why: 'Candidates per result is the number that decides throughput.',
            work: '2.0, 6.6, 44.3 and 44.3 candidates per result, for the same 27 results',
            result: 'a 22× swing in cost with no change in the answer'
          }
        ],
        answer: '71 cells against 314 with 5 of 6 pairs refusing, and a filter that goes from 2.0 ' +
          'to 44.3 candidates per result as q moves by two. Both halves are about stating a ' +
          'guarantee honestly: the band is exact within its budget and silent outside it, and the ' +
          'filter is sound only while its threshold is positive — a condition that depends on the ' +
          'pattern length and so changes with every query.'
      }
    ],

    'diff-and-merge': [
      {
        title: 'Myers costs the size of the answer, not the size of the input',
        goal: 'Sweep the fraction of changed lines at a fixed file size and watch the search work ' +
          'track the edit distance rather than the file.',
        setup: 'Two 200-line files differing in 1% to 60% of their lines, diffed by Myers with the ' +
          'diagonals and snake comparisons counted.',
        steps: [
          {
            do: 'Diff at 1% changed and count the diagonals visited.',
            why: 'A table-filling implementation would visit N × M cells regardless.',
            work: 'edit distance 4, 13 diagonals visited, 210 snake comparisons',
            result: '0.03% of the 40 000 cells a table would fill'
          },
          {
            do: 'Repeat at 10% and 60%.',
            why: 'The claim is that the work tracks D and not N.',
            work: 'D 40 with 841 diagonals, and D 240 with 29 041 diagonals',
            result: 'roughly quadratic in D, and independent of the file size'
          },
          {
            do: 'Express the last row as a fraction of the table.',
            why: 'The quadratic case should be shown as well as the cheap one.',
            work: '72.60% of N × M at 60% changed',
            result: 'two unrelated files cost the full grid, which is also correct'
          },
          {
            do: 'Check that every script reconstructs the second file.',
            why: 'An edit script that does not round-trip makes every other number meaningless.',
            work: 'all 7 rows apply cleanly to produce B exactly',
            result: 'the only claim worth asserting'
          }
        ],
        answer: '13 diagonals at 1% changed and 29 041 at 60%, on identical file sizes. That is why ' +
          '`git diff` on a one-line change to a ten-thousand-line file returns before you let go of ' +
          'the key: the search stops when it reaches the corner, and on a small change it reaches ' +
          'it after a handful of cost levels.'
      },
      {
        title: 'The shortest edit script, and the one a reviewer can read',
        goal: 'Find a file pair where minimality and legibility disagree, measure both, and check ' +
          'that three-way merge does not conflict on the four cases people expect it to.',
        setup: 'A file of three functions with one moved to the front, diffed by Myers and by ' +
          'patience; then five three-way merge fixtures against a common base.',
        steps: [
          {
            do: 'Diff the reordered file with Myers and count operations and hunks.',
            why: 'Myers optimises the operation count.',
            work: '6 operations in 3 hunks',
            result: 'the shortest possible script'
          },
          {
            do: 'Diff it again with patience.',
            why: 'Patience optimises something else and should lose on the first measure.',
            work: '8 operations in 2 hunks, anchored on 3 lines unique to both files',
            result: 'two more edits and one fewer hunk'
          },
          {
            do: 'Say which lines Myers interleaved.',
            why: 'The mechanism has to be nameable.',
            work: '5 of the 11 lines are a lone brace or a blank, identical and therefore ' +
              'interchangeable',
            result: 'and they are excluded from the anchor set by construction'
          },
          {
            do: 'Merge five three-way fixtures against a base.',
            why: 'Most cases people expect to conflict should not.',
            work: '1 of 5 conflicts — different lines, the same change twice, an insertion beside an ' +
              'edit and a deletion beside an edit all resolve',
            result: 'only genuinely incompatible changes stop the tool'
          },
          {
            do: 'Look at what the resolved cases needed.',
            why: 'The distinction is a data-structure decision rather than a heuristic.',
            work: '2 separate slots per base position — a prefix of inserted lines and a ' +
              'replacement for the line itself',
            result: 'conflating them conflicts on every commit touching two nearby lines'
          }
        ],
        answer: '6 operations in 3 hunks against 8 in 2, and 1 conflict in 5 merge cases. Patience ' +
          'is strictly worse by the measure the literature optimises and strictly better by the one ' +
          'a reviewer uses — which is why `git diff` ships both, along with `--histogram`, ' +
          '`--ignore-all-space` and an indent heuristic. Each of them makes the script longer and ' +
          'the review shorter.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));

/** Reference entries for the naive matcher, KMP and the Z-algorithm (M15.1-M15.3). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'naive-matching': {
      summary: 'The naive scan as the oracle rather than the straw man: nearly linear on natural ' +
        'language, exactly quadratic on one line of adversarial input, and a first-character filter ' +
        'that removes no comparisons at all.',
      intuition: 'On a 26-letter alphabet 95% of alignments fail on their first character, so the ' +
        'inner loop almost never runs and the worst case almost never arrives.',
      formulation: {
        equations: [
          {
            label: 'The algorithm',
            expr: 'for each of the n − m + 1 alignments, compare left to right until a mismatch',
            terms: [
              { sym: 'worst case', meaning: 'Θ(n·m) — every alignment runs to the full pattern length' },
              { sym: 'typical case', meaning: 'close to n on a natural alphabet' },
              { sym: 'the measure', meaning: 'character comparisons, because milliseconds depend on a machine and iterations are not comparable' }
            ]
          },
          {
            label: 'Seven corpora at 4 000 characters, comparisons per character',
            expr: 'the cost rises monotonically as the alphabet shrinks',
            terms: [
              { sym: 'English (26 symbols)', meaning: '4 211 comparisons — 1.05 per character, 191 of 3 998 alignments entering the inner loop' },
              { sym: 'source code (40)', meaning: '1.06' },
              { sym: 'DNA (4)', meaning: '1.35' },
              { sym: 'binary (2)', meaning: '1.99' },
              { sym: 'one repeated character', meaning: '4.00, and 3 997 occurrences of a 4-character pattern' },
              { sym: 'adversarial (aaa…aab in aaa…a)', meaning: '47 868 — 11.97 per character, which is the pattern length' }
            ]
          },
          {
            label: 'The first-character filter',
            expr: 'the comparison count does not change; the inner-loop entry count does',
            terms: [
              { sym: 'comparisons', meaning: '4 211 with the filter and 4 211 without — identical, always' },
              { sym: 'inner-loop entries', meaning: '3 998 down to 191, a 20.9x reduction' },
              { sym: 'why it is worth having', meaning: 'a memchr scan examines 16 bytes per instruction; a general inner loop examines 1' },
              { sym: 'on the adversarial corpus', meaning: '3 989 of 3 989 alignments still enter — the filter skips nothing' }
            ]
          },
          {
            label: 'The four families',
            expr: 'each avoids something different, and each loses on some corpus in the same demo',
            terms: [
              { sym: 'prefix-based (KMP, Z)', meaning: 'never re-reads the text; usable on a stream' },
              { sym: 'suffix-based (Boyer-Moore)', meaning: 'skips text unread; faster as the pattern grows' },
              { sym: 'hashing (Rabin-Karp)', meaning: 'one integer comparison per window; vulnerable to a chosen text' },
              { sym: 'automaton', meaning: 'one lookup per character, paid for in alphabet x states' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Every occurrence is reported, including overlapping ones',
          why: 'It is the definition, and advancing by m after a hit is the first bug people write.',
          breaks: 'Invisible on natural language and catastrophic on periodic data — DNA, log fields, framing.'
        },
        {
          name: 'Every reported position is verified against the text directly',
          why: 'A matcher and its oracle can share a bug; substr(p, m) === pattern cannot.',
          breaks: 'A comparison count beside a wrong answer is worse than no count.'
        },
        {
          name: 'Every other matcher agrees with the naive occurrence list',
          why: 'Matchers fail by finding most of the occurrences, not by throwing.',
          breaks: 'Nothing else in this milestone means anything if this is not checked first.'
        },
        {
          name: 'A filter may change the work and never the answer',
          why: 'The first-character filter is sound because pattern[0] must match at any occurrence.',
          breaks: 'A filter that changes the answer is a second matcher with no bound on its error.'
        }
      ],
      complexity: [
        { operation: 'naive matching', average: 'Θ(n) on a natural alphabet', worst: 'Θ(n·m) — 47 868 comparisons at n = 4 000, m = 12' },
        { operation: 'naive with a first-character filter', average: 'the same comparison count, a fraction of the inner-loop entries', worst: 'identical on the adversarial corpus — nothing is skipped' },
        { operation: 'one alignment', average: '1/(1 − p) comparisons for a character-agreement probability p', worst: 'm comparisons' },
        { operation: 'verification of a reported position', average: 'Θ(m)', worst: 'cheaper than the search that produced it' },
        { operation: 'occurrence-list comparison', average: 'Θ(occurrences)', worst: 'the check that licenses every other number' },
        { operation: 'memory', average: 'Θ(1) beyond the input', worst: 'the only matcher here with no preprocessing at all' }
      ],
      failureModes: [
        {
          symptom: 'A search endpoint becomes a denial-of-service vector.',
          cause: 'The caller chooses both the pattern and the text, and one line of input reaches Θ(n·m).',
          fix: 'Bound the pattern length, or use a matcher whose bound mentions only the graph — KMP or Z.'
        },
        {
          symptom: 'Overlapping occurrences are missed.',
          cause: 'The scan advances by m after a hit rather than by one.',
          fix: 'Advance by one; test on a periodic fixture, where the bug is visible and on English it is not.'
        },
        {
          symptom: 'A benchmark shows a sophisticated matcher losing and the result is disbelieved.',
          cause: 'On short patterns over a large alphabet a tuned naive scan really is the fastest thing available.',
          fix: 'Believe the measurement; check the corpus and the pattern length before changing the algorithm.'
        },
        {
          symptom: 'A first-character filter is added and the benchmark does not move.',
          cause: 'It was measured in comparisons, which the filter does not change.',
          fix: 'Measure wall-clock, or count inner-loop entries; the filter moves the second and not the first.'
        }
      ],
      inTheWild: [
        { system: 'glibc strstr and memmem', how: 'a vectorised first-character scan, then two-way for long patterns' },
        { system: 'V8 String.prototype.indexOf', how: 'naive with a memchr-style filter, escalating to Boyer-Moore-Horspool past a length threshold' },
        { system: 'Rust str::find', how: 'the two-way algorithm, with a SIMD prefilter on the first byte' },
        { system: 'grep without a regex', how: 'Boyer-Moore-family skipping, falling back for pathological patterns' }
      ],
      sources: [
        { title: 'Algorithms on Strings, Trees and Sequences', where: 'Dan Gusfield — Cambridge University Press, 1997' },
        { title: 'Two-way string-matching', where: 'Crochemore, Perrin — JACM, 1991 — what glibc actually ships' },
        { title: 'Introduction to Algorithms, chapter 32', where: 'Cormen, Leiserson, Rivest, Stein' },
        { title: 'Handbook of Exact String Matching Algorithms', where: 'Christian Charras, Thierry Lecroq, 2004' }
      ]
    },

    'kmp-prefix-function': {
      summary: 'The border array as the object worth learning: period detection, string powers and ' +
        'prefix counts fall out of it, the matcher never moves backwards in the text, and the ' +
        'automaton form removes the inner loop at a cost measured in alphabet size.',
      intuition: 'After matching k characters and failing, the longest overlap the text is KNOWN to ' +
        'support is the border of those k characters. Everything else follows.',
      formulation: {
        equations: [
          {
            label: 'The prefix function',
            expr: 'border[i] = the length of the longest proper prefix of s[0..i] that is also a suffix of it',
            terms: [
              { sym: 'construction', meaning: 'one left-to-right pass; the inner loop walks the border chain' },
              { sym: 'why it is linear', meaning: 'the border length rises by at most 1 per position, so it can fall at most n times in total' },
              { sym: 'measured', meaning: '"ababcabab" gives 0, 0, 1, 2, 0, 1, 2, 3, 4 in 9 preprocessing steps' }
            ]
          },
          {
            label: 'What the array answers besides matching',
            expr: 'period = n − border[n−1]; the string is an exact power iff the period divides n',
            terms: [
              { sym: 'measured', meaning: '"ababcabab": border 4, period 5, and 5 does not divide 9' },
              { sym: 'exact powers', meaning: '"abcabcabcabc" has border 9 and period 3 — four copies of "abc"' },
              { sym: 'fragility', meaning: 'change one character and the period jumps from 3 to 9' },
              { sym: 'prefix occurrences', meaning: 'in "aabaaab" the first character occurs 5 times and the whole string once' }
            ]
          },
          {
            label: 'The scan',
            expr: 'the text index never decreases',
            terms: [
              { sym: 'text positions re-read', meaning: '0, on every corpus — which is what makes it a stream matcher' },
              { sym: 'on English', meaning: '1.08 comparisons per character against the naive scan\'s 1.07' },
              { sym: 'on the adversarial corpus', meaning: '7 989 against 47 868 — a 6.0x saving' },
              { sym: 'on the repeated corpus', meaning: '4 000, exactly one per character, against 15 988 for every skipping matcher' }
            ]
          },
          {
            label: 'The automaton form',
            expr: 'next[state][symbol] with every fallback resolved; |alphabet| x (m + 1) cells',
            terms: [
              { sym: 'DNA', meaning: '10 states, 40 cells, exactly 4 000 comparisons — one lookup per character' },
              { sym: 'English', meaning: '10 states, 260 cells — 6.5x the memory for the same machine' },
              { sym: 'Unicode', meaning: 'unaffordable, which is why every table-building matcher works over bytes' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The text index is monotonically non-decreasing',
          why: 'It is the property that makes KMP usable on a socket or a pipe.',
          breaks: 'A matcher that re-reads the text needs the text in memory or a seekable source.'
        },
        {
          name: 'The border array matches a definition-by-definition computation',
          why: 'An off-by-one in the construction produces a plausible array and a subtly wrong matcher.',
          breaks: 'Test on a Fibonacci word; correct on "aaaa" and "abcabc" and wrong there is the normal case.'
        },
        {
          name: 'n − border[n−1] is a period, and the smallest one',
          why: 'It is what makes power detection a subtraction rather than a search.',
          breaks: 'A period that does not divide n does not mean the string is aperiodic — only that it is not an exact power.'
        },
        {
          name: 'The automaton and the array find the same occurrences',
          why: 'The table is a precomputation of the fallback, not a different algorithm.',
          breaks: 'A disagreement means a row was built from the wrong border.'
        }
      ],
      complexity: [
        { operation: 'prefix function', average: 'Θ(m)', worst: '9 steps for a 9-character pattern; 38 for a 34-character Fibonacci word' },
        { operation: 'KMP scan', average: 'Θ(n)', worst: 'at most 2n comparisons; 1.08 per character on English' },
        { operation: 'period detection', average: 'Θ(1) on the finished array', worst: 'one subtraction and one modulo' },
        { operation: 'prefix occurrence counts', average: 'Θ(m) for all m prefixes', worst: 'one backwards pass' },
        { operation: 'automaton construction', average: 'Θ(|alphabet| · m)', worst: '260 cells at 26 symbols; 40 at 4' },
        { operation: 'automaton scan', average: 'Θ(n) with no inner loop', worst: 'exactly one lookup per character' }
      ],
      failureModes: [
        {
          symptom: 'KMP is benchmarked against the naive scan and loses.',
          cause: 'On natural language the naive scan is already nearly linear, and KMP has a worse constant.',
          fix: 'Nothing — the measurement is right. KMP buys the absence of a cliff, not speed.'
        },
        {
          symptom: 'The border array is right on simple fixtures and wrong on real patterns.',
          cause: 'The fallback loop or its initial condition is off by one.',
          fix: 'Check against the O(m²) definition on Fibonacci words, which have borders of every awkward length.'
        },
        {
          symptom: 'A period-detection routine reports a period that is not one.',
          cause: 'The result of n − border was used without checking that it divides n.',
          fix: 'The subtraction always gives A period; only divisibility makes the string an exact power.'
        },
        {
          symptom: 'An automaton-based matcher uses gigabytes.',
          cause: 'The alphabet is Unicode and the table is alphabet × states.',
          fix: 'Work over bytes, or keep the sparse array form and follow the fallback chain.'
        }
      ],
      inTheWild: [
        { system: 'Streaming protocol framing', how: 'KMP over a socket, because the delimiter search cannot rewind' },
        { system: 'Competitive programming', how: 'the prefix function for periods, borders and string powers far more often than for matching' },
        { system: 'Aho-Corasick', how: 'failure links are exactly this border, generalised to a set of patterns' },
        { system: 'Bioinformatics pipelines', how: 'the automaton form, because a four-letter alphabet makes the table free' }
      ],
      sources: [
        { title: 'Fast pattern matching in strings', where: 'Knuth, Morris, Pratt — SIAM J. Computing, 1977' },
        { title: 'Algorithms on Strings', where: 'Crochemore, Hancart, Lecroq — Cambridge University Press, 2007' },
        { title: 'Algorithms on Strings, Trees and Sequences, chapter 2', where: 'Dan Gusfield, 1997' },
        { title: 'Competitive Programmer’s Handbook, chapter 26', where: 'Antti Laaksonen' }
      ]
    },

    'z-algorithm': {
      summary: 'One window that never moves left, three named cases, matching by concatenation, and ' +
        'a periodicity bound shown tight by construction rather than by citation.',
      intuition: 'A position inside the rightmost known-prefix interval has a mirror whose answer is ' +
        'already computed, so the only work is extending past the edge — and the edge only ever ' +
        'moves right.',
      formulation: {
        equations: [
          {
            label: 'The Z-array',
            expr: 'z[i] = the longest common prefix of s and s[i..]',
            terms: [
              { sym: 'the window', meaning: '[l, r] with s[l..r) = s[0..r−l), kept as the interval reaching furthest right' },
              { sym: 'past the window', meaning: 'start from nothing; every match extends r' },
              { sym: 'inside, short mirror', meaning: 'z[i] = z[i−l] exactly, with ZERO comparisons' },
              { sym: 'inside, mirror at the edge', meaning: 'z[i] >= r − i, then extend' },
              { sym: 'measured', meaning: '"aabxaabxcaabxaabxay": 11 of 18 positions from the window, 14 characters compared' }
            ]
          },
          {
            label: 'Why it is linear',
            expr: 'r never decreases and is bounded by n',
            terms: [
              { sym: 'each comparison', meaning: 'either fails once per position, or succeeds and moves r right' },
              { sym: 'total extensions', meaning: 'at most n, however the string is shaped' },
              { sym: 'the same argument', meaning: 'Manacher\'s mirror, the two-pointer window, Myers\'s furthest-reaching path' }
            ]
          },
          {
            label: 'Matching by concatenation',
            expr: 'z-array of pattern + sentinel + text; occurrences are the positions with z = m',
            terms: [
              { sym: 'the sentinel', meaning: 'must appear in NEITHER string; a hard-coded $ is wrong on any input containing one' },
              { sym: 'cost', meaning: '4 320 comparisons on English against KMP\'s 4 304' },
              { sym: 'memory', meaning: 'an array of 4 000 entries rather than 9 — and the whole text is needed before the scan' }
            ]
          },
          {
            label: 'Fine and Wilf, and its tightness',
            expr: 'periods p and q with p + q − gcd(p,q) <= n force gcd(p,q) to be a period',
            terms: [
              { sym: 'the construction', meaning: 'union-find over positions identified by both periods; the class count is the free-symbol count' },
              { sym: 'at the bound', meaning: 'exactly gcd classes — the gcd is forced' },
              { sym: 'one character shorter', meaning: 'gcd + 1 classes — a string exists with both periods and not the gcd' },
              { sym: 'measured', meaning: 'p=5, q=8: bound 12, 1 class at 12 and 2 at 11. p=6, q=9: bound 12, 3 classes and 4' },
              { sym: 'the extremal family', meaning: 'Fibonacci words: length 8 with periods 5 and 7 gives a bound of 11; length 34 with 21 and 29 gives 49' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The right edge of the window never decreases',
          why: 'It is the whole complexity proof, and it is checkable in one pass over the trace.',
          breaks: 'An implementation that recomputes the window from scratch is quadratic and correct, which hides the bug.'
        },
        {
          name: 'The array matches a definition-by-definition computation',
          why: 'The three cases are easy to write and easy to get subtly wrong.',
          breaks: 'A wrong mirror bound produces values that are too small and a matcher that misses occurrences.'
        },
        {
          name: 'The sentinel occurs in neither the pattern nor the text',
          why: 'Otherwise a run inside the text can be credited to the pattern.',
          breaks: 'Invisible in tests, because fixtures come from the same vocabulary the developer had in mind.'
        },
        {
          name: 'Fine and Wilf applies only when the bound is at most n',
          why: 'The lemma is a conditional, and the Fibonacci words are engineered to fail its condition.',
          breaks: 'Applying it unconditionally concludes that every string with two short periods is periodic.'
        }
      ],
      complexity: [
        { operation: 'Z-array construction', average: 'Θ(n)', worst: '14 extensions on a 19-character string; the bound is the length' },
        { operation: 'brute-force Z-array', average: 'Θ(n²)', worst: 'the oracle, and the only check that owes the window nothing' },
        { operation: 'matching by concatenation', average: 'Θ(n + m)', worst: '4 320 comparisons on 4 000 characters of English' },
        { operation: 'memory', average: 'Θ(n + m) — an array as long as the concatenation', worst: 'against KMP\'s Θ(m); the reason Z is not a stream matcher' },
        { operation: 'sentinel search', average: 'Θ(n + m) — one pass to collect the used characters', worst: 'removes an input-dependent class of wrongness for one pass' },
        { operation: 'Fine-Wilf tightness check', average: 'Θ(n·α(n)) union-find per pair', worst: 'a construction rather than a citation' }
      ],
      failureModes: [
        {
          symptom: 'A concatenation matcher reports occurrences that are not there.',
          cause: 'The sentinel appears in the text, so a run inside it was credited to the pattern.',
          fix: 'Search for a character in neither string rather than hard-coding one.'
        },
        {
          symptom: 'The Z construction is quadratic on some inputs.',
          cause: 'The window is not being updated, so every position extends from scratch.',
          fix: 'Assert that the right edge never decreases; the bug is invisible in the answer.'
        },
        {
          symptom: 'A periodicity argument concludes something false.',
          cause: 'Fine and Wilf was applied without checking p + q − gcd <= n.',
          fix: 'Check the condition; on Fibonacci words it fails by a growing margin every time.'
        },
        {
          symptom: 'A Z-based matcher runs out of memory on a large file.',
          cause: 'It builds an array as long as the text, not as long as the pattern.',
          fix: 'Use KMP, whose state is Θ(m) and which does not need the text in memory at all.'
        }
      ],
      inTheWild: [
        { system: 'Competitive programming', how: 'the default choice under time pressure — three cases, no chain walking' },
        { system: 'Suffix-array construction', how: 'Z-boxes appear inside several linear-time constructions as a subroutine' },
        { system: 'Plagiarism and clone detection', how: 'longest-common-prefix queries between a document and its own suffixes' },
        { system: 'Periodicity analysis in bioinformatics', how: 'tandem repeat detection, where Fine and Wilf bounds the search' }
      ],
      sources: [
        { title: 'Algorithms on Strings, Trees and Sequences, chapter 1', where: 'Dan Gusfield, 1997 — where the Z-algorithm is presented first' },
        { title: 'Uniqueness theorems for periodic functions', where: 'Fine, Wilf — Proceedings of the AMS, 1965' },
        { title: 'Algorithms on Strings', where: 'Crochemore, Hancart, Lecroq, 2007' },
        { title: 'Combinatorics on Words', where: 'M. Lothaire — Cambridge University Press, 1997' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));

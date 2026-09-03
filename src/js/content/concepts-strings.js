/** Concepts for the naive matcher, KMP and the Z-algorithm (M15.1-M15.3). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'naive-matching': [
      {
        term: 'Character comparisons are the only honest currency',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["milliseconds"] --> B["measures your machine<br/>as much as the algorithm"]',
            '    C["loop iterations"] --> D["differs by implementation style"]',
            '    E["character comparisons"] --> F["a property of the algorithm<br/>and the input, and nothing else"]',
            '    F --> G["so two matchers can be compared<br/>on any machine, by anyone"]'
          ].join('\n'),
          caption: 'Pick the unit a cost is actually paid in. For pattern matching that is comparisons, which is why every claim in this milestone is quoted in them.'
        },
        plain: 'Not milliseconds, not iterations — the count of times two characters were compared.',
        formal: 'the measure every matcher in this milestone is trying to minimise, and the only one comparable across them',
        detail: [
          'Milliseconds depend on a JIT, a cache and a machine, and they change between two runs of ' +
            'the same code.',
          'Iterations are not comparable between a left-to-right matcher and a right-to-left one, ' +
            'because their iterations do different amounts of work.',
          'Comparisons are what each algorithm exists to avoid, they are deterministic, and they let ' +
            'a claim like "Boyer-Moore is sublinear" be checked rather than repeated. Sublinear ' +
            'means fewer than one comparison per text character, which is a number.'
        ],
        example: 'On 4 000 characters of English the naive scan does 4 211 comparisons — 1.05 per ' +
          'character — and Boyer-Moore does 1 553.'
      },
      {
        term: 'The naive matcher is the oracle, not the straw man',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["the naive scan"] --> B["obviously correct,<br/>and obviously slow"]',
            '    B --> C["so use it to produce the<br/>true occurrence list"]',
            '    C --> D["every clever matcher is checked<br/>against that list first"]',
            '    D --> E["and only then is its<br/>comparison count quoted"]'
          ].join('\n'),
          caption: 'A fast matcher that misses an occurrence looks exactly like a fast matcher. The slow one you can read is what makes the fast one\'s numbers mean anything.'
        },
        plain: 'Every other matcher is checked against its occurrence list before its work is quoted.',
        formal: 'agreement on the full position list, plus a direct substring verification of each position',
        detail: [
          'Matchers fail by finding *most* of the occurrences, and a comparison count beside a wrong ' +
            'answer is worse than no count at all.',
          'So the naive scan runs on every corpus and its positions are the reference. Each reported ' +
            'position is additionally checked against the text directly, which catches the case ' +
            'where the matcher and the oracle share a bug.',
          'Only then does the work column mean anything.'
        ],
        example: 'Across seven corpora and eight matchers there are zero disagreements, which is ' +
          'what licenses everything else the milestone says.'
      },
      {
        term: 'On natural language the naive scan is nearly linear',
        plain: 'Most alignments fail on their first character, so the inner loop almost never runs.',
        formal: 'expected comparisons per alignment is 1/(1 − p) where p is the probability two random characters agree',
        readAs: 'If two random characters match a fraction p of the time, the average alignment runs 1/(1−p) ' +
          'comparisons before failing. On English p is small, so that is barely above 1 — which is why ' +
          'the naive scan is nearly linear on real text.',
        detail: [
          'The worst case is `n·m` and the typical case is close to `n`, and the distance between ' +
            'those two facts is the whole of this milestone.',
          'On English 95.2% of alignments fail immediately, so the average alignment costs just over ' +
            'one comparison.',
          'That is why `indexOf` is not KMP. KMP would be slower on the inputs `indexOf` actually ' +
            'sees, and the sophisticated matchers exist for the cases where this argument fails.'
        ],
        example: '1.05 comparisons per character on English against 11.97 on the adversarial corpus.'
      },
      {
        term: 'The adversarial input is one line long',
        plain: 'Search for aaa…aab in aaa…a and every alignment runs to the full pattern length.',
        formal: 'the input realising the O(nm) bound: the pattern agrees with the text everywhere but its last character',
        detail: [
          'Nothing about the algorithm changes between the English row and this one.',
          'The inner loop runs to completion at every alignment and finds nothing, so the cost is ' +
            'exactly `n·m` rather than approximately `n`.',
          'That input is a single expression. Any service that lets a caller choose both the pattern ' +
            'and the text on a naive matcher has a denial-of-service hole in it. It is the same ' +
            'shape as the ReDoS in 15.10 and the hash attack in 15.5.'
        ],
        example: 'A 12-character pattern over 4 000 characters: 47 868 comparisons against 4 211 ' +
          'for the same length of English.'
      },
      {
        term: 'A first-character filter saves no comparisons at all',
        plain: 'The filter performs exactly the comparison the inner loop would have made first.',
        formal: 'the comparison count is identical with and without the filter; what changes is the inner-loop entry count',
        detail: [
          'This is the measurement that surprises people.',
          'Filtering on `text[i] != pattern[0]` looks like it removes work, and in a comparison ' +
            'count it removes precisely nothing. What it removes is *entries into the general inner ' +
            'loop*.',
          'That matters because the filter can be a `memchr` — a vectorised byte scan that examines ' +
            'sixteen characters per instruction — while a general loop examines one. The saving is ' +
            'real and it is not in this table\'s units, and saying so is more useful than pretending ' +
            'the count fell.'
        ],
        example: '4 211 comparisons either way, and 3 998 inner-loop entries fall to 191 — a 20.9× ' +
          'reduction in the loop that cannot be vectorised.'
      },
      {
        term: 'A matcher must report overlapping occurrences',
        plain: 'Searching for aa in aaaa finds three, not two.',
        formal: 'the occurrence set is every start position p with text[p..p+m) = pattern, without exclusion',
        readAs: 'Every position where the pattern starts counts, even where two occurrences overlap. The ' +
          'square-then-round bracket means the window includes p and stops just before p+m.',
        detail: [
          'This is the first thing a hand-rolled matcher gets wrong, usually by advancing the start ' +
            'position by `m` after a hit rather than by one.',
          'The bug is invisible on natural language, where a pattern rarely overlaps itself. It is ' +
            'catastrophic on the periodic data where matching is actually used: DNA motifs, ' +
            'repeated log fields, binary framing.',
          'The repeated corpus in the demo exists to make it visible.'
        ],
        example: 'The pattern "aaaa" in 4 000 a\'s occurs 3 997 times, once at every position that ' +
          'admits it.'
      },
      {
        term: 'The four families each avoid something different',
        plain: 'Re-reading the text, reading it at all, comparing characters, or making the decision.',
        formal: 'prefix-based, suffix-based, hashing, automaton — four bets about the shape of the input',
        detail: [
          'Prefix-based matchers (KMP, Z) never re-read a text character, which is what makes them ' +
            'usable on a stream. Suffix-based ones (Boyer-Moore) skip text unread, which makes them ' +
            'faster as the pattern grows.',
          'Hashing compares one integer per window and only touches characters on a hit. An ' +
            'automaton precomputes the decision into a table.',
          'Each is a bet about the input, and the corpus table shows every one of them losing on ' +
            'some corpus in the same demo.'
        ],
        example: 'Sunday wins on English at 1 265 units, Boyer-Moore on DNA at 1 927, and KMP on ' +
          'the repeated corpus at 4 000 where Boyer-Moore pays 15 988.'
      },
      {
        term: 'A pattern and a text are one input, not two',
        plain: 'The same pattern behaves completely differently depending on how often it occurs.',
        formal: 'matcher cost depends on the alphabet, the pattern length, the occurrence density and the pattern\'s own periodicity',
        detail: [
          'Benchmarks that vary the text and fix the pattern, or vice versa, measure one slice of a ' +
            'surface with at least four dimensions.',
          'A pattern that never occurs exercises the skip machinery; one that occurs at every ' +
            'position exercises the match handling and nothing else.',
          'A periodic pattern defeats the good-suffix rule, and a pattern over a tiny alphabet ' +
            'defeats the bad-character rule. Every corpus in this milestone is a *pair* for that ' +
            'reason.'
        ],
        example: 'On the repeated corpus the pattern occurs 3 997 times and every skipping matcher ' +
          'collapses to the naive cost of 15 988.'
      }
    ],

    'kmp-prefix-function': [
      {
        term: 'A border is a prefix that is also a suffix',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["ababcabab"] --> B["its longest border is abab"]',
            '    B --> C["the pattern already matched abab<br/>at the end of the failed attempt"]',
            '    C --> D["so slide until that abab lines up<br/>with the prefix abab"]',
            '    D --> E["no text character is re-read"]'
          ].join('\n'),
          caption: 'The border is what the failed match already told you. KMP is the observation that this information was there all along and was being thrown away.'
        },
        plain: 'The longest border of "ababcabab" is "abab", of length 4.',
        formal: 'border(s) = the longest proper prefix of s that is also a suffix of s',
        readAs: 'The longest stretch that appears both at the start and at the end of the string, without ' +
          'being the whole string — "proper" is what rules that out. On "ababa" it is "aba".',
        detail: [
          'The border array records the longest border of every prefix of the pattern, and it is ' +
            'the single most reusable object in string algorithms.',
          'Everything KMP does is a consequence of one observation. After matching k characters and ' +
            'failing, the longest overlap the text is *known* to support is the border of those k ' +
            'characters.',
          'So the pattern may slide by `k − border(k)` without re-examining anything.'
        ],
        example: 'The array for "ababcabab" is 0, 0, 1, 2, 0, 1, 2, 3, 4 — and its last entry is ' +
          'the border of the whole pattern.'
      },
      {
        term: 'The construction looks quadratic and is linear',
        plain: 'The inner loop walks a chain of borders, and the chain can only be walked n times in total.',
        formal: 'the border length rises by at most 1 per position, so across n positions it can fall at most n times',
        readAs: 'The classic amortised argument. A quantity that can only creep up one step at a ' +
          'time cannot fall more than n times in total, however far each individual fall goes. That ' +
          'is why the construction is linear despite its inner loop.',
        detail: [
          'This is the same amortisation argument as a dynamic array\'s doubling, and it is the only ' +
            'subtle thing in the algorithm.',
          'A single position can walk a long chain, so no per-position bound holds. The total is ' +
            'bounded because every step down the chain is paid for by an earlier step up, and there ' +
            'are at most n steps up.',
          'Recognising this shape is worth more than the algorithm. It is why "the inner loop looks ' +
            'bad" is not an argument.'
        ],
        example: 'The array for a 9-character pattern costs 9 preprocessing steps; for a 34-character ' +
          'Fibonacci word it costs 38.'
      },
      {
        term: 'KMP never moves backwards in the text',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["mismatch at text position i"] --> B["the naive matcher restarts at<br/>the next alignment and re-reads"]',
            '    A --> C["KMP slides the pattern and<br/>leaves i exactly where it is"]',
            '    C --> D["so every text character is<br/>examined at most twice, ever"]',
            '    D --> E["which is the linear bound,<br/>and why it can stream"]'
          ].join('\n'),
          caption: 'Never re-reading the text is what makes KMP usable on a stream you cannot rewind — a property the comparison count alone does not show.'
        },
        plain: 'On a mismatch the pattern slides and the text index stays where it is.',
        formal: 'the text index is monotonically non-decreasing, so the matcher works on a stream that cannot be rewound',
        detail: [
          'That property, not the comparison count, is what KMP is for.',
          'A matcher that backtracks in the text needs the text in memory or a seekable file. One ' +
            'that does not can be pointed at a socket, a pipe or a decompression stream, and will ' +
            'report matches as they arrive.',
          'Every other matcher in this milestone except the automaton form needs to look backwards ' +
            'or forwards, and Boyer-Moore needs to look forwards by up to m.'
        ],
        example: 'The demo reports a "text positions re-read" column, and it is 0 on every corpus.'
      },
      {
        term: 'The smallest period is one subtraction',
        plain: 'n minus the longest border is the smallest period, and it divides n exactly when the string is a power.',
        formal: 'period(s) = |s| − border(s); s is an exact repetition iff period(s) divides |s|',
        readAs: 'The period is the length minus the border. When the period divides the length ' +
          'exactly, the string is some block repeated a whole number of times. That is how you ' +
          'detect a repetition without ever comparing blocks.',
        detail: [
          'This is the most reusable consequence of the array, and it has nothing to do with ' +
            'searching.',
          'Three questions are answered by one subtraction and one modulo, on an array you computed ' +
            'for a matcher. Is this string a repetition of something shorter? What is the shortest ' +
            'string that generates it? How many times does it repeat?',
          'It arrives in compression, in cycle detection, in rotation problems, and in half the ' +
            'string questions that never mention matching.'
        ],
        example: '"abcabcabcabc" has border 9 and period 3, and 3 divides 12, so it is 4 copies of ' +
          '"abc". Change one character and the period jumps to 12.'
      },
      {
        term: 'Periodicity is not a robust property',
        plain: 'Change one character of an exact power and the period jumps to the full length.',
        formal: 'the period is a discrete function with no continuity: a single edit can move it from 3 to n',
        detail: [
          'That fragility is why "nearly periodic" needs the approximate machinery of 15.8 rather ' +
            'than this array.',
          'A border array tells you exactly whether a string repeats, and tells you nothing at all ' +
            'about whether it almost repeats. Almost-repeating is the case real data presents.',
          'Knowing which of the two questions you are asking decides whether the answer costs a ' +
            'subtraction or a dynamic-programming grid.'
        ],
        example: '"abcabcabc" has period 3; "abcabcabd" has period 9.'
      },
      {
        term: 'The border chain counts every prefix occurrence at once',
        plain: 'Walking the chain backwards gives the number of times each prefix appears in the pattern.',
        formal: 'count[border[i]] accumulates from the end, so one backwards pass answers all n prefixes',
        detail: [
          'A second thing the array answers for free, and a good illustration of why the array ' +
            'rather than the matcher is the object worth learning.',
          'The question "how many times does each prefix of this string occur inside it" sounds like ' +
            'it needs n searches, and needs one backwards loop instead.',
          'The same trick underlies counting occurrences of a pattern in a text with the ' +
            'concatenation from 15.3.'
        ],
        example: 'In "aabaaab" the first character occurs 5 times and the whole string once.'
      },
      {
        term: 'The automaton form trades memory for the inner loop',
        plain: 'Resolve every fallback into a table and matching is one lookup per character.',
        formal: 'next[state][symbol] with all failures precomputed; |alphabet| × (m + 1) cells',
        readAs: 'Flatten every failure jump into a lookup table so each character costs one array ' +
          'read. The table has one row per pattern position and one column per possible character, ' +
          'so it grows with the alphabet. It is cheap for DNA and expensive for Unicode.',
        detail: [
          'The border array keeps a fallback loop that runs zero or more times per character. The ' +
            'table has no loop at all.',
          'The cost is a cell per state per alphabet symbol, so the decision is entirely about the ' +
            'alphabet. On DNA the table is trivially affordable; on Unicode it is not.',
          'That is why every production matcher that builds a table works over bytes, and it is the ' +
            'same trade Aho-Corasick makes in 15.6 at a larger scale.'
        ],
        example: 'A 9-character pattern gives 10 states: 40 cells on DNA and 260 on English, for ' +
          'the identical automaton.'
      },
      {
        term: 'KMP is often slower than the naive scan on real text',
        plain: 'On English it costs slightly more per character, plus the preprocessing.',
        formal: 'the guarantee is a worst-case bound, and the worst case is not the common case',
        detail: [
          'The measurement is the point. KMP\'s value is that its cost does not depend on the ' +
            'input, not that its cost is low.',
          'On natural language the naive scan is already nearly linear, so a matcher with the same ' +
            'asymptotic cost and a slightly worse constant loses.',
          'What KMP buys is the absence of a cliff. The adversarial corpus that takes the naive scan ' +
            'to 11.97 comparisons per character takes KMP to about 2, and that is insurance rather ' +
            'than speed.'
        ],
        example: 'On English, KMP costs 1.08 comparisons per character against the naive scan\'s ' +
          '1.07, plus 9 preprocessing steps.'
      }
    ],

    'z-algorithm': [
      {
        term: 'The Z-array is the longest common prefix with every suffix',
        plain: 'z[i] is how far s and s[i..] agree from their starts.',
        formal: 'z[i] = max { k : s[0..k) = s[i..i+k) }',
        readAs: 'The Z-value at position i is how many characters starting there still match the start of the ' +
          'string. The braces and the colon read "the largest k such that", and the brackets mark a ' +
          'window that stops just short of its end.',
        detail: [
          'It carries the same information as the border array, and each is recoverable from the ' +
            'other in linear time. It is also expressed in a way most people find easier to hold.',
          'Where a border is "a prefix that is also a suffix", a Z value is "how much of the string ' +
            'do I see again starting here".',
          'That is a question you can answer by pointing at two places and reading forwards.'
        ],
        example: 'For "aabxaabxcaabxaabxay" the array starts 19, 1, 0, 0, 4, 1, 0, 0, 0, 8.'
      },
      {
        term: 'The window is the algorithm, and it never moves left',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["keep the interval that reaches<br/>furthest right and is known<br/>to match a prefix"] --> B["a new position inside it"]',
            '    B --> C["its answer is already known<br/>from the mirrored position"]',
            '    C --> D["copy it, for free"]',
            '    B --> E["a position past it"]',
            '    E --> F["compare directly, and the<br/>window jumps right"]'
          ].join('\n'),
          caption: 'The window only ever moves right, so all the direct comparisons across the whole run add up to n. That is the entire linearity argument.'
        },
        plain: 'Keep the interval that reaches furthest right and is known to equal a prefix.',
        formal: '[l, r] with s[l..r) = s[0..r−l); r is non-decreasing over the whole run',
        readAs: 'The algorithm remembers one window already known to match the string\'s own beginning. Its ' +
          'right edge only ever moves forward, never back, which is what caps the total work at linear.',
        detail: [
          'Every position inside the window has a mirror whose answer is already computed, so the ' +
            'only work the algorithm ever does is extending past `r`.',
          'Each successful extension moves `r` right, `r` never moves left, and `r` is bounded by ' +
            '`n`. So the total extension work is at most `n` however the string is shaped.',
          'That is the entire complexity proof, and it fits in one sentence.'
        ],
        example: 'On a 19-character string, 11 of the 18 positions were answered from the window ' +
          'and only 14 characters were ever compared.'
      },
      {
        term: 'Three cases, and two of them cost nothing',
        plain: 'Past the window, inside with a short mirror, or inside with a mirror that reaches the edge.',
        formal: 'i >= r: extend from 0. i < r and z[i−l] < r−i: exact copy. i < r otherwise: copy to the edge, then extend',
        detail: [
          'The middle case is the one that makes the algorithm fast. The mirror\'s answer is ' +
            'provably exact, and the position costs zero character comparisons.',
          'The third case needs an extension, because the mirror ran into the edge of the window and ' +
            'the algorithm has no information past it.',
          'Being able to name the three cases out loud is what makes the Z construction easier to ' +
            'write correctly than the border array under pressure.'
        ],
        example: 'The demo counts each case per position; the "characters compared" column is zero ' +
          'at most positions.'
      },
      {
        term: 'Matching is a concatenation and a sentinel',
        plain: 'Take the Z-array of pattern + sentinel + text and read off every position with z >= m.',
        formal: 'occurrences are exactly the positions i > m with z[i] = m, offset back by m + 1',
        readAs: 'Glue the pattern, a separator and the text together, then any Z-value equal to the pattern ' +
          'length marks a match. Subtract the pattern length and the separator to get the real ' +
          'position.',
        detail: [
          'The reduction is three lines, and it is the reason the Z-algorithm is often the fastest ' +
            'thing to write in a competitive setting.',
          'It also costs. The array is as long as the text, so the memory is O(n) rather than O(m).',
          'And the whole text has to be available before the scan starts, which means it is not a ' +
            'stream matcher the way KMP is.'
        ],
        example: 'The Z route costs 4 320 comparisons on English against KMP\'s 4 304, for the same ' +
          'occurrences.'
      },
      {
        term: 'The sentinel must appear in neither string',
        plain: 'Hard-coding a dollar sign makes a matcher that is wrong on any input containing one.',
        formal: 'the separator must not occur in the pattern or the text, or a run inside the text can be credited to the pattern',
        detail: [
          'This is a genuine bug in real code, and it is invisible in testing because test fixtures ' +
            'are chosen from the same small vocabulary the developer had in mind.',
          'Searching for a free character costs one pass over the alphabet, and removes an entire ' +
            'class of input-dependent wrongness.',
          'It is the same shape as the M06 lesson about the BWT sentinel and the M03 lesson about a ' +
            'fixed hash multiplier. A constant chosen for convenience becomes a correctness ' +
            'assumption about data you have not seen.'
        ],
        example: 'The demo searches from character code 1 upwards for a code appearing in neither ' +
          'string, and reports which one it chose.'
      },
      {
        term: 'The mirror argument transfers, the array does not',
        plain: 'Never re-examine what an earlier structure already proved.',
        formal: 'the same amortisation appears in Manacher, in two-pointer windows, and in Myers\'s furthest-reaching path',
        detail: [
          'Very few systems need a Z-array. A great many need the argument: keep the rightmost thing ' +
            'you have proved, reuse it for anything it covers, and pay only for what it does not.',
          'Manacher (15.7) is the same argument about palindromes, the sliding-window family is the ' +
            'same argument about intervals, and Myers\'s diff (15.9) is the same argument about ' +
            'diagonals.',
          'Learning the shape once pays for all four.'
        ],
        example: 'Manacher\'s radius array reuses its mirror at 11 of 31 positions on the same kind ' +
          'of string.'
      },
      {
        term: 'Fine and Wilf: two short periods force a shorter one',
        plain: 'If a string of length n has periods p and q with p + q − gcd(p, q) <= n, then gcd(p, q) is a period too.',
        formal: 'the bound is tight: at exactly p + q − gcd the gcd is forced, and one character shorter it is not',
        readAs: 'Fine and Wilf: a string long enough to have two periods must also have their greatest common ' +
          'divisor as a period. "Long enough" is exactly p + q − gcd — one character less and a ' +
          'counterexample exists.',
        detail: [
          'The consequence worth carrying is that a string cannot have two unrelated "almost-short" ' +
            'periods. Two of them collapse into their greatest common divisor as soon as the string ' +
            'is long enough.',
          'The tightness is a construction rather than a citation. Forcing both periods identifies ' +
            'positions, and union-find over those identifications counts how many symbols are still ' +
            'free.',
          'At the bound the count collapses to gcd; one character below it does not.'
        ],
        example: 'For p = 5 and q = 8 the bound is 12: at length 12 exactly one symbol is free, and ' +
          'at length 11 there are two.'
      },
      {
        term: 'The Fibonacci words are the extremal family',
        plain: 'Their two shortest periods sit just clear of the Fine-Wilf bound, every time.',
        formal: 'F(n) = F(n−1) + F(n−2) as strings; the periods are consecutive Fibonacci numbers and the bound exceeds the length',
        readAs: 'Build strings the way Fibonacci numbers are built — each one is the previous two joined — ' +
          'and their periods come out as Fibonacci numbers too. They are the standard worst case ' +
          'because the theorem\'s length requirement is never quite met.',
        detail: [
          'They are the standard test for any periodicity or border-array implementation, because ' +
            'they are engineered to be awkward: long borders, no exact period, and a bound that ' +
            'never quite applies.',
          'An implementation that is correct on `aaaa` and `abcabc` and wrong on a Fibonacci word is ' +
            'the common case.',
          'Running one is a two-line test that catches a large class of off-by-one errors.'
        ],
        example: 'The order-8 word has length 34 with proper periods 21 and 29; the bound is 49, so ' +
          'the lemma does not apply and gcd = 1 is not a period.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));

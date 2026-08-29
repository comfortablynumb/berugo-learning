/** Concepts for palindromes, approximate matching and diff (M15.7-M15.9). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'palindromes': [
      {
        term: 'Interleaving a separator removes the odd/even problem',
        plain: 'abc becomes #a#b#c#, and every even palindrome of the original becomes an odd one.',
        formal: 'a radius in the transformed string is exactly a LENGTH in the original',
        detail: 'A palindrome with a centre and one with a gap need two implementations, two sets ' +
          'of indices and two off-by-one errors. Interleaving costs a factor of two in memory and ' +
          'removes the duplicate entirely — and it pays a second dividend nobody mentions: because ' +
          'the transformed string has separators between every pair of characters, the radius at a ' +
          'centre equals the length of the original palindrome, so there is no division at the end.',
        example: '"abacabadabacaba" becomes 31 transformed characters, and the radius 15 at the ' +
          'centre is the length of the whole palindrome.'
      },
      {
        term: 'The mirror is the Z-window wearing different clothes',
        plain: 'Keep the palindrome reaching furthest right; a position inside it has a mirror already computed.',
        formal: 'radius[i] starts at min(r − i, radius[2c − i]) rather than at zero',
        readAs: 'Manacher seeds each position from its mirror image inside the palindrome already known — 2c ' +
          '− i is that mirror, c being the centre. Capping it at the distance to the known edge is what ' +
          'keeps the answer correct.',
        detail: 'If `i` lies inside the palindrome centred at `c` and reaching to `r`, then the ' +
          'characters around `i` mirror those around `2c − i`, whose radius is known. When that ' +
          'radius is strictly smaller than the distance to `r` the answer is exact and free; when it ' +
          'reaches the edge the answer is at least that far and the rest must be measured. The `min` ' +
          'is the part people leave out, and leaving it out makes the algorithm quadratic.',
        example: 'On a 15-character string, 11 of the 31 transformed positions reused a mirror and ' +
          'only 26 characters were compared.'
      },
      {
        term: 'The right edge never moves left, and that is the whole proof',
        plain: 'Every extension pushes the edge right, and it can be pushed at most n times.',
        formal: 'total extension work is O(n), independent of the string\'s shape',
        detail: 'Each comparison either fails — once per position, so at most n times — or succeeds ' +
          'and moves the right edge. The edge is monotone and bounded, so the successes total at ' +
          'most n. That is the same argument as the Z-window, as the two-pointer sliding window and ' +
          'as Myers\'s furthest-reaching path, and recognising it is worth more than the palindrome ' +
          'algorithm it is being used for here.',
        example: 'On the repeated family, Manacher does exactly 4n comparisons while expanding ' +
          'around every centre does about n²/2.'
      },
      {
        term: 'How many and how many different are separate questions',
        plain: 'A string of n identical characters has n(n+1)/2 palindromic substrings and n distinct ones.',
        formal: 'the count is the sum of the radii; the distinct count is the eertree\'s node count',
        detail: 'Manacher gives every maximal palindrome and therefore the count with multiplicity; ' +
          'no amount of arithmetic on the radius array recovers the distinct count. The gap between ' +
          'them is a factor of n in the worst case, and the two questions arrive in different ' +
          'problems — the count in "how many substrings have this property", the distinct count in ' +
          '"what is the vocabulary".',
        example: 'At n = 800 the repeated string has 320 400 palindromic substrings and 800 distinct ' +
          'ones.'
      },
      {
        term: 'The eertree has one node per distinct palindromic substring, and there are at most n',
        plain: 'Adding a character creates at most one new distinct palindrome.',
        formal: 'the node count is at most n + 2, which is why the structure is linear',
        detail: 'That bound is not obvious and it is the reason the structure exists. Each ' +
          'character extension can create at most one palindrome that was not present before — the ' +
          'longest palindromic suffix of the new prefix — so the tree grows by at most one node per ' +
          'input character. Everything else about the construction is bookkeeping around that ' +
          'single fact.',
        example: '"abacabadabacaba" has 15 distinct palindromic substrings for 15 characters.'
      },
      {
        term: 'The imaginary root of length −1 is not a hack',
        plain: 'Extending a palindrome adds a character on both sides, and starting from −1 produces a single character.',
        formal: 'two roots: length 0 for even palindromes and length −1 for odd ones',
        detail: 'Without it, the first character of every odd palindrome is a special case that has ' +
          'to be written separately, and the suffix-link walk needs a guard at every step. With it, ' +
          '"extend by one character on each side" is uniform: applied to the length-−1 node it ' +
          'produces a length-1 palindrome, which is exactly what a single character is. It is the ' +
          'same trick as a sentinel node in a linked list, and it removes the same class of code.',
        example: 'Node 0 has length −1 and node 1 has length 0; every real palindrome hangs off one ' +
          'of them.'
      },
      {
        term: 'The suffix link points to the longest proper palindromic suffix',
        plain: 'The same idea as a border, restricted to palindromes.',
        formal: 'link(u) = the longest palindrome that is a proper suffix of u\'s palindrome',
        detail: 'Walking that chain from the current node is how the construction finds where to ' +
          'attach a new character, and it is also how occurrence counts are accumulated: a ' +
          'palindrome occurs wherever any palindrome that has it as a suffix occurs, so one ' +
          'backwards pass over the nodes totals every count. The parallel with KMP\'s border chain ' +
          'is exact, which is a useful thing to notice rather than a coincidence.',
        example: 'The node for "abacaba" links to "aba", which links to "a", which links to the ' +
          'empty root.'
      },
      {
        term: 'Expanding around every centre is the oracle, and it is affordable',
        plain: 'O(n²) is cheap enough to check a linear algorithm against on the sizes that matter.',
        formal: 'the only check that owes the mirror argument nothing',
        detail: 'A wrong `min` in Manacher produces radii that are too large, which produces ' +
          '"palindromes" that are not, and the failure is silent because the output is still an ' +
          'array of plausible numbers. Expanding around every centre is ten lines, is obviously ' +
          'correct, and is fast enough at a few hundred characters to run in a test on every ' +
          'commit. Every linear string algorithm in this milestone has an oracle of this kind for ' +
          'the same reason.',
        example: 'The demo checks both the count and the distinct count against exhaustive ' +
          'enumeration on every run.'
      }
    ],

    'approximate-matching': [
      {
        term: 'Bitap keeps the whole match state in the bits of a register',
        plain: 'Bit j is set when the first j+1 pattern characters match ending here.',
        formal: 'Shift-Or: state = (state << 1) | mask[c], where a ZERO bit means a match',
        readAs: 'Keep the whole search state in one machine word, one bit per pattern position. Shifting left ' +
          'advances every partial match at once, and OR-ing the character mask kills the ones that no ' +
          'longer fit. Zero means match because that makes the shift bring in the right default.',
        detail: 'The negative logic is not perversity: shifting a 0 into the low bit starts a fresh ' +
          'match attempt at every position for free, which is exactly what the algorithm needs. One ' +
          'shift and one OR advance every pattern position simultaneously, so a 32-character ' +
          'pattern costs the same as a one-character one. The parallelism is over pattern positions ' +
          'and nothing else.',
        example: 'On 9 870 characters with a six-character pattern, bitap uses 9 870 words at k = 0 ' +
          '— exactly one per character.'
      },
      {
        term: 'The word size is a cliff, and the cliff is the design constraint',
        plain: 'A 32-character pattern costs one word per character; a 33-character one costs two.',
        formal: 'cost is ceil(m / w) words per character per error level, for a machine word of w bits',
        readAs: 'While the pattern fits in one machine word the cost is one operation per character — ' +
          'genuinely constant. Past that it needs a second word, and the cost doubles in a single step. ' +
          'That cliff is what makes bit-parallel matching a short-pattern technique.',
        detail: 'That is the entire reason `agrep` and its descendants exist and the entire reason ' +
          'they have a documented pattern-length limit. The cost curve is a staircase whose step is ' +
          'the machine word, which is why this family of algorithms got faster in 1985 and again ' +
          'when 64-bit registers arrived, with nobody changing the algorithm. A demo that refuses ' +
          'past 32 characters is showing the constraint rather than hiding it.',
        example: 'Pattern lengths 8, 16, 24 and 32 all cost 2.00 words per character at k = 1; 40 ' +
          'and 48 are refused outright.'
      },
      {
        term: 'Wu-Manber is four AND terms per error level',
        plain: 'Match, substitution, insertion and deletion, intersected.',
        formal: 'R^d = ((R^d_prev << 1) | mask) & (R^{d−1}_prev << 1) & (R^{d−1} << 1) & R^{d−1}_prev',
        detail: 'Each term corresponds to one way of consuming a character at this error level, and ' +
          'getting any one of them wrong produces a matcher that reports positions almost ' +
          'everywhere — which looks like a threshold problem rather than a bug. The recurrence needs ' +
          'the previous character\'s word at this level *and* the previous level\'s word at both ' +
          'characters, so the old row must be kept whole rather than carried one value at a time.',
        example: 'At k = 0, 1, 2, 3 and 4 the bit-parallel matcher agrees with a plain DP reference ' +
          'on 102, 306, 510, 864 and 1 468 end positions.'
      },
      {
        term: 'A distance cutoff restricts the DP to a band, and the restriction is exact',
        plain: 'An alignment costing at most k cannot stray more than k cells from the diagonal.',
        formal: 'only the (2k+1)-wide band around the diagonal can hold a value at most k',
        readAs: 'A cell far from the diagonal already implies more than k edits, so it need not be computed ' +
          'at all. Restricting to a band of that width is what turns quadratic edit distance into ' +
          'something linear in the text for small k.',
        detail: 'Every step away from the diagonal costs at least one edit and every step back ' +
          'costs another, so a cell more than k from it has value greater than k by construction. ' +
          'That makes the band a correct restriction rather than a heuristic — which is what ' +
          'separates it from the q-gram prefilter below and what makes "exact whenever the answer ' +
          'is within budget" a theorem rather than an observation.',
        example: 'Over six fixture pairs the band computes 71 cells against 314 for the full grid — ' +
          '77.4% never computed.'
      },
      {
        term: 'A banded answer above the band is a refusal, not a number',
        plain: 'The routine says "greater than k", and reading that as "exactly k+1" is wrong.',
        formal: 'the banded distance is exact iff it is at most k; outside, only the inequality holds',
        readAs: 'Inside the band the answer is the true distance. If the computation runs off the band, all ' +
          'you learn is that the distance exceeds k — the correct response is to refuse rather than to ' +
          'report the band\'s number.',
        detail: 'This is the column implementations lose. A banded routine that returns `k + 1` is ' +
          'reporting an artefact of the band, because the true distance could be anything above it — ' +
          'and code that sorts by that value, or thresholds on it, or averages it, is using a number ' +
          'that does not exist. Returning the exactness flag alongside the value is the difference ' +
          'between a distance and an upper bound on a distance.',
        example: 'At k = 1, five of the six fixture pairs return a refusal rather than a distance.'
      },
      {
        term: 'The q-gram filter has a usability condition, and it is one subtraction',
        plain: 'A match within k errors must share at least m − q + 1 − kq q-grams with the pattern.',
        formal: 'each of the k errors destroys at most q q-grams, out of the m − q + 1 the pattern has',
        readAs: 'One edit can spoil at most q of the overlapping q-grams, so k edits spoil at most k·q. ' +
          'Anything within k edits must therefore still share the rest — which is the filter\'s ' +
          'threshold, and it goes negative once q gets large.',
        detail: 'When that number is positive the filter is sound and useful; when it is zero or ' +
          'below, every window passes and the filter is a q-gram count per position for no benefit ' +
          'at all. The expression involves the pattern length, the error budget and q together, so a ' +
          'filter tuned on one query silently becomes a no-op on a shorter one — and almost no ' +
          'implementation checks it at run time.',
        example: 'For a six-character pattern at k = 1 the threshold is 3 at q = 2, 1 at q = 3, and ' +
          '−1 at q = 4, at which point the filter admits all 1 196 positions.'
      },
      {
        term: 'Candidates per result decides the throughput, not the verifier',
        plain: 'The filter runs once per record and the verifier runs once per candidate.',
        formal: 'total cost ≈ records × filterCost + candidates × verifyCost, and candidates is the multiplier',
        detail: 'If the filter admits fifty candidates per result, making the verifier twice as ' +
          'fast halves half the cost; making the filter admit five instead removes ninety per cent ' +
          'of it. That is one counter and ten minutes of work, and it decides where the next month ' +
          'of optimisation goes. Almost every "our matching is too slow" investigation ends at a ' +
          'prefilter and almost none of them start there.',
        example: 'At q = 3 the pipeline admits 6.6 candidates per result; at q = 4, where the ' +
          'threshold goes negative, it admits 44.3.'
      },
      {
        term: 'Exact, sound and heuristic are three different guarantees',
        plain: 'Bitap is exact, the band is exact within its budget, and the q-gram filter is only sound.',
        formal: 'exact = the right answer; sound = no false negatives; heuristic = neither, without a stated bound',
        detail: 'Mixing them in one pipeline is normal and fine; failing to know which is which is ' +
          'not. A sound filter can be followed by an exact verifier and the whole pipeline is exact. ' +
          'A heuristic filter cannot, and the resulting recall is an empirical number that has to be ' +
          'measured on real data rather than reasoned about. Writing down which guarantee each stage ' +
          'carries is what makes an end-to-end claim possible at all.',
        example: 'The demo reports the filter\'s soundness condition explicitly, and marks the ' +
          'settings where it does not hold.'
      }
    ],

    'diff-and-merge': [
      {
        term: 'A diff is a shortest path in an edit graph',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["a grid: file A across,<br/>file B down"] --> B["right = delete a line of A"]',
            '    A --> C["down = insert a line of B"]',
            '    A --> D["diagonal = the lines match,<br/>and it costs nothing"]',
            '    B --> E["the cheapest path from<br/>corner to corner is the diff"]',
            '    C --> E',
            '    D --> E'
          ].join('\n'),
          caption: 'Once diff is a shortest-path problem, the whole of graph search is available to it — which is exactly what Myers uses to avoid filling the grid.'
        },
        plain: 'Right deletes a line of A, down inserts a line of B, and the diagonal is free when the lines match.',
        formal: 'the shortest edit script is the shortest path from (0,0) to (N,M) in that graph',
        readAs: 'Lay the two files out as the axes of a grid. Moving right deletes, moving down inserts, ' +
          'moving diagonally keeps a matching line for free. The cheapest route across is the diff.',
        detail: 'Framing it as a longest common subsequence is equivalent and less useful, because ' +
          'the LCS formulation invites an O(NM) table and the graph formulation invites a search ' +
          'that stops when it reaches the corner. The difference between those two mental models is ' +
          'the difference between a diff that scales with the file and one that scales with the ' +
          'change.',
        example: 'On a 200-line file with 1% of lines changed, Myers visits 13 diagonals; the table ' +
          'would have 40 000 cells.'
      },
      {
        term: 'Myers searches by cost, so it stops when the answer is found',
        plain: 'Keep the furthest point reachable on each diagonal at the current edit distance, and increase it until you arrive.',
        formal: 'O((N + M)·D) where D is the edit distance — proportional to the SIZE OF THE ANSWER',
        readAs: 'Myers costs the file sizes times the number of differences, not times the file sizes. Two ' +
          'large files that differ in three lines are diffed almost instantly — which is why this is ' +
          'the algorithm every version control system uses.',
        detail: 'That is the property that makes `git diff` on a one-line change to a ten-thousand ' +
          'line file return instantly. The work is not a function of the file size but of how ' +
          'different the two files are, so the common case — a small change to a large file — is ' +
          'the cheap case. Two unrelated files of the same size cost the full quadratic, and that ' +
          'is also the right behaviour.',
        example: 'Diagonals visited at 1%, 10% and 60% of lines changed: 13, 841 and 29 041, on ' +
          'identical file sizes.'
      },
      {
        term: 'The snake is free, and that is why the greedy works',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["you are on a diagonal"] --> B["the next lines match"]',
            '    B --> C["slide along them —<br/>it costs nothing"]',
            '    C --> B',
            '    C --> D["only when they stop matching<br/>do you spend an edit"]',
            '    D --> E["so taking every free step first<br/>can never be wrong"]'
          ].join('\n'),
          caption: 'Because a matching run costs zero, there is never a reason to stop early. That is what turns a search over a huge grid into a walk along a handful of diagonals.'
        },
        plain: 'Sliding along matching lines costs nothing, so take as many as possible before spending an edit.',
        formal: 'the diagonal edges have weight 0; every furthest-reaching path extends greedily along them',
        detail: 'Because matching lines are free, the furthest-reaching point on a diagonal at cost ' +
          'D is found by taking the best of the two D−1 neighbours and then sliding — no search, no ' +
          'choice, no backtracking. That is what collapses a shortest-path problem into a single ' +
          'forward sweep per cost level, and it is why the algorithm is thirty lines rather than a ' +
          'priority queue.',
        example: 'At 1% changed the search makes 210 snake comparisons and visits only 13 diagonals.'
      },
      {
        term: 'Minimal and readable are different objectives',
        plain: 'The shortest edit script on a file full of closing braces is one no human reads as the change that was made.',
        formal: 'edit-script length and hunk count are different measures, and optimising one can worsen the other',
        detail: 'When a file has many identical lines — a closing brace, a blank line, a repeated ' +
          'boilerplate row — the minimal script pairs them arbitrarily and interleaves the hunks. ' +
          'The result is correct, shortest, and unreadable. That is not a bug in the algorithm; it ' +
          'is the algorithm optimising the thing it was asked to optimise, and the fix is to ask for ' +
          'something else.',
        example: 'On a file where a function moved, Myers produces 6 operations in 3 hunks and ' +
          'patience produces 8 in 2.'
      },
      {
        term: 'Patience diff anchors on lines unique in both files',
        plain: 'Match the lines that occur exactly once on each side, take the longest increasing subsequence of those, recurse between them.',
        formal: 'the anchors exclude repeated lines by construction, which is exactly what Myers interleaves',
        detail: 'Giving up minimality buys hunks that correspond to the change somebody actually ' +
          'made, because a line that appears once in each file is almost certainly *the same line* ' +
          'and a closing brace is not. Between anchors the algorithm falls back to Myers, so ' +
          'patience is an anchoring strategy rather than a whole algorithm — which is why it is a ' +
          'flag on the same command rather than a different tool.',
        example: 'The anchors on the reorder fixture are 3 lines that occur exactly once in each ' +
          'file; the repeated closing braces are not among them.'
      },
      {
        term: 'An edit script is only worth asserting about if it round-trips',
        plain: 'Apply it to A and check you get B, character for character.',
        formal: 'apply(A, script) = B is the only claim; the length and the hunk count are commentary',
        readAs: 'The one thing a diff must guarantee is that applying it to the first file produces the ' +
          'second. How short or how readable the script is are preferences, not correctness.',
        detail: 'A diff that does not reconstruct the second file is a plausible list of line ' +
          'numbers, and every other number computed from it is meaningless. The check is four lines ' +
          'and it catches the whole family of backtracking errors that produce scripts which look ' +
          'right in a side-by-side view and are not. Every panel in the demo reports it, before it ' +
          'reports anything else.',
        example: 'Both Myers and patience round-trip on all four fixtures, which is what licenses ' +
          'comparing their hunk counts at all.'
      },
      {
        term: 'A three-way merge distinguishes inserting before a line from replacing it',
        plain: 'One side adding a line and the other editing a nearby line is not a conflict.',
        formal: 'per base position: a prefix of inserted lines, and a replacement for the line itself',
        detail: 'Conflating the two produces conflicts on every commit that touched two nearby ' +
          'lines, which is the difference between a merge tool people trust and one they route ' +
          'around. Splitting them means an insertion on one side and an edit on the other are ' +
          'independent decisions at the same position, and both can be taken.',
        example: 'Of five three-way fixtures, only one conflicts — the one where both sides changed ' +
          'the same line to different content.'
      },
      {
        term: 'A conflict is reported, never resolved',
        plain: 'When both sides changed the same thing differently, the tool must stop.',
        formal: 'the merge output contains both versions with markers, and the conflict count is the result',
        detail: 'A merge tool that silently picks a side is a merge tool nobody can trust, because ' +
          'the cases where it guesses wrong are exactly the cases where the two changes were ' +
          'incompatible for a reason. Reporting the count as the primary output — rather than ' +
          'burying it in the exit status — is what makes the tool\'s behaviour predictable, and it ' +
          'is why every merge driver in use has the same three markers.',
        example: 'The conflicting fixture emits both versions between markers and reports 1 ' +
          'conflict; the other four resolve automatically.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));

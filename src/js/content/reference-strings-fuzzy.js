/** Reference entries for palindromes, approximate matching and diff (M15.7-M15.9). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'palindromes': {
      summary: 'The interleaving that removes the odd/even split, the mirror that is the Z-window ' +
        'again, and a palindromic tree that answers a question the radius array cannot.',
      intuition: 'A radius in the transformed string is a LENGTH in the original, and the right ' +
        'edge of the current palindrome never moves left.',
      formulation: {
        equations: [
          {
            label: 'The interleaving',
            expr: 'abc becomes #a#b#c#, so every even palindrome becomes an odd one',
            terms: [
              { sym: 'cost', meaning: 'a factor of two in memory, and one duplicate implementation removed' },
              { sym: 'the second dividend', meaning: 'the radius equals the original length, so there is no division at the end' },
              { sym: 'measured', meaning: '"abacabadabacaba" gives 31 transformed characters and a radius of 15 at the centre' }
            ]
          },
          {
            label: 'The mirror',
            expr: 'radius[i] starts at min(r − i, radius[2c − i]) rather than at 0',
            terms: [
              { sym: 'the min', meaning: 'the part people leave out; without it the algorithm is quadratic' },
              { sym: 'measured', meaning: '11 of 31 positions reused a mirror; 26 characters were compared' },
              { sym: 'the proof', meaning: 'every extension moves r right, r never moves left, so extensions total at most n' }
            ]
          },
          {
            label: 'Against expanding around every centre',
            expr: 'the ratio depends entirely on the family',
            terms: [
              { sym: 'random binary, n = 800', meaning: 'Manacher 3 199 against 4 899 — 1.5x, because the longest palindrome is about 20 characters' },
              { sym: 'one repeated character, n = 800', meaning: '3 200 against 641 599 — 200.5x' },
              { sym: 'the growth', meaning: '5.5x, 13.0x, 25.5x, 50.5x, 100.5x, 200.5x at 20, 50, 100, 200, 400, 800 — the ratio doubles with the length' }
            ]
          },
          {
            label: 'How many, and how many different',
            expr: 'the sum of the radii against the eertree node count',
            terms: [
              { sym: '"abacabadabacaba"', meaning: '32 palindromic substrings and 15 distinct ones' },
              { sym: 'one repeated character', meaning: 'n(n+1)/2 against n — 320 400 against 800 at n = 800' },
              { sym: 'the node bound', meaning: 'at most n + 2, because one character creates at most one new distinct palindrome' },
              { sym: 'the two roots', meaning: 'length 0 for even palindromes, length −1 so that "extend both sides" produces a single character' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The right edge of the current palindrome never decreases',
          why: 'It is the whole complexity proof and it is checkable from the trace.',
          breaks: 'An implementation that recomputes from scratch is quadratic and correct, which hides it.'
        },
        {
          name: 'The mirror is capped at the distance to the right edge',
          why: 'Past that edge the algorithm has no information and must compare.',
          breaks: 'Omitting the min gives radii that are too large, so "palindromes" that are not.'
        },
        {
          name: 'The count matches an exhaustive expansion around every centre',
          why: 'The output is an array of plausible numbers whether or not it is right.',
          breaks: 'A wrong min is silent; only the oracle catches it.'
        },
        {
          name: 'The eertree has at most n + 2 nodes',
          why: 'One character adds at most one distinct palindrome, and that is why the structure is linear.',
          breaks: 'More nodes than characters means the suffix-link walk created a duplicate.'
        }
      ],
      complexity: [
        { operation: 'Manacher', average: 'Θ(n)', worst: '3 200 comparisons at n = 800, on any family' },
        { operation: 'expand around every centre', average: 'Θ(n) on random data, Θ(n²) on repetitive data', worst: '641 599 comparisons at n = 800 on a repeated character' },
        { operation: 'counting palindromic substrings', average: 'Θ(n) from the radius array', worst: '320 400 at n = 800 — the count, not the distinct count' },
        { operation: 'eertree construction', average: 'Θ(n) amortised over the suffix-link walks', worst: 'at most n + 2 nodes' },
        { operation: 'distinct count by enumeration', average: 'Θ(n³) with string comparison', worst: 'the oracle, affordable to a few hundred characters' },
        { operation: 'memory', average: 'Θ(n) for the radius array, Θ(n) for the tree', worst: 'the interleaving doubles the first' }
      ],
      failureModes: [
        {
          symptom: 'A palindrome routine reports substrings that are not palindromes.',
          cause: 'The mirror was copied without capping it at the distance to the right edge.',
          fix: 'Take the min; check the count against an exhaustive expansion on a few hundred characters.'
        },
        {
          symptom: 'A linear-time implementation is quadratic on repetitive input.',
          cause: 'The window is not being carried forward, so every position expands from scratch.',
          fix: 'Assert that the right edge is monotone; the answer is right either way, so nothing else catches it.'
        },
        {
          symptom: 'A "distinct palindromic substrings" count is wrong by a factor of n.',
          cause: 'The radius array was summed, which counts with multiplicity.',
          fix: 'Build an eertree; no arithmetic on the radii recovers the distinct count.'
        },
        {
          symptom: 'An eertree implementation is full of special cases for odd lengths.',
          cause: 'The length-−1 root was dropped as an oddity.',
          fix: 'Put it back; it is what makes "extend by one on each side" uniform.'
        }
      ],
      inTheWild: [
        { system: 'Competitive programming', how: 'Manacher for longest-palindrome questions, eertree for distinct-palindrome ones' },
        { system: 'Bioinformatics', how: 'inverted repeats and hairpin structures are palindromes over a complement alphabet' },
        { system: 'Compression research', how: 'palindromic factorisation as a decomposition for repetitive text' },
        { system: 'Data-cleaning heuristics', how: 'palindromic runs as a signal for machine-generated or corrupted identifiers' }
      ],
      sources: [
        { title: 'A new linear-time on-line algorithm for finding the smallest initial palindrome of a string', where: 'Glenn Manacher — JACM, 1975' },
        { title: 'EERTREE: An Efficient Data Structure for Processing Palindromes in Strings', where: 'Rubinchik, Shur — IWOCA, 2015' },
        { title: 'Algorithms on Strings, Trees and Sequences', where: 'Dan Gusfield, 1997' },
        { title: 'Combinatorics on Words', where: 'M. Lothaire, 1997 — periodicity and palindromic structure' }
      ]
    },

    'approximate-matching': {
      summary: 'Bit-parallelism with a cliff exactly at the machine word, a band that is exact ' +
        'inside its budget and a refusal outside it, and a q-gram filter whose soundness condition ' +
        'is one subtraction that nobody checks.',
      intuition: 'Three stages with three different guarantees — exact, exact-within-budget, and ' +
        'sound-only — and knowing which is which is what makes an end-to-end claim possible.',
      formulation: {
        equations: [
          {
            label: 'Shift-Or',
            expr: 'state = (state << 1) | mask[c], where a ZERO bit means a match',
            terms: [
              { sym: 'why negative logic', meaning: 'shifting a 0 into the low bit starts a fresh attempt at every position for free' },
              { sym: 'cost', meaning: 'one word per character, whatever the pattern length, up to the word size' },
              { sym: 'measured', meaning: '9 870 words for 9 870 characters at k = 0' }
            ]
          },
          {
            label: 'Wu-Manber, k errors',
            expr: 'R^d = ((R^d_prev << 1) | mask) & (R^{d−1}_prev << 1) & (R^{d−1} << 1) & R^{d−1}_prev',
            terms: [
              { sym: 'the four terms', meaning: 'match, substitution, insertion, deletion' },
              { sym: 'what it needs', meaning: 'the whole previous row, not one carried value' },
              { sym: 'checked', meaning: '102 / 306 / 510 / 864 / 1 468 end positions at k = 0 to 4, identical to a DP reference' },
              { sym: 'cost', meaning: 'k + 1 words per character — 49 350 at k = 4 against a flat 59 220 DP cells' }
            ]
          },
          {
            label: 'The word-size cliff, k = 1',
            expr: 'ceil(m / w) words per character per error level',
            terms: [
              { sym: 'lengths 8, 16, 24, 32', meaning: '2.00 words per character — flat' },
              { sym: 'DP cells over the same lengths', meaning: '78 960 / 157 920 / 236 880 / 315 840 — the ratio rises 4x to 16x' },
              { sym: 'lengths 40 and 48', meaning: 'refused: the state needs 40 bits and the register holds 32' },
              { sym: 'why it matters historically', meaning: 'the family got faster when registers widened, with no change to the algorithm' }
            ]
          },
          {
            label: 'The band, k = 1, six fixture pairs',
            expr: 'only the (2k+1)-wide band around the diagonal can hold a value at most k',
            terms: [
              { sym: 'cells', meaning: '71 computed against 314 for the full grid — 77.4% never touched' },
              { sym: 'refusals', meaning: '5 of 6 pairs returned "greater than k" rather than a distance' },
              { sym: 'the trap', meaning: '"kitten"/"sitting" has true distance 3; at k = 1 the band says "> 1", not "2"' }
            ]
          },
          {
            label: 'The q-gram filter, six-character pattern at k = 1',
            expr: 'threshold = m − q + 1 − kq, and the filter is sound only while it is positive',
            terms: [
              { sym: 'q = 2', meaning: 'threshold 3 — 54 candidates, 2.0 per result' },
              { sym: 'q = 3', meaning: 'threshold 1 — 177 candidates, 6.6 per result' },
              { sym: 'q = 4', meaning: 'threshold −1 — all 1 196 positions admitted, 44.3 per result' },
              { sym: 'q = 5', meaning: 'threshold −3 — the same, and the filter is pure overhead' },
              { sym: 'the results', meaning: '27 at every setting; only the cost changes' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The bit-parallel positions match a dynamic-programming reference at every k',
          why: 'A wrong AND term reports positions almost everywhere, which looks like a threshold problem.',
          breaks: 'Nothing else catches it — the output is a plausible list of positions.'
        },
        {
          name: 'The banded distance is exact if and only if it is at most k',
          why: 'Outside the band only the inequality holds, and the value is an artefact.',
          breaks: 'Sorting or thresholding on a refused value uses a number that does not exist.'
        },
        {
          name: 'The q-gram filter is sound only while m − q + 1 − kq > 0',
          why: 'Below that every window passes and the filter is a cost with no benefit.',
          breaks: 'A filter tuned on one query silently becomes a no-op on a shorter one.'
        },
        {
          name: 'A sound filter followed by an exact verifier is exact end to end',
          why: 'That composition is what lets a pipeline make a guarantee at all.',
          breaks: 'A heuristic filter makes the recall an empirical number rather than a theorem.'
        }
      ],
      complexity: [
        { operation: 'bitap, exact', average: 'Θ(n) for m <= word size', worst: 'Θ(n · ceil(m/w)); refused past 32 bits here' },
        { operation: 'bitap with k errors', average: 'Θ(n · (k + 1) · ceil(m/w))', worst: '49 350 words at k = 4 over 9 870 characters' },
        { operation: 'full edit-distance DP', average: 'Θ(n · m)', worst: '59 220 cells, independent of k' },
        { operation: 'banded DP', average: 'Θ(n · (2k + 1))', worst: '71 cells against 314 across six pairs' },
        { operation: 'q-gram filter', average: 'Θ(n · q) to build the counts', worst: 'admits everything when the threshold is non-positive' },
        { operation: 'end-to-end pipeline', average: 'records × filter + candidates × verify', worst: 'candidates per result swings 2.0 to 44.3 with q' }
      ],
      failureModes: [
        {
          symptom: 'A fuzzy matcher reports matches at almost every position.',
          cause: 'One of the four Wu-Manber AND terms is wrong or the initial state is not shifted per level.',
          fix: 'Compare every position against a plain DP search at k = 0 through 4.'
        },
        {
          symptom: 'A "distance" of k + 1 is used in a downstream calculation.',
          cause: 'A banded routine returned a refusal and it was read as a value.',
          fix: 'Return and check an exactness flag; the true distance could be anything above the band.'
        },
        {
          symptom: 'A prefilter stops helping when the query gets shorter.',
          cause: 'The threshold m − q + 1 − kq went non-positive and the filter now admits everything.',
          fix: 'Compute the threshold at run time; fall back to a smaller q or to no filter, deliberately.'
        },
        {
          symptom: 'A matching pipeline is optimised and gets no faster.',
          cause: 'The work was in the candidate count, not in the verifier.',
          fix: 'Measure candidates per result first; it is one counter and it decides where the effort goes.'
        }
      ],
      inTheWild: [
        { system: 'agrep and TRE', how: 'bitap with the documented pattern-length limit that the word size imposes' },
        { system: 'Read aligners (BWA, Bowtie)', how: 'seed-and-extend: an exact prefilter, then banded DP on the candidates' },
        { system: 'Spell checkers and fuzzy autocomplete', how: 'a q-gram or trie prefilter, then bounded edit distance' },
        { system: 'Record linkage and entity resolution', how: 'blocking on q-grams, then a scored comparison per candidate pair' }
      ],
      sources: [
        { title: 'A new approach to text searching', where: 'Baeza-Yates, Gonnet — CACM, 1992 — the bitap algorithm' },
        { title: 'Fast text searching allowing errors', where: 'Wu, Manber — CACM, 1992' },
        { title: 'Algorithms for approximate string matching', where: 'Esko Ukkonen — Information and Control, 1985 — the band' },
        { title: 'A guided tour to approximate string matching', where: 'Gonzalo Navarro — ACM Computing Surveys, 2001' }
      ]
    },

    'diff-and-merge': {
      summary: 'Myers as a shortest path whose cost is the size of the answer, patience as a ' +
        'different objective rather than a better algorithm, and a three-way merge that conflicts ' +
        'on one of five cases people expect it to conflict on.',
      intuition: 'The search stops when it reaches the corner, so a small change to a large file is ' +
        'the cheap case — and the shortest script is routinely the least readable one.',
      formulation: {
        equations: [
          {
            label: 'The edit graph',
            expr: 'right deletes a line of A, down inserts a line of B, the diagonal is free when they match',
            terms: [
              { sym: 'the search', meaning: 'keep the furthest x per diagonal at cost D, and increase D until the corner is reached' },
              { sym: 'the snake', meaning: 'sliding along matching lines is free, so the greedy needs no choice' },
              { sym: 'cost', meaning: 'O((N + M)·D) — proportional to the SIZE OF THE ANSWER' }
            ]
          },
          {
            label: 'Work against the change fraction, two 200-line files',
            expr: 'the diagonal count tracks D and not N',
            terms: [
              { sym: '1% changed', meaning: 'D = 4, 13 diagonals, 210 snake comparisons — 0.03% of N x M' },
              { sym: '10%', meaning: 'D = 40, 841 diagonals — 2.10%' },
              { sym: '40%', meaning: 'D = 160, 12 961 diagonals — 32.40%' },
              { sym: '60%', meaning: 'D = 240, 29 041 diagonals — 72.60%' }
            ]
          },
          {
            label: 'Minimal against readable, on a file where a function moved',
            expr: 'the two objectives disagree',
            terms: [
              { sym: 'Myers', meaning: '6 operations in 3 hunks — the shortest possible script' },
              { sym: 'patience', meaning: '8 operations in 2 hunks, anchored on 3 lines unique to both files' },
              { sym: 'what Myers interleaves', meaning: 'the repeated closing braces and blank lines, which are interchangeable' },
              { sym: 'why patience excludes them', meaning: 'an anchor must occur exactly once in each file, by construction' }
            ]
          },
          {
            label: 'Three-way merge, five fixtures',
            expr: '1 conflict, and it is the only genuine disagreement',
            terms: [
              { sym: 'resolved', meaning: 'different lines changed; the same change made twice; an insertion beside an edit; a deletion beside an edit' },
              { sym: 'conflicted', meaning: 'both sides changed the same line to different content' },
              { sym: 'what makes the difference', meaning: 'two slots per base position — a prefix of inserted lines and a replacement for the line itself' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The edit script applied to A produces B exactly',
          why: 'Without it the script is a plausible list of line numbers and every derived number is meaningless.',
          breaks: 'Backtracking errors produce scripts that look right in a side-by-side view.'
        },
        {
          name: 'The operation count equals the true edit distance',
          why: 'It is what "minimal" means, and patience deliberately gives it up.',
          breaks: 'A script longer than D means the search returned before the corner or the backtrack drifted.'
        },
        {
          name: 'An anchor occurs exactly once in each file',
          why: 'That is what makes it almost certainly the same line rather than an interchangeable one.',
          breaks: 'Anchoring on a repeated line reproduces the interleaving patience exists to avoid.'
        },
        {
          name: 'A conflict is reported, never resolved',
          why: 'The cases where a tool would guess wrong are the cases where the changes were incompatible.',
          breaks: 'A merge driver that silently picks a side is one people route around.'
        }
      ],
      complexity: [
        { operation: 'Myers', average: 'O((N + M)·D)', worst: '13 diagonals at 1% changed and 29 041 at 60%, on identical file sizes' },
        { operation: 'table-filling LCS', average: 'Θ(N · M) always', worst: '40 000 cells for the same 200-line files, whatever the change' },
        { operation: 'script reconstruction', average: 'Θ(D) V-arrays kept', worst: 'the linear-space refinement divides on the middle snake instead' },
        { operation: 'patience anchoring', average: 'Θ(N log N) for the longest increasing subsequence', worst: 'falls back to Myers between anchors' },
        { operation: 'round-trip check', average: 'Θ(script length)', worst: 'four lines, and the only assertion worth making' },
        { operation: 'three-way merge', average: 'two diffs against the base plus a linear pass', worst: '1 conflict in 5 fixtures' }
      ],
      failureModes: [
        {
          symptom: 'A diff of two large nearly identical files is slow.',
          cause: 'A table-filling implementation, whose cost is the file size rather than the change size.',
          fix: 'Use Myers; the search stops at the corner and a small change reaches it after a few cost levels.'
        },
        {
          symptom: 'A generated diff is minimal and unreadable.',
          cause: 'The file has many identical lines and the shortest script pairs them arbitrarily.',
          fix: 'Use patience or histogram anchoring; it is a different objective, not a better algorithm.'
        },
        {
          symptom: 'An edit script produces the wrong file when applied.',
          cause: 'The backtrack chose the wrong predecessor diagonal at some cost level.',
          fix: 'Assert the round-trip on randomised pairs; a side-by-side view will not show it.'
        },
        {
          symptom: 'A merge conflicts on every commit touching two nearby lines.',
          cause: 'Insertions before a line and replacements of it are being treated as one slot.',
          fix: 'Keep them separately per base position; both can then be taken independently.'
        }
      ],
      inTheWild: [
        { system: 'git diff', how: 'Myers by default, with --patience, --histogram, --ignore-all-space and an indent heuristic' },
        { system: 'GNU diff', how: 'Myers with a linear-space refinement and heuristics for very large inputs' },
        { system: 'Operational transformation and CRDT merges', how: 'the same three-way reasoning, applied per operation rather than per line' },
        { system: 'Snapshot testing', how: 'the diff is the entire product, so readability beats minimality outright' }
      ],
      sources: [
        { title: 'An O(ND) difference algorithm and its variations', where: 'Eugene Myers — Algorithmica, 1986' },
        { title: 'A file comparison program', where: 'Miller, Myers — Software: Practice and Experience, 1985' },
        { title: 'Patience Diff Advantages', where: 'Bram Cohen, 2010 — the anchoring argument' },
        { title: 'The Git source: xdiff/xhistogram.c', where: 'the histogram variant, and why the default changed' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));

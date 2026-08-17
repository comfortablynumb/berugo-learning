/** Worked examples for the index and search sections (M06.7-M06.9). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'burrows-wheeler': [
      {
        title: 'Inverting mississippi without the matrix',
        goal: 'Recover the text from the last column alone, and count what it cost.',
        setup: 'mississippi with a sentinel appended, transformed to its last column.',
        steps: [
          {
            do: 'Take the transform.',
            why: 'The definition sorts rotations; the implementation reads the suffix array.',
            work: 'sa = 11, 10, 7, 4, 1, 0, 9, 8, 6, 3, 5, 2\nlast column: ipssm␀pissii — 12 characters',
            result: 'one pass over the array, no matrix'
          },
          {
            do: 'Build the count table.',
            why: 'This stands in for the first column, at alphabet size rather than text size.',
            work: 'C[␀]=0, C[i]=1, C[m]=5, C[p]=6, C[s]=8\n5 entries for a 12-character text',
            result: 'the first column never has to be stored'
          },
          {
            do: 'Walk LF from row 0.',
            why: 'Row 0 is the sentinel\'s rotation, so its last character ends the text.',
            work: 'read last[row], then row = C[last[row]] + rank(last[row], row)\n11 steps recover 11 characters',
            result: 'mississippi, exactly'
          },
          {
            do: 'Count what the walk touched.',
            why: 'To show the inverse is linear and matrix-free.',
            work: '11 LF steps, 11 rank queries, 0 rotation rows built\nthe matrix would have been 12 × 12 = 144 characters',
            result: 'O(n) against O(n²)'
          },
          {
            do: 'Note the off-by-one that breaks it.',
            why: 'It fails on every input, which makes it easy to find and easy to write.',
            work: 'read first, then step: recovers all 11 characters\nstep first, then read: drops the last one and shifts by 1',
            result: 'the round-trip check catches it immediately, which is why it belongs in the invariants'
          }
        ],
        answer: 'The transform of mississippi is ipssm␀pissii, and inverting it takes 11 LF steps, 11 ' +
          'rank queries and a 5-entry count table — no rotation matrix, which would have been 144 ' +
          'characters. The first column is never stored because it is just the sorted characters, ' +
          'summarised by C[c].'
      },
      {
        title: 'The checkpoint dial',
        goal: 'Price the one decision an FM-index actually exposes.',
        setup: '4 000 characters of DNA indexed three times, differing only in rank checkpoint spacing.',
        steps: [
          {
            do: 'Checkpoint every 8 positions.',
            why: 'Close to a full rank table: fast queries, large index.',
            work: 'checkpoint bytes 10 020\ntotal 3.76 bytes per character · 21 rank steps to count a 4-character pattern',
            result: 'almost no scanning, and the checkpoints dominate the size'
          },
          {
            do: 'Checkpoint every 32.',
            why: 'The usual default, and the demo\'s.',
            work: 'checkpoint bytes 2 520\ntotal 1.88 bytes per character · 117 rank steps',
            result: 'half the size, 5.6× the scanning'
          },
          {
            do: 'Checkpoint every 128.',
            why: 'The other end of the dial.',
            work: 'checkpoint bytes 640\ntotal 1.41 bytes per character · 533 rank steps',
            result: 'a quarter the size again, 25× the scanning of the first'
          },
          {
            do: 'Check the answers.',
            why: 'A space/time dial that changes the answer is not a dial, it is a bug.',
            work: 'all three count the same 195 occurrences of the probe pattern\nthe algorithms above the rank structure never changed',
            result: 'identical results at every setting'
          },
          {
            do: 'Compare the whole range against the alternatives.',
            why: 'To place the dial in context rather than in isolation.',
            work: 'FM-index across the dial: 1.41 to 3.76 bytes per character\nsuffix array + LCP: 9.0 · suffix tree: 42.3',
            result: 'even the most generous FM setting is 2.4× smaller than a suffix array'
          }
        ],
        answer: 'Moving the checkpoint spacing from 8 to 128 takes the index from 3.76 to 1.41 bytes ' +
          'per character and the rank work from 21 steps to 533 — a 2.7× space saving for 25× the ' +
          'scanning, with all three returning the same 195 occurrences. That is what a real ' +
          'space/time dial looks like: the cost moves and the answer does not.'
      }
    ],

    'inverted-indexes': [
      {
        title: 'The skew decides the intersection',
        goal: 'Find where each strategy wins, rather than repeating the usual advice.',
        setup: 'A 100 000-entry posting list intersected with a shorter one, at five different lengths.',
        steps: [
          {
            do: 'Start with an extremely rare term.',
            why: 'This is the case galloping is famous for.',
            work: '10 against 100 000\nlinear 90 566 comparisons · skip 1 749 · galloping 245',
            result: 'galloping is 370× cheaper than the linear merge'
          },
          {
            do: 'Move to a moderately rare term.',
            why: 'To see how fast the advantage decays.',
            work: '1 000 against 100 000\nlinear 100 313 · skip 87 618 · galloping 11 336',
            result: 'still 8.8× cheaper, and skip pointers have almost caught the linear merge'
          },
          {
            do: 'Make the lists comparable.',
            why: 'This is the case the advice never mentions.',
            work: '50 000 against 100 000\nlinear 124 751 · skip 182 123 · galloping 157 906',
            result: 'the linear merge wins, and both clever strategies lose'
          },
          {
            do: 'Explain the inversion.',
            why: 'It follows from what a probe costs when the next match is adjacent.',
            work: 'galloping: at least 1 probe plus a binary search per element of the shorter list\nlinear: 1 comparison per step, and every step advances',
            result: 'the probe is pure overhead once the gaps are short'
          },
          {
            do: 'State the rule that follows.',
            why: 'The information needed to choose is already in the index.',
            work: 'the crossover in this sweep is near a 10:1 ratio\nposting list lengths are known before the merge starts',
            result: 'choose the strategy per query from the lengths, not per system at design time'
          }
        ],
        answer: 'Galloping does 245 comparisons where a linear merge does 90 566 at a 10 000:1 skew, ' +
          'and 157 906 against the merge\'s 124 751 when the lists are 1:2. The crossover in this ' +
          'sweep is near 10:1, and both list lengths are known before the merge begins — so picking ' +
          'the strategy per query is available for free and picking it at design time is a coin flip.'
      },
      {
        title: 'What gap coding buys, and what positions cost',
        goal: 'Price the two storage decisions against each other.',
        setup: '5 000 documents over a 400-term Zipf vocabulary: 50 995 postings.',
        steps: [
          {
            do: 'Price the raw form.',
            why: 'The baseline everything else is measured against.',
            work: '50 995 postings × 4 bytes = 203 980 bytes\n32 bits per posting',
            result: 'the id size, whatever the corpus'
          },
          {
            do: 'Store gaps with variable-byte coding.',
            why: 'Gaps are small, and small numbers fit in one byte.',
            work: '55 156 bytes\n8.65 bits per posting — a 3.70× saving',
            result: 'most gaps fit in a single byte'
          },
          {
            do: 'Pack the gaps into words with Simple-9.',
            why: 'Word-aligned coding gets below a byte per posting.',
            work: '42 644 bytes\n6.69 bits per posting — a 4.78× saving',
            result: '23% better than variable-byte, with a branchier decoder'
          },
          {
            do: 'Add the positions a phrase query needs.',
            why: 'This is the other storage decision, and it is the larger one.',
            work: 'position lists: 60 000 bytes\nagainst 55 156 bytes of postings — 1.09×',
            result: 'positions cost more than the postings they annotate'
          },
          {
            do: 'Read the two decisions together.',
            why: 'They pull in opposite directions and are usually made separately.',
            work: 'gap coding: 4.78× smaller, costs decode time\npositions: 2.09× larger in total, buys phrase queries',
            result: 'compressing the postings and then adding positions lands back near the raw size'
          }
        ],
        answer: 'Gap coding takes 50 995 postings from 203 980 bytes to 55 156 with variable-byte and ' +
          '42 644 with Simple-9 — 4.78× at best. Positions then add 60 000 bytes, more than the ' +
          'postings themselves, which is why phrase search is a feature you turn on rather than one ' +
          'you always have: the compression win and the positional index are roughly the same size, ' +
          'in opposite directions.'
      }
    ],

    'autocomplete-and-fuzzy': [
      {
        title: 'Recall before latency',
        goal: 'Compare three fuzzy back-ends on the column that actually differs.',
        setup: 'The 883-word list, queried for everything within one edit of "cat".',
        steps: [
          {
            do: 'Establish the truth by brute force.',
            why: 'Without it there is nothing to measure recall against.',
            work: '883 distance computations\n7 words within 1 edit: can, car, cast, cat, cut, eat, hat',
            result: '7 correct answers'
          },
          {
            do: 'Run the BK-tree.',
            why: 'The triangle inequality should prune most of the tree.',
            work: '289 node visits of 883\nreturns 7 of 7 — recall 1.000',
            result: 'exact, at a third of the brute-force work'
          },
          {
            do: 'Run the Levenshtein automaton.',
            why: 'It walks a trie rather than a metric tree, so the counts are different in kind.',
            work: '291 trie-node visits of 2 562\nreturns 7 of 7 — recall 1.000',
            result: 'also exact, visiting 11% of the trie'
          },
          {
            do: 'Run the n-gram index.',
            why: 'This is the fast one, and it is the one to be careful about.',
            work: '5 candidates verified\nreturns cast and cat — 2 of 7, recall 0.286',
            result: '58× fewer verifications, and five of the seven answers missing'
          },
          {
            do: 'Say why the visit counts do not rank them.',
            why: 'The obvious reading of the table is the wrong one.',
            work: 'a BK-tree visit is a full edit distance between two words\nan automaton visit advances 1 DP row by 1 character',
            result: '289 and 291 are not comparable numbers; 1.000 and 0.286 are'
          }
        ],
        answer: 'For "cat" within one edit the BK-tree visits 289 nodes and the automaton 291, and ' +
          'both return all 7 answers; the n-gram index verifies 5 candidates and returns 2, for a ' +
          'recall of 0.286. The visit columns are in different units and cannot be ranked against ' +
          'each other — the recall column can, and it is the one that decides whether the back-end ' +
          'is a search or a suggestion.'
      },
      {
        title: 'Two queries a search box confuses',
        goal: 'Separate prefix completion from fuzzy matching, and price both.',
        setup: 'The same word list, asked for the best completions of "con" and then for fuzzy matches.',
        steps: [
          {
            do: 'Ask for the top 8 completions of "con".',
            why: 'This is what a user typing a real prefix wants.',
            work: '38 node visits, 3 subtrees skipped by the stored maxima\n8 answers out of 22 candidates in the subtree',
            result: 'concept, concern, conclude, condition, conduct, confirm, conflict, connect'
          },
          {
            do: 'Say what the stored maxima did.',
            why: 'Without them the only correct algorithm is enumerate-and-sort.',
            work: 'each node holds the best score below it\na subtree is abandoned when its maximum cannot beat the current 8th answer',
            result: '38 visits instead of enumerating all 22 completions and sorting them'
          },
          {
            do: 'Run a fuzzy search for the same three characters.',
            why: 'To price the alternative the search box might have reached for.',
            work: 'within 1 edit of "cat": 289 BK-tree visits\nwithin 2 edits: 674 visits and 60 answers',
            result: '7.6× the work of the prefix walk, for a different question'
          },
          {
            do: 'Note what happens when the budget rises.',
            why: 'The fuzzy cost grows with the budget; the prefix cost does not grow at all.',
            work: 'budget 1: 289 visits, 7 answers\nbudget 2: 674 visits, 60 answers',
            result: '2.3× the work and 8.6× the answers, most of them irrelevant'
          },
          {
            do: 'State the ordering that follows.',
            why: 'This is the design decision the two measurements support.',
            work: 'prefix walk: 38 visits, exact, ordered by score\nfuzzy fallback: 289+ visits, and only useful when the prefix returns too little',
            result: 'try the prefix first; fall back to fuzzy only when it comes up short'
          }
        ],
        answer: 'The top 8 completions of "con" cost 38 node visits with 3 subtrees pruned by the ' +
          'stored maxima, while a distance-1 fuzzy search costs 289 visits and a distance-2 search ' +
          '674 for 60 mostly-irrelevant answers. They are different queries with different costs, ' +
          'and running the expensive one on every keystroke — when the user is simply typing a ' +
          'prefix that exists — is the common design error the two numbers argue against.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));

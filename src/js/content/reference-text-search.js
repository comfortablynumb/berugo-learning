/** Reference entries for the index and search sections (M06.7-M06.9). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'burrows-wheeler': {
      summary: 'A reversible permutation of the text that groups equal characters, and — with a ' +
        'rank structure over it — a search index for the compressed text itself.',
      intuition: 'Sort the rotations and keep the last column. The i-th c in that column is the ' +
        'i-th c in the sorted first column, which is enough to walk the text backwards.',
      formulation: {
        equations: [
          {
            label: 'The transform',
            expr: 'bwt[i] = T[(sa[i] − 1) mod n]',
            terms: [
              { sym: 'no matrix', meaning: 'the suffix array gives the column in one pass' }
            ]
          },
          {
            label: 'LF mapping',
            expr: 'LF(i) = C[bwt[i]] + rank(bwt[i], i)',
            terms: [
              { sym: 'C[c]', meaning: 'how many characters sort strictly before c — an alphabet-sized table' }
            ]
          },
          {
            label: 'Backward search',
            expr: 'first ← C[c] + rank(c, first) · last ← C[c] + rank(c, last)',
            terms: [
              { sym: 'cost', meaning: '2 rank queries per pattern character, independent of n' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The round trip is exact',
          why: 'It is the cheapest end-to-end check and it fails on almost every implementation error.',
          breaks: 'Stepping LF before reading the character drops the last one and shifts the rest.'
        },
        {
          name: 'LF is a bijection over the rows',
          why: 'Each row is the LF image of exactly one row, which is what makes the walk terminate.',
          breaks: 'A wrong C table or an off-by-one in rank maps two rows to the same target.'
        },
        {
          name: 'The last column is a permutation of the text plus one sentinel',
          why: 'The transform reorders characters; it never adds, drops or changes one.',
          breaks: 'A sentinel that already occurs in the text breaks the row ordering and the count.'
        }
      ],
      complexity: [
        { operation: 'transform', average: 'Θ(n)', worst: 'Θ(n)', note: 'given a suffix array' },
        { operation: 'inverse', average: 'Θ(n)', worst: 'Θ(n · B)', note: 'B = rank checkpoint spacing' },
        { operation: 'count(P)', average: 'Θ(m)', worst: 'Θ(m · B)', note: 'independent of the text length' },
        { operation: 'locate(P)', average: 'Θ(m + occ · s)', worst: 'Θ(m + occ · s)', note: 's = suffix-array sample rate' },
        { operation: 'rank(c, i)', average: 'Θ(B)', worst: 'Θ(n)', note: 'Θ(n) with no checkpoints at all' },
        { operation: 'space', average: 'Θ(n)', worst: 'Θ(n · |Σ| / B)', note: '1.41 to 3.76 bytes per character on DNA' }
      ],
      failureModes: [
        {
          symptom: 'The inverse returns the text shifted by one character.',
          cause: 'The LF walk steps before reading rather than after.',
          fix: 'Read last[row], then step. The round-trip assertion catches this immediately.'
        },
        {
          symptom: 'Counting is correct and locating returns wrong positions.',
          cause: 'The sampled suffix array walk added the wrong number of steps, or sampled the wrong rows.',
          fix: 'Walk LF until a sampled row, then add exactly the number of steps taken.'
        },
        {
          symptom: 'The index is enormous on a large alphabet.',
          cause: 'Rank checkpoints cost |Σ| integers per block, and |Σ| is in the numerator.',
          fix: 'Widen the block spacing, or use a wavelet tree so rank costs log |Σ| rather than |Σ|.'
        },
        {
          symptom: 'The transform compresses nothing.',
          cause: 'The input has no repeated context — random text gives one run per character.',
          fix: 'Measure runs before assuming compression; the transform exposes structure, it does not create it.'
        }
      ],
      inTheWild: [
        { system: 'bzip2', how: 'the transform followed by move-to-front and Huffman coding' },
        { system: 'BWA and Bowtie', how: 'FM-index over a reference genome, searched without decompression' },
        { system: 'ripgrep-style tools and full-text stores', how: 'self-indexes where the index replaces the corpus' }
      ],
      sources: [
        { title: 'Burrows, Wheeler — A block-sorting lossless data compression algorithm (1994)', where: 'the transform and its inverse' },
        { title: 'Ferragina, Manzini — Opportunistic data structures with applications (FOCS 2000)', where: 'the FM-index and backward search' },
        { title: 'Navarro, Mäkinen — Compressed full-text indexes (ACM CS 2007)', where: 'the survey, with the space/time trade-offs' },
        { title: 'Langmead, Salzberg — Fast gapped-read alignment with Bowtie 2 (2012)', where: 'why genomics is built on this' }
      ]
    },

    'inverted-indexes': {
      summary: 'Term to sorted document list, plus the intersection and compression machinery that ' +
        'decides what a query costs.',
      intuition: 'Invert the document-to-terms map. Sorted lists make AND a merge, make gaps small, ' +
        'and let a query stop early.',
      formulation: {
        equations: [
          {
            label: 'The index',
            expr: 'postings[t] = sorted [ d : t ∈ d ]',
            terms: [
              { sym: 'measured', meaning: '5 000 documents over 400 terms give 50 995 postings' }
            ]
          },
          {
            label: 'Galloping',
            expr: 'probe 1, 2, 4, 8 … then binary-search the bracket: O(m log(n/m))',
            terms: [
              { sym: 'crossover', meaning: 'loses to a linear merge once the lists are within about 10:1' }
            ]
          },
          {
            label: 'Gap coding',
            expr: 'gap[i] = id[i] − id[i − 1], then variable-byte or Simple-9',
            terms: [
              { sym: 'measured', meaning: '32 bits raw, 8.65 with variable-byte, 6.69 with Simple-9' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Every posting list is strictly increasing',
          why: 'The merge, the gaps and the skip pointers all assume it.',
          breaks: 'Appending a document id twice makes gaps zero and the intersection double-count.'
        },
        {
          name: 'Every strategy returns the identical result set',
          why: 'They differ in cost only; a different answer is a bug in the clever one.',
          breaks: 'A galloping bound that overshoots the last element drops the final match.'
        },
        {
          name: 'A term in a positional index has positions for every document in its posting list',
          why: 'A phrase query indexes into the position map by document id and assumes it is there.',
          breaks: 'Adding to the postings without adding positions throws on the first phrase query.'
        }
      ],
      complexity: [
        { operation: 'linear intersect', average: 'Θ(m + n)', worst: 'Θ(m + n)', note: 'best when the lists are comparable' },
        { operation: 'skip intersect', average: 'Θ((m + n) / √n)', worst: 'Θ(m + n)', note: 'stride √n between pointers' },
        { operation: 'galloping intersect', average: 'O(m log(n/m))', worst: 'O(m log n)', note: 'best at high skew' },
        { operation: 'phrase query', average: 'Θ(candidates × positions)', worst: 'Θ(occurrences)', note: 'after the boolean intersection' },
        { operation: 'construction', average: 'Θ(tokens)', worst: 'Θ(tokens log tokens)', note: 'external merge for corpora past memory' },
        { operation: 'space', average: 'Θ(postings)', worst: 'Θ(postings)', note: '6.69 to 32 bits per posting by encoding' }
      ],
      failureModes: [
        {
          symptom: 'Query latency is dominated by a term nobody searches for on its own.',
          cause: 'The lists were intersected in query order rather than shortest first.',
          fix: 'Sort the posting lists by length before folding — it is free and it is the largest win.'
        },
        {
          symptom: 'Galloping was adopted and queries got slower.',
          cause: 'The lists are comparable in length, where every probe is overhead.',
          fix: 'Choose per query from the list lengths; the crossover is near 10:1.'
        },
        {
          symptom: 'Phrase queries return documents where the words are not adjacent.',
          cause: 'The positional check tested membership rather than consecutive offsets.',
          fix: 'Require position(t_i) = start + i for every term, anchored on the first term.'
        },
        {
          symptom: 'The index doubled in size after a feature request.',
          cause: 'Positions were enabled; they are larger than the postings they annotate.',
          fix: 'Make positions a per-field decision rather than a global one.'
        }
      ],
      inTheWild: [
        { system: 'Lucene, Elasticsearch, Solr', how: 'skip lists over postings, block-based PForDelta compression' },
        { system: 'PostgreSQL GIN indexes', how: 'the same inversion, with posting lists or trees per key' },
        { system: 'Every web search engine', how: 'positional indexes, sharded, with the intersection loop as the hot path' }
      ],
      sources: [
        { title: 'Zobel, Moffat — Inverted files for text search engines (ACM CS 2006)', where: 'the survey that defines the vocabulary' },
        { title: 'Manning, Raghavan, Schütze — Introduction to Information Retrieval (2008)', where: 'chapters 1 to 5, including skip pointers' },
        { title: 'Anh, Moffat — Inverted index compression using word-aligned binary codes (2005)', where: 'Simple-9 and its family' },
        { title: 'Demaine, López-Ortiz, Munro — Adaptive set intersections (2000)', where: 'galloping, and the adaptive bound' }
      ]
    },

    'autocomplete-and-fuzzy': {
      summary: 'Three ways to answer "what is near this string": a metric tree, an automaton over ' +
        'the dictionary, and an approximate n-gram filter.',
      intuition: 'Exact fuzzy search needs a way to prune. A BK-tree prunes with the triangle ' +
        'inequality; an automaton prunes with the DP row; an n-gram index does not prune, it guesses.',
      formulation: {
        equations: [
          {
            label: 'BK-tree pruning',
            expr: 'visit child keyed j only if d(q, node) − k ≤ j ≤ d(q, node) + k',
            terms: [
              { sym: 'sound iff', meaning: 'd is a metric — the triangle inequality is what licenses it' }
            ]
          },
          {
            label: 'Levenshtein row',
            expr: 'row_next[i] = min(row_next[i−1] + 1, row[i] + 1, row[i−1] + cost)',
            terms: [
              { sym: 'prune', meaning: 'cut the subtree when min(row) > k — it cannot recover' }
            ]
          },
          {
            label: 'Top-k completion',
            expr: 'skip a subtree when best(subtree) ≤ score of the current k-th answer',
            terms: [
              { sym: 'measured', meaning: '38 node visits for the top 8 of a 22-completion subtree' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The distance function is a metric',
          why: 'The BK-tree\'s pruning is unsound without the triangle inequality.',
          breaks: 'A normalised or asymmetric similarity makes the tree drop correct answers silently.'
        },
        {
          name: 'Exact back-ends return exactly the brute-force set',
          why: 'It is the only definition of correct available, and it is cheap to check at test sizes.',
          breaks: 'An off-by-one in the pruning window loses answers at the edge of the budget.'
        },
        {
          name: 'A node\'s stored maximum is the maximum of its subtree',
          why: 'Top-k pruning skips subtrees on that number, so a stale one skips real answers.',
          breaks: 'Inserting without updating the maxima along the path leaves them stale.'
        }
      ],
      complexity: [
        { operation: 'BK-tree build', average: 'Θ(n log n) distances', worst: 'Θ(n²)', note: 'each insert walks to a leaf' },
        { operation: 'BK-tree query', average: 'sublinear with pruning', worst: 'Θ(n)', note: '289 of 883 nodes at distance 1' },
        { operation: 'automaton query', average: 'Θ(visited × |q|)', worst: 'Θ(nodes × |q|)', note: 'a DP row per node visited' },
        { operation: 'n-gram query', average: 'Θ(candidates × |q|)', worst: 'Θ(n × |q|)', note: 'approximate: recall below 1' },
        { operation: 'top-k completion', average: 'Θ(k log k + visited)', worst: 'Θ(subtree)', note: '38 visits with maxima, 22+ without' },
        { operation: 'space', average: 'Θ(n)', worst: 'Θ(n × grams)', note: 'the n-gram index is the largest of the three' }
      ],
      failureModes: [
        {
          symptom: 'The search box misses obvious matches and nobody can reproduce it.',
          cause: 'An n-gram back-end with a threshold that short words cannot meet.',
          fix: 'Measure recall against brute force on the real dictionary before shipping.'
        },
        {
          symptom: 'Swapping in a "better" similarity measure quietly reduced the result set.',
          cause: 'The new measure is not a metric, so the BK-tree pruning became unsound.',
          fix: 'Check the triangle inequality on sample triples, or move to an automaton, which needs no metric.'
        },
        {
          symptom: 'Autocomplete is slow on short, common prefixes.',
          cause: 'The subtree under the prefix is being enumerated and sorted to return ten rows.',
          fix: 'Store a subtree maximum per node and make the walk best-first.'
        },
        {
          symptom: 'Latency spikes as users type more characters.',
          cause: 'A fuzzy search runs on every keystroke, including prefixes that exist exactly.',
          fix: 'Try the prefix walk first; fall back to fuzzy only when it returns too few results.'
        }
      ],
      inTheWild: [
        { system: 'Elasticsearch fuzzy queries', how: 'Levenshtein automata intersected with the term dictionary' },
        { system: 'Lucene suggesters', how: 'FST-based completion with weights, which is the scored-trie idea' },
        { system: 'Spell checkers and command-line "did you mean"', how: 'BK-trees or bounded edit-distance scans' }
      ],
      sources: [
        { title: 'Burkhard, Keller — Some approaches to best-match file searching (CACM 1973)', where: 'the BK-tree and the triangle-inequality argument' },
        { title: 'Schulz, Mihov — Fast string correction with Levenshtein automata (IJDAR 2002)', where: 'the automaton construction' },
        { title: 'Navarro — A guided tour to approximate string matching (ACM CS 2001)', where: 'the survey, including n-gram filtering' },
        { title: 'Manning, Raghavan, Schütze — Introduction to Information Retrieval, chapter 3', where: 'wildcard and spelling correction in a search engine' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));

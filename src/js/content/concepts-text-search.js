/** Concepts for the index and search sections (M06.7-M06.9). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'burrows-wheeler': [
      {
        term: 'The last column of the sorted rotations',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["write every rotation<br/>of the text"] --> B["sort them"]',
            '    B --> C["take the LAST character<br/>of each row"]',
            '    C --> D["that column is the transform"]',
            '    D --> E["rows sharing a prefix are adjacent,<br/>so their preceding characters<br/>end up next to each other"]'
          ].join('\n'),
          caption: 'Sorting by what FOLLOWS a character groups the characters that PRECEDE similar contexts — which is why the output has long runs and the input did not.'
        },
        plain: 'Sort every rotation of the text and take the final character of each.',
        formal: 'bwt[i] = T[(sa[i] − 1) mod n]',
        readAs: 'Row i of the transform is the character just before the i-th smallest suffix, wrapping round ' +
          'to the end of the text when that suffix starts at position 0. The mod is that wrap-around.',
        detail: [
          'That is the definition, and no implementation uses it — building the matrix costs n² ' +
            'characters.',
          'The suffix array gives the same column directly. Row i of the sorted rotation matrix is ' +
            'the suffix starting at sa[i], so its last character is the one just before that ' +
            'suffix.',
          'Which means the transform is a by-product of a structure you were probably building ' +
            'anyway, computed in one pass over the array.',
          'Showing the matrix and then discarding it is the point: the definition and the ' +
            'implementation are different objects.'
        ],
        example: 'mississippi transforms to ipssm␀pissii — 11 characters, one pass over the array.'
      },
      {
        term: 'The LF mapping',
        plain: 'The i-th occurrence of a character in the last column is the i-th in the first.',
        formal: 'LF(row) = C[bwt[row]] + rank(bwt[row], row)',
        readAs: 'To step backwards one character: take the character in this row, look up where its block of ' +
          'rows begins, and add how many times that character has appeared above. It lands you on the ' +
          'row for the previous position, which is the whole trick of the index.',
        detail: [
          'This is why a transform that looks destructive is reversible.',
          'Rotations beginning with the same character sort together, and among those the order is ' +
            'decided by what follows. That is exactly the order in which those characters appear ' +
            'in the last column of the rows they came from.',
          'So the k-th "i" in the last column and the k-th "i" in the first column are the same ' +
            'occurrence.',
          'The first column never has to be stored: it is just the sorted characters, summarised ' +
            'by a count table of alphabet size.'
        ],
        example: 'C[c] + rank(c, row) is two lookups, and it is the entire inverse.'
      },
      {
        term: 'Inverting without the matrix',
        plain: 'Start at the sentinel\'s row and follow LF backwards, one character per step.',
        formal: 'n LF steps, O(1) memory beyond the index',
        detail: [
          'Row 0 of the sorted matrix is the rotation beginning with the sentinel, so its last ' +
            'character is the text\'s last character.',
          'Each LF step moves to the row holding the rotation one character earlier, so reading ' +
            'the last column at each row recovers the text from the end.',
          'The step order matters: read first, then follow.',
          'Following first drops the final character and shifts everything by one. That is the ' +
            'off-by-one that makes the round-trip fail on every input and is invisible on none.'
        ],
        example: 'mississippi round-trips in 11 LF steps and zero rotation rows.'
      },
      {
        term: 'Runs are where the compression comes from',
        plain: 'The transform groups equal characters, and repetitive text groups hardest.',
        formal: 'runs(bwt) ≪ n for structured text; ≈ n for random text',
        readAs: 'On real text the transform collapses into far fewer runs of repeated characters ' +
          'than there are characters — the ≪ is "much less than". That is what makes it ' +
          'compressible. On random data it does not, and the index gives you nothing.',
        detail: [
          'Rotations that begin the same way sort together, so the characters that preceded those ' +
            'contexts land next to one another.',
          'In English "he" is usually preceded by "t", so the block of rows beginning "he" ' +
            'contributes a run of t\'s.',
          'That is the entire compression argument, and it is a property of the text rather than ' +
            'of the coder.',
          'Log lines give one run per 16 characters, DNA one per 4, and random 26-letter text one ' +
            'per 1.0. The transform does nothing for data that has no structure to expose.'
        ],
        example: 'logs: 304 runs over 4 951 characters. Random text: 3 855 over 4 000.'
      },
      {
        term: 'Backward search',
        plain: 'Read the pattern right to left, narrowing the suffix-array range as you go.',
        formal: 'first = C[c] + rank(c, first); last = C[c] + rank(c, last)',
        readAs: 'Extending a search by one character to the left narrows the row range: both ends are ' +
          'remapped by the same rule, so the range either shrinks or becomes empty. Empty means the ' +
          'pattern is not in the text.',
        detail: [
          'The range being maintained is the set of rows whose suffix begins with the part of the ' +
            'pattern read so far.',
          'Prepending a character to that pattern maps the range through LF, which is two rank ' +
            'queries and two table lookups.',
          'That is independent of the text length, and independent of how many occurrences there ' +
            'are.',
          'It is the property that makes an FM-index a self-index rather than a compression ' +
            'scheme: the count comes out of the compressed representation directly, with no ' +
            'decompression at any point.'
        ],
        example: '"issi" is four steps and eight rank queries, over a text of any size.'
      },
      {
        term: 'Rank is the whole cost',
        plain: 'Everything above is two rank queries per character, so rank decides the performance.',
        formal: 'rank(c, i) = occurrences of c in bwt[0 … i)',
        readAs: 'How many times character c appears in the rows above row i, not counting row i itself — the ' +
          'round bracket at the end excludes it. Answering this quickly is what the checkpoints are ' +
          'for.',
        detail: [
          'A rank query answered by scanning is O(n) and costs no space. Answered from a full ' +
            'table it is O(1) and costs |Σ|·n integers.',
          'The practical answer is checkpoints every B positions plus a short scan. That is O(B) ' +
            'time and |Σ|·n/B space: one dial with the two extremes at its ends.',
          'Every FM-index exposes that dial, and choosing it is the entire engineering of the ' +
            'structure. The algorithms above do not change at all as it moves.'
        ],
        example: 'DNA 4 000: checkpoints every 8 cost 10 020 bytes; every 128 cost 640.'
      },
      {
        term: 'Locating costs more than counting',
        plain: 'Counting is free; reporting positions needs a sampled suffix array.',
        formal: 'locate(row) = walk LF until a sampled row, then add the steps',
        detail: [
          'Backward search gives a range of rows, and a row is not a position. Recovering the ' +
            'position means walking LF until a row whose position was sampled.',
          'So counting occurrences is O(m) and locating them is O(m + occ · sampleRate), and the ' +
            'sample rate is a second space/time dial.',
          'This is why "how many" and "where" have genuinely different costs in a self-index.',
          'That is unlike every other index in this milestone, and worth knowing before promising ' +
            'a query plan.'
        ],
        example: 'sampling every 16th position costs n/16 integers and bounds the walk at 16 steps.'
      },
      {
        term: 'The index is the compressed text',
        plain: 'The structure replaces the text rather than accompanying it.',
        formal: 'bwt + checkpoints + samples, and the original is recoverable',
        detail: [
          'A suffix array is 4 bytes per character *plus* the text.',
          'An FM-index holds the transformed text, which is the same length and more compressible, ' +
            'plus two sampled structures whose size you choose.',
          'The original text is recoverable from it, so nothing else needs storing.',
          'Measured on DNA that is 1.9 bytes per character against the suffix array\'s 9, which is ' +
            'the difference between a genome fitting in memory and not. That is the whole reason ' +
            'read aligners are built on this rather than on a suffix array.'
        ],
        example: 'DNA 4 000: 1.88 bytes per character against a suffix array plus LCP at 9.'
      }
    ],

    'inverted-indexes': [
      {
        term: 'Term to sorted document list',
        plain: 'Invert the document-to-terms map, and keep each posting list sorted by id.',
        formal: 'postings[t] = sorted [ d : t ∈ d ]',
        readAs: 'Every term maps to the sorted list of documents containing it. The colon reads "such that", ' +
          'and sorted is not a detail — it is what makes two lists intersectable in one pass.',
        detail: 'The structure takes one sentence and the engineering takes a career, which is worth ' +
          'saying plainly. Sorted order is not incidental: it makes an AND query a merge rather ' +
          'than a set intersection, it makes gaps small enough to compress, and it lets a query ' +
          'stop early. Every technique in the section depends on it, so an implementation that ' +
          'appends postings unsorted has given up all of them at once for a build-time convenience.',
        example: '5 000 documents over a 400-term vocabulary produce 50 995 postings.'
      },
      {
        term: 'Shortest list first',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["intersect: rare term ∩ common term"] --> B{"which one do you walk?"}',
            '    B --> C["start from the rare list —<br/>the result can only be smaller"]',
            '    B --> D["start from the common list —<br/>you walk millions of postings<br/>to discard almost all of them"]',
            '    C --> E["same answer, and the work is<br/>bounded by the smallest list"]'
          ].join('\n'),
          caption: 'An intersection can never be larger than its smallest input, so the smallest input is the one that should drive the loop.'
        },
        plain: 'Intersect the rarest term first, because the result can only shrink.',
        formal: 'order the lists by length before folding',
        detail: 'It is free, it requires nothing from the data structure, and it is the single ' +
          'largest win available in query processing. Each intersection produces a result no longer ' +
          'than its shorter input, so starting small keeps every subsequent step small; starting ' +
          'with two common terms does the most expensive merge first and then repeats the work. ' +
          'Any effort spent on a cleverer merge before this reordering is in place is measuring the ' +
          'wrong thing.',
        example: 'a query on the rarest and commonest terms costs 185 comparisons rearranged, 4 179 as written.'
      },
      {
        term: 'Galloping search',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["looking for a target far ahead"] --> B["probe 1, 2, 4, 8, 16 … positions on"]',
            '    B --> C["the first probe that overshoots<br/>brackets the answer"]',
            '    C --> D["binary-search inside that bracket"]',
            '    D --> E["cost depends on how far you jumped,<br/>not on how long the list is"]'
          ].join('\n'),
          caption: 'It is the right search when the answer is probably close: a linear scan pays for the distance and a binary search pays for the whole list, while this pays for the log of the distance.'
        },
        plain: 'Probe 1, 2, 4, 8 … positions ahead, then binary-search the bracket you overshot.',
        formal: 'O(m log(n/m)) for lists of length m ≪ n',
        readAs: 'Intersecting a short list of length m against a much longer one of length n costs about m ' +
          'galloping searches, each log of the ratio between the two. Far better than reading all n.',
        detail: 'A linear merge costs the sum of the list lengths whatever their shapes, which is ' +
          'wasteful when one list is rare and one is common — the common list is walked in full to ' +
          'find a handful of matches. Galloping finds each target in the long list in logarithmic ' +
          'time proportional to the *gap* rather than to the list, so a 10-against-100 000 query ' +
          'costs 245 comparisons instead of 90 566. The bound degrades gracefully to O(n) as the ' +
          'lists equalise, which is exactly when a plain merge is better anyway.',
        example: '10 against 100 000: linear 90 566, skip 1 749, galloping 245.'
      },
      {
        term: 'Every strategy loses somewhere',
        plain: 'At equal list lengths, galloping and skip pointers both cost more than a linear merge.',
        formal: 'crossover near m ≈ n / 10 in the measured sweep',
        detail: 'The advice "use galloping" is right on one side of a crossover and wrong on the ' +
          'other, and the crossover is a property of the query rather than of the corpus. At 50 000 ' +
          'against 100 000 the linear merge does 124 751 comparisons and galloping does 157 906, ' +
          'because every probe is overhead when the next match is one step away. A system that ' +
          'picks a strategy per query from the list lengths beats one that picks a strategy at ' +
          'design time, and the numbers to make that decision are already in the index.',
        example: '50 000 against 100 000: linear 124 751, skip 182 123, galloping 157 906.'
      },
      {
        term: 'Gaps, not ids',
        plain: 'Store the difference between consecutive postings, because differences are small.',
        formal: 'gap[i] = id[i] − id[i − 1], with gap[0] = id[0]',
        readAs: 'Store the difference from the previous id rather than the id itself. Because the list is ' +
          'sorted the gaps are small positive numbers, and small numbers compress.',
        detail: 'A raw document id needs 32 bits whatever the corpus. The gap between consecutive ' +
          'postings of a common term is small — a term in half the documents has an average gap of ' +
          '2 — and small numbers can be coded in far fewer bits. That makes the compression ratio a ' +
          'property of each term\'s *density* rather than of the encoder: dense lists compress ' +
          'enormously and the long tail of rare terms barely compresses at all, so a single ' +
          '"bits per posting" figure is an average over a very wide spread.',
        example: '50 995 postings: 32 bits raw, 8.65 with variable-byte, 6.69 with Simple-9.'
      },
      {
        term: 'Variable-byte and word-aligned coding',
        plain: 'Seven payload bits per byte with a continuation flag, or several values packed per word.',
        formal: 'varbyte: 1 byte for gaps ≤ 127; Simple-9: 28 one-bit values or 1 twenty-eight-bit value per word',
        detail: 'Variable-byte is byte-aligned, trivially decodable and wastes one bit in eight. ' +
          'Simple-9 packs as many equal-width values as fit into a 32-bit word with a four-bit ' +
          'selector, so a run of tiny gaps costs about a bit each — better compression and a ' +
          'branchier decoder. Which one wins is a decoding-speed question rather than a size ' +
          'question, and it is decided by how much of the query budget is spent decompressing ' +
          'rather than by the ratio.',
        example: 'the same postings: 55 156 bytes with variable-byte, 42 644 with Simple-9.'
      },
      {
        term: 'Positions are a separate index',
        plain: 'Phrase queries need where-in-the-document, and that roughly doubles the index.',
        formal: 'positional index: one list per (term, document) pair',
        detail: 'A boolean AND says the terms co-occur in a document; a phrase query says they are ' +
          'adjacent, in order, and there is no way to answer that from document ids alone. The ' +
          'positional lists come out larger than the compressed postings themselves — 60 000 bytes ' +
          'against 55 156 here — and they are consulted only for phrase queries, which is why ' +
          'phrase search is a feature you enable rather than one you always have, and why turning ' +
          'it on changes the index size rather than the query code.',
        example: 'positions cost 60 000 bytes against 55 156 for the postings they annotate.'
      },
      {
        term: 'Construction is an external merge',
        plain: 'Sort each block that fits in memory, spill it, then k-way merge the runs.',
        formal: 'one pass over the input, one pass over each run',
        detail: 'The index for a real corpus does not fit in memory during construction, which makes ' +
          'building it a sorting problem rather than a data-structure problem. Emitting (term, ' +
          'document) pairs, sorting each block, writing it out and merging the sorted runs is the ' +
          'standard shape, and it is why index build time is dominated by I/O and why block size is ' +
          'the tuning knob. The same shape appears in every log-structured store, which is not a ' +
          'coincidence — both are appending sorted runs and merging them later.',
        example: '5 000 documents in blocks of 500 produce 10 runs merged into 50 995 pairs.'
      }
    ],

    'autocomplete-and-fuzzy': [
      {
        term: 'The triangle inequality does the pruning',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["query is distance d from this node"] --> B["looking for matches<br/>within k of the query"]',
            '    B --> C["only children keyed between<br/>d − k and d + k can qualify"]',
            '    C --> D["every other branch is<br/>provably too far"]',
            '    D --> E["and that proof IS<br/>the triangle inequality"]'
          ].join('\n'),
          caption: 'The pruning is not a heuristic, it is a theorem. Swap in a similarity that breaks the inequality and the tree silently stops returning correct answers.'
        },
        plain: 'If the query is distance d from a node, only children keyed d − k … d + k can match.',
        formal: 'd(q, c) ≥ |d(q, n) − d(n, c)|',
        readAs: 'The triangle inequality, rearranged: the distance from the query to a candidate is at least ' +
          'the gap between their two distances to any node you have already measured. The bars are ' +
          'absolute value — sign discarded — and that inequality is what lets you skip a subtree ' +
          'without looking in it.',
        detail: 'A BK-tree keys each child by its distance to its parent, and the triangle inequality ' +
          'turns that key into a bound: a child at distance j from the node cannot be closer than ' +
          '|d − j| to a query at distance d, so subtrees outside the window are provably empty and ' +
          'are skipped without a single distance computation. That is the entire structure — there ' +
          'is no balancing, no ordering, nothing else — and it is why the choice of metric is a ' +
          'correctness question rather than a quality one.',
        example: 'a distance-1 query over 883 words visits 289 nodes and computes 289 distances.'
      },
      {
        term: 'A non-metric silently loses answers',
        plain: 'Swap in a similarity that breaks the triangle inequality and the pruning drops matches.',
        formal: 'pruning is sound only if d is a metric',
        detail: 'This is the failure mode worth naming loudly, because it produces no error. Many ' +
          'attractive similarity measures — normalised scores, weighted edits with asymmetric ' +
          'costs, anything divided by length — are not metrics, and dropping one into a BK-tree ' +
          'gives a structure that still builds, still answers, and quietly omits correct results. ' +
          'The only way to notice is to compare against brute force, which is why the check belongs ' +
          'in the test suite rather than in a code review.',
        example: 'Levenshtein over the word list satisfies the inequality on every triple checked.'
      },
      {
        term: 'A Levenshtein automaton carries the DP row',
        plain: 'Walk the dictionary trie with the dynamic-programming row as the state.',
        formal: 'row_{next}[i] = min(row_next[i−1] + 1, row[i] + 1, row[i−1] + cost)',
        readAs: 'Each cell of the edit-distance table is the cheapest of three moves: insert, delete, or ' +
          'substitute. cost is 0 when the two characters match and 1 when they do not.',
        detail: 'The classical construction builds an explicit DFA for "within k edits of this ' +
          'query" and intersects it with the dictionary. Carrying the DP row down the trie is the ' +
          'same machine with its state written out rather than numbered, and it is far easier to ' +
          'get right. The prune is that the row\'s minimum can never decrease as the walk goes ' +
          'deeper, so a subtree whose row minimum already exceeds the budget cannot contain a ' +
          'match and is cut whole.',
        example: 'a distance-1 query cuts most of the 2 562-node trie and visits 291 nodes.'
      },
      {
        term: 'Exactness is a property worth measuring',
        plain: 'Two of the three back-ends return every match; one returns a subset.',
        formal: 'recall = |returned ∩ correct| / |correct|',
        readAs: 'Of the answers that were genuinely correct, what fraction did you return? The ∩ is the ' +
          'overlap of the two sets and the bars are "how many".',
        detail: 'A fuzzy search that returns 30% of the matches looks exactly like one that returns ' +
          'all of them: the results are relevant, the latency is good, and the missing answers are ' +
          'invisible from the outside. The only signal is a user saying "it did not find my thing", ' +
          'which nobody files as a bug. So recall is the first column to read and the first thing ' +
          'to ask a library for — and a back-end that cannot state its recall is stating that ' +
          'nobody measured it.',
        example: 'distance 1 from "cat": BK-tree and automaton return all 7; the n-gram index returns 2.'
      },
      {
        term: 'The n-gram threshold is a heuristic',
        plain: 'Requiring enough shared n-grams is fast, and short words within budget may share none.',
        formal: 'threshold ≈ |grams| − 1 − (k − 1)·size',
        readAs: 'How many q-grams two strings must share to be within k edits: the number in the query, less ' +
          'one, less the grams each edit can destroy. If it comes out zero or negative the filter ' +
          'rejects nothing and you are paying for it for no reason.',
        detail: 'Indexing every word by its character n-grams and retrieving those sharing enough of ' +
          'them is the cheapest fuzzy search there is — two orders of magnitude fewer visits than ' +
          'an exact method. The rule for how many is enough is derived from how many n-grams k ' +
          'edits can destroy, and it is exact only for long words: a four-letter word has five ' +
          'bigrams and two edits can destroy all of them, so the correct threshold would be zero, ' +
          'which retrieves the whole index. Every practical threshold is therefore a recall ' +
          'decision in disguise.',
        example: '"recieve" within 2 edits: the index verifies 0 candidates and misses the 1 answer.'
      },
      {
        term: 'Subtree maxima make top-k a best-first search',
        plain: 'Store the best score anywhere below each node, and abandon subtrees that cannot win.',
        formal: 'skip a subtree when best(subtree) ≤ score of the current k-th answer',
        detail: 'Without them, the only correct way to return the eight best completions of a prefix ' +
          'is to enumerate the whole subtree and sort it — which for a common prefix means ' +
          'enumerating most of the dictionary to return eight rows. With one number per node the ' +
          'walk becomes a best-first search that visits the promising branches first and cuts the ' +
          'rest, and the cost drops from the size of the subtree to something close to k. The ' +
          'number is maintained on insert and costs one comparison per node on the path.',
        example: 'the top 8 completions of "con" cost 38 node visits and skip 3 subtrees.'
      },
      {
        term: 'Prefix search and fuzzy search are different queries',
        plain: 'Completion walks down from a prefix; fuzzy match walks the whole structure with a budget.',
        formal: 'complete(p, k) is O(k · depth); fuzzy(q, k) touches many branches',
        detail: 'A search box usually wants both and they share no machinery: completion is a ' +
          'downward walk with scores, and fuzzy match is a bounded search over the whole ' +
          'dictionary. Conflating them produces the common design error of running a fuzzy search ' +
          'on every keystroke when the user is simply typing a prefix that exists — orders of ' +
          'magnitude more work for an answer the prefix walk already had. The rule is to try the ' +
          'prefix first and fall back to fuzzy only when it returns too little.',
        example: '"con" has 22 completions in 38 visits; a distance-1 fuzzy search visits 289.'
      },
      {
        term: 'Visits are not comparable across back-ends',
        plain: 'A BK-tree visit is a distance computation; a trie visit is a pointer step.',
        formal: 'cost = visits × cost-per-visit, and the second factor differs by an order of magnitude',
        detail: 'The visit counts in the comparison table are the honest measure each structure ' +
          'exposes, and reading them as a ranking is a mistake: a BK-tree visit computes a full ' +
          'edit distance between two words, an automaton visit advances one DP row by one ' +
          'character, and an n-gram visit verifies one candidate. So the automaton visiting more ' +
          'nodes than the BK-tree does not make it slower. The columns are there to show the shape ' +
          'of the search, and a wall-clock comparison is a different measurement that has to be ' +
          'made separately.',
        example: 'distance 1 from "cat": BK-tree 289 visits, automaton 291 — different units.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));

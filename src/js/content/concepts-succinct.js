/** Concepts for the succinct sections (M09.7-M09.9). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'rank-and-select': [
      {
        term: 'The succinct model: close to the minimum, still fast',
        plain: 'Store about as many bits as information theory demands, and keep queries at their usual cost.',
        formal: 'Z + o(Z) bits, where Z is the information-theoretic minimum',
        readAs: 'The structure uses the theoretical minimum number of bits, plus an overhead that becomes a ' +
          'vanishing fraction of it as the data grows — that is what little-o means here. Not "small ' +
          'overhead": overhead that disappears relative to the data.',
        detail: [
          'The definition is precise and it is worth holding onto, because "compressed" and ' +
            '"succinct" are different promises.',
          'A compressed structure is small and has to be decompressed to be used.',
          'A succinct one is small *and* supports its operations directly on the small form.',
          'The o(Z) is the index, and it is not zero. Claiming a succinct structure has no overhead ' +
            'is the most common way to misrepresent one.'
        ],
        example: 'A 65 536-bit vector costs 8 192 bytes of data and 646 bytes of index: 7.9% overhead.'
      },
      {
        term: 'Rank in three lookups and a popcount',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["how many 1s before position i?"] --> B["add the running count<br/>at the superblock"]',
            '    B --> C["add the running count<br/>at the block inside it"]',
            '    C --> D["popcount the partial word"]',
            '    D --> E["constant time, and the index<br/>costs a fraction of the bits<br/>it indexes"]'
          ].join('\n'),
          caption: 'Two levels of precomputed counts plus one hardware instruction. Almost every succinct structure is built on this operation being genuinely O(1).'
        },
        plain: 'Precompute a running count every superblock and every block, then popcount the partial word.',
        formal: 'rank1(i) = superblock[i/S] + block[i/B] + popcount(word & mask)',
        readAs: 'Counting the 1 bits before position i is three lookups added together: a coarse total, a ' +
          'finer one within it, and a single popcount for the last word. Constant time, and the tables ' +
          'are what the extra bits are spent on.',
        detail: [
          'The two levels exist to keep both tables small.',
          'Absolute counts every 2 048 bits are 32 bits each and cost 1.6%. Relative counts every ' +
            '256 bits fit in 16 bits and cost 6.3%.',
          'One level alone forces a choice between a huge table and a long scan; two levels make ' +
            'the total under 8% with no loop at all.',
          'The tables are the reason it is constant time, and the section reports their size rather ' +
            'than mentioning only the answer.'
        ],
        example: '3.0 table lookups and 3.5 word popcounts per query, whatever the vector length.'
      },
      {
        term: 'Select has no such trick',
        plain: 'Finding the k-th one is a search, not an index computation.',
        formal: 'binary search over the block table, then a bounded scan inside one block',
        detail: [
          'Rank is a function of a position and the tables are indexed by position, so the lookup ' +
            'is arithmetic.',
          'Select asks the inverse question and the tables are not indexed by count, so something ' +
            'has to search.',
          'A binary search over blocks is O(log n) and bounds the final scan to one block. Sampling ' +
            'every k-th one bit instead turns it into a bounded walk.',
          'Both are implemented here, and the honest summary is that select is the expensive ' +
            'primitive.'
        ],
        example: '8.0 binary-search steps per select on 65 536 bits, 12.0 on a million.'
      },
      {
        term: 'The seams are where index arithmetic breaks',
        plain: 'A rank at a position that is exactly a block or superblock boundary is the case that gets written wrong.',
        formal: 'both tables carry a sentinel entry, and a query at the very end can index both',
        detail: [
          'This is not a hypothetical.',
          'The implementation here initially double-counted a rank at the end of a vector whose ' +
            'length was an exact multiple of the block size.',
          'The sentinel holding the final superblock total and the sentinel holding that ' +
            'superblock\'s relative total were added together.',
          'Every value in the vector was correct; only the total was wrong.',
          'All-zero, all-one, single-bit and boundary-aligned inputs belong in the test suite for ' +
            'exactly this reason.'
        ],
        example: 'rank1(4096) on 4 096 ones returned 6 144 until the boundary case was handled.'
      },
      {
        term: 'Sometimes an array of positions is smaller',
        plain: 'At low density, storing where the ones are beats storing a bit for every position.',
        formal: 'positions cost 32m bits; the vector costs n(1 + overhead)',
        readAs: 'Storing m positions outright costs 32 bits each; storing a bit per slot costs a bit per slot ' +
          'plus the index overhead. Which is cheaper depends entirely on how dense the set is.',
        detail: [
          'The crossover is real and the section refuses to hide it.',
          'At 50% density a bit vector with its index is nearly fifteen times smaller than a list ' +
            'of positions. At 2% density the list of positions is smaller.',
          '"Succinct" is a claim relative to a model, and the model here is a dense bit string.',
          'So choosing the representation means knowing the density, which is the same lesson the ' +
            'sparse-versus-dense choice teaches in 9.9.'
        ],
        example: '65 536 bits at 50%: 8 838 bytes against 130 332 for positions. At 2%: 8 838 against 4 984.'
      },
      {
        term: 'Elias-Fano: monotone sequences in about 2 + log(u/n) bits each',
        plain: 'Split each value into high and low bits; store the high bits in unary in a bit vector and pack the low ones.',
        formal: 'n(2 + ⌈log₂(u/n)⌉) bits, independent of the universe size beyond the ratio',
        readAs: 'Elias-Fano needs about 2 bits per element plus the log of how sparse the set is. The ' +
          'universe can be enormous — what costs you is the ratio of universe to elements, not the ' +
          'universe itself.',
        detail: [
          'The high-bit vector holds exactly n ones and at most n zeros, so it is 2n bits however ' +
            'large the universe is.',
          'That is why the cost depends on u/n rather than on u.',
          'Recovering a value is one `select1` on that vector plus a read of the packed low bits, ' +
            'so the structure is random access rather than a stream.',
          'It is what an inverted index actually stores its posting lists in.'
        ],
        example: '5 000 increasing values under a million: 9.5686 bits each against a bound of 9.6496, and 3.34× smaller than 32-bit integers.'
      },
      {
        term: 'Rank and select are the primitives everything else is built from',
        plain: 'Once these two are fast, trees, tries and sequences all become bit strings.',
        formal: 'LOUDS navigation, wavelet trees and FM-indexes are all rank/select over bit vectors',
        detail: [
          'This is the reason the section comes before the structures that use it.',
          'A succinct tree is not a clever tree encoding plus a clever navigation algorithm.',
          'It is a bit string plus rank and select, and the navigation is two calls.',
          'The same is true of a wavelet tree and of the FM-index in M06. Getting these two right ' +
            'and knowing what they cost is most of the work in the whole field.'
        ],
        example: 'Every operation in 9.8 is one or two calls to the functions in this section.'
      },
      {
        term: 'Broadword popcount, and why it is a loop-free line',
        plain: 'Count the set bits of a 32-bit word with five shifts, four masks and a multiply.',
        formal: 'the SWAR trick: sum bits pairwise, then in nibbles, then in bytes, then multiply to sum the bytes',
        detail: [
          'Writing it out matters because the whole constant-time claim rests on the last step ' +
            'being a fixed number of instructions rather than a loop over bits.',
          'The multiply-by-0x01010101 trick sums the four byte counts into the top byte in one ' +
            'operation.',
          'That is the step people usually skip when reimplementing from memory.',
          'On real hardware this is one instruction, and the algorithm is designed around that fact.'
        ],
        example: 'Five shifts and one multiply per word; a rank query does 3.5 of them.'
      }
    ],

    'succinct-trees': [
      {
        term: 'Two bits per node, against forty-eight bytes',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["a pointer tree: an object per node,<br/>with child references"] --> B["tens of bytes each"]',
            '    C["a succinct tree: about<br/>2 bits per node"] --> D["the shape encoded as a bit string"]',
            '    B --> E["a factor of a hundred or more"]',
            '    D --> E',
            '    E --> F["and navigation is still O(1),<br/>via rank and select"]'
          ].join('\n'),
          caption: 'The structure stops being pointers and becomes a bit string with an index on it. That is what lets a tree of billions of nodes stay in memory.'
        },
        plain: 'An ordinal tree of n nodes needs about 2n bits; a pointer tree costs a node object per node.',
        formal: 'the number of ordinal trees on n nodes is the Catalan number, so log₂ C(n) ≈ 2n bits',
        readAs: 'Count how many distinct trees of n nodes exist, take the log base 2, and you have the fewest ' +
          'bits any encoding could use. It comes to about 2 bits per node — which is the target every ' +
          'succinct tree encoding is measured against.',
        detail: [
          'The information-theoretic argument is what makes 2 bits the target rather than a lucky ' +
            'encoding.',
          'There are Catalan-many shapes, and naming one of them takes about 2n bits however you ' +
            'write it down.',
          'Both encodings in this section hit that bound.',
          'The difference against a pointer representation is not a percentage. It is the ' +
            'difference between an index that fits in memory and one that does not.'
        ],
        example: '5 000 nodes: 1 358 bytes as LOUDS including its index, against 240 000 as pointers - 177× less.'
      },
      {
        term: 'LOUDS: level-order unary degree sequence',
        plain: 'Write, for each node in breadth-first order, one 1 per child followed by a 0.',
        formal: 'B = 10 · (1^deg(v) 0 for each v in level order)',
        readAs: 'Write the tree as bits: for every node in level order, one 1 per child followed by a 0. The ' +
          'superscript means repetition. Two bits per node, and navigation becomes rank and select over ' +
          'that string.',
        detail: [
          'The encoding has two indexes hiding in it, and seeing them is what makes the navigation ' +
            'obvious.',
          'The k-th one in the whole string is node k, because every node except the super-root is ' +
            'pointed at by exactly one 1.',
          'Node v\'s children are described in the run that starts just past the v-th zero, because ' +
            'the zeros terminate the blocks in the same order.',
          'Both facts are one rank/select call.'
        ],
        example: 'firstChild(v) = rank1(select0(v) + 1) + 1, and parent(v) = rank0(select1(v)).'
      },
      {
        term: 'Balanced parentheses: depth-first, open and close',
        plain: 'Write ( on the way down and ) on the way up; subtree size and depth fall out immediately.',
        formal: 'subtree size = (close − open + 1) / 2; depth = excess at that position',
        readAs: 'In a balanced-parentheses encoding, a subtree\'s size is how far apart its brackets sit, ' +
          'halved. Its depth is how many brackets are still open at that point.',
        detail: [
          'BP and LOUDS encode the same tree in the same 2n bits, and are good at different ' +
            'questions.',
          'BP gives subtree size and depth directly, which LOUDS does not, and it is the encoding ' +
            'of choice when those matter.',
          'The catch is that navigation needs `findClose`, and that is only constant time with a ' +
            'range-min-max tree over the excess.',
          'The implementation here scans, and says so rather than quoting a bound it did not build.'
        ],
        example: 'Exactly 2 bits per node, subtree size of the root = 5 000, and a findClose that scans.'
      },
      {
        term: 'Navigation becomes arithmetic, not dereferencing',
        plain: 'There are no pointers to follow; a child is a position computed from two table lookups.',
        formal: 'each of firstChild, nextSibling and parent is one select plus one rank',
        detail: [
          'The consequence for real systems is about memory rather than instruction count.',
          'A pointer chase is a cache miss whose address depends on the previous load.',
          'A rank/select pair reads two small tables that stay resident, and one word of the bit ' +
            'string.',
          'On a structure that no longer fits in cache as pointers but does fit as bits, the ' +
            'succinct version is faster despite doing more arithmetic. That is the whole reason to ' +
            'accept the complexity.'
        ],
        example: '15 000 navigation calls over a 5 000-node tree cost 14 999 selects and 9 998 ranks and no pointer at all.'
      },
      {
        term: 'The values still have to go somewhere',
        plain: '2n bits encodes the *shape*; the payload at each node is a separate array.',
        formal: 'total = shape bits + n · sizeof(value)',
        detail: [
          'This is the honest qualifier on the headline figure, and leaving it out is how the 177× ' +
            'becomes a misrepresentation.',
          'The succinct encoding removes the *structure* cost: the child arrays and the object ' +
            'headers.',
          'It does nothing about the data itself, which is stored in level order or preorder and ' +
            'indexed by the same node numbers.',
          'When the payload dominates, the saving is proportionally smaller and still worth having.'
        ],
        example: '5 000 nodes: 1 358 bytes of shape and 40 000 bytes of 8-byte values, against 240 000 for pointers.'
      },
      {
        term: 'Wavelet trees: the same idea over an alphabet',
        plain: 'At each level record which half of the alphabet each symbol went to, and recurse on rank.',
        formal: 'n log₂ σ bits; access, rank and select in O(log σ) bit-vector operations',
        readAs: 'A wavelet tree costs the same bits as storing the text: n characters times the ' +
          'bits per character, σ being the alphabet size. It answers rank and select in a number ' +
          'of steps set by the alphabet, not by the text length.',
        detail: [
          'A bit vector answers rank and select for a two-symbol alphabet.',
          'A wavelet tree lifts that to any alphabet by splitting it in half at each level.',
          'A symbol\'s path through the levels *is* its binary representation, and the bit vectors ' +
            'record which way each occurrence went.',
          'The size is exactly what an uncompressed array of log σ-bit symbols would cost, and the ' +
            'queries it answers are far larger.'
        ],
        example: '4 000 symbols over a 256-letter alphabet: exactly 8 bits per symbol, which is log₂ 256.'
      },
      {
        term: 'Range quantiles for free',
        plain: 'The k-th smallest symbol in a range is one descent, counting how many went left at each level.',
        formal: 'at each level, compare k against the number of zeros in the mapped range',
        detail: [
          'This is the query that justifies the structure.',
          'The same descent that answers access also answers "the median of positions 400 to 900". ' +
            'The bit vector at each level lets the range be mapped down into the correct half in ' +
            'O(1).',
          'It is the third structure in this platform to answer a range order statistic, after ' +
            'M08\'s merge-sort tree and 9.3\'s persistent segment tree.',
          'It is the one that also stores the sequence.'
        ],
        example: '16 rank calls per range-quantile query over 4 000 symbols: two per level, eight levels.'
      },
      {
        term: 'Where succinct actually pays',
        plain: 'When the structure has to be resident and the pointer version does not fit.',
        formal: 'the trade is instruction count against cache and memory footprint',
        detail: [
          'Succinct structures are not faster in a microbenchmark on a small input.',
          'They do more work per operation, and win only when the alternative is a cache miss or a ' +
            'disk read.',
          'That makes them a systems decision rather than an algorithmic one.',
          'They are what genome indexes, full-text search engines and on-device dictionaries are ' +
            'built from. They are the wrong choice for a tree of five thousand nodes that was ' +
            'never going to be a problem.'
        ],
        example: 'The 177× applies to the shape; it becomes decisive at the scale where 240 MB and 1.4 MB differ.'
      }
    ],

    'compressed-bitmaps': [
      {
        term: 'A bitmap index is a set per value',
        plain: 'For each distinct value, one bit per row saying whether that row has it.',
        formal: 'a query becomes a boolean expression over bit vectors',
        detail: 'The appeal is that AND, OR and NOT over sets become machine words rather than iteration, which ' +
          'is why analytical databases and search engines reach for them. The problem is the obvious one: a bit ' +
          'per row per value is enormous when the values are many or the sets are sparse, and every compressed ' +
          'bitmap scheme is an answer to that. Which answer is right depends entirely on what the sets look ' +
          'like.',
        example: '20 000 values spread over five million: 630 784 bytes as a plain bitmap, 41 232 as Roaring.'
      },
      {
        term: 'Run-length coding, and its pathology',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["long runs of 0s or 1s"] --> B["packed into fill words —<br/>excellent compression"]',
            '    C["bits scattered evenly,<br/>one every few words"] --> D["no run ever forms"]',
            '    D --> E["every word stays literal,<br/>plus per-word overhead"]',
            '    E --> F["so the index is LARGER<br/>than the raw bitmap"]'
          ].join('\n'),
          caption: 'Compression that depends on clustering has a distribution that defeats it, and moderately sparse scattered data is exactly that distribution.'
        },
        plain: 'WAH and EWAH pack runs of identical words into fill words and leave the rest literal.',
        formal: 'a 32-bit word is either 31 data bits or a run length of identical words',
        detail: 'On long uniform stretches this is close to optimal and beats everything else here. The ' +
          'pathology is data that alternates: every word becomes a literal, and the encoding is *larger* than ' +
          'the uncompressed bitmap because each literal carries a tag bit. The second problem is structural - ' +
          'an operation has to walk both encodings in lockstep whatever their densities are, so a tiny set ' +
          'intersected with a huge one costs the huge one.',
        example: 'The same sparse set: 141 972 bytes as WAH against 41 232 as Roaring, from 18 838 literal words.'
      },
      {
        term: 'Roaring: pick a container per chunk',
        plain: 'Cut the universe into blocks of 65 536 and store each block as an array, a bitmap or a run list.',
        formal: 'array below 4 096 values, bitmap above, runs when they are fewer than either',
        detail: 'The crossover is arithmetic rather than a tuning constant: 4 096 sixteen-bit offsets is 8 KB, ' +
          'which is exactly what a 65 536-bit bitmap costs, so above that the bitmap is smaller and has ' +
          'constant-time membership as well. Because the decision is per chunk rather than global, one bitmap ' +
          'can be sparse in one region and dense in another and pay the right price in each - which is what ' +
          'real identifier distributions look like.',
        example: '77 array containers for a sparse set, one bitmap container for a dense one, one run container after optimisation.'
      },
      {
        term: 'The operations are why it won',
        plain: 'Every pair of container types has its own intersection path, and none of them decompresses.',
        formal: 'array ∩ bitmap probes the bitmap once per array element: O(|array|), not O(universe)',
        readAs: 'Intersecting a sparse container with a dense one costs one probe per sparse element, not one ' +
          'per possible value. Choosing the loop by container type is where Roaring gets its speed.',
        detail: 'This is the part that distinguishes Roaring from a merely smaller encoding. Intersecting a ' +
          'five-element array container with a full bitmap container touches five elements and zero bitmap ' +
          'words; the same operation on two bitmap containers touches 2 048 words and is a straight AND. A ' +
          'run-length format has no equivalent - the two encodings have to be walked together - which is why ' +
          'Roaring beats WAH on speed even where WAH is smaller.',
        example: 'A 5-element set against a 20 000-element one: 3 elements touched, 0 bitmap words.'
      },
      {
        term: 'Run containers are chosen by measurement',
        plain: 'Convert a chunk to runs only when 4 bytes per run beats what it currently costs.',
        formal: 'runBytes = 4 · runs; convert iff runBytes < min(arrayBytes, 8 KB)',
        readAs: 'Runs cost 4 bytes each — a start and a length — so switch to a run encoding only when that ' +
          'beats both of the other two representations. The container type is a measurement, not a ' +
          'guess.',
        detail: '`runOptimize` is a separate pass rather than something the insert path decides, because the ' +
          'run count is only known once the chunk is complete. Sorted identifier sets - document ids, primary ' +
          'keys, timestamps - are mostly long consecutive stretches, so it is usually a large win; on random ' +
          'data it correctly changes nothing. Calling it is a decision about the data, and the numbers are ' +
          'right there to make it with.',
        example: 'A run-heavy set: 8 208 bytes as a bitmap container, 808 after run optimisation - 10× less.'
      },
      {
        term: 'Roaring is not always smallest, and the section says so',
        plain: 'On dense uniformly random data a plain bitmap and WAH both beat it.',
        formal: 'a bitmap container costs 8 KB plus a header, which a raw bitmap does not pay',
        detail: 'Twenty thousand values in a forty-thousand-wide universe fill one chunk densely and randomly. ' +
          'Roaring stores it as a bitmap container and pays 8 208 bytes; the raw bitmap is 8 192 and WAH gets ' +
          'it to 5 164 by exploiting the fact that nothing is sparse enough to need a literal everywhere. ' +
          'Reporting only the cases a structure wins is how benchmarks mislead, and the honest summary is that ' +
          'Roaring wins on realistic identifier distributions and on operation cost, not on every input.',
        example: 'Dense random: Roaring 8 208 bytes, raw bitmap 8 192, WAH 5 164.'
      },
      {
        term: 'Sorted arrays are the baseline worth beating',
        plain: 'A sorted list of 32-bit integers is simple, cache-friendly and often good enough.',
        formal: '4 bytes per value, intersection by merge in O(n + m)',
        detail: 'Before reaching for any compressed bitmap it is worth writing down what the obvious thing ' +
          'costs, because for small or very sparse sets it wins. 20 000 values as a sorted array is 80 000 ' +
          'bytes, which beats a plain bitmap over a wide universe and loses to Roaring - and the merge-based ' +
          'intersection is the algorithm M06 measured for posting lists. The compressed forms earn their ' +
          'complexity at scale and not before.',
        example: '80 000 bytes as a sorted array against 41 232 as Roaring and 630 784 as a raw bitmap.'
      },
      {
        term: 'Static indexes: a perfect hash plus a succinct payload',
        plain: 'When the key set never changes, drop the collision handling and store the values succinctly.',
        formal: 'minimal perfect hash at ~2.5 bits per key, plus a rank-indexed payload array',
        readAs: 'About 2.5 bits per key buys a function that maps your keys onto 0 … n−1 with no collisions ' +
          'and no gaps, so the values can sit in a plain array with no keys stored at all.',
        detail: 'This is where 9.7, 9.8 and 9.9 meet. A read-only dictionary needs no probing, no tombstones ' +
          'and no load factor: a minimal perfect hash maps each key to a distinct slot in [0, n), and the ' +
          'payload lives in an array indexed by that slot, itself possibly a wavelet tree or an Elias-Fano ' +
          'sequence. The result is close to the information-theoretic size with O(1) lookup - and it is what ' +
          'ships inside spell checkers, IP routing tables and language models.',
        example: 'M03.8 built the perfect hash; this milestone built the payload representations it points into.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));

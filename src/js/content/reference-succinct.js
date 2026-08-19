/** Reference entries for the succinct sections (M09.7-M09.9). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'rank-and-select': {
      summary: 'Bit vectors with rank in three lookups and select by binary search, the two-level index that ' +
        'makes them work, and Elias-Fano coding for monotone sequences.',
      intuition: 'Precompute running counts at two granularities so a rank is arithmetic rather than a scan. ' +
        'Everything succinct is built on these two primitives, and their index is the o(Z) in "Z + o(Z) bits".',
      formulation: {
        equations: [
          {
            label: 'Rank',
            expr: 'rank1(i) = superblock[i/S] + block[i/B] + popcount(word & mask)',
            terms: [
              { sym: 'measured', meaning: '3.0 table lookups and 3.5 word popcounts per query, at any length' },
              { sym: 'S, B', meaning: '2 048 and 256 bits, giving 1.56% + 6.25% = 7.81% predicted overhead' }
            ]
          },
          {
            label: 'The index cost',
            expr: '32 bits per superblock plus 16 bits per block',
            terms: [
              { sym: 'measured', meaning: '65 536 bits: 8 192 data bytes plus 646 index - 7.9%' }
            ]
          },
          {
            label: 'Select',
            expr: 'binary search over the block table, then a bounded scan',
            terms: [
              { sym: 'measured', meaning: '8.0 steps at 65 536 bits, 12.0 at 1 048 576 - it grows where rank does not' }
            ]
          },
          {
            label: 'Elias-Fano',
            expr: 'n(2 + ⌈log₂(u/n)⌉) bits for a monotone sequence',
            terms: [
              { sym: 'measured', meaning: '5 000 values under a million: 9.5686 bits each against a bound of 9.6496' },
              { sym: 'against', meaning: '3.34× smaller than 32-bit integers, with random access preserved' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'rank1(i) counts ones strictly before i',
          why: 'Every structure built on it assumes the half-open convention.',
          breaks: 'Off-by-one errors that propagate into every LOUDS and wavelet operation at once.'
        },
        {
          name: 'select1(rank1(i) + 1) ≥ i for every i',
          why: 'The two primitives are inverses and must agree at the seams.',
          breaks: 'Navigation lands one node off, which looks like a tree-encoding bug rather than an index one.'
        },
        {
          name: 'The tables are consistent at block and superblock boundaries',
          why: 'The sentinel entries can be indexed by a query at the very end of the vector.',
          breaks: 'rank at the end returns the vector added to itself - measured as 6 144 on 4 096 ones.'
        }
      ],
      complexity: [
        { operation: 'rank1 / rank0', average: 'O(1) - 3 lookups plus ≤ 8 popcounts', worst: 'O(1)' },
        { operation: 'select1, binary search', average: 'O(log n)', worst: 'O(log n) plus one block scan' },
        { operation: 'select1, sampled', average: 'O(1) expected', worst: 'O(sample interval)' },
        { operation: 'space', average: 'n + o(n) bits - measured 7.9% overhead', worst: 'the same; it is data-independent' },
        { operation: 'Elias-Fano access', average: 'O(1) select plus one packed read', worst: 'O(log n) with a searching select' }
      ],
      failureModes: [
        {
          symptom: 'Rank is correct everywhere except at the very end of the vector.',
          cause: 'Both sentinel table entries indexed by the same query and added together.',
          fix: 'Answer a rank at the full length directly; test all-zero, all-one and boundary-aligned lengths.'
        },
        {
          symptom: 'The structure is bigger than an array of positions.',
          cause: 'Low density - a bit vector costs one bit per position whatever it says.',
          fix: 'Below about 3% density store the positions; below that *and* monotone, use Elias-Fano.'
        },
        {
          symptom: 'Select dominates the profile.',
          cause: 'It is a search, not an index computation - rank\'s trick has no inverse.',
          fix: 'Sample every k-th one to bound the scan, and expect to pay memory for it.'
        },
        {
          symptom: 'Overhead is quoted as zero.',
          cause: 'Confusing "succinct" with "compressed" - the index is real and is the o(Z) term.',
          fix: 'Report data and index separately; 7.9% here, and it belongs in any capacity estimate.'
        }
      ],
      inTheWild: [
        { system: 'FM-indexes and genome aligners', how: 'rank over the BWT is the entire backward-search step (M06.7)' },
        { system: 'Succinct tries in spell checkers and IMEs', how: 'LOUDS navigation, which is rank and select and nothing else' },
        { system: 'Inverted index posting lists', how: 'Elias-Fano for monotone document-id sequences' },
        { system: 'sdsl-lite and Succinct (Berkeley)', how: 'the reference implementations of these primitives' }
      ],
      sources: [
        { title: 'Space-Efficient Static Trees and Graphs', where: 'Guy Jacobson - FOCS, 1989' },
        { title: 'Compact Data Structures: A Practical Approach', where: 'Gonzalo Navarro - Cambridge, 2016' },
        { title: 'Broadword Implementation of Rank/Select Queries', where: 'Sebastiano Vigna - WEA, 2008' },
        { title: 'On Encoding the Quotient Filter and Elias-Fano', where: 'Elias (1974) and Fano (1971), via Vigna\'s Quasi-Succinct Indices, WSDM 2013' }
      ]
    },

    'succinct-trees': {
      summary: 'LOUDS and balanced parentheses at about 2 bits per node, navigation by rank and select, and ' +
        'wavelet trees lifting the same idea to arbitrary alphabets.',
      intuition: 'There are Catalan-many tree shapes, so naming one takes about 2n bits however it is written ' +
        'down. Both encodings hit that, and navigation becomes arithmetic on a bit string.',
      formulation: {
        equations: [
          {
            label: 'LOUDS',
            expr: 'B = 10 · (1^deg(v) 0 for each v in level order)',
            terms: [
              { sym: 'firstChild', meaning: 'rank1(select0(v) + 1) + 1' },
              { sym: 'parent', meaning: 'rank0(select1(v))' },
              { sym: 'measured', meaning: '5 000 nodes: 10 001 bits = 2.0002 per node' }
            ]
          },
          {
            label: 'Balanced parentheses',
            expr: '( on the way down and ) on the way up, in depth-first order',
            terms: [
              { sym: 'subtree size', meaning: '(close − open + 1) / 2, immediately' },
              { sym: 'caveat', meaning: 'findClose is O(1) only with a range-min-max tree; this one scans' }
            ]
          },
          {
            label: 'Against pointers',
            expr: '2n bits versus a node object plus a child array per node',
            terms: [
              { sym: 'measured', meaning: '1 358 bytes including the index against 240 000 - 177×' },
              { sym: 'honest', meaning: 'add 5 000 8-byte values and it is 41 358 against 240 000 - 5.8×' }
            ]
          },
          {
            label: 'Wavelet tree',
            expr: 'n log₂ σ bits; access, rank and quantile in O(log σ)',
            terms: [
              { sym: 'measured', meaning: '4 000 symbols over 256 letters: exactly 8 bits per symbol' },
              { sym: 'quantile', meaning: '16 rank calls per range k-th smallest - two per level, eight levels' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'LOUDS navigation reproduces the pointer tree exactly',
          why: 'The encoding is only useful if it is indistinguishable from what it replaced.',
          breaks: 'A neighbouring node is returned - plausible, wrong, and invisible without an oracle.'
        },
        {
          name: 'The k-th one is node k, and node v\'s block starts past the v-th zero',
          why: 'Both facts are what make the navigation two table lookups.',
          breaks: 'Every operation is off by one in a way that looks like a rank/select bug.'
        },
        {
          name: 'The payload is indexed by the same node numbering',
          why: 'The bit string encodes shape only; the values live in a parallel array.',
          breaks: 'Correct traversal returning the wrong data, which no structural test catches.'
        }
      ],
      complexity: [
        { operation: 'LOUDS firstChild / nextSibling / parent', average: 'O(1) rank + O(log n) select', worst: 'the select dominates' },
        { operation: 'BP subtree size / depth', average: 'O(1) with a range-min-max tree', worst: 'O(n) with the scanning findClose here' },
        { operation: 'wavelet access / rank', average: 'O(log σ)', worst: 'O(log σ)' },
        { operation: 'wavelet range quantile', average: 'O(log σ)', worst: 'O(log σ)' },
        { operation: 'space', average: '2n + o(n) bits for the shape', worst: 'plus the payload, which usually dominates' }
      ],
      failureModes: [
        {
          symptom: 'Navigation drifts by one node the deeper it goes.',
          cause: 'A half-open/closed mix-up between rank and select.',
          fix: 'Compare every operation on every node against the pointer tree; nothing less finds it.'
        },
        {
          symptom: 'The quoted memory saving does not appear in production.',
          cause: 'The 2n bits is the shape; the payload was never in it.',
          fix: 'Report shape and payload separately - 177× becomes 5.8× with 8-byte values.'
        },
        {
          symptom: 'BP navigation is slow.',
          cause: 'findClose is scanning because no range-min-max tree was built.',
          fix: 'Build one, or use LOUDS if subtree sizes and depths are not needed.'
        },
        {
          symptom: 'The succinct version is slower than pointers.',
          cause: 'It does more arithmetic; it wins on cache and residency, not on instruction count.',
          fix: 'Expected below the size where the pointer version stops fitting - use pointers there.'
        }
      ],
      inTheWild: [
        { system: 'Google IME and spell checkers', how: 'succinct tries holding dictionaries on device' },
        { system: 'Genome indexes (BWA, bowtie)', how: 'wavelet trees over the BWT for rank over a 4-letter alphabet' },
        { system: 'RDF and graph stores', how: 'LOUDS-encoded adjacency for billion-edge graphs in memory' },
        { system: 'sdsl-lite', how: 'the reference library for all of these encodings' }
      ],
      sources: [
        { title: 'Space-Efficient Static Trees and Graphs', where: 'Guy Jacobson - FOCS, 1989' },
        { title: 'Representing Trees of Higher Degree', where: 'Benoit, Demaine, Munro, Raman, Raman, Rao - Algorithmica, 2005' },
        { title: 'High-Order Entropy-Compressed Text Indexes', where: 'Grossi, Gupta, Vitter - SODA, 2003 (wavelet trees)' },
        { title: 'Compact Data Structures: A Practical Approach', where: 'Gonzalo Navarro - chapters 6 and 8' }
      ]
    },

    'compressed-bitmaps': {
      summary: 'Roaring bitmaps\' three-container design against run-length coding and the sorted-array ' +
        'baseline, with the operation cost measured as well as the memory.',
      intuition: 'Cut the universe into chunks of 65 536 and let each chunk pick its own representation. What ' +
        'won was not the storage but that every pair of container types has an operation path that never ' +
        'decompresses.',
      formulation: {
        equations: [
          {
            label: 'The container rule',
            expr: 'array below 4 096 values, bitmap above, runs when fewer than either',
            terms: [
              { sym: 'why 4 096', meaning: '4 096 × 2 bytes = 8 192 bytes = a 65 536-bit bitmap' },
              { sym: 'measured', meaning: '77 arrays for a sparse set, 1 bitmap for a dense one, 1 run after optimisation' }
            ]
          },
          {
            label: 'Memory, 20 000 values',
            expr: 'the same count in three distributions',
            terms: [
              { sym: 'sparse', meaning: 'Roaring 41 232, WAH 141 972, raw bitmap 630 784, sorted array 80 000' },
              { sym: 'dense', meaning: 'Roaring 8 208, WAH 5 164, raw bitmap 8 192 - Roaring is the largest' },
              { sym: 'runs', meaning: 'Roaring 8 208, and 808 after runOptimize - 10× less' }
            ]
          },
          {
            label: 'Operation cost',
            expr: 'a path per pair of container types',
            terms: [
              { sym: 'array ∩ bitmap', meaning: '3 elements touched, 0 bitmap words - the small side decides' },
              { sym: 'bitmap ∩ bitmap', meaning: '2 048 words, a straight AND' }
            ]
          },
          {
            label: 'Run optimisation',
            expr: 'convert iff 4·runs < min(2·values, 8 192)',
            terms: [
              { sym: 'measured', meaning: 'run-heavy chunk: 8 208 bytes as a bitmap, 808 as runs' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Set operations agree with a reference Set',
          why: 'Three container types and three operations is nine code paths, each independently wrong-able.',
          breaks: 'A query returns a subtly different set on one density and the right one everywhere else.'
        },
        {
          name: 'Run optimisation preserves the set exactly',
          why: 'It is a representation change, not a semantic one.',
          breaks: 'Boundary values lost at run edges - the classic off-by-one in a run encoder.'
        },
        {
          name: 'A container is promoted when it passes the crossover',
          why: 'An array container past 4 096 is both larger and slower than the bitmap it should have become.',
          breaks: 'Memory grows and membership degrades to a binary search over thousands of entries.'
        }
      ],
      complexity: [
        { operation: 'contains', average: 'O(1) bitmap, O(log n) array, O(runs) run', worst: 'O(runs)' },
        { operation: 'array ∩ bitmap', average: 'O(|array|)', worst: 'O(|array|)' },
        { operation: 'bitmap ∩ bitmap', average: 'O(65 536 / 32) words', worst: 'the same - it is fixed' },
        { operation: 'union / difference', average: 'O(|smaller|) or O(words)', worst: 'O(words) per shared chunk' },
        { operation: 'space', average: 'per chunk: min(2·values, 8 192, 4·runs) + header', worst: '8 KB per dense chunk' }
      ],
      failureModes: [
        {
          symptom: 'A compressed bitmap is larger than the uncompressed one.',
          cause: 'Run-length coding on alternating data - every word becomes a tagged literal.',
          fix: 'This is WAH\'s pathology; a container-based format degrades to a plain bitmap instead.'
        },
        {
          symptom: 'Intersecting a tiny set with a huge one costs the huge one.',
          cause: 'A run-length format has to walk both encodings in lockstep.',
          fix: 'Use a format with per-type operation paths; measured here as 3 elements against 2 048 words.'
        },
        {
          symptom: 'Memory is fine until run optimisation is called, then unchanged.',
          cause: 'Random data has no runs; the pass correctly does nothing.',
          fix: 'Nothing to fix - it is a measurement, and it is right to skip the conversion.'
        },
        {
          symptom: 'Roaring is bigger than a plain bitmap.',
          cause: 'One dense chunk, where the container header is pure overhead.',
          fix: 'Expected. Roaring wins on sparse and mixed densities and on operation cost, not on every input.'
        }
      ],
      inTheWild: [
        { system: 'Lucene and Elasticsearch', how: 'Roaring for document-id sets in filter caches' },
        { system: 'Apache Druid, Spark, ClickHouse', how: 'Roaring bitmap indexes over column values' },
        { system: 'FastBit and older warehouses', how: 'WAH and EWAH - the run-length generation Roaring displaced' },
        { system: 'RoaringBitmap (Java, C, Go)', how: 'the reference implementations and the format specification' }
      ],
      sources: [
        { title: 'Better Bitmap Performance with Roaring Bitmaps', where: 'Chambi, Lemire, Kaser, Godin - SPE, 2016' },
        { title: 'Consistently Faster and Smaller Compressed Bitmaps with Roaring', where: 'Lemire, Ssi-Yan-Kai, Kaser - SPE, 2016' },
        { title: 'Optimizing Bitmap Indices with Efficient Compression', where: 'Wu, Otoo, Shoshani - TODS, 2006 (WAH)' },
        { title: 'Sorting Improves Word-Aligned Bitmap Indexes', where: 'Lemire, Kaser, Aouiche - DKE, 2010' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));

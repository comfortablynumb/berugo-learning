/**
 * The data-structures track: layout, hashing, trees, heaps, text indexes, sketches, spatial and persistent structures.
 *
 * Track data only - no API. `core/curriculum.js` assembles these into the one
 * ordered syllabus every view renders from, and it is still the single source
 * of truth; this file exists because the syllabus outgrew a thousand lines and
 * will keep growing as milestones land. Splitting per track rather than per
 * milestone keeps the seam in a place that does not move.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.CurriculumDataStructures = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  return [
    {
      id: 'data-structures',
      title: 'Data structures',
      summary: 'Layout, hashing, trees, heaps, text indexes, sketches and spatial indexes.',
      groups: [
        {
          id: 'M02',
          title: 'Linear structures and memory layout',
          summary: 'The structures everything else is built from, with the memory layout visible.',
          sections: [
            {
              id: 'memory-layout',
              title: 'Contiguous memory, addresses and strides',
              summary: 'Stride, alignment, padding, and array-of-structs against struct-of-arrays.',
              tags: ['memory', 'stride', 'alignment', 'padding', 'aos', 'soa']
            },
            {
              id: 'dynamic-arrays',
              title: 'Dynamic arrays and growth policies',
              summary: 'Capacity, growth factors, insertion in the middle, and what each copy costs.',
              tags: ['dynamic array', 'growth factor', 'capacity', 'copy']
            },
            {
              id: 'linked-lists',
              title: 'Linked lists and pointer chasing',
              summary: 'Why every operation is O(1) and the structure still loses to an array.',
              tags: ['linked list', 'pointer chasing', 'locality', 'cycle detection']
            },
            {
              id: 'stacks-and-frames',
              title: 'Stacks and the call stack',
              summary: 'Frames, recursion depth, stack overflow, and converting recursion to a loop.',
              tags: ['stack', 'call stack', 'recursion', 'frames']
            },
            {
              id: 'queues-and-rings',
              title: 'Queues, deques and ring buffers',
              summary: 'Masked wrap-around, the full-versus-empty problem and bounded-queue policies.',
              tags: ['queue', 'ring buffer', 'deque', 'backpressure']
            },
            {
              id: 'batching-pipelines',
              title: 'Batching, chunking and pipelines',
              summary: 'Batch size as the dial between peak memory and time to first result.',
              tags: ['batching', 'chunking', 'pipeline', 'latency', 'throughput']
            },
            {
              id: 'pools-and-arenas',
              title: 'Free lists, pools and arenas',
              summary: 'Bump allocation, free lists, first-fit fragmentation and when pooling loses.',
              tags: ['allocator', 'arena', 'free list', 'fragmentation', 'pool']
            },
            {
              id: 'text-buffers',
              title: 'Ropes, gap buffers and piece tables',
              summary: 'Why editors do not store text in one string, measured over an edit script.',
              tags: ['gap buffer', 'piece table', 'rope', 'editor']
            },
            {
              id: 'cache-layouts',
              title: 'Cache-conscious layouts',
              summary: 'The same binary search over sorted, Eytzinger and blocked layouts.',
              tags: ['cache', 'eytzinger', 'blocking', 'locality', 'layout']
            }
          ]
        },
        {
          id: 'M03',
          title: 'Hashing and hash tables',
          summary: 'From bit mixing to Swiss tables, with every scheme on the same key stream.',
          sections: [
            {
              id: 'hash-functions',
              title: 'What a hash function has to do',
              summary: 'Determinism, uniformity, avalanche and speed — measured, not asserted.',
              tags: ['hash', 'avalanche', 'fnv', 'murmur', 'mixing', 'chi-squared']
            },
            {
              id: 'universal-hashing',
              title: 'Universal, tabulation and keyed hashing',
              summary: 'The guarantee behind multiply-shift, and the attack that made seeds random.',
              tags: ['universal hashing', 'tabulation', 'siphash', 'hashdos', 'seed']
            },
            {
              id: 'separate-chaining',
              title: 'Separate chaining',
              summary: 'Bucket arrays, expected chain length, and why real maps treeify.',
              tags: ['chaining', 'buckets', 'treeify', 'load factor']
            },
            {
              id: 'open-addressing',
              title: 'Open addressing',
              summary: 'Linear, quadratic and double hashing, clustering, and the tombstone trap.',
              tags: ['open addressing', 'linear probing', 'tombstone', 'clustering']
            },
            {
              id: 'robin-hood',
              title: 'Robin Hood, hopscotch and cuckoo hashing',
              summary: 'Three ways to bound the worst probe rather than the average one.',
              tags: ['robin hood', 'cuckoo', 'hopscotch', 'variance', 'tail latency']
            },
            {
              id: 'swiss-tables',
              title: 'SIMD-style metadata probing',
              summary: 'Control bytes, H1/H2 splitting, and one cache line answering sixteen slots.',
              tags: ['swiss table', 'control bytes', 'simd', 'group probing']
            },
            {
              id: 'rehashing',
              title: 'Resizing and rehashing',
              summary: 'The p99 spike a synchronous rehash creates, and the incremental fix.',
              tags: ['rehash', 'resize', 'incremental', 'latency', 'p99']
            },
            {
              id: 'perfect-hashing',
              title: 'Perfect and minimal perfect hashing',
              summary: 'When the key set is fixed at build time, a hash table is the wrong structure.',
              tags: ['perfect hashing', 'fks', 'chd', 'static', 'bits per key']
            },
            {
              id: 'hash-in-practice',
              title: 'Hash tables in the wild',
              summary: 'Map versus objects, dictionary mode, and choosing a scheme for a workload.',
              tags: ['map', 'v8', 'weakmap', 'dictionary mode', 'workload']
            }
          ]
        },
        {
          id: 'M04',
          title: 'Search trees and disjoint sets',
          summary: 'Every balanced family on one tree engine, compared on the same operation stream.',
          sections: [
            {
              id: 'bst-rotations',
              title: 'Binary search trees and rotations',
              summary: 'The invariant, the three delete cases, and the one primitive balance is built from.',
              tags: ['bst', 'rotation', 'in-order', 'height', 'delete', 'successor']
            },
            {
              id: 'avl-trees',
              title: 'AVL trees',
              summary: 'The strictest balance rule, the shallowest tree, and the most rotation work.',
              tags: ['avl', 'balance factor', 'rebalance', 'height bound', 'fibonacci']
            },
            {
              id: 'red-black-trees',
              title: 'Red-black trees',
              summary: 'A 2-3-4 tree in binary form, and why the standard libraries chose it.',
              tags: ['red-black', 'black height', '2-3-4', 'recolour', 'llrb']
            },
            {
              id: 'treaps',
              title: 'Treaps and randomised BSTs',
              summary: 'Two orders at once, so the shape follows the keys rather than their arrival order.',
              tags: ['treap', 'split', 'merge', 'randomised', 'priority']
            },
            {
              id: 'splay-trees',
              title: 'Splay trees and self-adjustment',
              summary: 'No balance rule, a restructure on every read, and the workload that pays for it.',
              tags: ['splay', 'amortised', 'working set', 'zipf', 'potential method']
            },
            {
              id: 'scapegoat-trees',
              title: 'Weight-balanced and scapegoat trees',
              summary: 'Balance by rebuilding, with no per-node metadata at all.',
              tags: ['scapegoat', 'alpha', 'rebuild', 'weight-balanced', 'amortised']
            },
            {
              id: 'b-trees',
              title: 'B-trees and B+ trees',
              summary: 'The node is a page, so the storage decides the branching factor.',
              tags: ['b-tree', 'b+ tree', 'page', 'fill factor', 'range scan', 'index']
            },
            {
              id: 'augmented-trees',
              title: 'Augmented trees',
              summary: 'One extra field per node, and the rule that decides which fields are possible.',
              tags: ['augmentation', 'order statistic', 'interval tree', 'rank', 'select']
            },
            {
              id: 'skip-lists',
              title: 'Skip lists',
              summary: 'Probabilistic express lanes, and what p really trades.',
              tags: ['skip list', 'probabilistic', 'levels', 'lock-free', 'redis']
            },
            {
              id: 'disjoint-sets',
              title: 'Disjoint set union',
              summary: 'Union by rank, path compression, and the rollback they make impossible.',
              tags: ['union-find', 'dsu', 'path compression', 'ackermann', 'kruskal']
            }
          ]
        },
        {
          id: 'M05',
          title: 'Heaps and priority queues',
          summary: 'Order without sorting: the array heap, the lazy heaps, and the clock that fires timers.',
          sections: [
            {
              id: 'binary-heaps',
              title: 'Binary heaps',
              summary: 'A complete tree stored in an array, and why building one is linear.',
              tags: ['heap', 'sift', 'priority queue', 'build heap', 'complete tree']
            },
            {
              id: 'd-ary-heaps',
              title: 'd-ary heaps',
              summary: 'Arity trades a shallower sift-up against a wider sift-down.',
              tags: ['d-ary', 'arity', 'cache line', 'decrease-key', 'sift down']
            },
            {
              id: 'heapsort',
              title: 'Heapsort and selection',
              summary: 'In-place, no worst case, and beaten in practice - plus the top-k it wins.',
              tags: ['heapsort', 'in-place', 'top-k', 'selection', 'quickselect']
            },
            {
              id: 'mergeable-heaps',
              title: 'Mergeable heaps',
              summary: 'Leftist, skew and binomial: three ways to make meld cheap.',
              tags: ['meld', 'leftist', 'skew heap', 'binomial', 'null path length']
            },
            {
              id: 'fibonacci-heaps',
              title: 'Fibonacci heaps',
              summary: 'Lazy melds, marked nodes and cascading cuts, for the amortised bound.',
              tags: ['fibonacci heap', 'amortised', 'cascading cut', 'consolidate', 'decrease-key']
            },
            {
              id: 'pairing-heaps',
              title: 'Pairing heaps',
              summary: 'The self-adjusting heap that wins on a real machine and resists analysis.',
              tags: ['pairing heap', 'two-pass', 'self-adjusting', 'meld', 'decrease-key']
            },
            {
              id: 'indexed-priority-queues',
              title: 'Indexed priority queues',
              summary: 'A position map turns decrease-key from a scan into a sift.',
              tags: ['indexed heap', 'position map', 'dijkstra', 'lazy deletion', 'stale entry']
            },
            {
              id: 'timers-and-events',
              title: 'Timers and event scheduling',
              summary: 'Hashed timer wheels, the event kernel, and the queue that Little law measures.',
              tags: ['timer wheel', 'event loop', 'discrete event', 'little law', 'scheduling']
            }
          ]
        },
        {
          id: 'M06',
          title: 'Tries, suffix structures and text indexes',
          summary: 'Prefix trees through self-indexes: how a search box answers in a millisecond.',
          sections: [
            {
              id: 'tries',
              title: 'Tries',
              summary: 'Not a faster hash table — a structure that answers the queries a hash cannot.',
              tags: ['trie', 'prefix', 'autocomplete', 'alphabet array', 'terminal marker']
            },
            {
              id: 'compressed-tries',
              title: 'Compressed tries: radix and PATRICIA',
              summary: 'Path compression, edge splitting, ART node sizes and longest-prefix match.',
              tags: ['radix trie', 'patricia', 'adaptive radix tree', 'routing', 'longest prefix']
            },
            {
              id: 'dictionary-automata',
              title: 'Ternary search trees and dictionary automata',
              summary: 'Three pointers per node, and a DAWG that shares suffixes as well as prefixes.',
              tags: ['ternary search tree', 'dawg', 'minimisation', 'near neighbour', 'spell check']
            },
            {
              id: 'suffix-trees',
              title: 'Suffix trees',
              summary: 'Ukkonen online, with the active point and the remainder in view.',
              tags: ['suffix tree', 'ukkonen', 'suffix link', 'active point', 'implicit tree']
            },
            {
              id: 'suffix-arrays',
              title: 'Suffix arrays and LCP',
              summary: 'Doubling, SA-IS and Kasai — every suffix-tree answer at a fifth of the memory.',
              tags: ['suffix array', 'lcp', 'kasai', 'sa-is', 'prefix doubling']
            },
            {
              id: 'suffix-automata',
              title: 'Suffix automata and factor oracles',
              summary: 'The minimal DFA of all substrings, and the clone case everyone gets wrong.',
              tags: ['suffix automaton', 'clone', 'endpos', 'factor oracle', 'distinct substrings']
            },
            {
              id: 'burrows-wheeler',
              title: 'Burrows-Wheeler and the FM-index',
              summary: 'A reversible permutation that is also a search index for the compressed text.',
              tags: ['bwt', 'lf mapping', 'fm-index', 'backward search', 'rank', 'self-index']
            },
            {
              id: 'inverted-indexes',
              title: 'Inverted indexes and postings',
              summary: 'Intersection, gap coding and positions — where query latency actually lives.',
              tags: ['inverted index', 'postings', 'galloping', 'skip pointers', 'varbyte', 'phrase']
            },
            {
              id: 'autocomplete-and-fuzzy',
              title: 'Autocomplete and fuzzy search',
              summary: 'BK-trees, Levenshtein automata and n-grams, ranked by recall before latency.',
              tags: ['bk-tree', 'levenshtein automaton', 'n-gram', 'recall', 'top-k completion']
            }
          ]
        },
        {
          id: 'M07',
          title: 'Probabilistic and streaming sketches',
          summary: 'Structures that trade exactness for space, with the error bound measured rather than quoted.',
          sections: [
            {
              id: 'bloom-filters',
              title: 'Bloom filters',
              summary: 'k bits per key, no false negatives, and an error that grows silently past the n you sized for.',
              tags: ['bloom filter', 'false positive', 'bit array', 'sizing', 'membership']
            },
            {
              id: 'bloom-variants',
              title: 'Counting, blocked and scalable Bloom filters',
              summary: 'Deletion, one cache line per query, and a chain of layers for an unknown n.',
              tags: ['counting bloom', 'blocked bloom', 'scalable bloom', 'cache line', 'deletion']
            },
            {
              id: 'fingerprint-filters',
              title: 'Cuckoo and quotient filters',
              summary: 'Fingerprints instead of bits: deletion, a hard load ceiling, and a merge with no keys.',
              tags: ['cuckoo filter', 'quotient filter', 'fingerprint', 'load factor', 'merge']
            },
            {
              id: 'hyperloglog',
              title: 'HyperLogLog and cardinality estimation',
              summary: 'Leading zeros, a harmonic mean over registers, and the merge that makes it shardable.',
              tags: ['hyperloglog', 'cardinality', 'registers', 'harmonic mean', 'merge', 'sparse']
            },
            {
              id: 'count-min-sketch',
              title: 'Count-min and count-sketch',
              summary: 'A counter matrix that never under-counts, and the signed variant that can.',
              tags: ['count-min', 'count sketch', 'conservative update', 'heavy hitters', 'one-sided error']
            },
            {
              id: 'quantile-sketches',
              title: 'Quantiles: reservoir, t-digest, KLL and DDSketch',
              summary: 'Why averages lie about latency, and which guarantee an SLO is actually written in.',
              tags: ['quantile', 't-digest', 'kll', 'ddsketch', 'reservoir sampling', 'p99']
            },
            {
              id: 'minhash-and-lsh',
              title: 'MinHash, SimHash and LSH',
              summary: 'Jaccard from a signature, and the S-curve that turns a threshold into a tuning dial.',
              tags: ['minhash', 'simhash', 'lsh', 'jaccard', 'banding', 's-curve', 'johnson-lindenstrauss']
            },
            {
              id: 'windowed-counting',
              title: 'Windows, decay and top-k over streams',
              summary: 'DGIM buckets, exponential histograms and space-saving: "the last five minutes", cheaply.',
              tags: ['dgim', 'sliding window', 'space-saving', 'lossy counting', 'decay', 'top-k']
            },
            {
              id: 'choosing-sketches',
              title: 'Choosing and combining sketches',
              summary: 'The error/space/mergeability table, an adversary, and how to test a sketch in CI.',
              tags: ['trade-off', 'mergeability', 'adversarial', 'keyed hashing', 'sketch selection']
            }
          ]
        },
        {
          id: 'M08',
          title: 'Spatial and multidimensional indexes',
          summary: 'Everything that answers "what is near this" or "what overlaps this", with the pruning measured.',
          sections: [
            {
              id: 'uniform-grids',
              title: 'Uniform grids and spatial hashing',
              summary: 'Cell size from density and radius, an unbounded domain by hashing, and the phantom candidates it costs.',
              tags: ['grid', 'spatial hash', 'cell size', 'density', 'broad phase', 'bucketing']
            },
            {
              id: 'quadtrees',
              title: 'Quadtrees, octrees and loose quadtrees',
              summary: 'Subdivision of space, the depth cap that is a correctness requirement, and objects with extent.',
              tags: ['quadtree', 'octree', 'loose quadtree', 'subdivision', 'coincident points', 'depth cap']
            },
            {
              id: 'kd-trees',
              title: 'k-d trees and nearest neighbours',
              summary: 'The backtrack that makes the answer right, and the dimension where pruning stops working.',
              tags: ['kd tree', 'nearest neighbour', 'backtrack', 'median split', 'curse of dimensionality']
            },
            {
              id: 'r-trees',
              title: 'R-trees and rectangle indexes',
              summary: 'Overlapping bounding rectangles, four split heuristics, and why databases bulk load.',
              tags: ['r-tree', 'mbr', 'split heuristic', 'r*-tree', 'str', 'bulk load', 'postgis']
            },
            {
              id: 'bounding-volumes',
              title: 'Bounding volume hierarchies and the SAH',
              summary: 'A cost model rather than a rule of thumb, the slab test, and refitting an animated scene.',
              tags: ['bvh', 'surface area heuristic', 'ray tracing', 'slab method', 'refit', 'traversal']
            },
            {
              id: 'space-filling-curves',
              title: 'Space-filling curves: Morton, Hilbert and geohash',
              summary: 'One number for two coordinates, a rectangle as key ranges, and which locality claim is true.',
              tags: ['morton', 'z-order', 'hilbert', 'geohash', 's2', 'range decomposition', 'locality']
            },
            {
              id: 'range-structures',
              title: 'One-dimensional range structures',
              summary: 'Fenwick, segment trees, lazy propagation, sparse tables and the constant that O(log n) hides.',
              tags: ['fenwick', 'binary indexed tree', 'segment tree', 'lazy propagation', 'sparse table', 'sqrt decomposition']
            },
            {
              id: 'vector-search',
              title: 'Nearest neighbours in high dimensions',
              summary: 'Recall as the quantity, HNSW as a skip list in metric space, and the re-ranking stage.',
              tags: ['hnsw', 'ann', 'vector search', 'recall', 'product quantisation', 'ivf', 'vp-tree']
            },
            {
              id: 'broad-phase',
              title: 'Broad-phase collision detection',
              summary: 'Sweep and prune, temporal coherence, and the tunnelling failure no index can fix.',
              tags: ['broad phase', 'sweep and prune', 'collision', 'temporal coherence', 'tunnelling', 'substepping']
            }
          ]
        },
        {
          id: 'M09',
          title: 'Persistent, immutable and succinct structures',
          summary: 'Keeping every version for the price of the path, and encoding a structure in the bits it needs.',
          sections: [
            {
              id: 'persistence-basics',
              title: 'Persistence: path copying, fat nodes and node copying',
              summary: 'Three ways to keep every version, and the read cost the space comparison leaves out.',
              tags: ['persistence', 'path copying', 'fat node', 'node copying', 'structural sharing', 'snapshot']
            },
            {
              id: 'persistent-sequences',
              title: 'Persistent queues: amortisation, laziness and real time',
              summary: 'Reusing one version breaks an amortised bound; a memoised suspension repairs it.',
              tags: ['okasaki', 'bankers queue', 'lazy evaluation', 'amortised', 'real-time queue', 'memoisation']
            },
            {
              id: 'versioned-queries',
              title: 'Versioned range queries and order statistics',
              summary: 'A persistent segment tree, and the prefix-version index that answers the k-th smallest in a range.',
              tags: ['persistent segment tree', 'range sum', 'order statistics', 'quantile', 'snapshot query']
            },
            {
              id: 'bit-partitioned-tries',
              title: 'Bit-partitioned tries: HAMTs, vectors and transients',
              summary: 'A bitmap and a popcount instead of 32 slots, and the transient that pays for the build.',
              tags: ['hamt', 'popcount', 'persistent vector', 'transient', 'clojure', 'bit partitioning']
            },
            {
              id: 'finger-trees',
              title: '2-3 finger trees and monoid annotations',
              summary: 'One structure, four data structures: the measure decides what the split finds.',
              tags: ['finger tree', 'monoid', 'annotation', 'split', 'concatenation', 'deque']
            },
            {
              id: 'zippers',
              title: 'Zippers: a cursor into an immutable structure',
              summary: 'Focus plus context, and the batching that makes local edits cost the path once.',
              tags: ['zipper', 'cursor', 'focus', 'context', 'locality', 'immutable edit']
            },
            {
              id: 'rank-and-select',
              title: 'Bit vectors with rank and select',
              summary: 'The two-level index, its 7.9% overhead, and the density where a positions array wins.',
              tags: ['rank', 'select', 'bit vector', 'popcount', 'elias-fano', 'succinct']
            },
            {
              id: 'succinct-trees',
              title: 'Succinct trees: LOUDS, parentheses and wavelet trees',
              summary: '2n bits for the shape, what that figure excludes, and the same trick on a sequence.',
              tags: ['louds', 'balanced parentheses', 'wavelet tree', 'succinct', '2n bits', 'navigation']
            },
            {
              id: 'compressed-bitmaps',
              title: 'Compressed bitmaps: Roaring and word-aligned runs',
              summary: 'A representation chosen per chunk, and the intersection path chosen per container pair.',
              tags: ['roaring', 'wah', 'bitmap', 'container', 'run-length', 'intersection']
            }
          ]
        }
      ],
      planned: []
    },
  ];
}));

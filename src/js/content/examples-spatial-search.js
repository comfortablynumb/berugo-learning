/** Worked examples for the range-structure, vector and broad-phase sections (M08.7-M08.9). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'range-structures': [
      {
        title: 'Four structures, one operation mix, and the constant nobody quotes',
        goal: 'Replay the identical operation stream through four sum structures and measure the constant that ' +
          '"O(log n)" hides.',
        setup: 'An array of 8 192 values and 20 000 operations, half point updates and half range sums, checked ' +
          'against a brute replay on a plain array. log₂ 8 192 = 13 and √8 192 = 90.5.',
        steps: [
          {
            do: 'Start with prefix sums, which is the baseline that motivates the rest.',
            why: 'Its query is unbeatable and its update is why nobody uses it on changing data.',
            work: '2.00 array slots per query, 4 088.88 per update\n' +
              '16.00 bytes per element',
            result: 'the fastest query here, and an update that touches half the array'
          },
          {
            do: 'Measure the Fenwick tree, which is the same data in n + 1 numbers.',
            why: 'It is the smallest structure that supports both operations, and the numbers should be near log₂ n.',
            work: '7.49 slots per update, 13.01 per query\n' +
              '8.00 bytes per element\n' +
              'log₂ 8 192 = 13',
            result: 'a query costs exactly log₂ n slots, and an update a little over half of that'
          },
          {
            do: 'Measure the segment tree, which does the same job for any monoid.',
            why: 'The generalisation is the point; the constant is the price.',
            work: '14.00 slots per update, 44.90 per query\n' +
              '32.00 bytes per element',
            result: '3.5× the query slots and 4× the memory of a Fenwick tree'
          },
          {
            do: 'Measure sqrt decomposition, which loses on paper and gets written anyway.',
            why: 'To size the gap it is trading for its simplicity.',
            work: '91.00 slots per update, 118.40 per query\n' +
              '8.09 bytes per element; √8 192 = 90.5',
            result: '12× a Fenwick tree\'s update, at the same memory'
          },
          {
            do: 'Check the constants hold as n changes.',
            why: 'A ratio measured at one size is an anecdote until it survives a sweep.',
            work: 'n =     64: Fenwick 4.0 / 5.9,  segment tree 7.0 / 17.4  (update / query)\n' +
              'n =  1 024: Fenwick 6.0 / 10.0, segment tree 11.0 / 32.9\n' +
              'n =  8 192: Fenwick 7.5 / 13.0, segment tree 14.0 / 44.9\n' +
              'n = 65 536: Fenwick 9.0 / 16.0, segment tree 17.0 / 56.9',
            result: 'the query ratio climbs from 2.9× to 3.6× across the sweep, and both really are log n'
          },
          {
            do: 'Confirm all four agree with the brute replay.',
            why: 'A cheaper structure that has stopped being right is not cheaper.',
            work: '20 000 operations, all four structures: 0 mismatches',
            result: 'identical answers, a 546× spread in the slots an update touches'
          }
        ],
        answer: 'All four are correct and the spread is enormous: prefix sums touch 4 088.88 slots per update, ' +
          'Fenwick 7.49. On queries the order reverses - 2.00 against 13.01 - and the segment tree pays 44.90 ' +
          'for the ability to hold any monoid. That is the ten-second decision: if the operation has an inverse ' +
          'and the array changes, Fenwick, at half the memory; if it does not, a segment tree, and pay the 3.5×; ' +
          'if the array never changes, prefix sums, and pay nothing.'
      },
      {
        title: 'Three questions a Fenwick tree cannot answer',
        goal: 'Invert the first example: stop asking for sums, and watch the cheapest structure drop out of the ' +
          'running one requirement at a time.',
        setup: 'The same 8 192-element array. Three queries in turn - range minimum with range updates, range ' +
          'minimum on a static array, and "how many values below x in this range" - each checked against brute ' +
          'force.',
        steps: [
          {
            do: 'Ask for a range minimum and say why Fenwick is out.',
            why: 'A Fenwick range query is one prefix minus another, and minimum has no inverse.',
            work: 'rangeSum(l, r) = prefix(r) − prefix(l−1)\n' +
              'there is no operation ⊖ with min(a, b) ⊖ min(a) = min(b)',
            result: 'the structure is not slow at this; it cannot express it'
          },
          {
            do: 'Add range updates and reach for lazy propagation.',
            why: 'Range-add with range-min is the canonical case, and its push convention is the classic bug.',
            work: '100 000 mixed range-add and range-min operations over 8 192 values\n' +
              '44.99 slots per operation, 524 288 bytes\n' +
              '0 mismatches against a brute replay',
            result: 'the same 45-slot constant as a point-update segment tree, now doing range updates'
          },
          {
            do: 'Drop the updates and ask for the same minima on a static array.',
            why: 'Idempotence unlocks a structure the other cases cannot use.',
            work: 'sparse table: 2.00 slots per query, 14 levels\n' +
              'segment tree: 44.94 slots per query\n' +
              'memory: 3.00× the segment tree',
            result: 'O(1) queries, bought with 3× the memory and no updates at all'
          },
          {
            do: 'Say why a sparse table cannot do sums, and make the module say so too.',
            why: 'The two covering blocks overlap, so the middle is counted twice.',
            work: 'query(l, r) = combine(table[k][l], table[k][r − 2^k + 1])\n' +
              'min(a, a) = a, but a + a ≠ a',
            result: 'the constructor throws on a sum monoid instead of returning wrong answers'
          },
          {
            do: 'Finally ask an order statistic: how many values below x in this range.',
            why: 'No monoid can answer it, because combining two counts needs x at combine time.',
            work: 'merge-sort tree: 44.85 nodes and 57.78 comparisons per query\n' +
              '112 bytes per element, against Fenwick\'s 8.00\n' +
              '0 mismatches over 2 000 queries',
            result: 'O(log² n) time and O(n log n) memory for a question the others cannot ask'
          }
        ],
        answer: 'Each requirement removes a structure. Range minimum removes Fenwick outright - not on speed, on ' +
          'expressiveness. Range updates bring lazy propagation, at 44.99 slots per operation and the one bug in ' +
          'this milestone that passes every hand-picked example and fails a random replay. A static array unlocks ' +
          'the sparse table\'s 2.00 slots per query at 3× the memory. And an order statistic costs a merge-sort ' +
          'tree at 112 bytes per element, fourteen times a Fenwick tree, because the answer for a union is not a ' +
          'function of the halves\' answers.'
      }
    ],

    'vector-search': [
      {
        title: 'Recall is a dial, and the dial has a price list',
        goal: 'Build one HNSW index and read off the entire recall/latency curve it can serve, then check the ' +
          'two parameters are not interchangeable.',
        setup: '3 000 vectors of 48 dimensions in 24 clusters, 60 queries, k = 10, M = 8, efConstruction = 100. ' +
          'Brute force costs 3 000 distance computations per query and is the oracle for every row.',
        steps: [
          {
            do: 'Establish that exact search is not an option at this dimension.',
            why: 'Otherwise the whole approximate exercise is unmotivated.',
            work: 'k-d tree, 48 dimensions:  3 000.00 distances per query - 100% of the data\n' +
              'VP-tree, 48 dimensions:  2 992.67 - 99.76%',
            result: 'both exact structures are a scan with pointer chasing added'
          },
          {
            do: 'Look at the graph the build produced.',
            why: 'The layer sizes should fall by roughly a factor of M, like a skip list\'s levels.',
            work: 'layer 0: 3 000 nodes, mean degree 16\n' +
              'layer 1:   375 nodes, mean degree 8\n' +
              'layer 2:    60 nodes\n' +
              'layer 3:     8 nodes\n' +
              '51 536 links in total',
            result: 'four layers, each about an eighth of the one below'
          },
          {
            do: 'Sweep ef and record recall against distance computations.',
            why: 'ef is a query-time argument, so this is one index serving every point on the curve.',
            work: 'ef =  10: recall 58.8%,  146.87 distances - 20.43× faster than exact\n' +
              'ef =  16: recall 69.8%,  181.87 - 16.50×\n' +
              'ef =  32: recall 83.0%,  252.85 - 11.86×\n' +
              'ef =  64: recall 94.8%,  380.30 -  7.89×\n' +
              'ef = 128: recall 99.0%,  554.13 -  5.41×\n' +
              'ef = 256: recall 100.0%, 863.60 -  3.47×',
            result: 'the last 5% of recall costs more than the first 95%'
          },
          {
            do: 'Do the same with IVF, whose dial is how many partitions to probe.',
            why: 'A different structure with the same shape of trade, for comparison.',
            work: 'probe  1: recall 32.5%,  109.37 distances\n' +
              'probe  4: recall 79.7%,  248.47\n' +
              'probe  8: recall 95.0%,  442.83\n' +
              'probe 32: recall 100.0%, 1 566.53',
            result: 'the same curve shape - comparable near 80% recall, and 16% dearer at 95%'
          },
          {
            do: 'Check whether the build parameter can be recovered at query time.',
            why: 'Because this is the trap: it looks like just another knob.',
            work: 'same M, same query ef = 200:\n' +
              '  efConstruction  24 → recall 94.3%\n' +
              '  efConstruction  48 → recall 96.2%\n' +
              '  efConstruction 100 → recall 99.8%',
            result: 'a narrow build beam makes edges that no query-time ef can find around'
          }
        ],
        answer: 'One index, six operating points: 58.8% recall at 20.4× faster than exact, or 99.0% at 5.4×. ' +
          'That is what makes HNSW deployable - the same graph serves a cheap request and an accurate one with ' +
          'no rebuild. The asymmetry to remember is that ef is recoverable and efConstruction is not: at the same ' +
          'M and the same query-time ef = 200, a graph built with a beam of 24 reaches 94.3% and one built with ' +
          '100 reaches 99.8%, and no query can repair the difference.'
      },
      {
        title: 'Eight bytes a vector, and the stage that makes it work',
        goal: 'Invert the first example: instead of buying recall with search time, buy memory with recall - and ' +
          'then find out what a quantised index is actually for.',
        setup: 'The same 3 000 vectors of 48 dimensions and the same 60 queries at k = 10. Product quantisation ' +
          'with 8 sub-vectors and 256 centroids each, so one byte per part.',
        steps: [
          {
            do: 'Compare the storage.',
            why: 'This is the only reason to consider a quantiser at all.',
            work: 'exact: 48 float64 = 384 bytes per vector\n' +
              'codes: 8 bytes per vector\n' +
              'plus one shared codebook of 8 × 256 × 6 dimensions',
            result: '48× smaller before the codebook, which amortises away at scale'
          },
          {
            do: 'Measure the recall of the codes on their own.',
            why: 'This is the number that is usually quoted, and it is dismal.',
            work: 'recall@10: 39.5%\n' +
              'the true nearest vector is returned first on 10.0% of queries',
            result: 'six of the ten true neighbours missing, every query'
          },
          {
            do: 'Look at where the distance computations actually go.',
            why: 'The cost profile is completely different from every other index here.',
            work: '2 048 distance computations per query = 8 parts × 256 centroids\n' +
              'the 3 000 stored vectors then cost 8 table lookups each and no arithmetic',
            result: 'the cost is the lookup table, and it does not grow with the corpus'
          },
          {
            do: 'Add the stage every production system has: fetch a wider shortlist and rescore it exactly.',
            why: 'A quantiser is a shortlist generator, not a search index.',
            work: 'rerank  ×1 (no rerank): recall 39.5%, 2 058 distances\n' +
              'rerank  ×5:             recall 83.3%, 2 098\n' +
              'rerank ×10:             recall 95.0%, 2 148\n' +
              'rerank ×20:             recall 99.0%, 2 248\n' +
              'rerank ×50:             recall 99.8%, 2 548',
            result: '95.0% recall for 100 exact distance computations on top'
          },
          {
            do: 'Account for the memory the re-ranking stage needs.',
            why: 'Because this is where the memory claim is usually overstated.',
            work: 'codes alone:        40.8 bytes per vector (8 codes + amortised codebook)\n' +
              'codes plus vectors: 424.8 bytes per vector',
            result: 'the saving is in fast memory, not in total bytes'
          }
        ],
        answer: 'Eight bytes a vector recalls 39.5% of the true top ten, and returns the actual nearest neighbour ' +
          'first one time in ten - on its own it is not a search index. The same codes fetching a hundred ' +
          'candidates and rescoring them exactly recall 95.0%, for a hundred extra distance computations. The ' +
          'honest accounting has to include what that stage needs: the exact vectors, somewhere. Codes in RAM at ' +
          '40.8 bytes each and vectors on a colder tier is a real and large win; quoting the 8 bytes without the ' +
          're-ranking stage describes a system nobody ships.'
      }
    ],

    'broad-phase': [
      {
        title: 'Three broad phases, the same pairs, 726× the work',
        goal: 'Measure what a broad phase is worth and, more usefully, find out which one wins on a scene and ' +
          'why the answer is not the one the folklore gives.',
        setup: '400 discs of radius 6 moving at 60 units/s in an 800 × 600 box, 120 frames at 1/30 s. The pair ' +
          'set from each phase is compared with an all-pairs test on every frame.',
        steps: [
          {
            do: 'Establish the answer and the cost of getting it the obvious way.',
            why: 'Everything else is measured against this pair set.',
            work: '400 × 399 / 2 = 79 800 pair tests per frame\n' +
              '70.78 touching pairs found per frame',
            result: '1 127.5 tests per pair found'
          },
          {
            do: 'Sort on one axis and scan forward only while the intervals overlap.',
            why: 'This is sweep and prune, and the early exit is the whole algorithm.',
            work: '2 370.47 pair tests per frame\n' +
              'the same 70.78 pairs, 0 frames of disagreement',
            result: '33.7× fewer tests than all pairs'
          },
          {
            do: 'Count the sort, which is the part that is supposed to be expensive.',
            why: 'Insertion sort is O(n²) and this is a scene of 400 moving objects.',
            work: 'frame 1:    41 177 swaps (a full sort of a random order; n²/4 = 40 000)\n' +
              'frame 2:       165 swaps\n' +
              'mean of frames 2-120: 164.15 swaps',
            result: 'after the first frame the sort costs 0.4% of what it cost once'
          },
          {
            do: 'Now bucket the boxes into a grid instead, rebuilding it every frame.',
            why: 'To check the usual claim that sweep and prune is the right default.',
            work: 'spatial hash: 109.97 pair tests per frame\n' +
              'the same 70.78 pairs, 0 frames of disagreement',
            result: '21.6× fewer tests than sweep and prune, and 726× fewer than all pairs'
          },
          {
            do: 'Say why, rather than declaring a winner.',
            why: 'The grid is not better in general, and the reason is structural.',
            work: 'sweep and prune prunes on 1 axis; the grid prunes on 2\n' +
              'the box is 800 × 600, so a disc\'s x interval overlaps discs 500 units away in y\n' +
              'the grid keeps no state between frames and rebuilds all 400 entries every one',
            result: 'one-dimensional pruning against two-dimensional, on a scene wide in both'
          }
        ],
        answer: 'All three phases return the identical 70.78 pairs per frame, at 79 800, 2 370.47 and 109.97 ' +
          'tests - a 726× spread. Temporal coherence is real and exactly as advertised: the sweep\'s first frame ' +
          'costs 41 177 swaps and every frame after it costs about 165. But on this scene the grid still wins by ' +
          '21.6×, because sweep and prune prunes one axis and a grid prunes two. Sweep and prune earns its place ' +
          'when object sizes vary enough to break a uniform grid, or when the world is unbounded, or when ' +
          'per-frame allocation is unacceptable - not by default.'
      },
      {
        title: 'The contact no broad phase can find',
        goal: 'Invert the first example: stop making the broad phase cheaper and show a failure that none of ' +
          'them - including the all-pairs test - can fix.',
        setup: 'The same 400 discs of radius 6 at 1/30 s. A continuous test solves |Δp + tΔv| = r₁ + r₂ for each ' +
          'pair and reports contacts that occur during the step; a contact is only counted as missed if neither ' +
          'this frame\'s nor the next frame\'s exact contact set contains it.',
        steps: [
          {
            do: 'Construct the smallest possible instance by hand.',
            why: 'To show the failure is arithmetic, not an artefact of the simulation.',
            work: 'a disc at rest at x = 0, radius 1\n' +
              'a disc at x = 20 moving at −1 200 units/s, radius 1\n' +
              'after 1/30 s it is at x = −20',
            result: '20 units apart at both ends of the step, overlapping in between'
          },
          {
            do: 'Confirm the most expensive broad phase there is also misses it.',
            why: 'The instinct is that testing all pairs would catch it.',
            work: 'all-pairs test at the frame boundary: 0 pairs reported\n' +
              'the swept quadratic has a root at about 0.015 s, inside the 0.033 s step',
            result: 'this is a property of the time step, not of the index'
          },
          {
            do: 'Express speed as diameters travelled per step and sweep it.',
            why: 'A speed in units per second means nothing without the object size.',
            work: '  15 units/s = 0.04 diameters/step →      0 missed of 8 509\n' +
              '  60 units/s = 0.17 →      1 missed of 8 493\n' +
              ' 150 units/s = 0.42 →     61 missed of 8 934\n' +
              ' 300 units/s = 0.83 →    520 missed of 9 082\n' +
              ' 600 units/s = 1.67 →  4 510 missed of 9 174\n' +
              '1 200 units/s = 3.33 → 15 445 missed of 9 276',
            result: 'negligible below half a diameter per step, dominant above one'
          },
          {
            do: 'Fix it the blunt way: keep the speed and shrink the step.',
            why: 'This is what engines actually do, under the name substepping.',
            work: 'at 600 units/s over the same 4 seconds of simulation:\n' +
              'dt = 1/30:  32.96% of contacts missed\n' +
              'dt = 1/60:   5.14%\n' +
              'dt = 1/120:  0.66%\n' +
              'dt = 1/240:  0.07%',
            result: 'misses fall 4 510 → 1 007 → 247 → 55, about 4.5× per halving'
          },
          {
            do: 'Note what the sweep costs while you are doing that.',
            why: 'Faster objects also break the temporal-coherence argument from the first example.',
            work: 'swaps per frame: 383.57 at 15 units/s, 505.93 at 60, 1 950.82 at 600, 3 505.43 at 1 200',
            result: 'the sort cost rises 9× over the same speed range that broke the sampling'
          }
        ],
        answer: 'A disc crossing another at 1 200 units/s is 20 units clear at both ends of a 1/30 s step, so ' +
          'every discrete broad phase - including the 79 800-test all-pairs version - reports nothing. The miss ' +
          'rate is a clean function of travel per step: zero below half a diameter, 5.4% at 0.83 and 33% at 1.67. ' +
          'Halving the time step cuts missed contacts by about 4.5×, which is why substepping is the standard answer, and ' +
          'why the usable engineering rule is a bound on max speed × step against the smallest radius rather than ' +
          'a better index.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));

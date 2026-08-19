/** Worked examples for the succinct sections (M09.7-M09.9). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'rank-and-select': [
      {
        title: 'Rank in three lookups, and what the index costs',
        goal: 'Build the two-level index, watch a rank query use it, and price the overhead honestly rather ' +
          'than describing the structure as free.',
        setup: 'A 65 536-bit vector at 50% density - 32 583 ones - with absolute counts every 2 048 bits and ' +
          'relative counts every 256 bits.',
        steps: [
          {
            do: 'Write down what the two tables cost before measuring anything.',
            why: 'The overhead is the entire content of the word "succinct", and it should be predicted.',
            work: 'superblocks: 32 bits per 2 048 = 1.56%\n' +
              'blocks:      16 bits per 256   = 6.25%\n' +
              'total predicted: 7.81%',
            result: 'a prediction of just under 8%'
          },
          {
            do: 'Measure it.',
            why: 'A structure that reports its own overhead is one you can size a system with.',
            work: 'data:  8 192 bytes\n' +
              'index:   646 bytes\n' +
              'overhead: 7.9%',
            result: '8 838 bytes to hold 65 536 bits with constant-time rank'
          },
          {
            do: 'Count what one rank query does.',
            why: 'The constant-time claim is about there being no loop over the vector, not no work.',
            work: '3.0 table lookups per query - superblock, block, and the word\n' +
              '3.5 word popcounts per query, bounded by the 8 words in a block\n' +
              'no dependence on the vector length at all',
            result: 'the same cost at 65 536 bits and at 1 048 576'
          },
          {
            do: 'Now measure select, which has no equivalent trick.',
            why: 'Rank is indexed by position and select asks the inverse question.',
            work: '8.0 binary-search steps per select on 65 536 bits\n' +
              '12.0 on 1 048 576 bits\n' +
              'then a scan bounded by one 256-bit block',
            result: 'O(log n), and it grows with the vector where rank does not'
          },
          {
            do: 'Compare the whole thing against storing the positions instead.',
            why: 'It is the obvious alternative and the one the structure has to beat.',
            work: '32 583 ones × 4 bytes = 130 332 bytes\n' +
              'bit vector plus index: 8 838 bytes',
            result: '14.7× smaller, and rank is O(1) rather than a binary search'
          }
        ],
        answer: 'A two-level index makes rank three lookups and a popcount - 3.0 and 3.5 measured, independent ' +
          'of length - for a 7.9% space overhead that the structure reports rather than hides. Select gets no ' +
          'such trick and stays a binary search at 8.0 steps on 65 536 bits and 12.0 on a million. Against an ' +
          'explicit array of the 32 583 positions, the whole thing is 14.7× smaller. That is what "succinct" ' +
          'means: Z + o(Z) bits, with the o(Z) written down.'
      },
      {
        title: 'The density where the obvious thing wins',
        goal: 'Invert the first example: keep the structure and change the data until the alternative it beat ' +
          'is the better choice.',
        setup: 'The same 65 536-bit vector and the same index, at 50% density and at 2%.',
        steps: [
          {
            do: 'Note what does *not* change when the density drops.',
            why: 'The bit vector is indexed by position, so it is indifferent to what the bits say.',
            work: '50% density: 8 192 data bytes + 646 index\n' +
              ' 2% density: 8 192 data bytes + 646 index',
            result: 'identical - a bit vector costs one bit per position, always'
          },
          {
            do: 'Note what does change about the alternative.',
            why: 'A list of positions costs per *one*, not per position.',
            work: '50% density: 32 583 ones × 4 = 130 332 bytes\n' +
              ' 2% density:  1 246 ones × 4 =   4 984 bytes',
            result: 'the alternative shrinks by 26× while the vector does not move'
          },
          {
            do: 'Find the crossover.',
            why: 'It is arithmetic, so it can be stated rather than guessed.',
            work: 'positions win when 32m < n(1 + overhead)\n' +
              'with 7.9% overhead: m/n < 1/29.7, about 3.4%',
            result: 'below roughly 3% density, store the positions'
          },
          {
            do: 'Check it against the measurement.',
            why: 'A predicted crossover that the measurement contradicts is a wrong prediction.',
            work: '50%: 8 838 bytes against 130 332 - the vector wins 14.7×\n' +
              ' 2%: 8 838 bytes against  4 984 - the positions win 1.8×',
            result: 'the crossover really does sit between them'
          },
          {
            do: 'Reach for the structure that is designed for the sparse case.',
            why: 'Neither of the two is right when the values are sparse *and* monotone.',
            work: '5 000 increasing values under a million:\n' +
              'raw 32-bit integers: 160 000 bits\n' +
              'Elias-Fano:           47 843 bits = 9.5686 per value\n' +
              'its own bound 2 + log₂(u/n) = 9.6496',
            result: '3.34× smaller than integers, and inside the bound it claims'
          }
        ],
        answer: '"Succinct" is a claim relative to a model, and the model here is a dense bit string. The vector ' +
          'costs 8 838 bytes whatever the density; an array of positions costs 130 332 bytes at 50% and 4 984 ' +
          'at 2%, so the crossover sits near 3% and the vector loses below it. For sparse *monotone* data ' +
          'neither is right and Elias-Fano is: 9.5686 bits per value against its own bound of 9.6496, and 3.34× ' +
          'smaller than storing the integers. Choosing a representation means knowing the density first.'
      }
    ],

    'succinct-trees': [
      {
        title: 'Two bits a node',
        goal: 'Encode a tree as a bit string, navigate it without a single pointer, and check the navigation ' +
          'against the pointer tree it replaced.',
        setup: 'A randomly shaped tree of 5 000 nodes, encoded as LOUDS and as balanced parentheses, with ' +
          'every navigation operation compared against the original.',
        steps: [
          {
            do: 'Say why 2 bits is the target rather than a lucky number.',
            why: 'It is an information-theoretic bound, so hitting it means the encoding is essentially optimal.',
            work: 'the number of ordinal trees on n nodes is the Catalan number\n' +
              'log₂ C(n) ≈ 2n bits',
            result: 'about 2n bits is what naming a shape costs, however you write it'
          },
          {
            do: 'Build the LOUDS string and measure it.',
            why: '"10" then one 1 per child and a 0 per node, in breadth-first order.',
            work: '5 000 nodes → 10 001 bits = 2.0002 bits per node\n' +
              'data 1 252 bytes + rank/select index 106 bytes = 1 358 bytes',
            result: 'the bound, hit, with the index included'
          },
          {
            do: 'Navigate it and check every answer.',
            why: 'An encoding that is subtly wrong returns a plausible neighbour rather than failing.',
            work: 'firstChild(v) = rank1(select0(v) + 1) + 1\n' +
              'parent(v)     = rank0(select1(v))\n' +
              'all 5 000 nodes: value, degree, full child walk and parent of every child',
            result: '0 disagreements with the pointer tree'
          },
          {
            do: 'Count what the navigation actually did.',
            why: 'There are no pointers, so the cost is table reads.',
            work: '15 000 navigation calls\n' +
              '14 999 selects and 9 998 ranks\n' +
              '0 pointer dereferences',
            result: 'each operation is one select plus at most one rank'
          },
          {
            do: 'Price it against the pointer tree.',
            why: 'This is the number that decides whether an index fits in memory.',
            work: 'pointers: 5 000 × 48 bytes = 240 000\n' +
              'LOUDS:    1 358 bytes',
            result: '177× less for the same tree and the same navigation'
          }
        ],
        answer: '5 000 nodes encode into 10 001 bits - 2.0002 per node, which is the information-theoretic ' +
          'bound - and 1 358 bytes including the rank/select index, against 240 000 as pointer objects. Every ' +
          'one of 15 000 navigation calls agrees exactly with the pointer tree, using 14 999 selects and 9 998 ' +
          'ranks and no dereference at all. That 177× is what turns "the index does not fit in memory" into ' +
          '"it does".'
      },
      {
        title: 'What the 177× leaves out',
        goal: 'Invert the first example. The headline figure is real and it is about the shape only, so find ' +
          'everything it excludes and put the numbers back.',
        setup: 'The same 5 000-node tree, this time accounting for the payload and for the operations each ' +
          'encoding does *not* make constant.',
        steps: [
          {
            do: 'Add the data back.',
            why: '2n bits encodes the shape; the values were never in it.',
            work: 'shape as LOUDS:            1 358 bytes\n' +
              '5 000 values at 8 bytes:  40 000 bytes\n' +
              'total:                    41 358 bytes',
            result: '5.8× against pointers, not 177× - the payload now dominates'
          },
          {
            do: 'Check what balanced parentheses buys and what it costs.',
            why: 'It encodes the same tree in the same space and is better at different questions.',
            work: 'BP: exactly 2 bits per node, subtree size = (close − open + 1) / 2\n' +
              'depth is the excess, read directly\n' +
              'but navigation needs findClose, which this implementation scans for',
            result: 'constant-time BP navigation needs a range-min-max tree that is not built here'
          },
          {
            do: 'Say what that omission would cost to fix.',
            why: 'Quoting a bound for a structure you did not build is the failure mode.',
            work: 'a range-min-max tree over the excess is a further index\n' +
              'typically another few percent on top of the 2n bits',
            result: 'the section reports a scanning findClose and names the real fix'
          },
          {
            do: 'Note where a succinct structure is actually slower.',
            why: 'It does more arithmetic per operation, not less.',
            work: 'pointer: one dereference, one dependent cache miss\n' +
              'LOUDS:   one select (binary search) plus one rank (3 lookups)',
            result: 'more instructions, fewer misses - it wins only when the pointer version does not fit'
          },
          {
            do: 'State the scale where the trade turns.',
            why: 'For a small tree the complexity buys nothing.',
            work: '5 000 nodes: 240 KB against 41 KB - both trivially resident\n' +
              '5 000 000 nodes: 240 MB against 41 MB',
            result: 'the decision is a systems one, made at the size where residency changes'
          }
        ],
        answer: 'The 177× is a real measurement of the *shape* and it is not the number a system sizes itself ' +
          'with: adding 5 000 eight-byte values takes the total from 1 358 bytes to 41 358, and the saving from ' +
          '177× to 5.8×. Balanced parentheses gives subtree sizes and depths that LOUDS does not, and its ' +
          'navigation is only constant-time with a range-min-max tree this implementation does not build - so ' +
          'it scans, and says so. Succinct structures do more arithmetic and fewer cache misses, which makes ' +
          'them a systems decision at the scale where residency changes and a needless complication below it.'
      }
    ],

    'compressed-bitmaps': [
      {
        title: 'Three shapes of data, three containers',
        goal: 'Give Roaring the same number of values in three different distributions and watch the container ' +
          'choice - and the memory - follow the data rather than a setting.',
        setup: '20 000 values in each of three shapes: spread sparsely over five million, packed densely into ' +
          'forty thousand, and arranged in consecutive runs.',
        steps: [
          {
            do: 'State the crossover the design turns on.',
            why: 'It is arithmetic, not a tuning constant.',
            work: '4 096 values × 2 bytes = 8 192 bytes\n' +
              'a 65 536-bit bitmap        = 8 192 bytes',
            result: 'above 4 096 values in a chunk, the bitmap is smaller *and* has O(1) membership'
          },
          {
            do: 'Feed it the sparse set.',
            why: 'Values spread over five million touch many chunks and fill none of them.',
            work: '77 array containers, 0 bitmaps\n' +
              '41 232 bytes, 16.49 bits per value',
            result: 'a plain bitmap over that universe would be 630 784 bytes - 15× more'
          },
          {
            do: 'Feed it the dense set.',
            why: 'Twenty thousand values in a forty-thousand universe is one chunk, half full.',
            work: '1 bitmap container, 0 arrays\n' +
              '8 208 bytes, 3.28 bits per value',
            result: 'the container rule fired and picked the right one'
          },
          {
            do: 'Feed it the run-heavy set and then run-optimise.',
            why: 'Sorted identifier sets are mostly long consecutive stretches.',
            work: 'as built: 1 bitmap container, 8 208 bytes\n' +
              'after runOptimize: 1 run container, 808 bytes',
            result: '10× smaller, because 4 bytes per run beat 8 KB of bitmap'
          },
          {
            do: 'Measure the operation cost, which is the part that actually won.',
            why: 'Every pair of container types has its own path and none of them decompresses.',
            work: 'a 5-element array container against a bitmap container:\n' +
              '  3 elements touched, 0 bitmap words\n' +
              'two bitmap containers:\n' +
              '  2 048 words touched, 0 elements',
            result: 'the work is the size of the smaller side, not of the universe'
          }
        ],
        answer: 'The same 20 000 values cost 41 232 bytes as arrays, 8 208 as a bitmap and 808 as runs, and ' +
          'nobody chose - the container rule did, per chunk, from the 4 096-value crossover where 2 bytes each ' +
          'stops beating a flat bitmap. The part that made Roaring win is the operations: intersecting a ' +
          'five-element array container with a full bitmap touches three elements and zero bitmap words, ' +
          'because there is a code path per pair of types and none of them decompresses.'
      },
      {
        title: 'The inputs where Roaring is not the answer',
        goal: 'Invert the first example: stop showing the cases Roaring wins and find the ones it loses, ' +
          'including to the encoding it is usually said to have replaced.',
        setup: 'The same three data shapes, compared against a raw bitmap, a sorted array of 32-bit integers ' +
          'and word-aligned hybrid (WAH) coding.',
        steps: [
          {
            do: 'Put the dense random case next to the alternatives.',
            why: 'It is the case Roaring is usually assumed to win and does not.',
            work: 'Roaring:     8 208 bytes (one bitmap container plus its header)\n' +
              'raw bitmap:  8 192 bytes\n' +
              'WAH:         5 164 bytes',
            result: 'Roaring is the largest of the three on dense uniformly random data'
          },
          {
            do: 'Explain why, rather than treating it as noise.',
            why: 'The reason is structural and predicts where else it applies.',
            work: 'a bitmap container is a flat bitmap plus a container header\n' +
              'WAH exploits that a half-full random chunk still has compressible words\n' +
              'nothing about Roaring can beat a raw bitmap on 1 dense chunk: 8 208 against 8 192',
            result: 'Roaring\'s edge is per-chunk adaptivity, and there is only one chunk here'
          },
          {
            do: 'Check the baseline everyone forgets.',
            why: 'A sorted array of integers is simple, cache-friendly and often good enough.',
            work: '20 000 values × 4 bytes = 80 000 bytes, in every case\n' +
              'sparse:  Roaring 41 232 - Roaring wins\n' +
              'dense:   Roaring  8 208 - Roaring wins\n' +
              'raw bitmap over the sparse universe: 630 784 - the array wins',
            result: 'the sorted array beats a raw bitmap whenever the universe is wide'
          },
          {
            do: 'Look at where WAH falls apart.',
            why: 'The dense-random win is not general, and the failure mode is specific.',
            work: 'sparse set: WAH 141 972 bytes against Roaring\'s 41 232\n' +
              '18 838 literal words and 16 655 fill words\n' +
              'alternating data makes every word a literal, and a literal carries a tag bit',
            result: '3.4× larger, and an operation must still walk both encodings in lockstep'
          },
          {
            do: 'State the honest summary.',
            why: 'Reporting only the cases a structure wins is how benchmarks mislead.',
            work: 'Roaring wins on: sparse sets, run-heavy sets, mixed densities, and operation cost\n' +
              'Roaring loses on: 1 dense uniformly random chunk - 8 208 bytes against 5 164 for WAH',
            result: 'realistic identifier distributions are the first list, not the second'
          }
        ],
        answer: 'On dense uniformly random data Roaring is the *largest* of the three at 8 208 bytes, against ' +
          '8 192 for a raw bitmap and 5 164 for WAH - it pays a container header and has only one chunk to be ' +
          'adaptive about. On the sparse set the order reverses hard: 41 232 against WAH\'s 141 972 and a raw ' +
          'bitmap\'s 630 784. And the sorted array of integers at 80 000 bytes beats a raw bitmap in every wide ' +
          'universe and is worth writing down before reaching for anything clever. Roaring won on realistic ' +
          'identifier distributions and on operation cost, which is a narrower and more useful claim than "it ' +
          'is smaller".'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));

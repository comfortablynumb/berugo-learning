/** Worked examples for the library, non-comparison and selection sections (M10.4-M10.6). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'library-sorts': [
      {
        title: 'The invariant that was checked one run too shallow',
        goal: 'Reproduce the 2015 Timsort result: a merge-stack invariant that the original collapse rule ' +
          'fails to restore, on an input that still sorts perfectly.',
        setup: 'An array whose natural runs have lengths 120, 80, 25, 20 and 30 - 275 elements - sorted twice, ' +
          'once with the fixed collapse rule and once with the pre-2015 one, recording the stack after every push.',
        steps: [
          {
            do: 'State the invariants the stack is supposed to satisfy.',
            why: 'They are what bounds the stack depth, and Java sized a fixed array from that bound.',
            work: 'for the top 3 runs X (newest), Y, Z:\n' +
              '  Z > Y + X\n' +
              '  Y > X',
            result: 'run lengths grow at least as fast as the Fibonacci numbers, so the depth is O(log n)'
          },
          {
            do: 'Push the five runs with the fixed rule and read the settled stack each time.',
            why: '"Settled" means after the collapse loop has finished, which is when the invariants must hold.',
            work: '[120] → [120, 80] → [120, 80, 25] → [120, 80, 25, 20] → [275]',
            result: '0 violations at any point'
          },
          {
            do: 'Do the same with the original rule.',
            why: 'It examines only the top three runs, so a violation one level down can survive.',
            work: 'the fourth push merges 25 and 20 into 45\n' +
              'settled stack: [120, 80, 45, 30]\n' +
              'check the deepest triple: 120 > 80 + 45 = 125 is false',
            result: '1 violation, surviving a completed collapse'
          },
          {
            do: 'Check the output of both runs.',
            why: 'This is the part that explains why the bug lasted years.',
            work: '275 elements compared against a reference sort\n' +
              'fixed rule: 0 out of place\n' +
              'buggy rule: 0 out of place',
            result: 'both sort perfectly - the defect is invisible from the output'
          },
          {
            do: 'Say what the violation actually costs.',
            why: 'A broken invariant is only interesting if something depended on it.',
            work: 'the invariant is what proves the stack depth is bounded\n' +
              'Java allocated a fixed 40-entry stack from that proof\n' +
              'the observable failure was an ArrayIndexOutOfBoundsException at ~67 million elements',
            result: 'a proof obligation broken here, and a crash a hundred thousand times further out'
          }
        ],
        answer: 'Run lengths 120, 80, 25, 20, 30 are enough to break Timsort\'s merge-stack invariant under ' +
          'the pre-2015 collapse rule: the stack settles at 120, 80, 45, 30 and 120 is not greater than ' +
          '80 + 45. Both versions sort all 275 elements correctly, which is precisely why the defect survived ' +
          'in Java, Python and Android for years - the only symptom was a stack overflow on arrays of tens of ' +
          'millions of elements. Checking `Z > Y + X` after every push costs two comparisons and finds it on ' +
          'the first constructed input. That is the argument for asserting invariants rather than testing outputs.'
      },
      {
        title: 'Two libraries, two theories of what real data looks like',
        goal: 'Invert the first example: stop looking inside one algorithm and put Timsort and pdqsort ' +
          'side by side on the shapes each was designed for.',
        setup: '20 000 elements in seven shapes, through Timsort and pdqsort, with pdqsort\'s four mechanisms ' +
          'reported separately so each can be seen firing.',
        steps: [
          {
            do: 'Run both on nearly-sorted input.',
            why: 'This is the case Timsort exists for.',
            work: '2 000 elements, 1 in 64 disturbed:\n' +
              'Timsort 3 099 comparisons — 1.55 per element\n' +
              'plain bottom-up merge 15 410',
            result: 'the runs were already there, and finding them was most of the work'
          },
          {
            do: 'Run both on uniform random input.',
            why: 'The case with no structure to exploit, where the constant decides.',
            work: '20 000 elements:\n' +
              'pdqsort 319 511 comparisons, 91 pattern breaks\n' +
              'Timsort finds runs of about two and pads every one to minrun',
            result: 'no runs to find, so Timsort\'s machinery is overhead'
          },
          {
            do: 'Watch pdqsort\'s bounded insertion sort on sorted input.',
            why: 'It is a bet, and this is the case where the bet pays.',
            work: '20 000 sorted elements: 40 010 comparisons — two per element\n' +
              'recursion depth 1\n' +
              'partial-insertion wins: 1',
            result: 'O(n) on sorted input, from a bet that costs 8 moves to lose'
          },
          {
            do: 'Watch the equal-block guard on duplicate-heavy input.',
            why: 'Different mechanism, different shape, and it should fire here and nowhere else.',
            work: '20 000 elements over 3 values: 60 008 comparisons, 3 equal blocks\n' +
              '20 000 identical: 40 024 comparisons, 1 equal block, depth 2',
            result: 'duplicates retired in one partition each, not re-partitioned'
          },
          {
            do: 'Watch pattern breaking on organ-pipe input.',
            why: 'The mechanism for arrangements that unbalance a deterministic pivot.',
            work: 'organ pipe, 20 000 elements: 428 593 comparisons, 394 pattern breaks\n' +
              '0 heapsort fallbacks — the breaking was enough\n' +
              'random input, same size: 91 breaks',
            result: 'the pattern was destroyed rather than survived'
          }
        ],
        answer: 'Timsort does 3 099 comparisons on 2 000 nearly-sorted elements where a plain merge sort does ' +
          '15 410; pdqsort does 40 010 on 20 000 sorted elements - two per element, at recursion depth 1 - by ' +
          'betting eight moves on a bounded insertion sort. Each of pdqsort\'s four mechanisms fires only on ' +
          'the shape it exists for: 394 pattern breaks on organ-pipe, 3 equal blocks on few-unique, 1 ' +
          'partial-insertion win on sorted, and almost nothing on random. Neither library is universally ' +
          'faster, which is why Rust ships a Timsort derivative for its stable sort and a pdqsort derivative ' +
          'for its unstable one.'
      }
    ],

    'non-comparison-sorts': [
      {
        title: 'A sort that never compares anything',
        goal: 'Escape the Ω(n log n) bound by reading the key instead of comparing it, and account for what ' +
          'that costs in memory rather than time.',
        setup: '20 000 integers over a 2^20 key range, through LSD radix sort at four digit widths, with ' +
          'comparisons, moves, passes and counter-table size reported.',
        steps: [
          {
            do: 'Read the comparison count.',
            why: 'The lower bound is a statement about comparisons, so this is the number that matters.',
            work: 'LSD radix, any digit width: 0 comparisons\n' +
              'the key is used as an array index, never as a comparand',
            result: 'the decision-tree bound does not apply, because there is no decision tree'
          },
          {
            do: 'Price counting sort on the same keys instead.',
            why: 'It is the simplest non-comparison sort and the one whose constraint is clearest.',
            work: 'key range 2^8:  1 024 bytes of counters, 1 256 operations\n' +
              'key range 2^16: 262 144 bytes, 66 536 operations\n' +
              'key range 2^32: 17 179 869 184 bytes',
            result: 'the memory depends on the key range and not at all on n'
          },
          {
            do: 'Compare that against a comparison sort at n = 1 000.',
            why: 'The crossover is arithmetic and can be stated rather than guessed.',
            work: 'n log₂ n ≈ 9 966 comparisons\n' +
              'counting with range 256: 1 256 operations → counting wins\n' +
              'counting with range 65 536: 66 536 operations → it loses',
            result: 'the crossover is a relation between k and n log n, not a rule about "small keys"'
          },
          {
            do: 'Use radix sort to turn the memory problem into a pass-count problem.',
            why: 'This is the whole reason radix exists rather than counting sort alone.',
            work: '4 bits:  16 buckets,     64 bytes, 8 passes\n' +
              '8 bits:  256 buckets,  1 024 bytes, 4 passes\n' +
              '16 bits: 65 536 buckets, 262 144 bytes, 2 passes',
            result: 'a 32-bit key range handled with 1 KB of counters'
          },
          {
            do: 'Explain why 8 bits is the usual answer rather than as-wide-as-possible.',
            why: 'The arithmetic says wider is better, and the machine disagrees.',
            work: 'fewer passes means less data movement\n' +
              'but 65 536 counters is 256 KB and does not stay in cache\n' +
              'every scatter into a cold table is a miss',
            result: 'a cache decision wearing the clothes of an arithmetic one'
          }
        ],
        answer: 'LSD radix sort does zero comparisons on 20 000 elements at every digit width, which is what ' +
          'leaving the comparison model means rather than a gap in the instrumentation. What it pays instead ' +
          'is a constraint on the key: counting sort needs one counter per possible value, so 1 000 elements ' +
          'with byte keys need 1 024 bytes and beat a comparison sort, while the same 1 000 elements with ' +
          '32-bit keys need 17 GB. Radix sort converts that into passes - 256 buckets and four passes over ' +
          '32 bits - and the choice of eight bits is made by the cache, not by the arithmetic.'
      },
      {
        title: 'One line that makes radix sort silently wrong',
        goal: 'Invert the first example: hold the algorithm fixed, reverse the direction of the scatter loop, ' +
          'and measure how the damage depends on how many passes carry information.',
        setup: '2 000 tagged elements, LSD radix at 8 bits, run with a stable and an unstable scatter over a ' +
          'narrow key range (0..19) and a wide one (0..10^6).',
        steps: [
          {
            do: 'State why LSD needs stability at all.',
            why: 'It is an induction, and stability is the inductive step.',
            work: 'after sorting on digits 0..i the array is ordered by the low i+1 digits\n' +
              'the pass on digit i+1 must preserve that order within each group of equal digits\n' +
              'which is exactly what "stable" means',
            result: 'break it in any pass and every earlier pass is undone'
          },
          {
            do: 'Locate the line.',
            why: 'It is one loop direction, and both directions look reasonable.',
            work: '4 passes over 8-bit digits, and 1 loop direction is the whole difference:\n' +
              'stable:   walk the input backwards, decrementing the bucket cursor\n' +
              'unstable: walk it forwards\n' +
              'the prefix sums and the counting pass are identical',
            result: 'one character of difference between correct and not'
          },
          {
            do: 'Run both over a narrow key range.',
            why: 'Only one pass carries information, so the induction has nothing to undo.',
            work: 'keys 0..19, 2 000 elements:\n' +
              'stable:   sorted, ties in original order\n' +
              'unstable: sorted, ties reversed',
            result: 'the output is still correctly ordered - the damage is invisible'
          },
          {
            do: 'Run both over a wide key range.',
            why: 'Now four passes carry information and each undoes the last.',
            work: 'keys 0..10^6, 2 000 elements:\n' +
              'stable:   sorted, ties in original order\n' +
              'unstable: not sorted — the first adjacent pair is already out of order',
            result: 'the same code, and now the output is simply wrong'
          },
          {
            do: 'Draw the conclusion about testing.',
            why: 'The failure is graded, which is what makes it survive.',
            work: 'a test suite with keys 0..19 passes\n' +
              'production data with keys 0..10^6 fails\n' +
              'the code did not change between them',
            result: 'the test that catches it must use keys wider than one digit'
          }
        ],
        answer: 'Reversing the scatter loop leaves a radix sort that is correct on narrow keys and wrong on ' +
          'wide ones. Over a key range of 0..19, where only one pass carries information, the unstable ' +
          'version still returns sorted output and only the tie order is wrong. Over 0..10^6, where four ' +
          'passes matter, each pass undoes the last and the very first adjacent pair comes back out of order. ' +
          'Radix sort is stable-or-broken, and the grading is what makes it dangerous: it means a test suite ' +
          'built on small keys certifies code that fails on large ones.'
      }
    ],

    'selection-and-order': [
      {
        title: 'Three constants in front of n',
        goal: 'Measure quickselect, median of medians and sort-then-index on the same array, and read the ' +
          'result as three constants rather than three complexity classes.',
        setup: 'The median of 20 000 random integers, seed 7, found four ways. Every figure is the mean of ' +
          'seven runs with different pivot seeds, because the cost of quickselect is an expectation and one ' +
          'run is one sample of it.',
        steps: [
          {
            do: 'Write down why recursing into one side is linear.',
            why: 'The result follows from one coefficient in the recurrence.',
            work: 'quicksort:   T(n) = 2T(n/2) + n → n log n\n' +
              'quickselect: T(n) =  T(n/2) + n → n + n/2 + n/4 + … = 2n',
            result: 'a geometric series rather than a multiplied one'
          },
          {
            do: 'Measure quickselect at the median.',
            why: 'The prediction is 2n, and the measured constant is what actually gets paid.',
            work: '20 000 elements, k = 9 999\n' +
              '59 772 comparisons, the mean of 7 pivot seeds\n' +
              '2.99 per element',
            result: 'linear, with a constant a little above the idealised 2'
          },
          {
            do: 'Measure median of medians on the identical input.',
            why: 'It has the better worst case, so the question is what the guarantee costs.',
            work: '161 904 comparisons\n' +
              '8.10 per element\n' +
              'groups of five, each sorted, then a recursive select on the medians',
            result: '2.7× quickselect, paid on every input'
          },
          {
            do: 'Measure sorting the array and indexing it.',
            why: 'It is the one-line answer, and it is usually the right one.',
            work: '259 880 comparisons\n' +
              '12.99 per element — which is about log₂(20 000)',
            result: '4.3× quickselect, and it computes 19 999 orderings nobody asked for'
          },
          {
            do: 'Check three sizes to see which columns are flat and which creep.',
            why: 'A constant that holds and a constant that grows look the same at one size.',
            work: 'n =  5 000: 3.24n | 8.18n | 10.99n\n' +
              'n = 20 000: 2.99n | 8.10n | 12.99n\n' +
              'n = 80 000: 3.92n | 8.27n | 14.99n',
            result: 'the two selection columns stay put and the sorting column tracks log n'
          }
        ],
        answer: 'Finding the median of 20 000 elements costs 59 772 comparisons by quickselect, 161 904 by ' +
          'median of medians and 259 880 by sorting — 2.99n, 8.10n and 12.99n, each the mean of seven ' +
          'pivot seeds. Across 5 000, 20 000 and 80 000 elements the two selection constants stay between ' +
          '2.99 and 8.27 while the sorting column climbs from 10.99 to 14.99, which is log₂ n doing ' +
          'exactly what it says. Median of medians is the only one with a worst-case guarantee, and it costs ' +
          'about 2.7× the expected-linear algorithm on every input to have it.'
      },
      {
        title: 'The question that was actually being asked',
        goal: 'Invert the first example. Selection is rarely the real requirement - "the top k" is - and the ' +
          'best answer to that depends on whether the data is an array or a stream.',
        setup: '20 000 random integers, seed 7, with the smallest k extracted three ways at k = 10, 100 and ' +
          '1 000, all checked against a full sort.',
        steps: [
          {
            do: 'Confirm all three produce the same answer.',
            why: 'Otherwise the comparison is between different operations.',
            work: 'bounded max-heap of size k = 100\n' +
              'quickselect followed by a sort of the first k\n' +
              'a full sort, sliced',
            result: 'identical output at every k'
          },
          {
            do: 'Compare the heap with the select at small k.',
            why: 'This is where the heap should be closest.',
            work: 'k = 10 over 20 000 elements:\n' +
              'heap: one pass, O(n log k) — about n comparisons plus a little\n' +
              'select: O(n), then a sort of 10',
            result: 'both essentially linear; the difference is a small constant'
          },
          {
            do: 'Grow k and watch the heap fall behind.',
            why: 'log k is a real term, and it is the reason the two diverge.',
            work: 'k = 1 000: the heap pays log₂ 1 000 ≈ 10 per element\n' +
              'the select still pays about 2 per element\n' +
              'and the final sort of 1 000 is about 10 000 comparisons',
            result: 'the select pulls ahead as k grows, exactly as the bounds predict'
          },
          {
            do: 'Now change the constraint from comparisons to memory.',
            why: 'This is the axis that usually decides, and it is not in either bound.',
            work: 'heap: holds 100 elements, sees each input once, never needs the array\n' +
              'quickselect: needs all n elements resident, and permutes them',
            result: 'the heap works on a stream of a billion records; the select does not'
          },
          {
            do: 'State when "sort then slice" is still right.',
            why: 'It is the default, and defaults deserve a defence.',
            work: 'one line, obviously correct, gives every other order statistic free\n' +
              'costs log₂ n ÷ 2 ≈ 7× a select at 20 000 elements',
            result: 'right until the sort is the profile\'s hot path, and then the answer is a select'
          }
        ],
        answer: 'The bounded heap, quickselect-plus-partial-sort and a full sort all return the identical top ' +
          'k. The select wins on comparisons and wins by more as k grows, since the heap pays log k per ' +
          'element. But the heap holds only k elements and sees each input once, so it is the only one of the ' +
          'three that works when the data is a stream rather than an array - and that is a memory argument ' +
          'that neither complexity class mentions. "Sort then slice" stays the right default until a profile ' +
          'says otherwise, and the fix then is a select, not a faster sort.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));

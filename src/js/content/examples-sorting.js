/** Worked examples for the sorting sections (M10.1-M10.3). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'sorting-contract': [
      {
        title: 'Four sorts, one input, four different costs',
        goal: 'Run the elementary sorts over identical data and read the four counters separately, so that ' +
          '"which is faster" turns into "faster at what".',
        setup: '2 000 random integers, seed 3, sorted by insertion, selection, bubble and shell sort through ' +
          'the same instrumented primitives.',
        steps: [
          {
            do: 'Read the comparison column first.',
            why: 'It is the one the lower bound is about, and the one that varies least between the four.',
            work: 'shell      29 853\n' +
              'insertion 993 838\n' +
              'bubble  1 994 247\n' +
              'selection 1 999 000',
            result: 'a spread of 67× among four sorts of the same 2 000 elements'
          },
          {
            do: 'Check selection sort against the formula rather than trusting the counter.',
            why: 'If the measured value is exactly n(n−1)/2 there is nothing probabilistic about it.',
            work: '2 000 × 1 999 / 2 = 1 999 000\n' +
              'measured on random input: 1 999 000\n' +
              'measured on sorted input: 1 999 000',
            result: 'identical on every shape - selection sort cannot see its input'
          },
          {
            do: 'Now read the move column, which reverses the ranking.',
            why: 'A comparison is a question and a move is a copy, and they are not the same budget.',
            work: 'selection     3 984 moves, 1 992 swaps\n' +
              'shell        23 509 moves\n' +
              'insertion   993 828 moves\n' +
              'bubble    1 983 686 moves',
            result: 'selection sort does the most comparisons and the fewest moves, by a factor of 250'
          },
          {
            do: 'Decide which of them you would use for a 2 000-element array of large records.',
            why: 'The answer changes with the size of an element, which is not in any complexity class.',
            work: 'an element of 4 bytes: moves are free, comparisons dominate → shell\n' +
              'an element of 4 KB: 3 984 moves against 1 983 686 → selection\n' +
              'an already-ordered array: 1 999 comparisons and 0 moves → insertion',
            result: 'three different answers from one table, and none of them from the asymptotics'
          },
          {
            do: 'Switch the shape to "already sorted" and read the same four rows.',
            why: 'Adaptivity is the fourth clause of the contract, and this is where it shows.',
            work: 'insertion  1 999 comparisons, 0 moves\n' +
              'bubble     1 999 comparisons, 0 moves\n' +
              'shell     15 194 comparisons, 0 moves\n' +
              'selection 1 999 000 comparisons',
            result: 'two of the four collapse to one comparison per element, and one does not move at all'
          }
        ],
        answer: 'The same 2 000 elements cost 29 853 comparisons through shell sort and 1 999 000 through ' +
          'selection sort, and selection sort does 3 984 moves where bubble sort does 1 983 686. There is no ' +
          'ordering of these four algorithms that survives a change of input shape or a change of element ' +
          'size, which is what it means to say a sort is a contract rather than an operation. Selection ' +
          'sort\'s 1 999 000 is exactly n(n−1)/2 and is the same number on every shape, which is the ' +
          'clearest possible statement of what "not adaptive" means.'
      },
      {
        title: 'Handing a broken comparator to the real sort',
        goal: 'Invert the first example. Instead of comparing algorithms under a correct comparator, hold the ' +
          'algorithm fixed and break the contract - then look at what the platform does about it.',
        setup: '40 integers and `Array.prototype.sort`, called five times with five comparators: one correct, ' +
          'one returning a boolean, one absent, one random, and one that returns 1 for equal values.',
        steps: [
          {
            do: 'State what the sort is entitled to assume.',
            why: 'Because the failures below are all consequences of one of these three being false.',
            work: 'compare(x, x) = 0 — irreflexive on equality\n' +
              'sign(compare(a, b)) = −sign(compare(b, a)) — antisymmetric\n' +
              'a < b and b < c implies a < c — transitive',
            result: 'a strict weak ordering, which is what "comparison sort" means'
          },
          {
            do: 'Call it with `(a, b) => a > b`.',
            why: 'This is the most common broken comparator in JavaScript by a wide margin.',
            work: '`true` becomes 1 and `false` becomes 0\n' +
              'so every pair where a <= b reports "equal"\n' +
              'roughly half of all pairs claim equality',
            result: 'no exception, no warning, and an array that is not sorted'
          },
          {
            do: 'Call it with no comparator at all.',
            why: 'The default is not "natural order"; it is a specified string comparison.',
            work: 'elements are converted to strings and compared by UTF-16 code unit\n' +
              '[1, 2, 10] → [1, 10, 2]\n' +
              '[5, 40, 300] → [300, 40, 5]',
            result: 'a different order, and one that looks correct on single-digit test data'
          },
          {
            do: 'Call it with a comparator that returns a random sign.',
            why: 'It breaks antisymmetry and transitivity at once, which is the worst case.',
            work: 'compare(a, b) and compare(b, a) disagree\n' +
              'the axiom audit reports violations over a sample of pairs and triples\n' +
              'the sort still returns an array of the same 40 elements',
            result: 'still no exception - the contract is not checked anywhere'
          },
          {
            do: 'Compare that with what other languages do.',
            why: 'The same mistake has three different consequences, and only one of them is silent.',
            work: 'C++: undefined behaviour — std::sort may read out of bounds\n' +
              'Java: IllegalArgumentException, "Comparison method violates its general contract"\n' +
              'JavaScript: returns a wrong order',
            result: 'the language that never crashes is the one where the bug survives longest'
          }
        ],
        answer: 'Every broken comparator here returns from `Array.prototype.sort` without an exception, and ' +
          'four of the five produce an order that is not sorted. `(a, b) => a > b` is the common one and it ' +
          'is the worst kind of wrong: `false` coerces to 0, so the sort is told most pairs are equal and ' +
          'returns something *nearly* ordered. C++ calls this undefined behaviour and Java throws when it ' +
          'notices; JavaScript does neither, which means the only defence is writing comparators that return ' +
          'a number and being suspicious of output that is almost right.'
      }
    ],

    'merge-sort': [
      {
        title: 'The same merges, scheduled four ways',
        goal: 'Show that top-down, bottom-up, natural and in-place merge sort differ in bookkeeping rather ' +
          'than in algorithm, and price the bookkeeping.',
        setup: '2 000 random integers, seed 3, through all four schedules with comparisons, moves, swaps and ' +
          'allocations counted separately.',
        steps: [
          {
            do: 'Compare the comparison counts.',
            why: 'If the four are really the same merges, this column should barely move.',
            work: 'top-down   19 407\n' +
              'bottom-up  19 420\n' +
              'natural    21 281\n' +
              'in-place   26 763',
            result: 'the two schedules that do identical merges agree to within 13 comparisons'
          },
          {
            do: 'Now compare the move counts.',
            why: 'This is where the scheduling actually shows up.',
            work: 'bottom-up  24 000 moves\n' +
              'top-down   43 904 moves\n' +
              'in-place  102 734 moves and 51 367 swaps',
            result: 'bottom-up does 45% fewer moves for the same comparisons'
          },
          {
            do: 'Explain the factor of two rather than accepting it.',
            why: 'A number without a mechanism is a number you cannot predict next time.',
            work: 'top-down merges into the buffer, then copies the range back — two passes per level\n' +
              'bottom-up swaps the roles of array and buffer each pass — one pass per level\n' +
              '⌈log₂ 2 000⌉ = 11 levels, and 2 000 × 11 ≈ 22 000',
            result: '24 000 is one pass per level; 43 904 is two'
          },
          {
            do: 'Read the allocation column.',
            why: 'It is the one people quote and the one that has the fewest distinct values.',
            work: 'top-down, bottom-up, natural: 1 allocation of 2 000 slots\n' +
              'in-place: 0 allocations\n' +
              'and 51 367 swaps to pay for it',
            result: 'O(1) space costs 2.3× the data movement'
          },
          {
            do: 'Check that all four are still stable.',
            why: 'If one of them lost stability the comparison would be between different operations.',
            work: '400 elements tagged with their original index, 8 distinct keys\n' +
              'every schedule checked for a pair of equal keys out of order',
            result: '0 inversions among equals, in all four'
          }
        ],
        answer: 'The four schedules do the same merges: 19 407 and 19 420 comparisons for top-down and ' +
          'bottom-up, and the difference is entirely in movement - 43 904 moves against 24 000, because the ' +
          'textbook recursion copies each merged range back and the loop swaps buffers instead. In-place ' +
          'merging removes the allocation completely and pays 102 734 moves and 51 367 swaps for it. All ' +
          'four remain stable. The lesson is that "merge sort is O(n log n) and needs O(n) space" describes a ' +
          'family whose members differ by a factor of two in the cost that actually dominates.'
      },
      {
        title: 'The runs that are already there',
        goal: 'Invert the first example: stop varying the schedule and vary the input, to show that the ' +
          'natural variant is the only one whose cost depends on the order already present.',
        setup: 'The same 2 000 elements in five shapes, sorted by natural merge sort, with the run count and ' +
          'the merge-pass count reported.',
        steps: [
          {
            do: 'Run it on already-sorted input.',
            why: 'This is the best case, and the size of the best case is the point.',
            work: 'run detection finds 1 run\n' +
              '0 merge passes\n' +
              '2 000 comparisons — one per element',
            result: 'a sorted array costs a single linear scan'
          },
          {
            do: 'Run it on reversed input.',
            why: 'The worst case for insertion sort, and a best case here for a reason worth stating.',
            work: 'the detector finds one strictly descending run and reverses it in place\n' +
              '1 run, 0 merge passes\n' +
              '2 000 comparisons and 1 000 swaps',
            result: 'reversed input is also one pass'
          },
          {
            do: 'Say why the descent test has to be strict.',
            why: 'Using `<=` would find longer runs and quietly break stability.',
            work: 'a strictly descending run contains no equal elements\n' +
              'so reversing it cannot put two equals in the wrong order\n' +
              'with `<=` the run may contain equals, and the reversal inverts them',
            result: 'the strictness is what makes the reversal free rather than wrong'
          },
          {
            do: 'Run it on organ-pipe input — ascending then descending.',
            why: 'Two runs is the case between the extremes, and the arithmetic should be visible.',
            work: '2 runs of 1 000\n' +
              '1 merge pass\n' +
              '4 000 comparisons',
            result: 'one merge of two thousand-element runs, exactly as predicted'
          },
          {
            do: 'Run it on random input and compare with the fixed schedules.',
            why: 'The variant has to be priced on the case it does not help.',
            work: 'random: runs of about 2 elements\n' +
              'natural 21 281 comparisons against bottom-up\'s 19 420\n' +
              'the run detection is a wasted pass',
            result: 'on random data the natural variant is 10% worse, and that is the whole downside'
          }
        ],
        answer: 'Natural merge sort costs 2 000 comparisons and zero merges on sorted input, the same on ' +
          'reversed input, 4 000 with one merge on organ-pipe, and 21 281 on random - about 10% worse than ' +
          'the plain bottom-up schedule, because random data has runs of about two and detecting them buys ' +
          'nothing. That asymmetry is the whole design: a bounded loss on the input that has no structure, ' +
          'against a collapse to linear on the inputs that do. It is also exactly the bet Timsort makes, at ' +
          'a larger scale and with the run lengths managed rather than merely detected.'
      }
    ],

    quicksort: [
      {
        title: 'The all-equal array, three ways',
        goal: 'Take the input that duplicate-heavy real data approximates and measure what each partition ' +
          'scheme does with it.',
        setup: '2 000 identical values, partitioned by Lomuto, Hoare and three-way, each with its usual pivot ' +
          'rule, with comparisons, recursion depth and partition count reported.',
        steps: [
          {
            do: 'Predict what Lomuto does before measuring it.',
            why: 'The behaviour follows from one comparison in the partition loop.',
            work: 'Lomuto moves an element left only when it is *strictly* less than the pivot\n' +
              'no element is strictly less than the pivot here\n' +
              'so the split is n−1 to 0, at every level',
            result: 'a prediction of n levels and about n²/2 comparisons'
          },
          {
            do: 'Measure it.',
            why: 'A prediction from one line of code should be exact, not approximate.',
            work: '2 004 997 comparisons\n' +
              'recursion depth 2 000\n' +
              '1 999 partitions',
            result: 'one partition per element, and 2 000 × 2 001 / 2 ≈ 2 001 000'
          },
          {
            do: 'Run Hoare\'s scheme on the identical input.',
            why: 'Its two pointers stop on elements equal to the pivot, and that is the only difference.',
            work: '31 723 comparisons\n' +
              'recursion depth 12\n' +
              'the split is down the middle because both pointers halt',
            result: '63× fewer comparisons from a different partition loop'
          },
          {
            do: 'Run three-way partitioning.',
            why: 'It places the equal block and never recurses into it.',
            work: '1 partition\n' +
              '2 012 comparisons\n' +
              'recursion depth 2',
            result: 'a single linear pass - the whole array was one equal block'
          },
          {
            do: 'Check the same three on a realistic duplicate-heavy input rather than the extreme one.',
            why: 'The all-equal case is a limit; the interesting question is whether it is a cliff or a slope.',
            work: '2 000 elements over 3 distinct values:\n' +
              'Lomuto 676 647 | Hoare 32 506 | three-way 3 389',
            result: 'a factor of 200 between the two schemes on data that looks ordinary'
          }
        ],
        answer: 'On 2 000 identical elements Lomuto partitioning does 2 004 997 comparisons at recursion ' +
          'depth 2 000, Hoare does 31 723 at depth 12, and three-way does 2 012 in a single partition. On the ' +
          'more realistic case of three distinct values the figures are 676 647, 32 506 and 3 389. None of ' +
          'that is a property of quicksort; it is a property of the partition loop, and specifically of ' +
          'whether elements equal to the pivot stop the scan, get pushed to one side, or get placed and ' +
          'retired. A status column is exactly this input.'
      },
      {
        title: 'Building the input that defeats your pivot rule',
        goal: 'Invert the first example: instead of finding an input that is bad for an algorithm, construct ' +
          'one against a chosen algorithm - and then show that the depth limit removes the damage without ' +
          'changing the good cases.',
        setup: 'McIlroy\'s anti-quicksort against Lomuto with a median-of-three pivot, at 512, 1 024 and ' +
          '2 048 elements, then the same inputs through introsort.',
        steps: [
          {
            do: 'Describe how the adversary works.',
            why: 'It proves the failure is systematic rather than unlucky.',
            work: 'sort a permutation with a comparator that has not decided the values\n' +
              'when two undecided elements are compared, commit the non-pivot to the next smallest value\n' +
              'every pivot the algorithm picks therefore turns out to be extreme',
            result: 'a permutation of 0..n−1 built specifically against that pivot rule'
          },
          {
            do: 'Run plain quicksort on the result.',
            why: 'The claim is a quadratic, so it should cross n²/4.',
            work: 'n =   512:    66 304 comparisons, depth  257 (n²/4 =    65 536)\n' +
              'n = 1 024:   263 680 comparisons, depth  513 (n²/4 =   262 144)\n' +
              'n = 2 048: 1 051 648 comparisons, depth 1025 (n²/4 = 1 048 576)',
            result: 'above n²/4 at every size, and the depth is n/2'
          },
          {
            do: 'Check that the output is still correct.',
            why: 'This is the part that makes the failure hard to find.',
            work: 'every element compared against a reference sort\n' +
              '0 out of place, at every size',
            result: 'a perfectly correct sort that took a hundred times too long'
          },
          {
            do: 'Run introsort on the identical input.',
            why: 'The depth limit should remove the tail and nothing else.',
            work: 'n =   512:  4 970 comparisons, depth 10\n' +
              'n = 1 024: 10 999 comparisons, depth 11\n' +
              'n = 2 048: 24 526 comparisons, depth 13',
            result: '43× fewer comparisons on the input built to defeat the pivot rule'
          },
          {
            do: 'Now build an adversary against introsort\'s own configuration and watch the escape fire.',
            why: 'If the fallback never triggers, the bound is a claim rather than a mechanism.',
            work: 'anti-quicksort against three-way partitioning with a ninther pivot, n = 2 048\n' +
              'without a depth limit: 361 451 comparisons, depth 344\n' +
              'with the limit: 78 223 comparisons, depth 22, 1 heapsort escape',
            result: 'the escape hatch fires once and caps the depth at 22'
          }
        ],
        answer: 'The adversary drives median-of-three quicksort to 1 051 648 comparisons on 2 048 elements - ' +
          'above n²/4 - at recursion depth 1 025, while returning perfectly sorted output. Introsort on the ' +
          'same input does 24 526 at depth 13. Build a second adversary against introsort\'s own ninther rule ' +
          'and the depth limit fires: 344 levels become 22, with one heapsort escape. The lesson is that no ' +
          'deterministic pivot rule is safe - the demo constructs a killer for whichever one you pick - and ' +
          'the engineering answer is a depth counter rather than a cleverer pivot.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));

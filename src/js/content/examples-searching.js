/** Worked examples for the searching and practice sections (M10.7-M10.10). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'binary-search': [
      {
        title: 'Seven implementations, and how few inputs notice',
        goal: 'Run the correct binary search and six one-character mutations of it against thirteen ' +
          'deliberately chosen probe cases, and read the distribution of how many cases catch each.',
        setup: 'Thirteen checks: an empty array, a single element, all-equal, targets below, above, at the ' +
          'first and last positions, inside a duplicate block, and absent in the interior.',
        steps: [
          {
            do: 'Establish the control.',
            why: 'If the correct version fails a probe, the probes are wrong rather than the code.',
            work: 'the invariant version: half-open [low, high), high starts at length\n' +
              'checked against a linear scan on all 13',
            result: 'caught by 0 of 13'
          },
          {
            do: 'Change `high = length` to `high = length - 1` and re-run.',
            why: 'This is the version you get by drawing the array and pointing at the last element.',
            work: 'the last position is never inspected\n' +
              'caught by 3 of 13\n' +
              'first failure: a single element with a target above it — returns 0, should return 1',
            result: 'three cases notice, and all three involve the far end'
          },
          {
            do: 'Change `high = mid` to `high = mid - 1`.',
            why: 'It looks symmetric with the `low = mid + 1` on the other branch, and is not.',
            work: 'it discards the answer itself when the probe lands on it\n' +
              'caught by 1 of 13\n' +
              'the only case that catches it: target absent, in the interior',
            result: 'one probe case out of thirteen stands between this and production'
          },
          {
            do: 'Change the loop to `while (low <= high)` with high still at length.',
            why: 'This is the mutation that makes the case for instrumented testing.',
            work: 'it reads array[10 000] of a 10 000-element array; JavaScript yields undefined\n' +
              'every comparison against undefined is false\n' +
              'so it takes the branch it would have taken and returns the correct index',
            result: 'caught by 4 of 13 — every one of them by the out-of-bounds read, never by a wrong answer'
          },
          {
            do: 'Say what that same code does elsewhere.',
            why: 'The severity is language-dependent and the bug is not.',
            work: '1 defect, 3 languages, 3 outcomes:\n' +
              'C: reads whatever is next in memory — undefined behaviour\n' +
              'Java: ArrayIndexOutOfBoundsException, immediately\n' +
              'JavaScript: the right answer, silently',
            result: 'the language that never crashes is the one where it survives'
          }
        ],
        answer: 'The correct implementation is caught by 0 of 13 probes and every mutation by at least one, ' +
          'but the distribution is the point: `high = mid - 1` is caught by exactly one case, and ' +
          '`while (low <= high)` is never caught by a wrong answer at all - only by watching for a read past ' +
          'the end of the array. A hand-written test that omits "target absent in the interior" ships the ' +
          'first; no output-only test can catch the second in JavaScript, while the identical code throws in ' +
          'Java. Test binary search against a linear scan over every length from zero and every boundary target.'
      },
      {
        title: 'The variants, and the assumption each one is buying',
        goal: 'Invert the first example: instead of breaking the standard search, keep it correct and change ' +
          'what it assumes - then measure what each assumption is worth and what it costs when false.',
        setup: 'Ten thousand keys in two distributions - uniform (i × 3) and expanding-gap - searched by ' +
          'lower bound, branchless lower bound, interpolation search and exponential search.',
        steps: [
          {
            do: 'Measure the baseline.',
            why: 'Everything else is priced against it.',
            work: '⌈log₂ 10 000⌉ = 14 is the bound\n' +
              'measured: 13 comparisons, on both distributions\n' +
              'it assumes only that the array is sorted',
            result: 'thirteen probes, and the same thirteen whatever the values are'
          },
          {
            do: 'Measure interpolation search on the uniform keys.',
            why: 'Its whole claim is that guessing beats halving when the keys are evenly spread.',
            work: 'guess = low + (target − a[low]) / (a[high] − a[low]) × (high − low)\n' +
              'measured: 1 probe',
            result: 'the extrapolation lands on the answer'
          },
          {
            do: 'Measure it on keys whose gaps grow.',
            why: 'The estimate is a straight line, so this is where the assumption fails.',
            work: 'the same 10 000 elements, growing geometrically\n' +
              'measured: 13 probes',
            result: 'thirteen against the binary search\'s thirteen - the advantage is gone entirely'
          },
          {
            do: 'Measure exponential search for a target near the front.',
            why: 'It is the variant for an unbounded or streamed sequence, and it should not pay for the length.',
            work: 'target at index 3\n' +
              'the bound doubles to 4, then searches [2, 5)',
            result: 'O(log i) rather than O(log n) - it never looks at the far end'
          },
          {
            do: 'Measure the branchless version, and read the result carefully.',
            why: 'It does *more* comparisons, which is the opposite of what the name suggests.',
            work: 'branchless: 15 comparisons, on both distributions\n' +
              'plain lower bound: 13\n' +
              'the branchless loop has no early exit - it always runs ⌈log₂ n⌉ + 1 steps',
            result: 'a fixed cost with no data-dependent branch, bought with two extra comparisons'
          }
        ],
        answer: 'Interpolation search finds a target among 10 000 uniform keys in a single probe and needs 13 ' +
          'on geometrically growing ones - exactly what the plain binary search needs on both, so the whole ' +
          'advantage is a property of the distribution rather than of the algorithm. Exponential search finds ' +
          'an element at index 3 by doubling a bound to 4, which is O(log i) rather than O(log n) and is the ' +
          'only one of these that works without knowing the length. And the branchless variant does 15 ' +
          'comparisons where the plain one does 13: it has no early exit, so its cost is fixed and its branch ' +
          'is not. Whatever it wins is in branch prediction, and no counter in this milestone can see it.'
      }
    ],

    'searching-the-answer': [
      {
        title: 'Five checks over forty-six candidates',
        goal: 'Turn "the smallest ship capacity that delivers these packages in D days" into a binary search, ' +
          'and verify the predicate is monotone before trusting the search.',
        setup: 'Packages of weights 1 through 10, to be shipped in order, in 5 days. Capacity is at least the ' +
          'heaviest package and at most their sum.',
        steps: [
          {
            do: 'Name the answer and bound it.',
            why: 'The range has to be finite and it has to be obviously correct at both ends.',
            work: 'lower bound: 10 — the heaviest package must fit at all\n' +
              'upper bound: 55 — the sum, which ships everything in one day\n' +
              '46 candidate capacities',
            result: 'a bounded integer range, with feasibility guaranteed at the top'
          },
          {
            do: 'Write the feasibility check and nothing else.',
            why: 'This is the only bespoke code; the search is boilerplate.',
            work: 'walk the packages in order, filling a day until the next one would exceed the capacity\n' +
              'then start a new day\n' +
              'feasible(c) = the number of days used is at most 5',
            result: 'a linear pass that can be verified by reading it'
          },
          {
            do: 'Check that the predicate is monotone across the whole range.',
            why: 'Skipping this step does not produce an error, it produces a confident wrong answer.',
            work: 'evaluate feasible(c) for every c from 10 to 55\n' +
              'count the places the boolean sequence changes value',
            result: 'exactly 1 flip - false below the answer, true from it up'
          },
          {
            do: 'Binary-search for the first true.',
            why: 'The same half-open invariant as an array search, over candidates rather than indices.',
            work: '5 feasibility checks over 46 candidates\n' +
              'each check is a linear pass over 10 packages',
            result: 'the answer is 15'
          },
          {
            do: 'Compare that with the sweep it replaces.',
            why: 'The saving is the whole reason to bother, and it grows with the range.',
            work: 'sweep: 46 checks\n' +
              'search: 5 checks\n' +
              'a range of a billion: 1 000 000 000 against 30',
            result: 'the advantage is logarithmic, so it is small here and decisive at scale'
          }
        ],
        answer: 'The smallest capacity that ships packages 1..10 in 5 days is 15, found in 5 feasibility ' +
          'checks over a range of 46 candidates. Nothing was sorted: what the search walks is the boolean ' +
          'array the predicate induces, which is false up to 14 and true from 15 on. The monotonicity check ' +
          'confirms exactly one flip, which is what licenses the search - and it is exhaustive here precisely ' +
          'because these ranges are small enough to sweep in a test and too large to sweep in production.'
      },
      {
        title: 'The predicate that flips three times',
        goal: 'Invert the first example: run the identical search on a predicate that is not monotone, and on ' +
          'a problem that searches for the largest feasible value rather than the smallest.',
        setup: 'A predicate that is true at 3 and from 7 upward over the range [0, 10], and the aggressive-cows ' +
          'problem, which maximises rather than minimises.',
        steps: [
          {
            do: 'Run the monotonicity check on the bumpy predicate.',
            why: 'It is the step the technique depends on, and it is cheap on a small range.',
            work: 'feasible(x) = x = 3 or x >= 7, over [0, 10]\n' +
              'the boolean sequence changes value 3 times',
            result: 'not monotone - the search is not licensed'
          },
          {
            do: 'Run the binary search on it anyway.',
            why: 'To see what "not licensed" actually looks like from the outside.',
            work: 'binary search returns 7\n' +
              'the smallest true value is 3\n' +
              'nothing was raised, nothing was logged',
            result: 'a confident wrong answer, with no diagnostic anywhere'
          },
          {
            do: 'Switch to a problem that maximises.',
            why: 'Aggressive cows asks for the largest minimum gap, which is a different loop.',
            work: 'stalls at 1, 2, 4, 8, 9 and 3 cows\n' +
              'feasible(d) = greedily placing cows at least d apart fits all 3\n' +
              'this predicate is true-then-false',
            result: 'a last-true search rather than a first-true one, answer 3 in 3 checks'
          },
          {
            do: 'Show why negating the predicate is not the fix.',
            why: 'It is the obvious shortcut and it is off by one.',
            work: 'firstTrue on !feasible, minus 1\n' +
              'correct whenever some value is infeasible\n' +
              'one too small when the entire range is feasible',
            result: 'right on most instances, wrong on the boundary case'
          },
          {
            do: 'Note the midpoint the maximising loop needs.',
            why: 'The rounding direction is not cosmetic here.',
            work: 'last-true keeps the candidate on success: lo = mid\n' +
              'with a rounded-down midpoint and hi = lo + 1, mid equals lo\n' +
              'the interval never shrinks',
            result: 'the midpoint must round up, or the loop never ends'
          }
        ],
        answer: 'A predicate that flips three times over [0, 10] makes the binary search return 7 where the ' +
          'smallest true value is 3 - confidently, with nothing raised. That is why the monotonicity check ' +
          'belongs in the code and not only in the reasoning. The maximising form needs its own loop rather ' +
          'than a negated predicate: negating is one too small whenever the whole range is feasible, and the ' +
          'midpoint has to round up or an interval of width one never shrinks - the same trap as the ' +
          '`low = mid` binary-search mutation, arrived at from the other direction.'
      }
    ],

    'external-sorting': [
      {
        title: 'Removing a pass rather than saving comparisons',
        goal: 'Sort more records than fit in memory, and show that the figure worth optimising is the number ' +
          'of passes over the data rather than the comparison count.',
        setup: '10 000 records with 100 resident and a 4-way merge, sorted twice: once with sort-and-flush ' +
          'run generation and once with replacement selection.',
        steps: [
          {
            do: 'Generate runs by filling memory, sorting and flushing.',
            why: 'It is the obvious method and its run count is exactly predictable.',
            work: '⌈10 000 / 100⌉ = 100 runs\n' +
              'mean run length 100.0 — exactly the records resident',
            result: '100 runs to merge, 4 at a time'
          },
          {
            do: 'Generate them by replacement selection instead.',
            why: 'The heap can extend a run past the memory it holds, and by a predictable factor.',
            work: 'emit the smallest resident record still >= the last one written\n' +
              'freeze anything smaller for the next run\n' +
              'measured: 51 runs, mean length 196.1',
            result: 'about 2M, which is Knuth\'s snowplough result'
          },
          {
            do: 'Count the merge passes each needs.',
            why: 'Pass count is a ceiling of a logarithm, so it moves in whole steps.',
            work: '100 runs, 4-way: ⌈log₄ 100⌉ = 4 passes\n' +
              ' 51 runs, 4-way: ⌈log₄  51⌉ = 3 passes',
            result: 'halving the runs removed a complete pass'
          },
          {
            do: 'Convert that into record transfers.',
            why: 'A pass is a full read and a full write, so the saving is concrete.',
            work: 'sort-and-flush:        100 000 record transfers\n' +
              'replacement selection:  80 000\n' +
              'and the run generation itself read and wrote each record exactly once in both cases',
            result: '20% of all I/O removed for no extra work'
          },
          {
            do: 'Now raise the merge order and watch the same lever from the other side.',
            why: 'The merge order is the base of the logarithm, which is the only term that matters.',
            work: 'order  2: 7 passes, 160 000 transfers\n' +
              'order  4: 4 passes, 100 000\n' +
              'order  8: 3 passes,  80 000\n' +
              'order 16: 2 passes,  60 000',
            result: 'the comparison count barely moves down that column, and the I/O falls by 2.7×'
          }
        ],
        answer: 'Replacement selection produced 51 runs of mean length 196.1 where sort-and-flush produced ' +
          '100 of length 100 - the 2M snowplough result - and that halving removed a whole merge pass: four ' +
          'down to three, 100 000 record transfers down to 80 000, for identical reads and writes during run ' +
          'generation. Raising the merge order from 2 to 16 does the same thing from the other side: 7 passes ' +
          'to 2, and 160 000 transfers to 60 000, while the comparison count barely changes. In the external ' +
          'model the pass is the unit of cost, and both levers buy passes.'
      },
      {
        title: 'A sort you can prove correct by exhaustion',
        goal: 'Invert the first example: instead of a sort whose cost is measured in passes, take one whose ' +
          'cost is fixed and whose correctness can be settled completely.',
        setup: 'Bitonic, odd-even merge and insertion networks at 4, 8 and 16 wires, each checked against ' +
          'every zero-one input, and one comparator deleted at a time.',
        steps: [
          {
            do: 'Read the two cost columns and notice they answer different questions.',
            why: 'Quoting only one of them is how networks get misdescribed in both directions.',
            work: 'n =    8: bitonic 24 comparators, depth  6\n' +
              'n =   16: bitonic 80 comparators, depth 10\n' +
              'n = 1 024: bitonic 28 160 comparators, depth 55',
            result: 'more total work than merge sort, in far fewer dependent steps'
          },
          {
            do: 'Check the depth against the formula.',
            why: 'If it matches exactly, the layout is really assigning independent comparators to rounds.',
            work: 'log₂(n) × (log₂(n) + 1) / 2\n' +
              'n = 8 → 6, n = 16 → 10, n = 64 → 21, n = 1 024 → 55',
            result: 'exact at every size'
          },
          {
            do: 'Apply the zero-one principle.',
            why: 'It turns an infinite verification problem into a finite one.',
            work: 'a comparator network sorts all inputs iff it sorts all 2^n binary inputs\n' +
              '4 wires: 16 inputs | 8 wires: 256 | 16 wires: 65 536\n' +
              'all three networks, all three sizes',
            result: '0 failures - a proof rather than a sample'
          },
          {
            do: 'Delete one comparator at a time and re-verify.',
            why: 'It measures how much a randomised test would have to be trusted.',
            work: 'bitonic on 8 wires, each of its 24 comparators removed in turn\n' +
              'caught by between 1 and 225 of the 256 zero-one inputs',
            result: 'the most forgiving deletion is caught by exactly one input in 256'
          },
          {
            do: 'Price the power-of-two requirement.',
            why: 'It is the constraint that decides where networks are usable at all.',
            work: 'n = 1 024: 28 160 comparators, depth 55, no padding\n' +
              'n = 1 025: pads to 2 048 — 67 584 comparators, depth 66, 1 023 sentinels',
            result: 'one extra element costs 2.4× the comparators'
          }
        ],
        answer: 'All three networks pass exhaustive zero-one verification at 4, 8 and 16 wires - 65 536 inputs ' +
          'settle a 16-wire network completely, which is a proof rather than a sample and the only such ' +
          'argument available anywhere in this milestone. Bitonic\'s depth is exactly log₂(n)(log₂(n)+1)/2 at ' +
          'every size. Deleting a single comparator from the 8-wire network is caught by between 1 and 225 of ' +
          'the 256 binary inputs, so a randomised test would need luck where the exhaustive one cannot miss. ' +
          'And the padding requirement is a cliff: 1 025 elements pay for 2 048.'
      }
    ],

    'sorting-in-practice': [
      {
        title: 'The ranking, and how completely it moves',
        goal: 'Run every sort from this milestone across every input shape and read the table as a whole ' +
          'rather than a row at a time.',
        setup: '2 000 elements per shape, seed 3, fifteen implementations, comparisons counted through the ' +
          'same instrumented comparator.',
        steps: [
          {
            do: 'Find the winner on each shape.',
            why: 'If the same algorithm won every column there would be nothing to choose.',
            work: 'random         Timsort        19 399\n' +
              'sorted         insertion       1 999\n' +
              'nearly sorted  Timsort         3 099\n' +
              'few unique     three-way       3 389\n' +
              'reversed       natural merge   2 000\n' +
              'organ pipe     natural merge   4 000',
            result: 'four different winners across six shapes'
          },
          {
            do: 'Follow one algorithm across the row instead.',
            why: 'A single row is what a benchmark on one input would have reported.',
            work: 'Lomuto quicksort, median-of-three:\n' +
              'random 25 011 | sorted 21 033 | nearly sorted 104 120\n' +
              'few unique 676 647 | organ pipe 323 989 | adversarial 1 003 000',
            result: 'excellent, then 40× worse, on data that all looks ordinary'
          },
          {
            do: 'Check the one row that never moves.',
            why: 'It is the clearest possible definition of "not adaptive".',
            work: 'selection sort: 1 999 000 on every one of the seven shapes\n' +
              '2 000 × 1 999 / 2 = 1 999 000',
            result: 'identical to the digit, seven times'
          },
          {
            do: 'Check the row with no comparisons at all.',
            why: 'It is in the table on different terms from everything else.',
            work: 'LSD radix: 0 comparisons on every shape\n' +
              'its cost is entirely in the move column: 4 000 to 8 000',
            result: 'not a comparison sort, so the comparison column cannot rank it'
          },
          {
            do: 'Apply a requirement and watch candidates disappear.',
            why: 'This is what makes it a chooser rather than a leaderboard.',
            work: 'requiring stability removes 4 candidates - quicksort, pdqsort, shell and selection sort\n' +
              'whatever their comparison counts',
            result: 'the fastest eligible sort, not the fastest sort'
          }
        ],
        answer: 'Six input shapes produce four different winners, and Lomuto quicksort with a median-of-three ' +
          'pivot ranges from 21 033 comparisons to 1 003 000 across them - a factor of 48 on data that all ' +
          'looks ordinary. Selection sort reports exactly 1 999 000 on all seven shapes and LSD radix reports ' +
          'zero comparisons on all seven. There is no ordering of these algorithms that survives a change of ' +
          'input, which is why the chooser takes the workload as its input and why a benchmark on uniform ' +
          'random data measures one column and reports it as the table.'
      },
      {
        title: 'The default that sorts numbers as strings',
        goal: 'Invert the first example: stop choosing between sorts and look at the one everybody actually ' +
          'calls, and the ways it goes wrong in this language specifically.',
        setup: 'Real calls to `Array.prototype.sort` evaluated in the page, plus a three-key table sort with ' +
          'accented names.',
        steps: [
          {
            do: 'Call `sort()` with no comparator on small numbers.',
            why: 'It is the case that makes the bug survive review.',
            work: '[1, 2, 3].sort() → [1, 2, 3]\n' +
              '[1, 2, 10].sort() → [1, 10, 2]\n' +
              '[5, 40, 300].sort() → [300, 40, 5]',
            result: 'correct until the values cross a digit boundary'
          },
          {
            do: 'Say what the default comparator actually does.',
            why: '"It sorts wrong" is not a mechanism you can predict from.',
            work: 'each element is converted to a String\n' +
              'the strings are compared by UTF-16 code unit\n' +
              '"10" < "2" because "1" < "2"',
            result: 'a specified, deterministic, entirely wrong-for-numbers ordering'
          },
          {
            do: 'Note when stability became a guarantee.',
            why: 'Code older than that was relying on an accident that depended on array length.',
            work: 'before ES2019 V8 used insertion sort below a threshold and quicksort above\n' +
              'so the same code was stable in a small test and unstable in production\n' +
              'ES2019 made stability normative; V8 now ships a Timsort derivative',
            result: 'a guarantee that is now specified rather than observed'
          },
          {
            do: 'Sort a table by three keys with an explicit tie-break chain.',
            why: 'The alternative - three sorts relying on stability - makes the ordering emergent.',
            work: '3 keys, 1 comparator, 1 sort:\n' +
              'team ascending, then points descending, then name by Intl.Collator\n' +
              'one comparator, one sort',
            result: 'the ordering is stated in one function instead of implied by three calls'
          },
          {
            do: 'Check where the accented names land.',
            why: 'It is the difference between code-unit order and language order.',
            work: 'Intl.Collator with base sensitivity: Ángel sorts next to ana\n' +
              'a raw `<`: Á is U+00C1, so Ángel sorts after every unaccented name',
            result: 'collation is a language question, and `<` does not ask it'
          }
        ],
        answer: '`[1, 2, 10].sort()` returns `[1, 10, 2]` and `[5, 40, 300].sort()` returns `[300, 40, 5]`, ' +
          'because the default comparator stringifies and compares UTF-16 code units - and it survives review ' +
          'because single-digit test data is identical under both orderings. Stability has only been ' +
          'guaranteed since ES2019; before that V8\'s behaviour depended on the array length. And a ' +
          'three-key sort should state its tie-break chain in one comparator rather than running three sorts ' +
          'and trusting stability, with `Intl.Collator` for the string key so that `Ángel` sorts next to ' +
          '`ana` rather than after `z`.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));

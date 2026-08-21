/** Worked examples for the first four dynamic-programming sections (M12.1-M12.4). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'what-dp-is': [
      {
        title: 'One recurrence, three costs',
        goal: 'Put a number on what memoisation buys, and on what it does not change.',
        setup: 'Fibonacci at n = 25, evaluated three ways through one instrument: an unmemoised recursion, ' +
          'a memoised one, and a tabulation over the same states in increasing order.',
        steps: [
          {
            do: 'Run the recurrence with no memo and count the calls.',
            why: 'Every subproblem is recomputed from scratch every time it is needed.',
            work: '242 785 calls, 242 784 transitions, answer 75 025',
            result: 'the call count is 2·F(26) − 1, so it grows at the same rate as the answer'
          },
          {
            do: 'Add a memo and count the distinct states.',
            why: 'The recurrence has not changed; only whether answers are kept has.',
            work: '49 calls, 26 states, 48 transitions, 23 hits, answer 75 025',
            result: '23 of the 49 calls are answered from the table and never recurse'
          },
          {
            do: 'Count how many states have more than one parent.',
            why: 'That count is the measurement of "overlapping subproblems".',
            work: '23 of 26 states are reached from more than one parent',
            result: 'the DAG is not a tree, which is the precondition memoisation needs'
          },
          {
            do: 'Tabulate the same states from 0 upwards.',
            why: 'To check that the bottom-up version is the same algorithm rather than a different one.',
            work: '26 states, 48 transitions, 0 cells read before they were written, answer 75 025',
            result: 'identical state and transition counts — the memo and the table do the same work'
          }
        ],
        answer: 'Three evaluations, one recurrence, one answer of 75 025. The naive run makes 242 785 calls; ' +
          'the memo makes 49 and stores 26 states, of which 23 are shared. Memoisation did not make the ' +
          'recurrence cleverer — it stopped it recomputing a DAG as though it were a tree. The tabulation ' +
          'does exactly the memo\'s work with the order supplied by hand instead of discovered, which is ' +
          'the only difference between them.'
      },
      {
        title: 'The cost before the code, and the order that returns a number anyway',
        goal: 'Predict the complexity from the problem statement, then break the tabulation to see the ' +
          'failure that does not raise.',
        setup: 'The same Fibonacci instance, plus binomial coefficients where the DAG is a lattice rather ' +
          'than a path — and the identical state list run in the wrong order.',
        steps: [
          {
            do: 'Count the states and transitions from the statement alone, before running anything.',
            why: 'States × transitions is the complexity, and it is available in ten seconds.',
            work: '26 states × 2 transitions each = 52',
            result: 'an upper bound, computed with no code, against 48 measured'
          },
          {
            do: 'Do the same for C(20, 10), where each state has two parents rather than one child pair.',
            why: 'To check the habit works on a two-dimensional state as well as a one-dimensional one.',
            work: 'naive 369 511 calls; memo 120 states; tabulation 176 states; answer 184 756',
            result: 'the tabulation fills 176 cells because it does not know which 120 the recursion needs'
          },
          {
            do: 'Count the shared states in the binomial DAG.',
            why: 'A lattice shares far more than a path does, which is why memoisation pays even more here.',
            work: '81 of the 120 states have more than one parent',
            result: 'the DAG is wide as well as deep'
          },
          {
            do: 'Run the same Fibonacci states in decreasing order instead of increasing.',
            why: 'To see what a wrong evaluation order actually does.',
            work: '26 states, 48 transitions, 48 cells read before they were written, answer 0',
            result: 'a number, not an error — the array was allocated full of zeros'
          }
        ],
        answer: 'The prediction of 52 transitions bounds the measured 48, and the same arithmetic works on ' +
          'the binomial lattice. Then the inversion: running the identical states in the wrong order visits ' +
          'the same 26 states, evaluates the same 48 transitions, reads 48 cells that had not been written, ' +
          'and returns 0. Nothing raises, nothing warns, and only a counter of unresolved reads can tell ' +
          'the two runs apart. That is the price of taking responsibility for the evaluation order, and it ' +
          'is exactly the responsibility a memo takes off your hands.'
      }
    ],

    'one-dimensional-dp': [
      {
        title: 'The longest increasing subsequence, twice, with the answer rather than the length',
        goal: 'Measure what the log factor buys, and check that both algorithms return a real subsequence.',
        setup: '2 000 values drawn from a seeded generator in [0, 1000), solved by the O(n²) table with ' +
          'predecessor links and by patience sorting with the same links.',
        steps: [
          {
            do: 'Run the quadratic table and count its transitions.',
            why: 'It considers every earlier index for every index, which is the definition of quadratic.',
            work: '1 999 000 transitions, length 85',
            result: 'exactly n(n − 1)/2, as the loop shape predicts'
          },
          {
            do: 'Run patience sorting, which binary-searches the piles instead.',
            why: 'The pile tops are increasing, so the insertion point can be found in log time.',
            work: '11 411 transitions, length 85',
            result: 'the same length from 175 times fewer transitions'
          },
          {
            do: 'Check that each reconstructed sequence is a genuine subsequence of the input.',
            why: 'A length is not a witness; a list that is not a subsequence is a wrong answer.',
            work: 'both reconstructions pass; 85 values each, in order, all present in the input',
            result: 'the predecessor links did their job in both implementations'
          },
          {
            do: 'Now check the pile tops themselves against the same test.',
            why: 'This is what a patience implementation returns when it skips the links.',
            work: 'piles start 0, 3, 6, 8; the real answer starts 1, 5, 11, 18 — the piles are NOT a subsequence',
            result: 'increasing, exactly 85 long, and not an answer to the question'
          }
        ],
        answer: 'Both algorithms report 85 and both reconstruct a genuine subsequence, from 1 999 000 ' +
          'transitions and 11 411 respectively — a factor of 175. The pile tops are increasing and exactly ' +
          '85 long and are not a subsequence of the input, which is why returning them passes a length ' +
          'check, a sortedness check and a casual read. The only test that separates them is the one that ' +
          'asks whether the answer is an answer.'
      },
      {
        title: 'Two loops, two questions, no error message',
        goal: 'Show a one-line change that alters what is being counted, and check both against an enumeration.',
        setup: 'Counting the ways to make an amount from the coins {1, 2, 5}, with the coin loop outside ' +
          'and then with the amount loop outside, against exhaustive enumeration of multisets.',
        steps: [
          {
            do: 'Put the coin loop outside and count the ways to make 5.',
            why: 'Each coin is offered to every amount once, so each multiset is reached once.',
            work: '4 ways; exhaustive enumeration of multisets also gives 4',
            result: '{5}, {2,2,1}, {2,1,1,1}, {1,1,1,1,1} — combinations'
          },
          {
            do: 'Swap the loops and count again.',
            why: 'Now every amount considers every coin, so orderings are distinguished.',
            work: '9 ways for the same amount of 5',
            result: '{2,2,1} alone contributes three, one per position of the 1'
          },
          {
            do: 'Widen the amount to see the two diverge.',
            why: 'The gap is not a constant factor — it grows with the number of parts.',
            work: 'at 11: 11 against 218. At 20: 29 against 26 547',
            result: 'the permutation count leaves the combination count far behind'
          },
          {
            do: 'Ask the same table for the fewest coins rather than the number of ways.',
            why: 'To confirm the recurrence is shared and only the aggregate differs.',
            work: '20 needs 4 coins: 5 + 5 + 5 + 5',
            result: 'the same loop, a min instead of a sum'
          }
        ],
        answer: 'The same six lines with the two loops swapped answer two different questions: 4 and 9 at ' +
          'an amount of 5, and 29 against 26 547 at 20. Neither raises and neither is wrong — they count ' +
          'combinations and permutations respectively — so the only way to know which one you wrote is to ' +
          'check it against an enumeration. This is the inversion of the first example: there the two ' +
          'implementations differed enormously in cost and agreed on the answer; here they cost the same ' +
          'and disagree on what the answer means.'
      }
    ],

    'knapsack-family': [
      {
        title: 'The table, the traceback, and checking the set rather than the number',
        goal: 'Fill a 0/1 knapsack, recover the chosen items, and verify them against the problem statement.',
        setup: 'Twelve items with seeded values in [10, 100) and weights in [2, 20), and a capacity of 60.',
        steps: [
          {
            do: 'Count the cells before filling any of them.',
            why: 'States × transitions is (items + 1)(capacity + 1) cells with two edges each.',
            work: '13 × 61 = 793 cells, 2 transitions each',
            result: 'the complexity, known before the loop is written'
          },
          {
            do: 'Fill the table and read the optimum out of the corner.',
            why: 'Each cell is the better of skipping item i and taking it.',
            work: 'best[12][60] = 571',
            result: 'exhaustive enumeration of all 4 096 subsets agrees'
          },
          {
            do: 'Walk the decision array backwards to recover the items.',
            why: 'The value alone does not say which items achieved it.',
            work: '8 items chosen: indices 4 through 11',
            result: 'a witness, which can be checked'
          },
          {
            do: 'Re-sum the chosen items independently of the table.',
            why: 'This is the check a bare optimum cannot support.',
            work: 'weight 59 ≤ 60, value 571 — matching the reported optimum exactly',
            result: 'the traceback is verified, not trusted'
          }
        ],
        answer: 'A 793-cell table gives 571, and the traceback recovers eight items weighing 59 against a ' +
          'capacity of 60 and worth exactly 571 when re-summed. That last step is the one worth keeping: ' +
          'it costs three lines, it is the only check available against the problem statement rather than ' +
          'against another implementation, and it is what notices when a traceback is later walked over a ' +
          'table that has been space-reduced underneath it.'
      },
      {
        title: 'One extra digit on the capacity',
        goal: 'Show that "polynomial" is a claim about the wrong input, in the two units that disagree.',
        setup: 'The same twelve items, with the capacity varied by powers of ten, reporting the table size ' +
          'and the number of bits needed to write the capacity down.',
        steps: [
          {
            do: 'Size the table at a capacity of 10.',
            why: 'A baseline in both units at once.',
            work: '132 cells; the capacity is 2 digits and 4 bits',
            result: 'a trivially small problem'
          },
          {
            do: 'Multiply the capacity by ten and re-measure.',
            why: 'One more character of input.',
            work: '1 212 cells at capacity 100, which is 3 digits and 7 bits',
            result: 'the input grew by one character and the work by about ten times'
          },
          {
            do: 'Continue to a capacity of 100 000.',
            why: 'To see whether the pattern is a constant factor or a growth rate.',
            work: '1 200 012 cells; 6 digits and 17 bits',
            result: 'from 4 bits to 17 bits of input, and from 132 to 1 200 012 cells'
          },
          {
            do: 'Compare the two growth rates directly.',
            why: 'Complexity is measured against input length, and the capacity is written in log C bits.',
            work: 'input × 4.25 in bits; work × 9 091 in cells',
            result: 'exponential in the input length, which is what "pseudo-polynomial" names'
          }
        ],
        answer: 'The table is O(n·C), and C is written down in about log₂C bits — so adding one decimal ' +
          'digit lengthens the input by roughly 3.3 bits and multiplies the work by ten. Going from a ' +
          'capacity of 10 to one of 100 000 grows the input from 4 bits to 17 and the table from 132 cells ' +
          'to 1 200 012. This is the inversion of the first example: there the table was the thing that ' +
          'made an exponential problem tractable, and here it is the thing that makes a small-looking ' +
          'number impossible.'
      }
    ],

    'sequence-alignment': [
      {
        title: 'Edit distance, and the alignment the number does not contain',
        goal: 'Fill the table, walk it back, and check the result is an alignment of the two inputs.',
        setup: 'kitten against sitting, unit costs for substitution, insertion and deletion.',
        steps: [
          {
            do: 'Size the table from the two lengths.',
            why: 'Three transitions per cell, (m+1)(n+1) cells.',
            work: '7 × 8 = 56 cells, 3 edges each',
            result: 'the cost, before the loop'
          },
          {
            do: 'Fill it and read the corner.',
            why: 'Each cell is the cheapest of the three predecessors.',
            work: 'distance 3',
            result: 'exhaustive recursion over every edit sequence agrees'
          },
          {
            do: 'Walk backwards, preferring the diagonal on ties.',
            why: 'A diagonal step is one column; a gap pair is two at the same cost.',
            work: '7 columns: kitten- over sitting',
            result: 'the shortest alignment achieving cost 3'
          },
          {
            do: 'Strip the gaps from each row and compare against the inputs.',
            why: 'This is the check the distance cannot make.',
            work: 'top strips to "kitten", bottom to "sitting", 0 gap-against-gap columns',
            result: 'a real alignment of these two strings, not a plausible-looking one'
          }
        ],
        answer: 'A 56-cell table gives distance 3, and the traceback gives a seven-column alignment whose ' +
          'gap-stripped rows are exactly the two inputs. The three checks — equal row lengths, gap-stripped ' +
          'rows equal to the inputs, no gap against a gap — take a few lines and between them catch every ' +
          'traceback bug there is. None of them can be made from the number alone.'
      },
      {
        title: 'The same alignment in a fraction of the memory',
        goal: 'Get the alignment out of a linear-space computation, and price what that costs.',
        setup: 'The same pair under Hirschberg\'s divide and conquer, with the peak live cell count ' +
          'measured rather than reasoned about, and the memory ratio projected to realistic lengths.',
        steps: [
          {
            do: 'Compute the distance with two rows and try to recover the alignment.',
            why: 'This is the three-line reduction that keeps every distance test passing.',
            work: 'peak 16 cells against the full table\'s 56, distance still 3',
            result: 'the number survives; there are no rows left to walk backwards through'
          },
          {
            do: 'Run Hirschberg instead and count the recursive splits.',
            why: 'Each split finds where the optimal alignment crosses the midpoint.',
            work: '5 splits, peak 16 cells, distance 3',
            result: 'the same linear memory, and an alignment comes back'
          },
          {
            do: 'Check that alignment the same way as the full table\'s.',
            why: 'A linear-space traceback is exactly where a plausible non-alignment would appear.',
            work: '7 columns, both rows strip back to the inputs, cost recomputes to 3',
            result: 'identical to the full-table answer'
          },
          {
            do: 'Project the memory ratio to lengths where it matters.',
            why: 'At seven characters the saving is irrelevant; the question is how it scales.',
            work: 'at 600 a side: 361 201 cells against 1 202 — 300.5×. At 2 000: 4 004 001 against 4 002 — 1 000.5×',
            result: 'the ratio grows linearly with the length'
          }
        ],
        answer: 'Hirschberg returns the same alignment as the full table from 16 peak cells instead of 56, ' +
          'paying five recursive splits and about twice the time. At 2 000 characters a side that is 4 002 ' +
          'cells against 4 004 001 — a factor of 1 000. This inverts the first example: there the table ' +
          'was what made the alignment recoverable, and here the alignment is recovered without ever ' +
          'holding the table, by recomputing halves instead of remembering them.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));

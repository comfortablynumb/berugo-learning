/** Worked examples for Turing machines, models, undecidability and Rice (M26.1-M26.4). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'turing-machines': [
      {
        title: 'Deciding `aⁿbⁿcⁿ`, and the exhaustive check that found the bug',
        goal: 'Show a decidable non-context-free language, and why a machine needs checking.',
        setup: 'A 9-state machine with 29 transitions: a verification phase that the input is ' +
          'a* b* c*, then a counting phase crossing off one of each per sweep.',
        steps: [
          { do: 'Run it on `abc`.', why: 'The smallest non-empty member.',
            work: 'accepted in 16 steps, using 5 tape cells for a 3-symbol input' },
          { do: 'Run it on `aabbcc` and `aaabbbccc`.',
            why: 'Each extra triple costs another full sweep.',
            work: '37 steps for 6 tokens, 66 for 9 — quadratic, not linear' },
          { do: 'Check every string up to length 7 against an independent definition.',
            why: 'The definition is written from the language, not from the machine.',
            work: '3 280 strings checked, 0 disagreements' },
          { do: 'Note what the first version did.',
            why: 'Counting alone gets the counts right and says nothing about order.',
            work: 'it accepted `abcabc` — 3 sweeps cross off 3 of each, and the counts match' },
          { do: 'Add the verification phase and re-run the sweep.',
            why: 'Rejecting a wrong-ordered string before counting fixes it.',
            work: '29 transitions instead of 15, and 0 disagreements over the same 3 280 strings' }
        ],
        answer: 'The machine is quadratic — 16, 37, 66, 103 and 148 steps for one to five ' +
          'triples — and it uses exactly the input length in tape cells, because it never writes ' +
          'outside it. Linear space and quadratic time is the signature of a machine re-deriving ' +
          'rather than remembering, which is what the space section is about.'
      },
      {
        title: 'The three outcomes, and why the third is not a rejection',
        goal: 'Show that a step budget produces information rather than a verdict.',
        setup: 'Five machines — increment, aⁿbⁿcⁿ, palindromes, doubling and one that never ' +
          'halts — run at a budget you can move.',
        steps: [
          { do: 'Run the increment machine on `1011`.',
            why: 'It halts quickly, in an accepting state.',
            work: '8 steps, outcome `halted`, tape reads 1100' },
          { do: 'Run the palindrome machine over every binary string up to length 8.',
            why: 'Exhaustive is cheap here and settles correctness.',
            work: '511 strings, 0 disagreements with the reversal test' },
          { do: 'Run the looper on `1011` at a budget of 500.',
            why: 'It never halts on any input.',
            work: '500 steps used, outcome `budget` — not `rejected`, and the distinction is the ' +
              'point' },
          { do: 'Raise the budget and re-run it.',
            why: 'A rejection would be stable; a budget outcome is not.',
            work: 'still `budget` at 10 steps and at 2 000, because the machine has no halting state' },
          { do: 'Encode the increment machine as a string and run the decoded copy.',
            why: 'A program is data, which is what the universal machine needs.',
            work: '116 characters, and the decoded machine gives 1100 on the same input' }
        ],
        answer: 'Three outcomes and not two. A simulator that folded `budget` into `rejected` ' +
          'would report that the looper rejects every input, which is a claim about a language ' +
          'and is false — the looper accepts nothing and rejects nothing, and the difference is ' +
          'exactly what the next section is about.'
      }
    ],

    'equivalent-models-of-computation': [
      {
        title: 'One function, three models, three cost curves',
        goal: 'Separate the equivalence claim from everything it does not say.',
        setup: 'Doubling a number, written for a RAM, a counter machine and a Turing machine, ' +
          'with the answers compared and the steps counted at each input.',
        steps: [
          { do: 'Run all three at n = 1.', why: 'The smallest case, so the constants are visible.',
            work: 'RAM 2 steps, counter 4, Turing 8 — all three answer 2' },
          { do: 'Run at n = 4.', why: 'The curves start to separate.',
            work: 'RAM 2, counter 13, Turing 50 — all three answer 8' },
          { do: 'Run at n = 10.', why: 'Far enough to see three different shapes.',
            work: 'RAM 2, counter 31, Turing 242 — all three answer 20' },
          { do: 'Fit each column.', why: 'The shapes are the point.',
            work: 'RAM constant at 2; counter 3n + 1; Turing 2n² + 4n + 2' },
          { do: 'Check the answers agree at every input.',
            why: 'That agreement IS the equivalence claim.',
            work: '0 disagreements across every input tested' }
        ],
        answer: 'The equivalence claim is the answer column and it holds everywhere. Everything ' +
          'else is what the claim does not say: one model does it in a fixed two instructions, ' +
          'one in a number proportional to the value, and one in a number proportional to its ' +
          'square. Computability asks whether the column is finite; complexity asks how it ' +
          'grows.'
      },
      {
        title: 'Two models with no tape at all',
        goal: 'Show universality arriving from constructions that do not look like computers.',
        setup: 'Rule 110 evolved from a single live cell, an SKI reduction, and a 2-tag system.',
        steps: [
          { do: 'Evolve Rule 110 for six generations from one live cell.',
            why: 'Eight lookup entries and no state at all.',
            work: 'rows of 1, 2, 3, 4 live cells with a growing left edge — Cook proved this ' +
              'universal in 2004' },
          { do: 'Evolve Rule 90 for comparison.',
            why: 'The same machinery producing something structured instead.',
            work: 'the Sierpinski triangle, from the same 8-entry table shape — rule 90 is exactly ' +
              'XOR of the two neighbours' },
          { do: 'Reduce `SIIx` in the combinator calculus.',
            why: 'Duplication, with no variables anywhere.',
            work: '3 steps to `xx`' },
          { do: 'Reduce `S(K(SI))Kxy`.', why: 'Argument reversal, built from S and K alone.',
            work: '5 steps to `yx`' },
          { do: 'Run the 2-tag system from a three-symbol word.',
            why: 'One queue, delete two and append — Post proved these universal in 1943.',
            work: 'halts after 24 steps' }
        ],
        answer: 'A three-cell lookup table, three rewrite rules and a queue are each enough to ' +
          'compute anything computable. That is the most useful fact in the section: ' +
          'universality is common and cheap rather than rare and engineered, which is why so ' +
          'many systems nobody designed to be programmable turn out to be.'
      }
    ],

    'undecidability-and-diagonalisation': [
      {
        title: 'Defeating four oracles with the same six lines',
        goal: 'Show the construction working against every candidate, including a coin flip.',
        setup: 'A program `contrary(p)` that asks a supposed halting oracle what `p` does on its ' +
          'own source, then does the opposite. The oracle is a real function and is genuinely ' +
          'called.',
        steps: [
          { do: 'Try a heuristic that looks for obvious infinite loops.',
            why: 'The shape every real static analyser has.',
            work: '1 oracle call: it says `loops`, so the program returns immediately — ' +
              'contradiction' },
          { do: 'Try an oracle that always says halts.',
            why: 'An unsound analyser, and right about most programs.',
            work: '1 oracle call: it says `halts`, so the program loops forever — contradiction' },
          { do: 'Try one that always says loops.',
            why: 'Sound in the other direction and useless.',
            work: '1 oracle call again: it says `loops`, so the program returns — contradiction' },
          { do: 'Try 200 arbitrary deciders in the test suite.',
            why: 'The theorem quantifies over all of them.',
            work: '200 of 200 defeated' },
          { do: 'Note what the construction inspects.',
            why: 'This is why the result is universal.',
            work: 'nothing — it calls the oracle once and negates the answer, in 6 lines' }
        ],
        answer: 'The construction never looks inside the oracle, which is why a perfect one, a ' +
          'heuristic, a machine-learned model and a coin flip all fall to the same six lines. ' +
          'That is what separates an impossibility result from a statement about the current ' +
          'state of the art.'
      },
      {
        title: 'The diagonal table, and the bounded question that does have an answer',
        goal: 'Show the argument as a picture, then show what remains decidable.',
        setup: 'A table of machines against inputs with H or L in each cell, and a ' +
          'bounded-halting check over five real machines.',
        steps: [
          { do: 'Build the table for six machines and six inputs.',
            why: 'Every machine is a row and every input a column.',
            work: '36 cells, with the six diagonal cells marked' },
          { do: 'Construct the row that disagrees with every diagonal cell.',
            why: 'It differs from row i at column i, for every i.',
            work: '6 differences listed, one per existing row' },
          { do: 'Ask which machine that row is.',
            why: 'It is no row of the table, and every machine is a row.',
            work: 'no machine at all — it differs from all 6 rows, and there are only 6' },
          { do: 'Now decide bounded halting for five real machines at a budget of 200.',
            why: 'Run each for 200 steps and look.',
            work: '4 of 5 decided; the looper is still running, which is itself the answer' },
          { do: 'Lower the budget to 10 and raise it to 2 000.',
            why: 'A bounded answer depends on the bound, and that is not a defect.',
            work: 'at 10 steps only 1 of 5 is decided; at 2 000 it is 4 of 5, and the looper ' +
              'never comes back' }
        ],
        answer: 'The unbounded question has no answer and the bounded one always does. Every ' +
          'timeout, step budget, fuel counter and gas limit in production software is that ' +
          'substitution — and each one inherits the obligation to say what happens when the ' +
          'bound is hit, which is the engineering content of the theorem.'
      }
    ],

    'reductions-and-the-rice-theorem': [
      {
        title: 'Ten properties, and the two quite different reasons six are decidable',
        goal: 'Show Rice’s condition doing the work, and both escape hatches.',
        setup: 'Ten properties of programs, each classified as semantic or syntactic and trivial ' +
          'or not, with the verdict computed from those two flags.',
        steps: [
          { do: 'Count the undecidable ones.',
            why: 'Rice: non-trivial and semantic means no decider exists.',
            work: '4 of 10 — halting, computing the zero function, empty language, ever dividing ' +
              'by zero' },
          { do: 'Count the semantic ones.', why: 'Not all of them are undecidable.',
            work: '6 semantic, of which 2 are trivial and therefore decidable by a constant' },
          { do: 'Count the syntactic ones.',
            why: 'Rice says nothing about how a program is written.',
            work: '4 syntactic, all decidable — grep decides one of them' },
          { do: 'Look at the bounded row.',
            why: '"Halts within 10 000 steps" sounds semantic and is not.',
            work: '1 of the 6 decidable rows, and a property of a bounded EXECUTION rather than of the ' +
              'computed function' },
          { do: 'Check the classification is computed rather than asserted.',
            why: 'The verdict follows mechanically from the two flags.',
            work: 'undecidable exactly when semantic AND non-trivial — 4 of 10' }
        ],
        answer: 'Six decidable properties for two unrelated reasons, and the difference matters: ' +
          'a syntactic check is a real tool and a trivial one is a constant. What is worth ' +
          'sitting with is how ordinary the four undecidable rows look — "does it ever divide by ' +
          'zero" is a question anybody would put in a ticket, and it has no algorithm at all.'
      },
      {
        title: 'Five reductions, and what each one costs a real tool',
        goal: 'Show reductions as program transformations you can read.',
        setup: 'A reduction builder that takes any program and appends the construction for the ' +
          'chosen target problem, printing the transformed source.',
        steps: [
          { do: 'Reduce halting to "does this program ever print".',
            why: 'Append a print statement after the original.',
            work: 'the print is reached exactly when the original halts — 1 line added' },
          { do: 'Reduce it to "is this line dead code".',
            why: 'The line after the program is reachable exactly when it terminates.',
            work: '1 line added; exact dead-code detection would decide halting, so every linter ' +
              'approximates' },
          { do: 'Reduce it to "do these two programs compute the same function".',
            why: 'One returns 1 after running the program; the other returns 1 immediately.',
            work: '2 programs built; they agree on every input exactly when the original halts ' +
              'everywhere' },
          { do: 'Reduce it to "does this terminate on every input".',
            why: 'Ignore the input and run the original on a fixed one.',
            work: 'totality is in neither of the 2 recognisability classes — strictly harder than ' +
              'halting' },
          { do: 'Count the consequences.',
            why: 'Each is something a working engineer has been asked for.',
            work: '5 reductions, 5 impossible feature requests' }
        ],
        answer: 'Exact dead-code detection, exact dead-store elimination, verified optimisation ' +
          'and a termination checker are all impossible, all requested regularly, and all ' +
          'approximated by tools that are honest about approximating. The transformations are ' +
          'four lines each and you can check the equivalence by reading them.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));

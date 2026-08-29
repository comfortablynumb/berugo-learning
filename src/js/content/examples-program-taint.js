/** Worked examples for taint analysis and symbolic execution (M32.3-M32.4). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'taint-analysis': [
      {
        title: 'One precision axis, one false positive, priced',
        goal: 'Turn field sensitivity on and measure what it removes and what it does not.',
        setup: 'A fixture builds a record `{ bad: raw, good: clean }` where `raw` came from a ' +
          'declared source, and passes both fields to a sink. A second fixture does the same ' +
          'with an array. The static analysis reports what could arrive; a dynamic oracle runs ' +
          'the programme with a taint bit beside every value and reports what did.',
        steps: [
          { do: 'Analyse the record fixture field-insensitively.',
            why: 'One abstract location for the whole record, which is what most tools do.',
            work: '2 findings, at both sink calls' },
          { do: 'Run the oracle on the same fixture.',
            why: 'This is the ground truth for the two calls.',
            work: '2 sink calls executed, 1 received a tainted value' },
          { do: 'Classify the two findings.',
            why: 'A finding is only false when something says so.',
            work: '1 confirmed, 1 refuted by the run — a false positive' },
          { do: 'Switch to field-sensitive and re-run.',
            why: 'One abstract location per field of the record literal.',
            work: '1 finding, confirmed; the false positive is gone' },
          { do: 'Do the same on the array fixture, both ways.',
            why: 'The obvious expectation is that this improves too.',
            work: '1 finding and 1 refutation under both — no change' }
        ],
        answer: 'Field sensitivity removes exactly the false positives that come from mixing a ' +
          'record\'s fields, and none of the ones that come from mixing an array\'s elements. ' +
          'Separating array elements is index sensitivity, a different axis, and it requires ' +
          'reasoning about the index arithmetic — which is why almost no production tool pays ' +
          'for it and why array-shaped code is where these tools are noisiest. The measurement ' +
          'also shows what precision is worth in the only unit that matters to a user: 1 ' +
          'finding of the 2 was noise, and one control removed it.'
      },
      {
        title: 'The policy fails in two directions and only one of them is noisy',
        goal: 'Drop one declaration at a time and watch the report change.',
        setup: 'The direct fixture: a source produces a value, a sanitiser cleans a copy of ' +
          'it, and both the raw and the cleaned value reach the same sink function. The ' +
          'declared policy reports one finding, which the oracle confirms.',
        steps: [
          { do: 'Analyse with the declared policy.',
            why: 'The baseline the other rows are read against.',
            work: '1 finding, confirmed by the run' },
          { do: 'Undeclare the first source and re-run.',
            why: 'The commonest real deployment error, by a wide margin.',
            work: '0 findings — a change of -1, and no other signal of any kind' },
          { do: 'Undeclare the sanitiser and re-run.',
            why: 'The opposite mistake.',
            work: '2 findings — a change of +1, on a call that is genuinely safe' },
          { do: 'Undeclare the sink and re-run.',
            why: 'The same silent direction as the source.',
            work: '0 findings, change of -1' },
          { do: 'Compare how each failure would be noticed in a real deployment.',
            why: 'This is the whole reason the table exists.',
            work: '2 of the 3 changes are silent; 1 produces an extra report a human triages' }
        ],
        answer: 'Two of the three ways to get the policy wrong make the report shorter and ' +
          'produce no other evidence, and the third makes it longer and gets triaged. That ' +
          'asymmetry decides where the review effort goes: audit the source and sink lists ' +
          'against the framework you actually use, and treat every internal entry point — your ' +
          'RPC layer, your template renderer, that deserialiser from 2019 — as a source until ' +
          'somebody proves otherwise. The sanitiser list needs a different kind of review: the ' +
          'analysis trusts it absolutely, so a sanitiser that escapes for the wrong context ' +
          'turns the tool into a machine for producing confident clean reports about ' +
          'exploitable code.'
      }
    ],

    'symbolic-execution': [
      {
        title: 'One hundred and twenty-eight leaves, eight of which exist',
        goal: 'Measure the gap between the size of the path tree and the reachable part of it.',
        setup: 'A ladder of k independent branches over one parameter: `if (a > 1) … if (a > ' +
          '2) …` up to `if (a > k)`. Each leaf\'s path condition goes to the linear theory ' +
          'solver from 32.6, which either produces an input or proves the leaf unreachable.',
        steps: [
          { do: 'Run at one, three and five branches.',
            why: 'Establish both curves before the numbers get large.',
            work: '2, 8 and 32 leaves; 2, 4 and 6 of them reachable' },
          { do: 'Run at seven branches.',
            why: 'The tree has doubled twice more.',
            work: '128 leaves, 8 reachable, 120 proved impossible' },
          { do: 'Read the theory solver\'s reason on one impossible leaf.',
            why: 'A proof, not a failed search.',
            work: 'eliminating every variable leaves 1 < 0, which is false' },
          { do: 'Switch the control to the bounded search alone and re-run.',
            why: 'What an executor without a decision procedure can honestly say.',
            work: 'the same 8 feasible; the other 120 come back undecided rather than impossible' },
          { do: 'Execute every generated input and check it follows its path.',
            why: 'The claim is reachability, so it should be checked.',
            work: '8 of 8 reached exactly the blocks their path condition came from' }
        ],
        answer: 'The tree doubles per branch and the reachable part grows by one per branch, ' +
          'because ordered comparisons on one variable contradict each other in almost every ' +
          'combination. That gap is why symbolic execution works on real code at all, and it ' +
          'is also the argument for solving at the fork rather than at the leaf: an engine ' +
          'that explores first and checks later walks all 128, and one that prunes as soon as ' +
          'a prefix becomes unsatisfiable walks a small fraction of them. The second finding ' +
          'is the difference between the two solvers — 120 leaves that are "undecided" to a ' +
          'bounded search and "impossible" to a decision procedure — which is exactly the ' +
          'capability the next two sections build.'
      },
      {
        title: 'A generated input that does not reach its path, and why that is honest',
        goal: 'Watch the technique fail at the edge of its fragment, and be caught doing it.',
        setup: 'Three fixtures. `classify` has three reachable leaves; `guard` contains `if (a ' +
          '> 10) { if (a < 5) … }`; `scale` computes `a * b` and branches on the product, which ' +
          'is outside the affine fragment the executor represents.',
        steps: [
          { do: 'Run `classify` and verify every generated input.',
            why: 'The good case, which is what the technique promises.',
            work: '3 leaves, 3 inputs, 3 of 3 reached their path, 7 of 7 blocks covered' },
          { do: 'Run `guard` and read the impossible leaf.',
            why: 'A branch no input can take is a finding in its own right.',
            work: '3 leaves: 2 reachable, 1 proved impossible, 6 of 7 blocks covered' },
          { do: 'Run `scale` and count the leaves.',
            why: 'The executor still forks; it just cannot say why.',
            work: '2 leaves, both marked reachable, path conditions naming `opaque`' },
          { do: 'Execute both generated inputs.',
            why: 'The check the technique is usually trusted without.',
            work: '1 of 2 reached its path; the other visited the opposite branch' },
          { do: 'Read the block coverage for `scale`.',
            why: 'The consequence of an input that proves nothing.',
            work: '3 of 4 blocks; one block is never reached by any generated input' }
        ],
        answer: 'Outside its fragment the executor produces inputs that satisfy a path ' +
          'condition containing no information, and half of them go somewhere else entirely. ' +
          'The important part is that this was measured rather than assumed: every generated ' +
          'input is executed and checked against the blocks its leaf was collected from, so ' +
          'the failure shows up as 1 of 2 rather than as a coverage number that looks fine. ' +
          'This is the case concolic execution exists for — keep the concrete value beside the ' +
          'symbol, and a product of two unknowns costs you the ability to negate that branch ' +
          'rather than the ability to continue.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));

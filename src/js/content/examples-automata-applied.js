/** Worked examples for production automata, weighted machines and Büchi (M24.9-M24.11). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'automata-in-production': [
      {
        title: 'Tokenising `if x >>= 12` with maximal munch and priority',
        goal: 'Show both scanner rules doing work on one line of source.',
        setup: 'Eleven rules — three keywords, five operators, an identifier, a number and ' +
          'whitespace — with declaration order as priority.',
        steps: [
          { do: 'Scan from position 0 and note what matches.',
            why: 'Two rules accept "if" at the same length.',
            work: '2 rules match at length 2; priority takes the keyword' },
          { do: 'Note the shorter match passed over at that position.',
            why: 'Maximal munch keeps scanning after a rule already accepted.',
            work: 'identifier "i" was accepted at length 1 and passed over' },
          { do: 'Scan from position 5, where the operator sits.',
            why: 'This is the case a first-success scanner gets wrong.',
            work: 'gt ">" at length 1, shift ">>" at length 2, shift-assign ">>=" at length 3' },
          { do: 'Take the longest and count the decisions.',
            why: 'Stopping early would produce two tokens where the language has one.',
            work: '7 decisions over 11 characters, 3 of them passing over a shorter match' },
          { do: 'Count the tokens emitted, with whitespace skipped.',
            why: 'Skipped rules are decisions that produce no token.',
            work: '4 tokens: if, identifier(x), shift-assign(>>=), number(12)' }
        ],
        answer: 'Seven scanning decisions produce four tokens, and three of those decisions ' +
          'passed over a shorter match that had already succeeded. Without maximal munch, `>>=` ' +
          'would come back as `>>` then `=`.'
      },
      {
        title: 'The case that inverts it: flagging a pattern and then exploding it',
        goal: 'Turn a structural verdict into a measured blow-up.',
        setup: 'The pattern (a+)+b, analysed and then attacked with a backtracking matcher and ' +
          'an NFA simulation.',
        steps: [
          { do: 'Run the analyser and see which rule fires.',
            why: 'Two shapes cause ReDoS and they need different detectors.',
            work: 'nesting: 1 plus over a body that is itself a plus' },
          { do: 'Generate the attack string.',
            why: 'A failing tail forces every path to be tried; a matching string stops early.',
            work: 'the 1-character ambiguous word repeated, then a character the pattern cannot match' },
          { do: 'Measure both matchers at 4 repeats.',
            why: 'A baseline where the difference is small.',
            work: '6 characters: 99 backtracking steps against 28 simulation steps, 3.5×' },
          { do: 'Measure at 12 repeats.',
            why: 'The divergence should be visible rather than argued.',
            work: '14 characters: 26 619 against 76, a factor of 350.3' },
          { do: 'Measure at 16 repeats.',
            why: 'Four more characters, and the ratio moves an order of magnitude.',
            work: '18 characters: 425 979 against 100, a factor of 4 259.8' }
        ],
        answer: 'Adding four characters to the input multiplies the backtracking work by twelve ' +
          'and the simulation work by 1.3. Both matchers return the same answer; only the time ' +
          'differs, and the analyser predicted it from the pattern alone.'
      }
    ],

    'weighted-and-probabilistic': [
      {
        title: 'Decoding a sequence, and checking Viterbi against every path',
        goal: 'Run the dynamic program and confirm it with an independent reference.',
        setup: 'A two-state weather model, decoding the observations walk, shop, clean.',
        steps: [
          { do: 'Count the trellis cells Viterbi fills.',
            why: 'One column per observation, one row per state.',
            work: '3 columns × 2 states = 6 cells' },
          { do: 'Count the paths brute force must score.',
            why: 'Every assignment of states to positions.',
            work: '2^3 = 8 paths' },
          { do: 'Read the Viterbi answer and its score.',
            why: 'The score is a log probability, so it is negative.',
            work: 'sunny → rainy → rainy, log probability −4.3459' },
          { do: 'Compare with the best of the 8 enumerated paths.',
            why: 'A wrong recurrence returns a plausible path, so the check must be independent.',
            work: 'same path, same score of −4.3459' },
          { do: 'Run the forward algorithm for the total probability.',
            why: 'That sums over all paths rather than taking the best one.',
            work: '0.035640 against the best single path’s 0.012960' }
        ],
        answer: 'Viterbi fills 6 cells and agrees exactly with the enumeration of all 8 paths. ' +
          'The best path carries 0.012960 of the total 0.035640, so it is about 36% of the ' +
          'probability mass.'
      },
      {
        title: 'The case that inverts it: where plain probabilities die',
        goal: 'Measure the sequence length at which the naive decoder silently stops working.',
        setup: 'The same model, decoding a run of one repeated observation of growing length.',
        steps: [
          { do: 'Write down what a path score does per symbol.',
            why: 'Multiplying numbers below one drives the product towards zero.',
            work: '2 probabilities below 1 multiplied per step' },
          { do: 'Measure at 100 and 500 steps.',
            why: 'The value shrinks fast and is still representable.',
            work: 'still non-zero at 100 and at 500, and the log-domain score tracks it exactly' },
          { do: 'Find where the plain version reaches exactly zero.',
            why: 'Once it does, every path ties and the decoder chooses arbitrarily.',
            work: '619 repetitions of "clean"; 522 of "shop"' },
          { do: 'Try the observation with the highest emission probability.',
            why: 'The failure depends on the model and the data, not on the length alone.',
            work: '"walk" does not underflow within 2 000 steps' },
          { do: 'Check the log-domain decoder at the same lengths.',
            why: 'Adding negative numbers never rounds to an unrepresentable value.',
            work: 'a score of about −1 204 at 1 000 steps, still exact' }
        ],
        answer: 'Plain probabilities hit zero at 619 repetitions for one symbol and 522 for ' +
          'another, and never within 2 000 for a third. The decoder does not throw or warn — it ' +
          'returns a valid-looking state sequence chosen arbitrarily.'
      }
    ],

    'automata-over-infinite-words': [
      {
        title: 'Finding a liveness bug no test could find',
        goal: 'Model-check a server that may wait forever and read the counter-example.',
        setup: 'A server that grants after a request but may also stay busy indefinitely, ' +
          'checked against "every request is eventually granted".',
        steps: [
          { do: 'Build a monitor for the NEGATION of the property.',
            why: 'A non-empty product then means a bug, with a witness.',
            work: '2 states: idle, and waiting — accepting' },
          { do: 'Take the product with the system.',
            why: 'The language is the set of system behaviours that break the property.',
            work: '3 reachable pairs' },
          { do: 'Run the nested depth-first search for an accepting cycle.',
            why: 'Emptiness for infinite words is "is there a reachable accepting cycle".',
            work: '4 state visits across the outer and inner searches' },
          { do: 'Read the lasso it returns.',
            why: 'A stem into a cycle repeated forever is the shape of every counter-example.',
            work: 'req, then the empty step repeated forever — a 1-step stem and a 1-step cycle' },
          { do: 'Re-run the lasso against the product to confirm it.',
            why: 'A bug in the search would produce a confident wrong trace.',
            work: 'accepted — the accepting state is revisited on each of the first 10 unrolled steps' }
        ],
        answer: 'The check finds a 1-step stem into a 1-step cycle: the request arrives and then ' +
          'nothing happens, forever. Every finite prefix of that trace is also a prefix of a ' +
          'correct run, which is why no test finds it.'
      },
      {
        title: 'The case that inverts it: the same system passes the safety check',
        goal: 'Show the split between what testing can and cannot reach.',
        setup: 'Three systems against two properties, with the same model checker.',
        steps: [
          { do: 'Check the correct server against both properties.',
            why: 'The control: nothing should be reported.',
            work: 'safety holds, liveness holds — 0 violations' },
          { do: 'Check the starving server against safety.',
            why: 'It never grants without a request, so there is no bad prefix.',
            work: 'safety holds — 0 finite traces violate it' },
          { do: 'Check the starving server against liveness.',
            why: 'The violation is a behaviour of infinite length.',
            work: 'violated, with the 1-step lasso from the first example' },
          { do: 'Check a server that grants without a request.',
            why: 'A safety violation has a finite bad prefix.',
            work: 'safety violated by a 1-step trace: a grant with nothing outstanding' },
          { do: 'Ask what a finite test would report in each row.',
            why: 'This is the practical consequence of the safety/liveness split.',
            work: 'the rogue server in 1 step; the starving server never' }
        ],
        answer: 'The starving server passes safety and fails liveness, and the rogue one fails ' +
          'safety with a one-step trace any test would catch. That is the whole distinction: a ' +
          'safety bug has a finite witness and a liveness bug does not.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));

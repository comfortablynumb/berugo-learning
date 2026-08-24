/** Worked examples for entropy, prefix codes and arithmetic coding (M22.1-M22.3). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'information-and-entropy': [
      {
        title: 'One corpus, five model orders, and the point where the number stops meaning anything',
        goal: 'Measure the entropy of the same bytes under rising model order, and find where the ' +
          'estimate turns into memorisation.',
        setup: '3 000 bytes of English text over 30 distinct symbols, profiled at orders 0 to 4, ' +
          'with the context count and the observations per context reported at each.',
        steps: [
          {
            do: 'Measure order 0 — every byte treated as independent.',
            why: 'This is the floor a Huffman or static arithmetic coder is measured against.',
            work: '4.5623 bits per byte over 1 context of 3 000 observations',
            result: 'a floor of 1 711 bytes, a ratio of 1.75× against the 3 000-byte input'
          },
          {
            do: 'Condition on the previous byte.',
            why: 'The drop is the mutual information between neighbours.',
            work: '1.9578 bits per byte over 30 contexts, 100.0 observations each',
            result: '2.60 bits per byte of redundancy an order-0 coder cannot reach'
          },
          {
            do: 'Keep going to orders 2, 3 and 4.',
            why: 'More context should predict better, and it does — for a while.',
            work: '0.6345, 0.2235 and 0.1225 bits per byte',
            result: 'a floor that falls from 238 bytes to 46'
          },
          {
            do: 'Read the observations-per-context column beside those numbers.',
            why: 'An estimate from a context seen twice is a memory, not a model.',
            work: '27.3, 19.0 and 17.0 observations per context at orders 2, 3 and 4',
            result: 'still defensible here — but the trend is the warning'
          },
          {
            do: 'Run the same order-2 measurement on random bytes.',
            why: 'The answer is known: there is no structure to find.',
            work: '2 944 contexts over 3 000 samples — 1.0 observation each — reporting 0.036 ' +
              'bits per byte',
            result: 'a number that would mean random data is 99.5% predictable, and is pure ' +
              'memorisation'
          }
        ],
        answer: 'The entropy of a file is not one number, it is one number per model, and the ' +
          'order-2 row for random bytes is the reason the demo prints two extra columns. 0.036 ' +
          'bits per byte is an arithmetically correct conditional entropy of the sample and a ' +
          'flat contradiction of the counting theorem, and the only thing that distinguishes it ' +
          'from the useful rows is that each of its 2 944 contexts was seen once. Three of the ' +
          'seven corpora fail that check and their redundancy column is left blank rather than ' +
          'filled with a number that would be worse than no number.'
      },
      {
        title: 'The inverted case: checking the instrument before trusting the readings',
        goal: 'Validate the entropy estimator against sources whose entropy is arithmetic rather ' +
          'than estimated.',
        setup: 'Four biased coins and two Markov chains, 20 000 symbols each, where the true ' +
          'entropy has a closed form.',
        steps: [
          {
            do: 'Generate a fair coin and measure it.',
            why: 'H(0.5) = 1 exactly, so any disagreement is the estimator.',
            work: '1.0000 measured against 1.0000',
            result: 'an error of 0.0000 bits'
          },
          {
            do: 'Skew the coin to p = 0.25 and p = 0.1.',
            why: 'H(p) = −p·log₂p − (1−p)·log₂(1−p), a closed form.',
            work: '0.8091 against 0.8113, and 0.4780 against 0.4690',
            result: 'errors of 0.0021 and 0.0090 bits'
          },
          {
            do: 'Push to p = 0.01, where the rare symbol appears about 200 times.',
            why: 'A rare symbol is where a finite sample is least informative.',
            work: '0.0831 against 0.0808',
            result: '0.0023 bits — small in absolute terms and 2.8% in relative ones'
          },
          {
            do: 'Build Markov chains with 4 and 8 states.',
            why: 'Their order-1 entropy is the entropy of one row of the transition matrix.',
            work: '1.0348 against 1.0389, and 2.1049 against 2.0939',
            result: 'errors of 0.0041 and 0.0110 bits — the worst of the six'
          },
          {
            do: 'Check that the order-0 estimate of the Markov chain does NOT match.',
            why: 'It should not: the stationary distribution is uniform.',
            work: 'order 0 measures near log₂(4) = 2 bits while order 1 measures 1.03',
            result: 'the estimator sees the structure exactly where the structure is'
          }
        ],
        answer: 'Six sources, six closed forms, and a worst disagreement of 0.0110 bits. That is ' +
          'not an interesting result in itself — it is the licence for every other number in the ' +
          'milestone, because each of those is a ratio measured against an entropy this same code ' +
          'produced. An estimator with a systematic bias would make every codec in every later ' +
          'section look uniformly good or uniformly bad, and nothing in those sections would look ' +
          'wrong. The cheapest defence against that is to measure something whose answer is ' +
          'already known.'
      }
    ],

    'prefix-codes-and-huffman': [
      {
        title: 'A code table, the bits it spends, and the bits each symbol carries',
        goal: 'Build a Huffman code and account for every bit of the gap between it and the ' +
          'entropy.',
        setup: '3 000 bytes of English text, 30 distinct symbols, coded and decoded with the ' +
          'round-trip verified.',
        steps: [
          {
            do: 'Build the code and read the total.',
            why: 'This is the number a compression ratio would be computed from.',
            work: '4.6173 bits per symbol against an entropy of 4.5623',
            result: '1.0121× the floor — a 1.2% gap'
          },
          {
            do: 'Check the Kraft sum.',
            why: 'It is 1 exactly for a complete prefix code and below 1 if space is wasted.',
            work: 'Σ 2^(−length) = 1.0000',
            result: 'no codeword could have been made shorter without lengthening another'
          },
          {
            do: 'Read the per-symbol waste column.',
            why: 'It shows where the 1.2% comes from, and it goes both ways.',
            work: 'the space costs 3 bits and carries 2.47 (+0.53); "e" costs 4 and carries 4.31 ' +
              '(−0.31)',
            result: 'roundings up and down that nearly cancel when weighted by frequency'
          },
          {
            do: 'Cost the table three ways.',
            why: 'The decoder cannot start without it, so it is part of the output.',
            work: '299 bits as an explicit tree, 1 024 as a plain canonical table, 178 ' +
              'run-length coded',
            result: 'the run-length form wins at 23 bytes, and the plain canonical form LOSES'
          },
          {
            do: 'Read the density figure beside that.',
            why: 'It explains the ordering.',
            work: '30 used symbols of 256 — a density of 11.7%',
            result: 'the canonical table pays four bits each for 226 symbols that never appear'
          }
        ],
        answer: 'Huffman lands 1.2% above the entropy on a rich alphabet, and the waste column ' +
          'shows why: rounding to whole bits costs some symbols and refunds others. The table row ' +
          'is the one that corrects a piece of folklore — canonical Huffman is not simply smaller ' +
          'than an explicit tree. At 11.7% density the plain canonical form is three and a half ' +
          'times LARGER, and what actually makes it cheap is DEFLATE’s extra run-length layer ' +
          'over the length array, where the 226 unused zeros collapse.'
      },
      {
        title: 'The inverted case: the source Huffman cannot code, swept over six skews',
        goal: 'Find the case where the whole-bit constraint dominates, and measure how far it ' +
          'goes.',
        setup: 'A two-symbol source of 2 000 bytes at rarer-symbol shares from 1 in 2 down to 1 ' +
          'in 1 000, coded by both Huffman and an arithmetic coder against the same frequencies.',
        steps: [
          {
            do: 'Start at an even split.',
            why: 'Here the two coders should be indistinguishable.',
            work: 'entropy 1.0000, Huffman 1.0000, arithmetic 1.0010',
            result: 'a ratio of 1.00× — and the arithmetic coder is marginally WORSE, by its ' +
              'two-bit terminator'
          },
          {
            do: 'Skew to 1 in 10.',
            why: 'The entropy falls and Huffman cannot follow.',
            work: 'entropy 0.4690, Huffman 1.0000, arithmetic 0.4695',
            result: '2.13× the floor for Huffman, 1.001× for arithmetic'
          },
          {
            do: 'Skew to 1 in 100.',
            why: 'This is the classic "99/1" case.',
            work: 'entropy 0.0808, Huffman 1.0000, arithmetic 0.0810',
            result: '12.38× — Huffman spends twelve times what the data carries'
          },
          {
            do: 'Skew to 1 in 1 000.',
            why: 'To see whether the gap is bounded.',
            work: 'entropy 0.0114, Huffman 1.0000, arithmetic 0.0120',
            result: '87.66× against 1.052× — and the Huffman figure has not moved at all'
          },
          {
            do: 'Read the Huffman column down the whole table.',
            why: 'The constancy is the point.',
            work: '1.0000 in every row, at every skew',
            result: 'there is no shorter codeword than one bit, and with two symbols nothing to ' +
              'trade against'
          }
        ],
        answer: 'The Huffman column is a flat line at exactly one bit and the entropy falls away ' +
          'beneath it by a factor of nearly ninety. That is not an implementation limit — the ' +
          'greedy merge is provably optimal at every one of those rows — it is the whole-bit ' +
          'constraint, and the arithmetic column shows what removing it is worth. The left-hand ' +
          'row is the honest counterweight: at an even split the two coders are identical and the ' +
          'arithmetic one is fractionally worse, so the case for it is entirely about skewed ' +
          'distributions, which is exactly what a context model produces.'
      }
    ],

    'arithmetic-coding-and-ans': [
      {
        title: 'One message as one number, and the overhead that does not scale',
        goal: 'Code a corpus with an integer arithmetic coder and account for every bit above the ' +
          'information content.',
        setup: '3 000 bytes of English text over a static model, coded and decoded with the ' +
          'round-trip verified, beside rANS and Huffman on the same frequencies.',
        steps: [
          {
            do: 'Compute the message’s information content under the model.',
            why: 'This is the target: no coder can beat it and a good one gets within two bits.',
            work: '−Σ log₂ p(xᵢ) = 13 687.0 bits, which is 4.5623 bits per byte times 3 000',
            result: 'the floor, in bits, for this model'
          },
          {
            do: 'Run the integer coder.',
            why: 'Sixteen-bit low and high, renormalisation, pending-bit counter.',
            work: '13 688 bits emitted, decoded back to the original bytes',
            result: '+1.03 bits over the whole message — 0.00034 bits per symbol'
          },
          {
            do: 'Run Huffman against the same frequencies.',
            why: 'Same model, same message: the only variable is how bits are spent.',
            work: '13 852 bits',
            result: '+165.0 bits, which is 0.055 per symbol — the whole-bit penalty accumulating'
          },
          {
            do: 'Run rANS with the model quantised to 4 096.',
            why: 'It needs a power-of-two total, and it flushes a 32-bit state.',
            work: '13 712 bits',
            result: '+25.0 bits, of which 32 is the state flush and the rest is quantisation'
          },
          {
            do: 'Read the pending-underflow counter.',
            why: 'It is the part of the implementation that is easy to omit.',
            work: 'as many as 10 bits owed at once',
            result: 'ten renormalisations in a row where neither end had decided its leading bit'
          }
        ],
        answer: 'The arithmetic coder is one bit above the information content of the entire ' +
          'file, which is a rounding error, and Huffman is a hundred and sixty-five — the same ' +
          'model, the same message, and the difference is whether a symbol’s cost has to be an ' +
          'integer. The pending counter is the row worth carrying into an implementation: it ' +
          'reached ten here, and a coder written without it produces correct output whenever that ' +
          'count stays at zero, which on short test inputs it usually does. That is a bug that ' +
          'passes the tests you wrote and corrupts the files you did not.'
      },
      {
        title: 'The inverted case: watching one interval narrow, symbol by symbol',
        goal: 'Follow a short message through the interval subdivision and see the fractional ' +
          'bits accumulate.',
        setup: 'The word "bananas" coded against its own letter frequencies, with the interval ' +
          'printed after every symbol.',
        steps: [
          {
            do: 'Code the first symbol.',
            why: 'The interval narrows by that symbol’s probability, not by a half.',
            work: 'the interval becomes 0.200 wide',
            result: '2.32 bits of information, and no bit has been emitted yet'
          },
          {
            do: 'Code the second.',
            why: 'The new interval is a sub-interval of the old one.',
            work: 'width 1.20e-1',
            result: '3.06 bits — an increase of 0.74, which is not a whole number'
          },
          {
            do: 'Code a rarer symbol.',
            why: 'A rarer symbol narrows the interval more.',
            work: 'width 2.40e-2',
            result: '5.38 bits — this one symbol cost 2.32'
          },
          {
            do: 'Finish the message.',
            why: 'The final width is the product of all seven probabilities.',
            work: 'width 1.31e-4, needing 12.90 bits to name a point inside',
            result: 'the integer coder emits 14 bits'
          },
          {
            do: 'Compare the emitted count against the ideal.',
            why: 'The difference is the terminator, not per-symbol rounding.',
            work: '14 emitted against 12.90 ideal, on a 7-symbol message',
            result: '1.1 bits of overhead — which would be the same on a message of a million ' +
              'symbols'
          }
        ],
        answer: 'No row of that table halves the interval. Each one multiplies it by a ' +
          'probability, and a probability is not a power of two — which is the thing a symbol ' +
          'code cannot do and the reason the total is 12.90 bits rather than a whole number of ' +
          'them. The seven-symbol message is also the honest edge of the technique: 1.1 bits of ' +
          'terminator on 12.90 is nine per cent, so on very short messages arithmetic coding’s ' +
          'advantage disappears into its own constant, and it is on files that the per-message ' +
          'overhead becomes free.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));

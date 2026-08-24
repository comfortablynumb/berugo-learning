/** Worked examples for dictionaries, codecs, context models and transforms (M22.4-M22.7). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'dictionary-compression': [
      {
        title: 'The compression-level ladder, measured rather than described',
        goal: 'Show that a compression level is a search budget by moving only the chain cut-off.',
        setup: '6 000 bytes of mixed prose, LZSS with a 4 096-byte window, search depth swept from ' +
          '1 to 64, with the round-trip verified at every setting.',
        steps: [
          {
            do: 'Compress at depth 1 — take the first match the chain offers.',
            why: 'This is the cheapest possible match finder that still finds matches.',
            work: '3 985 bytes from 6 000, at 0.22 chain links walked per input byte',
            result: 'a ratio of 1.506 for almost no search'
          },
          {
            do: 'Walk four links instead.',
            why: 'A longer match may be further down the chain.',
            work: '3 615 bytes at 0.67 links per byte',
            result: '1.660 — most of the total gain, for three times the work'
          },
          {
            do: 'Walk sixty-four.',
            why: 'This is what a level-9 encoder does.',
            work: '3 245 bytes at 2.28 links per byte',
            result: '1.849, and the curve has visibly flattened'
          },
          {
            do: 'Read the matched-bytes column across the sweep.',
            why: 'It says what the deeper search actually bought.',
            work: '5 648 bytes matched at depth 1 and 5 668 at depth 64, from 1 305 matches down ' +
              'to 1 044',
            result: 'the same input covered by 20% fewer, longer tokens'
          },
          {
            do: 'Divide the two ends.',
            why: 'This is the trade a level dial offers.',
            work: '10.5× the search work for a 22.8% better ratio',
            result: 'and the decoder is unaffected — it reads the same tokens at the same speed'
          }
        ],
        answer: 'One algorithm, one corpus, one parameter, and the parameter is how many links of ' +
          'a hash chain to walk before giving up. That is what "level 9" means in gzip, zstd and ' +
          'brotli, and the shape of the curve is the whole argument for choosing a low level by ' +
          'default: the first few steps buy most of the ratio and the last few cost most of the ' +
          'time. The decision is not about compression, it is about the ratio of writes to reads ' +
          '— because the entire cost falls on the writer and every subsequent reader gets the ' +
          'better ratio for free.'
      },
      {
        title: 'The inverted case: a bare LZSS losing to a 1984 algorithm',
        goal: 'Compare the two dictionary families on the same prose and find out why the older ' +
          'one wins.',
        setup: 'The same 6 000 bytes, coded by LZSS at depth 32, LZSS with lazy matching, and ' +
          'LZW — all three round-trip verified.',
        steps: [
          {
            do: 'Cost an LZSS token.',
            why: 'The fields are fixed-width, and every match pays all of them.',
            work: '1 flag bit + 12 distance bits + 8 length bits = 21 bits per match, 9 per literal',
            result: 'a four-byte match costs 21 bits to save 32 — a real but small win'
          },
          {
            do: 'Compress with LZSS at depth 32.',
            why: 'A thorough search, so match finding is not the limitation.',
            work: '3 265 bytes, 1 051 matches, 333 literals',
            result: 'a ratio of 1.838'
          },
          {
            do: 'Add lazy matching.',
            why: 'A one-symbol lookahead, for roughly twice the search work.',
            work: '3 121 bytes',
            result: '1.922 — a 4.61% gain, which is why every encoder does it'
          },
          {
            do: 'Compress with LZW instead.',
            why: 'No distances at all: a fixed-width code into a shared dictionary.',
            work: '2 811 bytes from 1 873 dictionary entries at 12 bits per code',
            result: '2.134 — BETTER than either LZSS run'
          },
          {
            do: 'Compare the per-token costs.',
            why: 'The ranking is an arithmetic consequence, not a mystery.',
            work: '21 bits per LZSS match against 12 bits per LZW code',
            result: 'on prose whose repeats are short, fixed-width distance fields lose'
          }
        ],
        answer: 'LZW beats a bare LZSS here by 1.11×, and that is worth sitting with rather than ' +
          'explaining away. It is not that LZ77 is a worse idea — it is that a fixed 12-bit ' +
          'distance and 8-bit length are expensive when most matches are four bytes long. What ' +
          'reverses it is entropy-coding the tokens, so that the common short distances and ' +
          'lengths get short codewords: exactly what DEFLATE adds on top, and exactly why the ' +
          'next section measures DEFLATE beating both of these by a wide margin on the same data.'
      }
    ],

    'general-purpose-codecs': [
      {
        title: 'Six codecs, seven corpora, and two different winners',
        goal: 'Establish that a compression ratio is a property of the data by asking one question ' +
          'seven times.',
        setup: '3 000 bytes of each corpus through every codec, with the entropy beside each row ' +
          'and every round-trip verified.',
        steps: [
          {
            do: 'Run the set on English text.',
            why: 'Natural language with strong local structure.',
            work: 'Huffman 1.710, arithmetic 1.708, rANS 1.706, LZSS 13.453, DEFLATE 15.625, BWT ' +
              'chain 14.851',
            result: 'DEFLATE wins, and the order-0 coders are not in the same race'
          },
          {
            do: 'Run it on JSON logs.',
            why: 'The keys repeat exactly and only the values move.',
            work: 'DEFLATE 24.793 against LZSS 21.583 and Huffman 1.731',
            result: 'the highest ratio in the whole table — literal repetition is what LZ77 is for'
          },
          {
            do: 'Run it on mixed prose.',
            why: 'Words drawn from a Zipf distribution: real repeats, none dominant.',
            work: 'BWT chain 2.841, DEFLATE 2.027, Huffman 1.974, LZSS 1.740',
            result: 'the winner CHANGES — and LZSS is now the worst of the six'
          },
          {
            do: 'Run it on random bytes.',
            why: 'The theorem says every codec must expand this.',
            work: 'DEFLATE 0.998, Huffman 0.978, BWT 0.974, arithmetic 0.893, LZSS 0.889',
            result: 'all six expand, and the spread between them is the interesting part'
          },
          {
            do: 'Read the DEFLATE row on that last corpus against the others.',
            why: 'It is the stored block, and nothing else.',
            work: '0.998 against 0.889 — five bytes of overhead against a 12.5% expansion',
            result: 'the property that matters when the input is untrusted'
          }
        ],
        answer: 'Two different codecs win at least one corpus, and the gap between the best and ' +
          'worst codec on one corpus is smaller than the gap between corpora for one codec. That ' +
          'is the case for publishing the corpus with every ratio. The random-bytes row is the ' +
          'other half of the discipline: it is reported rather than omitted, and it shows that ' +
          'the practical difference between DEFLATE and a pure entropy coder on incompressible ' +
          'input is not the compression at all — it is whether the format has a way to give up.'
      },
      {
        title: 'The inverted case: the degenerate inputs, in bits',
        goal: 'Run every codec on the four inputs that break implementations, and check the ' +
          'round-trip on each.',
        setup: 'Empty input, one byte, a thousand identical bytes, and a thousand bytes that are ' +
          '99% one value.',
        steps: [
          {
            do: 'Compress nothing.',
            why: 'An encoder that mishandles this produces empty output that decodes to nothing.',
            work: '0 bits from every codec',
            result: 'and all six decode back to an empty array'
          },
          {
            do: 'Compress a single byte.',
            why: 'This is the honest floor on any format’s overhead.',
            work: 'Huffman 27 bits, arithmetic 14, rANS 44, LZSS 9, DEFLATE 24, BWT chain 27',
            result: 'every scheme costs more to describe one byte than to store it'
          },
          {
            do: 'Compress a thousand identical bytes.',
            why: 'The entropy is zero, so this is a test of overhead alone.',
            work: 'arithmetic 14 bits, BWT chain 32, DEFLATE 80, LZSS 97, Huffman 1 026',
            result: 'Huffman spends a whole bit per symbol on a source that carries none'
          },
          {
            do: 'Compress the 99/1 split.',
            why: 'This is the skew sweep’s worst case, as a single row.',
            work: 'Huffman 1 033 bits, arithmetic 106, rANS 136, BWT chain 51',
            result: 'a factor of 9.7 between Huffman and the arithmetic coder'
          },
          {
            do: 'Check the round-trip column.',
            why: 'A ratio from a codec that cannot decode is not a measurement.',
            work: '66 of 66 verified across the corpora and the edge cases',
            result: 'every size in both tables is a size of something that decompressed'
          }
        ],
        answer: 'The all-identical row is the previous two sections in one line: a source with ' +
          'zero entropy, and Huffman spends 1 026 bits on it because a codeword cannot be shorter ' +
          'than one bit. The arithmetic coder spends 14. The BWT chain spends 32 by turning the ' +
          'run into something an order-0 coder can see, which is a preview of the transform ' +
          'section. And every row decodes — which sounds like a formality until you notice that ' +
          'the empty-input case produces plausible-looking output from an encoder that is wrong.'
      }
    ],

    'context-modelling': [
      {
        title: 'Where more context stops helping, and what fixes it',
        goal: 'Run three ways of using context over the same input and find the turnaround.',
        setup: '1 500 bytes of English text over an alphabet of 30, modelled at orders 0 to 4 by ' +
          'a plain order-k model, by PPM with escapes, and by an adaptive mixture.',
        steps: [
          {
            do: 'Measure the plain model at orders 0, 1 and 2.',
            why: 'Each order conditions on one more preceding symbol.',
            work: '4.6176, 3.1377 and 3.0088 bits per symbol',
            result: 'a 35% improvement, most of it from the first order'
          },
          {
            do: 'Keep going to orders 3 and 4.',
            why: 'More context should predict better.',
            work: '3.0775 and 3.1418 bits per symbol',
            result: 'WORSE than order 2 — the curve has turned around'
          },
          {
            do: 'Read the observations-per-context column.',
            why: 'It explains the turnaround exactly.',
            work: '48.4 at order 1, 13.4 at order 2, 8.3 at order 4 over 180 contexts',
            result: 'most predictions now come from a context that has seen one or two things'
          },
          {
            do: 'Run PPM at the same orders.',
            why: 'It escapes to a shorter context instead of reserving mass for the alphabet.',
            work: '2.4656, 1.4576, 1.1604 and 1.1009 bits at maximum orders 1 to 4',
            result: 'it keeps improving all the way — 0.350× the plain model at order 4'
          },
          {
            do: 'Read the escape rate.',
            why: 'Escapes are symbols too, and they cost bits.',
            work: '0.0727, 0.0987, 0.1013 and 0.1027 escapes per symbol',
            result: 'nearly flat past order 2 — the deep contexts are usually finding their answer'
          }
        ],
        answer: 'Same input, same orders, and the only difference is what happens when the ' +
          'context has no answer. A plain model must have an opinion about all thirty symbols, so ' +
          'a context seen twice spends most of its probability on twenty-eight it has never seen; ' +
          'PPM says "ask someone shorter" and pays one escape symbol for the privilege. The ' +
          'escape rate barely moves past order 2, which says the mechanism is being used exactly ' +
          'where it should be — on the sparse contexts and nowhere else.'
      },
      {
        title: 'The inverted case: watching the weights migrate through the file',
        goal: 'Mix four orders and see which one is carrying the prediction at each point.',
        setup: 'The same 1 500 bytes, four order-k models blended by a mixer whose weights move ' +
          'by gradient descent on the coding loss after every symbol.',
        steps: [
          {
            do: 'Start with the weights equal.',
            why: 'The mixer has no information yet.',
            work: '0.2500 on each of orders 0, 1, 2 and 3, at 4.9069 bits per symbol so far',
            result: 'the opening of the file is coded expensively, as any adaptive model must be'
          },
          {
            do: 'Read the weights at symbol 373.',
            why: 'By now the low orders have evidence and the high ones do not.',
            work: 'order 0 at 0.0076, order 1 at 0.7528, order 2 at 0.1749, order 3 at 0.0647',
            result: 'order 1 is carrying three quarters of the prediction'
          },
          {
            do: 'Read them again at symbol 931.',
            why: 'The deeper contexts have now been seen several times each.',
            work: 'order 1 at 0.2771, order 2 at 0.6017, order 3 at 0.1211',
            result: 'the handover has happened, without anyone choosing an order'
          },
          {
            do: 'Read the final weights.',
            why: 'This is where the mixture settled.',
            work: 'order 0 at 0.0001, order 1 at 0.0113, order 2 at 0.7673, order 3 at 0.2213',
            result: 'order 2 dominant — which is also the best single order on this corpus'
          },
          {
            do: 'Compare the mixture’s total against that best single order.',
            why: 'Mixing has to earn its cost.',
            work: '2.996 bits per symbol against order 2’s 3.009',
            result: '0.0125 bits better, having never been told which order to use'
          }
        ],
        answer: 'The mixture beats the best single order by a small margin and — more usefully — ' +
          'it finds it without being told. The weight trace is the part worth reading: order 0 ' +
          'carries the first few hundred symbols and is then abandoned entirely, order 1 takes ' +
          'over, and order 2 takes over from that as its contexts accumulate evidence. A file ' +
          'whose character changes halfway through would show the handover reversing, which is ' +
          'exactly the case a fixed hyperparameter cannot handle and a mixture does not have to.'
      }
    ],

    'transform-compression': [
      {
        title: 'A transform that removes nothing and halves the file',
        goal: 'Follow the bzip2 chain stage by stage and find where the compression actually ' +
          'happens.',
        setup: '2 000 bytes of English text through BWT, move-to-front, run-length coding and an ' +
          'order-0 entropy stage, with the entropy and the floor reported after each.',
        steps: [
          {
            do: 'Measure the input.',
            why: 'This is the baseline every later stage is compared against.',
            work: '4.5612 bits per byte over 2 000 symbols — a floor of 1 141 bytes',
            result: 'ordinary English text'
          },
          {
            do: 'Apply the transform and measure again.',
            why: 'The whole point of the section is what this row says.',
            work: '4.5612 bits per byte over 2 000 symbols — a floor of 1 141 bytes',
            result: 'IDENTICAL: a permutation cannot change the symbol counts'
          },
          {
            do: 'Look at the first 32 bytes of each.',
            why: 'The entropy is unchanged and the arrangement is not.',
            work: 'the first 32 bytes go from "the_quick_brown_fox_jumps_over_t" to ' +
              '"ffffffffffyyyyyyyyyyeeeeeeeeeekk"',
            result: 'runs of one character, from an input that had none'
          },
          {
            do: 'Apply move-to-front.',
            why: 'A run of one character becomes a run of zeros.',
            work: '0.7405 bits per byte — a floor of 186 bytes',
            result: 'a factor of 6.16, and 92.6% of the output is zeros'
          },
          {
            do: 'Run-length code the zeros and read both columns.',
            why: 'The per-symbol figure rises and the total falls.',
            work: '294 symbols at 4.0861 bits — a floor of 151 bytes',
            result: 'bits per symbol up by 5.5×, bytes down by 19%'
          }
        ],
        answer: 'The first two rows are identical to four decimal places and the file ends up at ' +
          'an eighth of its size. That is the section in one table: the transform removed no ' +
          'redundancy and made a weak model accurate, and the entropy coder at the end is plain ' +
          'order-0 Huffman — the very coder the earlier sections showed leaves a lot on the ' +
          'table. The last row is also a lesson in reading metrics: bits per symbol went UP at ' +
          'the run-length stage while the total went down, because the symbol count changed and a ' +
          'per-symbol figure is meaningless without it.'
      },
      {
        title: 'The inverted case: the block size, and what a bigger window buys',
        goal: 'Sweep the one real parameter and find where the returns stop.',
        setup: 'The same 2 000 bytes, transformed in blocks of 64, 256, 1 024 and 4 096 bytes, ' +
          'with the zero share after move-to-front reported at each.',
        steps: [
          {
            do: 'Use 64-byte blocks.',
            why: 'A block is a compression boundary: nothing is found across one.',
            work: '32 blocks, 4.5975 bits per symbol after MTF, 10.1% zeros',
            result: 'a ratio of 1.739 — the transform has barely helped'
          },
          {
            do: 'Quadruple the block.',
            why: 'More context per sort means more of the data lands in runs.',
            work: '8 blocks, 3.8457 bits, 40.8% zeros',
            result: '2.079'
          },
          {
            do: 'Quadruple again.',
            why: 'Now most of the corpus is in one block.',
            work: '2 blocks, 1.3263 bits, 85.2% zeros',
            result: '6.024 — the ratio has tripled'
          },
          {
            do: 'Use one block for the whole input.',
            why: 'The maximum context this corpus can offer.',
            work: '1 block, 0.7405 bits, 92.6% zeros',
            result: '10.753'
          },
          {
            do: 'Read the zero share as the explanatory column.',
            why: 'It is the mechanism, and the ratio follows it exactly.',
            work: '10.1% → 40.8% → 85.2% → 92.6%',
            result: 'the gain per doubling is already shrinking at the top'
          }
        ],
        answer: 'The zero share is the column that explains the ratio, and it says what a bigger ' +
          'block actually does: gather more of the data into runs, so move-to-front has more to ' +
          'work with. The cost is sorting — O(n log n) over rotations plus the memory to hold the ' +
          'block and its order — which is why bzip2 caps it at 900 KB. It is also the same ' +
          'trade-off LZ77’s window makes under a different name: a boundary is a place where ' +
          'repetition stops being found.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));

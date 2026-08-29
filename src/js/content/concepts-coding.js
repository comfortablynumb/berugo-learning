/** Concepts for entropy, prefix codes and arithmetic coding (M22.1-M22.3). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'information-and-entropy': [
      {
        term: 'Entropy is the floor, and it is a property of a MODEL',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["a model: what do you believe<br/>generates these symbols?"] --> B["entropy of that model"]',
            '    B --> C["the fewest bits per symbol<br/>any coder can reach"]',
            '    D["a better model"] --> E["a lower floor"]',
            '    E --> F["so beating the entropy means<br/>you changed the model,<br/>not that you beat information theory"]'
          ].join('\n'),
          caption: 'There is no such thing as the entropy of a file. There is the entropy under a model, and improving compression is almost always improving the model.'
        },
        plain: 'The average bits a symbol carries, given some belief about what generates them.',
        formal: 'H = −Σ p(x)·log₂ p(x); no lossless code averages fewer bits per symbol',
        readAs: 'Entropy is minus the sum, over every symbol, of its probability times the ' +
          'base-two logarithm of that probability.',
        detail: 'The source-coding theorem makes this the only honest denominator for a ' +
          'compression ratio. "Three times compression" is a claim with no unit until you say ' +
          'three times against what, and the answer is always the entropy of some model — which ' +
          'is why there is no single entropy of a file. An order-0 model sees each byte alone, ' +
          'an order-2 model conditions on the previous two, and they give different floors for ' +
          'the same bytes.',
        example: 'The demo measures English text at 4.5623 bits per byte at order 0 and 0.6345 ' +
          'at order 2, over 3 000 bytes.'
      },
      {
        term: 'A high-order estimate on a short input is memorisation',
        plain: 'Every context seen once, every prediction certain, and nothing learned.',
        formal: 'conditional entropy estimated from a finite sample is biased downward, severely when contexts are sparse',
        detail: 'This is the failure that makes entropy estimates dangerous rather than merely ' +
          'imprecise. With 256 possible bytes, an order-2 model has 65 536 contexts; over three ' +
          'thousand samples each one is seen about once, every prediction is a memory of a single ' +
          'observation, and the reported entropy approaches zero. The number looks like a result ' +
          'and describes the sample. The defence is to report the context count and the ' +
          'observations per context beside every estimate, which is what turns the failure from ' +
          'invisible into obvious.',
        example: 'The demo marks 3 of its 7 corpora as unusable at order 2, including random ' +
          'bytes at 2 944 contexts and 1.0 observation each.'
      },
      {
        term: '"Random data does not compress" is a theorem, not a limitation',
        plain: 'There are more files than there are shorter descriptions of files.',
        formal: 'there are 2ⁿ files of n bits and fewer than 2ⁿ strings shorter than n, so no injection can shorten them all',
        readAs: 'There are two-to-the-n files of n bits and strictly fewer strings shorter than ' +
          'n, so no one-to-one map can make every file smaller.',
        detail: 'The counting argument is complete and needs nothing from information theory. It ' +
          'also implies the useful corollary: any compressor that shrinks some inputs must expand ' +
          'others, so a codec is a bet about which inputs you will actually see. That is why a ' +
          'compression benchmark must include incompressible data and report the expansion rather ' +
          'than quietly dropping the row.',
        example: 'The demo measures random bytes at 7.936 bits per byte — within 0.064 of the ' +
          'maximum 8 — and every codec in the milestone expands them.'
      },
      {
        term: 'Cross-entropy is what a wrong model actually costs',
        plain: 'The bits a coder spends when its beliefs do not match reality.',
        formal: 'H(p, q) = −Σ p(x)·log₂ q(x) = H(p) + D(p ‖ q), and it is never below H(p)',
        readAs: 'The cross-entropy of the true distribution p under the model q is the entropy ' +
          'of p plus the KL divergence from p to q, and that divergence is never negative.',
        detail: 'A coder spends −log₂ q(x) bits on a symbol its model gave probability q(x), so ' +
          'the average cost is the cross-entropy and the excess over the entropy is pure waste. ' +
          'That is the same quantity, in the same units, that a language model reports as its ' +
          'training loss — which is why "compression is prediction" is arithmetic rather than a ' +
          'slogan. It also explains why a confident wrong model costs more than a hesitant one: ' +
          'the logarithm punishes low probability on what actually happened.',
        example: 'The demo’s arithmetic coder pays 13 688 bits against an information content of ' +
          '13 687.0 — the cross-entropy of a model that is exactly right.'
      },
      {
        term: 'Mutual information is the redundancy between neighbours',
        plain: 'How much knowing the previous symbol tells you about this one.',
        formal: 'I(X; Y) = H(X) − H(X | Y), in bits',
        readAs: 'The mutual information between two variables is the entropy of the first ' +
          'minus its entropy once the second is known — in other words, how much uncertainty ' +
          'about this symbol the previous one removes.',
        detail: 'It is the redundancy an order-1 model can remove, stated as one number, and it ' +
          'is the difference between what a symbol code can reach and what a context model can. ' +
          'On English text it is over two bits per byte — nearly half the order-0 figure — which ' +
          'is the measured reason a context-modelling compressor beats a Huffman coder by so much ' +
          'more than a better Huffman coder ever could.',
        example: 'The demo measures 4.5623 at order 0 and 1.9578 at order 1 on English text: ' +
          '2.60 bits per byte of mutual information.'
      },
      {
        term: 'The estimator itself has to be checked against closed forms',
        plain: 'Test the measuring instrument on sources whose answer is arithmetic.',
        formal: 'H(p) for a biased coin and H of one transition row for a Markov chain are exact, not estimated',
        detail: 'Every ratio in this milestone is measured against an entropy this code computes, ' +
          'so an estimator that is subtly wrong would make every downstream conclusion wrong in ' +
          'the same direction and none of them would look odd. Checking against a biased coin, ' +
          'where H(p) is a closed form, and a Markov chain, where the order-1 entropy is the ' +
          'entropy of one row of the transition matrix, is cheap and it is what licenses the ' +
          'rest.',
        example: 'The demo’s worst disagreement over six synthetic sources and 20 000 symbols is ' +
          '0.0110 bits, on an 8-state Markov chain.'
      },
      {
        term: 'A ratio and a bits-per-symbol figure are the same statement',
        plain: 'One hides the denominator and the other carries it.',
        formal: 'ratio = 8 / bitsPerSymbol for byte input; the floor is ⌈H·n/8⌉ bytes',
        readAs: 'The compression ratio is eight divided by the bits spent per byte, and the ' +
          'smallest possible output is the ceiling of the entropy times the symbol count over ' +
          'eight.',
        detail: 'Reporting bits per symbol invites the next question — against what entropy? — ' +
          'and reporting a ratio does not. That is the entire reason this milestone’s tables ' +
          'carry both columns with the entropy between them: a reader can see at a glance whether ' +
          'a coder is within one per cent of its own floor, in which case a better coder is ' +
          'pointless, or forty per cent away, in which case it is the whole opportunity.',
        example: 'The demo’s Huffman coder measures 4.6173 bits per byte against an entropy of ' +
          '4.5623 — 1.0121× the floor, and the ratio column alone would not show that.'
      },
      {
        term: 'Entropy is measured per corpus, because it is a property of the data',
        plain: 'The same compressor is superb on logs and useless on JPEGs.',
        formal: 'the redundancy an order-0 coder cannot reach is H₀ − H₂, and it varies by an order of magnitude across data types',
        readAs: 'The redundancy an order-zero coder cannot reach is the order-zero entropy minus ' +
          'the order-two entropy, and it differs by a factor of ten between one kind of data and ' +
          'another.',
        detail: 'A benchmark on one corpus produces a winner and no information. Structured text ' +
          'has enormous conditional redundancy because its keys repeat exactly; prose has less; ' +
          'already-compressed bytes have none by construction, since a codec’s output is ' +
          'high-entropy or the codec was not finished. Keeping several corpora and reporting all ' +
          'of them is what makes a compression comparison mean anything.',
        example: 'The demo measures 4.219 bits per byte of order-2 redundancy on JSON logs and ' +
          '2.336 on mixed prose.'
      }
    ],

    'prefix-codes-and-huffman': [
      {
        term: 'A prefix code needs no separators',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["no codeword is the start<br/>of another codeword"] --> B["so as soon as the bits read so far<br/>match one, they can match no other"]',
            '    B --> C["the decoder knows where to stop"]',
            '    C --> D["no delimiters, no lengths,<br/>no wasted bits between symbols"]'
          ].join('\n'),
          caption: 'The property sounds like a technicality and it is what makes the whole scheme work: a self-delimiting code spends nothing on saying where symbols end.'
        },
        plain: 'No codeword is the beginning of another, so a decoder always knows where to stop.',
        formal: 'Kraft–McMillan: lengths ℓᵢ are achievable by a prefix code iff Σ 2^(−ℓᵢ) ≤ 1',
        readAs: 'A set of codeword lengths can be realised by a prefix code exactly when the sum ' +
          'of two to the minus each length is at most one.',
        detail: 'The inequality is what makes the whole family tractable: it says the achievable ' +
          'length sets are exactly the ones satisfying one arithmetic condition, and — the second ' +
          'half of McMillan’s result — that any uniquely decodable code’s lengths satisfy it too. ' +
          'So nothing is lost by restricting attention to prefix codes, and a sum strictly below ' +
          'one means codeword space is being wasted and some symbol could have been shorter.',
        example: 'The demo reports a Kraft sum of exactly 1.0000 on its English-text code, which ' +
          'means the code is complete.'
      },
      {
        term: 'Huffman is optimal among symbol codes, and that qualifier is the lesson',
        plain: 'The best possible code that spends a whole number of bits per symbol.',
        formal: 'greedily merging the two least-frequent symbols minimises Σ p(x)·ℓ(x) over all integer-length prefix codes',
        readAs: 'Merging the two rarest symbols repeatedly gives the smallest possible average ' +
          'codeword length — the sum over symbols of probability times length — among all codes ' +
          'whose codewords are a whole number of bits.',
        detail: 'The proof is short: in an optimal code the two least frequent symbols are ' +
          'siblings at the deepest level, so merging them and solving the smaller problem is ' +
          'exact. What the algorithm cannot do is spend a fraction of a bit, and that is not a ' +
          'defect to be fixed — it is the definition of the family it is optimal within. Every ' +
          'complaint about Huffman’s ratio is a complaint about integer codeword lengths.',
        example: 'The demo measures 4.6173 bits per byte against an entropy of 4.5623 — 1.2% ' +
          'above the floor, and provably the best any integer-length code does on that table.'
      },
      {
        term: 'The gap is at most one bit per symbol, and that can be most of the file',
        plain: 'A symbol of probability 0.99 carries 0.0145 bits and costs a whole one.',
        formal: 'H ≤ average length < H + 1, and the bound is tight as the distribution skews',
        readAs: 'The average codeword length is at least the entropy and less than the entropy ' +
          'plus one bit.',
        detail: 'On a large flat alphabet the plus-one is invisible: rounding some symbols up and ' +
          'others down nearly cancels, and the demo lands 1.2% above the entropy on English. On a ' +
          'two-symbol source there is nothing to cancel — both codewords are one bit and the ' +
          'entropy can be arbitrarily small — so the ratio between what is spent and what is ' +
          'carried grows without limit. That single fact is the entire reason arithmetic coding ' +
          'exists.',
        example: 'The demo’s skew sweep pins Huffman at exactly 1.0000 bits at every setting, ' +
          'measuring 12.38× the entropy at 99:1 and 87.66× at 999:1.'
      },
      {
        term: 'Canonical Huffman transmits lengths, not codewords',
        plain: 'Sort by length then symbol, assign consecutive integers, and the codewords follow.',
        formal: 'code(i+1) = (code(i) + 1) << (ℓ(i+1) − ℓ(i)), starting from zero at the shortest length',
        readAs: 'Each codeword is the previous one plus one, shifted left by the increase in ' +
          'length.',
        detail: 'The decoder can rebuild every codeword from the length per symbol alone, which ' +
          'is what makes the table cheap, and it can decode with a length-indexed comparison ' +
          'rather than a tree in memory — one comparison per bit read and no pointer chasing. ' +
          'DEFLATE, JPEG and every serious format does this. The reconstruction is exact, so ' +
          'nothing about the compression changes; only the header does.',
        example: 'The demo’s canonical code gives the space "000" at length 3 and assigns the ' +
          'four-bit codewords 0010 through 0101 consecutively.'
      },
      {
        term: 'Which table encoding wins depends on how dense the alphabet is',
        plain: 'The canonical form pays for every symbol of the alphabet, used or not.',
        formal: 'tree ≈ (2k − 1) + k·log₂|Σ| bits for k used symbols; canonical ≈ 4·|Σ| bits',
        readAs: 'An explicit tree costs about two k minus one bits of shape plus a symbol per ' +
          'leaf; a canonical table costs about four bits for every symbol of the alphabet.',
        detail: 'This contradicts the usual folklore, which says canonical Huffman is simply ' +
          'smaller. On a sparse alphabet — thirty used bytes of 256 — the explicit tree wins ' +
          'outright, because the canonical table is paying four bits each for 226 symbols that ' +
          'never appear. What actually makes the sparse case cheap is DEFLATE’s extra layer: ' +
          'run-length coding the length array, where those 226 zeros collapse.',
        example: 'At 11.7% density the demo measures 299 bits for the tree, 1 024 for the plain ' +
          'canonical table and 178 run-length coded.'
      },
      {
        term: 'Adaptive Huffman transmits nothing and pays a learning curve',
        plain: 'Update the tree after every symbol; the decoder does the same.',
        formal: 'FGK maintains the sibling property in O(1) per symbol, so the tree stays optimal for the counts seen so far',
        detail: 'One pass instead of two matters when the input is a stream with no second ' +
          'chance, and no table in the header matters when the message is short. The cost is that ' +
          'the early symbols are coded under a nearly uniform model, and that the tree is ' +
          'restructured per symbol — a per-symbol cost a static code does not have. On a long ' +
          'stream the learning curve amortises away and the missing header is pure gain.',
        example: 'The demo’s adaptive arithmetic model — the same idea with a better coder — ends ' +
          'at 4.5971 bits per symbol against the static 4.5623, sending no table at all.'
      },
      {
        term: 'Two correct Huffman implementations can disagree byte for byte',
        plain: 'Ties in the merge produce different trees with identical cost.',
        formal: 'the optimum is a multiset of lengths, not a unique tree; any tie-break gives the same Σ p·ℓ',
        readAs: 'What is optimal is the collection of codeword lengths rather than any particular ' +
          'tree, and every way of breaking a tie gives the same average length — the sum of ' +
          'probability times length.',
        detail: 'This surprises people the first time they diff two compressed files and conclude ' +
          'one is broken. The greedy merge has to choose when two weights are equal, and the ' +
          'choice changes which symbol gets which codeword without changing the total. It is also ' +
          'why formats specify a canonical ordering: not for compression, but so that two ' +
          'encoders produce identical bytes and the output is reproducible.',
        example: 'The demo’s "i" and "o" both have count 166 and get 0011 and 0100 — a different ' +
          'tie-break would swap them at identical cost.'
      },
      {
        term: 'Per-symbol waste goes both ways and nearly cancels',
        plain: 'Some symbols are rounded up to the next whole bit and some down.',
        formal: 'waste(x) = ℓ(x) + log₂ p(x), which is negative when the codeword is shorter than the information',
        readAs: 'A symbol’s waste is its codeword length plus the base-two logarithm of its ' +
          'probability, and it is negative where the code is shorter than the symbol’s own ' +
          'information content.',
        detail: 'A codeword shorter than −log₂ p is possible for individual symbols — it has to ' +
          'be paid for by other symbols being longer, which is what the Kraft sum enforces. So a ' +
          'code table has a column of small positive and negative numbers, and weighted by ' +
          'frequency they nearly cancel. That cancellation is why Huffman is close to the entropy ' +
          'on a rich alphabet and why it collapses on a poor one, where there is nothing left to ' +
          'cancel against.',
        example: 'The demo’s space wastes +0.53 bits and "e" wastes −0.31; the whole table lands ' +
          '+0.0550 bits per symbol above the entropy.'
      }
    ],

    'arithmetic-coding-and-ans': [
      {
        term: 'One message, one number',
        plain: 'Narrow the interval by each symbol’s probability, then name a point inside.',
        formal: 'the final interval has width Π p(xᵢ), so naming a point costs −Σ log₂ p(xᵢ) bits',
        readAs: 'The surviving interval is as wide as the product of the symbol probabilities, ' +
          'so the bits needed are minus the sum of their base-two logarithms.',
        detail: 'Nothing rounds to a whole bit anywhere in the process, which is the entire ' +
          'difference from a symbol code. A symbol of probability 0.99 narrows the interval by a ' +
          'factor of 0.99 and costs 0.0145 bits — not one bit, not a bit that gets amortised, ' +
          'but genuinely a hundredth of a bit added to the total width. The message as a whole ' +
          'costs its own information content, and the only overhead is terminating the interval.',
        example: 'The demo codes "bananas" to a final interval of width 1.31e-4, which needs ' +
          '12.90 bits, and emits 14.'
      },
      {
        term: 'The overhead is a constant per MESSAGE, not per symbol',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["Huffman: a whole number<br/>of bits per SYMBOL"] --> B["the rounding is paid<br/>once per symbol"]',
            '    C["arithmetic coding: the whole message<br/>becomes one number"] --> D["the rounding is paid<br/>once per MESSAGE"]',
            '    B --> E["a symbol of probability 0.99<br/>still costs a full bit"]',
            '    D --> F["about two bits in total,<br/>however long the message"]'
          ].join('\n'),
          caption: 'This is why arithmetic coding matters on skewed distributions: Huffman cannot spend a fraction of a bit, and on a near-certain symbol the fraction is the whole cost.'
        },
        plain: 'About two bits, however long the message was.',
        formal: 'the coder emits ⌈−log₂(width)⌉ + 2 bits at most; the +2 terminates the interval',
        readAs: 'The output is at most the ceiling of minus the base-two logarithm of the final ' +
          'interval width, plus two bits to name a point inside it.',
        detail: 'Compare that with Huffman’s up-to-one-bit-per-symbol and the difference is the ' +
          'whole subject. On a three-thousand-byte corpus the arithmetic coder measures about one ' +
          'bit above the information content of the entire file, a rounding error, while a ' +
          'Huffman code over the same frequencies is a hundred and sixty-five bits above it. The ' +
          'per-message constant is why arithmetic coding is only ever worse than Huffman on ' +
          'messages of a handful of symbols.',
        example: 'The demo measures +1.03 bits for arithmetic and +165.0 for Huffman over 3 000 ' +
          'bytes — 0.00034 and 0.055 bits per symbol.'
      },
      {
        term: 'The integer implementation renormalises, and the underflow counter is not optional',
        plain: 'When low and high agree on a leading bit, emit it and shift both left.',
        formal: 'if low ≥ ¼ and high < ¾ neither end has decided its leading bit; remember a pending bit and emit its complement later',
        detail: 'This is the part that is easy to omit and fatal to omit. The interval can ' +
          'straddle the midpoint and keep shrinking with neither end committing to a leading bit; ' +
          'without the pending counter the coder either loses precision or emits nothing while ' +
          'the interval collapses. The failure mode is the worst kind — the count stays at zero ' +
          'on short inputs, so a hand-written coder passes its tests and corrupts real files.',
        example: 'The demo reports as many as 10 bits pending at once over a 3 000-byte corpus, ' +
          'and reports it as a metric precisely because it is invisible otherwise.'
      },
      {
        term: 'An adaptive model transmits nothing at all',
        plain: 'Counts start at one and rise; encoder and decoder update identically.',
        formal: 'p(x) = (count(x) + 1) / (total + |Σ|), updated after every symbol on both sides',
        readAs: 'A symbol’s probability is its count plus one, divided by the total plus the ' +
          'alphabet size.',
        detail: 'The model never goes in the stream, which removes the header entirely — and the ' +
          'price is a learning curve, because the first few hundred symbols are coded under a ' +
          'nearly uniform model. That is a real cost on short messages and disappears on long ' +
          'ones. It also means encoder and decoder must update in exactly the same way; a ' +
          'floating-point discrepancy between two machines is enough to desynchronise them, which ' +
          'is why real implementations use integer counts.',
        example: 'The demo’s adaptive coder ends at 4.5971 bits per symbol against the static ' +
          '4.5623, having sent no table.'
      },
      {
        term: 'ANS keeps one integer of state, and decodes backwards',
        plain: 'Encoding pushes a symbol onto the state; decoding pops it.',
        formal: 'x ← ⌊x / f(s)⌋·M + (x mod f(s)) + c(s), where M is the frequency total and c the cumulative count',
        readAs: 'The new state is the old state divided by the symbol’s frequency, times the ' +
          'total, plus the remainder, plus the symbol’s cumulative count.',
        detail: 'Because the state is a stack, the decoder recovers symbols in the reverse of the ' +
          'order the encoder pushed them. That is not a quirk to work around — it is why an ANS ' +
          'encoder buffers its input and emits the stream to be read from the far end. In ' +
          'exchange the inner loop is a multiply, a divide and a table lookup with no serial ' +
          'dependency chain through a renormalisation, which is where the speed comes from.',
        example: 'The demo’s rANS run measures 13 712 bits against arithmetic coding’s 13 688 on ' +
          'the same model.'
      },
      {
        term: 'rANS needs a power-of-two frequency total',
        plain: 'So the slot lookup is a mask and the division a shift.',
        formal: 'the counts are normalised to sum to exactly 2^k, with every symbol held at 1 or more',
        detail: 'Normalising is part of the codec rather than a convenience, and it introduces a ' +
          'rounding error: a symbol whose true probability is not a multiple of 2^-k is coded ' +
          'against a slightly wrong one. That is one of the two reasons rANS measures marginally ' +
          'worse than an arithmetic coder here; the other is the fixed cost of flushing the ' +
          '32-bit state at the end. Both are constants, and on a real file they disappear.',
        example: 'The demo normalises to 2^12 = 4 096 and measures rANS at +25 bits over the ' +
          'information content, of which 32 is the state flush.'
      },
      {
        term: 'A model must never assign zero probability to a codeable symbol',
        plain: 'A probability of zero needs infinitely many bits.',
        formal: 'every symbol keeps a count of at least one; the frequency total is capped so scaling cannot round one to zero',
        detail: 'This is the failure that turns a working coder into one that throws or, worse, ' +
          'silently emits an unrecoverable stream. It arrives through the back door: counts grow, ' +
          'the total exceeds the coder’s precision, the implementation rescales, and a rare ' +
          'symbol rounds to zero. The defence is a cap on the total and a floor of one on every ' +
          'count, applied together, and it is why real coders halve all counts periodically ' +
          'rather than letting them grow.',
        example: 'The demo caps the model total at 16 384 and holds every symbol at one or more ' +
          'when it rescales.'
      },
      {
        term: 'This is why modern codecs switched',
        plain: 'Arithmetic-coding ratios at Huffman-like speed.',
        formal: 'zstd’s FSE, LZFSE and JPEG XL all use table-driven ANS in place of a Huffman stage',
        detail: 'Before ANS the entropy stage was a choice between a fast coder that wastes up to ' +
          'a bit per symbol and an accurate one with a multiply, a divide and a serial ' +
          'dependency, and formats mostly shipped the fast one. tANS collapses that: the whole ' +
          'coder becomes a state-machine table lookup, so the decoder is a load and a shift per ' +
          'symbol. The remaining question is not ratio against speed but whether the decoder can ' +
          'afford to run the symbol stream backwards.',
        example: 'The demo measures rANS within 0.2% of arithmetic coding’s bit count while ' +
          'replacing its inner loop with a table lookup.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));

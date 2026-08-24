/** Reference entries for entropy, prefix codes and arithmetic coding (M22.1-M22.3). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'information-and-entropy': {
      summary: 'The entropy of one corpus at five model orders with the reliability of each ' +
        'estimate reported beside it, seven corpora compared at orders 0 and 2, and the ' +
        'estimator itself checked against six sources whose entropy is a closed form.',
      intuition: 'There is no single entropy of a file — there is one per model, and a ' +
        'compression ratio without one is a claim with no denominator.',
      formulation: {
        equations: [
          {
            label: 'The definition, and the theorem that makes it a floor',
            expr: 'H = −Σ p(x)·log₂ p(x) · source coding: average length ≥ H',
            readAs: 'Entropy is minus the sum over symbols of probability times the base-two ' +
              'logarithm of probability, and no lossless code averages fewer bits than that.',
            terms: [
              { sym: 'per model', meaning: 'order 0 sees symbols alone; order k conditions on the previous k' },
              { sym: 'the floor in bytes', meaning: 'ceil(H·n/8), which is what a ratio should be measured against' },
              { sym: 'cross-entropy', meaning: 'what a WRONG model pays: H(p) + D(p ‖ q), never below H(p)' },
              { sym: 'mutual information', meaning: 'H(X) − H(X | previous) — the redundancy an order-1 model can remove' }
            ]
          },
          {
            label: 'English text at five orders, 3 000 bytes over 30 symbols',
            expr: 'order · bits per byte · contexts · observations each · floor',
            terms: [
              { sym: 'order 0', meaning: '4.5623 · 1 context · 3 000 each · 1 711 bytes' },
              { sym: 'order 1', meaning: '1.9578 · 30 · 100.0 · 735 bytes' },
              { sym: 'order 2', meaning: '0.6345 · 110 · 27.3 · 238 bytes' },
              { sym: 'orders 3 and 4', meaning: '0.2235 and 0.1225 · 158 and 176 contexts · 19.0 and 17.0 each' }
            ]
          },
          {
            label: 'The estimator against closed forms, 20 000 symbols each',
            expr: 'source · true entropy · measured · error',
            terms: [
              { sym: 'fair coin', meaning: '1.0000 · 1.0000 · 0.0000' },
              { sym: 'coin at p = 0.1 and p = 0.01', meaning: '0.4690 → 0.4780 and 0.0808 → 0.0831' },
              { sym: 'Markov, 4 states', meaning: '1.0389 · 1.0348 · 0.0041' },
              { sym: 'Markov, 8 states', meaning: '2.0939 · 2.1049 · 0.0110 — the worst of the six' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Every entropy estimate carries its context count and observations per context',
          why: 'A conditional entropy from contexts seen once is memorisation of the sample.',
          breaks: 'The demo’s order-2 estimate for random bytes reads 0.036 bits per byte over 2 944 contexts seen 1.0 times each — a flat contradiction of the counting theorem.'
        },
        {
          name: 'A compression figure is reported against a stated model’s entropy',
          why: 'A ratio hides its denominator and bits-per-symbol invites the question.',
          breaks: '"3× compression" is compatible with being 1% from the floor and with being 40% away, and those call for opposite decisions.'
        },
        {
          name: 'Expansion on incompressible input is reported, not dropped',
          why: 'Every codec that shrinks some inputs must expand others; hiding the row hides the theorem.',
          breaks: 'A benchmark with no incompressible corpus cannot distinguish a codec that degrades gracefully from one that does not.'
        }
      ],
      complexity: [
        { operation: 'order-0 entropy', average: 'one pass, O(n) time and O(|Σ|) space', worst: 'exact — no estimation involved beyond the sample itself' },
        { operation: 'order-k entropy', average: 'O(n·k) time, O(distinct contexts) space', worst: 'biased downward as contexts outnumber samples' },
        { operation: 'cross-entropy under a model', average: 'O(n) evaluations of the model', worst: 'unbounded where the model gives a symbol probability zero' },
        { operation: 'KL divergence', average: 'O(|Σ|) over the two distributions', worst: 'infinite where q assigns zero to something p does not' },
        { operation: 'the reliability check', average: 'contexts and observations-per-context, free with the estimate', worst: 'below about five observations per context the estimate is about the sample' },
        { operation: 'estimator validation', average: 'six synthetic sources, 20 000 symbols each', worst: 'measured error 0.0110 bits, on the 8-state Markov chain' }
      ],
      failureModes: [
        {
          symptom: 'A high-order model reports near-zero entropy and compresses nothing.',
          cause: 'The estimate is memorisation: each context was seen once, so each prediction is certain and useless on new data.',
          fix: 'Report observations per context. Below about five, treat the estimate as a statement about the sample.'
        },
        {
          symptom: 'A codec is "3× better" in one benchmark and worse in another.',
          cause: 'The ratio is a property of the corpus, not of the codec.',
          fix: 'Publish the corpus and the entropy beside every ratio, and use more than one corpus.'
        },
        {
          symptom: 'A compression project stalls after early easy wins.',
          cause: 'The coder is already near the entropy of its model; the remaining redundancy is conditional and needs a better model.',
          fix: 'Measure the order-1 and order-2 entropy. The gap to order 0 is exactly what a context model could still take.'
        },
        {
          symptom: 'Someone claims a compressor that shrinks any input.',
          cause: 'It cannot exist: counting says fewer short strings than long ones.',
          fix: 'Ask for the round-trip on random bytes. The theorem is not a limitation of the implementation.'
        }
      ],
      inTheWild: [
        'Language-model training loss, which is cross-entropy in the same units a compressor reports.',
        'The Hutter Prize, which is this equivalence turned into a competition on 1 GB of Wikipedia.',
        'Database and log-format capacity planning, where the order-0 entropy of a column predicts what any codec can do.',
        'Password-strength estimates, which are entropy claims about a model of how humans choose.'
      ],
      sources: [
        { title: 'Shannon — A mathematical theory of communication (1948)', note: 'entropy, the source-coding theorem, and the entropy of English' },
        { title: 'Cover and Thomas — Elements of Information Theory', note: 'the standard text: conditional entropy, mutual information, KL divergence' },
        { title: 'Paninski — Estimation of entropy and mutual information (2003)', note: 'why a plug-in estimate from a finite sample is biased downward' },
        { title: 'Li and Vitányi — An Introduction to Kolmogorov Complexity', note: 'the counting argument, and what "random" means for a single string' }
      ]
    },

    'prefix-codes-and-huffman': {
      summary: 'A Huffman code built from a live frequency table with the per-symbol waste ' +
        'reported against each symbol’s own information content, the two-symbol source swept ' +
        'from an even split to 999:1, and three encodings of the same table costed.',
      intuition: 'Huffman is optimal among codes that spend a whole number of bits per symbol, ' +
        'and that qualifier is worth a factor of eighty-seven on the wrong source.',
      formulation: {
        equations: [
          {
            label: 'The two results that bound the family',
            expr: 'Kraft–McMillan: Σ 2^(−ℓᵢ) ≤ 1 · Huffman: H ≤ average length < H + 1',
            readAs: 'A set of lengths is achievable exactly when the sum of two to the minus each ' +
              'length is at most one; and the best such code averages between the entropy and the ' +
              'entropy plus one bit.',
            terms: [
              { sym: 'the Kraft sum', meaning: 'exactly 1 for a complete code; below 1 means codeword space is wasted' },
              { sym: 'the +1', meaning: 'invisible on a rich alphabet, and the whole file on a two-symbol one' },
              { sym: 'canonical form', meaning: 'code(i+1) = (code(i) + 1) shifted by the length increase' },
              { sym: 'ties', meaning: 'produce different trees with identical cost — two correct encoders can differ byte for byte' }
            ]
          },
          {
            label: 'English text, 3 000 bytes, 30 symbols',
            expr: 'bits per symbol · entropy · ratio · Kraft',
            terms: [
              { sym: 'measured', meaning: '4.6173 bits per symbol' },
              { sym: 'the floor', meaning: '4.5623 — so 1.0121× and +0.0550 bits per symbol' },
              { sym: 'Kraft sum', meaning: '1.0000 exactly: the code is complete' },
              { sym: 'per-symbol waste', meaning: 'space +0.53, "e" −0.31 — roundings that nearly cancel' }
            ]
          },
          {
            label: 'The two-symbol sweep: Huffman against arithmetic against the floor',
            expr: 'rarer share · entropy · Huffman · arithmetic · Huffman ÷ entropy',
            terms: [
              { sym: '1 in 2', meaning: '1.0000 · 1.0000 · 1.0010 · 1.00×' },
              { sym: '1 in 10', meaning: '0.4690 · 1.0000 · 0.4695 · 2.13×' },
              { sym: '1 in 100', meaning: '0.0808 · 1.0000 · 0.0810 · 12.38×' },
              { sym: '1 in 1 000', meaning: '0.0114 · 1.0000 · 0.0120 · 87.66×' }
            ]
          },
          {
            label: 'Three ways to transmit the same code, at 11.7% alphabet density',
            expr: 'encoding · bits · bytes',
            terms: [
              { sym: 'explicit tree', meaning: '299 bits, 38 bytes — shape plus a symbol per leaf' },
              { sym: 'canonical, lengths only', meaning: '1 024 bits, 128 bytes — four bits per symbol of the whole alphabet' },
              { sym: 'canonical, run-length coded', meaning: '178 bits, 23 bytes — what DEFLATE actually does' },
              { sym: 'the folklore', meaning: 'canonical alone LOSES here; the run-length layer is what makes it cheap' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The Kraft sum is reported with the code',
          why: 'It is the check that no codeword could have been shortened for free.',
          breaks: 'A sum below one means unused codeword space — a bug in the tree walk or a code built from lengths that do not fit.'
        },
        {
          name: 'The table cost is counted as part of the output',
          why: 'A decoder cannot start without it, so a payload-only figure is not a file size.',
          breaks: 'On short messages the table dominates: 23 bytes of table against 1 731 of payload here, and far worse on a kilobyte.'
        },
        {
          name: 'A per-symbol waste column is signed',
          why: 'A codeword can be SHORTER than the symbol’s information content, paid for by others being longer.',
          breaks: 'Reporting only positive waste makes the gap look larger than it is and hides the cancellation that keeps Huffman close to the entropy.'
        }
      ],
      complexity: [
        { operation: 'building the tree', average: 'O(n log n) to sort, then O(n) merges with two queues', worst: 'the same — the merge is linear once the leaves are sorted' },
        { operation: 'canonical code assignment', average: 'O(n log n) to sort by (length, symbol)', worst: 'produces identical codewords in any conforming implementation' },
        { operation: 'encoding', average: 'one table lookup per symbol', worst: 'output length exactly Σ count·length, computable before emitting' },
        { operation: 'canonical decoding', average: 'one comparison per bit read, no tree in memory', worst: 'bounded by the longest codeword, which is at most n − 1 and in practice ~15' },
        { operation: 'adaptive (FGK)', average: 'O(1) amortised tree update per symbol', worst: 'measurably worse ratio on short inputs — the model starts uniform' },
        { operation: 'the whole-bit penalty', average: '+0.0550 bits per symbol on English here', worst: '87.66× the entropy on a two-symbol source at 999:1' }
      ],
      failureModes: [
        {
          symptom: 'A Huffman coder barely compresses a stream of flags or booleans.',
          cause: 'A two-symbol alphabet gives both symbols one bit whatever their probabilities.',
          fix: 'Group symbols into blocks, or use an arithmetic or ANS coder. The demo measures the gap at 12× on a 99/1 split.'
        },
        {
          symptom: 'The compressed file is bigger than the input on small messages.',
          cause: 'The code table is a fixed cost, and on a few hundred bytes it exceeds the saving.',
          fix: 'Use a static agreed-upon code, or an adaptive coder that transmits nothing, or do not compress below a size threshold.'
        },
        {
          symptom: 'Two Huffman implementations produce different bytes for the same input.',
          cause: 'Ties in the merge; both codes are optimal and their lengths agree in multiset.',
          fix: 'Nothing is wrong. Compare total lengths, not bytes — and use a canonical ordering if reproducible output matters.'
        },
        {
          symptom: 'A canonical table turns out bigger than an explicit tree.',
          cause: 'A sparse alphabet: the canonical form pays for every symbol, used or not.',
          fix: 'Run-length code the length array, which is the layer DEFLATE adds and a first implementation leaves out.'
        }
      ],
      inTheWild: [
        'DEFLATE’s literal/length and distance alphabets, both canonical and both with run-length coded tables.',
        'JPEG’s entropy stage, which is canonical Huffman over run-length coded coefficient categories.',
        'MP3 and AAC, which switch between several standard Huffman tables per block.',
        'Any protocol with a fixed static code — HPACK’s Huffman table for HTTP/2 headers is a published one.'
      ],
      sources: [
        { title: 'Huffman — A method for the construction of minimum-redundancy codes (1952)', note: 'the algorithm and the optimality proof, in three pages' },
        { title: 'McMillan — Two inequalities implied by unique decipherability (1956)', note: 'why nothing is lost by restricting attention to prefix codes' },
        { title: 'Vitter — Design and analysis of dynamic Huffman codes (1987)', note: 'adaptive Huffman done properly, with the sibling property maintained in O(1)' },
        { title: 'Deutsch — RFC 1951 (DEFLATE)', note: 'canonical codes and the run-length layer over the length array' }
      ]
    },

    'arithmetic-coding-and-ans': {
      summary: 'An integer arithmetic coder measured against the exact information content of the ' +
        'message, rANS on the same model, Huffman beside them, and the interval walk for a short ' +
        'word printed symbol by symbol.',
      intuition: 'Code the whole message as one number and the overhead becomes a constant per ' +
        'message rather than a rounding error per symbol.',
      formulation: {
        equations: [
          {
            label: 'The idea, and what it costs',
            expr: 'width = Π p(xᵢ) · bits = −Σ log₂ p(xᵢ) + O(1)',
            readAs: 'The final interval is as wide as the product of the symbol probabilities, ' +
              'and the bits needed are minus the sum of their base-two logarithms plus a constant.',
            terms: [
              { sym: 'the constant', meaning: 'about two bits to terminate — per MESSAGE, not per symbol' },
              { sym: 'renormalisation', meaning: 'shift out bits both ends agree on, keeping low and high in 16 or 32 bits' },
              { sym: 'the underflow counter', meaning: 'low ≥ ¼ and high < ¾: a bit is owed and its complement is emitted later' },
              { sym: 'why it is fatal to omit', meaning: 'the count stays zero on short inputs, so the bug passes every test' }
            ]
          },
          {
            label: 'Three coders, one model, 3 000 bytes of English',
            expr: 'coder · bits · above the information content · per symbol',
            terms: [
              { sym: 'the floor', meaning: '13 687.0 bits — 4.5623 per byte' },
              { sym: 'arithmetic', meaning: '13 688 · +1.03 · 0.00034' },
              { sym: 'rANS at 2^12', meaning: '13 712 · +25.0 · 0.00834' },
              { sym: 'Huffman', meaning: '13 852 · +165.0 · 0.05501' }
            ]
          },
          {
            label: 'rANS: the state as a stack',
            expr: 'x ← ⌊x / f(s)⌋·M + (x mod f(s)) + c(s)',
            readAs: 'The new state is the old divided by the symbol frequency, times the total, ' +
              'plus the remainder, plus the symbol’s cumulative count.',
            terms: [
              { sym: 'M', meaning: 'the frequency total, which must be a power of two: 4 096 here' },
              { sym: 'decoding order', meaning: 'REVERSED — encoding pushes and decoding pops' },
              { sym: 'renormalisation', meaning: 'bytes written out of the bottom to keep x in [2^16, 2^24)' },
              { sym: 'the fixed cost', meaning: '32 bits of state flushed at the end, whatever the message length' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'No symbol ever has probability zero',
          why: 'A probability of zero needs infinitely many bits and makes the symbol uncodeable.',
          breaks: 'Counts grow, the total exceeds the coder’s precision, rescaling rounds a rare symbol to zero — and the coder throws or emits an unrecoverable stream.'
        },
        {
          name: 'Encoder and decoder update the model identically',
          why: 'An adaptive model is shared state that is never transmitted.',
          breaks: 'A floating-point difference between two machines desynchronises them, which is why real implementations keep integer counts.'
        },
        {
          name: 'The overhead is reported per message, not per symbol',
          why: 'It is a constant, and dividing it by the symbol count is what makes the comparison with Huffman meaningful.',
          breaks: 'On a 7-symbol message the demo’s 1.1-bit terminator is 9% of the output; on 3 000 bytes it is 0.008%.'
        }
      ],
      complexity: [
        { operation: 'arithmetic encode', average: 'a multiply and a divide per symbol, plus renormalisation', worst: 'output within 2 bits of the information content, per message' },
        { operation: 'arithmetic decode', average: 'the same, plus a search of the cumulative table', worst: 'a serial dependency through the interval, which is why it is slow' },
        { operation: 'rANS encode', average: 'one multiply, one divide, byte renormalisation', worst: 'must process the message in reverse, so the input has to be buffered' },
        { operation: 'rANS decode', average: 'a mask, a shift and a table lookup — no serial renormalisation chain', worst: 'reads the byte stream forwards, which is why the encoder runs backwards' },
        { operation: 'tANS', average: 'a single state-machine table lookup per symbol', worst: 'the table is 2^k entries and must be built before coding' },
        { operation: 'adaptive model', average: 'a count update per symbol, no table transmitted', worst: 'the learning curve: 4.5971 bits per symbol here against a static 4.5623' }
      ],
      failureModes: [
        {
          symptom: 'The decoder produces garbage after thousands of correct symbols.',
          cause: 'The underflow counter is missing or wrong; the interval straddled the midpoint and bits were lost.',
          fix: 'Implement the pending-bit path and instrument it. The demo reports a maximum of 10 pending bits on a 3 000-byte corpus.'
        },
        {
          symptom: 'Encoder and decoder disagree on one machine and not another.',
          cause: 'The adaptive model uses floating point, and the two sides round differently.',
          fix: 'Integer counts and integer arithmetic throughout, including the rescaling.'
        },
        {
          symptom: 'A rare symbol cannot be coded at all.',
          cause: 'Rescaling rounded its count to zero.',
          fix: 'Floor every count at one and cap the total below the coder’s precision, together.'
        },
        {
          symptom: 'An ANS decoder returns the message backwards.',
          cause: 'It is not a bug — the state is a stack, so the encoder must process the input in reverse.',
          fix: 'Buffer the message and encode from the end, which is what every production ANS implementation does.'
        }
      ],
      inTheWild: [
        'zstd’s FSE stage and Facebook’s original ANS deployment, which is where the technique became mainstream.',
        'JPEG XL and LZFSE, both of which use ANS in place of a Huffman stage.',
        'CABAC in H.264 and H.265, which is binary arithmetic coding with adaptive contexts.',
        'PPM and PAQ compressors, whose entire ratio advantage depends on a coder that can spend fractional bits.'
      ],
      sources: [
        { title: 'Witten, Neal and Cleary — Arithmetic coding for data compression (1987)', note: 'the paper that made the integer implementation practical, underflow included' },
        { title: 'Duda — Asymmetric numeral systems (2009, 2013)', note: 'rANS and tANS, and why one integer of state suffices' },
        { title: 'Giesen — ryg_rans and the rANS notes', note: 'the implementation details: renormalisation bounds, alias tables, interleaving' },
        { title: 'Moffat, Neal and Witten — Arithmetic coding revisited (1998)', note: 'the corrections and the low-precision variants formats actually ship' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));

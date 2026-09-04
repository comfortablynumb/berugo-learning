/** Concepts for dictionaries, real codecs, context models and transforms (M22.4-M22.7). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'dictionary-compression': [
      {
        term: 'LZ77 replaces a repeat with a pointer backwards',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["…the cat sat on the mat…"] --> B["the second the has<br/>appeared 12 bytes back"]',
            '    B --> C["emit: go back 12, copy 4"]',
            '    C --> D["instead of four literal bytes"]',
            '    D --> E["the dictionary is the text itself,<br/>so nothing has to be shipped with it"]'
          ].join('\n'),
          caption: 'There is no dictionary to build or transmit. The window of text already sent is the dictionary, which is why the decoder needs nothing but the stream.'
        },
        plain: 'A distance saying how far back, a length saying how much.',
        formal: 'a token is (distance, length) into the already-decoded output, or a literal byte',
        detail: [
          'Everything before the cursor is the dictionary, and none of it is transmitted, because ' +
            'the decoder already has it.',
          'That is what separates LZ77 from LZ78. There is no dictionary to build or send, only a ' +
            'window to keep.',
          'An overlapping copy is legal and useful, so a distance of one and a length of two hundred ' +
            'is a run of two hundred identical bytes. Run-length encoding falls out of the same ' +
            'mechanism without a special case.'
        ],
        example: 'The demo codes 6 000 bytes of prose into 1 051 matches and 333 literals, with ' +
          '94.5% of the input covered by matches.'
      },
      {
        term: 'Match finding is where all the CPU goes',
        plain: 'A hash of the next three bytes indexes a chain of earlier positions.',
        formal: 'chain[i] = the previous position with the same 3-byte hash; the search walks at most `depth` links',
        detail: [
          'The cut-off is the entire mechanism behind compression levels.',
          'Walking one link finds a match quickly and rarely the longest. Walking sixty-four finds ' +
            'the longest and costs sixty-four comparisons per position.',
          'Nothing else about the algorithm changes between level 1 and level 9 in gzip, zstd or ' +
            'brotli. That is worth knowing, because it says exactly what a level dial trades and ' +
            'where the returns stop.'
        ],
        example: 'The demo measures 0.22 chain links per byte at depth 1 and 2.28 at depth 64. ' +
          'That is 10.5 times the work.'
      },
      {
        term: 'The ladder flattens long before the work does',
        plain: 'Most of the ratio is bought in the first few steps of the search.',
        formal: 'ratio rises 1.506 → 1.849 while links per byte rise 0.22 → 2.28',
        detail: [
          'That shape is the argument for choosing a low level by default. The ratio curve is steep ' +
            'at the left and nearly flat at the right, so the last doublings of search effort buy a ' +
            'per cent or two.',
          'The decision is not about compression at all. It is about the ratio of writes to reads.',
          'Data written once and read for years deserves the expensive end. A log stream compressed ' +
            'on the hot path does not.'
        ],
        example: 'The demo measures a 22.8% ratio gain for 10.5× the search work across the ' +
          'whole depth ladder.'
      },
      {
        term: 'LZSS adds one flag bit, and that is what stops expansion',
        plain: 'Emit a literal when a match would not pay for itself.',
        formal: 'plain LZ77 emits a triple at every position; LZSS emits a flag plus either a byte or a pair',
        detail: [
          'Without the flag every position costs a full (distance, length, next) triple, so ' +
            'incompressible input expands enormously.',
          'With it a literal costs one bit more than the byte itself.',
          'That is the difference between a twelve per cent expansion and a three hundred per cent ' +
            'one. It is why every real format is LZSS even when the documentation says LZ77.'
        ],
        example: 'The demo measures 0.889× on random bytes, which is a 12.5% expansion. That is ' +
          'the nine-bits-per-literal cost exactly.'
      },
      {
        term: 'The window is reach and cost at the same time',
        plain: 'Every doubling adds a bit to every distance field.',
        formal: 'a distance costs ⌈log₂(window)⌉ bits, paid on every match',
        readAs: 'A distance field is the ceiling of the base-two logarithm of the window size, in ' +
          'bits, and every match pays it.',
        detail: [
          'A bigger window finds more matches AND makes each one more expensive, so the right size ' +
            'depends on how far apart the repeats in the data actually are.',
          'It is also the DECODER’s memory footprint, which is why formats fix it in the header ' +
            'rather than letting the encoder choose freely.',
          'A decoder has to be able to allocate it before reading a byte of payload.'
        ],
        example: 'The demo sweeps 64, 256, 1 024 and 4 096 bytes with distance fields of 6, 8, 10 ' +
          'and 12 bits. The ratios are 1.163, 1.426, 1.728 and 1.838.'
      },
      {
        term: 'Lazy matching is a one-symbol lookahead',
        plain: 'Check whether a longer match starts one byte later.',
        formal: 'if the match at i + 1 is longer, emit a literal at i and take the better match',
        detail: [
          'It costs roughly twice the search work, because two positions are probed instead of one, ' +
            'and it returns a few per cent.',
          'Every production encoder does it. The reason it works is that greedy match selection is ' +
            'not optimal: taking a five-byte match now can prevent a nine-byte match starting one ' +
            'byte on.',
          'Full optimal parsing solves that with a shortest-path search over the token graph, and ' +
            'costs far more than the lookahead does.'
        ],
        example: 'The demo measures 4.61% better compression from lazy matching on mixed prose.'
      },
      {
        term: 'LZW builds a dictionary instead of pointing at a window',
        plain: 'Every token is a fixed-width code into a table both sides construct identically.',
        formal: 'the dictionary starts as the alphabet and gains one entry per token; no distances are ever sent',
        detail: [
          'That made LZW cheap in 1984, when the dictionary fitted in memory and a window did not.',
          'The decoder rebuilds the same table from the same tokens. That includes the famous case ' +
            'where a code arrives one step before its entry exists, handled by the "previous plus ' +
            'previous[0]" rule rather than by an error.',
          'It is what GIF and Unix compress used, and it is why GIF compresses so poorly by modern ' +
            'standards.'
        ],
        example: 'The demo builds 1 873 dictionary entries at 12 bits per code and measures ' +
          '2.134× on mixed prose.'
      },
      {
        term: 'A bare LZSS can lose to LZW, and the entropy stage is what reverses it',
        plain: 'Fixed-width fields are expensive when most matches are short.',
        formal: 'LZSS spends 1 + 12 + 8 = 21 bits per match here; LZW spends 12 bits on everything',
        detail: [
          'This is the measurement worth sitting with rather than explaining away.',
          'On prose with many short repeats, paying a full 12-bit distance and 8-bit length for a ' +
            'four-byte match is worse than a flat 12-bit dictionary code.',
          'What fixes it is coding the tokens themselves, so the common distances and lengths get ' +
            'short codewords. That is exactly what DEFLATE adds on top of LZ77, and what the next ' +
            'section measures.'
        ],
        example: 'The demo measures LZW at 1.11× BETTER than lazy LZSS on mixed prose. DEFLATE ' +
          'beats both.'
      }
    ],

    'general-purpose-codecs': [
      {
        term: 'DEFLATE is LZ77 then Huffman, and it is everywhere',
        plain: 'Match removal, then a code over what is left.',
        formal: 'RFC 1951: a 32 KB window, a literal/length alphabet of 288 symbols and a distance alphabet of 30',
        detail: [
          'gzip, zlib, PNG, zip and HTTP Content-Encoding are all this one format.',
          'Its design is deliberately modest, and it has survived thirty years because the two ' +
            'stages are orthogonal. LZ77 removes repetition that an entropy coder cannot see, and ' +
            'Huffman removes the skew in the token stream that LZ77 leaves behind.',
          'Neither subsumes the other, which is why doing both beats doing either twice.'
        ],
        example: 'The demo measures DEFLATE at 24.79× on JSON logs against LZSS alone at 21.58×.'
      },
      {
        term: 'The stored block is the guarantee that bounds expansion',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["a block of already-compressed<br/>or random data"] --> B{"did compressing it<br/>make it bigger?"}',
            '    B -->|yes| C["emit it raw, with a short header"]',
            '    B -->|no| D["emit the compressed form"]',
            '    C --> E["so the worst case is the input<br/>plus a few bytes per block"]'
          ].join('\n'),
          caption: 'Without this escape a compressor can expand its input without limit, which matters because the caller has usually already allocated a buffer.'
        },
        plain: 'A block that does not compress is emitted raw.',
        formal: 'type 00: five bytes of header, then the bytes; so the format expands by at most that per block',
        detail: [
          'This is the design decision that makes DEFLATE safe to apply blindly.',
          'An entropy coder alone expands random input by about twelve per cent, because it still ' +
            'has to code every symbol and the model is uniform. A format with a stored option pays ' +
            'five bytes and stops.',
          'Any pipeline that compresses untrusted data needs this property, and it is worth checking ' +
            'that whatever codec you have chosen actually has it.'
        ],
        example: 'The demo measures DEFLATE at 0.998× on random bytes where the pure entropy ' +
          'coders measure 0.893× and 0.889×.'
      },
      {
        term: 'Fixed and dynamic Huffman are a header-cost decision',
        plain: 'Use the code in the specification, or fit one to this block and send it.',
        formal: 'type 01 transmits no table; type 10 transmits code lengths, run-length coded and Huffman coded again',
        detail: [
          'The dynamic path has three layers, and the third is where readers give up.',
          'The code lengths are coded with a nineteen-symbol alphabet whose own lengths are sent as ' +
            '3-bit fields. They go in a fixed permuted order, chosen so the common ones come first ' +
            'and the tail can be truncated.',
          'That looks like over-engineering until you measure a sparse length table without it, ' +
            'where the plain form costs more than the payload it describes.'
        ],
        example: 'The demo’s encoder chooses fixed blocks on five corpora and stored on the two ' +
          'incompressible ones.'
      },
      {
        term: 'zstd and brotli changed the entropy stage and the dictionary',
        plain: 'FSE instead of Huffman, and a dictionary that is not built from your data.',
        formal: 'zstd uses tANS for literals and match fields; brotli ships a 120 KB static dictionary of web text',
        detail: [
          'zstd’s ratio advantage over gzip is mostly the entropy stage, because a table-driven ANS ' +
            'gets arithmetic-coding accuracy at Huffman speed.',
          'Its advantage on SMALL payloads is the dictionary. A 200-byte JSON document has no ' +
            'history to match against until you give it one.',
          'Brotli’s static dictionary is the same idea taken further. The dictionary is the ' +
            'internet, and it is why brotli beats gzip on short HTML.'
        ],
        example: 'The demo’s rANS coder measures within 0.2% of arithmetic coding, which is the ' +
          'gain zstd’s FSE stage captures.'
      },
      {
        term: 'The ranking changes with the corpus, and that is the finding',
        plain: 'No codec wins every kind of data.',
        formal: 'the same six codecs over seven corpora produce two different winners',
        detail: [
          'A benchmark on one corpus produces a winner and no information.',
          'Structured text rewards a dictionary stage because its keys repeat exactly, and prose ' +
            'rewards the transform chain because its redundancy is contextual rather than literal.',
          'Incompressible bytes defeat everything, and the only question is which degrades most ' +
            'gracefully. Publishing the corpus alongside the ratio is the minimum for a claim to be ' +
            'checkable.'
        ],
        example: 'The demo measures DEFLATE winning English text at 15.63× and the BWT chain ' +
          'winning mixed prose at 2.84×.'
      },
      {
        term: 'Decode speed usually matters more than ratio',
        plain: 'Data is written once and read many times.',
        formal: 'the encoder’s work rises with the level; the decoder’s barely moves',
        detail: [
          'The asymmetry is the whole reason a compression level exists as a dial.',
          'Across a sweep from depth 1 to depth 64 the encoder does ten times the work, and the ' +
            'decoder reads a token stream of almost identical length. So a higher level costs the ' +
            'writer and is free for every subsequent reader.',
          'That also means the right level depends on the read-to-write ratio, rather than on how ' +
            'much you like compression.'
        ],
        example: 'The demo measures 1 694 tokens to decode at depth 1 and 1 435 at depth 64, ' +
          'while encoder work rises 11-fold.'
      },
      {
        term: 'Every measurement is round-trip checked, including the degenerate ones',
        plain: 'A size from a codec that cannot decompress is not a measurement.',
        formal: 'empty input, one byte, a thousand identical bytes, and already-compressed data',
        detail: [
          'The degenerate cases are where implementations break, and they break silently. An encoder ' +
            'that mishandles an empty input usually produces empty output that decodes to nothing, ' +
            'which looks fine.',
          'A single byte costs more to describe than to store in every scheme, which is the honest ' +
            'floor on any format’s overhead.',
          'Running all four through every codec is cheap, and it is what makes the ratio table ' +
            'believable.'
        ],
        example: 'The demo verifies 66 of 66 round-trips across seven corpora and four edge cases.'
      },
      {
        term: 'A ratio below one is a result, not an omission',
        plain: 'Report the expansion rather than dropping the row.',
        formal: 'on incompressible input the honest answer is a ratio under 1, and the interesting question is how far under',
        detail: [
          'Hiding the row hides the theorem, which is that every compressor shrinking some inputs ' +
            'must expand others. It also hides the practical difference between codecs.',
          'The demo’s worst row is a pure LZ coder at 0.889 on random bytes, with DEFLATE at 0.998 ' +
            'on the same input.',
          'That difference is entirely the stored block, and it is the property that matters when ' +
            'the data is untrusted.'
        ],
        example: 'The demo reports its worst ratio explicitly. It is 0.889× for LZSS on random ' +
          'bytes.'
      }
    ],

    'context-modelling': [
      {
        term: 'A compressor is a model and a coder, and only one of them is still hard',
        plain: 'The coder spends −log₂(p) bits; the model decides p.',
        formal: 'bits = cross-entropy of the message under the model; the coder adds O(1) per message',
        detail: [
          'Arithmetic coding solved the coder in 1980. Every improvement in compression since then ' +
            'is an improvement in prediction.',
          'That makes "compression is prediction" a statement about arithmetic rather than a slogan. ' +
            'It also makes the compression literature and the language-modelling literature two ' +
            'vocabularies for one measurement.',
          'A model that predicts text well IS a compressor of text.'
        ],
        example: 'The demo’s mixed model reaches 2.996 bits per symbol where an order-0 model ' +
          'spends 4.618, with no change to the coder at all.'
      },
      {
        term: 'More context is not automatically better',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["order 1: few contexts,<br/>each well estimated"] --> B["order 3: better predictions"]',
            '    B --> C["order 6: most contexts<br/>seen once or twice"]',
            '    C --> D["the probabilities are noise"]',
            '    D --> E["and the model costs more<br/>than it saves"]'
          ].join('\n'),
          caption: 'A longer context is a better predictor only while there is enough data to estimate it. Past that point the model is memorising the input rather than learning it.'
        },
        plain: 'The plain order-k model bottoms out and then gets worse.',
        formal: 'each context reserves probability for every unseen symbol, so a sparse model spends most of its mass on nothing',
        detail: [
          'With add-one smoothing over an alphabet of thirty, a context that has seen two symbols ' +
            'still assigns twenty-eight of them a probability each.',
          'That reserved mass is the cost, and it grows with the order faster than the extra context ' +
            'is worth.',
          'The turnaround is a measurement rather than a rule of thumb, because it moves with the ' +
            'alphabet size and the amount of data. That is why the demo reports the observations ' +
            'per context beside every row.'
        ],
        example: 'The demo measures 3.0088 bits at order 2 and 3.1418 at order 4, with 13.4 and ' +
          '8.3 observations per context.'
      },
      {
        term: 'PPM escapes to a shorter context instead of paying for the alphabet',
        plain: 'When the longest context has never seen this symbol, spend an escape and drop an order.',
        formal: 'method A: the escape has probability 1/(total + 1), the estimate that one more novel symbol is coming',
        detail: [
          'That single mechanism turns the curve around.',
          'The escape costs real bits, because it is a symbol like any other, so the best maximum ' +
            'order is still a measurement. But with escapes the model keeps improving far longer, ' +
            'because a sparse context contributes nothing rather than costing everything.',
          'It is the difference between a model that must have an opinion about every symbol and one ' +
            'that can say "ask someone shorter".'
        ],
        example: 'The demo measures PPM at 1.1009 bits per symbol at order 4, against the plain ' +
          'model’s 3.1418. That is 0.350×, at 0.1027 escapes per symbol.'
      },
      {
        term: 'Exclusion is the detail that makes PPM work',
        plain: 'A symbol ruled out by a longer context cannot be predicted by a shorter one.',
        formal: 'after escaping from a context, remove every symbol it had seen from the shorter contexts’ distributions',
        detail: [
          'The escape already told the decoder that the symbol is none of the ones the long context ' +
            'knew about. Leaving probability mass on them in the fallback wastes exactly the ' +
            'information the escape just conveyed.',
          'Redistributing it is free, because both sides can compute the exclusion set.',
          'Without it PPM measurably loses to a plain model at the same order. That is the kind of ' +
            'detail that separates a working implementation from a described one.'
        ],
        example: 'The demo implements exclusions and measures PPM at 0.350× the plain model at ' +
          'order 4. Without them the advantage largely disappears.'
      },
      {
        term: 'Mixing does not choose, and the weights say who is carrying the prediction',
        plain: 'Several models predict, a mixer blends, and the blend adapts.',
        formal: 'each weight is scaled by 1 + rate·(model probability / mixture probability − 1), then normalised',
        detail: [
          'The weights move towards whichever model gave the symbol that actually arrived a high ' +
            'probability, so the mixture tracks a file whose character changes partway through.',
          'That is the practical advantage over choosing an order. There is no hyperparameter to ' +
            'fit, and the answer is allowed to be different at the start of the file and at the end.',
          'PAQ does this in the logistic domain over binary decisions, and runs dozens of models at ' +
            'once.'
        ],
        example: 'The demo’s weights start equal at 0.2500 and end with order 2 carrying 76.6% of ' +
          'the prediction.'
      },
      {
        term: 'The model costs nothing in the stream and everything in the CPU',
        plain: 'Encoder and decoder update identically, so nothing is transmitted.',
        formal: 'both sides observe the same symbol and apply the same update, so the model is shared state that never travels',
        detail: [
          'That is what makes a hundred-model mixture practical at all. None of it appears in the ' +
            'output.',
          'The price is symmetric work. The decoder runs the same models as the encoder, so decoding ' +
            'is as slow as encoding, which is the opposite of every other codec in this milestone.',
          'It is why PAQ compresses at kilobytes per second in both directions, and why nothing ' +
            'ships it.'
        ],
        example: 'The demo runs four models over 1 500 symbols and transmits no table of any kind.'
      },
      {
        term: 'The equivalence with language modelling is exact',
        plain: 'A model’s training loss and a compressor’s output size are the same number.',
        formal: 'cross-entropy in bits per symbol × symbol count = the compressed size in bits',
        detail: [
          'A language model reporting 1.8 bits per character IS a compressor achieving 1.8 bits per ' +
            'character. An arithmetic coder driven by it would produce a file of exactly that size.',
          'The Hutter Prize turns that into a competition on a gigabyte of Wikipedia.',
          'It also means the whole apparatus of this section — context, sparsity, smoothing, mixing ' +
            '— is the same apparatus, with different names, that a tokeniser and an attention ' +
            'mechanism address.'
        ],
        example: 'The demo’s bits-per-symbol column is a cross-entropy, computed exactly as a ' +
          'training loss would be.'
      },
      {
        term: 'Tokenisation is the same decision as choosing a model order',
        plain: 'Both trade context length against evidence per context.',
        formal: 'a longer token is a longer context, and it is seen fewer times',
        detail: [
          'A byte-level model has few contexts with plenty of evidence and little reach. A ' +
            'word-level one has enormous reach and a sparsity problem.',
          'Subword tokenisation is a fitted compromise between exactly those two.',
          'The sparsity curve this section measures is the same curve. The answers the field has ' +
            'found — back-off, smoothing, mixing, sharing strength between similar contexts — are ' +
            'the same answers in different vocabulary.'
        ],
        example: 'The demo’s order sweep is that curve: 4.618 bits at order 0, 3.009 at order 2, ' +
          '3.142 at order 4.'
      }
    ],

    'transform-compression': [
      {
        term: 'The Burrows–Wheeler transform compresses nothing',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["input: n bytes"] --> B["the transform"]',
            '    B --> C["output: the same n bytes,<br/>in a different order"]',
            '    C --> D["identical order-0 entropy"]',
            '    D --> E["what changed is that similar<br/>characters are now adjacent"]',
            '    E --> F["which is what the NEXT stage exploits"]'
          ].join('\n'),
          caption: 'It is a permutation, and measuring it on its own shows exactly zero gain. Its whole value is making the following move-to-front and entropy stages effective.'
        },
        plain: 'It is a permutation: same length, same bytes, same order-0 entropy.',
        formal: 'the output is a rearrangement of the input, so its symbol counts — and therefore its entropy — are identical',
        detail: [
          'This is the measurement the whole section is arranged around, and it is exact rather than ' +
            'approximate. The first two rows of the stage table agree to every decimal place, ' +
            'because a permutation cannot change a multiset.',
          'Running it before a compressor roughly halves the output anyway.',
          'So the gain is not redundancy removal at all. It is making the data fit a model that was ' +
            'already there.'
        ],
        example: 'The demo measures 4.5612 bits per byte before the transform and 4.5612 after ' +
          'it, over the same 2 000 symbols.'
      },
      {
        term: 'What it does is group by following context',
        plain: 'Sorting every rotation puts characters with similar successors together.',
        formal: 'row i of the sorted rotation matrix ends with the character preceding the i-th suffix',
        detail: [
          'The last column collects, for each context, all the characters that precede it. So ' +
            'everything before "he" in English text lands in one run, and that run is mostly "t".',
          'The input was not locally repetitive and the output is.',
          'That is the whole trick, and it needs no knowledge of the language. The sort discovers ' +
            'the contexts rather than being told them.'
        ],
        example: 'The demo’s first 32 transformed bytes read "ffffffffffyyyyyyyyyyeeeeeeeeeekk" ' +
          'from an input that reads "the_quick_brown_fox_jumps_over_t".'
      },
      {
        term: 'Move-to-front turns local repetition into small numbers',
        plain: 'Replace each symbol by its position in a list that puts the last-seen symbol first.',
        formal: 'a run of one character becomes a run of zeros; a recently-seen character becomes a small index',
        detail: [
          'This is where the entropy actually falls.',
          'It is worth noticing that MTF alone would do nothing useful to the original text. It ' +
            'needs the transform to have produced the runs first.',
          'The pair is the technique. Rearrange so that a local property holds, then use a code that ' +
            'exploits local properties. Neither half works without the other.'
        ],
        example: 'The demo measures the entropy dropping from 4.5612 to 0.7405 bits per byte at ' +
          'this stage. That is a factor of 6.16.'
      },
      {
        term: 'The transform is invertible from one extra integer',
        plain: 'Which row of the sorted matrix was the original string.',
        formal: 'LF mapping: the i-th occurrence of a character in the last column is the i-th in the first',
        detail: [
          'That correspondence is why a permutation this aggressive is still safe.',
          'The first column is the last column sorted, so it costs nothing to know. The LF mapping ' +
            'walks backwards through the original one character at a time, and the row index is the ' +
            'only extra information the decoder needs.',
          'Both directions are linear with a counting pass, which is why the inverse is fast even ' +
            'though the forward transform sorts.'
        ],
        example: 'The demo round-trips the whole chain on every corpus — transform, MTF, RLE and ' +
          'back — and reports it as a verified column.'
      },
      {
        term: 'The entropy coder at the end is deliberately weak',
        plain: 'Order-0 Huffman is enough once the transform has done its work.',
        formal: 'the pipeline makes a simple model accurate rather than building a complicated one',
        detail: [
          'That is the architectural claim worth taking away.',
          'A context-mixing compressor gets a better ratio and costs orders of magnitude more time. ' +
            'The BWT chain gets most of the way there with a sort and an order-0 code.',
          'Where the modelling happens is a design choice, and putting it in a reversible ' +
            'preprocessing step keeps the coder simple, fast and easy to verify.'
        ],
        example: 'The demo’s BWT chain measures 2.841× on mixed prose against DEFLATE’s 2.027× ' +
          'and plain Huffman’s 1.974×.'
      },
      {
        term: 'Bits per symbol can rise while the total falls',
        plain: 'Run-length coding produces fewer symbols, each carrying more.',
        formal: 'after RLE the symbol count drops from 2 000 to 294 and the entropy rises from 0.74 to 4.09',
        detail: [
          'A reader watching only the bits-per-symbol column would conclude the RLE stage made ' +
            'things worse.',
          'It did not. The floor in BYTES fell from 186 to 151, because there are far fewer symbols.',
          'This is the standard way a per-symbol metric misleads when the symbol count changes. The ' +
            'defence is to report the total beside it, which is why the stage table has both ' +
            'columns.'
        ],
        example: 'The demo measures 0.7405 bits over 2 000 symbols after MTF, and 4.0861 over 294 ' +
          'after RLE. That is 186 bytes against 151.'
      },
      {
        term: 'Block size is the transform’s one real parameter, and it is a memory decision',
        plain: 'A bigger block sees more context and costs more to sort.',
        formal: 'O(n log n) comparisons over rotations plus the memory to hold the block and its order',
        detail: [
          'The ratio gain is steep at small sizes and then flattens.',
          'bzip2 caps the block at 900 KB, and the demo shows why. Most of the benefit arrives by a ' +
            'few kilobytes on ordinary text.',
          'It also means the block boundary is a compression boundary, so a repeated string that ' +
            'straddles two blocks is not found. That is the same window trade-off LZ77 makes under ' +
            'a different name.'
        ],
        example: 'The demo measures ratios of 1.739, 2.079, 6.024 and 10.753 at block sizes of ' +
          '64, 256, 1 024 and 4 096 bytes.'
      },
      {
        term: 'Preprocessing to make a weak model strong is a general technique',
        plain: 'Rearrange reversibly so that a simple coder becomes accurate.',
        formal: 'the transform changes no bytes and the stage after it gets much better — that pair is the diagnostic',
        detail: [
          'Delta coding before an integer codec, a colour transform before a DCT, sorting a column ' +
            'before run-length coding, tokenising before a language model. All the same move.',
          'The question to ask when a model is weak is not always "how do I make the model stronger".',
          'It is often "is there a reversible rearrangement that makes the data fit the model I ' +
            'already have", and the second is far cheaper.'
        ],
        example: 'The demo shows the transform leaving the entropy at 4.5612 and the next stage ' +
          'taking it to 0.7405.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));

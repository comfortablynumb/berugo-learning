/** Reference entries for dictionaries, codecs, context models and transforms (M22.4-M22.7). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'dictionary-compression': {
      summary: 'LZSS over 6 000 bytes of prose with the search depth swept from 1 to 64 and the ' +
        'chain links counted, the window swept from 64 to 4 096 bytes with the distance-field ' +
        'cost visible, and LZW beside both — every run round-trip verified.',
      intuition: '"Level 9" is the same algorithm walking more of the hash chain, and the entire ' +
        'cost falls on the writer.',
      formulation: {
        equations: [
          {
            label: 'The token, and what each field costs',
            expr: 'literal = 1 + 8 bits · match = 1 + ⌈log₂ window⌉ + ⌈log₂ lookahead⌉ bits',
            readAs: 'A literal costs a flag bit plus a byte; a match costs a flag bit plus a ' +
              'distance field as wide as the base-two logarithm of the window plus a length field ' +
              'as wide as the logarithm of the lookahead.',
            terms: [
              { sym: 'the flag bit', meaning: 'LZSS’s addition, and what stops incompressible data expanding threefold' },
              { sym: 'the distance field', meaning: '12 bits at a 4 096-byte window — paid on every match, however short' },
              { sym: 'overlapping copies', meaning: 'distance 1, length 200 is a run: run-length coding for free' },
              { sym: 'the dictionary', meaning: 'everything already decoded, so nothing is transmitted' }
            ]
          },
          {
            label: 'Search depth: the compression-level ladder on 6 000 bytes of prose',
            expr: 'depth · bytes · ratio · matches · links per byte',
            terms: [
              { sym: 'depth 1', meaning: '3 985 · 1.506 · 1 305 matches · 0.22 links' },
              { sym: 'depth 4', meaning: '3 615 · 1.660 · 1 176 · 0.67' },
              { sym: 'depth 16', meaning: '3 327 · 1.803 · 1 073 · 1.46' },
              { sym: 'depth 64', meaning: '3 245 · 1.849 · 1 044 · 2.28 — 10.5× the work for 22.8% better' }
            ]
          },
          {
            label: 'Window size: reach against the cost of every distance',
            expr: 'window · distance field · bytes · ratio · matches',
            terms: [
              { sym: '64 bytes', meaning: '6 bits · 5 160 · 1.163 · 624 matches' },
              { sym: '256 bytes', meaning: '8 bits · 4 209 · 1.426 · 977' },
              { sym: '1 024 bytes', meaning: '10 bits · 3 472 · 1.728 · 1 102' },
              { sym: '4 096 bytes', meaning: '12 bits · 3 265 · 1.838 · 1 051 — fewer matches, and still better' }
            ]
          },
          {
            label: 'The two families, on identical input',
            expr: 'scheme · bytes · ratio',
            terms: [
              { sym: 'LZSS, depth 32', meaning: '3 265 · 1.838' },
              { sym: 'with lazy matching', meaning: '3 121 · 1.922 — 4.61% for twice the search' },
              { sym: 'LZW', meaning: '2 811 · 2.134 · 1 873 entries at 12 bits — BETTER than both' },
              { sym: 'why', meaning: 'LZSS spends 21 bits per match and LZW spends 12 on everything' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Cost is reported in bits, not tokens',
          why: 'A token count flatters an LZ demo enormously — a match token is not one byte.',
          breaks: 'Counting tokens makes LZSS look 4× better than it is and hides the fixed-field cost that LZW exploits.'
        },
        {
          name: 'Every ratio comes with a verified round-trip',
          why: 'An encoder that drops a literal produces a smaller file and a corrupt one.',
          breaks: 'The overlapping-copy case is the usual bug, and it only shows on runs, which is exactly where the ratio looks best.'
        },
        {
          name: 'The decoder’s work is reported separately from the encoder’s',
          why: 'They move independently, and the level dial only affects one of them.',
          breaks: 'Reporting "compression cost" as one number hides that a higher level is free for every reader.'
        }
      ],
      complexity: [
        { operation: 'hash-chain insert', average: 'O(1) per position', worst: 'the same — a head array and a previous-position array' },
        { operation: 'match search', average: 'O(depth) comparisons per position, bounded by the cut-off', worst: 'O(depth × lookahead) byte comparisons' },
        { operation: 'lazy matching', average: 'two searches per position instead of one', worst: 'measured 4.61% better ratio for that' },
        { operation: 'decompression', average: 'O(output) with a memcpy per match', worst: 'unaffected by the encoder’s level — 1 694 tokens at depth 1, 1 435 at depth 64' },
        { operation: 'LZW encode', average: 'O(n) with a hash map of the dictionary', worst: 'dictionary growth is unbounded unless it is reset' },
        { operation: 'optimal parsing', average: 'a shortest-path search over the token graph', worst: 'far more expensive than lazy matching for a few per cent more' }
      ],
      failureModes: [
        {
          symptom: 'Compression is slow and the ratio barely improves at high levels.',
          cause: 'The chain cut-off is the level, and its returns flatten long before its cost does.',
          fix: 'Measure the ladder on your data. The demo buys most of its gain by depth 4 and pays 10× for the rest.'
        },
        {
          symptom: 'A bigger window made the output larger.',
          cause: 'Every match pays the wider distance field, and the extra reach found nothing.',
          fix: 'Sweep the window. It is also the decoder’s memory, so the smaller one is often better twice over.'
        },
        {
          symptom: 'The decompressor produces garbage on long runs.',
          cause: 'The overlapping copy — reading bytes the same copy is writing — was implemented as a block move.',
          fix: 'Copy byte by byte, or handle the overlap explicitly. It is the single most common LZ bug.'
        },
        {
          symptom: 'Compressing already-compressed data expands it noticeably.',
          cause: 'Every position becomes a literal at nine bits.',
          fix: 'Use a format with a stored block, or check the entropy of the input first. The demo measures 0.889× on random bytes.'
        }
      ],
      inTheWild: [
        'gzip, zlib and zip, all of which are LZ77 with hash-chain match finding and a Huffman stage.',
        'zstd, whose levels are the same cut-off idea plus an optional binary-tree match finder at the top end.',
        'LZ4 and Snappy, which fix the search depth at one or two and trade ratio for gigabytes per second.',
        'GIF and Unix compress, which are LZW — and the reason GIF files are large by modern standards.'
      ],
      sources: [
        { title: 'Ziv and Lempel — A universal algorithm for sequential data compression (1977)', note: 'LZ77: the sliding window and the (distance, length) token' },
        { title: 'Ziv and Lempel — Compression of individual sequences via variable-rate coding (1978)', note: 'LZ78: the explicit dictionary that LZW refines' },
        { title: 'Storer and Szymanski — Data compression via textual substitution (1982)', note: 'LZSS: the flag bit that stops expansion' },
        { title: 'Welch — A technique for high-performance data compression (1984)', note: 'LZW, and the decoder case where a code precedes its dictionary entry' }
      ]
    },

    'general-purpose-codecs': {
      summary: 'Six codecs over seven corpora with the entropy beside each row and 66 of 66 ' +
        'round-trips verified, DEFLATE’s block-type decision measured per corpus, and the four ' +
        'degenerate inputs run through everything.',
      intuition: 'No codec wins every kind of data, and the gap between corpora is larger than ' +
        'the gap between codecs.',
      formulation: {
        equations: [
          {
            label: 'DEFLATE’s three block types, and why the first one matters most',
            expr: 'stored (00) · fixed Huffman (01) · dynamic Huffman (10)',
            terms: [
              { sym: 'stored', meaning: '5 bytes of header then raw bytes — the reason the format cannot meaningfully expand' },
              { sym: 'fixed', meaning: 'the code is in the specification, so nothing is transmitted' },
              { sym: 'dynamic', meaning: 'a code fitted to this block, sent as lengths, run-length coded, then Huffman coded again' },
              { sym: 'the third layer', meaning: '19 symbols in a fixed permuted order so the tail can be truncated' }
            ]
          },
          {
            label: 'The bake-off: ratios at 3 000 bytes per corpus',
            expr: 'corpus · entropy · Huffman · LZSS · DEFLATE · BWT chain',
            terms: [
              { sym: 'English text', meaning: '4.56 · 1.710 · 13.453 · 15.625 · 14.851 — DEFLATE' },
              { sym: 'JSON logs', meaning: '4.48 · 1.731 · 21.583 · 24.793 · 20.548 — DEFLATE, the best row in the table' },
              { sym: 'mixed prose', meaning: '3.95 · 1.974 · 1.740 · 2.027 · 2.841 — the BWT chain, and LZSS is now LAST' },
              { sym: 'random bytes', meaning: '7.94 · 0.978 · 0.889 · 0.998 · 0.974 — everything expands' }
            ]
          },
          {
            label: 'The degenerate inputs, in bits',
            expr: 'input · Huffman · arithmetic · LZSS · DEFLATE · BWT chain',
            terms: [
              { sym: 'empty', meaning: '0 · 0 · 0 · 0 · 0, and every one decodes back to nothing' },
              { sym: 'one byte', meaning: '27 · 14 · 9 · 24 · 27 — more than the byte itself, in every scheme' },
              { sym: '1 000 identical bytes', meaning: '1 026 · 14 · 97 · 80 · 32 — a source with zero entropy' },
              { sym: '99/1 split', meaning: '1 033 · 106 · 172 · 144 · 51 — a factor of 9.7 between the first two' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Every ratio names its corpus',
          why: 'The ratio is a property of the data, and the same codec spans 24.79× to 0.998× across this table.',
          breaks: 'A single-corpus benchmark produces a winner and no information about anything else.'
        },
        {
          name: 'Expansion is reported rather than dropped',
          why: 'Hiding the incompressible row hides both the theorem and the practical difference between formats.',
          breaks: 'DEFLATE at 0.998 and a bare entropy coder at 0.889 look the same in a table that omits the row.'
        },
        {
          name: 'Every size comes from something that decompressed',
          why: 'A compression figure from an implementation that cannot decode is not a measurement.',
          breaks: 'The demo checks 66 of 66 and would mark a row failed rather than print the size.'
        }
      ],
      complexity: [
        { operation: 'DEFLATE encode', average: 'LZ77 match finding plus two Huffman passes', worst: 'dominated by the match search — the level dial' },
        { operation: 'DEFLATE decode', average: 'one canonical decode per token plus a memcpy per match', worst: 'nearly independent of the level the encoder used' },
        { operation: 'stored block', average: '5 bytes of overhead per block', worst: 'the format’s expansion bound, and its most useful guarantee' },
        { operation: 'dynamic block header', average: 'the length array, run-length coded and Huffman coded', worst: 'costs more than it saves on short blocks, which is why fixed blocks exist' },
        { operation: 'zstd’s FSE stage', average: 'a table lookup per symbol, arithmetic-coding accuracy', worst: 'requires a table build per block' },
        { operation: 'brotli’s static dictionary', average: '120 KB shipped with the decoder', worst: 'irrelevant on data unlike the web text it was built from' }
      ],
      failureModes: [
        {
          symptom: 'A codec chosen from a benchmark performs badly in production.',
          cause: 'The benchmark corpus was not your data, and the ranking changes with the data.',
          fix: 'Run the comparison on a sample of your own traffic. It takes an afternoon and the demo shows the ranking flipping between two corpora.'
        },
        {
          symptom: 'Compressed responses are slower end to end than uncompressed ones.',
          cause: 'The decode cost exceeded the transfer saving, usually on a fast network or a small payload.',
          fix: 'Measure decode throughput, and set a minimum size below which compression is skipped.'
        },
        {
          symptom: 'Compressing small JSON payloads barely helps.',
          cause: 'There is no history to match against in the first few hundred bytes.',
          fix: 'Use a trained dictionary — zstd supports one explicitly, and brotli ships a static one for web text.'
        },
        {
          symptom: 'A pipeline that compresses untrusted uploads runs out of disk.',
          cause: 'The codec has no stored block and expands incompressible input by ten per cent or more.',
          fix: 'Choose a format with a stored fallback, or compare sizes and keep the smaller.'
        }
      ],
      inTheWild: [
        'HTTP Content-Encoding: gzip, br and zstd, negotiated per request.',
        'PNG, which is DEFLATE over filtered scanlines — the filter is a transform of exactly the kind section 22.7 describes.',
        'Every package format: zip, jar, apk, docx and the rest are DEFLATE in a container.',
        'Kafka, Parquet and ORC, all of which let you choose the codec per topic or per column group.'
      ],
      sources: [
        { title: 'Deutsch — RFC 1951 (DEFLATE)', note: 'the block structure, the two alphabets and the code-length coding' },
        { title: 'Collet and Kucherawy — RFC 8478 (zstd)', note: 'FSE, the frame format and dictionary support' },
        { title: 'Alakuijala and Szabadka — RFC 7932 (brotli)', note: 'the static dictionary and the context modelling on top of LZ77' },
        { title: 'Mahoney — the Large Text Compression Benchmark', note: 'what a compression comparison looks like when it is done properly' }
      ]
    },

    'context-modelling': {
      summary: 'Order-k models, PPM with escapes and an adaptive mixture over the same 1 500 ' +
        'bytes, with the context count and observations per context beside every row and the ' +
        'mixer’s weights traced through the file.',
      intuition: 'Every compressor is a prediction machine, and the model — not the coder — is ' +
        'where the ratio comes from.',
      formulation: {
        equations: [
          {
            label: 'The separation, and what each half costs',
            expr: 'bits = −Σ log₂ model(xᵢ | context) · the coder adds O(1) per message',
            readAs: 'The output size is minus the sum of the base-two logarithms of the ' +
              'probabilities the model gave the symbols that actually arrived, plus a constant.',
            terms: [
              { sym: 'the coder', meaning: 'solved since arithmetic coding — it hits whatever distribution it is handed' },
              { sym: 'the model', meaning: 'where every improvement since 1980 has come from' },
              { sym: 'nothing transmitted', meaning: 'encoder and decoder update identically, so the model never travels' },
              { sym: 'the price', meaning: 'symmetric work: decoding runs the same models, so it is as slow as encoding' }
            ]
          },
          {
            label: 'Plain order-k models, 1 500 bytes over 30 symbols',
            expr: 'order · bits per symbol · contexts · observations each',
            terms: [
              { sym: 'order 0', meaning: '4.6176 · 1 context · 1 500.0 each' },
              { sym: 'order 1', meaning: '3.1377 · 31 · 48.4' },
              { sym: 'order 2', meaning: '3.0088 · 112 · 13.4 — the best' },
              { sym: 'orders 3 and 4', meaning: '3.0775 and 3.1418 · 161 and 180 contexts · 9.3 and 8.3 — WORSE' }
            ]
          },
          {
            label: 'PPM at the same orders: an escape instead of reserved mass',
            expr: 'maximum order · bits per symbol · escapes per symbol · against the plain model',
            terms: [
              { sym: 'order 1', meaning: '2.4656 · 0.0727 · 0.786×' },
              { sym: 'order 2', meaning: '1.4576 · 0.0987 · 0.484×' },
              { sym: 'order 3', meaning: '1.1604 · 0.1013 · 0.377×' },
              { sym: 'order 4', meaning: '1.1009 · 0.1027 · 0.350× — still improving where the plain model reversed' }
            ]
          },
          {
            label: 'Mixing four orders: the weights through the file',
            expr: 'symbols coded · bits so far · weights on orders 0, 1, 2, 3',
            terms: [
              { sym: 'at symbol 1', meaning: '4.9069 · 0.2500 each — no information yet' },
              { sym: 'at 373', meaning: '4.1272 · 0.0076, 0.7528, 0.1749, 0.0647 — order 1 carrying it' },
              { sym: 'at 931', meaning: '3.4090 · 0.0001, 0.2771, 0.6017, 0.1211 — the handover' },
              { sym: 'final', meaning: '2.996 bits, weights 0.0001, 0.0113, 0.7673, 0.2213 — beating the best single order' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Every order-k row carries its observations per context',
          why: 'It is the whole explanation for the turnaround, and without it the rising bits look inexplicable.',
          breaks: 'A model at 8.3 observations per context is making most predictions from one or two sightings.'
        },
        {
          name: 'PPM implements exclusion',
          why: 'An escape already told the decoder the symbol is none of the ones the long context knew.',
          breaks: 'Leaving that mass in the fallback wastes exactly the information the escape conveyed, and PPM loses to a plain model.'
        },
        {
          name: 'The mixer’s weights are reported, not just its total',
          why: 'The trace is what shows the mixture adapting rather than settling on an average.',
          breaks: 'A weight vector that never moves means the mixer is not learning and the total is a static blend.'
        }
      ],
      complexity: [
        { operation: 'order-k model update', average: 'one hash lookup and one increment per symbol', worst: 'memory grows with distinct contexts — the sparsity problem in space as well as accuracy' },
        { operation: 'order-k prediction', average: 'O(|Σ|) to build a distribution, O(1) for one symbol', worst: 'the reserved mass for unseen symbols is the cost that turns the curve around' },
        { operation: 'PPM coding one symbol', average: 'walks down from the longest context until one has seen the symbol', worst: 'maxOrder escapes plus a fallback over the whole alphabet' },
        { operation: 'exclusion', average: 'a set of ruled-out symbols carried down the orders', worst: 'the set can reach the alphabet size, and it is rebuilt per symbol' },
        { operation: 'mixing n models', average: 'n distributions plus a weight update per symbol', worst: 'n times the work of a single model, in BOTH directions' },
        { operation: 'the whole family', average: 'PAQ measured at kilobytes per second in production implementations', worst: 'which is why it wins every benchmark and ships nowhere' }
      ],
      failureModes: [
        {
          symptom: 'Raising the model order made compression worse.',
          cause: 'Sparsity: each context reserves probability for symbols it has never seen.',
          fix: 'Use escapes or mixing. The demo measures the plain model turning around at order 2 and PPM improving to order 4 and beyond.'
        },
        {
          symptom: 'A context model uses more memory than the file it is compressing.',
          cause: 'Distinct contexts grow with the order and nothing evicts them.',
          fix: 'Hash contexts into a fixed table and accept collisions, which is what real implementations do.'
        },
        {
          symptom: 'Decompression is as slow as compression, unlike every other codec.',
          cause: 'It is inherent: the decoder runs the same models to stay in step.',
          fix: 'Nothing — that is the trade. If decode speed matters, this family is the wrong one.'
        },
        {
          symptom: 'Encoder and decoder diverge partway through a file.',
          cause: 'The model updated differently on the two sides — usually floating point, or an update applied before coding on one side and after on the other.',
          fix: 'Integer arithmetic, and one shared update function called at exactly one point in both loops.'
        }
      ],
      inTheWild: [
        'PPMd, which is in 7-Zip and RAR and is still competitive on text.',
        'The PAQ family and cmix, which hold the Large Text Compression Benchmark and the Hutter Prize.',
        'CABAC in H.264/H.265, which is context modelling over binary decisions with an arithmetic coder.',
        'Language-model training loss, which is the same cross-entropy in the same units.'
      ],
      sources: [
        { title: 'Cleary and Witten — Data compression using adaptive coding and partial string matching (1984)', note: 'PPM, escapes and the exclusion rule' },
        { title: 'Moffat — Implementing the PPM data compression scheme (1990)', note: 'PPMC and the practical details the original leaves out' },
        { title: 'Mahoney — Data Compression Explained', note: 'context mixing, logistic mixing and the PAQ architecture, written by its author' },
        { title: 'Deletang et al. — Language modeling is compression (2023)', note: 'the equivalence run as an experiment, with a transformer as the model' }
      ]
    },

    'transform-compression': {
      summary: 'The bzip2 chain stage by stage on 2 000 bytes with the entropy after each, the ' +
        'first 32 symbols of three stages side by side, and the block size swept from 64 to 4 096 ' +
        'bytes with the zero share reported.',
      intuition: 'The transform compresses nothing — it rearranges the data so that a weak model ' +
        'becomes accurate.',
      formulation: {
        equations: [
          {
            label: 'The chain, and where the entropy moves',
            expr: 'BWT → move-to-front → run-length → order-0 entropy coder',
            terms: [
              { sym: 'BWT', meaning: 'a permutation: same length, same counts, same entropy — exactly' },
              { sym: 'move-to-front', meaning: 'position in a list that promotes the last-seen symbol; a run becomes zeros' },
              { sym: 'run-length', meaning: 'collapses the zeros, so the symbol count falls' },
              { sym: 'the coder', meaning: 'deliberately weak: order-0 Huffman is enough once the rest has run' }
            ]
          },
          {
            label: 'The stages, on 2 000 bytes of English text',
            expr: 'stage · symbols · bits per symbol · entropy floor',
            terms: [
              { sym: 'input', meaning: '2 000 · 4.5612 · 1 141 bytes' },
              { sym: 'after BWT', meaning: '2 000 · 4.5612 · 1 141 bytes — IDENTICAL' },
              { sym: 'after MTF', meaning: '2 000 · 0.7405 · 186 bytes — a factor of 6.16' },
              { sym: 'after RLE', meaning: '294 · 4.0861 · 151 bytes — per-symbol UP, total down' }
            ]
          },
          {
            label: 'Block size: the one real parameter',
            expr: 'block · blocks · bits after MTF · zeros · ratio',
            terms: [
              { sym: '64 bytes', meaning: '32 blocks · 4.5975 · 10.1% · 1.739' },
              { sym: '256 bytes', meaning: '8 · 3.8457 · 40.8% · 2.079' },
              { sym: '1 024 bytes', meaning: '2 · 1.3263 · 85.2% · 6.024' },
              { sym: '4 096 bytes', meaning: '1 · 0.7405 · 92.6% · 10.753 — and the gain per doubling is shrinking' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The transform’s output has exactly the input’s order-0 entropy',
          why: 'It is a permutation, so the symbol counts are identical by definition.',
          breaks: 'A measured difference between those two rows means the implementation is not producing a permutation — usually a sentinel handled wrongly.'
        },
        {
          name: 'The total is reported beside the per-symbol figure',
          why: 'The run-length stage changes the symbol count, so bits-per-symbol rises while the file shrinks.',
          breaks: 'Reading the per-symbol column alone makes the RLE stage look like a regression.'
        },
        {
          name: 'The whole chain round-trips, not just each stage',
          why: 'MTF and RLE each invert cleanly; the transform needs the row index, and losing it loses everything.',
          breaks: 'A chain that inverts stage by stage in tests and not end to end usually has an off-by-one in the row index.'
        }
      ],
      complexity: [
        { operation: 'BWT forward', average: 'O(n log n) with a suffix array; O(n² log n) sorting rotations directly', worst: 'the memory to hold the block and its order, which is why the block is capped' },
        { operation: 'BWT inverse', average: 'O(n) with a counting pass and an LF walk', worst: 'the same — the inverse is much cheaper than the forward transform' },
        { operation: 'move-to-front', average: 'O(|Σ|) per symbol with a list; O(log |Σ|) with a tree', worst: 'the naive list scan is what makes a simple implementation slow' },
        { operation: 'run-length of zeros', average: 'O(n), and it reduces the symbol count', worst: 'no benefit at all on data the transform did not group' },
        { operation: 'the entropy stage', average: 'order-0 Huffman over the run-length alphabet', worst: 'deliberately weak — the pipeline has already done the modelling' },
        { operation: 'the whole chain', average: 'measured 10.753× at a 4 096-byte block', worst: '1.739× at 64 bytes — the block size dominates everything else' }
      ],
      failureModes: [
        {
          symptom: 'The BWT stage reports a different entropy from its input.',
          cause: 'The output is not a permutation — usually a sentinel character added to the alphabet.',
          fix: 'Use a row index instead of a sentinel, which keeps the alphabet unchanged and the counts identical.'
        },
        {
          symptom: 'Compression is poor despite the transform.',
          cause: 'The block is too small to gather the data into runs.',
          fix: 'Sweep the block size and read the zero share. The demo goes from 10.1% zeros at 64 bytes to 92.6% at 4 096.'
        },
        {
          symptom: 'Compression is very slow on large files.',
          cause: 'The forward transform sorts, and a naive implementation sorts rotations rather than suffixes.',
          fix: 'Use a linear-time suffix array construction, and cap the block — bzip2 caps at 900 KB for exactly this.'
        },
        {
          symptom: 'The output decodes to garbage from the middle onwards.',
          cause: 'The row index is wrong, so the LF walk starts in the wrong place.',
          fix: 'Round-trip the whole chain in a test, not each stage separately — the stage tests pass with a wrong index.'
        }
      ],
      inTheWild: [
        'bzip2, which is exactly this chain with a 100–900 KB block.',
        'bsdiff and other binary-delta tools, which use the BWT to find structure across two versions.',
        'FM-indexes and BWA/bowtie in genomics, where the transform is used for SEARCH rather than compression.',
        'PNG’s scanline filters and Parquet’s delta encodings, which are the same "reversible rearrangement" move on different data.'
      ],
      sources: [
        { title: 'Burrows and Wheeler — A block-sorting lossless data compression algorithm (1994)', note: 'the transform, the inverse, and the original pipeline' },
        { title: 'Fenwick — Block sorting text compression (1996)', note: 'why MTF works after the transform and what else could go there' },
        { title: 'Ferragina and Manzini — Opportunistic data structures with applications (2000)', note: 'the FM-index: the same transform used to search rather than compress' },
        { title: 'Seward — the bzip2 source and manual', note: 'the block-size trade-off as an implementer states it' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));

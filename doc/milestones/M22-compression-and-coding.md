# M22 — Compression, information theory and error correction

> **Track** Algorithms · **Depends on** M05, M15 · **Sections** 11 · **Effort** L

**Outcome.** Why data compresses at all, every major compression family implemented and measured on
the same corpora, and the coding theory that keeps bits intact on media and wires that flip them.
Compression is also the cleanest available demonstration that modelling and coding are separate
problems.

**Shared machinery introduced.** `machines/codec-lab.js` — runs any codec over a corpus set (English
text, source code, JSON logs, a small image, random bytes, already-compressed data) reporting
compression ratio, bits per symbol against the measured entropy, encode/decode throughput and a
round-trip assertion; `viz/bitstream-view.js` — bit-level output rendering with per-symbol
attribution.

---

## Sections

### 22.1 Information and entropy
- **Covers** — self-information, Shannon entropy, joint and conditional entropy, mutual information,
  KL divergence and cross-entropy, the source-coding theorem as the hard floor, entropy of English
  at the letter, word and context level, and why "random data does not compress" is a theorem.
- **Demo** — entropy calculator over any pasted text: symbol distribution, order-0/1/2 conditional
  entropies and the theoretical minimum size, compared live against what each codec in this
  milestone actually achieves.
- **Diagram** — mermaid diagram relating entropy, cross-entropy and the redundancy a coder can
  remove.
- **Lab** — implement order-k conditional entropy estimation; tests assert known values for
  synthetic sources (uniform, biased coin, Markov chain) within tolerance.
- **Senior insight** — a compressor's ratio is only meaningful against the entropy of the source
  model. Reporting "3× compression" without saying on what is a benchmark with no denominator.

### 22.2 Prefix codes and Huffman
- **Covers** — uniquely decodable and prefix-free codes, the Kraft–McMillan inequality, Huffman's
  algorithm and its optimality proof among symbol codes, the up-to-one-bit-per-symbol gap, canonical
  Huffman for compact table transmission, adaptive Huffman (FGK/Vitter), and the small-alphabet
  penalty.
- **Demo** — Huffman tree built from a live frequency table with the code lengths and the achieved
  bits per symbol shown against the entropy; a canonical-code view shows the table reduced to
  lengths only.
- **Diagram** — mermaid tree of a Huffman code with codewords on the edges.
- **Lab** — implement canonical Huffman encoding and decoding from lengths alone; tests assert
  round-trip equality and that the table encoding is smaller than transmitting the tree.
- **Senior insight** — Huffman cannot beat one bit per symbol, so for a two-symbol source with a
  99/1 split it wastes 90% of the achievable compression. That single limitation is why arithmetic
  coding exists.

### 22.3 Arithmetic coding and ANS
- **Covers** — coding a whole message as one number in [0, 1), interval subdivision, renormalisation
  and carry handling in integer implementations, the fractional-bit advantage, adaptive models,
  range coding, and asymmetric numeral systems (rANS/tANS) with their table-driven speed.
- **Demo** — arithmetic coding animated as an interval narrowing per symbol, with the emitted bits
  shown as the interval's binary prefix stabilises; an ANS view shows the state transitions and the
  reversed decoding order.
- **Diagram** — mermaid diagram of interval subdivision across three symbols.
- **Lab** — implement integer arithmetic coding with renormalisation; tests assert exact round-trip
  for randomised inputs and a compressed size within 1% of the model's entropy.
- **Senior insight** — ANS is why modern codecs (zstd, LZFSE, JPEG XL) got both arithmetic-coding
  ratios and Huffman-like speed; it is the most consequential compression development of the last
  fifteen years.

### 22.4 Dictionary compression
- **Covers** — LZ77 with a sliding window, match finding by hash chains or binary trees, lazy
  matching, LZSS's literal/match flag, LZ78 and LZW with their incremental dictionaries, the GIF and
  Unix compress history, and the window-size/memory trade-off.
- **Demo** — LZ77 encoder with the window and lookahead buffer drawn, each match shown as an arrow
  back into the window, and per-token output; a slider over window size and match-search depth shows
  ratio versus speed.
- **Diagram** — mermaid diagram of a (distance, length, literal) token referencing the window.
- **Lab** — implement LZ77 match finding with hash chains and a configurable search depth; tests
  assert round-trip correctness and a monotone ratio improvement as search depth increases.
- **Senior insight** — match finding is where all the CPU goes and where compression levels come
  from; "level 9" is nearly always "search harder", not "a different algorithm".

### 22.5 Real-world general-purpose codecs
- **Covers** — DEFLATE's block structure and its LZ77-plus-Huffman pipeline, gzip and zlib framing,
  zstd's entropy stages and dictionary support, brotli's static dictionary, the compression-level
  ladder, streaming versus one-shot, and how to choose a codec by measuring on your own data.
- **Demo** — the codec bake-off: each corpus compressed by every implemented codec with ratio,
  encode speed and decode speed plotted on a scatter (ratio versus speed), making the Pareto
  frontier explicit.
- **Diagram** — mermaid diagram of DEFLATE's stored/fixed/dynamic block decision.
- **Lab** — implement a DEFLATE-compatible *decoder* for fixed and dynamic Huffman blocks; tests
  assert it decodes fixtures produced by a real gzip encoder byte for byte.
- **Senior insight** — decode speed usually matters more than ratio, because data is written once
  and read many times; the Pareto plot, not the ratio column, is how a codec should be chosen.

### 22.6 Context modelling and prediction
- **Covers** — separating the model from the coder, PPM with escape mechanisms, context mixing as in
  PAQ, order-k models and the sparsity problem, the equivalence of prediction and compression, and
  the compression-as-intelligence framing including the connection to language-model tokenisation.
- **Demo** — a context-mixing playground: enable order-1, order-2, word and match models
  individually and watch the bits-per-character fall, with each model's live weight shown.
- **Diagram** — mermaid diagram of several predictors mixed into one probability fed to the coder.
- **Lab** — implement an order-2 context model feeding the arithmetic coder from 22.3; tests assert
  round-trip and a better ratio than order-0 on the text corpus.
- **Senior insight** — every compressor is a prediction machine, and the model is where the ratio
  comes from. That is the same claim, with the same arithmetic, that a language model makes.

### 22.7 Transform-based compression: BWT and friends
- **Covers** — the BWT pipeline (from M06) as a compression preprocessor, move-to-front, run-length
  encoding, the bzip2 chain, why the transform makes data more compressible without compressing it,
  block size effects, and the decode cost asymmetry.
- **Demo** — the bzip2 pipeline stage by stage on a chosen input: BWT output, MTF output, RLE output
  and the final entropy stage, each with its size and entropy so the learner can see where the gain
  actually occurs.
- **Diagram** — mermaid flowchart of the BWT → MTF → RLE → entropy-coder pipeline.
- **Lab** — implement move-to-front and its inverse; tests assert round-trip and a measurable
  entropy drop after MTF on BWT output.
- **Senior insight** — the BWT does not compress anything; it rearranges data so that a simple model
  becomes accurate. Preprocessing to make a weak model strong is a general technique.

### 22.8 Lossy compression
- **Covers** — the rate–distortion idea, quantisation as the lossy step, transform coding and energy
  compaction, the DCT and the JPEG pipeline end to end, chroma subsampling, quality factors and
  quantisation tables, perceptual models in audio, and generation loss from repeated re-encoding.
- **Demo** — a working JPEG-style encoder on a small image: block DCT coefficients shown as a heat
  map, quantisation applied at an adjustable quality, and the reconstruction with PSNR and SSIM
  reported; a re-encode loop demonstrates generation loss.
- **Diagram** — mermaid flowchart of the JPEG pipeline from colour transform to entropy coding.
- **Lab** — implement the 8×8 DCT and its inverse plus quantisation; tests assert round-trip within
  the expected error at quality 100 and monotone PSNR degradation as quality falls.
- **Senior insight** — lossy compression is a modelling claim about the receiver, not about the
  data; a codec tuned for human eyes destroys exactly the information a downstream detector needed.

### 22.9 Domain-specific compression
- **Covers** — integer sequences (delta, zigzag, varint, group varint, frame of reference,
  bit-packing, Simple-8b), columnar encodings (dictionary, RLE, bit-packed, null bitmaps),
  floating-point compression (XOR-based Gorilla, chunked), time-series compaction, and the
  compression built into database and log formats.
- **Demo** — a columnar block encoded with each scheme: size per column, encode/decode throughput,
  and the effect of sortedness and cardinality on the ratio, with a "sort the column first" toggle
  that changes everything.
- **Diagram** — mermaid diagram of the encoding choice per column type in a columnar block.
- **Lab** — implement Gorilla-style XOR float compression; tests assert exact round-trip for
  randomised series and a ratio target on a slowly-varying metric fixture.
- **Senior insight** — sorting before encoding is often worth more than the encoding choice, which
  is why columnar formats care so much about clustering keys.

### 22.10 Error detection: checksums and CRC
- **Covers** — parity, the Internet checksum and its weaknesses, Fletcher and Adler-32, CRC as
  polynomial division over GF(2), generator polynomials and their error-detection guarantees,
  table-driven and slicing-by-8 implementations, the difference between a checksum and a
  cryptographic hash, and where each belongs.
- **Demo** — inject errors (single bit, burst, reordering) into a message and watch which detectors
  catch which; the CRC's burst-detection guarantee is demonstrated by exhaustive search over bursts
  up to the polynomial degree.
- **Diagram** — mermaid diagram of CRC as shift-and-XOR polynomial division.
- **Lab** — implement table-driven CRC-32; tests assert agreement with known test vectors and the
  documented detection guarantees on generated error patterns.
- **Senior insight** — CRC detects the error classes hardware actually produces (bursts), which is
  why it survives in storage and networking while a plain sum would not; it detects nothing about
  an adversary, which is why it is never an integrity check.

### 22.11 Error correction
- **Covers** — Hamming distance and code rate, Hamming codes and syndrome decoding, SECDED in ECC
  memory, Reed–Solomon over finite fields with erasure and error decoding, its use in CDs, QR codes
  and storage, erasure coding versus replication in distributed storage, LDPC and turbo codes at a
  conceptual level, and fountain codes.
- **Demo** — encode a message with Reed–Solomon, corrupt symbols interactively, and watch decoding
  succeed until the correction limit is exceeded — with the syndrome computation shown; an erasure-
  coding view compares storage overhead against replication for the same durability.
- **Diagram** — mermaid diagram of a (n, k) code's data and parity symbols with the correction
  capacity marked.
- **Lab** — implement Hamming(7,4) encoding and syndrome-based single-error correction; tests assert
  correction of every single-bit error and detection of every double-bit error, exhaustively.
- **Senior insight** — erasure coding gives the same durability as 3× replication at around 1.5×
  storage, which is why every large object store uses it — and why its reconstruction read
  amplification is the operational cost nobody mentions.

---

## Modules

| Path | Purpose |
|---|---|
| `src/js/algorithms/entropy.js` | Entropy estimation, KL divergence, model evaluation |
| `src/js/algorithms/huffman.js` | Classic, canonical and adaptive Huffman |
| `src/js/algorithms/arithmetic-coder.js` | Integer arithmetic coding, range coder, rANS |
| `src/js/algorithms/lz.js` | LZ77/LZSS/LZ78/LZW with pluggable match finders |
| `src/js/algorithms/deflate.js` | Block parsing, fixed and dynamic Huffman decoding |
| `src/js/algorithms/context-model.js` | Order-k models, PPM escapes, simple mixing |
| `src/js/algorithms/bwt-pipeline.js` | MTF, RLE, bzip2-style chain (BWT from M06) |
| `src/js/algorithms/lossy-codec.js` | DCT, quantisation, PSNR/SSIM, JPEG-style pipeline |
| `src/js/algorithms/integer-codecs.js` | Varint, group varint, FOR, bit-packing, Gorilla |
| `src/js/algorithms/checksums.js` | Internet checksum, Fletcher, Adler, CRC family |
| `src/js/algorithms/ecc.js` | Hamming, Reed–Solomon over GF(2^8), erasure coding |
| `src/js/machines/codec-lab.js` | Corpora, ratio/throughput measurement, round-trip assertions |

---

## Acceptance criteria

- [ ] Every lossless codec round-trips exactly on every corpus, including empty input, a single
      byte, all-identical bytes and already-compressed data (where the ratio must be reported as
      ≥ 1.0 rather than hidden).
- [ ] Achieved bits per symbol are always displayed against the measured entropy of the source
      model, never alone.
- [ ] The DEFLATE decoder decodes real gzip-produced fixtures byte for byte.
- [ ] CRC-32 matches published test vectors, and the burst-detection guarantee is verified
      exhaustively up to the polynomial degree.
- [ ] Reed–Solomon corrects up to ⌊(n−k)/2⌋ errors and detects beyond it, verified by exhaustive
      corruption for small parameters.
- [ ] The lossy pipeline reports PSNR and SSIM, and generation loss over repeated encodes is
      measured rather than asserted.

---

## Sources

- Shannon — *A mathematical theory of communication*
- Cover, Thomas — *Elements of Information Theory*
- Huffman — *A method for the construction of minimum-redundancy codes*
- Witten, Neal, Cleary — *Arithmetic coding for data compression*
- Duda — *Asymmetric numeral systems*
- Ziv, Lempel — the 1977 and 1978 papers
- Deutsch — RFC 1951 (DEFLATE)
- Pelkonen et al. — *Gorilla: a fast, scalable, in-memory time series database*
- Peterson, Brown — *Cyclic codes for error detection*
- Reed, Solomon — *Polynomial codes over certain finite fields*

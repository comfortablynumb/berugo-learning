/** Concepts for lossy and domain-specific compression (M22.8-M22.9). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'lossy-compression': [
      {
        term: 'Lossy compression is a claim about the receiver',
        plain: 'It throws away what the intended reader was not going to notice.',
        formal: 'the distortion measure encodes a model of the observer; the data itself has no opinion',
        detail: [
          'JPEG discards high spatial frequencies because human vision resolves them poorly. A ' +
            'perceptual audio codec discards what a nearby louder tone would mask.',
          'The information is genuinely gone, and whether that matters depends entirely on who is ' +
            'looking.',
          'If the answer is a program — an edge detector, a barcode reader, a classifier — the ' +
            'perceptual argument does not apply at all. A codec tuned for eyes may have destroyed ' +
            'exactly the signal the program needed.'
        ],
        example: 'The demo measures 89.0% of a block’s DCT coefficients quantised to zero at ' +
          'quality 50, and every one of them is information no later stage can recover.'
      },
      {
        term: 'Only one step in the pipeline loses anything',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["transform"] --> B["reversible — nothing lost"]',
            '    C["quantise"] --> D["THIS is the loss,<br/>all of it, on purpose"]',
            '    E["entropy-code"] --> F["reversible — nothing lost"]',
            '    B --> G["so quality is one dial,<br/>in one place"]',
            '    D --> G',
            '    F --> G'
          ].join('\n'),
          caption: 'Knowing that the transform and the coder are both lossless tells you where every quality question is decided, and it is not where people usually look.'
        },
        plain: 'Transform, quantise, entropy-code — and the middle one is the whole loss.',
        formal: 'the DCT is reversible arithmetic and the entropy stage is lossless; quantisation is divide-and-round',
        detail: [
          'Knowing which box is lossy is what makes the pipeline analysable.',
          'The colour transform and the DCT are invertible up to floating-point rounding, and the ' +
            'entropy coder is lossless by definition. So the quality setting is nothing but a ' +
            'multiplier on the quantisation step table.',
          'Chroma subsampling is the one other lossy step in a colour pipeline, and it is there for ' +
            'the same reason: a claim about the receiver.'
        ],
        example: 'The demo shows the quantisation table beside the coefficients and the surviving ' +
          'levels, so the discarded values are visible as zeros.'
      },
      {
        term: 'The transform earns its place by energy compaction',
        plain: 'It moves most of a block’s content into a few coefficients.',
        formal: 'for locally smooth data the DCT concentrates variance in the low-frequency corner',
        detail: [
          'The transform does not compress. Like the BWT it rearranges, but it rearranges into a ' +
            'form where quantisation can throw away nearly everything without much visible cost.',
          'Natural images are locally smooth, so their high-frequency coefficients are small, and ' +
            'zeroing a small coefficient changes the block very little.',
          'The zigzag ordering then puts those zeros in one long run for the entropy stage, which is ' +
            'why the non-zero coefficient count predicts the file size.'
        ],
        example: 'The demo measures 85.9% of a block’s energy in the top-left 4 × 4 corner of ' +
          'its 8 × 8 coefficients, with 19 of 64 levels surviving quantisation.'
      },
      {
        term: 'Rate against distortion is a curve, not a point',
        plain: 'A lossy codec has no single ratio.',
        formal: 'quality maps to (bytes, distortion) pairs; quoting one point is how comparisons go wrong',
        detail: [
          'Two codecs can only be compared at equal distortion or equal rate, and the ranking often ' +
            'changes along the curve. One wins at low quality and loses at high.',
          'That is why a codec claim of the form "30% smaller" is meaningless without saying at what ' +
            'quality, measured how, and on what images.',
          'The curve is also where the sensible operating point lives, and it is usually well short ' +
            'of the top.'
        ],
        example: 'The demo sweeps quality 10 to 100 and measures ratios from 18.20× down to ' +
          '2.25×, with PSNR rising 27.21 dB to 66.62.'
      },
      {
        term: 'PSNR and SSIM disagree, and the disagreement is informative',
        plain: 'One is a per-pixel error; the other compares local structure.',
        formal: 'PSNR = 10·log₁₀(255² / MSE); SSIM compares local means, variances and covariance',
        readAs: 'The peak signal-to-noise ratio is ten times the base-ten logarithm of 255 ' +
          'squared over the mean squared error, in decibels.',
        detail: [
          'PSNR cannot see WHERE the error is, so it treats a small error spread evenly and a ' +
            'visible block edge identically.',
          'SSIM punishes structural change and therefore notices blocking, which is exactly the ' +
            'artefact a block-transform codec produces.',
          'A comparison on PSNR alone flatters the codecs in this section, and the two measures ' +
            'saturate at different points on the curve.'
        ],
        example: 'The demo measures SSIM reaching 0.9936 at quality 90 while PSNR keeps climbing ' +
          'from 41.71 dB to 66.62 at quality 100.'
      },
      {
        term: 'Quality 100 is not lossless',
        plain: 'The quantisation table becomes all ones and the arithmetic still rounds.',
        formal: 'the DCT is computed in floating point and the reconstruction is rounded back to integers',
        detail: [
          'This surprises people who use quality 100 as an archival setting.',
          'Even with every quantisation step equal to one, the forward transform, the rounding to ' +
            'integer levels and the inverse transform each lose a fraction of a least-significant ' +
            'bit. The result is a finite PSNR rather than an infinite one.',
          'If the requirement is "unchanged", the answer is a lossless format, not the top of a ' +
            'lossy dial.'
        ],
        example: 'The demo measures 66.62 dB at quality 100. That is very high, and not infinite.'
      },
      {
        term: 'Generation loss is conditional, and the folklore has it wrong',
        plain: 'Re-saving at the same settings on the same grid costs nothing after the first round.',
        formal: 'every coefficient is already a multiple of its quantisation step, so the second encode is a fixed point',
        detail: [
          'The demo runs the loop rather than repeating the received wisdom, and the result is a ' +
            'flat line. After one round the image stops changing entirely, with zero pixels ' +
            'differing on every subsequent round.',
          'What actually destroys a re-saved image is anything that MOVES it relative to the 8 × 8 ' +
            'block grid: a crop, a resize, a different encoder’s alignment.',
          'Then each round quantises coefficients that no longer sit on the grid.'
        ],
        example: 'Aligned, the demo measures 3 341 pixels changed on round one and 0 on every ' +
          'round after it. Shifted by three pixels, it is 2 979 to 3 281 per round.'
      },
      {
        term: 'A shifted grid keeps losing, and that is what a pipeline does',
        plain: 'Crop, resize, re-save — and the damage accumulates every time.',
        formal: 'a grid offset means the second encode’s blocks straddle the first encode’s, so nothing lands on the quantisation lattice',
        detail: [
          'This is the operational rule the measurement produces, and it is different from the usual ' +
            'one.',
          '"Never re-encode a JPEG" is too strong, because an aligned re-save is free.',
          '"Never re-encode after anything has moved" is the rule that matches the data. It indicts ' +
            'exactly the pipelines that quietly destroy archives: thumbnail generators, ' +
            'auto-croppers, and anything that resizes on upload and again on display.'
        ],
        example: 'The demo measures PSNR falling from 34.16 dB to 30.67 over five shifted rounds ' +
          'while the aligned column holds at 32.09.'
      }
    ],

    'domain-specific-compression': [
      {
        term: 'A columnar writer knows what a general compressor cannot see',
        plain: 'That the column is sorted timestamps, or five distinct labels, or a slow metric.',
        formal: 'the encoding is selected from the column’s type and statistics, before any entropy coding',
        detail: [
          'A general-purpose compressor sees bytes and looks for repeats.',
          'A columnar format knows the values are integers that ascend, or strings from a small set, ' +
            'or doubles that barely move. Each of those facts selects a REPRESENTATION rather than ' +
            'coding a bad one better.',
          'That is why a Parquet file with the right encodings beats gzip over the same data by a ' +
            'wide margin, while being faster to read.'
        ],
        example: 'The demo measures a sorted timestamp column at 1 080 bytes with delta plus ' +
          'Simple-8b, against 16 000 raw. That is 14.8×.'
      },
      {
        term: 'Sorting the column is usually worth more than the encoding choice',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["the same values, the same encoder"] --> B["unsorted: runs of length 1,<br/>deltas all over the place"]',
            '    A --> C["sorted: long runs,<br/>small deltas"]',
            '    B --> D["a modest saving"]',
            '    C --> E["often several times better"]',
            '    E --> F["and the sort is a one-line change"]'
          ].join('\n'),
          caption: 'Effort usually goes into picking between encodings. The order the rows are written in tends to dominate all of them, and it is the cheaper thing to change.'
        },
        plain: 'The same encoder, the same values, a different order.',
        formal: 'delta coding a sorted column gives small gaps; delta coding a shuffled one gives large signed ones',
        detail: [
          'This is the finding the whole section is arranged around, and it is measured as a ratio ' +
            'between two runs of identical code.',
          'It is also why columnar formats care so much about clustering keys, and why a table ' +
            'sorted by the column you query is smaller as well as faster.',
          '"Which codec" is the second question. The first is whether anything can be reordered ' +
            'without breaking a requirement.'
        ],
        example: 'With delta plus Simple-8b the demo measures 1 080 bytes sorted against 3 880 ' +
          'shuffled. That is a factor of 3.59.'
      },
      {
        term: 'Zigzag is what makes delta coding safe for signed values',
        plain: 'Map −1 to 1 and 1 to 2, so small magnitudes stay small.',
        formal: 'zigzag(n) = 2n for n ≥ 0 and −2n − 1 otherwise',
        readAs: 'Zigzag maps a non-negative number to twice itself and a negative one to minus ' +
          'twice itself minus one.',
        detail: [
          'Without it a two’s-complement −1 is all ones, and a variable-length integer coder spends ' +
            'ten bytes on it.',
          'With it, −1 costs the same as 1.',
          'This matters the moment a column is not perfectly ascending, which is most real data. It ' +
            'is the reason delta-plus-varint is the standard pairing rather than delta alone.'
        ],
        example: 'The demo zigzags every delta before encoding, which is what keeps the shuffled ' +
          'column at 3 961 bytes rather than far more.'
      },
      {
        term: 'One width for a block means one outlier costs the block',
        plain: 'Bit-packing sizes everything by the largest value present.',
        formal: 'width = max over the block of bitsFor(value); the cost is width × count bits',
        detail: [
          'That is a real failure mode on data with occasional spikes, and it is what ' +
            'frame-of-reference and Simple-8b exist to fix.',
          'Frame-of-reference subtracts a block minimum and re-chooses the width per block, so an ' +
            'outlier costs one block. Simple-8b chooses a width per 64-bit word, so an outlier ' +
            'costs one word.',
          'The trade is a small per-block or per-word header, against robustness to spikes.'
        ],
        example: 'The demo measures the sorted timestamp column at 8 000 bytes bit-packed and ' +
          '1 278 with frame-of-reference. The same deltas, differently framed.'
      },
      {
        term: 'A dictionary turns strings into small integers, and its width is a logarithm',
        plain: 'Cardinality decides the code width, and nothing else does.',
        formal: 'width = ⌈log₂(cardinality)⌉ bits per value, plus the dictionary itself',
        readAs: 'Each code is as wide as the base-two logarithm of the number of distinct values, ' +
          'rounded up.',
        detail: [
          'Below a few hundred distinct values a dictionary is close to free, and the codes ' +
            'run-length code beautifully once the column is sorted.',
          'Above that the dictionary itself starts to dominate, and at cardinality equal to the row ' +
            'count it is pure overhead.',
          'That is why a high-cardinality column, such as a UUID or a free-text field, is the one ' +
            'that decides a columnar file’s size. Nothing recovers it.'
        ],
        example: 'The demo measures 516 bytes at two distinct values and 26 248 at four thousand, ' +
          'over the same 4 000 rows.'
      },
      {
        term: 'Gorilla XORs consecutive doubles and stores the window that moved',
        plain: 'A slowly-varying metric changes only its low mantissa bits.',
        formal: 'store the bits between the leading and trailing zeros of x ⊕ previous, with control bits for the common cases',
        readAs: 'Exclusive-or each value with the one before it, and store only the bits between ' +
          'the leading and trailing zeros of the result.',
        detail: [
          'It works because IEEE 754 puts the sign, the exponent and the high mantissa bits at the ' +
            'top of the word. Those are the parts that do not change on a slow metric.',
          'So the XOR is nearly all zeros, and the meaningful window is a handful of bits.',
          'The encoding is lossless. Every stored bit is a real bit of the original double, and the ' +
            'round-trip is exact.'
        ],
        example: 'The demo verifies 6 of 6 series returning bit-for-bit, including one of uniform ' +
          'noise.'
      },
      {
        term: 'Gorilla’s ratio is a fact about the mantissa, not about the encoder',
        plain: 'Store what you measured, not what the float type can hold.',
        formal: 'every low mantissa bit that moves widens the XOR window and costs a bit per sample',
        detail: [
          'A gauge that reports to one decimal place, held in a double, carries fifty-odd mantissa ' +
            'bits of noise. Every one of them defeats the XOR.',
          'Rounding to the precision the metric actually has is not lossy in any meaningful sense. ' +
            'It is declining to store digits that were never measured.',
          'The difference this makes is an order of magnitude, which is far larger than any encoder ' +
            'choice.'
        ],
        example: 'The demo measures the same random walk at 1.32× in full precision, 9.23× rounded ' +
          'to 0.1, and 59.93× rounded to whole units.'
      },
      {
        term: 'The floor and the ceiling are both worth measuring',
        plain: 'A constant series and a noise series bound what any encoder can do.',
        formal: 'a constant costs one control bit per value; uniform noise costs the full window every time',
        detail: [
          'Reporting only the flattering case is how a time-series benchmark misleads.',
          'The demo runs a constant series, a monotone counter, three walks at different precisions ' +
            'and uniform noise. A reader can see both ends and place their own data between them.',
          'The noise row is the honest floor, and any encoder that appears to beat it on genuinely ' +
            'random doubles is measuring something else.'
        ],
        example: 'The demo measures 62.02× on a constant series and 1.32× on the full-precision ' +
          'walk, with the noise series reported rather than omitted.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));

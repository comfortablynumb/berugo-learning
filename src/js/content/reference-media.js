/** Reference entries for lossy and domain-specific compression (M22.8-M22.9). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'lossy-compression': {
      summary: 'A JPEG-style pipeline swept over six quality settings with PSNR and SSIM ' +
        'reported side by side, one 8 × 8 block shown from DCT to surviving levels, and the ' +
        're-encode loop run twice — once on the original grid and once with the grid moved.',
      intuition: 'Lossy compression is a claim about who is reading the data afterwards, and ' +
        'generation loss turns out to be conditional on whether anything moved.',
      formulation: {
        equations: [
          {
            label: 'The pipeline, with the one lossy step marked',
            expr: 'colour transform → subsample → DCT → QUANTISE → zigzag → entropy code',
            terms: [
              { sym: 'the DCT', meaning: 'reversible arithmetic: it concentrates energy, it does not discard' },
              { sym: 'quantisation', meaning: 'divide by a step and round — the whole of the loss' },
              { sym: 'quality', meaning: 'a multiplier on the step table: below 50 it multiplies, above it divides' },
              { sym: 'zigzag', meaning: 'low frequencies first, so the quantised tail is one run of zeros' }
            ]
          },
          {
            label: 'The rate–distortion curve, 64 × 64 greyscale',
            expr: 'quality · bytes · ratio · PSNR · SSIM · non-zero coefficients',
            terms: [
              { sym: 'quality 10', meaning: '225 · 18.20× · 27.21 dB · 0.8207 · 168 of 4 096 (4.1%)' },
              { sym: 'quality 50', meaning: '537 · 7.63× · 32.09 dB · 0.9420 · 449 (11.0%)' },
              { sym: 'quality 90', meaning: '1 063 · 3.85× · 41.71 dB · 0.9936 · 905 (22.1%)' },
              { sym: 'quality 100', meaning: '1 820 · 2.25× · 66.62 dB · 1.0000 · 1 395 — and NOT lossless' }
            ]
          },
          {
            label: 'Generation loss: the same image re-encoded six times',
            expr: 'round · aligned PSNR · pixels changed · shifted PSNR · pixels changed',
            terms: [
              { sym: 'round 1', meaning: '32.09 dB · 3 341 changed · 34.16 dB · 3 038 changed' },
              { sym: 'round 2', meaning: '32.09 · 0 · 31.23 · 2 979' },
              { sym: 'rounds 3–5', meaning: '32.09 and 0 every time · 31.85, 30.14, 30.67 dB and ~3 000 pixels each' },
              { sym: 'the rule', meaning: 'not "never re-encode" but "never re-encode after anything has moved"' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Two distortion measures are reported, not one',
          why: 'PSNR cannot see where the error is and SSIM can; they saturate at different points.',
          breaks: 'From quality 90 to 100 the demo gains 25 dB of PSNR and 0.0064 of SSIM — a comparison on PSNR alone would call that a large improvement.'
        },
        {
          name: 'The quality sweep is a curve, and no single point is quoted alone',
          why: 'Two codecs can only be compared at equal rate or equal distortion.',
          breaks: '"30% smaller" is meaningless without the quality, the measure and the corpus.'
        },
        {
          name: 'Generation loss is measured, not assumed',
          why: 'The received wisdom is wrong for the aligned case and right for the shifted one.',
          breaks: 'Asserting that every re-save degrades an image predicts 3 341 changed pixels per round, and the aligned measurement is zero.'
        }
      ],
      complexity: [
        { operation: '8 × 8 DCT, separable', average: 'O(n³) per block naively; O(n² log n) with a fast transform', worst: 'reversible to within floating-point rounding, which is why quality 100 is not lossless' },
        { operation: 'quantisation', average: 'one divide and round per coefficient', worst: 'the only lossy step, and the only one the quality dial touches' },
        { operation: 'the entropy stage', average: 'run-length plus Huffman over the zigzag order', worst: 'lossless — its size is driven by the non-zero coefficient count' },
        { operation: 'PSNR', average: 'O(pixels), one pass', worst: 'blind to the location of the error: blocking and noise score alike' },
        { operation: 'SSIM', average: 'O(pixels) over local windows', worst: 'sensitive to structure, so it notices exactly the artefact a block transform makes' },
        { operation: 'aligned re-encode', average: 'a fixed point after one round — 0 pixels changed', worst: 'shifted: ~3 000 pixels per round, PSNR falling 34.16 → 30.67 over five' }
      ],
      failureModes: [
        {
          symptom: 'A model performs worse on images that look fine.',
          cause: 'The pipeline re-encoded them; the codec discarded high-frequency detail the model was using.',
          fix: 'Keep a lossless copy for anything a program will read, and measure the model on the encoded images rather than the originals.'
        },
        {
          symptom: 'An archive degrades over years of processing.',
          cause: 'Every crop, resize or thumbnail regeneration moved the block grid and re-encoded.',
          fix: 'Re-derive from a lossless master. The demo shows an ALIGNED re-save costing nothing and a shifted one costing something every round.'
        },
        {
          symptom: 'Quality 100 files are enormous and still not identical to the source.',
          cause: 'The quantisation table is all ones and the transform is still floating point.',
          fix: 'Use a lossless format if "unchanged" is the requirement — the demo measures 66.62 dB, not infinity.'
        },
        {
          symptom: 'A codec comparison ranks two encoders differently from a viewer.',
          cause: 'It compared PSNR, which does not model the visual system it is standing in for.',
          fix: 'Report SSIM or a modern perceptual measure alongside, and compare at equal quality on both.'
        }
      ],
      inTheWild: [
        'JPEG, which is this pipeline exactly, and JPEG XL, which replaces the entropy stage with ANS.',
        'Video codecs, where the same transform-quantise-code chain runs on motion-compensated residuals.',
        'MP3, AAC and Opus, which apply the same idea in the frequency domain with a psychoacoustic masking model.',
        'Thumbnail and image-resize services, which are where generation loss actually happens in production.'
      ],
      sources: [
        { title: 'Wallace — The JPEG still picture compression standard (1991)', note: 'the pipeline, the tables and the design reasoning' },
        { title: 'Ahmed, Natarajan and Rao — Discrete cosine transform (1974)', note: 'the transform and why it compacts energy for smooth signals' },
        { title: 'Wang, Bovik, Sheikh and Simoncelli — Image quality assessment: from error visibility to structural similarity (2004)', note: 'SSIM, and the case against PSNR' },
        { title: 'Berger — Rate Distortion Theory', note: 'the formal frame: what a distortion measure is and what it buys' }
      ]
    },

    'domain-specific-compression': {
      summary: 'Six integer encodings over four columns that differ only in shape, the sorting ' +
        'comparison run as two passes of identical code, dictionary and run-length coding against ' +
        'cardinality, and Gorilla measured at four precisions of the same metric.',
      intuition: 'Sorting the column is usually worth more than the encoding choice, and a ' +
        'metric’s compressibility is a fact about how many mantissa bits actually move.',
      formulation: {
        equations: [
          {
            label: 'The integer toolkit, and what each fixes',
            expr: 'delta · zigzag · varint · bit-pack · frame-of-reference · Simple-8b',
            terms: [
              { sym: 'delta', meaning: 'small gaps from a sorted column; large signed ones from a shuffled one' },
              { sym: 'zigzag', meaning: 'maps −1 to 1 so a negative delta does not cost ten varint bytes' },
              { sym: 'bit-packing', meaning: 'one width per block, so a single outlier costs the whole block' },
              { sym: 'frame-of-reference and Simple-8b', meaning: 'a width per block or per 64-bit word, so an outlier costs one of those' }
            ]
          },
          {
            label: 'Four columns of 2 000 values, in bytes',
            expr: 'column · raw · varint · delta+varint · bit-packed · delta+FOR · delta+Simple-8b',
            terms: [
              { sym: 'timestamps (sorted)', meaning: '16 000 · 10 000 · 2 004 · 8 000 · 1 278 · 1 080' },
              { sym: 'the same, shuffled', meaning: '16 000 · 10 000 · 3 961 · 8 000 · 3 836 · 3 864 — 3.59× worse' },
              { sym: 'sparse sorted ids', meaning: '16 000 · 7 171 · 3 975 · 3 500 · 3 564 · 4 000 — bit-packing wins' },
              { sym: 'unsorted measurements', meaning: '16 000 · 6 000 · 3 417 · 4 500 · 2 692 · 2 664' }
            ]
          },
          {
            label: 'Cardinality and sortedness on a 4 000-row string column',
            expr: 'distinct · code width · dictionary bytes · runs unsorted · runs sorted',
            terms: [
              { sym: '2 distinct', meaning: '1 bit · 516 bytes · 2 000 runs · 2 runs' },
              { sym: '64 distinct', meaning: '6 bits · 3 512 · 3 946 · 64' },
              { sym: '512 distinct', meaning: '9 bits · 8 596 · 3 992 · 512' },
              { sym: '4 000 distinct', meaning: '12 bits · 26 248 · 4 000 · 2 531 — the dictionary is now the problem' }
            ]
          },
          {
            label: 'Gorilla: the ratio is a property of the mantissa',
            expr: 'series · encoded bytes · bits per value · ratio',
            terms: [
              { sym: 'random walk, full precision', meaning: '12 084 · 48.33 · 1.32×' },
              { sym: 'the same, rounded to 0.1', meaning: '1 733 · 6.93 · 9.23×' },
              { sym: 'rounded to 1', meaning: '267 · 1.07 · 59.93×' },
              { sym: 'constant / uniform noise', meaning: '62.02× and 1.34× — the ceiling and the floor' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The sorting comparison uses identical code on identical values',
          why: 'Anything else confounds the ordering with the encoder.',
          breaks: 'The demo runs the same six encoders twice and reports a 3.59× gap that is entirely the order.'
        },
        {
          name: 'Every float encoding is checked for an exact round-trip',
          why: 'Gorilla is lossless, and any rounding is a storage decision made deliberately.',
          breaks: 'A codec that quietly truncates a mantissa would report a superb ratio and silently change every reading.'
        },
        {
          name: 'The floor and ceiling series are reported alongside the flattering ones',
          why: 'A time-series benchmark on a well-behaved metric measures the metric.',
          breaks: 'Without the noise row at 1.34× a reader cannot tell whether 9.23× is good or the minimum.'
        }
      ],
      complexity: [
        { operation: 'delta + zigzag', average: 'O(n), one pass, exactly invertible', worst: 'turns small values into large ones on an unsorted column' },
        { operation: 'varint', average: '7 payload bits per byte', worst: '10 bytes for a value near 2^63, which is what zigzag exists to prevent' },
        { operation: 'bit-packing', average: 'width × count bits, one width for the block', worst: 'a single outlier sets the width for everything in it' },
        { operation: 'frame-of-reference', average: 'a minimum and a width per 128 values', worst: 'a 4-byte header per block, which dominates on tiny blocks' },
        { operation: 'Simple-8b', average: 'a 4-bit selector and up to 60 payload bits per 64-bit word', worst: 'a value wider than 60 bits cannot be packed at all' },
        { operation: 'Gorilla', average: '1 control bit for a repeat; 2 + window bits otherwise', worst: '2 + 5 + 6 + 64 bits when the window is wide and cannot be reused' }
      ],
      failureModes: [
        {
          symptom: 'A columnar file is far larger than expected.',
          cause: 'A high-cardinality column — a UUID or free text — where the dictionary is pure overhead.',
          fix: 'Check the per-column sizes. The demo shows a dictionary going from 516 bytes at two distinct values to 26 248 at four thousand.'
        },
        {
          symptom: 'Metrics storage grows far faster than the metric count.',
          cause: 'Doubles are being stored at full precision for gauges measured to one decimal place.',
          fix: 'Round to the measured precision before storing. The demo measures a factor of seven from that alone.'
        },
        {
          symptom: 'Delta coding made a column bigger.',
          cause: 'It is not sorted, so consecutive differences are large and signed.',
          fix: 'Sort it if the order is not semantic, or drop the delta stage. Zigzag limits the damage but does not remove it.'
        },
        {
          symptom: 'One outlier row ruined a whole block’s compression.',
          cause: 'Bit-packing sizes the block by its largest value.',
          fix: 'Use frame-of-reference or Simple-8b, which re-choose the width per block or per word.'
        }
      ],
      inTheWild: [
        'Parquet and ORC, whose per-column encodings are exactly this catalogue.',
        'Prometheus and InfluxDB, which store float series with Gorilla-style XOR encoding.',
        'Protocol Buffers and Thrift, which use varint and zigzag for every integer field.',
        'Lucene and inverted-index postings, which are delta-coded, bit-packed integer lists.'
      ],
      sources: [
        { title: 'Pelkonen et al. — Gorilla: a fast, scalable, in-memory time series database (2015)', note: 'the XOR encoding, the control bits and the production numbers' },
        { title: 'Lemire and Boytsov — Decoding billions of integers per second through vectorization (2015)', note: 'bit-packing, frame-of-reference and why SIMD changes the ranking' },
        { title: 'Anh and Moffat — Index compression using 64-bit words (2010)', note: 'Simple-8b and the per-word selector' },
        { title: 'Abadi, Madden and Ferreira — Integrating compression and execution in column-oriented database systems (2006)', note: 'why the encoding choice belongs with the query engine' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));

/** Worked examples for lossy and domain-specific compression (M22.8-M22.9). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'lossy-compression': [
      {
        title: 'The rate–distortion curve, on two measures that disagree about where it ends',
        goal: 'Sweep the quality setting and read what each extra byte buys on both distortion ' +
          'measures.',
        setup: 'A 64 × 64 greyscale test image with a gradient, a hard-edged disc and a textured ' +
          'band, encoded at qualities 10 to 100.',
        steps: [
          {
            do: 'Encode at quality 10.',
            why: 'The bottom of the dial, where the artefacts are obvious.',
            work: '225 bytes, 168 of 4 096 coefficients non-zero — 4.1%',
            result: 'a ratio of 18.20×, PSNR 27.21 dB, SSIM 0.8207'
          },
          {
            do: 'Move to quality 50.',
            why: 'The default in most encoders.',
            work: '537 bytes, 449 coefficients — 11.0%',
            result: '7.63×, 32.09 dB, 0.9420'
          },
          {
            do: 'Move to quality 90.',
            why: 'Where a careful setting usually lands.',
            work: '1 063 bytes, 905 coefficients — 22.1%',
            result: '3.85×, 41.71 dB, and SSIM has reached 0.9936'
          },
          {
            do: 'Go to quality 100 and read both measures.',
            why: 'The quantisation table is now all ones.',
            work: '1 820 bytes, PSNR 66.62 dB, SSIM 1.0000',
            result: 'PSNR has climbed 25 dB since quality 90 and SSIM has moved 0.0064'
          },
          {
            do: 'Note that 66.62 dB is not infinite.',
            why: 'Quality 100 is widely believed to be lossless.',
            work: 'the DCT is computed in floating point and rounded back to integers, so 1 395 ' +
              'coefficients survive and the image still changes',
            result: 'a very high PSNR and a genuinely altered image'
          }
        ],
        answer: 'The two distortion columns do not have the same shape, and the gap between them ' +
          'is where codec comparisons go wrong. SSIM saturates by quality 90 — the structure is ' +
          'already right — while PSNR keeps climbing to 66 dB, so the last 757 bytes buy 25 ' +
          'decibels of a measure that cannot see where the error is and almost nothing of the one ' +
          'that can. The quality-100 row carries the other correction: it is not lossless, ' +
          'because the transform is floating-point arithmetic rounded back to integers, and using ' +
          'it as an archival setting is a mistake with a measurable size.'
      },
      {
        title: 'The inverted case: the re-encode loop, aligned and shifted',
        goal: 'Test the folklore that re-saving a JPEG degrades it every time, by running the ' +
          'loop.',
        setup: 'The same image re-encoded at quality 50 six times, once on the original block grid ' +
          'and once with the grid moved three pixels per round.',
        steps: [
          {
            do: 'Re-encode once and measure against the original.',
            why: 'This is the first generation, and it costs what quality 50 costs.',
            work: '3 341 pixels changed, PSNR 32.09 dB, SSIM 0.9420',
            result: 'the expected loss for one encode'
          },
          {
            do: 'Re-encode the result, on the same grid.',
            why: 'The folklore says this should degrade further.',
            work: '0 pixels changed',
            result: 'a fixed point — the image is now unchanged by encoding'
          },
          {
            do: 'Keep going for four more rounds.',
            why: 'To check the fixed point is real rather than a rounding coincidence.',
            work: '0 pixels changed on every round, PSNR flat at 32.09',
            result: 'aligned re-saving is free after the first round'
          },
          {
            do: 'Now shift the grid three pixels before each encode.',
            why: 'This is what a crop, a resize or a different encoder’s alignment does.',
            work: '3 038, 2 979, 3 107, 3 281 and 3 229 pixels changed on the five rounds',
            result: 'PSNR falling 34.16 → 31.23 → 31.85 → 30.14 → 30.67 dB'
          },
          {
            do: 'Compare the two SSIM columns at the last round.',
            why: 'Structure is what a viewer notices.',
            work: '0.9420 aligned against 0.8872 shifted',
            result: 'five rounds of a moving grid cost what five rounds of a fixed one do not'
          }
        ],
        answer: 'Aligned re-encoding reaches a fixed point after one round and stays there, ' +
          'because every coefficient is already a multiple of its quantisation step and ' +
          'quantising it again returns the same level. The shifted column keeps losing, and it ' +
          'does not fall monotonically — a shift can happen to align better — but it trends down ' +
          'and does not stop. So the rule worth carrying is not "never re-encode" but "never ' +
          're-encode after anything has moved", which indicts precisely the pipelines that crop, ' +
          'resize and re-save without anyone thinking of it as re-encoding at all.'
      }
    ],

    'domain-specific-compression': [
      {
        title: 'Six encodings, four columns, and one property that beats all of them',
        goal: 'Encode integer columns that differ only in their shape, and find what matters most.',
        setup: '2 000 values per column: sorted timestamps, the same timestamps shuffled, sparse ' +
          'sorted ids, and unsorted measurements in a narrow range.',
        steps: [
          {
            do: 'Encode the sorted timestamps six ways.',
            why: 'A monotone column with small gaps is the best case for delta coding.',
            work: 'raw 16 000, varint 10 000, delta+varint 2 004, bit-packed 8 000, ' +
              'delta+FOR 1 278, delta+Simple-8b 1 080',
            result: '14.8× for the best encoding, and delta is doing nearly all of it'
          },
          {
            do: 'Shuffle the same values and encode them again.',
            why: 'Identical values, identical encoders — only the order changed.',
            work: 'delta+varint 3 961, delta+FOR 3 836, delta+Simple-8b 3 864',
            result: 'the best row goes from 1 080 bytes to 3 836 — a factor of 3.59'
          },
          {
            do: 'Compare that gap against the gap between encodings.',
            why: 'It is the choice this section is actually about.',
            work: 'sorting is worth 3.59×; the spread between the three delta encodings is 1.5×',
            result: 'the property of the data beats every encoder decision on the row'
          },
          {
            do: 'Encode the sparse sorted ids.',
            why: 'Sorted, but with gaps of thousands rather than units.',
            work: 'delta+varint 3 975, bit-packed 3 500, delta+FOR 3 564, Simple-8b 4 000',
            result: 'plain bit-packing wins — the deltas are large and uniform'
          },
          {
            do: 'Encode the unsorted measurements.',
            why: 'A narrow range with no order at all.',
            work: 'varint 6 000, delta+varint 3 417, delta+FOR 2 692, Simple-8b 2 664',
            result: 'frame-of-reference and Simple-8b win by subtracting a block minimum'
          }
        ],
        answer: 'Four columns, four different winners, and the largest single effect in the table ' +
          'is not an encoding at all — it is whether the column was sorted. That is why columnar ' +
          'formats care so much about clustering keys, and why the first question about a slow, ' +
          'large table is whether anything can be reordered rather than which codec to set. The ' +
          'sparse-ids row is the useful counterweight: sorted is not automatically delta’s ' +
          'friend, because gaps of thousands are still large numbers, and plain bit-packing takes ' +
          'that one.'
      },
      {
        title: 'The inverted case: the same metric, stored at two precisions',
        goal: 'Measure Gorilla’s ratio against how much of the mantissa actually moves.',
        setup: 'Six series of 2 000 doubles: a random walk at full precision, the same walk ' +
          'rounded to 0.1 and to 1, a monotone counter, a constant, and uniform noise — every one ' +
          'round-trip verified.',
        steps: [
          {
            do: 'Encode the full-precision random walk.',
            why: 'This is a metric stored exactly as a double holds it.',
            work: '12 084 bytes from 16 000, at 48.33 bits per value',
            result: 'a ratio of 1.32× — the encoding has barely helped'
          },
          {
            do: 'Round the same walk to one decimal place and encode it again.',
            why: 'That is the precision such a metric is actually measured at.',
            work: '1 733 bytes, at 6.93 bits per value',
            result: '9.23× — a factor of seven, from rounding alone'
          },
          {
            do: 'Round to whole units.',
            why: 'A gauge that only ever reports integers.',
            work: '267 bytes, at 1.07 bits per value',
            result: '59.93×'
          },
          {
            do: 'Encode the constant series and the noise series.',
            why: 'These bound what any XOR encoding can do.',
            work: 'constant 258 bytes at 1.03 bits; noise 11 926 bytes',
            result: '62.02× and 1.34× — the ceiling and the floor'
          },
          {
            do: 'Check every round-trip.',
            why: 'Gorilla is lossless, and the rounding in row two is a storage decision.',
            work: '6 of 6 series return bit-for-bit',
            result: 'nothing the codec did was approximate'
          }
        ],
        answer: 'The first two rows are the same measurements and differ by a factor of seven, ' +
          'because every low mantissa bit that moves widens the XOR window and costs a bit per ' +
          'sample forever. That is a fact about IEEE 754 rather than about the encoder, and it ' +
          'points at a decision most systems never make explicitly: a gauge reporting to one ' +
          'decimal place, held in a double, is storing fifty-odd bits of noise. Rounding it to ' +
          'the precision it was actually measured at is not lossy in any meaningful sense — and ' +
          'the noise row is the honest floor, at 1.34×, which is what genuinely unpredictable ' +
          'doubles cost.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));

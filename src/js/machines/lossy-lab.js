/**
 * The lossy bench: rate against distortion, with two distortion measures that
 * disagree.
 *
 * Everything here is a sweep over the quality setting, because a lossy codec
 * has no single ratio — it has a curve, and quoting one point on it is the
 * standard way to make a codec comparison meaningless. The two quality columns
 * are kept side by side deliberately: PSNR is a per-pixel error and cannot see
 * where the error is, SSIM is structural and punishes the blocking a
 * block-transform codec produces. A comparison on PSNR alone flatters exactly
 * the codecs this section implements.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.LossyLab = api;
}(this, function (root) {
  'use strict';

  const Codec = root && root.LossyCodec ? root.LossyCodec
    : require('../algorithms/lossy-codec.js');

  function imageFor(options) {
    const settings = options || {};
    const size = settings.size === undefined ? 64 : settings.size;

    return Codec.testImage(size, size);
  }

  /** The rate–distortion curve: one row per quality setting. */
  function qualityStudy(options) {
    const settings = options || {};
    const image = imageFor(settings);
    const qualities = settings.qualities || [10, 25, 50, 75, 90, 100];
    const rows = Codec.qualitySweep(image, qualities);

    return {
      width: image.width, height: image.height, pixels: image.data.length,
      rows: rows,
      best: rows[rows.length - 1],
      worst: rows[0]
    };
  }

  /**
   * One 8x8 block through the pipeline, with the coefficients before and after
   * quantisation. It is where the whole codec becomes concrete: the DCT
   * concentrates the energy into the top-left corner, and quantisation zeroes
   * nearly everything else.
   */
  function blockStudy(options) {
    const settings = options || {};
    const image = imageFor(settings);
    const quality = settings.quality === undefined ? 50 : settings.quality;
    const bx = settings.bx === undefined ? 24 : settings.bx;
    const by = settings.by === undefined ? 24 : settings.by;
    const block = blockAt(image, bx, by);
    const encoded = Codec.encodeBlock(block, quality);
    const decoded = Codec.decodeBlock(encoded.levels, encoded.table);
    let worst = 0;

    decoded.forEach(function (value, i) { worst = Math.max(worst, Math.abs(value - block[i])); });
    return {
      quality: quality, at: { x: bx, y: by },
      original: block, coefficients: encoded.coefficients,
      table: encoded.table, levels: encoded.levels, restored: decoded,
      nonZero: encoded.nonZero, worstError: worst,
      energyInCorner: cornerEnergy(encoded.coefficients)
    };
  }

  function blockAt(image, bx, by) {
    const block = [];

    for (let y = 0; y < Codec.N; y += 1) {
      for (let x = 0; x < Codec.N; x += 1) {
        block.push(image.data[Math.min(image.height - 1, by + y) * image.width
          + Math.min(image.width - 1, bx + x)]);
      }
    }
    return block;
  }

  /** The share of the block's energy in the top-left 4x4 coefficients: the
   *  energy compaction that makes the transform worth doing. */
  function cornerEnergy(coefficients) {
    let corner = 0;
    let total = 0;

    coefficients.forEach(function (value, i) {
      const energy = value * value;

      total += energy;
      if ((i % Codec.N) < 4 && Math.floor(i / Codec.N) < 4) corner += energy;
    });
    return total === 0 ? 1 : corner / total;
  }

  /**
   * Generation loss, both ways: re-encoding on the same block grid and
   * re-encoding after a shift. The first reaches a fixed point after one round
   * and the second does not, which is the finding — a re-saved image is not
   * automatically degraded, a re-CROPPED one is.
   */
  function generationStudy(options) {
    const settings = options || {};
    const image = imageFor(settings);
    const quality = settings.quality === undefined ? 50 : settings.quality;
    const rounds = settings.rounds === undefined ? 6 : settings.rounds;

    return {
      quality: quality, rounds: rounds,
      aligned: Codec.generationLoss(image, { quality: quality, rounds: rounds }),
      shifted: Codec.generationLoss(image, { quality: quality, rounds: rounds, shift: 3 })
    };
  }

  /**
   * PSNR against SSIM at every quality, with the ratio between how much each
   * has fallen. They rank the same settings in the same order here and they do
   * not move together, which is what a reader needs to see before trusting one
   * of them alone.
   */
  function measureComparison(options) {
    const study = qualityStudy(options);
    const first = study.rows[0];
    const last = study.rows[study.rows.length - 1];

    return {
      rows: study.rows.map(function (row) {
        return { quality: row.quality, db: row.db, ssim: row.ssim,
          bytes: row.bytes, ratio: row.ratio,
          dbShare: last.db === Infinity ? 0 : row.db / last.db,
          ssimShare: row.ssim / last.ssim };
      }),
      dbRange: (last.db === Infinity ? 0 : last.db) - first.db,
      ssimRange: last.ssim - first.ssim
    };
  }

  return {
    qualityStudy: qualityStudy, blockStudy: blockStudy,
    generationStudy: generationStudy, measureComparison: measureComparison,
    imageFor: imageFor
  };
}));

/**
 * Lossy compression: a modelling claim about the receiver.
 *
 * Every lossy codec is built on a statement about who is looking. JPEG throws
 * away high spatial frequencies and chroma resolution because the human visual
 * system is poor at both; MP3 discards what a louder tone nearby would mask.
 * Neither is a claim about the data — the information is genuinely gone — and
 * that is why a codec tuned for human eyes can destroy exactly what a
 * downstream detector needed. A pipeline that re-encodes as JPEG before running
 * inference is a real and common version of this mistake.
 *
 * The mechanism is always the same three steps. A TRANSFORM concentrates the
 * energy into a few coefficients (the DCT does this for images because natural
 * images are locally smooth). QUANTISATION divides each coefficient by a step
 * and rounds, which is the only lossy step in the whole pipeline and where the
 * quality setting lives. An ENTROPY CODER then compresses the result losslessly,
 * because after quantisation most coefficients are zero.
 *
 * Two things are measured here rather than asserted. PSNR and SSIM disagree —
 * PSNR is a per-pixel error and SSIM is a structural one, and blocking
 * artefacts hurt the second far more than the first, which is why a codec
 * comparison on PSNR alone flatters block transforms. And GENERATION LOSS turns
 * out to be conditional: re-encoding at the same quality on the same 8x8 grid
 * reaches a fixed point after ONE round, because every coefficient is already a
 * multiple of its step. It is a crop, a resize or a different block alignment
 * that keeps the damage accumulating, and the module measures both cases side
 * by side rather than repeating the folklore.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.LossyCodec = api;
}(this, function () {
  'use strict';

  const N = 8;

  /** The standard JPEG luminance quantisation table, at quality 50. Every
   *  other quality is this table scaled. */
  const LUMINANCE = [
    16, 11, 10, 16, 24, 40, 51, 61,
    12, 12, 14, 19, 26, 58, 60, 55,
    14, 13, 16, 24, 40, 57, 69, 56,
    14, 17, 22, 29, 51, 87, 80, 62,
    18, 22, 37, 56, 68, 109, 103, 77,
    24, 35, 55, 64, 81, 104, 113, 92,
    49, 64, 78, 87, 103, 121, 120, 101,
    72, 92, 95, 98, 112, 100, 103, 99
  ];

  /** The zigzag order: low frequencies first, so the quantised tail is a run of
   *  zeros an entropy coder collapses. */
  const ZIGZAG = buildZigzag();

  function buildZigzag() {
    const order = [];

    for (let sum = 0; sum <= 2 * (N - 1); sum += 1) {
      for (let i = 0; i < N; i += 1) {
        const j = sum - i;

        if (j < 0 || j >= N) continue;
        order.push(sum % 2 === 0 ? (j * N + i) : (i * N + j));
      }
    }
    return order;
  }

  const COS = buildCosines();

  function buildCosines() {
    const table = [];

    for (let u = 0; u < N; u += 1) {
      table.push([]);
      for (let x = 0; x < N; x += 1) {
        table[u].push(Math.cos((2 * x + 1) * u * Math.PI / (2 * N)));
      }
    }
    return table;
  }

  function alpha(u) {
    return u === 0 ? Math.SQRT1_2 : 1;
  }

  /* ----------------------------------------------------------------- DCT */

  /** The 8x8 forward DCT-II, separable, applied to a block centred on zero. */
  function dct(block) {
    const out = new Array(N * N).fill(0);

    for (let u = 0; u < N; u += 1) {
      for (let v = 0; v < N; v += 1) {
        let sum = 0;

        for (let x = 0; x < N; x += 1) {
          for (let y = 0; y < N; y += 1) {
            sum += block[x * N + y] * COS[u][x] * COS[v][y];
          }
        }
        out[u * N + v] = 0.25 * alpha(u) * alpha(v) * sum;
      }
    }
    return out;
  }

  function idct(coefficients) {
    const out = new Array(N * N).fill(0);

    for (let x = 0; x < N; x += 1) {
      for (let y = 0; y < N; y += 1) {
        let sum = 0;

        for (let u = 0; u < N; u += 1) {
          for (let v = 0; v < N; v += 1) {
            sum += alpha(u) * alpha(v) * coefficients[u * N + v] * COS[u][x] * COS[v][y];
          }
        }
        out[x * N + y] = 0.25 * sum;
      }
    }
    return out;
  }

  /* -------------------------------------------------------- quantisation */

  /** JPEG's quality scaling: below 50 the table is multiplied, above it is
   *  divided, and quality 100 gives a table of ones — still not lossless,
   *  because the DCT itself is computed in floating point and rounded. */
  function quantTable(quality) {
    const q = Math.min(100, Math.max(1, quality));
    const scale = q < 50 ? 5000 / q : 200 - 2 * q;

    return LUMINANCE.map(function (value) {
      return Math.min(255, Math.max(1, Math.floor((value * scale + 50) / 100)));
    });
  }

  function quantise(coefficients, table) {
    return coefficients.map(function (value, i) { return Math.round(value / table[i]); });
  }

  function dequantise(levels, table) {
    return levels.map(function (level, i) { return level * table[i]; });
  }

  /* ------------------------------------------------------------ pipeline */

  /** One 8x8 block through the whole chain, reporting what survived. */
  function encodeBlock(block, quality) {
    const table = quantTable(quality);
    const centred = block.map(function (value) { return value - 128; });
    const coefficients = dct(centred);
    const levels = quantise(coefficients, table);
    const nonZero = levels.filter(function (level) { return level !== 0; }).length;

    return { levels: levels, table: table, coefficients: coefficients, nonZero: nonZero };
  }

  function decodeBlock(levels, table) {
    const restored = idct(dequantise(levels, table));

    return restored.map(function (value) {
      return Math.min(255, Math.max(0, Math.round(value + 128)));
    });
  }

  /**
   * A whole greyscale image, in 8x8 blocks. The size estimate counts the
   * quantised levels the way a real entropy stage would: the run of zeros at
   * the tail of the zigzag order costs almost nothing, which is why the
   * NON-ZERO coefficient count is the number that predicts the file size.
   */
  function encodeImage(image, quality) {
    const table = quantTable(quality);
    const blocks = [];
    let nonZero = 0;

    for (let by = 0; by < image.height; by += N) {
      for (let bx = 0; bx < image.width; bx += N) {
        const encoded = encodeBlock(blockAt(image, bx, by), quality);

        blocks.push(encoded.levels);
        nonZero += encoded.nonZero;
      }
    }
    return { blocks: blocks, table: table, quality: quality, nonZero: nonZero,
      width: image.width, height: image.height,
      bits: estimateBits(blocks), totalCoefficients: blocks.length * N * N };
  }

  function blockAt(image, bx, by) {
    const block = new Array(N * N).fill(0);

    for (let y = 0; y < N; y += 1) {
      for (let x = 0; x < N; x += 1) {
        const sx = Math.min(image.width - 1, bx + x);
        const sy = Math.min(image.height - 1, by + y);

        block[y * N + x] = image.data[sy * image.width + sx];
      }
    }
    return block;
  }

  /**
   * A size estimate that costs what an entropy coder would: each non-zero level
   * costs its magnitude in bits plus a run-length prefix, and the tail of zeros
   * after the last non-zero coefficient costs one end-of-block symbol.
   */
  function estimateBits(blocks) {
    let bits = 0;

    blocks.forEach(function (levels) {
      let last = -1;

      ZIGZAG.forEach(function (at, order) {
        if (levels[at] !== 0) last = order;
      });
      bits += 4;
      for (let order = 0; order <= last; order += 1) {
        const level = levels[ZIGZAG[order]];

        bits += level === 0 ? 1 : 4 + Math.ceil(Math.log2(Math.abs(level) + 1)) + 1;
      }
    });
    return bits;
  }

  function decodeImage(encoded) {
    const data = new Array(encoded.width * encoded.height).fill(0);
    let at = 0;

    for (let by = 0; by < encoded.height; by += N) {
      for (let bx = 0; bx < encoded.width; bx += N) {
        const block = decodeBlock(encoded.blocks[at], encoded.table);

        at += 1;
        writeBlock({ data: data, width: encoded.width, height: encoded.height },
          block, bx, by);
      }
    }
    return { data: data, width: encoded.width, height: encoded.height };
  }

  function writeBlock(image, block, bx, by) {
    for (let y = 0; y < N; y += 1) {
      for (let x = 0; x < N; x += 1) {
        const px = bx + x;
        const py = by + y;

        if (px >= image.width || py >= image.height) continue;
        image.data[py * image.width + px] = block[y * N + x];
      }
    }
  }

  /* -------------------------------------------------------------- quality */

  /** Mean squared error and PSNR in decibels: a per-pixel measure, blind to
   *  where the error is. */
  function psnr(a, b) {
    let sum = 0;

    for (let i = 0; i < a.data.length; i += 1) {
      const error = a.data[i] - b.data[i];

      sum += error * error;
    }
    const mse = sum / a.data.length;

    return { mse: mse, db: mse === 0 ? Infinity : 10 * Math.log10(255 * 255 / mse) };
  }

  /**
   * SSIM over 8x8 windows: means, variances and covariance combined so that a
   * change in structure counts for more than a change in level. It is the
   * measure that notices blocking, and it is why two images with the same PSNR
   * can look very different.
   */
  function ssim(a, b) {
    const c1 = (0.01 * 255) * (0.01 * 255);
    const c2 = (0.03 * 255) * (0.03 * 255);
    let total = 0;
    let windows = 0;

    for (let by = 0; by + N <= a.height; by += N) {
      for (let bx = 0; bx + N <= a.width; bx += N) {
        total += windowSsim(statsOf(a, bx, by), statsOf(b, bx, by), { c1: c1, c2: c2 });
        windows += 1;
      }
    }
    return windows === 0 ? 1 : total / windows;
  }

  function statsOf(image, bx, by) {
    const values = [];

    for (let y = 0; y < N; y += 1) {
      for (let x = 0; x < N; x += 1) values.push(image.data[(by + y) * image.width + bx + x]);
    }
    const mean = values.reduce(function (s, v) { return s + v; }, 0) / values.length;
    let variance = 0;

    values.forEach(function (v) { variance += (v - mean) * (v - mean); });
    return { values: values, mean: mean, variance: variance / (values.length - 1) };
  }

  function windowSsim(x, y, constants) {
    let covariance = 0;

    x.values.forEach(function (value, i) {
      covariance += (value - x.mean) * (y.values[i] - y.mean);
    });
    covariance /= (x.values.length - 1);
    const numerator = (2 * x.mean * y.mean + constants.c1) * (2 * covariance + constants.c2);
    const denominator = (x.mean * x.mean + y.mean * y.mean + constants.c1)
      * (x.variance + y.variance + constants.c2);

    return numerator / denominator;
  }

  /* ------------------------------------------------------ generation loss */

  /**
   * Re-encode the already-decoded image, repeatedly. What happens depends
   * entirely on whether anything moved, and that is the finding.
   *
   * With the SAME quality table and the SAME 8x8 grid, the second encode is
   * free: every coefficient is already a multiple of its step, so it quantises
   * to itself and the image reaches a fixed point after one round. Generation
   * loss is not automatic.
   *
   * Shift the grid by a few pixels — which is what a crop, a resize or a
   * different encoder's block alignment does — and each round quantises
   * coefficients that no longer sit on the grid, so the damage keeps
   * accumulating. The `shift` option runs exactly that, and the two columns
   * together say what actually destroys a re-saved image.
   */
  function generationLoss(image, options) {
    const settings = options || {};
    const quality = settings.quality === undefined ? 50 : settings.quality;
    const rounds = settings.rounds === undefined ? 6 : settings.rounds;
    const shift = settings.shift === undefined ? 0 : settings.shift;
    const rows = [];
    let current = image;

    for (let round = 1; round <= rounds; round += 1) {
      const offset = shift === 0 ? current : rotateColumns(current, shift * round);
      const decoded = shift === 0
        ? decodeImage(encodeImage(offset, quality))
        : rotateColumns(decodeImage(encodeImage(offset, quality)), -shift * round);
      const against = psnr(image, decoded);

      rows.push({ round: round, db: against.db, mse: against.mse,
        ssim: ssim(image, decoded), changed: countChanged(current, decoded) });
      current = decoded;
    }
    return rows;
  }

  /** Roll the image horizontally, which moves the content relative to the 8x8
   *  block grid without changing a single pixel value. */
  function rotateColumns(image, by) {
    const width = image.width;
    const shift = ((by % width) + width) % width;
    const data = new Array(image.data.length).fill(0);

    for (let y = 0; y < image.height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        data[y * width + ((x + shift) % width)] = image.data[y * width + x];
      }
    }
    return { data: data, width: width, height: image.height };
  }

  function countChanged(a, b) {
    let changed = 0;

    for (let i = 0; i < a.data.length; i += 1) {
      if (a.data[i] !== b.data[i]) changed += 1;
    }
    return changed;
  }

  /** A quality sweep, which is the rate–distortion curve of this codec. */
  function qualitySweep(image, qualities) {
    return qualities.map(function (quality) {
      const encoded = encodeImage(image, quality);
      const decoded = decodeImage(encoded);
      const measured = psnr(image, decoded);

      return { quality: quality, bits: encoded.bits,
        bytes: Math.ceil(encoded.bits / 8), nonZero: encoded.nonZero,
        coefficients: encoded.totalCoefficients,
        db: measured.db, mse: measured.mse, ssim: ssim(image, decoded),
        ratio: (image.data.length) / Math.max(1, Math.ceil(encoded.bits / 8)) };
    });
  }

  /* ------------------------------------------------------------- images */

  /** A deterministic test image: smooth gradients, a hard edge and some fine
   *  texture, so the three things a block transform handles differently are all
   *  present. */
  function testImage(width, height) {
    const data = new Array(width * height).fill(0);

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        data[y * width + x] = pixelAt(x, y, width, height);
      }
    }
    return { data: data, width: width, height: height };
  }

  function pixelAt(x, y, width, height) {
    const gradient = 40 + 160 * (x / width);
    const disc = Math.hypot(x - width * 0.65, y - height * 0.35) < Math.min(width, height) * 0.2;
    const texture = ((x >> 1) + (y >> 1)) % 2 === 0 ? 18 : -18;
    const inTexture = y > height * 0.7;

    if (disc) return 220;
    return Math.max(0, Math.min(255, Math.round(gradient + (inTexture ? texture : 0))));
  }

  return {
    N: N, LUMINANCE: LUMINANCE, ZIGZAG: ZIGZAG,
    dct: dct, idct: idct, quantTable: quantTable, quantise: quantise, dequantise: dequantise,
    encodeBlock: encodeBlock, decodeBlock: decodeBlock,
    encodeImage: encodeImage, decodeImage: decodeImage, estimateBits: estimateBits,
    psnr: psnr, ssim: ssim, generationLoss: generationLoss, qualitySweep: qualitySweep,
    rotateColumns: rotateColumns,
    testImage: testImage
  };
}));

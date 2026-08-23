/**
 * The fast Fourier transform, the number-theoretic transform, and the
 * sampling facts that make aliasing a data-engineering problem rather than an
 * audio curiosity.
 *
 * The FFT is one observation applied recursively: a transform of length n
 * splits into two transforms of length n/2 over the even and odd samples,
 * because the twiddle factors of the halves are the same numbers reused.
 * n log n instead of n², and the whole of it is that reuse.
 *
 * Two things here are worth having beside the transform itself.
 *
 * The **number-theoretic transform** does the same job in modular arithmetic
 * with a root of unity chosen from a prime field, so there is no rounding at
 * all. Convolving two integer sequences with a floating-point FFT gives an
 * answer that has to be rounded and can be wrong when the values are large;
 * the NTT gives the exact integers. That is why it, not the FFT, is what a
 * competitive-programming polynomial multiplication uses.
 *
 * And **aliasing**: a component above half the sampling rate does not
 * disappear, it reappears at a lower frequency and is then indistinguishable
 * from a real one. `aliasOf` computes where it lands. The dashboard version of
 * this is a metric sampled every five minutes showing a phantom daily cycle,
 * and the fix is the same as in audio - filter before you sample, because
 * afterwards the information is gone.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Fft = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  /* ---------------------------------------------------------------- DFT */

  /** The definition, O(n²), kept as the oracle the FFT is checked against. */
  function naiveDft(re, im) {
    const n = re.length;
    const outRe = new Float64Array(n);
    const outIm = new Float64Array(n);

    for (let k = 0; k < n; k += 1) {
      let sumRe = 0;
      let sumIm = 0;
      for (let t = 0; t < n; t += 1) {
        const angle = -2 * Math.PI * k * t / n;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        sumRe += re[t] * cos - (im ? im[t] : 0) * sin;
        sumIm += re[t] * sin + (im ? im[t] : 0) * cos;
      }
      outRe[k] = sumRe;
      outIm[k] = sumIm;
    }
    return { re: outRe, im: outIm, operations: n * n };
  }

  /**
   * Bit-reversal permutation. The recursive split by even and odd index means
   * the sample that ends in position k started at the position whose index is
   * k with its bits reversed - so an iterative FFT permutes once at the start
   * and then works entirely in place.
   */
  function bitReverse(re, im) {
    const n = re.length;
    const bits = Math.log2(n);
    let swaps = 0;

    for (let i = 0; i < n; i += 1) {
      const j = reverseBits(i, bits);
      if (j <= i) continue;
      const tr = re[i]; re[i] = re[j]; re[j] = tr;
      const ti = im[i]; im[i] = im[j]; im[j] = ti;
      swaps += 1;
    }
    return swaps;
  }

  function reverseBits(value, bits) {
    let out = 0;
    for (let i = 0; i < bits; i += 1) out = (out << 1) | ((value >>> i) & 1);
    return out >>> 0;
  }

  /**
   * Iterative radix-2 Cooley-Tukey. After the bit-reversal permutation the
   * butterflies proceed in stages of doubling width, each combining a pair
   * that is already transformed. `butterflies` counts them and comes out at
   * exactly (n/2)·log₂n, which is the whole cost.
   */
  function fft(input, options) {
    const settings = options || {};
    const inverse = !!settings.inverse;
    const n = input.re.length;
    if ((n & (n - 1)) !== 0) throw new Error('radix-2 FFT needs a power-of-two length: got ' + n);

    const re = Float64Array.from(input.re);
    const im = input.im ? Float64Array.from(input.im) : new Float64Array(n);
    const swaps = bitReverse(re, im);
    let butterflies = 0;

    for (let width = 2; width <= n; width *= 2) {
      const angle = (inverse ? 2 : -2) * Math.PI / width;
      const stepRe = Math.cos(angle);
      const stepIm = Math.sin(angle);

      for (let start = 0; start < n; start += width) {
        butterflies += stageBlock(re, im, { start: start, width: width,
          stepRe: stepRe, stepIm: stepIm });
      }
    }
    if (inverse) {
      for (let i = 0; i < n; i += 1) { re[i] /= n; im[i] /= n; }
    }
    return { re: re, im: im, butterflies: butterflies, swaps: swaps,
      operations: butterflies, expected: (n / 2) * Math.log2(n) };
  }

  function stageBlock(re, im, block) {
    let wRe = 1;
    let wIm = 0;
    const half = block.width / 2;
    let count = 0;

    for (let k = 0; k < half; k += 1) {
      const top = block.start + k;
      const bottom = top + half;
      const tRe = wRe * re[bottom] - wIm * im[bottom];
      const tIm = wRe * im[bottom] + wIm * re[bottom];

      re[bottom] = re[top] - tRe;
      im[bottom] = im[top] - tIm;
      re[top] += tRe;
      im[top] += tIm;

      const nextRe = wRe * block.stepRe - wIm * block.stepIm;
      wIm = wRe * block.stepIm + wIm * block.stepRe;
      wRe = nextRe;
      count += 1;
    }
    return count;
  }

  /** Magnitudes, which is what a spectrum plot actually shows. */
  function magnitudes(spectrum) {
    const out = new Float64Array(spectrum.re.length);
    for (let i = 0; i < out.length; i += 1) {
      out[i] = Math.hypot(spectrum.re[i], spectrum.im[i]);
    }
    return out;
  }

  /* --------------------------------------------------------- convolution */

  /**
   * Convolution by FFT: transform both, multiply pointwise, transform back.
   * The length must be padded to a power of two at least as long as the sum of
   * the inputs, or the result wraps around - circular convolution is what the
   * transform actually computes, and linear convolution is circular
   * convolution with enough zeros that the wrap has nothing to carry.
   */
  function convolve(a, b) {
    const needed = a.length + b.length - 1;
    let size = 1;
    while (size < needed) size *= 2;

    const left = fft({ re: padded(a, size) });
    const right = fft({ re: padded(b, size) });
    const productRe = new Float64Array(size);
    const productIm = new Float64Array(size);

    for (let i = 0; i < size; i += 1) {
      productRe[i] = left.re[i] * right.re[i] - left.im[i] * right.im[i];
      productIm[i] = left.re[i] * right.im[i] + left.im[i] * right.re[i];
    }
    const back = fft({ re: productRe, im: productIm }, { inverse: true });
    return { values: Array.from(back.re.slice(0, needed)), size: size,
      butterflies: left.butterflies * 3 };
  }

  function padded(values, size) {
    const out = new Float64Array(size);
    for (let i = 0; i < values.length; i += 1) out[i] = values[i];
    return out;
  }

  /** The schoolbook convolution, as the oracle. */
  function convolveNaive(a, b) {
    const out = new Array(a.length + b.length - 1).fill(0);
    let operations = 0;
    for (let i = 0; i < a.length; i += 1) {
      for (let j = 0; j < b.length; j += 1) { out[i + j] += a[i] * b[j]; operations += 1; }
    }
    return { values: out, operations: operations };
  }

  /* ---------------------------------------------------------------- NTT */

  /* A prime of the form c·2^k + 1 with a known primitive root, so a power-of-
     two root of unity exists in the field. 998244353 = 119·2²³ + 1 is the one
     every competitive programmer has memorised, and its root is 3. */
  const NTT_MOD = 998244353n;
  const NTT_ROOT = 3n;

  function modPow(base, exponent, modulus) {
    let result = 1n;
    let b = base % modulus;
    let e = exponent;
    while (e > 0n) {
      if ((e & 1n) === 1n) result = (result * b) % modulus;
      b = (b * b) % modulus;
      e >>= 1n;
    }
    return result;
  }

  /**
   * The number-theoretic transform: the same butterflies with the complex root
   * of unity replaced by a root of unity in a prime field. No rounding
   * anywhere, so an integer convolution comes back exactly rather than
   * needing to be rounded and hoped over.
   */
  function ntt(values, inverse) {
    const n = values.length;
    if ((n & (n - 1)) !== 0) throw new Error('NTT needs a power-of-two length: got ' + n);
    const out = values.map(function (v) { return ((BigInt(v) % NTT_MOD) + NTT_MOD) % NTT_MOD; });

    reverseInPlace(out);
    for (let width = 2; width <= n; width *= 2) {
      const step = rootFor(width, inverse);
      for (let start = 0; start < n; start += width) nttBlock(out, start, width, step);
    }
    if (!inverse) return out;

    const scale = modPow(BigInt(n), NTT_MOD - 2n, NTT_MOD);
    return out.map(function (v) { return (v * scale) % NTT_MOD; });
  }

  function rootFor(width, inverse) {
    const exponent = (NTT_MOD - 1n) / BigInt(width);
    const w = modPow(NTT_ROOT, exponent, NTT_MOD);
    return inverse ? modPow(w, NTT_MOD - 2n, NTT_MOD) : w;
  }

  function reverseInPlace(values) {
    const n = values.length;
    const bits = Math.log2(n);
    for (let i = 0; i < n; i += 1) {
      const j = reverseBits(i, bits);
      if (j <= i) continue;
      const tmp = values[i]; values[i] = values[j]; values[j] = tmp;
    }
  }

  function nttBlock(values, start, width, step) {
    let w = 1n;
    const half = width / 2;
    for (let k = 0; k < half; k += 1) {
      const top = start + k;
      const bottom = top + half;
      const t = (w * values[bottom]) % NTT_MOD;
      values[bottom] = (values[top] - t + NTT_MOD) % NTT_MOD;
      values[top] = (values[top] + t) % NTT_MOD;
      w = (w * step) % NTT_MOD;
    }
  }

  /**
   * The bound the NTT is exact under, which is the caveat every "the NTT has
   * no rounding error" claim needs. It has no rounding error and it works
   * modulo p, so the integer answer is recovered only when every coefficient
   * of the product is below p. The largest coefficient of a convolution is at
   * most (max a)·(max b)·min(len a, len b), and past 998 244 353 the answer
   * comes back wrapped - correct in the field, and not the integer that was
   * wanted. The escape is several primes and the Chinese remainder theorem,
   * which is M17.8's machinery reused here.
   */
  function exactBound(a, b) {
    const maxA = a.reduce(function (worst, v) { return Math.max(worst, Math.abs(v)); }, 0);
    const maxB = b.reduce(function (worst, v) { return Math.max(worst, Math.abs(v)); }, 0);
    const largest = maxA * maxB * Math.min(a.length, b.length);
    return {
      largestPossible: largest,
      modulus: Number(NTT_MOD),
      fits: largest < Number(NTT_MOD),
      headroom: Number(NTT_MOD) / Math.max(1, largest)
    };
  }

  /** Exact integer convolution through the NTT, valid while `exactBound` says
   *  the coefficients fit. */
  function convolveExact(a, b) {
    const needed = a.length + b.length - 1;
    let size = 1;
    while (size < needed) size *= 2;

    const left = ntt(padArray(a, size), false);
    const right = ntt(padArray(b, size), false);
    const product = left.map(function (v, i) { return (v * right[i]) % NTT_MOD; });
    const back = ntt(product, true);
    return back.slice(0, needed).map(function (v) { return v; });
  }

  function padArray(values, size) {
    const out = new Array(size).fill(0);
    for (let i = 0; i < values.length; i += 1) out[i] = values[i];
    return out;
  }

  /* ------------------------------------------------------------ windows */

  /**
   * Windows. A finite sample of a sine whose period does not divide the window
   * has a discontinuity at the wrap, and the transform sees that discontinuity
   * as energy at every frequency - which is spectral leakage. Tapering the
   * ends to zero removes the discontinuity and trades a wider main lobe for
   * far lower sidelobes.
   */
  const WINDOWS = [
    { id: 'rectangular', label: 'rectangular (no window)',
      at: function () { return 1; } },
    { id: 'hann', label: 'Hann',
      at: function (i, n) { return 0.5 * (1 - Math.cos(2 * Math.PI * i / (n - 1))); } },
    { id: 'hamming', label: 'Hamming',
      at: function (i, n) { return 0.54 - 0.46 * Math.cos(2 * Math.PI * i / (n - 1)); } },
    { id: 'blackman', label: 'Blackman',
      at: function (i, n) {
        const angle = 2 * Math.PI * i / (n - 1);
        return 0.42 - 0.5 * Math.cos(angle) + 0.08 * Math.cos(2 * angle);
      } }
  ];

  function windowFor(id) {
    for (let i = 0; i < WINDOWS.length; i += 1) {
      if (WINDOWS[i].id === id) return WINDOWS[i];
    }
    return WINDOWS[0];
  }

  function applyWindow(values, id) {
    const window = windowFor(id);
    const n = values.length;
    const out = new Float64Array(n);
    for (let i = 0; i < n; i += 1) out[i] = values[i] * window.at(i, n);
    return out;
  }

  /* ---------------------------------------------------------- sampling */

  /**
   * Where a frequency above the Nyquist limit reappears. The component is not
   * removed and it is not attenuated - it is folded back, and after sampling
   * there is no way to tell it from a genuine component at the folded
   * frequency. That irreversibility is why the filter has to come first.
   */
  function aliasOf(frequency, sampleRate) {
    const nyquist = sampleRate / 2;
    const folded = Math.abs(((frequency + nyquist) % sampleRate + sampleRate) % sampleRate - nyquist);
    return { frequency: frequency, sampleRate: sampleRate, nyquist: nyquist,
      apparent: folded, aliased: folded !== frequency };
  }

  /** Build a signal from named components, so a demo can add one above the
   *  Nyquist limit and watch it appear somewhere else. */
  function synthesise(components, samples, sampleRate) {
    const out = new Float64Array(samples);
    for (let i = 0; i < samples; i += 1) {
      const t = i / sampleRate;
      let value = 0;
      components.forEach(function (component) {
        value += component.amplitude *
          Math.sin(2 * Math.PI * component.frequency * t + (component.phase || 0));
      });
      out[i] = value;
    }
    return out;
  }

  /** The frequency each spectrum bin corresponds to. */
  function binFrequencies(size, sampleRate) {
    const out = new Float64Array(size / 2);
    for (let i = 0; i < out.length; i += 1) out[i] = i * sampleRate / size;
    return out;
  }

  return {
    NTT_MOD: NTT_MOD,
    NTT_ROOT: NTT_ROOT,
    WINDOWS: WINDOWS,
    naiveDft: naiveDft,
    fft: fft,
    bitReverse: bitReverse,
    reverseBits: reverseBits,
    magnitudes: magnitudes,
    convolve: convolve,
    convolveNaive: convolveNaive,
    ntt: ntt,
    convolveExact: convolveExact,
    exactBound: exactBound,
    modPow: modPow,
    windowFor: windowFor,
    applyWindow: applyWindow,
    aliasOf: aliasOf,
    synthesise: synthesise,
    binFrequencies: binFrequencies
  };
}));

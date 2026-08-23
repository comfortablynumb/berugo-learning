/**
 * Pseudorandom generators, the tests that separate them, and the two places a
 * correct generator is ruined by the code that consumes it.
 *
 * A PRNG is a deterministic function iterated on a state. "Random" means only
 * that the output passes the statistical tests somebody cares about, so the
 * question is never whether a generator is random - it is not - but which
 * structure it leaves behind and whether that structure matters for the use.
 * The classic demonstration is in this file: RANDU, shipped by IBM for a
 * decade, produces triples that all lie on fifteen planes in three dimensions.
 * Its one-dimensional distribution is fine. It is the *pairs* and *triples*
 * that give it away, which is why the demo plots consecutive outputs against
 * each other rather than histogramming them.
 *
 * Every generator reports `outputRange` and `nextRaw`, and nothing in the file
 * silently rescales one range into another. That rule exists because breaking
 * it manufactures results: an early version scaled RANDU's 31-bit state into
 * 32 bits, which multiplies every output by two, which pins the lowest bit to
 * zero - and the resulting "RANDU fails a one-dimensional test" was an artefact
 * of the scaling, not a property of RANDU. Narrowing is explicit instead, and
 * `sourceOf` says which end of the word it takes, because for a
 * power-of-two-modulus LCG the two ends have genuinely different quality: the
 * low bit of such a generator has a period of two.
 *
 * The two consumer-side mistakes are here with their unbiased fixes:
 *
 * - `bounded(n)` by `%` is biased whenever n does not divide the source range,
 *   and the bias is largest exactly when n is a large fraction of that range.
 *   Rejection removes it for an occasional extra draw; Lemire's
 *   multiply-and-check does the same with one multiplication.
 * - a shuffle that picks its swap partner from the whole array rather than
 *   from the unvisited suffix has n^n equally likely execution paths for n!
 *   outcomes, and n! does not divide n^n, so the result cannot be uniform. On
 *   three elements the bias is large enough to read off a table.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Prng = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const TWO32 = 4294967296;
  const MASK64 = 0xffffffffffffffffn;

  /* ------------------------------------------------------------------ LCG */

  /**
   * x -> (a*x + c) mod m. The whole family, and worth knowing because it is
   * three arithmetic operations and its failure mode is completely understood:
   * the outputs taken k at a time lie on a lattice of at most (k! * m)^(1/k)
   * hyperplanes. A good multiplier makes that lattice fine. RANDU's makes it
   * fifteen planes in three dimensions.
   */
  const LCG_FAMILIES = [
    { id: 'randu', label: 'RANDU (IBM, notoriously bad)', a: 65539, c: 0, m: 2147483648 },
    { id: 'minstd', label: 'MINSTD (Park-Miller, 1988)', a: 16807, c: 0, m: 2147483647 },
    { id: 'minstd-improved', label: 'MINSTD, 1993 multiplier', a: 48271, c: 0, m: 2147483647 },
    { id: 'numerical-recipes', label: 'Numerical Recipes LCG', a: 1664525, c: 1013904223,
      m: 4294967296 },
    { id: 'tiny', label: 'a deliberately tiny LCG', a: 137, c: 187, m: 256 }
  ];

  function lcg(family, seed) {
    let state = ((seed % family.m) + family.m) % family.m || 1;
    return {
      id: family.id,
      label: family.label,
      stateBits: Math.round(Math.log2(family.m)),
      outputRange: family.m,
      period: family.m,
      nextRaw: function () {
        state = (family.a * state + family.c) % family.m;
        return state;
      },
      raw: function () { return state; }
    };
  }

  /* -------------------------------------------------------------- xorshift */

  function xorshift32(seed) {
    let state = (seed >>> 0) || 2463534242;
    return {
      id: 'xorshift32', label: 'xorshift32 (Marsaglia)', stateBits: 32,
      outputRange: TWO32, period: TWO32 - 1,
      nextRaw: function () {
        state ^= state << 13; state >>>= 0;
        state ^= state >>> 17;
        state ^= state << 5; state >>>= 0;
        return state >>> 0;
      }
    };
  }

  function xorshift128(seed) {
    const s = new Uint32Array(4);
    let x = (seed >>> 0) || 1;
    for (let i = 0; i < 4; i += 1) {
      x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0;
      s[i] = x;
    }
    return {
      id: 'xorshift128', label: 'xorshift128', stateBits: 128,
      outputRange: TWO32, period: Math.pow(2, 128) - 1,
      nextRaw: function () {
        let t = s[3];
        const w = s[0];
        s[3] = s[2]; s[2] = s[1]; s[1] = w;
        t ^= t << 11; t >>>= 0;
        t ^= t >>> 8;
        s[0] = (t ^ w ^ (w >>> 19)) >>> 0;
        return s[0] >>> 0;
      }
    };
  }

  /* ------------------------------------------------------------- splitmix */

  /**
   * splitmix64 is a counter run through a strong mixing function rather than a
   * recurrence. The full period is free - it is a counter - and every bit of
   * the quality comes from the finaliser, which is why it is the standard way
   * to seed everything else: one 64-bit seed expands into as many
   * independent-looking words as another generator's state needs.
   */
  function splitmix64(seed) {
    let state = BigInt.asUintN(64, BigInt(seed));
    const GAMMA = 0x9e3779b97f4a7c15n;

    function nextBig() {
      state = (state + GAMMA) & MASK64;
      let z = state;
      z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & MASK64;
      z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & MASK64;
      return (z ^ (z >> 31n)) & MASK64;
    }

    return {
      id: 'splitmix64', label: 'splitmix64', stateBits: 64,
      outputRange: TWO32, period: Math.pow(2, 64),
      nextBig: nextBig,
      nextRaw: function () { return Number(nextBig() >> 32n) >>> 0; }
    };
  }

  /**
   * PCG: an LCG whose *output* is permuted by a data-dependent rotation. The
   * state transition is the same lattice-ridden recurrence RANDU has; what
   * fixes it is refusing to hand the state out directly. That separation - a
   * weak, fast state function and a strong output function - is the design
   * idea worth taking away, and it is also why PCG's low bits are as good as
   * its high ones while an LCG's are not.
   */
  function pcg32(seed, sequence) {
    const MULTIPLIER = 6364136223846793005n;
    const chosen = BigInt.asUintN(64, BigInt(sequence === undefined ? 1 : sequence));
    const increment = ((chosen << 1n) | 1n) & MASK64;
    let state = 0n;

    function step() { state = (state * MULTIPLIER + increment) & MASK64; }
    step();
    state = (state + BigInt.asUintN(64, BigInt(seed))) & MASK64;
    step();

    return {
      id: 'pcg32', label: 'PCG32 (O’Neill)', stateBits: 64,
      outputRange: TWO32, period: Math.pow(2, 64),
      nextRaw: function () {
        const previous = state;
        step();
        const xorshifted = Number((((previous >> 18n) ^ previous) >> 27n) & 0xffffffffn) >>> 0;
        const rot = Number(previous >> 59n);
        return ((xorshifted >>> rot) | (xorshifted << ((-rot) & 31))) >>> 0;
      }
    };
  }

  /* ------------------------------------------------------- Mersenne twister */

  /**
   * MT19937. Period 2^19937 - 1 on 2 496 bytes of state, which is the trade:
   * an enormous period, an enormous cache footprint, and failure on the
   * linear-complexity tests in TestU01 because the recurrence is linear over
   * GF(2). It is also slow to seed, which matters when a program makes many
   * generators - part of why splitmix and PCG are the modern default.
   */
  function mersenneTwister(seed) {
    const N = 624;
    const state = new Uint32Array(N);
    let index = N;
    state[0] = seed >>> 0;
    for (let i = 1; i < N; i += 1) {
      const previous = state[i - 1] ^ (state[i - 1] >>> 30);
      state[i] = (Math.imul(1812433253, previous) + i) >>> 0;
    }

    function twist() {
      for (let i = 0; i < N; i += 1) {
        const combined = ((state[i] & 0x80000000) | (state[(i + 1) % N] & 0x7fffffff)) >>> 0;
        let next = (combined >>> 1) ^ state[(i + 397) % N];
        if ((combined & 1) !== 0) next ^= 0x9908b0df;
        state[i] = next >>> 0;
      }
      index = 0;
    }

    return {
      id: 'mt19937', label: 'Mersenne Twister (MT19937)', stateBits: 19937,
      outputRange: TWO32, period: Infinity, stateBytes: N * 4,
      nextRaw: function () {
        if (index >= N) twist();
        let y = state[index];
        index += 1;
        y ^= y >>> 11;
        y = (y ^ ((y << 7) & 0x9d2c5680)) >>> 0;
        y = (y ^ ((y << 15) & 0xefc60000)) >>> 0;
        return (y ^ (y >>> 18)) >>> 0;
      }
    };
  }

  const GENERATORS = [
    { id: 'randu', build: function (seed) { return lcg(LCG_FAMILIES[0], seed); } },
    { id: 'minstd', build: function (seed) { return lcg(LCG_FAMILIES[1], seed); } },
    { id: 'minstd-improved', build: function (seed) { return lcg(LCG_FAMILIES[2], seed); } },
    { id: 'numerical-recipes', build: function (seed) { return lcg(LCG_FAMILIES[3], seed); } },
    { id: 'xorshift32', build: xorshift32 },
    { id: 'xorshift128', build: xorshift128 },
    { id: 'splitmix64', build: splitmix64 },
    { id: 'pcg32', build: function (seed) { return pcg32(seed, 1); } },
    { id: 'mt19937', build: mersenneTwister }
  ];

  function build(id, seed) {
    for (let i = 0; i < GENERATORS.length; i += 1) {
      if (GENERATORS[i].id === id) return GENERATORS[i].build(seed);
    }
    return pcg32(seed, 1);
  }

  /* ---------------------------------------------------- bounded sampling */

  /**
   * A source of raw values in [0, 2^bits). `part` chooses which end of the
   * generator's word the bits come from, and for an LCG with a power-of-two
   * modulus the answer matters enormously: bit k of such a generator has a
   * period of 2^(k+1), so the low four bits repeat every sixteen draws while
   * the high bits look fine.
   *
   * Narrowing is also what makes modulo bias visible. At a range of 2^32 the
   * bias for any n a program would use is far below the sampling noise; at a
   * range of 256 with n = 200 it is a factor of two.
   */
  function sourceOf(generator, bits, part) {
    const width = bits === undefined ? 32 : bits;
    const range = Math.pow(2, width);
    const usingLow = part === 'low';
    return {
      range: range,
      bits: width,
      part: usingLow ? 'low' : 'high',
      label: generator.label,
      next: function () {
        const raw = generator.nextRaw();
        if (range >= generator.outputRange) return raw;
        return usingLow ? raw % range : Math.floor((raw / generator.outputRange) * range);
      }
    };
  }

  /** The biased one. Kept because it is what everybody writes. */
  function boundedModulo(source, n) {
    return { value: source.next() % n, draws: 1 };
  }

  /**
   * Rejection: discard the top of the range that does not divide evenly, so
   * every remaining value maps to exactly one output. The expected number of
   * draws is range / (range - range mod n), which is barely above one for any
   * sane n and unbounded in the worst case - a real trade, honestly stated.
   */
  function boundedRejection(source, n) {
    const limit = source.range - (source.range % n);
    let draws = 0;
    for (;;) {
      const value = source.next();
      draws += 1;
      if (value < limit) return { value: value % n, draws: draws };
    }
  }

  /**
   * Lemire's method: multiply into a double-width product and take the high
   * half, which is uniform except for one narrow window; the rejection test
   * looks at the low half and almost never fires. One multiplication, no
   * division, and exactly the same uniformity as rejection.
   */
  function boundedLemire(source, n) {
    let draws = 0;
    const threshold = (source.range - n) % n;
    for (;;) {
      const value = source.next();
      draws += 1;
      const product = value * n;
      if (product % source.range >= threshold) {
        return { value: Math.floor(product / source.range), draws: draws };
      }
    }
  }

  const BOUNDED_METHODS = [
    { id: 'modulo', label: 'value % n (biased)', run: boundedModulo },
    { id: 'rejection', label: 'rejection', run: boundedRejection },
    { id: 'lemire', label: 'Lemire multiply-and-check', run: boundedLemire }
  ];

  /**
   * How unequal the modulo map is, exactly, with no sampling involved.
   * `range mod n` of the outputs get one extra source value each, so their
   * probability is (floor(range/n) + 1)/range against floor(range/n)/range.
   */
  function moduloBias(range, n) {
    const low = Math.floor(range / n);
    const extra = range % n;
    return {
      range: range, n: n, favoured: extra, high: extra === 0 ? low : low + 1, low: low,
      ratio: extra === 0 ? 1 : (low + 1) / low
    };
  }

  /* ------------------------------------------------------------ shuffling */

  /** Fisher-Yates: swap position i with a uniform choice from 0 through i. */
  function fisherYates(values, source) {
    const out = values.slice();
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = boundedRejection(source, i + 1).value;
      const t = out[i]; out[i] = out[j]; out[j] = t;
    }
    return out;
  }

  /** The one that looks the same and is not: the partner is drawn from the
   *  whole array, so the path count is n^n and n! does not divide it. */
  function naiveShuffle(values, source) {
    const out = values.slice();
    for (let i = 0; i < out.length; i += 1) {
      const j = boundedRejection(source, out.length).value;
      const t = out[i]; out[i] = out[j]; out[j] = t;
    }
    return out;
  }

  /** Every permutation of a short array, counted over many shuffles. n! rows,
   *  and the spread across them is the bias. */
  function permutationCounts(size, options) {
    const values = [];
    for (let i = 0; i < size; i += 1) values.push(i);
    const shuffle = options.naive ? naiveShuffle : fisherYates;
    const counts = new Map();

    for (let trial = 0; trial < options.trials; trial += 1) {
      const key = shuffle(values, options.source).join('');
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    const rows = Array.from(counts.entries()).map(function (entry) {
      return { permutation: entry[0], count: entry[1] };
    });
    rows.sort(function (a, b) { return a.permutation < b.permutation ? -1 : 1; });
    return rows;
  }

  /* ------------------------------------------------------------ measuring */

  function chiSquared(counts, expected) {
    let total = 0;
    for (let i = 0; i < counts.length; i += 1) {
      const difference = counts[i] - expected;
      total += (difference * difference) / expected;
    }
    return { statistic: total, degrees: counts.length - 1 };
  }

  /** A percentile of a chi-squared distribution, by the Wilson-Hilferty
   *  transformation, so a verdict is a comparison against a stated threshold
   *  rather than an eyeballed table. `z` is the standard-normal deviate: the
   *  95th percentile at +1.645, the 5th at -1.645. */
  function chiSquaredPercentile(degrees, z) {
    const term = 2 / (9 * degrees);
    return degrees * Math.pow(1 - term + z * Math.sqrt(term), 3);
  }

  function criticalValue(degrees) {
    return chiSquaredPercentile(degrees, 1.6448536269514722);
  }

  function lowerCriticalValue(degrees) {
    return chiSquaredPercentile(degrees, -1.6448536269514722);
  }

  function bucketCounts(source, options) {
    const buckets = new Array(options.buckets).fill(0);
    const method = options.method || boundedRejection;
    let draws = 0;
    for (let i = 0; i < options.samples; i += 1) {
      const drawn = method(source, options.buckets);
      buckets[drawn.value] += 1;
      draws += drawn.draws;
    }
    return { buckets: buckets, draws: draws, samples: options.samples };
  }

  /**
   * A chi-squared verdict with BOTH tails, because only one of them is about
   * randomness. A statistic above the 95th percentile means the counts are
   * more uneven than chance allows - the failure everybody tests for. A
   * statistic below the 5th percentile means they are more EVEN than chance
   * allows, which is not a pass: a full-period generator that sweeps every
   * value exactly once produces counts that are impossibly regular, and RANDU
   * scores 0.1 where 63 is expected. Reporting that as "passes" is how a
   * histogram test certifies a counter.
   */
  function uniformityVerdict(counts, samples) {
    const chi = chiSquared(counts, samples / counts.length);
    const critical = criticalValue(chi.degrees);
    const lower = lowerCriticalValue(chi.degrees);
    const tooEven = chi.statistic < lower;
    return {
      statistic: chi.statistic, degrees: chi.degrees,
      critical: critical, lowerCritical: lower,
      passes: chi.statistic <= critical && !tooEven,
      tooEven: tooEven,
      verdict: chi.statistic > critical ? 'uneven' : (tooEven ? 'too even' : 'plausible')
    };
  }

  /**
   * How often each bit position comes up set. A generator whose low bits are
   * weak shows up here as a column that is not at one half - and for a
   * power-of-two-modulus LCG bit 0 is stuck at a single value forever.
   */
  function bitFrequencies(generator, samples) {
    const width = Math.round(Math.log2(generator.outputRange));
    const counts = new Array(width).fill(0);
    for (let i = 0; i < samples; i += 1) {
      const value = generator.nextRaw();
      for (let bit = 0; bit < width; bit += 1) {
        counts[bit] += Math.floor(value / Math.pow(2, bit)) % 2;
      }
    }
    return counts.map(function (count) { return count / samples; });
  }

  /** The period of bit k, measured by walking it until it repeats. */
  function bitPeriod(generator, bit, budget) {
    const values = [];
    for (let i = 0; i < budget; i += 1) {
      values.push(Math.floor(generator.nextRaw() / Math.pow(2, bit)) % 2);
    }
    for (let period = 1; period <= budget / 2; period += 1) {
      let matches = true;
      for (let i = 0; i + period < values.length && matches; i += 1) {
        if (values[i] !== values[i + period]) matches = false;
      }
      if (matches) return period;
    }
    return null;
  }

  function unitValue(generator) { return generator.nextRaw() / generator.outputRange; }

  /** Consecutive outputs as points, which is where a lattice becomes visible. */
  function pairs(generator, count) {
    const out = [];
    let previous = unitValue(generator);
    for (let i = 0; i < count; i += 1) {
      const current = unitValue(generator);
      out.push({ x: previous, y: current });
      previous = current;
    }
    return out;
  }

  function triples(generator, count) {
    const out = [];
    let a = unitValue(generator);
    let b = unitValue(generator);
    for (let i = 0; i < count; i += 1) {
      const c = unitValue(generator);
      out.push({ x: a, y: b, z: c });
      a = b; b = c;
    }
    return out;
  }

  /**
   * RANDU's identity: x[n+2] = 6*x[n+1] - 9*x[n], exactly, modulo 2^31. That
   * linear relation is why the triples lie on planes, and it is checkable
   * rather than quotable - the residual is zero for every consecutive triple.
   */
  function lcgPlaneResidual(generator, count) {
    const m = generator.outputRange;
    let a = generator.nextRaw();
    let b = generator.nextRaw();
    let worst = 0;
    for (let i = 0; i < count; i += 1) {
      const c = generator.nextRaw();
      const residual = (((6 * b - 9 * a) % m) + m) % m;
      worst = Math.max(worst, Math.abs(residual - c));
      a = b; b = c;
    }
    return { worstResidual: worst, holds: worst === 0, samples: count };
  }

  /** For a small-state generator the period can simply be walked. */
  function measurePeriod(generator, budget) {
    const seen = new Map();
    const read = generator.raw
      ? function () { const value = generator.raw(); generator.nextRaw(); return value; }
      : function () { return generator.nextRaw(); };

    for (let i = 0; i < budget; i += 1) {
      const value = read();
      if (seen.has(value)) return { period: i - seen.get(value), found: true, steps: i };
      seen.set(value, i);
    }
    return { period: null, found: false, steps: budget };
  }

  /* -------------------------------------------------------- distributions */

  /** Box-Muller. Two uniforms in, two normals out; the log needs a strictly
   *  positive input, which is why the draw is shifted off zero. */
  function gaussianPair(generator) {
    const u1 = (generator.nextRaw() + 1) / (generator.outputRange + 1);
    const u2 = unitValue(generator);
    const radius = Math.sqrt(-2 * Math.log(u1));
    return { a: radius * Math.cos(2 * Math.PI * u2), b: radius * Math.sin(2 * Math.PI * u2) };
  }

  function exponential(generator, rate) {
    const u = (generator.nextRaw() + 1) / (generator.outputRange + 1);
    return -Math.log(u) / rate;
  }

  return {
    TWO32: TWO32,
    LCG_FAMILIES: LCG_FAMILIES,
    GENERATORS: GENERATORS,
    BOUNDED_METHODS: BOUNDED_METHODS,
    lcg: lcg,
    xorshift32: xorshift32,
    xorshift128: xorshift128,
    splitmix64: splitmix64,
    pcg32: pcg32,
    mersenneTwister: mersenneTwister,
    build: build,
    sourceOf: sourceOf,
    boundedModulo: boundedModulo,
    boundedRejection: boundedRejection,
    boundedLemire: boundedLemire,
    moduloBias: moduloBias,
    fisherYates: fisherYates,
    naiveShuffle: naiveShuffle,
    permutationCounts: permutationCounts,
    chiSquared: chiSquared,
    criticalValue: criticalValue,
    lowerCriticalValue: lowerCriticalValue,
    chiSquaredPercentile: chiSquaredPercentile,
    bucketCounts: bucketCounts,
    uniformityVerdict: uniformityVerdict,
    bitFrequencies: bitFrequencies,
    bitPeriod: bitPeriod,
    unitValue: unitValue,
    pairs: pairs,
    triples: triples,
    lcgPlaneResidual: lcgPlaneResidual,
    measurePeriod: measurePeriod,
    gaussianPair: gaussianPair,
    exponential: exponential
  };
}));

/**
 * Seeded randomness.
 *
 * Every demo that a learner may run twice and compare uses a seeded generator,
 * so "change one line and run it again" is a controlled experiment rather than
 * two different inputs. `Random.seeded(n)` is mulberry32: small, fast, and good
 * enough for teaching - it is not a CSPRNG and M23 says so explicitly.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Random = api;
}(typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : null), function () {
  'use strict';

  function seeded(seed) {
    let state = (seed >>> 0) || 1;

    function next() {
      state |= 0;
      state = (state + 0x6D2B79F5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    // Unbiased integer in [0, bound) by rejection - the modulo version is
    // biased exactly when bound does not divide 2^32, which M17 measures.
    function int(bound) {
      const limit = Math.floor(bound);
      if (limit <= 0) return 0;
      const threshold = (4294967296 % limit) / 4294967296;
      let value = next();
      while (value < threshold) value = next();
      return Math.floor(value * limit) % limit;
    }

    function range(min, max) {
      return min + int(max - min);
    }

    function pick(list) {
      return list[int(list.length)];
    }

    function shuffle(list) {
      const copy = list.slice();
      for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = int(i + 1);
        const tmp = copy[i];
        copy[i] = copy[j];
        copy[j] = tmp;
      }
      return copy;
    }

    function gaussian(mean, sd) {
      const u = Math.max(next(), Number.MIN_VALUE);
      const v = next();
      const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
      return (mean || 0) + z * (sd === undefined ? 1 : sd);
    }

    function ints(count, bound) {
      const out = new Array(count);
      for (let i = 0; i < count; i += 1) out[i] = int(bound);
      return out;
    }

    return {
      next: next,
      int: int,
      range: range,
      pick: pick,
      shuffle: shuffle,
      gaussian: gaussian,
      ints: ints
    };
  }

  return { seeded: seeded };
}));

/**
 * MatrixBlocking - the access traces of four matrix multiplications, so that
 * each transformation's contribution can be measured separately.
 *
 * The point of doing it as traces rather than as timings is that the miss
 * counts are attributable. A stopwatch tells you the blocked version is
 * faster; the trace tells you it is faster because the B matrix stopped being
 * re-read from memory on every pass, which is the sentence you need in order
 * to know whether the same trick applies to your own loop.
 *
 * The four versions, and what each one fixes:
 *
 *   naive        i, j, k. The inner loop walks a COLUMN of B, so every access
 *                is a different cache line - the worst possible stride.
 *   interchanged i, k, j. The same arithmetic with the loops reordered so the
 *                inner loop walks a ROW of B. One line now serves several
 *                accesses, and nothing about the algorithm changed.
 *   blocked      the same, cut into tiles that fit in the cache, so a tile of
 *                B is re-read from cache rather than from memory.
 *   padded       blocked, with a row of padding so that rows of A, B and C do
 *                not all map to the same sets.
 *
 * The tile-size rule is worth knowing by hand: three tiles of `t` by `t`
 * elements must fit, so 3 * t^2 * elementBytes <= capacity. That gets within
 * a factor of the empirical optimum immediately, which makes this one of the
 * very few optimisations worth calculating before measuring.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.MatrixBlocking = api;
}(this, function () {
  'use strict';

  const DEFAULTS = { n: 32, elementBytes: 8, pad: 0 };

  /** Three matrices laid out one after another, row-major, with an optional
   *  padding of whole elements added to each row's stride. */
  function layout(options) {
    const settings = Object.assign({}, DEFAULTS, options || {});
    const stride = (settings.n + settings.pad) * settings.elementBytes;
    const bytes = settings.n * stride;

    return { n: settings.n, stride: stride, elementBytes: settings.elementBytes,
      pad: settings.pad,
      base: { a: 0, b: bytes, c: 2 * bytes }, bytes: bytes };
  }

  function at(plan, which, row, column) {
    return plan.base[which] + row * plan.stride + column * plan.elementBytes;
  }

  /* ------------------------------------------------------------ the four */

  function naive(options) {
    const plan = layout(options);
    const trace = [];

    for (let i = 0; i < plan.n; i += 1) {
      for (let j = 0; j < plan.n; j += 1) {
        for (let k = 0; k < plan.n; k += 1) {
          trace.push({ address: at(plan, 'a', i, k) });
          trace.push({ address: at(plan, 'b', k, j) });
          trace.push({ address: at(plan, 'c', i, j), write: true });
        }
      }
    }
    return { trace: trace, plan: plan, name: 'naive (i, j, k)' };
  }

  function interchanged(options) {
    const plan = layout(options);
    const trace = [];

    for (let i = 0; i < plan.n; i += 1) {
      for (let k = 0; k < plan.n; k += 1) {
        for (let j = 0; j < plan.n; j += 1) {
          trace.push({ address: at(plan, 'a', i, k) });
          trace.push({ address: at(plan, 'b', k, j) });
          trace.push({ address: at(plan, 'c', i, j), write: true });
        }
      }
    }
    return { trace: trace, plan: plan, name: 'interchanged (i, k, j)' };
  }

  function blocked(options) {
    const settings = options || {};
    const plan = layout(settings);
    const tile = Math.max(1, settings.tile || 8);
    const trace = [];

    for (let ii = 0; ii < plan.n; ii += tile) {
      for (let kk = 0; kk < plan.n; kk += tile) {
        for (let jj = 0; jj < plan.n; jj += tile) {
          tileBody(trace, plan, { ii: ii, kk: kk, jj: jj }, tile);
        }
      }
    }
    return { trace: trace, plan: plan, tile: tile,
      name: 'blocked, tile ' + tile };
  }

  function tileBody(trace, plan, corner, tile) {
    const iEnd = Math.min(corner.ii + tile, plan.n);
    const kEnd = Math.min(corner.kk + tile, plan.n);
    const jEnd = Math.min(corner.jj + tile, plan.n);

    for (let i = corner.ii; i < iEnd; i += 1) {
      for (let k = corner.kk; k < kEnd; k += 1) {
        for (let j = corner.jj; j < jEnd; j += 1) {
          trace.push({ address: at(plan, 'a', i, k) });
          trace.push({ address: at(plan, 'b', k, j) });
          trace.push({ address: at(plan, 'c', i, j), write: true });
        }
      }
    }
  }

  /**
   * The analytical tile size: three tiles must fit in the cache at once.
   *
   * Rounded DOWN to a whole number of elements, because a tile that is one
   * element too large does not fit and the whole point of the calculation is
   * that it does.
   */
  function tileFor(capacityBytes, elementBytes) {
    return Math.max(1, Math.floor(Math.sqrt(capacityBytes / (3 * (elementBytes || 8)))));
  }

  /** Every version of the multiplication, for one configuration. */
  function versions(options) {
    const settings = options || {};
    const tile = settings.tile || 8;

    return [naive(settings), interchanged(settings),
      blocked(Object.assign({}, settings, { tile: tile })),
      Object.assign(blocked(Object.assign({}, settings, { tile: tile, pad: 1 })),
        { name: 'blocked and padded, tile ' + tile })];
  }

  return { DEFAULTS: DEFAULTS, layout: layout, at: at, naive: naive,
    interchanged: interchanged, blocked: blocked, tileFor: tileFor,
    versions: versions };
}));

/**
 * Text scale - the reading size, as a multiplier on the root font size.
 *
 * Everything in the stylesheet is sized in rem against `html { font-size }`,
 * so one custom property scales the whole application - prose, controls,
 * tables and code alike - without a single component knowing about it. Charts
 * are the exception: they are drawn in pixels, so they keep their size and the
 * text around them grows.
 *
 * The value is clamped and persisted, because a reading preference that has to
 * be set again on every visit is not a preference.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.createTextScale = api.createTextScale;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const KEY = 'text-scale';
  const STEPS = [0.85, 0.925, 1, 1.075, 1.15, 1.25, 1.4, 1.6];
  const DEFAULT = 1;

  function nearestStep(value) {
    return STEPS.reduce(function (best, step) {
      return Math.abs(step - value) < Math.abs(best - value) ? step : best;
    }, STEPS[0]);
  }

  function createTextScale(options) {
    const settings = options || {};
    const storage = settings.storage;
    const emit = settings.emit || function () {};
    const applyTo = settings.apply;
    let scale = DEFAULT;

    function apply() {
      if (applyTo) { applyTo(scale); return; }
      if (typeof document === 'undefined') return;
      document.documentElement.style.setProperty('--text-scale', String(scale));
    }

    function set(value) {
      const clamped = Math.min(STEPS[STEPS.length - 1], Math.max(STEPS[0], Number(value) || DEFAULT));
      scale = nearestStep(clamped);
      apply();
      if (storage) storage.write(KEY, scale);
      emit('change:text-scale', { scale: scale });
      return scale;
    }

    function step(direction) {
      const index = STEPS.indexOf(scale);
      const next = Math.min(STEPS.length - 1, Math.max(0, index + direction));
      return set(STEPS[next]);
    }

    return {
      init: function () {
        const stored = storage ? storage.read(KEY, DEFAULT) : DEFAULT;
        scale = nearestStep(Number(stored) || DEFAULT);
        apply();
        return scale;
      },
      set: set,
      increase: function () { return step(1); },
      decrease: function () { return step(-1); },
      reset: function () { return set(DEFAULT); },
      current: function () { return scale; },
      percent: function () { return Math.round(scale * 100); },
      atMinimum: function () { return scale === STEPS[0]; },
      atMaximum: function () { return scale === STEPS[STEPS.length - 1]; },
      steps: function () { return STEPS.slice(); }
    };
  }

  return { createTextScale: createTextScale };
}));

/**
 * Small DOM and language helpers shared across sections.
 * Anything here must be pure or DOM-only - no state, no fetching, no storage.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Helpers = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

  function escapeHtml(value) {
    return String(value === undefined || value === null ? '' : value)
      .replace(/[&<>"']/g, function (ch) { return ENTITIES[ch]; });
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function range(count, start) {
    const from = start || 0;
    const out = new Array(count);
    for (let i = 0; i < count; i += 1) out[i] = from + i;
    return out;
  }

  /**
   * One-slot memoisation keyed on a caller-supplied string.
   *
   * The demos recompute a whole sweep on every control change, and most
   * controls do not affect most sweeps: a section that measures six filters
   * because the learner moved an unrelated slider spends two seconds doing it.
   * One slot is enough - the key is almost always the same twice in a row -
   * and it keeps the memory bounded without an eviction policy.
   */
  function memoise(compute) {
    let lastKey = null;
    let lastValue = null;

    return function memoised(key) {
      if (lastKey === key) return lastValue;
      lastValue = compute(key);
      lastKey = key;
      return lastValue;
    };
  }

  function debounce(fn, wait) {
    let timer = null;
    return function debounced() {
      const args = arguments;
      const self = this;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(self, args); }, wait);
    };
  }

  function throttle(fn, wait) {
    let last = 0;
    let timer = null;
    return function throttled() {
      const args = arguments;
      const self = this;
      const now = Date.now();
      const remaining = wait - (now - last);
      if (remaining <= 0) {
        last = now;
        fn.apply(self, args);
        return;
      }
      clearTimeout(timer);
      timer = setTimeout(function () { last = Date.now(); fn.apply(self, args); }, remaining);
    };
  }

  /** Yields to the event loop with setTimeout, never rAF: a simulation must
   *  still complete in a background tab. */
  function yieldToLoop() {
    return new Promise(function (resolve) { setTimeout(resolve, 0); });
  }

  /* DOM access goes through jQuery in the UI layer; logic modules never touch
     the DOM at all, which is what keeps them unit-testable in node. */
  function $id(id) {
    return jQuery('#' + id);
  }

  function setText(id, value) {
    return $id(id).text(value);
  }

  function setHtml(id, value) {
    return $id(id).html(value);
  }

  function median(values) {
    if (!values.length) return NaN;
    const sorted = values.slice().sort(function (a, b) { return a - b; });
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  /** Median absolute deviation - reported next to a median because a median
   *  alone hides a bimodal distribution. */
  function mad(values) {
    if (!values.length) return NaN;
    const m = median(values);
    return median(values.map(function (v) { return Math.abs(v - m); }));
  }

  return {
    escapeHtml: escapeHtml,
    clamp: clamp,
    range: range,
    memoise: memoise,
    debounce: debounce,
    throttle: throttle,
    yieldToLoop: yieldToLoop,
    $id: $id,
    setText: setText,
    setHtml: setHtml,
    median: median,
    mad: mad
  };
}));

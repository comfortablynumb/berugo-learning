/**
 * BenchHarness - the measurement protocol, with its mistakes available on
 * purpose.
 *
 * Correct by default: warm up, repeat, consume the result so it cannot be
 * optimised away, trim outliers, report a median with its MAD and the run
 * count. Each of those can be switched off, which is how section 1.9 shows
 * what each one was protecting against - the broken configurations report
 * impressively better numbers, which is exactly the lesson.
 *
 * The clock is injected so tests can drive it deterministically.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BenchHarness = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const DEFAULTS = { warmup: 3, runs: 15, trim: 0.2, sink: true };

  function defaultClock() {
    if (typeof performance !== 'undefined' && performance.now) {
      return function () { return performance.now(); };
    }
    return function () { return Date.now(); };
  }

  function median(values) {
    if (!values.length) return NaN;
    const sorted = values.slice().sort(function (a, b) { return a - b; });
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  function mad(values) {
    if (!values.length) return NaN;
    const centre = median(values);
    return median(values.map(function (value) { return Math.abs(value - centre); }));
  }

  function trimmed(values, fraction) {
    if (!fraction) return values.slice();
    const sorted = values.slice().sort(function (a, b) { return a - b; });
    const drop = Math.floor(sorted.length * fraction / 2);
    return drop > 0 ? sorted.slice(drop, sorted.length - drop) : sorted;
  }

  function createHarness(options) {
    const settings = Object.assign({}, DEFAULTS, options || {});
    const clock = settings.clock || defaultClock();
    let sinkValue = null;

    function measureOnce(task, input) {
      const started = clock();
      const produced = task(input);
      const elapsed = clock() - started;
      if (settings.sink) sinkValue = produced;
      return elapsed;
    }

    /**
     * run({ task, input, label }) -> { medianMs, madMs, runs, samples, warmup, sink }
     * The returned object always carries the run count, so a caller cannot
     * report a time without saying how many runs produced it.
     */
    function run(spec) {
      const task = spec.task;
      const input = spec.input;

      for (let i = 0; i < settings.warmup; i += 1) measureOnce(task, input);

      const samples = [];
      for (let i = 0; i < settings.runs; i += 1) samples.push(measureOnce(task, input));

      const kept = trimmed(samples, settings.trim);
      return {
        label: spec.label || '',
        medianMs: median(kept),
        madMs: mad(kept),
        minMs: Math.min.apply(null, kept),
        maxMs: Math.max.apply(null, kept),
        runs: settings.runs,
        warmup: settings.warmup,
        trimmed: samples.length - kept.length,
        sink: settings.sink,
        samples: samples,
        suspicious: diagnose(samples, settings)
      };
    }

    /** A sweep is what turns one timing into a growth curve. */
    function sweep(spec) {
      return spec.sizes.map(function (size) {
        const result = run({ task: spec.task, input: spec.makeInput(size), label: String(size) });
        return Object.assign({ n: size, x: size, y: result.medianMs }, result);
      });
    }

    return { run: run, sweep: sweep, lastSink: function () { return sinkValue; } };
  }

  /** Names the ways this particular measurement may be lying. */
  function diagnose(samples, settings) {
    const warnings = [];
    if (!settings.warmup) warnings.push('no warm-up: the first runs include compilation and cold caches');
    if (!settings.sink) warnings.push('result unused: the work may have been optimised away');
    if (settings.runs < 5) warnings.push('fewer than five runs: the median is not meaningful');

    const spread = mad(samples);
    const centre = median(samples);
    if (centre > 0 && spread / centre > 0.25) {
      warnings.push('MAD is over 25% of the median: this measurement is noisy');
    }
    if (centre === 0) warnings.push('median is zero: the work is below timer resolution');

    return warnings;
  }

  return { createHarness: createHarness, median: median, mad: mad, trimmed: trimmed, DEFAULTS: DEFAULTS };
}));

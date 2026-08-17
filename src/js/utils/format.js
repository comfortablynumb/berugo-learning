/**
 * Number and unit formatting.
 *
 * Every measured figure the UI shows passes through here, which is where the
 * "name the unit" rule is enforced in practice: `duration`, `bytes` and
 * `count` all emit a unit, and `perRun` carries the run count with the number.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Format = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function count(value) {
    if (!Number.isFinite(value)) return '—';
    if (Math.abs(value) >= 1e9) return (value / 1e9).toFixed(2) + 'B';
    if (Math.abs(value) >= 1e6) return (value / 1e6).toFixed(2) + 'M';
    if (Math.abs(value) >= 1e4) return (value / 1e3).toFixed(1) + 'k';
    return String(Math.round(value));
  }

  function exact(value) {
    if (!Number.isFinite(value)) return '—';
    return Math.round(value).toLocaleString('en-US');
  }

  function duration(ms) {
    if (!Number.isFinite(ms)) return '—';
    if (ms < 1) return (ms * 1000).toFixed(0) + ' µs';
    if (ms < 1000) return ms.toFixed(ms < 10 ? 2 : 1) + ' ms';
    return (ms / 1000).toFixed(2) + ' s';
  }

  function bytes(value) {
    if (!Number.isFinite(value)) return '—';
    const units = ['B', 'KB', 'MB', 'GB'];
    let n = value;
    let unit = 0;
    while (n >= 1024 && unit < units.length - 1) { n /= 1024; unit += 1; }
    return (unit === 0 ? n : n.toFixed(1)) + ' ' + units[unit];
  }

  function percent(value, digits) {
    if (!Number.isFinite(value)) return '—';
    return (value * 100).toFixed(digits === undefined ? 1 : digits) + '%';
  }

  function fixed(value, digits) {
    if (!Number.isFinite(value)) return '—';
    return value.toFixed(digits === undefined ? 2 : digits);
  }

  /** A measured time is never shown alone: the run count travels with it. */
  function perRun(medianMs, runs) {
    return duration(medianMs) + ' (median of ' + runs + ')';
  }

  function ratio(a, b) {
    if (!b) return '—';
    return (a / b).toFixed(2) + '×';
  }

  function plural(n, singular, pluralForm) {
    return n + ' ' + (n === 1 ? singular : (pluralForm || singular + 's'));
  }

  function bits(value) {
    return exact(value) + (value === 1 ? ' bit' : ' bits');
  }

  return {
    count: count,
    exact: exact,
    duration: duration,
    bytes: bytes,
    percent: percent,
    fixed: fixed,
    perRun: perRun,
    ratio: ratio,
    plural: plural,
    bits: bits
  };
}));

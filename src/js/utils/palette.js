/**
 * Palette - the only source of colour for charts.
 *
 * Colours are read from the CSS custom properties, so a chart drawn in dark
 * mode uses the dark hues without any component knowing which theme is
 * active. `readableOn` exists because text drawn *inside* a filled shape
 * cannot inherit the page's text colour: a pale label on a pale fill is the
 * classic dark-mode chart bug.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Palette = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const HUES = ['blue', 'orange', 'green', 'purple', 'teal', 'pink', 'amber', 'indigo', 'red', 'gray'];
  const FALLBACK = {
    blue: '#1d4ed8', orange: '#c2410c', green: '#15803d', purple: '#7e22ce', teal: '#0f766e',
    pink: '#be185d', amber: '#a16207', indigo: '#4338ca', red: '#b91c1c', gray: '#475569'
  };

  function readVar(name, fallback) {
    if (typeof getComputedStyle !== 'function' || typeof document === 'undefined') return fallback;
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
  }

  function hue(name) {
    return readVar('--hue-' + name, FALLBACK[name] || FALLBACK.gray);
  }

  function soft(name) {
    return readVar('--hue-' + name + '-soft', '#e2e8f0');
  }

  function token(name) {
    return readVar('--' + name, '#475569');
  }

  /** Categorical series colour by index, stable across redraws. */
  function series(index) {
    return hue(HUES[index % HUES.length]);
  }

  function seriesSoft(index) {
    return soft(HUES[index % HUES.length]);
  }

  function parse(colour) {
    const value = String(colour).trim();
    if (value[0] === '#') {
      const hex = value.length === 4
        ? value.slice(1).split('').map(function (c) { return c + c; }).join('')
        : value.slice(1);
      const n = parseInt(hex, 16);
      return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    }
    const match = value.match(/rgba?\(([^)]+)\)/);
    if (match) {
      const parts = match[1].split(',').map(function (p) { return parseFloat(p); });
      return { r: parts[0], g: parts[1], b: parts[2] };
    }
    return { r: 71, g: 85, b: 105 };
  }

  function channel(value) {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }

  function luminance(colour) {
    const rgb = parse(colour);
    return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
  }

  function contrast(a, b) {
    const la = luminance(a);
    const lb = luminance(b);
    const lighter = Math.max(la, lb);
    const darker = Math.min(la, lb);
    return (lighter + 0.05) / (darker + 0.05);
  }

  /** Black or white, whichever has more contrast against the given fill. */
  function readableOn(fill) {
    return contrast('#ffffff', fill) >= contrast('#0f172a', fill) ? '#ffffff' : '#0f172a';
  }

  function status(name) {
    return readVar('--status-' + name, FALLBACK.gray);
  }

  return {
    hue: hue,
    soft: soft,
    token: token,
    series: series,
    seriesSoft: seriesSoft,
    hues: function () { return HUES.slice(); },
    luminance: luminance,
    contrast: contrast,
    readableOn: readableOn,
    status: status
  };
}));

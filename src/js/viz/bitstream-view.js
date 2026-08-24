/**
 * BitstreamView - a coded bitstream with per-symbol attribution.
 *
 * The one picture compression needs and nothing else in the codebase draws: a
 * run of output bits, segmented by which input symbol produced them, so a
 * reader can see that "e" cost three bits and "q" cost nine. Every claim in
 * this milestone — Huffman's whole-bit floor, arithmetic coding's fractional
 * bits, the LZ token's distance and length fields — is visible in that one
 * picture and invisible in a size column.
 *
 * HTML rather than SVG, for the reasons `BitView` gives: a bitstream is
 * something a reader wants to select and copy, it must reflow in a narrow
 * column, and a screen reader should be able to walk it. Tones cycle through
 * the `--hue-*` variables so adjacent symbols separate without carrying any
 * meaning of their own.
 *
 * The interval strip is the other half. Arithmetic coding is a sequence of
 * narrowing intervals, and the only way to see why it beats a symbol code is to
 * watch the interval shrink by a factor that is not a power of two.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BitstreamView = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const HUES = ['blue', 'green', 'amber', 'purple', 'pink', 'teal'];
  const MAX_BITS = 1024;

  function escapeHtml(value) {
    return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function hueFor(index) {
    return HUES[index % HUES.length];
  }

  /**
   * One segment: the symbol that produced it, its bits, and the cost. `label`
   * is what the reader sees; `bits` is a string of '0' and '1'.
   */
  function segmentMarkup(segment, index) {
    const hue = segment.hue || hueFor(index);
    const cells = segment.bits.split('').map(function (bit) {
      return '<span class="bitstream-bit">' + bit + '</span>';
    }).join('');

    return '<span class="bitstream-segment bit-hue-' + hue + '" title="'
      + escapeHtml(segment.label + ' — ' + segment.bits.length + ' bits') + '">'
      + '<span class="bitstream-label">' + escapeHtml(segment.label) + '</span>'
      + cells + '</span>';
  }

  /** The stream itself, truncated with an explicit marker rather than silently. */
  function streamMarkup(segments, options) {
    const settings = options || {};
    const limit = settings.maxBits === undefined ? MAX_BITS : settings.maxBits;
    const shown = [];
    let bits = 0;

    segments.forEach(function (segment) {
      if (bits >= limit) return;
      shown.push(segment);
      bits += segment.bits.length;
    });
    const truncated = shown.length < segments.length;

    return '<div class="bitstream">'
      + shown.map(segmentMarkup).join('')
      + (truncated ? '<span class="bitstream-more">… ' + (segments.length - shown.length)
        + ' more symbols</span>' : '')
      + '</div>';
  }

  /**
   * The cost table under the stream: symbol, probability, the bits its code
   * actually spends and the bits its information content says it should. The
   * gap between the last two columns is the whole subject.
   */
  function costMarkup(rows) {
    if (!rows || !rows.length) return '';
    const body = rows.map(function (row) {
      return '<tr><td class="mono">' + escapeHtml(row.symbol) + '</td>'
        + '<td class="mono">' + row.probability.toFixed(4) + '</td>'
        + '<td class="mono">' + row.spent.toFixed(2) + '</td>'
        + '<td class="mono">' + row.ideal.toFixed(2) + '</td>'
        + '<td class="mono">' + (row.spent - row.ideal).toFixed(2) + '</td></tr>';
    }).join('');

    return '<table class="bitstream-costs"><thead><tr>'
      + '<th>symbol</th><th>probability</th><th>bits spent</th>'
      + '<th>bits it carries</th><th>waste</th></tr></thead>'
      + '<tbody>' + body + '</tbody></table>';
  }

  function markup(config) {
    return '<div class="bitstream-view">'
      + (config.caption ? '<div class="bitstream-caption">'
        + escapeHtml(config.caption) + '</div>' : '')
      + streamMarkup(config.segments || [], config)
      + summaryMarkup(config)
      + costMarkup(config.costs)
      + '</div>';
  }

  /** Total bits, the entropy floor and the gap, always together — a bit count
   *  with no denominator is the thing this component exists to prevent. */
  function summaryMarkup(config) {
    if (config.totalBits === undefined) return '';
    const floor = config.floorBits;
    const parts = ['<span class="bitstream-total">' + config.totalBits + ' bits</span>'];

    if (floor !== undefined) {
      parts.push('<span class="bitstream-floor">floor ' + floor.toFixed(1) + ' bits</span>');
      parts.push('<span class="bitstream-gap">' + (floor === 0 ? '—'
        : '×' + (config.totalBits / floor).toFixed(3)) + '</span>');
    }
    return '<div class="bitstream-summary">' + parts.join('') + '</div>';
  }

  function render(host, config) {
    if (!host) return null;
    host.innerHTML = markup(config);
    return { host: host, segments: (config.segments || []).length };
  }

  /* ---------------------------------------------------- interval strip */

  /**
   * Arithmetic coding's narrowing interval, one row per symbol. Each row draws
   * the current interval as a bar and marks the sub-interval the next symbol
   * selects, so the reader sees the width multiply by a probability rather than
   * halve.
   */
  function intervalMarkup(steps) {
    const rows = steps.map(function (step) {
      const left = Math.max(0, Math.min(100, step.low * 100));
      const width = Math.max(0.4, Math.min(100 - left, (step.high - step.low) * 100));

      return '<div class="interval-row">'
        + '<span class="interval-symbol mono">' + escapeHtml(step.symbol) + '</span>'
        + '<span class="interval-track">'
        + '<span class="interval-bar" style="left:' + left.toFixed(3)
        + '%;width:' + width.toFixed(3) + '%"></span></span>'
        + '<span class="interval-width mono">' + step.width.toExponential(2) + '</span>'
        + '<span class="interval-bits mono">' + step.bits.toFixed(2) + ' bits</span>'
        + '</div>';
    }).join('');

    return '<div class="interval-strip">' + rows + '</div>';
  }

  function renderIntervals(host, steps) {
    if (!host) return null;
    host.innerHTML = intervalMarkup(steps);
    return { host: host, steps: steps.length };
  }

  /**
   * The steps an arithmetic coder takes over a message, as data: low, high,
   * width and the bits that width costs. Computed in floating point, which is
   * exactly what the integer implementation approximates.
   */
  function intervalSteps(symbols, model) {
    let low = 0;
    let high = 1;
    const steps = [];

    symbols.forEach(function (symbol) {
      const at = model.index.get(symbol);
      const width = high - low;
      const start = model.cumulative[at] / model.total;
      const end = model.cumulative[at + 1] / model.total;

      high = low + width * end;
      low = low + width * start;
      steps.push({ symbol: String(symbol), low: low, high: high, width: high - low,
        bits: -Math.log2(high - low) });
    });
    return steps;
  }

  return {
    HUES: HUES, MAX_BITS: MAX_BITS,
    hueFor: hueFor, segmentMarkup: segmentMarkup, streamMarkup: streamMarkup,
    costMarkup: costMarkup, summaryMarkup: summaryMarkup,
    markup: markup, render: render,
    intervalMarkup: intervalMarkup, renderIntervals: renderIntervals,
    intervalSteps: intervalSteps
  };
}));

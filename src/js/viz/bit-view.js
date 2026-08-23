/**
 * BitView - the renderer for the one picture this milestone needs constantly:
 * a word, one cell per bit, with the fields named.
 *
 * HTML rather than SVG, for the same reasons `MatrixView` is: a bit pattern is
 * something a reader wants to select, copy and have read aloud by a screen
 * reader, and it has to reflow on a narrow column. What the renderer adds over
 * a monospaced string is the grouping - a `<span>` per field with its own
 * tone, so "sign, exponent, mantissa" or "timestamp, machine, sequence" is
 * visible at a glance rather than counted out by hand.
 *
 * The number wheel is the one SVG here, and it exists because two's complement
 * is a circle: the bit patterns run 0 upwards all the way around, and the
 * signed reading cuts that circle at one point. Every fact about signed
 * overflow - that it happens at the cut, that INT_MIN has no positive
 * counterpart, that the same adder serves both readings - is a statement about
 * where the cut is, and a picture makes it in one look.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BitView = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const MAX_BITS = 128;

  function escapeHtml(value) {
    return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /**
   * A value's bits, most significant first, as plain numbers. Accepts a
   * BigInt, a Number or an array that is already bits - a section that has
   * computed its own bit list should not have to convert it back.
   */
  function bitsOf(value, count) {
    if (Array.isArray(value)) return value.slice(0, count);
    const big = typeof value === 'bigint' ? value : BigInt(Math.trunc(value));
    const width = Math.min(count, MAX_BITS);
    const mask = (1n << BigInt(width)) - 1n;
    const raw = big & mask;
    const out = [];
    for (let i = width - 1; i >= 0; i -= 1) out.push(Number((raw >> BigInt(i)) & 1n));
    return out;
  }

  /** Which field a bit belongs to, by position from the most significant end. */
  function fieldAt(groups, index) {
    for (let i = 0; i < groups.length; i += 1) {
      if (index >= groups[i].from && index <= groups[i].to) return groups[i];
    }
    return null;
  }

  function cellMarkup(bit, group, options) {
    const classes = ['bit-cell', bit === 1 ? 'bit-one' : 'bit-zero'];
    if (group && group.hue) classes.push('bit-hue-' + group.hue);
    if (options.highlight) classes.push('bit-lit');
    const title = group ? ' title="' + escapeHtml(group.label) + '"' : '';
    return '<span class="' + classes.join(' ') + '"' + title + '>' + bit + '</span>';
  }

  /**
   * One row of bits. `groups` name contiguous spans by index from the most
   * significant end; `lit` is a list of indices to pick out, which is what the
   * trick explorer uses to show which bits an operation touched.
   */
  function rowMarkup(config) {
    const bits = bitsOf(config.value, config.bits);
    const groups = config.groups || [];
    const lit = config.lit || [];
    let out = '<div class="bit-row">';

    for (let i = 0; i < bits.length; i += 1) {
      if (i > 0 && (bits.length - i) % 8 === 0) out += '<span class="bit-gap"></span>';
      out += cellMarkup(bits[i], fieldAt(groups, i), { highlight: lit.indexOf(i) !== -1 });
    }
    return out + '</div>';
  }

  /** The field legend: one chip per group, in the group's own tone. */
  function legendMarkup(groups) {
    if (!groups || groups.length === 0) return '';
    return '<div class="bit-legend">' + groups.map(function (group) {
      return '<span class="bit-chip bit-hue-' + (group.hue || 'gray') + '">' +
        escapeHtml(group.label) + ' <span class="bit-chip-width">' +
        (group.to - group.from + 1) + ' bits</span></span>';
    }).join('') + '</div>';
  }

  /**
   * A labelled word: the caption, the bits, the legend, and whatever readings
   * the caller wants underneath (hexadecimal, the signed value, the exact
   * decimal expansion).
   */
  function markup(config) {
    const readings = (config.readings || []).map(function (reading) {
      return '<div class="bit-reading"><span class="bit-reading-label">' +
        escapeHtml(reading.label) + '</span><span class="bit-reading-value mono">' +
        escapeHtml(reading.value) + '</span></div>';
    }).join('');

    return '<div class="bit-word">' +
      (config.caption ? '<div class="bit-caption">' + escapeHtml(config.caption) + '</div>' : '') +
      rowMarkup(config) +
      legendMarkup(config.groups) +
      (readings ? '<div class="bit-readings">' + readings + '</div>' : '') +
      '</div>';
  }

  function render(host, config) {
    if (!host) return null;
    host.innerHTML = markup(config);
    return { host: host, bits: config.bits };
  }

  /** Several words stacked, which is how the SWAR stages and the trick
   *  explorer's before/after both want to read. */
  function stackMarkup(words) {
    return '<div class="bit-stack">' + words.map(markup).join('') + '</div>';
  }

  function renderStack(host, words) {
    if (!host) return null;
    host.innerHTML = stackMarkup(words);
    return { host: host, words: words.length };
  }

  /**
   * A heat strip: one cell per bit position, shaded by a value in [0, 1].
   * Used for "how often is this bit set", where the interesting reading is a
   * column that is not at one half.
   */
  function heatMarkup(values, options) {
    const settings = options || {};
    const cells = values.map(function (value, index) {
      const percent = Math.round(Math.max(0, Math.min(1, value)) * 100);
      const off = Math.abs(value - 0.5) > (settings.tolerance || 0.02);
      return '<span class="bit-heat-cell' + (off ? ' bit-heat-off' : '') +
        '" style="--bit-heat:' + percent + '%" title="bit ' + index + ': ' +
        percent + '% set"></span>';
    }).join('');
    return '<div class="bit-heat">' + cells + '</div>';
  }

  function renderHeat(host, values, options) {
    if (!host) return null;
    host.innerHTML = heatMarkup(values, options);
    return { host: host, cells: values.length };
  }

  /* ------------------------------------------------------------- the wheel */

  const WHEEL_SIZE = 260;

  /**
   * The two's-complement number wheel. Bit patterns run clockwise from zero at
   * the top; the cut between the largest positive value and the most negative
   * one is drawn as a wedge, because that cut IS signed overflow.
   */
  function wheelMarkup(config) {
    const radius = WHEEL_SIZE / 2 - 34;
    const centre = WHEEL_SIZE / 2;
    const span = Math.pow(2, config.bits);
    const ticks = wheelTicks(config, { centre: centre, radius: radius, span: span });
    const marks = (config.marks || []).map(function (mark) {
      return markMarkup(mark, { centre: centre, radius: radius, span: span });
    }).join('');

    return '<svg viewBox="0 0 ' + WHEEL_SIZE + ' ' + WHEEL_SIZE + '" class="bit-wheel" ' +
      'role="img" aria-label="' + escapeHtml(config.ariaLabel || 'two’s complement wheel') + '">' +
      '<circle cx="' + centre + '" cy="' + centre + '" r="' + radius +
      '" class="bit-wheel-ring"/>' + cutMarkup(centre, radius) + ticks + marks + '</svg>';
  }

  function pointOn(centre, radius, fraction) {
    const angle = 2 * Math.PI * fraction - Math.PI / 2;
    return { x: centre + radius * Math.cos(angle), y: centre + radius * Math.sin(angle) };
  }

  /** The wedge between the top of the signed range and the bottom of it. */
  function cutMarkup(centre, radius) {
    const at = pointOn(centre, radius + 12, 0.5);
    return '<line x1="' + centre + '" y1="' + centre + '" x2="' + at.x + '" y2="' + at.y +
      '" class="bit-wheel-cut"/>' +
      '<text x="' + at.x + '" y="' + (at.y + 12) + '" class="bit-wheel-label" ' +
      'text-anchor="middle">signed overflow</text>';
  }

  function wheelTicks(config, geometry) {
    const count = Math.min(config.ticks || 16, geometry.span);
    let out = '';
    for (let i = 0; i < count; i += 1) {
      const fraction = i / count;
      const inner = pointOn(geometry.centre, geometry.radius - 6, fraction);
      const outer = pointOn(geometry.centre, geometry.radius, fraction);
      out += '<line x1="' + inner.x + '" y1="' + inner.y + '" x2="' + outer.x +
        '" y2="' + outer.y + '" class="bit-wheel-tick"/>';
    }
    return out;
  }

  function markMarkup(mark, geometry) {
    const fraction = Number(mark.pattern) / geometry.span;
    const at = pointOn(geometry.centre, geometry.radius, fraction);
    const label = pointOn(geometry.centre, geometry.radius + 16, fraction);
    return '<circle cx="' + at.x + '" cy="' + at.y + '" r="5" class="bit-wheel-mark ' +
      'bit-hue-' + (mark.hue || 'blue') + '"/>' +
      '<text x="' + label.x + '" y="' + (label.y + 4) + '" class="bit-wheel-label" ' +
      'text-anchor="middle">' + escapeHtml(mark.label) + '</text>';
  }

  function renderWheel(host, config) {
    if (!host) return null;
    host.innerHTML = wheelMarkup(config);
    return { host: host, bits: config.bits };
  }

  return {
    MAX_BITS: MAX_BITS,
    bitsOf: bitsOf,
    markup: markup,
    render: render,
    rowMarkup: rowMarkup,
    legendMarkup: legendMarkup,
    stackMarkup: stackMarkup,
    renderStack: renderStack,
    heatMarkup: heatMarkup,
    renderHeat: renderHeat,
    wheelMarkup: wheelMarkup,
    renderWheel: renderWheel
  };
}));

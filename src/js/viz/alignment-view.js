/**
 * AlignmentView - text over text, one character per cell, with per-character
 * highlighting.
 *
 * Every algorithm in M15 is about *which characters got compared*, and that is
 * not a number, it is a picture: the pattern sitting under the text at some
 * offset with the compared cells marked and the rest faint. A comparison count
 * summarises it; this shows it, and the two together are what make a shift
 * rule explicable rather than magic.
 *
 * Rendered as HTML rather than SVG or canvas for the same reason MatrixView is:
 * text should be selectable, wrappable and readable by a screen reader, and a
 * character grid in SVG is a picture of text rather than text.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AlignmentView = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const MAX_COLUMNS = 90;

  function escapeHtml(value) {
    return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /** A space in a character grid reads as a missing cell, and a control
   *  character as nothing at all. Both get a visible stand-in. */
  function display(character) {
    const code = character.charCodeAt(0);

    if (character === ' ') return '·';

    if (character === '\n') return '⏎';
    return code < 32 ? '␀' : character;
  }

  function cellClass(mark) {
    if (!mark) return 'align-cell';
    return 'align-cell align-' + mark;
  }

  /**
   * `render(host, { rows })` where each row is
   * `{ label, offset, characters, marks }` - `marks[i]` names the state of
   * character i (`match`, `mismatch`, `skip`, `window`) or is falsy.
   */
  function render(host, config) {
    if (!host) return null;
    const settings = config || {};
    const width = Math.min(settings.width || MAX_COLUMNS, longestRow(settings.rows));

    host.innerHTML = '<div class="align-scroll">' +
      settings.rows.map(function (row) { return rowMarkup(row, width); }).join('') +
      '</div>' + (settings.caption ? '<p class="align-caption">' +
        escapeHtml(settings.caption) + '</p>' : '');
    return { columns: width, rows: settings.rows.length,
      truncated: longestRow(settings.rows) > width };
  }

  function longestRow(rows) {
    return (rows || []).reduce(function (best, row) {
      return Math.max(best, (row.offset || 0) + row.characters.length);
    }, 0);
  }

  function rowMarkup(row, width) {
    const cells = [];
    const offset = row.offset || 0;

    for (let i = 0; i < offset && i < width; i += 1) {
      cells.push('<span class="align-cell align-pad"></span>');
    }

    for (let i = 0; i < row.characters.length && offset + i < width; i += 1) {
      cells.push('<span class="' + cellClass(row.marks && row.marks[i]) + '">' +
        escapeHtml(display(row.characters[i])) + '</span>');
    }
    return '<div class="align-row">' +
      '<span class="align-label">' + escapeHtml(row.label || '') + '</span>' +
      '<span class="align-cells">' + cells.join('') + '</span></div>';
  }

  /**
   * The standard two-row alignment: the text, then the pattern placed at
   * `offset` with each of its characters marked by the comparison that was
   * made there. `compared` is how many characters the matcher looked at
   * before it stopped, and `matchedUpTo` distinguishes right-to-left matchers
   * from left-to-right ones.
   */
  function alignment(text, pattern, state) {
    const settings = state || {};
    const offset = settings.offset || 0;
    const window2 = settings.window === false ? null : { from: offset, to: offset + pattern.length };
    const textMarks = text.split('').map(function (unused, i) {
      if (!window2 || i < window2.from || i >= window2.to) return null;
      return 'window';
    });

    return { rows: [
      { label: settings.textLabel || 'text', characters: text.split(''), marks: textMarks },
      { label: settings.patternLabel || 'pattern', offset: offset,
        characters: pattern.split(''), marks: markPattern(pattern, settings) }
    ] };
  }

  /** Which pattern characters were compared, and how each one came out. */
  function markPattern(pattern, settings) {
    const marks = new Array(pattern.length).fill(null);
    const compared = settings.compared || [];

    compared.forEach(function (entry) {
      marks[entry.at] = entry.equal ? 'match' : 'mismatch';
    });

    if (settings.rightToLeft === undefined) return marks;
    return marks;
  }

  /**
   * A diff as two aligned columns. Equal lines sit side by side; a deletion
   * leaves the right column empty and an insertion the left, which is the
   * layout every review tool uses and the reason a hunk is legible at all.
   */
  function sideBySide(host, script, options) {
    if (!host) return null;
    const settings = options || {};
    const limit = settings.limit || 40;
    const rows = script.slice(0, limit).map(function (step) {
      return '<tr class="diff-' + step.kind + '">' +
        '<td class="diff-line mono">' + (step.kind === 'insert' ? '' :
          escapeHtml(step.line)) + '</td>' +
        '<td class="diff-mark">' + markFor(step.kind) + '</td>' +
        '<td class="diff-line mono">' + (step.kind === 'delete' ? '' :
          escapeHtml(step.line)) + '</td></tr>';
    }).join('');

    host.innerHTML = '<div class="matrix-scroll"><table class="diff-table"><tbody>' +
      rows + '</tbody></table></div>';
    return { shown: Math.min(limit, script.length), total: script.length };
  }

  function markFor(kind) {
    if (kind === 'insert') return '+';

    if (kind === 'delete') return '−';
    return ' ';
  }

  return {
    MAX_COLUMNS: MAX_COLUMNS, render: render, alignment: alignment,
    sideBySide: sideBySide, display: display
  };
}));

/**
 * Turns raw prose into escaped HTML with the maths notation decoded in place.
 *
 * Every symbol the glossary knows becomes a chip carrying how to say it and
 * what it does, revealed on hover, tap or keyboard focus. Nothing is removed
 * and nothing is reworded - the symbol still reads exactly as the author wrote
 * it, with the meaning one gesture away.
 *
 * Repetition is the thing to avoid: Θ appears nine hundred times in the
 * curriculum and a page underlining all of them is unreadable. So an annotator
 * carries a `seen` set and marks the *first* occurrence of each symbol in a
 * block, which is the one a reader meets cold. The one exception is the formal
 * line, which is the notation itself and is asked to decode all of it.
 *
 * This escapes as it goes rather than escaping first and injecting after: HTML
 * entities contain letters, and a matcher run over `&amp;` would happily chip
 * something inside it.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.NotationMarkup = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  /* Resolved on use, not on load: in the browser the glossary is a content
     module and this is a util, and the two script tags are far apart. Reading
     them lazily means the order of those tags cannot break anything. */
  function helpers() {
    return scope && scope.Helpers ? scope.Helpers : require('./helpers.js');
  }

  function glossary() {
    return scope && scope.Notation ? scope.Notation : require('../content/notation.js');
  }

  function esc(value) {
    return helpers().escapeHtml(value);
  }

  function noteFor(entry) {
    return entry.reads + ' — ' + entry.means;
  }

  function chip(entry) {
    const note = esc(noteFor(entry));
    return '<abbr class="notation" tabindex="0" data-note="' + note +
      '" aria-label="' + esc(entry.token) + ': ' + note + '">' +
      esc(entry.token) + '</abbr>';
  }

  /**
   * @param {{sectionId?: string}} config
   * @returns {{annotate: function, decoded: function}}
   */
  function createAnnotator(config) {
    const sectionId = config && config.sectionId;
    const seen = new Set();

    function shouldChip(token, all) {
      if (all) return true;
      if (seen.has(token)) return false;
      return true;
    }

    function annotate(text, options) {
      if (text === undefined || text === null || text === '') return '';
      const all = Boolean(options && options.all);
      const matcher = glossary().pattern();
      const source = String(text);
      let out = '';
      let last = 0;
      let match = matcher.exec(source);

      while (match !== null) {
        const entry = glossary().entry(match[0], sectionId);
        out += esc(source.slice(last, match.index));
        last = match.index + match[0].length;
        out += entry && shouldChip(match[0], all) ? chip(entry) : esc(match[0]);
        if (entry) seen.add(match[0]);
        match = matcher.exec(source);
      }

      return out + esc(source.slice(last));
    }

    return {
      annotate: annotate,
      decoded: function () { return Array.from(seen); }
    };
  }

  /** One-shot annotation for a standalone string. */
  function annotate(text, options) {
    return createAnnotator(options || {}).annotate(text, options);
  }

  return {
    createAnnotator: createAnnotator,
    annotate: annotate,
    noteFor: noteFor
  };
}));

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

    /**
     * The same annotation, plus the two pieces of inline markup the
     * orientation and insight prose is written in: `**` around the claim a
     * paragraph is making, and backticks around an identifier.
     *
     * It is a separate entry point rather than part of `annotate` on purpose.
     * Concept and reference text uses `**` as EXPONENTIATION — `2**53` — and
     * rendering that as bold would corrupt it, so only the two blocks whose
     * authors write markdown get the markdown.
     *
     * Bold is split first so that a backticked identifier inside a bold claim
     * still works, and the notation annotator runs on the inner text of a bold
     * span so a symbol first met there is still decoded. Code spans are
     * escaped and never annotated: a backticked name is an identifier, not
     * notation.
     */
    function annotateRich(text, options) {
      if (text === undefined || text === null || text === '') return '';
      return splitOn(String(text), BOLD, function (inner) {
        return '<strong>' + withCode(inner, options) + '</strong>';
      }, function (plain) { return withCode(plain, options); });
    }

    function withCode(text, options) {
      return splitOn(text, CODE, function (inner) {
        return '<code>' + esc(inner) + '</code>';
      }, function (plain) { return annotate(plain, options); });
    }

    return {
      annotate: annotate,
      annotateRich: annotateRich,
      decoded: function () { return Array.from(seen); }
    };
  }

  /* One capture group each, so `String.split` hands back the delimiters at the
     odd indices and the surrounding prose at the even ones. An unclosed marker
     simply never matches, and falls through to be escaped and shown as it was
     written. */
  const BOLD = /\*\*([\s\S]+?)\*\*/g;
  const CODE = /`([^`]+)`/g;

  function splitOn(text, pattern, onMatch, onPlain) {
    const parts = String(text).split(pattern);
    let out = '';

    parts.forEach(function (part, at) {
      if (part === undefined || part === '') return;
      out += at % 2 === 1 ? onMatch(part) : onPlain(part);
    });
    return out;
  }

  /** One-shot annotation for a standalone string. */
  function annotate(text, options) {
    return createAnnotator(options || {}).annotate(text, options);
  }

  function annotateRich(text, options) {
    return createAnnotator(options || {}).annotateRich(text, options);
  }

  return {
    createAnnotator: createAnnotator,
    annotate: annotate,
    annotateRich: annotateRich,
    noteFor: noteFor
  };
}));

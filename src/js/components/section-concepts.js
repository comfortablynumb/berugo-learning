/**
 * Renders the concepts block: term, plain statement, formal statement, the
 * plain-English reading of that statement, the detailed explanation, and a
 * concrete example.
 *
 * A term with only the formal notation teaches nobody, a term with only the
 * plain gloss cannot be checked against anything, and a one-line gloss is a
 * definition rather than an explanation - so `detail` carries the mechanism,
 * the reason it is built that way, and what breaks when it is ignored. This
 * block is the Description tab, and it is what the learner lands on.
 *
 * `readAs` is the translation of the formal line into a sentence you could say
 * out loud. It exists because the formal line is the one place the curriculum
 * writes maths at a reader who was told the prose would be enough, and a line
 * of symbols with no reading is a wall rather than a summary.
 *
 * Every field runs through the notation annotator, which decodes each symbol
 * the first time it appears in a concept. The formal line asks for all of them
 * decoded rather than the first: it *is* the notation, and a reader stuck on
 * its third symbol is not helped by the first one being the only chip.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SectionConcepts = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  function markup(entries, options) {
    if (!entries || !entries.length) return '';
    const sectionId = options && options.sectionId;
    return '<section class="section-block">' +
      icons().heading('concepts', 'Concepts') +
      '<div class="concept-list">' +
      entries.map(function (entry, index) {
        return concept(entry, index, sectionId);
      }).join('') +
      '</div>' +
      '</section>';
  }

  /* Resolved on use, not on load, exactly as the annotator itself does: it lets
     `node --test` require this renderer and check what it emits. */
  function notation() {
    return scope && scope.NotationMarkup ? scope.NotationMarkup
      : require('../utils/notation-markup.js');
  }

  function annotator(sectionId) {
    return notation().createAnnotator({ sectionId: sectionId });
  }

  function icons() {
    return scope && scope.Icons ? scope.Icons : require('../utils/icons.js');
  }

  /* A concept may carry its own diagram, and it is placed between the formal
     line and the explanation on purpose: the reader who is about to meet a
     240-character paragraph gets the shape of the thing first. The host is
     empty here and filled at mount, exactly like the section diagram - markup
     is built as a string and mermaid needs a live element. */
  function conceptDiagram(entry, sectionId, index, mark) {
    if (!entry.diagram || !entry.diagram.definition) return '';
    return '<div class="concept-diagram">' +
      '<div id="diagram-' + sectionId + '-c' + index + '" class="mermaid-host"></div>' +
      (entry.diagram.caption
        ? '<p class="note">' + mark.annotate(entry.diagram.caption) + '</p>'
        : '') +
      '</div>';
  }

  /** `detail` is one paragraph or several; both arrive here as an array. */
  function paragraphs(detail) {
    if (!detail) return [];
    return (Array.isArray(detail) ? detail : [detail]).filter(Boolean);
  }

  function explanation(detail, mark) {
    const parts = paragraphs(detail);
    if (!parts.length) return '';
    return '<div class="detail">' +
      parts.map(function (text) { return '<p>' + mark.annotate(text) + '</p>'; }).join('') +
      '</div>';
  }

  function formal(entry, mark) {
    if (!entry.formal) return '';
    return '<div class="formal">' + mark.annotate(entry.formal, { all: true }) + '</div>' +
      (entry.readAs
        ? '<p class="reads-as"><strong>In words.</strong> ' + mark.annotate(entry.readAs) + '</p>'
        : '');
  }

  function example(entry, mark) {
    if (!entry.example) return '';
    return '<div class="example"><strong>In practice.</strong> ' +
      mark.annotate(entry.example) + '</div>';
  }

  function concept(entry, index, sectionId) {
    const mark = annotator(sectionId);
    return '<article class="concept">' +
      '<h4 class="term"><span class="term-n">' + (index + 1) + '</span>' +
      mark.annotate(entry.term) + '</h4>' +
      '<p class="plain">' + mark.annotate(entry.plain) + '</p>' +
      formal(entry, mark) +
      conceptDiagram(entry, sectionId, index, mark) +
      explanation(entry.detail, mark) +
      example(entry, mark) +
      '</article>';
  }

  return { markup: markup };
}));

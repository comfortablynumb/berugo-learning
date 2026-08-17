/**
 * Renders the concepts block: term, plain statement, formal statement, the
 * detailed explanation, and a concrete example.
 *
 * All four are required. A term with only the formal notation teaches nobody,
 * a term with only the plain gloss cannot be checked against anything, and a
 * one-line gloss is a definition rather than an explanation - so `detail`
 * carries the mechanism, the reason it is built that way, and what breaks when
 * it is ignored. This block is the Description tab, and it is what the learner
 * lands on.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SectionConcepts = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  function esc(value) {
    return scope.Helpers.escapeHtml(value);
  }

  /** `detail` is one paragraph or several; both arrive here as an array. */
  function paragraphs(detail) {
    if (!detail) return [];
    return (Array.isArray(detail) ? detail : [detail]).filter(Boolean);
  }

  function explanation(detail) {
    const parts = paragraphs(detail);
    if (!parts.length) return '';
    return '<div class="detail">' +
      parts.map(function (text) { return '<p>' + esc(text) + '</p>'; }).join('') +
      '</div>';
  }

  function concept(entry, index) {
    return '<article class="concept">' +
      '<h4 class="term"><span class="term-n">' + (index + 1) + '</span>' + esc(entry.term) + '</h4>' +
      '<p class="plain">' + esc(entry.plain) + '</p>' +
      (entry.formal ? '<div class="formal">' + esc(entry.formal) + '</div>' : '') +
      explanation(entry.detail) +
      (entry.example ? '<div class="example"><strong>In practice.</strong> ' + esc(entry.example) + '</div>' : '') +
      '</article>';
  }

  function markup(entries) {
    if (!entries || !entries.length) return '';
    return '<section class="section-block">' +
      '<h3>Concepts</h3>' +
      '<div class="concept-list">' + entries.map(concept).join('') + '</div>' +
      '</section>';
  }

  return { markup: markup };
}));

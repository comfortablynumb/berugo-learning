/**
 * Renders worked examples.
 *
 * Each step states what to do, why, the arithmetic with real numbers, and the
 * result. The `work` field is monospaced and preserved verbatim, because the
 * numbers are the teaching - a worked example with no arithmetic is a summary.
 * Where a step states a computed figure, a unit test recomputes it, so editing
 * the setup without editing the numbers fails the build.
 *
 * Every field runs through the notation annotator. This is the tab where the
 * maths actually happens - the `work` block is denser in symbols than anything
 * on the Description tab - so a reader who cannot pronounce ⌈ or ⇒ needs the
 * decoder here most, and for a long time this was the one place it was missing.
 *
 * The annotator is created per example rather than per block: worked examples
 * are read one at a time and in any order, so a symbol first met in the second
 * example should be decoded there rather than silently spent on the first.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SectionExamples = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  /* Resolved on use, not on load, exactly as the annotator itself does: it
     lets `node --test` require this renderer and check that the notation is
     actually decoded, rather than that guarantee living only in a browser. */
  function notation() {
    return scope && scope.NotationMarkup ? scope.NotationMarkup
      : require('../utils/notation-markup.js');
  }

  function icons() {
    return scope && scope.Icons ? scope.Icons : require('../utils/icons.js');
  }

  function annotator(sectionId) {
    return notation().createAnnotator({ sectionId: sectionId });
  }

  function step(entry, index, mark) {
    return '<div class="step">' +
      '<div class="step-n">' + (index + 1) + '</div>' +
      '<div>' +
      '<div class="step-do">' + mark.annotate(entry.do) + '</div>' +
      '<div class="step-why">' + mark.annotate(entry.why) + '</div>' +
      '<div class="step-work">' + mark.annotate(entry.work) + '</div>' +
      (entry.result ? '<div class="step-result">' + mark.annotate(entry.result) + '</div>' : '') +
      '</div></div>';
  }

  function header(entry, mark) {
    return '<header>' +
      '<div class="we-title">' + mark.annotate(entry.title) + '</div>' +
      (entry.goal ? '<div class="we-goal">' + mark.annotate(entry.goal) + '</div>' : '') +
      (entry.setup
        ? '<div class="we-setup"><strong>Setup:</strong> ' + mark.annotate(entry.setup) + '</div>'
        : '') +
      '</header>';
  }

  function example(entry, sectionId) {
    const mark = annotator(sectionId);
    return '<article class="worked-example">' +
      header(entry, mark) +
      (entry.steps || []).map(function (item, index) {
        return step(item, index, mark);
      }).join('') +
      (entry.answer
        ? '<div class="we-answer"><strong>Answer:</strong> ' + mark.annotate(entry.answer) + '</div>'
        : '') +
      '</article>';
  }

  function markup(entries, options) {
    if (!entries || !entries.length) return '';
    const sectionId = options && options.sectionId;
    return '<section class="section-block">' +
      icons().heading('examples', 'Worked examples') +
      entries.map(function (entry) { return example(entry, sectionId); }).join('') +
      '</section>';
  }

  return { markup: markup };
}));

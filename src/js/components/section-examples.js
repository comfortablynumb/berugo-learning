/**
 * Renders worked examples.
 *
 * Each step states what to do, why, the arithmetic with real numbers, and the
 * result. The `work` field is monospaced and preserved verbatim, because the
 * numbers are the teaching - a worked example with no arithmetic is a summary.
 * Where a step states a computed figure, a unit test recomputes it, so editing
 * the setup without editing the numbers fails the build.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SectionExamples = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  function esc(value) {
    return scope.Helpers.escapeHtml(value);
  }

  function step(entry, index) {
    return '<div class="step">' +
      '<div class="step-n">' + (index + 1) + '</div>' +
      '<div>' +
      '<div class="step-do">' + esc(entry.do) + '</div>' +
      '<div class="step-why">' + esc(entry.why) + '</div>' +
      '<div class="step-work">' + esc(entry.work) + '</div>' +
      (entry.result ? '<div class="step-result">' + esc(entry.result) + '</div>' : '') +
      '</div></div>';
  }

  function example(entry) {
    return '<article class="worked-example">' +
      '<header>' +
      '<div class="we-title">' + esc(entry.title) + '</div>' +
      (entry.goal ? '<div class="we-goal">' + esc(entry.goal) + '</div>' : '') +
      (entry.setup ? '<div class="we-setup"><strong>Setup:</strong> ' + esc(entry.setup) + '</div>' : '') +
      '</header>' +
      (entry.steps || []).map(step).join('') +
      (entry.answer ? '<div class="we-answer"><strong>Answer:</strong> ' + esc(entry.answer) + '</div>' : '') +
      '</article>';
  }

  function markup(entries) {
    if (!entries || !entries.length) return '';
    return '<section class="section-block">' +
      '<h3>Worked examples</h3>' +
      entries.map(example).join('') +
      '</section>';
  }

  return { markup: markup };
}));

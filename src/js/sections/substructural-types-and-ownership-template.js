/** Markup for "Substructural types and ownership". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.OwnershipTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'own-program', kind: 'select', label: 'the program', value: 'sharedAndMutable',
      options: [
        { value: 'moveOnce', label: 'a clean move' },
        { value: 'moveThenUse', label: 'use after move' },
        { value: 'doubleDrop', label: 'the double free' },
        { value: 'leak', label: 'created and never consumed' },
        { value: 'sharedTwice', label: 'two shared borrows at once' },
        { value: 'sharedAndMutable', label: 'a mutable borrow while a shared one is live' },
        { value: 'mutableTwice', label: 'two mutable borrows' },
        { value: 'writeThroughShared', label: 'writing through a shared borrow' },
        { value: 'useAfterRelease', label: 'the borrow outlived its scope' },
        { value: 'moveWhileBorrowed', label: 'moving out from under a live borrow' },
        { value: 'mutableThenRelease', label: 'one mutable borrow at a time' },
        { value: 'useTwice', label: 'two direct uses of an owner' }
      ] },
    { id: 'own-discipline', kind: 'select', label: 'the structural discipline', value: 'affine',
      options: [
        { value: 'unrestricted', label: 'unrestricted — use it any number of times' },
        { value: 'affine', label: 'affine — at most once' },
        { value: 'relevant', label: 'relevant — at least once' },
        { value: 'linear', label: 'linear — exactly once' }
      ] }
  ];

  const METRICS = [
    { id: 'own-accepted', label: 'Accepted', note: 'by the borrow rules and the discipline' },
    { id: 'own-borrow', label: 'Borrow errors', note: 'aliasing, mutation and lifetime' },
    { id: 'own-structural', label: 'Structural errors', note: 'too many uses, or too few' },
    { id: 'own-first', label: 'The first thing wrong', note: 'with the line that caused it' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Program and discipline', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The program, line by line</div>' +
      '<div class="card-body"><table class="ref-table" id="own-source"><thead><tr>' +
      '<th>#</th><th>Statement</th><th>What it does</th><th>Verdict</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="own-source-caption"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Every error, with the earlier line responsible</div>' +
      '<div class="card-body"><table class="ref-table" id="own-errors"><thead><tr>' +
      '<th>Line</th><th>Statement</th><th>Problem</th><th>Blame</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="own-errors-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Every program against every discipline</div>' +
      '<div class="card-body"><table class="ref-table" id="own-matrix"><thead><tr>' +
      '<th>Program</th><th>Unrestricted</th><th>Affine</th><th>Relevant</th><th>Linear</th>' +
      '<th>What separates them</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="own-matrix-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The two structural rules, and what dropping each buys</div>' +
      '<div class="card-body"><table class="ref-table" id="own-disciplines"><thead><tr>' +
      '<th>Discipline</th><th>Use twice</th><th>Never use</th><th>What it gives you</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="own-disciplines-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The statement forms the checker understands</div>' +
      '<div class="card-body"><table class="ref-table" id="own-statements"><thead><tr>' +
      '<th>Form</th><th>Reads as</th><th>Consumes the owner</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="own-statements-caption"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));

/** Markup for "SSA form". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SsaTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const SAMPLES = {
    loop: 'let t = 0;\nfor v in [1, 2, 3] { t = t + v; }',
    branch: 'let a = 3;\nlet b = if a < 5 { a * 2 } else { a - 1 };\nlet c = b + 1;',
    both: 'let t = 0;\nfor v in [1, 2, 3, 4] {\n  if v > 2 { t = t + v; } else { t = t - 1; }\n}',
    swap: 'let a = 1;\nlet b = 2;\nlet i = 0;\nwhile i < 3 {\n  let old = a;\n  a = b;\n  b = old;\n  i = i + 1;\n}',
    straight: 'let a = 1;\nlet b = a + 2;\nlet c = b * 3;'
  };

  const CONTROLS = [
    { id: 'ss-sample', kind: 'select', label: 'program', value: 'loop',
      options: [
        { value: 'loop', label: 'a loop — the phi that makes SSA necessary' },
        { value: 'branch', label: 'an if in expression position' },
        { value: 'both', label: 'a branch inside a loop' },
        { value: 'swap', label: 'two variables exchanged — the swap problem on destruction' },
        { value: 'straight', label: 'straight-line code — no phi at all' }
      ] },
    { id: 'ss-prune', kind: 'checkbox', label: 'prune phis nothing reads', value: true,
      note: 'the difference between minimal and pruned SSA' },
    { id: 'ss-stage', kind: 'select', label: 'show the IR', value: 'after',
      options: [
        { value: 'before', label: 'before — slots, loads and stores' },
        { value: 'after', label: 'after construction — registers and phis' },
        { value: 'destructed', label: 'after destruction — phis back to copies' }
      ] }
  ];

  const METRICS = [
    { id: 'ss-placed', label: 'Phis placed', note: 'one per slot per frontier block' },
    { id: 'ss-pruned', label: 'Pruned', note: 'placed, then found to have no reader' },
    { id: 'ss-slots', label: 'Slots promoted',
      note: 'every load became a copy, every store disappeared' },
    { id: 'ss-checked', label: 'SSA property', note: 'one definition each, every use dominated' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'A program, and which stage to show',
        controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The IR</div>' +
      '<div class="card-body"><div id="ss-listing"></div>' +
      '<p class="note" id="ss-listing-caption"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Every phi, and the dominance frontier that justified it</div>' +
      '<div class="card-body"><table class="ref-table" id="ss-phis"><thead><tr>' +
      '<th>Block</th><th>Phi</th><th>For the local</th><th>Written in</th><th>Kept</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ss-phis-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Minimal against pruned, over the conformance suite</div>' +
      '<div class="card-body"><table class="ref-table" id="ss-prune-table"><thead><tr>' +
      '<th>Program</th><th>Placed</th><th>Pruned away</th><th>Kept</th><th>Instructions</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ss-prune-table-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Destruction: the copies it inserts, and the cycles it breaks' +
      '</div>' +
      '<div class="card-body"><table class="ref-table" id="ss-destruct"><thead><tr>' +
      '<th>Program</th><th>Phis</th><th>Copies inserted</th><th>Temporaries</th>' +
      '<th>Behaviour preserved</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ss-destruct-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The SSA property, checked on every program</div>' +
      '<div class="card-body"><table class="ref-table" id="ss-check"><thead><tr>' +
      '<th>Program</th><th>Registers</th><th>Single definition</th><th>Uses dominated</th>' +
      '<th>Agrees with the core</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ss-check-caption"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS, SAMPLES: SAMPLES };
}));

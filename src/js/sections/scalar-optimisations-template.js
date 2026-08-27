/** Markup for "Scalar optimisations". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ScalarTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const SAMPLES = {
    guarded: 'let flag = false;\nlet n = if flag { 1 / 0 } else { 7 };\nlet r = n + 1;',
    redundant: 'let a = 1;\nlet b = 2;\nlet c = a + b;\nlet d = a + b;\nlet e = c + d;',
    /* The operands must NOT be constants, or SCCP folds the whole thing before
       the peephole rules see it — which is what the first version of this
       fixture did, and it reported every rule firing zero times. A parameter
       is the cheapest non-constant this language has. */
    identities: 'fn keep(x) { return x + 0; }\nfn same(x) { return x * 1; }\n'
      + 'fn zero(x) { return x * 0; }\nfn none(x) { return x - x; }\n'
      + 'let r = keep(5) + same(6) + zero(7) + none(8);',
    folding: 'let a = 2 * 3;\nlet b = a + 4;\nlet c = if b < 20 { b * 2 } else { 0 };',
    loop: 'let t = 0;\nfor v in [1, 2, 3] { t = t + v * 2; }'
  };

  const CONTROLS = [
    { id: 'so-sample', kind: 'select', label: 'program', value: 'guarded',
      options: [
        { value: 'guarded', label: 'a division guarded by a condition SCCP can prove false' },
        { value: 'redundant', label: 'the same expression computed twice' },
        { value: 'identities', label: 'four algebraic identities in a row' },
        { value: 'folding', label: 'constants through a branch' },
        { value: 'loop', label: 'a loop — the SSA copies are what copy propagation removes' }
      ] },
    { id: 'so-pipeline', kind: 'select', label: 'pipeline', value: 'full',
      options: [
        { value: 'full', label: 'the full pipeline' },
        { value: 'sccp', label: 'SCCP alone' },
        { value: 'plain', label: 'copy propagation and folding, without reachability' },
        { value: 'none', label: 'SSA construction only' }
      ] },
    { id: 'so-order-a', kind: 'select', label: 'phase ordering: first pass', value: 'sccp',
      options: [
        { value: 'sccp', label: 'sccp' },
        { value: 'value-numbering', label: 'value numbering' },
        { value: 'copy-propagation', label: 'copy propagation' },
        { value: 'peephole', label: 'peephole' }
      ] },
    { id: 'so-order-b', kind: 'select', label: 'phase ordering: second pass',
      value: 'value-numbering',
      options: [
        { value: 'value-numbering', label: 'value numbering' },
        { value: 'sccp', label: 'sccp' },
        { value: 'copy-propagation', label: 'copy propagation' },
        { value: 'peephole', label: 'peephole' }
      ] }
  ];

  const METRICS = [
    { id: 'so-size', label: 'Instructions', note: 'before and after the chosen pipeline' },
    { id: 'so-folded', label: 'Values folded', note: 'by SCCP, including through dead branches' },
    { id: 'so-dead', label: 'Instructions removed', note: 'nothing reads them' },
    { id: 'so-agrees', label: 'Behaviour preserved', note: 'checked after every pass' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'A program, a pipeline and two orders',
        controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The IR after the chosen pipeline</div>' +
      '<div class="card-body"><div id="so-listing"></div>' +
      '<p class="note" id="so-listing-caption"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Every pass in the pipeline, and its three gates</div>' +
      '<div class="card-body"><table class="ref-table" id="so-passes"><thead><tr>' +
      '<th>Pass</th><th>Instructions</th><th>Changed</th><th>Verifies</th><th>SSA holds</th>' +
      '<th>Same answer</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="so-passes-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">What SCCP proves that constant propagation alone cannot</div>' +
      '<div class="card-body"><table class="ref-table" id="so-sccp"><thead><tr>' +
      '<th>Pipeline</th><th>Instructions</th><th>Blocks removed</th><th>Branches straightened</th>' +
      '<th>Values folded</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="so-sccp-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Phase ordering: the same two passes, both ways round</div>' +
      '<div class="card-body"><table class="ref-table" id="so-order"><thead><tr>' +
      '<th>Program</th><th>A then B</th><th>B then A</th><th>Difference</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="so-order-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The peephole rules, and how often each fires</div>' +
      '<div class="card-body"><table class="ref-table" id="so-rules"><thead><tr>' +
      '<th>Rule</th><th>What it rewrites</th><th>Fires here</th><th>Across the suite</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="so-rules-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The conformance suite through the full pipeline</div>' +
      '<div class="card-body"><table class="ref-table" id="so-suite"><thead><tr>' +
      '<th>Program</th><th>Before</th><th>After</th><th>Removed</th><th>Ratio</th>' +
      '<th>Every gate</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="so-suite-caption"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS, SAMPLES: SAMPLES };
}));

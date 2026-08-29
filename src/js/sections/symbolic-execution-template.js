/** Markup for "Symbolic execution". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SymbolicTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  function ladder(k) {
    const body = [];

    for (let at = 1; at <= k; at += 1) {
      body.push('  if (a > ' + at + ') { r = r + ' + at + '; } else { r = r - ' + at + '; }');
    }
    return 'fn ladder(a) {\n  let r = 0;\n' + body.join('\n') + '\n  return r;\n}\n'
      + 'let z = ladder(0);';
  }

  const SAMPLES = {
    classify: { name: 'classify', names: ['a', 'b'],
      about: 'three leaves, every one of them reachable',
      source: 'fn classify(a, b) {\n  let r = 0;\n'
        + '  if (a > 10) { if (b < 0) { r = 1; } else { r = 2; } } else { r = 3; }\n'
        + '  return r;\n}\nlet z = classify(1, 2);' },
    dead: { name: 'guard', names: ['a'],
      about: 'a branch no input can take, which is dead code and worth a warning',
      source: 'fn guard(a) {\n  let r = 0;\n'
        + '  if (a > 10) { if (a < 5) { r = 1; } else { r = 2; } } else { r = 3; }\n'
        + '  return r;\n}\nlet z = guard(0);' },
    ladder: { name: 'ladder', names: ['a'], about: 'five branches, thirty-two paths, six of '
      + 'them real', source: ladder(5) },
    wide: { name: 'ladder', names: ['a'], about: 'seven branches: the tree doubles and the '
      + 'answer does not', source: ladder(7) },
    loop: { name: 'total', names: ['n'],
      about: 'a loop whose bound is a symbol, so the tree has no end',
      source: 'fn total(n) {\n  let t = 0;\n  let i = 0;\n'
        + '  while (i < n) { t = t + i; i = i + 1; }\n  return t;\n}\nlet z = total(3);' },
    opaque: { name: 'scale', names: ['a', 'b'],
      about: 'a product of two symbols, which leaves the fragment the executor can reason in',
      source: 'fn scale(a, b) {\n  let p = a * b;\n  let r = 0;\n'
        + '  if (p > 20) { r = 1; } else { r = 2; }\n  return r;\n}\nlet z = scale(2, 3);' }
  };

  const CONTROLS = [
    { id: 'sye-sample', kind: 'select', label: 'programme', value: 'classify',
      options: [
        { value: 'classify', label: 'a nested branch, three reachable leaves' },
        { value: 'dead', label: 'a guard with an impossible inner branch' },
        { value: 'ladder', label: 'five independent branches' },
        { value: 'wide', label: 'seven branches — the tree doubles' },
        { value: 'loop', label: 'a loop with a symbolic bound' },
        { value: 'opaque', label: 'a product of two symbols' }
      ] },
    { id: 'sye-decide', kind: 'select', label: 'deciding a path condition', value: 'linear',
      options: [
        { value: 'search', label: 'bounded search only — cannot prove infeasible' },
        { value: 'linear', label: 'plus the linear theory solver from 32.6' }
      ] },
    { id: 'sye-paths', kind: 'range', label: 'path budget', value: 64, min: 4, max: 160,
      step: 4 },
    { id: 'sye-depth', kind: 'range', label: 'depth budget', value: 24, min: 4, max: 60,
      step: 4 }
  ];

  const METRICS = [
    { id: 'sye-paths-found', label: 'Paths the search reached', note: 'leaves of the tree' },
    { id: 'sye-feasible', label: 'Feasible, with an input', note: 'the solver produced a model' },
    { id: 'sye-dead', label: 'Proved impossible', note: 'dead code, and a finding in itself' },
    { id: 'sye-unknown', label: 'Undecided', note: 'no model found and no proof either way' },
    { id: 'sye-truncated', label: 'Paths abandoned at a budget',
      note: 'silently truncating here would fake coverage' },
    { id: 'sye-verified', label: 'Inputs that really reached their path',
      note: 'each one executed and checked' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Run it with symbols, then solve for an input',
        controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The programme</div>' +
      '<div class="card-body"><pre class="code-block" id="sye-source"></pre>' +
      '<p class="note" id="sye-source-caption"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      card('sye-tree', 'Every path, its condition, and the input that follows it',
        ['Blocks', 'Path condition', 'Verdict', 'Input', 'Executed and reached it?']) +
      chartCard() +
      card('sye-coverage', 'What the generated inputs actually cover',
        ['Block', 'Reached by', 'First input that got there', 'Paths through it']) +
      card('sye-bounds', 'Every real tool bounds the tree somewhere',
        ['Strategy', 'What it bounds', 'What it costs', 'What it is called in the wild']);
  }

  function chartCard() {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Branches against paths: the tree, and the part of it that '
      + 'exists</div><div class="card-body"><div id="sye-chart" class="chart-host"></div>' +
      '<div id="sye-legend" class="legend-host"></div>' +
      '<p class="note" id="sye-chart-note"></p></div></div>';
  }

  function card(id, title, columns) {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">' + title + '</div>' +
      '<div class="card-body"><table class="ref-table" id="' + id + '"><thead><tr>' +
      columns.map(function (name) { return '<th>' + name + '</th>'; }).join('') +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="' + id + '-caption"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS,
    SAMPLES: SAMPLES, ladder: ladder };
}));

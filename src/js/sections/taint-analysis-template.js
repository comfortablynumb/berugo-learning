/** Markup for "Type-based and flow-sensitive analysis". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.TaintTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  /* Every fixture is a whole programme: the source, sink and sanitiser are
     declared in it so the dynamic oracle can run the thing the static
     analysis is reading. The policy decides what those three MEAN. */
  const PRELUDE = [
    'fn readParam(k) { return k + 1; }',
    'fn escape(v) { return v * 2; }',
    'fn query(s) { return s; }',
    'fn log(v) { return 0; }',
    'fn wrap(v) { return v + 1; }',
    ''
  ].join('\n');

  const SAMPLES = {
    direct: { about: 'one tainted value and one sanitised one, into the same sink',
      body: 'let raw = readParam(7);\nlet safe = escape(raw);\nlet a = query(raw);\n'
        + 'let b = query(safe);\nlet r = a + b;' },
    record: { about: 'a record holding one tainted field and one clean one',
      body: 'let raw = readParam(7);\nlet clean = 5;\nlet box = { bad: raw, good: clean };\n'
        + 'let a = query(box.good);\nlet b = query(box.bad);\nlet r = a + b;' },
    array: { about: 'an array holding one of each, which no field sensitivity separates',
      body: 'let raw = readParam(7);\nlet clean = 5;\nlet arr = [raw, clean];\n'
        + 'let r = query(arr[1]);' },
    backedge: { about: 'taint that only arrives on the second pass round the loop',
      body: 'let t = 0;\nlet u = 0;\nlet i = 0;\n'
        + 'while (i < 3) { u = t; t = readParam(i); i = i + 1; }\nlet r = query(u);' },
    branchy: { about: 'sanitised on one path and not on the other',
      body: 'let raw = readParam(7);\nlet v = 0;\n'
        + 'if (raw > 3) { v = escape(raw); } else { v = raw; }\nlet r = query(v);' },
    ignores: { about: 'a function that throws its argument away, and is not believed',
      body: 'let raw = readParam(7);\nlet z = log(raw);\nlet r = query(z);' }
  };

  const CONTROLS = [
    { id: 'tnt-sample', kind: 'select', label: 'fixture', value: 'record',
      options: [
        { value: 'direct', label: 'a sink reached twice, once sanitised' },
        { value: 'record', label: 'a record with a tainted field and a clean one' },
        { value: 'array', label: 'an array with one of each' },
        { value: 'backedge', label: 'taint arriving round a loop' },
        { value: 'branchy', label: 'sanitised on one branch only' },
        { value: 'ignores', label: 'a callee that ignores its argument' }
      ] },
    { id: 'tnt-fields', kind: 'select', label: 'container precision', value: 'insensitive',
      options: [
        { value: 'insensitive', label: 'field-insensitive — one location per container' },
        { value: 'sensitive', label: 'field-sensitive — one location per record field' }
      ] }
  ];

  const METRICS = [
    { id: 'tnt-findings', label: 'Findings the analysis reports',
      note: 'every sink it believes a tainted value can reach' },
    { id: 'tnt-confirmed', label: 'Confirmed by the run', note: 'a tainted value really arrived' },
    { id: 'tnt-spurious', label: 'Clean on the observed run',
      note: 'reported, and this run refutes it' },
    { id: 'tnt-missed', label: 'Reached tainted and not reported',
      note: 'a false negative, which is the failure that matters' },
    { id: 'tnt-rounds', label: 'Fixpoint rounds', note: 'taint can arrive on a back edge' },
    { id: 'tnt-hops', label: 'Longest propagation path',
      note: 'steps from the source to the sink' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Source, sink, sanitiser — and what really arrived',
        controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The fixture</div>' +
      '<div class="card-body"><pre class="code-block" id="tnt-source"></pre>' +
      '<p class="note" id="tnt-source-caption"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      card('tnt-sinks', 'Every sink the programme reaches, judged twice',
        ['Line', 'Sink', 'The analysis says', 'The run saw', 'Verdict']) +
      card('tnt-path', 'The propagation path, hop by hop',
        ['Hop', 'What happened', 'Instruction', 'Value it produced']) +
      chartCard() +
      card('tnt-sweep', 'The policy is the model, and both of its failures have a price',
        ['Change to the policy', 'Findings', 'Change', 'Which way it fails']) +
      card('tnt-family', 'Four analyses with the same shape and different facts',
        ['Analysis', 'The fact it tracks', 'What it is for', 'How it is usually wrong']);
  }

  function chartCard() {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Findings the run refutes, per fixture, at both precisions' +
      '</div><div class="card-body"><div id="tnt-chart" class="chart-host"></div>' +
      '<div id="tnt-legend" class="legend-host"></div>' +
      '<p class="note" id="tnt-chart-note"></p></div></div>';
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
    SAMPLES: SAMPLES, PRELUDE: PRELUDE };
}));

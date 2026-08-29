/** Markup for "Dynamic analysis". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.DynamicTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  function e(thread, op, target) { return { thread: thread, op: op, target: target }; }

  const TRACES = {
    unsynchronised: { about: 'two threads writing one location with nothing between them',
      trace: [e('t1', 'write', 'balance'), e('t2', 'write', 'balance')] },
    locked: { about: 'the same two updates, both inside the same lock',
      trace: [e('t1', 'acquire', 'L'), e('t1', 'read', 'balance'),
        e('t1', 'write', 'balance'), e('t1', 'release', 'L'),
        e('t2', 'acquire', 'L'), e('t2', 'read', 'balance'),
        e('t2', 'write', 'balance'), e('t2', 'release', 'L')] },
    differentLocks: { about: 'both updates locked, and not by the same lock',
      trace: [e('t1', 'acquire', 'L1'), e('t1', 'write', 'balance'), e('t1', 'release', 'L1'),
        e('t2', 'acquire', 'L2'), e('t2', 'write', 'balance'), e('t2', 'release', 'L2')] },
    partial: { about: 'one access outside the lock, which is all it takes',
      trace: [e('t1', 'acquire', 'L'), e('t1', 'write', 'shared'), e('t1', 'release', 'L'),
        e('t2', 'read', 'shared'),
        e('t2', 'acquire', 'L'), e('t2', 'write', 'shared'), e('t2', 'release', 'L')] },
    handover: { about: 'initialised before the fork, read after it — ordered, not locked',
      trace: [e('main', 'write', 'config'), e('main', 'fork', 'worker'),
        e('worker', 'read', 'config'), e('worker', 'write', 'result'),
        e('main', 'join', 'worker'), e('main', 'read', 'result')] },
    readOnly: { about: 'two threads reading a table nobody writes',
      trace: [e('t1', 'read', 'table'), e('t2', 'read', 'table')] },
    published: { about: 'written under a lock, then handed to a new thread that writes it',
      trace: [e('t1', 'acquire', 'L'), e('t1', 'write', 'queue'), e('t1', 'release', 'L'),
        e('t1', 'fork', 't2'), e('t2', 'write', 'queue')] }
  };

  const CONTROLS = [
    { id: 'dya-trace', kind: 'select', label: 'trace', value: 'handover',
      options: Object.keys(TRACES).map(function (id) {
        return { value: id, label: id + ' — ' + TRACES[id].about };
      }) },
    { id: 'dya-lockset', kind: 'select', label: 'the lockset algorithm', value: 'naive',
      options: [
        { value: 'naive', label: 'plain lockset — report an empty candidate set' },
        { value: 'eraser', label: 'Eraser\'s state machine — report only shared-modified' }
      ] }
  ];

  const METRICS = [
    { id: 'dya-real', label: 'Races that can really happen',
      note: 'from every schedule, enumerated' },
    { id: 'dya-schedules', label: 'Schedules the oracle explored',
      note: 'exhaustive, or it proves nothing' },
    { id: 'dya-hb', label: 'Happens-before reports', note: 'vector clocks over one trace' },
    { id: 'dya-lockset-reports', label: 'Lockset reports', note: 'the locks held at each access' },
    { id: 'dya-false', label: 'Reported and impossible',
      note: 'false positives, against the oracle' },
    { id: 'dya-missed', label: 'Possible and unreported',
      note: 'false negatives, which are the ones that matter' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Two detectors, one trace, and every schedule',
        controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The observed trace</div>' +
      '<div class="card-body"><pre class="code-block" id="dya-trace-text"></pre>' +
      '<p class="note" id="dya-trace-caption"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      card('dya-verdicts', 'Every fixture, both detectors, against every schedule',
        ['Trace', 'Can happen', 'Happens-before says', 'Lockset says', 'Where they differ']) +
      chartCard() +
      card('dya-events', 'This trace, event by event',
        ['#', 'Thread', 'Operation', 'Location', 'What the detectors make of it']) +
      card('dya-coverage', 'Coverage criteria, and what each one still misses',
        ['Criterion', 'What it requires', 'What it misses', 'What it costs']) +
      card('dya-overhead', 'Where the instrumentation goes, and what it costs',
        ['Strategy', 'What it can see', 'Typical overhead', 'What it cannot see']);
  }

  function chartCard() {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Reports against reality, over all seven traces</div>' +
      '<div class="card-body"><div id="dya-chart" class="chart-host"></div>' +
      '<p class="note" id="dya-chart-note"></p></div></div>';
  }

  function card(id, title, columns) {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">' + title + '</div>' +
      '<div class="card-body"><table class="ref-table" id="' + id + '"><thead><tr>' +
      columns.map(function (name) { return '<th>' + name + '</th>'; }).join('') +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="' + id + '-caption"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS, TRACES: TRACES };
}));

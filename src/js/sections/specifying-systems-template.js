/** Markup for "Specifying and verifying systems". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SpecTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  /**
   * A retry protocol, written as data. A message may be lost, the client
   * retries, and the server applies the request — twice, unless it remembers
   * the key it has already seen. Every field here is a string or a boolean,
   * which is what lets the whole spec be printed in a table and read by
   * somebody who will never run it.
   */
  function retrySpec(options) {
    const settings = options || {};
    const deduplicates = Boolean(settings.deduplicates);
    const actions = [
      { name: 'the client sends the request', when: ['!sent'], then: { sent: true } },
      { name: 'the network loses it', when: ['sent', '!applied', '!lost'],
        then: { lost: true } },
      { name: 'the server applies it', when: ['sent', '!applied'], then: { applied: true } },
      { name: 'the client retries after the loss', when: ['lost', '!retried'],
        then: { retried: true } }
    ];

    actions.push(deduplicates
      ? { name: 'the server sees the key again and does nothing',
        when: ['retried', 'applied', '!ignored'], then: { ignored: true } }
      : { name: 'the server applies the retry as well',
        when: ['retried', 'applied', '!twice'], then: { twice: true } });
    return { name: deduplicates ? 'retry with an idempotence key' : 'retry with no key',
      vars: ['sent', 'lost', 'applied', 'retried', 'twice', 'ignored'],
      init: { sent: false, lost: false, applied: false, retried: false, twice: false,
        ignored: false },
      actions: actions,
      invariants: [{ name: 'no request is applied twice', when: ['twice'],
        require: ['!twice'] }] };
  }

  const SPECS = {
    twoPhase: { about: 'two-phase commit, with the coordinator allowed to fail',
      build: function (dsl) { return dsl.twoPhaseCommit({ crash: true }); } },
    twoPhaseSafe: { about: 'the same protocol with no failure modelled at all',
      build: function (dsl) { return dsl.twoPhaseCommit({ crash: false }); } },
    retry: { about: 'a lost message and a retry, with no idempotence key',
      build: function () { return retrySpec({ deduplicates: false }); } },
    retryKeyed: { about: 'the same protocol with the server remembering the key',
      build: function () { return retrySpec({ deduplicates: true }); } }
  };

  const CONTROLS = [
    { id: 'spy-spec', kind: 'select', label: 'specification', value: 'twoPhase',
      options: [
        { value: 'twoPhase', label: 'two-phase commit, coordinator may fail' },
        { value: 'twoPhaseSafe', label: 'two-phase commit, no failures modelled' },
        { value: 'retry', label: 'retry after a lost message, no idempotence key' },
        { value: 'retryKeyed', label: 'retry with an idempotence key' }
      ] },
    { id: 'spy-view', kind: 'select', label: 'state table shows', value: 'all',
      options: [
        { value: 'all', label: 'every reachable state' },
        { value: 'broken', label: 'only the states that break an invariant' }
      ] }
  ];

  const METRICS = [
    { id: 'spy-vars', label: 'Variables and actions', note: 'the whole specification' },
    { id: 'spy-reachable', label: 'Reachable states',
      note: 'of everything the variables allow' },
    { id: 'spy-edges', label: 'Transitions', note: 'action instances between reachable states' },
    { id: 'spy-verdict', label: 'Invariants', note: 'over every reachable state' },
    { id: 'spy-depth', label: 'Steps to the counter-example', note: 'shortest, breadth-first' },
    { id: 'spy-replay', label: 'Trace replayed', note: 'every guard re-checked against the spec' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'A specification is data, and data can be checked',
        controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The specification</div>' +
      '<div class="card-body"><pre class="code-block" id="spy-spec-text"></pre>' +
      '<p class="note" id="spy-spec-caption"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      card('spy-actions', 'The actions, as written and as checked',
        ['Action', 'When', 'Then']) +
      card('spy-trace', 'The counter-example, in the specification\'s own words',
        ['Step', 'Action', 'What changed', 'What holds afterwards', 'Invariant']) +
      chartCard() +
      card('spy-states', 'The reachable state space',
        ['State', 'What holds', 'Invariants']) +
      card('spy-industry', 'What the industrial reports actually say',
        ['System', 'What was specified', 'What it found', 'What it cost']);
  }

  function chartCard() {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">What each specification costs to check</div>' +
      '<div class="card-body"><div id="spy-chart" class="chart-host"></div>' +
      '<p class="note" id="spy-chart-note"></p></div></div>';
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
    SPECS: SPECS, retrySpec: retrySpec };
}));

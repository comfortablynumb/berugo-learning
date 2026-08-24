/** Markup for "Threat models and primitive selection". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ThreatModelsTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'thr-goal', kind: 'select', label: 'what you need', value: 'confidentiality and integrity of a message',
      options: [
        { value: 'confidentiality and integrity of a message', label: 'encrypt a message' },
        { value: 'authenticity of a message between two parties who share a key', label: 'authenticate a message (shared key)' },
        { value: 'authenticity verifiable by a third party', label: 'authenticate to a third party' },
        { value: 'store user passwords', label: 'store passwords' },
        { value: 'derive keys from a shared secret', label: 'derive keys' },
        { value: 'agree a key over an untrusted network', label: 'agree a key' },
        { value: 'random values for keys, nonces or tokens', label: 'generate randomness' }
      ] }
  ];

  const METRICS = [
    { id: 'thr-primitive', label: 'The primitive', note: 'what answers this requirement' },
    { id: 'thr-parameters', label: 'The parameters', note: 'and they are the part that gets chosen wrongly' },
    { id: 'thr-failure', label: 'The classic failure', note: 'what goes wrong in production' },
    { id: 'thr-vectors', label: 'Test vectors passing', note: 'every primitive here, against its published values' }
  ];

  function render() {
    return '<div class="callout callout-warning" id="thr-disclaimer"></div>' +
      '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'State the requirement', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The audited API this path ends at</div>' +
      '<div class="card-body"><div id="thr-answer"></div>' +
      '<p class="note" id="thr-answer-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Requirement to primitive: the whole map</div>' +
      '<div class="card-body"><table class="ref-table" id="thr-map"><thead><tr>' +
      '<th>What you need</th><th>Against whom</th><th>Primitive</th><th>Parameters</th>' +
      '<th>The classic failure</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="thr-map-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Every primitive in this milestone, against its published vectors</div>' +
      '<div class="card-body"><table class="ref-table" id="thr-vector-table"><thead><tr>' +
      '<th>Primitive</th><th>Source</th><th>Expected</th><th>Computed</th><th>Agrees</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="thr-vector-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Four goals people conflate</div>' +
      '<div class="card-body"><table class="ref-table" id="thr-goals"><thead><tr>' +
      '<th>Goal</th><th>The question it answers</th><th>What it does NOT give you</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="thr-goals-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));

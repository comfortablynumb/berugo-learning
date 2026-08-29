/** Markup for "Combinational logic design and minimisation". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LogicMinTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const FUNCTIONS = {
    hazard: { bits: 3, names: ['a', 'b', 'c'], minterms: [1, 5, 6, 7], dontCares: [],
      about: 'the textbook static hazard: two adjacent ones covered by different terms' },
    majority: { bits: 3, names: ['a', 'b', 'c'], minterms: [3, 5, 6, 7], dontCares: [],
      about: 'the carry of a full adder, and the function every minimiser gets right' },
    trap: { bits: 3, names: ['a', 'b', 'c'], minterms: [0, 1, 2, 5, 6, 7], dontCares: [],
      about: 'no essential prime implicants at all, which is where greedy loses' },
    classic: { bits: 4, names: ['a', 'b', 'c', 'd'],
      minterms: [0, 1, 2, 5, 6, 7, 8, 9, 10, 14], dontCares: [],
      about: 'the four-variable exercise from every textbook' },
    dontCares: { bits: 4, names: ['a', 'b', 'c', 'd'], minterms: [1, 3, 7, 11, 15],
      dontCares: [0, 2, 5],
      about: 'three rows the specification does not constrain, and what they buy' },
    parity: { bits: 4, names: ['a', 'b', 'c', 'd'], minterms: [1, 2, 4, 7, 8, 11, 13, 14],
      dontCares: [],
      about: 'odd parity: the function two-level minimisation cannot help with at all' }
  };

  const CONTROLS = [
    { id: 'qmc-function', kind: 'select', label: 'function', value: 'classic',
      options: Object.keys(FUNCTIONS).map(function (id) {
        return { value: id, label: id + ' — ' + FUNCTIONS[id].about };
      }) },
    { id: 'qmc-cover', kind: 'select', label: 'covering step', value: 'greedy',
      options: [
        { value: 'greedy', label: 'essentials first, then greedy — what everybody ships' },
        { value: 'exact', label: 'the cheapest cover, by searching every subset' }
      ] },
    { id: 'qmc-redundant', kind: 'checkbox', label: 'add the redundant terms that remove hazards',
      value: false }
  ];

  const METRICS = [
    { id: 'qmc-minterms', label: 'Rows to cover', note: 'and the ones left free' },
    { id: 'qmc-primes', label: 'Prime implicants', note: 'terms that cannot be made larger' },
    { id: 'qmc-essential', label: 'Essential', note: 'forced: no other term covers that row' },
    { id: 'qmc-terms', label: 'Terms in the cover', note: 'and the literals they cost' },
    { id: 'qmc-gates', label: 'Gates in the built circuit', note: 'AND-OR, two levels' },
    { id: 'qmc-glitch', label: 'Outputs that glitch',
      note: 'measured by simulating the transition' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Truth table in, gates out',
        controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The Karnaugh map</div>' +
      '<div class="card-body"><table class="ref-table" id="qmc-kmap"><thead><tr></tr></thead>' +
      '<tbody></tbody></table><p class="note" id="qmc-kmap-caption"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      card('qmc-chart-table', 'The prime implicant chart',
        ['Term', 'As an expression', 'Rows it covers', 'Essential?', 'In the cover?']) +
      card('qmc-compare', 'Greedy against the cheapest cover',
        ['Method', 'Terms', 'Literals', 'Gates', 'Depth', 'Correct?']) +
      chartCard() +
      card('qmc-hazards', 'Where the minimised circuit glitches, and what fixes it',
        ['Adjacent rows', 'Variable that changes', 'Redundant term that covers both',
          'Output glitch measured?']) +
      card('qmc-flow', 'The design flow, and what each step can get wrong',
        ['Step', 'Input', 'Output', 'How it fails']);
  }

  function chartCard() {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">What minimisation is worth, per function</div>' +
      '<div class="card-body"><div id="qmc-chart" class="chart-host"></div>' +
      '<p class="note" id="qmc-chart-note"></p></div></div>';
  }

  function card(id, title, columns) {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">' + title + '</div>' +
      '<div class="card-body"><table class="ref-table" id="' + id + '"><thead><tr>' +
      columns.map(function (name) { return '<th>' + name + '</th>'; }).join('') +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="' + id + '-caption"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS, FUNCTIONS: FUNCTIONS };
}));

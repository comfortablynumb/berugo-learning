/** Markup for "Arithmetic circuits". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ArithTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const ADDERS = {
    ripple: { label: 'ripple carry — one full adder per bit',
      about: 'the carry walks the whole word, so the delay is linear in the width' },
    lookahead: { label: 'carry lookahead — every carry computed at once',
      about: 'two levels of logic per carry, and a gate count that grows quadratically' },
    select: { label: 'carry select — compute the top half twice and choose',
      about: 'buys back half the ripple for roughly double the adder' }
  };

  const CONTROLS = [
    { id: 'art-adder', kind: 'select', label: 'adder', value: 'ripple',
      options: Object.keys(ADDERS).map(function (id) {
        return { value: id, label: ADDERS[id].label };
      }) },
    { id: 'art-width', kind: 'select', label: 'width', value: '8',
      options: [{ value: '4', label: '4 bits' }, { value: '8', label: '8 bits' },
        { value: '16', label: '16 bits' }] },
    { id: 'art-a', kind: 'range', label: 'operand a', value: 255, min: 0, max: 255, step: 1 },
    { id: 'art-b', kind: 'range', label: 'operand b', value: 1, min: 0, max: 255, step: 1 },
    { id: 'art-carry', kind: 'checkbox', label: 'carry in', value: false }
  ];

  const METRICS = [
    { id: 'art-result', label: 'What the circuit computed', note: 'read off the output wires' },
    { id: 'art-gates', label: 'Gates', note: 'and the transistors they cost' },
    { id: 'art-depth', label: 'Critical path', note: 'gate delays, worst case over all inputs' },
    { id: 'art-settle', label: 'Settling time for these operands',
      note: 'measured, and data-dependent' },
    { id: 'art-checked', label: 'Vectors checked', note: 'against integer addition' },
    { id: 'art-verdict', label: 'Verdict', note: 'the arithmetic is the judge' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Add two numbers with gates', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Bit by bit, as the circuit sees it</div>' +
      '<div class="card-body"><table class="ref-table" id="art-bits"><thead><tr>' +
      '<th>Bit</th><th>a</th><th>b</th><th>carry in</th><th>sum</th><th>carry out</th>' +
      '<th>generate / propagate</th></tr></thead><tbody></tbody></table>' +
      '<p class="note" id="art-bits-caption"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      card('art-compare', 'Three adders at this width, measured the same way',
        ['Adder', 'Gates', 'Transistors', 'Depth', 'Worst-case settling', 'Correct?']) +
      chartCard() +
      card('art-scaling', 'What happens as the word gets wider',
        ['Width', 'Ripple gates / depth', 'Lookahead gates / depth', 'Select gates / depth',
          'Lookahead speed-up']) +
      card('art-multiply', 'Multiplication, and why it is not one gate delay',
        ['Width', 'Partial products', 'Gates', 'Depth', 'Against an adder of the same width']) +
      card('art-tricks', 'The arithmetic identities a datapath is built on',
        ['Operation', 'How the hardware does it', 'What it costs', 'What it means in software']);
  }

  function chartCard() {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Delay and area against width, for all three adders</div>' +
      '<div class="card-body"><div id="art-chart" class="chart-host"></div>' +
      '<p class="note" id="art-chart-note"></p></div></div>';
  }

  function card(id, title, columns) {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">' + title + '</div>' +
      '<div class="card-body"><table class="ref-table" id="' + id + '"><thead><tr>' +
      columns.map(function (name) { return '<th>' + name + '</th>'; }).join('') +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="' + id + '-caption"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS, ADDERS: ADDERS };
}));

/** Markup for "The BRV32 instruction set". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.EncodingTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const EXAMPLES = [
    { value: 'addi a0, zero, 5', label: 'addi a0, zero, 5 — I format' },
    { value: 'add a2, a0, a1', label: 'add a2, a0, a1 — R format' },
    { value: 'sw a1, 8(a0)', label: 'sw a1, 8(a0) — S format, split immediate' },
    { value: 'beq a0, a1, -4', label: 'beq a0, a1, -4 — B format, scrambled immediate' },
    { value: 'lui a0, 0x10000', label: 'lui a0, 0x10000 — U format' },
    { value: 'jal ra, 16', label: 'jal ra, 16 — J format, the worst scrambling' },
    { value: 'srai a1, a0, 3', label: 'srai a1, a0, 3 — funct7 above a 5-bit immediate' },
    { value: 'ecall', label: 'ecall — a fixed pattern' }
  ];

  const CONTROLS = [
    { id: 'enc-instruction', kind: 'select', label: 'instruction', value: 'sw a1, 8(a0)',
      options: EXAMPLES },
    { id: 'enc-flip', kind: 'range', label: 'flip this bit of the encoded word',
      value: 32, min: 0, max: 32, step: 1 },
    { id: 'enc-format', kind: 'select', label: 'format to explain below', value: 'B',
      options: [{ value: 'R', label: 'R — register to register' },
        { value: 'I', label: 'I — immediate and loads' },
        { value: 'S', label: 'S — stores' },
        { value: 'B', label: 'B — branches' },
        { value: 'U', label: 'U — upper immediate' },
        { value: 'J', label: 'J — jumps' }] }
  ];

  const METRICS = [
    { id: 'enc-word', label: 'Encoded word', note: 'thirty-two bits, always' },
    { id: 'enc-name', label: 'Decoded as', note: 'and the format it belongs to' },
    { id: 'enc-immediate', label: 'Immediate', note: 'reassembled from its pieces' },
    { id: 'enc-roundtrip', label: 'Round trip', note: 'encode then decode must return here' },
    { id: 'enc-flipped', label: 'With that bit flipped', note: 'what the word becomes' },
    { id: 'enc-reference', label: 'Against the specification', note: 'published encodings' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Type an instruction, read its bits',
        controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Every field of this word</div>' +
      '<div class="card-body"><table class="ref-table" id="enc-fields"><thead><tr>' +
      '<th>Field</th><th>Bits</th><th>Value</th><th>Means</th><th>Used here?</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="enc-fields-caption"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      card('enc-immediate-table', 'The immediate, gathered field by field',
        ['Goes to', 'Comes from', 'Bits', 'Value']) +
      card('enc-formats', 'The six formats, and what each one gives up',
        ['Format', 'Fields', 'Immediate bits', 'What it is for', 'What it cannot say']) +
      chartCard() +
      card('enc-published', 'Our encoder against published encodings',
        ['Instruction', 'This machine', 'The specification', 'Agree?']) +
      card('enc-scramble', 'Why the immediate bits are where they are',
        ['Observation', 'What it buys the decoder']);
  }

  function chartCard() {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Where the 32 bits go, per format</div>' +
      '<div class="card-body"><div id="enc-chart" class="chart-host"></div>' +
      '<p class="note" id="enc-chart-note"></p></div></div>';
  }

  function card(id, title, columns) {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">' + title + '</div>' +
      '<div class="card-body"><table class="ref-table" id="' + id + '"><thead><tr>' +
      columns.map(function (name) { return '<th>' + name + '</th>'; }).join('') +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="' + id + '-caption"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS, EXAMPLES: EXAMPLES };
}));

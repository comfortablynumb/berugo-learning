/**
 * Section: Contiguous memory, addresses and strides.
 *
 * One record type, two layouts, one query. The counters come from the memory
 * model's access log, so "bytes touched versus bytes needed" is measured.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'memory-layout';
  const FIELDS = [
    { name: 'id', type: 'i32' },
    { name: 'flag', type: 'u8' },
    { name: 'score', type: 'f64' },
    { name: 'rank', type: 'i16' }
  ];

  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render({
      sectionId: SECTION_ID,
      orientation: [
        'An array is an address and a stride. Element i lives at base + i × stride, which is why ' +
          'indexing is one multiply and an add, and why the stride — not the element count — decides ' +
          'how much memory a scan has to move.',
        'The stride is rarely the sum of the field sizes. Alignment rules put each field at an ' +
          'address divisible by its own width, and the padding that creates is invisible in the ' +
          'source and very visible in the byte count.',
        'The layout decision follows: interleave the fields (array of structs) and a query for one ' +
          'field drags the whole record through the cache; store each field contiguously (struct of ' +
          'arrays) and it reads only what it needs.'
      ],
      demo: { title: 'Interactive demo — bytes needed against bytes touched', markup: root.MemoryLayoutTemplate.render() },
      diagram: {
        title: 'Diagram — the same four fields, two layouts',
        caption: 'A query for one field reads a stride apart in AoS and consecutively in SoA.',
        definition: [
          'flowchart LR',
          '    subgraph AOS["Array of structs"]',
          '        A0["id|flag|pad|score|rank|pad"] --> A1["id|flag|pad|score|rank|pad"] --> A2["…"]',
          '    end',
          '    subgraph SOA["Struct of arrays"]',
          '        S0["id id id id …"]',
          '        S1["flag flag flag …"]',
          '        S2["score score score …"]',
          '    end'
        ].join('\n')
      },
      insight: 'AoS versus SoA is the highest-leverage layout decision in a hot loop, and it is ' +
        'invisible in every language that hides the layout from you. Reordering fields widest-first ' +
        'is the free half of the same idea.'
    }));

    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.MemoryLayoutTemplate.controls,
      onChange: function () { update(); }
    });

    update();
  }

  function fieldsFor(reorder) {
    return reorder ? root.MemoryModel.packed(FIELDS).fields.map(function (field) {
      return { name: field.name, type: field.type };
    }) : FIELDS;
  }

  function update() {
    const values = panel.values();
    const fields = fieldsFor(values['mem-reorder']);
    const array = root.LinearStructures.createRecordArray({
      fields: fields,
      count: values['mem-count'],
      soa: values['mem-layout'] === 'soa'
    });

    fill(array, values['mem-count']);
    const result = array.sumField(values['mem-field']);

    root.MetricGrid.update({
      'mem-stride': { value: array.plan.stride + ' B', note: 'sum of fields is ' + array.plan.used + ' B' },
      'mem-padding': {
        value: array.plan.padding + ' B',
        note: values['mem-reorder'] ? 'widest-first ordering' : 'declaration order'
      },
      'mem-needed': { value: root.Format.bytes(result.bytesNeeded), note: 'the field itself' },
      'mem-read': { value: root.Format.bytes(result.bytesRead), note: 'counted from the access log' },
      'mem-lines': {
        value: root.Format.exact(result.cacheLines),
        note: 'stride ' + result.stride + ' B between consecutive reads'
      },
      'mem-waste': {
        value: root.Format.percent(1 - result.bytesNeeded / (result.cacheLines * 64 || 1), 1),
        note: 'of the lines pulled in, this fraction was not wanted'
      }
    });

    paintFields(array.plan);
    paintMap(array, result);
  }

  function fill(array, count) {
    array.memory.setLogging(false);
    for (let i = 0; i < count; i += 1) {
      array.set(i, 'id', i);
      array.set(i, 'flag', i & 1);
      array.set(i, 'score', i * 1.5);
      array.set(i, 'rank', i % 100);
    }
    array.memory.setLogging(true);
  }

  function paintFields(plan) {
    const cells = plan.fields.map(function (field) {
      const pad = field.padding
        ? '<span class="chip" style="background:var(--hue-red-soft);color:var(--hue-red)">+' +
          field.padding + ' pad</span>'
        : '';
      return '<span class="chip" style="background:var(--hue-blue-soft);color:var(--hue-blue)">' +
        field.name + ' @' + field.offset + ' (' + field.bytes + 'B)</span>' + pad;
    }).join(' ');

    root.jQuery('#mem-fields').html('<div style="display:flex;flex-wrap:wrap;gap:.25rem">' + cells +
      '</div><p class="note" style="margin-top:.375rem">stride ' + plan.stride + ' B · used ' +
      plan.used + ' B · padding ' + plan.padding + ' B</p>');
  }

  function paintMap(array, result) {
    const log = array.memory.log();
    const lines = {};
    log.forEach(function (entry) {
      const line = Math.floor(entry.address / 64);
      lines[line] = (lines[line] || 0) + entry.bytes;
    });

    const keys = Object.keys(lines).map(Number).sort(function (a, b) { return a - b; }).slice(0, 96);
    const cells = keys.map(function (line) {
      const used = Math.min(1, lines[line] / 64);
      return '<span title="line ' + line + ': ' + lines[line] + ' of 64 bytes used" ' +
        'style="display:inline-block;width:12px;height:12px;margin:1px;border-radius:2px;' +
        'background:var(--hue-blue);opacity:' + (0.15 + used * 0.85) + '"></span>';
    }).join('');

    root.jQuery('#mem-map').html(cells +
      '<p class="note" style="margin-top:.375rem">' + result.layout.toUpperCase() + ': ' +
      root.Format.exact(result.cacheLines) + ' lines touched for ' +
      root.Format.bytes(result.bytesNeeded) + ' of wanted data</p>');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

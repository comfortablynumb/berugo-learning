/**
 * Section: Dynamic arrays and growth policies.
 *
 * The amortised argument lives in M01; this section is about the bytes. Every
 * copy and every shift is counted through the memory model, so the position
 * you insert at has a price tag rather than a complexity class.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'dynamic-arrays';
  const OPS = 1000;
  let panel = null;
  let chart = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
    app.state.subscribe('theme', function () { if (chart) chart.redraw(); });
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render({
      sectionId: SECTION_ID,
      orientation: [
        'A dynamic array is a fixed array plus a policy for what to do when it fills. The policy ' +
          'is one number: the growth factor. It decides how many bytes get copied over the life ' +
          'of the array, and how much capacity sits unused at the end.',
        'Insertion position is the other cost. Appending writes one element; inserting at the front ' +
          'moves every element after it. Both are "insert" in the API and they differ by a factor of n.',
        'Everything below is counted, not estimated: the memory model records every byte the copy ' +
          'and shift operations move.'
      ],
      demo: { title: 'Interactive demo — count the bytes', markup: root.DynamicArraysTemplate.render() },
      diagram: {
        title: 'Diagram — growth and shift',
        caption: 'Growth copies the whole array once; a front insert moves it on every call.',
        definition: [
          'flowchart LR',
          '    A["push into free slot<br/>cost: 1 write"] --> B{"capacity left?"}',
          '    B -->|yes| A',
          '    B -->|no| C["allocate factor × capacity<br/>copy every element<br/>cost: n"]',
          '    C --> A',
          '    D["insert at position p<br/>move n − p elements"] --> E["front insert = move n<br/>append = move 0"]'
        ].join('\n')
      },
      insight: 'The growth factor is an allocator argument, not a speed one. With factor 2 the ' +
        'sum of every previously freed block is always one short of the next request, so the ' +
        'allocator can never reuse them. Factors below the golden ratio eventually can.'
    }));

    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.DynamicArraysTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  function buildArray(factor, pushes) {
    const array = root.LinearStructures.createDynamicArray({ factor: factor, type: 'i32', bytes: 1 << 22 });
    for (let i = 0; i < pushes; i += 1) array.push(i);
    return array;
  }

  function applyOperation(array, kind) {
    array.memory.resetCounters();
    let moved = 0;

    for (let i = 0; i < OPS; i += 1) {
      if (kind === 'append') array.push(i);
      else if (kind === 'front') moved += array.insertAt(0, i);
      else if (kind === 'middle') moved += array.insertAt(Math.floor(array.length() / 2), i);
      else moved += array.removeAt(0).moved;
    }

    return { moved: moved, bytes: array.memory.counters().bytesWritten };
  }

  function update(app) {
    const values = panel.values();
    const factor = values['dyn-factor'];
    const pushes = values['dyn-pushes'];

    const array = buildArray(factor, pushes);
    const growthBytes = array.events().reduce(function (sum, event) { return sum + event.copied * 4; }, 0);
    const operation = applyOperation(array, values['dyn-op']);

    root.MetricGrid.update({
      'dyn-copies': {
        value: root.Format.bytes(growthBytes),
        note: root.Format.exact(growthBytes / 4) + ' elements copied over ' + root.Format.exact(pushes) + ' pushes'
      },
      'dyn-shift': {
        value: root.Format.bytes(operation.moved * 4),
        note: root.Format.exact(Math.round(operation.moved / OPS)) + ' elements moved per operation'
      },
      'dyn-grows': {
        value: String(array.events().length),
        note: 'final capacity ' + root.Format.exact(array.capacity()) + ' for ' + root.Format.exact(array.length()) + ' items'
      },
      'dyn-waste': {
        value: root.Format.percent(1 - array.length() / array.capacity(), 1),
        note: root.Format.exact(array.capacity() - array.length()) + ' slots allocated and unused'
      }
    });

    paintPositions(factor, pushes);
    draw(app, array, factor);
  }

  function paintPositions(factor, pushes) {
    const rows = [
      { kind: 'append', why: 'writes into a free slot; only growth copies' },
      { kind: 'middle', why: 'moves half the array on every call' },
      { kind: 'front', why: 'moves the whole array on every call' },
      { kind: 'removeFront', why: 'the same shift, in the other direction' }
    ].map(function (entry) {
      const array = buildArray(factor, pushes);
      const result = applyOperation(array, entry.kind);
      return '<tr><td class="mono">' + entry.kind + '</td>' +
        '<td class="mono">' + root.Format.bytes(result.moved * 4) + '</td>' +
        '<td class="mono">' + root.Format.exact(Math.round(result.moved / OPS)) + ' elements</td>' +
        '<td class="note">' + entry.why + '</td></tr>';
    }).join('');

    root.jQuery('#dyn-positions tbody').html(rows);
  }

  function draw(app, array, factor) {
    const events = array.events();
    const capacity = [{ x: 0, y: 1 }];
    let elements = 0;

    events.forEach(function (event) {
      capacity.push({ x: event.copied, y: event.from });
      capacity.push({ x: event.copied, y: event.to });
      elements += event.copied;
    });

    const copies = events.map(function (event, index) {
      return { x: index + 1, y: Math.max(1, event.copied) };
    });

    chart = root.GrowthPlot.render(root.jQuery('#dyn-chart')[0], {
      lazyLib: app.lazyLib,
      height: 240,
      logY: true,
      series: [{ label: 'elements copied at each growth', points: copies, dots: true }],
      xLabel: 'reallocation number',
      yLabel: 'elements copied (log)',
      legendHost: root.jQuery('#dyn-legend')[0],
      summary: function () {
        return events.length + ' reallocations at factor ' + factor + ', copying ' +
          root.Format.exact(elements) + ' elements in total; each point is one growth.';
      }
    });
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

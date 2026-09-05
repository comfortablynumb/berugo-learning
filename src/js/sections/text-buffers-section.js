/**
 * Section: Ropes, gap buffers and piece tables.
 *
 * One edit script, three structures, and the work each had to do. The winner
 * changes with the pattern, which is exactly why an editor's choice of buffer
 * is a statement about how its users edit.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'text-buffers';
  const PATTERNS = ['typing', 'scattered', 'pasteThenEdit', 'backspace'];
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
        'Storing a document as one string makes every insertion an O(n) copy, which at a few hundred ' +
          'keystrokes per minute over a megabyte of text is not survivable. Editors therefore store ' +
          'text in a structure shaped around the edits people actually make.',
        'A gap buffer keeps free space at the cursor: typing there is free and moving the cursor ' +
          'costs the distance. A piece table never moves text at all — it keeps an immutable original, ' +
          'an append-only added buffer and a list of pieces. A rope splits the document into a tree so ' +
          'no single edit touches more than a path.',
        'Run the same script through all three below. Sequential typing favours the gap buffer; a ' +
          'large paste followed by scattered edits favours the piece table, which is the measurement ' +
          'behind VS Code\'s switch.'
      ],
      demo: { title: 'Interactive demo — one script, three structures', markup: root.TextBuffersTemplate.render() },
      diagram: {
        title: 'Diagram — a piece table after two inserts',
        caption: 'The document is a list of spans into two immutable buffers.',
        definition: [
          'flowchart LR',
          '    O["original buffer<br/>(immutable)"] --> P1["piece: original[0..120]"]',
          '    A["added buffer<br/>(append-only)"] --> P2["piece: added[0..12]"]',
          '    O --> P3["piece: original[120..400]"]',
          '    P1 --> D["document = P1 · P2 · P3"]',
          '    P2 --> D',
          '    P3 --> D'
        ].join('\n')
      },
      insight: 'VS Code moved from a gap buffer to a piece table for a reason you can reproduce ' +
        'here. What decided it was the cost of a large paste followed by edits scattered around ' +
        'the file. Undo comes almost free with a piece table too, because nothing was ever ' +
        'overwritten.'
    }));

    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.TextBuffersTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  function makeScript(pattern, edits, docLength) {
    const rng = root.Random.seeded(4242);
    const script = [];
    let length = docLength;

    for (let i = 0; i < edits; i += 1) {
      if (pattern === 'typing') {
        const at = Math.min(length, Math.floor(docLength / 2) + i);
        script.push({ op: 'insert', at: at, text: 'x' });
        length += 1;
      } else if (pattern === 'scattered') {
        const at = rng.int(Math.max(1, length));
        script.push({ op: 'insert', at: at, text: 'yz' });
        length += 2;
      } else if (pattern === 'pasteThenEdit') {
        if (i === 0) {
          const paste = new Array(2000).fill('p').join('');
          script.push({ op: 'insert', at: Math.floor(length / 2), text: paste });
          length += paste.length;
        } else {
          script.push({ op: 'insert', at: rng.int(Math.max(1, length)), text: 'q' });
          length += 1;
        }
      } else {
        const at = Math.min(length, Math.floor(docLength / 2) + Math.floor(i / 2));
        if (i % 2 === 0) { script.push({ op: 'insert', at: at, text: 'a' }); length += 1; }
        else if (length > 1) { script.push({ op: 'remove', at: Math.max(0, at - 1), count: 1 }); length -= 1; }
      }
    }

    return script;
  }

  function runPattern(pattern, edits, docKb) {
    const initial = new Array(docKb * 1024).fill('.').join('');
    const script = makeScript(pattern, edits, initial.length);
    return root.TextBuffers.compare({ initial: initial, script: script });
  }

  function update(app) {
    const values = panel.values();
    const result = runPattern(values['text-pattern'], values['text-edits'], values['text-doc']);

    root.MetricGrid.update({
      'text-gap': {
        value: root.Format.exact(result.gap.moved),
        note: result.gap.grows + ' buffer growth' + (result.gap.grows === 1 ? '' : 's')
      },
      'text-piece': {
        value: root.Format.exact(result.piece.pieces),
        note: 'zero characters moved — the cost is list surgery'
      },
      'text-rope': {
        value: root.Format.exact(result.rope.copied),
        note: result.rope.splits + ' splits, ' + result.rope.joins + ' joins'
      },
      'text-agree': {
        value: result.agree ? 'yes' : 'NO',
        note: result.agree ? 'all three produced identical text' : 'a structure disagrees — that is a bug'
      }
    });

    paintTable(values['text-edits'], values['text-doc']);
    draw(app, values['text-edits'], values['text-doc']);
  }

  function costOf(result) {
    return { gap: result.gap.moved, piece: result.piece.pieces, rope: result.rope.copied };
  }

  function paintTable(edits, docKb) {
    const rows = PATTERNS.map(function (pattern) {
      const cost = costOf(runPattern(pattern, edits, docKb));
      const best = cost.gap <= cost.rope && cost.gap <= cost.piece * 100 ? 'gap buffer'
        : (cost.rope <= cost.gap ? 'rope' : 'piece table');
      return '<tr><td class="mono">' + pattern + '</td>' +
        '<td class="mono">' + root.Format.exact(cost.gap) + ' moved</td>' +
        '<td class="mono">' + root.Format.exact(cost.piece) + ' pieces</td>' +
        '<td class="mono">' + root.Format.exact(cost.rope) + ' copied</td>' +
        '<td>' + best + '</td></tr>';
    }).join('');

    root.jQuery('#text-table tbody').html(rows);
  }

  function draw(app, edits, docKb) {
    const points = { gap: [], rope: [], piece: [] };
    PATTERNS.forEach(function (pattern, index) {
      const cost = costOf(runPattern(pattern, edits, docKb));
      points.gap.push({ x: index + 1, y: Math.max(1, cost.gap) });
      points.rope.push({ x: index + 1, y: Math.max(1, cost.rope) });
      points.piece.push({ x: index + 1, y: Math.max(1, cost.piece) });
    });

    chart = root.GrowthPlot.render(root.jQuery('#text-chart')[0], {
      lazyLib: app.lazyLib,
      height: 240,
      logY: true,
      series: [
        { label: 'gap buffer: characters moved', points: points.gap, dots: true },
        { label: 'rope: characters copied', points: points.rope, dots: true },
        { label: 'piece table: pieces created', points: points.piece, dots: true }
      ],
      xLabel: '1 typing · 2 scattered · 3 paste+edit · 4 backspace',
      yLabel: 'work (log)',
      legendHost: root.jQuery('#text-legend')[0],
      summary: function () {
        return 'Work done by each structure across the four edit patterns, log scale; the ranking ' +
          'changes with the pattern.';
      }
    });
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

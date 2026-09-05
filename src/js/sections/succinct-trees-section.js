/**
 * Section: succinct trees — LOUDS, balanced parentheses and wavelet trees.
 *
 * The headline number for a succinct tree (177× against pointers) is a
 * measurement of the *shape* and nothing else, so this demo carries a payload
 * control: move it off zero and the same tree's saving collapses to single
 * digits. Reporting the first figure without the second is the standard way
 * this subject gets oversold.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'succinct-trees';
  const POINTER_OVERHEAD = 40;
  let panel = null;
  let bars = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
    app.state.subscribe('theme', function () {
      if (bars) bars.redraw();
    });
  }

  function diagram() {
    return {
      title: 'Diagram — LOUDS, level by level',
      caption: 'Each node contributes one 1 per child and a terminating 0, in level order, after a "10" for ' +
        'the super-root. The k-th 1 in the string is node k, so navigation is rank and select and nothing ' +
        'else — no node is stored anywhere.',
      definition: [
        'flowchart TD',
        '    A["tree: root with children B, C; B with child D"] --> B["level order: root, B, C, D"]',
        '    B --> C["super-root: 10"]',
        '    C --> D["root has 2 children: 110"]',
        '    D --> E["B has 1 child: 10"]',
        '    E --> F["C has none: 0"]',
        '    F --> G["D has none: 0"]',
        '    G --> H["10 110 10 0 0 — 2n + 1 bits"]'
      ].join('\n')
    };
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        'A tree of n nodes has about 4ⁿ possible shapes, so 2n bits is the information-theoretic floor for ' +
          'encoding one — and both LOUDS and balanced parentheses hit it. LOUDS writes, in level order, one 1 ' +
          'per child of each node followed by a 0; on 5 000 nodes that is 10 001 bits, 2.0002 per node. ' +
          'Navigation is then arithmetic on rank and select: firstChild, nextSibling and parent are each one ' +
          'select plus one rank, with no pointer dereferenced anywhere.',
        'The saving against pointers is large and the qualifier is essential. 1 358 bytes ' +
          'including the rank/select index, against 240 000 bytes as 48-byte node objects, is ' +
          '177× — for the shape. Add 5 000 eight-byte values back and the total is 41 358 bytes ' +
          'and the saving is 5.8×. The payload was never in the 2n bits and is not compressed by ' +
          'any of this.',
        'Balanced parentheses encodes the same tree in exactly 2 bits per node and answers ' +
          'different questions. Subtree size is (close − open + 1) / 2 and depth is the excess, ' +
          'both of which LOUDS cannot give directly. Its navigation is only constant-time with a ' +
          'range-min-max tree, which this implementation does not build. It scans, and the section ' +
          'says so rather than quoting a bound for code that is not here. The wavelet tree applies ' +
          'the same rank-and-select idea to a sequence. It costs 8 bits per symbol over a ' +
          '256-symbol alphabet, exactly the entropy-free bound, and answers the k-th smallest in a ' +
          'range in 16.0 rank calls.'
      ],
      demo: {
        title: 'Interactive demo — 2n bits, the payload it excludes, and the sequence version',
        markup: root.SuccinctTreesTemplate.render()
      },
      diagram: diagram(),
      insight: 'Succinct structures trade cache misses for instructions, and that trade only pays at the scale ' +
        'where the pointer version stops being resident. On 5 000 nodes both representations fit ' +
        'in L2 and the pointer tree is faster. On 5 000 000 the difference is 240 MB against ' +
        '41 MB, and the arithmetic wins because the alternative is a disk. The discipline the ' +
        'subject demands is naming what the bound covers. 2n bits is the shape, the payload is ' +
        'separate, and constant-time parenthesis navigation needs an index that is easy to ' +
        'describe and easy to forget to build.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.SuccinctTreesTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  const treeFor = root.Helpers.memoise(function (key) {
    return root.SuccinctLab.treeEncodings({ nodes: Number(key) });
  });

  const waveletFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|').map(Number);
    return root.SuccinctLab.waveletRun({ length: parts[0], alphabet: parts[1] });
  });

  function update(app) {
    const values = panel.values();
    const run = treeFor(values['sct-nodes']);
    const payload = Number(values['sct-payload']) * run.nodes;

    paintMetrics(run, payload);
    paintEncodings(run, payload);
    paintWavelet(waveletFor(values['sct-length'] + '|' + values['sct-alphabet']));
    drawBars(app, run, payload);
  }

  function pointerBytes(run, payload) {
    return run.nodes * POINTER_OVERHEAD + payload;
  }

  function paintMetrics(run, payload) {
    const ops = run.ops.rankCalls + run.ops.selectCalls;

    root.MetricGrid.update({
      'sct-bits': {
        value: root.Format.fixed(run.louds.bitsPerNode, 4),
        note: root.Format.exact(run.louds.bits) + ' bits for ' + root.Format.exact(run.nodes) + ' nodes'
      },
      'sct-bytes': {
        value: root.Format.exact(run.louds.totalBytes),
        note: root.Format.exact(run.louds.rawBytes) + ' of bits plus ' +
          root.Format.exact(run.louds.indexBytes) + ' of rank/select index'
      },
      'sct-saving': {
        value: root.Format.fixed(pointerBytes(run, payload) / (run.louds.totalBytes + payload), 1) + '×',
        note: payload
          ? 'with ' + root.Format.exact(payload) + ' bytes of payload on both sides'
          : 'shape only — no payload at all'
      },
      'sct-ops': {
        value: root.Format.fixed(ops / Math.max(1, run.ops.operations), 2),
        note: root.Format.exact(run.ops.scanSteps) + ' scan steps, over ' +
          root.Format.exact(run.ops.operations) + ' navigation calls'
      }
    });
  }

  function paintEncodings(run, payload) {
    const rows = [
      { label: 'pointer objects', bits: '—', perNode: '—', raw: '—', index: '—',
        total: pointerBytes(run, payload) },
      { label: 'LOUDS + rank/select index', bits: run.louds.bits, perNode: run.louds.bitsPerNode,
        raw: run.louds.rawBytes, index: run.louds.indexBytes, total: run.louds.totalBytes + payload },
      { label: 'balanced parentheses + index', bits: run.parentheses.bits, perNode: run.parentheses.bitsPerNode,
        raw: run.parentheses.rawBytes, index: run.parentheses.indexBytes,
        total: run.parentheses.totalBytes + payload }
    ];

    const html = rows.map(function (row, index) {
      return '<tr' + (index === 1 ? ' style="font-weight:600"' : '') + '>' +
        '<td>' + row.label + '</td>' +
        '<td class="mono">' + (row.bits === '—' ? '—' : root.Format.exact(row.bits)) + '</td>' +
        '<td class="mono">' + (row.perNode === '—' ? '—' : root.Format.fixed(row.perNode, 4)) + '</td>' +
        '<td class="mono">' + (row.raw === '—' ? '—' : root.Format.exact(row.raw)) + '</td>' +
        '<td class="mono">' + (row.index === '—' ? '—' : root.Format.exact(row.index)) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.total) + '</td>' +
        '<td class="mono">' + root.Format.fixed(pointerBytes(run, payload) / row.total, 1) + '×</td></tr>';
    }).join('');

    root.jQuery('#sct-encodings tbody').html(html);
    root.jQuery('#sct-encodings-note').text('The two bit encodings are within one bit of each other and both ' +
      'sit on the 2n bound — LOUDS spends its extra bit on the super-root that makes parent() arithmetic. ' +
      'The last column is where the payload slider does its work: at 0 bytes per node the ratio is the ' +
      'headline figure everyone quotes, and every byte you add moves it towards 1, because a payload is a ' +
      'payload in both representations.');
  }

  function paintWavelet(run) {
    const html = '<tr>' +
      '<td class="mono">' + root.Format.exact(run.shape.length) + '</td>' +
      '<td class="mono">' + root.Format.exact(run.shape.alphabet) + '</td>' +
      '<td class="mono">' + root.Format.exact(run.shape.levels) + '</td>' +
      '<td class="mono">' + root.Format.exact(run.shape.vectors) + '</td>' +
      '<td class="mono">' + root.Format.fixed(run.shape.bitsPerSymbol, 2) + '</td>' +
      '<td class="mono">' + root.Format.fixed(run.shape.bound, 2) + '</td>' +
      '<td class="mono">' + root.Format.fixed(run.rankCallsPerQuery, 1) + '</td>' +
      '<td class="mono">' + root.Format.exact(run.wrong) + '</td></tr>';

    root.jQuery('#sct-wavelet tbody').html(html);
    root.jQuery('#sct-wavelet-note').text('A wavelet tree stores one bit per symbol per level — ' +
      root.Format.exact(run.shape.levels) + ' levels for a ' + root.Format.exact(run.shape.alphabet) +
      '-symbol alphabet — so it is the same size as the raw sequence and answers questions the raw sequence ' +
      'cannot: rank and select for any symbol, and the k-th smallest in any range in two rank calls per level. ' +
      'All ' + root.Format.exact(run.queries) + ' quantiles here are checked against a sorted copy.');
  }

  function drawBars(app, run, payload) {
    bars = root.ErrorBandView.bars(root.jQuery('#sct-bars')[0], {
      lazyLib: app.lazyLib,
      height: 240,
      logY: true,
      xLabel: 'representation',
      yLabel: 'bytes (log scale)',
      values: [
        { label: 'pointer tree', value: pointerBytes(run, payload), series: 0 },
        { label: 'LOUDS + payload', value: run.louds.totalBytes + payload, series: 1 },
        { label: 'LOUDS shape only', value: run.louds.totalBytes, series: 2 }
      ]
    });

    root.jQuery('#sct-bars-note').text('The third bar is the one the literature quotes and the second is the ' +
      'one a system has to budget for. At ' + root.Format.exact(payload / Math.max(1, run.nodes)) +
      ' payload bytes per node the saving is ' +
      root.Format.fixed(pointerBytes(run, payload) / (run.louds.totalBytes + payload), 1) +
      '×, against ' + root.Format.fixed(pointerBytes(run, payload) / run.louds.totalBytes, 0) +
      '× for the shape alone. Both are true; only one of them sizes a machine.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

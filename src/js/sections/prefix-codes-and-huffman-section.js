/**
 * Section: prefix codes and Huffman.
 *
 * The measurement this section exists for is the skew sweep. Huffman is optimal
 * among codes that spend a whole number of bits per symbol, and on a two-symbol
 * source at 99/1 that constraint pins it at exactly 1.0000 bits while the
 * entropy is 0.0808 — a factor of 12.4 wasted, rising to 87.7 at 999/1. The
 * arithmetic column beside it tracks the entropy to four decimal places, which
 * is the entire argument for the next section stated as a table.
 *
 * The table-cost table is the other half, and it does not go the way the
 * folklore does: canonical Huffman is cheaper than an explicit tree only when
 * the alphabet is DENSE, and DEFLATE's run-length layer is what makes the
 * sparse case cheap.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'prefix-codes-and-huffman';
  let panel = null;
  let chart = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — a Huffman tree, with the codewords on the edges',
      caption: 'Merge the two least frequent symbols, repeat, and read the codeword off the path ' +
        'from the root. The result is optimal among codes that assign whole bits, and the tree ' +
        'shows why the code is prefix-free without any extra machinery: every symbol is a LEAF, ' +
        'so no codeword is a prefix of another and a decoder always knows where a symbol ends. ' +
        'The depth of a leaf is the bits its symbol costs, and the greedy merge is what puts the ' +
        'frequent symbols near the top.',
      definition: [
        'flowchart TD',
        '    R["root<br/>1.00"] -->|0| A["0.55"]',
        '    R -->|1| B["0.45"]',
        '    A -->|0| E["e — 0.30<br/>code 00"]',
        '    A -->|1| T["t — 0.25<br/>code 01"]',
        '    B -->|0| O["o — 0.25<br/>code 10"]',
        '    B -->|1| C["0.20"]',
        '    C -->|0| Q["q — 0.12<br/>code 110"]',
        '    C -->|1| Z["z — 0.08<br/>code 111"]'
      ].join('\n')
    };
  }

  function orientationOptimality() {
    return [
      '**A prefix code is one where no codeword is a prefix of another**, which is what lets a ' +
        'decoder read a stream with no separators.',
      'The Kraft–McMillan inequality says a set of lengths is achievable by a prefix code exactly ' +
        'when the sum of 2^(−length) is at most one. It also says anything a uniquely decodable ' +
        'code can do, a prefix code can do too.',
      '**Huffman is optimal among symbol codes, and the qualifier is the lesson.** The greedy merge ' +
        'provably minimises the average length over all codes that assign a whole number of bits ' +
        'per symbol.',
      'What it cannot do is spend a fraction of a bit. That is not a bug in the algorithm, it is ' +
        'the definition of the family it is optimal within.',
      '**The gap is at most one bit per symbol and that can be most of the file.** A symbol with ' +
        'probability 0.99 carries 0.0145 bits and costs a whole one.',
      'The demo sweeps the skew. At 99/1 Huffman spends 12.4 times the entropy, and at 999/1 it ' +
        'spends 87.7 times.',
      '**On a large, flat alphabet Huffman is nearly perfect.** The same sweep at 50/50 measures ' +
        '1.00× the entropy, and English text measures within about 1.2%.',
      'That is why Huffman is still everywhere. The case it is bad at is a two-symbol source, and ' +
        'most real alphabets are not that.'
    ];
  }

  function orientationTables() {
    return [
      '**The tree has to reach the decoder, and that costs bytes.** Canonical Huffman removes most ' +
        'of it. Sort by length then symbol, assign codewords consecutively, and the decoder ' +
        'rebuilds every codeword from the LENGTHS alone.',
      'The demo costs three encodings of the same code, and which wins depends on how dense the ' +
        'alphabet is.',
      '**DEFLATE compresses the length table itself**, with a run-length layer and a third Huffman ' +
        'code over 19 symbols.',
      'That sounds like over-engineering until you see the numbers. A sparse table of 256 lengths ' +
        'is mostly zeros, and the run-length form is a fraction of either alternative.',
      '**Adaptive Huffman makes one pass instead of two.** The tree is updated after every symbol, ' +
        'so nothing is transmitted and a stream can be coded without a second look.',
      'It pays in ratio on short inputs, because the model starts uniform, and in speed, because ' +
        'the tree is restructured per symbol.',
      '**Ties in the merge produce different trees with identical cost.** Two correct Huffman ' +
        'implementations can disagree byte for byte and both be optimal.',
      'That matters the first time somebody diffs two compressed files and concludes one of them ' +
        'is broken.'
    ];
  }

  function orientation() {
    return orientationOptimality().concat(orientationTables());
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — the code, the stream, and the gap that will not close',
        markup: root.PrefixCodesTemplate.render()
      },
      diagram: diagram(),
      insight: '**Huffman cannot spend less than one bit on a symbol, so on a source that is 99% ' +
        'one value it wastes about nine tenths of the achievable compression. That single ' +
        'limitation is why arithmetic coding exists.** The practical reading is about where each ' +
        'belongs. With a large alphabet and no extreme skew, Huffman is within a couple of per ' +
        'cent of the entropy and decodes with one table lookup per symbol. That is why it is ' +
        'still in DEFLATE and JPEG. The moment the distribution is sharply skewed the whole-bit ' +
        'floor dominates, and the answer is a coder that can spend fractions. A bit stream, a ' +
        'flag column and a probability from a context model are all that case.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.PrefixCodesTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  const studyFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.CodingLab.huffmanStudy({ corpus: parts[0], size: Number(parts[1]) });
  });

  const skewFor = root.Helpers.memoise(function () {
    return root.CodingLab.skewSweep({});
  });

  function update(app) {
    const values = panel.values();
    const study = studyFor(values['huf-corpus'] + '|' + values['huf-size']);

    paintMetrics(study);
    paintChart(app, skewFor(''));
    paintStream(study);
    paintCodes(study);
    paintSkew(skewFor(''));
    paintTable(study);
  }

  function paintMetrics(study) {
    root.MetricGrid.update({
      'huf-bits': { value: root.Format.fixed(study.bitsPerSymbol, 4) + ' bits',
        note: 'over ' + root.Format.exact(study.alphabet) + ' distinct symbols, round-trip ' +
          (study.roundTrip ? 'verified' : 'FAILED') },
      'huf-gap': { value: '+' + root.Format.fixed(study.overEntropy, 4) + ' bits',
        note: root.Format.fixed(study.bitsPerSymbol / study.entropy, 4) +
          '× the entropy of ' + root.Format.fixed(study.entropy, 4) },
      'huf-kraft': { value: root.Format.fixed(study.kraft, 4),
        note: Math.abs(study.kraft - 1) < 1e-9
          ? 'exactly one: the code is complete and wastes no codeword'
          : 'below one — some codeword space is unused' },
      'huf-table': { value: root.Format.exact(Math.min(study.table.treeBytes,
        study.table.canonicalBytes, study.table.runLengthBytes)) + ' bytes',
      note: 'the ' + study.table.best + ' form wins at a density of ' +
          root.Format.percent(study.table.density, 1) }
    });
  }

  function paintChart(app, sweep) {
    const host = root.jQuery('#huf-chart')[0];
    if (!host) return;
    if (chart) chart.destroy();

    chart = root.ErrorBandView.curve(host, {
      lazyLib: app.lazyLib, height: 240, logX: true, yMin: 0,
      xLabel: 'share of the rarer symbol (log scale)', yLabel: 'bits per symbol',
      series: [
        { label: 'Huffman', points: sweep.map(function (row) {
          return { x: row.share, y: row.huffmanBits };
        }) },
        { label: 'arithmetic', points: sweep.map(function (row) {
          return { x: row.share, y: row.arithmeticBits };
        }) },
        { label: 'entropy (the floor)', dashed: true, points: sweep.map(function (row) {
          return { x: row.share, y: row.entropy };
        }) }
      ]
    });

    const last = sweep[sweep.length - 1];
    root.Helpers.setText('huf-chart-note',
      'A two-symbol source, swept from an even split to ' +
      root.Format.fixed(1 / last.share, 0) + ':1. The Huffman line is FLAT at exactly 1.0000 ' +
      'bits — it cannot spend less, whatever the probabilities are — while the entropy falls ' +
      'away beneath it to ' + root.Format.fixed(last.entropy, 4) + ' bits. The arithmetic line ' +
      'sits on the entropy the whole way. That divergence is the entire case for the next ' +
      'section, and it is worth noticing that it is invisible at the left-hand edge: at an even ' +
      'split the two coders are identical.');
  }

  function paintStream(study) {
    const host = root.jQuery('#huf-stream')[0];
    if (!host) return;
    const bits = study.segments.reduce(function (total, segment) {
      return total + segment.bits.length;
    }, 0);

    root.BitstreamView.render(host, {
      caption: 'The first ' + study.segments.length + ' symbols of ' + study.corpus +
        ', with each symbol’s codeword in its own tone.',
      segments: study.segments,
      totalBits: bits,
      floorBits: study.entropy * study.segments.length
    });

    root.Helpers.setText('huf-stream-note',
      'Every span is one symbol and its width is what that symbol cost. The frequent ones — the ' +
      'space, the vowels — are three or four bits; the rare ones run to eight or nine. That is ' +
      'the entire idea of a variable-length code, and the summary line underneath is the check ' +
      'that matters: ' + root.Format.exact(bits) + ' bits spent against a floor of ' +
      root.Format.fixed(study.entropy * study.segments.length, 1) + '. A bit count with no ' +
      'floor beside it is not a measurement.');
  }

  function paintCodes(study) {
    root.jQuery('#huf-codes tbody').html(study.codes.slice(0, 14).map(function (row) {
      return '<tr><td class="mono">' + row.label + '</td><td class="mono">' +
        root.Format.exact(row.count) + '</td><td class="mono">' +
        root.Format.fixed(row.probability, 4) + '</td><td class="mono">' + row.code +
        '</td><td class="mono">' + row.length + '</td><td class="mono">' +
        root.Format.fixed(row.ideal, 2) + '</td><td class="mono">' +
        root.Format.fixed(row.waste, 2) + '</td></tr>';
    }).join(''));

    const worst = study.codes.reduce(function (most, row) {
      return row.waste > most.waste ? row : most;
    }, study.codes[0]);
    root.Helpers.setText('huf-codes-note',
      'The last column is the per-symbol waste, and it goes both ways: a symbol whose ' +
      'probability is not a power of two is rounded up or down to the nearest whole bit, so some ' +
      'rows are negative. The worst row here is "' + worst.label + '" at ' +
      root.Format.fixed(worst.waste, 2) + ' bits of waste on a probability of ' +
      root.Format.fixed(worst.probability, 4) + '. Weighted by frequency those roundings nearly ' +
      'cancel, which is why the whole code lands only ' +
      root.Format.fixed(study.overEntropy, 4) + ' bits per symbol above the entropy — and why ' +
      'the picture changes completely when one symbol dominates the file.');
  }

  function paintSkew(sweep) {
    root.jQuery('#huf-skew tbody').html(sweep.map(function (row) {
      return '<tr><td class="mono">' + root.Format.fixed(row.share, 3) +
        '</td><td class="mono">' + root.Format.fixed(row.entropy, 4) +
        '</td><td class="mono">' + root.Format.fixed(row.huffmanBits, 4) +
        '</td><td class="mono">' + root.Format.fixed(row.arithmeticBits, 4) +
        '</td><td class="mono">' + root.Format.fixed(row.waste, 2) + '×</td><td class="mono">' +
        root.Format.fixed(row.arithmeticWaste, 3) + '×</td></tr>';
    }).join(''));

    const last = sweep[sweep.length - 1];
    root.Helpers.setText('huf-skew-note',
      'The Huffman column is 1.0000 in every row — there is no shorter codeword than one bit, ' +
      'and with two symbols there is nothing to trade. The waste column is what that costs: ' +
      root.Format.fixed(sweep[0].waste, 2) + '× at an even split, rising to ' +
      root.Format.fixed(last.waste, 2) + '× when the rare symbol appears once in ' +
      root.Format.fixed(1 / last.share, 0) + '. The arithmetic column is within ' +
      root.Format.fixed((last.arithmeticWaste - 1) * 100, 1) + '% of the floor even in the last ' +
      'row, and the difference between those two columns is one design decision: whether a ' +
      'symbol’s cost has to be an integer.');
  }

  function paintTable(study) {
    const rows = [
      { name: 'explicit tree', bits: study.table.treeBits, bytes: study.table.treeBytes,
        what: 'the shape, one bit per node, plus a symbol per leaf' },
      { name: 'canonical (lengths only)', bits: study.table.canonicalBits,
        bytes: study.table.canonicalBytes,
        what: 'four bits per symbol of the whole 256-byte alphabet, used or not' },
      { name: 'canonical, run-length coded', bits: study.table.runLengthBits,
        bytes: study.table.runLengthBytes,
        what: 'the same lengths, with runs of zero collapsed — what DEFLATE does' }
    ];

    root.jQuery('#huf-tablecost tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.name + '</td><td class="mono">' + root.Format.exact(row.bits) +
        '</td><td class="mono">' + root.Format.exact(row.bytes) + '</td><td>' + row.what +
        '</td></tr>';
    }).join(''));

    root.Helpers.setText('huf-tablecost-note',
      'This corpus uses ' + root.Format.exact(study.alphabet) + ' of 256 possible bytes, a ' +
      'density of ' + root.Format.percent(study.table.density, 1) + ', and at that density the ' +
      (study.table.canonicalWins ? 'canonical form already beats the explicit tree'
        : 'explicit tree beats the plain canonical form — the canonical table pays for 256 ' +
          'symbols whether they appear or not') + '. The run-length row is why the folklore ' +
      '"canonical Huffman is smaller" is only half true: it is the RUN-LENGTH layer over the ' +
      'lengths that makes a sparse table cheap, at ' + root.Format.exact(study.table.runLengthBytes) +
      ' bytes here, and that is exactly the layer DEFLATE adds and a first implementation ' +
      'leaves out.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

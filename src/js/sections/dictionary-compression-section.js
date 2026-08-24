/**
 * Section: dictionary compression.
 *
 * The measurement is the depth ladder. "Level 9" in gzip, zstd or brotli is
 * almost never a different algorithm — it is the same algorithm walking more of
 * the hash chain — and the demo makes that literal by exposing the chain
 * cut-off as the only control. Ratio and comparisons-per-byte both move, and
 * the shape of the trade is the whole point: eleven times the work for about a
 * fifth better ratio, with the curve flattening long before the work does.
 *
 * The window sweep carries the surprise. A bigger window is not automatically
 * better, because the distance field grows with it: on a corpus whose matches
 * are all local, a 256-byte window beats a 4 096-byte one outright.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'dictionary-compression';
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
      title: 'Diagram — a token pointing back into the window',
      caption: 'LZ77 replaces a repeat with a pointer backwards: a distance saying how far, a ' +
        'length saying how much. Everything before the cursor is the dictionary and nothing has ' +
        'to be transmitted — the decoder has already seen it. The flag bit is LZSS’s addition: ' +
        'without it every position costs a full triple, so incompressible data expands; with it a ' +
        'literal costs one bit more than the byte itself. An overlapping copy — distance 1, ' +
        'length 200 — is legal and is how run-length encoding falls out of the same mechanism.',
      definition: [
        'flowchart LR',
        '    W["window: ...the quick brown fox jumps over..."] --> C["cursor"]',
        '    C --> L["lookahead: the lazy dog"]',
        '    L --> T1["literal 0x74 t<br/>flag + 8 bits"]',
        '    L --> T2["match distance 43, length 4<br/>flag + 12 + 8 bits, and it codes four bytes"]',
        '    T2 -.->|points back| W',
        '    T1 --> O["token stream"]',
        '    T2 --> O'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**LZ77 replaces a repeat with a pointer backwards, and that is the entire idea.** A token ' +
        'is a distance and a length; the dictionary is everything already decoded, so nothing is ' +
        'transmitted twice and the decoder needs no table.',
      '**Match finding is where all the CPU goes and where compression levels come from.** A hash ' +
        'of the next three bytes indexes a chain of earlier positions with the same three bytes; ' +
        'the encoder walks that chain looking for the longest match and stops after a cut-off. ' +
        'That cut-off IS the compression level.',
      '**The demo measures the ladder rather than describing it.** Depth 1 to depth 64 on the ' +
        'same corpus with the same code: the ratio improves by about a fifth and the chain links ' +
        'walked per byte rise elevenfold, with the curve flattening long before the work does. ' +
        'That shape is why level 9 is rarely worth it and level 1 usually is.',
      '**LZSS adds one flag bit and that is what stops expansion.** Plain LZ77 emits a triple at ' +
        'every position; LZSS emits a literal when no match pays for itself. Incompressible input ' +
        'then costs nine bits per byte instead of thirty, which is the difference between a 12% ' +
        'expansion and a 300% one.',
      '**Lazy matching is a one-symbol lookahead.** After finding a match at position i, check ' +
        'whether a longer one starts at i + 1; if so, emit a literal and take the better match. ' +
        'It is worth a few per cent for a constant factor of work, and every production encoder ' +
        'does it.',
      '**The window is two things at once: how far a match can reach, and how many bits every ' +
        'distance costs.** Doubling it adds a bit to every match token, so it pays only if the ' +
        'extra reach finds enough. The demo sweeps it and prints which size won; on data whose ' +
        'repeats are all local the small window wins outright, and the window is also the ' +
        'DECODER’s memory, which is why formats fix it in the header rather than leaving it to ' +
        'the encoder.',
      '**LZ78 and LZW build an explicit dictionary instead**, adding one entry per token and ' +
        'transmitting no distance at all — every code is the same width. The demo measures LZW ' +
        'BEATING a bare LZSS on prose, and the reason is instructive: LZSS spends 21 bits on ' +
        'every match while LZW spends 12 on everything. What reverses it is the entropy stage in ' +
        'the next section, which codes the common distances and lengths in far fewer bits than ' +
        'their fixed fields.',
      '**The dictionary approach and the entropy approach are orthogonal**, which is why DEFLATE ' +
        'does both: LZ77 removes the repeats and Huffman codes what is left. Neither one ' +
        'subsumes the other, and the next section measures what each stage contributes.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — search depth, window size, and what each is worth',
        markup: root.DictionaryCompressionTemplate.render()
      },
      diagram: diagram(),
      insight: '**"Level 9" is nearly always "search harder", not "a different algorithm" — so ' +
        'the compression level is a CPU budget, and the right one is a property of your ratio of ' +
        'writes to reads.** Data written once and read many times deserves a slow encode; a log ' +
        'stream that is compressed on the hot path and read by nobody deserves level 1. The other ' +
        'lever is the one people forget: the window is the decoder’s memory as well as the ' +
        'encoder’s search space, and on data whose repeats are local a smaller window is both ' +
        'faster and smaller, because every distance field shrinks.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.DictionaryCompressionTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  const studyFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.CodingLab.dictionaryStudy({ corpus: parts[0], size: Number(parts[1]) });
  });

  function update(app) {
    const values = panel.values();
    const study = studyFor(values['lzd-corpus'] + '|' + values['lzd-size']);

    paintMetrics(study);
    paintChart(app, study);
    paintDepths(study);
    paintWindows(study);
    paintTokens(study);
  }

  function paintMetrics(study) {
    const first = study.depths[0];
    const last = study.depths[study.depths.length - 1];

    root.MetricGrid.update({
      'lzd-ratio': { value: root.Format.fixed(study.base.ratio, 3) + '×',
        note: root.Format.exact(study.base.bytes) + ' bytes from ' +
          root.Format.exact(study.bytes) + ', round-trip ' +
          (study.base.roundTrip ? 'verified' : 'FAILED') },
      'lzd-matches': { value: root.Format.percent(study.base.matchedBytes / study.bytes, 1),
        note: root.Format.exact(study.base.matches) + ' matches and ' +
          root.Format.exact(study.base.literals) + ' literals' },
      'lzd-ladder': { value: root.Format.fixed(last.ratio / first.ratio, 3) + '×',
        note: 'ratio ' + root.Format.fixed(first.ratio, 3) + ' at depth 1, ' +
          root.Format.fixed(last.ratio, 3) + ' at depth ' + last.depth },
      'lzd-work': { value: root.Format.fixed(last.comparisonsPerByte / Math.max(1e-9,
        first.comparisonsPerByte), 1) + '×',
      note: root.Format.fixed(first.comparisonsPerByte, 2) + ' links per byte at depth 1, ' +
          root.Format.fixed(last.comparisonsPerByte, 2) + ' at depth ' + last.depth }
    });
  }

  function paintChart(app, study) {
    const host = root.jQuery('#lzd-chart')[0];
    if (!host) return;
    if (chart) chart.destroy();

    chart = root.ErrorBandView.curve(host, {
      lazyLib: app.lazyLib, height: 240, yMin: 0,
      xLabel: 'chain links walked per input byte', yLabel: 'compression ratio',
      series: [
        { label: 'search depth 1 → 64',
          points: study.depths.map(function (row) {
            return { x: row.comparisonsPerByte, y: row.ratio };
          }) }
      ]
    });

    const first = study.depths[0];
    const last = study.depths[study.depths.length - 1];
    root.Helpers.setText('lzd-chart-note',
      'The compression-level ladder as a curve: work on the x axis, ratio on the y. It is the ' +
      'shape rather than the values that matters — steep at the left, flat at the right. Going ' +
      'from depth 1 to depth ' + last.depth + ' costs ' +
      root.Format.fixed(last.comparisonsPerByte / Math.max(1e-9, first.comparisonsPerByte), 1) +
      ' times the search work and returns ' +
      root.Format.fixed((last.ratio / first.ratio - 1) * 100, 1) + '% better compression, and ' +
      'most of that is bought in the first few steps. A level dial with ten positions is this ' +
      'curve sampled ten times, and the last four positions are almost always the wrong trade ' +
      'unless the data is read far more often than it is written.');
  }

  function paintDepths(study) {
    root.jQuery('#lzd-depths tbody').html(study.depths.map(function (row) {
      return '<tr><td class="mono">' + row.depth + '</td><td class="mono">' +
        root.Format.exact(row.bytes) + '</td><td class="mono">' +
        root.Format.fixed(row.ratio, 3) + '</td><td class="mono">' +
        root.Format.exact(row.matches) + '</td><td class="mono">' +
        root.Format.exact(row.matchedBytes) + '</td><td class="mono">' +
        root.Format.fixed(row.comparisonsPerByte, 2) + '</td></tr>';
    }).join(''));

    const knee = study.depths.filter(function (row, i) {
      const previous = study.depths[i - 1];

      return previous && (row.ratio - previous.ratio) / previous.ratio < 0.02;
    })[0];
    root.Helpers.setText('lzd-depths-note',
      'One algorithm, one corpus, one parameter: how many links of the hash chain the encoder ' +
      'walks before giving up. The matched-bytes column is what actually improves — a deeper ' +
      'search finds LONGER matches, so fewer tokens cover more input' +
      (knee ? ', and the returns fall below two per cent per step by depth ' +
        root.Format.exact(knee.depth) : '') + '. This is what a compression level is, and it is ' +
      'worth knowing that the decoder is unaffected: it reads the same token stream at the same ' +
      'speed whatever the encoder spent.');
  }

  function paintWindows(study) {
    root.jQuery('#lzd-windows tbody').html(study.windows.map(function (row) {
      return '<tr><td class="mono">' + root.Format.exact(row.window) + '</td><td class="mono">' +
        Math.ceil(Math.log2(row.window)) + ' bits</td><td class="mono">' +
        root.Format.exact(row.bytes) + '</td><td class="mono">' +
        root.Format.fixed(row.ratio, 3) + '</td><td class="mono">' +
        root.Format.exact(row.matches) + '</td></tr>';
    }).join(''));

    const best = study.windows.reduce(function (winner, row) {
      return row.ratio > winner.ratio ? row : winner;
    }, study.windows[0]);
    const largest = study.windows[study.windows.length - 1];
    root.Helpers.setText('lzd-windows-note',
      'The best window here is ' + root.Format.exact(best.window) + ' bytes, not the largest — ' +
      'because the distance field costs ' + Math.ceil(Math.log2(best.window)) +
      ' bits at that size and ' + Math.ceil(Math.log2(largest.window)) + ' at ' +
      root.Format.exact(largest.window) + ', and every match pays it. A bigger window finds more ' +
      'matches AND makes each token more expensive, so the right size depends on how far apart ' +
      'the repeats in your data actually are. It is also the decoder’s memory footprint, which ' +
      'is why the format fixes it rather than leaving it to the encoder.');
  }

  function paintTokens(study) {
    const rows = [
      { name: 'LZSS, depth 32', bytes: study.base.bytes, ratio: study.base.ratio,
        roundTrip: study.base.roundTrip,
        what: 'a flag bit, then either a byte or a (distance, length) pair' },
      { name: 'LZSS with lazy matching', bytes: study.lazy.bytes, ratio: study.lazy.ratio,
        roundTrip: study.lazy.roundTrip,
        what: 'the same, having checked whether a longer match starts one byte later' },
      { name: 'LZW', bytes: study.lzw.bytes, ratio: study.lzw.ratio,
        roundTrip: study.lzw.roundTrip,
        what: root.Format.exact(study.lzw.entries) + ' dictionary entries, ' +
          root.Format.exact(study.lzw.codeBits) + ' bits per code, no distances at all' }
    ];

    root.jQuery('#lzd-tokens tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.name + '</td><td class="mono">' + root.Format.exact(row.bytes) +
        '</td><td class="mono">' + root.Format.fixed(row.ratio, 3) + '</td><td class="mono">' +
        (row.roundTrip ? 'verified' : 'FAILED') + '</td><td>' + row.what + '</td></tr>';
    }).join(''));

    const lzwBetter = study.lzw.ratio > study.lazy.ratio;

    root.Helpers.setText('lzd-tokens-note',
      'Lazy matching is worth ' + root.Format.fixed((study.lazy.gain - 1) * 100, 2) +
      '% here for roughly twice the search work — a small, real, cheap gain, which is why every ' +
      'production encoder has it. LZW is the other family: it never sends a distance, only a ' +
      'fixed-width code into a dictionary both sides build identically, and here it is ' +
      root.Format.fixed(lzwBetter ? study.lzw.ratio / study.lazy.ratio
        : study.lazy.ratio / study.lzw.ratio, 2) + '× ' + (lzwBetter ? 'BETTER' : 'worse') +
      '. That is worth sitting with rather than explaining away: this LZSS spends ' +
      root.Format.exact(21) + ' bits on every match — a flag, a 12-bit distance and an 8-bit ' +
      'length — while LZW spends ' + root.Format.exact(study.lzw.codeBits) +
      ' on everything, and on prose with many short repeats the fixed fields lose. What reverses ' +
      'it is entropy-coding the tokens, which is exactly what DEFLATE adds and the next section ' +
      'measures.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

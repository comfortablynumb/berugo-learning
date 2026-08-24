/**
 * Section: real-world general-purpose codecs.
 *
 * The measurement that makes this section worth having is that the RANKING
 * CHANGES between corpora. DEFLATE wins on English text and the BWT chain wins
 * on mixed prose; every codec expands random bytes and the stored block is what
 * bounds that expansion. A benchmark on one corpus produces a winner and tells
 * you nothing, which is why the table has seven rows and every one of them is
 * the same six codecs.
 *
 * The edge-case table is the other half of the discipline. Empty input, one
 * byte, a thousand identical bytes and a 99/1 split, with every round-trip
 * checked — because a compression figure from an implementation that cannot
 * decompress is not a measurement.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'general-purpose-codecs';
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
      title: 'Diagram — DEFLATE’s three block types, and how one is chosen',
      caption: 'Every DEFLATE block independently picks the cheapest of three encodings, and the ' +
        'stored option is the one that matters most: it is why the format never expands its ' +
        'input by more than five bytes per block, a guarantee no amount of entropy coding gives. ' +
        'The dynamic option fits a Huffman code to this block and transmits it as code LENGTHS, ' +
        'which are themselves run-length coded and then Huffman coded with a third alphabet of ' +
        'nineteen symbols — a layer that looks like over-engineering until you measure a sparse ' +
        'table without it.',
      definition: [
        'flowchart TD',
        '    B["a block of input"] --> Q1{"does it compress at all?"}',
        '    Q1 -->|no| S["STORED<br/>type 00: raw bytes, 5 bytes of overhead"]',
        '    Q1 -->|yes| Q2{"is the block long enough to pay for a table?"}',
        '    Q2 -->|no| F["FIXED<br/>type 01: the code in the specification, nothing transmitted"]',
        '    Q2 -->|yes| D["DYNAMIC<br/>type 10: a code fitted to this block"]',
        '    D --> L["the code lengths, run-length coded"]',
        '    L --> H["...and Huffman coded again, with a 19-symbol alphabet"]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**DEFLATE is LZ77 plus Huffman, and it is the most widely deployed compression format in ' +
        'existence** — gzip, zlib, PNG, zip and HTTP Content-Encoding are all this. Its design is ' +
        'deliberately modest: a 32 KB window, two Huffman alphabets, and a block structure that ' +
        'lets every block choose its own encoding.',
      '**The stored block is the guarantee.** A block that does not compress is emitted raw with ' +
        'five bytes of overhead, so DEFLATE never expands its input by more than a fraction of a ' +
        'per cent. The demo runs it on random bytes and measures exactly that: a ratio just below ' +
        'one rather than the twelve per cent expansion a pure entropy coder produces.',
      '**Fixed and dynamic Huffman are a header-cost decision.** The fixed code is in the ' +
        'specification and costs nothing to transmit; a dynamic code fits this block and costs a ' +
        'table. Short blocks take the fixed code, long ones take the dynamic, and the encoder ' +
        'decides per block by measuring both.',
      '**zstd replaced Huffman with FSE — a table-driven ANS — and added dictionaries.** The ' +
        'entropy stage is where its ratio comes from; the dictionary is where its performance on ' +
        'small payloads comes from, because a 200-byte JSON document has no history to match ' +
        'against until you give it one.',
      '**Brotli ships a 120 KB static dictionary of web text.** That is a legitimate and slightly ' +
        'startling design: the dictionary is not built from your data, it is built from the ' +
        'internet, and it is what makes brotli beat gzip on small HTML responses.',
      '**The ranking changes with the corpus, and that is the finding.** The demo runs six codecs ' +
        'over seven corpora and no codec wins them all — DEFLATE takes the structured text, the BWT ' +
        'chain takes the prose, and everything loses on incompressible input.',
      '**Decode speed usually matters more than ratio**, because data is written once and read ' +
        'many times. A Pareto plot of ratio against work is the honest way to choose, and the ' +
        'column to look at first is the one that says what the DECODER has to do.',
      '**Every measurement here is round-trip checked.** Empty input, a single byte, a thousand ' +
        'identical bytes, already-compressed data. A codec that reports a superb ratio and cannot ' +
        'decompress its own output has reported nothing.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — the bake-off, the block decision and the edge cases',
        markup: root.GeneralPurposeCodecsTemplate.render()
      },
      diagram: diagram(),
      insight: '**Choose a codec by measuring it on YOUR data, and choose it on decode speed ' +
        'unless you know the data is read rarely.** The demo makes the first half concrete: no ' +
        'codec wins every corpus, and the gap between best and worst on one corpus is smaller ' +
        'than the gap between corpora for one codec. The second half is an operational fact ' +
        'rather than a compression one — a stored object is written once and read for years, so ' +
        'a codec that is 3% better and twice as slow to decode is usually the wrong choice, and ' +
        'the only way to know is to measure both directions rather than quoting a ratio.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.GeneralPurposeCodecsTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  const bakeFor = root.Helpers.memoise(function (key) {
    return root.CodecLab.bakeOff({ size: Number(key) });
  });

  const paretoFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.CodecLab.paretoTable({ size: Number(parts[0]) * 2, corpus: parts[1] });
  });

  const blocksFor = root.Helpers.memoise(function (key) {
    return root.CodecLab.blockStudy({ size: Number(key) });
  });

  const edgesFor = root.Helpers.memoise(function () {
    return root.CodecLab.edgeCases();
  });

  function update(app) {
    const values = panel.values();
    const bake = bakeFor(values['gpc-size']);

    paintMetrics(bake, blocksFor(values['gpc-size']), edgesFor(''));
    paintChart(app, paretoFor(values['gpc-size'] + '|' + values['gpc-corpus']));
    paintBake(bake);
    paintBlocks(blocksFor(values['gpc-size']));
    paintEdges(edgesFor(''));
  }

  function bestOf(bake) {
    let best = null;

    bake.rows.forEach(function (row) {
      row.codecs.forEach(function (codec) {
        if (!best || codec.ratio > best.ratio) best = { ratio: codec.ratio, name: codec.name,
          corpus: row.corpus };
      });
    });
    return best;
  }

  function worstOf(bake) {
    let worst = null;

    bake.rows.forEach(function (row) {
      row.codecs.forEach(function (codec) {
        if (!worst || codec.ratio < worst.ratio) worst = { ratio: codec.ratio, name: codec.name,
          corpus: row.corpus };
      });
    });
    return worst;
  }

  function paintMetrics(bake, blocks, edges) {
    const best = bestOf(bake);
    const worst = worstOf(bake);
    let checked = 0;
    let passed = 0;

    bake.rows.forEach(function (row) {
      row.codecs.forEach(function (codec) {
        checked += 1;
        if (codec.roundTrip) passed += 1;
      });
    });
    edges.forEach(function (entry) {
      entry.codecs.forEach(function (codec) {
        checked += 1;
        if (codec.roundTrip) passed += 1;
      });
    });

    root.MetricGrid.update({
      'gpc-best': { value: root.Format.fixed(best.ratio, 2) + '×',
        note: best.name + ' on ' + best.corpus },
      'gpc-worst': { value: root.Format.fixed(worst.ratio, 3) + '×',
        note: worst.name + ' on ' + worst.corpus + ' — below one is expansion' },
      'gpc-roundtrips': { value: root.Format.exact(passed) + ' of ' + root.Format.exact(checked),
        note: passed === checked ? 'every codec decoded its own output on every input'
          : 'A ROUND-TRIP FAILED — the sizes above cannot be trusted' },
      'gpc-overhead': { value: root.Format.exact(blocks[0].overhead) + ' bytes',
        note: 'per stored block, which is why DEFLATE cannot expand its input meaningfully' }
    });
  }

  function paintChart(app, pareto) {
    const host = root.jQuery('#gpc-chart')[0];
    if (!host) return;
    if (chart) chart.destroy();

    chart = root.ErrorBandView.curve(host, {
      lazyLib: app.lazyLib, height: 240, yMin: 1,
      xLabel: 'encoder work: chain links per byte', yLabel: 'compression ratio',
      series: [
        { label: 'the frontier: depth 1 → 64 on ' + pareto.corpus,
          points: pareto.rows.map(function (row) {
            return { x: row.workPerByte, y: row.ratio };
          }) }
      ]
    });

    const first = pareto.rows[0];
    const last = pareto.rows[pareto.rows.length - 1];
    root.Helpers.setText('gpc-chart-note',
      'The Pareto frontier of one codec against its own level dial, on ' +
      root.Format.exact(pareto.bytes) + ' bytes of ' + pareto.corpus + '. Every point is ' +
      'achievable and no point below the curve is worth taking. The interesting column is the ' +
      'one this plot does NOT show: decoder work barely moves across the whole sweep — ' +
      root.Format.exact(first.decodeWork) + ' tokens at the cheap end and ' +
      root.Format.exact(last.decodeWork) + ' at the expensive one — so the entire cost of a ' +
      'higher level falls on the writer. That asymmetry is why compression levels exist as a ' +
      'dial at all.');
  }

  function ratioOf(row, name) {
    return row.codecs.filter(function (codec) { return codec.name === name; })[0];
  }

  function paintBake(bake) {
    root.jQuery('#gpc-bake tbody').html(bake.rows.map(function (row) {
      const winner = row.codecs.reduce(function (best, codec) {
        return codec.ratio > best.ratio ? codec : best;
      }, row.codecs[0]);

      return '<tr><td>' + row.corpus + '</td><td class="mono">' +
        root.Format.fixed(row.entropy, 2) + '</td>' +
        ['Huffman (order-0)', 'arithmetic (order-0)', 'rANS (order-0)', 'LZSS',
          'DEFLATE (LZ + fixed Huffman)', 'BWT + MTF + RLE + Huffman'].map(function (name) {
          const codec = ratioOf(row, name);

          return '<td class="mono">' + root.Format.fixed(codec.ratio, 3) + '</td>';
        }).join('') +
        '<td>' + winner.name.split(' (')[0] + '</td></tr>';
    }).join(''));

    const winners = {};

    bake.rows.forEach(function (row) {
      const winner = row.codecs.reduce(function (best, codec) {
        return codec.ratio > best.ratio ? codec : best;
      }, row.codecs[0]);

      winners[winner.name] = (winners[winner.name] || 0) + 1;
    });
    root.Helpers.setText('gpc-bake-note',
      root.Format.exact(Object.keys(winners).length) + ' different codecs win at least one of ' +
      'the ' + root.Format.exact(bake.rows.length) + ' corpora, which is the reason this table ' +
      'has more than one row. Every column is the same implementation asked the same question, ' +
      'so the differences are entirely properties of the DATA: structured text rewards a ' +
      'dictionary stage, prose rewards the transform chain, and incompressible bytes defeat all ' +
      'six. A benchmark on a single corpus produces a winner and no information.');
  }

  function paintBlocks(blocks) {
    root.jQuery('#gpc-blocks tbody').html(blocks.map(function (row) {
      return '<tr><td>' + row.corpus + '</td><td class="mono">' +
        root.Format.exact(row.storedBytes) + '</td><td class="mono">' +
        root.Format.exact(row.fixedBytes) + '</td><td class="mono">' + row.choice +
        '</td><td class="mono">' + root.Format.fixed(row.ratio, 3) + '</td><td class="mono">' +
        (row.roundTrip ? 'verified' : 'FAILED') + '</td></tr>';
    }).join(''));

    const stored = blocks.filter(function (row) { return row.choice === 'stored'; });
    root.Helpers.setText('gpc-blocks-note',
      root.Format.exact(stored.length) + ' of ' + root.Format.exact(blocks.length) +
      ' corpora are cheaper stored than coded, and both of them are incompressible by ' +
      'construction. That is the whole point of having the option: on those rows the coded form ' +
      'is LARGER than the input, and a format without a stored block would have to ship it. The ' +
      'overhead is ' + root.Format.exact(blocks[0].overhead) + ' bytes — a type field, a length ' +
      'and its complement — so the worst case for the entire format is a fraction of a per cent ' +
      'rather than the twelve per cent an entropy coder alone produces on random input.');
  }

  function paintEdges(edges) {
    root.jQuery('#gpc-edges tbody').html(edges.map(function (entry) {
      const all = entry.codecs.every(function (codec) { return codec.roundTrip; });

      return '<tr><td>' + entry.name + '</td>' +
        entry.codecs.map(function (codec) {
          return '<td class="mono">' + root.Format.exact(codec.bits) + '</td>';
        }).join('') +
        '<td class="mono">' + (all ? 'yes' : 'NO') + '</td></tr>';
    }).join(''));

    const skew = edges.filter(function (entry) { return entry.name.indexOf('99/1') >= 0; })[0];
    const huffman = skew.codecs[0];
    const arithmetic = skew.codecs[1];
    root.Helpers.setText('gpc-edges-note',
      'Bits, not bytes, because the interesting rows are tiny. Empty input has to produce empty ' +
      'output and decode back to nothing; a single byte costs more to describe than to store in ' +
      'every scheme. The last row is the previous two sections in one line: on a thousand bytes ' +
      'that are 99% one value, Huffman spends ' + root.Format.exact(huffman.bits) +
      ' bits and the arithmetic coder spends ' + root.Format.exact(arithmetic.bits) + ' — a ' +
      'factor of ' + root.Format.fixed(huffman.bits / arithmetic.bits, 1) + ' — and the BWT ' +
      'chain beats them both by turning the run structure into something an order-0 coder can ' +
      'see.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

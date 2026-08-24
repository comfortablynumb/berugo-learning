/**
 * Section: transform-based compression.
 *
 * The measurement is the first two rows of the stage table, and they are
 * IDENTICAL. The Burrows–Wheeler transform is a permutation: same length, same
 * symbol counts, same order-0 entropy to every decimal place. It compresses
 * nothing, and running it before a compressor roughly halves the output. The
 * drop appears at move-to-front, and that is the fact the section exists for —
 * the transform is a way of making a weak model accurate, not a way of removing
 * redundancy.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'transform-compression';
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
      title: 'Diagram — the bzip2 chain, and what each stage is for',
      caption: 'Four stages, only the last of which compresses. The transform sorts every ' +
        'rotation of the block, which puts characters with similar following context next to ' +
        'each other — the letters before "he" in English end up in one run, and that run is ' +
        'mostly "t". Move-to-front turns local repetition into small numbers, and a run of one ' +
        'character into a run of zeros. Run-length coding collapses those runs. Only then does an ' +
        'entropy coder run, and it is a weak order-0 one, which is the point: the pipeline makes ' +
        'a simple model accurate instead of building a complicated one.',
      definition: [
        'flowchart LR',
        '    I["input block<br/>4.56 bits per byte"] --> B["BWT<br/>a permutation"]',
        '    B --> B2["4.56 bits per byte<br/>IDENTICAL — nothing was compressed"]',
        '    B2 --> M["move-to-front<br/>position in a reordered list"]',
        '    M --> M2["0.74 bits per byte<br/>the entropy finally falls"]',
        '    M2 --> R["run-length code the zeros"]',
        '    R --> R2["fewer symbols, runs collapsed"]',
        '    R2 --> H["order-0 Huffman<br/>a weak coder is now enough"]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**The Burrows–Wheeler transform does not compress anything.** It is a permutation: same ' +
        'length, same symbol counts, and therefore — by definition — the same order-0 entropy. ' +
        'The demo’s first two table rows are identical to four decimal places, and that is the ' +
        'measurement the whole section is arranged around.',
      '**What it does is rearrange.** Sorting every rotation of the block groups characters by ' +
        'what FOLLOWS them, so the characters preceding "he" in English text land in one run, and ' +
        'that run is mostly "t". The output is locally repetitive in a way the input was not.',
      '**Move-to-front converts local repetition into small numbers.** Each symbol is replaced by ' +
        'its position in a list that puts the last-seen symbol first, so a run of one character ' +
        'becomes a run of zeros. This is where the entropy drops — from about 4.6 bits per byte ' +
        'to under one on the demo’s text.',
      '**Then run-length coding collapses the zeros and a weak entropy coder finishes.** The ' +
        'coder is order-0 Huffman, which the earlier sections showed is far from the best ' +
        'available. It does not need to be better: the pipeline has already made the simple model ' +
        'accurate.',
      '**The transform is invertible from one extra integer.** The LF mapping — the i-th ' +
        'occurrence of a character in the last column is the i-th in the first — lets a decoder ' +
        'walk the original back out knowing only which row was the untransformed string. That is ' +
        'why a permutation this aggressive is still safe.',
      '**Block size is the one real parameter, and it is a memory decision.** A bigger block finds ' +
        'more context and costs O(n log n) sorting plus the memory to hold it. bzip2 caps it at ' +
        '900 KB for that reason, and the demo shows the ratio gain flattening well before then.',
      '**The decode cost is asymmetric in the unusual direction.** Most codecs decode faster than ' +
        'they encode; this one inverts the transform with a counting pass and an LF walk, which ' +
        'is fast, but the ENCODER has to sort every rotation. That is why bzip2 is slow to ' +
        'compress and unremarkable to decompress.',
      '**Preprocessing to make a weak model strong is a general technique.** Delta coding before ' +
        'an integer codec, colour transforms before an image codec, sorting a column before ' +
        'run-length coding — all the same move, and all measurable the same way: the transform ' +
        'changes no bytes and the stage after it gets much better.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — the chain stage by stage, with the entropy at each',
        markup: root.TransformCompressionTemplate.render()
      },
      diagram: diagram(),
      insight: '**The BWT does not compress; it rearranges data so that a simple model becomes ' +
        'accurate — and that is a technique, not a trick specific to text.** The general form is ' +
        'worth carrying: when a model is weak, ask whether a REVERSIBLE rearrangement would make ' +
        'the data fit it, rather than making the model stronger. Delta coding before an integer ' +
        'codec, sorting a column before run-length coding, a colour transform before a DCT — all ' +
        'the same move. The diagnostic is the one this demo makes visible: a transform that ' +
        'leaves the entropy unchanged and makes the next stage much better is doing exactly what ' +
        'it should.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.TransformCompressionTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  const studyFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.CodingLab.transformStudy({ corpus: parts[0], size: Number(parts[1]) });
  });

  function update(app) {
    const values = panel.values();
    const study = studyFor(values['bwtp-corpus'] + '|' + values['bwtp-size']);

    paintMetrics(study);
    paintChart(app, study);
    paintStages(study);
    paintSample(study);
    paintBlocks(study);
  }

  function paintMetrics(study) {
    const stages = study.stages;

    root.MetricGrid.update({
      'bwtp-input': { value: root.Format.fixed(stages[0].bits, 4) + ' bits',
        note: root.Format.exact(study.bytes) + ' bytes of ' + study.corpus },
      'bwtp-after': { value: root.Format.fixed(stages[1].bits, 4) + ' bits',
        note: Math.abs(stages[1].bits - stages[0].bits) < 1e-9
          ? 'IDENTICAL to the input — a permutation cannot change symbol counts'
          : 'differs from the input, which would mean the transform is not a permutation' },
      'bwtp-mtf': { value: root.Format.fixed(stages[2].bits, 4) + ' bits',
        note: root.Format.fixed(stages[0].bits / Math.max(1e-9, stages[2].bits), 2) +
          '× lower than the input — this is where the gain is' },
      'bwtp-zeros': { value: root.Format.percent(study.zeroShare, 1),
        note: 'round-trip through the whole chain ' +
          (study.roundTrip ? 'verified' : 'FAILED') }
    });
  }

  function paintChart(app, study) {
    const host = root.jQuery('#bwtp-chart')[0];
    if (!host) return;
    if (chart) chart.destroy();

    chart = root.ErrorBandView.curve(host, {
      lazyLib: app.lazyLib, height: 240, yMin: 0,
      xLabel: 'pipeline stage', yLabel: 'bits per symbol',
      series: [
        { label: 'entropy after each stage',
          points: study.stages.map(function (stage, i) { return { x: i, y: stage.bits }; }) },
        { label: 'the input, for reference', dashed: true,
          points: study.stages.map(function (unused, i) {
            return { x: i, y: study.stages[0].bits };
          }) }
      ]
    });

    root.Helpers.setText('bwtp-chart-note',
      'Four stages on the x axis: input, after the transform, after move-to-front, after ' +
      'run-length coding. The first two points sit on the dashed line at exactly the same height ' +
      '— the transform is a permutation, so it cannot change the symbol counts and therefore ' +
      'cannot change the order-0 entropy by so much as a rounding error. The drop is entirely at ' +
      'the third point. The fourth rises again, and that is not a failure: the run-length stage ' +
      'has FEWER symbols carrying more information each, so the bits-per-symbol figure goes up ' +
      'while the total goes down.');
  }

  function paintStages(study) {
    root.jQuery('#bwtp-stages tbody').html(study.stages.map(function (stage) {
      return '<tr><td>' + stage.name + '</td><td class="mono">' +
        root.Format.exact(stage.length) + '</td><td class="mono">' +
        root.Format.fixed(stage.bits, 4) + '</td><td class="mono">' +
        root.Format.exact(stage.bytes) + '</td><td>' + stage.note + '</td></tr>';
    }).join(''));

    const input = study.stages[0];
    const transformed = study.stages[1];
    const mtf = study.stages[2];
    const last = study.stages[study.stages.length - 1];
    root.Helpers.setText('bwtp-stages-note',
      'Read the first two rows together: ' + root.Format.fixed(input.bits, 4) + ' bits per byte ' +
      'before the transform and ' + root.Format.fixed(transformed.bits, 4) + ' after it, over ' +
      'the same ' + root.Format.exact(input.length) + ' symbols. The transform moved every byte ' +
      'and removed nothing. Move-to-front then takes it to ' +
      root.Format.fixed(mtf.bits, 4) + ' — a factor of ' +
      root.Format.fixed(input.bits / Math.max(1e-9, mtf.bits), 2) + ' — because the transform ' +
      'left the data in runs and MTF turns a run into zeros. The floor column is where that ' +
      'matters: ' + root.Format.exact(input.bytes) + ' bytes at the start against ' +
      root.Format.exact(last.bytes) + ' at the end, on data no stage ever discarded.');
  }

  function paintSample(study) {
    const rows = [
      { name: 'input', values: study.sample.input, note: 'readable text' },
      { name: 'after BWT', values: study.sample.transformed, note: 'runs of one character' },
      { name: 'after MTF', values: study.sample.mtf, note: 'mostly zeros' }
    ];

    root.jQuery('#bwtp-sample tbody').html(rows.map(function (row) {
      const shown = row.values.slice(0, 32).map(function (value) {
        if (row.name === 'after MTF') return value;
        if (value === 32) return '_';
        if (value >= 33 && value <= 126) return String.fromCharCode(value);
        return '.';
      }).join(row.name === 'after MTF' ? ' ' : '');

      return '<tr><td>' + row.name + '</td><td class="mono">' + shown + '</td></tr>';
    }).join(''));

    root.Helpers.setText('bwtp-sample-note',
      'The same 32 positions at three points in the chain. The middle row is what sorting the ' +
      'rotations produces — long runs of one character, because everything that precedes a given ' +
      'context has been gathered together. The bottom row is the same data after move-to-front, ' +
      'and it is nearly all zeros: each zero means "the same symbol as last time". An order-0 ' +
      'coder cannot see structure in the top row and can see it perfectly in the bottom one, and ' +
      'no information was added or removed between them.');
  }

  function paintBlocks(study) {
    root.jQuery('#bwtp-blocks tbody').html(study.blocks.map(function (row) {
      return '<tr><td class="mono">' + root.Format.exact(row.block) + '</td><td class="mono">' +
        root.Format.exact(row.blocks) + '</td><td class="mono">' +
        root.Format.fixed(row.bitsPerSymbol, 4) + '</td><td class="mono">' +
        root.Format.percent(row.zeroShare, 1) + '</td><td class="mono">' +
        root.Format.exact(row.bytes) + '</td><td class="mono">' +
        root.Format.fixed(row.ratio, 3) + '</td></tr>';
    }).join(''));

    const first = study.blocks[0];
    const last = study.blocks[study.blocks.length - 1];
    root.Helpers.setText('bwtp-blocks-note',
      'A bigger block sees more context, so more of the data ends up in runs: the zero share ' +
      'rises from ' + root.Format.percent(first.zeroShare, 0) + ' at ' +
      root.Format.exact(first.block) + ' bytes to ' + root.Format.percent(last.zeroShare, 0) +
      ' at ' + root.Format.exact(last.block) + ', and the ratio with it. The cost is sorting: ' +
      'O(n log n) comparisons over rotations, plus the memory to hold the block and its ' +
      'suffix order. bzip2 caps the block at 900 KB, and the shape of this column is why — the ' +
      'gain per doubling is already shrinking here.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

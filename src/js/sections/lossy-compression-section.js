/**
 * Section: lossy compression.
 *
 * The measurement that changed what this section says is generation loss.
 * The folklore is that re-saving a JPEG degrades it every time; the demo runs
 * the loop and it does not — with the same quality table on the same 8x8 grid,
 * the second encode is a fixed point, because every coefficient is already a
 * multiple of its step. Shift the grid by three pixels, which is what a crop or
 * a resize does, and the damage accumulates on every round. Both columns are
 * reported side by side, and the pair is the finding.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'lossy-compression';
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
      title: 'Diagram — the JPEG pipeline, with the one lossy step marked',
      caption: 'Only one box in this chain loses information. The colour transform is reversible ' +
        'arithmetic, the DCT is reversible arithmetic, and the entropy coder is lossless by ' +
        'definition. QUANTISATION — divide each coefficient by a step and round — is where the ' +
        'quality setting lives and where everything is thrown away. Chroma subsampling is a ' +
        'second lossy step in colour images, and it is there for the same reason: a claim about ' +
        'the receiver, namely that human vision resolves brightness better than colour.',
      definition: [
        'flowchart LR',
        '    I["pixels"] --> C["colour transform to Y, Cb, Cr<br/>reversible"]',
        '    C --> S["chroma subsampling<br/>LOSSY: half the colour resolution"]',
        '    S --> B["split into 8×8 blocks"]',
        '    B --> D["DCT<br/>reversible: energy moves to the corner"]',
        '    D --> Q["quantise<br/>LOSSY: divide by a step and round"]',
        '    Q --> Z["zigzag order<br/>low frequencies first"]',
        '    Z --> E["run-length + Huffman<br/>lossless"]'
      ].join('\n')
    };
  }

  function orientationPipeline() {
    return [
      '**Lossy compression is a modelling claim about the RECEIVER, not about the data.** JPEG ' +
        'discards high spatial frequencies because human vision is poor at them, and a perceptual ' +
        'audio codec discards what a nearby louder tone would mask.',
      'The information is genuinely gone, and whether that matters depends entirely on who is ' +
        'looking.',
      '**The pipeline is transform, quantise, entropy-code, and only the middle step loses ' +
        'anything.** The DCT is reversible arithmetic, and the entropy coder is lossless.',
      'Quantisation, which divides by a step and rounds, is the whole of the loss. The quality ' +
        'setting is a multiplier on the step table.',
      '**The transform earns its place by energy compaction.** Natural images are locally smooth, ' +
        'so the DCT concentrates most of a block’s energy into a handful of low-frequency ' +
        'coefficients.',
      'Quantisation then zeroes nearly everything else, and the zigzag order puts those zeros in ' +
        'one run for the entropy stage.',
      '**Rate against distortion is a curve, and quoting one point on it is how codec comparisons ' +
        'go wrong.** The demo sweeps quality from 10 to 100 and reports bytes, PSNR and SSIM at ' +
        'each.',
      'There are three columns, because the ranking depends on which one you read.'
    ];
  }

  function orientationMeasurement() {
    return [
      '**PSNR and SSIM disagree, and the disagreement is informative.** PSNR is a per-pixel error ' +
        'and cannot see where the error is. SSIM compares local structure and punishes blocking.',
      'A comparison on PSNR alone flatters block-transform codecs, which is exactly what this ' +
        'section implements.',
      '**Quality 100 is not lossless.** The quantisation table becomes all ones, but the DCT is ' +
        'computed in floating point and rounded back to integers, so a few least-significant bits ' +
        'still move.',
      'The demo measures a finite PSNR at quality 100 rather than an infinite one.',
      '**Generation loss is conditional, and the folklore gets it wrong.** Re-encoding at the same ' +
        'quality on the same block grid reaches a fixed point after ONE round, because every ' +
        'coefficient is already a multiple of its step.',
      'It is a crop, a resize or a different encoder’s alignment that keeps the damage ' +
        'accumulating, and the demo measures both.',
      '**A codec tuned for eyes can destroy exactly what a detector needed.** The high-frequency ' +
        'detail JPEG throws away is where an edge detector, a barcode reader or a fingerprint ' +
        'matcher lives.',
      'Re-encoding images before inference is a common and expensive version of this mistake.'
    ];
  }

  function orientation() {
    return orientationPipeline().concat(orientationMeasurement());
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — the quality ladder, one block, and the re-encode loop',
        markup: root.LossyCompressionTemplate.render()
      },
      diagram: diagram(),
      insight: '**Lossy compression is a claim about the receiver, so the only question that ' +
        'matters is who reads the data afterwards. If the answer is "a program", the ' +
        'perceptual argument does not apply at all.** The measured half of that is the ' +
        'generation-loss table. Re-saving at the same settings on the same grid costs nothing ' +
        'after the first round, and a three-pixel shift costs something every time. So the ' +
        'operational rule is not "never re-encode". It is "never re-encode after anything has ' +
        'moved", and the pipeline that crops, resizes and re-saves is the one that quietly ' +
        'destroys an archive.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.LossyCompressionTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  const qualityFor = root.Helpers.memoise(function (key) {
    return root.LossyLab.qualityStudy({ size: Number(key) });
  });

  const blockFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.LossyLab.blockStudy({ size: Number(parts[0]), quality: Number(parts[1]) });
  });

  const generationFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.LossyLab.generationStudy({ size: Number(parts[0]), quality: Number(parts[1]),
      rounds: Number(parts[2]) });
  });

  const pointFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.LossyLab.qualityStudy({ size: Number(parts[0]),
      qualities: [Number(parts[1])] }).rows[0];
  });

  function update(app) {
    const values = panel.values();
    const point = pointFor(values['lsy-size'] + '|' + values['lsy-quality']);

    paintMetrics(point);
    paintChart(app, qualityFor(values['lsy-size']));
    paintQuality(qualityFor(values['lsy-size']));
    paintBlock(blockFor(values['lsy-size'] + '|' + values['lsy-quality']));
    paintGeneration(generationFor(values['lsy-size'] + '|' + values['lsy-quality'] + '|' +
      values['lsy-rounds']));
  }

  function paintMetrics(point) {
    root.MetricGrid.update({
      'lsy-ratio': { value: root.Format.fixed(point.ratio, 2) + '×',
        note: root.Format.exact(point.bytes) + ' bytes at quality ' +
          root.Format.exact(point.quality) },
      'lsy-psnr': { value: point.db === Infinity ? 'exact'
        : root.Format.fixed(point.db, 2) + ' dB',
      note: 'mean squared error ' + root.Format.fixed(point.mse, 2) + ' per pixel' },
      'lsy-ssim': { value: root.Format.fixed(point.ssim, 4),
        note: point.ssim > 0.99 ? 'structurally indistinguishable at this quality'
          : 'structure is measurably altered — blocking is what this notices' },
      'lsy-kept': { value: root.Format.exact(point.nonZero),
        note: 'of ' + root.Format.exact(point.coefficients) + ', so ' +
          root.Format.percent(1 - point.nonZero / point.coefficients, 1) +
          ' quantised to zero' }
    });
  }

  function paintChart(app, study) {
    const host = root.jQuery('#lsy-chart')[0];
    if (!host) return;
    if (chart) chart.destroy();

    const finite = study.rows.filter(function (row) { return row.db !== Infinity; });

    chart = root.ErrorBandView.curve(host, {
      lazyLib: app.lazyLib, height: 250, yMin: 0,
      xLabel: 'bytes', yLabel: 'quality measure',
      series: [
        { label: 'PSNR (dB)', points: finite.map(function (row) {
          return { x: row.bytes, y: row.db };
        }) },
        { label: 'SSIM × 50', dashed: true, points: study.rows.map(function (row) {
          return { x: row.bytes, y: row.ssim * 50 };
        }) }
      ]
    });

    const low = study.rows[0];
    const high = study.rows[study.rows.length - 1];
    root.Helpers.setText('lsy-chart-note',
      'The rate–distortion curve, with both distortion measures on one axis (SSIM scaled by 50 ' +
      'so the shapes are comparable). They do not have the same shape: SSIM saturates — it ' +
      'reaches ' + root.Format.fixed(study.rows[study.rows.length - 2].ssim, 4) + ' well before ' +
      'the largest file — while PSNR keeps climbing to ' +
      (high.db === Infinity ? 'the limit' : root.Format.fixed(high.db, 1) + ' dB') + '. That gap ' +
      'is where a codec comparison goes wrong: past the point where SSIM has saturated, the ' +
      'extra bytes are buying decibels a viewer cannot see. The left end is the other lesson: at ' +
      root.Format.exact(low.bytes) + ' bytes the ratio is ' + root.Format.fixed(low.ratio, 1) +
      '× and both measures agree the image is damaged.');
  }

  function paintQuality(study) {
    root.jQuery('#lsy-ladder tbody').html(study.rows.map(function (row) {
      return '<tr><td class="mono">' + row.quality + '</td><td class="mono">' +
        root.Format.exact(row.bytes) + '</td><td class="mono">' +
        root.Format.fixed(row.ratio, 2) + '</td><td class="mono">' +
        (row.db === Infinity ? 'exact' : root.Format.fixed(row.db, 2)) +
        '</td><td class="mono">' + root.Format.fixed(row.ssim, 4) + '</td><td class="mono">' +
        root.Format.exact(row.nonZero) + '</td><td class="mono">' +
        root.Format.percent(row.nonZero / row.coefficients, 1) + '</td></tr>';
    }).join(''));

    const top = study.rows[study.rows.length - 1];
    root.Helpers.setText('lsy-ladder-note',
      'The last column is what actually drives the file size: at quality ' +
      root.Format.exact(study.rows[0].quality) + ' only ' +
      root.Format.percent(study.rows[0].nonZero / study.rows[0].coefficients, 1) +
      ' of the coefficients survive quantisation, and the rest are a run of zeros the entropy ' +
      'stage codes almost for free. Quality ' + root.Format.exact(top.quality) +
      ' is worth pausing on: the quantisation table is all ones and the PSNR is still ' +
      (top.db === Infinity ? 'unbounded' : root.Format.fixed(top.db, 1) + ' dB rather than ' +
        'infinite') + ', because the DCT is computed in floating point and rounded back to ' +
      'integers. Quality 100 is not lossless in any JPEG implementation, and that surprises ' +
      'people who use it as an archival setting.');
  }

  function paintBlock(block) {
    const rows = [];

    for (let row = 0; row < 8; row += 1) {
      rows.push({
        row: row,
        coefficients: block.coefficients.slice(row * 8, row * 8 + 8)
          .map(function (value) { return root.Format.fixed(value, 0); }).join(' '),
        table: block.table.slice(row * 8, row * 8 + 8).join(' '),
        levels: block.levels.slice(row * 8, row * 8 + 8).join(' ')
      });
    }
    root.jQuery('#lsy-block tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + row.row + '</td><td class="mono">' + row.coefficients +
        '</td><td class="mono">' + row.table + '</td><td class="mono">' + row.levels +
        '</td></tr>';
    }).join(''));

    root.Helpers.setText('lsy-block-note',
      'One 8 × 8 block at quality ' + root.Format.exact(block.quality) + '. Read the first ' +
      'column downwards: the DCT has pushed ' +
      root.Format.percent(block.energyInCorner, 1) + ' of the block’s energy into the top-left ' +
      '4 × 4 corner, which is what "energy compaction" means and why the transform is worth ' +
      'doing at all. The second column is the quantisation table — small steps at the top left ' +
      'where the eye is sensitive, large ones at the bottom right where it is not — and the ' +
      'third is what survives: ' + root.Format.exact(block.nonZero) + ' non-zero levels of 64. ' +
      'The worst pixel error after reconstruction is ' +
      root.Format.exact(block.worstError) + ' of 255.');
  }

  function paintGeneration(study) {
    const rows = study.aligned.map(function (row, i) {
      return { round: row.round, aligned: row, shifted: study.shifted[i] };
    });

    root.jQuery('#lsy-generation tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + row.round + '</td><td class="mono">' +
        root.Format.fixed(row.aligned.db, 2) + '</td><td class="mono">' +
        root.Format.fixed(row.aligned.ssim, 4) + '</td><td class="mono">' +
        root.Format.exact(row.aligned.changed) + '</td><td class="mono">' +
        root.Format.fixed(row.shifted.db, 2) + '</td><td class="mono">' +
        root.Format.fixed(row.shifted.ssim, 4) + '</td><td class="mono">' +
        root.Format.exact(row.shifted.changed) + '</td></tr>';
    }).join(''));

    const settled = study.aligned.filter(function (row) { return row.changed === 0; })[0];
    const lastShifted = study.shifted[study.shifted.length - 1];
    root.Helpers.setText('lsy-generation-note',
      'The two halves of this table say opposite things and both are correct. Aligned ' +
      're-encoding settles' + (settled ? ' at round ' + root.Format.exact(settled.round) : '') +
      ': after the first pass every coefficient is already a multiple of its quantisation step, ' +
      'so the next encode changes nothing and the pixels-changed column reads zero for the rest ' +
      'of the run. Shifted re-encoding — the block grid moved three pixels, which is what a crop ' +
      'or a resize does — keeps losing, from ' +
      root.Format.fixed(study.shifted[0].db, 2) + ' dB to ' +
      root.Format.fixed(lastShifted.db, 2) + ' over ' + root.Format.exact(study.rounds) +
      ' rounds. So "never re-save a JPEG" is the wrong rule; "never re-save one after anything ' +
      'has moved" is the right one.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

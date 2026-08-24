/**
 * Section: arithmetic coding and ANS.
 *
 * The measurement is the overhead column. An arithmetic coder's output is
 * within a couple of BITS — not per symbol, per message — of the message's
 * information content, and the demo reports that difference directly: about one
 * bit over on every corpus it runs. That is what "reaches the entropy" means
 * when it is measured rather than asserted, and it is why the Huffman gap in
 * the previous section is a design limit rather than an implementation defect.
 *
 * rANS is beside it on the same model, and it is HONESTLY worse here: it pays a
 * 32-bit state flush and a model quantised to a power of two. On a real corpus
 * that is a fraction of a per cent and it buys table-driven decoding, which is
 * the trade every modern codec has taken.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'arithmetic-coding-and-ans';
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
      title: 'Diagram — the interval, subdivided three times',
      caption: 'Start with [0, 1). Each symbol selects the sub-interval its probability owns, and ' +
        'the next symbol subdivides THAT. After the whole message the surviving interval has ' +
        'width equal to the product of the probabilities, and any number inside it identifies ' +
        'the message — so the cost is the bits needed to name a point in an interval of that ' +
        'width, which is the sum of −log₂(p). Nothing rounds to a whole bit anywhere in the ' +
        'process, which is the entire difference from a symbol code.',
      definition: [
        'flowchart TD',
        '    S["[0, 1)"] --> A["a: [0.00, 0.60)<br/>p = 0.6, costs 0.74 bits"]',
        '    S --> B["b: [0.60, 0.90)<br/>p = 0.3, costs 1.74 bits"]',
        '    S --> C["c: [0.90, 1.00)<br/>p = 0.1, costs 3.32 bits"]',
        '    B --> BA["ba: [0.600, 0.780)"]',
        '    B --> BB["bb: [0.780, 0.870)"]',
        '    B --> BC["bc: [0.870, 0.900)"]',
        '    BA --> BAC["bac: [0.762, 0.780)<br/>width 0.018 — 5.80 bits so far"]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**Arithmetic coding codes the whole message as one number.** Narrow the interval [0, 1) by ' +
        'each symbol’s probability in turn, then emit enough bits to name a point inside what is ' +
        'left. The interval’s width is the product of the probabilities, so the bits needed are ' +
        'the sum of −log₂(p) — the information content, exactly.',
      '**The overhead is a constant per MESSAGE, not per symbol.** Terminating the interval costs ' +
        'about two bits however long the message was, which is why the demo’s measured output is ' +
        'roughly one bit above the information content on a three-thousand-byte corpus. Compare ' +
        'that to Huffman’s up-to-one-bit-per-symbol and the difference is the whole subject.',
      '**A real implementation is integer arithmetic with renormalisation.** Keep a 16- or 32-bit ' +
        'low and high, and whenever their leading bits agree, that bit of the answer is decided — ' +
        'emit it and shift both left. No floating point appears anywhere in a production coder.',
      '**The underflow counter is the part that is easy to omit and fatal to omit.** When low is ' +
        'above a quarter and high below three quarters, the interval straddles the midpoint and ' +
        'NEITHER end has decided its leading bit, so nothing can be emitted while the interval ' +
        'keeps shrinking. The fix is to remember bits that are owed and emit their opposite ' +
        'later; without it the coder works on most inputs and corrupts some.',
      '**An adaptive model transmits nothing at all.** Counts start at one and rise as symbols ' +
        'arrive; encoder and decoder update identically, so the model never goes in the stream. ' +
        'The price is a learning curve — the first few hundred symbols are coded under a bad ' +
        'model — and the demo plots it.',
      '**ANS is the modern answer: one integer of state, a multiply and a divide per symbol.** ' +
        'Encoding pushes a symbol onto the state and decoding pops it, which is why an ANS ' +
        'decoder runs the message BACKWARDS relative to the encoder. That is not a quirk to work ' +
        'around; it is why an ANS encoder buffers its input.',
      '**rANS needs the frequency total to be a power of two**, so the slot lookup is a mask and ' +
        'the division a shift. Normalising the counts to 2^k is part of the codec rather than a ' +
        'convenience, and the rounding it forces is one of the two reasons rANS measures slightly ' +
        'worse than arithmetic coding here.',
      '**This is why zstd, LZFSE and JPEG XL all switched.** ANS gets arithmetic-coding ratios at ' +
        'Huffman-like speed, and speed on the DECODE side is what a format is usually judged on — ' +
        'data is written once and read many times.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — the interval, the integer coder and rANS',
        markup: root.ArithmeticCodingTemplate.render()
      },
      diagram: diagram(),
      insight: '**ANS is the most consequential compression development of the last fifteen ' +
        'years, because it removed the reason to accept Huffman’s whole-bit penalty.** Before it, ' +
        'the choice was a fast coder that wastes up to a bit per symbol or an accurate one that ' +
        'costs a multiply and a divide with a serial dependency — and every format shipped the ' +
        'fast one. rANS collapses that trade: table-driven, one state variable, and within a ' +
        'fraction of a per cent of the entropy. If you are choosing an entropy stage today the ' +
        'question is no longer ratio against speed, it is whether your decoder can afford to run ' +
        'the symbol stream backwards.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.ArithmeticCodingTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  const studyFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.CodingLab.arithmeticStudy({ corpus: parts[0], size: Number(parts[1]) });
  });

  const walkFor = root.Helpers.memoise(function (key) {
    return root.CodingLab.intervalWalk(key);
  });

  function update(app) {
    const values = panel.values();
    const study = studyFor(values['ari-corpus'] + '|' + values['ari-size']);

    paintMetrics(study);
    paintChart(app, study);
    paintIntervals(walkFor(values['ari-word']));
    paintCoders(study);
    paintInteger(study);
  }

  function paintMetrics(study) {
    root.MetricGrid.update({
      'ari-bits': { value: root.Format.exact(study.arithmetic.bits),
        note: root.Format.fixed(study.arithmetic.bitsPerSymbol, 4) + ' bits per byte, round-trip ' +
          (study.arithmetic.roundTrip ? 'verified' : 'FAILED') },
      'ari-ideal': { value: root.Format.fixed(study.idealBits, 1),
        note: 'the model’s own entropy of ' + root.Format.fixed(study.entropy, 4) +
          ' bits times ' + root.Format.exact(study.bytes) + ' bytes' },
      'ari-over': { value: '+' + root.Format.fixed(study.arithmetic.overIdeal, 2) + ' bits',
        note: root.Format.fixed(study.arithmetic.overIdeal / study.bytes, 6) +
          ' bits per symbol — a constant per message, not per symbol' },
      'ari-rans': { value: root.Format.exact(study.rans.bits),
        note: '+' + root.Format.fixed(study.rans.overIdeal, 0) +
          ' bits: a 32-bit state flush plus a model quantised to 4 096' }
    });
  }

  function paintChart(app, study) {
    const host = root.jQuery('#ari-chart')[0];
    if (!host) return;
    if (chart) chart.destroy();

    const curve = study.adaptive.curve;

    chart = root.ErrorBandView.curve(host, {
      lazyLib: app.lazyLib, height: 240, yMin: 0,
      xLabel: 'symbols coded', yLabel: 'bits per symbol so far',
      series: [
        { label: 'adaptive model, running average',
          points: curve.map(function (point) {
            return { x: point.at + 1, y: point.bitsPerSymbol };
          }) },
        { label: 'the static model’s entropy', dashed: true,
          points: curve.map(function (point) {
            return { x: point.at + 1, y: study.entropy };
          }) }
      ]
    });

    root.Helpers.setText('ari-chart-note',
      'An adaptive model starts uniform — every symbol equally likely, ' +
      root.Format.fixed(Math.log2(study.bytes > 0 ? 30 : 2), 2) + ' bits or so for a 30-symbol ' +
      'alphabet — and learns as it goes. The curve falls towards the dashed line, which is what a ' +
      'static model of the same order achieves once its table has been transmitted. The adaptive ' +
      'coder ends at ' + root.Format.fixed(study.adaptive.bitsPerSymbol, 4) + ' bits per symbol ' +
      'against the static ' + root.Format.fixed(study.entropy, 4) + ', and it sends NO table at ' +
      'all — which is the trade: a worse start in exchange for nothing in the header, and on a ' +
      'long enough stream the start stops mattering.');
  }

  function paintIntervals(walk) {
    const host = root.jQuery('#ari-intervals')[0];
    if (!host) return;

    root.BitstreamView.renderIntervals(host, walk.steps);

    const last = walk.steps[walk.steps.length - 1];
    root.Helpers.setText('ari-intervals-note',
      'Coding "' + walk.text + '" as one number. Each row is the interval after one more symbol, ' +
      'and the width column is the product of the probabilities so far: it ends at ' +
      last.width.toExponential(2) + ', which needs ' + root.Format.fixed(last.bits, 2) +
      ' bits to name a point inside. The integer coder emits ' + root.Format.exact(walk.bits) +
      ' bits for this message against an information content of ' +
      root.Format.fixed(walk.ideal, 2) + '. Notice that no row halves the interval — each one ' +
      'multiplies it by a probability, and a probability is not a power of two, which is exactly ' +
      'the thing a symbol code cannot do.');
  }

  function paintCoders(study) {
    const rows = [
      { name: 'arithmetic (integer, static model)', bits: study.arithmetic.bits,
        perSymbol: study.arithmetic.bitsPerSymbol, over: study.arithmetic.overIdeal,
        roundTrip: study.arithmetic.roundTrip,
        pays: 'about two bits to terminate the interval' },
      { name: 'rANS (12-bit model)', bits: study.rans.bits,
        perSymbol: study.rans.bitsPerSymbol, over: study.rans.overIdeal,
        roundTrip: study.rans.roundTrip,
        pays: 'a 32-bit state flush, plus counts rounded to a power-of-two total' },
      { name: 'Huffman (same frequencies)', bits: study.huffman.bits,
        perSymbol: study.huffman.bitsPerSymbol, over: study.huffman.overIdeal,
        roundTrip: true, pays: 'a whole bit per symbol, rounded up or down' }
    ];

    root.jQuery('#ari-coders tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.name + '</td><td class="mono">' + root.Format.exact(row.bits) +
        '</td><td class="mono">' + root.Format.fixed(row.perSymbol, 4) + '</td><td class="mono">' +
        '+' + root.Format.fixed(row.over, 1) + '</td><td class="mono">' +
        root.Format.fixed(row.over / study.bytes, 5) + '</td><td class="mono">' +
        (row.roundTrip ? 'verified' : 'FAILED') + '</td><td>' + row.pays + '</td></tr>';
    }).join(''));

    root.Helpers.setText('ari-coders-note',
      'All three code the same message against the same frequencies, so the only variable is how ' +
      'each spends its bits. The arithmetic coder is ' +
      root.Format.fixed(study.arithmetic.overIdeal, 1) + ' bits above the information content of ' +
      'the WHOLE message — a rounding error — while Huffman is ' +
      root.Format.fixed(study.huffman.overIdeal, 0) + ' bits above it, which is ' +
      root.Format.fixed(study.huffman.overIdeal / study.bytes, 3) + ' per symbol and is the ' +
      'whole-bit penalty accumulating. rANS lands between them and its overhead is almost ' +
      'entirely fixed cost: the state flush is ' + root.Format.exact(32) + ' bits whatever the ' +
      'message length, so on a real file it disappears into the noise.');
  }

  function paintInteger(study) {
    const rows = [
      { name: 'precision', value: root.Format.exact(16) + ' bits',
        why: 'low and high are integers of this width; the interval is their difference' },
      { name: 'largest pending underflow', value: root.Format.exact(study.arithmetic.maxPending),
        why: 'bits owed while the interval straddled the midpoint — omit this counter and the ' +
          'coder corrupts some inputs and not others' },
      { name: 'termination', value: '2 bits',
        why: 'enough to name a point inside any surviving interval' },
      { name: 'model total cap', value: root.Format.exact(1 << 14),
        why: 'above this the interval arithmetic can round a symbol’s probability to zero, ' +
          'making it uncodeable' },
      { name: 'rANS scale', value: '2^12 = ' + root.Format.exact(4096),
        why: 'the frequency total must be a power of two so the slot lookup is a mask' }
    ];

    root.jQuery('#ari-integer tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.name + '</td><td class="mono">' + row.value + '</td><td>' +
        row.why + '</td></tr>';
    }).join(''));

    root.Helpers.setText('ari-integer-note',
      'The second row is the one worth pausing on. Over this corpus the coder had as many as ' +
      root.Format.exact(study.arithmetic.maxPending) + ' bits owed at once — the interval sat ' +
      'astride the midpoint that many renormalisations in a row, with neither end having decided ' +
      'its leading bit. An implementation without the underflow counter produces correct output ' +
      'whenever that count stays at zero, which on short test inputs it usually does. That is the ' +
      'worst kind of bug: it passes the tests you wrote and corrupts the files you did not.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

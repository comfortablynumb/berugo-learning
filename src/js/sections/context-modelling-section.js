/**
 * Section: context modelling and prediction.
 *
 * The measurement is the turnaround. A plain order-k model improves to order 2
 * and gets WORSE after it, because every context must reserve probability for
 * symbols it has never seen and a sparse model spends most of its mass on
 * nothing. PPM, which escapes to a shorter context instead of paying for the
 * whole alphabet, keeps improving all the way. Same input, same orders, and the
 * only difference is what happens when the context has no answer.
 *
 * That is also the cleanest available statement of why compression is
 * prediction: the bits a message costs are its cross-entropy under the model,
 * which is exactly the loss a language model reports.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'context-modelling';
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
      title: 'Diagram — several predictors mixed into one probability',
      caption: 'The model and the coder are separable, and every improvement in compression since ' +
        'arithmetic coding has been an improvement in the model. Each predictor offers a ' +
        'distribution over the next symbol; a mixer blends them; the coder spends −log₂(p) bits ' +
        'on whatever actually arrives and updates every model. The weights adapt to which ' +
        'predictor has been right, which is why a mixture beats choosing one — and why the PAQ ' +
        'family, which runs dozens of models at once, wins every ratio benchmark and loses every ' +
        'speed one.',
      definition: [
        'flowchart LR',
        '    H["history: ...the quick brown f"] --> M0["order-0 model<br/>letter frequencies"]',
        '    H --> M1["order-1 model<br/>what follows f"]',
        '    H --> M2["order-2 model<br/>what follows _f"]',
        '    H --> MW["word model<br/>what follows a word boundary"]',
        '    M0 --> X["mixer<br/>weights adapt to who was right"]',
        '    M1 --> X',
        '    M2 --> X',
        '    MW --> X',
        '    X --> C["arithmetic coder<br/>spends −log2(p) bits"]',
        '    C --> U["update every model with what actually arrived"]',
        '    U --> H'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**A compressor is two separable things: a model that predicts and a coder that spends ' +
        '−log₂(p) bits on what arrives.** The coder has been solved since arithmetic coding, so ' +
        'every improvement since 1980 is an improvement in prediction. "Compression is ' +
        'prediction" is arithmetic rather than a slogan.',
      '**More context is not automatically better, and the demo shows where it turns around.** A ' +
        'plain order-k model improves to order 2 on this corpus and gets worse after it, because ' +
        'each context must reserve probability for the symbols it has never seen — and a sparse ' +
        'model spends most of its mass on nothing.',
      '**PPM answers sparsity with an escape.** Predict from the longest context that has seen ' +
        'anything; when the symbol is new there, spend an escape symbol and drop an order. The ' +
        'escape costs bits, so the best maximum order is a measurement rather than "as high as ' +
        'possible" — though with escapes it keeps improving far longer than the plain model does.',
      '**Exclusion is the detail that makes PPM work.** A symbol already ruled out by a longer ' +
        'context cannot be predicted by a shorter one, so its probability mass is redistributed ' +
        'rather than wasted. Without exclusions PPM measurably loses to a plain model at the same ' +
        'order.',
      '**Context mixing does not choose — it blends.** Several models predict, a mixer combines ' +
        'them, and the weights move by gradient descent on the coding loss after every symbol. ' +
        'The demo shows the weights migrating from the low orders to the high ones as the file ' +
        'goes past and the deeper contexts accumulate evidence.',
      '**The model costs nothing in the stream and everything in the CPU.** Encoder and decoder ' +
        'update identically, so no table is transmitted — which is why the PAQ family can afford ' +
        'dozens of models and why it compresses at kilobytes per second.',
      '**The equivalence with language modelling is exact, not metaphorical.** The bits a message ' +
        'costs under a model are its cross-entropy; a language model’s training loss is the same ' +
        'quantity in the same units. A model that predicts text well IS a compressor of text, and ' +
        'the Hutter Prize is that observation turned into a competition.',
      '**Tokenisation is the same decision as choosing a model order.** Both are about what the ' +
        'prediction is conditioned on, and both trade context length against how much evidence ' +
        'each context gets — which is the sparsity problem this section measures.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — order-k, PPM and mixing on the same input',
        markup: root.ContextModellingTemplate.render()
      },
      diagram: diagram(),
      insight: '**Every compressor is a prediction machine, and the model is where the ratio ' +
        'comes from — which means the compression literature and the language-modelling ' +
        'literature are measuring the same quantity in the same units.** The practical reading ' +
        'is the sparsity trade-off: a longer context predicts better when it has evidence and ' +
        'catastrophically worse when it does not, so the useful question is never "what order" ' +
        'but "how much data per context". PPM answers it with an escape hatch, mixing answers it ' +
        'by keeping the short contexts alive, and a transformer answers it by sharing statistical ' +
        'strength between contexts that look alike — three answers to one problem.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.ContextModellingTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  const studyFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.CodingLab.contextStudy({ corpus: parts[0], size: Number(parts[1]),
      maxOrder: Number(parts[2]) });
  });

  function update(app) {
    const values = panel.values();
    const study = studyFor(values['ctx-corpus'] + '|' + values['ctx-size'] + '|' +
      values['ctx-order']);

    paintMetrics(study);
    paintChart(app, study);
    paintOrders(study);
    paintPpm(study);
    paintMix(study);
  }

  function bestOrder(study) {
    return study.orders.reduce(function (best, row) {
      return row.bitsPerSymbol < best.bitsPerSymbol ? row : best;
    }, study.orders[0]);
  }

  function paintMetrics(study) {
    const best = bestOrder(study);
    const ppm = study.ppm[study.ppm.length - 1];

    root.MetricGrid.update({
      'ctx-order0': { value: root.Format.fixed(study.orders[0].bitsPerSymbol, 3) + ' bits',
        note: 'over an alphabet of ' + root.Format.exact(study.alphabet) + ' symbols' },
      'ctx-best': { value: root.Format.fixed(best.bitsPerSymbol, 3) + ' bits',
        note: 'order ' + best.order + ' — higher orders are WORSE, at ' +
          root.Format.fixed(study.orders[study.orders.length - 1].bitsPerSymbol, 3) +
          ' by order ' + study.orders[study.orders.length - 1].order },
      'ctx-ppm': { value: root.Format.fixed(ppm.bitsPerSymbol, 3) + ' bits',
        note: 'maximum order ' + ppm.maxOrder + ', ' +
          root.Format.fixed(ppm.escapesPerSymbol, 3) + ' escapes per symbol' },
      'ctx-mixed': { value: root.Format.fixed(study.mixed.bitsPerSymbol, 3) + ' bits',
        note: study.mixed.bitsPerSymbol < best.bitsPerSymbol
          ? 'better than the best single order by ' +
            root.Format.fixed(best.bitsPerSymbol - study.mixed.bitsPerSymbol, 4) + ' bits'
          : 'within ' + root.Format.fixed(study.mixed.bitsPerSymbol - best.bitsPerSymbol, 4) +
            ' bits of the best single order, without knowing which that was' }
    });
  }

  function paintChart(app, study) {
    const host = root.jQuery('#ctx-chart')[0];
    if (!host) return;
    if (chart) chart.destroy();

    chart = root.ErrorBandView.curve(host, {
      lazyLib: app.lazyLib, height: 250, yMin: 0,
      xLabel: 'model order', yLabel: 'bits per symbol',
      series: [
        { label: 'plain order-k model',
          points: study.orders.map(function (row) {
            return { x: row.order, y: row.bitsPerSymbol };
          }) },
        { label: 'PPM with escapes',
          points: study.ppm.map(function (row) {
            return { x: row.maxOrder, y: row.bitsPerSymbol };
          }) },
        { label: 'mixing orders 0–3', dashed: true,
          points: study.orders.map(function (row) {
            return { x: row.order, y: study.mixed.bitsPerSymbol };
          }) }
      ]
    });

    const best = bestOrder(study);
    const lastPpm = study.ppm[study.ppm.length - 1];
    root.Helpers.setText('ctx-chart-note',
      'Two curves that do the same thing and diverge. The plain model bottoms out at order ' +
      best.order + ' and rises again — every context has to reserve probability for ' +
      root.Format.exact(study.alphabet) + ' possible symbols whether it has seen them or not, ' +
      'and a sparse model spends nearly all its mass on symbols that never arrive. PPM keeps ' +
      'falling to ' + root.Format.fixed(lastPpm.bitsPerSymbol, 3) + ' bits, because when a ' +
      'context has no answer it escapes to a shorter one instead of paying for the whole ' +
      'alphabet. The dashed line is a mixture of four orders at once, which never has to choose.');
  }

  function paintOrders(study) {
    const zero = study.orders[0];

    root.jQuery('#ctx-orders tbody').html(study.orders.map(function (row) {
      return '<tr><td class="mono">' + row.order + '</td><td class="mono">' +
        root.Format.fixed(row.bitsPerSymbol, 4) + '</td><td class="mono">' +
        root.Format.exact(row.contexts) + '</td><td class="mono">' +
        root.Format.fixed(row.perContext, 1) + '</td><td class="mono">' +
        root.Format.fixed(row.bitsPerSymbol / zero.bitsPerSymbol, 3) + '×</td></tr>';
    }).join(''));

    const best = bestOrder(study);
    const last = study.orders[study.orders.length - 1];
    root.Helpers.setText('ctx-orders-note',
      'The third and fourth columns explain the second. By order ' + last.order + ' there are ' +
      root.Format.exact(last.contexts) + ' distinct contexts over ' +
      root.Format.exact(study.bytes) + ' symbols — ' + root.Format.fixed(last.perContext, 1) +
      ' observations each — so most predictions come from a context that has seen one or two ' +
      'things and must still reserve probability for the other ' +
      root.Format.exact(study.alphabet - 2) + ' symbols in the alphabet. That reserved mass is ' +
      'the cost, and it grows faster than the extra context is worth: the best plain order here ' +
      'is ' + best.order + ' and the trend after it is upward.');
  }

  function paintPpm(study) {
    root.jQuery('#ctx-escapes tbody').html(study.ppm.map(function (row) {
      const plain = study.orders.filter(function (entry) {
        return entry.order === row.maxOrder;
      })[0];

      return '<tr><td class="mono">' + row.maxOrder + '</td><td class="mono">' +
        root.Format.fixed(row.bitsPerSymbol, 4) + '</td><td class="mono">' +
        root.Format.fixed(row.escapesPerSymbol, 4) + '</td><td class="mono">' +
        (plain ? root.Format.fixed(row.bitsPerSymbol / plain.bitsPerSymbol, 3) + '×' : '—') +
        '</td></tr>';
    }).join(''));

    const first = study.ppm[0];
    const last = study.ppm[study.ppm.length - 1];
    root.Helpers.setText('ctx-escapes-note',
      'The same orders as the table above, with one change: a context that has never seen the ' +
      'symbol emits an escape and hands the prediction to a shorter context. That single ' +
      'mechanism turns the curve around — order ' + last.maxOrder + ' costs ' +
      root.Format.fixed(last.bitsPerSymbol, 4) + ' bits here against the plain model’s ' +
      root.Format.fixed(study.orders[study.orders.length - 1].bitsPerSymbol, 4) + '. The escape ' +
      'is not free: at ' + root.Format.fixed(last.escapesPerSymbol, 3) + ' escapes per symbol it ' +
      'is a real fraction of the output, and it is why the best maximum order is a measurement ' +
      'rather than a maximum. Escapes barely move between order ' + first.maxOrder + ' and ' +
      last.maxOrder + ', which says the deeper contexts are usually finding their answer.');
  }

  function paintMix(study) {
    const trace = study.mixed.weightTrace;
    const shown = trace.filter(function (unused, i) {
      return i % Math.max(1, Math.floor(trace.length / 8)) === 0;
    });

    root.jQuery('#ctx-mix tbody').html(shown.map(function (point) {
      return '<tr><td class="mono">' + root.Format.exact(point.at + 1) + '</td><td class="mono">' +
        root.Format.fixed(point.bitsPerSymbol, 4) + '</td>' +
        point.weights.map(function (weight) {
          return '<td class="mono">' + root.Format.fixed(weight, 4) + '</td>';
        }).join('') + '</tr>';
    }).join(''));

    const finalWeights = study.mixed.weights;
    let dominant = 0;

    finalWeights.forEach(function (weight, i) {
      if (weight > finalWeights[dominant]) dominant = i;
    });
    root.Helpers.setText('ctx-mix-note',
      'Four models, one mixture, and weights that move by gradient descent on the coding loss ' +
      'after every symbol. They start equal at 0.2500 and end with order ' +
      root.Format.exact(study.mixed.orders[dominant]) + ' carrying ' +
      root.Format.percent(finalWeights[dominant], 1) + ' of the prediction — the low orders ' +
      'carry the opening of the file, when the deep contexts have no evidence, and hand over as ' +
      'the evidence accumulates. The mixture ends at ' +
      root.Format.fixed(study.mixed.bitsPerSymbol, 4) + ' bits per symbol without ever being ' +
      'told which order was best, which is the argument for mixing: it is a way of not having to ' +
      'choose a hyperparameter that changes halfway through the file.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

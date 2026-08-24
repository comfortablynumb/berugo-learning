/**
 * Section: information and entropy.
 *
 * The measurement that makes this section worth having is the two columns
 * beside every entropy estimate: how many contexts were seen and how many
 * observations each got. An order-6 model over three kilobytes of text reports
 * an entropy near zero and has learned nothing — it has memorised the input —
 * and without those columns that number looks like a result.
 *
 * The estimator itself is checked against sources whose entropy is known in
 * closed form: a biased coin at four probabilities and two Markov chains. That
 * is what licenses every other number in the milestone, because every ratio in
 * every later section is measured against an entropy this code computed.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'information-and-entropy';
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
      title: 'Diagram — entropy, cross-entropy, and the part a coder can remove',
      caption: 'Entropy is a property of the SOURCE, not of the file: it is the average bits a ' +
        'symbol carries under some model of what generates them. Cross-entropy is what a coder ' +
        'actually pays when its model is wrong, and it is always at least the entropy — the gap ' +
        'is the KL divergence, and it is pure waste. Redundancy is what a better model can still ' +
        'remove: English is about 4.5 bits per letter at order 0 and under 1 at order 3, and ' +
        'that difference is exactly what separates a Huffman coder from a context-mixing one.',
      definition: [
        'flowchart TD',
        '    S["the source<br/>whatever really generates the bytes"] --> H["entropy H<br/>the floor: no lossless code averages fewer bits"]',
        '    S --> M["a model q<br/>what the compressor believes"]',
        '    M --> X["cross-entropy H(p, q)<br/>what the coder actually pays"]',
        '    H --> G["gap = KL divergence<br/>pure waste from a wrong model"]',
        '    X --> G',
        '    H --> R["order-0 entropy<br/>symbols in isolation"]',
        '    H --> R2["order-k entropy<br/>conditioned on the previous k"]',
        '    R --> D["the difference is redundancy<br/>a context model can remove it, an order-0 coder cannot"]',
        '    R2 --> D'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**Entropy is the average number of bits a symbol carries, and the source-coding theorem ' +
        'says no lossless code can average fewer.** That makes it the only honest denominator ' +
        'for a compression ratio: "3× compression" is a claim with no unit until you say 3× ' +
        'against what, and the answer is always the entropy of some model.',
      '**There is no single entropy of a file — there is one number per model.** An order-0 ' +
        'model sees each byte alone; an order-2 model conditions on the previous two. The demo ' +
        'measures English text at about 4.5 bits per byte at order 0 and well under 1 at order ' +
        '3, and that difference is the redundancy a context model can remove.',
      '**A high-order estimate on a short input is memorisation, not modelling.** Every context ' +
        'is seen once, every prediction is certain, and the reported entropy approaches zero ' +
        'while nothing has been learned. The demo reports the context count and the observations ' +
        'per context beside every estimate so that failure is visible rather than flattering.',
      '**"Random data does not compress" is a theorem, not a limitation of the tools.** There are ' +
        '2^n files of n bits and fewer than 2^n shorter descriptions, so no bijection can shorten ' +
        'them all. The demo runs every codec on random bytes and reports the expansion rather ' +
        'than quietly dropping the row.',
      '**Cross-entropy is what a coder pays when its model is wrong**, and it is never below the ' +
        'entropy. The gap is the KL divergence, and it is why a model that is confident and wrong ' +
        'costs more than a model that is uncertain — a fact with exactly the same arithmetic in a ' +
        'compressor and in a language model’s loss.',
      '**Mutual information is the redundancy between neighbours, as one number.** H(X) minus ' +
        'H(X given the previous symbol) is what an order-1 model can remove, and on the demo’s ' +
        'English text it is over two bits per byte — nearly half the order-0 figure.',
      '**The estimator is checked against sources whose entropy is known in closed form.** Four ' +
        'biased coins and two Markov chains, where the true entropy is arithmetic rather than an ' +
        'estimate. Everything else in the milestone is measured against numbers this code ' +
        'produces, so it has to be right first.',
      '**Compression ratio and bits per symbol are the same statement twice.** A ratio hides the ' +
        'denominator and a bits-per-symbol figure carries it, which is why every table in this ' +
        'milestone reports both and puts the entropy in the next column.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — the entropy of a corpus, at every model order',
        markup: root.InformationAndEntropyTemplate.render()
      },
      diagram: diagram(),
      insight: '**A compressor’s ratio is only meaningful against the entropy of a stated model, ' +
        'and choosing the model is the whole argument.** Report "3× compression" and you have ' +
        'said nothing; report "4.62 bits per byte against an order-0 entropy of 4.56" and a ' +
        'reader knows the coder is within 1.2% of its own floor and that a better model is where ' +
        'the remaining gain is. The habit worth taking away is to ask, of any compression claim, ' +
        'what the denominator was — and to notice that a high-order entropy estimate on a small ' +
        'sample is a number about the sample rather than about the source.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.InformationAndEntropyTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  const profileFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.CodingLab.entropyStudy({ corpus: parts[0], size: Number(parts[1]),
      maxOrder: Number(parts[2]) });
  });

  const corporaFor = root.Helpers.memoise(function (key) {
    return root.CodingLab.entropyByCorpus({ size: Number(key) });
  });

  const checkFor = root.Helpers.memoise(function () {
    return root.CodingLab.estimatorCheck({ length: 20000 });
  });

  function update(app) {
    const values = panel.values();
    const study = profileFor(values['ent-corpus'] + '|' + values['ent-size'] + '|' +
      values['ent-order']);
    const check = checkFor('');

    paintMetrics(study, check);
    paintChart(app, study);
    paintProfile(study);
    paintCorpora(corporaFor(values['ent-size']));
    paintCheck(check);
  }

  function paintMetrics(study, check) {
    const zero = study.rows[0];
    const last = study.rows[study.rows.length - 1];
    const worst = check.rows.reduce(function (most, row) {
      return row.error > most ? row.error : most;
    }, 0);

    root.MetricGrid.update({
      'ent-order0': { value: root.Format.fixed(zero.bits, 4) + ' bits',
        note: study.distinct + ' distinct bytes in ' + root.Format.exact(study.bytes) },
      'ent-best': { value: root.Format.fixed(last.bits, 4) + ' bits',
        note: last.reliable
          ? 'order ' + last.order + ', ' + root.Format.fixed(last.perContext, 1) +
            ' observations per context'
          : 'order ' + last.order + ' — only ' + root.Format.fixed(last.perContext, 1) +
            ' observations per context, so this is memorisation' },
      'ent-floor': { value: root.Format.exact(zero.floorBytes),
        note: 'against ' + root.Format.exact(study.bytes) + ' bytes of input, a ratio of ' +
          root.Format.fixed(study.bytes / zero.floorBytes, 2) + '×' },
      'ent-check': { value: root.Format.fixed(worst, 4) + ' bits',
        note: worst < 0.02 ? 'over six sources with a closed-form entropy'
          : 'ABOVE tolerance — the estimator disagrees with the arithmetic' }
    });
  }

  function paintChart(app, study) {
    const host = root.jQuery('#ent-chart')[0];
    if (!host) return;
    if (chart) chart.destroy();

    chart = root.ErrorBandView.curve(host, {
      lazyLib: app.lazyLib, height: 240, yMin: 0,
      xLabel: 'model order', yLabel: 'bits per byte',
      series: [
        { label: 'measured entropy',
          points: study.rows.map(function (row) { return { x: row.order, y: row.bits }; }) },
        { label: 'observations per context (÷ 10)', dashed: true,
          points: study.rows.map(function (row) {
            return { x: row.order, y: row.perContext / 10 };
          }) }
      ]
    });

    const last = study.rows[study.rows.length - 1];
    root.Helpers.setText('ent-chart-note',
      'The solid line is the entropy estimate and the dashed line is how much evidence each ' +
      'context had, scaled down by ten so the two fit on one axis. They fall together, and that ' +
      'is the warning: by order ' + last.order + ' each context has been seen ' +
      root.Format.fixed(last.perContext, 1) + ' times, so the model is describing the sample ' +
      'rather than the source. Read the left half of the plot as measurement and the right half ' +
      'as memorisation, with the crossover wherever the dashed line drops below about half a ' +
      'dozen observations.');
  }

  function paintProfile(study) {
    root.jQuery('#ent-profile tbody').html(study.rows.map(function (row) {
      return '<tr><td class="mono">' + row.order + '</td><td class="mono">' +
        root.Format.fixed(row.bits, 4) + '</td><td class="mono">' +
        root.Format.exact(row.contexts) + '</td><td class="mono">' +
        root.Format.fixed(row.perContext, 1) + '</td><td class="mono">' +
        root.Format.exact(row.floorBytes) + '</td><td class="mono">' +
        (row.reliable ? 'yes' : 'no — memorising') + '</td></tr>';
    }).join(''));

    const zero = study.rows[0];
    const one = study.rows[1] || zero;
    root.Helpers.setText('ent-profile-note',
      'The first row is what an order-0 coder — Huffman, or an arithmetic coder with a static ' +
      'table — is measured against: ' + root.Format.fixed(zero.bits, 4) + ' bits per byte, a ' +
      'floor of ' + root.Format.exact(zero.floorBytes) + ' bytes. One order of context removes ' +
      root.Format.fixed(zero.bits - one.bits, 4) + ' bits per byte, which is the mutual ' +
      'information between neighbouring symbols and is exactly what a context model is for. The ' +
      'last two columns are the honesty check: an entropy estimate from contexts seen a handful ' +
      'of times is a statement about this input and not about the source that produced it.');
  }

  function paintCorpora(rows) {
    root.jQuery('#ent-corpora tbody').html(rows.map(function (row) {
      const usable = row.perContext >= 5;

      return '<tr><td>' + row.corpus + '</td><td class="mono">' +
        root.Format.exact(row.distinct) + '</td><td class="mono">' +
        root.Format.fixed(row.order0, 3) + '</td><td class="mono">' +
        root.Format.fixed(row.order2, 3) + '</td><td class="mono">' +
        root.Format.exact(row.contexts) + '</td><td class="mono">' +
        root.Format.fixed(row.perContext, 1) + '</td><td class="mono">' +
        (usable ? 'yes' : 'NO — memorising') + '</td><td class="mono">' +
        (usable ? root.Format.fixed(row.redundancy, 3) : '—') + '</td></tr>';
    }).join(''));

    const random = rows.filter(function (row) { return row.corpus === 'random bytes'; })[0];
    const logs = rows.filter(function (row) { return row.corpus === 'JSON logs'; })[0];
    const unusable = rows.filter(function (row) { return row.perContext < 5; });

    root.Helpers.setText('ent-corpora-note',
      'Read the last three columns before the third one. The order-2 estimate for random bytes ' +
      'reads ' + root.Format.fixed(random.order2, 3) + ' bits per byte — which would mean random ' +
      'data is almost perfectly predictable — and it is nonsense: 256 possible bytes give ' +
      root.Format.exact(random.contexts) + ' distinct contexts over ' +
      root.Format.exact(random.bytes) + ' samples, so each one is seen ' +
      root.Format.fixed(random.perContext, 1) + ' times and every prediction is a memory of a ' +
      'single observation. ' + root.Format.exact(unusable.length) + ' of ' +
      root.Format.exact(rows.length) + ' rows fail that check, and their redundancy column is ' +
      'left blank rather than filled with a number that would flatly contradict the theorem. ' +
      'Where the estimate IS usable it is worth having: JSON logs carry ' +
      root.Format.fixed(logs.redundancy, 2) + ' bits per byte of redundancy an order-0 coder ' +
      'cannot reach, because the keys repeat exactly and only the values move.');
  }

  function paintCheck(check) {
    root.jQuery('#ent-truth tbody').html(check.rows.map(function (row) {
      return '<tr><td>' + row.source + '</td><td class="mono">' +
        root.Format.fixed(row.truth, 4) + '</td><td class="mono">' +
        root.Format.fixed(row.measured, 4) + '</td><td class="mono">' +
        root.Format.fixed(row.error, 4) + '</td></tr>';
    }).join(''));

    const worst = check.rows.reduce(function (most, row) {
      return row.error > most.error ? row : most;
    }, check.rows[0]);
    root.Helpers.setText('ent-truth-note',
      'Six sources whose entropy is arithmetic rather than an estimate: a biased coin, where ' +
      'H(p) is a closed form, and two Markov chains, where the order-1 entropy is the entropy of ' +
      'one row of the transition matrix. Over ' + root.Format.exact(check.length) +
      ' symbols the worst disagreement is ' + root.Format.fixed(worst.error, 4) + ' bits, on ' +
      worst.source + '. That is the check that licenses every other number in this milestone — ' +
      'each of them is a ratio against an entropy this same code computed, so if the estimator ' +
      'were wrong every conclusion downstream would be wrong in the same direction.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

/**
 * Section: random number generation.
 *
 * The section is organised around tests that do NOT separate generators and
 * tests that do. A one-dimensional histogram passes for everything here,
 * RANDU included — and RANDU's statistic is 0.1 against an expectation of 63,
 * which is its own kind of failure: a full-period generator sweeping every
 * state exactly once produces counts that are far too even, and a chi-squared
 * test cannot tell "structured" from "excellent".
 *
 * What separates them is the structure in consecutive outputs. RANDU satisfies
 * x[n+2] = 6·x[n+1] − 9·x[n] exactly, modulo 2^31, for every triple it emits —
 * which is why its triples lie on fifteen planes. The demo checks that identity
 * rather than quoting it, and finds a residual of exactly zero over thousands
 * of triples for RANDU and a large one for every other generator.
 *
 * The two consumer-side failures get the same treatment: `moduloBias` states
 * what the bias must be with no sampling involved, and then the sampled
 * chi-squared shows it arriving.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'random-generation';
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
      title: 'Diagram — rejection sampling, and why the modulo shortcut cannot be fixed',
      caption: 'A generator produces values in [0, range). If n does not divide range, then ' +
        '`range mod n` of the outputs get one extra source value each and are more likely than ' +
        'the rest — there is no arithmetic that redistributes them, because the counts genuinely ' +
        'are unequal. Rejection throws away the ragged top of the range so that what remains ' +
        'divides evenly; the cost is an occasional second draw and the benefit is exact ' +
        'uniformity rather than nearly.',
      definition: [
        'flowchart TD',
        '    A["draw v in [0, range)"] --> B{"v < range − (range mod n)?"}',
        '    B -- yes --> C["return v mod n<br/>every output equally likely"]',
        '    B -- no --> D["discard and draw again"]',
        '    D --> A',
        '    E["the shortcut: return v mod n"] --> F["range mod n outputs get<br/>one extra source value each"]',
        '    F --> G["biased, and worst when n<br/>is a large fraction of range"]'
      ].join('\n')
    };
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        '**A PRNG is a deterministic function iterated on a state**, so "random" can only ever ' +
          'mean "passes the tests somebody cares about". The useful question is never whether a ' +
          'generator is random — it is not — but what structure it leaves behind and whether that ' +
          'structure matters for the use. Reproducibility is the other half of the deal, and it ' +
          'is a feature: a seeded generator is what makes "change one line and run it again" a ' +
          'controlled experiment.',
        '**The test everybody runs separates nothing.** Every generator here passes a ' +
          'one-dimensional histogram, RANDU included. What gives RANDU away is the *pairs* and ' +
          '*triples*: its outputs satisfy x[n+2] = 6·x[n+1] − 9·x[n] exactly, so every triple it ' +
          'has ever produced lies on one of fifteen planes. The demo checks that identity rather ' +
          'than describing it, and the residual is exactly zero.',
        '**For a power-of-two modulus, the low bits are worse than the high ones — provably.** ' +
          'Bit k of such an LCG has a period of 2^(k+1), so the lowest bit alternates and the low ' +
          'four repeat every sixteen draws. `rand() % 8` on a generator like that is not slightly ' +
          'biased, it is a counter. This is why PCG permutes its output rather than handing the ' +
          'state out, and it is measurable here as a bit period rather than as advice.',
        '**Two consumer-side mistakes ruin a correct generator.** `value % n` is biased whenever ' +
          'n does not divide the range, and the bias is largest exactly when n is a large ' +
          'fraction of it. And a shuffle that draws its swap partner from the whole array rather ' +
          'than from the unvisited suffix has nⁿ equally likely execution paths for n! outcomes — ' +
          'and n! does not divide nⁿ, so the distribution *cannot* be uniform, whatever generator ' +
          'feeds it.'
      ],
      demo: {
        title: 'Interactive demo — scatter, bit heat, uniformity, bias and shuffles',
        markup: root.RandomGenerationTemplate.render()
      },
      diagram: diagram(),
      insight: 'Default to PCG or splitmix for simulation work and to the platform CSPRNG for ' +
        'anything a person could gain by predicting — session tokens, password salts, shuffles in ' +
        'a game people bet on. The distinction is not quality, it is whether an observer who has ' +
        'seen some output can compute the rest, and for every generator in this section they can: ' +
        'xorshift and MT19937 are linear over GF(2) and their state is recoverable from a few ' +
        'hundred outputs. `Math.random()` is in that category too and its specification says so. ' +
        'The other habit worth forming is to seed explicitly and log the seed, because a bug that ' +
        'only appears for one seed in ten thousand is unreproducible otherwise, and "it passed ' +
        'the tests" then means nothing at all.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.RandomGenerationTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  const tableFor = root.Helpers.memoise(function (key) {
    return root.EntropyLab.generatorTable({ samples: Number(key), seed: 12345 });
  });

  const scatterFor = root.Helpers.memoise(function (key) {
    return root.EntropyLab.scatter(key, { count: 2000, seed: 1 });
  });

  const heatFor = root.Helpers.memoise(function (key) {
    return root.EntropyLab.bitHeat(key, { samples: 20000, seed: 1 });
  });

  const biasFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.EntropyLab.biasTable({ bits: Number(parts[0]), n: Number(parts[1]),
      samples: 400000, generator: 'pcg32', seed: 99 });
  });

  const shuffleFor = root.Helpers.memoise(function () {
    return root.EntropyLab.shuffleTable({ size: 3, trials: 120000, seed: 5 });
  });

  function rowFor(id, samples) {
    const rows = tableFor(samples);
    for (let i = 0; i < rows.length; i += 1) {
      if (rows[i].id === id) return rows[i];
    }
    return rows[0];
  }

  function update(app) {
    const values = panel.values();
    const id = values['rg-generator'];
    const samples = String(values['rg-samples']);

    paintScatter(app, scatterFor(id), id);
    paintMetrics(rowFor(id, samples), biasFor(values['rg-width'] + '|' + values['rg-bound']));
    paintHeat(heatFor(id), id);
    paintTable(tableFor(samples), id);
    paintBias(biasFor(values['rg-width'] + '|' + values['rg-bound']));
    paintShuffle(shuffleFor(''));
  }

  function paintScatter(app, scatter, id) {
    const host = root.jQuery('#rg-scatter')[0];
    if (!host) return;
    if (chart) chart.destroy();

    chart = root.ErrorBandView.scatter(host, {
      lazyLib: app.lazyLib,
      height: 260,
      points: scatter.points.map(function (point) {
        return { n: point.x, estimate: point.y, truth: point.y };
      }),
      xLabel: 'output n',
      yLabel: 'output n + 1'
    });

    root.Helpers.setText('rg-scatter-note',
      'Two thousand consecutive pairs. ' +
      (scatter.identity.holds
        ? 'This generator satisfies x[n+2] = 6·x[n+1] − 9·x[n] exactly — the residual is ' +
          scatter.identity.worstResidual + ' over ' + root.Format.exact(scatter.identity.samples) +
          ' triples — which is why its triples lie on fifteen planes in three dimensions. A ' +
          'two-dimensional plot understates how bad this is; the structure is in the triples.'
        : 'The residual for the RANDU identity here is ' +
          root.Format.exact(scatter.identity.worstResidual) + ', so this generator does not ' +
          'satisfy it. Every LCG has *some* lattice; a good multiplier makes it fine enough that ' +
          'no plot at this sample size can find it, which is precisely why the numeric checks ' +
          'below matter more than the picture.'));
  }

  function paintMetrics(row, bias) {
    root.MetricGrid.update({
      'rg-high': { value: root.Format.fixed(row.highBits.statistic, 1),
        note: 'plausible range ' + root.Format.fixed(row.highBits.lowerCritical, 1) + ' to ' +
          root.Format.fixed(row.highBits.critical, 1) + ' — ' + row.highBits.verdict },
      'rg-low': { value: root.Format.fixed(row.lowBits.statistic, 1),
        note: 'plausible range ' + root.Format.fixed(row.lowBits.lowerCritical, 1) + ' to ' +
          root.Format.fixed(row.lowBits.critical, 1) + ' — ' + row.lowBits.verdict },
      'rg-bit0': { value: row.lowestBitPeriod === null ? 'none found' : String(row.lowestBitPeriod),
        note: row.lowestBitPeriod === null ? 'no period within 256 draws'
          : 'bit 0 repeats every ' + row.lowestBitPeriod + ' draws' },
      'rg-bias': { value: root.Format.fixed(bias.predicted.ratio, 3) + '×',
        note: root.Format.exact(bias.predicted.favoured) + ' of ' + bias.predicted.n +
          ' outcomes are favoured' }
    });
  }

  function paintHeat(heat, id) {
    const host = root.jQuery('#rg-heat')[0];
    if (!host) return;
    root.BitView.renderHeat(host, heat.frequencies, { tolerance: 0.02 });

    const stuck = heat.periods.filter(function (entry) {
      return entry.period !== null && entry.period <= 16;
    });

    root.Helpers.setText('rg-heat-note',
      'One cell per bit position, bit 0 on the left, shaded by how often it came up set over ' +
      '20 000 draws; an outlined cell is more than two points away from one half. The worst ' +
      'deviation here is ' + root.Format.fixed(100 * heat.worstDeviation, 2) + ' points. ' +
      (stuck.length === 0
        ? 'No low bit has a short period, so this generator’s low bits are as usable as its high ' +
          'ones — which is the property PCG’s output permutation exists to provide.'
        : 'Bits ' + stuck.map(function (entry) { return entry.bit; }).join(', ') + ' repeat with ' +
          'periods of ' + stuck.map(function (entry) { return entry.period; }).join(', ') +
          '. That is not a bias a histogram can see — the frequencies are fine — it is a ' +
          '*sequence*, and `' + id + '(...) % 8` on this generator is a counter rather than a ' +
          'sample.'));
  }

  function paintTable(rows, chosen) {
    root.jQuery('#rg-table tbody').html(rows.map(function (row) {
      const mark = row.id === chosen ? ' class="matrix-row-lit"' : '';
      return '<tr' + mark + '><td>' + row.label + '</td><td>' + root.Format.exact(row.stateBits) +
        '</td><td>' + root.Format.fixed(row.highBits.statistic, 1) + ' — ' +
        row.highBits.verdict + '</td><td>' +
        root.Format.fixed(row.lowBits.statistic, 1) + ' — ' +
        row.lowBits.verdict + '</td><td>' +
        (row.lowestBitPeriod === null ? '—' : String(row.lowestBitPeriod)) + '</td><td>' +
        (row.planeIdentity ? 'YES' : 'no') + '</td></tr>';
    }).join(''));

    const uneven = rows.filter(function (row) { return row.lowBits.verdict === 'uneven'; });
    const tooEven = rows.filter(function (row) {
      return row.highBits.tooEven || row.lowBits.tooEven;
    });

    root.Helpers.setText('rg-table-note',
      'Read the verdicts rather than the numbers, because the test has two tails and only one of ' +
      'them is the one people check. "Uneven" means the counts are more ragged than chance ' +
      'allows: ' + (uneven.length === 0 ? 'no generator here'
        : uneven.map(function (row) { return row.id; }).join(', ')) +
      ' on the low bits. "Too even" means they are more regular than chance allows, which is ' +
      'also a failure and is the one a histogram is usually reported as passing: ' +
      (tooEven.length === 0 ? 'nothing here'
        : tooEven.map(function (row) { return row.id; }).join(', ')) +
      ' — a full-period generator sweeps every value exactly once, so its counts come out ' +
      'impossibly regular. The bit-0 column is the third reading: a dash means no period under ' +
      '256 draws was found, and it is the small numbers that are the finding.');
  }

  function paintBias(bias) {
    root.jQuery('#rg-bounded tbody').html(bias.rows.map(function (row) {
      return '<tr><td>' + row.label + '</td><td class="mono">' +
        root.Format.fixed(row.statistic, 1) + '</td><td class="mono">' +
        root.Format.fixed(row.critical, 1) + '</td><td>' + (row.passes ? 'passes' : 'FAILS') +
        '</td><td>' + root.Format.fixed(row.drawsPerSample, 4) + '</td><td>' +
        root.Format.fixed(row.spread, 3) + '×</td></tr>';
    }).join(''));

    root.Helpers.setText('rg-bounded-note',
      'Drawing from ' + root.Format.exact(bias.bits) + ' bits into ' + bias.n + ' buckets. ' +
      'The bias is not a sampling artefact and needs no experiment to predict: ' +
      root.Format.exact(bias.predicted.favoured) + ' of the ' + bias.n + ' outputs get ' +
      bias.predicted.high + ' source values each and the rest get ' + bias.predicted.low +
      ', a ratio of ' + root.Format.fixed(bias.predicted.ratio, 3) + '×. The measured spread in ' +
      'the last column arrives at exactly that. At a full 32-bit source the same n gives a ratio ' +
      'of ' + root.Format.fixed(bias.atFullWidth.ratio, 9) + ' — still biased, and now far below ' +
      'the noise, which is why the shortcut survives in so much code. Rejection and Lemire cost ' +
      'about ' + root.Format.fixed(bias.rows[1].drawsPerSample, 2) + ' draws a sample here and ' +
      'are exactly uniform.');
  }

  function paintShuffle(shuffle) {
    const correct = shuffle.correct.rows;
    const naive = shuffle.naive.rows;

    root.jQuery('#rg-shuffle tbody').html(correct.map(function (row, index) {
      return '<tr><td class="mono">' + row.permutation + '</td><td>' +
        root.Format.exact(row.count) + '</td><td>' + root.Format.fixed(row.ratio, 3) +
        '</td><td>' + root.Format.exact(naive[index].count) + '</td><td>' +
        root.Format.fixed(naive[index].ratio, 3) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('rg-shuffle-note',
      'Three elements, ' + root.Format.exact(shuffle.trials) + ' shuffles, ' +
      root.Format.exact(shuffle.outcomes) + ' possible orders, so ' +
      root.Format.exact(shuffle.expected) + ' of each is expected. The naive version has ' +
      root.Format.exact(shuffle.paths) + ' equally likely execution paths and ' +
      root.Format.exact(shuffle.outcomes) + ' outcomes, and ' +
      (shuffle.divides ? 'that divides' : 'nⁿ is not divisible by n!') + ' — so the distribution ' +
      'cannot be uniform no matter which generator drives it. Chi-squared: ' +
      root.Format.fixed(shuffle.correct.statistic, 1) + ' for Fisher–Yates against ' +
      root.Format.fixed(shuffle.naive.statistic, 1) + ' for the naive one, with a threshold of ' +
      root.Format.fixed(shuffle.correct.critical, 1) + '. The two differ by one character in the ' +
      'source: the range the swap partner is drawn from.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

/**
 * Section: bit vectors with rank and select, and Elias-Fano.
 *
 * The honest comparison for a succinct bit vector is not "against nothing" but
 * "against the array of positions you would otherwise have written", and that
 * comparison flips with density — so the density table computes both sides and
 * names the winner rather than leaving the reader to assume the clever
 * structure always wins.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'rank-and-select';
  const DENSITIES = [0.02, 0.1, 0.5, 0.9];
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

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        'rank₁(i) counts the set bits before position i and select₁(k) finds the k-th set bit, and almost every ' +
          'succinct structure is built out of those two. Both are answered from a two-level index — a cumulative ' +
          'count per 2 048-bit superblock and a relative count per 256-bit block — which costs 646 bytes on a ' +
          '65 536-bit vector, 7.9% on top of the 8 192 bytes of data, and answers rank in 3.0 index lookups ' +
          'plus 3.5 word popcounts however long the vector is.',
        'select is the harder of the two because there is no direct arithmetic from k to a position. Binary ' +
          'searching the same index costs 8.0 steps on 65 536 bits and 12.0 on 1 048 576 — logarithmic in the ' +
          'vector rather than constant, which is the honest version of the O(1) that theory promises with a ' +
          'more elaborate index nobody ships.',
        'The comparison that matters is against simply storing the positions. At 50% density the positions ' +
          'array is 130 332 bytes against 8 838 for the vector and its index, 14.7× worse; at 2% density it is ' +
          '4 984 against 8 838 and it *wins*. A bit vector is the right representation for a dense set and the ' +
          'wrong one for a sparse set, and the crossover is arithmetic rather than a matter of taste. For ' +
          'monotone sequences Elias-Fano splits the difference: 9.5686 bits per value against its own ' +
          '9.6496-bit lower bound, 3.34× smaller than 32-bit integers, still randomly accessible.'
      ],
      demo: {
        title: 'Interactive demo — the index, the queries it answers, and where it stops being worth it',
        markup: root.RankAndSelectTemplate.render()
      },
      diagram: {
        title: 'Diagram — the two-level index',
        caption: 'A superblock stores an absolute count in 32 bits; a block stores a count relative to its ' +
          'superblock in 16. rank is the sum of the two plus a popcount of the words inside one block, so the ' +
          'answer is three additions and a handful of instructions.',
        definition: [
          'flowchart LR',
          '    Q["rank₁(i)"] --> S["superblock ⌊i / 2048⌋<br/>absolute count, 32 bits"]',
          '    Q --> B["block ⌊i / 256⌋<br/>count within the superblock, 16 bits"]',
          '    Q --> W["words from the block start to i<br/>popcount each"]',
          '    S --> A["sum"]',
          '    B --> A',
          '    W --> A',
          '    A --> R["rank₁(i)"]'
        ].join('\n')
      },
      insight: 'The word "succinct" has a technical meaning — the information-theoretic minimum plus a lower-order ' +
        'term — and the lower-order term is where the engineering lives. Here it is 7.9%, which buys rank in ' +
        'constant time and select in a binary search, and the design question is always what that percentage ' +
        'is being spent on. The trap is measuring it against nothing: a structure can be 2% overhead and still ' +
        'be the wrong choice, because the representation it is 2% on top of was itself 16× larger than the ' +
        'alternative you did not consider.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.RankAndSelectTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  const vectorFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|').map(Number);
    return root.SuccinctLab.bitVectorRun({ bits: parts[0], density: parts[1] / 100 });
  });

  const eliasFor = root.Helpers.memoise(function (key) {
    return root.SuccinctLab.eliasFanoRun({ count: 5000, gap: Number(key) });
  });

  function update(app) {
    const values = panel.values();
    const run = vectorFor(values['rk-bits'] + '|' + values['rk-density']);
    const table = DENSITIES.map(function (density) {
      return vectorFor(values['rk-bits'] + '|' + Math.round(density * 100));
    });

    paintMetrics(run);
    paintDensity(table, run);
    paintElias(eliasFor(values['rk-gap']));
    drawBars(app, run);
  }

  function paintMetrics(run) {
    root.MetricGrid.update({
      'rk-overhead': {
        value: root.Format.percent(run.shape.overhead, 1),
        note: root.Format.exact(run.shape.indexBytes) + ' bytes on ' +
          root.Format.exact(run.shape.rawBytes) + ' of data'
      },
      'rk-rank': {
        value: root.Format.fixed(run.rankLookups, 1),
        note: 'plus ' + root.Format.fixed(run.rankWords, 1) + ' word popcounts inside one block'
      },
      'rk-select': {
        value: root.Format.fixed(run.selectSteps, 1),
        note: 'log₂ of ' + root.Format.exact(Math.round(run.bits / 256)) + ' blocks'
      },
      'rk-positions': {
        value: root.Format.fixed(run.positionsRatio, 1) + '×',
        note: run.positionsRatio >= 1
          ? 'the bit vector is smaller at this density'
          : 'the positions array is smaller at this density'
      }
    });
  }

  function paintDensity(rows, current) {
    const html = rows.map(function (row) {
      const stored = row.shape.rawBytes + row.shape.indexBytes;
      const here = Math.abs(row.density - current.density) < 1e-9;
      return '<tr' + (here ? ' style="font-weight:600"' : '') + '>' +
        '<td class="mono">' + root.Format.percent(row.density, 0) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.shape.ones) + '</td>' +
        '<td class="mono">' + root.Format.exact(stored) + '</td>' +
        '<td class="mono">' + root.Format.percent(row.shape.overhead, 1) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.shape.positionArrayBytes) + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.positionsRatio, 1) + '×</td>' +
        '<td>' + (row.positionsRatio >= 1 ? 'bit vector' : 'positions array') + '</td></tr>';
    }).join('');

    root.jQuery('#rk-crossover tbody').html(html);
    root.jQuery('#rk-crossover-note').text('The bit vector costs the same at every density — one bit per ' +
      'position, whether it is set or not — and the positions array costs four bytes per set bit, so the ' +
      'crossover is arithmetic: below about 1 in 32 the array wins. That is the whole selection rule, and it ' +
      'is worth checking before adopting a succinct structure, because a very sparse bit vector is the one ' +
      'case where all the cleverness buys nothing.');
  }

  function paintElias(run) {
    const html = '<tr>' +
      '<td class="mono">' + root.Format.exact(run.shape.count) + '</td>' +
      '<td class="mono">' + root.Format.exact(run.shape.universe) + '</td>' +
      '<td class="mono">' + root.Format.exact(run.shape.lowBits) + '</td>' +
      '<td class="mono">' + root.Format.fixed(run.shape.bitsPerValue, 4) + '</td>' +
      '<td class="mono">' + root.Format.fixed(run.shape.bound, 4) + '</td>' +
      '<td class="mono">' + root.Format.exact(run.shape.rawBits) + '</td>' +
      '<td class="mono">' + root.Format.fixed(run.shape.compression, 2) + '×</td>' +
      '<td class="mono">' + root.Format.exact(run.wrong) + '</td></tr>';

    root.jQuery('#rk-ef tbody').html(html);
    root.jQuery('#rk-ef-note').text('The bits-per-value column sits just under the bound column, which is ' +
      'what the encoding promises: ⌈log₂(u/n)⌉ low bits stored verbatim plus a 2n-bit unary vector for the ' +
      'high parts, with every value still recoverable — the last column checks all ' +
      root.Format.exact(run.shape.count) + ' of them. Widen the gaps and both numbers rise together, because ' +
      'the bound is a function of the universe over the count and nothing else.');
  }

  function drawBars(app, run) {
    bars = root.ErrorBandView.bars(root.jQuery('#rk-bars')[0], {
      lazyLib: app.lazyLib,
      height: 240,
      logY: true,
      xLabel: 'representation',
      yLabel: 'bytes (log scale)',
      values: [
        { label: 'bits', value: run.shape.rawBytes, series: 0 },
        { label: 'rank/select index', value: run.shape.indexBytes, series: 1 },
        { label: 'positions array', value: run.shape.positionArrayBytes, series: 2 }
      ]
    });

    root.jQuery('#rk-bars-note').text('The middle bar is the price of the queries and the third is the ' +
      'alternative representation. At this density the vector plus its index is ' +
      root.Format.exact(run.shape.rawBytes + run.shape.indexBytes) + ' bytes against ' +
      root.Format.exact(run.shape.positionArrayBytes) + ' — drag the density slider down and watch the third ' +
      'bar drop below the first two, which is the only honest way to present this trade.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

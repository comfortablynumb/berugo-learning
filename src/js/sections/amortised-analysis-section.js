/**
 * Section: Amortised analysis.
 *
 * One operation trace, three arguments over it. The potential function is the
 * one that generalises, so it is drawn: if the credit ever goes negative the
 * analysis is wrong, and you can see that happen by mis-setting the charge.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'amortised-analysis';
  const FACTORS = [1.25, 1.5, 1.618, 2, 3, 4];
  let panel = null;
  let chart = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
    app.state.subscribe('theme', function () { if (chart) chart.redraw(); });
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render({
      sectionId: SECTION_ID,
      orientation: [
        'A push into a dynamic array costs 1 almost always and n occasionally. Averaging that over ' +
          'a sequence is amortised analysis, and it is not the same as average-case: there is no ' +
          'probability here, only bookkeeping over a worst-case sequence.',
        'Three ways to do the bookkeeping. Aggregate: total the whole sequence and divide. ' +
          'Accounting: overcharge each cheap operation and bank the credit for the expensive one. ' +
          'Potential: define Φ over the state so that expensive steps are paid for by a drop in Φ.',
        'The credit and the potential are both drawn below. Neither may go negative — that is the ' +
          'entire content of the argument, and it is checkable.'
      ],
      demo: { title: 'Interactive demo — grow an array and watch the credit', markup: root.AmortisedAnalysisTemplate.render() },
      diagram: {
        title: 'Diagram — push, grow, copy',
        caption: 'The copy is paid for by credit banked during the cheap pushes that preceded it.',
        definition: [
          'stateDiagram-v2',
          '    [*] --> HasRoom',
          '    HasRoom --> HasRoom: push (cost 1, bank<br/>+charge−1)',
          '    HasRoom --> Full: size = capacity',
          '    Full --> Copying: push triggers grow',
          '    Copying --> HasRoom: copy size elements<br/>(cost size, spend<br/>bank)',
          '    note right of Copying: Φ = 2·size − capacity drops to pay for the copy'
        ].join('\n')
      },
      insight: 'Growth factor 2 versus 1.5 is a memory-reuse argument, not a speed one: with a ' +
        'factor of 2 the sum of all previously freed blocks is always one short of the block you ' +
        'now need, so the allocator can never reuse them. That is why several standard libraries ' +
        'chose 1.5.'
    }));

    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.AmortisedAnalysisTemplate.controls,
      onChange: function () { update(app); }
    });

    paintFactorTable();
    update(app);
  }

  function update(app) {
    const values = panel.values();
    const array = root.Amortised.createDynamicArray({
      factor: values['amort-factor'],
      charge: values['amort-charge']
    });

    for (let i = 0; i < values['amort-pushes']; i += 1) array.push();

    const summary = array.summary();
    const trace = array.trace();
    const minBank = trace.reduce(function (min, record) { return Math.min(min, record.bank); }, Infinity);
    const growth = root.Amortised.growthCost(values['amort-factor'], values['amort-pushes']);

    root.MetricGrid.update({
      'amort-total': { value: root.Format.exact(summary.totalCost), note: 'writes + copies over ' + summary.operations + ' pushes' },
      'amort-average': { value: summary.amortised.toFixed(2), note: 'cost units per push, aggregate method' },
      'amort-copies': { value: root.Format.exact(summary.totalCopies), note: root.Format.fixed(summary.totalCopies / summary.operations, 2) + ' per push' },
      'amort-potential': {
        value: String(summary.minPotential),
        note: summary.minPotential >= 0 ? 'never negative — the argument holds' : 'NEGATIVE — the potential is wrong'
      },
      'amort-waste': { value: root.Format.exact(summary.wasted), note: root.Format.percent(1 - summary.utilisation, 1) + ' of the allocation' },
      'amort-reuse': {
        value: growth.reuseable ? 'yes' : 'no',
        note: 'freed blocks total ' + root.Format.exact(growth.freedSum) + ' vs next ' + root.Format.exact(growth.finalCapacity)
      }
    });

    if (minBank < 0) {
      root.MetricGrid.update({ 'amort-average': { note: 'bank went to ' + minBank + ': this charge is too small' } });
    }

    draw(app, trace);
  }

  function paintFactorTable() {
    const rows = FACTORS.map(function (factor) {
      const cost = root.Amortised.growthCost(factor, 4000);
      return '<tr>' +
        '<td class="mono">' + factor + '</td>' +
        '<td class="mono">' + root.Format.exact(cost.copies) + '</td>' +
        '<td class="mono">' + cost.copiesPerPush.toFixed(2) + '</td>' +
        '<td class="mono">' + root.Format.exact(cost.finalCapacity) + '</td>' +
        '<td class="mono">' + root.Format.exact(cost.wasted) + '</td>' +
        '<td>' + (cost.reuseable ? 'yes' : 'no') + '</td>' +
        '</tr>';
    }).join('');

    root.jQuery('#amort-factors tbody').html(rows);
  }

  function draw(app, trace) {
    const stride = Math.max(1, Math.floor(trace.length / 400));
    const cost = [];
    const potential = [];
    const bank = [];

    trace.forEach(function (record, index) {
      if (index % stride !== 0 && record.copies === 0) return;
      cost.push({ x: index, y: record.cost });
      potential.push({ x: index, y: record.potentialAfter });
      bank.push({ x: index, y: record.bank });
    });

    chart = root.GrowthPlot.render(root.jQuery('#amort-chart')[0], {
      lazyLib: app.lazyLib,
      height: 260,
      yMin: Math.min(0, Math.min.apply(null, bank.map(function (p) { return p.y; }))),
      series: [
        { label: 'cost of this push', points: cost },
        { label: 'potential Φ', points: potential },
        { label: 'accounting bank', points: bank, dashed: true }
      ],
      xLabel: 'operation',
      yLabel: 'cost units',
      legendHost: root.jQuery('#amort-legend')[0],
      summary: function () {
        return 'Per-operation cost with the potential and the accounting bank over ' + trace.length +
          ' pushes. Spikes are the copies; the credit falls to pay for each one.';
      }
    });
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

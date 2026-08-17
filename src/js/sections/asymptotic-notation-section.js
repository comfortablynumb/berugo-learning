/**
 * Section: Asymptotic notation, precisely.
 *
 * The definition needs a witness pair (c, n₀); this demo makes the learner
 * supply one and then checks it, reporting the first n where it fails. That
 * turns "f is O(g)" from a slogan into something with a counter-example.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'asymptotic-notation';
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
        'O, Ω and Θ are sets of functions, and membership is decided by a witness: f is O(g) when ' +
          'there exist a constant c and a threshold n₀ such that f(n) ≤ c·g(n) for every n ≥ n₀. ' +
          'Nearly every argument about big-O is really an argument about whether such a pair exists.',
        'Pick f, g and a witness below. The panel checks the inequality at every integer in the ' +
          'range and reports the first n where it fails, which is the only useful form of "no".',
        'This is an empirical check over a finite range - it can refute a witness, and it cannot ' +
          'prove one. The distinction is the section.'
      ],
      demo: { title: 'Interactive demo — check a witness', markup: root.AsymptoticNotationTemplate.render() },
      diagram: {
        title: 'Diagram — the growth hierarchy',
        caption: 'Each class is contained in the ones to its right; the containment is strict.',
        definition: [
          'flowchart LR',
          '    A["O(1)"] --> B["O(log n)"] --> C["O(√n)"] --> D["O(n)"]',
          '    D --> E["O(n log n)"] --> F["O(n²)"] --> G["O(n³)"] --> H["O(2ⁿ)"] --> I["O(n!)"]'
        ].join('\n')
      },
      insight: 'Asymptotics describe a limit, and production inputs are rarely in it. The notation ' +
        'is a tool for ruling things out, not for predicting runtime — which is why section 1.6 ' +
        'exists and why every cost claim here is also measured.'
    }));

    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.AsymptoticNotationTemplate.controls(),
      onChange: function () { update(app); }
    });

    update(app);
  }

  function readWitness() {
    const values = panel.values();
    return {
      f: root.Asymptotics.growth(values['asym-f']),
      g: root.Asymptotics.growth(values['asym-g']),
      c: values['asym-c'],
      n0: values['asym-n0'],
      upTo: values['asym-upto']
    };
  }

  function update(app) {
    const witness = readWitness();
    const check = root.Asymptotics.isBigO(witness.f.fn, witness.g.fn,
      { c: witness.c, n0: witness.n0, upTo: witness.upTo });
    const smallest = root.Asymptotics.smallestConstant(witness.f.fn, witness.g.fn, witness.n0, witness.upTo);
    const crossover = root.Asymptotics.crossover(witness.f.fn, witness.g.fn, witness.upTo);

    root.MetricGrid.update({
      'asym-verdict': {
        value: check.holds ? 'holds' : 'fails',
        note: check.holds
          ? 'f(n) ≤ ' + witness.c + '·g(n) for all ' + witness.n0 + ' ≤ n ≤ ' + witness.upTo
          : 'the witness is refuted by one value of n'
      },
      'asym-failure': {
        value: check.firstFailure ? String(check.firstFailure.n) : '—',
        note: check.firstFailure
          ? 'f = ' + fmt(check.firstFailure.f) + ' > c·g = ' + fmt(check.firstFailure.cg)
          : 'no counter-example in this range'
      },
      'asym-smallest': {
        value: smallest === null ? '—' : fmt(smallest),
        note: smallest === null ? 'no constant works here' : 'any c ≥ this passes over the range'
      },
      'asym-crossover': {
        value: crossover === null ? 'none' : String(crossover),
        note: crossover === null ? 'f never overtakes g at c = 1' : 'first n where f(n) > g(n)'
      }
    });

    draw(app, witness);
  }

  function fmt(value) {
    if (!Number.isFinite(value)) return '∞';
    if (Math.abs(value) >= 1e6) return value.toExponential(2);
    return Math.abs(value - Math.round(value)) < 1e-6 ? String(Math.round(value)) : value.toFixed(2);
  }

  function draw(app, witness) {
    const step = Math.max(1, Math.round(witness.upTo / 120));
    const fPoints = root.Asymptotics.series(witness.f.fn, 1, witness.upTo, step);
    const gPoints = root.Asymptotics.series(function (n) { return witness.c * witness.g.fn(n); },
      1, witness.upTo, step);

    chart = root.GrowthPlot.render(root.jQuery('#asym-chart')[0], {
      lazyLib: app.lazyLib,
      height: 260,
      series: [
        { label: 'f(n) = ' + witness.f.label, points: fPoints },
        { label: witness.c + '·g(n) = ' + witness.c + '·' + witness.g.label, points: gPoints, dashed: true }
      ],
      markers: [{ x: witness.n0, label: 'n₀', labelY: 12 }],
      xLabel: 'n',
      yLabel: 'cost',
      legendHost: root.jQuery('#asym-legend')[0],
      summary: function () {
        return 'f(n) = ' + witness.f.label + ' against ' + witness.c + '·' + witness.g.label +
          ' for n up to ' + witness.upTo + ', with the witness threshold n₀ = ' + witness.n0 + ' marked.';
      }
    });
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

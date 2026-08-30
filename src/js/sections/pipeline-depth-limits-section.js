/**
 * Section: Deeper pipelines and their limits.
 *
 * The model is four lines and it is in `machines/pipeline-model.js`:
 *
 *     period(k)  = ceil(logic / k) + overhead
 *     penalty(k) = the stages between fetch and branch resolution
 *     CPI(k)     = 1 + hazard stalls + branch rate x mispredict rate x penalty(k)
 *     time       = instructions x CPI(k) x period(k)
 *
 * Its defaults come from the machine this curriculum built: 175 gate delays of
 * logic and 3 of flip-flop overhead, both measured in M34.4. That ratio is far
 * more generous than any real design's, and the section says so rather than
 * quietly substituting a nicer number - the overhead is a control precisely so
 * a reader can watch the optimum move as it approaches a realistic share.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'pipeline-depth-limits';
  const Model = root.PipelineModel;
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
      title: 'Diagram — the same work, cut more finely',
      caption: 'Cutting the logic in half halves only the logic. The register between the two '
        + 'halves is paid in full by both, so the period falls by less than half — and the '
        + 'branch penalty, measured in stages, has just gone up. Both effects grow with depth, '
        + 'which is why the curve has a bottom rather than falling forever.',
      definition: [
        'flowchart TB',
        '    A["one stage<br/>175 of logic + 3 overhead = 178"] --> B["two stages<br/>88 + 3 = 91 each"]',
        '    B --> C["five stages<br/>35 + 3 = 38 each"]',
        '    C --> D["twenty stages<br/>9 + 3 = 12 each"]',
        '    D --> E["the overhead is now 25% of the period"]',
        '    D --> F["and a mispredict costs 16 instructions<br/>instead of 2"]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**Deeper pipelines shorten the clock, and two things push back.** The '
        + 'pipeline-register overhead is paid once per stage whatever the stage contains, so '
        + 'its share of the period grows; and the branch penalty is measured in stages, so it '
        + 'grows too. Neither divides, and together they turn a monotone gain into a curve '
        + 'with a bottom.',
      '**The overhead share is the honest way to say how deep is too deep.** At three gate '
        + 'delays of overhead against 175 of logic, twenty stages puts the overhead at a '
        + 'quarter of every cycle — a quarter of the machine spent moving values between '
        + 'registers rather than computing anything.',
      '**Our datapath\'s ratio is unusually generous, and the model says so.** 175 gate delays '
        + 'of logic against 3 of overhead is 58 to 1, because the M34 ALU is an unoptimised '
        + 'ripple-carry design. A real stage is closer to ten to one, and the overhead control '
        + 'above exists so the optimum can be watched moving as that ratio becomes realistic.',
      '**The optimum depends on the workload, not on the machine.** A program with predictable '
        + 'branches can afford a deep pipeline because it rarely pays the penalty; one with '
        + 'data-dependent branches wants a shallow one. The same silicon is right for the '
        + 'first and wrong for the second, which is the whole difficulty of designing a '
        + 'general-purpose processor.',
      '**Performance alone recommends a deeper pipeline than anybody built.** That is not a '
        + 'flaw in the model; it is the historical result. What stopped depth was power, and '
        + 'the metric the literature uses — performance cubed per watt — brings the optimum '
        + 'back to single or low double digits.',
      '**Performance per watt on its own is a degenerate metric.** It is maximised by an '
        + 'arbitrarily slow machine, because power falls faster than speed does. Cubing '
        + 'performance is what stops the metric rewarding doing nothing, and it is why the '
        + 'literature reports BIPS-cubed per watt rather than something simpler.',
      '**The curve is steep on the left and flat on the right.** Undershooting the optimum '
        + 'costs far more than overshooting it, which is a useful asymmetry: when the right '
        + 'depth is uncertain, err deep. The same shape appears in almost every tuning '
        + 'parameter with a diminishing-returns curve.',
      '**The industry ran this experiment in public and paid for it.** The Pentium 4 went to '
        + 'twenty and then thirty-one stages chasing frequency; the Pentium M, derived from a '
        + 'much shallower design, beat it on real work at far lower power, and the line that '
        + 'became Core came from the shallow one. Depth settled in the low teens and has '
        + 'stayed there.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: { title: 'Interactive demo — the depth curve, and where its bottom is',
        markup: root.DepthTemplate.render() },
      diagram: diagram(),
      insight: insight()
    };
  }

  function insight() {
    return '**The pipeline-register overhead is the reason no pipeline is infinitely deep, and '
      + 'the same "cost per stage" argument caps how finely any pipeline can be split — '
      + 'including every software one.** Cutting work into more stages divides the work and '
      + 'not the per-stage cost, so past some point you are paying more in boundaries than you '
      + 'are saving in stage length. In silicon that boundary is a flip-flop\'s setup and '
      + 'clock-to-output time; in a software pipeline it is a queue, a serialisation, a '
      + 'context switch or a network hop, and it is usually far more expensive relative to the '
      + 'work than three gate delays are. A team that splits a service into twelve microservices '
      + 'is making exactly this trade, and the arithmetic is exactly this arithmetic: the work '
      + 'divides, the boundaries multiply, and the branch penalty has an analogue too — every '
      + 'stage between a decision and its consequence is work that has to be thrown away when '
      + 'the decision turns out wrong. The reason the processor version of this question got a '
      + 'clean answer and the software version usually does not is that the processor people '
      + 'measured the boundary cost. Almost nobody measures the cost of a service boundary '
      + 'before deciding how many to have.';
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });
    panel = root.ControlPanel.mount({
      controls: root.DepthTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------- plumbing */

  function fill(id, rows) {
    root.jQuery('#' + id + ' tbody').html(rows.map(function (cells) {
      return '<tr>' + cells.map(function (cell) {
        return '<td>' + root.Helpers.escapeHtml(String(cell)) + '</td>';
      }).join('') + '</tr>';
    }).join(''));
  }

  function settingsOf(view) {
    return Object.assign({ overhead: view.overhead }, Model.WORKLOADS[view.workload]);
  }

  function reading() {
    const values = panel.values();
    const view = { overhead: Number(values['pdl-overhead']),
      workload: values['pdl-workload'], depth: Number(values['pdl-depth']) };

    view.curve = Model.curve(settingsOf(view));
    view.point = Model.pointAt(view.depth, settingsOf(view));
    return view;
  }

  /* --------------------------------------------------------------- render */

  function update(app) {
    const view = reading();

    paintMetrics(view);
    paintCurve(view);
    paintWorkloads(view);
    paintTerms(view);
    paintHistory();
    paintChart(app, view);
  }

  function paintMetrics(view) {
    const best = view.curve.best;
    const green = view.curve.green;

    root.MetricGrid.update({
      'pdl-period': { value: view.point.period,
        note: Math.ceil(175 / view.depth) + ' of logic plus ' + view.overhead + ' of overhead' },
      'pdl-cpi': { value: view.point.cpi.toFixed(3),
        note: 'a mispredict costs ' + view.point.penalty + ' instructions here' },
      'pdl-time': { value: Math.round(view.point.time),
        note: 'against ' + Math.round(best.time) + ' at the fastest depth' },
      'pdl-fastest': { value: best.depth + ' stages',
        note: 'period ' + best.period + ', CPI ' + best.cpi.toFixed(2) },
      'pdl-efficient': { value: green.depth + ' stages',
        note: 'performance cubed per watt, which is the metric that matches history' },
      'pdl-overhead-share': { value: (100 * best.overheadShare).toFixed(1) + '%',
        note: 'of every cycle spent moving values between registers' }
    });
  }

  function paintCurve(view) {
    const shown = view.curve.points.filter(function (point) {
      return point.depth <= 8 || point.depth % 4 === 0;
    });

    fill('pdl-curve', shown.map(function (point) {
      return [point.depth + (point.depth === view.depth ? ' <-' : ''), point.period,
        point.penalty, point.cpi.toFixed(3), Math.round(point.time),
        (100 * point.overheadShare).toFixed(1) + '%'];
    }));
    root.Helpers.setText('pdl-curve-caption', curveCaption(view));
  }

  function curveCaption(view) {
    const best = view.curve.best;
    const first = view.curve.points[0];

    return 'The time column falls steeply and then flattens: from ' + Math.round(first.time)
      + ' at one stage to ' + Math.round(best.time) + ' at ' + best.depth + ', which is '
      + view.curve.speedup.toFixed(1) + ' times. Everything after the bottom is a slow climb, '
      + 'so overshooting the optimum costs much less than undershooting it — which is a useful '
      + 'asymmetry whenever the right depth is uncertain.';
  }

  function paintWorkloads(view) {
    fill('pdl-workloads', Object.keys(Model.WORKLOADS).map(function (key) {
      const found = Model.curve(Object.assign({ overhead: view.overhead },
        Model.WORKLOADS[key]));

      return [Model.WORKLOADS[key].name + (key === view.workload ? ' <-' : ''),
        found.best.depth + ' stages', found.best.cpi.toFixed(2),
        found.green.depth + ' stages', Model.WORKLOADS[key].about];
    }));
    root.Helpers.setText('pdl-workloads-caption', 'The optimum is a property of the workload '
      + 'and not of the machine, which is the difficulty at the heart of general-purpose '
      + 'processor design: one pipeline has to be built, and different programs want different '
      + 'ones. Raise the overhead towards a realistic share and the three rows separate '
      + 'further, because the penalty term starts to matter relative to the clock gain.');
  }

  function paintTerms(view) {
    const settings = settingsOf(view);
    const one = Model.pointAt(1, settings);
    const twenty = Model.pointAt(20, settings);

    fill('pdl-terms', [
      ['pipeline-register overhead', view.overhead + ' of ' + one.period + ' (' +
        (100 * one.overheadShare).toFixed(1) + '%)',
        view.overhead + ' of ' + twenty.period + ' (' +
        (100 * twenty.overheadShare).toFixed(1) + '%)',
        'it is paid once per stage whatever the stage contains, so more stages means more of it'],
      ['branch penalty', one.penalty + ' instructions', twenty.penalty + ' instructions',
        'it is the distance from fetch to resolution, measured in stages'],
      ['CPI', one.cpi.toFixed(3), twenty.cpi.toFixed(3),
        'the penalty enters it multiplied by how often a branch is mispredicted'],
      ['clock period', String(one.period), String(twenty.period),
        'this is the term that improves, and it is why anybody pipelines at all']
    ]);
    root.Helpers.setText('pdl-terms-caption', 'Three of the four rows get worse with depth and '
      + 'one gets better, which is the whole model. The first row is the one that decides how '
      + 'deep is possible: when the overhead is a quarter of the period, a quarter of the '
      + 'machine is moving values between registers rather than computing with them.');
  }

  function paintHistory() {
    fill('pdl-history', [
      ['Pentium III / Pentium M', '10 to 12 stages',
        'modest clocks, good work per cycle, low power',
        'the design the Core line was built from'],
      ['Pentium 4 (Willamette)', '20 stages',
        'high clocks, high power, and disappointing work per cycle',
        'that frequency alone does not make a fast machine'],
      ['Pentium 4 (Prescott)', '31 stages',
        'higher clocks still, and a thermal ceiling it never got past',
        'the end of the frequency race, publicly'],
      ['everything since', 'roughly 14 to 20 stages',
        'depth settled and width grew instead',
        'that the remaining gains were in issuing more per cycle, which is M36']
    ]);
    root.Helpers.setText('pdl-history-caption', 'This is the model\'s conclusion, run as a '
      + 'live experiment by an industry with billions of dollars at stake. The Pentium 4 '
      + 'chased the term the model says improves and paid the two terms it says get worse; the '
      + 'shallower design beat it on real work, and the line that survived came from the '
      + 'shallow one. Depth settled where the arithmetic says it should.');
  }

  function paintChart(app, view) {
    const host = root.jQuery('#pdl-chart')[0];

    if (!host) return;
    if (chart) chart.destroy();
    chart = root.ErrorBandView.bars(host, {
      lazyLib: app.lazyLib, height: 280, logY: true, yLabel: 'gate delays (log)',
      values: view.curve.points.filter(function (point) {
        return point.depth <= 10 || point.depth % 5 === 0;
      }).map(function (point) {
        return { label: String(point.depth), value: Math.round(point.time),
          series: point.depth === view.curve.best.depth ? 1 : 0 };
      })
    });
    root.Helpers.setText('pdl-chart-note', 'Total time against depth, on a log axis because '
      + 'the first few stages change it by an order of magnitude. The highlighted bar is the '
      + 'fastest depth. Notice the shape rather than the values: a cliff on the left and '
      + 'almost a plateau on the right, so the cost of guessing too shallow is far larger than '
      + 'the cost of guessing too deep.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

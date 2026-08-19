/**
 * Section: persistent queues — amortisation, laziness and real time.
 *
 * The demo is an adversary rather than a benchmark. It builds a queue, finds
 * the exact version whose next `tail` triggers a rotation, and then calls
 * `tail` on that one version a thousand times. That is the operation sequence
 * that breaks a classical amortised bound, and the three queues respond to it
 * completely differently — which is the whole content of the section.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'persistent-sequences';
  let panel = null;
  let chart = null;
  let bars = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
    app.state.subscribe('theme', function () {
      if (chart) chart.redraw();
      if (bars) bars.redraw();
    });
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        'A two-list queue is O(1) amortised: pushes go on the rear, pops come off the front, and when the front ' +
          'runs out the rear is reversed into it. The proof is a banker\'s argument — each push saves a credit, ' +
          'the reversal spends them — and it is only valid if every version is used once. Reuse one version a ' +
          'thousand times and the same expensive rotation is performed a thousand times: 510.00 steps per ' +
          'reuse on a 512-element queue, against the 1.00 an honest O(1) would give.',
        'Okasaki\'s repair is to make the rotation a lazy suspension and memoise it. The first version to force ' +
          'it pays; every other version that reaches the same suspension finds the answer already there. The ' +
          'same adversarial loop costs 1.50 steps per reuse — 340× less — and the amortised bound survives ' +
          'persistence, because a memoised suspension can be paid for once rather than once per version.',
        'That still leaves one spike: the version that does force the rotation pays 503 steps in a single ' +
          'operation, which is fine for throughput and fatal for a deadline. The real-time queue removes it by ' +
          'doing a constant slice of the rotation on every operation, so nothing is ever deferred and the worst ' +
          'single operation is 1 step rather than 1 014. It is strictly more code and strictly more allocation ' +
          'for a bound that most systems do not need.'
      ],
      demo: {
        title: 'Interactive demo — one version, reused until the amortised bound breaks',
        markup: root.PersistentSequencesTemplate.render()
      },
      diagram: {
        title: 'Diagram — where the rotation goes',
        caption: 'All three queues hold a front list and a reversed rear list, and all three rotate when the ' +
          'rear grows past the front. They differ only in when that rotation runs: at the call, at the first ' +
          'force, or a slice at a time.',
        definition: [
          'flowchart TD',
          '    S["snoc / tail"] --> C{"|rear| > |front|?"}',
          '    C -- no --> K["done, O(1)"]',
          '    C -- yes --> R{"which queue?"}',
          '    R -- strict --> A["reverse now · O(n) here, and again for every version that repeats it"]',
          '    R -- "banker’s" --> B["suspend it · O(n) at the first force, free for every version after"]',
          '    R -- real-time --> D["one step of it per operation · never more than O(1) anywhere"]'
        ].join('\n')
      },
      insight: 'Amortised analysis assumes a single line of history. Persistence makes history a tree, and every ' +
        'branch may re-enter the same expensive operation, so the credits saved by one branch are spent by all ' +
        'of them. The fix is not a better bound but a different execution model: a memoised suspension turns ' +
        '"this will be paid for later" into "this will be paid for once", which is exactly the property the ' +
        'banker\'s argument needed and strictness never had. Debug this by reusing an old version in a loop — ' +
        'if the cost per call scales with the structure, the bound was never persistent.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.PersistentSequencesTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  const reuseFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|').map(Number);
    return root.VersionLab.queueReuse({ size: parts[0], reuses: parts[1] });
  });

  const timelineFor = root.Helpers.memoise(function (key) {
    return root.VersionLab.queueTimeline({ size: Number(key) });
  });

  function update(app) {
    const values = panel.values();
    const runs = reuseFor(values['psq-size'] + '|' + values['psq-reuses']);
    const chosen = runs.filter(function (run) { return run.kind === values['psq-kind']; })[0];
    const realtime = runs.filter(function (run) { return run.kind === 'realtime'; })[0];

    paintMetrics(chosen, realtime);
    paintCompare(runs, chosen, realtime);
    drawChart(app, timelineFor(values['psq-size']), values['psq-kind']);
    drawBars(app, runs, chosen);
  }

  function labelFor(kind) {
    return { strict: 'strict', banker: 'banker’s', realtime: 'real-time' }[kind];
  }

  function paintMetrics(run, realtime) {
    root.MetricGrid.update({
      'psq-steps': {
        value: root.Format.fixed(run.stepsPerReuse, 2),
        note: root.Format.exact(run.steps) + ' steps over ' + root.Format.exact(run.reuses) + ' calls'
      },
      'psq-worst': {
        value: root.Format.exact(run.worstOperation),
        note: run.worstOperation > 2 ? 'one call paid for the whole rotation' : 'no call ever paid more than a constant'
      },
      'psq-build': {
        value: root.Format.exact(run.buildWorst),
        note: 'over ' + root.Format.exact(run.size) + ' pushes'
      },
      'psq-ratio': {
        value: root.Format.fixed(run.stepsPerReuse / Math.max(realtime.stepsPerReuse, 1e-9), 2) + '×',
        note: run.kind === 'realtime' ? 'this is the baseline' : 'per reuse, against the real-time queue'
      }
    });
  }

  function paintCompare(runs, chosen, realtime) {
    const html = runs.map(function (run) {
      return '<tr' + (run.kind === chosen.kind ? ' style="font-weight:600"' : '') + '>' +
        '<td>' + labelFor(run.kind) + '</td>' +
        '<td class="mono">' + root.Format.fixed(run.stepsPerReuse, 2) + '</td>' +
        '<td class="mono">' + root.Format.exact(run.worstOperation) + '</td>' +
        '<td class="mono">' + root.Format.exact(run.buildWorst) + '</td>' +
        '<td class="mono">' + root.Format.exact(run.suspensionsForced) + '</td>' +
        '<td class="mono">' + root.Format.fixed(run.stepsPerReuse / Math.max(realtime.stepsPerReuse, 1e-9), 2) +
        '×</td></tr>';
    }).join('');

    root.jQuery('#psq-compare tbody').html(html);
    root.jQuery('#psq-compare-note').text('The suspensions column explains the steps column: the banker\'s ' +
      'queue forces a handful of suspensions across the whole loop and finds the memoised answer every other ' +
      'time, while the strict queue has nothing to memoise and redoes the reversal on every call. Raise the ' +
      'queue length and the strict row grows with it; the other two do not move, which is the difference ' +
      'between an amortised bound that survives persistence and one that does not.');
  }

  function drawChart(app, timeline, kind) {
    const stride = Math.max(1, Math.round(timeline[0].series.length / 240));
    chart = root.ErrorBandView.curve(root.jQuery('#psq-chart')[0], {
      lazyLib: app.lazyLib,
      height: 260,
      logY: true,
      legendHost: root.jQuery('#psq-chart-legend')[0],
      xLabel: 'operation',
      yLabel: 'steps (log scale)',
      series: timeline.map(function (run) {
        return {
          label: labelFor(run.kind) + ' — worst ' + run.worst + ', mean ' + root.Format.fixed(run.mean, 2),
          dashed: run.kind !== kind,
          width: run.kind === kind ? 3 : 1.5,
          points: run.series.filter(function (point, index) { return index % stride === 0; })
            .map(function (point) { return { x: point.n, y: Math.max(point.cost, 0.5) }; })
        };
      })
    });

    root.jQuery('#psq-chart-note').text('This is an ordinary single-threaded run — push everything, then pop ' +
      'everything — with no reuse at all, and the means agree to two decimals. The spikes are the whole ' +
      'difference: the strict and lazy queues both pay for a rotation in one operation and the real-time queue ' +
      'never does. A mean is the right figure for a batch job and the wrong one for anything with a deadline, ' +
      'which is the only reason the third queue exists.');
  }

  function drawBars(app, runs, chosen) {
    bars = root.ErrorBandView.bars(root.jQuery('#psq-bars')[0], {
      lazyLib: app.lazyLib,
      height: 220,
      logY: true,
      xLabel: 'queue',
      yLabel: 'total steps (log scale)',
      values: runs.map(function (run, index) {
        return { label: labelFor(run.kind), value: Math.max(run.steps, 1), series: index };
      })
    });

    root.jQuery('#psq-bars-note').text('The same ' + root.Format.exact(chosen.reuses) + ' calls on the same ' +
      'version, on a log axis because the gap is three orders of magnitude. Nothing about the queue changed ' +
      'between the bars — same contents, same operation, same answer — only when the rotation is allowed to ' +
      'run. That is what makes this a property of the execution model rather than of the data structure.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

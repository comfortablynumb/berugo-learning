/**
 * Section: Recurrences.
 *
 * The tree is the method. The master theorem is a lookup table over one shape,
 * so the demo shows the per-level work first and names the case second - and
 * declines to answer in the gaps rather than inventing a solution.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'recurrences';
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
        '**A recursion tree answers the question the master theorem only classifies: where does ' +
          'the work actually live?** Each level costs a·(work per subproblem). The totals down ' +
          'the tree therefore form a geometric series, and it either grows, stays flat, or ' +
          'shrinks.',
        'Those three behaviours are the three master cases. Read them off the level table below ' +
          'rather than memorising the inequalities. If the bottom row dominates you are in case 1. ' +
          'If the rows are equal you are in case 2. If the top dominates you are in case 3.',
        'Case 3 also carries a regularity condition, and there are recurrences the theorem cannot ' +
          'answer at all. The panel says so instead of guessing.'
      ],
      demo: { title: 'Interactive demo — build the tree', markup: root.RecurrencesTemplate.render() },
      diagram: {
        title: 'Diagram — one level of T(n) = a·T(n/b) + f(n)',
        caption: 'Multiply across a level, sum down the tree; the shape of that sum is the answer.',
        definition: [
          'flowchart TD',
          '    R["T(n) — work f(n)"] --> A1["T(n/b)"]',
          '    R --> A2["T(n/b)"]',
          '    R --> A3["… a of them"]',
          '    A1 --> B1["T(n/b²)"]',
          '    A1 --> B2["T(n/b²)"]',
          '    A2 --> B3["T(n/b²)"]',
          '    A3 --> B4["…"]',
          '    B1 --> L["depth log_b n, a^(log_b n) = n^(log_b a) leaves"]'
        ].join('\n')
      },
      insight: 'The master theorem is a lookup table for one shape. Recursion trees are the method: ' +
        'draw one and you never need to remember which case is which — and you can still answer for ' +
        'the recurrences the theorem refuses.'
    }));

    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.RecurrencesTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  function readSpec() {
    const values = panel.values();
    const k = values['rec-k'];
    const p = values['rec-p'];
    return {
      a: values['rec-a'],
      b: values['rec-b'],
      k: k,
      p: p,
      n: values['rec-n'],
      f: function (size) {
        const base = Math.pow(size, k);
        if (!p) return base;
        const logs = Math.max(1, Math.log2(Math.max(2, size)));
        return base * Math.pow(logs, p);
      }
    };
  }

  function update(app) {
    const spec = readSpec();
    const tree = root.Recurrence.tree({ a: spec.a, b: spec.b, f: spec.f, n: spec.n });
    const verdict = root.Recurrence.master({ a: spec.a, b: spec.b, k: spec.k, p: spec.p });
    const regularity = root.Recurrence.regularityHolds({ a: spec.a, b: spec.b, f: spec.f });

    const rootWork = tree.levels[0].work;
    const leafWork = tree.levels[tree.levels.length - 1].work;

    root.MetricGrid.update({
      'rec-case': {
        value: verdict.case === 'gap' ? 'no answer' : 'case ' + verdict.case,
        note: verdict.note
      },
      'rec-solution': {
        value: verdict.solution || '—',
        note: verdict.case === 3
          ? (regularity.holds ? 'regularity holds (worst ratio ' + regularity.worstRatio.toFixed(2) + ')'
            : 'regularity FAILS — the theorem does not apply')
          : 'from the level sums'
      },
      'rec-critical': {
        value: (Math.log(spec.a) / Math.log(spec.b)).toFixed(3),
        note: 'log_' + spec.b + '(' + spec.a + ') — compare against k = ' + spec.k
      },
      'rec-balance': {
        value: root.Format.ratio(leafWork, rootWork),
        note: 'leaf level ÷ root level work'
      }
    });

    paintLevels(tree);
    draw(app, tree, spec);
  }

  function paintLevels(tree) {
    const rows = tree.levels.map(function (level) {
      return '<tr>' +
        '<td class="mono">' + level.depth + '</td>' +
        '<td class="mono">' + root.Format.count(level.count) + '</td>' +
        '<td class="mono">' + (level.size >= 1 ? level.size.toFixed(level.size < 10 ? 2 : 0) : level.size.toExponential(1)) + '</td>' +
        '<td class="mono">' + root.Format.count(level.work) + '</td>' +
        '<td>' + root.Format.percent(level.work / tree.total, 1) + '</td>' +
        '</tr>';
    }).join('');

    root.jQuery('#rec-levels tbody').html(rows);
  }

  function draw(app, tree, spec) {
    const points = tree.levels.map(function (level) { return { x: level.depth, y: Math.max(level.work, 1e-9) }; });

    chart = root.GrowthPlot.render(root.jQuery('#rec-chart')[0], {
      lazyLib: app.lazyLib,
      height: 240,
      logY: true,
      series: [{ label: 'work at this level', points: points, dots: true }],
      xLabel: 'depth (root = 0)',
      yLabel: 'work (log)',
      legendHost: root.jQuery('#rec-legend')[0],
      summary: function () {
        return 'Work per level for T(n) = ' + spec.a + '·T(n/' + spec.b + ') + n^' + spec.k +
          ' at n = ' + spec.n + ', over ' + tree.levels.length + ' levels, log scale.';
      }
    });
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

/**
 * Section: Skip lists.
 *
 * The demo exists to correct the usual reading of p. It is easy to assume that
 * a smaller p means a faster search because there are fewer levels; the
 * measurement shows the total comparison count is nearly flat in p, because
 * fewer levels means more steps along each. What p really trades is memory —
 * the average tower height is exactly 1/(1 − p) — and that is the number the
 * table reports.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'skip-lists';
  const PS = [0.5, 0.368, 0.25];
  let panel = null;
  let chart = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
    app.state.subscribe('theme', function () { if (chart) chart.redraw(); });
  }

  /** The shell config: orientation, demo, diagram and the insight. */
  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        'A skip list is a sorted linked list with express lanes. Each node is promoted to the next ' +
          'level with probability p, so the towers are geometrically distributed: about half the ' +
          'nodes stop at level one when p = 0.5, half of the rest reach level two, and so on. A ' +
          'search walks the top lane until the next node would overshoot, drops a level, and repeats.',
        'The expected number of levels is log_{1/p}(n) and the expected search cost is L/p + 1/(1 − p). ' +
          'Read those two together: a smaller p gives fewer levels and more steps along each, so the ' +
          'total is nearly flat. Measured at 100 000 keys, p = 0.5 costs 30.6 comparisons and ' +
          'p = 0.25 costs 32.1 — within five percent of each other.',
        'What p actually decides is memory. The average tower height is exactly 1/(1 − p): two ' +
          'pointers per node at p = 0.5, and 1.33 at p = 0.25. That is why Redis and LevelDB use ' +
          '0.25 — not because it searches faster, but because it costs a third less memory for ' +
          'the same search cost.'
      ],
      demo: { title: 'Interactive demo — what p really trades', markup: root.SkipListsTemplate.render() },
      diagram: {
        title: 'Diagram — the express lanes',
        caption: 'A search descends the staircase: forward while the next key is smaller, down when it is not.',
        definition: [
          'flowchart LR',
          '    H3["head L3"] --> A3["10"] --> E3["null"]',
          '    H2["head L2"] --> A2["10"] --> C2["30"] --> E2["null"]',
          '    H1["head L1"] --> A1["10"] --> B1["20"] --> C1["30"] --> D1["40"] --> E1["null"]',
          '    A3 -.->|"drop"| A2',
          '    A2 -.->|"drop"| A1',
          '    C2 -.->|"drop"| C1'
        ].join('\n')
      },
      insight: 'The reason LevelDB and Redis use skip lists is not speed; it is that lock-free ' +
        'insertion needs only a single-pointer compare-and-swap per level. A balanced tree has to ' +
        'rotate, which means locking a subtree — and no amount of clever engineering makes a rotation ' +
        'a single atomic write.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.SkipListsTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  function build(p, values) {
    const list = root.SkipList.create({
      p: p,
      seed: values['sk-seed'],
      deterministic: values['sk-deterministic'],
      maxLevel: 24
    });
    for (let key = 0; key < values['sk-count']; key += 1) list.insert(key, key);
    return list;
  }

  function searchCost(list, values) {
    list.resetStats();
    const probes = Math.min(1000, values['sk-count']);
    for (let i = 0; i < probes; i += 1) list.has((i * 97) % values['sk-count']);
    return list.stats().comparisons / probes;
  }

  function update(app) {
    const values = panel.values();
    const p = Number(values['sk-p']);
    const list = build(p, values);
    const cost = searchCost(list, values);

    const towers = list.towers();
    const meanTower = towers.reduce(function (sum, t) { return sum + t.height; }, 0) / Math.max(1, towers.length);

    const tree = root.Avl.create({});
    for (let key = 0; key < values['sk-count']; key += 1) tree.insert(key, key);
    tree.resetStats();
    const probes = Math.min(1000, values['sk-count']);
    for (let i = 0; i < probes; i += 1) tree.has((i * 97) % values['sk-count']);

    root.MetricGrid.update({
      'sk-levels': {
        value: root.Format.exact(list.height()),
        note: 'log_{1/p}(n) is ' + root.Format.fixed(list.expectedLevels(), 1)
      },
      'sk-comparisons': {
        value: root.Format.fixed(cost, 2),
        note: 'Pugh’s bound L/p + 1/(1 − p) is ' + root.Format.fixed(list.expectedComparisons(), 1)
      },
      'sk-tower': {
        value: root.Format.fixed(meanTower, 3),
        note: '1/(1 − p) = ' + root.Format.fixed(list.expectedTowerHeight(), 3) +
          (values['sk-deterministic'] ? ' — deterministic levels remove the variance' : '')
      },
      'sk-tree': {
        value: root.Format.fixed(tree.stats().comparisons / probes, 2),
        note: 'AVL over the same keys, height ' + tree.height()
      }
    });

    paintPath(list, values);
    paintTable(values);
    draw(app, list, values);
  }

  /** The literal staircase a search walks, for a small key. */
  function paintPath(list, values) {
    const target = Math.floor(values['sk-count'] * 0.75);
    const path = list.searchPath(target);
    const lines = [];
    let current = null;

    path.forEach(function (step) {
      if (!current || current.level !== step.level) {
        current = { level: step.level, keys: [] };
        lines.push(current);
      }
      if (!step.drop) current.keys.push(step.key);
    });

    const text = lines.map(function (line) {
      return 'level ' + String(line.level).padStart(2) + ': ' +
        (line.keys.length ? line.keys.join(' → ') : '(no forward step — drop straight down)');
    }).join('\n');

    root.jQuery('#sk-path').text(text || '(empty list)');
    root.jQuery('#sk-path-note').text('The search for ' + root.Format.exact(target) + ' takes ' +
      path.filter(function (step) { return !step.drop; }).length + ' forward steps and ' +
      list.height() + ' level drops. The top lanes cover the distance; the bottom lane finishes the job.');
  }

  function paintTable(values) {
    const rows = PS.map(function (p) {
      const list = build(p, values);
      const cost = searchCost(list, values);
      const towers = list.towers();
      const pointers = towers.reduce(function (sum, t) { return sum + t.height; }, 0);
      const current = Math.abs(p - Number(values['sk-p'])) < 1e-9;

      return '<tr' + (current ? ' style="font-weight:600"' : '') + '>' +
        '<td class="mono">' + p + '</td>' +
        '<td class="mono">' + list.height() + '</td>' +
        '<td class="mono">' + root.Format.fixed(cost, 2) + '</td>' +
        '<td class="mono">' + root.Format.fixed(pointers / Math.max(1, towers.length), 3) + '</td>' +
        '<td class="mono">' + root.Format.exact(pointers) + '</td></tr>';
    }).join('');

    root.jQuery('#sk-p-table tbody').html(rows);
    root.jQuery('#sk-p-note').text('The comparison column barely moves and the pointer column moves a ' +
      'third. That is the trade p is really making — and it is why the usual choice is 0.25 rather ' +
      'than the search-optimal 1/e.');
  }

  /** The tower histogram against the geometric prediction n·p^(k−1)(1−p). */
  function draw(app, list, values) {
    const histogram = list.levelHistogram();
    const measured = histogram.map(function (count, level) { return { x: level + 1, y: Math.max(0.5, count) }; });
    const predicted = histogram.map(function (_, level) {
      const p = Number(values['sk-p']);
      return { x: level + 1, y: Math.max(0.5, values['sk-count'] * Math.pow(p, level) * (1 - p)) };
    });

    chart = root.GrowthPlot.render(root.jQuery('#sk-chart')[0], {
      lazyLib: app.lazyLib,
      height: 230,
      logY: true,
      series: [
        { label: 'towers of this height', points: measured, dots: true },
        { label: 'n · p^(k−1) · (1 − p)', points: predicted, dashed: true }
      ],
      xLabel: 'tower height',
      yLabel: 'towers (log)',
      legendHost: root.jQuery('#sk-legend')[0],
      summary: function () {
        return 'Tower heights measured against the geometric distribution, at p = ' + values['sk-p'] +
          ' over ' + values['sk-count'] + ' keys.';
      }
    });
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

/**
 * Section: exhaustive search and the art of pruning.
 *
 * Every configuration here is the *same* solver with a flag moved, which is
 * what makes the node counts comparable. The control is the leaf-only
 * configuration: it still assigns one queen per row and one column per queen,
 * and it only tests the diagonals once the board is full. Moving that one
 * check from the leaf to the placement is a 53× reduction at n = 8 and a 278×
 * reduction at n = 10, with the solution count unchanged - which is the check
 * that the pruning is a pruning and not a bug.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'exhaustive-search';
  const BUDGET = 20000000;
  let panel = null;
  let treeView = null;
  let levelsView = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
    app.state.subscribe('theme', function () {
      if (treeView) treeView.redraw();
      if (levelsView) levelsView.redraw();
    });
  }

  function diagram() {
    return {
      title: 'Diagram — a subtree cut by a pruning predicate',
      caption: 'The predicate is evaluated at the node, not at the leaves below it. Everything under a ' +
        'rejected node is never built, which is why moving a check one level earlier removes a whole ' +
        'subtree rather than a single test.',
      definition: [
        'flowchart TD',
        '    R["row 0: empty board"] --> A["row 1: queen at column 0"]',
        '    R --> B["row 1: queen at column 1"]',
        '    A --> A1["row 2: column 1 — attacked, rejected"]',
        '    A --> A2["row 2: column 2"]',
        '    A1 -.-> X["the 6^6 boards below this node are never built"]',
        '    A2 --> A3["row 3: …"]',
        '    B --> B1["row 2: …"]'
      ].join('\n')
    };
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        '**Exhaustive search is not a fallback, it is a shape:** a state space with a root, ' +
          'successors and a test for a goal. Almost every hard combinatorial problem can be ' +
          'written that way in a few minutes, and the resulting program is correct and useless.',
        'What makes it usable is not a faster inner loop. It is refusing to build parts of the ' +
          'tree, and every refusal has to be justified by an argument that no solution lives ' +
          'there.',
        'The demo is n-queens with the arguments switchable one at a time. The control checks the ' +
          'diagonals only when the board is full, and visits 109 601 nodes at n = 8. Moving that ' +
          'identical check to the moment a queen is placed visits 2 057 — a factor of 53 — and ' +
          'finds the same 92 solutions.',
        'Restricting the first row to the left half and mirroring the results halves it again, ' +
          'exactly, because the boards not visited are precisely the mirrors of the ones that ' +
          'were.',
        'The last control behaves differently from the others. Ordering the columns ' +
          'most-constrained-first changes nothing when every solution is wanted, because the same ' +
          'tree is walked in a different order. It changes a great deal when the first solution ' +
          'is enough: 114 nodes become 9.',
        'An ordering heuristic is not a pruning, and a section that reports one number for both ' +
          'goals hides the distinction.'
      ],
      demo: {
        title: 'Interactive demo — prunings, one at a time, on the same board',
        markup: root.ExhaustiveSearchTemplate.render()
      },
      diagram: diagram(),
      insight: 'Prunings multiply, they do not add. At n = 8 the early diagonal check leaves ' +
        '1.88% of the control\'s nodes and symmetry breaking leaves 50.00%. Together they leave ' +
        '0.94%, which is the product to four decimal places. That is why a second constraint ' +
        'that only cuts a third of the remaining tree is still worth adding: it cuts a third of ' +
        'whatever the first one left. The corollary is the discipline. Add prunings one at a ' +
        'time and measure each. A pruning that is subtly wrong removes solutions, and a ' +
        'solution count that silently drops from 92 to 88 looks exactly like a pruning that ' +
        'worked.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.ExhaustiveSearchTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  function optionsFrom(key) {
    const parts = key.split('|');
    return {
      countOnly: false,
      nodeBudget: BUDGET,
      earlyDiagonal: parts[1] !== 'leaf',
      symmetry: parts[2] === 'on',
      firstOnly: parts[3] === 'first',
      mostConstrained: parts[4] === 'constrained'
    };
  }

  const runFor = root.Helpers.memoise(function (key) {
    const n = Number(key.split('|')[0]);
    return root.Backtracking.nQueens(n, optionsFrom(key));
  });

  const treeFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.SearchTreeLab.explore(root.SearchTreeLab.queensSpec(Number(parts[0]), {
      earlyCheck: parts[1] !== 'leaf',
      symmetry: parts[2] === 'on'
    }), { treeLimit: 500, nodeBudget: 400000 });
  });

  function keyFor(values) {
    return values['xs-size'] + '|' + values['xs-early'] + '|' + values['xs-symmetry'] + '|' +
      values['xs-goal'] + '|' + values['xs-order'];
  }

  function update(app) {
    const values = panel.values();
    const key = keyFor(values);
    const run = runFor(key);
    const control = runFor(values['xs-size'] + '|leaf|off|' + values['xs-goal'] + '|natural');

    paintMetrics(run, control);
    paintConfigs(values);
    paintMultiply(values);
    drawTree(app, treeFor(key), run);
  }

  function paintMetrics(run, control) {
    root.MetricGrid.update({
      'xs-nodes': {
        value: root.Format.exact(run.report.nodes),
        note: run.report.budgetExhausted ? 'budget of ' + root.Format.exact(BUDGET) + ' nodes exhausted'
          : root.Format.exact(run.report.placements) + ' placements survived the checks'
      },
      'xs-rejects': {
        value: root.Format.exact(run.report.rejects),
        note: 'each one is a subtree that was never built'
      },
      'xs-ratio': {
        value: root.Format.fixed(control.report.nodes / Math.max(1, run.report.nodes), 1) + '×',
        note: 'fewer nodes than the leaf-only control on the same board'
      },
      'xs-solutions': {
        value: root.Format.exact(run.report.solutions),
        note: 'the number every configuration must agree on'
      }
    });
  }

  const CONFIGS = [
    { label: 'leaf-only check (the control)', early: false, symmetry: false },
    { label: 'check at placement', early: true, symmetry: false },
    { label: 'leaf-only + symmetry breaking', early: false, symmetry: true },
    { label: 'check at placement + symmetry breaking', early: true, symmetry: true }
  ];

  function configRun(n, entry, goal) {
    return root.Backtracking.nQueens(n, {
      countOnly: true, nodeBudget: BUDGET,
      earlyDiagonal: entry.early, symmetry: entry.symmetry, firstOnly: goal === 'first'
    });
  }

  function paintConfigs(values) {
    const n = Number(values['xs-size']);
    const goal = values['xs-goal'];
    const rows = CONFIGS.map(function (entry) { return { entry: entry, run: configRun(n, entry, goal) }; });
    const control = rows[0].run.report.nodes;

    const html = rows.map(function (row) {
      const report = row.run.report;
      return '<tr><td>' + row.entry.label + '</td>' +
        '<td class="mono">' + root.Format.exact(report.nodes) + (report.budgetExhausted ? '+' : '') + '</td>' +
        '<td class="mono">' + root.Format.exact(report.rejects) + '</td>' +
        '<td class="mono">' + root.Format.exact(report.solutions) + '</td>' +
        '<td class="mono">' + root.Format.fixed(control / Math.max(1, report.nodes), 1) + '×</td></tr>';
    }).join('');

    root.jQuery('#xs-configs tbody').html(html);
    root.jQuery('#xs-configs-note').text('Four runs of one solver. The solution column is the check that ' +
      'matters: a pruning that changes it is not a pruning. At n = ' + n + ' the control builds ' +
      root.Format.exact(control) + ' partial boards and the fully pruned configuration builds ' +
      root.Format.exact(rows[3].run.report.nodes) + '. Switch the goal to "the first solution" and the ' +
      'ordering control starts to matter, because a search that can stop benefits from being told where to ' +
      'look first.');
  }

  function paintMultiply(values) {
    const n = Number(values['xs-size']);
    const control = configRun(n, CONFIGS[0], 'all').report.nodes;
    const early = configRun(n, CONFIGS[1], 'all').report.nodes / control;
    const symmetry = configRun(n, CONFIGS[2], 'all').report.nodes / control;
    const both = configRun(n, CONFIGS[3], 'all').report.nodes / control;

    const rows = [
      { label: 'the control', fraction: 1, predicted: null },
      { label: 'check at placement only', fraction: early, predicted: null },
      { label: 'symmetry breaking only', fraction: symmetry, predicted: null },
      { label: 'both', fraction: both, predicted: early * symmetry }
    ];

    const html = rows.map(function (row) {
      return '<tr><td>' + row.label + '</td>' +
        '<td class="mono">' + root.Format.exact(Math.round(row.fraction * control)) + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.fraction * 100, 2) + '%</td>' +
        '<td class="mono">' + (row.predicted === null ? '—' : root.Format.fixed(row.predicted * 100, 2) + '%') +
        '</td></tr>';
    }).join('');

    root.jQuery('#xs-multiply tbody').html(html);
    root.jQuery('#xs-multiply-note').text('The last row is the claim: ' +
      root.Format.fixed(early * 100, 2) + '% × ' + root.Format.fixed(symmetry * 100, 2) + '% = ' +
      root.Format.fixed(early * symmetry * 100, 2) + '%, measured ' + root.Format.fixed(both * 100, 2) +
      '%. The two prunings are independent here - one is about diagonals and the other about the first row - ' +
      'so the fractions multiply exactly. Dependent prunings do worse than the product, which is a reason to ' +
      'measure rather than to assume, but never worse than either one alone.');
  }

  function drawTree(app, explored, run) {
    treeView = root.SearchTreeView.tree(root.jQuery('#xs-tree')[0], {
      tree: explored.tree,
      height: 260,
      summary: 'The first ' + root.Format.exact(explored.report.treeNodes) + ' nodes of the search' +
        (explored.report.treeTruncated ? ', which is where the drawing stops — the counters do not' : '')
    });

    levelsView = root.SearchTreeView.levels(root.jQuery('#xs-levels')[0], {
      tree: explored.tree,
      height: 200,
      summary: 'Nodes per depth, over the drawn prefix'
    });

    root.jQuery('#xs-tree-note').text('Blue nodes were explored, grey ones were rejected by the pruning ' +
      'predicate at the moment they were reached. The grey ones are drawn where they would have been, because ' +
      'a picture that omits them looks identical for a good pruning and a useless one.');
    root.jQuery('#xs-levels-note').text('A search that explodes does so at one depth. With the check at ' +
      'placement the rows stop growing partway down, because most branches have already died; with the ' +
      'leaf-only control every row is n times the one above it until the board is full. This run reached ' +
      'depth ' + root.Format.exact(explored.report.maxDepth) + ' and visited ' +
      root.Format.exact(run.report.nodes) + ' nodes in total.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

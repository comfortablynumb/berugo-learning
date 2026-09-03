/**
 * Section: branch and bound.
 *
 * One instance, three bounds, and one of them wrong on purpose. The wrong
 * bound is the whole reason the section exists: it prunes more than either
 * correct bound, finishes faster, and returns a value that is not the optimum,
 * with nothing anywhere to say so.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'branch-and-bound';
  let panel = null;
  let treeView = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
    app.state.subscribe('theme', function () {
      if (treeView) treeView.redraw();
    });
  }

  function diagram() {
    return {
      title: 'Diagram — a node cut by its bound',
      caption: 'The bound is evaluated at the node: it is the best value any completion of this partial ' +
        'solution could possibly reach. If that ceiling is no better than the incumbent, nothing below the ' +
        'node can improve on what is already in hand, and the subtree is skipped.',
      definition: [
        'flowchart TD',
        '    R["partial solution, value 40"] --> B["bound: no completion exceeds 55"]',
        '    B --> C{"incumbent is 58"}',
        '    C -->|55 <= 58| P["prune — the whole subtree is skipped"]',
        '    C -->|55 > 58| E["expand — the subtree may hold something better"]',
        '    E --> L["take the item"]',
        '    E --> S["skip the item"]'
      ].join('\n')
    };
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        '**Branch and bound is backtracking for optimisation.** The search keeps the best ' +
          'complete solution found so far — the incumbent — and refuses to descend into any ' +
          'subtree whose best possible value cannot beat it.',
        'The requirement on the bound is one-sided. It may overestimate what a subtree can ' +
          'achieve, and it may never underestimate, because an underestimate discards the optimum ' +
          'and the search has no way to notice.',
        'The bound is the algorithm. On this 22-item knapsack the fractional relaxation explores ' +
          '70 nodes where exhaustive search explores 4 194 304. The lazy "best remaining density" ' +
          'bound is also admissible, and explores 282. Both return the same optimum of 658.',
        'A tighter bound is worth more than any amount of tuning the traversal. The reason is ' +
          'visible in the tree: a cut near the root removes half the remaining search.',
        'The third option is a bound that underestimates by ten per cent. It prunes harder than ' +
          'either correct bound — 40 nodes — and returns 640 where the answer is 658. Nothing ' +
          'raises, no invariant fails, and the result looks exactly like a well-tuned search.',
        'That is the failure mode worth remembering. An optimisation search with a subtly wrong ' +
          'bound is a fast, confident, wrong answer.'
      ],
      demo: {
        title: 'Interactive demo — three bounds, an oracle, and the one that lies',
        markup: root.BranchAndBoundTemplate.render()
      },
      diagram: diagram(),
      insight: 'Before optimising a branch-and-bound search, prove the bound admissible and ' +
        'then measure how tight it is. The gap between the bound at the root and the final ' +
        'answer is the honest measure of how much pruning to expect. In practice the bound comes ' +
        'from a relaxation: drop the integrality constraint, drop a subset of the constraints, ' +
        'or solve a subproblem exactly. Every one of those is a ceiling by construction, which ' +
        'is what makes the relaxation trustworthy rather than merely convenient.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.BranchAndBoundTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  const instanceFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|').map(Number);
    const random = root.Random.seeded(parts[2]);
    const items = [];
    let total = 0;
    for (let i = 0; i < parts[0]; i += 1) {
      const weight = 5 + random.int(45);
      items.push({ id: i, value: 10 + random.int(90), weight: weight });
      total += weight;
    }
    return { items: items, capacity: Math.max(1, Math.round(total * parts[1] / 100)) };
  });

  const runFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const instance = instanceFor(parts.slice(1).join('|'));
    return root.BranchAndBound.knapsack(instance.items, instance.capacity, { bound: parts[0] });
  });

  const exhaustiveFor = root.Helpers.memoise(function (key) {
    const instance = instanceFor(key);
    return root.BranchAndBound.knapsackExhaustive(instance.items, instance.capacity);
  });

  const treeFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const instance = instanceFor(parts.slice(1).join('|'));
    const bound = root.BranchAndBound.bounds[parts[0]];
    return root.SearchTreeLab.explore(
      root.SearchTreeLab.knapsackSpec(instance.items, instance.capacity, bound ? bound.fn : null),
      { treeLimit: 500, nodeBudget: 300000 }
    );
  });

  const tspFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|').map(Number);
    const random = root.Random.seeded(parts[1]);
    const points = [];
    for (let i = 0; i < parts[0]; i += 1) points.push({ x: random.int(100), y: random.int(100) });
    const matrix = root.BranchAndBound.distanceMatrix(points);
    return {
      matrix: matrix,
      bounded: root.BranchAndBound.travellingSalesman(matrix, {}),
      plain: root.BranchAndBound.travellingSalesman(matrix, { useBound: false })
    };
  });

  function instanceKey(values) {
    return values['bnb-items'] + '|' + values['bnb-fill'] + '|' + values['bnb-seed'];
  }

  function update() {
    const values = panel.values();
    const key = instanceKey(values);
    const run = runFor(values['bnb-bound'] + '|' + key);
    const exhaustive = exhaustiveFor(key);

    paintMetrics(run, exhaustive);
    paintBounds(values, exhaustive);
    paintGap(values);
    paintTsp(values);
    drawTree(treeFor(values['bnb-bound'] + '|' + key), run);
  }

  function paintMetrics(run, exhaustive) {
    root.MetricGrid.update({
      'bnb-nodes': {
        value: root.Format.exact(run.report.nodes),
        note: root.Format.exact(run.report.boundCalls) + ' bound evaluations, depth ' +
          root.Format.exact(run.report.maxDepth)
      },
      'bnb-pruned': {
        value: root.Format.exact(run.report.pruned),
        note: root.Format.exact(run.report.incumbentUpdates) + ' incumbent updates along the way'
      },
      'bnb-value': {
        value: root.Format.exact(run.value),
        note: run.value === exhaustive.value ? 'which is the optimum'
          : 'the optimum is ' + root.Format.exact(exhaustive.value) + ' — this bound discarded it'
      },
      'bnb-exhaustive': {
        value: root.Format.exact(exhaustive.report.nodes),
        note: root.Format.fixed(exhaustive.report.nodes / Math.max(1, run.report.nodes), 0) +
          '× the nodes, for the same answer'
      }
    });
  }

  function paintBounds(values, exhaustive) {
    const key = instanceKey(values);
    const html = root.BranchAndBound.boundKinds.map(function (kind) {
      const run = runFor(kind + '|' + key);
      const entry = root.BranchAndBound.bounds[kind];
      return '<tr' + (kind === values['bnb-bound'] ? ' style="font-weight:600"' : '') + '>' +
        '<td>' + entry.label + '</td>' +
        '<td class="mono">' + (entry.admissible ? 'yes' : 'no') + '</td>' +
        '<td class="mono">' + root.Format.exact(run.report.nodes) + '</td>' +
        '<td class="mono">' + root.Format.exact(run.report.pruned) + '</td>' +
        '<td class="mono">' + root.Format.exact(run.value) + '</td>' +
        '<td class="mono">' + (run.value === exhaustive.value ? 'yes' : 'NO') + '</td></tr>';
    }).join('');

    root.jQuery('#bnb-bounds tbody').html(html);
    root.jQuery('#bnb-bounds-note').text('Read the third and last columns together. The inadmissible bound ' +
      'explores the fewest nodes of the three and is the only one that gets the wrong answer, which is why ' +
      '"it got faster" is never evidence that a bound is correct. The optimum here is ' +
      root.Format.exact(exhaustive.value) + ', established by enumerating all ' +
      root.Format.exact(exhaustive.report.nodes) + ' subsets — the oracle this page can afford only because ' +
      'the instance is small.');
  }

  function paintGap(values) {
    const instance = instanceFor(instanceKey(values));
    const sorted = instance.items.slice().sort(function (a, b) {
      return (b.value / b.weight) - (a.value / a.weight);
    });
    const rows = [];
    for (let at = 0; at <= Math.min(6, sorted.length); at += 1) {
      let value = 0;
      let room = instance.capacity;
      for (let i = 0; i < at; i += 1) {
        if (sorted[i].weight > room) continue;
        value += sorted[i].value;
        room -= sorted[i].weight;
      }
      const relaxed = root.BranchAndBound.fractionalBound(sorted, at, value, room);
      const integral = root.BranchAndBound.knapsack(instance.items, instance.capacity, { bound: 'fractional' }).value;
      rows.push({ at: at, relaxed: relaxed, integral: integral });
    }

    const html = rows.map(function (row) {
      return '<tr><td class="mono">' + row.at + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.relaxed, 2) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.integral) + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.relaxed - row.integral, 2) + '</td></tr>';
    }).join('');

    root.jQuery('#bnb-gap tbody').html(html);
    root.jQuery('#bnb-gap-note').text('The first row is the bound at the root: the fractional optimum, which ' +
      'is what the relaxation promises before any decision is taken. The gap in the last column is the ' +
      'integrality gap, and it is what the search has to close — a small gap means the relaxation is nearly ' +
      'the answer and the tree collapses, a large one means the bound is weak on this instance whatever it ' +
      'is on average. Raising the capacity narrows it, which is why nearly-full knapsacks are the easy case.');
  }

  function paintTsp(values) {
    const run = tspFor(values['bnb-cities'] + '|' + values['bnb-seed']);
    const rows = [
      { label: 'with the cheapest-edge bound', result: run.bounded },
      { label: 'no bound — every permutation', result: run.plain }
    ];

    const html = rows.map(function (row) {
      return '<tr><td>' + row.label + '</td>' +
        '<td class="mono">' + root.Format.exact(row.result.report.nodes) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.result.report.leaves) + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.result.length, 3) + '</td>' +
        '<td class="mono">' + (Math.abs(row.result.length - run.bounded.length) < 1e-9 ? 'yes' : 'NO') +
        '</td></tr>';
    }).join('');

    root.jQuery('#bnb-tsp tbody').html(html);
    root.jQuery('#bnb-tsp-note').text('The bound here is deliberately crude — the travel so far plus the ' +
      'cheapest edge leaving each unvisited city — and it still removes ' +
      root.Format.fixed(1 - run.bounded.report.nodes / Math.max(1, run.plain.report.nodes), 3) +
      ' of the search tree at ' + values['bnb-cities'] + ' cities. Both rows return the same tour, which is ' +
      'the check that matters: a bound that changes the answer is not a bound. Add a city and watch the ' +
      'unbounded row multiply by that city count while the bounded row grows far more slowly — the ' +
      'improvement is a constant factor on a factorial, which is why it buys three or four cities and not ' +
      'thirty.');
  }

  function drawTree(explored, run) {
    treeView = root.SearchTreeView.tree(root.jQuery('#bnb-tree')[0], {
      tree: explored.tree,
      height: 260,
      summary: 'The first ' + root.Format.exact(explored.report.treeNodes) + ' nodes' +
        (explored.report.treeTruncated ? ' — the drawing stops there, the counters do not' : '')
    });

    root.jQuery('#bnb-tree-note').text('Orange nodes were cut by the bound; blue ones were expanded. With ' +
      'the fractional relaxation the orange appears near the top of the tree, which is what makes it worth ' +
      'so much — a cut at depth three removes everything below it. Switch to the loose bound and the orange ' +
      'moves downwards: the same pruning, applied too late to be worth much. The full search visited ' +
      root.Format.exact(run.report.nodes) + ' nodes.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

/**
 * Section: tree DP and rerooting.
 *
 * The claim is "one downward pass and one upward pass answers for every root",
 * and the only honest evidence is a comparison against actually running it
 * from every root. So the page carries an n-BFS oracle and reports the number
 * of disagreements as a field, capped at a size where n² is affordable.
 *
 * The star is the shape that matters, and the page pins it. Rerooting is only
 * linear because "every child except this one" is a prefix/suffix pair; the
 * obvious loop that recomputes it per child is O(deg²), which on a star is the
 * whole quadratic cost back again. Both counts are on the page, and on a star
 * they separate by three orders of magnitude while the answers stay identical.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'tree-dp';
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — down-values and up-values',
      caption: 'The downward pass gives each node the answer for its own subtree. The upward pass gives it ' +
        'the answer for everything else - and "everything else" is the parent\'s total minus this child\'s ' +
        'contribution, which is why it can be computed without descending again.',
      definition: [
        'flowchart TD',
        '    R["root"] -->|"down: subtree of A"| A["A"]',
        '    R -->|"down: subtree of B"| B["B"]',
        '    A -->|"up: everything outside A"| R',
        '    A --> C["C"]',
        '    A --> D["D"]',
        '    C -->|"needs A minus C"| A',
        '    D -->|"needs A minus D"| A'
      ].join('\n')
    };
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        'A rooted tree DP evaluates children before parents, which is a post-order traversal, and that is ' +
          'the whole evaluation-order question answered. Maximum-weight independent set, subtree sums and ' +
          'subtree sizes are all one pass. The interesting problems start when the answer is wanted for ' +
          '*every* root rather than one.',
        '**Rerooting is the tree analogue of prefix sums.** Compute once downwards, once upwards, and every ' +
          'root is answered in O(n) total instead of O(n²). For the sum of distances the upward step is a ' +
          'single line: moving the root from a parent to a child brings `size(child)` nodes one step closer ' +
          'and pushes the other `n − size(child)` one step further, so ' +
          '`answer[child] = answer[parent] + n − 2·size(child)`. Everything else is bookkeeping.',
        '**The prefix/suffix trick is not an optimisation, it is the algorithm.** Each node has to hand ' +
          'every child "the combination of all my other children", and computing that per child by looping ' +
          'is O(deg²). On a random tree nobody notices; on a **star** the root has degree n − 1 and the ' +
          'loop is the entire quadratic cost the technique claims to remove. The demo runs both counts on ' +
          'four shapes, and the star row is where they separate.',
        '**Every traversal here is iterative.** A path of 20 000 nodes is a recursion 20 000 deep, and the ' +
          'sizes on this page reach that. This is the same rule the M04 search trees learned: on the ' +
          'inputs a section actually replays, a recursive traversal is a stack overflow rather than a slow ' +
          'answer.'
      ],
      demo: {
        title: 'Interactive demo — rerooting against an n-BFS oracle, on four shapes',
        markup: root.TreeDpTemplate.render()
      },
      diagram: diagram(),
      insight: 'When a per-node answer needs "everything except me", reach for prefix and suffix arrays ' +
        'before writing the loop. It is the same move whether the items are children of a tree node, ' +
        'elements of an array, or shards of a dataset, and the loop version is quadratic in exactly the ' +
        'case that is easiest to forget to test - one item with a very large fan-out. A random test tree ' +
        'has maximum degree around log n and will never show it; a star shows it immediately, which is why ' +
        'the star belongs in the test set rather than in the appendix.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.TreeDpTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  function treeOf(shape, n, seed) {
    return root.DpTree.shapedTree(shape, n, root.Random.seeded(seed));
  }

  const runFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const tree = treeOf(parts[0], Number(parts[1]), Number(parts[2]));
    const rerooted = root.DpTree.sumOfDistances(tree.adjacency, {});
    return { tree: tree, rerooted: rerooted,
      general: root.DpTree.reroot(tree.adjacency, root.DpTree.distanceMonoid(), {}) };
  });

  /* The oracle is n BFS runs, which is the cost rerooting exists to avoid -
     so it runs on a separate, smaller tree whose size the learner controls. */
  const oracleFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const tree = treeOf(parts[0], Number(parts[1]), Number(parts[2]));
    const rerooted = root.DpTree.sumOfDistances(tree.adjacency, {});
    const truth = root.DpTree.sumOfDistancesBruteForce(tree.adjacency);
    let wrong = 0;

    rerooted.answer.forEach(function (value, node) {
      if (value === truth[node]) return;
      wrong += 1;
    });
    return { tree: tree, rerooted: rerooted, truth: truth, wrong: wrong };
  });

  const shapesFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const n = Number(parts[0]);
    return ['random', 'path', 'star', 'caterpillar'].map(function (shape) {
      const tree = treeOf(shape, n, Number(parts[1]));
      const run = root.DpTree.reroot(tree.adjacency, root.DpTree.distanceMonoid(), {});
      const degrees = tree.adjacency.map(function (edges) { return edges.length; });
      return { shape: shape, tree: tree, run: run,
        depth: root.DpTree.rootAt(tree.adjacency, 0, null).depth
          .reduce(function (a, b) { return Math.max(a, b); }, 0),
        maxDegree: degrees.reduce(function (a, b) { return Math.max(a, b); }, 0),
        naive: naiveCombines(degrees) };
    });
  });

  /**
   * What the obvious implementation costs: for each node, recompute "all my
   * children except this one" by looping over the others. Counted rather than
   * run, because running it on a 20 000-node star is the point being avoided.
   */
  function naiveCombines(degrees) {
    return degrees.reduce(function (total, degree) { return total + degree * degree; }, 0);
  }

  const familyFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const tree = treeOf(parts[0], Math.min(Number(parts[1]), 4000), Number(parts[2]));
    const random = root.Random.seeded(Number(parts[2]) + 1);
    const weights = tree.adjacency.map(function () { return 1 + random.int(20); });
    const values = tree.adjacency.map(function () { return 1 + random.int(9); });
    return { tree: tree,
      independent: root.DpTree.independentSet(tree.adjacency, weights, {}),
      aggregates: root.DpTree.subtreeAggregates(tree.adjacency, values, {}),
      diameter: root.DpTree.diameter(tree.adjacency, {}),
      totalValue: values.reduce(function (a, b) { return a + b; }, 0) };
  });

  function keyFor(values) {
    return values['trd-shape'] + '|' + values['trd-nodes'] + '|' + values['trd-seed'];
  }

  function update() {
    const values = panel.values();
    const run = runFor(keyFor(values));
    const oracle = oracleFor(values['trd-shape'] + '|' + values['trd-check'] + '|' + values['trd-seed']);
    const shapes = shapesFor(values['trd-nodes'] + '|' + values['trd-seed']);

    paintMetrics(run, oracle, shapes);
    paintOracle(oracle);
    paintShapes(shapes);
    paintFamily(familyFor(keyFor(values)));
    paintPrefix(run);
  }

  function paintMetrics(run, oracle, shapes) {
    const n = run.tree.n;
    const mine = shapes.filter(function (row) { return row.tree.n === n; });
    const combines = run.general.report.combines;

    root.MetricGrid.update({
      'trd-combines': { value: root.Format.exact(combines),
        note: 'over ' + root.Format.exact(n) + ' nodes, both passes' },
      'trd-per': { value: root.Format.fixed(combines / n, 2),
        note: 'flat in n and in the degree distribution — that is the claim' },
      'trd-naive': { value: root.Format.exact(naiveCombines(
        run.tree.adjacency.map(function (edges) { return edges.length; }))),
      note: 'recomputing "all but one" per child instead' },
      'trd-wrong': { value: root.Format.exact(oracle.wrong),
        note: oracle.wrong === 0
          ? 'a BFS from each of ' + oracle.tree.n + ' nodes agrees exactly'
          : 'THE REROOTING DISAGREES WITH THE ORACLE' }
    });
    return mine;
  }

  function paintOracle(oracle) {
    const step = Math.max(1, Math.floor(oracle.tree.n / 12));
    const rows = [];

    for (let node = 0; node < oracle.tree.n && rows.length < 12; node += step) {
      rows.push({ node: node, mine: oracle.rerooted.answer[node], truth: oracle.truth[node] });
    }
    const html = rows.map(function (row) {
      return '<tr><td class="mono">' + row.node + '</td>' +
        '<td class="mono">' + root.Format.exact(row.mine) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.truth) + '</td>' +
        '<td>' + (row.mine === row.truth ? 'yes' : 'NO') + '</td></tr>';
    }).join('');

    root.jQuery('#trd-oracle tbody').html(html);
    root.jQuery('#trd-oracle-note').text('Showing every ' + step + 'th node of ' + oracle.tree.n +
      '; all ' + oracle.tree.n + ' were compared and ' + oracle.wrong + ' disagree. A rerooting bug is '
      + 'usually right at the root it was computed from and wrong everywhere else, so checking one node '
      + 'proves nothing — which is exactly why the oracle runs a BFS from every node.');
  }

  function paintShapes(shapes) {
    const html = shapes.map(function (row) {
      return '<tr><td>' + row.shape + '</td>' +
        '<td class="mono">' + root.Format.exact(row.depth) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.maxDegree) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.run.report.combines) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.naive) + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.naive / row.run.report.combines, 1) + '×</td></tr>';
    }).join('');

    root.jQuery('#trd-shapes tbody').html(html);
    root.jQuery('#trd-shapes-note').text('The rerooting column is flat across all four shapes — that is '
      + 'the linearity claim, and it is a measurement. The naive column is not, and the ratios are worth '
      + 'reading in both directions: on a path and a caterpillar the loop is actually CHEAPER, because '
      + 'prefix and suffix arrays cost a constant per child that a degree-2 node does not need. On a star '
      + 'the same loop is quadratic in n. Prefix/suffix is insurance — it costs a small factor on the '
      + 'shapes a random test suite generates, and it is the only thing standing between you and O(n²) on '
      + 'the shape it does not.');
  }

  function paintFamily(family) {
    const rows = [
      { problem: 'maximum-weight independent set', state: '(node, taken or not)',
        answer: root.Format.exact(family.independent.value),
        passes: family.independent.report.passes,
        checked: 'no two chosen nodes are adjacent, by construction of the recurrence' },
      { problem: 'subtree sums', state: 'total under each node',
        answer: root.Format.exact(family.aggregates.sum[0]),
        passes: family.aggregates.report.passes,
        checked: family.aggregates.sum[0] === family.totalValue
          ? 'the root\'s subtree sum equals the whole tree\'s total'
          : 'THE ROOT SUM DOES NOT MATCH THE TOTAL' },
      { problem: 'diameter', state: 'not a DP — two BFS runs',
        answer: root.Format.exact(family.diameter.length) + ' edges',
        passes: family.diameter.report.passes,
        checked: 'endpoints ' + family.diameter.endpoints.join(' and ') }
    ];
    const html = rows.map(function (row) {
      return '<tr><td>' + row.problem + '</td><td>' + row.state + '</td>' +
        '<td class="mono">' + row.answer + '</td><td class="mono">' + row.passes + '</td>' +
        '<td>' + row.checked + '</td></tr>';
    }).join('');

    root.jQuery('#trd-family tbody').html(html);
    root.jQuery('#trd-family-note').text('The diameter row is in the table because it is the one that is '
      + 'NOT a DP: "the farthest node from anywhere is an endpoint of some diameter" is a graph-theory '
      + 'argument, and the algorithm is two traversals with no table at all. Recognising which problems '
      + 'need a DP is as useful as writing one.');
  }

  function paintPrefix(run) {
    const adjacency = run.tree.adjacency;
    let busiest = 0;

    adjacency.forEach(function (edges, node) {
      if (edges.length <= adjacency[busiest].length) return;
      busiest = node;
    });
    const degree = adjacency[busiest].length;

    root.MatrixView.render(root.jQuery('#trd-prefix')[0], {
      columns: ['Approach', 'Combines at this node', 'Formula', 'At degree ' + degree],
      rows: [
        { cells: ['prefix/suffix arrays', 3 * degree + 2, '3·deg + 2', 'linear in the degree'] },
        { cells: ['recompute per child', degree * degree, 'deg²',
          degree > 1 ? root.Format.fixed(degree * degree / (3 * degree + 2), 1) + '× more' : 'the same'] }
      ]
    });
    root.jQuery('#trd-prefix-note').text('Node ' + busiest + ' has degree ' + degree + ', the largest in '
      + 'this tree. "Every child but this one" is prefix[k−1] combined with suffix[k+1], so one pass '
      + 'forwards and one backwards answers it for all of them. The alternative re-reads the sibling list '
      + 'once per child, and that is where the quadratic hides.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

/**
 * Section: trees, LCA and path queries.
 *
 * The teaching here is a cost table rather than an algorithm. Binary lifting,
 * the sparse table over an Euler tour and heavy-light decomposition all answer
 * "what is above these two nodes", and which one is cheapest depends entirely
 * on the shape of the tree - which is the part the textbook treatment leaves
 * out. On a 200-node random tree of depth 13 the naive climb costs 1 630 steps
 * over 200 queries and binary lifting costs 1 916 jumps: the clever structure
 * is *slower*, plus 1 800 cells of preprocessing. On a path of 200 the same
 * two are 11 783 and 621.
 *
 * So the section ships every implementation against the naive climb on five
 * shapes, and reports which one is cheapest on the tree currently selected
 * rather than asserting a ranking.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'tree-path-queries';
  const SHAPES = ['random', 'path', 'star', 'caterpillar', 'binary'];
  const SHAPE_SIZE = 1000;
  const SHAPE_QUERIES = 400;
  const AGREEMENT_SIZE = 120;
  const AGREEMENT_QUERIES = 480;
  let panel = null;
  let view = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
    app.state.subscribe('theme', function () { if (view) view(); });
  }

  function diagram() {
    return {
      title: 'Diagram — heavy edges, light edges, and why a path crosses few chains',
      caption: 'Each node continues its chain through its heaviest child; every other child starts a ' +
        'new one. Crossing a light edge at least halves the subtree you are in, so a root-to-leaf walk ' +
        'crosses at most log2 n of them — and a path between two nodes goes up to their common ' +
        'ancestor and down again, which is where the factor of two in the bound comes from.',
      definition: [
        'flowchart TD',
        '    A["a (size 15)"] ===|"heavy"| B["b (size 9)"]',
        '    A ---|"light: halves the subtree"| C["c (size 5)"]',
        '    B ===|"heavy"| D["d (size 6)"]',
        '    B ---|"light"| E["e (size 2)"]',
        '    C ===|"heavy"| F["f (size 4)"]',
        '    D ===|"heavy"| G["g (size 4)"]'
      ].join('\n')
    };
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        'Root the tree and every question about a path becomes a question about the **lowest common ' +
          'ancestor**. The distance between two nodes is `depth(a) + depth(b) − 2·depth(lca)`; the path ' +
          'itself is the walk up from each to that ancestor; a query over the path is two queries over ' +
          'the two halves. The naive answer — lift the deeper node until the depths match, then step ' +
          'both up together — costs the depth of the tree per query and needs no preprocessing at all.',
        '**Binary lifting** stores `up[k][v]`, the 2^k-th ancestor, in n log n cells. Every ancestor ' +
          'distance is a sum of distinct powers of two, so any k-th ancestor is at most log₂n jumps — ' +
          'and *k-th ancestor* is the point, because the sparse-table method below is faster and ' +
          'answers nothing else. The **Euler tour with a sparse table** turns LCA into a range minimum ' +
          'over the tour depths and answers it in constant time, at about 2n log 2n cells.',
        '**Heavy-light decomposition** is the general answer to "range query on a tree path". Each node ' +
          'continues its chain through its largest child, so every light edge at least halves the ' +
          'subtree size and a path decomposes into O(log n) contiguous ranges of one array — which any ' +
          'segment tree can then answer. The bound is 2·log₂n rather than log₂n because a path climbs ' +
          'to the common ancestor and descends again.',
        '**Which one is cheapest depends on the tree, and the answer is often "none of them".** On a ' +
          '200-node random tree of depth 13 the naive climb costs 1 630 steps over 200 queries and ' +
          'binary lifting costs 1 916 jumps plus 1 800 cells of preprocessing — the clever structure is ' +
          'slower and larger. On a path of 200 the same comparison is 11 783 against 621. Shape is ' +
          'the whole story, and it is the variable that never appears in the complexity table.'
      ],
      demo: {
        title: 'Interactive demo — one query opened up, and every structure against the naive climb',
        markup: root.TreePathQueriesTemplate.render()
      },
      diagram: diagram(),
      insight: 'Reach for heavy-light decomposition when the question is a *query over a path*, not ' +
        'merely an ancestor — sum the weights on this route, find the maximum, add five to every edge ' +
        'between here and there. Those turn into O(log n) segment-tree ranges and nothing simpler will ' +
        'do them. But reach for the naive climb first and measure: on the shallow trees that most real ' +
        'hierarchies are — file systems, org charts, category trees, DOM subtrees — the depth is a ' +
        'dozen, and a structure whose preprocessing is n log n cells to save six pointer hops per query ' +
        'is a memory cost dressed up as an optimisation.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.TreePathQueriesTemplate.controls,
      onChange: function () { update(); }
    });

    update();
  }

  /* -------------------------------------------------------------- fixtures */

  function structuresFor(kind, n, seed) {
    const tree = root.TreeQueries.shapedTree(kind, n, root.Random.seeded(seed));
    const adjacency = root.GraphCore.adjacencyList(tree);
    const rooted = root.TreeQueries.rootTree(adjacency, 0, {});
    const euler = root.TreeQueries.eulerTour(adjacency, 0, {});
    return { tree: tree, adjacency: adjacency, rooted: rooted, euler: euler,
      lifting: root.TreeQueries.buildLifting(rooted, {}),
      sparse: root.TreeQueries.buildSparse(euler, {}),
      hld: root.TreeQueries.heavyLight(adjacency, rooted, {}) };
  }

  function queryPairs(n, count, seed) {
    const probe = root.Random.seeded(seed);
    const pairs = [];

    for (let q = 0; q < count; q += 1) pairs.push([probe.int(n), probe.int(n)]);
    return pairs;
  }

  /** Every route, on the same query list, with each one's own counter. */
  function costsOf(parts, pairs) {
    const naive = root.TreeQueries.emptyReport();
    const lift = root.TreeQueries.emptyReport();
    const sparse = root.TreeQueries.emptyReport();
    const chains = root.TreeQueries.emptyReport();
    let wrong = 0;
    let worstSegments = 0;

    pairs.forEach(function (pair) {
      const truth = root.TreeQueries.naiveLca(parts.rooted, pair[0], pair[1], { report: naive });

      if (root.TreeQueries.liftingLca(parts.lifting, pair[0], pair[1], { report: lift }) !== truth) wrong += 1;

      if (root.TreeQueries.sparseLca(parts.sparse, pair[0], pair[1], { report: sparse }) !== truth) wrong += 1;
      const path = root.TreeQueries.chainsOnPath(parts.hld, parts.rooted, pair[0], pair[1],
        { report: chains });

      if (path.lca !== truth) wrong += 1;
      worstSegments = Math.max(worstSegments, path.count);
    });
    return { naive: naive, lift: lift, sparse: sparse, wrong: wrong,
      worstSegments: worstSegments, segmentTotal: chains.querySteps + pairs.length };
  }

  const stateFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const structures = structuresFor(parts[0], Number(parts[1]), Number(parts[3]));
    const pairs = queryPairs(Number(parts[1]), Number(parts[2]), 77);
    return { structures: structures, pairs: pairs, costs: costsOf(structures, pairs) };
  });

  const shapesFor = root.Helpers.memoise(function (key) {
    const seed = Number(key);
    return SHAPES.map(function (kind) {
      const size = kind === 'binary' ? 1023 : SHAPE_SIZE;
      const structures = structuresFor(kind, size, seed);
      const pairs = queryPairs(size, SHAPE_QUERIES, 77);
      let worst = 0;
      let total = 0;

      pairs.forEach(function (pair) {
        const path = root.TreeQueries.chainsOnPath(structures.hld, structures.rooted,
          pair[0], pair[1], {});

        worst = Math.max(worst, path.count);
        total += path.count;
      });
      return { kind: kind, size: size, chains: structures.hld.chains, worst: worst,
        mean: total / pairs.length, depth: structures.rooted.report.maxDepth };
    });
  });

  const agreementFor = root.Helpers.memoise(function (key) {
    const seed = Number(key);
    return SHAPES.map(function (kind) {
      const structures = structuresFor(kind, AGREEMENT_SIZE, seed);
      const pairs = queryPairs(AGREEMENT_SIZE, AGREEMENT_QUERIES, 77);
      const costs = costsOf(structures, pairs);
      let ancestorWrong = 0;
      let segmentsWrong = 0;

      pairs.forEach(function (pair) {
        const k = structures.rooted.depth[pair[0]];

        if (root.TreeQueries.kthAncestor(structures.lifting, pair[0], k, {}) !==
          root.TreeQueries.naiveAncestor(structures.rooted, pair[0], k)) ancestorWrong += 1;
        const path = root.TreeQueries.chainsOnPath(structures.hld, structures.rooted,
          pair[0], pair[1], {});

        if (!root.TreeQueries.verifySegments(structures.hld, structures.rooted,
          pair[0], pair[1], path.segments).valid) segmentsWrong += 1;
      });
      return { kind: kind, queries: pairs.length, wrong: costs.wrong,
        ancestorWrong: ancestorWrong, segmentsWrong: segmentsWrong };
    });
  });

  /* -------------------------------------------------------------- painting */

  function keyFor(values) {
    return values['tpq-shape'] + '|' + values['tpq-nodes'] + '|' + values['tpq-queries'] + '|' +
      values['tpq-seed'];
  }

  /**
   * The traced query must exercise all three phases. Roughly a third of random
   * pairs have one node as the other's ancestor, which finishes inside the
   * levelling loop and shows none of the interesting half - so those are
   * skipped unless the tree offers nothing else.
   */
  function tracedPair(state, index) {
    const rooted = state.structures.rooted;
    const interesting = state.pairs.filter(function (pair) {
      const lca = root.TreeQueries.naiveLca(rooted, pair[0], pair[1], {});

      return lca !== pair[0] && lca !== pair[1];
    });
    const list = interesting.length > 0 ? interesting : state.pairs;
    return list[Math.min(list.length - 1, Math.max(0, index))];
  }

  function update() {
    const values = panel.values();
    const key = keyFor(values);
    const state = stateFor(key);
    const pair = tracedPair(state, Number(values['tpq-pair']) - 1);
    const trace = root.TreeQueries.liftingTrace(state.structures.lifting, pair[0], pair[1]);

    paintMetrics(state);
    paintTree(state, pair, trace);
    paintTrace(state, pair, trace);
    paintCosts(state);
    paintShapes(shapesFor(String(values['tpq-seed'])));
    paintAgreement(agreementFor(String(values['tpq-seed'])));
  }

  function cheapestOf(state) {
    const rows = [
      { name: 'the naive climb', work: state.costs.naive.querySteps },
      { name: 'binary lifting', work: state.costs.lift.jumps },
      { name: 'sparse table', work: state.costs.sparse.querySteps }
    ];
    return rows.reduce(function (best, row) { return row.work < best.work ? row : best; }, rows[0]);
  }

  function paintMetrics(state) {
    const cheapest = cheapestOf(state);
    const depth = state.structures.rooted.report.maxDepth;

    root.MetricGrid.update({
      'tpq-wrong': { value: root.Format.exact(state.costs.wrong),
        note: root.Format.exact(state.pairs.length) + ' queries, three implementations each' },
      'tpq-depth': { value: root.Format.exact(depth),
        note: 'log2 n is ' + root.Format.fixed(Math.log2(state.structures.tree.n), 1) },
      'tpq-segments': { value: root.Format.exact(state.costs.worstSegments),
        note: 'the bound is 2 log2 n = ' +
          root.Format.fixed(2 * Math.log2(state.structures.tree.n), 1) },
      'tpq-cheapest': { value: cheapest.name,
        note: root.Format.exact(cheapest.work) + ' units of work over all queries' }
    });
  }

  function heavyEdges(structures) {
    const heavy = structures.hld.heavy;
    const set = new Set();

    structures.tree.edges.forEach(function (edge, id) {
      if (heavy[edge.from] === edge.to || heavy[edge.to] === edge.from) set.add(id);
    });
    return set;
  }

  function pathNodes(rooted, a, b, lca) {
    const up = [];
    let at = a;

    while (at !== lca) { up.push(at); at = rooted.parent[at]; }
    const down = [];

    at = b;

    while (at !== lca) { down.push(at); at = rooted.parent[at]; }
    return up.concat([lca], down.reverse());
  }

  function paintTree(state, pair, trace) {
    view = function () { drawTree(state, pair, trace); };
    view();
  }

  function drawTree(state, pair, trace) {
    const host = root.jQuery('#tpq-tree')[0];

    if (!host) return;
    const structures = state.structures;
    const positions = root.GraphView.treeLayout(structures.rooted, host.clientWidth || 620, 340);
    const marked = new Set([pair[0], pair[1], trace.lca]);

    root.GraphView.draw({ host: host, graph: structures.tree, positions: positions, height: 340,
      edgeClass: root.GraphView.classBySet(heavyEdges(structures), 'tree'),
      path: pathNodes(structures.rooted, pair[0], pair[1], trace.lca),
      nodeClass: function (v) { return marked.has(v) ? 'frontier' : null; } });
    root.jQuery('#tpq-tree-note').text('Depth runs down the page and discovery order across it, so a ' +
      'path draws as a diagonal and a star as a fan. Highlighted edges are heavy ones — each node’s ' +
      'largest child — and the thick line is the path between nodes ' + pair[0] + ' and ' + pair[1] +
      ', whose lowest common ancestor is node ' + trace.lca + '.');
  }

  function traceReason(step, trace) {
    if (step.phase === 'level') {
      return 'levelling: the depth gap has bit ' + Math.log2(step.jump) + ' set';
    }

    if (step.phase === 'together') {
      return 'both nodes jump ' + step.jump + ' and stay apart, so the ancestor is still above';
    }
    return 'one step from the answer: node ' + trace.lca + ' is the parent';
  }

  function paintTrace(state, pair, trace) {
    const html = trace.steps.map(function (step, index) {
      return '<tr><td class="mono">' + (index + 1) + '</td>' +
        '<td>' + step.phase + '</td>' +
        '<td class="mono">' + root.Format.exact(step.jump) + '</td>' +
        '<td class="mono">' + step.from + '</td>' +
        '<td class="mono">' + step.to + '</td>' +
        '<td>' + traceReason(step, trace) + '</td></tr>';
    }).join('');

    root.jQuery('#tpq-trace tbody').html(html || '<tr><td colspan="6">The two nodes are the same, ' +
      'so no jump is needed.</td></tr>');
    root.jQuery('#tpq-trace-note').text('Nodes ' + pair[0] + ' and ' + pair[1] + ' at depths ' +
      state.structures.rooted.depth[pair[0]] + ' and ' + state.structures.rooted.depth[pair[1]] +
      ', answered in ' + trace.steps.length + ' jumps against a naive climb of ' +
      root.Format.exact(state.structures.rooted.depth[pair[0]] +
        state.structures.rooted.depth[pair[1]]) + ' steps at worst. The descent never lands ON the ' +
      'ancestor by design: jumping only while the two stay apart leaves both one step below it, and ' +
      'the answer is the parent — which is what makes the test a comparison rather than a search.');
  }

  function costRows(state) {
    const costs = state.costs;
    const per = state.pairs.length;
    return [
      { name: 'the naive climb', cells: 0, work: costs.naive.querySteps, extra: 'no — LCA only' },
      { name: 'binary lifting', cells: state.structures.lifting.cells, work: costs.lift.jumps,
        extra: 'yes — k-th ancestor, level ancestor' },
      { name: 'Euler tour + sparse table', cells: state.structures.sparse.cells,
        work: costs.sparse.querySteps, extra: 'no — LCA only' },
      { name: 'heavy-light decomposition', cells: state.structures.tree.n,
        work: costs.segmentTotal, extra: 'yes — any range query on the path' }
    ].map(function (row) { return { row: row, per: row.work / per }; });
  }

  function paintCosts(state) {
    const html = costRows(state).map(function (entry) {
      return '<tr><td>' + entry.row.name + '</td>' +
        '<td class="mono">' + root.Format.exact(entry.row.cells) + '</td>' +
        '<td class="mono">' + root.Format.exact(entry.row.work) + '</td>' +
        '<td class="mono">' + root.Format.fixed(entry.per, 2) + '</td>' +
        '<td>' + entry.row.extra + '</td></tr>';
    }).join('');

    root.jQuery('#tpq-costs tbody').html(html);
    root.jQuery('#tpq-costs-note').text('Query work is each structure’s own unit — pointer steps for ' +
      'the climb, table jumps for lifting, one range-minimum lookup for the sparse table, chain ' +
      'segments for the decomposition — so the columns are not interchangeable, and the last column ' +
      'is why the cheapest is not always the right choice. Switch the shape to a path and every ' +
      'ranking in this table changes.');
  }

  function paintShapes(rows) {
    const html = rows.map(function (row) {
      return '<tr><td>' + row.kind + ' (n = ' + root.Format.exact(row.size) + ')</td>' +
        '<td class="mono">' + root.Format.exact(row.depth) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.chains) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.worst) + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.mean, 2) + '</td>' +
        '<td class="mono">' + root.Format.fixed(2 * Math.log2(row.size), 1) + '</td></tr>';
    }).join('');

    root.jQuery('#tpq-shapes tbody').html(html);
    root.jQuery('#tpq-shapes-note').text('Four hundred random pairs per shape. A path is one chain and ' +
      'every query is a single range, which is the decomposition\'s best case and not a coincidence — ' +
      'there are no light edges to cross. A star is the opposite extreme and still costs at most three ' +
      'segments. Every worst-case column sits under the 2 log2 n bound of about 20, and the ' +
      'closest — the complete binary tree, where light edges are everywhere — is still a quarter ' +
      'below it. Sizing a structure from the measurement rather than from the bound is the whole ' +
      'reason to have both.');
  }

  function agreementRows(rows) {
    return rows.map(function (row) {
      return { cells: [row.kind, root.Format.exact(row.queries),
        root.Format.exact(row.wrong), root.Format.exact(row.ancestorWrong),
        root.Format.exact(row.segmentsWrong)] };
    });
  }

  function paintAgreement(rows) {
    const total = rows.reduce(function (acc, row) {
      return acc + row.queries;
    }, 0);

    root.MatrixView.render(root.jQuery('#tpq-agreement')[0], {
      columns: ['Shape', 'Queries', 'LCA disagreements', 'k-th ancestor wrong',
        'Path segments not covering the path'],
      rows: agreementRows(rows)
    });
    root.jQuery('#tpq-agreement-note').text(root.Format.exact(total) + ' queries across five shapes, ' +
      'every implementation compared against the naive climb — which is slow, obvious, and the only ' +
      'one of them that cannot be subtly wrong. The last column is the check worth copying: it is not ' +
      'enough that the decomposition returns the right NUMBER of segments, so the union of the ranges ' +
      'is compared against the actual set of vertices on the path.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

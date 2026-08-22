/**
 * Section: minimum spanning trees.
 *
 * Three algorithms that must agree, one property that says why they can, and
 * one consequence almost nobody connects to it.
 *
 * The agreement is on *weight*, not on the tree. With duplicate weights the
 * three return three different edge sets of identical cost - measured here at
 * 0 of 20 instances agreeing on the edge set when weights are drawn from 1 to
 * 3, and 20 of 20 when they are effectively distinct. A test that compares
 * trees is testing the tie-break; a test that compares weights is testing the
 * algorithm.
 *
 * The consequence is the minimax path: the maximum edge on the MST path
 * between two nodes is the smallest possible maximum over all paths. That is
 * the actual question in network design - minimise the worst hop - and it is
 * answered for free by a structure most people build for a different reason.
 * On the default instance 136 of 198 shortest paths have a worse worst hop
 * than the minimax path does, so the two questions genuinely differ.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'minimum-spanning-trees';
  const CUT_STEPS = [1, 5, 20, 40];
  const WEIGHT_RANGES = [3, 20, 100000];
  const DENSITY_STEPS = [1, 2, 4, 8, 15];
  const UNIQUENESS_TRIALS = 20;
  const MINIMAX_QUERIES = 200;
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
      title: 'Diagram — the cut property, which is why all three algorithms work',
      caption: 'Split the vertices any way you like. The lightest edge crossing that split is in some ' +
        'minimum spanning tree. Kruskal, Prim and Borůvka differ only in which cut they exploit next: ' +
        'Kruskal takes the globally lightest edge joining two components, Prim always cuts around one ' +
        'growing tree, and Borůvka cuts around every component at once.',
      definition: [
        'flowchart LR',
        '    subgraph S["one side of the cut"]',
        '      A["a"] --- B["b"]',
        '    end',
        '    subgraph T["the other side"]',
        '      C["c"] --- D["d"]',
        '    end',
        '    B ---|"4 — lightest crossing, so it is safe"| C',
        '    A ---|"9 — also crosses, and is not"| D'
      ].join('\n')
    };
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        'A minimum spanning tree connects every vertex at the least total edge weight. Three classic ' +
          'algorithms find one and all three rest on a single fact, the **cut property**: for any split ' +
          'of the vertices into two non-empty sides, the lightest edge crossing that split belongs to ' +
          'some minimum spanning tree. Kruskal sorts every edge and takes each one that joins two ' +
          'components; Prim grows a single tree and always takes the lightest edge leaving it; Borůvka ' +
          'has every component pick its own cheapest outgoing edge simultaneously, which is why it is ' +
          'the one that parallelises.',
        '**They agree on weight, and often not on the tree.** That distinction is the difference ' +
          'between a test that works and a test that fails whenever somebody changes a comparator. With ' +
          'weights drawn from 1 to 3, none of twenty instances produced the same edge set from all ' +
          'three algorithms; with effectively distinct weights, all twenty did. Distinct weights are ' +
          'sufficient for a unique MST, and duplicate weights are the norm in real data, where costs ' +
          'are round numbers.',
        'The **cycle property** is the mirror image and explains the second-best tree: the heaviest ' +
          'edge on any cycle is in no minimum spanning tree. It follows that the second-best spanning ' +
          'tree differs from the best by exactly one edge, which is why finding it is a scan over MST ' +
          'edges and their replacements rather than a second search. When weights repeat, the runner-up ' +
          'can tie the winner — and a tie means the MST was never unique in the first place.',
        '**The minimax path comes free.** The maximum edge on the MST path between two vertices is the ' +
          'smallest maximum any path between them can achieve. That is the real question in network ' +
          'design — minimise the worst hop, not the total — and here 136 of 198 random pairs have a ' +
          'shortest path whose worst hop is worse than the minimax answer. Two different questions, one ' +
          'structure, and the connection is checked below against a brute-force threshold oracle.'
      ],
      demo: {
        title: 'Interactive demo — three algorithms, the cut that justifies each edge, and the ' +
          'minimax path nobody asked for',
        markup: root.MinimumSpanningTreesTemplate.render()
      },
      diagram: diagram(),
      insight: 'The reason to know that the MST answers the minimax question is that the minimax ' +
        'question is the one that gets asked. "Which links do we keep so everything stays connected as ' +
        'cheaply as possible" is the MST. "Route this traffic so the worst-quality hop is as good as ' +
        'possible" sounds like a different problem, gets solved with a bespoke binary search over ' +
        'thresholds, and is the same MST you already have. The same identity shows up as single-linkage ' +
        'clustering, as maximum-capacity routing, and as the widest-path problem — all of them the MST ' +
        'path, all of them usually reimplemented from scratch.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.MinimumSpanningTreesTemplate.controls,
      onChange: function () { update(); }
    });

    update();
  }

  /* -------------------------------------------------------------- fixtures */

  function graphFor(spec) {
    const random = root.Random.seeded(spec.seed);
    const side = Math.max(3, Math.round(Math.sqrt(spec.n)));

    if (spec.shape === 'grid') {
      return root.GraphCore.grid(side, side, { random: random, weightRange: spec.range });
    }

    if (spec.shape === 'road-like') return root.GraphCore.roadLike(side, side, random, {});

    if (spec.shape === 'scale-free') {
      return root.GraphCore.scaleFree(spec.n, 2, random, { weightRange: spec.range });
    }
    return root.GraphCore.randomGraph(spec.n, spec.m, random, { weightRange: spec.range });
  }

  function specFrom(parts) {
    return { shape: parts[0], n: Number(parts[1]), seed: Number(parts[3]),
      range: Number(parts[4]), m: Math.round(Number(parts[1]) * Number(parts[2]) / 10) };
  }

  function edgeIdsOf(run) {
    return run.edges.map(function (edge) { return edge.id; })
      .sort(function (a, b) { return a - b; }).join(',');
  }

  const stateFor = root.Helpers.memoise(function (key) {
    const spec = specFrom(key.split('|'));
    const graph = graphFor(spec);
    const run = root.GraphLab.compareMst(graph);
    const ids = run.rows.map(function (entry) { return edgeIdsOf(entry.run); });
    return { graph: graph, run: run, mstEdges: run.rows[0].run.edges,
      identical: ids[0] === ids[1] && ids[1] === ids[2],
      second: root.Mst.secondBest(graph, run.rows[0].run.edges) };
  });

  /** Prim's edges, in the order it chose them, so the cut in the table below
   *  is one growing region rather than Kruskal's scatter of fragments. */
  const cutFor = root.Helpers.memoise(function (key) {
    const state = stateFor(key);
    const prim = root.Mst.prim(state.graph, state.run.adjacency, {});
    return CUT_STEPS.filter(function (step) { return step < prim.edges.length; })
      .map(function (step) {
        const candidate = prim.edges[step];
        return { step: step, candidate: candidate,
          witness: root.Mst.safeEdgeFor(state.graph, prim.edges.slice(0, step), candidate) };
      });
  });

  const uniquenessFor = root.Helpers.memoise(function (key) {
    const base = specFrom(key.split('|'));
    return WEIGHT_RANGES.map(function (range) {
      let sameWeight = 0;
      let sameTree = 0;
      let duplicates = 0;

      for (let seed = 1; seed <= UNIQUENESS_TRIALS; seed += 1) {
        const graph = graphFor({ shape: base.shape, n: base.n, m: base.m, seed: seed, range: range });
        const run = root.GraphLab.compareMst(graph);
        const ids = run.rows.map(function (entry) { return edgeIdsOf(entry.run); });

        duplicates += run.distinct.duplicates;

        if (run.agree) sameWeight += 1;

        if (ids[0] === ids[1] && ids[1] === ids[2]) sameTree += 1;
      }
      return { range: range, sameWeight: sameWeight, sameTree: sameTree,
        duplicates: duplicates / UNIQUENESS_TRIALS };
    });
  });

  /* --------------------------------------------------------------- minimax */

  function worstHopTo(adjacency, parent, source, target) {
    let worst = 0;
    let at = target;

    while (at !== source && parent[at] !== -1) {
      const from = parent[at];
      const here = at;

      adjacency[from].forEach(function (edge) {
        if (edge.to !== here) return;
        worst = Math.max(worst, edge.weight);
      });
      at = from;
    }
    return worst;
  }

  const minimaxFor = root.Helpers.memoise(function (key) {
    const state = stateFor(key);
    const adjacency = state.run.adjacency;
    const probe = root.Random.seeded(101);
    const rows = [];
    let checked = 0;
    let wrong = 0;
    let shortestWorse = 0;

    for (let q = 0; q < MINIMAX_QUERIES; q += 1) {
      const source = probe.int(state.graph.n);
      const target = probe.int(state.graph.n);

      if (source === target) continue;
      checked += 1;
      const viaTree = root.Mst.bottleneck(state.graph.n, state.mstEdges, source, target);
      const oracle = root.Mst.bottleneckByBruteForce(state.graph, source, target);
      const path = root.ShortestPaths.dijkstra(adjacency, source, { target: target });
      const hop = worstHopTo(adjacency, path.parent, source, target);

      if (viaTree !== oracle) wrong += 1;

      if (hop > viaTree) shortestWorse += 1;

      if (rows.length < 6) {
        rows.push({ source: source, target: target, viaTree: viaTree, oracle: oracle,
          cost: path.distance[target], hop: hop });
      }
    }
    return { rows: rows, checked: checked, wrong: wrong, shortestWorse: shortestWorse };
  });

  const densityFor = root.Helpers.memoise(function (key) {
    const base = specFrom(key.split('|'));
    return DENSITY_STEPS.map(function (factor) {
      const graph = graphFor({ shape: 'random', n: base.n, m: base.n * factor,
        seed: base.seed, range: base.range });
      const run = root.GraphLab.compareMst(graph);
      return { edges: graph.edges.length, rows: run.rows,
        rounds: run.rows[2].run.report.rounds };
    });
  });

  /* -------------------------------------------------------------- painting */

  function keyFor(values) {
    return values['mst-shape'] + '|' + values['mst-nodes'] + '|' + values['mst-density'] + '|' +
      values['mst-seed'] + '|' + values['mst-weights'];
  }

  function update() {
    const key = keyFor(panel.values());
    const state = stateFor(key);

    paintMetrics(state, minimaxFor(key));
    paintMap(state);
    paintAlgorithms(state);
    paintCut(cutFor(key));
    paintUniqueness(uniquenessFor(key));
    paintBottleneck(minimaxFor(key));
    paintRunnerUp(state);
    paintDensity(densityFor(key));
  }

  function cheapestOf(rows) {
    return rows.reduce(function (best, entry) {
      return entry.work < best.work ? entry : best;
    }, rows[0]);
  }

  function paintMetrics(state, minimax) {
    const cheapest = cheapestOf(state.run.rows);

    root.MetricGrid.update({
      'mst-weight': { value: root.Format.exact(state.run.rows[0].run.weight),
        note: state.run.agree ? 'all three agree' : 'THEY DISAGREE — one of them is wrong' },
      'mst-same': { value: state.identical ? 'yes' : 'no',
        note: root.Format.exact(state.run.distinct.duplicates) +
          ' edges share a weight with an earlier one' },
      'mst-work': { value: cheapest.name,
        note: root.Format.exact(cheapest.work) + ' units against ' +
          state.run.rows.map(function (entry) { return root.Format.exact(entry.work); }).join(' / ') },
      'mst-minimax': { value: root.Format.exact(minimax.wrong),
        note: 'over ' + root.Format.exact(minimax.checked) + ' pairs, against a threshold oracle' }
    });
  }

  function paintMap(state) {
    view = function () { drawMap(state); };
    view();
  }

  function drawMap(state) {
    const host = root.jQuery('#mst-map')[0];

    if (!host) return;
    const width = host.clientWidth || 620;
    const positions = state.graph.positionOf
      ? root.GraphView.fixedLayout(state.graph, width, 340)
      : root.GraphView.circularLayout(state.graph.n, width, 340);
    const chosen = new Set(state.mstEdges.map(function (edge) { return edge.id; }));

    root.GraphView.draw({ host: host, graph: state.graph, positions: positions, height: 340,
      edgeClass: root.GraphView.classBySet(chosen, 'tree') });
    root.jQuery('#mst-map-note').text('The highlighted edges are the spanning tree: ' +
      root.Format.exact(state.mstEdges.length) + ' of ' +
      root.Format.exact(state.graph.edges.length) + ' links, weighing ' +
      root.Format.exact(state.run.rows[0].run.weight) + '. Everything faint is a link the tree can ' +
      'do without — and every one of those faint links is the heaviest edge on some cycle, which is ' +
      'the cycle property stated as a picture.');
  }

  function paintAlgorithms(state) {
    const html = state.run.rows.map(function (entry) {
      const check = root.Mst.checkSpanning(state.graph, entry.run.edges);

      return '<tr><td>' + entry.name + '</td>' +
        '<td class="mono">' + root.Format.exact(entry.run.weight) + '</td>' +
        '<td class="mono">' + root.Format.exact(entry.run.edges.length) + '</td>' +
        '<td class="mono">' + root.Format.exact(entry.work) + '</td>' +
        '<td class="mono">' + root.Format.exact(entry.run.report.rounds) + '</td>' +
        '<td>' + (check.acyclic && check.spansComponents ? 'yes' : 'NO') + '</td></tr>';
    }).join('');

    root.jQuery('#mst-algorithms tbody').html(html);
    root.jQuery('#mst-algorithms-note').text('Work is each algorithm’s own dominant cost — Kruskal’s ' +
      'sort plus its union-find operations, Prim’s heap comparisons plus pushes, Borůvka’s edge scans ' +
      'plus finds — so the column compares like with like rather than wall clock. The invariant being ' +
      'tested here is the weight column and the spanning column; the edge counts can match while the ' +
      'trees differ, which is the next table.');
  }

  function paintCut(rows) {
    const html = rows.map(function (row) {
      return '<tr><td class="mono">' + row.step + ' edge(s)</td>' +
        '<td class="mono">' + row.candidate.from + ' – ' + row.candidate.to +
        ', weight ' + row.candidate.weight + '</td>' +
        '<td class="mono">' + root.Format.exact(row.witness.inside.length) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.witness.lightestCrossing) + '</td>' +
        '<td>' + (row.witness.isSafe ? 'yes' : 'NO') + '</td></tr>';
    }).join('');

    root.jQuery('#mst-cut tbody').html(html);
    root.jQuery('#mst-cut-note').text('Prim’s tree so far is one side of a cut, and the edge it takes ' +
      'next is the lightest edge crossing it — which the cut property says is safe. The point of ' +
      'showing the cut rather than asserting the property is that the same table works for Kruskal and ' +
      'Borůvka with a different cut each step: all three are the same theorem applied to different ' +
      'splits, and none of them needs a separate correctness argument.');
  }

  function uniquenessRows(rows) {
    return rows.map(function (row) {
      return { cells: ['weights drawn from 1 to ' + root.Format.exact(row.range),
        root.Format.fixed(row.duplicates, 1),
        row.sameWeight + ' of ' + UNIQUENESS_TRIALS,
        row.sameTree + ' of ' + UNIQUENESS_TRIALS] };
    });
  }

  function paintUniqueness(rows) {
    root.MatrixView.render(root.jQuery('#mst-uniqueness')[0], {
      columns: ['Weight range', 'Duplicate-weight edges (mean)', 'Same total weight',
        'Same edge set'],
      rows: uniquenessRows(rows)
    });
    root.jQuery('#mst-uniqueness-note').text('Twenty instances per row. The weight column is the ' +
      'invariant and never moves; the edge-set column collapses the moment weights repeat. Real ' +
      'network costs are round numbers — hop counts, tiers, latencies rounded to milliseconds — so ' +
      'duplicates are the normal case, and any test asserting a particular tree is asserting the ' +
      'tie-break rather than the algorithm.');
  }

  function paintBottleneck(state) {
    const html = state.rows.map(function (row) {
      return '<tr><td class="mono">' + row.source + ' → ' + row.target + '</td>' +
        '<td class="mono">' + root.Format.exact(row.viaTree) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.oracle) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.cost) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.hop) + '</td></tr>';
    }).join('');

    root.jQuery('#mst-bottleneck tbody').html(html);
    root.jQuery('#mst-bottleneck-note').text('Six sample pairs of ' +
      root.Format.exact(state.checked) + ' checked, with ' + root.Format.exact(state.wrong) +
      ' disagreements against an oracle that binary-searches the weight threshold and asks whether the ' +
      'two nodes are still connected. The last two columns are the reason this matters: on ' +
      root.Format.exact(state.shortestWorse) + ' of ' + root.Format.exact(state.checked) +
      ' pairs the cheapest route has a worse worst hop than the minimax route, so "shortest" and ' +
      '"best worst link" are genuinely different questions.');
  }

  function paintRunnerUp(state) {
    const best = state.run.rows[0].run.weight;
    const second = state.second;

    root.MatrixView.render(root.jQuery('#mst-runner-up')[0], {
      columns: ['Quantity', 'Value', 'Note'],
      rows: [
        { cells: ['minimum spanning tree', root.Format.exact(best), 'the answer'] },
        { cells: ['second-best spanning tree', second ? root.Format.exact(second.weight) : 'none',
          second ? 'exactly one edge different' : 'the graph has no alternative tree'] },
        { cells: ['the difference', second ? root.Format.exact(second.weight - best) : '—',
          second && second.weight === best
            ? 'a TIE — so the minimum spanning tree was never unique'
            : 'the cheapest edge that can replace the one removed'] },
        { cells: ['the swap', second ? 'edge ' + second.removed + ' out, edge ' + second.added + ' in'
          : '—', 'found by removing each tree edge and taking the best replacement'] }
      ]
    });
    root.jQuery('#mst-runner-up-note').text('The second-best tree differs from the best by exactly one ' +
      'edge — a consequence of the cycle property, not a coincidence — so the search is a scan over ' +
      'the tree’s own edges rather than a second minimisation. Switch the weights to the duplicate-' +
      'heavy setting and the difference goes to zero, which is the honest way to discover that the ' +
      'tree you computed was one of several.');
  }

  function paintDensity(rows) {
    const html = rows.map(function (row) {
      return '<tr><td class="mono">' + root.Format.exact(row.edges) + '</td>' +
        row.rows.map(function (entry) {
          return '<td class="mono">' + root.Format.exact(entry.work) + '</td>';
        }).join('') +
        '<td class="mono">' + root.Format.exact(row.rounds) + '</td></tr>';
    }).join('');

    root.jQuery('#mst-cost-curve tbody').html(html);
    root.jQuery('#mst-cost-curve-note').text('Kruskal pays for a sort of every edge whether or not it ' +
      'uses them; this lazy Prim pushes a heap entry per edge examined, which is why it loses ground ' +
      'as the graph fills in; Borůvka scans every edge once per round and the round count barely ' +
      'moves, because each round at least halves the number of components. The ranking changes with ' +
      'density, which is exactly why all three are still taught.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

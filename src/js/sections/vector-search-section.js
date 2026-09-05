/**
 * Section: nearest neighbours in high dimensions.
 *
 * Every number here is a recall figure measured against brute force on the
 * same corpus, because that is the only honest way to describe an approximate
 * index. The demo's defaults are the worked example's - 3 000 vectors of 48
 * dimensions, 60 queries, k = 10, M = 8, efConstruction = 100 - and the
 * measurements are memoised per parameter group so that moving the query beam
 * does not rebuild the graph.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'vector-search';
  const COUNT = 3000;
  const DIMS = 48;
  const CLUSTERS = 24;
  const QUERIES = 60;
  const K = 10;
  const EF_SWEEP = [10, 16, 32, 64, 128, 256];
  const PROBE_SWEEP = [1, 2, 4, 8, 16, 32];
  let panel = null;
  let chart = null;
  let graph = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
    app.state.subscribe('theme', function () {
      if (chart) chart.redraw();
      if (graph) graph.redraw();
    });
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        'Past about ten dimensions no exact index prunes. On 3 000 vectors of 48 dimensions a k-d ' +
          'tree computes all 3 000 distances per query. A VP-tree, which prunes by the triangle ' +
          'inequality rather than by axis-aligned planes, computes 2 992.67 of them. Both are a ' +
          'linear scan with pointer chasing added, so the question stops being "which tree" and ' +
          'becomes "what recall do I need, and what will it cost".',
        'Recall is the quantity, and it has to be measured against brute force on your own corpus. ' +
          'An index at 80% recall is not "slightly slower". It is a different answer two times in ' +
          'ten, and nothing except a recall measurement reports that — the latency dashboard looks ' +
          'better after the change. One HNSW graph at M = 8 serves 58.8% recall at 20.4× faster ' +
          'than exact, or 94.8% at 7.9×, or 100% at 3.5×, from the same index with no rebuild.',
        'The asymmetry to remember is which parameter is recoverable. `ef` is a per-request ' +
          'argument, so one index serves a cheap autocomplete and an accurate batch job at once. ' +
          '`efConstruction` is baked into the edges. At the same M and the same query-time ' +
          'ef = 200, a graph built with a beam of 24 reaches 94.3% and one built with 100 reaches ' +
          '99.8%. No query-time dial finds neighbours the graph does not link to.'
      ],
      demo: { title: 'Interactive demo — recall against work, on one corpus', markup: root.VectorSearchTemplate.render() },
      diagram: {
        title: 'Diagram — HNSW\'s layer hierarchy and the descent',
        caption: 'A skip list in metric space. Each layer holds roughly 1/M of the one below, so a greedy walk ' +
          'crosses the space in a logarithmic number of hops instead of O(n^(1/d)).',
        definition: [
          'flowchart TD',
          '    Q["query vector"] --> L3["layer 3 · 8 nodes<br/>enter at the fixed entry point"]',
          '    L3 -->|"greedy walk, ef = 1"| L2["layer 2 · 60 nodes<br/>start from the layer-3 minimum"]',
          '    L2 -->|"greedy walk, ef = 1"| L1["layer 1 · 375 nodes"]',
          '    L1 -->|"greedy walk, ef = 1"| L0["layer 0 · 3 000 nodes"]',
          '    L0 -->|"beam search, ef = 32"| R["the k nearest found"]',
          '    N["M and efConstruction are in the graph<br/>ef is passed per request"] -.-> L0'
        ].join('\n')
      },
      insight: 'Approximate search is a recall dial, and shipping it without measuring recall on ' +
        'your own data is how "the search got worse" bugs enter a product silently. Latency ' +
        'improves, nothing reports the quality that was traded for it, and the complaints arrive ' +
        'months later from users. Two corollaries follow. Recall does not transfer between ' +
        'datasets, so a number from a benchmark is not a number about your corpus. And a quantised ' +
        'index has to be re-ranked. Eight bytes a vector returns the true nearest neighbour first ' +
        'one time in ten; the same codes with an exact rescoring stage recall 95%.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.VectorSearchTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  const corpus = root.Helpers.memoise(function () {
    const vectors = root.VectorLab.vectors({ count: COUNT, dims: DIMS, clusters: CLUSTERS, seed: 7 });
    const queries = root.VectorLab.queries({ count: QUERIES, dims: DIMS, clusters: CLUSTERS, seed: 7 });
    return { vectors: vectors, queries: queries, truth: root.VectorLab.truthFor(vectors, queries, K) };
  });

  /* The graph is the expensive object here; it is rebuilt only when a *build*
     parameter moves, never when the query beam does. */
  const graphFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|').map(Number);
    const data = corpus('c');
    const built = root.Hnsw.build(data.vectors, { M: parts[0], efConstruction: parts[1], seed: 7 });
    return {
      index: built,
      shape: built.shape(),
      sweep: root.VectorLab.sweep({
        vectors: data.vectors, queries: data.queries, truth: data.truth,
        index: built, k: K, values: EF_SWEEP
      })
    };
  });

  const ivfFor = root.Helpers.memoise(function () {
    const data = corpus('c');
    const index = root.AnnIndex.ivf(data.vectors, { lists: 64, seed: 7 });
    return {
      index: index,
      rows: PROBE_SWEEP.map(function (probe) {
        return Object.assign(
          root.VectorLab.score(root.VectorLab.probeWrapper(index, probe), data.queries, data.truth, K),
          { probe: probe }
        );
      })
    };
  });

  const quantiserFor = root.Helpers.memoise(function () {
    const data = corpus('c');
    const index = root.AnnIndex.productQuantiser(data.vectors, { parts: 8, centroids: 256, seed: 7 });
    return { index: index, raw: root.VectorLab.score(index, data.queries, data.truth, K) };
  });

  const rerankFor = root.Helpers.memoise(function (widen) {
    const data = corpus('c');
    return root.VectorLab.score(
      root.VectorLab.reranked(quantiserFor('q').index, data.vectors, Number(widen)),
      data.queries, data.truth, K
    );
  });

  const exactFor = root.Helpers.memoise(function () {
    const data = corpus('c');
    return {
      brute: root.VectorLab.score(root.AnnIndex.bruteForce(data.vectors), data.queries, data.truth, K),
      vp: root.VectorLab.score(
        root.AnnIndex.vpTree(data.vectors, { leafSize: 16, seed: 7 }), data.queries, data.truth, K)
    };
  });

  function update(app) {
    const values = panel.values();
    const built = graphFor(values['vs-m'] + '|' + values['vs-efc']);
    const data = corpus('c');
    const hnsw = root.VectorLab.score(
      root.VectorLab.efWrapper(built.index, Number(values['vs-ef'])), data.queries, data.truth, K);
    const ivf = ivfFor('i');
    const probe = nearestRow(ivf.rows, 'probe', Number(values['vs-probe']));
    const reranked = rerankFor(values['vs-rerank']);

    paintMetrics({ hnsw: hnsw, quantiser: quantiserFor('q'), reranked: reranked, shape: built.shape });
    paintCompare({ hnsw: hnsw, probe: probe, reranked: reranked, values: values });
    paintParams(built, values);
    drawChart(app, { built: built, ivf: ivf, values: values });
    drawGraph(app, built, Number(values['vs-layer']));
  }

  function nearestRow(rows, field, wanted) {
    let best = rows[0];
    rows.forEach(function (row) {
      if (Math.abs(row[field] - wanted) < Math.abs(best[field] - wanted)) best = row;
    });
    return best;
  }

  function paintMetrics(state) {
    const exact = exactFor('e');
    root.MetricGrid.update({
      'vs-recall': {
        value: root.Format.percent(state.hnsw.recall, 1),
        note: 'the true nearest was returned first on ' + root.Format.percent(state.hnsw.topHitRate, 1) + ' of queries'
      },
      'vs-cost': {
        value: root.Format.fixed(state.hnsw.distancesPerQuery, 2),
        note: root.Format.fixed(COUNT / state.hnsw.distancesPerQuery, 2) + '× fewer than an exact scan of ' +
          root.Format.exact(COUNT)
      },
      'vs-pq': {
        value: root.Format.percent(state.quantiser.raw.recall, 1) + ' → ' + root.Format.percent(state.reranked.recall, 1),
        note: 'alone, then with the shortlist rescored exactly'
      },
      'vs-memory': {
        value: root.Format.fixed(state.quantiser.raw.bytesPerVector, 1) + ' B',
        note: 'quantised, against ' + root.Format.fixed(exact.brute.bytesPerVector, 1) + ' exact and ' +
          root.Format.fixed(state.shape.bytes / COUNT, 1) + ' for the graph'
      }
    });
  }

  function paintCompare(state) {
    const exact = exactFor('e');
    const quantiser = quantiserFor('q');
    const rows = [
      ['brute force (exact)', exact.brute, 'none'],
      ['VP-tree (exact)', exact.vp, 'metric tree'],
      ['IVF, 64 lists, probe ' + state.probe.probe, state.probe, 'k-means'],
      ['product quantisation, 8 bytes', quantiser.raw, 'k-means per subspace'],
      ['the same codes, re-ranked ' + state.values['vs-rerank'] + '×', state.reranked, 'shortlist then exact'],
      ['HNSW, M = ' + state.values['vs-m'] + ', ef = ' + state.values['vs-ef'], state.hnsw, 'proximity graph']
    ];

    root.jQuery('#vs-compare tbody').html(rows.map(function (row) {
      return '<tr><td>' + row[0] + '</td>' +
        '<td class="mono">' + root.Format.percent(row[1].recall, 1) + '</td>' +
        '<td class="mono">' + root.Format.percent(row[1].topHitRate, 1) + '</td>' +
        '<td class="mono">' + root.Format.fixed(row[1].distancesPerQuery, 2) + '</td>' +
        '<td class="mono">' + root.Format.fixed(row[1].bytesPerVector, 1) + '</td>' +
        '<td>' + row[2] + '</td></tr>';
    }).join(''));

    root.jQuery('#vs-compare-note').text('No column orders this table. Brute force wins recall, product ' +
      'quantisation wins memory by an order of magnitude, and HNSW wins the ratio anyone actually deploys on. ' +
      'Read the quantiser\'s two rows together: on its own it is a shortlist generator with a 10% chance of ' +
      'putting the right answer first, and the same codes with an exact rescoring stage are a search index. ' +
      'Its memory column also rises when re-ranking is on, because rescoring needs the exact vectors — the ' +
      'saving is in fast memory, not in total bytes.');
  }

  function paintParams(built, values) {
    const layers = built.shape.perLayer.map(function (layer) {
      return '  layer ' + layer.layer + ':  ' + String(layer.nodes).padStart(5) + ' nodes,  mean degree ' +
        root.Format.fixed(layer.meanDegree, 1) + ',  ' + layer.orphans + ' with no links';
    });

    root.jQuery('#vs-params').text([
      'M = ' + values['vs-m'] + ', efConstruction = ' + values['vs-efc'] + ' — both baked into the graph',
      '',
      '  ' + root.Format.exact(built.shape.links) + ' links, ' + root.Format.bytes(built.shape.bytes) + ' total',
      '  neighbour selection: ' + built.shape.select,
      ''
    ].concat(layers).concat([
      '',
      'ef — passed per request, changeable without a rebuild',
      ''
    ]).concat(built.sweep.map(function (row) {
      const marker = row.value === Number(values['vs-ef']) ? '  ←' : '';
      return '  ef ' + String(row.value).padStart(4) + ':  recall ' +
        root.Format.percent(row.recall, 1).padStart(7) + ',  ' +
        root.Format.fixed(row.distancesPerQuery, 2).padStart(8) + ' distances,  ' +
        root.Format.fixed(row.speedup, 2) + '× faster than exact' + marker;
    })).join('\n'));

    root.jQuery('#vs-params-note').text('Move efConstruction and the whole ef table shifts, because the edges ' +
      'changed. Move ef and only the row markers move. That is the practical difference between the two ' +
      'parameters: one is a deployment decision you can revisit per request, and the other is a rebuild.');
  }

  function drawChart(app, state) {
    const exact = exactFor('e');
    chart = root.ErrorBandView.curve(root.jQuery('#vs-chart')[0], {
      lazyLib: app.lazyLib,
      height: 280,
      logX: true,
      yMax: 1,
      legendHost: root.jQuery('#vs-chart-legend')[0],
      xLabel: 'distance computations per query (log scale)',
      yLabel: 'recall at k = 10',
      markers: [{ x: exact.brute.distancesPerQuery, label: 'exact scan' }],
      series: [
        { label: 'HNSW, ef from 10 to 256', width: 3,
          points: state.built.sweep.map(function (row) {
            return { x: row.distancesPerQuery, y: row.recall };
          }) },
        { label: 'IVF, probe from 1 to 32',
          points: state.ivf.rows.map(function (row) {
            return { x: row.distancesPerQuery, y: row.recall };
          }) }
      ]
    });

    root.jQuery('#vs-chart-note').text('Up and to the left is better. Both curves are the same shape — recall ' +
      'is cheap at first and the last few percent costs more than everything before it — and both end at the ' +
      'exact scan marked on the right. An index is a point on one of these curves, not a fact about a library.');
  }

  function drawGraph(app, built, layer) {
    const depth = Math.min(layer, built.shape.layers - 1);
    const nodes = root.VectorLab.layerView(built.index, depth);
    const xs = nodes.map(function (node) { return node.x; });
    const ys = nodes.map(function (node) { return node.y; });

    graph = root.SpatialView.graph(root.jQuery('#vs-graph')[0], {
      height: 320,
      bounds: {
        minX: Math.min.apply(null, xs), maxX: Math.max.apply(null, xs),
        minY: Math.min.apply(null, ys), maxY: Math.max.apply(null, ys)
      },
      nodes: nodes,
      summary: 'Layer ' + depth + ' of the HNSW graph: ' + nodes.length +
        ' nodes, drawn at their first two of ' + DIMS + ' coordinates.'
    });

    root.jQuery('#vs-graph-note').text('Layer ' + depth + ' of ' + (built.shape.layers - 1) + ', with ' +
      root.Format.exact(nodes.length) + ' of the ' + root.Format.exact(COUNT) + ' vectors. This is a ' +
      'projection onto the first two of ' + DIMS + ' coordinates, so a link that looks long here may be short ' +
      'in the space — read it for the thinning between layers, which is the skip-list structure, rather than ' +
      'for individual edges.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

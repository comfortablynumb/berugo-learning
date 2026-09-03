/**
 * Section: spectral methods, centrality and communities.
 *
 * One graph, analysed four ways, and the interesting result is how little the
 * four agree: the vertex a random walk visits most is rarely the vertex most
 * shortest paths run through, and neither is necessarily close to everybody.
 * "Important" is not a property of a vertex, it is a property of a question,
 * and the ranking table is the argument.
 *
 * The last panel corrects a claim this platform's own milestone spec made.
 * Dropping the dangling mass in PageRank is supposed to make "the ranking
 * drift"; over 4 589 small link graphs it produces zero strictly inverted
 * pairs while leaking up to 85% of the probability. The bug is invisible in
 * the output everybody checks and catastrophic in the one nobody does.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'spectral-methods';
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
      title: 'Diagram — PageRank as a random walk with a restart',
      caption: 'With probability d the surfer follows a link chosen uniformly from the current page; ' +
        'with probability 1 − d they jump to a page chosen uniformly from the whole web. The jump is ' +
        'what makes the chain irreducible and aperiodic, so a unique stationary distribution exists ' +
        'at all — and a page with no outbound links has to be handled explicitly, or its share of the ' +
        'probability simply disappears.',
      definition: [
        'flowchart LR',
        '    P["current page"] -->|"probability d<br/>follow a link"| L["a page it links to"]',
        '    P -->|"probability 1 − d<br/>teleport"| A["any page at all"]',
        '    D["a page with no links out"] -->|"its mass must be<br/>redistributed explicitly"| A',
        '    D -.->|"if it is not"| X["the vector stops summing to 1"]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**Write a graph as a matrix and its structure becomes arithmetic.** The **Laplacian** ' +
        '`L = D − A` has a smallest eigenvalue of exactly 0, with an all-ones eigenvector.',
      'The *second*-smallest is the **algebraic connectivity**. It is 0 precisely when the graph is ' +
        'disconnected, and it grows with how hard the graph is to cut.',
      'Its eigenvector — the **Fiedler vector** — assigns each vertex a number, and splitting at the ' +
        'median is **spectral bisection**. That is a partition into two halves derived from linear ' +
        'algebra rather than search.',
      '**PageRank** is the stationary distribution of a random walk that follows a link with ' +
        'probability `d` and teleports with probability `1 − d`.',
      'The teleport is not a fudge. It is what makes the chain irreducible and aperiodic, and ' +
        'therefore what makes a unique stationary distribution exist.',
      '**Power iteration** finds it by repeated multiplication, and this section checks the result ' +
        'against a direct linear solve. A power iteration that stopped early returns a plausible ' +
        'vector rather than an error.',
      '**Centrality is a question, not a property.** **Betweenness** counts the shortest paths ' +
        'passing through a vertex, and Brandes computes all of them in O(VE) rather than by ' +
        'enumeration — the two are compared here.',
      '**Closeness** is the reciprocal of the mean distance to everybody else. **PageRank** is a ' +
        'walk.',
      'The three routinely disagree about which vertex matters most, and the table below is the ' +
        'argument that you must choose the measure by the question rather than by convenience.',
      '**Modularity** compares a partition\'s internal edge count to what a random graph with the ' +
        'same degrees would have. **Louvain** maximises it greedily: move each vertex to its best ' +
        'neighbouring community, collapse, repeat.',
      'It is fast, and it has a **resolution limit**. On a graph with no communities at all it still ' +
        'returns communities, with a modularity around 0.25; on a graph with four planted ones it ' +
        'recovers them exactly.',
      'Both cases are below, because only the pair tells you what the score means.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — four measures, two partitions, and one bug that hides',
        markup: root.SpectralMethodsTemplate.render()
      },
      diagram: diagram(),
      insight: 'Dangling nodes are the detail that breaks naive PageRank implementations, and the ' +
        'way they break it is not the way it is usually described. The panel below runs both ' +
        'versions over thousands of link graphs. Dropping the dangling mass never once inverts a ' +
        'pair in the ranking, and it leaks up to 85% of the probability. So the eyeball test passes ' +
        'and the vector is nonsense. Everything downstream that treats a PageRank score as a number ' +
        'rather than an order is quietly wrong: a threshold, a weighted blend with other signals, a ' +
        'comparison between two crawls. Check the invariant, not the output.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.SpectralMethodsTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  /* -------------------------------------------------------------- fixtures */

  const instanceFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.GraphAnalysisLab.build({ shape: parts[0], n: Number(parts[1]),
      seed: Number(parts[2]), rows: 5, columns: 5 });
  });

  const spectralFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.GraphAnalysisLab.spectralRun(instanceFor(parts.slice(0, 3).join('|')),
      { damping: Number(parts[3]) / 100 });
  });

  const communityFor = root.Helpers.memoise(function (key) {
    return root.GraphAnalysisLab.communityRun(instanceFor(key), {});
  });

  const webFor = root.Helpers.memoise(function (key) {
    return root.GraphAnalysisLab.webGraph({ n: Number(key), seed: 1 });
  });

  const dampingFor = root.Helpers.memoise(function (key) {
    return root.GraphAnalysisLab.dampingSweep(webFor(key), {});
  });

  const leakFor = root.Helpers.memoise(function (key) {
    return { run: root.GraphAnalysisLab.pageRankRun(webFor(key), {}),
      search: root.GraphAnalysisLab.leakSearch({}) };
  });

  /* -------------------------------------------------------------- painting */

  function update(app) {
    const values = panel.values();
    const base = values['spc-shape'] + '|' + values['spc-nodes'] + '|' + values['spc-seed'];
    const spectral = spectralFor(base + '|' + values['spc-damping']);
    const community = communityFor(base);
    const pages = String(values['spc-pages']);

    paintMetrics(spectral, community, values['spc-measure']);
    paintMap(instanceFor(base), spectral, community, values['spc-measure']);
    paintRanks(spectral);
    paintCommunities(community, instanceFor(base));
    paintDamping(dampingFor(pages), app);
    paintDangling(leakFor(pages));
  }

  function scoresFor(spectral, measure) {
    if (measure === 'closeness') return spectral.closeness.score;

    if (measure === 'pagerank') return spectral.rank.rank;
    return spectral.betweenness.score;
  }

  function topOf(scores) {
    let best = 0;

    scores.forEach(function (value, index) { if (value > scores[best]) best = index; });
    return best;
  }

  const LABELS = { betweenness: 'betweenness', closeness: 'closeness', pagerank: 'PageRank',
    community: 'Louvain community', fiedler: 'the Fiedler vector' };

  function paintMetrics(spectral, community, measure) {
    const scores = scoresFor(spectral, measure);
    const best = topOf(scores);

    root.MetricGrid.update({
      'spc-top': { value: 'vertex ' + root.Format.exact(best),
        note: 'scoring ' + root.Format.fixed(scores[best], 4) + ' on ' +
          (LABELS[measure] === 'Louvain community' || LABELS[measure] === 'the Fiedler vector'
            ? 'betweenness' : LABELS[measure]) },
      'spc-fiedler': { value: root.Format.fixed(spectral.fiedler.eigenvalue, 5),
        note: 'the bisection cuts ' + root.Format.plural(spectral.fiedler.cut, 'edge') +
          ' into halves of ' + spectral.fiedler.sizes.join(' and ') },
      'spc-modularity': { value: root.Format.fixed(community.run.modularity, 4),
        note: root.Format.plural(community.run.communities, 'community', 'communities') +
          ' after ' + root.Format.plural(community.run.report.passes, 'pass', 'passes') },
      'spc-check': { value: spectral.rankGap < 1e-8 ? 'agrees' : 'DIFFERS',
        note: 'largest difference ' + spectral.rankGap.toExponential(2) + ' over ' +
          root.Format.plural(spectral.rank.report.iterations, 'iteration') }
    });
  }

  function paintMap(instance, spectral, community, measure) {
    view = function () { drawMap(instance, spectral, community, measure); };
    view();
  }

  function drawMap(instance, spectral, community, measure) {
    const host = root.jQuery('#spc-map')[0];

    if (!host) return;
    const width = host.clientWidth || 620;
    const height = 340;
    const groups = groupsFor(instance, spectral, community, measure);

    root.GraphView.draw({ host: host,
      graph: { n: instance.adjacency.length,
        edges: root.GraphAnalysisLab.edgesOf(instance.adjacency) },
      positions: root.GraphView.groupedLayout(groups, instance.adjacency.length, width, height),
      width: width, height: height,
      nodeClass: nodeClassFor(spectral, measure) });
    root.jQuery('#spc-map-note').text(noteFor(instance, spectral, community, measure));
  }

  /** Every measure becomes a grouping, because one ring per group is the only
   *  drawing in which a partition and a ranking can be read the same way. */
  function groupsFor(instance, spectral, community, measure) {
    if (measure === 'community') return partitionOf(community.run.community);

    if (measure === 'fiedler') return partitionOf(spectral.fiedler.side);
    const scores = scoresFor(spectral, measure);
    const sorted = scores.map(function (value, index) { return { value: value, index: index }; })
      .sort(function (a, b) { return b.value - a.value || a.index - b.index; });
    const bands = [[], [], [], []];

    sorted.forEach(function (entry, position) {
      bands[Math.min(3, Math.floor(4 * position / sorted.length))].push(entry.index);
    });
    return bands.filter(function (band) { return band.length > 0; });
  }

  function partitionOf(labels) {
    const groups = [];

    labels.forEach(function (label, v) {
      const id = Number(label);

      while (groups.length <= id) groups.push([]);
      groups[id].push(v);
    });
    return groups.filter(function (members) { return members.length > 0; });
  }

  function nodeClassFor(spectral, measure) {
    if (measure === 'community' || measure === 'fiedler') {
      return function () { return 'settled'; };
    }
    const scores = scoresFor(spectral, measure);
    const best = topOf(scores);

    return function (v) { return v === best ? 'cut' : 'settled'; };
  }

  function noteFor(instance, spectral, community, measure) {
    if (measure === 'community') {
      return 'One ring per Louvain community — ' +
        root.Format.plural(community.run.communities, 'community', 'communities') +
        ' at a modularity of ' +
        root.Format.fixed(community.run.modularity, 4) + '. A ring with many edges leaving it is a ' +
        'community the algorithm was not confident about.';
    }

    if (measure === 'fiedler') {
      return 'The two sides of the spectral bisection, ' + spectral.fiedler.sizes.join(' and ') +
        ' vertices, cutting ' + root.Format.plural(spectral.fiedler.cut, 'edge') +
        '. Every edge drawn between the two rings is an edge the cut pays for; the algebraic ' +
        'connectivity of ' + root.Format.fixed(spectral.fiedler.eigenvalue, 5) +
        ' is the linear-algebra statement of the same thing.';
    }
    const scores = scoresFor(spectral, measure);
    const best = topOf(scores);

    return 'Four bands by ' + LABELS[measure] + ', highest on the outer ring, with the top vertex ' +
      'highlighted — vertex ' + root.Format.exact(best) + ' at ' +
      root.Format.fixed(scores[best], 4) + '. Switch the measure above and watch the bands ' +
      'reshuffle on the same graph: that reshuffling is the whole content of the table below.';
  }

  function paintRanks(spectral) {
    const rows = ['betweenness', 'closeness', 'pagerank'].map(function (measure) {
      const scores = scoresFor(spectral, measure);
      const order = scores.map(function (value, index) { return { value: value, index: index }; })
        .sort(function (a, b) { return b.value - a.value || a.index - b.index; });

      return { cells: [LABELS[measure],
        order.slice(0, 5).map(function (entry) { return entry.index; }).join(', '),
        root.Format.fixed(order[0].value, 4),
        root.Format.fixed(order[order.length - 1].value, 4)] };
    });
    const exact = spectral.exactBetweenness;

    rows.push({ cells: ['betweenness by path enumeration',
      exact === null ? 'not run — the path count is exponential'
        : 'agrees with Brandes to ' + maxGap(spectral.betweenness.score, exact).toExponential(1),
      exact === null ? '—' : root.Format.fixed(Math.max.apply(null, exact), 4),
      root.Format.exact(spectral.betweenness.report.sources) + ' single-source sweeps'] });
    root.MatrixView.render(root.jQuery('#spc-ranks')[0], {
      columns: ['Measure', 'Top five vertices', 'Highest score', 'Lowest score'], rows: rows
    });
    root.jQuery('#spc-ranks-note').text('Three measures, three orderings, one graph. Compare the ' +
      'top-five columns: ' + agreementSentence(spectral) + ' None of the three is wrong. ' +
      'Betweenness answers "whose removal would lengthen the most routes", closeness answers "who ' +
      'can reach everybody quickly", and PageRank answers "where does a random walk spend its time" ' +
      '— three questions that a network diagram cannot distinguish and an operations decision ' +
      'absolutely can. The last row is the check: Brandes computes betweenness in O(VE) and its ' +
      'answer is compared against enumerating the shortest paths themselves.');
  }

  function maxGap(a, b) {
    let worst = 0;

    a.forEach(function (value, index) { worst = Math.max(worst, Math.abs(value - b[index])); });
    return worst;
  }

  function agreementSentence(spectral) {
    const tops = ['betweenness', 'closeness', 'pagerank'].map(function (measure) {
      return topOf(scoresFor(spectral, measure));
    });
    const distinct = new Set(tops).size;

    if (distinct === 1) {
      return 'all three happen to agree on vertex ' + root.Format.exact(tops[0]) +
        ' here, which is common on a symmetric graph and stops being true as soon as the structure ' +
        'is uneven — try the scale-free or interval shape.';
    }
    return 'they pick ' + root.Format.plural(distinct, 'different vertex', 'different vertices') +
      ' as the most important — betweenness says ' + root.Format.exact(tops[0]) +
      ', closeness says ' + root.Format.exact(tops[1]) + ', PageRank says ' +
      root.Format.exact(tops[2]) + '.';
  }

  function paintCommunities(community, instance) {
    const rows = [
      { cells: ['Louvain', root.Format.exact(community.run.communities),
        root.Format.fixed(community.run.modularity, 4),
        root.Format.plural(community.run.report.passes, 'pass', 'passes') + ', ' +
          root.Format.plural(community.run.report.moves, 'vertex move')] }
    ];

    if (community.planted !== null) {
      rows.push({ cells: ['the planted grouping', root.Format.exact(instance.groups),
        root.Format.fixed(community.planted, 4), 'known by construction'] });
      rows.push({ cells: ['agreement between the two',
        root.Format.fixed(100 * community.matches.rand, 1) + '%',
        root.Format.exact(community.matches.same) + ' of ' +
          root.Format.exact(community.matches.total) + ' pairs',
        'the Rand index, which ignores the labels'] });
    }

    if (community.exact !== null) {
      rows.push({ cells: ['exhaustive best modularity', '—',
        root.Format.fixed(community.exact.modularity === undefined
          ? community.exact : community.exact.modularity, 4),
        'every partition, tried'] });
    }
    root.MatrixView.render(root.jQuery('#spc-communities')[0], {
      columns: ['Partition', 'Communities', 'Modularity', 'How it was obtained'], rows: rows
    });
    root.jQuery('#spc-communities-note').text(community.planted === null
      ? 'There are no communities in this graph and Louvain returned ' +
        root.Format.plural(community.run.communities, 'community', 'communities') +
        ' at a modularity of ' +
        root.Format.fixed(community.run.modularity, 4) + '. That is not a bug: modularity measures ' +
        'the excess of internal edges over a degree-matched random graph, and a random graph has ' +
        'fluctuations. A score near 0.25 on a structureless graph is the number to remember, ' +
        'because it is the floor against which a "we found communities" claim has to be read.'
      : 'Four groups were planted and Louvain found ' +
        root.Format.plural(community.run.communities, 'community', 'communities') +
        ', agreeing with the truth on ' +
        root.Format.fixed(100 * community.matches.rand, 1) + '% of vertex pairs at a modularity of ' +
        root.Format.fixed(community.run.modularity, 4) + ' — against ' +
        root.Format.fixed(community.planted, 4) + ' for the planted grouping itself. Switch to the ' +
        'random shape to see the same algorithm return communities from a graph that has none, at a ' +
        'modularity around 0.25. Only the pair of runs tells you what a modularity score means.');
  }

  function paintDamping(rows, app) {
    const html = rows.map(function (row) {
      return '<tr><td class="mono">' + root.Format.fixed(row.damping, 2) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.iterations) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.predicted) + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.predicted / Math.max(1, row.iterations), 1) +
          '×</td>' +
        '<td class="mono">' + root.Format.exact(row.top) + '</td></tr>';
    }).join('');
    const last = rows[rows.length - 1];

    root.jQuery('#spc-damping-table tbody').html(html);
    drawDampingChart(rows, app);
    root.jQuery('#spc-damping-note').text('The textbook bound says the error falls like d^k, so ' +
      'reaching 10⁻¹⁰ should take log(10⁻¹⁰)/log(d) iterations — ' +
      root.Format.exact(last.predicted) + ' of them at d = ' + root.Format.fixed(last.damping, 2) +
      '. It takes ' + root.Format.exact(last.iterations) + ', which is ' +
      root.Format.fixed(last.predicted / last.iterations, 1) + '× fewer. The bound is worst-case ' +
      'over every starting vector and every graph; a real graph mixes far faster, and starting from ' +
      'the uniform distribution — which is already close to the answer — costs most of the ' +
      'difference. The last column is what actually matters about damping: it changes the answer, ' +
      'not just the cost.');
  }

  function drawDampingChart(rows, app) {
    const host = root.jQuery('#spc-chart')[0];

    if (!host) return;
    root.GrowthPlot.render(host, {
      lazyLib: app.lazyLib,
      logY: true,
      height: 230,
      series: [
        { label: 'iterations measured', points: rows.map(function (row) {
          return { x: row.damping, y: row.iterations }; }) },
        { label: 'the d^k prediction', points: rows.map(function (row) {
          return { x: row.damping, y: row.predicted }; }), dashed: true }
      ],
      xLabel: 'damping factor',
      yLabel: 'iterations to 10⁻¹⁰',
      legendHost: root.jQuery('#spc-legend')[0],
      summary: function () {
        return 'Measured convergence against the worst-case d^k bound, on a logarithmic axis.';
      }
    });
  }

  function paintDangling(state) {
    const run = state.run;
    const rows = [
      danglingRow('mass redistributed (correct)', run.goodTotal.total, run.gap,
        0, 0, 'checked against a direct linear solve'),
      danglingRow('mass dropped on the floor', run.leakyTotal.total, run.leakGap,
        run.orderChanges.moved, run.orderChanges.topTen, '')
    ].join('');

    root.jQuery('#spc-dangling tbody').html(rows);
    root.jQuery('#spc-dangling-note').text('The broken version holds ' +
      root.Format.fixed(run.leakyTotal.total, 4) + ' of the probability instead of 1, and moves ' +
      root.Format.exact(run.orderChanges.moved) + ' of ' +
      root.Format.exact(run.orderChanges.total) + ' positions in the ranking. That second number ' +
      'is the finding: a search over ' + root.Format.exact(state.search.checked) +
      ' small link graphs with dangling pages produced ' +
      root.Format.exact(state.search.inversions) + ' strictly inverted pairs, while the worst leak ' +
      'was ' + root.Format.fixed(100 * state.search.worstLeak, 1) + '% of the mass. So the usual ' +
      'description of this bug — "the ranking drifts" — is not what happens. The order survives; ' +
      'the numbers do not. Anything that reads a PageRank score as a value rather than a position ' +
      '— a cutoff, a blend with other signals, a comparison between two crawls — is silently wrong, ' +
      'and the ranking somebody spot-checks looks perfect.');
  }

  function danglingRow(name, total, gap, moved, topTen, note) {
    return '<tr><td>' + name + (note ? ' — ' + note : '') + '</td>' +
      '<td class="mono">' + root.Format.fixed(total, 6) + '</td>' +
      '<td class="mono">' + gap.toExponential(2) + '</td>' +
      '<td class="mono">' + root.Format.exact(moved) + '</td>' +
      '<td class="mono">' + root.Format.exact(topTen) + '</td></tr>';
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

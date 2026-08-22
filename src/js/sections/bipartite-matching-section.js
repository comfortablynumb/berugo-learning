/**
 * Section: bipartite matching.
 *
 * Three panels making three different claims, each checked rather than
 * asserted. Kuhn, Hopcroft-Karp and a unit-capacity maximum flow return the
 * same number on every graph the controls can build - which is the reduction
 * 14.1 promised. Koenig's cover is constructed from the same alternating
 * search that finds the matching, and it is fed back through a checker that
 * counts uncovered edges. And Gale-Shapley is run twice, once from each side,
 * because "stable" and "maximum" are different words and only running it both
 * ways shows that the proposing side is the one that wins.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'bipartite-matching';
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
      title: 'Diagram — an alternating path, and what flipping it does',
      caption: 'An augmenting path starts and ends at unmatched vertices and alternates unmatched, ' +
        'matched, unmatched. Flipping every edge on it leaves a matching one edge larger, because the ' +
        'path has one more unmatched edge than matched ones. Berge\'s theorem is the converse: a ' +
        'matching is maximum exactly when no such path exists.',
      definition: [
        'flowchart LR',
        '    L1["a₁ — unmatched"] -->|"free edge"| R1["b₁"]',
        '    R1 -.->|"matched"| L2["a₂"]',
        '    L2 -->|"free edge"| R2["b₂ — unmatched"]',
        '    R2 --> F["flip all three: a₁–b₁ and a₂–b₂ are matched,<br/>a₂–b₁ is not. Size rises by one."]'
      ].join('\n')
    };
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        'A **matching** is a set of edges no two of which share a vertex. On a bipartite graph — two ' +
          'sides, every edge crossing between them — finding the largest one is easy, and every ' +
          'algorithm here is the same idea: find an **augmenting path**, a route from an unmatched ' +
          'left vertex to an unmatched right one that alternates free, matched, free, and flip every ' +
          'edge on it. The path has one more free edge than matched ones, so the flip gains exactly ' +
          'one. **Berge\'s theorem** says that is enough: when no augmenting path exists, the matching ' +
          'is maximum.',
        '**Kuhn** finds one augmenting path at a time, depth-first, resetting its visited set per ' +
          'left vertex — O(VE). **Hopcroft-Karp** finds a whole maximal set of *vertex-disjoint* ' +
          'shortest augmenting paths per phase, and because the shortest augmenting path strictly ' +
          'lengthens each phase, there are only O(√V) phases, giving O(E√V). The phase column below ' +
          'is the entire difference between the two, and on small graphs it is often no difference at ' +
          'all — which is why the table sweeps the size instead of quoting a complexity.',
        '**Koenig\'s theorem** links this to a covering problem: on a bipartite graph the maximum ' +
          'matching and the *minimum vertex cover* have the same size, and the cover can be read off ' +
          'the alternating search directly. That is not a curiosity — minimum vertex cover is ' +
          'NP-hard in general, and bipartiteness is exactly what makes it tractable. **Hall\'s ' +
          'condition** is the other reading: a perfect matching exists exactly when no set S of left ' +
          'vertices has fewer than |S| neighbours, and when one fails the search hands back the ' +
          'offending set as a witness rather than a boolean.',
        '**Stable matching is a different problem.** Gale-Shapley takes preference *orders* rather ' +
          'than an edge set, and optimises something else entirely: it produces a matching with no ' +
          '**blocking pair** — no two people who would both rather have each other than their current ' +
          'partners. It is always perfect on complete preferences, so its size is never in question; ' +
          'what is in question is *whose* preferences it serves, and the panel runs it from both ' +
          'sides on identical data to show that the proposing side gets the better half.'
      ],
      demo: {
        title: 'Interactive demo — matching, cover, Hall witness and two stable runs',
        markup: root.BipartiteMatchingTemplate.render()
      },
      diagram: diagram(),
      insight: 'Two facts settle most arguments about "matching platforms". Gale-Shapley is stable, ' +
        'not maximum-weight — it will happily produce a pairing that a weighted algorithm beats on ' +
        'total satisfaction — and it is optimal for the *proposing* side, which means the choice of ' +
        'who proposes is a product decision with a measurable winner, not an implementation detail. ' +
        'The residency match famously switched proposing sides for exactly this reason. If your ' +
        'problem is "assign these to those at least cost", you want 14.6\'s Hungarian algorithm; if ' +
        'it is "nobody should want to defect", you want this one.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.BipartiteMatchingTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  /* -------------------------------------------------------------- fixtures */

  const graphFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.MatchingLab.build({ shape: parts[0], left: Number(parts[1]), seed: Number(parts[2]) });
  });

  const compareFor = root.Helpers.memoise(function (key) {
    return root.MatchingLab.compareMatchings(graphFor(key));
  });

  const structureFor = root.Helpers.memoise(function (key) {
    return root.MatchingLab.structureRun(graphFor(key));
  });

  const sweepFor = root.Helpers.memoise(function () {
    return root.MatchingLab.phaseSweep({});
  });

  const stableFor = root.Helpers.memoise(function (key) {
    return root.MatchingLab.stableRun({ size: Number(key), seed: 1 });
  });

  /* -------------------------------------------------------------- painting */

  function update(app) {
    const values = panel.values();
    const key = values['bmt-shape'] + '|' + values['bmt-left'] + '|' + values['bmt-seed'];
    const compare = compareFor(key);
    const structure = structureFor(key);
    const stable = stableFor(String(values['bmt-stable']));

    paintMetrics(compare, structure);
    paintMap(graphFor(key), structure);
    paintCompare(compare);
    paintStructure(graphFor(key), structure);
    paintSweep(sweepFor('fixed'), app);
    paintStable(stable);
    paintRanks(stable, values['bmt-proposer']);
  }

  /**
   * The same people under both runs, one row each. The aggregate rank in the
   * table above says the transfer exists; this says who paid for it, which is
   * the only form in which the argument ever convinces anybody.
   */
  function paintRanks(stable, proposer) {
    const chosen = proposer === 'right'
      ? { matchLeft: stable.byRight.matchRight } : stable.byLeft;
    const other = proposer === 'right'
      ? stable.byLeft : { matchLeft: stable.byRight.matchRight };
    const rows = chosen.matchLeft.map(function (partner, who) {
      const mine = stable.left[who].indexOf(partner) + 1;
      const theirs = stable.left[who].indexOf(other.matchLeft[who]) + 1;

      return { cells: ['left ' + who, 'right ' + partner, root.Format.exact(mine),
        root.Format.exact(theirs), mine === theirs ? 'unchanged' : (mine < theirs ? 'better' : 'worse')] };
    });

    root.MatrixView.render(root.jQuery('#bmt-ranks')[0], {
      columns: ['Person', 'Partner', 'Choice number under this run',
        'Choice number under the other run', 'Effect'], rows: rows
    });
    const better = rows.filter(function (entry) { return entry.cells[4] === 'better'; }).length;
    const worse = rows.filter(function (entry) { return entry.cells[4] === 'worse'; }).length;

    root.jQuery('#bmt-ranks-note').text('Every left-side person under the run selected above, and ' +
      'what the other run would have given them. ' + root.Format.exact(better) + ' do better here, ' +
      root.Format.exact(worse) + ' do worse, and ' +
      root.Format.exact(rows.length - better - worse) + ' are unaffected. Read the "worse" column ' +
      'carefully: when the left side proposes, that column is empty, and when the right side does, ' +
      'it is the only one with entries. Proposer-optimality is not an average — it says every ' +
      'single proposer gets the best partner they get in ANY stable matching, and every receiver ' +
      'gets the worst. There is no stable matching in between that a tie-break could reach.');
  }

  function paintMetrics(compare, structure) {
    const violator = structure.violator;

    root.MetricGrid.update({
      'bmt-size': { value: root.Format.exact(compare.size),
        note: structure.perfect ? 'perfect — every vertex on the smaller side is used'
          : root.Format.exact(structure.deficiency) + ' left vertices left unmatched' },
      'bmt-cover': { value: root.Format.exact(structure.cover.size),
        note: structure.check.valid ? 'covers every edge, and equals the matching'
          : root.Format.exact(structure.check.uncovered) + ' edges left uncovered' },
      'bmt-hall': { value: violator && violator.violates
        ? root.Format.exact(violator.set.length) + ' → ' + root.Format.exact(violator.neighbours.length)
        : 'none',
      note: violator && violator.violates
        ? 'that many left vertices share that many neighbours'
        : 'Hall\'s condition holds, so a perfect matching exists' },
      'bmt-agree': { value: compare.agree ? 'yes' : 'NO',
        note: compare.agree ? 'same size, and every one a real matching'
          : root.Format.exact(compare.disagreements) + ' size disagreements and ' +
            root.Format.exact(compare.invalid) + ' invalid results' }
    });
  }

  function paintMap(graph, structure) {
    view = function () { drawMap(graph, structure); };
    view();
  }

  function drawMap(graph, structure) {
    const host = root.jQuery('#bmt-map')[0];

    if (!host) return;
    const width = host.clientWidth || 620;
    const height = 320;
    const matched = new Set();

    structure.matching.matchLeft.forEach(function (partner, a) {
      if (partner === -1) return;
      matched.add(a + '>' + partner);
    });
    const drawn = { n: graph.left + graph.right,
      edges: graph.edges.map(function (edge) {
        return { from: edge.from, to: graph.left + edge.to };
      }) };
    const cover = new Set(coverIds(structure.cover, graph.left));

    root.GraphView.draw({ host: host, graph: drawn,
      positions: root.GraphView.bipartiteLayout(graph.left, graph.right, width, height),
      width: width, height: height,
      edgeClass: function (id) {
        return matched.has(graph.edges[id].from + '>' + graph.edges[id].to) ? 'path' : null;
      },
      nodeClass: function (v) { return cover.has(v) ? 'cut' : null; } });
    root.jQuery('#bmt-map-note').text('Left column proposes, right column receives. The strong edges ' +
      'are the ' + root.Format.exact(structure.matching.size) + ' matched pairs; the highlighted ' +
      'vertices are Koenig\'s minimum vertex cover, which has ' +
      root.Format.exact(structure.cover.size) + ' members and touches every one of the ' +
      root.Format.exact(graph.edges.length) + ' edges. That the two counts are equal is the theorem, ' +
      'and the picture is the proof: every cover vertex is an endpoint of a distinct matched edge.');
  }

  function coverIds(cover, left) {
    const ids = [];

    (cover.left || []).forEach(function (v) { ids.push(v); });
    (cover.right || []).forEach(function (v) { ids.push(left + v); });
    return ids;
  }

  function paintCompare(compare) {
    const html = compare.rows.map(function (row) {
      return '<tr><td>' + row.name + '</td>' +
        '<td class="mono">' + root.Format.exact(row.size) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.report.augmentingPaths || 0) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.report.phases || 0) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.report.edgesExamined || row.report.arcsExamined || 0) + '</td>' +
        '<td>' + (row.valid ? 'yes' : 'NO — ' + root.Format.exact(row.bogus) + ' bogus pairs') + '</td></tr>';
    }).join('');

    root.jQuery('#bmt-compare tbody').html(html);
    root.jQuery('#bmt-compare-note').text('The third row is the reduction from 14.1: source to every ' +
      'left vertex at capacity one, every edge at capacity one, every right vertex to the sink at ' +
      'capacity one. Integrality does the rest — a maximum flow of value k on a unit-capacity network ' +
      'is k edge-disjoint paths, which is a matching of size k. The size column is checked three ways ' +
      'and the validity column separately, because a matching algorithm fails by pairing a vertex ' +
      'twice or by returning an edge the graph does not contain.');
  }

  function paintStructure(graph, structure) {
    const violator = structure.violator;
    const rows = [
      { cells: ['maximum matching', root.Format.exact(structure.matching.size),
        'Hopcroft-Karp, ' + root.Format.exact(structure.matching.report.phases) + ' phases',
        structure.perfect ? 'perfect' : 'not perfect'] },
      { cells: ['minimum vertex cover (Koenig)', root.Format.exact(structure.cover.size),
        root.Format.exact((structure.cover.left || []).length) + ' left + ' +
          root.Format.exact((structure.cover.right || []).length) + ' right',
        structure.check.valid ? 'covers all ' + root.Format.exact(graph.edges.length) + ' edges'
          : root.Format.exact(structure.check.uncovered) + ' uncovered'] },
      { cells: ['maximum independent set', root.Format.exact(graph.left + graph.right - structure.cover.size),
        'the complement of the cover', 'n − cover, by definition'] }
    ];

    if (violator) {
      rows.push({ cells: ['Hall witness', root.Format.exact(violator.set.length) + ' left vertices',
        root.Format.exact(violator.neighbours.length) + ' neighbours between them',
        violator.violates ? 'condition VIOLATED — no perfect matching' : 'condition holds here'] });
    }
    root.MatrixView.render(root.jQuery('#bmt-structure')[0], {
      columns: ['Quantity', 'Size', 'How it was obtained', 'Checked'], rows: rows
    });
    root.jQuery('#bmt-structure-note').text(violator && violator.violates
      ? 'The witness is the useful half of Hall\'s condition. ' + root.Format.exact(violator.set.length) +
        ' left vertices have only ' + root.Format.exact(violator.neighbours.length) +
        ' neighbours between them, so at least ' +
        root.Format.exact(violator.set.length - violator.neighbours.length) +
        ' of them must go unmatched — and that is a proof, not a failed search. A boolean "no perfect ' +
        'matching" tells an operator nothing; this set tells them exactly which demand to relax.'
      : 'Hall\'s condition holds on this graph: every set of left vertices has at least as many ' +
        'neighbours as members, so a perfect matching exists and the search finds it. Switch to the ' +
        'deficiency or unbalanced shape to see the witness the alternating search returns when it ' +
        'does not.');
  }

  function paintSweep(rows, app) {
    const html = rows.map(function (row) {
      return '<tr><td class="mono">' + root.Format.exact(row.size) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.matching) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.phases) + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.root, 2) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.kuhnEdges) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.hkEdges) + '</td></tr>';
    }).join('');

    root.jQuery('#bmt-sweep tbody').html(html);
    drawSweepChart(rows, app);
    const last = rows[rows.length - 1];

    root.jQuery('#bmt-sweep-note').text('The phase count is what Hopcroft-Karp buys, and it barely ' +
      'moves: ' + root.Format.exact(rows[0].phases) + ' phases at ' + root.Format.exact(rows[0].size) +
      ' vertices a side and ' + root.Format.exact(last.phases) + ' at ' + root.Format.exact(last.size) +
      '. The edge columns are where that shows up as work — Kuhn examines ' +
      root.Format.exact(last.kuhnEdges) + ' edges on the largest row against Hopcroft-Karp\'s ' +
      root.Format.exact(last.hkEdges) + ', a ' + root.Format.fixed(last.kuhnEdges / last.hkEdges, 2) +
      '× saving, while on the smallest row Hopcroft-Karp is the more expensive of the two. That ' +
      'crossover is the honest version of "O(E√V) beats O(VE)".');
  }

  function drawSweepChart(rows, app) {
    const host = root.jQuery('#bmt-chart')[0];

    if (!host) return;
    root.GrowthPlot.render(host, {
      lazyLib: app.lazyLib,
      height: 240,
      logX: true,
      series: [
        { label: 'Kuhn — edges examined', points: rows.map(function (row) {
          return { x: row.size, y: row.kuhnEdges }; }) },
        { label: 'Hopcroft-Karp — edges examined', points: rows.map(function (row) {
          return { x: row.size, y: row.hkEdges }; }) }
      ],
      xLabel: 'vertices per side',
      yLabel: 'edges examined',
      legendHost: root.jQuery('#bmt-legend')[0],
      summary: function () {
        return 'Edges examined by each method as the graph grows, on a logarithmic size axis.';
      }
    });
  }

  function paintStable(stable) {
    const rows = [
      stableRow('the left side proposes', stable.byLeft, stable.leftBlocking.length,
        stable.leftRank, stable.same),
      stableRow('the right side proposes', stable.byRight, stable.rightBlocking.length,
        stable.rightRank, stable.same)
    ];

    root.jQuery('#bmt-stable-table tbody').html(rows.join(''));
    root.jQuery('#bmt-stable-note').text('Identical preferences, two runs, and both are stable — ' +
      'zero blocking pairs each, which is the only guarantee Gale-Shapley makes. What differs is who ' +
      'it serves. The rank column counts how far down its own list each left-side person ended up, ' +
      'and it is ' + root.Format.exact(stable.leftRank) + ' when they propose against ' +
      root.Format.exact(stable.rightRank) + ' when they are proposed to. Only ' +
      root.Format.exact(stable.same) + ' of ' + root.Format.exact(stable.size) +
      ' pairs survive the switch. Proposer-optimality is a real, measurable transfer, and choosing ' +
      'the proposing side is a product decision rather than an implementation detail.');
  }

  function stableRow(name, run, blocking, rank, same) {
    return '<tr><td>' + name + '</td>' +
      '<td class="mono">' + root.Format.exact(run.report.proposals) + '</td>' +
      '<td class="mono">' + root.Format.exact(run.report.rejections) + '</td>' +
      '<td class="mono">' + root.Format.exact(blocking) + '</td>' +
      '<td class="mono">' + root.Format.exact(rank) + '</td>' +
      '<td class="mono">' + root.Format.exact(same) + '</td></tr>';
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

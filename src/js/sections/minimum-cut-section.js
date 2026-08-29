/**
 * Section: minimum cut and its applications.
 *
 * The cut is worth far more than the flow value, and this section is three
 * demonstrations of that. An image segmentation is a minimum cut over a pixel
 * grid, and the smoothness term is what makes it robust: at 20% measurement
 * noise the cut misclassifies 10 pixels of 64 with no smoothing and none at
 * all once neighbours are worth 8.
 *
 * Project selection - "which items do I take to maximise profit, given that
 * each one drags in its prerequisites" - is maximum closure, which is a
 * minimum cut, and recognising that reduction is worth more than any flow
 * implementation. Every instance here is checked against a brute-force search
 * over all subsets, because a reduction that is subtly wrong produces a
 * perfectly valid cut of a graph that models the wrong problem.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'minimum-cut';
  const SMOOTH_STEPS = [0, 1, 2, 3, 5, 8, 12];
  const SHAPES = ['layered', 'grid', 'unit', 'bottleneck', 'bipartite'];
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
      title: 'Diagram — a cut, and why its capacity bounds the flow',
      caption: 'Split the vertices so the source is on one side and the sink on the other. Every unit ' +
        'of flow must cross that split at some point, so the flow can never exceed the total capacity ' +
        'of the arcs pointing across it. Max-flow min-cut says the smallest such split is exactly ' +
        'achievable, and the residual graph hands it to you for free.',
      definition: [
        'flowchart LR',
        '    subgraph S["source side"]',
        '      A["s"] --> B["a"]',
        '    end',
        '    subgraph T["sink side"]',
        '      C["b"] --> D["t"]',
        '    end',
        '    B ==>|"capacity 4, saturated"| C',
        '    A ==>|"capacity 3, saturated"| D',
        '    C -.->|"backwards: does not<br/>count"| B'
      ].join('\n')
    };
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        'An **s-t cut** splits the vertices so the source is on one side and the sink on the other, ' +
          'and its capacity is the total of the arcs pointing across it. Every unit of flow has to ' +
          'cross, so no flow can exceed any cut — and **max-flow min-cut** says the smallest cut is ' +
          'exactly achievable. The proof is the residual graph: when no augmenting path is left, take ' +
          'everything still reachable from the source, and every original arc leaving that set is ' +
          'saturated by construction.',
        'That makes the cut *constructible* rather than merely existent, which is what turns the ' +
          'theorem into an engineering tool. The flow value answers "how much"; the cut answers ' +
          '"which links, and what would I have to change". Note that arcs pointing *back* across the ' +
          'split contribute nothing to the capacity, which is why a cut in a directed network is not ' +
          'symmetric and why the reachable set is taken from the source rather than the sink.',
        '**Image segmentation is a minimum cut.** Give every pixel a source arc worth its likeness to ' +
          'the foreground, a sink arc worth its likeness to the background, and give neighbouring ' +
          'pixels an arc worth the penalty for disagreeing. The minimum cut is then the labelling that ' +
          'trades measurement against smoothness optimally, and the smoothness term is what makes the ' +
          'result robust to noise rather than a per-pixel threshold with speckles.',
        '**Project selection is a minimum cut too**, and this is the reduction worth carrying. Each ' +
          'profitable item gets a source arc worth its profit, each costly one a sink arc worth its ' +
          'cost, and each prerequisite an arc of *infinite* capacity — which is what forces any finite ' +
          'cut to respect it. The best achievable profit is then the total positive profit minus the ' +
          'minimum cut, and the chosen set is read straight off the source side.'
      ],
      demo: {
        title: 'Interactive demo — a segmentation, a project portfolio, and a vertex cover',
        markup: root.MinimumCutTemplate.render()
      },
      diagram: diagram(),
      insight: 'The skill this section is really about is noticing that a problem *is* a cut. Nobody ' +
        'arrives at work with a flow network; they arrive with "which features do we ship given the ' +
        'dependencies", "which pixels are the subject", "which of these accounts do we keep given ' +
        'that closing one closes its children". Each of those is maximum closure or a labelling ' +
        'problem, both of which are minimum cuts, and the whole difficulty is the modelling. Once the ' +
        'network is right, the algorithm is a library call and the answer is exact — which is a rare ' +
        'and valuable thing to be able to say about an optimisation problem.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.MinimumCutTemplate.controls,
      onChange: function () { update(); }
    });

    update();
  }

  /* -------------------------------------------------------------- fixtures */

  function imageSpec(parts, smooth) {
    return { shape: 'segmentation', rows: Number(parts[0]), columns: Number(parts[0]),
      noise: Number(parts[1]), smooth: smooth, seed: Number(parts[3]) };
  }

  function scoreLabels(graph, cut) {
    const pixels = graph.rows * graph.columns;
    let wrong = 0;
    let foreground = 0;

    for (let v = 0; v < pixels; v += 1) {
      const label = cut.side[v] ? 1 : 0;

      if (label) foreground += 1;

      if (label === graph.truth[v]) continue;
      wrong += 1;
    }
    return { wrong: wrong, foreground: foreground, pixels: pixels };
  }

  const imageFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const graph = root.FlowLab.build(imageSpec(parts, Number(parts[2])));
    const run = root.FlowLab.singleRun(graph, {});
    return { graph: graph, run: run, score: scoreLabels(graph, run.cut) };
  });

  const smoothingFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return SMOOTH_STEPS.map(function (smooth) {
      const graph = root.FlowLab.build(imageSpec(parts, smooth));
      const run = root.FlowLab.singleRun(graph, {});

      return { smooth: smooth, cut: run.cut.capacity, score: scoreLabels(graph, run.cut) };
    });
  });

  const projectsFor = root.Helpers.memoise(function (key) {
    const count = Number(key);
    const rows = [];

    for (let seed = 1; seed <= 5; seed += 1) {
      const instance = root.ReductionLab.projectInstance(seed, { count: count, links: count });
      const run = root.ReductionLab.closureToCut(instance);
      const positive = instance.profit.reduce(function (sum, value) {
        return value > 0 ? sum + value : sum;
      }, 0);

      rows.push({ seed: seed, positive: positive, cut: run.targetValue,
        profit: run.mapped.profit, chosen: run.mapped.chosen.length,
        direct: run.direct, valid: run.valid });
    }
    return rows;
  });

  const coverFor = root.Helpers.memoise(function () {
    const rows = [];

    for (let seed = 1; seed <= 4; seed += 1) {
      const instance = root.ReductionLab.bipartiteInstance(seed, {});
      const run = root.ReductionLab.coverToMatching(instance);

      rows.push({ seed: seed, edges: instance.edges.length, matching: run.targetValue,
        cover: run.mapped.size, valid: run.valid });
    }
    return rows;
  });

  const theoremFor = root.Helpers.memoise(function () {
    return SHAPES.map(function (shape) {
      const graph = root.FlowLab.build({ shape: shape, seed: 2 });
      const run = root.FlowLab.singleRun(graph, {});
      const flows = run.flows;
      const loose = run.cut.edges.filter(function (edge) {
        return flows[edge.id].flow < flows[edge.id].capacity;
      }).length;

      return { shape: shape, n: graph.n, value: run.value, capacity: run.cut.capacity,
        crossing: run.cut.edges.length, loose: loose };
    });
  });

  /* -------------------------------------------------------------- painting */

  function keyFor(values) {
    return values['cut-side'] + '|' + values['cut-noise'] + '|' + values['cut-smooth'] + '|' +
      values['cut-seed'];
  }

  function update() {
    const values = panel.values();
    const state = imageFor(keyFor(values));
    const projects = projectsFor(String(values['cut-projects']));

    paintMetrics(state, projects);
    paintImage(state);
    paintSmoothing(smoothingFor(keyFor(values)));
    paintSelection(projects);
    paintCover(coverFor('fixed'));
    paintTheorem(theoremFor('fixed'));
  }

  function paintMetrics(state, projects) {
    const best = projects[0];

    root.MetricGrid.update({
      'cut-capacity': { value: root.Format.exact(state.run.cut.capacity),
        note: 'the maximum flow is ' + root.Format.exact(state.run.value) +
          (state.run.cut.capacity === state.run.value ? ' — equal, as the theorem says'
            : ' — THEY DIFFER, which is a bug') },
      'cut-wrong': { value: root.Format.exact(state.score.wrong),
        note: root.Format.fixed(100 * state.score.wrong / state.score.pixels, 1) + '% of ' +
          root.Format.exact(state.score.pixels) + ' pixels' },
      'cut-profit': { value: root.Format.exact(best.profit),
        note: root.Format.exact(best.positive) + ' available minus a cut of ' +
          root.Format.exact(best.cut) },
      'cut-oracle': { value: projects.every(function (row) { return row.valid; }) ? 'yes' : 'NO',
        note: 'five portfolios, every subset tested for closure' }
    });
  }

  function paintImage(state) {
    view = function () { drawImage(state); };
    view();
  }

  function drawImage(state) {
    const host = root.jQuery('#cut-image')[0];

    if (!host) return;
    const graph = state.graph;
    const columns = graph.columns;
    const cells = [];

    for (let v = 0; v < graph.rows * columns; v += 1) {
      const label = state.run.cut.side[v] ? 1 : 0;

      cells.push({ label: label, truth: graph.truth[v], intensity: graph.intensity[v] });
    }
    root.jQuery(host).html(imageMarkup(cells, columns));
    root.jQuery('#cut-image-note').text('Each square is a pixel: filled means the cut put it on the ' +
      'source side (foreground). A ringed square is one the cut got wrong against the labels the ' +
      'image was generated from — ' + root.Format.exact(state.score.wrong) + ' of ' +
      root.Format.exact(state.score.pixels) + '. Raise the smoothness and they disappear; raise the ' +
      'noise and they come back.');
  }

  function imageMarkup(cells, columns) {
    const rows = [];

    for (let r = 0; r * columns < cells.length; r += 1) {
      const squares = cells.slice(r * columns, (r + 1) * columns).map(function (cell) {
        const wrong = cell.label !== cell.truth;

        return '<span class="pixel-cell' + (cell.label ? ' pixel-on' : '') +
          (wrong ? ' pixel-wrong' : '') + '" title="intensity ' + cell.intensity + '"></span>';
      }).join('');

      rows.push('<div class="pixel-row">' + squares + '</div>');
    }
    return '<div class="pixel-grid">' + rows.join('') + '</div>';
  }

  function paintSmoothing(rows) {
    const html = rows.map(function (row) {
      return '<tr><td class="mono">' + root.Format.exact(row.smooth) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.cut) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.score.foreground) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.score.wrong) + '</td>' +
        '<td class="mono">' + root.Format.fixed(100 * row.score.wrong / row.score.pixels, 1) +
        '%</td></tr>';
    }).join('');

    root.jQuery('#cut-smoothing tbody').html(html);
    root.jQuery('#cut-smoothing-note').text('At smoothness zero every pixel is thresholded on its own ' +
      'measurement, so every noisy pixel is a speckle. Raising the penalty for disagreeing with a ' +
      'neighbour makes an isolated flip cost more than it saves, and the cut overrules it. The cut ' +
      'capacity rises the whole way, which is the point worth noticing: the objective is getting ' +
      'worse while the answer is getting better, because the objective is a model rather than the truth.');
  }

  function paintSelection(rows) {
    const html = rows.map(function (row) {
      return '<tr><td class="mono">seed ' + row.seed + '</td>' +
        '<td class="mono">' + root.Format.exact(row.positive) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.cut) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.profit) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.chosen) + '</td>' +
        '<td>' + (row.valid ? 'yes' : 'NO') + '</td></tr>';
    }).join('');

    root.jQuery('#cut-selection tbody').html(html);
    root.jQuery('#cut-selection-note').text('Profitable projects hang off the source, costly ones off ' +
      'the sink, and every prerequisite is an arc of infinite capacity — so no finite cut can separate ' +
      'a project from something it needs. The realised profit is the positive total minus the cut, ' +
      'and every row is checked against a search over all 2^n subsets, because a reduction that is ' +
      'subtly wrong produces a perfectly valid cut of the wrong graph.');
  }

  function paintCover(rows) {
    root.MatrixView.render(root.jQuery('#cut-cover')[0], {
      columns: ['Instance', 'Edges', 'Maximum matching', 'Minimum vertex cover', 'Cover is valid?'],
      rows: rows.map(function (row) {
        return { cells: ['seed ' + row.seed, root.Format.exact(row.edges),
          root.Format.exact(row.matching), root.Format.exact(row.cover),
          row.valid ? 'yes' : 'NO'] };
      })
    });
    root.jQuery('#cut-cover-note').text('Koenig\'s theorem: on a bipartite graph the maximum matching ' +
      'and the minimum vertex cover are the same size, and an alternating search turns one into the ' +
      'other. That equality is a min-cut statement in disguise — the matching is a unit-capacity flow ' +
      'and the cover is its cut. On a general graph it is false and minimum vertex cover is NP-hard, ' +
      'which is a boundary worth knowing exactly.');
  }

  function paintTheorem(rows) {
    const html = rows.map(function (row) {
      return '<tr><td>' + row.shape + '</td>' +
        '<td class="mono">' + root.Format.exact(row.n) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.value) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.capacity) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.crossing) + '</td>' +
        '<td>' + (row.loose === 0 ? 'yes' : root.Format.exact(row.loose) + ' are NOT') + '</td></tr>';
    }).join('');

    root.jQuery('#cut-theorem tbody').html(html);
    root.jQuery('#cut-theorem-note').text('Five network shapes, five equalities, and every arc ' +
      'crossing the cut carrying exactly its capacity. The last column is the one that would catch a ' +
      'broken cut extraction: a set that separates source from sink but leaves a crossing arc with ' +
      'spare capacity is not a minimum cut, and its capacity would exceed the flow rather than match it.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

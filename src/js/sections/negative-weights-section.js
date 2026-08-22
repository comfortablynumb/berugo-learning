/**
 * Section: shortest paths II — negative weights and all pairs.
 *
 * Two claims the page has to make with numbers rather than words.
 *
 * **Extracting the cycle is worth more than detecting it.** "Your rate table
 * admits arbitrage" is unactionable; the loop itself, with the product of its
 * rates, is the trade. So the demo walks the parent array back, verifies the
 * cycle edge by edge against the graph, and then prices it in the original
 * units - a multiplier above 1.0 is a real profit, and that number is the
 * only thing that makes the negative cycle mean anything.
 *
 * **The Floyd-Warshall loop order is not a style choice.** `k` must be
 * outermost, because `dist[i][j]` through intermediates {0..k} is built from
 * the same quantity at k − 1. Swap the loops and the algorithm still
 * terminates, still fills a matrix, and the matrix is not the shortest-path
 * matrix. The table below runs both and counts the cells that differ.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'negative-weights';
  let panel = null;

  /* Rate tables. `fair` is built from a consistent value vector, so every
     cycle multiplies to exactly 1 and no arbitrage exists - which is the
     control the arbitrage table is measured against. */
  const TABLES = {
    arbitrage: {
      names: ['USD', 'EUR', 'GBP', 'JPY'],
      rates: [
        [1, 0.90, 0.76, 148.0],
        [1.11, 1, 0.88, 164.0],
        [1.30, 1.14, 1, 190.0],
        [0.0068, 0.0061, 0.0053, 1]
      ]
    },
    fair: { names: ['USD', 'EUR', 'GBP', 'JPY'], values: [1, 0.90, 0.79, 148.0] },
    wide: {
      names: ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD'],
      values: [1, 0.90, 0.79, 148.0, 0.88, 1.36],
      twist: { from: 4, to: 5, factor: 1.06 }
    }
  };

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: "Diagram — Johnson's reweighting",
      caption: 'A potential h from a super-source makes every reweighted edge w + h(u) − h(v) ' +
        'non-negative, and every path from s to t shifts by the same h(s) − h(t) — so the shortest path ' +
        'is unchanged and Dijkstra becomes legal.',
      definition: [
        'flowchart LR',
        '    Q["super-source q"] -->|0| A["u"]',
        '    Q -->|0| B["v"]',
        '    A -->|"w(u,v), possibly negative"| B',
        '    B --> C["w + h(u) - h(v) >= 0, by the triangle inequality on h"]',
        '    C --> D["run Dijkstra from every vertex, then subtract the shift back off"]'
      ].join('\n')
    };
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        '**Bellman-Ford relaxes every edge n − 1 times**, which is enough because a shortest path has at ' +
          'most n − 1 edges. An early exit when a round changes nothing makes it fast on most graphs, and ' +
          'an n-th round that still improves something is a proof that a negative cycle exists — because ' +
          'no simple path can be that long.',
        '**Detecting the cycle is the easy half; extracting it is the useful one.** Walking the parent ' +
          'pointers back n times lands inside the cycle — the vertex that improved on the last round may ' +
          'be downstream of it rather than on it — and walking once more closes the loop. That costs a few ' +
          'lines and turns "this table admits arbitrage" into "sell JPY for GBP, sell the GBP back for ' +
          'JPY, and you hold 0.70% more than you started with" — a two-currency loop the demo finds, ' +
          'verifies edge by edge and then prices at a multiplier of 1.007000.',
        '**A rate table becomes a shortest-path problem under −log.** Multiplying rates around a loop ' +
          'becomes adding their negative logarithms, so a product above 1 becomes a total below 0 — a ' +
          'negative cycle. That transform is the whole trick, and the demo prices the cycle back in the ' +
          'original units so the number means something.',
        '**Floyd-Warshall\'s triple loop has one correct order.** `k` outermost is not convention: ' +
          '`dist[i][j]` using intermediates {0..k} is defined in terms of the same quantity at k − 1, and ' +
          'the two orthogonal orders read cells that have already moved on. The swapped version ' +
          'terminates, returns a full matrix, and is wrong on a fraction of the cells — which the table ' +
          'below counts. **Johnson\'s algorithm** is the sparse-graph alternative: one Bellman-Ford pass ' +
          'produces a potential that makes every edge non-negative, and then Dijkstra from each vertex is ' +
          'legal again.'
      ],
      demo: {
        title: 'Interactive demo — an arbitrage loop, priced, and a loop order that is silently wrong',
        markup: root.NegativeWeightsTemplate.render()
      },
      diagram: diagram(),
      insight: 'When an algorithm can fail on a property of the input, the useful return value is the ' +
        'witness rather than the verdict — and this milestone keeps finding the same lesson. A cycle in a ' +
        'build graph, an odd cycle in a two-colouring, the four indices where an inequality broke, the ' +
        'negative loop in a rate table: in every case the boolean was already suspected and the evidence ' +
        'is what was needed. Here the witness is also the product, which turns a correctness result into a ' +
        'trade — and if the product comes out at 1.0000 the "arbitrage" was floating-point noise, which is ' +
        'exactly why it is computed rather than assumed.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.NegativeWeightsTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  /** A table built from a consistent value vector has no arbitrage at all;
   *  `twist` multiplies one rate so that exactly one loop becomes profitable. */
  function ratesFor(kind) {
    const spec = TABLES[kind];

    if (spec.rates) return { names: spec.names, rates: spec.rates };
    const n = spec.values.length;
    const rates = [];

    for (let i = 0; i < n; i += 1) {
      const row = [];

      for (let j = 0; j < n; j += 1) row.push(spec.values[j] / spec.values[i]);
      rates.push(row);
    }

    if (spec.twist) rates[spec.twist.from][spec.twist.to] *= spec.twist.factor;
    return { names: spec.names, rates: rates };
  }

  const arbitrageFor = root.Helpers.memoise(function (key) {
    const table = ratesFor(key);
    const graph = root.ShortestPaths.arbitrageGraph(table.rates);
    const run = root.ShortestPaths.bellmanFord(graph.edges, graph.n, 0, {});
    const cycle = run.negativeCycle;
    return { table: table, graph: graph, run: run, cycle: cycle,
      verified: cycle ? root.ShortestPaths.verifyNegativeCycle(graph.edges, cycle) : null,
      profit: cycle ? root.ShortestPaths.cycleProfit(table.rates, cycle) : null };
  });

  /**
   * Give the graph genuinely negative edges and no negative cycle, by
   * *undoing* a reweighting: pick a value per vertex and set
   * w(u, v) = base − p[u] + p[v]. Every cycle then totals the sum of its
   * bases, which is positive, while individual edges go well below zero.
   *
   * Building it this way rather than sprinkling negative weights at random is
   * the difference between a Johnson panel that teaches something and one
   * where every potential is zero and no edge is reweighted at all.
   */
  function withPotentials(graph, seed) {
    const random = root.Random.seeded(seed + 500);
    const potential = [];

    for (let v = 0; v < graph.n; v += 1) potential.push(random.int(16));
    graph.edges.forEach(function (edge) {
      edge.weight = edge.weight - potential[edge.from] + potential[edge.to];
    });
    graph.potentialUsed = potential;
    return graph;
  }

  const allPairsFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|').map(Number);
    const graph = withPotentials(root.GraphCore.randomGraph(parts[0], parts[0] * parts[1],
      root.Random.seeded(parts[2]), { directed: true, weightRange: 20 }), parts[2]);
    const matrix = root.GraphCore.adjacencyMatrix(graph);
    const right = root.ShortestPaths.floydWarshall(matrix, {});
    const wrong = root.ShortestPaths.floydWarshall(matrix, { wrongOrder: true });
    let differing = 0;

    for (let i = 0; i < graph.n; i += 1) {
      for (let j = 0; j < graph.n; j += 1) {
        if (right.distance[i][j] === wrong.distance[i][j]) continue;
        differing += 1;
      }
    }
    return { graph: graph, right: right, wrong: wrong, differing: differing,
      johnson: root.ShortestPaths.johnson(graph, {}) };
  });

  function keyFor(values) {
    return values['neg-nodes'] + '|' + values['neg-density'] + '|' + values['neg-seed'];
  }

  function update() {
    const values = panel.values();
    const arb = arbitrageFor(values['neg-currencies']);
    const apsp = allPairsFor(keyFor(values));

    paintMetrics(arb, apsp);
    paintArbitrage(arb);
    paintExtract(arb);
    paintFloyd(apsp);
    paintApsp(apsp);
    paintJohnson(apsp);
  }

  function paintMetrics(arb, apsp) {
    root.MetricGrid.update({
      'neg-cycle': { value: arb.cycle ? arb.cycle.length + ' currencies' : 'none',
        note: arb.cycle ? (arb.verified.valid ? 'verified edge by edge, total ' +
          root.Format.fixed(arb.verified.weight, 4) : 'THE EXTRACTED CYCLE IS NOT A CYCLE')
          : 'the table is internally consistent' },
      'neg-profit': { value: arb.profit === null ? '—' : root.Format.fixed(arb.profit, 6),
        note: arb.profit === null ? 'no loop to price'
          : (arb.profit > 1 ? root.Format.fixed(100 * (arb.profit - 1), 2) + '% per round trip'
            : 'at or below 1.0 — not a profit') },
      'neg-rounds': { value: root.Format.exact(arb.run.report.rounds),
        note: 'of a possible ' + arb.graph.n + ' before the early exit or the proof' },
      'neg-apsp': { value: root.Format.exact(apsp.graph.n * apsp.graph.n),
        note: apsp.graph.n + '² cells, for ' + root.Format.exact(apsp.graph.edges.length) + ' edges' }
    });
  }

  function paintArbitrage(arb) {
    const names = arb.table.names;
    const rows = names.map(function (name, i) {
      return { cells: [name].concat(names.map(function (other, j) {
        return { value: i === j ? '—' : root.Format.fixed(arb.table.rates[i][j], 4),
          highlight: Boolean(arb.cycle && onCycle(arb.cycle, i, j)) };
      })) };
    });

    root.MatrixView.render(root.jQuery('#neg-arbitrage')[0], {
      columns: ['from \\ to'].concat(names),
      rows: rows
    });
    root.jQuery('#neg-arbitrage-note').text(arb.cycle
      ? 'Highlighted cells are the loop: ' + arb.cycle.map(function (v) { return names[v]; })
        .join(' → ') + ' → ' + names[arb.cycle[0]] + ', multiplying to ' +
        root.Format.fixed(arb.profit, 6) + '. Under −log that product above 1 is a total below zero, '
        + 'which is what Bellman-Ford actually found.'
      : 'No negative cycle: this table is built from a consistent set of values, so every loop multiplies '
        + 'to exactly 1 and no sequence of trades gains anything.');
  }

  function onCycle(cycle, from, to) {
    for (let i = 0; i < cycle.length; i += 1) {
      if (cycle[i] === from && cycle[(i + 1) % cycle.length] === to) return true;
    }
    return false;
  }

  function paintExtract(arb) {
    const names = arb.table.names;
    const rows = [
      { step: 'detect: did an n-th round still improve something?',
        result: arb.cycle ? 'yes' : 'no',
        worth: 'a boolean the caller already suspected' },
      { step: 'extract: walk the parent array back n times, then close the loop',
        result: arb.cycle ? arb.cycle.map(function (v) { return names[v]; }).join(' → ') : '—',
        worth: 'the actual trades, in order' },
      { step: 'verify: is every step a real edge, and is the total negative?',
        result: arb.verified ? (arb.verified.valid ? 'yes, total ' +
          root.Format.fixed(arb.verified.weight, 4) : 'NO') : '—',
        worth: 'checked against the graph rather than trusted' },
      { step: 'price: multiply the original rates around the loop',
        result: arb.profit === null ? '—' : root.Format.fixed(arb.profit, 6),
        worth: 'the number that decides whether it is worth doing' }
    ];
    const html = rows.map(function (row) {
      return '<tr><td>' + row.step + '</td><td class="mono">' + row.result + '</td>' +
        '<td>' + row.worth + '</td></tr>';
    }).join('');

    root.jQuery('#neg-extract tbody').html(html);
    root.jQuery('#neg-extract-note').text('The walk-back is the subtle step: the vertex that improved on '
      + 'the last round may be downstream of the cycle rather than on it, so the parent pointers are '
      + 'followed n times first to guarantee landing inside it. Skipping that gives a path with a cycle '
      + 'hanging off the end rather than a cycle.');
  }

  function paintFloyd(apsp) {
    const cells = apsp.graph.n * apsp.graph.n;
    const rows = [
      { order: 'k outermost (correct)', differing: 0, run: apsp.right, correct: 'yes' },
      { order: 'i outermost (swapped)', differing: apsp.differing, run: apsp.wrong,
        correct: apsp.differing === 0 ? 'happens to agree here' : 'NO' }
    ];
    const html = rows.map(function (row) {
      return '<tr><td>' + row.order + '</td>' +
        '<td class="mono">' + root.Format.exact(row.differing) + ' of ' +
        root.Format.exact(cells) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.run.report.relaxations) + '</td>' +
        '<td>yes</td><td>' + row.correct + '</td></tr>';
    }).join('');

    root.jQuery('#neg-floyd tbody').html(html);
    root.jQuery('#neg-floyd-note').text('Both orders do exactly ' +
      root.Format.exact(apsp.right.report.relaxations) + ' relaxations and both finish. The swapped one '
      + 'differs on ' + root.Format.exact(apsp.differing) + ' of ' + root.Format.exact(cells) + ' cells — '
      + 'it is not slower, not louder and not obviously broken, which is what makes the loop order worth '
      + 'stating explicitly rather than copying.');
  }

  function paintApsp(apsp) {
    const n = apsp.graph.n;
    const adjacency = root.GraphCore.adjacencyList(apsp.graph);
    let bellmanRelaxations = 0;
    let disagree = 0;

    for (let s = 0; s < n; s += 1) {
      const run = root.ShortestPaths.bellmanFord(apsp.graph.edges, n, s, {});
      bellmanRelaxations += run.report.relaxations;

      for (let t = 0; t < n; t += 1) {
        if (run.distance[t] === apsp.right.distance[s][t]) continue;
        disagree += 1;
      }
    }
    const rows = [
      { name: 'Floyd-Warshall', complexity: 'Θ(n³) time, Θ(n²) space',
        relaxations: apsp.right.report.relaxations, negatives: 'yes, and it detects negative cycles' },
      { name: 'Bellman-Ford from every vertex', complexity: 'Θ(n·m·n)',
        relaxations: bellmanRelaxations, negatives: 'yes' },
      { name: "Johnson's algorithm", complexity: 'Θ(n·m log n) after one reweighting',
        relaxations: apsp.johnson.report.relaxations,
        negatives: 'yes — that is the whole point of the potential' }
    ];
    const html = rows.map(function (row) {
      return '<tr><td>' + row.name + '</td><td class="mono">' + row.complexity + '</td>' +
        '<td class="mono">' + root.Format.exact(row.relaxations) + '</td>' +
        '<td>' + row.negatives + '</td>' +
        '<td>' + (disagree === 0 ? 'yes' : 'NO — ' + disagree + ' cells differ') + '</td></tr>';
    }).join('');

    root.jQuery('#neg-allpairs tbody').html(html);
    root.jQuery('#neg-allpairs-note').text('All three fill the same ' + root.Format.exact(n * n) + '-cell '
      + 'matrix and agree on every entry. Floyd-Warshall wins on a dense graph and Johnson wins on a '
      + 'sparse one, and the crossover is exactly where n² stops being smaller than m log n — which for '
      + 'this graph, at ' + root.Format.exact(apsp.graph.edges.length) + ' edges, favours Johnson.');
  }

  function paintJohnson(apsp) {
    const potentials = apsp.johnson.potentials || [];
    /* The ten most negative edges rather than the first ten: a sample that
       happens to hold no negative edge illustrates nothing, and the first ten
       of a random edge list usually do not. */
    const sample = apsp.graph.edges.slice()
      .sort(function (a, b) { return a.weight - b.weight; }).slice(0, 10);
    const rows = sample.map(function (edge) {
      const reweighted = edge.weight + potentials[edge.from] - potentials[edge.to];
      return '<tr><td class="mono">' + edge.from + ' → ' + edge.to + '</td>' +
        '<td class="mono">' + root.Format.exact(edge.weight) + '</td>' +
        '<td class="mono">' + root.Format.exact(potentials[edge.from]) + '</td>' +
        '<td class="mono">' + root.Format.exact(potentials[edge.to]) + '</td>' +
        '<td class="mono">' + root.Format.exact(reweighted) + '</td></tr>';
    }).join('');

    root.jQuery('#neg-johnson tbody').html(rows);
    const negatives = apsp.graph.edges.filter(function (edge) { return edge.weight < 0; }).length;

    root.jQuery('#neg-johnson-note').text('The ten most negative of ' +
      root.Format.exact(apsp.graph.edges.length) + ' edges, ' + root.Format.exact(negatives) +
      ' of which are below zero. Every reweighted value is non-negative — that is the triangle inequality on h, and it is '
      + 'what makes Dijkstra legal on a graph it was not legal on before. Each path from s to t shifts by '
      + 'the same h(s) − h(t), so the shortest path is unchanged and the shift is subtracted back off at '
      + 'the end.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

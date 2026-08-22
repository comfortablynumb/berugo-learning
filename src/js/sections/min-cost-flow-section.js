/**
 * Section: minimum-cost flow and assignment.
 *
 * The point of the section is that the potential is Johnson's reweighting from
 * M13.6, unchanged. A residual graph has negative arcs by construction, so
 * Dijkstra is illegal on it; one Bellman-Ford pass produces a potential that
 * makes every reduced cost non-negative, and each augmentation updates the
 * potential with the distances Dijkstra just returned. After that, min-cost
 * flow is Dijkstra in a loop.
 *
 * Three routes to the same answer are shown because a cost is exactly the kind
 * of number that looks right when it is not: successive shortest paths, cycle
 * cancelling from a completely different theorem, and the Hungarian algorithm
 * with a dual certificate. Below eight workers a brute-force search over every
 * permutation joins them.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'min-cost-flow';
  const BRUTE_LIMIT = 8;
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — the potential that makes Dijkstra legal again',
      caption: 'Every residual graph has negative arcs: the twin of a cost-c arc costs −c. A potential ' +
        'h with h(v) ≤ h(u) + w(u, v) makes the reduced cost w + h(u) − h(v) non-negative on every ' +
        'arc, and every path from s to t shifts by the same h(s) − h(t) — so the cheapest path is ' +
        'unchanged and Dijkstra may be used.',
      definition: [
        'flowchart LR',
        '    A["arc u → v, cost 4"] --> B["residual twin v → u, cost −4"]',
        '    B --> C["Dijkstra is illegal here"]',
        '    C --> D["one Bellman-Ford gives h"]',
        '    D --> E["reduced cost = w + h(u) − h(v) ≥ 0"]',
        '    E --> F["every later augmentation updates h<br/>with the distances Dijkstra just found"]'
      ].join('\n')
    };
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        'A minimum-cost flow problem adds a **cost per unit** to every arc and asks for the cheapest ' +
          'way to send a required amount. **Successive shortest paths** does the obvious thing: send ' +
          'each unit along the cheapest route currently available. That is correct because after ' +
          'augmenting along a cheapest path, no cheaper route to anything appears — but doing it ' +
          'needs shortest paths in a graph that has negative arcs.',
        '**The residual graph always has negative arcs.** The twin of a cost-c arc costs −c, because ' +
          'undoing a routing decision refunds what it charged. So Dijkstra is not merely slow here, ' +
          'it is invalid — and the fix is exactly Johnson\'s reweighting from the previous milestone. ' +
          'One Bellman-Ford pass yields a potential h making every reduced cost `w + h(u) − h(v)` ' +
          'non-negative, and every path between two vertices shifts by the same amount, so the ' +
          'cheapest one is unchanged.',
        '**Bellman-Ford is needed exactly once.** After each augmentation the potential is updated by ' +
          'adding the distances Dijkstra just computed, which restores the non-negativity for the new ' +
          'residual graph. That is the whole algorithm: one slow pass, then a Dijkstra per unit of ' +
          'flow. And it is only well posed when the input has no negative-cost *cycle* — flow could ' +
          'be routed round one for ever, so the solver refuses rather than looping.',
        '**The assignment problem is this in a costume.** A square cost matrix becomes a bipartite ' +
          'network with unit capacities, a maximum flow is a perfect assignment, and the minimum-cost ' +
          'one is the optimal assignment. The Hungarian algorithm solves the same problem directly ' +
          'while maintaining a dual — a value per row and per column, never exceeding the cell they ' +
          'meet at, and tight on every chosen cell — which is a *certificate* rather than a second ' +
          'opinion.'
      ],
      demo: {
        title: 'Interactive demo — an assignment three ways, and the potential doing its work',
        markup: root.MinCostFlowTemplate.render()
      },
      diagram: diagram(),
      insight: 'When a cost function makes a routing or matching problem look hard, the first question ' +
        'is whether the costs can go negative and the second is whether a negative *cycle* can exist. ' +
        'Negative arcs are fine and are handled by one reweighting; a negative cycle means there is ' +
        'no minimum at all and the honest response is to refuse. That distinction is easy to state ' +
        'and easy to skip, and skipping it is how a solver ends up running for ever on a cost model ' +
        'somebody adjusted last Tuesday — which is why the module here detects it rather than ' +
        'trusting the caller.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.MinCostFlowTemplate.controls,
      onChange: function () { update(); }
    });

    update();
  }

  /* -------------------------------------------------------------- fixtures */

  function matrixFor(size, spread, seed) {
    const random = root.Random.seeded(seed);
    const out = [];

    for (let row = 0; row < size; row += 1) {
      const cells = [];

      for (let column = 0; column < size; column += 1) cells.push(1 + random.int(spread));
      out.push(cells);
    }
    return out;
  }

  function bruteForce(matrix) {
    const size = matrix.length;

    if (size > BRUTE_LIMIT) return null;
    const order = [];

    for (let i = 0; i < size; i += 1) order.push(i);
    let best = Infinity;

    const search = function (at) {
      if (at === size) {
        best = Math.min(best, order.reduce(function (sum, column, row) {
          return sum + matrix[row][column];
        }, 0));
        return;
      }

      for (let i = at; i < size; i += 1) {
        const swap = order[at];

        order[at] = order[i];
        order[i] = swap;
        search(at + 1);
        const back = order[at];

        order[at] = order[i];
        order[i] = back;
      }
    };

    search(0);
    return best;
  }

  const assignmentFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|').map(Number);
    const matrix = matrixFor(parts[0], parts[1], parts[2]);
    const spec = root.MinCostFlow.assignmentNetwork(matrix);
    const ssp = root.MinCostFlow.successiveShortestPaths(spec, spec.source, spec.sink, {});
    const cancelling = root.MinCostFlow.cycleCancelling(spec, spec.source, spec.sink, {});
    const hungarian = root.WeightedMatching.hungarian(matrix, {});

    return { matrix: matrix, spec: spec, ssp: ssp, cancelling: cancelling, hungarian: hungarian,
      chosen: root.MinCostFlow.assignmentFrom(ssp.network, matrix.length),
      brute: bruteForce(matrix),
      certificate: root.WeightedMatching.checkHungarian(matrix, hungarian),
      optimal: root.MinCostFlow.checkOptimal(ssp.network) };
  });

  const generalFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const n = Number(parts[0]);
    const random = root.Random.seeded(7);
    const potential = [];

    for (let v = 0; v < n; v += 1) potential.push(random.int(12));
    const edges = [];
    const seen = {};
    const add = function (a, b) {
      const key2 = a + '>' + b;

      if (a === b || seen[key2]) return;
      seen[key2] = true;
      const base = 1 + random.int(15);

      edges.push({ from: a, to: b, capacity: 1 + random.int(8),
        cost: parts[1] === 'true' ? base - potential[a] + potential[b] : base });
    };

    /* A spine from source to sink first: purely random arcs leave the sink
       unreachable often enough that the panel reads "0 units at cost 0",
       which demonstrates nothing about costs. */
    for (let v = 0; v + 1 < n; v += 1) add(v, v + 1);

    for (let i = 0; i < n * 3; i += 1) add(random.int(n), random.int(n));
    const graph = { n: n, edges: edges };
    const ssp = root.MinCostFlow.successiveShortestPaths(graph, 0, n - 1, {});
    const cancelling = root.MinCostFlow.cycleCancelling(graph, 0, n - 1, {});

    return { graph: graph, ssp: ssp, cancelling: cancelling,
      negatives: edges.filter(function (edge) { return edge.cost < 0; }).length };
  });

  const curveFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|').map(Number);
    const matrix = matrixFor(parts[0], parts[1], parts[2]);
    const spec = root.MinCostFlow.assignmentNetwork(matrix);
    const rows = [];
    let previous = 0;

    for (let flow = 1; flow <= matrix.length; flow += 1) {
      const run = root.MinCostFlow.successiveShortestPaths(spec, spec.source, spec.sink,
        { flowLimit: flow });

      rows.push({ flow: run.flow, cost: run.cost, marginal: run.cost - previous,
        dijkstras: run.report.dijkstraRuns });
      previous = run.cost;
    }
    return rows;
  });

  /* -------------------------------------------------------------- painting */

  function keyFor(values) {
    return values['mcf-size'] + '|' + values['mcf-spread'] + '|' + values['mcf-seed'];
  }

  function update() {
    const values = panel.values();
    const state = assignmentFor(keyFor(values));

    paintMetrics(state);
    paintMatrix(state);
    paintRoutes(state);
    paintReduced(state);
    paintGeneral(generalFor(values['mcf-nodes'] + '|' + String(values['mcf-negative'])));
    paintCurve(curveFor(keyFor(values)));
  }

  function paintMetrics(state) {
    root.MetricGrid.update({
      'mcf-cost': { value: root.Format.exact(state.ssp.cost),
        note: root.Format.exact(state.matrix.length) + ' workers covering ' +
          root.Format.exact(state.matrix.length) + ' jobs' },
      'mcf-brute': { value: state.brute === null ? 'not run above ' + BRUTE_LIMIT + ' workers'
        : (state.brute === state.ssp.cost ? 'yes' : 'NO'),
      note: state.brute === null ? 'the permutation count is factorial'
        : root.Format.exact(state.brute) + ' from every permutation' },
      'mcf-dijkstras': { value: root.Format.exact(state.ssp.report.dijkstraRuns),
        note: root.Format.exact(state.ssp.report.bellmanFordRuns) +
          ' Bellman-Ford passes — costs here are non-negative, so none is needed' },
      'mcf-optimal': { value: state.optimal.optimal ? 'yes' : 'NO',
        note: 'a flow is minimum-cost for its value exactly when its residual has no negative cycle' }
    });
  }

  function paintMatrix(state) {
    const size = state.matrix.length;
    const columns = ['worker'];

    for (let job = 0; job < size; job += 1) columns.push('job ' + job);
    const rows = state.matrix.map(function (cells, worker) {
      return { cells: [String(worker)].concat(cells.map(function (value, job) {
        return job === state.chosen[worker] ? '[' + value + ']' : String(value);
      })) };
    });

    root.MatrixView.render(root.jQuery('#mcf-matrix')[0], { columns: columns, rows: rows });
    root.jQuery('#mcf-matrix-note').text('The bracketed cell in each row is the job that worker took. ' +
      'The total is ' + root.Format.exact(state.ssp.cost) + ', and there are ' +
      root.Format.exact(factorial(size)) + ' possible assignments — which is why the brute-force ' +
      'column stops at ' + BRUTE_LIMIT + ' workers and the algorithm does not.');
  }

  function factorial(n) {
    let out = 1;

    for (let i = 2; i <= n; i += 1) out *= i;
    return out;
  }

  function paintRoutes(state) {
    const rows = [
      { name: 'successive shortest paths', cost: state.ssp.cost,
        work: root.Format.exact(state.ssp.report.dijkstraRuns) + ' Dijkstra runs, ' +
          root.Format.exact(state.ssp.report.relaxations) + ' relaxations',
        certificate: state.optimal.optimal ? 'no negative residual cycle' : 'NONE' },
      { name: 'cycle cancelling', cost: state.cancelling.cost,
        work: root.Format.exact(state.cancelling.report.cyclesCancelled) + ' cycles cancelled, ' +
          root.Format.exact(state.cancelling.report.bellmanFordRuns) + ' Bellman-Ford passes',
        certificate: 'a different theorem entirely' },
      { name: 'Hungarian algorithm', cost: state.hungarian.cost,
        work: root.Format.exact(state.hungarian.report.phases) + ' phases, ' +
          root.Format.exact(state.hungarian.report.comparisons) + ' comparisons',
        certificate: state.certificate.valid ? 'row and column duals, tight on every chosen cell'
          : 'DUAL CERTIFICATE FAILED' }
    ];
    const html = rows.map(function (row) {
      return '<tr><td>' + row.name + '</td>' +
        '<td class="mono">' + root.Format.exact(row.cost) + '</td>' +
        '<td class="mono">' + row.work + '</td>' +
        '<td>' + row.certificate + '</td>' +
        '<td>' + (row.cost === rows[0].cost ? 'yes' : 'NO') + '</td></tr>';
    }).join('');

    root.jQuery('#mcf-routes tbody').html(html);
    root.jQuery('#mcf-routes-note').text('Three derivations, one number. The Hungarian row is the one ' +
      'worth studying: its duals are a proof rather than a second opinion — every cell is at least ' +
      'the sum of its row and column values, every chosen cell is exactly that, and no wrong ' +
      'assignment can satisfy both conditions at once.');
  }

  function paintReduced(state) {
    const network = state.ssp.network;
    const potential = state.ssp.potential;
    const rows = [];

    for (let v = 0; v < network.n && rows.length < 10; v += 1) {
      network.adjacency[v].forEach(function (arc) {
        if (rows.length >= 10 || network.cost[arc] === 0) return;
        const head = network.to[arc];

        rows.push('<tr><td class="mono">' + v + ' → ' + head + '</td>' +
          '<td class="mono">' + root.Format.exact(network.cost[arc]) + '</td>' +
          '<td class="mono">' + root.Format.exact(potential[v]) + '</td>' +
          '<td class="mono">' + root.Format.exact(potential[head]) + '</td>' +
          '<td class="mono">' + root.Format.exact(network.cost[arc] + potential[v] -
            potential[head]) + '</td></tr>');
      });
    }
    root.jQuery('#mcf-reduced tbody').html(rows.join(''));
    root.jQuery('#mcf-reduced-note').text('Ten arcs of the final residual graph. The negative costs ' +
      'are the residual twins — undoing a routing decision refunds what it charged — and the reduced ' +
      'column is what Dijkstra actually sorts on. Every reduced cost on an arc with capacity left is ' +
      'non-negative, which is both why Dijkstra is legal and the certificate that the flow is optimal.');
  }

  function paintGeneral(state) {
    const refused = Boolean(state.ssp.refused);

    root.MatrixView.render(root.jQuery('#mcf-general')[0], {
      columns: ['Quantity', 'Value', 'Note'],
      rows: [
        { cells: ['arcs with a negative cost', root.Format.exact(state.negatives),
          'built by undoing a reweighting, so no cycle can be negative'] },
        { cells: ['successive shortest paths', refused ? 'refused'
          : root.Format.exact(state.ssp.flow) + ' units at cost ' + root.Format.exact(state.ssp.cost),
        refused ? state.ssp.refused : 'one Bellman-Ford pass, then Dijkstra per unit'] },
        { cells: ['cycle cancelling', refused ? '—'
          : root.Format.exact(state.cancelling.flow) + ' units at cost ' +
            root.Format.exact(state.cancelling.cost),
        refused ? 'not attempted' : 'a maximum flow first, then cancel until none is left'] },
        { cells: ['do they agree?',
          refused ? '—' : (state.ssp.cost === state.cancelling.cost ? 'yes' : 'NO'),
          'two derivations with nothing in common but the answer'] }
      ]
    });
    root.jQuery('#mcf-general-note').text('Switch the negative costs off and the Bellman-Ford pass is ' +
      'skipped entirely — the potential starts at zero because it is already valid. Switch them on ' +
      'and the pass earns its place. The construction here gives genuinely negative arcs and no ' +
      'negative cycle on purpose; a network with one has no minimum at all, and the solver says so ' +
      'rather than running until something stops it.');
  }

  function paintCurve(rows) {
    const html = rows.map(function (row) {
      return '<tr><td class="mono">' + root.Format.exact(row.flow) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.cost) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.marginal) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.dijkstras) + '</td></tr>';
    }).join('');

    root.jQuery('#mcf-curve tbody').html(html);
    root.jQuery('#mcf-curve-note').text('Each row is the cheapest way to send that much flow, which ' +
      'is not the same as the first rows of the full answer — sending three units optimally may use ' +
      'none of the routes that sending two units optimally used. The marginal column never falls, ' +
      'and that convexity is a theorem rather than a coincidence: it is exactly why sending one unit ' +
      'at a time along the cheapest remaining path is correct.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

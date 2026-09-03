/**
 * Section: topological order and DAGs.
 *
 * The section exists to make one engineering argument concrete: **returning
 * the cycle is worth more than returning null**, and it costs one parent map.
 * So the demo does not report "cyclic: true" - it reports the exact package
 * chain, verified edge by edge against the graph, which is the difference
 * between a build tool you can debug and one you cannot.
 *
 * The schedule table makes the second argument: the critical path is a floor
 * no number of workers beats. One worker takes the total work; enough workers
 * take the longest chain; and everything past that buys nothing at all. That
 * is a fact about the graph rather than about the scheduler, and the table
 * shows exactly where the curve flattens.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'topological-order';
  const WORKER_STEPS = [1, 2, 4, 8, 16, 64];
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
      title: 'Diagram — the critical path is a floor',
      caption: 'A → B → C → D is four sequential builds however many workers you have, because each one ' +
        'needs the previous one finished. E and F can run alongside, so they cost nothing extra — the ' +
        'makespan is the longest chain, not the total work.',
      definition: [
        'flowchart LR',
        '    A["A (2s)"] --> B["B (3s)"]',
        '    B --> C["C (2s)"]',
        '    C --> D["D (4s)"]',
        '    A --> E["E (1s)"]',
        '    A --> F["F (1s)"]',
        '    E --> D',
        '    F --> D'
      ].join('\n')
    };
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        '**A topological order is a listing in which every edge points forwards, and it exists ' +
          'exactly when the graph is acyclic.** Two algorithms produce one.',
        '**Kahn\'s** peels sources — vertices with no remaining incoming edges — and stalls when ' +
          'none are left. **The DFS finish order**, reversed, is also valid, and fails instead by ' +
          'finding a back edge. They are not interchangeable: Kahn\'s partial output is ' +
          'meaningful, and it can be made lexicographically smallest by taking the smallest ' +
          'available source.',
        '**"Returns null on a cycle" is a useless error.** A build tool that says "your ' +
          'dependencies are circular" has told you nothing you did not already suspect. One that ' +
          'says "a → b → c → a" has told you where to look, and the difference costs one parent ' +
          'map and a walk.',
        'Every function here that can fail on a cycle returns the cycle, and the demo verifies it ' +
          'edge by edge against the graph rather than trusting the extraction.',
        '**The critical path is a floor.** The longest chain of dependencies is the makespan no ' +
          'number of workers can beat, because each link waits for the previous one. One worker ' +
          'takes the total work. Enough workers take the critical path. Every worker past that ' +
          'point buys nothing.',
        'The table below sweeps the worker count and the curve visibly flattens. That is the ' +
          'number to quote when somebody proposes buying more build machines.',
        'The order also makes three otherwise-awkward problems linear. **Longest path** is NP-hard ' +
          'on a general graph and a single sweep on a DAG. **Shortest paths** need no priority ' +
          'queue at all, and unlike Dijkstra they tolerate negative weights, because the order ' +
          'already settles each vertex before it is relaxed.',
        '**Counting the distinct orders** is a subset DP, the same shape as M12.7. It is ' +
          'exponential, which is worth seeing.'
      ],
      demo: {
        title: 'Interactive demo — a build graph, its cycle, and the workers that stop helping',
        markup: root.TopologicalOrderTemplate.render()
      },
      diagram: diagram(),
      insight: 'Whenever an algorithm can fail on a structural property of its input, return ' +
        'the witness rather than the verdict. A cycle, an odd cycle, the pair of indices where ' +
        'an inequality broke, the two vertices a bridge separates. Each of them takes a few ' +
        'extra lines at the point of detection, and saves an afternoon at the point of ' +
        'diagnosis. The general form is that a boolean answer to a structural question is almost ' +
        'always the wrong return type. The caller already suspected the answer and needed the ' +
        'evidence.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.TopologicalOrderTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  /* A package graph plus, optionally, one back edge - which is exactly how a
     dependency cycle appears in practice: one new import, added last. */
  const graphFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const n = Number(parts[0]);
    const random = root.Random.seeded(Number(parts[2]));
    const graph = root.GraphCore.randomDag(n, n * Number(parts[1]), random, {});

    if (parts[3] === 'on' && graph.edges.length > 0) {
      const late = graph.edges[graph.edges.length - 1];
      graph.edges.push({ from: late.to, to: late.from, weight: 1 });
    }
    const durations = [];

    for (let v = 0; v < n; v += 1) durations.push(1 + random.int(5));
    return { graph: graph, durations: durations, adjacency: root.GraphCore.adjacencyList(graph) };
  });

  const analysisFor = root.Helpers.memoise(function (key) {
    const built = graphFor(key);
    return {
      built: built,
      kahn: root.Topological.kahn(built.adjacency, {}),
      lexicographic: root.Topological.kahn(built.adjacency, { lexicographic: true }),
      dfs: root.Topological.dfsOrder(built.adjacency, {}),
      critical: root.Topological.criticalPath(built.adjacency, built.durations, {}),
      shortest: root.Topological.dagShortestPaths(built.adjacency, 0, {}),
      orders: built.graph.n <= 14 ? root.Topological.countOrders(built.adjacency, {}) : null
    };
  });

  const scheduleFor = root.Helpers.memoise(function (key) {
    const built = graphFor(key);
    return WORKER_STEPS.map(function (workers) {
      return { workers: workers,
        run: root.Topological.scheduleWith(built.adjacency, workers, built.durations, {}) };
    });
  });

  function keyFor(values) {
    return values['tpo-packages'] + '|' + values['tpo-density'] + '|' + values['tpo-seed'] + '|' +
      values['tpo-cycle'];
  }

  function update() {
    const values = panel.values();
    const state = analysisFor(keyFor(values));
    const selected = root.Topological.scheduleWith(state.built.adjacency,
      Number(values['tpo-workers']), state.built.durations, {});

    paintMetrics(state, selected, values['tpo-workers']);
    paintCanvas(state);
    paintCycle(state);
    paintMethods(state);
    paintSchedule(state, scheduleFor(keyFor(values)));
    paintUnlocks(state);
  }

  function totalWork(state) {
    return state.built.durations.reduce(function (a, b) { return a + b; }, 0);
  }

  function paintMetrics(state, selected, workers) {
    const acyclic = state.kahn.acyclic;

    root.MetricGrid.update({
      'tpo-order': {
        value: acyclic ? root.Format.exact(state.kahn.order.length)
          : root.Format.exact(state.kahn.partial.length) + ' of ' + root.Format.exact(state.built.graph.n),
        note: acyclic ? 'every package placed' : 'the rest are downstream of the cycle'
      },
      'tpo-critical': { value: acyclic ? root.Format.exact(state.critical.length) : '—',
        note: acyclic ? 'over ' + state.critical.path.length + ' packages in one chain'
          : 'undefined while a cycle exists' },
      'tpo-makespan': { value: selected.makespan === null ? '—' : root.Format.exact(selected.makespan),
        note: selected.makespan === null ? 'the build cannot start: a cycle blocks it'
          : 'with ' + workers + ' worker' + (Number(workers) === 1 ? '' : 's') },
      'tpo-serial': { value: root.Format.exact(totalWork(state)),
        note: 'the sum of every package build time' }
    });
  }

  function paintCanvas(state) {
    view = function () { drawGraph(state); };
    view();
  }

  function drawGraph(state) {
    const host = root.jQuery('#tpo-canvas')[0];

    if (!host) return;
    const positions = root.GraphView.circularLayout(state.built.graph.n,
      host.clientWidth || 620, 340);
    const onPath = new Set(state.critical.path || []);

    root.GraphView.draw({
      host: host, graph: state.built.graph, positions: positions, height: 340,
      edgeClass: function (id, edge) {
        return onPath.has(edge.from) && onPath.has(edge.to) ? 'path' : null;
      },
      nodeClass: function (v) { return onPath.has(v) ? 'path' : null; }
    });
    root.jQuery('#tpo-canvas-note').text(state.kahn.acyclic
      ? 'The highlighted chain is the critical path: ' + state.critical.path.length + ' packages that must '
        + 'build one after another, totalling ' + state.critical.length + ' units. Nodes are on a ring '
        + 'because a dependency graph has no geometry — the positions mean nothing and pretending '
        + 'otherwise would be a picture of the layout rather than of the answer.'
      : 'A cycle is present, so there is no critical path to draw and no valid build order to follow.');
  }

  function paintCycle(state) {
    const cycle = state.kahn.cycle;
    const verified = cycle
      ? root.Topological.verifyCycle(state.built.adjacency, cycle) : null;
    const rows = [
      { cells: ['"is it acyclic?"', state.kahn.acyclic ? 'yes' : 'no',
        'true or false — and the caller already suspected the answer'] },
      { cells: ['"which packages?"', cycle ? cycle.join(' → ') + ' → ' + cycle[0] : 'not applicable',
        cycle ? 'the chain to open in an editor' : 'nothing to report'] },
      { cells: ['every step a real edge?', verified === null ? '—' : (verified ? 'yes' : 'NO'),
        'checked against the graph rather than trusted'] },
      { cells: ['packages still placeable', root.Format.exact(
        state.kahn.acyclic ? state.built.graph.n : state.kahn.partial.length),
      'everything not downstream of the cycle can still be built'] }
    ];

    root.MatrixView.render(root.jQuery('#tpo-cycle-view')[0], {
      columns: ['Question', 'Answer', 'What it is worth'],
      rows: rows
    });
    root.jQuery('#tpo-cycle-note').text(cycle
      ? 'The cycle costs one parent map to extract and is verified edge by edge before being shown. Note '
        + 'the last row: Kahn\'s partial output is not wasted — those packages are genuinely buildable, '
        + 'which is what lets a build tool make progress instead of refusing entirely.'
      : 'Switch the cycle control on to add a single back edge — one new import, added last, which is '
        + 'exactly how a dependency cycle appears in practice.');
  }

  function paintMethods(state) {
    const rows = [
      { name: "Kahn's algorithm", result: state.kahn, fails: 'stalling with sources exhausted' },
      { name: 'DFS finish order', result: state.dfs, fails: 'finding a back edge' },
      { name: 'Kahn, lexicographically smallest', result: state.lexicographic,
        fails: 'stalling, the same way' }
    ];
    const html = rows.map(function (row) {
      const valid = row.result.acyclic ? checkOrder(state, row.result.order) : null;
      const cycle = row.result.cycle;
      return '<tr><td>' + row.name + '</td>' +
        '<td>' + (valid === null ? 'no order — a cycle blocks it' : (valid ? 'yes' : 'NO')) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.result.acyclic ? row.result.order.length
          : (row.result.partial || []).length) + '</td>' +
        '<td>' + row.fails + '</td>' +
        '<td>' + (cycle
          ? (root.Topological.verifyCycle(state.built.adjacency, cycle) ? 'yes, ' + cycle.length + ' packages'
            : 'NO') : '—') + '</td></tr>';
    }).join('');

    root.jQuery('#tpo-methods tbody').html(html);
    root.jQuery('#tpo-methods-note').text('Every order is checked the only way that means anything: every '
      + 'edge must point forwards in it. The lexicographic variant scans for the smallest available '
      + 'source instead of taking any, which is a different problem from "a valid order" and costs a heap '
      + 'in production.');
  }

  function checkOrder(state, order) {
    const position = {};

    order.forEach(function (v, i) { position[v] = i; });
    return state.built.graph.edges.every(function (edge) {
      return position[edge.from] < position[edge.to];
    });
  }

  function paintSchedule(state, rows) {
    const serial = totalWork(state);
    const html = rows.map(function (row) {
      const makespan = row.run.makespan;
      return '<tr><td class="mono">' + row.workers + '</td>' +
        '<td class="mono">' + (makespan === null ? 'blocked' : root.Format.exact(makespan)) + '</td>' +
        '<td class="mono">' + (makespan === null ? '—'
          : root.Format.fixed(serial / makespan, 2) + '×') + '</td>' +
        '<td class="mono">' + (makespan === null || !state.kahn.acyclic ? '—'
          : root.Format.fixed(makespan / state.critical.length, 2) + '×') + '</td>' +
        '<td class="mono">' + (row.run.peakWorkers === undefined ? '—' : row.run.peakWorkers) +
        '</td></tr>';
    }).join('');

    root.jQuery('#tpo-schedule tbody').html(html);
    root.jQuery('#tpo-schedule-note').text(state.kahn.acyclic
      ? 'One worker takes the total work of ' + root.Format.exact(serial) + '; the critical path is '
        + root.Format.exact(state.critical.length) + ', and no worker count gets below it. The last '
        + 'column is the number actually kept busy at once, which is why the makespan stops moving long '
        + 'before the worker slider does.'
      : 'No schedule exists while a cycle blocks the graph — the build cannot start at all.');
  }

  function paintUnlocks(state) {
    const reachable = (state.shortest.distance || []).filter(function (d) {
      return d !== Infinity;
    }).length;
    const rows = [
      { question: 'longest path (the critical path)',
        answer: state.kahn.acyclic ? root.Format.exact(state.critical.length) : 'undefined',
        why: 'NP-hard on a general graph; one sweep here' },
      { question: 'shortest paths from package 0',
        answer: state.kahn.acyclic ? root.Format.exact(reachable) + ' packages reachable' : 'undefined',
        why: 'no priority queue at all, and negative weights are fine' },
      { question: 'how many distinct valid orders',
        answer: state.orders ? (state.orders.count === null ? 'too many to enumerate'
          : root.Format.exact(state.orders.count)) : 'only counted below 15 packages',
        why: 'a subset DP — the M12.7 shape, and exponential' }
    ];
    const html = rows.map(function (row) {
      return '<tr><td>' + row.question + '</td><td class="mono">' + row.answer + '</td>' +
        '<td>' + row.why + '</td></tr>';
    }).join('');

    root.jQuery('#tpo-unlocks tbody').html(html);
    root.jQuery('#tpo-unlocks-note').text('Each of these is hard or impossible on a general directed '
      + 'graph and easy once an order exists. That is what a topological sort actually buys: not the list '
      + 'itself, but the guarantee that every predecessor is already settled when you reach a vertex.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

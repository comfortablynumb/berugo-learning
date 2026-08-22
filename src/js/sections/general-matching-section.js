/**
 * Section: general and weighted matching.
 *
 * The counter-example is the section. Six vertices, eight edges, and a
 * bipartite-style augmenting search that returns 2 where the answer is 3 -
 * then the same edge set with each adjacency list sorted, on which the same
 * search returns 3. Nothing about the graph changed. That is why "just extend
 * the bipartite algorithm" survives code review: it is usually right, and the
 * cases where it is not depend on iteration order.
 *
 * The second half is the Hungarian algorithm, which is the *other* thing
 * people mean by "matching": not the largest set of pairs but the cheapest
 * perfect one. Its dual certificate is checked on every run, because a wrong
 * assignment is a valid permutation with a plausible cost.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'general-matching';
  const EDGE_STEPS = [12, 16, 20, 24, 30];
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
      title: 'Diagram — an odd cycle contracting to one pseudo-vertex',
      caption: 'An alternating search that enters a blossom from one side cannot leave it from the ' +
        'other, because the odd cycle forces two consecutive unmatched edges somewhere. Contracting ' +
        'the whole cycle into a single vertex removes the problem: an augmenting path in the ' +
        'contracted graph lifts back to one in the original, and the matching inside the blossom is ' +
        'rearranged to suit.',
      definition: [
        'flowchart LR',
        '    R["root — unmatched"] --> A["a"]',
        '    A --- B["b"]',
        '    B --- C["c"]',
        '    C --- D["d"]',
        '    D --- A',
        '    B --> X["the search reaches b twice,<br/>once on each side of the odd cycle"]',
        '    X --> P["contract a,b,c,d into one pseudo-vertex;<br/>search again; lift the path back"]'
      ].join('\n')
    };
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        'On a bipartite graph the augmenting-path argument is clean: every alternating walk moves ' +
          'left, right, left, right, so a vertex reached on the left is never reached on the right ' +
          'and marking it once is safe. **On a general graph that breaks.** An odd cycle — a blossom ' +
          '— can be entered on one side and needs to be left on the other, and a search that marks ' +
          'each vertex once will refuse to do it. The result is not a slower algorithm but a wrong ' +
          'one, and the panel below runs it on a six-vertex graph where it returns 2 against an ' +
          'answer of 3.',
        '**Edmonds\'s blossom algorithm** fixes it by contraction. When the alternating search finds ' +
          'an edge joining two vertices at even distance from the root, the cycle it closes is odd; ' +
          'the whole cycle is contracted to a single pseudo-vertex and the search continues. An ' +
          'augmenting path found in the contracted graph lifts back to one in the original, ' +
          'rearranging the matching inside the blossom as it goes. It was the first algorithm ever ' +
          'argued to be polynomial in the modern sense, and that argument is where the word ' +
          '"polynomial time" as a definition of tractable comes from.',
        '**Weighted matching is a different question with a different answer.** The assignment ' +
          'problem asks for the cheapest *perfect* matching on a complete bipartite graph given a ' +
          'cost matrix, and the **Hungarian algorithm** solves it in O(n³) by maintaining a pair of ' +
          '**potentials** — one per row, one per column — such that every reduced cost `c(i,j) − u(i) ' +
          '− v(j)` is non-negative and every chosen cell has reduced cost exactly zero. Those two ' +
          'facts together are a *certificate*: they prove optimality without reference to the ' +
          'algorithm that produced them, and this section checks them on every run.',
        '**The potentials are Johnson\'s reweighting and the dual of a linear program**, which is ' +
          'the same observation 14.4 makes about min-cost flow. Once you see the assignment problem ' +
          'as a min-cost flow of value n on a unit-capacity bipartite network, the Hungarian ' +
          'algorithm stops being a separate thing to learn and becomes successive shortest paths ' +
          'with the potentials written down explicitly.'
      ],
      demo: {
        title: 'Interactive demo — the counter-example, the failure rate, and the cost matrix',
        markup: root.GeneralMatchingTemplate.render()
      },
      diagram: diagram(),
      insight: 'You will almost certainly never implement blossoms. What is worth carrying is the ' +
        'reason they are needed: the bipartite augmenting-path argument depends on two-colourability, ' +
        'and an odd cycle destroys it. That single fact tells you when a graph library\'s ' +
        '`maximumMatching` is safe to trust on your input and when it is not, and it is the same ' +
        'boundary that separates the easy version of half a dozen other problems from the hard one — ' +
        'colouring, independent set and vertex cover all become tractable on bipartite graphs for ' +
        'exactly this reason.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.GeneralMatchingTemplate.controls,
      onChange: function () { update(); }
    });

    update();
  }

  /* -------------------------------------------------------------- fixtures */

  const adjacencyFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');

    if (parts[0] === 'fixture') return root.MatchingLab.oddCycleFixture(parts[1]);
    return root.MatchingLab.generalGraph({ n: Number(parts[2]), m: Number(parts[3]),
      seed: Number(parts[4]), oddCycle: parts[0] === 'random' });
  });

  const runFor = root.Helpers.memoise(function (key) {
    return root.MatchingLab.generalRun({ adjacency: adjacencyFor(key) });
  });

  const rateFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return EDGE_STEPS.map(function (edges) {
      return root.MatchingLab.naiveFailureRate({ n: Number(parts[0]), m: edges, trials: 60 });
    });
  });

  const assignmentFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.MatchingLab.assignmentRun({ size: Number(parts[0]), range: Number(parts[1]), seed: 1 });
  });

  const assignmentSweep = root.Helpers.memoise(function (key) {
    const range = Number(key);
    return [3, 4, 5, 6, 7, 8].map(function (size) {
      return { size: size, run: root.MatchingLab.assignmentRun({ size: size, range: range, seed: 1 }) };
    });
  });

  /* -------------------------------------------------------------- painting */

  function update() {
    const values = panel.values();
    const key = values['gmt-source'] + '|' + values['gmt-order'] + '|' + values['gmt-nodes'] +
      '|' + values['gmt-edges'] + '|' + values['gmt-seed'];
    const state = runFor(key);
    const assignment = assignmentFor(values['gmt-size'] + '|' + values['gmt-cost']);

    paintMetrics(state, assignment);
    paintMap(adjacencyFor(key), state);
    paintCompare(state);
    paintRate(rateFor(String(values['gmt-nodes'])));
    paintMatrix(assignment);
    paintAssign(assignmentSweep(String(values['gmt-cost'])));
  }

  function paintMetrics(state, assignment) {
    const short = state.blossom.size - state.naive.size;

    root.MetricGrid.update({
      'gmt-blossom': { value: root.Format.exact(state.blossom.size),
        note: root.Format.plural(state.blossom.report.blossomsContracted, 'blossom') +
          ' contracted over ' +
          root.Format.plural(state.blossom.report.augmentingPaths, 'augmenting path') },
      'gmt-naive': { value: root.Format.exact(state.naive.size),
        note: short > 0 ? 'short by ' + root.Format.plural(short, 'edge') + ', silently'
          : 'the same answer here — the failure depends on the neighbour order' },
      'gmt-optimal': { value: state.truth === null ? 'not run'
        : (state.optimal ? 'yes' : 'NO'),
      note: state.truth === null ? 'the graph is above the exhaustive-search limit'
        : 'exhaustive search over every pairing returns ' + root.Format.exact(state.truth) },
      'gmt-assignment': { value: root.Format.exact(assignment.run.cost),
        note: 'greedy pays ' + root.Format.exact(assignment.greedy.cost) + ', which is ' +
          root.Format.fixed(100 * (assignment.greedy.cost - assignment.run.cost) /
            assignment.run.cost, 1) + '% more' }
    });
  }

  function paintMap(adjacency, state) {
    view = function () { drawMap(adjacency, state); };
    view();
  }

  function drawMap(adjacency, state) {
    const host = root.jQuery('#gmt-map')[0];

    if (!host) return;
    const width = host.clientWidth || 620;
    const height = 320;
    const edges = [];
    const matched = new Set();

    adjacency.forEach(function (list, v) {
      list.forEach(function (u) { if (v < u) edges.push({ from: v, to: u }); });
    });
    state.blossom.match.forEach(function (partner, v) {
      if (partner === -1) return;
      matched.add(Math.min(v, partner) + '-' + Math.max(v, partner));
    });
    root.GraphView.draw({ host: host, graph: { n: adjacency.length, edges: edges },
      positions: root.GraphView.circularLayout(adjacency.length, width, height),
      width: width, height: height,
      labels: adjacency.map(function (list, v) { return String(v); }),
      edgeClass: function (id) {
        return matched.has(Math.min(edges[id].from, edges[id].to) + '-' +
          Math.max(edges[id].from, edges[id].to)) ? 'path' : null;
      },
      nodeClass: function (v) { return state.blossom.match[v] === -1 ? 'cut' : null; } });
    root.jQuery('#gmt-map-note').text('The strong edges are the ' +
      root.Format.exact(state.blossom.size) + ' matched pairs found by Edmonds; the highlighted ' +
      'vertices are the ' + root.Format.exact(state.blossom.match.filter(function (p) {
      return p === -1; }).length) + ' left over. A ring is the right picture here precisely because ' +
      'the interesting structure is a cycle: count the vertices on any cycle in this drawing, and if ' +
      'the number is odd, that is a blossom the bipartite argument cannot cross.');
  }

  function paintCompare(state) {
    const rows = [
      compareRow('Edmonds — with blossom contraction', state.blossom.size,
        state.blossom.report, state.truth === null ? null : state.optimal),
      compareRow('bipartite-style search, no contraction', state.naive.size,
        { augmentingPaths: state.naive.size, blossomsContracted: 0, edgesExamined: 0 },
        state.truth === null ? null : state.naive.size === state.truth),
      compareRow('exhaustive search over every pairing',
        state.truth === null ? 0 : state.truth,
        { augmentingPaths: 0, blossomsContracted: 0, edgesExamined: 0 },
        state.truth === null ? null : true)
    ];

    root.jQuery('#gmt-compare tbody').html(rows.join(''));
    root.jQuery('#gmt-compare-note').text(state.naive.size < state.blossom.size
      ? 'The middle row is wrong, and nothing about it looks wrong: it returns a perfectly valid ' +
        'matching that happens to be ' + root.Format.exact(state.blossom.size - state.naive.size) +
        ' edge short. Switch the neighbour order to "sorted" and watch it become correct on the same ' +
        'graph with the same edges — the failure is a property of the iteration order, which is ' +
        'exactly why it survives a test suite written from hand-typed examples.'
      : 'The middle row happens to be right here. That is the normal case and the reason the bug is ' +
        'hard to find: bipartite-style augmentation is correct on any graph with no odd cycle and ' +
        'usually correct on graphs that have them. Switch the neighbour order, or the source graph, ' +
        'to find an input where it is not.');
  }

  function compareRow(name, size, report, correct) {
    return '<tr><td>' + name + '</td>' +
      '<td class="mono">' + root.Format.exact(size) + '</td>' +
      '<td class="mono">' + root.Format.exact(report.augmentingPaths || 0) + '</td>' +
      '<td class="mono">' + root.Format.exact(report.blossomsContracted || 0) + '</td>' +
      '<td class="mono">' + root.Format.exact(report.edgesExamined || 0) + '</td>' +
      '<td>' + (correct === null ? '—' : (correct ? 'yes' : 'NO')) + '</td></tr>';
  }

  function paintRate(rows) {
    const html = rows.map(function (row, index) {
      return '<tr><td class="mono">' + root.Format.exact(EDGE_STEPS[index]) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.trials) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.short) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.deficit) + '</td>' +
        '<td class="mono">' + root.Format.fixed(100 * row.short / row.trials, 1) + '%</td></tr>';
    }).join('');
    const total = rows.reduce(function (sum, row) { return sum + row.short; }, 0);
    const trials = rows.reduce(function (sum, row) { return sum + row.trials; }, 0);

    root.jQuery('#gmt-rate tbody').html(html);
    root.jQuery('#gmt-rate-note').text('Sixty random graphs per row, and the naive search is short ' +
      'on ' + root.Format.exact(total) + ' of ' + root.Format.exact(trials) + ' — ' +
      root.Format.fixed(100 * total / trials, 1) + '%. That number is the whole problem. A bug that ' +
      'fires on one input in thirty produces a service that is correct on every example anybody ' +
      'checks and quietly under-allocates in production, and no amount of property testing finds it ' +
      'unless the property being tested is "equals an independent maximum", which is the one nobody ' +
      'writes because computing it is the hard part.');
  }

  function paintMatrix(assignment) {
    const columns = ['Worker'].concat(assignment.matrix.map(function (unused, c) {
      return 'task ' + c; })).concat(['reduced cost of the chosen cell']);
    const rows = assignment.matrix.map(function (line, r) {
      const chosen = assignment.run.assignment[r];
      const cells = [String('worker ' + r)].concat(line.map(function (cost, c) {
        return c === chosen ? '[' + cost + ']' : String(cost);
      }));

      return { cells: cells.concat([String(line[chosen] - assignment.run.rowDual[r + 1] -
        assignment.run.colDual[chosen + 1])]) };
    });

    root.MatrixView.render(root.jQuery('#gmt-matrix')[0], { columns: columns, rows: rows });
    root.jQuery('#gmt-matrix-note').text('The bracketed cell in each row is the one the Hungarian ' +
      'algorithm chose, for a total of ' + root.Format.exact(assignment.run.cost) + '. The last ' +
      'column is the certificate: reduced cost `c − u(row) − v(column)`, which is ' +
      (assignment.check.slackOnChosen === 0 ? 'zero on every chosen cell'
        : root.Format.exact(assignment.check.slackOnChosen) + ' in total on the chosen cells') +
      ' and ' + (assignment.check.violated === 0 ? 'non-negative everywhere else'
        : 'negative on ' + root.Format.exact(assignment.check.violated) + ' cells') +
      '. Those two facts together prove the assignment optimal without appealing to the algorithm ' +
      'at all — any other permutation costs at least as much, because its cells have non-negative ' +
      'reduced cost and the potentials are the same.');
  }

  function paintAssign(rows) {
    const html = rows.map(function (entry) {
      const excess = entry.run.greedy.cost - entry.run.run.cost;

      return '<tr><td class="mono">' + root.Format.exact(entry.size) + '</td>' +
        '<td class="mono">' + root.Format.exact(entry.run.run.cost) + '</td>' +
        '<td class="mono">' + root.Format.exact(entry.run.greedy.cost) + '</td>' +
        '<td class="mono">' + root.Format.exact(excess) + ' (' +
          root.Format.fixed(100 * excess / entry.run.run.cost, 1) + '%)</td>' +
        '<td class="mono">' + root.Format.exact(entry.run.run.report.comparisons) + '</td>' +
        '<td class="mono">' + root.Format.exact(entry.run.permutations) + '</td></tr>';
    }).join('');
    const last = rows[rows.length - 1];

    root.jQuery('#gmt-assign tbody').html(html);
    root.jQuery('#gmt-assign-note').text('Every Hungarian row agrees with an exhaustive permutation ' +
      'search, and the last column is what that search had to look at: ' +
      root.Format.exact(last.run.permutations) + ' permutations at ' +
      root.Format.exact(last.size) + ' workers, against ' +
      root.Format.exact(last.run.run.report.comparisons) + ' comparisons for the Hungarian ' +
      'algorithm. The greedy column is the answer people reach for first — take the cheapest ' +
      'remaining cell each time — and it is wrong by a margin that does not shrink with size. ' +
      'Greedy is not a cheap approximation of the assignment problem; it is a different algorithm ' +
      'with no bound.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

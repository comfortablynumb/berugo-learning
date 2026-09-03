/**
 * Section: colouring, cliques and independent sets.
 *
 * Three panels, one point. Greedy colouring is not an algorithm with a
 * quality - it is an algorithm with an *ordering*, and the ordering decides
 * everything: on the bipartite shape, largest-degree-first needs three colours
 * on a graph that is provably 2-colourable, and smallest-last needs two. The
 * exact chromatic number sits beside both, computed exhaustively, so "greedy
 * did well" is a measurement rather than a hope.
 *
 * The clique panel is the same graph read three ways. A maximum clique in G is
 * a maximum independent set in the complement of G, and everything outside
 * that independent set is a minimum vertex cover - so the three numbers add up
 * to n and any one of them answers the other two. The last panel is Chaitin's
 * allocator, which is this section with the escape hatch a compiler needs.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'graph-coloring';
  const REGISTER_STEPS = [2, 3, 4, 5, 6];
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
      title: 'Diagram — the complement turns a clique into an independent set',
      caption: 'Complementing a graph swaps "adjacent" and "non-adjacent" everywhere, so a set of ' +
        'mutually adjacent vertices becomes a set of mutually non-adjacent ones. Maximum clique, ' +
        'maximum independent set and minimum vertex cover are therefore one problem with three ' +
        'names, and a solver for any of them solves all three.',
      definition: [
        'flowchart LR',
        '    G["G — vertices a,b,c mutually adjacent<br/>(a clique of 3)"] -->|"complement"| H["Ḡ — a,b,c mutually non-adjacent<br/>(an independent set of 3)"]',
        '    H --> C["the other n − 3 vertices of Ḡ<br/>are a vertex cover of Ḡ"]',
        '    C --> N["clique(G) + cover(Ḡ) = n"]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**A proper colouring assigns each vertex a colour so that no edge joins two of the same.** ' +
        'The **chromatic number** is the fewest colours that admit one, and computing it is NP-hard.',
      'The panel below does it exhaustively, which is why the graph has to stay small.',
      'Everything practical is therefore a heuristic, and the heuristic everybody uses is greedy. ' +
        'Take the vertices in some order and give each the lowest colour none of its ' +
        'already-coloured neighbours holds.',
      '**The ordering is the algorithm.** Greedy in any order uses at most `Δ + 1` colours, which ' +
        'is a weak bound.',
      '**Degeneracy ordering** repeatedly removes a vertex of minimum degree, then colours in the ' +
        'reverse of that removal order. It uses at most `degeneracy + 1`, and the degeneracy of a ' +
        'graph can be much smaller than its maximum degree.',
      '**Welsh-Powell** takes the highest degree first, which sounds like the same idea and is not. ' +
        'On the bipartite shape below it uses twice the colours the graph needs, and the graph is ' +
        'provably 2-colourable.',
      '**Some graphs make greedy exact.** On an **interval graph** — vertices are bookings, edges ' +
        'are overlaps — greedy in left-endpoint order uses exactly the maximum number of intervals ' +
        'alive at once.',
      'That is the largest clique, which is a lower bound on any colouring. So the answer is ' +
        'optimal, and the algorithm is a sweep.',
      'That is why meeting-room assignment is easy and register allocation is not: the interference ' +
        'graph of a program is not an interval graph once control flow branches.',
      '**Clique, independent set and vertex cover are one problem.** A clique in `G` is an ' +
        'independent set in the complement of `G`, and the complement of a maximum independent set ' +
        'is a minimum vertex cover.',
      'So the three numbers sum to `n`, and one search answers all three. **Bron-Kerbosch** ' +
        'enumerates every maximal clique, and **pivoting** prunes the branches that would find the ' +
        'same clique twice — which the panel prices rather than asserting.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — orderings, the exact answer, the complement, and an allocator',
        markup: root.GraphColoringTemplate.render()
      },
      diagram: diagram(),
      insight: 'Register allocation is graph colouring, and the thing that makes it work in a real ' +
        'compiler is not a better heuristic. It is that spilling exists. When the interference graph ' +
        'needs more colours than the machine has registers, the allocator does not fail. It picks a ' +
        'variable, writes it to memory, and tries again on a smaller graph. Almost every practical ' +
        'use of an NP-hard problem has that shape: the escape hatch is the design, and the heuristic ' +
        'only decides how often you take it. When M29 arrives and the allocator looks strange, this ' +
        'is why.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.GraphColoringTemplate.controls,
      onChange: function () { update(); }
    });

    update();
  }

  /* -------------------------------------------------------------- fixtures */

  const instanceFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.GraphAnalysisLab.build({ shape: parts[0], n: Number(parts[1]),
      seed: Number(parts[2]), rows: 5, columns: 5 });
  });

  const colouringFor = root.Helpers.memoise(function (key) {
    return root.GraphAnalysisLab.colouringRun(instanceFor(key), {});
  });

  const cliqueFor = root.Helpers.memoise(function (key) {
    return root.GraphAnalysisLab.cliqueRun(instanceFor(key));
  });

  const spillFor = root.Helpers.memoise(function (key) {
    const adjacency = instanceFor(key).adjacency;
    return REGISTER_STEPS.map(function (registers) {
      return root.GraphAnalysisLab.chaitinRun(adjacency, registers);
    });
  });

  /* -------------------------------------------------------------- painting */

  function update() {
    const values = panel.values();
    const key = values['clr-shape'] + '|' + values['clr-nodes'] + '|' + values['clr-seed'];
    const colouring = colouringFor(key);
    const clique = cliqueFor(key);
    const chosen = rowFor(colouring, values['clr-order']);

    paintMetrics(colouring, clique, chosen);
    paintMap(instanceFor(key), chosen, clique);
    paintOrders(colouring);
    paintClique(instanceFor(key), clique);
    paintPivot(clique);
    paintSpill(spillFor(key), Number(values['clr-registers']), instanceFor(key));
  }

  function rowFor(colouring, name) {
    return colouring.rows.filter(function (row) { return row.name === name; })[0] || colouring.rows[0];
  }

  function paintMetrics(colouring, clique, chosen) {
    root.MetricGrid.update({
      'clr-colours': { value: root.Format.exact(chosen.colours),
        note: chosen.check.valid ? 'no edge joins two of the same colour'
          : root.Format.plural(chosen.check.conflicts, 'conflict') + ' — not a proper colouring' },
      'clr-bound': { value: root.Format.exact(colouring.bound),
        note: 'degeneracy ' + root.Format.exact(colouring.degeneracy) +
          ', so greedy in smallest-last order never exceeds this' },
      'clr-exact': { value: colouring.exact === null ? 'not run' : root.Format.exact(colouring.exact),
        note: colouring.exact === null
          ? 'above the exhaustive-search limit — the cost is exponential'
          : (chosen.colours === colouring.exact ? 'this ordering happened to be optimal'
            : root.Format.exact(chosen.colours - colouring.exact) + ' above the optimum') },
      'clr-clique': { value: root.Format.exact(clique.clique.length),
        note: 'every clique member needs a distinct colour, so no colouring beats this' }
    });
  }

  function paintMap(instance, chosen, clique) {
    view = function () { drawMap(instance, chosen, clique); };
    view();
  }

  function drawMap(instance, chosen, clique) {
    const host = root.jQuery('#clr-map')[0];

    if (!host) return;
    const width = host.clientWidth || 620;
    const height = 340;
    const edges = root.GraphAnalysisLab.edgesOf(instance.adjacency);
    const groups = classesOf(chosen.colour, chosen.colours);
    const inClique = new Set(clique.clique);

    root.GraphView.draw({ host: host, graph: { n: instance.adjacency.length, edges: edges },
      positions: root.GraphView.groupedLayout(groups, instance.adjacency.length, width, height),
      width: width, height: height,
      nodeClass: function (v) { return inClique.has(v) ? 'cut' : 'settled'; } });
    root.jQuery('#clr-map-note').text('One ring per colour class, so a proper colouring is one in ' +
      'which no edge joins two vertices of the same ring — read the picture that way and a conflict ' +
      'is visible rather than arithmetic. There are ' + root.Format.plural(chosen.colours, 'ring') +
      ' here. The highlighted vertices are the largest clique, ' +
      root.Format.exact(clique.clique.length) + ' of them, and they are necessarily in ' +
      root.Format.exact(clique.clique.length) + ' different rings: that is why the clique number is ' +
      'a lower bound on the chromatic number and why the two panels below are the same panel.');
  }

  function classesOf(colour, count) {
    const groups = [];

    for (let c = 0; c < Math.max(1, count); c += 1) groups.push([]);
    colour.forEach(function (c, v) { groups[Math.max(0, c)].push(v); });
    return groups.filter(function (members) { return members.length > 0; });
  }

  function paintOrders(colouring) {
    const html = colouring.rows.map(function (row) {
      const excess = colouring.exact === null ? null : row.colours - colouring.exact;

      return '<tr><td>' + row.name + '</td>' +
        '<td class="mono">' + root.Format.exact(row.colours) + '</td>' +
        '<td class="mono">' + (excess === null ? '—' : root.Format.exact(excess)) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.report.colourChecks) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.check.conflicts) + '</td></tr>';
    }).join('');

    root.jQuery('#clr-orders tbody').html(html);
    root.jQuery('#clr-orders-note').text(colouring.best === colouring.worst
      ? 'All three orderings agree on this graph at ' +
        root.Format.plural(colouring.best, 'colour') + '. That is common and it is not evidence ' +
        'that the ordering does not matter — switch to the bipartite or wheel shape, where the gap ' +
        'opens. The conflict column is zero in every row and has to be: an ordering can cost you ' +
        'colours, but greedy never produces an improper colouring, whatever order it is given.'
      : 'The orderings differ by ' + root.Format.exact(colouring.worst - colouring.best) +
        ' colours on the same graph — ' + root.Format.exact(colouring.best) + ' against ' +
        root.Format.exact(colouring.worst) + ' — and every row is a proper colouring. That is the ' +
        'whole lesson: greedy colouring is not a heuristic with a quality, it is a family of ' +
        'heuristics indexed by an ordering, and the literature\'s named methods are named orderings ' +
        'rather than named algorithms.');
  }

  function paintClique(instance, clique) {
    const n = instance.adjacency.length;
    const rows = [
      { cells: ['maximum clique in G', root.Format.exact(clique.clique.length),
        clique.clique.slice(0, 8).join(', '),
        clique.cliqueCheck.valid ? 'every pair adjacent'
          : root.Format.plural(clique.cliqueCheck.missing, 'edge') + ' missing'] },
      { cells: ['maximum independent set in G', root.Format.exact(clique.free.length),
        clique.free.slice(0, 8).join(', '),
        clique.independentCheck.valid ? 'no pair adjacent'
          : root.Format.plural(clique.independentCheck.conflicts, 'conflict')] },
      { cells: ['minimum vertex cover in G', root.Format.exact(clique.cover),
        'everything outside the independent set',
        'n − independent set = ' + root.Format.exact(n) + ' − ' +
          root.Format.exact(clique.free.length)] }
    ];

    root.MatrixView.render(root.jQuery('#clr-triple')[0], {
      columns: ['Quantity', 'Size', 'Members', 'Checked'], rows: rows
    });
    root.jQuery('#clr-triple-note').text('The second row was computed by running the very same ' +
      'clique search on the complement of the graph, and the third is arithmetic on the second. ' +
      'One search, three answers. This is why "vertex cover is NP-hard" and "independent set is ' +
      'NP-hard" and "clique is NP-hard" are one statement, and why an approximation for one ' +
      'transfers to the others only in the loosest sense — a factor-2 cover is not a factor-2 ' +
      'independent set, because complementing a set does not complement its ratio.');
  }

  function paintPivot(clique) {
    const rows = [
      pivotRow('Bron-Kerbosch with pivoting', clique.pivoted, clique.clique.length, clique.saving),
      pivotRow('Bron-Kerbosch without pivoting', clique.plain, clique.clique.length, 1)
    ];

    root.jQuery('#clr-pivot tbody').html(rows.join(''));
    root.jQuery('#clr-pivot-note').text('Both searches find exactly the same ' +
      root.Format.plural(clique.pivoted.report.maximalCliques, 'maximal clique') + ' — the pivot ' +
      'changes the work, never the answer. It saves ' + root.Format.fixed(clique.saving, 2) +
      '× here, which is real and unspectacular; the saving grows with density, because a pivot with ' +
      'many neighbours excludes many branches and a pivot with few excludes few. On a sparse graph ' +
      'there is almost nothing to prune, and the pivot is close to pure overhead.');
  }

  function pivotRow(name, run, largest, saving) {
    return '<tr><td>' + name + '</td>' +
      '<td class="mono">' + root.Format.exact(run.report.recursionNodes) + '</td>' +
      '<td class="mono">' + root.Format.exact(run.report.maximalCliques) + '</td>' +
      '<td class="mono">' + root.Format.exact(largest) + '</td>' +
      '<td class="mono">' + root.Format.fixed(saving, 2) + '×</td></tr>';
  }

  function paintSpill(rows, selected, instance) {
    const n = instance.adjacency.length;
    const html = rows.map(function (row, index) {
      const mark = REGISTER_STEPS[index] === selected ? ' ←' : '';

      return '<tr><td class="mono">' + root.Format.exact(REGISTER_STEPS[index]) + mark + '</td>' +
        '<td class="mono">' + root.Format.exact(row.spills) + '</td>' +
        '<td class="mono">' + root.Format.exact(n - row.spills) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.check.conflicts) + '</td>' +
        '<td>' + (row.spills === 0 ? 'yes' : 'no — ' +
          root.Format.fixed(100 * row.spills / n, 1) + '% go to memory') + '</td></tr>';
    }).join('');
    const chosen = rows[REGISTER_STEPS.indexOf(selected)] || rows[0];

    root.jQuery('#clr-spill tbody').html(html);
    root.jQuery('#clr-spill-note').text('Chaitin\'s allocator: push any vertex with fewer than k ' +
      'neighbours onto a stack and delete it, and when none is left, spill the busiest survivor and ' +
      'carry on; then pop, giving each vertex a register none of its live neighbours holds. At ' +
      root.Format.plural(selected, 'register') + ' it spills ' +
      root.Format.exact(chosen.spills) + ' of ' + root.Format.exact(n) + ' values, and every ' +
      'allocated vertex still has a register no neighbour shares — the conflict column is zero ' +
      'throughout, because the allocator never produces an invalid answer, only an expensive one. ' +
      'The spill column is what a compiler trades away when the machine has fewer registers than ' +
      'the program wants.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

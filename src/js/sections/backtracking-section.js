/**
 * Section: backtracking.
 *
 * Five puzzles, four heuristic stacks, one solver. The fifth puzzle is the
 * important one: "platinum blonde" is an instance where MRV is *worse* than
 * taking the first empty cell, which is why the matrix shows every puzzle
 * rather than the one that flatters the heuristic.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'backtracking';
  let panel = null;

  const PUZZLES = {
    easy: {
      label: 'an ordinary puzzle',
      cells: '530070000600195000098000060800060003400803001700020006060000280000419005000080079'
    },
    escargot: {
      label: '"escargot"',
      cells: '1....7.9..3..2...8..96..5....53..9...1..8...26....4...3......1..4......7..7...3..'
    },
    inkala: {
      label: 'Inkala\'s "world\'s hardest"',
      cells: '8..........36......7..9.2...5...7.......457.....1...3...1....68..85...1..9....4..'
    },
    antibrute: {
      label: 'built to defeat first-cell order',
      cells: '..............3.85..1.2.......5.7.....4...1...9.......5......73..2.1........4...9'
    },
    platinum: {
      label: '"platinum blonde" — where MRV loses',
      cells: '.....6....59.....82....8....45........3........6..3.54...325..6..................'
    }
  };

  const STACKS = [
    { id: 'naive', label: 'none — first empty cell', options: {} },
    { id: 'mrv', label: 'MRV', options: { mrv: true } },
    { id: 'forward', label: 'MRV + forward checking', options: { mrv: true, forward: true } },
    { id: 'ac3', label: 'MRV + forward + propagation', options: { mrv: true, forward: true, ac3: true } }
  ];

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — choose, explore, unchoose',
      caption: 'The unchoose step is the one that goes wrong. Whatever was mutated on the way down has to be ' +
        'restored exactly, and a forgotten restore does not raise - it silently removes solutions or invents ' +
        'them, and only a count against a reference notices.',
      definition: [
        'flowchart TD',
        '    S["pick the next variable"] --> V{"any value left?"}',
        '    V -->|no| B["fail — return to the caller"]',
        '    V -->|yes| C["choose a value"]',
        '    C --> P{"still consistent?"}',
        '    P -->|no| U["unchoose, try the next value"]',
        '    P -->|yes| D["propagate, then recurse"]',
        '    D --> G{"solved?"}',
        '    G -->|yes| R["return the assignment"]',
        '    G -->|no| U',
        '    U --> V'
      ].join('\n')
    };
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        '**Backtracking is exhaustive search with an undo.** Choose a value for a variable, ' +
          'recurse, and if the branch dies, put everything back exactly as it was and try the ' +
          'next value.',
        'The correctness risk is entirely in that last clause. State mutated on the way down ' +
          'must be restored on the way up. A restore that recomputes what changed, rather than ' +
          'replaying the removals, will eventually disagree with what was removed.',
        'The heuristics are where the performance is. Choosing the most constrained variable ' +
          'first (MRV) finds a dead branch at this level instead of eight levels down. Forward ' +
          'checking rejects a branch the moment any variable has nowhere left to go. Constraint ' +
          'propagation fills in everything forced by the last assignment before guessing again.',
        'Each costs more per node, and each is worth it only if it removes more nodes than it ' +
          'costs. That is a measurement, not a principle.',
        'On Inkala\'s puzzle the first-empty-cell solver visits 49 559 nodes and MRV visits ' +
          '10 102. Forward checking takes that to 9 180 and propagation to 929 — a factor of 53 ' +
          'from the flags together.',
        'On the anti-brute-force puzzle the naive order does not finish inside 500 000 nodes at ' +
          'all, while MRV needs 45 268. And on "platinum blonde" the ranking inverts: the naive ' +
          'order finishes in 419 195 and MRV is the one that runs out of budget.',
        'All three rows are in the matrix below. A heuristic that is usually an enormous help and ' +
          'occasionally a disaster is a different thing from a heuristic that always helps.'
      ],
      demo: {
        title: 'Interactive demo — five puzzles, four heuristic stacks, one solver',
        markup: root.BacktrackingTemplate.render()
      },
      diagram: diagram(),
      insight: 'The undo is the invariant, and the way to keep it honest is to make the undo ' +
        'consume a record produced by the do. Propagation here returns the list of cells it ' +
        'filled, and the caller empties exactly those. Nothing recomputes what "should" have ' +
        'changed. The persistent structures in M09 make the same argument from the other ' +
        'direction. If the state on the way down is immutable, there is no undo to get wrong. In ' +
        'a solver that runs millions of nodes a second, the record-and-replay version is usually ' +
        'the one that fits in cache.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.BacktrackingTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  const solveFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const stack = STACKS.filter(function (entry) { return entry.id === parts[1]; })[0] || STACKS[0];
    const options = Object.assign({ nodeBudget: Number(parts[2]) * 1000 }, stack.options);
    return root.Backtracking.solveSudoku(PUZZLES[parts[0]].cells, options);
  });

  function keyFor(values, puzzle, heuristic) {
    return (puzzle || values['bkt-puzzle']) + '|' + (heuristic || values['bkt-heuristic']) + '|' +
      values['bkt-budget'];
  }

  function update() {
    const values = panel.values();
    const run = solveFor(keyFor(values));

    paintMetrics(run, values);
    paintGrid(values, run);
    paintHeuristics(values);
    paintMatrix(values);
    paintColouring(values);
  }

  function paintMetrics(run, values) {
    root.MetricGrid.update({
      'bkt-nodes': {
        value: root.Format.exact(run.report.nodes),
        note: run.report.budgetExhausted ? 'budget of ' + root.Format.exact(Number(values['bkt-budget']) * 1000) +
          ' exhausted' : root.Format.exact(run.report.placements) + ' digits tried'
      },
      'bkt-backtracks': {
        value: root.Format.exact(run.report.backtracks),
        note: 'each one restores the grid exactly'
      },
      'bkt-propagations': {
        value: root.Format.exact(run.report.propagations),
        note: run.report.propagations ? 'cells forced without a guess' : 'propagation is switched off'
      },
      'bkt-solved': {
        value: run.solved ? 'yes' : 'no',
        note: run.solved ? 'grid verified against the clues' : 'the budget ran out first'
      }
    });
  }

  function paintGrid(values, run) {
    const clues = root.Backtracking.parsePuzzle(PUZZLES[values['bkt-puzzle']].cells);
    const grid = run.grid || clues;
    let html = '<div style="display:grid;grid-template-columns:repeat(9,1fr);gap:2px;max-width:320px">';
    for (let cell = 0; cell < 81; cell += 1) {
      const given = clues[cell] !== 0;
      const value = grid[cell] || '';
      html += '<div class="mono" style="text-align:center;padding:.25rem 0;border-radius:3px;' +
        'background:var(--surface-sunken);font-weight:' + (given ? '700' : '400') + '">' + value + '</div>';
    }
    html += '</div>';

    root.jQuery('#bkt-grid').html(html);
    root.jQuery('#bkt-grid-note').text(run.solved
      ? 'Solved. The bold digits are the clues; every other cell was filled by the search, and the ' +
        'clues are unchanged, which is the first thing to check when a solver claims an answer.'
      : 'Not solved within the budget — the grid shown is the puzzle as given. Raise the budget or switch on ' +
        'a heuristic; both are legitimate answers and only one of them scales.');
  }

  function paintHeuristics(values) {
    const control = solveFor(keyFor(values, null, 'naive'));
    const html = STACKS.map(function (stack) {
      const run = solveFor(keyFor(values, null, stack.id));
      const ratio = run.report.nodes > 0 ? control.report.nodes / run.report.nodes : 0;
      return '<tr' + (stack.id === values['bkt-heuristic'] ? ' style="font-weight:600"' : '') + '>' +
        '<td>' + stack.label + '</td>' +
        '<td class="mono">' + root.Format.exact(run.report.nodes) + (run.report.budgetExhausted ? '+' : '') + '</td>' +
        '<td class="mono">' + root.Format.exact(run.report.backtracks) + '</td>' +
        '<td class="mono">' + root.Format.exact(run.report.propagations) + '</td>' +
        '<td class="mono">' + (run.solved ? 'yes' : 'no') + '</td>' +
        '<td class="mono">' + (control.report.budgetExhausted ? '—' : root.Format.fixed(ratio, 1) + '×') + '</td></tr>';
    }).join('');

    root.jQuery('#bkt-heuristics tbody').html(html);
    root.jQuery('#bkt-heuristics-note').text('A "+" on a node count means the budget ran out, so the real ' +
      'figure is larger and unknown — that is an honest cell, and treating it as a number would not be. The ' +
      'last column is blank whenever the control itself did not finish, for the same reason: a ratio against ' +
      'an unfinished run is not a ratio.');
  }

  /* Memoised on the budget alone: the matrix does not depend on which puzzle
     or heuristic is selected, and recomputing twenty searches every time a
     select changes is two seconds of nothing. */
  const matrixFor = root.Helpers.memoise(function (key) {
    const budget = Number(key) * 1000;
    return Object.keys(PUZZLES).map(function (puzzle) {
      return {
        puzzle: puzzle,
        cells: STACKS.map(function (stack) {
          return root.Backtracking.solveSudoku(PUZZLES[puzzle].cells,
            Object.assign({ nodeBudget: budget }, stack.options)).report;
        })
      };
    });
  });

  function paintMatrix(values) {
    const html = matrixFor(String(values['bkt-budget'])).map(function (row) {
      const cells = row.cells.map(function (report) {
        return '<td class="mono">' + root.Format.exact(report.nodes) +
          (report.budgetExhausted ? '+' : '') + '</td>';
      }).join('');
      return '<tr' + (row.puzzle === values['bkt-puzzle'] ? ' style="font-weight:600"' : '') + '>' +
        '<td>' + PUZZLES[row.puzzle].label + '</td>' + cells + '</tr>';
    }).join('');

    root.jQuery('#bkt-matrix tbody').html(html);
    root.jQuery('#bkt-matrix-note').text('Read down the MRV column rather than across one row. On four of ' +
      'these puzzles MRV is an enormous improvement; on "platinum blonde" it is a catastrophe, and the ' +
      'first-empty-cell order finishes where MRV does not. A heuristic is a bet about the instance ' +
      'distribution, and this table is what the bet looks like when it is written down instead of assumed.');
  }

  function graphFor(seed) {
    const random = root.Random.seeded(seed);
    const n = 30;
    const adjacency = [];
    for (let i = 0; i < n; i += 1) adjacency.push([]);
    for (let i = 0; i < n; i += 1) {
      for (let j = i + 1; j < n; j += 1) {
        if (random.next() >= 0.18) continue;
        adjacency[i].push(j);
        adjacency[j].push(i);
      }
    }
    return adjacency;
  }

  const colouringFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const adjacency = graphFor(7);
    return {
      plain: root.Backtracking.colourGraph(adjacency, Number(parts[0]), { nodeBudget: 2000000 }),
      ordered: root.Backtracking.colourGraph(adjacency, Number(parts[0]),
        { degreeOrder: true, nodeBudget: 2000000 })
    };
  });

  function paintColouring(values) {
    const run = colouringFor(values['bkt-colour'] + '|');
    const rows = [
      { label: 'vertex index order', result: run.plain },
      { label: 'highest degree first', result: run.ordered }
    ];

    const html = rows.map(function (row) {
      return '<tr><td>' + row.label + '</td>' +
        '<td class="mono">' + values['bkt-colour'] + '</td>' +
        '<td class="mono">' + root.Format.exact(row.result.report.nodes) +
        (row.result.report.budgetExhausted ? '+' : '') + '</td>' +
        '<td class="mono">' + root.Format.exact(row.result.report.backtracks) + '</td>' +
        '<td class="mono">' + (row.result.coloured ? 'yes' : 'no') + '</td></tr>';
    }).join('');

    root.jQuery('#bkt-colouring tbody').html(html);
    root.jQuery('#bkt-colouring-note').text('The same solver, a different constraint: no two adjacent ' +
      'vertices may share a colour, over a 30-vertex random graph. Ordering by degree is the cheapest ' +
      'heuristic in this section — one sort, before the search starts — and on a graph near its chromatic ' +
      'number it is usually the difference between finishing and not. Drop the colour count by one and watch ' +
      'both rows go from instant to hopeless: the hard instances are the ones just below the threshold, not ' +
      'the ones far above or far below it.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

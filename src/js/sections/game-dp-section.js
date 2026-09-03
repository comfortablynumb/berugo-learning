/**
 * Section: game DP and combinatorial games.
 *
 * Two results, both about refusing to build a product state space.
 *
 * Alpha-beta returns minimax's value from a fraction of the nodes, and the
 * fraction is decided by move ordering rather than by the algorithm. The
 * ordering table runs four orderings on the same position and reports the
 * value alongside the node count, because an alpha-beta bug prunes a branch it
 * should have searched and returns a plausible number - so the value column is
 * the check and the node column is the result.
 *
 * One of those orderings is on the page to make a negative point: reversing
 * the move list is NOT a worse ordering on a symmetric board. It prunes
 * identically, which is worth showing, because "shuffle the moves and see" is
 * how people usually test an ordering heuristic.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'game-dp';
  let panel = null;

  const GAMES = {
    nim: { label: 'Nim', moves: function () { return root.GameTheory.nimMoves(); } },
    sub134: { label: 'subtraction {1, 3, 4}',
      moves: function () { return root.GameTheory.subtractionMoves([1, 3, 4]); } },
    sub12: { label: 'subtraction {1, 2}',
      moves: function () { return root.GameTheory.subtractionMoves([1, 2]); } },
    sub235: { label: 'subtraction {2, 3, 5}',
      moves: function () { return root.GameTheory.subtractionMoves([2, 3, 5]); } }
  };

  const ORDERINGS = {
    centre: { label: 'centre, then corners, then edges', fn: function () { return root.GameTheory.centreFirst; } },
    none: { label: 'none — board order', fn: function () { return null; } },
    reverse: { label: 'board order reversed', fn: function () { return root.GameTheory.reverseOrder; } },
    edges: { label: 'edges, then corners, then centre', fn: function () { return root.GameTheory.edgesFirst; } }
  };

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — an alpha-beta cutoff',
      caption: 'The maximiser already has 5 in hand. The minimiser below finds a 3, so this node can only ' +
        'end at 3 or lower - which the maximiser will never choose. Its remaining moves cannot change the ' +
        'answer and are never searched.',
      definition: [
        'flowchart TD',
        '    A["MAX: best so far = 5 (alpha)"] --> B["MIN node"]',
        '    B --> C["move 1 → 3"]',
        '    B --> D["move 2 → not searched"]',
        '    B --> E["move 3 → not searched"]',
        '    C --> F["MIN will take 3 or less"]',
        '    F --> G["3 <= alpha, so MAX ignores this whole node"]'
      ].join('\n')
    };
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        '**A two-player game is a DP over positions.** The value of a position is the best ' +
          'value its moves lead to, with "best" alternating between the players.',
        'Minimax is that recursion written out, and on tic-tac-toe from an empty board it visits ' +
          '549 946 nodes. Alpha-beta returns the same value from a fraction of them, by noticing ' +
          'when a node cannot influence the answer.',
        '**Alpha-beta\'s saving belongs to the move ordering, not to alpha-beta.** With perfect ' +
          'ordering the search is about the square root of the tree. With bad ordering it ' +
          'approaches the whole thing.',
        'On this board, centre-first visits 7 275 nodes and edges-first visits 42 094. That is a ' +
          'factor of 5.8 between two orderings of the same algorithm on the same position, both ' +
          'returning the same value.',
        '**Reversing the move list is not a bad ordering, and the table shows it.** Board order ' +
          'and reversed board order prune *identically* here, because the board is symmetric.',
        'A bad ordering has to be bad about the game rather than about the array, which is ' +
          'exactly why "try it backwards" is a useless test of an ordering heuristic.',
        '**Sprague–Grundy refuses to build the product.** A sum of impartial games is equivalent ' +
          'to a single Nim heap whose size is the XOR of the components\' Grundy numbers, and ' +
          'that is exact rather than approximate. Three heaps of seven is 512 joint states ' +
          'against three independent tables of eight.',
        'Recognising that a position decomposes into independent components is the whole trick. ' +
          'The demo computes the answer both ways, so the equivalence is checked rather than ' +
          'asserted.'
      ],
      demo: {
        title: 'Interactive demo — ordering against node count, and XOR against the product',
        markup: root.GameDpTemplate.render()
      },
      diagram: diagram(),
      insight: 'When a game position is really several independent positions side by side, the ' +
        'state space you are about to build is a product you do not need. Grundy numbers are the ' +
        'formal version of that observation for impartial games, and the habit generalises. ' +
        'Before enumerating a combined state, ask whether the components interact at all. If ' +
        'they do not, solve them separately and combine the answers. If they interact only ' +
        'weakly, that is usually where the useful approximation lives. The same instinct is what ' +
        'makes a search over one dimension possible when the joint search over all of them is ' +
        'not.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.GameDpTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  const searchFor = root.Helpers.memoise(function () {
    const game = root.GameTheory.ticTacToe();
    const minimax = root.GameTheory.minimax(game, game.empty, {});
    const orderings = Object.keys(ORDERINGS).map(function (name) {
      const order = ORDERINGS[name].fn();
      const run = root.GameTheory.alphaBeta(game, game.empty, order ? { orderMoves: order } : {});
      return { name: name, label: ORDERINGS[name].label, run: run };
    });
    return { minimax: minimax, orderings: orderings };
  });

  const grundyFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const moves = GAMES[parts[0]].moves();
    const table = root.GameTheory.grundyTable(Number(parts[1]), moves, {});
    return { label: GAMES[parts[0]].label, moves: moves, table: table,
      period: root.GameTheory.grundyPeriod(table.grundy, {}) };
  });

  const sumFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const moves = GAMES[parts[0]].moves();
    const size = Number(parts[1]);
    const heaps = [size, size, size];
    const table = root.GameTheory.grundyTable(size, moves, {});
    const xor = root.GameTheory.grundyOfSum(heaps, table.grundy);
    const joint = root.GameTheory.jointGameWinner(heaps, moves, {});
    return { heaps: heaps, xor: xor, joint: joint, table: table,
      agrees: (xor !== 0) === joint.firstPlayerWins };
  });

  /* Retrograde analysis over the one-heap game, so the label counts can be
     checked against the Grundy table's zeros - two different algorithms
     answering the same question. */
  const retroFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const moves = GAMES[parts[0]].moves();
    const limit = Number(parts[1]);
    const states = [];

    for (let size = 0; size <= limit; size += 1) states.push(size);
    const run = root.GameTheory.retrograde(states, moves, function (size) {
      return moves(size).length === 0 ? 'lose' : null;
    }, {});
    const counts = { win: 0, lose: 0, draw: 0 };

    run.label.forEach(function (label) { counts[label] += 1; });
    return { counts: counts, run: run, limit: limit };
  });

  function update() {
    const values = panel.values();
    const search = searchFor('tictactoe');
    const grundy = grundyFor(values['gdp-game'] + '|' + values['gdp-limit']);
    const sum = sumFor(values['gdp-game'] + '|' + values['gdp-heaps']);

    paintMetrics(search, sum, values['gdp-order']);
    paintOrdering(search);
    paintGrundy(grundy);
    paintSum(sum);
    paintRetro(retroFor(values['gdp-game'] + '|' + values['gdp-limit']), grundy);
  }

  function paintMetrics(search, sum, chosen) {
    const selected = search.orderings.filter(function (row) { return row.name === chosen; })[0];
    const nodes = selected.run.report.nodes;

    root.MetricGrid.update({
      'gdp-minimax': { value: root.Format.exact(search.minimax.report.nodes),
        note: root.Format.exact(search.minimax.report.leaves) + ' terminal positions' },
      'gdp-ab': { value: root.Format.exact(nodes),
        note: selected.run.value === search.minimax.value
          ? 'the same value as minimax' : 'ALPHA-BETA DISAGREES WITH MINIMAX' },
      'gdp-saving': { value: root.Format.fixed(search.minimax.report.nodes / nodes, 1) + '×',
        note: 'under "' + selected.label + '"' },
      'gdp-grundy': { value: String(sum.xor),
        note: sum.xor === 0 ? 'the player to move loses with correct play'
          : 'the player to move wins with correct play' }
    });
  }

  function paintOrdering(search) {
    const html = search.orderings.map(function (row) {
      return '<tr><td>' + row.label + '</td>' +
        '<td class="mono">' + row.run.value + '</td>' +
        '<td class="mono">' + root.Format.exact(row.run.report.nodes) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.run.report.pruned) + '</td>' +
        '<td class="mono">' + root.Format.fixed(
          search.minimax.report.nodes / row.run.report.nodes, 1) + '×</td></tr>';
    }).join('');

    root.jQuery('#gdp-ordering tbody').html(html);
    root.jQuery('#gdp-ordering-note').text('Every row returns ' + search.minimax.value +
      ', the same value plain minimax computes from ' + root.Format.exact(search.minimax.report.nodes) +
      ' nodes — tic-tac-toe is a draw. The node counts span a factor of '
      + root.Format.fixed(Math.max.apply(null, search.orderings.map(function (r) { return r.run.report.nodes; })) /
        Math.min.apply(null, search.orderings.map(function (r) { return r.run.report.nodes; })), 1)
      + '. Board order and reversed board order are identical, because the board is symmetric: a worse '
      + 'ordering has to be worse about the game, not about the array.');
  }

  function paintGrundy(grundy) {
    const shown = grundy.table.grundy.slice(0, 32);

    root.MatrixView.render(root.jQuery('#gdp-table')[0], {
      columns: ['heap size'].concat(shown.map(function (ignored, i) { return String(i); })),
      rows: [
        { cells: ['Grundy value'].concat(shown.map(function (value) {
          return { value: value, highlight: value === 0 };
        })) },
        { cells: ['losing position?'].concat(shown.map(function (value) {
          return { value: value === 0 ? 'L' : '', muted: value !== 0 };
        })) }
      ]
    });
    root.jQuery('#gdp-table-note').text(grundy.label + '. Highlighted cells are Grundy 0, which are exactly '
      + 'the losing positions — a position is lost precisely when every move leads to a won one. '
      + (grundy.period
        ? 'The sequence is periodic with period ' + grundy.period.period + ', which is why a table of '
          + 'this size answers for any heap.'
        : 'No period is visible inside this table — Nim\'s Grundy value is the heap size itself, which '
          + 'never repeats.'));
  }

  function paintSum(sum) {
    const rows = [
      { method: 'Sprague–Grundy (XOR of three tables)',
        states: sum.table.report.states,
        verdict: sum.xor !== 0 ? 'first player wins' : 'first player loses' },
      { method: 'the joint state space', states: sum.joint.report.states,
        verdict: sum.joint.firstPlayerWins ? 'first player wins' : 'first player loses' }
    ];
    const html = rows.map(function (row) {
      return '<tr><td>' + row.method + '</td>' +
        '<td class="mono">' + root.Format.exact(row.states) + '</td>' +
        '<td>' + row.verdict + '</td>' +
        '<td>' + (sum.agrees ? 'yes' : 'NO') + '</td></tr>';
    }).join('');

    root.jQuery('#gdp-sum tbody').html(html);
    root.jQuery('#gdp-sum-note').text('Three heaps of ' + sum.heaps[0] + '. The XOR is ' + sum.xor +
      ', and it is exact rather than a heuristic: the sum of impartial games is equivalent to one Nim heap '
      + 'of that size. The joint search examines every reachable triple, and the whole point is that it '
      + 'never has to be built.');
  }

  function paintRetro(retro, grundy) {
    const zeros = grundy.table.grundy.slice(0, retro.limit + 1)
      .filter(function (value) { return value === 0; }).length;
    const rows = [
      { label: 'win', count: retro.counts.win, meaning: 'some move leads to a losing position' },
      { label: 'lose', count: retro.counts.lose,
        meaning: 'every move leads to a winning position — Grundy 0' },
      { label: 'draw', count: retro.counts.draw,
        meaning: 'neither, which needs a cycle; a one-heap game has none' }
    ];
    const html = rows.map(function (row) {
      return '<tr><td class="mono">' + row.label + '</td>' +
        '<td class="mono">' + root.Format.exact(row.count) + '</td>' +
        '<td>' + row.meaning + '</td></tr>';
    }).join('');

    root.jQuery('#gdp-retro tbody').html(html);
    root.jQuery('#gdp-retro-note').text('Retrograde analysis works backwards from the terminal positions, '
      + 'counting each state\'s unresolved successors — which is how endgame tables are built and, unlike '
      + 'a forward memoised search, it handles cycles as draws rather than as infinite recursion. It found '
      + retro.counts.lose + ' losing positions and the Grundy table has ' + zeros + ' zeros; '
      + (retro.counts.lose === zeros ? 'two different algorithms, one answer.'
        : 'THEY DISAGREE, which means one of them is wrong.'));
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

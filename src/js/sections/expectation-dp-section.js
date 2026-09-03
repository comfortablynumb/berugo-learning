/**
 * Section: probability and expectation DP.
 *
 * The claim is that a cyclic expectation is a linear system rather than a
 * recursion, and the page makes it by *detecting* the cycle rather than by
 * being told: `solveExpectation` runs a topological sort and reports which
 * route it took. On an acyclic chain the recursion and the elimination are run
 * side by side and asserted to agree, which is what makes the elimination
 * trustworthy on the cyclic boards where no other check exists.
 *
 * Monte Carlo is on the page for a different job. It is far too noisy to check
 * arithmetic; what it checks is the *model*. A transition table that does not
 * describe the game gives an exact answer to the wrong question, and only
 * simulating the rules as written catches that. The interval is reported so
 * "agrees" is a claim with a confidence attached.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'expectation-dp';
  const SECRETARY_N = 100;
  let panel = null;

  const BOARDS = {
    none: { label: 'no snakes or ladders', snakes: {} },
    snakes: { label: 'two snakes', snakes: null },
    ladders: { label: 'two ladders', snakes: null }
  };

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — an absorbing chain with a cycle',
      caption: 'The self-loop is the overshoot rule: a roll that would pass the end leaves you where you ' +
        'are. A recursion asks square 18 for its own expectation while computing it, and never finishes. ' +
        'As algebra it is one equation with E[18] on both sides, which rearranges in one line.',
      definition: [
        'flowchart LR',
        '    S17["17"] -->|"1/6 each"| S18["18"]',
        '    S18 -->|"roll 2: finish"| E["20 — absorbing"]',
        '    S18 -->|"roll 3..6: overshoot"| S18',
        '    S18 -->|"snake"| S4["4"]',
        '    S4 --> S17'
      ].join('\n')
    };
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        '**An expected-value recurrence over an acyclic state graph is an ordinary DP:** ' +
          '`E[s] = cost(s) + Σ p(s→t)·E[t]`, evaluated in topological order. Every board game, ' +
          'queue and retry loop starts out looking like this, and the recursion is the obvious ' +
          'implementation.',
        '**Then the state graph gains a cycle and the recursion stops existing.** A square whose ' +
          'roll can leave you where you are — the overshoot rule at the end of a board — makes ' +
          'E[s] depend on E[s]. A memoised solver then either recurses forever, or returns ' +
          'whatever half-filled value was in the memo.',
        'A snake back to an earlier square does the same thing over a longer loop. Neither is an ' +
          'exotic rule. Both are in the game as written.',
        '**The fix is to stop treating it as a recursion.** `E[s] − Σ p(s→t)·E[t] = cost(s)` is ' +
          'one row of a linear system, and n states give n equations. Gaussian elimination ' +
          'answers in twenty lines what no amount of memoisation can.',
        'The solver on this page detects the cycle itself and reports which route it took. On ' +
          'acyclic boards the two routes are run side by side, and agree to nine decimal places.',
        '**Partial pivoting is not optional here.** A chain whose first transient state has no ' +
          'self-loop puts a zero on the diagonal. An unpivoted elimination divides by it and ' +
          'produces Infinity, then NaN. The NaN propagates through the back-substitution into a ' +
          'table of them, far from the row that actually failed.',
        'Monte Carlo is the third opinion. It is too noisy to check the arithmetic, and it is the ' +
          'only thing that checks the *model*.'
      ],
      demo: {
        title: 'Interactive demo — a board with cycles, solved exactly and simulated',
        markup: root.ExpectationDpTemplate.render()
      },
      diagram: diagram(),
      insight: 'The moment an expectation can return to a state it has already been in, stop ' +
        'writing the recursion and start writing the matrix. Recognising that early is the ' +
        'difference between twenty lines of elimination and an afternoon spent wondering why a ' +
        'memo returns different answers on different runs. The tell is easy to check and easy to ' +
        'skip. Run a topological sort over the transition graph before writing the solver. If it ' +
        'fails, you do not have a DP. You have a system of equations that happens to be written ' +
        'recursively.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.ExpectationDpTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  function snakesFor(kind, size) {
    if (kind === 'snakes') {
      const out = {};
      out[Math.floor(size * 0.85)] = Math.floor(size * 0.2);
      out[Math.floor(size * 0.65)] = Math.floor(size * 0.1);
      return out;
    }

    if (kind === 'ladders') {
      const out = {};
      out[Math.floor(size * 0.2)] = Math.floor(size * 0.6);
      out[Math.floor(size * 0.35)] = Math.floor(size * 0.75);
      return out;
    }
    return {};
  }

  const boardFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const size = Number(parts[0]);
    const chain = root.ExpectationDp.boardGame({ size: size, faces: Number(parts[1]),
      snakes: snakesFor(parts[2], size) });
    const solved = root.ExpectationDp.solveExpectation(chain, {});
    return { chain: chain, solved: solved,
      stochastic: root.ExpectationDp.checkStochastic(chain, {}) };
  });

  const simulationFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const board = boardFor(parts.slice(0, 3).join('|'));
    return root.ExpectationDp.monteCarlo(board.chain, 0, root.Random.seeded(11),
      { trials: Number(parts[3]) * 1000 });
  });

  /**
   * A strictly forward chain, so the recursion and the elimination can be run
   * on the same input and compared. Without this row the linear solver is
   * checked by nothing but the simulation, which is far too noisy to certify
   * nine decimal places.
   */
  const acyclicFor = root.Helpers.memoise(function (key) {
    const n = Math.min(Number(key), 30);
    const chain = {
      states: Array.from({ length: n + 1 }, function (ignored, i) { return i; }),
      absorbing: function (state) { return state === n; },
      transitions: function (state) {
        return [{ to: Math.min(n, state + 1), probability: 0.5 },
          { to: Math.min(n, state + 2), probability: 0.5 }];
      }
    };
    const acyclic = root.ExpectationDp.topologicalOrder(chain) !== null;
    return { chain: chain, acyclic: acyclic,
      recursion: acyclic ? root.ExpectationDp.byRecursion(chain, {}) : null,
      elimination: root.ExpectationDp.byElimination(chain, {}) };
  });

  const secretaryFor = root.Helpers.memoise(function () {
    return root.ExpectationDp.secretarySweep(SECRETARY_N);
  });

  function keyFor(values) {
    return values['exp-size'] + '|' + values['exp-faces'] + '|' + values['exp-snakes'];
  }

  function update() {
    const values = panel.values();
    const key = keyFor(values);
    const board = boardFor(key);
    const simulation = simulationFor(key + '|' + values['exp-trials']);

    paintMetrics(board, simulation);
    paintCompare(board, simulation);
    paintCycles(values, acyclicFor(String(values['exp-size'])));
    paintSystem(board);
    paintSecretary(secretaryFor('secretary'));
  }

  function insideInterval(value, interval) {
    return value >= interval[0] && value <= interval[1];
  }

  function paintMetrics(board, simulation) {
    const exact = board.solved.expected.get(0);

    root.MetricGrid.update({
      'exp-expected': { value: root.Format.fixed(exact, 4),
        note: board.stochastic.valid ? 'every row of probabilities sums to one'
          : 'A ROW OF PROBABILITIES DOES NOT SUM TO ONE' },
      'exp-method': { value: board.solved.method,
        note: board.solved.acyclic ? 'no cycle, so a recursion suffices'
          : 'a cycle was detected, so it is a linear system' },
      'exp-mc': { value: root.Format.fixed(simulation.mean, 4),
        note: root.Format.exact(simulation.trials) + ' simulated games' },
      'exp-inside': { value: insideInterval(exact, simulation.interval) ? 'yes' : 'no',
        note: '±' + root.Format.fixed(simulation.halfWidth, 4) + ' at 95% confidence' }
    });
  }

  function paintCompare(board, simulation) {
    const exact = board.solved.expected.get(0);
    const rows = [
      { quantity: 'exact expectation', value: root.Format.fixed(exact, 6),
        note: 'from ' + board.solved.method },
      { quantity: 'Monte Carlo mean', value: root.Format.fixed(simulation.mean, 6),
        note: root.Format.exact(simulation.trials) + ' trials' },
      { quantity: '95% interval', value: '[' + root.Format.fixed(simulation.interval[0], 4) + ', '
        + root.Format.fixed(simulation.interval[1], 4) + ']',
      note: 'half-width ' + root.Format.fixed(simulation.halfWidth, 4) },
      { quantity: 'difference', value: root.Format.fixed(Math.abs(exact - simulation.mean), 6),
        note: root.Format.fixed(100 * Math.abs(exact - simulation.mean) / exact, 3) + '% of the exact value' }
    ];
    const html = rows.map(function (row) {
      return '<tr><td>' + row.quantity + '</td><td class="mono">' + row.value + '</td>' +
        '<td>' + row.note + '</td></tr>';
    }).join('');

    root.jQuery('#exp-compare tbody').html(html);
    root.jQuery('#exp-compare-note').text(insideInterval(exact, simulation.interval)
      ? 'The exact answer lies inside the simulated interval, which is what "agrees" has to mean when one '
        + 'of the two numbers is random. Quadrupling the trials halves the interval, so agreement at a '
        + 'stated confidence is a much stronger claim than two numbers looking similar.'
      : 'The exact answer is OUTSIDE the interval. At 95% confidence that happens one time in twenty by '
        + 'chance — but it is also exactly what a wrong transition table looks like, so it is worth '
        + 'moving the trial count before believing either.');
  }

  function paintCycles(values, acyclic) {
    const kinds = ['none', 'snakes', 'ladders'];
    const rows = kinds.map(function (kind) {
      const board = boardFor(values['exp-size'] + '|' + values['exp-faces'] + '|' + kind);
      return { label: BOARDS[kind].label, acyclic: board.solved.acyclic,
        method: board.solved.method, expected: board.solved.expected.get(0) };
    });
    const html = rows.map(function (row) {
      return '<tr><td>' + row.label + '</td>' +
        '<td>' + (row.acyclic ? 'yes' : 'no') + '</td>' +
        '<td>' + (row.acyclic ? 'works' : 'never terminates') + '</td>' +
        '<td>works</td>' +
        '<td class="mono">' + root.Format.fixed(row.expected, 4) + '</td></tr>';
    }).join('') +
      '<tr><td>a strictly forward chain (the control)</td><td>' + (acyclic.acyclic ? 'yes' : 'no') +
      '</td><td class="mono">' + (acyclic.recursion
      ? root.Format.fixed(acyclic.recursion.expected.get(0), 9) : '—') + '</td>' +
      '<td class="mono">' + root.Format.fixed(acyclic.elimination.expected.get(0), 9) + '</td>' +
      '<td>' + (acyclic.recursion && Math.abs(acyclic.recursion.expected.get(0) -
        acyclic.elimination.expected.get(0)) < 1e-9 ? 'identical to nine places' : 'THEY DISAGREE') +
      '</td></tr>';

    root.jQuery('#exp-cycles tbody').html(html);
    root.jQuery('#exp-cycles-note').text('Every board here is cyclic, because the overshoot rule is a '
      + 'self-loop on the squares near the end — that alone is enough, before any snake is added. The '
      + 'last row is the control: a strictly forward chain where both methods run, and they agree to nine '
      + 'decimal places. That agreement is what licenses trusting the elimination on the rows above, '
      + 'where the recursion cannot run at all.');
  }

  function paintSystem(board) {
    const size = board.chain.size;
    const rows = [Math.max(0, size - 3), Math.max(0, size - 2), Math.max(0, size - 1)]
      .map(function (square) {
        const edges = board.chain.transitions(square);
        const terms = {};

        edges.forEach(function (edge) {
          terms[edge.to] = (terms[edge.to] || 0) + edge.probability;
        });
        const text = Object.keys(terms).map(function (to) {
          return root.Format.fixed(terms[to], 3) + '·E[' + to + ']';
        }).join(' + ');
        return { cells: ['E[' + square + ']', '1 + ' + text,
          root.Format.fixed(board.solved.expected.get(square), 4)] };
      });

    root.MatrixView.render(root.jQuery('#exp-system')[0], {
      columns: ['State', 'Equation', 'Solution'],
      rows: rows
    });
    root.jQuery('#exp-system-note').text('The last three squares before the end. Each one names itself on '
      + 'the right-hand side, because a roll that would overshoot leaves you where you are — which is the '
      + 'self-loop, written out. As a recursion this is E[s] asking for E[s]; as algebra it moves to the '
      + 'left-hand side and the row is solved like any other.');
  }

  function paintSecretary(sweep) {
    const marks = [0, 10, 25, 37, 50, 75, 99];
    const html = marks.map(function (k) {
      const row = sweep.rows[k];
      return '<tr' + (k === sweep.best.k ? ' style="font-weight:600"' : '') + '>' +
        '<td class="mono">' + row.k + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.probability, 6) + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.k / SECRETARY_N, 3) + '</td></tr>';
    }).join('');

    root.jQuery('#exp-secretary tbody').html(html);
    root.jQuery('#exp-secretary-note').text('At n = ' + SECRETARY_N + ' the best threshold is k = '
      + sweep.best.k + ', winning ' + root.Format.fixed(sweep.best.probability, 4) + ' of the time. The '
      + 'theory says n/e = ' + root.Format.fixed(sweep.overE, 3) + ' and 1/e = '
      + root.Format.fixed(sweep.limit, 6) + '; the sweep finds them rather than assuming them, which is '
      + 'the difference between a result you can check and one you have to remember.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

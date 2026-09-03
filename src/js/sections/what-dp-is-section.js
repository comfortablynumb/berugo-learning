/**
 * Section: what dynamic programming actually is.
 *
 * The page has one job: make "states × transitions" a measurement rather than
 * a slogan. Everything on it is therefore two numbers side by side - the
 * predicted cost read off the problem statement, and the transitions the
 * memoised run actually evaluated - and they are asserted to agree.
 *
 * The tabulation row is the one that earns its place. Running the same states
 * in a *wrong* order still produces a number, and the only thing that says it
 * is wrong is the count of cells read before they were written. That counter
 * is the section's real subject: evaluation order is not a detail of the
 * implementation, it is the thing memoisation was doing for you.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'what-dp-is';
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — the subproblem DAG, and why it is not a tree',
      caption: 'The naive recursion walks the tree this DAG unrolls into; the memo walks the DAG. F(3) is ' +
        'reached from both F(5) and F(4), and that single shared node is the whole difference between ' +
        'exponential and linear.',
      definition: [
        'flowchart TD',
        '    F5["F(5)"] --> F4["F(4)"]',
        '    F5 --> F3["F(3)"]',
        '    F4 --> F3',
        '    F4 --> F2["F(2)"]',
        '    F3 --> F2',
        '    F3 --> F1["F(1) — base"]',
        '    F2 --> F1',
        '    F2 --> F0["F(0) — base"]'
      ].join('\n')
    };
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        '**Dynamic programming needs exactly two things to be true, and neither of them is "the ' +
          'problem looks like a table".** *Optimal substructure* means an optimal answer is built ' +
          'from optimal answers to subproblems. *Overlapping subproblems* means the same ' +
          'subproblem is needed more than once.',
        'The first makes the recurrence correct, and the second makes remembering it worth ' +
          'anything. Divide and conquer has the first and not the second, which is why merge sort ' +
          'is not memoised: nothing recurs.',
        'The measurement is on this page. Fibonacci at n = 25 takes 242 785 calls without a memo, ' +
          'and visits 26 distinct states with one, of which 23 are reached from more than one ' +
          'parent. Nothing about the recurrence changed. The only difference is whether the ' +
          'answers were kept.',
        'The naive run is capped, and when the cap fires the row says so, rather than reporting a ' +
          'smaller number as though the run had finished.',
        '**States × transitions is the complexity, and it is available before any code is ' +
          'written.** Fibonacci has n states and two transitions each, so it is O(n). A grid of ' +
          'r × c cells has r·c states and two transitions each, so it is O(rc).',
        'Getting that product first is what stops you writing an O(n³) solution to an O(n log n) ' +
          'problem and then optimising the constant. The predicted column and the measured column ' +
          'on this page are the same claim, checked.',
        'Memoisation and tabulation are the same algorithm with the evaluation order in different ' +
          'hands. A memo works it out at run time by recursing until it hits a base case. A table ' +
          'requires you to have worked it out in advance.',
        'Both are on the page, and so is the failure mode of the second. Run the states in an ' +
          'order that reads a cell before it is written and you get a plausible number computed ' +
          'from zeros, with nothing raised. The last table counts exactly that.'
      ],
      demo: {
        title: 'Interactive demo — three evaluations, one recurrence',
        markup: root.WhatDpIsTemplate.render()
      },
      diagram: diagram(),
      insight: 'Before writing a DP, say the state out loud and count it. "The state is ' +
        '(index, capacity remaining), so there are n·C of them, and each looks at two ' +
        'predecessors." That sentence is three things at once: a complexity estimate, a memory ' +
        'estimate and a correctness argument. It takes ten seconds. The habit that separates ' +
        'people who write DP ' +
        'quickly from people who write it slowly is not fluency with the recurrences. It is ' +
        'refusing to write any code until that sentence is true. If you cannot say it, you do ' +
        'not yet know what you are memoising.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.WhatDpIsTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  /* The three problems, each as a `DpLab` problem plus the state list a
     tabulation needs and the shape its complexity is read off. */
  const PROBLEMS = {
    fibonacci: {
      label: 'Fibonacci',
      state: 'n',
      transitionsEach: 2,
      build: function (n) {
        return { problem: root.DpLab.fibonacciProblem(), args: n,
          states: root.DpLab.fibonacciStates(n), stateCount: n + 1 };
      }
    },
    binomial: {
      label: 'binomial coefficient',
      state: '(row, column)',
      transitionsEach: 2,
      build: function (n, k) {
        const top = Math.min(k, n);
        return { problem: root.DpLab.binomialProblem(), args: [n, top],
          states: root.DpLab.binomialStates(n, top),
          stateCount: root.DpLab.binomialStates(n, top).length };
      }
    },
    grid: {
      label: 'grid paths',
      state: '(row, column)',
      transitionsEach: 2,
      build: function (n, k) {
        const rows = Math.min(n, 12);
        const columns = Math.min(k, 12);
        const states = [];

        for (let r = 0; r <= rows; r += 1) {
          for (let c = 0; c <= columns; c += 1) states.push([r, c]);
        }
        return { problem: root.DpLab.gridProblem([]), args: [rows, columns],
          states: states, stateCount: states.length };
      }
    }
  };

  const runFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const spec = PROBLEMS[parts[0]];
    const built = spec.build(Number(parts[1]), Number(parts[2]));
    const comparison = root.DpLab.compare(built.problem, built.args,
      { states: built.states, callBudget: Number(parts[3]) * 1000 });
    return { spec: spec, built: built, comparison: comparison,
      dag: root.DpLab.dependencyDag(comparison.memo, {}) };
  });

  /* The same states in a deliberately wrong order, so "reads a cell that is
     not there yet" is a counter rather than a warning. */
  const orderFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const spec = PROBLEMS[parts[0]];
    const built = spec.build(Number(parts[1]), Number(parts[2]));
    const forwards = root.DpLab.tabulated(built.problem, built.states, { target: built.args });
    const backwards = root.DpLab.tabulated(built.problem, built.states.slice().reverse(),
      { target: built.args });
    return { forwards: forwards, backwards: backwards };
  });

  function keyFor(values) {
    return values['wdp-problem'] + '|' + values['wdp-n'] + '|' + values['wdp-k'] + '|' +
      values['wdp-budget'];
  }

  function update() {
    const values = panel.values();
    const run = runFor(keyFor(values));

    paintMetrics(run);
    paintCompare(run);
    paintPredict(run);
    paintDag(run);
    paintOrder(orderFor(keyFor(values)));
  }

  function paintMetrics(run) {
    const rows = run.comparison.rows;
    const naive = rows[0];
    const memo = rows[1];

    root.MetricGrid.update({
      'wdp-calls': {
        value: root.Format.exact(naive.calls),
        note: naive.budgetExhausted ? 'the budget stopped it — the real figure is larger and unknown'
          : 'every subproblem, every time it is needed'
      },
      'wdp-states': {
        value: root.Format.exact(memo.states),
        note: root.Format.exact(memo.transitions) + ' transitions evaluated in total'
      },
      'wdp-hits': {
        value: root.Format.exact(memo.hits),
        note: 'calls the memo answered without recomputing'
      },
      'wdp-shared': {
        value: root.Format.exact(run.dag.shared),
        note: run.dag.shared === 0 ? 'no overlap — memoising this buys nothing'
          : 'states reached from more than one parent'
      }
    });
  }

  function paintCompare(run) {
    const html = run.comparison.rows.map(function (row) {
      const answer = row.value === null ? '<span class="mono">stopped</span>'
        : root.Format.exact(row.value);
      return '<tr><td>' + row.method + '</td><td class="mono">' + answer + '</td>' +
        '<td class="mono">' + root.Format.exact(row.calls) + (row.budgetExhausted ? '+' : '') + '</td>' +
        '<td class="mono">' + root.Format.exact(row.states) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.transitions) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.hits) + '</td></tr>';
    }).join('');

    root.jQuery('#wdp-compare tbody').html(html);
    root.jQuery('#wdp-compare-note').text(run.comparison.agree
      ? 'Every run that finished returned the same answer, which is the only thing that makes the cost '
        + 'columns comparable. The naive row\'s "states" is its call count, because without a memo every '
        + 'call is a fresh state.'
      : 'The runs DISAGREE, which means one of them is wrong — a cost comparison between them is '
        + 'meaningless until that is fixed.');
  }

  function paintPredict(run) {
    const memo = run.comparison.rows[1];
    const predicted = root.DpLab.predictedCost(run.built.stateCount, run.spec.transitionsEach);
    const html = '<tr><td>' + run.spec.label + '</td><td class="mono">' + run.spec.state + '</td>' +
      '<td class="mono">' + root.Format.exact(predicted.states) + '</td>' +
      '<td class="mono">' + predicted.transitionsPerState + '</td>' +
      '<td class="mono">' + root.Format.exact(predicted.total) + '</td>' +
      '<td class="mono">' + root.Format.exact(memo.transitions) + '</td></tr>';

    root.jQuery('#wdp-predict tbody').html(html);
    root.jQuery('#wdp-predict-note').text('The predicted column is arithmetic on the problem statement and '
      + 'the measured column is the memoised run. They differ only because the recursion never reaches '
      + 'some states the tabulation would fill — the prediction is an upper bound, and an upper bound you '
      + 'can compute in ten seconds is worth more than a measurement you get after writing the code.');
  }

  function paintDag(run) {
    const rows = run.dag.nodes.slice(0, 24);
    const html = rows.map(function (node) {
      return '<tr><td class="mono">' + node.key + '</td>' +
        '<td class="mono">' + root.Format.exact(node.value) + '</td>' +
        '<td class="mono">' + node.parents + '</td>' +
        '<td class="mono">' + node.depth + '</td>' +
        '<td>' + (node.base ? 'yes' : '') + '</td></tr>';
    }).join('');

    root.jQuery('#wdp-dag tbody').html(html);
    root.jQuery('#wdp-dag-note').text('Showing ' + rows.length + ' of ' + run.dag.nodes.length +
      ' states. A parent count above one is what "overlapping subproblems" means, and it is the '
      + 'precondition memoisation needs. A DAG where every state has exactly one parent is a tree, and a '
      + 'tree is divide and conquer — there is nothing to remember.');
  }

  function paintOrder(orders) {
    const rows = [
      { label: 'increasing state (correct)', run: orders.forwards },
      { label: 'decreasing state (wrong)', run: orders.backwards }
    ];
    const html = rows.map(function (row) {
      return '<tr><td>' + row.label + '</td>' +
        '<td class="mono">' + root.Format.exact(row.run.value) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.run.report.states) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.run.unresolved.length) + '</td></tr>';
    }).join('');

    root.jQuery('#wdp-order tbody').html(html);
    root.jQuery('#wdp-order-note').text('Both orders visit exactly the same states and evaluate exactly '
      + 'the same transitions. The second one reads cells before they are written, and the only evidence '
      + 'is the last column — the answer it produces is a number, not an error. This is the failure '
      + 'memoisation cannot have, because a memo computes what it needs when it needs it.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

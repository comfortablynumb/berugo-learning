/**
 * Section: Dataflow analysis.
 *
 * The measurement is the framework table: four analyses that look different
 * and are one worklist loop with four settings — a direction, a meet, an
 * initial value and a transfer function. Switching the analysis control
 * changes nothing about the algorithm and everything about the answer, which
 * is the whole point.
 *
 * The second is liveness checked against a brute-force path enumeration on
 * every fixture. A liveness analysis that is subtly wrong reports a plausible
 * set, and a register allocator built on it produces code that works on every
 * test where the wrong path was not taken.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'dataflow-analysis';
  let panel = null;
  let chart = null;
  let application = null;

  const FRAMEWORK = [
    { id: 'liveness', direction: 'backward', meet: 'union', initial: 'empty',
      answers: 'does this register still have a reader ahead of it' },
    { id: 'reaching', direction: 'forward', meet: 'union', initial: 'empty',
      answers: 'which definitions could be the current value here' },
    { id: 'available', direction: 'forward', meet: 'intersect', initial: 'everything',
      answers: 'which computations are already done on every path to here' },
    { id: 'busy', direction: 'backward', meet: 'intersect', initial: 'everything',
      answers: 'which computations will happen on every path from here' }
  ];

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — the lattice a constant-propagation domain uses',
      caption: 'Every dataflow analysis is a lattice plus a transfer function, and the lattice ' +
        'is where the analysis\'s precision lives. This one has three levels: top means ' +
        '"nothing known yet", a constant means "this exact value on every path examined so ' +
        'far", and bottom means "several values, so nothing useful". Meeting two different ' +
        'constants gives bottom, which is the whole reason a variable assigned differently in ' +
        'two branches is not constant after the join. The height is what guarantees ' +
        'termination: a fact can only move downward and there are three levels, so the ' +
        'iteration cannot run forever — and an analysis whose lattice has infinite height ' +
        'needs a widening operator to stop.',
      definition: [
        'graph TD',
        'T["⊤ — nothing known yet"] --> C1["1"]',
        'T --> C2["2"]',
        'T --> C3["... any constant"]',
        'C1 --> B["⊥ — several values, nothing useful"]',
        'C2 --> B',
        'C3 --> B'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**Every dataflow analysis is the same algorithm with a different lattice and transfer ' +
        'function.** Recognising that turns "write a new analysis" into "define a domain", ' +
        'which is a day rather than a month — and it is the single most useful thing to know ' +
        'about this subject. The demo runs four of them through one solver.',
      '**A direction and a meet, and the four combinations are all used.** Forward or ' +
        'backward, union or intersection: liveness is backward-union, reaching definitions is ' +
        'forward-union, available expressions is forward-intersection, very busy is ' +
        'backward-intersection. Nothing else is needed to describe any of the four.',
      '**Union means "on some path", intersection means "on every path".** That is the entire ' +
        'content of the choice. A register is live if ANY successor reads it, because the ' +
        'program only has to take one of those paths; an expression is available only if EVERY ' +
        'path already computed it, because the program might take any of them.',
      '**An intersection analysis must start at the TOP of the lattice, not at empty.** ' +
        'Initialise every block to the empty set and the first meet produces empty everywhere, ' +
        'and the fixpoint is trivially nothing. Starting at the full set and letting the ' +
        'iteration remove members is the only way an intersection analysis converges to ' +
        'anything — and it is the classic implementation mistake.',
      '**The backward boundary needs the same care.** A block with no successors has nothing ' +
        'to meet, so its OUT is the boundary value rather than whatever it was initialised ' +
        'to. For very-busy expressions the initial value is the full set, and without this the ' +
        'exit block reports every expression as certain to be computed after a point from ' +
        'which no path exists.',
      '**Termination is monotonicity plus finite height, and it is an argument rather than a ' +
        'hope.** A transfer function can only move a fact one way in the lattice, and the ' +
        'lattice has finitely many levels, so there are finitely many moves. An analysis that ' +
        'does not converge in a few passes over a reducible graph has a non-monotone transfer ' +
        'function, and that is the bug to look for.',
      '**The worklist is an optimisation, not a different algorithm.** Re-examining a block ' +
        'only when a neighbour\'s fact changed reaches the same fixpoint as sweeping until ' +
        'nothing moves — the order in which monotone functions are applied cannot change where ' +
        'they converge. The visit count is reported because it is the saving, made visible.',
      '**A phi\'s operands are used on the EDGE, not in the block holding the phi.** Charging ' +
        'them to the phi\'s own block makes a value look live along paths it never travels, ' +
        'and a register allocator built on that reports interference that is not real. It is a ' +
        'three-line special case and skipping it is invisible until the allocator runs out of ' +
        'registers on a function that did not need them.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — four analyses, one solver, and a brute-force check',
        markup: root.DataflowTemplate.render()
      },
      diagram: diagram(),
      insight: '**Every dataflow analysis is the same algorithm with a different lattice and ' +
        'transfer function, and recognising that turns "write a new analysis" into "define a ' +
        'domain".** The practical consequence is larger than it sounds. Faced with a new ' +
        'question — which values are always positive here, which locks are held, which ' +
        'variables might be null — the instinct is to write a traversal, and a hand-written ' +
        'traversal over a cyclic graph is where the bugs live: it terminates by accident, or ' +
        'it visits a loop body once and reports a fact that only holds on the first iteration. ' +
        'Defining a lattice and a transfer function instead means the solver handles the ' +
        'cycle, the termination argument is inherited, and the only thing that can be wrong is ' +
        'the domain — which is small enough to reason about. The two things worth checking ' +
        'about a new domain are exactly the two that go wrong here: is the transfer function ' +
        'monotone, and is the initial value the right end of the lattice. An intersection ' +
        'analysis initialised to empty converges instantly to nothing and looks like it ran.'
    };
  }

  function render(app) {
    application = app;
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.DataflowTemplate.controls,
      onChange: function () { update(); }
    });
    update();
  }

  /* ------------------------------------------------------------ measuring */

  const stateFor = root.Helpers.memoise(function (key) {
    const parts = JSON.parse(key);
    const program = root.Berugo.IrLower.compile(root.DataflowTemplate.SAMPLES[parts[0]]).program;
    const fn = program.functions[0];

    if (parts[2]) root.Berugo.Ssa.construct(fn);
    return { fn: fn, graph: root.Berugo.Cfg.build(fn),
      result: root.Berugo.Dataflow.run(fn, parts[1]),
      all: allAnalyses(fn) };
  });

  function allAnalyses(fn) {
    const out = {};

    FRAMEWORK.forEach(function (row) {
      out[row.id] = root.Berugo.Dataflow.run(fn, row.id);
    });
    return out;
  }

  const checkFor = root.Helpers.memoise(function (ssa) {
    return Object.keys(root.DataflowTemplate.SAMPLES).map(function (id) {
      const fn = root.Berugo.IrLower.compile(root.DataflowTemplate.SAMPLES[id])
        .program.functions[0];

      if (ssa === 'true') root.Berugo.Ssa.construct(fn);
      return checkRow(id, fn);
    });
  });

  function checkRow(id, fn) {
    const fast = root.Berugo.Dataflow.run(fn, 'liveness');
    const slow = root.Berugo.Dataflow.bruteLiveness(fn);
    const graph = root.Berugo.Cfg.build(fn);
    const agree = graph.blocks.every(function (block) {
      return root.Berugo.Dataflow.sameSet(fast.out[block], slow[block]);
    });

    return { id: id, blocks: graph.blocks.length, rounds: fast.rounds,
      live: graph.blocks.reduce(function (sum, block) {
        return sum + fast.out[block].size;
      }, 0), agrees: agree };
  }

  function update() {
    const values = panel.values();
    const key = JSON.stringify([values['df-sample'], values['df-analysis'],
      Boolean(values['df-ssa'])]);
    const state = stateFor(key);

    paintGraph(state);
    paintMetrics(state, values['df-analysis'], String(Boolean(values['df-ssa'])));
    paintSets(state);
    paintFramework(state);
    paintCheck(String(Boolean(values['df-ssa'])));
    paintCost(state);
  }

  function paintGraph(state) {
    const notes = {};

    state.result.rows.forEach(function (row) {
      notes[row.id] = 'in ' + row.inSize + ' out ' + row.outSize;
    });
    if (chart && chart.chart) chart.chart.destroy();
    chart = root.CfgView.render(document.getElementById('df-graph'), {
      graph: state.graph, lazyLib: application.lazyLib, notes: notes,
      backEdges: root.Berugo.Cfg.backEdges(state.graph) });

    root.Helpers.setText('df-graph-caption',
      'The note under each block is the size of the fact at its start and end. Watching those ' +
      'two numbers across a loop is the clearest picture of what a fixpoint is: the header\'s ' +
      'IN depends on the latch\'s OUT, which depends on the header, so neither is right until ' +
      'both stop changing.');
  }

  function paintMetrics(state, analysis, ssa) {
    const found = FRAMEWORK.find(function (row) { return row.id === analysis; });
    const facts = state.result.rows.reduce(function (sum, row) {
      return sum + row.inSize + row.outSize;
    }, 0);
    const check = checkFor(ssa);

    root.MetricGrid.update({
      'df-direction': { value: found.direction + ', ' + found.meet,
        note: found.meet === 'union' ? 'a fact holds if it holds on SOME path'
          : 'a fact holds only if it holds on EVERY path, so the initial value is the full set' },
      'df-rounds': { value: root.Format.exact(state.result.rounds),
        note: 'over ' + state.result.blocks + ' blocks — a block re-enters the list only when ' +
          'a neighbour moved' },
      'df-facts': { value: root.Format.exact(facts),
        note: 'summed over the in and out sets of every block at the fixpoint' },
      'df-oracle': { value: check.filter(function (row) { return row.agrees; }).length +
        ' of ' + check.length,
      note: 'fixtures where liveness matches a path enumeration exactly' }
    });
  }

  function paintSets(state) {
    root.jQuery('#df-sets tbody').html(state.result.rows.map(function (row) {
      return '<tr><td class="mono">' + row.id + '</td><td class="mono">' +
        root.Helpers.escapeHtml(shorten(row.in)) + '</td><td class="mono">' +
        root.Helpers.escapeHtml(shorten(row.out)) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('df-sets-caption',
      'The fixpoint, block by block. For a backward analysis read OUT then IN, because that is ' +
      'the direction the facts travelled — the solver computes OUT from the successors and ' +
      'then applies the block\'s transfer function to get IN. Reading them in source order for ' +
      'a backward analysis is the commonest way to conclude the answer is wrong when it is not.');
  }

  function shorten(text) {
    return text.length > 78 ? text.slice(0, 75) + '…' : text;
  }

  function paintFramework(state) {
    root.jQuery('#df-framework tbody').html(FRAMEWORK.map(function (row) {
      const result = state.all[row.id];

      return '<tr><td class="mono">' + row.id + '</td><td>' + row.direction + '</td><td>' +
        row.meet + '</td><td>' + row.initial + '</td><td>' +
        root.Helpers.escapeHtml(row.answers) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('df-framework-caption',
      'Four analyses, four rows, one solver. Nothing in the algorithm changes between them — ' +
      'the direction picks which neighbours to meet over, the meet picks the set operation, ' +
      'and the initial value has to match: `empty` for a union analysis and `everything` for ' +
      'an intersection one. Getting that last column wrong is the classic mistake, and it is ' +
      'silent: an intersection analysis started at empty converges immediately to nothing and ' +
      'reports a perfectly well-formed fixpoint.');
  }

  function paintCheck(ssa) {
    const rows = checkFor(ssa);
    const agreeing = rows.filter(function (row) { return row.agrees; }).length;

    root.jQuery('#df-check tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + row.id + '</td><td class="mono">' + row.blocks +
        '</td><td class="mono">' + row.rounds + '</td><td class="mono">' + row.live +
        '</td><td>' + (row.agrees ? 'yes' : 'NO') + '</td></tr>';
    }).join(''));

    root.Helpers.setText('df-check-caption',
      agreeing + ' of ' + rows.length + ' agree exactly. The oracle asks the definition: a ' +
      'register is live out of a block when some path from a successor reads it before ' +
      'anything on that path writes it. That enumerates paths and is exponential, which is ' +
      'exactly what an oracle is for — a liveness analysis that is subtly wrong reports a ' +
      'plausible set, and the register allocator built on it produces code that works on every ' +
      'test where the wrong path was not taken.');
  }

  function paintCost(state) {
    root.jQuery('#df-cost tbody').html(FRAMEWORK.map(function (row) {
      const result = state.all[row.id];

      return '<tr><td class="mono">' + row.id + '</td><td class="mono">' + result.rounds +
        '</td><td class="mono">' + result.blocks + '</td><td class="mono">' +
        root.Format.fixed(result.rounds / result.blocks, 2) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('df-cost-caption',
      'Visits per block, which is the number the worklist is trying to keep small. A block is ' +
      'placed back on the list only when a neighbour\'s fact changed, so straight-line code ' +
      'costs one visit each and a loop costs a few — the loop body has to be re-examined once ' +
      'the header\'s fact settles. Sweeping the whole function until nothing moves reaches the ' +
      'same answer and pays the full sweep every round, which on a large function with one hot ' +
      'loop is most of the cost for none of the information.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

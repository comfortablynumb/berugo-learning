/**
 * Section: Dominators.
 *
 * The measurement is the comparison against a brute-force oracle: for every
 * block, which blocks does every path from the entry pass through. The
 * iterative algorithm computes it by intersecting predecessors up a tree; the
 * oracle asks whether the target is still reachable when the candidate is
 * removed. They must agree on every block of every fixture.
 *
 * The second is the round count. Reverse postorder means every predecessor
 * except a back edge already has a value, so the fixpoint is reached in one
 * pass and confirmed by a second — and a graph that needs more is one where
 * the order was not respected.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'dominators';
  let panel = null;
  let chart = null;
  let application = null;

  const QUERIES = [
    { ask: 'Is this definition available at that use?',
      form: 'does the defining block dominate the using block',
      used: 'the SSA verifier, and every pass that moves a use' },
    { ask: 'Can I hoist this out of the loop?',
      form: 'does its block dominate every exit of the loop',
      used: 'LICM, for anything that can fault' },
    { ask: 'Is this edge a back edge?',
      form: 'does the target dominate the source',
      used: 'loop detection, and therefore every loop pass' },
    { ask: 'Where does a value stop being the only possibility?',
      form: 'the dominance frontier of the defining block',
      used: 'phi placement in SSA construction' },
    { ask: 'Will this definitely run if I get here?',
      form: 'does it post-dominate this block',
      used: 'speculation, and partial redundancy elimination' },
    { ask: 'Is this computation redundant?',
      form: 'has an equal one already been computed in a dominating block',
      used: 'global value numbering' }
  ];

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — the dominator tree beside the graph it came from',
      caption: 'The graph on the left branches and rejoins; the tree on the right says, for ' +
        'each block, the nearest block every path to it passes through. The join is the ' +
        'interesting node: both arms lead to it, so neither arm dominates it and its immediate ' +
        'dominator is the branch above them. That is also why the join is in the dominance ' +
        'FRONTIER of both arms — it is the first place where a value defined in one arm stops ' +
        'being the only possibility, and therefore exactly where a phi function has to go.',
      definition: [
        'graph TD',
        'subgraph the graph',
        'E1["entry"] --> B1["branch"]',
        'B1 --> L1["then"]',
        'B1 --> R1["else"]',
        'L1 --> J1["join"]',
        'R1 --> J1',
        'end',
        'subgraph the dominator tree',
        'E2["entry"] --> B2["branch"]',
        'B2 --> L2["then"]',
        'B2 --> R2["else"]',
        'B2 --> J2["join — dominated by the branch, not by either arm"]',
        'end'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**A dominates B when every path from the entry to B goes through A.** That one relation ' +
        'answers most of the legality questions an optimiser asks, which is why it is computed ' +
        'once and cached rather than rederived per pass — and why it is the first analysis ' +
        'every compiler builds.',
      '**Every block dominates itself, and the entry dominates everything.** Both are ' +
        'degenerate and both matter: the first makes "strictly dominates" a separate relation ' +
        'that several algorithms need, and the second is the base case the iteration starts ' +
        'from.',
      '**The immediate dominator is the nearest one, and they form a tree.** Each block has ' +
        'exactly one, so the relation is a tree rather than a lattice — which is what makes ' +
        'SSA renaming a depth-first walk rather than a fixpoint, and what makes "does A ' +
        'dominate B" a walk up parents rather than a set membership test.',
      '**The iterative algorithm is twenty lines and converges in two rounds here.** ' +
        'Cooper–Harvey–Kennedy: take each block in reverse postorder and intersect the current ' +
        'answers of its predecessors, walking both fingers up the tree until they meet. ' +
        'Lengauer–Tarjan is asymptotically better and is what a production compiler uses at ' +
        'scale; this one is faster on the graphs real functions have and can be watched.',
      '**Reverse postorder is what makes it converge quickly.** Every predecessor except one ' +
        'reached by a back edge has already been given a value, so a reducible graph settles ' +
        'in a single pass and the second pass merely confirms it. A graph needing many rounds ' +
        'is a sign the order was not respected.',
      '**The dominance frontier of A is where A stops being the only possibility.** Formally: ' +
        'the blocks A does not strictly dominate but whose predecessor it does. Concretely: ' +
        'the first joins downstream of A. That is exactly where a value defined in A needs a ' +
        'phi, which is why 29.4 is a consumer of this file rather than an independent ' +
        'construction.',
      '**Post-dominance is the same relation on the reversed graph, and answers a different ' +
        'question.** B post-dominates A when every path from A to an exit goes through B — ' +
        'which is "will this definitely run". That is the safety condition for speculating a ' +
        'computation, and it is why LICM asks about loop exits rather than about the header.',
      '**A function with several exits needs a virtual one.** Post-dominance on the reversed ' +
        'graph has no single entry when a function returns from three places, so an exit node ' +
        'with an edge from each is added. It is not a hack: "every path to an exit" is a ' +
        'statement about all of them at once, and the virtual node is what makes that one ' +
        'question rather than three.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — the tree, the frontier, and a brute-force check',
        markup: root.DominatorsTemplate.render()
      },
      diagram: diagram(),
      insight: '**"Does A dominate B" answers most legality questions in an optimiser, which ' +
        'is why dominator computation is the first analysis every compiler builds and ' +
        'caches.** The table at the bottom of this section is the argument: six different ' +
        'questions, asked by six different passes, all of which reduce to a walk up one tree. ' +
        'That is unusual — most analyses answer one question — and it changes how a middle end ' +
        'is structured. The dominator tree is computed once after every change to the CFG and ' +
        'consulted freely, so a pass does not carry its own notion of "is this safe here"; it ' +
        'asks. The practical consequence for anyone reading a compiler is that dominance shows ' +
        'up in places that seem unrelated, and the right reaction is not to work out what the ' +
        'author meant but to translate the question back: nearly every use is one of the six. ' +
        'The frontier is the one worth internalising separately, because its definition is ' +
        'awkward and its meaning is not: it is the first place a value stops being the only ' +
        'possibility, which is the same sentence as "where a phi goes".'
    };
  }

  function render(app) {
    application = app;
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.DominatorsTemplate.controls,
      onChange: function () { update(); }
    });
    update();
  }

  /* ------------------------------------------------------------ measuring */

  const stateFor = root.Helpers.memoise(function (id) {
    const fn = root.Berugo.IrLower.compile(root.DominatorsTemplate.SAMPLES[id])
      .program.functions[0];
    const graph = root.Berugo.Cfg.build(fn);
    const tree = root.Berugo.Dominators.compute(graph);

    return { fn: fn, graph: graph, tree: tree,
      frontiers: root.Berugo.Dominators.frontiers(tree),
      post: root.Berugo.Dominators.postDominators(graph),
      fast: root.Berugo.Dominators.setsFrom(tree),
      slow: root.Berugo.Dominators.bruteForce(graph) };
  });

  function update() {
    const values = panel.values();
    const state = stateFor(values['dm-sample']);
    const index = Math.min(Number(values['dm-block']), state.graph.blocks.length - 1);
    const id = state.graph.blocks[index];

    paintGraph(state, id);
    paintMetrics(state, id);
    paintTable(state, id);
    paintRounds(state);
    paintOracle(state);
    paintQueries();
  }

  function paintGraph(state, id) {
    if (chart && chart.chart) chart.chart.destroy();
    chart = root.CfgView.render(document.getElementById('dm-graph'), {
      graph: state.graph, dominators: state.tree.idom, highlight: id,
      lazyLib: application.lazyLib,
      backEdges: root.Berugo.Cfg.backEdges(state.graph, state.tree),
      notes: frontierNotes(state) });

    root.Helpers.setText('dm-graph-caption',
      'Solid edges are control flow; dashed blue edges are the dominator tree drawn over the ' +
      'same layout, so the two can be compared without anything moving. A block whose dashed ' +
      'parent is not one of its solid predecessors is a join — the arms lead to it and neither ' +
      'dominates it. The note under each block is the size of its dominance frontier.');
  }

  function frontierNotes(state) {
    const notes = {};

    state.graph.blocks.forEach(function (id) {
      const size = (state.frontiers[id] || []).length;

      notes[id] = size ? 'DF ' + size : '';
    });
    return notes;
  }

  function paintMetrics(state, id) {
    const idom = root.Berugo.Dominators.immediate(state.tree, id);
    const dominated = root.Berugo.Dominators.dominated(state.tree, id);
    const frontier = state.frontiers[id] || [];

    root.MetricGrid.update({
      'dm-idom': { value: idom === null ? 'none — this is the entry' : idom,
        note: idom === null ? 'the entry dominates everything and is dominated only by itself'
          : 'the nearest block every path to ' + id + ' passes through' },
      'dm-dominates': { value: dominated.join(', ') || id,
        note: dominated.length + ' block' + (dominated.length === 1 ? '' : 's') +
          ', itself included — every path to each of them goes through ' + id },
      'dm-frontier': { value: frontier.join(', ') || 'empty',
        note: frontier.length
          ? 'a value defined in ' + id + ' needs a phi in each of these'
          : id + ' dominates everything it reaches, so nothing needs a phi for it' },
      'dm-rounds': { value: root.Format.exact(state.tree.rounds),
        note: state.tree.changes.map(function (row) {
          return row.round + ': ' + row.changes;
        }).join(', ') + ' changes per round' }
    });
  }

  function paintTable(state, id) {
    root.jQuery('#dm-table tbody').html(state.graph.blocks.map(function (block) {
      const idom = root.Berugo.Dominators.immediate(state.tree, block);

      return '<tr' + (block === id ? ' class="is-selected"' : '') + '><td class="mono">' +
        block + '</td><td class="mono">' + (idom === null ? '—' : idom) +
        '</td><td class="mono">' +
        root.Berugo.Dominators.dominated(state.tree, block).join(', ') +
        '</td><td class="mono">' + ((state.frontiers[block] || []).join(', ') || '—') +
        '</td><td class="mono">' + postDominatorsOf(state, block) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('dm-table-caption',
      'The frontier column is empty for every block that dominates everything downstream of ' +
      'it, and non-empty exactly at the blocks whose values reach a join by more than one ' +
      'path. Reading down it is reading the list of places SSA will need a phi — before any ' +
      'phi has been placed, and computed from the graph alone.');
  }

  function postDominatorsOf(state, block) {
    return state.graph.blocks.filter(function (other) {
      return other !== block && root.Berugo.Dominators.dominates(state.post, other, block);
    }).join(', ') || '—';
  }

  function paintRounds(state) {
    const meanings = ['every block gets its first answer from its predecessors',
      'nothing changed, which is what proves the fixpoint was reached'];

    root.jQuery('#dm-rounds-table tbody').html(state.tree.changes.map(function (row, at) {
      return '<tr><td class="mono">' + row.round + '</td><td class="mono">' + row.changes +
        '</td><td>' + root.Helpers.escapeHtml(meanings[Math.min(at, 1)]) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('dm-rounds-table-caption',
      state.tree.rounds + ' rounds over ' + state.graph.blocks.length + ' blocks. Reverse ' +
      'postorder is what makes that number small: every predecessor except one reached by a ' +
      'back edge already has an answer when a block is visited, so a reducible graph settles ' +
      'in the first pass and the second merely confirms it. Processing in an arbitrary order ' +
      'gives the same fixpoint and takes more rounds to reach it — the order is a performance ' +
      'decision, not a correctness one.');
  }

  function paintOracle(state) {
    const rows = state.graph.blocks.map(function (id) {
      return { id: id, fast: state.fast[id].join(', '), slow: state.slow[id].join(', ') };
    });
    const agreeing = rows.filter(function (row) { return row.fast === row.slow; }).length;

    root.jQuery('#dm-oracle tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + row.id + '</td><td class="mono">' + row.fast +
        '</td><td class="mono">' + row.slow + '</td><td>' +
        (row.fast === row.slow ? 'yes' : 'NO') + '</td></tr>';
    }).join(''));

    root.Helpers.setText('dm-oracle-caption',
      agreeing + ' of ' + rows.length + ' agree. The oracle asks the definition directly: A ' +
      'dominates B when removing A makes B unreachable from the entry. That is exponential in ' +
      'the graph and useless at scale, which is exactly what an oracle is for — the fast ' +
      'algorithm is the one that can be subtly wrong, and a wrong dominator tree produces an ' +
      'optimiser that hoists code past a branch and looks correct on every test where the ' +
      'branch goes one way.');
  }

  function paintQueries() {
    root.jQuery('#dm-queries tbody').html(QUERIES.map(function (row) {
      return '<tr><td>' + root.Helpers.escapeHtml(row.ask) + '</td><td class="mono">' +
        root.Helpers.escapeHtml(row.form) + '</td><td>' +
        root.Helpers.escapeHtml(row.used) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('dm-queries-caption',
      QUERIES.length + ' questions from six different passes, all answered by a walk up one ' +
      'tree. That is why the tree is computed once after every change to the graph and ' +
      'consulted freely, and it is why dominance appears in parts of a compiler that seem ' +
      'unrelated to control flow — the right reading of an unfamiliar use is almost always ' +
      'one of these six restated.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

/**
 * Section: Control-flow graphs.
 *
 * The measurement is loop membership checked against a brute-force oracle: for
 * each header, which blocks can reach a latch without passing through the
 * header. The fast algorithm walks predecessors from the latch; the oracle
 * enumerates paths. They must agree on every fixture including the one with
 * two latches, which is where a loop finder that treats each back edge as its
 * own loop reports two loops where there is one.
 *
 * The second is critical edges. Splitting them looks like bookkeeping, and the
 * demo shows the count before and after — but the reason is 29.4's: SSA
 * destruction has to put a copy on one specific edge, and a critical edge has
 * no block that runs on exactly that path.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'control-flow-graphs';
  let panel = null;
  let chart = null;
  let application = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — a loop, its back edge and its natural loop',
      caption: 'The header tests, the body runs, and the latch jumps back — and that last edge ' +
        'is what makes the graph cyclic. A back edge is one whose target DOMINATES its source, ' +
        'which is a stronger condition than "points at an earlier block" and is the difference ' +
        'between a loop and a goto into the middle of one. The natural loop of a back edge is ' +
        'its target plus everything that can reach its source without leaving through the ' +
        'target — the shaded region. Everything else in this milestone is stated over that ' +
        'region: what is invariant in it, what its exits are, how deep it is nested.',
      definition: [
        'graph TD',
        'E["entry"] --> H["header — tests the guard"]',
        'H -->|"true"| B["body"]',
        'B --> L["latch"]',
        'L -->|"back edge: header<br/>dominates latch"| H',
        'H -->|"false"| X["exit"]',
        'classDef loop fill:#ede9fe,stroke:#7e22ce,stroke-width:2px;',
        'class H,B,L loop;'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**A basic block is a straight run of instructions with one entry and one exit.** ' +
        'Control enters at the top and leaves at the bottom, so anything true at the start of ' +
        'a block is true for all of it — which is what lets an analysis compute one fact per ' +
        'block instead of one per instruction, and is most of why the representation is worth ' +
        'having.',
      '**A back edge is one whose target dominates its source, not one that points ' +
        'backwards.** That distinction is the whole of reducibility. An edge into the middle ' +
        'of a loop from outside points backwards and is not a back edge, and a graph ' +
        'containing one is irreducible — no natural loop describes it, and several analyses ' +
        'need it handled explicitly.',
      '**Two back edges to one header are one loop with two latches.** A `continue` produces ' +
        'exactly that. Treating each back edge as its own loop reports two loops sharing every ' +
        'block, which makes the nesting forest not a forest and makes every depth wrong — and ' +
        'the demo has a fixture that produces it.',
      '**The natural loop of a back edge is its target plus everything that reaches its ' +
        'source without leaving through the target.** That is a backwards reachability walk ' +
        'from the latch, stopping at the header, and it is checked here against enumerating ' +
        'paths — because a loop finder that is subtly wrong reports a plausible set.',
      '**Nesting depth is what a cost model multiplies by.** A statement in a doubly nested ' +
        'loop runs once per iteration of both, so moving it out of the inner loop is worth ' +
        'roughly the outer loop\'s trip count and out of both is worth the product. The demo ' +
        'shades by depth because that is the number every loop optimisation is trading against.',
      '**A critical edge runs from a block with several successors to one with several ' +
        'predecessors, and there is nowhere on it to put code.** Any pass that needs to insert ' +
        'something on exactly that path — SSA destruction, most obviously — has no block to ' +
        'put it in. Splitting it inserts one, and skipping the split produces bugs that appear ' +
        'only where two paths merge.',
      '**An unreachable block is not merely wasted space.** It has no predecessors, so a phi ' +
        'in a block it targets has an entry for an edge that cannot be taken, and every ' +
        'dataflow analysis will compute facts for code that never runs and merge them into ' +
        'code that does. Removing them is a correctness step disguised as tidying.',
      '**Berugo cannot produce an irreducible graph, and that is a fact about the language.** ' +
        'Structured control flow — `if`, `while`, `break`, `continue` — always yields a ' +
        'reducible graph. Irreducibility comes from arbitrary jumps and from some code ' +
        'generators, and a language without `goto` gets the property for free, which is worth ' +
        'knowing when reading why an optimiser handles the case at all.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — the graph, its loops, and the edges that need splitting',
        markup: root.CfgTemplate.render()
      },
      diagram: diagram(),
      insight: '**Critical-edge splitting looks like bookkeeping and is a correctness ' +
        'requirement, which is why it is done once at the start rather than by each pass that ' +
        'discovers it needs it.** The reasoning is short. Several passes need to place an ' +
        'instruction that runs on exactly one edge: SSA destruction turns a phi operand into a ' +
        'copy in the predecessor that supplies it, and a register allocator inserts spills on ' +
        'the edges where the pressure changes. If the source has two successors, putting the ' +
        'copy at the end of it runs it on both paths; if the target has two predecessors, ' +
        'putting it at the start runs it whichever way you came. On a critical edge both are ' +
        'wrong and there is no third option. The failure is nasty in a specific way: it only ' +
        'appears when two paths merge and the two values differ, so the program works on every ' +
        'test where the branch goes one way. That is the shape of the bug that reaches ' +
        'production, and one prophylactic pass over the graph removes the whole class.'
    };
  }

  function render(app) {
    application = app;
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.CfgTemplate.controls,
      onChange: function () { update(); }
    });
    update();
  }

  /* ------------------------------------------------------------ measuring */

  const graphFor = root.Helpers.memoise(function (key) {
    const parts = JSON.parse(key);
    const fn = parts[0] === 'handmade' ? handmade()
      : root.Berugo.IrLower.compile(root.CfgTemplate.SAMPLES[parts[0]]).program.functions[0];

    if (parts[1]) root.Berugo.Cfg.splitCriticalEdges(fn);
    return build(fn);
  });

  /**
   * A graph built by hand, because Berugo cannot produce one.
   *
   * Every branch this lowering emits goes to a FRESH block, so a split never
   * targets a join and no edge is ever critical — which is a real property of
   * structured control flow and not an oversight. The same is true of
   * irreducibility: `if`, `while`, `break` and `continue` cannot make a loop
   * with two entries. A language with `goto`, a template expander, or a pass
   * that merges blocks all can, so the case has to be handled and therefore
   * has to be demonstrable. This is that demonstration, and labelling it
   * hand-built is the honest part.
   */
  function handmade() {
    const Ir = root.Berugo.Ir;
    const fn = Ir.makeFunction('handmade', []);
    const blocks = ['entry', 'split', 'left', 'right', 'exit']
      .map(function (label) { return Ir.makeBlock(fn, label); });
    const cond = Ir.freshRegister(fn, 'Bool');

    Ir.emit(blocks[0], 'const', { target: cond, value: true, origin: 'handmade' });
    Ir.terminate(blocks[0], 'jump', { target: blocks[1].id, origin: 'handmade' });
    /* b1 branches into a cycle at BOTH of its blocks, which is the whole
       construction. b2 and b3 form a loop with two entries, so neither
       dominates the other, neither edge between them is a back edge, and no
       natural loop describes the region — the definition of irreducible. Both
       edges out of b1 are also critical: a split going straight to a join. */
    Ir.terminate(blocks[1], 'branch', { cond: cond, then: blocks[2].id,
      other: blocks[3].id, origin: 'handmade' });
    Ir.terminate(blocks[2], 'branch', { cond: cond, then: blocks[3].id,
      other: blocks[4].id, origin: 'handmade' });
    Ir.terminate(blocks[3], 'branch', { cond: cond, then: blocks[2].id,
      other: blocks[4].id, origin: 'handmade' });
    Ir.terminate(blocks[4], 'ret', { value: null, origin: 'handmade' });
    return fn;
  }

  function build(fn) {
    const graph = root.Berugo.Cfg.build(fn);
    const tree = root.Berugo.Dominators.compute(graph);

    return { fn: fn, graph: graph, tree: tree,
      loops: root.Berugo.Cfg.loops(graph, tree),
      back: root.Berugo.Cfg.backEdges(graph, tree),
      rows: root.Berugo.Cfg.rows(fn),
      summary: root.Berugo.Cfg.summary(fn) };
  }

  /**
   * The oracle: which blocks can reach a latch without passing through the
   * header. That is the definition, enumerated, and it is deliberately not the
   * algorithm — a loop finder that is subtly wrong returns a plausible set,
   * and only a second implementation of the definition notices.
   */
  const oracleFor = root.Helpers.memoise(function (key) {
    const state = graphFor(key);

    return state.loops.map(function (loop) {
      const latches = loop.latches || [loop.latch];
      const body = new Set([loop.header]);

      latches.forEach(function (latch) {
        state.graph.blocks.forEach(function (id) {
          if (reachesWithout(state.graph, id, latch, loop.header)) body.add(id);
        });
      });
      return { header: loop.header, algorithm: loop.blocks.slice().sort(),
        oracle: Array.from(body).sort() };
    });
  });

  function reachesWithout(graph, from, target, avoid) {
    if (from === target) return true;
    const seen = new Set();
    const stack = [from];

    while (stack.length) {
      const id = stack.pop();

      if (id === target) return true;
      if (seen.has(id) || id === avoid) continue;
      seen.add(id);
      (graph.succs[id] || []).forEach(function (next) { stack.push(next); });
    }
    return false;
  }

  const suiteFor = root.Helpers.memoise(function () {
    return Object.keys(root.CfgTemplate.SAMPLES).concat(['handmade']).map(function (id) {
      const fn = id === 'handmade' ? handmade()
        : root.Berugo.IrLower.compile(root.CfgTemplate.SAMPLES[id]).program.functions[0];

      return Object.assign({ id: id }, root.Berugo.Cfg.summary(fn));
    });
  });

  function update() {
    const values = panel.values();
    const key = JSON.stringify([values['cf-sample'], Boolean(values['cf-split'])]);
    const state = graphFor(key);
    const index = Math.min(Number(values['cf-block']), state.rows.length - 1);

    panel.disable('cf-block', state.rows.length <= 1);
    paintGraph(state, state.rows[index]);
    paintMetrics(state);
    paintBlocks(state, index);
    paintLoops(state);
    paintOracle(key);
    paintSuite();
  }

  function paintGraph(state, row) {
    const depth = {};

    state.rows.forEach(function (entry) { depth[entry.id] = entry.depth; });
    if (chart && chart.chart) chart.chart.destroy();
    chart = root.CfgView.render(document.getElementById('cf-graph'), {
      graph: state.graph, backEdges: state.back, depth: depth,
      highlight: row ? row.id : null, lazyLib: application.lazyLib,
      notes: instructionNotes(state) });

    root.Helpers.setText('cf-graph-caption',
      'Shaded by loop depth, with back edges drawn in amber and curving to the left so they ' +
      'cannot be mistaken for a forward edge that happens to cross. The layout puts each block ' +
      'at its distance from the entry, which is what makes a back edge visibly point upwards.');
  }

  function instructionNotes(state) {
    const notes = {};

    state.rows.forEach(function (row) {
      notes[row.id] = row.instructions + ' instr';
    });
    return notes;
  }

  function paintMetrics(state) {
    const summary = state.summary;

    root.MetricGrid.update({
      'cf-blocks': { value: summary.blocks + ' / ' + summary.edges,
        note: 'blocks and edges; straight-line code is one block and no edges' },
      'cf-loops': { value: root.Format.exact(summary.loops),
        note: summary.backEdges + ' back edge' + (summary.backEdges === 1 ? '' : 's') +
          ', deepest nesting ' + summary.maxDepth },
      'cf-critical': { value: root.Format.exact(summary.critical),
        note: summary.critical ? 'each has nowhere to put code that runs on exactly that path'
          : 'nothing needs splitting in this graph' },
      'cf-reducible': { value: summary.reducible ? 'yes' : 'no',
        note: summary.reducible
          ? 'structured control flow always is, so no Berugo program is otherwise'
          : 'a cycle with two entries: neither block dominates the other, so no edge ' +
            'between them is a back edge and no natural loop covers them' }
    });
  }

  function paintBlocks(state, index) {
    root.jQuery('#cf-blocks-table tbody').html(state.rows.map(function (row, at) {
      return '<tr' + (at === index ? ' class="is-selected"' : '') + '><td class="mono">' +
        row.id + '</td><td class="mono">' + (row.preds.join(', ') || '—') +
        '</td><td class="mono">' + (row.succs.join(', ') || '—') + '</td><td class="mono">' +
        row.instructions + '</td><td class="mono">' + row.depth + '</td><td>' +
        (row.header ? 'yes' : '') + '</td></tr>';
    }).join(''));

    root.Helpers.setText('cf-blocks-table-caption',
      'A block with several predecessors is a join, and a join is where a value stops being ' +
      'the only possibility — which is exactly where 29.4 will put a phi function. A block ' +
      'with several successors is a split. An edge from a split to a join is critical, and the ' +
      'two columns are all it takes to find them.');
  }

  function paintLoops(state) {
    const inside = function (loop) {
      return state.loops.filter(function (other) {
        return other !== loop && other.blocks.indexOf(loop.header) !== -1;
      }).map(function (other) { return other.header; }).join(', ') || '—';
    };

    root.jQuery('#cf-loops-table tbody').html(state.loops.map(function (loop) {
      return '<tr><td class="mono">' + loop.header + '</td><td class="mono">' +
        (loop.latches || [loop.latch]).join(', ') + '</td><td class="mono">' +
        loop.blocks.join(', ') + '</td><td class="mono">' + loop.depth + '</td><td class="mono">' +
        inside(loop) + '</td></tr>';
    }).join('') || '<tr><td colspan="5">no loops in this program</td></tr>');

    root.Helpers.setText('cf-loops-table-caption', loopCaption(state));
  }

  function loopCaption(state) {
    const multi = state.loops.filter(function (loop) {
      return (loop.latches || []).length > 1;
    });

    if (!state.loops.length) {
      return 'Straight-line code has no back edges, so it has no loops — which is the honest ' +
        'answer rather than a degenerate one.';
    }
    return state.loops.length + ' loop' + (state.loops.length === 1 ? '' : 's') + ' from ' +
      state.back.length + ' back edge' + (state.back.length === 1 ? '' : 's') + '. ' +
      (multi.length
        ? 'One of them has ' + multi[0].latches.length + ' latches and is still ONE loop: ' +
          'a `continue` produces a second path back to the header, and counting it as a ' +
          'separate loop makes the nesting forest not a forest.'
        : 'Each has one latch here; the two-latches fixture shows the case where merging ' +
          'matters.');
  }

  function paintOracle(key) {
    const rows = oracleFor(key);
    const agreeing = rows.filter(function (row) {
      return row.algorithm.join(',') === row.oracle.join(',');
    }).length;

    root.jQuery('#cf-oracle tbody').html(rows.map(function (row) {
      const same = row.algorithm.join(',') === row.oracle.join(',');

      return '<tr><td class="mono">' + row.header + '</td><td class="mono">' +
        row.algorithm.join(', ') + '</td><td class="mono">' + row.oracle.join(', ') +
        '</td><td>' + (same ? 'yes' : 'NO') + '</td></tr>';
    }).join('') || '<tr><td colspan="4">no loops to check in this program</td></tr>');

    root.Helpers.setText('cf-oracle-caption',
      rows.length ? agreeing + ' of ' + rows.length + ' agree. The oracle is the definition ' +
        'enumerated — every block that can reach a latch without passing through the header — ' +
        'and it is deliberately a second implementation rather than a re-run of the first. A ' +
        'loop finder that is subtly wrong returns a plausible set of blocks, and nothing but ' +
        'a differently written check notices.'
        : 'Nothing to check: this program has no loops.');
  }

  function paintSuite() {
    const rows = suiteFor('all');

    root.jQuery('#cf-simplify tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + row.id + '</td><td class="mono">' + row.blocks +
        '</td><td class="mono">' + row.edges + '</td><td class="mono">' + row.critical +
        '</td><td class="mono">' + row.unreachable + '</td><td class="mono">' + row.loops +
        '</td></tr>';
    }).join(''));

    const critical = rows.filter(function (row) { return row.critical > 0; });
    const irreducible = rows.filter(function (row) { return !row.reducible; });

    root.Helpers.setText('cf-simplify-caption',
      'Every fixture, measured — and the two zero columns are the interesting result. No ' +
      'program Berugo can write produces a critical edge, because every branch target is a ' +
      'fresh block, and none produces an irreducible graph, because structured control flow ' +
      'cannot make a loop with two entries. ' + critical.length + ' of ' + rows.length +
      ' fixtures have a critical edge and ' + irreducible.length + ' are irreducible, and ' +
      'both are the hand-built one. That is worth reporting rather than hiding: a compiler ' +
      'still has to handle both, because a language with `goto`, a template expander, or a ' +
      'pass that merges blocks all produce them — but claiming the passes earn something here ' +
      'would be describing a different compiler. The unreachable column is zero for a ' +
      'different reason: the lowering already prunes, so the work is done earlier rather than ' +
      'not needed.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

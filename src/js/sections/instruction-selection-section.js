/**
 * Section: Instruction selection.
 *
 * The measurement is the cost sweep. One tile's cost is a slider, nothing is
 * recompiled, and the selection changes — which is the section's whole claim
 * that the model is data rather than code. A selector with "prefer
 * multiply-add" written into it cannot be retargeted and cannot be tuned.
 *
 * The second is the exhaustive oracle. Dynamic programming is optimal on a
 * tree, and that is a theorem worth checking rather than asserting: a tiler
 * with a wrong recurrence returns a valid cover at a slightly higher cost,
 * which reads as a target with no better option.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'instruction-selection';
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
      title: 'Diagram — an expression tree covered by instruction tiles',
      caption: 'The tree is the expression; the tiles are the target\'s instructions, each '
        + 'covering a shape and leaving holes the cover fills below it. Two covers of the same '
        + 'tree are shown: a multiply and an add, or one multiply-add. Which is cheaper is not '
        + 'a property of the tree — it is the two costs, and those come from the target. That '
        + 'is why the selector reads a table rather than knowing the answer.',
      definition: [
        'graph TD',
        'A["+"] --> T["t"]',
        'A --> M["*"]',
        'M --> V["v"]',
        'M --> K["2"]',
        'C1["cover A: MUL then ADD — 3 + 1 = 4"] --> A',
        'C2["cover B: one MADD — 4"] --> A'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**Instruction selection is a covering problem, and that framing is what makes it '
        + 'tractable.** The IR is a forest of expression trees; the target is a set of tiles, '
        + 'each matching a shape and costing something. Selecting instructions is choosing a '
        + 'set of tiles that covers every node exactly once, and "the best selection" is the '
        + 'cheapest such cover.',
      '**On a tree, dynamic programming gives the optimal cover, and it is one recurrence.** '
        + 'The cheapest cover of a node is the cheapest tile that matches there plus the '
        + 'cheapest covers of the holes that tile leaves. Memoise it and the whole tree is '
        + 'linear in the number of (node, tile) pairs. On a DAG it is NP-hard, which is why '
        + 'compilers cut the DAG into trees first.',
      '**A tree region ends where a value has two readers.** A value read twice has to live in '
        + 'a register — duplicating its computation into both trees would compute it twice — so '
        + 'it is a leaf of both and a root of its own. That is why the demo\'s tree count is '
        + 'not the instruction count, and why common-subexpression elimination in M29 changed '
        + 'the shape of this problem.',
      '**A complex instruction is a bigger tile, not a special case.** Multiply-add covers '
        + 'three nodes; an indexed load with a constant offset covers two. They are ordinary '
        + 'rows in the table whose patterns are deeper, and they win exactly when their cost is '
        + 'below the sum of the tiles they replace. The demo makes that a slider.',
      '**Commutativity has to be in the table, because the matcher does not know about it.** '
        + '`a + b * c` and `b * c + a` are different trees, so multiply-add needs two rows — '
        + 'and the first version of this table had one, which meant the tile never fired on '
        + 'the program the section was built around. Real selectors either write both or '
        + 'canonicalise the tree first.',
      '**An operator with no row is a crash, and that is the right behaviour.** A selector '
        + 'that quietly falls back to "something generic" for an unmatched node ships a target '
        + 'description with a hole in it. Refusing means the hole is found at build time, and '
        + '`binary:eq` had no row here until a conformance program used one.',
      '**The cost model is where the target lives, and it should be data.** Cycles per tile, '
        + 'in a table a retarget replaces. Encoding the same knowledge as `if (isMultiplyAdd)` '
        + 'in the selector means the second target is a second selector, and the third is a '
        + 'rewrite. Every serious back end — LLVM, GCC, and the BURS generators before them — '
        + 'keeps this as a description a tool compiles.',
      '**Selection, scheduling and allocation all want to go first.** Choosing a complex '
        + 'instruction constrains the schedule, scheduling changes register pressure, and '
        + 'spilling adds instructions the selector never saw. There is no order that is right '
        + 'everywhere, which is the same phase-ordering problem M29.6 measured, one level down.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: { title: 'Interactive demo — tiles, costs and the cover they pick',
        markup: root.IselTemplate.render() },
      diagram: diagram(),
      insight: '**Instruction selection is the point where the compiler stops being '
        + 'target-independent, and keeping the cost model as data rather than as code is what '
        + 'makes a second target tractable.** Everything before this section — the IR, the '
        + 'CFG, SSA, the passes — is the same for every machine. Here the compiler has to know '
        + 'that this processor has a multiply-add, that its indexed load takes a constant '
        + 'offset, and what each of those costs. The temptation is to write that knowledge '
        + 'into the selector, because for one target it is shorter. Then the second target '
        + 'arrives and the selector forks, and the third arrives and nobody can tell which '
        + 'branch belongs to which machine. Keeping it as a table means a retarget is a new '
        + 'table and a tuning pass is a changed number — which is exactly what the slider in '
        + 'the demo is, and it is why LLVM and GCC both describe their targets in a language '
        + 'a tool compiles rather than in the compiler itself.'
    };
  }

  function render(app) {
    application = app;
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });
    panel = root.ControlPanel.mount({
      controls: root.IselTemplate.controls,
      onChange: function () { update(); }
    });
    update();
  }

  /* ------------------------------------------------------------ measuring */

  const functionFor = root.Helpers.memoise(function (id) {
    return root.Berugo.IrLower.compile(root.IselTemplate.SAMPLES[id]).program.functions[0];
  });

  const selectionFor = root.Helpers.memoise(function (key) {
    const parts = JSON.parse(key);
    const costs = {};

    costs[parts[1]] = parts[2];
    const fn = functionFor(parts[0]);

    return { fn: fn, costs: costs,
      selected: root.Berugo.Isel.selectFunction(fn, { costs: costs }),
      optimal: root.Berugo.Isel.checkOptimal(fn, { costs: costs }),
      sweep: root.Berugo.Isel.costSweep(fn, parts[1], [1, 2, 3, 4, 5, 6, 8, 10]) };
  });

  function update() {
    const values = panel.values();
    const key = JSON.stringify([values['is-sample'], values['is-tile'],
      Number(values['is-cost'])]);
    const state = selectionFor(key);

    paintChart(state, values['is-tile']);
    paintMetrics(state);
    paintTrees(state);
    paintOracle(state);
    paintTiles(state, values['is-tile'], Number(values['is-cost']));
  }

  function paintChart(state, tile) {
    if (chart && chart.chart) chart.chart.destroy();
    chart = root.BytecodeView.bars(document.getElementById('is-chart'), {
      lazyLib: application.lazyLib,
      series: ['total', 'uses'],
      rows: state.sweep.map(function (row) {
        return { label: String(row.cost), total: row.total, uses: row.uses };
      }),
      summary: 'Selected cost in blue and how often the retuned tile is chosen in amber.' });

    root.Helpers.setText('is-chart-caption',
      'The horizontal axis is the cost assigned to ' + tile + '; blue is the total cost of the '
      + 'selection and amber is how many times that tile is chosen. Nothing is recompiled '
      + 'between bars — one number in the table moved, and the cover followed it. The step '
      + 'where amber drops to zero is the price at which the tile stops being worth using.');
  }

  function paintMetrics(state) {
    root.MetricGrid.update({
      'is-trees': { value: state.selected.trees,
        note: 'a value with two readers is a leaf of both trees and a root of its own' },
      'is-cost-total': { value: state.selected.cost,
        note: 'cycles, on the modelled target' },
      'is-instructions': { value: state.selected.instructions,
        note: 'one instruction per tile in the chosen cover' },
      'is-optimal': { value: state.optimal.disagreements === 0
        ? state.optimal.checked + ' of ' + state.optimal.checked : 'DISAGREES',
        note: state.optimal.disagreements + ' trees where the two answers differ' }
    });
  }

  function paintTrees(state) {
    root.jQuery('#is-trees-table tbody').html(state.selected.rows.map(function (row) {
      return '<tr><td class="mono">' + row.block + '</td><td class="mono">' + row.target +
        '</td><td class="mono">' + row.root + '</td><td class="mono">' + row.size +
        '</td><td class="mono">' + row.cost + '</td><td class="mono">' +
        row.tiles.map(function (tile) { return tile.tile; }).join(' ') + '</td></tr>';
    }).join('') || '<tr><td colspan="6">this program has no expression tree to cover</td></tr>');

    const widest = state.selected.rows.reduce(function (best, row) {
      return row.size > best.size ? row : best;
    }, state.selected.rows[0] || { size: 0, instructions: 0 });

    root.Helpers.setText('is-trees-table-caption',
      state.selected.trees + ' maximal trees, covered by ' + state.selected.instructions +
      ' tiles at a total of ' + state.selected.cost + ' cycles. The last column is the cover '
      + 'in emission order, innermost first, and reading it beside the node count is what '
      + 'makes the covering concrete: the largest tree here is ' + widest.size + ' nodes under '
      + widest.instructions + ' tiles, so ' + (widest.size - widest.instructions)
      + ' of its nodes ' + (widest.size - widest.instructions === 1 ? 'was' : 'were')
      + ' swallowed by a tile covering more than one.');
  }

  function paintOracle(state) {
    root.jQuery('#is-oracle tbody').html(state.optimal.rows.map(function (row) {
      return '<tr><td class="mono">' + row.block + '</td><td class="mono">' + row.root +
        '</td><td class="mono">' + row.size + '</td><td class="mono">' + row.dp +
        '</td><td class="mono">' + row.brute + '</td><td>' +
        (row.dp === row.brute ? 'yes' : 'NO') + '</td></tr>';
    }).join('') || '<tr><td colspan="6">no tree small enough to enumerate exhaustively</td></tr>');

    root.Helpers.setText('is-oracle-caption',
      state.optimal.checked + ' trees checked against every possible cover, with '
      + state.optimal.disagreements + ' disagreements. The exhaustive search is exponential in '
      + 'the tree and is only ever run on the small ones — which is what an oracle is for. A '
      + 'tiler with a wrong recurrence returns a VALID cover at a slightly higher cost, and '
      + 'that reads exactly like a target with no better option available.');
  }

  function paintTiles(state, tuned, cost) {
    const used = countTiles(state.selected.rows);
    const table = root.Berugo.Isel.tileTable(state.costs);

    root.jQuery('#is-tiles tbody').html(table.map(function (tile) {
      return '<tr><td class="mono">' + tile.id + '</td><td class="mono">' +
        root.Helpers.escapeHtml(patternOf(tile.pattern)) + '</td><td class="mono">' +
        tile.cost + '</td><td class="mono">' + (used[tile.id] || 0) + '</td><td>' +
        tile.about + '</td></tr>';
    }).join(''));

    root.Helpers.setText('is-tiles-caption',
      table.length + ' tiles, of which ' + Object.keys(used).length + ' are chosen on this '
      + 'program. ' + tuned + ' is currently priced at ' + cost + '. This table IS the target '
      + 'description: retargeting the back end means replacing it, and tuning means changing a '
      + 'number in it. A row that is never chosen anywhere is dead weight the same way an '
      + 'unfired peephole rule was in M29.6.');
  }

  function countTiles(rows) {
    const counts = {};

    rows.forEach(function (row) {
      row.tiles.forEach(function (tile) {
        counts[tile.tile] = (counts[tile.tile] || 0) + 1;
      });
    });
    return counts;
  }

  function patternOf(pattern) {
    if (!Array.isArray(pattern)) return String(pattern);
    if (pattern.length === 1) return String(pattern[0]);
    return pattern[0] + '(' + pattern.slice(1).map(patternOf).join(', ') + ')';
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
